// The moths: Lanternfall's enemies. Four kinds share one body plan (a fuzz
// body, two wings, two embers for eyes) and differ in speed, health and
// behaviour. A darter flutters straight at the light; a brute soaks damage and
// slams; a weaver keeps its distance and spits gloom; a surge moth arrives only
// in surge waves and is fast but fragile. All steering is hand-rolled — no
// path library — and the flock keeps clear of the standing stones.

import * as THREE from 'three';
import { PALETTE, MOTH_TINT } from './palette.js';

let nextId = 1;

function makeBody(kind) {
  const tint = MOTH_TINT[kind];
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 8, 7),
    new THREE.MeshLambertMaterial({ color: tint.body }),
  );
  body.scale.set(1, 0.8, 1.35);
  g.add(body);
  const wingGeo = new THREE.CircleGeometry(0.5, 5);
  const wingMat = new THREE.MeshBasicMaterial({
    color: tint.wing, transparent: true, opacity: 0.82, side: THREE.DoubleSide,
  });
  const wl = new THREE.Mesh(wingGeo, wingMat);
  wl.position.set(0.34, 0.12, 0); wl.rotation.y = Math.PI / 2;
  const wr = wl.clone(); wr.position.x = -0.34;
  g.add(wl, wr);
  const eyeMat = new THREE.MeshBasicMaterial({ color: PALETTE.mothEye });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), eyeMat);
  e1.position.set(0.14, 0.1, 0.42);
  const e2 = e1.clone(); e2.position.x = -0.14;
  g.add(e1, e2);
  g.userData.wings = [wl, wr];
  return g;
}

const KIND = {
  darter: { hp: 10, speed: 5.2, radius: 0.55, damage: 1, score: 10 },
  brute:  { hp: 46, speed: 2.6, radius: 1.05, damage: 2, score: 40 },
  weaver: { hp: 18, speed: 3.4, radius: 0.6, damage: 1, score: 22, ranged: true },
  surge:  { hp: 7, speed: 8.6, radius: 0.45, damage: 1, score: 16 },
};

export class Moth {
  constructor(kind, spawn) {
    this.id = nextId++;
    this.kind = kind;
    const spec = KIND[kind];
    this.hp = spec.hp;
    this.speed = spec.speed * (0.92 + Math.random() * 0.16);
    this.radius = spec.radius;
    this.damage = spec.damage;
    this.score = spec.score;
    this.ranged = !!spec.ranged;
    this.pos = spawn.clone();
    this.pos.y = 1.4 + Math.random() * 2.4;
    this.phase = Math.random() * Math.PI * 2;
    this.hitFlash = 0;
    this.spitTimer = 1.4 + Math.random() * 1.6;
    this.body = makeBody(kind);
    this.body.position.copy(this.pos);
  }

  wingFlap(dt, urgency) {
    for (const w of this.body.userData.wings) {
      w.rotation.z = Math.sin(performance.now() * 0.02 * urgency + this.phase) * 0.8;
    }
  }

  update(dt, playerPos, stones, Director) {
    this.phase += dt * 3;
    const toPlayer = playerPos.clone().sub(this.pos);
    const dist = toPlayer.length();
    toPlayer.normalize();

    let desired = toPlayer.clone();
    if (this.ranged) {
      // Weavers hover at 14–18 m and spit gloom bolts.
      const want = dist < 13 ? -1 : dist > 18 ? 1 : 0;
      desired.multiplyScalar(want);
      // Strafe slowly around the player.
      desired.add(new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar(0.5));
      this.spitTimer -= dt;
      if (this.spitTimer <= 0 && dist < 22) {
        this.spitTimer = 2.2 + Math.random() * 1.4;
        Director.spawnSpit(this.pos.clone(), playerPos.clone());
      }
    } else if (this.kind === 'darter' || this.kind === 'surge') {
      // Darters weave: a sinusoid across their approach so a still player
      // cannot trivially hold one beam angle.
      const sway = Math.sin(this.phase * 2.2) * 0.55;
      desired.add(new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar(sway));
    }

    // Steer clear of the standing stones.
    for (const s of stones) {
      const away = this.pos.clone().sub(s); away.y = 0;
      const d = away.length();
      if (d < 3.2 && d > 0.001) desired.add(away.normalize().multiplyScalar((3.2 - d) * 0.9));
    }

    // Touch the player: deal contact damage via the director's collision pass.
    if (desired.lengthSq() > 0.0001) desired.normalize();
    this.pos.addScaledVector(desired, this.speed * dt);
    // Hover: moths bob above the ground and dip when near the player.
    const hover = dist < 4 ? 0.9 : 1.6 + Math.sin(this.phase) * 0.35;
    this.pos.y += (hover - this.pos.y) * Math.min(1, dt * 3);

    if (this.hitFlash > 0) this.hitFlash -= dt;

    this.body.position.copy(this.pos);
    this.body.lookAt(playerPos.x, this.pos.y, playerPos.z);
    this.wingFlap(dt, 1 + (this.kind === 'surge' ? 1.2 : 0));
    // Ember eyes brighten when close.
    const near = dist < 9 ? 1 : 0.35;
    for (const child of this.body.children) {
      if (child.material && child.material.color.getHex() === PALETTE.mothEye) {
        child.material.color.setHex(PALETTE.mothEye);
        child.scale.setScalar(0.8 + near * 0.6);
      }
    }
  }

  burn(dmg) {
    this.hp -= dmg;
    this.hitFlash = 0.12;
    return this.hp <= 0;
  }
}

export { KIND as MOTH_KIND };
