import { describe, expect, it } from "vitest";
import { assertLedgerMode } from "./index.js";

describe("assertLedgerMode", () => {
  it("requires DMK in production", () => {
    expect(() =>
      assertLedgerMode({ NODE_ENV: "production", LEDGER_SIGNING_MODE: "development" }),
    ).toThrow("must use Ledger DMK");
    expect(() =>
      assertLedgerMode({ NODE_ENV: "production", LEDGER_SIGNING_MODE: "dmk" }),
    ).not.toThrow();
  });

  it("requires an explicit double opt-in for local insecure signing", () => {
    expect(() =>
      assertLedgerMode({ NODE_ENV: "development", LEDGER_SIGNING_MODE: "development" }),
    ).toThrow();
    expect(() =>
      assertLedgerMode({
        NODE_ENV: "development",
        LEDGER_SIGNING_MODE: "development",
        ALLOW_INSECURE_LOCAL_SIGNER: "true",
      }),
    ).not.toThrow();
  });
});
