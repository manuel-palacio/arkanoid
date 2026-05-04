import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RegistryKeys, SceneKeys } from '../config/gameConfig';
import { getAudio } from '../audio/AudioManager';
import { loadLeaderboard } from '../data/leaderboard';
import { clearSavedRun, loadSavedRun } from '../data/savedRun';
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

    // Menu items. CONTINUE only appears when a saved run exists.
    const saved = loadSavedRun();

    const startNewGame = () => {
      const streak = loadStreak();
      const startLives = 3 + (streak.bonusPending ? 1 : 0);
      if (streak.bonusPending) saveStreak(consumeBonus(streak));
      this.registry.set('streakBonusPending', false);
      this.registry.set(RegistryKeys.Score, 0);
      this.registry.set(RegistryKeys.Lives, startLives);
      this.registry.set(RegistryKeys.LevelIndex, 0);
      clearSavedRun();
      getAudio().playSfx('uiSelect');
      getAudio().stopMusic();
      this.scene.start(SceneKeys.Game);
    };

    const continueRun = () => {
      if (!saved) return;
      this.registry.set(RegistryKeys.Score, saved.score);
      this.registry.set(RegistryKeys.Lives, saved.lives);
      this.registry.set(RegistryKeys.LevelIndex, saved.levelIndex);
      getAudio().playSfx('uiSelect');
      getAudio().stopMusic();
      this.scene.start(SceneKeys.Game);
    };

    const items: Array<{ label: string; onSelect: () => void }> = [];
    if (saved) {
      items.push({
        label: `CONTINUE  LV ${saved.levelIndex + 1}`,
        onSelect: continueRun,
      });
      items.push({ label: 'NEW GAME', onSelect: startNewGame });
    } else {
      items.push({ label: 'PLAY', onSelect: startNewGame });
    }
    items.push({ label: 'INSTRUCTIONS', onSelect: () => this.showInstructions() });
    items.push({ label: 'SETTINGS', onSelect: () => this.showSettings() });

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
    showInstructionsOverlay(this);
  }

  private showSettings(): void {
    showSettingsOverlay(this);
  }
}

// ---- helpers ----

function formatScore(n: number): string {
  return n.toString().padStart(7, '0');
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, +v.toFixed(2)));
}

/**
 * Touch-first overlay shell. Lays out a panel that fits the portrait
 * canvas, draws a title, lets the caller render content into a
 * container, and stamps a CLOSE button at the bottom.
 */
function makeOverlay(
  scene: Phaser.Scene,
  title: string,
): { panel: Phaser.GameObjects.Container; close: () => void } {
  const cx = GAME_WIDTH / 2;
  const cy = GAME_HEIGHT / 2;
  const w = GAME_WIDTH - 60;
  const h = GAME_HEIGHT - 200;
  const dim = scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55);
  const bg = scene.add.rectangle(cx, cy, w, h, 0x0a0a18, 0.96).setStrokeStyle(2, 0x9bf2ff);
  const tt = scene.add
    .text(cx, cy - h / 2 + 32, title, {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '24px',
      color: '#9bf2ff',
      fontStyle: '700',
    })
    .setOrigin(0.5);
  const panel = scene.add.container(cx, cy);

  const closeBtnY = cy + h / 2 - 36;
  const closeBg = scene.add
    .rectangle(cx, closeBtnY, 140, 44, 0x0e1530, 1)
    .setStrokeStyle(1, 0x9bf2ff);
  const closeText = scene.add
    .text(cx, closeBtnY, 'CLOSE  ✕', {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '16px',
      color: '#9bf2ff',
      fontStyle: '700',
    })
    .setOrigin(0.5);
  const closer = scene.add.container(cx, closeBtnY).setSize(160, 56);
  closer.setInteractive(
    new Phaser.Geom.Rectangle(-80, -28, 160, 56),
    Phaser.Geom.Rectangle.Contains,
  );

  const close = () => {
    [dim, bg, tt, closeBg, closeText, closer, panel].forEach((o) => o.destroy());
    scene.input.keyboard?.off('keydown-ESC', close);
    scene.input.keyboard?.off('keydown-ENTER', close);
    scene.input.keyboard?.off('keydown-SPACE', close);
  };
  closer.on('pointerdown', close);
  scene.input.keyboard?.once('keydown-ESC', close);
  scene.input.keyboard?.once('keydown-ENTER', close);
  scene.input.keyboard?.once('keydown-SPACE', close);
  return { panel, close };
}

function makeStepperButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onTap: () => void,
): Phaser.GameObjects.Container {
  const w = 44;
  const h = 36;
  const bg = scene.add.rectangle(0, 0, w, h, 0x0e1530, 1).setStrokeStyle(1, 0x9bf2ff);
  const t = scene.add
    .text(0, 0, label, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: '700',
    })
    .setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, t]).setSize(w, h);
  c.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
  c.on('pointerdown', () => {
    bg.setFillStyle(0x9bf2ff, 0.25);
    onTap();
  });
  c.on('pointerup', () => bg.setFillStyle(0x0e1530, 1));
  c.on('pointerout', () => bg.setFillStyle(0x0e1530, 1));
  return c;
}

function vbar(v: number): string {
  const n = Math.max(0, Math.min(10, Math.round(v * 10)));
  return '|' + '█'.repeat(n) + '·'.repeat(10 - n) + '|';
}

function showInstructionsOverlay(scene: Phaser.Scene): void {
  const { panel } = makeOverlay(scene, 'HOW TO PLAY');
  const lines = [
    'DRAG  to move the paddle',
    'TAP   to launch / fire laser',
    '⏸  to pause   ·   🔊  to mute',
    '',
    'CATCH falling capsules to power up.',
    'CLEAR every brick to advance.',
    'GRAY bricks cannot be broken.',
  ];
  lines.forEach((line, i) => {
    panel.add(
      scene.add
        .text(0, -120 + i * 28, line, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: line.startsWith('GRAY') ? '#9bf2ff' : '#ffffff',
        })
        .setOrigin(0.5),
    );
  });
}

function showSettingsOverlay(scene: Phaser.Scene): void {
  const reg = scene.registry;
  const audio = getAudio();
  const { panel } = makeOverlay(scene, 'SETTINGS');

  const musicLabel = scene.add
    .text(-110, -90, 'MUSIC', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' })
    .setOrigin(0, 0.5);
  const musicBar = scene.add
    .text(0, -90, vbar(Number(reg.get(RegistryKeys.MusicVolume))), {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#9bf2ff',
    })
    .setOrigin(0.5);

  const sfxLabel = scene.add
    .text(-110, -30, 'SFX', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' })
    .setOrigin(0, 0.5);
  const sfxBar = scene.add
    .text(0, -30, vbar(Number(reg.get(RegistryKeys.SfxVolume))), {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#9bf2ff',
    })
    .setOrigin(0.5);

  const muteLabel = scene.add
    .text(0, 40, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' })
    .setOrigin(0.5);

  const refresh = () => {
    musicBar.setText(vbar(Number(reg.get(RegistryKeys.MusicVolume))));
    sfxBar.setText(vbar(Number(reg.get(RegistryKeys.SfxVolume))));
    const m = !!reg.get(RegistryKeys.Muted);
    muteLabel.setText(m ? '🔇  MUTED' : '🔊  AUDIO ON');
    audio.setMuted(m);
    audio.setMusicVolume(Number(reg.get(RegistryKeys.MusicVolume)));
    audio.setSfxVolume(Number(reg.get(RegistryKeys.SfxVolume)));
  };
  refresh();

  const adjustMusic = (d: number) => {
    reg.set(
      RegistryKeys.MusicVolume,
      clamp01(Number(reg.get(RegistryKeys.MusicVolume)) + d),
    );
    refresh();
  };
  const adjustSfx = (d: number) => {
    reg.set(RegistryKeys.SfxVolume, clamp01(Number(reg.get(RegistryKeys.SfxVolume)) + d));
    refresh();
  };

  const musicMinus = makeStepperButton(scene, -90, -90, '−', () => adjustMusic(-0.1));
  const musicPlus = makeStepperButton(scene, 90, -90, '+', () => adjustMusic(+0.1));
  const sfxMinus = makeStepperButton(scene, -90, -30, '−', () => adjustSfx(-0.1));
  const sfxPlus = makeStepperButton(scene, 90, -30, '+', () => adjustSfx(+0.1));

  // Mute toggle as a tappable pill.
  const muteToggle = makeStepperButton(scene, 0, 80, 'TOGGLE', () => {
    reg.set(RegistryKeys.Muted, !reg.get(RegistryKeys.Muted));
    refresh();
  });
  muteToggle.setSize(160, 36);
  // The visual rect inside is the first child — widen it.
  const toggleBg = muteToggle.list[0] as Phaser.GameObjects.Rectangle;
  toggleBg.setSize(160, 36);
  muteToggle.setInteractive(
    new Phaser.Geom.Rectangle(-80, -18, 160, 36),
    Phaser.Geom.Rectangle.Contains,
  );

  panel.add([
    musicLabel,
    musicBar,
    sfxLabel,
    sfxBar,
    muteLabel,
    musicMinus,
    musicPlus,
    sfxMinus,
    sfxPlus,
    muteToggle,
  ]);
}
