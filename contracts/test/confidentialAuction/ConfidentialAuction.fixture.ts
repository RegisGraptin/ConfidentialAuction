import { ethers, network } from "hardhat";

import type { ConfidentialAuction } from "../../types";
import { getSigners } from "../signers";

export async function deployConfidentialAuctionFixture(): Promise<ConfidentialAuction> {
  const signers = await getSigners();

  let blockTimestamp = (await ethers.provider.getBlock('latest'))!.timestamp;
  blockTimestamp += 7 * 24 * 60 * 60;

  const contractFactory = await ethers.getContractFactory("ConfidentialAuction");

  const contract = await contractFactory
    .connect(signers.alice)
    .deploy(
        "Zama",
        "ZZZ",
        1_000_000n,
        blockTimestamp,
    ); 
  await contract.waitForDeployment();

  return contract;
}
