/**
 * Small deterministic PRNG. The arena must replay identically from a seed on
 * any machine, so we never touch Math.random.
 */

export type Rng = () => number;

function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let index = 0; index < seed.length; index += 1) {
    h ^= seed.charCodeAt(index);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — short period is irrelevant here and it is exactly reproducible. */
export function createRng(seed: string): Rng {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngInt(rng: Rng, minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(rng() * (maxInclusive - minInclusive + 1));
}

/** Rounds to 6 decimals so float drift never changes a replay. */
export function stable(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
