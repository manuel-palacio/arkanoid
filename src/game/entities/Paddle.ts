import Phaser from 'phaser';
import { Tuning } from '../config/tuning';

export type PaddleMode = 'normal' | 'laser';

/**
 * Paddle entity. Wraps an Arcade Physics image so the engine can give us a
 * body for overlap detection with falling power-ups and laser projectiles.
 * The ball's bounce against the paddle is custom (CollisionSystem) — Arcade's
 * default bounce is intentionally bypassed.
 */
export class Paddle {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private currentWidth: number;
  private mode: PaddleMode = 'normal';
  private sticky = false;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
  ) {
    const sp = scene.physics.add.image(x, y, 'paddle-base');
    sp.setOrigin(0.5);
    sp.setImmovable(true);
    sp.setCollideWorldBounds(false);
    sp.body.allowGravity = false;
    sp.setDepth(20);
    this.sprite = sp;
    this.currentWidth = Tuning.paddle.baseWidth;
    this.applyWidth();
  }

  destroy(): void {
    this.sprite.destroy();
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

  setSticky(s: boolean): void {
    this.sticky = s;
  }

  setMode(m: PaddleMode): void {
    this.mode = m;
    this.sprite.setTexture(m === 'laser' ? 'paddle-laser' : 'paddle-base');
    this.applyWidth();
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
    this.applyWidth();
  }

  resetWidth(): void {
    this.currentWidth = Tuning.paddle.baseWidth;
    this.applyWidth();
  }

  private applyWidth(): void {
    // Texture is generated at maxWidth; scale to current width.
    const scaleX = this.currentWidth / Tuning.paddle.maxWidth;
    this.sprite.setScale(scaleX, 1);
    // Refresh body to match visible size.
    this.sprite.body?.setSize(this.currentWidth, Tuning.paddle.height, true);
  }

  /** Visual flash when hit by a power-up. */
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
