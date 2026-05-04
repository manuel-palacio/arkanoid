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
    'IIIII.S.IIIII',
    'I.S..ISI..S.I',
    'I.STI.S.ITS.I',
    'I*S.I.T.I.S*I',
    'I.STI.S.ITS.I',
    'I.S..I*I..S.I',
    'I.S.STSTS.S.I',
    'IIIII.S.IIIII',
  ],
};

export default level06;
