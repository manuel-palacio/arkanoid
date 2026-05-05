import type { LevelDef } from '../types';

const level07: LevelDef = {
  id: 7,
  name: 'HULL BREACH',
  bg: 0x080a0f,
  ballSpeedMul: 1.22,
  allowedPowerUps: ['expand', 'laser', 'slow', 'life'],
  rows: [
    '.............',
    'SSSI.SSS.ISSS',
    'TSSI.SPS.ISST',
    'TTSI.STS.ISTT',
    'T*SI.SHS.IS*T',
    'HHSIHSTSHISHH',
    'HHHIPSTSPIHHH',
    'H*HIHSHSHIH*H',
    'HHHIHSSSHIHHH',
    'TT*I.SPS.I*TT',
    'TSSI.SSS.ISST',
    'SSSI.SSS.ISSS',
    '.............',
  ],
};

export default level07;
