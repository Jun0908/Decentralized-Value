"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useFrontierAccount } from "@/components/wallet-panel";

type HeroEvmResult = {
  calldataGas: number;
  decodeExecutionGas: number;
  correctness: boolean;
  malformedInputRejected: boolean;
  resultHash: string;
  contribution: { frontierExpansionPpm: number };
};

type RunState = "ready" | "running" | "measured" | "error";

const gasFormatter = new Intl.NumberFormat("en-US");

const proofMessages: Record<RunState, readonly [string, string, string]> = {
  ready: ["Solidity ready for Cancun EVM", "Correctness gate ready", "Result hash ready"],
  running: ["Executing Solidity in Cancun EVM", "Correctness check pending", "Result hash pending"],
  measured: [
    "Solidity executed in Cancun EVM",
    "Correctness gate passed",
    "Result hash reproduced",
  ],
  error: [
    "Solidity execution failed",
    "Correctness was not rechecked",
    "Verified build result remains visible",
  ],
};

function formatContribution(ppm: number) {
  return `${(ppm / 10_000).toFixed(2)}%`;
}

export function HomeProtocolHero({ initialResult }: { initialResult: HeroEvmResult }) {
  const account = useFrontierAccount();
  const [result, setResult] = useState(initialResult);
  const [runState, setRunState] = useState<RunState>("ready");

  async function runProof() {
    setRunState("running");
    try {
      const response = await fetch("/v1/calldata-compression/evaluations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codecId: "packed", contextId: "public-transfer-mix" }),
      });
      const payload = (await response.json()) as HeroEvmResult & {
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "EVM measurement failed");
      setResult(payload);
      setRunState("measured");
    } catch {
      setRunState("error");
    }
  }

  const passed = result.correctness && result.malformedInputRejected;
  const messages = proofMessages[runState];

  return (
    <>
      <div className="hero-intro-grid">
        <div className="finalist-hero-copy">
          <p className="eyebrow">Decentralized markets for plural values</p>
          <h1>One score should not decide everything.</h1>
          <p className="hero-value-statement">
            Value Decentralization keeps each goal separate and rewards every solution that expands
            the frontier.
          </p>
          <p className="hero-ethereum-line">Ethereum makes the rules and rewards verifiable.</p>
          <div className="actions hero-actions">
            {account.authenticated ? (
              <Link className="primary-action" href="/arenas/emergency-supply">
                Enter live arena
              </Link>
            ) : (
              <button
                className="primary-action"
                disabled={!account.configured || !account.ready}
                onClick={account.login}
                type="button"
              >
                {!account.configured
                  ? "Login unavailable"
                  : account.ready
                    ? "Log in"
                    : "Checking login..."}
              </button>
            )}
            <Link className="secondary-action" href="/arenas">
              Explore arenas
            </Link>
          </div>
        </div>

        <figure className="hero-value-illustration">
          <Image
            alt="A hand-drawn comparison: one weighted score discards four of five ideas, while an open Pareto frontier funds the cleanest, cheapest, and most resilient solutions."
            height={1024}
            preload
            sizes="(max-width: 760px) calc(100vw - 2rem), (max-width: 1100px) 50vw, 620px"
            src="/images/weighted-score-vs-open-frontier.png"
            width={1536}
          />
        </figure>
      </div>

      <section
        className={`hero-live-proof ${runState}`}
        id="home-live-proof"
        aria-labelledby="home-live-proof-heading"
      >
        <header className="hero-live-proof-heading">
          <div>
            <p>Live Cancun EVM</p>
            <h2 id="home-live-proof-heading">Real Solidity, reproduced on demand.</h2>
          </div>
          <ul aria-live="polite" className="hero-proof-checklist" role="status">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </header>

        <dl className="hero-proof-metrics">
          <div>
            <dd>{gasFormatter.format(result.calldataGas)}</dd>
            <dt>calldata gas</dt>
          </div>
          <div>
            <dd>{gasFormatter.format(result.decodeExecutionGas)}</dd>
            <dt>decoder gas</dt>
          </div>
          <div>
            <dd className={passed ? "metric-pass" : "metric-fail"}>{passed ? "PASS" : "FAIL"}</dd>
            <dt>correctness</dt>
          </div>
          <div>
            <dd className="metric-contribution">
              +{formatContribution(result.contribution.frontierExpansionPpm)}
            </dd>
            <dt>frontier contribution</dt>
          </div>
        </dl>

        <footer className="hero-proof-footer">
          <span>
            Result hash
            <code title={result.resultHash}>
              {result.resultHash.slice(0, 12)}…{result.resultHash.slice(-8)}
            </code>
          </span>
          <div className="hero-proof-footer-actions">
            <button
              aria-busy={runState === "running"}
              className="hero-proof-rerun"
              disabled={runState === "running"}
              onClick={() => void runProof()}
              type="button"
            >
              {runState === "running" ? "Measuring…" : "Re-run measurement"}
            </button>
            <a href="#reward-evidence">Sepolia verification →</a>
          </div>
        </footer>
      </section>
    </>
  );
}
