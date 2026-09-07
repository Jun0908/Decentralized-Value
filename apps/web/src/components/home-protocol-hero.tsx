"use client";

import type { CodecPoint } from "@frontier/calldata-compression";
import { useState } from "react";

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

function formatContribution(ppm: number) {
  return `${(ppm / 10_000).toFixed(2)}%`;
}

function FrontierRewardIllustration({ points }: { points: readonly CodecPoint[] }) {
  const byId = new Map(points.map((point) => [point.id, point]));
  const packed = byId.get("packed");
  const dictionary = byId.get("dictionary");
  const abi = byId.get("abi");

  if (!packed || !dictionary || !abi) return null;

  const minCalldata = Math.min(...points.map((point) => point.calldataGas));
  const maxCalldata = Math.max(...points.map((point) => point.calldataGas));
  const minDecoder = Math.min(...points.map((point) => point.decodeExecutionGas));
  const maxDecoder = Math.max(...points.map((point) => point.decodeExecutionGas));
  const x = (value: number) => 67 + ((value - minCalldata) / (maxCalldata - minCalldata)) * 275;
  const y = (value: number) => 166 - ((value - minDecoder) / (maxDecoder - minDecoder)) * 104;
  const packedX = x(packed.calldataGas);
  const packedY = y(packed.decodeExecutionGas);
  const dictionaryX = x(dictionary.calldataGas);
  const dictionaryY = y(dictionary.decodeExecutionGas);
  const abiX = x(abi.calldataGas);
  const abiY = y(abi.decodeExecutionGas);

  return (
    <svg
      aria-labelledby="reward-frontier-title reward-frontier-description"
      className="reward-frontier-illustration"
      role="img"
      viewBox="0 0 390 215"
    >
      <title id="reward-frontier-title">Multiple solutions can earn a reward</title>
      <desc id="reward-frontier-description">
        Dictionary and Packed each expand a different edge of the Pareto frontier and remain
        rewardable. Standard ABI is worse on both gas measurements and receives no reward.
      </desc>
      <defs>
        <linearGradient id="rewardFrontier" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#efffb5" />
          <stop offset="1" stopColor="#a8ef18" />
        </linearGradient>
        <filter id="rewardPointGlow" height="200%" width="200%" x="-50%" y="-50%">
          <feGaussianBlur result="blur" stdDeviation="3" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path className="reward-axis" d="M45 24V184H368" />
      <path className="reward-axis-arrow" d="m39 176 6 8 6-8M360 178l8 6-8 6" />
      <text className="reward-axis-label" x="48" y="204">
        LOWER CALLDATA GAS ←
      </text>
      <text className="reward-axis-label" transform="rotate(-90 16 158)" x="16" y="158">
        LOWER DECODER GAS ↓
      </text>

      <path
        className="reward-frontier-glow"
        d={`M${dictionaryX} ${dictionaryY} C${dictionaryX + 76} ${dictionaryY + 5}, ${packedX - 58} ${packedY - 26}, ${packedX} ${packedY}`}
      />
      <path
        className="reward-frontier-line"
        d={`M${dictionaryX} ${dictionaryY} C${dictionaryX + 76} ${dictionaryY + 5}, ${packedX - 58} ${packedY - 26}, ${packedX} ${packedY}`}
      />
      <path
        className="reward-dominance-guide"
        d={`M${packedX} ${packedY - 9}V${abiY}H${abiX - 9}`}
      />

      <g transform={`translate(${dictionaryX} ${dictionaryY})`}>
        <circle className="reward-frontier-halo" r="14" />
        <circle className="reward-frontier-node" filter="url(#rewardPointGlow)" r="7" />
        <text className="reward-point-name" x="12" y="-9">
          DICTIONARY
        </text>
      </g>

      <g transform={`translate(${packedX} ${packedY})`}>
        <circle className="reward-frontier-halo" r="15" />
        <circle className="reward-frontier-node packed" filter="url(#rewardPointGlow)" r="8" />
        <text className="reward-point-name" x="13" y="-9">
          PACKED
        </text>
      </g>

      <g transform={`translate(${abiX} ${abiY})`}>
        <circle className="reward-dominated-node" r="6" />
        <text className="reward-point-name dominated" textAnchor="end" x="-11" y="-9">
          STANDARD ABI
        </text>
      </g>
    </svg>
  );
}

export function HomeProtocolHero({
  initialResult,
  points,
}: {
  initialResult: HeroEvmResult;
  points: readonly CodecPoint[];
}) {
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

  return (
    <>
      <div className="finalist-hero-copy">
        <p className="eyebrow">Ethereum-native reward protocol for multi-objective problems</p>
        <h1>Reward every valid solution that expands what is possible.</h1>
        <p className="hero-mechanism">
          <span>Sponsors lock independent goals and correctness rules.</span>
          <span>Deterministic evaluators measure each solution&apos;s frontier contribution.</span>
          <span>Ethereum settles the rewards transparently.</span>
        </p>
        <div className="actions">
          <button
            className="primary-action"
            disabled={runState === "running"}
            onClick={() => void runProof()}
            type="button"
          >
            {runState === "running"
              ? "Executing Solidity…"
              : runState === "measured"
                ? "Run the live EVM proof again"
                : "Run the live EVM proof"}
          </button>
          <a className="secondary-action" href="#reward-evidence">
            Verify the reward on Sepolia
          </a>
        </div>
        <p className={`hero-run-status ${runState}`} role="status">
          {runState === "ready" ? "Packed Solidity codec preloaded · no wallet required" : null}
          {runState === "running" ? "Measuring real bytecode under the public rules…" : null}
          {runState === "measured" ? "Measured now · deterministic result reproduced" : null}
          {runState === "error"
            ? "Measurement failed. The verified build result remains visible."
            : null}
        </p>
      </div>

      <figure className={`hero-protocol-proof ${runState === "measured" ? "is-live" : ""}`}>
        <header className="protocol-proof-heading">
          <div>
            <p>Live protocol proof</p>
            <h2>Multiple winners. One public ruleset.</h2>
            <span>Measured in the Calldata Compression arena</span>
          </div>
          <span className="protocol-live-badge">
            <i aria-hidden="true" /> Cancun EVM
          </span>
        </header>

        <dl className="protocol-metric-grid" aria-live="polite">
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
            <dt>correctness gate</dt>
          </div>
          <div>
            <dd className="metric-contribution">
              +{formatContribution(result.contribution.frontierExpansionPpm)}
            </dd>
            <dt>frontier contribution</dt>
          </div>
        </dl>

        <div className="frontier-proof-body">
          <FrontierRewardIllustration points={points} />
          <dl className="frontier-reward-outcomes">
            <div>
              <dt>Frontier</dt>
              <dd>
                <span>Dictionary</span>
                <strong>Reward</strong>
              </dd>
              <dd>
                <span>Packed</span>
                <strong>Reward</strong>
              </dd>
            </div>
            <div className="dominated-outcome">
              <dt>Dominated</dt>
              <dd>
                <span>Standard ABI</span>
                <strong>0</strong>
              </dd>
            </div>
          </dl>
        </div>

        <figcaption className="protocol-proof-footer">
          <span>Real Solidity bytecode</span>
          <span>Reproducible result</span>
          <code title={result.resultHash}>
            {result.resultHash.slice(0, 10)}…{result.resultHash.slice(-6)}
          </code>
        </figcaption>
      </figure>
    </>
  );
}
