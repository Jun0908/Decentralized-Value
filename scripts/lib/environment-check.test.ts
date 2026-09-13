import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { parse } from "dotenv";
import { afterEach, describe, expect, it } from "vitest";

import { loadEnvironmentCheck } from "./environment-check";

const directories: string[] = [];
function fixture(files: Record<string, string>) {
  const directory = mkdtempSync(join(tmpdir(), "frontier-env-check-"));
  directories.push(directory);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(directory, name), text);
  return directory;
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    for (const name of readdirSync(directory)) unlinkSync(join(directory, name));
    rmdirSync(directory);
  }
});

describe("environment check inputs", () => {
  it("reads the actual root .env rather than the template", () => {
    const directory = fixture({ ".env": "API_PORT=4001", ".env.example": "API_PORT=3001" });
    const result = loadEnvironmentCheck({ directory });
    expect(result.sources).toEqual([".env"]);
    expect(result.template).toBe(false);
    expect(result.values.API_PORT).toBe("4001");
  });

  it("merges local overrides then process variables without mutating the caller", () => {
    const directory = fixture({
      ".env": "API_PORT=3001\nRUNNER_PORT=3002\nOPENAI_API_KEY=base-placeholder",
      ".env.local": "API_PORT=4001\nOPENAI_API_KEY=local-placeholder",
    });
    const inherited = { API_PORT: "5001", OPENAI_API_KEY: undefined };
    const result = loadEnvironmentCheck({ directory, inherited });
    expect(result.sources).toEqual([".env", ".env.local"]);
    expect(result.values.API_PORT).toBe("5001");
    expect(result.values.RUNNER_PORT).toBe("3002");
    expect(result.values.OPENAI_API_KEY).toBe("local-placeholder");
    expect(inherited.OPENAI_API_KEY).toBeUndefined();
  });

  it("preserves explicit empty overrides", () => {
    const directory = fixture({
      ".env": "OPENAI_API_KEY=base-placeholder\nENS_PARENT_NAME=example.eth",
      ".env.local": "OPENAI_API_KEY=",
    });
    const result = loadEnvironmentCheck({ directory, inherited: { ENS_PARENT_NAME: "" } });
    expect(result.values.OPENAI_API_KEY).toBe("");
    expect(result.values.ENS_PARENT_NAME).toBe("");
  });

  it("checks the example independently of local files and process secrets", () => {
    const directory = fixture({
      ".env": "OPENAI_API_KEY=local-placeholder",
      ".env.example": "OPENAI_API_KEY=",
    });
    const result = loadEnvironmentCheck({
      directory,
      exampleOnly: true,
      inherited: { OPENAI_API_KEY: "process-placeholder" },
    });
    expect(result.template).toBe(true);
    expect(result.values).toEqual({ OPENAI_API_KEY: "" });
  });

  it("falls back to the example only when no local file exists", () => {
    const directory = fixture({ ".env.example": "API_PORT=3001" });
    const result = loadEnvironmentCheck({ directory, inherited: { API_PORT: "invalid" } });
    expect(result.sources).toEqual([".env.example"]);
    expect(result.template).toBe(true);
    expect(result.values.API_PORT).toBe("3001");
  });

  it("does not fill absent local settings from the template", () => {
    const directory = fixture({
      ".env.local": "API_PORT=4001",
      ".env.example": "OPENAI_API_KEY=example-placeholder",
    });
    expect(loadEnvironmentCheck({ directory }).values.OPENAI_API_KEY).toBeUndefined();
  });

  it("reports a missing template without filesystem details", () => {
    const directory = fixture({});
    expect(() => loadEnvironmentCheck({ directory })).toThrow("Environment template is missing.");
  });

  it("keeps the tracked template free of configured secrets and spending opt-ins", () => {
    const values = parse(readFileSync(resolve(import.meta.dirname, "../../.env.example")));
    const defaults: Record<string, string> = {
      NODE_ENV: "development",
      NEXT_PUBLIC_CHAIN_ID: "11155111",
      API_PORT: "3001",
      RUNNER_PORT: "3002",
      PLAN5_SETTLEMENT_ENABLED: "false",
      PLAN5_MAX_REWARD_CREDITS: "10000",
    };
    for (const [name, value] of Object.entries(values)) {
      // Boolean assertions deliberately avoid printing an accidentally inserted secret.
      expect(value === (defaults[name] ?? ""), `Unexpected template value for ${name}`).toBe(true);
    }
    expect(Object.keys(values)).toEqual(
      expect.arrayContaining(["OPENAI_API_KEY", ...Object.keys(defaults)]),
    );
    expect(values.OPENAI_MODEL).toBeUndefined();
    expect(values.OPENAI_BASE_URL).toBeUndefined();
  });
});
