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
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);
    this.add
      .text(cx, cy - 140, 'PAUSED', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '56px',
        color: '#9bf2ff',
        fontStyle: '900',
      })
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

    this.makeButton(cx, cy + 0, '▶  RESUME', '#9bf2ff', resume);
    const muteState = () =>
      this.registry.get(RegistryKeys.Muted) ? '🔇  UNMUTE' : '🔊  MUTE';
    const muteBtnText = (this.makeButton(cx, cy + 70, muteState(), '#ffffff', () => {
      const m = !this.registry.get(RegistryKeys.Muted);
      this.registry.set(RegistryKeys.Muted, m);
      getAudio().setMuted(m);
      muteBtnText.setText(muteState());
    }) as unknown as { label: Phaser.GameObjects.Text }).label;
    this.makeButton(cx, cy + 140, '⏹  QUIT TO MENU', '#ff5d6c', toMenu);

    // Keyboard shortcuts still work for desktop muscle memory.
    this.input.keyboard?.once('keydown-ENTER', resume);
    this.input.keyboard?.once('keydown-P', resume);
    this.input.keyboard?.once('keydown-ESC', resume);
    this.input.keyboard?.once('keydown-Q', toMenu);
    this.input.keyboard?.on('keydown-M', () => {
      const m = !this.registry.get(RegistryKeys.Muted);
      this.registry.set(RegistryKeys.Muted, m);
      getAudio().setMuted(m);
      muteBtnText.setText(muteState());
    });
    // No global pointerdown-to-resume — explicit buttons only so the
    // user doesn't accidentally dismiss the pause overlay.
  }

  private makeButton(
    x: number,
    y: number,
    text: string,
    color: string,
    onTap: () => void,
  ): { container: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text } {
    const w = 280;
    const h = 52;
    const bg = this.add
      .rectangle(0, 0, w, h, 0x0e1530, 0.95)
      .setStrokeStyle(2, hexToInt(color), 0.8);
    const label = this.add
      .text(0, 0, text, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '18px',
        color,
        fontStyle: '700',
      })
      .setOrigin(0.5);
    const c = this.add.container(x, y, [bg, label]).setSize(w, h);
    c.setInteractive(
      new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    c.on('pointerdown', () => {
      bg.setFillStyle(hexToInt(color), 0.18);
      onTap();
    });
    c.on('pointerup', () => bg.setFillStyle(0x0e1530, 0.95));
    c.on('pointerout', () => bg.setFillStyle(0x0e1530, 0.95));
    return { container: c, label };
  }
}

function hexToInt(c: string): number {
  return parseInt(c.replace('#', ''), 16);
}
