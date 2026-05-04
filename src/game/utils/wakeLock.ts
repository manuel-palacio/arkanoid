/**
 * Screen Wake Lock helper. Without this, mobile browsers dim and lock
 * the screen after a few seconds of no input even though our game is
 * actively rendering. The Wake Lock API is supported on Android Chrome
 * and iOS Safari 16.4+. Best-effort: silently no-ops where unsupported.
 */

interface ReleasableWakeLock {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

interface WakeLockApi {
  request(type: 'screen'): Promise<ReleasableWakeLock>;
}

let lock: ReleasableWakeLock | null = null;
let visibilityHandlerInstalled = false;

function getApi(): WakeLockApi | null {
  const nav = navigator as Navigator & { wakeLock?: WakeLockApi };
  return nav.wakeLock ?? null;
}

export async function acquireWakeLock(): Promise<void> {
  const api = getApi();
  if (!api || lock) return;
  try {
    lock = await api.request('screen');
    lock.addEventListener('release', () => {
      lock = null;
    });
    installVisibilityHandler();
  } catch {
    /* permission denied or unsupported — ignore */
  }
}

export async function releaseWakeLock(): Promise<void> {
  if (!lock) return;
  try {
    await lock.release();
  } catch {
    /* ignore */
  }
  lock = null;
}

/**
 * Re-acquire the wake lock when the page becomes visible again. Browsers
 * release it automatically when the tab is hidden / app backgrounded.
 */
function installVisibilityHandler(): void {
  if (visibilityHandlerInstalled) return;
  visibilityHandlerInstalled = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !lock) {
      void acquireWakeLock();
    }
  });
}
