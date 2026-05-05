import type { LevelDef } from '../types';

const level02: LevelDef = {
  id: 2,
  name: 'THE BELT',
  bg: 0x080612,
  ballSpeedMul: 1.05,
  allowedPowerUps: ['expand', 'slow', 'multi', 'sticky', 'life'],
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
