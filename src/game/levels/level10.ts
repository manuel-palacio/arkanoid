import type { LevelDef } from '../types';

const level10: LevelDef = {
  id: 10,
  name: 'THE MOTHERSHIP',
  bg: 0x05020f,
  ballSpeedMul: 1.42,
  allowedPowerUps: ['expand', 'laser', 'slow', 'life'],
  palette: {
    standard: 0xb388ff,
    tough: 0x7c4dff,
    hard: 0x4a148c,
    special: 0xffd700,
  },
  rows: [
    '....HHHHH....',
    '..HHHHHHHHH..',
    '.HHHHHHHHHHH.',
    'TT.SSSSSSS.TT',
    '.TT.SSSSS.TT.',
    '..*..SSS..*..',
    '...HHHIHHH...',
    '..HHHIIIHHH..',
    '.HHHHI*IHHHH.',
    '.HHH.HHH.HHH.',
    '*HH...H...HH*',
  ],
};

export default level10;
