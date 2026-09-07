"use client";

import type { SupplyAllocation, SupplyEvaluation, SupplyPoint } from "@frontier/emergency-supply";
import { useState } from "react";
import { ContributionPanel } from "@/components/contribution-panel";

type PublicScenario = {
  arenaId: string;
  name: string;
  dataVersion: string;
  currency: string;
  targetKits: number;
  contextHash: string;
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

const initialAllocation: SupplyAllocation = {
  "harbor-aid": 300,
  northstar: 150,
  "inland-works": 300,
  "local-grid": 150,
  airbridge: 100,
};

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
  const [allocation, setAllocation] = useState<SupplyAllocation>(initialAllocation);
  const [evaluation, setEvaluation] = useState<MeasuredEvaluation | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = Object.values(allocation).reduce((sum, amount) => sum + amount, 0);

  function applyStrategy(strategy: PublicScenario["strategies"][number]) {
    setAllocation({ ...strategy.allocation });
    setEvaluation(null);
    setError(null);
  }

  function updateAllocation(vendorId: string, value: string) {
    const parsed = Number(value);
    setAllocation((current) => ({
      ...current,
      [vendorId]: Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0,
    }));
    setEvaluation(null);
    setError(null);
  }

  async function evaluate() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/v1/emergency-supply/evaluations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ allocations: allocation }),
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
    <div className="supply-workbench">
      <section className="supply-brief" aria-labelledby="mission-heading">
        <div>
          <p className="eyebrow">The mission</p>
          <h2 id="mission-heading">
            Allocate exactly {scenario.targetKits.toLocaleString()} kits.
          </h2>
          <p>
            Every supplier and every delivery route can fail once. Spend less, but keep as many kits
            moving as possible in the worst case.
          </p>
        </div>
        <dl>
          <div>
            <dt>Public vendors</dt>
            <dd>{scenario.vendors.length}</dd>
          </div>
          <div>
            <dt>Failures tested</dt>
            <dd>{scenario.failures.length}</dd>
          </div>
          <div>
            <dt>Data version</dt>
            <dd>{scenario.dataVersion}</dd>
          </div>
        </dl>
      </section>

      <section className="strategy-strip" aria-label="Example strategies">
        {scenario.strategies.map((strategy) => (
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

      <section className="supply-builder" aria-labelledby="allocation-heading">
        <div className="allocation-panel">
          <div className="builder-heading">
            <div>
              <p className="eyebrow">Your allocation</p>
              <h2 id="allocation-heading">Choose how many kits each supplier receives.</h2>
            </div>
            <div
              className={
                total === scenario.targetKits
                  ? "allocation-total valid"
                  : "allocation-total invalid"
              }
            >
              <span>Allocated</span>
              <strong>
                {total.toLocaleString()} / {scenario.targetKits.toLocaleString()}
              </strong>
            </div>
          </div>

          <div className="vendor-grid">
            {scenario.vendors.map((vendor) => {
              const amount = allocation[vendor.id] ?? 0;
              return (
                <label className="vendor-card" key={vendor.id}>
                  <span className="vendor-title">
                    <strong>{vendor.name}</strong>
                    <small>{vendor.routeName}</small>
                  </span>
                  <span className="vendor-price">
                    {formatMoney(vendor.unitCost, scenario.currency)} <small>/ kit</small>
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
              {pending ? "Testing every failure…" : "Evaluate this allocation"}
            </button>
            <span>The API recalculates all metrics from your numbers.</span>
          </div>
        </div>

        <aside className="supply-rules">
          <p className="eyebrow">Hard constraints</p>
          <h3>Every valid plan follows the same rules.</h3>
          <ul>
            <li>Allocate exactly {scenario.targetKits.toLocaleString()} whole kits.</li>
            <li>Do not exceed a supplier&apos;s capacity.</li>
            <li>Use only the published suppliers and routes.</li>
            <li>Pass all {scenario.failures.length} single-failure cases.</li>
          </ul>
          <p className="hash">context {scenario.contextHash}</p>
        </aside>
      </section>

      <section className={`supply-result ${evaluation ? "revealed" : ""}`} aria-live="polite">
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
                <strong>{formatMoney(evaluation.totalProcurementCost, scenario.currency)}</strong>
                <small>Lower is better</small>
              </article>
              <article>
                <span>Worst-case delivery</span>
                <strong>{evaluation.worstCaseDeliveredKits.toLocaleString()}</strong>
                <small>Higher is better · of {scenario.targetKits.toLocaleString()} kits</small>
              </article>
              <article>
                <span>Correctness</span>
                <strong>Pass</strong>
                <small>{evaluation.failureOutcomes.length} failures measured</small>
              </article>
            </div>

            <ContributionPanel contribution={evaluation.contribution} />

            <div className="supply-evidence-grid">
              <SupplyFrontierChart baselines={scenario.baselinePoints} evaluation={evaluation} />
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
              <span>Result hash</span>
              <code>{evaluation.resultHash}</code>
            </div>
          </>
        )}
      </section>

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
