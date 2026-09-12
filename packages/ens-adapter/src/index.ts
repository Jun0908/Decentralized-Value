import { getAddress, type Address, type PublicClient } from "viem";
import { normalize } from "viem/ens";
import { z } from "zod";
export {
  EnsRescueServiceDirectory,
  rescueEnsServiceSchema,
  rescueServiceRecordKey,
} from "./rescue";

export const RUNNER_RECORDS = {
  capability: "frontier.capabilities",
  endpoint: "url",
  role: "frontier.role",
  status: "frontier.status",
  version: "frontier.version",
} as const;

const activeRunnerSchema = z.object({
  ensName: z.string().min(1).endsWith(".eth"),
  signingAddress: z.string(),
  role: z.literal("runner"),
  capabilities: z.array(z.string().min(1)).min(1),
  endpoint: z
    .url()
    .refine((url) => new URL(url).protocol === "https:", "Runner endpoint must use HTTPS"),
  version: z.string().min(1),
  status: z.literal("active"),
});

export type ActiveRunner = Omit<z.infer<typeof activeRunnerSchema>, "signingAddress"> & {
  signingAddress: Address;
};

export interface EnsRecordReader {
  getAddress(name: string): Promise<Address | null>;
  getText(name: string, key: string): Promise<string | null>;
}

export class ViemEnsRecordReader implements EnsRecordReader {
  constructor(private readonly client: PublicClient) {}

  async getAddress(name: string): Promise<Address | null> {
    return this.client.getEnsAddress({ name: normalize(name) });
  }

  async getText(name: string, key: string): Promise<string | null> {
    return this.client.getEnsText({ key, name: normalize(name) });
  }
}

function required(value: string | null, label: string, name: string): string {
  if (!value?.trim()) throw new Error(`ENS runner ${name} is missing ${label}`);
  return value.trim();
}

export class EnsRunnerDirectory {
  constructor(
    private readonly reader: EnsRecordReader,
    private readonly runnersNamespace: string,
  ) {}

  async resolve(name: string): Promise<ActiveRunner> {
    const [signingAddress, role, capabilityText, endpoint, version, status] = await Promise.all([
      this.reader.getAddress(name),
      this.reader.getText(name, RUNNER_RECORDS.role),
      this.reader.getText(name, RUNNER_RECORDS.capability),
      this.reader.getText(name, RUNNER_RECORDS.endpoint),
      this.reader.getText(name, RUNNER_RECORDS.version),
      this.reader.getText(name, RUNNER_RECORDS.status),
    ]);
    if (!signingAddress) throw new Error(`ENS runner ${name} has no EVM address`);

    const parsed = activeRunnerSchema.parse({
      ensName: name,
      signingAddress,
      role: required(role, RUNNER_RECORDS.role, name),
      capabilities: required(capabilityText, RUNNER_RECORDS.capability, name)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      endpoint: required(endpoint, RUNNER_RECORDS.endpoint, name),
      version: required(version, RUNNER_RECORDS.version, name),
      status: required(status, RUNNER_RECORDS.status, name),
    });

    return { ...parsed, signingAddress: getAddress(parsed.signingAddress) };
  }

  async discover(requiredCapability: string): Promise<ActiveRunner[]> {
    const manifest = required(
      await this.reader.getText(this.runnersNamespace, "frontier.runners"),
      "frontier.runners",
      this.runnersNamespace,
    );
    const names = z
      .array(z.string().endsWith(`.${this.runnersNamespace}`))
      .min(1)
      .parse(JSON.parse(manifest));
    const candidates = await Promise.all(names.map((name) => this.resolve(name)));
    const capable = candidates.filter((runner) => runner.capabilities.includes(requiredCapability));
    if (capable.length === 0) {
      throw new Error(`No active ENS runner advertises capability ${requiredCapability}`);
    }
    return capable;
  }

  async assertSigner(name: string, recoveredAddress: Address): Promise<ActiveRunner> {
    const runner = await this.resolve(name);
    if (runner.signingAddress !== getAddress(recoveredAddress)) {
      throw new Error(`Attestation signer does not match ENS runner ${name}`);
    }
    return runner;
  }
}
