import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { defaultDisasterResponseStrategy } from "@frontier/disaster-response";
import { canonicalProtocolJson } from "@frontier/shared";
import type { Redis } from "@upstash/redis";
import { keccak256, stringToHex } from "viem";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createPlan6Participant,
  createPlan6SubmissionRecord,
  plan6SubmissionSchema,
  preparePlan6Submission,
} from "../../../api/src/plan6-competition";
import { RedisPlan6CompetitionStore } from "./plan6-store";

vi.mock("server-only", () => ({}));
vi.mock("@frontier/api", () => import("../../../api/src/plan6-competition"));

// Opt in with FRONTIER_VERIFY_REDIS=1. This suite owns its container and never uses a host Redis.
describe.skipIf(process.env.FRONTIER_VERIFY_REDIS !== "1")(
  "Disaster Response actual Redis Lua",
  () => {
    const containerName = `frontier-sdk-verification-${randomUUID()}`;
    let containerId: string | undefined;

    function docker(args: string[], stdin?: string): Promise<string> {
      return new Promise((resolve, reject) => {
        const child = spawn("docker", args, { windowsHide: true, shell: false, stdio: "pipe" });
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => child.kill(), 120_000);
        child.stdout.setEncoding("utf8").on("data", (data: string) => {
          stdout += data;
        });
        child.stderr.setEncoding("utf8").on("data", (data: string) => {
          stderr += data;
        });
        child.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.once("close", (code) => {
          clearTimeout(timer);
          if (code !== 0) reject(new Error(`Docker ${args[0]} exited ${code}: ${stderr}`));
          else resolve(stdout.trim());
        });
        child.stdin.on("error", reject);
        child.stdin.end(stdin);
      });
    }

    async function command(args: string[], stdin?: string): Promise<unknown> {
      if (!containerId) throw new Error("Test container was not created");
      // -X keeps large artifact JSON off the Windows command line and replaces one argument via stdin.
      const options = stdin === undefined ? [] : ["-X", "__FRONTIER_STDIN__"];
      return JSON.parse(
        await docker(
          ["exec", "-i", containerId, "redis-cli", "--json", ...options, ...args],
          stdin,
        ),
      );
    }

    beforeAll(async () => {
      const created = await docker([
        "create",
        "--name",
        containerName,
        "--network",
        "none",
        "--label",
        "frontier-sdk-verification=plan6",
        "redis:7.4-alpine",
        "redis-server",
        "--save",
        "",
        "--appendonly",
        "no",
      ]);
      if (!/^[a-f0-9]{64}$/.test(created)) throw new Error("Docker did not return a container ID");
      containerId = created;
      console.info(`Created isolated Redis container ${containerName} (${containerId})`);
      await docker(["start", containerId]);
      let inspection;
      let ready = false;
      let readinessError: unknown;
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          [inspection] = JSON.parse(await docker(["inspect", containerId]));
          if ((await command(["PING"])) === "PONG") {
            ready = true;
            break;
          }
        } catch (error) {
          readinessError = error;
        }
        await delay(200);
      }
      if (!ready) throw new Error("Isolated Redis did not become ready", { cause: readinessError });
      expect(inspection.HostConfig.NetworkMode).toBe("none");
      expect(Object.keys(inspection.HostConfig.PortBindings ?? {})).toHaveLength(0);
      expect(
        inspection.Mounts.filter((mount: { Type: string }) => mount.Type === "bind"),
      ).toHaveLength(0);
      console.info(await docker(["exec", containerId, "redis-server", "--version"]));
    }, 150_000);

    afterAll(async () => {
      if (!containerId) return;
      // Remove only the exact ID returned by this suite; -v removes its anonymous image volume.
      await docker(["rm", "--force", "--volumes", containerId]);
      expect(
        await docker(["ps", "--all", "--quiet", "--no-trunc", "--filter", `id=${containerId}`]),
      ).toBe("");
      console.info(`Removed isolated Redis container ${containerName} (${containerId})`);
    }, 150_000);

    async function fixture(label: string) {
      const participant = createPlan6Participant({
        userId: `${containerName}:${label}`,
        wallet: "0x1111111111111111111111111111111111111111",
      });
      const raw = plan6SubmissionSchema.parse({
        strategy: defaultDisasterResponseStrategy,
        sourceMethod: "JSON",
      });
      const input = preparePlan6Submission(participant, raw);
      const digest = keccak256(stringToHex(canonicalProtocolJson(raw)));
      const participantKey = `frontier:plan6:participant:${participant.participantId}`;
      await command(["SET", participantKey, "__FRONTIER_STDIN__"], JSON.stringify(participant));
      let loseNextResponse = false;
      const transport = {
        async get(key: string) {
          const value = await command(["GET", key]);
          if (typeof value !== "string") return value;
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        },
        scard: (key: string) => command(["SCARD", key]),
        smembers: (key: string) => command(["SMEMBERS", key]),
        set: (key: string, value: unknown) =>
          command(["SET", key, "__FRONTIER_STDIN__"], JSON.stringify(value)),
        async eval(script: string, keys: string[], args: unknown[]) {
          const result = await command(
            [
              "EVAL",
              script,
              String(keys.length),
              ...keys,
              "__FRONTIER_STDIN__",
              ...args.slice(1).map(String),
            ],
            String(args[0]),
          );
          if (loseNextResponse) {
            loseNextResponse = false;
            throw new Error("Simulated response loss after real Redis EVAL committed");
          }
          return result;
        },
      };
      return {
        participant,
        input,
        raw,
        digest,
        participantKey,
        store: new RedisPlan6CompetitionStore(transport as unknown as Redis),
        loseResponse: () => {
          loseNextResponse = true;
        },
      };
    }

    it("saves one revision for 32 parallel same-key requests and retains both binding and record without TTL", async () => {
      const { store, input, digest, participantKey } = await fixture("same-key");
      const results = await Promise.all(
        Array.from({ length: 32 }, () => store.commitSubmission(input, "operation", digest, 0)),
      );
      expect(results.filter(({ status }) => status === "saved")).toHaveLength(1);
      expect(results.filter(({ status }) => status === "existing")).toHaveLength(31);
      expect(new Set(results.map(({ submission }) => submission.submissionId)).size).toBe(1);
      const submission = results[0]!.submission;
      expect(submission).toMatchObject(input);
      expect(await store.submissionsForParticipant(input.participantId)).toEqual([submission]);
      expect(await command(["GET", `${participantKey}:revision`])).toBe("1");
      expect(
        await command(["SISMEMBER", "frontier:plan6:submissions", submission.submissionId]),
      ).toBe(1);
      expect(await command(["TTL", `${participantKey}:idempotency:operation`])).toBe(-1);
      expect(await command(["TTL", `frontier:plan6:submission:${submission.submissionId}`])).toBe(
        -1,
      );
      expect(await store.lookupSubmissionIdempotency(input.participantId, "operation")).toEqual({
        bodyDigest: digest,
        submission,
      });
    }, 120_000);

    it("rejects a different body racing for the same key and leaves only the winning payload", async () => {
      const { store, input, raw, participant, digest, participantKey } =
        await fixture("body-binding");
      const otherRaw = { ...raw, strategy: { ...raw.strategy, name: "Another request body" } };
      const otherInput = preparePlan6Submission(participant, otherRaw);
      const otherDigest = keccak256(stringToHex(canonicalProtocolJson(otherRaw)));
      const outcomes = await Promise.allSettled(
        Array.from({ length: 20 }, (_, i) =>
          store.commitSubmission(
            i % 2 ? otherInput : input,
            "operation",
            i % 2 ? otherDigest : digest,
            0,
          ),
        ),
      );
      const successes = outcomes.filter((outcome) => outcome.status === "fulfilled");
      expect(successes).toHaveLength(10);
      expect(successes.filter(({ value }) => value.status === "saved")).toHaveLength(1);
      for (const outcome of outcomes.filter((result) => result.status === "rejected")) {
        expect(outcome.reason).toMatchObject({ status: 409, code: "IDEMPOTENCY_CONFLICT" });
      }
      const binding = await store.lookupSubmissionIdempotency(input.participantId, "operation");
      expect([digest, otherDigest]).toContain(binding?.bodyDigest);
      expect(binding?.submission).toEqual(successes[0]!.value.submission);
      expect(await command(["SCARD", `${participantKey}:submissions`])).toBe(1);
      expect(await command(["GET", `${participantKey}:revision`])).toBe("1");
    }, 120_000);

    it("allocates distinct concurrent revisions and permits only one of 24 requests to take revision 20", async () => {
      const { store, input, digest, participantKey } = await fixture("revision-limit");
      await Promise.all(
        Array.from({ length: 8 }, (_, i) => store.commitSubmission(input, `first-${i}`, digest)),
      );
      for (let i = 8; i < 19; i++) await store.commitSubmission(input, `first-${i}`, digest, i);
      const outcomes = await Promise.allSettled(
        Array.from({ length: 24 }, (_, i) =>
          store.commitSubmission(input, `last-${i}`, digest, 19),
        ),
      );
      expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      for (const outcome of outcomes.filter((result) => result.status === "rejected")) {
        expect(outcome.reason).toMatchObject({ status: 409, code: "REVISION_LIMIT" });
      }
      const submissions = await store.submissionsForParticipant(input.participantId);
      expect(submissions.map(({ revision }) => revision)).toEqual(
        Array.from({ length: 20 }, (_, i) => i + 1),
      );
      expect(new Set(submissions.map(({ submissionId }) => submissionId)).size).toBe(20);
      expect(await command(["GET", `${participantKey}:revision`])).toBe("20");
      expect(await command(["KEYS", `${participantKey}:idempotency:*`])).toHaveLength(20);
      for (const submission of submissions) {
        expect(submission.submissionId).toBe(
          createPlan6SubmissionRecord(input, submission.revision).submissionId,
        );
        expect(
          await command(["SISMEMBER", "frontier:plan6:submissions", submission.submissionId]),
        ).toBe(1);
      }
      await expect(store.commitSubmission(input, "first-0", digest, 0)).resolves.toMatchObject({
        status: "existing",
      });
    }, 120_000);

    it("recovers after the response is lost and rejects stale preparation without writes", async () => {
      const { store, input, digest, participantKey, loseResponse } = await fixture("lost-response");
      loseResponse();
      await expect(store.commitSubmission(input, "lost", digest, 0)).rejects.toThrow(
        "response loss",
      );
      const recovered = await store.commitSubmission(input, "lost", digest, 0);
      expect(recovered).toMatchObject({ status: "existing", submission: { revision: 1 } });
      await expect(store.commitSubmission(input, "stale", digest, 0)).rejects.toMatchObject({
        code: "REVISION_CONFLICT",
      });
      expect(await store.lookupSubmissionIdempotency(input.participantId, "stale")).toBeNull();
      expect(await command(["GET", `${participantKey}:revision`])).toBe("1");
      expect(await command(["SCARD", `${participantKey}:submissions`])).toBe(1);
    }, 120_000);

    it("executes compatibility binding guards and enforces final ownership", async () => {
      const { store, input, digest, participantKey } = await fixture("legacy");
      const saved = await store.addSubmission(input);
      await store.saveSubmissionIdempotency(input.participantId, "legacy", saved.submissionId);
      const bindingKey = `${participantKey}:idempotency:legacy`;
      expect(await command(["TTL", bindingKey])).toBe(-1);
      expect(await store.lookupSubmissionIdempotency(input.participantId, "legacy")).toEqual({
        bodyDigest: null,
        submission: saved,
      });
      await expect(store.commitSubmission(input, "legacy", digest, 0)).resolves.toEqual({
        status: "existing",
        submission: saved,
      });
      expect(await command(["TTL", bindingKey])).toBe(-1);
      const second = await store.addSubmission(input);
      await expect(
        store.saveSubmissionIdempotency(input.participantId, "legacy", second.submissionId),
      ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
      const other = await fixture("other-owner");
      await expect(
        store.selectFinal(other.input.participantId, saved.submissionId),
      ).rejects.toMatchObject({ code: "SUBMISSION_NOT_FOUND" });
      expect(await store.finalEntry(other.input.participantId)).toBeNull();
      await expect(
        store.selectFinal(input.participantId, saved.submissionId),
      ).resolves.toMatchObject({ submissionId: saved.submissionId });
    }, 120_000);

    it("replays an old bare-ID binding and removes its old 24-hour TTL", async () => {
      const { store, input, digest, participantKey } = await fixture("legacy-bare-id");
      const saved = await store.addSubmission(input);
      const bindingKey = `${participantKey}:idempotency:legacy`;
      // Upstash serializes string arguments verbatim, including hexadecimal submission IDs.
      await command(["SET", bindingKey, saved.submissionId, "EX", "86400"]);
      expect(await command(["TTL", bindingKey])).toBeGreaterThan(0);
      expect(await store.lookupSubmissionIdempotency(input.participantId, "legacy")).toEqual({
        bodyDigest: null,
        submission: saved,
      });
      expect(await command(["PTTL", bindingKey])).toBe(-1);
      // Independently verify commit's TTL upgrade after the early-lookup path above.
      await command(["EXPIRE", bindingKey, "86400"]);
      await expect(store.commitSubmission(input, "legacy", digest, 0)).resolves.toEqual({
        status: "existing",
        submission: saved,
      });
      expect(await command(["TTL", bindingKey])).toBe(-1);
      expect(await command(["GET", bindingKey])).toBe(saved.submissionId);
      expect(await command(["GET", `${participantKey}:revision`])).toBe("1");

      // The compatibility writer must recognize the same bare ID before cjson can coerce it.
      await command(["EXPIRE", bindingKey, "86400"]);
      await expect(
        store.saveSubmissionIdempotency(input.participantId, "legacy", saved.submissionId),
      ).resolves.toBeUndefined();
      expect(await command(["TTL", bindingKey])).toBe(-1);
      const second = await store.addSubmission(input);
      await expect(
        store.saveSubmissionIdempotency(input.participantId, "legacy", second.submissionId),
      ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
      await expect(
        store.commitSubmission(
          { ...input, sourceHash: `0x${"ff".repeat(32)}` },
          "legacy",
          digest,
          0,
        ),
      ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
      expect(await command(["GET", bindingKey])).toBe(saved.submissionId);

      const fixtures = [
        { value: JSON.stringify(saved.submissionId), valid: true },
        {
          value: JSON.stringify({ submissionId: saved.submissionId, bodyDigest: digest }),
          valid: true,
        },
        {
          value: JSON.stringify({ submissionId: saved.submissionId, bodyDigest: null }),
          valid: true,
        },
        {
          value: JSON.stringify({ submissionId: saved.submissionId, bodyDigest: 42 }),
          valid: false,
        },
        { value: JSON.stringify({ submissionId: 42, bodyDigest: digest }), valid: false },
        { value: JSON.stringify({ submissionId: saved.submissionId }), valid: false },
        { value: "0x12", valid: false },
        { value: `0x${"g".repeat(64)}`, valid: false },
        { value: "[]", valid: false },
      ];
      for (const [index, fixture] of fixtures.entries()) {
        const fixtureKey = `binding-fixture-${index}`;
        const fixtureRedisKey = `${participantKey}:idempotency:${fixtureKey}`;
        await command(["SET", fixtureRedisKey, "__FRONTIER_STDIN__", "EX", "86400"], fixture.value);
        if (fixture.valid) {
          await expect(
            store.lookupSubmissionIdempotency(input.participantId, fixtureKey),
          ).resolves.toMatchObject({ submission: saved });
          expect(await command(["PTTL", fixtureRedisKey])).toBe(-1);
          await expect(store.commitSubmission(input, fixtureKey, digest, 0)).resolves.toEqual({
            status: "existing",
            submission: saved,
          });
          await expect(
            store.saveSubmissionIdempotency(input.participantId, fixtureKey, saved.submissionId),
          ).resolves.toBeUndefined();
          expect(await command(["TTL", fixtureRedisKey])).toBe(-1);
        } else {
          await expect(
            store.lookupSubmissionIdempotency(input.participantId, fixtureKey),
          ).rejects.toMatchObject({ code: "STORE_INCONSISTENT" });
          await expect(store.commitSubmission(input, fixtureKey, digest, 0)).rejects.toMatchObject({
            code: "STORE_INCONSISTENT",
          });
          await expect(
            store.saveSubmissionIdempotency(input.participantId, fixtureKey, saved.submissionId),
          ).rejects.toMatchObject({ code: "STORE_INCONSISTENT" });
          expect(await command(["TTL", fixtureRedisKey])).toBeGreaterThan(0);
        }
        expect(await command(["GET", fixtureRedisKey])).toBe(fixture.value);
      }
      const foreign = await fixture("legacy-foreign-owner");
      const foreignBindingKey = `${foreign.participantKey}:idempotency:foreign`;
      await command(["SET", foreignBindingKey, saved.submissionId, "EX", "86400"]);
      await expect(
        foreign.store.lookupSubmissionIdempotency(foreign.input.participantId, "foreign"),
      ).rejects.toMatchObject({ code: "STORE_INCONSISTENT" });
      expect(await command(["PTTL", foreignBindingKey])).toBeGreaterThan(0);
      const danglingKey = `${participantKey}:idempotency:dangling`;
      await command(["SET", danglingKey, `0x${"00".repeat(32)}`, "EX", "86400"]);
      await expect(
        store.lookupSubmissionIdempotency(input.participantId, "dangling"),
      ).rejects.toMatchObject({ code: "STORE_INCONSISTENT" });
      expect(await command(["PTTL", danglingKey])).toBeGreaterThan(0);
      const expiredKey = `${participantKey}:idempotency:expired`;
      await command(["SET", expiredKey, saved.submissionId, "PX", "1"]);
      await delay(20);
      await expect(
        store.lookupSubmissionIdempotency(input.participantId, "expired"),
      ).resolves.toBeNull();
      expect(await command(["PTTL", expiredKey])).toBe(-2);
      expect(await command(["EXISTS", `frontier:plan6:submission:${saved.submissionId}`])).toBe(1);
      expect(await command(["GET", `${participantKey}:revision`])).toBe("2");
      expect(await command(["SCARD", `${participantKey}:submissions`])).toBe(2);
    }, 120_000);

    it("rejects a wrong-type index before writing the record, revision or binding", async () => {
      const { store, input, digest, participantKey } = await fixture("wrong-type");
      await command(["SET", `${participantKey}:submissions`, "wrong-type"]);
      await expect(store.commitSubmission(input, "operation", digest, 0)).rejects.toMatchObject({
        code: "STORE_INCONSISTENT",
      });
      expect(
        await command([
          "EXISTS",
          `${participantKey}:revision`,
          `${participantKey}:idempotency:operation`,
          `frontier:plan6:submission:${createPlan6SubmissionRecord(input, 1).submissionId}`,
        ]),
      ).toBe(0);
    }, 120_000);
  },
);
