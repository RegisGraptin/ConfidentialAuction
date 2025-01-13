
# Build a Confidential Single-Price Auction for Tokens with Sealed Bids using Zama's fhEVM
> https://github.com/zama-ai/bounty-program/issues/136


## Description 

A user want to launch a new tokens with a supply of 1 000 000 tokens. Now, we open an auction allowing people during a dedicated timeframe to proposed to buy tokens.


User --> Encrypted bid (Number of token he wants to purchage and the price of it) (ex 100 000 token for 0.00001 each)



- At the moment, the focus is done in gas token here ETH
- If not enough participant, the auction is still execute and the remaining tokens go to the owner of the ERC20 (assuming the team is behind it)

Corner cases:


    whether an address can participate more than once
    > Would say yes as we do not really care about the user. However, as we need to sort at some points, the array, I am affraid of locking smart contract
    > Need to think about it


    whether a user can modify an existing bid before the auction end
    > Yes, let's say a bid get a unique ID, then we can simply verify user address and update it
    > Cancel then recreate a new one (Why cancel --> need the user to get back the fund then recreate a new one --> reentrancy needs to be checked)

    how long the auction should last
    > Auction should be parametreable, meaning that the start and end time is defined by the user

    how to determine the proper resolution if the two lowest bids are equal
    > Either first come / first serve  || Equal splitting
    > EASY || equal splitting means 

    how to prevent participation in an auction without the funds (i.e. the locking mechanism)
    > The person delegate the eth to the smart contract when biding it. 
    > Meaning if a user has a total allocation of 10 ETH, it will lock the 10 ETH to the smart contract





------------------------
An auction owner can create/launch a Single-Price Auction for a quantity of assets (e.g. ERC20) to be sold using either ether or an ERC20 token.

Each participant, who wants to buy assets, can place an encrypted bid (the number of tokens to purchase and the price that each participant is willing to pay). The settlement price is the price at which the last token is bought. This price is paid by everyone regardless on the initial bids.

If the auction does not sell fully (e.g. no participant, not enough participant), it is up to the developer to decide what should be the best resolution mechanism (e.g. refund mechanism, execution at the lowest price).

Other corner/edge cases may include:

    whether an address can participate more than once
    whether a user can modify an existing bid before the auction end
    how long the auction should last
    how to determine the proper resolution if the two lowest bids are equal
    how to prevent participation in an auction without the funds (i.e. the locking mechanism)
-----------------


# Business startegy

Should we create a DAO and the DAO take a fee on the transaction.




# Workflow


1. User create a new auction with a hiden price and amount
    1.a A callback to the Gateway is done in order for us to know how much eth the user needs to lock in the smart contract
    1.b The gateway reveals by the call back the amount the user needs to lock
2. Then the user needs to validate by paying the smart contract wiht the expected amount

3. When the auction is done
    3.a We reveal all the hidden params of the auction (amount and price per token)
    3.b Then, once all the auctions reveal, we order them by low price token
    3.c Once order we proceed to the token distribution

=> Needs to think about scale



3.a -> Iterative given an while id < target --> callback
3.b -> Previously ordered them by mapping (low price) => list of users
    -> Only needs an order set to iterate it after. Can be managed each callback
3.c -> Loop over the sets and users until not more token - Loop 


-- Token last --> Prems
When append / pop (remove prems)





##### sepolia
✅  [Success]Hash: 0x09be1db0cf7715dd2d983e115270baec2b6d6624142cf51766a90393a8b278b6
Contract Address: 0xf9608f47363DFB1eaBB4142213B8d4789c48a90A
Block: 7482217
Paid: 0.08666734821799857 ETH (2755929 gas * 31.44759833 gwei)

✅ Sequence #1 on sepolia | Total Paid: 0.08666734821799857 ETH (2755929 gas * avg 31.44759833 gwei)
          