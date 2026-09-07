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

function formatGas(value: number) {
  return gasFormatter.format(value);
}

function formatContribution(ppm: number) {
  return `${(ppm / 10_000).toFixed(2)}%`;
}

function FrontierIllustration({ points }: { points: readonly CodecPoint[] }) {
  const byId = new Map(points.map((point) => [point.id, point]));
  const packed = byId.get("packed");
  const dictionary = byId.get("dictionary");
  const abi = byId.get("abi");

  if (!packed || !dictionary || !abi) return null;

  const minCalldata = Math.min(...points.map((point) => point.calldataGas));
  const maxCalldata = Math.max(...points.map((point) => point.calldataGas));
  const minDecoder = Math.min(...points.map((point) => point.decodeExecutionGas));
  const maxDecoder = Math.max(...points.map((point) => point.decodeExecutionGas));
  const x = (value: number) => 70 + ((value - minCalldata) / (maxCalldata - minCalldata)) * 300;
  const y = (value: number) => 180 - ((value - minDecoder) / (maxDecoder - minDecoder)) * 118;
  const packedX = x(packed.calldataGas);
  const packedY = y(packed.decodeExecutionGas);
  const dictionaryX = x(dictionary.calldataGas);
  const dictionaryY = y(dictionary.decodeExecutionGas);
  const abiX = x(abi.calldataGas);
  const abiY = y(abi.decodeExecutionGas);

  return (
    <svg
      aria-labelledby="evm-frontier-title evm-frontier-description"
      className="evm-frontier-illustration"
      role="img"
      viewBox="0 0 430 240"
    >
      <title id="evm-frontier-title">Two valid calldata compression tradeoffs</title>
      <desc id="evm-frontier-description">
        Address Dictionary uses the least calldata gas. Fixed-width Packed uses the least decoder
        gas. Both remain on the Pareto frontier, while Standard ABI is dominated.
      </desc>
      <defs>
        <linearGradient id="frontierGlow" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#efffb5" />
          <stop offset="1" stopColor="#a8ef18" />
        </linearGradient>
        <filter id="pointGlow" height="200%" width="200%" x="-50%" y="-50%">
          <feGaussianBlur result="blur" stdDeviation="4" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path className="evm-axis" d="M48 30V202H397" />
      <path className="evm-axis-arrow" d="m42 194 6 8 6-8M389 196l8 6-8 6" />
      <text className="evm-axis-caption" x="51" y="220">
        LOWER CALLDATA GAS ←
      </text>
      <text className="evm-axis-caption" transform="rotate(-90 18 168)" x="18" y="168">
        LOWER DECODER GAS ↓
      </text>

      <path
        className="evm-frontier-glow"
        d={`M${dictionaryX} ${dictionaryY} C${dictionaryX + 88} ${dictionaryY + 8}, ${packedX - 70} ${packedY - 32}, ${packedX} ${packedY}`}
      />
      <path
        className="evm-frontier-line"
        d={`M${dictionaryX} ${dictionaryY} C${dictionaryX + 88} ${dictionaryY + 8}, ${packedX - 70} ${packedY - 32}, ${packedX} ${packedY}`}
      />

      <path className="dominance-guide" d={`M${packedX} ${packedY - 10}V${abiY}H${abiX - 10}`} />

      <g transform={`translate(${dictionaryX} ${dictionaryY})`}>
        <circle className="frontier-halo" r="15" />
        <circle className="frontier-node" filter="url(#pointGlow)" r="7" />
        <text className="evm-point-name" x="12" y="-10">
          DICTIONARY
        </text>
        <text className="evm-point-value" x="12" y="5">
          lowest calldata
        </text>
      </g>

      <g transform={`translate(${packedX} ${packedY})`}>
        <circle className="frontier-halo" r="17" />
        <circle className="frontier-node packed-node" filter="url(#pointGlow)" r="8" />
        <text className="evm-point-name" x="12" y="-9">
          PACKED
        </text>
        <text className="evm-point-value" x="12" y="6">
          lowest decoder gas
        </text>
      </g>

      <g transform={`translate(${abiX} ${abiY})`}>
        <circle className="dominated-node" r="6" />
        <text className="evm-point-name dominated" textAnchor="end" x="-11" y="-8">
          STANDARD ABI
        </text>
        <text className="evm-point-value" textAnchor="end" x="-11" y="7">
          dominated
        </text>
      </g>

      <g className="frontier-callout" transform="translate(214 112)">
        <rect height="34" rx="17" width="178" />
        <text x="89" y="21">
          2 FRONTIER SOLUTIONS → REWARDABLE
        </text>
      </g>
    </svg>
  );
}

export function HomeEvmDemo({
  initialResult,
  points,
}: {
  initialResult: HeroEvmResult;
  points: readonly CodecPoint[];
}) {
  const [result, setResult] = useState(initialResult);
  const [runState, setRunState] = useState<RunState>("ready");

  async function runDemo() {
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
        <p className="eyebrow">Ethereum-native market for multi-objective problems</p>
        <h1>Reward every valid solution that expands what is possible.</h1>
        <p className="hero-mechanism">
          <span>Sponsors fix independent goals and correctness rules.</span>
          <span>Deterministic evaluators measure frontier contribution.</span>
          <span>Ethereum records the reward.</span>
        </p>
        <div className="actions">
          <button
            className="primary-action"
            disabled={runState === "running"}
            onClick={() => void runDemo()}
            type="button"
          >
            {runState === "running"
              ? "Executing Cancun EVM…"
              : runState === "measured"
                ? "Run the EVM demo again"
                : "Run the 10-second EVM demo"}
          </button>
          <a className="secondary-action" href="#reward-evidence">
            Verify the Sepolia reward
          </a>
        </div>
        <p className={`hero-run-status ${runState}`} role="status">
          {runState === "ready" ? "One click · preloaded Packed Solidity codec" : null}
          {runState === "running"
            ? "Executing checked-in bytecode against the public workload…"
            : null}
          {runState === "measured" ? "Measured now · deterministic result reproduced" : null}
          {runState === "error"
            ? "Measurement failed. The displayed build result is unchanged."
            : null}
        </p>
      </div>

      <figure className={`hero-evm-proof ${runState === "measured" ? "is-live" : ""}`}>
        <div className="evm-proof-heading">
          <div>
            <span className="live-indicator" aria-hidden="true" />
            <strong>Live Cancun EVM</strong>
          </div>
          <span>Reproducible result</span>
        </div>

        <dl className="evm-metric-grid" aria-live="polite">
          <div>
            <dd>{formatGas(result.calldataGas)}</dd>
            <dt>calldata gas</dt>
          </div>
          <div>
            <dd>{formatGas(result.decodeExecutionGas)}</dd>
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

        <FrontierIllustration points={points} />

        <figcaption className="evm-proof-footer">
          <span>Real Solidity bytecode</span>
          <code title={result.resultHash}>
            {result.resultHash.slice(0, 10)}…{result.resultHash.slice(-6)}
          </code>
        </figcaption>
      </figure>
    </>
  );
}
