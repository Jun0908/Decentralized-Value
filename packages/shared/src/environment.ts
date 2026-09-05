import { z } from "zod";

const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

const optionalString = z.preprocess(blankToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(blankToUndefined, z.url().optional());

export const environmentSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3001),
  BAZANTIC_GATEWAY_URL: optionalUrl,
  DEPLOYER_PRIVATE_KEY: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .optional(),
  ),
  ENS_PARENT_NAME: optionalString,
  ETHERSCAN_API_KEY: optionalString,
  LEDGER_DERIVATION_PATH: optionalString,
  LEDGER_SIGNING_MODE: z.preprocess(blankToUndefined, z.enum(["development", "dmk"]).optional()),
  NEXT_PUBLIC_CHAIN_ID: z.coerce.number().int().default(11155111).pipe(z.literal(11155111)),
  NEXT_PUBLIC_FRONTIER_API_URL: z.url().default("http://localhost:3001"),
  NEXT_PUBLIC_PRIVY_APP_ID: optionalString,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  RUNNER_PORT: z.coerce.number().int().positive().default(3002),
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
