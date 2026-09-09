"use client";

import type {
  DisasterResponseEvaluation,
  DisasterScenarioOutcome,
  ReplayShipment,
} from "@frontier/disaster-response";
import {
  ArrowPathIcon,
  BanknotesIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  PauseIcon,
  PlayIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";

const replayDurationMs = 15_000;

type ReplayPhase = "placement" | "disruption" | "recovery" | "result";

type ReplayState = {
  elapsedMs: number;
  playing: boolean;
};

type ReplayStageProps = {
  evaluation: DisasterResponseEvaluation;
  outcome: DisasterScenarioOutcome;
  previousEvaluation: DisasterResponseEvaluation | null;
  onImprove: () => void;
};

export function CalculatedLoadout({
  evaluation,
}: {
  evaluation: DisasterResponseEvaluation | null;
}) {
  const trace = evaluation?.scenarioOutcomes[0]?.replayTrace;
  const shipments = trace?.shipments.filter(({ phase }) => phase !== "RECOVERY") ?? [];

  return (
    <section className="calculated-loadout" aria-live="polite">
      <header>
        <div>
          <span>CALCULATED LOADOUT</span>
          <strong>Your priorities become this real starting position.</strong>
        </div>
        <small>{trace ? `${shipments.length} purchase batches` : "Calculating…"}</small>
      </header>
      <div>
        {shipments.map((shipment) => (
          <article key={`${shipment.phase}-${shipment.supplierId}`}>
            <CubeIcon aria-hidden="true" />
            <div>
              <strong>{shipment.supplierName}</strong>
              <span>{shipment.routeName}</span>
            </div>
            <b>{shipment.kits} kits</b>
            <small>
              {money(shipment.costUsd)} · ETA {shipment.arrivalHour}h
            </small>
          </article>
        ))}
        {trace ? (
          <article className="loadout-cash">
            <BanknotesIcon aria-hidden="true" />
            <div>
              <strong>Recovery vault</strong>
              <span>Held until a route fails</span>
            </div>
            <b>{money(trace.emergencyBudgetUsd)}</b>
            <small>Not spent at H+0</small>
          </article>
        ) : null}
      </div>
    </section>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function percent(ppm: number) {
  return `${(ppm / 10_000).toFixed(1)}%`;
}

function signedMoney(value: number) {
  return `${value > 0 ? "+" : ""}${money(value)}`;
}

function signedNumber(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("en-US")}`;
}

function signedPercentagePoints(ppm: number) {
  const value = ppm / 10_000;
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} pp`;
}

function phaseAt(elapsedMs: number): ReplayPhase {
  if (elapsedMs < 3_000) return "placement";
  if (elapsedMs < 6_000) return "disruption";
  if (elapsedMs < 10_000) return "recovery";
  return "result";
}

function routeClass(routeId: string) {
  return `route-${routeId.replaceAll(/[^a-z0-9-]/g, "")}`;
}

function ShipmentMarker({ shipment, index }: { shipment: ReplayShipment; index: number }) {
  const Icon = shipment.routeId === "air-corridor" ? CubeIcon : TruckIcon;
  const style = { "--shipment-delay": `${index * 180}ms` } as CSSProperties;
  return (
    <div
      className={`replay-shipment-marker ${routeClass(shipment.routeId)} ${shipment.phase.toLowerCase()} ${shipment.status.toLowerCase()}`}
      style={style}
    >
      <Icon aria-hidden="true" />
      <b>{shipment.kits}</b>
      <span>{shipment.routeName}</span>
    </div>
  );
}

export function DisasterReplayStage({
  evaluation,
  outcome,
  previousEvaluation,
  onImprove,
}: ReplayStageProps) {
  const [replay, setReplay] = useState<ReplayState>({ elapsedMs: 0, playing: true });
  const phase = phaseAt(replay.elapsedMs);
  const progress = Math.min(100, (replay.elapsedMs / replayDurationMs) * 100);
  const simulatedHour = Math.min(72, Math.round((replay.elapsedMs / replayDurationMs) * 72));
  const trace = outcome.replayTrace;
  const initialShipments = trace.shipments.filter(({ phase: shipmentPhase }) =>
    ["PRIMARY", "RESERVE"].includes(shipmentPhase),
  );
  const lostShipments = trace.shipments.filter(({ status }) => status === "LOST");
  const recoveryShipments = trace.shipments.filter(
    ({ phase: shipmentPhase }) => shipmentPhase === "RECOVERY",
  );
  const lostKits = lostShipments.reduce((sum, { kits }) => sum + kits, 0);
  const recoveryKits = recoveryShipments.reduce((sum, { kits }) => sum + kits, 0);
  const worstRegion = [...outcome.regionOutcomes].sort(
    (left, right) => left.coveragePpm - right.coveragePpm,
  )[0]!;
  const disruption = trace.disruptions[0] ?? null;
  const visibleShipments =
    phase === "placement"
      ? initialShipments
      : phase === "disruption"
        ? lostShipments
        : phase === "recovery"
          ? recoveryShipments
          : [];

  useEffect(() => {
    if (!replay.playing) return;
    const interval = window.setInterval(() => {
      setReplay((current) => {
        const elapsedMs = Math.min(replayDurationMs, current.elapsedMs + 100);
        return { elapsedMs, playing: elapsedMs < replayDurationMs };
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, [replay.playing]);

  const headline =
    phase === "placement"
      ? `${initialShipments.reduce((sum, { kits }) => sum + kits, 0)} kits staged before routes fail`
      : phase === "disruption"
        ? disruption
          ? `${disruption.label} · ${lostKits} kits lost`
          : "All routes remain open"
        : phase === "recovery"
          ? recoveryKits > 0
            ? `${recoveryKits} kits rerouted for ${money(trace.recoverySpentUsd)}`
            : "No recovery purchase was needed"
          : `${worstRegion.regionName} received only ${percent(worstRegion.coveragePpm)}`;

  const restart = () => setReplay({ elapsedMs: 0, playing: true });

  return (
    <div className={`replay-experience phase-${phase} notranslate`} lang="en" translate="no">
      <aside className="replay-loadout">
        <header>
          <span>YOUR LOADOUT</span>
          <strong>{evaluation.strategy.name}</strong>
        </header>
        <div className="loadout-list">
          {initialShipments.map((shipment) => (
            <article key={`${shipment.phase}-${shipment.supplierId}`}>
              <CubeIcon aria-hidden="true" />
              <div>
                <strong>{shipment.supplierName}</strong>
                <span>
                  {shipment.kits} kits · {shipment.routeName}
                </span>
              </div>
              <b>{money(shipment.costUsd)}</b>
            </article>
          ))}
        </div>
        <div className="recovery-vault">
          <BanknotesIcon aria-hidden="true" />
          <div>
            <span>RECOVERY VAULT</span>
            <strong>{money(trace.emergencyBudgetUsd)}</strong>
          </div>
          {phase === "recovery" || phase === "result" ? (
            <small>−{money(trace.recoverySpentUsd)} used</small>
          ) : (
            <small>Held until failure</small>
          )}
        </div>
        <p>
          Backup and recovery follow the priority you selected. No decisions are added during the
          replay.
        </p>
      </aside>

      <div className="replay-main">
        <header className="replay-toolbar">
          <div>
            <span>72-HOUR AUTO REPLAY · {outcome.scenarioName}</span>
            <strong>H+{simulatedHour} / 72</strong>
          </div>
          <div className="replay-controls">
            <button
              aria-label={replay.playing ? "Pause replay" : "Continue replay"}
              className="secondary-action"
              onClick={() => setReplay((current) => ({ ...current, playing: !current.playing }))}
              type="button"
            >
              {replay.playing ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
              {replay.playing ? "Pause" : "Continue"}
            </button>
            <button className="secondary-action" onClick={restart} type="button">
              <ArrowPathIcon aria-hidden="true" /> Replay
            </button>
            {phase !== "result" ? (
              <button
                className="text-button replay-skip"
                onClick={() => setReplay({ elapsedMs: replayDurationMs, playing: false })}
                type="button"
              >
                See result
              </button>
            ) : null}
          </div>
          <div
            aria-label="Replay progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(progress)}
            className="replay-progress"
            role="progressbar"
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        </header>

        <div className="replay-map">
          <Image
            alt="Supply routes connecting warehouses, a port, rail and air transport to four disaster relief regions"
            fill
            sizes="(max-width: 900px) 100vw, 72vw"
            src="/images/disaster-response-network-normal.png"
          />
          <div className="replay-map-shade" />
          <div className="replay-phase-label" aria-live="polite">
            <span>
              {phase === "placement"
                ? "01 · STAGE"
                : phase === "disruption"
                  ? "02 · BREAK"
                  : phase === "recovery"
                    ? "03 · REROUTE"
                    : "04 · RESULT"}
            </span>
            <strong>{headline}</strong>
          </div>
          {phase === "disruption" && disruption ? (
            <div
              className={`replay-disruption ${routeClass(disruption.disabledRouteIds[0] ?? "")}`}
            >
              <ExclamationTriangleIcon aria-hidden="true" />
              <span>{disruption.label}</span>
            </div>
          ) : null}
          <div className="replay-map-shipments">
            {visibleShipments.map((shipment, index) => (
              <ShipmentMarker
                index={index}
                key={`${phase}-${shipment.phase}-${shipment.supplierId}`}
                shipment={shipment}
              />
            ))}
          </div>
          {phase === "result" ? (
            <div className="replay-region-overlay">
              {outcome.regionOutcomes.map((region) => (
                <article
                  className={region.regionId === worstRegion.regionId ? "worst" : ""}
                  key={region.regionId}
                >
                  <MapPinIcon aria-hidden="true" />
                  <div>
                    <strong>{region.regionName}</strong>
                    <span>
                      {region.delivered} / {region.demand} kits
                    </span>
                    <div className="coverage-track">
                      <span style={{ width: `${Math.min(100, region.coveragePpm / 10_000)}%` }} />
                    </div>
                  </div>
                  <b>{percent(region.coveragePpm)}</b>
                </article>
              ))}
            </div>
          ) : null}
        </div>

        <div className="replay-result-strip">
          <article>
            <span>COST</span>
            <strong>
              {phase === "result" ? money(evaluation.totalProcurementCost) : "Measuring"}
            </strong>
          </article>
          <article>
            <span>WORST DELIVERY</span>
            <strong>
              {phase === "result" ? `${evaluation.worstCaseDeliveredKits} kits` : "Measuring"}
            </strong>
          </article>
          <article>
            <span>WORST REGION</span>
            <strong>
              {phase === "result" ? percent(evaluation.regionalFairnessPpm) : "Measuring"}
            </strong>
          </article>
          <article className="replay-verdict">
            <span>{phase === "result" ? "WHAT CHANGED" : "SIMULATING"}</span>
            <strong>
              {phase === "result"
                ? `${lostKits} lost · ${recoveryKits} rerouted`
                : `${phase.toUpperCase()}…`}
            </strong>
          </article>
        </div>

        {phase === "result" ? (
          <div className="replay-result-actions">
            <div>
              {previousEvaluation ? (
                <p>
                  vs previous: cost{" "}
                  {signedMoney(
                    evaluation.totalProcurementCost - previousEvaluation.totalProcurementCost,
                  )}
                  {" · "}delivery{" "}
                  {signedNumber(
                    evaluation.worstCaseDeliveredKits - previousEvaluation.worstCaseDeliveredKits,
                  )}{" "}
                  kits · fairness{" "}
                  {signedPercentagePoints(
                    evaluation.regionalFairnessPpm - previousEvaluation.regionalFairnessPpm,
                  )}
                </p>
              ) : (
                <p>Change the strategy and replay to see the trade-off.</p>
              )}
            </div>
            <button onClick={onImprove} type="button">
              Improve strategy
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
