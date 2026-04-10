// Lagori (Seven Stones) - Throw ball to knock down stones, then rebuild the pile
const LagoriGame = {
  canvas: null,
  ctx: null,
  width: 400,
  height: 500,
  state: 'aiming', // aiming, throwing, rebuilding, hit, levelcomplete, gameover, won
  stones: [],
  ball: null,
  player: null,
  enemyBall: null,
  aiming: false,
  aimStart: null,
  aimEnd: null,
  score: 0,
  level: 1,
  lives: 3,
  rebuiltCount: 0,
  totalStones: 7,
  enemyThrowTimer: 0,
  animationId: null,
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
    this.level = 1;
    this.lives = 3;
    this.setupLevel();
    this.updateScore();
  },

  setupLevel() {
    this.state = 'aiming';
    this.rebuiltCount = 0;
    this.stones = [];
    this.enemyBall = null;
    this.enemyThrowTimer = 0;

    // Stack stones in center
    const baseX = this.width / 2;
    const baseY = 200;
    const stoneColors = ['#a0896e', '#8b7355', '#9c8870', '#b09878', '#7a6650', '#887460', '#a89070'];
    for (let i = 0; i < this.totalStones; i++) {
      this.stones.push({
        x: baseX + (Math.random() - 0.5) * 6,
        y: baseY - i * 16,
        width: 36 - i * 2,
        height: 14,
        color: stoneColors[i],
        stacked: true,
        scattered: false,
        rebuilt: false,
        vx: 0,
        vy: 0,
        targetX: baseX,
        targetY: baseY - i * 16,
        groundY: 0
      });
    }

    this.ball = {
      x: this.width / 2,
      y: this.height - 60,
      vx: 0,
      vy: 0,
      radius: 10,
      active: false
    };

    this.player = {
      x: this.width / 2,
      y: this.height - 60,
      width: 30,
      height: 40,
      speed: 3 + this.level * 0.5
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
      // Try to pick up a scattered stone
      for (const s of this.stones) {
        if (s.scattered && !s.rebuilt) {
          const dx = pos.x - s.x;
          const dy = pos.y - s.y;
          if (Math.abs(dx) < 30 && Math.abs(dy) < 20) {
            s.rebuilt = true;
            s.scattered = false;
            this.rebuiltCount++;
            this.score += 10;
            this.updateScore();

            if (this.rebuiltCount >= this.totalStones) {
              this.state = 'levelcomplete';
              this.score += 50 * this.level;
              this.updateScore();
              setTimeout(() => {
                this.level++;
                if (this.level > 5) {
                  this.state = 'won';
                } else {
                  this.setupLevel();
                  this.updateScore();
                }
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
    if (this.aiming) {
      this.aimEnd = this.getCanvasPos(e);
    }
    if (this.state === 'rebuilding') {
      const pos = this.getCanvasPos(e);
      this.player.x = Math.max(15, Math.min(this.width - 15, pos.x));
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
    }
    this.aimEnd = null;
  },

  updateScore() {
    if (this.onScoreUpdate) {
      this.onScoreUpdate(`Level: ${this.level} | Score: ${this.score} | Lives: ${'❤'.repeat(this.lives)}`);
    }
  },

  update() {
    if (this.state === 'throwing') {
      this.ball.x += this.ball.vx;
      this.ball.y += this.ball.vy;
      this.ball.vy += 0.05; // slight gravity

      // Check collision with stacked stones
      let hitAny = false;
      for (const s of this.stones) {
        if (!s.stacked) continue;
        if (this.ball.x > s.x - s.width / 2 && this.ball.x < s.x + s.width / 2 &&
            this.ball.y > s.y - s.height / 2 && this.ball.y < s.y + s.height / 2) {
          hitAny = true;
        }
      }

      if (hitAny) {
        // Scatter all stones
        for (const s of this.stones) {
          s.stacked = false;
          s.scattered = true;
          s.vx = (Math.random() - 0.5) * 8;
          s.vy = -Math.random() * 4 - 2;
          s.groundY = 190 + Math.random() * 80;
        }
        this.ball.active = false;
        setTimeout(() => {
          this.state = 'rebuilding';
          this.enemyThrowTimer = 0;
        }, 800);
      }

      // Ball out of bounds - missed
      if (this.ball.y < -20 || this.ball.x < -20 || this.ball.x > this.width + 20 || this.ball.y > this.height + 20) {
        this.ball.active = false;
        this.ball.x = this.width / 2;
        this.ball.y = this.height - 60;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.state = 'aiming';
      }
    }

    // Scatter animation
    for (const s of this.stones) {
      if (s.scattered) {
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.3;
        s.vx *= 0.98;
        // Bounce on ground
        if (s.y > s.groundY) {
          s.y = s.groundY;
          s.vy *= -0.3;
          if (Math.abs(s.vy) < 0.5) s.vy = 0;
        }
        // Keep in bounds
        if (s.x < 30) s.x = 30;
        if (s.x > this.width - 30) s.x = this.width - 30;
      }
    }

    // Enemy ball throwing during rebuilding
    if (this.state === 'rebuilding') {
      this.enemyThrowTimer++;
      const throwInterval = Math.max(60, 150 - this.level * 20);

      if (this.enemyBall) {
        this.enemyBall.x += this.enemyBall.vx;
        this.enemyBall.y += this.enemyBall.vy;

        // Check if enemy ball hits player
        const dx = this.enemyBall.x - this.player.x;
        const dy = this.enemyBall.y - (this.player.y - 20);
        if (Math.sqrt(dx * dx + dy * dy) < 25) {
          this.lives--;
          this.updateScore();
          this.enemyBall = null;
          if (this.lives <= 0) {
            this.state = 'gameover';
          } else {
            this.state = 'hit';
            setTimeout(() => {
              this.setupLevel();
              this.updateScore();
            }, 1000);
          }
          return;
        }

        // Ball off screen
        if (this.enemyBall.y > this.height + 20 || this.enemyBall.x < -20 || this.enemyBall.x > this.width + 20) {
          this.enemyBall = null;
        }
      }

      if (!this.enemyBall && this.enemyThrowTimer > throwInterval) {
        this.enemyThrowTimer = 0;
        // Throw from random side
        const fromLeft = Math.random() > 0.5;
        const startX = fromLeft ? -10 : this.width + 10;
        const aimX = this.player.x + (Math.random() - 0.5) * 60;
        const aimY = this.player.y - 20;
        const angle = Math.atan2(aimY - 50, aimX - startX);
        const speed = 4 + this.level;
        this.enemyBall = {
          x: startX,
          y: 50 + Math.random() * 50,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 10
        };
      }
    }
  },

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Ground - outdoor field
    const groundGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    groundGrad.addColorStop(0, '#87CEEB');
    groundGrad.addColorStop(0.5, '#b8d4a8');
    groundGrad.addColorStop(1, '#8fbc6a');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Dirt patch in center
    ctx.fillStyle = 'rgba(180, 150, 100, 0.4)';
    ctx.beginPath();
    ctx.ellipse(this.width / 2, 220, 100, 60, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stones
    for (const s of this.stones) {
      if (s.rebuilt) continue; // Hide rebuilt stones from scatter positions
      this.drawStone(s);
    }

    // Draw rebuilt pile
    if (this.state === 'rebuilding' || this.state === 'levelcomplete') {
      const baseX = this.width / 2;
      const baseY = 200;
      for (let i = 0; i < this.rebuiltCount; i++) {
        ctx.fillStyle = '#a0896e';
        ctx.strokeStyle = '#7a6650';
        ctx.lineWidth = 1;
        const w = 36 - i * 2;
        ctx.fillRect(baseX - w / 2, baseY - i * 16 - 7, w, 14);
        ctx.strokeRect(baseX - w / 2, baseY - i * 16 - 7, w, 14);
      }
    }

    // Ball
    if (this.ball.active) {
      ctx.beginPath();
      ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#d32f2f';
      ctx.fill();
      ctx.strokeStyle = '#b71c1c';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Enemy ball
    if (this.enemyBall) {
      ctx.beginPath();
      ctx.arc(this.enemyBall.x, this.enemyBall.y, this.enemyBall.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ff5722';
      ctx.fill();
      ctx.strokeStyle = '#e64a19';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Motion trail
      ctx.beginPath();
      ctx.arc(this.enemyBall.x - this.enemyBall.vx, this.enemyBall.y - this.enemyBall.vy, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 87, 34, 0.3)';
      ctx.fill();
    }

    // Player (during rebuilding)
    if (this.state === 'rebuilding' || this.state === 'hit') {
      this.drawPlayer(this.player.x, this.player.y);
    }

    // Aim line during aiming
    if (this.state === 'aiming') {
      // Draw player at bottom
      this.drawPlayer(this.width / 2, this.height - 40);

      // Draw ball in hand
      if (!this.ball.active) {
        ctx.beginPath();
        ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#d32f2f';
        ctx.fill();
        ctx.strokeStyle = '#b71c1c';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (this.aiming && this.aimEnd) {
        const dx = this.aimStart.x - this.aimEnd.x;
        const dy = this.aimStart.y - this.aimEnd.y;
        const angle = Math.atan2(dy, dx);
        const power = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.12, 14);

        ctx.beginPath();
        ctx.moveTo(this.ball.x, this.ball.y);
        ctx.lineTo(this.ball.x + Math.cos(angle) * power * 10, this.ball.y + Math.sin(angle) * power * 10);
        ctx.strokeStyle = 'rgba(211, 47, 47, 0.6)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Overlays
    if (this.state === 'levelcomplete') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Lagori Complete!', this.width / 2, this.height / 2 - 10);
      ctx.font = '16px sans-serif';
      ctx.fillText(`+${50 * this.level} bonus points!`, this.width / 2, this.height / 2 + 25);
      ctx.textAlign = 'start';
    }

    if (this.state === 'hit') {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OUT! You got hit!', this.width / 2, this.height / 2);
      ctx.textAlign = 'start';
    }

    if (this.state === 'gameover') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over!', this.width / 2, this.height / 2 - 20);
      ctx.font = '16px sans-serif';
      ctx.fillText(`Final Score: ${this.score}`, this.width / 2, this.height / 2 + 15);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#ffcc00';
      ctx.fillText('Tap to play again', this.width / 2, this.height / 2 + 50);
      ctx.textAlign = 'start';
    }

    if (this.state === 'won') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Champion!', this.width / 2, this.height / 2 - 20);
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.fillText(`Score: ${this.score}`, this.width / 2, this.height / 2 + 15);
      ctx.font = '14px sans-serif';
      ctx.fillText('Tap to play again', this.width / 2, this.height / 2 + 50);
      ctx.textAlign = 'start';
    }
  },

  drawStone(s) {
    const ctx = this.ctx;
    ctx.fillStyle = s.color;
    ctx.strokeStyle = '#6b5640';
    ctx.lineWidth = 1;
    ctx.fillRect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height);
    ctx.strokeRect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height);
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height / 3);
  },

  drawPlayer(x, y) {
    const ctx = this.ctx;
    // Simple stick figure
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    // Head
    ctx.beginPath();
    ctx.arc(x, y - 30, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffcc80';
    ctx.fill();
    ctx.stroke();
    // Body
    ctx.beginPath();
    ctx.moveTo(x, y - 22);
    ctx.lineTo(x, y - 5);
    ctx.stroke();
    // Arms
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 18);
    ctx.lineTo(x, y - 14);
    ctx.lineTo(x + 12, y - 18);
    ctx.stroke();
    // Legs
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x - 10, y + 8);
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x + 10, y + 8);
    ctx.stroke();
    ctx.lineCap = 'butt';
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
    return 'Drag to aim & throw the ball at the stones. Then tap scattered stones to rebuild the pile before the enemy ball hits you! Move your player by dragging.';
  }
};
