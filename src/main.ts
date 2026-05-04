import { createGame } from './game/AppGame';

const parent = document.getElementById('game');
if (!parent) {
  throw new Error('Missing #game container');
}

const params = new URLSearchParams(window.location.search);
const debug = params.get('debug') === '1';

createGame({ parent, debug });
