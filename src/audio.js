// Procedural Web Audio engine for GTA MVP (zero external files required)
export class SoundSystem {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.radioOn = true;
    this.radioStation = 0; // 0: Synthwave, 1: West Coast Beat, 2: Off
    
    // Engine sound nodes
    this.engineRunning = false;
    this.osc1 = null;
    this.osc2 = null;
    this.subOsc = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.distortion = null;
    
    // Tire screech nodes
    this.screechSource = null;
    this.screechGain = null;
    this.screechFilter = null;
    
    // Nitro nodes
    this.nitroGain = null;
    this.nitroOsc = null;
    
    // Horn nodes
    this.hornGain = null;
    this.hornOsc1 = null;
    this.hornOsc2 = null;

    // Siren nodes
    this.sirenGain = null;
    this.sirenOsc = null;
    this.sirenLfo = null;
    
    // Radio sequence
    this.radioTimer = null;
    this.radioStep = 0;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();

    // Create tire screech noise buffer
    this.setupScreechSound();
    
    // Create car horn
    this.setupHorn();

    // Create police siren
    this.setupSiren();

    // Start background radio synthesizer
    this.startRadio();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Engine synthesizer
  startEngine() {
    if (!this.ctx || this.engineRunning) return;
    this.resume();

    const t = this.ctx.currentTime;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.01, t);
    this.engineGain.gain.linearRampToValueAtTime(0.28, t + 0.3);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(320, t);
    this.engineFilter.Q.setValueAtTime(4.0, t);

    // Primary piston pulse oscillator (Sawtooth)
    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc1.frequency.setValueAtTime(35, t);

    // Secondary oscillator (Triangle for low-end body)
    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = 'triangle';
    this.osc2.frequency.setValueAtTime(70, t);

    // Deep sub rumble
    this.subOsc = this.ctx.createOscillator();
    this.subOsc.type = 'sine';
    this.subOsc.frequency.setValueAtTime(25, t);

    this.osc1.connect(this.engineFilter);
    this.osc2.connect(this.engineFilter);
    this.subOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.osc1.start();
    this.osc2.start();
    this.subOsc.start();
    this.engineRunning = true;
  }

  stopEngine() {
    if (!this.engineRunning || !this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.engineGain) {
      this.engineGain.gain.linearRampToValueAtTime(0.001, t + 0.2);
    }
    setTimeout(() => {
      try {
        if (this.osc1) { this.osc1.stop(); this.osc1.disconnect(); }
        if (this.osc2) { this.osc2.stop(); this.osc2.disconnect(); }
        if (this.subOsc) { this.subOsc.stop(); this.subOsc.disconnect(); }
      } catch (e) {}
      this.engineRunning = false;
    }, 250);
  }

  updateEngine(speedKmh, throttle, nitroActive) {
    if (!this.engineRunning || !this.ctx) return;
    const t = this.ctx.currentTime;

    // Simulate multi-gear RPM curve (1 to 5 gears)
    const absSpeed = Math.abs(speedKmh);
    let gear = 1;
    let gearRatio = 1;
    if (absSpeed < 30) { gear = 1; gearRatio = absSpeed / 30; }
    else if (absSpeed < 65) { gear = 2; gearRatio = (absSpeed - 30) / 35; }
    else if (absSpeed < 105) { gear = 3; gearRatio = (absSpeed - 65) / 40; }
    else if (absSpeed < 145) { gear = 4; gearRatio = (absSpeed - 105) / 40; }
    else { gear = 5; gearRatio = Math.min(1.0, (absSpeed - 145) / 50); }

    const idleFreq = 32;
    const baseFreq = idleFreq + gearRatio * 90 + (throttle > 0 ? 30 : 0);
    const nitroBoost = nitroActive ? 35 : 0;
    const targetFreq = Math.min(220, baseFreq + nitroBoost);

    this.osc1.frequency.setTargetAtTime(targetFreq, t, 0.08);
    this.osc2.frequency.setTargetAtTime(targetFreq * 1.5, t, 0.08);
    this.subOsc.frequency.setTargetAtTime(targetFreq * 0.5, t, 0.08);

    // Filter frequency opens up with throttle and speed
    const cutoff = 280 + gearRatio * 750 + (throttle > 0 ? 450 : 0) + (nitroActive ? 600 : 0);
    this.engineFilter.frequency.setTargetAtTime(cutoff, t, 0.06);

    const volume = 0.15 + (throttle !== 0 ? 0.16 : 0.06) + (nitroActive ? 0.08 : 0);
    this.engineGain.gain.setTargetAtTime(volume, t, 0.05);
  }

  // Screeching tires sound
  setupScreechSound() {
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.screechFilter = this.ctx.createBiquadFilter();
    this.screechFilter.type = 'bandpass';
    this.screechFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
    this.screechFilter.Q.setValueAtTime(3.5, this.ctx.currentTime);

    this.screechGain = this.ctx.createGain();
    this.screechGain.gain.setValueAtTime(0, this.ctx.currentTime);

    whiteNoise.connect(this.screechFilter);
    this.screechFilter.connect(this.screechGain);
    this.screechGain.connect(this.ctx.destination);
    whiteNoise.start();
  }

  updateTireScreech(slipAmount) {
    if (!this.screechGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    const targetGain = Math.min(0.35, Math.max(0, slipAmount * 0.4));
    this.screechGain.gain.setTargetAtTime(targetGain, t, 0.05);
    if (slipAmount > 0.1) {
      this.screechFilter.frequency.setTargetAtTime(1200 + slipAmount * 800, t, 0.05);
    }
  }

  // Car Horn
  setupHorn() {
    this.hornGain = this.ctx.createGain();
    this.hornGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.hornOsc1 = this.ctx.createOscillator();
    this.hornOsc1.type = 'sawtooth';
    this.hornOsc1.frequency.setValueAtTime(425, this.ctx.currentTime);

    this.hornOsc2 = this.ctx.createOscillator();
    this.hornOsc2.type = 'sawtooth';
    this.hornOsc2.frequency.setValueAtTime(510, this.ctx.currentTime);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, this.ctx.currentTime);

    this.hornOsc1.connect(filter);
    this.hornOsc2.connect(filter);
    filter.connect(this.hornGain);
    this.hornGain.connect(this.ctx.destination);

    this.hornOsc1.start();
    this.hornOsc2.start();
  }

  setHorn(active) {
    if (!this.hornGain || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    this.hornGain.gain.setTargetAtTime(active ? 0.22 : 0, t, 0.03);
  }

  // Crash collision thud
  playCrash(intensity = 1.0) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    
    // Sub bass punch
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.35);

    const vol = Math.min(0.6, 0.2 * intensity);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.35);

    // Crunch noise
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.2);
    const crunchBuf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = crunchBuf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = crunchBuf;
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(vol * 0.7, t);
    noise.connect(nGain);
    nGain.connect(this.ctx.destination);
    noise.start(t);
  }

  // Player footsteps & jump
  playFootstep(run = false) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(run ? 90 : 75, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.06);

    gain.gain.setValueAtTime(run ? 0.12 : 0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  playJump() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.18);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  // Police Siren
  setupSiren() {
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sawtooth';
    this.sirenOsc.frequency.setValueAtTime(650, this.ctx.currentTime);

    this.sirenLfo = this.ctx.createOscillator();
    this.sirenLfo.type = 'sine';
    this.sirenLfo.frequency.setValueAtTime(2.2, this.ctx.currentTime); // Siren cycle speed

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(280, this.ctx.currentTime); // Modulation depth

    this.sirenLfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, this.ctx.currentTime);

    this.sirenOsc.connect(filter);
    filter.connect(this.sirenGain);
    this.sirenGain.connect(this.ctx.destination);

    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  setSiren(active) {
    if (!this.sirenGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(active ? 0.15 : 0, t, 0.2);
  }

  // Radio Synthesizer (West Coast / Synthwave GTA Vibes)
  startRadio() {
    const bassNotes = [110, 110, 130.81, 146.83, 110, 98, 110, 164.81];
    const synthNotes = [220, 261.63, 329.63, 392, 440, 523.25, 440, 329.63];
    
    this.radioTimer = setInterval(() => {
      if (!this.ctx || this.radioStation === 2 || !this.radioOn || this.ctx.state !== 'running') {
        return;
      }
      this.radioStep = (this.radioStep + 1) % 16;
      const t = this.ctx.currentTime;

      // Bass note on eighths
      if (this.radioStep % 2 === 0) {
        const noteIdx = Math.floor(this.radioStep / 2) % bassNotes.length;
        const bOsc = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        bOsc.type = this.radioStation === 0 ? 'sawtooth' : 'triangle';
        bOsc.frequency.setValueAtTime(bassNotes[noteIdx] * (this.radioStation === 0 ? 0.5 : 0.75), t);
        
        bGain.gain.setValueAtTime(0.04, t);
        bGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        
        const bFilt = this.ctx.createBiquadFilter();
        bFilt.type = 'lowpass';
        bFilt.frequency.setValueAtTime(380, t);
        
        bOsc.connect(bFilt);
        bFilt.connect(bGain);
        bGain.connect(this.ctx.destination);
        bOsc.start(t);
        bOsc.stop(t + 0.24);
      }

      // Synth arp on sixteenths
      if (this.radioStep % 4 === 1 || this.radioStep % 4 === 3) {
        const sNote = synthNotes[(this.radioStep * 3) % synthNotes.length];
        const sOsc = this.ctx.createOscillator();
        const sGain = this.ctx.createGain();
        sOsc.type = 'sine';
        sOsc.frequency.setValueAtTime(sNote, t);
        
        sGain.gain.setValueAtTime(0.02, t);
        sGain.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
        
        sOsc.connect(sGain);
        sGain.connect(this.ctx.destination);
        sOsc.start(t);
        sOsc.stop(t + 0.18);
      }

      // Soft kick on 0, 4, 8, 12
      if (this.radioStep % 4 === 0) {
        const kOsc = this.ctx.createOscillator();
        const kGain = this.ctx.createGain();
        kOsc.frequency.setValueAtTime(110, t);
        kOsc.frequency.exponentialRampToValueAtTime(35, t + 0.1);
        kGain.gain.setValueAtTime(0.06, t);
        kGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        kOsc.connect(kGain);
        kGain.connect(this.ctx.destination);
        kOsc.start(t);
        kOsc.stop(t + 0.12);
      }

      // Snare / clap on 4, 12
      if (this.radioStep === 4 || this.radioStep === 12) {
        const sSize = Math.floor(this.ctx.sampleRate * 0.08);
        const sBuf = this.ctx.createBuffer(1, sSize, this.ctx.sampleRate);
        const sData = sBuf.getChannelData(0);
        for (let i = 0; i < sSize; i++) sData[i] = (Math.random() * 2 - 1) * 0.03;
        const sSrc = this.ctx.createBufferSource();
        sSrc.buffer = sBuf;
        sSrc.connect(this.ctx.destination);
        sSrc.start(t);
      }
    }, 130);
  }

  cycleRadio() {
    this.radioStation = (this.radioStation + 1) % 3;
    const names = ['Radio Los Santos (Synthwave)', 'West Coast Beats', 'Радио ВЫКЛ'];
    return names[this.radioStation];
  }
}

// Weapon & Combat Sound Effects
SoundSystem.prototype.playPistol = function() {
  if (!this.ctx) return;
  this.resume();
  const t = this.ctx.currentTime;

  // Punchy gunshot pop
  const osc = this.ctx.createOscillator();
  const gain = this.ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(380, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);

  gain.gain.setValueAtTime(0.4, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

  osc.connect(gain);
  gain.connect(this.ctx.destination);
  osc.start(t);
  osc.stop(t + 0.12);

  // Explosive crackle noise
  const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
  const noiseBuf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.22));
  }
  const noise = this.ctx.createBufferSource();
  noise.buffer = noiseBuf;

  const filter = this.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1400, t);
  filter.Q.setValueAtTime(2.0, t);

  const nGain = this.ctx.createGain();
  nGain.gain.setValueAtTime(0.35, t);
  nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

  noise.connect(filter);
  filter.connect(nGain);
  nGain.connect(this.ctx.destination);
  noise.start(t);
};

SoundSystem.prototype.playRifle = function() {
  if (!this.ctx) return;
  this.resume();
  const t = this.ctx.currentTime;

  // Sharp rifle report
  const osc = this.ctx.createOscillator();
  const gain = this.ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.14);

  gain.gain.setValueAtTime(0.45, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

  const filter = this.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2200, t);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(this.ctx.destination);
  osc.start(t);
  osc.stop(t + 0.14);

  // High explosive blast noise
  const bufferSize = Math.floor(this.ctx.sampleRate * 0.22);
  const noiseBuf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
  }
  const noise = this.ctx.createBufferSource();
  noise.buffer = noiseBuf;

  const nGain = this.ctx.createGain();
  nGain.gain.setValueAtTime(0.38, t);
  nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

  noise.connect(nGain);
  nGain.connect(this.ctx.destination);
  noise.start(t);
};

SoundSystem.prototype.playPunch = function() {
  if (!this.ctx) return;
  this.resume();
  const t = this.ctx.currentTime;

  const osc = this.ctx.createOscillator();
  const gain = this.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);

  gain.gain.setValueAtTime(0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

  osc.connect(gain);
  gain.connect(this.ctx.destination);
  osc.start(t);
  osc.stop(t + 0.15);
};

SoundSystem.prototype.playReload = function() {
  if (!this.ctx) return;
  this.resume();
  const t = this.ctx.currentTime;

  // Mechanical click clack
  [0, 0.15].forEach((delay) => {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(950, t + delay);
    osc.frequency.exponentialRampToValueAtTime(220, t + delay + 0.05);

    gain.gain.setValueAtTime(0.2, t + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t + delay);
    osc.stop(t + delay + 0.05);
  });
};
