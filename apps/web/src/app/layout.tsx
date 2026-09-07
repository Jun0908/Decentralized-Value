import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  description: "Compare solutions without hiding meaningful tradeoffs in one score.",
  title: "Frontier Protocol",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className={`${sans.variable} ${mono.variable}`} lang="en">
      <body>
        <header className="site-header">
          <Link className="wordmark" href="/">
            FRONTIER/
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/emergency-supply">Live arena</Link>
            <Link href="/arena">Technical sample</Link>
            <Link href="/#how-it-works">How it works</Link>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <p>Frontier Protocol · Public, reproducible multi-objective evaluation.</p>
          <div>
            <a href="https://github.com/Jun0908/Decentralized-Value">GitHub</a>
            <Link href="/openapi.yaml">API spec</Link>
            <Link href="/sponsor-debug">Developer status</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
