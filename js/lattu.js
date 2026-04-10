// Lattu (Top Spinning) - Spin the top and keep it going!
const LattuGame = {
  canvas: null,
  ctx: null,
  width: 400,
  height: 450,
  top: null,
  state: 'winding', // winding, spinning, slowing, gameover
  windPower: 0,
  windDirection: 1,
  spinSpeed: 0,
  maxSpin: 100,
  rotation: 0,
  wobble: 0,
  score: 0,
  scoreTimer: 0,
  boosts: [],
  obstacles: [],
  boostTimer: 0,
  animationId: null,
  onScoreUpdate: null,
  holding: false,

  init(container, onScoreUpdate) {
    this.onScoreUpdate = onScoreUpdate;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.canvas.addEventListener('mousedown', (e) => this.onDown(e));
    this.canvas.addEventListener('mouseup', (e) => this.onUp(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMove(e));
    this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this.onDown(e.touches[0]); });
    this.canvas.addEventListener('touchend', (e) => { e.preventDefault(); this.onUp(e.changedTouches[0]); });
    this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); this.onMove(e.touches[0]); });

    this.reset();
    this.loop();
  },

  reset() {
    this.state = 'winding';
    this.windPower = 0;
    this.windDirection = 1;
    this.spinSpeed = 0;
    this.rotation = 0;
    this.wobble = 0;
    this.score = 0;
    this.scoreTimer = 0;
    this.boosts = [];
    this.obstacles = [];
    this.boostTimer = 0;
    this.holding = false;

    this.top = {
      x: this.width / 2,
      y: this.height / 2 + 30,
      vx: 0,
      vy: 0
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

  onDown(e) {
    this.holding = true;
    if (this.state === 'winding') {
      // Hold to wind up
    } else if (this.state === 'gameover') {
      this.reset();
    }
  },

  onUp(e) {
    this.holding = false;
    if (this.state === 'winding' && this.windPower > 20) {
      this.state = 'spinning';
      this.spinSpeed = this.windPower;
    }
  },

  onMove(e) {
    if (this.state === 'spinning' || this.state === 'slowing') {
      const pos = this.getCanvasPos(e);
      // Nudge the top towards the pointer (gentle control)
      const dx = pos.x - this.top.x;
      const dy = pos.y - this.top.y;
      this.top.vx += dx * 0.008;
      this.top.vy += dy * 0.008;
    }
  },

  updateScore() {
    if (this.onScoreUpdate) {
      this.onScoreUpdate(`Score: ${this.score} | Spin: ${Math.round(this.spinSpeed)}%`);
    }
  },

  update() {
    if (this.state === 'winding') {
      if (this.holding) {
        this.windPower += this.windDirection * 1.5;
        if (this.windPower >= 100) this.windDirection = -1;
        if (this.windPower <= 0) this.windDirection = 1;
      }
      return;
    }

    if (this.state === 'spinning' || this.state === 'slowing') {
      // Spin decreases over time
      this.spinSpeed -= 0.08 + (100 - this.spinSpeed) * 0.001;

      // Rotation visual
      this.rotation += this.spinSpeed * 0.05;

      // Wobble increases as spin decreases
      this.wobble = Math.max(0, (60 - this.spinSpeed) * 0.02);
      this.top.x += Math.sin(this.rotation * 0.3) * this.wobble;
      this.top.y += Math.cos(this.rotation * 0.4) * this.wobble * 0.5;

      // Apply velocity
      this.top.x += this.top.vx;
      this.top.y += this.top.vy;
      this.top.vx *= 0.95;
      this.top.vy *= 0.95;

      // Keep in bounds
      const margin = 40;
      if (this.top.x < margin) { this.top.x = margin; this.top.vx *= -0.5; }
      if (this.top.x > this.width - margin) { this.top.x = this.width - margin; this.top.vx *= -0.5; }
      if (this.top.y < margin + 30) { this.top.y = margin + 30; this.top.vy *= -0.5; }
      if (this.top.y > this.height - margin) { this.top.y = this.height - margin; this.top.vy *= -0.5; }

      // Score timer
      this.scoreTimer++;
      if (this.scoreTimer % 30 === 0) {
        this.score += Math.ceil(this.spinSpeed / 20);
        this.updateScore();
      }

      // Spawn boosts
      this.boostTimer++;
      if (this.boostTimer % 180 === 0) {
        this.boosts.push({
          x: 50 + Math.random() * (this.width - 100),
          y: 80 + Math.random() * (this.height - 160),
          type: Math.random() > 0.3 ? 'spin' : 'point',
          radius: 15,
          life: 300
        });
      }

      // Spawn obstacles
      if (this.boostTimer % 240 === 0 && this.score > 20) {
        this.obstacles.push({
          x: 50 + Math.random() * (this.width - 100),
          y: 80 + Math.random() * (this.height - 160),
          radius: 20,
          life: 400
        });
      }

      // Check boost collisions
      for (let i = this.boosts.length - 1; i >= 0; i--) {
        const b = this.boosts[i];
        b.life--;
        if (b.life <= 0) { this.boosts.splice(i, 1); continue; }
        const dx = this.top.x - b.x;
        const dy = this.top.y - b.y;
        if (Math.sqrt(dx * dx + dy * dy) < b.radius + 18) {
          if (b.type === 'spin') {
            this.spinSpeed = Math.min(100, this.spinSpeed + 20);
          } else {
            this.score += 25;
          }
          this.boosts.splice(i, 1);
          this.updateScore();
        }
      }

      // Check obstacle collisions
      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const o = this.obstacles[i];
        o.life--;
        if (o.life <= 0) { this.obstacles.splice(i, 1); continue; }
        const dx = this.top.x - o.x;
        const dy = this.top.y - o.y;
        if (Math.sqrt(dx * dx + dy * dy) < o.radius + 18) {
          this.spinSpeed = Math.max(0, this.spinSpeed - 25);
          this.obstacles.splice(i, 1);
          this.updateScore();
        }
      }

      if (this.spinSpeed < 5) {
        this.state = 'slowing';
      }
      if (this.spinSpeed <= 0) {
        this.spinSpeed = 0;
        this.state = 'gameover';
        this.updateScore();
      }
    }
  },

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Floor
    ctx.fillStyle = '#e8dcc8';
    ctx.fillRect(0, 0, this.width, this.height);

    // Floor pattern
    ctx.strokeStyle = 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < this.width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, this.height);
      ctx.stroke();
    }
    for (let i = 0; i < this.height; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(this.width, i);
      ctx.stroke();
    }

    // Boosts
    for (const b of this.boosts) {
      const alpha = b.life < 60 ? b.life / 60 : 1;
      if (b.type === 'spin') {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(76, 175, 80, ${0.7 * alpha})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(56, 142, 60, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', b.x, b.y);
      } else {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 193, 7, ${0.7 * alpha})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 160, 0, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('25', b.x, b.y);
      }
    }

    // Obstacles
    for (const o of this.obstacles) {
      const alpha = o.life < 60 ? o.life / 60 : 1;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(244, 67, 54, ${0.5 * alpha})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(211, 47, 47, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('x', o.x, o.y);
    }

    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    if (this.state === 'winding') {
      // Draw winding instruction
      ctx.fillStyle = '#e65100';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Hold to wind up the Lattu!', this.width / 2, 80);

      // Power bar
      const barX = this.width / 2 - 80;
      const barY = this.height / 2 - 20;
      const barW = 160;
      const barH = 30;
      ctx.fillStyle = '#ddd';
      ctx.fillRect(barX, barY, barW, barH);
      const fill = this.windPower / 100;
      const barColor = fill > 0.7 ? '#e53935' : fill > 0.4 ? '#ff9933' : '#43a047';
      ctx.fillStyle = barColor;
      ctx.fillRect(barX, barY, barW * fill, barH);
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, barY, barW, barH);

      ctx.fillStyle = '#333';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`Power: ${Math.round(this.windPower)}%`, this.width / 2, barY + barH + 25);

      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('Release to spin!', this.width / 2, barY + barH + 48);

      // Draw lattu preview
      this.drawLattu(this.width / 2, this.height / 2 + 80, 0, false);

      ctx.textAlign = 'start';
      return;
    }

    // Draw shadow
    const shadowScale = this.spinSpeed > 5 ? 1 : 1.5;
    ctx.beginPath();
    ctx.ellipse(this.top.x + 3, this.top.y + 25, 18 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fill();

    // Draw the lattu
    this.drawLattu(this.top.x, this.top.y, this.rotation, this.spinSpeed > 5);

    // Spin speed indicator at top
    if (this.state === 'spinning' || this.state === 'slowing') {
      const barX = 20;
      const barY = 15;
      const barW = this.width - 40;
      const barH = 12;
      ctx.fillStyle = '#ddd';
      ctx.fillRect(barX, barY, barW, barH);
      const fill = this.spinSpeed / 100;
      ctx.fillStyle = fill > 0.5 ? '#43a047' : fill > 0.25 ? '#ff9933' : '#e53935';
      ctx.fillRect(barX, barY, barW * fill, barH);
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
      ctx.fillStyle = '#666';
      ctx.font = '10px sans-serif';
      ctx.fillText('Spin Energy', barX, barY - 3);
    }

    // Game over
    if (this.state === 'gameover') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Lattu Gir Gaya!', this.width / 2, this.height / 2 - 25);
      ctx.font = '18px sans-serif';
      ctx.fillText(`Score: ${this.score}`, this.width / 2, this.height / 2 + 10);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#ffcc00';
      ctx.fillText('Tap to play again', this.width / 2, this.height / 2 + 45);
      ctx.textAlign = 'start';
    }
  },

  drawLattu(x, y, rot, spinning) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    if (spinning) {
      // Slight tilt based on wobble
      ctx.rotate(Math.sin(rot * 0.1) * this.wobble * 0.3);
    }

    // Main body (top shape - like an inverted cone with rounded top)
    const bodyH = 40;
    const bodyW = 28;

    // Colored stripes (rotating effect)
    const stripeColors = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#ff8f00', '#8e24aa'];

    // Draw body
    ctx.beginPath();
    ctx.moveTo(-bodyW, -5);
    ctx.quadraticCurveTo(-bodyW - 2, -20, 0, -25);
    ctx.quadraticCurveTo(bodyW + 2, -20, bodyW, -5);
    ctx.lineTo(3, bodyH);
    ctx.lineTo(-3, bodyH);
    ctx.closePath();

    // Base color
    ctx.fillStyle = '#d32f2f';
    ctx.fill();
    ctx.strokeStyle = '#b71c1c';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Stripes
    if (spinning) {
      for (let i = 0; i < 4; i++) {
        const stripeY = -15 + i * 12;
        const w = bodyW * (1 - (stripeY + 15) / (bodyH + 15)) * 0.9;
        ctx.fillStyle = stripeColors[(i + Math.floor(rot)) % stripeColors.length];
        ctx.fillRect(-w, stripeY, w * 2, 6);
      }
    } else {
      // Static stripes
      for (let i = 0; i < 4; i++) {
        const stripeY = -15 + i * 12;
        const w = bodyW * (1 - (stripeY + 15) / (bodyH + 15)) * 0.9;
        ctx.fillStyle = stripeColors[i % stripeColors.length];
        ctx.fillRect(-w, stripeY, w * 2, 6);
      }
    }

    // Metal tip
    ctx.beginPath();
    ctx.moveTo(-3, bodyH);
    ctx.lineTo(0, bodyH + 10);
    ctx.lineTo(3, bodyH);
    ctx.fillStyle = '#bbb';
    ctx.fill();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Top dome highlight
    ctx.beginPath();
    ctx.ellipse(0, -22, bodyW * 0.5, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();

    // Nub on top
    ctx.beginPath();
    ctx.arc(0, -26, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fdd835';
    ctx.fill();
    ctx.strokeStyle = '#f9a825';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  },

  loop() {
    this.update();
    this.draw();
    this.animationId = requestAnimationFrame(() => this.loop());
  },

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
  },

  getControls() {
    return 'Hold to wind up power, release to spin! Move your finger/mouse to nudge the lattu. Collect green boosts for more spin energy. Avoid red obstacles!';
  }
};
