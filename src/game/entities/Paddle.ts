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
  private shine: Phaser.GameObjects.Image;
  /** sweep position in [-0.15, 1.15]; outside [0, 1] the shine is invisible */
  private shineProgress = -0.2;

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

    // Shining effect: a soft white gradient that periodically sweeps
    // left-to-right across the paddle. Drawn additively above the body.
    this.shine = scene.add
      .image(x, y, 'paddle-shine')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(21)
      .setAlpha(0)
      .setRotation(-0.18); // a little tilt — feels metallic
    scene.tweens.addCounter({
      from: -0.2,
      to: 1.2,
      duration: 1100,
      repeat: -1,
      repeatDelay: 1700,
      ease: 'sine.in',
      onUpdate: (tw) => {
        this.shineProgress = tw.getValue() ?? -0.2;
      },
    });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.killTweensOf(this.shine);
    this.shine.destroy();
    this.sprite.destroy();
  }

  /** Per-frame: sync the shine sprite to the paddle's current x. */
  update(): void {
    const t = this.shineProgress;
    if (t < 0 || t > 1) {
      this.shine.setAlpha(0);
      return;
    }
    // Soft fade-in/out so edges of the sweep don't pop.
    const fade = Math.sin(t * Math.PI);
    this.shine.setAlpha(fade * 0.85);
    const px = this.left + this.currentWidth * t;
    this.shine.setPosition(px, this.sprite.y);
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
