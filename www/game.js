/* KANDY RUN - a pixel-art endless runner along Kandy Lake, Sri Lanka.
   Everything is drawn in code on a 180px-wide canvas and scaled up with crisp pixels. */
(() => {
'use strict';

// ------------------------------------------------------------------ setup
const W = 180;
let H = 320, offY = 0;
const cv = document.getElementById('c');
let ctx = cv.getContext('2d');
const LANES = [277, 294, 311];          // road lane centres (world y, 320-high space)
const SHORE = 152;                      // y where the town meets the lake
const TILE = 360;                       // width of the wrapping scenery tiles

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
const rc = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function mix(a, b, t) { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',') + ')'; }

// ------------------------------------------------------------------ pixel font (3x5)
const FONT = {};
(function () {
  const rows = {
    A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
    D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
    G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
    J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
    M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
    P: ['##.', '#.#', '##.', '#..', '#..'], Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
    S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '###'],
    V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
    Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
    0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'],
    3: ['##.', '..#', '.#.', '..#', '##.'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
    6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
    9: ['###', '#.#', '###', '..#', '##.'], '.': ['...', '...', '...', '...', '.#.'], ':': ['...', '.#.', '...', '.#.', '...'],
    '-': ['...', '...', '###', '...', '...'], '!': ['.#.', '.#.', '.#.', '...', '.#.'], ' ': ['...', '...', '...', '...', '...'],
    '/': ['..#', '..#', '.#.', '#..', '#..']
  };
  for (const k in rows) FONT[k] = rows[k];
})();
function textW(s, sc) { return s.length * 4 * sc - sc; }
function txt(g, s, x, y, col, sc = 1, align = 'l', outline = null) {
  s = String(s).toUpperCase();
  if (align === 'c') x = Math.round(x - textW(s, sc) / 2); else if (align === 'r') x = x - textW(s, sc);
  const draw = (ox, oy, c) => {
    g.fillStyle = c;
    for (let i = 0; i < s.length; i++) {
      const gl = FONT[s[i]] || FONT[' '];
      for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (gl[r][q] === '#') g.fillRect(x + ox + (i * 4 + q) * sc, y + oy + r * sc, sc, sc);
    }
  };
  if (outline && outline !== false) { for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) draw(a * Math.max(1, sc > 1 ? 1 : 1), b, outline); }
  else if (outline !== false) draw(1, 1, 'rgba(8,22,50,.8)');
  draw(0, 0, col);
}

// ------------------------------------------------------------------ audio
const A = { ctx: null, master: null, on: true, music: null, eng: null, noise: null, started: false };
try { A.on = localStorage.getItem('kr_sound') !== '0'; } catch (e) {}
function audioInit() {
  if (!A.ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      A.ctx = new AC();
      A.master = A.ctx.createGain(); A.master.gain.value = A.on ? 1 : 0; A.master.connect(A.ctx.destination);
      const len = A.ctx.sampleRate;
      const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      A.noise = buf;
      // tuk-tuk "put-put" engine: low saw wave chopped by a square LFO
      const o = A.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 58;
      const lp = A.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
      const g = A.ctx.createGain(); g.gain.value = 0;
      const lfo = A.ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 12;
      const lg = A.ctx.createGain(); lg.gain.value = 0;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(lp); lp.connect(g); g.connect(A.master);
      o.start(); lfo.start();
      A.eng = { o, lfo, g, lg };
    } catch (e) { A.ctx = null; }
  }
  if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
  if (!A.music) {
    try { A.music = new Audio('audio/kandy.mp3'); A.music.loop = true; A.music.volume = 0.55; A.music.muted = !A.on; } catch (e) {}
  }
}
function musicPlay() { if (A.music) { const p = A.music.play(); if (p && p.catch) p.catch(() => {}); } }
function setSound(on) {
  A.on = on; try { localStorage.setItem('kr_sound', on ? '1' : '0'); } catch (e) {}
  if (A.master) A.master.gain.value = on ? 1 : 0;
  if (A.music) A.music.muted = !on;
}
function engine(level, speed) {   // level 0..1
  if (!A.eng || !A.ctx) return; const t = A.ctx.currentTime;
  A.eng.o.frequency.setTargetAtTime(48 + speed * 0.25, t, 0.1);
  A.eng.lfo.frequency.setTargetAtTime(9 + speed * 0.07, t, 0.1);
  A.eng.g.gain.setTargetAtTime(0.03 * level, t, 0.15);
  A.eng.lg.gain.setTargetAtTime(0.028 * level, t, 0.15);
}
function tone(f, dur, type, vol, delay = 0, slide = 0) {
  if (!A.ctx || !A.on) return; const t = A.ctx.currentTime + delay;
  const o = A.ctx.createOscillator(), g = A.ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(A.master); o.start(t); o.stop(t + dur + 0.05);
}
function bell(f, vol, dur, delay = 0) {   // temple-bell: inharmonic partials with long decay
  if (!A.ctx || !A.on) return;
  [[1, 1], [2.01, 0.45], [2.76, 0.35], [4.07, 0.18], [5.4, 0.1]].forEach(([m, a]) => tone(f * m, dur / (1 + m * 0.35), 'sine', vol * a, delay));
}
function noiseBurst(dur, freq, vol, type = 'lowpass', delay = 0) {
  if (!A.ctx || !A.on || !A.noise) return; const t = A.ctx.currentTime + delay;
  const s = A.ctx.createBufferSource(); s.buffer = A.noise;
  const f = A.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = A.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(A.master); s.start(t); s.stop(t + dur + 0.05);
}
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
const sfx = {
  flower(n) { const f = PENTA[n % PENTA.length]; bell(f, 0.16, 0.7); },
  lane() { noiseBurst(0.09, 1800, 0.07, 'bandpass'); },
  crash() { noiseBurst(0.5, 900, 0.5); tone(160, 0.45, 'sawtooth', 0.22, 0, -120); tone(90, 0.5, 'square', 0.12, 0.05, -60); },
  templeBell() { bell(196, 0.22, 4.5); bell(293.7, 0.08, 3.5, 0.02); },
  bird() { const b = rand(2300, 3300); for (let i = 0; i < 3; i++) tone(b + i * 120, 0.07, 'sine', 0.05, i * 0.09, 700); },
  start() { [0, 2, 4].forEach((n, i) => bell(PENTA[n], 0.12, 0.8, i * 0.1)); },
  over() { bell(293.7, 0.14, 1.4); bell(220, 0.14, 1.8, 0.25); }
};

// ------------------------------------------------------------------ sprites
function sprPed(frame, body, skin, hair) {
  const [c, g] = mk(5, 11);
  rc(g, hair, 1, 0, 3, 1); rc(g, skin, 1, 1, 3, 2);
  rc(g, body, 0, 3, 5, 4); rc(g, skin, 0, 4, 1, 2); rc(g, skin, 4, 4, 1, 2);
  rc(g, body, 1, 7, 3, 3);
  if (frame === 0) { rc(g, skin, 1, 10, 1, 1); rc(g, skin, 3, 10, 1, 1); } else { rc(g, skin, 2, 10, 1, 1); }
  return c;
}
function sprMonk(frame) {
  const [c, g] = mk(9, 13);
  rc(g, '#1d1d24', 2, 0, 5, 1); rc(g, '#1d1d24', 0, 1, 9, 1); rc(g, '#3a3a46', 1, 1, 2, 1);
  rc(g, '#7a5a3a', 4, 2, 1, 2);
  rc(g, '#b27a58', 3, 3, 3, 2);
  rc(g, '#e8832a', 2, 5, 5, 6); rc(g, '#c96a1c', 6, 5, 1, 6); rc(g, '#e8832a', 1, 5, 1, 4);
  if (frame === 0) { rc(g, '#b27a58', 3, 11, 1, 2); rc(g, '#b27a58', 5, 11, 1, 2); } else { rc(g, '#b27a58', 4, 11, 1, 2); }
  return c;
}
function sprDog(frame) {
  const [c, g] = mk(10, 7);
  rc(g, '#a9744a', 1, 1, 6, 3); rc(g, '#a9744a', 6, 0, 3, 3); rc(g, '#7d5233', 6, 0, 1, 2); rc(g, '#2a1a12', 9, 1, 1, 1);
  rc(g, '#a9744a', 0, 0, 1, 2);
  if (frame === 0) { rc(g, '#8c5e3a', 1, 4, 1, 3); rc(g, '#8c5e3a', 6, 4, 1, 3); rc(g, '#8c5e3a', 3, 4, 1, 2); }
  else { rc(g, '#8c5e3a', 2, 4, 1, 3); rc(g, '#8c5e3a', 5, 4, 1, 3); rc(g, '#8c5e3a', 4, 4, 1, 2); }
  return c;
}
function sprTuk(frame, body, dark) {
  const [c, g] = mk(22, 15);
  rc(g, body, 2, 0, 15, 2); rc(g, dark, 2, 2, 15, 1);
  rc(g, body, 2, 3, 7, 7); rc(g, '#a9dcef', 9, 3, 6, 4); rc(g, body, 9, 7, 6, 3);
  rc(g, '#a9dcef', 15, 3, 2, 4); rc(g, body, 15, 7, 5, 3); rc(g, dark, 3, 3, 1, 1);
  rc(g, dark, 2, 10, 18, 2); rc(g, '#ffe27a', 19, 8, 2, 1); rc(g, '#ffe27a', 20, 9, 1, 1);
  for (const wx of [3, 16]) {
    rc(g, '#16161a', wx, 11, 4, 4); rc(g, '#8a8f98', wx + 1, 12, 2, 2);
    rc(g, '#16161a', wx + (frame ? 2 : 1), 12 + (frame ? 1 : 0), 1, 1);
  }
  return c;
}
function sprBus(body, dark) {
  const [c, g] = mk(46, 18);
  rc(g, dark, 0, 0, 46, 2); rc(g, body, 0, 2, 46, 12);
  for (let k = 0; k < 6; k++) rc(g, '#a9dcef', 3 + k * 6, 4, 4, 4);
  rc(g, '#a9dcef', 40, 3, 5, 6); rc(g, '#fff', 0, 10, 46, 1); rc(g, dark, 0, 11, 46, 3);
  rc(g, '#ffe27a', 38, 1, 6, 1); rc(g, '#ffe27a', 45, 11, 1, 2);
  for (const wx of [6, 34]) { rc(g, '#16161a', wx, 13, 6, 5); rc(g, '#8a8f98', wx + 2, 15, 2, 2); }
  return c;
}
function sprElephant(frame) {
  const [c, g] = mk(36, 26);
  const f = frame ? 1 : 0;
  rc(g, '#6c7079', 7 + f, 17, 4, 9); rc(g, '#6c7079', 22 - f, 17, 4, 9);
  rc(g, '#80848d', 5 - f, 17, 4, 9); rc(g, '#80848d', 20 + f, 17, 4, 9);
  rc(g, '#f4efe2', 5 - f, 25, 4, 1); rc(g, '#f4efe2', 20 + f, 25, 4, 1);
  rc(g, '#80848d', 4, 7, 24, 13);
  rc(g, '#80848d', 25, 4, 9, 11); rc(g, '#6c7079', 24, 6, 5, 8);
  rc(g, '#80848d', 31, 13, 3, 9); rc(g, '#80848d', 32, 21, 2, 2);
  rc(g, '#f4efe2', 32, 14, 4, 1);
  rc(g, '#111', 31, 7, 1, 1);
  rc(g, '#b8281f', 8, 7, 17, 10); rc(g, '#e8b83a', 8, 7, 17, 1); rc(g, '#e8b83a', 8, 16, 17, 1);
  for (let k = 0; k < 6; k++) rc(g, '#e8b83a', 9 + k * 3, 17, 1, 2);
  rc(g, '#e8b83a', 12, 10, 3, 3); rc(g, '#b8281f', 13, 11, 1, 1); rc(g, '#e8b83a', 19, 10, 3, 3); rc(g, '#b8281f', 20, 11, 1, 1);
  rc(g, '#e8b83a', 26, 3, 6, 2); rc(g, '#b8281f', 27, 5, 4, 1);
  rc(g, '#6c7079', 3, 9, 1, 10);
  return c;
}
function sprFlower() {
  const [c, g] = mk(7, 7);
  const P = '#fffdf4';
  rc(g, P, 3, 0, 1, 2); rc(g, P, 0, 2, 2, 2); rc(g, P, 5, 2, 2, 2); rc(g, P, 1, 5, 2, 2); rc(g, P, 4, 5, 2, 2);
  rc(g, P, 2, 2, 3, 3); rc(g, '#f6c945', 3, 3, 1, 1); rc(g, '#f0a830', 3, 2, 1, 1); rc(g, '#f0a830', 3, 4, 1, 1);
  return c;
}
function makeCloud(w, h, seed) {
  const [c, g] = mk(w, h); const r = rng(seed);
  for (let k = 0; k < 7; k++) {
    const cx = w * 0.15 + r() * w * 0.7, cy = h * 0.55 + (r() - 0.5) * h * 0.3, rx = w * (0.13 + r() * 0.12), ry = h * (0.25 + r() * 0.2);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy < 1) { const lit = (y - (cy - ry)) / (2 * ry); g.fillStyle = lit < 0.45 ? '#ffffff' : lit < 0.75 ? '#e6e9f7' : '#cfd6ee'; g.fillRect(x, y, 1, 1); }
    }
  }
  return c;
}

// ------------------------------------------------------------------ scenery (pre-rendered, wrapping tiles)
let SKY, STARS = [], mountains, town, lakeBase, cloudSprites = [];
const walkers = [], swans = [], flock = [];

function ridge(g, h, base, fn, col, dark) {
  for (let i = 0; i < TILE; i++) {
    const a = i / TILE * Math.PI * 2, y = Math.round(base - fn(a));
    rc(g, col, i, y, 1, h - y);
    rc(g, dark, i, y + 3 + ((i >> 1) & 1), 1, h - y);
    rc(g, col, i, y, 1, 3);
  }
}
function buildMountains() {
  const [c, g] = mk(TILE, 80); const r = rng(7);
  const far = a => 34 + 9 * Math.sin(a * 2 + 1) + 7 * Math.sin(a * 3 + 2) + 4 * Math.sin(a * 6);
  const near = a => 20 + 8 * Math.sin(a * 3 + 0.5) + 5 * Math.sin(a * 5 + 3);
  ridge(g, 80, 80, far, '#9db9d2', '#8aa8c4');
  ridge(g, 80, 80, near, '#5c9a80', '#4a8468');
  for (let i = 0; i < 160; i++) { const x = Math.floor(r() * TILE), a = x / TILE * Math.PI * 2, y = Math.round(80 - near(a)) + 3 + Math.floor(r() * 12); rc(g, '#3f7a5c', x, y, 2, 1); }
  // white Buddha statue on the hill (Bahirawakanda)
  const bx = 200, by = Math.round(80 - near(bx / TILE * Math.PI * 2));
  rc(g, '#f4f1ea', bx - 1, by - 7, 4, 7); rc(g, '#f4f1ea', bx - 3, by - 3, 8, 3); rc(g, '#f4f1ea', bx, by - 9, 2, 2); rc(g, '#d6d2c6', bx + 2, by - 6, 1, 6);
  mountains = c;
}
function drawTree(g, x, y, rad, wrap) {
  const cols = ['#2c7330', '#3d9439', '#5bb64a', '#7ccf5d'];
  for (const ox of wrap ? [0, -TILE, TILE] : [0]) {
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      if (dx * dx + dy * dy > rad * rad) continue;
      const lit = (dx * -0.6 + dy * -0.8) / rad;
      const idx = lit > 0.55 ? 3 : lit > 0.1 ? 2 : lit > -0.45 ? 1 : 0;
      rc(g, cols[idx], x + ox + dx, y + dy, 1, 1);
    }
  }
}
function drawPalm(g, x, y, h, lean) {
  for (let i = 0; i < h; i++) rc(g, '#7a6248', Math.round(x + lean * (i / h) * (i / h) * 4), y - i, 1, 1);
  const tx = Math.round(x + lean * 4), ty = y - h;
  for (const [dx, dy] of [[-5, 2], [-4, 0], [-2, -2], [0, -3], [2, -2], [4, 0], [5, 2], [-3, 3], [3, 3]]) {
    const steps = 4;
    for (let s = 1; s <= steps; s++) rc(g, s % 2 ? '#2f8a35' : '#49a844', tx + Math.round(dx * s / steps), ty + Math.round(dy * s / steps) + (s > 2 ? 1 : 0), 1, 1);
  }
}
function buildTown() {
  const [c, g] = mk(TILE, 66); const r = rng(21);
  const hb = a => 11 + 4 * Math.sin(a * 4) + 3 * Math.sin(a * 7 + 1);
  for (let i = 0; i < TILE; i++) { const h = Math.round(hb(i / TILE * Math.PI * 2)); rc(g, '#3a8a36', i, 64 - h, 1, h + 2); }
  // tree canopy across the whole tile
  for (let x = 0; x < TILE; x += 9) { const h = hb(x / TILE * Math.PI * 2); drawTree(g, x + Math.floor(r() * 5), Math.round(64 - h - 5 - r() * 3), 7 + Math.floor(r() * 3), true); }
  for (let x = 4; x < TILE; x += 12) { const h = hb(x / TILE * Math.PI * 2); drawTree(g, x, Math.round(64 - h + 1 - r() * 3), 5 + Math.floor(r() * 2), true); }
  // small red-roofed houses on the hillside
  const house = (x, y, w, h) => {
    rc(g, '#f2ede4', x, y - h, w, h); rc(g, '#d8d2c5', x + w - 2, y - h, 2, h);
    for (let k = 0; k < 3; k++) rc(g, k % 2 ? '#b53c26' : '#c8472e', x - 1 + k, y - h - 3 + k, w + 2 - k * 2, 1);
    rc(g, '#c8472e', x - 1, y - h - 1, w + 2, 2); rc(g, '#3c3c4c', x + 2, y - 4, 2, 4);
  };
  [[170, 60, 8, 7], [186, 59, 9, 7], [203, 61, 7, 6], [222, 58, 9, 7], [240, 60, 8, 6], [262, 59, 9, 7], [282, 60, 7, 6], [300, 58, 9, 7], [320, 60, 8, 6], [340, 59, 8, 6], [6, 59, 8, 6], [18, 61, 7, 5]].forEach(a => house(...a));
  // --- Temple complex (white halls, red hipped roofs, golden-topped tower)
  const base = 64;
  rc(g, '#efe9de', 30, base - 18, 94, 18); rc(g, '#cfc8ba', 30, base - 3, 94, 3);
  for (let r2 = 0; r2 < 8; r2++) { const inset = Math.round((7 - r2) * 1.6); rc(g, r2 % 2 ? '#b53c26' : '#c8472e', 28 + inset, base - 26 + r2, 98 - inset * 2, 1); }
  rc(g, '#8e2c1c', 28, base - 19, 98, 1);
  for (let k = 0; k < 8; k++) { const wx = 34 + k * 11; if (wx > 62 && wx < 90) continue; rc(g, '#3c3c4c', wx, base - 14, 3, 7); rc(g, '#3c3c4c', wx + 1, base - 15, 1, 1); rc(g, '#cfc8ba', wx - 1, base - 7, 5, 1); }
  rc(g, '#efe9de', 64, base - 28, 26, 12);
  for (let r2 = 0; r2 < 6; r2++) rc(g, r2 % 2 ? '#b53c26' : '#c8472e', 77 - (6 + r2 * 2), base - 34 + r2, 12 + r2 * 4, 1);
  rc(g, '#e2b23a', 72, base - 39, 10, 5); rc(g, '#f1c94f', 74, base - 42, 6, 3); rc(g, '#e2b23a', 76, base - 46, 2, 4);
  rc(g, '#3c3c4c', 69, base - 26, 3, 8); rc(g, '#3c3c4c', 82, base - 26, 3, 8);
  rc(g, '#e2b23a', 72, base - 14, 10, 11); rc(g, '#2a2a36', 74, base - 12, 6, 9); rc(g, '#2a2a36', 75, base - 13, 4, 1);
  // octagonal pavilion on the right
  rc(g, '#ece6da', 126, base - 36, 22, 36); rc(g, '#cfc8ba', 144, base - 36, 4, 36);
  for (let k = 0; k < 3; k++) { rc(g, '#2c3340', 129 + k * 5, base - 26, 3, 20); rc(g, '#2c3340', 130 + k * 5, base - 27, 1, 1); }
  rc(g, '#cfc8ba', 126, base - 6, 22, 2);
  for (let r2 = 0; r2 < 6; r2++) rc(g, r2 % 2 ? '#b53c26' : '#c8472e', 124 + (5 - r2), base - 42 + r2, 26 - (5 - r2) * 2, 1);
  rc(g, '#e2b23a', 136, base - 46, 2, 4);
  // flanking trees & palms
  drawTree(g, 22, base - 20, 8, true); drawTree(g, 14, base - 12, 7, true); drawTree(g, 154, base - 18, 8, true); drawTree(g, 162, base - 10, 6, true);
  drawPalm(g, 8, base - 4, 22, -0.8); drawPalm(g, 158, base - 2, 26, 0.6); drawPalm(g, 300, base - 4, 20, 0.5); drawPalm(g, 230, base - 3, 18, -0.6);
  town = c;
}
function buildLake() {
  const [c, g] = mk(W, 96);
  const top = '#8dc0df', bot = '#4f8db6';
  for (let y = 0; y < 96; y += 3) rc(g, mix(top, bot, Math.min(1, y / 90)), 0, y, W, 3);
  const r = rng(5);
  for (let i = 0; i < 90; i++) rc(g, 'rgba(255,255,255,.22)', Math.floor(r() * W), Math.floor(r() * 96), 2 + Math.floor(r() * 3), 1);
  lakeBase = c;
}
function buildSky() {
  const [c, g] = mk(W, H);
  const hz = SHORE + offY;
  for (let y = 0; y < hz; y += 3) rc(g, mix('#2763b8', '#b7dcf2', Math.pow(y / hz, 1.2)), 0, y, W, 3);
  // dithered cloud-bank haze near the horizon
  for (let y = hz - 14; y < hz; y++) for (let x = (y & 1); x < W; x += 2) rc(g, 'rgba(255,255,255,.18)', x, y, 1, 1);
  SKY = c;
  const r = rng(3); STARS = []; for (let i = 0; i < 40; i++) STARS.push([Math.floor(r() * W), Math.floor(r() * (hz - 30)), r()]);
}

// ------------------------------------------------------------------ sprites cache
const SP = {};
function buildSprites() {
  SP.ped = [0, 1].map(f => sprPed(f, '#f4f1ea', '#a8684a', '#2b1a12'));
  SP.kid = [0, 1].map(f => sprPed(f, '#fbfaf5', '#9a5c40', '#1c120c'));
  SP.pedB = [0, 1].map(f => sprPed(f, '#ece8de', '#8a523a', '#2b1a12'));
  SP.monk = [0, 1].map(sprMonk);
  SP.dog = [0, 1].map(sprDog);
  SP.me = [0, 1].map(f => sprTuk(f, '#d8352a', '#8c1f17'));
  SP.tukY = [0, 1].map(f => sprTuk(f, '#f2c230', '#a07a10'));
  SP.tukG = [0, 1].map(f => sprTuk(f, '#3a9a52', '#1f6a34'));
  SP.tukB = [0, 1].map(f => sprTuk(f, '#3a6fd0', '#1f4090'));
  SP.bus = [sprBus('#d9382c', '#8e1f17'), sprBus('#2d6fb5', '#173f70')];
  SP.eleph = [0, 1].map(sprElephant);
  SP.flower = sprFlower();
  cloudSprites = [makeCloud(46, 18, 1), makeCloud(34, 14, 2), makeCloud(54, 20, 3), makeCloud(30, 12, 4)];
}

// ------------------------------------------------------------------ game state
const TYPES = {
  ped:  { w: 5, h: 11, own: 9, honk: true, spr: () => SP.ped, hit: 5 },
  kid:  { w: 5, h: 11, own: 12, honk: true, spr: () => SP.kid, hit: 5 },
  monk: { w: 9, h: 13, own: 8, honk: true, spr: () => SP.monk, hit: 8 },
  dog:  { w: 10, h: 7, own: 0, honk: true, spr: () => SP.dog, hit: 9 },
  tuk:  { w: 22, h: 15, own: 32, honk: true, spr: o => o.skin, hit: 20 },
  bus:  { w: 46, h: 18, own: 42, honk: false, spr: o => o.skin, hit: 44 },
  eleph: { w: 36, h: 26, own: 13, honk: false, spr: () => SP.eleph, hit: 32 }
};
let state = 'title';           // title | play | dying | over | paused | icon
let worldX = 0, dist = 0, v = 0, score = 0, flowersGot = 0, combo = 0, best = 0, time = 0, deadT = 0, shake = 0, flash = 0;
let spawnTimer = 0, honkCd = 0, birdTimer = 3, lastTemple = -1;
let obstacles = [], flowers = [], parts = [], puffs = [];
const player = { x: 34, lane: 1, y: LANES[1] };
try { best = +localStorage.getItem('kr_best') || 0; } catch (e) {}

function reset() {
  prevFree = [0, 1, 2]; dist = 0; score = 0; flowersGot = 0; combo = 0; v = 62; spawnTimer = 150; honkCd = 0; deadT = 0; shake = 0; flash = 0;
  obstacles = []; flowers = []; parts = []; puffs = []; player.lane = 1; player.y = LANES[1];
  lastTemple = Math.floor((worldX * 0.2 + 2) / TILE);
}
function initDecor() {
  walkers.length = 0;
  const kinds = ['ped', 'kid', 'monk', 'pedB', 'ped', 'kid', 'monk', 'pedB', 'ped', 'kid'];
  kinds.forEach((k, i) => walkers.push({ k, x: i * 26 + Math.random() * 10, sp: rand(8, 16) * (k === 'monk' ? 0.8 : 1), ph: Math.random() * 4, twin: k === 'kid' || k === 'monk' }));
  swans.length = 0;
  for (let i = 0; i < 4; i++) swans.push({ x: rand(0, 360), y: rand(188, 238), sp: rand(2, 6), ph: Math.random() * 6 });
  flock.length = 0;
  for (let i = 0; i < 5; i++) flock.push({ x: 24 + i * 11 + (i % 2) * 4, y: 22 + (i % 3) * 5 + (i % 2) * 3, ph: i, vx: 0, vy: 0, free: false });
}

function pickType() {
  const m = score, pool = ['ped', 'ped', 'kid', 'monk', 'dog'];
  if (m > 60) pool.push('tuk', 'tuk');
  if (m > 180) pool.push('bus');
  if (m > 320) pool.push('eleph');
  const t = pool[Math.floor(Math.random() * pool.length)], o = { type: t };
  if (t === 'tuk') o.skin = [SP.tukY, SP.tukG, SP.tukB][Math.floor(Math.random() * 3)];
  if (t === 'bus') o.skin = [SP.bus[0], SP.bus[1]][Math.floor(Math.random() * 2)];
  return o;
}
let prevFree = [0, 1, 2];   // lanes that were open in the most recent group (where the player might be)
function spawnGroup() {
  // Fairness rule: wherever the player stands in an open lane, the next group must leave
  // an open lane within ONE lane step of it, so you never need a double lane-change.
  const nb = score > 120 && Math.random() < 0.4 ? 2 : 1;
  let blocked, free;
  if (nb === 2) {
    const ok = [0, 1, 2].filter(l => prevFree.every(f => Math.abs(l - f) <= 1));
    const s = ok[Math.floor(Math.random() * ok.length)];
    free = [s]; blocked = [0, 1, 2].filter(l => l !== s);
  } else {
    const b = Math.floor(Math.random() * 3);
    blocked = [b]; free = [0, 1, 2].filter(l => l !== b);
  }
  prevFree = free.slice();
  for (const l of blocked) {
    const o = pickType(); o.lane = l; o.target = l; o.y = LANES[l]; o.x = W + 24 + Math.random() * 14; o.t = Math.random() * 3; o.t0 = o.t;
    o.honked = false; obstacles.push(o);
  }
  if (Math.random() < 0.85) {
    const fl = free[Math.floor(Math.random() * free.length)], n = 3 + Math.floor(Math.random() * 4), sx = W + 30 + Math.random() * 20;
    for (let i = 0; i < n; i++) flowers.push({ x: sx + i * 13, y: LANES[fl] - 4, ph: Math.random() * 6 });
  }
}
function laneBusy(l, x) { return obstacles.some(o => (o.lane === l || o.target === l) && Math.abs(o.x - x) < 34); }

// ------------------------------------------------------------------ input
function moveLane(d) {
  if (state !== 'play') return;
  const nl = clamp(player.lane + d, 0, 2);
  if (nl !== player.lane) { player.lane = nl; sfx.lane(); }
}
function startGame() {
  audioInit(); musicPlay(); reset(); state = 'play'; sfx.start();
}
function toGame(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H - offY };
}
let pdown = null;
function onDown(e) {
  e.preventDefault();
  const p = toGame(e); pdown = { x: p.x, y: p.y, t: performance.now() };
}
function onUp(e) {
  e.preventDefault(); if (!pdown) return;
  const p = toGame(e), d = pdown; pdown = null;
  const sy = p.y + offY;
  if (p.x > W - 20 && sy < 22) { audioInit(); setSound(!A.on); return; }          // speaker icon
  if (state === 'title') { startGame(); return; }
  if (state === 'over') { if (deadT > 0.7) startGame(); return; }
  if (state !== 'play') return;
  const dy = p.y - d.y;
  if (Math.abs(dy) > 12) { moveLane(dy < 0 ? -1 : 1); return; }
  moveLane(p.y < player.y ? -1 : 1);
}
cv.addEventListener('pointerdown', onDown); window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', () => { pdown = null; });
window.addEventListener('keydown', e => {
  const k = e.key;
  if (['ArrowUp', 'w', 'W'].includes(k)) { if (state === 'play') moveLane(-1); else if (state === 'title' || (state === 'over' && deadT > 0.7)) startGame(); e.preventDefault(); }
  else if (['ArrowDown', 's', 'S'].includes(k)) { if (state === 'play') moveLane(1); else if (state === 'title' || (state === 'over' && deadT > 0.7)) startGame(); e.preventDefault(); }
  else if (k === ' ' || k === 'Enter') { if (state === 'title' || (state === 'over' && deadT > 0.7)) startGame(); e.preventDefault(); }
  else if (k === 'm' || k === 'M') { audioInit(); setSound(!A.on); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (A.music) A.music.pause(); if (A.ctx) A.ctx.suspend(); if (state === 'play') state = 'paused'; }
  else { if (A.ctx) A.ctx.resume(); if (A.music && A.started) musicPlay(); if (state === 'paused') state = 'play'; }
});

// ------------------------------------------------------------------ update
function burst(x, y, n, cols, sp) { for (let i = 0; i < n; i++) parts.push({ x, y, vx: rand(-sp, sp), vy: rand(-sp * 1.2, -sp * 0.2), life: rand(0.4, 0.9), col: cols[Math.floor(Math.random() * cols.length)] }); }
function die() {
  state = 'dying'; deadT = 0; shake = 0.5; flash = 0.5; sfx.crash(); engine(0, 0);
  burst(player.x + 11, player.y, 22, ['#fffdf4', '#f6c945', '#d8352a', '#8a8f98'], 70);
  if (score > best) { best = score; try { localStorage.setItem('kr_best', String(best)); } catch (e) {} }
}
function update(dt) {
  time += dt;
  let scroll = 0;
  if (state === 'title' || state === 'icon') scroll = 26;
  else if (state === 'play') {
    const m = dist / 10;
    v = 62 + 92 * (1 - Math.exp(-m / 650));
    scroll = v;
  }
  worldX += scroll * dt;

  // temple bell as the temple passes the middle of the screen
  const tp = Math.floor((worldX * 0.2 + 2) / TILE);
  if (tp !== lastTemple) { lastTemple = tp; if (state === 'play' || state === 'title') sfx.templeBell(); }

  // ambient decor
  for (const w of walkers) { w.x -= (scroll - w.sp) * dt; if (w.x < -14) w.x += W + 40; if (w.x > W + 30) w.x -= W + 44; }
  for (const s of swans) { s.x -= (scroll * 0.45 + s.sp) * dt; if (s.x < -12) s.x += 380; }
  for (let i = flock.length - 1; i >= 0; i--) {
    const b = flock[i];
    if (b.free) { b.x += b.vx * dt; b.y += b.vy * dt; if (b.y < -10 || b.x > W + 20 || b.x < -20) { if (i >= 5) flock.splice(i, 1); else { b.free = false; b.x = -10; b.y = 20 + Math.random() * 20; } } }
    else { b.x -= (scroll * 0.06 - 3) * dt; if (b.x > W + 14) b.x = -20; if (b.x < -24) b.x = W + 6; }
  }
  for (let i = puffs.length - 1; i >= 0; i--) { const p = puffs[i]; p.life -= dt; p.x -= (scroll + 10) * dt; p.y -= 6 * dt; if (p.life <= 0) puffs.splice(i, 1); }
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; if (p.life <= 0) parts.splice(i, 1); }
  shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt);

  if (state === 'play' || state === 'dying') {
    if (state === 'dying') { deadT += dt; if (deadT > 0.9) { state = 'over'; deadT = 0; sfx.over(); } }
    else {
      dist += v * dt; score = Math.floor(dist / 10) + flowersGot * 5;
      player.y += clamp(LANES[player.lane] - player.y, -190 * dt, 190 * dt);
      if (Math.random() < dt * 9) puffs.push({ x: player.x + 1, y: player.y + 5, life: rand(0.4, 0.7) });
      engine(1, v);
      birdTimer -= dt; if (birdTimer < 0) { birdTimer = rand(2.5, 6); sfx.bird(); }
      spawnTimer -= v * dt;
      if (spawnTimer <= 0) { spawnGroup(); spawnTimer = rand(125, 175) - Math.min(25, dist / 400); }
      // obstacles
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i], T = TYPES[o.type];
        o.x -= v * dt; o.t += dt;   // everything moves with the road so spacing (and the clear lane) stays fixed
        const ty = LANES[o.target]; if (o.y !== ty) { o.y += clamp(ty - o.y, -75 * dt, 75 * dt); if (Math.abs(ty - o.y) < 0.5) { o.y = ty; o.lane = o.target; } }
        if (o.x < -60) { obstacles.splice(i, 1); continue; }
        const px0 = player.x + 3, px1 = player.x + 20, ox0 = o.x + (T.w - T.hit) / 2, ox1 = ox0 + T.hit;
        if (px1 > ox0 && px0 < ox1 && Math.abs(o.y - player.y) < 8) { die(); break; }
      }
      // flowers
      for (let i = flowers.length - 1; i >= 0; i--) {
        const f = flowers[i]; f.x -= v * dt;
        if (f.x < -10) { flowers.splice(i, 1); continue; }
        if (Math.abs(f.x + 3 - (player.x + 11)) < 10 && Math.abs(f.y + 4 - player.y) < 9) {
          flowers.splice(i, 1); flowersGot++; combo++; sfx.flower(combo - 1);
          burst(f.x + 3, f.y + 3, 5, ['#fffdf4', '#f6c945'], 35);
        }
      }
      // if a pickup chain is broken, reset the melody
      if (flowers.length === 0 || flowers[0].x > W) combo = 0;
    }
  } else if (state === 'title') engine(0.5, 40);
  else if (state === 'over') { deadT += dt; }
  for (let i = obstacles.length - 1; i >= 0 && state === 'dying'; i--) { /* frozen while dying */ break; }
}

// ------------------------------------------------------------------ drawing
function daylight() {
  const p = ((worldX / 7000) % 1 + 1) % 1, t = p * Math.PI * 2, s = Math.cos(t);
  const k = clamp((s + 0.7) / 0.8, 0, 1), dark = (1 - k * k * (3 - 2 * k)) * 0.58;
  const warm = Math.max(0, 1 - Math.abs(s + 0.05) / 0.45) * 0.3;
  return { t, s, dark, warm };
}
function drawWrap(g, img, off, y, alpha) {
  const o = ((off % TILE) + TILE) % TILE;
  if (alpha !== undefined) g.globalAlpha = alpha;
  g.drawImage(img, -o | 0, y); g.drawImage(img, (TILE - o) | 0, y);
  if (alpha !== undefined) g.globalAlpha = 1;
}
function drawWalker(g, w) {
  const f = Math.floor((time * 4 + w.ph) % 2);
  const y = 258 + (w.k === 'monk' ? 0 : 0), spr = SP[w.k][f];
  g.drawImage(spr, Math.round(w.x), y - spr.height + 7);
  if (w.twin) { const s2 = SP[w.k][(f + 1) % 2]; g.drawImage(s2, Math.round(w.x) + spr.width + 2, y - s2.height + 7); }
}
function drawScene(g, dl) {
  // sky
  g.drawImage(SKY, 0, 0);
  g.save(); g.translate(0, offY);
  if (dl.dark > 0.25) for (const [x, y, r] of STARS) { g.globalAlpha = clamp((dl.dark - 0.25) * 2.5, 0, 1) * (0.5 + 0.5 * Math.sin(time * 2 + r * 20)); g.fillStyle = '#fff'; g.fillRect(x, y - offY + offY, 1, 1); } g.globalAlpha = 1;
  // sun and moon
  const sx = 90 + Math.sin(dl.t) * 86, sy = SHORE - 8 - Math.cos(dl.t) * 120;
  if (sy < SHORE) { g.fillStyle = 'rgba(255,240,170,.35)'; g.fillRect(sx - 7, sy - 5, 14, 10); g.fillRect(sx - 5, sy - 7, 10, 14); g.fillStyle = '#fff5c2'; g.fillRect(sx - 4, sy - 4, 8, 8); g.fillRect(sx - 5, sy - 3, 10, 6); g.fillRect(sx - 3, sy - 5, 6, 10); }
  const mx = 90 - Math.sin(dl.t) * 86, my = SHORE - 8 + Math.cos(dl.t) * 120;
  if (my < SHORE) { g.fillStyle = '#eef2ff'; g.fillRect(mx - 3, my - 4, 7, 8); g.fillRect(mx - 4, my - 3, 9, 6); g.fillStyle = '#c3cbe6'; g.fillRect(mx + 1, my - 2, 2, 2); }
  // clouds
  const cl = [[10, 24, 0], [64, 44, 2], [118, 16, 1], [150, 56, 3], [92, 70, 1]];
  cl.forEach(([x, y, k], i) => { const sp = 0.025 + i * 0.006, c = cloudSprites[k], px = (((x - worldX * sp - time * (1.2 + i * 0.4)) % (W + 70)) + W + 70) % (W + 70) - 60; g.globalAlpha = 0.92; g.drawImage(c, px | 0, y); g.globalAlpha = 1; });
  // birds in the sky
  for (const b of flock) {
    const f = Math.floor((time * 5 + b.ph) % 2), x = Math.round(b.x), y = Math.round(b.y);
    g.fillStyle = '#1f2433'; if (f) { g.fillRect(x - 2, y, 2, 1); g.fillRect(x, y - 1, 1, 1); g.fillRect(x + 1, y, 2, 1); } else { g.fillRect(x - 2, y - 1, 2, 1); g.fillRect(x, y, 1, 1); g.fillRect(x + 1, y - 1, 2, 1); }
  }
  // mountains & town
  drawWrap(g, mountains, worldX * 0.05, 70);
  drawWrap(g, town, worldX * 0.2, SHORE - 64);
  // lake
  g.drawImage(lakeBase, 0, SHORE);
  // reflection of the town, wobbling
  const o = (((worldX * 0.2) % TILE) + TILE) % TILE;
  for (let i = 0; i < 62; i++) {
    const srcY = 63 - i, dx = Math.round(Math.sin(time * 1.6 + i * 0.55) * (0.5 + i * 0.03)), a = 0.62 - i * 0.0085;
    if (a <= 0) break;
    g.globalAlpha = a;
    g.drawImage(town, o, srcY, W, 1, dx, SHORE + i, W, 1);
    if (o + W > TILE) g.drawImage(town, 0, srcY, o + W - TILE, 1, TILE - o + dx, SHORE + i, o + W - TILE, 1);
  }
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(190,225,245,.28)'; g.fillRect(0, SHORE, W, 3);
  // shimmer
  for (let i = 0; i < 26; i++) { const x = ((i * 53 + time * (6 + (i % 5) * 2)) % (W + 10)), y = SHORE + 10 + (i * 17) % 84; g.fillStyle = (Math.sin(time * 2 + i) > 0.3) ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.25)'; g.fillRect(W - x | 0, y, 3, 1); }
  // swans & a dark cormorant
  for (const s of swans) {
    const x = Math.round(s.x) - 10, y = Math.round(s.y + Math.sin(time * 1.3 + s.ph) * 0.8);
    if (x < -10 || x > W) continue;
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y + 4, 9, 1);
    g.fillStyle = '#fff'; g.fillRect(x, y + 1, 7, 3); g.fillRect(x + 6, y - 2, 1, 4); g.fillRect(x + 6, y - 3, 2, 1);
    g.fillStyle = '#f08a2a'; g.fillRect(x + 8, y - 3, 1, 1); g.fillStyle = '#d6dbe8'; g.fillRect(x + 1, y + 3, 5, 1);
  }
  // parapet "wall of clouds"
  const po = (worldX % 12);
  g.fillStyle = '#26415f'; g.fillRect(0, 243, W, 7);
  g.fillStyle = '#f2f3f4'; g.fillRect(0, 242, W, 1);
  for (let x = -12 + (12 - po); x < W + 12; x += 12) { g.fillStyle = '#f2f3f4'; g.fillRect(x + 1, 245, 8, 3); g.fillRect(x + 2, 244, 6, 1); g.fillRect(x + 2, 248, 6, 1); }
  // lamp posts
  const lo = worldX % 110;
  for (let x = 40 - lo; x < W + 110; x += 110) { const xx = Math.round(x); g.fillStyle = '#1e3b3a'; g.fillRect(xx, 214, 1, 30); g.fillRect(xx - 1, 211, 3, 3); g.fillStyle = dl.dark > 0.12 ? '#ffe9a0' : '#cfd8d6'; g.fillRect(xx, 212, 1, 1); }
  // pavement
  g.fillStyle = '#d7d1c3'; g.fillRect(0, 250, W, 18);
  const bo = worldX % 12;
  g.fillStyle = '#bfb9ab';
  for (let y = 254; y < 266; y += 4) { g.fillRect(0, y, W, 1); for (let x = -12 + (12 - bo) + ((y >> 2) & 1) * 6; x < W; x += 12) g.fillRect(x, y - 3, 1, 3); }
  g.fillStyle = '#c9c3b5'; g.fillRect(0, 250, W, 1);
  for (const w of walkers) drawWalker(g, w);
  // kerb + road
  const ko = worldX % 8;
  g.fillStyle = '#16171c'; g.fillRect(0, 266, W, 3);
  g.fillStyle = '#e8e8e8'; for (let x = -8 + (8 - ko); x < W; x += 8) g.fillRect(x, 266, 4, 3);
  g.fillStyle = '#42454f'; g.fillRect(0, 269, W, 51 + 40);
  const r = rng(99); g.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 80; i++) g.fillRect(((r() * W + (-worldX % W) + W) % W) | 0, 270 + Math.floor(r() * 50), 2, 1);
  const lo2 = worldX % 24; g.fillStyle = '#cfd3d8';
  for (const y of [285, 302]) for (let x = -24 + (24 - lo2); x < W; x += 24) g.fillRect(x, y, 12, 1);
  g.restore();
}
function drawEntities(g, dl) {
  g.save(); g.translate(0, offY);
  const list = [];
  for (const o of obstacles) list.push({ y: o.y, d: () => {
    const T = TYPES[o.type], sp = T.spr(o), f = Math.floor((o.t * (o.type === 'eleph' ? 3 : 6)) % 2), s = Array.isArray(sp) ? sp[f] : sp;
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(Math.round(o.x) + 1, Math.round(o.y) + 6, T.w - 2, 2);
    g.drawImage(s, Math.round(o.x), Math.round(o.y) + 7 - T.h);
  } });
  const pf = Math.floor((time * 10) % 2);
  const dying = state === 'dying' || state === 'over';
  if (!(state === 'over')) list.push({ y: player.y + 0.1, d: () => {
    const ox = dying ? Math.round(Math.sin(time * 40) * (1.5 * shake * 2)) : 0;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(player.x + 1, Math.round(player.y) + 6, 20, 2);
    const jig = state === 'play' ? Math.round(Math.sin(time * 28) * 0.4 + 0.4) : 0;
    g.drawImage(SP.me[pf], player.x + ox, Math.round(player.y) + 7 - 15 - jig);
  } });
  list.sort((a, b) => a.y - b.y).forEach(e => e.d());
  for (const f of flowers) { const bob = Math.round(Math.sin(time * 4 + f.ph) * 1); g.drawImage(SP.flower, Math.round(f.x), Math.round(f.y) + bob); }
  for (const p of puffs) { g.globalAlpha = clamp(p.life * 1.4, 0, 0.5); g.fillStyle = '#e8e8ea'; g.fillRect(p.x | 0, p.y | 0, 2, 2); } g.globalAlpha = 1;
  for (const p of parts) { g.globalAlpha = clamp(p.life * 2, 0, 1); g.fillStyle = p.col; g.fillRect(p.x | 0, p.y | 0, 2, 2); } g.globalAlpha = 1;
  g.restore();
}
function drawLighting(g, dl) {
  g.save(); g.translate(0, offY);
  if (dl.warm > 0.01) { g.fillStyle = 'rgba(255,128,48,' + dl.warm * 0.55 + ')'; g.fillRect(0, -offY - 40, W, H + 80); }
  if (dl.dark > 0.01) { g.fillStyle = 'rgba(8,16,70,' + dl.dark + ')'; g.fillRect(0, -offY - 40, W, H + 80); }
  if (dl.dark > 0.12) {
    const lo = worldX % 110;
    for (let x = 40 - lo; x < W + 110; x += 110) {
      const a = clamp(dl.dark * 0.16, 0, 0.1);
      g.fillStyle = 'rgba(255,226,140,' + a + ')';
      for (let k = 0; k < 4; k++) { const r = 3 + k * 3; g.fillRect((x - r) | 0, 212 - r + 2, r * 2 + 1, r * 2 - 2); }
      g.fillStyle = 'rgba(255,230,150,' + a * 1.3 + ')'; g.fillRect((x - 14) | 0, 252, 29, 14);
    }
    if (state === 'play' || state === 'dying') { g.fillStyle = 'rgba(255,236,160,.2)'; g.fillRect(player.x + 20, player.y - 4, 34, 9); g.fillRect(player.x + 20, player.y - 2, 50, 5); }
  }
  g.restore();
}
function drawHUD(g) {
  // speaker icon
  const sx = W - 14, sy = 5;
  g.fillStyle = 'rgba(8,22,50,.55)'; g.fillRect(sx - 2, sy - 2, 14, 11);
  g.fillStyle = '#fff'; g.fillRect(sx, sy + 2, 2, 3); g.fillRect(sx + 2, sy + 1, 1, 5); g.fillRect(sx + 3, sy, 1, 7);
  if (A.on) { g.fillRect(sx + 5, sy + 2, 1, 3); g.fillRect(sx + 7, sy + 1, 1, 5); } else { g.fillStyle = '#ff6a5a'; for (let i = 0; i < 5; i++) { g.fillRect(sx + 5 + i, sy + 1 + i, 1, 1); g.fillRect(sx + 9 - i, sy + 1 + i, 1, 1); } }
  if (state === 'play' || state === 'dying' || state === 'paused') {
    txt(g, score, 6, 6, '#fff', 2, 'l', '#10294f');
    g.drawImage(SP.flower, 6, 20); txt(g, 'X' + flowersGot, 15, 21, '#fff', 1, 'l', '#10294f');
    txt(g, 'BEST ' + best, 6, 31, '#cfe6ff', 1, 'l');
  }
}
function panel(g, y0, y1) { g.fillStyle = 'rgba(10,28,64,.62)'; g.fillRect(10, y0, W - 20, y1 - y0); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(10, y0, W - 20, 1); g.fillRect(10, y1 - 1, W - 20, 1); }
function drawOverlay(g) {
  g.save(); g.translate(0, offY);
  if (state === 'title') {
    txt(g, 'KANDY RUN', W / 2, 30, '#fff', 3, 'c', '#10294f');
    txt(g, 'SRI LANKA', W / 2, 50, '#fff', 2, 'c', '#10294f');
    panel(g, 160, 202);
    txt(g, 'TAP ABOVE OR BELOW TO CHANGE LANE', W / 2, 166, '#fff', 1, 'c');
    txt(g, 'SWIPE UP OR DOWN TOO', W / 2, 175, '#fff', 1, 'c');
    txt(g, 'COLLECT FLOWERS AND DODGE TRAFFIC', W / 2, 184, '#ffe27a', 1, 'c');
    if (Math.floor(time * 2) % 2 === 0) txt(g, 'TAP TO START', W / 2, 192, '#8ff0a4', 1, 'c');
    if (best) txt(g, 'BEST ' + best, W / 2, 70, '#cfe6ff', 1, 'c', '#10294f');
  } else if (state === 'over') {
    panel(g, 96, 196);
    txt(g, 'OOPS!', W / 2, 104, '#ff8a6a', 3, 'c', '#10294f');
    txt(g, 'SCORE ' + score, W / 2, 128, '#fff', 2, 'c', '#10294f');
    txt(g, 'FLOWERS ' + flowersGot, W / 2, 148, '#fffdf4', 1, 'c');
    txt(g, (score >= best && score > 0 ? 'NEW BEST ' : 'BEST ') + best, W / 2, 158, '#ffe27a', 1, 'c');
    if (deadT > 0.7 && Math.floor(time * 2) % 2 === 0) txt(g, 'TAP TO RETRY', W / 2, 176, '#8ff0a4', 1, 'c');
  } else if (state === 'paused') {
    txt(g, 'PAUSED', W / 2, 120, '#fff', 3, 'c', '#10294f');
  }
  g.restore();
  if (flash > 0) { g.fillStyle = 'rgba(255,255,255,' + flash * 0.9 + ')'; g.fillRect(0, 0, W, H); }
}

function render() {
  const dl = daylight();
  ctx.save();
  if (shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * shake * 8), Math.round((Math.random() - 0.5) * shake * 6));
  drawScene(ctx, dl);
  drawEntities(ctx, dl);
  drawLighting(ctx, dl);
  ctx.restore();
  if (state !== 'icon') { drawHUD(ctx); drawOverlay(ctx); }
}

// ------------------------------------------------------------------ boot
function resize() {
  const iw = window.innerWidth || 360, ih = window.innerHeight || 640;
  H = clamp(Math.round(W * ih / iw), 270, 380);
  cv.width = W; cv.height = H; ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  offY = H - 320;
  const s = Math.min(iw / W, ih / H);
  cv.style.width = (W * s) + 'px'; cv.style.height = (H * s) + 'px';
  buildSky();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

buildSprites(); buildMountains(); buildTown(); buildLake(); resize(); initDecor(); reset();
let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
  if (state !== 'paused') update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// small hooks used for automated screenshots / icon creation
window.__kandy = {
  get state() { return state; }, start: startGame, setWorld(x) { worldX = x; }, icon() { state = 'icon'; player.lane = 1; player.y = LANES[1]; },
  obs: () => obstacles.map(o => ({ x: o.x, w: TYPES[o.type].w, lane: o.lane })), lane: () => player.lane, px: () => player.x, move: moveLane, die, debug() { return { score, v, obstacles: obstacles.length, flowers: flowers.length, state }; }
};
})();
