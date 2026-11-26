import { levels, quizzes } from './academy-quiz.mjs?v=12';

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

export function academyActivities({ request, status, go, area, show, hide, active, storage, username }) {
  const app = document.getElementById('academy-activity');
  const feedback = document.getElementById('academy-feedback');
  const dialog = document.getElementById('academy-dialog');
  const tabs = [...dialog.querySelectorAll('[data-academy-tab]')];
  let tab = 'quiz';
  let lanterns = false;
  let waiting = '';
  let poll;
  let game;
  let generation = 0;
  let busy = false;

  const message = (text = '', error = false) => status(feedback, text, error);
  function receive(result) {
    lanterns = result.progress.lanterns;
    waiting = result.waiting;
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
  function coop() {
    app.append(node('h3', 'The Twin Lanterns'),
      node('p', 'Meet another member at Sunstone Court. Light the sun and moon lanterns within 45 seconds of each other.'));
    if (lanterns) app.append(node('p', 'Both lanterns lit. Co-op challenge completed.'));
    if (area() !== 'court') {
      if (area()) app.append(button('Go to Sunstone Court', () => { if (go('court')) hide(); }));
      else app.append(node('p', 'Enter the courtyard through the Conservatory to play together.'));
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
            message(lanterns ? 'Both lanterns lit. Challenge completed.' : 'Your lantern went out. Light it again when a partner is ready.');
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
    ({ coop, quiz })[tab]();
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
    reset() {
      generation++;
      clearTimeout(poll);
      lanterns = false;
      waiting = '';
      game = undefined;
      tab = 'quiz';
    },
  };
}
