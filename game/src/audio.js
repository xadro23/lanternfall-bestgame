// Lanternfall's sound: one WebAudio context built on the first user gesture,
// three synthesised voices (the wick's burn, a moth's death, the player's hurt)
// and a slow two-note drone that keeps the valley from ever feeling silent.
// Nothing is sampled; each sound is an oscillator or a noise buffer, so the
// whole score ships with zero asset bytes.

let ctx = null;
let master = null;
let droneOn = false;

export function initAudio() {
  if (ctx) return ctx;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  return ctx;
}

function now() { return ctx.currentTime; }

// Noise buffer shared by every percussive voice.
let noiseBuf = null;
function noise() {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

// The drone: two detuned saws through a lowpass, barely audible, always on.
export function startDrone() {
  if (droneOn || !ctx) return;
  droneOn = true;
  const g = ctx.createGain();
  g.gain.value = 0.045;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 220;
  const a = ctx.createOscillator();
  a.type = 'sawtooth';
  a.frequency.value = 55;
  const b = ctx.createOscillator();
  b.type = 'sawtooth';
  b.frequency.value = 55 * 1.007;
  a.connect(f); b.connect(f); f.connect(g); g.connect(master);
  a.start(); b.start();
  // The drone swells a little each wave: setDroneLevel is called by the director.
  g._node = g;
  droneGain = g;
}
let droneGain = null;
export function setDroneLevel(level) {
  if (droneGain) droneGain.gain.setTargetAtTime(0.04 + level * 0.012, now(), 1.5);
}

// The beam's burn: a filtered noise loop whose gain follows the trigger.
export function burnOn() {
  if (!ctx || burnGain) return;
  const src = ctx.createBufferSource();
  src.buffer = noise(); src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.8;
  burnGain = ctx.createGain();
  burnGain.gain.value = 0.0;
  src.connect(f); f.connect(burnGain); burnGain.connect(master);
  src.start();
  burnSrc = src;
}
let burnGain = null, burnSrc = null;
export function burnLevel(level) {
  if (burnGain) burnGain.gain.setTargetAtTime(level * 0.16, now(), 0.05);
}
export function burnOff() {
  if (burnGain) { burnGain.gain.setTargetAtTime(0, now(), 0.08); }
}

// A moth dying: a short pitched chirp down into crackle.
export function mothDie() {
  if (!ctx) return;
  const t = now();
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(720 + Math.random() * 300, t);
  o.frequency.exponentialRampToValueAtTime(140, t + 0.16);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.16, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + 0.2);
  // crackle tail
  const src = ctx.createBufferSource();
  src.buffer = noise();
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2400;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.08, t + 0.05);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  src.connect(f); f.connect(ng); ng.connect(master);
  src.start(t + 0.05); src.stop(t + 0.24);
}

// The player is hurt: a low thud plus a brief pitch drop.
export function hurt() {
  if (!ctx) return;
  const t = now();
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(60, t + 0.22);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + 0.26);
}

// The pulse: a quick bright bloom.
export function pulse() {
  if (!ctx) return;
  const t = now();
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(320, t);
  o.frequency.exponentialRampToValueAtTime(1100, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + 0.18);
}

// Wave clear: two rising notes.
export function waveClear() {
  if (!ctx) return;
  const t = now();
  [440, 660].forEach((freq, i) => {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t + i * 0.14);
    g.gain.linearRampToValueAtTime(0.16, t + i * 0.14 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.14 + 0.4);
    o.connect(g); g.connect(master);
    o.start(t + i * 0.14); o.stop(t + i * 0.14 + 0.45);
  });
}

// Game over: a long fall.
export function gameOverSound() {
  if (!ctx) return;
  const t = now();
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(300, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 1.4);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 700;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.22, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
  o.connect(f); f.connect(g); g.connect(master);
  o.start(t); o.stop(t + 1.55);
}

// UI click for cards and buttons.
export function click() {
  if (!ctx) return;
  const t = now();
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.value = 880;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.06, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + 0.08);
}
