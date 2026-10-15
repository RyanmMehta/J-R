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

// The closed book leans a little toward the mouse.
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

window.addEventListener('pointermove', (event) => {
  if (!finePointer.matches || reducedMotion.matches || book.classList.contains('is-open')) return;
  const x = event.clientX / window.innerWidth - 0.5;
  const y = event.clientY / window.innerHeight - 0.5;
  book.style.setProperty('--tilt-x', `${(x * 12).toFixed(2)}deg`);
  book.style.setProperty('--tilt-y', `${(-y * 10).toFixed(2)}deg`);
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
