import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';
import { Tuning } from '../config/tuning';

export interface Starfield {
  update(deltaMs: number): void;
  destroy(): void;
}

/**
 * Two parallax star layers drawn via Graphics. Cheap and sufficient — no
 * particle emitter overhead. Stars wrap around the bottom.
 */
export function drawStarfield(scene: Phaser.Scene, opts?: { density?: number }): Starfield {
  const density = opts?.density ?? 1;
  const layers = [
    { count: Math.floor(60 * density), speed: 12, color: 0x6688aa, depth: -100 },
    { count: Math.floor(36 * density), speed: 32, color: 0xbbe0ff, depth: -99 },
  ];
  type Star = { x: number; y: number; sp: number; size: number };
  const layerStars: Star[][] = [];
  const layerObjs: Phaser.GameObjects.Graphics[] = [];

  for (const l of layers) {
    const stars: Star[] = [];
    for (let i = 0; i < l.count; i++) {
      stars.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        sp: l.speed * (0.7 + Math.random() * 0.6),
        size: 1 + (l.speed > 20 ? Math.random() * 1.2 : 0),
      });
    }
    layerStars.push(stars);
    const g = scene.add.graphics({ x: 0, y: 0 }).setDepth(l.depth);
    g.fillStyle(l.color, 1);
    layerObjs.push(g);
  }

  function update(deltaMs: number): void {
    layerObjs.forEach((g, idx) => {
      g.clear();
      const colorEntry = layers[idx];
      if (!colorEntry) return;
      g.fillStyle(colorEntry.color, 1);
      const stars = layerStars[idx] ?? [];
      for (const s of stars) {
        s.y += s.sp * (deltaMs / 1000);
        if (s.y > GAME_HEIGHT) {
          s.y = 0;
          s.x = Math.random() * GAME_WIDTH;
        }
        g.fillRect(s.x, s.y, s.size, s.size);
      }
    });
  }

  function destroy(): void {
    layerObjs.forEach((o) => o.destroy());
  }

  return { update, destroy };
}

/** Brief screen shake on the active camera. */
export function shake(scene: Phaser.Scene, durationMs: number, intensity: number): void {
  scene.cameras.main.shake(durationMs, intensity, false);
}

/** Quick spark burst at (x, y). */
export function spark(scene: Phaser.Scene, x: number, y: number, color: number, count = 10): void {
  const emitter = scene.add.particles(x, y, 'spark', {
    speed: { min: 80, max: 220 },
    angle: { min: 0, max: 360 },
    lifespan: { min: 220, max: 460 },
    scale: { start: 0.9, end: 0 },
    quantity: count,
    blendMode: Phaser.BlendModes.ADD,
    tint: color,
    emitting: false,
  });
  emitter.setDepth(50);
  emitter.explode(count, x, y);
  scene.time.delayedCall(700, () => emitter.destroy());
}

/**
 * Brief pause-on-hit "hit-stop" by zeroing tween/time scale and freezing
 * physics. Uses real-time setTimeout to unfreeze (since we just slowed
 * scene.time itself).
 */
export function hitstop(scene: Phaser.Scene): void {
  const ms = Tuning.effects.hitstopMs;
  scene.tweens.timeScale = 0.001;
  scene.physics.world.isPaused = true;
  window.setTimeout(() => {
    scene.tweens.timeScale = 1;
    scene.physics.world.isPaused = false;
  }, ms);
}
