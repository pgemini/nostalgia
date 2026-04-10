// Stapu (Hopscotch) - 3D with Three.js
const StapuGame = {
  scene: null, camera: null, renderer: null,
  container: null, wrapper: null, overlay: null,
  width: 0, height: 0,
  squares: [], playerPos: -1,
  player: null, marker: null,
  state: 'ready',
  markerTarget: 0, currentRound: 0, score: 0,
  hopDirection: 1, balanceBar: 50, balanceDrift: 0,
  hopT: 0, hopFrom: null, hopTo: null,
  animationId: null, onScoreUpdate: null,
  clock: null, ready: false, particles: [],

  init(container, onScoreUpdate) {
    this.container = container;
    this.onScoreUpdate = onScoreUpdate;
    this.width = Math.min(380, window.innerWidth - 40);
    this.height = Math.round(this.width * 1.4);

    this.wrapper = document.createElement('div');
    this.wrapper.style.cssText = `position:relative;width:${this.width}px;height:${this.height}px;`;
    container.appendChild(this.wrapper);
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;font-family:'Baloo 2',sans-serif;z-index:10;`;
    this.wrapper.appendChild(this.overlay);

    if (typeof THREE === 'undefined') {
      this.overlay.innerHTML = '<div style="color:#e65100;background:rgba(255,255,255,0.9);padding:20px;border-radius:10px;">Loading 3D engine...</div>';
      const wait = () => { if (typeof THREE !== 'undefined') this.setup(); else setTimeout(wait, 100); };
      wait();
      return;
    }
    this.setup();
  },

  setup() {
    this.overlay.innerHTML = '';
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xFFD8A0);
    this.scene.fog = new THREE.Fog(0xFFD8A0, 12, 35);

    this.camera = new THREE.PerspectiveCamera(55, this.width / this.height, 0.1, 60);
    this.camera.position.set(0, 7, 7);
    this.camera.lookAt(0, 0, -2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.cssText = 'display:block;border-radius:12px;touch-action:none;';
    this.wrapper.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xFFF2D4, 1);
    sun.position.set(-4, 12, 5);
    sun.castShadow = true;
    sun.shadow.camera.left = -10; sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
    sun.shadow.mapSize.width = 1024; sun.shadow.mapSize.height = 1024;
    this.scene.add(sun);

    // Concrete ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0xB8A890, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Scatter some pebbles
    for (let i = 0; i < 30; i++) {
      const p = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.05 + Math.random() * 0.05),
        new THREE.MeshStandardMaterial({ color: 0x8B7355 })
      );
      p.position.set((Math.random() - 0.5) * 15, 0.03, (Math.random() - 0.5) * 15);
      this.scene.add(p);
    }

    this.createBoard();
    this.createPlayer();
    this.createMarker();

    this.setupEvents();
    this.clock = new THREE.Clock();
    this.reset();
    this.ready = true;
    this.loop();
    this.showReadyScreen();
  },

  createBoard() {
    // Traditional hopscotch layout
    // squares 1 (single), 2-3 (double), 4 (single), 5-6 (double), 7 (single), 8 (single top)
    const sq_size = 1.2;
    const y = 0.02;
    // z positions go negative (forward)
    const layout = [
      { id: 1, x: 0, z: 0, label: '1' },
      { id: 2, x: -sq_size / 2 - 0.05, z: -sq_size - 0.1, label: '2' },
      { id: 3, x: sq_size / 2 + 0.05, z: -sq_size - 0.1, label: '3' },
      { id: 4, x: 0, z: -2 * sq_size - 0.2, label: '4' },
      { id: 5, x: -sq_size / 2 - 0.05, z: -3 * sq_size - 0.3, label: '5' },
      { id: 6, x: sq_size / 2 + 0.05, z: -3 * sq_size - 0.3, label: '6' },
      { id: 7, x: 0, z: -4 * sq_size - 0.4, label: '7' },
      { id: 8, x: 0, z: -5 * sq_size - 0.5, label: '8' },
    ];

    this.squares = [];
    for (const s of layout) {
      // White chalk-like square outline
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(sq_size, sq_size),
        new THREE.MeshStandardMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.3 })
      );
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(s.x, y, s.z);
      this.scene.add(plane);

      // Outline (wireframe edges)
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(sq_size, sq_size)),
        new THREE.LineBasicMaterial({ color: 0xFFFFFF, linewidth: 3 })
      );
      edges.rotation.x = -Math.PI / 2;
      edges.position.set(s.x, y + 0.01, s.z);
      this.scene.add(edges);

      // Number (use CanvasTexture)
      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 80px "Baloo 2", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.label, 64, 72);
      const texture = new THREE.CanvasTexture(canvas);
      const numMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 0.6),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true })
      );
      numMesh.rotation.x = -Math.PI / 2;
      numMesh.position.set(s.x, y + 0.02, s.z);
      this.scene.add(numMesh);

      this.squares.push({ x: s.x, y: 0, z: s.z, label: s.label, id: s.id, type: (s.id === 2 || s.id === 5) ? 'left' : (s.id === 3 || s.id === 6) ? 'right' : 'single' });
    }
  },

  createPlayer() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.5, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xFF6B00 })
    );
    body.position.y = 0.55; body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xF4C88C })
    );
    head.position.y = 0.9;
    group.add(head);
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.8),
      new THREE.MeshStandardMaterial({ color: 0x1A0F08 })
    );
    hair.position.y = 0.92;
    group.add(hair);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1565C0 });
    const ll = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), legMat);
    ll.position.set(-0.08, 0.18, 0);
    group.add(ll); group.leftLeg = ll;
    const rl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), legMat);
    rl.position.set(0.08, 0.18, 0);
    group.add(rl); group.rightLeg = rl;
    group.position.set(0, 0, 1.5);
    this.player = group;
    this.scene.add(group);
  },

  createMarker() {
    this.marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0xE53935, emissive: 0x8B0000, emissiveIntensity: 0.3 })
    );
    this.marker.position.set(0, 0.05, 1.5);
    this.marker.castShadow = true;
    this.marker.visible = false;
    this.scene.add(this.marker);
  },

  setupEvents() {
    this._onTap = (e) => { e.preventDefault(); this.onTap(); };
    const el = this.renderer.domElement;
    el.addEventListener('mousedown', this._onTap);
    el.addEventListener('touchstart', this._onTap, { passive: false });
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
    this.player.position.set(0, 0, 1.5);
    this.marker.visible = false;
    this.updateScore();
    this.showReadyScreen();
  },

  onTap() {
    if (this.state === 'ready') {
      this.state = 'hopping';
      this.playerPos = -1;
      this.hopDirection = 1;
      this.balanceBar = 50;
      this.marker.position.set(this.squares[this.markerTarget].x, 0.05, this.squares[this.markerTarget].z);
      this.marker.visible = true;
      this.hideOverlay();
      if (window.Sounds) Sounds.whoosh();
    } else if (this.state === 'hopping') {
      this.hop();
      if (window.Sounds) Sounds.jump();
    } else if (this.state === 'landed') {
      this.currentRound++;
      if (this.currentRound >= 8) {
        this.state = 'won';
        if (window.Sounds) Sounds.success();
        this.showGameOver(true);
      } else {
        this.markerTarget = this.currentRound;
        this.state = 'ready';
        this.playerPos = -1;
        this.player.position.set(0, 0, 1.5);
        this.showReadyScreen();
      }
      this.updateScore();
    } else if (this.state === 'gameover' || this.state === 'won') {
      this.reset();
      this.hideOverlay();
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
          if (window.Sounds) Sounds.fail();
          this.showGameOver(false);
          return;
        }
        this.score += 10 + this.currentRound * 5;
        this.marker.visible = false;
        if (window.Sounds) Sounds.collect();
        this.updateScore();
        this.playerPos--;
      }
      if (this.playerPos < 0) {
        this.state = 'landed';
        this.showLanded();
        return;
      }
    }

    // Set hop target
    if (this.playerPos >= 0 && this.playerPos < this.squares.length) {
      const sq = this.squares[this.playerPos];
      this.hopFrom = { x: this.player.position.x, z: this.player.position.z };
      this.hopTo = { x: sq.x, z: sq.z };
      this.hopT = 0;

      if (sq.type === 'single') {
        this.balanceDrift = (Math.random() - 0.5) * (2 + this.currentRound * 0.4);
      } else {
        this.balanceDrift = 0;
        this.balanceBar = 50;
      }
    }
  },

  updateScore() {
    if (this.onScoreUpdate) this.onScoreUpdate(`Round ${this.currentRound + 1}/8  |  Score: ${this.score}`);
  },

  update() {
    if (!this.ready) return;
    const dt = Math.min(0.05, this.clock.getDelta());

    // Hop interpolation
    if (this.hopT < 1 && this.hopFrom && this.hopTo) {
      this.hopT = Math.min(1, this.hopT + dt * 4);
      const t = this.hopT;
      this.player.position.x = this.hopFrom.x + (this.hopTo.x - this.hopFrom.x) * t;
      this.player.position.z = this.hopFrom.z + (this.hopTo.z - this.hopFrom.z) * t;
      this.player.position.y = Math.sin(t * Math.PI) * 0.4;
      if (this.hopT >= 1) {
        this.player.position.y = 0;
        // Dust puff
        for (let i = 0; i < 5; i++) {
          const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0xDDDDDD, transparent: true, opacity: 0.8 })
          );
          p.position.set(this.player.position.x, 0.05, this.player.position.z);
          const a = Math.random() * Math.PI * 2;
          this.scene.add(p);
          this.particles.push({
            mesh: p,
            vx: Math.cos(a) * 1.5, vy: 0.5, vz: Math.sin(a) * 1.5,
            life: 0.6
          });
        }
      }
    }

    // Balance on single squares
    if (this.state === 'hopping' && this.playerPos >= 0 && this.playerPos < this.squares.length) {
      const sq = this.squares[this.playerPos];
      if (sq.type === 'single') {
        this.balanceBar += this.balanceDrift;
        // Tilt the player based on balance
        this.player.rotation.z = (this.balanceBar - 50) * 0.015;
        if (this.balanceBar < 5 || this.balanceBar > 95) {
          this.state = 'gameover';
          if (window.Sounds) Sounds.fail();
          this.showGameOver(false);
        }
        this.balanceBar = Math.max(0, Math.min(100, this.balanceBar));
      } else {
        this.player.rotation.z = 0;
      }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 3 * dt;
      p.life -= dt;
      p.mesh.material.opacity = Math.max(0, p.life);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    // Gentle camera follow
    if (this.playerPos >= 0 && this.playerPos < this.squares.length) {
      const targetZ = this.squares[this.playerPos].z + 5;
      const targetY = 6;
      this.camera.position.z += (targetZ - this.camera.position.z) * 0.04;
      this.camera.position.y += (targetY - this.camera.position.y) * 0.04;
      this.camera.lookAt(0, 0, this.squares[this.playerPos].z);
    } else {
      this.camera.position.z += (7 - this.camera.position.z) * 0.04;
      this.camera.lookAt(0, 0, -2);
    }
  },

  showReadyScreen() {
    this.overlay.innerHTML = `<div style="background:rgba(0,0,0,0.6);color:#fff;padding:18px 24px;border-radius:16px;text-align:center;border:3px solid #FFD700;max-width:90%;">
      <div style="font-size:20px;color:#FFD700;font-weight:800;margin-bottom:6px;">Round ${this.currentRound + 1}/8</div>
      <div style="font-size:12px;margin-bottom:10px;line-height:1.5;">Tap to throw the marker.<br>Then tap to hop forward,<br>skip the marker square,<br>then hop back to pick it up!</div>
      <div style="font-size:13px;color:#FFD700;">Tap to start</div>
    </div>`;
  },

  showLanded() {
    this.overlay.innerHTML = `<div style="background:rgba(0,0,0,0.4);color:#fff;padding:18px 24px;border-radius:16px;text-align:center;pointer-events:auto;cursor:pointer;">
      <div style="font-size:22px;color:#FFD700;font-weight:800;margin-bottom:4px;">Bahut Badhiya!</div>
      <div style="font-size:12px;">Tap for next round</div>
    </div>`;
    this.overlay.onclick = () => { this.overlay.onclick = null; this.onTap(); };
  },

  showGameOver(won) {
    this.overlay.innerHTML = `<div style="background:rgba(0,0,0,0.7);color:#fff;padding:24px 32px;border-radius:16px;text-align:center;border:3px solid ${won ? '#FFD700' : '#FF6B00'};max-width:85%;pointer-events:auto;cursor:pointer;">
      <div style="font-size:24px;color:${won ? '#FFD700' : '#FF6B00'};font-weight:800;margin-bottom:8px;">${won ? 'Jeet Gaye!' : 'Oops! You fell!'}</div>
      <div style="font-size:14px;margin-bottom:12px;">Score: ${this.score}</div>
      <div style="font-size:13px;color:#FFD700;">Tap to play again</div>
    </div>`;
    this.overlay.onclick = () => { this.overlay.onclick = null; this.reset(); this.hideOverlay(); };
  },

  hideOverlay() { this.overlay.innerHTML = ''; this.overlay.onclick = null; },

  draw() { if (this.renderer) this.renderer.render(this.scene, this.camera); },

  loop() {
    this.update();
    this.draw();
    this.animationId = requestAnimationFrame(() => this.loop());
  },

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    }
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.scene = null; this.camera = null; this.renderer = null;
    this.ready = false;
  },

  getControls() {
    return 'Tap to throw the marker, then tap to hop square by square. Skip the marker square, hop back and pick it up!'
  }
};
