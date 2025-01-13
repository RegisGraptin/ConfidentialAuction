// SPDX-License-Identifier: TBD
pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "fhevm/gateway/GatewayCaller.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {SepoliaZamaFHEVMConfig} from "fhevm/config/ZamaFHEVMConfig.sol";

import {IPrivateAuction, Auction} from "./interfaces/IPrivateAuction.sol";

import {BokkyPooBahsRedBlackTreeLibrary} from "./lib/BokkyPooBahsRedBlackTreeLibrary.sol";

contract PrivateAuction is
    SepoliaZamaFHEVMConfig,
    ERC20,
    Ownable,
    GatewayCaller,
    ReentrancyGuard
{
    using BokkyPooBahsRedBlackTreeLibrary for BokkyPooBahsRedBlackTreeLibrary.Tree;
    BokkyPooBahsRedBlackTreeLibrary.Tree priceOrderTree;

    // Auction properties
    uint256 public lastAuctionId;
    uint256 public endAuctionTime;

    // Decypher properties
    uint256 public lastAuctionProccessed;

    mapping(uint256 auctionId => Auction) public auctions;
    mapping(uint256 requestId => uint256 auctionId) public decypherProcess;

    // The Auction time is finished
    error FinishedAuctionError();

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _supply,
        uint256 _endAuctionTime
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        require(_endAuctionTime > block.timestamp, "INVALID_END_AUCTION_TIME");
        
        _mint(msg.sender, _supply);
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
    function createAuction(
        einput eRequestedAmount,
        einput ePricePerUnit,
        bytes calldata eRequestedAmountProof,
        bytes calldata ePricePerUnitProof
    ) external _activeAuction returns (uint256) {
        // Expect euint256 values
        euint256 eAmount = TFHE.asEuint256(
            eRequestedAmount,
            eRequestedAmountProof
        );
        euint256 ePrice = TFHE.asEuint256(ePricePerUnit, ePricePerUnitProof);

        // Allow the smart contract to decypher those data on the resolution time
        TFHE.allowThis(eAmount);
        TFHE.allowThis(ePrice);

        // Get the expected total amount to be paid
        euint256 eAmountToPay = TFHE.mul(eAmount, ePrice);

        // Request to decypher the total amount to be able to verify user payment

        uint256[] memory cts = new uint256[](1);
        cts[0] = Gateway.toUint256(eAmountToPay);
        uint256 requestId = Gateway.requestDecryption(
            cts,
            this._gateway_callback_mul_value.selector,
            0,
            block.timestamp + 100,
            false
        );
        // Map the request ID to the auction Id
        decypherProcess[requestId] = lastAuctionId;

        // Create an auction that needs to be validated
        auctions[lastAuctionId] = Auction({
            user: msg.sender,
            creationTime: block.timestamp,
            eRequestedAmount: eAmount,
            ePricePerUnit: ePrice,
            dRequestedAmount: 0,
            dPricePerUnit: 0,
            validated: false,
            totalValueLock: 0
        });

        // Increment the auction
        lastAuctionId++;

        // TODO :: Emit event ?

        return lastAuctionId - 1;
    }

    function _gateway_callback_mul_value(
        uint256 requestId,
        uint256 result
    ) public onlyGateway {
        auctions[decypherProcess[requestId]].totalValueLock = result;
        // TODO: emit smth
    }

    // FIXME: Use reentrancy guard
    function confirmAuction(
        uint256 auctionId
    ) external payable _activeAuction nonReentrant {
        require(auctionId < lastAuctionId, "INVALID_AUCTION_ID");

        // We expect the user to pay
        require(auctions[auctionId].user == msg.sender, "INVALID_USER");
        require(!auctions[auctionId].validated, "ALREADY_VALIDATED");

        // We should know how much eth the user has to pay
        require(auctions[auctionId].totalValueLock > 0, "INVALID_AUCTION");

        // We should have enough token
        require(
            msg.value >= auctions[auctionId].totalValueLock,
            "NOT_ENOUGH_FUNDS"
        );

        // Validate the auction
        auctions[auctionId].validated = true;

        // TODO: emit event ?

        // Pay back the excess token to the user
        uint256 excess = msg.value - auctions[auctionId].totalValueLock;

        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            require(success, "Refund failed");
        }
    }

    function cancelAuction(
        uint256 auctionId
    ) external _activeAuction nonReentrant {
        require(auctionId < lastAuctionId, "INVALID_AUCTION_ID");
        require(auctions[auctionId].user == msg.sender, "INVALID_USER");
        require(auctions[auctionId].validated, "NOT_VALIDATED_AUCTION");

        uint256 value = auctions[auctionId].totalValueLock;
        auctions[auctionId].validated = false;

        // TODO: Delete is not possible, as we have two mapping one for decypher the total amount
        // Before being able to pay. This will be an issue, if someone is able to mix the auction value.

        // TODO :: emit event
        if (value > 0) {
            (bool success, ) = msg.sender.call{value: value}("");
            require(success, "Refund failed");
        }
    }

    function resolveAuction(uint256 numberToProcceed) external {
        // We need to decypher all the token allocation by the user
        require(block.timestamp > endAuctionTime, "UNFINISHED_AUCTION");
        require(lastAuctionProccessed < lastAuctionId, "PROCEED_ALL_DATA"); // TODO: Use it for last process

        // Request to decypher all the vote
        while (numberToProcceed > 0 && lastAuctionProccessed < lastAuctionId) {
            // Process only valid auction
            if (auctions[lastAuctionProccessed].validated) {
                // euint256 eRequestedAmount;
                // euint256 ePricePerUnit;

                uint256[] memory cts = new uint256[](2);
                cts[0] = Gateway.toUint256(
                    auctions[lastAuctionProccessed].eRequestedAmount
                );
                cts[1] = Gateway.toUint256(
                    auctions[lastAuctionProccessed].ePricePerUnit
                );
                uint256 requestId = Gateway.requestDecryption(
                    cts,
                    this._gateway_callback_decypher_auction.selector,
                    0,
                    block.timestamp + 100,
                    false
                );

                // FIXME: second time we are using it - Issue of overriting ??
                // Map the request ID to the auction Id
                decypherProcess[requestId] = lastAuctionId;
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

    function _gateway_callback_decypher_auction(
        // FIXME: name nomenclature
        uint256 requestId,
        uint256 requestedAmount,
        uint256 pricePerUnit
    ) public onlyGateway {
        // Get the auction id
        uint256 auctionId = decypherProcess[requestId];

        // FIXME :: Store decypher value

        // Does the price already exists
        if (orderedAuctionPerUser[pricePerUnit].length == 0) {
            // Keep track of the price to iterate later on to asc order
            priceOrderTree.insert(pricePerUnit);
        }

        // Store decypher data
        auctions[auctionId].dRequestedAmount = requestedAmount;
        auctions[auctionId].dPricePerUnit = pricePerUnit;

        // Add the id to the matching value
        orderedAuctionPerUser[pricePerUnit].push(auctionId);

        // TODO: emit smth
    }

    function distributeToken(uint numberToProceed) external nonReentrant {
        while (
            balanceOf(address(this)) > 0 && // We still have token to distribute
            numberToProceed > 0 &&
            priceOrderTree.root != 0 // We still have available auctions
        ) {
            // Get the better price
            uint256 keyPrice = priceOrderTree.last();

            // Get the mapped auctions
            while (orderedAuctionPerUser[keyPrice].length > 0) {
                if (numberToProceed == 0) {
                    // Stop the process
                    return;
                }

                // Get the last item and remove it
                uint256 auctionId = orderedAuctionPerUser[keyPrice][
                    orderedAuctionPerUser[keyPrice].length - 1
                ];
                orderedAuctionPerUser[keyPrice].pop();

                // compute the token to send
                uint256 tokenToSend = Math.min(
                    balanceOf(address(this)),
                    auctions[auctionId].dRequestedAmount *
                        auctions[auctionId].dPricePerUnit
                );

                // Update the token paid value
                auctions[auctionId].totalValueLock -= tokenToSend;

                // Transfer to the user
                _transfer(address(this), auctions[auctionId].user, tokenToSend);

                // We can stop if we have no more token to distribute
                if (balanceOf(address(this)) == 0) {
                    return;
                }

                numberToProceed--;
            }

            // No more auctions for this key price
            // We can remove the price from our tree
            priceOrderTree.remove(keyPrice);
        }

        // In the particular case where we have explored all the auctions
        // And we still have tokens, we send them to the owner

        if (balanceOf(address(this)) > 0 && priceOrderTree.root == 0) {
            _transfer(address(this), this.owner(), balanceOf(address(this)));
        }
    }

    function unlock(uint256 auctionId) external nonReentrant {
        require(balanceOf(address(this)) == 0, "STILL_TOKEN_UNDISTRIBUTED");
        require(auctions[auctionId].user == msg.sender, "INVALID_USER");
        require(auctions[auctionId].validated, "NOT_VALIDATED_AUCTION");
        require(auctions[auctionId].totalValueLock > 0, "NO_MORE_TOKEN");

        uint256 unlockAmount = auctions[auctionId].totalValueLock;

        // TODO : Emit action

        (bool success, ) = msg.sender.call{value: unlockAmount}("");
        require(success, "Refund failed");
    }
}
