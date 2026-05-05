export type Vec2 = { x: number; y: number };

/**
 * Behavioral state for the ball. Mutually exclusive — applying a new
 * mode replaces the previous. Magnet and fast are intentionally NOT
 * modes (they're independent toggles that compose with any mode).
 */
export type BallMode = 'normal' | 'through' | 'big' | 'ghost' | 'charged';

export type BrickKind =
  | 'standard'
  | 'tough'
  | 'hard'
  | 'indestructible'
  | 'special'
  | 'bomb'
  | 'moving'
  | 'bumper'
  | 'cursed';

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
  // Paddle
  | 'expand'
  | 'shrink'
  // Ball speed
  | 'slow'
  | 'fast'
  // Ball count / control
  | 'multi'
  | 'sticky'
  // Offense
  | 'laser'
  // Ball behavior
  | 'through'
  | 'big'
  | 'magnet'
  // Brick field
  | 'bomb'
  | 'gravity'
  // Forgiveness / score
  | 'ghost'
  | 'score2x'
  // Economy
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

export interface LevelPalette {
  standard?: number;
  tough?: number;
  hard?: number;
  special?: number;
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
  /** per-level color overrides; falls back to archetype defaults */
  palette?: LevelPalette;
  /**
   * 13-column grid of strings; each row is one brick line from top to bottom.
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
