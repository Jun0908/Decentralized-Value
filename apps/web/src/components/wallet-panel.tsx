"use client";

import { PrivyProvider, useConnectWallet, useWallets } from "@privy-io/react-auth";
import { createContext, useContext, type ReactNode } from "react";
import { sepolia } from "viem/chains";

const WalletConfiguredContext = createContext(false);

export function useWalletConfigured() {
  return useContext(WalletConfiguredContext);
}

function ConnectedWallet() {
  const { wallets, ready: walletsReady } = useWallets();
  const { connectWallet } = useConnectWallet();
  if (!walletsReady) return <span className="wallet muted">Wallet loading…</span>;
  const address = wallets[0]?.address;
  if (!address) return <button onClick={() => connectWallet()}>Connect wallet</button>;
  return (
    <span className="wallet">
      <span className="wallet-status-dot" aria-hidden="true" />
      <span>{`${address.slice(0, 6)}…${address.slice(-4)}`}</span>
    </span>
  );
}

export function WalletProvider({
  children,
  appId,
}: {
  children: ReactNode;
  appId: string | undefined;
}) {
  if (!appId) {
    return (
      <WalletConfiguredContext.Provider value={false}>{children}</WalletConfiguredContext.Provider>
    );
  }
  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          accentColor: "#c7ff45",
          showWalletLoginFirst: true,
          theme: "dark",
        },
        defaultChain: sepolia,
        loginMethods: ["wallet"],
        supportedChains: [sepolia],
      }}
    >
      <WalletConfiguredContext.Provider value={true}>{children}</WalletConfiguredContext.Provider>
    </PrivyProvider>
  );
}

export function WalletPanel({ configured }: { configured: boolean }) {
  return configured ? (
    <ConnectedWallet />
  ) : (
    <span className="wallet muted">Privy not configured</span>
  );
}
