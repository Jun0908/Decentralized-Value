"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BanknotesIcon,
  BoltIcon,
  CircleStackIcon,
  CpuChipIcon,
  DocumentMagnifyingGlassIcon,
  ServerStackIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";

export type RescueIncidentChapter = "alert" | "investigate" | "decide" | "recover" | "outcome";

export type RescueIncidentTheatreProps = {
  chapter: RescueIncidentChapter;
  visitedChapters: readonly RescueIncidentChapter[];
  currentMinute: number;
  horizonMinutes: number;
  storyBeat: number;
  storyBeatCount: number;
  eventTitle: string;
  eventDetail: string;
  actionDetail: string | null;
  protocolActionActive: boolean;
  actionReason: string | null;
  serviceDetail: string | null;
  evidenceDetail: string | null;
  activeServices: readonly { serviceId: string; dueAtMinute: number }[];
  availableBudget: number;
  reservedBudget: number;
  paidBudget: number;
  userLossUsd: number;
  demandServed: number;
  totalDemand: number;
  pausedModules: readonly string[];
  suspectedModules: readonly string[];
  modules: readonly string[];
};

const chapters: readonly { id: RescueIncidentChapter; label: string; number: string }[] = [
  { id: "alert", label: "Alert", number: "01" },
  { id: "investigate", label: "Investigate", number: "02" },
  { id: "decide", label: "Decide", number: "03" },
  { id: "recover", label: "Recover", number: "04" },
  { id: "outcome", label: "Outcome", number: "05" },
];

function actorState(chapter: RescueIncidentChapter, actor: "commander" | "protocol" | "service") {
  if (chapter === "outcome") return "complete";
  if (actor === "service" && chapter === "investigate") return "active";
  if (actor === "protocol" && (chapter === "decide" || chapter === "recover")) return "active";
  if (actor === "commander") return "active";
  return "idle";
}

export function RescueIncidentTheatre(props: RescueIncidentTheatreProps) {
  const servedPercent =
    props.totalDemand > 0 ? Math.round((props.demandServed / props.totalDemand) * 100) : 100;
  const protocolState = props.pausedModules.length > 0 ? "Restricted" : "Serving";
  const serviceState = props.activeServices.length
    ? props.activeServices
        .map(({ serviceId, dueAtMinute }) => `${serviceId} · due T+${dueAtMinute}`)
        .join(" / ")
    : props.evidenceDetail
      ? "Evidence delivered"
      : "Available for hire";
  const paymentActive = Boolean(props.serviceDetail);
  const evidenceActive = Boolean(props.evidenceDetail);
  const actionActive = props.protocolActionActive;

  return (
    <section
      aria-label="Illustrated incident replay"
      className="rescue-incident-theatre"
      data-chapter={props.chapter}
      data-story-beat={props.storyBeat}
      data-story-beat-count={props.storyBeatCount}
    >
      <ol className="rescue-theatre-chapters" aria-label="Incident chapters">
        {chapters.map((chapter) => (
          <li
            aria-current={chapter.id === props.chapter ? "step" : undefined}
            data-state={
              chapter.id === props.chapter
                ? "current"
                : props.visitedChapters.includes(chapter.id)
                  ? "complete"
                  : "future"
            }
            key={chapter.id}
          >
            <span>{chapter.number}</span>
            <strong>{chapter.label}</strong>
          </li>
        ))}
      </ol>

      <div className="rescue-theatre-canvas">
        <Image
          alt=""
          fill
          loading="eager"
          sizes="(max-width: 900px) 100vw, 1180px"
          src="/images/rescue-room-incident-storyboard.png"
        />
        <div className="rescue-theatre-shade" aria-hidden="true" />

        <header className="rescue-theatre-hud">
          <div>
            <span>INCIDENT ROOM · {props.chapter.toUpperCase()}</span>
            <strong>T+{props.currentMinute}</strong>
          </div>
          <div>
            <span>STORY BEAT</span>
            <strong>
              {props.storyBeat} / {Math.max(1, props.storyBeatCount)}
            </strong>
          </div>
          <div>
            <span>SIMULATION WINDOW</span>
            <strong>{props.horizonMinutes} MIN</strong>
          </div>
        </header>

        <div className="rescue-theatre-actors">
          <article data-state={actorState(props.chapter, "commander")}>
            <CpuChipIcon aria-hidden="true" />
            <span>Commander Agent</span>
            <strong>{props.actionDetail ?? "Reading the public state"}</strong>
            <small>
              {props.actionReason ? `Rule · ${props.actionReason}` : "True cause hidden"}
            </small>
          </article>

          <article data-state={actorState(props.chapter, "protocol")}>
            <ServerStackIcon aria-hidden="true" />
            <span>Ethereum Protocol</span>
            <strong>{protocolState}</strong>
            <small>
              {props.pausedModules.length
                ? `${props.pausedModules.join(", ")} paused`
                : "All modules accepting demand"}
            </small>
          </article>

          <article data-state={actorState(props.chapter, "service")}>
            <DocumentMagnifyingGlassIcon aria-hidden="true" />
            <span>Service Agents</span>
            <strong>{serviceState}</strong>
            <small>{props.evidenceDetail ?? "Price, speed, and accuracy differ"}</small>
          </article>
        </div>

        <div className="rescue-theatre-routes" aria-label="Current agent interactions">
          <span data-active={actionActive}>
            <CpuChipIcon aria-hidden="true" />
            <ArrowRightIcon aria-hidden="true" />
            <ServerStackIcon aria-hidden="true" />
            <b>{actionActive ? props.actionDetail : "NO ACTION YET"}</b>
          </span>
          <span data-active={paymentActive}>
            <CpuChipIcon aria-hidden="true" />
            <BanknotesIcon aria-hidden="true" />
            <ArrowRightIcon aria-hidden="true" />
            <DocumentMagnifyingGlassIcon aria-hidden="true" />
            <b>{paymentActive ? props.serviceDetail : "NO SERVICE PAYMENT"}</b>
          </span>
          <span data-active={evidenceActive}>
            <DocumentMagnifyingGlassIcon aria-hidden="true" />
            <ArrowLeftIcon aria-hidden="true" />
            <CpuChipIcon aria-hidden="true" />
            <b>{evidenceActive ? "EVIDENCE RETURNED" : "INBOX WAITING"}</b>
          </span>
        </div>

        <div className="rescue-theatre-beat" role="status">
          <span>
            <BoltIcon aria-hidden="true" /> CURRENT STORY BEAT
          </span>
          <strong>{props.eventTitle}</strong>
          <p>{props.eventDetail}</p>
        </div>

        <div className="rescue-theatre-metrics" aria-label="Current incident outcomes">
          <span>
            <BanknotesIcon aria-hidden="true" />
            <small>Budget</small>
            <strong>{props.availableBudget} RC</strong>
            <em>
              {props.reservedBudget} reserved · {props.paidBudget} paid
            </em>
          </span>
          <span>
            <CircleStackIcon aria-hidden="true" />
            <small>User loss</small>
            <strong>${props.userLossUsd.toLocaleString()}</strong>
            <em>simulated assets</em>
          </span>
          <span>
            <ServerStackIcon aria-hidden="true" />
            <small>Demand served</small>
            <strong>{servedPercent}%</strong>
            <em>availability so far</em>
          </span>
        </div>
      </div>

      <div className="rescue-theatre-modules" aria-label="Protocol module states">
        {props.modules.map((module) => {
          const state = props.pausedModules.includes(module)
            ? "paused"
            : props.suspectedModules.includes(module)
              ? "suspected"
              : "serving";
          return (
            <span data-state={state} key={module}>
              <i aria-hidden="true" />
              <strong>{module}</strong>
              <small>{state}</small>
            </span>
          );
        })}
      </div>
    </section>
  );
}
