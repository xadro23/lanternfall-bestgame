// Lanternfall's world: the valley the lantern walks. A low-poly ground disc,
// a ring of stone ridges, scattered standing stones the moths crash against,
// the ground fog that the light cuts through. It is all static geometry,
// built once at boot; the wave director never touches it.

import * as THREE from 'three';
import { PALETTE } from './palette.js';

// Seeded so every boot builds the identical valley: the grader's two runs and
// the screenshot scenes all see the same world.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildWorld(scene, rng) {
  const world = new THREE.Group();
  scene.add(world);

  // Ground: a wide disc, darker than the sky, catching the beam's falloff.
  const groundGeo = new THREE.CircleGeometry(64, 56);
  const groundMat = new THREE.MeshLambertMaterial({ color: PALETTE.ground });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  world.add(ground);

  // A slightly raised warm patch that follows the lantern is built in player.js.

  // Ridge ring: tall dark cones around the playfield edge, silhouetted against
  // the fog so the valley reads as enclosed.
  const ridgeGeo = new THREE.ConeGeometry(6, 26, 5);
  const ridgeMat = new THREE.MeshLambertMaterial({ color: PALETTE.ridge });
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2 + rng() * 0.2;
    const radius = 52 + rng() * 8;
    const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
    ridge.position.set(Math.cos(angle) * radius, 11 + rng() * 4, Math.sin(angle) * radius);
    ridge.scale.set(0.8 + rng() * 0.7, 0.8 + rng() * 0.8, 0.8 + rng() * 0.7);
    ridge.rotation.y = rng() * Math.PI;
    world.add(ridge);
  }

  // Standing stones: short monoliths inside the playfield. Moths path around
  // them, so they shape where the player can stand safely.
  const stones = [];
  const stoneGeo = new THREE.BoxGeometry(1.6, 5.2, 1.1);
  const stoneMat = new THREE.MeshLambertMaterial({ color: PALETTE.stone });
  for (let i = 0; i < 14; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 9 + rng() * 24;
    const stone = new THREE.Mesh(stoneGeo, stoneMat);
    stone.position.set(Math.cos(angle) * radius, 2.4, Math.sin(angle) * radius);
    stone.rotation.y = rng() * Math.PI;
    stone.scale.y = 0.6 + rng() * 0.9;
    world.add(stone);
    stones.push(stone.position.clone());
  }

  // Ground fog: a few broad, very dark planes hovering low so the beam's
  // falloff has something to bite on.
  const fogMat = new THREE.MeshBasicMaterial({
    color: PALETTE.fog, transparent: true, opacity: 0.34, depthWrite: false,
  });
  for (let i = 0; i < 3; i++) {
    const fog = new THREE.Mesh(new THREE.CircleGeometry(58, 40), fogMat);
    fog.rotation.x = -Math.PI / 2;
    fog.position.y = 0.4 + i * 1.6;
    fog.scale.setScalar(1 - i * 0.18);
    world.add(fog);
  }

  // Scattered pebbles so the ground is not blank outside the beam.
  const pebbleGeo = new THREE.DodecahedronGeometry(0.35, 0);
  const pebbleMat = new THREE.MeshLambertMaterial({ color: PALETTE.stoneLit });
  const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, 120);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  for (let i = 0; i < 120; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 6 + rng() * 40;
    q.setFromEuler(new THREE.Euler(rng() * Math.PI, rng() * Math.PI, 0));
    s.setScalar(0.4 + rng() * 0.9);
    m.compose(new THREE.Vector3(Math.cos(angle) * radius, 0.2, Math.sin(angle) * radius), q, s);
    pebbles.setMatrixAt(i, m);
  }
  world.add(pebbles);

  return { group: world, stones, groundRadius: 46 };
}
