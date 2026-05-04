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

/**
 * Pool of pre-built spark emitters keyed off the scene. We previously
 * created a fresh `ParticleEmitter` per spark() call, which on a busy
 * frame (multi-ball + 13 brick row) meant a dozen emitters and as many
 * delayedCalls. Now we reuse one emitter per scene and re-tint per call.
 */
const SCENE_POOL = new WeakMap<Phaser.Scene, Phaser.GameObjects.Particles.ParticleEmitter>();

function getSparkEmitter(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
  let e = SCENE_POOL.get(scene);
  if (!e) {
    e = scene.add
      .particles(0, 0, 'spark', {
        speed: { min: 80, max: 220 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 220, max: 460 },
        scale: { start: 0.9, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(50);
    SCENE_POOL.set(scene, e);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      SCENE_POOL.delete(scene);
    });
  }
  return e;
}

/** Quick spark burst at (x, y). Pooled — see getSparkEmitter. */
export function spark(scene: Phaser.Scene, x: number, y: number, color: number, count = 10): void {
  const e = getSparkEmitter(scene);
  e.setParticleTint(color);
  e.explode(count, x, y);
}

/** Expanding ring "shockwave" — used on brick destruction for satisfying juice. */
export function shockwave(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  maxRadius = 56,
): void {
  const ring = scene.add.graphics().setDepth(60);
  ring.lineStyle(2.5, color, 1);
  ring.strokeCircle(0, 0, 1);
  ring.setPosition(x, y);
  scene.tweens.add({
    targets: ring,
    scale: maxRadius,
    alpha: 0,
    duration: 260,
    ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy(),
  });
}

/**
 * Fireworks: spawns N bursts of color-mixed sparks at random positions in
 * the upper playfield, staggered over `durationMs`. Used for level-clear
 * and game-victory celebration.
 */
export function fireworks(scene: Phaser.Scene, durationMs = 1400, bursts = 8): void {
  const colors = [0x9bf2ff, 0xffd23a, 0xff5dab, 0x4af2a1, 0xb96bff, 0xff9f43];
  const e = (scene.add
    .particles(0, 0, 'spark', {
      speed: { min: 120, max: 380 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 600, max: 1100 },
      scale: { start: 1.1, end: 0 },
      alpha: { start: 0.95, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      gravityY: 220,
      emitting: false,
    })
    .setDepth(190)) as Phaser.GameObjects.Particles.ParticleEmitter;
  for (let i = 0; i < bursts; i++) {
    const t = (i / bursts) * durationMs + Math.random() * 80;
    const fx = 120 + Math.random() * (GAME_WIDTH - 240);
    const fy = 100 + Math.random() * (GAME_HEIGHT * 0.45);
    scene.time.delayedCall(t, () => {
      e.setParticleTint(colors[Math.floor(Math.random() * colors.length)] ?? 0xffffff);
      e.explode(28, fx, fy);
    });
  }
  scene.time.delayedCall(durationMs + 1200, () => e.destroy());
}

/** Full-screen color flash for big-chain celebrations. */
export function comboFlash(scene: Phaser.Scene, color: number, alpha = 0.4): void {
  const flash = scene.add
    .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, color, 0)
    .setDepth(180)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: flash,
    fillAlpha: alpha,
    duration: 70,
    yoyo: true,
    hold: 40,
    onComplete: () => flash.destroy(),
  });
}

/**
 * Brief horizontal flare on the paddle's top edge at impact x. Reads as
 * a "kicked" highlight without obscuring the paddle.
 */
export function paddleFlare(scene: Phaser.Scene, x: number, y: number, tint = 0xffffff): void {
  const flare = scene.add
    .ellipse(x, y, 70, 10, tint, 0.85)
    .setDepth(22)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: flare,
    scaleX: 2.2,
    scaleY: 0.4,
    alpha: 0,
    duration: 220,
    ease: 'Quad.easeOut',
    onComplete: () => flare.destroy(),
  });
}

/** Floating "+points" text that drifts up and fades. */
export function floatingPoints(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color = '#ffffff',
  size = 14,
): void {
  const t = scene.add
    .text(x, y, text, {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: `${size}px`,
      color,
      fontStyle: '700',
    })
    .setOrigin(0.5)
    .setDepth(70)
    .setShadow(0, 0, color, 8, true, true);
  scene.tweens.add({
    targets: t,
    y: y - 36,
    alpha: 0,
    duration: 700,
    ease: 'Quad.easeOut',
    onComplete: () => t.destroy(),
  });
}

export interface HitstopHost {
  beginHitstop(ms: number): void;
}

/**
 * Brief pause-on-hit "hit-stop". The ball is driven manually (not by
 * Arcade Physics) so pausing physics.world has no effect — instead we
 * delegate to the scene, which gates its substep loop on a remaining-ms
 * counter. Tweens are also frozen and restored via real-time setTimeout
 * (since we just zeroed the tween clock).
 */
export function hitstop(scene: Phaser.Scene & Partial<HitstopHost>): void {
  const ms = Tuning.effects.hitstopMs;
  if (typeof scene.beginHitstop === 'function') scene.beginHitstop(ms);
  scene.tweens.timeScale = 0;
  window.setTimeout(() => {
    scene.tweens.timeScale = 1;
  }, ms);
}
