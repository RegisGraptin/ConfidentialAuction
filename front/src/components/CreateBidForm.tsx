import { initFhevm, createInstance } from "fhevmjs/bundle";
import React, { FormEvent } from "react";
import { useAccount } from "wagmi";
import { getFHEInstance } from "../lib/fhe";

export default function CreateBidForm() {
  const { address: userAddress } = useAccount();

  async function init() {
    console.log("Loading boys...");
    // await initFhevm();
    // const instance = await createInstance({
    //     networkUrl: "https://eth-sepolia.public.blastapi.io",
    //     gatewayUrl: "https://gateway.sepolia.zama.ai",
    //     kmsContractAddress: "0x9D6891A6240D6130c54ae243d8005063D05fE14b",
    //     aclContractAddress: "0xFee8407e2f5e3Ee68ad77cAE98c434e637f516e5",
    // });
    // console.log(instance)
    console.log(userAddress);
    console.log(`0x${userAddress}`);

    // const input = instance.createEncryptedInput(
    //     process.env.NEXT_PUBLIC_CONTRACT!,
    //     "" + userAddress
    // );
    // console.log(input);
  }

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
          <label
            htmlFor="website-admin"
            className="block mb-2 text-sm font-medium text-gray-900"
          >
            Token Quantity
          </label>
          <div className="flex">
            <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-e-0 border-gray-300 rounded-s-md">
              <svg
                className="w-4 h-4 text-gray-500"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M10 0a10 10 0 1 0 10 10A10.011 10.011 0 0 0 10 0Zm0 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 13a8.949 8.949 0 0 1-4.951-1.488A3.987 3.987 0 0 1 9 13h2a3.987 3.987 0 0 1 3.951 3.512A8.949 8.949 0 0 1 10 18Z" />
              </svg>
            </span>
            <input
              name="amount"
              type="number"
              id="website-admin"
              className="rounded-none rounded-e-lg bg-gray-50 border border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 w-full text-sm p-2.5"
              placeholder="Bonnie Green"
            />
          </div>
        </div>

        <div className="pt-5">
          <label
            htmlFor="website-admin"
            className="block mb-2 text-sm font-medium text-gray-900"
          >
            Price per token in wei
          </label>
          <div className="flex">
            <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-e-0 border-gray-300 rounded-s-md">
              <svg
                className="w-4 h-4 text-gray-500"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M10 0a10 10 0 1 0 10 10A10.011 10.011 0 0 0 10 0Zm0 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 13a8.949 8.949 0 0 1-4.951-1.488A3.987 3.987 0 0 1 9 13h2a3.987 3.987 0 0 1 3.951 3.512A8.949 8.949 0 0 1 10 18Z" />
              </svg>
            </span>
            <input
              name="price"
              type="number"
              id="website-admin"
              className="rounded-none rounded-e-lg bg-gray-50 border border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 w-full text-sm p-2.5"
              placeholder="Bonnie Green"
            />
          </div>
        </div>

        <div className="pt-5">
          <button
            type="submit"
            className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none"
          >
            Make an offer
          </button>
        </div>
      </form>
    </div>
  );
}
