// Synthesized sound effects for ALUR, generated with the Web Audio API.
// No audio files are used; every sound is a short oscillator/noise burst
// shaped by an envelope. The context is created lazily and only resumed
// from user-initiated flows, so nothing plays before the first gesture.

const MUTE_KEY = 'alur-sfx-muted';
const MASTER_VOLUME = 0.5;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = loadMuted();
let lastHopAt = 0;
let collectStep = 0;

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // Storage unavailable; the in-memory flag still applies.
  }
}

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

interface ToneOpts {
  freq: number;
  freqEnd?: number;
  type?: OscillatorType;
  dur: number;
  gain?: number;
  delay?: number;
}

function tone({ freq, freqEnd, type = 'sine', dur, gain = 0.2, delay = 0 }: ToneOpts): void {
  const ac = ensureContext();
  if (!ac || !master || muted) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  }
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env);
  env.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

interface NoiseOpts {
  dur: number;
  gain?: number;
  freq?: number;
  delay?: number;
}

function noiseBurst({ dur, gain = 0.15, freq = 900, delay = 0 }: NoiseOpts): void {
  const ac = ensureContext();
  if (!ac || !master || muted) return;
  const t0 = ac.currentTime + delay;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  const env = ac.createGain();
  env.gain.setValueAtTime(gain, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(env);
  env.connect(master);
  src.start(t0);
}

export const sfx = {
  /** Generic UI button click: a short, soft tick. */
  click(): void {
    tone({ freq: 640, freqEnd: 520, dur: 0.055, gain: 0.12 });
  },

  /** Selecting a machine in the rack: a gentle gel pop rising in pitch. */
  select(): void {
    tone({ freq: 360, freqEnd: 540, dur: 0.075, gain: 0.16 });
  },

  /** Placing a machine on the board: a wooden knock with a low body. */
  place(): void {
    tone({ freq: 190, freqEnd: 120, type: 'triangle', dur: 0.1, gain: 0.28 });
    noiseBurst({ dur: 0.05, gain: 0.1, freq: 700 });
  },

  /** Connecting a pipe: a bright little glass tink. */
  connect(): void {
    tone({ freq: 880, dur: 0.09, gain: 0.14 });
    tone({ freq: 1320, dur: 0.07, gain: 0.06, delay: 0.012 });
  },

  /** Removing a pipe or returning a machine: a descending pop. */
  remove(): void {
    tone({ freq: 430, freqEnd: 250, dur: 0.075, gain: 0.14 });
  },

  /** Pressing RUN: a short rising chirp. Also resets the collect ladder. */
  runStart(): void {
    collectStep = 0;
    tone({ freq: 300, freqEnd: 720, type: 'triangle', dur: 0.16, gain: 0.16 });
  },

  /** A token hopping one step. Throttled so dense flows stay soft. */
  hop(): void {
    const now = performance.now();
    if (now - lastHopAt < 55) return;
    lastHopAt = now;
    tone({ freq: 500, freqEnd: 460, dur: 0.03, gain: 0.045 });
  },

  /** A token changing color inside CHANGE: a smooth gel shimmer. */
  transform(): void {
    tone({ freq: 480, freqEnd: 940, dur: 0.13, gain: 0.13 });
    tone({ freq: 960, freqEnd: 1400, dur: 0.1, gain: 0.05, delay: 0.02 });
  },

  /** A token shredded by FILTER: a short crunch over a low thock. */
  trash(): void {
    noiseBurst({ dur: 0.09, gain: 0.15, freq: 1600 });
    noiseBurst({ dur: 0.07, gain: 0.09, freq: 800, delay: 0.03 });
    tone({ freq: 170, freqEnd: 90, type: 'triangle', dur: 0.09, gain: 0.16 });
  },

  /** A token arriving at an Output: a glass ding that climbs per arrival. */
  collect(): void {
    const steps = [0, 3, 5, 7, 10, 12];
    const semis = steps[Math.min(collectStep, steps.length - 1)];
    collectStep++;
    const base = 1046 * Math.pow(2, semis / 12);
    tone({ freq: base, dur: 0.2, gain: 0.13 });
    tone({ freq: base * 1.5, dur: 0.14, gain: 0.05 });
  },

  /** BUFFER releasing a full pack: a low double pop. */
  bufferRelease(): void {
    tone({ freq: 240, freqEnd: 330, dur: 0.09, gain: 0.2 });
    tone({ freq: 330, freqEnd: 430, dur: 0.09, gain: 0.16, delay: 0.07 });
  },

  /** Stuck token or failed verdict: a short, dull, polite buzz. */
  error(): void {
    tone({ freq: 150, freqEnd: 130, type: 'sawtooth', dur: 0.22, gain: 0.07 });
    tone({ freq: 110, type: 'triangle', dur: 0.22, gain: 0.1 });
  },

  /** Winning a level: a short four-note jingle for the stamp and stars. */
  win(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      tone({ freq: f, type: 'triangle', dur: 0.24, gain: 0.16, delay: i * 0.11 });
      tone({ freq: f * 2, dur: 0.16, gain: 0.04, delay: i * 0.11 });
    });
  },
};
