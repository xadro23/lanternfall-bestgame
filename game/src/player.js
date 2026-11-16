// The player and the lantern they carry. Third-person: the camera follows just
// behind and above, the lantern hangs at the stick's tip, and the burn beam is
// a cone of light from that tip down to wherever the mouse points on the
// ground. Movement is relative to the camera so WASD always means what the eye
// expects.

import * as THREE from 'three';
import { PALETTE } from './palette.js';

export class Player {
  constructor(scene) {
    this.pos = new THREE.Vector3(0, 0, 10);
    this.vel = new THREE.Vector3();
    this.aim = new THREE.Vector3(0, 0, -1);
    this.speed = 13;
    this.dartSpeed = 30;
    this.dartTimer = 0;

    // Survivability: hearts and the lantern's oil.
    this.maxHearts = 4;
    this.hearts = this.maxHearts;
    this.maxOil = 100;
    this.oil = this.maxOil;
    this.oilRegen = 3.5;          // per second, while not burning
    this.burnDrain = 9;           // per second, while burning
    this.dartCost = 6;
    this.pulseCost = 18;
    this.burnRadius = 4.2;        // metres the beam scorches
    this.burnRate = 34;           // damage per second inside the beam
    this.pulseRadius = 9;
    this.invuln = 0;

    // The lantern figure: a stick, the cage, the wick light and its point light.
    this.group = new THREE.Group();
    const stickGeo = new THREE.CylinderGeometry(0.08, 0.1, 2.6, 6);
    const stickMat = new THREE.MeshLambertMaterial({ color: 0x241c14 });
    const stick = new THREE.Mesh(stickGeo, stickMat);
    stick.position.set(0.9, 1.3, 0);
    stick.rotation.z = -0.28;
    this.group.add(stick);

    this.cage = new THREE.Group();
    const cageMat = new THREE.MeshLambertMaterial({ color: 0x3a2c1c });
    const cageBox = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.55), cageMat);
    this.cage.add(cageBox);
    const bars = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.74, 0.6),
      new THREE.MeshBasicMaterial({ color: 0x14100a, wireframe: true }),
    );
    this.cage.add(bars);
    this.cage.position.set(1.65, 2.35, 0);
    this.group.add(this.cage);

    this.wick = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 10, 10),
      new THREE.MeshBasicMaterial({ color: PALETTE.wick }),
    );
    this.wick.position.copy(this.cage.position);
    this.group.add(this.wick);

    this.light = new THREE.PointLight(PALETTE.ember, 2.4, 22, 1.6);
    this.light.position.copy(this.cage.position);
    this.group.add(this.light);

    // The walker under the lantern: a simple cloaked figure so the light has
    // something to land on.
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2c2620 });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 7), bodyMat);
    body.position.y = 0.75;
    this.group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0x4a3d30 }),
    );
    head.position.y = 1.75;
    this.group.add(head);

    scene.add(this.group);

    // Burn beam: a cone of translucent ember light from the wick forward.
    const beamGeo = new THREE.ConeGeometry(1, 12, 24, 1, true);
    beamGeo.translate(0, -6, 0);
    // The cone now runs from its apex at the wick toward -Y; rotating -90° about
    // X lays it along +Z, which is the axis setFromUnitVectors aims at the target.
    beamGeo.rotateX(-Math.PI / 2);
    this.beam = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({
        color: PALETTE.ember, transparent: true, opacity: 0.0,
        depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      }),
    );
    scene.add(this.beam);

    // The warm pool that follows the lantern on the ground.
    this.pool = new THREE.Mesh(
      new THREE.CircleGeometry(7, 36),
      new THREE.MeshBasicMaterial({
        color: PALETTE.emberDeep, transparent: true, opacity: 0.16,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.position.y = 0.05;
    scene.add(this.pool);

    this.bobT = 0;
  }

  aimFromScreen(ndcX, ndcY, camera) {
    // Project the mouse onto the ground plane and aim the beam at that point.
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const t = -ray.ray.origin.y / ray.ray.direction.y;
    if (t > 0) {
      this.aim.copy(ray.ray.origin).addScaledVector(ray.ray.direction, t);
      this.aim.y = 0;
    }
  }

  update(dt, keys, mouseDown, camera, oilBonus) {
    const drain = this.burnDrain * (1 - (oilBonus?.drainCut ?? 0));
    const burning = mouseDown && this.oil > 0;

    // Movement in camera space.
    const dir = new THREE.Vector3();
    if (keys.has('w')) dir.z -= 1;
    if (keys.has('s')) dir.z += 1;
    if (keys.has('a')) dir.x -= 1;
    if (keys.has('d')) dir.x += 1;
    const camYaw = Math.atan2(
      camera.position.x - this.pos.x,
      camera.position.z - this.pos.z,
    );
    if (dir.lengthSq() > 0) {
      dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), camYaw);
    }

    // Dart on shift: a short burst, spending oil.
    if ((keys.has('shift')) && this.dartTimer <= 0 && this.oil >= this.dartCost && dir.lengthSq() > 0) {
      this.dartTimer = 0.32;
      this.oil -= this.dartCost;
    }

    const speed = this.dartTimer > 0 ? this.dartSpeed : this.speed * (1 + (oilBonus?.speedUp ?? 0));
    if (this.dartTimer > 0) this.dartTimer -= dt;
    this.pos.addScaledVector(dir, speed * dt);

    // Keep inside the valley and off the standing stones (handled by caller
    // via clampTo). Here only the soft radius clamp.
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > 44) { this.pos.multiplyScalar(44 / r); }

    // Oil economy: burn drains, idle regenerates.
    if (burning) { this.oil -= drain * dt; } else { this.oil += this.oilRegen * (1 + (oilBonus?.regenUp ?? 0)) * dt; }
    this.oil = Math.max(0, Math.min(this.maxOil * (1 + (oilBonus?.maxUp ?? 0)), this.oil));

    if (this.invuln > 0) this.invuln -= dt;

    // Beam state for the director: the cone tracks the aim.
    const burningNow = burning && this.oil > 0;
    const origin = this.wick.getWorldPosition(new THREE.Vector3());
    const flat = this.aim.clone().sub(origin).setY(0);
    const dist = Math.max(2, flat.length());
    const dirBeam = flat.normalize();
    this.beam.position.copy(origin);
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirBeam);
    this.beam.scale.set(1, 1, dist / 12);
    const target = burningNow ? 0.55 : 0.0;
    const mat = this.beam.material;
    mat.opacity += (target - mat.opacity) * Math.min(1, dt * 12);
    this.burningNow = burningNow;
    this.beamOrigin = origin;
    this.beamDir = dirBeam;

    // Figure placement: face the aim, bob while walking.
    this.group.position.set(this.pos.x, 0, this.pos.z);
    const face = Math.atan2(this.aim.x - this.pos.x, this.aim.z - this.pos.z);
    this.group.rotation.y = face + Math.PI;
    if (dir.lengthSq() > 0) this.bobT += dt * 9; else this.bobT *= 0.9;
    this.cage.position.y = 2.35 + Math.sin(this.bobT) * 0.06;
    this.wick.position.y = this.cage.position.y;
    this.light.position.y = this.cage.position.y;

    // The light dims as oil runs low: the core drama of the game.
    const oilFrac = this.oil / this.maxOil;
    this.light.intensity = 1.4 + oilFrac * 2.4 + (burningNow ? 2.0 : 0);
    const warm = new THREE.Color(PALETTE.ember).lerp(new THREE.Color(PALETTE.emberDeep), 1 - oilFrac);
    this.light.color = warm;
    this.wick.material.color = warm;

    this.pool.position.set(this.pos.x, 0.05, this.pos.z);
    this.pool.material.opacity = 0.1 + oilFrac * 0.1;
    this.pool.scale.setScalar(0.55 + oilFrac * 0.45);

    // Camera: behind and above, eased.
    const wanted = new THREE.Vector3(
      this.pos.x - dirBeam.x * 10,
      8.5,
      this.pos.z - dirBeam.z * 10,
    );
    camera.position.lerp(wanted, Math.min(1, dt * 3.2));
    camera.lookAt(this.pos.x, 1.4, this.pos.z);
  }

  takeHit(dmg) {
    if (this.invuln > 0) return false;
    this.hearts -= dmg;
    this.invuln = 0.9;
    return true;
  }

  clampTo(stones) {
    for (const s of stones) {
      const dx = this.pos.x - s.x, dz = this.pos.z - s.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.6 && d > 0.001) {
        this.pos.x = s.x + (dx / d) * 1.6;
        this.pos.z = s.z + (dz / d) * 1.6;
      }
    }
  }
}
