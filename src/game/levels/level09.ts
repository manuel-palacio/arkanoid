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
    'HHIHHIHHHIHHH',
    'HHHIHHIHHHHIH',
    'IHH*IHHIHH*HI',
    'HHIHIHHHHIHHH',
    'HIHHHIHHIHHHI',
    'TSTITSTSTSITS',
    'STITSTSTSTITS',
    'TS*STSTITS*ST',
    'STSITSITSITST',
    'TSTSTSTSTSTST',
  ],
};

export default level09;
