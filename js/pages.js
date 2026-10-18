/* ------------------------------------------------------------------
   Things to do on the pages once the book has zoomed in: paper and
   poster previews, the timeline, the HappyPEA pea, copying the email,
   and the Explain sheets with their figures.
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
  sheetBody.querySelectorAll('[data-fig]').forEach((fig) => FIGURES[fig.dataset.fig]?.(fig));
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

/* ---------- The figures inside each explanation ---------- */

function pick(buttons, chosen) {
  buttons.forEach((button) => button.classList.toggle('is-on', button === chosen));
}

const FIGURES = {
  // Goals and care plan: the same 4 goals, met by one plan and missed by the other.
  goals(fig) {
    const buttons = [...fig.querySelectorAll('[data-plan]')];
    const rows = [...fig.querySelectorAll('.goals li')];
    const score = fig.querySelector('.goals__score');
    const show = (plan) => {
      let met = 0;
      rows.forEach((row) => {
        const item = row.querySelector('.goals__plan');
        item.textContent = item.dataset[plan];
        const missed = plan === 'b' && item.dataset.a !== item.dataset.b;
        row.classList.toggle('is-missed', missed);
        if (!missed) met += 1;
      });
      score.textContent = `${met} of ${rows.length} goals met`;
      score.classList.toggle('is-low', met < rows.length);
    };
    buttons.forEach((button) => button.addEventListener('click', () => { pick(buttons, button); show(button.dataset.plan); }));
  },

  // Monitoring loop: each step explains itself.
  loop(fig) {
    const steps = [...fig.querySelectorAll('.loop__step')];
    const text = fig.querySelector('.loop__text');
    const show = (step) => { pick(steps, step); text.textContent = step.dataset.text; };
    steps.forEach((step) => {
      step.addEventListener('click', () => show(step));
      step.addEventListener('mouseenter', () => show(step));
      step.addEventListener('focus', () => show(step));
    });
  },

  // Purification: the gel cleans up step by step.
  steps(fig) {
    const words = [
      'Freezing and thawing cracks the cells open, so the pigments leak out along with many other proteins.',
      'Adding ammonium sulfate in steps makes proteins fall out of solution at different points, so the pigment can be collected apart from most of the rest.',
      'A gel sorts proteins by size. Fewer, sharper bands mean a purer pigment.',
    ];
    const buttons = [...fig.querySelectorAll('[data-step]')];
    const text = fig.querySelector('.steps__text');
    fig.dataset.step = '0';
    buttons.forEach((button) => button.addEventListener('click', () => {
      pick(buttons, button);
      fig.dataset.step = button.dataset.step;
      text.textContent = words[Number(button.dataset.step)];
    }));
  },

  // Splicing: U1 marks the intron, then the intron loops out and the exons join.
  splice(fig) {
    fig.querySelector('[data-action="splice"]').addEventListener('click', () => fig.classList.add('is-spliced'));
    fig.querySelector('[data-action="reset"]').addEventListener('click', () => fig.classList.remove('is-spliced'));
  },

  // Regression: fit a line to example points and watch the squared error shrink.
  fit(fig) {
    const NS = 'http://www.w3.org/2000/svg';
    const xs = [45, 62, 80, 96, 112, 130, 148, 165, 182, 200, 220, 238, 256, 272];
    const ys = [128, 122, 126, 110, 114, 101, 104, 92, 95, 80, 84, 70, 66, 58];
    const pointsGroup = fig.querySelector('.fit__points');
    const residualGroup = fig.querySelector('.fit__residuals');
    const line = fig.querySelector('.fit__line');
    const errorText = fig.querySelector('.fit__error b');
    const button = fig.querySelector('[data-action="fit"]');

    const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
    const mx = mean(xs);
    const my = mean(ys);
    const slope = xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i] - my), 0) / xs.reduce((sum, x) => sum + (x - mx) ** 2, 0);
    const intercept = my - slope * mx;

    const residuals = xs.map((x, i) => {
      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', ys[i]);
      circle.setAttribute('r', 4);
      pointsGroup.append(circle);
      const gap = document.createElementNS(NS, 'line');
      gap.setAttribute('x1', x);
      gap.setAttribute('x2', x);
      gap.setAttribute('y1', ys[i]);
      residualGroup.append(gap);
      return gap;
    });

    // progress 0 is a flat line at the average; 1 is the least-squares fit
    let progress = 0;
    let frame = null;
    const render = () => {
      const at = (x) => my + progress * (intercept + slope * x - my);
      line.setAttribute('y1', at(30));
      line.setAttribute('y2', at(290));
      let error = 0;
      residuals.forEach((gap, i) => {
        gap.setAttribute('y2', at(xs[i]));
        error += (ys[i] - at(xs[i])) ** 2;
      });
      errorText.textContent = Math.round(error / 10).toLocaleString();
    };
    const animateTo = (goal) => {
      cancelAnimationFrame(frame);
      const from = progress;
      const start = performance.now();
      const duration = quietMotion.matches ? 1 : 1100;
      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - t) ** 3;
        progress = from + (goal - from) * eased;
        render();
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
      button.textContent = goal === 1 ? 'Start over' : 'Fit the line';
    };
    button.addEventListener('click', () => animateTo(progress > 0.5 ? 0 : 1));
    render();
  },
};
