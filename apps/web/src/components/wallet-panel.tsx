"use client";

import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import type { ReactNode } from "react";

function ConnectedWallet() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  if (!ready || !walletsReady) return <span className="wallet muted">Wallet loading…</span>;
  if (!authenticated) return <button onClick={login}>Connect wallet</button>;
  const address = wallets[0]?.address ?? user?.wallet?.address;
  return (
    <span className="wallet">
      <span>{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Wallet connected"}</span>
      <button className="text-button" onClick={logout}>
        Disconnect
      </button>
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
  if (!appId) return <>{children}</>;
  return (
    <PrivyProvider
      appId={appId}
      config={{ embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } } }}
    >
      {children}
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
