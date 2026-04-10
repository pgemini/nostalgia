// Rumaal Jhapatta (Drop the Handkerchief) - 3D with Three.js
const RumaalGame = {
  scene: null, camera: null, renderer: null,
  container: null, wrapper: null, overlay: null,
  width: 0, height: 0,
  players: [], walker: null, handkerchief: null, myIndex: 0,
  state: 'ready',
  walkerAngle: 0, walkerSpeed: 0,
  dropTime: 0, reactionStartTime: 0,
  score: 0, round: 1, lives: 3,
  animationId: null, onScoreUpdate: null,
  clock: null, ready: false, particles: [],
  circleRadius: 3,
  warningFlash: 0,
  cameraAngle: 0,

  init(container, onScoreUpdate) {
    this.container = container;
    this.onScoreUpdate = onScoreUpdate;
    this.width = Math.min(500, window.innerWidth - 40);
    this.height = Math.round(this.width * 1.1);

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
    this.scene.fog = new THREE.Fog(0xFFD8A0, 15, 40);

    this.camera = new THREE.PerspectiveCamera(55, this.width / this.height, 0.1, 60);
    this.camera.position.set(0, 8, 7);
    this.camera.lookAt(0, 0, 0);

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

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0xD4B880 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Central rangoli decoration
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const petal = new THREE.Mesh(
        new THREE.CircleGeometry(0.3, 8),
        new THREE.MeshBasicMaterial({ color: [0xFF6B00, 0x1E88E5, 0xFDD835, 0x43A047][i % 4], transparent: true, opacity: 0.6 })
      );
      petal.rotation.x = -Math.PI / 2;
      petal.position.set(Math.cos(angle) * 0.8, 0.02, Math.sin(angle) * 0.8);
      this.scene.add(petal);
    }
    // Center circle
    const center = new THREE.Mesh(
      new THREE.CircleGeometry(0.4, 16),
      new THREE.MeshBasicMaterial({ color: 0xFF6B00 })
    );
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.03;
    this.scene.add(center);

    this.createPlayers();
    this.createWalker();
    this.createHandkerchief();

    this.setupEvents();
    this.clock = new THREE.Clock();
    this.reset();
    this.ready = true;
    this.loop();
    this.showReadyScreen();
  },

  createPlayers() {
    const count = 8;
    this.myIndex = 0;
    const colors = [0xFF6B00, 0x1E88E5, 0xFDD835, 0x43A047, 0x8E24AA, 0x00ACC1, 0xE91E63, 0xFF9800];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.PI / 2; // start at bottom
      const group = new THREE.Group();
      // Sitting pose: body only slightly above ground
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.4, 0.25),
        new THREE.MeshStandardMaterial({ color: colors[i] })
      );
      body.position.y = 0.3;
      body.castShadow = true;
      group.add(body);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xF4C88C })
      );
      head.position.y = 0.6;
      group.add(head);
      const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.8),
        new THREE.MeshStandardMaterial({ color: 0x1A0F08 })
      );
      hair.position.y = 0.62;
      group.add(hair);

      // Highlight "YOU"
      if (i === this.myIndex) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.45, 0.05, 8, 24),
          new THREE.MeshBasicMaterial({ color: 0xFF6B00, transparent: true, opacity: 0.8 })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.03;
        group.add(ring);
        group.userData = { isMe: true, ring };
      } else {
        group.userData = { isMe: false };
      }

      group.position.set(
        Math.cos(angle) * this.circleRadius,
        0,
        Math.sin(angle) * this.circleRadius
      );
      group.rotation.y = -angle + Math.PI;
      group.userData.angle = angle;
      this.players.push(group);
      this.scene.add(group);
    }
  },

  createWalker() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.55, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xFF3D00 })
    );
    body.position.y = 0.6; body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xF4C88C })
    );
    head.position.y = 1;
    group.add(head);
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.8),
      new THREE.MeshStandardMaterial({ color: 0x1A0F08 })
    );
    hair.position.y = 1.02;
    group.add(hair);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1565C0 });
    const ll = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), legMat);
    ll.position.set(-0.08, 0.2, 0);
    group.add(ll); group.leftLeg = ll;
    const rl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), legMat);
    rl.position.set(0.08, 0.2, 0);
    group.add(rl); group.rightLeg = rl;

    // Handkerchief in walker's hand
    const walkerHanky = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.18),
      new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide })
    );
    walkerHanky.position.set(0.3, 0.65, 0);
    walkerHanky.rotation.z = Math.PI / 4;
    group.add(walkerHanky);
    group.userData = { hanky: walkerHanky };

    this.walker = group;
    this.scene.add(group);
  },

  createHandkerchief() {
    this.handkerchief = new THREE.Mesh(
      new THREE.PlaneGeometry(0.25, 0.25),
      new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide })
    );
    this.handkerchief.rotation.x = -Math.PI / 2;
    this.handkerchief.position.y = 0.04;
    this.handkerchief.visible = false;
    this.handkerchief.userData = { fallY: 0 };
    this.scene.add(this.handkerchief);
  },

  setupEvents() {
    this._onTap = (e) => { e.preventDefault(); this.handleTap(); };
    const el = this.renderer.domElement;
    el.addEventListener('mousedown', this._onTap);
    el.addEventListener('touchstart', this._onTap, { passive: false });
  },

  reset() {
    this.score = 0;
    this.round = 1;
    this.lives = 3;
    this.setupRound();
  },

  setupRound() {
    this.state = 'ready';
    this.walkerAngle = -Math.PI / 2;
    this.walkerSpeed = 0.35 + this.round * 0.05;
    this.dropTime = 0;
    this.handkerchief.visible = false;
    this.warningFlash = 0;
    this.walker.userData.hanky.visible = true;
    this.updateScore();
    this.showReadyScreen();
  },

  handleTap() {
    if (this.state === 'ready') {
      this.state = 'walking';
      this.dropTime = Date.now() + 2000 + Math.random() * 4000;
      this.hideOverlay();
      if (window.Sounds) Sounds.pop();
      return;
    }
    if (this.state === 'walking') {
      // Too early
      if (window.Sounds) Sounds.fail();
      this.lives--;
      this.updateScore();
      if (this.lives <= 0) {
        this.state = 'gameover';
        this.showGameOver();
      } else {
        this.showMessage('Too Early!', '#E53935');
        setTimeout(() => this.setupRound(), 1000);
      }
      return;
    }
    if (this.state === 'dropped') {
      const reactionTime = Date.now() - this.reactionStartTime;
      if (reactionTime < 1500) {
        const points = Math.max(10, Math.floor(100 - reactionTime / 15));
        this.score += points;
        if (window.Sounds) Sounds.catch();
        // Burst
        for (let i = 0; i < 15; i++) {
          const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 1 })
          );
          p.position.copy(this.handkerchief.position);
          const a = Math.random() * Math.PI * 2;
          this.scene.add(p);
          this.particles.push({
            mesh: p,
            vx: Math.cos(a) * 2, vy: Math.random() * 2 + 1, vz: Math.sin(a) * 2,
            life: 1
          });
        }
        this.updateScore();
        this.showMessage('+' + points + '!  ' + reactionTime + 'ms', '#43A047');
        this.state = 'escaped';
        setTimeout(() => { this.round++; this.setupRound(); }, 1500);
      }
      return;
    }
    if (this.state === 'caught') {
      if (this.lives > 0) this.setupRound();
      else { this.state = 'gameover'; this.showGameOver(); }
      return;
    }
    if (this.state === 'gameover') { this.reset(); this.hideOverlay(); }
  },

  updateScore() {
    if (this.onScoreUpdate) this.onScoreUpdate(`Round ${this.round}  |  Score: ${this.score}  |  ${'❤'.repeat(this.lives)}`);
  },

  update() {
    if (!this.ready) return;
    const dt = Math.min(0.05, this.clock.getDelta());

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 6 * dt;
      p.life -= dt;
      p.mesh.material.opacity = Math.max(0, p.life);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    // Warning flash
    if (this.warningFlash > 0) this.warningFlash -= dt * 2;

    // Pulse the "you" ring
    for (const p of this.players) {
      if (p.userData.isMe && p.userData.ring) {
        p.userData.ring.scale.x = p.userData.ring.scale.y = 1 + Math.sin(Date.now() * 0.005) * 0.1;
        if (this.state === 'dropped') {
          p.userData.ring.material.color.setHex(0xFF0000);
        } else {
          p.userData.ring.material.color.setHex(0xFF6B00);
        }
      }
    }

    if (this.state === 'walking' || this.state === 'dropped') {
      // Walk walker around the circle
      this.walkerAngle += this.walkerSpeed * dt;
      const r = this.circleRadius + 1;
      this.walker.position.x = Math.cos(this.walkerAngle) * r;
      this.walker.position.z = Math.sin(this.walkerAngle) * r;
      this.walker.rotation.y = -this.walkerAngle + Math.PI / 2;

      // Animate legs
      const phase = Date.now() * 0.015;
      this.walker.leftLeg.rotation.x = Math.sin(phase) * 0.6;
      this.walker.rightLeg.rotation.x = Math.sin(phase + Math.PI) * 0.6;

      // Check if drop time
      if (this.state === 'walking' && Date.now() >= this.dropTime) {
        // Drop behind random player
        const targetIdx = Math.floor(Math.random() * this.players.length);
        const target = this.players[targetIdx];
        // Position hanky just behind that player (outside the circle)
        const behind = new THREE.Vector3();
        const angleBehind = target.userData.angle;
        const rBehind = this.circleRadius + 0.7;
        this.handkerchief.position.set(
          Math.cos(angleBehind) * rBehind,
          0.04,
          Math.sin(angleBehind) * rBehind
        );
        this.handkerchief.visible = true;
        this.walker.userData.hanky.visible = false;
        if (window.Sounds) Sounds.drop();

        if (targetIdx === this.myIndex) {
          this.state = 'dropped';
          this.reactionStartTime = Date.now();
          this.warningFlash = 1;
        } else {
          // Dropped behind someone else, player is safe
          this.state = 'escaped';
          this.score += 5;
          this.updateScore();
          this.showMessage('Safe! Not your turn.', '#43A047');
          setTimeout(() => { this.round++; this.setupRound(); }, 1500);
        }
      }

      // If walker completes a full circle while in dropped state, player is caught
      if (this.state === 'dropped' && Date.now() - this.reactionStartTime > 2000) {
        this.lives--;
        if (window.Sounds) Sounds.fail();
        this.updateScore();
        this.state = 'caught';
        this.showMessage('Too Slow!', '#E53935');
        if (this.lives <= 0) {
          setTimeout(() => { this.state = 'gameover'; this.showGameOver(); }, 800);
        } else {
          setTimeout(() => this.setupRound(), 1200);
        }
      }
    }

    // Idle breathing on sitting kids
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      p.position.y = Math.sin(Date.now() * 0.002 + i * 0.5) * 0.03;
    }

    // Gentle camera rotation
    this.cameraAngle += dt * 0.05;
    this.camera.position.x = Math.sin(this.cameraAngle) * 0.8;
    this.camera.lookAt(0, 0, 0);
  },

  showReadyScreen() {
    this.overlay.innerHTML = `<div style="background:rgba(0,0,0,0.65);color:#fff;padding:20px 28px;border-radius:16px;text-align:center;border:3px solid #FFD700;max-width:85%;pointer-events:auto;cursor:pointer;">
      <div style="font-size:22px;color:#FFD700;font-weight:800;margin-bottom:8px;">Rumaal Jhapatta</div>
      <div style="font-size:12px;margin-bottom:10px;line-height:1.5;">Watch the walker circle.<br>When rumaal drops behind YOU (orange ring),<br>TAP FAST to grab it!<br>Don't tap early!</div>
      <div style="font-size:13px;color:#FFD700;">Tap to start</div>
    </div>`;
    this.overlay.onclick = () => { this.overlay.onclick = null; this.handleTap(); };
  },

  showMessage(text, color) {
    this.overlay.innerHTML = `<div style="background:rgba(0,0,0,0.5);color:#fff;padding:16px 24px;border-radius:16px;text-align:center;">
      <div style="font-size:22px;color:${color};font-weight:800;">${text}</div>
    </div>`;
    setTimeout(() => { if (this.state !== 'gameover') this.hideOverlay(); }, 1200);
  },

  showGameOver() {
    this.overlay.innerHTML = `<div style="background:rgba(0,0,0,0.7);color:#fff;padding:24px 32px;border-radius:16px;text-align:center;border:3px solid #FF6B00;max-width:85%;pointer-events:auto;cursor:pointer;">
      <div style="font-size:26px;color:#FF6B00;font-weight:800;margin-bottom:8px;">Game Over</div>
      <div style="font-size:14px;margin-bottom:12px;">Final Score: ${this.score}</div>
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
    this.players = []; this.walker = null; this.handkerchief = null;
    this.ready = false;
  },

  getControls() {
    return 'Watch the walker circle. When the rumaal drops behind YOU (orange ring), TAP FAST to catch them. Don\'t tap too early!'
  }
};
