import Phaser from 'phaser';
import { Tuning } from '../config/tuning';
import { POWERUP_TEXTURE, POWERUPS } from '../data/powerUps';
import type { PowerUpKind } from '../types';

export class PowerUp {
  readonly sprite: Phaser.Physics.Arcade.Image;
  readonly kind: PowerUpKind;
  alive = true;
  private glow: Phaser.GameObjects.Image;
  private sparkles: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: PowerUpKind) {
    this.kind = kind;
    const tex = POWERUP_TEXTURE[kind];
    const color = POWERUPS[kind].color;

    // Color-matched additive halo behind the capsule.
    this.glow = scene.add
      .image(x, y, tex)
      .setScale(1.55)
      .setAlpha(0.35)
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(14);
    scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.2, to: 0.6 },
      scale: { from: 1.45, to: 1.7 },
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });

    const sp = scene.physics.add.image(x, y, tex);
    sp.setOrigin(0.5);
    sp.body.allowGravity = false;
    sp.setVelocity(0, Tuning.powerups.speed);
    sp.setDepth(15);
    this.sprite = sp;

    // Continuous spin (replaces the old subtle wobble).
    scene.tweens.add({
      targets: sp,
      angle: 360,
      duration: 1100,
      repeat: -1,
      ease: 'Linear',
    });

    // Sparkle trail behind the capsule.
    this.sparkles = scene.add
      .particles(0, 0, 'spark', {
        follow: sp,
        followOffset: { x: 0, y: 0 },
        frequency: 60,
        lifespan: 380,
        speed: { min: 10, max: 30 },
        angle: { min: 70, max: 110 }, // emit slightly downward
        scale: { start: 0.7, end: 0 },
        alpha: { start: 0.7, end: 0 },
        tint: color,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(13);
  }

  /** Per-frame: keep the glow synced to the falling sprite. */
  update(): void {
    if (!this.alive) return;
    this.glow.setPosition(this.sprite.x, this.sprite.y);
  }

  destroy(): void {
    this.alive = false;
    const scene = this.sprite.scene;
    scene?.tweens.killTweensOf(this.sprite);
    scene?.tweens.killTweensOf(this.glow);
    this.glow.destroy();
    this.sparkles.destroy();
    this.sprite.destroy();
  }
}
