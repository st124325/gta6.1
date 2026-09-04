import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from './config.js?v=3';

export class CityBuilder {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    this.colliders = [];
    this.carSpawnPoints = [];
    this.stuntRamps = [];
    this.destructibles = [];
    this.waterHydrants = [];
    this._CAR_MIN_DIST = 14.0; // minimum metres between any two car spawns

    this.initTextures();
  }

  // Add a car spawn, skipping if too close to an existing one or cap reached
  addCarSpawn(x, y, z, rot, type) {
    if (this.carSpawnPoints.length >= 30) return false; // hard cap – more = browser freeze
    for (const sp of this.carSpawnPoints) {
      const dx = sp.x - x;
      const dz = sp.z - z;
      if (Math.sqrt(dx * dx + dz * dz) < this._CAR_MIN_DIST) return false;
    }
    this.carSpawnPoints.push({ x, y, z, rot, type });
    return true;
  }

  initTextures() {
    // 1. Asphalt Road Texture with double yellow center lines and white dashed lane markings
    const roadCanvas = document.createElement('canvas');
    roadCanvas.width = 512;
    roadCanvas.height = 512;
    const rCtx = roadCanvas.getContext('2d');
    
    // Base asphalt with subtle grain
    rCtx.fillStyle = '#1c1e22';
    rCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4000; i++) {
      rCtx.fillStyle = Math.random() > 0.5 ? '#24272d' : '#141618';
      rCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    // Double yellow center divider
    rCtx.fillStyle = '#f5b018';
    rCtx.fillRect(252, 0, 3, 512);
    rCtx.fillRect(257, 0, 3, 512);

    // White outer road shoulder lines
    rCtx.fillStyle = '#e8edf0';
    rCtx.fillRect(24, 0, 4, 512);
    rCtx.fillRect(484, 0, 4, 512);

    // White dashed lane markers
    rCtx.fillStyle = '#dbe1e6';
    for (let y = 10; y < 512; y += 45) {
      rCtx.fillRect(138, y, 3, 25);
      rCtx.fillRect(370, y, 3, 25);
    }

    this.roadTexture = new THREE.CanvasTexture(roadCanvas);
    this.roadTexture.wrapS = THREE.RepeatWrapping;
    this.roadTexture.wrapT = THREE.RepeatWrapping;

    // 2. Concrete Sidewalk Texture with slabs and curb
    const walkCanvas = document.createElement('canvas');
    walkCanvas.width = 256;
    walkCanvas.height = 256;
    const wCtx = walkCanvas.getContext('2d');
    wCtx.fillStyle = '#787c82';
    wCtx.fillRect(0, 0, 256, 256);
    // Concrete slabs lines
    wCtx.strokeStyle = '#5c6066';
    wCtx.lineWidth = 3;
    wCtx.strokeRect(4, 4, 248, 248);
    wCtx.beginPath();
    wCtx.moveTo(128, 0); wCtx.lineTo(128, 256);
    wCtx.moveTo(0, 128); wCtx.lineTo(256, 128);
    wCtx.stroke();
    for (let i = 0; i < 2000; i++) {
      wCtx.fillStyle = Math.random() > 0.5 ? '#8b9096' : '#696c72';
      wCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    this.sidewalkTexture = new THREE.CanvasTexture(walkCanvas);
    this.sidewalkTexture.wrapS = THREE.RepeatWrapping;
    this.sidewalkTexture.wrapT = THREE.RepeatWrapping;

    // 3. Skyscraper Windows Texture
    const winCanvas = document.createElement('canvas');
    winCanvas.width = 256;
    winCanvas.height = 256;
    const wnCtx = winCanvas.getContext('2d');
    wnCtx.fillStyle = '#161d24';
    wnCtx.fillRect(0, 0, 256, 256);
    for (let x = 16; x < 256; x += 32) {
      for (let y = 16; y < 256; y += 32) {
        // Randomly illuminated windows (warm yellow or cool cyan)
        const rand = Math.random();
        if (rand > 0.6) {
          wnCtx.fillStyle = rand > 0.85 ? '#ffd270' : '#88d8f7';
        } else {
          wnCtx.fillStyle = '#222d38';
        }
        wnCtx.fillRect(x, y, 18, 16);
      }
    }
    this.windowTexture = new THREE.CanvasTexture(winCanvas);
    this.windowTexture.wrapS = THREE.RepeatWrapping;
    this.windowTexture.wrapT = THREE.RepeatWrapping;
  }

  createCity() {
    const size = CONFIG.CITY_SIZE;
    const blockSize = CONFIG.BLOCK_SIZE;
    const roadW = CONFIG.ROAD_WIDTH;
    const walkW = CONFIG.SIDEWALK_WIDTH;

    // Ground plane base
    const groundGeo = new THREE.PlaneGeometry(size + 200, size + 200);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2b332d,
      roughness: 0.9,
      metalness: 0.1
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    // City grid calculations
    const half = size / 2;
    const numBlocks = Math.floor(size / blockSize);

    // Build Roads Network
    for (let i = -numBlocks / 2; i <= numBlocks / 2; i++) {
      const coord = i * blockSize;
      
      // Horizontal Road
      const hRoadGeo = new THREE.PlaneGeometry(size, roadW);
      const hRoadMat = new THREE.MeshStandardMaterial({
        map: this.roadTexture,
        roughness: 0.8,
        metalness: 0.15
      });
      const hRoad = new THREE.Mesh(hRoadGeo, hRoadMat);
      hRoad.rotation.x = -Math.PI / 2;
      hRoad.position.set(0, 0.05, coord);
      hRoad.receiveShadow = true;
      this.scene.add(hRoad);

      // Vertical Road
      const vRoadGeo = new THREE.PlaneGeometry(roadW, size);
      const vRoadMat = new THREE.MeshStandardMaterial({
        map: this.roadTexture,
        roughness: 0.8,
        metalness: 0.15
      });
      const vRoad = new THREE.Mesh(vRoadGeo, vRoadMat);
      vRoad.rotation.x = -Math.PI / 2;
      vRoad.position.set(coord, 0.06, 0);
      vRoad.receiveShadow = true;
      this.scene.add(vRoad);
    }

    // Build Blocks, Sidewalks, Buildings & City Features
    const storeSigns = [
      { text: 'MAZE BANK', bg: '#c72424', color: '#fff' },
      { text: 'LOS SANTOS CUSTOMS', bg: '#171717', color: '#ffb703' },
      { text: 'BURGER SHOT', bg: '#e63946', color: '#ffbe0b' },
      { text: 'AMMU-NATION', bg: '#2b2d42', color: '#ef233c' },
      { text: '24/7 STORE', bg: '#0077b6', color: '#90e0ef' },
      { text: 'PAY N SPRAY', bg: '#38b000', color: '#ffff3f' },
      { text: 'FLEECE BANK', bg: '#03045e', color: '#00b4d8' },
      { text: 'CLUCKIN BELL', bg: '#d90429', color: '#ffd60a' }
    ];
    let signIdx = 0;

    for (let x = -numBlocks / 2; x < numBlocks / 2; x++) {
      for (let z = -numBlocks / 2; z < numBlocks / 2; z++) {
        const cx = x * blockSize + blockSize / 2;
        const cz = z * blockSize + blockSize / 2;

        // Skip central plaza for open driving / stunts
        if (Math.abs(cx) < blockSize && Math.abs(cz) < blockSize) {
          this.buildCentralPlaza(cx, cz, blockSize - roadW);
          continue;
        }

        // Sidewalk pad for block (flush with ground)
        const lotSize = blockSize - roadW;
        const padGeo = new THREE.PlaneGeometry(lotSize, lotSize);
        this.sidewalkTexture.repeat.set(lotSize / 4, lotSize / 4);
        const padMat = new THREE.MeshStandardMaterial({
          map: this.sidewalkTexture,
          roughness: 0.7,
        });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(cx, 0.015, cz);
        pad.receiveShadow = true;
        this.scene.add(pad);

        // Add palm trees along sidewalk perimeter
        this.addStreetTrees(cx, cz, lotSize);

        // Decide block type: Skyscrapers, Medium Stores, or Parking Lot with Stunt Ramp
        const seed = Math.abs(Math.sin(x * 12.9898 + z * 78.233));
        
        if (seed < 0.25) {
          // Parking Lot with Spawning Drivable Cars and Mini Ramps
          this.buildParkingLot(cx, cz, lotSize);
        } else {
          // Buildings (Towers or Storefronts)
          const sign = storeSigns[signIdx % storeSigns.length];
          signIdx++;
          this.buildBuildingComplex(cx, cz, lotSize, seed, sign);
        }
      }
    }

    // Add Stunt Mega Ramps and Speed Loops
    this.buildMegaStuntPark();

    // Add Street Lights and Destructible Props
    this.addStreetProps();

    // Scatter additional street-parked cars across every city block road-edge
    this.addStreetCars();
  }

  buildCentralPlaza(cx, cz, size) {
    // Grand Plaza in city center: flush with ground
    const plazaGeo = new THREE.CircleGeometry(size / 1.5, 32);
    const plazaMat = new THREE.MeshStandardMaterial({
      color: 0xd8dcd6,
      roughness: 0.6
    });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(cx, 0.02, cz);
    plaza.receiveShadow = true;
    this.scene.add(plaza);

    // Center fountain / monument with water
    const fBaseGeo = new THREE.CylinderGeometry(10, 12, 1.5, 24);
    const fBaseMat = new THREE.MeshStandardMaterial({ color: 0x4a4e54 });
    const fBase = new THREE.Mesh(fBaseGeo, fBaseMat);
    fBase.position.set(cx, 1.0, cz);
    fBase.castShadow = true;
    this.scene.add(fBase);

    const fWaterGeo = new THREE.CylinderGeometry(9.2, 9.2, 0.2, 24);
    const fWaterMat = new THREE.MeshStandardMaterial({
      color: 0x0099ff,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.85
    });
    const fWater = new THREE.Mesh(fWaterGeo, fWaterMat);
    fWater.position.set(cx, 1.8, cz);
    this.scene.add(fWater);

    // Monument physics body
    const fBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Cylinder(10, 12, 1.5, 16),
      material: this.physics.obstacleMaterial
    });
    fBody.position.set(cx, 1.0, cz);
    this.physics.world.addBody(fBody);

    // Stunt Jump Ramp right off the plaza edge!
    this.createStuntRamp(cx + 25, 0, cz, 12, 4.5, 18, Math.PI / 2);
    this.createStuntRamp(cx - 25, 0, cz, 12, 4.5, 18, -Math.PI / 2);

    // Parked cars in the plaza
    this.addCarSpawn(cx + 18, 0.5, cz - 12, 0, 'SUPER');
    this.addCarSpawn(cx - 18, 0.5, cz + 12, Math.PI, 'MUSCLE');
    this.addCarSpawn(cx + 18, 0.5, cz + 12, Math.PI / 2, 'OFFROAD');
    this.addCarSpawn(cx - 18, 0.5, cz - 12, -Math.PI / 2, 'SUPER');
  }

  buildParkingLot(cx, cz, size) {
    // Ground parking lines (dark asphalt pad)
    const lCanvas = document.createElement('canvas');
    lCanvas.width = 256; lCanvas.height = 256;
    const lCtx = lCanvas.getContext('2d');
    lCtx.fillStyle = '#262b30';
    lCtx.fillRect(0, 0, 256, 256);
    lCtx.strokeStyle = 'rgba(255,255,255,0.4)';
    lCtx.lineWidth = 4;
    for (let i = 0; i <= 4; i++) {
      const xi = i * 64;
      lCtx.beginPath(); lCtx.moveTo(xi, 0); lCtx.lineTo(xi, 256); lCtx.stroke();
    }
    const lineTex = new THREE.CanvasTexture(lCanvas);
    lineTex.wrapS = lineTex.wrapT = THREE.RepeatWrapping;
    lineTex.repeat.set(4, 4);

    const lotGeo = new THREE.PlaneGeometry(size - 4, size - 4);
    const lotMat = new THREE.MeshStandardMaterial({ color: 0x262b30, roughness: 0.9, map: lineTex });
    const lot = new THREE.Mesh(lotGeo, lotMat);
    lot.rotation.x = -Math.PI / 2;
    lot.position.set(cx, 0.38, cz);
    this.scene.add(lot);

    // Add parked drivable cars – 4 slots per lot using distance-checked helper
    const types = ['SUPER', 'MUSCLE', 'OFFROAD', 'POLICE'];
    const half = size / 4;
    const slots = [
      { dx: -half, dz: -half, rot: 0 },
      { dx:  half, dz: -half, rot: 0 },
      { dx: -half, dz:  half, rot: Math.PI },
      { dx:  half, dz:  half, rot: Math.PI },
    ];
    for (let i = 0; i < slots.length; i++) {
      const t = types[Math.floor(Math.random() * types.length)];
      this.addCarSpawn(cx + slots[i].dx, 0.5, cz + slots[i].dz, slots[i].rot, t);
    }

    // Fun launch ramp in the parking lot!
    this.createStuntRamp(cx, 0, cz + half * 0.5, 10, 3.8, 14, 0);

    // Traffic cones around
    for (let c = 0; c < 5; c++) {
      this.createTrafficCone(cx - 10 + c * 5, 0.4, cz - (size / 2) + 4);
    }
  }

  buildBuildingComplex(cx, cz, lotSize, seed, sign) {
    // Building dimensions
    const isSkyscraper = seed > 0.65;
    const height = isSkyscraper ? 50 + seed * 60 : 18 + seed * 25;
    const width = lotSize - 8;
    const depth = lotSize - 8;

    // Building mesh
    const bGeo = new THREE.BoxGeometry(width, height, depth);
    this.windowTexture.repeat.set(width / 12, height / 10);
    
    // Choose style
    const colors = [0x2c3e50, 0x34495e, 0x1f242d, 0x4a5568, 0x2d3748];
    const bColor = colors[Math.floor(seed * colors.length) % colors.length];

    const bMat = new THREE.MeshStandardMaterial({
      color: bColor,
      map: this.windowTexture,
      roughness: 0.35,
      metalness: 0.45
    });

    const building = new THREE.Mesh(bGeo, bMat);
    building.position.set(cx, height / 2 + 0.3, cz);
    building.castShadow = true;
    building.receiveShadow = true;
    this.scene.add(building);

    // Physics static collider for building
    const bShape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
    const bBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: bShape,
      material: this.physics.obstacleMaterial
    });
    bBody.position.set(cx, height / 2 + 0.3, cz);
    this.physics.world.addBody(bBody);
    this.colliders.push(bBody);

    // Rooftop AC units / Helipads
    if (isSkyscraper) {
      this.buildRooftopHeli(cx, height + 0.3, cz);
    }

    // Add 3D Glowing Store Sign
    if (sign && height < 45) {
      this.createNeonSign(cx, height * 0.45, cz + depth / 2 + 0.4, sign, width * 0.7);
    }
  }

  createNeonSign(x, y, z, signData, signWidth) {
    const sCanvas = document.createElement('canvas');
    sCanvas.width = 512;
    sCanvas.height = 128;
    const ctx = sCanvas.getContext('2d');

    // Background
    ctx.fillStyle = signData.bg;
    ctx.fillRect(0, 0, 512, 128);
    // Glowing border
    ctx.strokeStyle = signData.color;
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 496, 112);

    // Text
    ctx.fillStyle = signData.color;
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(signData.text, 256, 64);

    const sTex = new THREE.CanvasTexture(sCanvas);
    const signGeo = new THREE.PlaneGeometry(signWidth, signWidth * 0.25);
    const signMat = new THREE.MeshBasicMaterial({ map: sTex, side: THREE.DoubleSide });
    const signMesh = new THREE.Mesh(signGeo, signMat);
    signMesh.position.set(x, y, z);
    this.scene.add(signMesh);
  }

  buildRooftopHeli(x, y, z) {
    // Helipad circle on skyscraper roof
    const hGeo = new THREE.CircleGeometry(8, 24);
    const hCanvas = document.createElement('canvas');
    hCanvas.width = 256;
    hCanvas.height = 256;
    const ctx = hCanvas.getContext('2d');
    ctx.fillStyle = '#1e2024';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#f5c518';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(128, 128, 100, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f5c518';
    ctx.font = 'bold 120px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', 128, 128);

    const hTex = new THREE.CanvasTexture(hCanvas);
    const hMat = new THREE.MeshBasicMaterial({ map: hTex });
    const hMesh = new THREE.Mesh(hGeo, hMat);
    hMesh.rotation.x = -Math.PI / 2;
    hMesh.position.set(x, y + 0.1, z);
    this.scene.add(hMesh);
  }

  buildMegaStuntPark() {
    // 1. Giant Stunt Ramp over main street
    this.createStuntRamp(0, 0, 110, 16, 8.0, 30, 0); // Big 8m launch ramp!
    this.createStuntRamp(0, 0, -110, 16, 8.0, 30, Math.PI); // Big 8m launch ramp opposite!

    // 2. High-speed wedge jumps
    this.createStuntRamp(110, 0, 0, 14, 6.0, 24, Math.PI / 2);
    this.createStuntRamp(-110, 0, 0, 14, 6.0, 24, -Math.PI / 2);

    // 3. Diagonal stunt ramp with landing pad
    this.createStuntRamp(70, 0, 70, 12, 5.0, 20, Math.PI / 4);
  }

  createStuntRamp(x, y, z, width, height, length, rotationY) {
    const rampGroup = new THREE.Group();

    // Visual Ramp geometry (Wedge prism)
    const shape = new THREE.Shape();
    shape.moveTo(-length / 2, 0);
    shape.lineTo(length / 2, height);
    shape.lineTo(length / 2, 0);
    shape.closePath();

    const extrudeSettings = { depth: width, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center();

    // Checker pattern / caution paint on ramp face
    const rCanvas = document.createElement('canvas');
    rCanvas.width = 256;
    rCanvas.height = 256;
    const ctx = rCanvas.getContext('2d');
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#111';
    for (let i = -256; i < 512; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 32, 0);
      ctx.lineTo(i + 32 + 256, 256);
      ctx.lineTo(i + 256, 256);
      ctx.fill();
    }
    const cautionTex = new THREE.CanvasTexture(rCanvas);
    cautionTex.wrapS = THREE.RepeatWrapping;
    cautionTex.wrapT = THREE.RepeatWrapping;
    cautionTex.repeat.set(2, 4);

    const mat = new THREE.MeshStandardMaterial({
      map: cautionTex,
      roughness: 0.5,
      metalness: 0.3
    });

    const rampMesh = new THREE.Mesh(geo, mat);
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    rampGroup.add(rampMesh);

    rampGroup.position.set(x, y + height / 2, z);
    rampGroup.rotation.y = rotationY;
    this.scene.add(rampGroup);

    // Physics angled Box
    const slopeAngle = Math.atan2(height, length);
    const hypLength = Math.sqrt(height * height + length * length);

    const rampBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      material: this.physics.groundMaterial
    });

    const boxShape = new CANNON.Box(new CANNON.Vec3(hypLength / 2, height * 0.45, width / 2));
    const quat = new CANNON.Quaternion();
    quat.setFromEuler(0, rotationY, -slopeAngle);
    rampBody.addShape(boxShape, new CANNON.Vec3(0, 0, 0), quat);
    rampBody.position.set(x, y + height * 0.45, z);
    this.physics.world.addBody(rampBody);

    this.stuntRamps.push({ x, z, height });
  }

  addStreetTrees(cx, cz, lotSize) {
    const half = lotSize / 2;
    const treePositions = [
      { x: cx - half, z: cz - half },
      { x: cx + half, z: cz - half },
      { x: cx - half, z: cz + half },
      { x: cx + half, z: cz + half },
    ];

    for (const pos of treePositions) {
      const tree = this.createPalmTree();
      tree.position.set(pos.x, 0.35, pos.z);
      this.scene.add(tree);

      // Trunk physics cylinder
      const trunkShape = new CANNON.Cylinder(0.3, 0.4, 6, 8);
      const trunkBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: trunkShape,
        material: this.physics.obstacleMaterial
      });
      trunkBody.position.set(pos.x, 3, pos.z);
      this.physics.world.addBody(trunkBody);
    }
  }

  createPalmTree() {
    const tree = new THREE.Group();

    // Curved trunk segments
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x6e5239,
      roughness: 0.9,
    });
    
    let curY = 0;
    let curOffset = 0;
    for (let i = 0; i < 5; i++) {
      const segGeo = new THREE.CylinderGeometry(0.28 - i * 0.03, 0.35 - i * 0.03, 1.4, 8);
      const seg = new THREE.Mesh(segGeo, trunkMat);
      seg.position.set(curOffset, curY + 0.7, 0);
      seg.rotation.z = -0.06;
      seg.castShadow = true;
      tree.add(seg);
      curY += 1.35;
      curOffset += 0.12;
    }

    // Palm fronds (leaves crown)
    const frondMat = new THREE.MeshStandardMaterial({
      color: 0x2e8b57,
      roughness: 0.6,
      side: THREE.DoubleSide
    });

    const frondCount = 7;
    for (let i = 0; i < frondCount; i++) {
      const angle = (i / frondCount) * Math.PI * 2;
      const fGeo = new THREE.ConeGeometry(0.8, 3.2, 5);
      fGeo.translate(0, 1.6, 0);
      const frond = new THREE.Mesh(fGeo, frondMat);
      frond.position.set(curOffset, curY, 0);
      frond.rotation.y = angle;
      frond.rotation.x = Math.PI / 2.6; // droop outward
      frond.castShadow = true;
      tree.add(frond);
    }

    return tree;
  }

  addStreetProps() {
    // Add Destructible Traffic Cones & Street Lamps along roads
    for (let i = -180; i <= 180; i += 60) {
      if (i === 0) continue;
      // Streetlights with light fixture
      this.createStreetLight(i, 0, 9);
      this.createStreetLight(i, 0, -9);
      this.createStreetLight(9, 0, i);
      this.createStreetLight(-9, 0, i);

      // Destructible traffic cones in road median or corners
      this.createTrafficCone(i + 5, 0.2, 0);
      this.createTrafficCone(i - 5, 0.2, 0);

      // Fire Hydrant
      this.createFireHydrant(i + 15, 0.35, 10);
    }
  }

  addStreetCars() {
    // Place cars along curbside of every block road-edge
    const blockSize = CONFIG.BLOCK_SIZE;
    const roadHalf = CONFIG.ROAD_WIDTH / 2 + 2.5; // offset from road centerline to curb
    const types = ['SUPER', 'MUSCLE', 'OFFROAD', 'MUSCLE', 'OFFROAD', 'POLICE'];
    const numBlocks = Math.floor(CONFIG.CITY_SIZE / blockSize);
    const halfBlocks = numBlocks / 2;

    for (let bx = -halfBlocks; bx < halfBlocks; bx++) {
      for (let bz = -halfBlocks; bz < halfBlocks; bz++) {
        const cx = bx * blockSize + blockSize / 2;
        const cz = bz * blockSize + blockSize / 2;

        // Skip center plaza area
        if (Math.abs(cx) < blockSize && Math.abs(cz) < blockSize) continue;

        const t = () => types[Math.floor(Math.random() * types.length)];

        // North curb (z = cz - blockSize/2 + roadHalf)
        this.addCarSpawn(cx - 15, 0.5, cz - blockSize / 2 + roadHalf, 0, t());
        this.addCarSpawn(cx,      0.5, cz - blockSize / 2 + roadHalf, 0, t());
        this.addCarSpawn(cx + 15, 0.5, cz - blockSize / 2 + roadHalf, 0, t());

        // South curb
        this.addCarSpawn(cx - 15, 0.5, cz + blockSize / 2 - roadHalf, Math.PI, t());
        this.addCarSpawn(cx,      0.5, cz + blockSize / 2 - roadHalf, Math.PI, t());
        this.addCarSpawn(cx + 15, 0.5, cz + blockSize / 2 - roadHalf, Math.PI, t());

        // West curb
        this.addCarSpawn(cx - blockSize / 2 + roadHalf, 0.5, cz - 15, -Math.PI / 2, t());
        this.addCarSpawn(cx - blockSize / 2 + roadHalf, 0.5, cz,       -Math.PI / 2, t());
        this.addCarSpawn(cx - blockSize / 2 + roadHalf, 0.5, cz + 15,  -Math.PI / 2, t());

        // East curb
        this.addCarSpawn(cx + blockSize / 2 - roadHalf, 0.5, cz - 15,  Math.PI / 2, t());
        this.addCarSpawn(cx + blockSize / 2 - roadHalf, 0.5, cz,        Math.PI / 2, t());
        this.addCarSpawn(cx + blockSize / 2 - roadHalf, 0.5, cz + 15,   Math.PI / 2, t());
      }
    }
  }


  createStreetLight(x, y, z) {
    const group = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.8, roughness: 0.3 });

    // Vertical pole
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7.5, 8);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(0, 3.75, 0);
    group.add(pole);

    // Lamp arm
    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.0, 8);
    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.rotation.z = Math.PI / 2.8;
    arm.position.set(0.8, 7.3, 0);
    group.add(arm);

    // Glowing bulb
    const bulbGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff3cc });
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(1.5, 7.2, 0);
    group.add(bulb);

    group.position.set(x, y, z);
    this.scene.add(group);

    // Physics static pole
    const poleShape = new CANNON.Cylinder(0.15, 0.15, 7.5, 6);
    const poleBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: poleShape,
      material: this.physics.obstacleMaterial
    });
    poleBody.position.set(x, y + 3.75, z);
    this.physics.world.addBody(poleBody);
  }

  createTrafficCone(x, y, z) {
    // Dynamic knockable cone with Cannon physics
    const coneGroup = new THREE.Group();

    const baseGeo = new THREE.BoxGeometry(0.6, 0.08, 0.6);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.04;
    coneGroup.add(base);

    const coneGeo = new THREE.ConeGeometry(0.24, 0.85, 10);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xff5500, roughness: 0.4 });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = 0.46;
    coneGroup.add(cone);

    // White reflective band
    const bandGeo = new THREE.CylinderGeometry(0.16, 0.19, 0.22, 10);
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.y = 0.45;
    coneGroup.add(band);

    coneGroup.position.set(x, y, z);
    this.scene.add(coneGroup);

    // Dynamic lightweight Cannon body (~4kg)
    const coneBody = new CANNON.Body({
      mass: 4,
      shape: new CANNON.Cylinder(0.05, 0.25, 0.85, 8),
      material: this.physics.obstacleMaterial
    });
    coneBody.position.set(x, y + 0.42, z);
    this.physics.world.addBody(coneBody);
    this.physics.registerSync(coneGroup, coneBody, new THREE.Vector3(0, -0.42, 0));
    this.destructibles.push({ mesh: coneGroup, body: coneBody });
  }

  createFireHydrant(x, y, z) {
    const hydGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.9, 10);
    const hydMat = new THREE.MeshStandardMaterial({ color: 0xdd1111, metalness: 0.4, roughness: 0.3 });
    const hydMesh = new THREE.Mesh(hydGeo, hydMat);
    hydMesh.position.set(x, y + 0.45, z);
    this.scene.add(hydMesh);

    // Physics dynamic hydrant (mass 15kg, knocks over with car ram)
    const hydBody = new CANNON.Body({
      mass: 18,
      shape: new CANNON.Cylinder(0.2, 0.22, 0.9, 8),
      material: this.physics.obstacleMaterial
    });
    hydBody.position.set(x, y + 0.45, z);
    this.physics.world.addBody(hydBody);
    this.physics.registerSync(hydMesh, hydBody);
    this.waterHydrants.push({ mesh: hydMesh, body: hydBody, broken: false });
  }
}
