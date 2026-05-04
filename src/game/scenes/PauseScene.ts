import Phaser from 'phaser';
import { Events, GAME_HEIGHT, GAME_WIDTH, RegistryKeys, SceneKeys } from '../config/gameConfig';
import { getAudio } from '../audio/AudioManager';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Pause);
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65);
    this.add
      .text(cx, cy - 80, 'PAUSED', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '64px',
        color: '#9bf2ff',
        fontStyle: '900',
      })
      .setOrigin(0.5);
    const muted = !!this.registry.get(RegistryKeys.Muted);
    const tip = this.add
      .text(
        cx,
        cy - 10,
        ['ENTER  resume', 'M  ' + (muted ? 'unmute' : 'mute'), 'Q  quit to menu'].join('   '),
        {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#ffffff',
        },
      )
      .setOrigin(0.5);

    const resume = () => {
      this.scene.resume(SceneKeys.Game);
      this.scene.get(SceneKeys.Game).events.emit(Events.GameResumed);
      this.scene.stop();
    };
    const toMenu = () => {
      this.scene.stop(SceneKeys.UI);
      this.scene.stop(SceneKeys.Game);
      this.scene.stop();
      this.scene.start(SceneKeys.MainMenu);
    };
    this.input.keyboard?.once('keydown-ENTER', resume);
    this.input.keyboard?.once('keydown-P', resume);
    this.input.keyboard?.once('keydown-ESC', resume);
    this.input.keyboard?.once('keydown-Q', toMenu);
    this.input.keyboard?.on('keydown-M', () => {
      const m = !this.registry.get(RegistryKeys.Muted);
      this.registry.set(RegistryKeys.Muted, m);
      getAudio().setMuted(m);
      tip.setText(['ENTER  resume', 'M  ' + (m ? 'unmute' : 'mute'), 'Q  quit to menu'].join('   '));
    });
    this.input.once('pointerdown', resume);
  }
}
