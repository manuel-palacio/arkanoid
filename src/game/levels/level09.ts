import type { LevelDef } from '../types';

const level09: LevelDef = {
  id: 9,
  name: 'REACTOR CORE',
  bg: 0x0f0608,
  ballSpeedMul: 1.35,
  allowedPowerUps: ['expand', 'laser', 'slow', 'life', 'sticky'],
  palette: {
    standard: 0xff5252,
    tough: 0xff9100,
    hard: 0xff1744,
    special: 0xffffff,
  },
  rows: [
    '.............',
    'HHHHHHHHHHHHH',
    'HTTTTTTTTTTTH',
    'HTSSSSSSSSSTH',
    'HTS*HSHSH*STH',
    'HTSHHHIHHHSTH',
    'HTSHIHTHIHSTH',
    'HTSHIHIHIHSTH',
    'HTSHIHTHIHSTH',
    'HTSHHHIHHHSTH',
    'HTS*HSHSH*STH',
    'HTSSSSSSSSSTH',
    'HTTTTTTTTTTTH',
    'HHHHHHHHHHHHH',
  ],
};

export default level09;
