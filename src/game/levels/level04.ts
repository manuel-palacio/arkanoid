import type { LevelDef } from '../types';

const level04: LevelDef = {
  id: 4,
  name: 'IMPACT ZONE',
  bg: 0x0d0810,
  ballSpeedMul: 1.1,
  palette: {
    standard: 0xff5252,
    tough: 0xd84315,
    hard: 0xb71c1c,
    special: 0xff7043,
  },
  rows: [
    '.............',
    'SSSSSSSSSSSSS',
    '.STSTSTSTSTS.',
    'TS.TS.TS.TS.T',
    '.S*STS*STS*S.',
    'ST.ST.ST.ST.S',
    'TSTSTS*STSTST',
    '.ST.ST.ST.ST.',
    'ST.ST.ST.ST.S',
    'SSSSSSSSSSSSS',
    '.............',
  ],
};

export default level04;
