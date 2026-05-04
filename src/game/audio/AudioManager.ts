import { Howl, Howler } from 'howler';

/**
 * Audio layer for Brickstorm.
 *
 * NOTE on assets: the .ogg files in public/audio/ are placeholders
 * generated locally with ffmpeg sine bursts. They sound tinny on
 * purpose — the intent is to replace them with proper free-licensed
 * arcade SFX. Drop-in replacement filenames must stay the same.
 *
 * Recommended replacements (CC0):
 *   Kenney "Interface Sounds":   https://kenney.nl/assets/interface-sounds
 *     -> ui-move.ogg, ui-click.ogg
 *   Kenney "Sci-Fi Sounds":      https://kenney.nl/assets/sci-fi-sounds
 *     -> paddle-hit.ogg, wall-hit.ogg, brick-hit.ogg, brick-break.ogg, laser.ogg
 *   Kenney "Music Jingles":      https://kenney.nl/assets/music-jingles
 *     -> level-complete.ogg, game-over.ogg
 *   Kenney "Impact Sounds":      https://kenney.nl/assets/impact-sounds
 *     -> life-lost.ogg, powerup-get.ogg
 *   OpenGameArt menu/game music:
 *     -> music-menu.ogg, music-game.ogg
 *
 * Whenever you add real assets, append a CC0 / CC-BY attribution row
 * to CREDITS.md.
 */

export type SfxKey =
  | 'paddle'
  | 'wall'
  | 'brickHit'
  | 'brickBreak'
  | 'powerupDrop'
  | 'powerupGet'
  | 'lifeLost'
  | 'laser'
  | 'levelComplete'
  | 'gameOver'
  | 'uiMove'
  | 'uiSelect'
  | 'heartbeat';

export type MusicKey = 'menu' | 'game';

interface SfxConfig {
  src: string;
  volume: number;
  rate?: number;
  /** maximum simultaneous plays of this sound */
  poly?: number;
  /** ±semitone-equivalent rate jitter applied per playback (0..1) */
  jitter?: number;
}

const SFX_CONFIG: Record<SfxKey, SfxConfig> = {
  paddle: { src: '/audio/paddle-hit.ogg', volume: 0.55, poly: 2, jitter: 0.1 },
  wall: { src: '/audio/wall-hit.ogg', volume: 0.35, poly: 4 },
  brickHit: { src: '/audio/brick-hit.ogg', volume: 0.45, poly: 4, jitter: 0.05 },
  brickBreak: { src: '/audio/brick-break.ogg', volume: 0.65, poly: 3 },
  powerupDrop: { src: '/audio/brick-hit.ogg', volume: 0.3, rate: 0.6, poly: 3 },
  powerupGet: { src: '/audio/powerup-get.ogg', volume: 0.7 },
  lifeLost: { src: '/audio/life-lost.ogg', volume: 0.75 },
  laser: { src: '/audio/laser.ogg', volume: 0.5, poly: 5 },
  levelComplete: { src: '/audio/level-complete.ogg', volume: 0.8 },
  gameOver: { src: '/audio/game-over.ogg', volume: 0.8 },
  uiMove: { src: '/audio/ui-move.ogg', volume: 0.25 },
  uiSelect: { src: '/audio/ui-click.ogg', volume: 0.45 },
  // Reuse paddle hit at very low pitch + low volume for the tension heartbeat.
  heartbeat: { src: '/audio/paddle-hit.ogg', volume: 0.3, rate: 0.3 },
};

const MUSIC_CONFIG: Record<MusicKey, { src: string }> = {
  menu: { src: '/audio/music-menu.ogg' },
  game: { src: '/audio/music-game.ogg' },
};

const MUSIC_BASE_VOLUME = 0.4;

export class AudioManager {
  private sfxHowls = new Map<SfxKey, Howl>();
  private musicHowls = new Map<MusicKey, Howl>();
  private currentMusic: { key: MusicKey; id: number } | null = null;
  private muted = false;
  private musicVol = 0.5;
  private sfxVol = 0.85;
  private ready = false;
  private readyPromise: Promise<void> | null = null;
  private activePlays = new Map<SfxKey, number>();

  async preload(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this.buildAll();
    await this.readyPromise;
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  /** Howler manages the AudioContext lifecycle; just resume on gesture. */
  unlock(): void {
    try {
      const ctx = Howler.ctx;
      if (ctx && ctx.state === 'suspended') void ctx.resume();
    } catch {
      /* ignore */
    }
  }

  suspend(): void {
    try {
      const ctx = Howler.ctx;
      if (ctx && ctx.state === 'running') void ctx.suspend();
    } catch {
      /* ignore */
    }
  }

  resume(): void {
    try {
      const ctx = Howler.ctx;
      if (ctx && ctx.state === 'suspended') void ctx.resume();
    } catch {
      /* ignore */
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try {
      Howler.mute(m);
    } catch {
      /* ignore */
    }
  }

  setMusicVolume(v: number): void {
    this.musicVol = Math.max(0, Math.min(1, v));
    if (this.currentMusic) {
      const howl = this.musicHowls.get(this.currentMusic.key);
      try {
        howl?.volume(MUSIC_BASE_VOLUME * this.musicVol, this.currentMusic.id);
      } catch {
        /* ignore */
      }
    }
  }

  setSfxVolume(v: number): void {
    this.sfxVol = Math.max(0, Math.min(1, v));
  }

  playSfx(key: SfxKey, volumeMul = 1): void {
    if (!this.ready || this.muted) return;
    const cfg = SFX_CONFIG[key];
    const howl = this.sfxHowls.get(key);
    if (!howl) return;
    // Polyphony cap.
    const poly = cfg.poly ?? Number.POSITIVE_INFINITY;
    const active = this.activePlays.get(key) ?? 0;
    if (active >= poly) return;
    try {
      const id = howl.play();
      // Apply per-play rate (with optional jitter for liveliness).
      const baseRate = cfg.rate ?? 1;
      const j = cfg.jitter ?? 0;
      const rate = j > 0 ? baseRate * (1 + (Math.random() * 2 - 1) * j) : baseRate;
      howl.rate(rate, id);
      // Final volume = config × global SFX × per-call multiplier.
      howl.volume(cfg.volume * this.sfxVol * volumeMul, id);
      this.activePlays.set(key, active + 1);
      howl.once(
        'end',
        () => {
          this.activePlays.set(key, Math.max(0, (this.activePlays.get(key) ?? 1) - 1));
        },
        id,
      );
      howl.once(
        'stop',
        () => {
          this.activePlays.set(key, Math.max(0, (this.activePlays.get(key) ?? 1) - 1));
        },
        id,
      );
    } catch {
      /* ignore */
    }
  }

  playMusic(key: MusicKey): void {
    if (!this.ready) return;
    if (this.currentMusic?.key === key) return;
    this.stopMusic();
    const howl = this.musicHowls.get(key);
    if (!howl) return;
    try {
      const id = howl.play();
      howl.volume(MUSIC_BASE_VOLUME * this.musicVol, id);
      this.currentMusic = { key, id };
    } catch {
      /* ignore */
    }
  }

  stopMusic(): void {
    if (!this.currentMusic) return;
    try {
      const howl = this.musicHowls.get(this.currentMusic.key);
      howl?.stop(this.currentMusic.id);
    } catch {
      /* ignore */
    }
    this.currentMusic = null;
  }

  destroy(): void {
    this.stopMusic();
    try {
      this.sfxHowls.forEach((h) => h.unload());
      this.musicHowls.forEach((h) => h.unload());
      Howler.unload();
    } catch {
      /* ignore */
    }
    this.sfxHowls.clear();
    this.musicHowls.clear();
    this.activePlays.clear();
    this.ready = false;
    this.readyPromise = null;
    instance = null;
  }

  // ---------- internals ----------

  private async buildAll(): Promise<void> {
    const sfxLoads: Array<Promise<void>> = [];

    (Object.keys(SFX_CONFIG) as SfxKey[]).forEach((key) => {
      const cfg = SFX_CONFIG[key];
      sfxLoads.push(
        new Promise<void>((resolve) => {
          const howl = new Howl({
            src: [cfg.src],
            html5: false,
            preload: true,
            volume: cfg.volume,
            rate: cfg.rate ?? 1,
          });
          howl.once('load', () => resolve());
          howl.once('loaderror', () => resolve()); // never block on missing assets
          this.sfxHowls.set(key, howl);
        }),
      );
    });

    const musicLoads: Array<Promise<void>> = [];
    (Object.keys(MUSIC_CONFIG) as MusicKey[]).forEach((key) => {
      const cfg = MUSIC_CONFIG[key];
      musicLoads.push(
        new Promise<void>((resolve) => {
          const howl = new Howl({
            src: [cfg.src],
            html5: true,
            preload: true,
            loop: true,
            volume: MUSIC_BASE_VOLUME,
          });
          howl.once('load', () => resolve());
          howl.once('loaderror', () => resolve());
          this.musicHowls.set(key, howl);
        }),
      );
    });

    await Promise.all([...sfxLoads, ...musicLoads]);
  }
}

let instance: AudioManager | null = null;
export function getAudio(): AudioManager {
  if (!instance) instance = new AudioManager();
  return instance;
}
