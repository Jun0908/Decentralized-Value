import { describe, expect, it } from "vitest";

import { parseEnvironment } from "./environment";

describe("parseEnvironment", () => {
  it("accepts the same prefixed and unprefixed key formats as deployment adapters", () => {
    const raw = "ab".repeat(32);
    const input = { DEPLOYER_PRIVATE_KEY: raw, PLAN5_RELAYER_PRIVATE_KEY: `0x${raw}` };
    const environment = parseEnvironment(input);
    expect(environment.DEPLOYER_PRIVATE_KEY).toBe(`0x${raw}`);
    expect(environment.PLAN5_RELAYER_PRIVATE_KEY).toBe(`0x${raw}`);
    expect(input.DEPLOYER_PRIVATE_KEY).toBe(raw);
  });

  it("still rejects wrong-length and non-hex private keys", () => {
    for (const key of ["a".repeat(63), "g".repeat(64), `0x${"a".repeat(65)}`]) {
      expect(() => parseEnvironment({ DEPLOYER_PRIVATE_KEY: key })).toThrow(
        "Invalid environment configuration",
      );
      expect(() => parseEnvironment({ PLAN5_RELAYER_PRIVATE_KEY: key })).toThrow(
        "Invalid environment configuration",
      );
    }
  });

  it("accepts blank feature settings without enabling their services", () => {
    const environment = parseEnvironment({
      OPENAI_API_KEY: "",
      OPENAI_BASE_URL: "",
      OPENAI_MODEL: "",
      FRONTIER_CLI_ORIGIN: "",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
    });
    expect(environment.OPENAI_API_KEY).toBeUndefined();
    expect(environment.OPENAI_BASE_URL).toBeUndefined();
    expect(environment.OPENAI_MODEL).toBeUndefined();
    expect(environment.FRONTIER_CLI_ORIGIN).toBeUndefined();
    expect(environment.UPSTASH_REDIS_REST_URL).toBeUndefined();
    expect(environment.UPSTASH_REDIS_REST_TOKEN).toBeUndefined();
  });

  it("validates optional feature URL formats", () => {
    for (const key of ["OPENAI_BASE_URL", "FRONTIER_CLI_ORIGIN", "UPSTASH_REDIS_REST_URL"]) {
      expect(() => parseEnvironment({ [key]: "not-a-url" })).toThrow(
        "Invalid environment configuration",
      );
    }
  });

  it("retains optional AI and Redis settings without making network requests", () => {
    const environment = parseEnvironment({
      OPENAI_API_KEY: "test-placeholder",
      OPENAI_MODEL: "test-model",
      OPENAI_BASE_URL: "https://example.invalid/v1",
      FRONTIER_CLI_ORIGIN: "https://example.invalid",
      UPSTASH_REDIS_REST_URL: "https://example.invalid",
      UPSTASH_REDIS_REST_TOKEN: "test-token",
    });
    expect(environment.OPENAI_API_KEY).toBe("test-placeholder");
    expect(environment.OPENAI_MODEL).toBe("test-model");
    expect(environment.UPSTASH_REDIS_REST_TOKEN).toBe("test-token");
  });

  it("uses safe local defaults", () => {
    const environment = parseEnvironment({});

    expect(environment.NEXT_PUBLIC_CHAIN_ID).toBe(11155111);
    expect(environment.API_PORT).toBe(3001);
    expect(environment.RUNNER_PORT).toBe(3002);
  });

  it("treats blank optional values as absent", () => {
    const environment = parseEnvironment({
      DEPLOYER_PRIVATE_KEY: "",
      ENS_PARENT_NAME: "",
      ETHERSCAN_API_KEY: "",
      SEPOLIA_RPC_URL: "",
    });

    expect(environment.DEPLOYER_PRIVATE_KEY).toBeUndefined();
    expect(environment.ENS_PARENT_NAME).toBeUndefined();
    expect(environment.ETHERSCAN_API_KEY).toBeUndefined();
    expect(environment.SEPOLIA_RPC_URL).toBeUndefined();
  });

  it("rejects a non-Sepolia public chain ID", () => {
    expect(() => parseEnvironment({ NEXT_PUBLIC_CHAIN_ID: "1" })).toThrow(
      "Invalid environment configuration",
    );
  });

  it("rejects malformed integration URLs", () => {
    expect(() => parseEnvironment({ BAZANTIC_GATEWAY_URL: "not-a-url" })).toThrow(
      "Invalid environment configuration",
    );
  });

  it("rejects a malformed deployer key without exposing it", () => {
    expect(() => parseEnvironment({ DEPLOYER_PRIVATE_KEY: "not-a-key" })).toThrow(
      "Invalid environment configuration",
    );
  });
});
