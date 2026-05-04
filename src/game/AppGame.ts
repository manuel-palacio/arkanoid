import Phaser from 'phaser';
import { createPhaserConfig, RegistryKeys, SceneKeys } from './config/gameConfig';
import { Tuning } from './config/tuning';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { PauseScene } from './scenes/PauseScene';
import { GameOverScene } from './scenes/GameOverScene';
import { VictoryScene } from './scenes/VictoryScene';

export interface AppGameOptions {
  parent: HTMLElement;
  /** debug overlay flag (driven by ?debug=1) */
  debug?: boolean;
}

export function createGame(opts: AppGameOptions): Phaser.Game {
  const cfg = createPhaserConfig(opts.parent);
  const game = new Phaser.Game({
    ...cfg,
    scene: [
      BootScene,
      PreloadScene,
      MainMenuScene,
      GameScene,
      UIScene,
      PauseScene,
      GameOverScene,
      VictoryScene,
    ],
  });

  game.registry.set(RegistryKeys.MusicVolume, Tuning.audio.musicDefault);
  game.registry.set(RegistryKeys.SfxVolume, Tuning.audio.sfxDefault);
  game.registry.set(RegistryKeys.Muted, false);
  game.registry.set(RegistryKeys.Debug, !!opts.debug);
  game.registry.set(RegistryKeys.HighScore, loadHighScore());

  return game;
}

function loadHighScore(): number {
  try {
    const raw = localStorage.getItem('brickstorm.highscore');
    return raw ? Math.max(0, Number.parseInt(raw, 10) || 0) : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(value: number): void {
  try {
    localStorage.setItem('brickstorm.highscore', String(Math.max(0, value | 0)));
  } catch {
    /* ignore */
  }
}

export const Scenes = SceneKeys;
