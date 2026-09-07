"use client";

import type { CodecEvaluation, CodecId, CodecPoint } from "@frontier/calldata-compression";
import { useState } from "react";
import { ContributionPanel } from "@/components/contribution-panel";

type PublicCalldataScenario = {
  arenaId: string;
  name: string;
  workloadVersion: string;
  contextHash: string;
  contextId: "public-transfer-mix" | "public-low-reuse";
  contextName: string;
  contextDescription: string;
  evidenceLevel: 0;
  contexts: readonly {
    id: "public-transfer-mix" | "public-low-reuse";
    name: string;
    description: string;
    contextHash: string;
    evidenceLevel: 0;
  }[];
  evmRevision: string;
  compiler: { solc: string; evmVersion: string; optimizerRuns: number };
  calldataRule: string;
  batches: readonly { id: string; name: string; actionCount: number }[];
  codecs: readonly {
    id: CodecId;
    name: string;
    description: string;
    decoderContract: string;
  }[];
  baselinePoints: readonly CodecPoint[];
};

type MeasuredCodecEvaluation = CodecEvaluation & { state: "measured" };

function formatGas(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function CompressionChart({
  points,
  selected,
}: {
  points: readonly CodecPoint[];
  selected: CodecId;
}) {
  const maxX = Math.max(...points.map((point) => point.calldataGas));
  const minX = Math.min(...points.map((point) => point.calldataGas));
  const maxY = Math.max(...points.map((point) => point.decodeExecutionGas));
  const minY = Math.min(...points.map((point) => point.decodeExecutionGas));
  const x = (value: number) => 75 + ((value - minX) / (maxX - minX || 1)) * 420;
  const y = (value: number) => 55 + ((value - minY) / (maxY - minY || 1)) * 210;

  return (
    <figure className="chart-card compression-chart">
      <svg aria-labelledby="compression-chart-title" role="img" viewBox="0 0 560 330">
        <title id="compression-chart-title">Calldata gas and decoder execution gas frontier</title>
        <path className="axis" d="M70 35V275H520" />
        <text className="axis-label" x="300" y="318">
          Calldata gas → lower is better
        </text>
        <text className="axis-label" transform="rotate(-90 18 175)" x="18" y="175">
          Decode gas → lower is better
        </text>
        {points.map((point) => (
          <g
            key={point.id}
            transform={`translate(${x(point.calldataGas)} ${y(point.decodeExecutionGas)})`}
          >
            <circle
              className={point.id === selected ? "supply-candidate" : "frontier"}
              r={point.id === selected ? 9 : 7}
            />
            <text className="point-label" textAnchor="middle" y={-14}>
              {point.name}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>
        Move toward the upper-left: both gas values are minimized independently.
      </figcaption>
    </figure>
  );
}

export function CalldataCompressionDemo({ scenario }: { scenario: PublicCalldataScenario }) {
  const [activeScenario, setActiveScenario] = useState(scenario);
  const [codecId, setCodecId] = useState<CodecId>("packed");
  const [evaluation, setEvaluation] = useState<MeasuredCodecEvaluation | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedCodec = activeScenario.codecs.find((codec) => codec.id === codecId)!;

  async function selectContext(contextId: PublicCalldataScenario["contextId"]) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/v1/calldata-compression?contextId=${encodeURIComponent(contextId)}`,
      );
      if (!response.ok) throw new Error("Context could not be loaded");
      setActiveScenario((await response.json()) as PublicCalldataScenario);
      setEvaluation(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Context could not be loaded");
    } finally {
      setPending(false);
    }
  }

  function selectCodec(nextCodec: CodecId) {
    setCodecId(nextCodec);
    setEvaluation(null);
    setError(null);
  }

  async function evaluate() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/v1/calldata-compression/evaluations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codecId, contextId: activeScenario.contextId }),
      });
      const payload = (await response.json()) as MeasuredCodecEvaluation & {
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "Evaluation failed");
      setEvaluation(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Evaluation failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="codec-workbench">
      <section className="codec-brief" aria-labelledby="codec-mission-heading">
        <div>
          <p className="eyebrow">The mission</p>
          <h2 id="codec-mission-heading">Send fewer bytes. Spend less gas decoding them.</h2>
          <p>
            Every codec receives the same{" "}
            {activeScenario.batches.reduce((sum, batch) => sum + batch.actionCount, 0)} transfer
            actions in this context. Its Solidity decoder must reproduce the same state digest and
            reject malformed input before either gas axis counts.
          </p>
        </div>
        <dl>
          <div>
            <dt>Public batches</dt>
            <dd>{activeScenario.batches.length}</dd>
          </div>
          <div>
            <dt>Total actions</dt>
            <dd>{activeScenario.batches.reduce((sum, batch) => sum + batch.actionCount, 0)}</dd>
          </div>
          <div>
            <dt>EVM revision</dt>
            <dd>{activeScenario.evmRevision}</dd>
          </div>
        </dl>
      </section>

      <section className="context-selector" aria-labelledby="calldata-context-heading">
        <div>
          <p className="eyebrow">Evaluation context</p>
          <h2 id="calldata-context-heading">Recipient reuse changes which codec is valuable.</h2>
          <p>{activeScenario.contextDescription}</p>
        </div>
        <label>
          Compare within context
          <select
            disabled={pending}
            onChange={(event) =>
              void selectContext(event.target.value as PublicCalldataScenario["contextId"])
            }
            value={activeScenario.contextId}
          >
            {activeScenario.contexts.map((context) => (
              <option key={context.id} value={context.id}>
                {context.name} · Evidence L{context.evidenceLevel}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="codec-picker" aria-label="Compression codecs">
        {activeScenario.codecs.map((codec) => (
          <button
            aria-pressed={codec.id === codecId}
            className={codec.id === codecId ? "codec-option selected" : "codec-option"}
            key={codec.id}
            onClick={() => selectCodec(codec.id)}
            type="button"
          >
            <span>{codec.id === codecId ? "Selected" : "Try codec"}</span>
            <strong>{codec.name}</strong>
            <small>{codec.description}</small>
          </button>
        ))}
      </section>

      <section className="codec-runner" aria-labelledby="codec-runner-heading">
        <div>
          <p className="eyebrow">Real measurement</p>
          <h2 id="codec-runner-heading">Run {selectedCodec.decoderContract} in a Cancun EVM.</h2>
          <p>
            The API encodes every public batch, prices each byte under {activeScenario.calldataRule}
            , and executes checked-in Solidity runtime bytecode in EthereumJS EVM.
          </p>
        </div>
        <button className="primary-action" disabled={pending} onClick={evaluate} type="button">
          {pending ? "Executing EVM…" : "Measure this codec"}
        </button>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      {evaluation ? (
        <section className="codec-result" aria-live="polite">
          <div className="supply-result-heading">
            <div>
              <p className="eyebrow">Measured result</p>
              <h2>
                {evaluation.pareto.frontier
                  ? `${evaluation.codecName} belongs on the frontier.`
                  : `${evaluation.codecName} is dominated.`}
              </h2>
              <p>
                {evaluation.correctness
                  ? "All batches matched the reference digest and malformed input reverted."
                  : evaluation.constraintFailures.join(" · ")}
              </p>
            </div>
            <span
              className={
                evaluation.pareto.frontier ? "result-badge frontier" : "result-badge dominated"
              }
            >
              {evaluation.pareto.frontier ? "Frontier" : "Dominated"}
            </span>
          </div>

          <div className="supply-metrics">
            <article>
              <span>Encoded calldata</span>
              <strong>{formatGas(evaluation.calldataGas)}</strong>
              <small>gas · EIP-2028 bytes</small>
            </article>
            <article>
              <span>Decoder execution</span>
              <strong>{formatGas(evaluation.decodeExecutionGas)}</strong>
              <small>gas · Cancun EVM</small>
            </article>
            <article>
              <span>Correctness gate</span>
              <strong>{evaluation.correctness ? "Pass" : "Fail"}</strong>
              <small>
                {evaluation.malformedInputRejected ? "Malformed input rejected" : "Unsafe decoder"}
              </small>
            </article>
          </div>

          <ContributionPanel contribution={evaluation.contribution} />

          <div className="codec-evidence-grid">
            <CompressionChart
              points={activeScenario.baselinePoints}
              selected={evaluation.codecId}
            />
            <div className="failure-card">
              <p className="eyebrow">Batch evidence</p>
              <h3>Same workload, byte by byte</h3>
              {evaluation.batchEvidence.map((batch) => (
                <div className="codec-batch-row" key={batch.batchId}>
                  <div>
                    <strong>{batch.batchName}</strong>
                    <span>
                      {batch.actionCount} actions · {batch.encodedBytes} bytes
                    </span>
                  </div>
                  <div>
                    <span>{formatGas(batch.calldataGas)} calldata</span>
                    <span>{formatGas(batch.decodeExecutionGas)} decode</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="evidence-footer">
            <span>Result hash</span>
            <code>{evaluation.resultHash}</code>
          </div>
        </section>
      ) : (
        <section className="supply-empty-result">
          <p className="eyebrow">No simulated score</p>
          <h2>Select a codec and execute its real decoder bytecode.</h2>
        </section>
      )}

      <aside className="honesty-note">
        <strong>Codec measurement is live; participant code submission is not configured.</strong>
        <p>
          This practice arena executes three checked-in reference codecs. Sandboxed participant
          compilation, hidden final batches, World ID, and Sepolia rewards remain tournament-layer
          work.
        </p>
      </aside>
    </div>
  );
}
