const $ = selector => document.querySelector(selector);
const body = document.body;
const api = body.dataset.libraryApi;
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const compact = matchMedia('(max-width: 850px), (pointer: coarse)');
const state = { token: storage('sessionStorage', 'formyria-session'), account: null, mode: 'login', books: [], categories: new Map(), book: null };
const loginForm = $('#access-form');
const passwordForm = $('#password-form');
const accessStatus = $('#access-status');
const officeStatus = $('#office-status');
const catalogueStatus = $('#catalogue-status');
let tour;
let tourLoading;
let tourFailed = false;
let currentShelfBooks = [];
let aimedBook;
let roomSound;
let soundEnabled = false;

function showStop(place) {
  const names = { hall: 'The Grand Hall', west: 'West Stacks', east: 'East Gallery', archives: 'The Archives', desk: 'The Reading Desk', portrait: 'The Portrait Gallery' };
  $('#tour-room').textContent = names[place];
  $('#tour-instructions').textContent = {
    hall: 'Walk with W A S D, the arrow keys, or the on-screen arrows. Select a bookcase to approach it.',
    west: 'History, fiction, literature, philosophy and biography. Select a book by its spine.',
    east: 'Science, technology, business and finance. Select a book by its spine.',
    archives: 'Reference books and works awaiting classification. Select a book by its spine.',
    desk: 'Pick a book from a stack or the catalogue to bring it to the desk.',
    portrait: 'The framed portrait hangs at the far end of the hall.'
  }[place];
  for (const control of document.querySelectorAll('[data-stop]')) {
    if (control.dataset.stop === place) control.setAttribute('aria-current', 'location');
    else control.removeAttribute('aria-current');
  }
}

function showTour(visible) {
  $('#library-tour').hidden = !visible;
  $('.hall-hero').hidden = visible;
  $('#library').setAttribute('aria-labelledby', visible ? 'tour-room' : 'hall-title');
  tour?.setVisible(visible);
}

async function loadTour() {
  if (body.classList.contains('lightweight') || tourFailed || !state.account || state.account.rotate || $('#library').hidden) {
    showTour(false);
    return;
  }
  if (!tourLoading) {
    tourLoading = import('./library-tour.mjs').then(module => {
      tour = module.createLibraryTour({
        canvas: $('#tour-canvas'), message: $('#tour-book-label'), onStop: showStop, compact,
        onPick: book => openBook(book, true),
        onJourney(book) {
          const notice = $('#book-journey');
          notice.hidden = !book;
          notice.textContent = book ? 'Taking “' + book.title + '” to the desk…' : '';
          $('#wand-book').disabled = Boolean(book);
          $('#wand-target').hidden = Boolean(book);
        },
        getCover: async book => (await request(filePath(book, 'cover'), { raw: true })).blob(),
        getPortrait: async () => (await request('/api/art/portrait', { raw: true })).blob(),
        hasPortrait: available => { document.querySelectorAll('[data-stop="portrait"]').forEach(button => { button.hidden = !available; }); },
        onAim(book) {
          if (aimedBook?.id === book?.id) return;
          aimedBook = book;
          const button = $('#wand-book');
          button.hidden = !book;
          $('#wand-target').classList.toggle('locked', Boolean(book));
          if (book) button.replaceChildren(document.createTextNode(book.title), node('span', 'Open book'));
          else button.replaceChildren();
        },
        onPage(index, total, books) {
          currentShelfBooks = books;
          $('#shelf-books').hidden = $('#compact-shelf-books').hidden = books.length === 0;
          $('#tour-page').hidden = total < 2;
          $('#tour-page-label').textContent = 'Shelf ' + (index + 1) + ' of ' + total;
          $('#tour-prev').disabled = index === 0;
          $('#tour-next').disabled = index + 1 >= total;
          $('#compact-shelf-pages').hidden = total < 2;
          $('#compact-shelf-position').textContent = (index + 1) + ' of ' + total;
          $('#compact-shelf-prev').disabled = index === 0;
          $('#compact-shelf-next').disabled = index + 1 >= total;
          if ($('#shelf-dialog').open) setShelfChoices();
        }
      });
      tour.setAvatar(state.account?.avatar || (state.account?.role === 'admin' ? 'librarian' : 'member'));
      tour.setBooks(state.books);
    }).catch(error => {
      console.warn('The interactive tour could not start.', error.message);
      tourFailed = true;
    });
  }
  await tourLoading;
  if (state.account && !$('#library').hidden && !body.classList.contains('lightweight') && !tourFailed) showTour(true);
}

document.querySelectorAll('[data-stop]').forEach(control => {
  control.addEventListener('click', () => {
    control.closest('dialog')?.close();
    tour?.go(control.dataset.stop);
  });
});
$('#tour-canvas').addEventListener('tourunavailable', () => { tourFailed = true; showTour(false); });
$('#tour-prev').addEventListener('click', () => tour?.page(-1));
$('#tour-next').addEventListener('click', () => tour?.page(1));
$('#compact-shelf-prev').addEventListener('click', () => tour?.page(-1));
$('#compact-shelf-next').addEventListener('click', () => tour?.page(1));
$('#zoom-in').addEventListener('click', () => tour?.zoom(-8));
$('#zoom-out').addEventListener('click', () => tour?.zoom(8));
$('#wand-book').addEventListener('click', () => { if (aimedBook) goToReadingDesk(aimedBook); });
$('#map-menu-button').addEventListener('click', () => $('#tour-map-dialog').showModal());
$('#tour-menu-button').addEventListener('click', () => $('#tour-menu-dialog').showModal());
$('#walk-menu-button').addEventListener('click', event => {
  const visible = $('#library-tour').classList.toggle('walk-open');
  event.currentTarget.setAttribute('aria-pressed', String(visible));
  if (!visible) tour?.stopMoving();
});
for (const item of document.querySelectorAll('[data-drawer-close]')) {
  item.addEventListener('click', () => item.closest('dialog')?.close());
}
function setShelfChoices() {
  const dialog = $('#shelf-dialog');
  const choices = currentShelfBooks.map(book => {
    const button = node('button', book.title, 'outline');
    button.type = 'button';
    button.append(node('small', [book.author, book.format.toUpperCase()].filter(Boolean).join(' · ')));
    button.addEventListener('click', () => { dialog.close(); goToReadingDesk(book); });
    return button;
  });
  $('#shelf-dialog-list').replaceChildren(...choices);
}
function pickFromShelf() {
  setShelfChoices();
  if (currentShelfBooks.length) $('#shelf-dialog').showModal();
}
$('#shelf-books').addEventListener('click', pickFromShelf);
$('#compact-shelf-books').addEventListener('click', pickFromShelf);
document.querySelectorAll('[data-walk]').forEach(control => {
  let started = 0;
  let stop;
  const move = pressed => {
    control.setAttribute('aria-pressed', String(pressed));
    tour?.movement(control.dataset.walk, pressed);
  };
  control.addEventListener('pointerdown', event => {
    control.setPointerCapture(event.pointerId);
    clearTimeout(stop);
    started = performance.now();
    move(true);
  });
  control.addEventListener('pointerup', () => { stop = setTimeout(() => move(false), Math.max(0, 150 - (performance.now() - started))); });
  control.addEventListener('pointercancel', () => move(false));
  control.addEventListener('click', event => {
    if (event.detail !== 0) return;
    clearTimeout(stop);
    move(true);
    stop = setTimeout(() => move(false), 170);
  });
});
function setNight() {
  const night = $('#tour-light').getAttribute('aria-pressed') !== 'true';
  for (const control of [$('#tour-light'), $('#compact-light')]) {
    control.setAttribute('aria-pressed', String(night));
    control.textContent = night ? 'Day lighting' : 'Night lighting';
  }
  tour?.setLighting(night);
}
$('#tour-light').addEventListener('click', setNight);
$('#compact-light').addEventListener('click', setNight);

function makeRoomSound() {
  const graph = new AudioContext();
  const length = graph.sampleRate * 5;
  const buffer = graph.createBuffer(1, length, graph.sampleRate);
  const values = buffer.getChannelData(0);
  let sample = 0;
  for (let index = 0; index < length; index++) {
    sample = sample * .84 + (Math.random() * 2 - 1) * .16;
    const blend = Math.min(1, index / 1200, (length - 1 - index) / 1200);
    values[index] = sample * blend;
  }
  const loop = graph.createBufferSource();
  loop.buffer = buffer;
  loop.loop = true;
  const filter = graph.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 380;
  const volume = graph.createGain();
  volume.gain.value = .13;
  loop.connect(filter).connect(volume).connect(graph.destination);
  loop.start();
  return graph;
}

async function setAmbience(enabled) {
  if (!('AudioContext' in window)) return;
  try {
    if (enabled) {
      roomSound ??= makeRoomSound();
      await roomSound.resume();
    } else await roomSound?.suspend();
    soundEnabled = enabled;
    for (const control of document.querySelectorAll('[data-sound]')) control.setAttribute('aria-pressed', String(enabled));
  } catch { soundEnabled = false; }
}
document.querySelectorAll('[data-sound]').forEach(button => {
  button.hidden = !('AudioContext' in window);
  button.addEventListener('click', () => setAmbience(!soundEnabled));
});

function storage(type, key, value) {
  try {
    const store = window[type];
    if (value === undefined) return store.getItem(key);
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch { return null; }
}

function node(tag, text, css) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (css) element.className = css;
  return element;
}

function status(element, message = '', error = false) {
  element.textContent = message;
  element.dataset.error = String(error);
}

function setSession(token, account) {
  state.token = token;
  state.account = account;
  storage('sessionStorage', 'formyria-session', token);
  $('#sign-out').hidden = !token;
  $('#avatar-menu').hidden = account?.role !== 'member';
  $('#avatar-girl').hidden = $('#avatar-boy').hidden = account?.role !== 'member';
  $('#avatar-select').value = account?.avatar === 'girl' || account?.avatar === 'boy' ? account.avatar : 'member';
  if (account && tour) tour.setAvatar(account.avatar || (account.role === 'admin' ? 'librarian' : 'member'));
}

async function request(path, options = {}) {
  const { method = 'GET', data, body, raw = false, credential = true, signal, headers: extra = {} } = options;
  const headers = new Headers(extra);
  if (credential && state.token) headers.set('Authorization', 'Bearer ' + state.token);
  if (data !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(api + path, { method, headers, body: data === undefined ? body : JSON.stringify(data), cache: 'no-store', signal });
  if (raw && response.ok) return response;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'The library could not complete the request.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

function mode(next) {
  state.mode = next;
  loginForm.hidden = next === 'password';
  passwordForm.hidden = next !== 'password';
  $('#auth-tabs').hidden = next === 'password';
  $('#avatar-field').hidden = $('#avatar-field').disabled = next !== 'register';
  $('#login-tab').setAttribute('aria-pressed', String(next === 'login'));
  $('#register-tab').setAttribute('aria-pressed', String(next === 'register'));
  $('#gate-title').textContent = { login: 'Enter the library', register: 'Request membership', password: 'Change your initial password' }[next];
  $('#access-submit').firstChild.nodeValue = (next === 'register' ? 'Send membership request' : 'Unlock the doors') + ' ';
  const password = loginForm.elements.password;
  password.autocomplete = next === 'register' ? 'new-password' : 'current-password';
  password.minLength = next === 'register' ? 10 : 1;
  password.value = '';
  status(accessStatus, next === 'register' ? 'Choose a username and a password of at least 10 characters.' : next === 'password' ? 'Choose a new password before entering the library.' : '');
}

function closeLibrary(message = '') {
  setAmbience(false);
  if ($('#book-dialog').open) $('#book-dialog').close();
  if ($('#shelf-dialog').open) $('#shelf-dialog').close();
  if ($('#tour-map-dialog').open) $('#tour-map-dialog').close();
  if ($('#tour-menu-dialog').open) $('#tour-menu-dialog').close();
  setSession(null, null);
  state.books = [];
  state.categories.clear();
  tour?.setBooks([]);
  showTour(false);
  $('#shelf-display').replaceChildren();
  $('#member-list').replaceChildren();
  $('#office').hidden = true;
  $('#study').hidden = true;
  $('#study-books').replaceChildren();
  $('#office-button').hidden = true;
  $('#tour-office').hidden = true;
  $('#compact-office').hidden = true;
  $('#library').hidden = true;
  $('#entrance').hidden = false;
  $('#entrance').classList.remove('entering');
  mode('login');
  status(accessStatus, message);
}

async function enter(animate) {
  if (state.account.rotate) {
    mode('password');
    passwordForm.elements.currentPassword.focus();
    return;
  }
  const activeToken = state.token;
  const effect = animate && !motion.matches && !body.classList.contains('lightweight');
  if (effect) {
    $('#entrance').classList.add('entering');
    await new Promise(resolve => setTimeout(resolve, 1100));
  }
  if (state.token !== activeToken) return;
  $('#entrance').hidden = true;
  $('#library').hidden = false;
  $('.hall-hero').classList.toggle('arriving', effect);
  $('#hall-title').focus({ preventScroll: true });
  window.scrollTo(0, 0);
  $('#office-button').hidden = state.account.role !== 'admin';
  $('#tour-office').hidden = state.account.role !== 'admin';
  $('#compact-office').hidden = state.account.role !== 'admin';
  await Promise.all([loadCatalogue(), loadTour(), state.account.role === 'admin' && loadNotifications()]);
}

async function submit(form, task) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  status(accessStatus, 'Checking the library entrance…');
  try { await task(Object.fromEntries(new FormData(form))); }
  catch (error) { status(accessStatus, error.message, true); }
  finally { button.disabled = false; }
}

$('#login-tab').addEventListener('click', () => mode('login'));
$('#register-tab').addEventListener('click', () => mode('register'));
async function chooseAvatar(avatar) {
  const select = $('#avatar-select');
  if (avatar === 'member') { select.value = state.account?.avatar || 'member'; return; }
  select.disabled = true;
  try {
    const result = await request('/api/auth/avatar', { method: 'PATCH', data: { avatar } });
    setSession(state.token, result.account);
  } catch (error) {
    select.value = state.account?.avatar || 'member';
    status(catalogueStatus, error.message, true);
  } finally { select.disabled = false; }
}
$('#avatar-select').addEventListener('change', event => chooseAvatar(event.currentTarget.value));
document.querySelectorAll('[data-avatar-choice]').forEach(button => button.addEventListener('click', () => {
  button.closest('dialog').close();
  chooseAvatar(button.dataset.avatarChoice);
}));
loginForm.addEventListener('submit', event => {
  event.preventDefault();
  const accessMode = state.mode;
  submit(loginForm, async data => {
    const result = await request('/api/auth/' + accessMode, { method: 'POST', data, credential: false });
    if (result.membership) {
      mode('login');
      const messages = {
        pending: accessMode === 'register' ? 'Membership requested. You can sign in after Ria approves your account.' : 'Your request is waiting for Ria’s approval.',
        rejected: 'Your membership request was declined.',
        suspended: 'Your membership is suspended.',
        revoked: 'Your membership has been revoked.'
      };
      status(accessStatus, messages[result.membership]);
      return;
    }
    loginForm.elements.password.value = '';
    status(accessStatus);
    setSession(result.token, result.account);
    await enter(true);
  });
});
passwordForm.addEventListener('submit', event => {
  event.preventDefault();
  submit(passwordForm, async data => {
    const result = await request('/api/auth/password', { method: 'POST', data });
    passwordForm.reset();
    setSession(result.token, result.account);
    status(accessStatus);
    await enter(true);
  });
});
$('#sign-out').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try { await request('/api/auth/logout', { method: 'POST' }); }
  catch (error) {
    if (error.status !== 401 && error.status !== 403) {
      button.disabled = false;
      button.textContent = 'Retry sign out';
      return;
    }
  }
  closeLibrary('You signed out.');
  button.textContent = 'Sign out';
  button.disabled = false;
});

function setLightweight(enabled) {
  body.classList.toggle('lightweight', enabled);
  $('#lightweight').setAttribute('aria-pressed', String(enabled));
  $('#lightweight').textContent = compact.matches ? (enabled ? '3D tour' : 'Lightweight') : (enabled ? 'Cinematic mode' : 'Lightweight mode');
}
setLightweight(storage('localStorage', 'formyria-lightweight') === 'true');
compact.addEventListener('change', () => setLightweight(body.classList.contains('lightweight')));
$('#lightweight').addEventListener('click', () => {
  const enabled = !body.classList.contains('lightweight');
  storage('localStorage', 'formyria-lightweight', String(enabled));
  setLightweight(enabled);
  loadTour();
});

async function loadCatalogue() {
  status(catalogueStatus, 'Opening the catalogue…');
  try {
    const result = await request('/api/catalog');
    if (!state.account) return;
    state.books = result.books;
    tour?.setBooks(state.books);
    state.categories = new Map(result.categories.map(category => [category.id, category.name]));
    const select = $('#genre-filter');
    select.replaceChildren(new Option('All genres', ''));
    for (const [id, name] of [...state.categories].sort((a, b) => a[1].localeCompare(b[1]))) select.add(new Option(name, id));
    renderShelves();
  } catch (error) {
    if (error.status === 401 || error.status === 403) closeLibrary(error.message);
    else status(catalogueStatus, error.message, true);
  }
}

function renderShelves() {
  const words = $('#book-search').value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const genre = $('#genre-filter').value;
  const format = $('#format-filter').value;
  const books = state.books.filter(book => {
    if ((genre && book.genre !== genre) || (format && book.format !== format)) return false;
    const text = [book.title, book.author, state.categories.get(book.genre), book.subgenre, ...(book.tags || [])].join(' ').toLocaleLowerCase();
    return words.every(word => text.includes(word));
  });
  const results = document.createDocumentFragment();
  for (const book of books) {
    const button = node('button', book.title, 'spine');
    button.type = 'button';
    button.append(node('small', [book.author, book.format.toUpperCase()].filter(Boolean).join(' · ')));
    button.addEventListener('click', () => goToReadingDesk(book));
    results.append(button);
  }
  $('#shelf-display').replaceChildren(results);
  const message = books.length ? `${books.length} ${books.length === 1 ? 'book' : 'books'}` : state.books.length ? 'No books match those filters.' : 'No books have been added to the private shelves yet.';
  status(catalogueStatus, message);
}
$('#book-search').addEventListener('input', renderShelves);
$('#genre-filter').addEventListener('change', renderShelves);
$('#format-filter').addEventListener('change', renderShelves);

async function loadNotifications() {
  if (state.account?.role !== 'admin') return;
  try {
    const { unread } = await request('/api/admin/notifications');
    for (const counter of [$('#notification-count'), $('#tour-notifications')]) {
      counter.hidden = unread === 0;
      counter.textContent = String(unread);
      counter.setAttribute('aria-label', unread + ' unread membership requests');
    }
    $('#mark-read').disabled = unread === 0;
  } catch (error) {
    if (!$('#office').hidden) status(officeStatus, error.message, true);
  }
}
setInterval(() => { if (!document.hidden) loadNotifications(); }, 45_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadNotifications(); });

async function updateMember(member, data, control) {
  control.disabled = true;
  try {
    await request('/api/admin/members/' + encodeURIComponent(member.username), { method: 'PATCH', data });
    await loadMembers();
  } catch (error) {
    status(officeStatus, error.message, true);
    if (control.type === 'checkbox') control.checked = !control.checked;
  } finally { control.disabled = false; }
}

async function loadMembers() {
  status(officeStatus, 'Opening the membership register…');
  try {
    const result = await request('/api/admin/members');
    if (state.account?.role !== 'admin') return;
    const people = result.members.filter(member => member.role === 'member').sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || a.username.localeCompare(b.username));
    const rows = people.map(member => {
      const row = node('article', '', 'member-row');
      const info = node('div');
      info.append(node('h3', member.username), node('p', member.status));
      const controls = node('div', '', 'member-controls');
      const choices = {
        pending: [['Approve', 'approved'], ['Reject', 'rejected']],
        approved: [['Suspend', 'suspended'], ['Revoke', 'revoked']],
        suspended: [['Restore', 'approved'], ['Revoke', 'revoked']],
        rejected: [['Approve', 'approved']],
        revoked: [['Restore', 'approved']]
      };
      for (const [label, next] of choices[member.status]) {
        const button = node('button', label, 'outline');
        button.type = 'button';
        button.addEventListener('click', () => updateMember(member, { status: next }, button));
        controls.append(button);
      }
      if (member.status === 'approved') {
        for (const [label, key] of [['Read', 'readBooks'], ['Download', 'downloadBooks']]) {
          const wrapper = node('label');
          const checkbox = node('input');
          checkbox.type = 'checkbox';
          checkbox.checked = member[key];
          checkbox.addEventListener('change', () => updateMember(member, { [key]: checkbox.checked }, checkbox));
          wrapper.append(checkbox, label);
          controls.append(wrapper);
        }
      }
      row.append(info, controls);
      return row;
    });
    $('#member-list').replaceChildren(...rows);
    status(officeStatus, people.length ? '' : 'No membership requests yet.');
  } catch (error) { status(officeStatus, error.message, true); }
}

function openOffice() {
  $('#office').hidden = false;
  $('#office-title').focus({ preventScroll: true });
  $('#office').scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth' });
  Promise.all([loadMembers(), loadNotifications()]);
  import('./admin-office.mjs').then(module => module.openCollectionOffice({ request, loadCatalogue })).catch(error => status(officeStatus, error.message, true));
}
$('#office-button').addEventListener('click', openOffice);
$('#tour-office').addEventListener('click', openOffice);
$('#compact-office').addEventListener('click', openOffice);
$('#mark-read').addEventListener('click', async () => {
  try {
    await request('/api/admin/notifications', { method: 'POST' });
    await loadNotifications();
  } catch (error) { status(officeStatus, error.message, true); }
});

let studyBooks = [];
function displayStudy() {
  const mode = $('#study-filter').value;
  const available = new Map(state.books.map(book => [book.id, book]));
  const matches = studyBooks.filter(item => available.has(item.id) &&
    (mode === 'recent' ? Boolean(item.readAt) : mode === 'saved' ? item.favorite : item.collections.length));
  const results = matches.map(item => {
    const book = available.get(item.id);
    const button = node('button', book.title, 'spine');
    button.type = 'button';
    const label = mode === 'collections' ? item.collections.join(' · ') : mode === 'recent' ? 'Page ' + item.page + ' of ' + item.total : book.author;
    button.append(node('small', label || book.format.toUpperCase()));
    button.addEventListener('click', () => goToReadingDesk(book));
    return button;
  });
  $('#study-books').replaceChildren(...results);
  status($('#study-status'), results.length ? results.length + (results.length === 1 ? ' book' : ' books') : 'No books in this view yet.');
}

async function openStudy() {
  $('#study').hidden = false;
  status($('#study-status'), 'Opening your study…');
  try {
    const result = await request('/api/study');
    if (!state.account) return;
    studyBooks = result.books;
    displayStudy();
  } catch (error) { status($('#study-status'), error.message, true); }
}
document.querySelectorAll('[data-study]').forEach(button => button.addEventListener('click', () => {
  openStudy();
  $('#study-title').focus({ preventScroll: true });
  $('#study').scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth' });
}));
$('#study-filter').addEventListener('change', displayStudy);
$('#study-refresh').addEventListener('click', openStudy);

const dialog = $('#book-dialog');
let readController;
let readerCleanup;
let bookReading;
let readingReady;
let activePage = 0;
let showReaderPage;
let selection = '';
let readerText;
let findController;
const readingDefaults = () => ({ page: 1, total: 1, favorite: false, collections: [], bookmarks: [], notes: [] });

function goToReadingDesk(book) {
  if (!tour || $('#library-tour').hidden) { openBook(book); return; }
  $('#library-tour').scrollIntoView({ behavior: 'instant' });
  tour.stage(book, undefined, compact.matches);
}

function openBook(book, startReading = false) {
  tour?.stopMoving();
  state.book = book;
  activePage = 0;
  showReaderPage = null;
  selection = '';
  readerText = undefined;
  $('#book-text-tools').hidden = true;
  $('#book-reviews').open = false;
  $('#book-review-list').replaceChildren();
  $('#review-form').reset();
  status($('#review-status'));
  status($('#book-summary-result'));
  bookReading = readingDefaults();
  $('#reader-annotations').hidden = true;
  $('#reader-study').open = false;
  status($('#study-book-status'));
  $('#selected-format').textContent = [book.format.toUpperCase(), state.categories.get(book.genre)].filter(Boolean).join(' · ');
  $('#book-title').textContent = book.title;
  $('#selected-author').textContent = book.author || '';
  $('#selected-description').textContent = book.description || '';
  $('#read-book').hidden = !state.account.readBooks;
  $('#download-book').hidden = !state.account.downloadBooks;
  $('#locate-book').hidden = !tour || $('#library-tour').hidden;
  status($('#reader-status'));
  renderBookStudy();
  readingReady = request('/api/study/' + encodeURIComponent(book.id)).then(result => {
    if (state.book === book) { bookReading = result.reading; renderBookStudy(); }
  }).catch(error => { if (state.book === book) status($('#study-book-status'), error.message, true); });
  dialog.showModal();
  tour?.setVisible(false);
  if (startReading && state.account.readBooks) $('#read-book').click();
}

function filePath(book, intent) {
  return '/api/files/' + encodeURIComponent(book.id) + '/' + intent;
}

function renderBookStudy() {
  const favorite = $('#favorite-book');
  favorite.setAttribute('aria-pressed', String(bookReading.favorite));
  favorite.textContent = bookReading.favorite ? 'Remove from saved' : 'Save book';
  $('#collection-book-form').elements.collections.value = bookReading.collections.join(', ');
  const mark = $('#bookmark-book');
  mark.textContent = bookReading.bookmarks.includes(activePage) ? 'Remove page bookmark' : 'Bookmark this page';
  $('#study-book-marks').replaceChildren(...bookReading.bookmarks.map(page => {
    const button = node('button', 'Page ' + page, 'outline');
    button.type = 'button';
    button.disabled = !showReaderPage;
    button.addEventListener('click', () => showReaderPage(page));
    return button;
  }));
  const notes = bookReading.notes.map(note => {
    const row = node('article');
    const anchor = node('button', 'Page ' + note.page, 'outline');
    anchor.type = 'button';
    anchor.disabled = !showReaderPage;
    anchor.addEventListener('click', () => showReaderPage(note.page));
    row.append(anchor);
    if (note.quote) row.append(node('blockquote', note.quote));
    if (note.text) row.append(node('p', note.text));
    const remove = node('button', 'Remove annotation', 'outline');
    remove.type = 'button';
    remove.addEventListener('click', () => saveBookStudy({ removeNote: note.id }));
    row.append(remove);
    return row;
  });
  $('#study-book-notes').replaceChildren(...notes);
}

async function saveBookStudy(update, quiet = false) {
  const book = state.book;
  if (!book) return false;
  try {
    const { reading } = await request('/api/study/' + encodeURIComponent(book.id), { method: 'PATCH', data: update });
    if (state.book === book) {
      bookReading = reading;
      if (!quiet) status($('#study-book-status'), 'Saved to your private study.');
      renderBookStudy();
      if (activePage) paintHighlights();
    }
    return true;
  } catch (error) {
    if (state.book === book) status($('#study-book-status'), error.message, true);
    return false;
  }
}

function paintHighlights() {
  const reader = $('#reader').querySelector('.epub-chapter, .pdf-selectable p');
  if (!reader) return;
  const quotes = bookReading.notes.filter(note => note.page === activePage && note.quote).map(note => note.quote);
  for (const mark of reader.querySelectorAll('mark[data-user-highlight]')) {
    mark.replaceWith(document.createTextNode(mark.textContent));
  }
  reader.normalize();
  const walker = document.createTreeWalker(reader, NodeFilter.SHOW_TEXT);
  const matches = [];
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const quote = quotes.find(quote => text.textContent.includes(quote));
    if (quote) matches.push({ text, quote });
  }
  for (const { text, quote } of matches) {
    const range = document.createRange();
    const offset = text.textContent.indexOf(quote);
    range.setStart(text, offset);
    range.setEnd(text, offset + quote.length);
    const mark = node('mark');
    mark.dataset.userHighlight = 'true';
    range.surroundContents(mark);
  }
}

$('#favorite-book').addEventListener('click', () => saveBookStudy({ favorite: !bookReading.favorite }));
$('#locate-book').addEventListener('click', () => {
  const book = state.book;
  if (!book || !tour) return;
  dialog.close();
  $('#library-tour').scrollIntoView({ behavior: 'instant' });
  tour.setVisible(true);
  tour.locate(book);
});
$('#bookmark-book').addEventListener('click', () => {
  if (activePage) saveBookStudy({ bookmark: { page: activePage, remove: bookReading.bookmarks.includes(activePage) } });
});
$('#collection-book-form').addEventListener('submit', event => {
  event.preventDefault();
  saveBookStudy({ collections: event.currentTarget.elements.collections.value.split(',').map(value => value.trim()).filter(Boolean) });
});
$('#note-book-form').addEventListener('submit', async event => {
  event.preventDefault();
  const note = event.currentTarget.elements.note;
  if (activePage && await saveBookStudy({ note: { page: activePage, text: note.value } })) note.value = '';
});
document.addEventListener('selectionchange', () => {
  const text = window.getSelection();
  if (dialog.open && text.anchorNode && $('#reader').contains(text.anchorNode) && text.toString().trim()) selection = text.toString().trim();
});
$('#highlight-book').addEventListener('click', () => {
  if (selection && activePage) saveBookStudy({ note: { page: activePage, quote: selection } });
  else status($('#study-book-status'), 'Select text in the chapter or open Selectable page text in the PDF reader.');
});

async function loadReviews() {
  const book = state.book;
  if (!book) return;
  try {
    const result = await request('/api/reviews/' + encodeURIComponent(book.id));
    if (state.book !== book) return;
    status($('#review-status'), result.total ? result.average.toFixed(1) + ' of 5 · ' + result.total + ' ratings' : 'No member ratings yet.');
    if (result.own) {
      $('#review-form').elements.rating.value = String(result.own.rating);
      $('#review-form').elements.review.value = result.own.text || '';
    }
    $('#book-review-list').replaceChildren(...result.reviews.map(review => {
      const article = node('article');
      article.append(node('strong', review.username + ' · ' + review.rating + ' of 5'));
      if (review.text) article.append(node('p', review.text));
      return article;
    }));
  } catch (error) { if (state.book === book) status($('#review-status'), error.message, true); }
}
$('#book-reviews').addEventListener('toggle', () => { if ($('#book-reviews').open) loadReviews(); });
$('#review-form').addEventListener('submit', async event => {
  event.preventDefault();
  const book = state.book;
  const form = event.currentTarget;
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    await request('/api/reviews/' + encodeURIComponent(book.id), { method: 'PUT', data: { rating: Number(form.elements.rating.value), text: form.elements.review.value } });
    if (state.book === book) await loadReviews();
  } catch (error) { if (state.book === book) status($('#review-status'), error.message, true); }
  finally { button.disabled = false; }
});

function setTextSource(total, source, signal) {
  readerText = { total, get: source, signal };
  const section = $('#book-text-tools');
  section.open = false;
  section.hidden = false;
  status($('#book-find-status'));
  $('#book-find-results').replaceChildren();
}

$('#book-find').addEventListener('submit', async event => {
  event.preventDefault();
  const source = readerText;
  const query = event.currentTarget.elements.term.value.trim().toLowerCase();
  if (!source || !query) return;
  findController?.abort();
  const controller = new AbortController();
  findController = controller;
  const output = $('#book-find-results');
  output.replaceChildren();
  let matches = 0;
  try {
    for (let page = 1; page <= source.total && matches < 40; page++) {
      if (controller.signal.aborted || source.signal.aborted) return;
      if (page === 1 || page % 11 === 0) status($('#book-find-status'), 'Searching page or chapter ' + page + ' of ' + source.total + '…');
      const text = (await source.get(page)).replace(/\s+/g, ' ');
      const at = text.toLowerCase().indexOf(query);
      if (at < 0) continue;
      const row = node('article');
      const link = node('button', 'Open ' + page, 'outline');
      link.type = 'button';
      link.addEventListener('click', () => showReaderPage?.(page));
      row.append(node('p', text.slice(Math.max(0, at - 60), at + query.length + 105)), link);
      output.append(row);
      matches++;
    }
    status($('#book-find-status'), matches ? matches + (matches === 40 ? '+ matches' : ' matching pages or chapters') : 'No matches in selectable text.');
  } catch (error) { if (!source.signal.aborted) status($('#book-find-status'), error.message, true); }
});

$('#book-summarise').addEventListener('click', async event => {
  const source = readerText;
  if (!source) return;
  const output = $('#book-summary-result');
  const button = event.currentTarget;
  const engine = window.Summarizer;
  if (!engine) { status(output, 'This browser does not offer on-device AI summaries.'); return; }
  button.disabled = true;
  status(output, 'Preparing the on-device summariser…');
  let model;
  try {
    const options = { type: 'key-points', format: 'plain-text', length: 'medium', expectedInputLanguages: ['en'], outputLanguage: 'en' };
    if (await engine.availability(options) === 'unavailable') throw new Error('On-device AI summaries are unavailable on this device.');
    model = await engine.create({ ...options, signal: source.signal, monitor(monitor) {
      monitor.addEventListener('downloadprogress', event => status(output, 'Preparing the on-device model · ' + Math.round(event.loaded * 100) + '%'));
    } });
    const passages = [];
    let size = 0;
    for (let page = 1; page <= Math.min(12, source.total) && size < 16_000; page++) {
      const text = await source.get(page);
      passages.push(text);
      size += text.length;
    }
    const input = passages.join('\n\n').slice(0, 16_000);
    if (input.trim().length < 180) throw new Error('The opening pages have too little selectable text for a summary.');
    status(output, 'Summarising available opening text…');
    status(output, await model.summarize(input, { signal: source.signal }));
  } catch (error) { if (!source.signal.aborted) status(output, error.message, true); }
  finally { model?.destroy(); button.disabled = false; }
});

async function pagination(total, render, signal) {
  await readingReady;
  if (!dialog.open || signal.aborted) return;
  const previous = node('button', 'Previous', 'outline');
  const next = node('button', 'Next', 'outline');
  const label = node('span');
  label.setAttribute('role', 'status');
  const controls = node('div', '', 'reader-nav');
  const content = node('div', '', 'reader-page');
  content.tabIndex = -1;
  controls.append(previous, label, next);
  $('#reader').replaceChildren(content, controls);
  let page = Math.max(1, Math.min(total, bookReading.page || 1));
  let busy = false;
  async function show(number, turning = true) {
    if (busy || signal.aborted || number < 1 || number > total) return;
    busy = true;
    page = number;
    selection = '';
    previous.disabled = next.disabled = true;
    label.textContent = `${page} of ${total}`;
    try {
      await render(page, content);
      if (!dialog.open || signal.aborted) return;
      activePage = page;
      $('#reader-annotations').hidden = false;
      renderBookStudy();
      paintHighlights();
      saveBookStudy({ progress: { page, total } }, true);
      if (turning) {
        content.focus({ preventScroll: true });
        dialog.scrollTop += content.getBoundingClientRect().top - dialog.getBoundingClientRect().top - dialog.clientTop;
      }
    }
    catch (error) { if (dialog.open) status($('#reader-status'), error.message, true); }
    finally { busy = false; }
    previous.disabled = page === 1;
    next.disabled = page >= total;
  }
  previous.addEventListener('click', () => show(page - 1));
  next.addEventListener('click', () => show(page + 1));
  showReaderPage = show;
  return show(page, false);
}

async function readPdf(book, signal) {
  const pdf = await import('./pdf.min.mjs');
  if (signal.aborted) return;
  pdf.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.min.mjs', import.meta.url).href;
  const task = pdf.getDocument({ url: api + filePath(book, 'read'), httpHeaders: { Authorization: 'Bearer ' + state.token }, isEvalSupported: false, useWasm: false, enableXfa: false });
  readerCleanup = () => { task.destroy().catch(() => {}); };
  const documentPdf = await task.promise;
  if (signal.aborted) return;
  const pageContent = async current => {
    const { items } = await current.getTextContent();
    return items.map(item => item.str === undefined ? '' : item.str + (item.hasEOL ? '\n' : ' ')).join('').trim();
  };
  setTextSource(documentPdf.numPages, async number => pageContent(await documentPdf.getPage(number)), signal);
  const canvas = node('canvas');
  canvas.setAttribute('aria-label', 'PDF page');
  const selectable = node('details', '', 'pdf-selectable');
  selectable.append(node('summary', 'Selectable page text'), node('p'));
  let highlightedPage;
  let oldPage;
  async function pageText() {
    if (selectable.open && highlightedPage && oldPage !== highlightedPage) {
      const current = highlightedPage;
      try {
        const text = await pageContent(current);
        if (current !== highlightedPage || signal.aborted) return;
        selectable.querySelector('p').textContent = text || 'This PDF page has no selectable text.';
        oldPage = current;
        if (activePage) paintHighlights();
      } catch { selectable.querySelector('p').textContent = 'Selectable text is unavailable for this page.'; }
    }
  }
  selectable.addEventListener('toggle', pageText);
  await pagination(documentPdf.numPages, async (number, content) => {
    const page = await documentPdf.getPage(number);
    if (signal.aborted) return;
    const width = page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale: Math.min(2, 1150 / width) });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    highlightedPage = page;
    content.append(canvas, selectable);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    await pageText();
  }, signal);
}

function relative(base, path) {
  const parent = base.slice(0, base.lastIndexOf('/') + 1);
  const parts = (parent + decodeURIComponent(path.split('#')[0])).split('/');
  const normalized = [];
  for (const part of parts) {
    if (part === '..') normalized.pop();
    else if (part && part !== '.') normalized.push(part);
  }
  return normalized.join('/');
}

async function readEpub(book, signal) {
  const response = await request(filePath(book, 'read'), { raw: true, signal });
  if (Number(response.headers.get('Content-Length')) > 75_000_000) throw new Error('This EPUB is too large for the built-in reader. Use Download if your membership allows it.');
  const [{ unzipSync, strFromU8 }, data] = await Promise.all([import('./fflate.mjs'), response.arrayBuffer()]);
  if (signal.aborted) return;
  let uncompressed = 0;
  const files = unzipSync(new Uint8Array(data), { filter: entry => {
    if (!/\.(?:xml|opf|html|xhtml|htm)$/i.test(entry.name)) return false;
    uncompressed += entry.originalSize;
    if (uncompressed > 48_000_000) throw new Error('This EPUB is too large for the built-in reader.');
    return true;
  } });
  const parser = new DOMParser();
  const xml = name => {
    if (!Object.hasOwn(files, name)) throw new Error('The EPUB is missing a required section.');
    return parser.parseFromString(strFromU8(files[name]), 'application/xml');
  };
  const packagePath = xml('META-INF/container.xml').getElementsByTagNameNS('*', 'rootfile')[0]?.getAttribute('full-path');
  if (!packagePath) throw new Error('The EPUB package could not be opened.');
  const pkg = xml(packagePath);
  const manifest = new Map([...pkg.getElementsByTagNameNS('*', 'item')].map(item => [item.getAttribute('id'), item.getAttribute('href')]));
  const chapters = [...pkg.getElementsByTagNameNS('*', 'itemref')].map(item => manifest.get(item.getAttribute('idref'))).filter(Boolean);
  if (!chapters.length) throw new Error('This EPUB has no readable chapters.');
  setTextSource(chapters.length, async number => xml(relative(packagePath, chapters[number - 1])).getElementsByTagNameNS('*', 'body')[0]?.textContent || '', signal);
  const page = node('article', '', 'epub-chapter');
  page.setAttribute('aria-label', 'EPUB chapter');
  await pagination(chapters.length, (number, readerPage) => {
    const code = xml(relative(packagePath, chapters[number - 1]));
    const content = code.getElementsByTagNameNS('*', 'body')[0];
    if (!content) throw new Error('This chapter could not be opened.');
    const allowed = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'strong', 'em', 'b', 'i', 'blockquote', 'ul', 'ol', 'li', 'br', 'hr', 'sup', 'sub', 'pre']);
    const ignored = new Set(['script', 'style', 'iframe', 'object', 'svg', 'nav']);
    function clean(source) {
      const fragment = document.createDocumentFragment();
      for (const child of source.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) fragment.append(child.textContent);
        if (child.nodeType !== Node.ELEMENT_NODE || ignored.has(child.localName)) continue;
        const descendants = clean(child);
        if (allowed.has(child.localName)) {
          const element = node(child.localName);
          element.append(descendants);
          fragment.append(element);
        } else fragment.append(descendants);
      }
      return fragment;
    }
    page.replaceChildren(clean(content));
    readerPage.append(page);
  }, signal);
}

$('#read-book').addEventListener('click', async event => {
  const button = event.currentTarget;
  const book = state.book;
  readController?.abort();
  readerCleanup?.();
  readerCleanup = undefined;
  const controller = new AbortController();
  readController = controller;
  button.disabled = true;
  status($('#reader-status'), 'Opening the book…');
  try {
    await (book.format === 'pdf' ? readPdf(book, controller.signal) : readEpub(book, controller.signal));
    if (!controller.signal.aborted) status($('#reader-status'));
  } catch (error) { if (!controller.signal.aborted) status($('#reader-status'), error.message, true); }
  finally { button.disabled = false; }
});
$('#download-book').addEventListener('click', async event => {
  const button = event.currentTarget;
  const book = state.book;
  button.disabled = true;
  status($('#reader-status'), 'Preparing the download…');
  try {
    const response = await request(filePath(book, 'download'), { raw: true });
    const url = URL.createObjectURL(await response.blob());
    const link = node('a');
    link.href = url;
    link.download = book.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120) + '.' + book.format;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    if (state.book === book) status($('#reader-status'), 'Download started.');
  } catch (error) { if (state.book === book) status($('#reader-status'), error.message, true); }
  finally { button.disabled = false; }
});
dialog.addEventListener('close', () => {
  findController?.abort();
  readController?.abort();
  readerCleanup?.();
  readerCleanup = undefined;
  $('#reader').replaceChildren();
  state.book = null;
  if (!$('#library-tour').hidden && state.account) tour?.setVisible(true);
});

if (state.token) {
  try {
    const session = await request('/api/auth/session');
    setSession(state.token, session.account);
    await enter(false);
  } catch (error) { closeLibrary(error.message); }
}
