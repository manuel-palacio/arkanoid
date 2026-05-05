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
    '.SSSSSBSSSSS.',
    'TTTTTTTTTTTTT',
    '.TTT*TBT*TTT.',
    'TTTTTTTTTTTTT',
    'HHHHHHBHHHHHH',
    '.HHH*HBH*HHH.',
    'HHHHHHHHHHHHH',
    'TTTTTBTBTTTTT',
    '.SSSSS*SSSSS.',
    '.............',
  ],
};

export default level06;
