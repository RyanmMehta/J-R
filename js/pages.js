/* ------------------------------------------------------------------
   Things to do on the pages once the book has zoomed in: paper and
   poster previews, margin notes, the HappyPEA pea, and copying the email.
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

/* ---------- Margin notes ---------- */

const notes = [...readingView.querySelectorAll('.note')];

function setNote(button, open) {
  button.setAttribute('aria-expanded', String(open));
  button.nextElementSibling.hidden = !open;
}

function closeNotes(except) {
  notes.forEach((button) => { if (button !== except) setNote(button, false); });
}

notes.forEach((button) => {
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = button.getAttribute('aria-expanded') !== 'true';
    closeNotes(button);
    setNote(button, open);
  });
});

document.addEventListener('click', (event) => {
  if (event.target.closest('.note__card')) return;
  closeNotes();
  if (!event.target.closest('.entry')) closePreviews();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeNotes();
  closePreviews();
});

// Leaving a section closes anything left open on it.
readingView.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => { closeNotes(); closePreviews(); });
});

/* ---------- The HappyPEA pea ---------- */

const pea = readingView.querySelector('.pea');
const bubble = readingView.querySelector('.pea__bubble');
const peaLines = [
  'Drink some water today',
  'Take a stretch break',
  'Check in with a friend',
  'Launching in 2027',
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
