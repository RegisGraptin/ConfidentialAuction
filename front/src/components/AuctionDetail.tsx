import { useReadContract } from "wagmi";
import ConfidentialAuction from "../abi/ConfidentialAuction.json";
import { Address } from "viem";

export default function AuctionDetail({
  contractAddress,
}: {
  contractAddress: string;
}) {
  const { data: tokenName } = useReadContract({
    address: contractAddress as Address,
    abi: ConfidentialAuction.abi,
    functionName: "name",
    args: [],
  });

  const { data: endAuctionTime } = useReadContract({
    address: contractAddress as Address,
    abi: ConfidentialAuction.abi,
    functionName: "endAuctionTime",
    args: [],
  });

  function convertDate() {
    return new Date(Number(endAuctionTime) * 1000).toLocaleString(undefined, {
      dateStyle: "medium",
    });
  }

  return (
    <div className="max-w-7xl mx-auto text-center">
      <h1 className="text-5xl font-bold mb-6">
        Place your confidential bid for {tokenName as string}
      </h1>
      <p className="text-lg md:text-xl mb-8">
        Place your bid until the {convertDate()}.
      </p>
    </div>
  );
}
