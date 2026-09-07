"use client";

import { useMemo, useState } from "react";
import { keccak256, stringToHex } from "viem";

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function SponsorDraftBuilder() {
  const [name, setName] = useState("Resilient supply challenge");
  const [sponsor, setSponsor] = useState("Example sponsor");
  const [tension, setTension] = useState("Lower cost versus higher delivery resilience");
  const [firstUpper, setFirstUpper] = useState(80_000);
  const [secondUpper, setSecondUpper] = useState(1_000);
  const [constraints, setConstraints] = useState(
    "Allocate exactly 1,000 kits\nRespect every vendor capacity",
  );

  const errors = [];
  if (!name.trim()) errors.push("Challenge name is required.");
  if (!sponsor.trim()) errors.push("Sponsor name is required.");
  if (!tension.trim()) errors.push("Value Tension is required.");
  if (firstUpper <= 0 || secondUpper <= 0) errors.push("Metric upper bounds must be above zero.");
  if (!constraints.trim()) errors.push("At least one Hard Constraint is required.");

  const draft = useMemo(
    () => ({
      schemaVersion: "2",
      lifecycle: "PRACTICE",
      name: name.trim(),
      sponsor: { name: sponsor.trim(), wallet: null },
      valueTension: tension.trim(),
      metrics: [
        {
          key: "cost",
          direction: "MINIMIZE",
          unit: "USD",
          lowerBound: 0,
          upperBound: firstUpper,
        },
        {
          key: "resilience",
          direction: "MAXIMIZE",
          unit: "units",
          lowerBound: 0,
          upperBound: secondUpper,
        },
      ],
      hardConstraints: constraints
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
      evidenceLevel: 0,
      finalWorkloadCommitment: null,
      reward: { kind: "PREVIEW", poolCredits: 10_000 },
    }),
    [constraints, firstUpper, name, secondUpper, sponsor, tension],
  );
  const manifestHash = errors.length === 0 ? keccak256(stringToHex(canonicalJson(draft))) : null;

  return (
    <div className="sponsor-builder">
      <section className="sponsor-form" aria-labelledby="sponsor-form-heading">
        <div>
          <p className="eyebrow">Draft only</p>
          <h2 id="sponsor-form-heading">Describe the possibility you want builders to expand.</h2>
        </div>
        <label>
          Challenge name
          <input onChange={(event) => setName(event.target.value)} value={name} />
        </label>
        <label>
          Sponsor name
          <input onChange={(event) => setSponsor(event.target.value)} value={sponsor} />
        </label>
        <label className="wide-field">
          Value Tension
          <textarea onChange={(event) => setTension(event.target.value)} rows={3} value={tension} />
        </label>
        <div className="metric-draft">
          <label>
            Cost upper bound
            <input
              min={1}
              onChange={(event) => setFirstUpper(Number(event.target.value))}
              type="number"
              value={firstUpper}
            />
          </label>
          <label>
            Resilience upper bound
            <input
              min={1}
              onChange={(event) => setSecondUpper(Number(event.target.value))}
              type="number"
              value={secondUpper}
            />
          </label>
        </div>
        <label className="wide-field">
          Hard Constraints · one per line
          <textarea
            onChange={(event) => setConstraints(event.target.value)}
            rows={4}
            value={constraints}
          />
        </label>
      </section>

      <aside className="draft-preview" aria-live="polite">
        <div className="manifest-state">
          <span>PRACTICE</span>
          <strong>Draft preview</strong>
          <small>Not saved · Not signed · Not funded</small>
        </div>
        {errors.length > 0 ? (
          <ul className="constraint-errors">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : (
          <>
            <dl>
              <div>
                <dt>Metric reference bounds</dt>
                <dd>
                  0–{firstUpper.toLocaleString()} USD · 0–{secondUpper.toLocaleString()} units
                </dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>L0 · Synthetic simulation</dd>
              </div>
              <div>
                <dt>Reward</dt>
                <dd>10,000 preview credits · no token</dd>
              </div>
            </dl>
            <p className="draft-hash">Draft hash {manifestHash}</p>
            <pre>{JSON.stringify(draft, null, 2)}</pre>
          </>
        )}
        <p className="contribution-disclaimer">
          Publishing is disabled until durable storage, sponsor wallet signature, final workload
          commitment, and an actually funded reward pool are connected.
        </p>
      </aside>
    </div>
  );
}
