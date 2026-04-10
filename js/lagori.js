// Lagori (Seven Stones) - Throw ball to knock down stones, rebuild the pile
const LagoriGame = {
  canvas: null, ctx: null, width: 400, height: 500, dpr: 1,
  state: 'aiming',
  stones: [], ball: null, player: null, enemyBall: null,
  aiming: false, aimStart: null, aimEnd: null,
  score: 0, level: 1, lives: 3,
  rebuiltCount: 0, totalStones: 7,
  enemyThrowTimer: 0, animationId: null, onScoreUpdate: null,
  particles: [], floatingTexts: [], shakeAmount: 0,
  cloudOffset: 0,

  init(container, onScoreUpdate) {
    this.onScoreUpdate = onScoreUpdate;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.min(400, window.innerWidth - 40);
    this.height = Math.round(this.width * 1.25);

    this.canvas = document.createElement('canvas');
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(this.dpr, this.dpr);

    this._handlers = {
      md: (e) => this.onPointerDown(e),
      mm: (e) => this.onPointerMove(e),
      mu: (e) => this.onPointerUp(e),
      ts: (e) => { e.preventDefault(); this.onPointerDown(e.touches[0]); },
      tm: (e) => { e.preventDefault(); this.onPointerMove(e.touches[0]); },
      te: (e) => { e.preventDefault(); this.onPointerUp(e.changedTouches[0]); }
    };
    this.canvas.addEventListener('mousedown', this._handlers.md);
    this.canvas.addEventListener('mousemove', this._handlers.mm);
    this.canvas.addEventListener('mouseup', this._handlers.mu);
    this.canvas.addEventListener('touchstart', this._handlers.ts, { passive: false });
    this.canvas.addEventListener('touchmove', this._handlers.tm, { passive: false });
    this.canvas.addEventListener('touchend', this._handlers.te, { passive: false });

    this.reset();
    this.loop();
  },

  reset() {
    this.score = 0; this.level = 1; this.lives = 3;
    this.particles = []; this.floatingTexts = []; this.shakeAmount = 0;
    this.setupLevel();
    this.updateScore();
  },

  setupLevel() {
    this.state = 'aiming';
    this.rebuiltCount = 0;
    this.stones = [];
    this.enemyBall = null;
    this.enemyThrowTimer = 0;

    const baseX = this.width / 2;
    const baseY = this.height * 0.38;
    const stoneH = this.width * 0.032;
    const colors = ['#a0896e', '#8b7355', '#9c8870', '#b09878', '#7a6650', '#887460', '#a89070'];
    for (let i = 0; i < this.totalStones; i++) {
      this.stones.push({
        x: baseX + (Math.random() - 0.5) * 4,
        y: baseY - i * (stoneH + 2),
        width: this.width * 0.09 - i * 1.5,
        height: stoneH,
        color: colors[i],
        stacked: true, scattered: false, rebuilt: false,
        vx: 0, vy: 0,
        groundY: 0, glowPhase: Math.random() * Math.PI * 2
      });
    }

    this.ball = {
      x: this.width / 2, y: this.height - this.width * 0.15,
      vx: 0, vy: 0, radius: this.width * 0.025, active: false
    };

    this.player = {
      x: this.width / 2, y: this.height - this.width * 0.15,
      size: this.width * 0.06
    };
  },

  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.width / rect.width),
      y: (e.clientY - rect.top) * (this.height / rect.height)
    };
  },

  onPointerDown(e) {
    const pos = this.getCanvasPos(e);
    if (this.state === 'aiming') {
      this.aiming = true;
      this.aimStart = { x: this.ball.x, y: this.ball.y };
      this.aimEnd = pos;
    } else if (this.state === 'rebuilding') {
      for (const s of this.stones) {
        if (s.scattered && !s.rebuilt) {
          const dx = pos.x - s.x;
          const dy = pos.y - s.y;
          if (Math.abs(dx) < s.width * 0.8 && Math.abs(dy) < s.height * 2) {
            s.rebuilt = true; s.scattered = false;
            this.rebuiltCount++;
            this.score += 10;
            this.spawnParticles(s.x, s.y, 6, '#43A047');
            this.addFloat(s.x, s.y - 15, '+10', '#43A047');
            if (window.Sounds) Sounds.collect();
            this.updateScore();

            if (this.rebuiltCount >= this.totalStones) {
              this.state = 'levelcomplete';
              const bonus = 50 * this.level;
              this.score += bonus;
              this.addFloat(this.width / 2, this.height / 2 - 40, `+${bonus} Bonus!`, '#FFD700');
              if (window.Sounds) Sounds.success();
              this.updateScore();
              setTimeout(() => {
                this.level++;
                if (this.level > 5) { this.state = 'won'; }
                else { this.setupLevel(); this.updateScore(); }
              }, 1500);
            }
            break;
          }
        }
      }
    } else if (this.state === 'gameover' || this.state === 'won') {
      this.reset();
    }
  },

  onPointerMove(e) {
    const pos = this.getCanvasPos(e);
    if (this.aiming) this.aimEnd = pos;
    if (this.state === 'rebuilding') {
      this.player.x = Math.max(20, Math.min(this.width - 20, pos.x));
    }
  },

  onPointerUp(e) {
    if (!this.aiming) return;
    this.aiming = false;
    const end = this.getCanvasPos(e);
    const dx = this.aimStart.x - end.x;
    const dy = this.aimStart.y - end.y;
    const power = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.12, 14);
    if (power > 1) {
      const angle = Math.atan2(dy, dx);
      this.ball.vx = Math.cos(angle) * power;
      this.ball.vy = Math.sin(angle) * power;
      this.ball.active = true;
      this.state = 'throwing';
      if (window.Sounds) Sounds.whoosh();
    }
    this.aimEnd = null;
  },

  updateScore() {
    if (this.onScoreUpdate) {
      this.onScoreUpdate(`Level ${this.level}  |  Score: ${this.score}  |  ${'❤'.repeat(this.lives)}`);
    }
  },

  spawnParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3 - 1,
        life: 1, decay: 0.025 + Math.random() * 0.02,
        radius: 2 + Math.random() * 3, color
      });
    }
  },

  addFloat(x, y, text, color) {
    this.floatingTexts.push({ x, y, text, color, life: 1, vy: -1.2 });
  },

  update() {
    this.cloudOffset += 0.15;
    this.shakeAmount *= 0.9;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= p.decay;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy; ft.life -= 0.015;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    if (this.state === 'throwing') {
      this.ball.x += this.ball.vx;
      this.ball.y += this.ball.vy;
      this.ball.vy += 0.06;

      let hitAny = false;
      for (const s of this.stones) {
        if (!s.stacked) continue;
        if (this.ball.x > s.x - s.width / 2 - 5 && this.ball.x < s.x + s.width / 2 + 5 &&
            this.ball.y > s.y - s.height && this.ball.y < s.y + s.height) {
          hitAny = true;
        }
      }

      if (hitAny) {
        this.shakeAmount = 6;
        this.spawnParticles(this.width / 2, this.height * 0.38, 15, '#c4a46a');
        if (window.Sounds) Sounds.thud();
        for (const s of this.stones) {
          s.stacked = false; s.scattered = true;
          s.vx = (Math.random() - 0.5) * 8;
          s.vy = -Math.random() * 5 - 2;
          s.groundY = this.height * 0.35 + Math.random() * this.height * 0.25;
        }
        this.ball.active = false;
        setTimeout(() => { this.state = 'rebuilding'; this.enemyThrowTimer = 0; }, 700);
      }

      if (this.ball.y < -20 || this.ball.x < -20 || this.ball.x > this.width + 20 || this.ball.y > this.height + 20) {
        this.ball.active = false;
        this.ball.x = this.width / 2;
        this.ball.y = this.height - this.width * 0.15;
        this.ball.vx = 0; this.ball.vy = 0;
        this.state = 'aiming';
      }
    }

    for (const s of this.stones) {
      if (s.scattered) {
        s.x += s.vx; s.y += s.vy; s.vy += 0.35; s.vx *= 0.97;
        if (s.y > s.groundY) { s.y = s.groundY; s.vy *= -0.25; if (Math.abs(s.vy) < 0.5) s.vy = 0; }
        if (s.x < 25) s.x = 25;
        if (s.x > this.width - 25) s.x = this.width - 25;
      }
    }

    if (this.state === 'rebuilding') {
      this.enemyThrowTimer++;
      const interval = Math.max(50, 140 - this.level * 20);

      if (this.enemyBall) {
        this.enemyBall.x += this.enemyBall.vx;
        this.enemyBall.y += this.enemyBall.vy;
        this.enemyBall.trail.push({ x: this.enemyBall.x, y: this.enemyBall.y, life: 1 });
        if (this.enemyBall.trail.length > 6) this.enemyBall.trail.shift();
        for (const t of this.enemyBall.trail) t.life -= 0.12;

        const dx = this.enemyBall.x - this.player.x;
        const dy = this.enemyBall.y - (this.player.y - this.player.size * 0.4);
        if (Math.sqrt(dx * dx + dy * dy) < this.player.size * 0.7) {
          this.lives--;
          this.shakeAmount = 8;
          this.spawnParticles(this.player.x, this.player.y, 10, '#E53935');
          this.addFloat(this.player.x, this.player.y - 30, 'OUT!', '#E53935');
          if (window.Sounds) Sounds.fail();
          this.updateScore();
          this.enemyBall = null;
          if (this.lives <= 0) { this.state = 'gameover'; }
          else { this.state = 'hit'; setTimeout(() => { this.setupLevel(); this.updateScore(); }, 1200); }
          return;
        }

        if (this.enemyBall.y > this.height + 20 || this.enemyBall.x < -20 || this.enemyBall.x > this.width + 20) {
          this.enemyBall = null;
        }
      }

      if (!this.enemyBall && this.enemyThrowTimer > interval) {
        this.enemyThrowTimer = 0;
        const fromLeft = Math.random() > 0.5;
        const startX = fromLeft ? -10 : this.width + 10;
        const aimX = this.player.x + (Math.random() - 0.5) * 50;
        const aimY = this.player.y - 15;
        const angle = Math.atan2(aimY - 40, aimX - startX);
        const speed = 4 + this.level * 0.8;
        this.enemyBall = {
          x: startX, y: 40 + Math.random() * 40,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          radius: this.width * 0.025, trail: []
        };
      }
    }
  },

  draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shakeAmount > 0.5) {
      ctx.translate((Math.random() - 0.5) * this.shakeAmount, (Math.random() - 0.5) * this.shakeAmount);
    }

    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.height * 0.5);
    skyGrad.addColorStop(0, '#4FC3F7');
    skyGrad.addColorStop(1, '#81D4FA');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.width, this.height * 0.5);

    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    this.drawCloud(ctx, (this.cloudOffset % (this.width + 80)) - 40, this.height * 0.08, 25);
    this.drawCloud(ctx, ((this.cloudOffset * 0.6 + 150) % (this.width + 80)) - 40, this.height * 0.14, 20);

    // Ground
    const groundGrad = ctx.createLinearGradient(0, this.height * 0.4, 0, this.height);
    groundGrad.addColorStop(0, '#7CB342');
    groundGrad.addColorStop(0.3, '#8BC34A');
    groundGrad.addColorStop(1, '#689F38');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, this.height * 0.4, this.width, this.height * 0.6);

    // Dirt patch
    ctx.fillStyle = 'rgba(160, 130, 80, 0.35)';
    ctx.beginPath();
    ctx.ellipse(this.width / 2, this.height * 0.45, this.width * 0.25, this.height * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stones
    for (const s of this.stones) {
      if (s.rebuilt) continue;
      this.drawStone(ctx, s);
    }

    // Rebuilt pile
    if (this.state === 'rebuilding' || this.state === 'levelcomplete') {
      const baseX = this.width / 2;
      const baseY = this.height * 0.38;
      const stoneH = this.width * 0.032;
      for (let i = 0; i < this.rebuiltCount; i++) {
        const w = this.width * 0.09 - i * 1.5;
        ctx.fillStyle = '#a0896e';
        ctx.strokeStyle = '#7a6650';
        ctx.lineWidth = 1;
        ctx.fillRect(baseX - w / 2, baseY - i * (stoneH + 2) - stoneH / 2, w, stoneH);
        ctx.strokeRect(baseX - w / 2, baseY - i * (stoneH + 2) - stoneH / 2, w, stoneH);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(baseX - w / 2, baseY - i * (stoneH + 2) - stoneH / 2, w, stoneH * 0.35);
      }
    }

    // Pulsing glow on scattered stones
    if (this.state === 'rebuilding') {
      for (const s of this.stones) {
        if (!s.scattered || s.rebuilt) continue;
        const glow = 0.3 + Math.sin(Date.now() * 0.004 + s.glowPhase) * 0.2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.width * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(67, 160, 71, ${glow})`;
        ctx.fill();
      }
    }

    // Ball
    if (this.ball.active) {
      this.drawBall(ctx, this.ball.x, this.ball.y, this.ball.radius, '#D32F2F', '#B71C1C');
    }

    // Enemy ball with trail
    if (this.enemyBall) {
      for (const t of this.enemyBall.trail) {
        if (t.life > 0) {
          ctx.beginPath();
          ctx.arc(t.x, t.y, this.enemyBall.radius * t.life * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 87, 34, ${t.life * 0.3})`;
          ctx.fill();
        }
      }
      this.drawBall(ctx, this.enemyBall.x, this.enemyBall.y, this.enemyBall.radius, '#FF5722', '#E64A19');
    }

    // Player
    if (this.state === 'rebuilding' || this.state === 'hit') {
      this.drawPlayer(ctx, this.player.x, this.player.y, this.player.size);
    }

    // Aiming phase
    if (this.state === 'aiming') {
      this.drawPlayer(ctx, this.width / 2, this.height - this.width * 0.1, this.player.size);
      if (!this.ball.active) {
        this.drawBall(ctx, this.ball.x, this.ball.y, this.ball.radius, '#D32F2F', '#B71C1C');
      }
      if (this.aiming && this.aimEnd) {
        const dx = this.aimStart.x - this.aimEnd.x;
        const dy = this.aimStart.y - this.aimEnd.y;
        const angle = Math.atan2(dy, dx);
        const power = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.12, 14);
        const dots = Math.floor(power * 2);
        for (let i = 0; i < dots; i++) {
          const t = (i + 1) / dots;
          ctx.beginPath();
          ctx.arc(
            this.ball.x + Math.cos(angle) * power * 10 * t,
            this.ball.y + Math.sin(angle) * power * 10 * t,
            2.5 - t * 1.5, 0, Math.PI * 2
          );
          ctx.fillStyle = `rgba(211, 47, 47, ${0.7 - t * 0.5})`;
          ctx.fill();
        }
      }
    }

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Floating texts
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = ft.life;
      ctx.fillStyle = ft.color;
      ctx.font = `bold ${this.width * 0.045}px Baloo 2, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'start';

    // Overlays
    this.drawOverlay(ctx);
    ctx.restore();
  },

  drawOverlay(ctx) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    ctx.textAlign = 'center';

    if (this.state === 'levelcomplete') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold ${this.width * 0.07}px Baloo 2, sans-serif`;
      ctx.fillText('Lagori Complete!', cx, cy - 10);
      ctx.fillStyle = '#fff';
      ctx.font = `${this.width * 0.04}px Poppins, sans-serif`;
      ctx.fillText(`Level ${this.level} cleared!`, cx, cy + 25);
    }

    if (this.state === 'hit') {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.12)';
      ctx.fillRect(0, 0, this.width, this.height);
    }

    if (this.state === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${this.width * 0.08}px Baloo 2, sans-serif`;
      ctx.fillText('Game Over!', cx, cy - 15);
      ctx.font = `${this.width * 0.04}px Poppins, sans-serif`;
      ctx.fillText(`Final Score: ${this.score}`, cx, cy + 20);
      ctx.fillStyle = '#ffcc00';
      ctx.font = `${this.width * 0.035}px Poppins, sans-serif`;
      ctx.fillText('Tap to play again', cx, cy + 55);
    }

    if (this.state === 'won') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold ${this.width * 0.08}px Baloo 2, sans-serif`;
      ctx.fillText('Champion!', cx, cy - 15);
      ctx.fillStyle = '#fff';
      ctx.font = `${this.width * 0.04}px Poppins, sans-serif`;
      ctx.fillText(`Score: ${this.score}`, cx, cy + 20);
      ctx.fillStyle = '#ffcc00';
      ctx.font = `${this.width * 0.035}px Poppins, sans-serif`;
      ctx.fillText('Tap to play again', cx, cy + 55);
    }
    ctx.textAlign = 'start';
  },

  drawCloud(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.8, y - r * 0.3, r * 0.7, 0, Math.PI * 2);
    ctx.arc(x + r * 1.5, y, r * 0.8, 0, Math.PI * 2);
    ctx.fill();
  },

  drawBall(ctx, x, y, r, color, stroke) {
    ctx.beginPath();
    ctx.arc(x + 1, y + 2, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fill();
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, '#ff8a80');
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, stroke);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - r * 0.2, y - r * 0.25, r * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
  },

  drawStone(ctx, s) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(s.x - s.width / 2 + 2, s.y - s.height / 2 + 2, s.width, s.height);
    // Body
    const grad = ctx.createLinearGradient(0, s.y - s.height / 2, 0, s.y + s.height / 2);
    grad.addColorStop(0, s.color);
    grad.addColorStop(1, '#6b5640');
    ctx.fillStyle = grad;
    ctx.fillRect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height);
    ctx.strokeStyle = '#5a4730';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height);
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height * 0.35);
  },

  drawPlayer(ctx, x, y, size) {
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    // Head
    ctx.beginPath();
    ctx.arc(x, y - size * 0.75, size * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#FFCC80'; ctx.fill(); ctx.stroke();
    // Body
    ctx.beginPath(); ctx.moveTo(x, y - size * 0.55); ctx.lineTo(x, y - size * 0.1); ctx.stroke();
    // Arms
    ctx.beginPath(); ctx.moveTo(x - size * 0.3, y - size * 0.45); ctx.lineTo(x, y - size * 0.35); ctx.lineTo(x + size * 0.3, y - size * 0.45); ctx.stroke();
    // Legs
    ctx.beginPath(); ctx.moveTo(x, y - size * 0.1); ctx.lineTo(x - size * 0.25, y + size * 0.15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - size * 0.1); ctx.lineTo(x + size * 0.25, y + size * 0.15); ctx.stroke();
    ctx.lineCap = 'butt';
  },

  loop() {
    this.update();
    this.draw();
    this.animationId = requestAnimationFrame(() => this.loop());
  },

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.canvas.removeEventListener('mousedown', this._handlers.md);
    this.canvas.removeEventListener('mousemove', this._handlers.mm);
    this.canvas.removeEventListener('mouseup', this._handlers.mu);
    this.canvas.removeEventListener('touchstart', this._handlers.ts);
    this.canvas.removeEventListener('touchmove', this._handlers.tm);
    this.canvas.removeEventListener('touchend', this._handlers.te);
  },

  getControls() {
    return 'Drag to aim & throw the ball at the stones. Tap scattered stones to rebuild. Dodge enemy balls by moving!';
  }
};
