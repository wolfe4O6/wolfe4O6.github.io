import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

type HotspotId = 'computer' | 'printer' | 'handheld' | 'pegboard' | 'window' | 'lamp';

const LABELS: Record<HotspotId, string> = {
  computer: 'Computer',
  printer: '3D printer',
  handheld: 'Handheld',
  pegboard: 'Pegboard',
  window: 'Window',
  lamp: 'Lamp',
};

const PANELS: Record<HotspotId, string | null> = {
  computer: 'projects',
  printer: 'projects',
  handheld: 'links',
  pegboard: 'about',
  window: 'window',
  lamp: null,
};

export function mountRoom(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]');
  const load = root.querySelector<HTMLElement>('[data-load]');
  const bar = root.querySelector<HTMLElement>('[data-bar]');
  const label = root.querySelector<HTMLElement>('[data-label]');
  const list = root.querySelector<HTMLElement>('[data-list]');
  const panel = root.querySelector<HTMLElement>('[data-panel]');
  const hint = root.querySelector<HTMLElement>('[data-hint]');
  if (!canvas || !load || !bar || !label || !list || !panel) return;

  const sentinelUrl = root.dataset.sentinel ?? '';
  const jumboUrl = root.dataset.jumbo ?? '';

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch {
    root.dataset.fallback = '1';
    load.hidden = true;
    return;
  }
  if (!renderer.getContext()) {
    root.dataset.fallback = '1';
    load.hidden = true;
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor('#c9b79a');
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#d9c7aa', 11, 18);

  const narrow = window.matchMedia('(max-width: 759px)').matches;
  const camera = new THREE.PerspectiveCamera(narrow ? 58 : 40, 1, 0.1, 40);
  camera.position.set(narrow ? 4.8 : 4.1, narrow ? 2.7 : 2.35, narrow ? 5.6 : 4.6);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0.1, 1.15, -0.2);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 3.1;
  controls.maxDistance = 7.4;
  controls.maxPolarAngle = 1.42;
  controls.minPolarAngle = 0.72;
  controls.enablePan = true;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) controls.enableDamping = false;

  const wood = texture(woodCanvas(), 2.4, 2.4);
  const plaster = texture(plasterCanvas(), 1.5, 1.5);
  const peg = texture(pegCanvas(), 1, 1);

  const floorMat = standard('#8b5a34', { map: wood, roughness: 0.78 });
  const wallMat = standard('#efe2cf', { map: plaster, roughness: 0.94 });
  const trimMat = standard('#4a3022', { roughness: 0.7 });
  const deskMat = standard('#6d4328', { roughness: 0.72 });
  const metalMat = standard('#3c4450', { roughness: 0.42, metalness: 0.35 });
  const paperMat = standard('#f6efe2', { roughness: 0.9 });
  const printerMat = standard('#e7e2d8', { roughness: 0.62 });
  const filamentMat = standard('#c4552a', { roughness: 0.45 });

  const hemi = new THREE.HemisphereLight('#fff4e4', '#8a6244', 0.72);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight('#ffe7c8', 0.28));

  const sun = new THREE.DirectionalLight('#fff1dc', 2.4);
  sun.position.set(-2.2, 4.4, -3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.4;
  sun.shadow.camera.far = 16;
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  scene.add(sun);

  const lampLight = new THREE.PointLight('#ffb15e', 36, 7.5, 2);
  lampLight.position.set(1.55, 1.85, 0.35);
  lampLight.castShadow = false;
  scene.add(lampLight);

  const room = new THREE.Group();
  scene.add(room);

  const floor = mesh(new THREE.BoxGeometry(7.4, 0.12, 5.4), floorMat);
  floor.position.y = -0.06;
  floor.receiveShadow = true;
  room.add(floor);

  const back = mesh(new THREE.BoxGeometry(7.4, 3.15, 0.12), wallMat);
  back.position.set(0, 1.55, -2.7);
  room.add(back);
  const left = mesh(new THREE.BoxGeometry(0.12, 3.15, 5.4), wallMat);
  left.position.set(-3.7, 1.55, 0);
  room.add(left);
  const right = mesh(new THREE.BoxGeometry(0.12, 3.15, 5.4), wallMat);
  right.position.set(3.7, 1.55, 0);
  room.add(right);

  const baseboard = mesh(new THREE.BoxGeometry(7.2, 0.12, 0.08), trimMat);
  baseboard.position.set(0, 0.08, -2.6);
  room.add(baseboard);

  const windowGroup = buildWindow(sentinelUrl, jumboUrl, trimMat);
  windowGroup.position.set(0.15, 1.62, -2.58);
  room.add(windowGroup);

  const pegboard = buildPegboard(peg, trimMat, metalMat);
  pegboard.position.set(-3.58, 1.55, -0.35);
  room.add(pegboard);

  const desk = buildDesk(deskMat, metalMat, paperMat);
  desk.position.set(1.35, 0, 0.55);
  room.add(desk);

  const printer = buildPrinter(printerMat, metalMat, filamentMat);
  printer.position.set(-1.55, 0, 0.35);
  room.add(printer);

  const lamp = buildLamp(trimMat);
  lamp.position.set(2.15, 0.78, 0.15);
  room.add(lamp);

  const stool = buildStool(deskMat, trimMat);
  stool.position.set(1.15, 0, 1.55);
  room.add(stool);

  tag(desk, 'computer');
  tag(printer, 'printer');
  tag(pegboard, 'pegboard');
  tag(windowGroup, 'window');
  tag(lamp, 'lamp');
  const handheld = desk.getObjectByName('handheld');
  if (handheld) tag(handheld, 'handheld');

  const shade = lamp.getObjectByName('shade');
  let lampOn = true;

  const setLamp = (on: boolean) => {
    lampOn = on;
    lampLight.intensity = on ? 36 : 2;
    if (shade && shade instanceof THREE.Mesh && shade.material instanceof THREE.MeshStandardMaterial) {
      shade.material.emissive.set(on ? '#ffd7a1' : '#3a2a18');
      shade.material.emissiveIntensity = on ? 0.7 : 0.05;
    }
  };
  setLamp(true);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downX = 0;
  let downY = 0;
  let hovered: HotspotId | null = null;

  const hotspotOf = (object: THREE.Object3D | null): HotspotId | null => {
    let current: THREE.Object3D | null = object;
    while (current) {
      const id = current.userData.hotspot as HotspotId | undefined;
      if (id) return id;
      current = current.parent;
    }
    return null;
  };

  const pick = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(room.children, true);
    return hotspotOf(hits[0]?.object ?? null);
  };

  const placeLabel = (id: HotspotId | null) => {
    hovered = id;
    if (!id) {
      label.hidden = true;
      canvas.style.cursor = 'grab';
      return;
    }
    label.hidden = false;
    label.textContent = LABELS[id];
    canvas.style.cursor = 'pointer';
  };

  canvas.addEventListener('pointerdown', (event) => {
    downX = event.clientX;
    downY = event.clientY;
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.buttons) return;
    placeLabel(pick(event));
  });
  canvas.addEventListener('pointerleave', () => placeLabel(null));
  canvas.addEventListener('pointerup', (event) => {
    const moved = Math.hypot(event.clientX - downX, event.clientY - downY);
    if (moved > 8) return;
    const id = pick(event);
    if (!id) {
      closePanel();
      return;
    }
    if (id === 'lamp') {
      setLamp(!lampOn);
      return;
    }
    openPanel(PANELS[id] ?? 'about', LABELS[id]);
  });

  const openPanel = (name: string, title: string) => {
    panel.hidden = false;
    panel.dataset.open = name;
    const heading = panel.querySelector<HTMLElement>('[data-panel-title]');
    if (heading) heading.textContent = title;
    panel.querySelectorAll<HTMLElement>('[data-sheet]').forEach((sheet) => {
      sheet.hidden = sheet.dataset.sheet !== name;
    });
    panel.querySelector<HTMLButtonElement>('[data-close]')?.focus();
  };

  const closePanel = () => {
    panel.hidden = true;
    delete panel.dataset.open;
  };

  panel.querySelector('[data-close]')?.addEventListener('click', closePanel);
  panel.querySelector('[data-scrim]')?.addEventListener('click', closePanel);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePanel();
  });

  root.querySelectorAll<HTMLButtonElement>('[data-open]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.open as HotspotId;
      if (id === 'lamp') {
        setLamp(!lampOn);
        return;
      }
      openPanel(PANELS[id] ?? 'about', LABELS[id]);
    });
  });

  const listToggle = root.querySelector<HTMLButtonElement>('[data-list-toggle]');
  listToggle?.addEventListener('click', () => {
    const open = list.dataset.shown === '1';
    list.dataset.shown = open ? '0' : '1';
    listToggle.setAttribute('aria-expanded', open ? 'false' : 'true');
  });

  const resize = () => {
    const width = canvas.clientWidth || root.clientWidth;
    const height = canvas.clientHeight || root.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(root);

  let ready = false;
  const finish = () => {
    if (ready) return;
    ready = true;
    bar.style.transform = 'scaleX(1)';
    window.setTimeout(() => {
      load.hidden = true;
      hint?.removeAttribute('hidden');
    }, 180);
  };

  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loadedCount, total) => {
    if (total) bar.style.transform = `scaleX(${loadedCount / total})`;
  };
  manager.onLoad = finish;
  const loader = new THREE.TextureLoader(manager);
  const applyPhoto = (url: string, name: string) => {
    if (!url) return;
    loader.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      const pane = windowGroup.getObjectByName(name);
      if (pane instanceof THREE.Mesh && pane.material instanceof THREE.MeshBasicMaterial) {
        pane.material.map = tex;
        pane.material.needsUpdate = true;
      }
    });
  };
  applyPhoto(sentinelUrl, 'pane-m');
  applyPhoto(jumboUrl, 'pane-l');
  if (!sentinelUrl && !jumboUrl) finish();
  window.setTimeout(finish, 2500);

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  return () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    controls.dispose();
    renderer.dispose();
  };
}

function standard(
  color: string,
  extras: { map?: THREE.Texture; roughness?: number; metalness?: number } = {},
) {
  return new THREE.MeshStandardMaterial({
    color,
    map: extras.map,
    roughness: extras.roughness ?? 0.86,
    metalness: extras.metalness ?? 0,
  });
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material) {
  const object = new THREE.Mesh(geometry, material);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

function box(w: number, h: number, d: number, material: THREE.Material) {
  return mesh(new THREE.BoxGeometry(w, h, d), material);
}

function tag(object: THREE.Object3D, id: HotspotId) {
  object.traverse((child) => {
    child.userData.hotspot = id;
  });
}

function texture(canvas: HTMLCanvasElement, rx: number, ry: number) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  return tex;
}

function woodCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  const boards = ['#8d5b34', '#7a4e2c', '#96633a', '#6e4528'];
  for (let y = 0; y < 256; y += 32) {
    g.fillStyle = boards[(y / 32) % boards.length];
    g.fillRect(0, y, 256, 32);
    g.fillStyle = 'rgba(40, 18, 8, 0.35)';
    g.fillRect(0, y + 30, 256, 2);
  }
  return canvas;
}

function plasterCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  g.fillStyle = '#efe2cf';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 80; i += 1) {
    g.fillStyle = i % 2 ? 'rgba(90, 60, 30, 0.05)' : 'rgba(255, 255, 255, 0.08)';
    g.fillRect((i * 17) % 128, (i * 29) % 128, 2, 2);
  }
  return canvas;
}

function pegCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 160;
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  g.fillStyle = '#d7c4a4';
  g.fillRect(0, 0, 128, 160);
  g.fillStyle = '#4a3022';
  for (let y = 10; y < 160; y += 16) {
    for (let x = 10; x < 128; x += 16) {
      g.beginPath();
      g.arc(x, y, 1.4, 0, Math.PI * 2);
      g.fill();
    }
  }
  return canvas;
}

function buildWindow(sentinelUrl: string, jumboUrl: string, trim: THREE.Material) {
  const group = new THREE.Group();
  group.name = 'window';
  const frame = box(2.7, 1.7, 0.08, trim);
  group.add(frame);
  const mullion = box(0.06, 1.55, 0.1, trim);
  group.add(mullion);
  const makePane = (name: string, x: number, color: string) => {
    const pane = mesh(
      new THREE.PlaneGeometry(1.18, 1.42),
      new THREE.MeshBasicMaterial({ color }),
    );
    pane.name = name;
    pane.position.set(x, 0, 0.05);
    pane.castShadow = false;
    group.add(pane);
    void sentinelUrl;
    void jumboUrl;
  };
  makePane('pane-m', -0.66, '#8aa0b8');
  makePane('pane-l', 0.66, '#7f9a72');
  const sill = box(2.9, 0.08, 0.18, trim);
  sill.position.set(0, -0.86, 0.08);
  group.add(sill);
  return group;
}

function buildPegboard(map: THREE.Texture, trim: THREE.Material, metal: THREE.Material) {
  const group = new THREE.Group();
  const board = box(0.08, 1.7, 1.35, standard('#d7c4a4', { map, roughness: 0.9 }));
  group.add(board);
  const rail = box(0.1, 0.06, 1.4, trim);
  rail.position.set(0.04, 0.78, 0);
  group.add(rail);
  const hammer = new THREE.Group();
  const handle = box(0.06, 0.42, 0.06, trim);
  const head = box(0.08, 0.1, 0.22, metal);
  head.position.y = 0.2;
  hammer.add(handle, head);
  hammer.position.set(0.1, 0.25, -0.28);
  group.add(hammer);
  const driver = box(0.04, 0.5, 0.04, metal);
  driver.position.set(0.1, 0.05, 0.05);
  driver.rotation.z = 0.15;
  group.add(driver);
  const spool = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 16), standard('#c4552a', { roughness: 0.4 }));
  spool.rotation.x = Math.PI / 2;
  spool.position.set(0.1, -0.35, 0.32);
  group.add(spool);
  return group;
}

function buildDesk(wood: THREE.Material, metal: THREE.Material, paper: THREE.Material) {
  const group = new THREE.Group();
  const top = box(2.5, 0.08, 1.15, wood);
  top.position.y = 0.78;
  group.add(top);
  for (const [x, z] of [
    [-1.1, -0.45],
    [1.1, -0.45],
    [-1.1, 0.45],
    [1.1, 0.45],
  ] as const) {
    const leg = box(0.08, 0.78, 0.08, wood);
    leg.position.set(x, 0.39, z);
    group.add(leg);
  }
  const monitor = new THREE.Group();
  const bezel = box(0.78, 0.5, 0.05, standard('#241c16', { roughness: 0.55 }));
  bezel.position.set(0, 1.28, -0.28);
  const screen = box(0.66, 0.38, 0.02, new THREE.MeshBasicMaterial({ color: '#d5e3c4' }));
  screen.position.set(0, 1.28, -0.25);
  const stand = box(0.08, 0.22, 0.08, metal);
  stand.position.set(0, 0.96, -0.28);
  const foot = box(0.28, 0.03, 0.16, metal);
  foot.position.set(0, 0.84, -0.28);
  monitor.add(bezel, screen, stand, foot);
  group.add(monitor);

  const keys = box(0.46, 0.03, 0.16, standard('#2c2418', { roughness: 0.6 }));
  keys.position.set(0.05, 0.84, 0.12);
  group.add(keys);

  const note = box(0.28, 0.01, 0.2, paper);
  note.position.set(-0.7, 0.83, 0.05);
  note.rotation.y = -0.2;
  group.add(note);

  const handheld = buildHandheld();
  handheld.name = 'handheld';
  handheld.position.set(0.72, 0.86, 0.18);
  handheld.rotation.y = -0.4;
  group.add(handheld);
  return group;
}

function buildHandheld() {
  const group = new THREE.Group();
  const body = box(0.34, 0.06, 0.62, standard('#2f3a34', { roughness: 0.55 }));
  const screen = box(0.22, 0.02, 0.28, new THREE.MeshBasicMaterial({ color: '#9fd0c2' }));
  screen.position.set(0, 0.035, -0.08);
  const pad = box(0.07, 0.02, 0.07, standard('#1b1612', { roughness: 0.5 }));
  pad.position.set(-0.08, 0.04, 0.16);
  const button = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), standard('#c4552a', { roughness: 0.4 }));
  button.position.set(0.08, 0.04, 0.14);
  group.add(body, screen, pad, button);
  return group;
}

function buildPrinter(bodyMat: THREE.Material, metal: THREE.Material, filament: THREE.Material) {
  const group = new THREE.Group();
  const table = box(1.15, 0.08, 0.85, standard('#6d4328', { roughness: 0.72 }));
  table.position.y = 0.72;
  group.add(table);
  for (const [x, z] of [
    [-0.48, -0.32],
    [0.48, -0.32],
    [-0.48, 0.32],
    [0.48, 0.32],
  ] as const) {
    const leg = box(0.06, 0.72, 0.06, standard('#6d4328', { roughness: 0.72 }));
    leg.position.set(x, 0.36, z);
    group.add(leg);
  }
  const bed = box(0.7, 0.04, 0.55, metal);
  bed.position.set(0, 0.9, 0);
  group.add(bed);
  const posts = [
    [-0.32, -0.24],
    [0.32, -0.24],
    [-0.32, 0.24],
    [0.32, 0.24],
  ] as const;
  for (const [x, z] of posts) {
    const post = box(0.04, 0.55, 0.04, metal);
    post.position.set(x, 1.18, z);
    group.add(post);
  }
  const gantry = box(0.7, 0.05, 0.05, metal);
  gantry.position.set(0, 1.32, 0);
  group.add(gantry);
  const head = box(0.1, 0.12, 0.1, filament);
  head.position.set(0.05, 1.22, 0);
  group.add(head);
  const housing = box(0.78, 0.16, 0.62, bodyMat);
  housing.position.set(0, 1.5, 0);
  group.add(housing);
  const spool = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 18), filament);
  spool.rotation.z = Math.PI / 2;
  spool.position.set(0.52, 1.15, 0);
  group.add(spool);
  return group;
}

function buildLamp(trim: THREE.Material) {
  const group = new THREE.Group();
  const base = mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.04, 16), trim);
  base.position.y = 0.02;
  const stem = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.42, 8), standard('#c9a15b', { metalness: 0.4, roughness: 0.35 }));
  stem.position.y = 0.24;
  const shadeMat = standard('#f3d7a1', { roughness: 0.7 });
  shadeMat.emissive.set('#ffd7a1');
  shadeMat.emissiveIntensity = 0.7;
  const shade = mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.16, 16, 1, true), shadeMat);
  shade.name = 'shade';
  shade.position.y = 0.48;
  group.add(base, stem, shade);
  return group;
}

function buildStool(wood: THREE.Material, trim: THREE.Material) {
  const group = new THREE.Group();
  const seat = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16), wood);
  seat.position.y = 0.48;
  group.add(seat);
  for (let i = 0; i < 4; i += 1) {
    const leg = box(0.04, 0.46, 0.04, trim);
    const angle = (i / 4) * Math.PI * 2;
    leg.position.set(Math.cos(angle) * 0.14, 0.23, Math.sin(angle) * 0.14);
    group.add(leg);
  }
  return group;
}
