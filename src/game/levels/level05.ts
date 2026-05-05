import type { LevelDef } from '../types';

const level05: LevelDef = {
  id: 5,
  name: 'NEON DISTRICT',
  bg: 0x050d18,
  ballSpeedMul: 1.15,
  allowedPowerUps: ['expand', 'multi', 'sticky', 'laser', 'slow', 'life'],
  palette: {
    standard: 0x00e5ff,
    tough: 0xea80fc,
    hard: 0x76ff03,
    special: 0xfff176,
  },
  rows: [
    '.............',
    '......*......',
    '.....HSH.....',
    '....HSSSH....',
    '...HSTTTSH...',
    '..HSTSSSTSH..',
    '..HSTS*STSH..',
    '..HSTSSSTSH..',
    '...HSTTTSH...',
    '....HSSSH....',
    '.....HSH.....',
    '.............',
  ],
};

export default level05;
