import Phaser from 'phaser';
import { Tuning } from '../config/tuning';

export class Projectile {
  readonly sprite: Phaser.Physics.Arcade.Image;
  alive = true;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const sp = scene.physics.add.image(x, y, 'laser');
    sp.body.allowGravity = false;
    sp.setVelocity(0, -Tuning.laser.speed);
    sp.setDepth(20);
    this.sprite = sp;
  }

  destroy(): void {
    this.alive = false;
    this.sprite.destroy();
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }
}
