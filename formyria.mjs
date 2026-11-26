const $ = selector => document.querySelector(selector);
const body = document.body;
const api = body.dataset.libraryApi;
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const state = { token: storage('sessionStorage', 'formyria-session'), account: null, mode: 'login', books: [], categories: new Map(), book: null };
const loginForm = $('#access-form');
const passwordForm = $('#password-form');
const accessStatus = $('#access-status');
const officeStatus = $('#office-status');
const catalogueStatus = $('#catalogue-status');
let tour;
let tourLoading;
let tourFailed = false;

function showStop(place) {
  const names = { hall: 'The Grand Hall', west: 'West Stacks', east: 'East Gallery', archives: 'The Archives', desk: 'The Reading Desk' };
  $('#tour-room').textContent = names[place];
  $('#tour-instructions').textContent = {
    hall: 'Drag to look around. Select a bookcase or use the floor plan.',
    west: 'History, fiction, literature, philosophy and biography. Select a book by its spine.',
    east: 'Science, technology, business and finance. Select a book by its spine.',
    archives: 'Reference books and works awaiting classification. Select a book by its spine.',
    desk: 'Pick a book from a stack or the catalogue to bring it to the desk.'
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
        canvas: $('#tour-canvas'), message: $('#tour-book-label'), onStop: showStop, onPick: openBook
      });
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
  control.addEventListener('click', () => tour?.go(control.dataset.stop));
});
$('#tour-canvas').addEventListener('tourunavailable', () => { tourFailed = true; showTour(false); });
$('#tour-light').addEventListener('click', event => {
  const control = event.currentTarget;
  const night = control.getAttribute('aria-pressed') !== 'true';
  control.setAttribute('aria-pressed', String(night));
  control.textContent = night ? 'Day lighting' : 'Night lighting';
  tour?.setLighting(night);
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
}

async function request(path, options = {}) {
  const { method = 'GET', data, raw = false, credential = true, signal } = options;
  const headers = new Headers();
  if (credential && state.token) headers.set('Authorization', 'Bearer ' + state.token);
  if (data !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(api + path, { method, headers, body: data === undefined ? undefined : JSON.stringify(data), cache: 'no-store', signal });
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
  if ($('#book-dialog').open) $('#book-dialog').close();
  setSession(null, null);
  state.books = [];
  state.categories.clear();
  tour?.setBooks([]);
  showTour(false);
  $('#shelf-display').replaceChildren();
  $('#member-list').replaceChildren();
  $('#office').hidden = true;
  $('#office-button').hidden = true;
  $('#tour-office').hidden = true;
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
  $('#lightweight').textContent = enabled ? 'Cinematic mode' : 'Lightweight mode';
}
setLightweight(storage('localStorage', 'formyria-lightweight') === 'true');
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
    button.addEventListener('click', () => {
      if ($('#library-tour').hidden || !tour) openBook(book);
      else {
        $('#library-tour').scrollIntoView({ behavior: 'instant' });
        tour.stage(book);
      }
    });
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
}
$('#office-button').addEventListener('click', openOffice);
$('#tour-office').addEventListener('click', openOffice);
$('#mark-read').addEventListener('click', async () => {
  try {
    await request('/api/admin/notifications', { method: 'POST' });
    await loadNotifications();
  } catch (error) { status(officeStatus, error.message, true); }
});

const dialog = $('#book-dialog');
let readController;
let readerCleanup;
function openBook(book) {
  state.book = book;
  $('#selected-format').textContent = [book.format.toUpperCase(), state.categories.get(book.genre)].filter(Boolean).join(' · ');
  $('#book-title').textContent = book.title;
  $('#selected-author').textContent = book.author || '';
  $('#selected-description').textContent = book.description || '';
  $('#read-book').hidden = !state.account.readBooks;
  $('#download-book').hidden = !state.account.downloadBooks;
  status($('#reader-status'));
  dialog.showModal();
}

function filePath(book, intent) {
  return '/api/files/' + encodeURIComponent(book.id) + '/' + intent;
}

function pagination(total, render) {
  const previous = node('button', 'Previous', 'outline');
  const next = node('button', 'Next', 'outline');
  const label = node('span');
  label.setAttribute('role', 'status');
  const controls = node('div', '', 'reader-nav');
  controls.append(previous, label, next);
  $('#reader').replaceChildren(controls);
  let page = 1;
  async function show(number) {
    page = number;
    previous.disabled = next.disabled = true;
    label.textContent = `${page} of ${total}`;
    try { await render(page); }
    catch (error) { if (dialog.open) status($('#reader-status'), error.message, true); }
    previous.disabled = page === 1;
    next.disabled = page >= total;
  }
  previous.addEventListener('click', () => show(page - 1));
  next.addEventListener('click', () => show(page + 1));
  return show(1);
}

async function readPdf(book, signal) {
  const pdf = await import('./pdf.min.mjs');
  if (signal.aborted) return;
  pdf.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.min.mjs', import.meta.url).href;
  const task = pdf.getDocument({ url: api + filePath(book, 'read'), httpHeaders: { Authorization: 'Bearer ' + state.token }, isEvalSupported: false, useWasm: false, enableXfa: false });
  readerCleanup = () => { task.destroy().catch(() => {}); };
  const documentPdf = await task.promise;
  if (signal.aborted) return;
  const canvas = node('canvas');
  canvas.setAttribute('aria-label', 'PDF page');
  await pagination(documentPdf.numPages, async number => {
    const page = await documentPdf.getPage(number);
    if (signal.aborted) return;
    const width = page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale: Math.min(2, 1150 / width) });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    $('#reader').append(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  });
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
  const page = node('article', '', 'epub-chapter');
  page.setAttribute('aria-label', 'EPUB chapter');
  await pagination(chapters.length, number => {
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
    $('#reader').append(page);
  });
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
  readController?.abort();
  readerCleanup?.();
  readerCleanup = undefined;
  $('#reader').replaceChildren();
  state.book = null;
});

if (state.token) {
  try {
    const session = await request('/api/auth/session');
    setSession(state.token, session.account);
    await enter(false);
  } catch (error) { closeLibrary(error.message); }
}
