import type { LevelDef } from '../types';

const level09: LevelDef = {
  id: 9,
  name: 'REACTOR CORE',
  bg: 0x0f0608,
  ballSpeedMul: 1.35,
  allowedPowerUps: ['expand', 'laser', 'slow', 'life', 'sticky'],
  rows: [
    '.............',
    'HHHHHHHHHHHHH',
    'HTTTTTTTTTTTH',
    'HTSSSSSSSSSTH',
    'HTS*HSCSH*STH',
    'HTSHHHIHHHSTH',
    'HTSHIHTHIHSTH',
    'HTSHIHIHIHSTH',
    'HTSHIHTHIHSTH',
    'HTSHHHIHHHSTH',
    'HTSCHSHSHCSTH',
    'HTSSSSSSSSSTH',
    'HTTTTTTTTTTTH',
    'HHHHHHHHHHHHH',
  ],
};

export default level09;
