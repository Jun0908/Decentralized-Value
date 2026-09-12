import { z } from "zod";
import { normalize } from "viem/ens";
import type { EnsRecordReader } from "./index";

export const rescueServiceRecordKey = "frontier.rescue.service";
export const rescueEnsServiceSchema = z
  .object({
    schemaVersion: z.literal("frontier-rescue-service-v1"),
    capability: z.literal("rescue-doctrine-public-practice"),
    apiOrigin: z.url(),
    status: z.enum(["active", "paused"]),
  })
  .strict();

/** Single-service discovery under an existing owned ENSv2 name. Only one text
 * key needs delegation. This does not change the legacy Runner job protocol. */
export class EnsRescueServiceDirectory {
  constructor(
    private readonly reader: Pick<EnsRecordReader, "getText">,
    private readonly allowedOrigins: readonly string[],
  ) {}

  async resolve(name: string) {
    const ensName = normalize(name);
    const text = await this.reader.getText(ensName, rescueServiceRecordKey);
    if (!text || text.length > 4096) throw new Error("ENS_RESCUE_RECORD_UNAVAILABLE");
    let record: z.infer<typeof rescueEnsServiceSchema>;
    try {
      record = rescueEnsServiceSchema.parse(JSON.parse(text));
    } catch {
      throw new Error("ENS_RESCUE_RECORD_INVALID");
    }
    const url = new URL(record.apiOrigin);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      !this.allowedOrigins.includes(url.origin)
    )
      throw new Error("ENS_RESCUE_ORIGIN_NOT_ALLOWED");
    if (record.status !== "active") throw new Error("ENS_RESCUE_SERVICE_PAUSED");
    return { ensName, recordKey: rescueServiceRecordKey, ...record, apiOrigin: url.origin };
  }
}
