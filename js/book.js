/* ------------------------------------------------------------------
   The book: open it, turn to a section, zoom in to read, and use the
   index tabs to zoom back out and turn to another section.

   Spreads are numbered by how many leaves have been turned:
     -1 closed, 1 contents, 2 introduction, 3 research, 4 building,
      5 community, 6 appendix, 7 correspondence.
   ------------------------------------------------------------------ */

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const wideReader = window.matchMedia('(min-width: 1180px)');
const phoneBook = window.matchMedia('(max-width: 720px)');

const desk = document.querySelector('.desk');
const camera = document.querySelector('.camera');
const book = document.getElementById('book');
const reader = document.querySelector('.reader');
const closeButton = document.querySelector('.close-journal');
const tocFace = book.querySelector('.page--toc');
const welcomeFace = book.querySelector('.page--welcome');
const basePage = book.querySelector('.page--base');
const leaves = [...book.querySelectorAll('.leaf')]
  .sort((a, b) => Number(a.style.getPropertyValue('--i')) - Number(b.style.getPropertyValue('--i')));

const SPREAD_OF = { contents: 1, intro: 2, research: 3, building: 4, community: 5, appendix: 6, contact: 7 };
const ORDER = ['contents', 'intro', 'research', 'building', 'community', 'appendix', 'contact'];

const OPEN = { dur: 1150, stagger: 420 };    // the cover and first page
const RIFFLE = { dur: 900, stagger: 140 };   // turning through sections
const ZOOM_MS = 1150;
const ZOOM_EASE = 'cubic-bezier(0.5, 0, 0.12, 1)';   // eases in, then settles slowly
const OVERLAP_MS = 420;   // the zoom starts this long before the last page lands

// Book geometry from styles.css, used to work out where a page will land
const PERSPECTIVE = 2200;
const ORIGIN_Y = 0.35;
const INSET = 4;
const THICKNESS = 0.065;

let spread = -1;
let mode = 'closed';      // 'closed' | 'book' | 'reading'
let busy = false;
let queued = null;        // a section picked while the book was still moving
let zoomAnimation = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reducedMotion.matches ? 0 : ms));

/* ---------- Copy each reading page into its place in the book ---------- */

book.querySelectorAll('[data-slot]').forEach((face) => {
  const [id, side] = face.dataset.slot.split('-');
  const source = document.querySelector(`#${id} .pg--${side} .pg__in`);
  if (!source) return;
  const copy = source.cloneNode(true);
  copy.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  face.append(copy);
  face.inert = true;
});

document.querySelectorAll('.peas').forEach((group) => {
  [...group.children].forEach((pea, i) => pea.style.setProperty('--n', i));
});

/* ---------- Small helpers ---------- */

function sectionId(n) {
  return ORDER.find((id) => SPREAD_OF[id] === n);
}

function setBookIsButton(isButton) {
  if (isButton) {
    book.setAttribute('role', 'button');
    book.setAttribute('tabindex', '0');
    book.setAttribute('aria-label', 'Open the research journal');
  } else {
    book.removeAttribute('role');
    book.removeAttribute('tabindex');
    book.removeAttribute('aria-label');
  }
}

function syncInteractivity() {
  const atContents = mode === 'book' && spread === 1;
  tocFace.inert = !atContents;
  welcomeFace.inert = !atContents;
  closeButton.hidden = mode !== 'book';
  book.setAttribute('aria-expanded', String(mode !== 'closed'));
  reader.setAttribute('aria-hidden', String(mode !== 'reading'));
  reader.inert = mode !== 'reading';
}

function setHash(id) {
  const url = id ? `#${id}` : window.location.pathname + window.location.search;
  try {
    history.replaceState(null, '', url);
  } catch {
    // Some embedded previews block address changes; the book works without it.
  }
}

function makeFlat() {
  book.classList.add('is-flat');
}

/* ---------- Turning leaves ---------- */

// Resolves `early` ms before the last leaf lands, so the next move can overlap it.
function flipTo(target, timing, early = 0) {
  const from = spread;
  if (target === from) return Promise.resolve();

  const forward = target > from;
  const order = [];
  if (forward) for (let i = from + 1; i <= target; i++) order.push(i);
  else for (let i = from; i > target; i--) order.push(i);

  order.forEach((i, n) => {
    const leaf = leaves[i];
    leaf.style.setProperty('--dur', `${timing.dur}ms`);
    leaf.style.setProperty('--delay', `${n * timing.stagger}ms`);
    leaf.classList.remove('turn-fwd', 'turn-back');
    void leaf.offsetWidth; // restart the shading animation
    leaf.classList.add(forward ? 'turn-fwd' : 'turn-back');
    leaf.classList.toggle('is-flipped', forward);
  });

  spread = target;
  book.dataset.spread = String(target);

  const total = (order.length - 1) * timing.stagger + timing.dur;
  wait(total + 40).then(() => {
    order.forEach((i) => leaves[i].classList.remove('turn-fwd', 'turn-back'));
  });
  return wait(Math.max(0, total + 40 - early));
}

async function openBook() {
  stopTilt();
  setBookIsButton(false);
  book.classList.add('is-open');
  desk.classList.add('is-open');
  await flipTo(1, OPEN);
  mode = 'book';
}

async function closeBook() {
  mode = 'closed';
  syncInteractivity();
  book.classList.remove('is-open', 'is-flat', 'is-left');
  desk.classList.remove('is-open');
  const timing = spread > 1 ? { dur: 1000, stagger: 130 } : { dur: OPEN.dur, stagger: OPEN.stagger };
  await flipTo(-1, timing);
  setBookIsButton(true);
  book.focus({ preventScroll: true });
}

/* ---------- Zooming ---------- */

function unionRect(a, b) {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  return { left, top, width: Math.max(a.right, b.right) - left, height: Math.max(a.bottom, b.bottom) - top };
}

// Where spread n's pages will sit once the book lies flat, worked out from the
// layout so the zoom can start before the pages have finished turning.
// On phones the left-hand page slides one page width to the centre.
function bookRect(n, { leftFocus = false } = {}) {
  const scene = book.parentElement.getBoundingClientRect();
  const w = scene.width;
  const h = scene.height;
  const t = w * THICKNESS;
  const shift = phoneBook.matches ? (leftFocus ? w : 0) : w / 2;
  const hinge = scene.left + shift;
  const ox = scene.left + w / 2;
  const oy = scene.top + h * ORIGIN_Y;

  const project = (x0, x1, z) => {
    const k = PERSPECTIVE / (PERSPECTIVE - z);
    const top = oy + (scene.top + INSET - oy) * k;
    const bottom = oy + (scene.top + h - INSET - oy) * k;
    return { left: ox + (x0 - ox) * k, right: ox + (x1 - ox) * k, top, bottom };
  };

  const pageWidth = w - INSET;
  const left = project(hinge - pageWidth, hinge, t - 6 + n * 0.7);
  const rect = (r) => ({ left: r.left, top: r.top, width: r.right - r.left, height: r.bottom - r.top });
  if (!wideReader.matches) return rect(left);

  const right = project(hinge, hinge + pageWidth, n + 1 < leaves.length ? t - (n + 1) * 0.7 : t - 6.6);
  return rect({ left: left.left, right: right.right, top: Math.min(left.top, right.top), bottom: Math.max(left.bottom, right.bottom) });
}

// Where the same pages sit in the reading view.
function readerRect(article) {
  const el = wideReader.matches ? article : article.querySelector('.pg--l');
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function cameraTransform(from, to) {
  const k = to.width / from.width;
  const x = to.left - from.left * k;
  const y = to.top - from.top * k;
  return `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${k.toFixed(4)})`;
}

function showSpread(id) {
  reader.querySelectorAll('.spread').forEach((article) => article.classList.toggle('is-active', article.id === id));
  reader.querySelectorAll('.tab').forEach((tab) => {
    if (tab.dataset.go === id) tab.setAttribute('aria-current', 'true');
    else tab.removeAttribute('aria-current');
  });
  reader.scrollTop = 0;
  return document.getElementById(id);
}

// Start the drawings on this spread, in the book and in the reading view together.
function startDrawings(id) {
  document.getElementById(id).classList.add('is-in');
  book.querySelectorAll(`[data-slot^="${id}-"] > .pg__in`).forEach((page) => page.classList.add('is-in'));
}

async function zoomIn(n) {
  const id = sectionId(n);
  const article = showSpread(id);

  const leftFocus = phoneBook.matches;
  const from = bookRect(n, { leftFocus });
  const to = readerRect(article);
  if (leftFocus) book.classList.add('is-left');
  startDrawings(id);

  zoomAnimation = camera.animate(
    [{ transform: 'none' }, { transform: cameraTransform(from, to) }],
    { duration: reducedMotion.matches ? 1 : ZOOM_MS, easing: ZOOM_EASE, fill: 'forwards' },
  );
  await zoomAnimation.finished;

  mode = 'reading';
  syncInteractivity();
  reader.classList.add('is-visible');
  await wait(300);
  reader.classList.add('is-solid');
  article.setAttribute('tabindex', '-1');
  article.focus({ preventScroll: true });
}

async function zoomOut() {
  const article = document.getElementById(sectionId(spread));
  const to = readerRect(article);
  // On stacked pages the reader may have scrolled far down. Pull back from the
  // top of the page instead, so the camera doesn't swing in from off screen.
  if (!wideReader.matches && reader.scrollTop > 0) {
    to.top += reader.scrollTop;
  }
  const leftFocus = book.classList.contains('is-left');
  const from = bookRect(spread, { leftFocus });

  // Put the camera exactly behind the page being read, then pull back.
  if (zoomAnimation) zoomAnimation.cancel();
  reader.classList.remove('is-solid');
  camera.classList.remove('is-hidden');
  const delay = reducedMotion.matches ? 0 : 260;
  const duration = reducedMotion.matches ? 1 : ZOOM_MS;
  zoomAnimation = camera.animate(
    [{ transform: cameraTransform(from, to) }, { transform: 'none' }],
    { duration, delay, easing: ZOOM_EASE, fill: 'both' },
  );
  reader.classList.remove('is-visible');
  mode = 'book';
  syncInteractivity();
  closeButton.hidden = true;

  // On phones the book slides back to its right-hand page as the camera pulls out.
  if (leftFocus) setTimeout(() => book.classList.remove('is-left'), delay);

  const finished = zoomAnimation;
  finished.finished.then(() => {
    finished.cancel();
    if (zoomAnimation === finished) zoomAnimation = null;
  });
  // Hand back a little early so the pages can start turning as the camera settles.
  await wait(delay + duration - OVERLAP_MS);
}

/* ---------- Going somewhere ---------- */

async function goTo(id) {
  const target = id === 'closed' ? -1 : SPREAD_OF[id];
  if (target === undefined) return;
  // Mid-move: remember the latest pick and go there as soon as this move ends.
  if (busy) { queued = id; return; }
  if (mode === 'reading' && target === spread) return;
  if (mode === 'book' && target === spread && target === 1) return;

  busy = true;
  try {
    if (mode === 'reading') await zoomOut();

    if (target === -1) {
      if (mode !== 'closed') await closeBook();
      setHash(null);
      return;
    }

    if (mode === 'closed') await openBook();

    if (target >= 2) makeFlat();
    else book.classList.remove('is-flat');

    closeButton.hidden = true;
    await flipTo(target, RIFFLE, target >= 2 ? OVERLAP_MS : 0);

    if (target >= 2) {
      await zoomIn(target);
    } else {
      mode = 'book';
      syncInteractivity();
      document.getElementById('toc-title').setAttribute('tabindex', '-1');
      document.getElementById('toc-title').focus({ preventScroll: true });
    }
    setHash(id);
  } finally {
    busy = false;
    if (queued) {
      const next = queued;
      queued = null;
      goTo(next);
    }
  }
}

// Put the book straight into a state, used when the page opens on a link like #research.
function jumpTo(id) {
  const target = SPREAD_OF[id];
  if (target === undefined) return;

  book.classList.add('no-anim');
  camera.classList.add('no-anim');
  leaves.forEach((leaf, i) => leaf.classList.toggle('is-flipped', i <= target));
  spread = target;
  book.dataset.spread = String(target);
  book.classList.add('is-open');
  desk.classList.add('is-open');
  setBookIsButton(false);

  if (target >= 2) {
    book.classList.add('is-flat');
    if (phoneBook.matches) book.classList.add('is-left');
    showSpread(id);
    startDrawings(id);
    reader.classList.add('is-visible', 'is-solid');
    mode = 'reading';
  } else {
    mode = 'book';
  }
  syncInteractivity();

  requestAnimationFrame(() => requestAnimationFrame(() => {
    book.classList.remove('no-anim');
    camera.classList.remove('no-anim');
  }));
}

/* ---------- Clicks and keys ---------- */

book.addEventListener('click', () => {
  if (mode === 'closed' && !busy) goTo('contents');
});

book.addEventListener('keydown', (event) => {
  if (mode !== 'closed') return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    goTo('contents');
  }
});

document.addEventListener('click', (event) => {
  const link = event.target.closest('[data-go]');
  if (!link) return;
  event.preventDefault();
  goTo(link.dataset.go);
});

closeButton.addEventListener('click', () => goTo('closed'));

document.addEventListener('keydown', (event) => {
  if (busy) return;
  // pages.js closes an open explanation sheet or preview first
  if (document.querySelector('dialog[open], .reader .entry.is-previewing')) return;

  if (event.key === 'Escape') {
    if (mode === 'reading') goTo('contents');
    else if (mode === 'book') goTo('closed');
  }

  if (mode === 'reading' && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
    const here = ORDER.indexOf(sectionId(spread));
    const next = ORDER[here + (event.key === 'ArrowRight' ? 1 : -1)];
    if (next) goTo(next);
  }
});

window.addEventListener('hashchange', () => {
  const id = window.location.hash.slice(1);
  if (id in SPREAD_OF && SPREAD_OF[id] !== spread) goTo(id);
});

/* ---------- The closed book turns to follow the pointer ---------- */

const MAX_TILT = 18;        // degrees, the same in every direction
const MAX_DEVICE_TILT = 7;  // phones only lean the book a little
const DEVICE_RANGE = 18;    // degrees of phone tilt that give the full lean
const target = { x: 0, y: 0 };
const current = { x: 0, y: 0 };
let tiltFrame = null;
let tiltScale = MAX_TILT;
let touchActive = false;
let usingDeviceTilt = false;
let dragDistance = 0;
let dragStart = null;

const canTilt = () => !reducedMotion.matches && mode === 'closed' && !busy;

// Keep the aim inside a circle so a diagonal leans as far as a straight move.
function aim(x, y, scale) {
  const length = Math.hypot(x, y);
  const squeeze = length > 1 ? 1 / length : 1;
  target.x = x * squeeze;
  target.y = y * squeeze;
  tiltScale = scale;
  startTilt();
}

function aimAt(clientX, clientY) {
  aim((clientX / window.innerWidth - 0.5) * 2, (clientY / window.innerHeight - 0.5) * 2, MAX_TILT);
}

function startTilt() {
  if (!canTilt()) return;
  book.classList.add('is-tracking');
  if (!tiltFrame) tiltFrame = requestAnimationFrame(stepTilt);
}

function stepTilt() {
  tiltFrame = null;
  if (!canTilt()) { stopTilt(); return; }
  current.x += (target.x - current.x) * 0.12;
  current.y += (target.y - current.y) * 0.12;
  book.style.setProperty('--tilt-x', `${(current.x * tiltScale).toFixed(2)}deg`);
  book.style.setProperty('--tilt-y', `${(-current.y * tiltScale).toFixed(2)}deg`);
  const settled = Math.abs(target.x - current.x) < 0.002 && Math.abs(target.y - current.y) < 0.002;
  if (!settled) tiltFrame = requestAnimationFrame(stepTilt);
}

function stopTilt() {
  if (tiltFrame) cancelAnimationFrame(tiltFrame);
  tiltFrame = null;
  book.classList.remove('is-tracking');
  book.style.removeProperty('--tilt-x');
  book.style.removeProperty('--tilt-y');
  target.x = target.y = current.x = current.y = 0;
}

window.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') {
    if (!touchActive) return;
    if (dragStart) dragDistance = Math.max(dragDistance, Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y));
  } else if (usingDeviceTilt) {
    return;
  }
  aimAt(event.clientX, event.clientY);
});

window.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch') return;
  touchActive = true;
  dragDistance = 0;
  dragStart = { x: event.clientX, y: event.clientY };
});

function releaseTouch() {
  if (!touchActive) return;
  touchActive = false;
  dragStart = null;
  if (!usingDeviceTilt) aim(0, 0, tiltScale);
}

window.addEventListener('pointerup', releaseTouch);
window.addEventListener('pointercancel', releaseTouch);

document.documentElement.addEventListener('pointerleave', () => {
  if (!usingDeviceTilt) aim(0, 0, tiltScale);
});

// A drag across the closed book should not count as a tap that opens it.
book.addEventListener('click', (event) => {
  if (dragDistance > 12) {
    event.stopImmediatePropagation();
    dragDistance = 0;
  }
}, true);

/* ---------- Phones: the book leans a little as the phone tilts ----------
   The first reading is the resting position, and the rest point drifts
   slowly toward however the phone is held, so the book always settles
   back to center. */

let rest = null;

const wrap = (degrees) => ((degrees + 540) % 360) - 180;

function onDeviceTilt(event) {
  if (event.gamma === null || event.beta === null || touchActive) return;
  const angle = screen.orientation?.angle ?? window.orientation ?? 0;
  // Sideways and forward lean in screen terms, whichever way the phone is turned.
  let side = event.gamma;
  let forward = event.beta;
  if (angle === 90) { side = event.beta; forward = -event.gamma; }
  else if (angle === -90 || angle === 270) { side = -event.beta; forward = event.gamma; }
  else if (angle === 180) { side = -event.gamma; forward = -event.beta; }

  if (!rest || rest.angle !== angle) rest = { side, forward, angle };
  let dx = wrap(side - rest.side);
  let dy = wrap(forward - rest.forward);
  // Past straight up the readings flip, so start over from the new position.
  if (Math.abs(dx) > 60 || Math.abs(dy) > 60) {
    rest = { side, forward, angle };
    dx = dy = 0;
  }
  rest.side += dx * 0.006;
  rest.forward += dy * 0.006;

  usingDeviceTilt = true;
  aim(dx / DEVICE_RANGE, dy / DEVICE_RANGE, MAX_DEVICE_TILT);
}

window.addEventListener('deviceorientation', onDeviceTilt);

// iPhones only send tilt after the visitor allows it, and Safari only asks
// in response to a touch. Ask on the first touch that isn't the tap that
// opens the book, so the question never covers the opening.
const needsPermission = typeof DeviceOrientationEvent !== 'undefined'
  && typeof DeviceOrientationEvent.requestPermission === 'function';

if (needsPermission) {
  const askForTilt = (event) => {
    if (mode !== 'closed' || usingDeviceTilt) return;
    if (dragDistance <= 12 && event.target.closest?.('.book')) return;
    window.removeEventListener('touchend', askForTilt);
    DeviceOrientationEvent.requestPermission().catch(() => {});
  };
  window.addEventListener('touchend', askForTilt);
}

/* ---------- Start ---------- */

syncInteractivity();
const startAt = window.location.hash.slice(1);
if (startAt in SPREAD_OF) jumpTo(startAt);
