import { describe, expect, it } from "vitest";
import saved from "../Docs/deployments/sepolia-rescue-service-demo.json";
import {
  getRescueOperatorPublicEvidence,
  rescueOperatorPublicEvidenceSchema,
} from "../apps/web/src/lib/rescue-operator-public";

describe("Rescue public evidence boundary", () => {
  it("accepts the verified whitelist snapshot without internal capabilities", () => {
    expect(rescueOperatorPublicEvidenceSchema.safeParse(saved).success).toBe(true);
    expect(getRescueOperatorPublicEvidence()).toEqual(saved);
    expect(JSON.stringify(saved)).not.toMatch(/privateKey|rawTransaction|runToken|apiKey/);
  });

  it("requires a deployment and verification time for payment claims", () => {
    for (const field of ["deployment", "verifiedAt"] as const) {
      expect(
        rescueOperatorPublicEvidenceSchema.safeParse({ ...saved, [field]: null }).success,
      ).toBe(false);
    }
  });

  it("rejects extra fields and malformed chain evidence", () => {
    expect(
      rescueOperatorPublicEvidenceSchema.safeParse({ ...saved, rawTransaction: "secret" }).success,
    ).toBe(false);
    expect(
      rescueOperatorPublicEvidenceSchema.safeParse({
        ...saved,
        purchase: { ...saved.purchase, releaseTx: "javascript:alert(1)" },
      }).success,
    ).toBe(false);
  });

  it("allows an explicitly empty not-yet-verified state", () => {
    expect(
      rescueOperatorPublicEvidenceSchema.safeParse({
        verifiedAt: null,
        deployment: null,
        purchase: null,
        refund: null,
      }).success,
    ).toBe(true);
  });
});
