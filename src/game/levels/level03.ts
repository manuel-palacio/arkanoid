import type { LevelDef } from '../types';

const level03: LevelDef = {
  id: 3,
  name: 'ROCK SHOWER',
  bg: 0x0a0610,
  ballSpeedMul: 1.1,
  allowedPowerUps: ['expand', 'slow', 'sticky', 'multi', 'life'],
  palette: {
    standard: 0xffab40,
    tough: 0xff6d00,
    hard: 0xc62828,
    special: 0xff7043,
  },
  rows: [
    '.............',
    '.S..S..S..S..',
    'S.SS.SS.SS.SS',
    '.S*S..S..S*S.',
    'T.S.STTTS.S.T',
    '.STISSTSSITS.',
    'T.S.STTTS.S.T',
    '.S*S..S..S*S.',
    'S.SS.SS.SS.SS',
    '.S..S..S..S..',
    '.............',
  ],
};

export default level03;
