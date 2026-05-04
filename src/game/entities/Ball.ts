import Phaser from 'phaser';
import { Tuning } from '../config/tuning';

/**
 * Ball entity. We use Arcade Physics for body bookkeeping but drive velocity
 * manually — bounce reflection is computed by the CollisionSystem.
 */
export class Ball {
  readonly sprite: Phaser.Physics.Arcade.Image;
  /** when true, ball follows paddle until launched (serve / sticky catch) */
  isAttached = true;
  /** offset from paddle center while attached */
  attachOffset = 0;
  /** trail render target */
  private trail: Phaser.GameObjects.Graphics;
  private trailPoints: Array<{ x: number; y: number; t: number }> = [];

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const sp = scene.physics.add.image(x, y, 'ball');
    sp.setCircle(Tuning.ball.radius);
    sp.setOrigin(0.5);
    sp.body.allowGravity = false;
    sp.setCollideWorldBounds(false);
    sp.setDepth(25);
    this.sprite = sp;
    this.trail = scene.add.graphics({ x: 0, y: 0 }).setDepth(24);
  }

  destroy(): void {
    this.sprite.destroy();
    this.trail.destroy();
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
      this.trail.fillStyle(Tuning.ball.trailColor, a);
      this.trail.fillCircle(p.x, p.y, Tuning.ball.radius * (i / this.trailPoints.length));
    }
  }

  /** Snapshot current position for swept collision tests. */
  prevX = 0;
  prevY = 0;
  rememberPrev(): void {
    this.prevX = this.x;
    this.prevY = this.y;
  }
}
