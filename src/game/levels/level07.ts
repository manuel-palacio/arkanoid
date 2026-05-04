import type { LevelDef } from '../types';

const level07: LevelDef = {
  id: 7,
  name: 'HULL BREACH',
  bg: 0x080a0f,
  ballSpeedMul: 1.22,
  allowedPowerUps: ['expand', 'laser', 'slow', 'life'],
  palette: {
    standard: 0x90a4ae,
    tough: 0x546e7a,
    hard: 0x37474f,
    special: 0xb0bec5,
  },
  rows: [
    'IIIIIIIIIIIII',
    'IHHHHHHHHHHHI',
    'IHSSHHSHHSSHI',
    'IHSS*HHHH*SSI',
    'IHHSHHHHHHSHI',
    'IHHHHHHSHHHHI',
    'IHHHHHSSSHHHI',
    'IHHHHHHHHHHHI',
  ],
};

export default level07;
