import { describe, it, expect } from 'vitest';
import {
  brickReflect,
  ensureMinVertical,
  paddleHit,
  paddleReflect,
  wallReflect,
} from '../src/game/systems/CollisionSystem';
import { Tuning } from '../src/game/config/tuning';

describe('paddleReflect', () => {
  it('hitting center sends ball straight up', () => {
    const v = paddleReflect(0);
    expect(v.x).toBeCloseTo(0, 5);
    expect(v.y).toBeCloseTo(-1, 5);
  });

  it('hitting left edge angles ball up-left', () => {
    const v = paddleReflect(-1);
    expect(v.x).toBeLessThan(0);
    expect(v.y).toBeLessThan(0);
  });

  it('hitting right edge angles ball up-right', () => {
    const v = paddleReflect(1);
    expect(v.x).toBeGreaterThan(0);
    expect(v.y).toBeLessThan(0);
  });

  it('clamps offset outside [-1,1]', () => {
    const a = paddleReflect(2);
    const b = paddleReflect(1);
    expect(a.x).toBeCloseTo(b.x, 5);
    expect(a.y).toBeCloseTo(b.y, 5);
  });

  it('never produces a horizontal-only direction', () => {
    for (let off = -1; off <= 1; off += 0.1) {
      const v = paddleReflect(off);
      expect(Math.abs(v.y)).toBeGreaterThan(Tuning.paddle.minVerticalFraction - 0.01);
    }
  });
});

describe('brickReflect', () => {
  it('flips vx when entering from left', () => {
    const r = brickReflect(50, 100, 70, 100, 200, 0, 60, 90, 120, 110);
    expect(r.vx).toBe(-200);
    expect(r.vy).toBe(0);
  });
  it('flips vy when entering from above', () => {
    const r = brickReflect(80, 80, 80, 95, 0, 200, 60, 90, 120, 110);
    expect(r.vy).toBe(-200);
    expect(r.vx).toBe(0);
  });
});

describe('wallReflect', () => {
  it('bounces left wall and clamps position', () => {
    const r = wallReflect(5, 200, -100, 50, 9, 0, 960, 60);
    expect(r.hit).toBe('left');
    expect(r.x).toBe(9);
    expect(r.vx).toBe(100);
  });
  it('bounces top wall', () => {
    const r = wallReflect(400, 65, 50, -200, 9, 0, 960, 60);
    expect(r.hit).toBe('top');
    expect(r.vy).toBe(200);
  });
});

describe('paddleHit', () => {
  // Paddle covers x=[360,480], y=[651,669] (top, bottom). Ball radius 9.
  it('returns null when ball is well above paddle', () => {
    const r = paddleHit(400, 600, 590, 9, 360, 480, 651, 669);
    expect(r).toBeNull();
  });

  it('returns null when ball is below paddle', () => {
    const r = paddleHit(400, 700, 690, 9, 360, 480, 651, 669);
    expect(r).toBeNull();
  });

  it('returns null when ball is moving up (not descending)', () => {
    const r = paddleHit(400, 651, 660, 9, 360, 480, 651, 669);
    expect(r).toBeNull();
  });

  it('returns positive offset for right-of-center hit', () => {
    const r = paddleHit(450, 651, 640, 9, 360, 480, 651, 669);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(0);
    expect(r!).toBeLessThanOrEqual(1);
  });

  it('returns negative offset for left-of-center hit', () => {
    const r = paddleHit(390, 651, 640, 9, 360, 480, 651, 669);
    expect(r).not.toBeNull();
    expect(r!).toBeLessThan(0);
    expect(r!).toBeGreaterThanOrEqual(-1);
  });

  // Regression for issue #1: previously the swept-edge test required
  // prevY+r < paddleTop, which fails when the ball already overlaps the
  // paddle at frame start (e.g. after Phaser's auto-physics teleported it).
  it('catches a ball that starts the frame already inside the paddle', () => {
    const r = paddleHit(420, 660, 658, 9, 360, 480, 651, 669);
    expect(r).not.toBeNull();
  });

  it('catches a fast ball whose center jumps past paddleTop in one frame', () => {
    const r = paddleHit(420, 668, 600, 9, 360, 480, 651, 669);
    expect(r).not.toBeNull();
  });

  it('returns null when ball is to the left of the paddle', () => {
    const r = paddleHit(300, 655, 640, 9, 360, 480, 651, 669);
    expect(r).toBeNull();
  });

  it('returns null when ball is to the right of the paddle', () => {
    const r = paddleHit(540, 655, 640, 9, 360, 480, 651, 669);
    expect(r).toBeNull();
  });
});

describe('ensureMinVertical', () => {
  it('inflates near-zero vy back to minimum vertical fraction', () => {
    const speed = 400;
    const r = ensureMinVertical(400, 5, speed);
    expect(Math.abs(r.vy)).toBeGreaterThan(speed * Tuning.paddle.minVerticalFraction - 1);
    expect(Math.hypot(r.vx, r.vy)).toBeCloseTo(speed, 0);
  });
});
