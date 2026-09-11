import { challengeManifestV2Schema, hashChallengeManifest } from "@frontier/shared/manifest";

export const frontierSdkVersion = "0.3.0";
export { FrontierClient } from "./client.js";
export { verifyRescueDoctrinePracticeIntegrity } from "./rescue-integrity.js";
export type {
  RescueDoctrineIntegrityRequest,
  RescueDoctrineIntegrityReport,
} from "./rescue-integrity.js";
export {
  RescueOperatorClient,
  rescueOperatorWorkflowRequestSchema,
  rescueOperatorCreateSchema,
  rescueOperatorJobSchema,
} from "./rescue-operator.js";
export type {
  RescueOperatorWorkflowRequest,
  RescueOperatorCreateInput,
  RescueOperatorJob,
} from "./rescue-operator.js";
export type {
  PracticeInput,
  PracticeRun,
  CreateSubmissionInput,
  SubmissionBody,
} from "./client.js";
export { FrontierTransport } from "./transport.js";
export type { FrontierAuth, FrontierClientOptions } from "./transport.js";
export { FrontierError, FrontierApiError } from "./errors.js";
export { compareRuns, assertSameContext } from "./compare.js";
export type { RunComparison } from "./compare.js";
export type { EvaluationEnvelope, SandboxEnvelope } from "./legacy.js";
export type {
  DisasterResponsePractice,
  RescueRoomPractice,
  Participant,
  Submission,
  FinalEntry,
  JoinResponse,
  SubmissionsResponse,
  CreateSubmissionResponse,
  SelectEntryResponse,
} from "./responses.js";
export { plan6SubmissionSchema as submissionBodySchema } from "./generated/request-schemas.js";
export * from "@frontier/shared/cli";
export type { paths, components, operations } from "./generated/api-types.js";

export function verifyChallengeManifest(value: unknown, expectedHash: string) {
  const manifest = challengeManifestV2Schema.parse(value);
  const actualHash = hashChallengeManifest(manifest);
  return { manifest, actualHash, valid: actualHash.toLowerCase() === expectedHash.toLowerCase() };
}
