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
    this.createAuction = async (userAddress: string, requestAmount: number, pricePerToken: number) => {
      const input = this.fhevm.createEncryptedInput(this.contractAddress, userAddress);
      // (requestAmount, pricePerUnit)
      const inputs = await input.add256(requestAmount).add256(pricePerToken).encrypt();
  
      // Create a new auction
      // ["createAuction(bytes32,bytes32,bytes)"]
      const transaction = await this.contract.createAuction(
        inputs.handles[0],
        inputs.handles[1],
        inputs.inputProof,
      )
      await transaction.wait();
    }


  });

  it("should be correctly deployed", async function () {
    expect(await this.contract.totalSupply()).to.equal(1_000_000n, "Invalid supply");
    expect(await this.contract.balanceOf(this.contractAddress)).to.equal(1_000_000n, "Invalid balance");
  });


  it("should create auction", async function () {
    
    await this.createAuction(this.signers.alice.address, 100_000n, 10_000n);
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
    await this.createAuction(this.signers.alice.address, 100_000n, 10_000n);
    await awaitAllDecryptionResults();
    await expect(this.contract.cancelAuction(0)).to.be.reverted;
  });

  it("should fund the auction and validate it", async function () {
    await this.createAuction(this.signers.alice.address, 100_000n, 10_000n);
    await awaitAllDecryptionResults();
    
    // Get the contract eth balance before
    const userEthBalanceBefore = await ethers.provider.getBalance(this.signers.alice.address);
    const contractEthBalaceBefore = await ethers.provider.getBalance(this.contractAddress);

    const total_value = 100_000n * 10_000n;
    const transaction = await this.contract.confirmAuction(0, {value: total_value});
    const receipt = await transaction.wait()

    // We also need to take into consideration the gas used to check the user spending
    const gasUsed = BigInt(receipt.gasUsed * receipt.gasPrice);

    // Get the contract eth balance after
    const userEthBalanceAfter = await ethers.provider.getBalance(this.signers.alice.address);
    const contractEthBalaceAfter = await ethers.provider.getBalance(this.contractAddress);

    expect(contractEthBalaceAfter).to.be.eq(contractEthBalaceBefore + total_value);
    expect(userEthBalanceAfter).to.be.eq(userEthBalanceBefore - total_value - gasUsed);
  });

  it("fund with not enough funds", async function () {
    await this.createAuction(this.signers.alice.address, 100_000n, 10_000n);
    await awaitAllDecryptionResults();
    await expect(this.contract.confirmAuction(0)).to.be.reverted;
    await expect(this.contract.confirmAuction(0, {value: 1})).to.be.reverted;
  });

  it("fund back user if too much eth", async function () {
    await this.createAuction(this.signers.alice.address, 100_000n, 10_000n);
    await awaitAllDecryptionResults();

    // Get ETH balance
    const userEthBalanceBefore = await ethers.provider.getBalance(this.signers.alice.address);
    const contractEthBalaceBefore = await ethers.provider.getBalance(this.contractAddress);

    const total_value = 100_000n * 10_000n;
    const transaction = await this.contract.confirmAuction(0, {value: total_value + 100_000n});
    const receipt = await transaction.wait()

    const gasUsed = BigInt(receipt.gasUsed * receipt.gasPrice);

    const userEthBalanceAfter = await ethers.provider.getBalance(this.signers.alice.address);
    const contractEthBalaceAfter = await ethers.provider.getBalance(this.contractAddress);

    // We should only have the total value in addition for the contract
    expect(contractEthBalaceAfter).to.be.eq(contractEthBalaceBefore + total_value);
    expect(userEthBalanceAfter).to.be.eq(userEthBalanceBefore - total_value - gasUsed);
  });


});
