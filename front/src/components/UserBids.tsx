import React, { FormEvent, useEffect, useState } from "react";
import { Address } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";

import ConfidentialAuction from "../abi/ConfidentialAuction.json";

export default function UserBids({
  contractAddress,
}: {
  contractAddress: string;
}) {
  const { address: userAddress, isConnected } = useAccount();

  const { data: userBids, isLoading } = useReadContract({
    address: contractAddress as Address,
    abi: ConfidentialAuction.abi,
    functionName: "userBids",
    args: [userAddress],
  });

  const { data: allBids, isLoading: allBidsLoading } = useReadContracts({
    contracts: (userBids || []).map((bidId, _) => ({
      abi: ConfidentialAuction.abi,
      address: contractAddress as Address,
      functionName: "bids",
      args: [bidId],
    })),
  });

  if (!isConnected) {
    return (
      <div className="max-w-sm mx-auto text-center pt-5">
        <p>Need to be connected to see the user bids.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-5">
      <h2 className="text-4xl font-extrabold">User Bids</h2>

      <table className="mt-5 w-full text-sm text-left rtl:text-right text-gray-500">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3">
              Bid Id
            </th>
            <th scope="col" className="px-6 py-3">
              Creation Date
            </th>
            <th scope="col" className="px-6 py-3">
              Total Allocation
            </th>
            <th scope="col" className="px-6 py-3">
              Total Value Lock (ETH)
            </th>
            <th scope="col" className="px-6 py-3">
              Confirmed
            </th>
          </tr>
        </thead>
        <tbody>
          {allBids &&
            allBids.map((bidResult, index) => {
              console.log(bidResult);
              const bid = bidResult.result;
              console.log(bid);
              return (
                <>
                  <tr className="bg-white">
                    <th
                      scope="row"
                      className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap"
                    >
                      #{userBids[index]}
                    </th>
                    <td className="px-6 py-4">
                      {new Date(Number(bid.creationTime) * 1000).toDateString()}
                    </td>
                    <td className="px-6 py-4">{bid.totalAllocation}</td>
                    <td className="px-6 py-4">{bid.totalValueLock}</td>
                    <td className="px-6 py-4">
                      {bid.confirmed && (
                        <span className="bg-green-100 text-green-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-sm">
                          Confirmed
                        </span>
                      )}
                      {!bid.confirmed && bid.totalAllocation == 0 && (
                        <span className="bg-yellow-100 text-yellow-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-sm">
                          Waiting Gateway
                        </span>
                      )}
                      {!bid.confirmed && bid.totalAllocation > 0 && (
                        <span className="bg-red-100 text-red-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-sm">
                          Canceled
                        </span>
                      )}
                    </td>
                  </tr>
                </>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
