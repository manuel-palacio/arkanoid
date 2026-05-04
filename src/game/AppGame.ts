import Phaser from 'phaser';
import { createPhaserConfig, RegistryKeys, SceneKeys } from './config/gameConfig';
import { Tuning } from './config/tuning';
import { getAudio } from './audio/AudioManager';
import { loadStreak, saveStreak, tickStreak, ymd } from './data/streak';
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

  // Daily streak: tick once on boot. If the player returned the next
  // calendar day, they earn a pending bonus life (consumed when they
  // press PLAY). The MainMenuScene reads the days count to render a
  // streak badge.
  const streakResult = tickStreak(loadStreak(), ymd());
  saveStreak(streakResult.state);
  game.registry.set('streakDays', streakResult.state.days);
  game.registry.set('streakBonusPending', streakResult.state.bonusPending);

  // Tear down the AudioManager singleton when the game is destroyed (Vite
  // HMR or page-unload). Browsers cap concurrent AudioContexts at ~6, so
  // leaking one per reload silently kills audio after a few HMR cycles.
  game.events.once(Phaser.Core.Events.DESTROY, () => getAudio().destroy());

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      getAudio().destroy();
      game.destroy(true);
    });
  }

  // Mute when the tab/app is backgrounded; resume when foreground. Belt-
  // and-suspenders: even though GameScene auto-pauses, browsers may
  // continue to drive audio if the canvas is rendering. Suspending the
  // AudioContext outright stops every track instantly.
  document.addEventListener('visibilitychange', () => {
    const audio = getAudio();
    if (document.visibilityState === 'hidden') audio.suspend();
    else audio.resume();
  });
  window.addEventListener('blur', () => getAudio().suspend());
  window.addEventListener('focus', () => getAudio().resume());
  window.addEventListener('pagehide', () => getAudio().suspend());

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
