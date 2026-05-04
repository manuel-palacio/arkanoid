import { describe, it, expect } from 'vitest';
import { insertEntry, qualifies, LEADERBOARD_LIMIT } from '../src/game/data/leaderboard';

describe('leaderboard', () => {
  it('qualifies when below limit and score > 0', () => {
    expect(qualifies(100, [])).toBe(true);
  });

  it('does not qualify with score 0', () => {
    expect(qualifies(0, [])).toBe(false);
  });

  it('qualifies when board is full but score beats last entry', () => {
    const list = Array.from({ length: LEADERBOARD_LIMIT }, (_, i) => ({
      initials: 'AAA',
      score: 1000 - i * 10,
      at: i,
    }));
    expect(qualifies(1, list)).toBe(false);
    expect(qualifies(960, list)).toBe(false);
    expect(qualifies(961, list)).toBe(true);
  });

  it('insertEntry sorts descending and trims to limit', () => {
    const start = [
      { initials: 'AAA', score: 500, at: 1 },
      { initials: 'BBB', score: 300, at: 2 },
    ];
    const { rank, list } = insertEntry(start, 'CCC', 400);
    expect(rank).toBe(2);
    expect(list[0]?.score).toBe(500);
    expect(list[1]?.score).toBe(400);
    expect(list[2]?.score).toBe(300);
  });

  it('insertEntry uppercases and pads initials to 3 chars', () => {
    const { list } = insertEntry([], 'a', 100);
    expect(list[0]?.initials).toBe('A  ');
    const { list: l2 } = insertEntry([], 'abcdef', 100);
    expect(l2[0]?.initials).toBe('ABC');
  });
});
