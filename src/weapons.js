import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export const WEAPON_TYPES = {
  FISTS: {
    id: 'fists',
    name: 'Кулаки (Fists)',
    damage: 30,
    range: 3.5,
    fireRate: 0.38,
    isMelee: true,
    maxAmmo: Infinity,
    magSize: Infinity
  },
  PISTOL: {
    id: 'pistol',
    name: 'Glock 19 (Пистолет)',
    damage: 45,
    range: 90,
    fireRate: 0.25,
    isMelee: false,
    maxAmmo: 90,
    magSize: 15
  },
  RIFLE: {
    id: 'rifle',
    name: 'M4A1 (Автомат)',
    damage: 35,
    range: 160,
    fireRate: 0.10, // Full auto rapid fire
    isMelee: false,
    maxAmmo: 180,
    magSize: 30
  }
};

export class WeaponSystem {
  constructor(scene, physics, sound, camera) {
    this.scene = scene;
    this.physics = physics;
    this.sound = sound;
    this.camera = camera;

    // Active weapon state
    this.currentType = 'PISTOL';
    this.currentWeapon = WEAPON_TYPES[this.currentType];
    this.ammo = {
      fists: { mag: Infinity, reserve: Infinity },
      pistol: { mag: 15, reserve: 75 },
      rifle: { mag: 30, reserve: 150 }
    };

    this.lastShotTime = 0;
    this.isAiming = false;
    this.isFiring = false;

    // Raycaster for shooting
    this.raycaster = new THREE.Raycaster();

    // Visual weapon meshes attached to player
    this.weaponAnchor = new THREE.Group();
    this.scene.add(this.weaponAnchor);

    this.muzzleLight = new THREE.PointLight(0xffaa22, 0, 10);
    this.scene.add(this.muzzleLight);

    this.buildWeaponModels();

    // Bullet impact particles pool
    this.sparks = [];
    this.initSparksPool();
  }

  buildWeaponModels() {
    this.pistolMesh = this.createPistolMesh();
    this.rifleMesh = this.createRifleMesh();

    this.weaponAnchor.add(this.pistolMesh);
    this.weaponAnchor.add(this.rifleMesh);

    this.updateVisibleWeapon();
  }

  createPistolMesh() {
    const group = new THREE.Group();
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.9, roughness: 0.3 });
    const slideMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.95, roughness: 0.2 });

    // Slide / Barrel
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.32), slideMat);
    slide.position.set(0, 0.08, 0.08);
    slide.castShadow = true;
    group.add(slide);

    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.1), gunMat);
    grip.position.set(0, -0.04, -0.02);
    grip.rotation.x = -0.25;
    group.add(grip);

    // Muzzle tip marker
    this.pistolMuzzle = new THREE.Object3D();
    this.pistolMuzzle.position.set(0, 0.08, 0.26);
    group.add(this.pistolMuzzle);

    return group;
  }

  createRifleMesh() {
    const group = new THREE.Group();
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x161616, metalness: 0.85, roughness: 0.3 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x282828, metalness: 0.95, roughness: 0.2 });

    // Main receiver
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.55), darkMat);
    receiver.position.set(0, 0.04, 0);
    receiver.castShadow = true;
    group.add(receiver);

    // Long Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.45, 8), barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.06, 0.45);
    group.add(barrel);

    // Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.28), darkMat);
    stock.position.set(0, -0.01, -0.38);
    group.add(stock);

    // Curved Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.22, 0.11), darkMat);
    mag.position.set(0, -0.12, 0.08);
    mag.rotation.x = -0.3;
    group.add(mag);

    // Scope / Optic
    const scope = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.2), barrelMat);
    scope.position.set(0, 0.13, 0);
    group.add(scope);

    // Muzzle tip marker
    this.rifleMuzzle = new THREE.Object3D();
    this.rifleMuzzle.position.set(0, 0.06, 0.7);
    group.add(this.rifleMuzzle);

    return group;
  }

  initSparksPool() {
    const sparkGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffcc33 });

    for (let i = 0; i < 20; i++) {
      const spark = new THREE.Mesh(sparkGeo, sparkMat);
      spark.visible = false;
      this.scene.add(spark);
      this.sparks.push({ mesh: spark, vel: new THREE.Vector3(), life: 0 });
    }
  }

  spawnHitSparks(pos, normal, color = 0xffcc33) {
    let spawned = 0;
    for (const s of this.sparks) {
      if (s.life <= 0) {
        s.mesh.position.copy(pos);
        s.mesh.material.color.setHex(color);
        s.mesh.visible = true;
        s.vel.set(
          (Math.random() - 0.5) * 8 + normal.x * 4,
          Math.random() * 8 + normal.y * 4,
          (Math.random() - 0.5) * 8 + normal.z * 4
        );
        s.life = 0.35;
        spawned++;
        if (spawned >= 6) break;
      }
    }
  }

  selectWeapon(type) {
    if (!WEAPON_TYPES[type]) return;
    this.currentType = type;
    this.currentWeapon = WEAPON_TYPES[type];
    this.sound.playReload();
    this.updateVisibleWeapon();
  }

  cycleWeapon(dir = 1) {
    const keys = Object.keys(WEAPON_TYPES);
    let idx = keys.indexOf(this.currentType);
    idx = (idx + dir + keys.length) % keys.length;
    this.selectWeapon(keys[idx]);
  }

  updateVisibleWeapon() {
    this.pistolMesh.visible = (this.currentType === 'PISTOL');
    this.rifleMesh.visible = (this.currentType === 'RIFLE');
  }

  reload() {
    const w = this.ammo[this.currentWeapon.id];
    if (!w || w.mag >= this.currentWeapon.magSize || w.reserve <= 0) return;

    const needed = this.currentWeapon.magSize - w.mag;
    const take = Math.min(needed, w.reserve);
    w.mag += take;
    w.reserve -= take;
    this.sound.playReload();
  }

  shoot(player, traffic) {
    const now = performance.now() / 1000;
    if (now - this.lastShotTime < this.currentWeapon.fireRate) return;

    // Check ammo
    const wAmmo = this.ammo[this.currentWeapon.id];
    if (!this.currentWeapon.isMelee && wAmmo.mag <= 0) {
      this.sound.playReload();
      return;
    }

    this.lastShotTime = now;
    if (!this.currentWeapon.isMelee) {
      wAmmo.mag--;
    }

    // Play sound & muzzle flash
    if (this.currentWeapon.id === 'PISTOL') {
      this.sound.playPistol();
      this.flashMuzzle(this.pistolMuzzle);
    } else if (this.currentWeapon.id === 'RIFLE') {
      this.sound.playRifle();
      this.flashMuzzle(this.rifleMuzzle);
    } else {
      this.sound.playPunch();
    }

    // Raycast center of screen
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const ray = this.raycaster.ray;

    // 1. Check Pedestrians
    let hitSomething = false;
    for (const ped of traffic.pedestrians) {
      const pPos = ped.group.position;
      // Distance from ray to pedestrian
      const targetVec = pPos.clone().sub(ray.origin);
      const proj = targetVec.dot(ray.direction);

      if (proj > 0 && proj < this.currentWeapon.range) {
        const closestPoint = ray.origin.clone().add(ray.direction.clone().multiplyScalar(proj));
        const distToPed = closestPoint.distanceTo(new THREE.Vector3(pPos.x, pPos.y + 0.8, pPos.z));

        if (distToPed < 0.95) {
          // HIT PEDESTRIAN!
          ped.isRagdoll = true;
          ped.ragdollTimer = 8;
          ped.body.fixedRotation = false;

          const imp = ray.direction.clone().multiplyScalar(this.currentWeapon.damage * 0.6);
          imp.y += 4;
          ped.body.velocity.copy(imp);
          ped.group.rotation.x = Math.PI / 2;

          this.spawnHitSparks(closestPoint, new THREE.Vector3(0, 1, 0), 0xff2222);
          traffic.triggerCrime(traffic.wantedLevel + 1);
          hitSomething = true;
          break;
        }
      }
    }

    // 2. Check Vehicles
    if (!hitSomething) {
      for (const v of traffic.vehicles) {
        if (player.inVehicle && v === player.currentVehicle) continue;
        const vPos = v.mesh.position;
        const targetVec = vPos.clone().sub(ray.origin);
        const proj = targetVec.dot(ray.direction);

        if (proj > 0 && proj < this.currentWeapon.range) {
          const closestPoint = ray.origin.clone().add(ray.direction.clone().multiplyScalar(proj));
          const distToCar = closestPoint.distanceTo(new THREE.Vector3(vPos.x, vPos.y + 0.4, vPos.z));

          if (distToCar < 1.8) {
            // HIT VEHICLE!
            const hitImpulse = ray.direction.clone().multiplyScalar(this.currentWeapon.damage * 12);
            v.body.velocity.x += hitImpulse.x / v.spec.mass * 20;
            v.body.velocity.z += hitImpulse.z / v.spec.mass * 20;

            this.spawnHitSparks(closestPoint, new THREE.Vector3(0, 1, 0), 0xffcc00);
            this.sound.playCrash(0.6);

            if (v.spec.type === 'police') {
              traffic.triggerCrime(traffic.wantedLevel + 2);
            }
            hitSomething = true;
            break;
          }
        }
      }
    }

    // 3. Ground / Wall impact
    if (!hitSomething && !this.currentWeapon.isMelee) {
      // Intersect ground plane
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const groundHit = new THREE.Vector3();
      if (ray.intersectPlane(groundPlane, groundHit)) {
        if (ray.origin.distanceTo(groundHit) < this.currentWeapon.range) {
          this.spawnHitSparks(groundHit, new THREE.Vector3(0, 1, 0), 0xdde5ed);
        }
      }
    }
  }

  flashMuzzle(muzzleNode) {
    if (!muzzleNode) return;
    const worldPos = new THREE.Vector3();
    muzzleNode.getWorldPosition(worldPos);

    this.muzzleLight.position.copy(worldPos);
    this.muzzleLight.intensity = 4.0;
    setTimeout(() => {
      this.muzzleLight.intensity = 0;
    }, 45);
  }

  update(dt, player) {
    // Update sparks
    for (const s of this.sparks) {
      if (s.life > 0) {
        s.life -= dt;
        s.vel.y -= 18 * dt; // gravity
        s.mesh.position.addScaledVector(s.vel, dt);
        if (s.life <= 0) s.mesh.visible = false;
      }
    }

    if (player.inVehicle) {
      this.weaponAnchor.visible = false;
      return;
    }

    this.weaponAnchor.visible = (this.currentType !== 'FISTS');

    // Attach weapon to player's right side / chest
    const pPos = player.mesh.position;
    const yaw = player.cameraYaw;

    // Position weapon forward and slightly to the right
    const offset = new THREE.Vector3(0.35, 1.15, -0.45).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.weaponAnchor.position.copy(pPos).add(offset);

    // Aim weapon in camera pitch and yaw direction
    this.weaponAnchor.rotation.y = yaw;
    this.weaponAnchor.rotation.x = player.cameraPitch;
  }
}
