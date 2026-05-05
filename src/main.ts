import { createGame } from './game/AppGame';

// Single boot log so a remote DevTools / Safari Web Inspector session
// can confirm which build is actually running on a mobile device. The
// timestamp is injected at build time by vite.config.ts.
// eslint-disable-next-line no-console
console.log('[Brickstorm] build:', import.meta.env.VITE_BUILD_TIME);

const parent = document.getElementById('game');
if (!parent) {
  throw new Error('Missing #game container');
}

const params = new URLSearchParams(window.location.search);
const debug = params.get('debug') === '1';

createGame({ parent, debug });
