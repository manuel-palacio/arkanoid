import Phaser from 'phaser';
import { Tuning } from '../config/tuning';
import { CANDY } from '../config/palette';

/** Multi-ball extras cycle through this palette in order. */
export const MULTIBALL_TINTS: number[] = [CANDY.cherry, CANDY.lime, CANDY.grape];

/**
 * Ball entity. We use Arcade Physics for body bookkeeping but drive velocity
 * manually — bounce reflection is computed by the CollisionSystem.
 *
 * Visuals: a glossy 'ball-candy' sphere tinted lemon by default; multi-ball
 * extras can pass a tint override. A 'glow-soft' particle trail emits behind
 * the ball every ~3 frames, tinted to the ball's color, for a candy comet.
 */
export class Ball {
  readonly sprite: Phaser.Physics.Arcade.Image;
  /** when true, ball follows paddle until launched (serve / sticky catch) */
  isAttached = true;
  /** offset from paddle center while attached */
  attachOffset = 0;
  /** legacy graphics trail kept as a thin core fade */
  private trail: Phaser.GameObjects.Graphics;
  private trailPoints: Array<{ x: number; y: number; t: number }> = [];
  /** soft glow trail (particles emitted along the ball's path) */
  private glowTrail: Phaser.GameObjects.Particles.ParticleEmitter;
  /** unique tint for distinguishing balls in multi-ball */
  readonly tint: number;

  constructor(scene: Phaser.Scene, x: number, y: number, tintOverride?: number) {
    const sp = scene.physics.add.image(x, y, 'ball-candy');
    sp.setCircle(Tuning.ball.radius);
    sp.setOrigin(0.5);
    sp.body.allowGravity = false;
    sp.setCollideWorldBounds(false);
    sp.setDepth(25);
    // We drive position manually each frame (substep loop in GameScene).
    // Letting Arcade Physics integrate the body would double the motion
    // and bypass our collision substep — the ball could teleport past the
    // paddle in a single frame. See issue #1.
    (sp.body as Phaser.Physics.Arcade.Body).moves = false;
    this.sprite = sp;

    this.tint = tintOverride ?? CANDY.lemon;
    sp.setTint(this.tint);

    this.trail = scene.add.graphics({ x: 0, y: 0 }).setDepth(24);

    // Soft candy comet trail — additive glow blobs along the path.
    this.glowTrail = scene.add
      .particles(0, 0, 'glow-soft', {
        follow: sp,
        frequency: 50,
        lifespan: 200,
        speed: 0,
        scale: { start: 0.6, end: 0 },
        alpha: { start: 0.4, end: 0 },
        tint: this.tint,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(23);
  }

  destroy(): void {
    this.sprite.destroy();
    this.trail.destroy();
    this.glowTrail.destroy();
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }
  get radius(): number {
    return Tuning.ball.radius;
  }
  get vx(): number {
    return this.sprite.body?.velocity.x ?? 0;
  }
  get vy(): number {
    return this.sprite.body?.velocity.y ?? 0;
  }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
  }

  setVelocity(vx: number, vy: number): void {
    this.sprite.setVelocity(vx, vy);
  }

  /** Compute current speed (magnitude of velocity). */
  get speed(): number {
    const vx = this.vx;
    const vy = this.vy;
    return Math.hypot(vx, vy);
  }

  /** Increase speed up to max. */
  bumpSpeed(by: number): void {
    const s = this.speed;
    if (s <= 0) return;
    const next = Phaser.Math.Clamp(s + by, Tuning.ball.minSpeed, Tuning.ball.maxSpeed);
    const m = next / s;
    this.setVelocity(this.vx * m, this.vy * m);
  }

  /** Halve speed (slow power-up). */
  scaleSpeed(mul: number): void {
    const s = this.speed;
    if (s <= 0) return;
    const next = Phaser.Math.Clamp(s * mul, Tuning.ball.minSpeed, Tuning.ball.maxSpeed);
    const m = next / s;
    this.setVelocity(this.vx * m, this.vy * m);
  }

  attachTo(x: number, y: number, offset: number): void {
    this.isAttached = true;
    this.attachOffset = offset;
    this.setVelocity(0, 0);
    this.setPosition(x + offset, y);
  }

  detach(initialVy: number = -Tuning.ball.baseSpeed): void {
    this.isAttached = false;
    // Slight outward angle based on offset for a natural launch.
    const angleDeg = Phaser.Math.Clamp(this.attachOffset / 4, -20, 20);
    const rad = Phaser.Math.DegToRad(angleDeg);
    const speed = Math.abs(initialVy);
    this.setVelocity(speed * Math.sin(rad), -speed * Math.cos(rad));
  }

  updateTrail(timeMs: number): void {
    if (!this.isAttached) {
      this.trailPoints.push({ x: this.x, y: this.y, t: timeMs });
    }
    this.trailPoints = this.trailPoints.filter((p) => timeMs - p.t < 220);
    this.trail.clear();
    for (let i = 0; i < this.trailPoints.length; i++) {
      const p = this.trailPoints[i];
      if (!p) continue;
      const a = (i / this.trailPoints.length) * 0.55;
      this.trail.fillStyle(this.tint, a);
      this.trail.fillCircle(p.x, p.y, Tuning.ball.radius * (i / this.trailPoints.length));
    }
  }

  /** Brief tint flash to white on wall bounce, then back to candy color. */
  onWallBounce(scene: Phaser.Scene): void {
    this.sprite.setTint(CANDY.white);
    scene.time.delayedCall(80, () => {
      if (this.sprite.active) this.sprite.setTint(this.tint);
    });
  }

  /** Squish-and-rebound scale pop on paddle contact. */
  onPaddleBounce(scene: Phaser.Scene): void {
    scene.tweens.killTweensOf(this.sprite);
    scene.tweens.add({
      targets: this.sprite,
      scale: { from: 1.3, to: 1 },
      duration: 150,
      ease: 'Back.easeOut',
    });
  }

  /** Snapshot current position for swept collision tests. */
  prevX = 0;
  prevY = 0;
  rememberPrev(): void {
    this.prevX = this.x;
    this.prevY = this.y;
  }
}
