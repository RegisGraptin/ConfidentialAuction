import React, { FormEvent, useState } from "react";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { createFHEInstance, getFHEInstance } from "../lib/fhe";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { TbMoneybag } from "react-icons/tb";
import { IoIosPricetag } from "react-icons/io";
import ConfidentialAuction from "../abi/ConfidentialAuction.json";
import { Address, toHex } from "viem";

export default function CreateBidForm({
  contractAddress,
}: {
  contractAddress: string;
}) {
  const { address: userAddress, isConnected } = useAccount();

  const [fheLoaded, setFheLoaded] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function init() {
    console.log("Loading FHE module...");
    await createFHEInstance();
    setFheLoaded(true);
  }

  React.useEffect(() => {
    if (!fheLoaded) {
      init();
    }
  }, [fheLoaded]);

  const {
    data: hash,
    error,
    writeContract,
    isPending: txIsPending,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  async function createBid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);

    console.log("Create a new bid");

    const formData = new FormData(event.currentTarget);

    const amount = Number(formData.get("amount"));
    const price = Number(formData.get("price"));

    if (!isConnected || !fheLoaded || !amount || !price) {
      setIsPending(false);
      return;
    }

    // Get the FHE Instance
    let instance = getFHEInstance();
    if (!instance) {
      console.log("Instance loading...");
      setIsPending(false);
      return;
    }

    // Start to encrypt our input
    console.log("Create encrypted paramters");
    const input = instance.createEncryptedInput(
      contractAddress,
      "" + userAddress,
    );
    input.add256(amount);
    input.add256(price);
    let e = await input.encrypt();

    console.log("Create the tx");
    writeContract({
      address: contractAddress as Address,
      abi: ConfidentialAuction.abi,
      functionName: "submitEncryptedBid",
      args: [toHex(e.handles[0]), toHex(e.handles[1]), toHex(e.inputProof)],
    });

    setIsPending(false);
  }

  function isDisable() {
    return !isConnected || isPending || !fheLoaded || txIsPending;
  }

  return (
    <div className="container mx-auto pt-5">
      <h2 className="text-4xl font-extrabold pb-5">
        Create a new confidential bid
      </h2>
      <form className="max-w-sm mx-auto" onSubmit={createBid}>
        <div>
          <div className="flex pt-5">
            <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-e-0 border-gray-300 rounded-s-md">
              <TbMoneybag />
            </span>
            <input
              name="amount"
              type="number"
              id="name"
              className="rounded-none rounded-e-lg bg-gray-50 border border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 w-full text-sm p-2.5"
              placeholder="Token Quantity"
            />
          </div>
        </div>

        <div>
          <div className="flex mt-5">
            <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-e-0 border-gray-300 rounded-s-md">
              <IoIosPricetag />
            </span>
            <input
              name="price"
              type="number"
              id="price"
              className="rounded-none bg-gray-50 border border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 w-full text-sm p-2.5"
              placeholder="Price per token in wei"
            />
            <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-r-0 border-gray-300 rounded-r-md">
              wei
            </span>
          </div>
        </div>

        {!fheLoaded && (
          <div className="flex justify-center pt-5">
            <svg
              aria-hidden="true"
              className="w-6 h-6 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
              viewBox="0 0 100 101"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                fill="currentColor"
              />
              <path
                d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                fill="currentFill"
              />
            </svg>
            <span className="pl-5">Loading the FHE module...</span>
          </div>
        )}

        <div className="flex justify-center pt-5">
          <button
            type="submit"
            className={`text-white font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 focus:outline-none ${!isDisable() ? "bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300" : "bg-blue-400"}`}
            disabled={isDisable()}
          >
            Make an offer
          </button>
        </div>

        <div>{error?.message}</div>
      </form>
    </div>
  );
}
