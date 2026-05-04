/**
 * Persistent mid-run snapshot. Saved each time the player advances a
 * level (or loses a life) and cleared on game over / victory / explicit
 * "new game". Lets the player close the tab and resume where they left
 * off.
 *
 * We deliberately don't snapshot transient gameplay state (ball
 * position, active power-ups, falling capsules). Resume serves a fresh
 * ball at the start of the saved level — the simplest behavior that
 * still preserves meaningful progress (lives + score + level).
 */
export interface SavedRun {
  levelIndex: number; // 0-based
  score: number;
  lives: number;
  /** unix ms of when this snapshot was written */
  savedAt: number;
  /** SemVer of the data format — bump if shape changes. */
  version: 1;
}

const KEY = 'brickstorm.savedRun';
/** Drop saves older than this — stale resumes are confusing. */
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

export function loadSavedRun(): SavedRun | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedRun>;
    if (
      parsed?.version !== 1 ||
      typeof parsed.levelIndex !== 'number' ||
      typeof parsed.score !== 'number' ||
      typeof parsed.lives !== 'number' ||
      typeof parsed.savedAt !== 'number'
    ) {
      return null;
    }
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    if (parsed.lives <= 0 || parsed.levelIndex < 0) return null;
    return parsed as SavedRun;
  } catch {
    return null;
  }
}

export function saveRun(snapshot: Omit<SavedRun, 'savedAt' | 'version'>): void {
  try {
    const payload: SavedRun = {
      ...snapshot,
      savedAt: Date.now(),
      version: 1,
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearSavedRun(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
