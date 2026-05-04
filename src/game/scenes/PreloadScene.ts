import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RegistryKeys, SceneKeys } from '../config/gameConfig';
import { generateTextures } from '../utils/textures';
import { TextureFactory } from '../gfx/TextureFactory';
import { getAudio } from '../audio/AudioManager';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  create(): void {
    // Procedural textures (no disk loads). Legacy textures (paddle-base,
    // ball, spark, etc.) are still generated for systems that haven't been
    // migrated yet; the candy textures live alongside them under new keys.
    generateTextures(this);
    new TextureFactory(this).generateAll();

    // Loading UI — a brief progress bar while the AudioManager builds buffers.
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const bgBar = this.add.rectangle(cx, cy + 30, 360, 8, 0x0e1530).setStrokeStyle(1, 0x9bf2ff);
    const fillBar = this.add.rectangle(cx - 178, cy + 30, 0, 6, 0x9bf2ff).setOrigin(0, 0.5);
    const title = this.add
      .text(cx, cy - 20, 'BRICKSTORM', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '52px',
        color: '#9bf2ff',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#4ad6ff', 24, true, true);
    const sub = this.add
      .text(cx, cy + 60, 'preparing oscillators…', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        color: '#5ea8c5',
      })
      .setOrigin(0.5);

    // Animate progress bar while we render audio.
    const tween = this.tweens.addCounter({
      from: 0,
      to: 90,
      duration: 1200,
      onUpdate: (t) => {
        const pct = t.getValue() ?? 0;
        fillBar.width = (pct / 100) * 356;
      },
    });

    const audio = getAudio();
    audio
      .preload()
      .then(() => {
        tween.stop();
        fillBar.width = 356;
        sub.setText('ready');
        const muted = !!this.registry.get(RegistryKeys.Muted);
        const mvol = Number(this.registry.get(RegistryKeys.MusicVolume));
        const svol = Number(this.registry.get(RegistryKeys.SfxVolume));
        audio.setMuted(muted);
        audio.setMusicVolume(isFinite(mvol) ? mvol : 0.5);
        audio.setSfxVolume(isFinite(svol) ? svol : 0.85);
        this.time.delayedCall(150, () => {
          [bgBar, fillBar, title, sub].forEach((o) => o.destroy());
          this.scene.start(SceneKeys.MainMenu);
        });
      })
      .catch((err: unknown) => {
        console.warn('Audio preload failed (continuing silently)', err);
        this.scene.start(SceneKeys.MainMenu);
      });
  }
}
