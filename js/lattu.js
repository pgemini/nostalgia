// Lattu (Spinning Top) - 3D with Three.js
const LattuGame = {
  scene: null, camera: null, renderer: null,
  container: null, wrapper: null, overlay: null, powerBar: null,
  width: 0, height: 0,
  lattu: null, lattuBody: null,
  state: 'winding', // winding, spinning, gameover
  windPower: 0, windDir: 1, holding: false,
  spinSpeed: 0, rotation: 0,
  score: 0, scoreTimer: 0,
  boosts: [], obstacles: [], particles: [], scuffs: [],
  spawnTimer: 0,
  animationId: null, onScoreUpdate: null,
  clock: null,
  targetX: 0, targetZ: 0,
  ready: false,

  init(container, onScoreUpdate) {
    this.container = container;
    this.onScoreUpdate = onScoreUpdate;
    this.width = Math.min(450, window.innerWidth - 40);
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
    this.scene.background = new THREE.Color(0xFFE8C0);
    this.scene.fog = new THREE.Fog(0xFFE8C0, 12, 35);

    this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 0.1, 60);
    this.camera.position.set(0, 6, 8);
    this.camera.lookAt(0, 0.5, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.cssText = 'display:block;border-radius:12px;touch-action:none;';
    this.wrapper.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xFFF0D0, 0.9);
    sun.position.set(-4, 10, 5);
    sun.castShadow = true;
    sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
    sun.shadow.mapSize.width = 1024; sun.shadow.mapSize.height = 1024;
    this.scene.add(sun);
    const spot = new THREE.PointLight(0xFFFFEE, 0.5, 20);
    spot.position.set(0, 6, 2);
    this.scene.add(spot);

    // Wooden floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0xC8956D, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Wood plank lines
    for (let i = -14; i <= 14; i += 2) {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(0.03, 30),
        new THREE.MeshBasicMaterial({ color: 0x8B6F47 })
      );
      line.rotation.x = -Math.PI / 2;
      line.position.set(i, 0.01, 0);
      this.scene.add(line);
    }

    // Walls suggestion (distant)
    for (let side of [-1, 1]) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 4, 25),
        new THREE.MeshStandardMaterial({ color: 0xFFE4B5 })
      );
      wall.position.set(side * 10, 2, 0);
      this.scene.add(wall);
    }

    this.createLattu();
    this.setupEvents();
    this.clock = new THREE.Clock();
    this.reset();
    this.ready = true;
    this.loop();
    this.showReadyScreen();
  },

  createLattu() {
    const group = new THREE.Group();

    // Main body - bulbous wooden top
    const bodyGroup = new THREE.Group();
    // Upper part (sphere truncated)
    const upper = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({ color: 0xD32F2F, roughness: 0.4 })
    );
    upper.position.y = 0;
    upper.castShadow = true;
    bodyGroup.add(upper);

    // Middle ring (blue stripe)
    const ring1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.47, 0.15, 20),
      new THREE.MeshStandardMaterial({ color: 0x1E88E5 })
    );
    ring1.position.y = -0.07;
    bodyGroup.add(ring1);

    // Yellow stripe
    const ring2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.47, 0.42, 0.12, 20),
      new THREE.MeshStandardMaterial({ color: 0xFDD835 })
    );
    ring2.position.y = -0.2;
    bodyGroup.add(ring2);

    // Green stripe
    const ring3 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.32, 0.15, 20),
      new THREE.MeshStandardMaterial({ color: 0x43A047 })
    );
    ring3.position.y = -0.33;
    bodyGroup.add(ring3);

    // Lower tapering cone
    const lower = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.4, 16),
      new THREE.MeshStandardMaterial({ color: 0x8B4513 })
    );
    lower.position.y = -0.6;
    lower.rotation.x = Math.PI;
    bodyGroup.add(lower);

    // Metal tip
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xCCCCCC, metalness: 0.9, roughness: 0.15 })
    );
    tip.position.y = -0.9;
    tip.rotation.x = Math.PI;
    bodyGroup.add(tip);

    // Top gold nub
    const nub = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.7, roughness: 0.2 })
    );
    nub.position.y = 0.22;
    bodyGroup.add(nub);

    this.lattuBody = bodyGroup;
    group.add(bodyGroup);
    group.position.y = 0.9;

    this.lattu = group;
    this.scene.add(group);
  },

  setupEvents() {
    this._onDown = (e) => { e.preventDefault(); this.handleDown(e); };
    this._onUp = (e) => { e.preventDefault(); this.handleUp(e); };
    this._onMove = (e) => { e.preventDefault(); this.handleMove(e); };
    const el = this.renderer.domElement;
    el.addEventListener('mousedown', this._onDown);
    el.addEventListener('mouseup', this._onUp);
    el.addEventListener('mousemove', this._onMove);
    el.addEventListener('touchstart', this._onDown, { passive: false });
    el.addEventListener('touchend', this._onUp, { passive: false });
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
    this.holding = true;
    if (this.state === 'gameover') { this.reset(); this.hideOverlay(); }
  },

  handleUp(e) {
    this.holding = false;
    if (this.state === 'winding' && this.windPower > 20) {
      this.state = 'spinning';
      this.spinSpeed = this.windPower;
      this.hideOverlay();
      if (window.Sounds) Sounds.spin();
    }
  },

  handleMove(e) {
    if (this.state === 'spinning') {
      const pos = this.getPos(e);
      this.targetX = Math.max(-4, Math.min(4, pos.x));
      this.targetZ = Math.max(-3, Math.min(3, pos.z));
    }
  },

  reset() {
    this.state = 'winding';
    this.windPower = 0;
    this.windDir = 1;
    this.spinSpeed = 0;
    this.score = 0;
    this.scoreTimer = 0;
    this.spawnTimer = 0;
    for (const b of this.boosts) this.scene.remove(b);
    for (const o of this.obstacles) this.scene.remove(o);
    for (const p of this.particles) this.scene.remove(p.mesh);
    for (const s of this.scuffs) this.scene.remove(s);
    this.boosts = []; this.obstacles = []; this.particles = []; this.scuffs = [];
    this.lattu.position.set(0, 0.9, 0);
    this.lattu.rotation.z = 0;
    this.targetX = 0; this.targetZ = 0;
    this.updateScore();
    this.showReadyScreen();
  },

  updateScore() {
    if (this.onScoreUpdate) this.onScoreUpdate(`Score: ${this.score}  |  Spin: ${Math.round(this.spinSpeed)}%`);
  },

  spawnBoost() {
    const isPoint = Math.random() < 0.3;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 16, 16),
      new THREE.MeshStandardMaterial({
        color: isPoint ? 0xFFD700 : 0x43A047,
        emissive: isPoint ? 0xFFAA00 : 0x2E7D32,
        emissiveIntensity: 0.6,
        metalness: 0.5, roughness: 0.2
      })
    );
    mesh.position.set((Math.random() - 0.5) * 7, 0.8, (Math.random() - 0.5) * 5);
    mesh.userData = { life: 8, type: isPoint ? 'point' : 'spin', phase: Math.random() * Math.PI * 2 };
    this.boosts.push(mesh);
    this.scene.add(mesh);
  },

  spawnObstacle() {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshStandardMaterial({
        color: 0xE53935,
        emissive: 0xAA1010, emissiveIntensity: 0.5
      })
    );
    mesh.position.set((Math.random() - 0.5) * 7, 0.4, (Math.random() - 0.5) * 5);
    mesh.castShadow = true;
    mesh.userData = { life: 10, phase: Math.random() * Math.PI * 2 };
    this.obstacles.push(mesh);
    this.scene.add(mesh);
  },

  spawnSparks(x, y, z, color) {
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 6, 6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
      );
      p.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 2;
      this.scene.add(p);
      this.particles.push({
        mesh: p,
        vx: Math.cos(a) * s, vy: Math.random() * 2 + 0.5, vz: Math.sin(a) * s,
        life: 0.8
      });
    }
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
      p.vy -= 8 * dt;
      p.life -= dt;
      p.mesh.material.opacity = Math.max(0, p.life);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    // Scuffs fade
    for (let i = this.scuffs.length - 1; i >= 0; i--) {
      const s = this.scuffs[i];
      s.userData.life -= dt;
      s.material.opacity = Math.max(0, s.userData.life * 0.4);
      if (s.userData.life <= 0) {
        this.scene.remove(s);
        s.geometry.dispose();
        s.material.dispose();
        this.scuffs.splice(i, 1);
      }
    }

    if (this.state === 'winding') {
      if (this.holding) {
        this.windPower += this.windDir * 80 * dt;
        if (this.windPower >= 100) this.windDir = -1;
        if (this.windPower <= 0) this.windDir = 1;
      }
      // Pulse the lattu slightly
      const s = 1 + Math.sin(Date.now() * 0.004) * 0.04;
      this.lattu.scale.set(s, s, s);
      this.updatePowerBar();
      return;
    }

    if (this.state !== 'spinning') return;

    // Decay spin
    this.spinSpeed -= (0.08 + (100 - this.spinSpeed) * 0.001) * 60 * dt;
    this.rotation += this.spinSpeed * 3 * dt;
    this.lattuBody.rotation.y = this.rotation;

    // Wobble
    const wobble = Math.max(0, (60 - this.spinSpeed) * 0.01);
    this.lattu.rotation.z = Math.sin(Date.now() * 0.01) * wobble;
    this.lattu.rotation.x = Math.cos(Date.now() * 0.012) * wobble;

    // Move towards target
    this.lattu.position.x += (this.targetX - this.lattu.position.x) * 2 * dt;
    this.lattu.position.z += (this.targetZ - this.lattu.position.z) * 2 * dt;

    // Scuff mark trail
    if (this.spinSpeed > 10 && Math.random() < 0.3) {
      const sc = new THREE.Mesh(
        new THREE.CircleGeometry(0.12, 8),
        new THREE.MeshBasicMaterial({ color: 0x6B4423, transparent: true, opacity: 0.4 })
      );
      sc.rotation.x = -Math.PI / 2;
      sc.position.set(this.lattu.position.x, 0.02, this.lattu.position.z);
      sc.userData = { life: 2 };
      this.scuffs.push(sc);
      this.scene.add(sc);
    }

    // Sparks from tip when spinning fast
    if (this.spinSpeed > 40 && Math.random() < 0.2) {
      this.spawnSparks(
        this.lattu.position.x + (Math.random() - 0.5) * 0.1,
        0.1,
        this.lattu.position.z + (Math.random() - 0.5) * 0.1,
        0xFFD700
      );
    }

    // Score timer
    this.scoreTimer += dt;
    if (this.scoreTimer > 0.5) {
      this.scoreTimer = 0;
      this.score += Math.ceil(this.spinSpeed / 20);
      this.updateScore();
    }

    // Spawn boosts/obstacles
    this.spawnTimer += dt;
    if (this.spawnTimer > 2.5) {
      this.spawnTimer = 0;
      this.spawnBoost();
      if (this.score > 10) this.spawnObstacle();
    }

    // Update boosts
    for (let i = this.boosts.length - 1; i >= 0; i--) {
      const b = this.boosts[i];
      b.userData.life -= dt;
      b.userData.phase += dt * 3;
      b.position.y = 0.8 + Math.sin(b.userData.phase) * 0.15;
      b.rotation.y += dt * 2;
      if (b.userData.life <= 0) {
        this.scene.remove(b);
        b.geometry.dispose();
        b.material.dispose();
        this.boosts.splice(i, 1);
        continue;
      }
      const dx = b.position.x - this.lattu.position.x;
      const dz = b.position.z - this.lattu.position.z;
      if (Math.sqrt(dx * dx + dz * dz) < 0.7) {
        if (b.userData.type === 'spin') {
          this.spinSpeed = Math.min(100, this.spinSpeed + 25);
          this.spawnSparks(b.position.x, b.position.y, b.position.z, 0x43A047);
          if (window.Sounds) Sounds.boost();
        } else {
          this.score += 25;
          this.spawnSparks(b.position.x, b.position.y, b.position.z, 0xFFD700);
          if (window.Sounds) Sounds.coin();
        }
        this.scene.remove(b);
        b.geometry.dispose();
        b.material.dispose();
        this.boosts.splice(i, 1);
        this.updateScore();
      }
    }

    // Update obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.userData.life -= dt;
      o.rotation.y += dt * 2;
      o.rotation.x += dt;
      if (o.userData.life <= 0) {
        this.scene.remove(o);
        o.geometry.dispose();
        o.material.dispose();
        this.obstacles.splice(i, 1);
        continue;
      }
      const dx = o.position.x - this.lattu.position.x;
      const dz = o.position.z - this.lattu.position.z;
      if (Math.sqrt(dx * dx + dz * dz) < 0.7) {
        this.spinSpeed = Math.max(0, this.spinSpeed - 30);
        this.spawnSparks(o.position.x, o.position.y, o.position.z, 0xE53935);
        this.scene.remove(o);
        o.geometry.dispose();
        o.material.dispose();
        this.obstacles.splice(i, 1);
        if (window.Sounds) Sounds.hit();
        this.updateScore();
      }
    }

    if (this.spinSpeed <= 0) {
      this.spinSpeed = 0;
      this.state = 'gameover';
      if (window.Sounds) Sounds.fail();
      this.lattu.rotation.z = Math.PI / 2;
      this.lattu.position.y = 0.3;
      this.showGameOver();
    }

    // Camera gentle follow
    this.camera.position.x += (this.lattu.position.x * 0.4 - this.camera.position.x) * 0.05;
    this.camera.lookAt(this.lattu.position.x * 0.3, 0.5, this.lattu.position.z * 0.3);
    this.updateScore();
  },

  updatePowerBar() {
    if (!this.overlay.firstChild) return;
    const bar = this.overlay.querySelector('#power-fill');
    if (bar) bar.style.width = this.windPower + '%';
  },

  showReadyScreen() {
    this.overlay.innerHTML = `<div style="background:rgba(0,0,0,0.65);color:#fff;padding:24px 32px;border-radius:16px;text-align:center;border:3px solid #FFD700;max-width:90%;">
      <div style="font-size:24px;color:#FFD700;font-weight:800;margin-bottom:8px;">Lattu Ghumao!</div>
      <div style="font-size:13px;margin-bottom:12px;line-height:1.5;">HOLD to wind up, RELEASE to spin<br>Drag to move • Collect boosts, dodge obstacles</div>
      <div style="width:200px;height:16px;background:#333;border-radius:8px;margin:8px auto;overflow:hidden;">
        <div id="power-fill" style="width:0%;height:100%;background:linear-gradient(90deg,#43A047,#FFD700,#E53935);transition:width 0.05s;"></div>
      </div>
      <div style="font-size:14px;color:#FFD700;font-weight:600;">Hold to power up!</div>
    </div>`;
  },

  showGameOver() {
    this.overlay.innerHTML = `<div style="background:rgba(0,0,0,0.7);color:#fff;padding:24px 32px;border-radius:16px;text-align:center;border:3px solid #FF6B00;max-width:85%;pointer-events:auto;cursor:pointer;">
      <div style="font-size:28px;color:#FF6B00;font-weight:800;margin-bottom:8px;">Lattu Gir Gaya!</div>
      <div style="font-size:16px;margin-bottom:12px;">Score: ${this.score}</div>
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
    this.ready = false;
  },

  getControls() {
    return 'HOLD to wind up power, RELEASE to spin the lattu. Drag to move it. Collect green (spin boost) and gold (points) orbs. Avoid red obstacles!';
  }
};
