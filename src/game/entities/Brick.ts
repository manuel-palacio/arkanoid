import Phaser from 'phaser';
import { Tuning } from '../config/tuning';
import type { BrickArchetype } from '../types';

/**
 * Visual + state container for a single brick. Holds an Arcade Physics image
 * (used only for spatial bookkeeping; collision response is custom).
 */
export class Brick {
  readonly sprite: Phaser.Physics.Arcade.Image;
  readonly archetype: BrickArchetype;
  hp: number;
  alive = true;
  private cracksOverlay?: Phaser.GameObjects.Image;

  /** Effective color (palette override or archetype default). */
  readonly color: number;

  constructor(scene: Phaser.Scene, x: number, y: number, archetype: BrickArchetype, colorOverride?: number) {
    this.archetype = archetype;
    this.hp = archetype.hits;
    this.color = colorOverride ?? archetype.color;
    const sp = scene.physics.add.image(x, y, archetype.glyph ?? 'brick-standard');
    sp.setOrigin(0.5);
    sp.setImmovable(true);
    sp.body.allowGravity = false;
    sp.setDepth(10);
    sp.body.setSize(Tuning.bricks.width, Tuning.bricks.height, true);
    if (colorOverride != null && archetype.kind !== 'indestructible') {
      sp.setTint(colorOverride);
    }
    this.sprite = sp;
  }

  /** Returns true if the brick was destroyed by this hit. */
  hit(scene: Phaser.Scene): { destroyed: boolean } {
    if (!this.alive) return { destroyed: false };
    if (this.archetype.kind === 'indestructible') {
      this.flash(scene, 0xffffff);
      return { destroyed: false };
    }
    this.hp -= 1;
    this.flash(scene, 0xffffff);
    if (this.hp <= 0) {
      this.alive = false;
      this.sprite.destroy();
      this.cracksOverlay?.destroy();
      return { destroyed: true };
    }
    // Show damage cracks once HP is below max.
    if (!this.cracksOverlay) {
      this.cracksOverlay = scene.add
        .image(this.sprite.x, this.sprite.y, 'brick-cracks')
        .setDepth(11)
        .setAlpha(0.55);
    }
    return { destroyed: false };
  }

  destroy(): void {
    this.alive = false;
    this.sprite.destroy();
    this.cracksOverlay?.destroy();
  }

  isBreakable(): boolean {
    return this.archetype.kind !== 'indestructible';
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }
  get left(): number {
    return this.sprite.x - Tuning.bricks.width / 2;
  }
  get right(): number {
    return this.sprite.x + Tuning.bricks.width / 2;
  }
  get top(): number {
    return this.sprite.y - Tuning.bricks.height / 2;
  }
  get bottom(): number {
    return this.sprite.y + Tuning.bricks.height / 2;
  }

  private flash(scene: Phaser.Scene, color: number): void {
    this.sprite.setTintFill(color);
    scene.time.delayedCall(Tuning.bricks.flashMs, () => {
      if (!this.alive) return;
      if (this.color !== this.archetype.color) {
        this.sprite.setTint(this.color);
      } else {
        this.sprite.clearTint();
      }
    });
  }
}
