import { describe, it, expect } from 'vitest';
import { createPowerUpSelector } from '../src/game/systems/PowerUpSystem';
import { ALL_POWERUP_KINDS } from '../src/game/data/powerUps';

describe('PowerUpSelector', () => {
  it('always returns a valid kind from the default pool', () => {
    const sel = createPowerUpSelector(42);
    for (let i = 0; i < 100; i++) {
      const k = sel.pickNext();
      expect(ALL_POWERUP_KINDS).toContain(k);
    }
  });

  it('respects the allowed-kinds whitelist', () => {
    const sel = createPowerUpSelector(7);
    const whitelist = ['expand', 'slow', 'life'] as const;
    for (let i = 0; i < 100; i++) {
      const k = sel.pickNext(whitelist);
      expect(whitelist).toContain(k);
    }
  });

  it('does not repeat the same kind twice in a row when pool > 1', () => {
    const sel = createPowerUpSelector(123);
    let last = sel.pickNext();
    for (let i = 0; i < 200; i++) {
      const next = sel.pickNext();
      expect(next).not.toBe(last);
      last = next;
    }
  });

  it('shouldDrop honors brick drop chance probabilistically', () => {
    const sel = createPowerUpSelector(99);
    let drops = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) if (sel.shouldDrop(0.3)) drops++;
    // 99.9% chance to be in this band for N=1000, p=0.3.
    expect(drops).toBeGreaterThan(180);
    expect(drops).toBeLessThan(420);
  });

  it('seeded selectors are deterministic', () => {
    const a = createPowerUpSelector(2025);
    const b = createPowerUpSelector(2025);
    for (let i = 0; i < 50; i++) {
      expect(a.pickNext()).toBe(b.pickNext());
    }
  });
});
