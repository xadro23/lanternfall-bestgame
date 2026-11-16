// The wave director: Lanternfall's rules. Twelve waves, each with a budget of
// moth kinds that grows, a surge wave every fourth, wave banners, score, and the
// upgrade choice between waves. It also owns the spits (gloom bolts the weavers
// fire) and the ember motes (score pickups a burned moth leaves behind).

import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { Moth, MOTH_KIND } from './moths.js';

const WAVES = 12;

function waveComposition(w) {
  // Budget of moth points: grows steeply, with a surge every 4th wave.
  const budget = Math.round(6 + w * w * 0.9 + w * 2);
  const comp = [];
  let left = budget;
  const pick = [];
  if (w >= 1) pick.push('darter');
  if (w >= 2) pick.push('weaver');
  if (w >= 3) pick.push('brute');
  if (w >= 5) pick.push('surge');
  const cost = { darter: 1, weaver: 2, brute: 5, surge: 1 };
  while (left > 0) {
    const kind = pick[Math.floor(Math.random() * pick.length)];
    if (cost[kind] > left) { comp.push('darter'); left -= 1; continue; }
    comp.push(kind); left -= cost[kind];
  }
  return comp;
}

export class Director {
  constructor(scene, hooks) {
    this.scene = scene;
    this.hooks = hooks;            // {onWave, onScore, onUpgrade, onOver, onBanner}
    this.wave = 0;
    this.state = 'title';          // title | playing | upgrade | over | paused
    this.moths = [];
    this.spits = [];
    this.motes = [];
    this.score = 0;
    this.waveKills = 0;
    this.upgradesTaken = [];
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.time = 0;
  }

  start() {
    this.wave = 1;
    this.score = 0;
    this.state = 'playing';
    this.beginWave();
  }

  beginWave() {
    const comp = waveComposition(this.wave);
    // Shuffle so the spawn order varies.
    for (let i = comp.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [comp[i], comp[j]] = [comp[j], comp[i]];
    }
    this.spawnQueue = comp;
    this.spawnTimer = 0.5;
    this.waveKills = 0;
    this.hooks.onWave(this.wave);
    const label = this.wave % 4 === 0 ? `Wave ${this.wave} — surge` : `Wave ${this.wave}`;
    this.hooks.onBanner(label, 2.2);
  }

  spawnSpit(from, at) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 8, 8),
      new THREE.MeshBasicMaterial({ color: PALETTE.weaverSpit }),
    );
    mesh.position.copy(from);
    this.scene.add(mesh);
    const vel = at.clone().sub(from).setY(0).normalize().multiplyScalar(10);
    this.spits.push({ pos: from.clone(), vel, mesh, life: 3 });
  }

  spawnMote(at) {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22, 0),
      new THREE.MeshBasicMaterial({ color: PALETTE.ember }),
    );
    mesh.position.copy(at);
    this.scene.add(mesh);
    this.motes.push({ pos: at.clone(), mesh, life: 9, t: 0 });
  }

  spawnMoth(kind, playerPos) {
    // Spawn at the valley edge, a little away from the player's side.
    const angle = Math.atan2(playerPos.z, playerPos.x) + Math.PI + (Math.random() - 0.5) * 1.6;
    const radius = 30 + Math.random() * 10;
    const spawn = new THREE.Vector3(Math.cos(angle) * radius, 2, Math.sin(angle) * radius);
    const moth = new Moth(kind, spawn);
    this.scene.add(moth.body);
    this.moths.push(moth);
  }

  update(dt, player, stones) {
    if (this.state !== 'playing') return;
    this.time += dt;

    // Spawning trickles the queue out over the wave's opening.
    if (this.spawnQueue.length) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 0.55;
        this.spawnMoth(this.spawnQueue.pop(), player.pos);
      }
    }

    // Moths.
    for (const moth of this.moths) {
      moth.update(dt, player.pos, stones, this);
      // Contact damage.
      const d = moth.pos.distanceTo(new THREE.Vector3(player.pos.x, moth.pos.y, player.pos.z));
      if (d < moth.radius + 1.0 && player.takeHit(moth.damage)) {
        this.hooks.onHurt();
        if (player.hearts <= 0) return this.end();
      }
      // Beam damage: is the moth inside the burn cone near its end?
      if (player.burningNow) {
        const rel = moth.pos.clone().sub(player.beamOrigin);
        const along = rel.dot(player.beamDir);
        if (along > 0 && along < 13) {
          const perp = rel.clone().addScaledVector(player.beamDir, -along).length();
          const cone = 0.4 + (along / 13) * player.burnRadius;
          if (perp < cone) {
            if (moth.burn(player.burnRate * dt)) {
              this.kill(moth);
            }
          }
        }
      }
    }

    // Spits fly and can hit the player.
    for (const spit of this.spits) {
      spit.pos.addScaledVector(spit.vel, dt);
      spit.life -= dt;
      spit.mesh.position.copy(spit.pos);
      spit.pos.y += Math.sin(this.time * 14 + spit.pos.x) * 0.01;
      const d = spit.pos.distanceTo(new THREE.Vector3(player.pos.x, 1.4, player.pos.z));
      if (d < 1.0 && player.takeHit(1)) {
        this.hooks.onHurt();
        spit.life = 0;
        if (player.hearts <= 0) return this.end();
      }
    }
    for (let i = this.spits.length - 1; i >= 0; i--) {
      if (this.spits[i].life <= 0) {
        this.scene.remove(this.spits[i].mesh);
        this.spits.splice(i, 1);
      }
    }

    // Motes drift toward the player and add score on pickup.
    for (const mote of this.motes) {
      mote.t += dt;
      mote.life -= dt;
      const toPlayer = new THREE.Vector3(player.pos.x, 1, player.pos.z).sub(mote.pos);
      if (toPlayer.length() < 9) mote.pos.addScaledVector(toPlayer.normalize(), 6 * dt);
      mote.mesh.position.copy(mote.pos);
      mote.mesh.rotation.y += dt * 4;
      mote.mesh.position.y = 0.9 + Math.sin(mote.t * 3) * 0.2;
      if (toPlayer.length() < 1.2) {
        this.score += 5;
        mote.life = 0;
        this.hooks.onScore(this.score);
      }
    }
    for (let i = this.motes.length - 1; i >= 0; i--) {
      if (this.motes[i].life <= 0) {
        this.scene.remove(this.motes[i].mesh);
        this.motes.splice(i, 1);
      }
    }

    // Wave clear.
    if (!this.spawnQueue.length && !this.moths.length) {
      this.waveClear();
    }
  }

  kill(moth) {
    this.scene.remove(moth.body);
    this.moths = this.moths.filter((m) => m !== moth);
    this.score += moth.score;
    this.waveKills += 1;
    this.hooks.onScore(this.score);
    this.spawnMote(moth.pos.clone());
  }

  waveClear() {
    this.hooks.onWaveClear();
    if (this.wave >= WAVES) return this.win();
    this.state = 'upgrade';
    this.hooks.onUpgrade(this.wave);
  }

  applyUpgrade(id, player) {
    this.upgradesTaken.push(id);
    switch (id) {
      case 'wider':
        player.burnRadius += 1.3;
        break;
      case 'hotter':
        player.burnRate += 12;
        break;
      case 'thrifty':
        player.burnDrain *= 0.82;
        break;
      case 'longwick':
        player.maxOil += 30;
        player.oil = player.maxOil;
        break;
      case 'swift':
        player.speed += 2.2;
        break;
      case 'warmth':
        player.maxHearts += 1;
        player.hearts = player.maxHearts;
        break;
    }
    this.state = 'playing';
    this.wave += 1;
    this.beginWave();
  }

  end() {
    this.state = 'over';
    this.hooks.onOver(false, this);
  }

  win() {
    this.state = 'over';
    this.hooks.onOver(true, this);
  }
}

export { WAVES };
