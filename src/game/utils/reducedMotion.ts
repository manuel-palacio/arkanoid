/**
 * Returns true if the user has set `prefers-reduced-motion: reduce` in their
 * OS / browser. Cached so repeated calls in the per-frame update loop don't
 * touch the matchMedia API.
 *
 * SSR / non-DOM hosts (the Vitest jsdom runtime) get `false`.
 */
let cached: boolean | null = null;

export function prefersReducedMotion(): boolean {
  if (cached !== null) return cached;
  try {
    cached = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    cached = false;
  }
  return !!cached;
}
