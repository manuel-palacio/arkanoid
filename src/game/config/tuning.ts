/**
 * Centralized gameplay constants. Adjust here, not inside scenes/entities.
 * Distances are in logical pixels at the fixed playfield resolution defined
 * in `gameConfig.ts`.
 */
export const Tuning = {
  // Playfield
  playfield: {
    width: 960,
    height: 720,
    wallThickness: 24,
    floorY: 720, // y past which a ball is "lost"
    hudHeight: 56,
  },

  // Paddle
  paddle: {
    y: 660,
    baseWidth: 128,
    minWidth: 80,
    maxWidth: 220,
    height: 18,
    speed: 720, // px/sec keyboard
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
    radius: 9,
    baseSpeed: 420,
    minSpeed: 320,
    maxSpeed: 760,
    /** speed gained per brick destroyed, capped at maxSpeed */
    speedupPerBrick: 1.4,
    color: 0xffffff,
    trailColor: 0x9bf2ff,
    /** capped x|y velocity for tunneling guard substep computation */
    substepMinPixels: 6,
  },

  // Bricks
  bricks: {
    cols: 13,
    rowGap: 4,
    colGap: 4,
    width: 64,
    height: 26,
    // Field width = 13*64 + 12*4 = 880; canvas inside walls = 960 - 2*24 = 912.
    // Centered offset from canvas edge = WALL + (912 - 880) / 2 = 24 + 16 = 40.
    fieldOffsetX: 40,
    fieldOffsetY: 100,
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
    speed: 180,
    width: 44,
    height: 18,
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
    speed: 800,
    width: 4,
    height: 14,
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
