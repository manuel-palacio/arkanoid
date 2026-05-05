import type Phaser from 'phaser';
import { Tuning } from '../config/tuning';

/**
 * Spawner-released enemy. Drifts down at a constant speed with a
 * subtle horizontal sine waver. Killed by:
 *   - Ball contact (any mode)
 *   - Laser projectile
 *   - Falling past the floor (silent — no penalty, no points)
 *
 * Visuals reuse the 'glow-soft' texture tinted magenta + a sharper
 * inner sparkle ('spark-candy') so the enemy reads as a glowing orb
 * rather than a generic blob. Both layers stay synced via update().
 */
export class Enemy {
  readonly sprite: Phaser.GameObjects.Image;
  private readonly core: Phaser.GameObjects.Image;
  alive = true;
  private readonly startX: number;
  private readonly startTimeMs: number;
  private y: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.startX = x;
    this.startTimeMs = scene.time.now;
    this.y = y;

    this.sprite = scene.add
      .image(x, y, 'glow-soft')
      .setScale(0.55)
      .setTint(0xff33ff)
      .setBlendMode('ADD')
      .setDepth(18);

    this.core = scene.add
      .image(x, y, 'spark-candy')
      .setScale(1.4)
      .setTint(0xffaaff)
      .setBlendMode('ADD')
      .setDepth(19);

    // Slow rotation on the core so the spark facets twinkle.
    scene.tweens.add({
      targets: this.core,
      angle: 360,
      duration: 2200,
      repeat: -1,
      ease: 'Linear',
    });
  }

  /** Per-frame: drift down + sine waver, sync core. */
  update(deltaMs: number, nowMs: number): void {
    if (!this.alive) return;
    const cfg = Tuning.enemies;
    this.y += cfg.fallSpeed * (deltaMs / 1000);
    const t = (nowMs - this.startTimeMs) / 1000;
    const x = this.startX + Math.sin(t * cfg.waverFreq) * cfg.waverAmplitude;
    this.sprite.setPosition(x, this.y);
    this.core.setPosition(x, this.y);
  }

  destroy(): void {
    this.alive = false;
    this.sprite.destroy();
    this.core.destroy();
  }

  get x(): number {
    return this.sprite.x;
  }
  get screenY(): number {
    return this.y;
  }
  get radius(): number {
    return Tuning.enemies.radius;
  }
}
