/* ===== HERO 3D — "Project City": walkable mini-city, clickable towers ===== */
/* global THREE — classic script vendor/three.min.js (works on file:// too) */

const canvas = document.getElementById('scene');
/* live debug HUD (?dbg): what the movement code actually does, in your own browser */
const DBG = location.search.includes('dbg');
let dbgDiv = null;
if (DBG) {
  dbgDiv = document.createElement('div');
  dbgDiv.id = 'dbgHud';
  dbgDiv.style.cssText = 'position:fixed;left:12px;top:60px;z-index:99;max-width:78vw;background:#04140c;color:#b8ffd7;font:11px/1.5 monospace;padding:8px 10px;border:1px solid #1d5c38;border-radius:8px;white-space:pre-wrap;pointer-events:none';
  document.body.appendChild(dbgDiv);
}
function dbgLog(...a) { if (DBG) console.log('[walk]', ...a); }
/* visible error badge: if page JS breaks on a visitor's machine, they see red text instead of silence */
addEventListener('error', (ev) => {
  let d = document.getElementById('errBadge');
  if (!d) {
    d = document.createElement('div'); d.id = 'errBadge';
    d.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99;max-width:70vw;background:#3a0d0d;color:#ffd7d7;font:12px monospace;padding:8px 10px;border:1px solid #a33;border-radius:8px;white-space:pre-wrap';
    document.body.appendChild(d);
  }
  d.textContent = 'Page error: ' + String((ev && ev.message) || ev).slice(0, 300);
});
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
scene.add(new THREE.HemisphereLight(0xdfeaff, 0x223349, 1.05));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
dirLight.position.set(18, 26, 12);
scene.add(dirLight);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);

const CITY = { x: 11, z: -2 };          // city center (right of the hero text)
const CAM_HOME = { theta: 0.85, phi: 1.02 };
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
const beamTex = canvasTex(32, 256, (g) => {
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.75, 'rgba(255,255,255,.85)');
  grad.addColorStop(1, 'rgba(255,255,255,.9)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 256);
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
  const c = new THREE.Color(), palette = ['#b9a8ff', '#8b7cf6', '#efedf7'];
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
  { name: 'KOMAVERSE', color: '#8b7cf6', h: 11, x: 17.5, z: -11, url: 'https://youtu.be/npx_7S3tkvU' },
  { name: 'FLUTTER',   color: '#5b4fd6', h: 9,  x: 21,   z: -3.5, url: 'https://davesoul.github.io/Flutter-showcase/' },
  { name: 'FREE-TTS',  color: '#00c8b4', h: 7,  x: 17.5, z: 4,    url: 'https://github.com/Davesoul/free-tts' },
  { name: 'AI-HUB',    color: '#b48cff', h: 8,  x: 11,   z: 9,    url: 'https://github.com/Davesoul/AI-Corporate-Intelligence-Hub' },
  { name: 'ORBITA',    color: '#b9a8ff', h: 5,  x: 6,    z: -8,   url: 'https://github.com/Davesoul/Orbita' },
];
const LS = innerWidth / innerHeight < 0.85 ? 0.75 : 1;   /* label/door scale on narrow screens */
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
  label.userData.base = { x: 5.4 * LS, y: 1.35 * LS };
  label.scale.set(label.userData.base.x, label.userData.base.y, 1);
  label.position.y = p.h + 2.1;
  g.add(label);
  g.position.set(p.x, 0, p.z);
  scene.add(g);
  towers.push({ def: p, group: g, box, edges, label, beacon, phase: Math.random() * 6.28 });
});
/* glowing portal doors on the plaza-facing side of each tower */
const doors = [];
let activeDoor = null;
const doorPrompt = document.getElementById('doorPrompt');
function makeDoor(p) {
  const toPlaza = new THREE.Vector3(CITY.x - p.x, 0, CITY.z - p.z).normalize();
  const pos = new THREE.Vector3(p.x + toPlaza.x * 3.4, 0, p.z + toPlaza.z * 3.4);
  const g = new THREE.Group();
  const dw = 1.7 * LS, dh = 3.2 * LS;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(dw + 1.0, dh + 1.0), new THREE.MeshBasicMaterial({ map: dotTex, color: new THREE.Color(p.color), transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }));
  glow.position.y = dh / 2;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), new THREE.MeshBasicMaterial({ color: 0x11182a, side: THREE.DoubleSide }));
  panel.position.y = dh / 2;
  panel.userData.project = p;
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(panel.geometry), new THREE.LineBasicMaterial({ color: new THREE.Color(p.color) }));
  frame.position.y = dh / 2;
  const step = new THREE.Mesh(new THREE.PlaneGeometry(dw + 0.7, 0.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color), transparent: true, opacity: 0.22 }));
  step.rotation.x = -Math.PI / 2;
  step.position.y = 0.05;
  g.add(glow, panel, frame, step);
  const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, color: new THREE.Color(p.color), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam1 = new THREE.Mesh(new THREE.PlaneGeometry(0.7 * LS, 10), beamMat);
  beam1.position.y = 5;
  const beam2 = beam1.clone();
  beam2.rotation.y = Math.PI / 2;
  g.add(beam1, beam2);
  g.position.copy(pos);
  g.lookAt(pos.x + toPlaza.x, 0, pos.z + toPlaza.z);
  scene.add(g);
  hitMeshes.push(panel);
  doors.push({ def: p, group: g, pos, glow });
}
PROJECTS.forEach(makeDoor);
doorPrompt.addEventListener('click', () => {
  if (activeDoor) window.open(activeDoor.def.url, '_blank', 'noopener');
});
/* Orbita gets a tiny ringed planet on its roof */
(function orbitaRoof() {
  const t = towers.find(t => t.def.name === 'ORBITA');
  if (!t) return;
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16), new THREE.MeshBasicMaterial({ color: 0x8b7cf6 }));
  s.position.y = t.def.h + 1.1;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.06, 8, 40), new THREE.MeshBasicMaterial({ color: 0xe5a83b, transparent: true, opacity: 0.8 }));
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

/* ---------- the walker character (real FBX model, primitive robot fallback) ---------- */
const char = new THREE.Group();
const C_EMBER = 0x8b7cf6, C_DARK = 0x232c3d, C_SKIN = 0x1a2232;
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
const marker = part(new THREE.OctahedronGeometry(0.2, 0), 0xffd9a0, 0, 2.2, 0);
char.add(marker);
const youTag = labelSprite('YOU', '#ffd9a0');
youTag.scale.set(2.6 * LS, 0.65 * LS, 1);
youTag.position.y = 2.75;
char.add(youTag);
const charGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0x8b7cf6, transparent: true, opacity: 0.32, depthWrite: false }));
charGlow.scale.set(2.2, 2.2, 1);
charGlow.position.y = 1.1;
char.add(charGlow);
char.position.set(13, 0, -8);
char.scale.set(2.1, 2.1, 2.1);
scene.add(char);
/* swap in the real anime model when it loads; primitive stays as fallback */
let modelObj = null, primitiveMode = true;
let animMixer = null, idleAction = null, runAction = null, activeAnim = null, bindHipsY = 76;
let restQMap = {}, restPMap = {};
try {
  if (THREE.FBXLoader) {
    new THREE.FBXLoader().load('assets/char.fbx', (model) => {
      pruneSkeleton(model);
      const bb = new THREE.Box3().setFromObject(model);
      const sz = bb.getSize(new THREE.Vector3());
      model.scale.setScalar((3.4 / char.scale.x) / Math.max(sz.x, sz.y, sz.z));
      const b2 = new THREE.Box3().setFromObject(model);
      model.position.x -= (b2.min.x + b2.max.x) / 2;
      model.position.z -= (b2.min.z + b2.max.z) / 2;
      model.position.y -= b2.min.y;
      const SKIN = 0x6e452b, HAIR = 0x17110c, DARKC = 0x1a1d24, EYE = 0xf0ece4;
      model.traverse((o) => {
        if (o.isMesh) {
          o.material = o.material.clone();
          const n = o.name || '';
          if (/Head|Hands|Legs/.test(n)) o.material.color.set(SKIN);
          else if (/Hair/.test(n)) o.material.color.set(HAIR);
          else if (/Shoes/.test(n)) o.material.color.set(DARKC);
          else if (/^Eyes$/.test(n)) o.material.color.set(EYE);
          else if (/Eyelash|Eyebrow/.test(n)) o.material.color.set(HAIR);
          o.material.needsUpdate = true;
        }
      });
      const picked = prepareRig(model);
      const dynMap = {};
      Object.keys(BONE_MAP).forEach((m) => { if (picked[BONE_MAP[m]]) dynMap[m] = picked[BONE_MAP[m]].name; });
      restQMap = {}; restPMap = {};
      Object.keys(dynMap).forEach((m) => { const b = model.getObjectByName(dynMap[m]); if (b) { restQMap[dynMap[m]] = b.quaternion.clone(); restPMap[dynMap[m]] = b.position.clone(); } });
      const thighDx = picked['thighL'] || picked['thighR'] || null;
      model.updateMatrixWorld(true);
      const pelvW = new THREE.Vector3();
      const pelvB = picked['spine'] || (thighDx ? thighDx.parent : null);
      if (pelvB) pelvB.getWorldPosition(pelvW);
      bindHipsY = pelvB ? (pelvW.y - model.position.y) / model.scale.x : 76;
      animMixer = new THREE.AnimationMixer(model);
      activeAnim = null;
      const loadClip = (url, loop, attempt) => {
        const tag = /idle/.test(url) ? 'idle' : 'run';
        window.__clipState = window.__clipState || {};
        window.__clipState[tag] = 'loading';
        new THREE.FBXLoader().load(url, (asset) => {
          const clip = asset.animations && asset.animations[0];
          if (!clip) { window.__clipState[tag] = 'empty'; dbgLog('clip EMPTY (no animation track)', url); return; }
          window.__clipState[tag] = 'ok';
          asset.updateMatrixWorld(true);
          const rc = retargetClip(clip, asset, dynMap);
          const action = animMixer.clipAction(rc);
          if (!loop) { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
          if (/idle/.test(url)) idleAction = action;
          else runAction = action;
        }, undefined, () => {
          if ((attempt || 0) < 2) { dbgLog('clip retry', url); setTimeout(() => loadClip(url, loop, (attempt || 0) + 1), 1500); }
          else { window.__clipState[tag] = 'fetch-failed'; dbgLog('clip FETCH FAILED', url); }
        });
      };
      loadClip('assets/anim-idle.fbx', true);
      loadClip('assets/anim-run.fbx', true);
      modelObj = model;
      modelObj.userData.baseY = model.position.y;
      bodyG.visible = false;
      char.add(model);
      primitiveMode = false;
      canvas.dataset.char = 'fbx';
    }, undefined, () => { canvas.dataset.char = 'fbx-fallback'; });
  }
} catch (e) { canvas.dataset.char = 'fbx-fallback'; }
const walker = {
  angle: CAM_HOME.theta, phase: 0, y: 0, vy: 0,
  target: null, tourIdx: 0, moving: false,
  tour: [[17, 1], [18.5, -5], [12, -8.5], [5.5, -4.5], [5, 2.5], [9.5, 4.5]],
};
/* solid tower footprints: the walker slides around buildings instead of vanishing inside them */
const COLLIDERS = PROJECTS.map((p) => ({ x: p.x, z: p.z, r: 3.1 }));
function collide(px, pz) {
  let x = px, z = pz;
  for (let i = 0; i < 2; i++) {
    for (const c of COLLIDERS) {
      const dx = x - c.x, dz = z - c.z;
      const d = Math.hypot(dx, dz);
      if (d < c.r && d > 1e-4) { x = c.x + (dx / d) * c.r; z = c.z + (dz / d) * c.r; }
      else if (d <= 1e-4) { x = c.x + c.r; }
    }
  }
  const ox = x - CITY.x, oz = z - CITY.z;
  const od = Math.hypot(ox, oz);
  if (od > 20) { x = CITY.x + (ox / od) * 20; z = CITY.z + (oz / od) * 20; }
  return [x, z];
}
/* Mixamo clips retargeted onto the anime rig by bone-name map; hips x/z pinned so locomotion stays in place */
/* the file ships a dozen stacked same-named armatures (metarig/spring leftovers):
   keep only bones that actually deform the mesh (+ their ancestors) so the mixer binds the right ones */
/* pick the true deform bones by skin weight (the file stacks same-named rigs):
   the max-weight bone per anime name is the one that moves the mesh — rename it Dx_* so clips bind it */
function prepareRig(model) {
  const meshes = [];
  model.traverse((o) => { if (o.isSkinnedMesh && o.skeleton && o.geometry.attributes.skinIndex) meshes.push(o); });
  const wIn = (bone, meshRe) => {
    let s = 0;
    meshes.forEach((m) => {
      if (meshRe && !meshRe.test(m.name || '')) return;
      const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
      const arr = si.array, warr = sw ? sw.array : null, bones = m.skeleton.bones;
      for (let i = 0; i < si.count; i++)
        for (let j = 0; j < 4; j++)
          if (bones[arr[i * 4 + j]] === bone) s += warr ? warr[i * 4 + j] : 1;
    });
    return s;
  };
  const bestNamed = (meshRe, nm) => {
    let best = null, bw = 0;
    const seen = new Set();
    meshes.forEach((m) => {
      if (meshRe && !meshRe.test(m.name || '')) return;
      (m.skeleton.bones || []).forEach((b) => {
        if (b.name === nm && !seen.has(b)) { seen.add(b); const w = wIn(b, null); if (w > bw) { bw = w; best = b; } }
      });
    });
    return best;
  };
  const LEG = /Legs|Shorts/, HEADM = /Head/, SHOE = /Shoes/;
  const picked = {};
  const tl = bestNamed(LEG, 'thighL'), tr = bestNamed(LEG, 'thighR');
  if (tl) picked['thighL'] = tl;
  if (tr) picked['thighR'] = tr;
  const H = (() => {
    let h = tl ? tl.parent : (tr ? tr.parent : null);
    const anc = new Set();
    let q = bestNamed(HEADM, 'Neck'), g0 = 0;
    while (q && g0++ < 14) { anc.add(q); q = q.parent; }
    let p = tl, g1 = 0;
    while (p && g1++ < 14) { if (anc.has(p)) { h = p; break; } p = p.parent; }
    return h;
  })();
  const chainTo = (root, target) => {
    const c = []; let p = target, g = 0;
    while (p && p !== root && g++ < 16) { c.unshift(p); p = p.parent; }
    return p === root ? c : null;
  };
  ['L', 'R'].forEach((side) => {
    const th = side === 'L' ? tl : tr;
    const toeB = bestNamed(SHOE, 'toe' + side) || bestNamed(LEG, 'toe' + side);
    let ok = false;
    if (th && toeB) {
      const c = chainTo(th, toeB);
      if (c && c.length >= 2) {
        picked['toe' + side] = c[c.length - 1];
        picked['foot' + side] = c[c.length - 2];
        if (c.length >= 3) picked['shin' + side] = c[c.length - 3];
        else { const b = bestNamed(LEG, 'shin' + side); if (b) picked['shin' + side] = b; }
        ok = true;
      }
    }
    if (!ok) {
      ['shin', 'foot'].forEach((pre) => {
        const b = bestNamed(pre === 'shin' ? LEG : SHOE, pre + side);
        if (b) picked[pre + side] = b;
      });
      if (toeB) picked['toe' + side] = toeB;
    }
  });
  const neck = bestNamed(HEADM, 'Neck'), head = bestNamed(HEADM, 'Head');
  let linked = false;
  if (H && H.isBone) {
    picked['spine'] = H;
    if (neck) {
      const chain = [];
      let p = neck, guard = 0;
      while (p && p !== H && guard++ < 12) { chain.unshift(p); p = p.parent; }
      if (p === H && chain.length >= 2) {
        const links = chain.slice(0, -1);
        if (links[0]) picked['spine001'] = links[0];
        if (links[1]) picked['spine002'] = links[1];
        if (links[2]) picked['spine003'] = links[2];
        else if (links[1]) picked['spine003'] = links[1];
        picked['Neck'] = neck;
        linked = true;
      }
    }
  }
  if (!linked) {
    ['spine', 'spine001', 'spine002', 'spine003', 'Neck'].forEach((nm) => {
      if (!picked[nm]) { const b = bestNamed(null, nm); if (b) picked[nm] = b; }
    });
  }
  if (head) picked['Head'] = head;
  const chest = picked['spine002'] || picked['spine001'] || null;
  ['L', 'R'].forEach((side) => {
    const handB = bestNamed(/Hands/, 'hand' + side);
    let done = false;
    if (handB && chest) {
      const c = chainTo(chest, handB);
      if (c && c.length >= 3) {
        picked['hand' + side] = c[c.length - 1];
        picked['forearm' + side] = c[c.length - 2];
        picked['upper_arm' + side] = c[c.length - 3];
        if (c.length >= 4) picked['shoulder' + side] = c[c.length - 4];
        done = true;
      }
    }
    if (!done) {
      ['shoulder', 'upper_arm', 'forearm', 'hand'].forEach((pre) => {
        const b = bestNamed(null, pre + side);
        if (b) picked[pre + side] = b;
      });
    }
  });
  const taken = new Set();
  Object.keys(picked).forEach((nm) => {
    let target = 'Dx_' + nm, k = 0;
    while (taken.has(target)) target = 'Dx_' + nm + '_' + (++k);
    taken.add(target);
    picked[nm].name = target;
  });
  /* the file ships stacked duplicate rigs plus a 100x file-root scale over tiny bind
     locals: the mesh was bound to a stale duplicate rig (body stayed at spawn) while the
     mixer drove graph bones. Rebind every slot to live graph bones (driven ones to the
     animation, the rest to their static graph originals). The root scale is load-bearing
     for bind height, so it stays; the animation track scale is divided by it instead. */
  let rigG = 0, rigJ = 0, rigX = 0;
  meshes.forEach((m) => {
    if (!m.skeleton) return;
    const old = m.skeleton;
    const nb = old.bones.map((b) => {
      if (picked[b.name]) { rigG++; return picked[b.name]; }
      const g = model.getObjectByName(b.name);
      if (g && g.isBone === true) { rigJ++; return g; }
      rigX++; return b;
    });
    if (nb.some((b, i) => b !== old.bones[i])) {
      m.skeleton = new THREE.Skeleton(nb, old.boneInverses);
      if (old.dispose) old.dispose();
    }
  });
  window.__rigReport = { driven: rigG, staticGraph: rigJ, detachedUnknown: rigX };
  dbgLog('rig', 'driven=' + rigG, 'staticGraph=' + rigJ, 'detachedUnknown=' + rigX);
  return picked;
}
function pruneSkeleton(model) {
  const keep = new Set();
  model.traverse((o) => {
    if (o.isSkinnedMesh && o.skeleton && o.geometry.attributes.skinIndex) {
      const si = o.geometry.attributes.skinIndex;
      const arr = si.array;
      const bones = o.skeleton.bones;
      for (let i = 0; i < si.count; i++) {
        for (let j = 0; j < 4; j++) {
          const b = bones[arr[i * 4 + j]];
          let p = b;
          while (p && p !== model) { keep.add(p); p = p.parent; }
        }
      }
    }
  });
  if (!keep.size) return;
  const dead = [];
  model.traverse((o) => { if (o.isBone && !keep.has(o)) dead.push(o); });
  dead.forEach((b) => { if (b.parent) b.parent.remove(b); });
}
/* Mixamo retarget, TECH-style: rebase each key through the source parent's rest
   world rotation into the target parent's rest frame (raw quaternion copy is
   what inverted limbs on this foreign rig). Hips travel scaled per-clip. */
const BONE_MAP = {
  mixamorigHips: 'spine', mixamorigSpine: 'spine001', mixamorigSpine1: 'spine002', mixamorigSpine2: 'spine003',
  mixamorigNeck: 'Neck', mixamorigHead: 'Head',
  mixamorigLeftShoulder: 'shoulderL', mixamorigRightShoulder: 'shoulderR',
  mixamorigLeftArm: 'upper_armL', mixamorigRightArm: 'upper_armR',
  mixamorigLeftForeArm: 'forearmL', mixamorigRightForeArm: 'forearmR',
  mixamorigLeftHand: 'handL', mixamorigRightHand: 'handR',
  mixamorigLeftUpLeg: 'thighL', mixamorigRightUpLeg: 'thighR',
  mixamorigLeftLeg: 'shinL', mixamorigRightLeg: 'shinR',
  mixamorigLeftFoot: 'footL', mixamorigRightFoot: 'footR',
  mixamorigLeftToeBase: 'toeL', mixamorigRightToeBase: 'toeR',
};
function retargetClip(clip, asset, dynMap) {
  const out = [];
  const hipsTrack = (clip.tracks || []).find((t) => {
    const dot = t.name.indexOf('.');
    return t.name.slice(0, dot) === 'mixamorigHips' && t.name.slice(dot) === '.position';
  });
  const trackBaseY = hipsTrack && hipsTrack.values.length > 1 ? hipsTrack.values[1] : 0;
  const srcHips = asset.getObjectByName('mixamorigHips');
  const nodeBaseY = srcHips ? srcHips.position.y : 76;
  const s = bindHipsY / (trackBaseY || nodeBaseY || 76);
  /* the pelvis hangs under ancestors whose scale (100x file root over tiny bind locals)
     is load-bearing for bind height: divide the Mixamo-scale track values by that
     ancestor scale product so the written offsets land body-sized instead of 100x out */
  let asc = 1, ap = model.getObjectByName(dst);
  ap = ap ? ap.parent : null;
  while (ap && ap !== model) { asc *= ap.scale.y || 1; ap = ap.parent; }
  const hs = s / (asc || 1);
  const q = new THREE.Quaternion(), sq = new THREE.Quaternion(), dl = new THREE.Quaternion();
  clip.tracks.forEach((t) => {
    const dot = t.name.indexOf('.');
    const base = dot < 0 ? t.name : t.name.slice(0, dot);
    const suffix = dot < 0 ? '' : t.name.slice(dot);
    if (base === 'mixamorigHips' && suffix === '.position') {
      const dst = dynMap['mixamorigHips'];
      if (!dst || !restPMap[dst]) return;
      const v = t.values.slice();
      for (let i = 0; i < v.length; i++) v[i] *= hs;
      const rp = restPMap[dst];
      for (let i = 0; i < v.length; i += 3) { v[i] = rp.x; v[i + 2] = rp.z; }
      out.push(new THREE.VectorKeyframeTrack(dst + '.position', t.times, v));
      return;
    }
    if (suffix !== '.quaternion') return;
    const dst = dynMap[base];
    if (!dst || !restQMap[dst]) return;
    const srcNode = asset.getObjectByName(base);
    if (!srcNode) return;
    sq.copy(srcNode.quaternion);
    const rq = restQMap[dst];
    const vals = t.values.slice();
    for (let i = 0; i < vals.length; i += 4) {
      q.set(vals[i], vals[i + 1], vals[i + 2], vals[i + 3]);
      dl.copy(sq).invert().multiply(q);
      q.copy(rq).multiply(dl);
      vals[i] = q.x; vals[i + 1] = q.y; vals[i + 2] = q.z; vals[i + 3] = q.w;
    }
    out.push(new THREE.QuaternionKeyframeTrack(dst + '.quaternion', t.times, vals));
  });
  return new THREE.AnimationClip(clip.name, clip.duration, out);
}
function fadeTo(action, dur) {
  if (!animMixer || activeAnim === action) return;
  dbgLog('fade', (activeAnim && activeAnim.getClip ? activeAnim.getClip().name : 'none'), '->', action.getClip().name);
  action.reset();
  action.setEffectiveTimeScale(1);
  action.setEffectiveWeight(1);
  action.fadeIn(dur);
  action.play();
  if (activeAnim) activeAnim.fadeOut(dur);
  activeAnim = action;
}
/* click ripple markers */
const ripples = [];
for (let i = 0; i < 3; i++) {
  const r = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55, 32), new THREE.MeshBasicMaterial({ color: 0xb9a8ff, transparent: true, opacity: 0, side: THREE.DoubleSide }));
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
function fitRadius() { return innerWidth / innerHeight < 0.85 ? 37 : 26; }
const _follow = new THREE.Vector3();
const pinch = { d0: 0, r0: 27, mx: 0, my: 0 };
const pointers = new Map();
let panButton = false, followMode = true;
let theta = CAM_HOME.theta, phi = CAM_HOME.phi, radius = fitRadius(), lastOrbit = -10;
let gTheta = theta, gPhi = phi, gRadius = radius;
let gTarget = CAM_TARGET.clone();
gTarget.x -= 1.5;   /* frame the city right of the copy so text and towers don't stack */
let lastTowerClick = { url: '', t: 0 };
let downPos = null, dragging = false;
const keys = {};
addEventListener('keydown', (e) => {
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code) && scrollY < innerHeight * 0.7) e.preventDefault();
  if (e.code === 'KeyE' && typeof activeDoor !== 'undefined' && activeDoor) { window.open(activeDoor.def.url, '_blank', 'noopener'); }
  if (e.code === 'KeyR') resetView();
  if (e.code === 'KeyF') { followMode = !followMode; syncFollowBtn(); }
  if (e.code === 'Equal') gRadius = clamp(gRadius / 1.2, 14, 60);
  if (e.code === 'Minus') gRadius = clamp(gRadius * 1.2, 14, 60);
  keys[e.code] = true;
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
function setNDC(e) {
  const r = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}
canvas.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const p = [...pointers.values()];
    pinch.d0 = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    pinch.r0 = gRadius;
    pinch.mx = (p[0].x + p[1].x) / 2; pinch.my = (p[0].y + p[1].y) / 2;
    dragging = false; downPos = null;
    return;
  }
  downPos = { x: e.clientX, y: e.clientY };
  dragging = false;
  panButton = e.button === 1 || e.button === 2 || e.shiftKey;
  if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (_) {} }
});
canvas.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const p = [...pointers.values()];
    const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    if (pinch.d0 > 0) gRadius = clamp(pinch.r0 * pinch.d0 / Math.max(20, d), 14, 60);
    const mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
    panBy(mx - pinch.mx, my - pinch.my);
    pinch.mx = mx; pinch.my = my;
    lastOrbit = perfNow();
    return;
  }
  if (downPos) {
    const dx = e.clientX - downPos.x, dy = e.clientY - downPos.y;
    if (!dragging && Math.hypot(dx, dy) > 6) dragging = true;
    if (dragging) {
      if (panButton) {
        panBy(e.clientX - downPos.x, e.clientY - downPos.y);
        downPos = { x: e.clientX, y: e.clientY };
      } else {
        gTheta += dx * 0.005;
        gPhi = Math.min(1.35, Math.max(0.5, gPhi - dy * 0.003));
        lastOrbit = perfNow();
        downPos = { x: e.clientX, y: e.clientY };
      }
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
    t.label.scale.set(on ? t.label.userData.base.x * 1.18 : t.label.userData.base.x, on ? t.label.userData.base.y * 1.18 : t.label.userData.base.y, 1);
  });
});
canvas.addEventListener('pointerup', (e) => {
  pointers.delete(e.pointerId);
  if (pointers.size > 0) return;
  const wasDrag = dragging;
  downPos = null; dragging = false; panButton = false;
  if (wasDrag || e.button !== 0) return;
  setNDC(e);
  ray.setFromCamera(ndc, camera);
  const hitB = ray.intersectObjects(hitMeshes, false)[0];
  if (hitB) {
    lastOrbit = perfNow();
    const url = hitB.object.userData.project.url;
    const t = perfNow();
    if (lastTowerClick.url === url && t - lastTowerClick.t < 0.55) {
      lastTowerClick = { url: '', t: 0 };
      resetView();
    } else {
      lastTowerClick = { url, t };
      window.open(url, '_blank', 'noopener');
    }
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
canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); downPos = null; dragging = false; panButton = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => {
  if (!matchMedia('(pointer:fine)').matches) return;
  if (!e.ctrlKey && !e.metaKey) return;   /* plain wheel scrolls the page; ctrl+wheel zooms */
  e.preventDefault();
  let dy = e.deltaY;
  if (e.deltaMode === 1) dy *= 16;
  gRadius = clamp(gRadius * (1 + dy * 0.001), 14, 60);
  lastOrbit = perfNow();
}, { passive: false });
function panBy(dx, dy) {
  const s = radius * 0.0016;
  const rx = Math.cos(theta), rz = -Math.sin(theta);
  const ux = -Math.sin(theta), uz = -Math.cos(theta);
  gTarget.x = clamp(gTarget.x - (dx * rx + dy * ux) * s, CITY.x - 18, CITY.x + 18);
  gTarget.z = clamp(gTarget.z - (dx * rz + dy * uz) * s, CITY.z - 18, CITY.z + 18);
  lastOrbit = perfNow();
}
function resetView() {
  gTheta = CAM_HOME.theta; gPhi = CAM_HOME.phi; gRadius = fitRadius();
  gTarget.set(CITY.x - 1.5, 3.2, CITY.z);
  followMode = false;
  syncFollowBtn();
  lastOrbit = perfNow();
}
function syncFollowBtn() {
  document.querySelectorAll('[data-cam="follow"]').forEach(b => b.classList.toggle('on', followMode));
}
document.querySelectorAll('[data-cam]').forEach(btn => {
  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const a = btn.getAttribute('data-cam');
    lastOrbit = perfNow();
    if (a === 'zin') gRadius = clamp(gRadius / 1.25, 14, 60);
    else if (a === 'zout') gRadius = clamp(gRadius * 1.25, 14, 60);
    else if (a === 'reset') resetView();
    else if (a === 'follow') { followMode = !followMode; syncFollowBtn(); }
  });
  syncFollowBtn();
});
function perfNow() { return performance.now() / 1000; }
let scrollF = 0;
addEventListener('scroll', () => { scrollF = Math.min(scrollY / innerHeight, 1); }, { passive: true });

/* ---------- animation ---------- */
const clock = new THREE.Clock();
let frames = 0;
function step(dt, t) {
  const at = reduced ? 0.6 : t;   /* frozen ambience when the user prefers reduced motion */
  let vx = 0, vz = 0;
  const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const strafe = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  if (fwd || strafe) {
    const fx = -Math.sin(theta), fz = -Math.cos(theta);   /* away from camera */
    const rx = Math.cos(theta), rz = -Math.sin(theta);     /* camera right */
    vx = fx * fwd + rx * strafe;
    vz = fz * fwd + rz * strafe;
    walker.target = null;
  } else {
    if (!walker.target && !reduced) {
      const wp = walker.tour[walker.tourIdx % walker.tour.length];
      walker.target = { x: wp[0], z: wp[1], tour: true };
    }
    if (walker.target) {
      const dx = walker.target.x - char.position.x, dz = walker.target.z - char.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.4) {
        if (walker.target.tour) walker.tourIdx++;
        walker.target = null;
      } else {
        vx = dx / d; vz = dz / d;
      }
    }
  }
  const moving = (vx !== 0 || vz !== 0);
  walker.moving = moving;
  if (moving) {
    char.position.x += vx * 4.5 * dt;
    char.position.z += vz * 4.5 * dt;
    const fixed = collide(char.position.x, char.position.z);
    char.position.x = fixed[0]; char.position.z = fixed[1];
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
  if (keys.Space && walker.y === 0) walker.vy = 5;
  if (walker.y > 0 || walker.vy !== 0) {
    walker.vy -= 13 * dt;
    walker.y += walker.vy * dt;
    if (walker.y <= 0) { walker.y = 0; walker.vy = 0; }
  }
  const sw = moving ? Math.sin(walker.phase) * 0.6 : 0;
  if (primitiveMode) {
    legL.rotation.x = sw; legR.rotation.x = -sw;
    armL.rotation.x = -sw * 0.8; armR.rotation.x = sw * 0.8;
  }
  const hasAnim = !!(animMixer && activeAnim);
  const bobY = walker.y + (!hasAnim && moving ? Math.abs(Math.sin(walker.phase)) * 0.07 : 0);
  bodyG.position.y = bobY;
  bodyG.rotation.x = moving ? 0.09 : 0;
  if (modelObj) { modelObj.position.y = modelObj.userData.baseY + bobY; modelObj.rotation.x = !hasAnim && moving ? 0.09 : 0; }
  if (animMixer) {
    if (moving && runAction) fadeTo(runAction, 0.25);
    else if (idleAction && !reduced) fadeTo(idleAction, 0.3);
  }
  marker.rotation.y += dt * 2;
  marker.position.y = 2.2 + Math.sin(t * 3) * 0.15;
  towers.forEach(t => {
    t.beacon.material.opacity = 0.55 + 0.4 * Math.sin(at * 2.4 + t.phase);
    if (t.roofSpin && !reduced) t.roofSpin.rotation.z += dt * 0.8;
  });
  doors.forEach(d => {
    d.glow.material.opacity = reduced ? 0.3 : 0.28 + 0.14 * Math.sin(at * 3 + d.pos.x);
  });
  let near = null, nd = 4.2;
  doors.forEach(d => {
    const dist = Math.hypot(char.position.x - d.pos.x, char.position.z - d.pos.z);
    if (dist < nd) { nd = dist; near = d; }
  });
  if (near !== activeDoor) {
    activeDoor = near;
    if (near) {
      doorPrompt.innerHTML = 'Enter <b>' + near.def.name + '</b>? &nbsp;press <b>E</b> or click';
      doorPrompt.hidden = false;
    } else {
      doorPrompt.hidden = true;
    }
  }
  ripples.forEach(r => {
    if (!r.mesh.visible) return;
    r.t += dt * 1.8;
    if (r.t >= 1) { r.mesh.visible = false; return; }
    const s = 1 + r.t * 3;
    r.mesh.scale.set(s, s, 1);
    r.mesh.material.opacity = 0.8 * (1 - r.t);
  });
  scene.userData.stars.rotation.y = at * 0.008;
}
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  frames++;
  if (frames % 30 === 0) canvas.dataset.frames = String(frames);
  const now = perfNow();
  if (now - lastOrbit > 8 && !reduced && !followMode) gTheta += dt * 0.05;
  const k = Math.min(1, dt * 7);
  theta += (gTheta - theta) * k;
  phi += (gPhi - phi) * k;
  radius += (gRadius - radius) * k;
  if (followMode) {
    _follow.set(char.position.x, char.position.y + 3.2, char.position.z);
    gTarget.lerp(_follow, Math.min(1, dt * 4));
  }
  CAM_TARGET.lerp(gTarget, Math.min(1, dt * 8));
  camera.position.set(
    CAM_TARGET.x + radius * Math.sin(phi) * Math.sin(theta),
    CAM_TARGET.y + radius * Math.cos(phi),
    CAM_TARGET.z + radius * Math.sin(phi) * Math.cos(theta)
  );
  camera.lookAt(CAM_TARGET);
  canvas.style.opacity = String(1 - scrollF * 0.85);
  step(dt, t);
  if (animMixer) animMixer.update(dt);
  if (DBG && modelObj && frames % 15 === 0) {
    const hb = modelObj.getObjectByName('Dx_spine');
    const hw = hb ? hb.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
    const sep = Math.hypot(hw.x - char.position.x, hw.z - char.position.z);
    const line = 'f=' + frames + ' act=' + (activeAnim && activeAnim.getClip ? activeAnim.getClip().name : 'none') +
      ' moving=' + (walker.moving ? 1 : 0) +
      '\nchar=(' + char.position.x.toFixed(1) + ',' + char.position.z.toFixed(1) + ')' +
      ' hipsW=(' + hw.x.toFixed(1) + ',' + hw.y.toFixed(1) + ',' + hw.z.toFixed(1) + ')' +
      '\nsepXZ=' + sep.toFixed(1) + ' (body-vs-marker gap; must stay < 1)';
    let extra = '';
    if (hb) {
      const meta = modelObj.getObjectByName('metarig');
      const mw = meta ? meta.getWorldPosition(new THREE.Vector3()) : null;
      const act = activeAnim && activeAnim.getClip ? activeAnim.getClip() : null;
      let hip0 = 'n/a';
      if (act && act.tracks) { const t = act.tracks.find((x) => x.name === 'Dx_spine.position'); if (t) hip0 = t.values[0].toFixed(0) + ',' + t.values[1].toFixed(0) + ',' + t.values[2].toFixed(0); }
      extra = '\nDxpar=' + (hb.parent ? hb.parent.name : '?') + ' metarig=' + (meta ? ('W=(' + mw.x.toFixed(1) + ',' + mw.y.toFixed(1) + ',' + mw.z.toFixed(1) + ')') : 'MISSING-from-graph') + ' hipTrack0=(' + hip0 + ')';
      const hl = hb.position, hs = hb.scale;
      const ps = hb.parent ? hb.parent.scale : { x: 0, y: 0, z: 0 };
      extra += '\nHloc=(' + hl.x.toFixed(1) + ',' + hl.y.toFixed(1) + ',' + hl.z.toFixed(1) + ') Hscale=(' + hs.x.toFixed(2) + ',' + hs.y.toFixed(2) + ',' + hs.z.toFixed(2) + ') parScale=(' + ps.x.toFixed(2) + ',' + ps.y.toFixed(2) + ',' + ps.z.toFixed(2) + ') modelScale=' + modelObj.scale.x.toFixed(4) + ' charScale=' + char.scale.x.toFixed(2);
      const rr = window.__rigReport;
      if (rr) extra += '\nrig=driven:' + rr.driven + ' staticGraph:' + rr.staticGraph + ' detachedUnknown:' + rr.detachedUnknown;
      const cs = window.__clipState;
      if (cs) extra += ' clips=idle:' + (cs.idle || '?') + '/run:' + (cs.run || '?');
    }
    if (dbgDiv) dbgDiv.textContent = line + extra;
    if (frames % 150 === 0) dbgLog((line + extra).replace(/\n/g, ' '));
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  radius = gRadius = fitRadius();
});
