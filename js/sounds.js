// Web Audio API sound system - all sounds synthesized, no files needed
const Sounds = {
  ctx: null,
  enabled: true,
  masterGain: null,

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      this.enabled = false;
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  },

  // Play a tone with envelope
  tone(freq, duration, type = 'sine', volume = 0.5, slideTo = null) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
    }
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration + 0.05);
  },

  // Noise burst for impacts
  noise(duration, volume = 0.3, filterFreq = 1000) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    this.resume();

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start();
    src.stop(this.ctx.currentTime + duration + 0.05);
  },

  // Sound presets
  pop() { this.tone(600, 0.08, 'sine', 0.4, 300); },
  click() { this.tone(800, 0.04, 'square', 0.25); },
  hit() { this.noise(0.15, 0.35, 2000); this.tone(120, 0.12, 'sine', 0.4, 60); },
  thud() { this.noise(0.25, 0.4, 500); this.tone(80, 0.2, 'sine', 0.5, 40); },
  whoosh() { this.noise(0.3, 0.2, 3000); },
  coin() { this.tone(988, 0.08, 'square', 0.3); setTimeout(() => this.tone(1319, 0.12, 'square', 0.3), 60); },
  success() {
    this.tone(523, 0.1, 'sine', 0.35);
    setTimeout(() => this.tone(659, 0.1, 'sine', 0.35), 100);
    setTimeout(() => this.tone(784, 0.15, 'sine', 0.35), 200);
    setTimeout(() => this.tone(1047, 0.25, 'sine', 0.4), 300);
  },
  fail() {
    this.tone(300, 0.15, 'sawtooth', 0.4, 150);
    setTimeout(() => this.tone(150, 0.3, 'sawtooth', 0.4, 80), 150);
  },
  jump() { this.tone(400, 0.12, 'sine', 0.3, 800); },
  land() { this.noise(0.1, 0.25, 400); },
  spin() { this.tone(200, 0.8, 'sawtooth', 0.15, 600); },
  boost() { this.tone(660, 0.1, 'sine', 0.3, 1320); },
  flick() { this.tone(500, 0.15, 'sine', 0.3, 200); this.noise(0.08, 0.15, 3000); },
  collect() { this.tone(784, 0.06, 'square', 0.25); setTimeout(() => this.tone(1047, 0.08, 'square', 0.25), 50); },
  tick() { this.tone(1000, 0.02, 'square', 0.2); },
  swoosh() { this.noise(0.2, 0.15, 2500); },
  drop() { this.tone(800, 0.1, 'sine', 0.25, 200); },
  catch() { this.tone(1200, 0.08, 'square', 0.3); setTimeout(() => this.tone(1600, 0.1, 'square', 0.3), 40); },
  tag() { this.tone(200, 0.1, 'square', 0.35); this.noise(0.1, 0.25, 800); }
};

// Initialize on first user interaction
document.addEventListener('click', () => Sounds.init(), { once: true });
document.addEventListener('touchstart', () => Sounds.init(), { once: true });
