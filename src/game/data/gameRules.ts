import { Tuning } from '../config/tuning';

/**
 * Pure, branchable scoring/progression rules. Kept dependency-free so they
 * can be unit-tested in Vitest with no Phaser instance.
 */
export interface ScoreState {
  score: number;
  chain: number;
  lastBreakAt: number;
  lifeBonusGranted: number; // total lives awarded so far via threshold
}

export const initialScoreState = (): ScoreState => ({
  score: 0,
  chain: 0,
  lastBreakAt: -Infinity,
  lifeBonusGranted: 0,
});

/** Award score for a brick break. Returns updated state and points actually added. */
export function awardBrickBreak(
  state: ScoreState,
  basePoints: number,
  nowMs: number,
): { state: ScoreState; pointsAdded: number; chain: number } {
  const sinceMs = nowMs - state.lastBreakAt;
  const chain =
    sinceMs > Tuning.score.chainResetMs ? 1 : Math.min(state.chain + 1, Tuning.score.maxChain);
  // Multiplier grows linearly: 1x, 1.25x, 1.5x, ... capped.
  const multiplier = 1 + (chain - 1) * 0.25;
  const pts = Math.round(basePoints * multiplier);
  return {
    state: {
      score: state.score + pts,
      chain,
      lastBreakAt: nowMs,
      lifeBonusGranted: state.lifeBonusGranted,
    },
    pointsAdded: pts,
    chain,
  };
}

export function awardLevelClear(state: ScoreState, livesRemaining: number): {
  state: ScoreState;
  bonus: number;
} {
  const bonus = Tuning.score.levelClearBonus + livesRemaining * Tuning.score.perLifeRemainingBonus;
  return { state: { ...state, score: state.score + bonus, chain: 0 }, bonus };
}

/** Returns how many extra lives should be granted given the new score. */
export function lifeAwardsAtScore(state: ScoreState): { extraLives: number; state: ScoreState } {
  const earned = Math.floor(state.score / Tuning.lives.extraEvery);
  const delta = Math.max(0, earned - state.lifeBonusGranted);
  return { extraLives: delta, state: { ...state, lifeBonusGranted: earned } };
}

export function resetChain(state: ScoreState): ScoreState {
  return { ...state, chain: 0 };
}
