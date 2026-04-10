// Lattu (Top Spinning) - Spin the top and keep it going!
const LattuGame = {
  canvas: null, ctx: null, width: 400, height: 450, dpr: 1,
  top: null,
  state: 'winding',
  windPower: 0, windDirection: 1,
  spinSpeed: 0, rotation: 0, wobble: 0,
  score: 0, scoreTimer: 0,
  boosts: [], obstacles: [], boostTimer: 0,
  particles: [], floatingTexts: [], scuffMarks: [],
  animationId: null, onScoreUpdate: null, holding: false,

  init(container, onScoreUpdate) {
    this.onScoreUpdate = onScoreUpdate;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.min(400, window.innerWidth - 40);
    this.height = Math.round(this.width * 1.1);

    this.canvas = document.createElement('canvas');
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(this.dpr, this.dpr);

    this._handlers = {
      md: (e) => this.onDown(e),
      mu: (e) => this.onUp(e),
      mm: (e) => this.onMove(e),
      ts: (e) => { e.preventDefault(); this.onDown(e.touches[0]); },
      te: (e) => { e.preventDefault(); this.onUp(e.changedTouches[0]); },
      tm: (e) => { e.preventDefault(); this.onMove(e.touches[0]); }
    };
    this.canvas.addEventListener('mousedown', this._handlers.md);
    this.canvas.addEventListener('mouseup', this._handlers.mu);
    this.canvas.addEventListener('mousemove', this._handlers.mm);
    this.canvas.addEventListener('touchstart', this._handlers.ts, { passive: false });
    this.canvas.addEventListener('touchend', this._handlers.te, { passive: false });
    this.canvas.addEventListener('touchmove', this._handlers.tm, { passive: false });

    this.reset();
    this.loop();
  },

  reset() {
    this.state = 'winding';
    this.windPower = 0; this.windDirection = 1;
    this.spinSpeed = 0; this.rotation = 0; this.wobble = 0;
    this.score = 0; this.scoreTimer = 0;
    this.boosts = []; this.obstacles = []; this.boostTimer = 0;
    this.particles = []; this.floatingTexts = []; this.scuffMarks = [];
    this.holding = false;
    this.top = { x: this.width / 2, y: this.height / 2 + 30, vx: 0, vy: 0 };
    this.updateScore();
  },

  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.width / rect.width),
      y: (e.clientY - rect.top) * (this.height / rect.height)
    };
  },

  onDown() {
    this.holding = true;
    if (this.state === 'gameover') this.reset();
  },

  onUp() {
    this.holding = false;
    if (this.state === 'winding' && this.windPower > 20) {
      this.state = 'spinning';
      this.spinSpeed = this.windPower;
    }
  },

  onMove(e) {
    if (this.state === 'spinning' || this.state === 'slowing') {
      const pos = this.getCanvasPos(e);
      const dx = pos.x - this.top.x;
      const dy = pos.y - this.top.y;
      this.top.vx += dx * 0.008;
      this.top.vy += dy * 0.008;
    }
  },

  updateScore() {
    if (this.onScoreUpdate) {
      this.onScoreUpdate(`Score: ${this.score}  |  Spin: ${Math.round(this.spinSpeed)}%`);
    }
  },

  spawnParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1, decay: 0.03 + Math.random() * 0.03,
        radius: 1.5 + Math.random() * 2.5, color
      });
    }
  },

  addFloat(x, y, text, color) {
    this.floatingTexts.push({ x, y, text, color, life: 1, vy: -1.2 });
  },

  update() {
    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy; p.life -= p.decay;
      p.vx *= 0.97; p.vy *= 0.97;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy; ft.life -= 0.015;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
    // Scuff marks fade
    for (let i = this.scuffMarks.length - 1; i >= 0; i--) {
      this.scuffMarks[i].life -= 0.002;
      if (this.scuffMarks[i].life <= 0) this.scuffMarks.splice(i, 1);
    }

    if (this.state === 'winding') {
      if (this.holding) {
        this.windPower += this.windDirection * 1.8;
        if (this.windPower >= 100) this.windDirection = -1;
        if (this.windPower <= 0) this.windDirection = 1;
      }
      return;
    }

    if (this.state !== 'spinning' && this.state !== 'slowing') return;

    this.spinSpeed -= 0.07 + (100 - this.spinSpeed) * 0.001;
    this.rotation += this.spinSpeed * 0.05;
    this.wobble = Math.max(0, (60 - this.spinSpeed) * 0.025);

    this.top.x += Math.sin(this.rotation * 0.3) * this.wobble;
    this.top.y += Math.cos(this.rotation * 0.4) * this.wobble * 0.5;
    this.top.x += this.top.vx;
    this.top.y += this.top.vy;
    this.top.vx *= 0.95;
    this.top.vy *= 0.95;

    // Scuff marks
    if (this.spinSpeed > 5 && Math.random() < 0.15) {
      this.scuffMarks.push({ x: this.top.x, y: this.top.y + 25, life: 1 });
      if (this.scuffMarks.length > 50) this.scuffMarks.shift();
    }

    // Tip sparks
    if (this.spinSpeed > 30 && Math.random() < 0.2) {
      this.particles.push({
        x: this.top.x + (Math.random() - 0.5) * 4,
        y: this.top.y + 22,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 1.5,
        life: 1, decay: 0.06, radius: 1 + Math.random(), color: '#FFD700'
      });
    }

    const margin = 35;
    if (this.top.x < margin) { this.top.x = margin; this.top.vx *= -0.5; }
    if (this.top.x > this.width - margin) { this.top.x = this.width - margin; this.top.vx *= -0.5; }
    if (this.top.y < margin + 25) { this.top.y = margin + 25; this.top.vy *= -0.5; }
    if (this.top.y > this.height - margin) { this.top.y = this.height - margin; this.top.vy *= -0.5; }

    this.scoreTimer++;
    if (this.scoreTimer % 30 === 0) {
      this.score += Math.ceil(this.spinSpeed / 20);
      this.updateScore();
    }

    this.boostTimer++;
    if (this.boostTimer % 160 === 0) {
      this.boosts.push({
        x: 50 + Math.random() * (this.width - 100),
        y: 60 + Math.random() * (this.height - 120),
        type: Math.random() > 0.3 ? 'spin' : 'point',
        radius: this.width * 0.035, life: 280, phase: Math.random() * Math.PI * 2
      });
    }

    if (this.boostTimer % 220 === 0 && this.score > 15) {
      this.obstacles.push({
        x: 50 + Math.random() * (this.width - 100),
        y: 60 + Math.random() * (this.height - 120),
        radius: this.width * 0.04, life: 350, phase: Math.random() * Math.PI * 2
      });
    }

    for (let i = this.boosts.length - 1; i >= 0; i--) {
      const b = this.boosts[i];
      b.life--;
      if (b.life <= 0) { this.boosts.splice(i, 1); continue; }
      const dx = this.top.x - b.x;
      const dy = this.top.y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < b.radius + 16) {
        if (b.type === 'spin') {
          this.spinSpeed = Math.min(100, this.spinSpeed + 20);
          this.addFloat(b.x, b.y - 15, '+Spin!', '#43A047');
        } else {
          this.score += 25;
          this.addFloat(b.x, b.y - 15, '+25', '#FFD700');
        }
        this.spawnParticles(b.x, b.y, 8, b.type === 'spin' ? '#43A047' : '#FFD700');
        this.boosts.splice(i, 1);
        this.updateScore();
      }
    }

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.life--;
      if (o.life <= 0) { this.obstacles.splice(i, 1); continue; }
      const dx = this.top.x - o.x;
      const dy = this.top.y - o.y;
      if (Math.sqrt(dx * dx + dy * dy) < o.radius + 16) {
        this.spinSpeed = Math.max(0, this.spinSpeed - 25);
        this.spawnParticles(o.x, o.y, 10, '#E53935');
        this.addFloat(o.x, o.y - 15, '-Spin!', '#E53935');
        this.obstacles.splice(i, 1);
        this.updateScore();
      }
    }

    if (this.spinSpeed < 5) this.state = 'slowing';
    if (this.spinSpeed <= 0) {
      this.spinSpeed = 0;
      this.state = 'gameover';
      this.updateScore();
    }
  },

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Floor
    const floorGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    floorGrad.addColorStop(0, '#e0d4be');
    floorGrad.addColorStop(1, '#d4c5a9');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Tile pattern
    ctx.strokeStyle = 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 1;
    const tileSize = this.width * 0.1;
    for (let x = 0; x < this.width; x += tileSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.height); ctx.stroke();
    }
    for (let y = 0; y < this.height; y += tileSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y); ctx.stroke();
    }

    // Scuff marks
    for (const s of this.scuffMarks) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(120, 100, 70, ${s.life * 0.15})`;
      ctx.fill();
    }

    // Boosts
    const now = Date.now();
    for (const b of this.boosts) {
      const alpha = b.life < 50 ? b.life / 50 : 1;
      const pulse = 1 + Math.sin(now * 0.005 + b.phase) * 0.12;
      if (b.type === 'spin') {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(76, 175, 80, ${0.65 * alpha})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(56, 142, 60, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        // Glow
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(76, 175, 80, ${0.1 * alpha})`;
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.font = `bold ${b.radius * 0.9}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('+', b.x, b.y);
      } else {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 193, 7, ${0.65 * alpha})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 160, 0, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.font = `bold ${b.radius * 0.65}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('25', b.x, b.y);
      }
    }

    // Obstacles
    for (const o of this.obstacles) {
      const alpha = o.life < 50 ? o.life / 50 : 1;
      const pulse = 1 + Math.sin(now * 0.006 + o.phase) * 0.1;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.radius * pulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(244, 67, 54, ${0.45 * alpha})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(211, 47, 47, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.font = `bold ${o.radius * 0.8}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('x', o.x, o.y);
    }
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';

    if (this.state === 'winding') {
      this.drawWindingScreen(ctx);
      return;
    }

    // Shadow
    const shadowScale = this.spinSpeed > 5 ? 1 : 1 + (5 - this.spinSpeed) * 0.2;
    ctx.beginPath();
    ctx.ellipse(this.top.x + 2, this.top.y + 28, 16 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fill();

    // Speed lines when fast
    if (this.spinSpeed > 60) {
      const lineAlpha = (this.spinSpeed - 60) / 200;
      for (let i = 0; i < 6; i++) {
        const angle = this.rotation * 0.2 + (i / 6) * Math.PI * 2;
        const r = 25;
        ctx.beginPath();
        ctx.moveTo(this.top.x + Math.cos(angle) * r, this.top.y - 5 + Math.sin(angle) * r * 0.4);
        ctx.lineTo(this.top.x + Math.cos(angle) * (r + 12), this.top.y - 5 + Math.sin(angle) * (r + 12) * 0.4);
        ctx.strokeStyle = `rgba(255, 193, 7, ${lineAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // The lattu
    this.drawLattu(this.top.x, this.top.y, this.rotation, this.spinSpeed > 5);

    // Spin energy bar
    if (this.state === 'spinning' || this.state === 'slowing') {
      const barX = 15;
      const barY = 12;
      const barW = this.width - 30;
      const barH = 10;

      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 5); ctx.fill();

      const fill = this.spinSpeed / 100;
      const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      barGrad.addColorStop(0, '#E53935');
      barGrad.addColorStop(0.35, '#FF9933');
      barGrad.addColorStop(0.7, '#43A047');
      barGrad.addColorStop(1, '#43A047');
      ctx.fillStyle = barGrad;
      ctx.beginPath(); ctx.roundRect(barX, barY, barW * fill, barH, 5); ctx.fill();

      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 5); ctx.stroke();

      ctx.fillStyle = '#5a4a2a';
      ctx.font = `${this.width * 0.025}px Poppins, sans-serif`;
      ctx.fillText('Spin Energy', barX, barY - 3);
    }

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
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
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'start';

    // Game over
    if (this.state === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold ${this.width * 0.08}px Baloo 2, sans-serif`;
      ctx.fillText('Lattu Gir Gaya!', this.width / 2, this.height / 2 - 20);
      ctx.fillStyle = '#fff';
      ctx.font = `${this.width * 0.045}px Poppins, sans-serif`;
      ctx.fillText(`Score: ${this.score}`, this.width / 2, this.height / 2 + 15);
      ctx.fillStyle = '#ffcc00';
      ctx.font = `${this.width * 0.035}px Poppins, sans-serif`;
      ctx.fillText('Tap to play again', this.width / 2, this.height / 2 + 50);
      ctx.textAlign = 'start';
    }
  },

  drawWindingScreen(ctx) {
    // Title
    ctx.fillStyle = '#E65100';
    ctx.font = `bold ${this.width * 0.05}px Baloo 2, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Hold to wind up the Lattu!', this.width / 2, this.height * 0.15);

    // Arc power gauge
    const cx = this.width / 2;
    const cy = this.height * 0.42;
    const r = this.width * 0.18;
    const startAngle = Math.PI * 0.8;
    const endAngle = Math.PI * 2.2;
    const fillAngle = startAngle + (endAngle - startAngle) * (this.windPower / 100);

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = this.width * 0.04;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Filled arc
    if (this.windPower > 0) {
      const arcGrad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      arcGrad.addColorStop(0, '#43A047');
      arcGrad.addColorStop(0.5, '#FF9933');
      arcGrad.addColorStop(1, '#E53935');
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, fillAngle);
      ctx.strokeStyle = arcGrad;
      ctx.lineWidth = this.width * 0.04;
      ctx.stroke();

      // Glow at tip
      const tipX = cx + Math.cos(fillAngle) * r;
      const tipY = cy + Math.sin(fillAngle) * r;
      ctx.beginPath();
      ctx.arc(tipX, tipY, this.width * 0.03, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 153, 51, 0.4)';
      ctx.fill();
    }
    ctx.lineCap = 'butt';

    // Power text
    ctx.fillStyle = '#3B2F1E';
    ctx.font = `bold ${this.width * 0.08}px Baloo 2, sans-serif`;
    ctx.fillText(`${Math.round(this.windPower)}%`, cx, cy + this.width * 0.03);

    ctx.font = `${this.width * 0.033}px Poppins, sans-serif`;
    ctx.fillStyle = '#8B7355';
    ctx.fillText('Release to spin!', cx, cy + r + this.width * 0.08);

    // Lattu preview
    this.drawLattu(cx, this.height * 0.75, 0, false);
    ctx.textAlign = 'start';
  },

  drawLattu(x, y, rot, spinning) {
    const ctx = this.ctx;
    const scale = this.width / 400;
    ctx.save();
    ctx.translate(x, y);

    if (spinning) {
      ctx.rotate(Math.sin(rot * 0.1) * this.wobble * 0.3);
    }

    const bodyH = 40 * scale;
    const bodyW = 28 * scale;
    const stripeColors = ['#E53935', '#1E88E5', '#FDD835', '#43A047', '#FF8F00', '#8E24AA'];

    // Body shape
    ctx.beginPath();
    ctx.moveTo(-bodyW, -5 * scale);
    ctx.quadraticCurveTo(-bodyW - 2 * scale, -20 * scale, 0, -25 * scale);
    ctx.quadraticCurveTo(bodyW + 2 * scale, -20 * scale, bodyW, -5 * scale);
    ctx.lineTo(3 * scale, bodyH);
    ctx.lineTo(-3 * scale, bodyH);
    ctx.closePath();
    ctx.fillStyle = '#D32F2F';
    ctx.fill();
    ctx.strokeStyle = '#B71C1C';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Color stripes
    if (spinning && this.spinSpeed > 30) {
      // Blur disc effect at high speed
      for (let i = 0; i < 5; i++) {
        const stripeY = (-18 + i * 10) * scale;
        const w = bodyW * (1 - (stripeY / scale + 18) / 58) * 0.9;
        if (w <= 0) continue;
        const ci = (i + Math.floor(rot * 0.5)) % stripeColors.length;
        ctx.fillStyle = stripeColors[ci];
        ctx.globalAlpha = 0.7;
        ctx.fillRect(-w, stripeY, w * 2, 7 * scale);
        ctx.globalAlpha = 1;
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const stripeY = (-18 + i * 10) * scale;
        const w = bodyW * (1 - (stripeY / scale + 18) / 58) * 0.9;
        if (w <= 0) continue;
        ctx.fillStyle = stripeColors[i % stripeColors.length];
        ctx.fillRect(-w, stripeY, w * 2, 7 * scale);
      }
    }

    // Metal tip
    ctx.beginPath();
    ctx.moveTo(-3 * scale, bodyH);
    ctx.lineTo(0, bodyH + 10 * scale);
    ctx.lineTo(3 * scale, bodyH);
    const tipGrad = ctx.createLinearGradient(-3 * scale, bodyH, 3 * scale, bodyH);
    tipGrad.addColorStop(0, '#999');
    tipGrad.addColorStop(0.5, '#ddd');
    tipGrad.addColorStop(1, '#888');
    ctx.fillStyle = tipGrad;
    ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Dome highlight
    ctx.beginPath();
    ctx.ellipse(0, -22 * scale, bodyW * 0.5, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();

    // Top nub
    ctx.beginPath();
    ctx.arc(0, -26 * scale, 5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#FDD835';
    ctx.fill();
    ctx.strokeStyle = '#F9A825';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Body highlight
    ctx.beginPath();
    ctx.ellipse(-bodyW * 0.4, -8 * scale, bodyW * 0.15, bodyH * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();

    ctx.restore();
  },

  loop() {
    this.update();
    this.draw();
    this.animationId = requestAnimationFrame(() => this.loop());
  },

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.canvas.removeEventListener('mousedown', this._handlers.md);
    this.canvas.removeEventListener('mouseup', this._handlers.mu);
    this.canvas.removeEventListener('mousemove', this._handlers.mm);
    this.canvas.removeEventListener('touchstart', this._handlers.ts);
    this.canvas.removeEventListener('touchend', this._handlers.te);
    this.canvas.removeEventListener('touchmove', this._handlers.tm);
  },

  getControls() {
    return 'Hold to wind up power, release to spin! Drag to nudge the lattu. Collect green boosts for spin energy, gold for points. Avoid red obstacles!';
  }
};
