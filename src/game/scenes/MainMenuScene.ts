import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RegistryKeys, SceneKeys } from '../config/gameConfig';
import { getAudio } from '../audio/AudioManager';
import { loadLeaderboard } from '../data/leaderboard';
import { consumeBonus, loadStreak, saveStreak } from '../data/streak';
import { drawStarfield, type Starfield } from '../systems/EffectsSystem';

export class MainMenuScene extends Phaser.Scene {
  private starfield?: Starfield;

  constructor() {
    super(SceneKeys.MainMenu);
  }

  create(): void {
    this.starfield = drawStarfield(this);

    const cx = GAME_WIDTH / 2;

    // Title — sized for portrait width.
    this.add
      .text(cx, 140, 'BRICKSTORM', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '56px',
        color: '#ffffff',
        fontStyle: '900',
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#4ad6ff', 24, true, true);
    this.add
      .text(cx, 184, 'an arcade brick-breaker', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        color: '#9bf2ff',
      })
      .setOrigin(0.5);

    // Streak badge — top of the screen, full width.
    const board = loadLeaderboard();
    const streakDays = (this.registry.get('streakDays') as number) ?? 0;
    const bonusPending = !!this.registry.get('streakBonusPending');
    if (streakDays > 0) {
      const badge = this.add
        .rectangle(cx, 36, 240, 32, 0x0e1530, 0.95)
        .setStrokeStyle(1, bonusPending ? 0xffd23a : 0x9bf2ff);
      const flame = bonusPending ? '🔥' : '·';
      const txt = bonusPending
        ? `${flame}  DAY ${streakDays} · +1 LIFE`
        : `${flame}  DAY ${streakDays} STREAK`;
      this.add
        .text(cx, 36, txt, {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '13px',
          color: bonusPending ? '#ffd23a' : '#ffffff',
          fontStyle: '700',
        })
        .setOrigin(0.5);
      if (bonusPending) {
        this.tweens.add({
          targets: badge,
          alpha: { from: 0.85, to: 1 },
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        });
      }
    }

    // High score line under the title.
    const topScore = board[0]?.score ?? (this.registry.get(RegistryKeys.HighScore) as number) ?? 0;
    this.add
      .text(cx, 220, `HIGH  ${formatScore(topScore)}`, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        color: '#ffd23a',
      })
      .setOrigin(0.5);

    // Top-5 leaderboard at the bottom of the menu (centered).
    if (board.length > 0) {
      const y0 = GAME_HEIGHT - 170;
      this.add
        .text(cx, y0, 'TOP 5', {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '12px',
          color: '#9bf2ff',
          fontStyle: '700',
        })
        .setOrigin(0.5);
      board.forEach((e, i) => {
        this.add
          .text(cx, y0 + 18 + i * 16, `${i + 1}. ${e.initials}   ${formatScore(e.score)}`, {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: i === 0 ? '#ffd23a' : '#ffffff',
          })
          .setOrigin(0.5);
      });
    }

    // Menu items.
    const items: Array<{ label: string; onSelect: () => void }> = [
      {
        label: 'PLAY',
        onSelect: () => {
          // Apply pending streak bonus once.
          const streak = loadStreak();
          const startLives = 3 + (streak.bonusPending ? 1 : 0);
          if (streak.bonusPending) saveStreak(consumeBonus(streak));
          this.registry.set('streakBonusPending', false);
          this.registry.set(RegistryKeys.Score, 0);
          this.registry.set(RegistryKeys.Lives, startLives);
          this.registry.set(RegistryKeys.LevelIndex, 0);
          getAudio().playSfx('uiSelect');
          getAudio().stopMusic();
          this.scene.start(SceneKeys.Game);
        },
      },
      { label: 'INSTRUCTIONS', onSelect: () => this.showInstructions() },
      { label: 'SETTINGS', onSelect: () => this.showSettings() },
    ];

    let selected = 0;
    const labels: Phaser.GameObjects.Text[] = [];
    const menuTopY = 290;
    const itemSpacing = 56;
    items.forEach((item, i) => {
      const t = this.add
        .text(cx, menuTopY + i * itemSpacing, item.label, {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '28px',
          color: '#ffffff',
          fontStyle: '700',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', () => {
        selected = i;
        getAudio().unlock();
        getAudio().playSfx('uiMove');
        refresh();
      });
      t.on('pointerdown', () => {
        getAudio().unlock();
        item.onSelect();
      });
      labels.push(t);
    });

    const refresh = () => {
      labels.forEach((l, i) => {
        if (i === selected) {
          l.setColor('#9bf2ff');
          l.setScale(1.06);
        } else {
          l.setColor('#ffffff');
          l.setScale(1);
        }
      });
    };
    refresh();

    // Keyboard nav.
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-UP', () => {
        selected = (selected - 1 + items.length) % items.length;
        getAudio().unlock();
        getAudio().playSfx('uiMove');
        refresh();
      });
      this.input.keyboard.on('keydown-DOWN', () => {
        selected = (selected + 1) % items.length;
        getAudio().unlock();
        getAudio().playSfx('uiMove');
        refresh();
      });
      this.input.keyboard.on('keydown-ENTER', () => {
        getAudio().unlock();
        items[selected]?.onSelect();
      });
      this.input.keyboard.on('keydown-SPACE', () => {
        getAudio().unlock();
        items[selected]?.onSelect();
      });
    }

    // Footer prompt.
    this.add
      .text(cx, GAME_HEIGHT - 24, 'TAP / ENTER TO START', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '11px',
        color: '#5ea8c5',
      })
      .setOrigin(0.5);

    // Audio gate: unlock + play menu music after the very first user input.
    const tryStartMusic = () => {
      const audio = getAudio();
      audio.unlock();
      audio.playMusic('menu');
    };
    this.input.once('pointerdown', tryStartMusic);
    this.input.keyboard?.once('keydown', tryStartMusic);
  }

  override update(_time: number, delta: number): void {
    this.starfield?.update(delta);
  }

  private showInstructions(): void {
    showOverlay(this, 'INSTRUCTIONS', [
      '←  →   move paddle',
      'A   D   move paddle',
      'SPACE   launch / fire laser',
      'P   pause',
      'M   mute',
      '',
      'CATCH falling capsules to power up.',
      'CLEAR every brick to advance.',
      'INDESTRUCTIBLE bricks (gray) cannot be broken.',
    ]);
  }

  private showSettings(): void {
    const muted = !!this.registry.get(RegistryKeys.Muted);
    const mvol = Number(this.registry.get(RegistryKeys.MusicVolume));
    const svol = Number(this.registry.get(RegistryKeys.SfxVolume));
    showOverlay(this, 'SETTINGS', [
      `MUSIC  ${vbar(mvol)}`,
      `SFX    ${vbar(svol)}`,
      `MUTED  ${muted ? 'YES' : 'NO'}`,
      '',
      '[ , ] music down/up',
      '[ ; / ] sfx down/up',
      '[ M ] toggle mute',
    ]).onUpdate(() => {
      const audio = getAudio();
      const m = !!this.registry.get(RegistryKeys.Muted);
      const mv = Number(this.registry.get(RegistryKeys.MusicVolume));
      const sv = Number(this.registry.get(RegistryKeys.SfxVolume));
      audio.setMuted(m);
      audio.setMusicVolume(mv);
      audio.setSfxVolume(sv);
    });
  }
}

// ---- helpers ----

function vbar(v: number): string {
  const n = Math.max(0, Math.min(10, Math.round(v * 10)));
  return '|' + '█'.repeat(n) + '·'.repeat(10 - n) + '|';
}

function formatScore(n: number): string {
  return n.toString().padStart(7, '0');
}

interface OverlayHandle {
  onUpdate(fn: () => void): OverlayHandle;
}

function showOverlay(scene: Phaser.Scene, title: string, lines: string[]): OverlayHandle {
  const cx = GAME_WIDTH / 2;
  const cy = GAME_HEIGHT / 2;
  const w = 560;
  const h = 60 + lines.length * 28 + 60;
  const bg = scene.add.rectangle(cx, cy, w, h, 0x0a0a18, 0.95).setStrokeStyle(2, 0x9bf2ff);
  const tt = scene.add
    .text(cx, cy - h / 2 + 30, title, {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '28px',
      color: '#9bf2ff',
      fontStyle: '700',
    })
    .setOrigin(0.5);
  const lineObjs: Phaser.GameObjects.Text[] = lines.map((line, i) =>
    scene.add
      .text(cx, cy - h / 2 + 70 + i * 28, line, {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5),
  );
  const closer = scene.add
    .text(cx, cy + h / 2 - 24, 'PRESS ESC TO CLOSE', {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '12px',
      color: '#5ea8c5',
    })
    .setOrigin(0.5);

  const cleanup = () => {
    [bg, tt, closer, ...lineObjs].forEach((o) => o.destroy());
    scene.input.keyboard?.off('keydown-ESC', cleanup);
    scene.input.keyboard?.off('keydown-ENTER', cleanup);
    scene.input.keyboard?.off('keydown-SPACE', cleanup);
    scene.events.off('settings-tick', updateFn);
  };
  scene.input.keyboard?.once('keydown-ESC', cleanup);
  scene.input.keyboard?.once('keydown-ENTER', cleanup);
  scene.input.keyboard?.once('keydown-SPACE', cleanup);
  bg.setInteractive().once('pointerdown', cleanup);

  let updateFn: () => void = () => {};
  scene.events.on('settings-tick', () => updateFn());

  // Settings keys.
  const reg = scene.registry;
  scene.input.keyboard?.on('keydown-COMMA', () => {
    reg.set(RegistryKeys.MusicVolume, clamp01(Number(reg.get(RegistryKeys.MusicVolume)) - 0.1));
    refresh();
  });
  scene.input.keyboard?.on('keydown-PERIOD', () => {
    reg.set(RegistryKeys.MusicVolume, clamp01(Number(reg.get(RegistryKeys.MusicVolume)) + 0.1));
    refresh();
  });
  scene.input.keyboard?.on('keydown-SEMICOLON', () => {
    reg.set(RegistryKeys.SfxVolume, clamp01(Number(reg.get(RegistryKeys.SfxVolume)) - 0.1));
    refresh();
  });
  scene.input.keyboard?.on('keydown-FORWARD_SLASH', () => {
    reg.set(RegistryKeys.SfxVolume, clamp01(Number(reg.get(RegistryKeys.SfxVolume)) + 0.1));
    refresh();
  });
  scene.input.keyboard?.on('keydown-M', () => {
    reg.set(RegistryKeys.Muted, !reg.get(RegistryKeys.Muted));
    refresh();
  });

  function refresh(): void {
    const muted = !!reg.get(RegistryKeys.Muted);
    const mv = Number(reg.get(RegistryKeys.MusicVolume));
    const sv = Number(reg.get(RegistryKeys.SfxVolume));
    if (lineObjs[0]) lineObjs[0].setText(`MUSIC  ${vbar(mv)}`);
    if (lineObjs[1]) lineObjs[1].setText(`SFX    ${vbar(sv)}`);
    if (lineObjs[2]) lineObjs[2].setText(`MUTED  ${muted ? 'YES' : 'NO'}`);
    updateFn();
  }

  return {
    onUpdate(fn: () => void) {
      updateFn = fn;
      return this;
    },
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, +v.toFixed(2)));
}
