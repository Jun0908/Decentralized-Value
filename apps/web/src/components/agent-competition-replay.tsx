"use client";

import type { SupplyAgentReplay } from "@frontier/emergency-supply";
import { useEffect, useState } from "react";

function percent(ppm: number) {
  return `${(ppm / 10_000).toFixed(2)}%`;
}

export function AgentCompetitionReplay() {
  const [replay, setReplay] = useState<SupplyAgentReplay | null>(null);
  const [visibleEntries, setVisibleEntries] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!replay || visibleEntries === 0 || visibleEntries >= replay.entries.length) return;
    const timer = window.setTimeout(() => {
      setVisibleEntries((current) => current + 1);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [replay, visibleEntries]);

  async function runReplay() {
    setPending(true);
    setError(null);
    setReplay(null);
    setVisibleEntries(0);
    try {
      const response = await fetch("/v1/emergency-supply/replay");
      if (!response.ok) throw new Error("Replay could not be measured");
      setReplay((await response.json()) as SupplyAgentReplay);
      setVisibleEntries(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Replay could not be measured");
    } finally {
      setPending(false);
    }
  }

  const complete = replay !== null && visibleEntries === replay.entries.length;

  return (
    <section className="agent-replay" aria-labelledby="agent-replay-heading">
      <div className="agent-replay-intro">
        <div>
          <p className="eyebrow">Agent competition replay</p>
          <h2 id="agent-replay-heading">
            Three agents. Two independent goals. More than one winner.
          </h2>
          <p>
            Replay three submissions through the exact same public context and evaluator. The final
            result is calculated from all entries together, independent of submission order.
          </p>
        </div>
        <button disabled={pending} onClick={() => void runReplay()} type="button">
          {pending ? "Measuring…" : replay ? "Replay again" : "Run Agent A / B / C"}
        </button>
      </div>

      {error ? <p className="comparison-note status-bad">{error}</p> : null}
      {replay ? (
        <div aria-live="polite">
          <div className="agent-entry-grid">
            {replay.entries.slice(0, visibleEntries).map((entry) => (
              <article
                className={
                  entry.frontier ? "agent-entry frontier-entry" : "agent-entry dominated-entry"
                }
                key={entry.id}
              >
                <header>
                  <div>
                    <span>{entry.name}</span>
                    <strong>{entry.approach}</strong>
                  </div>
                  <b>{entry.frontier ? "FRONTIER" : "DOMINATED"}</b>
                </header>
                <dl>
                  <div>
                    <dt>Cost</dt>
                    <dd>${entry.totalProcurementCost.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Worst delivery</dt>
                    <dd>{entry.worstCaseDeliveredKits} kits</dd>
                  </div>
                  <div>
                    <dt>Contribution</dt>
                    <dd>{percent(entry.contribution.exclusiveContributionPpm)}</dd>
                  </div>
                  <div>
                    <dt>Reward</dt>
                    <dd>{entry.rewardCredits.toLocaleString()} credits</dd>
                  </div>
                </dl>
                {entry.dominatedBy.length > 0 ? (
                  <p>Beaten on both axes by {entry.dominatedBy.join(", ")}.</p>
                ) : null}
              </article>
            ))}
          </div>
          {complete ? (
            <div className="replay-verdict">
              <div>
                <span>Final participant frontier</span>
                <strong>Agent A + Agent B</strong>
              </div>
              <p>
                Agent A keeps the cheapest participant result. Agent B delivers far more after a
                failure. Agent C costs more than B and delivers less, so its reward is zero.
              </p>
              <code>{replay.replayHash}</code>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
