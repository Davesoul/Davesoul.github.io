/* ===== UI: reveal, typing, tilt, counters, GitHub grid ===== */
document.getElementById('year').textContent = new Date().getFullYear();

/* cursor glow */
const glow = document.getElementById('cursorGlow');
let gx = innerWidth / 2, gy = innerHeight * 0.3, tx = gx, ty = gy;
addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; }, { passive: true });
(function glowLoop() {
  gx += (tx - gx) * 0.08; gy += (ty - gy) * 0.08;
  glow.style.left = gx + 'px'; glow.style.top = gy + 'px';
  requestAnimationFrame(glowLoop);
})();

/* active nav link */
const navAs = [...document.querySelectorAll('.nav-links a')];
const secs = navAs.map(a => document.querySelector(a.getAttribute('href')));
addEventListener('scroll', () => {
  const y = scrollY + 140;
  secs.forEach((s, i) => {
    if (!s) return;
    navAs[i].classList.toggle('active', y >= s.offsetTop && y < s.offsetTop + s.offsetHeight);
  });
}, { passive: true });

/* reveal on scroll */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/* typed roles */
const roles = ['full-stack platforms.', 'AI assistants & agents.', 'Flutter experiences.', 'APIs & data systems.', '3D web scenes.'];
const typedEl = document.getElementById('typed');
(async function typeLoop() {
  let ri = 0;
  while (true) {
    const word = roles[ri % roles.length]; ri++;
    for (let i = 1; i <= word.length; i++) { typedEl.textContent = word.slice(0, i); await wait(38); }
    await wait(1700);
    for (let i = word.length; i >= 0; i--) { typedEl.textContent = word.slice(0, i); await wait(18); }
    await wait(350);
  }
})();
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

/* seamless marquee: duplicate content once */
const track = document.getElementById('marqueeTrack');
track.innerHTML += track.innerHTML;

/* animated counters */
const cio = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  cio.unobserve(e.target);
  const el = e.target, target = +el.dataset.count, t0 = performance.now();
  (function tick(t) {
    const p = Math.min((t - t0) / 1200, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}), { threshold: 0.5 });
document.querySelectorAll('[data-count]').forEach(el => cio.observe(el));

/* card tilt */
if (matchMedia('(pointer:fine)').matches) {
  document.querySelectorAll('[data-tilt]').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) translateY(-3px)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
}

/* ===== live GitHub repos, with baked-in fallback ===== */
const FALLBACK = [
  { name: 'AI-Corporate-Intelligence-Hub', desc: 'AI-powered corporate assistant built with FastAPI and MCP.', lang: 'Python', stars: 0, url: 'https://github.com/Davesoul/AI-Corporate-Intelligence-Hub' },
  { name: 'free-tts', desc: 'free text-to-speech engine.', lang: 'Python', stars: 0, url: 'https://github.com/Davesoul/free-tts' },
  { name: 'Flutter-showcase', desc: 'Pure-frontend component library, live on GitHub Pages.', lang: 'Dart', stars: 0, url: 'https://github.com/Davesoul/Flutter-showcase' },
  { name: 'Orbita', desc: 'Solar system 3D simulation.', lang: 'JavaScript', stars: 0, url: 'https://github.com/Davesoul/Orbita' },
  { name: 'What-s-On', desc: 'AI news companion with TTS.', lang: 'Python', stars: 0, url: 'https://github.com/Davesoul/What-s-On' },
  { name: 'loculus', desc: '', lang: 'PHP', stars: 0, url: 'https://github.com/Davesoul/loculus' },
  { name: 'currency-corner-desk', desc: '', lang: 'TypeScript', stars: 0, url: 'https://github.com/Davesoul/currency-corner-desk' },
  { name: 'odin-recipes', desc: 'First Odin project.', lang: 'HTML', stars: 0, url: 'https://github.com/Davesoul/odin-recipes' },
];
const LANG_COLORS = { Python: '#3572A5', Dart: '#00B4AB', TypeScript: '#3178c6', JavaScript: '#f1e05a', PHP: '#4F5D95', HTML: '#e34c26' };

function repoCard(r) {
  const color = LANG_COLORS[r.lang] || '#8b8698';
  const desc = (r.desc || 'Open-source build by @Davesoul.').slice(0, 90);
  return `<a class="repo" href="${r.url}" target="_blank" rel="noopener">
    <h4>${r.name}</h4><p>${desc}</p>
    <div class="repo-meta">
      ${r.lang ? `<span><i class="dot" style="background:${color}"></i>${r.lang}</span>` : ''}
      <span>★ ${r.stars}</span>
    </div></a>`;
}

/* curated descriptions + exclusions: beginner/empty repos stay out of the spotlight */
const DESC_OVERRIDE = {
  'Komaverse': 'Browser anime studio: scan manga, detect panels, animate, export MP4.',
  'Flutter-showcase': '10-section Flutter component library, live on GitHub Pages.',
  'What-s-On': 'AI news companion with real-time updates and TTS.',
  'loculus': 'PHP web project.',
  'currency-corner-desk': 'Currency exchange desk app (TypeScript).',
};
const EXCLUDE = new Set(['God-s-Eye', 'git_test', 'odin-recipes']);

async function loadRepos() {
  const grid = document.getElementById('repoGrid');
  try {
    const res = await fetch('https://api.github.com/users/Davesoul/repos?per_page=100&sort=updated');
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const repos = data
      .filter(r => !r.fork && !EXCLUDE.has(r.name))
      .sort((a, b) => b.stargazers_count - a.stargazers_count || new Date(b.pushed_at) - new Date(a.pushed_at))
      .slice(0, 9)
      .map(r => ({ name: r.name, desc: DESC_OVERRIDE[r.name] || r.description, lang: r.language, stars: r.stargazers_count, url: r.html_url }));
    grid.innerHTML = repos.map(repoCard).join('');
  } catch {
    grid.innerHTML = FALLBACK.map(repoCard).join('');
    toast('GitHub API unreachable — showing cached list');
  }
}

function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

loadRepos();
