export class UIManager {
  constructor() {
    this.speedValue = document.getElementById('speed-value');
    this.gearValue = document.getElementById('gear-value');
    this.carName = document.getElementById('car-name');
    this.nitroBar = document.getElementById('nitro-bar-fill');
    this.speedometerContainer = document.getElementById('speedometer-hud');

    this.promptBox = document.getElementById('action-prompt');
    this.starsContainer = document.getElementById('wanted-stars');
    this.radioBanner = document.getElementById('radio-banner');
    this.wastedScreen = document.getElementById('wasted-screen');

    // Weapon HUD & crosshair
    this.weaponHud = document.getElementById('weapon-hud');
    this.weaponIcon = document.getElementById('weapon-icon');
    this.weaponName = document.getElementById('weapon-name');
    this.ammoCount = document.getElementById('ammo-count');
    this.crosshair = document.getElementById('crosshair');

    this.radioTimeout = null;
  }

  showPrompt(text) {
    if (text) {
      this.promptBox.innerText = text;
      this.promptBox.style.display = 'block';
    } else {
      this.promptBox.style.display = 'none';
    }
  }

  updateSpeedometer(vehicle) {
    if (!vehicle || !vehicle.isDriven) {
      this.speedometerContainer.style.display = 'none';
      return;
    }

    this.speedometerContainer.style.display = 'flex';
    const speed = Math.abs(vehicle.speedKmh);
    this.speedValue.innerText = speed;
    this.carName.innerText = vehicle.spec.name;

    let gear = '1';
    if (vehicle.speedKmh < -1) gear = 'R';
    else if (speed < 30) gear = '1';
    else if (speed < 65) gear = '2';
    else if (speed < 105) gear = '3';
    else if (speed < 145) gear = '4';
    else gear = '5';
    this.gearValue.innerText = gear;

    this.nitroBar.style.width = `${vehicle.nitroRemaining}%`;
    if (vehicle.nitro) {
      this.nitroBar.classList.add('nitro-active');
    } else {
      this.nitroBar.classList.remove('nitro-active');
    }
  }

  updateWeapon(weapon, ammo, inVehicle) {
    if (inVehicle) {
      this.weaponHud.style.display = 'none';
      this.crosshair.style.display = 'none';
      return;
    }

    this.weaponHud.style.display = 'flex';
    this.crosshair.style.display = 'block';

    const icons = { fists: '👊', pistol: '🔫', rifle: '⚡' };
    this.weaponIcon.innerText = icons[weapon.id] || '🔫';
    this.weaponName.innerText = weapon.name;
    if (weapon.isMelee) {
      this.ammoCount.innerText = '∞';
    } else {
      this.ammoCount.innerText = `${ammo.mag} / ${ammo.reserve}`;
    }
  }

  setAiming(isAiming) {
    if (!this.crosshair) return;
    if (isAiming) {
      this.crosshair.classList.add('aiming');
    } else {
      this.crosshair.classList.remove('aiming');
    }
  }

  updateWantedStars(level) {
    const stars = this.starsContainer.children;
    for (let i = 0; i < 5; i++) {
      if (i < level) {
        stars[i].classList.add('star-active');
      } else {
        stars[i].classList.remove('star-active');
      }
    }
  }

  showRadioChange(stationName) {
    if (this.radioTimeout) clearTimeout(this.radioTimeout);
    this.radioBanner.innerText = `📻 ${stationName}`;
    this.radioBanner.style.opacity = '1';
    this.radioBanner.style.transform = 'translateY(0)';

    this.radioTimeout = setTimeout(() => {
      this.radioBanner.style.opacity = '0';
      this.radioBanner.style.transform = 'translateY(-20px)';
    }, 2800);
  }

  showWasted(show) {
    this.wastedScreen.style.display = show ? 'flex' : 'none';
  }
}
