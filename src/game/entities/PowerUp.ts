import Phaser from 'phaser';
import { Tuning } from '../config/tuning';
import { POWERUPS } from '../data/powerUps';
import { POWERUP_CANDY_COLORS } from '../config/palette';
import { candyBurst } from '../systems/EffectsSystem';
import type { PowerUpKind } from '../types';

/**
 * Falling candy capsule. One shared 'powerup-candy' texture, tinted per
 * kind via POWERUP_CANDY_COLORS. Slow spin + pulsing 'glow-soft' ring
 * behind the capsule reads as "this is good, grab it."
 */
export class PowerUp {
  readonly sprite: Phaser.Physics.Arcade.Image;
  readonly kind: PowerUpKind;
  alive = true;
  private collecting = false;
  private glow: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: PowerUpKind) {
    this.kind = kind;
    const color = POWERUP_CANDY_COLORS[kind] ?? POWERUPS[kind].color;

    // Pulsing glow ring behind the capsule.
    this.glow = scene.add
      .image(x, y, 'glow-soft')
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.4)
      .setScale(0.8)
      .setDepth(14);
    scene.tweens.add({
      targets: this.glow,
      scale: { from: 0.8, to: 1.4 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });

    const sp = scene.physics.add.image(x, y, 'powerup-candy');
    sp.setOrigin(0.5);
    sp.body.allowGravity = false;
    sp.setVelocity(0, Tuning.powerups.speed);
    sp.setDepth(15);
    sp.setTint(color);
    this.sprite = sp;

    // Slow continuous spin — 360° every 7.5s for a relaxed candy roll.
    scene.tweens.add({
      targets: sp,
      angle: 360,
      duration: 7500,
      repeat: -1,
      ease: 'Linear',
    });

    // Letter label — 1-char glyph centered on the capsule. Counter-rotated
    // so it stays upright while the capsule spins.
    this.label = scene.add
      .text(x, y, POWERUPS[kind].label.charAt(0), {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: '900',
      })
      .setOrigin(0.5)
      .setDepth(16);
  }

  /** Per-frame: keep glow + label synced to the falling sprite. */
  update(): void {
    if (!this.alive) return;
    this.glow.setPosition(this.sprite.x, this.sprite.y);
    this.label.setPosition(this.sprite.x, this.sprite.y);
  }

  /**
   * Caught by the paddle — celebrate, then clean up. Fires a candyBurst
   * in the kind's color, scales the capsule to 0 over 120 ms, and tears
   * everything down.
   */
  collect(): void {
    if (this.collecting) return;
    this.collecting = true;
    this.alive = false;
    const scene = this.sprite.scene;
    const color = POWERUP_CANDY_COLORS[this.kind] ?? POWERUPS[this.kind].color;
    candyBurst(scene, this.sprite.x, this.sprite.y, color);
    // Stop falling and the spin/glow tweens; play the pop-out scale.
    (this.sprite.body as Phaser.Physics.Arcade.Body | undefined)?.setVelocity(0, 0);
    scene.tweens.killTweensOf(this.sprite);
    scene.tweens.killTweensOf(this.glow);
    scene.tweens.add({
      targets: [this.sprite, this.glow, this.label],
      scale: 0,
      alpha: 0,
      duration: 120,
      ease: 'Back.easeIn',
      onComplete: () => this.disposeNow(),
    });
  }

  /** Silent dispose (e.g. capsule fell off-screen). */
  destroy(): void {
    if (this.collecting) return; // collect() will dispose when its tween ends.
    this.disposeNow();
  }

  private disposeNow(): void {
    this.alive = false;
    const scene = this.sprite.scene;
    scene?.tweens.killTweensOf(this.sprite);
    scene?.tweens.killTweensOf(this.glow);
    this.glow.destroy();
    this.label.destroy();
    this.sprite.destroy();
  }
}
