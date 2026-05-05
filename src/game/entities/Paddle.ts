import Phaser from 'phaser';
import { Tuning } from '../config/tuning';
import { CANDY } from '../config/palette';

export type PaddleMode = 'normal' | 'laser';

/**
 * Paddle entity. Wraps an Arcade Physics image so the engine can give us a
 * body for overlap detection with falling power-ups and laser projectiles.
 * The ball's bounce against the paddle is custom (CollisionSystem) — Arcade's
 * default bounce is intentionally bypassed.
 *
 * Visuals: a single 'paddle-candy' texture re-tinted at runtime — blueberry
 * by default, mint while sticky, tangerine while laser. A 'glow-soft' halo
 * behind the body breathes alpha so the paddle feels alive while idle.
 */
export class Paddle {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private currentWidth: number;
  private mode: PaddleMode = 'normal';
  private sticky = false;
  private glow: Phaser.GameObjects.Image;
  /** GHOST power-up: one-shot reflection shield instead of losing the ball. */
  private ghostShield = false;
  private ghostTween?: Phaser.Tweens.Tween;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
  ) {
    // Soft halo behind the paddle.
    this.glow = scene.add
      .image(x, y, 'glow-soft')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(19)
      .setAlpha(0.32)
      .setTint(CANDY.blueberry);

    const sp = scene.physics.add.image(x, y, 'paddle-candy');
    sp.setOrigin(0.5);
    sp.setImmovable(true);
    sp.setCollideWorldBounds(false);
    sp.body.allowGravity = false;
    sp.setDepth(20);
    sp.setTint(CANDY.blueberry);
    this.sprite = sp;
    this.currentWidth = Tuning.paddle.baseWidth;
    this.applyWidth(false);

    // Idle pulsing glow — sine breathing, never finishes.
    scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.3, to: 0.6 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.killTweensOf(this.glow);
    this.glow.destroy();
    this.sprite.destroy();
  }

  /** Per-frame: keep the glow position synced. */
  update(): void {
    this.glow.setPosition(this.sprite.x, this.sprite.y);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get width(): number {
    return this.currentWidth;
  }

  get height(): number {
    return Tuning.paddle.height;
  }

  get left(): number {
    return this.sprite.x - this.currentWidth / 2;
  }
  get right(): number {
    return this.sprite.x + this.currentWidth / 2;
  }
  get top(): number {
    return this.sprite.y - Tuning.paddle.height / 2;
  }
  get bottom(): number {
    return this.sprite.y + Tuning.paddle.height / 2;
  }

  isSticky(): boolean {
    return this.sticky;
  }
  isLaser(): boolean {
    return this.mode === 'laser';
  }
  hasGhostShield(): boolean {
    return this.ghostShield;
  }

  /**
   * Arm a one-use ghost shield. The next ball that would fall past the
   * paddle gets reflected up instead of lost (see GameScene.onBallLost).
   * The paddle pulses transparency while armed — visually distinct from
   * sticky/laser so the player knows what's active.
   */
  setGhostShield(on: boolean): void {
    if (on === this.ghostShield) return;
    this.ghostShield = on;
    if (on) {
      this.ghostTween?.stop();
      this.ghostTween = this.scene.tweens.add({
        targets: this.sprite,
        alpha: { from: 1, to: 0.45 },
        yoyo: true,
        repeat: -1,
        duration: 600,
        ease: 'sine.inOut',
      });
    } else {
      this.ghostTween?.stop();
      this.ghostTween = undefined;
      this.sprite.setAlpha(1);
    }
  }

  /** Consume the ghost shield (called after a save). */
  consumeGhostShield(): void {
    this.setGhostShield(false);
  }

  setSticky(s: boolean): void {
    this.sticky = s;
    this.refreshTint();
  }

  setMode(m: PaddleMode): void {
    this.mode = m;
    this.refreshTint();
    this.applyWidth(false);
  }

  setX(x: number, minX: number, maxX: number): void {
    const clamped = Phaser.Math.Clamp(x, minX + this.currentWidth / 2, maxX - this.currentWidth / 2);
    this.sprite.setX(clamped);
  }

  /** Smoothly nudge by dx/dt along x (used by keyboard input). */
  moveBy(dx: number, minX: number, maxX: number): void {
    this.setX(this.sprite.x + dx, minX, maxX);
  }

  /** Set width by delta (positive widens, negative narrows). Clamped. */
  resize(deltaPx: number): void {
    this.currentWidth = Phaser.Math.Clamp(
      this.currentWidth + deltaPx,
      Tuning.paddle.minWidth,
      Tuning.paddle.maxWidth,
    );
    this.applyWidth(true);
  }

  resetWidth(): void {
    this.currentWidth = Tuning.paddle.baseWidth;
    this.applyWidth(false);
  }

  /**
   * Apply the current width. When `animate`, the visual scaleX overshoots
   * via Back.easeOut for a satisfying candy-stretch on expand/shrink. The
   * body is resized synchronously so collision stays accurate even while
   * the sprite is mid-bounce.
   */
  private applyWidth(animate: boolean): void {
    const sx = this.currentWidth / Tuning.paddle.maxWidth;
    this.sprite.body?.setSize(this.currentWidth, Tuning.paddle.height, true);
    this.scene.tweens.killTweensOf(this.sprite);
    if (animate) {
      this.scene.tweens.add({
        targets: this.sprite,
        scaleX: sx,
        duration: 260,
        ease: 'Back.easeOut',
      });
    } else {
      this.sprite.setScale(sx, this.sprite.scaleY || 1);
    }
  }

  /** Recompute paddle tint from current state (mode + sticky). */
  private refreshTint(): void {
    let tint: number = CANDY.blueberry;
    if (this.mode === 'laser') tint = CANDY.tangerine;
    else if (this.sticky) tint = CANDY.mint;
    this.sprite.setTint(tint);
    this.glow.setTint(tint);
  }

  /** Brief vertical squish on ball impact. */
  squish(): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleY: { from: 0.85, to: 1 },
      duration: 180,
      ease: 'Back.easeOut',
    });
  }

  /** Visual flash when picking up a power-up. */
  pulse(): void {
    this.scene.tweens.add({
      targets: this.sprite,
      scaleY: 1.25,
      yoyo: true,
      duration: 100,
      ease: 'sine.out',
    });
  }
}
