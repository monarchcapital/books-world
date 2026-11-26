import { levels, quizzes } from './academy-quiz.mjs?v=12';

const runes = { root: 'Root', ink: 'Ink', star: 'Star' };
const notes = { ember: 'Ember', dew: 'Dew', leaf: 'Leaf', spark: 'Spark' };
const stops = [
  ['archives', 'The Archives', 'root'],
  ['west', 'West Stacks', 'ink'],
  ['court', 'Sunstone Court', 'star'],
];
const blank = { runes: [], observatory: false, lesson: false, lanterns: false };

function node(tag, label, css) {
  const element = document.createElement(tag);
  if (label) element.textContent = label;
  if (css) element.className = css;
  return element;
}
function button(text, action, style = 'outline') {
  const item = node('button', text, style);
  item.type = 'button';
  item.addEventListener('click', action);
  return item;
}
function row(...children) {
  const group = node('div', '', 'academy-options');
  group.append(...children);
  return group;
}
function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function academyActivities({ request, status, go, area, show, hide, active, unlock, storage, username }) {
  const app = document.getElementById('academy-activity');
  const feedback = document.getElementById('academy-feedback');
  const dialog = document.getElementById('academy-dialog');
  const tabs = [...dialog.querySelectorAll('[data-academy-tab]')];
  let tab = 'quest';
  let progress = blank;
  let waiting = '';
  let place = 'hall';
  let challenge;
  let recalling = false;
  let attempt = [];
  let sequence = [];
  let poll;
  let game;
  let generation = 0;
  let busy = false;

  const message = (text = '', error = false) => status(feedback, text, error);
  function receive(result) {
    progress = result.progress;
    waiting = result.waiting;
    unlock(progress.observatory);
  }
  async function sync() {
    const revision = generation;
    const result = await request('/api/academy');
    if (revision === generation) receive(result);
  }
  async function play(control, data, success, next) {
    if (busy) return;
    busy = true;
    if (control) control.disabled = true;
    message();
    const revision = generation;
    try {
      const result = await request('/api/academy', { method: 'POST', data });
      if (revision !== generation) return;
      receive(result);
      next?.(result);
      if (active()) render();
      message(typeof success === 'function' ? success(result) : success);
    } catch (error) {
      message(error.message, true);
    } finally {
      busy = false;
      if (control) control.disabled = false;
    }
  }
  function travel(target, reason = tab) {
    place = target;
    if (!go(target)) {
      tab = reason;
      message();
      render();
    } else hide();
  }
  function current() { return area() || place; }
  function collect(rune, control) {
    return play(control, { type: 'sigil', rune }, runes[rune] + ' sigil recorded.');
  }
  function quest() {
    const spots = stops.map(([id, name, rune]) => {
      if (progress.runes.includes(rune)) return node('span', name + ' · found');
      if (current() === id) return button('Inspect the ' + runes[rune].toLowerCase() + ' sigil', event => collect(rune, event.currentTarget));
      return button('Go to ' + name, () => travel(id, 'quest'));
    });
    app.append(node('h3', 'The Astronomer’s Lock'),
      node('p', 'Explore the Archives, West Stacks, and Sunstone Court to find the three sigils.'),
      row(...spots));
    if (progress.observatory) {
      app.append(node('p', 'The Hidden Observatory is unlocked.'), button('Enter the Observatory', () => travel('observatory'), 'brass'));
      return;
    }
    if (progress.runes.length < 3) return;
    app.append(node('p', 'The inscription shows how an astronomer worked. First a tree grew, then a journal was written, and last the heavens were mapped.'),
      node('p', sequence.length ? sequence.map(rune => runes[rune]).join(' → ') : 'Choose the sigils in order.', 'academy-sequence'),
      row(...Object.keys(runes).map(rune => {
        const item = button(runes[rune], () => { sequence.push(rune); message(); render(); });
        item.disabled = sequence.includes(rune);
        return item;
      }), button('Reset order', () => { sequence = []; message(); render(); })));
    const open = button('Try the lock', event => play(event.currentTarget,
      { type: 'unlock', order: sequence }, 'The Hidden Observatory is unlocked.', () => { sequence = []; }), 'brass');
    open.disabled = sequence.length !== 3;
    app.append(open);
  }
  function lesson() {
    app.append(node('h3', 'Lanternlight Lesson'),
      node('p', 'Study four spell notes, then repeat them in order.'),
      ...(progress.lesson ? [node('p', 'Lesson completed. You can practise again.')] : []));
    if (!challenge || !recalling) {
      if (challenge) app.append(node('p', challenge.notes.map(note => notes[note]).join(' → '), 'academy-sequence'),
        button('Hide notes and recall', () => { recalling = true; attempt = []; message(); render(); }, 'brass'));
      app.append(button(challenge ? 'New sequence' : 'Start lesson', event => play(event.currentTarget, { type: 'lesson-start' }, '', result => {
        challenge = result.challenge;
        recalling = false;
      }), challenge ? 'outline' : 'brass'));
      return;
    }
    app.append(node('p', attempt.length ? attempt.map(note => notes[note]).join(' → ') : 'Choose four spell notes.', 'academy-sequence'),
      row(...Object.keys(notes).map(note => {
        const item = button(notes[note], () => { attempt.push(note); message(); render(); });
        item.disabled = attempt.length >= challenge.notes.length;
        return item;
      })), row(button('Reset notes', () => { attempt = []; message(); render(); }),
      button('Study again', () => { recalling = false; message(); render(); })));
    const cast = button('Cast lanternlight', event => play(event.currentTarget, { type: 'lesson-answer', id: challenge.id, notes: attempt },
      'Lanternlight cast. Lesson completed.', () => { challenge = undefined; recalling = false; }), 'brass');
    cast.disabled = attempt.length !== challenge.notes.length;
    app.append(cast);
  }
  function coop() {
    app.append(node('h3', 'The Twin Lanterns'),
      node('p', 'Meet another member at Sunstone Court. Light the sun and moon lanterns within 45 seconds of each other.'));
    if (progress.lanterns) app.append(node('p', 'Both lanterns lit. Co-op challenge completed.'));
    if (area() !== 'court') {
      app.append(button('Go to Sunstone Court', () => travel('court', 'coop')));
      if (!area()) app.append(node('p', 'Open the 3D tour to play this challenge together.'));
      return;
    }
    if (waiting) app.append(node('p', 'Your ' + waiting + ' lantern is lit. Waiting for another member.', 'academy-sequence'));
    app.append(row(...['sun', 'moon'].map(side => button('Light the ' + side + ' lantern', event =>
      play(event.currentTarget, { type: 'lantern', side },
        result => result.matched ? 'Both lanterns lit. Challenge completed.' : 'Lantern lit for 45 seconds.', beginPolling)))));
  }
  function beginPolling() {
    clearTimeout(poll);
    if (active() && tab === 'coop' && waiting) {
      poll = setTimeout(async () => {
        try {
          const wasWaiting = waiting;
          await sync();
          if (!active() || tab !== 'coop') return;
          if (wasWaiting !== waiting) {
            render();
            message(progress.lanterns ? 'Both lanterns lit. Challenge completed.' : 'Your lantern went out. Light it again when a partner is ready.');
          }
        } catch (error) { if (active()) message(error.message, true); }
        beginPolling();
      }, 1800);
    }
  }

  const quizKey = series => 'formyria.quiz.' + username() + '.' + series;
  function quiz() {
    app.append(node('h3', 'Book quizzes'));
    if (!game) {
      app.append(node('p', 'Choose a series. Clear a round to unlock the next difficulty.'),
        row(...Object.keys(quizzes).map(series => button(series, () => {
          game = { series, max: Math.min(levels.length - 1, Number(storage(quizKey(series))) || 0) };
          message();
          render();
        }))));
      return;
    }
    const { series, level, index, score, answer } = game;
    app.append(node('p', series), button('Change series', () => { game = undefined; message(); render(); }));
    if (level == null) {
      app.append(row(...levels.map((name, difficulty) => {
        const item = button(name, () => {
          Object.assign(game, { level: difficulty, index: 0, score: 0, answer: null, choices: shuffled(quizzes[series][difficulty][0][1]) });
          message();
          render();
        });
        item.disabled = difficulty > game.max;
        return item;
      })));
      return;
    }
    const round = quizzes[series][level];
    app.append(node('p', levels[level] + (index < round.length ? ' · Question ' + (index + 1) + ' of ' + round.length : '')));
    if (index === round.length) {
      const passed = score === round.length;
      app.append(node('p', score + ' of ' + round.length + ' correct. ' +
        (passed ? level + 1 === levels.length ? 'Highest difficulty cleared.' : levels[level + 1] + ' unlocked.' : 'Try again to unlock the next level.')),
      button('Choose difficulty', () => { game.level = null; message(); render(); }, 'brass'));
      return;
    }
    const [question, options, source] = round[index];
    const correct = options[0];
    app.append(node('h3', question));
    const choices = node('div', '', 'academy-answers');
    for (const option of game.choices) {
      const item = button(option, () => {
        game.answer = option;
        if (option === correct) game.score++;
        render();
        message(option === correct ? 'Correct.' : 'The answer is ' + correct + '.', option !== correct);
      });
      if (answer != null) {
        item.disabled = true;
        if (option === correct) item.dataset.correct = 'true';
        if (option === answer && option !== correct) item.dataset.wrong = 'true';
      }
      choices.append(item);
    }
    app.append(choices);
    if (answer != null) app.append(node('p', 'Book reference · ' + source), button(index + 1 === round.length ? 'See result' : 'Next question', () => {
      game.index++;
      game.answer = null;
      if (game.index < round.length) game.choices = shuffled(round[game.index][1]);
      else if (game.score === round.length && level === game.max && level + 1 < levels.length) {
        game.max++;
        storage(quizKey(series), String(game.max));
      }
      message();
      render();
    }, 'brass'));
  }

  function render() {
    tabs.forEach(control => control.setAttribute('aria-pressed', String(control.dataset.academyTab === tab)));
    app.replaceChildren();
    ({ quest, lesson, coop, quiz })[tab]();
  }
  tabs.forEach(control => control.addEventListener('click', () => {
    tab = control.dataset.academyTab;
    message();
    render();
    beginPolling();
  }));
  dialog.addEventListener('close', () => clearTimeout(poll));

  return {
    async open(destination) {
      if (destination) tab = destination;
      show();
      message();
      render();
      try { await sync(); if (active()) render(); }
      catch (error) { if (active()) message(error.message, true); }
      beginPolling();
    },
    sync,
    collect,
    reset() {
      generation++;
      clearTimeout(poll);
      progress = blank;
      waiting = '';
      challenge = game = undefined;
      place = 'hall';
      tab = 'quest';
      attempt = [];
      sequence = [];
      recalling = false;
      unlock(false);
    },
  };
}
