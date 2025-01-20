<a id="readme-top"></a>

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/RegisGraptin/ConfidentialAuction">
    <img src="./logo.png" alt="Logo" width="250" height="250">
  </a>

<h3 align="center">Confidential Single-Price Auction</h3>
<p align="center" style="font-style: italic; font-size: 1.2em;">Built during <a href="https://github.com/zama-ai/bounty-program/issues/136">ZAMA Bounty Program - Season 7</a></p>
  <p align="center">
    A decentralized confidential single-price auction for tokens with sealed bids.
    <br />
    <br />
    <a href="https://github.com/RegisGraptin/ConfidentialAuction">View Demo</a>
  </p>
</div>


## About The Project

This repository provides a smart contract implementation for a Confidential Single-Price Auction using sealed bids, powered by Zama's fhEVM (Fully Homomorphic Encryption on Ethereum Virtual Machine).

In this auction model, the auction owner can launch a single-price auction for a specified quantity of assets (e.g., ERC20 tokens) to be sold in exchange for ether. The auction ensures confidentiality during the bidding process, as each participant submits an encrypted bid specifying both the number of tokens they wish to purchase and the price they are willing to pay.


## Features

- Token Customization: The auction owner can parameterize the token details (e.g., name, symbol) and set the auction duration. The auction utilizes gas (ETH) as the payment method for the sale.

- Encrypted Bids: Participants submit bids by encrypting both the number of tokens they wish to purchase and the price they are willing to pay. This ensures bid confidentiality throughout the auction process. After the auction ends, the encrypted bids are decrypted for resolution.

- Settlement Price: Once the encrypted bids are decrypted, the settlement price is determined based on the highest accepted bid. This price becomes the official price at which tokens are sold.

- Refund Mechanism: If the auction is not fully filled (i.e., there are insufficient bids), all participants are refunded, and the auction owner retains the unsold tokens.

- Multiple Bids: Participants can place multiple bids throughout the auction. Each time a bid is confirmed, the required amount of ETH is locked.

- Bid Cancellation: Participants have the option to cancel their bids during the auction process.

- First-Come, First-Served Resolution: In cases where multiple bids are placed at the same price, bids are resolved on a first-come, first-served basis, ensuring fairness in the distribution of tokens.

## How does it works 

The confidential auction process is divided into three distinct phases:

1. Bid phase
2. Resolution phase
2. Allocation phase
3. Distribution phase

### Bid phase

In the Bid Phase, the auction owner creates a new Confidential Auction smart contract based on an ERC20-derived token. This contract allows the owner to customize the token by defining the name, symbol and the supply. It also allow him to defined the auction's end time.

Once the token is created, it becomes available for bidding. Participants can place bids, but the details of their bids (i.e., the number of tokens and the price they are willing to pay) are encrypted to ensure confidentiality. However, during the bidding creation, we request to decrypt the total value of the bid, which represent the total amount the user needs to lock in ETH to confirm his bid. This decryption processed is handle by the Zama Gateway. 

Once the total value decrypted, the user can confirm his bid, by providing the expected ETH value matching his bid value. The ETH amount is then lock into the smart contract until the distribution phases. 

Note that while the bid phase going on, participants have the possibility to cancel there bids. Also, a participant can place as many bids as they wish during the Bid Phase, with each bid being independently confirmed and locked.

#### Example workflow

To illustrate this phase workflow, let's say we have Charlie who wants to invest in our new token.

1. Charlie places his bid: Charlie’s bid details (50,000 tokens and 0.00002 ETH) are encrypted. At this stage, no one knows the bid details.
2. The Gateway is invoked: The smart contract requests Zama’s Gateway to decrypt the total value (50,000 * 0.00002 ETH = 1 ETH).
3. Charlie confirms his bid: After the total value decrypted, Charlie can now confirm his bid by locking 1 ETH into the contract.
4. Charlie has the option to cancel: As long as the auction is still ongoing, Charlie can cancel his bid and get the 1 ETH refunded. If he decides not to cancel, the ETH remains locked until the auction moves to the Resolution Phase.


### Resolution phase

Once the auction's end time has passed, the auction can be resolved. During this phase, the smart contract iterates over all confirmed bids and requests the Gateway to decrypt the bid parameters, including the number of tokens and the price per token for each bid.

Once the bid parameters are revealed, the smart contract sorts the bids based on the requested price, ensuring that they are processed in the correct order during the allocation phase. To handle this efficiently, two data structures are used:

- Red-Black Tree: We use [BokkyPooBah's Red-Black Binary Search Tree Library](https://github.com/bokkypoobah/BokkyPooBahsRedBlackTreeLibrary) to store and sort the bids by price, allowing us to fetch and process bids efficiently.

- Mapping: A mapping associates each price with a list of bids placed at that price. This mapping ensures that, in the case of identical bid prices, the bids are handled according to the First Come, First Served model, respecting the order in which they were placed.


### Allocation phase

Once all bids are processed, the smart contract determines the settlement price of the auction and the token allocation for each bid.

During this phase, the smart contract iterates through the valid bids in descending order of price, allocating tokens to bids until the available supply is exhausted. Once the token supply is exhausted, the settlement price is determined, and the process moves to the distribution phase.

However, if there are insufficient bids to cover the entire token supply, the auction tokens are transferred to the owner and participants can refund their ETH bidding amounts.

### Distribution phase

Once the token allocation is complete, participants with an allocation must first claim it to receive the auction tokens.

After claiming their tokens, participants may refund any excess ETH paid if the settlement price is lower than their bid. In case a participant does not have an allocation, they can directly refund their ETH.

Finally, the auction owner can claim the ETH corresponding to the auction's sale.


# Business startegy

Should we create a DAO and the DAO take a fee on the transaction.



## Note 

We assume that we will note have two time the same requestId



##### sepolia
✅  [Success]Hash: 0x09be1db0cf7715dd2d983e115270baec2b6d6624142cf51766a90393a8b278b6
Contract Address: 0xf9608f47363DFB1eaBB4142213B8d4789c48a90A
Block: 7482217
Paid: 0.08666734821799857 ETH (2755929 gas * 31.44759833 gwei)

✅ Sequence #1 on sepolia | Total Paid: 0.08666734821799857 ETH (2755929 gas * avg 31.44759833 gwei)
          


// TODO: https://en.wikipedia.org/wiki/Single-price_auction

bid1 = 100
bid2 = 200

sum(token) if settle price ==> OK 
                        else no