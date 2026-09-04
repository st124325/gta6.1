import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from './config.js';
import { Assets } from './assets.js';

export class Vehicle {
  constructor(scene, physics, sound, spec, initialPos, initialRot = 0, customColor = null) {
    this.scene = scene;
    this.physics = physics;
    this.sound = sound;
    this.spec = Object.assign({}, spec); // shallow copy so customColor doesn't mutate config
    if (customColor) {
      this.spec.color = customColor;
    }
    this.isDriven = false;

    // Driving state
    this.currentSpeed = 0;
    this.speedKmh = 0;
    this.steeringAngle = 0;
    this.targetSteering = 0;
    this.throttle = 0;
    this.braking = false;
    this.handbrake = false;
    this.nitro = false;
    this.nitroRemaining = 100;
    this.lightsOn = true;
    this.hornActive = false;
    this.driftSlip = 0;

    // Visual elements
    this.wheels = [];
    this.wheelRotation = 0;
    this.headlights = [];
    this.taillights = [];
    this.sirenLights = [];
    this.sirenTimer = 0;
    this.nitroParticles = [];

    // GLTF Ferrari parts
    this.ferrariLoaded = false;
    this.ferrariWheels = [];
    this.ferrariFrontWheels = [];
    this.steeringWheelMesh = null;

    // Body tilt anchor
    this.bodyMeshGroup = new THREE.Group();

    this.initPhysics(initialPos, initialRot);
    this.initVisuals();
  }

  initPhysics(pos, rot) {
    const halfWidth = 1.05;
    const halfHeight = 0.45;
    const halfLength = 2.25;

    const chassisShape = new CANNON.Box(new CANNON.Vec3(halfWidth, halfHeight, halfLength));
    this.body = new CANNON.Body({
      mass: this.spec.mass,
      material: this.physics.chassisMaterial,
      angularDamping: 0.4,
      linearDamping: 0.05
    });

    this.body.addShape(chassisShape, new CANNON.Vec3(0, 0, 0));
    this.body.position.set(pos.x, pos.y + 0.65, pos.z);
    this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rot);

    this.physics.world.addBody(this.body);

    this.wheelOffsets = [
      new THREE.Vector3(-0.95, -0.22, 1.35),
      new THREE.Vector3(0.95, -0.22, 1.35),
      new THREE.Vector3(-0.95, -0.22, -1.35),
      new THREE.Vector3(0.95, -0.22, -1.35)
    ];
  }

  initVisuals() {
    this.mesh = new THREE.Group();
    this.mesh.add(this.bodyMeshGroup);

    if (this.spec.type === 'super') {
      this.buildSupercar();
    } else if (this.spec.type === 'muscle') {
      this.buildMuscleCar();
    } else if (this.spec.type === 'offroad') {
      this.buildOffroad();
    } else {
      this.buildPoliceCar();
    }

    this.buildWheels();
    this.buildLights();
    this.buildNitroExhaust();

    this.scene.add(this.mesh);
  }

  buildSupercar() {
    // Placeholder while GLTF loads
    this.superPlaceholder = new THREE.Group();
    this.bodyMeshGroup.add(this.superPlaceholder);

    const primaryMat = new THREE.MeshStandardMaterial({
      color: this.spec.color,
      metalness: 0.85,
      roughness: 0.2,
    });

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x151515,
      roughness: 0.5,
      metalness: 0.8
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x111111,
      roughness: 0.1,
      transparent: true,
      opacity: 0.85
    });

    const bodyGeo = new THREE.BoxGeometry(2.1, 0.5, 4.6);
    const bodyMesh = new THREE.Mesh(bodyGeo, primaryMat);
    bodyMesh.position.y = 0.15;
    bodyMesh.castShadow = true;
    this.superPlaceholder.add(bodyMesh);

    const cabinGeo = new THREE.BoxGeometry(1.6, 0.45, 2.0);
    const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
    cabinMesh.position.set(0, 0.55, -0.2);
    cabinMesh.castShadow = true;
    this.superPlaceholder.add(cabinMesh);

    const spoilerGeo = new THREE.BoxGeometry(1.9, 0.08, 0.4);
    const spoiler = new THREE.Mesh(spoilerGeo, carbonMat);
    spoiler.position.set(0, 0.75, -2.1);
    this.superPlaceholder.add(spoiler);

    // Load Open Source Ferrari 458 Italia Model
    Assets.loadGLTF('./assets/ferrari.glb')
      .then((gltf) => {
        const carModel = gltf.scene.clone();
        carModel.rotation.y = Math.PI; // Face forward (+Z)
        carModel.position.set(0, -0.32, 0.1);

        carModel.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        const bodyPart = carModel.getObjectByName('body');
        if (bodyPart) {
          bodyPart.material = new THREE.MeshPhysicalMaterial({
            color: this.spec.color,
            metalness: 0.85,
            roughness: 0.18,
            clearcoat: 1.0,
            clearcoatRoughness: 0.08
          });
        }

        // Extract wheel nodes
        const wFL = carModel.getObjectByName('wheel_fl');
        const wFR = carModel.getObjectByName('wheel_fr');
        const wRL = carModel.getObjectByName('wheel_rl');
        const wRR = carModel.getObjectByName('wheel_rr');
        this.ferrariWheels = [wFL, wFR, wRL, wRR].filter(Boolean);
        this.ferrariFrontWheels = [wFL, wFR].filter(Boolean);
        this.steeringWheelMesh = carModel.getObjectByName('steering_wheel');

        // Hide placeholder and procedural wheels
        this.superPlaceholder.visible = false;
        this.wheels.forEach(w => w.group.visible = false);

        this.bodyMeshGroup.add(carModel);
        this.ferrariLoaded = true;
      })
      .catch(() => {
        console.log('Ferrari GLTF fallback active');
      });
  }

  buildMuscleCar() {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.spec.color,
      metalness: 0.7,
      roughness: 0.3
    });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.95, roughness: 0.1 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.6, 4.7), bodyMat);
    body.position.y = 0.2;
    body.castShadow = true;
    this.bodyMeshGroup.add(body);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.61, 4.72), stripeMat);
    stripe.position.y = 0.2;
    this.bodyMeshGroup.add(stripe);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.3), bodyMat);
    cabin.position.set(0, 0.65, -0.3);
    cabin.castShadow = true;
    this.bodyMeshGroup.add(cabin);

    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.9), chromeMat);
    scoop.position.set(0, 0.55, 1.2);
    this.bodyMeshGroup.add(scoop);

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.18, 0.2), chromeMat);
    bumper.position.set(0, 0.05, 2.38);
    this.bodyMeshGroup.add(bumper);
  }

  buildOffroad() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: this.spec.color, roughness: 0.7 });
    const rollCageMat = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, metalness: 0.8, roughness: 0.4 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 4.5), bodyMat);
    body.position.y = 0.3;
    body.castShadow = true;
    this.bodyMeshGroup.add(body);

    const cageBar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1), rollCageMat);
    cageBar1.position.set(-0.8, 1.0, 0.2);
    const cageBar2 = cageBar1.clone();
    cageBar2.position.set(0.8, 1.0, 0.2);
    const cageBar3 = cageBar1.clone();
    cageBar3.position.set(-0.8, 1.0, -1.2);
    const cageBar4 = cageBar1.clone();
    cageBar4.position.set(0.8, 1.0, -1.2);

    const cageTop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.5), rollCageMat);
    cageTop.position.set(0, 1.55, -0.5);

    this.bodyMeshGroup.add(cageBar1);
    this.bodyMeshGroup.add(cageBar2);
    this.bodyMeshGroup.add(cageBar3);
    this.bodyMeshGroup.add(cageBar4);
    this.bodyMeshGroup.add(cageTop);
  }

  buildPoliceCar() {
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.6, 4.7), blackMat);
    body.position.y = 0.2;
    body.castShadow = true;
    this.bodyMeshGroup.add(body);

    const doorL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 1.8), whiteMat);
    doorL.position.set(-1.06, 0.2, 0);
    const doorR = doorL.clone();
    doorR.position.x = 1.06;
    this.bodyMeshGroup.add(doorL);
    this.bodyMeshGroup.add(doorR);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.4), whiteMat);
    roof.position.set(0, 0.65, -0.2);
    this.bodyMeshGroup.add(roof);

    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.14, 0.3), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    bar.position.set(0, 0.95, -0.2);
    this.bodyMeshGroup.add(bar);

    const redLight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.28), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    redLight.position.set(-0.35, 0.95, -0.2);
    const blueLight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.28), new THREE.MeshBasicMaterial({ color: 0x0044ff }));
    blueLight.position.set(0.35, 0.95, -0.2);

    this.bodyMeshGroup.add(redLight);
    this.bodyMeshGroup.add(blueLight);
    this.sirenLights = [redLight, blueLight];
  }

  buildWheels() {
    const isOffroad = this.spec.type === 'offroad';
    const radius = isOffroad ? 0.48 : 0.40;
    const width = isOffroad ? 0.36 : 0.30;

    for (let i = 0; i < 4; i++) {
      const wGroup = new THREE.Group();
      const wheelMesh = this.createWheelMesh(radius, width);
      wGroup.add(wheelMesh);
      wGroup.position.copy(this.wheelOffsets[i]);
      this.mesh.add(wGroup);
      this.wheels.push({ group: wGroup, mesh: wheelMesh, isFront: i < 2 });
    }
  }

  createWheelMesh(radius, width) {
    const group = new THREE.Group();
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 16);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    group.add(tire);

    const rimGeo = new THREE.CylinderGeometry(radius * 0.65, radius * 0.65, width * 1.02, 12);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    group.add(rim);

    return group;
  }

  buildLights() {
    const hMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.1), hMat);
    hl1.position.set(-0.75, 0.25, 2.3);
    const hl2 = hl1.clone();
    hl2.position.x = 0.75;
    this.bodyMeshGroup.add(hl1);
    this.bodyMeshGroup.add(hl2);

    const spotL = new THREE.SpotLight(0xfff7e6, 2.5, 45, Math.PI / 6, 0.35);
    spotL.position.set(-0.75, 0.3, 2.3);
    const targetL = new THREE.Object3D();
    targetL.position.set(-0.75, 0, 30);
    this.bodyMeshGroup.add(spotL);
    this.bodyMeshGroup.add(targetL);
    spotL.target = targetL;

    const spotR = new THREE.SpotLight(0xfff7e6, 2.5, 45, Math.PI / 6, 0.35);
    spotR.position.set(0.75, 0.3, 2.3);
    const targetR = new THREE.Object3D();
    targetR.position.set(0.75, 0, 30);
    this.bodyMeshGroup.add(spotR);
    this.bodyMeshGroup.add(targetR);
    spotR.target = targetR;

    this.headlights = [spotL, spotR];

    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff1111 });
    const tl1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.05), tailMat);
    tl1.position.set(-0.75, 0.25, -2.31);
    const tl2 = tl1.clone();
    tl2.position.x = 0.75;
    this.bodyMeshGroup.add(tl1);
    this.bodyMeshGroup.add(tl2);
    this.taillights = [tl1, tl2];
  }

  buildNitroExhaust() {
    const flameGeo = new THREE.ConeGeometry(0.12, 0.7, 8);
    flameGeo.rotateX(-Math.PI / 2);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0x00d0ff, transparent: true, opacity: 0 });

    const f1 = new THREE.Mesh(flameGeo, flameMat);
    f1.position.set(-0.4, 0.1, -2.6);
    const f2 = f1.clone();
    f2.position.x = 0.4;

    this.bodyMeshGroup.add(f1);
    this.bodyMeshGroup.add(f2);
    this.nitroParticles = [f1, f2];
  }

  toggleLights() {
    this.lightsOn = !this.lightsOn;
    this.headlights.forEach(l => l.intensity = this.lightsOn ? 2.5 : 0);
  }

  resetUpright() {
    const pos = this.body.position;
    this.body.position.set(pos.x, Math.max(pos.y, 0.8) + 1.2, pos.z);
    
    const euler = new THREE.Euler();
    euler.setFromQuaternion(new THREE.Quaternion(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    ), 'YXZ');
    
    this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), euler.y);
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.currentSpeed = 0;
  }

  update(dt, input) {
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.mesh.quaternion);

    if (this.sirenLights.length > 0) {
      this.sirenTimer += dt * 8;
      const flash = Math.sin(this.sirenTimer) > 0;
      this.sirenLights[0].material.color.setHex(flash ? 0xff0000 : 0x330000);
      this.sirenLights[1].material.color.setHex(!flash ? 0x0044ff : 0x000833);
    }

    if (!this.isDriven) {
      this.currentSpeed *= 0.94;
      this.body.velocity.x = forward.x * this.currentSpeed;
      this.body.velocity.z = forward.z * this.currentSpeed;
      this.sound.stopEngine();
      return;
    }

    // Input processing
    this.throttle = 0;
    if (input.forward) this.throttle += 1;
    if (input.backward) this.throttle -= 1;

    this.targetSteering = 0;
    if (input.left) this.targetSteering += this.spec.steer;
    if (input.right) this.targetSteering -= this.spec.steer;

    const speedRatio = Math.min(1.0, Math.abs(this.currentSpeed) / 35);
    const maxSteerAngle = this.targetSteering * (1.0 - speedRatio * 0.45);
    this.steeringAngle += (maxSteerAngle - this.steeringAngle) * dt * 9;

    this.handbrake = input.handbrake;
    this.nitro = input.nitro && this.nitroRemaining > 0 && this.throttle > 0;

    if (this.nitro) {
      this.nitroRemaining = Math.max(0, this.nitroRemaining - dt * 25);
    } else {
      this.nitroRemaining = Math.min(100, this.nitroRemaining + dt * 15);
    }

    this.nitroParticles.forEach(f => {
      f.material.opacity = this.nitro ? 0.95 : 0;
      if (this.nitro) {
        f.scale.set(1 + Math.random() * 0.4, 1 + Math.random() * 0.8, 1);
      }
    });

    let targetSpeed = 0;
    let accelRate = this.spec.accel;

    if (this.throttle > 0) {
      targetSpeed = this.spec.maxSpeed;
      if (this.nitro) {
        targetSpeed *= this.spec.nitro;
        accelRate *= 1.8;
      }
    } else if (this.throttle < 0) {
      if (this.currentSpeed > 1.5) {
        this.braking = true;
        accelRate = this.spec.brake;
        targetSpeed = 0;
      } else {
        this.braking = false;
        targetSpeed = -this.spec.reverseSpeed;
        accelRate = this.spec.accel * 0.6;
      }
    } else {
      this.braking = false;
      targetSpeed = 0;
      accelRate = this.handbrake ? 30 : 6;
    }

    if (this.currentSpeed < targetSpeed) {
      this.currentSpeed = Math.min(targetSpeed, this.currentSpeed + accelRate * dt);
    } else if (this.currentSpeed > targetSpeed) {
      this.currentSpeed = Math.max(targetSpeed, this.currentSpeed - accelRate * dt);
    }

    this.speed = Math.abs(this.currentSpeed);
    this.speedKmh = Math.round(this.currentSpeed * 3.6);

    const isBrakingOrRev = this.braking || (this.throttle < 0 && this.currentSpeed <= 0);
    this.taillights.forEach(t => {
      t.material.color.setHex(isBrakingOrRev ? 0xff2222 : 0x770000);
    });

    const isGrounded = this.body.position.y < 1.8;

    if (isGrounded) {
      if (this.body.position.y < 0.45) {
        this.body.position.y = 0.45;
        if (this.body.velocity.y < 0) this.body.velocity.y = 0;
      }

      if (this.handbrake && Math.abs(this.currentSpeed) > 5) {
        this.driftSlip = (this.steeringAngle * this.currentSpeed) * 0.45;
        this.sound.updateTireScreech(Math.min(1.0, Math.abs(this.driftSlip) / 6));
      } else {
        this.driftSlip = 0;
        this.sound.updateTireScreech(0);
      }

      this.body.velocity.x = forward.x * this.currentSpeed + right.x * this.driftSlip;
      this.body.velocity.z = forward.z * this.currentSpeed + right.z * this.driftSlip;

      if (Math.abs(this.currentSpeed) > 0.3) {
        const steerDir = this.currentSpeed > 0 ? 1 : -1;
        const driftFactor = this.handbrake ? 2.5 : 1.4;
        this.body.angularVelocity.y = this.steeringAngle * steerDir * driftFactor;
      } else {
        this.body.angularVelocity.y = 0;
      }

      this.body.angularVelocity.x *= 0.85;
      this.body.angularVelocity.z *= 0.85;
    } else {
      this.sound.updateTireScreech(0);

      // Mid-air stunt flip controls
      if (input.forward) this.body.angularVelocity.x = -1.2;
      if (input.backward) this.body.angularVelocity.x = 1.2;
      if (input.left) this.body.angularVelocity.z = 1.2;
      if (input.right) this.body.angularVelocity.z = -1.2;
    }

    const accelPitch = (this.throttle > 0 ? -0.04 : 0) + (this.braking ? 0.07 : 0);
    const turnRoll = -this.steeringAngle * Math.min(1, Math.abs(this.currentSpeed) / 25) * 0.12;
    this.bodyMeshGroup.rotation.x = accelPitch;
    this.bodyMeshGroup.rotation.z = turnRoll;

    // Rotate wheels
    this.wheelRotation += (this.currentSpeed * dt) / 0.40;

    // Ferrari GLTF wheels and steering
    if (this.ferrariLoaded) {
      for (const fw of this.ferrariWheels) {
        fw.rotation.x = -Math.PI / 2 + this.wheelRotation;
      }
      if (this.steeringWheelMesh) {
        this.steeringWheelMesh.rotation.z = this.steeringAngle * 2.5;
      }
    } else {
      for (const w of this.wheels) {
        w.mesh.rotation.x = this.wheelRotation;
        if (w.isFront) {
          w.group.rotation.y = this.steeringAngle;
        }
      }
    }

    this.sound.updateEngine(this.speedKmh, this.throttle, this.nitro);

    if (input.horn !== this.hornActive) {
      this.hornActive = input.horn;
      this.sound.setHorn(this.hornActive);
    }
  }
}
