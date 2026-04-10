// Atya Patya - 3D with Three.js
const AtyaPatyaGame = {
  scene: null, camera: null, renderer: null,
  container: null, wrapper: null, overlay: null,
  width: 0, height: 0,
  player: null, defenders: [], zones: [],
  score: 0, level: 1, lives: 3,
  state: 'ready',
  targetX: 0, targetZ: 0,
  animationId: null, onScoreUpdate: null,
  clock: null, ready: false, particles: [],
  goalZ: 0, startZ: 0,

  init(container, onScoreUpdate) {
    this.container = container;
    this.onScoreUpdate = onScoreUpdate;
    this.width = Math.min(500, window.innerWidth - 40);
    this.height = Math.round(this.width * 1.2);

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
    this.scene.background = new THREE.Color(0xFFE0A0);
    this.scene.fog = new THREE.Fog(0xFFE0A0, 12, 40);

    this.camera = new THREE.PerspectiveCamera(55, this.width / this.height, 0.1, 60);
    this.camera.position.set(0, 9, 6);
    this.camera.lookAt(0, 0, -1);

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

    // Start zone (orange tint)
    this.startZ = 5;
    const startZone = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 2),
      new THREE.MeshStandardMaterial({ color: 0xFF9966, transparent: true, opacity: 0.5 })
    );
    startZone.rotation.x = -Math.PI / 2;
    startZone.position.set(0, 0.01, this.startZ);
    this.scene.add(startZone);

    // Goal zone (green tint)
    this.goalZ = -7;
    const goalZone = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 2),
      new THREE.MeshStandardMaterial({ color: 0x66CC66, transparent: true, opacity: 0.6, emissive: 0x339933, emissiveIntensity: 0.3 })
    );
    goalZone.rotation.x = -Math.PI / 2;
    goalZone.position.set(0, 0.01, this.goalZ);
    this.scene.add(goalZone);

    // Zone lines (chalk)
    for (let i = 0; i < 5; i++) {
      const z = 3 - i * 2;
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 0.1),
        new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.8 })
      );
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.02, z);
      this.scene.add(line);
      this.zones.push({ z, crossed: false });
    }

    this.createPlayer();
    this.setupLevel();
    this.setupEvents();
    this.clock = new THREE.Clock();
    this.ready = true;
    this.loop();
    this.showReadyScreen();
  },

  createPlayer() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.55, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xFF6B00 })
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
    const ll = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), legMat);
    ll.position.set(-0.09, 0.2, 0);
    group.add(ll); group.leftLeg = ll;
    const rl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), legMat);
    rl.position.set(0.09, 0.2, 0);
    group.add(rl); group.rightLeg = rl;
    group.position.set(0, 0, this.startZ);
    this.player = group;
    this.scene.add(group);
  },

  makeDefender(x, z, patrolSpeed) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.55, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xC62828 })
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
    const legMat = new THREE.MeshStandardMaterial({ color: 0x424242 });
    const ll = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), legMat);
    ll.position.set(-0.09, 0.2, 0);
    group.add(ll); group.leftLeg = ll;
    const rl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), legMat);
    rl.position.set(0.09, 0.2, 0);
    group.add(rl); group.rightLeg = rl;
    group.position.set(x, 0, z);
    group.userData = { vx: patrolSpeed };
    this.scene.add(group);
    return group;
  },

  setupLevel() {
    // Remove old defenders
    for (const d of this.defenders) this.scene.remove(d);
    this.defenders = [];

    // Reset zones
    for (const z of this.zones) z.crossed = false;

    // Player back to start
    this.player.position.set(0, 0, this.startZ);
    this.targetX = 0;
    this.targetZ = this.startZ;

    // Spawn defenders in each zone
    const speedBase = 1.5 + this.level * 0.3;
    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i].z - 1; // between lines
      const dir = (i % 2 === 0) ? 1 : -1;
      const startX = dir === 1 ? -4 : 4;
      this.defenders.push(this.makeDefender(startX, z, speedBase * dir));
      // Extra defender on higher levels
      if (this.level >= 2 && i % 2 === 0) {
        this.defenders.push(this.makeDefender(0, z, -speedBase * dir));
      }
    }
    this.updateScore();
  },

  setupEvents() {
    this._onDown = (e) => { e.preventDefault(); this.handleDown(e); };
    this._onMove = (e) => { e.preventDefault(); this.handleMove(e); };
    const el = this.renderer.domElement;
    el.addEventListener('mousedown', this._onDown);
    el.addEventListener('mousemove', this._onMove);
    el.addEventListener('touchstart', this._onDown, { passive: false });
    el.addEventListener('touchmove', this._onMove, { passive: false });
  },

  getPos(e) {
    const t = (e.touches && e.touches.length) ? e.touches[0]
           : (e.changedTouches && e.changedTouches.length) ? e.changedTouches[0] : e;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((t.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((t.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: nx, y: ny }, this.camera);
    const intersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), intersect);
    return { x: intersect.x, z: intersect.z };
  },

  handleDown(e) {
    if (this.state === 'ready') {
      this.state = 'playing';
      this.hideOverlay();
      if (window.Sounds) Sounds.pop();
      return;
    }
    if (this.state === 'caught') {
      if (this.lives > 0) { this.state = 'playing'; this.setupLevel(); this.hideOverlay(); }
      else { this.state = 'gameover'; this.showGameOver(false); }
      return;
    }
    if (this.state === 'won') {
      this.level++;
      this.setupLevel();
      this.state = 'ready';
      this.showReadyScreen();
      return;
    }
    if (this.state === 'gameover') { this.reset(); this.hideOverlay(); return; }
    if (this.state === 'playing') {
      const pos = this.getPos(e);
      this.targetX = Math.max(-4.5, Math.min(4.5, pos.x));
      this.targetZ = Math.max(this.goalZ, Math.min(this.startZ, pos.z));
    }
  },

  handleMove(e) {
    if (this.state !== 'playing') return;
    const pos = this.getPos(e);
    this.targetX = Math.max(-4.5, Math.min(4.5, pos.x));
    this.targetZ = Math.max(this.goalZ, Math.min(this.startZ, pos.z));
  },

  reset() {
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.state = 'ready';
    this.setupLevel();
    this.showReadyScreen();
  },

  updateScore() {
    if (this.onScoreUpdate) this.onScoreUpdate(`Level ${this.level}  |  Score: ${this.score}  |  ${'❤'.repeat(this.lives)}`);
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
      p.vy -= 9 * dt;
      p.life -= dt;
      p.mesh.material.opacity = Math.max(0, p.life);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    if (this.state !== 'playing') return;

    // Smooth player movement
    this.player.position.x += (this.targetX - this.player.position.x) * 5 * dt;
    this.player.position.z += (this.targetZ - this.player.position.z) * 5 * dt;

    // Running animation
    const runPhase = Date.now() * 0.015;
    if (this.player.leftLeg) {
      this.player.leftLeg.rotation.x = Math.sin(runPhase) * 0.6;
      this.player.rightLeg.rotation.x = Math.sin(runPhase + Math.PI) * 0.6;
    }

    // Update defenders
    for (const d of this.defenders) {
      d.position.x += d.userData.vx * dt;
      if (d.position.x < -4.5) { d.position.x = -4.5; d.userData.vx *= -1; }
      if (d.position.x > 4.5) { d.position.x = 4.5; d.userData.vx *= -1; }
      // Running
      d.leftLeg.rotation.x = Math.sin(runPhase * 1.3) * 0.5;
      d.rightLeg.rotation.x = Math.sin(runPhase * 1.3 + Math.PI) * 0.5;
      // Face direction
      d.rotation.y = d.userData.vx > 0 ? Math.PI / 2 : -Math.PI / 2;

      // Collision check
      const dx = d.position.x - this.player.position.x;
      const dz = d.position.z - this.player.position.z;
      if (Math.sqrt(dx * dx + dz * dz) < 0.5) {
        this.lives--;
        if (window.Sounds) Sounds.tag();
        // Burst
        for (let k = 0; k < 12; k++) {
          const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0xE53935, transparent: true, opacity: 1 })
          );
          p.position.set(this.player.position.x, 0.5, this.player.position.z);
          const a = Math.random() * Math.PI * 2;
          this.scene.add(p);
          this.particles.push({
            mesh: p,
            vx: Math.cos(a) * 3, vy: Math.random() * 2, vz: Math.sin(a) * 3,
            life: 1
          });
        }
        this.state = 'caught';
        if (this.lives <= 0) {
          this.state = 'gameover';
          if (window.Sounds) Sounds.fail();
          this.showGameOver(false);
        } else {
          this.showCaught();
        }
        return;
      }
    }

    // Zone crossings
    for (const z of this.zones) {
      if (!z.crossed && this.player.position.z < z.z) {
        z.crossed = true;
        this.score += 10;
        if (window.Sounds) Sounds.boost();
        this.updateScore();
      }
    }

    // Reached goal
    if (this.player.position.z < this.goalZ + 1) {
      this.score += 50 * this.level;
      this.state = 'won';
      if (window.Sounds) Sounds.success();
      this.showGameOver(true);
      this.updateScore();
    }

    // Gentle camera follow
    const targetCamZ = Math.max(-2, this.player.position.z + 5);
    this.camera.position.z += (targetCamZ - this.camera.position.z) * 0.04;
  },

  showReadyScreen() {
    this.overlay.innerHTML = `<div style="background:rgba(0,0,0,0.65);color:#fff;padding:24px 32px;border-radius:16px;text-align:center;border:3px solid #FFD700;max-width:85%;pointer-events:auto;cursor:pointer;">
      <div style="font-size:24px;color:#FFD700;font-weight:800;margin-bottom:8px;">Level ${this.level}</div>
      <div style="font-size:13px;margin-bottom:12px;line-height:1.5;">Drag to move. Reach the GREEN goal at the top!<br>Dodge the red defenders.</div>
      <div style="font-size:14px;color:#FFD700;">Tap to start</div>
    </div>`;
    this.overlay.onclick = () => { this.overlay.onclick = null; this.state = 'playing'; this.hideOverlay(); if (window.Sounds) Sounds.pop(); };
  },

  showCaught() {
    this.overlay.innerHTML = `<div style="background:rgba(198,40,40,0.6);color:#fff;padding:20px 28px;border-radius:16px;text-align:center;pointer-events:auto;cursor:pointer;">
      <div style="font-size:22px;font-weight:800;margin-bottom:6px;">Pakda Gaya!</div>
      <div style="font-size:13px;">Tap to retry</div>
    </div>`;
    this.overlay.onclick = () => { this.overlay.onclick = null; this.state = 'playing'; this.setupLevel(); this.hideOverlay(); };
  },

  showGameOver(won) {
    this.overlay.innerHTML = `<div style="background:rgba(0,0,0,0.7);color:#fff;padding:24px 32px;border-radius:16px;text-align:center;border:3px solid ${won ? '#FFD700' : '#FF6B00'};max-width:85%;pointer-events:auto;cursor:pointer;">
      <div style="font-size:26px;color:${won ? '#FFD700' : '#FF6B00'};font-weight:800;margin-bottom:8px;">${won ? 'Shabaash!' : 'Game Over'}</div>
      <div style="font-size:14px;margin-bottom:12px;">Score: ${this.score}</div>
      <div style="font-size:13px;color:#FFD700;">Tap ${won ? 'for next level' : 'to play again'}</div>
    </div>`;
    this.overlay.onclick = () => {
      this.overlay.onclick = null;
      if (won) { this.level++; this.setupLevel(); this.state = 'ready'; this.showReadyScreen(); }
      else { this.reset(); this.hideOverlay(); }
    };
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
    return 'Drag your player through the zones to reach the green goal at the top. Avoid the patrolling red defenders!'
  }
};
