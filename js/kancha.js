// Kancha (Marbles) - Aim and flick your marble to knock others out of the circle
const KanchaGame = {
  canvas: null,
  ctx: null,
  width: 400,
  height: 500,
  dpr: 1,
  marbles: [],
  player: null,
  aiming: false,
  aimStart: null,
  aimEnd: null,
  circleRadius: 120,
  circleCenter: { x: 200, y: 200 },
  score: 0,
  shots: 10,
  shotsLeft: 10,
  state: 'aiming',
  animationId: null,
  friction: 0.984,
  onScoreUpdate: null,
  particles: [],
  floatingTexts: [],
  shakeAmount: 0,
  dirtSpots: [],
  restartHandler: null,

  init(container, onScoreUpdate) {
    this.onScoreUpdate = onScoreUpdate;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.min(400, window.innerWidth - 40);
    this.height = Math.round(this.width * 1.25);
    this.circleRadius = this.width * 0.3;
    this.circleCenter = { x: this.width / 2, y: this.height * 0.38 };

    this.canvas = document.createElement('canvas');
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(this.dpr, this.dpr);

    this._onDown = (e) => this.onPointerDown(e);
    this._onMove = (e) => this.onPointerMove(e);
    this._onUp = (e) => this.onPointerUp(e);
    this._onTouchDown = (e) => { e.preventDefault(); this.onPointerDown(e.touches[0]); };
    this._onTouchMove = (e) => { e.preventDefault(); this.onPointerMove(e.touches[0]); };
    this._onTouchUp = (e) => { e.preventDefault(); this.onPointerUp(e.changedTouches[0]); };

    this.canvas.addEventListener('mousedown', this._onDown);
    this.canvas.addEventListener('mousemove', this._onMove);
    this.canvas.addEventListener('mouseup', this._onUp);
    this.canvas.addEventListener('touchstart', this._onTouchDown, { passive: false });
    this.canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this._onTouchUp, { passive: false });

    // Pre-generate dirt texture spots
    this.dirtSpots = [];
    for (let i = 0; i < 80; i++) {
      this.dirtSpots.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        r: 0.5 + Math.random() * 2.5,
        a: 0.05 + Math.random() * 0.15
      });
    }

    this.reset();
    this.loop();
  },

  reset() {
    this.score = 0;
    this.shotsLeft = this.shots;
    this.state = 'aiming';
    this.marbles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.shakeAmount = 0;

    if (this.restartHandler) {
      this.canvas.removeEventListener('click', this.restartHandler);
      this.canvas.removeEventListener('touchstart', this.restartHandler);
      this.restartHandler = null;
    }

    const colors = [
      '#E53935', '#1E88E5', '#43A047', '#FDD835',
      '#8E24AA', '#FF8F00', '#00ACC1', '#D81B60'
    ];
    const cr = this.circleRadius;
    const cc = this.circleCenter;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
      const r = cr * 0.2 + Math.random() * cr * 0.45;
      this.marbles.push({
        x: cc.x + Math.cos(angle) * r,
        y: cc.y + Math.sin(angle) * r,
        vx: 0, vy: 0,
        radius: this.width * 0.03,
        color: colors[i],
        active: true,
        trail: []
      });
    }

    this.player = {
      x: this.width / 2,
      y: this.height - this.width * 0.12,
      vx: 0, vy: 0,
      radius: this.width * 0.035,
      color: '#FF6D00',
      active: true,
      trail: []
    };

    this.updateScore();
  },

  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.width / rect.width),
      y: (e.clientY - rect.top) * (this.height / rect.height)
    };
  },

  onPointerDown(e) {
    if (this.state === 'gameover') return;
    if (this.state !== 'aiming') return;
    const pos = this.getCanvasPos(e);
    // Allow starting aim from anywhere near bottom half
    const dx = pos.x - this.player.x;
    const dy = pos.y - this.player.y;
    if (Math.sqrt(dx * dx + dy * dy) < this.width * 0.15) {
      this.aiming = true;
      this.aimStart = { x: this.player.x, y: this.player.y };
      this.aimEnd = pos;
    }
  },

  onPointerMove(e) {
    if (!this.aiming) return;
    this.aimEnd = this.getCanvasPos(e);
  },

  onPointerUp(e) {
    if (!this.aiming) return;
    this.aiming = false;
    const end = this.getCanvasPos(e);
    const dx = this.aimStart.x - end.x;
    const dy = this.aimStart.y - end.y;
    const power = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.15, 18);

    if (power > 1.5) {
      const angle = Math.atan2(dy, dx);
      this.player.vx = Math.cos(angle) * power;
      this.player.vy = Math.sin(angle) * power;
      this.state = 'shooting';
      this.shotsLeft--;
      this.spawnDust(this.player.x, this.player.y, 6, '#c4a46a');
      this.updateScore();
    }
    this.aimEnd = null;
  },

  updateScore() {
    if (this.onScoreUpdate) {
      this.onScoreUpdate(`Score: ${this.score} / 8  |  Shots: ${this.shotsLeft}`);
    }
  },

  spawnDust(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3 - 1,
        life: 1,
        decay: 0.02 + Math.random() * 0.03,
        radius: 2 + Math.random() * 4,
        color: color || 'rgba(180,160,120,0.5)',
        type: 'dust'
      });
    }
  },

  spawnSpark(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.03 + Math.random() * 0.04,
        radius: 1.5 + Math.random() * 2.5,
        color,
        type: 'spark'
      });
    }
  },

  addFloatingText(x, y, text, color) {
    this.floatingTexts.push({ x, y, text, color, life: 1, vy: -1.5 });
  },

  update() {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.type === 'dust') p.vy += 0.05;
      p.vx *= 0.97;
      p.vy *= 0.97;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.life -= 0.015;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // Decay shake
    this.shakeAmount *= 0.9;

    if (this.state !== 'shooting' && this.state !== 'settling') return;

    const allBodies = [this.player, ...this.marbles.filter(m => m.active)];

    // Move all bodies
    for (const b of allBodies) {
      b.x += b.vx;
      b.y += b.vy;
      b.vx *= this.friction;
      b.vy *= this.friction;

      // Trail
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (speed > 1) {
        b.trail.push({ x: b.x, y: b.y, life: 1 });
        if (b.trail.length > 8) b.trail.shift();
      }
      for (let i = b.trail.length - 1; i >= 0; i--) {
        b.trail[i].life -= 0.08;
        if (b.trail[i].life <= 0) b.trail.splice(i, 1);
      }

      // Walls
      if (b.x < b.radius) { b.x = b.radius; b.vx *= -0.6; }
      if (b.x > this.width - b.radius) { b.x = this.width - b.radius; b.vx *= -0.6; }
      if (b.y < b.radius) { b.y = b.radius; b.vy *= -0.6; }
      if (b.y > this.height - b.radius) { b.y = this.height - b.radius; b.vy *= -0.6; }
    }

    // Collisions: player vs marbles
    for (const m of this.marbles) {
      if (!m.active) continue;
      this.resolveCollision(this.player, m);
    }

    // Marble-marble collisions
    const active = this.marbles.filter(m => m.active);
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        this.resolveCollision(active[i], active[j]);
      }
    }

    // Check marbles outside circle
    for (const m of this.marbles) {
      if (!m.active) continue;
      const dx = m.x - this.circleCenter.x;
      const dy = m.y - this.circleCenter.y;
      if (Math.sqrt(dx * dx + dy * dy) > this.circleRadius + m.radius) {
        m.active = false;
        this.score++;
        this.spawnSpark(m.x, m.y, 12, m.color);
        this.addFloatingText(m.x, m.y - 20, '+1', m.color);
        this.shakeAmount = 3;
        this.updateScore();
      }
    }

    // Check settled
    const allSlow = allBodies.every(b => Math.abs(b.vx) < 0.15 && Math.abs(b.vy) < 0.15);
    if (allSlow && this.state === 'shooting') {
      this.state = 'settling';
      setTimeout(() => {
        const remaining = this.marbles.filter(m => m.active).length;
        if (remaining === 0 || this.shotsLeft <= 0) {
          this.state = 'gameover';
          if (remaining === 0) {
            this.addFloatingText(this.width / 2, this.height / 2 - 60, 'Shandar!', '#FFD700');
            this.shakeAmount = 6;
            for (let i = 0; i < 30; i++) {
              const angle = Math.random() * Math.PI * 2;
              const dist = Math.random() * 80;
              this.spawnSpark(
                this.width / 2 + Math.cos(angle) * dist,
                this.height / 2 + Math.sin(angle) * dist,
                3,
                ['#FFD700', '#FF6D00', '#E53935', '#43A047'][Math.floor(Math.random() * 4)]
              );
            }
          }
          this.setupRestart();
        } else {
          this.player.x = this.width / 2;
          this.player.y = this.height - this.width * 0.12;
          this.player.vx = 0;
          this.player.vy = 0;
          this.player.trail = [];
          this.state = 'aiming';
        }
      }, 400);
    }
  },

  resolveCollision(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = a.radius + b.radius;
    if (dist >= minDist || dist === 0) return;

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    a.x -= nx * overlap * 0.5;
    a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5;
    b.y += ny * overlap * 0.5;

    const relVx = a.vx - b.vx;
    const relVy = a.vy - b.vy;
    const relDot = relVx * nx + relVy * ny;
    if (relDot > 0) {
      a.vx -= nx * relDot * 0.5;
      a.vy -= ny * relDot * 0.5;
      b.vx += nx * relDot * 0.5;
      b.vy += ny * relDot * 0.5;

      // Collision effects
      const impactSpeed = Math.abs(relDot);
      if (impactSpeed > 2) {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        this.spawnDust(mx, my, Math.min(8, Math.floor(impactSpeed)), '#c4a46a');
        this.shakeAmount = Math.min(4, impactSpeed * 0.4);
      }
    }
  },

  setupRestart() {
    this.restartHandler = (e) => {
      e.preventDefault();
      this.canvas.removeEventListener('click', this.restartHandler);
      this.canvas.removeEventListener('touchstart', this.restartHandler);
      this.restartHandler = null;
      this.reset();
    };
    setTimeout(() => {
      if (this.restartHandler) {
        this.canvas.addEventListener('click', this.restartHandler);
        this.canvas.addEventListener('touchstart', this.restartHandler);
      }
    }, 500);
  },

  draw() {
    const ctx = this.ctx;
    ctx.save();

    // Screen shake
    if (this.shakeAmount > 0.5) {
      ctx.translate(
        (Math.random() - 0.5) * this.shakeAmount,
        (Math.random() - 0.5) * this.shakeAmount
      );
    }

    // Ground
    const groundGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    groundGrad.addColorStop(0, '#e8d8b8');
    groundGrad.addColorStop(0.5, '#f0e4cc');
    groundGrad.addColorStop(1, '#dbc8a0');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Dirt texture spots
    for (const d of this.dirtSpots) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(160, 140, 100, ${d.a})`;
      ctx.fill();
    }

    // Circle boundary
    ctx.beginPath();
    ctx.arc(this.circleCenter.x, this.circleCenter.y, this.circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(190, 170, 130, 0.15)';
    ctx.fill();
    ctx.strokeStyle = '#8d6e4a';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Inner circle decoration
    ctx.beginPath();
    ctx.arc(this.circleCenter.x, this.circleCenter.y, this.circleRadius - 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(141, 110, 74, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Marble trails
    for (const m of this.marbles) {
      if (!m.active) continue;
      this.drawTrail(m);
    }
    this.drawTrail(this.player);

    // Marbles
    for (const m of this.marbles) {
      if (!m.active) continue;
      this.drawMarble(m.x, m.y, m.radius, m.color);
    }

    // Player marble (slightly bigger glow)
    this.drawMarble(this.player.x, this.player.y, this.player.radius, this.player.color);
    if (this.state === 'aiming') {
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, this.player.radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 109, 0, 0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Pulsing ring
      const pulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.3;
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, this.player.radius + 8 + pulse * 4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 109, 0, ${0.15 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Aim line
    if (this.aiming && this.aimEnd) {
      const dx = this.aimStart.x - this.aimEnd.x;
      const dy = this.aimStart.y - this.aimEnd.y;
      const power = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.15, 18);
      const angle = Math.atan2(dy, dx);

      // Dotted trajectory
      const dotCount = Math.floor(power * 2);
      for (let i = 0; i < dotCount; i++) {
        const t = (i + 1) / dotCount;
        const dotX = this.player.x + Math.cos(angle) * power * 8 * t;
        const dotY = this.player.y + Math.sin(angle) * power * 8 * t;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 2.5 - t * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 109, 0, ${0.7 - t * 0.5})`;
        ctx.fill();
      }

      // Power bar
      const barW = this.width * 0.3;
      const barH = 10;
      const barX = 15;
      const barY = this.height - 25;
      const fill = power / 18;
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      this.roundRect(ctx, barX, barY, barW, barH, 5);
      ctx.fill();
      const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      barGrad.addColorStop(0, '#43A047');
      barGrad.addColorStop(0.5, '#FF9933');
      barGrad.addColorStop(1, '#E53935');
      ctx.fillStyle = barGrad;
      this.roundRect(ctx, barX, barY, barW * fill, barH, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      this.roundRect(ctx, barX, barY, barW, barH, 5);
      ctx.stroke();
      ctx.fillStyle = '#5a4a2a';
      ctx.font = `${this.width * 0.025}px Poppins, sans-serif`;
      ctx.fillText('Power', barX, barY - 5);
    }

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.life;
      if (p.type === 'dust') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(')', ', 0.2)').replace('rgb', 'rgba');
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Floating texts
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = ft.life;
      ctx.fillStyle = ft.color;
      ctx.font = `bold ${this.width * 0.05}px Baloo 2, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.textAlign = 'start';
      ctx.globalAlpha = 1;
    }

    // Game over overlay
    if (this.state === 'gameover') {
      ctx.fillStyle = 'rgba(30, 20, 10, 0.65)';
      ctx.fillRect(0, 0, this.width, this.height);

      const remaining = this.marbles.filter(m => m.active).length;
      const cy = this.height / 2;

      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold ${this.width * 0.08}px Baloo 2, sans-serif`;
      ctx.fillText(remaining === 0 ? 'Shandar!' : 'Game Over!', this.width / 2, cy - 20);

      ctx.fillStyle = '#fff';
      ctx.font = `${this.width * 0.045}px Poppins, sans-serif`;
      ctx.fillText(`${this.score} / 8 kanche bahar!`, this.width / 2, cy + 20);

      ctx.fillStyle = 'rgba(255, 204, 0, 0.8)';
      ctx.font = `${this.width * 0.035}px Poppins, sans-serif`;
      ctx.fillText('Tap to play again', this.width / 2, cy + 55);
      ctx.textAlign = 'start';
    }

    ctx.restore();
  },

  drawTrail(marble) {
    const ctx = this.ctx;
    for (const t of marble.trail) {
      ctx.beginPath();
      ctx.arc(t.x, t.y, marble.radius * t.life * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 160, 120, ${t.life * 0.15})`;
      ctx.fill();
    }
  },

  drawMarble(x, y, r, color) {
    const ctx = this.ctx;
    // Shadow
    ctx.beginPath();
    ctx.arc(x + 1.5, y + 2.5, r + 1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();

    // Body gradient
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.15, this.lightenColor(color, 40));
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, this.darkenColor(color, 50));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Edge definition
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = this.darkenColor(color, 60);
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Glass highlight
    ctx.beginPath();
    ctx.arc(x - r * 0.22, y - r * 0.28, r * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();

    // Small secondary highlight
    ctx.beginPath();
    ctx.arc(x + r * 0.15, y + r * 0.2, r * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();
  },

  lightenColor(hex, amount) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0xFF) + amount);
    const b = Math.min(255, (num & 0xFF) + amount);
    return `rgb(${r},${g},${b})`;
  },

  darkenColor(hex, amount) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xFF) - amount);
    const b = Math.max(0, (num & 0xFF) - amount);
    return `rgb(${r},${g},${b})`;
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },

  loop() {
    this.update();
    this.draw();
    this.animationId = requestAnimationFrame(() => this.loop());
  },

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.restartHandler) {
      this.canvas.removeEventListener('click', this.restartHandler);
      this.canvas.removeEventListener('touchstart', this.restartHandler);
    }
    this.canvas.removeEventListener('mousedown', this._onDown);
    this.canvas.removeEventListener('mousemove', this._onMove);
    this.canvas.removeEventListener('mouseup', this._onUp);
    this.canvas.removeEventListener('touchstart', this._onTouchDown);
    this.canvas.removeEventListener('touchmove', this._onTouchMove);
    this.canvas.removeEventListener('touchend', this._onTouchUp);
  },

  getControls() {
    return 'Drag from the orange marble to aim and set power, then release to flick! Knock all marbles out of the circle.';
  }
};
