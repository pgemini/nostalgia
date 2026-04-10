// Drop the Handkerchief (Rumaal Jhapatta) - Reaction/timing game
const RumaalGame = {
  canvas: null, ctx: null, width: 400, height: 500, dpr: 1,
  state: 'ready', // ready, walking, dropped, chase, caught, escaped, gameover
  players: [], // kids sitting in circle
  walker: null, // the kid walking around
  walkerAngle: 0,
  walkerSpeed: 0,
  myIndex: 0, // which player is the user
  handkerchief: null, // dropped position
  dropTime: 0,
  reactionStartTime: 0,
  reactionTime: 0,
  score: 0, round: 1, lives: 3,
  chaseProgress: 0,
  animationId: null, onScoreUpdate: null,
  particles: [], floatingTexts: [],
  centerX: 0, centerY: 0, circleRadius: 0,
  dropAngle: 0,
  warningFlash: 0,

  init(container, onScoreUpdate) {
    this.onScoreUpdate = onScoreUpdate;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.min(400, window.innerWidth - 40);
    this.height = Math.round(this.width * 1.15);

    this.canvas = document.createElement('canvas');
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(this.dpr, this.dpr);

    this._onTap = (e) => { e.preventDefault(); this.handleTap(); };
    this.canvas.addEventListener('mousedown', this._onTap);
    this.canvas.addEventListener('touchstart', this._onTap, { passive: false });

    this.centerX = this.width / 2;
    this.centerY = this.height * 0.5;
    this.circleRadius = this.width * 0.32;

    this.reset();
    this.loop();
  },

  reset() {
    this.state = 'ready';
    this.score = 0;
    this.round = 1;
    this.lives = 3;
    this.particles = [];
    this.floatingTexts = [];
    this.setupRound();
  },

  setupRound() {
    this.state = 'ready';
    this.players = [];
    const count = 8;
    // Player is always at the bottom (angle = PI/2)
    this.myIndex = Math.floor(count * 0.25); // will use bottom slot
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.PI / 2;
      this.players.push({
        angle,
        x: this.centerX + Math.cos(angle) * this.circleRadius,
        y: this.centerY + Math.sin(angle) * this.circleRadius,
        color: `hsl(${(i * 45) % 360}, 60%, 55%)`,
        isMe: i === this.myIndex,
        hasHandkerchief: false
      });
    }
    this.walker = { angle: -Math.PI / 2, holdingHandkerchief: true };
    this.walkerAngle = -Math.PI / 2;
    this.walkerSpeed = 0.015 + this.round * 0.003;
    this.handkerchief = null;
    this.dropTime = 0;
    this.chaseProgress = 0;
    this.warningFlash = 0;
    this.updateScore();
  },

  handleTap() {
    if (this.state === 'ready') {
      this.state = 'walking';
      // Random drop time between 2-6 seconds
      this.dropTime = Date.now() + 2000 + Math.random() * 4000;
      Sounds.pop();
      return;
    }
    if (this.state === 'walking') {
      // Early tap = penalty?
      Sounds.fail();
      this.addFloat(this.width / 2, this.height / 2, 'Too Early!', '#E53935');
      this.lives--;
      this.updateScore();
      if (this.lives <= 0) this.state = 'gameover';
      else setTimeout(() => this.setupRound(), 1000);
      return;
    }
    if (this.state === 'dropped') {
      // Player caught the drop in time!
      this.reactionTime = Date.now() - this.reactionStartTime;
      const maxReaction = 1500;
      if (this.reactionTime < maxReaction) {
        const points = Math.max(10, Math.floor(100 - this.reactionTime / 15));
        this.score += points;
        Sounds.catch();
        this.addFloat(this.width / 2, this.height / 2 - 30, `+${points}!`, '#43A047');
        this.addFloat(this.width / 2, this.height / 2, `${this.reactionTime}ms`, '#FFD700');
        this.state = 'escaped';
        for (let i = 0; i < 15; i++) {
          const a = Math.random() * Math.PI * 2;
          this.particles.push({
            x: this.handkerchief.x, y: this.handkerchief.y,
            vx: Math.cos(a) * 3, vy: Math.sin(a) * 3,
            life: 1, decay: 0.03,
            radius: 2, color: '#FFD700'
          });
        }
        this.updateScore();
        setTimeout(() => {
          this.round++;
          this.setupRound();
        }, 1500);
      }
      return;
    }
    if (this.state === 'caught') {
      if (this.lives > 0) {
        this.setupRound();
      } else {
        this.state = 'gameover';
      }
      return;
    }
    if (this.state === 'gameover') {
      this.reset();
      return;
    }
  },

  updateScore() {
    if (this.onScoreUpdate) {
      this.onScoreUpdate(`Round ${this.round}  |  Score: ${this.score}  |  ${'❤'.repeat(this.lives)}`);
    }
  },

  addFloat(x, y, text, color) {
    this.floatingTexts.push({ x, y, text, color, life: 1, vy: -1.2 });
  },

  update() {
    // Particles & floats
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy; p.life -= p.decay;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy; ft.life -= 0.012;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    if (this.warningFlash > 0) this.warningFlash -= 0.04;

    if (this.state === 'walking') {
      this.walkerAngle += this.walkerSpeed;
      if (this.walkerAngle > Math.PI * 1.5) this.walkerAngle -= Math.PI * 2;

      // Check if it's drop time
      if (Date.now() >= this.dropTime) {
        this.dropAngle = this.walkerAngle;
        // Drop behind a random player (might or might not be me)
        const targetPlayer = this.players[Math.floor(Math.random() * this.players.length)];
        const dropX = this.centerX + Math.cos(targetPlayer.angle) * (this.circleRadius + 30);
        const dropY = this.centerY + Math.sin(targetPlayer.angle) * (this.circleRadius + 30);
        this.handkerchief = { x: dropX, y: dropY, behindPlayer: targetPlayer, fallY: 0 };
        targetPlayer.hasHandkerchief = true;

        if (targetPlayer.isMe) {
          this.state = 'dropped';
          this.reactionStartTime = Date.now();
          Sounds.drop();
          this.warningFlash = 1;
        } else {
          // Walker continues - if walker completes circle before you notice, nothing happens
          // For simplicity: in this game, just say "wrong player" and mark as escaped
          this.state = 'escaped';
          this.score += 5;
          this.addFloat(this.width / 2, this.height / 2, 'Safe! Not behind you.', '#43A047');
          this.updateScore();
          setTimeout(() => {
            this.round++;
            this.setupRound();
          }, 1500);
        }
      }
    }

    if (this.state === 'dropped') {
      // Walker keeps going around; player must tap quickly
      this.walkerAngle += this.walkerSpeed * 1.5;
      // Handkerchief falls slightly
      this.handkerchief.fallY = Math.min(15, this.handkerchief.fallY + 0.5);

      // If walker completes full circle without player tapping, player is caught
      const timeElapsed = Date.now() - this.reactionStartTime;
      if (timeElapsed > 2000) {
        this.state = 'caught';
        this.lives--;
        Sounds.fail();
        this.addFloat(this.width / 2, this.height / 2, 'Too Slow!', '#E53935');
        this.updateScore();
      }
    }
  },

  draw() {
    const ctx = this.ctx;

    // Background (playground)
    const bg = ctx.createRadialGradient(this.centerX, this.centerY, 50, this.centerX, this.centerY, this.width);
    bg.addColorStop(0, '#dcc890');
    bg.addColorStop(1, '#a8904c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.warningFlash > 0) {
      ctx.fillStyle = `rgba(255, 0, 0, ${this.warningFlash * 0.3})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // Circle outline (where kids sit)
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, this.circleRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center decoration (rangoli-ish)
    ctx.strokeStyle = 'rgba(255, 107, 0, 0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(this.centerX, this.centerY, 20, a, a + 0.5);
      ctx.stroke();
    }

    // Players sitting in circle
    for (const p of this.players) {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(p.x + 2, p.y + 18, 14, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y + 5, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Head
      ctx.fillStyle = '#f4c88c';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 8, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Face
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(p.x - 2.5, p.y - 9, 1, 0, Math.PI * 2);
      ctx.arc(p.x + 2.5, p.y - 9, 1, 0, Math.PI * 2);
      ctx.fill();

      // Highlight "me"
      if (p.isMe) {
        ctx.strokeStyle = '#FF6B00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y + 2, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#FF6B00';
        ctx.font = `bold ${this.width * 0.025}px Poppins, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('YOU', p.x, p.y + 34);
        ctx.textAlign = 'start';
      }

      // Hair (everyone)
      ctx.fillStyle = '#2a1810';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 12, 9, Math.PI, 0);
      ctx.fill();
    }

    // Handkerchief
    if (this.handkerchief) {
      const h = this.handkerchief;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#E53935';
      ctx.lineWidth = 1.5;
      // Triangle cloth
      ctx.beginPath();
      ctx.moveTo(h.x - 10, h.y + h.fallY);
      ctx.lineTo(h.x + 10, h.y + h.fallY);
      ctx.lineTo(h.x + 8, h.y + 12 + h.fallY);
      ctx.lineTo(h.x - 8, h.y + 12 + h.fallY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Pattern
      ctx.fillStyle = '#E53935';
      ctx.beginPath();
      ctx.arc(h.x, h.y + 5 + h.fallY, 2, 0, Math.PI * 2);
      ctx.fill();

      // Pulse if dropped behind you
      if (this.state === 'dropped') {
        const pulse = 1 + Math.sin(Date.now() * 0.02) * 0.3;
        ctx.strokeStyle = `rgba(255, 0, 0, ${0.8 - (Date.now() - this.reactionStartTime) / 3000})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(h.x, h.y + 5, 25 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Walker
    if (this.state === 'walking' || this.state === 'dropped') {
      const walkerR = this.circleRadius + 30;
      const wx = this.centerX + Math.cos(this.walkerAngle) * walkerR;
      const wy = this.centerY + Math.sin(this.walkerAngle) * walkerR;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(wx + 2, wy + 20, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = '#FF6B00';
      ctx.beginPath();
      ctx.arc(wx, wy + 5, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#BF360C';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Head
      ctx.fillStyle = '#f4c88c';
      ctx.beginPath();
      ctx.arc(wx, wy - 8, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Hair
      ctx.fillStyle = '#2a1810';
      ctx.beginPath();
      ctx.arc(wx, wy - 12, 9, Math.PI, 0);
      ctx.fill();
      // Face
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(wx - 2.5, wy - 9, 1, 0, Math.PI * 2);
      ctx.arc(wx + 2.5, wy - 9, 1, 0, Math.PI * 2);
      ctx.fill();

      // Walker's handkerchief (if still holding)
      if (this.state === 'walking') {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#E53935';
        ctx.lineWidth = 1;
        ctx.fillRect(wx + 8, wy + 10, 10, 10);
        ctx.strokeRect(wx + 8, wy + 10, 10, 10);
      }

      // Legs animation
      const legPhase = Math.sin(Date.now() * 0.02);
      ctx.strokeStyle = '#3b2a1a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(wx - 4, wy + 18);
      ctx.lineTo(wx - 4 + legPhase * 3, wy + 26);
      ctx.moveTo(wx + 4, wy + 18);
      ctx.lineTo(wx + 4 - legPhase * 3, wy + 26);
      ctx.stroke();
    }

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
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
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold ${this.width * 0.06}px Baloo 2, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Rumaal Jhapatta', this.width / 2, this.height * 0.35);
      ctx.fillStyle = '#fff';
      ctx.font = `${this.width * 0.032}px Poppins, sans-serif`;
      ctx.fillText('Watch for the rumaal to drop', this.width / 2, this.height * 0.42);
      ctx.fillText('behind YOU (orange circle).', this.width / 2, this.height * 0.47);
      ctx.fillText('Tap fast to grab it!', this.width / 2, this.height * 0.52);
      ctx.fillStyle = '#FFD700';
      ctx.font = `${this.width * 0.035}px Poppins, sans-serif`;
      ctx.fillText('Tap to start', this.width / 2, this.height * 0.62);
      ctx.textAlign = 'start';
    }

    if (this.state === 'caught') {
      ctx.fillStyle = 'rgba(198, 40, 40, 0.4)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${this.width * 0.06}px Baloo 2, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Bahut Late!', this.width / 2, this.height / 2 - 10);
      ctx.font = `${this.width * 0.03}px Poppins, sans-serif`;
      ctx.fillText(this.lives > 0 ? 'Tap to continue' : 'Game Over', this.width / 2, this.height / 2 + 20);
      ctx.textAlign = 'start';
    }

    if (this.state === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#FF6B00';
      ctx.font = `bold ${this.width * 0.08}px Baloo 2, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', this.width / 2, this.height / 2 - 25);
      ctx.fillStyle = '#fff';
      ctx.font = `${this.width * 0.04}px Poppins, sans-serif`;
      ctx.fillText(`Final Score: ${this.score}`, this.width / 2, this.height / 2 + 10);
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
    this.canvas.removeEventListener('mousedown', this._onTap);
    this.canvas.removeEventListener('touchstart', this._onTap);
  },

  getControls() {
    return 'Watch the walker go around the circle. When they drop the rumaal behind YOU (orange outlined player), TAP FAST to grab it! Don\'t tap early.'
  }
};
