import type { LevelDef } from '../types';

const level08: LevelDef = {
  id: 8,
  name: 'ENGINE ROOM',
  bg: 0x080a08,
  ballSpeedMul: 1.28,
  allowedPowerUps: ['expand', 'laser', 'slow', 'life'],
  palette: {
    standard: 0xff6f00,
    tough: 0xbf360c,
    hard: 0x4caf50,
    special: 0xffeb3b,
  },
  rows: [
    '.............',
    'HHHHHHHHHHHHH',
    'HSSSSSSSSSSSH',
    'HSST*S*S*TSSH',
    'HSSTSSSSSTSSH',
    'HSSTSITISTSSH',
    'HSSTI*H*ITSSH',
    'HSSTSITISTSSH',
    'HSSTSSSSSTSSH',
    'HSST*S*S*TSSH',
    'HSSSSSSSSSSSH',
    'HHHHHHHHHHHHH',
    '.............',
  ],
};

export default level08;
