import * as CANNON from 'cannon-es';
import { CONFIG } from './config.js';

export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, CONFIG.GRAVITY, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.defaultContactMaterial.friction = 0.4;
    this.world.defaultContactMaterial.restitution = 0.1;

    // Contact Materials
    this.groundMaterial = new CANNON.Material('ground');
    this.wheelMaterial = new CANNON.Material('wheel');
    this.chassisMaterial = new CANNON.Material('chassis');
    this.playerMaterial = new CANNON.Material('player');
    this.obstacleMaterial = new CANNON.Material('obstacle');

    // Wheel - Ground contact
    const wheelGroundContact = new CANNON.ContactMaterial(
      this.wheelMaterial,
      this.groundMaterial,
      {
        friction: 0.95,
        restitution: 0.05,
        contactEquationStiffness: 1000,
      }
    );
    this.world.addContactMaterial(wheelGroundContact);

    // Chassis - Ground contact
    const chassisGroundContact = new CANNON.ContactMaterial(
      this.chassisMaterial,
      this.groundMaterial,
      {
        friction: 0.3,
        restitution: 0.2,
      }
    );
    this.world.addContactMaterial(chassisGroundContact);

    // Player - Ground contact
    const playerGroundContact = new CANNON.ContactMaterial(
      this.playerMaterial,
      this.groundMaterial,
      {
        friction: 0.1,
        restitution: 0.0,
      }
    );
    this.world.addContactMaterial(playerGroundContact);

    // Create primary ground plane
    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
      material: this.groundMaterial,
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(groundBody);
    this.groundBody = groundBody;

    // Rigid bodies to update
    this.syncList = [];
  }

  registerSync(mesh, body, offset = null) {
    this.syncList.push({ mesh, body, offset });
  }

  unregisterSync(body) {
    this.syncList = this.syncList.filter(item => item.body !== body);
  }

  step(dt) {
    // Clamp delta time to avoid large physics tunnels
    const clampedDt = Math.min(dt, 0.05);
    this.world.step(1 / 60, clampedDt, 4);

    // Sync meshes to bodies
    for (let i = 0; i < this.syncList.length; i++) {
      const { mesh, body, offset } = this.syncList[i];
      if (offset) {
        mesh.position.copy(body.position).add(offset);
      } else {
        mesh.position.copy(body.position);
      }
      mesh.quaternion.copy(body.quaternion);
    }
  }
}
