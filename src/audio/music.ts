// Generative ambient music for ALUR — a slow, dark factory pulse
// synthesized live with the Web Audio API. No audio files: a lookahead
// step sequencer plays a soft sub-bass pulse, sparse plucked notes from
// an A-minor pentatonic pattern, and a detuned pad chord each bar.
// Kept deliberately quiet and slow so it sits under the game, not on it.
// The context starts only from a user gesture (App's first pointerdown
// or the Settings toggle), matching browser autoplay rules.

const MUSIC_KEY = 'alur-music-muted';
const MASTER_VOLUME = 0.11;
const STEP_SECONDS = 0.46; // 16 steps per bar ≈ 7.4 s per bar
const STEPS = 16;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: number | null = null;
let nextStepTime = 0;
let stepIndex = 0;
let musicMuted = loadMusicMuted();

function loadMusicMuted(): boolean {
  try {
    return localStorage.getItem(MUSIC_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMusicMuted(): boolean {
  return musicMuted;
}

export function setMusicMuted(value: boolean): void {
  musicMuted = value;
  try {
    localStorage.setItem(MUSIC_KEY, value ? '1' : '0');
  } catch {
    // Storage unavailable; the in-memory flag still applies.
  }
  if (value) stopMusic();
  else startMusic();
}

function ensureContext(): boolean {
  if (typeof window === 'undefined') return false;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = MASTER_VOLUME;
    const warmth = ctx.createBiquadFilter();
    warmth.type = 'lowpass';
    warmth.frequency.value = 1400;
    master.connect(warmth);
    warmth.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return true;
}

// A-minor pentatonic pluck pattern (Hz), 0 = rest. Two bars alternate.
const PLUCK_A = [220, 0, 0, 261.63, 0, 0, 329.63, 0, 293.66, 0, 0, 0, 196, 0, 329.63, 0];
const PLUCK_B = [220, 0, 0, 0, 0, 261.63, 0, 0, 392, 0, 0, 329.63, 0, 0, 0, 0];
const BASS = [55, 82.41]; // A1 on bar A, E2 on bar B

function tone(
  freq: number,
  at: number,
  dur: number,
  type: OscillatorType,
  peak: number,
  attack = 0.01,
): void {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

function scheduleStep(step: number, at: number): void {
  const bar = Math.floor(stepIndex / STEPS) % 2;
  if (step === 0) {
    // Bar start: sub-bass pulse + a soft detuned pad (root + third).
    const root = BASS[bar];
    tone(root, at, STEP_SECONDS * 6, 'sine', 0.5, 0.05);
    tone(110, at, STEP_SECONDS * STEPS, 'triangle', 0.1, 1.2);
    tone(130.81, at, STEP_SECONDS * STEPS, 'triangle', 0.07, 1.6);
  }
  if (step === 8) {
    tone(BASS[bar], at, STEP_SECONDS * 4, 'sine', 0.35, 0.05);
  }
  const pluck = (bar === 0 ? PLUCK_A : PLUCK_B)[step];
  if (pluck > 0) {
    tone(pluck, at, 0.5, 'triangle', 0.32);
    tone(pluck * 2, at, 0.22, 'sine', 0.06);
  }
}

function tick(): void {
  if (!ctx) return;
  while (nextStepTime < ctx.currentTime + 0.3) {
    scheduleStep(stepIndex % STEPS, nextStepTime);
    nextStepTime += STEP_SECONDS;
    stepIndex += 1;
  }
}

export function startMusic(): void {
  if (musicMuted || timer !== null) return;
  if (!ensureContext() || !ctx) return;
  stepIndex = 0;
  nextStepTime = ctx.currentTime + 0.06;
  timer = window.setInterval(tick, 110);
}

export function stopMusic(): void {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
  if (ctx) void ctx.suspend();
}
