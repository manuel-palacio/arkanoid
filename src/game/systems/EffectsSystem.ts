import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';
import { Tuning } from '../config/tuning';
import { CANDY, CANDY_ROTATION, lighten } from '../config/palette';
import { prefersReducedMotion } from '../utils/reducedMotion';

export interface Starfield {
  update(deltaMs: number): void;
  setSpeedMultiplier(m: number): void;
  /**
   * Combo / charged-rally progress in [0, 1]. Lerps the background blob
   * tints from their cool grape/blueberry baseline toward hot
   * cherry/white as the player chains hits. Reading this on the HUD is
   * unambiguous; this gives a global "the room is heating up" feel.
   */
  setComboProgress(t: number): void;
  /**
   * Multi-ball turbulence shimmer. When on, the smallest dust layer
   * gets a fast random alpha flicker — reads as "the playfield is
   * about to come apart at the seams".
   */
  setTurbulence(on: boolean): void;
  /**
   * Briefly desaturate the blob tints after a life loss. `t` is the
   * desat amount in [0, 1]; callers tween from 1 → 0 over ~600 ms.
   */
  setDesaturate(t: number): void;
  destroy(): void;
}

/**
 * Candy-arcade background. Replaces the legacy starfield while preserving
 * the same `Starfield` interface so GameScene needs no changes.
 *
 * Layers (back to front):
 *   1. Vertical gradient (CANDY.darkBg → CANDY.shadow), drawn into a 1×H
 *      canvas texture and stretched to playfield width.
 *   2. 2-3 large soft glow blobs ('glow-soft' scaled 3-6×) pulsing slowly
 *      between grape and blueberry tints — dreamy candy-world atmosphere.
 *   3. Three layers of small CANDY-colored dots ("candy dust") drifting
 *      diagonally up-left at ~8 px/sec, low alpha 0.15-0.35.
 */
export function drawStarfield(scene: Phaser.Scene, opts?: { density?: number }): Starfield {
  const density = opts?.density ?? 1;

  // 1) Gradient base.
  const gradKey = 'candy-bg-gradient';
  if (!scene.textures.exists(gradKey)) {
    const tex = scene.textures.createCanvas(gradKey, 1, GAME_HEIGHT);
    if (tex) {
      const ctx = tex.getContext();
      const grad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
      grad.addColorStop(0, '#0d0520');
      grad.addColorStop(1, '#1a0a2e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1, GAME_HEIGHT);
      tex.refresh();
    }
  }
  const bg = scene.add
    .image(0, 0, gradKey)
    .setOrigin(0, 0)
    .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
    .setDepth(-110);

  // 2) Soft glow blobs.
  // Each blob owns a smoothly oscillating tint (grape ↔ blueberry, etc.),
  // a "hot" target tint pushed in by combo progress, and a desaturation
  // amount applied last (life-loss reaction). All three are composed
  // every frame in update() rather than via tweens, so external
  // modulators (combo, desat) don't fight the base oscillation.
  type Blob = {
    img: Phaser.GameObjects.Image;
    tintA: number;
    tintB: number;
    hot: number;
    period: number;
    phase: number;
    alphaA: number;
    alphaB: number;
  };
  const blobCfgs = [
    { x: GAME_WIDTH * 0.22, y: GAME_HEIGHT * 0.28, scale: 5.4, tintA: CANDY.grape, tintB: CANDY.blueberry, hot: CANDY.cherry, alphaA: 0.06, alphaB: 0.1, period: 6200 },
    { x: GAME_WIDTH * 0.78, y: GAME_HEIGHT * 0.55, scale: 4.2, tintA: CANDY.blueberry, tintB: CANDY.grape, hot: CANDY.tangerine, alphaA: 0.07, alphaB: 0.11, period: 7400 },
    { x: GAME_WIDTH * 0.4, y: GAME_HEIGHT * 0.82, scale: 3.6, tintA: CANDY.cherry, tintB: CANDY.grape, hot: CANDY.white, alphaA: 0.05, alphaB: 0.09, period: 5600 },
  ];
  const blobs: Blob[] = blobCfgs.map((c, i) => {
    const img = scene.add
      .image(c.x, c.y, 'glow-soft')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(c.scale)
      .setTint(c.tintA)
      .setAlpha(c.alphaA)
      .setDepth(-105);
    return {
      img,
      tintA: c.tintA,
      tintB: c.tintB,
      hot: c.hot,
      period: c.period,
      // Stagger phases so the three blobs don't pulse in lockstep.
      phase: (i / blobCfgs.length) * c.period,
      alphaA: c.alphaA,
      alphaB: c.alphaB,
    };
  });

  // 3) Candy-dust layers — small CANDY-colored dots drifting up-left.
  type Dust = { x: number; y: number; size: number; color: number; alpha: number };
  const layers = [
    { count: Math.floor(70 * density), speed: 6, sizeRange: [1, 1.6], alphaRange: [0.15, 0.25], depth: -101 },
    { count: Math.floor(38 * density), speed: 12, sizeRange: [1.4, 2.2], alphaRange: [0.22, 0.32], depth: -100 },
    { count: Math.floor(20 * density), speed: 22, sizeRange: [1.8, 2.8], alphaRange: [0.28, 0.4], depth: -99 },
  ];
  const layerDots: Dust[][] = [];
  const layerObjs: Phaser.GameObjects.Graphics[] = [];
  for (const l of layers) {
    const dots: Dust[] = [];
    for (let i = 0; i < l.count; i++) {
      dots.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        size: l.sizeRange[0]! + Math.random() * (l.sizeRange[1]! - l.sizeRange[0]!),
        color: CANDY_ROTATION[Math.floor(Math.random() * CANDY_ROTATION.length)] ?? CANDY.grape,
        alpha: l.alphaRange[0]! + Math.random() * (l.alphaRange[1]! - l.alphaRange[0]!),
      });
    }
    layerDots.push(dots);
    const g = scene.add
      .graphics({ x: 0, y: 0 })
      .setDepth(l.depth)
      .setBlendMode(Phaser.BlendModes.ADD);
    layerObjs.push(g);
  }

  let speedMul = 1;
  let combo = 0;
  let desat = 0;
  let turbulence = false;
  let turbulenceFlicker = 1;
  let elapsedMs = 0;
  const reduced = prefersReducedMotion();

  function lerpChannel(a: number, b: number, t: number): number {
    return Math.round(a + (b - a) * t);
  }

  function lerpColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff;
    const ag = (a >> 8) & 0xff;
    const ab = a & 0xff;
    const br = (b >> 16) & 0xff;
    const bg = (b >> 8) & 0xff;
    const bb = b & 0xff;
    return (lerpChannel(ar, br, t) << 16) | (lerpChannel(ag, bg, t) << 8) | lerpChannel(ab, bb, t);
  }

  function update(deltaMs: number): void {
    elapsedMs += deltaMs;

    // Blobs — base oscillation between tintA/tintB, combo pushes toward
    // hot target, desat finally washes everything toward gray.
    for (const b of blobs) {
      const t = 0.5 - 0.5 * Math.cos((2 * Math.PI * (elapsedMs + b.phase)) / b.period);
      let color = lerpColor(b.tintA, b.tintB, t);
      if (combo > 0) color = lerpColor(color, b.hot, Math.min(1, combo));
      if (desat > 0) {
        const ar = (color >> 16) & 0xff;
        const ag = (color >> 8) & 0xff;
        const ab = color & 0xff;
        const gray = Math.round(0.299 * ar + 0.587 * ag + 0.114 * ab);
        color = (lerpChannel(ar, gray, desat) << 16)
          | (lerpChannel(ag, gray, desat) << 8)
          | lerpChannel(ab, gray, desat);
      }
      b.img.setTint(color);
      // Alpha breathes with the same phase + a small lift on combo so a
      // hot streak feels brighter, not just hotter-colored.
      const baseA = b.alphaA + (b.alphaB - b.alphaA) * t;
      b.img.setAlpha(baseA * (1 + combo * 0.6));
    }

    // Dust layers.
    if (turbulence && !reduced) {
      // Fast random flicker target. Random walk so it doesn't strobe.
      turbulenceFlicker += (Math.random() - 0.5) * 0.6;
      turbulenceFlicker = Math.max(0.55, Math.min(1.0, turbulenceFlicker));
    } else {
      turbulenceFlicker += (1 - turbulenceFlicker) * 0.1;
    }

    layerObjs.forEach((g, idx) => {
      g.clear();
      const conf = layers[idx];
      if (!conf) return;
      const dots = layerDots[idx] ?? [];
      const dt = deltaMs / 1000;
      // Drift diagonally up-left at conf.speed px/sec.
      // Smallest layer (depth -101, idx=0) gets the turbulence multiplier.
      const layerAlphaMul = idx === 0 ? turbulenceFlicker * 0.8 + 0.2 : 1;
      for (const d of dots) {
        d.x -= conf.speed * 0.7 * speedMul * dt;
        d.y -= conf.speed * 0.7 * speedMul * dt;
        if (d.x < -4) {
          d.x = GAME_WIDTH + 4;
          d.y = Math.random() * GAME_HEIGHT;
        }
        if (d.y < -4) {
          d.y = GAME_HEIGHT + 4;
          d.x = Math.random() * GAME_WIDTH;
        }
        g.fillStyle(d.color, d.alpha * layerAlphaMul);
        g.fillCircle(d.x, d.y, d.size);
      }
    });
  }

  function destroy(): void {
    layerObjs.forEach((o) => o.destroy());
    blobs.forEach((b) => {
      scene.tweens.killTweensOf(b.img);
      b.img.destroy();
    });
    bg.destroy();
  }

  function setSpeedMultiplier(m: number): void {
    speedMul = Math.max(0, m);
  }

  function setComboProgress(t: number): void {
    if (reduced) {
      combo = 0;
      return;
    }
    combo = Math.max(0, Math.min(1, t));
  }

  function setTurbulence(on: boolean): void {
    turbulence = on;
  }

  function setDesaturate(t: number): void {
    desat = Math.max(0, Math.min(1, t));
  }

  return { update, destroy, setSpeedMultiplier, setComboProgress, setTurbulence, setDesaturate };
}

/**
 * Side wall glow strips — thin neon gradient bars hugging the inside of
 * the play frame. Adds depth without obscuring gameplay.
 */
export function drawSideGlow(scene: Phaser.Scene, wallThickness: number, hudHeight: number): void {
  const w = 12;
  const top = wallThickness + hudHeight;
  const h = GAME_HEIGHT - top - wallThickness;
  const left = scene.add.rectangle(wallThickness, top, w, h, CANDY.grape).setOrigin(0, 0).setDepth(-80);
  left.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.18);
  const right = scene.add
    .rectangle(GAME_WIDTH - wallThickness - w, top, w, h, CANDY.blueberry)
    .setOrigin(0, 0)
    .setDepth(-80);
  right.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.18);
  scene.tweens.add({
    targets: [left, right],
    alpha: 0.32,
    duration: 2200,
    yoyo: true,
    repeat: -1,
    ease: 'sine.inOut',
  });
}

/** Brief screen shake on the active camera. */
export function shake(scene: Phaser.Scene, durationMs: number, intensity: number): void {
  scene.cameras.main.shake(durationMs, intensity, false);
}

// ----- Spark emitter pool (candy 4-point star) -----

const SCENE_POOL = new WeakMap<Phaser.Scene, Phaser.GameObjects.Particles.ParticleEmitter>();

function getCandySparkEmitter(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
  let e = SCENE_POOL.get(scene);
  if (!e) {
    e = scene.add
      .particles(0, 0, 'spark-candy', {
        speed: { min: 100, max: 280 },
        angle: { min: 0, max: 360 },
        rotate: { min: 0, max: 360 },
        lifespan: { min: 350, max: 600 },
        scale: { start: 1.1, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: 150,
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

/** Candy-style sparkle burst — spinning 4-point stars that fall slightly. */
export function candySpark(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  count = 14,
): void {
  const e = getCandySparkEmitter(scene);
  e.setParticleTint(color);
  e.explode(count, x, y);
}

/** Back-compat alias — old call sites get the upgraded look automatically. */
export function spark(scene: Phaser.Scene, x: number, y: number, color: number, count = 10): void {
  candySpark(scene, x, y, color, count);
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
 * Signature Candy Crush destruction effect: 8 colored shards flying
 * outward (rotating + fading), a colored shockwave ring, and a sparkle
 * cloud. Composes existing primitives so it's the one-stop celebration
 * for "you broke a thing."
 */
export function candyBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
): void {
  // 1) Shards — 8 small rectangles flying outward.
  const neighbors = [color, lighten(color, 0.35), CANDY.white];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
    const dist = 40 + Math.random() * 40;
    const tint = neighbors[i % neighbors.length] ?? color;
    const shard = scene.add
      .rectangle(x, y, 10, 5, tint, 1)
      .setDepth(58)
      .setBlendMode(Phaser.BlendModes.ADD);
    shard.setRotation(Math.random() * Math.PI * 2);
    scene.tweens.add({
      targets: shard,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      rotation: shard.rotation + (Math.random() < 0.5 ? -1 : 1) * Math.PI * 2,
      alpha: 0,
      duration: 400,
      ease: 'Cubic.easeOut',
      onComplete: () => shard.destroy(),
    });
  }
  // 2) Pop ring.
  shockwave(scene, x, y, color, 48);
  // 3) Sparkle cloud — mix of color + white.
  candySpark(scene, x, y, color, 12);
  candySpark(scene, x, y, CANDY.white, 6);
}

/**
 * Fireworks-style level-clear celebration: 12 candy bursts scattered
 * across the upper playfield + a downward rain of candy sparkles +
 * alternating combo flashes for screen-wide rainbow feel.
 */
export function candyCelebration(scene: Phaser.Scene, durationMs = 1600): void {
  const bursts = 12;
  for (let i = 0; i < bursts; i++) {
    const t = (i / bursts) * durationMs + Math.random() * 80;
    const fx = 100 + Math.random() * (GAME_WIDTH - 200);
    const fy = 80 + Math.random() * (GAME_HEIGHT * 0.5);
    const color = CANDY_ROTATION[i % CANDY_ROTATION.length] ?? CANDY.lemon;
    scene.time.delayedCall(t, () => {
      candyBurst(scene, fx, fy, color);
      if (i % 3 === 0) comboFlash(scene, color, 0.2);
    });
  }
  // Rain of candy sparkles falling from the top.
  const rain = scene.add
    .particles(0, 0, 'spark-candy', {
      x: { min: 20, max: GAME_WIDTH - 20 },
      y: -20,
      lifespan: 1400,
      speedY: { min: 200, max: 400 },
      speedX: { min: -30, max: 30 },
      gravityY: 400,
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.9, end: 0 },
      rotate: { min: 0, max: 360 },
      frequency: 40,
      blendMode: Phaser.BlendModes.ADD,
      tint: CANDY_ROTATION,
    })
    .setDepth(190);
  scene.time.delayedCall(durationMs, () => rain.stop());
  scene.time.delayedCall(durationMs + 1500, () => rain.destroy());
}

/** Back-compat alias — old call sites get the upgraded celebration. */
export function fireworks(scene: Phaser.Scene, durationMs = 1400, _bursts = 8): void {
  candyCelebration(scene, durationMs);
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
 * Escalating combo celebration — call from UI when chains hit milestones.
 * Combo levels:
 *   2  : a single candy spark + small "+combo" floater
 *   3  : spark + shockwave + larger floater
 *   4  : candyBurst + grape comboFlash + bigger floater
 *   5+ : candyBurst + cherry comboFlash + 5 staggered rainbow flashes +
 *         huge floater that cycles through CANDY colors
 */
export function comboCandy(
  scene: Phaser.Scene,
  x: number,
  y: number,
  comboCount: number,
): void {
  if (comboCount <= 1) return;
  if (comboCount === 2) {
    candySpark(scene, x, y, CANDY.lemon, 8);
    floatingPoints(scene, x, y, '+COMBO', '#ffd600', 14);
    return;
  }
  if (comboCount === 3) {
    candySpark(scene, x, y, CANDY.tangerine, 12);
    shockwave(scene, x, y, CANDY.tangerine, 36);
    floatingPoints(scene, x, y, 'x3 COMBO', '#ff7a00', 18);
    return;
  }
  if (comboCount === 4) {
    candyBurst(scene, x, y, CANDY.grape);
    comboFlash(scene, CANDY.grape, 0.25);
    floatingPoints(scene, x, y, 'x4 GREAT COMBO', '#aa44ff', 22);
    return;
  }
  // 5+
  candyBurst(scene, x, y, CANDY.cherry);
  comboFlash(scene, CANDY.cherry, 0.35);
  for (let i = 0; i < 5; i++) {
    const c = CANDY_ROTATION[i % CANDY_ROTATION.length] ?? CANDY.lemon;
    scene.time.delayedCall(60 * (i + 1), () => comboFlash(scene, c, 0.18));
  }
  // Rainbow-cycling floater.
  const t = scene.add
    .text(x, y, `x${comboCount} ULTRA COMBO`, {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '26px',
      color: '#ffd600',
      fontStyle: '900',
    })
    .setOrigin(0.5)
    .setDepth(70)
    .setShadow(0, 0, '#ffffff', 14, true, true)
    .setScale(0.5);
  scene.tweens.add({ targets: t, scale: 1.05, duration: 120, ease: 'Back.easeOut' });
  let idx = 0;
  const cycle = scene.time.addEvent({
    delay: 90,
    repeat: 7,
    callback: () => {
      const c = CANDY_ROTATION[idx++ % CANDY_ROTATION.length] ?? CANDY.cherry;
      t.setColor('#' + c.toString(16).padStart(6, '0'));
    },
  });
  scene.tweens.add({
    targets: t,
    y: y - 50,
    alpha: 0,
    duration: 900,
    delay: 200,
    ease: 'Quad.easeOut',
    onComplete: () => {
      cycle.remove();
      t.destroy();
    },
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

/** Pick a candy CSS color string based on the points magnitude. */
export function candyPointsCss(points: number): string {
  if (points >= 500) return '#ff3366'; // cherry — gradient handled at render
  if (points >= 300) return '#ff3366';
  if (points >= 100) return '#ff7a00';
  return '#ffd600';
}

/** Pick a font size based on points (clamped to [14, 22]). */
export function candyPointsSize(points: number): number {
  return Math.max(14, Math.min(22, 14 + Math.floor(points / 200)));
}

/**
 * Floating "+points" text. Begins with a brief scale-up pop, then drifts
 * upward and fades. Optional `points` triggers candy color/size selection
 * (and rainbow alternation for 500+ pts).
 */
export function floatingPoints(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color = '#ffffff',
  size = 14,
  points?: number,
): void {
  let textColor = color;
  let textSize = size;
  let rainbow = false;
  if (points != null) {
    textColor = candyPointsCss(points);
    textSize = candyPointsSize(points);
    if (points >= 500) rainbow = true;
  }
  const t = scene.add
    .text(x, y, text, {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: `${textSize}px`,
      color: textColor,
      fontStyle: '700',
    })
    .setOrigin(0.5)
    .setDepth(70)
    .setShadow(0, 0, textColor, 8, true, true)
    .setScale(0.5);

  // Brief scale-up pop before the drift.
  scene.tweens.add({
    targets: t,
    scale: 1,
    duration: 80,
    ease: 'Back.easeOut',
  });

  // Rainbow alternation for high-value points.
  let cycle: Phaser.Time.TimerEvent | undefined;
  if (rainbow) {
    let i = 0;
    const palette = ['#ff3366', '#aa44ff'];
    cycle = scene.time.addEvent({
      delay: 90,
      repeat: 7,
      callback: () => {
        const c = palette[i++ % palette.length] ?? textColor;
        t.setColor(c);
      },
    });
  }

  scene.tweens.add({
    targets: t,
    y: y - 36,
    alpha: 0,
    duration: 700,
    delay: 80,
    ease: 'Quad.easeOut',
    onComplete: () => {
      cycle?.remove();
      t.destroy();
    },
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
