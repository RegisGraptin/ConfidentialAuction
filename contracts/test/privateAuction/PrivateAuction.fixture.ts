import { ethers } from "hardhat";

import type { PrivateAuction } from "../../types";
import { getSigners } from "../signers";

export async function deployPrivateAuctionFixture(): Promise<PrivateAuction> {
  const signers = await getSigners();

  let endAuctionTime = new Date();
  endAuctionTime.setDate(endAuctionTime.getDate() + 7);

  const contractFactory = await ethers.getContractFactory("PrivateAuction");

  const contract = await contractFactory
    .connect(signers.alice)
    .deploy(
        "Zama",
        "ZZZ",
        1_000_000n,
        Math.floor(endAuctionTime.getTime() / 1000),
    ); 
  await contract.waitForDeployment();

  return contract;
}
