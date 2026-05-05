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
    /**
     * CHARGED mode threshold: consecutive breakable-brick hits during
     * normal-mode play before the ball auto-enters 'charged' (next
     * brick hit deals 3× damage). Resets on life lost / level start /
     * any other power-up mode being active.
     */
    chargedThreshold: 10,
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
     * Row-cycled rainbow used by LevelSystem.defaultRowColor for ALL
     * brick kinds (with offsets + lighten/darken per archetype). 14
     * vivid, high-saturation candy hues — one per possible row at max
     * density. Standard bricks read this slot directly; tough is
     * offset +2 and darkened, hard offset +4 and darker, special
     * offset +3 and lightened. Indestructible ignores the palette and
     * uses a flat steel color.
     */
    rainbowRowColors: [
      0xff2244, // 0  cherry red
      0xff5500, // 1  tangerine orange
      0xffcc00, // 2  lemon yellow
      0x44dd00, // 3  lime green
      0x00ccaa, // 4  mint teal
      0x0099ff, // 5  blueberry blue
      0xaa33ff, // 6  grape purple
      0xff44aa, // 7  bubblegum pink
      0xff7700, // 8  deep orange
      0xffee33, // 9  golden yellow
      0x33ffaa, // 10 seafoam
      0x3399ff, // 11 sky blue
      0xdd55ff, // 12 violet
      0xff3366, // 13 rose red
    ],
  },

  // Power-ups
  powerups: {
    speed: 220,
    width: 38,
    height: 16,
    /** ms duration for timed power-ups (one-shots not listed) */
    durations: {
      expand: 18000,
      shrink: 12000,
      slow: 12000,
      fast: 6000,
      sticky: 18000,
      laser: 14000,
      through: 8000,
      big: 10000,
      magnet: 12000,
      score2x: 15000,
    },
    /** base drop chance (overridden by brick archetype dropChance) */
    baseDrop: 0.16,
    /** never spawn the same kind twice in a row */
    suppressRepeats: true,
  },

  // Power-up effect tuning (the bits that aren't durations).
  powerupEffects: {
    /** SMASH ball speed multiplier so the ball still reaches the top wall in a
     *  reasonable time when no longer reflecting off bricks. */
    throughSpeedMul: 1.05,
    /** HUGE ball visual + body scale. */
    bigScale: 2.0,
    /** TURBO ball speed multiplier on apply (and inverse on expire). */
    fastSpeedMul: 1.65,
    /** Score multiplier while TURBO is active. */
    fastScoreMul: 1.5,
    /** MAGNET per-second velocity nudge magnitude (px/s) toward brick centroid. */
    magnetPullPerSec: 110,
    /** BOMB radius in grid cells (1 = 3×3 area centered on the hit brick). */
    bombGridRadius: 1,
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

  // Anti-stall — the game must NEVER feel slow or tedious. Five layers
  // from "barely noticeable" to "the run is over":
  //   1. continuous speed buildup — starts after 3s, ramps urgency
  //   2. nudge — rotate ball angle toward vertical (more aggressive)
  //   3. double-tap nudge — second nudge if first didn't escape
  //   4. rescue drop — force-spawn a multi-ball power-up
  //   5. danger clock — a 5s countdown after 3s no-break; ball is
  //      auto-killed if it expires (player keeps playing, just lose
  //      a ball — same flow as a regular drop)
  antiStall: {
    /** below this |vy/speed|, count toward "stuck" */
    verticalFractionThreshold: 0.3,
    /** consecutive low-vy frames before nudging (~0.5 s @ 60 fps) */
    stuckFramesTrigger: 30,
    /** degrees the velocity rotates toward vertical when nudged */
    nudgeDeg: 28,
    /** anti-stuck nudge gate: minimum no-break time before engaging */
    nudgeMinNoBreakMs: 1200,
    /**
     * Frames after a nudge during which we re-check the trajectory.
     * If still flat at the end of this window, fire a stronger
     * second nudge (1.5× the regular angle).
     */
    postNudgeWatchFrames: 10,
    /** rescue (force-spawn multi-ball) trigger time */
    rescueDropAfterMs: 3500,
    /** ms since last brick break before continuous speed buildup */
    speedAssistAfterMs: 4000,
    /** alive bricks ≤ this triggers speed assist (mid-game stalls too) */
    speedAssistBrickCount: 12,
    /** px/s ball-speed bump per frame while speed assist is active */
    speedAssistPerFrame: 3.5,
    /**
     * Continuous urgency speed buildup: after this many ms with no
     * brick break, every frame adds (stallSeconds × ramp) px/s of
     * ball speed, capped by ball.maxSpeed.
     */
    urgencyStartMs: 3000,
    urgencyRampPerSec: 1.5,
    urgencyMaxPerFrame: 20,
    /** Show the danger clock once the player has been stuck this long. */
    dangerShowAfterMs: 3000,
    /** Visible countdown duration before auto-killing the ball. */
    dangerDurationMs: 5000,
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
