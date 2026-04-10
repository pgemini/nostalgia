// Kancha (Marbles) - 3D with Three.js
const KanchaGame = {
  scene: null, camera: null, renderer: null,
  container: null, wrapper: null, overlay: null,
  width: 0, height: 0,
  marbles: [], player: null, circleRing: null,
  score: 0, shots: 10, shotsLeft: 10,
  state: 'ready',
  aiming: false, aimStart: null, aimEnd: null,
  animationId: null, onScoreUpdate: null,
  aimLine: null, aimArrow: null,
  clock: null,
  particles: [],
  ready: false,

  init(container, onScoreUpdate) {
    this.container = container;
    this.onScoreUpdate = onScoreUpdate;
    this.width = Math.min(500, window.innerWidth - 40);
    this.height = Math.round(this.width * 1.25);

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
    this.scene.background = new THREE.Color(0xF0D898);
    this.scene.fog = new THREE.Fog(0xF0D898, 15, 45);

    this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 0.1, 80);
    this.camera.position.set(0, 9, 11);
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
    sun.position.set(-5, 12, 6);
    sun.castShadow = true;
    sun.shadow.camera.left = -10; sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
    sun.shadow.mapSize.width = 1024; sun.shadow.mapSize.height = 1024;
    this.scene.add(sun);

    // Ground (dirt)
    const groundGeo = new THREE.PlaneGeometry(40, 40);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xC9A876, roughness: 1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Scattered pebbles (decoration)
    for (let i = 0; i < 40; i++) {
      const p = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.08 + Math.random() * 0.1),
        new THREE.MeshStandardMaterial({ color: 0x8B7355 })
      );
      const angle = Math.random() * Math.PI * 2;
      const r = 6 + Math.random() * 10;
      p.position.set(Math.cos(angle) * r, 0.05, Math.sin(angle) * r);
      p.castShadow = true;
      this.scene.add(p);
    }

    // Chalk circle ring (torus flat on ground)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.5, 0.08, 8, 48),
      new THREE.MeshStandardMaterial({ color: 0xFFFFFF, emissive: 0xFFEEDD, emissiveIntensity: 0.2 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    this.scene.add(ring);
    this.circleRing = ring;

    // Inner circle slight tint
    const innerCircle = new THREE.Mesh(
      new THREE.CircleGeometry(3.5, 32),
      new THREE.MeshBasicMaterial({ color: 0xD4B888, transparent: true, opacity: 0.3 })
    );
    innerCircle.rotation.x = -Math.PI / 2;
    innerCircle.position.y = 0.02;
    this.scene.add(innerCircle);

    // Aim arrow (thin box)
    this.aimArrow = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 2),
      new THREE.MeshBasicMaterial({ color: 0xFF6B00, transparent: true, opacity: 0.8 })
    );
    this.aimArrow.visible = false;
    this.scene.add(this.aimArrow);

    this.createMarbles();
    this.setupEvents();
    this.clock = new THREE.Clock();
    this.reset();
    this.ready = true;
    this.loop();
    this.showReadyScreen();
  },

  createMarbles() {
    const colors = [0xE53935, 0x1E88E5, 0x43A047, 0xFDD835, 0x8E24AA, 0xFF8F00, 0x00ACC1, 0xD81B60];
    this.marbles = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = 0.8 + Math.random() * 1.8;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 24, 16),
        new THREE.MeshStandardMaterial({
          color: colors[i],
          metalness: 0.3, roughness: 0.15,
          emissive: colors[i], emissiveIntensity: 0.1
        })
      );
      mesh.position.set(Math.cos(angle) * r, 0.35, Math.sin(angle) * r);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { vx: 0, vz: 0, active: true, color: colors[i], rotVel: new THREE.Vector3() };
      this.scene.add(mesh);
      this.marbles.push(mesh);
    }

    // Player marble (orange, slightly larger)
    this.player = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 24, 16),
      new THREE.MeshStandardMaterial({
        color: 0xFF6B00,
        metalness: 0.4, roughness: 0.1,
        emissive: 0xFF4500, emissiveIntensity: 0.25
      })
    );
    this.player.position.set(0, 0.4, 5);
    this.player.castShadow = true;
    this.player.userData = { vx: 0, vz: 0 };
    this.scene.add(this.player);
  },

  setupEvents() {
    this._onDown = (e) => { e.preventDefault(); this.handleDown(e); };
    this._onMove = (e) => { e.preventDefault(); this.handleMove(e); };
    this._onUp = (e) => { e.preventDefault(); this.handleUp(e); };
    const el = this.renderer.domElement;
    el.addEventListener('mousedown', this._onDown);
    el.addEventListener('mousemove', this._onMove);
    el.addEventListener('mouseup', this._onUp);
    el.addEventListener('touchstart', this._onDown, { passive: false });
    el.addEventListener('touchmove', this._onMove, { passive: false });
    el.addEventListener('touchend', this._onUp, { passive: false });
  },

  getPos(e) {
    const t = (e.touches && e.touches.length) ? e.touches[0]
           : (e.changedTouches && e.changedTouches.length) ? e.changedTouches[0] : e;
    const rect = this.renderer.domElement.getBoundingClientRect();
    // Project to world on ground plane
    const nx = ((t.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((t.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: nx, y: ny }, this.camera);
    const intersect = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    raycaster.ray.intersectPlane(plane, intersect);
    return { x: intersect.x, z: intersect.z };
  },

  handleDown(e) {
    if (this.state === 'gameover') { this.reset(); this.hideOverlay(); return; }
    if (this.state === 'ready') { this.state = 'aiming_phase'; this.hideOverlay(); }
    if (this.state !== 'aiming_phase') return;
    const pos = this.getPos(e);
    const dx = pos.x - this.player.position.x;
    const dz = pos.z - this.player.position.z;
    if (Math.sqrt(dx * dx + dz * dz) < 2.5) {
      this.aiming = true;
      this.aimStart = { x: this.player.position.x, z: this.player.position.z };
      this.aimEnd = pos;
    }
  },

  handleMove(e) {
    if (!this.aiming) return;
    this.aimEnd = this.getPos(e);
  },

  handleUp(e) {
    if (!this.aiming) return;
    this.aiming = false;
    const end = this.getPos(e);
    const dx = this.aimStart.x - end.x;
    const dz = this.aimStart.z - end.z;
    const power = Math.min(Math.sqrt(dx * dx + dz * dz) * 0.8, 10);
    if (power > 0.3) {
      const angle = Math.atan2(dz, dx);
      this.player.userData.vx = Math.cos(angle) * power;
      this.player.userData.vz = Math.sin(angle) * power;
      this.state = 'shooting';
      this.shotsLeft--;
      if (window.Sounds) Sounds.flick();
      this.updateScore();
    }
    this.aimArrow.visible = false;
  },

  updateScore() {
    if (this.onScoreUpdate) this.onScoreUpdate(`Score: ${this.score} / 8  |  Shots: ${this.shotsLeft}`);
  },

  reset() {
    this.score = 0;
    this.shotsLeft = this.shots;
    this.state = 'ready';
    // Reset marbles
    const colors = [0xE53935, 0x1E88E5, 0x43A047, 0xFDD835, 0x8E24AA, 0xFF8F00, 0x00ACC1, 0xD81B60];
    for (let i = 0; i < this.marbles.length; i++) {
      const m = this.marbles[i];
      const angle = (i / 8) * Math.PI * 2;
      const r = 0.8 + Math.random() * 1.8;
      m.position.set(Math.cos(angle) * r, 0.35, Math.sin(angle) * r);
      m.userData.vx = 0; m.userData.vz = 0; m.userData.active = true;
      m.visible = true;
    }
    this.player.position.set(0, 0.4, 5);
    this.player.userData.vx = 0; this.player.userData.vz = 0;
    this.updateScore();
    this.showReadyScreen();
  },

  update() {
    if (!this.ready) return;
    const dt = this.clock.getDelta();

    // Pulse player marble when aiming
    if (this.state === 'ready' || this.state === 'aiming_phase') {
      const s = 1 + Math.sin(Date.now() * 0.005) * 0.05;
      this.player.scale.set(s, s, s);
    }

    // Aim arrow
    if (this.aiming && this.aimEnd) {
      const dx = this.aimStart.x - this.aimEnd.x;
      const dz = this.aimStart.z - this.aimEnd.z;
      const power = Math.min(Math.sqrt(dx * dx + dz * dz) * 0.8, 10);
      const angle = Math.atan2(dz, dx);
      this.aimArrow.visible = true;
      this.aimArrow.position.set(
        this.player.position.x + Math.cos(angle) * power * 0.3,
        0.4,
        this.player.position.z + Math.sin(angle) * power * 0.3
      );
      this.aimArrow.rotation.y = -angle - Math.PI / 2;
      this.aimArrow.scale.z = Math.max(0.5, power * 0.3);
    }

    if (this.state !== 'shooting') return;

    const friction = Math.pow(0.4, dt);
    // Move player
    this.player.position.x += this.player.userData.vx * dt;
    this.player.position.z += this.player.userData.vz * dt;
    // Roll rotation based on velocity
    this.player.rotation.x += this.player.userData.vz * dt * 2;
    this.player.rotation.z -= this.player.userData.vx * dt * 2;
    this.player.userData.vx *= friction;
    this.player.userData.vz *= friction;

    // Move marbles
    for (const m of this.marbles) {
      if (!m.userData.active) continue;
      m.position.x += m.userData.vx * dt;
      m.position.z += m.userData.vz * dt;
      m.rotation.x += m.userData.vz * dt * 3;
      m.rotation.z -= m.userData.vx * dt * 3;
      m.userData.vx *= friction;
      m.userData.vz *= friction;
    }

    // Collisions: player vs marbles
    for (const m of this.marbles) {
      if (!m.userData.active) continue;
      this.collide(this.player, m);
    }
    // Marble vs marble
    for (let i = 0; i < this.marbles.length; i++) {
      for (let j = i + 1; j < this.marbles.length; j++) {
        if (!this.marbles[i].userData.active || !this.marbles[j].userData.active) continue;
        this.collide(this.marbles[i], this.marbles[j]);
      }
    }

    // Marbles outside circle
    for (const m of this.marbles) {
      if (!m.userData.active) continue;
      const dist = Math.sqrt(m.position.x * m.position.x + m.position.z * m.position.z);
      if (dist > 3.7) {
        m.userData.active = false;
        m.visible = false;
        this.score++;
        this.spawnBurst(m.position.x, 0.4, m.position.z, m.userData.color);
        if (window.Sounds) Sounds.pop();
        this.updateScore();
      }
    }

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

    // Check if settled
    const allSlow = Math.abs(this.player.userData.vx) < 0.2 && Math.abs(this.player.userData.vz) < 0.2 &&
      this.marbles.every(m => !m.userData.active || (Math.abs(m.userData.vx) < 0.2 && Math.abs(m.userData.vz) < 0.2));
    if (allSlow && this.state === 'shooting') {
      const remaining = this.marbles.filter(m => m.userData.active).length;
      if (remaining === 0) {
        this.state = 'gameover';
        if (window.Sounds) Sounds.success();
        setTimeout(() => this.showGameOver(true), 300);
      } else if (this.shotsLeft <= 0) {
        this.state = 'gameover';
        if (window.Sounds) Sounds.fail();
        setTimeout(() => this.showGameOver(false), 300);
      } else {
        // Reset player position
        this.player.position.set(0, 0.4, 5);
        this.player.userData.vx = 0; this.player.userData.vz = 0;
        this.state = 'aiming_phase';
      }
    }
  },

  collide(a, b) {
    const dx = b.position.x - a.position.x;
    const dz = b.position.z - a.position.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const minD = a.geometry.parameters.radius + b.geometry.parameters.radius;
    if (d >= minD || d === 0) return;
    const nx = dx / d, nz = dz / d;
    const overlap = minD - d;
    a.position.x -= nx * overlap * 0.5;
    a.position.z -= nz * overlap * 0.5;
    b.position.x += nx * overlap * 0.5;
    b.position.z += nz * overlap * 0.5;
    const rvx = a.userData.vx - b.userData.vx;
    const rvz = a.userData.vz - b.userData.vz;
    const dot = rvx * nx + rvz * nz;
    if (dot > 0) {
      a.userData.vx -= nx * dot * 0.9;
      a.userData.vz -= nz * dot * 0.9;
      b.userData.vx += nx * dot * 0.9;
      b.userData.vz += nz * dot * 0.9;
      if (Math.abs(dot) > 2 && window.Sounds) Sounds.click();
    }
  },

  spawnBurst(x, y, z, color) {
    for (let i = 0; i < 12; i++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
      );
      p.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 3;
      this.scene.add(p);
      this.particles.push({
        mesh: p,
        vx: Math.cos(a) * s, vy: Math.random() * 3 + 1, vz: Math.sin(a) * s,
        life: 1
      });
    }
  },

  showReadyScreen() {
    this.overlay.innerHTML = `<div style="background:rgba(0,0,0,0.65);color:#fff;padding:24px 32px;border-radius:16px;text-align:center;border:3px solid #FFD700;max-width:85%;">
      <div style="font-size:26px;color:#FFD700;font-weight:800;margin-bottom:8px;">Kanche Nikalo!</div>
      <div style="font-size:14px;margin-bottom:12px;line-height:1.5;">Drag from the orange marble to aim<br>Release to flick. Knock all 8 out of the circle!</div>
      <div style="font-size:16px;color:#FFD700;font-weight:600;">Tap to start</div>
    </div>`;
  },

  showGameOver(won) {
    this.overlay.innerHTML = `<div style="background:rgba(0,0,0,0.7);color:#fff;padding:24px 32px;border-radius:16px;text-align:center;border:3px solid ${won ? '#FFD700' : '#FF6B00'};max-width:85%;pointer-events:auto;cursor:pointer;">
      <div style="font-size:28px;color:${won ? '#FFD700' : '#FF6B00'};font-weight:800;margin-bottom:8px;">${won ? 'Shandar!' : 'Game Over'}</div>
      <div style="font-size:16px;margin-bottom:12px;">${this.score} / 8 kanche out</div>
      <div style="font-size:14px;color:#FFD700;">Tap to play again</div>
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
    this.marbles = []; this.particles = [];
    this.ready = false;
  },

  getControls() {
    return 'Drag from the orange marble to aim and set power, then release to flick. Knock all 8 marbles out of the chalk circle!';
  }
};
