import Phaser from 'phaser';
import { Events, GAME_WIDTH, RegistryKeys, SceneKeys } from '../config/gameConfig';
import { Tuning } from '../config/tuning';
import { POWERUPS } from '../data/powerUps';
import { comboFlash } from '../systems/EffectsSystem';
import { getAudio } from '../audio/AudioManager';
import type { ActivePowerUp, LevelDef, PowerUpKind } from '../types';

type TimedKind = keyof typeof Tuning.powerups.durations;
const TIMED_KINDS: ReadonlySet<PowerUpKind> = new Set(
  Object.keys(Tuning.powerups.durations) as TimedKind[],
);

const HUD_H = Tuning.playfield.hudHeight;

export class UIScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private highText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private powerStrip!: Phaser.GameObjects.Container;
  private floatingPoints: Phaser.GameObjects.Text[] = [];
  private muteIcon!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.UI);
  }

  create(): void {
    // HUD background.
    const bg = this.add.rectangle(0, 0, GAME_WIDTH, HUD_H, 0x070912, 1).setOrigin(0, 0);
    bg.setStrokeStyle(1, 0x9bf2ff, 0.25);

    this.scoreText = this.add
      .text(20, HUD_H / 2, 'SCORE  0000000', this.style(20, '#ffffff', '700'))
      .setOrigin(0, 0.5);
    this.highText = this.add
      .text(GAME_WIDTH / 2, HUD_H / 2, 'HI  0000000', this.style(16, '#ffd23a'))
      .setOrigin(0.5);
    this.levelText = this.add
      .text(GAME_WIDTH - 130, HUD_H / 2, 'LV 1', this.style(18, '#9bf2ff', '700'))
      .setOrigin(1, 0.5);
    this.livesText = this.add
      .text(GAME_WIDTH / 2 + 200, HUD_H / 2, '♥ ♥ ♥', this.style(20, '#ff5d6c'))
      .setOrigin(0.5);
    this.powerStrip = this.add.container(GAME_WIDTH / 2 - 240, HUD_H / 2);

    // On-screen Pause + Mute buttons. Sized large enough for finger taps;
    // also work as click targets on desktop.
    const muteBtn = this.makeIconButton(GAME_WIDTH - 96, HUD_H / 2, '🔊', () => {
      const m = !this.registry.get(RegistryKeys.Muted);
      this.registry.set(RegistryKeys.Muted, m);
      this.muteIcon.setText(m ? '🔇' : '🔊');
      getAudio().setMuted(m);
    });
    this.muteIcon = muteBtn.list[1] as Phaser.GameObjects.Text;
    this.muteIcon.setText(this.registry.get(RegistryKeys.Muted) ? '🔇' : '🔊');
    this.makeIconButton(GAME_WIDTH - 56, HUD_H / 2, '⏸', () => {
      this.scene.get(SceneKeys.Game).events.emit('ui-pause-request');
    });

    const game = this.scene.get(SceneKeys.Game);
    game.events.on(Events.ScoreChanged, this.onScoreChanged, this);
    game.events.on(Events.LivesChanged, this.onLivesChanged, this);
    game.events.on(Events.LevelChanged, this.onLevelChanged, this);
    game.events.on(Events.PowerUpActivated, this.onPowerUpsChanged, this);
    game.events.on(Events.PowerUpExpired, this.onPowerUpsChanged, this);
    game.events.on(Events.Combo, this.onCombo, this);

    const hi = this.registry.get(RegistryKeys.HighScore) as number;
    this.highText.setText(`HI  ${formatScore(hi)}`);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      game.events.off(Events.ScoreChanged, this.onScoreChanged, this);
      game.events.off(Events.LivesChanged, this.onLivesChanged, this);
      game.events.off(Events.LevelChanged, this.onLevelChanged, this);
      game.events.off(Events.PowerUpActivated, this.onPowerUpsChanged, this);
      game.events.off(Events.PowerUpExpired, this.onPowerUpsChanged, this);
      game.events.off(Events.Combo, this.onCombo, this);
    });
  }

  private onScoreChanged(score: number, hi: number, delta?: number): void {
    this.scoreText.setText(`SCORE  ${formatScore(score)}`);
    this.highText.setText(`HI  ${formatScore(Math.max(score, hi))}`);
    if (delta && delta > 0) this.spawnFloater(`+${delta}`);
  }

  private onLivesChanged(lives: number): void {
    const hearts = '♥ '.repeat(Math.max(0, lives)).trim();
    this.livesText.setText(hearts || '—');
  }

  private onLevelChanged(def: LevelDef): void {
    this.levelText.setText(`LV ${def.id}  ${def.name}`);
  }

  private onCombo(chain: number): void {
    const colors = ['#ffd23a', '#ff9f1c', '#ff6b35', '#ff3860', '#e040fb', '#b388ff'];
    const color = colors[Math.min(Math.max(0, chain - 3), colors.length - 1)] ?? '#ffd23a';
    const size = 13 + Math.min(chain, 8) * 3;
    const label =
      chain >= 6 ? `x${chain} ULTRA COMBO` : chain >= 4 ? `x${chain} GREAT COMBO` : `x${chain} CHAIN`;
    this.spawnFloater(label, color, size);
    if (chain >= 6) {
      const flashColor = parseInt(color.slice(1), 16);
      comboFlash(this.scene.get(SceneKeys.Game), flashColor, 0.35);
    }
  }

  private onPowerUpsChanged(payload: ActivePowerUp[] | PowerUpKind | null): void {
    this.powerStrip.removeAll(true);
    if (!payload || (Array.isArray(payload) && payload.length === 0)) return;
    const list = Array.isArray(payload) ? payload : [];
    list.forEach((a, i) => {
      const def = POWERUPS[a.kind];
      const x = i * 92;
      const bg = this.add.rectangle(x, 0, 84, 24, 0x0e1530, 0.95).setOrigin(0, 0.5).setStrokeStyle(1, def.color);
      const t = this.add
        .text(x + 8, 0, `${def.label}`, this.style(11, '#ffffff', '700'))
        .setOrigin(0, 0.5);
      const total = TIMED_KINDS.has(a.kind)
        ? Tuning.powerups.durations[a.kind as TimedKind]
        : 0;
      const fill = total > 0 ? Math.max(0, Math.min(1, a.remaining / total)) : 1;
      const bar = this.add
        .rectangle(x + 4, 9, 76 * fill, 3, def.color, 1)
        .setOrigin(0, 0.5);
      this.powerStrip.add([bg, t, bar]);
    });
  }

  private spawnFloater(text: string, color: string = '#ffffff', size = 14): void {
    const t = this.add
      .text(this.scoreText.x + 220, HUD_H / 2, text, this.style(size, color, '700'))
      .setOrigin(0, 0.5);
    this.floatingPoints.push(t);
    this.tweens.add({
      targets: t,
      y: HUD_H / 2 - 24,
      alpha: 0,
      duration: 900,
      onComplete: () => {
        t.destroy();
        this.floatingPoints = this.floatingPoints.filter((x) => x !== t);
      },
    });
  }

  private style(size: number, color: string, weight: string = '500'): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: `${size}px`,
      color,
      fontStyle: weight,
    };
  }

  /** Round-rect icon button sized for a fingertip. */
  private makeIconButton(
    x: number,
    y: number,
    glyph: string,
    onTap: () => void,
  ): Phaser.GameObjects.Container {
    const w = 36;
    const h = 36;
    const bg = this.add
      .rectangle(0, 0, w, h, 0x0e1530, 0.95)
      .setStrokeStyle(1, 0x9bf2ff, 0.6);
    const t = this.add
      .text(0, 0, glyph, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    const c = this.add.container(x, y, [bg, t]).setSize(w, h);
    c.setInteractive(
      new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    c.on('pointerdown', () => {
      bg.setFillStyle(0x9bf2ff, 0.25);
      onTap();
    });
    c.on('pointerup', () => bg.setFillStyle(0x0e1530, 0.95));
    c.on('pointerout', () => bg.setFillStyle(0x0e1530, 0.95));
    return c;
  }
}

function formatScore(n: number): string {
  return Math.max(0, n | 0).toString().padStart(7, '0');
}
