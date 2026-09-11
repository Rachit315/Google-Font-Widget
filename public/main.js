/* Stack Sans card — Motion (motion.dev) + a canvas halftone matrix.
   Motion rules applied throughout come from animations.dev:
   strong custom curves, ease-out on entrances, GPU-only properties,
   reduced-motion respected, hover motion gated to fine pointers. */

const { animate, stagger } = window.Motion;

/* Strong ease-out. The built-in easings are too weak to feel intentional. */
const EASE_OUT = [0.23, 1, 0.32, 1];

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ------------------------------------------------------------------ *
 * 1. The halftone matrix
 *    A grid of square dots. A wave of orange rises from the bottom;
 *    dither (a fixed per-cell noise value compared against the wave's
 *    local strength) produces the scattered edge instead of a hard line.
 * ------------------------------------------------------------------ */

const canvas = document.getElementById('matrix');
const panel = document.getElementById('panel');
const ctx = canvas.getContext('2d', { alpha: false });

const GRID = {
  columns: 44,     // fixed column count, so the grain matches at any card size
  dotRatio: 0.6,   // dot size relative to the cell
  bg: '#0a0a0a',
  off: '#242424',
  on: '#ff6b00',
};

let cols = 0, rows = 0, cellX = 0, cellY = 0, dot = 0;
let noise = new Float32Array(0);   // stable dither value per cell
let sparkle = new Float32Array(0); // stray-dot phase per cell
let jitter = new Float32Array(0);  // per-column height offset, breaks the sine regularity
let state = new Uint8Array(0);

function layout() {
  const rect = panel.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  cols = GRID.columns;
  cellX = rect.width / cols;
  rows = Math.max(12, Math.round(rect.height / cellX));
  cellY = rect.height / rows;
  dot = Math.max(2, Math.round(Math.min(cellX, cellY) * GRID.dotRatio));

  const n = cols * rows;
  if (noise.length !== n) {
    noise = new Float32Array(n);
    sparkle = new Float32Array(n);
    state = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      noise[i] = Math.random();
      sparkle[i] = Math.random();
    }
  }
  if (jitter.length !== cols) {
    jitter = new Float32Array(cols);
    for (let x = 0; x < cols; x++) jitter[x] = (Math.random() - 0.5) * 3;
  }
  return true;
}

/* Cursor influence: a soft bump in the wave under the pointer.
   Driven by a spring so it carries momentum instead of snapping to the
   mouse — a value tied directly to pointer position reads as artificial. */
const bump = { value: 0, target: 0, velocity: 0, col: -1 };

/* Intro: the wave rises from below the floor to its resting height. */
let reveal = reduceMotion.matches ? 1 : 0;

function waveHeight(x, t) {
  const rest =
    rows * 0.16 +
    jitter[x] +
    2.4 * Math.sin(x * 0.3 + t * 1.05) +
    1.8 * Math.sin(x * 0.11 - t * 0.72) +
    2.5 * Math.sin(x * 0.047 + t * 0.33) +
    0.9 * Math.sin(x * 0.63 - t * 1.4);

  let h = -9 + (rest + 9) * reveal;

  if (bump.value > 0.01 && bump.col >= 0) {
    const d = x - bump.col;
    h += bump.value * Math.exp(-(d * d) / 42);
  }
  return h;
}

const SOFT = 5.4; // rows over which the edge dissolves into dither

function render(t) {
  const w = cols * cellX;
  const h = rows * cellY;

  ctx.fillStyle = GRID.bg;
  ctx.fillRect(0, 0, w, h);

  for (let x = 0; x < cols; x++) {
    const level = waveHeight(x, t);
    for (let y = 0; y < rows; y++) {
      const fromBottom = rows - 1 - y;
      const i = y * cols + x;
      let p = 0.5 + (level - fromBottom) / SOFT;

      // rare stray dots drifting high above the wave
      if (p < 1 && fromBottom < level + 16) {
        const tw = 0.5 + 0.5 * Math.sin(t * 0.9 + sparkle[i] * 62.8);
        if (sparkle[i] > 0.993) p += 0.75 * tw * reveal;
      }
      state[i] = noise[i] < p ? 1 : 0;
    }
  }

  // Two passes, so fillStyle is set twice per frame rather than per dot.
  const half = dot / 2;
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = pass === 0 ? GRID.off : GRID.on;
    for (let y = 0; y < rows; y++) {
      const cy = Math.round(y * cellY + cellY / 2 - half);
      for (let x = 0; x < cols; x++) {
        if (state[y * cols + x] !== pass) continue;
        ctx.fillRect(Math.round(x * cellX + cellX / 2 - half), cy, dot, dot);
      }
    }
  }
}

/* Ambient motion runs at 24fps: the dots are binary, so a filmic cadence
   reads as intentional halftone refresh and costs a third of the frames. */
const FRAME = 1000 / 24;
let raf = 0, last = 0, clock = 0, running = false;

function loop(now) {
  raf = requestAnimationFrame(loop);
  const dt = now - last;
  if (dt < FRAME) return;
  last = now;

  clock += Math.min(dt, 120) / 1000;

  /* Spring towards the cursor bump. The integration step is capped hard at
     60ms: after a long frame gap (a backgrounded tab, a stalled main thread)
     a larger step makes `damping * step` exceed 2 and the spring diverges
     instead of settling — which floods the whole panel with orange. */
  const step = Math.min(dt, 60) / 1000;
  const stiffness = 120, damping = 18;
  const accel = stiffness * (bump.target - bump.value) - damping * bump.velocity;
  bump.velocity += accel * step;
  bump.value = Math.max(0, Math.min(bump.value + bump.velocity * step, 9));

  render(clock);
}

function start() {
  if (running || reduceMotion.matches) return;
  running = true;
  last = performance.now() - FRAME;
  raf = requestAnimationFrame(loop);
}

function stop() {
  if (!running) return;
  running = false;
  cancelAnimationFrame(raf);
}

/* Never burn frames on a matrix nobody can see. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop();
  else start();
});

new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting) start();
    else stop();
  },
  { threshold: 0.05 }
).observe(panel);

let resizeFrame = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    if (layout()) render(clock);
    if (typeof fitAll === 'function') fitAll();
  });
});

/* Pointer bump — gated to fine pointers, decorative only. */
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion.matches) {
  panel.addEventListener('pointermove', (e) => {
    const rect = panel.getBoundingClientRect();
    bump.col = ((e.clientX - rect.left) / rect.width) * cols;
    bump.target = 5.5;
  });
  panel.addEventListener('pointerleave', () => {
    bump.target = 0;
  });
}


/* ------------------------------------------------------------------ *
 * 2. The catalogue
 *    Illustrative download figures — plausible orders of magnitude for
 *    each family, not scraped from Google Fonts. Swap in real numbers
 *    from the Google Fonts API if they need to be authoritative.
 * ------------------------------------------------------------------ */

const FONTS = [
  { name: 'Stack Sans', downloads: 2300000, google: false },
  { name: 'Roboto', downloads: 12700000, google: true },
  { name: 'Open Sans', downloads: 9450000, google: true },
  { name: 'Inter', downloads: 6820000, google: true },
  { name: 'Montserrat', downloads: 5940000, google: true },
  { name: 'Poppins', downloads: 5210000, google: true },
  { name: 'Lato', downloads: 4380000, google: true },
  { name: 'Oswald', downloads: 2870000, google: true },
  { name: 'Playfair Display', downloads: 1930000, google: true },
  { name: 'DM Sans', downloads: 1540000, google: true },
  { name: 'Space Grotesk', downloads: 920000, google: true },
  { name: 'Bebas Neue', downloads: 780000, google: true },
  { name: 'Manrope', downloads: 640000, google: true },
  { name: 'Sora', downloads: 410000, google: true },
];

function format(n) {
  return n >= 1000000
    ? (n / 1000000).toFixed(1) + 'M'
    : Math.round(n / 1000) + 'K';
}

/* Pull a family from Google Fonts and wait for the face to be usable, so the
   glyphs never swap mid-animation. Resolves either way — a font that fails to
   load just falls back rather than stalling the card. */
function loadFont(font) {
  if (!font.google) return Promise.resolve();

  const id = 'gf-' + font.name.replace(/\s+/g, '-');
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=' +
      font.name.replace(/\s+/g, '+') +
      ':wght@400;700&display=swap';
    document.head.appendChild(link);
  }

  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  return Promise.race([
    document.fonts.load('700 64px "' + font.name + '"').catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 1200)),
  ]);
}

/* ------------------------------------------------------------------ *
 * 3. Entrance, orchestrated with Motion
 * ------------------------------------------------------------------ */

const card = document.getElementById('card');
const counter = document.getElementById('counter');
const fontName = document.getElementById('fontName');
const sample = document.getElementById('sample');
const tile = document.getElementById('tile');
const items = document.querySelectorAll('[data-reveal]');

let current = FONTS[0];

/* A finished Motion animation keeps filling forwards, and a filled animation
   outranks CSS — which would silently swallow the hover state. So flag the end
   state (the stylesheet owns it), release the animation, and strip the inline
   styles it commits on the way out. */
function release(controls, elements) {
  controls.stop();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      elements.forEach((el) => el.removeAttribute('style'));
    });
  });
}

function applyFont(font) {
  current = font;
  fontName.textContent = font.name;

  /* On the root, not the card: the card's inline styles get stripped once the
     entrance finishes, which would take the variable with them. */
  document.documentElement.style.setProperty('--sample-font', "'" + font.name + "'");

  /* Long family names would otherwise truncate. A data attribute survives the
     same style-attribute cleanup, so the size is CSS-owned. */
  const len = font.name.length;
  fontName.dataset.len = len > 15 ? 'xlong' : len > 11 ? 'long' : '';
}

/* Type that always fits ------------------------------------------------- *
   Both the figure and the sample glyphs are set at a size chosen for the
   reference, but a wider fallback face, a five-character figure like 12.7M,
   or a broad family like Playfair can overrun the box. So measure the real
   rendered width once per change and scale the size down until it fits.
   The sizes live in custom properties on :root because the elements' own
   style attributes are stripped when the entrance animation is released. */

const root = document.documentElement;
const HERO_BASE = '32cqw';
const SAMPLE_BASE = '24cqw';

function fitText(el, varName, base, availWidth, availHeight) {
  root.style.setProperty(varName, base);

  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height || !availWidth) return;

  const ratio = Math.min(availWidth / rect.width, availHeight / rect.height, 1);
  if (ratio >= 0.999) return;

  const size = parseFloat(getComputedStyle(el).fontSize) * ratio;
  root.style.setProperty(varName, size + 'px');
}

function fitHero() {
  const box = counter.parentElement;
  const cs = getComputedStyle(box);
  const width = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  fitHero.width = width;
  fitText(counter, '--hero-size', HERO_BASE, width, box.clientHeight);
}

function fitSample() {
  const rect = tile.getBoundingClientRect();
  // Keep the glyphs clear of the tile's rounded corners.
  fitText(sample, '--sample-size', SAMPLE_BASE, rect.width * 0.82, rect.height * 0.62);
}

/* The figure is measured at its final value: tabular numerals mean every
   step of the count-up is the same width or narrower. */
function fitAll() {
  const live = counter.textContent;
  counter.textContent = format(current.downloads);
  fitHero();
  counter.textContent = live;
  fitSample();
}

let counterRun = null;
let revealRun = null;
let runId = 0;

/* One routine for both the first paint and every font change, so a swap feels
   like arriving rather than mutating. */
function play() {
  /* Stopping a Motion animation resolves its `finished` promise, so without a
     token the previous run's completion handler would stamp the previous
     font's figure over the new one. */
  const id = ++runId;

  if (counterRun) counterRun.stop();
  if (revealRun) revealRun.stop();
  fitAll();

  if (reduceMotion.matches) {
    // Gentler, not zero: the content simply is there — no movement, no count-up.
    counter.textContent = format(current.downloads);
    items.forEach((el) => el.setAttribute('data-shown', ''));
    card.setAttribute('data-ready', '');
    reveal = 1;
    render(clock);
    return;
  }

  // Card: ease-out, 500ms, scale starts at 0.97 — never from nothing.
  const cardIn = animate(
    card,
    { opacity: [0, 1], transform: ['translateY(14px) scale(0.97)', 'translateY(0px) scale(1)'] },
    { duration: 0.5, ease: EASE_OUT }
  );
  cardIn.finished.then(() => {
    card.setAttribute('data-ready', '');
    release(cardIn, [card]);
  });

  // Contents cascade behind it — 55ms apart, short enough to read as one gesture.
  const itemsIn = animate(
    items,
    { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0px)'] },
    { duration: 0.42, ease: EASE_OUT, delay: stagger(0.055, { startDelay: 0.14 }) }
  );
  itemsIn.finished.then(() => {
    items.forEach((el) => el.setAttribute('data-shown', ''));
    release(itemsIn, Array.from(items));
  });

  // The wave floods up into the panel.
  revealRun = animate(0, 1, {
    duration: 1.1,
    delay: 0.1,
    ease: EASE_OUT,
    onUpdate: (v) => { reveal = v; },
  });

  // Count-up: explanatory, and seen once per font — the one place a longer
  // duration earns itself.
  const target = current.downloads;
  counterRun = animate(0, target, {
    duration: 1.5,
    delay: 0.18,
    ease: EASE_OUT,
    onUpdate: (v) => { counter.textContent = format(v); },
  });
  counterRun.finished.then(() => {
    if (id === runId) counter.textContent = format(target);
  });
}

function selectFont(font) {
  if (font === current) return;
  loadFont(font).then(() => {
    applyFont(font);
    reveal = 0;
    play();
  });
}

/* ------------------------------------------------------------------ *
 * 4. Font picker
 * ------------------------------------------------------------------ */

const trigger = document.getElementById('fontTrigger');
const menu = document.getElementById('fontMenu');
let menuOpen = false;

FONTS.forEach((font) => {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'menu-item';
  item.setAttribute('role', 'option');
  item.dataset.name = font.name;

  const label = document.createElement('span');
  label.textContent = font.name;
  const count = document.createElement('span');
  count.className = 'menu-count';
  count.textContent = format(font.downloads);

  item.append(label, count);
  item.addEventListener('click', () => {
    closeMenu();
    selectFont(font);
  });
  menu.appendChild(item);
});

const options = Array.from(menu.querySelectorAll('.menu-item'));

function markSelected() {
  options.forEach((el) => {
    el.setAttribute('aria-selected', String(el.dataset.name === current.name));
  });
}

function openMenu() {
  if (menuOpen) return;
  menuOpen = true;
  markSelected();
  menu.hidden = false;
  menu.removeAttribute('data-closing');

  /* On a phone the card sits low enough that a list dropping below the title
     would run off the bottom. Measure first, flip if it has to. */
  menu.removeAttribute('data-placement');
  const below = window.innerHeight - trigger.getBoundingClientRect().bottom;
  if (below < menu.offsetHeight + 24) menu.setAttribute('data-placement', 'top');
  // Next frame, so the closed state is painted before the transition starts.
  requestAnimationFrame(() => menu.setAttribute('data-open', ''));
  trigger.setAttribute('aria-expanded', 'true');

  const selected = options.find((el) => el.getAttribute('aria-selected') === 'true');
  if (selected) selected.scrollIntoView({ block: 'nearest' });
}

function closeMenu(opts) {
  if (!menuOpen) return;
  menuOpen = false;
  menu.removeAttribute('data-open');
  trigger.setAttribute('aria-expanded', 'false');

  if (reduceMotion.matches) {
    menu.hidden = true;
  } else {
    // Exit snaps: 120ms against the 180ms open.
    menu.setAttribute('data-closing', '');
    setTimeout(() => {
      if (!menuOpen) menu.hidden = true;
      menu.removeAttribute('data-closing');
    }, 120);
  }

  if (opts && opts.focusTrigger) trigger.focus();
}

trigger.addEventListener('click', () => {
  if (menuOpen) closeMenu();
  else openMenu();
});

document.addEventListener('pointerdown', (e) => {
  if (!menuOpen) return;
  if (!menu.contains(e.target) && !trigger.contains(e.target)) closeMenu();
});

document.addEventListener('keydown', (e) => {
  if (!menuOpen) {
    if (e.key === 'ArrowDown' && document.activeElement === trigger) {
      e.preventDefault();
      openMenu();
      requestAnimationFrame(() => options[0].focus());
    }
    return;
  }

  if (e.key === 'Escape') {
    e.preventDefault();
    closeMenu({ focusTrigger: true });
    return;
  }

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const index = options.indexOf(document.activeElement);
    const next =
      e.key === 'ArrowDown'
        ? (index + 1) % options.length
        : (index <= 0 ? options.length : index) - 1;
    options[next].focus();
  }
});

/* ------------------------------------------------------------------ *
 * 5. Go
 * ------------------------------------------------------------------ */

function run() {
  layout();
  render(0);
  applyFont(current);
  markSelected();
  play();
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(run);
} else {
  run();
}

/* ------------------------------------------------------------------ *
 * 6. Link preview
 *    Hovering the Pinterest link raises a small preview of the page and
 *    lets it trail the cursor. The chase is a spring rather than a direct
 *    mapping: tying position straight to the pointer reads as artificial,
 *    because real objects carry momentum.
 * ------------------------------------------------------------------ */

const pinLink = document.getElementById('pinLink');
const preview = document.getElementById('linkPreview');
const previewShot = document.getElementById('previewShot');

/* A real screenshot at /pin-preview.png wins; the drawn mockup stands in
   when the file is absent, so the preview can never render broken. */
const SHOT = '/pin-preview.png';
if (previewShot && window.fetch) {
  previewShot.addEventListener('load', () => {
    if (previewShot.naturalWidth > 1) previewShot.hidden = false;
  });
  // Probe rather than set src blindly: a missing optional asset should not
  // put a 404 in the console.
  fetch(SHOT, { method: 'HEAD' })
    .then((res) => { if (res.status === 200) previewShot.src = SHOT; })
    .catch(() => {});
}

const OFFSET_X = 18;
const OFFSET_Y = 22;

let previewOpen = false;
let previewRaf = 0;
let closeTimer = 0;
const pos = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0 };

function clampTarget(clientX, clientY) {
  const w = preview.offsetWidth;
  const h = preview.offsetHeight;
  const margin = 12;

  // Flip to the other side of the cursor when the edge is close.
  let x = clientX + OFFSET_X;
  let y = clientY + OFFSET_Y;
  if (x + w + margin > window.innerWidth) x = clientX - w - OFFSET_X;
  if (y + h + margin > window.innerHeight) y = clientY - h - OFFSET_Y;

  pos.tx = Math.max(margin, Math.min(x, window.innerWidth - w - margin));
  pos.ty = Math.max(margin, Math.min(y, window.innerHeight - h - margin));
}

function paint() {
  preview.style.transform =
    'translate3d(' + Math.round(pos.x) + 'px,' + Math.round(pos.y) + 'px,0)';
}

/* Critically damped: it eases into place and settles without wobbling. */
function chase() {
  previewRaf = requestAnimationFrame(chase);

  const stiffness = 190;
  const damping = 27;
  const step = 1 / 60;

  pos.vx += (stiffness * (pos.tx - pos.x) - damping * pos.vx) * step;
  pos.vy += (stiffness * (pos.ty - pos.y) - damping * pos.vy) * step;
  pos.x += pos.vx * step;
  pos.y += pos.vy * step;

  paint();

  const settled =
    Math.abs(pos.tx - pos.x) < 0.2 &&
    Math.abs(pos.ty - pos.y) < 0.2 &&
    Math.abs(pos.vx) < 0.2 &&
    Math.abs(pos.vy) < 0.2;
  if (settled && !previewOpen) {
    cancelAnimationFrame(previewRaf);
    previewRaf = 0;
  }
}

function openPreview(e) {
  clearTimeout(closeTimer);
  preview.hidden = false;
  preview.removeAttribute('data-closing');
  preview.setAttribute('aria-hidden', 'false');

  const first = !previewOpen;
  previewOpen = true;

  clampTarget(e.clientX, e.clientY);
  if (first) {
    // Appear where the cursor already is, then trail it.
    pos.x = pos.tx;
    pos.y = pos.ty;
    pos.vx = 0;
    pos.vy = 0;
    paint();
  }

  requestAnimationFrame(() => preview.setAttribute('data-open', ''));
  if (!previewRaf && !reduceMotion.matches) chase();
}

function closePreview() {
  if (!previewOpen) return;
  previewOpen = false;
  preview.removeAttribute('data-open');
  preview.setAttribute('data-closing', '');
  preview.setAttribute('aria-hidden', 'true');

  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    if (!previewOpen) {
      preview.hidden = true;
      preview.removeAttribute('data-closing');
      cancelAnimationFrame(previewRaf);
      previewRaf = 0;
    }
  }, 130);
}

/* Fine pointers only: there is no hover on a phone, and a preview that
   appears on tap would just sit in front of the link the user is opening. */
if (pinLink && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  pinLink.addEventListener('pointerenter', openPreview);
  pinLink.addEventListener('pointermove', (e) => {
    if (!previewOpen) return openPreview(e);
    clampTarget(e.clientX, e.clientY);
    if (reduceMotion.matches) {
      pos.x = pos.tx;
      pos.y = pos.ty;
      paint();
    }
  });
  pinLink.addEventListener('pointerleave', closePreview);
  pinLink.addEventListener('blur', closePreview);
}
