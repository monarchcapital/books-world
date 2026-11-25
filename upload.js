'use strict';

(() => {
  const api = document.body.dataset.uploadApi;
  if (!api) return;

  const open = document.getElementById('open-upload');
  const close = document.getElementById('close-upload');
  const dialog = document.getElementById('upload-dialog');
  const form = document.getElementById('upload-form');
  const picker = document.getElementById('upload-file');
  const titleField = document.getElementById('book-title');
  const authorField = document.getElementById('book-author');
  const uploaderField = document.getElementById('book-uploader');
  const status = document.getElementById('upload-status');
  const publish = document.getElementById('publish-upload');
  const displayNameKey = 'formyria.uploader-display-name';
  const maximumBytes = 25 * 1024 * 1024;
  let inspection = 0;
  let publishing = false;

  function tidy(value) {
    return (Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : '').replace(/\s+/g, ' ').trim();
  }

  function xml(data) {
    return new DOMParser().parseFromString(new TextDecoder().decode(data), 'application/xml');
  }

  async function epubDetails(file) {
    const { unzipSync } = await import('./fflate.mjs');
    const bytes = new Uint8Array(await file.arrayBuffer());
    function entry(path) {
      return unzipSync(bytes, { filter: item => item.name === path && item.originalSize <= 256 * 1024 })[path];
    }
    const container = entry('META-INF/container.xml');
    if (!container) return {};
    const root = xml(container).getElementsByTagNameNS('*', 'rootfile')[0];
    const packagePath = root?.getAttribute('full-path');
    const packageData = packagePath && entry(packagePath);
    if (!packageData) return {};
    const metadata = xml(packageData).getElementsByTagNameNS('*', 'metadata')[0];
    if (!metadata) return {};
    return {
      title: tidy(metadata.getElementsByTagNameNS('*', 'title')[0]?.textContent),
      author: tidy([...metadata.getElementsByTagNameNS('*', 'creator')].map(node => node.textContent).filter(Boolean)),
    };
  }

  async function pdfDetails(file) {
    const pdf = await import('./pdf.min.mjs');
    pdf.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.min.mjs', document.baseURI).href;
    const loading = pdf.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
    try {
      const document = await loading.promise;
      const { info, metadata } = await document.getMetadata();
      return { title: tidy(metadata?.get('dc:title') || info?.Title), author: tidy(metadata?.get('dc:creator') || info?.Author) };
    } finally { await loading.destroy(); }
  }

  function formatOf(file) {
    const extension = file?.name.split('.').pop().toLowerCase();
    return extension === 'pdf' || extension === 'epub' ? extension : '';
  }

  open.hidden = false;
  open.addEventListener('click', () => {
    if (!uploaderField.value) {
      try { uploaderField.value = localStorage.getItem(displayNameKey) || ''; } catch { /* Storage can be disabled. */ }
    }
    dialog.showModal();
  });
  close.addEventListener('click', () => { if (!publishing) dialog.close(); });
  dialog.addEventListener('cancel', event => { if (publishing) event.preventDefault(); });

  picker.addEventListener('change', async () => {
    const current = ++inspection;
    const file = picker.files[0];
    const format = formatOf(file);
    picker.setCustomValidity('');
    titleField.value = '';
    authorField.value = '';
    status.textContent = '';
    if (!file) return;
    if (!format || file.size === 0 || file.size > maximumBytes) {
      const error = 'Choose a PDF or EPUB book no larger than 25 MB.';
      picker.setCustomValidity(error);
      status.textContent = error;
      return;
    }

    const initialTitle = tidy(file.name.slice(0, -(format.length + 1)).replace(/_+/g, ' ')).slice(0, titleField.maxLength);
    titleField.value = initialTitle;
    status.textContent = 'Reading book details…';
    let metadata = {};
    try { metadata = await (format === 'epub' ? epubDetails(file) : pdfDetails(file)); } catch { /* Editable fields already provide a fallback. */ }
    if (current !== inspection || publishing) return;
    if (metadata.title && titleField.value === initialTitle && !/^(untitled|unknown)$/i.test(metadata.title)) {
      titleField.value = metadata.title.slice(0, titleField.maxLength);
    }
    if (!authorField.value && metadata.author) authorField.value = metadata.author.slice(0, authorField.maxLength);
    status.textContent = authorField.value ? '' : 'Enter the author’s name if the file didn’t include it.';
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (publishing || !form.reportValidity()) return;
    const file = picker.files[0];
    const format = formatOf(file);
    const title = tidy(titleField.value);
    const author = tidy(authorField.value);
    const uploader = tidy(uploaderField.value);
    if (!title || !author || !uploader) {
      status.textContent = 'Enter a title, an author, and your uploader display name.';
      return;
    }

    publishing = true;
    close.disabled = true;
    publish.disabled = true;
    status.textContent = 'Publishing your book…';
    try {
      const response = await fetch(new URL('/api/books', api), {
        method: 'POST',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Book-Format': format,
          'X-Book-Title': encodeURIComponent(title),
          'X-Book-Author': encodeURIComponent(author),
          'X-Book-Uploader': encodeURIComponent(uploader),
        },
        body: file,
        signal: AbortSignal.timeout(180000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.book) throw new Error(result.error || 'The upload didn’t finish. Please try again.');
      try { localStorage.setItem(displayNameKey, uploader); } catch { /* Storage can be disabled. */ }
      form.reset();
      uploaderField.value = uploader;
      status.textContent = result.alreadyPublished ? 'This file is already available in the library.' : 'Your book is now available in the library.';
      window.dispatchEvent(new CustomEvent('formyria:book-published', { detail: result.book }));
    } catch (error) {
      status.textContent = error.message || 'The upload didn’t finish. Please try again.';
    } finally {
      publishing = false;
      close.disabled = false;
      publish.disabled = false;
    }
  });
})();
