import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { NextPage } from "next";
import Head from "next/head";
import styles from "../styles/Home.module.css";

import ConfidentialAuction from "../abi/ConfidentialAuction.json";
import { useReadContract } from "wagmi";
import { Address } from "viem";
import React from "react";
import { createFHEInstance } from "../lib/fhe";
import Header from "../components/Header";
import Footer from "../components/Footer";

const Home: NextPage = () => {
  React.useEffect(() => {
    createFHEInstance();
  }, []);

  const { data: tokenName } = useReadContract({
    address: process.env.NEXT_PUBLIC_CONTRACT as Address,
    abi: ConfidentialAuction.abi,
    functionName: "name",
    args: [],
  });

  const { data: endAuctionTime } = useReadContract({
    address: process.env.NEXT_PUBLIC_CONTRACT as Address,
    abi: ConfidentialAuction.abi,
    functionName: "endAuctionTime",
    args: [],
  });

  function parseTimestampData(timestamps: number): string {
    return new Date(timestamps * 1000).toDateString();
  }

  //
  // {parseTimestampData(Number(endAuctionTime))}
  //     tokenName
  //       <CreateAuctionForm />

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Navbar */}
      <Header />

      {/* Hero Section */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6">
            Decentralized Confidential Auctions
          </h1>
          <p className="text-lg md:text-xl mb-8">
            Launch your token securely and bid with confidence on our sealed-bid
            auction platform.
          </p>
          <a href="/auction/create" title="Create an auction">
            <button className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold shadow-lg hover:bg-gray-200 transition-transform transform hover:scale-105">
              Create an auction
            </button>
          </a>
        </div>
      </header>

      {/* About Section */}
      <section id="about" className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            About the Project
          </h2>
          <p className="text-gray-700 text-lg leading-relaxed mb-6">
            Our platform provides a smart contract implementation for a
            Confidential Single-Price Auction using sealed bids, powered by
            Zama's fhEVM. This ensures privacy and fairness throughout the token
            auction process.
          </p>
          <ul className="list-disc list-inside space-y-4 text-gray-700">
            <li>
              <strong>Token Customization:</strong> Define token details and
              auction duration.
            </li>
            <li>
              <strong>Encrypted Bids:</strong> Ensure confidentiality during the
              bidding process.
            </li>
            <li>
              <strong>Settlement Price:</strong> Automatically determined based
              on the highest bid.
            </li>
            <li>
              <strong>Refund Mechanism:</strong> Protect participants if the
              auction isn't fully filled.
            </li>
          </ul>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-gray-100 py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-lg transition-transform transform hover:scale-105">
              <h3 className="text-xl font-semibold mb-4">Bid Phase</h3>
              <p className="text-gray-600">
                Participants place encrypted bids specifying the number of
                tokens and the price. The total value is decrypted by Zama’s
                Gateway to confirm the bid.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-lg transition-transform transform hover:scale-105">
              <h3 className="text-xl font-semibold mb-4">Resolution Phase</h3>
              <p className="text-gray-600">
                After the auction ends, encrypted bids are decrypted to
                determine the settlement price and allocation order.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-lg transition-transform transform hover:scale-105">
              <h3 className="text-xl font-semibold mb-4">Allocation Phase</h3>
              <p className="text-gray-600">
                Tokens are distributed to participants based on the settlement
                price and bid order.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-lg transition-transform transform hover:scale-105">
              <h3 className="text-xl font-semibold mb-4">Distribution Phase</h3>
              <p className="text-gray-600">
                Participants claim tokens or refunds, and the auction owner
                receives the ETH raised.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        id="cta"
        className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-16 px-4"
      >
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">
            Ready to Launch Your Auction?
          </h2>
          <p className="text-lg mb-8">
            Join our platform to start your confidential token auction today.
          </p>
          <button className="bg-white text-indigo-600 px-8 py-3 rounded-lg font-semibold shadow-lg hover:bg-gray-200 transition-transform transform hover:scale-105">
            Get Started
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
