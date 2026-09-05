import { describe, expect, it } from "vitest";

import { parseEnvironment } from "./environment";

describe("parseEnvironment", () => {
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
