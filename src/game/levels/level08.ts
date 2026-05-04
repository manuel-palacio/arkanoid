import type { LevelDef } from '../types';

const level08: LevelDef = {
  id: 8,
  name: 'STARFALL',
  ballSpeedMul: 1.25,
  palette: { standard: 0x80deea, tough: 0xff8a65, hard: 0xce93d8, special: 0xfff59d },
  rows: [
    '......H......',
    '.....HTH.....',
    '....HTSTH....',
    '...HTS*STH...',
    '....HTSTH....',
    '.....HTH.....',
    '......H......',
    'I...I.*.I...I',
  ],
};

export default level08;
