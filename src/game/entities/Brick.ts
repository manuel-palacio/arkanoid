import Phaser from 'phaser';
import { Tuning } from '../config/tuning';
import { BRICK_CANDY_COLORS, lighten } from '../config/palette';
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
  /** Currently-displayed crack tier (0 = none, 1..3). */
  private crackTier = 0;
  private shineOverlay?: Phaser.GameObjects.Image;
  /** Indestructibles only: subtle inner-glow halo pulse. */
  private metalGlow?: Phaser.GameObjects.Image;
  /** Spawner only: pulsing chevron icon centered on the brick. */
  private iconOverlay?: Phaser.GameObjects.Image;
  /** Invisibles only: stroke-rect silhouette drawn at proximity range. */
  private outlineGfx?: Phaser.GameObjects.Graphics;
  /** Invisibles only: locked to fully visible after first hit. */
  private revealedByHit = false;
  /** "About to pop" glow tween handle so we can stop it on heal/destroy. */
  private aboutToPopTween?: Phaser.Tweens.Tween;
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

    // Indestructibles use a brushed-metal base texture so they read as
    // immovable steel in dense grids — distinct silhouette from candy
    // bricks even before the ball touches them.
    const isIndestructible = archetype.kind === 'indestructible';
    const baseTexture = isIndestructible ? 'brick-metal' : 'brick-candy';
    const sp = scene.physics.add.image(x, y, baseTexture);
    sp.setOrigin(0.5);
    sp.setImmovable(true);
    sp.body.allowGravity = false;
    sp.setDepth(10);
    sp.body.setSize(Tuning.bricks.width, Tuning.bricks.height, true);
    sp.setTint(this.color);
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
    if (!isIndestructible) {
      this.shineOverlay = scene.add
        .image(x, y, 'gem-shine')
        .setDepth(11)
        .setBlendMode('ADD')
        .setAlpha(0.45);
    }

    // Indestructible inner-glow pulse — soft halo at very low alpha so
    // it never reads as a target, just as "this thing is alive but
    // can't be broken". Slow 2.4 s breathing.
    if (isIndestructible) {
      const halo = scene.add
        .image(x, y, 'glow-soft')
        .setDepth(9)
        .setBlendMode('ADD')
        .setTint(0xc8cdd4)
        .setScale(Math.max(Tuning.bricks.width, Tuning.bricks.height) / 32)
        .setAlpha(0.05);
      this.metalGlow = halo;
      scene.tweens.add({
        targets: halo,
        alpha: 0.1,
        duration: 2400,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      });
    }

    // Spawner idle anim — pulsing chevron centered in the brick. The
    // glow already telegraphed by the brick's tint isn't enough to
    // distinguish it at a glance; this icon is the unambiguous read.
    if (archetype.kind === 'spawner') {
      const icon = scene.add
        .image(x, y, 'brick-spawner-icon')
        .setDepth(12)
        .setAlpha(0.85);
      this.iconOverlay = icon;
      scene.tweens.add({
        targets: icon,
        alpha: 0.4,
        duration: 750,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      });
    }

    // INVISIBLE: starts fully hidden. Reveal/fade is driven by
    // proximity to the ball — see update(). The outline graphic is the
    // proximity silhouette.
    if (archetype.kind === 'invisible') {
      this.sprite.setAlpha(0);
      this.shineOverlay?.setAlpha(0);
      this.outlineGfx = scene.add.graphics().setDepth(11);
      this.outlineGfx.lineStyle(1, this.color, 1);
      this.outlineGfx.strokeRect(
        x - Tuning.bricks.width / 2,
        y - Tuning.bricks.height / 2,
        Tuning.bricks.width,
        Tuning.bricks.height,
      );
      this.outlineGfx.setAlpha(0);
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
      const scene = this.sprite.scene;
      // Brief white-flash heal pulse — separates a heal tick from a
      // damage flash visually (damage flash uses a lightened tint of
      // the candy color; heal goes whiter than that).
      this.sprite.setTint(0xffffff);
      this.shineOverlay?.setAlpha(0.65);
      scene?.time.delayedCall(80, () => {
        if (!this.alive || this.destroying) return;
        this.sprite.setTint(this.color);
        this.shineOverlay?.setAlpha(0.45);
      });
      // Floating "+" so the player understands a heal happened even if
      // they weren't watching the HP cracks rebuild. Inlined rather
      // than importing EffectsSystem — see file-level comment about
      // keeping Brick.ts free of runtime Phaser.* references so the
      // Node test environment doesn't pull in Phaser's OS init.
      if (scene) this.spawnHealFloater(scene);
      // Stop the about-to-pop pulse if HP is no longer 1.
      if (this.hp > 1 && this.aboutToPopTween) {
        this.aboutToPopTween.stop();
        this.aboutToPopTween = undefined;
      }
      // Step the crack overlay back down a tier as HP recovers.
      this.applyCrackTier();
    }
  }

  private tickInvisible(deltaMs: number, dist: number): void {
    // Permanently revealed once the ball has actually struck this brick —
    // hiding it again would feel buggy after a confirmed hit.
    if (this.revealedByHit) {
      this.sprite.setAlpha(1);
      this.shineOverlay?.setAlpha(0.45);
      this.outlineGfx?.setAlpha(0);
      return;
    }
    const NEAR = 80;
    const SILHOUETTE = 160;
    const HOLD_MS = 2000;
    let targetFill = 0;
    let targetOutline = 0;
    if (dist < NEAR) {
      // Inner zone: full fill (fade in over ~200 ms via revealAlpha) +
      // outline starts to drop out as the fill takes over.
      this.revealHoldMs = 0;
      this.revealAlpha = Math.min(1, this.revealAlpha + deltaMs / 200);
      targetFill = this.revealAlpha;
      targetOutline = 0.7 * (1 - this.revealAlpha);
    } else if (dist < SILHOUETTE) {
      // Mid zone: silhouette only, alpha proportional to closeness.
      this.revealHoldMs = 0;
      const t = (SILHOUETTE - dist) / (SILHOUETTE - NEAR);
      targetOutline = t * 0.7;
      this.revealAlpha = Math.max(0, this.revealAlpha - deltaMs / 400);
      targetFill = 0;
    } else {
      // Far zone: hide everything, but only after a brief hold so a
      // grazing pass doesn't strobe the outline on/off.
      this.revealHoldMs += deltaMs;
      if (this.revealHoldMs > HOLD_MS) {
        this.revealAlpha = Math.max(0, this.revealAlpha - deltaMs / 400);
      }
      targetFill = this.revealAlpha;
      targetOutline = 0;
    }
    this.sprite.setAlpha(targetFill);
    this.shineOverlay?.setAlpha(targetFill * 0.45);
    this.outlineGfx?.setAlpha(targetOutline);
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
      // Metallic ping ring on indestructibles only — bumpers already
      // get their own pinball-style burst from GameScene. Inlined to
      // avoid pulling in EffectsSystem (which would force Phaser's
      // device init and break the Node test path).
      if (this.archetype.kind === 'indestructible') {
        this.spawnMetalPing(scene);
      }
      return { destroyed: false };
    }
    // REGEN: any meaningful hit resets the heal timer.
    if (this.archetype.kind === 'regen') this.regenAccumMs = 0;
    // INVISIBLE: locked-on once a hit lands.
    if (this.archetype.kind === 'invisible') this.revealedByHit = true;
    this.hp -= 1;
    this.flash(scene);
    if (this.hp <= 0) {
      this.alive = false;
      this.popAndDestroy(scene);
      return { destroyed: true };
    }
    this.applyCrackTier();
    // "About to pop" — start a glow-orange pulse on the sprite tint at
    // 1 HP for any multi-hit breakable brick. Replaces the previous
    // flat desaturation cue (which made the brick look dimmer rather
    // than more dangerous).
    if (this.hp === 1 && this.archetype.hits >= 2 && !this.aboutToPopTween) {
      this.aboutToPopTween = scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 360,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
        onUpdate: (tw) => {
          if (!this.alive || this.destroying) return;
          const t = tw.getValue() ?? 0;
          // Lerp brick.color → hot orange-red.
          const hot = 0xff5522;
          const r = Math.round(((this.color >> 16) & 0xff) + (((hot >> 16) & 0xff) - ((this.color >> 16) & 0xff)) * t);
          const g = Math.round(((this.color >> 8) & 0xff) + (((hot >> 8) & 0xff) - ((this.color >> 8) & 0xff)) * t);
          const b = Math.round((this.color & 0xff) + ((hot & 0xff) - (this.color & 0xff)) * t);
          this.sprite.setTint((r << 16) | (g << 8) | b);
        },
      });
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

  /**
   * Pick the right crack texture for the current damage level and
   * swap or hide the overlay. Damage = max HP − current HP. Tier 0
   * means no overlay; tier ≥ 3 caps at the spiderweb.
   */
  private applyCrackTier(): void {
    if (this.archetype.kind === 'indestructible' || this.archetype.kind === 'bumper') return;
    const damage = this.archetype.hits - this.hp;
    const desired = Math.max(0, Math.min(3, damage));
    if (desired === this.crackTier) return;
    if (desired === 0) {
      this.cracksOverlay?.destroy();
      this.cracksOverlay = undefined;
      this.crackTier = 0;
      return;
    }
    const scene = this.sprite.scene;
    if (!scene) return;
    const key = `brick-cracks-${desired}`;
    const alpha = desired === 3 ? 0.85 : desired === 2 ? 0.7 : 0.55;
    if (!this.cracksOverlay) {
      this.cracksOverlay = scene.add.image(this.sprite.x, this.sprite.y, key).setDepth(12);
    } else {
      this.cracksOverlay.setTexture(key);
    }
    this.cracksOverlay.setAlpha(alpha);
    this.crackTier = desired;
  }

  destroy(): void {
    this.alive = false;
    this.destroying = true;
    const scene = this.sprite.scene;
    scene?.tweens.killTweensOf(this.sprite);
    if (this.shineOverlay) scene?.tweens.killTweensOf(this.shineOverlay);
    if (this.metalGlow) scene?.tweens.killTweensOf(this.metalGlow);
    if (this.iconOverlay) scene?.tweens.killTweensOf(this.iconOverlay);
    this.aboutToPopTween?.stop();
    this.aboutToPopTween = undefined;
    this.sprite.destroy();
    this.cracksOverlay?.destroy();
    this.shineOverlay?.destroy();
    this.metalGlow?.destroy();
    this.iconOverlay?.destroy();
    this.outlineGfx?.destroy();
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
    if (this.iconOverlay) targets.push(this.iconOverlay);
    this.sprite.setScale(0);
    this.shineOverlay?.setScale(0);
    this.iconOverlay?.setScale(0);
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
      // Don't fight the about-to-pop pulse — its onUpdate owns the
      // tint until the brick dies or heals out of 1 HP.
      if (this.aboutToPopTween) return;
      this.sprite.setTint(this.color);
    });
  }

  private popAndDestroy(scene: Phaser.Scene): void {
    this.destroying = true;
    scene.tweens.killTweensOf(this.sprite);
    if (this.shineOverlay) scene.tweens.killTweensOf(this.shineOverlay);
    if (this.iconOverlay) scene.tweens.killTweensOf(this.iconOverlay);
    if (this.metalGlow) scene.tweens.killTweensOf(this.metalGlow);
    this.aboutToPopTween?.stop();
    this.aboutToPopTween = undefined;
    // Outline graphic and metal glow are no longer relevant once the
    // brick is exploding — clear them immediately rather than tween.
    this.outlineGfx?.destroy();
    this.outlineGfx = undefined;
    this.metalGlow?.destroy();
    this.metalGlow = undefined;
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
    // Icon overlay scatters with the brick — included in the
    // destruction read so the chevron doesn't pop out instantly.
    if (this.iconOverlay) {
      scene.tweens.add({
        targets: this.iconOverlay,
        scale: 1.6,
        alpha: 0,
        y: this.iconOverlay.y + 12,
        duration: 220,
        ease: 'Quad.easeOut',
        onComplete: () => this.iconOverlay?.destroy(),
      });
    }
  }

  /**
   * Tiny green "+" floater for regen heal ticks. Inlined here rather
   * than reusing EffectsSystem.floatingPoints because that module
   * references Phaser at runtime, and importing it would break the
   * Node test path (Brick.ts is transitively imported by LevelSystem
   * which IS imported by tests).
   */
  private spawnHealFloater(scene: Phaser.Scene): void {
    const t = scene.add
      .text(this.x, this.y - 12, '+', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        color: '#88ff99',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setDepth(70);
    scene.tweens.add({
      targets: t,
      y: this.y - 36,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  /**
   * Cyan-white expanding ring for indestructible-brick impacts.
   * Mirrors EffectsSystem.shockwave but inlined for the same reason
   * as spawnHealFloater above.
   */
  private spawnMetalPing(scene: Phaser.Scene): void {
    const ring = scene.add.graphics().setDepth(60);
    ring.lineStyle(2, 0xc8cdd4, 1);
    ring.strokeCircle(0, 0, 1);
    ring.setPosition(this.x, this.y);
    scene.tweens.add({
      targets: ring,
      scale: 28,
      alpha: 0,
      duration: 240,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }
}
