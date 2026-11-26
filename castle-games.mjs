const skyNames = ['North', 'North-east', 'East', 'South-east', 'South', 'South-west', 'West', 'North-west'];
const moonNames = ['New', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
const tideNames = ['Low slack', 'Early flood', 'Mid flood', 'Late flood', 'High slack', 'Early ebb', 'Mid ebb', 'Late ebb'];
const rings = [
  { label: 'Sky', readings: skyNames, color: '#e2b570' },
  { label: 'Moon', readings: moonNames, color: '#aed2e5' },
  { label: 'Tide', readings: tideNames, color: '#a4c6a6' },
];
const chart = [
  { name: 'The West Passage', inscription: 'Set the sky toward the setting sun. The Moon must be half lit and still growing. Set the sea to the point where the high tide stops moving.', answer: [6, 2, 4] },
  { name: 'The Night Crossing', inscription: 'The needle points due north. The Moon is fully lit. The low tide has reached the point where the water stands still.', answer: [0, 4, 0] },
  { name: 'The Dawn Crossing', inscription: 'Turn to the rising sun. The Moon is half lit and shrinking. The water is exactly halfway through its incoming tide.', answer: [2, 6, 2] },
];
const stock = [
  { name: 'Silver dew', effects: [2, -2, 0] },
  { name: 'Moonleaf', effects: [1, -1, 1] },
  { name: 'Star shell', effects: [0, 0, 3] },
  { name: 'Cinder moss', effects: [-1, 2, 2] },
  { name: 'Copper clay', effects: [2, 1, 0] },
  { name: 'Glacier fern', effects: [1, -2, 0] },
];
const resources = ['Moisture', 'Warmth', 'Luminosity'];
const plants = [
  { name: 'Midnight bloom', first: [3, 7, 1], target: [6, 4, 5] },
  { name: 'Ember orchid', first: [4, 3, 2], target: [6, 5, 5] },
  { name: 'Winter fern', first: [2, 8, 2], target: [5, 4, 5] },
];

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function action(label, handle, style = 'outline') {
  const button = element('button', label, style);
  button.type = 'button';
  button.addEventListener('click', handle);
  return button;
}

function announce(node, message) { node.textContent = message; }
const cycle = value => (value % 8 + 8) % 8;
const pick = items => items[Math.floor(Math.random() * items.length)];
const equal = (a, b) => a.every((value, index) => value === b[index]);

function instrument(canvas, moves) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const display = moves.map(value => value);
  let frame = 0;

  function draw() {
    frame = 0;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(2, devicePixelRatio);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, width / 2, height / 2);
    ctx.clearRect(-width / 2, -height / 2, width, height);
    const r = Math.min(width * .25, height * .38);
    const sky = ctx.createRadialGradient(0, 0, r * .2, 0, 0, r * 2);
    sky.addColorStop(0, '#302e3a');
    sky.addColorStop(1, '#0b1019');
    ctx.fillStyle = sky;
    ctx.fillRect(-width / 2, -height / 2, width, height);
    const planet = ctx.createRadialGradient(-r * .16, -r * .2, 4, 0, 0, r * .37);
    planet.addColorStop(0, '#fff0c6');
    planet.addColorStop(.38, '#87c1ce');
    planet.addColorStop(.76, '#25516e');
    planet.addColorStop(1, '#102536');
    ctx.beginPath();
    ctx.arc(0, 0, r * .34, 0, Math.PI * 2);
    ctx.fillStyle = planet;
    ctx.fill();
    for (let i = rings.length - 1; i >= 0; i--) {
      const radius = r * (.63 + i * .26);
      const flattened = radius * [.41, .47, .55][i];
      ctx.save();
      ctx.rotate([-.42, .52, .04][i]);
      const brass = ctx.createLinearGradient(-radius, -flattened, radius, flattened);
      brass.addColorStop(0, '#5d452e');
      brass.addColorStop(.36, rings[i].color);
      brass.addColorStop(.72, '#9d7850');
      brass.addColorStop(1, '#e8cf8f');
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, flattened, 0, 0, 2 * Math.PI);
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = brass;
      ctx.stroke();
      const turn = display[i] * Math.PI / 4;
      for (let marker = 0; marker < 8; marker++) {
        const theta = Math.PI * marker / 4 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(radius * Math.cos(theta), flattened * Math.sin(theta), 2, 0, Math.PI * 2);
        ctx.fillStyle = '#d5b278';
        ctx.fill();
      }
      const px = radius * Math.cos(turn - Math.PI / 2);
      const py = flattened * Math.sin(turn - Math.PI / 2);
      const lamp = ctx.createRadialGradient(px - 2, py - 2, 1, px, py, 8);
      lamp.addColorStop(0, '#fff8da');
      lamp.addColorStop(.5, rings[i].color);
      lamp.addColorStop(1, '#574029');
      ctx.beginPath();
      ctx.arc(px, py, 6.9, 0, Math.PI * 2);
      ctx.fillStyle = lamp;
      ctx.fill();
      ctx.restore();
    }
  }

  function animate() {
    const moving = display.some((value, i) => Math.abs(moves[i] - value) > .004);
    display.forEach((value, i) => { display[i] = !moving || reduced.matches ? moves[i] : value + (moves[i] - value) * .16; });
    draw();
    if (moving && !reduced.matches) frame = requestAnimationFrame(animate);
  }
  const update = () => { if (!frame) frame = requestAnimationFrame(animate); };
  const resize = new ResizeObserver(update);
  resize.observe(canvas);
  update();
  return { update, destroy() { resize.disconnect(); cancelAnimationFrame(frame); } };
}

export function buildCastleActivity(container, type, { remember, finish, openQuiz, openCourtyard, animated }) {
  container.replaceChildren();
  finish(false);
  return type === 'orrery'
    ? buildOrrery(container, remember, finish, openQuiz, animated)
    : buildConservatory(container, remember, finish, openCourtyard);
}

function buildOrrery(container, remember, finish, openQuiz, animated) {
  const previous = remember('orrery');
  const task = pick(chart.filter(item => item.name !== previous));
  const panel = element('article', '', 'wing-panel orrery-panel');
  const controls = element('div', '', 'wing-controls');
  const feedback = element('p', '', 'form-status');
  feedback.setAttribute('role', 'status');
  const moves = [1, 3, 5];
  const outputs = [];
  let turns = 0;
  let solved = false;
  const canvas = element('canvas', '', 'orrery-instrument');
  canvas.setAttribute('aria-hidden', 'true');
  const meter = animated ? instrument(canvas, moves) : null;
  canvas.hidden = !meter;
  const compare = () => moves.map(cycle);
  function redraw() {
    outputs.forEach((target, index) => { target.value = rings[index].readings[cycle(moves[index])]; });
    meter?.update?.();
  }
  for (const [i, ring] of rings.entries()) {
    const row = element('div', '', 'wing-step');
    const current = element('output');
    const rotate = direction => {
      if (solved) return;
      moves[i] += direction;
      if (i < 2) moves[i + 1] += direction * (i + 1);
      if (moves.some(value => Math.abs(value) > 100)) moves.forEach((value, j) => { moves[j] = cycle(value % 8); });
      turns++;
      announce(feedback, '');
      redraw();
    };
    const previous = action('−', () => rotate(-1));
    const next = action('+', () => rotate(1));
    previous.setAttribute('aria-label', 'Turn ' + ring.label + ' ring backward');
    next.setAttribute('aria-label', 'Turn ' + ring.label + ' ring forward');
    current.setAttribute('aria-label', ring.label + ' setting');
    row.append(element('strong', ring.label), current, previous, next);
    controls.append(row);
    outputs.push(current);
  }
  const hint = element('details');
  hint.append(element('summary', 'Read the gear diagram'),
    element('p', 'The sky ring moves the moon one step. The moon ring moves the tide two steps. The tide ring moves on its own. Work from the outer ring in.'));
  const check = action('Test alignment', () => {
    if (equal(compare(), task.answer)) {
      solved = true;
      finish(true);
      remember('orrery', task.name);
      announce(feedback, 'The rings lock into place. ' + task.name + ' is charted in ' + turns + ' turns.');
      controls.querySelectorAll('button').forEach(button => { button.disabled = true; });
      check.disabled = true;
      return;
    }
    const matches = compare().flatMap((value, i) => value === task.answer[i] ? [rings[i].label] : []);
    announce(feedback, matches.length ? 'Aligned ' + matches.join(' and ') + '. The other rings still need adjustment.' : 'The pointer hasn’t locked. Compare all three rings with the chart.');
  }, 'brass');
  const buttons = element('div', '', 'wing-tools');
  buttons.append(check, action('Book quizzes', openQuiz));
  panel.append(element('h2', task.name), element('p', task.inscription), canvas, controls, buttons, feedback, hint);
  if (previous) panel.append(element('p', 'Last chart completed · ' + previous));
  container.append(panel);
  redraw();
  return { destroy: () => meter?.destroy?.() };
}

function buildConservatory(container, remember, finish, openCourtyard) {
  const previous = remember('garden');
  const plant = pick(plants.filter(item => item.name !== previous));
  const panel = element('article', '', 'wing-panel conservatory-panel');
  const form = element('form');
  const tray = element('ul', '', 'wing-ledger');
  const feedback = element('p', '', 'form-status');
  feedback.setAttribute('role', 'status');
  let solved = false;
  for (const ingredient of stock) {
    const row = element('li');
    const label = element('label', '', 'botanical-choice');
    const choice = element('input');
    choice.type = 'checkbox';
    choice.name = 'ingredient';
    choice.value = ingredient.name;
    const effects = ingredient.effects.map(amount => amount > 0 ? '+' + amount : String(amount));
    label.append(choice, element('strong', ingredient.name),
      element('span', effects.join(' / ')));
    row.append(label);
    tray.append(row);
  }
  const readings = element('p', '', 'botanical-readings');
  readings.setAttribute('aria-live', 'polite');
  const select = () => [...new FormData(form).getAll('ingredient')];
  const current = () => {
    const selected = new Set(select());
    return stock.filter(ingredient => selected.has(ingredient.name))
      .reduce((values, ingredient) => values.map((value, i) => value + ingredient.effects[i]), plant.first);
  };
  const show = () => {
    readings.textContent = current().map((value, i) => resources[i] + ' ' + value + ' / ' + plant.target[i]).join(' · ');
    if (!solved) announce(feedback, '');
  };
  const submit = element('button', 'Tend the plant', 'brass');
  submit.type = 'submit';
  const tools = element('div', '', 'wing-tools');
  tools.append(submit, action('Meet in the courtyard', async () => {
    if (await openCourtyard() === false) announce(feedback, 'Switch to cinematic mode to meet in the 3D courtyard.');
  }));
  form.append(tray, readings, tools, feedback);
  form.addEventListener('change', show);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (select().length !== 3) { announce(feedback, 'Choose exactly three ingredients.'); return; }
    const readings = current();
    if (!equal(readings, plant.target)) {
      announce(feedback, plant.target.flatMap((value, i) =>
        value === readings[i] ? [] : [resources[i] + ' is too ' + (readings[i] > value ? 'high' : 'low')]).join('. ') + '.');
      return;
    }
    solved = true;
    for (const choice of form.elements.ingredient) choice.disabled = true;
    submit.disabled = true;
    finish(true);
    remember('garden', plant.name);
    announce(feedback, 'The ' + plant.name.toLowerCase() + ' opened. Your recipe is recorded.');
  });
  panel.append(element('h2', 'Grow the ' + plant.name.toLowerCase()),
    element('p', 'Choose three ingredients to reach the plant’s required moisture, warmth, and luminosity. The ledger shows how each ingredient changes those readings, in that order.'), form);
  if (previous) panel.append(element('p', 'Last plant grown · ' + previous));
  container.append(panel);
  show();
  return {};
}
