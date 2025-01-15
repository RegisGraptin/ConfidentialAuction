import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import Head from 'next/head';
import styles from '../styles/Home.module.css';

import PrivateAuction from "../abi/PrivateAuction.json";
import { useReadContract } from 'wagmi';
import { Address } from 'viem';

const Home: NextPage = () => {
  
  const { data: tokenName } = useReadContract({
    address: process.env.NEXT_PUBLIC_CONTRACT as Address,
    abi: PrivateAuction.abi,
    functionName: 'name',
    args: [],
  })

  const { data: endAuctionTime } = useReadContract({
    address: process.env.NEXT_PUBLIC_CONTRACT as Address,
    abi: PrivateAuction.abi,
    functionName: 'endAuctionTime',
    args: [],
  })

  function parseTimestampData(timestamps: number): string {
    return new Date(timestamps * 1000).toDateString();
  }

  return (
    <div className={styles.container}>
      
      <main className={styles.main}>
        <ConnectButton />

        <h1 className={styles.title}>
          Welcome to <a href="">RainbowKit</a> + <a href="">wagmi</a> +{' '}
          {"" + tokenName}
        </h1>
        

        <p className={styles.description}>
          {parseTimestampData(Number(endAuctionTime))}
        </p>

      </main>

      <footer className={styles.footer}>
        <a href="https://rainbow.me" rel="noopener noreferrer" target="_blank">
          Made with ❤️ by your frens at 🌈
        </a>
      </footer>
    </div>
  );
};

export default Home;
