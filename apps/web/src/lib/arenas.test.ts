import { describe, expect, it } from "vitest";
import { arenaRegistry, getArena } from "./arenas";

describe("arena display order", () => {
  it("keeps all six arenas with the three primary demos in the first row", () => {
    expect(arenaRegistry.map(({ slug }) => slug)).toEqual([
      "emergency-supply",
      "rescue-room",
      "calldata-compression",
      "secret-gate",
      "microgrid-dispatch",
      "ocean-commons",
    ]);
  });

  it("preserves unique routes and lookup for every arena", () => {
    expect(new Set(arenaRegistry.map(({ slug }) => slug)).size).toBe(6);
    for (const arena of arenaRegistry) expect(getArena(arena.slug)).toBe(arena);
    expect(getArena("unknown-arena")).toBeUndefined();
  });
});
