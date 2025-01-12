// SPDX-License-Identifier: TBD
pragma solidity ^0.8.24;

// import {einput} from "fhevm/lib/TFHE.sol";
import "fhevm/lib/TFHE.sol";


struct Auction {
    address user;
    uint256 creationTime;
    einput eRequestedAmount;
    einput ePricePerUnit;
}

interface IPrivateAuction {
    
    /// Views

    // Number of token created
    function tokenAmount() public view returns(uint256);

    // End time of the auction
    function endAuction() public view returns(uint256);

    // See the existing auctions
    function auctions(address user) public view returns(Auction);


    /// Actions

    // Any user can create a new auctions
    function createAuction(einput eRequestedAmount, einput ePricePerUnit) payable external returns (uint);

    // Cancel an auction
    function cancelAuction(uint256 auctionId) external;

    // Resolve the auction
    function resolveAuction() external;

}
