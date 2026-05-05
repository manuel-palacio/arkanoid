import Phaser from 'phaser';
import { Tuning } from './tuning';

export const GAME_WIDTH = Tuning.playfield.width;
export const GAME_HEIGHT = Tuning.playfield.height;

export const SceneKeys = {
  Boot: 'BootScene',
  Preload: 'PreloadScene',
  MainMenu: 'MainMenuScene',
  Game: 'GameScene',
  UI: 'UIScene',
  Pause: 'PauseScene',
  GameOver: 'GameOverScene',
  Victory: 'VictoryScene',
} as const;

export const RegistryKeys = {
  Score: 'score',
  HighScore: 'highScore',
  Lives: 'lives',
  LevelIndex: 'levelIndex',
  MusicVolume: 'musicVolume',
  SfxVolume: 'sfxVolume',
  Muted: 'muted',
  Debug: 'debug',
} as const;

export const Events = {
  ScoreChanged: 'score-changed',
  LivesChanged: 'lives-changed',
  LevelChanged: 'level-changed',
  PowerUpActivated: 'powerup-activated',
  PowerUpExpired: 'powerup-expired',
  GamePaused: 'game-paused',
  GameResumed: 'game-resumed',
  LevelComplete: 'level-complete',
  GameOver: 'game-over',
  GameVictory: 'game-victory',
  Combo: 'combo',
} as const;

export function createPhaserConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#05060d',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    pixelArt: false,
    antialias: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      // Lower bound prevents Phaser rendering at sub-100px on tiny
      // emulators / devtools previews; upper bound keeps the canvas at
      // its logical size on 4K monitors instead of upscaling blurry.
      min: { width: 270, height: 480 },
      max: { width: GAME_WIDTH, height: GAME_HEIGHT },
    },
    physics: {
      // We use Arcade Physics only for collider helpers and overlap; bounce
      // logic is custom (see CollisionSystem) so gravity and world bounce are
      // disabled.
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    input: {
      activePointers: 3,
    },
    fps: {
      target: 60,
      forceSetTimeOut: false,
    },
    render: {
      powerPreference: 'high-performance',
    },
  };
}
