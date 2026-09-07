import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  description:
    "An Ethereum-native reward protocol for multi-objective problems, with deterministic frontier evaluation and verifiable settlement.",
  title: "Value Decentralization | Frontier Protocol",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className={`${sans.variable} ${mono.variable}`} lang="en" translate="no">
      <body>
        <header className="site-header">
          <Link className="wordmark" href="/" aria-label="Value Decentralization home">
            <span className="wordmark-title">VALUE DECENTRALIZATION</span>
            <small>Powered by Frontier Protocol</small>
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/#evm-demo">Live proof</Link>
            <Link href="/#how-it-works">How it works</Link>
            <Link href="/arenas">Arenas</Link>
            <Link href="/architecture">Architecture</Link>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <p>Value Decentralization, powered by Frontier Protocol.</p>
          <div>
            <Link href="/arenas">Arenas</Link>
            <Link href="/architecture">Architecture</Link>
            <a href="https://github.com/Jun0908/Decentralized-Value">GitHub</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
