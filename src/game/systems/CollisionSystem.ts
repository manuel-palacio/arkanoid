import { Tuning } from '../config/tuning';
import { clamp, DEG, nzSign } from '../utils/math';

/**
 * Custom paddle-zone reflection. The outgoing angle is determined ONLY by
 * where the ball hit relative to the paddle center, NOT by the incoming
 * velocity. This is the canonical Arkanoid-style trick that prevents
 * vertical-lock loops and gives the player meaningful control.
 *
 * `hitOffset` is in [-1, 1] (left edge = -1, center = 0, right edge = +1).
 * Returns a unit vector for the new direction.
 */
export function paddleReflect(hitOffset: number, jitterDeg = 0): { x: number; y: number } {
  const off = clamp(hitOffset, -1, 1);
  const maxA = Tuning.paddle.maxBounceAngle;
  // Steeper near edges, shallow near center.
  let angle = off * maxA + jitterDeg * DEG;
  // Cap maximum deviation from vertical so we never exit at >max angle.
  // The minimum (anti-horizontal) bound is enforced post-reflection by
  // ensureMinVertical, which clamps |vy| to a fraction of the speed.
  const maxAngleFromVert = Math.acos(Tuning.paddle.minVerticalFraction);
  if (Math.abs(angle) > maxAngleFromVert) angle = Math.sign(angle) * maxAngleFromVert;
  return { x: Math.sin(angle), y: -Math.cos(angle) };
}

/**
 * Reflect against an axis-aligned brick AABB. Uses a continuous swept
 * segment test (prev → cur) against the brick's edges expanded by the
 * ball radius — robust at high speeds where the ball can travel more
 * than its own diameter in one frame and skip the prev/cur side test
 * entirely. Falls back to a penetration-depth test if the ball started
 * the frame already inside the expanded AABB (slow-motion / teleport).
 *
 * Returns the new velocity AND the depenetration push (`pushX`,
 * `pushY`) the caller must apply to the ball position so it ends up
 * fully outside the brick after this frame — without it, on the next
 * frame the ball is still overlapping and the same reflection fires
 * again, locking the ball into the brick (issue #36).
 */
export function brickReflect(
  ballPrevX: number,
  ballPrevY: number,
  ballX: number,
  ballY: number,
  vx: number,
  vy: number,
  brickLeft: number,
  brickTop: number,
  brickRight: number,
  brickBottom: number,
  radius: number,
): { vx: number; vy: number; pushX: number; pushY: number } {
  // Brick AABB expanded by the ball radius — circle vs AABB collapses
  // to point vs expanded AABB.
  const left = brickLeft - radius;
  const right = brickRight + radius;
  const top = brickTop - radius;
  const bottom = brickBottom + radius;

  const dx = ballX - ballPrevX;
  const dy = ballY - ballPrevY;

  // Find the earliest slab entry within [0, 1].
  let tMin = Number.POSITIVE_INFINITY;
  let hitAxis: 'x' | 'y' = 'y';
  let hitSign = 1;
  if (Math.abs(dx) > 1e-9) {
    const tL = (left - ballPrevX) / dx;
    const tR = (right - ballPrevX) / dx;
    if (tL >= 0 && tL <= 1 && tL < tMin) {
      tMin = tL;
      hitAxis = 'x';
      hitSign = 1; // entered from the LEFT face
    }
    if (tR >= 0 && tR <= 1 && tR < tMin) {
      tMin = tR;
      hitAxis = 'x';
      hitSign = -1; // entered from the RIGHT face
    }
  }
  if (Math.abs(dy) > 1e-9) {
    const tT = (top - ballPrevY) / dy;
    const tB = (bottom - ballPrevY) / dy;
    if (tT >= 0 && tT <= 1 && tT < tMin) {
      tMin = tT;
      hitAxis = 'y';
      hitSign = 1; // entered from the TOP face
    }
    if (tB >= 0 && tB <= 1 && tB < tMin) {
      tMin = tB;
      hitAxis = 'y';
      hitSign = -1; // entered from the BOTTOM face
    }
  }

  let newVx = vx;
  let newVy = vy;
  let pushX = 0;
  let pushY = 0;

  if (tMin !== Number.POSITIVE_INFINITY) {
    if (hitAxis === 'x') {
      newVx = -vx;
      // Push ball center to outside-of-face along the X axis.
      pushX = (hitSign > 0 ? left : right) - ballX;
    } else {
      newVy = -vy;
      pushY = (hitSign > 0 ? top : bottom) - ballY;
    }
    return { vx: newVx, vy: newVy, pushX, pushY };
  }

  // Fallback: ball started this frame already inside the expanded AABB
  // (slow-motion, teleport, or stale prev). Use shallowest-penetration.
  const penLeft = ballX - left;
  const penRight = right - ballX;
  const penTop = ballY - top;
  const penBottom = bottom - ballY;
  const minPenX = Math.min(penLeft, penRight);
  const minPenY = Math.min(penTop, penBottom);
  if (minPenX < minPenY) {
    newVx = -vx;
    pushX = penLeft < penRight ? -penLeft : penRight;
  } else {
    newVy = -vy;
    pushY = penTop < penBottom ? -penTop : penBottom;
  }
  return { vx: newVx, vy: newVy, pushX, pushY };
}

/**
 * Wall reflection. World is bounded by [wallLeft, wallRight] x and walls only
 * at top (no floor wall — losing the ball costs a life).
 */
export function wallReflect(
  x: number,
  y: number,
  vx: number,
  vy: number,
  radius: number,
  wallLeft: number,
  wallRight: number,
  wallTop: number,
): { x: number; y: number; vx: number; vy: number; hit: 'left' | 'right' | 'top' | null } {
  if (x - radius <= wallLeft && vx < 0) {
    return { x: wallLeft + radius, y, vx: -vx, vy, hit: 'left' };
  }
  if (x + radius >= wallRight && vx > 0) {
    return { x: wallRight - radius, y, vx: -vx, vy, hit: 'right' };
  }
  if (y - radius <= wallTop && vy < 0) {
    return { x, y: wallTop + radius, vx, vy: -vy, hit: 'top' };
  }
  return { x, y, vx, vy, hit: null };
}

/**
 * Returns where the ball hit on the paddle as offset in [-1,1], or null if
 * no hit this frame. Caller is responsible for repositioning the ball above
 * the paddle and applying paddleReflect's vector.
 *
 * Uses an AABB overlap test (ball circle vs. paddle rectangle) gated on the
 * ball moving downward or staying still. A swept-edge test was previously
 * used here but failed at high speeds and when the ball started a frame
 * already overlapping the paddle's top edge — see issue #1.
 */
export function paddleHit(
  ballX: number,
  ballY: number,
  ballPrevY: number,
  radius: number,
  paddleLeft: number,
  paddleRight: number,
  paddleTop: number,
  paddleBottom: number,
): number | null {
  const overlapsX = ballX + radius > paddleLeft && ballX - radius < paddleRight;
  const overlapsY = ballY + radius > paddleTop && ballY - radius < paddleBottom;
  const descending = ballY >= ballPrevY;
  if (!overlapsX || !overlapsY || !descending) return null;
  const cx = (paddleLeft + paddleRight) / 2;
  const half = (paddleRight - paddleLeft) / 2;
  return clamp((ballX - cx) / half, -1, 1);
}

/**
 * Anti-stuck nudge: enforce both a minimum vertical fraction (so the ball
 * never crawls horizontally) and a maximum horizontal fraction (so it
 * never pins to a wall). Re-normalizes to the input speed so polynomial
 * speedup logic stays unaffected. Safe to call after any reflection.
 */
export function ensureMinVertical(vx: number, vy: number, speed: number): { vx: number; vy: number } {
  if (speed <= 0) return { vx, vy };
  const minV = Tuning.paddle.minVerticalFraction;
  const maxH = Tuning.paddle.maxHorizontalFraction;

  let newVx = vx;
  let newVy = vy;

  // Clamp horizontal component first.
  const maxVx = speed * maxH;
  if (Math.abs(newVx) > maxVx) newVx = nzSign(newVx) * maxVx;

  // Then ensure minimum vertical magnitude (keeping its sign).
  const minVy = speed * minV;
  if (Math.abs(newVy) < minVy) newVy = nzSign(newVy) * minVy;

  // Re-normalize back to the input speed so we don't change ball energy.
  const mag = Math.hypot(newVx, newVy);
  if (mag > 0) {
    const scale = speed / mag;
    newVx *= scale;
    newVy *= scale;
  }
  return { vx: newVx, vy: newVy };
}
