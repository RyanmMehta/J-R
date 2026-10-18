/* ------------------------------------------------------------------
   Explain sheets: the interactive figures and the glossary terms.
   js/pages.js opens a sheet and calls prepareSheet() on its body.
   Each figure in a template names its builder here with data-fig.
   Figures that use example data say so in their captions; the rest
   use numbers from Jenna's papers or the studies they cite.
   ------------------------------------------------------------------ */

const SVG_NS = 'http://www.w3.org/2000/svg';
const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const canHover = window.matchMedia('(hover: hover)');

function svgEl(parent, tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text != null) node.textContent = text;
  parent?.append(node);
  return node;
}

function htmlEl(parent, tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text != null) node.textContent = text;
  parent?.append(node);
  return node;
}

// Marks one button of a group as chosen.
function choose(buttons, chosen) {
  buttons.forEach((button) => {
    const on = button === chosen;
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-pressed', String(on));
  });
}

// Calls draw(t) as t eases from 0 to 1. Returns a function that stops it.
function animate(duration, draw) {
  if (calmMotion.matches) { draw(1); return () => {}; }
  let frame;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    draw(1 - (1 - t) ** 3);
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

// A pointer position in an SVG's own coordinates.
function svgPoint(svg, clientX, clientY) {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  return point.matrixTransform(svg.getScreenCTM().inverse());
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const gauss = (x, mean, width) => Math.exp(-((x - mean) ** 2) / (2 * width * width));
const pathFrom = (points) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');

// Approximate color of a wavelength of visible light (nm).
function waveColor(nm) {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = (440 - nm) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = (645 - nm) / 65; }
  else r = 1;
  const fade = nm < 420 ? 0.3 + 0.7 * (nm - 380) / 40 : nm > 690 ? 0.3 + 0.7 * (780 - nm) / 90 : 1;
  const c = (v) => Math.round(255 * (v * fade) ** 0.8);
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

/* ---------- Glossary terms ----------
   <button class="term" data-def="…">word</button> in the text opens a
   small note under the word. One note shows at a time. */

function wireTerms(body, scroller) {
  const terms = [...body.querySelectorAll('.term')];
  if (!terms.length) return;
  const tip = htmlEl(body, 'div', { class: 'term-tip', role: 'tooltip', id: 'term-tip', hidden: '' });
  let current = null;

  const hide = () => {
    tip.hidden = true;
    current?.setAttribute('aria-expanded', 'false');
    current = null;
  };

  const show = (term) => {
    current?.setAttribute('aria-expanded', 'false');
    current = term;
    term.setAttribute('aria-expanded', 'true');
    tip.replaceChildren();
    htmlEl(tip, 'b', {}, term.dataset.word || term.textContent);
    htmlEl(tip, 'span', {}, term.dataset.def);
    tip.hidden = false;
    const box = scroller.getBoundingClientRect();
    const word = term.getBoundingClientRect();
    const left = clamp(word.left - box.left + word.width / 2 - tip.offsetWidth / 2, 12, scroller.clientWidth - tip.offsetWidth - 12);
    tip.style.left = `${left}px`;
    tip.style.top = `${word.bottom - box.top + scroller.scrollTop + 8}px`;
  };

  terms.forEach((term) => {
    term.setAttribute('aria-expanded', 'false');
    term.setAttribute('aria-describedby', 'term-tip');
    term.addEventListener('click', () => (current === term && !canHover.matches ? hide() : show(term)));
    term.addEventListener('mouseenter', () => { if (canHover.matches) show(term); });
    term.addEventListener('mouseleave', () => { if (canHover.matches) hide(); });
    term.addEventListener('blur', hide);
  });

  body.addEventListener('click', (event) => { if (!event.target.closest('.term')) hide(); });
}

function prepareSheet(body) {
  body.querySelectorAll('[data-fig]').forEach((fig) => FIGURES[fig.dataset.fig]?.(fig));
  wireTerms(body, body.closest('.deep__sheet'));
}

/* ---------- A list of steps that explain themselves ----------
   Used by the quality improvement cycle and the paper's framework. */

function stepThrough(fig) {
  const steps = [...fig.querySelectorAll('[data-text]')];
  const text = fig.querySelector('.walk__text');
  const back = fig.querySelector('[data-move="back"]');
  const next = fig.querySelector('[data-move="next"]');
  let at = 0;
  const show = (index) => {
    at = clamp(index, 0, steps.length - 1);
    choose(steps, steps[at]);
    steps.forEach((step, i) => step.classList.toggle('is-done', i < at));
    fig.style.setProperty('--at', at);
    fig.style.setProperty('--progress', at / (steps.length - 1));
    text.textContent = steps[at].dataset.text;
    if (back) back.disabled = at === 0;
    if (next) next.textContent = at === steps.length - 1 ? 'Start over' : 'Next →';
  };
  steps.forEach((step, i) => step.addEventListener('click', () => show(i)));
  back?.addEventListener('click', () => show(at - 1));
  next?.addEventListener('click', () => show(at === steps.length - 1 ? 0 : at + 1));
  show(0);
}

const FIGURES = {
  /* ================= Entry 01 · Goal-concordant care ================= */

  // Pick up to 3 goals and see how well 2 care plans fit them.
  goals(fig) {
    const GOALS = [
      { label: 'Live as long as possible', a: 0, b: 2 },
      { label: 'Be at home', a: 2, b: 0 },
      { label: 'Stay out of the ICU', a: 2, b: 0 },
      { label: 'Stay comfortable', a: 2, b: 1 },
      { label: 'Try every treatment', a: 0, b: 2 },
      { label: 'Time with family', a: 2, b: 1 },
    ];
    const PLANS = [
      { key: 'a', name: 'Comfort-focused plan', what: 'Hospice care at home, medicine for pain and other symptoms, no transfer to the ICU.' },
      { key: 'b', name: 'Treatment-focused plan', what: 'More cancer treatment, hospital and ICU care if needed, symptom care alongside.' },
    ];
    const MARKS = [
      { sign: '✕', word: "doesn't fit", cls: 'no' },
      { sign: '~', word: 'partly fits', cls: 'part' },
      { sign: '✓', word: 'fits', cls: 'yes' },
    ];

    const picks = fig.querySelector('.goals__picks');
    const plansBox = fig.querySelector('.goals__plans');
    const note = fig.querySelector('.goals__note');
    let chosen = [1, 3, 5];

    const chips = GOALS.map((goal, i) => {
      const chip = htmlEl(picks, 'button', { type: 'button', class: 'chip chip--goal', 'aria-pressed': 'false' }, goal.label);
      chip.addEventListener('click', () => {
        if (chosen.includes(i)) {
          if (chosen.length > 1) chosen = chosen.filter((n) => n !== i);
        } else {
          chosen = [...chosen, i].slice(-3);
        }
        render();
      });
      return chip;
    });

    const cards = PLANS.map((plan) => {
      const card = htmlEl(plansBox, 'div', { class: `plan plan--${plan.key}` });
      htmlEl(card, 'p', { class: 'plan__name' }, plan.name);
      htmlEl(card, 'p', { class: 'plan__what' }, plan.what);
      const meter = htmlEl(card, 'div', { class: 'plan__meter' });
      const fill = htmlEl(meter, 'span');
      const score = htmlEl(card, 'p', { class: 'plan__score' });
      const list = htmlEl(card, 'ul', { class: 'plan__rows' });
      return { plan, fill, score, list };
    });

    const render = () => {
      chips.forEach((chip, i) => {
        const on = chosen.includes(i);
        chip.classList.toggle('is-on', on);
        chip.setAttribute('aria-pressed', String(on));
      });
      const totals = cards.map(({ plan, fill, score, list }) => {
        const points = chosen.reduce((sum, i) => sum + GOALS[i][plan.key], 0);
        const share = points / (chosen.length * 2);
        fill.style.width = `${Math.max(4, share * 100)}%`;
        score.textContent = `Fits ${Math.round(share * 100)}% of your goals`;
        list.replaceChildren();
        chosen.forEach((i) => {
          const mark = MARKS[GOALS[i][plan.key]];
          const row = htmlEl(list, 'li', { class: `is-${mark.cls}` });
          htmlEl(row, 'span', { class: 'plan__mark', 'aria-hidden': 'true' }, mark.sign);
          htmlEl(row, 'span', {}, `${GOALS[i].label}: ${mark.word}`);
        });
        return share;
      });
      const [comfort, treatment] = totals;
      if (Math.abs(comfort - treatment) < 0.01) note.textContent = 'Both plans fit about equally. A conversation about what matters most would help here.';
      else note.textContent = `For these goals, the ${comfort > treatment ? 'comfort-focused' : 'treatment-focused'} plan is the goal-concordant one.`;
    };
    render();
  },

  // Waffle chart from Weeks et al. 2012.
  aware(fig) {
    const GROUPS = {
      lung: { pct: 69, name: 'lung cancer' },
      colorectal: { pct: 81, name: 'colorectal cancer' },
    };
    const waffle = fig.querySelector('.waffle');
    const number = fig.querySelector('.aware__num');
    const text = fig.querySelector('.aware__text');
    const buttons = [...fig.querySelectorAll('[data-group]')];
    const dots = Array.from({ length: 100 }, (_, i) => {
      const dot = htmlEl(waffle, 'i');
      dot.style.setProperty('--n', i);
      return dot;
    });
    let shown = 0;
    let stop = () => {};

    const show = (key) => {
      const { pct, name } = GROUPS[key];
      dots.forEach((dot, i) => dot.classList.toggle('is-on', i < pct));
      const from = shown;
      stop();
      stop = animate(900, (t) => {
        shown = Math.round(lerp(from, pct, t));
        number.textContent = shown;
      });
      text.textContent = `out of every 100 patients with stage 4 ${name} who were getting chemotherapy didn't report understanding that it was not at all likely to cure their cancer.`;
    };

    buttons.forEach((button) => button.addEventListener('click', () => { choose(buttons, button); show(button.dataset.group); }));
    choose(buttons, buttons[0]);
    requestAnimationFrame(() => show('lung'));
  },

  qi: stepThrough,

  /* ================= Entry 02 · Pain medicine ================= */

  // How long a cocaine metabolite stays above a urine screen's cutoff.
  window(fig) {
    const svg = fig.querySelector('svg');
    const slider = fig.querySelector('input[type="range"]');
    const readout = fig.querySelector('.window__read');
    const buttons = [...fig.querySelectorAll('[data-use]')];
    const X0 = 44, X1 = 324, Y0 = 156, Y1 = 22, DAYS = 6;
    const LOW = -1.4, HIGH = 3.6;
    const xAt = (day) => X0 + (day / DAYS) * (X1 - X0);
    const yAt = (level) => Y0 - ((level - LOW) / (HIGH - LOW)) * (Y0 - Y1);
    // log10 level in urine relative to the cutoff (0 = cutoff); shapes only
    const LEVELS = {
      single: (d) => (d < 0.25 ? lerp(LOW, 2.2, d / 0.25) : 2.2 - 0.6 * (d - 0.25)),
      heavy: (d) => (d < 0.25 ? lerp(LOW, 3.2, d / 0.25) : 3.2 - 0.4 * (d - 0.25)),
    };

    svgEl(svg, 'rect', { x: X0, y: Y1, width: X1 - X0, height: yAt(0) - Y1, class: 'window__zone' });
    svgEl(svg, 'text', { x: X1 - 6, y: Y1 + 14, class: 'window__zone-label', 'text-anchor': 'end' }, 'screen positive');
    svgEl(svg, 'text', { x: xAt(0.6), y: yAt(0) + 16, class: 'window__zone-label window__zone-label--neg' }, 'screen negative');
    svgEl(svg, 'path', { d: `M${X0} ${Y1 - 6}V${Y0}H${X1 + 6}`, class: 'axis' });
    for (let d = 0; d <= DAYS; d += 1) {
      svgEl(svg, 'path', { d: `M${xAt(d)} ${Y0}v4`, class: 'axis' });
      svgEl(svg, 'text', { x: xAt(d), y: Y0 + 16, class: 'tick' }, d);
    }
    svgEl(svg, 'text', { x: (X0 + X1) / 2, y: Y0 + 32, class: 'axis-label' }, 'days since last use');
    svgEl(svg, 'text', { x: 14, y: (Y0 + Y1) / 2, class: 'axis-label', transform: `rotate(-90 14 ${(Y0 + Y1) / 2})` }, 'level in urine (log scale)');
    svgEl(svg, 'path', { d: `M${X0} ${yAt(0)}H${X1}`, class: 'window__cutoff' });
    svgEl(svg, 'text', { x: X1, y: yAt(0) - 6, class: 'note', 'text-anchor': 'end' }, 'lab cutoff');

    const curves = {};
    for (const [key, level] of Object.entries(LEVELS)) {
      const points = [];
      for (let d = 0; d <= DAYS; d += 0.05) points.push([xAt(d), yAt(clamp(level(d), LOW, HIGH))]);
      curves[key] = svgEl(svg, 'path', { d: pathFrom(points), class: `window__curve window__curve--${key}`, pathLength: 1 });
    }
    const marker = svgEl(svg, 'path', { class: 'window__marker' });
    const dot = svgEl(svg, 'circle', { r: 5, class: 'window__dot' });

    let use = 'single';
    const render = () => {
      const day = Number(slider.value);
      const level = LEVELS[use](day);
      marker.setAttribute('d', `M${xAt(day)} ${Y1}V${Y0}`);
      dot.setAttribute('cx', xAt(day));
      dot.setAttribute('cy', yAt(clamp(level, LOW, HIGH)));
      const positive = level > 0;
      dot.classList.toggle('is-neg', !positive);
      const when = day === 0 ? 'Right after use' : `${day.toFixed(1)} days after use`;
      readout.textContent = `${when}: ${positive ? 'above the cutoff, so the screen would likely be positive.' : 'below the cutoff, so the screen would likely be negative.'}`;
    };
    buttons.forEach((button) => button.addEventListener('click', () => {
      choose(buttons, button);
      use = button.dataset.use;
      Object.entries(curves).forEach(([key, curve]) => curve.classList.toggle('is-on', key === use));
      render();
    }));
    curves.single.classList.add('is-on');
    choose(buttons, buttons[0]);
    slider.addEventListener('input', render);
    render();
  },

  // The 4 patients in the case series, as strands from therapy to outcome.
  cases(fig) {
    const CASES = [
      {
        who: 'A man with chronic knee pain after a total knee replacement',
        med: 'Hydrocodone/acetaminophen 10/325 mg, 4 times a day (about 40 MME a day)',
        screen: 'Cocaine on 2 screens, the first and a repeat',
        then: "Weaned off gradually. Full opioid therapy wasn't restarted.",
        y: [52, 86, 50],
      },
      {
        who: 'A man with chronic pain from spinal stenosis',
        med: 'Hydrocodone/acetaminophen 10/325 mg, 3 times a day (about 30 MME a day)',
        screen: 'Cocaine on a routine screen',
        then: 'Tapered gradually, then stopped.',
        y: [92, 106, 72],
      },
      {
        who: 'A man with rheumatoid arthritis and chronic pain',
        med: 'Hydrocodone/acetaminophen 10/325 mg, 4 times a day (about 40 MME a day)',
        screen: 'Cocaine on a screen',
        then: 'Hydrocodone stopped. Switched to buprenorphine/naloxone 2/0.5 mg twice a day.',
        y: [132, 126, 128],
      },
      {
        who: 'A woman with chronic pain after spine surgery and a history of substance misuse',
        med: 'Oxycodone 10 mg, 4 to 5 times a day (about 60 to 75 MME a day)',
        screen: 'Cocaine on a screen',
        then: 'Offered buprenorphine/naloxone. She declined and left the practice.',
        y: [172, 146, 178],
      },
    ];
    const X = [24, 128, 222];
    const svg = fig.querySelector('svg');
    const chipsBox = fig.querySelector('.cases__chips');
    const card = fig.querySelector('.cases__card');

    [['On opioids', X[0] - 6, 'start'], ['Positive screen', X[1], 'middle'], ['Outcome', X[2], 'start']].forEach(([label, x, anchor]) => {
      svgEl(svg, 'text', { x, y: 18, class: 'cases__head', 'text-anchor': anchor }, label);
    });

    const strands = CASES.map((c, i) => {
      const [a, b, d] = c.y;
      const midA = (X[0] + X[1]) / 2;
      const midB = (X[1] + X[2]) / 2;
      const path = svgEl(svg, 'path', {
        d: `M${X[0]} ${a}C${midA} ${a} ${midA} ${b} ${X[1]} ${b}C${midB} ${b} ${midB} ${d} ${X[2]} ${d}`,
        class: `cases__strand cases__strand--${i + 1}`,
      });
      path.addEventListener('mouseenter', () => { if (canHover.matches) show(i); });
      path.addEventListener('click', () => show(i));
      return path;
    });

    svgEl(svg, 'rect', { x: X[0] - 6, y: 36, width: 6, height: 152, rx: 3, class: 'cases__node' });
    svgEl(svg, 'rect', { x: X[1] - 3, y: 72, width: 6, height: 90, rx: 3, class: 'cases__node cases__node--screen' });
    [[38, 46, 'Tapered and stopped', '2 patients'], [118, 20, 'Switched to', 'buprenorphine/naloxone'], [166, 24, 'Declined the switch', 'and left the practice']].forEach(([y, h, line1, line2]) => {
      svgEl(svg, 'rect', { x: X[2], y, width: 6, height: h, rx: 3, class: 'cases__node' });
      const text = svgEl(svg, 'text', { x: X[2] + 14, y: y + h / 2 - 3, class: 'cases__out' });
      svgEl(text, 'tspan', { x: X[2] + 14 }, line1);
      svgEl(text, 'tspan', { x: X[2] + 14, dy: 15, class: 'cases__out-sub' }, line2);
    });

    const chips = CASES.map((c, i) => {
      const chip = htmlEl(chipsBox, 'button', { type: 'button', class: `chip chip--case chip--case-${i + 1}`, 'aria-pressed': 'false' }, `Case ${i + 1}`);
      chip.addEventListener('click', () => show(i));
      chip.addEventListener('mouseenter', () => { if (canHover.matches) show(i); });
      return chip;
    });

    const show = (i) => {
      choose(chips, chips[i]);
      strands.forEach((strand, n) => {
        strand.classList.toggle('is-on', n === i);
        strand.classList.toggle('is-dim', n !== i);
      });
      const c = CASES[i];
      card.replaceChildren();
      htmlEl(card, 'p', { class: 'cases__title' }, `Case ${i + 1}`);
      const list = htmlEl(card, 'dl');
      [['Patient', c.who], ['Opioid', c.med], ['Screen', c.screen], ['What happened', c.then]].forEach(([term, value]) => {
        const row = htmlEl(list, 'div');
        htmlEl(row, 'dt', {}, term);
        htmlEl(row, 'dd', {}, value);
      });
    };
    show(0);
  },

  // Full agonist versus partial agonist: buprenorphine's ceiling effect.
  agonist(fig) {
    const svg = fig.querySelector('svg');
    const slider = fig.querySelector('input[type="range"]');
    const readout = fig.querySelector('.agonist__read');
    const X0 = 44, X1 = 324, Y0 = 156, Y1 = 22;
    const full = (d) => 0.95 * d ** 1.1;
    // Same start as the full agonist, then leveling off toward the ceiling
    const partial = (d) => 0.4 * (1 - Math.exp(-full(d) / 0.4));
    const xAt = (d) => X0 + d * (X1 - X0);
    const yAt = (e) => Y0 - e * (Y0 - Y1);

    svgEl(svg, 'path', { d: `M${xAt(0)} ${yAt(0.4)}H${X1}`, class: 'agonist__ceiling' });
    svgEl(svg, 'text', { x: X1, y: yAt(0.4) - 6, class: 'note', 'text-anchor': 'end' }, 'ceiling');
    svgEl(svg, 'path', { d: `M${X0} ${Y1 - 6}V${Y0}H${X1 + 6}`, class: 'axis' });
    svgEl(svg, 'text', { x: (X0 + X1) / 2, y: Y0 + 22, class: 'axis-label' }, 'dose →');
    svgEl(svg, 'text', { x: 16, y: (Y0 + Y1) / 2, class: 'axis-label', transform: `rotate(-90 16 ${(Y0 + Y1) / 2})` }, 'slowing of breathing →');

    const line = (fn) => {
      const points = [];
      for (let d = 0; d <= 1.0001; d += 0.02) points.push([xAt(d), yAt(fn(d))]);
      return pathFrom(points);
    };
    svgEl(svg, 'path', { d: line(full), class: 'agonist__full', pathLength: 1 });
    svgEl(svg, 'path', { d: line(partial), class: 'agonist__partial', pathLength: 1 });
    svgEl(svg, 'text', { x: xAt(0.6), y: yAt(full(0.6)) - 12, class: 'agonist__name agonist__name--full', 'text-anchor': 'end' }, 'full agonist');
    svgEl(svg, 'text', { x: xAt(0.66), y: yAt(partial(0.66)) + 22, class: 'agonist__name agonist__name--partial' }, 'buprenorphine');
    const marker = svgEl(svg, 'path', { class: 'window__marker' });
    const dotFull = svgEl(svg, 'circle', { r: 5, class: 'agonist__dot agonist__dot--full' });
    const dotPartial = svgEl(svg, 'circle', { r: 5, class: 'agonist__dot agonist__dot--partial' });

    const render = () => {
      const d = Number(slider.value) / 100;
      marker.setAttribute('d', `M${xAt(d)} ${Y1}V${Y0}`);
      dotFull.setAttribute('cx', xAt(d));
      dotFull.setAttribute('cy', yAt(full(d)));
      dotPartial.setAttribute('cx', xAt(d));
      dotPartial.setAttribute('cy', yAt(partial(d)));
      if (d < 0.12) readout.textContent = 'At low doses the 2 kinds of opioid act about the same.';
      else if (d < 0.45) readout.textContent = 'As the dose rises, a full agonist keeps slowing breathing more. Buprenorphine starts to level off.';
      else readout.textContent = "At high doses a full agonist can stop breathing. Buprenorphine's effect has hit its ceiling and stays there.";
    };
    slider.addEventListener('input', render);
    render();
  },

  path: stepThrough,

  /* ================= Entry 03 · Pigments ================= */

  // Absorbance and glow of the 2 pigments over the visible spectrum.
  light(fig) {
    const normalize = (fn) => {
      let max = 0;
      for (let l = 400; l <= 700; l += 1) max = Math.max(max, fn(l));
      return (l) => fn(l) / max;
    };
    const PIGMENTS = {
      pc: {
        absorb: normalize((l) => gauss(l, 620, 28) + 0.2 * gauss(l, 585, 16)),
        emit: normalize((l) => gauss(l, 645, 14)),
        peaks: { room: 620, glow: 645 },
        room: 'Phycocyanin absorbs orange and red light, most strongly near 620 nm. The blue light it leaves behind is the color you see.',
        glow: 'Shine light on phycocyanin and it gives some of the energy back as deep red light, near 645 nm.',
      },
      pe: {
        absorb: normalize((l) => 0.5 * gauss(l, 498, 9) + 0.8 * gauss(l, 545, 9) + gauss(l, 565, 9)),
        emit: normalize((l) => gauss(l, 577, 10)),
        peaks: { room: 565, glow: 577 },
        room: 'Phycoerythrin absorbs green light, most strongly near 565 nm, with smaller peaks near 545 and 498 nm. The red and blue light left over looks pink.',
        glow: 'Phycoerythrin glows bright orange, near 577 nm. The glow is so bright that labs attach it to antibodies as a fluorescent tag.',
      },
    };
    const svg = fig.querySelector('svg');
    const vial = fig.querySelector('.vial');
    const text = fig.querySelector('.light__text');
    const read = fig.querySelector('.light__read');
    const pigmentButtons = [...fig.querySelectorAll('[data-pigment]')];
    const modeButtons = [...fig.querySelectorAll('[data-mode]')];
    const X0 = 30, X1 = 330, NM0 = 400, NM1 = 700;
    const xAt = (nm) => X0 + ((nm - NM0) / (NM1 - NM0)) * (X1 - X0);
    const nmAt = (x) => NM0 + ((x - X0) / (X1 - X0)) * (NM1 - NM0);
    const BAND_Y = 16, BAND_H = 26, PLOT_TOP = 64, PLOT_BOTTOM = 156;
    const yAt = (v) => PLOT_BOTTOM - v * (PLOT_BOTTOM - PLOT_TOP);

    const shades = [];
    for (let nm = NM0; nm < NM1; nm += 5) {
      svgEl(svg, 'rect', { x: xAt(nm), y: BAND_Y, width: xAt(nm + 5) - xAt(nm) + 0.4, height: BAND_H, fill: waveColor(nm + 2.5) });
      shades.push({ nm: nm + 2.5, rect: svgEl(svg, 'rect', { x: xAt(nm), y: BAND_Y, width: xAt(nm + 5) - xAt(nm) + 0.4, height: BAND_H, class: 'light__shade' }) });
    }
    svgEl(svg, 'rect', { x: X0, y: BAND_Y, width: X1 - X0, height: BAND_H, rx: 2, class: 'light__band-edge' });
    const bandNote = svgEl(svg, 'text', { x: X0, y: BAND_Y - 5, class: 'note' });
    svgEl(svg, 'path', { d: `M${X0} ${PLOT_BOTTOM}H${X1}`, class: 'axis' });
    for (const nm of [400, 500, 600, 700]) {
      svgEl(svg, 'path', { d: `M${xAt(nm)} ${PLOT_BOTTOM}v4`, class: 'axis' });
      svgEl(svg, 'text', { x: xAt(nm), y: PLOT_BOTTOM + 16, class: 'tick' }, nm === 700 ? '700 nm' : nm);
    }
    const area = svgEl(svg, 'path', { class: 'light__area' });
    const curve = svgEl(svg, 'path', { class: 'light__curve' });
    const peak = svgEl(svg, 'text', { class: 'note light__peak', 'text-anchor': 'middle' });
    const cross = svgEl(svg, 'path', { class: 'light__cross', d: '' });
    const hit = svgEl(svg, 'rect', { x: X0, y: BAND_Y, width: X1 - X0, height: PLOT_BOTTOM - BAND_Y, class: 'light__hit' });

    let pigment = 'pc';
    let mode = 'room';
    let shape = (nm) => PIGMENTS.pc.absorb(nm);
    let stop = () => {};

    const draw = (fn) => {
      const points = [];
      for (let nm = NM0; nm <= NM1; nm += 2) points.push([xAt(nm), yAt(fn(nm))]);
      curve.setAttribute('d', pathFrom(points));
      area.setAttribute('d', `${pathFrom(points)}L${X1} ${PLOT_BOTTOM}L${X0} ${PLOT_BOTTOM}Z`);
      shades.forEach(({ nm, rect }) => {
        const v = fn(nm);
        rect.setAttribute('opacity', mode === 'room' ? (v * 0.86).toFixed(3) : (0.9 - v * 0.9).toFixed(3));
      });
    };

    const render = () => {
      const p = PIGMENTS[pigment];
      const target = mode === 'room' ? p.absorb : p.emit;
      const from = shape;
      stop();
      stop = animate(600, (t) => {
        shape = (nm) => lerp(from(nm), target(nm), t);
        draw(shape);
      });
      const top = p.peaks[mode];
      peak.setAttribute('x', xAt(top));
      peak.setAttribute('y', yAt(1) - 8);
      peak.textContent = `${top} nm`;
      fig.dataset.pigment = pigment;
      fig.dataset.mode = mode;
      svg.classList.toggle('is-glow', mode === 'glow');
      bandNote.textContent = mode === 'room' ? 'white light in · dark = absorbed' : 'light given off';
      text.textContent = p[mode];
      vial.className = `vial vial--${pigment}${mode === 'glow' ? ' is-glow' : ''}`;
      read.textContent = 'Move across the spectrum to read it.';
    };

    hit.addEventListener('pointermove', (event) => {
      const { x } = svgPoint(svg, event.clientX, event.clientY);
      const nm = clamp(Math.round(nmAt(x)), NM0, NM1);
      const value = Math.round(shape(nm) * 100);
      cross.setAttribute('d', `M${xAt(nm)} ${BAND_Y}V${PLOT_BOTTOM}`);
      read.textContent = mode === 'room'
        ? `${nm} nm: absorbs ${value}% as much as at its peak`
        : `${nm} nm: glows at ${value}% of its brightest`;
    });
    hit.addEventListener('pointerleave', () => cross.setAttribute('d', ''));

    pigmentButtons.forEach((button) => button.addEventListener('click', () => { choose(pigmentButtons, button); pigment = button.dataset.pigment; render(); }));
    modeButtons.forEach((button) => button.addEventListener('click', () => { choose(modeButtons, button); mode = button.dataset.mode; render(); }));
    choose(pigmentButtons, pigmentButtons[0]);
    choose(modeButtons, modeButtons[0]);
    draw(shape);
    render();
  },

  // A phycobilisome passing absorbed light inward to photosystem II.
  antenna(fig) {
    const svg = fig.querySelector('svg');
    const button = fig.querySelector('[data-action="send"]');
    const text = fig.querySelector('.antenna__text');
    const legend = [...fig.querySelectorAll('.antenna__key li')];
    const CX = 180, CY = 150;
    const ANGLES = [198, 226, 254, 286, 314, 342];
    const DISTANCES = [36, 48, 60, 72, 84, 96];
    const at = (angle, d) => [CX + d * Math.cos((angle * Math.PI) / 180), CY + d * Math.sin((angle * Math.PI) / 180)];

    svgEl(svg, 'rect', { x: 10, y: 178, width: 340, height: 22, rx: 4, class: 'antenna__membrane' });
    svgEl(svg, 'text', { x: 18, y: 193, class: 'antenna__label' }, 'thylakoid membrane');
    svgEl(svg, 'rect', { x: 150, y: 170, width: 60, height: 38, rx: 8, class: 'antenna__psii' });
    svgEl(svg, 'text', { x: 180, y: 193, class: 'antenna__psii-label', 'text-anchor': 'middle' }, 'PSII');

    ANGLES.forEach((angle) => {
      DISTANCES.forEach((d, i) => {
        const [x, y] = at(angle, d);
        svgEl(svg, 'ellipse', {
          cx: x, cy: y, rx: 5.5, ry: 10.5,
          transform: `rotate(${angle} ${x} ${y})`,
          class: i < 3 ? 'antenna__pc' : 'antenna__pe',
          'data-stop': `${angle}-${i}`,
        });
      });
    });
    const core = [[CX - 12, CY + 8], [CX + 12, CY + 8], [CX, CY - 12]];
    core.forEach(([x, y]) => svgEl(svg, 'circle', { cx: x, cy: y, r: 12, class: 'antenna__apc' }));

    const ROD = 254;
    const tip = at(ROD, 96);
    const photon = svgEl(svg, 'path', {
      d: `M${tip[0] - 70} ${tip[1] - 46}q6 -8 12 0t12 0t12 0t12 0t12 0`,
      class: 'antenna__photon',
      transform: `rotate(33 ${tip[0] - 70} ${tip[1] - 46})`,
      pathLength: 1,
    });
    const spark = svgEl(svg, 'circle', { r: 7, class: 'antenna__spark', cx: tip[0], cy: tip[1], opacity: 0 });

    const HOPS = [
      { point: at(ROD, 96), key: 0, say: 'Phycoerythrin at the tip of a rod absorbs green light, near 565 nm.' },
      { point: at(ROD, 72), key: 0 },
      { point: at(ROD, 60), key: 1, say: 'It passes the energy to phycocyanin, which absorbs near 620 nm.' },
      { point: at(ROD, 36), key: 1 },
      { point: core[2], key: 2, say: 'Phycocyanin hands it to allophycocyanin in the core, near 650 nm.' },
      { point: [CX, 182], key: 3, say: 'The core passes it to chlorophyll in photosystem II, near 680 nm, which uses it to power photosynthesis.' },
    ];

    let timer = null;
    const light = (key) => legend.forEach((item, i) => item.classList.toggle('is-on', i === key));
    const run = () => {
      clearTimeout(timer);
      fig.classList.remove('is-sending');
      void fig.offsetWidth;
      fig.classList.add('is-sending');
      text.textContent = 'Green light arrives…';
      light(-1);
      spark.setAttribute('opacity', 0);
      let hop = 0;
      const next = () => {
        if (!fig.isConnected) return;
        if (hop >= HOPS.length) { button.textContent = 'Send in light again'; return; }
        const { point, key, say } = HOPS[hop];
        const [fromX, fromY] = hop ? HOPS[hop - 1].point : point;
        spark.setAttribute('opacity', 1);
        animate(hop ? 520 : 1, (t) => {
          spark.setAttribute('cx', lerp(fromX, point[0], t));
          spark.setAttribute('cy', lerp(fromY, point[1], t));
        });
        spark.setAttribute('class', `antenna__spark antenna__spark--${key}`);
        light(key);
        if (say) text.textContent = say;
        hop += 1;
        timer = setTimeout(next, say ? 1500 : 620);
      };
      timer = setTimeout(next, calmMotion.matches ? 0 : 750);
    };
    button.addEventListener('click', run);
  },

  // Purification: break the cells, salt out the pigment, check purity.
  steps(fig) {
    const STEPS = [
      {
        say: 'Freezing and thawing the cells over and over bursts them open. The pigment leaks out along with many other proteins, so the extract is colorful but messy.',
        purity: 0.5,
      },
      {
        say: 'Ammonium sulfate pulls water away from proteins, and different proteins drop out of solution at different salt levels. Adding it in steps lets us collect the part that holds the pigment and leave much of the rest behind.',
        purity: 1.6,
      },
      {
        say: 'We check purity 2 ways. An SDS-PAGE gel sorts proteins by size, so fewer bands means fewer other proteins. The purity ratio compares absorbance at the pigment\'s color peak (620 nm for phycocyanin) with absorbance at 280 nm, where all proteins absorb.',
        purity: 1.6,
      },
    ];
    const buttons = [...fig.querySelectorAll('[data-step]')];
    const text = fig.querySelector('.steps__text');
    const track = fig.querySelector('.purity__track');
    const value = fig.querySelector('.purity__value');
    const show = (i) => {
      choose(buttons, buttons[i]);
      fig.dataset.step = i;
      text.textContent = STEPS[i].say;
      track.style.setProperty('--v', STEPS[i].purity / 5);
      value.textContent = STEPS[i].purity.toFixed(1);
    };
    buttons.forEach((button, i) => button.addEventListener('click', () => show(i)));
    show(0);
  },

  // Colorfastness: how a phycocyanin-dyed swatch fades under each test.
  fade(fig) {
    const TESTS = {
      wash: { label: 'Washes', max: 20, unit: (v) => `${v} washes`, fade: (v) => 1 - Math.exp(-v / 14) },
      sun: { label: 'Hours in sunlight', max: 40, unit: (v) => `${v} hours of sun`, fade: (v) => 1 - Math.exp(-v / 25) },
      heat: { label: 'Temperature', max: 90, min: 25, unit: (v) => `${v} °C`, fade: (v) => (v < 40 ? 0 : 1 - Math.exp(-(v - 40) / 14)) },
    };
    const buttons = [...fig.querySelectorAll('[data-test]')];
    const slider = fig.querySelector('input[type="range"]');
    const label = fig.querySelector('.fade__label');
    const swatch = fig.querySelector('.fade__swatch:not(.fade__swatch--before)');
    const rating = fig.querySelector('.fade__rating');
    let test = 'wash';

    const setTest = (key) => {
      test = key;
      const t = TESTS[key];
      slider.min = t.min ?? 0;
      slider.max = t.max;
      slider.value = t.min ?? 0;
      slider.setAttribute('aria-label', t.label);
      render();
    };
    const render = () => {
      const t = TESTS[test];
      const v = Number(slider.value);
      const f = clamp(t.fade(v), 0, 1) * 0.88;
      swatch.style.setProperty('--fade', `${Math.round(f * 100)}%`);
      label.textContent = t.unit(v);
      const score = Math.max(1, Math.round((5 - f * 4.4) * 2) / 2);
      const words = score >= 4.5 ? 'little or no change' : score >= 3.5 ? 'slight change' : score >= 2.5 ? 'noticeable change' : 'severe change';
      rating.textContent = `Gray scale rating: ${String(score).replace('.5', '–' + Math.ceil(score))} (${words})`;
    };
    buttons.forEach((button) => button.addEventListener('click', () => { choose(buttons, button); setTest(button.dataset.test); }));
    slider.addEventListener('input', render);
    choose(buttons, buttons[0]);
    setTest('wash');
  },

  /* ================= Entry 04 · Splicing ================= */

  // The spliceosome assembling and cutting out an intron, step by step.
  spliceosome(fig) {
    const svg = fig.querySelector('svg');
    const title = fig.querySelector('.sp__title');
    const text = fig.querySelector('.sp__text');
    const back = fig.querySelector('[data-move="back"]');
    const next = fig.querySelector('[data-move="next"]');
    const play = fig.querySelector('[data-move="play"]');
    const pips = fig.querySelector('.sp__pips');

    const Y = 128;
    const N = 48;
    const INTRON = [118, 246];
    const BRANCH = Math.round(N * 0.74);
    const LOOP = { x: 196, y: 82, r: 30 };
    const linear = Array.from({ length: N }, (_, i) => [lerp(INTRON[0], INTRON[1], i / (N - 1)), Y]);
    const aStart = Math.atan2(Y - 8 - LOOP.y, linear[BRANCH][0] - LOOP.x);
    const branchSpot = [LOOP.x + LOOP.r * Math.cos(aStart), LOOP.y + LOOP.r * Math.sin(aStart)];
    const lariat = linear.map((point, i) => {
      if (i <= BRANCH) {
        const angle = aStart - (i / BRANCH) * Math.PI * 2;
        return [LOOP.x + LOOP.r * Math.cos(angle), LOOP.y + LOOP.r * Math.sin(angle)];
      }
      const t = (i - BRANCH) / (N - 1 - BRANCH);
      return [lerp(branchSpot[0], INTRON[1], t), lerp(branchSpot[1], Y, t ** 0.7)];
    });

    const intronGroup = svgEl(svg, 'g', { class: 'sp__intron' });
    const intron = svgEl(intronGroup, 'path', { class: 'sp__intron-line' });
    const labelGU = svgEl(intronGroup, 'text', { class: 'sp__site' }, 'GU');
    const labelA = svgEl(intronGroup, 'text', { class: 'sp__site sp__site--a' }, 'A');
    const labelAG = svgEl(intronGroup, 'text', { class: 'sp__site' }, 'AG');
    const exon1 = svgEl(svg, 'g', { class: 'sp__exon sp__exon--1' });
    svgEl(exon1, 'rect', { x: 28, y: Y - 13, width: 90, height: 26, rx: 6 });
    svgEl(exon1, 'text', { x: 73, y: Y + 4 }, 'Exon 1');
    const exon2 = svgEl(svg, 'g', { class: 'sp__exon sp__exon--2' });
    svgEl(exon2, 'rect', { x: 246, y: Y - 13, width: 90, height: 26, rx: 6 });
    svgEl(exon2, 'text', { x: 291, y: Y + 4 }, 'Exon 2');

    const PARTICLES = [
      ['u2', 'U2', 15], ['u5', 'U5', 15], ['u4', 'U4', 13], ['u6', 'U6', 13], ['u1', 'U1', 16],
    ];
    const parts = {};
    PARTICLES.forEach(([key, label, r]) => {
      const g = svgEl(svg, 'g', { class: `sp__snrnp sp__snrnp--${key}` });
      svgEl(g, 'circle', { r });
      svgEl(g, 'text', { y: 4 }, label);
      parts[key] = g;
    });

    // Positions are [x, y, opacity]. Off-stage particles wait above the RNA.
    const off = (x) => [x, -30, 0];
    const STAGES = [
      {
        title: 'The pre-mRNA',
        say: 'A fresh RNA copy of a gene still has its intron. Introns almost always start with GU and end with AG, and a key A near the end, the branch point, will matter later.',
        u1: off(120), u2: off(214), u4: off(150), u6: off(170), u5: off(250), loop: 0, join: 0,
      },
      {
        title: 'E complex: U1 grabs the 5′ splice site',
        say: 'U1 snRNP base-pairs with the first bases of the intron. Splicing can’t start until this happens, which is why U1 snRNP was the focus of my project.',
        u1: [120, Y - 30, 1], u2: off(214), u4: off(150), u6: off(170), u5: off(250), loop: 0, join: 0,
      },
      {
        title: 'A complex: U2 marks the branch point',
        say: 'U2 snRNP pairs with the stretch around the branch point A and pushes the A out, so it can react later.',
        u1: [120, Y - 30, 1], u2: [214, Y - 30, 1], u4: off(150), u6: off(170), u5: off(250), loop: 0, join: 0,
      },
      {
        title: 'B complex: U4, U6 and U5 arrive',
        say: 'A bigger particle carrying U4, U6 and U5 joins. Now all 5 snRNPs are on the RNA.',
        u1: [120, Y - 30, 1], u2: [214, Y - 30, 1], u4: [158, Y - 66, 1], u6: [170, Y - 40, 1], u5: [148, Y - 34, 1], loop: 0, join: 0,
      },
      {
        title: 'Activation: U1 and U4 leave',
        say: 'The machine rearranges. U1 and U4 let go, and U6 takes U1’s place at the 5′ splice site. The spliceosome is now ready to cut.',
        u1: [80, -20, 0], u2: [214, Y - 30, 1], u4: [158, -20, 0], u6: [126, Y - 30, 1], u5: [158, Y - 52, 1], loop: 0, join: 0,
      },
      {
        title: 'Cut 1: the lariat forms',
        say: 'The intron is cut from exon 1, and its GU end is joined to the branch point A. The intron loops back on itself into a shape called a lariat.',
        u1: [80, -20, 0], u2: [222, 70, 1], u4: [158, -20, 0], u6: [166, 58, 1], u5: [150, Y - 30, 1], loop: 1, join: 0,
      },
      {
        title: 'Cut 2: the exons join',
        say: 'Exon 1 is joined to exon 2, and the lariat is released and broken down. Once all its introns are out, the mRNA can leave the nucleus to be made into protein.',
        u1: [80, -20, 0], u2: [222, 10, 0], u4: [158, -20, 0], u6: [166, 0, 0], u5: [150, 20, 0], loop: 1, join: 1,
      },
    ];

    const pipButtons = STAGES.map((stage, i) => {
      const pip = htmlEl(pips, 'button', { type: 'button', class: 'sp__pip', 'aria-label': `Step ${i + 1}: ${stage.title}` });
      pip.addEventListener('click', () => { stopPlay(); go(i); });
      return pip;
    });

    let state = { ...STAGES[0] };
    let at = 0;
    let stopTween = () => {};
    let playing = null;

    const draw = (s) => {
      const lift = s.join * -60;
      const points = linear.map((p, i) => [lerp(p[0], lariat[i][0], s.loop), lerp(p[1], lariat[i][1], s.loop) + lift]);
      intron.setAttribute('d', pathFrom(points));
      intronGroup.setAttribute('opacity', 1 - s.join);
      const place = (label, [x, y], dy) => { label.setAttribute('x', x); label.setAttribute('y', y + dy); };
      place(labelGU, points[1], 22 - s.loop * 30);
      place(labelA, points[BRANCH], 22 - s.loop * 6);
      place(labelAG, points[N - 3], 22);
      exon1.setAttribute('transform', `translate(${s.join * 64} 0)`);
      exon2.setAttribute('transform', `translate(${s.join * -64} 0)`);
      for (const key of Object.keys(parts)) {
        const [x, y, o] = s[key];
        parts[key].setAttribute('transform', `translate(${x} ${y})`);
        parts[key].setAttribute('opacity', o);
      }
    };

    const mix = (a, b, t) => {
      const out = {};
      for (const key of ['loop', 'join']) out[key] = lerp(a[key], b[key], t);
      for (const key of Object.keys(parts)) out[key] = a[key].map((v, i) => lerp(v, b[key][i], t));
      return out;
    };

    const go = (index) => {
      at = clamp(index, 0, STAGES.length - 1);
      const from = state;
      const to = STAGES[at];
      stopTween();
      stopTween = animate(900, (t) => { state = mix(from, to, t); draw(state); });
      title.textContent = `${at + 1} · ${to.title}`;
      text.textContent = to.say;
      pipButtons.forEach((pip, i) => { pip.classList.toggle('is-on', i === at); pip.classList.toggle('is-done', i < at); });
      back.disabled = at === 0;
      next.textContent = at === STAGES.length - 1 ? 'Start over' : 'Next →';
    };

    const stopPlay = () => {
      clearInterval(playing);
      playing = null;
      play.textContent = 'Play';
      play.classList.remove('is-on');
    };

    back.addEventListener('click', () => { stopPlay(); go(at - 1); });
    next.addEventListener('click', () => { stopPlay(); go(at === STAGES.length - 1 ? 0 : at + 1); });
    play.addEventListener('click', () => {
      if (playing) { stopPlay(); return; }
      if (at === STAGES.length - 1) go(0);
      play.textContent = 'Pause';
      play.classList.add('is-on');
      playing = setInterval(() => {
        if (!fig.isConnected || at === STAGES.length - 1) { stopPlay(); return; }
        go(at + 1);
      }, 2600);
    });

    draw(state);
    go(0);
  },

  // Base pairing between the 5′ end of U1 snRNA and a 5′ splice site.
  pairing(fig) {
    const U1 = ['G', 'U', 'C', 'C', 'A', 'U', 'U', 'C', 'A'];
    const START = ['C', 'A', 'G', 'G', 'U', 'A', 'A', 'G', 'U'];
    const POSITIONS = ['−3', '−2', '−1', '+1', '+2', '+3', '+4', '+5', '+6'];
    const BASES = ['A', 'C', 'G', 'U'];
    const STRENGTH = { GC: 3, CG: 3, AU: 2, UA: 2, GU: 1, UG: 1 };
    const MAX = U1.reduce((sum, base, i) => sum + STRENGTH[base + START[i]], 0);

    const top = fig.querySelector('.pair__u1');
    const mid = fig.querySelector('.pair__bonds');
    const bottom = fig.querySelector('.pair__rna');
    const meter = fig.querySelector('.pair__meter span');
    const read = fig.querySelector('.pair__read');
    const reset = fig.querySelector('[data-action="reset"]');
    const shuffle = fig.querySelector('[data-action="shuffle"]');
    let site = [...START];

    U1.forEach((base) => htmlEl(top, 'span', { class: `base base--${base}` }, base));
    const bonds = U1.map(() => htmlEl(mid, 'span', { class: 'bond' }));
    const buttons = site.map((base, i) => {
      const button = htmlEl(bottom, 'button', { type: 'button', class: 'base base--button' });
      htmlEl(button, 'small', {}, POSITIONS[i]);
      htmlEl(button, 'b');
      button.addEventListener('click', () => {
        site[i] = BASES[(BASES.indexOf(site[i]) + 1) % 4];
        render();
      });
      return button;
    });

    const render = () => {
      let total = 0;
      let pairs = 0;
      site.forEach((base, i) => {
        const s = STRENGTH[U1[i] + base] || 0;
        total += s;
        if (s) pairs += 1;
        bonds[i].dataset.s = s;
        bonds[i].title = s === 3 ? 'G–C pair, 3 hydrogen bonds' : s === 2 ? 'A–U pair, 2 hydrogen bonds' : s === 1 ? 'G–U wobble pair, weaker' : 'no pair';
        buttons[i].className = `base base--button base--${base}${base !== START[i] ? ' is-changed' : ''}`;
        buttons[i].querySelector('b').textContent = base;
        buttons[i].setAttribute('aria-label', `Position ${POSITIONS[i]}: ${base}. Tap to change.`);
      });
      const share = total / MAX;
      meter.style.width = `${share * 100}%`;
      meter.parentElement.dataset.level = share > 0.8 ? 'high' : share > 0.5 ? 'mid' : 'low';
      let say = `${pairs} of 9 bases pair. `;
      if (share === 1) say += 'This is the textbook splice site, a perfect match for U1.';
      else if (share > 0.8) say += 'Close enough. Most real splice sites have a mismatch or 2, and U1C helps U1 hold on anyway.';
      else if (share > 0.5) say += 'A weak site. U1 binds less often, so this intron may be skipped or cut in the wrong place.';
      else say += 'Too few pairs. U1 would barely recognize this as the start of an intron.';
      if (site[3] !== 'G' || site[4] !== 'U') say += ' The GU at +1 and +2 is also needed by later steps, so changing it blocks splicing even if U1 binds.';
      read.textContent = say;
    };

    reset.addEventListener('click', () => { site = [...START]; render(); });
    shuffle.addEventListener('click', () => {
      site = site.map(() => BASES[Math.floor(Math.random() * 4)]);
      render();
    });
    render();
  },

  // The parts of U1 snRNP.
  u1(fig) {
    const PARTS = {
      end: "U1's 5′ end. These bases pair with the start of each intron, the 5′ splice site.",
      cap: 'A special cap, called a trimethylguanosine cap, added while U1 is being built. It helps bring the finished particle back into the nucleus.',
      loops: 'U1 snRNA is 164 nucleotides long in humans. It folds back on itself into 4 hairpins called stem-loops.',
      k70: 'U1-70K binds stem-loop 1 and connects U1 to other splicing proteins.',
      u1a: 'U1A binds stem-loop 2.',
      sm: 'The Sm ring: 7 Sm proteins that close into a ring around a short single-stranded stretch of U1 snRNA.',
      u1c: 'U1C is held in place mostly by U1-70K and the Sm ring. Its zinc finger touches the pairing between U1 and the splice site and steadies it. My mutations were in U1 snRNA at U1C’s binding site.',
    };
    const svg = fig.querySelector('svg');
    const text = fig.querySelector('.u1__text');
    const buttons = [...fig.querySelectorAll('[data-part]')];
    const Y = 156;

    const hairpin = (x, top, label, cls) => {
      const g = svgEl(svg, 'g', { class: `u1__loop ${cls || ''}`, 'data-part': 'loops' });
      svgEl(g, 'path', { d: `M${x - 9} ${Y}V${top + 9}a9 9 0 0 1 18 0V${Y}`, class: 'u1__rna' });
      for (let y = Y - 10; y > top + 10; y -= 9) svgEl(g, 'path', { d: `M${x - 9} ${y}h18`, class: 'u1__rung' });
      svgEl(g, 'text', { x, y: Y + 20, class: 'u1__tag' }, label);
      return g;
    };

    svgEl(svg, 'path', { d: `M38 ${Y}H342`, class: 'u1__rna' });
    const end = svgEl(svg, 'g', { 'data-part': 'end' });
    svgEl(end, 'path', { d: `M38 ${Y}H74`, class: 'u1__rna u1__rna--end' });
    svgEl(end, 'text', { x: 56, y: Y + 20, class: 'u1__tag' }, '5′ end');
    const cap = svgEl(svg, 'g', { 'data-part': 'cap' });
    svgEl(cap, 'circle', { cx: 28, cy: Y, r: 11, class: 'u1__cap' });
    svgEl(cap, 'text', { x: 28, y: Y + 4, class: 'u1__cap-label' }, 'm³G');
    hairpin(96, 40, 'SL1');
    hairpin(146, 62, 'SL2');
    hairpin(196, 52, 'SL3');
    const sm = svgEl(svg, 'g', { 'data-part': 'sm' });
    for (let i = 0; i < 7; i += 1) {
      const angle = (i / 7) * Math.PI * 2 - Math.PI / 2;
      svgEl(sm, 'circle', { cx: 248 + 17 * Math.cos(angle), cy: Y + 17 * Math.sin(angle), r: 7.5, class: 'u1__sm' });
    }
    svgEl(sm, 'text', { x: 248, y: Y + 40, class: 'u1__tag' }, 'Sm ring');
    hairpin(300, 92, 'SL4');
    svgEl(svg, 'text', { x: 350, y: Y + 4, class: 'u1__tag', 'text-anchor': 'start' }, '3′');

    const blob = (part, cx, cy, rx, ry, label) => {
      const g = svgEl(svg, 'g', { 'data-part': part, class: 'u1__protein' });
      svgEl(g, 'ellipse', { cx, cy, rx, ry });
      svgEl(g, 'text', { x: cx, y: cy + 4 }, label);
      return g;
    };
    svgEl(svg, 'path', { d: 'M60 108Q50 70 74 40', class: 'u1__arm' });
    blob('k70', 96, 30, 30, 15, 'U1-70K');
    blob('u1a', 146, 50, 22, 13, 'U1A');
    blob('u1c', 62, 120, 20, 13, 'U1C');

    const shapes = [...svg.querySelectorAll('[data-part]')];
    const show = (part) => {
      choose(buttons, buttons.find((b) => b.dataset.part === part));
      shapes.forEach((shape) => shape.classList.toggle('is-on', shape.dataset.part === part));
      svg.classList.add('has-pick');
      text.textContent = PARTS[part];
    };
    buttons.forEach((button) => {
      button.addEventListener('click', () => show(button.dataset.part));
      button.addEventListener('mouseenter', () => { if (canHover.matches) show(button.dataset.part); });
    });
    shapes.forEach((shape) => {
      shape.addEventListener('click', () => show(shape.dataset.part));
      shape.addEventListener('mouseenter', () => { if (canHover.matches) show(shape.dataset.part); });
    });
    show('u1c');
  },

  // How U1 snRNP is built: nucleus, cytoplasm, and back.
  journey(fig) {
    const STOPS = [
      { at: [90, 112], say: 'In the nucleus, RNA polymerase II copies the U1 gene into U1 snRNA.' },
      { at: [176, 96], say: 'The new RNA is exported through a nuclear pore into the cytoplasm.' },
      { at: [262, 70], say: 'In the cytoplasm, the SMN complex loads 7 Sm proteins into a ring around the RNA.' },
      { at: [300, 140], say: 'The cap is changed to a trimethylguanosine cap, and the 3′ end is trimmed.' },
      { at: [176, 160], say: 'The new cap and the Sm ring work as signals that bring the particle back into the nucleus.' },
      { at: [96, 172], say: 'Back in the nucleus, U1-70K, U1A and U1C join. The mature U1 snRNP is ready to start splicing.' },
    ];
    const svg = fig.querySelector('svg');
    const steps = [...fig.querySelectorAll('[data-stop]')];
    const text = fig.querySelector('.journey__text');
    const next = fig.querySelector('[data-move="next"]');

    svgEl(svg, 'rect', { x: 4, y: 8, width: 352, height: 204, rx: 26, class: 'journey__cell' });
    svgEl(svg, 'ellipse', { cx: 92, cy: 140, rx: 84, ry: 66, class: 'journey__nucleus' });
    svgEl(svg, 'text', { x: 30, y: 92, class: 'journey__label' }, 'nucleus');
    svgEl(svg, 'text', { x: 250, y: 30, class: 'journey__label' }, 'cytoplasm');
    svgEl(svg, 'path', { d: 'M168 104c-3-6-3-14 0-20M168 152c-3 6-3 14 0 20', class: 'journey__pore' });

    const route = 'M90 112C120 100 150 92 176 96S240 60 262 70S310 110 300 140S210 166 176 160S110 182 96 172';
    svgEl(svg, 'path', { d: route, class: 'journey__route' });
    const done = svgEl(svg, 'path', { d: route, class: 'journey__done', pathLength: 1 });
    STOPS.forEach(({ at }, i) => {
      svgEl(svg, 'circle', { cx: at[0], cy: at[1], r: 4, class: 'journey__stop' });
      svgEl(svg, 'text', { x: at[0], y: at[1] - 10, class: 'journey__num' }, i + 1);
    });
    const token = svgEl(svg, 'g', { class: 'journey__token' });
    svgEl(token, 'circle', { r: 11 });
    svgEl(token, 'text', { y: 4 }, 'U1');
    const sm = svgEl(token, 'circle', { r: 15, class: 'journey__ring' });

    const routePath = done;
    const total = routePath.getTotalLength();
    const lengthAt = STOPS.map(({ at }) => {
      let best = 0, bestGap = Infinity;
      for (let l = 0; l <= total; l += 2) {
        const p = routePath.getPointAtLength(l);
        const gap = (p.x - at[0]) ** 2 + (p.y - at[1]) ** 2;
        if (gap < bestGap) { bestGap = gap; best = l; }
      }
      return best;
    });

    let here = 0;
    let along = 0;
    let stop = () => {};
    const move = (to) => {
      const from = along;
      stop();
      stop = animate(900, (t) => {
        along = lerp(from, to, t);
        const p = routePath.getPointAtLength(along);
        token.setAttribute('transform', `translate(${p.x} ${p.y})`);
        done.style.strokeDashoffset = 1 - along / total;
      });
    };
    const show = (i) => {
      here = i;
      choose(steps, steps[i]);
      text.textContent = STOPS[i].say;
      sm.classList.toggle('is-on', i >= 2);
      token.classList.toggle('is-done', i === STOPS.length - 1);
      move(lengthAt[i]);
      next.textContent = i === STOPS.length - 1 ? 'Start over' : 'Next stop →';
    };
    steps.forEach((step, i) => step.addEventListener('click', () => show(i)));
    next.addEventListener('click', () => show(here === STOPS.length - 1 ? 0 : here + 1));
    show(0);
  },

  /* ================= Entry 05 · Regression ================= */

  // Drag the line to shrink the squares, then let least squares win.
  fit(fig) {
    const svg = fig.querySelector('svg');
    const yours = fig.querySelector('.fit__yours');
    const best = fig.querySelector('.fit__best');
    const button = fig.querySelector('[data-action="fit"]');
    const X0 = 40, X1 = 330, Y0 = 170, Y1 = 14;
    const xs = [52, 70, 88, 104, 120, 138, 156, 172, 190, 208, 228, 246, 266, 284, 304];
    const ys = [150, 141, 146, 128, 134, 120, 124, 108, 114, 98, 103, 86, 82, 70, 66];

    const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
    const mx = mean(xs), my = mean(ys);
    const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    const intercept = my - slope * mx;
    const bestLine = [intercept + slope * X0, intercept + slope * X1];
    const errorOf = ([a, b]) => xs.reduce((s, x, i) => {
      const fitY = a + ((b - a) * (x - X0)) / (X1 - X0);
      return s + (ys[i] - fitY) ** 2;
    }, 0);
    const bestError = errorOf(bestLine);

    svgEl(svg, 'path', { d: `M${X0} ${Y1}V${Y0}H${X1}`, class: 'axis' });
    svgEl(svg, 'text', { x: (X0 + X1) / 2, y: Y0 + 22, class: 'axis-label' }, 'one input, for example population density →');
    svgEl(svg, 'text', { x: 18, y: (Y0 + Y1) / 2, class: 'axis-label', transform: `rotate(-90 18 ${(Y0 + Y1) / 2})` }, 'cases →');
    const squares = xs.map(() => svgEl(svg, 'rect', { class: 'fit__square' }));
    const gaps = xs.map(() => svgEl(svg, 'path', { class: 'fit__gap' }));
    xs.forEach((x, i) => svgEl(svg, 'circle', { cx: x, cy: ys[i], r: 4.5, class: 'fit__point' }));
    const line = svgEl(svg, 'path', { class: 'fit__line' });
    const handles = [X0 + 4, X1 - 4].map((x, i) => {
      const g = svgEl(svg, 'g', { class: 'fit__handle', tabindex: '0', role: 'slider', 'aria-label': i ? 'Right end of the line' : 'Left end of the line' });
      svgEl(g, 'circle', { r: 22, class: 'fit__handle-hit' });
      svgEl(g, 'circle', { r: 7 });
      return g;
    });

    let ends = [my + 30, my - 20];
    let stop = () => {};
    const yAtX = (x) => ends[0] + ((ends[1] - ends[0]) * (x - X0)) / (X1 - X0);
    const render = () => {
      line.setAttribute('d', `M${X0} ${ends[0]}L${X1} ${ends[1]}`);
      handles.forEach((handle, i) => {
        handle.setAttribute('transform', `translate(${i ? X1 - 4 : X0 + 4} ${yAtX(i ? X1 - 4 : X0 + 4)})`);
        handle.setAttribute('aria-valuenow', Math.round(Y0 - ends[i]));
      });
      xs.forEach((x, i) => {
        const fitY = yAtX(x);
        const gap = ys[i] - fitY;
        const side = Math.abs(gap);
        gaps[i].setAttribute('d', `M${x} ${ys[i]}V${fitY}`);
        squares[i].setAttribute('x', x);
        squares[i].setAttribute('y', Math.min(ys[i], fitY));
        squares[i].setAttribute('width', side);
        squares[i].setAttribute('height', side);
      });
      const error = errorOf(ends);
      yours.textContent = Math.round(error / 10).toLocaleString();
      const close = error < bestError * 1.03;
      fig.classList.toggle('is-best', close);
      best.textContent = close ? 'That’s the least-squares line.' : `Best possible: ${Math.round(bestError / 10).toLocaleString()}`;
    };

    handles.forEach((handle, i) => {
      const dragTo = (clientY) => {
        const { y } = svgPoint(svg, 0, clientY);
        const target = clamp(y, Y1, Y0);
        // Move this end so the line passes through the pointer at the handle's x.
        const hx = i ? X1 - 4 : X0 + 4;
        const other = ends[1 - i];
        const otherX = i ? X0 : X1;
        const thisX = i ? X1 : X0;
        ends[i] = other + ((target - other) * (thisX - otherX)) / (hx - otherX);
        render();
      };
      handle.addEventListener('pointerdown', (event) => {
        stop();
        handle.setPointerCapture(event.pointerId);
        handle.classList.add('is-dragging');
        const onMove = (e) => dragTo(e.clientY);
        const onUp = () => {
          handle.classList.remove('is-dragging');
          handle.removeEventListener('pointermove', onMove);
          handle.removeEventListener('pointerup', onUp);
          handle.removeEventListener('pointercancel', onUp);
        };
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
        handle.addEventListener('pointercancel', onUp);
      });
      handle.addEventListener('keydown', (event) => {
        const step = event.shiftKey ? 10 : 3;
        if (event.key === 'ArrowUp') ends[i] -= step;
        else if (event.key === 'ArrowDown') ends[i] += step;
        else return;
        event.preventDefault();
        ends[i] = clamp(ends[i], Y1 - 40, Y0 + 40);
        render();
      });
    });

    button.addEventListener('click', () => {
      const from = [...ends];
      stop();
      stop = animate(1000, (t) => {
        ends = [lerp(from[0], bestLine[0], t), lerp(from[1], bestLine[1], t)];
        render();
      });
    });
    render();
  },

  // From raw county data to the final model, with the real R² at each stage.
  build(fig) {
    const STAGES = [
      { name: 'Collect', r2: null, say: 'I gathered total COVID-19 cases for every U.S. county from January 21, 2020 to June 29, 2021, using New York Times data. Then I added 12 possible factors from the Census Bureau, the CDC, the USDA, and the Department of Transportation.' },
      { name: 'Clean', r2: null, say: 'I removed U.S. territories and cases with no county listed (3.28% of the data), then counties more than 2.5 standard deviations from the average (1.24%). That left 2,662 counties. Each factor was rescaled so they could be compared fairly.' },
      { name: 'Split', r2: null, say: '80% of the counties were used to train the model. The other 20% were held back to test it on counties it had never seen.' },
      { name: 'First fit', r2: 52, say: 'The first model explained 52% of the variation in case counts between counties.' },
      { name: 'Trim', r2: 58, say: 'Average household size (p = 0.232) and the share of single-family homes (p = 0.356) weren’t statistically significant, so I removed them one at a time. R² rose to 58%.' },
      { name: 'Log', r2: 58, say: 'Case counts are very skewed: a few big counties have huge numbers. A log transform helped, but the model still failed 2 of the checks a linear regression has to pass.' },
      { name: 'Box-Cox', r2: 71, say: 'The Box-Cox method searched for the best transform (λ = −0.022). With it, the model passed all 5 checks and explained 71% of the variation.' },
    ];
    const tabs = fig.querySelector('.build__tabs');
    const grid = fig.querySelector('.build__dots');
    const ring = fig.querySelector('.build__ring');
    const number = fig.querySelector('.build__r2');
    const text = fig.querySelector('.build__text');
    const COUNT = 120;
    const dots = Array.from({ length: COUNT }, (_, i) => {
      const dot = htmlEl(grid, 'i');
      dot.style.setProperty('--n', i);
      return dot;
    });
    // About 4.5% of rows were dropped; spread the dropped ones around the grid.
    const dropped = new Set([7, 33, 58, 81, 104]);
    // A fixed 80/20 split, mixed so the test counties are spread out.
    const testSet = new Set(Array.from({ length: COUNT }, (_, i) => i).filter((i) => !dropped.has(i) && (i * 37) % 100 < 20));

    let shown = 0;
    let stop = () => {};
    const buttons = STAGES.map((stage, i) => {
      const button = htmlEl(tabs, 'button', { type: 'button', class: 'chip chip--small' }, `${i + 1} · ${stage.name}`);
      button.addEventListener('click', () => show(i));
      return button;
    });

    const show = (i) => {
      const stage = STAGES[i];
      choose(buttons, buttons[i]);
      text.textContent = stage.say;
      dots.forEach((dot, n) => {
        dot.classList.toggle('is-out', i >= 1 && dropped.has(n));
        dot.classList.toggle('is-train', i >= 2 && !dropped.has(n) && !testSet.has(n));
        dot.classList.toggle('is-test', i >= 2 && testSet.has(n));
      });
      fig.classList.toggle('has-split', i >= 2);
      const target = stage.r2 ?? 0;
      const from = shown;
      stop();
      stop = animate(900, (t) => {
        shown = lerp(from, target, t);
        ring.style.setProperty('--r2', shown / 100);
        number.textContent = stage.r2 == null ? '—' : `${Math.round(shown)}%`;
      });
    };
    show(0);
  },

  // Box-Cox: one slider reshapes a skewed histogram.
  boxcox(fig) {
    const svg = fig.querySelector('svg');
    const slider = fig.querySelector('input[type="range"]');
    const lambdaText = fig.querySelector('.bc__lambda');
    const skewText = fig.querySelector('.bc__skew');
    const presets = [...fig.querySelectorAll('[data-lambda]')];
    const X0 = 20, X1 = 340, Y0 = 150, Y1 = 14, BINS = 26;

    // Simulated, skewed "county counts": a log-normal sample with a fixed seed.
    let seed = 7;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const normal = () => Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
    const data = Array.from({ length: 900 }, () => Math.exp(7 + 1.4 * normal()));

    const boxcox = (y, lambda) => (Math.abs(lambda) < 1e-9 ? Math.log(y) : (y ** lambda - 1) / lambda);
    const skewness = (values) => {
      const m = values.reduce((a, b) => a + b, 0) / values.length;
      let m2 = 0, m3 = 0;
      for (const v of values) { m2 += (v - m) ** 2; m3 += (v - m) ** 3; }
      m2 /= values.length; m3 /= values.length;
      return m3 / m2 ** 1.5;
    };

    svgEl(svg, 'path', { d: `M${X0} ${Y0}H${X1}`, class: 'axis' });
    svgEl(svg, 'text', { x: (X0 + X1) / 2, y: Y0 + 20, class: 'axis-label' }, 'transformed case counts (rescaled) →');
    const bars = Array.from({ length: BINS }, () => svgEl(svg, 'rect', { class: 'bc__bar' }));
    const tail = svgEl(svg, 'text', { class: 'note', x: X1, y: Y1 + 10, 'text-anchor': 'end' });

    const render = () => {
      const lambda = Number(slider.value);
      const values = data.map((y) => boxcox(y, lambda));
      // Trim the most extreme 0.2% so a single county can't squash the picture.
      const sorted = [...values].sort((a, b) => a - b);
      const low = sorted[Math.floor(sorted.length * 0.001)];
      const high = sorted[Math.ceil(sorted.length * 0.999) - 1];
      const counts = new Array(BINS).fill(0);
      for (const v of values) counts[clamp(Math.floor(((v - low) / (high - low)) * BINS), 0, BINS - 1)] += 1;
      const peak = Math.max(...counts);
      const width = (X1 - X0) / BINS;
      bars.forEach((bar, i) => {
        const h = (counts[i] / peak) * (Y0 - Y1);
        bar.setAttribute('x', X0 + i * width + 1);
        bar.setAttribute('width', width - 2);
        bar.setAttribute('y', Y0 - h);
        bar.setAttribute('height', Math.max(0, h));
      });
      const skew = skewness(values);
      lambdaText.textContent = lambda.toFixed(3).replace(/\.?0+$/, '').replace('-', '−');
      skewText.textContent = skew.toFixed(2).replace('-', '−');
      fig.classList.toggle('is-even', Math.abs(skew) < 0.25);
      tail.textContent = skew > 1 ? 'long right tail' : Math.abs(skew) < 0.25 ? 'about symmetric' : skew < -1 ? 'long left tail' : '';
      presets.forEach((p) => p.classList.toggle('is-on', Math.abs(Number(p.dataset.lambda) - lambda) < 0.0005));
    };
    presets.forEach((preset) => preset.addEventListener('click', () => {
      const from = Number(slider.value);
      const to = Number(preset.dataset.lambda);
      animate(700, (t) => { slider.value = lerp(from, to, t); render(); });
    }));
    slider.addEventListener('input', render);
    render();
  },

  // The real weights (Table 3) and correlations (Table 4) from the paper.
  coef(fig) {
    const FACTORS = [
      { name: 'Homes in buildings with 20+ units', w: 2.0076, r: 0.514, say: 'Counties with more homes in large apartment buildings had more cases. This was the biggest weight in the model.' },
      { name: 'Population density', w: 1.343, r: 0.524, say: 'Denser counties had more cases, alone and in the model.' },
      { name: 'Rural-urban code (higher = more rural)', w: -1.1441, r: -0.287, say: 'More rural counties had fewer cases. By the model, a 0.1 step toward rural matched about 18.7% fewer cases.' },
      { name: 'Social Vulnerability Index', w: 1.02, r: 0.035, say: 'On its own, vulnerability barely tracked cases (r = 0.035). With the other factors held steady, it had one of the biggest weights: about 4.8% more cases per percentile.' },
      { name: 'Minority population', w: -0.5654, r: 0.213, say: 'On its own, a bigger minority population matched more cases (r = 0.21). In the model the sign flipped. The paper suggests this may come from counting total cases instead of cases per person.' },
      { name: 'Change in people staying home', w: 0.2261, r: 0.279, say: 'Counties where more people stayed home had more cases. The places with the strictest stay-at-home orders were often cities that already had high case counts.' },
      { name: 'Adults 65 and older', w: -0.1977, r: -0.188, say: 'Counties with more older adults had fewer total cases. After mid-2020, adults 18 to 29 had the highest case rates.' },
      { name: 'Poverty', w: -0.1167, r: -0.084, say: 'Higher poverty matched slightly fewer cases. Rural counties tend to have higher poverty rates and also had fewer cases.' },
      { name: 'Diabetes', w: 0.0895, r: -0.148, say: 'A small effect. In the model diabetes matched slightly more cases. On its own it matched slightly fewer.' },
      { name: 'Obesity (BMI over 30)', w: 0.0427, r: -0.196, say: 'A small effect. In the model obesity matched slightly more cases, about 4.2% more per percentage point by the paper’s estimate. On its own it matched slightly fewer.' },
    ];
    const MODES = {
      w: { max: 2.2, label: (v) => v.toFixed(2), axis: 'model weight', ticks: [-2, -1, 0, 1, 2] },
      r: { max: 0.6, label: (v) => v.toFixed(2), axis: 'correlation r', ticks: [-0.5, 0, 0.5] },
    };
    const chart = fig.querySelector('.coef__chart');
    const axis = fig.querySelector('.coef__axis');
    const read = fig.querySelector('.coef__read');
    const buttons = [...fig.querySelectorAll('[data-mode]')];
    let mode = 'w';

    const rows = FACTORS.map((factor, i) => {
      const row = htmlEl(chart, 'button', { type: 'button', class: 'coef__row' });
      htmlEl(row, 'span', { class: 'coef__name' }, factor.name);
      const track = htmlEl(row, 'span', { class: 'coef__track' });
      const bar = htmlEl(track, 'span', { class: 'coef__bar' });
      const value = htmlEl(row, 'span', { class: 'coef__value' });
      row.addEventListener('click', () => pickRow(i));
      row.addEventListener('mouseenter', () => { if (canHover.matches) pickRow(i); });
      return { row, bar, value };
    });

    const pickRow = (i) => {
      rows.forEach(({ row }, n) => row.classList.toggle('is-on', n === i));
      const f = FACTORS[i];
      read.replaceChildren();
      htmlEl(read, 'b', {}, f.name);
      htmlEl(read, 'span', {}, ` · weight ${f.w.toFixed(2)} · r = ${f.r.toFixed(2)}. `.replace(/-/g, '−'));
      htmlEl(read, 'span', {}, f.say);
    };

    const render = () => {
      const m = MODES[mode];
      rows.forEach(({ bar, value }, i) => {
        const v = FACTORS[i][mode];
        const share = Math.abs(v) / m.max / 2;
        bar.style.setProperty('--size', share);
        bar.classList.toggle('is-neg', v < 0);
        value.textContent = m.label(v).replace('-', '−');
      });
      axis.replaceChildren();
      m.ticks.forEach((t) => {
        const tick = htmlEl(axis, 'span', {}, String(t).replace('-', '−'));
        tick.style.setProperty('--x', 0.5 + t / m.max / 2);
      });
      axis.dataset.label = m.axis;
      fig.dataset.mode = mode;
    };

    buttons.forEach((button) => button.addEventListener('click', () => { choose(buttons, button); mode = button.dataset.mode; render(); }));
    choose(buttons, buttons[0]);
    render();
    pickRow(3);
  },
};
