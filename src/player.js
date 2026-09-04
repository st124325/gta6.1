import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from './config.js?v=4';
import { Assets } from './assets.js?v=4';

export class Player {
  constructor(scene, physics, sound, initialPos) {
    this.scene = scene;
    this.physics = physics;
    this.sound = sound;

    this.health = CONFIG.PLAYER.MAX_HEALTH;
    this.isDead = false;
    this.inVehicle = false;
    this.currentVehicle = null;

    // Movement state
    this.isGrounded = false;
    this.isSprinting = false;
    this.walkCycle = 0;
    this.footstepTimer = 0;

    // Camera orbit parameters
    this.cameraDistance = 4.8;
    this.cameraYaw = 0;
    this.cameraPitch = 0.22;

    // Animation state for GLTF Soldier
    this.mixer = null;
    this.animations = {};
    this.currentActionName = 'Idle';
    this.soldierLoaded = false;

    this.initPhysics(initialPos);
    this.initVisuals();
    this.loadCharacterModel();
  }

  initPhysics(pos) {
    const halfHeight = CONFIG.PLAYER.HEIGHT / 2; // 0.9m
    const radius = CONFIG.PLAYER.RADIUS;

    const shape = new CANNON.Box(new CANNON.Vec3(radius, halfHeight, radius));
    this.body = new CANNON.Body({
      mass: 75,
      material: this.physics.playerMaterial,
      fixedRotation: true,
      angularDamping: 1.0,
      linearDamping: 0.05
    });

    this.body.addShape(shape);
    this.body.position.set(pos.x, pos.y + halfHeight, pos.z);
    this.physics.world.addBody(this.body);
  }

  initVisuals() {
    this.mesh = new THREE.Group();
    this.modelRoot = new THREE.Group();
    this.mesh.add(this.modelRoot);

    // Procedural placeholder while GLTF loads
    this.buildProceduralMesh();

    this.scene.add(this.mesh);
  }

  buildProceduralMesh() {
    this.procGroup = new THREE.Group();
    this.modelRoot.add(this.procGroup);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd49b77, roughness: 0.8 });
    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x1f242b, roughness: 0.5 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.8 });
    const jeansMat = new THREE.MeshStandardMaterial({ color: 0x224263, roughness: 0.7 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1b1816, roughness: 0.9 });
    const glassesMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.32), jacketMat);
    torso.position.y = 0.95;
    torso.castShadow = true;
    this.procGroup.add(torso);
    this.torso = torso;

    const shirtStripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.04), shirtMat);
    shirtStripe.position.set(0, 0, 0.16);
    torso.add(shirtStripe);

    // Head
    this.head = new THREE.Group();
    this.head.position.set(0, 1.45, 0);
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.35, 0.32), skinMat);
    headMesh.castShadow = true;
    this.head.add(headMesh);
    const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.34), hairMat);
    hairMesh.position.set(0, 0.14, 0);
    this.head.add(hairMesh);
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.08), glassesMat);
    glasses.position.set(0, 0.04, 0.16);
    this.head.add(glasses);
    this.procGroup.add(this.head);

    // Arms
    this.armL = new THREE.Group();
    this.armL.position.set(-0.36, 1.25, 0);
    const armLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.16), jacketMat);
    armLMesh.position.y = -0.25;
    armLMesh.castShadow = true;
    this.armL.add(armLMesh);
    this.procGroup.add(this.armL);

    this.armR = new THREE.Group();
    this.armR.position.set(0.36, 1.25, 0);
    const armRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.16), jacketMat);
    armRMesh.position.y = -0.25;
    armRMesh.castShadow = true;
    this.armR.add(armRMesh);
    this.procGroup.add(this.armR);

    // Legs
    this.legL = new THREE.Group();
    this.legL.position.set(-0.16, 0.68, 0);
    const legLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.60, 0.2), jeansMat);
    legLMesh.position.y = -0.30;
    legLMesh.castShadow = true;
    this.legL.add(legLMesh);
    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.28), shoeMat);
    shoeL.position.set(0, -0.62, 0.04);
    shoeL.castShadow = true;
    this.legL.add(shoeL);
    this.procGroup.add(this.legL);

    this.legR = new THREE.Group();
    this.legR.position.set(0.16, 0.68, 0);
    const legRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.60, 0.2), jeansMat);
    legRMesh.position.y = -0.30;
    legRMesh.castShadow = true;
    this.legR.add(legRMesh);
    const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.28), shoeMat);
    shoeR.position.set(0, -0.62, 0.04);
    shoeR.castShadow = true;
    this.legR.add(shoeR);
    this.procGroup.add(this.legR);
  }

  loadCharacterModel() {
    Assets.loadGLTF('./assets/Soldier.glb')
      .then((gltf) => {
        const soldierModel = gltf.scene;
        soldierModel.scale.set(0.95, 0.95, 0.95);
        soldierModel.position.set(0, 0, 0);

        soldierModel.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Hide procedural mesh and add animated Soldier
        this.procGroup.visible = false;
        this.modelRoot.add(soldierModel);

        // Setup Skeletal Animation Mixer
        this.mixer = new THREE.AnimationMixer(soldierModel);
        for (const clip of gltf.animations) {
          const action = this.mixer.clipAction(clip);
          this.animations[clip.name] = action;
        }

        if (this.animations['Idle']) {
          this.animations['Idle'].play();
          this.currentActionName = 'Idle';
        }

        this.soldierLoaded = true;
      })
      .catch((err) => {
        console.log('Using procedural character model fallback');
      });
  }

  jump() {
    if (this.isGrounded && !this.inVehicle) {
      this.body.velocity.y = CONFIG.PLAYER.JUMP_FORCE;
      this.isGrounded = false;
      this.sound.playJump();
    }
  }

  enterVehicle(vehicle) {
    this.inVehicle = true;
    this.currentVehicle = vehicle;
    vehicle.isDriven = true;
    vehicle.sound.startEngine();

    this.mesh.visible = false;
    this.body.type = CANNON.Body.STATIC;
    this.body.position.set(0, -50, 0);
    this.body.velocity.set(0, 0, 0);
  }

  exitVehicle() {
    if (!this.inVehicle || !this.currentVehicle) return;

    const v = this.currentVehicle;
    v.isDriven = false;
    v.sound.stopEngine();

    const leftVec = new THREE.Vector3(-2.2, 0.3, 0).applyQuaternion(v.mesh.quaternion);
    const spawnPos = v.mesh.position.clone().add(leftVec);

    this.body.type = CANNON.Body.DYNAMIC;
    this.body.position.set(spawnPos.x, spawnPos.y + 0.9, spawnPos.z);
    this.body.velocity.set(0, 0, 0);

    this.mesh.visible = true;
    this.inVehicle = false;
    this.currentVehicle = null;
  }

  update(dt, input, camera) {
    if (this.inVehicle) {
      this.mesh.position.copy(this.currentVehicle.mesh.position);
      return;
    }

    // Precise height placement: feet touch ground at y = 0
    this.mesh.position.set(
      this.body.position.x,
      this.body.position.y - 0.9,
      this.body.position.z
    );

    this.isGrounded = this.body.position.y <= 0.95 || Math.abs(this.body.velocity.y) < 0.25;

    // Movement calculation
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraYaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraYaw);

    const moveDir = new THREE.Vector3(0, 0, 0);
    if (input.forward) moveDir.add(forward);
    if (input.backward) moveDir.sub(forward);
    if (input.right) moveDir.add(right);
    if (input.left) moveDir.sub(right);

    const isMoving = moveDir.lengthSq() > 0.01;
    if (isMoving) {
      moveDir.normalize();
      this.isSprinting = input.nitro;
      const speed = this.isSprinting ? CONFIG.PLAYER.RUN_SPEED : CONFIG.PLAYER.WALK_SPEED;

      this.body.velocity.x = moveDir.x * speed;
      this.body.velocity.z = moveDir.z * speed;
    } else {
      this.body.velocity.x *= 0.25;
      this.body.velocity.z *= 0.25;
      this.walkCycle = 0;
      this.footstepTimer = 0;
    }

    // Character orientation
    if (input && input.aim) {
      this.modelRoot.rotation.y = this.cameraYaw;
    } else if (isMoving) {
      const targetAngle = Math.atan2(moveDir.x, moveDir.z) + Math.PI;
      this.modelRoot.rotation.y = targetAngle;
    }

    // Footstep sounds
    if (isMoving) {
      const animSpeed = this.isSprinting ? 20 : 12;
      this.walkCycle += dt * animSpeed;

      this.footstepTimer += dt * animSpeed;
      if (this.footstepTimer > Math.PI) {
        this.footstepTimer = 0;
        this.sound.playFootstep(this.isSprinting);
      }
    }

    // Update animations (Skeletal or Procedural fallback)
    if (this.soldierLoaded && this.mixer) {
      let desiredAction = 'Idle';
      let playSpeed = 1.0;

      if (!this.isGrounded) {
        desiredAction = 'Walk';
        playSpeed = 0.4;
      } else if (isMoving) {
        if (this.isSprinting) {
          desiredAction = 'Run';
          playSpeed = 1.35;
        } else {
          desiredAction = 'Walk';
          playSpeed = 1.4;
        }
      }

      if (this.currentActionName !== desiredAction) {
        const prev = this.animations[this.currentActionName];
        const next = this.animations[desiredAction];
        if (next) {
          next.reset();
          next.timeScale = playSpeed;
          next.play();
          if (prev && prev !== next) {
            prev.crossFadeTo(next, 0.18, true);
          }
          this.currentActionName = desiredAction;
        }
      } else if (this.animations[desiredAction]) {
        this.animations[desiredAction].timeScale = playSpeed;
      }

      this.mixer.update(dt);
    } else {
      this.animateProcedural(dt, isMoving);
    }

    if (input.handbrake) {
      this.jump();
    }
  }

  animateProcedural(dt, isMoving) {
    if (!this.isGrounded) {
      this.armL.rotation.x = -1.1;
      this.armR.rotation.x = -1.1;
      this.legL.rotation.x = 0.45;
      this.legR.rotation.x = -0.3;
      this.torso.rotation.x = 0.1;
      return;
    }

    if (isMoving) {
      const swing = Math.sin(this.walkCycle);
      const amp = this.isSprinting ? 1.0 : 0.65;

      this.legL.rotation.x = swing * amp;
      this.legR.rotation.x = -swing * amp;
      this.armL.rotation.x = -swing * amp;
      this.armR.rotation.x = swing * amp;
      this.torso.rotation.x = this.isSprinting ? 0.22 : 0.05;
      this.head.position.y = 1.45 + Math.abs(Math.cos(this.walkCycle)) * 0.06;
    } else {
      const breathe = Math.sin(Date.now() * 0.003) * 0.03;
      this.legL.rotation.x = 0;
      this.legR.rotation.x = 0;
      this.armL.rotation.x = breathe;
      this.armR.rotation.x = -breathe;
      this.torso.rotation.x = 0;
      this.head.position.y = 1.45 + breathe * 0.5;
    }
  }

  updateCamera(camera, dt, input = null) {
    if (this.inVehicle) {
      const v = this.currentVehicle;
      const vPos = v.mesh.position;
      const vQuat = v.mesh.quaternion;

      const chaseOffset = new THREE.Vector3(0, 2.5, -7.5).applyQuaternion(vQuat);
      const targetCamPos = vPos.clone().add(chaseOffset);

      camera.position.lerp(targetCamPos, dt * 10);
      const lookTarget = vPos.clone().add(new THREE.Vector3(0, 1.2, 3.5).applyQuaternion(vQuat));
      camera.lookAt(lookTarget);
    } else {
      const isAiming = input && input.aim;
      const targetDist = isAiming ? 2.3 : this.cameraDistance;
      const shoulderOffset = isAiming ? 0.65 : 0.0;

      const pPos = new THREE.Vector3(
        this.body.position.x,
        this.body.position.y + 0.4,
        this.body.position.z
      );

      const rightVec = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraYaw);
      pPos.addScaledVector(rightVec, shoulderOffset);

      const dx = targetDist * Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch);
      const dz = targetDist * Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch);
      const dy = targetDist * Math.sin(this.cameraPitch);

      const targetCamPos = new THREE.Vector3(pPos.x + dx, pPos.y + dy, pPos.z + dz);
      camera.position.lerp(targetCamPos, dt * 20);
      camera.lookAt(pPos.x, pPos.y + (isAiming ? 0.75 : 0.5), pPos.z);
    }
  }

  applyDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0 && !this.isDead) {
      this.die();
    }
  }

  die() {
    this.isDead = true;
    if (this.inVehicle) {
      this.exitVehicle();
    }
    this.modelRoot.rotation.x = Math.PI / 2;
    this.modelRoot.position.y = 0.2;
  }

  respawn(spawnPos) {
    this.health = CONFIG.PLAYER.MAX_HEALTH;
    this.isDead = false;
    this.body.position.set(spawnPos.x, spawnPos.y + 0.9, spawnPos.z);
    this.body.velocity.set(0, 0, 0);
    this.modelRoot.rotation.x = 0;
    this.modelRoot.position.y = 0;
  }
}
