const labels = { pending: 'Requested', searching: 'Searching', available: 'Available', unavailable: 'No authorised copy found', withdrawn: 'Withdrawn' };
const formats = { pdf: 'PDF', epub: 'EPUB', either: 'PDF or EPUB' };

function element(tag, text) {
  const item = document.createElement(tag);
  if (text) item.textContent = text;
  return item;
}

function button(text, handle, style = 'outline') {
  const control = element('button', text);
  control.className = style;
  control.type = 'button';
  if (handle) control.addEventListener('click', handle);
  return control;
}

function link(text, address) {
  const control = element('a', text);
  control.href = address;
  control.target = '_blank';
  control.rel = 'noopener noreferrer';
  return control;
}

function field(label, name, type, options = {}) {
  const row = element('label', label);
  const input = Object.assign(element('input'), { name, type, ...options });
  row.append(input);
  return row;
}

function searchLinks(item) {
  const terms = [item.title, item.author, item.isbn, item.edition].filter(Boolean).join(' ');
  const query = encodeURIComponent(terms);
  const web = encodeURIComponent('"' + item.title.replaceAll('"', '') + '" ' +
    [item.author, item.isbn, item.edition, item.format === 'epub' ? 'filetype:epub' : 'filetype:pdf', '("public domain" OR "Creative Commons")']
      .filter(Boolean).join(' '));
  return [
    link('Search the web', 'https://www.google.com/search?q=' + web),
    link('Library of Congress', 'https://www.loc.gov/collections/selected-digitized-books/?q=' + query),
    link('Project Gutenberg', 'https://www.gutenberg.org/ebooks/search/?query=' + query),
    link('Standard Ebooks', 'https://standardebooks.org/ebooks?query=' + query),
  ];
}

export function bookRequestDesk({ request, account, books, loadCatalogue, openBook, status }) {
  const dialog = document.getElementById('book-requests-dialog');
  const form = document.getElementById('book-request-form');
  const detail = document.getElementById('new-book-request');
  const list = document.getElementById('book-request-list');
  const feedback = document.getElementById('book-request-status');
  const endpoint = '/api/book-requests';
  let revision = 0;

  async function refresh() {
    const turn = ++revision;
    const { requests } = await request(endpoint);
    if (turn !== revision) return;
    const needsAction = entry => ['pending', 'searching'].includes(entry.status) ? 0 : 1;
    requests.sort((a, b) => needsAction(a) - needsAction(b));
    list.replaceChildren(...requests.map(card));
    if (!requests.length) list.append(element('p', 'No book requests yet.'));
  }

  async function run(control, action) {
    control.disabled = true;
    status(feedback);
    try { await action(); }
    catch (error) { status(feedback, error.message, true); }
    finally { control.disabled = false; }
  }

  async function update(item, fields, message, verifyRevision = revision) {
    await request(endpoint, { method: 'PATCH', data: { id: item.id, ...fields } });
    if (verifyRevision !== revision) return;
    await refresh();
    status(feedback, message);
  }

  function card(item) {
    const admin = account()?.role === 'admin';
    const card = element('article');
    const meta = [item.author, item.edition, item.isbn ? 'ISBN ' + item.isbn : '', formats[item.format]];
    if (admin) meta.push('Requested by ' + item.requester);
    card.append(element('h3', item.title), element('p', meta.filter(Boolean).join(' · ')));
    card.append(element('strong', labels[item.status] || 'Requested'));
    if (item.note) card.append(element('p', item.note));
    const actions = element('div');
    actions.className = 'office-actions';
    const book = books().find(entry => entry.id === item.bookId);
    if (book) actions.append(button('Open book', () => openBook(book), 'brass'));
    if (item.source) actions.append(link('Source provided', item.source));
    if (item.requester === account()?.username && ['pending', 'searching'].includes(item.status)) {
      actions.append(button('Withdraw', event => run(event.currentTarget,
        () => update(item, { status: 'withdrawn' }, 'Request withdrawn.'))));
    }
    if (actions.childElementCount) card.append(actions);
    if (admin && item.status !== 'withdrawn' && item.status !== 'available') card.append(adminActions(item));
    return card;
  }

  function adminActions(item) {
    const details = element('details');
    details.append(element('summary', 'Find and fulfil this request'));
    const links = element('div');
    links.className = 'request-links';
    links.append(...searchLinks(item));
    const candidates = element('div');
    candidates.className = 'request-links';
    const find = button('Look up archive editions', event => run(event.currentTarget, async () => {
      const result = await request('/api/admin/book-requests/search', { method: 'POST', data: { id: item.id } });
      candidates.replaceChildren(...result.candidates.map(entry => link(
        [entry.title, entry.year, entry.source].filter(Boolean).join(' · '), entry.url)));
      if (!result.candidates.length) candidates.append(element('p', result.sourcesReached
        ? 'No matching editions returned. Try the source links above.'
        : 'The archives didn’t respond. Try the source links above.'));
    }));
    details.append(links, find, candidates);

    const existing = element('form');
    existing.className = 'request-fields';
    const matching = field('Find an existing library copy', 'filter', 'search', { value: item.title });
    const chosen = element('select');
    chosen.name = 'bookId';
    chosen.required = true;
    const choice = element('label', 'Catalogue edition');
    choice.append(chosen);
    const use = button('Link library copy', null);
    use.type = 'submit';
    const showMatches = () => {
      const words = matching.lastElementChild.value.toLowerCase().trim().split(/\s+/);
      const possible = books().filter(entry => (item.format === 'either' || item.format === entry.format) &&
        words.every(word => (entry.title + ' ' + entry.author).toLowerCase().includes(word))).slice(0, 20);
      chosen.replaceChildren(new Option('Select an edition', ''), ...possible.map(entry =>
        new Option([entry.title, entry.author, entry.format.toUpperCase()].filter(Boolean).join(' · '), entry.id)));
    };
    matching.lastElementChild.addEventListener('input', showMatches);
    showMatches();
    existing.append(matching, choice, use);
    existing.addEventListener('submit', event => {
      event.preventDefault();
      run(use, () => update(item, { status: 'available', bookId: chosen.value }, 'Library copy linked.'));
    });

    const upload = element('form');
    upload.className = 'request-fields';
    const accept = item.format === 'either' ? '.pdf,.epub' : '.' + item.format;
    const uploadButton = button('Upload and fulfil request', null, 'brass');
    uploadButton.type = 'submit';
    upload.append(field('Edition file', 'file', 'file', { accept, required: true }),
      field('Source or rights statement URL', 'source', 'url', { required: true, maxLength: 600, value: item.source || '' }),
      field('Permission to redistribute', 'rights', 'text', { required: true, maxLength: 180, placeholder: 'Public domain or applicable licence' }), uploadButton);
    upload.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(upload);
      const file = data.get('file');
      const source = data.get('source').trim();
      const rights = data.get('rights').trim();
      run(uploadButton, async () => {
        if (!source.startsWith('https://') || !rights) throw new Error('Enter an HTTPS source link and the applicable redistribution permission.');
        if (!file.name || !accept.split(',').some(extension => file.name.toLowerCase().endsWith(extension))) {
          throw new Error('Choose a file in the requested format.');
        }
        const turn = revision;
        const { uploadRequestedEdition } = await import('./admin-office.mjs?v=11');
        const result = await uploadRequestedEdition(request, file, (_, stage) => status(feedback, stage), item, source, rights);
        await loadCatalogue();
        await update(item, { status: 'available', bookId: result.id, source, note: rights }, 'Edition is available in the library.', turn);
      });
    });

    const note = field('Update for the requester', 'note', 'text', { maxLength: 400, value: item.note || '' });
    const updateButtons = element('div');
    updateButtons.className = 'office-actions';
    for (const [next, label] of [['searching', 'Mark searching'], ['unavailable', 'Mark unavailable']]) {
      updateButtons.append(button(label, event => run(event.currentTarget,
        () => update(item, { status: next, note: note.lastElementChild.value }, 'Request updated.'))));
    }
    details.append(existing, upload, note, updateButtons);
    return details;
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    run(submit, async () => {
      const turn = revision;
      const data = Object.fromEntries(new FormData(form));
      const { request: item } = await request(endpoint, { method: 'POST', data });
      if (turn !== revision) return;
      form.reset();
      detail.open = false;
      await refresh();
      status(feedback, item.status === 'available' ? 'A matching edition is already in the library.' : 'Book request sent.');
    });
  });

  dialog.addEventListener('close', () => {
    revision++;
    list.replaceChildren();
    form.reset();
    status(feedback);
  });
  return (newRequest, title = '') => {
    detail.open = newRequest;
    if (newRequest) form.elements.title.value = title;
    refresh().catch(error => status(feedback, error.message, true));
  };
}
