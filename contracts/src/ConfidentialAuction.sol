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

    /// @notice Auction settlement price defined after the resolution phase if sufficient bids.
    uint256 public auctionSettlePrice;
    
    /// @notice Total number of tokens to be distributed to the bidders.
    ///         In case insufficient bidders, the auction is canceled.
    uint256 public auctionAllocation;

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
    using BokkyPooBahsRedBlackTreeLibrary for BokkyPooBahsRedBlackTreeLibrary.Tree;
    BokkyPooBahsRedBlackTreeLibrary.Tree internal _priceOrderTree;

    //////////////////////////////////////////////////////////////////
    /// View functions
    //////////////////////////////////////////////////////////////////

    function bids(uint256 bidId) external view returns (Bid memory) {
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
        if (_endAuctionTime <= block.timestamp) {
            revert InvalidEndAuctionTime(_endAuctionTime, block.timestamp);
        }
        _mint(address(this), _supply);
        endAuctionTime = _endAuctionTime;
    }

    modifier activeAuction() {
        if (block.timestamp >= endAuctionTime) {
            revert AuctionAlreadyFinished();
        }
        _;
    }

    /// @inheritdoc IConfidentialAuction
    /// @dev We allow the contract to request future decryption of the encrypted parameters.
    ///      At this phase, only the total value amount derived from the input bid will be decrypted.
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
            totalValueLock: 0,
            totalAllocation: 0
        });

        // Save the bid for the user
        _userBids[msg.sender].push(nextBidId);

        emit BidSubmitted(msg.sender, nextBidId);

        nextBidId++;
        return nextBidId - 1;
    }

    function confirmBid(uint256 bidId) external payable override activeAuction nonReentrant {
        if (bidId >= nextBidId) revert InvalidBidId(bidId, nextBidId);
        if (_bids[bidId].user != msg.sender) revert UnauthorizedUser(_bids[bidId].user, msg.sender);
        if (_bids[bidId].confirmed) revert BidAlreadyConfirmed(bidId);
        if (_bids[bidId].totalValueLock == 0) revert GatewayProcessRequired(bidId, _bids[bidId].totalValueLock);
        if (msg.value < _bids[bidId].totalValueLock) {
            revert InsufficientFunds(msg.sender, _bids[bidId].totalValueLock, msg.value);
        }

        // Confirm the bid
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
        if (bidId >= nextBidId) revert InvalidBidId(bidId, nextBidId);
        if (_bids[bidId].user != msg.sender) revert UnauthorizedUser(_bids[bidId].user, msg.sender);
        if (!_bids[bidId].confirmed) revert BidNotConfirmed(bidId);

        uint256 value = _bids[bidId].totalValueLock;
        _bids[bidId].confirmed = false;

        emit BidCanceled(_bids[bidId].user, bidId, value);

        if (value > 0) {
            (bool success, ) = msg.sender.call{ value: value }("");
            require(success, "Refund failed");
        }
    }

    function resolveAuction(uint256 numberToProcceed) external override {
        if (block.timestamp <= endAuctionTime) revert AuctionNotFinished();
        if (_pendingGatewayItems > 0) revert PendingGatewayProcess();
        if (lastBidProcessed >= nextBidId) revert AllBidsProcessed();

        // Request to decrypt all the vote
        while (numberToProcceed > 0 && lastBidProcessed < nextBidId) {
            
            // Process only confirmed bid
            uint256 index = nextBidId - lastBidProcessed - 1;
            if (_bids[index].confirmed) {
                
                // Decrypt bid parameters
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

                // Map the request ID to the bid Id
                _gatewayProcess[requestId] = index;
            }

            lastBidProcessed++;
            numberToProcceed--;
        }
    }

    function definedAllocation(uint256 numberToProceed) external override nonReentrant {
        if (block.timestamp <= endAuctionTime) revert AuctionNotFinished();
        if (_pendingGatewayItems > 0) revert PendingGatewayProcess();
        if (lastBidProcessed < nextBidId) revert PendingBidsToProcess();
        
        while (
            numberToProceed > 0 
            && auctionAllocation < totalSupply() // We still have token to distribute
            && _priceOrderTree.root != 0    // We still have available bids
        ) {
            // Get the last descending price
            uint256 keyPrice = _priceOrderTree.last();

            auctionSettlePrice = keyPrice;

            // Get associated bids for this price
            while (
                auctionAllocation < totalSupply()
                && _orderedAuctionPerUser[keyPrice].length > 0
            ) {
                if (numberToProceed == 0) {  // Stop the process
                    return;
                }

                // Get the last item and remove it
                uint256 lastIndex = _orderedAuctionPerUser[keyPrice].length - 1;
                uint256 bidId = _orderedAuctionPerUser[keyPrice][lastIndex];
                _orderedAuctionPerUser[keyPrice].pop();

                // Compute the number of token to send
                
                // Defined the token allocation for this bid
                uint256 allocation = Math.min(totalSupply() - auctionAllocation, _bids[bidId].dRequestedAmount);
                
                _bids[bidId].totalAllocation = allocation;
                auctionAllocation += allocation;

                // Emit and event
                emit BidAllocationSet(bidId, _bids[bidId].user, allocation);

                numberToProceed--;
            }

            // No more bids for this price
            // We can remove the price from our tree
            _priceOrderTree.remove(keyPrice);
        }

        // In the particular case where we have explored all the bids but we had not enough
        // allocation, we are cancelling the auction.
        // We send all the token to the owner. 
        if (
            numberToProceed > 0 
            && auctionAllocation < totalSupply() // We still have token to distribute
            && _priceOrderTree.root == 0         // We have explored all the bids
        ) {
            auctionSettlePrice = 0;

            emit AuctionFailed(auctionAllocation, totalSupply());

            _transfer(address(this), this.owner(), totalSupply());            
        }
    }

    function claimAllocation(uint256 bidId) external override nonReentrant {
        if (block.timestamp <= endAuctionTime) revert AuctionNotFinished();
        if (auctionSettlePrice == 0) revert AuctionFailedError();
        if (auctionAllocation < totalSupply()) revert PendingBidsToProcess();
        if (_bids[bidId].user != msg.sender) revert UnauthorizedUser(_bids[bidId].user, msg.sender);
        if (!_bids[bidId].confirmed) revert BidNotConfirmed(bidId);
        if (_bids[bidId].totalAllocation == 0) revert NoAllocation();


        // Update allocation and ETH price
        uint256 allocation = _bids[bidId].totalAllocation;
        _bids[bidId].totalAllocation = 0;
        _bids[bidId].totalValueLock -= allocation * auctionSettlePrice;

        emit AuctionAllocationTransferred(bidId, _bids[bidId].user, allocation);

        _transfer(address(this), _bids[bidId].user, allocation);
    }

    /// @dev If the users has an allocation, he should claimed it first before getting refund.
    function refundBids(uint256 bidId) external override nonReentrant {
        if (block.timestamp <= endAuctionTime) revert AuctionNotFinished();
        
        // Check Bid details
        if (_bids[bidId].user != msg.sender) revert UnauthorizedUser(_bids[bidId].user, msg.sender);
        if (!_bids[bidId].confirmed) revert BidNotConfirmed(bidId);
        if (_bids[bidId].totalValueLock == 0) revert NoTokensLocked();
        if (auctionSettlePrice > 0 && _bids[bidId].totalAllocation > 0) revert AllocationNotClaimed(bidId);

        // Check we have finished the auction
        if (auctionAllocation == 0) revert PendingBidsToProcess();
        if (auctionSettlePrice > 0 && auctionAllocation < totalSupply()) revert PendingBidsToProcess();

        // Here we should either be in a failed allocation, meaning a auctionSettlePrice = 0
        // Or have allocate all the token: auctionAllocation >= totalSupply()
        
        // Update the value in the bid
        uint256 unlockAmount = _bids[bidId].totalValueLock;
        _bids[bidId].totalValueLock = 0;

        emit BidRefunded(bidId, msg.sender, unlockAmount);

        (bool success, ) = msg.sender.call{ value: unlockAmount }("");
        require(success, "Refund failed");
    }

    function claimETHToken() public override onlyOwner nonReentrant {
        if (block.timestamp <= endAuctionTime) revert AuctionNotFinished();
        if (ethClaimedAfterSell) revert ETHAlreadyClaimed();

        // Check that the auction went properly
        if (auctionSettlePrice == 0) revert AuctionFailedError();
        if (auctionAllocation < totalSupply()) revert PendingBidsToProcess();

        ethClaimedAfterSell = true;
        emit AuctionETHClaimed(msg.sender, auctionSettlePrice * totalSupply());

        (bool success, ) = msg.sender.call{ value: auctionSettlePrice * totalSupply() }("");
        require(success, "Refund failed");
    }

    receive() external payable {}

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
