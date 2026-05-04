/**
 * Daily streak — tracks consecutive days the player has launched the
 * game. Returning the next calendar day grants +1 starting life;
 * missing more than one day resets the count to 1.
 */

export interface StreakState {
  days: number;
  lastVisitYmd: string; // 'YYYY-MM-DD' in local time
  bonusPending: boolean; // a bonus life that hasn't been consumed yet
}

const KEY = 'brickstorm.streak';

export function ymd(d = new Date()): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysBetween(a: string, b: string): number {
  // Inputs are YYYY-MM-DD; parse as local midnight to avoid TZ drift.
  const pa = parseYmd(a);
  const pb = parseYmd(b);
  const ms = pb.getTime() - pa.getTime();
  return Math.round(ms / 86400000);
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map((p) => Number.parseInt(p, 10));
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

export function loadStreak(): StreakState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { days: 0, lastVisitYmd: '', bonusPending: false };
    const parsed = JSON.parse(raw) as StreakState;
    return {
      days: typeof parsed.days === 'number' ? parsed.days : 0,
      lastVisitYmd: typeof parsed.lastVisitYmd === 'string' ? parsed.lastVisitYmd : '',
      bonusPending: !!parsed.bonusPending,
    };
  } catch {
    return { days: 0, lastVisitYmd: '', bonusPending: false };
  }
}

export function saveStreak(s: StreakState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/**
 * Pure rule. Given the current state and "today's" YMD, returns the
 * updated state and whether a bonus life should be granted on this
 * next play. Idempotent: calling twice the same day doesn't bump.
 */
export function tickStreak(prev: StreakState, todayYmd: string): {
  state: StreakState;
  isFirstVisitToday: boolean;
} {
  if (prev.lastVisitYmd === todayYmd) {
    return { state: prev, isFirstVisitToday: false };
  }
  if (prev.lastVisitYmd === '') {
    // First-ever visit.
    return {
      state: { days: 1, lastVisitYmd: todayYmd, bonusPending: false },
      isFirstVisitToday: true,
    };
  }
  const delta = daysBetween(prev.lastVisitYmd, todayYmd);
  if (delta === 1) {
    return {
      state: { days: prev.days + 1, lastVisitYmd: todayYmd, bonusPending: true },
      isFirstVisitToday: true,
    };
  }
  if (delta > 1) {
    return {
      state: { days: 1, lastVisitYmd: todayYmd, bonusPending: false },
      isFirstVisitToday: true,
    };
  }
  // delta === 0 (same calendar day, somehow stored differently) or
  // negative (clock rolled back) — treat as same-day to avoid
  // accidentally incrementing.
  return { state: prev, isFirstVisitToday: false };
}

export function consumeBonus(s: StreakState): StreakState {
  if (!s.bonusPending) return s;
  return { ...s, bonusPending: false };
}
