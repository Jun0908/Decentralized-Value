"use client";

import type { CalldataContextId, CodecId, CodecPoint } from "@frontier/calldata-compression";
import type { CalldataLabEvaluation, CalldataLabPoint } from "@frontier/calldata-compression/lab";
import {
  calldataRulePresets,
  parseCalldataRuleArtifact,
  type CalldataRule,
  type CalldataRuleArtifact,
} from "@frontier/calldata-compression/rules";
import { useState } from "react";
import styles from "./calldata-workbench.module.css";

type PublicCalldataScenario = {
  contextHash: string;
  contextId: CalldataContextId;
  contextName: string;
  contextDescription: string;
  contexts: readonly { id: CalldataContextId; name: string; description: string }[];
  evmRevision: string;
  compiler: { solc: string; evmVersion: string; optimizerRuns: number };
  batches: readonly { id: string; name: string; actionCount: number }[];
  baselinePoints: readonly CodecPoint[];
};

const codecNames: Record<CodecId, string> = {
  abi: "Standard ABI",
  packed: "Fixed-width packed",
  dictionary: "Address dictionary",
};
const number = new Intl.NumberFormat("en-US");
const shortHash = (hash: string) => hash.slice(0, 10) + "…" + hash.slice(-6);

function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function CodecSelect({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: CodecId;
  disabled: boolean;
  onChange: (codec: CodecId) => void;
}) {
  return (
    <label className={styles.field}>
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as CodecId)}
      >
        {Object.entries(codecNames).map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function delta(value: number, baseline: number) {
  const difference = value - baseline;
  return difference === 0
    ? "unchanged"
    : (difference < 0 ? "−" : "+") + number.format(Math.abs(difference)) + " gas";
}

function TradeoffChart({
  candidate,
  baselines,
}: {
  candidate: CalldataLabPoint;
  baselines: readonly CalldataLabPoint[];
}) {
  const points = [...baselines, candidate];
  const maxX = Math.max(...points.map(({ calldataGas }) => calldataGas)) * 1.14;
  const maxY = Math.max(...points.map(({ decodeExecutionGas }) => decodeExecutionGas)) * 1.2;
  return (
    <figure className={styles.chart}>
      <svg role="img" aria-labelledby="calldata-chart-title" viewBox="0 0 520 330">
        <title id="calldata-chart-title">
          Measured calldata and decoder gas. Lower left is better on both independent axes.
        </title>
        <path d="M65 22V276H498" className={styles.axis} />
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <text x={65 + fraction * 405} y="297" textAnchor="middle">
              {number.format(Math.round(maxX * fraction))}
            </text>
            <text x="57" y={279 - fraction * 240} textAnchor="end">
              {number.format(Math.round(maxY * fraction))}
            </text>
          </g>
        ))}
        <text x="282" y="322" textAnchor="middle">
          Calldata gas →
        </text>
        <text x="17" y="160" textAnchor="middle" transform="rotate(-90 17 160)">
          Decoder gas →
        </text>
        {points.map((point, index) => (
          <g
            key={point.id}
            transform={
              "translate(" +
              (65 + (point.calldataGas / maxX) * 405) +
              " " +
              (276 - (point.decodeExecutionGas / maxY) * 240) +
              ")"
            }
          >
            <circle
              r={index === baselines.length ? 9 : 6}
              className={index === baselines.length ? styles.candidateDot : styles.referenceDot}
            />
            <text y={index === baselines.length ? 25 : -14} textAnchor="middle">
              {index === baselines.length ? "Your rules" : point.name.replace("Fixed-width ", "")}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>Lower left is better. A smaller payload can take more gas to decode.</figcaption>
    </figure>
  );
}

function ByteJourney({
  batch,
}: {
  batch: CalldataLabEvaluation["batchEvidence"][number] | undefined;
}) {
  const codecId = batch?.codecId ?? "packed";
  return (
    <div className={styles.journey} data-testid="calldata-byte-journey">
      <div className={styles.journeyHeading}>
        <span className={styles.step}>01</span>
        <h3>Transfer actions</h3>
        <span>{batch ? batch.actions.length + " actions" : "A lossless workload"}</span>
      </div>
      <div className={styles.fields}>
        <span>
          Recipient <b>20 B</b>
        </span>
        <span>
          Amount <b>8 B</b>
        </span>
        <span>
          Nonce <b>4 B</b>
        </span>
      </div>
      <p>
        {batch
          ? batch.selection.uniqueRecipients +
            " unique recipients · " +
            number.format(batch.selection.reusePercent) +
            "% reuse"
          : "Keep every recipient, uint64 amount and uint32 nonce exactly intact."}
      </p>
      <div className={styles.connector} aria-hidden="true">
        ↓
      </div>
      <div className={styles.journeyHeading}>
        <span className={styles.step}>02</span>
        <h3>{codecNames[codecId]}</h3>
      </div>
      {codecId === "abi" ? (
        <div className={styles.packing}>
          <span>64 B header</span>
          <span>32 B recipient</span>
          <span>32 B amount</span>
          <span>32 B nonce</span>
        </div>
      ) : codecId === "dictionary" ? (
        <div className={styles.packing}>
          <span>Address dictionary</span>
          <span>1 B index</span>
          <span>8 B amount</span>
          <span>4 B nonce</span>
        </div>
      ) : (
        <div className={styles.packing}>
          <span>1 B count</span>
          <span>20 B recipient</span>
          <span>8 B amount</span>
          <span>4 B nonce</span>
        </div>
      )}
      <p>
        {codecId === "dictionary"
          ? "Store each address once; each action refers to its one-byte index."
          : codecId === "abi"
            ? "Each field occupies a 32-byte word. Header and padding increase the payload."
            : "Each action uses 32 bytes. A single count byte starts the batch."}
      </p>
      <div className={styles.connector} aria-hidden="true">
        ↓
      </div>
      <div className={styles.journeyHeading}>
        <span className={styles.step}>03</span>
        <h3>{batch ? batch.encodedBytes + " encoded bytes" : "Bytes become calldata"}</h3>
      </div>
      {batch ? (
        <>
          <div
            className={styles.byteBar}
            aria-label={
              batch.zeroBytes + " zero bytes and " + batch.nonZeroBytes + " nonzero bytes"
            }
          >
            <span style={{ flex: batch.zeroBytes }} />
            <span style={{ flex: batch.nonZeroBytes }} />
          </div>
          <p>
            <i className={styles.zeroKey} />
            {batch.zeroBytes} zero × 4 + <i className={styles.nonzeroKey} />
            {batch.nonZeroBytes} nonzero × 16 ={" "}
            <strong>{number.format(batch.calldataGas)} gas</strong>
          </p>
        </>
      ) : (
        <p>Zero byte = 4 gas · nonzero byte = 16 gas. Measure to see the actual payload.</p>
      )}
      <div className={styles.connector} aria-hidden="true">
        ↓
      </div>
      <div className={styles.journeyHeading}>
        <span className={styles.step}>04</span>
        <h3>Cancun EVM → state digest</h3>
      </div>
      <p>
        {batch
          ? number.format(batch.decodeExecutionGas) +
            " execution gas · " +
            (batch.correctness ? "Reference digest matched" : "Correctness failed")
          : "The checked-in Solidity decoder runs locally. Its output must match the reference digest."}
      </p>
      {batch ? <code className={styles.hash}>{batch.digest}</code> : null}
    </div>
  );
}

export function CalldataCompressionDemo({ scenario }: { scenario: PublicCalldataScenario }) {
  const [activeScenario, setActiveScenario] = useState(scenario);
  const [artifact, setArtifact] = useState<CalldataRuleArtifact>(() =>
    parseCalldataRuleArtifact(calldataRulePresets.adaptive),
  );
  const [result, setResult] = useState<CalldataLabEvaluation | null>(null);
  const [previous, setPrevious] = useState<CalldataLabEvaluation | null>(null);
  const [batchIndex, setBatchIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  let artifactError: string | null = null;
  try {
    parseCalldataRuleArtifact(artifact);
  } catch (cause) {
    artifactError = cause instanceof Error ? cause.message : "Invalid rule artifact.";
  }
  const dirty = result !== null && JSON.stringify(artifact) !== JSON.stringify(result.artifact);
  const activeBatch = result?.batchEvidence[batchIndex];
  const abiBaseline = result?.baselines.find(({ point }) => point.id === "reference-abi");

  function updateRule(index: number, patch: Partial<CalldataRule>) {
    setArtifact((value) => ({
      ...value,
      rules: value.rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)),
    }));
    setError(null);
  }

  async function selectContext(contextId: CalldataContextId) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        "/v1/calldata-compression?contextId=" + encodeURIComponent(contextId),
      );
      if (!response.ok) throw new Error("Context could not be loaded. Please retry.");
      setActiveScenario((await response.json()) as PublicCalldataScenario);
      setResult(null);
      setPrevious(null);
      setBatchIndex(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Context could not be loaded.");
    } finally {
      setPending(false);
    }
  }

  async function measure() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/calldata-lab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          artifact: parseCalldataRuleArtifact(artifact),
          contextId: activeScenario.contextId,
        }),
      });
      const payload = (await response.json()) as CalldataLabEvaluation & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "EVM measurement failed.");
      setPrevious(result?.contextHash === payload.contextHash ? result : null);
      setResult(payload);
      setBatchIndex(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "EVM measurement failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.workbench} data-testid="calldata-workbench">
      <section className={styles.brief}>
        <div>
          <p className={styles.eyebrow}>Compression rule lab · Practice</p>
          <h2>
            Your rule.
            <br />
            <em>Every byte counts.</em>
          </h2>
          <p>
            Choose how each transfer batch is packed. Save calldata without making the decoder do
            too much work.
          </p>
        </div>
        <div className={styles.briefAside}>
          <span className={styles.badge}>Local EVM measurement</span>
          <p>
            <strong>
              {activeScenario.batches.reduce((sum, batch) => sum + batch.actionCount, 0)} transfer
              actions
            </strong>
            <br />
            {activeScenario.batches.length} public batches · two independent gas axes
          </p>
          <p>
            Correctness comes first: every reference digest must match and the published malformed
            tests must revert.
          </p>
        </div>
      </section>
      <section className={styles.context}>
        <div>
          <p className={styles.eyebrow}>01 / Fix the workload</p>
          <h3>How often do recipients repeat?</h3>
          <p>{activeScenario.contextDescription}</p>
        </div>
        <label className={styles.field}>
          Evaluation context
          <select
            data-testid="calldata-context"
            disabled={pending}
            value={activeScenario.contextId}
            onChange={(event) => void selectContext(event.target.value as CalldataContextId)}
          >
            {activeScenario.contexts.map((context) => (
              <option key={context.id} value={context.id}>
                {context.name}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section
        className={styles.builder}
        aria-labelledby="calldata-builder-heading"
        data-testid="calldata-builder"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>02 / Build a compression policy</p>
            <h2 id="calldata-builder-heading">Pack according to the batch.</h2>
            <p>
              Rules run from top to bottom. The first match wins; otherwise the fallback is used.
            </p>
          </div>
          <span className={styles.codeLabel}>calldata-rules-v1</span>
        </div>
        <div className={styles.presets} aria-label="Rule starting points">
          {(
            [
              ["adaptive", "Reuse-aware starter"],
              ["abi", "Always ABI"],
              ["packed", "Always packed"],
              ["dictionary", "Always dictionary"],
            ] as const
          ).map(([id, name]) => (
            <button
              className={styles.secondary}
              type="button"
              disabled={pending}
              key={id}
              onClick={() => {
                setArtifact(parseCalldataRuleArtifact(calldataRulePresets[id]));
                setError(null);
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <div className={styles.ruleList}>
          {artifact.rules.map((rule, index) => (
            <fieldset className={styles.rule} key={index} disabled={pending}>
              <legend>Rule {index + 1} · if all conditions match</legend>
              <div className={styles.ruleFields}>
                <label className={styles.field}>
                  At least this many actions
                  <input
                    data-testid={"calldata-rule-min-actions-" + index}
                    type="number"
                    min="1"
                    max="255"
                    value={rule.minActions}
                    onChange={(event) =>
                      updateRule(index, { minActions: Number(event.target.value) })
                    }
                  />
                </label>
                <label className={styles.field}>
                  At most this many actions
                  <input
                    type="number"
                    min="1"
                    max="255"
                    value={rule.maxActions}
                    onChange={(event) =>
                      updateRule(index, { maxActions: Number(event.target.value) })
                    }
                  />
                </label>
                <label className={styles.field}>
                  Recipient reuse at least (%)
                  <input
                    data-testid={"calldata-rule-min-reuse-" + index}
                    type="number"
                    min="0"
                    max="100"
                    value={rule.minReusePercent}
                    onChange={(event) =>
                      updateRule(index, { minReusePercent: Number(event.target.value) })
                    }
                  />
                </label>
                <CodecSelect
                  label="Then encode with"
                  value={rule.codecId}
                  disabled={pending}
                  onChange={(codecId) => updateRule(index, { codecId })}
                />
              </div>
              <div className={styles.ruleFooter}>
                <span>
                  Reuse = (actions − unique recipients) ÷ actions. 10 actions to 2 addresses = 80%.
                </span>
                <div className={styles.actions}>
                  <button
                    className={styles.secondary}
                    type="button"
                    disabled={pending || index === 0}
                    onClick={() =>
                      setArtifact((value) => {
                        const rules = [...value.rules];
                        [rules[index - 1], rules[index]] = [rules[index]!, rules[index - 1]!];
                        return { ...value, rules };
                      })
                    }
                    aria-label={"Move rule " + (index + 1) + " up"}
                  >
                    Move up
                  </button>
                  <button
                    className={styles.secondary}
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      setArtifact((value) => ({
                        ...value,
                        rules: value.rules.filter((_, i) => i !== index),
                      }))
                    }
                    aria-label={"Remove rule " + (index + 1)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </fieldset>
          ))}
          {artifact.rules.length === 0 ? (
            <p className={styles.emptyRules}>No conditions: every batch uses the fallback codec.</p>
          ) : null}
        </div>
        <div className={styles.fallback}>
          <button
            type="button"
            className={styles.secondary}
            disabled={pending || artifact.rules.length >= 4}
            data-testid="calldata-add-rule"
            onClick={() =>
              setArtifact((value) => ({
                ...value,
                rules: [
                  ...value.rules,
                  { minActions: 1, maxActions: 255, minReusePercent: 0, codecId: "packed" },
                ],
              }))
            }
          >
            + Add rule ({artifact.rules.length}/4)
          </button>
          <CodecSelect
            label="Fallback when no rule matches"
            value={artifact.fallbackCodec}
            disabled={pending}
            onChange={(fallbackCodec) => setArtifact((value) => ({ ...value, fallbackCodec }))}
          />
        </div>
        <details className={styles.details}>
          <summary>Review the editable artifact as JSON</summary>
          <p>
            This JSON is the exact bounded rule artifact sent for measurement. Change the controls
            above to revise it.
          </p>
          <pre>{JSON.stringify(artifact, null, 2)}</pre>
          <button
            className={styles.secondary}
            type="button"
            data-testid="calldata-artifact-download"
            disabled={artifactError !== null}
            onClick={() => downloadJson("calldata-rules-v1.json", artifact)}
          >
            Download rule artifact
          </button>
        </details>
        {artifactError ? (
          <p className={styles.error} role="alert">
            {artifactError}
          </p>
        ) : null}
        <div className={styles.runBar}>
          <div>
            <strong>
              {dirty ? "Rules changed. Measure this revision." : "Ready to test every batch."}
            </strong>
            <p>
              The host selects a checked-in codec; the EVM measures its decoder. No wallet or
              payment.
            </p>
          </div>
          <button
            className={styles.primary}
            data-testid="calldata-measure"
            disabled={pending || artifactError !== null}
            onClick={() => void measure()}
            type="button"
          >
            {pending ? "Measuring in EVM…" : "Measure my rules →"}
          </button>
        </div>
      </section>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <div role="status" className={styles.status}>
        {pending
          ? "Running the selected decoders and reference baselines in the same local Cancun EVM context."
          : dirty
            ? "Below is the last measured revision. Run again to evaluate your edits."
            : ""}
      </div>
      {result && abiBaseline ? (
        <section
          className={styles.result}
          data-testid="calldata-result"
          aria-labelledby="calldata-result-heading"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>
                03 / Measured revision · {shortHash(result.artifactHash)}
              </p>
              <h2 id="calldata-result-heading">
                {!result.point.correctness
                  ? "Correctness gate failed."
                  : result.pareto.frontier
                    ? "A useful tradeoff against the references."
                    : "A reference uses no more gas on either axis."}
              </h2>
              <p>
                {result.point.correctness
                  ? "Every batch matched its reference digest. All published malformed tests for the selected codecs reverted."
                  : result.constraintFailures.join(" ")}
              </p>
            </div>
            <span className={styles.badge}>
              {!result.point.correctness
                ? "Gate failed"
                : result.pareto.frontier
                  ? "On this frontier"
                  : "Dominated"}
            </span>
          </div>
          <div className={styles.metrics}>
            <article>
              <span>Calldata gas ↓</span>
              <strong>{number.format(result.point.calldataGas)}</strong>
              <small>{delta(result.point.calldataGas, abiBaseline.point.calldataGas)} vs ABI</small>
            </article>
            <article>
              <span>Decoder gas ↓</span>
              <strong>{number.format(result.point.decodeExecutionGas)}</strong>
              <small>
                {delta(result.point.decodeExecutionGas, abiBaseline.point.decodeExecutionGas)} vs
                ABI
              </small>
            </article>
            <article>
              <span>Encoded payload</span>
              <strong>
                {number.format(result.encodedBytes)} <small>B</small>
              </strong>
              <small>
                {result.batchEvidence.length} batches · correctness{" "}
                {result.point.correctness ? "passed" : "failed"}
              </small>
            </article>
          </div>
          <div className={styles.comparisonGrid}>
            <div>
              <h3>Compare the same context</h3>
              <p>
                Two independent costs, no weighted score. These references are rerun with your
                artifact.
              </p>
              <div
                className={styles.comparison}
                role="table"
                aria-label="Calldata same-context comparison"
              >
                <div className={styles.comparisonHeader} role="row">
                  <span role="columnheader">Policy</span>
                  <span role="columnheader">Calldata gas ↓</span>
                  <span role="columnheader">Decoder gas ↓</span>
                </div>
                {[
                  ...result.baselines.map(({ point }) => point),
                  result.point,
                  ...(previous
                    ? [{ ...previous.point, id: "previous-revision", name: "Previous revision" }]
                    : []),
                ].map((point) => (
                  <div
                    role="row"
                    className={point === result.point ? styles.currentRow : styles.comparisonRow}
                    key={point.id}
                  >
                    <strong role="cell">
                      {point.name}
                      {point.correctness ? "" : " · gate failed"}
                    </strong>
                    <span role="cell">{number.format(point.calldataGas)}</span>
                    <span role="cell">{number.format(point.decodeExecutionGas)}</span>
                  </div>
                ))}
              </div>
              {previous ? (
                <p data-testid="calldata-previous-comparison">
                  Since the previous revision: calldata{" "}
                  {delta(result.point.calldataGas, previous.point.calldataGas)}; decoder{" "}
                  {delta(result.point.decodeExecutionGas, previous.point.decodeExecutionGas)}.
                </p>
              ) : (
                <p>
                  Measure another revision to compare it here. Switching contexts clears revision
                  comparisons.
                </p>
              )}
            </div>
            <TradeoffChart
              candidate={result.point}
              baselines={result.baselines.map(({ point }) => point)}
            />
          </div>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>04 / Follow the bytes</p>
              <h2>From transfers to the same state.</h2>
            </div>
          </div>
          <div className={styles.batchTabs} aria-label="Inspect a measured batch">
            {result.batchEvidence.map((batch, index) => (
              <button
                className={index === batchIndex ? styles.selected : styles.secondary}
                aria-pressed={index === batchIndex}
                type="button"
                data-testid={"calldata-batch-" + index}
                key={batch.batchId}
                onClick={() => setBatchIndex(index)}
              >
                {batch.batchName}
              </button>
            ))}
          </div>
          <div className={styles.evidenceGrid}>
            <ByteJourney batch={activeBatch} />
            <div className={styles.batchEvidence}>
              <p className={styles.eyebrow}>Batch decision</p>
              <h3>{activeBatch ? codecNames[activeBatch.codecId] : ""}</h3>
              <p>
                {activeBatch?.selection.reason}{" "}
                {activeBatch
                  ? activeBatch.selection.actionCount +
                    " actions, " +
                    number.format(activeBatch.selection.reusePercent) +
                    "% recipient reuse."
                  : ""}
              </p>
              <p>
                The rule selects the format before encoding. Each byte shown below is part of the
                measured payload.
              </p>
              {activeBatch ? (
                <>
                  <details className={styles.details}>
                    <summary>Original transfer actions ({activeBatch.actions.length})</summary>
                    {activeBatch.actions.map((action, index) => (
                      <div className={styles.actionRow} key={index}>
                        <strong>Action {index + 1}</strong>
                        <code>{action.recipient}</code>
                        <span>
                          Amount {action.amount} · Nonce {action.nonce}
                        </span>
                      </div>
                    ))}
                  </details>
                  <details className={styles.details}>
                    <summary>Exact encoded payload · {activeBatch.encodedBytes} bytes</summary>
                    <code className={styles.payload}>{activeBatch.encoded}</code>
                    {activeBatch.dictionary.length ? (
                      <p>
                        Dictionary index order:{" "}
                        {activeBatch.dictionary
                          .map((address, index) => index + " → " + shortHash(address))
                          .join("; ")}
                      </p>
                    ) : null}
                  </details>
                  <details className={styles.details}>
                    <summary>Digest equality and malformed tests</summary>
                    <p>Expected digest</p>
                    <code className={styles.hash}>{activeBatch.referenceDigest}</code>
                    <p>EVM returned</p>
                    <code className={styles.hash}>{activeBatch.digest}</code>
                    {result.malformedEvidence.map(({ codecId, tests }) => (
                      <div key={codecId}>
                        <h4>{codecNames[codecId]}</h4>
                        {tests.map((test) => (
                          <p key={test.id}>
                            {test.rejected ? "PASS" : "FAIL"} · {test.id}
                          </p>
                        ))}
                      </div>
                    ))}
                    <p>
                      This published test corpus is bounded. It is not proof of rejection of every
                      possible invalid payload.
                    </p>
                  </details>
                </>
              ) : null}
            </div>
          </div>
          <details className={styles.details}>
            <summary>Measurement context and gas accounting</summary>
            <p>
              Solc {result.context.compiler.solc} · optimizer{" "}
              {result.context.compiler.optimizerRuns} · Cancun · EthereumJS EVM{" "}
              {result.context.evm.version}
            </p>
            <p>
              {result.context.accounting.calldata} {result.context.accounting.decoder}
            </p>
            <p>{result.context.accounting.exclusions}</p>
            <p>Rule evaluation context</p>
            <code className={styles.hash}>{result.contextHash}</code>
            <p>Result hash</p>
            <code className={styles.hash}>{result.resultHash}</code>
            <p>
              This rule-lab context commits the rule semantics, workload, runtime hashes, malformed
              corpus, and gas accounting. It is separate from the original reference-codec API
              context.
            </p>
          </details>
          <div className={styles.exportBar}>
            <div>
              <strong>Take this experiment with you.</strong>
              <p>
                Artifact, exact bytes, reference runs, context and result hash in one JSON file.
              </p>
            </div>
            <button
              className={styles.secondary}
              data-testid="calldata-evidence-download"
              type="button"
              onClick={() =>
                downloadJson(
                  "calldata-evidence-" + result.artifactHash.slice(2, 10) + ".json",
                  result,
                )
              }
            >
              Download measured evidence
            </button>
          </div>
        </section>
      ) : (
        <section className={styles.beforeRun}>
          <div>
            <p className={styles.eyebrow}>Follow the bytes</p>
            <h2>
              A smaller message.
              <br />
              The exact same meaning.
            </h2>
            <p>
              The starter uses a dictionary for repeated addresses and fixed-width packing
              elsewhere. Measure it to see actual selections, payloads, and EVM gas for every batch.
            </p>
            <p>
              After a run, edit the reuse threshold or fallback and compare your next revision
              against the same ABI baseline.
            </p>
          </div>
          <ByteJourney batch={undefined} />
        </section>
      )}
      <aside className={styles.boundary}>
        <strong>Editable rules · checked-in codecs · Practice evidence</strong>
        <p>
          Rules choose among three fixed encoders and Solidity decoders. Host selection and encoding
          cost are excluded; there is no onchain format dispatcher. Arbitrary source compilation,
          hidden final batches, persistent submissions, and reward settlement are not configured.
        </p>
      </aside>
    </div>
  );
}
