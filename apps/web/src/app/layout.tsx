import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { WalletPanel, WalletProvider } from "@/components/wallet-panel";

import "./globals.css";

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  description: "Rewarding artifacts that expand reproducible Pareto frontiers.",
  title: "Frontier Protocol",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  return (
    <html className={`${sans.variable} ${mono.variable}`} lang="en">
      <body>
        <WalletProvider appId={privyAppId}>
          <header className="site-header">
            <Link className="wordmark" href="/">
              FRONTIER/
            </Link>
            <nav aria-label="Primary navigation">
              <Link href="/arena">Arena</Link>
              <Link href="/runners">Runners</Link>
              <Link href="/sponsor-debug">Integrations</Link>
            </nav>
            <WalletPanel configured={Boolean(privyAppId)} />
          </header>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
