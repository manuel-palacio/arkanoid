import { describe, it, expect, beforeEach } from 'vitest';
import { clearSavedRun, loadSavedRun, saveRun } from '../src/game/data/savedRun';

// Minimal in-memory localStorage shim — the module under test only
// touches getItem/setItem/removeItem.
class MemStore {
  store = new Map<string, string>();
  getItem(k: string) { return this.store.get(k) ?? null; }
  setItem(k: string, v: string) { this.store.set(k, v); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

beforeEach(() => {
  const ls = new MemStore();
  // @ts-expect-error patching globals for the test
  globalThis.localStorage = ls;
});

describe('savedRun', () => {
  it('returns null when no save exists', () => {
    expect(loadSavedRun()).toBeNull();
  });

  it('roundtrips a snapshot', () => {
    saveRun({ levelIndex: 3, score: 12500, lives: 2 });
    const r = loadSavedRun();
    expect(r?.levelIndex).toBe(3);
    expect(r?.score).toBe(12500);
    expect(r?.lives).toBe(2);
    expect(r?.version).toBe(1);
  });

  it('clearSavedRun removes the entry', () => {
    saveRun({ levelIndex: 1, score: 100, lives: 1 });
    clearSavedRun();
    expect(loadSavedRun()).toBeNull();
  });

  it('rejects 0-lives runs (game over should not be resumable)', () => {
    globalThis.localStorage.setItem('brickstorm.savedRun', JSON.stringify({
      levelIndex: 0, score: 100, lives: 0, savedAt: Date.now(), version: 1,
    }));
    expect(loadSavedRun()).toBeNull();
  });

  it('rejects entries older than 7 days', () => {
    const oldStamp = Date.now() - 1000 * 60 * 60 * 24 * 8;
    globalThis.localStorage.setItem('brickstorm.savedRun', JSON.stringify({
      levelIndex: 0, score: 100, lives: 3, savedAt: oldStamp, version: 1,
    }));
    expect(loadSavedRun()).toBeNull();
  });

  it('rejects unknown version', () => {
    globalThis.localStorage.setItem('brickstorm.savedRun', JSON.stringify({
      levelIndex: 0, score: 100, lives: 3, savedAt: Date.now(), version: 99,
    }));
    expect(loadSavedRun()).toBeNull();
  });
});
