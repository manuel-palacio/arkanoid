import Phaser from 'phaser';
import { renderChiptuneLoopAsync, renderNoiseAsync, renderToneAsync, createBus, type AudioBus } from './synth';

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
  | 'uiSelect';

export type MusicKey = 'menu' | 'game';

interface PlayingMusic {
  src: AudioBufferSourceNode;
  startedAt: number;
}

/**
 * Procedural audio layer. All buffers are generated once at preload via
 * OfflineAudioContext, then routed through a music/sfx bus on a single
 * resumable AudioContext. We deliberately do NOT use Phaser's BaseSoundManager
 * here because we want sub-frame trigger and fine WebAudio control; Phaser
 * still owns the user-gesture lifecycle (we listen to its scale.input).
 */
export class AudioManager {
  private bus: AudioBus | null = null;
  private sfx = new Map<SfxKey, AudioBuffer>();
  private music = new Map<MusicKey, AudioBuffer>();
  private currentMusic: PlayingMusic | null = null;
  private currentMusicKey: MusicKey | null = null;
  private muted = false;
  private musicVol = 0.5;
  private sfxVol = 0.85;
  private ready = false;
  private readyPromise: Promise<void> | null = null;

  /** Build all buffers (call once during PreloadScene). */
  async preload(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this.buildAll();
    await this.readyPromise;
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  /** Resume / create the playable AudioContext on first user gesture. */
  unlock(): void {
    if (this.bus) {
      if (this.bus.ctx.state === 'suspended') void this.bus.ctx.resume();
      return;
    }
    type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };
    const w = window as WindowWithWebkit;
    const Ctor: typeof AudioContext | undefined = window.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.bus = createBus(ctx);
    this.applyVolumes();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolumes();
  }

  setMusicVolume(v: number): void {
    this.musicVol = Phaser.Math.Clamp(v, 0, 1);
    this.applyVolumes();
  }

  setSfxVolume(v: number): void {
    this.sfxVol = Phaser.Math.Clamp(v, 0, 1);
    this.applyVolumes();
  }

  playSfx(key: SfxKey, volume = 1): void {
    if (!this.bus || this.muted || !this.ready) return;
    const buf = this.sfx.get(key);
    if (!buf) return;
    const src = this.bus.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.bus.ctx.createGain();
    g.gain.value = volume;
    src.connect(g);
    g.connect(this.bus.sfx);
    src.start();
  }

  playMusic(key: MusicKey): void {
    if (!this.bus || !this.ready) return;
    if (this.currentMusicKey === key && this.currentMusic) return;
    this.stopMusic();
    const buf = this.music.get(key);
    if (!buf) return;
    const src = this.bus.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.bus.music);
    src.start();
    this.currentMusic = { src, startedAt: this.bus.ctx.currentTime };
    this.currentMusicKey = key;
  }

  /**
   * Tear down the AudioContext so a new manager (e.g. on Vite HMR) can
   * claim a fresh one. Browsers cap concurrent contexts at ~6, so leaks
   * here cause silent audio failure during dev sessions.
   */
  destroy(): void {
    this.stopMusic();
    if (this.bus) {
      void this.bus.ctx.close().catch(() => {});
    }
    this.bus = null;
    this.sfx.clear();
    this.music.clear();
    this.ready = false;
    this.readyPromise = null;
    instance = null;
  }

  stopMusic(): void {
    if (!this.currentMusic) return;
    try {
      this.currentMusic.src.stop();
    } catch {
      /* already stopped */
    }
    this.currentMusic.src.disconnect();
    this.currentMusic = null;
    this.currentMusicKey = null;
  }

  // ---------- internals ----------

  private applyVolumes(): void {
    if (!this.bus) return;
    this.bus.master.gain.value = this.muted ? 0 : 1;
    this.bus.music.gain.value = this.musicVol;
    this.bus.sfx.gain.value = this.sfxVol;
  }

  private async buildAll(): Promise<void> {
    // SFX
    const [
      paddle,
      wall,
      brickHit,
      brickBreak,
      powerupDrop,
      powerupGet,
      lifeLost,
      laser,
      levelComplete,
      gameOver,
      uiMove,
      uiSelect,
    ] = await Promise.all([
      renderToneAsync({ freq: 440, freqEnd: 660, durationMs: 70, type: 'square', volume: 0.35 }),
      renderToneAsync({ freq: 320, freqEnd: 280, durationMs: 50, type: 'square', volume: 0.25 }),
      renderToneAsync({ freq: 720, freqEnd: 540, durationMs: 60, type: 'square', volume: 0.30 }),
      renderNoiseAsync({ durationMs: 180, filterFreq: 5000, filterEnd: 200, volume: 0.55 }),
      renderToneAsync({ freq: 220, freqEnd: 110, durationMs: 220, type: 'sine', volume: 0.30 }),
      renderToneAsync({ freq: 660, freqEnd: 1320, durationMs: 180, type: 'square', volume: 0.45 }),
      renderToneAsync({ freq: 200, freqEnd: 70, durationMs: 500, type: 'sawtooth', volume: 0.55, filterFreq: 1200 }),
      renderToneAsync({ freq: 1400, freqEnd: 720, durationMs: 90, type: 'square', volume: 0.30 }),
      this.buildLevelCompleteJingle(),
      renderToneAsync({ freq: 420, freqEnd: 60, durationMs: 1100, type: 'sawtooth', volume: 0.55, filterFreq: 1500 }),
      renderToneAsync({ freq: 880, freqEnd: 880, durationMs: 30, type: 'square', volume: 0.18 }),
      renderToneAsync({ freq: 880, freqEnd: 1320, durationMs: 90, type: 'square', volume: 0.30 }),
    ]);

    this.sfx.set('paddle', paddle);
    this.sfx.set('wall', wall);
    this.sfx.set('brickHit', brickHit);
    this.sfx.set('brickBreak', brickBreak);
    this.sfx.set('powerupDrop', powerupDrop);
    this.sfx.set('powerupGet', powerupGet);
    this.sfx.set('lifeLost', lifeLost);
    this.sfx.set('laser', laser);
    this.sfx.set('levelComplete', levelComplete);
    this.sfx.set('gameOver', gameOver);
    this.sfx.set('uiMove', uiMove);
    this.sfx.set('uiSelect', uiSelect);

    // Music — A minor pentatonic/arpeggio loops. Numbers are MIDI; 0 = rest.
    const menuLoop = await renderChiptuneLoopAsync({
      bpm: 92,
      notes: [57, 0, 60, 0, 64, 0, 67, 64, 60, 0, 64, 0, 67, 0, 72, 64],
      steps: 16,
      type: 'triangle',
      volume: 0.22,
      filterFreq: 1800,
    });
    const gameLoop = await renderChiptuneLoopAsync({
      bpm: 132,
      notes: [
        57, 60, 64, 67, 64, 60, 64, 67,
        69, 65, 60, 64, 60, 57, 60, 64,
        62, 65, 69, 72, 69, 65, 69, 72,
        67, 63, 60, 63, 60, 56, 60, 63,
      ],
      steps: 32,
      type: 'square',
      volume: 0.18,
      filterFreq: 2200,
    });
    this.music.set('menu', menuLoop);
    this.music.set('game', gameLoop);
  }

  private async buildLevelCompleteJingle(): Promise<AudioBuffer> {
    // Stitch 4 ascending tones into one buffer.
    const sampleRate = 44100;
    const totalMs = 700;
    const ctx = new OfflineAudioContext(1, Math.ceil((totalMs / 1000) * sampleRate), sampleRate);
    const notes = [60, 64, 67, 72];
    const stepMs = totalMs / notes.length;
    notes.forEach((n, i) => {
      const freq = 440 * Math.pow(2, (n - 69) / 12);
      const start = (i * stepMs) / 1000;
      const dur = (stepMs * 0.9) / 1000;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.4, start + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur);
    });
    return ctx.startRendering();
  }
}

/** Singleton helper, one per game. */
let instance: AudioManager | null = null;
export function getAudio(): AudioManager {
  if (!instance) instance = new AudioManager();
  return instance;
}
