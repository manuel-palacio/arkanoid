import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RegistryKeys, SceneKeys } from '../config/gameConfig';
import { getAudio } from '../audio/AudioManager';
import { drawStarfield, type Starfield } from '../systems/EffectsSystem';

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
      .text(cx, cy - 120, 'GAME OVER', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '74px',
        color: '#ff5d6c',
        fontStyle: '900',
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#7a1f2a', 24, true, true);
    this.add
      .text(cx, cy - 30, `SCORE  ${formatScore(data.score)}`, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add
      .text(cx, cy + 10, `HIGH   ${formatScore(Math.max(data.score, data.highScore))}`, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '20px',
        color: '#ffd23a',
      })
      .setOrigin(0.5);
    this.add
      .text(cx, cy + 80, 'ENTER  retry          ESC  menu', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#9bf2ff',
      })
      .setOrigin(0.5);

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
