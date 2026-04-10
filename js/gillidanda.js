// Gilli Danda (Viti Dandu) - Timing-based batting game
const GilliDandaGame = {
  canvas: null, ctx: null, width: 400, height: 500, dpr: 1,
  state: 'ready', // ready, flipping, swinging, flying, landed, gameover
  gilli: null, // the small stick
  danda: null, // the long stick (bat)
  dandaAngle: 0,
  swingProgress: 0,
  swinging: false,
  swingPower: 0,
  powerDirection: 1,
  charging: false,
  flipPhase: 0, // 0-1
  particles: [], floatingTexts: [],
  round: 1, totalDistance: 0, bestDistance: 0,
  animationId: null, onScoreUpdate: null,
  cloudOffset: 0,

  init(container, onScoreUpdate) {
    this.onScoreUpdate = onScoreUpdate;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.min(500, window.innerWidth - 40);
    this.height = Math.round(this.width * 0.85);

    this.canvas = document.createElement('canvas');
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(this.dpr, this.dpr);

    this._onDown = (e) => { e.preventDefault(); this.handleDown(); };
    this._onUp = (e) => { e.preventDefault(); this.handleUp(); };
    this.canvas.addEventListener('mousedown', this._onDown);
    this.canvas.addEventListener('mouseup', this._onUp);
    this.canvas.addEventListener('touchstart', this._onDown, { passive: false });
    this.canvas.addEventListener('touchend', this._onUp, { passive: false });

    this.reset();
    this.loop();
  },

  reset() {
    this.state = 'ready';
    this.round = 1;
    this.totalDistance = 0;
    this.bestDistance = 0;
    this.particles = [];
    this.floatingTexts = [];
    this.swingPower = 0;
    this.setupRound();
  },

  setupRound() {
    this.state = 'ready';
    this.gilli = {
      x: this.width * 0.2,
      y: this.height - this.width * 0.18,
      vx: 0, vy: 0,
      rotation: 0, rotVel: 0,
      onGround: false,
      distance: 0
    };
    this.danda = {
      pivotX: this.width * 0.13,
      pivotY: this.height - this.width * 0.22,
      length: this.width * 0.22,
      angle: -Math.PI * 0.15
    };
    this.dandaAngle = -Math.PI * 0.15;
    this.swingProgress = 0;
    this.swinging = false;
    this.flipPhase = 0;
    this.charging = false;
    this.swingPower = 0;
    this.updateScore();
  },

  handleDown() {
    if (this.state === 'ready') {
      // Start flipping gilli into air
      this.state = 'flipping';
      Sounds.tick();
    } else if (this.state === 'swinging') {
      // Start charging power
      this.charging = true;
      this.swingPower = 0;
      this.powerDirection = 1;
    } else if (this.state === 'landed') {
      // Next round
      if (this.round >= 5) {
        this.state = 'gameover';
      } else {
        this.round++;
        this.setupRound();
      }
    } else if (this.state === 'gameover') {
      this.reset();
    }
  },

  handleUp() {
    if (this.state === 'swinging' && this.charging) {
      this.charging = false;
      // Check timing - gilli should be near danda
      const dx = this.gilli.x - this.danda.pivotX;
      const dy = this.gilli.y - this.danda.pivotY;
      const distToBat = Math.sqrt(dx * dx + dy * dy);
      const inRange = distToBat < this.danda.length * 1.3 && distToBat > this.danda.length * 0.3;

      this.swinging = true;
      this.swingProgress = 0;

      if (inRange) {
        // Good hit! Calculate power based on swing charge and timing
        const timingBonus = 1 - Math.abs(distToBat - this.danda.length) / this.danda.length;
        const power = 8 + this.swingPower * 0.15 + timingBonus * 6;
        const angleBonus = -Math.PI * 0.35 - this.swingPower * 0.003;
        this.gilli.vx = Math.cos(angleBonus) * power * -1;
        // Flip direction: towards right
        this.gilli.vx = Math.abs(this.gilli.vx);
        this.gilli.vy = Math.sin(angleBonus) * power;
        this.gilli.rotVel = 0.3 + this.swingPower * 0.002;
        this.state = 'flying';
        Sounds.hit();
        this.addFloat(this.gilli.x, this.gilli.y - 20, 'Shot!', '#FFD700');
      } else {
        // Missed!
        Sounds.fail();
        this.addFloat(this.gilli.x, this.gilli.y - 20, 'Miss!', '#E53935');
        setTimeout(() => {
          if (this.round >= 5) this.state = 'gameover';
          else { this.round++; this.setupRound(); }
        }, 1000);
      }
    }
  },

  updateScore() {
    if (this.onScoreUpdate) {
      this.onScoreUpdate(`Round ${this.round}/5  |  Total: ${Math.floor(this.totalDistance)}m`);
    }
  },

  addFloat(x, y, text, color) {
    this.floatingTexts.push({ x, y, text, color, life: 1, vy: -1.5 });
  },

  update() {
    this.cloudOffset += 0.1;

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= p.decay;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy; ft.life -= 0.012;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    if (this.state === 'flipping') {
      this.flipPhase += 0.03;
      // Arc motion - flips up and forward
      const t = this.flipPhase;
      this.gilli.x = this.width * 0.2 + t * this.width * 0.08;
      this.gilli.y = this.height - this.width * 0.18 - Math.sin(t * Math.PI) * this.width * 0.2;
      this.gilli.rotation += 0.2;
      if (this.flipPhase >= 1) {
        // Gilli is now descending, ready for swing
        this.state = 'swinging';
        this.gilli.vy = 0;
      }
      return;
    }

    if (this.state === 'swinging') {
      // Gilli falls
      this.gilli.y += this.gilli.vy;
      this.gilli.vy += 0.25;
      this.gilli.rotation += 0.15;

      if (this.charging) {
        this.swingPower += this.powerDirection * 3;
        if (this.swingPower >= 100) this.powerDirection = -1;
        if (this.swingPower <= 0) this.powerDirection = 1;
      }

      // If gilli hits ground and wasn't hit
      if (this.gilli.y > this.height - this.width * 0.12 && !this.swinging) {
        this.state = 'landed';
        this.gilli.y = this.height - this.width * 0.12;
        Sounds.thud();
        this.addFloat(this.gilli.x, this.gilli.y - 20, 'Missed!', '#E53935');
      }
    }

    if (this.swinging) {
      this.swingProgress += 0.15;
      this.dandaAngle = -Math.PI * 0.15 + this.swingProgress * Math.PI * 0.6;
      if (this.swingProgress >= 1) this.swinging = false;
    }

    if (this.state === 'flying') {
      this.gilli.x += this.gilli.vx;
      this.gilli.y += this.gilli.vy;
      this.gilli.vy += 0.25;
      this.gilli.rotation += this.gilli.rotVel;
      this.gilli.distance += Math.abs(this.gilli.vx) * 0.3;

      // Trail
      if (Math.random() < 0.5) {
        this.particles.push({
          x: this.gilli.x, y: this.gilli.y,
          vx: -this.gilli.vx * 0.1, vy: 0,
          life: 1, decay: 0.05,
          radius: 2, color: 'rgba(200, 180, 140, 0.6)'
        });
      }

      if (this.gilli.y > this.height - this.width * 0.12) {
        this.gilli.y = this.height - this.width * 0.12;
        this.state = 'landed';
        this.totalDistance += this.gilli.distance;
        if (this.gilli.distance > this.bestDistance) this.bestDistance = this.gilli.distance;
        Sounds.thud();
        for (let i = 0; i < 8; i++) {
          this.particles.push({
            x: this.gilli.x + (Math.random() - 0.5) * 10,
            y: this.gilli.y,
            vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2,
            life: 1, decay: 0.03,
            radius: 2, color: 'rgba(180, 160, 120, 0.7)'
          });
        }
        this.addFloat(this.gilli.x, this.gilli.y - 25, `${Math.floor(this.gilli.distance)}m!`, '#FFD700');
        this.updateScore();
      }

      // Camera follow
      if (this.gilli.x > this.width * 0.7) {
        const offset = this.gilli.x - this.width * 0.7;
        this.gilli.x -= offset;
        // Can't actually scroll, so cap position
      }
    }
  },

  draw() {
    const ctx = this.ctx;

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, this.height);
    sky.addColorStop(0, '#87CEEB');
    sky.addColorStop(1, '#FFD580');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.width, this.height);

    // Clouds
    for (let i = 0; i < 3; i++) {
      const cx = ((i * 180 + this.cloudOffset) % (this.width + 100)) - 50;
      const cy = 30 + i * 20;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.arc(cx + 15, cy, 14, 0, Math.PI * 2);
      ctx.arc(cx - 15, cy, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distant hills
    ctx.fillStyle = '#a4b87a';
    ctx.beginPath();
    ctx.moveTo(0, this.height * 0.65);
    ctx.quadraticCurveTo(this.width * 0.25, this.height * 0.5, this.width * 0.5, this.height * 0.62);
    ctx.quadraticCurveTo(this.width * 0.75, this.height * 0.75, this.width, this.height * 0.6);
    ctx.lineTo(this.width, this.height);
    ctx.lineTo(0, this.height);
    ctx.fill();

    // Ground
    const groundGrad = ctx.createLinearGradient(0, this.height * 0.75, 0, this.height);
    groundGrad.addColorStop(0, '#c8a868');
    groundGrad.addColorStop(1, '#a88848');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, this.height * 0.75, this.width, this.height * 0.25);

    // Distance markers
    for (let i = 1; i <= 5; i++) {
      const mx = this.width * 0.15 + i * this.width * 0.15;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mx, this.height - 20);
      ctx.lineTo(mx, this.height - 10);
      ctx.stroke();
      ctx.fillStyle = 'rgba(60,40,20,0.5)';
      ctx.font = `${this.width * 0.022}px Poppins, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`${i * 10}m`, mx, this.height - 2);
    }
    ctx.textAlign = 'start';

    // Groove / starting spot
    ctx.strokeStyle = '#6b4820';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.width * 0.15, this.height - this.width * 0.12);
    ctx.lineTo(this.width * 0.25, this.height - this.width * 0.12);
    ctx.stroke();

    // Player (stick figure)
    const px = this.width * 0.1;
    const py = this.height - this.width * 0.25;
    ctx.strokeStyle = '#3b2a1a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    // Head
    ctx.fillStyle = '#f4c88c';
    ctx.beginPath();
    ctx.arc(px, py - 10, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Body
    ctx.beginPath();
    ctx.moveTo(px, py - 2);
    ctx.lineTo(px, py + 15);
    ctx.stroke();
    // Legs
    ctx.beginPath();
    ctx.moveTo(px, py + 15);
    ctx.lineTo(px - 6, py + 30);
    ctx.moveTo(px, py + 15);
    ctx.lineTo(px + 6, py + 30);
    ctx.stroke();

    // Danda (long stick)
    ctx.save();
    ctx.translate(this.danda.pivotX, this.danda.pivotY);
    ctx.rotate(this.dandaAngle);
    const grad = ctx.createLinearGradient(0, 0, this.danda.length, 0);
    grad.addColorStop(0, '#8B4513');
    grad.addColorStop(0.5, '#A0522D');
    grad.addColorStop(1, '#6b3410');
    ctx.fillStyle = grad;
    ctx.fillRect(0, -4, this.danda.length, 8);
    ctx.strokeStyle = '#4a2808';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, -4, this.danda.length, 8);
    ctx.restore();

    ctx.lineCap = 'butt';

    // Gilli (small stick)
    ctx.save();
    ctx.translate(this.gilli.x, this.gilli.y);
    ctx.rotate(this.gilli.rotation);
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-12, -3, 24, 6);
    ctx.strokeStyle = '#4a2808';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(-12, -3, 24, 6);
    // Tips
    ctx.fillStyle = '#6b3410';
    ctx.beginPath();
    ctx.moveTo(-12, -3);
    ctx.lineTo(-14, 0);
    ctx.lineTo(-12, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(12, -3);
    ctx.lineTo(14, 0);
    ctx.lineTo(12, 3);
    ctx.fill();
    ctx.restore();

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius || 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Floating texts
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = ft.life;
      ctx.fillStyle = ft.color;
      ctx.font = `bold ${this.width * 0.04}px Baloo 2, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.textAlign = 'start';
      ctx.globalAlpha = 1;
    }

    // Power bar while charging
    if (this.state === 'swinging' && this.charging) {
      const barX = 20;
      const barY = 20;
      const barW = this.width - 40;
      const barH = 14;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(barX, barY, barW, barH);
      const fill = this.swingPower / 100;
      const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      barGrad.addColorStop(0, '#43A047');
      barGrad.addColorStop(0.5, '#FF9933');
      barGrad.addColorStop(1, '#E53935');
      ctx.fillStyle = barGrad;
      ctx.fillRect(barX, barY, barW * fill, barH);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${this.width * 0.025}px Poppins, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Release to swing!', this.width / 2, barY + barH + 14);
      ctx.textAlign = 'start';
    }

    // Instructions
    if (this.state === 'ready') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold ${this.width * 0.06}px Baloo 2, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`Round ${this.round} / 5`, this.width / 2, this.height / 2 - 20);
      ctx.fillStyle = '#fff';
      ctx.font = `${this.width * 0.035}px Poppins, sans-serif`;
      ctx.fillText('Tap to flip the gilli', this.width / 2, this.height / 2 + 10);
      ctx.textAlign = 'start';
    }

    if (this.state === 'landed') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold ${this.width * 0.05}px Baloo 2, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.floor(this.gilli.distance)}m hit!`, this.width / 2, this.height / 2 - 15);
      ctx.fillStyle = '#fff';
      ctx.font = `${this.width * 0.03}px Poppins, sans-serif`;
      ctx.fillText('Tap for next round', this.width / 2, this.height / 2 + 20);
      ctx.textAlign = 'start';
    }

    if (this.state === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold ${this.width * 0.07}px Baloo 2, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Khel Khatam!', this.width / 2, this.height / 2 - 30);
      ctx.fillStyle = '#fff';
      ctx.font = `${this.width * 0.04}px Poppins, sans-serif`;
      ctx.fillText(`Total: ${Math.floor(this.totalDistance)}m`, this.width / 2, this.height / 2 + 5);
      ctx.fillText(`Best: ${Math.floor(this.bestDistance)}m`, this.width / 2, this.height / 2 + 30);
      ctx.fillStyle = '#FFD700';
      ctx.font = `${this.width * 0.03}px Poppins, sans-serif`;
      ctx.fillText('Tap to play again', this.width / 2, this.height / 2 + 60);
      ctx.textAlign = 'start';
    }
  },

  loop() {
    this.update();
    this.draw();
    this.animationId = requestAnimationFrame(() => this.loop());
  },

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.canvas.removeEventListener('mousedown', this._onDown);
    this.canvas.removeEventListener('mouseup', this._onUp);
    this.canvas.removeEventListener('touchstart', this._onDown);
    this.canvas.removeEventListener('touchend', this._onUp);
  },

  getControls() {
    return 'Tap to flip the gilli into the air. When it comes down, hold to charge swing power, release to hit! Time it perfectly for maximum distance.';
  }
};
