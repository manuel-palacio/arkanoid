import Phaser from 'phaser';
import { Tuning } from '../config/tuning';
import type { Ball } from '../entities/Ball';

/**
 * Stall guard. Watches the active ball's vertical fraction and rotates
 * its velocity toward vertical when it has been near-horizontal for
 * too long. Engages at any brick count — endless mid-game crawls feel
 * just as tedious as endgame ones.
 *
 * Two-stage gate keeps it out of normal play:
 *   1. The player must have failed to break a brick for at least
 *      `nudgeMinNoBreakMs` (default 2.5 s). If they're making progress,
 *      we never touch the ball.
 *   2. The ball's |vy| / speed must stay under
 *      `verticalFractionThreshold` for `stuckFramesTrigger` consecutive
 *      frames (default 1 s of continuous near-horizontal motion).
 */
export class AntiStuckSystem {
  private stuckFrames = 0;

  /**
   * Per-frame tick. Returns true on the frame a nudge fired so the caller
   * can play visual + audio feedback.
   */
  update(ball: Ball, timeSinceLastBrickMs: number): boolean {
    const cfg = Tuning.antiStall;
    if (ball.isAttached) {
      this.stuckFrames = 0;
      return false;
    }
    // Stage 1 gate: only engage when the player isn't making progress.
    if (timeSinceLastBrickMs < cfg.nudgeMinNoBreakMs) {
      this.stuckFrames = 0;
      return false;
    }
    const speed = ball.speed;
    if (speed <= 0) {
      this.stuckFrames = 0;
      return false;
    }
    const verticalFraction = Math.abs(ball.vy) / speed;
    if (verticalFraction < cfg.verticalFractionThreshold) {
      this.stuckFrames += 1;
    } else {
      this.stuckFrames = 0;
    }
    if (this.stuckFrames >= cfg.stuckFramesTrigger) {
      this.nudge(ball);
      this.stuckFrames = 0;
      return true;
    }
    return false;
  }

  /** Reset counter on level start / ball relaunch. */
  reset(): void {
    this.stuckFrames = 0;
  }

  /** Halfway-to-trigger ratio (0..1) for any UI hint that wants to react. */
  pressureRatio(): number {
    return Math.min(1, this.stuckFrames / Tuning.antiStall.stuckFramesTrigger);
  }

  private nudge(ball: Ball): void {
    const speed = ball.speed;
    if (speed <= 0) return;
    const cfg = Tuning.antiStall;
    const vx = ball.vx;
    const vy = ball.vy;
    const signVx = vx >= 0 ? 1 : -1;
    const signVy = vy >= 0 ? 1 : -1;
    // Angle from whichever vertical the ball is heading toward (up or down):
    // 0 = vertical, π/2 = horizontal. We always rotate toward 0.
    const angleFromVertical = Math.acos(Math.min(1, Math.abs(vy) / speed));
    const nudgeRad = Phaser.Math.DegToRad(cfg.nudgeDeg);
    const newAngle = Math.max(0, angleFromVertical - nudgeRad);
    ball.setVelocity(signVx * Math.sin(newAngle) * speed, signVy * Math.cos(newAngle) * speed);
  }
}
