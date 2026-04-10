// Tyre Rolling 3D - Subway Surfer style endless runner using Three.js
const TyreGame = {
  scene: null, camera: null, renderer: null,
  container: null, wrapper: null, overlay: null,
  width: 0, height: 0,
  tyre: null, player: null,
  lanes: [-1.8, 0, 1.8],
  lane: 1,
  jumping: false, jumpY: 0, jumpVel: 0,
  obstacles: [], coins: [], scenery: [],
  distance: 0, coinsCollected: 0,
  speed: 0.25,
  state: 'ready',
  animationId: null, onScoreUpdate: null,
  spawnTimer: 0, scenerySpawnTimer: 0,
  swipeStart: null,
  ready: false,

  init(container, onScoreUpdate) {
    this.container = container;
    this.onScoreUpdate = onScoreUpdate;

    this.width = Math.min(500, window.innerWidth - 40);
    this.height = Math.round(this.width * 1.2);

    // Wrapper for canvas + HTML overlay
    this.wrapper = document.createElement('div');
    this.wrapper.style.cssText = `position:relative;width:${this.width}px;height:${this.height}px;`;
    container.appendChild(this.wrapper);

    // HTML overlay for UI text
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;font-family:'Baloo 2',sans-serif;z-index:10;`;
    this.wrapper.appendChild(this.overlay);

    if (typeof THREE === 'undefined') {
      this.overlay.innerHTML = '<div style="color:#e65100;background:rgba(255,255,255,0.9);padding:20px;border-radius:10px;text-align:center;">Loading 3D engine...</div>';
      this.waitForThree(() => this.setup());
      return;
    }
    this.setup();
  },

  waitForThree(cb) {
    const check = () => {
      if (typeof THREE !== 'undefined') { cb(); return; }
      setTimeout(check, 100);
    };
    check();
  },

  setup() {
    this.overlay.innerHTML = '';

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xFFB86B);
    this.scene.fog = new THREE.Fog(0xFFB86B, 12, 45);

    // Camera - third person, elevated view
    this.camera = new THREE.PerspectiveCamera(65, this.width / this.height, 0.1, 80);
    this.camera.position.set(0, 4.5, 6);
    this.camera.lookAt(0, 0.5, -6);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const c = this.renderer.domElement;
    c.style.cssText = 'display:block;border-radius:12px;touch-action:none;';
    this.wrapper.appendChild(c);

    // Lights
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xFFF2D4, 0.9);
    sun.position.set(-6, 10, 3);
    sun.castShadow = true;
    sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
    sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 25;
    sun.shadow.mapSize.width = 1024; sun.shadow.mapSize.height = 1024;
    this.scene.add(sun);

    // Sun disc in sky
    const sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(2, 24),
      new THREE.MeshBasicMaterial({ color: 0xFFE0A0 })
    );
    sunDisc.position.set(-8, 6, -30);
    this.scene.add(sunDisc);

    this.createRoad();
    this.createTyre();
    this.createPlayer();

    // Initial scenery spawn
    for (let z = -10; z > -60; z -= 4) this.spawnScenery(z);

    this.setupEvents();
    this.reset();
    this.ready = true;
    this.loop();
    this.showReadyScreen();
  },

  createRoad() {
    // Main dirt road
    const roadGeo = new THREE.PlaneGeometry(6, 400);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x8B6F47, roughness: 1 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.z = -180;
    road.receiveShadow = true;
    this.scene.add(road);
    this.road = road;

    // Dashed lane lines (create repeating segments)
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xFFF5C0 });
    for (let lineX of [-0.9, 0.9]) {
      for (let z = 10; z > -180; z -= 3) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1.2), lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(lineX, 0.01, z);
        this.scene.add(line);
      }
    }

    // Edges (grass/dirt on sides)
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x8FB85A });
    for (let side of [-1, 1]) {
      const grass = new THREE.Mesh(new THREE.PlaneGeometry(30, 400), grassMat);
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(side * 18, -0.02, -180);
      grass.receiveShadow = true;
      this.scene.add(grass);
    }

    // Distant hills
    for (let i = 0; i < 5; i++) {
      const hill = new THREE.Mesh(
        new THREE.SphereGeometry(6 + Math.random() * 4, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x7A9B5E })
      );
      hill.position.set((i - 2) * 12, 0, -35 - Math.random() * 8);
      hill.scale.y = 0.4;
      this.scene.add(hill);
    }
  },

  createTyre() {
    const group = new THREE.Group();

    // Main rubber tyre (torus)
    const tyreMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.2, 12, 24), tyreMat);
    tyre.rotation.y = Math.PI / 2;
    tyre.castShadow = true;
    group.add(tyre);

    // Tread detail
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const tread = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.06, 0.45),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
      );
      tread.position.set(0, Math.sin(angle) * 0.58, Math.cos(angle) * 0.58);
      tread.rotation.x = angle;
      group.add(tread);
    }

    // Silver hub
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.32, 12),
      new THREE.MeshStandardMaterial({ color: 0xAAAAAA, metalness: 0.8, roughness: 0.3 })
    );
    hub.rotation.z = Math.PI / 2;
    group.add(hub);

    // Spokes
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.06, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6 })
      );
      spoke.position.y = Math.sin(angle) * 0.2;
      spoke.position.z = Math.cos(angle) * 0.2;
      spoke.rotation.x = angle;
      group.add(spoke);
    }

    group.position.set(0, 0.7, -2.5);
    group.scale.set(1.2, 1.2, 1.2);
    this.tyre = group;
    this.scene.add(group);
  },

  createPlayer() {
    const group = new THREE.Group();

    // Body (kurta - orange)
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.55, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xFF6B00 })
    );
    body.position.y = 0.7;
    body.castShadow = true;
    group.add(body);

    // Head (skin tone)
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xF4C88C })
    );
    head.position.y = 1.13;
    head.castShadow = true;
    group.add(head);

    // Hair (dark)
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.8),
      new THREE.MeshStandardMaterial({ color: 0x1A0F08 })
    );
    hair.position.y = 1.14;
    group.add(hair);

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), eyeMat);
    leftEye.position.set(-0.06, 1.15, -0.16);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), eyeMat);
    rightEye.position.set(0.06, 1.15, -0.16);
    group.add(rightEye);

    // Legs (blue shorts/pants)
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1565C0 });
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.14), legMat);
    leftLeg.position.set(-0.11, 0.22, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);
    group.leftLeg = leftLeg;

    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.14), legMat);
    rightLeg.position.set(0.11, 0.22, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);
    group.rightLeg = rightLeg;

    // Arms (skin)
    const armMat = new THREE.MeshStandardMaterial({ color: 0xF4C88C });
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), armMat);
    leftArm.position.set(-0.3, 0.75, 0);
    group.add(leftArm);
    group.leftArm = leftArm;

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), armMat);
    rightArm.position.set(0.3, 0.75, 0);
    group.add(rightArm);
    group.rightArm = rightArm;

    // Stick in right hand (the one used to push the tyre)
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x8B4513 })
    );
    stick.position.set(0.32, 0.55, -0.6);
    stick.rotation.x = Math.PI / 3;
    group.add(stick);

    group.position.set(0, 0, 0.8);
    this.player = group;
    this.scene.add(group);
  },

  makeTree() {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.22, 1.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x5D4037 })
    );
    trunk.position.y = 0.6;
    trunk.castShadow = true;
    group.add(trunk);
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x2E7D32 })
    );
    leaves.position.y = 1.7;
    leaves.castShadow = true;
    group.add(leaves);
    return group;
  },

  makeHouse() {
    const group = new THREE.Group();
    const colors = [0xE67E22, 0xF1C40F, 0xD35400, 0xE74C3C];
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.3, 1.8),
      new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * colors.length)] })
    );
    body.position.y = 0.65;
    body.castShadow = true;
    group.add(body);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 0.8, 4),
      new THREE.MeshStandardMaterial({ color: 0xC0392B })
    );
    roof.position.y = 1.7;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
    // Window
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x87CEEB })
    );
    win.position.set(0, 0.7, 0.91);
    group.add(win);
    return group;
  },

  makeLampPost() {
    const group = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 1.8, 6),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    post.position.y = 0.9;
    group.add(post);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xFFFF80 })
    );
    lamp.position.y = 1.85;
    group.add(lamp);
    return group;
  },

  spawnScenery(z) {
    for (let side of [-1, 1]) {
      const r = Math.random();
      let obj = null;
      if (r < 0.35) obj = this.makeTree();
      else if (r < 0.6) obj = this.makeHouse();
      else if (r < 0.7) obj = this.makeLampPost();
      if (obj) {
        obj.position.set(side * (4 + Math.random() * 3), 0, z + Math.random() * 2);
        this.scene.add(obj);
        this.scenery.push(obj);
      }
    }
  },

  spawnObstacle(z) {
    const lane = Math.floor(Math.random() * 3);
    const types = ['rock', 'barrel', 'rickshaw', 'cow'];
    const type = types[Math.floor(Math.random() * types.length)];
    let mesh;

    if (type === 'rock') {
      mesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.4),
        new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.95, flatShading: true })
      );
      mesh.position.y = 0.35;
      mesh.rotation.set(Math.random(), Math.random(), Math.random());
      mesh.castShadow = true;
    } else if (type === 'barrel') {
      const g = new THREE.Group();
      const b = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.8, 12),
        new THREE.MeshStandardMaterial({ color: 0xC62828 })
      );
      b.position.y = 0.4;
      b.castShadow = true;
      g.add(b);
      // Ring
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.04, 6, 12),
        new THREE.MeshStandardMaterial({ color: 0x8B4513 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.55;
      g.add(ring);
      mesh = g;
    } else if (type === 'rickshaw') {
      const g = new THREE.Group();
      // Body (yellow auto)
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.8, 1.5),
        new THREE.MeshStandardMaterial({ color: 0xF1C40F })
      );
      body.position.y = 0.6;
      body.castShadow = true;
      g.add(body);
      // Black roof
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(1.05, 0.15, 1.4),
        new THREE.MeshStandardMaterial({ color: 0x000000 })
      );
      top.position.y = 1.1;
      g.add(top);
      // Front windshield
      const windshield = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.45),
        new THREE.MeshBasicMaterial({ color: 0x4A90E2 })
      );
      windshield.position.set(0, 0.75, -0.76);
      g.add(windshield);
      // Wheels
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      for (let dx of [-0.5, 0.5]) {
        for (let dz of [-0.55, 0.55]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 8), wheelMat);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(dx, 0.18, dz);
          g.add(wheel);
        }
      }
      mesh = g;
    } else {
      // Cow
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.55, 1.1),
        new THREE.MeshStandardMaterial({ color: 0xF5E6D3 })
      );
      body.position.y = 0.55;
      body.castShadow = true;
      g.add(body);
      // Head
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.35, 0.35),
        new THREE.MeshStandardMaterial({ color: 0xF5E6D3 })
      );
      head.position.set(0, 0.7, -0.65);
      g.add(head);
      // Horns
      const hornMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
      const lh = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 6), hornMat);
      lh.position.set(-0.12, 0.95, -0.65); lh.rotation.z = -0.3; g.add(lh);
      const rh = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 6), hornMat);
      rh.position.set(0.12, 0.95, -0.65); rh.rotation.z = 0.3; g.add(rh);
      // Legs
      const legMat = new THREE.MeshStandardMaterial({ color: 0x8B7355 });
      for (let dx of [-0.22, 0.22]) {
        for (let dz of [-0.35, 0.35]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), legMat);
          leg.position.set(dx, 0.15, dz);
          g.add(leg);
        }
      }
      mesh = g;
    }

    mesh.position.x = this.lanes[lane];
    mesh.position.z = z;
    mesh.userData = { type, lane, hitRadius: type === 'rickshaw' ? 0.9 : 0.6 };
    this.obstacles.push(mesh);
    this.scene.add(mesh);
  },

  spawnCoin(z) {
    const lane = Math.floor(Math.random() * 3);
    // Spawn in a short arc for combo pickups
    const count = 3;
    for (let i = 0; i < count; i++) {
      const coin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.04, 14),
        new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.8, roughness: 0.2, emissive: 0xFFAA00, emissiveIntensity: 0.4 })
      );
      coin.rotation.x = Math.PI / 2;
      coin.position.set(this.lanes[lane], 0.9, z - i * 0.9);
      coin.userData = { lane };
      this.coins.push(coin);
      this.scene.add(coin);
    }
  },

  setupEvents() {
    this._onDown = (e) => { e.preventDefault(); this.handleDown(e); };
    this._onUp = (e) => { e.preventDefault(); this.handleUp(e); };
    this._onKey = (e) => this.handleKey(e);

    const el = this.renderer.domElement;
    el.addEventListener('mousedown', this._onDown);
    el.addEventListener('mouseup', this._onUp);
    el.addEventListener('touchstart', this._onDown, { passive: false });
    el.addEventListener('touchend', this._onUp, { passive: false });
    document.addEventListener('keydown', this._onKey);
  },

  getPos(e) {
    const t = (e.touches && e.touches.length) ? e.touches[0]
            : (e.changedTouches && e.changedTouches.length) ? e.changedTouches[0]
            : e;
    return { x: t.clientX || 0, y: t.clientY || 0 };
  },

  handleDown(e) {
    this.swipeStart = this.getPos(e);
    this.swipeTime = Date.now();
    if (this.state === 'ready') {
      this.state = 'playing';
      if (window.Sounds) Sounds.whoosh();
      this.hideOverlay();
    } else if (this.state === 'gameover') {
      this.reset();
      this.hideOverlay();
    }
  },

  handleUp(e) {
    if (!this.swipeStart) return;
    const pos = this.getPos(e);
    const dx = pos.x - this.swipeStart.x;
    const dy = pos.y - this.swipeStart.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const duration = Date.now() - this.swipeTime;

    if (this.state === 'playing') {
      if (absDx < 15 && absDy < 15 && duration < 300) {
        this.jump();
      } else if (absDx > absDy) {
        if (dx > 20 && this.lane < 2) { this.lane++; if (window.Sounds) Sounds.click(); }
        else if (dx < -20 && this.lane > 0) { this.lane--; if (window.Sounds) Sounds.click(); }
      } else if (dy < -20) {
        this.jump();
      }
    }
    this.swipeStart = null;
  },

  handleKey(e) {
    if (this.state !== 'playing') {
      if (e.key === ' ' || e.key === 'Enter') {
        if (this.state === 'ready') { this.state = 'playing'; this.hideOverlay(); if (window.Sounds) Sounds.whoosh(); }
        else if (this.state === 'gameover') { this.reset(); this.hideOverlay(); }
      }
      return;
    }
    if ((e.key === 'ArrowLeft' || e.key === 'a') && this.lane > 0) { this.lane--; if (window.Sounds) Sounds.click(); }
    if ((e.key === 'ArrowRight' || e.key === 'd') && this.lane < 2) { this.lane++; if (window.Sounds) Sounds.click(); }
    if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w') { this.jump(); }
  },

  jump() {
    if (!this.jumping && this.state === 'playing') {
      this.jumping = true;
      this.jumpVel = 0.28;
      if (window.Sounds) Sounds.jump();
    }
  },

  reset() {
    this.state = 'ready';
    this.lane = 1;
    this.jumping = false;
    this.jumpY = 0;
    this.jumpVel = 0;
    this.distance = 0;
    this.coinsCollected = 0;
    this.speed = 0.25;
    this.spawnTimer = 0;
    this.scenerySpawnTimer = 0;

    for (const o of this.obstacles) this.scene.remove(o);
    for (const c of this.coins) this.scene.remove(c);
    this.obstacles = [];
    this.coins = [];

    if (this.tyre) { this.tyre.position.x = 0; this.tyre.position.y = 0.7; }
    if (this.player) this.player.position.x = 0;

    this.updateScore();
    this.showReadyScreen();
  },

  updateScore() {
    if (this.onScoreUpdate) {
      this.onScoreUpdate(`${Math.floor(this.distance)}m  |  🪙 ${this.coinsCollected}`);
    }
  },

  showReadyScreen() {
    this.overlay.innerHTML = `
      <div style="background:rgba(0,0,0,0.65);color:#fff;padding:24px 32px;border-radius:16px;text-align:center;border:3px solid #FFD700;max-width:85%;">
        <div style="font-size:26px;color:#FFD700;font-weight:800;margin-bottom:8px;">Taayra Daudao!</div>
        <div style="font-size:14px;margin-bottom:12px;line-height:1.5;">Swipe LEFT/RIGHT to change lanes<br>Swipe UP or TAP to jump<br>Collect coins, dodge obstacles!</div>
        <div style="font-size:16px;color:#FFD700;font-weight:600;">Tap to start</div>
      </div>
    `;
  },

  showGameOverScreen() {
    this.overlay.innerHTML = `
      <div style="background:rgba(0,0,0,0.7);color:#fff;padding:24px 32px;border-radius:16px;text-align:center;border:3px solid #FF6B00;max-width:85%;">
        <div style="font-size:28px;color:#FF6B00;font-weight:800;margin-bottom:8px;">Ouch!</div>
        <div style="font-size:16px;margin-bottom:8px;">${Math.floor(this.distance)}m traveled</div>
        <div style="font-size:16px;margin-bottom:12px;color:#FFD700;">🪙 ${this.coinsCollected} coins collected</div>
        <div style="font-size:14px;color:#FFD700;">Tap to try again</div>
      </div>
    `;
  },

  hideOverlay() {
    this.overlay.innerHTML = '';
  },

  update() {
    if (!this.ready || this.state !== 'playing') return;

    this.distance += this.speed * 5;
    this.speed = Math.min(0.55, 0.25 + this.distance * 0.00025);

    // Move tyre to target lane smoothly
    const targetX = this.lanes[this.lane];
    this.tyre.position.x += (targetX - this.tyre.position.x) * 0.22;
    this.player.position.x = this.tyre.position.x;

    // Roll the tyre
    this.tyre.rotation.x -= this.speed * 2;

    // Jumping
    if (this.jumping) {
      this.jumpY += this.jumpVel;
      this.jumpVel -= 0.015;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.jumping = false;
        this.jumpVel = 0;
        if (window.Sounds) Sounds.land();
      }
    }
    this.tyre.position.y = 0.7 + this.jumpY;
    this.player.position.y = this.jumpY;

    // Running animation
    const runPhase = Date.now() * 0.017;
    if (this.player.leftLeg) {
      this.player.leftLeg.rotation.x = Math.sin(runPhase) * 0.9;
      this.player.rightLeg.rotation.x = Math.sin(runPhase + Math.PI) * 0.9;
      this.player.leftArm.rotation.x = Math.sin(runPhase + Math.PI) * 0.6;
      this.player.rightArm.rotation.x = Math.sin(runPhase) * 0.6;
    }

    // Spawn obstacles / coins
    this.spawnTimer++;
    const spawnRate = Math.max(30, 75 - this.distance * 0.08);
    if (this.spawnTimer > spawnRate) {
      this.spawnTimer = 0;
      if (Math.random() > 0.25) this.spawnObstacle(-55);
      if (Math.random() > 0.5) this.spawnCoin(-55);
    }

    // Spawn scenery
    this.scenerySpawnTimer++;
    if (this.scenerySpawnTimer > 15) {
      this.scenerySpawnTimer = 0;
      this.spawnScenery(-55);
    }

    // Move obstacles, check collisions
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.position.z += this.speed * 5;
      if (o.position.z > 8) {
        this.scene.remove(o);
        this.obstacles.splice(i, 1);
        continue;
      }
      const dx = Math.abs(o.position.x - this.tyre.position.x);
      const dz = Math.abs(o.position.z - this.tyre.position.z);
      const hr = o.userData.hitRadius;
      if (dx < hr && dz < hr) {
        // Can jump over barrels/rocks if jumping high enough
        if ((o.userData.type === 'barrel' || o.userData.type === 'rock') && this.jumpY > 0.7) continue;
        this.state = 'gameover';
        if (window.Sounds) Sounds.fail();
        this.updateScore();
        this.showGameOverScreen();
        break;
      }
    }

    // Coins
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.position.z += this.speed * 5;
      c.rotation.z += 0.12;
      if (c.position.z > 8) {
        this.scene.remove(c);
        this.coins.splice(i, 1);
        continue;
      }
      const dx = Math.abs(c.position.x - this.tyre.position.x);
      const dz = Math.abs(c.position.z - this.tyre.position.z);
      const dy = Math.abs(c.position.y - (0.9 + this.jumpY));
      if (dx < 0.55 && dz < 0.55 && dy < 0.7) {
        this.coinsCollected++;
        if (window.Sounds) Sounds.coin();
        this.scene.remove(c);
        this.coins.splice(i, 1);
      }
    }

    // Scenery
    for (let i = this.scenery.length - 1; i >= 0; i--) {
      const s = this.scenery[i];
      s.position.z += this.speed * 5;
      if (s.position.z > 12) {
        this.scene.remove(s);
        this.scenery.splice(i, 1);
      }
    }

    // Camera follows
    this.camera.position.x += (this.tyre.position.x * 0.4 - this.camera.position.x) * 0.1;
    this.camera.lookAt(this.tyre.position.x * 0.5, 0.8, this.tyre.position.z - 4);

    this.updateScore();
  },

  draw() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  },

  loop() {
    this.update();
    this.draw();
    this.animationId = requestAnimationFrame(() => this.loop());
  },

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    document.removeEventListener('keydown', this._onKey);
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
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.tyre = null;
    this.player = null;
    this.obstacles = [];
    this.coins = [];
    this.scenery = [];
    this.ready = false;
  },

  getControls() {
    return 'Swipe LEFT/RIGHT to change lanes • Swipe UP or TAP to jump • Collect coins, dodge auto-rickshaws, cows, rocks & barrels!';
  }
};
