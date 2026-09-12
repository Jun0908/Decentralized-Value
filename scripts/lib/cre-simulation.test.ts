import { describe, expect, it } from "vitest";
import { creFailureCode, parseCreResult } from "./cre-simulation";

describe("CRE output boundary", () => {
  it("accepts only a marked JSON object and permits trailing CLI text", () => {
    expect(
      parseCreResult('log\n✓ Workflow Simulation Result:\n{"ok":true,"data":"{x}"}\nDone'),
    ).toEqual({ ok: true, data: "{x}" });
    for (const text of [
      '{"ok":true}',
      "Workflow Simulation Result: null",
      "Workflow Simulation Result: []",
      "Workflow Simulation Result: {bad}",
    ])
      expect(() => parseCreResult(text)).toThrow(/^CRE_RESULT_/);
  });
  it("does not misclassify organization/RPC failures as missing login", () => {
    expect(creFailureCode("authentication required: unable to retrieve organization info")).toBe(
      "CRE_ORGANIZATION_UNAVAILABLE",
    );
    expect(creFailureCode("no RPC URLs found")).toBe("CRE_RPC_UNAVAILABLE");
    expect(creFailureCode("not logged in")).toBe("CRE_AUTHENTICATION_REQUIRED");
    expect(creFailureCode("PRIVATE_INPUT=secret", "ETIMEDOUT")).toBe("CRE_TIMEOUT");
    expect(creFailureCode("PRIVATE_INPUT=secret")).toBe("CRE_EXECUTION_FAILED");
  });
});
