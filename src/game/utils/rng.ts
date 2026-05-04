/**
 * Tiny seedable PRNG (mulberry32). Used for deterministic tests and reproducible
 * power-up rolls. NOT for security.
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Weighted random pick. `weights` must be parallel to `items` and contain
 * non-negative numbers (at least one > 0). `rand` returns [0,1).
 */
export function weightedPick<T>(items: readonly T[], weights: readonly number[], rand: () => number): T {
  if (items.length === 0 || items.length !== weights.length) {
    throw new Error('weightedPick: items and weights must be same non-zero length');
  }
  let total = 0;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    if (w < 0) throw new Error('weightedPick: negative weight');
    total += w;
  }
  if (total <= 0) throw new Error('weightedPick: total weight must be > 0');
  const r = rand() * total;
  let acc = 0;
  for (let i = 0; i < items.length; i++) {
    acc += weights[i] ?? 0;
    if (r < acc) return items[i] as T;
  }
  return items[items.length - 1] as T;
}
