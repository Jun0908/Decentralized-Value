"use client";

import { useEffect, useMemo, useState } from "react";
import {
  compareMicrogridDays,
  microgridDayContext,
  microgridDayPresets,
  microgridDayScenarios,
  simulateMicrogridDay,
  verifyMicrogridReplay,
  type MicrogridDayResult,
  type MicrogridDayScenarioId,
  type MicrogridDayStep,
  type MicrogridPolicy,
} from "@frontier/microgrid-dispatch/practice";
import styles from "./microgrid-day-practice.module.css";

const format = (value: number, digits = 2) =>
  value.toLocaleString("en-US", { maximumFractionDigits: digits });
const signed = (value: number) => `${value > 0 ? "+" : ""}${format(value, 3)}`;

function EnergyIcon({ kind }: { kind: "solar" | "wind" | "grid" | "home" | "battery" }) {
  return (
    <svg viewBox="0 0 64 56" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {kind === "solar" ? (
        <>
          <circle cx="46" cy="12" r="6" />
          <path d="M46 1v3m0 16v3m-11-11h3m16 0h4M11 26h36l7 21H4l7-21Zm6 0-3 21m17-21v21m11-21 4 21M8 36h43M28 47v7m-11 0h27" />
        </>
      ) : null}
      {kind === "wind" ? (
        <>
          <path d="M32 26v28m-8 0h16M32 24 28 3c-2-3-5 0-4 3l6 19m4 1 20 8c4 0 4-4 1-5l-19-6m-6 5L15 43c-1 4 3 5 5 2l13-15" />
          <circle cx="32" cy="26" r="4" />
        </>
      ) : null}
      {kind === "grid" ? (
        <>
          <path d="M18 54 28 3h8l10 51M11 17h42M7 31h50M25 17l16 14-21 15m19-29L23 31l21 15M9 17v7m46-7v7M5 31v7m54-7v7" />
        </>
      ) : null}
      {kind === "home" ? (
        <>
          <path d="m3 27 16-14 16 14M8 24v26h22V24M16 50V36h7v14m13-34L47 7l14 13M38 18v32h19V18m-12 9h7v8h-7m-6 15V39h7v11" />
        </>
      ) : null}
      {kind === "battery" ? (
        <>
          <rect x="10" y="11" width="42" height="37" rx="5" />
          <path d="M24 11V6h14v5m-6 8-9 14h8l-1 10 12-16h-9l-1-8Z" />
        </>
      ) : null}
    </svg>
  );
}

function EnergyFlow({ step }: { step: MicrogridDayStep }) {
  return (
    <div className={styles.energyFlow} data-testid="microgrid-energy-flow">
      <div className={styles.generation}>
        <div className={styles.source}>
          <EnergyIcon kind="solar" />
          <span>
            Solar available<strong>{format(step.period.solarMwh)} MWh</strong>
          </span>
        </div>
        <div className={styles.source}>
          <EnergyIcon kind="wind" />
          <span>
            Wind available<strong>{format(step.period.windMwh)} MWh</strong>
          </span>
        </div>
        <div className={`${styles.source} ${!step.period.gridOnline ? styles.offline : ""}`}>
          <EnergyIcon kind="grid" />
          <span>
            {step.period.gridOnline ? "Grid imported" : "Grid offline"}
            <strong>{format(step.gridToLoadMwh + step.gridToBatteryMwh, 3)} MWh</strong>
          </span>
        </div>
      </div>
      <div className={styles.flowLine}>
        <span>
          ↓ {format(step.renewableToLoadMwh)} renewable + {format(step.gridToLoadMwh, 3)} grid MWh
          to demand
        </span>
      </div>
      <div className={styles.destinations}>
        <div className={styles.battery}>
          <div className={styles.source}>
            <EnergyIcon kind="battery" />
            <span>
              Community battery
              <strong>
                {format(step.socEndMwh, 3)} <small>/ 20 MWh</small>
              </strong>
            </span>
          </div>
          <meter aria-label="Battery state of charge" min={0} max={20} value={step.socEndMwh} />
          <p>Started at {format(step.socStartMwh, 3)} MWh</p>
          <div className={styles.flowNumbers}>
            <span>
              ↓ Charged{" "}
              <strong>{format(step.renewableToBatteryMwh + step.gridToBatteryMwh, 3)} MWh</strong>
            </span>
            <span>
              → To demand <strong>{format(step.batteryToLoadMwh, 3)} MWh</strong>
            </span>
          </div>
        </div>
        <div className={styles.community}>
          <div className={styles.source}>
            <EnergyIcon kind="home" />
            <span>
              Community demand<strong>{format(step.period.demandMwh)} MWh</strong>
            </span>
          </div>
          <div className={styles.flowNumbers}>
            <span>
              Served <strong>{format(step.servedMwh, 3)} MWh</strong>
            </span>
            <span className={step.unservedMwh > 0 ? styles.shortage : ""}>
              Unserved <strong>{format(step.unservedMwh, 3)} MWh</strong>
            </span>
          </div>
        </div>
      </div>
      <p className={styles.flowFoot}>
        Conversion loss {format(step.lossMwh, 3)} MWh · Curtailed renewables{" "}
        {format(step.curtailedMwh, 3)} MWh. Arrows show energy totals for this four-hour period.
      </p>
    </div>
  );
}

const fields = [
  {
    key: "reservePercent",
    label: "Battery reserve",
    unit: "%",
    max: 100,
    hint: "Held while the grid is online; released during an outage. A larger reserve may require more grid purchases.",
  },
  {
    key: "dischargePrice",
    label: "Discharge at grid price",
    unit: "USD / MWh",
    max: 250,
    hint: "Use the battery when price reaches this threshold. Lower values save imports now but can leave less energy for later.",
  },
  {
    key: "chargeBelowPrice",
    label: "Charge below grid price",
    unit: "USD / MWh",
    max: 120,
    hint: "Buy spare grid capacity to charge at or below this price. Zero disables it on these days; extra imports add carbon.",
  },
  {
    key: "maxGridMwh",
    label: "Grid import cap",
    unit: "MWh / period",
    max: 20,
    hint: "Total grid energy for demand plus charging. A tight cap reduces imports but may leave demand unserved.",
  },
] as const;

export function MicrogridDayPractice() {
  const [scenarioId, setScenarioId] = useState<MicrogridDayScenarioId>("storm-day");
  const [policy, setPolicy] = useState<MicrogridPolicy>({ ...microgridDayPresets[0]!.policy });
  const [result, setResult] = useState<MicrogridDayResult | null>(null);
  const [previous, setPrevious] = useState<MicrogridDayResult | null>(null);
  const [revision, setRevision] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState<string | null>(null);
  const context = useMemo(() => microgridDayContext(scenarioId), [scenarioId]);
  const baselines = useMemo(
    () =>
      microgridDayPresets.map((preset) => ({
        ...preset,
        result: simulateMicrogridDay(preset.policy, scenarioId),
      })),
    [scenarioId],
  );
  const displayed = result ?? baselines[0]!.result;
  const step = displayed.steps[stepIndex]!;
  const dirty = result !== null && JSON.stringify(policy) !== JSON.stringify(result.policy);
  const comparisons = useMemo(
    () =>
      result
        ? [
            ...baselines.map((baseline) => ({
              id: baseline.id,
              name: baseline.name,
              reference: baseline.result,
            })),
            ...(previous
              ? [
                  {
                    id: "previous",
                    name: `Previous revision · ${revision - 1}`,
                    reference: previous,
                  },
                ]
              : []),
          ].map((entry) => ({
            ...entry,
            comparison: compareMicrogridDays(result, entry.reference),
          }))
        : [],
    [baselines, previous, result, revision],
  );

  useEffect(() => {
    if (!playing || stepIndex >= 5) return;
    const timer = window.setTimeout(() => setStepIndex((current) => current + 1), 1400);
    return () => window.clearTimeout(timer);
  }, [playing, stepIndex]);
  // Playback completes without changing the evaluator result or recorded actions.
  const isPlaying = playing && stepIndex < 5;

  function runDay() {
    try {
      const next = simulateMicrogridDay(policy, scenarioId);
      setPrevious(result);
      setResult(next);
      setRevision((current) => current + 1);
      setStepIndex(0);
      setPlaying(false);
      setError(null);
      setVerification(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to run this policy.");
    }
  }

  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(displayed, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `microgrid-${scenarioId}-${displayed.resultHash.slice(2, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className={styles.day}>
      <section className={styles.brief}>
        <div>
          <p className={styles.eyebrow}>A day in the community · Simulated Practice</p>
          <h2>
            Keep the lights on.
            <br />
            Choose what it costs.
          </h2>
          <p>
            Write a dispatch policy, then follow six turns as sun, demand and grid prices change.
            Your battery carries each decision into the next turn.
          </p>
        </div>
        <div className={styles.dayFacts}>
          <span>
            <strong>24 h</strong>6 turns × 4 hours
          </span>
          <span>
            <strong>20 MWh</strong>Battery capacity
          </span>
          <span>
            <strong>3 axes</strong>No combined score
          </span>
        </div>
      </section>
      <p className={styles.boundary}>
        Day simulator v1 · Separate from Classic mix. Compare modeled cost, unserved energy and
        operational carbon only within the same day context.
      </p>
      <section className={styles.scenarioCard}>
        <label htmlFor="microgrid-day-scenario">
          Public day
          <select
            id="microgrid-day-scenario"
            data-testid="microgrid-scenario"
            value={scenarioId}
            onChange={(event) => {
              setScenarioId(event.target.value as MicrogridDayScenarioId);
              setResult(null);
              setPrevious(null);
              setRevision(0);
              setStepIndex(0);
              setPlaying(false);
              setError(null);
              setVerification(null);
            }}
          >
            {microgridDayScenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </select>
        </label>
        <p>{context.scenario.description} Changing the day starts a separate comparison.</p>
      </section>
      <section
        className={styles.builder}
        data-testid="microgrid-builder"
        aria-labelledby="microgrid-policy-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>01 · Set the policy</p>
            <h3 id="microgrid-policy-title">When should the battery help?</h3>
          </div>
          <span className={styles.tag}>Editable rules · No AI calls</span>
        </div>
        <div className={styles.presets}>
          {microgridDayPresets.map((preset) => (
            <button
              type="button"
              key={preset.id}
              data-testid={`microgrid-preset-${preset.id}`}
              onClick={() => {
                setPolicy({ ...preset.policy });
                setError(null);
              }}
            >
              <strong>{preset.name}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>
        <div className={styles.fields}>
          {fields.map((field) => (
            <label key={field.key} htmlFor={`microgrid-${field.key}`}>
              <span>{field.label}</span>
              <div className={styles.inputWithUnit}>
                <input
                  id={`microgrid-${field.key}`}
                  aria-describedby={`microgrid-${field.key}-hint`}
                  type="number"
                  min={0}
                  max={field.max}
                  step={1}
                  value={Number.isNaN(policy[field.key]) ? "" : policy[field.key]}
                  onChange={(event) => {
                    const value =
                      event.target.value === "" ? Number.NaN : Number(event.target.value);
                    setPolicy((current) => ({ ...current, [field.key]: value }));
                  }}
                />
                <span>{field.unit}</span>
              </div>
              <small id={`microgrid-${field.key}-hint`}>{field.hint}</small>
            </label>
          ))}
        </div>
        <details className={styles.rules}>
          <summary>Dispatch order and battery limits</summary>
          <p>
            Renewables serve demand first. Surplus charges storage. Battery supplies a shortage when
            the grid fails, the price threshold is reached, or the import cap is insufficient. The
            online reserve still applies until an outage.
          </p>
          <p>
            The grid then serves remaining demand and may charge storage below your price threshold.
            Battery starts at 6 MWh; capacity is 20 MWh. Every four-hour turn allows up to 8 MWh
            charging input and 8 MWh discharge output (2 MW average). Each conversion is 90%
            efficient. No simultaneous charging and discharging, and no exports.
          </p>
          <p>
            These published numbers are an educational aggregate model. They do not represent
            voltage, power flow, battery aging or real grid safety.
          </p>
        </details>
        <div className={styles.runBar}>
          <button
            className={styles.primary}
            type="button"
            data-testid="microgrid-run"
            onClick={runDay}
          >
            Run this day <span aria-hidden="true">→</span>
          </button>
          <p>
            {dirty
              ? "Policy edited. Run again to compare a new revision."
              : result
                ? `Revision ${revision} recorded in this page session.`
                : "Start from a preset or change the four rules."}
          </p>
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </section>
      <section className={styles.theatre} aria-labelledby="microgrid-replay-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>02 · Follow the energy</p>
            <h3 id="microgrid-replay-title">
              {result ? `Revision ${revision} replay` : "Baseline preview · Hold a reserve"}
            </h3>
          </div>
          <span className={styles.tag}>{stepIndex + 1} / 6 turns</span>
        </div>
        <div className={styles.timeline} aria-label="Choose a four-hour turn">
          {displayed.steps.map((item, index) => (
            <button
              type="button"
              key={item.period.id}
              aria-pressed={stepIndex === index}
              aria-label={`${item.period.time} ${item.period.gridOnline ? "grid online" : "grid outage"}`}
              onClick={() => {
                setStepIndex(index);
                setPlaying(false);
              }}
            >
              <span>{item.period.time}</span>
              <strong>{item.period.gridOnline ? `${item.period.demandMwh} MWh` : "Outage"}</strong>
              <small>
                {item.period.solarMwh} solar · {item.period.windMwh} wind
              </small>
            </button>
          ))}
        </div>
        <div className={styles.weatherStrip} aria-live="polite">
          <strong>
            {step.period.time} –{" "}
            {stepIndex === 5 ? "24:00" : displayed.steps[stepIndex + 1]!.period.time}
          </strong>
          <span>{step.period.weather}</span>
          <span>
            Grid ${step.period.gridPrice} / MWh{!step.period.gridOnline ? " · unavailable" : ""}
          </span>
        </div>
        <EnergyFlow step={step} />
        <div className={styles.decision}>
          <strong>Why energy moved</strong>
          <ul>
            {step.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
        <div className={styles.replayControls}>
          <button
            type="button"
            data-testid="microgrid-step-previous"
            disabled={stepIndex === 0}
            onClick={() => {
              setPlaying(false);
              setStepIndex((current) => current - 1);
            }}
          >
            ← Previous turn
          </button>
          <button
            type="button"
            data-testid="microgrid-replay"
            onClick={() => {
              if (isPlaying) setPlaying(false);
              else {
                if (stepIndex === 5) setStepIndex(0);
                setPlaying(true);
              }
            }}
          >
            {isPlaying ? "Pause replay" : stepIndex === 5 ? "Replay from start" : "Play replay"}
          </button>
          <button
            type="button"
            data-testid="microgrid-step-next"
            disabled={stepIndex === 5}
            onClick={() => {
              setPlaying(false);
              setStepIndex((current) => current + 1);
            }}
          >
            Next turn →
          </button>
        </div>
      </section>
      <section
        className={styles.results}
        data-testid="microgrid-result"
        aria-labelledby="microgrid-outcomes-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>03 · Compare the full day</p>
            <h3 id="microgrid-outcomes-title">
              {result ? "Three outcomes. Three separate choices." : "Published baseline outcomes"}
            </h3>
          </div>
          <span className={styles.tag}>Simulated · Lower is better</span>
        </div>
        {dirty ? (
          <p className={styles.notice}>
            These outcomes still describe revision {revision}. Run the edited policy to update them.
          </p>
        ) : null}
        <div className={styles.metrics}>
          <article>
            <span>Energy cost ↓</span>
            <strong>${format(displayed.totals.costUsd)}</strong>
            <small>Renewable generation + grid imports + initial stored energy</small>
          </article>
          <article>
            <span>Unserved energy ↓</span>
            <strong>
              {format(displayed.totals.unservedMwh, 3)} <small>MWh</small>
            </strong>
            <small>Demand left unmet across all six turns</small>
          </article>
          <article>
            <span>Operational carbon ↓</span>
            <strong>
              {format(displayed.totals.carbonKg)} <small>kgCO₂</small>
            </strong>
            <small>Grid imports + initial stored energy attribution</small>
          </article>
        </div>
        <p className={styles.accounting}>
          End-of-day storage: {format(displayed.totals.endSocMwh, 3)} MWh; no resale or terminal
          credit. Solar and wind generation costs include curtailed energy. Initial 6 MWh carries
          $300 and 2,100 kgCO₂ for every policy. Construction emissions and battery degradation are
          outside this model.
        </p>
        {result ? (
          <div className={styles.comparisonScroll}>
            <table className={styles.comparison} data-testid="microgrid-comparison" role="table">
              <caption>
                Revision {revision} minus each reference · Same day and context · Negative deltas
                are improvements
              </caption>
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Cost Δ USD</th>
                  <th scope="col">Unserved Δ MWh</th>
                  <th scope="col">Carbon Δ kgCO₂</th>
                  <th scope="col">Relationship</th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {comparisons.map(({ id, name, comparison }) => (
                  <tr key={id} role="row">
                    <th scope="row" role="rowheader">
                      {name}
                    </th>
                    <td role="cell">
                      <span className={styles.mobileAxisLabel} aria-hidden="true">
                        Cost Δ USD
                      </span>
                      <span>{signed(comparison.deltas.costUsd)}</span>
                    </td>
                    <td role="cell">
                      <span className={styles.mobileAxisLabel} aria-hidden="true">
                        Unserved Δ MWh
                      </span>
                      <span>{signed(comparison.deltas.unservedMwh)}</span>
                    </td>
                    <td role="cell">
                      <span className={styles.mobileAxisLabel} aria-hidden="true">
                        Carbon Δ kgCO₂
                      </span>
                      <span>{signed(comparison.deltas.carbonKg)}</span>
                    </td>
                    <td role="cell">
                      <span className={styles.mobileAxisLabel} aria-hidden="true">
                        Relationship
                      </span>
                      <span>
                        {
                          {
                            equal: "Same outcomes",
                            dominates: "Better on at least one; no worse on others",
                            dominated: "Reference is better; no worse on others",
                            tradeoff: "Tradeoff across axes",
                          }[comparison.relation]
                        }
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.notice}>
            Run a policy to compare with all three public baselines. A second run also compares your
            previous revision.
          </p>
        )}
        <p className={styles.accounting}>
          Comparisons use only the published references and your previous run. No global winner or
          frontier expansion is claimed. Revisions remain in memory until you leave this mode or
          reload.
        </p>
      </section>
      <section className={styles.evidence}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>04 · Reproduce the decision</p>
            <h3>Take the replay with you.</h3>
          </div>
        </div>
        <p>
          The JSON records the version, exact policy, public day, every energy flow and result
          hashes. Re-running it checks the same deterministic model.
        </p>
        <div className={styles.evidenceActions}>
          <button type="button" data-testid="microgrid-artifact-download" onClick={download}>
            Download replay JSON
          </button>
          <button
            type="button"
            data-testid="microgrid-replay-verify"
            onClick={() =>
              setVerification(
                verifyMicrogridReplay(displayed)
                  ? "Replay verified: policy, every turn and all hashes match."
                  : "Replay verification failed.",
              )
            }
          >
            Verify this replay
          </button>
        </div>
        {verification ? (
          <p className={styles.verified} role="status">
            {verification}
          </p>
        ) : null}
        <details className={styles.rules}>
          <summary>Version, hashes and policy artifact</summary>
          <dl className={styles.hashes}>
            <div>
              <dt>Simulator</dt>
              <dd>{displayed.simulatorVersion}</dd>
            </div>
            <div>
              <dt>Context hash</dt>
              <dd>
                <code>{displayed.contextHash}</code>
              </dd>
            </div>
            <div>
              <dt>Policy hash</dt>
              <dd>
                <code>{displayed.policyHash}</code>
              </dd>
            </div>
            <div>
              <dt>Result hash</dt>
              <dd>
                <code>{displayed.resultHash}</code>
              </dd>
            </div>
          </dl>
          <pre>{JSON.stringify(displayed.policy, null, 2)}</pre>
          <p>
            Offline entry: <code>@frontier/microgrid-dispatch/practice</code> →{" "}
            <code>verifyMicrogridReplay(json)</code>. Context binds the complete public day,
            constraints, battery rules and independent metrics.
          </p>
        </details>
        <p className={styles.boundary}>
          Local Practice only. No account submission, paid pool, live grid operation, AI execution
          or Hidden Final is connected to this simulator.
        </p>
      </section>
    </div>
  );
}
