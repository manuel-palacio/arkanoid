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

    this.playEntrance(scene);
  }

  /** Returns true if the brick was destroyed by this hit. */
  hit(scene: Phaser.Scene): { destroyed: boolean } {
    if (!this.alive || this.destroying) return { destroyed: false };
    if (this.archetype.kind === 'indestructible') {
      this.flash(scene);
      return { destroyed: false };
    }
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
    return this.archetype.kind !== 'indestructible';
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
