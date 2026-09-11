import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { WalletPanel, WalletProvider } from "@/components/wallet-panel";

import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  description:
    "An Ethereum-native reward protocol for multi-objective problems, with deterministic frontier evaluation and verifiable settlement.",
  title: "Value Decentralization | Frontier Protocol",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  return (
    <html className={`${sans.variable} ${mono.variable}`} lang="en">
      <body>
        <WalletProvider appId={privyAppId}>
          <header className="site-header">
            <Link className="wordmark" href="/" aria-label="Value Decentralization home">
              <Image
                className="wordmark-logo"
                src="/logo.svg"
                alt=""
                width={44}
                height={44}
                priority
              />
              <span className="wordmark-copy">
                <span className="wordmark-title">VALUE DECENTRALIZATION</span>
                <small>Powered by Frontier Protocol</small>
              </span>
            </Link>
            <nav aria-label="Primary navigation">
              <Link href="/#evm-demo">Live proof</Link>
              <Link href="/#how-it-works">How it works</Link>
              <Link href="/#arenas">Arenas</Link>
            </nav>
            <WalletPanel configured={Boolean(privyAppId)} />
          </header>
          {children}
          <footer className="site-footer">
            <p>Value Decentralization, powered by Frontier Protocol.</p>
            <div>
              <a href="https://j-kawai0908s-organization.gitbook.io/value-decentralization-whitepaper">
                Whitepaper
              </a>
              <Link href="/architecture">Architecture</Link>
              <Link href="/docs/cli">SDK & CLI</Link>
              <a href="https://github.com/Jun0908/Decentralized-Value">GitHub</a>
            </div>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
