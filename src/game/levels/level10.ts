import type { LevelDef } from '../types';

const level10: LevelDef = {
  id: 10,
  name: 'CITADEL',
  ballSpeedMul: 1.4,
  allowedPowerUps: ['expand', 'slow', 'sticky', 'laser', 'life'],
  palette: { standard: 0xff5d6c, tough: 0xff9f43, hard: 0xff3ad9, special: 0xffd23a },
  rows: [
    'IIIIIIIIIIIII',
    'IHHHHHHHHHHHI',
    'IHTTTTTTTTTHI',
    'IHTSSSSSSSTHI',
    'IHTS*****STHI',
    'IHTSSSSSSSTHI',
    'IHTTTTTTTTTHI',
    'IHHHHHHHHHHHI',
    'I.*.*.*.*.*.I',
  ],
};

export default level10;
