import Phaser from 'phaser';
import { Tuning } from '../config/tuning';
import { POWERUP_TEXTURE } from '../data/powerUps';
import type { PowerUpKind } from '../types';

export class PowerUp {
  readonly sprite: Phaser.Physics.Arcade.Image;
  readonly kind: PowerUpKind;
  alive = true;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: PowerUpKind) {
    this.kind = kind;
    const sp = scene.physics.add.image(x, y, POWERUP_TEXTURE[kind]);
    sp.setOrigin(0.5);
    sp.body.allowGravity = false;
    sp.setVelocity(0, Tuning.powerups.speed);
    sp.setDepth(15);
    this.sprite = sp;

    // Wobble.
    scene.tweens.add({
      targets: sp,
      angle: { from: -8, to: 8 },
      duration: 380,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
  }

  destroy(): void {
    this.alive = false;
    // Stop the looping wobble tween before the sprite goes away. Phaser's
    // tween manager keeps the target reference and would keep firing
    // onUpdate against a destroyed sprite, producing warnings on busy
    // levels that drop many capsules.
    this.sprite.scene?.tweens.killTweensOf(this.sprite);
    this.sprite.destroy();
  }
}
