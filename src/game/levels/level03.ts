import type { LevelDef } from '../types';

const level03: LevelDef = {
  id: 3,
  name: 'ROCK SHOWER',
  bg: 0x0a0610,
  ballSpeedMul: 1.1,
  allowedPowerUps: ['expand', 'slow', 'sticky', 'multi', 'life'],
  palette: {
    standard: 0xffab40,
    tough: 0xff6d00,
    hard: 0xc62828,
    special: 0xff7043,
  },
  rows: [
    'TTSS.SSSSSS..',
    '.STT.S.S.S..*',
    '..S.SSTTS.SSI',
    'TS..S.S.SSS..',
    '.S.STT..S.*..',
    'SSSST.S.S.SS*',
  ],
};

export default level03;
