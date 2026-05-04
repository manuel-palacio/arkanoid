import type { LevelDef } from '../types';

const level10: LevelDef = {
  id: 10,
  name: 'CITADEL',
  ballSpeedMul: 1.4,
  allowedPowerUps: ['expand', 'slow', 'sticky', 'laser', 'life'],
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
