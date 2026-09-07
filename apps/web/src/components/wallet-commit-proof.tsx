"use client";

import { useState } from "react";

type InjectedEthereum = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

function shorten(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

export function WalletCommitProof({ manifestHash }: { manifestHash: string }) {
  const [address, setAddress] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connectAndSign() {
    const ethereum = (window as typeof window & { ethereum?: InjectedEthereum }).ethereum;
    if (!ethereum) {
      setError("No injected browser wallet was found. Install or open a wallet to sign.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const wallet = accounts[0];
      if (!wallet) throw new Error("The wallet did not return an account");
      const message = [
        "Frontier Protocol practice entry",
        `Manifest: ${manifestHash}`,
        "Purpose: prove wallet intent for this demo only",
        "No token approval or transaction is requested.",
      ].join("\n");
      const encodedMessage = `0x${Array.from(new TextEncoder().encode(message), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("")}`;
      const signed = (await ethereum.request({
        method: "personal_sign",
        params: [encodedMessage, wallet],
      })) as string;
      setAddress(wallet);
      setSignature(signed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet signature was rejected");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="wallet-commit-proof">
      <div>
        <span>OPTIONAL WALLET PROOF</span>
        <strong>Sign the published challenge manifest.</strong>
        <p>
          This proves wallet intent without asking for test ETH or token approval. It does not claim
          a tournament entry or payout transaction.
        </p>
      </div>
      <button disabled={pending} onClick={() => void connectAndSign()} type="button">
        {pending ? "Waiting for signature…" : signature ? "Signed" : "Connect wallet and sign"}
      </button>
      {error ? <p className="status-bad wallet-proof-result">{error}</p> : null}
      {address && signature ? (
        <dl className="wallet-proof-result">
          <div>
            <dt>Wallet</dt>
            <dd>{shorten(address)}</dd>
          </div>
          <div>
            <dt>Manifest</dt>
            <dd>{shorten(manifestHash)}</dd>
          </div>
          <div>
            <dt>Signature</dt>
            <dd>{shorten(signature)}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
