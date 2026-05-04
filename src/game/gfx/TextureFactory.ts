import Phaser from 'phaser';
import { Tuning } from '../config/tuning';

/**
 * Procedural texture generator for the candy-arcade overhaul. Draws every
 * sprite as white-base + tintable so a single texture can be reused across
 * many candy colors. Call generateAll() once during PreloadScene.
 *
 * Texture keys it produces:
 *   brick-candy, gem-shine, paddle-candy, ball-candy,
 *   spark-candy, glow-soft, powerup-candy
 */
export class TextureFactory {
  constructor(private scene: Phaser.Scene) {}

  generateAll(): void {
    this.makeBrickTexture();
    this.makeGemShineTexture();
    this.makePaddleTexture();
    this.makeBallTexture();
    this.makeSparkTexture();
    this.makeGlowTexture();
    this.makePowerUpCapsule();
  }

  // ----- Bricks -----

  private makeBrickTexture(): void {
    const w = Tuning.bricks.width;
    const h = Tuning.bricks.height;
    const r = Math.min(6, Math.floor(h / 3));
    const g = this.scene.add.graphics({ x: 0, y: 0 });

    // 1) Base rounded rect — white so the brick can be tinted at runtime.
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, w, h, r);

    // 2) Inner shadow (subtle dark inset rect, alpha 0.35).
    g.fillStyle(0x000000, 0.18);
    g.fillRoundedRect(2, 2, w - 4, h - 4, Math.max(2, r - 2));

    // Re-fill the inset with white so the inner shadow only reads as a thin
    // edge, then we layer highlights on top.
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(2.5, 2.5, w - 5, h - 5, Math.max(2, r - 2));

    // 3) Top specular highlight — wide bright ellipse.
    const hiW = w * 0.46;
    const hiH = h * 0.32;
    g.fillStyle(0xffffff, 0.65);
    g.fillEllipse(w / 2, h * 0.28, hiW, hiH);

    // 4) Side gradient — left edge brighter, right edge darker (faked via
    //    thin alpha bars).
    g.fillStyle(0xffffff, 0.18);
    g.fillRoundedRect(2, 2, Math.max(3, w * 0.18), h - 4, Math.max(2, r - 2));
    g.fillStyle(0x000000, 0.12);
    g.fillRoundedRect(w - Math.max(3, w * 0.18) - 2, 2, Math.max(3, w * 0.18), h - 4, Math.max(2, r - 2));

    // 5) Bottom rim — thin darker strip.
    g.fillStyle(0x000000, 0.32);
    g.fillRoundedRect(3, h - 3, w - 6, 2, 1);

    g.generateTexture('brick-candy', w, h);
    g.destroy();
  }

  private makeGemShineTexture(): void {
    const w = Tuning.bricks.width;
    const h = Tuning.bricks.height;
    const g = this.scene.add.graphics({ x: 0, y: 0 });

    // Wide top-center ellipse (the gem highlight).
    g.fillStyle(0xffffff, 0.7);
    g.fillEllipse(w / 2, h * 0.32, w * 0.48, h * 0.34);

    // Tiny 4-point sparkle star at top-left.
    const sx = w * 0.22;
    const sy = h * 0.28;
    const arm = Math.min(w, h) * 0.16;
    g.fillStyle(0xffffff, 0.95);
    // diamond (4 points)
    g.fillTriangle(sx, sy - arm, sx - arm * 0.4, sy, sx + arm * 0.4, sy);
    g.fillTriangle(sx, sy + arm, sx - arm * 0.4, sy, sx + arm * 0.4, sy);
    g.fillCircle(sx, sy, arm * 0.32);

    g.generateTexture('gem-shine', w, h);
    g.destroy();
  }

  // ----- Paddle -----

  private makePaddleTexture(): void {
    const w = Tuning.paddle.maxWidth;
    const h = Tuning.paddle.height;
    const r = h / 2;
    const g = this.scene.add.graphics({ x: 0, y: 0 });

    // 1) Base capsule — white, tintable.
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, w, h, r);

    // 2) Top specular ellipse (wide).
    g.fillStyle(0xffffff, 0.6);
    g.fillEllipse(w / 2, h * 0.28, w * 0.7, h * 0.45);

    // 3) End-cap brighter semicircles.
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(r + 1, h / 2, r * 0.55);
    g.fillCircle(w - r - 1, h / 2, r * 0.55);

    // 4) Bottom reflection — thin blue-white strip.
    g.fillStyle(0xaaddff, 0.28);
    g.fillRoundedRect(r, h - 3, w - r * 2, 2, 1);

    // 5) Subtle dark rim at very bottom for shape.
    g.fillStyle(0x000000, 0.18);
    g.fillRoundedRect(2, h - 1.5, w - 4, 1, 0.5);

    g.generateTexture('paddle-candy', w, h);
    g.destroy();
  }

  // ----- Ball -----

  private makeBallTexture(): void {
    // Texture diameter must match 2 * ball radius so collision (setCircle)
    // remains aligned with the visible sprite. We add a transparent halo
    // pad around it so the soft glow can extend without clipping.
    const r = Tuning.ball.radius;
    const pad = 4;
    const size = (r + pad) * 2;
    const tex = this.scene.textures.createCanvas('ball-candy', size, size);
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size / 2;

    // Outer soft glow halo (additive at use-site).
    const halo = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r + pad);
    halo.addColorStop(0, 'rgba(255,255,255,0.4)');
    halo.addColorStop(0.55, 'rgba(255,255,255,0.18)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, r + pad, 0, Math.PI * 2);
    ctx.fill();

    // Body — radial gradient from bright center to slightly dim edge so the
    // ball reads as a glossy candy sphere when tinted.
    const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.15, cx, cy, r);
    body.addColorStop(0, 'rgba(255,255,255,1)');
    body.addColorStop(0.55, 'rgba(255,255,255,1)');
    body.addColorStop(0.85, 'rgba(210,210,220,1)');
    body.addColorStop(1, 'rgba(160,160,180,1)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Specular highlight at top-left.
    const spec = ctx.createRadialGradient(
      cx - r * 0.35,
      cy - r * 0.4,
      0,
      cx - r * 0.35,
      cy - r * 0.4,
      r * 0.55,
    );
    spec.addColorStop(0, 'rgba(255,255,255,0.95)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.4, r * 0.55, 0, Math.PI * 2);
    ctx.fill();

    tex.refresh();
  }

  // ----- Spark / Glow -----

  private makeSparkTexture(): void {
    // 4-pointed candy star — elongated diamond points radiating from center.
    const size = 16;
    const cx = size / 2;
    const cy = size / 2;
    const tex = this.scene.textures.createCanvas('spark-candy', size, size);
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, size, size);

    // Soft halo behind the star so its color blooms on additive blend.
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
    halo.addColorStop(0, 'rgba(255,255,255,0.7)');
    halo.addColorStop(0.5, 'rgba(255,255,255,0.18)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, size, size);

    // 4-pointed diamond — bright white core.
    ctx.fillStyle = 'rgba(255,255,255,1)';
    const arm = size * 0.46;
    const waist = size * 0.12;
    ctx.beginPath();
    ctx.moveTo(cx, cy - arm); // top
    ctx.lineTo(cx + waist, cy); // right inner
    ctx.lineTo(cx + arm, cy); // right tip
    ctx.lineTo(cx + waist, cy); // back
    ctx.lineTo(cx, cy + arm); // bottom
    ctx.lineTo(cx - waist, cy);
    ctx.lineTo(cx - arm, cy); // left tip
    ctx.lineTo(cx - waist, cy);
    ctx.closePath();
    ctx.fill();

    // Cleaner two-triangle stars (the path above is a single closed shape
    // that ends up as a bowtie — overdraw the four-point star explicitly).
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - arm);
    ctx.lineTo(cx + waist, cy - waist);
    ctx.lineTo(cx + arm, cy);
    ctx.lineTo(cx + waist, cy + waist);
    ctx.lineTo(cx, cy + arm);
    ctx.lineTo(cx - waist, cy + waist);
    ctx.lineTo(cx - arm, cy);
    ctx.lineTo(cx - waist, cy - waist);
    ctx.closePath();
    ctx.fill();

    // Tiny bright pinpoint at the center.
    const pin = ctx.createRadialGradient(cx, cy, 0, cx, cy, 2);
    pin.addColorStop(0, 'rgba(255,255,255,1)');
    pin.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = pin;
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();

    tex.refresh();
  }

  private makeGlowTexture(): void {
    const size = 64;
    const cx = size / 2;
    const cy = size / 2;
    const tex = this.scene.textures.createCanvas('glow-soft', size, size);
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, size, size);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fill();
    tex.refresh();
  }

  // ----- PowerUp -----

  private makePowerUpCapsule(): void {
    const w = Tuning.powerups.width;
    const h = Tuning.powerups.height;
    const r = h / 2;
    const g = this.scene.add.graphics({ x: 0, y: 0 });

    // 1) Base capsule — white, tintable.
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, w, h, r);

    // 2) Two-tone left/right halves (left a touch brighter).
    g.fillStyle(0xffffff, 0.22);
    g.fillRoundedRect(0, 0, w / 2, h, r);
    g.fillStyle(0x000000, 0.12);
    g.fillRoundedRect(w / 2, 0, w / 2, h, r);

    // 3) Top specular strip (thin bright ellipse spanning the capsule).
    g.fillStyle(0xffffff, 0.6);
    g.fillEllipse(w / 2, h * 0.32, w * 0.78, h * 0.5);

    // 4) Subtle bottom shadow line.
    g.fillStyle(0x000000, 0.2);
    g.fillRoundedRect(r, h - 1.6, w - r * 2, 1, 0.5);

    g.generateTexture('powerup-candy', w, h);
    g.destroy();
  }
}
