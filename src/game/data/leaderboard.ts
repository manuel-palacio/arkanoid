/**
 * Top-5 leaderboard with 3-letter initials, persisted in localStorage.
 * Pure I/O module — no Phaser dependencies, easy to test.
 */
export interface LeaderEntry {
  initials: string; // exactly 3 chars uppercase
  score: number;
  at: number; // unix ms
}

const KEY = 'brickstorm.leaderboard';
const MAX_ENTRIES = 5;

export function loadLeaderboard(): LeaderEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is LeaderEntry => {
        return (
          !!e &&
          typeof (e as LeaderEntry).initials === 'string' &&
          typeof (e as LeaderEntry).score === 'number' &&
          typeof (e as LeaderEntry).at === 'number'
        );
      })
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function saveLeaderboard(entries: LeaderEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* ignore */
  }
}

/** Returns true if `score` would qualify for the top N. */
export function qualifies(score: number, entries: LeaderEntry[]): boolean {
  if (score <= 0) return false;
  if (entries.length < MAX_ENTRIES) return true;
  const last = entries[entries.length - 1];
  return last !== undefined && score > last.score;
}

/** Returns the inserted entry's rank (1-based) and the new sorted list. */
export function insertEntry(
  current: LeaderEntry[],
  initials: string,
  score: number,
  at = Date.now(),
): { rank: number; list: LeaderEntry[] } {
  const safeInit = (initials.toUpperCase().padEnd(3, ' ').slice(0, 3));
  const next: LeaderEntry = { initials: safeInit, score: Math.max(0, score | 0), at };
  const merged = [...current, next].sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
  const rank = merged.findIndex((e) => e === next) + 1;
  return { rank, list: merged };
}

export const LEADERBOARD_LIMIT = MAX_ENTRIES;
