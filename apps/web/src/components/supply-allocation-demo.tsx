"use client";

import {
  emergencySupplyDemoAllocation,
  type SupplyAllocation,
  type SupplyEvaluation,
  type SupplyPoint,
} from "@frontier/emergency-supply";
import { useEffect, useRef, useState } from "react";
import { AgentCompetitionReplay } from "@/components/agent-competition-replay";
import { ContributionPanel } from "@/components/contribution-panel";

type PublicScenario = {
  arenaId: string;
  name: string;
  dataVersion: string;
  currency: string;
  targetKits: number;
  contextHash: string;
  contextId: "public-normal-operations" | "public-port-constrained";
  contextName: string;
  contextDescription: string;
  evidenceLevel: 0;
  contexts: readonly {
    id: "public-normal-operations" | "public-port-constrained";
    name: string;
    description: string;
    contextHash: string;
    evidenceLevel: 0;
  }[];
  vendors: readonly {
    id: string;
    name: string;
    unitCost: number;
    capacity: number;
    routeId: string;
    routeName: string;
  }[];
  failures: readonly { id: string; name: string }[];
  strategies: readonly {
    id: string;
    name: string;
    description: string;
    allocation: Readonly<SupplyAllocation>;
  }[];
  baselinePoints: readonly SupplyPoint[];
  settlement: {
    state: string;
    network: string;
    rewardToken: null;
  };
};

type MeasuredEvaluation = SupplyEvaluation & { state: "measured" };

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function SupplyFrontierChart({
  baselines,
  evaluation,
}: {
  baselines: readonly SupplyPoint[];
  evaluation: MeasuredEvaluation | null;
}) {
  const points = evaluation?.correctness
    ? [
        ...baselines,
        {
          id: "candidate",
          name: "Your allocation",
          totalProcurementCost: evaluation.totalProcurementCost,
          worstCaseDeliveredKits: evaluation.worstCaseDeliveredKits,
        },
      ]
    : [...baselines];
  const costs = points.map((point) => point.totalProcurementCost);
  const deliveries = points.map((point) => point.worstCaseDeliveredKits);
  const minCost = Math.min(...costs) - 2_000;
  const maxCost = Math.max(...costs) + 2_000;
  const minDelivery = Math.max(0, Math.min(...deliveries) - 50);
  const maxDelivery = Math.min(1_000, Math.max(...deliveries) + 100);
  const x = (cost: number) => 70 + ((cost - minCost) / (maxCost - minCost || 1)) * 430;
  const y = (delivery: number) =>
    275 - ((delivery - minDelivery) / (maxDelivery - minDelivery || 1)) * 225;

  return (
    <figure className="chart-card supply-chart">
      <svg aria-labelledby="supply-chart-title" role="img" viewBox="0 0 560 330">
        <title id="supply-chart-title">Cost and worst-case delivery frontier</title>
        <path className="axis" d="M70 35V275H520" />
        <text className="axis-label" x="300" y="318">
          Total cost → lower is better
        </text>
        <text className="axis-label" transform="rotate(-90 18 175)" x="18" y="175">
          Worst-case delivered → higher is better
        </text>
        {points.map((point) => {
          const candidate = point.id === "candidate";
          return (
            <g
              key={point.id}
              transform={`translate(${x(point.totalProcurementCost)} ${y(point.worstCaseDeliveredKits)})`}
            >
              <circle
                className={candidate ? "supply-candidate" : "frontier"}
                r={candidate ? 9 : 7}
              />
              <text className="point-label" textAnchor="middle" y={candidate ? -16 : -13}>
                {point.name}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption>Move toward the upper-left: lower cost and more kits delivered.</figcaption>
    </figure>
  );
}

export function SupplyAllocationDemo({ scenario }: { scenario: PublicScenario }) {
  const [activeScenario, setActiveScenario] = useState(scenario);
  const [allocation, setAllocation] = useState<SupplyAllocation>({
    ...emergencySupplyDemoAllocation,
  });
  const [evaluation, setEvaluation] = useState<MeasuredEvaluation | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLElement>(null);
  const total = Object.values(allocation).reduce((sum, amount) => sum + amount, 0);

  useEffect(() => {
    if (!evaluation && !error) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [evaluation, error]);

  async function selectContext(contextId: PublicScenario["contextId"]) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/v1/emergency-supply?contextId=${encodeURIComponent(contextId)}`,
      );
      if (!response.ok) throw new Error("Context could not be loaded");
      const nextScenario = (await response.json()) as PublicScenario;
      setActiveScenario(nextScenario);
      setAllocation({ ...nextScenario.strategies[1]!.allocation });
      setEvaluation(null);
      setCopied(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Context could not be loaded");
    } finally {
      setPending(false);
    }
  }

  function applyStrategy(strategy: PublicScenario["strategies"][number]) {
    setAllocation({ ...strategy.allocation });
    setEvaluation(null);
    setError(null);
    setCopied(false);
  }

  function updateAllocation(vendorId: string, value: string) {
    const parsed = Number(value);
    setAllocation((current) => ({
      ...current,
      [vendorId]: Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0,
    }));
    setEvaluation(null);
    setError(null);
    setCopied(false);
  }

  async function copyReproductionRequest() {
    const payload = JSON.stringify({
      allocations: allocation,
      contextId: activeScenario.contextId,
    });
    const curl = `curl -X POST "${window.location.origin}/v1/emergency-supply/evaluations" -H "content-type: application/json" --data '${payload}'`;
    try {
      await navigator.clipboard.writeText(curl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function evaluate() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/v1/emergency-supply/evaluations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ allocations: allocation, contextId: activeScenario.contextId }),
      });
      const payload = (await response.json()) as MeasuredEvaluation & {
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

  const worstOutcomes = evaluation
    ? evaluation.failureOutcomes.filter(
        (outcome) => outcome.deliveredKits === evaluation.worstCaseDeliveredKits,
      )
    : [];

  return (
    <div className="supply-workbench" id="workbench">
      <section className="supply-brief" aria-labelledby="mission-heading">
        <div>
          <p className="eyebrow">The mission</p>
          <h2 id="mission-heading">
            Allocate exactly {activeScenario.targetKits.toLocaleString()} kits.
          </h2>
          <p>
            Every supplier and every delivery route can fail once. Spend less, but keep as many kits
            moving as possible in the worst case.
          </p>
        </div>
        <dl>
          <div>
            <dt>Public vendors</dt>
            <dd>{activeScenario.vendors.length}</dd>
          </div>
          <div>
            <dt>Failures tested</dt>
            <dd>{activeScenario.failures.length}</dd>
          </div>
          <div>
            <dt>Data version</dt>
            <dd>{activeScenario.dataVersion}</dd>
          </div>
        </dl>
      </section>

      <section className="strategy-strip" aria-label="Example strategies">
        {activeScenario.strategies.map((strategy) => (
          <button
            className="strategy-button"
            key={strategy.id}
            onClick={() => applyStrategy(strategy)}
            type="button"
          >
            <strong>{strategy.name}</strong>
            <span>{strategy.description}</span>
          </button>
        ))}
      </section>

      <section className="supply-builder golden-builder" aria-labelledby="allocation-heading">
        <div className="allocation-panel">
          <div className="builder-heading">
            <div>
              <p className="eyebrow">Your allocation</p>
              <h2 id="allocation-heading">Choose how many kits each supplier receives.</h2>
            </div>
            <div
              className={
                total === activeScenario.targetKits
                  ? "allocation-total valid"
                  : "allocation-total invalid"
              }
            >
              <span>Allocated</span>
              <strong>
                {total.toLocaleString()} / {activeScenario.targetKits.toLocaleString()}
              </strong>
            </div>
          </div>

          <div className="vendor-grid">
            {activeScenario.vendors.map((vendor) => {
              const amount = allocation[vendor.id] ?? 0;
              return (
                <label className="vendor-card" key={vendor.id}>
                  <span className="vendor-title">
                    <strong>{vendor.name}</strong>
                    <small>{vendor.routeName}</small>
                  </span>
                  <span className="vendor-price">
                    {formatMoney(vendor.unitCost, activeScenario.currency)} <small>/ kit</small>
                  </span>
                  <input
                    aria-label={`${vendor.name} kit allocation`}
                    max={vendor.capacity}
                    min={0}
                    onChange={(event) => updateAllocation(vendor.id, event.target.value)}
                    step={1}
                    type="number"
                    value={amount}
                  />
                  <span className={amount > vendor.capacity ? "capacity over" : "capacity"}>
                    Capacity {vendor.capacity.toLocaleString()}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="demo-action-row">
            <button disabled={pending} onClick={evaluate} type="button">
              {pending ? "Testing every failure…" : "Evaluate allocation"}
            </button>
            <span>
              One click recalculates 9 failures, 2 axes, contribution, and the result hash.
            </span>
          </div>
        </div>
      </section>

      <details className="supply-details">
        <summary>Evaluation context and hard constraints</summary>
        <div className="supply-details-grid">
          <section className="context-selector" aria-labelledby="supply-context-heading">
            <div>
              <p className="eyebrow">Evaluation context</p>
              <h2 id="supply-context-heading">Same allocation, different operating conditions.</h2>
              <p>{activeScenario.contextDescription}</p>
            </div>
            <label>
              Compare within context
              <select
                disabled={pending}
                onChange={(event) =>
                  void selectContext(event.target.value as PublicScenario["contextId"])
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
          <aside className="supply-rules">
            <p className="eyebrow">Hard constraints</p>
            <h3>Every valid plan follows the same rules.</h3>
            <ul>
              <li>Allocate exactly {activeScenario.targetKits.toLocaleString()} whole kits.</li>
              <li>Do not exceed a supplier&apos;s capacity.</li>
              <li>Use only the published suppliers and routes.</li>
              <li>Pass all {activeScenario.failures.length} single-failure cases.</li>
            </ul>
            <p className="hash">context {activeScenario.contextHash}</p>
          </aside>
        </div>
      </details>

      <section
        className={`supply-result ${evaluation ? "revealed" : ""}`}
        ref={resultRef}
        aria-live="polite"
      >
        {error ? (
          <div>
            <p className="eyebrow status-bad">Evaluation unavailable</p>
            <h2>The allocation could not be measured.</h2>
            <p>{error}</p>
          </div>
        ) : !evaluation ? (
          <div className="result-placeholder">
            <p className="eyebrow">Your measured result appears here</p>
            <h2>Set an allocation, then test every supplier and route failure.</h2>
          </div>
        ) : !evaluation.correctness ? (
          <div>
            <p className="eyebrow status-bad">Hard constraints failed</p>
            <h2>This plan cannot enter the frontier.</h2>
            <ul className="constraint-errors">
              {evaluation.constraintFailures.map((failure) => (
                <li key={failure}>{failure}</li>
              ))}
            </ul>
            <p className="zero-reward">
              Practice reward preview: <strong>0 credits</strong>
            </p>
            <button onClick={() => void copyReproductionRequest()} type="button">
              {copied ? "Reproduction curl copied" : "Reproduce this result"}
            </button>
          </div>
        ) : (
          <>
            <div className="supply-result-heading">
              <div>
                <p className="eyebrow">Measured result</p>
                <h2>
                  {evaluation.pareto.frontier
                    ? "This allocation belongs on the frontier."
                    : "A baseline beats this allocation on both axes."}
                </h2>
                <p>
                  Worst case: {worstOutcomes.map((outcome) => outcome.scenarioName).join(", ")}. The
                  evaluator enumerated every published single failure.
                </p>
              </div>
              <span
                className={
                  evaluation.pareto.frontier
                    ? "large-status status-good"
                    : "large-status status-bad"
                }
              >
                {evaluation.pareto.frontier ? "Frontier" : "Dominated"}
              </span>
            </div>

            <div className="supply-metrics">
              <article>
                <span>Total procurement cost</span>
                <strong>
                  {formatMoney(evaluation.totalProcurementCost, activeScenario.currency)}
                </strong>
                <small>Lower is better</small>
              </article>
              <article>
                <span>Worst-case delivery</span>
                <strong>{evaluation.worstCaseDeliveredKits.toLocaleString()}</strong>
                <small>
                  Higher is better · of {activeScenario.targetKits.toLocaleString()} kits
                </small>
              </article>
              <article>
                <span>Correctness</span>
                <strong>Pass</strong>
                <small>{evaluation.failureOutcomes.length} failures measured</small>
              </article>
            </div>

            <ContributionPanel contribution={evaluation.contribution} />

            <div className="supply-evidence-grid">
              <SupplyFrontierChart
                baselines={activeScenario.baselinePoints}
                evaluation={evaluation}
              />
              <div className="failure-table">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Failure evidence</p>
                    <h3>Every scenario, not a probability estimate</h3>
                  </div>
                </div>
                {[...evaluation.failureOutcomes]
                  .sort((left, right) => left.deliveredKits - right.deliveredKits)
                  .map((outcome) => (
                    <div className="failure-row" key={outcome.scenarioId}>
                      <span>{outcome.scenarioName}</span>
                      <strong>{outcome.deliveredKits.toLocaleString()} delivered</strong>
                    </div>
                  ))}
              </div>
            </div>

            {evaluation.pareto.dominatedBy.length > 0 ? (
              <p className="comparison-note">
                Dominated by: {evaluation.pareto.dominatedBy.map((point) => point.name).join(", ")}.
              </p>
            ) : null}
            {evaluation.pareto.improvesOver.length > 0 ? (
              <p className="comparison-note status-good">
                Strictly improves over:{" "}
                {evaluation.pareto.improvesOver.map((point) => point.name).join(", ")}.
              </p>
            ) : null}
            <div className="evidence-footer">
              <div>
                <span>Context hash</span>
                <code>{evaluation.contextHash}</code>
              </div>
              <div>
                <span>Result hash</span>
                <code>{evaluation.resultHash}</code>
              </div>
              <button onClick={() => void copyReproductionRequest()} type="button">
                {copied ? "Reproduction curl copied" : "Reproduce this result"}
              </button>
            </div>
          </>
        )}
      </section>

      <AgentCompetitionReplay />

      <section className="notice">
        <span className="signal" />
        <div>
          <strong>Measurement is live; tournament settlement is not configured.</strong>
          <p>
            This practice evaluation is calculated from your input. World ID registration, the
            final-day workload, and Sepolia token distribution remain separate deployment steps; no
            reward transaction is being claimed here.
          </p>
        </div>
      </section>
    </div>
  );
}
