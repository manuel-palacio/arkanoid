/**
 * Background poller that fetches /version.json on a fixed interval and
 * fires onNewVersion() the first time the deployed version differs from
 * the version baked into the running bundle. After firing once it
 * stops polling — a single notification is enough.
 *
 * Why this exists: long-lived browser tabs never re-fetch the HTML
 * shell, so even with no-cache headers on index.html they keep running
 * the original bundle. The poller is the only way to surface "a new
 * version is available" without a service worker.
 *
 * Failure mode: network errors (offline, server hiccup) are swallowed
 * silently and retried on the next interval.
 */
export class VersionPoller {
  private readonly loadedHash: string;
  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly onNewVersion: () => void,
    private readonly intervalMs = 2 * 60 * 1000,
  ) {
    this.loadedHash = __BUILD_HASH__;
  }

  start(): void {
    // Immediate check — covers the case where the tab was backgrounded
    // for hours and JS finally resumed running on a stale bundle.
    void this.check();
    this.timerId = setInterval(() => void this.check(), this.intervalMs);
  }

  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private async check(): Promise<void> {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const body = (await res.json()) as { v?: string };
      if (body.v && body.v !== this.loadedHash) {
        this.stop();
        this.onNewVersion();
      }
    } catch {
      /* offline / transient failure — try again next interval */
    }
  }
}
