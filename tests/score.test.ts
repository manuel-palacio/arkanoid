import { describe, it, expect } from 'vitest';
import {
  awardBrickBreak,
  awardLevelClear,
  initialScoreState,
  lifeAwardsAtScore,
  resetChain,
} from '../src/game/data/gameRules';
import { Tuning } from '../src/game/config/tuning';

describe('awardBrickBreak', () => {
  it('first hit gives base points and chain=1', () => {
    const s = initialScoreState();
    const r = awardBrickBreak(s, 100, 1000);
    expect(r.pointsAdded).toBe(100);
    expect(r.chain).toBe(1);
    expect(r.state.score).toBe(100);
  });

  it('rapid hits build chain multiplier', () => {
    let s = initialScoreState();
    let last = -Infinity;
    for (let i = 0; i < 5; i++) {
      const r = awardBrickBreak(s, 100, last + 200);
      s = r.state;
      last = s.lastBreakAt;
    }
    expect(s.chain).toBe(5);
    // base + 5 hits with growing multipliers; final chain x = 1 + 4*0.25 = 2x.
    expect(s.score).toBeGreaterThan(500);
  });

  it('chain resets after configured idle', () => {
    let s = initialScoreState();
    s = awardBrickBreak(s, 100, 0).state;
    const idle = Tuning.score.chainResetMs + 100;
    const r = awardBrickBreak(s, 100, idle);
    expect(r.chain).toBe(1);
  });
});

describe('lifeAwardsAtScore', () => {
  it('grants one life per Tuning.lives.extraEvery score', () => {
    let s = initialScoreState();
    s = { ...s, score: Tuning.lives.extraEvery * 2 };
    const r = lifeAwardsAtScore(s);
    expect(r.extraLives).toBe(2);
    // calling again should grant 0 more.
    const r2 = lifeAwardsAtScore(r.state);
    expect(r2.extraLives).toBe(0);
  });
});

describe('awardLevelClear', () => {
  it('adds clear bonus + per-life bonus', () => {
    const s = initialScoreState();
    const r = awardLevelClear(s, 3);
    expect(r.bonus).toBe(Tuning.score.levelClearBonus + 3 * Tuning.score.perLifeRemainingBonus);
    expect(r.state.score).toBe(r.bonus);
  });
});

describe('resetChain', () => {
  it('zeroes the chain without touching score', () => {
    const s = { ...initialScoreState(), chain: 5, score: 1234 };
    const r = resetChain(s);
    expect(r.chain).toBe(0);
    expect(r.score).toBe(1234);
  });
});
