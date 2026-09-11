import { readFileSync } from "node:fs";
import {
  assertRescueSubmissionReplayComparison,
  replayRescueSubmissionActions,
} from "../packages/rescue-room/src/submission-replay";
import { compareRescueContinuation } from "../apps/api/src/rescue-service-continuation";

// Fixed Git-tracked public fixture only. No .env, .frontier, wallet, paid inference or RPC.
// compareRescueContinuation uses the deterministic simulator and independent preview pools;
// this script never invokes the continuation's model runtime or operator workflow.
try {
  const fixture = JSON.parse(
    readFileSync(
      new URL("../Docs/deployments/rescue-submission-replay.json", import.meta.url),
      "utf8",
    ),
  );
  const replay = replayRescueSubmissionActions(fixture);
  const comparison = compareRescueContinuation(replay.request, replay.outcome);
  const comparisonHash = assertRescueSubmissionReplayComparison(
    replay.expectedComparison,
    comparison,
  );
  console.log(
    JSON.stringify(
      {
        schemaVersion: "rescue-submission-replay-verification-v1",
        verified: true,
        scope: "recorded-actions-simulator-outcome-and-independent-preview-pools",
        episodeId: replay.request.episodeId,
        decisionCount: replay.decisionCount,
        resultHash: replay.outcome.resultHash,
        transcriptHash: replay.outcome.transcriptHash,
        outcomeCanonicalHash: replay.outcomeCanonicalHash,
        comparisonHash,
        modelCalled: false,
        chainTransactions: 0,
        paymentReceiptsVerified: false,
        originalModelProvenanceVerified: false,
        originalFullEvidenceHashVerified: false,
      },
      null,
      2,
    ),
  );
} catch {
  console.error(
    "Public Rescue submission replay failed: missing, invalid or mismatched public fixture.",
  );
  process.exitCode = 1;
}
