import type { LevelDef } from '../types';

const level05: LevelDef = {
  id: 5,
  name: 'NEON DISTRICT',
  bg: 0x050d18,
  ballSpeedMul: 1.15,
  allowedPowerUps: ['expand', 'multi', 'sticky', 'laser', 'slow', 'life'],
  palette: {
    standard: 0x00e5ff,
    tough: 0xea80fc,
    hard: 0x76ff03,
    special: 0xfff176,
  },
  rows: [
    '.I*S.I.S.I.S.',
    '.IST.IST.IST.',
    '.IST.IST.IST.',
    '.I*S.I*S.I*S.',
    '.ITS.ITS.ITS.',
    '.ITS.IT*.ITS.',
    '.IS*.ISS.IS*.',
    '.III.III.III.',
  ],
};

export default level05;
