import type { ChallengeManifestV2 } from "@frontier/shared";
import { arenaRegistry } from "@/lib/arenas";

export async function getChallengeManifest(
  challengeId: string,
): Promise<{ manifest: ChallengeManifestV2; manifestHash: string } | undefined> {
  if (challengeId === "emergency-supply-v1") {
    const { emergencySupplyManifest, emergencySupplyManifestHash } =
      await import("@frontier/emergency-supply");
    return { manifest: emergencySupplyManifest, manifestHash: emergencySupplyManifestHash };
  }
  if (challengeId === "calldata-compression-v1") {
    const { calldataCompressionManifest, calldataCompressionManifestHash } =
      await import("@frontier/calldata-compression");
    return { manifest: calldataCompressionManifest, manifestHash: calldataCompressionManifestHash };
  }
  return undefined;
}

export const challengeIds = arenaRegistry.map(({ challengeId }) => challengeId);
