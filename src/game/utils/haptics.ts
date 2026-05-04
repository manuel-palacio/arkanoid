/**
 * Tiny wrapper around navigator.vibrate. Android Chrome supports it;
 * iOS Safari ignores it (Apple disabled the API). Calls are best-effort
 * and silently swallow errors / missing support.
 */

type VibrateArg = number | number[];

function safeVibrate(p: VibrateArg): void {
  try {
    const nav = navigator as Navigator & { vibrate?: (p: VibrateArg) => boolean };
    if (typeof nav.vibrate === 'function') nav.vibrate(p);
  } catch {
    /* ignore */
  }
}

export const haptic = {
  /** Brief tick — paddle bounce, UI tap. */
  tick(): void {
    safeVibrate(6);
  },
  /** Short bump — brick break, power-up pickup. */
  bump(): void {
    safeVibrate(14);
  },
  /** Heavy thump — life lost, game over. */
  thump(): void {
    safeVibrate([18, 36, 18]);
  },
  /** Cancel any pending vibration (e.g. on pause / scene shutdown). */
  cancel(): void {
    safeVibrate(0);
  },
};
