import { describe, expect, it } from "vitest";
import { EnsRescueServiceDirectory, rescueServiceRecordKey } from "./rescue";

const origin = "https://runner.example.test";
const active = {
  schemaVersion: "frontier-rescue-service-v1",
  capability: "rescue-doctrine-public-practice",
  apiOrigin: origin,
  status: "active",
};
describe("ENS Rescue service discovery", () => {
  it("reads the dedicated live key and reflects revocation of availability", async () => {
    let record = active;
    const directory = new EnsRescueServiceDirectory(
      {
        getText: async (name, key) => {
          expect(name).toBe("frontierdemo.eth");
          expect(key).toBe(rescueServiceRecordKey);
          return JSON.stringify(record);
        },
      },
      [origin],
    );
    expect((await directory.resolve("frontierdemo.eth")).apiOrigin).toBe(origin);
    record = { ...active, status: "paused" };
    await expect(directory.resolve("frontierdemo.eth")).rejects.toThrow(
      "ENS_RESCUE_SERVICE_PAUSED",
    );
  });
  it.each([
    null,
    "{}",
    "bad",
    "x".repeat(4097),
    JSON.stringify({ ...active, capability: "other" }),
  ])("fails closed for malformed data", async (text) => {
    const d = new EnsRescueServiceDirectory({ getText: async () => text }, [origin]);
    await expect(d.resolve("frontierdemo.eth")).rejects.toThrow(/^ENS_RESCUE_/);
  });
  it.each([
    "http://127.0.0.1",
    "https://attacker.example",
    `${origin}/admin`,
    `${origin}?key=secret`,
    "https://user:pass@runner.example.test",
    `${origin}#x`,
  ])("does not turn an ENS record into unrestricted network authority", async (apiOrigin) => {
    const d = new EnsRescueServiceDirectory(
      { getText: async () => JSON.stringify({ ...active, apiOrigin }) },
      [origin],
    );
    await expect(d.resolve("frontierdemo.eth")).rejects.toThrow("ENS_RESCUE_ORIGIN_NOT_ALLOWED");
  });
});
