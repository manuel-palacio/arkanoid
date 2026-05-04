import type { LevelDef } from '../types';

const level05: LevelDef = {
  id: 5,
  name: 'PILLARS',
  ballSpeedMul: 1.15,
  palette: { standard: 0x6effa1, tough: 0x3aa3ff, hard: 0xb388ff, special: 0xffe066 },
  rows: [
    'I...I...I...I',
    'IHHHIHHHIHHHI',
    'I.T.I.T.I.T.I',
    'IHHHIHHHIHHHI',
    'I.S.I.S.I.S.I',
    'IHHHIHHHIHHHI',
    'I*..I.*.I..*I',
  ],
};

export default level05;
