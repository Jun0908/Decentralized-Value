export type MissionRun = {
  contextHash: string;
  artifactHash: string;
  valid: boolean;
};

// Learning progress only: never used for ranking, allocation or rewards.
export function firstMissionProgress(
  current: MissionRun | null,
  previous: MissionRun | null,
  draftChanged: boolean,
) {
  const measured = current?.valid === true;
  const compared =
    measured &&
    previous?.valid === true &&
    current.contextHash === previous.contextHash &&
    current.artifactHash !== previous.artifactHash;
  return [measured, measured && (draftChanged || compared), compared && !draftChanged] as const;
}
