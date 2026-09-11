export interface paths {
  "/v1/health": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["getHealth"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/arenas": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["listArenas"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/secret-gate": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Returns the fixed offchain Gate policy, bounded practice strategy, workloads, artifact versions, context hash, and honest evidence boundary. */
    get: operations["getSecretGateScenario"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/secret-gate/enroll": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Creates a short-lived synthetic eight-member group snapshot containing the submitted public commitment. No identity secret is accepted. */
    post: operations["enrollSecretGateCommitment"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/secret-gate/enter": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Verifies a real Semaphore proof against the trusted root, fixed message and scope, then atomically reserves its nullifier. The result is offchain and is not an Ethereum transaction. */
    post: operations["verifySecretGateEntry"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/emergency-supply": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Returns the versioned suppliers, capacities, routes, failure cases, and baseline frontier. */
    get: operations["getEmergencySupplyScenario"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/emergency-supply/evaluations": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Deterministically calculates cost, enumerates every single failure, and compares a user allocation with the baseline Pareto frontier. */
    post: operations["evaluateEmergencySupplyAllocation"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/emergency-supply/replay": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Recalculates three reference agent submissions with the public evaluator, derives the final participant frontier, and allocates 10,000 deterministic practice credits by exclusive contribution. */
    get: operations["replayEmergencySupplyAgents"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/emergency-supply": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Returns the Plan 5 demo round, availability flags, public rules, and counts. */
    get: operations["getEmergencySupplyCompetition"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/emergency-supply/starter-kit": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Downloads the challenge manifest, vendors, failure scenarios, sample submission, and instructions as a ZIP archive. */
    get: operations["downloadEmergencySupplyStarterKit"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/emergency-supply/leaderboard": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Recalculates the common frontier, dominated reasons, contribution, and reward preview from seed agents and latest participant revisions. */
    get: operations["getEmergencySupplyLeaderboard"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/emergency-supply/join": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["joinEmergencySupplyCompetition"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/emergency-supply/submissions": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["submitEmergencySupplyRevision"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/emergency-supply/submissions/mine": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["getMyEmergencySupplySubmissions"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/emergency-supply/final-entry": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: operations["selectEmergencySupplyFinalEntry"];
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/emergency-supply/demo-settlement": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["settleEmergencySupplyDemoReward"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/emergency-supply/reward/mine": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["getMyEmergencySupplyReward"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/disaster-response": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Returns the machine-readable Strategy v2 schema, evaluator and data versions, limits, metrics, constraints, 72-hour logistics network, public training scenarios, and committed final-scenario hash. */
    get: operations["getDisasterResponseScenario"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/disaster-response/evaluations": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Runs the same deterministic evaluator and context used by Human UI and Agent submissions, without joining or persisting a revision. Display-only explanations are derived from measured outcomes and excluded from the compatible result hash. */
    post: operations["practiceDisasterResponseStrategy"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/disaster-response": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Returns the Plan 6 instant demo round, storage/authentication/settlement availability, rules, and scenario. */
    get: operations["getDisasterResponseCompetition"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/disaster-response/starter-kit": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["downloadDisasterResponseStarterKit"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/disaster-response/leaderboard": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Compares selected Final Entries with public benchmarks and allocates independent Value Pools without producing an overall rank. Every allocation includes a deterministic qualification reason and formula. */
    get: operations["getDisasterResponseLeaderboard"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/disaster-response/value-pools": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Publishes one authenticated practice Protect a Region Value Pool. It allocates demo credits and does not fund or transfer Sepolia tokens. */
    post: operations["publishDisasterResponseValuePool"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/disaster-response/join": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["joinDisasterResponseCompetition"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/disaster-response/submissions": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["submitDisasterResponseRevision"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/disaster-response/submissions/mine": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["getMyDisasterResponseSubmissions"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/disaster-response/final-entry": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: operations["selectDisasterResponseFinalEntry"];
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/disaster-response/demo-settlement": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["settleDisasterResponseDemoReward"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/disaster-response/reward/mine": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["getMyDisasterResponseReward"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/calldata-compression": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Returns the fixed batches, compiler and Cancun EVM rules, reference codecs, and measured baseline points. */
    get: operations["getCalldataCompressionScenario"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/calldata-compression/evaluations": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Encodes every public batch, applies exact EIP-2028 byte pricing, executes Solidity runtime bytecode in a Cancun EVM, and compares both gas axes. */
    post: operations["evaluateCalldataCodec"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/microgrid-dispatch": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Returns the deterministic three-axis practice context and baselines. */
    get: operations["getMicrogridDispatchScenario"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/microgrid-dispatch/evaluations": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Measures cost, worst-case energy delivery, and carbon while enforcing all constraints. */
    post: operations["evaluateMicrogridDispatch"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/rescue-room": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Returns the deterministic Practice pack, ambiguous public alerts, curated Service Agent catalog, Reference Commander outcomes, Pareto frontier, and four independent Value Pool previews. Hidden incident state and practice seeds are omitted. */
    get: operations["getRescueRoomScenario"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/rescue-room/starter-kit": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Downloads the public alerts, Service Agent catalog, Doctrine and Commander Playbook schemas, deterministic and AI runtime contracts, starter Artifacts, and example requests. Hidden incident state is excluded. */
    get: operations["downloadRescueRoomStarterKit"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/rescue-room/evaluations": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Runs one Reference Commander against one deterministic simulated incident and returns its Action, Service Receipt, game-credit Payment, Protocol State, and outcome Replay. The true incident is revealed after the run. */
    post: operations["evaluateRescueRoomPracticeEpisode"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/rescue-room/doctrine-evaluations": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Runs one normalized deterministic Rescue Doctrine against one public Practice Episode. Returns reason-coded decisions, an Artifact hash, deterministic Action replay, and three independent outcomes. */
    post: operations["evaluateRescueRoomDoctrine"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/rescue-room/commander-evaluations": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Runs one participant-authored Commander Playbook through the fixed OpenAI Agents SDK runtime against one public Practice Episode. Returns model and token provenance plus hash-bound Action evidence whose deterministic replay must reproduce the outcome. This is Controlled Practice and is not reward-eligible. */
    post: operations["evaluateRescueRoomAiCommander"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v2/sandbox/participants/register": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Idempotently registers a wallet address in ephemeral demo memory. It does not prove ownership or personhood. */
    post: operations["registerSandboxParticipant"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v2/sandbox/submissions": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Evaluates and records one ephemeral revision. Private source is rejected until encrypted storage exists. */
    post: operations["createSandboxSubmission"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v2/sandbox/participants/{participantId}/submissions": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["listSandboxSubmissions"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v2/sandbox/final-entry": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    /** @description Selects one revision as the current final entry. Sandbox entries are not deadline-frozen. */
    put: operations["selectSandboxFinalEntry"];
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/arenas/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["getArena"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/arenas/{id}/frontier": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["getArenaFrontier"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["getChallenge"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/{id}/frontier": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["getFrontier"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/{id}/artifacts": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["listArtifacts"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/{id}/attestations": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["listAttestations"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/challenges/{id}/disputes": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["createDispute"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/artifacts": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["createArtifact"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/artifacts/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["getArtifact"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/evaluations": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Paid/gated operation when routed through the Bazantic 402/MPP gateway. */
    post: operations["evaluateArtifact"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/evaluations/{jobId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["getEvaluation"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/runners": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["listRunners"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/runners/{ensName}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["getRunner"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/cli/arenas": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["listCliArenas"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/cli/arenas/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["getCliArena"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/cli/auth/device": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Short-lived, origin-bound CLI authorization. No wallet keys or Privy identity tokens are exported to the CLI. */
    post: operations["cliAuthDevice"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/cli/auth/inspect": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Short-lived, origin-bound CLI authorization. No wallet keys or Privy identity tokens are exported to the CLI. */
    post: operations["cliAuthInspect"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/cli/auth/approve": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Short-lived, origin-bound CLI authorization. No wallet keys or Privy identity tokens are exported to the CLI. */
    post: operations["cliAuthApprove"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/cli/auth/token": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Short-lived, origin-bound CLI authorization. No wallet keys or Privy identity tokens are exported to the CLI. */
    post: operations["cliAuthToken"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/cli/auth/session": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Short-lived, origin-bound CLI authorization. No wallet keys or Privy identity tokens are exported to the CLI. */
    get: operations["cliAuthSession"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/cli/auth/revoke": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Short-lived, origin-bound CLI authorization. No wallet keys or Privy identity tokens are exported to the CLI. */
    post: operations["cliAuthRevoke"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    Bytes32: string;
    SecretGateEnrollment: {
      commitment: string;
    };
    SemaphoreProof: {
      merkleTreeDepth: number;
      merkleTreeRoot: string;
      message: string;
      nullifier: string;
      scope: string;
      points: string[];
    };
    SecretGateEntry: {
      /** @constant */
      gateId: "public-demo-gate";
      /** @constant */
      epoch: "2026-09-demo-1";
      proof: components["schemas"]["SemaphoreProof"];
    };
    EvaluationInput: {
      artifactId: components["schemas"]["Bytes32"];
    };
    SupplyEvaluationInput: {
      /** @enum {string} */
      contextId?: "public-normal-operations" | "public-port-constrained";
      allocations: {
        "harbor-aid": number;
        northstar: number;
        "inland-works": number;
        "local-grid": number;
        airbridge: number;
      };
    };
    Plan5SubmissionInput: {
      allocations: {
        [key: string]: number;
      };
      /** @enum {string} */
      sourceMethod: "VISUAL" | "JSON" | "UPLOAD";
      /** Format: uri */
      repositoryUrl?: string | null;
      sourceCommit?: string | null;
    };
    DisasterResponseStrategy: {
      /** @constant */
      schemaVersion: "2";
      name: string;
      primarySupplierOrder: (
        "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge"
      )[];
      emergencySupplierOrder: (
        "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge"
      )[];
      /** @enum {string} */
      regionPolicy: "deadline-first" | "highest-need" | "equalize-coverage";
      reserveKits: number;
      emergencyBudgetUsd: number;
    };
    /** @enum {string} */
    DisasterSupplierId: "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge";
    Plan6SubmissionInput: {
      strategy: {
        /** @constant */
        schemaVersion: "2";
        name: string;
        primarySupplierOrder: (
          "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge"
        )[];
        emergencySupplierOrder: (
          "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge"
        )[];
        /** @enum {string} */
        regionPolicy: "deadline-first" | "highest-need" | "equalize-coverage";
        reserveKits: number;
        emergencyBudgetUsd: number;
      };
      /** @enum {string} */
      sourceMethod: "VISUAL" | "JSON" | "UPLOAD" | "AGENT_API";
      /** @default null */
      repositoryUrl: string | null;
      /** @default null */
      sourceCommit: string | null;
      /** @default null */
      agentEvidence: {
        name: string;
        version: string;
        objective: string;
      } | null;
    };
    Plan6AgentEvidence: {
      name: string;
      version: string;
      objective: string;
    };
    Plan6ValuePoolInput: {
      name: string;
      valueStatement: string;
      /** @enum {string} */
      regionId: "coast" | "river" | "highland" | "south";
      poolCredits: number;
    };
    CalldataEvaluationInput: {
      /** @enum {string} */
      codecId: "abi" | "packed" | "dictionary";
      /** @enum {string} */
      contextId?: "public-transfer-mix" | "public-low-reuse";
    };
    MicrogridEvaluationInput: {
      allocations: {
        [key: string]: number;
      };
    };
    RescueRoomEvaluationInput: {
      /** @enum {string} */
      policyId:
        | "always-pause"
        | "never-pause"
        | "monitor-first"
        | "audit-everything"
        | "cheapest-service"
        | "spend-everything"
        | "patch-immediately"
        | "simple-adaptive";
      episodeId: string;
    };
    RescueRoomCommanderEvaluationInput: {
      episodeId: string;
      playbook: components["schemas"]["RescueCommanderPlaybook"];
    };
    RescueRoomDoctrineEvaluationInput: {
      episodeId: string;
      doctrine: components["schemas"]["RescueDoctrine"];
    };
    RescueDoctrine: {
      /** @enum {string} */
      schemaVersion: "rescue-doctrine-v0";
      name: string;
      constraints: {
        investigationBudgetCredits: number;
        maxServicePriceCredits: number;
        allowedServiceIds: (
          | "pulse-monitor"
          | "trace-audit"
          | "accounting-audit"
          | "second-opinion"
          | "patch-builder"
          | "patch-verifier"
        )[];
        allowedProtocolActions: (
          | "PAUSE_MODULE"
          | "PAUSE_PROTOCOL"
          | "APPLY_PATCH"
          | "RESUME_MODULE"
          | "RESUME_PROTOCOL"
          | "WAIT"
          | "CLOSE_INCIDENT"
        )[];
      };
      rules: {
        minimumEvidenceCount: number;
        minimumConfidencePpm: number;
        /** @enum {string} */
        disagreementAction: "second-opinion" | "wait" | "contain";
        /** @enum {string} */
        containmentScope: "none" | "module" | "protocol";
        servicePriority: (
          "pulse-monitor" | "trace-audit" | "accounting-audit" | "second-opinion"
        )[];
        requirePatchVerification: boolean;
        /** @enum {string} */
        budgetExhaustedAction: "wait" | "close" | "contain";
      };
    };
    RescueCommanderPlaybook: {
      /** @enum {string} */
      schemaVersion: "rescue-commander-playbook-v0";
      name: string;
      instructions: string;
      allowedServiceIds: (
        | "pulse-monitor"
        | "trace-audit"
        | "accounting-audit"
        | "second-opinion"
        | "patch-builder"
        | "patch-verifier"
      )[];
      allowedProtocolActions: (
        | "PAUSE_MODULE"
        | "PAUSE_PROTOCOL"
        | "APPLY_PATCH"
        | "RESUME_MODULE"
        | "RESUME_PROTOCOL"
        | "WAIT"
        | "CLOSE_INCIDENT"
      )[];
      maxServicePriceCredits: number;
      /** @default 100 */
      investigationBudgetCredits: number;
    };
    SandboxRegistration: {
      /** @enum {string} */
      challengeId: "emergency-supply-v1" | "calldata-compression-v1" | "microgrid-dispatch-v1";
      wallet: string;
    };
    DisputeInput: {
      artifactId: components["schemas"]["Bytes32"];
      reason: string;
    };
    Error: {
      error: {
        code: string;
        message: string;
        details?: unknown;
      };
    };
    CliArenaManifest: {
      /** @constant */
      schemaVersion: "1";
      /** @enum {string} */
      id: "disaster-response" | "rescue-room";
      challengeId: string;
      name: string;
      webPath: string;
      context: {
        contextHash: string;
        runtimeContextHash: string | null;
        manifestHash: string;
        evaluatorVersion: string;
        dataVersion: string;
        metrics: {
          key: string;
          name: string;
          /** @enum {string} */
          direction: "MINIMIZE" | "MAXIMIZE";
          unit: string;
          lowerBound: number;
          upperBound: number;
        }[];
        /** @enum {string} */
        evidenceState: "measured" | "simulated";
      };
      artifact: {
        /** @enum {string} */
        kind: "strategy" | "doctrine";
        /** @enum {string} */
        filename: "strategy.json" | "doctrine.json";
        schema: {
          [key: string]: unknown;
        };
        schemaHash: string;
        sample: {
          [key: string]: unknown;
        };
      };
      starter: {
        path: string;
        sha256: string;
      };
      episodes: {
        id: string;
        headline: string;
      }[];
      constraints: string[];
      limits: {
        practiceRunsPerMinute: number;
        maxRevisions: number;
      };
      capabilities: {
        practice: {
          supported: boolean;
          available: boolean;
          reason: string | null;
          /** @enum {string} */
          authentication: "none" | "cli-session";
        };
        submit: {
          supported: boolean;
          available: boolean;
          reason: string | null;
          /** @enum {string} */
          authentication: "none" | "cli-session";
        };
        finalEntry: {
          supported: boolean;
          available: boolean;
          reason: string | null;
          /** @enum {string} */
          authentication: "none" | "cli-session";
        };
        /** @constant */
        contextPrecondition: true;
      };
      /** @enum {string} */
      storage: "durable-redis" | "ephemeral-memory" | "unconfigured";
      /** @enum {string} */
      paymentState: "not-requested" | "game-credits";
      /** @constant */
      rewardEligible: false;
    };
    CliArenaList: {
      /** @constant */
      schemaVersion: "1";
      arenas: {
        /** @constant */
        schemaVersion: "1";
        /** @enum {string} */
        id: "disaster-response" | "rescue-room";
        challengeId: string;
        name: string;
        webPath: string;
        context: {
          contextHash: string;
          runtimeContextHash: string | null;
          manifestHash: string;
          evaluatorVersion: string;
          dataVersion: string;
          metrics: {
            key: string;
            name: string;
            /** @enum {string} */
            direction: "MINIMIZE" | "MAXIMIZE";
            unit: string;
            lowerBound: number;
            upperBound: number;
          }[];
          /** @enum {string} */
          evidenceState: "measured" | "simulated";
        };
        artifact: {
          /** @enum {string} */
          kind: "strategy" | "doctrine";
          /** @enum {string} */
          filename: "strategy.json" | "doctrine.json";
          schema: {
            [key: string]: unknown;
          };
          schemaHash: string;
          sample: {
            [key: string]: unknown;
          };
        };
        starter: {
          path: string;
          sha256: string;
        };
        episodes: {
          id: string;
          headline: string;
        }[];
        constraints: string[];
        limits: {
          practiceRunsPerMinute: number;
          maxRevisions: number;
        };
        capabilities: {
          practice: {
            supported: boolean;
            available: boolean;
            reason: string | null;
            /** @enum {string} */
            authentication: "none" | "cli-session";
          };
          submit: {
            supported: boolean;
            available: boolean;
            reason: string | null;
            /** @enum {string} */
            authentication: "none" | "cli-session";
          };
          finalEntry: {
            supported: boolean;
            available: boolean;
            reason: string | null;
            /** @enum {string} */
            authentication: "none" | "cli-session";
          };
          /** @constant */
          contextPrecondition: true;
        };
        /** @enum {string} */
        storage: "durable-redis" | "ephemeral-memory" | "unconfigured";
        /** @enum {string} */
        paymentState: "not-requested" | "game-credits";
        /** @constant */
        rewardEligible: false;
      }[];
    };
    CliContext: {
      contextHash: string;
      runtimeContextHash: string | null;
      manifestHash: string;
      evaluatorVersion: string;
      dataVersion: string;
      metrics: {
        key: string;
        name: string;
        /** @enum {string} */
        direction: "MINIMIZE" | "MAXIMIZE";
        unit: string;
        lowerBound: number;
        upperBound: number;
      }[];
      /** @enum {string} */
      evidenceState: "measured" | "simulated";
    };
    CliProject: {
      /** @constant */
      schemaVersion: "1";
      /** @enum {string} */
      arenaId: "disaster-response" | "rescue-room";
      /** Format: uri */
      baseUrl: string;
      /** @enum {string} */
      artifact: "strategy.json" | "doctrine.json";
      provenance: {
        /** @enum {string} */
        kind: "human" | "agent";
        name?: string;
        version?: string;
        objective?: string;
        /** Format: uri */
        repositoryUrl?: string;
        sourceCommit?: string;
      };
    };
    CliLock: {
      /** @constant */
      schemaVersion: "1";
      /** @enum {string} */
      arenaId: "disaster-response" | "rescue-room";
      /** Format: uri */
      baseUrl: string;
      context: {
        contextHash: string;
        runtimeContextHash: string | null;
        manifestHash: string;
        evaluatorVersion: string;
        dataVersion: string;
        metrics: {
          key: string;
          name: string;
          /** @enum {string} */
          direction: "MINIMIZE" | "MAXIMIZE";
          unit: string;
          lowerBound: number;
          upperBound: number;
        }[];
        /** @enum {string} */
        evidenceState: "measured" | "simulated";
      };
      schemaHash: string;
      starterSha256: string;
      episodeId: string | null;
    };
    CliRun: {
      /** @constant */
      schemaVersion: "1";
      runId: string;
      /** @enum {string} */
      arenaId: "disaster-response" | "rescue-room";
      /** Format: uri */
      baseUrl: string;
      /** Format: date-time */
      createdAt: string;
      context: {
        contextHash: string;
        runtimeContextHash: string | null;
        manifestHash: string;
        evaluatorVersion: string;
        dataVersion: string;
        metrics: {
          key: string;
          name: string;
          /** @enum {string} */
          direction: "MINIMIZE" | "MAXIMIZE";
          unit: string;
          lowerBound: number;
          upperBound: number;
        }[];
        /** @enum {string} */
        evidenceState: "measured" | "simulated";
      };
      episodeId: string | null;
      artifact: {
        [key: string]: unknown;
      };
      artifactHash: string;
      resultHash: string;
      correctness: boolean;
      values: {
        [key: string]: number;
      };
      raw: {
        [key: string]: unknown;
      };
    };
    CliApiError: {
      error: {
        code: string;
        message: string;
        details?: unknown;
      };
    };
    CliDisasterPracticeResult: {
      /** @constant */
      schemaVersion: "2";
      arenaId: string;
      dataVersion: string;
      evaluatorVersion: string;
      contextHash: string;
      manifestHash: string;
      resultHash: string;
      finalScenarioCommitment: string;
      strategy: {
        /** @constant */
        schemaVersion: "2";
        name: string;
        primarySupplierOrder: (
          "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge"
        )[];
        emergencySupplierOrder: (
          "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge"
        )[];
        /** @enum {string} */
        regionPolicy: "deadline-first" | "highest-need" | "equalize-coverage";
        reserveKits: number;
        emergencyBudgetUsd: number;
      };
      correctness: boolean;
      constraintFailures: string[];
      totalProcurementCost: number;
      worstCaseDeliveredKits: number;
      regionalFairnessPpm: number;
      scenarioOutcomes: {
        [key: string]: unknown;
      }[];
      pareto: {
        [key: string]: unknown;
      };
      contribution: {
        [key: string]: unknown;
      };
      /** @constant */
      state: "measured";
      inputHash: string;
    } & {
      [key: string]: unknown;
    };
    CliRescuePracticeInput: {
      episodeId: string;
      doctrine: {
        /** @constant */
        schemaVersion: "rescue-doctrine-v0";
        name: string;
        constraints: {
          investigationBudgetCredits: number;
          maxServicePriceCredits: number;
          allowedServiceIds: (
            | "pulse-monitor"
            | "trace-audit"
            | "accounting-audit"
            | "second-opinion"
            | "patch-builder"
            | "patch-verifier"
          )[];
          allowedProtocolActions: (
            | "PAUSE_MODULE"
            | "PAUSE_PROTOCOL"
            | "APPLY_PATCH"
            | "RESUME_MODULE"
            | "RESUME_PROTOCOL"
            | "WAIT"
            | "CLOSE_INCIDENT"
          )[];
        };
        rules: {
          minimumEvidenceCount: number;
          minimumConfidencePpm: number;
          /** @enum {string} */
          disagreementAction: "second-opinion" | "wait" | "contain";
          /** @enum {string} */
          containmentScope: "none" | "module" | "protocol";
          servicePriority: (
            "pulse-monitor" | "trace-audit" | "accounting-audit" | "second-opinion"
          )[];
          requirePatchVerification: boolean;
          /** @enum {string} */
          budgetExhaustedAction: "wait" | "close" | "contain";
        };
      };
    };
    CliRescuePracticeResult: {
      /** @constant */
      schemaVersion: "rescue-doctrine-practice-evaluation-v0";
      arenaId: string;
      contextId: string;
      contextHash: string;
      doctrineContextHash: string;
      manifestHash: string;
      doctrine: {
        /** @constant */
        schemaVersion: "rescue-doctrine-v0";
        name: string;
        constraints: {
          investigationBudgetCredits: number;
          maxServicePriceCredits: number;
          allowedServiceIds: (
            | "pulse-monitor"
            | "trace-audit"
            | "accounting-audit"
            | "second-opinion"
            | "patch-builder"
            | "patch-verifier"
          )[];
          allowedProtocolActions: (
            | "PAUSE_MODULE"
            | "PAUSE_PROTOCOL"
            | "APPLY_PATCH"
            | "RESUME_MODULE"
            | "RESUME_PROTOCOL"
            | "WAIT"
            | "CLOSE_INCIDENT"
          )[];
        };
        rules: {
          minimumEvidenceCount: number;
          minimumConfidencePpm: number;
          /** @enum {string} */
          disagreementAction: "second-opinion" | "wait" | "contain";
          /** @enum {string} */
          containmentScope: "none" | "module" | "protocol";
          servicePriority: (
            "pulse-monitor" | "trace-audit" | "accounting-audit" | "second-opinion"
          )[];
          requirePatchVerification: boolean;
          /** @enum {string} */
          budgetExhaustedAction: "wait" | "close" | "contain";
        };
      };
      doctrineHash: string;
      interpreterVersion: string;
      decisions: {
        [key: string]: unknown;
      }[];
      episode: {
        id: string;
        initialHeadline: string;
        revealedAfterRun: {
          [key: string]: unknown;
        };
      };
      outcome: {
        episodeId: string;
        episodeHash: string;
        correctness: boolean;
        invalidReason: string | null;
        userLossUsd: number;
        servedProtocolDemandPpm: number;
        netResponseSpendCredits: number;
        transcript: {
          [key: string]: unknown;
        }[];
        transcriptHash: string;
        resultHash: string;
      } & {
        [key: string]: unknown;
      };
      replay: {
        /** @constant */
        deterministic: true;
        actionCount: number;
        resultHash: string;
        /** @constant */
        matchesRecordedOutcome: true;
      };
      evaluationHash: string;
      /** @constant */
      state: "simulated";
      /** @constant */
      strategyState: "deterministic-rules";
      /** @constant */
      paymentState: "game-credits";
      rewardEligibility: {
        /** @constant */
        eligible: false;
        reason: string;
      };
    } & {
      [key: string]: unknown;
    };
    CliSubmission: {
      submissionId: string;
      participantId: string;
      challengeId: string;
      revision: number;
      /** @enum {string} */
      sourceMethod: "VISUAL" | "JSON" | "UPLOAD" | "AGENT_API";
      sourceHash: string;
      inputHash: string;
      repositoryUrl: string | null;
      sourceCommit: string | null;
      agentEvidence: {
        name: string;
        version: string;
        objective: string;
      } | null;
      artifact: {
        strategy: {
          /** @constant */
          schemaVersion: "2";
          name: string;
          primarySupplierOrder: (
            "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge"
          )[];
          emergencySupplierOrder: (
            "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge"
          )[];
          /** @enum {string} */
          regionPolicy: "deadline-first" | "highest-need" | "equalize-coverage";
          reserveKits: number;
          emergencyBudgetUsd: number;
        };
      };
      evaluation: {
        /** @constant */
        schemaVersion: "2";
        arenaId: string;
        dataVersion: string;
        evaluatorVersion: string;
        contextHash: string;
        manifestHash: string;
        resultHash: string;
        finalScenarioCommitment: string;
        strategy: {
          /** @constant */
          schemaVersion: "2";
          name: string;
          primarySupplierOrder: (
            "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge"
          )[];
          emergencySupplierOrder: (
            "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge"
          )[];
          /** @enum {string} */
          regionPolicy: "deadline-first" | "highest-need" | "equalize-coverage";
          reserveKits: number;
          emergencyBudgetUsd: number;
        };
        correctness: boolean;
        constraintFailures: string[];
        totalProcurementCost: number;
        worstCaseDeliveredKits: number;
        regionalFairnessPpm: number;
        scenarioOutcomes: {
          [key: string]: unknown;
        }[];
        pareto: {
          [key: string]: unknown;
        };
        contribution: {
          [key: string]: unknown;
        };
      } & {
        [key: string]: unknown;
      };
      submittedAt: string;
    };
    CliSubmissionResult: {
      /** @enum {string} */
      storage: "ephemeral-memory" | "durable-redis";
      submission: {
        submissionId: string;
        participantId: string;
        challengeId: string;
        revision: number;
        /** @enum {string} */
        sourceMethod: "VISUAL" | "JSON" | "UPLOAD" | "AGENT_API";
        sourceHash: string;
        inputHash: string;
        repositoryUrl: string | null;
        sourceCommit: string | null;
        agentEvidence: {
          name: string;
          version: string;
          objective: string;
        } | null;
        artifact: {
          strategy: {
            /** @constant */
            schemaVersion: "2";
            name: string;
            primarySupplierOrder: (
              "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge"
            )[];
            emergencySupplierOrder: (
              "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge"
            )[];
            /** @enum {string} */
            regionPolicy: "deadline-first" | "highest-need" | "equalize-coverage";
            reserveKits: number;
            emergencyBudgetUsd: number;
          };
        };
        evaluation: {
          /** @constant */
          schemaVersion: "2";
          arenaId: string;
          dataVersion: string;
          evaluatorVersion: string;
          contextHash: string;
          manifestHash: string;
          resultHash: string;
          finalScenarioCommitment: string;
          strategy: {
            /** @constant */
            schemaVersion: "2";
            name: string;
            primarySupplierOrder: (
              "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge"
            )[];
            emergencySupplierOrder: (
              "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge"
            )[];
            /** @enum {string} */
            regionPolicy: "deadline-first" | "highest-need" | "equalize-coverage";
            reserveKits: number;
            emergencyBudgetUsd: number;
          };
          correctness: boolean;
          constraintFailures: string[];
          totalProcurementCost: number;
          worstCaseDeliveredKits: number;
          regionalFairnessPpm: number;
          scenarioOutcomes: {
            [key: string]: unknown;
          }[];
          pareto: {
            [key: string]: unknown;
          };
          contribution: {
            [key: string]: unknown;
          };
        } & {
          [key: string]: unknown;
        };
        submittedAt: string;
      };
    };
    CliMySubmissions: {
      participant: {
        participantId: string;
        challengeId: string;
        userIdHash: string;
        wallet: string;
        displayName: string;
        joinedAt: string;
      } | null;
      submissions: {
        submissionId: string;
        participantId: string;
        challengeId: string;
        revision: number;
        /** @enum {string} */
        sourceMethod: "VISUAL" | "JSON" | "UPLOAD" | "AGENT_API";
        sourceHash: string;
        inputHash: string;
        repositoryUrl: string | null;
        sourceCommit: string | null;
        agentEvidence: {
          name: string;
          version: string;
          objective: string;
        } | null;
        artifact: {
          strategy: {
            /** @constant */
            schemaVersion: "2";
            name: string;
            primarySupplierOrder: (
              "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge"
            )[];
            emergencySupplierOrder: (
              "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge"
            )[];
            /** @enum {string} */
            regionPolicy: "deadline-first" | "highest-need" | "equalize-coverage";
            reserveKits: number;
            emergencyBudgetUsd: number;
          };
        };
        evaluation: {
          /** @constant */
          schemaVersion: "2";
          arenaId: string;
          dataVersion: string;
          evaluatorVersion: string;
          contextHash: string;
          manifestHash: string;
          resultHash: string;
          finalScenarioCommitment: string;
          strategy: {
            /** @constant */
            schemaVersion: "2";
            name: string;
            primarySupplierOrder: (
              "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge"
            )[];
            emergencySupplierOrder: (
              "harbor-aid" | "northstar" | "inland-works" | "local-grid" | "airbridge"
            )[];
            /** @enum {string} */
            regionPolicy: "deadline-first" | "highest-need" | "equalize-coverage";
            reserveKits: number;
            emergencyBudgetUsd: number;
          };
          correctness: boolean;
          constraintFailures: string[];
          totalProcurementCost: number;
          worstCaseDeliveredKits: number;
          regionalFairnessPpm: number;
          scenarioOutcomes: {
            [key: string]: unknown;
          }[];
          pareto: {
            [key: string]: unknown;
          };
          contribution: {
            [key: string]: unknown;
          };
        } & {
          [key: string]: unknown;
        };
        submittedAt: string;
      }[];
      finalEntry: {
        participantId: string;
        challengeId: string;
        submissionId: string;
        selectedAt: string;
      } | null;
    };
    CliJoinResult: {
      /** @enum {string} */
      storage: "ephemeral-memory" | "durable-redis";
      participant: {
        participantId: string;
        challengeId: string;
        userIdHash: string;
        wallet: string;
        displayName: string;
        joinedAt: string;
      };
    };
    CliFinalEntryInput: {
      submissionId: string;
    };
    CliFinalEntryResult: {
      /** @enum {string} */
      storage: "ephemeral-memory" | "durable-redis";
      finalEntry: {
        participantId: string;
        challengeId: string;
        submissionId: string;
        selectedAt: string;
      };
    };
    CliAuthDeviceInput: {
      scope?: string;
      scopes?: ("disaster:read" | "disaster:join" | "disaster:submit" | "disaster:entry")[];
    };
    CliAuthDeviceResult: {
      device_code: string;
      user_code: string;
      /** Format: uri */
      verification_uri: string;
      expires_in: number;
      interval: number;
    };
    CliAuthCodeInput: {
      user_code: string;
    };
    CliAuthApprovalInput: {
      user_code: string;
      /** @enum {string} */
      decision: "approve" | "deny";
    };
    CliAuthInspection: {
      /** Format: uri */
      origin: string;
      scopes: ("disaster:read" | "disaster:join" | "disaster:submit" | "disaster:entry")[];
      /** Format: date-time */
      expiresAt: string;
      session_expires_in: number;
    };
    CliAuthApprovalResult: {
      /** @enum {string} */
      status: "approved" | "denied";
    };
    CliAuthTokenInput: {
      device_code: string;
    };
    CliAuthTokenResult: {
      access_token: string;
      /** @constant */
      token_type: "Bearer";
      expires_in: number;
    } & {
      [key: string]: unknown;
    };
    CliAuthSession: {
      userId: string;
      wallet: string;
      scopes: ("disaster:read" | "disaster:join" | "disaster:submit" | "disaster:entry")[];
      /** Format: date-time */
      expiresAt: string;
      /** @constant */
      revoked: false;
    } & {
      [key: string]: unknown;
    };
    CliAuthRevoked: {
      /** @constant */
      revoked: true;
    };
  };
  responses: {
    /** @description Invalid input */
    BadRequest: {
      headers: {
        [name: string]: unknown;
      };
      content: {
        "application/json": components["schemas"]["Error"];
      };
    };
    /** @description Resource not found */
    NotFound: {
      headers: {
        [name: string]: unknown;
      };
      content: {
        "application/json": components["schemas"]["Error"];
      };
    };
  };
  parameters: {
    Id: components["schemas"]["Bytes32"];
  };
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
  getHealth: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Healthy */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  listArenas: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Arena list */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  getSecretGateScenario: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Public Secret Gate scenario */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  enrollSecretGateCommitment: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["SecretGateEnrollment"];
      };
    };
    responses: {
      /** @description Trusted 30-minute synthetic group snapshot */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      400: components["responses"]["BadRequest"];
      /** @description Durable production storage is unavailable */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  verifySecretGateEntry: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["SecretGateEntry"];
      };
    };
    responses: {
      /** @description Gate opened with offchain verification receipt */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      400: components["responses"]["BadRequest"];
      /** @description Nullifier was already used for this Gate scope */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description Durable production storage is unavailable */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  getEmergencySupplyScenario: {
    parameters: {
      query?: {
        contextId?: "public-normal-operations" | "public-port-constrained";
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Public emergency-supply scenario */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  evaluateEmergencySupplyAllocation: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["SupplyEvaluationInput"];
      };
    };
    responses: {
      /** @description Measured allocation with failure evidence and result hash */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      400: components["responses"]["BadRequest"];
    };
  };
  replayEmergencySupplyAgents: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Deterministic Agent A/B/C replay */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  getEmergencySupplyCompetition: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Emergency Supply competition lobby */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  downloadEmergencySupplyStarterKit: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Emergency Supply starter ZIP */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/zip": string;
        };
      };
    };
  };
  getEmergencySupplyLeaderboard: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Live frontier leaderboard */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  joinEmergencySupplyCompetition: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Authenticated participant created or restored */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description Privy token missing or invalid */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description Server authentication or durable storage unavailable */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  submitEmergencySupplyRevision: {
    parameters: {
      query?: never;
      header: {
        "Idempotency-Key": string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["Plan5SubmissionInput"];
      };
    };
    responses: {
      /** @description Persisted and evaluated revision */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      400: components["responses"]["BadRequest"];
      /** @description Privy token missing or invalid */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  getMyEmergencySupplySubmissions: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Participant */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  selectEmergencySupplyFinalEntry: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": Record<string, never>;
      };
    };
    responses: {
      /** @description Current Final Entry saved */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  settleEmergencySupplyDemoReward: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Sepolia RewardPaid receipt persisted */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description No valid rewarding Final Entry */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description Capped Sepolia relayer unavailable */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  getMyEmergencySupplyReward: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Current reward and transaction state */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  getDisasterResponseScenario: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Public disaster-response scenario */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  practiceDisasterResponseStrategy: {
    parameters: {
      query?: never;
      header?: {
        /** @description Expected context; CLI always sends this precondition. */
        "X-Frontier-Context-Hash"?: components["schemas"]["Bytes32"];
        /** @description Required with a context precondition for Doctrine evaluations. */
        "X-Frontier-Runtime-Context-Hash"?: components["schemas"]["Bytes32"];
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["DisasterResponseStrategy"];
      };
    };
    responses: {
      /** @description Validated response; independent metrics and evidence states are preserved */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliDisasterPracticeResult"];
        };
      };
      /** @description Structured API error */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
    };
  };
  getDisasterResponseCompetition: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Disaster-response competition lobby */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  downloadDisasterResponseStarterKit: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Manifest */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/zip": string;
        };
      };
    };
  };
  getDisasterResponseLeaderboard: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Three-axis frontier */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  publishDisasterResponseValuePool: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["Plan6ValuePoolInput"];
      };
    };
    responses: {
      /** @description Practice Value Pool manifest persisted */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      400: components["responses"]["BadRequest"];
      /** @description Privy token missing or invalid */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description This account already published its practice Value Pool */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  joinDisasterResponseCompetition: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Validated response; independent metrics and evidence states are preserved */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliJoinResult"];
        };
      };
      /** @description Structured API error */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
    };
  };
  submitDisasterResponseRevision: {
    parameters: {
      query?: never;
      header: {
        /** @description Expected context; CLI always sends this precondition. */
        "X-Frontier-Context-Hash"?: components["schemas"]["Bytes32"];
        /** @description Required with a context precondition for Doctrine evaluations. */
        "X-Frontier-Runtime-Context-Hash"?: components["schemas"]["Bytes32"];
        /** @description Bind one immutable body to one operation; reuse on retry. */
        "Idempotency-Key": string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["Plan6SubmissionInput"];
      };
    };
    responses: {
      /** @description Existing submission returned for the identical idempotent operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliSubmissionResult"];
        };
      };
      /** @description Validated response; independent metrics and evidence states are preserved */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliSubmissionResult"];
        };
      };
      /** @description Structured API error */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
    };
  };
  getMyDisasterResponseSubmissions: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Validated response; independent metrics and evidence states are preserved */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliMySubmissions"];
        };
      };
      /** @description Structured API error */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
    };
  };
  selectDisasterResponseFinalEntry: {
    parameters: {
      query?: never;
      header?: {
        /** @description Expected context; CLI always sends this precondition. */
        "X-Frontier-Context-Hash"?: components["schemas"]["Bytes32"];
        /** @description Required with a context precondition for Doctrine evaluations. */
        "X-Frontier-Runtime-Context-Hash"?: components["schemas"]["Bytes32"];
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": {
          submissionId: components["schemas"]["Bytes32"];
        };
      };
    };
    responses: {
      /** @description Validated response; independent metrics and evidence states are preserved */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliFinalEntryResult"];
        };
      };
      /** @description Structured API error */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
    };
  };
  settleDisasterResponseDemoReward: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Committed Value Pool allocation paid and persisted */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description No valid rewarding Final Entry */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description Capped Sepolia relayer unavailable */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  getMyDisasterResponseReward: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Value Pool breakdown */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  getCalldataCompressionScenario: {
    parameters: {
      query?: {
        contextId?: "public-transfer-mix" | "public-low-reuse";
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Public calldata-compression scenario */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  evaluateCalldataCodec: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["CalldataEvaluationInput"];
      };
    };
    responses: {
      /** @description Measured codec with per-batch EVM evidence and result hash */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      400: components["responses"]["BadRequest"];
    };
  };
  getMicrogridDispatchScenario: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Public microgrid-dispatch scenario */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  evaluateMicrogridDispatch: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["MicrogridEvaluationInput"];
      };
    };
    responses: {
      /** @description Measured three-axis outcome and result hash */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      400: components["responses"]["BadRequest"];
    };
  };
  getRescueRoomScenario: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Public Rescue Room Practice context */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  downloadRescueRoomStarterKit: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Rescue Room Controlled Practice Starter Kit */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/zip": string;
        };
      };
    };
  };
  evaluateRescueRoomPracticeEpisode: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["RescueRoomEvaluationInput"];
      };
    };
    responses: {
      /** @description Simulated Episode Replay and three-axis Practice outcome */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      400: components["responses"]["BadRequest"];
    };
  };
  evaluateRescueRoomDoctrine: {
    parameters: {
      query?: never;
      header?: {
        /** @description Expected context; CLI always sends this precondition. */
        "X-Frontier-Context-Hash"?: components["schemas"]["Bytes32"];
        /** @description Required with a context precondition for Doctrine evaluations. */
        "X-Frontier-Runtime-Context-Hash"?: components["schemas"]["Bytes32"];
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["RescueRoomDoctrineEvaluationInput"];
      };
    };
    responses: {
      /** @description Validated response; independent metrics and evidence states are preserved */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliRescuePracticeResult"];
        };
      };
      /** @description Structured API error */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Structured API error */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
    };
  };
  evaluateRescueRoomAiCommander: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["RescueRoomCommanderEvaluationInput"];
      };
    };
    responses: {
      /** @description Simulated outcome with AI provenance and verified Action replay */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      400: components["responses"]["BadRequest"];
      /** @description AI Commander rate limit exceeded */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description OpenAI Commander execution failed */
      502: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description OpenAI Commander runtime is not configured */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description OpenAI Commander Episode timed out */
      504: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  registerSandboxParticipant: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["SandboxRegistration"];
      };
    };
    responses: {
      /** @description Ephemeral wallet-only participant */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  createSandboxSubmission: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": Record<string, never>;
      };
    };
    responses: {
      /** @description Measured submission revision */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      400: components["responses"]["BadRequest"];
    };
  };
  listSandboxSubmissions: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        participantId: components["schemas"]["Bytes32"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Ephemeral revision history */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  selectSandboxFinalEntry: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": Record<string, never>;
      };
    };
    responses: {
      /** @description Selected but unfrozen final entry */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  getArena: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components["parameters"]["Id"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Arena */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      404: components["responses"]["NotFound"];
    };
  };
  getArenaFrontier: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components["parameters"]["Id"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Non-dominated artifacts */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  getChallenge: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components["parameters"]["Id"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Challenge */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      404: components["responses"]["NotFound"];
    };
  };
  getFrontier: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components["parameters"]["Id"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Non-dominated artifacts */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  listArtifacts: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components["parameters"]["Id"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Evaluated artifacts */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  listAttestations: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components["parameters"]["Id"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Signed attestations */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  createDispute: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components["parameters"]["Id"];
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["DisputeInput"];
      };
    };
    responses: {
      /** @description Dispute recorded */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      400: components["responses"]["BadRequest"];
    };
  };
  createArtifact: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": Record<string, never>;
      };
    };
    responses: {
      /** @description Artifact registered */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      400: components["responses"]["BadRequest"];
    };
  };
  getArtifact: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components["parameters"]["Id"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Artifact */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      404: components["responses"]["NotFound"];
    };
  };
  evaluateArtifact: {
    parameters: {
      query?: never;
      header?: {
        "Idempotency-Key"?: string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["EvaluationInput"];
      };
    };
    responses: {
      /** @description Evaluation accepted. Public demo deployments return a clearly labeled simulated terminal state without a signature or transaction. */
      202: {
        headers: {
          Location?: string;
          [name: string]: unknown;
        };
        content?: never;
      };
      400: components["responses"]["BadRequest"];
      /** @description Payment required at the Bazantic gateway */
      402: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  getEvaluation: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        jobId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Evaluation state */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      404: components["responses"]["NotFound"];
    };
  };
  listRunners: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Live ENS runners */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  getRunner: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        ensName: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description ENS runner */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description ENS unavailable or unconfigured */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  listCliArenas: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Versioned capabilities for supported CLI arenas */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliArenaList"];
        };
      };
    };
  };
  getCliArena: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: "disaster-response" | "rescue-room";
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Public input contract, fixed context, archive digest and live capabilities */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliArenaManifest"];
        };
      };
      /** @description Unsupported arena */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
    };
  };
  cliAuthDevice: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["CliAuthDeviceInput"];
      };
    };
    responses: {
      /** @description No-store authorization response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliAuthDeviceResult"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      415: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
    };
  };
  cliAuthInspect: {
    parameters: {
      query?: never;
      header: {
        /** @description Must equal configured FRONTIER_CLI_ORIGIN */
        Origin: string;
        "X-Frontier-Cli-Csrf": "1";
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["CliAuthCodeInput"];
      };
    };
    responses: {
      /** @description No-store authorization response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliAuthInspection"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      415: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
    };
  };
  cliAuthApprove: {
    parameters: {
      query?: never;
      header: {
        /** @description Must equal configured FRONTIER_CLI_ORIGIN */
        Origin: string;
        "X-Frontier-Cli-Csrf": "1";
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["CliAuthApprovalInput"];
      };
    };
    responses: {
      /** @description No-store authorization response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliAuthApprovalResult"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      415: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
    };
  };
  cliAuthToken: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["CliAuthTokenInput"];
      };
    };
    responses: {
      /** @description No-store authorization response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliAuthTokenResult"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      415: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
    };
  };
  cliAuthSession: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description No-store authorization response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliAuthSession"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      415: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
    };
  };
  cliAuthRevoke: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description No-store authorization response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliAuthRevoked"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      415: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
      /** @description Authorization error; authorization_pending and slow_down are polling states, not new login requests */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CliApiError"];
        };
      };
    };
  };
}
