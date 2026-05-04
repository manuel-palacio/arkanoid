import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RegistryKeys, SceneKeys } from '../config/gameConfig';
import { getAudio } from '../audio/AudioManager';
import { drawStarfield, type Starfield } from '../systems/EffectsSystem';

interface VictoryData {
  score: number;
}

export class VictoryScene extends Phaser.Scene {
  private starfield?: Starfield;

  constructor() {
    super(SceneKeys.Victory);
  }

  create(data: VictoryData): void {
    this.starfield = drawStarfield(this, { density: 1.6 });
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x05060d, 0.7);
    this.add
      .text(cx, cy - 130, 'VICTORY', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '88px',
        color: '#ffd23a',
        fontStyle: '900',
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#ffd23a', 28, true, true);
    this.add
      .text(cx, cy - 40, 'all stations cleared', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '20px',
        color: '#9bf2ff',
      })
      .setOrigin(0.5);
    this.add
      .text(cx, cy + 10, `FINAL SCORE  ${formatScore(data.score)}`, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '26px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 100, 'ENTER  play again         ESC  menu', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#9bf2ff',
      })
      .setOrigin(0.5);

    const replay = () => {
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
      replay();
    });
    this.input.keyboard?.once('keydown-SPACE', () => {
      getAudio().playSfx('uiSelect');
      replay();
    });
    this.input.keyboard?.once('keydown-ESC', menu);
    this.input.once('pointerdown', replay);
  }

  override update(_t: number, delta: number): void {
    this.starfield?.update(delta);
  }
}

function formatScore(n: number): string {
  return Math.max(0, n | 0).toString().padStart(7, '0');
}
