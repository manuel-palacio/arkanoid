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

  // Slab method: per-axis compute the earliest (`tNear`) and latest
  // (`tFar`) times the segment is inside the slab. The segment enters
  // the AABB at max(txNear, tyNear) — the LATER of the two — and exits
  // at min(txFar, tyFar). The axis whose tNear == entry is the entry
  // axis. Picking the earliest crossing instead (as the prior version
  // did) is wrong on grazing hits: the segment can cross the X slab
  // before the Y slab while still being above the brick — entering on
  // the Y axis, not the X.
  let txNear: number;
  let txFar: number;
  if (Math.abs(dx) > 1e-9) {
    const t1 = (left - ballPrevX) / dx;
    const t2 = (right - ballPrevX) / dx;
    txNear = Math.min(t1, t2);
    txFar = Math.max(t1, t2);
  } else {
    // Stationary on X — already inside or always outside the X slab.
    if (ballPrevX >= left && ballPrevX <= right) {
      txNear = Number.NEGATIVE_INFINITY;
      txFar = Number.POSITIVE_INFINITY;
    } else {
      txNear = Number.POSITIVE_INFINITY;
      txFar = Number.NEGATIVE_INFINITY;
    }
  }
  let tyNear: number;
  let tyFar: number;
  if (Math.abs(dy) > 1e-9) {
    const t1 = (top - ballPrevY) / dy;
    const t2 = (bottom - ballPrevY) / dy;
    tyNear = Math.min(t1, t2);
    tyFar = Math.max(t1, t2);
  } else {
    if (ballPrevY >= top && ballPrevY <= bottom) {
      tyNear = Number.NEGATIVE_INFINITY;
      tyFar = Number.POSITIVE_INFINITY;
    } else {
      tyNear = Number.POSITIVE_INFINITY;
      tyFar = Number.NEGATIVE_INFINITY;
    }
  }
  const entry = Math.max(txNear, tyNear);
  const exitT = Math.min(txFar, tyFar);

  let newVx = vx;
  let newVy = vy;
  let pushX = 0;
  let pushY = 0;

  // Valid intersection: entry within [0, 1], entry <= exitT.
  if (entry <= exitT && entry <= 1 && exitT >= 0) {
    // Entry axis = whichever near is larger (tightest constraint).
    if (txNear > tyNear) {
      // X axis. dx>0 → entered from left face; dx<0 → right face.
      newVx = -vx;
      pushX = (dx > 0 ? left : right) - ballX;
    } else {
      newVy = -vy;
      pushY = (dy > 0 ? top : bottom) - ballY;
    }
    return { vx: newVx, vy: newVy, pushX, pushY };
  }

  // Fallback: ball started this frame already inside the expanded AABB
  // (slow-motion, teleport, or stale prev). Use shallowest-penetration:
  // the axis on which the ball is closest to a face is the axis it
  // most likely just crossed, so reflect there and push it back out.
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
