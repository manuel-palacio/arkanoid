import Phaser from 'phaser';
import { Tuning } from '../config/tuning';

/**
 * Procedurally generates all game textures using Graphics.generateTexture().
 * Call once during PreloadScene.create(). All art is original — no bitmaps
 * loaded from disk.
 */
export function generateTextures(scene: Phaser.Scene): void {
  generateBrickTextures(scene);
  generatePaddleTextures(scene);
  generateBallTexture(scene);
  generatePowerUpTextures(scene);
  generateLaserTexture(scene);
  generateParticle(scene);
  generateStar(scene);
}

function rounded(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r: number) {
  g.fillRoundedRect(x, y, w, h, r);
}

function generateBrickTextures(scene: Phaser.Scene): void {
  const bw = Tuning.bricks.width;
  const bh = Tuning.bricks.height;

  const palettes: Array<{ key: string; body: number; edge: number; glow: number }> = [
    { key: 'brick-standard', body: 0x4ad6ff, edge: 0x0a8db8, glow: 0xb6f0ff },
    { key: 'brick-tough', body: 0xff6a3d, edge: 0xa83110, glow: 0xffd1bb },
    { key: 'brick-hard', body: 0xb96bff, edge: 0x6325a0, glow: 0xe9c8ff },
    { key: 'brick-indestructible', body: 0x6a7280, edge: 0x2a3038, glow: 0xc8cdd4 },
    { key: 'brick-special', body: 0xffd23a, edge: 0xa17500, glow: 0xfff0aa },
  ];

  for (const p of palettes) {
    const g = scene.add.graphics({ x: 0, y: 0 });
    // shadow / outer edge
    g.fillStyle(p.edge, 1);
    rounded(g, 0, 0, bw, bh, 4);
    // body inset
    g.fillStyle(p.body, 1);
    rounded(g, 2, 2, bw - 4, bh - 4, 3);
    // top highlight strip
    g.fillStyle(p.glow, 0.55);
    g.fillRect(4, 4, bw - 8, 3);
    // diagonal sheen
    g.fillStyle(0xffffff, 0.08);
    g.fillTriangle(2, 2, 18, 2, 2, bh - 2);
    g.generateTexture(p.key, bw, bh);
    g.destroy();
  }

  // damaged states (overlay cracks). We use additive overlay via a separate small texture.
  const cg = scene.add.graphics({ x: 0, y: 0 });
  cg.lineStyle(1.4, 0x000000, 0.55);
  cg.lineBetween(6, 4, bw - 8, bh - 6);
  cg.lineBetween(bw - 18, 4, 8, bh - 6);
  cg.lineBetween(bw / 2, 2, bw / 2 - 6, bh - 2);
  cg.generateTexture('brick-cracks', bw, bh);
  cg.destroy();
}

function generatePaddleTextures(scene: Phaser.Scene): void {
  // Generated at maxWidth so we can crop/scale visually.
  const w = Tuning.paddle.maxWidth;
  const h = Tuning.paddle.height;
  const g = scene.add.graphics({ x: 0, y: 0 });
  // base
  g.fillStyle(0x0e1530, 1);
  rounded(g, 0, 0, w, h, h / 2);
  // body gradient (faked)
  g.fillStyle(Tuning.paddle.color, 1);
  rounded(g, 2, 2, w - 4, h - 4, (h - 4) / 2);
  // accent stripe
  g.fillStyle(Tuning.paddle.accentColor, 0.5);
  g.fillRect(8, 4, w - 16, 2);
  // tip caps
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(8, h / 2, 3);
  g.fillCircle(w - 8, h / 2, 3);
  g.generateTexture('paddle-base', w, h);
  g.destroy();

  // laser-mode paddle accent
  const g2 = scene.add.graphics({ x: 0, y: 0 });
  g2.fillStyle(0x0e1530, 1);
  rounded(g2, 0, 0, w, h, h / 2);
  g2.fillStyle(0xff5dab, 1);
  rounded(g2, 2, 2, w - 4, h - 4, (h - 4) / 2);
  g2.fillStyle(0xffffff, 0.6);
  g2.fillRect(8, 4, w - 16, 2);
  g2.fillStyle(0xffffff, 0.95);
  // gun barrels
  g2.fillRect(6, -3, 4, 4);
  g2.fillRect(w - 10, -3, 4, 4);
  g2.generateTexture('paddle-laser', w, h);
  g2.destroy();
}

function generateBallTexture(scene: Phaser.Scene): void {
  const r = Tuning.ball.radius;
  const d = r * 2;
  const g = scene.add.graphics({ x: 0, y: 0 });
  g.fillStyle(0xffffff, 1);
  g.fillCircle(r, r, r);
  g.fillStyle(0x9bf2ff, 0.65);
  g.fillCircle(r - 2, r - 2, r * 0.55);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(r - 3, r - 3, r * 0.25);
  g.generateTexture('ball', d, d);
  g.destroy();
}

function generatePowerUpTextures(scene: Phaser.Scene): void {
  const w = Tuning.powerups.width;
  const h = Tuning.powerups.height;
  const defs: Array<{ key: string; color: number; glyph: string }> = [
    { key: 'pu-expand', color: 0x4af2a1, glyph: 'E' },
    { key: 'pu-shrink', color: 0xff5d6c, glyph: 'S' },
    { key: 'pu-slow', color: 0x4ad6ff, glyph: 'L' },
    { key: 'pu-multi', color: 0xffd23a, glyph: 'M' },
    { key: 'pu-sticky', color: 0xb96bff, glyph: 'C' },
    { key: 'pu-laser', color: 0xff5dab, glyph: 'F' },
    { key: 'pu-life', color: 0xffffff, glyph: '+' },
  ];
  for (const d of defs) {
    const g = scene.add.graphics({ x: 0, y: 0 });
    g.fillStyle(0x0a0a18, 1);
    rounded(g, 0, 0, w, h, h / 2);
    g.fillStyle(d.color, 1);
    rounded(g, 2, 2, w - 4, h - 4, (h - 4) / 2);
    g.fillStyle(0xffffff, 0.7);
    g.fillRect(6, 4, w - 12, 1.5);
    g.generateTexture(d.key, w, h);
    g.destroy();

    // Glyph rendered separately as small text-like badge (shape-only so no fonts needed).
    const gg = scene.add.graphics({ x: 0, y: 0 });
    gg.fillStyle(0x0a0a18, 1);
    gg.fillCircle(8, 8, 7);
    gg.fillStyle(d.color, 1);
    gg.fillCircle(8, 8, 6);
    gg.generateTexture(`${d.key}-badge`, 16, 16);
    gg.destroy();

    // Cache glyph for HUD use elsewhere.
    (scene.registry.get('puGlyphs') as Record<string, string> | undefined)?.[d.key];
  }
}

function generateLaserTexture(scene: Phaser.Scene): void {
  const g = scene.add.graphics({ x: 0, y: 0 });
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, Tuning.laser.width, Tuning.laser.height);
  g.fillStyle(Tuning.laser.color, 1);
  g.fillRect(0, 2, Tuning.laser.width, Tuning.laser.height - 4);
  g.generateTexture('laser', Tuning.laser.width, Tuning.laser.height);
  g.destroy();
}

function generateParticle(scene: Phaser.Scene): void {
  const g = scene.add.graphics({ x: 0, y: 0 });
  g.fillStyle(0xffffff, 1);
  g.fillCircle(4, 4, 4);
  g.generateTexture('spark', 8, 8);
  g.destroy();
}

function generateStar(scene: Phaser.Scene): void {
  const g = scene.add.graphics({ x: 0, y: 0 });
  g.fillStyle(0xffffff, 1);
  g.fillCircle(1, 1, 1);
  g.generateTexture('star', 2, 2);
  g.destroy();
}
