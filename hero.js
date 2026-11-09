/* ===== HERO 3D SCENE — particles + ember core + orbit rings ===== */
import * as THREE from 'three';

const canvas = document.getElementById('scene');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches && !location.search.includes('motion=1');
canvas.dataset.rm = String(reduced);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  canvas.dataset.ctx = 'ok';
} catch (e) {
  canvas.dataset.ctx = 'fail:' + String(e && e.message || e).slice(0, 80);
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x06080d, 0.016);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
camera.position.set(0, 0, 26);

/* soft round sprite so points render as glowing dots, never squares */
const dotTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
})();

/* --- particle field (ember + violet embers) --- */
function makeParticles(count, spread, size, colors) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread[0];
    pos[i * 3 + 1] = (Math.random() - 0.5) * spread[1];
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread[2];
    c.set(colors[(Math.random() * colors.length) | 0]);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size, vertexColors: true, map: dotTex, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  return new THREE.Points(geo, mat);
}
const stars = makeParticles(1100, [120, 80, 70], 0.09, ['#ff9a5c', '#7c5cff', '#eef2f6']);
const dust = makeParticles(260, [60, 40, 50], 0.13, ['#ff6b35', '#ff9a5c']);
scene.add(stars, dust);

/* --- hero core: wireframe icosahedron + inner glow --- */
const core = new THREE.Group();
const shell = new THREE.Mesh(
  new THREE.IcosahedronGeometry(4.4, 1),
  new THREE.MeshBasicMaterial({ color: 0xff6b35, wireframe: true, transparent: true, opacity: 0.5 })
);
const inner = new THREE.Mesh(
  new THREE.IcosahedronGeometry(2.5, 0),
  new THREE.MeshBasicMaterial({ color: 0x7c5cff, wireframe: true, transparent: true, opacity: 0.55 })
);
const glowBall = new THREE.Mesh(
  new THREE.SphereGeometry(1.4, 24, 24),
  new THREE.MeshBasicMaterial({ color: 0xff6b35, transparent: true, opacity: 0.14 })
);
core.add(shell, inner, glowBall);
core.position.set(9.5, 0.5, -4);
scene.add(core);

/* --- orbit rings --- */
const rings = [];
[[6.4, 0.5, 0xff9a5c], [7.6, -0.35, 0x7c5cff]].forEach(([r, tilt, color]) => {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(r, 0.025, 8, 140),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65 })
  );
  ring.rotation.x = Math.PI / 2 + tilt;
  core.add(ring);
  rings.push(ring);
});

/* --- drifting satellite shapes --- */
const sats = [];
const palette = [0xff6b35, 0x7c5cff, 0xff9a5c, 0x00c8b4];
const geos = [
  new THREE.OctahedronGeometry(0.9, 0),
  new THREE.TorusKnotGeometry(0.55, 0.18, 70, 10),
  new THREE.TetrahedronGeometry(1.0, 0),
  new THREE.TorusGeometry(0.8, 0.22, 12, 30),
];
for (let i = 0; i < 10; i++) {
  const m = new THREE.Mesh(
    geos[i % geos.length],
    new THREE.MeshBasicMaterial({ color: palette[i % palette.length], wireframe: true, transparent: true, opacity: 0.35 })
  );
  m.position.set(6 + Math.random() * 26, (Math.random() - 0.5) * 28, -14 + (Math.random() - 0.5) * 16);
  m.userData = { s: 0.2 + Math.random() * 0.5, p: Math.random() * Math.PI * 2, y: m.position.y, a: 1 + Math.random() * 2 };
  scene.add(m);
  sats.push(m);
}

/* --- interaction: pointer parallax + click pulse --- */
const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', e => {
  ptr.tx = (e.clientX / innerWidth - 0.5) * 2;
  ptr.ty = (e.clientY / innerHeight - 0.5) * 2;
}, { passive: true });
let pulse = 0;
addEventListener('pointerdown', () => { pulse = 1; });

/* scroll: drift camera + fade hero canvas */
let scrollF = 0;
addEventListener('scroll', () => {
  scrollF = Math.min(scrollY / innerHeight, 1);
}, { passive: true });

const clock = new THREE.Clock();
let frames = 0;
function frame() {
  const t = clock.getElapsedTime();
  frames++;
  if (frames % 30 === 0) canvas.dataset.frames = String(frames);
  ptr.x += (ptr.tx - ptr.x) * 0.045;
  ptr.y += (ptr.ty - ptr.y) * 0.045;
  pulse = Math.max(0, pulse - 0.02);

  stars.rotation.y = t * 0.012 + ptr.x * 0.05;
  dust.rotation.y = -t * 0.02 + ptr.x * 0.08;

  core.rotation.y = t * 0.12 + ptr.x * 0.3;
  core.rotation.x = ptr.y * 0.25;
  const s = 1 + pulse * 0.12 + Math.sin(t * 1.4) * 0.02;
  core.scale.set(s, s, s);
  inner.rotation.y = -t * 0.25;
  inner.rotation.z = t * 0.18;
  rings[0].rotation.z = t * 0.2;
  rings[1].rotation.z = -t * 0.14;

  sats.forEach(m => {
    m.rotation.x += 0.004 * m.userData.s * 3;
    m.rotation.y += 0.006 * m.userData.s * 3;
    m.position.y = m.userData.y + Math.sin(t * 0.5 + m.userData.p) * m.userData.a;
  });

  camera.position.x += (ptr.x * 2.2 - camera.position.x) * 0.03;
  camera.position.y += (-ptr.y * 1.4 - scrollF * 6 - camera.position.y) * 0.04;
  camera.lookAt(0, 0, 0);
  canvas.style.opacity = String(1 - scrollF * 0.85);

  renderer.render(scene, camera);
  if (!reduced) requestAnimationFrame(frame);
}
if (reduced) {
  canvas.style.display = 'none'; /* reduced-motion users get the CSS nebula hero */
} else {
  frame();
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
