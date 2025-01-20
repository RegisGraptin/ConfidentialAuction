import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "hardhat";

import { createInstance } from "../instance";
import { getSigners, initSigners } from "../signers";
import { debug } from "../utils";
import { deployConfidentialAuctionFixture } from "./ConfidentialAuction.fixture";
import { awaitAllDecryptionResults, initGateway } from "../asyncDecrypt";
import { assert } from "console";
import { Signer } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ConfidentialAuction", function () {
  before(async function () {
    await initGateway();
    await initSigners();
    this.signers = await getSigners();
  });

  beforeEach(async function () {
    const contract = await deployConfidentialAuctionFixture();
    this.contractAddress = await contract.getAddress();
    this.contract = contract;
    this.fhevm = await createInstance();
    this.owner = this.signers.alice.address;

    // Create helper function
    this.submitEncryptedBid = async (signer: HardhatEthersSigner, requestAmount: number, pricePerToken: number) => {
      const input = this.fhevm.createEncryptedInput(this.contractAddress, signer.address);
      // (requestAmount, pricePerUnit)
      const inputs = await input.add256(requestAmount).add256(pricePerToken).encrypt();
  
      // Create a new auction
      // ["submitEncryptedBid(bytes32,bytes32,bytes)"]
      const transaction = await this.contract.connect(signer).submitEncryptedBid(
        inputs.handles[0],
        inputs.handles[1],
        inputs.inputProof,
      )
      await transaction.wait();
    };

    this.confirmBid = async (signer: Signer, bidId: number, requestAmount: number, pricePerToken: number) => {
      // Be sure that the create auction decypher was done
      await awaitAllDecryptionResults();
      const total_value = requestAmount * pricePerToken;
      const transaction = await this.contract.connect(signer).confirmBid(bidId, {value: BigInt(total_value)});
      await transaction.wait()
    };


    this.resolveAuction = async (numberOfBids: number | undefined) => {
      // In case the number of auctions is not defined, we set a large number to process all of them
      if (numberOfBids === undefined) {
        numberOfBids = 1_000_000;
      }

      // Move to a week from now, to be able to resolve the auction
      const targetTimestamp = await this.contract.endAuctionTime() + 1n; 
      await network.provider.send("evm_setNextBlockTimestamp", [Number(targetTimestamp)]);
      await network.provider.send("evm_mine");
      
      const transaction = await this.contract.resolveAuction(numberOfBids);
      await transaction.wait();

      await awaitAllDecryptionResults();
    };

    
  });

  it("should be correctly deployed", async function () {
    expect(await this.contract.totalSupply()).to.equal(1_000_000n, "Invalid supply");
    expect(await this.contract.balanceOf(this.contractAddress)).to.equal(1_000_000n, "Invalid balance");
  });


  it("should create bid", async function () {
    
    await this.submitEncryptedBid(this.signers.alice, 100_000n, 10_000n);
    // Wait for decryption
    await awaitAllDecryptionResults();

    // We expect the auction id to be 0
    const auction = await this.contract.bids(0);
    // console.log(auction);

    expect(auction[0]).to.be.eq(this.signers.alice.address);
    expect(auction[6]).to.be.eq(false);
    expect(auction[7]).to.be.eq(100_000n * 10_000n);
  });

  it("should revert when cancel an invalid bid", async function () {
    await this.submitEncryptedBid(this.signers.alice, 100_000n, 10_000n);
    await awaitAllDecryptionResults();
    await expect(this.contract.cancelBid(0)).to.be.reverted;
  });

  it("should fund the bid and confirm it", async function () {
    await this.submitEncryptedBid(this.signers.alice, 100_000n, 10_000n);
    await awaitAllDecryptionResults();
    
    // Get the contract eth balance before
    const userEthBalanceBefore = await ethers.provider.getBalance(this.signers.alice.address);
    const contractEthBalanceBefore = await ethers.provider.getBalance(this.contractAddress);

    const total_value = 100_000n * 10_000n;
    const transaction = await this.contract.confirmBid(0, {value: total_value});
    const receipt = await transaction.wait()

    // We also need to take into consideration the gas used to check the user spending
    const gasUsed = BigInt(receipt.gasUsed * receipt.gasPrice);

    // Get the contract eth balance after
    const userEthBalanceAfter = await ethers.provider.getBalance(this.signers.alice.address);
    const contractEthBalaceAfter = await ethers.provider.getBalance(this.contractAddress);

    expect(contractEthBalaceAfter).to.be.eq(contractEthBalanceBefore + total_value);
    expect(userEthBalanceAfter).to.be.eq(userEthBalanceBefore - total_value - gasUsed);
  });

  it("should revert when find the bid with not enough funds", async function () {
    await this.submitEncryptedBid(this.signers.alice, 100_000n, 10_000n);
    await awaitAllDecryptionResults();
    await expect(this.contract.confirmBid(0)).to.be.reverted;
    await expect(this.contract.confirmBid(0, {value: 1})).to.be.reverted;
  });

  it("should send back eth when confirming a bid with more token than needed", async function () {
    await this.submitEncryptedBid(this.signers.alice, 100_000n, 10_000n);
    await awaitAllDecryptionResults();

    // Get ETH balance
    const userEthBalanceBefore = await ethers.provider.getBalance(this.signers.alice.address);
    const contractEthBalanceBefore = await ethers.provider.getBalance(this.contractAddress);

    const total_value = 100_000n * 10_000n;
    const transaction = await this.contract.confirmBid(0, {value: total_value + 100_000n});
    const receipt = await transaction.wait()

    const gasUsed = BigInt(receipt.gasUsed * receipt.gasPrice);

    const userEthBalanceAfter = await ethers.provider.getBalance(this.signers.alice.address);
    const contractEthBalaceAfter = await ethers.provider.getBalance(this.contractAddress);

    // We should only have the total value in addition for the contract
    expect(contractEthBalaceAfter).to.be.eq(contractEthBalanceBefore + total_value);
    expect(userEthBalanceAfter).to.be.eq(userEthBalanceBefore - total_value - gasUsed);
  });


  it("should cancel a confirmed bid", async function () {
    await this.submitEncryptedBid(this.signers.alice, 100_000n, 10_000n);
    await this.confirmBid(this.signers.alice, 0, 100_000n, 10_000n);
    
    const totalAmount = 100_000n * 10_000n;

    const userEthBalanceBefore = await ethers.provider.getBalance(this.signers.alice.address);
    const contractEthBalanceBefore = await ethers.provider.getBalance(this.contractAddress);
    const transaction = await this.contract.cancelBid(0);
    const receipt = await transaction.wait();
    const gasUsed = BigInt(receipt.gasUsed * receipt.gasPrice);
    const userEthBalanceAfter = await ethers.provider.getBalance(this.signers.alice.address);
    const contractEthBalaceAfter = await ethers.provider.getBalance(this.contractAddress);

    // Check the auction state
    const auction = await this.contract.bids(0);
    expect(auction[0]).to.be.eq(this.signers.alice.address);
    expect(auction[6]).to.be.eq(false);
    expect(auction[7]).to.be.eq(totalAmount);
  
    // Check the balance
    expect(contractEthBalaceAfter).to.be.eq(contractEthBalanceBefore - totalAmount);
    expect(userEthBalanceAfter).to.be.eq(userEthBalanceBefore + totalAmount - gasUsed);
  });




  it("should decrypt the bid after resolution phase", async function () {
    await this.submitEncryptedBid(this.signers.alice, 100_000n, 10_000n);
    await this.confirmBid(this.signers.alice, 0, 100_000n, 10_000n);

    const totalAmount = 100_000n * 10_000n;

    // Move to a week from now, to be able to resolve the auction
    await this.resolveAuction(1);

    // All the bids should now be decrypted
    const auction = await this.contract.bids(0);
    expect(auction[0]).to.be.eq(this.signers.alice.address);
    expect(auction[4]).to.be.eq(100_000n);
    expect(auction[5]).to.be.eq(10_000n);
    expect(auction[6]).to.be.eq(true);
    expect(auction[7]).to.be.eq(totalAmount);

  });


  class AllocationParticipant {
    name: string;
    requestAmount: bigint;
    pricePerToken: bigint;
    expectedAllocation: bigint

    constructor ({name, requestAmount, pricePerToken, expectedAllocation}: {
      name: string, 
      requestAmount: bigint, 
      pricePerToken: bigint, 
      expectedAllocation: bigint
    }) {
      this.name = name;
      this.requestAmount = requestAmount;
      this.pricePerToken = pricePerToken;
      this.expectedAllocation = expectedAllocation;
    } 

    getExpectedEthBack(settlementPrice: bigint): bigint {
      return (this.requestAmount * this.pricePerToken) - (this.expectedAllocation * settlementPrice);
    }


  }

  
  const auctionScenario = [
    // https://github.com/zama-ai/bounty-program/issues/136
    // Bob   bids 0.000002 ether      | 2_000_000_000_000 wei | 500_000 tokens
    // Carol bids 0.000008 ether      | 8_000_000_000_000 wei | 600_000 tokens
    // David bids 0.00000000001 ether |        10_000_000 wei | 1_000_000 tokens
    { 
      settlePrice: 2_000_000_000_000n, 
      participants: [
        new AllocationParticipant({name: "bob", requestAmount: 500_000n, pricePerToken: 2_000_000_000_000n, expectedAllocation: 400_000n}),
        new AllocationParticipant({name: "carol", requestAmount: 600_000n, pricePerToken: 8_000_000_000_000n, expectedAllocation: 600_000n}),
        new AllocationParticipant({name: "dave", requestAmount: 1_000_000n, pricePerToken: 10_000_000n, expectedAllocation: 0n}),
      ] 
    },
    // Bob   bids 0.000002 ether      | 2_000_000_000_000 wei | 500_000 tokens
    // Carol bids 0.000008 ether      | 8_000_000_000_000 wei | 1_000_000 tokens
    // David bids 0.00000000001 ether |        10_000_000 wei | 1_000_000 tokens
    { 
      settlePrice: 8_000_000_000_000n, 
      participants: [
        new AllocationParticipant({name: "bob", requestAmount: 500_000n, pricePerToken: 2_000_000_000_000n, expectedAllocation: 0n}),
        new AllocationParticipant({name: "carol", requestAmount: 1_000_000n, pricePerToken: 8_000_000_000_000n, expectedAllocation: 1_000_000n}),
        new AllocationParticipant({name: "dave", requestAmount: 1_000_000n, pricePerToken: 10_000_000n, expectedAllocation: 0n}),
      ] 
    },
  ];

  // Dynamically generate tests
  auctionScenario.forEach(({ settlePrice, participants }: {settlePrice: bigint, participants: AllocationParticipant[]}, index) => {
    it(`should settle auction scenario ${index+1}`, async function () {
      await expect(await ethers.provider.getBalance(this.contractAddress)).to.be.eq(0);  
      let totalETHExpectedFromSell = settlePrice * 1_000_000n;

      // Set the bid for all the participants
      let bidId = 0
      let totalETHLock = 0n;
      for (let participant of participants) {
        await this.submitEncryptedBid(this.signers[participant.name], participant.requestAmount, participant.pricePerToken);
        await this.confirmBid(this.signers[participant.name], bidId, participant.requestAmount, participant.pricePerToken);
        bidId++;
        totalETHLock += participant.requestAmount * participant.pricePerToken;
      }

      // Check contract ETH Balance
      await expect(await ethers.provider.getBalance(this.contractAddress)).to.be.eq(totalETHLock);

      // Step in the future and resolve all the auctions
      await this.resolveAuction();

      // Proceed with the token distribution
      await this.contract.definedAllocation(5);
    
      // Check the settlement price
      await expect(await this.contract.auctionSettlePrice()).to.be.eq(settlePrice, "Invalid settlement price");

      // Check user allocation and refund
      bidId = 0
      for (let participant of participants) {
        let payBackAmount = participant.getExpectedEthBack(settlePrice);
        let userAddress = this.signers[participant.name].address;
        let userWallet = this.contract.connect(this.signers[participant.name]);

        // The user should have an allocation
        if (participant.expectedAllocation > 0) {
          await expect(await this.contract.balanceOf(this.signers[participant.name].address)).to.equal(0, "Invalid user balance");
          await userWallet.claimAllocation(bidId);
          await expect(await this.contract.balanceOf(this.signers[participant.name].address)).to.equal(participant.expectedAllocation, "Invalid user balance");
        }

        // In case the user have some refund
        if (payBackAmount > BigInt(0)) {
          // We should get back the original tokens
          const userEthBalanceBefore = await ethers.provider.getBalance(userAddress);

          const transaction =  await userWallet.refundBids(bidId);
          const receipt = await transaction.wait();

          const gasUsed = BigInt(receipt.gasUsed * receipt.gasPrice);
          const userEthBalanceAfter = await ethers.provider.getBalance(userAddress);

          expect(userEthBalanceAfter).to.be.eq(userEthBalanceBefore - gasUsed + BigInt(payBackAmount));

        } else {
          await expect(userWallet.refundBids(bidId)).to.be.reverted;
        }
        
        bidId++;
      }

      // Contract should have no more ERC20 token
      await expect(await this.contract.balanceOf(this.contractAddress)).to.be.equal(0n, "Invalid balance")

      // And should have refund all the people, only have the ETH value from the sell
      await expect(await ethers.provider.getBalance(this.contractAddress)).to.be.equal(totalETHExpectedFromSell, "Invalid balance")
      await expect(await this.contract.balanceOf(this.owner)).to.be.equal(0, "Invalid balance")

      // Check the owner claimed
      const beforeOwnerETHBalance = await ethers.provider.getBalance(this.owner);
      
      const transaction = await this.contract.claimETHToken();
      const receipt = await transaction.wait()
      
      const afterOwnerETHBalance = await ethers.provider.getBalance(this.owner);
      expect(afterOwnerETHBalance).to.be.above(beforeOwnerETHBalance);

      const gasUsed = BigInt(receipt.gasUsed * receipt.gasPrice);
      expect(afterOwnerETHBalance).to.be.eq(beforeOwnerETHBalance - gasUsed + totalETHExpectedFromSell);
    });
  });

  it("should match the expected allocation", async function () {
    


  });


  // Test scenario 
  //  - Not enough participants
  //  - Owner pay first, then others
  //  - Check condition of claimed in the smart contract
  // 

  // TODO: UPDATE error code & double check condition + test

});

