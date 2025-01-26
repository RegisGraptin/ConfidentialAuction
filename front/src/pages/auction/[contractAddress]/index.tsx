"use client";

import { NextPage } from "next";
import CreateConfidentialAuction from "../../../components/CreateConfidentialAuction";
import { useParams } from "next/navigation";
import { Address, isAddress } from "viem";
import { useEffect, useState } from "react";
import CreateBidForm from "../../../components/CreateBidForm";
import UserBids from "../../../components/UserBids";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import ConfidentialAuction from "../../../abi/ConfidentialAuction.json";
import { useReadContract } from "wagmi";
import AuctionDetail from "../../../components/AuctionDetail";

const AuctionPage: NextPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const params = useParams<{ contractAddress: string }>();

  useEffect(() => {
    if (params && params.contractAddress !== undefined) {
      setIsLoading(false);
    }
  }, [params]);

  if (isLoading) {
    return <>Loading...</>;
  }

  if (!isAddress(params.contractAddress)) {
    return (
      <>
        <h2>Invalid contract address!</h2>
      </>
    );
  }

  return (
    <>
      <section className="py-20 px-4">
        <AuctionDetail contractAddress={params.contractAddress} />

        <div className="flex justify-center">
          <ConnectButton />
        </div>

        <UserBids contractAddress={params.contractAddress} />

        <CreateBidForm contractAddress={params.contractAddress} />
      </section>
    </>
  );
};

export default AuctionPage;
