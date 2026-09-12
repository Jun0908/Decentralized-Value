"use client";

import type {
  DispatchAllocation,
  DispatchEvaluation,
  DispatchPoint,
} from "@frontier/microgrid-dispatch";
import { useState } from "react";
import { ContributionPanel } from "@/components/contribution-panel";
import { MicrogridDayPractice } from "@/components/microgrid-day-practice";
import styles from "./microgrid-day-practice.module.css";

type Metric = {
  key: "totalCost" | "worstCaseEnergy" | "carbonGrams";
  name: string;
  direction: "MINIMIZE" | "MAXIMIZE";
  unit: string;
  lowerBound: number;
  upperBound: number;
};

type PublicScenario = {
  targetEnergy: number;
  dataVersion: string;
  contextHash: string;
  evidenceLevel: 0;
  sources: readonly {
    id: string;
    name: string;
    unitCost: number;
    capacity: number;
    carbonPerMwh: number;
  }[];
  strategies: readonly {
    id: string;
    name: string;
    allocation: Readonly<DispatchAllocation>;
  }[];
  axes: readonly Metric[];
  baselinePoints: readonly DispatchPoint[];
};

type MeasuredEvaluation = DispatchEvaluation & { state: "measured" };

const initialAllocation = { solar: 25, wind: 25, grid: 25, battery: 25 };

function metricValue(point: DispatchPoint, key: Metric["key"]) {
  return point[key];
}

function MultiAxisChart({
  scenario,
  evaluation,
  xMetric,
  yMetric,
}: {
  scenario: PublicScenario;
  evaluation: MeasuredEvaluation | null;
  xMetric: Metric;
  yMetric: Metric;
}) {
  const points: DispatchPoint[] = [...scenario.baselinePoints];
  if (evaluation?.correctness) {
    points.push({
      id: "candidate",
      name: "Your dispatch",
      totalCost: evaluation.totalCost,
      worstCaseEnergy: evaluation.worstCaseEnergy,
      carbonGrams: evaluation.carbonGrams,
    });
  }
  const desirability = (value: number, metric: Metric) => {
    const ratio = (value - metric.lowerBound) / (metric.upperBound - metric.lowerBound);
    return metric.direction === "MAXIMIZE" ? ratio : 1 - ratio;
  };
  const x = (point: DispatchPoint) =>
    500 - desirability(metricValue(point, xMetric.key), xMetric) * 420;
  const y = (point: DispatchPoint) =>
    275 - desirability(metricValue(point, yMetric.key), yMetric) * 220;

  return (
    <figure className="chart-card microgrid-chart">
      <svg aria-labelledby="microgrid-chart-title" role="img" viewBox="0 0 560 330">
        <title id="microgrid-chart-title">
          {xMetric.name} and {yMetric.name} projection of the three-axis frontier
        </title>
        <path className="axis" d="M70 35V275H520" />
        <text className="axis-label" x="300" y="318">
          {xMetric.name} → better to the left
        </text>
        <text className="axis-label" transform="rotate(-90 18 175)" x="18" y="175">
          {yMetric.name} → better upward
        </text>
        {points.map((point) => (
          <g key={point.id} transform={`translate(${x(point)} ${y(point)})`}>
            <circle className={point.id === "candidate" ? "supply-candidate" : "frontier"} r={8} />
            <text className="point-label" textAnchor="middle" y={-14}>
              {point.name}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>
        This is a two-axis view only. Pareto and contribution calculations still use all three
        metrics.
      </figcaption>
    </figure>
  );
}

export function MicrogridDispatchDemo({ scenario }: { scenario: PublicScenario }) {
  const [mode, setMode] = useState<"day" | "classic">("day");
  return (
    <div className={styles.workbench} data-testid="microgrid-workbench">
      <div className={styles.modeSwitch} aria-label="Microgrid practice mode">
        <button
          type="button"
          data-testid="microgrid-mode-day"
          aria-pressed={mode === "day"}
          onClick={() => setMode("day")}
        >
          Day strategy
        </button>
        <button
          type="button"
          data-testid="microgrid-mode-classic"
          aria-pressed={mode === "classic"}
          onClick={() => setMode("classic")}
        >
          Classic mix
        </button>
      </div>
      {mode === "day" ? (
        <MicrogridDayPractice />
      ) : (
        <>
          <p className={styles.boundary}>
            Classic v1 · Static 100 MWh allocation, worst-case source loss and lifecycle carbon.
            This mode keeps its original evaluator and API context.
          </p>
          <MicrogridClassicDemo scenario={scenario} />
        </>
      )}
    </div>
  );
}

function MicrogridClassicDemo({ scenario }: { scenario: PublicScenario }) {
  const [allocation, setAllocation] = useState<DispatchAllocation>(initialAllocation);
  const [evaluation, setEvaluation] = useState<MeasuredEvaluation | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xKey, setXKey] = useState<Metric["key"]>("totalCost");
  const [yKey, setYKey] = useState<Metric["key"]>("worstCaseEnergy");
  const total = Object.values(allocation).reduce((sum, value) => sum + value, 0);
  const xMetric = scenario.axes.find(({ key }) => key === xKey)!;
  const yMetric = scenario.axes.find(({ key }) => key === yKey)!;

  async function evaluate() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/v1/microgrid-dispatch/evaluations", {
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

  return (
    <div className="microgrid-workbench">
      <section className="supply-brief">
        <div>
          <p className="eyebrow">Three-axis practice</p>
          <h2>Dispatch exactly {scenario.targetEnergy} MWh.</h2>
          <p>Balance cost, energy remaining after one source fails, and lifecycle carbon.</p>
        </div>
        <dl>
          <div>
            <dt>Metrics</dt>
            <dd>{scenario.axes.length}</dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>L{scenario.evidenceLevel}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>{scenario.dataVersion}</dd>
          </div>
        </dl>
      </section>

      <section className="strategy-strip" aria-label="Example dispatches">
        {scenario.strategies.map((strategy) => (
          <button
            className="strategy-button"
            key={strategy.id}
            onClick={() => {
              setAllocation({ ...strategy.allocation });
              setEvaluation(null);
            }}
            type="button"
          >
            <strong>{strategy.name}</strong>
            <span>Load this public baseline</span>
          </button>
        ))}
      </section>

      <section className="microgrid-inputs">
        <div className="builder-heading">
          <div>
            <p className="eyebrow">Your dispatch</p>
            <h2>Choose the energy mix.</h2>
          </div>
          <strong className={total === scenario.targetEnergy ? "status-good" : "status-bad"}>
            {total} / {scenario.targetEnergy} MWh
          </strong>
        </div>
        <div className="vendor-grid">
          {scenario.sources.map((source) => (
            <label className="vendor-card" key={source.id}>
              <span className="vendor-title">
                <strong>{source.name}</strong>
                <small>{source.carbonPerMwh} kgCO₂e / MWh</small>
              </span>
              <span className="vendor-price">${source.unitCost} / MWh</span>
              <input
                aria-label={`${source.name} energy allocation`}
                max={source.capacity}
                min={0}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setAllocation((current) => ({
                    ...current,
                    [source.id]: Math.max(0, Math.trunc(value)),
                  }));
                  setEvaluation(null);
                }}
                type="number"
                value={allocation[source.id] ?? 0}
              />
              <span className="capacity">Capacity {source.capacity} MWh</span>
            </label>
          ))}
        </div>
        <button disabled={pending} onClick={evaluate} type="button">
          {pending ? "Measuring all axes…" : "Evaluate dispatch"}
        </button>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}
      {evaluation ? (
        <section className="codec-result" aria-live="polite">
          <div className="supply-result-heading">
            <div>
              <p className="eyebrow">Measured outcome vector</p>
              <h2>
                {evaluation.correctness
                  ? evaluation.pareto.frontier
                    ? "This dispatch belongs on the three-axis frontier."
                    : "A baseline dominates this dispatch across all three axes."
                  : "Hard constraints failed."}
              </h2>
            </div>
            <span className={evaluation.pareto.frontier ? "status-good" : "status-bad"}>
              {evaluation.pareto.frontier ? "Frontier" : "Ineligible"}
            </span>
          </div>
          {evaluation.correctness ? (
            <>
              <div className="supply-metrics">
                <article>
                  <span>Energy cost</span>
                  <strong>${evaluation.totalCost.toLocaleString()}</strong>
                  <small>Minimize</small>
                </article>
                <article>
                  <span>Worst-case energy</span>
                  <strong>{evaluation.worstCaseEnergy} MWh</strong>
                  <small>Maximize</small>
                </article>
                <article>
                  <span>Lifecycle carbon</span>
                  <strong>{evaluation.carbonGrams.toLocaleString()} kg</strong>
                  <small>Minimize</small>
                </article>
              </div>
              <ContributionPanel contribution={evaluation.contribution} />
              <div className="axis-selector">
                <label>
                  X axis
                  <select
                    value={xKey}
                    onChange={(event) => setXKey(event.target.value as Metric["key"])}
                  >
                    {scenario.axes.map((metric) => (
                      <option key={metric.key} value={metric.key}>
                        {metric.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Y axis
                  <select
                    value={yKey}
                    onChange={(event) => setYKey(event.target.value as Metric["key"])}
                  >
                    {scenario.axes.map((metric) => (
                      <option key={metric.key} value={metric.key}>
                        {metric.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <MultiAxisChart
                scenario={scenario}
                evaluation={evaluation}
                xMetric={xMetric}
                yMetric={yMetric}
              />
            </>
          ) : (
            <ul className="constraint-errors">
              {evaluation.constraintFailures.map((failure) => (
                <li key={failure}>{failure}</li>
              ))}
            </ul>
          )}
          <div className="evidence-footer">
            <span>Result hash</span>
            <code>{evaluation.resultHash}</code>
          </div>
        </section>
      ) : null}
    </div>
  );
}
