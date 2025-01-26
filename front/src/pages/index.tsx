import type { NextPage } from "next";
import React from "react";
import { createFHEInstance } from "../lib/fhe";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { MdComputer, MdDashboardCustomize } from "react-icons/md";
import { SiLetsencrypt } from "react-icons/si";
import { RiAuctionFill, RiRefundFill } from "react-icons/ri";
import { IoIosPricetags, IoMdSettings } from "react-icons/io";
import { FaDonate } from "react-icons/fa";
import { TbPercentage80 } from "react-icons/tb";

const Home: NextPage = () => {
  React.useEffect(() => {
    createFHEInstance();
  }, []);

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Navbar */}
      <Header />

      {/* Hero Section */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6">
            Launch Tokens Privately, Sell Fairly
          </h1>
          <p className="text-lg md:text-xl mb-8">
            Sealed-bid auctions powered by encrypted blockchain technology
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
            Confidentially launch your token and let buyers bid securely with
            Zama’s fhEVM—ensuring privacy at the bid process and auction
            fairness from start to settlement.
          </p>
        </div>
        <div className="pt-20 mx-auto max-w-2xl lg:max-w-4xl">
          <div className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
            <div className="relative pl-16 h-40">
              <div className="text-base font-semibold leading-7 text-gray-900">
                <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-black text-white">
                  <MdDashboardCustomize />
                </div>
                <h3>Customizable Token Launches</h3>
              </div>
              <div className="mt-2 text-base leading-7 text-gray-600">
                Define token details (name, symbol, supply) and auction duration
                in minutes. Set your terms; we handle the privacy.
              </div>
            </div>
            <div className="relative pl-16 h-40">
              <div className="text-base font-semibold leading-7 text-gray-900">
                <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-black text-white">
                  <SiLetsencrypt />
                </div>
                <h3>Fully Confidential Auctions</h3>
              </div>
              <div className="mt-2 text-base leading-7 text-gray-600">
                Powered by fhEVM, bids remain encrypted until the auction
                closes, eliminating front-running and manipulation.
              </div>
            </div>
            <div className="relative pl-16 h-40">
              <div className="text-base font-semibold leading-7 text-gray-900">
                <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-black text-white">
                  <IoIosPricetags />
                </div>
                <h3>Single-Price Settlement</h3>
              </div>
              <div className="mt-2 text-base leading-7 text-gray-600">
                Automatically determine the fairest price: All winning bidders
                pay the same rate based on the highest filled bid. Transparent,
                bias-free allocation powered by smart contracts.
              </div>
            </div>
            <div className="relative pl-16 h-40">
              <div className="text-base font-semibold leading-7 text-gray-900">
                <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-black text-white">
                  <RiRefundFill />
                </div>
                <h3>Trustless Refund Protection</h3>
              </div>
              <div className="mt-2 text-base leading-7 text-gray-600">
                Funds are refunded if bids don’t meet reserve thresholds. Users
                can reclaim leftover ETH instantly.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-gray-100 py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-8">
            <div className="flex flex-col my-6 bg-white shadow-sm border border-slate-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <RiAuctionFill className="h-6 w-6 text-slate-600" />
                <h5 className="ml-3 text-slate-800 text-xl font-semibold">
                  1. Submit Sealed Bids
                </h5>
              </div>
              <p className="block text-slate-600 leading-normal font-light mb-4">
                Participants bid in total privacy. Buyers submit encrypted bids
                by providing the token amount and the price per token.
                <br />
                Then, Zama’s Gateway decrypt the total value needed to confirm
                the bid (token amount multiply by the price per token) allowing
                the user to confirm his bid by providing the ETH required.
              </p>
            </div>

            <div className="flex flex-col my-6 bg-white shadow-sm border border-slate-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <IoMdSettings className="h-6 w-6 text-slate-600" />
                <h5 className="ml-3 text-slate-800 text-xl font-semibold">
                  2. Reveal Phase
                </h5>
              </div>
              <p className="block text-slate-600 leading-normal font-light mb-4">
                After the auction closes, bids are securely decrypted using
                Zama’s fhEVM. The smart contract calculates the single
                settlement price (highest price that fills the auction) and
                ranks bids.
              </p>
            </div>

            <div className="flex flex-col my-6 bg-white shadow-sm border border-slate-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <TbPercentage80 className="h-6 w-6 text-slate-600" />
                <h5 className="ml-3 text-slate-800 text-xl font-semibold">
                  3. Allocation Phase
                </h5>
              </div>
              <p className="block text-slate-600 leading-normal font-light mb-4">
                Tokens are distributed top-down: Highest bidders get priority,
                all paying the same fair price. No favoritism: Allocation rules
                are enforced by code, not humans.
              </p>
            </div>

            <div className="flex flex-col my-6 bg-white shadow-sm border border-slate-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <FaDonate className="h-6 w-6 text-slate-600" />
                <h5 className="ml-3 text-slate-800 text-xl font-semibold">
                  4. Distribution Phase
                </h5>
              </div>
              <p className="block text-slate-600 leading-normal font-light mb-4">
                Participants can claim tokens and/or get refunds based on their
                allocation. Then, the auction owner can claimed the ETH raised
                during the auction.
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
            Launch your own token by starting your sealed-bid auction—fair,
            private, and trustless.
          </p>
          <a href="/auction/create" title="Create an auction">
            <button className="bg-white text-indigo-600 px-8 py-3 rounded-lg font-semibold shadow-lg hover:bg-gray-200 transition-transform transform hover:scale-105">
              Get Started
            </button>
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
