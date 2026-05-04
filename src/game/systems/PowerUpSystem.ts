import { POWERUPS, ALL_POWERUP_KINDS } from '../data/powerUps';
import type { PowerUpKind } from '../types';
import { mulberry32, weightedPick } from '../utils/rng';
import { Tuning } from '../config/tuning';

/**
 * Pure power-up RNG: given allowed kinds and the most recent kind dropped,
 * picks the next kind via weighted selection with optional repeat suppression.
 * Lifted out of any Phaser dependency so it's unit-testable.
 */
export interface PowerUpSelector {
  pickNext(allowed?: readonly PowerUpKind[]): PowerUpKind;
  shouldDrop(brickDropChance: number): boolean;
}

export function createPowerUpSelector(seed = 1): PowerUpSelector {
  const rng = mulberry32(seed);
  let lastDropped: PowerUpKind | null = null;

  function pickNext(allowed?: readonly PowerUpKind[]): PowerUpKind {
    const pool = allowed && allowed.length > 0 ? allowed.slice() : ALL_POWERUP_KINDS.slice();
    let candidates = pool.slice();
    let weights = candidates.map((k) => POWERUPS[k].weight);
    if (Tuning.powerups.suppressRepeats && lastDropped && candidates.length > 1) {
      const idx = candidates.indexOf(lastDropped);
      if (idx >= 0) {
        candidates = candidates.filter((_, i) => i !== idx);
        weights = weights.filter((_, i) => i !== idx);
      }
    }
    const picked = weightedPick(candidates, weights, rng);
    lastDropped = picked;
    return picked;
  }

  function shouldDrop(brickDropChance: number): boolean {
    return rng() < brickDropChance;
  }

  return { pickNext, shouldDrop };
}
