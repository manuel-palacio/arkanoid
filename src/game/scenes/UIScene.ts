import Phaser from 'phaser';
import { Events, GAME_WIDTH, RegistryKeys, SceneKeys } from '../config/gameConfig';
import { Tuning } from '../config/tuning';
import { POWERUPS } from '../data/powerUps';
import { comboFlash } from '../systems/EffectsSystem';
import { getAudio } from '../audio/AudioManager';
import { saveMusicEnabled } from '../AppGame';
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
  private musicIcon!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.UI);
  }

  create(): void {
    // HUD background covers two rows: top stats row (score/level/lives)
    // and a thinner row below for active power-ups.
    const bg = this.add.rectangle(0, 0, GAME_WIDTH, HUD_H, 0x070912, 1).setOrigin(0, 0);
    bg.setStrokeStyle(1, 0x9bf2ff, 0.25);

    const row1Y = 18;
    const row2Y = 44;

    // Row 1 — score / level / lives.
    this.scoreText = this.add
      .text(12, row1Y, '0000000', this.style(18, '#ffffff', '700'))
      .setOrigin(0, 0.5);
    this.highText = this.add
      .text(12, row2Y + 4, 'HI 0000000', this.style(11, '#ffd23a'))
      .setOrigin(0, 0.5);
    this.levelText = this.add
      .text(GAME_WIDTH / 2, row1Y, 'LV 1', this.style(15, '#9bf2ff', '700'))
      .setOrigin(0.5);
    // Lives moves left to make room for the third button (music toggle).
    this.livesText = this.add
      .text(GAME_WIDTH - 132, row1Y, '♥ ♥ ♥', this.style(16, '#ff5d6c'))
      .setOrigin(0.5);

    // Row 2 — active power-up strip (below stats).
    this.powerStrip = this.add.container(12, row2Y + 4);

    // On-screen Music / Mute / Pause buttons (top-right corner). Visible
    // bg is 28x28 but the tappable hit area is 44x44 (Apple/Google touch
    // target minimum). Music is the leftmost so it's the easiest reach
    // for thumbs already moving in from the right edge.
    const musicBtn = this.makeIconButton(GAME_WIDTH - 90, row1Y, '🎵', () => {
      const on = !this.registry.get(RegistryKeys.MusicEnabled);
      this.registry.set(RegistryKeys.MusicEnabled, on);
      saveMusicEnabled(on);
      getAudio().setMusicEnabled(on);
      this.refreshMusicIcon(on);
    });
    this.musicIcon = musicBtn.list[1] as Phaser.GameObjects.Text;
    this.refreshMusicIcon(!!this.registry.get(RegistryKeys.MusicEnabled));

    const muteBtn = this.makeIconButton(GAME_WIDTH - 56, row1Y, '🔊', () => {
      const m = !this.registry.get(RegistryKeys.Muted);
      this.registry.set(RegistryKeys.Muted, m);
      this.muteIcon.setText(m ? '🔇' : '🔊');
      getAudio().setMuted(m);
    });
    this.muteIcon = muteBtn.list[1] as Phaser.GameObjects.Text;
    this.muteIcon.setText(this.registry.get(RegistryKeys.Muted) ? '🔇' : '🔊');
    this.makeIconButton(GAME_WIDTH - 22, row1Y, '⏸', () => {
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
    // Truncate long level names so they don't overflow into the lives /
    // pause buttons in the cramped portrait HUD.
    const name = def.name.length > 8 ? def.name.slice(0, 7) + '…' : def.name;
    this.levelText.setText(`LV ${def.id}  ${name}`);
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
      const x = i * 68;
      const bg = this.add
        .rectangle(x, 0, 64, 22, 0x0e1530, 0.95)
        .setOrigin(0, 0.5)
        .setStrokeStyle(1, def.color);
      const t = this.add
        .text(x + 6, -3, `${def.label}`, this.style(12, '#ffffff', '700'))
        .setOrigin(0, 0.5);
      const total = TIMED_KINDS.has(a.kind)
        ? Tuning.powerups.durations[a.kind as TimedKind]
        : 0;
      const fill = total > 0 ? Math.max(0, Math.min(1, a.remaining / total)) : 1;
      const bar = this.add
        .rectangle(x + 4, 8, 56 * fill, 2.5, def.color, 1)
        .setOrigin(0, 0.5);
      this.powerStrip.add([bg, t, bar]);
    });
  }

  /** Update the music button glyph + alpha to reflect the current state. */
  private refreshMusicIcon(on: boolean): void {
    if (!this.musicIcon) return;
    this.musicIcon.setText('🎵');
    this.musicIcon.setAlpha(on ? 1 : 0.4);
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

  /**
   * Round-rect icon button sized for a fingertip. The visible chip is
   * 28x28 but the interactive hit area is 44x44 (Apple/Google touch
   * target minimum) so users with imprecise taps don't miss.
   */
  private makeIconButton(
    x: number,
    y: number,
    glyph: string,
    onTap: () => void,
  ): Phaser.GameObjects.Container {
    const visW = 28;
    const visH = 28;
    const hitW = 44;
    const hitH = 44;
    const bg = this.add
      .rectangle(0, 0, visW, visH, 0x0e1530, 0.95)
      .setStrokeStyle(1, 0x9bf2ff, 0.6);
    const t = this.add
      .text(0, 0, glyph, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    const c = this.add.container(x, y, [bg, t]).setSize(hitW, hitH);
    c.setInteractive(
      new Phaser.Geom.Rectangle(-hitW / 2, -hitH / 2, hitW, hitH),
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
