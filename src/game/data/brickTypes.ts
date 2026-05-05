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
  // REGEN: 3 HP, heals 1 HP every 4s unless re-hit. Player must commit
  // to taking it down quickly or work around it.
  R: {
    id: 'R',
    kind: 'regen',
    hits: 3,
    score: 160,
    color: 0x39ff14,
    dropChance: 0.1,
    glyph: 'brick-candy',
  },
  // INVISIBLE: alpha 0 by default; reveals while a ball is within
  // ~2 cells, then fades back after a brief hold. Still collidable
  // while invisible — surprise hits are the point.
  V: {
    id: 'V',
    kind: 'invisible',
    hits: 1,
    score: 100,
    color: 0xffffff,
    dropChance: 0.2,
    glyph: 'brick-candy',
  },
  // DEFLECTOR: forces a 45° outgoing angle (in the same quadrant as
  // the incoming velocity). Enables puzzle geometry — the ball MUST
  // pass through a chain of deflectors to reach a target.
  D: {
    id: 'D',
    kind: 'deflector',
    hits: 2,
    score: 70,
    color: 0xffa500,
    dropChance: 0.12,
    glyph: 'brick-candy',
  },
  // SPAWNER: 2-hit brick that releases a slow-drifting enemy on its
  // first hit, removed when the brick dies. Implemented in a follow-up
  // commit (needs an Enemy entity); the data slot is reserved here so
  // levels can already use 'G' without breaking parsing.
  G: {
    id: 'G',
    kind: 'spawner',
    hits: 2,
    score: 100,
    color: 0xff00ff,
    dropChance: 0,
    glyph: 'brick-candy',
  },
  // WARDEN: 2-hit brick that shields all bricks one row below. Warded
  // bricks reject damage entirely — the ball still bounces, but no
  // HP is taken — until the warden itself is destroyed.
  W: {
    id: 'W',
    kind: 'warden',
    hits: 2,
    score: 130,
    color: 0x7f7fff,
    dropChance: 0.18,
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
  'regen',
  'invisible',
  'deflector',
  'spawner',
  'warden',
  // 'bumper' is intentionally NOT breakable.
]);
