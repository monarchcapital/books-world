'use strict';

const bookFormats = new Set(['pdf', 'epub', 'mobi', 'azw', 'azw3', 'azw4', 'kfx', 'fb2', 'djvu', 'djv', 'cbz', 'cbr', 'lit', 'lrf', 'pdb', 'chm']);
const releaseApi = 'https://api.github.com/repos/monarchcapital/books-world';
const releaseDownloads = 'https://github.com/monarchcapital/books-world/releases/download/';
const pageSize = 40;
const elements = Object.fromEntries(['open-folder', 'folder', 'search', 'format', 'summary', 'books', 'pagination', 'previous', 'next', 'page-number']
  .map(id => [id, document.getElementById(id)]));
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
let library = [];
let page = 0;
let catalogRequest = 0;
let visibleObjectUrls = [];

function normalize(value) {
  return value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, ' ');
}

function bookDetails({ name, size, title: suppliedTitle, file, url }) {
  if (typeof name !== 'string' || !Number.isSafeInteger(size) || size < 0) return null;
  const extension = name.split('.').at(-1).toLowerCase();
  if (!name.includes('.') || !bookFormats.has(extension)) return null;
  const stem = name.slice(0, -extension.length - 1);
  const title = (suppliedTitle || stem).replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || name;
  const searchText = normalize(title);
  if (file) return { name, size, title, extension, searchText, file };
  if (typeof url !== 'string' || !url) return null;
  try {
    const target = new URL(url, window.location.href);
    if (target.protocol !== 'https:' && target.origin !== window.location.origin) return null;
    if (target.protocol !== 'https:' && target.protocol !== 'http:') return null;
    return { name, size, title, extension, searchText, url: target.href };
  } catch {
    return null;
  }
}

function formatSize(size) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: unit ? 1 : 0 });
  return `${number.format(size)} ${units[unit]}`;
}

function setLibrary(entries, emptyMessage) {
  library = entries.map(bookDetails).filter(Boolean).sort((a, b) => collator.compare(a.title, b.title));
  elements.search.value = '';
  elements.search.disabled = library.length === 0;
  elements.format.replaceChildren(new Option('All formats', ''));
  const formats = [...new Set(library.map(book => book.extension))].sort();
  for (const extension of formats) elements.format.add(new Option(extension.toUpperCase(), extension));
  elements.format.disabled = library.length === 0;
  page = 0;
  render();
  if (library.length === 0) elements.summary.textContent = emptyMessage;
}

function render() {
  const query = normalize(elements.search.value).split(/\s+/).filter(Boolean);
  const selectedFormat = elements.format.value;
  const results = library.filter(book => {
    if (selectedFormat && book.extension !== selectedFormat) return false;
    return query.every(word => book.searchText.includes(word));
  });
  const pages = Math.max(1, Math.ceil(results.length / pageSize));
  page = Math.min(page, pages - 1);
  for (const url of visibleObjectUrls) URL.revokeObjectURL(url);
  visibleObjectUrls = [];
  const rows = document.createDocumentFragment();
  for (const book of results.slice(page * pageSize, (page + 1) * pageSize)) {
    const row = document.createElement('li');
    row.className = 'book';
    const art = document.createElement('span');
    art.className = 'book-art';
    art.setAttribute('aria-hidden', 'true');
    const info = document.createElement('div');
    info.className = 'book-info';
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = book.title;
    const details = document.createElement('span');
    details.className = 'details';
    details.textContent = `${book.extension.toUpperCase()} · ${formatSize(book.size)}`;
    const link = document.createElement('a');
    link.className = 'download';
    link.textContent = 'Download';
    link.setAttribute('aria-label', `Download ${book.title} (${book.extension.toUpperCase()})`);
    if (book.file) {
      const url = URL.createObjectURL(book.file);
      visibleObjectUrls.push(url);
      link.href = url;
    } else {
      link.href = book.url;
    }
    link.download = book.name;
    info.append(title, details);
    row.append(art, info, link);
    rows.append(row);
  }
  elements.books.replaceChildren(rows);
  if (results.length === 0) {
    elements.summary.textContent = 'No books match your search.';
  } else {
    const noun = results.length === 1 ? 'book' : 'books';
    elements.summary.textContent = results.length === library.length
      ? `${results.length.toLocaleString()} ${noun}`
      : `${results.length.toLocaleString()} of ${library.length.toLocaleString()} books`;
  }
  elements.pagination.hidden = pages === 1;
  elements.previous.disabled = page === 0;
  elements.next.disabled = page === pages - 1;
  elements['page-number'].textContent = `Page ${page + 1} of ${pages}`;
}

elements['open-folder'].addEventListener('click', () => elements.folder.click());
elements.folder.addEventListener('change', () => {
  const entries = [...elements.folder.files].map(file => ({ name: file.name, size: file.size, file }));
  if (!entries.length) return;
  catalogRequest++;
  setLibrary(entries, 'No supported book files were found in that folder.');
  elements.folder.value = '';
});

for (const [element, event] of [[elements.search, 'input'], [elements.format, 'change']]) {
  element.addEventListener(event, () => { page = 0; render(); });
}
elements.previous.addEventListener('click', () => { page--; render(); });
elements.next.addEventListener('click', () => { page++; render(); });

async function listGitHubItems(endpoint) {
  const items = [];
  for (let pageNumber = 1; ; pageNumber++) {
    const response = await fetch(`${releaseApi}/${endpoint}?per_page=100&page=${pageNumber}`, {
      cache: 'no-cache',
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);
    const pageItems = await response.json();
    if (!Array.isArray(pageItems)) throw new Error('Invalid GitHub response');
    items.push(...pageItems);
    if (pageItems.length < 100) return items;
  }
}

async function loadReleaseCatalog() {
  const allReleases = await listGitHubItems('releases');
  const releases = allReleases.filter(release => !release.draft && /^books-[\w-]+$/.test(release.tag_name));
  const assetLists = await Promise.all(releases.map(release => listGitHubItems(`releases/${release.id}/assets`)));
  return assetLists.flat().filter(asset => asset.state === 'uploaded' && asset.browser_download_url?.startsWith(releaseDownloads)).map(asset => {
    const extensionStart = asset.name.lastIndexOf('.');
    const title = asset.label || asset.name.slice(0, extensionStart).replace(/[._]+/g, ' ');
    return { name: asset.name, title, size: asset.size, url: asset.browser_download_url };
  });
}

async function loadHostedCatalog() {
  const request = ++catalogRequest;
  if (window.location.protocol === 'file:') {
    elements.summary.textContent = 'Open your Books World folder to browse and download its books.';
    return;
  }

  try {
    const response = await fetch('./books.json');
    const entries = response.ok ? await response.json() : await loadReleaseCatalog();
    if (!Array.isArray(entries)) throw new Error('Invalid catalog');
    if (request === catalogRequest) setLibrary(entries, 'The first books will appear here when their release is published.');
  } catch {
    if (request === catalogRequest) elements.summary.textContent = 'The online catalog could not be loaded. Refresh to try again, or open a local folder.';
  }
}

loadHostedCatalog();
