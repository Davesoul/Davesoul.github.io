/* ===== HERO 3D — "Project City": walkable mini-city, clickable towers ===== */
/* global THREE — classic script vendor/three.min.js (works on file:// too) */

const canvas = document.getElementById('scene');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches && !location.search.includes('motion=1');
canvas.dataset.rm = String(reduced);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  canvas.dataset.ctx = 'ok';
} catch (e) {
  canvas.dataset.ctx = 'fail';
  var msg = document.getElementById('webglStatus');
  if (msg) {
    msg.hidden = false;
    msg.textContent = '3D couldn\u2019t start here — enable \u201CUse graphics acceleration\u201D in your browser settings, or open this page in Chrome/Edge.';
  }
  canvas.style.display = 'none';
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x06080d, 0.014);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);

const CITY = { x: 11, z: -2 };          // city center (right of the hero text)
const CAM_TARGET = new THREE.Vector3(CITY.x, 3.2, CITY.z);

/* ---------- helpers: canvas textures ---------- */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return new THREE.CanvasTexture(c);
}
const dotTex = canvasTex(64, 64, (g) => {
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
});
function facadeTex(accent, litRatio) {
  return canvasTex(96, 192, (g) => {
    g.fillStyle = '#0a0f18'; g.fillRect(0, 0, 96, 192);
    const cols = 6, rows = 12, cw = 96 / cols, rh = 192 / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const lit = Math.random() < litRatio;
      g.fillStyle = lit ? accent : '#141c2b';
      g.globalAlpha = lit ? (0.45 + Math.random() * 0.5) : 1;
      g.fillRect(x * cw + 3, y * rh + 4, cw - 6, rh - 8);
    }
    g.globalAlpha = 1;
  });
}
function labelSprite(text, accent) {
  const tex = canvasTex(512, 128, (g) => {
    g.fillStyle = 'rgba(6,8,13,.82)';
    g.strokeStyle = accent; g.lineWidth = 3;
    const r = 34;
    g.beginPath();
    g.moveTo(r, 6); g.lineTo(506 - r, 6); g.quadraticCurveTo(506, 6, 506, r);
    g.lineTo(506, 122 - r); g.quadraticCurveTo(506, 122, 506 - r, 122);
    g.lineTo(r, 122); g.quadraticCurveTo(6, 122, 6, 122 - r);
    g.lineTo(6, r); g.quadraticCurveTo(6, 6, r, 6); g.closePath();
    g.fill(); g.stroke();
    g.font = '600 44px "JetBrains Mono", monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#f2f5f9';
    g.fillText(text, 256, 66);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, opacity: 0.96 }));
  sp.scale.set(5.4, 1.35, 1);
  sp.renderOrder = 10;
  return sp;
}

/* ---------- starfield ---------- */
(function stars() {
  const n = 700, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const c = new THREE.Color(), palette = ['#ff9a5c', '#7c5cff', '#eef2f6'];
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 170;
    pos[i * 3 + 1] = Math.random() * 70 - 8;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 140 - 20;
    c.set(palette[(Math.random() * palette.length) | 0]);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.35, vertexColors: true, map: dotTex, transparent: true, opacity: 0.65,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  scene.add(pts);
  scene.userData.stars = pts;
})();

/* ---------- ground, roads, plaza ---------- */
const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshBasicMaterial({ color: 0x070b12 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const grid = new THREE.GridHelper(120, 60, 0x24364f, 0x111a2a);
grid.position.y = 0.02;
grid.material.transparent = true;
grid.material.opacity = 0.5;
scene.add(grid);
function road(w, l, x, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ color: 0x0d1524 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.03, z);
  scene.add(m);
}
road(64, 2.4, CITY.x, CITY.z);
const roadV = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 56), new THREE.MeshBasicMaterial({ color: 0x0d1524 }));
roadV.rotation.x = -Math.PI / 2;
roadV.position.set(CITY.x, 0.03, CITY.z);
scene.add(roadV);
const belt = new THREE.Mesh(new THREE.RingGeometry(12.5, 15, 64), new THREE.MeshBasicMaterial({ color: 0x0d1524, side: THREE.DoubleSide }));
belt.rotation.x = -Math.PI / 2;
belt.position.set(CITY.x, 0.03, CITY.z);
scene.add(belt);
const plaza = new THREE.Mesh(new THREE.CircleGeometry(7, 40), new THREE.MeshBasicMaterial({ color: 0x0c1424 }));
plaza.rotation.x = -Math.PI / 2;
plaza.position.set(CITY.x, 0.04, CITY.z);
scene.add(plaza);

/* ---------- project towers ---------- */
const PROJECTS = [
  { name: 'KOMAVERSE', color: '#ff6b35', h: 11, x: 17.5, z: -11, url: 'https://youtu.be/npx_7S3tkvU' },
  { name: 'FLUTTER',   color: '#7c5cff', h: 9,  x: 21,   z: -3.5, url: 'https://davesoul.github.io/Flutter-showcase/' },
  { name: 'FREE-TTS',  color: '#00c8b4', h: 7,  x: 17.5, z: 4,    url: 'https://github.com/Davesoul/free-tts' },
  { name: 'AI-HUB',    color: '#b48cff', h: 8,  x: 11,   z: 9,    url: 'https://github.com/Davesoul/AI-Corporate-Intelligence-Hub' },
  { name: 'ORBITA',    color: '#ff9a5c', h: 5,  x: 6,    z: -8,   url: 'https://github.com/Davesoul/Orbita' },
];
const hitMeshes = [];
const towers = [];
PROJECTS.forEach((p) => {
  const g = new THREE.Group();
  const w = 3.6, d = 3.6;
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, p.h, d), new THREE.MeshBasicMaterial({ map: facadeTex(p.color, 0.55) }));
  box.position.y = p.h / 2;
  box.userData.project = p;
  g.add(box);
  hitMeshes.push(box);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(box.geometry),
    new THREE.LineBasicMaterial({ color: new THREE.Color(p.color), transparent: true, opacity: 0.85 })
  );
  edges.position.y = p.h / 2;
  g.add(edges);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color), transparent: true, opacity: 0.9 }));
  beacon.position.y = p.h + 0.5;
  g.add(beacon);
  const label = labelSprite(p.name, p.color);
  label.position.y = p.h + 2.1;
  g.add(label);
  g.position.set(p.x, 0, p.z);
  scene.add(g);
  towers.push({ def: p, group: g, box, edges, label, beacon, phase: Math.random() * 6.28 });
});
/* Orbita gets a tiny ringed planet on its roof */
(function orbitaRoof() {
  const t = towers.find(t => t.def.name === 'ORBITA');
  if (!t) return;
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff6b35 }));
  s.position.y = t.def.h + 1.1;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.06, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.8 }));
  ring.position.y = t.def.h + 1.1;
  ring.rotation.x = Math.PI / 2 - 0.3;
  t.group.add(s, ring);
  t.roofSpin = ring;
})();

/* ---------- street lamps ---------- */
[[4, -11], [18, -11], [18, 5], [4, 5]].forEach(([x, z]) => {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8), new THREE.MeshBasicMaterial({ color: 0x2a3648 }));
  pole.position.set(x, 1.6, z);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  bulb.position.set(x, 3.3, z);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0xffc98a, transparent: true, opacity: 0.5, depthWrite: false }));
  halo.scale.set(2.4, 2.4, 1);
  halo.position.set(x, 3.3, z);
  scene.add(pole, bulb, halo);
});

/* ---------- the walker character ---------- */
const char = new THREE.Group();
const C_EMBER = 0xff6b35, C_DARK = 0x232c3d, C_SKIN = 0x1a2230;
function part(geo, color, x, y, z) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
  m.position.set(x, y, z);
  return m;
}
const bodyG = new THREE.Group();
const torso = part(new THREE.BoxGeometry(0.62, 0.75, 0.36), C_EMBER, 0, 1.12, 0);
const head = part(new THREE.SphereGeometry(0.27, 16, 16), C_SKIN, 0, 1.62, 0);
const visor = part(new THREE.BoxGeometry(0.4, 0.12, 0.05), 0x7dffd4, 0, 1.62, 0.24);
function limb(w, h, color, x, y) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  pivot.add(part(new THREE.BoxGeometry(w, h, w), color, 0, -h / 2, 0));
  return pivot;
}
const legL = limb(0.2, 0.62, C_DARK, -0.16, 0.78);
const legR = limb(0.2, 0.62, C_DARK, 0.16, 0.78);
const armL = limb(0.15, 0.55, C_EMBER, -0.4, 1.42);
const armR = limb(0.15, 0.55, C_EMBER, 0.4, 1.42);
bodyG.add(torso, head, visor, legL, legR, armL, armR);
char.add(bodyG);
const blob = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }));
blob.rotation.x = -Math.PI / 2;
blob.position.y = 0.05;
char.add(blob);
char.position.set(13, 0, -8);
char.scale.set(2.1, 2.1, 2.1);
const marker = part(new THREE.OctahedronGeometry(0.2, 0), 0xffd9a0, 0, 2.2, 0);
char.add(marker);
const youTag = labelSprite('YOU', '#ffd9a0');
youTag.scale.set(2.6, 0.65, 1);
youTag.position.y = 2.75;
char.add(youTag);
const charGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0xff6b35, transparent: true, opacity: 0.32, depthWrite: false }));
charGlow.scale.set(2.2, 2.2, 1);
charGlow.position.y = 1.1;
char.add(charGlow);
scene.add(char);
const walker = {
  angle: 0, phase: 0, y: 0, vy: 0,
  target: null, tourIdx: 0, moving: false,
  tour: [[17, 1], [18.5, -5], [12, -8.5], [5.5, -4.5], [5, 2.5], [9.5, 4.5]],
};
/* click ripple markers */
const ripples = [];
for (let i = 0; i < 3; i++) {
  const r = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55, 32), new THREE.MeshBasicMaterial({ color: 0xff9a5c, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  r.rotation.x = -Math.PI / 2; r.position.y = 0.06; r.visible = false;
  scene.add(r);
  ripples.push({ mesh: r, t: 1 });
}
let rippleIdx = 0;
function ripple(x, z) {
  const r = ripples[rippleIdx++ % ripples.length];
  r.mesh.position.set(x, 0.06, z);
  r.mesh.visible = true; r.t = 0;
}

/* ---------- input: drag-orbit, click, WASD ---------- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let theta = 0.85, phi = 1.02, radius = fitRadius(), lastOrbit = -10;
function fitRadius() { return innerWidth / innerHeight < 0.85 ? 37 : 27; }
let downPos = null, dragging = false;
const keys = {};
addEventListener('keydown', (e) => {
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code) && scrollY < innerHeight * 0.7) e.preventDefault();
  keys[e.code] = true;
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
function setNDC(e) {
  const r = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}
canvas.addEventListener('pointerdown', (e) => {
  downPos = { x: e.clientX, y: e.clientY };
  dragging = false;
  if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (_) {} }
});
canvas.addEventListener('pointermove', (e) => {
  if (downPos) {
    const dx = e.clientX - downPos.x, dy = e.clientY - downPos.y;
    if (!dragging && Math.hypot(dx, dy) > 6) dragging = true;
    if (dragging) {
      theta -= (e.movementX || 0) * 0.005;
      phi = Math.min(1.32, Math.max(0.55, phi - (e.movementY || 0) * 0.003));
      lastOrbit = perfNow();
      downPos = { x: e.clientX, y: e.clientY };
      return;
    }
  }
  setNDC(e);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(hitMeshes, false)[0];
  document.body.style.cursor = hit ? 'pointer' : '';
  towers.forEach(t => {
    const on = !!(hit && hit.object.userData.project === t.def);
    t.edges.material.opacity = on ? 1 : 0.85;
    t.label.scale.set(on ? 6.4 : 5.4, on ? 1.6 : 1.35, 1);
  });
});
canvas.addEventListener('pointerup', (e) => {
  const wasDrag = dragging;
  downPos = null; dragging = false;
  if (wasDrag) return;
  setNDC(e);
  ray.setFromCamera(ndc, camera);
  const hitB = ray.intersectObjects(hitMeshes, false)[0];
  if (hitB) {
    lastOrbit = perfNow();
    window.open(hitB.object.userData.project.url, '_blank', 'noopener');
    return;
  }
  const hitG = ray.intersectObject(ground, false)[0];
  if (hitG) {
    const dx = hitG.point.x - CITY.x, dz = hitG.point.z - CITY.z;
    const d = Math.hypot(dx, dz);
    const cl = d > 20 ? 20 / d : 1;
    walker.target = { x: CITY.x + dx * cl, z: CITY.z + dz * cl };
    ripple(walker.target.x, walker.target.z);
  }
});
function perfNow() { return performance.now() / 1000; }
let scrollF = 0;
addEventListener('scroll', () => { scrollF = Math.min(scrollY / innerHeight, 1); }, { passive: true });

/* ---------- animation ---------- */
const clock = new THREE.Clock();
let frames = 0;
function step(dt, t) {
  let vx = 0, vz = 0;
  const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  if (fwd || strafe) {
    const fx = Math.sin(walker.angle), fz = Math.cos(walker.angle);
    vx = fx * fwd + fz * strafe;
    vz = fz * fwd - fx * strafe;
    walker.target = null;
  } else {
    if (!walker.target) {
      const wp = walker.tour[walker.tourIdx % walker.tour.length];
      walker.target = { x: wp[0], z: wp[1], tour: true };
    }
    const dx = walker.target.x - char.position.x, dz = walker.target.z - char.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.4) {
      if (walker.target.tour) walker.tourIdx++;
      walker.target = null;
    } else {
      vx = dx / d; vz = dz / d;
    }
  }
  const moving = (vx !== 0 || vz !== 0);
  walker.moving = moving;
  if (moving) {
    char.position.x += vx * 4.5 * dt;
    char.position.z += vz * 4.5 * dt;
    const want = Math.atan2(vx, vz);
    let diff = want - walker.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    walker.angle += diff * Math.min(1, dt * 10);
    walker.phase += dt * 11;
  } else {
    walker.phase *= 1 - Math.min(1, dt * 8);
  }
  char.rotation.y = walker.angle;
  const sw = moving ? Math.sin(walker.phase) * 0.6 : 0;
  legL.rotation.x = sw; legR.rotation.x = -sw;
  armL.rotation.x = -sw * 0.8; armR.rotation.x = sw * 0.8;
  if (keys.Space && walker.y === 0) walker.vy = 5;
  if (walker.y > 0 || walker.vy !== 0) {
    walker.vy -= 13 * dt;
    walker.y += walker.vy * dt;
    if (walker.y <= 0) { walker.y = 0; walker.vy = 0; }
  }
  bodyG.position.y = walker.y + (moving ? Math.abs(Math.sin(walker.phase)) * 0.07 : 0);
  bodyG.rotation.x = moving ? 0.09 : 0;
  marker.rotation.y += dt * 2;
  marker.position.y = 2.9 + Math.sin(t * 3) * 0.15;
  towers.forEach(t => {
    t.beacon.material.opacity = 0.55 + 0.4 * Math.sin(t * 2.4 + t.phase);
    if (t.roofSpin) t.roofSpin.rotation.z += dt * 0.8;
  });
  ripples.forEach(r => {
    if (!r.mesh.visible) return;
    r.t += dt * 1.8;
    if (r.t >= 1) { r.mesh.visible = false; return; }
    const s = 1 + r.t * 3;
    r.mesh.scale.set(s, s, 1);
    r.mesh.material.opacity = 0.8 * (1 - r.t);
  });
  scene.userData.stars.rotation.y = t * 0.008;
}
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  frames++;
  if (frames % 30 === 0) canvas.dataset.frames = String(frames);
  const now = perfNow();
  if (now - lastOrbit > 8) theta += dt * 0.05;
  camera.position.set(
    CAM_TARGET.x + radius * Math.sin(phi) * Math.sin(theta),
    CAM_TARGET.y + radius * Math.cos(phi),
    CAM_TARGET.z + radius * Math.sin(phi) * Math.cos(theta)
  );
  camera.lookAt(CAM_TARGET);
  canvas.style.opacity = String(1 - scrollF * 0.85);
  step(dt, t);
  renderer.render(scene, camera);
  if (!reduced) requestAnimationFrame(frame);
}
if (reduced) {
  /* motion-sensitive users still get the full city, frozen as one static frame */
  try {
    step(0, 0.6);
    renderer.render(scene, camera);
  } catch (e2) {
    canvas.style.display = 'none';
  }
} else {
  frame();
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  radius = fitRadius();
});
