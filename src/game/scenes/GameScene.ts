import Phaser from 'phaser';
import { Events, GAME_HEIGHT, GAME_WIDTH, RegistryKeys, SceneKeys } from '../config/gameConfig';
import { Tuning } from '../config/tuning';
import { Ball } from '../entities/Ball';
import { Brick } from '../entities/Brick';
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
  drawStarfield,
  fireworks,
  floatingPoints,
  hitstop,
  paddleFlare,
  shake,
  shockwave,
  spark,
  type Starfield,
} from '../systems/EffectsSystem';
import { InputSystem } from '../systems/InputSystem';
import { buildLevel } from '../systems/LevelSystem';
import { createPowerUpSelector, type PowerUpSelector } from '../systems/PowerUpSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { getAudio } from '../audio/AudioManager';
import { haptic } from '../utils/haptics';
import { acquireWakeLock, releaseWakeLock } from '../utils/wakeLock';
import type { ActivePowerUp, PowerUpKind } from '../types';
import { POWERUPS } from '../data/powerUps';

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

    // World boundaries (visual frame).
    this.drawFrame();

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
      audio.playMusic('game');
    });
    // Also try immediately in case the gesture already happened.
    audio.unlock();
    audio.playMusic('game');

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
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
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
    this.tickPowerups();
    this.tickProjectiles(time);
    this.tickActivePowerUps(delta);
    this.tickTension(time);
    if (this.debug) this.drawDebug();
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
    this.bricks = [];
    this.powerups = [];
    this.projectiles = [];
    this.active = [];
    this.tensionActive = false;
    this.tensionVignette?.destroy();
    this.tensionVignette = undefined;
    this.paddle.resetWidth();
    this.paddle.setMode('normal');
    this.paddle.setSticky(false);

    const built = buildLevel(this, def);
    this.bricks = built.bricks;
    this.bricksRemaining = built.breakableCount;

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
    const ptr = this.input$.pointerInfo();
    if (axis !== 0) {
      this.paddle.moveBy(axis * Tuning.paddle.speed * (deltaMs / 1000), FIELD_LEFT, FIELD_RIGHT);
    } else if (ptr.active) {
      // Direct mapping — paddle's x snaps to finger/cursor x. Anywhere on
      // the canvas works, not just the lower band, so finger placement
      // higher up on a phone screen still controls the paddle.
      this.paddle.setX(ptr.x, FIELD_LEFT, FIELD_RIGHT);
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
        ball.setVelocity(wr.vx, wr.vy);
        getAudio().playSfx('wall', 0.5);
      }

      // Floor — life lost.
      if (ball.y - ball.radius > Tuning.playfield.floorY) {
        this.onBallLost(ball);
      }

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
      // Reflect.
      const r = brickReflect(
        ball.prevX,
        ball.prevY,
        ball.x,
        ball.y,
        ball.vx,
        ball.vy,
        brick.left,
        brick.top,
        brick.right,
        brick.bottom,
      );
      ball.setVelocity(r.vx, r.vy);
      // Resolve penetration.
      if (r.vx !== ball.vx) {
        if (r.vx > 0) ball.setPosition(brick.right + ball.radius, ball.y);
        else ball.setPosition(brick.left - ball.radius, ball.y);
      }
      if (r.vy !== ball.vy) {
        if (r.vy > 0) ball.setPosition(ball.x, brick.bottom + ball.radius);
        else ball.setPosition(ball.x, brick.top - ball.radius);
      }
      this.onBrickHit(brick, ball);
      return true;
    }

    return false;
  }

  private onBrickHit(brick: Brick, ball: Ball): void {
    const result = brick.hit(this);
    if (result.destroyed) {
      this.handleBrickDestroyed(brick, ball);
    } else {
      getAudio().playSfx('brickHit', 0.5);
    }
  }

  private handleBrickDestroyed(brick: Brick, _ball: Ball): void {
    getAudio().playSfx('brickBreak');
    haptic.bump();
    spark(this, brick.x, brick.y, brick.color, 18);
    shockwave(this, brick.x, brick.y, brick.color);
    shake(this, Tuning.effects.shakeBrickDurationMs, Tuning.effects.shakeBrickIntensity);
    hitstop(this);
    const { points, chain } = this.score.brickBroken(brick.archetype.score, this.time.now);
    floatingPoints(
      this,
      brick.x,
      brick.y - 6,
      `+${points}`,
      hexToCss(brick.color),
      chain >= 3 ? 18 : 14,
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

    // Drop chance.
    const dropChance = brick.archetype.dropChance;
    if (this.puSelector.shouldDrop(dropChance)) {
      const def = levelByIndex(this.levelIndex);
      const allowed = def?.allowedPowerUps;
      const kind = this.puSelector.pickNext(allowed);
      const pu = new PowerUp(this, brick.x, brick.y, kind);
      this.powerups.push(pu);
      getAudio().playSfx('powerupDrop', 0.5);
    }

    // Speed up ball slightly with each break.
    for (const b of this.balls) {
      b.bumpSpeed(Tuning.ball.speedupPerBrick);
    }

    if (brick.isBreakable()) {
      this.bricksRemaining = Math.max(0, this.bricksRemaining - 1);
      this.updateTensionMode();
      if (this.bricksRemaining === 0) this.completeLevel();
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
    } else if (this.tensionVignette) {
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
    if (r.livesLeft <= 0) {
      this.triggerGameOver();
      return;
    }
    // Reset paddle/state.
    this.paddle.resetWidth();
    this.paddle.setMode('normal');
    this.paddle.setSticky(false);
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
    this.events.emit(Events.GameVictory);
    this.scene.launch(SceneKeys.Victory, { score: this.score.score });
    this.scene.pause();
  }

  private triggerGameOver(): void {
    this.gameOver = true;
    this.persistHighScore();
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
        pu.destroy();
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
      default:
        break;
    }
    this.events.emit(Events.PowerUpExpired, kind);
  }

  private spawnMultiBall(): void {
    const sources = [...this.balls];
    if (sources.length === 0) return;
    for (const src of sources) {
      for (let i = 0; i < 2; i++) {
        const b = new Ball(this, src.x, src.y);
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
  }

  private showServeHint(): void {
    this.serveHint?.destroy();
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
