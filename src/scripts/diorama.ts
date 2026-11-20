import * as THREE from 'three';

export type SkyName = 'day' | 'golden' | 'night';
export type WeatherName = 'sun' | 'clouds' | 'rain' | 'snow';

type SkyLook = {
  bg: number;
  sun: number;
  sunI: number;
  hemi: number;
  moonI: number;
  letter: number;
  window: number;
};

const SKY: Record<SkyName, SkyLook> = {
  day: { bg: 0x8ec8ea, sun: 0xfff6e4, sunI: 2.5, hemi: 0.9, moonI: 0, letter: 0.04, window: 0 },
  golden: { bg: 0xf0a56a, sun: 0xffb066, sunI: 2.15, hemi: 0.42, moonI: 0, letter: 0.16, window: 0.25 },
  night: { bg: 0x10182c, sun: 0x6677aa, sunI: 0.08, hemi: 0.16, moonI: 0.62, letter: 0.7, window: 1.25 },
};

const SKY_ORDER: SkyName[] = ['day', 'golden', 'night'];

const MISSOULA = 'https://api.open-meteo.com/v1/forecast?latitude=46.8721&longitude=-113.9940&current=temperature_2m,weather_code&temperature_unit=fahrenheit';

type RootApi = HTMLElement & {
  __hellgate?: {
    cycleSky: () => void;
    setWeather: (weather: WeatherName) => void;
    skipStone: () => void;
    dropTube: () => void;
    pokeM: () => void;
    pokeL: () => void;
  };
};

export function mountDiorama(root: RootApi): () => void {
  if (root.dataset.mounted === '1') return () => {};
  root.dataset.mounted = '1';

  const view = root.querySelector<HTMLElement>('[data-view]');
  const toast = root.querySelector<HTMLElement>('[data-toast]');
  const live = root.querySelector<HTMLElement>('[data-live]');
  const fallback = root.querySelector<HTMLElement>('[data-fallback]');
  if (!view) return () => {};

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!renderer.getContext()) throw new Error('no webgl');
  } catch {
    if (fallback) fallback.hidden = false;
    root.dataset.ready = 'fallback';
    return () => {};
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, view.clientWidth < 700 ? 1.25 : 1.6));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  view.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const bg = new THREE.Color(SKY.day.bg);
  scene.background = bg;
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x8ec8ea, side: THREE.BackSide, depthWrite: false, fog: false });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16), skyMat);
  scene.add(skyDome);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 80);
  camera.position.set(0, 6.4, 13.2);
  camera.lookAt(0, 0.7, 0);

  const hemi = new THREE.HemisphereLight(0xd7ecff, 0x6d8f5c, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff6e4, 2.5);
  sun.position.set(5, 9, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 28;
  sun.shadow.camera.left = -9;
  sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9;
  sun.shadow.camera.bottom = -9;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const moon = new THREE.DirectionalLight(0xb9c8ff, 0);
  moon.position.set(-5, 7, -3);
  scene.add(moon);

  const diorama = new THREE.Group();
  diorama.rotation.order = 'YXZ';
  scene.add(diorama);

  const clickables: THREE.Object3D[] = [];
  const std = (color: number, roughness = 0.82) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });

  const table = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.8, 0.42, 48), std(0x8a5a38, 0.62));
  table.position.y = -0.42;
  table.receiveShadow = true;
  diorama.add(table);

  const grass = new THREE.Mesh(new THREE.CylinderGeometry(4.85, 4.85, 0.18, 48), std(0x7ea36a, 0.95));
  grass.position.y = -0.08;
  grass.receiveShadow = true;
  diorama.add(grass);

  const dirt = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 3.2), std(0xc4a57a, 0.95));
  dirt.position.set(-1.5, 0.04, 1.6);
  dirt.rotation.y = 0.3;
  dirt.receiveShadow = true;
  diorama.add(dirt);

  function hillGeometry(radius: number, height: number) {
    const pts: THREE.Vector2[] = [];
    const steps = 16;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const y = t * height;
      const r = Math.max(0.02, radius * Math.cos((t * Math.PI) / 2) ** 0.5);
      pts.push(new THREE.Vector2(r, y));
    }
    return new THREE.LatheGeometry(pts, 32);
  }

  function addHill(x: number, z: number, radius: number, height: number, color: number) {
    const mesh = new THREE.Mesh(hillGeometry(radius, height), std(color, 0.9));
    mesh.position.set(x, 0.02, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    diorama.add(mesh);
    return mesh;
  }

  const jumbo = addHill(-2.25, -0.15, 1.55, 1.75, 0x6e9164);
  const sentinel = addHill(2.35, 0.05, 1.7, 2.15, 0x7d9468);
  addHill(-0.55, -2.35, 1.05, 0.95, 0x68865e);
  addHill(0.85, -2.5, 1.15, 1.05, 0x73946a);

  const letterMat = new THREE.MeshStandardMaterial({
    color: 0xf7f4ee,
    roughness: 0.45,
    metalness: 0.04,
    emissive: 0xfff4d2,
    emissiveIntensity: 0.04,
  });

  function bar(group: THREE.Group, w: number, h: number, d: number, x: number, y: number, rotZ = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), letterMat);
    mesh.position.set(x, y, 0);
    mesh.rotation.z = rotZ;
    mesh.castShadow = true;
    group.add(mesh);
  }

  const mLetter = new THREE.Group();
  {
    const h = 0.95;
    const w = 0.82;
    const t = 0.15;
    const d = 0.18;
    bar(mLetter, t, h, d, -w / 2, h / 2);
    bar(mLetter, t, h, d, w / 2, h / 2);
    const span = Math.hypot(w / 2, h * 0.7);
    const angle = Math.atan2(w / 2, h * 0.7);
    bar(mLetter, t, span, d * 0.9, -w / 4, h * 0.62, angle);
    bar(mLetter, t, span, d * 0.9, w / 4, h * 0.62, -angle);
  }
  mLetter.userData.kind = 'm';
  diorama.add(mLetter);
  clickables.push(mLetter);

  const lLetter = new THREE.Group();
  {
    const h = 0.78;
    const w = 0.52;
    const t = 0.14;
    const d = 0.16;
    bar(lLetter, t, h, d, -w / 2 + t / 2, h / 2);
    bar(lLetter, w, t, d, 0, t / 2);
  }
  lLetter.userData.kind = 'l';
  diorama.add(lLetter);
  clickables.push(lLetter);

  function seatLetter(group: THREE.Group, hill: THREE.Mesh, radius: number, height: number) {
    const y = height * 0.58;
    const surface = Math.max(0.25, radius * Math.cos((y / height) * Math.PI * 0.5) ** 0.5);
    group.position.set(hill.position.x, y, hill.position.z + surface + 0.08);
    group.rotation.x = -0.9;
    group.scale.setScalar(1.25);
  }
  seatLetter(mLetter, sentinel, 1.7, 2.15);
  seatLetter(lLetter, jumbo, 1.55, 1.75);

  function hitBubble(parent: THREE.Object3D, kind: string, radius: number) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 10, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    mesh.position.set(0, 0.35, 0.05);
    mesh.userData.kind = kind;
    parent.add(mesh);
    clickables.push(mesh);
  }
  hitBubble(mLetter, 'm', 0.55);
  hitBubble(lLetter, 'l', 0.48);

  const switchbacks: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i += 1) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.035, 0.1), std(0xe7d3a4, 0.7));
    const t = i / 6;
    step.position.set(sentinel.position.x + Math.sin(i) * 0.12, 0.28 + t * 0.95, sentinel.position.z + 1.15 - t * 0.35);
    step.rotation.y = i * 0.4;
    const glow = step.material as THREE.MeshStandardMaterial;
    glow.emissive = new THREE.Color(0xffc56a);
    glow.emissiveIntensity = 0;
    diorama.add(step);
    switchbacks.push(step);
  }

  const riverCurve = new THREE.CatmullRomCurve3(
    [-3.1, -2.0, -0.8, 0.3, 1.4, 2.4, 3.2].map((z, i) => new THREE.Vector3(Math.sin(i * 0.9) * 0.55, 0.1, z)),
  );
  const river = new THREE.Mesh(
    new THREE.TubeGeometry(riverCurve, 80, 0.34, 8, false),
    new THREE.MeshStandardMaterial({
      color: 0x3e8f98,
      roughness: 0.22,
      metalness: 0.08,
      emissive: 0x164e58,
      emissiveIntensity: 0.15,
    }),
  );
  river.scale.y = 0.38;
  river.castShadow = true;
  river.receiveShadow = true;
  river.userData.kind = 'river';
  diorama.add(river);
  clickables.push(river);

  const pines: THREE.Group[] = [];
  function addPine(x: number, z: number, s = 1) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.07 * s, 0.28 * s, 6), std(0x6b442c, 0.9));
    trunk.position.y = 0.14 * s;
    trunk.castShadow = true;
    const foliage = new THREE.Mesh(new THREE.ConeGeometry(0.28 * s, 0.72 * s, 7), std(0x2f5a3c, 0.9));
    foliage.position.y = 0.52 * s;
    foliage.castShadow = true;
    group.add(trunk, foliage);
    group.position.set(x, 0.02, z);
    diorama.add(group);
    pines.push(group);
  }
  [
    [-3.6, 0.8, 0.85],
    [-3.3, -1.2, 1],
    [-1.3, -1.3, 0.75],
    [-0.9, 0.5, 0.65],
    [0.7, -1.4, 0.8],
    [1.2, 1.3, 0.7],
    [3.5, 0.2, 0.95],
    [3.6, -1.3, 0.85],
    [1.7, -1.2, 0.65],
    [-0.2, 2.2, 0.6],
    [0.5, 2.4, 0.75],
    [-2.8, 1.8, 0.8],
  ].forEach(([x, z, s]) => addPine(x, z, s));

  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x9ec4d4,
    emissive: 0xffb15a,
    emissiveIntensity: 0,
    roughness: 0.3,
  });
  const cabin = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.7), std(0xa36b45, 0.78));
  walls.position.y = 0.38;
  walls.castShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.38, 4), std(0x6b3a32, 0.75));
  roof.position.y = 0.78;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.04), windowMat);
  win.position.set(0, 0.42, 0.36);
  cabin.add(walls, roof, win);
  cabin.position.set(-1.15, 0.02, 1.7);
  cabin.userData.kind = 'cabin';
  diorama.add(cabin);
  clickables.push(cabin);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.28), std(0x8d6240, 0.75));
  bridge.position.set(0.15, 0.16, 0.35);
  bridge.castShadow = true;
  diorama.add(bridge);

  function plaque(text: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);
    ctx.fillStyle = '#f6e7c8';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#6b442c';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 240, 112);
    ctx.fillStyle = '#2c2418';
    ctx.font = '700 46px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 68);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const signs: { mesh: THREE.Group; href: string }[] = [
    { href: '/archive/', mesh: new THREE.Group() },
    { href: '/projects/', mesh: new THREE.Group() },
    { href: '/photos/', mesh: new THREE.Group() },
    { href: '/now/', mesh: new THREE.Group() },
    { href: '/about/', mesh: new THREE.Group() },
  ];
  const signLabels = ['Writing', 'Projects', 'Photos', 'Now', 'About'];
  signs.forEach((sign, i) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.45, 6), std(0x6b442c, 0.8));
    post.position.y = 0.22;
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 0.36),
      new THREE.MeshStandardMaterial({ map: plaque(signLabels[i]), roughness: 0.7 }),
    );
    board.position.y = 0.52;
    const x = -2.6 + i * 1.3;
    sign.mesh.add(post, board);
    sign.mesh.position.set(x, 0.02, 3.35);
    sign.mesh.userData.kind = 'go';
    sign.mesh.userData.href = sign.href;
    diorama.add(sign.mesh);
    clickables.push(sign.mesh);
  });

  const deer = new THREE.Group();
  {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.12), std(0x8a6244, 0.8));
    body.position.y = 0.22;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), std(0x8a6244, 0.8));
    head.position.set(0.16, 0.3, 0);
    deer.add(body, head);
    deer.position.set(-2.2, 0.02, 1.4);
    deer.visible = false;
    diorama.add(deer);
  }

  function makeGlider(color: number) {
    const group = new THREE.Group();
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      std(color, 0.45),
    );
    canopy.scale.y = 0.45;
    const pilot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.05), std(0xf2efe6, 0.6));
    pilot.position.y = -0.18;
    group.add(canopy, pilot);
    group.visible = false;
    diorama.add(group);
    return group;
  }
  const gliderM = makeGlider(0xe07a3d);
  const gliderL = makeGlider(0x3d7ea8);

  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), new THREE.MeshBasicMaterial({ color: 0xffe29a }));
  sunMesh.position.set(3.4, 7.2, -6);
  sunMesh.userData.kind = 'sky';
  scene.add(sunMesh);
  clickables.push(sunMesh);
  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 16), new THREE.MeshBasicMaterial({ color: 0xf4f0e4 }));
  moonMesh.position.set(-3.6, 6.6, -6);
  moonMesh.userData.kind = 'sky';
  moonMesh.visible = false;
  scene.add(moonMesh);
  clickables.push(moonMesh);

  const starGeo = new THREE.BufferGeometry();
  const starPositions = new Float32Array(180 * 3);
  for (let i = 0; i < 180; i += 1) {
    const r = 18 + Math.random() * 8;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * 0.7;
    starPositions[i * 3] = Math.cos(theta) * Math.cos(phi) * r;
    starPositions[i * 3 + 1] = 4 + Math.sin(phi) * r;
    starPositions[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * r - 4;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xfff6dd, size: 0.08, transparent: true, opacity: 0, depthWrite: false }),
  );
  scene.add(stars);

  const fireflyGeo = new THREE.BufferGeometry();
  const fireflyCount = 16;
  const fireflyPositions = new Float32Array(fireflyCount * 3);
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3));
  const fireflies = new THREE.Points(
    fireflyGeo,
    new THREE.PointsMaterial({ color: 0xffe27a, size: 0.07, transparent: true, opacity: 0, depthWrite: false }),
  );
  diorama.add(fireflies);

  function weatherPoints(count: number, color: number, size: number) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = Math.random() * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    pts.visible = false;
    diorama.add(pts);
    return pts;
  }
  const rain = weatherPoints(420, 0xd5eef5, 0.045);
  const snow = weatherPoints(260, 0xfffaf2, 0.07);

  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 4; i += 1) {
    const cloud = new THREE.Group();
    for (let p = 0; p < 3; p += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.38 + p * 0.08, 12, 10), std(0xf7f4ee, 0.95));
      puff.position.set(p * 0.42, Math.sin(p) * 0.08, 0);
      cloud.add(puff);
    }
    cloud.position.set(-3 + i * 2.1, 3.4 + (i % 2) * 0.4, -1.5 + (i % 3) * 0.4);
    cloud.visible = false;
    diorama.add(cloud);
    clouds.push(cloud);
  }

  type Drifter = { mesh: THREE.Object3D; t: number; speed: number };
  const drifters: Drifter[] = [];
  type Skip = { mesh: THREE.Mesh; age: number; ripples: { mesh: THREE.Mesh; age: number }[] };
  const skips: Skip[] = [];

  const tubeColors = [0xe07a3d, 0x3d7ea8, 0xe2c14a, 0xd45d73, 0x6aaa5a];
  let tubeTick = 0;

  function dropTube() {
    if (drifters.length > 5) return;
    const kayak = tubeTick % 2 === 1;
    tubeTick += 1;
    const color = tubeColors[tubeTick % tubeColors.length];
    const mesh = kayak
      ? new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.28, 4, 8), std(color, 0.45))
      : new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 8, 16), std(color, 0.4));
    if (kayak) mesh.rotation.z = Math.PI / 2;
    mesh.castShadow = true;
    diorama.add(mesh);
    drifters.push({ mesh, t: 0.02, speed: kayak ? 0.045 : 0.06 });
    say(kayak ? 'A little kayak heads down the Clark Fork.' : 'A float tube drops into the Clark Fork.');
  }

  function skipStone() {
    if (skips.length > 3) return;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), std(0xd9d3c7, 0.4));
    mesh.castShadow = true;
    diorama.add(mesh);
    skips.push({ mesh, age: 0, ripples: [] });
    say('A stone skips the Clark Fork.');
  }

  let swayBoost = 0;
  let trail = 0;
  let deerHop = 0;
  let gliderMFlight = -1;
  let gliderLFlight = -1;
  let cabinPulse = 0;

  function say(message: string) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-on');
    window.setTimeout(() => {
      if (toast.textContent === message) toast.classList.remove('is-on');
    }, 2800);
  }

  function pokeM() {
    trail = 1;
    gliderMFlight = 0;
    gliderM.visible = true;
    say("Sentinel's M wakes up. The switchbacks light, and a toy paraglider hops off the hill.");
  }

  function pokeL() {
    swayBoost = 1;
    deerHop = 1;
    deer.visible = true;
    gliderLFlight = 0;
    gliderL.visible = true;
    say("Jumbo's L catches a breeze. A toy deer bounds, and a glider crosses the canyon.");
  }

  let sky: SkyName = document.documentElement.dataset.theme === 'dark' ? 'night' : 'day';
  let weather: WeatherName = 'sun';
  let weatherTouched = false;
  let applyingTheme = false;

  function paintControls() {
    root.dataset.sky = sky;
    root.dataset.weather = weather;
    root.querySelectorAll<HTMLButtonElement>('[data-weather-btn]').forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.weatherBtn === weather ? 'true' : 'false');
    });
  }

  function setSky(next: SkyName, writeTheme = true) {
    sky = next;
    paintControls();
    if (!writeTheme) return;
    applyingTheme = true;
    const theme = next === 'night' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* Storage can be blocked. The cord still changes the toy. */
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#16110e' : '#f3e6d0');
    applyingTheme = false;
    const lines = {
      day: 'Daytime in Hellgate Canyon.',
      golden: 'Golden hour over the canyon.',
      night: 'Starry night. The cabin windows glow, and the letters stay lit.',
    };
    say(lines[next]);
  }

  function cycleSky() {
    const index = SKY_ORDER.indexOf(sky);
    setSky(SKY_ORDER[(index + 1) % SKY_ORDER.length]);
  }

  function setWeather(next: WeatherName) {
    weatherTouched = true;
    weather = next;
    paintControls();
    const lines = {
      sun: 'You cleared the sky.',
      clouds: 'Clouds drift over the valley.',
      rain: 'Rain on the Clark Fork.',
      snow: 'Snow on Sentinel and Jumbo.',
    };
    say(lines[next]);
  }

  function codeToWeather(code: number): WeatherName {
    if (code === 0) return 'sun';
    if (code <= 3 || code === 45 || code === 48) return 'clouds';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain';
    return 'clouds';
  }

  function codeLabel(code: number) {
    if (code === 0) return 'clear';
    if (code <= 3) return 'cloudy';
    if (code === 45 || code === 48) return 'foggy';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snowy';
    if (code >= 95) return 'stormy';
    if (code >= 51) return 'rainy';
    return 'outside';
  }

  async function loadWeather() {
    if (!live) return;
    live.textContent = 'Checking the sky over Missoula…';
    try {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(MISSOULA, { signal: ctrl.signal });
      window.clearTimeout(timer);
      if (!res.ok) throw new Error('weather');
      const data = (await res.json()) as { current?: { temperature_2m?: number; weather_code?: number } };
      const temp = data.current?.temperature_2m;
      const code = data.current?.weather_code;
      if (typeof temp !== 'number' || typeof code !== 'number') throw new Error('weather');
      if (!weatherTouched) {
        weather = codeToWeather(code);
        paintControls();
      }
      live.textContent = `Missoula right now · ${Math.round(temp)}°F · ${codeLabel(code)}`;
    } catch {
      if (live) live.textContent = "Missoula weather didn't load. The sky buttons still play.";
    }
  }

  const sunColor = new THREE.Color();
  const skyRgb = { r: 142, g: 200, b: 234 };
  const hexRgb = (hex: number) => ({ r: (hex >> 16) & 255, g: (hex >> 8) & 255, b: hex & 255 });
  let rotX = 0.18;
  let rotY = 0.28;
  let targetX = 0.18;
  let targetY = 0.28;
  let pulling = false;

  function resize() {
    const width = Math.max(1, view.clientWidth);
    const height = Math.max(1, view.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 700 ? 1.25 : 1.6));
    renderer.setSize(width, height, false);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(view);
  resize();

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let dragging = false;
  let moved = false;
  let lastX = 0;
  let lastY = 0;
  let pointerId = -1;

  function kindOf(obj: THREE.Object3D | null) {
    let cur = obj;
    while (cur) {
      if (typeof cur.userData.kind === 'string') return cur.userData.kind as string;
      cur = cur.parent;
    }
    return '';
  }

  function hrefOf(obj: THREE.Object3D | null) {
    let cur = obj;
    while (cur) {
      if (typeof cur.userData.href === 'string') return cur.userData.href as string;
      cur = cur.parent;
    }
    return '';
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    dragging = true;
    moved = false;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    renderer.domElement.setPointerCapture(pointerId);
    renderer.domElement.style.cursor = 'grabbing';
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging || event.pointerId !== pointerId) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
    lastX = event.clientX;
    lastY = event.clientY;
    targetY += dx * 0.008;
    targetX = Math.max(-0.15, Math.min(0.62, targetX + dy * 0.004));
  }

  function onPointerUp(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    dragging = false;
    renderer.domElement.style.cursor = 'grab';
    root.dataset.yaw = targetY.toFixed(3);
    if (moved) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(clickables, true)[0];
    if (!hit) return;
    const kind = kindOf(hit.object);
    if (kind === 'm') pokeM();
    else if (kind === 'l') pokeL();
    else if (kind === 'river') {
      if (Math.random() > 0.5) skipStone();
      else dropTube();
    } else if (kind === 'sky') cycleSky();
    else if (kind === 'cabin') {
      cabinPulse = 1;
      say('The cabin windows flare, like someone is home.');
    } else if (kind === 'go') {
      const href = hrefOf(hit.object);
      if (href) window.location.href = href;
    }
  }

  renderer.domElement.style.cursor = 'grab';
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);

  renderer.domElement.tabIndex = 0;
  renderer.domElement.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') targetY -= 0.18;
    if (event.key === 'ArrowRight') targetY += 0.18;
    if (event.key === 'ArrowUp') targetX = Math.max(-0.15, targetX - 0.08);
    if (event.key === 'ArrowDown') targetX = Math.min(0.62, targetX + 0.08);
    root.dataset.yaw = targetY.toFixed(3);
  });

  root.querySelector('[data-cord]')?.addEventListener('click', () => {
    const cord = root.querySelector('[data-cord]');
    cord?.classList.add('is-pulled');
    window.setTimeout(() => cord?.classList.remove('is-pulled'), 220);
    cycleSky();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-weather-btn]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.weatherBtn as WeatherName;
      if (next) setWeather(next);
    });
  });
  root.querySelector('[data-stone]')?.addEventListener('click', skipStone);
  root.querySelector('[data-tube]')?.addEventListener('click', dropTube);

  const themeObserver = new MutationObserver(() => {
    if (applyingTheme) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    if (dark && sky !== 'night') setSky('night', false);
    if (!dark && sky === 'night') setSky('day', false);
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  root.__hellgate = { cycleSky, setWeather, skipStone, dropTube, pokeM, pokeL };
  paintControls();
  if (sky === 'night') paintControls();
  void loadWeather();

  let frame = 0;
  let running = true;
  const clockStart = performance.now();

  function tick(nowMs: number) {
    if (!running) return;
    frame = requestAnimationFrame(tick);
    const time = (nowMs - clockStart) / 1000;
    const dt = reduced ? 0 : 1;

    rotY += (targetY - rotY) * 0.12;
    rotX += (targetX - rotX) * 0.12;
    diorama.rotation.y = rotY;
    diorama.rotation.x = rotX;

    const goal = SKY[sky];
    const targetSky = hexRgb(goal.bg);
    skyRgb.r += (targetSky.r - skyRgb.r) * 0.08;
    skyRgb.g += (targetSky.g - skyRgb.g) * 0.08;
    skyRgb.b += (targetSky.b - skyRgb.b) * 0.08;
    bg.setRGB(skyRgb.r / 255, skyRgb.g / 255, skyRgb.b / 255, THREE.SRGBColorSpace);
    skyMat.color.copy(bg);
    renderer.setClearColor(bg, 1);
    sunColor.set(goal.sun);
    sun.color.lerp(sunColor, 0.06);
    const dim = weather === 'rain' ? 0.62 : weather === 'snow' ? 0.74 : weather === 'clouds' ? 0.82 : 1;
    sun.intensity += (goal.sunI * dim - sun.intensity) * 0.06;
    hemi.intensity += (goal.hemi * dim - hemi.intensity) * 0.06;
    moon.intensity += (goal.moonI - moon.intensity) * 0.06;
    letterMat.emissiveIntensity += (goal.letter - letterMat.emissiveIntensity) * 0.06;
    const winGoal = goal.window + cabinPulse * 0.8;
    windowMat.emissiveIntensity += (winGoal - windowMat.emissiveIntensity) * 0.08;
    cabinPulse = Math.max(0, cabinPulse - 0.01);
    (stars.material as THREE.PointsMaterial).opacity += ((sky === 'night' ? 0.95 : 0) - (stars.material as THREE.PointsMaterial).opacity) * 0.06;
    (fireflies.material as THREE.PointsMaterial).opacity += ((sky === 'night' ? 0.9 : sky === 'golden' ? 0.25 : 0) - (fireflies.material as THREE.PointsMaterial).opacity) * 0.06;
    sunMesh.visible = sky !== 'night';
    moonMesh.visible = sky === 'night';
    sunMesh.position.y = sky === 'golden' ? 4.2 : 7.2;
    sun.position.y = sky === 'golden' ? 3.4 : sky === 'night' ? 8 : 9;

    const riverMat = river.material as THREE.MeshStandardMaterial;
    riverMat.emissiveIntensity = 0.12 + Math.sin(time * 2) * 0.05;

    if (!reduced) {
      pines.forEach((pine, i) => {
        const boost = swayBoost * (pine.position.x < 0 ? 1 : 0.25);
        pine.rotation.z = Math.sin(time * 1.4 + i) * (0.015 + boost * 0.08) * dt;
      });
      clouds.forEach((cloud, i) => {
        cloud.position.x += 0.004 + i * 0.001;
        if (cloud.position.x > 6) cloud.position.x = -6;
      });
    }
    swayBoost = Math.max(0, swayBoost - 0.004);
    trail = Math.max(0, trail - 0.004);
    switchbacks.forEach((step, i) => {
      const mat = step.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = trail * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * 6 - i)));
    });

    const fly = (glider: THREE.Group, flight: number, from: THREE.Vector3, control: THREE.Vector3, to: THREE.Vector3) => {
      if (flight < 0) return flight;
      const t = Math.min(1, flight + 0.008);
      const u = 1 - t;
      glider.position.set(
        u * u * from.x + 2 * u * t * control.x + t * t * to.x,
        u * u * from.y + 2 * u * t * control.y + t * t * to.y,
        u * u * from.z + 2 * u * t * control.z + t * t * to.z,
      );
      glider.rotation.z = Math.sin(time * 4) * 0.15;
      glider.visible = t < 1;
      return t < 1 ? t : -1;
    };
    gliderMFlight = fly(gliderM, gliderMFlight, new THREE.Vector3(3.1, 2.5, 0.4), new THREE.Vector3(1.2, 3.3, 1.2), new THREE.Vector3(-1.4, 1.4, 2.2));
    gliderLFlight = fly(gliderL, gliderLFlight, new THREE.Vector3(-3.1, 2.2, 0.5), new THREE.Vector3(-0.4, 3.1, 0.2), new THREE.Vector3(2.4, 1.5, 1.6));

    if (deerHop > 0) {
      deerHop = Math.max(0, deerHop - 0.006);
      const hop = 1 - deerHop;
      deer.position.x = -2.2 + hop * 1.4;
      deer.position.y = 0.02 + Math.abs(Math.sin(hop * Math.PI * 4)) * 0.18;
      deer.visible = deerHop > 0;
    }

    const flyPos = fireflyGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fireflyCount; i += 1) {
      flyPos.setXYZ(i, -1.6 + Math.sin(time * 0.7 + i) * 0.8, 0.3 + ((i * 0.17 + time * 0.15) % 1.2), 1.8 + Math.cos(time * 0.6 + i) * 0.6);
    }
    flyPos.needsUpdate = true;

    rain.visible = weather === 'rain';
    snow.visible = weather === 'snow';
    clouds.forEach((cloud) => {
      cloud.visible = weather !== 'sun';
    });
    const fall = (pts: THREE.Points, speed: number) => {
      if (!pts.visible) return;
      const attr = pts.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < attr.count; i += 1) {
        let y = attr.getY(i) - speed;
        if (y < 0) y = 6 + Math.random() * 2;
        attr.setY(i, y);
      }
      attr.needsUpdate = true;
    };
    fall(rain, reduced ? 0.08 : 0.18);
    fall(snow, reduced ? 0.02 : 0.035);

    for (let i = drifters.length - 1; i >= 0; i -= 1) {
      const drifter = drifters[i];
      drifter.t += drifter.speed * (reduced ? 0.4 : 1) * 0.016 * 60;
      if (drifter.t >= 1) {
        diorama.remove(drifter.mesh);
        drifters.splice(i, 1);
        continue;
      }
      const point = riverCurve.getPointAt(drifter.t);
      drifter.mesh.position.set(point.x, 0.2 + Math.sin(time * 3 + drifter.t * 8) * 0.03, point.z);
    }

    for (let i = skips.length - 1; i >= 0; i -= 1) {
      const skip = skips[i];
      skip.age += 0.016;
      const duration = 1.5;
      const p = Math.min(1, skip.age / duration);
      if (p >= 1) {
        skip.ripples.forEach((ripple) => diorama.remove(ripple.mesh));
        diorama.remove(skip.mesh);
        skips.splice(i, 1);
        continue;
      }
      const across = -1.1 + p * 2.2;
      const hop = Math.abs(Math.sin(p * Math.PI * 3)) * (1 - p) * 0.55;
      skip.mesh.position.set(across, 0.16 + hop, 0.2 + Math.sin(p * 2) * 0.15);
      const hopIndex = Math.floor(p * 3);
      if (skip.ripples.length < hopIndex && hop < 0.05) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.05, 0.08, 16),
          new THREE.MeshBasicMaterial({ color: 0xd7f4f6, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(skip.mesh.position.x, 0.1, skip.mesh.position.z);
        diorama.add(ring);
        skip.ripples.push({ mesh: ring, age: 0 });
      }
      skip.ripples.forEach((ripple) => {
        ripple.age += 0.016;
        const s = 1 + ripple.age * 3;
        ripple.mesh.scale.setScalar(s);
        (ripple.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 - ripple.age);
      });
    }

    renderer.render(scene, camera);
    if (root.dataset.ready !== '1') {
      root.dataset.ready = '1';
      root.dataset.yaw = targetY.toFixed(3);
      publishHotspots();
    }
  }

  function publishHotspots() {
    const publish = (name: string, obj: THREE.Object3D) => {
      const v = obj.getWorldPosition(new THREE.Vector3());
      v.project(camera);
      const x = Math.round((v.x * 0.5 + 0.5) * renderer.domElement.clientWidth);
      const y = Math.round((-v.y * 0.5 + 0.5) * renderer.domElement.clientHeight);
      root.dataset[name] = `${x},${y}`;
    };
    publish('m', mLetter);
    publish('l', lLetter);
    publish('riverSpot', river);
  }

  frame = requestAnimationFrame(tick);

  const onHide = () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(frame);
    } else if (!running) {
      running = true;
      frame = requestAnimationFrame(tick);
    }
  };
  document.addEventListener('visibilitychange', onHide);

  return () => {
    running = false;
    cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', onHide);
    resizeObserver.disconnect();
    themeObserver.disconnect();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
