import {
  awardBrickBreak,
  awardLevelClear,
  initialScoreState,
  lifeAwardsAtScore,
  resetChain,
  type ScoreState,
} from '../data/gameRules';
import { Tuning } from '../config/tuning';

/**
 * Mutable wrapper around the pure rules in data/gameRules.ts. Keeps a single
 * source of truth for score / chain / lives in the GameScene.
 */
export class ScoreSystem {
  private state: ScoreState = initialScoreState();
  private lives: number;
  private hi: number;

  constructor(initialLives: number, highScore: number) {
    this.lives = initialLives;
    this.hi = highScore;
  }

  get score(): number {
    return this.state.score;
  }
  get chain(): number {
    return this.state.chain;
  }
  get livesLeft(): number {
    return this.lives;
  }
  get highScore(): number {
    return Math.max(this.hi, this.state.score);
  }

  /**
   * Award a brick break. `externalMul` is applied on top of the chain
   * multiplier — used by score2x (×2) and fast/TURBO (×1.5) power-ups.
   * Returns the points actually added and current chain count.
   */
  brickBroken(basePoints: number, nowMs: number, externalMul = 1): { points: number; chain: number } {
    const out = awardBrickBreak(this.state, basePoints, nowMs, externalMul);
    this.state = out.state;
    return { points: out.pointsAdded, chain: out.chain };
  }

  loseLife(): { livesLeft: number } {
    this.lives = Math.max(0, this.lives - 1);
    this.state = resetChain(this.state);
    return { livesLeft: this.lives };
  }

  awardLifeIfDue(): { granted: number } {
    const { extraLives, state } = lifeAwardsAtScore(this.state);
    this.state = state;
    if (extraLives > 0) {
      this.lives = Math.min(Tuning.lives.max, this.lives + extraLives);
    }
    return { granted: extraLives };
  }

  grantLife(): void {
    this.lives = Math.min(Tuning.lives.max, this.lives + 1);
  }

  levelCleared(livesRemaining: number): { bonus: number } {
    const out = awardLevelClear(this.state, livesRemaining);
    this.state = out.state;
    return { bonus: out.bonus };
  }

  resetChain(): void {
    this.state = resetChain(this.state);
  }

  /** Used when restoring a mid-run score across scene restarts. */
  restoreScore(score: number): void {
    this.state = { ...this.state, score: Math.max(0, score | 0) };
  }
}
