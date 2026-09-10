import type { ChallengeManifestV2 } from "@frontier/shared";
import type { ReactNode } from "react";
import { CalldataCompressionDemo } from "@/components/calldata-compression-demo";
import { MicrogridDispatchDemo } from "@/components/microgrid-dispatch-demo";
import { DisasterResponseCompetition } from "@/components/disaster-response-competition";

export type ArenaAdapter = {
  kind: string;
  challengeId: string;
  renderWorkbench(): Promise<ReactNode>;
  loadManifest(): Promise<{ manifest: ChallengeManifestV2; manifestHash: string }>;
};

const supplyAdapter: ArenaAdapter = {
  kind: "supply",
  challengeId: "disaster-response-v2",
  async renderWorkbench() {
    const { publicDisasterResponseScenario } = await import("@frontier/disaster-response");
    return <DisasterResponseCompetition initialScenario={publicDisasterResponseScenario()} />;
  },
  async loadManifest() {
    const { disasterResponseManifest, disasterResponseManifestHash } =
      await import("@frontier/disaster-response");
    return { manifest: disasterResponseManifest, manifestHash: disasterResponseManifestHash };
  },
};

const calldataAdapter: ArenaAdapter = {
  kind: "calldata",
  challengeId: "calldata-compression-v1",
  async renderWorkbench() {
    const { publicCalldataCompressionScenario } = await import("@frontier/calldata-compression");
    return <CalldataCompressionDemo scenario={await publicCalldataCompressionScenario()} />;
  },
  async loadManifest() {
    const { calldataCompressionManifest, calldataCompressionManifestHash } =
      await import("@frontier/calldata-compression");
    return {
      manifest: calldataCompressionManifest,
      manifestHash: calldataCompressionManifestHash,
    };
  },
};

const microgridAdapter: ArenaAdapter = {
  kind: "microgrid",
  challengeId: "microgrid-dispatch-v1",
  async renderWorkbench() {
    const { publicMicrogridScenario } = await import("@frontier/microgrid-dispatch");
    return <MicrogridDispatchDemo scenario={publicMicrogridScenario()} />;
  },
  async loadManifest() {
    const { microgridManifest, microgridManifestHash } =
      await import("@frontier/microgrid-dispatch");
    return { manifest: microgridManifest, manifestHash: microgridManifestHash };
  },
};

const secretGateAdapter: ArenaAdapter = {
  kind: "secret-gate",
  challengeId: "secret-gate-v1",
  async renderWorkbench() {
    const [{ publicSecretGateScenario }, { SecretGateWorkbench }] = await Promise.all([
      import("@frontier/secret-gate"),
      import("@/components/secret-gate-workbench"),
    ]);
    return <SecretGateWorkbench scenario={publicSecretGateScenario()} />;
  },
  async loadManifest() {
    const { secretGateManifest, secretGateManifestHash } = await import("@frontier/secret-gate");
    return { manifest: secretGateManifest, manifestHash: secretGateManifestHash };
  },
};

const rescueRoomAdapter: ArenaAdapter = {
  kind: "rescue-room",
  challengeId: "rescue-room-v0",
  async renderWorkbench() {
    const [{ publicRescueRoomScenario }, { RescueRoomWorkbench }] = await Promise.all([
      import("@frontier/rescue-room"),
      import("@/components/rescue-room-workbench"),
    ]);
    return <RescueRoomWorkbench scenario={publicRescueRoomScenario()} />;
  },
  async loadManifest() {
    const { rescueRoomManifest, rescueRoomManifestHash } = await import("@frontier/rescue-room");
    return { manifest: rescueRoomManifest, manifestHash: rescueRoomManifestHash };
  },
};

const oceanAdapter: ArenaAdapter = {
  kind: "ocean",
  challengeId: "ocean-commons-v1",
  async renderWorkbench() {
    const [{ publicOceanCommonsScenario }, { OceanCommonsWorkbench }] = await Promise.all([
      import("@frontier/ocean-commons"),
      import("@/components/ocean-commons-workbench"),
    ]);
    return <OceanCommonsWorkbench scenario={publicOceanCommonsScenario()} />;
  },
  async loadManifest() {
    const { oceanCommonsManifest, oceanCommonsManifestHash } = await import("@frontier/ocean-commons");
    return { manifest: oceanCommonsManifest, manifestHash: oceanCommonsManifestHash };
  },
};

export const arenaAdapters: ReadonlyMap<string, ArenaAdapter> = new Map(
  [
    supplyAdapter,
    calldataAdapter,
    microgridAdapter,
    secretGateAdapter,
    rescueRoomAdapter,
    oceanAdapter,
  ].map(
    (adapter) => [adapter.kind, adapter],
  ),
);

export function getArenaAdapter(kind: string): ArenaAdapter | undefined {
  return arenaAdapters.get(kind);
}

export function getChallengeAdapter(challengeId: string): ArenaAdapter | undefined {
  return [...arenaAdapters.values()].find((adapter) => adapter.challengeId === challengeId);
}
