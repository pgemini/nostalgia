// Stapu (Hopscotch) - Timing-based hopping game
const StapuGame = {
  canvas: null, ctx: null, width: 300, height: 550, dpr: 1,
  squares: [], playerPos: -1,
  state: 'ready',
  markerTarget: 0, currentRound: 0, score: 0,
  hopDirection: 1, balanceBar: 50, balanceDrift: 0,
  animationId: null, onScoreUpdate: null,
  particles: [], footprints: [],

  init(container, onScoreUpdate) {
    this.onScoreUpdate = onScoreUpdate;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.min(320, window.innerWidth - 40);
    this.height = Math.round(this.width * 1.72);

    this.canvas = document.createElement('canvas');
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(this.dpr, this.dpr);

    this._onTap = (e) => this.onTap(e);
    this._onTouchTap = (e) => { e.preventDefault(); this.onTap(e.touches[0]); };
    this.canvas.addEventListener('mousedown', this._onTap);
    this.canvas.addEventListener('touchstart', this._onTouchTap, { passive: false });

    this.setupBoard();
    this.reset();
    this.loop();
  },

  setupBoard() {
    const w = this.width * 0.26;
    const h = this.width * 0.19;
    const cx = this.width / 2;
    const startY = this.height - h * 1.2;
    const gap = 3;

    this.squares = [
      { x: cx, y: startY, w, h, label: '1', type: 'single' },
      { x: cx - w / 2 - gap, y: startY - h - gap, w, h, label: '2', type: 'left' },
      { x: cx + w / 2 + gap, y: startY - h - gap, w, h, label: '3', type: 'right' },
      { x: cx, y: startY - 2 * (h + gap), w, h, label: '4', type: 'single' },
      { x: cx - w / 2 - gap, y: startY - 3 * (h + gap), w, h, label: '5', type: 'left' },
      { x: cx + w / 2 + gap, y: startY - 3 * (h + gap), w, h, label: '6', type: 'right' },
      { x: cx, y: startY - 4 * (h + gap), w, h, label: '7', type: 'single' },
      { x: cx, y: startY - 5 * (h + gap), w, h, label: '8', type: 'single' },
    ];
  },

  reset() {
    this.currentRound = 0;
    this.score = 0;
    this.playerPos = -1;
    this.markerTarget = 0;
    this.state = 'ready';
    this.hopDirection = 1;
    this.balanceBar = 50;
    this.balanceDrift = 0;
    this.particles = [];
    this.footprints = [];
    this.updateScore();
  },

  onTap() {
    if (this.state === 'ready') {
      this.state = 'hopping';
      this.playerPos = -1;
      this.hopDirection = 1;
      this.balanceBar = 50;
      this.balanceDrift = (Math.random() - 0.5) * (1 + this.currentRound * 0.3);
    } else if (this.state === 'hopping') {
      this.hop();
    } else if (this.state === 'landed') {
      this.currentRound++;
      if (this.currentRound >= this.squares.length) {
        this.state = 'won';
      } else {
        this.markerTarget = this.currentRound;
        this.state = 'ready';
      }
      this.updateScore();
    } else if (this.state === 'gameover' || this.state === 'won') {
      this.reset();
    }
  },

  hop() {
    if (this.hopDirection === 1) {
      this.playerPos++;
      if (this.playerPos === this.markerTarget) this.playerPos++;
      if (this.playerPos >= this.squares.length) {
        this.hopDirection = -1;
        this.playerPos = this.squares.length - 1;
        if (this.playerPos === this.markerTarget) this.playerPos--;
      }
    } else {
      this.playerPos--;
      if (this.playerPos === this.markerTarget) {
        if (this.balanceBar < 20 || this.balanceBar > 80) {
          this.state = 'gameover';
          this.spawnDust(this.squares[this.playerPos + 1].x, this.squares[this.playerPos + 1].y, 12);
          return;
        }
        this.score += 10 + this.currentRound * 5;
        this.updateScore();
        this.playerPos--;
      }
      if (this.playerPos < 0) {
        this.state = 'landed';
        return;
      }
    }

    // Add footprint & dust at current position
    if (this.playerPos >= 0 && this.playerPos < this.squares.length) {
      const sq = this.squares[this.playerPos];
      this.footprints.push({ x: sq.x, y: sq.y, life: 1 });
      if (this.footprints.length > 12) this.footprints.shift();
      this.spawnDust(sq.x, sq.y + sq.h * 0.3, 4);

      if (sq.type === 'single') {
        this.balanceDrift = (Math.random() - 0.5) * (1.5 + this.currentRound * 0.4);
      } else {
        this.balanceDrift = 0;
        this.balanceBar = 50;
      }
    }

    if (this.playerPos < 0) this.state = 'landed';
  },

  spawnDust(x, y, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 1.5,
        life: 1, decay: 0.03 + Math.random() * 0.02,
        radius: 2 + Math.random() * 3
      });
    }
  },

  updateScore() {
    if (this.onScoreUpdate) {
      this.onScoreUpdate(`Round ${this.currentRound + 1} / 8  |  Score: ${this.score}`);
    }
  },

  update() {
    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.life -= p.decay;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    // Footprints fade
    for (const fp of this.footprints) fp.life -= 0.003;

    if (this.state === 'hopping' && this.playerPos >= 0 && this.playerPos < this.squares.length) {
      const sq = this.squares[this.playerPos];
      if (sq.type === 'single') {
        this.balanceBar += this.balanceDrift;
        if (this.balanceBar < 5 || this.balanceBar > 95) {
          this.state = 'gameover';
          this.spawnDust(sq.x, sq.y, 15);
        }
        this.balanceBar = Math.max(0, Math.min(100, this.balanceBar));
      }
    }
  },

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Concrete ground
    const groundGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    groundGrad.addColorStop(0, '#c8bda8');
    groundGrad.addColorStop(1, '#b8a890');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle concrete texture
    ctx.fillStyle = 'rgba(0,0,0,0.02)';
    for (let i = 0; i < 60; i++) {
      ctx.fillRect(
        (i * 67) % this.width, (i * 43) % this.height,
        1 + i % 3, 1 + i % 2
      );
    }

    // Footprints
    for (const fp of this.footprints) {
      if (fp.life <= 0) continue;
      ctx.globalAlpha = fp.life * 0.2;
      ctx.fillStyle = '#8B7355';
      ctx.beginPath();
      ctx.ellipse(fp.x - 6, fp.y, 5, 8, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(fp.x + 6, fp.y, 5, 8, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Draw squares
    for (let i = 0; i < this.squares.length; i++) {
      const sq = this.squares[i];
      const isMarker = i === this.markerTarget && this.state !== 'ready';
      const isPlayer = i === this.playerPos;

      // Chalk-drawn square (slightly rough edges)
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2.5;
      const x1 = sq.x - sq.w / 2;
      const y1 = sq.y - sq.h / 2;
      ctx.beginPath();
      ctx.moveTo(x1 + 1, y1 - 1);
      ctx.lineTo(x1 + sq.w - 1, y1 + 1);
      ctx.lineTo(x1 + sq.w + 1, y1 + sq.h - 1);
      ctx.lineTo(x1 - 1, y1 + sq.h + 1);
      ctx.closePath();
      ctx.stroke();

      // Fill
      if (isPlayer) {
        ctx.fillStyle = 'rgba(255, 153, 51, 0.25)';
        ctx.fill();
      } else if (isMarker) {
        ctx.fillStyle = 'rgba(211, 47, 47, 0.12)';
        ctx.fill();
      }

      // Number (chalk style)
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = `bold ${sq.w * 0.3}px Baloo 2, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sq.label, sq.x, sq.y);

      // Marker stone
      if (isMarker && this.state !== 'landed') {
        ctx.fillStyle = '#C0392B';
        ctx.beginPath();
        ctx.ellipse(sq.x, sq.y, sq.w * 0.15, sq.w * 0.12, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#922B21';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Player indicator
      if (isPlayer) {
        const singleFoot = sq.type === 'single';
        ctx.fillStyle = '#E65100';
        if (singleFoot) {
          ctx.beginPath();
          ctx.ellipse(sq.x, sq.y + 3, sq.w * 0.12, sq.w * 0.18, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#BF360C';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.ellipse(sq.x - 8, sq.y + 3, sq.w * 0.1, sq.w * 0.15, -0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(sq.x + 8, sq.y + 3, sq.w * 0.1, sq.w * 0.15, 0.15, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    // Balance bar
    if (this.state === 'hopping' && this.playerPos >= 0 && this.playerPos < this.squares.length) {
      const sq = this.squares[this.playerPos];
      if (sq.type === 'single') {
        const barX = this.width * 0.08;
        const barY = 18;
        const barW = this.width * 0.84;
        const barH = 14;

        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 7);
        ctx.fill();

        // Safe zone
        ctx.fillStyle = 'rgba(76, 175, 80, 0.35)';
        ctx.fillRect(barX + barW * 0.2, barY, barW * 0.6, barH);

        // Danger zones
        ctx.fillStyle = 'rgba(244, 67, 54, 0.35)';
        ctx.fillRect(barX, barY, barW * 0.2, barH);
        ctx.fillRect(barX + barW * 0.8, barY, barW * 0.2, barH);

        // Indicator
        const ix = barX + (this.balanceBar / 100) * barW;
        ctx.beginPath();
        ctx.arc(ix, barY + barH / 2, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#E65100';
        ctx.fill();
        ctx.strokeStyle = '#BF360C';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#5a4a2a';
        ctx.font = `${this.width * 0.035}px Poppins, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('Balance!', this.width / 2, barY + barH + 16);
        ctx.textAlign = 'start';
      }
    }

    // Particles (dust)
    for (const p of this.particles) {
      ctx.globalAlpha = p.life * 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
      ctx.fillStyle = '#b8a890';
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Status messages
    ctx.textAlign = 'center';
    if (this.state === 'ready') {
      ctx.fillStyle = '#E65100';
      ctx.font = `bold ${this.width * 0.05}px Baloo 2, sans-serif`;
      ctx.fillText(`Round ${this.currentRound + 1}: Tap to start!`, this.width / 2, 30);
    }
    if (this.state === 'hopping') {
      ctx.fillStyle = '#E65100';
      ctx.font = `${this.width * 0.04}px Poppins, sans-serif`;
      const msg = this.hopDirection === 1 ? 'Tap to hop forward!' : 'Tap to hop back!';
      ctx.fillText(msg, this.width / 2, this.height - 12);
    }

    // Overlays
    if (this.state === 'landed') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold ${this.width * 0.075}px Baloo 2, sans-serif`;
      ctx.fillText('Bahut Badhiya!', this.width / 2, this.height / 2 - 10);
      ctx.fillStyle = '#fff';
      ctx.font = `${this.width * 0.04}px Poppins, sans-serif`;
      ctx.fillText('Tap for next round', this.width / 2, this.height / 2 + 22);
    }
    if (this.state === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${this.width * 0.075}px Baloo 2, sans-serif`;
      ctx.fillText('Oops! Gir Gaye!', this.width / 2, this.height / 2 - 20);
      ctx.font = `${this.width * 0.045}px Poppins, sans-serif`;
      ctx.fillText(`Score: ${this.score}`, this.width / 2, this.height / 2 + 15);
      ctx.fillStyle = '#ffcc00';
      ctx.font = `${this.width * 0.035}px Poppins, sans-serif`;
      ctx.fillText('Tap to play again', this.width / 2, this.height / 2 + 45);
    }
    if (this.state === 'won') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold ${this.width * 0.08}px Baloo 2, sans-serif`;
      ctx.fillText('Jeet Gaye!', this.width / 2, this.height / 2 - 20);
      ctx.fillStyle = '#fff';
      ctx.font = `${this.width * 0.045}px Poppins, sans-serif`;
      ctx.fillText(`Final Score: ${this.score}`, this.width / 2, this.height / 2 + 15);
      ctx.fillStyle = '#ffcc00';
      ctx.font = `${this.width * 0.035}px Poppins, sans-serif`;
      ctx.fillText('Tap to play again', this.width / 2, this.height / 2 + 45);
    }
    ctx.textAlign = 'start';
  },

  loop() {
    this.update();
    this.draw();
    this.animationId = requestAnimationFrame(() => this.loop());
  },

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.canvas.removeEventListener('mousedown', this._onTap);
    this.canvas.removeEventListener('touchstart', this._onTouchTap);
  },

  getControls() {
    return 'Tap to throw the marker, then tap to hop. Skip the marker square! Keep balance on single squares. Hop back to pick up the marker.';
  }
};
