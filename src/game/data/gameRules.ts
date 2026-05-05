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
  externalMul = 1,
): { state: ScoreState; pointsAdded: number; chain: number } {
  const sinceMs = nowMs - state.lastBreakAt;
  const chain =
    sinceMs > Tuning.score.chainResetMs ? 1 : Math.min(state.chain + 1, Tuning.score.maxChain);
  // Chain multiplier grows linearly: 1x, 1.25x, 1.5x, ... capped.
  const chainMul = 1 + (chain - 1) * 0.25;
  // externalMul is anything coming from active power-ups (score2x, fast).
  const pts = Math.round(basePoints * chainMul * externalMul);
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
  // Clear the timestamp too so the next break starts a fresh chain at 1
  // even if it happens within chainResetMs of the prior one (e.g. the
  // player breaks a brick within 1.5s of losing a life).
  return { ...state, chain: 0, lastBreakAt: -Infinity };
}
