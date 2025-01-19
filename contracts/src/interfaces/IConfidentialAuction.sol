// SPDX-License-Identifier: TBD
pragma solidity ^0.8.24;

// import {einput} from "fhevm/lib/TFHE.sol";
import "fhevm/lib/TFHE.sol";


struct Bid {
    address user;
    uint256 creationTime;
    euint256 eRequestedAmount;
    euint256 ePricePerUnit;
    uint256 dRequestedAmount;
    uint256 dPricePerUnit;
    bool confirmed;
    uint256 totalValueLock;
    uint256 totalAllocation;
}

interface IConfidentialAuction {
    
    /// @notice Returns the ID that will be assigned to the next bid.
    /// @return The ID that will be assigned to the next bid (lastBidId + 1).
    function nextBidId() external view returns(uint256);

    /// @notice Returns the end time of the auction.
    /// @return The timestamp representing the end time of the auction.
    function endAuctionTime() external view returns(uint256);

    /// @notice Returns the auction's settlement price.
    /// @dev The settlement price is determined during the auction resolution phase.
    ///      If there are insufficient valid bids to meet the allocation, the settlement 
    ///      price is set to 0.
    /// @return The settlement price defined when the auction is resolved. If there are 
    ///         not enough valid bids, the price will be 0.
    function auctionSettlePrice() external view returns(uint256);

    /// @notice Returns the total token allocation defined for this auction.
    /// @dev This represents the total number of tokens distributed to bidders during the auction.
    ///      An auction is considered fully allocated if this value matches the initial supply of tokens.
    /// @return The total token allocation for the auction.
    function auctionAllocation() external view returns(uint256);

    /// @notice Retrieves the details of a specific bid by its ID.
    /// @param bidId The ID of the bid to retrieve.
    /// @return The details of the bid.
    function bids(uint256 bidId) external view returns(Bid memory);
    
    /// @notice Returns the list of bid IDs placed by a specific user.
    /// @param user The address of the user whose bids are to be fetched.
    /// @return An array of bid IDs representing the bids placed by the specified user.
    function userBids(address user) external view returns (uint256[] memory);


    error AuctionAlreadyFinished();
    error AuctionNotFinished();
    error InvalidEndAuctionTime(uint256 providedEndTime, uint256 currentTime);
    
    error InvalidBidId(uint256 providedBidId, uint256 nextBidId);
    error BidAlreadyConfirmed(uint256 bidId);
    error BidNotConfirmed(uint256 bidId);
    
    error GatewayProcessRequired(uint256 bidId, uint256 totalValueLock);
    error PendingGatewayProcess();
    
    error AllBidsProcessed();
    error PendingBidsToProcess();
    
    error NoTokensLocked();
    error ETHAlreadyClaimed();
    error RemainingTokensToDistribute();
    
    error UnauthorizedUser(address providedUser, address expectedUser);
    error InsufficientFunds(address user, uint256 requiredAmount, uint256 providedAmount);
    

    event BidSubmitted(
        address indexed bidder, // The address of the bidder.
        uint256 indexed bidId   // The unique identifier for the submitted bid.
    );

    event BidConfirmed(
        address indexed bidder, // Address of the bidder confirming the bid.
        uint256 indexed bidId,  // Unique identifier of the confirmed bid.
        uint256 amountLocked    // Amount of ETH locked in the contract.
    );

    event BidCanceled(
        address indexed bidder, // Address of the user canceling the bid.
        uint256 indexed bidId,  // Unique identifier of the canceled bid.
        uint256 refundAmount    // Amount of ETH refunded to the user.
    );

    event AuctionTokenTransferred(
        address indexed recipient, // Address of the user receiving the tokens.
        uint256 amount             // Number of tokens transferred.
    );

    event UnsuccessfulBidRefunded(
        uint256 indexed bidId,  // The unique identifier of the bid being refunded.
        address indexed bidder, // Address of the bidder who is receiving the refund.
        uint256 amount          // Amount of ETH refunded to the bidder.
    );

    event GatewayTotalValueRequested(
        uint256 indexed bidId,  // The unique identifier of the bid.
        uint256 amount          // Total amount needed to be lock by the user to confirm his bid.
    );

    event GatewayDecryptBid(
        uint256 indexed bidId,   // The unique identifier of the bid.
        uint256 requestedAmount, // Decrypted value of the requested amount of token.
        uint256 pricePerUnit     // Decrypted value of the price per token.
    );


    /// @notice Submits an encrypted bid for the running auction.
    /// @dev The bid consists of encrypted inputs for the requested token amount and price per unit,
    ///      along with a cryptographic proof to validate the inputs. All inputs must be properly encrypted
    ///      and adhere to auction rules.
    /// @param eRequestedAmount Encrypted amount of tokens the bidder wishes to purchase.
    /// @param ePricePerUnit Encrypted price per unit the bidder is willing to pay.
    /// @param inputProof Cryptographic proof verifying the validity of the encrypted inputs.
    /// @return bidId A unique identifier for the submitted bid.
    /// @custom:requirements
    /// - The auction must still be active.
    function submitEncryptedBid(
        einput eRequestedAmount,
        einput ePricePerUnit,
        bytes calldata inputProof
    ) external returns (uint256);
    

    /// @notice Confirms a submitted bid by locking the required ETH into the smart contract.
    /// @dev The function validates the bid, ensuring the user transfers the necessary ETH associated 
    ///      to the total value requested to confirm his bid.
    ///      The user must call this function after submitting a bid to finalize their participation.
    ///      This function must be available only when we have successfuly decypher the total amount 
    ///      of the user bid (requestedAmount * pricePerUnit)
    /// @param bidId The unique identifier of the bid to be confirmed associated to the user.
    /// @custom:requirements
    /// - The auction must still be active.
    function confirmBid(uint256 bidId) external payable;


    /// @notice Cancels a submitted bid, allowing the user to withdraw their locked funds.
    /// @dev This function can only be called by the bidder who submitted the bid.
    ///      It ensures the bid is removed from the auction and any locked funds are refunded.
    /// @param bidId The unique identifier of the bid to be canceled.
    /// @custom:requirements 
    /// - The caller must be the original bidder.
    /// - The bid must not have already been finalized or canceled.
    function cancelBid(uint256 bidId) external;


    /// @notice Resolves the auction by processing and decrypting bids in steps.
    /// @dev This function is called after the auction has ended. It processes a specified
    ///      number of bids per call to prevent running out of gas in case of a large number
    ///      of bids to proceed.
    /// @param numberToProcceed The maximum number of bids to process in this call.
    /// @custom:requirements
    /// - The auction must have ended (based on the auction's timestamp).
    function resolveAuction(uint256 numberToProcceed) external;


    /// @notice Allocates the number of tokens to successful bidders after the confidential bids are resolved.
    /// @dev This function is called after all bids have been processed and organized based on the best price.
    ///      It determines for all the bids the token allocation based on the auction settlement price.
    ///      The allocation process may be executed iteratively to handle large data sets without exceeding gas limits.
    /// @param numberToProceed The number of bids to process in this call.
    /// @custom:requirements
    /// - All bids must have been processed and decrypted before calling this function.
    /// - The auction must be resolved and the settlement price determined.
    /// - The function should be called iteratively to handle a large number of bidders without running out of gas.
    function definedAllocation(uint256 numberToProceed) external;


    /// @notice Allows a user to claim the allocated tokens for a successful bid.
    /// @dev This function is called to transfer the allocated ERC20 tokens to the bidder based on the resolved auction.
    ///      It can only be called for bids with an allocation already defined.
    /// @param bidId The ID of the bid for which the allocation is being claimed.
    /// @custom:requirements
    /// - The bid must have an allocation defined.
    /// - The caller must be the owner of the bid.
    /// - The auction must be resolved and the settlement price determined.
    function claimAllocation(uint256 bidId) external;


    /// @notice Refunds the ETH locked for a given bid.
    /// @dev This function is called to release and refund the ETH from a bid. It ensures that the funds
    ///      are refunded only after the auction has concluded. In case where the user get a token allocation,
    ///      he will have to first claimed it before being able to get refund for the remaining ETH. 
    /// @param bidId The unique identifier of the bid to be refunded.
    /// @custom:requirements
    /// - The auction must be concluded.
    function refundBids(uint256 bidId) external;


    /// @notice Distribute the ETH from the sell auction. The amount is computed based on the settlement price
    ///         defined when resolving the auction.
    /// @dev This function is called by the owner to claimed the ETH won.
    /// @custom:requirements
    /// - The auction must be concluded and all the token should have been distributed.
    function claimETHToken() external;
}
