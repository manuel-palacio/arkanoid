import { describe, it, expect } from 'vitest';
import { analyzeLevel } from '../src/game/systems/LevelSystem';
import { LEVELS } from '../src/game/levels';

describe('LevelSystem.analyzeLevel', () => {
  it('counts bricks correctly per level', () => {
    for (const def of LEVELS) {
      const a = analyzeLevel(def);
      expect(a.total).toBe(a.breakable + a.indestructible);
      expect(a.breakable).toBeGreaterThan(0);
    }
  });

  it('every level fits inside the column count', () => {
    for (const def of LEVELS) {
      for (const row of def.rows) {
        expect(row.length).toBeLessThanOrEqual(13);
      }
    }
  });

  it('ignores . and space cells', () => {
    const a = analyzeLevel({ id: 99, name: 'TEST', rows: ['.S.', ' T '] });
    expect(a.total).toBe(2);
    expect(a.breakable).toBe(2);
  });

  it('treats I as indestructible', () => {
    const a = analyzeLevel({ id: 99, name: 'TEST', rows: ['III'] });
    expect(a.total).toBe(3);
    expect(a.indestructible).toBe(3);
    expect(a.breakable).toBe(0);
  });
});
