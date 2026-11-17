/* Résumé checker: reading files on the device. Nothing here sends data anywhere.
   - .txt is decoded as UTF-8.
   - .docx is a zip archive: word/document.xml is found through the zip's central directory, inflated with the
     browser's DecompressionStream('deflate-raw') and converted by ResumeCheck.docxXmlToLines().
   - .pdf uses Mozilla's pdf.js, stored in vendor/pdfjs/ and loaded with a dynamic import() only when a PDF is chosen.
   No DOM rendering here, so Node tests can load it (they pass their own DOMParser and pdf.js). */
(function (root) {
  const RC = typeof module !== 'undefined' && module.exports ? require('./resume-check.js') : root.ResumeCheck;
  const MAX_BYTES = 5 * 1024 * 1024, MIN_PDF_CHARS = 200;
  const PDFJS = 'vendor/pdfjs/pdf.min.mjs', PDFJS_WORKER = 'vendor/pdfjs/pdf.worker.min.mjs';
  const MSG = {
    tooBig: size => `This file is ${(size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB. Save a smaller copy (a text-only PDF or .docx is usually under 1 MB), or paste the text.`,
    empty: 'This file is empty. Choose another file or paste the text.',
    image: 'This is an image. The checker cannot read text in images (there is no OCR). Upload a PDF, Word (.docx) or .txt file, or paste the text.',
    doc: 'Old Word (.doc) files are not supported. In Word, use File › Save As › Word Document (.docx), or upload a PDF, or paste the text.',
    pages: 'Pages files are not supported. In Pages, use File › Export To › Word (.docx) or PDF, or paste the text.',
    odt: 'OpenDocument (.odt) files are not supported. Save as Word (.docx) or PDF, or paste the text.',
    other: 'This file type is not supported. Upload a PDF, Word (.docx) or .txt file, or paste the text.',
    zip: 'This .docx file could not be opened: it does not look like a valid Word document (the zip archive is damaged or incomplete). Re-save it from Word as .docx, upload a PDF, or paste the text.',
    noDocument: 'This file is a zip archive but has no Word document inside (word/document.xml is missing). Re-save it from Word as .docx, or paste the text.',
    method: 'This .docx uses a compression method the browser cannot unpack. Re-save it from Word, upload a PDF, or paste the text.',
    noInflate: 'This browser cannot unpack .docx files (DecompressionStream is not available). Paste the text instead, or try a current version of Chrome, Edge, Firefox or Safari.',
    xml: 'The text inside this .docx could not be read. Re-save it from Word, upload a PDF, or paste the text.',
    pdfLoad: 'PDF reading needs the hosted site or `npm start`. Upload a .docx or paste the text instead.',
    pdfBroken: 'This PDF could not be read. It may be damaged. Try re-exporting it, upload a .docx, or paste the text.',
    password: 'This PDF is password-protected. Remove the password (print or export a copy without one), upload a .docx, or paste the text.',
    scanned: 'This looks like a scanned or image-only PDF: it has almost no readable text. The checker does not do OCR. Upload the original Word file or a PDF exported from it, or paste the text.'
  };
  class ResumeFileError extends Error { constructor(message, code) { super(message); this.name = 'ResumeFileError'; this.code = code; } }
  const fail = (code, msg = MSG[code]) => { throw new ResumeFileError(msg, code); };

  /** Decides how to read a file from its name and type, or explains why it is rejected. */
  function kindOf(file) {
    const name = String(file && file.name || '').toLowerCase(), type = String(file && file.type || '').toLowerCase();
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
    if (ext === 'pdf' || type === 'application/pdf') return { kind: 'pdf', label: 'PDF' };
    if (ext === 'docx' || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return { kind: 'docx', label: 'Word (.docx)' };
    if (ext === 'txt' || (type === 'text/plain' && !ext)) return { kind: 'txt', label: 'Text (.txt)' };
    if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tif', 'tiff', 'svg'].includes(ext)) return { error: MSG.image, code: 'image' };
    if (ext === 'doc' || type === 'application/msword') return { error: MSG.doc, code: 'doc' };
    if (ext === 'pages') return { error: MSG.pages, code: 'pages' };
    if (ext === 'odt') return { error: MSG.odt, code: 'odt' };
    return { error: MSG.other, code: 'other' };
  }
  /** Rejects oversized, empty and unsupported files before anything is read. */
  function check(file) {
    if (!file) return { ok: false, code: 'other', message: MSG.other };
    const k = kindOf(file);
    if (k.error) return { ok: false, code: k.code, message: k.error };
    if (file.size > MAX_BYTES) return { ok: false, code: 'tooBig', message: MSG.tooBig(file.size) };
    if (file.size === 0) return { ok: false, code: 'empty', message: MSG.empty };
    return { ok: true, kind: k.kind, label: k.label };
  }

  /* ---------- Zip ---------- */
  const u16 = (b, o) => b[o] | (b[o + 1] << 8), u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  /** Lists entries from the zip central directory: [{ name, method, compressedSize, size, offset }]. */
  function zipEntries(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (b.length < 22) fail('zip');
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) fail('zip');
    const count = u16(b, eocd + 10), size = u32(b, eocd + 12), start = u32(b, eocd + 16);
    if (start + size > b.length || count === 0xffff) fail('zip');
    const out = []; let p = start;
    const dec = new TextDecoder('utf-8');
    for (let n = 0; n < count; n++) {
      if (p + 46 > b.length || u32(b, p) !== 0x02014b50) fail('zip');
      const method = u16(b, p + 10), compressedSize = u32(b, p + 20), sz = u32(b, p + 24), nameLen = u16(b, p + 28), extraLen = u16(b, p + 30), commentLen = u16(b, p + 32), offset = u32(b, p + 42);
      out.push({ name: dec.decode(b.subarray(p + 46, p + 46 + nameLen)), method, compressedSize, size: sz, offset });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  }
  async function inflateRaw(data, DS = root && root.DecompressionStream) {
    if (typeof DS !== 'function') fail('noInflate');
    const ds = new DS('deflate-raw'), writer = ds.writable.getWriter(), reader = ds.readable.getReader();
    writer.write(data).catch(() => {}); writer.close().catch(() => {});
    const chunks = []; let total = 0;
    for (;;) { const { value, done } = await reader.read(); if (done) break; chunks.push(value); total += value.length; if (total > 50 * 1024 * 1024) fail('zip'); }
    const out = new Uint8Array(total); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }
  /** Reads one file from a zip archive, handling stored (0) and deflated (8) entries. */
  async function readZipEntry(bytes, name, opts = {}) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const entry = zipEntries(b).find(e => e.name === name);
    if (!entry) fail('noDocument');
    const p = entry.offset;
    if (p + 30 > b.length || u32(b, p) !== 0x04034b50) fail('zip');
    const dataStart = p + 30 + u16(b, p + 26) + u16(b, p + 28), data = b.subarray(dataStart, dataStart + entry.compressedSize);
    if (data.length !== entry.compressedSize) fail('zip');
    if (entry.method === 0) return data;
    if (entry.method !== 8) fail('method');
    try { return await inflateRaw(data, opts.DecompressionStream || (root && root.DecompressionStream)); }
    catch (e) { if (e instanceof ResumeFileError) throw e; fail('zip'); }
  }

  /* ---------- Readers ---------- */
  function readTxt(buffer) { return { text: RC.cleanText(new TextDecoder('utf-8').decode(buffer)).replace(/^﻿/, '').trim(), notes: [] }; }
  async function readDocx(buffer, opts = {}) {
    const xmlBytes = await readZipEntry(buffer, 'word/document.xml', opts);
    let res; try { res = RC.docxXmlToLines(new TextDecoder('utf-8').decode(xmlBytes), opts.DOMParser || (root && root.DOMParser)); } catch { fail('xml'); }
    return { text: res.text, notes: ['Text inside text boxes, tables, headers and footers may be missing. Compare with your original.'], headings: res.headings, bullets: res.bullets };
  }
  let pdfjsPromise = null;
  /** Loads pdf.js from this site, once, only when a PDF is chosen. Tests replace it with ResumeFiles.setPdfLoader(). */
  function defaultPdfLoader() {
    const base = (root && root.document && root.document.baseURI) || (root && root.location && root.location.href);
    const url = new URL(PDFJS, base).href, worker = new URL(PDFJS_WORKER, base).href;
    if (/^file:/i.test(url)) return Promise.reject(new ResumeFileError(MSG.pdfLoad, 'pdfLoad'));
    return import(url).then(lib => { lib.GlobalWorkerOptions.workerSrc = worker; return lib; });
  }
  let pdfLoader = defaultPdfLoader;
  function loadPdfjs() {
    if (!pdfjsPromise) pdfjsPromise = Promise.resolve().then(() => pdfLoader()).catch(e => { pdfjsPromise = null; throw new ResumeFileError(MSG.pdfLoad, 'pdfLoad'); });
    return pdfjsPromise;
  }
  function setPdfLoader(fn) { pdfLoader = fn || defaultPdfLoader; pdfjsPromise = null; }
  // One pdf.js worker for the page, so a second PDF does not download the worker script again.
  const workers = new WeakMap();
  function workerFor(lib) {
    if (typeof root.Worker !== 'function' || typeof lib.PDFWorker !== 'function') return undefined;
    if (!workers.has(lib)) workers.set(lib, new lib.PDFWorker());
    return workers.get(lib);
  }
  async function readPdf(buffer, opts = {}) {
    const lib = opts.pdfjs || await loadPdfjs();
    // No cMapUrl, standardFontDataUrl or wasmUrl: pdf.js never fetches anything else. Text extraction does not need them.
    let doc;
    try { doc = await lib.getDocument({ data: new Uint8Array(buffer), worker: workerFor(lib), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, disableAutoFetch: true, disableStream: true, stopAtErrors: false, verbosity: 0 }).promise; }
    catch (e) { if (e && (e.name === 'PasswordException' || /password/i.test(e.message || ''))) fail('password'); fail('pdfBroken'); }
    const items = [], pages = doc.numPages;
    try {
      for (let p = 1; p <= pages; p++) {
        const page = await doc.getPage(p), tc = await page.getTextContent();
        for (const i of tc.items) if (typeof i.str === 'string') items.push({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height || Math.hypot(i.transform[2], i.transform[3]), page: p });
      }
    } catch { fail('pdfBroken'); } finally { try { doc.destroy(); } catch { /* already gone */ } }
    const res = RC.pdfItemsToLines(items);
    if (res.chars < MIN_PDF_CHARS) fail('scanned');
    const notes = ['Two-column layouts can come out in the wrong order. Check the order in the box below.'];
    if (res.columns) notes.unshift(`Found a two-column layout on ${res.columns === 1 ? 'one page' : res.columns + ' pages'}: the left column is placed before the right one.`);
    return { text: res.text, notes, pages };
  }
  const readers = { txt: readTxt, docx: readDocx, pdf: readPdf };

  /** Reads a File (or Blob with a name) on this device and returns { text, kind, label, name, notes, stats }. */
  async function readFile(file, opts = {}) {
    const c = check(file);
    if (!c.ok) throw new ResumeFileError(c.message, c.code);
    const buffer = await (file.arrayBuffer ? file.arrayBuffer() : new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsArrayBuffer(file); }));
    const res = await readers[c.kind](buffer, opts);
    if (!res.text.trim()) fail(c.kind === 'pdf' ? 'scanned' : 'empty', c.kind === 'pdf' ? MSG.scanned : 'No text was found in this file. Paste the text instead.');
    return { ...res, kind: c.kind, label: c.label, name: String(file.name || ''), size: file.size, stats: RC.stats(res.text) };
  }

  const api = { MAX_BYTES, MIN_PDF_CHARS, MSG, ResumeFileError, kindOf, check, zipEntries, readZipEntry, inflateRaw, readTxt, readDocx, readPdf, readFile, loadPdfjs, setPdfLoader, PDFJS, PDFJS_WORKER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ResumeFiles = api;
})(this);
