// Lagori (Seven Stones) - 3D with Three.js
const LagoriGame = {
  scene: null, camera: null, renderer: null,
  container: null, wrapper: null, overlay: null,
  width: 0, height: 0,
  stones: [], stack: [], ball: null, player: null,
  state: 'aiming', // aiming, throwing, rebuilding, hit, levelcomplete, gameover
  aiming: false, aimStart: null, aimEnd: null,
  aimArrow: null,
  score: 0, level: 1, lives: 3, rebuiltCount: 0,
  enemyBall: null, enemyTimer: 0,
  particles: [], animationId: null, onScoreUpdate: null,
  clock: null,
  ready: false,

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
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 15, 50);

    this.camera = new THREE.PerspectiveCamera(55, this.width / this.height, 0.1, 80);
    this.camera.position.set(0, 4, 8);
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
    sun.position.set(-5, 15, 8);
    sun.castShadow = true;
    sun.shadow.camera.left = -12; sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12;
    sun.shadow.mapSize.width = 1024; sun.shadow.mapSize.height = 1024;
    this.scene.add(sun);

    // Grass field
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ color: 0x6B9B4A })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.scene.add(grass);

    // Dirt circle where stones stack
    const dirt = new THREE.Mesh(
      new THREE.CircleGeometry(2, 24),
      new THREE.MeshStandardMaterial({ color: 0xB08860 })
    );
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.y = 0.01;
    this.scene.add(dirt);

    // Distant palm trees
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = 18 + Math.random() * 4;
      this.makePalm(Math.cos(angle) * r, Math.sin(angle) * r - 5);
    }

    // Clouds
    for (let i = 0; i < 5; i++) {
      const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
      );
      cloud.position.set((Math.random() - 0.5) * 40, 12 + Math.random() * 4, -20 - Math.random() * 10);
      cloud.scale.y = 0.4;
      this.scene.add(cloud);
    }

    // Aim arrow
    this.aimArrow = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 2),
      new THREE.MeshBasicMaterial({ color: 0xFF6B00, transparent: true, opacity: 0.8 })
    );
    this.aimArrow.visible = false;
    this.scene.add(this.aimArrow);

    this.createPlayer();
    this.createBall();
    this.setupLevel();
    this.setupEvents();
    this.clock = new THREE.Clock();
    this.ready = true;
    this.loop();
    this.showReadyScreen();
  },

  makePalm(x, z) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.25, 3, 6),
      new THREE.MeshStandardMaterial({ color: 0x5D4037 })
    );
    trunk.position.y = 1.5;
    group.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 1.2, 4),
        new THREE.MeshStandardMaterial({ color: 0x2E7D32 })
      );
      const angle = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(angle) * 0.4, 3 + Math.sin(angle * 2) * 0.2, Math.sin(angle) * 0.4);
      leaf.rotation.z = Math.cos(angle) * 0.6;
      leaf.rotation.x = Math.sin(angle) * 0.6;
      group.add(leaf);
    }
    group.position.set(x, 0, z);
    this.scene.add(group);
  },

  createPlayer() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.55, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xFF6B00 })
    );
    body.position.y = 0.6;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xF4C88C })
    );
    head.position.y = 1;
    head.castShadow = true;
    group.add(head);
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.8),
      new THREE.MeshStandardMaterial({ color: 0x1A0F08 })
    );
    hair.position.y = 1.02;
    group.add(hair);
    // Legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1565C0 });
    const ll = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), legMat);
    ll.position.set(-0.09, 0.2, 0); ll.castShadow = true;
    group.add(ll);
    const rl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), legMat);
    rl.position.set(0.09, 0.2, 0); rl.castShadow = true;
    group.add(rl);
    // Arms
    const armMat = new THREE.MeshStandardMaterial({ color: 0xF4C88C });
    const la = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), armMat);
    la.position.set(-0.27, 0.65, 0);
    group.add(la);
    const ra = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), armMat);
    ra.position.set(0.27, 0.65, 0);
    group.add(ra);
    group.position.set(0, 0, 5);
    this.player = group;
    this.scene.add(group);
  },

  createBall() {
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xD32F2F, metalness: 0.2, roughness: 0.4 })
    );
    this.ball.position.set(0, 0.9, 5);
    this.ball.castShadow = true;
    this.ball.userData = { vx: 0, vy: 0, vz: 0, active: false };
    this.scene.add(this.ball);
  },

  setupLevel() {
    this.state = 'aiming';
    this.rebuiltCount = 0;
    this.enemyTimer = 0;

    // Clear previous stones
    for (const s of this.stones) this.scene.remove(s);
    this.stones = [];

    const colors = [0xA0896E, 0x8B7355, 0x9C8870, 0xB09878, 0x7A6650, 0x887460, 0xA89070];
    for (let i = 0; i < 7; i++) {
      const w = 0.7 - i * 0.06;
      const h = 0.15;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, w),
        new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.9 })
      );
      mesh.position.set(0, h / 2 + i * h, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = {
        stacked: true, scattered: false, rebuilt: false,
        vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0,
        origW: w, origH: h
      };
      this.stones.push(mesh);
      this.scene.add(mesh);
    }

    this.ball.position.set(this.player.position.x, 0.9, this.player.position.z);
    this.ball.userData.active = false;
    this.ball.visible = true;
    if (this.enemyBall) { this.scene.remove(this.enemyBall); this.enemyBall = null; }
    this.updateScore();
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
    const nx = ((t.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((t.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: nx, y: ny }, this.camera);
    const intersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.5), intersect);
    return { x: intersect.x, z: intersect.z, screenX: t.clientX - rect.left, screenY: t.clientY - rect.top };
  },

  handleDown(e) {
    if (this.state === 'gameover' || this.state === 'won') { this.reset(); this.hideOverlay(); return; }
    const pos = this.getPos(e);
    if (this.state === 'aiming') {
      this.aiming = true;
      this.aimStart = { x: this.ball.position.x, z: this.ball.position.z };
      this.aimEnd = pos;
    } else if (this.state === 'rebuilding') {
      // Try to pick up a scattered stone
      for (const s of this.stones) {
        if (s.userData.scattered && !s.userData.rebuilt) {
          const dx = pos.x - s.position.x;
          const dz = pos.z - s.position.z;
          if (Math.sqrt(dx * dx + dz * dz) < 0.8) {
            s.userData.rebuilt = true;
            s.userData.scattered = false;
            // Animate to stack
            s.userData.targetX = 0;
            s.userData.targetY = s.userData.origH / 2 + this.rebuiltCount * s.userData.origH;
            s.userData.targetZ = 0;
            s.userData.moving = true;
            this.rebuiltCount++;
            this.score += 10;
            if (window.Sounds) Sounds.collect();
            this.updateScore();
            if (this.rebuiltCount >= 7) {
              this.state = 'levelcomplete';
              this.score += 50 * this.level;
              if (window.Sounds) Sounds.success();
              setTimeout(() => {
                this.level++;
                if (this.level > 5) {
                  this.state = 'won';
                  this.showGameOver(true);
                } else {
                  this.setupLevel();
                }
              }, 1500);
            }
            break;
          }
        }
      }
    }
  },

  handleMove(e) {
    const pos = this.getPos(e);
    if (this.aiming) this.aimEnd = pos;
    if (this.state === 'rebuilding') {
      // Move player towards touch
      this.player.position.x = Math.max(-6, Math.min(6, pos.x));
      this.player.position.z = Math.max(2, Math.min(8, pos.z));
    }
  },

  handleUp(e) {
    if (!this.aiming) return;
    this.aiming = false;
    const end = this.getPos(e);
    const dx = this.aimStart.x - end.x;
    const dz = this.aimStart.z - end.z;
    const power = Math.min(Math.sqrt(dx * dx + dz * dz) * 1.5, 15);
    if (power > 1) {
      const angle = Math.atan2(dz, dx);
      this.ball.userData.vx = Math.cos(angle) * power;
      this.ball.userData.vz = Math.sin(angle) * power;
      this.ball.userData.vy = 6; // arc
      this.ball.userData.active = true;
      this.state = 'throwing';
      if (window.Sounds) Sounds.whoosh();
    }
    this.aimArrow.visible = false;
  },

  updateScore() {
    if (this.onScoreUpdate) this.onScoreUpdate(`Level ${this.level}  |  Score: ${this.score}  |  ${'❤'.repeat(this.lives)}`);
  },

  spawnBurst(x, y, z, color, count) {
    for (let i = 0; i < (count || 10); i++) {
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

    // Aim indicator
    if (this.aiming && this.aimEnd) {
      const dx = this.aimStart.x - this.aimEnd.x;
      const dz = this.aimStart.z - this.aimEnd.z;
      const power = Math.min(Math.sqrt(dx * dx + dz * dz) * 1.5, 15);
      const angle = Math.atan2(dz, dx);
      this.aimArrow.visible = true;
      this.aimArrow.position.set(
        this.ball.position.x + Math.cos(angle) * power * 0.15,
        1,
        this.ball.position.z + Math.sin(angle) * power * 0.15
      );
      this.aimArrow.rotation.y = -angle - Math.PI / 2;
      this.aimArrow.scale.z = Math.max(0.5, power * 0.2);
    }

    // Ball physics
    if (this.state === 'throwing' && this.ball.userData.active) {
      this.ball.position.x += this.ball.userData.vx * dt;
      this.ball.position.y += this.ball.userData.vy * dt;
      this.ball.position.z += this.ball.userData.vz * dt;
      this.ball.userData.vy -= 14 * dt;
      this.ball.rotation.x += 5 * dt;
      this.ball.rotation.z += 3 * dt;

      // Check hit stones
      let hitAny = false;
      for (const s of this.stones) {
        if (!s.userData.stacked) continue;
        const dx = this.ball.position.x - s.position.x;
        const dy = this.ball.position.y - s.position.y;
        const dz = this.ball.position.z - s.position.z;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.3 && Math.abs(dz) < 0.5) {
          hitAny = true;
          break;
        }
      }
      if (hitAny) {
        if (window.Sounds) Sounds.thud();
        this.spawnBurst(0, 0.5, 0, 0xC4A46A, 15);
        for (const s of this.stones) {
          s.userData.stacked = false;
          s.userData.scattered = true;
          s.userData.vx = (Math.random() - 0.5) * 6;
          s.userData.vy = 3 + Math.random() * 3;
          s.userData.vz = (Math.random() - 0.5) * 6;
          s.userData.rx = (Math.random() - 0.5) * 8;
          s.userData.rz = (Math.random() - 0.5) * 8;
        }
        this.ball.userData.active = false;
        this.ball.visible = false;
        setTimeout(() => {
          this.state = 'rebuilding';
          this.player.position.set(0, 0, 3);
        }, 600);
      }

      // Ball out of bounds
      if (this.ball.position.y < 0 || Math.abs(this.ball.position.x) > 10 || Math.abs(this.ball.position.z) > 10) {
        this.ball.userData.active = false;
        this.ball.position.set(this.player.position.x, 0.9, this.player.position.z);
        this.ball.visible = true;
        this.state = 'aiming';
      }
    }

    // Scattered stones physics
    for (const s of this.stones) {
      if (s.userData.scattered) {
        s.position.x += s.userData.vx * dt;
        s.position.y += s.userData.vy * dt;
        s.position.z += s.userData.vz * dt;
        s.userData.vy -= 15 * dt;
        s.userData.vx *= Math.pow(0.3, dt);
        s.userData.vz *= Math.pow(0.3, dt);
        s.rotation.x += s.userData.rx * dt;
        s.rotation.z += s.userData.rz * dt;
        if (s.position.y < s.userData.origH / 2) {
          s.position.y = s.userData.origH / 2;
          s.userData.vy = 0;
          s.userData.rx *= 0.5;
          s.userData.rz *= 0.5;
        }
      }
      if (s.userData.moving) {
        s.position.x += (s.userData.targetX - s.position.x) * 8 * dt;
        s.position.y += (s.userData.targetY - s.position.y) * 8 * dt;
        s.position.z += (s.userData.targetZ - s.position.z) * 8 * dt;
        s.rotation.x *= Math.pow(0.1, dt);
        s.rotation.z *= Math.pow(0.1, dt);
        if (Math.abs(s.position.x - s.userData.targetX) < 0.05) {
          s.userData.moving = false;
          s.position.set(s.userData.targetX, s.userData.targetY, s.userData.targetZ);
          s.rotation.set(0, 0, 0);
        }
      }
    }

    // Enemy ball during rebuilding
    if (this.state === 'rebuilding') {
      this.enemyTimer += dt;
      const interval = Math.max(1.5, 3.5 - this.level * 0.4);
      if (!this.enemyBall && this.enemyTimer > interval) {
        this.enemyTimer = 0;
        const fromLeft = Math.random() > 0.5;
        this.enemyBall = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 12, 12),
          new THREE.MeshStandardMaterial({ color: 0xFF5722, emissive: 0xE64A19, emissiveIntensity: 0.4 })
        );
        const startX = fromLeft ? -8 : 8;
        this.enemyBall.position.set(startX, 1.5, this.player.position.z + (Math.random() - 0.5) * 2);
        const dx = this.player.position.x - startX;
        const dz = (this.player.position.z - 0.5) - this.enemyBall.position.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        const speed = 5 + this.level * 0.5;
        this.enemyBall.userData = { vx: (dx / d) * speed, vz: (dz / d) * speed };
        this.scene.add(this.enemyBall);
      }

      if (this.enemyBall) {
        this.enemyBall.position.x += this.enemyBall.userData.vx * dt;
        this.enemyBall.position.z += this.enemyBall.userData.vz * dt;
        this.enemyBall.rotation.x += 5 * dt;

        const dx = this.enemyBall.position.x - this.player.position.x;
        const dz = this.enemyBall.position.z - this.player.position.z;
        const dy = this.enemyBall.position.y - 0.8;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 0.7) {
          this.lives--;
          if (window.Sounds) Sounds.fail();
          this.spawnBurst(this.player.position.x, 1, this.player.position.z, 0xE53935, 12);
          this.scene.remove(this.enemyBall);
          this.enemyBall = null;
          if (this.lives <= 0) {
            this.state = 'gameover';
            this.showGameOver(false);
          } else {
            this.state = 'hit';
            setTimeout(() => this.setupLevel(), 1000);
          }
          this.updateScore();
          return;
        }

        if (Math.abs(this.enemyBall.position.x) > 10 || Math.abs(this.enemyBall.position.z) > 10) {
          this.scene.remove(this.enemyBall);
          this.enemyBall = null;
        }
      }
    }

    // Gentle camera
    this.camera.lookAt(0, 0.8, 0);
  },

  showReadyScreen() {
    this.overlay.innerHTML = `<div style="background:rgba(0,0,0,0.65);color:#fff;padding:24px 32px;border-radius:16px;text-align:center;border:3px solid #FFD700;max-width:85%;">
      <div style="font-size:24px;color:#FFD700;font-weight:800;margin-bottom:8px;">Lagori!</div>
      <div style="font-size:13px;margin-bottom:12px;line-height:1.5;">Drag to aim the ball and throw at the stones.<br>Then rebuild the pile by tapping scattered stones.<br>Dodge enemy balls while you rebuild!</div>
      <div style="font-size:14px;color:#FFD700;font-weight:600;pointer-events:auto;cursor:pointer;" onclick="this.parentElement.parentElement.innerHTML=''">Tap to start</div>
    </div>`;
  },

  showGameOver(won) {
    this.overlay.innerHTML = `<div style="background:rgba(0,0,0,0.7);color:#fff;padding:24px 32px;border-radius:16px;text-align:center;border:3px solid ${won ? '#FFD700' : '#FF6B00'};max-width:85%;pointer-events:auto;cursor:pointer;">
      <div style="font-size:28px;color:${won ? '#FFD700' : '#FF6B00'};font-weight:800;margin-bottom:8px;">${won ? 'Champion!' : 'Game Over'}</div>
      <div style="font-size:16px;margin-bottom:12px;">Score: ${this.score}</div>
      <div style="font-size:14px;color:#FFD700;">Tap to play again</div>
    </div>`;
    this.overlay.onclick = () => { this.overlay.onclick = null; this.reset(); this.hideOverlay(); };
  },

  hideOverlay() { this.overlay.innerHTML = ''; this.overlay.onclick = null; },

  reset() {
    this.score = 0; this.level = 1; this.lives = 3;
    this.setupLevel();
  },

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
    return 'Drag to aim and throw the ball at the stones. Then drag yourself to move and tap scattered stones to rebuild the pile while dodging enemy balls!';
  }
};
