import type { LevelDef } from '../types';

const level05: LevelDef = {
  id: 5,
  name: 'NEON DISTRICT',
  bg: 0x050d18,
  ballSpeedMul: 1.15,
  allowedPowerUps: ['expand', 'multi', 'sticky', 'laser', 'slow', 'life'],
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
