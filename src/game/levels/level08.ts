import type { LevelDef } from '../types';

const level08: LevelDef = {
  id: 8,
  name: 'ENGINE ROOM',
  bg: 0x080a08,
  ballSpeedMul: 1.28,
  allowedPowerUps: ['expand', 'laser', 'slow', 'life'],
  rows: [
    '.............',
    'HHHHWWHWWHHHH',
    'HSSSSSSSSSSSH',
    'HSSTRSRSRTSSH',
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
