const $ = id => document.getElementById(id);
const pageSize = 24;
const chosen = new Set();
let connection;
let collection;
let view = 'active';
let page = 0;
let current = [];
let installed = false;
let uploading = false;

function element(tag, text = '') {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}

function message(id, text, error = false) {
  $(id).textContent = text;
  $(id).dataset.error = String(error);
}

function action(text, handle) {
  const button = element('button', text);
  button.type = 'button';
  button.className = 'outline';
  button.addEventListener('click', handle);
  return button;
}

function options(select, label, choices) {
  const last = select.value;
  select.replaceChildren(new Option(label, ''), ...choices.map(item => new Option(item.name, item.id)));
  if (choices.some(item => item.id === last)) select.value = last;
}

async function refresh() {
  try {
    collection = await connection.request('/api/admin/books');
    const { active, sorting, duplicates, storage, categories, history } = collection;
    const storageText = (storage.bytes / 1e9).toFixed(2) + ' GB stored';
    message('management-stats', [active + ' books', sorting + ' awaiting classification', duplicates + ' possible duplicates', storageText].join(' · '));
    const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name));
    options($('admin-genre'), 'Choose category', sorted);
    options($('category-target'), 'Keep separate', sorted);
    options($('admin-history'), 'Choose a change', history.map(item => ({ id: item.id, name: item.label + ' · ' + new Date(item.at).toLocaleString() })));
    $('admin-history').disabled = $('admin-undo').disabled = !history.length;
    render();
  } catch (error) { message('admin-status', error.message, true); }
}

function render() {
  if (!collection) return;
  const filter = $('admin-search').value.trim().toLowerCase();
  const books = collection.books.filter(book => {
    if (view === 'trash' ? !['trash', 'purging'].includes(book.status) : book.status !== 'active') return false;
    if (view === 'sorting' && book.genre) return false;
    if (view === 'duplicates' && !book.duplicateOf) return false;
    return [book.title, book.author, book.isbn].join(' ').toLowerCase().includes(filter);
  }).sort((a, b) => a.title.localeCompare(b.title));
  const max = Math.max(1, Math.ceil(books.length / pageSize));
  page = Math.min(page, max - 1);
  current = books.slice(page * pageSize, (page + 1) * pageSize);
  $('admin-select-all').disabled = !current.some(book => book.status !== 'purging');
  $('admin-prev').disabled = page === 0;
  $('admin-next').disabled = page + 1 >= max;
  $('admin-page').textContent = books.length + ' books · Page ' + (page + 1) + ' of ' + max;
  $('admin-trash').hidden = view === 'trash';
  $('admin-restore').hidden = view !== 'trash';
  $('admin-genre').hidden = $('admin-categorise').hidden = view === 'trash';
  const rows = current.map(book => {
    const row = element('article');
    row.className = 'member-row';
    const info = element('div');
    info.className = 'managed-book';
    const checkbox = element('input');
    checkbox.type = 'checkbox';
    checkbox.checked = chosen.has(book.id);
    checkbox.disabled = book.status === 'purging';
    checkbox.setAttribute('aria-label', 'Select ' + book.title);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) chosen.add(book.id);
      else chosen.delete(book.id);
      updateSelection();
    });
    const details = element('div');
    details.append(element('h4', book.title), element('p', [book.author, book.format.toUpperCase(), book.subgenre || book.genreName, book.sortingReason].filter(Boolean).join(' · ')));
    info.append(checkbox, details);
    row.append(info);
    if (view === 'trash') row.append(action('Delete permanently', () => confirmPurge(book)));
    else row.append(action('Edit', () => editBook(book)));
    return row;
  });
  $('admin-book-list').replaceChildren(...rows);
  updateSelection();
}

function updateSelection() {
  const selected = chosen.size > 0 && chosen.size <= 100;
  for (const id of ['admin-trash', 'admin-restore', 'admin-categorise']) $(id).disabled = !selected;
  $('admin-select-all').textContent = chosen.size ? chosen.size + ' selected · Select this page' : 'Select this page';
}

async function change(operation, data, description = 'Changes saved.') {
  message('admin-status', 'Saving…');
  try {
    await connection.request('/api/admin/books/' + operation, { method: 'POST', data });
    chosen.clear();
    message('admin-status', description);
    await Promise.all([refresh(), connection.loadCatalogue()]);
    return true;
  } catch (error) { message('admin-status', error.message, true); return false; }
}

function namedInput(form, name, label, input, value = '') {
  const wrapper = element('label', label);
  input.name = name;
  if (input.type !== 'file') input.value = value;
  wrapper.append(input);
  form.append(wrapper);
  return input;
}

function formDialog(heading, explanation = '') {
  const dialog = $('edit-dialog');
  const title = element('h2', heading);
  title.id = 'edit-title';
  title.className = 'section-title';
  const form = element('form');
  const info = element('p', explanation);
  dialog.replaceChildren(title, info, form);
  return { dialog, form };
}

function dialogButtons(form, dialog, title) {
  const actions = element('div');
  actions.className = 'office-actions';
  const submit = element('button', title);
  submit.type = 'submit';
  submit.className = 'brass';
  actions.append(action('Cancel', () => dialog.close()), submit);
  form.append(actions);
  const status = element('p');
  status.className = 'form-status';
  status.setAttribute('role', 'status');
  form.append(status);
  return { submit, status };
}

function editBook(book) {
  const { dialog, form } = formDialog('Edit book', book.sortingReason || '');
  for (const [key, label] of [['title','Title'],['author','Author'],['isbn','ISBN'],['publisher','Publisher'],['published','Publication date'],['subgenre','Subgenre'],['tags','Tags, separated by commas']]) {
    const input = namedInput(form, key, label, element('input'), key === 'tags' ? (book.tags || []).join(', ') : book[key] || '');
    input.required = key === 'title';
  }
  namedInput(form, 'description', 'Description', element('textarea'), book.description || '');
  const select = namedInput(form, 'genre', 'Primary genre', element('select'));
  options(select, 'The Sorting Room', collection.categories);
  select.value = book.genre || '';
  const cover = element('input');
  cover.type = 'file';
  cover.accept = 'image/jpeg,image/png,image/webp';
  namedInput(form, 'cover', 'Replace cover', cover);
  const replacement = element('input');
  replacement.type = 'file';
  replacement.accept = '.pdf,.epub';
  namedInput(form, 'file', 'Replace PDF or EPUB', replacement);
  const evidence = (book.evidence || []).filter(Boolean);
  if (evidence.length) form.append(element('p', evidence.join(' · ')));
  const { submit, status } = dialogButtons(form, dialog, 'Save book');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = 'Saving book…';
    try {
      const data = Object.fromEntries(new FormData(form));
      delete data.cover;
      delete data.file;
      data.tags = data.tags.split(',').map(tag => tag.trim()).filter(Boolean);
      if (cover.files[0]) await saveCover(book.id, cover.files[0]);
      if (replacement.files[0]) {
        const result = await uploadBook(replacement.files[0], (fraction, stage) => {
          status.textContent = stage + ' · ' + Math.round(fraction * 100) + '%';
        }, true);
        if (!await change('replace', { id: book.id, withId: result.id, trashReplacement: result.added }, 'Book file replaced.')) {
          throw new Error($('admin-status').textContent);
        }
      }
      if (await change('edit', { ids: [book.id], fields: data })) dialog.close();
      else status.textContent = $('admin-status').textContent;
    } catch (error) { status.textContent = error.message; }
    finally { submit.disabled = false; }
  });
  dialog.showModal();
}

function confirmPurge(book) {
  const { dialog, form } = formDialog('Delete permanently', 'The stored copy of “' + book.title + '” will be removed if it is unused by any other book.');
  const input = namedInput(form, 'confirm', 'Type PURGE to confirm', element('input'));
  input.required = true;
  input.pattern = 'PURGE';
  const { submit, status } = dialogButtons(form, dialog, 'Delete permanently');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    if (await change('purge', { id: book.id, confirm: input.value }, 'Book permanently removed from online storage.')) dialog.close();
    else { submit.disabled = false; status.textContent = $('admin-status').textContent; }
  });
  dialog.showModal();
}

const hash = async data => [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(value => value.toString(16).padStart(2, '0')).join('');

async function inspect(file, format) {
  const defaults = { title: file.name.replace(/\.[^.]+$/, ''), author: '', titleSource: 'filename', sortingReason: 'Subject evidence not yet reviewed' };
  const firstParty = input => {
    const title = String(input.title || '').trim();
    const valid = title && !/^(untitled|unknown)$|\.(pdf|epub)$/i.test(title);
    return { ...defaults, ...input, title: valid ? title : defaults.title, titleSource: valid ? 'document metadata' : defaults.titleSource };
  };
  if (format === 'pdf') {
    const pdf = await import('./pdf.min.mjs');
    pdf.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.min.mjs', import.meta.url).href;
    const job = pdf.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useWasm: false, isEvalSupported: false, enableXfa: false });
    try {
      const source = await job.promise;
      const { info } = await source.getMetadata();
      return firstParty({ title: info.Title, author: info.Author || '', description: info.Subject || '' });
    } finally { await job.destroy(); }
  }
  const { unzipSync, strFromU8 } = await import('./fflate.mjs');
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: entry => entry.originalSize < 2_000_000 && /(?:META-INF\/container.xml|\.opf)$/i.test(entry.name)
  });
  const parser = new DOMParser();
  const xml = data => parser.parseFromString(strFromU8(data), 'application/xml');
  const packagePath = xml(files['META-INF/container.xml']).getElementsByTagNameNS('*','rootfile')[0]?.getAttribute('full-path');
  if (!packagePath || !Object.hasOwn(files, packagePath)) throw new Error('The EPUB package metadata could not be opened.');
  const packageXml = xml(files[packagePath]);
  const info = field => packageXml.getElementsByTagNameNS('*',field)[0]?.textContent.trim() || '';
  const tags = Array.from(packageXml.getElementsByTagNameNS('*','subject'), item => item.textContent.trim()).filter(Boolean);
  const existing = collection?.categories.find(category => tags.some(tag => tag.toLowerCase() === category.name.toLowerCase()));
  const classification = existing ? { genre: existing.id, genreName: existing.name, evidence: ['EPUB subject metadata matches ' + existing.name], sortingReason: '' } : {};
  return firstParty({ title: info('title'), author: info('creator'), description: info('description'), publisher: info('publisher'), published: info('date'), tags, ...classification });
}

async function saveCover(id, file) {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(400 / bitmap.width, 540 / bitmap.height, 1);
  const canvas = Object.assign(element('canvas'), { width: Math.max(1, Math.round(bitmap.width * ratio)), height: Math.max(1, Math.round(bitmap.height * ratio)) });
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const body = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .8));
  if (!body) throw new Error('The cover could not be processed.');
  await connection.request('/api/admin/imports/' + id + '/cover', { method: 'PUT', body, headers: { 'Content-Type': 'image/jpeg' } });
}

async function retry(run) {
  for (let attempt = 0; ; attempt++) {
    try { return await run(); }
    catch (error) {
      if (attempt >= 2 || (error.status && ![408,409,429,500,502,503,504].includes(error.status))) throw error;
      await new Promise(resolve => setTimeout(resolve, 420 * 2 ** attempt));
    }
  }
}

async function uploadBook(file, progress, replacement = false) {
  if (file.size > 275 * 1024 * 1024) throw new Error('This file exceeds the upload size limit.');
  const format = file.name.split('.').pop().toLowerCase();
  if (!['pdf', 'epub'].includes(format)) throw new Error('Choose a PDF or EPUB.');
  progress(0, 'Inspecting ' + file.name);
  const digest = await hash(await file.arrayBuffer());
  const details = await inspect(file, format);
  const result = await retry(() => connection.request('/api/admin/imports', {
    method: 'POST', data: { ...details, id: digest, sha256: digest, size: file.size, format, replacement }
  }));
  if (result.status !== 'uploading') return { id: result.duplicateOf || result.id, added: false };
  const key = '/api/admin/imports/' + digest;
  try {
    if (!result.stored) {
      for (let offset = 0, part = 1; offset < file.size; offset += result.chunkSize, part++) {
        if (result.parts.includes(part)) continue;
        const body = file.slice(offset, offset + result.chunkSize);
        const checksum = await hash(await body.arrayBuffer());
        await retry(() => connection.request(key + '/parts/' + part, {
          method: 'PUT', body, headers: { 'Content-Type': 'application/octet-stream', 'X-Part-SHA256': checksum }
        }));
        progress(Math.min(1, (offset + body.size) / file.size), 'Uploading ' + file.name + ' · Part ' + part);
      }
    }
    await retry(() => connection.request(key + '/complete', { method: 'POST', data: {} }));
    return { id: digest, added: true };
  } catch (error) {
    await connection.request(key + '/failure', { method: 'POST', data: { error: error.message } }).catch(() => {});
    throw error;
  }
}

async function uploadFiles(files) {
  if (uploading) return;
  const selected = [...files].filter(file => /\.(pdf|epub)$/i.test(file.name));
  if (!selected.length) { message('admin-upload-status', 'Choose PDF or EPUB files.', true); return; }
  uploading = true;
  const progress = $('admin-upload-progress');
  const failures = $('admin-upload-failures');
  failures.replaceChildren();
  progress.hidden = false;
  progress.value = 0;
  const stats = { uploaded: 0, skipped: 0, failed: 0 };
  let index = 0;
  for (const file of selected) {
    index++;
    message('admin-upload-status', 'Inspecting ' + file.name + ' · ' + index + ' of ' + selected.length);
    try {
      const result = await uploadBook(file, (fraction, stage) => {
        message('admin-upload-status', stage + ' · ' + index + ' of ' + selected.length);
        progress.value = 100 * (index - 1 + fraction) / selected.length;
      });
      if (result.added) stats.uploaded++;
      else stats.skipped++;
    } catch (error) {
      stats.failed++;
      failures.append(element('p', file.name + ' — ' + error.message));
    } finally { progress.value = index / selected.length * 100; }
  }
  uploading = false;
  message('admin-upload-status', stats.uploaded + ' uploaded · ' + stats.skipped + ' skipped · ' + stats.failed + ' failed', stats.failed > 0);
  await Promise.all([refresh(), connection.loadCatalogue()]);
}

function install() {
  for (const control of document.querySelectorAll('#admin-views button')) {
    control.addEventListener('click', () => {
      view = control.dataset.view;
      page = 0;
      chosen.clear();
      for (const button of document.querySelectorAll('#admin-views button')) button.setAttribute('aria-pressed', String(button === control));
      render();
    });
  }
  $('admin-search').addEventListener('input', () => { page = 0; render(); });
  $('admin-prev').addEventListener('click', () => { page--; render(); });
  $('admin-next').addEventListener('click', () => { page++; render(); });
  $('admin-select-all').addEventListener('click', () => {
    for (const book of current) {
      if (chosen.size < 100 && book.status !== 'purging') chosen.add(book.id);
    }
    render();
  });
  $('admin-trash').addEventListener('click', () => {
    if (confirm('Move ' + chosen.size + ' selected books to the recycle bin?')) change('trash', { ids: [...chosen] }, 'Books moved to the recycle bin.');
  });
  $('admin-restore').addEventListener('click', () => change('restore', { ids: [...chosen] }, 'Books restored.'));
  $('admin-categorise').addEventListener('click', () => {
    const genre = $('admin-genre').value;
    if (genre) change('edit', { ids: [...chosen], fields: { genre } }, 'Categories saved.');
    else message('admin-status', 'Choose a category first.', true);
  });
  $('category-form').addEventListener('submit', event => {
    event.preventDefault();
    change('category', Object.fromEntries(new FormData(event.currentTarget)), 'Category saved.');
  });
  $('admin-undo').addEventListener('click', () => {
    if ($('admin-history').value) change('undo', { id: $('admin-history').value }, 'Change undone.');
  });
  $('admin-refresh').addEventListener('click', refresh);
  for (const id of ['admin-files','admin-folder']) {
    $(id).addEventListener('change', event => {
      const files = [...event.currentTarget.files];
      event.currentTarget.value = '';
      uploadFiles(files);
    });
  }
  installed = true;
}

export function openCollectionOffice(options) {
  connection = options;
  if (!installed) install();
  $('book-management').hidden = false;
  return refresh();
}
