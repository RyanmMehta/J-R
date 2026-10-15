// Change these and every place they appear on the cover (label, bookplate,
// sign-off, browser tab) updates to match.
const JOURNAL = {
  name: 'Jenna Chuan',
  tagline: 'Biology · Dean\'s Scholars · UT Austin',
  photo: 'assets/portrait-placeholder.svg',
  volume: '01',
};

const desk = document.querySelector('.desk');
const book = document.getElementById('book');
const closeButton = document.querySelector('.close-journal');
const insidePages = book.querySelectorAll('.page--toc, .page--welcome');
const tocTitle = document.getElementById('toc-title');

// Opening or closing takes the stagger between the two leaves plus one flip.
const rootStyle = getComputedStyle(document.documentElement);
const seconds = (name) => parseFloat(rootStyle.getPropertyValue(name)) || 0;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const turnTime = () => (reducedMotion.matches ? 0 : (seconds('--flip') + seconds('--stagger')) * 1000);

let closingTimer;

function fillDetails() {
  const firstName = JOURNAL.name.split(' ')[0];
  const values = {
    name: JOURNAL.name,
    'first-name': firstName,
    tagline: JOURNAL.tagline,
    volume: JOURNAL.volume,
  };

  document.querySelectorAll('[data-fill]').forEach((el) => {
    const key = el.dataset.fill;
    if (key === 'photo') {
      el.src = JOURNAL.photo;
      el.alt = `Portrait of ${JOURNAL.name}`;
    } else if (key in values) {
      el.textContent = values[key];
    }
  });

  document.title = `${JOURNAL.name} · Research Journal`;
}

function setInert(isInert) {
  insidePages.forEach((page) => { page.inert = isInert; });
}

// While closed the whole book is one big button. Once open it is just a
// container, so the links inside are not nested in a button.
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

function openBook() {
  if (book.classList.contains('is-open')) return;
  clearTimeout(closingTimer);

  stopTilt();
  book.classList.remove('is-closing');
  book.classList.add('is-open');
  desk.classList.add('is-open');
  book.setAttribute('aria-expanded', 'true');
  book.style.removeProperty('--tilt-x');
  book.style.removeProperty('--tilt-y');

  setBookIsButton(false);
  setInert(false);
  closeButton.hidden = false;

  tocTitle.setAttribute('tabindex', '-1');
  setTimeout(() => tocTitle.focus({ preventScroll: true }), turnTime());
}

function closeBook() {
  if (!book.classList.contains('is-open')) return;

  book.classList.remove('is-open');
  book.classList.add('is-closing');
  desk.classList.remove('is-open');
  book.setAttribute('aria-expanded', 'false');

  setInert(true);
  closeButton.hidden = true;
  setBookIsButton(true);
  book.focus({ preventScroll: true });

  closingTimer = setTimeout(() => book.classList.remove('is-closing'), turnTime());
}

book.addEventListener('click', (event) => {
  if (!book.classList.contains('is-open')) {
    openBook();
    return;
  }
  // Picking a chapter: the book lifts away, then the journal opens at that section.
  const link = event.target.closest('.toc a');
  if (!link) return;
  event.preventDefault();
  desk.classList.add('is-leaving');
  setTimeout(() => { window.location.href = link.href; }, reducedMotion.matches ? 0 : 520);
});

// Coming back with the browser's back button can restore the faded-out page.
window.addEventListener('pageshow', () => desk.classList.remove('is-leaving'));

book.addEventListener('keydown', (event) => {
  if (book.classList.contains('is-open')) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openBook();
  }
});

closeButton.addEventListener('click', closeBook);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeBook();
});

// The closed book turns to follow the mouse, a finger dragged across the
// screen, or (where the browser allows it) the tilt of the phone itself.
const MAX_TURN = 22;   // degrees left and right
const MAX_TIP = 14;    // degrees up and down
const target = { x: 0, y: 0 };
const current = { x: 0, y: 0 };
let tiltFrame = null;
let touchActive = false;
let usingDeviceTilt = false;
let dragDistance = 0;
let dragStart = null;

const canTilt = () => !reducedMotion.matches
  && !book.classList.contains('is-open')
  && !book.classList.contains('is-closing')
  && !desk.classList.contains('is-leaving');

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

// Mouse leaves the window: drift back to the resting angle.
document.documentElement.addEventListener('pointerleave', () => {
  if (usingDeviceTilt) return;
  target.x = 0;
  target.y = 0;
  startTilt();
});

// A drag that ends on the book should not count as a tap that opens it.
book.addEventListener('click', (event) => {
  if (dragDistance > 12) {
    event.stopImmediatePropagation();
    dragDistance = 0;
  }
}, true);

// Phone tilt. Android browsers send these freely; iOS asks for permission,
// so on iPhones the finger drag does the job instead.
window.addEventListener('deviceorientation', (event) => {
  if (event.gamma === null || event.beta === null || touchActive) return;
  usingDeviceTilt = true;
  target.x = Math.max(-1, Math.min(1, event.gamma / 30));
  target.y = Math.max(-1, Math.min(1, (event.beta - 45) / 30));
  startTilt();
});

// The stethoscope on the desk: tapping it makes the heart sticker beat faster.
const stetho = document.querySelector('.stetho');
let listenTimer;
stetho.addEventListener('click', () => {
  clearTimeout(listenTimer);
  desk.classList.add('is-listening');
  listenTimer = setTimeout(() => desk.classList.remove('is-listening'), 3000);
});

fillDetails();
