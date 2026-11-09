/* ===== THREE.JS BACKGROUND SCENE ===== */
const canvas = document.getElementById('bg-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 35;

/* stars */
const starCount = 2000;
const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(starCount * 3);
const starSizes = new Float32Array(starCount);
for (let i = 0; i < starCount; i++) {
  starPos[i * 3] = (Math.random() - 0.5) * 160;
  starPos[i * 3 + 1] = (Math.random() - 0.5) * 120;
  starPos[i * 3 + 2] = (Math.random() - 0.5) * 100;
  starSizes[i] = Math.random() * 1.4;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

const starMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */`
    attribute float size;
    uniform float uTime;
    varying float vAlpha;
    void main() {
      vAlpha = 0.4 + 0.6 * sin(uTime * 0.8 + position.x * 0.4 + position.y * 0.3);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (220.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */`
    varying float vAlpha;
    void main() {
      float r = distance(gl_PointCoord, vec2(0.5));
      if (r > 0.5) discard;
      float a = smoothstep(0.5, 0.05, r) * vAlpha;
      gl_FragColor = vec4(0.88, 0.86, 0.85, a);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

/* floating geometry */
const shapes = [];
const geoTypes = [
  new THREE.IcosahedronGeometry(1.0, 0),
  new THREE.TorusGeometry(0.9, 0.25, 16, 40),
  new THREE.OctahedronGeometry(0.85, 0),
  new THREE.TorusKnotGeometry(0.7, 0.22, 80, 14),
  new THREE.TetrahedronGeometry(0.9, 0),
];

const palette = [
  new THREE.Color('#ff5c8a'),
  new THREE.Color('#f5a623'),
  new THREE.Color('#7c5cff'),
  new THREE.Color('#00c8b4'),
  new THREE.Color('#ff6b9d'),
];

for (let i = 0; i < 14; i++) {
  const geo = geoTypes[i % geoTypes.length];
  const mat = new THREE.MeshBasicMaterial({
    color: palette[i % palette.length],
    wireframe: true,
    transparent: true,
    opacity: 0.22,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(
    (Math.random() - 0.5) * 80,
    (Math.random() - 0.5) * 50,
    (Math.random() - 0.5) * 40,
  );
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
  const s = 0.8 + Math.random() * 1.8;
  mesh.scale.set(s, s, s);
  mesh.userData = {
    speed: 0.15 + Math.random() * 0.45,
    axis: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(),
    baseY: mesh.position.y,
    amp: 1.2 + Math.random() * 2.2,
    phase: Math.random() * Math.PI * 2,
  };
  shapes.push(mesh);
  scene.add(mesh);
}

/* soft glow spheres */
for (let i = 0; i < 3; i++) {
  const geo = new THREE.SphereGeometry(2.2 + i * 0.6, 22, 22);
  const mat = new THREE.MeshBasicMaterial({
    color: palette[i],
    transparent: true,
    opacity: 0.04,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(-22 + i * 22, -6 + i * 8, -18);
  m.userData = { floatSpeed: 0.3 + i * 0.15, baseY: m.position.y, amp: 3 + i * 1.5, phase: i * 1.2 };
  shapes.push(m);
  scene.add(m);
}

/* mouse parallax */
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('mousemove', (e) => {
  mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
  mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
});

/* animation loop */
const clock = new THREE.Clock();
function render() {
  const t = clock.getElapsedTime();
  starMat.uniforms.uTime.value = t;

  mouse.x += (mouse.tx - mouse.x) * 0.04;
  mouse.y += (mouse.ty - mouse.y) * 0.04;
  stars.rotation.y = t * 0.015 + mouse.x * 0.04;
  stars.rotation.x = mouse.y * 0.02;

  shapes.forEach((m) => {
    m.rotateOnWorldAxis(m.userData.axis, m.userData.speed * 0.012);
    if (m.userData.floatSpeed) {
      m.position.y = m.userData.baseY + Math.sin(t * m.userData.floatSpeed + m.userData.phase) * m.userData.amp;
    } else {
      m.position.y = m.userData.baseY + Math.sin(t * 0.4 + m.userData.phase) * m.userData.amp;
    }
  });

  camera.position.x += (mouse.x * 1.6 - camera.position.x) * 0.02;
  camera.position.y += (-mouse.y * 1.1 - camera.position.y) * 0.02;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ===== UI INTERACTIONS ===== */
const navbar = document.getElementById('navbar');
const menuBtn = document.getElementById('menu-btn');
const navLinks = document.getElementById('nav-links');
menuBtn?.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  menuBtn.textContent = navLinks.classList.contains('open') ? '✕' : '☰';
});

/* smooth scroll + active link */
const allLinks = document.querySelectorAll('#nav-links a');
const sections = Array.from(allLinks).map(a => document.querySelector(a.getAttribute('href')));

function setActive() {
  const scrollY = window.scrollY + 120;
  sections.forEach((sec, i) => {
    if (!sec) return;
    const top = sec.offsetTop;
    const h = sec.offsetHeight;
    allLinks[i].classList.toggle('active', scrollY >= top && scrollY < top + h);
  });
}
window.addEventListener('scroll', setActive, { passive: true });
allLinks.forEach(a => a.addEventListener('click', () => {
  if (navLinks.classList.contains('open')) {
    navLinks.classList.remove('open');
    menuBtn.textContent = '☰';
  }
}));

/* intersection observer fade-in */
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('section').forEach(s => {
  s.style.opacity = '0';
  s.style.transform = 'translateY(24px)';
  s.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
  io.observe(s);
});
document.getElementById('year').textContent = new Date().getFullYear();
