import type { LevelDef } from '../types';

const level01: LevelDef = {
  id: 1,
  name: 'SECTOR ZERO',
  bg: 0x030510,
  ballSpeedMul: 1.0,
  allowedPowerUps: ['expand', 'slow', 'multi', 'life'],
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
