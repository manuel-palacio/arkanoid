import Phaser from 'phaser';
import { RegistryKeys, SceneKeys } from '../config/gameConfig';
import { Tuning } from '../config/tuning';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    // Defaults if registry was untouched.
    const reg = this.registry;
    if (reg.get(RegistryKeys.MusicVolume) == null) {
      reg.set(RegistryKeys.MusicVolume, Tuning.audio.musicDefault);
    }
    if (reg.get(RegistryKeys.SfxVolume) == null) {
      reg.set(RegistryKeys.SfxVolume, Tuning.audio.sfxDefault);
    }
    if (reg.get(RegistryKeys.Muted) == null) reg.set(RegistryKeys.Muted, false);
    if (reg.get(RegistryKeys.HighScore) == null) reg.set(RegistryKeys.HighScore, 0);
    this.scene.start(SceneKeys.Preload);
  }
}
