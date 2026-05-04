import type { LevelDef } from '../types';

const level03: LevelDef = {
  id: 3,
  name: 'GATEWAY',
  ballSpeedMul: 1.1,
  palette: { standard: 0xff7eb6, tough: 0xffb347, hard: 0xe040fb, special: 0xfff176 },
  rows: [
    'IIIIIIIIIIIII',
    'I.SSSSSSSSS.I',
    'I.STTTTTTTS.I',
    'I.STSSSSSTS.I',
    'I.STS***STS.I',
    'I.STSSSSSTS.I',
    'I.STTTTTTTS.I',
    'I.SSSSSSSSS.I',
  ],
};

export default level03;
