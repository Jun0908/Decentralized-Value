import type { ChallengeManifestV2 } from "@frontier/shared";
import type { ReactNode } from "react";
import { CalldataCompressionDemo } from "@/components/calldata-compression-demo";
import { MicrogridDispatchDemo } from "@/components/microgrid-dispatch-demo";
import { SupplyAllocationDemo } from "@/components/supply-allocation-demo";

export type ArenaAdapter = {
  kind: string;
  challengeId: string;
  renderWorkbench(): Promise<ReactNode>;
  loadManifest(): Promise<{ manifest: ChallengeManifestV2; manifestHash: string }>;
};

const supplyAdapter: ArenaAdapter = {
  kind: "supply",
  challengeId: "emergency-supply-v1",
  async renderWorkbench() {
    const { publicEmergencySupplyScenario } = await import("@frontier/emergency-supply");
    return <SupplyAllocationDemo scenario={publicEmergencySupplyScenario()} />;
  },
  async loadManifest() {
    const { emergencySupplyManifest, emergencySupplyManifestHash } =
      await import("@frontier/emergency-supply");
    return { manifest: emergencySupplyManifest, manifestHash: emergencySupplyManifestHash };
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

export const arenaAdapters: ReadonlyMap<string, ArenaAdapter> = new Map(
  [supplyAdapter, calldataAdapter, microgridAdapter].map((adapter) => [adapter.kind, adapter]),
);

export function getArenaAdapter(kind: string): ArenaAdapter | undefined {
  return arenaAdapters.get(kind);
}

export function getChallengeAdapter(challengeId: string): ArenaAdapter | undefined {
  return [...arenaAdapters.values()].find((adapter) => adapter.challengeId === challengeId);
}
