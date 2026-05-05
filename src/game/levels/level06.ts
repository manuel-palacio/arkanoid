import type { LevelDef } from '../types';

const level06: LevelDef = {
  id: 6,
  name: 'BACK ALLEY',
  bg: 0x060510,
  ballSpeedMul: 1.18,
  allowedPowerUps: ['expand', 'laser', 'slow', 'sticky', 'life'],
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
