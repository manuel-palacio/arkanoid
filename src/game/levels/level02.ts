import type { LevelDef } from '../types';

const level02: LevelDef = {
  id: 2,
  name: 'THE BELT',
  bg: 0x080612,
  ballSpeedMul: 1.05,
  allowedPowerUps: ['expand', 'slow', 'multi', 'sticky', 'life'],
  palette: {
    standard: 0xb2a48b,
    tough: 0xff8a3d,
    hard: 0x8e6f4a,
    special: 0xffd54f,
  },
  rows: [
    '.............',
    '.SSSSSSSSSSS.',
    'SSSSSSSSSSSSS',
    '.S.S.S*S.S.S.',
    'SSTSTSTSTSTSS',
    '.TTTT*T*TTTT.',
    'SSTSTSTSTSTSS',
    '.S.S.S*S.S.S.',
    'SSSSSSSSSSSSS',
    '.............',
  ],
};

export default level02;
