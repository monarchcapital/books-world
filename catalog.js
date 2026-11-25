'use strict';

const bookFormats = new Set(['pdf', 'epub', 'mobi', 'azw', 'azw3', 'azw4', 'kfx', 'fb2', 'djvu', 'djv', 'cbz', 'cbr', 'lit', 'lrf', 'pdb', 'chm']);
const releaseApi = 'https://api.github.com/repos/monarchcapital/books-world';
const releaseDownloads = 'https://github.com/monarchcapital/books-world/releases/download/';
const pageSize = 40;
const genreRules = [
  ['fiction', 'Fiction & literature', /\b(amish tripathi|immortals of meluha|secret of the nagas|oath of the vayuputras|scion of ikshvaku|premchand|krishn\s?chandar|bankim\s?chandra|anandmath|my cousin rachel|jhumpa lahiri|the namesake|stephen chbosky|perks of being a wallflower|tagore|shesher kabita|paradise lost|john milton|jill santopolo|orhan pamuk|claire keegan|novel|short stories|poetry)\b/],
  ['self-help', 'Self-help', /\b(scott peck|road less traveled|rhythm of life|first 20 hours|you were born rich|personal growth|self help|happiness|habits|productivity|ultimate meaning|think and grow rich|power of positive thinking)\b/],
  ['technology', 'Technology', /\b(electrical|electronic|electronics|engineering|modern manufacturing|control system|catia|computational intelligence|fuzzy logic|neural networks?|computer|computing|windows [0-9]+|excel|information technology|communication technology|data intensive|signals and systems|surveying techniques|strength of materials|power systems?|steel structures|python|java|machine learning|programming|software|cybersecurity|machining|mechanical)\b/],
  ['finance', 'Finance & economics', /\b(finance|financial|economics|economy|investing|accounting|valuation|banking|stock market|money management)\b/],
  ['business', 'Business', /\b(business|six sigma|mba|general motors|ben horowitz|hard thing about hard things|management|leadership|marketing|entrepreneurship|startup)\b/],
  ['history', 'History & biography', /\b(history|biography|autobiography|memoirs?|hitler|savarkar|subhash chandra bose|reminiscences|philip van doren stern|stories i must tell|his majesty s opponent)\b/],
  ['mythology', 'Mythology & spirituality', /\b(devdutt|pattanaik|vedas|mahabharata|ramayana|bhagavad|mythology|spirituality|upanishads?|rituals of happy soul)\b/],
  ['study', 'Study & reference', /\b(lucent|essays?|essay writing|general knowledge|general awareness|upkar|general science|ssc|upsc|advanced maths|advance maths|vocabulary|exams?|grammar|shabdavali|words of power|study guide)\b/],
  ['science', 'Science & health', /\b(science|physics|chemistry|biology|medicine|psychology|einstein|contact lenses|mathematics|astronomy|health)\b/],
  ['uncategorized', 'Uncategorized', null],
];
const genreLabels = new Map(genreRules.map(([genre, label]) => [genre, label]));
const elements = Object.fromEntries(['open-folder', 'folder', 'search', 'format', 'genre-filter', 'genres', 'summary', 'books', 'pagination', 'previous', 'next', 'page-number']
  .map(id => [id, document.getElementById(id)]));
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
let library = [];
let page = 0;
let selectedGenre = '';
let catalogRequest = 0;
let visibleObjectUrls = [];

function normalize(value) {
  return value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, ' ');
}

function bookDetails({ name, size, title: suppliedTitle, genre: suppliedGenre, file, url }) {
  if (typeof name !== 'string' || !Number.isSafeInteger(size) || size < 0) return null;
  const extension = name.split('.').at(-1).toLowerCase();
  if (!name.includes('.') || !bookFormats.has(extension)) return null;
  const stem = name.slice(0, -extension.length - 1);
  const title = (suppliedTitle || stem).replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || name;
  const searchText = normalize(title);
  const genre = genreLabels.has(suppliedGenre) ? suppliedGenre : (genreRules.find(([, , pattern]) => pattern?.test(searchText))?.[0] ?? 'uncategorized');
  const searchable = `${searchText} ${normalize(genreLabels.get(genre))}`;
  if (file) return { name, size, title, extension, genre, searchable, file };
  if (typeof url !== 'string' || !url) return null;
  try {
    const target = new URL(url, window.location.href);
    if (target.protocol !== 'https:' && target.origin !== window.location.origin) return null;
    if (target.protocol !== 'https:' && target.protocol !== 'http:') return null;
    return { name, size, title, extension, genre, searchable, url: target.href };
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

function setLibrary(entries, emptyMessage, preserveFilters = false) {
  library = entries.map(bookDetails).filter(Boolean).sort((a, b) => collator.compare(a.title, b.title));
  const previousFormat = preserveFilters ? elements.format.value : '';
  if (!preserveFilters) {
    elements.search.value = '';
    selectedGenre = '';
    page = 0;
  }
  elements.search.disabled = library.length === 0;
  elements.format.replaceChildren(new Option('All formats', ''));
  const formats = [...new Set(library.map(book => book.extension))].sort();
  for (const extension of formats) elements.format.add(new Option(extension.toUpperCase(), extension));
  if (formats.includes(previousFormat)) elements.format.value = previousFormat;
  elements.format.disabled = library.length === 0;
  const counts = new Map([['', library.length]]);
  for (const book of library) counts.set(book.genre, (counts.get(book.genre) ?? 0) + 1);
  if (!counts.has(selectedGenre)) selectedGenre = '';
  const genreButtons = document.createDocumentFragment();
  for (const [genre, label] of [['', 'All genres'], ...genreLabels]) {
    const count = counts.get(genre);
    if (!count) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'genre-button';
    button.dataset.genre = genre;
    button.setAttribute('aria-pressed', String(genre === selectedGenre));
    button.textContent = label;
    const badge = document.createElement('span');
    badge.className = 'genre-count';
    badge.textContent = count.toLocaleString();
    button.append(badge);
    genreButtons.append(button);
  }
  elements.genres.replaceChildren(genreButtons);
  elements['genre-filter'].hidden = library.length === 0;
  render();
  if (library.length === 0) elements.summary.textContent = emptyMessage;
}

function render() {
  const query = normalize(elements.search.value).split(/\s+/).filter(Boolean);
  const selectedFormat = elements.format.value;
  const results = library.filter(book => {
    if (selectedFormat && book.extension !== selectedFormat) return false;
    if (selectedGenre && book.genre !== selectedGenre) return false;
    return query.every(word => book.searchable.includes(word));
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
    details.textContent = `${book.extension.toUpperCase()} · ${formatSize(book.size)} · ${genreLabels.get(book.genre)}`;
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
elements.genres.addEventListener('click', event => {
  const button = event.target.closest('button[data-genre]');
  if (!button || button.dataset.genre === selectedGenre) return;
  elements.genres.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
  selectedGenre = button.dataset.genre;
  button.setAttribute('aria-pressed', 'true');
  page = 0;
  render();
});
elements.previous.addEventListener('click', () => { page--; render(); });
elements.next.addEventListener('click', () => { page++; render(); });

async function listGitHubItems(endpoint) {
  const items = [];
  for (let pageNumber = 1; ; pageNumber++) {
    const response = await fetch(`${releaseApi}/${endpoint}?per_page=100&page=${pageNumber}`, {
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
  const assetLists = await Promise.all(releases.map(release => (
    Array.isArray(release.assets) && release.assets.length < 30
      ? release.assets
      : listGitHubItems(`releases/${release.id}/assets`)
  )));
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

  const emptyMessage = 'The first books will appear here when their release is published.';
  let savedEntries = [];
  try {
    const response = await fetch('./books.json', { cache: 'no-cache' });
    if (response.ok) {
      const entries = await response.json();
      if (Array.isArray(entries)) savedEntries = entries;
    }
  } catch {
    // Older deployments may have no snapshot. The release catalog can still load.
  }
  if (request !== catalogRequest) return;
  if (savedEntries.length) setLibrary(savedEntries, emptyMessage);

  try {
    const liveEntries = await loadReleaseCatalog();
    if (request !== catalogRequest) return;
    const merged = new Map(savedEntries.map(entry => [entry.url, entry]));
    for (const entry of liveEntries) {
      if (!merged.has(entry.url)) merged.set(entry.url, entry);
    }
    if (!savedEntries.length || merged.size > savedEntries.length) {
      setLibrary([...merged.values()], emptyMessage, savedEntries.length > 0);
    }
  } catch {
    if (!savedEntries.length && request === catalogRequest) {
      elements.summary.textContent = 'The online catalog could not be loaded. Refresh to try again, or open a local folder.';
    }
  }
}

loadHostedCatalog();
