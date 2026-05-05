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
    speed: 760, // px/sec keyboard
    color: 0x9bf2ff,
    accentColor: 0xffffff,
    /** maximum outgoing angle from vertical, in radians (75 deg) */
    maxBounceAngle: (75 * Math.PI) / 180,
    /**
     * Minimum vertical component as a fraction of speed. Enforced after
     * EVERY reflection (paddle, wall, brick) — not just paddle — so
     * shallow angles can't accumulate from repeated bounces.
     */
    minVerticalFraction: 0.25,
    /**
     * Maximum horizontal component as a fraction of speed. 0.92 caps
     * the angle from vertical at ~67° even mid-flight, preventing the
     * "endless diagonal crawl" near-horizontal stall pattern.
     */
    maxHorizontalFraction: 0.92,
    /** ±deg jitter applied on every paddle bounce */
    bounceJitterDeg: 1.0,
  },

  // Ball — speeds tuned for the portrait canvas (~840 px of travel from
  // top wall to paddle). At 720 base the top-to-bottom traversal takes
  // ~1.2 s, which feels brisk on mobile without being unfair.
  ball: {
    radius: 8,
    baseSpeed: 720,
    minSpeed: 520,
    maxSpeed: 1080,
    /** speed gained per brick destroyed, capped at maxSpeed */
    speedupPerBrick: 2.4,
    color: 0xffffff,
    trailColor: 0x9bf2ff,
    /** capped x|y velocity for tunneling guard substep computation */
    substepMinPixels: 5,
  },

  // Bricks — 13 cols at 36×14 with 2px gaps fits 540 wide cleanly.
  // Field width = 13*36 + 12*2 = 468 + 24 = 492; canvas inside walls = 540 - 28 = 512.
  // Centered offset = WALL + (512 - 492) / 2 = 14 + 10 = 24. Reduced
  // brick height (14 px) + tighter row gap (2 px) make room for 10–14
  // rows per level so the field reads at original-Arkanoid density.
  bricks: {
    cols: 13,
    rowGap: 2,
    colGap: 2,
    width: 36,
    height: 14,
    fieldOffsetX: 24,
    fieldOffsetY: 80,
    flashMs: 70,
    /**
     * Row-cycled rainbow used for standard ("S") bricks when a level has
     * no palette override. Picks colors by row index so a level full of
     * S bricks reads as horizontal color stripes rather than a single
     * cold-blue field. 14 entries — one per row even at max density.
     */
    rainbowRowColors: [
      0xff5d6c, // 0  red
      0xff9f43, // 1  orange
      0xffd23a, // 2  yellow
      0x4af2a1, // 3  mint green
      0x4ad6ff, // 4  sky blue
      0xb96bff, // 5  purple
      0xff6eb4, // 6  pink
      0xff7043, // 7  deep orange
      0xffe066, // 8  gold
      0x69ff94, // 9  lime
      0x40c4ff, // 10 light blue
      0xce93d8, // 11 lavender
      0xf48fb1, // 12 rose
      0xa5d6a7, // 13 pale green
    ],
  },

  // Power-ups
  powerups: {
    speed: 220,
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

  // Anti-stall — keeps endgame fields lively when only a few bricks remain.
  antiStall: {
    /** below this |vy/speed|, count toward "stuck" */
    verticalFractionThreshold: 0.3,
    /** consecutive low-vy frames before nudging (~1.5 s @ 60 fps) */
    stuckFramesTrigger: 90,
    /** degrees the velocity rotates toward vertical when nudged */
    nudgeDeg: 12,
    /** anti-stuck only engages when alive bricks ≤ this */
    activateBelowBrickCount: 6,
    /** ms since last brick break before applying gentle endgame speedup */
    speedAssistAfterMs: 8000,
    /** alive bricks ≤ this triggers speed assist (and ≤ 3 also enables nudges) */
    speedAssistBrickCount: 4,
    /** px/s nudge added each frame while speed assist is active */
    speedAssistPerFrame: 2,
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
