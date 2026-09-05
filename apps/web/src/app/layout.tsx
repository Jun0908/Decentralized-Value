import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

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
  return (
    <html className={`${sans.variable} ${mono.variable}`} lang="en">
      <body>{children}</body>
    </html>
  );
}
