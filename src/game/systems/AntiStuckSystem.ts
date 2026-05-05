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
 *      `nudgeMinNoBreakMs` (default 1.2 s). If they're making progress,
 *      we never touch the ball.
 *   2. The ball's |vy| / speed must stay under
 *      `verticalFractionThreshold` for `stuckFramesTrigger` consecutive
 *      frames (default 0.5 s of continuous near-horizontal motion).
 *
 * After a nudge, the system watches `postNudgeWatchFrames` more frames
 * and fires a stronger second nudge if the ball settled into another
 * flat trajectory — corridor escapes that don't catch on the first
 * nudge get caught here.
 *
 * Separately, the danger clock starts counting once the player has
 * been stuck for `dangerShowAfterMs`. If it elapses
 * `dangerDurationMs` later, the host should kill the ball — same flow
 * as a regular drop. The countdown is visible to the player so they
 * have agency to react.
 */
export class AntiStuckSystem {
  private stuckFrames = 0;
  private postNudgeFrames = 0;
  private dangerClockStartMs: number | null = null;

  /**
   * Per-frame tick. Returns true on the frame a nudge fired so the caller
   * can play visual + audio feedback.
   */
  update(ball: Ball, timeSinceLastBrickMs: number): boolean {
    const cfg = Tuning.antiStall;
    if (ball.isAttached) {
      this.stuckFrames = 0;
      this.postNudgeFrames = 0;
      return false;
    }
    const speed = ball.speed;
    if (speed <= 0) {
      this.stuckFrames = 0;
      return false;
    }

    // Stage 0: post-nudge watch — if the first nudge didn't break the
    // pattern, fire a stronger second nudge after a short cooldown.
    if (this.postNudgeFrames > 0) {
      this.postNudgeFrames -= 1;
      if (this.postNudgeFrames === 0) {
        const verticalFraction = Math.abs(ball.vy) / speed;
        if (verticalFraction < cfg.verticalFractionThreshold) {
          this.nudge(ball, cfg.nudgeDeg * 1.5);
          // Don't queue a third nudge — at this point one of the
          // other tiers (rescue drop, danger clock) should take over.
          return true;
        }
      }
      return false;
    }

    // Stage 1 gate: only engage when the player isn't making progress.
    if (timeSinceLastBrickMs < cfg.nudgeMinNoBreakMs) {
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
      this.postNudgeFrames = cfg.postNudgeWatchFrames;
      return true;
    }
    return false;
  }

  /**
   * Returns 0 (no danger), a 0..1 progress fraction (countdown visible),
   * or -1 (kill the ball now). Caller is responsible for emitting the
   * UI event and, when -1 is returned, draining a life.
   */
  getDangerLevel(timeSinceLastBrickMs: number, nowMs: number): number {
    const cfg = Tuning.antiStall;
    if (timeSinceLastBrickMs < cfg.dangerShowAfterMs) {
      this.dangerClockStartMs = null;
      return 0;
    }
    if (this.dangerClockStartMs === null) {
      this.dangerClockStartMs = nowMs;
    }
    const elapsed = nowMs - this.dangerClockStartMs;
    if (elapsed >= cfg.dangerDurationMs) return -1;
    return elapsed / cfg.dangerDurationMs;
  }

  /** Called by GameScene on brick break or any other "progress" signal. */
  resetDangerClock(): void {
    this.dangerClockStartMs = null;
  }

  /** Reset every counter — level start / ball relaunch. */
  reset(): void {
    this.stuckFrames = 0;
    this.postNudgeFrames = 0;
    this.dangerClockStartMs = null;
  }

  /** Halfway-to-trigger ratio (0..1) for any UI hint that wants to react. */
  pressureRatio(): number {
    return Math.min(1, this.stuckFrames / Tuning.antiStall.stuckFramesTrigger);
  }

  private nudge(ball: Ball, degOverride?: number): void {
    const speed = ball.speed;
    if (speed <= 0) return;
    const deg = degOverride ?? Tuning.antiStall.nudgeDeg;
    const vx = ball.vx;
    const vy = ball.vy;
    const signVx = vx >= 0 ? 1 : -1;
    const signVy = vy >= 0 ? 1 : -1;
    const angleFromVertical = Math.acos(Math.min(1, Math.abs(vy) / speed));
    const nudgeRad = Phaser.Math.DegToRad(deg);
    const newAngle = Math.max(0, angleFromVertical - nudgeRad);
    ball.setVelocity(signVx * Math.sin(newAngle) * speed, signVy * Math.cos(newAngle) * speed);
  }
}
