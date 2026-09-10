"use client";

import type { Voyage, VoyageBoat, VoyageGround, VoyageRound } from "@frontier/ocean-commons";
import { PauseIcon, PlayIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";

/**
 * The season as a scene, not a chart.
 *
 * The first replay this arena had was three water-level tanks and a row of
 * cards. It was accurate and unreadable — you could not see that boats were
 * catching fish, or that two of them had signed anything. This draws the water
 * instead: grounds laid out as a map, hulls that move between them, shoals
 * whose density is the stock, and a line between two boats when money is
 * riding on a promise.
 *
 * The fog is the part that matters. Every other arena in this repo can show
 * its whole world at once; this one must not, because not seeing the sea is
 * the rule the game is built on (Plan 10 §53.3). Water nobody has worked is
 * drawn dark, and it clears only where somebody has been.
 */

const ROUND_MS = 1_800;

/** Where each ground sits on the map, in percent of the stage. */
const GROUND_LAYOUT: Record<string, { x: number; y: number; w: number; h: number }> = {
  coastal: { x: 12, y: 6, w: 33, h: 28 },
  offshore: { x: 60, y: 5, w: 36, h: 31 },
  nursery: { x: 26, y: 40, w: 40, h: 27 },
};
const PORT = { x: 1, y: 42 };

const BOND_COLOR: Record<string, string> = {
  CATCH_LIMIT: "var(--ocean-bond-limit)",
  CONSERVATION_BUYOUT: "var(--ocean-bond-buyout)",
  MUTUAL_AID: "var(--ocean-bond-aid)",
  CONSERVATION_FUND: "var(--ocean-bond-fund)",
  SOUNDING_EXCHANGE: "var(--ocean-bond-sounding)",
};

const PHASE_LABEL: Record<VoyageRound["phase"], string> = {
  SET_SAIL: "01 · SET SAIL",
  CONTRACT: "02 · CONTRACT",
  GALE: "03 · GALE",
  RESULT: "04 · RESULT",
};

/** Boats spread around the ground they are working so hulls do not stack. */
function berth(ground: { x: number; y: number; w: number; h: number }, index: number, of: number) {
  const spread = of <= 1 ? 0.5 : index / (of - 1);
  return {
    x: ground.x + ground.w * (0.16 + spread * 0.68),
    y: ground.y + ground.h * (0.58 + (index % 2) * 0.24),
  };
}

function Hull({ boat, x, y }: { boat: VoyageBoat; x: number; y: number }) {
  const state = !boat.active
    ? "sunk"
    : boat.underRepair
      ? "repair"
      : boat.clampReason === "OUT_OF_FUEL"
        ? "dry"
        : "sailing";
  return (
    <g className={`ocean-hull ocean-hull-${state}`} transform={`translate(${x} ${y}) scale(0.4)`}>
      <title>
        {boat.name} — {boat.zoneId ?? "in port"}, landed {boat.catch.toFixed(0)}, fuel{" "}
        {(boat.fuelShare * 100).toFixed(0)}%
      </title>
      {/* Hull, mast, sail. Small boats ride lower. */}
      <path
        d={boat.smallFleet ? "M-7 0 L7 0 L5 4 L-5 4 Z" : "M-10 0 L10 0 L7 5 L-7 5 Z"}
        className="ocean-hull-body"
      />
      <line x1="0" y1="0" x2="0" y2="-11" className="ocean-hull-mast" />
      <path d="M0 -10 L7 -2 L0 -2 Z" className="ocean-hull-sail" />
      {boat.catch > 0 ? (
        <g className="ocean-hull-net">
          <path d="M6 4 Q11 8 8 12" className="ocean-net-line" />
          <circle cx="9" cy="13" r="3.4" className="ocean-net-bag" />
          <text x="9" y="14.6" className="ocean-net-count">
            {Math.round(boat.catch)}
          </text>
        </g>
      ) : null}
      {/* Fuel gauge under the keel. */}
      <rect x="-8" y="7" width="16" height="2.4" rx="1.2" className="ocean-fuel-track" />
      <rect
        x="-8"
        y="7"
        width={Math.max(0, 16 * boat.fuelShare)}
        height="2.4"
        rx="1.2"
        className={boat.fuelShare < 0.2 ? "ocean-fuel-fill low" : "ocean-fuel-fill"}
      />
      <text y="-15" className="ocean-hull-name">
        {boat.name}
      </text>
    </g>
  );
}

/** A shoal drawn as fish, dense where the stock is high. */
function Shoal({ ground, seed }: { ground: VoyageGround; seed: number }) {
  const box = GROUND_LAYOUT[ground.zoneId] ?? { x: 10, y: 10, w: 30, h: 30 };
  const fish = useMemo(() => {
    const count = Math.round(3 + ground.believedShare * 21);
    return Array.from({ length: count }, (_, index) => {
      // Deterministic scatter: the same ground looks the same every replay.
      const a = Math.sin((index + 1) * 12.9898 + seed) * 43758.5453;
      const b = Math.sin((index + 1) * 78.233 + seed) * 12345.6789;
      return {
        x: box.x + box.w * (0.1 + (a - Math.floor(a)) * 0.8),
        y: box.y + box.h * (0.1 + (b - Math.floor(b)) * 0.62),
        flip: index % 2 === 0,
      };
    });
  }, [ground.believedShare, ground.zoneId, seed, box.x, box.y, box.w, box.h]);

  return (
    <g className={ground.collapsed ? "ocean-shoal collapsed" : "ocean-shoal"}>
      {fish.map((one, index) => (
        <path
          key={index}
          className="ocean-fish"
          transform={`translate(${one.x} ${one.y}) scale(${one.flip ? -0.5 : 0.5} 0.5)`}
          d="M0 0 q2.2 -1.7 4.4 0 q-2.2 1.7 -4.4 0 M4.4 0 l1.7 -1.3 v2.6 z"
        />
      ))}
    </g>
  );
}

export function OceanVoyageStage({ voyage }: { voyage: Voyage }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setIndex((current) => {
        if (current >= voyage.rounds.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, ROUND_MS);
    return () => window.clearInterval(timer);
  }, [playing, voyage.rounds.length]);

  const round = voyage.rounds[Math.min(index, voyage.rounds.length - 1)];
  if (!round) return null;

  const seed = voyage.seed.length;
  const byGround = new Map<string, VoyageBoat[]>();
  for (const boat of round.boats) {
    const key = boat.zoneId ?? "__port";
    byGround.set(key, [...(byGround.get(key) ?? []), boat]);
  }

  const position = (boat: VoyageBoat) => {
    const key = boat.zoneId ?? "__port";
    const crew = byGround.get(key) ?? [];
    const slot = crew.indexOf(boat);
    if (boat.zoneId === null) {
      return { x: PORT.x + 6.5, y: PORT.y + 8 + slot * 6.4 };
    }
    const box = GROUND_LAYOUT[boat.zoneId] ?? { x: 10, y: 10, w: 30, h: 30 };
    return berth(box, slot, crew.length);
  };

  return (
    <div className="ocean-stage">
      <header className="ocean-stage-head">
        <div>
          <span className="eyebrow">{PHASE_LABEL[round.phase]}</span>
          <strong>{round.caption}</strong>
        </div>
        <div className="ocean-stage-controls">
          <span>
            Round {round.round} / {voyage.rounds.length}
          </span>
          <button
            type="button"
            aria-label={playing ? "Pause the replay" : "Play the replay"}
            onClick={() => {
              if (index >= voyage.rounds.length - 1) setIndex(0);
              setPlaying((current) => !current);
            }}
          >
            {playing ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
          </button>
        </div>
      </header>

      <svg
        className={`ocean-map ${round.phase === "GALE" ? "gale" : ""}`}
        viewBox="0 0 100 72"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Round ${round.round}. ${round.caption}`}
      >
        <rect x="0" y="0" width="100" height="72" className="ocean-water" />

        {/* Grounds, each with its shoal and its fog. */}
        {round.grounds.map((ground) => {
          const box = GROUND_LAYOUT[ground.zoneId];
          if (!box) return null;
          return (
            <g key={ground.zoneId}>
              <rect
                x={box.x}
                y={box.y}
                width={box.w}
                height={box.h}
                rx="3"
                className={ground.reserve ? "ocean-ground reserve" : "ocean-ground"}
              />
              <Shoal ground={ground} seed={seed} />
              {/* Fog is the rule made visible: dark water is water nobody has read. */}
              <rect
                x={box.x}
                y={box.y}
                width={box.w}
                height={box.h}
                rx="3"
                className="ocean-fog"
                style={{ opacity: ground.fog * 0.93 }}
              />
              <text x={box.x + 2} y={box.y + 4} className="ocean-ground-name">
                {ground.name}
                {ground.reserve ? " · RESERVE" : ""}
              </text>
              <text x={box.x + 2} y={box.y + 7.6} className="ocean-ground-read">
                {ground.fog >= 0.95
                  ? "never sounded"
                  : ground.collapsed
                    ? "COLLAPSED"
                    : `~${(ground.believedShare * 100).toFixed(0)}% of capacity`}
              </text>
            </g>
          );
        })}

        {/* Port. */}
        <g className="ocean-port">
          <rect x="0" y="42" width="15" height="30" className="ocean-port-quay" />
          <text x="1.4" y="46" className="ocean-ground-name">
            PORT
          </text>
        </g>

        {/* Contracts, drawn between the two hulls they bind. */}
        {round.bonds.map((bond) => {
          const from = round.boats.find((boat) => boat.boatId === bond.from);
          const to = round.boats.find((boat) => boat.boatId === bond.to);
          if (!from || !to) return null;
          const a = position(from);
          const b = position(to);
          const lift = 8 + Math.min(10, bond.escrowRemaining / 20);
          return (
            <path
              key={`${bond.pactId}-${bond.to}`}
              className={bond.broken ? "ocean-bond broken" : "ocean-bond"}
              stroke={BOND_COLOR[bond.kind] ?? "var(--ocean-bond-limit)"}
              strokeWidth={bond.broken ? 0.7 : Math.max(0.5, Math.min(2.2, bond.escrowRemaining / 60))}
              d={`M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - lift} ${b.x} ${b.y}`}
            >
              <title>
                {bond.kind} — {bond.from} → {bond.to},{" "}
                {bond.broken ? "broken" : `${bond.escrowRemaining.toFixed(0)} in escrow`}
              </title>
            </path>
          );
        })}

        {round.boats.map((boat) => {
          const at = position(boat);
          return <Hull key={boat.boatId} boat={boat} x={at.x} y={at.y} />;
        })}

        {round.phase === "GALE" ? (
          <g className="ocean-gale-marks" aria-hidden="true">
            <rect x="0" y="0" width="100" height="72" className="ocean-gale-veil" />
            {/* A badge, not a watermark: the weather should darken the scene,
                not compete with the boats for the reader's attention. */}
            <rect x="62" y="64" width="36" height="6" rx="1" className="ocean-gale-badge" />
            <text x="80" y="68" className="ocean-gale-word">
              GALE · BANK SHUT
            </text>
          </g>
        ) : null}
      </svg>

      <div className="ocean-legend">
        {(
          [
            ["CATCH_LIMIT", "Catch limit"],
            ["CONSERVATION_BUYOUT", "Buyout"],
            ["MUTUAL_AID", "Mutual aid"],
            ["CONSERVATION_FUND", "Fund"],
            ["SOUNDING_EXCHANGE", "Readings traded"],
          ] as const
        ).map(([kind, label]) => (
          <span key={kind}>
            <i style={{ background: BOND_COLOR[kind] }} aria-hidden="true" />
            {label}
          </span>
        ))}
        <span>
          <i className="ocean-legend-fog" aria-hidden="true" />
          Water nobody has read
        </span>
      </div>

      <ol className="ocean-scrub" aria-label="Jump to a round">
        {voyage.rounds.map((entry, position_) => (
          <li key={entry.round}>
            <button
              type="button"
              className={position_ === index ? "current" : ""}
              onClick={() => {
                setPlaying(false);
                setIndex(position_);
              }}
            >
              {entry.round}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
