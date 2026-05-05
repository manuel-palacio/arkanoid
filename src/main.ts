import { createGame } from './game/AppGame';
import { VersionPoller } from './game/utils/VersionPoller';

// Single boot log so a remote DevTools / Safari Web Inspector session
// can confirm which build is actually running on a mobile device. The
// timestamp + git SHA are injected at build time by vite.config.ts.
// eslint-disable-next-line no-console
console.log('[Brickstorm] build:', import.meta.env.VITE_BUILD_TIME, __BUILD_HASH__);

const parent = document.getElementById('game');
if (!parent) {
  throw new Error('Missing #game container');
}

const params = new URLSearchParams(window.location.search);
const debug = params.get('debug') === '1';

createGame({ parent, debug });

// "New version available" banner — only matters for long-lived tabs
// where the no-cache HTML headers can't help (the page is already
// loaded). VersionPoller fetches /version.json on an interval and
// compares to the hash baked into this bundle.
const banner = document.getElementById('update-banner');
const refreshBtn = document.getElementById('update-btn');
const dismissBtn = document.getElementById('update-dismiss');
if (banner && refreshBtn && dismissBtn) {
  const poller = new VersionPoller(() => {
    banner.hidden = false;
  });
  refreshBtn.addEventListener('click', () => window.location.reload());
  dismissBtn.addEventListener('click', () => {
    banner.hidden = true;
  });
  poller.start();
}
