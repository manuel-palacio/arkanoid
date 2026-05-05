import Phaser from 'phaser';
import { Events, GAME_HEIGHT, GAME_WIDTH, RegistryKeys, SceneKeys } from '../config/gameConfig';
import { Tuning } from '../config/tuning';
import { Ball, MULTIBALL_TINTS } from '../entities/Ball';
import { Brick } from '../entities/Brick';
import { Enemy } from '../entities/Enemy';
import { Paddle } from '../entities/Paddle';
import { PowerUp } from '../entities/PowerUp';
import { Projectile } from '../entities/Projectile';
import { TOTAL_LEVELS, levelByIndex } from '../levels';
import {
  brickReflect,
  ensureMinVertical,
  paddleHit,
  paddleReflect,
  wallReflect,
} from '../systems/CollisionSystem';
import {
  candyBurst,
  comboFlash,
  drawSideGlow,
  drawStarfield,
  fireworks,
  floatingPoints,
  hitstop,
  paddleFlare,
  shake,
  spark,
  type Starfield,
} from '../systems/EffectsSystem';
import { InputSystem } from '../systems/InputSystem';
import { buildLevel } from '../systems/LevelSystem';
import { createPowerUpSelector, type PowerUpSelector } from '../systems/PowerUpSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { AntiStuckSystem } from '../systems/AntiStuckSystem';
import { getAudio } from '../audio/AudioManager';
import { haptic } from '../utils/haptics';
import { acquireWakeLock, releaseWakeLock } from '../utils/wakeLock';
import { TouchControls } from '../ui/TouchControls';
import type { ActivePowerUp, PowerUpKind } from '../types';
import { POWERUPS } from '../data/powerUps';
import { clearSavedRun, saveRun } from '../data/savedRun';

interface ActiveTimedPU {
  kind: PowerUpKind;
  remaining: number;
  totalMs: number;
}

const WALL = Tuning.playfield.wallThickness;
const FIELD_LEFT = WALL;
const FIELD_RIGHT = GAME_WIDTH - WALL;
const FIELD_TOP = WALL + Tuning.playfield.hudHeight;

export class GameScene extends Phaser.Scene {
  private input$: InputSystem | null = null;
  private paddle!: Paddle;
  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private bricksRemaining = 0;
  private powerups: PowerUp[] = [];
  private projectiles: Projectile[] = [];
  /** Spawner-released enemies, capped at Tuning.enemies.maxActive. */
  private enemies: Enemy[] = [];
  private active: ActiveTimedPU[] = [];
  private score!: ScoreSystem;
  private levelIndex = 0;
  private starfield?: Starfield;
  private lastFireAt = 0;
  private gameOver = false;
  private levelTransitioning = false;
  private puSelector!: PowerUpSelector;
  private debug = false;
  private debugGfx?: Phaser.GameObjects.Graphics;
  private hitstopRemainingMs = 0;
  private serveHint?: Phaser.GameObjects.Text;
  private tensionActive = false;
  private nextHeartbeatAt = 0;
  private tensionVignette?: Phaser.GameObjects.Rectangle;
  private nearMissCount = 0;
  private nearMissResetAt = 0;
  private aimGfx?: Phaser.GameObjects.Graphics;
  private servePulseTween?: Phaser.Tweens.Tween;
  private touchUi?: TouchControls;
  private antiStuck = new AntiStuckSystem();
  private timeSinceLastBrickDestroyed = 0;
  /** Cooldown timer for rescue power-up drops — prevents spawn spam. */
  private timeSinceLastRescue = Number.POSITIVE_INFINITY;
  /** BOMB power-up: next brick hit detonates a 3×3 area. */
  private bombArmed = false;
  /**
   * CHARGED mode counter: consecutive breakable-brick hits during normal
   * play. Hits while a power-up mode is active don't count (those are
   * already a power state). Resets on life lost / level load.
   */
  private consecutiveBrickHits = 0;

  private celebrateNearMiss(x: number): void {
    if (this.time.now > this.nearMissResetAt) {
      this.nearMissCount = 0;
    }
    this.nearMissCount += 1;
    this.nearMissResetAt = this.time.now + 8000;
    if (this.nearMissCount >= 3) {
      // Big celebration — 500 bonus, gold flash, large floater.
      const { points } = this.score.brickBroken(500, this.time.now);
      this.events.emit(Events.ScoreChanged, this.score.score, this.score.highScore, points);
      floatingPoints(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'LEGENDARY SAVE  +500', '#ffd23a', 22);
      // visual flash already used by combo system
      this.cameras.main.flash(180, 255, 220, 60);
      this.nearMissCount = 0;
    } else {
      floatingPoints(this, x, this.paddle.top - 14, 'NICE SAVE', '#4af2a1', 14);
      this.cameras.main.shake(80, 0.004);
    }
  }

  constructor() {
    super(SceneKeys.Game);
  }

  create(): void {
    this.gameOver = false;
    this.levelTransitioning = false;
    this.cameras.main.setBackgroundColor('#05060d');
    this.starfield = drawStarfield(this);

    // World boundaries (visual frame) + side wall glow.
    this.drawFrame();
    drawSideGlow(this, Tuning.playfield.wallThickness, Tuning.playfield.hudHeight);

    // Score / lives state.
    const startLives = (this.registry.get(RegistryKeys.Lives) as number) ?? Tuning.lives.initial;
    const hi = (this.registry.get(RegistryKeys.HighScore) as number) ?? 0;
    this.score = new ScoreSystem(startLives, hi);
    const persistedScore = this.registry.get(RegistryKeys.Score);
    if (typeof persistedScore === 'number' && persistedScore > 0) {
      this.score.restoreScore(persistedScore);
    }

    this.levelIndex = (this.registry.get(RegistryKeys.LevelIndex) as number) ?? 0;
    this.puSelector = createPowerUpSelector(Date.now() & 0xffffffff);

    // Entities.
    this.paddle = new Paddle(this, GAME_WIDTH / 2, Tuning.paddle.y);
    this.spawnBallOnPaddle();

    // Input.
    this.input$ = new InputSystem(this);
    this.input$.on('launch', () => this.tryLaunch());
    this.input$.on('fire', () => this.tryFire());
    this.input$.on('pause', () => this.tryPause());
    this.input$.on('mute', () => {
      const m = !this.registry.get(RegistryKeys.Muted);
      this.registry.set(RegistryKeys.Muted, m);
      getAudio().setMuted(m);
    });
    this.events.on('ui-pause-request', () => this.tryPause());
    this.events.on(Events.GameResumed, () => {
      void acquireWakeLock();
    });

    // Capture the paddle's current X whenever the player puts a finger
    // down — relative-drag mode uses that as the anchor and applies the
    // finger delta on top of it. Without this hook the very first
    // touchmove would teleport the paddle because the input system
    // wouldn't know where it was supposed to start from.
    this.input.on('pointerdown', () => {
      this.input$?.beginDrag(this.paddle.x);
    });

    // DOM-based touch overlay (launch hint pill, mute, pause).
    this.touchUi = new TouchControls({
      onLaunch: () => this.tryLaunch(),
      onPause: () => this.tryPause(),
      onMute: () => {
        const m = !this.registry.get(RegistryKeys.Muted);
        this.registry.set(RegistryKeys.Muted, m);
        getAudio().setMuted(m);
        this.touchUi?.setMuted(m);
      },
    });
    this.touchUi.mount();
    this.touchUi.setMuted(!!this.registry.get(RegistryKeys.Muted));

    // UI scene + initial events.
    if (!this.scene.isActive(SceneKeys.UI)) {
      this.scene.launch(SceneKeys.UI);
    }
    this.events.emit(Events.ScoreChanged, this.score.score, this.score.highScore);
    this.events.emit(Events.LivesChanged, this.score.livesLeft);

    // Load level.
    this.loadLevel(this.levelIndex);

    // Music. iOS Safari requires the AudioContext to be unlocked by a
    // user gesture in this scene's lifetime — the menu's earlier unlock
    // doesn't carry over reliably. Defer until the first pointer event.
    const audio = getAudio();
    this.input.once('pointerdown', () => {
      audio.unlock();
      audio.fadeInMusic('game', 800);
    });
    // Also try immediately in case the gesture already happened.
    audio.unlock();
    audio.fadeInMusic('game', 800);

    // Debug overlay.
    this.debug = !!this.registry.get(RegistryKeys.Debug);
    if (this.debug) {
      this.debugGfx = this.add.graphics({ x: 0, y: 0 }).setDepth(1000);
    }

    // Keep the screen awake while the player is in a run. Released on
    // scene shutdown / pause.
    void acquireWakeLock();

    // Auto-pause when the tab is hidden / app backgrounded. Mobile users
    // expect the game to wait for them rather than keep the ball alive
    // and lose lives while they answered a notification.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !this.gameOver && !this.scene.isPaused()) {
        this.tryPause();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    // Also pause on pageshow restore + window blur (covers iOS PWA quirks
    // where visibilitychange fires inconsistently when switching apps).
    const onBlur = () => {
      if (!this.gameOver && !this.scene.isPaused()) {
        this.tryPause();
      }
    };
    window.addEventListener('blur', onBlur);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.starfield?.destroy();
      this.balls.forEach((b) => b.destroy());
      this.bricks.forEach((b) => b.destroy());
      this.powerups.forEach((p) => p.destroy());
      this.projectiles.forEach((p) => p.destroy());
      this.enemies.forEach((e) => e.destroy());
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      this.touchUi?.unmount();
      this.touchUi = undefined;
      void releaseWakeLock();
    });
  }

  override update(time: number, delta: number): void {
    if (this.gameOver || this.levelTransitioning) {
      this.starfield?.update(delta);
      return;
    }
    this.starfield?.update(delta);
    if (this.hitstopRemainingMs > 0) {
      // Hitstop: render but skip ball / power-up / projectile movement so
      // the freeze-frame impact lands. Paddle still moves so input feels
      // responsive coming out of the freeze.
      this.hitstopRemainingMs -= delta;
      this.handlePaddleInput(delta);
      if (this.debug) this.drawDebug();
      return;
    }
    this.handlePaddleInput(delta);
    this.paddle.update();
    this.tickBalls(time, delta);
    this.tickBricks(delta);
    this.tickEnemies(time, delta);
    this.tickPowerups();
    this.tickProjectiles(time);
    this.tickActivePowerUps(delta);
    this.tickTension(time);
    this.drawAimLine();
    if (this.debug) this.drawDebug();
  }

  /**
   * Update each enemy + check ball / projectile / floor collisions.
   * Enemies are awarded `Tuning.enemies.score` when killed by a ball or
   * laser. Falling off the floor is silent — no penalty, no points.
   */
  private tickEnemies(timeMs: number, deltaMs: number): void {
    if (this.enemies.length === 0) return;
    const dead: Enemy[] = [];
    for (const e of this.enemies) {
      if (!e.alive) {
        dead.push(e);
        continue;
      }
      e.update(deltaMs, timeMs);
      // Off-floor — silent removal.
      if (e.screenY > GAME_HEIGHT + 30) {
        e.destroy();
        dead.push(e);
        continue;
      }
      // Ball hit: any ball within (enemy.radius + ball.radius) kills it.
      let killed = false;
      for (const b of this.balls) {
        if (b.isAttached) continue;
        const dx = b.x - e.x;
        const dy = b.y - e.screenY;
        const r = e.radius + b.radius;
        if (dx * dx + dy * dy <= r * r) {
          this.killEnemy(e);
          dead.push(e);
          killed = true;
          break;
        }
      }
      if (killed) continue;
      // Laser hit.
      for (const p of this.projectiles) {
        if (!p.alive) continue;
        const dx = p.x - e.x;
        const dy = p.y - e.screenY;
        if (Math.abs(dx) <= e.radius && Math.abs(dy) <= e.radius + 6) {
          this.killEnemy(e);
          dead.push(e);
          p.destroy();
          break;
        }
      }
    }
    if (dead.length) this.enemies = this.enemies.filter((e) => !dead.includes(e));
  }

  private killEnemy(enemy: Enemy): void {
    candyBurst(this, enemy.x, enemy.screenY, 0xff66ff);
    getAudio().playSfx('brickBreak', 0.6);
    const cfg = Tuning.enemies;
    const { points } = this.score.brickBroken(cfg.score, this.time.now, this.computeScoreMul());
    this.events.emit(Events.ScoreChanged, this.score.score, this.score.highScore, points);
    floatingPoints(this, enemy.x, enemy.screenY - 10, `+${points}`, '#ff66ff', 16);
    enemy.destroy();
  }

  /** Spawn an enemy from a spawner brick, capped at Tuning.enemies.maxActive. */
  private spawnEnemyFrom(brick: Brick): void {
    if (this.enemies.length >= Tuning.enemies.maxActive) return;
    const enemy = new Enemy(this, brick.x, brick.y + Tuning.bricks.height / 2 + 6);
    this.enemies.push(enemy);
  }

  /**
   * Per-frame brick update — drives REGEN healing and INVISIBLE
   * proximity reveal. The kind switch inside Brick.update() makes
   * this a no-op for everything else, so iterating every brick each
   * frame is cheap.
   */
  private tickBricks(deltaMs: number): void {
    const needsBallDist = this.bricks.some(
      (b) => b.alive && b.archetype.kind === 'invisible',
    );
    for (const b of this.bricks) {
      if (!b.alive) continue;
      if (b.archetype.kind === 'invisible' && needsBallDist) {
        let minDist = Number.POSITIVE_INFINITY;
        for (const ball of this.balls) {
          const dx = ball.x - b.x;
          const dy = ball.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < minDist) minDist = d;
        }
        b.update(deltaMs, minDist);
      } else {
        b.update(deltaMs);
      }
    }
  }

  /** Used by EffectsSystem.hitstop() to freeze ball motion briefly. */
  beginHitstop(ms: number): void {
    this.hitstopRemainingMs = Math.max(this.hitstopRemainingMs, ms);
  }

  // ---------- Level lifecycle ----------

  private loadLevel(idx: number): void {
    const def = levelByIndex(idx);
    if (!def) {
      this.triggerVictory();
      return;
    }
    this.bricks.forEach((b) => b.destroy());
    this.powerups.forEach((p) => p.destroy());
    this.projectiles.forEach((p) => p.destroy());
    this.enemies.forEach((e) => e.destroy());
    this.bricks = [];
    this.powerups = [];
    this.projectiles = [];
    this.enemies = [];
    this.active = [];
    this.tensionActive = false;
    this.tensionVignette?.destroy();
    this.tensionVignette = undefined;
    this.paddle.resetWidth();
    this.paddle.setMode('normal');
    this.paddle.setSticky(false);
    this.paddle.setGhostShield(false);

    const built = buildLevel(this, def);
    this.bricks = built.bricks;
    this.bricksRemaining = built.breakableCount;
    this.antiStuck.reset();
    this.timeSinceLastBrickDestroyed = 0;
    this.timeSinceLastRescue = Number.POSITIVE_INFINITY;
    this.bombArmed = false;
    this.consecutiveBrickHits = 0;
    // Reset music to baseline tempo for the new field.
    getAudio().setMusicIntensity('normal');

    this.events.emit(Events.LevelChanged, def);
    this.showLevelIntro(def.name, def.id);
    this.spawnBallOnPaddle(def.ballSpeedMul ?? 1);
  }

  private showLevelIntro(name: string, id: number): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Dim the playfield briefly so the splash reads.
    const dim = this.add
      .rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0)
      .setDepth(890);
    this.tweens.add({ targets: dim, fillAlpha: 0.45, duration: 200, yoyo: true, hold: 600 });

    // Number slams in from above, kerns out, then drops to settle.
    const num = this.add
      .text(cx, cy - 80, `LEVEL ${id}`, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '64px',
        color: '#9bf2ff',
        fontStyle: '900',
      })
      .setOrigin(0.5)
      .setDepth(900)
      .setShadow(0, 0, '#4ad6ff', 22, true, true)
      .setScale(2.4)
      .setAlpha(0);

    const sub = this.add
      .text(cx, cy + 0, name, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setDepth(900)
      .setAlpha(0);

    // Line accents that slide in from offscreen.
    const lineL = this.add.rectangle(0, cy + 38, 0, 2, 0x9bf2ff, 1).setOrigin(1, 0.5).setDepth(900);
    const lineR = this.add.rectangle(GAME_WIDTH, cy + 38, 0, 2, 0x9bf2ff, 1).setOrigin(0, 0.5).setDepth(900);

    this.tweens.add({
      targets: num,
      scale: 1,
      alpha: 1,
      duration: 280,
      ease: 'Cubic.easeOut',
    });
    this.tweens.add({
      targets: sub,
      alpha: 1,
      duration: 280,
      delay: 180,
    });
    this.tweens.add({
      targets: lineL,
      width: 240,
      duration: 380,
      delay: 120,
      ease: 'Cubic.easeOut',
    });
    this.tweens.add({
      targets: lineR,
      width: 240,
      duration: 380,
      delay: 120,
      ease: 'Cubic.easeOut',
    });
    getAudio().playSfx('uiSelect', 0.7);

    // Outro: everything slides up + fades.
    this.time.delayedCall(900, () => {
      this.tweens.add({
        targets: [num, sub, lineL, lineR],
        alpha: 0,
        y: '-=24',
        duration: 320,
        onComplete: () => {
          num.destroy();
          sub.destroy();
          lineL.destroy();
          lineR.destroy();
          dim.destroy();
        },
      });
    });
  }

  // ---------- Input handling ----------

  private handlePaddleInput(deltaMs: number): void {
    if (!this.input$) return;
    const axis = this.input$.axisX();
    if (axis !== 0) {
      this.paddle.moveBy(axis * Tuning.paddle.speed * (deltaMs / 1000), FIELD_LEFT, FIELD_RIGHT);
    } else {
      const target = this.input$.paddleTargetX();
      if (target != null) {
        // Relative drag (touch default): target = paddleX_at_drag_start
        // + (current finger x - drag origin x). Absolute (mouse): target
        // = pointer x. Paddle.setX clamps to field bounds.
        this.paddle.setX(target, FIELD_LEFT, FIELD_RIGHT);
        // If the paddle was clamped to a wall, re-anchor the drag
        // origin so the next finger movement responds immediately.
        // Without this, dragging the paddle past a wall and pulling
        // back feels "stuck" — the paddle won't budge until the
        // finger has retraced the over-shoot distance exactly.
        if (Math.abs(this.paddle.x - target) > 0.5) {
          this.input$.rebaseDrag(this.paddle.x);
        }
      }
    }

    // Carry attached balls with paddle.
    for (const b of this.balls) {
      if (b.isAttached) {
        b.setPosition(this.paddle.x + b.attachOffset, this.paddle.y - this.paddle.height / 2 - b.radius - 1);
      }
    }
  }

  private tryLaunch(): void {
    let launched = false;
    for (const b of this.balls) {
      if (b.isAttached) {
        const speed = Tuning.ball.baseSpeed * (levelByIndex(this.levelIndex)?.ballSpeedMul ?? 1);
        b.detach(-speed);
        launched = true;
      }
    }
    if (launched) {
      // Belt-and-suspenders audio unlock — the very first serve must
      // produce sound on iOS even if the earlier unlock didn't take.
      getAudio().unlock();
      getAudio().playSfx('paddle');
      this.input$?.setBallHeld(false);
      this.hideServeHint();
      this.stopServePulse();
      this.antiStuck.reset();
    }
  }

  private tryFire(): void {
    if (!this.paddle.isLaser()) return;
    const now = this.time.now;
    if (now - this.lastFireAt < Tuning.laser.cooldownMs) return;
    this.lastFireAt = now;
    const y = this.paddle.top - 6;
    const offsets = [-this.paddle.width / 2 + 8, this.paddle.width / 2 - 8];
    offsets.forEach((ox) => {
      const p = new Projectile(this, this.paddle.x + ox, y);
      this.projectiles.push(p);
    });
    getAudio().playSfx('laser', 0.6);
  }

  private tryPause(): void {
    if (this.gameOver) return;
    if (this.scene.isPaused()) return;
    this.scene.launch(SceneKeys.Pause);
    this.scene.pause();
    this.events.emit(Events.GamePaused);
    void releaseWakeLock();
  }

  // ---------- Per-frame ticks ----------

  private tickBalls(timeMs: number, deltaMs: number): void {
    if (this.balls.length === 0) return;
    const dt = deltaMs / 1000;
    this.timeSinceLastBrickDestroyed += deltaMs;
    this.timeSinceLastRescue += deltaMs;
    this.maybeRescueDrop();
    this.tickDangerClock(timeMs);

    for (const ball of this.balls) {
      if (ball.isAttached) {
        ball.updateTrail(timeMs);
        continue;
      }

      // Substep movement to mitigate tunneling on small bricks at high speeds.
      const fullDx = ball.vx * dt;
      const fullDy = ball.vy * dt;
      const stepSize = Math.max(2, Tuning.ball.substepMinPixels);
      const dist = Math.hypot(fullDx, fullDy);
      const steps = Math.max(1, Math.ceil(dist / stepSize));
      const sx = fullDx / steps;
      const sy = fullDy / steps;

      for (let s = 0; s < steps; s++) {
        // Track per-substep prev so swept tests (brickReflect) and the
        // descent gate in paddleHit work correctly mid-frame.
        ball.rememberPrev();
        ball.setPosition(ball.x + sx, ball.y + sy);
        if (this.collideAtCurrent(ball)) {
          // Velocity has been corrected by collideAtCurrent. We deliberately
          // do NOT advance the ball further this frame — the catch-up motion
          // could push it past whatever it just bounced off, re-introducing
          // the tunneling we're trying to prevent (issue #1).
          break;
        }
      }

      // Walls.
      const wr = wallReflect(
        ball.x,
        ball.y,
        ball.vx,
        ball.vy,
        ball.radius,
        FIELD_LEFT,
        FIELD_RIGHT,
        FIELD_TOP,
      );
      if (wr.hit) {
        ball.setPosition(wr.x, wr.y);
        const cleaned = ensureMinVertical(wr.vx, wr.vy, ball.speed || Math.hypot(wr.vx, wr.vy));
        ball.setVelocity(cleaned.vx, cleaned.vy);
        ball.onWallBounce(this);
        getAudio().playSfx('wall', 0.5);
      }

      // Floor — life lost (or saved by GHOST shield).
      if (ball.y - ball.radius > Tuning.playfield.floorY) {
        if (this.paddle.hasGhostShield()) {
          this.paddle.consumeGhostShield();
          ball.setVelocity(ball.vx, -Math.abs(ball.vy || Tuning.ball.baseSpeed));
          ball.setPosition(ball.x, this.paddle.top - ball.radius - 1);
          floatingPoints(this, ball.x, ball.y - 30, 'GHOST SAVE', '#99ffee', 18);
          getAudio().playSfx('paddle', 0.9);
          this.events.emit(Events.PowerUpExpired, 'ghost');
        } else {
          this.onBallLost(ball);
        }
      }

      // MAGNET pull (per-ball, per-frame). Tugs velocity toward the
      // centroid of remaining breakable bricks while preserving speed.
      if (ball.inMagnetMode) this.applyMagnetPull(ball, dt);

      // Stuck-in-brick safety net (issue #36). Should never fire in
      // normal play with the swept-segment brickReflect; this is the
      // nuclear escape hatch in case anything pathological slips through.
      this.tickStuckInBrick(ball);

      // Stall guard. Engages whenever the player has stopped breaking
      // bricks for a few seconds AND the ball settles into a near-
      // horizontal pattern — regardless of brick count.
      if (this.antiStuck.update(ball, this.timeSinceLastBrickDestroyed)) {
        ball.onWallBounce(this);
        getAudio().playSfx('wall', 0.4);
      }
      this.applyUrgencyBuildup(ball, dt);

      ball.updateTrail(timeMs);
    }

    // Remove balls flagged for destruction.
    this.balls = this.balls.filter((b) => b.sprite.active);

    // No balls left? Drain a life and respawn.
    if (this.balls.length === 0 && !this.gameOver && !this.levelTransitioning) {
      this.handleAllBallsLost();
    }
  }

  /** Returns true if a brick or paddle was hit (velocity updated). */
  private collideAtCurrent(ball: Ball): boolean {
    // Paddle first (only when descending).
    if (ball.vy > 0) {
      const p = paddleHit(
        ball.x,
        ball.y,
        ball.prevY,
        ball.radius,
        this.paddle.left,
        this.paddle.right,
        this.paddle.top,
        this.paddle.bottom,
      );
      if (p !== null) {
        if (this.paddle.isSticky()) {
          ball.attachTo(this.paddle.x, this.paddle.y - this.paddle.height / 2 - ball.radius - 1, ball.x - this.paddle.x);
          getAudio().playSfx('paddle', 0.7);
          return true;
        }
        const jitter = (Math.random() * 2 - 1) * Tuning.paddle.bounceJitterDeg;
        const dir = paddleReflect(p, jitter);
        const speed = Math.max(Tuning.ball.minSpeed, ball.speed);
        let vx = dir.x * speed;
        let vy = dir.y * speed;
        ({ vx, vy } = ensureMinVertical(vx, vy, speed));
        ball.setVelocity(vx, vy);
        ball.setPosition(ball.x, this.paddle.top - ball.radius - 0.5);
        paddleFlare(this, ball.x, this.paddle.top, ball.tint);
        this.paddle.squish();
        ball.onPaddleBounce(this);
        getAudio().playSfx('paddle');
        haptic.tick();
        // Near-miss detection: hit landed in the outer 18% of the paddle.
        if (Math.abs(p) > 0.82) this.celebrateNearMiss(ball.x);
        return true;
      }
    }

    // Bricks — first hit only per substep.
    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      if (
        ball.x + ball.radius < brick.left ||
        ball.x - ball.radius > brick.right ||
        ball.y + ball.radius < brick.top ||
        ball.y - ball.radius > brick.bottom
      ) {
        continue;
      }
      // SMASH (through-mode): pass through breakable bricks without
      // reflecting. Indestructibles still bounce so the ball can never
      // exit the playfield.
      if (ball.mode === 'through' && brick.isBreakable()) {
        this.onBrickHit(brick, ball);
        return true;
      }
      // GHOST: pass through indestructible bricks (the rest still
      // collide normally).
      if (ball.mode === 'ghost' && !brick.isBreakable()) {
        return false;
      }
      // BUMPER bricks: pinball-style radial impulse outward from the
      // brick center instead of an axis-aligned reflection. Prevents
      // the "crawl along the side" loop on shallow grazing hits
      // because the outgoing direction is always away from the brick
      // center, never tangent to its face. Also feels more pinball.
      if (brick.archetype.kind === 'bumper') {
        const speed = ball.speed || Tuning.ball.baseSpeed;
        const cdx = ball.x - brick.x;
        const cdy = ball.y - brick.y;
        const dist = Math.hypot(cdx, cdy) || 1;
        const boosted = Math.min(speed * 1.3, Tuning.ball.maxSpeed);
        const radial = ensureMinVertical(
          (cdx / dist) * boosted,
          (cdy / dist) * boosted,
          boosted,
        );
        ball.setVelocity(radial.vx, radial.vy);
        // Push ball clear of the brick along the outward direction.
        ball.setPosition(
          ball.x + (cdx / dist) * ball.radius * 2,
          ball.y + (cdy / dist) * ball.radius * 2,
        );
        candyBurst(this, brick.x, brick.y, 0xffdd00);
        const { points } = this.score.brickBroken(
          brick.archetype.score,
          this.time.now,
          this.computeScoreMul(),
        );
        this.events.emit(Events.ScoreChanged, this.score.score, this.score.highScore, points);
        floatingPoints(this, brick.x, brick.y - 6, `+${points}`, '#ffdd00', 14);
        this.onBrickHit(brick, ball);
        return true;
      }

      // Reflect. brickReflect uses a slab-method swept test against the
      // brick AABB (expanded by ball radius) — entry axis is the LATER
      // of the two near times so grazing hits resolve correctly. Returns
      // the depenetration push so the ball ends fully outside, no
      // re-overlap next frame.
      const oldVx = ball.vx;
      const oldVy = ball.vy;
      const speed = ball.speed;
      const r = brickReflect(
        ball.prevX,
        ball.prevY,
        ball.x,
        ball.y,
        oldVx,
        oldVy,
        brick.left,
        brick.top,
        brick.right,
        brick.bottom,
        ball.radius,
      );
      if (r.pushX !== 0 || r.pushY !== 0) {
        ball.setPosition(ball.x + r.pushX, ball.y + r.pushY);
      }
      // Post-process to keep the ball off the horizontal-stall trajectory.
      const cleaned = ensureMinVertical(r.vx, r.vy, speed);
      // DEFLECTOR: force the outgoing direction to a 45° angle while
      // preserving the post-bounce quadrant. Run BEFORE setVelocity so
      // the ball gets the puzzle-grade redirect, not the natural bounce.
      let outVx = cleaned.vx;
      let outVy = cleaned.vy;
      if (brick.archetype.kind === 'deflector') {
        const dSpeed = Math.hypot(outVx, outVy);
        const sx = outVx >= 0 ? 1 : -1;
        const sy = outVy >= 0 ? 1 : -1;
        outVx = sx * dSpeed * Math.SQRT1_2;
        outVy = sy * dSpeed * Math.SQRT1_2;
      }
      ball.setVelocity(outVx, outVy);
      this.onBrickHit(brick, ball);
      return true;
    }

    return false;
  }

  private onBrickHit(brick: Brick, ball: Ball): void {
    // BOMB: arm consumed on first contact with a breakable brick.
    if (this.bombArmed && brick.isBreakable()) {
      this.bombArmed = false;
      this.detonateBomb(brick, ball);
      return;
    }
    // SPAWNER: first hit releases an enemy (capped). The brick still
    // takes the hit normally — second hit destroys it (and the enemy
    // is removed once the brick dies, see handleBrickDestroyed).
    if (
      brick.archetype.kind === 'spawner' &&
      !brick.hasReleasedSpawn &&
      brick.hp === brick.archetype.hits
    ) {
      brick.hasReleasedSpawn = true;
      this.spawnEnemyFrom(brick);
    }
    // CHARGED: deal 3 hits in a single contact, then revert to normal.
    // One-shots single-hit bricks; takes Tough/Hard down in one swing.
    // BUT: don't consume the charge on a warded brick — the warden's
    // shield blocks all damage, so the charge would be wasted on a
    // no-op. Treat warded contacts as a regular shielded hit and keep
    // the charge for the next strike that can actually land. Without
    // this guard, the ball can loop in place against a warded brick
    // (issue #38) until something else breaks the cycle.
    if (ball.mode === 'charged' && brick.isBreakable()) {
      if (brick.wardedBy?.alive) {
        brick.hit(this); // shieldPing fires inside; no damage dealt
        getAudio().playSfx('brickHit', 0.5);
        return; // mode NOT consumed — charge preserved for the warden
      }
      ball.clearMode();
      let destroyed = false;
      for (let i = 0; i < 3 && !destroyed; i++) {
        const r = brick.hit(this);
        if (r.destroyed) destroyed = true;
      }
      if (destroyed) {
        this.handleBrickDestroyed(brick, ball);
      } else {
        // Brick survived the 3-hit charge burst — apply hitstop so
        // the ball has a frame to physically clear the brick AABB
        // before the next collision pass fires again.
        getAudio().playSfx('brickHit', 0.7);
        hitstop(this);
      }
      return;
    }
    const result = brick.hit(this);
    if (result.destroyed) {
      this.handleBrickDestroyed(brick, ball);
    } else {
      getAudio().playSfx('brickHit', 0.5);
    }
    // CHARGED rally counter: only count hits during plain 'normal' mode
    // AND on bricks that actually took damage — warded contacts don't
    // count as progress, so they shouldn't tick the combo toward the
    // CHARGED reward.
    if (
      ball.mode === 'normal' &&
      brick.isBreakable() &&
      !brick.wardedBy?.alive
    ) {
      this.consecutiveBrickHits += 1;
      if (this.consecutiveBrickHits >= Tuning.ball.chargedThreshold) {
        this.consecutiveBrickHits = 0;
        this.activateCharged();
      }
    }
  }

  /**
   * Skill reward: 10 consecutive brick hits during normal play promote
   * every "normal" ball to CHARGED mode. We don't clobber balls that
   * are mid-power (through/big/ghost) so the player doesn't lose an
   * active boost to the charged consumption.
   */
  private activateCharged(): void {
    // Belt-and-suspenders: the caller already zeroes the counter, but
    // resetting here too closes the door on any double-trigger path
    // that lands on activateCharged from a different code site.
    this.consecutiveBrickHits = 0;
    let promoted = 0;
    for (const b of this.balls) {
      if (b.mode === 'normal') {
        b.setMode('charged', this);
        promoted += 1;
      }
    }
    if (promoted === 0) return;
    floatingPoints(this, GAME_WIDTH / 2, 220, 'CHARGED!', '#ffffff', 24);
    comboFlash(this, 0xffffff, 0.32);
    getAudio().playSfx('powerupGet', 0.8);
    haptic.bump();
  }

  /**
   * Hit every alive brick within 1 grid cell of (cx, cy). Used by both
   * the BOMB power-up (with the source brick included via detonateBomb)
   * and BOMB-bricks chaining on destruction (source already breaking,
   * exclude).
   */
  private bombChainNeighbors(cx: number, cy: number, ball: Ball): void {
    const cellW = Tuning.bricks.width + Tuning.bricks.colGap;
    const cellH = Tuning.bricks.height + Tuning.bricks.rowGap;
    const radius = Tuning.powerupEffects.bombGridRadius;
    candyBurst(this, cx, cy, 0xff5500);
    shake(this, 180, 0.012);
    comboFlash(this, 0xff5500, 0.25);
    haptic.bump();
    for (const b of this.bricks) {
      if (!b.alive) continue;
      const dx = Math.abs(b.x - cx) / cellW;
      const dy = Math.abs(b.y - cy) / cellH;
      if (dx <= radius + 0.4 && dy <= radius + 0.4) {
        const r = b.hit(this);
        if (r.destroyed) this.handleBrickDestroyed(b, ball);
      }
    }
  }

  /**
   * BOMB power-up detonation: chain neighbours then break the source
   * brick. Source is hit last so the chain reads as an outward wave
   * from the impact point.
   */
  private detonateBomb(source: Brick, ball: Ball): void {
    this.bombChainNeighbors(source.x, source.y, ball);
    getAudio().playSfx('brickBreak');
    const r = source.hit(this);
    if (r.destroyed) this.handleBrickDestroyed(source, ball);
  }

  private handleBrickDestroyed(brick: Brick, _ball: Ball): void {
    getAudio().playSfx('brickBreak');
    haptic.bump();
    candyBurst(this, brick.x, brick.y, brick.color);
    shake(this, Tuning.effects.shakeBrickDurationMs, Tuning.effects.shakeBrickIntensity);
    hitstop(this);
    const { points, chain } = this.score.brickBroken(
      brick.archetype.score,
      this.time.now,
      this.computeScoreMul(),
    );
    floatingPoints(
      this,
      brick.x,
      brick.y - 6,
      `+${points}`,
      hexToCss(brick.color),
      chain >= 3 ? 18 : 14,
      points,
    );
    this.events.emit(Events.ScoreChanged, this.score.score, this.score.highScore, points);
    if (chain >= 3) this.events.emit(Events.Combo, chain);

    // Award life threshold. A single brick break can push score across
    // multiple thresholds — emit one HUD update + 1UP cue per granted life
    // so the player feels each one (issue #10).
    const li = this.score.awardLifeIfDue();
    for (let i = 0; i < li.granted; i++) {
      this.time.delayedCall(i * 280, () => {
        this.events.emit(Events.LivesChanged, this.score.livesLeft);
        this.events.emit(Events.PowerUpActivated, [{ kind: 'life', remaining: 0 }]);
        getAudio().playSfx('powerupGet', 0.85);
      });
    }

    // Drop chance + CURSED brick override.
    const dropChance = brick.archetype.dropChance;
    if (this.puSelector.shouldDrop(dropChance)) {
      const def = levelByIndex(this.levelIndex);
      const allowed = def?.allowedPowerUps;
      let kind: PowerUpKind;
      if (brick.archetype.kind === 'cursed') {
        // CURSED looks like Special but always drops a "negative" kind.
        const cursed: PowerUpKind[] = ['shrink', 'fast'];
        kind = cursed[Math.floor(Math.random() * cursed.length)] ?? 'shrink';
      } else {
        kind = this.puSelector.pickNext(allowed);
      }
      const pu = new PowerUp(this, brick.x, brick.y, kind);
      this.powerups.push(pu);
      getAudio().playSfx('powerupDrop', 0.5);
    }

    // BOMB brick: chain-reaction on destruction. The source brick is
    // already breaking via the regular hit; bombChainNeighbors hits
    // every alive brick in the surrounding 3×3 cell. Cascading bombs
    // are guarded by Brick.hit's `if (!alive)` early-return.
    if (brick.archetype.kind === 'bomb') {
      this.bombChainNeighbors(brick.x, brick.y, _ball);
    }

    // Speed up ball slightly with each break.
    for (const b of this.balls) {
      b.bumpSpeed(Tuning.ball.speedupPerBrick);
    }

    if (brick.isBreakable()) {
      this.bricksRemaining = Math.max(0, this.bricksRemaining - 1);
      this.timeSinceLastBrickDestroyed = 0;
      this.antiStuck.resetDangerClock();
      this.events.emit(Events.DangerLevel, 0);
      this.updateTensionMode();
      this.updateMusicIntensity();
      if (this.bricksRemaining === 0) this.completeLevel();
    }

    // SPAWNER: when the brick dies, its released enemy goes with it.
    // Find the first alive enemy attached to this brick (we don't
    // track ownership tightly — just reap one at random; player gets
    // points for it via the regular kill path).
    if (brick.archetype.kind === 'spawner' && brick.hasReleasedSpawn) {
      const victim = this.enemies.find((e) => e.alive);
      if (victim) {
        this.killEnemy(victim);
        this.enemies = this.enemies.filter((e) => e !== victim);
      }
    }
  }

  /**
   * Drive the visible danger clock. If it elapses, the active ball is
   * killed (same flow as falling off the floor). The countdown resets
   * the moment any brick breaks — see handleBrickDestroyed.
   */
  private tickDangerClock(nowMs: number): void {
    if (this.gameOver || this.levelTransitioning) return;
    if (this.bricksRemaining <= 0) return;
    if (this.balls.length === 0 || this.balls.every((b) => b.isAttached)) {
      this.antiStuck.resetDangerClock();
      this.events.emit(Events.DangerLevel, 0);
      return;
    }
    const danger = this.antiStuck.getDangerLevel(this.timeSinceLastBrickDestroyed, nowMs);
    if (danger === -1) {
      // Kill the most-recent active ball. The regular life-loss flow
      // takes over from there (respawn or game over).
      const victim = this.balls.find((b) => !b.isAttached);
      if (victim) this.onBallLost(victim);
      this.antiStuck.resetDangerClock();
      this.events.emit(Events.DangerLevel, 0);
      this.timeSinceLastBrickDestroyed = 0; // give the player a fresh start
      return;
    }
    this.events.emit(Events.DangerLevel, danger);
  }

  /**
   * If the player has been stuck (no brick broken for several seconds)
   * with a single ball in play, force-spawn a multi-ball power-up at a
   * random alive brick. The cooldown stops the spawn from spamming —
   * but if the player MISSES the drop, the no-break timer keeps growing
   * and the next cooldown window will fire another rescue. The result:
   * the game never gets to feel slow + tedious.
   */
  private maybeRescueDrop(): void {
    const cfg = Tuning.antiStall;
    if (this.balls.length !== 1) return;
    if (this.bricksRemaining <= 0) return;
    if (this.levelTransitioning || this.gameOver) return;
    if (this.timeSinceLastBrickDestroyed < cfg.rescueDropAfterMs) return;
    // Cooldown so a stalled run doesn't spawn 60 power-ups per second.
    if (this.timeSinceLastRescue < 4500) return;
    // Prefer not to flood the field — skip if there's already a falling
    // power-up the player can grab.
    if (this.powerups.some((p) => p.alive)) return;

    const aliveBricks = this.bricks.filter((b) => b.alive && b.isBreakable());
    if (aliveBricks.length === 0) return;
    const target = aliveBricks[Math.floor(Math.random() * aliveBricks.length)];
    if (!target) return;

    const pu = new PowerUp(this, target.x, target.y, 'multi');
    this.powerups.push(pu);
    this.timeSinceLastRescue = 0;
    getAudio().playSfx('powerupDrop', 0.8);
    floatingPoints(this, target.x, target.y - 20, 'RESCUE  +MULTI', '#ffd600', 16);
  }

  /**
   * Urgency speed buildup. Continuous (per-frame) ramp once the player
   * has been stalled for `urgencyStartMs`. Speed gain per second
   * scales linearly with how long they've been stalled, capped per-
   * frame so a 30 s stall doesn't suddenly ping-pong the ball at max
   * speed. Replaces the previous endgame-only speed assist — stalls
   * with 12 bricks remaining now get the same momentum nudge stalls
   * with 2 bricks did.
   */
  private applyUrgencyBuildup(ball: Ball, dtSec: number): void {
    const cfg = Tuning.antiStall;
    if (this.timeSinceLastBrickDestroyed < cfg.urgencyStartMs) return;
    if (this.bricksRemaining > cfg.speedAssistBrickCount) return;
    const stallSec = (this.timeSinceLastBrickDestroyed - cfg.urgencyStartMs) / 1000;
    const ramp = Math.min(stallSec * cfg.urgencyRampPerSec, cfg.urgencyMaxPerFrame);
    if (ramp > 0) ball.bumpSpeed(ramp * dtSec * 60);
  }

  /** Pick a music intensity level from current game state. */
  private updateMusicIntensity(): void {
    const audio = getAudio();
    if (this.bricksRemaining <= 2 || this.score.livesLeft === 1) {
      audio.setMusicIntensity('final');
    } else if (this.bricksRemaining <= 5) {
      audio.setMusicIntensity('tense');
    } else {
      audio.setMusicIntensity('normal');
    }
  }

  private updateTensionMode(): void {
    const shouldBeActive = this.bricksRemaining > 0 && this.bricksRemaining <= 3;
    if (shouldBeActive === this.tensionActive) return;
    this.tensionActive = shouldBeActive;
    if (shouldBeActive) {
      // Red vignette overlay.
      this.tensionVignette = this.add
        .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff1844, 0)
        .setDepth(180)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: this.tensionVignette,
        fillAlpha: 0.12,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      });
      this.nextHeartbeatAt = this.time.now;
      this.starfield?.setSpeedMultiplier(2.4);
    } else if (this.tensionVignette) {
      this.starfield?.setSpeedMultiplier(1);
      this.tweens.killTweensOf(this.tensionVignette);
      this.tweens.add({
        targets: this.tensionVignette,
        fillAlpha: 0,
        duration: 320,
        onComplete: () => {
          this.tensionVignette?.destroy();
          this.tensionVignette = undefined;
        },
      });
    }
  }

  private tickTension(timeMs: number): void {
    if (!this.tensionActive) return;
    if (timeMs >= this.nextHeartbeatAt) {
      getAudio().playSfx('heartbeat', 0.9);
      // Heartbeat cadence accelerates as bricks dwindle.
      const interval = this.bricksRemaining <= 1 ? 520 : this.bricksRemaining === 2 ? 660 : 800;
      this.nextHeartbeatAt = timeMs + interval;
    }
  }

  private onBallLost(ball: Ball): void {
    ball.destroy();
  }

  private handleAllBallsLost(): void {
    const r = this.score.loseLife();
    this.events.emit(Events.LivesChanged, r.livesLeft);
    getAudio().playSfx('lifeLost');
    haptic.thump();
    shake(this, Tuning.effects.shakeLifeDurationMs, Tuning.effects.shakeLifeIntensity);
    this.updateMusicIntensity();
    if (r.livesLeft <= 0) {
      this.triggerGameOver();
      return;
    }
    // Persist the post-life-loss state so a tab close mid-level still
    // resumes the run with the reduced life count (not full lives).
    saveRun({
      levelIndex: this.levelIndex,
      score: this.score.score,
      lives: r.livesLeft,
    });
    // Reset paddle/state.
    this.paddle.resetWidth();
    this.paddle.setMode('normal');
    this.paddle.setSticky(false);
    this.paddle.setGhostShield(false);
    this.bombArmed = false;
    this.consecutiveBrickHits = 0;
    this.active = [];
    this.events.emit(Events.PowerUpExpired, null);
    this.spawnBallOnPaddle();
  }

  private completeLevel(): void {
    if (this.levelTransitioning) return;
    this.levelTransitioning = true;
    const r = this.score.levelCleared(this.score.livesLeft);
    this.events.emit(Events.ScoreChanged, this.score.score, this.score.highScore, r.bonus);
    this.events.emit(Events.LevelComplete, this.levelIndex);
    getAudio().playSfx('levelComplete');

    // Fireworks across the upper playfield.
    fireworks(this, 1400, 10);

    // Banner.
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const t1 = this.add
      .text(cx, cy - 20, 'LEVEL CLEAR', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '52px',
        color: '#ffd23a',
        fontStyle: '900',
      })
      .setOrigin(0.5)
      .setDepth(950)
      .setShadow(0, 0, '#ffd23a', 22, true, true)
      .setScale(0.4)
      .setAlpha(0);
    const t2 = this.add
      .text(cx, cy + 32, `+${r.bonus}`, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setDepth(950)
      .setAlpha(0);
    this.tweens.add({ targets: t1, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t2, alpha: 1, duration: 320, delay: 200 });

    this.balls.forEach((b) => b.setVelocity(0, 0));

    this.time.delayedCall(1700, () => {
      t1.destroy();
      t2.destroy();
      this.levelIndex++;
      this.registry.set(RegistryKeys.LevelIndex, this.levelIndex);
      this.registry.set(RegistryKeys.Score, this.score.score);
      this.registry.set(RegistryKeys.Lives, this.score.livesLeft);
      // Persist mid-run snapshot — the player can close the tab and
      // resume from the next level via CONTINUE on the main menu.
      saveRun({
        levelIndex: this.levelIndex,
        score: this.score.score,
        lives: this.score.livesLeft,
      });
      if (this.levelIndex >= TOTAL_LEVELS) {
        this.triggerVictory();
      } else {
        this.balls.forEach((b) => b.destroy());
        this.balls = [];
        this.levelTransitioning = false;
        this.loadLevel(this.levelIndex);
      }
    });
  }

  private triggerVictory(): void {
    this.persistHighScore();
    clearSavedRun();
    this.events.emit(Events.GameVictory);
    this.scene.launch(SceneKeys.Victory, { score: this.score.score });
    this.scene.pause();
  }

  private triggerGameOver(): void {
    this.gameOver = true;
    this.persistHighScore();
    clearSavedRun();
    getAudio().playSfx('gameOver');
    this.events.emit(Events.GameOver);
    this.time.delayedCall(900, () => {
      this.scene.launch(SceneKeys.GameOver, { score: this.score.score, highScore: this.score.highScore });
      this.scene.pause();
    });
  }

  private persistHighScore(): void {
    const newHi = Math.max(
      Number(this.registry.get(RegistryKeys.HighScore) ?? 0),
      this.score.score,
    );
    this.registry.set(RegistryKeys.HighScore, newHi);
    try {
      localStorage.setItem('brickstorm.highscore', String(newHi));
    } catch {
      /* ignore */
    }
  }

  // ---------- Power-ups ----------

  private tickPowerups(): void {
    const removed: PowerUp[] = [];
    for (const pu of this.powerups) {
      if (!pu.alive) {
        removed.push(pu);
        continue;
      }
      pu.update();
      // Collide with paddle (overlap rectangle test).
      if (
        pu.sprite.x > this.paddle.left &&
        pu.sprite.x < this.paddle.right &&
        pu.sprite.y + Tuning.powerups.height / 2 > this.paddle.top &&
        pu.sprite.y - Tuning.powerups.height / 2 < this.paddle.bottom
      ) {
        this.applyPowerUp(pu.kind);
        pu.collect();
        removed.push(pu);
        continue;
      }
      if (pu.sprite.y > GAME_HEIGHT + 30) {
        pu.destroy();
        removed.push(pu);
      }
    }
    if (removed.length) this.powerups = this.powerups.filter((p) => !removed.includes(p));
  }

  private applyPowerUp(kind: PowerUpKind): void {
    getAudio().playSfx('powerupGet');
    haptic.tick();
    this.paddle.pulse();
    const def = POWERUPS[kind];

    switch (kind) {
      case 'expand':
        if (this.active.find((a) => a.kind === 'shrink')) {
          this.resolveSizeConflict('expand');
          break;
        }
        this.paddle.resize(+40);
        this.startTimed(kind, Tuning.powerups.durations.expand);
        break;
      case 'shrink':
        if (this.active.find((a) => a.kind === 'expand')) {
          this.resolveSizeConflict('shrink');
          break;
        }
        this.paddle.resize(-40);
        this.startTimed(kind, Tuning.powerups.durations.shrink);
        break;
      case 'slow':
        this.balls.forEach((b) => b.scaleSpeed(0.7));
        this.startTimed(kind, Tuning.powerups.durations.slow);
        break;
      case 'multi':
        this.spawnMultiBall();
        break;
      case 'sticky':
        this.paddle.setSticky(true);
        this.startTimed(kind, Tuning.powerups.durations.sticky);
        break;
      case 'laser':
        this.paddle.setMode('laser');
        this.startTimed(kind, Tuning.powerups.durations.laser);
        break;
      case 'fast':
        // TURBO: cancels SLOW. Speed bumped up; restored on expire.
        this.active = this.active.filter((a) => a.kind !== 'slow');
        this.balls.forEach((b) => {
          b.scaleSpeed(Tuning.powerupEffects.fastSpeedMul);
          b.setFastMode(true);
        });
        this.startTimed(kind, Tuning.powerups.durations.fast);
        break;
      case 'through':
        this.balls.forEach((b) => b.setMode('through', this));
        this.startTimed(kind, Tuning.powerups.durations.through);
        break;
      case 'big':
        this.balls.forEach((b) => b.setMode('big', this));
        this.startTimed(kind, Tuning.powerups.durations.big);
        break;
      case 'magnet':
        this.balls.forEach((b) => b.setMagnetMode(true));
        this.startTimed(kind, Tuning.powerups.durations.magnet);
        break;
      case 'bomb':
        this.bombArmed = true;
        floatingPoints(this, this.paddle.x, this.paddle.y - 30, 'BOMB ARMED', '#ff5500', 18);
        break;
      case 'gravity':
        this.applyGravityShift();
        floatingPoints(this, GAME_WIDTH / 2, 200, 'BRICKS SHIFT', '#88aacc', 22);
        break;
      case 'ghost':
        this.paddle.setGhostShield(true);
        floatingPoints(this, this.paddle.x, this.paddle.y - 30, 'GHOST SHIELD', '#99ffee', 18);
        break;
      case 'score2x':
        this.startTimed(kind, Tuning.powerups.durations.score2x);
        floatingPoints(this, this.paddle.x, this.paddle.y - 30, 'SCORE x2', '#ffd23a', 18);
        break;
      case 'life':
        this.score.grantLife();
        this.events.emit(Events.LivesChanged, this.score.livesLeft);
        break;
    }

    this.events.emit(Events.PowerUpActivated, { kind, label: def.label, duration: this.activeRemainingFor(kind) });
  }

  /**
   * When the player picks up the opposite-sign size power-up while a
   * size effect is already active, both cancel out with a tug-of-war
   * paddle animation and a CANCELLED floater. Felt mandatory for
   * polish — silently swallowing the second pickup is unsatisfying.
   */
  private resolveSizeConflict(_picked: 'expand' | 'shrink'): void {
    // Drop both timers.
    this.active = this.active.filter((a) => a.kind !== 'expand' && a.kind !== 'shrink');
    this.events.emit(Events.PowerUpExpired, 'expand');
    this.events.emit(Events.PowerUpExpired, 'shrink');
    // Tug-of-war: scaleX yo-yos a few times, then resets to baseline width.
    const sp = this.paddle.sprite;
    const orig = sp.scaleX;
    this.tweens.add({
      targets: sp,
      scaleX: orig * 1.18,
      yoyo: true,
      duration: 90,
      repeat: 2,
      ease: 'sine.inOut',
      onComplete: () => {
        this.paddle.resetWidth();
      },
    });
    floatingPoints(this, this.paddle.x, this.paddle.y - 30, 'CANCELLED', '#ff5d6c', 18);
    getAudio().playSfx('uiSelect', 0.7);
  }

  private activeRemainingFor(kind: PowerUpKind): number {
    const a = this.active.find((x) => x.kind === kind);
    return a ? a.remaining : 0;
  }

  private startTimed(kind: PowerUpKind, ms: number): void {
    const existing = this.active.find((a) => a.kind === kind);
    if (existing) {
      existing.remaining = ms;
      existing.totalMs = ms;
    } else {
      this.active.push({ kind, remaining: ms, totalMs: ms });
    }
  }

  private tickActivePowerUps(deltaMs: number): void {
    if (this.active.length === 0) return;
    const expired: ActiveTimedPU[] = [];
    for (const a of this.active) {
      a.remaining -= deltaMs;
      if (a.remaining <= 0) expired.push(a);
    }
    if (expired.length) {
      for (const e of expired) this.expirePowerUp(e.kind);
      this.active = this.active.filter((a) => !expired.includes(a));
    }
    // Emit current set for HUD.
    this.events.emit(
      Events.PowerUpActivated,
      this.active.map<ActivePowerUp>((a) => ({ kind: a.kind, remaining: a.remaining })),
    );
  }

  private expirePowerUp(kind: PowerUpKind): void {
    switch (kind) {
      case 'expand':
      case 'shrink':
        this.paddle.resetWidth();
        break;
      case 'sticky':
        this.paddle.setSticky(false);
        break;
      case 'laser':
        this.paddle.setMode('normal');
        break;
      case 'slow':
        // Speed naturally returns via brick speed-up; no action.
        break;
      case 'fast':
        // Restore the speed scaling on expire.
        this.balls.forEach((b) => {
          b.scaleSpeed(1 / Tuning.powerupEffects.fastSpeedMul);
          b.setFastMode(false);
        });
        break;
      case 'through':
        this.balls.forEach((b) => {
          if (b.mode === 'through') b.clearMode();
        });
        break;
      case 'big':
        this.balls.forEach((b) => {
          if (b.mode === 'big') b.clearMode();
        });
        break;
      case 'magnet':
        this.balls.forEach((b) => b.setMagnetMode(false));
        break;
      case 'score2x':
        // Pure score modifier — nothing to undo other than removing it
        // from `active` (the multiplier in computeScoreMul reads from
        // the active list directly).
        break;
      default:
        break;
    }
    this.events.emit(Events.PowerUpExpired, kind);
  }

  /** Effective score multiplier from currently active power-ups. */
  private computeScoreMul(): number {
    let mul = 1;
    for (const a of this.active) {
      if (a.kind === 'score2x') mul *= 2;
      else if (a.kind === 'fast') mul *= Tuning.powerupEffects.fastScoreMul;
    }
    return mul;
  }

  /**
   * Last-resort escape if a ball ends up overlapping any alive brick
   * for several consecutive frames. With the swept-segment brickReflect
   * + depenetration push this should never trigger, but the failure
   * mode is severe (frozen ball, infinite particle effects), so we
   * keep this nuclear option in. After the threshold, we kick the ball
   * out vertically and flip vy so it heads away from whatever it was
   * stuck in.
   */
  private tickStuckInBrick(ball: Ball): void {
    let overlaps = false;
    for (const b of this.bricks) {
      if (!b.alive) continue;
      if (
        ball.x + ball.radius > b.left &&
        ball.x - ball.radius < b.right &&
        ball.y + ball.radius > b.top &&
        ball.y - ball.radius < b.bottom
      ) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) {
      ball.framesInsideBrick = 0;
      return;
    }
    ball.framesInsideBrick += 1;
    if (ball.framesInsideBrick >= 3) {
      // Kick out: shove the ball vertically by 2× radius in whichever
      // direction it was already heading, and flip vy so the next
      // collision pass sees a fresh trajectory.
      const dir = ball.vy >= 0 ? 1 : -1;
      ball.setPosition(ball.x, ball.y + dir * ball.radius * 2);
      ball.setVelocity(ball.vx, -ball.vy);
      ball.framesInsideBrick = 0;
    }
  }

  /**
   * MAGNET: per-frame nudge toward the centroid of remaining breakable
   * bricks. Preserves the ball's speed (only redirects), so it can't
   * lock the ball into a single direction — it's more like a gentle
   * curve toward the action.
   */
  private applyMagnetPull(ball: Ball, dt: number): void {
    let cx = 0;
    let cy = 0;
    let count = 0;
    for (const b of this.bricks) {
      if (b.alive && b.isBreakable()) {
        cx += b.x;
        cy += b.y;
        count++;
      }
    }
    if (count === 0) return;
    cx /= count;
    cy /= count;
    const dx = cx - ball.x;
    const dy = cy - ball.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const speed = ball.speed;
    if (speed <= 0) return;
    const pull = Tuning.powerupEffects.magnetPullPerSec * dt;
    let newVx = ball.vx + (dx / dist) * pull;
    let newVy = ball.vy + (dy / dist) * pull;
    const mag = Math.hypot(newVx, newVy);
    if (mag <= 0) return;
    // Re-normalize to original speed so MAGNET only redirects, never speeds.
    newVx = (newVx / mag) * speed;
    newVy = (newVy / mag) * speed;
    ball.setVelocity(newVx, newVy);
  }

  /**
   * GRAVITY: shift every alive brick down one cell. Bricks that would
   * land below the paddle zone are destroyed in place (they count
   * toward the breakable count, so the player doesn't need to chase
   * them). The drop is animated so the field reads as physically
   * settling rather than teleporting.
   */
  private applyGravityShift(): void {
    const dy = Tuning.bricks.height + Tuning.bricks.rowGap;
    const killBelow = this.paddle.top - Tuning.bricks.height;
    for (const b of this.bricks) {
      if (!b.alive) continue;
      const targetY = b.y + dy;
      if (targetY > killBelow) {
        // Doomed brick — explode + count as broken.
        candyBurst(this, b.x, b.y, b.color);
        if (b.isBreakable()) this.bricksRemaining = Math.max(0, this.bricksRemaining - 1);
        b.destroy();
        continue;
      }
      this.tweens.add({
        targets: b.sprite,
        y: targetY,
        duration: 360,
        ease: 'Bounce.easeOut',
      });
    }
    shake(this, 220, 0.008);
    if (this.bricksRemaining === 0) this.completeLevel();
  }

  private spawnMultiBall(): void {
    const sources = [...this.balls];
    if (sources.length === 0) return;
    let extraIdx = 0;
    for (const src of sources) {
      for (let i = 0; i < 2; i++) {
        const tint = MULTIBALL_TINTS[extraIdx % MULTIBALL_TINTS.length];
        extraIdx++;
        const b = new Ball(this, src.x, src.y, tint);
        b.isAttached = false;
        const speed = Math.max(Tuning.ball.minSpeed, src.speed || Tuning.ball.baseSpeed);
        const angle = (Math.random() * 0.6 - 0.3) + (i === 0 ? -0.6 : 0.6);
        b.setVelocity(Math.sin(angle) * speed, -Math.cos(angle) * speed);
        this.balls.push(b);
      }
    }
  }

  // ---------- Projectiles ----------

  private tickProjectiles(_time: number): void {
    const dead: Projectile[] = [];
    for (const p of this.projectiles) {
      if (!p.alive) {
        dead.push(p);
        continue;
      }
      if (p.y < FIELD_TOP - 10) {
        p.destroy();
        dead.push(p);
        continue;
      }
      // Brick hit?
      for (const brick of this.bricks) {
        if (!brick.alive) continue;
        if (
          p.x + Tuning.laser.width / 2 >= brick.left &&
          p.x - Tuning.laser.width / 2 <= brick.right &&
          p.y - Tuning.laser.height / 2 <= brick.bottom &&
          p.y + Tuning.laser.height / 2 >= brick.top
        ) {
          if (!brick.isBreakable()) {
            p.destroy();
            dead.push(p);
            getAudio().playSfx('wall', 0.5);
            spark(this, p.x, p.y, 0xffffff, 4);
          } else {
            const r = brick.hit(this);
            if (r.destroyed) {
              this.handleBrickDestroyed(brick, this.balls[0] ?? new Ball(this, 0, 0));
            } else {
              getAudio().playSfx('brickHit', 0.4);
            }
            p.destroy();
            dead.push(p);
          }
          break;
        }
      }
    }
    if (dead.length) this.projectiles = this.projectiles.filter((p) => !dead.includes(p));
  }

  // ---------- Setup helpers ----------

  private spawnBallOnPaddle(speedMul = 1): void {
    const b = new Ball(this, this.paddle.x, this.paddle.y - this.paddle.height / 2 - Tuning.ball.radius - 1);
    b.isAttached = true;
    b.attachOffset = 0;
    void speedMul;
    this.balls.push(b);
    this.input$?.setBallHeld(true);
    this.showServeHint();
    this.startServePulse(b);
  }

  /** Slow breathing scale on the held ball + a dashed aim line that
   *  tracks paddle position so the player can see where their serve
   *  will go. */
  private startServePulse(ball: Ball): void {
    this.servePulseTween?.stop();
    ball.sprite.setScale(1);
    this.servePulseTween = this.tweens.add({
      targets: ball.sprite,
      scale: { from: 0.92, to: 1.18 },
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
    if (!this.aimGfx) {
      this.aimGfx = this.add.graphics().setDepth(24);
    }
  }

  private stopServePulse(): void {
    this.servePulseTween?.stop();
    this.servePulseTween = undefined;
    this.balls.forEach((b) => b.sprite.setScale(1));
    this.aimGfx?.clear();
  }

  /** Per-frame aim line drawn from each attached ball. */
  private drawAimLine(): void {
    if (!this.aimGfx) return;
    this.aimGfx.clear();
    const held = this.balls.find((b) => b.isAttached);
    if (!held) return;
    // Match the paddle-zone reflection model: outgoing angle is
    // determined by where the ball sits on the paddle.
    const rel = (held.x - this.paddle.left) / this.paddle.width; // 0..1
    const offset = Math.max(-1, Math.min(1, (rel - 0.5) * 2));
    const angle = offset * Tuning.paddle.maxBounceAngle; // 0 = straight up
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const len = 110;
    // Dashed line from ball outward.
    this.aimGfx.lineStyle(2, 0x9bf2ff, 0.55);
    const dash = 8;
    const gap = 6;
    for (let i = 0; i < len; i += dash + gap) {
      const t0 = i / len;
      const t1 = Math.min((i + dash) / len, 1);
      this.aimGfx.lineBetween(
        held.x + dx * len * t0,
        held.y + dy * len * t0,
        held.x + dx * len * t1,
        held.y + dy * len * t1,
      );
    }
    // Arrowhead.
    const tipX = held.x + dx * len;
    const tipY = held.y + dy * len;
    const perpX = -dy;
    const perpY = dx;
    this.aimGfx.fillStyle(0x9bf2ff, 0.7);
    this.aimGfx.fillTriangle(
      tipX,
      tipY,
      tipX - dx * 10 + perpX * 5,
      tipY - dy * 10 + perpY * 5,
      tipX - dx * 10 - perpX * 5,
      tipY - dy * 10 - perpY * 5,
    );
  }

  private showServeHint(): void {
    this.serveHint?.destroy();
    this.touchUi?.showLaunchButton(true);
    this.serveHint = this.add
      .text(GAME_WIDTH / 2, this.paddle.y - 80, 'DRAG TO MOVE  ·  TAP TO SERVE', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        color: '#9bf2ff',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setDepth(50)
      .setAlpha(0.9);
    this.tweens.add({
      targets: this.serveHint,
      alpha: { from: 0.55, to: 1 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
  }

  private hideServeHint(): void {
    this.touchUi?.showLaunchButton(false);
    if (!this.serveHint) return;
    this.tweens.killTweensOf(this.serveHint);
    this.serveHint.destroy();
    this.serveHint = undefined;
  }

  private drawFrame(): void {
    const g = this.add.graphics({ x: 0, y: 0 }).setDepth(5);
    g.fillStyle(0x111a30, 1);
    // Top HUD strip is drawn by UIScene; we just outline the play area.
    g.fillRect(0, FIELD_TOP - WALL, GAME_WIDTH, WALL); // top wall
    g.fillRect(0, FIELD_TOP - WALL, WALL, GAME_HEIGHT - FIELD_TOP + WALL); // left
    g.fillRect(GAME_WIDTH - WALL, FIELD_TOP - WALL, WALL, GAME_HEIGHT - FIELD_TOP + WALL); // right
    g.lineStyle(1, 0x9bf2ff, 0.4);
    g.strokeRect(WALL, FIELD_TOP, GAME_WIDTH - WALL * 2, GAME_HEIGHT - FIELD_TOP);
  }

  private drawDebug(): void {
    if (!this.debugGfx) return;
    const g = this.debugGfx;
    g.clear();
    g.lineStyle(1, 0x00ff66, 0.7);
    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      g.strokeRect(brick.left, brick.top, brick.right - brick.left, brick.bottom - brick.top);
    }
    g.lineStyle(1, 0xff66ff, 0.7);
    g.strokeRect(this.paddle.left, this.paddle.top, this.paddle.width, this.paddle.height);
    g.lineStyle(1, 0xffff66, 1);
    for (const b of this.balls) {
      g.strokeCircle(b.x, b.y, b.radius);
      g.lineBetween(b.x, b.y, b.x + b.vx * 0.05, b.y + b.vy * 0.05);
    }
  }
}

function hexToCss(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}
