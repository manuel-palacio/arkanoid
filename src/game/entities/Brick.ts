import Phaser from 'phaser';
import { Tuning } from '../config/tuning';
import { BRICK_CANDY_COLORS, desaturate, lighten } from '../config/palette';
import type { BrickArchetype } from '../types';

/**
 * Visual + state container for a single brick. Holds an Arcade Physics image
 * (used only for spatial bookkeeping; collision response is custom).
 *
 * Visuals: a glossy candy sprite ('brick-candy') tinted at runtime, with a
 * 'gem-shine' overlay layered above for the specular sparkle. Both layers
 * scale together for entrance pop, hit squish, and destruction pop.
 */
export class Brick {
  readonly sprite: Phaser.Physics.Arcade.Image;
  readonly archetype: BrickArchetype;
  hp: number;
  alive = true;
  private cracksOverlay?: Phaser.GameObjects.Image;
  private shineOverlay?: Phaser.GameObjects.Image;
  private destroying = false;
  /** REGEN: ms since last hit; heals 1 HP every 4 s. */
  private regenAccumMs = 0;
  /** INVISIBLE: smoothed alpha tracker (0 hidden, 1 visible). */
  private revealAlpha = 0;
  /** INVISIBLE: ms since the ball was within reveal range. */
  private revealHoldMs = 0;
  /**
   * WARDEN linkage. When set on a non-warden brick, all damage is
   * blocked while the linked warden is alive. Cleared naturally when
   * the warden dies (its `alive` flag flips → check returns false).
   */
  wardedBy: Brick | null = null;
  /** SPAWNER bookkeeping — set true after the first hit releases an enemy. */
  hasReleasedSpawn = false;

  /** Effective color (palette override, else candy color for kind). */
  readonly color: number;

  constructor(scene: Phaser.Scene, x: number, y: number, archetype: BrickArchetype, colorOverride?: number) {
    this.archetype = archetype;
    this.hp = archetype.hits;
    const baseCandy = BRICK_CANDY_COLORS[archetype.kind] ?? archetype.color;
    this.color = colorOverride ?? baseCandy;

    const sp = scene.physics.add.image(x, y, 'brick-candy');
    sp.setOrigin(0.5);
    sp.setImmovable(true);
    sp.body.allowGravity = false;
    sp.setDepth(10);
    sp.body.setSize(Tuning.bricks.width, Tuning.bricks.height, true);
    if (archetype.kind !== 'indestructible') {
      sp.setTint(this.color);
    } else {
      sp.setTint(this.color);
    }
    this.sprite = sp;

    // Specular shine overlay — only on breakable, candy-style bricks. We
    // pass the blend mode as a string ('ADD' resolves to BlendModes.ADD)
    // so this file stays tree-shakeable in the Node test environment —
    // any runtime Phaser.* reference triggers Phaser's window-dependent
    // OS init and breaks the level-parse tests.
    //
    // Alpha 0.45 (down from 0.8) — the gem-shine texture renders under
    // ADD blend, so even a soft gleam burns near-white if alpha is too
    // high. 0.45 keeps the highlight readable as a sheen.
    if (archetype.kind !== 'indestructible') {
      this.shineOverlay = scene.add
        .image(x, y, 'gem-shine')
        .setDepth(11)
        .setBlendMode('ADD')
        .setAlpha(0.45);
    }

    // INVISIBLE: starts fully hidden. Reveal/fade is driven by
    // proximity to the ball — see update().
    if (archetype.kind === 'invisible') {
      this.sprite.setAlpha(0);
      this.shineOverlay?.setAlpha(0);
    }

    this.playEntrance(scene);
  }

  /**
   * Per-frame tick. `ballMinDist` is the distance from this brick's
   * center to the nearest ball — only used by INVISIBLE bricks to
   * fade in/out. REGEN heals 1 HP every 4 s of no-hit. Other kinds
   * are no-ops.
   */
  update(deltaMs: number, ballMinDist?: number): void {
    if (!this.alive || this.destroying) return;
    switch (this.archetype.kind) {
      case 'regen':
        this.tickRegen(deltaMs);
        break;
      case 'invisible':
        this.tickInvisible(deltaMs, ballMinDist ?? Number.POSITIVE_INFINITY);
        break;
      default:
        break;
    }
  }

  private tickRegen(deltaMs: number): void {
    if (this.hp >= this.archetype.hits) return;
    this.regenAccumMs += deltaMs;
    if (this.regenAccumMs >= 4000) {
      this.regenAccumMs = 0;
      this.hp = Math.min(this.archetype.hits, this.hp + 1);
      // Brick is healing — restore the candy tint and shed the cracks
      // if it's back to full HP.
      this.sprite.setTint(this.color);
      this.shineOverlay?.setAlpha(0.45);
      if (this.hp === this.archetype.hits) {
        this.cracksOverlay?.destroy();
        this.cracksOverlay = undefined;
      }
    }
  }

  private tickInvisible(deltaMs: number, dist: number): void {
    const NEAR = (Tuning.bricks.width + Tuning.bricks.colGap) * 2;
    const HOLD_MS = 2000;
    if (dist < NEAR) {
      // Reveal — climb to alpha 1 over ~200 ms.
      this.revealAlpha = Math.min(1, this.revealAlpha + deltaMs / 200);
      this.revealHoldMs = 0;
    } else {
      // Hold for HOLD_MS after the ball drifts away, then fade.
      this.revealHoldMs += deltaMs;
      if (this.revealHoldMs > HOLD_MS) {
        this.revealAlpha = Math.max(0, this.revealAlpha - deltaMs / 400);
      }
    }
    this.sprite.setAlpha(this.revealAlpha);
    this.shineOverlay?.setAlpha(this.revealAlpha * 0.45);
  }

  /** Returns true if the brick was destroyed by this hit. */
  hit(scene: Phaser.Scene): { destroyed: boolean } {
    if (!this.alive || this.destroying) return { destroyed: false };
    // Warded by a still-alive warden — block damage entirely (the ball
    // still bounces normally because collision is computed before this
    // method is called). Shows a soft cyan ping so the player knows
    // the shield ate the hit.
    if (this.wardedBy?.alive) {
      this.shieldPing(scene);
      return { destroyed: false };
    }
    if (this.archetype.kind === 'indestructible' || this.archetype.kind === 'bumper') {
      this.flash(scene);
      return { destroyed: false };
    }
    // REGEN: any meaningful hit resets the heal timer.
    if (this.archetype.kind === 'regen') this.regenAccumMs = 0;
    this.hp -= 1;
    this.flash(scene);
    if (this.hp <= 0) {
      this.alive = false;
      this.popAndDestroy(scene);
      return { destroyed: true };
    }
    // Show damage cracks once HP is below max.
    if (!this.cracksOverlay) {
      this.cracksOverlay = scene.add
        .image(this.sprite.x, this.sprite.y, 'brick-cracks')
        .setDepth(12)
        .setAlpha(0.55);
    }
    // Final-HP wobble + visual de-saturation cue.
    if (this.hp === 1) {
      this.sprite.setTint(desaturate(this.color, 0.45));
      this.shineOverlay?.setAlpha(0.2);
      scene.tweens.add({
        targets: this.sprite,
        scaleX: { from: 1.15, to: 1 },
        scaleY: { from: 0.9, to: 1 },
        duration: 200,
        ease: 'sine.inOut',
      });
    }
    return { destroyed: false };
  }

  destroy(): void {
    this.alive = false;
    this.destroying = true;
    const scene = this.sprite.scene;
    scene?.tweens.killTweensOf(this.sprite);
    if (this.shineOverlay) scene?.tweens.killTweensOf(this.shineOverlay);
    this.sprite.destroy();
    this.cracksOverlay?.destroy();
    this.shineOverlay?.destroy();
  }

  isBreakable(): boolean {
    return this.archetype.kind !== 'indestructible' && this.archetype.kind !== 'bumper';
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }
  get left(): number {
    return this.sprite.x - Tuning.bricks.width / 2;
  }
  get right(): number {
    return this.sprite.x + Tuning.bricks.width / 2;
  }
  get top(): number {
    return this.sprite.y - Tuning.bricks.height / 2;
  }
  get bottom(): number {
    return this.sprite.y + Tuning.bricks.height / 2;
  }

  // ---------- Visual choreography ----------

  private playEntrance(scene: Phaser.Scene): void {
    // Derive grid index from position so each row/column gets a staggered
    // pop. LevelSystem already places bricks on a fixed grid — we invert
    // its math here to avoid threading a new constructor param through.
    const c = Math.round(
      (this.sprite.x - Tuning.bricks.fieldOffsetX - Tuning.bricks.width / 2) /
        (Tuning.bricks.width + Tuning.bricks.colGap),
    );
    const r = Math.round(
      (this.sprite.y - Tuning.bricks.fieldOffsetY - Tuning.bricks.height / 2) /
        (Tuning.bricks.height + Tuning.bricks.rowGap),
    );
    const gridIndex = Math.max(0, r * Tuning.bricks.cols + c);

    const targets: Phaser.GameObjects.GameObject[] = [this.sprite];
    if (this.shineOverlay) targets.push(this.shineOverlay);
    this.sprite.setScale(0);
    this.shineOverlay?.setScale(0);
    // Stagger by 8 ms so the LAST brick in a max-density 14×13 field
    // (gridIndex ≈ 181) still finishes popping in under 1.7 s.
    scene.tweens.add({
      targets,
      scale: { from: 0, to: 1 },
      duration: 280,
      ease: 'Back.easeOut',
      delay: gridIndex * 8,
    });
  }

  /**
   * Visual ping for a hit that bounced off a warden's shield. Brief
   * cyan flash + outward ring so the player understands "no damage
   * dealt, take out the warden first". Reuses the brick's sprite —
   * no extra particle cost.
   */
  private shieldPing(scene: Phaser.Scene): void {
    if (!this.alive) return;
    const original = this.color;
    this.sprite.setTint(0x99ccff);
    scene.time.delayedCall(80, () => {
      if (!this.alive || this.destroying) return;
      this.sprite.setTint(original);
    });
  }

  private flash(scene: Phaser.Scene): void {
    if (!this.alive || this.destroying) return;
    const lighter = lighten(this.color, 0.45);
    this.sprite.setTint(lighter);
    // Squish — scaleX up, scaleY down, then settle elastically.
    scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.12,
      scaleY: 0.88,
      duration: 40,
      ease: 'sine.out',
      onComplete: () => {
        if (!this.alive || this.destroying) return;
        scene.tweens.add({
          targets: this.sprite,
          scaleX: 1,
          scaleY: 1,
          duration: 120,
          ease: 'Back.easeOut',
        });
      },
    });
    if (this.shineOverlay) {
      scene.tweens.add({
        targets: this.shineOverlay,
        scaleX: 1.12,
        scaleY: 0.88,
        duration: 40,
        ease: 'sine.out',
        yoyo: true,
      });
    }
    scene.time.delayedCall(Tuning.bricks.flashMs, () => {
      if (!this.alive || this.destroying) return;
      // Restore tint — desaturated if down to last HP, else full color.
      if (this.archetype.kind !== 'indestructible' && this.hp === 1) {
        this.sprite.setTint(desaturate(this.color, 0.45));
      } else {
        this.sprite.setTint(this.color);
      }
    });
  }

  private popAndDestroy(scene: Phaser.Scene): void {
    this.destroying = true;
    scene.tweens.killTweensOf(this.sprite);
    if (this.shineOverlay) scene.tweens.killTweensOf(this.shineOverlay);
    // Body is already inert (alive=false skips collision).
    scene.tweens.add({
      targets: this.sprite,
      scale: { from: 1, to: 1.3 },
      duration: 60,
      ease: 'sine.out',
      onComplete: () => {
        scene.tweens.add({
          targets: this.sprite,
          scale: 0,
          duration: 100,
          ease: 'Back.easeIn',
          onComplete: () => {
            this.sprite.destroy();
            this.cracksOverlay?.destroy();
          },
        });
      },
    });
    if (this.shineOverlay) {
      scene.tweens.add({
        targets: this.shineOverlay,
        scale: 1.8,
        alpha: 0,
        duration: 200,
        ease: 'Quad.easeOut',
        onComplete: () => this.shineOverlay?.destroy(),
      });
    }
  }
}
