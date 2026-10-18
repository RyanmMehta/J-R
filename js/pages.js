/* ------------------------------------------------------------------
   Things to do on the pages once the book has zoomed in: paper and
   poster previews, the timeline, the HappyPEA pea, copying the email,
   and opening and closing the Explain sheets. The figures inside the
   sheets are in js/figures.js.
   Only the reading view is wired up; the copies inside the book are inert.
   ------------------------------------------------------------------ */

const readingView = document.querySelector('.reader');

/* ---------- Paper and poster previews ----------
   Hovering a title shows its preview (CSS). Clicking or tapping pins it open. */

function setPreview(entry, open) {
  entry.classList.toggle('is-previewing', open);
  entry.querySelector('.entry__toggle').setAttribute('aria-expanded', String(open));
}

function closePreviews(except) {
  readingView.querySelectorAll('.entry.is-previewing').forEach((entry) => {
    if (entry !== except) setPreview(entry, false);
  });
}

readingView.querySelectorAll('.entry__toggle').forEach((toggle) => {
  toggle.addEventListener('click', () => {
    const entry = toggle.closest('.entry');
    const open = !entry.classList.contains('is-previewing');
    closePreviews(entry);
    setPreview(entry, open);
  });
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.entry')) closePreviews();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !sheet.open) closePreviews();
});

// Leaving a section closes any preview left open on it.
readingView.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => closePreviews());
});

/* ---------- The HappyPEA pea ---------- */

const pea = readingView.querySelector('.pea');
const bubble = readingView.querySelector('.pea__bubble');
const peaLines = [
  'Drink some water today',
  'Take a stretch break',
  'Check in with a friend',
  'Hi from HappyPEA',
];
let peaIndex = 0;

pea.addEventListener('click', () => {
  pea.classList.remove('is-boing');
  void pea.offsetWidth; // restart the bounce on quick repeat clicks
  pea.classList.add('is-boing');

  bubble.textContent = peaLines[peaIndex % peaLines.length];
  peaIndex += 1;
  bubble.classList.remove('is-new');
  void bubble.offsetWidth;
  bubble.classList.add('is-new');
});

pea.addEventListener('animationend', (event) => {
  if (event.animationName === 'boing') pea.classList.remove('is-boing');
});

/* ---------- Copy email ---------- */

const emailButton = readingView.querySelector('.contact__email');
const emailHint = emailButton.querySelector('.contact__hint');

emailButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(emailButton.dataset.email);
    emailHint.textContent = 'copied';
  } catch {
    // Clipboard blocked: select the address so it can be copied by hand.
    const range = document.createRange();
    range.selectNodeContents(emailButton.querySelector('.contact__value'));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    emailHint.textContent = 'selected';
  }
  emailButton.classList.add('is-copied');
  setTimeout(() => {
    emailHint.textContent = 'copy';
    emailButton.classList.remove('is-copied');
  }, 2200);
});

/* ---------- Timeline on the introduction page ---------- */

readingView.querySelectorAll('.timeline').forEach((timeline) => {
  const label = timeline.querySelector('.timeline__label');
  const dots = [...timeline.querySelectorAll('.timeline__dot')];
  const show = (dot) => {
    dots.forEach((other) => other.classList.toggle('is-on', other === dot));
    label.textContent = `${dot.textContent} · ${dot.nextElementSibling.textContent}`;
  };
  dots.forEach((dot) => {
    dot.addEventListener('mouseenter', () => show(dot));
    dot.addEventListener('focus', () => show(dot));
    dot.addEventListener('click', () => show(dot));
  });
});

/* ---------- Explain: the deeper sheet ---------- */

const sheet = document.querySelector('.deep');
const sheetBody = sheet.querySelector('.deep__body');
const sheetScroller = sheet.querySelector('.deep__sheet');
const quietMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let sheetOpener = null;

function openSheet(key, opener) {
  const template = document.getElementById(`deep-${key}`);
  if (!template) return;
  closePreviews();
  sheetBody.replaceChildren(template.content.cloneNode(true));
  sheetScroller.scrollTop = 0;
  sheetOpener = opener;
  sheet.showModal();
  prepareSheet(sheetBody); // js/figures.js
}

function closeSheet() {
  if (!sheet.open || sheet.classList.contains('is-closing')) return;
  if (quietMotion.matches) { sheet.close(); return; }
  sheet.classList.add('is-closing');
  setTimeout(() => {
    sheet.classList.remove('is-closing');
    sheet.close();
  }, 220);
}

readingView.addEventListener('click', (event) => {
  const button = event.target.closest('.explain');
  if (button) openSheet(button.dataset.deep, button);
});

sheet.querySelector('.deep__close').addEventListener('click', closeSheet);
sheet.addEventListener('cancel', (event) => { event.preventDefault(); closeSheet(); });
sheet.addEventListener('click', (event) => { if (event.target === sheet) closeSheet(); });
sheet.addEventListener('close', () => sheetOpener?.focus({ preventScroll: true }));
