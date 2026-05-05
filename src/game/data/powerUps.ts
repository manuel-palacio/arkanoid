import type { PowerUpDef, PowerUpKind } from '../types';

/**
 * Catalogue of every power-up. `weight` drives the random pick (higher
 * = more frequent), `positive` is a hint for level whitelisting, and
 * `color` is a fallback used by the legacy texture path. Modern visuals
 * pull tints from POWERUP_CANDY_COLORS in config/palette.ts.
 */
export const POWERUPS: Record<PowerUpKind, PowerUpDef> = {
  expand: { kind: 'expand', label: 'WIDEN', color: 0x4af2a1, weight: 14, positive: true },
  shrink: { kind: 'shrink', label: 'NARROW', color: 0xff5d6c, weight: 4, positive: false },
  slow: { kind: 'slow', label: 'SLOW', color: 0x4ad6ff, weight: 10, positive: true },
  fast: { kind: 'fast', label: 'TURBO', color: 0xff7a00, weight: 6, positive: true },
  multi: { kind: 'multi', label: 'MULTI', color: 0xffd23a, weight: 8, positive: true },
  sticky: { kind: 'sticky', label: 'CATCH', color: 0xb96bff, weight: 9, positive: true },
  laser: { kind: 'laser', label: 'FIRE', color: 0xff5dab, weight: 9, positive: true },
  through: { kind: 'through', label: 'SMASH', color: 0xff3300, weight: 7, positive: true },
  big: { kind: 'big', label: 'HUGE', color: 0xffee33, weight: 8, positive: true },
  magnet: { kind: 'magnet', label: 'MAGNET', color: 0xaa44ff, weight: 6, positive: true },
  bomb: { kind: 'bomb', label: 'BOMB', color: 0xff5500, weight: 5, positive: true },
  gravity: { kind: 'gravity', label: 'SHIFT', color: 0x556688, weight: 4, positive: true },
  ghost: { kind: 'ghost', label: 'GHOST', color: 0x99ffee, weight: 5, positive: true },
  score2x: { kind: 'score2x', label: '2X', color: 0xffd23a, weight: 7, positive: true },
  life: { kind: 'life', label: '1UP', color: 0xff4488, weight: 2, positive: true },
};

export const ALL_POWERUP_KINDS: PowerUpKind[] = [
  'expand',
  'shrink',
  'slow',
  'fast',
  'multi',
  'sticky',
  'laser',
  'through',
  'big',
  'magnet',
  'bomb',
  'gravity',
  'ghost',
  'score2x',
  'life',
];

/** Power-ups that resolve instantly on pickup (not in the timed HUD slot). */
export const ONESHOT_KINDS: ReadonlySet<PowerUpKind> = new Set([
  'multi',
  'bomb',
  'gravity',
  'life',
]);
