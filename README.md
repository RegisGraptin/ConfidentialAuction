
# Build a Confidential Single-Price Auction for Tokens with Sealed Bids using Zama's fhEVM
> https://github.com/zama-ai/bounty-program/issues/136


## Description 

This repository present a smart contract approach for a confidential single price auction using sealed bids using Zama.



Single price auction


In case of no settlement, all the token are sent to the owner and the users can get refund.



An auction owner can create/launch a Single-Price Auction for a quantity of assets (e.g. ERC20) to be sold using either ether or an ERC20 token.

Each participant, who wants to buy assets, can place an encrypted bid (the number of tokens to purchase and the price that each participant is willing to pay). The settlement price is the price at which the last token is bought. This price is paid by everyone regardless on the initial bids.

If the auction does not sell fully (e.g. no participant, not enough participant), it is up to the developer to decide what should be the best resolution mechanism (e.g. refund mechanism, execution at the lowest price).


## Features ??


- At the moment, the focus is done in gas token here ETH
- If not enough participant, the auction is still execute and the remaining tokens go to the owner of the ERC20 (assuming the team is behind it)

- A user can place multiple bid - Create mutliple bid
- Cancel an existing bid

- Parameterize auction time 

- Bid resolution on first come first serve
- When confirming the bid, the funds are lock




## How does it works

1. Bid
2. Resolution
3. Distribution


### Bid process

First, a user will create a new smart contract, which is a ERC20 derived. So, he can customize the token name, symbol and defined the supply for his new tokens. In addition, he will provide an additional parameter to defined the end time of the auction. 

Once the token created, it is direclty available to bid. Users will have the possibility to submit a bid by hidding the amount of token request and the price. In the current workflow, the total value will be decrypted as we need this information for the user to lock the given amount of token. During the bid process, only the total amount requested will be reveal. This is where the Gateway from Zama is going to be requested to decypher it.

Then the user will have to confirm the bid by providing the expected eth value matching the total value requests. This amount will be lock into the smart contract during the resolve phase. Before it, if at some point the user after having confirmed his bid, want to cancel it, he have the possibility to do it and get back the eth locked. Notice that this could happened only while the we are in the bid process phase. Else the amount will be lock until the resolution phase is done.

Notice also, that the user can have the possibility to create as many bid as he want.


To illustrate this phase workflow, let's say we have Charlie that wants to invest in our new token. Charlie will make a bid for 50 000 tokens with a price of 0.00002 eth per token. Those two information will be encrypted, and no one during the bid process phase can know this information. The only information we have is when Charlie will create his bid, we will request the Gateway to decypher the product of the number of tokens request time the price per unit (here 1 eth). Once the Gateway provide this value, Charlie will have the possibility to confirm his bid by locking 1 eth to the smart contract. Until the next phase start, when we still are before the end time of the auction, Charlie can cancel his bid and get back his 1 ETH.


### Resolution phase

Once the date of the end time auction passed, this unlock the possibility to anyone to resolve the auction. In this process, we are going to iterate over all the confirmed bids, and using the Gateway, request to decypher the bid parameter. 
When doing so, we are going to have access to all the request amount and price per token of the bid. 
During the resolution process, we are going to arrange and sort the bid based on the price, allowing us to iterate over them in the right order during the distribution. 

For that we are using two data structure. The first one is [BokkyPooBah's Red-Black Binary Search Tree Library](https://github.com/bokkypoobah/BokkyPooBahsRedBlackTreeLibrary) allowing us to store in an order way and search efficiently the price per token. The second is a mapping, allowing us given a price per token to store all the bid associated. 
Thoses two data structure allow us, in an efficiant way, to iterate downwards on the price per token.

Notice that by our design approach, we are following a first come first serve approach in the bid. Meaning that for a same price for two bids, we will fill the first one first then the second one. 

### Distribution phase

Once all the bids resolved, we can now proceed to the distribution phase. For this one, we are iterating over all the bids, in a downwards way according to the price, and going to distribute the token requested until we have distributed all the token. 

In the case where we still have undistributed token, this one will be sent to the owner of the smart contract. 

Finally, once the token distributed, the owner have the possibility to claimed the total eth amount from the sale and the users whose bids haven't been fill in can refund they lock eth.





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