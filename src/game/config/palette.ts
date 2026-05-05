/**
 * Candy-arcade visual palette. Used by TextureFactory to generate base
 * textures and by entities/effects to tint at runtime. Game mechanics do
 * not depend on these values — only the visual layer.
 */
export const CANDY = {
  cherry: 0xff3366,
  tangerine: 0xff7a00,
  lemon: 0xffd600,
  lime: 0x44dd44,
  blueberry: 0x2299ff,
  grape: 0xaa44ff,
  mint: 0x00ddbb,

  cherryHi: 0xff99bb,
  tangerineHi: 0xffcc88,
  lemonHi: 0xffff99,
  limeHi: 0x99ff99,
  blueberryHi: 0x99ccff,
  grapeHi: 0xdd99ff,
  mintHi: 0x99ffee,

  white: 0xffffff,
  cream: 0xfff8e7,
  shadow: 0x1a0a2e,
  darkBg: 0x0d0520,
} as const;

/**
 * Last-resort fallback only — normally every brick receives a
 * colorOverride from LevelSystem.defaultRowColor() (which now covers
 * all kinds with row-cycled candy hues). This map fires solely when
 * a brick is constructed without a colorOverride, e.g. ad-hoc test
 * spawns.
 */
export const BRICK_CANDY_COLORS: Record<string, number> = {
  standard: CANDY.lemon,
  tough: CANDY.tangerine,
  hard: CANDY.cherry,
  indestructible: 0x556688,
  special: CANDY.grape,
};

export const POWERUP_CANDY_COLORS: Record<string, number> = {
  expand: CANDY.lime,
  shrink: CANDY.cherry,
  slow: CANDY.blueberry,
  multi: CANDY.grape,
  sticky: CANDY.mint,
  laser: CANDY.tangerine,
  life: 0xff4488,
};

/** Ordered rotation used by combo escalation + celebration sweeps. */
export const CANDY_ROTATION: number[] = [
  CANDY.cherry,
  CANDY.tangerine,
  CANDY.lemon,
  CANDY.lime,
  CANDY.mint,
  CANDY.blueberry,
  CANDY.grape,
];

/** Lighten an RGB int by mixing it toward white. mix 0..1 (0 = original). */
export function lighten(color: number, mix: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const lr = Math.round(r + (255 - r) * mix);
  const lg = Math.round(g + (255 - g) * mix);
  const lb = Math.round(b + (255 - b) * mix);
  return (lr << 16) | (lg << 8) | lb;
}

/** Darken (mix toward black). mix 0..1 (0 = original). */
export function darken(color: number, mix: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return (
    (Math.round(r * (1 - mix)) << 16) |
    (Math.round(g * (1 - mix)) << 8) |
    Math.round(b * (1 - mix))
  );
}

/** Shift toward gray (desaturate). mix 0..1 (0 = original, 1 = full gray). */
export function desaturate(color: number, mix: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  return (
    (Math.round(r + (gray - r) * mix) << 16) |
    (Math.round(g + (gray - g) * mix) << 8) |
    Math.round(b + (gray - b) * mix)
  );
}

export function hexToCss(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}
