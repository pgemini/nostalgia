// Kancha (Marbles) - Aim and flick your marble to knock others out of the circle
const KanchaGame = {
  canvas: null,
  ctx: null,
  width: 400,
  height: 500,
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
  state: 'aiming', // aiming, shooting, settling, gameover
  animationId: null,
  friction: 0.985,
  onScoreUpdate: null,

  init(container, onScoreUpdate) {
    this.onScoreUpdate = onScoreUpdate;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.canvas.addEventListener('mousedown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onPointerUp(e));
    this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this.onPointerDown(e.touches[0]); });
    this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); this.onPointerMove(e.touches[0]); });
    this.canvas.addEventListener('touchend', (e) => { e.preventDefault(); this.onPointerUp(e.changedTouches[0]); });

    this.reset();
    this.loop();
  },

  reset() {
    this.score = 0;
    this.shotsLeft = this.shots;
    this.state = 'aiming';
    this.marbles = [];

    // Place marbles inside the circle
    const colors = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#ff8f00', '#00acc1', '#d81b60'];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = 30 + Math.random() * 50;
      this.marbles.push({
        x: this.circleCenter.x + Math.cos(angle) * r,
        y: this.circleCenter.y + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        radius: 12,
        color: colors[i],
        active: true
      });
    }

    // Player marble starts at bottom
    this.player = {
      x: this.width / 2,
      y: this.height - 50,
      vx: 0,
      vy: 0,
      radius: 14,
      color: '#ff6d00',
      active: true
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
    if (this.state !== 'aiming') return;
    const pos = this.getCanvasPos(e);
    const dx = pos.x - this.player.x;
    const dy = pos.y - this.player.y;
    if (Math.sqrt(dx * dx + dy * dy) < 40) {
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

    if (power > 1) {
      const angle = Math.atan2(dy, dx);
      this.player.vx = Math.cos(angle) * power;
      this.player.vy = Math.sin(angle) * power;
      this.state = 'shooting';
      this.shotsLeft--;
      this.updateScore();
    }
    this.aimEnd = null;
  },

  updateScore() {
    if (this.onScoreUpdate) {
      this.onScoreUpdate(`Score: ${this.score} | Shots: ${this.shotsLeft}`);
    }
  },

  update() {
    if (this.state === 'shooting' || this.state === 'settling') {
      // Move player
      this.player.x += this.player.vx;
      this.player.y += this.player.vy;
      this.player.vx *= this.friction;
      this.player.vy *= this.friction;

      // Bounce off walls
      if (this.player.x < this.player.radius) { this.player.x = this.player.radius; this.player.vx *= -0.7; }
      if (this.player.x > this.width - this.player.radius) { this.player.x = this.width - this.player.radius; this.player.vx *= -0.7; }
      if (this.player.y < this.player.radius) { this.player.y = this.player.radius; this.player.vy *= -0.7; }
      if (this.player.y > this.height - this.player.radius) { this.player.y = this.height - this.player.radius; this.player.vy *= -0.7; }

      // Move and collide marbles
      for (const m of this.marbles) {
        if (!m.active) continue;
        m.x += m.vx;
        m.y += m.vy;
        m.vx *= this.friction;
        m.vy *= this.friction;

        // Bounce off walls
        if (m.x < m.radius) { m.x = m.radius; m.vx *= -0.7; }
        if (m.x > this.width - m.radius) { m.x = this.width - m.radius; m.vx *= -0.7; }
        if (m.y < m.radius) { m.y = m.radius; m.vy *= -0.7; }
        if (m.y > this.height - m.radius) { m.y = this.height - m.radius; m.vy *= -0.7; }

        // Collision with player
        const dx = m.x - this.player.x;
        const dy = m.y - this.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = m.radius + this.player.radius;
        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          m.x += nx * overlap * 0.5;
          m.y += ny * overlap * 0.5;
          this.player.x -= nx * overlap * 0.5;
          this.player.y -= ny * overlap * 0.5;

          // Transfer momentum
          const relVx = this.player.vx - m.vx;
          const relVy = this.player.vy - m.vy;
          const relDot = relVx * nx + relVy * ny;
          if (relDot > 0) {
            m.vx += nx * relDot * 0.9;
            m.vy += ny * relDot * 0.9;
            this.player.vx -= nx * relDot * 0.5;
            this.player.vy -= ny * relDot * 0.5;
          }
        }
      }

      // Marble-marble collisions
      for (let i = 0; i < this.marbles.length; i++) {
        for (let j = i + 1; j < this.marbles.length; j++) {
          const a = this.marbles[i];
          const b = this.marbles[j];
          if (!a.active || !b.active) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = a.radius + b.radius;
          if (dist < minDist && dist > 0) {
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
            }
          }
        }
      }

      // Check if marbles left the circle
      for (const m of this.marbles) {
        if (!m.active) continue;
        const dx = m.x - this.circleCenter.x;
        const dy = m.y - this.circleCenter.y;
        if (Math.sqrt(dx * dx + dy * dy) > this.circleRadius + m.radius) {
          m.active = false;
          this.score++;
          this.updateScore();
        }
      }

      // Check if everything settled
      const allSlow = Math.abs(this.player.vx) < 0.2 && Math.abs(this.player.vy) < 0.2 &&
        this.marbles.every(m => !m.active || (Math.abs(m.vx) < 0.2 && Math.abs(m.vy) < 0.2));

      if (allSlow && this.state === 'shooting') {
        this.state = 'settling';
        setTimeout(() => {
          // Check game over
          const activeMarbles = this.marbles.filter(m => m.active).length;
          if (activeMarbles === 0) {
            this.state = 'gameover';
          } else if (this.shotsLeft <= 0) {
            this.state = 'gameover';
          } else {
            // Reset player position
            this.player.x = this.width / 2;
            this.player.y = this.height - 50;
            this.player.vx = 0;
            this.player.vy = 0;
            this.state = 'aiming';
          }
        }, 300);
      }
    }
  },

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Ground
    ctx.fillStyle = '#f0e6d0';
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw some dirt texture
    ctx.fillStyle = 'rgba(180, 160, 120, 0.3)';
    for (let i = 0; i < 40; i++) {
      const x = (i * 97) % this.width;
      const y = (i * 73) % this.height;
      ctx.beginPath();
      ctx.arc(x, y, 1 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }

    // Circle boundary
    ctx.beginPath();
    ctx.arc(this.circleCenter.x, this.circleCenter.y, this.circleRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#8d6e4a';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Fill circle lightly
    ctx.fillStyle = 'rgba(200, 180, 140, 0.2)';
    ctx.fill();

    // Marbles
    for (const m of this.marbles) {
      if (!m.active) continue;
      this.drawMarble(m.x, m.y, m.radius, m.color);
    }

    // Player marble
    this.drawMarble(this.player.x, this.player.y, this.player.radius, this.player.color);

    // Outline player
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y, this.player.radius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 109, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Aim line
    if (this.aiming && this.aimEnd) {
      const dx = this.aimStart.x - this.aimEnd.x;
      const dy = this.aimStart.y - this.aimEnd.y;
      const power = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.15, 18);
      const angle = Math.atan2(dy, dx);

      ctx.beginPath();
      ctx.moveTo(this.player.x, this.player.y);
      ctx.lineTo(
        this.player.x + Math.cos(angle) * power * 8,
        this.player.y + Math.sin(angle) * power * 8
      );
      ctx.strokeStyle = 'rgba(255, 109, 0, 0.6)';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Power indicator
      const barX = 20;
      const barY = this.height - 30;
      const barW = 100;
      const barH = 12;
      const fill = power / 18;
      ctx.fillStyle = '#ddd';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = fill > 0.7 ? '#e53935' : fill > 0.4 ? '#ff9933' : '#43a047';
      ctx.fillRect(barX, barY, barW * fill, barH);
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
      ctx.fillStyle = '#555';
      ctx.font = '10px sans-serif';
      ctx.fillText('Power', barX, barY - 4);
    }

    // Game over overlay
    if (this.state === 'gameover') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);

      const activeLeft = this.marbles.filter(m => m.active).length;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      if (activeLeft === 0) {
        ctx.fillText('Shandar! All Out!', this.width / 2, this.height / 2 - 30);
      } else {
        ctx.fillText('Game Over!', this.width / 2, this.height / 2 - 30);
      }
      ctx.font = '18px sans-serif';
      ctx.fillText(`Score: ${this.score} / 8 kanche`, this.width / 2, this.height / 2 + 10);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#ffcc00';
      ctx.fillText('Tap to play again', this.width / 2, this.height / 2 + 50);
      ctx.textAlign = 'start';

      // Allow restart on click
      this.canvas.onclick = () => {
        this.canvas.onclick = null;
        this.reset();
      };
    }
  },

  drawMarble(x, y, r, color) {
    const ctx = this.ctx;
    // Shadow
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fill();

    // Marble body
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.3, color);
    grad.addColorStop(1, this.darkenColor(color, 40));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Glass shine
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fill();
  },

  darkenColor(hex, amount) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0x00FF) - amount);
    const b = Math.max(0, (num & 0x0000FF) - amount);
    return `rgb(${r},${g},${b})`;
  },

  loop() {
    this.update();
    this.draw();
    this.animationId = requestAnimationFrame(() => this.loop());
  },

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.canvas.onclick = null;
  },

  getControls() {
    return 'Drag from the orange marble to aim & set power, then release to flick! Knock marbles out of the circle.';
  }
};
