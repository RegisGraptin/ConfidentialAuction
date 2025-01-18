// SPDX-License-Identifier: TBD
pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "fhevm/gateway/GatewayCaller.sol";

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { SepoliaZamaFHEVMConfig } from "fhevm/config/ZamaFHEVMConfig.sol";
import { SepoliaZamaGatewayConfig } from "fhevm/config/ZamaGatewayConfig.sol";

import { BokkyPooBahsRedBlackTreeLibrary } from "./lib/BokkyPooBahsRedBlackTreeLibrary.sol";

import { IConfidentialAuction, Bid } from "./interfaces/IConfidentialAuction.sol";


/// @title Confidential Auction Smart Contract
/// @dev This contract manages a confidential auction process, where bids are encrypted, decrypted, and evaluated.
///      The auction follows a sealed-bid model with encrypted bids. It integrates with a FHE mechanism using 
///      Zama's fhEVM
contract ConfidentialAuction is
    SepoliaZamaFHEVMConfig,
    SepoliaZamaGatewayConfig,
    ERC20,
    Ownable,
    GatewayCaller,
    ReentrancyGuard,
    IConfidentialAuction
{
    
    /// @notice The ID of the most recent bid
    uint256 public nextBidId;

    /// @notice The timestamp at which the auction ends
    uint256 public endAuctionTime;

    /// @notice The last processed bid ID (used for managing bid resolution)
    uint256 public lastBidProcessed;

    /// @notice Number of items that are pending to be processed by the ZAMA Gateway 
    uint256 private _pendingGatewayItems;

    /// @notice Total amount of ETH raised during the auction
    uint256 public totalEthFromSale;
    
    /// @notice Indicates whether the owner has claimed the ETH after the auction sale.
    bool public ethClaimedAfterSell;

    /// @notice A mapping of bid ID to Bid structure, used to store bid details
    mapping(uint256 bidId => Bid) private _bids;

    /// @notice A mapping of user address to a list of bidd
    mapping(address => uint256[]) private _userBids;

    /// @notice A mapping from request ID to bid ID for the decryption process
    mapping(uint256 requestId => uint256 bidId) internal _gatewayProcess;

    /// @notice A mapping to order bids by price. It stores an array of bid IDs for each price.
    mapping(uint256 price => uint256[] bidIds) internal _orderedAuctionPerUser;

    /// @dev This contract uses the BokkyPooBahsRedBlackTreeLibrary to efficiently manage and order price of the bid.
    ///      It will help us during the resolution where we can have the price sorted and resolve the bid accordingly. 

    /// @dev This contract uses the BokkyPooBahsRedBlackTreeLibrary to efficiently manage and order the prices of bids.
    using BokkyPooBahsRedBlackTreeLibrary for BokkyPooBahsRedBlackTreeLibrary.Tree;
    BokkyPooBahsRedBlackTreeLibrary.Tree internal _priceOrderTree;


    //////////////////////////////////////////////////////////////////
    /// View functions
    //////////////////////////////////////////////////////////////////

    function bids(uint256 bidId) external view returns(Bid memory) {
        return _bids[bidId];
    }

    function userBids(address user) external view returns (uint256[] memory) {
        return _userBids[user];
    }


    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _supply,
        uint256 _endAuctionTime
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        require(_endAuctionTime > block.timestamp, "INVALID_END_AUCTION_TIME");

        _mint(address(this), _supply);
        endAuctionTime = _endAuctionTime;
    }

    modifier activeAuction() {
        if (block.timestamp >= endAuctionTime) {
            revert FinishedAuctionError();
        }
        _;
    }

    /// @inheritdoc IConfidentialAuction
    /// @dev We allow the contract to request future decryption of the encrypted parameters.
    ///      At this phase, only the total value amount derived from the input bid will be decrypted.
    /// 
    function submitEncryptedBid(
        einput eRequestedAmount,
        einput ePricePerUnit,
        bytes calldata inputProof
    ) external override activeAuction returns (uint256) {
        // Expect euint256 values
        euint256 eAmount = TFHE.asEuint256(eRequestedAmount, inputProof);
        euint256 ePrice = TFHE.asEuint256(ePricePerUnit, inputProof);

        // Allow the smart contract to decrypt those data for the resolution phase
        TFHE.allowThis(eAmount);
        TFHE.allowThis(ePrice);

        // Get the expected total amount to be paid
        euint256 eAmountToPay = TFHE.mul(eAmount, ePrice);
        TFHE.allowThis(eAmountToPay);

        // Request to decrypt the total amount to be able to verify and confirm the bid
        uint256[] memory cts = new uint256[](1);
        cts[0] = Gateway.toUint256(eAmountToPay);
        uint256 requestId = Gateway.requestDecryption(
            cts,
            this.gatewaydecryptBidTotalValue.selector,
            0,
            block.timestamp + 100,
            false
        );

        // Map the request ID to the bid Id
        _gatewayProcess[requestId] = nextBidId;
        _pendingGatewayItems++;

        // Create an auction that needs to be confirmed
        _bids[nextBidId] = Bid({
            user: msg.sender,
            creationTime: block.timestamp,
            eRequestedAmount: eAmount,
            ePricePerUnit: ePrice,
            dRequestedAmount: 0,
            dPricePerUnit: 0,
            confirmed: false,
            totalValueLock: 0
        });

        // Save the bid for the user
        _userBids[msg.sender].push(nextBidId);

        emit BidSubmitted(msg.sender, nextBidId);

        nextBidId++;
        return nextBidId - 1;
    }


    function confirmBid(uint256 bidId) external payable activeAuction nonReentrant {
        require(bidId < nextBidId, "INVALID_BID");
        require(_bids[bidId].user == msg.sender, "INVALID_USER");
        require(!_bids[bidId].confirmed, "ALREADY_CONFIRMED");

        // We should know how much eth the user has to pay
        require(_bids[bidId].totalValueLock > 0, "NEED_GATEWAY_PROCESS");

        // We should have enough token
        require(msg.value >= _bids[bidId].totalValueLock, "NOT_ENOUGH_FUNDS");

        // Validate the auction
        _bids[bidId].confirmed = true;
        emit BidConfirmed(msg.sender, bidId, _bids[bidId].totalValueLock);

        // Pay back the excess token to the user
        uint256 excess = msg.value - _bids[bidId].totalValueLock;
        if (excess > 0) {
            (bool success, ) = msg.sender.call{ value: excess }("");
            require(success, "Refund failed");
        }
    }

    function cancelBid(uint256 bidId) external override activeAuction nonReentrant {
        require(bidId < nextBidId, "INVALID_BID");
        require(_bids[bidId].user == msg.sender, "INVALID_USER");
        require(_bids[bidId].confirmed, "NOT_confirmed_AUCTION");

        uint256 value = _bids[bidId].totalValueLock;
        _bids[bidId].confirmed = false;

        // TODO: Delete is not possible, as we have two mapping one for decrypt the total amount
        // Before being able to pay. This will be an issue, if someone is able to mix the auction value.

        emit BidCanceled(_bids[bidId].user, bidId, value);

        if (value > 0) {
            (bool success, ) = msg.sender.call{ value: value }("");
            require(success, "Refund failed");
        }
    }

    function resolveAuction(uint256 numberToProcceed) external override {
        // We need to decrypt all the token allocation by the user
        require(block.timestamp > endAuctionTime, "UNFINISHED_AUCTION");
        require(lastBidProcessed < nextBidId, "PROCEED_ALL_DATA"); // TODO: Use it for last process
        require(_pendingGatewayItems == 0, "UNFINISHED_GATEWAY_PROCESS");

        // decrypt process needs to be done backward (lastBid to 0)
        // In order to sort during the gateway decrypt process 

        // Request to decrypt all the vote
        while (numberToProcceed > 0 && lastBidProcessed < nextBidId) {
            // Process only confirmed bid
            uint256 index = nextBidId - lastBidProcessed - 1;
            if (_bids[index].confirmed) {
                // Decrypt the bid parameter
                uint256[] memory cts = new uint256[](2);
                cts[0] = Gateway.toUint256(_bids[index].eRequestedAmount);
                cts[1] = Gateway.toUint256(_bids[index].ePricePerUnit);
                uint256 requestId = Gateway.requestDecryption(
                    cts,
                    this.gatewayCallbackDecryptBid.selector,
                    0,
                    block.timestamp + 100,
                    false
                );
                _pendingGatewayItems++;

                // Map the request ID to the auction Id
                _gatewayProcess[requestId] = index;
            }

            lastBidProcessed++;
            numberToProcceed--;
        }
    }

    

    // FIXME:: check condition
    function distributeToken(uint256 numberToProceed) external override nonReentrant {
        require(block.timestamp > endAuctionTime, "UNFINISHED_AUCTION");
        require(lastBidProcessed >= nextBidId, "PROCEED_ALL_DATA");
        require(_pendingGatewayItems == 0, "UNFINISHED_GATEWAY_PROCESS");


        while (
            balanceOf(address(this)) > 0 && // We still have token to distribute
            numberToProceed > 0 &&
            _priceOrderTree.root != 0 // We still have available bids
        ) {
            // Get the better price
            uint256 keyPrice = _priceOrderTree.last();

            // Get the mapped bids
            while (_orderedAuctionPerUser[keyPrice].length > 0) {
                if (numberToProceed == 0) {
                    // Stop the process
                    return;
                }

                // Get the last item and remove it
                uint256 bidId = _orderedAuctionPerUser[keyPrice][
                    _orderedAuctionPerUser[keyPrice].length - 1
                ];
                _orderedAuctionPerUser[keyPrice].pop();

                // compute the token to send
                uint256 tokenToSend = Math.min(balanceOf(address(this)), _bids[bidId].dRequestedAmount);

                uint256 ethValue = tokenToSend * _bids[bidId].dPricePerUnit;

                // Increase the claimed eth value
                totalEthFromSale += ethValue;

                // Update the token paid value
                _bids[bidId].totalValueLock -= ethValue;

                // Emit and event
                emit AuctionTokenTransferred(_bids[bidId].user, tokenToSend);

                // Transfer to the user
                _transfer(address(this), _bids[bidId].user, tokenToSend);

                // We can stop if we have no more token to distribute
                if (balanceOf(address(this)) == 0) {
                    return;
                }

                numberToProceed--;
            }

            // No more bids for this key price
            // We can remove the price from our tree
            _priceOrderTree.remove(keyPrice);
        }

        // In the particular case where we have explored all the bids
        // And we still have tokens, we send them to the owner

        if (balanceOf(address(this)) > 0 && _priceOrderTree.root == 0) {
            _transfer(address(this), this.owner(), balanceOf(address(this)));

            // FIXME: Need to transfer to the user the fund collected
        }
    }

    function claimETHToken() public onlyOwner nonReentrant {
        require(block.timestamp > endAuctionTime, "UNFINISHED_AUCTION");
        require(balanceOf(address(this)) == 0, "STILL_TOKEN_TO_DISTRIBUTE");
        require(!ethClaimedAfterSell, "ALREADY_CLAIMED");
        
        ethClaimedAfterSell = true;

        (bool success, ) = msg.sender.call{ value: totalEthFromSale }("");
        require(success, "Refund failed");
    }

    function refundUnsuccessfulBids(uint256 bidId) external override nonReentrant {
        require(balanceOf(address(this)) == 0, "STILL_TOKEN_UNDISTRIBUTED");
        require(_bids[bidId].user == msg.sender, "INVALID_USER");
        require(_bids[bidId].confirmed, "INVALID_BID");
        require(_bids[bidId].totalValueLock > 0, "NO_MORE_TOKEN");

        uint256 unlockAmount = _bids[bidId].totalValueLock;
        
        // Update the value
        _bids[bidId].totalValueLock = 0;

        emit UnsuccessfulBidRefunded(bidId, msg.sender, unlockAmount);

        (bool success, ) = msg.sender.call{ value: unlockAmount }("");
        require(success, "Refund failed");
    }

    //////////////////////////////////////////////////////////////////
    /// Gateway Callback Functions
    //////////////////////////////////////////////////////////////////

    /// Gateway Callback - Decrypt the total value of the bid requested
    function gatewaydecryptBidTotalValue(uint256 requestId, uint256 result) public onlyGateway {
        _bids[_gatewayProcess[requestId]].totalValueLock = result;
        emit GatewayTotalValueRequested(_gatewayProcess[requestId], result);
        delete _gatewayProcess[requestId];
        _pendingGatewayItems--;
    }

    /// Gateway Callback - decrypt the bid parameter
    function gatewayCallbackDecryptBid(
        uint256 requestId,
        uint256 requestedAmount,
        uint256 pricePerUnit
    ) public onlyGateway {
        // Get the bid id
        uint256 bidId = _gatewayProcess[requestId];

        // Store decrypt data
        _bids[bidId].dRequestedAmount = requestedAmount;
        _bids[bidId].dPricePerUnit = pricePerUnit;

        // Does the price already exists
        if (_orderedAuctionPerUser[pricePerUnit].length == 0) {
            // Keep track of the price to iterate later on to asc order
            _priceOrderTree.insert(pricePerUnit);
        }

        // Add the id to the matching value
        _orderedAuctionPerUser[pricePerUnit].push(bidId);
        _pendingGatewayItems--;

        delete _gatewayProcess[requestId];
        emit GatewayDecryptBid(bidId, requestedAmount, pricePerUnit);
    }

}
