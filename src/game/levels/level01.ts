import type { LevelDef } from '../types';

const level01: LevelDef = {
  id: 1,
  name: 'SECTOR ZERO',
  bg: 0x030510,
  ballSpeedMul: 1.0,
  allowedPowerUps: ['expand', 'slow', 'multi', 'life'],
  palette: {
    standard: 0xffe082,
    tough: 0xffb74d,
    hard: 0xff8a65,
    special: 0xfff176,
  },
  rows: [
    '.............',
    '.SSSSSSSSSSS.',
    'SS.SS.SS.SS.S',
    '.S.S.*.*.S.S.',
    'SSSSSSSSSSSSS',
    '.SS.SS.SS.SS.',
    'S.S.S.S.S.S.S',
    '.SSSSSSSSSSS.',
    'SS.SS.SS.SS.S',
    '.............',
  ],
};

export default level01;
