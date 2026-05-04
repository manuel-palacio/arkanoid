/**
 * Centralized gameplay constants. Adjust here, not inside scenes/entities.
 * Distances are in logical pixels at the fixed playfield resolution defined
 * in `gameConfig.ts`.
 */
export const Tuning = {
  // Playfield — portrait 9:16 for mobile-first.
  playfield: {
    width: 540,
    height: 960,
    wallThickness: 14,
    floorY: 960, // y past which a ball is "lost"
    hudHeight: 64,
  },

  // Paddle
  paddle: {
    y: 880,
    baseWidth: 110,
    minWidth: 70,
    maxWidth: 180,
    height: 16,
    speed: 620, // px/sec keyboard
    color: 0x9bf2ff,
    accentColor: 0xffffff,
    /** maximum outgoing angle from vertical, in radians (75 deg) */
    maxBounceAngle: (75 * Math.PI) / 180,
    /** minimum vertical component as a fraction of speed to avoid horizontal stalls */
    minVerticalFraction: 0.18,
    /** ±deg jitter applied on every paddle bounce */
    bounceJitterDeg: 1.0,
  },

  // Ball
  ball: {
    radius: 8,
    baseSpeed: 360,
    minSpeed: 280,
    maxSpeed: 680,
    /** speed gained per brick destroyed, capped at maxSpeed */
    speedupPerBrick: 1.2,
    color: 0xffffff,
    trailColor: 0x9bf2ff,
    /** capped x|y velocity for tunneling guard substep computation */
    substepMinPixels: 5,
  },

  // Bricks — 13 cols at 36×18 with a 2px gap fits 540 wide cleanly.
  // Field width = 13*36 + 12*2 = 468 + 24 = 492; canvas inside walls = 540 - 28 = 512.
  // Centered offset = WALL + (512 - 492) / 2 = 14 + 10 = 24.
  bricks: {
    cols: 13,
    rowGap: 3,
    colGap: 2,
    width: 36,
    height: 18,
    fieldOffsetX: 24,
    fieldOffsetY: 90,
    flashMs: 70,
    /**
     * Row-cycled rainbow used for standard ("S") bricks when a level has
     * no palette override. Picks colors by row index so a level full of
     * S bricks reads as horizontal color stripes rather than a single
     * cold-blue field.
     */
    rainbowRowColors: [
      0xff5d6c, // red
      0xff9f43, // orange
      0xffd23a, // yellow
      0x4af2a1, // green
      0x4ad6ff, // blue
      0xb96bff, // purple
    ],
  },

  // Power-ups
  powerups: {
    speed: 150,
    width: 38,
    height: 16,
    /** ms duration for timed power-ups */
    durations: {
      expand: 18000,
      shrink: 12000,
      slow: 12000,
      sticky: 18000,
      laser: 14000,
    },
    /** base drop chance (overridden by brick archetype dropChance) */
    baseDrop: 0.16,
    /** never spawn the same kind twice in a row */
    suppressRepeats: true,
  },

  // Laser projectile
  laser: {
    speed: 700,
    width: 4,
    height: 12,
    cooldownMs: 220,
    color: 0xff5dab,
    damage: 1,
  },

  // Score
  score: {
    /** chain multiplier capped at maxChain; resets after chainResetMs without a brick break */
    chainResetMs: 1500,
    maxChain: 8,
    levelClearBonus: 1500,
    perLifeRemainingBonus: 250,
  },

  // Lives
  lives: {
    initial: 3,
    /** extra life every N points */
    extraEvery: 20000,
    max: 6,
  },

  // Effects
  effects: {
    shakeBrickIntensity: 0.0025,
    shakeBrickDurationMs: 80,
    shakeLifeIntensity: 0.012,
    shakeLifeDurationMs: 320,
    hitstopMs: 18,
  },

  // Audio
  audio: {
    masterDefault: 0.8,
    musicDefault: 0.5,
    sfxDefault: 0.85,
  },
} as const;

export type TuningT = typeof Tuning;
