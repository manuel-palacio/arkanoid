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
  // Enforce minimum vertical fraction so we never go horizontal.
  const minVert = Tuning.paddle.minVerticalFraction;
  // angle is from straight-up; cos(angle) is the vertical fraction.
  const minAngleFromVert = Math.acos(1 - minVert); // small
  void minAngleFromVert;
  const maxAngleFromVert = Math.acos(minVert); // closer to PI/2
  if (Math.abs(angle) > maxAngleFromVert) angle = Math.sign(angle) * maxAngleFromVert;
  return { x: Math.sin(angle), y: -Math.cos(angle) };
}

/**
 * Reflect against an axis-aligned brick AABB. We pick the side based on the
 * shallowest penetration, which is reliable for non-corner hits and fine for
 * arcade-quality on corners. Returns the new velocity.
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
): { vx: number; vy: number } {
  // Determine entry side from previous position.
  const wasLeft = ballPrevX <= brickLeft;
  const wasRight = ballPrevX >= brickRight;
  const wasAbove = ballPrevY <= brickTop;
  const wasBelow = ballPrevY >= brickBottom;

  // Prefer axis based on previous side. If undecidable, fall back to penetration depths.
  if ((wasLeft && vx > 0) || (wasRight && vx < 0)) {
    return { vx: -vx, vy };
  }
  if ((wasAbove && vy > 0) || (wasBelow && vy < 0)) {
    return { vx, vy: -vy };
  }
  // Edge case: corner. Compute penetration along each axis at impact and pick larger.
  const penX = Math.min(Math.abs(ballX - brickLeft), Math.abs(ballX - brickRight));
  const penY = Math.min(Math.abs(ballY - brickTop), Math.abs(ballY - brickBottom));
  if (penX < penY) return { vx: -vx, vy };
  return { vx, vy: -vy };
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

/** Anti-stuck nudge: if vertical fraction collapsed, restore minimum. */
export function ensureMinVertical(vx: number, vy: number, speed: number): { vx: number; vy: number } {
  const minV = Tuning.paddle.minVerticalFraction;
  const minVy = speed * minV;
  if (Math.abs(vy) >= minVy) return { vx, vy };
  const newVy = nzSign(vy) * minVy;
  // Conserve speed — recompute vx to keep magnitude.
  const remainSq = speed * speed - newVy * newVy;
  const remain = remainSq > 0 ? Math.sqrt(remainSq) : 0;
  return { vx: nzSign(vx) * remain, vy: newVy };
}
