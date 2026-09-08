import { z } from "zod";

const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

const optionalString = z.preprocess(blankToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(blankToUndefined, z.url().optional());
const optionalAddress = z.preprocess(
  blankToUndefined,
  z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional(),
);
const optionalHash = z.preprocess(
  blankToUndefined,
  z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .optional(),
);

export const environmentSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3001),
  ALLOW_INSECURE_LOCAL_SIGNER: z.preprocess(blankToUndefined, z.enum(["true", "false"]).optional()),
  BAZANTIC_GATEWAY_URL: optionalUrl,
  BAZANTIC_RECIPE_ID: optionalString,
  BAZANTIC_SERVICE_ID: optionalString,
  CHALLENGE_REGISTRY_ADDRESS: optionalAddress,
  ARTIFACT_REGISTRY_ADDRESS: optionalAddress,
  ATTESTATION_ADDRESS: optionalAddress,
  DEPLOYER_PRIVATE_KEY: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .optional(),
  ),
  DEPLOYER_ADDRESS: optionalAddress,
  ENS_PARENT_NAME: optionalString,
  ETHERSCAN_API_KEY: optionalString,
  LEDGER_DERIVATION_PATH: optionalString,
  LEDGER_RING_FILE: optionalString,
  LEDGER_RING_KEY: optionalString,
  LEDGER_SIGNING_MODE: z.preprocess(blankToUndefined, z.enum(["development", "dmk"]).optional()),
  NEXT_PUBLIC_CHAIN_ID: z.coerce.number().int().default(11155111).pipe(z.literal(11155111)),
  NEXT_PUBLIC_ALLOCATION_TX_HASH: optionalHash,
  NEXT_PUBLIC_DEMO_TOKEN_ADDRESS: optionalAddress,
  NEXT_PUBLIC_DEPLOYMENT_URL: optionalUrl,
  NEXT_PUBLIC_PRIVY_APP_ID: optionalString,
  NEXT_PUBLIC_RESULT_ROOT: optionalHash,
  NEXT_PUBLIC_REWARD_AMOUNT: optionalString,
  NEXT_PUBLIC_REWARD_BALANCE_AFTER: optionalString,
  NEXT_PUBLIC_REWARD_BALANCE_BEFORE: optionalString,
  NEXT_PUBLIC_REWARD_POOL_ADDRESS: optionalAddress,
  NEXT_PUBLIC_REWARD_RECIPIENT: optionalAddress,
  NEXT_PUBLIC_SETTLEMENT_BLOCK_NUMBER: z.preprocess(
    blankToUndefined,
    z.string().regex(/^\d+$/).optional(),
  ),
  NEXT_PUBLIC_SETTLEMENT_TX_HASH: optionalHash,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  RUNNER_PORT: z.coerce.number().int().positive().default(3002),
  RUNNER_PUBLIC_URL: optionalUrl,
  PARETO_SETTLEMENT_ADDRESS: optionalAddress,
  PLAN5_DEMO_TOKEN_ADDRESS: optionalAddress,
  PLAN5_MAX_REWARD_CREDITS: z.preprocess(blankToUndefined, z.string().regex(/^\d+$/).optional()),
  PLAN5_RELAYER_PRIVATE_KEY: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .optional(),
  ),
  PLAN5_REWARD_POOL_ADDRESS: optionalAddress,
  PLAN5_SETTLEMENT_ENABLED: z.preprocess(blankToUndefined, z.enum(["true", "false"]).optional()),
  PRIVY_VERIFICATION_KEY: optionalString,
  KV_REST_API_URL: optionalUrl,
  KV_REST_API_TOKEN: optionalString,
  SEPOLIA_RPC_URL: optionalUrl,
});

export type FrontierEnvironment = z.infer<typeof environmentSchema>;

export function parseEnvironment(input: Record<string, string | undefined>): FrontierEnvironment {
  const result = environmentSchema.safeParse(input);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return result.data;
}
