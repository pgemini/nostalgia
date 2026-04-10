// Stapu (Hopscotch) - Timing-based hopping game
const StapuGame = {
  canvas: null,
  ctx: null,
  width: 300,
  height: 550,
  squares: [],
  playerPos: -1, // current square index (-1 = start)
  state: 'ready', // ready, hopping, landed, gameover, won
  marker: null, // thrown marker position
  markerTarget: 0, // which square to skip
  currentRound: 0,
  score: 0,
  hopTimer: 0,
  hopDirection: 1, // 1 = going up, -1 = coming back
  balanceBar: 50, // 0-100, must stay in middle zone
  balanceDrift: 0,
  animationId: null,
  onScoreUpdate: null,

  init(container, onScoreUpdate) {
    this.onScoreUpdate = onScoreUpdate;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.canvas.addEventListener('mousedown', (e) => this.onTap(e));
    this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this.onTap(e.touches[0]); });

    this.setupBoard();
    this.reset();
    this.loop();
  },

  setupBoard() {
    // Traditional hopscotch layout:
    // [1] [2] side by side, [3] single, [4][5] side by side, [6] single, [7][8] side by side
    const w = 80;
    const h = 60;
    const cx = this.width / 2;
    const startY = this.height - 80;
    const gap = 4;

    this.squares = [
      { x: cx, y: startY, w: w, h: h, label: '1', type: 'single' },
      { x: cx - w / 2 - gap, y: startY - h - gap, w: w, h: h, label: '2', type: 'left' },
      { x: cx + w / 2 + gap, y: startY - h - gap, w: w, h: h, label: '3', type: 'right' },
      { x: cx, y: startY - 2 * (h + gap), w: w, h: h, label: '4', type: 'single' },
      { x: cx - w / 2 - gap, y: startY - 3 * (h + gap), w: w, h: h, label: '5', type: 'left' },
      { x: cx + w / 2 + gap, y: startY - 3 * (h + gap), w: w, h: h, label: '6', type: 'right' },
      { x: cx, y: startY - 4 * (h + gap), w: w, h: h, label: '7', type: 'single' },
      { x: cx, y: startY - 5 * (h + gap), w: w, h: h, label: '8', type: 'single' },
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
    this.updateScore();
  },

  onTap(e) {
    if (this.state === 'ready') {
      // Throw the marker to the target square
      this.state = 'hopping';
      this.playerPos = -1;
      this.hopDirection = 1;
      this.balanceBar = 50;
      this.balanceDrift = (Math.random() - 0.5) * (1 + this.currentRound * 0.3);
    } else if (this.state === 'hopping') {
      // Tap to hop to next square
      this.hop();
    } else if (this.state === 'landed') {
      // Advance to next round
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
      // Going forward
      this.playerPos++;
      // Skip the marker square
      if (this.playerPos === this.markerTarget) {
        this.playerPos++;
      }
      if (this.playerPos >= this.squares.length) {
        // Reached the end, turn around
        this.hopDirection = -1;
        this.playerPos = this.squares.length - 1;
        // Skip marker on way back too
        if (this.playerPos === this.markerTarget) {
          this.playerPos--;
        }
      }
    } else {
      // Coming back
      this.playerPos--;
      if (this.playerPos === this.markerTarget) {
        // Pick up the marker! Check balance
        if (this.balanceBar < 20 || this.balanceBar > 80) {
          this.state = 'gameover';
          return;
        }
        this.score += 10 + this.currentRound * 5;
        this.updateScore();
        this.playerPos--;
      }
      if (this.playerPos < 0) {
        // Made it back!
        this.state = 'landed';
        return;
      }
    }

    // Balance check on single squares
    if (this.playerPos >= 0 && this.playerPos < this.squares.length) {
      const sq = this.squares[this.playerPos];
      if (sq.type === 'single') {
        this.balanceDrift = (Math.random() - 0.5) * (1.5 + this.currentRound * 0.4);
      }
    }

    // Check bounds
    if (this.playerPos < 0) {
      this.state = 'landed';
    }
  },

  update() {
    if (this.state === 'hopping') {
      // Balance drifts on single squares
      if (this.playerPos >= 0 && this.playerPos < this.squares.length) {
        const sq = this.squares[this.playerPos];
        if (sq.type === 'single') {
          this.balanceBar += this.balanceDrift;
          if (this.balanceBar < 5 || this.balanceBar > 95) {
            this.state = 'gameover';
          }
          this.balanceBar = Math.max(0, Math.min(100, this.balanceBar));
        }
      }
    }
  },

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Ground
    ctx.fillStyle = '#d4c5a9';
    ctx.fillRect(0, 0, this.width, this.height);

    // Chalk texture lines
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
      const y = (i * 31) % this.height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y + 10);
      ctx.stroke();
    }

    // Draw squares
    for (let i = 0; i < this.squares.length; i++) {
      const sq = this.squares[i];
      const isMarker = i === this.markerTarget && this.state !== 'ready';
      const isPlayer = i === this.playerPos;

      // Square outline (chalk-like)
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.strokeRect(sq.x - sq.w / 2, sq.y - sq.h / 2, sq.w, sq.h);

      // Fill
      if (isPlayer) {
        ctx.fillStyle = 'rgba(255, 153, 51, 0.3)';
      } else if (isMarker) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      }
      ctx.fillRect(sq.x - sq.w / 2, sq.y - sq.h / 2, sq.w, sq.h);

      // Number
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sq.label, sq.x, sq.y);

      // Marker (stone/tile piece)
      if (isMarker && this.state !== 'landed') {
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.arc(sq.x, sq.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#922b21';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('M', sq.x, sq.y);
      }

      // Player feet
      if (isPlayer) {
        const sq2 = this.squares[i];
        if (sq2.type === 'single') {
          // One foot
          ctx.fillStyle = '#e65100';
          ctx.beginPath();
          ctx.ellipse(sq2.x, sq2.y + 5, 12, 18, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#bf360c';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = '16px sans-serif';
          ctx.fillText('👣', sq2.x, sq2.y + 5);
        } else {
          ctx.fillStyle = '#e65100';
          ctx.beginPath();
          ctx.ellipse(sq2.x, sq2.y + 5, 12, 18, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#bf360c';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = '16px sans-serif';
          ctx.fillText('👣', sq2.x, sq2.y + 5);
        }
      }
    }
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    // Balance bar (during hopping on single squares)
    if (this.state === 'hopping' && this.playerPos >= 0 && this.playerPos < this.squares.length) {
      const sq = this.squares[this.playerPos];
      if (sq.type === 'single') {
        const barX = 20;
        const barY = 20;
        const barW = this.width - 40;
        const barH = 16;

        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(barX, barY, barW, barH);

        // Safe zone
        ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
        ctx.fillRect(barX + barW * 0.2, barY, barW * 0.6, barH);

        // Danger zones
        ctx.fillStyle = 'rgba(244, 67, 54, 0.3)';
        ctx.fillRect(barX, barY, barW * 0.2, barH);
        ctx.fillRect(barX + barW * 0.8, barY, barW * 0.2, barH);

        // Indicator
        const indicX = barX + (this.balanceBar / 100) * barW;
        ctx.fillStyle = '#e65100';
        ctx.beginPath();
        ctx.arc(indicX, barY + barH / 2, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);

        ctx.fillStyle = '#555';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Balance!', this.width / 2, barY + barH + 14);
        ctx.textAlign = 'start';
      }
    }

    // Instructions
    if (this.state === 'ready') {
      ctx.fillStyle = '#e65100';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Round ${this.currentRound + 1}: Tap to throw marker!`, this.width / 2, 30);
      ctx.textAlign = 'start';
    }

    if (this.state === 'hopping') {
      ctx.fillStyle = '#e65100';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      const dir = this.hopDirection === 1 ? 'Tap to hop forward!' : 'Tap to hop back & pick up marker!';
      ctx.fillText(dir, this.width / 2, this.height - 20);
      ctx.textAlign = 'start';
    }

    if (this.state === 'landed') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Bahut Badhiya!', this.width / 2, this.height / 2 - 10);
      ctx.font = '14px sans-serif';
      ctx.fillText('Tap for next round', this.width / 2, this.height / 2 + 20);
      ctx.textAlign = 'start';
    }

    if (this.state === 'gameover') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Oops! You fell!', this.width / 2, this.height / 2 - 20);
      ctx.font = '16px sans-serif';
      ctx.fillText(`Score: ${this.score}`, this.width / 2, this.height / 2 + 15);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#ffcc00';
      ctx.fillText('Tap to play again', this.width / 2, this.height / 2 + 45);
      ctx.textAlign = 'start';
    }

    if (this.state === 'won') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Jeet Gaye!', this.width / 2, this.height / 2 - 20);
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.fillText(`Final Score: ${this.score}`, this.width / 2, this.height / 2 + 15);
      ctx.font = '13px sans-serif';
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
  },

  getControls() {
    return 'Tap to throw the marker, then tap to hop square by square. Skip the marker square! Keep your balance on single squares. Hop back and pick up the marker to complete the round.';
  }
};
