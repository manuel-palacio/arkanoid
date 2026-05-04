import { describe, it, expect } from 'vitest';
import { consumeBonus, daysBetween, tickStreak } from '../src/game/data/streak';

describe('streak', () => {
  it('first-ever visit creates day 1 with no bonus', () => {
    const r = tickStreak({ days: 0, lastVisitYmd: '', bonusPending: false }, '2026-05-04');
    expect(r.state.days).toBe(1);
    expect(r.state.bonusPending).toBe(false);
    expect(r.isFirstVisitToday).toBe(true);
  });

  it('returning the next day increments and grants pending bonus', () => {
    const start = { days: 1, lastVisitYmd: '2026-05-04', bonusPending: false };
    const r = tickStreak(start, '2026-05-05');
    expect(r.state.days).toBe(2);
    expect(r.state.bonusPending).toBe(true);
    expect(r.isFirstVisitToday).toBe(true);
  });

  it('skipping a day resets to 1 and no bonus', () => {
    const start = { days: 7, lastVisitYmd: '2026-05-04', bonusPending: true };
    const r = tickStreak(start, '2026-05-07');
    expect(r.state.days).toBe(1);
    expect(r.state.bonusPending).toBe(false);
  });

  it('same-day re-entry is idempotent', () => {
    const start = { days: 3, lastVisitYmd: '2026-05-04', bonusPending: true };
    const r = tickStreak(start, '2026-05-04');
    expect(r.state).toBe(start);
    expect(r.isFirstVisitToday).toBe(false);
  });

  it('daysBetween computes calendar deltas regardless of TZ', () => {
    expect(daysBetween('2026-05-04', '2026-05-05')).toBe(1);
    expect(daysBetween('2026-05-04', '2026-05-04')).toBe(0);
    expect(daysBetween('2026-04-30', '2026-05-02')).toBe(2);
  });

  it('consumeBonus clears the pending flag', () => {
    const s = { days: 5, lastVisitYmd: '2026-05-04', bonusPending: true };
    expect(consumeBonus(s).bonusPending).toBe(false);
    // already-zero stays zero (no allocation churn assertion)
    expect(consumeBonus({ ...s, bonusPending: false }).bonusPending).toBe(false);
  });
});
