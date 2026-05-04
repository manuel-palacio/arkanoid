export type Vec2 = { x: number; y: number };

export type BrickKind = 'standard' | 'tough' | 'hard' | 'indestructible' | 'special';

export interface BrickArchetype {
  /** unique key */
  id: string;
  kind: BrickKind;
  /** number of hits before destroyed (Infinity for indestructible) */
  hits: number;
  /** score awarded on destruction */
  score: number;
  /** RGB ints for the body color when at full health */
  color: number;
  /** when broken, probability [0..1] of dropping a power-up */
  dropChance: number;
  /** label glyph (1 character) shown on the brick */
  glyph?: string;
}

export type PowerUpKind =
  | 'expand'
  | 'shrink'
  | 'slow'
  | 'multi'
  | 'sticky'
  | 'laser'
  | 'life';

export interface PowerUpDef {
  kind: PowerUpKind;
  /** UI label */
  label: string;
  /** body color */
  color: number;
  /** weight in random pick (positive number) */
  weight: number;
  /** good for the player? affects per-level whitelisting */
  positive: boolean;
}

export interface LevelDef {
  id: number;
  name: string;
  /** background tint */
  bg?: number;
  /** ball speed multiplier vs base */
  ballSpeedMul?: number;
  /** allowed power-up kinds; empty/undefined = all */
  allowedPowerUps?: PowerUpKind[];
  /**
   * 17-column grid of strings; each row is one brick line from top to bottom.
   * Symbol legend (see data/brickTypes.ts):
   *   "."  empty
   *   "S"  standard (1-hit)
   *   "T"  tough (2-hit)
   *   "H"  hard (3-hit)
   *   "I"  indestructible
   *   "*"  special (1-hit, always drops a power-up)
   */
  rows: string[];
}

export interface ActivePowerUp {
  kind: PowerUpKind;
  /** ms remaining; 0 means instant/permanent */
  remaining: number;
}
