import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RegistryKeys, SceneKeys } from '../config/gameConfig';
import { getAudio } from '../audio/AudioManager';
import { drawStarfield, type Starfield } from '../systems/EffectsSystem';
import {
  insertEntry,
  loadLeaderboard,
  qualifies,
  saveLeaderboard,
} from '../data/leaderboard';

interface GameOverData {
  score: number;
  highScore: number;
}

export class GameOverScene extends Phaser.Scene {
  private starfield?: Starfield;

  constructor() {
    super(SceneKeys.GameOver);
  }

  create(data: GameOverData): void {
    this.starfield = drawStarfield(this);
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);
    this.add
      .text(cx, cy - 200, 'GAME OVER', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '64px',
        color: '#ff5d6c',
        fontStyle: '900',
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#7a1f2a', 24, true, true);

    const board = loadLeaderboard();
    const isHighScore = qualifies(data.score, board);

    if (isHighScore) {
      this.renderInitialsEntry(data.score, board);
    } else {
      this.renderRecap(data, board);
    }
  }

  private renderRecap(data: GameOverData, board: ReturnType<typeof loadLeaderboard>): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add
      .text(cx, cy - 120, `SCORE  ${formatScore(data.score)}`, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Inline leaderboard display.
    this.add
      .text(cx, cy - 70, 'TOP 5', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        color: '#9bf2ff',
        fontStyle: '700',
      })
      .setOrigin(0.5);
    board.forEach((e, i) => {
      this.add
        .text(cx, cy - 40 + i * 22, `${i + 1}. ${e.initials}   ${formatScore(e.score)}`, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
    });

    this.add
      .text(cx, GAME_HEIGHT - 80, 'TAP / ENTER  retry          ESC  menu', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#9bf2ff',
      })
      .setOrigin(0.5);

    this.bindRetryMenu();
  }

  private renderInitialsEntry(score: number, board: ReturnType<typeof loadLeaderboard>): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add
      .text(cx, cy - 130, 'NEW HIGH SCORE', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '24px',
        color: '#ffd23a',
        fontStyle: '700',
      })
      .setOrigin(0.5);
    this.add
      .text(cx, cy - 95, formatScore(score), {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: '900',
      })
      .setOrigin(0.5);

    // 3-letter input. We render 3 boxes; the active one blinks. Letters
    // accepted via keyboard A-Z; left/right or Backspace navigate; Enter
    // confirms. Touch users get up/down arrows under each slot.
    const initials = ['A', 'A', 'A'];
    let idx = 0;
    const slots: Phaser.GameObjects.Text[] = [];
    const slotBg: Phaser.GameObjects.Rectangle[] = [];
    const baseY = cy - 30;
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * 60;
      const bg = this.add.rectangle(x, baseY, 50, 60, 0x0e1530, 1).setStrokeStyle(2, 0x9bf2ff);
      const t = this.add
        .text(x, baseY, 'A', {
          fontFamily: 'monospace',
          fontSize: '40px',
          color: '#ffffff',
          fontStyle: '700',
        })
        .setOrigin(0.5);
      slots.push(t);
      slotBg.push(bg);

      // Up/down chevrons for touch.
      const up = this.add
        .text(x, baseY - 50, '▲', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '20px',
          color: '#9bf2ff',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      const down = this.add
        .text(x, baseY + 50, '▼', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '20px',
          color: '#9bf2ff',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      up.on('pointerdown', () => {
        idx = i;
        cycleLetter(+1);
        refresh();
      });
      down.on('pointerdown', () => {
        idx = i;
        cycleLetter(-1);
        refresh();
      });
    }

    const refresh = () => {
      slots.forEach((s, i) => s.setText(initials[i] ?? 'A'));
      slotBg.forEach((bg, i) =>
        bg.setStrokeStyle(2, i === idx ? 0xffd23a : 0x9bf2ff),
      );
    };
    refresh();

    const cycleLetter = (delta: number) => {
      const cur = (initials[idx] ?? 'A').charCodeAt(0);
      const next = ((cur - 65 + delta + 26) % 26) + 65;
      initials[idx] = String.fromCharCode(next);
    };

    this.add
      .text(cx, cy + 60, 'A-Z to enter   ←/→ to move   ENTER to submit', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#9bf2ff',
      })
      .setOrigin(0.5);

    const submitBtn = this.add
      .text(cx, cy + 110, '[  SUBMIT  ]', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '20px',
        color: '#ffd23a',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const submit = () => {
      const merged = insertEntry(board, initials.join(''), score);
      saveLeaderboard(merged.list);
      this.registry.set(RegistryKeys.HighScore, merged.list[0]?.score ?? score);
      getAudio().playSfx('uiSelect');
      this.scene.restart({ score, highScore: merged.list[0]?.score ?? score });
    };
    submitBtn.on('pointerdown', submit);

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      const code = ev.key.toUpperCase();
      if (/^[A-Z]$/.test(code)) {
        initials[idx] = code;
        idx = Math.min(2, idx + 1);
        refresh();
      } else if (ev.key === 'ArrowLeft') {
        idx = Math.max(0, idx - 1);
        refresh();
      } else if (ev.key === 'ArrowRight') {
        idx = Math.min(2, idx + 1);
        refresh();
      } else if (ev.key === 'ArrowUp') {
        cycleLetter(+1);
        refresh();
      } else if (ev.key === 'ArrowDown') {
        cycleLetter(-1);
        refresh();
      } else if (ev.key === 'Backspace') {
        idx = Math.max(0, idx - 1);
        refresh();
      } else if (ev.key === 'Enter') {
        submit();
      }
    });
  }

  private bindRetryMenu(): void {
    const retry = () => {
      this.registry.set(RegistryKeys.Score, 0);
      this.registry.set(RegistryKeys.Lives, 3);
      this.registry.set(RegistryKeys.LevelIndex, 0);
      this.scene.stop(SceneKeys.UI);
      this.scene.stop(SceneKeys.Game);
      this.scene.stop();
      this.scene.start(SceneKeys.Game);
    };
    const menu = () => {
      this.scene.stop(SceneKeys.UI);
      this.scene.stop(SceneKeys.Game);
      this.scene.stop();
      this.scene.start(SceneKeys.MainMenu);
    };
    this.input.keyboard?.once('keydown-ENTER', () => {
      getAudio().playSfx('uiSelect');
      retry();
    });
    this.input.keyboard?.once('keydown-SPACE', () => {
      getAudio().playSfx('uiSelect');
      retry();
    });
    this.input.keyboard?.once('keydown-ESC', menu);
    this.input.once('pointerdown', retry);
  }

  override update(_t: number, delta: number): void {
    this.starfield?.update(delta);
  }
}

function formatScore(n: number): string {
  return Math.max(0, n | 0).toString().padStart(7, '0');
}
