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
const RIFFLE = { dur: 850, stagger: 150 };   // turning through sections
const ZOOM_MS = 850;
const ZOOM_EASE = 'cubic-bezier(0.6, 0.02, 0.25, 1)';

let spread = -1;
let mode = 'closed';      // 'closed' | 'book' | 'reading'
let busy = false;
let flatSince = 0;
let zoomAnimation = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reducedMotion.matches ? 0 : ms));
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

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
  if (!book.classList.contains('is-flat')) {
    book.classList.add('is-flat');
    flatSince = performance.now();
  }
}

/* ---------- Turning leaves ---------- */

function flipTo(target, timing) {
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
  return wait(total + 40).then(() => {
    order.forEach((i) => leaves[i].classList.remove('turn-fwd', 'turn-back'));
  });
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

// Where the open spread sits in the book, measured with the camera at rest.
// On phones the left-hand page slides to the centre while the camera zooms,
// so its target is where it will end up, one page width to the right.
function bookRect(n, { slidingLeft = false } = {}) {
  const left = leaves[n].querySelector(':scope > .face--back').getBoundingClientRect();
  if (slidingLeft) {
    const shift = book.offsetWidth;
    return { left: left.left + shift, top: left.top, width: left.width, height: left.height };
  }
  if (!wideReader.matches) return left;
  const rightFace = n + 1 < leaves.length ? leaves[n + 1].querySelector(':scope > .face--front') : basePage;
  return unionRect(left, rightFace.getBoundingClientRect());
}

// Where the same pages sit in the reading view.
function readerRect(article) {
  const el = wideReader.matches ? article : article.querySelector('.pg--l');
  return el.getBoundingClientRect();
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

  // The book needs to have finished lying flat before it is measured.
  await wait(Math.max(0, 1000 - (performance.now() - flatSince)));
  await nextFrame();

  const slidingLeft = phoneBook.matches && !book.classList.contains('is-left');
  const from = bookRect(n, { slidingLeft });
  const to = readerRect(article);
  if (slidingLeft) book.classList.add('is-left');
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
  camera.classList.add('is-hidden');
  article.setAttribute('tabindex', '-1');
  article.focus({ preventScroll: true });
}

async function zoomOut() {
  const article = document.getElementById(sectionId(spread));
  const to = readerRect(article);

  // Measure the book at rest, then put the camera exactly behind the page being read.
  if (zoomAnimation) zoomAnimation.cancel();
  const from = bookRect(spread);
  const zoomed = cameraTransform(from, to);

  reader.classList.remove('is-solid');
  camera.classList.remove('is-hidden');
  zoomAnimation = camera.animate(
    [{ transform: zoomed }, { transform: 'none' }],
    { duration: reducedMotion.matches ? 1 : ZOOM_MS, delay: reducedMotion.matches ? 0 : 280, easing: ZOOM_EASE, fill: 'both' },
  );
  reader.classList.remove('is-visible');
  mode = 'book';
  syncInteractivity();
  closeButton.hidden = true;

  // On phones the book slides back to its right-hand page as the camera pulls out.
  if (book.classList.contains('is-left')) setTimeout(() => book.classList.remove('is-left'), reducedMotion.matches ? 0 : 280);

  await zoomAnimation.finished;
  zoomAnimation.cancel();
  zoomAnimation = null;
}

/* ---------- Going somewhere ---------- */

async function goTo(id) {
  if (busy) return;
  const target = id === 'closed' ? -1 : SPREAD_OF[id];
  if (target === undefined) return;
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
    await flipTo(target, RIFFLE);

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
    camera.classList.add('is-hidden');
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
  // pages.js closes an open note or preview first
  if (document.querySelector('.reader .note[aria-expanded="true"], .reader .entry.is-previewing')) return;

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

const MAX_TURN = 22;   // degrees left and right
const MAX_TIP = 14;    // degrees up and down
const target = { x: 0, y: 0 };
const current = { x: 0, y: 0 };
let tiltFrame = null;
let touchActive = false;
let usingDeviceTilt = false;
let dragDistance = 0;
let dragStart = null;

const canTilt = () => !reducedMotion.matches && mode === 'closed' && !busy;

function aimAt(clientX, clientY) {
  target.x = Math.max(-1, Math.min(1, (clientX / window.innerWidth - 0.5) * 2));
  target.y = Math.max(-1, Math.min(1, (clientY / window.innerHeight - 0.5) * 2));
  startTilt();
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
  book.style.setProperty('--tilt-x', `${(current.x * MAX_TURN).toFixed(2)}deg`);
  book.style.setProperty('--tilt-y', `${(-current.y * MAX_TIP).toFixed(2)}deg`);
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
  if (!usingDeviceTilt) { target.x = 0; target.y = 0; startTilt(); }
}

window.addEventListener('pointerup', releaseTouch);
window.addEventListener('pointercancel', releaseTouch);

document.documentElement.addEventListener('pointerleave', () => {
  if (usingDeviceTilt) return;
  target.x = 0;
  target.y = 0;
  startTilt();
});

// A drag across the closed book should not count as a tap that opens it.
book.addEventListener('click', (event) => {
  if (dragDistance > 12) {
    event.stopImmediatePropagation();
    dragDistance = 0;
  }
}, true);

// Android browsers send device tilt freely; iOS asks permission, so iPhones use the drag.
window.addEventListener('deviceorientation', (event) => {
  if (event.gamma === null || event.beta === null || touchActive) return;
  usingDeviceTilt = true;
  target.x = Math.max(-1, Math.min(1, event.gamma / 30));
  target.y = Math.max(-1, Math.min(1, (event.beta - 45) / 30));
  startTilt();
});

/* ---------- Start ---------- */

syncInteractivity();
const startAt = window.location.hash.slice(1);
if (startAt in SPREAD_OF) jumpTo(startAt);
