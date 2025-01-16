import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "hardhat";

import { createInstance } from "../instance";
import { reencryptEuint64 } from "../reencrypt";
import { getSigners, initSigners } from "../signers";
import { debug } from "../utils";
import { deployPrivateAuctionFixture } from "./PrivateAuction.fixture";
import { awaitAllDecryptionResults, initGateway } from "../asyncDecrypt";
import { assert } from "console";
import { Signer } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("PrivateAuction", function () {
  before(async function () {
    await initGateway();
    await initSigners();
    this.signers = await getSigners();
  });

  beforeEach(async function () {
    const contract = await deployPrivateAuctionFixture();
    this.contractAddress = await contract.getAddress();
    this.contract = contract;
    this.fhevm = await createInstance();

    // Create helper function
    this.createAuction = async (signer: HardhatEthersSigner, requestAmount: number, pricePerToken: number) => {
      const input = this.fhevm.createEncryptedInput(this.contractAddress, signer.address);
      // (requestAmount, pricePerUnit)
      const inputs = await input.add256(requestAmount).add256(pricePerToken).encrypt();
  
      // Create a new auction
      // ["createAuction(bytes32,bytes32,bytes)"]
      const transaction = await this.contract.connect(signer).createAuction(
        inputs.handles[0],
        inputs.handles[1],
        inputs.inputProof,
      )
      await transaction.wait();
    };

    this.confirmAuction = async (signer: Signer, auctionId: number, requestAmount: number, pricePerToken: number) => {
      // Be sure that the create auction decypher was done
      await awaitAllDecryptionResults();
      const total_value = requestAmount * pricePerToken;
      const transaction = await this.contract.connect(signer).confirmAuction(auctionId, {value: BigInt(total_value)});
      await transaction.wait()
    };


    this.resolveAuction = async (numberOfAuctions: number | undefined) => {
      // In case the number of auctions is not defined, we set a large number to process all of them
      if (numberOfAuctions === undefined) {
        numberOfAuctions = 1_000_000;
      }

      // Move to a week from now, to be able to resolve the auction
      const targetTimestamp = await this.contract.endAuctionTime() + 1n; 
      await network.provider.send("evm_setNextBlockTimestamp", [Number(targetTimestamp)]);
      await network.provider.send("evm_mine");
      
      const transaction = await this.contract.resolveAuction(numberOfAuctions);
      await transaction.wait();

      await awaitAllDecryptionResults();
    };

    
  });

  it("should be correctly deployed", async function () {
    expect(await this.contract.totalSupply()).to.equal(1_000_000n, "Invalid supply");
    expect(await this.contract.balanceOf(this.contractAddress)).to.equal(1_000_000n, "Invalid balance");
  });


  it("should create auction", async function () {
    
    await this.createAuction(this.signers.alice, 100_000n, 10_000n);
    // Wait for decryption
    await awaitAllDecryptionResults();

    // We expect the auction id to be 0
    const auction = await this.contract.auctions(0);
    // console.log(auction);

    expect(auction[0]).to.be.eq(this.signers.alice.address);
    expect(auction[6]).to.be.eq(false);
    expect(auction[7]).to.be.eq(100_000n * 10_000n);
  });

  it("should revert cancel invalid auction", async function () {
    await this.createAuction(this.signers.alice, 100_000n, 10_000n);
    await awaitAllDecryptionResults();
    await expect(this.contract.cancelAuction(0)).to.be.reverted;
  });

  it("should fund the auction and validate it", async function () {
    await this.createAuction(this.signers.alice, 100_000n, 10_000n);
    await awaitAllDecryptionResults();
    
    // Get the contract eth balance before
    const userEthBalanceBefore = await ethers.provider.getBalance(this.signers.alice.address);
    const contractEthBalanceBefore = await ethers.provider.getBalance(this.contractAddress);

    const total_value = 100_000n * 10_000n;
    const transaction = await this.contract.confirmAuction(0, {value: total_value});
    const receipt = await transaction.wait()

    // We also need to take into consideration the gas used to check the user spending
    const gasUsed = BigInt(receipt.gasUsed * receipt.gasPrice);

    // Get the contract eth balance after
    const userEthBalanceAfter = await ethers.provider.getBalance(this.signers.alice.address);
    const contractEthBalaceAfter = await ethers.provider.getBalance(this.contractAddress);

    expect(contractEthBalaceAfter).to.be.eq(contractEthBalanceBefore + total_value);
    expect(userEthBalanceAfter).to.be.eq(userEthBalanceBefore - total_value - gasUsed);
  });

  it("fund with not enough funds", async function () {
    await this.createAuction(this.signers.alice, 100_000n, 10_000n);
    await awaitAllDecryptionResults();
    await expect(this.contract.confirmAuction(0)).to.be.reverted;
    await expect(this.contract.confirmAuction(0, {value: 1})).to.be.reverted;
  });

  it("fund back user if too much eth", async function () {
    await this.createAuction(this.signers.alice, 100_000n, 10_000n);
    await awaitAllDecryptionResults();

    // Get ETH balance
    const userEthBalanceBefore = await ethers.provider.getBalance(this.signers.alice.address);
    const contractEthBalanceBefore = await ethers.provider.getBalance(this.contractAddress);

    const total_value = 100_000n * 10_000n;
    const transaction = await this.contract.confirmAuction(0, {value: total_value + 100_000n});
    const receipt = await transaction.wait()

    const gasUsed = BigInt(receipt.gasUsed * receipt.gasPrice);

    const userEthBalanceAfter = await ethers.provider.getBalance(this.signers.alice.address);
    const contractEthBalaceAfter = await ethers.provider.getBalance(this.contractAddress);

    // We should only have the total value in addition for the contract
    expect(contractEthBalaceAfter).to.be.eq(contractEthBalanceBefore + total_value);
    expect(userEthBalanceAfter).to.be.eq(userEthBalanceBefore - total_value - gasUsed);
  });


  it("check cancel auction", async function () {
    await this.createAuction(this.signers.alice, 100_000n, 10_000n);
    await this.confirmAuction(this.signers.alice, 0, 100_000n, 10_000n);
    
    const totalAmount = 100_000n * 10_000n;

    const userEthBalanceBefore = await ethers.provider.getBalance(this.signers.alice.address);
    const contractEthBalanceBefore = await ethers.provider.getBalance(this.contractAddress);
    const transaction = await this.contract.cancelAuction(0);
    const receipt = await transaction.wait();
    const gasUsed = BigInt(receipt.gasUsed * receipt.gasPrice);
    const userEthBalanceAfter = await ethers.provider.getBalance(this.signers.alice.address);
    const contractEthBalaceAfter = await ethers.provider.getBalance(this.contractAddress);

    // Check the auction state
    const auction = await this.contract.auctions(0);
    expect(auction[0]).to.be.eq(this.signers.alice.address);
    expect(auction[6]).to.be.eq(false);
    expect(auction[7]).to.be.eq(totalAmount);
  
    // Check the balance
    expect(contractEthBalaceAfter).to.be.eq(contractEthBalanceBefore - totalAmount);
    expect(userEthBalanceAfter).to.be.eq(userEthBalanceBefore + totalAmount - gasUsed);
  });




  it("check cancel auction", async function () {
    await this.createAuction(this.signers.alice, 100_000n, 10_000n);
    await this.confirmAuction(this.signers.alice, 0, 100_000n, 10_000n);

    const totalAmount = 100_000n * 10_000n;

    // Move to a week from now, to be able to resolve the auction
    await this.resolveAuction(1);

    // All the auctions should now be decypher
    const auction = await this.contract.auctions(0);
    expect(auction[0]).to.be.eq(this.signers.alice.address);
    expect(auction[4]).to.be.eq(100_000n);
    expect(auction[5]).to.be.eq(10_000n);
    expect(auction[6]).to.be.eq(true);
    expect(auction[7]).to.be.eq(totalAmount);

  });


  class ConfigUser {
    name: string;
    requestAmount: number;
    pricePerToken: number;
    expectedAllocation: number

    constructor ({name, requestAmount, pricePerToken, expectedAllocation}: {
      name: string, 
      requestAmount: number, 
      pricePerToken: number, 
      expectedAllocation: number
    }) {
      this.name = name;
      this.requestAmount = requestAmount;
      this.pricePerToken = pricePerToken;
      this.expectedAllocation = expectedAllocation;
    } 

    getExpectedEthBack(): number {
      return (this.requestAmount - this.expectedAllocation) * this.pricePerToken;
    }
  }

  
  it("check example allocation", async function () {
    // https://github.com/zama-ai/bounty-program/issues/136
    // Bob   bids 0.000002 ether      | 2_000_000_000_000 wei | 500_000 tokens
    // Carol bids 0.000008 ether      | 8_000_000_000_000 wei | 600_000 tokens
    // David bids 0.00000000001 ether |        10_000_000 wei | 1_000_000 tokens

    let config: ConfigUser[] = [
      new ConfigUser({name: "bob", requestAmount: 500_000, pricePerToken: 2_000_000_000_000, expectedAllocation: 400_000}),
      new ConfigUser({name: "carol", requestAmount: 600_000, pricePerToken: 8_000_000_000_000, expectedAllocation: 600_000}),
      new ConfigUser({name: "dave", requestAmount: 1_000_000, pricePerToken: 10_000_000, expectedAllocation: 0}),
    ]

    let auctionId = 0
    for (let user of config) {
      await this.createAuction(this.signers[user.name], user["requestAmount"], user["pricePerToken"]);
      await this.confirmAuction(this.signers[user.name], auctionId, user["requestAmount"], user["pricePerToken"]);
      auctionId++;
    }

    // Step in the future and resolve all the auctions
    await this.resolveAuction();
    
    // Proceed with the token distribution
    await this.contract.distributeToken(5);
    
    // The contract should have distributed the tokens
    expect(await this.contract.balanceOf(this.contractAddress)).to.equal(0n, "Invalid balance");

    // Check user allocation
    for (let user of config) {
      expect(await this.contract.balanceOf(this.signers[user.name].address)).to.equal(user.expectedAllocation, "Invalid user balance");
    };

    // Check user payback 
    auctionId = 0
    for (let user of config) {
      let payBackAmount = user.getExpectedEthBack();
      let userAddress = this.signers[user.name].address;
      let userWallet = this.contract.connect(this.signers[user.name]);

      if (payBackAmount > 0) {
        // We should get back the original tokens
        const userEthBalanceBefore = await ethers.provider.getBalance(userAddress);

        const transaction =  await userWallet.unlock(auctionId);
        const receipt = await transaction.wait();

        const gasUsed = BigInt(receipt.gasUsed * receipt.gasPrice);
        const userEthBalanceAfter = await ethers.provider.getBalance(userAddress);

        expect(userEthBalanceAfter ).to.be.eq(userEthBalanceBefore - gasUsed + BigInt(payBackAmount));

      } else {
        // the transaction should revert has we have no more token available
        await expect(userWallet.unlock(auctionId)).to.be.reverted;
      }
      
      auctionId++;
    }

  });

 // TODO: test less allocation




});
