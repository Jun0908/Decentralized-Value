"use client";

import { PrivyProvider, useIdentityToken, usePrivy, useWallets } from "@privy-io/react-auth";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { sepolia } from "viem/chains";

type FrontierAccount = {
  configured: boolean;
  ready: boolean;
  authenticated: boolean;
  label: string | null;
  wallet: string | null;
  login(): void;
  logout(): Promise<void>;
  linkWallet(): void;
  authHeaders(): Promise<Record<string, string>>;
};

const unavailableAccount: FrontierAccount = {
  configured: false,
  ready: true,
  authenticated: false,
  label: null,
  wallet: null,
  login() {},
  async logout() {},
  linkWallet() {},
  async authHeaders() {
    throw new Error("Privy is not configured");
  },
};

const WalletConfiguredContext = createContext(false);
const FrontierAccountContext = createContext<FrontierAccount>(unavailableAccount);

export function useWalletConfigured() {
  return useContext(WalletConfiguredContext);
}

export function useFrontierAccount() {
  return useContext(FrontierAccountContext);
}

function AccountBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout, linkWallet, getAccessToken } = usePrivy();
  const { identityToken } = useIdentityToken();
  const { wallets, ready: walletsReady } = useWallets();
  const embedded = wallets.find(({ walletClientType }) => walletClientType === "privy");
  const wallet = embedded?.address ?? wallets[0]?.address ?? null;
  const email = user?.email?.address ?? user?.google?.email ?? null;
  const label = email ?? (user ? `Account ${user.id.slice(-6)}` : null);

  const authHeaders = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken || !identityToken) throw new Error("Your login session is still loading");
    return {
      authorization: `Bearer ${accessToken}`,
      "x-privy-identity-token": identityToken,
    };
  }, [getAccessToken, identityToken]);
  const account = useMemo<FrontierAccount>(
    () => ({
      configured: true,
      ready: ready && walletsReady,
      authenticated,
      label,
      wallet,
      login: () => login(),
      logout,
      linkWallet: () => linkWallet({ walletChainType: "ethereum-only" }),
      authHeaders,
    }),
    [authHeaders, authenticated, label, linkWallet, login, logout, ready, wallet, walletsReady],
  );
  return (
    <FrontierAccountContext.Provider value={account}>{children}</FrontierAccountContext.Provider>
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
      <WalletConfiguredContext.Provider value={false}>
        <FrontierAccountContext.Provider value={unavailableAccount}>
          {children}
        </FrontierAccountContext.Provider>
      </WalletConfiguredContext.Provider>
    );
  }
  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          accentColor: "#c7ff45",
          showWalletLoginFirst: false,
          theme: "dark",
        },
        defaultChain: sepolia,
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        loginMethods: ["google", "email", "wallet"],
        supportedChains: [sepolia],
      }}
    >
      <WalletConfiguredContext.Provider value={true}>
        <AccountBridge>{children}</AccountBridge>
      </WalletConfiguredContext.Provider>
    </PrivyProvider>
  );
}

function ConnectedAccount() {
  const account = useFrontierAccount();
  if (!account.ready) return <span className="wallet muted">Restoring session…</span>;
  if (!account.authenticated) return <button onClick={account.login}>Sign in</button>;
  return (
    <details className="account-menu">
      <summary className="wallet">
        <span className="wallet-status-dot" aria-hidden="true" />
        <span>{account.label}</span>
      </summary>
      <div>
        <span>
          {account.wallet
            ? `${account.wallet.slice(0, 8)}…${account.wallet.slice(-6)}`
            : "Creating wallet…"}
        </span>
        <button className="text-button" onClick={account.linkWallet} type="button">
          Link another wallet
        </button>
        <button className="text-button" onClick={() => void account.logout()} type="button">
          Sign out
        </button>
      </div>
    </details>
  );
}

export function WalletPanel({ configured }: { configured: boolean }) {
  return configured ? (
    <ConnectedAccount />
  ) : (
    <span className="wallet muted">Sign-in unavailable</span>
  );
}
