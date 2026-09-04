import * as THREE from 'three';
import { CONFIG } from './config.js';
import { PhysicsWorld } from './physics.js';
import { SoundSystem } from './audio.js';
import { CityBuilder } from './city.js';
import { Player } from './player.js';
import { TrafficManager } from './traffic.js';
import { WeaponSystem } from './weapons.js';
import { Minimap } from './minimap.js';
import { UIManager } from './ui.js';

class Game {
  constructor() {
    this.container = document.getElementById('game-container');
    this.clock = new THREE.Clock();

    // Input state
    this.input = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      nitro: false,
      handbrake: false,
      horn: false,
      aim: false,
      fire: false
    };

    this.camMode = 0;
    this.timeOfDay = 0;

    this.initThree();
    this.initSystems();
    this.initInputs();
    this.initLighting();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x78b0e8);
    this.scene.fog = new THREE.FogExp2(0x78b0e8, 0.0035);

    this.camera = new THREE.PerspectiveCamera(
      68,
      window.innerWidth / window.innerHeight,
      0.2,
      1000
    );
    this.camera.position.set(0, 5, 10);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  initLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff3d6, 1.6);
    this.sunLight.position.set(120, 180, 80);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 400;
    const d = 120;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;

    this.scene.add(this.sunLight);
    this.sunLightTarget = new THREE.Object3D();
    this.scene.add(this.sunLightTarget);
    this.sunLight.target = this.sunLightTarget;

    this.hemiLight = new THREE.HemisphereLight(0x78b0e8, 0x2b332d, 0.6);
    this.scene.add(this.hemiLight);
  }

  setTimeOfDay(mode) {
    this.timeOfDay = mode % 3;
    if (this.timeOfDay === 0) {
      this.scene.background.setHex(0x78b0e8);
      this.scene.fog.color.setHex(0x78b0e8);
      this.ambientLight.intensity = 0.75;
      this.sunLight.color.setHex(0xfff3d6);
      this.sunLight.intensity = 1.6;
      this.sunLight.position.set(120, 180, 80);
    } else if (this.timeOfDay === 1) {
      this.scene.background.setHex(0xd65b32);
      this.scene.fog.color.setHex(0xd65b32);
      this.ambientLight.intensity = 0.5;
      this.sunLight.color.setHex(0xff7b25);
      this.sunLight.intensity = 1.8;
      this.sunLight.position.set(220, 40, 60);
    } else {
      this.scene.background.setHex(0x060911);
      this.scene.fog.color.setHex(0x060911);
      this.ambientLight.intensity = 0.22;
      this.sunLight.color.setHex(0x384c75);
      this.sunLight.intensity = 0.4;
      this.sunLight.position.set(-80, 140, -60);
    }
  }

  initSystems() {
    this.physics = new PhysicsWorld();
    this.sound = new SoundSystem();
    this.ui = new UIManager();
    this.minimap = new Minimap(document.getElementById('radar-canvas'));

    this.city = new CityBuilder(this.scene, this.physics);
    this.city.createCity();

    this.player = new Player(this.scene, this.physics, this.sound, { x: 0, y: 1.0, z: 0 });
    this.traffic = new TrafficManager(this.scene, this.physics, this.sound, this.city);
    this.weapons = new WeaponSystem(this.scene, this.physics, this.sound, this.camera);
  }

  initInputs() {
    window.addEventListener('keydown', (e) => {
      this.sound.init();
      this.handleKey(e.code, true);
    });

    window.addEventListener('keyup', (e) => {
      this.handleKey(e.code, false);
    });

    let isMouseDown = false;
    window.addEventListener('mousedown', (e) => {
      this.sound.init();
      isMouseDown = true;

      if (e.button === 0) {
        // Left click = Fire / Punch
        if (!this.player.inVehicle) {
          this.input.fire = true;
          this.weapons.shoot(this.player, this.traffic);
        }
      } else if (e.button === 2) {
        // Right click = Aim down sights
        if (!this.player.inVehicle) {
          this.input.aim = true;
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      isMouseDown = false;
      if (e.button === 0) this.input.fire = false;
      if (e.button === 2) this.input.aim = false;
    });

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    window.addEventListener('click', () => {
      this.sound.init();
      if (document.pointerLockElement !== this.renderer.domElement) {
        try {
          this.renderer.domElement.requestPointerLock();
        } catch (e) {}
      }
    });

    document.addEventListener('pointerlockchange', () => {
      const hint = document.getElementById('click-hint');
      if (hint) {
        hint.style.display = (document.pointerLockElement === this.renderer.domElement) ? 'none' : 'block';
      }
    });

    document.addEventListener('mousemove', (e) => {
      const isLocked = document.pointerLockElement === this.renderer.domElement;
      if (isLocked || isMouseDown) {
        const sensitivity = 0.0028;
        this.player.cameraYaw -= e.movementX * sensitivity;
        this.player.cameraPitch = Math.max(
          -0.15,
          Math.min(1.2, this.player.cameraPitch + e.movementY * sensitivity)
        );
      }
    });

    window.addEventListener('wheel', (e) => {
      if (this.input.aim) return;
      this.player.cameraDistance = Math.max(3.0, Math.min(12.0, this.player.cameraDistance + e.deltaY * 0.005));
    });
  }

  handleKey(code, isDown) {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.input.forward = isDown;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.input.backward = isDown;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.input.left = isDown;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.input.right = isDown;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.input.nitro = isDown;
        break;
      case 'Space':
        this.input.handbrake = isDown;
        break;
      case 'KeyH':
        this.input.horn = isDown;
        break;
      case 'KeyF':
      case 'KeyE':
        if (isDown) this.toggleVehicleEntry();
        break;
      case 'KeyR':
        if (isDown) {
          if (this.player.inVehicle) {
            this.player.currentVehicle.resetUpright();
          } else {
            this.weapons.reload();
          }
        }
        break;
      case 'Digit1':
        if (isDown) this.weapons.selectWeapon('FISTS');
        break;
      case 'Digit2':
        if (isDown) this.weapons.selectWeapon('PISTOL');
        break;
      case 'Digit3':
        if (isDown) this.weapons.selectWeapon('RIFLE');
        break;
      case 'KeyL':
        if (isDown && this.player.inVehicle) {
          this.player.currentVehicle.toggleLights();
        }
        break;
      case 'KeyQ':
        if (isDown) {
          const station = this.sound.cycleRadio();
          this.ui.showRadioChange(station);
        }
        break;
      case 'KeyC':
        if (isDown) {
          this.cycleCameraMode();
        }
        break;
      case 'KeyT':
        if (isDown) {
          this.setTimeOfDay(this.timeOfDay + 1);
        }
        break;
    }
  }

  cycleCameraMode() {
    this.camMode = (this.camMode + 1) % 3;
    if (this.camMode === 0) {
      this.player.cameraDistance = 5.0;
    } else if (this.camMode === 1) {
      this.player.cameraDistance = 8.5;
    } else {
      this.player.cameraDistance = 3.2;
    }
  }

  toggleVehicleEntry() {
    if (this.player.inVehicle) {
      this.player.exitVehicle();
    } else {
      const pPos = this.player.mesh.position;
      let nearest = null;
      let minDist = 5.5;

      for (const v of this.traffic.vehicles) {
        const dist = v.mesh.position.distanceTo(pPos);
        if (dist < minDist) {
          minDist = dist;
          nearest = v;
        }
      }

      if (nearest) {
        this.player.enterVehicle(nearest);
      }
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.1);

    // 1. Physics Step
    this.physics.step(dt);

    // 2. Continuous weapon fire for automatic rifle
    if (!this.player.inVehicle && this.input.fire && this.weapons.currentWeapon.id === 'rifle') {
      this.weapons.shoot(this.player, this.traffic);
    }

    // 3. Update Entities
    if (this.player.inVehicle) {
      const activeCar = this.player.currentVehicle;
      activeCar.update(dt, this.input);
      this.player.update(dt, this.input, this.camera);
      this.ui.updateSpeedometer(activeCar);
      this.ui.showPrompt('[F] ВЫЙТИ ИЗ МАШИНЫ');
    } else {
      this.player.update(dt, this.input, this.camera);
      this.ui.updateSpeedometer(null);

      const pPos = this.player.mesh.position;
      let nearCar = null;
      for (const v of this.traffic.vehicles) {
        if (v.mesh.position.distanceTo(pPos) < 5.5) {
          nearCar = v;
          break;
        }
      }

      if (nearCar) {
        this.ui.showPrompt(`[F] СЕСТЬ В МАШИНУ: ${nearCar.spec.name}`);
      } else {
        this.ui.showPrompt(null);
      }
    }

    // 4. Update Weapons
    this.weapons.update(dt, this.player);

    // 5. Update Traffic
    const activeCar = this.player.inVehicle ? this.player.currentVehicle : null;
    this.traffic.update(dt, this.player.mesh.position, activeCar);

    // 6. Camera & Lighting
    this.player.updateCamera(this.camera, dt, this.input);

    const focusPos = this.player.inVehicle ? this.player.currentVehicle.mesh.position : this.player.mesh.position;
    this.sunLight.position.set(focusPos.x + 100, 160, focusPos.z + 70);
    this.sunLightTarget.position.copy(focusPos);

    // 7. Update UI & Minimap
    this.minimap.render(this.player, this.traffic, this.city);
    this.ui.updateWantedStars(this.traffic.wantedLevel);
    this.ui.updateWeapon(this.weapons.currentWeapon, this.weapons.ammo[this.weapons.currentWeapon.id], this.player.inVehicle);
    this.ui.setAiming(this.input.aim);

    // 8. Render
    this.renderer.render(this.scene, this.camera);
  }
}


window.addEventListener('DOMContentLoaded', () => {
  try {
    window.game = new Game();
  } catch (err) {
    console.error('Game init error:', err);
    document.body.innerHTML += `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:#c0392b;color:#fff;padding:20px;border-radius:8px;font-size:14px;z-index:9999;max-width:80%">
      <b>❌ Game Error:</b><br>${err.message}<br><pre style="font-size:11px;margin-top:8px">${err.stack}</pre></div>`;
  }
});
