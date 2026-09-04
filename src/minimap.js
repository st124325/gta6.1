import { CONFIG } from './config.js?v=4';

export class Minimap {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.size = this.canvas.width;
    this.center = this.size / 2;
    this.radius = this.size / 2 - 12;
    this.scale = 0.55; // Pixels per meter in world space
  }

  render(player, traffic, city) {
    const ctx = this.ctx;
    const c = this.center;
    const r = this.radius;

    ctx.clearRect(0, 0, this.size, this.size);

    // 1. Radar Circular Mask & Dark Background
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = 'rgba(12, 16, 22, 0.88)';
    ctx.fillRect(0, 0, this.size, this.size);

    // Radar coordinate transform relative to player
    const pPos = player.inVehicle ? player.currentVehicle.mesh.position : player.mesh.position;
    
    // Draw Roads Grid
    ctx.strokeStyle = 'rgba(65, 75, 88, 0.75)';
    ctx.lineWidth = CONFIG.ROAD_WIDTH * this.scale;
    ctx.lineCap = 'round';

    const numBlocks = Math.floor(CONFIG.CITY_SIZE / CONFIG.BLOCK_SIZE);
    for (let i = -numBlocks / 2; i <= numBlocks / 2; i++) {
      const worldCoord = i * CONFIG.BLOCK_SIZE;

      // Horizontal Road
      const screenY = c + (worldCoord - pPos.z) * this.scale;
      ctx.beginPath();
      ctx.moveTo(c - (CONFIG.CITY_SIZE / 2 + pPos.x) * this.scale, screenY);
      ctx.lineTo(c + (CONFIG.CITY_SIZE / 2 - pPos.x) * this.scale, screenY);
      ctx.stroke();

      // Vertical Road
      const screenX = c + (worldCoord - pPos.x) * this.scale;
      ctx.beginPath();
      ctx.moveTo(screenX, c - (CONFIG.CITY_SIZE / 2 + pPos.z) * this.scale);
      ctx.lineTo(screenX, c + (CONFIG.CITY_SIZE / 2 - pPos.z) * this.scale);
      ctx.stroke();
    }

    // Draw Stunt Ramps (Yellow Stars)
    for (const ramp of city.stuntRamps) {
      const rx = c + (ramp.x - pPos.x) * this.scale;
      const rz = c + (ramp.z - pPos.z) * this.scale;
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(rx, rz, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Nearby Cars (Cyan/Blue dots)
    for (const v of traffic.vehicles) {
      if (player.inVehicle && v === player.currentVehicle) continue;
      const vx = c + (v.mesh.position.x - pPos.x) * this.scale;
      const vz = c + (v.mesh.position.z - pPos.z) * this.scale;

      ctx.fillStyle = v.spec.type === 'police' ? '#ff3333' : '#00e5ff';
      ctx.beginPath();
      ctx.rect(vx - 3, vz - 3, 6, 6);
      ctx.fill();
    }

    ctx.restore(); // Exit clip mask

    // 2. Outer Radar Borders & Health/Armor Gauge Rings (GTA 5 Style)
    // Dark outer casing ring
    ctx.strokeStyle = '#222831';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(c, c, r + 4, 0, Math.PI * 2);
    ctx.stroke();

    // Green Health Bar Ring (Left semicircle)
    const healthRatio = player.health / 100;
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(c, c, r + 4, Math.PI / 2, Math.PI / 2 + Math.PI * healthRatio);
    ctx.stroke();

    // Blue Armor / Nitro Ring (Right semicircle)
    let rightRatio = 1.0;
    let rightColor = '#3498db';
    if (player.inVehicle) {
      rightRatio = player.currentVehicle.nitroRemaining / 100;
      rightColor = '#00d0ff';
    }
    ctx.strokeStyle = rightColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(c, c, r + 4, Math.PI / 2, Math.PI / 2 - Math.PI * rightRatio, true);
    ctx.stroke();

    // 3. Player Arrow Icon (Center of radar)
    ctx.save();
    ctx.translate(c, c);
    
    // Player or vehicle yaw angle
    let yaw = 0;
    if (player.inVehicle) {
      yaw = player.currentVehicle.mesh.rotation.y;
    } else {
      yaw = player.modelRoot.rotation.y;
    }
    ctx.rotate(-yaw);

    // Sharp white arrow
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 4);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // North Marker "N"
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', c, 14);
  }
}
