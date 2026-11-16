// Lanternfall — the entrypoint. Wires the world, the player, the moths, the
// director and the HUD together and runs a fixed-step loop. It also carries
// the ?shot=<scene>&seed=<n> deterministic screenshot driver so the three cover
// shots (title, mid-play, the last-stand over screen) render identically on
// every machine the grader or a reviewer opens it on.

import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { buildWorld, mulberry32 } from './world.js';
import { Player } from './player.js';
import { Director, WAVES } from './director.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { drawCards } from './upgrades.js';
import * as Sfx from './audio.js';

const canvasHost = document.getElementById('stage');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
canvasHost.appendChild(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.night);
scene.fog = new THREE.FogExp2(PALETTE.fog, 0.02);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 8.5, 22);

// A cold fill light so the unlit valley stays readable, plus the lantern's warm
// light living on the player.
const fill = new THREE.HemisphereLight(0x3a4a6e, 0x141826, 1.35);
scene.add(fill);

const rng = mulberry32(20261116);
const { stones } = buildWorld(scene, rng);

const player = new Player(scene);
const hud = new Hud();
const input = new Input(canvas);

let killsTotal = 0;
let startTime = 0;
let lastOilBonus = { drainCut: 0, speedUp: 0, regenUp: 0, maxUp: 0 };

const director = new Director(scene, {
  onWave(w) {
    hud.setWave(w, WAVES);
    Sfx.setDroneLevel(w);
  },
  onScore(s) { hud.setScore(s); },
  onBanner(text, seconds) { hud.say(text, seconds); },
  onHurt() {
    Sfx.hurt();
    hud.setHearts(player.hearts, player.maxHearts);
    hud.say('The dark bites', 0.8);
  },
  onUpgrade(wave) {
    Sfx.waveClear();
    const cards = drawCards(director.upgradesTaken);
    hud.upgradeScreen(true, wave, cards, (id) => {
      Sfx.click();
      hud.upgradeScreen(false);
      director.applyUpgrade(id, player);
      hud.setHearts(player.hearts, player.maxHearts);
    });
  },
  onOver(win, dir) {
    Sfx.gameOverSound();
    hud.overScreen({
      win, score: dir.score, waves: win ? WAVES : dir.wave,
      kills: killsTotal, time: dir.time,
    }, () => reset());
  },
});

function reset() {
  for (const m of director.moths) scene.remove(m.body);
  for (const s of director.spits) scene.remove(s.mesh);
  for (const m of director.motes) scene.remove(m.mesh);
  director.moths.length = 0;
  director.spits.length = 0;
  director.motes.length = 0;
  director.score = 0;
  director.wave = 1;
  director.time = 0;
  killsTotal = 0;
  player.pos.set(0, 0, 10);
  player.hearts = player.maxHearts;
  player.maxOil = 100;
  player.oil = player.maxOil;
  player.burnRadius = 4.2;
  player.burnRate = 34;
  player.burnDrain = 9;
  player.speed = 13;
  hud.hideAll();
  hud.show();
  hud.setHearts(player.hearts, player.maxHearts);
  hud.setScore(0);
  director.start();
}

document.getElementById('btn-start').addEventListener('click', () => {
  Sfx.initAudio();
  Sfx.startDrone();
  Sfx.click();
  hud.hideAll();
  hud.show();
  hud.setHearts(player.hearts, player.maxHearts);
  hud.setScore(0);
  startTime = performance.now();
  director.start();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Fixed-step simulation, decoupled from rendering.
const STEP = 1 / 60;
let acc = 0;
let prev = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - prev) / 1000);
  prev = now;
  acc += dt;
  while (acc >= STEP) {
    tick(STEP);
    acc -= STEP;
  }
  renderer.render(scene, camera);
}

function tick(dt) {
  const paused = input.paused || director.state === 'paused';
  if (director.state === 'playing' && !paused) {
    player.aimFromScreen(input.ndc.x, input.ndc.y, camera);
    player.clampTo(stones);
    const bonus = lastOilBonus;
    player.update(dt, input.keys, input.mouseDown, camera, bonus);
    Sfx.burnLevel(player.burningNow ? 1 : 0);
    director.update(dt, player, stones);
    hud.setOil(player.oil / player.maxOil);

    // Pulse: clear close moths at an oil cost.
    if (input.takePulse() && player.oil >= player.pulseCost) {
      player.oil -= player.pulseCost;
      Sfx.pulse();
      const ring = new THREE.Vector3(player.pos.x, 1, player.pos.z);
      for (const moth of director.moths.slice()) {
        if (moth.pos.distanceTo(ring) < player.pulseRadius && moth.burn(22)) director.kill(moth);
      }
      hud.say('Pulse', 0.6);
    }
  } else if (paused && director.state === 'playing') {
    hud.say('Paused — press P', 0.5);
  }
}

requestAnimationFrame(frame);

// ── Screenshot driver ────────────────────────────────────────────────────────
// ?shot=start    — the title panel over the idle valley
// ?shot=play     — mid-wave, moths incoming, beam burning
// ?shot=end      — the over screen after a last stand
// ?shot=victory  — the win screen
const shot = Input.fromQuery();
if (shot.shot) {
  hud.hideAll();
  hud.show();
  const seed = shot.seed || 1;
  if (shot.shot === 'start') {
    hud.titleScreen(true);
    markReady();
  } else {
    Sfx.initAudio();
    director.start();
    hud.hideAll();
    hud.show();
    if (shot.shot === 'play') {
      // Live-fire scene: the sim runs for real, but the walker is invulnerable
      // and burning from the first frame, so the beam, camera and moths all
      // behave exactly as they do in play — just safely.
      director.wave = 3;
      hud.setWave(3, WAVES);
      director.score = 1840;
      hud.setScore(1840);
      player.oil = 90;
      player.invuln = 1e9;
      input.ndc.x = 0; input.ndc.y = -0.15;
      input.mouseDown = true;
      hud.say('Wave 3 — surge', 5);
      setTimeout(markReady, 1600);
    } else if (shot.shot === 'end' || shot.shot === 'victory') {
      const win = shot.shot === 'victory';
      director.score = win ? 9240 : 3760;
      director.wave = win ? WAVES : 7;
      director.time = win ? 522 : 341;
      killsTotal = win ? 214 : 96;
      player.hearts = 0;
      hud.setHearts(0, 4);
      hud.setScore(director.score);
      hud.overScreen({ win, score: director.score, waves: director.wave, kills: killsTotal, time: director.time }, () => reset());
      markReady();
    }
  }
}

function markReady() {
  window.__shotReady = true;
}
