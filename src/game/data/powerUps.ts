import type { PowerUpDef, PowerUpKind } from '../types';

export const POWERUPS: Record<PowerUpKind, PowerUpDef> = {
  expand: { kind: 'expand', label: 'WIDEN', color: 0x4af2a1, weight: 14, positive: true },
  shrink: { kind: 'shrink', label: 'NARROW', color: 0xff5d6c, weight: 4, positive: false },
  slow: { kind: 'slow', label: 'SLOW', color: 0x4ad6ff, weight: 10, positive: true },
  multi: { kind: 'multi', label: 'MULTI', color: 0xffd23a, weight: 8, positive: true },
  sticky: { kind: 'sticky', label: 'CATCH', color: 0xb96bff, weight: 9, positive: true },
  laser: { kind: 'laser', label: 'FIRE', color: 0xff5dab, weight: 9, positive: true },
  life: { kind: 'life', label: '1UP', color: 0xffffff, weight: 2, positive: true },
};

export const POWERUP_TEXTURE: Record<PowerUpKind, string> = {
  expand: 'pu-expand',
  shrink: 'pu-shrink',
  slow: 'pu-slow',
  multi: 'pu-multi',
  sticky: 'pu-sticky',
  laser: 'pu-laser',
  life: 'pu-life',
};

export const ALL_POWERUP_KINDS: PowerUpKind[] = [
  'expand',
  'shrink',
  'slow',
  'multi',
  'sticky',
  'laser',
  'life',
];
