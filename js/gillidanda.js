// Gilli Danda - 3D with Three.js
const GilliDandaGame = {
  scene: null, camera: null, renderer: null,
  container: null, wrapper: null, overlay: null,
  width: 0, height: 0,
  gilli: null, danda: null, player: null,
  state: 'ready',
  charging: false, swingPower: 0, powerDir: 1,
  round: 1, totalDistance: 0, bestDistance: 0, currentDistance: 0,
  animationId: null, onScoreUpdate: null,
  clock: null, ready: false, particles: [],
  cameraMode: 'batting', // batting, following
  flipT: 0,
  danda_angle: 0, swinging: false, swingT: 0,

  init(container, onScoreUpdate) {
    this.container = container;
    this.onScoreUpdate = onScoreUpdate;
    this.width = Math.min(600, window.innerWidth - 40);
    this.height = Math.round(this.width * 0.75);

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
    this.scene.background = new THREE.Color(0xB0E0E6);
    this.scene.fog = new THREE.Fog(0xB0E0E6, 20, 80);

    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 150);
    this.camera.position.set(-3, 3, 5);
    this.camera.lookAt(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.cssText = 'display:block;border-radius:12px;touch-action:none;';
    this.wrapper.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xFFF2D4, 1);
    sun.position.set(-8, 15, 10);
    sun.castShadow = true;
    sun.shadow.camera.left = -15; sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
    sun.shadow.camera.far = 50;
    sun.shadow.mapSize.width = 1024; sun.shadow.mapSize.height = 1024;
    this.scene.add(sun);

    // Grass field (very long)
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 200),
      new THREE.MeshStandardMaterial({ color: 0x7BA851 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.z = -80;
    grass.receiveShadow = true;
    this.scene.add(grass);

    // Dirt pitch
    const dirt = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 6),
      new THREE.MeshStandardMaterial({ color: 0xC9A876 })
    );
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.y = 0.01;
    this.scene.add(dirt);

    // Distance markers (flags at 10, 20, 30, 40, 50m)
    for (let d = 10; d <= 50; d += 10) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6),
        new THREE.MeshStandardMaterial({ color: 0xFFFFFF })
      );
      pole.position.set(2.5, 0.75, -d);
      this.scene.add(pole);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 0.3),
        new THREE.MeshStandardMaterial({ color: 0xE53935, side: THREE.DoubleSide })
      );
      flag.position.set(2.8, 1.3, -d);
      this.scene.add(flag);
    }

    // Hills
    for (let i = 0; i < 6; i++) {
      const hill = new THREE.Mesh(
        new THREE.SphereGeometry(6 + Math.random() * 3, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x6B8B3D })
      );
      hill.position.set((i - 3) * 10, 0, -60 - Math.random() * 15);
      hill.scale.y = 0.4;
      this.scene.add(hill);
    }

    // Clouds
    for (let i = 0; i < 4; i++) {
      const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
      );
      cloud.position.set((Math.random() - 0.5) * 40, 10 + Math.random() * 3, -30 - Math.random() * 20);
      cloud.scale.y = 0.5;
      this.scene.add(cloud);
    }

    this.createPlayer();
    this.createDanda();
    this.createGilli();

    this.setupEvents();
    this.clock = new THREE.Clock();
    this.reset();
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
    head.position.y = 1; head.castShadow = true;
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
    group.add(ll);
    const rl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), legMat);
    rl.position.set(0.09, 0.2, 0);
    group.add(rl);
    group.position.set(-1.5, 0, 0.3);
    this.player = group;
    this.scene.add(group);
  },

  createDanda() {
    // Long wooden stick
    const group = new THREE.Group();
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 1.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x8B4513 })
    );
    stick.position.y = 0.6;
    stick.castShadow = true;
    group.add(stick);
    group.position.set(-1.2, 0.3, 0.3);
    this.danda = group;
    this.scene.add(group);
  },

  createGilli() {
    // Small wooden stick, lies on the ground
    this.gilli = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: 0xA0522D })
    );
    this.gilli.rotation.z = Math.PI / 2;
    this.gilli.position.set(0, 0.1, 0);
    this.gilli.castShadow = true;
    this.gilli.userData = { vx: 0, vy: 0, vz: 0, rotVel: 0, active: false };
    this.scene.add(this.gilli);
  },

  setupEvents() {
    this._onDown = (e) => { e.preventDefault(); this.handleDown(); };
    this._onUp = (e) => { e.preventDefault(); this.handleUp(); };
    const el = this.renderer.domElement;
    el.addEventListener('mousedown', this._onDown);
    el.addEventListener('mouseup', this._onUp);
    el.addEventListener('touchstart', this._onDown, { passive: false });
    el.addEventListener('touchend', this._onUp, { passive: false });
  },

  handleDown() {
    if (this.state === 'ready') {
      this.state = 'flipping';
      this.flipT = 0;
      this.gilli.userData.active = true;
      this.hideOverlay();
      if (window.Sounds) Sounds.tick();
    } else if (this.state === 'swinging') {
      this.charging = true;
      this.swingPower = 0;
      this.powerDir = 1;
    } else if (this.state === 'landed') {
      this.round++;
      if (this.round > 5) {
        this.state = 'gameover';
        if (window.Sounds) Sounds.success();
        this.showGameOver();
      } else {
        this.setupRound();
      }
    } else if (this.state === 'gameover') {
      this.reset();
      this.hideOverlay();
    }
  },

  handleUp() {
    if (this.state === 'swinging' && this.charging) {
      this.charging = false;
      // Check if gilli is in strike zone (near danda)
      const dx = this.gilli.position.x - this.danda.position.x;
      const dy = this.gilli.position.y - this.danda.position.y - 0.6;
      const dist = Math.sqrt(dx * dx + dy * dy);
      this.swinging = true;
      this.swingT = 0;
      if (dist < 1.2) {
        // Good hit
        const powerNorm = this.swingPower / 100;
        const speed = 8 + powerNorm * 15;
        this.gilli.userData.vx = 0;
        this.gilli.userData.vz = -speed;
        this.gilli.userData.vy = 4 + powerNorm * 4;
        this.gilli.userData.rotVel = 5 + powerNorm * 5;
        this.state = 'flying';
        this.cameraMode = 'following';
        this.currentDistance = 0;
        if (window.Sounds) Sounds.hit();
      } else {
        // Miss
        if (window.Sounds) Sounds.fail();
        this.state = 'landed';
        setTimeout(() => {
          this.round++;
          if (this.round > 5) { this.state = 'gameover'; this.showGameOver(); }
          else this.setupRound();
        }, 1000);
      }
    }
  },

  setupRound() {
    this.state = 'ready';
    this.cameraMode = 'batting';
    this.gilli.position.set(0, 0.1, 0);
    this.gilli.rotation.set(0, 0, Math.PI / 2);
    this.gilli.userData.active = false;
    this.gilli.userData.vx = 0;
    this.gilli.userData.vy = 0;
    this.gilli.userData.vz = 0;
    this.gilli.userData.rotVel = 0;
    this.danda.rotation.set(0, 0, 0);
    this.danda_angle = 0;
    this.swingPower = 0;
    this.swinging = false;
    this.updateScore();
    this.showReadyScreen();
  },

  reset() {
    this.round = 1;
    this.totalDistance = 0;
    this.bestDistance = 0;
    this.currentDistance = 0;
    this.setupRound();
  },

  updateScore() {
    if (this.onScoreUpdate) this.onScoreUpdate(`Round ${this.round}/5  |  Total: ${Math.floor(this.totalDistance)}m`);
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

    // Flipping phase - gilli arcs up
    if (this.state === 'flipping') {
      this.flipT += dt * 1.5;
      const t = this.flipT;
      this.gilli.position.x = 0 + t * 0.5;
      this.gilli.position.y = 0.1 + Math.sin(t * Math.PI) * 1.5;
      this.gilli.rotation.x += dt * 10;
      if (this.flipT >= 1) {
        this.state = 'swinging';
        this.gilli.userData.vy = 0;
      }
    }

    if (this.state === 'swinging') {
      // Gilli falls
      this.gilli.position.y += this.gilli.userData.vy * dt;
      this.gilli.userData.vy -= 12 * dt;
      this.gilli.rotation.x += 5 * dt;

      if (this.charging) {
        this.swingPower += this.powerDir * 120 * dt;
        if (this.swingPower >= 100) this.powerDir = -1;
        if (this.swingPower <= 0) this.powerDir = 1;
      }

      // If gilli lands without being hit
      if (this.gilli.position.y < 0.1 && !this.swinging) {
        this.gilli.position.y = 0.1;
        this.state = 'landed';
        if (window.Sounds) Sounds.thud();
        setTimeout(() => {
          this.round++;
          if (this.round > 5) { this.state = 'gameover'; this.showGameOver(); }
          else this.setupRound();
        }, 1000);
      }
    }

    // Swing animation
    if (this.swinging) {
      this.swingT += dt * 6;
      this.danda.rotation.z = -this.swingT * 0.8;
      if (this.swingT >= 1.2) { this.swinging = false; this.danda.rotation.z = 0; }
    }

    // Flying
    if (this.state === 'flying') {
      this.gilli.position.x += this.gilli.userData.vx * dt;
      this.gilli.position.y += this.gilli.userData.vy * dt;
      this.gilli.position.z += this.gilli.userData.vz * dt;
      this.gilli.userData.vy -= 10 * dt;
      this.gilli.rotation.x += this.gilli.userData.rotVel * dt;
      this.gilli.rotation.z += this.gilli.userData.rotVel * 0.5 * dt;

      this.currentDistance = Math.abs(this.gilli.position.z);

      // Trail particles
      if (Math.random() < 0.5) {
        const p = new THREE.Mesh(
          new THREE.SphereGeometry(0.04, 4, 4),
          new THREE.MeshBasicMaterial({ color: 0xC9A876, transparent: true, opacity: 0.8 })
        );
        p.position.copy(this.gilli.position);
        this.scene.add(p);
        this.particles.push({ mesh: p, vx: 0, vy: 0, vz: 0, life: 0.6 });
      }

      if (this.gilli.position.y <= 0.1) {
        this.gilli.position.y = 0.1;
        this.totalDistance += this.currentDistance;
        if (this.currentDistance > this.bestDistance) this.bestDistance = this.currentDistance;
        this.state = 'landed';
        if (window.Sounds) Sounds.thud();
        // Dust burst
        for (let i = 0; i < 15; i++) {
          const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0xC9A876, transparent: true, opacity: 1 })
          );
          p.position.copy(this.gilli.position);
          const a = Math.random() * Math.PI * 2;
          const s = 1 + Math.random() * 2;
          this.scene.add(p);
          this.particles.push({
            mesh: p,
            vx: Math.cos(a) * s, vy: Math.random() * 2, vz: Math.sin(a) * s,
            life: 1
          });
        }
        this.showLanded();
        this.updateScore();
      }
    }

    // Camera
    if (this.cameraMode === 'batting') {
      this.camera.position.set(-3, 3, 5);
      this.camera.lookAt(0, 0.8, 0);
    } else if (this.cameraMode === 'following') {
      // Follow the gilli with smooth easing
      const tx = this.gilli.position.x - 3;
      const ty = Math.max(2, this.gilli.position.y + 2);
      const tz = this.gilli.position.z + 5;
      this.camera.position.x += (tx - this.camera.position.x) * 0.08;
      this.camera.position.y += (ty - this.camera.position.y) * 0.08;
      this.camera.position.z += (tz - this.camera.position.z) * 0.08;
      this.camera.lookAt(this.gilli.position.x, this.gilli.position.y, this.gilli.position.z);
    }
  },

  showReadyScreen() {
    this.overlay.innerHTML = `<div style="background:rgba(0,0,0,0.65);color:#fff;padding:20px 28px;border-radius:16px;text-align:center;border:3px solid #FFD700;max-width:85%;">
      <div style="font-size:22px;color:#FFD700;font-weight:800;margin-bottom:6px;">Round ${this.round} / 5</div>
      <div style="font-size:12px;margin-bottom:10px;line-height:1.5;">Tap to flip the gilli into the air.<br>Hold to charge swing power, release to hit!<br>Timing + power = distance</div>
      <div style="font-size:14px;color:#FFD700;font-weight:600;">Tap to begin</div>
    </div>`;
  },

  showLanded() {
    this.overlay.innerHTML = `<div style="background:rgba(0,0,0,0.5);color:#fff;padding:20px 28px;border-radius:16px;text-align:center;border:3px solid #FFD700;max-width:85%;pointer-events:auto;cursor:pointer;">
      <div style="font-size:24px;color:#FFD700;font-weight:800;margin-bottom:6px;">${Math.floor(this.currentDistance)}m hit!</div>
      <div style="font-size:13px;color:#fff;">Tap for next round</div>
    </div>`;
    this.overlay.onclick = () => { this.overlay.onclick = null; this.handleDown(); };
    setTimeout(() => { this.hideOverlay(); }, 1500);
  },

  showGameOver() {
    this.overlay.innerHTML = `<div style="background:rgba(0,0,0,0.75);color:#fff;padding:24px 32px;border-radius:16px;text-align:center;border:3px solid #FFD700;max-width:85%;pointer-events:auto;cursor:pointer;">
      <div style="font-size:26px;color:#FFD700;font-weight:800;margin-bottom:8px;">Khel Khatam!</div>
      <div style="font-size:14px;margin-bottom:4px;">Total: ${Math.floor(this.totalDistance)}m</div>
      <div style="font-size:14px;margin-bottom:12px;">Best shot: ${Math.floor(this.bestDistance)}m</div>
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
    return 'Tap to flip the gilli, hold to charge your swing, release at the right moment to strike! Camera follows the gilli as it flies.';
  }
};
