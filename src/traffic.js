import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Vehicle } from './vehicle.js';
import { CONFIG } from './config.js';

export class TrafficManager {
  constructor(scene, physics, sound, city) {
    this.scene = scene;
    this.physics = physics;
    this.sound = sound;
    this.city = city;

    this.vehicles = [];
    this.pedestrians = [];
    this.policeCars = [];
    this.wantedLevel = 0; // 0 to 5 stars

    this.initParkedCars();
    this.initPedestrians();
  }

  initParkedCars() {
    for (const sp of this.city.carSpawnPoints) {
      const spec = CONFIG.VEHICLES[sp.type] || CONFIG.VEHICLES.SUPER;
      const vehicle = new Vehicle(this.scene, this.physics, this.sound, spec, { x: sp.x, y: sp.y, z: sp.z }, sp.rot);
      this.vehicles.push(vehicle);
    }
  }

  initPedestrians() {
    const numPedestrians = 25;
    const colors = [0xe74c3c, 0x3498db, 0x2ecc71, 0x9b59b6, 0xf39c12, 0x1abc9c, 0xd35400];
    const skinColors = [0xd49b77, 0xbb8058, 0x8d5524, 0xf0cbb5];

    for (let i = 0; i < numPedestrians; i++) {
      // Pick random sidewalk spot
      const blockX = (Math.floor(Math.random() * 5) - 2) * CONFIG.BLOCK_SIZE;
      const blockZ = (Math.floor(Math.random() * 5) - 2) * CONFIG.BLOCK_SIZE;
      const side = Math.random() > 0.5 ? 1 : -1;
      const px = blockX + side * (CONFIG.BLOCK_SIZE / 2 - 2);
      const pz = blockZ + (Math.random() - 0.5) * (CONFIG.BLOCK_SIZE - 20);

      const pedGroup = new THREE.Group();
      
      // Materials
      const shirtMat = new THREE.MeshStandardMaterial({
        color: colors[Math.floor(Math.random() * colors.length)]
      });
      const skinMat = new THREE.MeshStandardMaterial({
        color: skinColors[Math.floor(Math.random() * skinColors.length)]
      });
      const pantsMat = new THREE.MeshStandardMaterial({ color: 0x223344 });

      // Torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.28), shirtMat);
      torso.position.y = 0.85;
      torso.castShadow = true;
      pedGroup.add(torso);

      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.26), skinMat);
      head.position.y = 1.25;
      head.castShadow = true;
      pedGroup.add(head);

      // Limbs
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), pantsMat);
      legL.position.set(-0.13, 0.35, 0);
      legL.castShadow = true;
      const legR = legL.clone();
      legR.position.x = 0.13;
      pedGroup.add(legL);
      pedGroup.add(legR);

      pedGroup.position.set(px, 0.35, pz);
      this.scene.add(pedGroup);

      // Physics dynamic body
      const pedBody = new CANNON.Body({
        mass: 60,
        shape: new CANNON.Cylinder(0.3, 0.3, 1.4, 8),
        material: this.physics.playerMaterial,
        fixedRotation: true,
        linearDamping: 0.2
      });
      pedBody.position.set(px, 1.0, pz);
      this.physics.world.addBody(pedBody);

      this.pedestrians.push({
        group: pedGroup,
        body: pedBody,
        legL: legL,
        legR: legR,
        walkSpeed: 1.5 + Math.random() * 1.5,
        walkDir: Math.random() > 0.5 ? 1 : -1,
        walkAxis: Math.random() > 0.5 ? 'z' : 'x',
        walkAnim: Math.random() * Math.PI,
        isRagdoll: false,
        ragdollTimer: 0
      });
    }
  }

  triggerCrime(stars = 1) {
    this.wantedLevel = Math.min(5, Math.max(this.wantedLevel, stars));
    this.sound.setSiren(this.wantedLevel > 0);

    // Spawn police cruiser if not already pursuing
    if (this.policeCars.length === 0 && this.wantedLevel > 0) {
      this.spawnPoliceInterceptor();
    }
  }

  spawnPoliceInterceptor() {
    const policeSpec = CONFIG.VEHICLES.POLICE;
    const police = new Vehicle(
      this.scene,
      this.physics,
      this.sound,
      policeSpec,
      { x: 30, y: 0.5, z: 30 },
      0
    );
    this.policeCars.push(police);
    this.vehicles.push(police);
  }

  update(dt, playerPos, activeCar) {
    // 1. Update NPC Pedestrians
    for (const ped of this.pedestrians) {
      if (ped.isRagdoll) {
        ped.ragdollTimer -= dt;
        if (ped.ragdollTimer <= 0) {
          // Recover from knockdown
          ped.isRagdoll = false;
          ped.body.fixedRotation = true;
          ped.body.quaternion.set(0, 0, 0, 1);
          ped.group.rotation.x = 0;
        }
        ped.group.position.copy(ped.body.position);
        continue;
      }

      // Walk along sidewalk
      ped.walkAnim += dt * 6;
      ped.legL.rotation.x = Math.sin(ped.walkAnim) * 0.5;
      ped.legR.rotation.x = -Math.sin(ped.walkAnim) * 0.5;

      const vx = ped.walkAxis === 'x' ? ped.walkDir * ped.walkSpeed : 0;
      const vz = ped.walkAxis === 'z' ? ped.walkDir * ped.walkSpeed : 0;
      ped.body.velocity.x = vx;
      ped.body.velocity.z = vz;

      ped.group.position.set(ped.body.position.x, ped.body.position.y - 0.7, ped.body.position.z);

      // Check collision with player car
      if (activeCar && activeCar.speedKmh > 15) {
        const dist = ped.group.position.distanceTo(activeCar.mesh.position);
        if (dist < 2.5) {
          // Pedestrian hit by car! Knockback & ragdoll
          ped.isRagdoll = true;
          ped.ragdollTimer = 6;
          ped.body.fixedRotation = false;
          
          const impact = activeCar.body.velocity.clone().scale(1.2);
          impact.y += 6;
          ped.body.velocity.copy(impact);
          ped.group.rotation.x = Math.PI / 2;

          this.sound.playCrash(1.5);
          this.triggerCrime(this.wantedLevel + 1);
        }
      }
    }

    // 2. Update Police Pursuit AI
    if (this.wantedLevel > 0 && this.policeCars.length > 0) {
      const targetPos = activeCar ? activeCar.mesh.position : playerPos;

      for (const cop of this.policeCars) {
        if (cop.isDriven) continue; // If player stole the police car, don't control it with AI!

        const copPos = cop.mesh.position;
        const dist = copPos.distanceTo(targetPos);

        // Vector to target
        const dir = targetPos.clone().sub(copPos).normalize();
        const copForward = new THREE.Vector3(0, 0, 1).applyQuaternion(cop.mesh.quaternion);

        // Dot product to see if facing target
        const forwardDot = copForward.dot(dir);
        const cross = new THREE.Vector3().crossVectors(copForward, dir);

        const aiInput = {
          forward: forwardDot > -0.2 && dist > 4,
          backward: forwardDot < -0.4,
          left: cross.y > 0.1,
          right: cross.y < -0.1,
          handbrake: dist < 8 && cop.speedKmh > 40,
          nitro: dist > 40,
          horn: dist < 12
        };

        cop.update(dt, aiInput);
      }
    }
  }
}
