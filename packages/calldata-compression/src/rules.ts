import type { CalldataBatch, CodecId } from "./index";

export type CalldataRule = {
  minActions: number;
  maxActions: number;
  minReusePercent: number;
  codecId: CodecId;
};

export type CalldataRuleArtifact = {
  kind: "calldata-rules-v1";
  schemaVersion: "1";
  rules: CalldataRule[];
  fallbackCodec: CodecId;
};

export const calldataRulePresets = {
  adaptive: {
    kind: "calldata-rules-v1",
    schemaVersion: "1",
    rules: [{ minActions: 4, maxActions: 255, minReusePercent: 50, codecId: "dictionary" }],
    fallbackCodec: "packed",
  },
  abi: { kind: "calldata-rules-v1", schemaVersion: "1", rules: [], fallbackCodec: "abi" },
  packed: { kind: "calldata-rules-v1", schemaVersion: "1", rules: [], fallbackCodec: "packed" },
  dictionary: {
    kind: "calldata-rules-v1",
    schemaVersion: "1",
    rules: [],
    fallbackCodec: "dictionary",
  },
} satisfies Record<string, CalldataRuleArtifact>;

export class CalldataRuleValidationError extends Error {}

function record(value: unknown, keys: readonly string[], path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new CalldataRuleValidationError(`${path} must be an object.`);
  }
  const result = value as Record<string, unknown>;
  if (
    Object.keys(result).some((key) => !keys.includes(key)) ||
    keys.some((key) => !(key in result))
  ) {
    throw new CalldataRuleValidationError(`${path} must contain exactly: ${keys.join(", ")}.`);
  }
  return result;
}

function codec(value: unknown): CodecId {
  if (value !== "abi" && value !== "packed" && value !== "dictionary") {
    throw new CalldataRuleValidationError("Codec must be abi, packed, or dictionary.");
  }
  return value;
}

function integer(value: unknown, min: number, max: number, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new CalldataRuleValidationError(`${path} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

export function parseCalldataRuleArtifact(value: unknown): CalldataRuleArtifact {
  const artifact = record(value, ["kind", "schemaVersion", "rules", "fallbackCodec"], "Artifact");
  if (artifact.kind !== "calldata-rules-v1" || artifact.schemaVersion !== "1") {
    throw new CalldataRuleValidationError("Expected calldata-rules-v1 with schemaVersion 1.");
  }
  if (!Array.isArray(artifact.rules) || artifact.rules.length > 4) {
    throw new CalldataRuleValidationError("Rules must be an array with at most four entries.");
  }
  return {
    kind: "calldata-rules-v1",
    schemaVersion: "1",
    fallbackCodec: codec(artifact.fallbackCodec),
    rules: artifact.rules.map((value, index) => {
      const rule = record(
        value,
        ["minActions", "maxActions", "minReusePercent", "codecId"],
        `Rule ${index + 1}`,
      );
      const minActions = integer(rule.minActions, 1, 255, "Minimum actions");
      const maxActions = integer(rule.maxActions, 1, 255, "Maximum actions");
      if (maxActions < minActions)
        throw new CalldataRuleValidationError("Maximum actions must be at least the minimum.");
      return {
        minActions,
        maxActions,
        minReusePercent: integer(rule.minReusePercent, 0, 100, "Minimum reuse"),
        codecId: codec(rule.codecId),
      };
    }),
  };
}

export function selectCalldataRule(artifact: CalldataRuleArtifact, batch: CalldataBatch) {
  const actionCount = batch.actions.length;
  const uniqueRecipients = new Set(batch.actions.map(({ recipient }) => recipient.toLowerCase()))
    .size;
  const repeatedActions = actionCount - uniqueRecipients;
  const ruleIndex = artifact.rules.findIndex(
    (rule) =>
      actionCount >= rule.minActions &&
      actionCount <= rule.maxActions &&
      repeatedActions * 100 >= rule.minReusePercent * actionCount,
  );
  return {
    codecId: ruleIndex === -1 ? artifact.fallbackCodec : artifact.rules[ruleIndex]!.codecId,
    ruleIndex: ruleIndex === -1 ? null : ruleIndex,
    actionCount,
    uniqueRecipients,
    repeatedActions,
    reusePercent: actionCount ? (repeatedActions * 100) / actionCount : 0,
    reason:
      ruleIndex === -1
        ? "No rule matched; use fallback."
        : `Rule ${ruleIndex + 1} is the first match.`,
  };
}
