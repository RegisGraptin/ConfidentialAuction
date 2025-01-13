// SPDX-License-Identifier: TBD
pragma solidity ^0.8.24;

// import {einput} from "fhevm/lib/TFHE.sol";
import "fhevm/lib/TFHE.sol";


struct Auction {
    address user;
    uint256 creationTime;
    euint256 eRequestedAmount;
    euint256 ePricePerUnit;
    bool validated;
    uint256 totalValueLock;
}

interface IPrivateAuction {
    
    /// Views

    // End time of the auction
    function endAuctionTime() external view returns(uint256);

    // See the existing auctions
    function auctions(address user) external view returns(Auction memory);


    /// Actions

    // Any user can create a new auctions
    function createAuction(einput eRequestedAmount, einput ePricePerUnit) external returns (uint);
    
    function confirmAuction(uint256 auctionId) payable external;

    // Cancel an auction
    function cancelAuction(uint256 auctionId) external;

    // Resolve the auction
    function resolveAuction() external;

}
