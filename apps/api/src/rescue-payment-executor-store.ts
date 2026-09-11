import { mkdir, open, readFile, rmdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import {
  rescuePaymentExecutorHash,
  type RescuePaymentDurableStore,
  type RescuePaymentJournalState,
} from "./rescue-payment-executor";

/**
 * Single-host local operator adapter, not a distributed/serverless store. Exclusive lock
 * acquisition is fail-fast; callers retry lock-busy later. Never expires/removes another
 * process's lock. After a crash, an operator must prove the old process stopped, reconcile
 * receipts, then remove ONLY the abandoned empty lock directory. Journal must be on a local
 * filesystem with working append/fsync semantics, protected from edits and backed up.
 * Raw transactions are replayable authorization: treat this directory as private material.
 */
export function createRescuePaymentFileStore(directory: string): RescuePaymentDurableStore {
  const root = resolve(directory);
  const lock = join(root, "executor.lock");
  const journal = join(root, "payments.jsonl");
  return {
    async exclusive(run) {
      await mkdir(root, { recursive: true, mode: 0o700 });
      try {
        await mkdir(lock, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST")
          throw new Error("Payment journal locked; retry or reconcile an abandoned lock");
        throw error;
      }
      try {
        let source = "";
        try {
          source = await readFile(journal, "utf8");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        if (source && !source.endsWith("\n"))
          throw new Error("Truncated payment journal; operator recovery required");
        let state: RescuePaymentJournalState = { version: 1, limits: null, records: {} };
        let sequence = 0;
        let previousHash = "genesis";
        for (const line of source.split("\n").filter(Boolean)) {
          const entry = JSON.parse(line) as {
            sequence: number;
            previousHash: string;
            state: RescuePaymentJournalState;
            hash: string;
          };
          const body = {
            sequence: entry.sequence,
            previousHash: entry.previousHash,
            state: entry.state,
          };
          if (
            entry.sequence !== sequence + 1 ||
            entry.previousHash !== previousHash ||
            entry.hash !== rescuePaymentExecutorHash(body) ||
            entry.state.version !== 1 ||
            typeof entry.state.records !== "object" ||
            entry.state.records === null
          )
            throw new Error("Invalid payment journal; operator recovery required");
          state = entry.state;
          sequence = entry.sequence;
          previousHash = entry.hash;
        }
        const persist = async () => {
          const body = { sequence: sequence + 1, previousHash, state };
          const hash = rescuePaymentExecutorHash(body);
          const file = await open(journal, "a", 0o600);
          try {
            await file.writeFile(`${JSON.stringify({ ...body, hash })}\n`, "utf8");
            await file.sync();
          } finally {
            await file.close();
          }
          sequence += 1;
          previousHash = hash;
        };
        return await run(state, persist);
      } finally {
        await rmdir(lock);
      }
    },
  };
}
