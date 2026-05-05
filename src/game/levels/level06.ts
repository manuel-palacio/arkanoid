import type { LevelDef } from '../types';

const level06: LevelDef = {
  id: 6,
  name: 'BACK ALLEY',
  bg: 0x060510,
  ballSpeedMul: 1.18,
  allowedPowerUps: ['expand', 'laser', 'slow', 'sticky', 'life'],
  palette: {
    standard: 0xb388ff,
    tough: 0x7c4dff,
    hard: 0x4a148c,
    special: 0xe040fb,
  },
  rows: [
    '.............',
    'SSSSSSSSSSSSS',
    '.SSSSSSSSSSS.',
    'TTTTTTTTTTTTT',
    '.TTT*TTT*TTT.',
    'TTTTTTTTTTTTT',
    'HHHHHHHHHHHHH',
    '.HHH*HHH*HHH.',
    'HHHHHHHHHHHHH',
    'TTTTTTTTTTTTT',
    '.SSSSS*SSSSS.',
    '.............',
  ],
};

export default level06;
