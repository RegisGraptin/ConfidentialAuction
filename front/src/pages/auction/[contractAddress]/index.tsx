"use client";

import { NextPage } from "next";
import CreateConfidentialAuction from "../../../components/CreateConfidentialAuction";
import { useParams } from "next/navigation";
import { isAddress } from "viem";
import { useEffect, useState } from "react";

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
      <h1>Place your confidential bid</h1>
    </>
  );
};

export default AuctionPage;
