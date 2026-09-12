import { describe, expect, it } from "vitest";
import { compareProtocolKeys } from "./protocol-key-order";
import { canonicalProtocolJson } from "./manifest";

describe("legacy ASCII protocol field collation", () => {
  const reference = new Intl.Collator("en-US");
  it("matches ICU for all printable ASCII character pairs", () => {
    for (let a = 32; a <= 126; a++)
      for (let b = 32; b <= 126; b++) {
        const left = String.fromCharCode(a),
          right = String.fromCharCode(b);
        expect(Math.sign(compareProtocolKeys(left, right))).toBe(
          Math.sign(reference.compare(left, right)),
        );
      }
  });
  it("matches ICU for deterministic mixed-case multi-character keys", () => {
    let state = 918273;
    const key = () =>
      Array.from({ length: 9 }, () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return String.fromCharCode(32 + (state % 95));
      }).join("");
    for (let i = 0; i < 10000; i++) {
      const left = key(),
        right = key();
      expect(Math.sign(compareProtocolKeys(left, right))).toBe(
        Math.sign(reference.compare(left, right)),
      );
    }
    for (const [a, b] of [
      ["serviceId", "services"],
      ["jobID", "jobId"],
      ["aaB", "aAb"],
      ["", "a"],
    ])
      expect(Math.sign(compareProtocolKeys(a!, b!))).toBe(Math.sign(reference.compare(a!, b!)));
  });
  it("does not use host locale for ASCII fields and preserves nested ordering", () => {
    expect(canonicalProtocolJson({ services: 2, serviceId: 1, nested: { z: 3, A: 2, a: 1 } })).toBe(
      '{"nested":{"a":1,"A":2,"z":3},"serviceId":1,"services":2}',
    );
  });
});
