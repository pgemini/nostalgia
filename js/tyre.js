// Tyre Rolling (Taayra) - Endless runner, India ka subway surfer
const TyreGame = {
  canvas: null, ctx: null, width: 400, height: 500, dpr: 1,
  state: 'ready', // ready, playing, gameover
  tyre: null,
  lanes: [], lane: 1, // 0=left, 1=center, 2=right
  obstacles: [], coins: [], clouds: [],
  speed: 4, distance: 0, coinsCollected: 0,
  scrollOffset: 0, spawnTimer: 0,
  particles: [], animationId: null, onScoreUpdate: null,
  tyreRotation: 0, shakeAmount: 0,

  init(container, onScoreUpdate) {
    this.onScoreUpdate = onScoreUpdate;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.min(380, window.innerWidth - 40);
    this.height = Math.round(this.width * 1.4);

    this.canvas = document.createElement('canvas');
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(this.dpr, this.dpr);

    this.lanes = [this.width * 0.25, this.width * 0.5, this.width * 0.75];

    this._onTap = (e) => { e.preventDefault(); this.handleTap(e.touches ? e.touches[0] : e); };
    this._onKey = (e) => this.handleKey(e);
    this.canvas.addEventListener('mousedown', this._onTap);
    this.canvas.addEventListener('touchstart', this._onTap, { passive: false });
    document.addEventListener('keydown', this._onKey);

    for (let i = 0; i < 4; i++) {
      this.clouds.push({
        x: Math.random() * this.width,
        y: 20 + Math.random() * 60,
        size: 20 + Math.random() * 25,
        speed: 0.2 + Math.random() * 0.3
      });
    }

    this.reset();
    this.loop();
  },

  reset() {
    this.state = 'ready';
    this.tyre = { x: this.lanes[1], y: this.height - 100, radius: this.width * 0.06, yVel: 0, jumping: false };
    this.lane = 1;
    this.obstacles = [];
    this.coins = [];
    this.particles = [];
    this.speed = 4;
    this.distance = 0;
    this.coinsCollected = 0;
    this.scrollOffset = 0;
    this.spawnTimer = 0;
    this.tyreRotation = 0;
    this.shakeAmount = 0;
    this.updateScore();
  },

  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (this.width / rect.width), y: (e.clientY - rect.top) * (this.height / rect.height) };
  },

  handleTap(e) {
    if (this.state === 'ready') { this.state = 'playing'; Sounds.whoosh(); return; }
    if (this.state === 'gameover') { this.reset(); return; }
    const pos = this.getCanvasPos(e);
    // Tap top half = jump, left third = move left, right third = move right
    if (pos.y < this.height * 0.5) {
      if (!this.tyre.jumping) { this.tyre.yVel = -11; this.tyre.jumping = true; Sounds.jump(); }
    } else if (pos.x < this.width / 3) {
      if (this.lane > 0) { this.lane--; Sounds.click(); }
    } else if (pos.x > (this.width * 2) / 3) {
      if (this.lane < 2) { this.lane++; Sounds.click(); }
    } else {
      if (!this.tyre.jumping) { this.tyre.yVel = -11; this.tyre.jumping = true; Sounds.jump(); }
    }
  },

  handleKey(e) {
    if (this.state !== 'playing') {
      if (e.key === ' ' || e.key === 'Enter') {
        if (this.state === 'ready') this.state = 'playing';
        else if (this.state === 'gameover') this.reset();
      }
      return;
    }
    if (e.key === 'ArrowLeft' && this.lane > 0) { this.lane--; Sounds.click(); }
    if (e.key === 'ArrowRight' && this.lane < 2) { this.lane++; Sounds.click(); }
    if ((e.key === 'ArrowUp' || e.key === ' ') && !this.tyre.jumping) {
      this.tyre.yVel = -11; this.tyre.jumping = true; Sounds.jump();
    }
  },

  updateScore() {
    if (this.onScoreUpdate) {
      this.onScoreUpdate(`Dist: ${Math.floor(this.distance)}m  |  Coins: ${this.coinsCollected}`);
    }
  },

  spawnObstacle() {
    const types = ['rock', 'puddle', 'pothole'];
    const type = types[Math.floor(Math.random() * types.length)];
    const lane = Math.floor(Math.random() * 3);
    this.obstacles.push({ x: this.lanes[lane], y: -30, lane, type, size: this.width * 0.08 });
  },

  spawnCoin() {
    const lane = Math.floor(Math.random() * 3);
    this.coins.push({ x: this.lanes[lane], y: -30, lane, size: this.width * 0.03, rot: 0 });
  },

  update() {
    // Update clouds
    for (const c of this.clouds) {
      c.x -= c.speed;
      if (c.x < -c.size * 2) { c.x = this.width + c.size; c.y = 20 + Math.random() * 60; }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy; p.life -= p.decay;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    this.shakeAmount *= 0.85;
    if (this.state !== 'playing') return;

    this.scrollOffset += this.speed;
    this.distance += this.speed * 0.1;
    this.speed = Math.min(10, 4 + this.distance * 0.005);
    this.tyreRotation += this.speed * 0.05;

    // Smooth lane transition
    const targetX = this.lanes[this.lane];
    this.tyre.x += (targetX - this.tyre.x) * 0.25;

    // Gravity / jumping
    if (this.tyre.jumping) {
      this.tyre.y += this.tyre.yVel;
      this.tyre.yVel += 0.6;
      if (this.tyre.y >= this.height - 100) {
        this.tyre.y = this.height - 100;
        this.tyre.jumping = false;
        this.tyre.yVel = 0;
        Sounds.land();
        for (let i = 0; i < 6; i++) {
          this.particles.push({
            x: this.tyre.x + (Math.random() - 0.5) * 20,
            y: this.tyre.y + this.tyre.radius,
            vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2,
            life: 1, decay: 0.04, color: 'rgba(180,160,120,0.6)'
          });
        }
      }
    }

    // Spawn
    this.spawnTimer++;
    const spawnRate = Math.max(30, 80 - this.distance * 0.1);
    if (this.spawnTimer > spawnRate) {
      this.spawnTimer = 0;
      if (Math.random() > 0.3) this.spawnObstacle();
      if (Math.random() > 0.4) this.spawnCoin();
    }

    // Move obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.y += this.speed;
      if (o.y > this.height + 50) { this.obstacles.splice(i, 1); continue; }

      // Collision
      const dx = Math.abs(o.x - this.tyre.x);
      const dy = Math.abs(o.y - this.tyre.y);
      if (dx < this.tyre.radius + o.size / 2 && dy < this.tyre.radius + o.size / 2) {
        if (!this.tyre.jumping || o.type === 'rock') {
          this.state = 'gameover';
          this.shakeAmount = 10;
          Sounds.fail();
          for (let k = 0; k < 15; k++) {
            this.particles.push({
              x: this.tyre.x, y: this.tyre.y,
              vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6 - 2,
              life: 1, decay: 0.02, color: '#e53935'
            });
          }
        }
      }
    }

    // Move coins
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.y += this.speed;
      c.rot += 0.1;
      if (c.y > this.height + 50) { this.coins.splice(i, 1); continue; }
      const dx = Math.abs(c.x - this.tyre.x);
      const dy = Math.abs(c.y - this.tyre.y);
      if (dx < this.tyre.radius + c.size && dy < this.tyre.radius + c.size) {
        this.coinsCollected++;
        this.coins.splice(i, 1);
        Sounds.coin();
      }
    }

    this.updateScore();
  },

  draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shakeAmount > 0.5) ctx.translate((Math.random() - 0.5) * this.shakeAmount, (Math.random() - 0.5) * this.shakeAmount);

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, this.height);
    sky.addColorStop(0, '#87CEEB');
    sky.addColorStop(0.5, '#FFB86B');
    sky.addColorStop(1, '#E8A062');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.width, this.height);

    // Clouds
    for (const c of this.clouds) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.size * 0.6, 0, Math.PI * 2);
      ctx.arc(c.x + c.size * 0.4, c.y, c.size * 0.5, 0, Math.PI * 2);
      ctx.arc(c.x - c.size * 0.4, c.y, c.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sun
    ctx.fillStyle = 'rgba(255, 220, 100, 0.5)';
    ctx.beginPath();
    ctx.arc(this.width - 40, 60, 30, 0, Math.PI * 2);
    ctx.fill();

    // Road (perspective)
    ctx.fillStyle = '#8B6B3D';
    ctx.beginPath();
    ctx.moveTo(this.width * 0.2, this.height * 0.35);
    ctx.lineTo(this.width * 0.8, this.height * 0.35);
    ctx.lineTo(this.width, this.height);
    ctx.lineTo(0, this.height);
    ctx.closePath();
    ctx.fill();

    // Lane dividers
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([15, 15]);
    ctx.lineDashOffset = -this.scrollOffset;
    for (let l = 1; l < 3; l++) {
      ctx.beginPath();
      const topX = this.width * 0.2 + (this.width * 0.6) * (l / 3);
      const botX = (this.width) * (l / 3);
      ctx.moveTo(topX, this.height * 0.35);
      ctx.lineTo(botX, this.height);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // Coins
    for (const c of this.coins) {
      const scale = Math.abs(Math.cos(c.rot));
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.size * scale + 2, c.size + 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#B8860B';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#F9A825';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.size * scale, c.size, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Obstacles
    for (const o of this.obstacles) {
      if (o.type === 'rock') {
        ctx.fillStyle = '#6b6b6b';
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(o.x - 4, o.y - 4, o.size / 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (o.type === 'puddle') {
        ctx.fillStyle = 'rgba(80, 120, 180, 0.7)';
        ctx.beginPath();
        ctx.ellipse(o.x, o.y, o.size / 2 + 4, o.size / 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#3b2a1a';
        ctx.beginPath();
        ctx.ellipse(o.x, o.y, o.size / 2, o.size / 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Tyre
    const t = this.tyre;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(t.x, this.height - 90, t.radius * 1.1, t.radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(this.tyreRotation);
    // Outer tire
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
    ctx.fill();
    // Tread
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * t.radius * 0.7, Math.sin(a) * t.radius * 0.7);
      ctx.lineTo(Math.cos(a) * t.radius, Math.sin(a) * t.radius);
      ctx.stroke();
    }
    // Inner hub
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(0, 0, t.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(0, 0, t.radius * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Ready screen
    if (this.state === 'ready') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold ${this.width * 0.07}px Baloo 2, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Taayra Daudao!', this.width / 2, this.height / 2 - 20);
      ctx.fillStyle = '#fff';
      ctx.font = `${this.width * 0.04}px Poppins, sans-serif`;
      ctx.fillText('Tap to start', this.width / 2, this.height / 2 + 15);
      ctx.font = `${this.width * 0.03}px Poppins, sans-serif`;
      ctx.fillText('Tap L/R to steer, top to jump', this.width / 2, this.height / 2 + 40);
      ctx.textAlign = 'start';
    }

    // Game over
    if (this.state === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#FF6B00';
      ctx.font = `bold ${this.width * 0.08}px Baloo 2, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Ouch!', this.width / 2, this.height / 2 - 30);
      ctx.fillStyle = '#fff';
      ctx.font = `${this.width * 0.045}px Poppins, sans-serif`;
      ctx.fillText(`${Math.floor(this.distance)}m  |  ${this.coinsCollected} coins`, this.width / 2, this.height / 2 + 10);
      ctx.fillStyle = '#FFD700';
      ctx.font = `${this.width * 0.035}px Poppins, sans-serif`;
      ctx.fillText('Tap to try again', this.width / 2, this.height / 2 + 45);
      ctx.textAlign = 'start';
    }

    ctx.restore();
  },

  loop() {
    this.update();
    this.draw();
    this.animationId = requestAnimationFrame(() => this.loop());
  },

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    document.removeEventListener('keydown', this._onKey);
    this.canvas.removeEventListener('mousedown', this._onTap);
    this.canvas.removeEventListener('touchstart', this._onTap);
  },

  getControls() {
    return 'Tap top of screen to jump over rocks/puddles. Tap left/right sides to switch lanes. Collect coins and avoid obstacles!';
  }
};
