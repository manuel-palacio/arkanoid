/**
 * Tiny WebAudio synth used to generate all SFX and music procedurally.
 * Returns AudioBuffers we register with Phaser's SoundManager via Phaser.Sound
 * .addAudioSprite is overkill for this — we just play AudioBuffers directly
 * through a routed gain bus.
 */

export interface AudioBus {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
}

export function createBus(ctx: AudioContext): AudioBus {
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);

  const music = ctx.createGain();
  music.gain.value = 0.5;
  music.connect(master);

  const sfx = ctx.createGain();
  sfx.gain.value = 0.85;
  sfx.connect(master);
  return { ctx, master, music, sfx };
}

type Wave = OscillatorType;

interface ToneOpts {
  freq: number;
  freqEnd?: number;
  durationMs: number;
  type?: Wave;
  attackMs?: number;
  releaseMs?: number;
  volume?: number;
  filterFreq?: number;
}

export async function renderToneAsync(opts: ToneOpts): Promise<AudioBuffer> {
  const sampleRate = 44100;
  const length = Math.max(64, Math.ceil((opts.durationMs / 1000) * sampleRate));
  const ctx = new OfflineAudioContext(1, length, sampleRate);
  const osc = ctx.createOscillator();
  osc.type = opts.type ?? 'square';
  osc.frequency.setValueAtTime(opts.freq, 0);
  if (opts.freqEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, opts.freqEnd),
      opts.durationMs / 1000,
    );
  }
  const gain = ctx.createGain();
  const v = opts.volume ?? 0.45;
  const a = (opts.attackMs ?? 4) / 1000;
  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(v, a);
  gain.gain.linearRampToValueAtTime(0, opts.durationMs / 1000);

  let last: AudioNode = osc;
  if (opts.filterFreq) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = opts.filterFreq;
    last.connect(filter);
    last = filter;
  }
  last.connect(gain);
  gain.connect(ctx.destination);
  osc.start(0);
  osc.stop(opts.durationMs / 1000);
  return ctx.startRendering();
}

/** Render a noise burst (used for explosions / brick break). */
export async function renderNoiseAsync(opts: {
  durationMs: number;
  filterFreq?: number;
  filterEnd?: number;
  volume?: number;
}): Promise<AudioBuffer> {
  const sampleRate = 44100;
  const length = Math.max(64, Math.ceil((opts.durationMs / 1000) * sampleRate));
  const ctx = new OfflineAudioContext(1, length, sampleRate);

  // Generate noise into a buffer source.
  const noiseBuf = ctx.createBuffer(1, length, sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(opts.filterFreq ?? 4000, 0);
  if (opts.filterEnd != null) {
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(80, opts.filterEnd),
      opts.durationMs / 1000,
    );
  }

  const gain = ctx.createGain();
  const v = opts.volume ?? 0.4;
  gain.gain.setValueAtTime(v, 0);
  gain.gain.linearRampToValueAtTime(0, opts.durationMs / 1000);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(0);
  src.stop(opts.durationMs / 1000);
  return ctx.startRendering();
}

/**
 * Stitch a small chiptune loop together (menu and gameplay get different
 * notes/tempo). Returned as a single AudioBuffer suitable for looped playback.
 */
export async function renderChiptuneLoopAsync(opts: {
  bpm: number;
  notes: number[]; // midi numbers
  steps: number; // total steps in the loop
  type?: Wave;
  volume?: number;
  filterFreq?: number;
}): Promise<AudioBuffer> {
  const sampleRate = 44100;
  const stepSec = 60 / opts.bpm / 2; // 8th notes
  const length = Math.ceil(stepSec * opts.steps * sampleRate);
  const ctx = new OfflineAudioContext(1, length, sampleRate);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = opts.filterFreq ?? 1800;
  filter.connect(ctx.destination);

  for (let i = 0; i < opts.steps; i++) {
    const note = opts.notes[i % opts.notes.length];
    if (note == null || note <= 0) continue;
    const freq = 440 * Math.pow(2, (note - 69) / 12);
    const start = i * stepSec;
    const dur = stepSec * 0.9;

    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'square';
    osc.frequency.value = freq;

    const g = ctx.createGain();
    const v = opts.volume ?? 0.18;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(v, start + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(g);
    g.connect(filter);
    osc.start(start);
    osc.stop(start + dur);
  }
  return ctx.startRendering();
}
