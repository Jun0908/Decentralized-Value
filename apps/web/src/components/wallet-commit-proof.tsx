"use client";

import { useConnectWallet, useWallets } from "@privy-io/react-auth";
import { useWalletConfigured } from "@/components/wallet-panel";

function shorten(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

export function WalletCommitProof({ manifestHash }: { manifestHash: string }) {
  const configured = useWalletConfigured();

  if (!configured) {
    return (
      <div className="wallet-commit-proof">
        <div>
          <span>WALLET SESSION</span>
          <strong>Privy wallet connection is not configured.</strong>
          <p>The evaluator and published Sepolia evidence remain available without a wallet.</p>
        </div>
      </div>
    );
  }

  return <ConfiguredWalletSession manifestHash={manifestHash} />;
}

function ConfiguredWalletSession({ manifestHash }: { manifestHash: string }) {
  const { wallets, ready } = useWallets();
  const { connectWallet } = useConnectWallet();
  const address = wallets[0]?.address;

  return (
    <div className="wallet-commit-proof">
      <div>
        <span>WALLET SESSION</span>
        <strong>{address ? "Wallet connected through Privy." : "Connect before the demo."}</strong>
        <p>
          This step only connects a wallet. It does not request a raw message signature, token
          approval, or transaction.
        </p>
      </div>
      <button disabled={!ready || Boolean(address)} onClick={() => connectWallet()} type="button">
        {!ready ? "Wallet loading…" : address ? "Wallet connected" : "Connect with Privy"}
      </button>
      {address ? (
        <dl className="wallet-proof-result">
          <div>
            <dt>Wallet</dt>
            <dd>{shorten(address)}</dd>
          </div>
          <div>
            <dt>Manifest</dt>
            <dd>{shorten(manifestHash)}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
