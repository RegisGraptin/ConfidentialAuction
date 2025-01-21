import { IoMdCalendar } from "react-icons/io";
import {
  MdDriveFileRenameOutline,
  MdOutlineEmojiSymbols,
} from "react-icons/md";
import { FaSortAmountUpAlt } from "react-icons/fa";
import { initFhevm, createInstance } from "fhevmjs/bundle";
import React, { FormEvent } from "react";
import { useAccount } from "wagmi";
import { getFHEInstance } from "../lib/fhe";

export default function CreateAuctionForm() {
  const { address: userAddress } = useAccount();

  // React.useEffect(() => {
  //     init();
  // }, [userAddress]);

  async function createAuction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const amount = Number(formData.get("amount"));
    const price = Number(formData.get("price"));

    if (userAddress === undefined) {
      return;
    }

    // Get the FHE Instance
    let instance = getFHEInstance();
    if (!instance) {
      console.log("Instance loading...");
      return;
    }

    // Start to encrypt our input
    const input = instance.createEncryptedInput(
      process.env.NEXT_PUBLIC_CONTRACT!,
      "" + userAddress,
    );
    input.add256(amount);
    input.add256(price);

    console.log(input);

    let e = await input.encrypt();

    console.log(e);

    // TODO: Question: in the example, they show one proof for multiple add => Is it a smart contract update needed ??

    console.log("encrypt data");
  }

  return (
    <div>
      <form className="max-w-sm mx-auto" onSubmit={createAuction}>
        <div>
          <div className="flex">
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

        <div className="pt-5">
          <button
            type="submit"
            className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none"
          >
            Create an auction
          </button>
        </div>
      </form>
    </div>
  );
}
