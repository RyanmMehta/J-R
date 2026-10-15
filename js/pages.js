const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Scroll reveals ----------
   Anything already on screen at load stays put. Anything below the fold
   starts slightly lowered and settles in when it scrolls into view. */

function markIn(el) {
  el.classList.remove('is-pending');
  el.querySelectorAll('.maze, .scatter').forEach(markArt);
  if (el.matches('.maze, .scatter')) markArt(el);
  if (el.matches('[data-draw]')) el.classList.add('is-in');
}

function markArt(art) {
  if (art.classList.contains('is-in')) return;
  art.classList.add('is-in');
  const motion = art.querySelector('animateMotion');
  if (motion && !reducedMotion) motion.beginElement();
  // Without motion, park the maze dot at the exit.
  if (motion && reducedMotion) art.querySelector('.maze__dot').setAttribute('transform', 'translate(140 120)');
}

document.querySelectorAll('.peas i').forEach((pea, i) => pea.style.setProperty('--i', i));

const revealables = document.querySelectorAll('[data-reveal], [data-draw]');

if ('IntersectionObserver' in window && !reducedMotion) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      markIn(entry.target);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

  revealables.forEach((el) => {
    const top = el.getBoundingClientRect().top;
    if (top < window.innerHeight * 0.9) {
      markIn(el);
    } else {
      // Drawn lines stay visible while they wait; only reveals start hidden.
      if (el.matches('[data-reveal]')) el.classList.add('is-pending');
      observer.observe(el);
    }
  });
} else {
  revealables.forEach(markIn);
}

/* ---------- Running head ----------
   Shows the current section and its page number, and underlines it in the nav. */

const runhead = document.querySelector('.runhead');
const runSection = document.querySelector('.runhead__section');
const runNum = document.querySelector('.runhead__num');
const navLinks = [...document.querySelectorAll('.runhead__nav a')];
const sections = [...document.querySelectorAll('[data-page]')];

function updateRunhead() {
  runhead.classList.toggle('is-scrolled', window.scrollY > 8);

  // The EKG under the running head traces across as the page is read.
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const read = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 1;
  runhead.style.setProperty('--read', (1 - read).toFixed(4));

  const line = window.innerHeight * 0.35;
  let current = sections[0];
  sections.forEach((section) => {
    if (section.getBoundingClientRect().top <= line) current = section;
  });

  runSection.textContent = current.dataset.title;
  runNum.textContent = `p. ${current.dataset.page}`;
  navLinks.forEach((link) => {
    const isCurrent = link.getAttribute('href') === `#${current.id}`;
    if (isCurrent) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  });
}

let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { updateRunhead(); ticking = false; });
}, { passive: true });
updateRunhead();

/* ---------- Paper and poster previews ----------
   Hovering a title shows its preview (CSS). Clicking or tapping pins it open. */

document.querySelectorAll('.entry__toggle').forEach((toggle) => {
  toggle.addEventListener('click', () => {
    const entry = toggle.closest('.entry');
    const open = !entry.classList.contains('is-previewing');
    document.querySelectorAll('.entry.is-previewing').forEach((other) => {
      if (other !== entry) setPreview(other, false);
    });
    setPreview(entry, open);
  });
});

function setPreview(entry, open) {
  entry.classList.toggle('is-previewing', open);
  entry.querySelector('.entry__toggle').setAttribute('aria-expanded', String(open));
}

/* ---------- Margin notes ---------- */

const notes = [...document.querySelectorAll('.note')];

function setNote(button, open) {
  button.setAttribute('aria-expanded', String(open));
  document.getElementById(button.getAttribute('aria-controls')).hidden = !open;
}

notes.forEach((button) => {
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = button.getAttribute('aria-expanded') !== 'true';
    notes.forEach((other) => { if (other !== button) setNote(other, false); });
    setNote(button, open);
  });
});

document.addEventListener('click', (event) => {
  if (event.target.closest('.note__card')) return;
  notes.forEach((button) => setNote(button, false));
  if (!event.target.closest('.entry')) {
    document.querySelectorAll('.entry.is-previewing').forEach((entry) => setPreview(entry, false));
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  notes.forEach((button) => setNote(button, false));
  document.querySelectorAll('.entry.is-previewing').forEach((entry) => setPreview(entry, false));
});

/* ---------- The HappyPEA pea ---------- */

const pea = document.querySelector('.pea');
const bubble = document.querySelector('.pea__bubble');
const peaLines = [
  'hi! I\'m the HappyPEA pea',
  'have you had water today?',
  'stretch break?',
  'you\'re doing great',
  'see you in 2027',
  'ok, that tickles',
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

const emailButton = document.querySelector('.contact__email');
const emailHint = emailButton.querySelector('.contact__hint');

emailButton.addEventListener('click', async () => {
  const email = emailButton.dataset.email;
  try {
    await navigator.clipboard.writeText(email);
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
  const heart = document.createElement('span');
  heart.className = 'float-heart';
  heart.setAttribute('aria-hidden', 'true');
  heart.textContent = '♥';
  emailButton.append(heart);
  heart.addEventListener('animationend', () => heart.remove());
  setTimeout(() => {
    emailHint.textContent = 'copy';
    emailButton.classList.remove('is-copied');
  }, 2200);
});

/* ---------- Portrait: tap to check vitals on touch screens ---------- */

const portrait = document.querySelector('.portrait');
portrait.addEventListener('click', () => portrait.classList.toggle('is-checked'));

/* ---------- The bacterium divides when poked ---------- */

const microbe = document.querySelector('.microbe');
const microbeLabel = document.querySelector('.microbe__label');
let microbeTimer;

microbe.addEventListener('click', () => {
  clearTimeout(microbeTimer);
  microbe.classList.add('is-dividing');
  microbeLabel.textContent = 'binary fission!';
  microbeTimer = setTimeout(() => {
    microbe.classList.remove('is-dividing');
    microbeLabel.textContent = 'poke me again';
  }, 2400);
});

/* ---------- HappyPEA phone: check off the day ---------- */

const phone = document.querySelector('.phone');
const pillars = [...phone.querySelectorAll('.pillar')];
const phoneDone = phone.querySelector('.phone__done');

pillars.forEach((pillar) => {
  pillar.addEventListener('click', () => {
    const on = pillar.getAttribute('aria-pressed') !== 'true';
    pillar.setAttribute('aria-pressed', String(on));
    const allDone = pillars.every((p) => p.getAttribute('aria-pressed') === 'true');
    phone.classList.toggle('is-complete', allDone);
    phoneDone.textContent = allDone ? 'nice work today!' : '';
  });
});

/* ---------- Replay the maze and the regression line ---------- */

function replay(art) {
  art.classList.remove('is-in');
  void art.getBoundingClientRect();
  markArt(art);
}

document.querySelectorAll('.maze, .scatter').forEach((art) => {
  art.addEventListener('click', () => replay(art));
  art.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      replay(art);
    }
  });
});

/* ---------- 300+ peas wave hello ---------- */

const peas = document.querySelector('.peas');
peas.addEventListener('click', () => {
  peas.classList.remove('is-waving');
  void peas.offsetWidth;
  peas.classList.add('is-waving');
});
peas.addEventListener('animationend', (event) => {
  if (event.target === peas.lastElementChild) peas.classList.remove('is-waving');
});

/* ---------- Band-aid on the Community title ---------- */

const bandaid = document.querySelector('.bandaid');
bandaid.addEventListener('click', () => {
  const peeled = bandaid.getAttribute('aria-pressed') !== 'true';
  bandaid.setAttribute('aria-pressed', String(peeled));
  bandaid.setAttribute('aria-label', peeled ? 'Put the bandage back' : 'Peel the bandage');
});
