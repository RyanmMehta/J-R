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

/* ---------- Small tap-to-explain pieces on the pages ----------
   The cell and heartbeat doodles, PEA highlights and the toolkit: tapping
   a button shows its data-text, and the doodles light up the matching part. */

function explainOnTap(box, buttonSelector, textSelector, onPick) {
  const buttons = [...box.querySelectorAll(buttonSelector)];
  const text = box.querySelector(textSelector);
  const show = (button) => {
    buttons.forEach((other) => other.classList.toggle('is-on', other === button));
    text.textContent = button.dataset.text;
    onPick?.(button);
  };
  buttons.forEach((button) => {
    button.addEventListener('click', () => show(button));
    button.addEventListener('mouseenter', () => { if (window.matchMedia('(hover: hover)').matches) show(button); });
  });
}

readingView.querySelectorAll('.cell').forEach((cell) => {
  const parts = [...cell.querySelectorAll('svg [data-part]')];
  explainOnTap(cell, '.tag', '.cell__text', (button) => {
    cell.classList.add('has-pick');
    parts.forEach((part) => part.classList.toggle('is-on', part.dataset.part === button.dataset.part));
  });
});

readingView.querySelectorAll('.ekg').forEach((ekg) => {
  const marks = [...ekg.querySelectorAll('svg [data-wave]')];
  explainOnTap(ekg, '.tag', '.ekg__text', (button) => {
    marks.forEach((mark) => mark.classList.toggle('is-on', mark.dataset.wave === button.dataset.wave));
  });
});

readingView.querySelectorAll('.stamps').forEach((box) => explainOnTap(box, '.stamp', '.stamps__text'));
readingView.querySelectorAll('.toolkit').forEach((box) => explainOnTap(box.parentElement, '.toolkit .tag', '.toolkit__text'));

/* ---------- "Say hello." in English, Spanish and Mandarin ---------- */

readingView.querySelectorAll('.hello').forEach((hello) => {
  const words = hello.dataset.words.split('|');
  let at = 0;
  hello.addEventListener('click', () => {
    at = (at + 1) % words.length;
    hello.classList.remove('is-new');
    void hello.offsetWidth;
    hello.textContent = words[at];
    hello.classList.add('is-new');
  });
});

/* ---------- Lab Connections ----------
   Pick 4 tiles that share a group. Solved groups move to the top as a
   colored bar; 4 mistakes reveals the rest. */

readingView.querySelectorAll('.conn').forEach((game) => {
  const GROUPS = [
    'Parts of splicing · Entry 04',
    'Algae and their pigments · Entry 03',
    'Drugs that act on opioid receptors · Entry 02',
    'Regression words · Entry 05',
  ];
  const grid = game.querySelector('.conn__grid');
  const solved = game.querySelector('.conn__solved');
  const msg = game.querySelector('.conn__msg');
  const submit = game.querySelector('[data-action="submit"]');
  const shuffle = game.querySelector('[data-action="shuffle"]');
  let lives = 4;
  let picked = [];
  let tried = new Set();

  const tiles = () => [...grid.querySelectorAll('.conn__tile')];
  const showLives = (note) => {
    msg.replaceChildren();
    if (note) msg.append(`${note} `);
    msg.append('Mistakes left: ');
    const dots = document.createElement('span');
    dots.className = 'conn__lives';
    dots.textContent = '● '.repeat(lives).trim() || 'none';
    msg.append(dots);
  };
  const update = () => {
    tiles().forEach((tile) => tile.classList.toggle('is-picked', picked.includes(tile)));
    submit.disabled = picked.length !== 4;
  };
  const solve = (group) => {
    const words = tiles().filter((tile) => tile.dataset.g === String(group));
    const bar = document.createElement('div');
    bar.className = `conn__group conn__group--${group}`;
    const name = document.createElement('b');
    name.textContent = GROUPS[group];
    const list = document.createElement('span');
    list.textContent = words.map((tile) => tile.textContent.replace(/­/g, '')).join(', ');
    bar.append(name, list);
    solved.append(bar);
    words.forEach((tile) => tile.remove());
  };
  const finish = (won) => {
    for (let g = 0; g < GROUPS.length; g += 1) if (tiles().some((tile) => tile.dataset.g === String(g))) solve(g);
    game.classList.add('is-done');
    msg.textContent = won ? 'Solved. Nice work!' : 'Out of mistakes. Here are the groups.';
    submit.disabled = true;
    shuffle.disabled = true;
  };

  grid.addEventListener('click', (event) => {
    const tile = event.target.closest('.conn__tile');
    if (!tile || game.classList.contains('is-done')) return;
    if (picked.includes(tile)) picked = picked.filter((t) => t !== tile);
    else if (picked.length < 4) picked.push(tile);
    update();
  });

  shuffle.addEventListener('click', () => {
    const list = tiles();
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    grid.append(...list);
  });

  submit.addEventListener('click', () => {
    if (picked.length !== 4) return;
    const key = picked.map((tile) => tile.textContent).sort().join('|');
    if (tried.has(key)) { showLives('Already tried.'); return; }
    tried.add(key);
    const counts = {};
    picked.forEach((tile) => { counts[tile.dataset.g] = (counts[tile.dataset.g] || 0) + 1; });
    const best = Math.max(...Object.values(counts));
    if (best === 4) {
      solve(picked[0].dataset.g);
      picked = [];
      update();
      if (!tiles().length) finish(true);
      else showLives('Got one!');
      return;
    }
    lives -= 1;
    picked.forEach((tile) => {
      tile.classList.remove('is-wrong');
      void tile.offsetWidth;
      tile.classList.add('is-wrong');
    });
    if (lives === 0) { picked = []; update(); finish(false); return; }
    showLives(best === 3 ? 'One away…' : 'Not quite.');
  });
});
