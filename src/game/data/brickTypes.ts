import type { BrickArchetype, BrickKind } from '../types';

export const BRICK_ARCHETYPES: Record<string, BrickArchetype> = {
  S: {
    id: 'S',
    kind: 'standard',
    hits: 1,
    score: 50,
    color: 0x4ad6ff,
    dropChance: 0.16,
    glyph: 'brick-standard',
  },
  T: {
    id: 'T',
    kind: 'tough',
    hits: 2,
    score: 90,
    color: 0xff6a3d,
    dropChance: 0.20,
    glyph: 'brick-tough',
  },
  H: {
    id: 'H',
    kind: 'hard',
    hits: 3,
    score: 140,
    color: 0xb96bff,
    dropChance: 0.24,
    glyph: 'brick-hard',
  },
  I: {
    id: 'I',
    kind: 'indestructible',
    hits: Number.POSITIVE_INFINITY,
    score: 0,
    color: 0x6a7280,
    dropChance: 0,
    glyph: 'brick-indestructible',
  },
  '*': {
    id: '*',
    kind: 'special',
    hits: 1,
    score: 80,
    color: 0xffd23a,
    dropChance: 1, // always drops
    glyph: 'brick-special',
  },
  // BOMB brick: on destruction triggers a 3×3 chain reaction. Implemented
  // in GameScene.handleBrickDestroyed by reusing the bombExplode path.
  B: {
    id: 'B',
    kind: 'bomb',
    hits: 1,
    score: 120,
    color: 0xff4500,
    dropChance: 0,
    glyph: 'brick-candy',
  },
  // MOVING brick: oscillates horizontally inside its row. Movement
  // animation is set up in LevelSystem.buildLevel; collisions still work
  // because Arcade Physics handles moving immovable bodies correctly.
  M: {
    id: 'M',
    kind: 'moving',
    hits: 1,
    score: 80,
    color: 0x00e5ff,
    dropChance: 0.15,
    glyph: 'brick-candy',
  },
  // BUMPER brick: indestructible pinball-style bumper. Adds 10 points per
  // hit and boosts ball speed by 1.3× on contact (capped at maxSpeed).
  P: {
    id: 'P',
    kind: 'bumper',
    hits: Number.POSITIVE_INFINITY,
    score: 10,
    color: 0xffdd00,
    dropChance: 0,
    glyph: 'brick-candy',
  },
  // CURSED brick: visually identical to Special (*) but always drops a
  // negative power-up. Sparingly placed late-game to introduce paranoia.
  C: {
    id: 'C',
    kind: 'cursed',
    hits: 1,
    score: 60,
    color: 0xffd23a, // intentionally identical to special
    dropChance: 1,
    glyph: 'brick-candy',
  },
};

export function archetypeForSymbol(sym: string): BrickArchetype | null {
  if (sym === '.' || sym === ' ') return null;
  return BRICK_ARCHETYPES[sym] ?? null;
}

export const BREAKABLE_KINDS: ReadonlySet<BrickKind> = new Set([
  'standard',
  'tough',
  'hard',
  'special',
  'bomb',
  'moving',
  'cursed',
  // 'bumper' is intentionally NOT breakable.
]);
