import type { LevelDef } from '../types';

const level10: LevelDef = {
  id: 10,
  name: 'THE MOTHERSHIP',
  bg: 0x05020f,
  ballSpeedMul: 1.42,
  allowedPowerUps: ['expand', 'laser', 'slow', 'life'],
  rows: [
    'IIIIIIIIIIIII',
    'I*HHHHWHHHH*I',
    'IHTTTTRTTTTHI',
    'IHTHHHVHHHTHI',
    'IHTH*S*S*HTHI',
    'IHTHSSTSSHTHI',
    'IHTHSTVTSHTHI',
    'IHTHSTHTSHTHI',
    'IHTHSSTSSHTHI',
    'IHTHST*TSHTHI',
    'IHTH*S*S*HTHI',
    'IHTHHHHHHHTHI',
    'IHTTTTTTTTTHI',
    'IIIIIIIIIIIII',
  ],
};

export default level10;
