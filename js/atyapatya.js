// Atya Patya - Navigate through zones avoiding defenders
const AtyaPatyaGame = {
  canvas: null, ctx: null, width: 400, height: 500, dpr: 1,
  state: 'ready', // ready, playing, caught, won, gameover
  player: null,
  defenders: [],
  zones: [], // horizontal bands
  score: 0, level: 1, lives: 3,
  animationId: null, onScoreUpdate: null,
  particles: [], floatingTexts: [],
  goalY: 0,

  init(container, onScoreUpdate) {
    this.onScoreUpdate = onScoreUpdate;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.min(400, window.innerWidth - 40);
    this.height = Math.round(this.width * 1.3);

    this.canvas = document.createElement('canvas');
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(this.dpr, this.dpr);

    this._onDown = (e) => { e.preventDefault(); this.handleDown(e.touches ? e.touches[0] : e); };
    this._onMove = (e) => { e.preventDefault(); this.handleMove(e.touches ? e.touches[0] : e); };
    this.canvas.addEventListener('mousedown', this._onDown);
    this.canvas.addEventListener('mousemove', this._onMove);
    this.canvas.addEventListener('touchstart', this._onDown, { passive: false });
    this.canvas.addEventListener('touchmove', this._onMove, { passive: false });

    this.reset();
    this.loop();
  },

  reset() {
    this.state = 'ready';
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.particles = [];
    this.floatingTexts = [];
    this.setupLevel();
  },

  setupLevel() {
    this.state = 'ready';
    // 5 zones (lines), player must cross all
    const numZones = 5;
    const zoneH = (this.height * 0.8) / numZones;
    this.zones = [];
    for (let i = 0; i < numZones; i++) {
      this.zones.push({
        y: this.height * 0.1 + i * zoneH,
        height: zoneH,
        crossed: false
      });
    }
    this.goalY = this.height * 0.1;

    this.player = {
      x: this.width / 2,
      y: this.height - 50,
      radius: this.width * 0.035,
      targetX: this.width / 2,
      targetY: this.height - 50
    };

    // Defenders patrol horizontally in each zone
    this.defenders = [];
    const defenderSpeed = 1.5 + this.level * 0.4;
    for (let i = 0; i < numZones; i++) {
      const zone = this.zones[i];
      this.defenders.push({
        x: (i % 2 === 0) ? 50 : this.width - 50,
        y: zone.y + zone.height / 2,
        vx: (i % 2 === 0) ? defenderSpeed : -defenderSpeed,
        radius: this.width * 0.04,
        zoneIdx: i
      });
      // Add extra defender on higher levels
      if (this.level >= 2 && i % 2 === 1) {
        this.defenders.push({
          x: this.width / 2,
          y: zone.y + zone.height / 2,
          vx: defenderSpeed * 0.8,
          radius: this.width * 0.04,
          zoneIdx: i
        });
      }
    }

    this.updateScore();
  },

  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (this.width / rect.width), y: (e.clientY - rect.top) * (this.height / rect.height) };
  },

  handleDown(e) {
    if (this.state === 'ready') {
      this.state = 'playing';
      Sounds.pop();
      return;
    }
    if (this.state === 'caught') {
      if (this.lives > 0) {
        this.state = 'playing';
        this.player.x = this.width / 2;
        this.player.y = this.height - 50;
        this.player.targetX = this.player.x;
        this.player.targetY = this.player.y;
        for (const z of this.zones) z.crossed = false;
      } else {
        this.state = 'gameover';
      }
      return;
    }
    if (this.state === 'won') {
      this.level++;
      this.setupLevel();
      Sounds.success();
      return;
    }
    if (this.state === 'gameover') {
      this.reset();
      return;
    }
    if (this.state === 'playing') {
      const pos = this.getCanvasPos(e);
      this.player.targetX = pos.x;
      this.player.targetY = pos.y;
    }
  },

  handleMove(e) {
    if (this.state !== 'playing') return;
    const pos = this.getCanvasPos(e);
    this.player.targetX = pos.x;
    this.player.targetY = pos.y;
  },

  updateScore() {
    if (this.onScoreUpdate) {
      this.onScoreUpdate(`Level ${this.level}  |  Score: ${this.score}  |  ${'❤'.repeat(this.lives)}`);
    }
  },

  addFloat(x, y, text, color) {
    this.floatingTexts.push({ x, y, text, color, life: 1, vy: -1.5 });
  },

  update() {
    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy; p.life -= p.decay;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy; ft.life -= 0.015;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    if (this.state !== 'playing') return;

    // Smoothly move player to target
    this.player.x += (this.player.targetX - this.player.x) * 0.2;
    this.player.y += (this.player.targetY - this.player.y) * 0.2;
    this.player.x = Math.max(this.player.radius, Math.min(this.width - this.player.radius, this.player.x));
    this.player.y = Math.max(this.player.radius, Math.min(this.height - this.player.radius, this.player.y));

    // Update defenders
    for (const d of this.defenders) {
      d.x += d.vx;
      if (d.x < d.radius || d.x > this.width - d.radius) d.vx *= -1;

      // Collision with player
      const dx = d.x - this.player.x;
      const dy = d.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < d.radius + this.player.radius) {
        this.lives--;
        Sounds.tag();
        this.addFloat(this.player.x, this.player.y - 20, 'Out!', '#E53935');
        for (let k = 0; k < 12; k++) {
          const a = Math.random() * Math.PI * 2;
          this.particles.push({
            x: this.player.x, y: this.player.y,
            vx: Math.cos(a) * 3, vy: Math.sin(a) * 3,
            life: 1, decay: 0.03,
            radius: 2, color: '#E53935'
          });
        }
        this.state = 'caught';
        this.updateScore();
        return;
      }
    }

    // Check zone crossing
    for (const z of this.zones) {
      if (!z.crossed && this.player.y < z.y + z.height / 2) {
        z.crossed = true;
        this.score += 10;
        Sounds.boost();
        this.addFloat(this.player.x, this.player.y - 15, '+10', '#43A047');
        this.updateScore();
      }
    }

    // Reached goal
    if (this.player.y < this.goalY) {
      this.score += 50 * this.level;
      this.state = 'won';
      Sounds.success();
      this.addFloat(this.width / 2, this.height / 2, 'Jeet Gaye!', '#FFD700');
      this.updateScore();
    }
  },

  draw() {
    const ctx = this.ctx;

    // Ground
    const bg = ctx.createLinearGradient(0, 0, 0, this.height);
    bg.addColorStop(0, '#d4b880');
    bg.addColorStop(1, '#c49860');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.width, this.height);

    // Goal zone
    ctx.fillStyle = 'rgba(67, 160, 71, 0.25)';
    ctx.fillRect(0, 0, this.width, this.goalY);
    ctx.strokeStyle = 'rgba(67, 160, 71, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(0, this.goalY);
    ctx.lineTo(this.width, this.goalY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(67, 160, 71, 0.8)';
    ctx.font = `bold ${this.width * 0.035}px Baloo 2, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('GOAL', this.width / 2, this.goalY - 10);

    // Start zone
    ctx.fillStyle = 'rgba(255, 152, 0, 0.15)';
    ctx.fillRect(0, this.height - 60, this.width, 60);
    ctx.fillStyle = 'rgba(255, 152, 0, 0.8)';
    ctx.fillText('START', this.width / 2, this.height - 20);
    ctx.textAlign = 'start';

    // Zone lines
    for (const z of this.zones) {
      ctx.strokeStyle = z.crossed ? 'rgba(67, 160, 71, 0.4)' : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, z.y);
      ctx.lineTo(this.width, z.y);
      ctx.stroke();
    }

    // Defenders
    for (const d of this.defenders) {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(d.x + 2, d.y + 4, d.radius * 0.9, d.radius * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = '#C62828';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7F0000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Face
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(d.x - d.radius * 0.25, d.y - d.radius * 0.15, d.radius * 0.15, 0, Math.PI * 2);
      ctx.arc(d.x + d.radius * 0.25, d.y - d.radius * 0.15, d.radius * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(d.x - d.radius * 0.25 + (d.vx > 0 ? 1 : -1), d.y - d.radius * 0.15, d.radius * 0.08, 0, Math.PI * 2);
      ctx.arc(d.x + d.radius * 0.25 + (d.vx > 0 ? 1 : -1), d.y - d.radius * 0.15, d.radius * 0.08, 0, Math.PI * 2);
      ctx.fill();

      // Motion indicator
      ctx.strokeStyle = 'rgba(198, 40, 40, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(d.x - d.vx * 8, d.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }

    // Player
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(this.player.x + 2, this.player.y + 4, this.player.radius, this.player.radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body
    const pgrad = ctx.createRadialGradient(this.player.x - 2, this.player.y - 3, 1, this.player.x, this.player.y, this.player.radius);
    pgrad.addColorStop(0, '#FFB74D');
    pgrad.addColorStop(1, '#E65100');
    ctx.fillStyle = pgrad;
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y, this.player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#BF360C';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Face
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.player.x - 3, this.player.y - 2, 2, 0, Math.PI * 2);
    ctx.arc(this.player.x + 3, this.player.y - 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(this.player.x - 3, this.player.y - 2, 1, 0, Math.PI * 2);
    ctx.arc(this.player.x + 3, this.player.y - 2, 1, 0, Math.PI * 2);
    ctx.fill();

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

    // State overlays
    if (this.state === 'ready') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold ${this.width * 0.07}px Baloo 2, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`Level ${this.level}`, this.width / 2, this.height / 2 - 20);
      ctx.fillStyle = '#fff';
      ctx.font = `${this.width * 0.035}px Poppins, sans-serif`;
      ctx.fillText('Drag to move. Reach the goal!', this.width / 2, this.height / 2 + 15);
      ctx.fillText('Tap to start', this.width / 2, this.height / 2 + 40);
      ctx.textAlign = 'start';
    }

    if (this.state === 'caught') {
      ctx.fillStyle = 'rgba(198, 40, 40, 0.3)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${this.width * 0.06}px Baloo 2, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Pakda Gaya!', this.width / 2, this.height / 2);
      ctx.font = `${this.width * 0.03}px Poppins, sans-serif`;
      ctx.fillText(this.lives > 0 ? 'Tap to retry' : 'Game Over', this.width / 2, this.height / 2 + 30);
      ctx.textAlign = 'start';
    }

    if (this.state === 'won') {
      ctx.fillStyle = 'rgba(67, 160, 71, 0.3)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold ${this.width * 0.07}px Baloo 2, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Shabaash!', this.width / 2, this.height / 2 - 20);
      ctx.fillStyle = '#fff';
      ctx.font = `${this.width * 0.035}px Poppins, sans-serif`;
      ctx.fillText('Tap for next level', this.width / 2, this.height / 2 + 20);
      ctx.textAlign = 'start';
    }

    if (this.state === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#FF6B00';
      ctx.font = `bold ${this.width * 0.08}px Baloo 2, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', this.width / 2, this.height / 2 - 20);
      ctx.fillStyle = '#fff';
      ctx.font = `${this.width * 0.04}px Poppins, sans-serif`;
      ctx.fillText(`Score: ${this.score}`, this.width / 2, this.height / 2 + 15);
      ctx.fillStyle = '#FFD700';
      ctx.font = `${this.width * 0.03}px Poppins, sans-serif`;
      ctx.fillText('Tap to play again', this.width / 2, this.height / 2 + 45);
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
    this.canvas.removeEventListener('mousemove', this._onMove);
    this.canvas.removeEventListener('touchstart', this._onDown);
    this.canvas.removeEventListener('touchmove', this._onMove);
  },

  getControls() {
    return 'Drag your player through the zones to reach the goal at the top. Avoid the patrolling defenders at all costs!';
  }
};
