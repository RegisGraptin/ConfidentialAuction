// SPDX-License-Identifier: TBD
pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "fhevm/gateway/GatewayCaller.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {SepoliaZamaFHEVMConfig} from "fhevm/config/ZamaFHEVMConfig.sol";
import { SepoliaZamaGatewayConfig } from "fhevm/config/ZamaGatewayConfig.sol";

import {IConfidentialAuction, Bid} from "./interfaces/IPrivateAuction.sol";

import {BokkyPooBahsRedBlackTreeLibrary} from "./lib/BokkyPooBahsRedBlackTreeLibrary.sol";

contract PrivateAuction is
    SepoliaZamaFHEVMConfig,
    SepoliaZamaGatewayConfig,
    ERC20,
    Ownable,
    GatewayCaller,
    ReentrancyGuard,
    IConfidentialAuction
{
    using BokkyPooBahsRedBlackTreeLibrary for BokkyPooBahsRedBlackTreeLibrary.Tree;
    BokkyPooBahsRedBlackTreeLibrary.Tree priceOrderTree;

    // Auction properties
    uint256 public lastBidId;
    uint256 public endAuctionTime;

    // Decypher properties
    uint256 public lastAuctionProccessed;

    mapping(uint256 bidId => Bid) public bids;
    mapping(uint256 requestId => uint256 bidId) public decypherProcess;

    // The Auction time is finished
    error FinishedAuctionError();

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

    modifier _activeAuction() {
        if (block.timestamp >= endAuctionTime) {
            revert FinishedAuctionError();
        }
        _;
    }

    // 1. Create auction and ask to decypher total requested value
    // 2. Decypher it by the callback of the gateway
    // 3. User validate the auction by paying the value

    // FIXME: Do we need a min fix allocation to avoid flood
    function submitEncryptedBid(
        einput eRequestedAmount,
        einput ePricePerUnit,
        bytes calldata inputProof
    ) external override _activeAuction returns (uint256){

        // Expect euint256 values
        euint256 eAmount = TFHE.asEuint256(eRequestedAmount, inputProof);
        euint256 ePrice = TFHE.asEuint256(ePricePerUnit, inputProof);

        // Allow the smart contract to decypher those data on the resolution time
        TFHE.allowThis(eAmount);
        TFHE.allowThis(ePrice);

        // Get the expected total amount to be paid
        euint256 eAmountToPay = TFHE.mul(eAmount, ePrice);
        TFHE.allowThis(eAmountToPay);

        // Request to decypher the total amount to be able to verify user payment

        uint256[] memory cts = new uint256[](1);
        cts[0] = Gateway.toUint256(eAmountToPay);
        uint256 requestId = Gateway.requestDecryption(
            cts,
            this.gatewayDecypherBidTotalValue.selector,
            0,
            block.timestamp + 100,
            false
        );
        // Map the request ID to the auction Id
        decypherProcess[requestId] = lastBidId;

        // Create an auction that needs to be validated
        bids[lastBidId] = Bid({
            user: msg.sender,
            creationTime: block.timestamp,
            eRequestedAmount: eAmount,
            ePricePerUnit: ePrice,
            dRequestedAmount: 0,
            dPricePerUnit: 0,
            validated: false,
            totalValueLock: 0
        });

        emit BidSubmitted(msg.sender, lastBidId);

        // Increment the auction
        lastBidId++;

        return lastBidId - 1;
    }

    function gatewayDecypherBidTotalValue(
        uint256 requestId,
        uint256 result
    ) public onlyGateway {
        bids[decypherProcess[requestId]].totalValueLock = result;
        // TODO: emit smth
    }

    function confirmBid(
        uint256 bidId
    ) external payable _activeAuction nonReentrant {
        require(bidId < lastBidId, "INVALID_AUCTION_ID");

        // We expect the user to pay
        require(bids[bidId].user == msg.sender, "INVALID_USER");
        require(!bids[bidId].validated, "ALREADY_VALIDATED");

        // We should know how much eth the user has to pay
        require(bids[bidId].totalValueLock > 0, "INVALID_AUCTION");

        // We should have enough token
        require(
            msg.value >= bids[bidId].totalValueLock,
            "NOT_ENOUGH_FUNDS"
        );

        // Validate the auction
        bids[bidId].validated = true;

        // TODO: emit event ?

        // Pay back the excess token to the user
        uint256 excess = msg.value - bids[bidId].totalValueLock;

        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            require(success, "Refund failed");
        }
    }

    function cancelBid(uint256 bidId
    ) external override  _activeAuction nonReentrant {
        require(bidId < lastBidId, "INVALID_AUCTION_ID");
        require(bids[bidId].user == msg.sender, "INVALID_USER");
        require(bids[bidId].validated, "NOT_VALIDATED_AUCTION");

        uint256 value = bids[bidId].totalValueLock;
        bids[bidId].validated = false;

        // TODO: Delete is not possible, as we have two mapping one for decypher the total amount
        // Before being able to pay. This will be an issue, if someone is able to mix the auction value.

        // TODO :: emit event
        if (value > 0) {
            (bool success, ) = msg.sender.call{value: value}("");
            require(success, "Refund failed");
        }
    }

    function resolveAuction(uint256 numberToProcceed) external override {
        // We need to decypher all the token allocation by the user
        require(block.timestamp > endAuctionTime, "UNFINISHED_AUCTION");
        require(lastAuctionProccessed < lastBidId, "PROCEED_ALL_DATA"); // TODO: Use it for last process

        // Request to decypher all the vote
        while (numberToProcceed > 0 && lastAuctionProccessed < lastBidId) {
            // Process only valid auction
            if (bids[lastAuctionProccessed].validated) {
                // euint256 eRequestedAmount;
                // euint256 ePricePerUnit;

                uint256[] memory cts = new uint256[](2);
                cts[0] = Gateway.toUint256(
                    bids[lastAuctionProccessed].eRequestedAmount
                );
                cts[1] = Gateway.toUint256(
                    bids[lastAuctionProccessed].ePricePerUnit
                );
                uint256 requestId = Gateway.requestDecryption(
                    cts,
                    this.gateway_callback_decypher_auction.selector,
                    0,
                    block.timestamp + 100,
                    false
                );

                // FIXME: second time we are using it - Issue of overriting ??
                // Map the request ID to the auction Id
                decypherProcess[requestId] = lastAuctionProccessed;
            }

            lastAuctionProccessed++;
            numberToProcceed--;
        }
    }

    // FIXME: How to know we can go to the next steps ?
    // Need a counter to validate them ??

    // Keep unicity given a price and list of auction id
    mapping(uint256 minPrice => uint256[]) orderedAuctionPerUser;
    uint256[] sortedMinPrice;


    // FIXME: name nomenclature
    function gateway_callback_decypher_auction(
        uint256 requestId,
        uint256 requestedAmount,
        uint256 pricePerUnit
    ) public onlyGateway {
        // Get the auction id
        uint256 bidId = decypherProcess[requestId];

        // FIXME :: Store decypher value

        // Store decypher data
        bids[bidId].dRequestedAmount = requestedAmount;
        bids[bidId].dPricePerUnit = pricePerUnit;

        // Does the price already exists
        if (orderedAuctionPerUser[pricePerUnit].length == 0) {
            // Keep track of the price to iterate later on to asc order
            priceOrderTree.insert(pricePerUnit);
        }

        // Add the id to the matching value
        orderedAuctionPerUser[pricePerUnit].push(bidId);

        // TODO: emit smth
    }

    // FIXME:: check condition
    function distributeToken(uint256 numberToProceed) external override nonReentrant { 
        while (
            balanceOf(address(this)) > 0 && // We still have token to distribute
            numberToProceed > 0 &&
            priceOrderTree.root != 0 // We still have available bids
        ) {
            // Get the better price
            uint256 keyPrice = priceOrderTree.last();

            // Get the mapped bids
            while (orderedAuctionPerUser[keyPrice].length > 0) {
                if (numberToProceed == 0) {
                    // Stop the process
                    return;
                }

                // Get the last item and remove it
                uint256 bidId = orderedAuctionPerUser[keyPrice][
                    orderedAuctionPerUser[keyPrice].length - 1
                ];
                orderedAuctionPerUser[keyPrice].pop();

                // compute the token to send
                uint256 tokenToSend = Math.min(
                    balanceOf(address(this)),
                    bids[bidId].dRequestedAmount
                );

                // Update the token paid value
                bids[bidId].totalValueLock -= tokenToSend * bids[bidId].dPricePerUnit;

                // Transfer to the user
                _transfer(address(this), bids[bidId].user, tokenToSend);

                // We can stop if we have no more token to distribute
                if (balanceOf(address(this)) == 0) {
                    return;
                }

                numberToProceed--;
            }

            // No more bids for this key price
            // We can remove the price from our tree
            priceOrderTree.remove(keyPrice);
        }

        // In the particular case where we have explored all the bids
        // And we still have tokens, we send them to the owner

        if (balanceOf(address(this)) > 0 && priceOrderTree.root == 0) {
            _transfer(address(this), this.owner(), balanceOf(address(this)));

            // FIXME: Need to transfer to the user the fund collected
        }
    }

    function refundUnsuccessfulBids(uint256 bidId) external override nonReentrant {
        require(balanceOf(address(this)) == 0, "STILL_TOKEN_UNDISTRIBUTED");
        require(bids[bidId].user == msg.sender, "INVALID_USER");
        require(bids[bidId].validated, "NOT_VALIDATED_AUCTION");
        require(bids[bidId].totalValueLock > 0, "NO_MORE_TOKEN");

        uint256 unlockAmount = bids[bidId].totalValueLock;
        
        // Update the value
        bids[bidId].totalValueLock = 0;

        // TODO : Emit action

        (bool success, ) = msg.sender.call{value: unlockAmount}("");
        require(success, "Refund failed");
    }
}
