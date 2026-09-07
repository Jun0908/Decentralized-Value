import type { ChallengeManifestV2 } from "@frontier/shared";
import { getChallengeAdapter } from "@/lib/arena-adapters";
import { arenaRegistry } from "@/lib/arenas";

export async function getChallengeManifest(
  challengeId: string,
): Promise<{ manifest: ChallengeManifestV2; manifestHash: string } | undefined> {
  return getChallengeAdapter(challengeId)?.loadManifest();
}

export const challengeIds = arenaRegistry.map(({ challengeId }) => challengeId);
