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
]);
