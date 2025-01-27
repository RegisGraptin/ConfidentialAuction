import { IoMdCalendar } from "react-icons/io";
import {
  MdDriveFileRenameOutline,
  MdOutlineEmojiSymbols,
} from "react-icons/md";
import { FaSortAmountUpAlt } from "react-icons/fa";
import React, { FormEvent, useEffect } from "react";
import {
  useAccount,
  useDeployContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import ConfidentialAuction from "../abi/ConfidentialAuction.json";
import { useRouter } from "next/navigation";

export default function CreateAuctionForm() {
  const { address: userAddress, isConnected } = useAccount();

  const { deployContract, isPending, data } = useDeployContract();

  const { data: txReceipt } = useWaitForTransactionReceipt({
    hash: data,
  });

  const router = useRouter();

  console.log(txReceipt);

  async function createAuction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const name = formData.get("name");
    const symbol = formData.get("symbol");
    const supply = Number(formData.get("supply"));
    const endAuctionTime = Math.round(
      new Date(formData.get("endAuctionTime") as string).getTime() / 1000,
    );
    if (userAddress === undefined) {
      return;
    }

    deployContract({
      abi: ConfidentialAuction.abi,
      bytecode: ConfidentialAuction.bytecode.object as `0x${string}`,
      args: [name, symbol, supply, endAuctionTime],
    });
  }

  useEffect(() => {
    if (txReceipt === undefined) {
      return;
    }

    router.push(`/auction/${txReceipt.contractAddress}`);
  }, [txReceipt]);

  return (
    <div>
      <form className="max-w-sm mx-auto" onSubmit={createAuction}>
        <div className="flex justify-center">
          <ConnectButton />
        </div>
        <div>
          <div className="flex pt-5">
            <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-e-0 border-gray-300 rounded-s-md">
              <MdDriveFileRenameOutline />
            </span>
            <input
              name="name"
              type="text"
              id="name"
              className="rounded-none rounded-e-lg bg-gray-50 border border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 w-full text-sm p-2.5"
              placeholder="Token Name"
            />
          </div>
        </div>

        <div>
          <div className="flex pt-5">
            <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-e-0 border-gray-300 rounded-s-md">
              <MdOutlineEmojiSymbols />
            </span>
            <input
              name="symbol"
              type="text"
              id="symbol"
              className="rounded-none rounded-e-lg bg-gray-50 border border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 w-full text-sm p-2.5"
              placeholder="Token Symbol"
            />
          </div>

          <div className="flex pt-5">
            <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-e-0 border-gray-300 rounded-s-md">
              <FaSortAmountUpAlt />
            </span>
            <input
              name="supply"
              type="number"
              id="supply"
              className="rounded-none rounded-e-lg bg-gray-50 border border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 w-full text-sm p-2.5"
              placeholder="Token Supply"
            />
          </div>

          <div className="flex pt-5">
            <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-e-0 border-gray-300 rounded-s-md">
              <IoMdCalendar />
            </span>
            <input
              name="endAuctionTime"
              type="date"
              id="endAuctionTime"
              className="rounded-none rounded-e-lg bg-gray-50 border border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 w-full text-sm p-2.5"
              placeholder="Auction end date"
            />
          </div>
        </div>

        <div className="flex justify-center pt-5">
          <button
            type="submit"
            className={`text-white font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 focus:outline-none ${isConnected && !isPending ? "bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300" : "bg-blue-400"}`}
            disabled={!isConnected || isPending}
          >
            Create an auction
          </button>
        </div>

        <div className="flex justify-center pt-5">Tx Hash: {data}</div>
      </form>
    </div>
  );
}
