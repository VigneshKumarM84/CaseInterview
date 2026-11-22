/* Résumé builder: the screen. Turns an old résumé and a list of points into an editable form with a live,
   page-accurate preview that fits one or two pages. The logic (building, ranking, fitting, output) is in
   resume-build.js and has no DOM; this file is the form, the preview, printing and the optional AI step.
   Runs in the browser with no server. Nothing is stored unless "Remember this résumé" is ticked. */
(() => {
  const RB = ResumeBuild, RC = ResumeCheck, RF = ResumeFiles, WORDS = ResumeWords;
  const KEY = 'cr-resume-build';
  const ACCEPT = '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';
  const MM = 96 / 25.4, PAGE_W = 210 * MM, PAGE_H = 297 * MM, CONTENT_H = 273 * MM, TOP = 12;
  const NEW_TYPES = ['experience', 'projects', 'education', 'responsibility', 'achievements', 'skills', 'other'];

  let stage = 'input', model = null, template = 'classic', pages = 1, plan = null, remember = false;
  let draft = { resume: '', points: '' }, fileInfo = null, readToken = 0, fitTimer = null, aiBusy = false;

  // A résumé kept on this device (opt-in) opens straight into the editor.
  (() => {
    const s = read(KEY, null), m = s && RB.restore(s.model);
    if (!m) return;
    model = m; remember = true; stage = 'edit';
    if (RB.TEMPLATES.some(t => t.id === s.template)) template = s.template;
    if (s.pages === 2) pages = 2;
  })();

  const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
  const msgHtml = m => esc(m).replace(/`([^`]+)`/g, '<code>$1</code>');
  function setHash(on) { try { window.history.replaceState(null, '', location.pathname + location.search + (on ? '#resume-build' : '')); } catch { /* file:// or sandboxed frames */ } }
  function open() { stopMedia(); view = 'resume-build'; setHash(true); if (model) stage = 'edit'; render(); }
  function persist() { if (remember && model) save(KEY, { model, template, pages }); }
  function forget() { try { localStorage.removeItem(KEY); } catch { /* storage blocked */ } }

  const tabsHtml = () => `<div class="rb-tabs" role="group" aria-label="Résumé tools"><button type="button" id="rbTabCheck">Check my résumé</button><button type="button" id="rbTabBuild" aria-current="page">Build a new résumé</button></div>`;

  function render() {
    stopMedia(); view = 'resume-build'; window.scrollTo(0, 0);
    clearTimeout(fitTimer); fitTimer = null;
    if (stage === 'edit' && model) renderEditStage(); else { stage = 'input'; renderInput(); }
    $('#rbTabCheck').onclick = () => ResumeTool.open();
  }

  /* ---------- Stage 1: the input ---------- */
  function fileInfoHtml() {
    if (!fileInfo) return '';
    if (fileInfo.state === 'busy') return `<p class="rc-msg busy">Reading ${esc(fileInfo.name)} on this device…</p>`;
    if (fileInfo.state === 'error') return `<p class="rc-msg error" role="alert">${fileInfo.name ? `<b>${esc(fileInfo.name)}:</b> ` : ''}${msgHtml(fileInfo.message)}</p>`;
    const r = fileInfo;
    return `<div class="rc-msg ok"><p><b>Loaded ${esc(r.name)}</b> · ${esc(r.label)} · ${Math.max(1, Math.round(r.size / 1024))} KB · ${plural(r.stats.lines, 'line')} · ${plural(r.stats.bullets, 'bullet')} found</p>
      <p><b>Check the extracted text and fix anything that came through wrong before you build.</b></p>
      ${r.notes.length ? `<ul>${r.notes.map(n => `<li>${msgHtml(n)}</li>`).join('')}</ul>` : ''}</div>`;
  }
  const showFileInfo = () => { if ($('#rbFileInfo')) $('#rbFileInfo').innerHTML = fileInfoHtml(); };
  const checkerText = () => { try { return ResumeTool.state().draft.resume || ''; } catch { return ''; } };

  function renderInput() {
    $('#app').innerHTML = `${tabsHtml()}<div class="rc-head"><div class="eyebrow">RÉSUMÉ BUILDER · FREE · NO AI NEEDED</div><h1 class="drill-title">Build a clean <em>one-page</em> résumé</h1>
      <p class="lead">Start from your old résumé, a list of things you have done, or both. You get an editable form, a live preview and a one-page layout that leaves out your weakest bullets first.</p></div>
      <p class="rc-privacy"><b>Your file is read in your browser. Nothing is uploaded.</b> The builder runs on this device, and nothing is stored unless you tick “Remember this résumé”.</p>
      <section class="panel rc-input rb-input">
        <h2>1. Your old résumé <span class="note">(optional)</span></h2>
        <div class="rc-drop" id="rbDrop">
          <label class="rc-pick" for="rbFile">Choose a file</label><input type="file" id="rbFile" class="rc-file" accept="${ACCEPT}">
          <span class="note">or drag it here. PDF, Word (.docx) or .txt, up to 5 MB.</span>
          <button type="button" id="rbSample">Load a sample</button>
          ${checkerText().trim() ? '<button type="button" id="rbFromChecker">Use the text from the checker</button>' : ''}
        </div>
        <div id="rbFileInfo" class="rc-file-info" aria-live="polite">${fileInfoHtml()}</div>
        <label for="rbResume" class="sr-only">Résumé text</label>
        <textarea id="rbResume" class="rb-resume" spellcheck="true" placeholder="Paste your résumé text here, or choose a file above.">${esc(draft.resume)}</textarea>
        <h2>2. Everything else you have done <span class="note">(optional)</span></h2>
        <label for="rbPoints" class="sr-only">Other points</label>
        <textarea id="rbPoints" class="rb-points" spellcheck="true" placeholder="Won 2nd place among 40 teams at the college case competition&#10;B.Tech Computer Science, ABC Institute · 2022–2026 · CGPA 8.1&#10;Data Analyst Intern, Acme Foods · Jun–Aug 2025&#10;- Built a Power BI dashboard for 40 stores, cutting reporting time by 6 hours a week&#10;Python, SQL, Excel, Power BI">${esc(draft.points)}</textarea>
        <p class="note">One point per line. Put a heading line such as “Data Analyst Intern, Acme Foods · Jun–Aug 2025” above the points that belong to it. Lines on their own are sorted into sections by keywords, so check where they land.</p>
        <div id="rbError" aria-live="polite"></div>
        <div class="actions"><button class="primary" id="rbBuild" type="button">Build my résumé</button></div>
      </section>`;
    const input = $('#rbFile'), drop = $('#rbDrop');
    input.onchange = () => { const f = input.files && input.files[0]; input.value = ''; if (f) takeFile(f); };
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) takeFile(f); });
    $('#rbResume').oninput = e => { draft.resume = e.target.value; };
    $('#rbPoints').oninput = e => { draft.points = e.target.value; };
    $('#rbSample').onclick = () => { draft.resume = WORDS.SAMPLE_RESUME; $('#rbResume').value = draft.resume; fileInfo = null; showFileInfo(); toast('Loaded a fictional sample résumé. Replace it with yours when you are ready.'); };
    if ($('#rbFromChecker')) $('#rbFromChecker').onclick = () => { draft.resume = checkerText(); $('#rbResume').value = draft.resume; fileInfo = null; showFileInfo(); };
    $('#rbBuild').onclick = () => {
      draft.resume = $('#rbResume').value; draft.points = $('#rbPoints').value;
      const m = RB.build(draft.resume, draft.points);
      if (!m.name && !m.sections.length) { $('#rbError').innerHTML = '<p class="rc-msg error" role="alert">Nothing to build from yet. Paste your résumé text, choose a file, or add a few points first.</p>'; return; }
      model = m; plan = null; stage = 'edit'; persist(); render();
    };
  }

  async function takeFile(file) {
    const token = ++readToken, c = RF.check(file);
    if (!c.ok) { fileInfo = { state: 'error', name: file ? file.name : '', message: c.message }; showFileInfo(); return; }
    fileInfo = { state: 'busy', name: file.name }; showFileInfo();
    try {
      const res = await RF.readFile(file);
      if (token !== readToken) return;
      fileInfo = { state: 'ok', name: res.name, label: res.label, size: res.size, stats: res.stats, notes: res.notes };
      draft.resume = res.text; if ($('#rbResume')) $('#rbResume').value = res.text;
    } catch (e) {
      if (token !== readToken) return;
      fileInfo = { state: 'error', name: file.name, message: e instanceof RF.ResumeFileError ? e.message : 'This file could not be read. Upload a .docx or paste the text instead.' };
    }
    showFileInfo();
  }

  /* ---------- Stage 2: the editor ---------- */
  const val = v => esc(v == null ? '' : v);
  const field = (label, id, f, value, extra = '') => `<div class="rb-field"><label for="${id}">${label}</label><input id="${id}" type="text" data-f="${f}" value="${val(value)}" autocomplete="off" ${extra}></div>`;
  const wordsOf = t => String(t || '').trim().split(/\s+/).filter(Boolean).length;

  function renderEditStage() {
    const c = model.contact;
    $('#app').innerHTML = `${tabsHtml()}<div class="rb-work">
      <div class="rb-editor" id="rbEditorCol">
        <div class="rb-top">
          <button type="button" id="rbBack">← Start again</button>
          <button type="button" id="rbJump" class="rb-jump">See the preview ↓</button>
          <label class="selfcheck rb-remember"><input type="checkbox" id="rbRemember" ${remember ? 'checked' : ''}> <span>Remember this résumé on this device<small class="note">Off by default. Saves your résumé in this browser’s local storage. Untick to delete it.</small></span></label>
        </div>
        <section class="rb-card" id="rbDetails"><h2>Your details</h2>
          <div class="rb-grid">${field('Name', 'rbName', 'name', model.name)}${field('Headline <span class="note">(optional)</span>', 'rbHeadline', 'headline', model.headline)}
          ${field('Email', 'rbEmail', 'email', c.email, 'inputmode="email"')}${field('Phone', 'rbPhone', 'phone', c.phone, 'inputmode="tel"')}${field('Location', 'rbLocation', 'location', c.location)}</div>
          <div class="rb-field"><label for="rbLinks">Links <span class="note">(one per line)</span></label><textarea id="rbLinks" rows="2" data-f="links" placeholder="linkedin.com/in/yourname">${esc((c.links || []).join('\n'))}</textarea></div>
          <div class="rb-field"><label for="rbSummary">Summary</label><textarea id="rbSummary" rows="2" data-f="summary">${esc(model.summary)}</textarea><p class="note">Optional. Two lines at most, and only if it says something specific.</p></div>
        </section>
        <div id="rbSections"></div>
      </div>
      <aside class="rb-side" id="rbSide" tabindex="-1" aria-label="Preview and download"><div class="rb-side-in">
        <div class="rb-opt"><h2>Template</h2><div class="rb-seg rb-templates" role="group" aria-label="Template">${RB.TEMPLATES.map(t => `<button type="button" data-template="${t.id}" aria-pressed="${t.id === template}"><b>${esc(t.name)}</b><span>${esc(t.note)}</span></button>`).join('')}</div></div>
        <div class="rb-opt"><h2>Length</h2><div class="rb-seg rb-lengths" role="group" aria-label="Length"><button type="button" data-pages="1" aria-pressed="${pages === 1}">One page</button><button type="button" data-pages="2" aria-pressed="${pages === 2}">Two pages</button></div></div>
        <p id="rbFitStatus" class="rb-fit" aria-live="polite"></p>
        <div class="rb-preview" id="rbPreview"></div>
        <div class="rb-actions"><button type="button" class="primary" id="rbPdf">Download PDF</button>
          <p class="note">In the print window choose Save as PDF, paper size A4, and turn off Headers and footers.</p>
          <div class="rb-actions-row"><button type="button" id="rbCopy">Copy as text</button><button type="button" id="rbTxt">Download .txt</button></div></div>
        <div class="rb-ai"><button type="button" id="rbAi">Tighten with AI (optional)</button>
          <p class="note">Sends only the bullet text — not your name or contact details — to the AI provider you set up in Settings. Uses your own API key.</p>
          <p id="rbAiStatus" class="note" role="status"></p><div id="rbReview"></div></div>
      </div></aside></div>`;
    $('#rbTabCheck').onclick = () => ResumeTool.open();
    renderSections(); bindEdit(); fitNow();
  }

  const entryOptions = () => model.sections.filter(s => !RB.isLines(s)).flatMap(s => s.entries.map(e => `<option value="${val(e.id)}">${val(s.title || RB.DEFAULT_TITLES[s.type])} › ${val(e.title || 'Untitled')}</option>`)).join('');
  const arrows = (kind, i, n) => `<button type="button" class="rb-ic" data-act="${kind}-up" aria-label="Move up" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="rb-ic" data-act="${kind}-down" aria-label="Move down" title="Move down" ${i === n - 1 ? 'disabled' : ''}>↓</button>`;
  const hintFor = (s, text) => !RB.DROPPABLE.has(s.type) || !String(text).trim() ? '' : RC.lintBullet(text).checks.filter(c => c.status === 'warn').map(c => c.label).join(' · ');

  function bulletHtml(s, e, b, i, options) {
    const lines = RB.isLines(s);
    const toggles = lines ? '' : `<button type="button" class="rb-toggle" data-act="pin" aria-pressed="${!!b.pin}" title="Always keep this on the page">${b.pin ? 'Pinned' : 'Pin'}</button><button type="button" class="rb-toggle" data-act="hide" aria-pressed="${!!b.hide}">${b.hide ? 'Hidden' : 'Hide'}</button>`;
    const move = lines ? '' : `<select data-act="move" aria-label="Move this bullet to another entry"><option value="">Move to…</option>${options}</select>`;
    const out = plan && plan.omit.has(b.id) && !b.hide;
    return `<div class="rb-bullet${out ? ' rb-left-out' : ''}" data-bid="${val(b.id)}">
      <textarea class="rb-btext" rows="${lines ? 1 : 2}" data-f="btext" aria-label="${lines ? 'Skills line' : 'Bullet text'}">${esc(b.text)}</textarea>
      <div class="rb-bctl">${toggles}${arrows('b', i, e.bullets.length)}${move}<button type="button" class="rb-del" data-act="b-del">Delete</button><span class="rb-chip" data-chip ${out ? '' : 'hidden'}>Left out to fit</span></div>
      <p class="rb-hint" data-hint>${esc(hintFor(s, b.text))}</p></div>`;
  }
  function entryHtml(s, e, i, options) {
    const id = e.id;
    return `<div class="rb-entry-card" data-eid="${val(id)}"><div class="rb-entry-top">
        ${field('Title', 'rbT' + id, 'etitle', e.title)}${field('Dates', 'rbD' + id, 'edates', e.dates)}${field('Second line', 'rbS' + id, 'esub', e.sub)}
        <div class="rb-ctl">${arrows('e', i, s.entries.length)}<button type="button" class="rb-del" data-act="e-del">Remove entry</button></div></div>
      ${e.bullets.map((b, k) => bulletHtml(s, e, b, k, options)).join('')}
      <button type="button" class="rb-add" data-act="add-bullet">Add bullet</button></div>`;
  }
  function sectionHtml(s, i, options) {
    const lines = RB.isLines(s), id = s.id;
    let body;
    if (lines) { const e = s.entries[0]; body = `<div class="rb-entry-card rb-lines" data-eid="${val(e.id)}">${e.bullets.map((b, k) => bulletHtml(s, e, b, k, options)).join('')}<button type="button" class="rb-add" data-act="add-bullet">Add line</button></div>`; }
    else body = `${s.entries.map((e, k) => entryHtml(s, e, k, options)).join('')}<button type="button" class="rb-add" data-act="add-entry">Add entry</button>`;
    return `<section class="rb-card rb-section" data-sid="${val(id)}"><div class="rb-sec-head"><div class="rb-field"><label for="rbST${id}">Section title</label><input id="rbST${id}" type="text" data-f="stitle" value="${val(s.title)}" autocomplete="off"></div>
      <div class="rb-ctl">${arrows('s', i, model.sections.length)}<button type="button" class="rb-del" data-act="s-del">Remove section</button></div></div>${body}</section>`;
  }
  function renderSections() {
    for (const s of model.sections) if (RB.isLines(s) && !s.entries.length) RB.addEntry(model, s);
    const options = entryOptions();
    $('#rbSections').innerHTML = model.sections.map((s, i) => sectionHtml(s, i, options)).join('') +
      `<div class="rb-card rb-addsec"><label for="rbAddSection">Add a section</label><select id="rbAddSection" data-act="add-section"><option value="">Choose a section…</option>${NEW_TYPES.map(t => `<option value="${t}">${val(RB.DEFAULT_TITLES[t])}</option>`).join('')}</select></div>`;
    $('#rbSections').querySelectorAll('textarea').forEach(grow);
  }
  function grow(t) { if (t.scrollHeight > 0) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; } }

  /** Re-draws the section cards after a structural change, keeping the scroll position, then focuses what the student just touched. */
  function structural(focus) {
    const y = window.scrollY || 0;
    renderSections(); if (window.scrollTo) window.scrollTo(0, y);
    if (focus) { const el = document.querySelector(focus); if (el) el.focus({ preventScroll: false }); }
    changed(true);
  }
  function changed(now) { persist(); if (now) fitNow(); else scheduleFit(); }
  function scheduleFit() { clearTimeout(fitTimer); fitTimer = setTimeout(fitNow, 300); }

  const sec = el => model.sections.find(s => s.id === el.closest('[data-sid]').dataset.sid);
  const ent = el => { const s = sec(el), id = el.closest('[data-eid]').dataset.eid; return { s, e: s.entries.find(x => x.id === id) }; };
  const swap = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return false; [arr[i], arr[j]] = [arr[j], arr[i]]; return true; };
  const sel = (attr, id, rest = '') => `[${attr}="${id}"] ${rest}`.trim();
  // After a move, focus the same arrow, or the other one when the moved item has reached an end of its list.
  const arrowFocus = (attr, id, kind) => `${sel(attr, id, `[data-act=${kind}-up]:not([disabled])`)}, ${sel(attr, id, `[data-act=${kind}-down]:not([disabled])`)}`;

  function bindEdit() {
    const body = $('#rbSections'), details = $('#rbDetails');
    details.addEventListener('input', e => {
      const f = e.target.dataset.f, v = e.target.value, c = model.contact; if (!f) return;
      if (f === 'name') model.name = v; else if (f === 'headline') model.headline = v; else if (f === 'summary') { model.summary = v; grow(e.target); }
      else if (f === 'links') { c.links = v.split('\n').map(x => x.trim()).filter(Boolean); grow(e.target); } else c[f] = v;
      changed(false);
    });
    body.addEventListener('input', e => {
      const t = e.target, f = t.dataset.f; if (!f) return;
      if (f === 'stitle') sec(t).title = t.value;
      else if (f === 'etitle' || f === 'edates' || f === 'esub') ent(t).e[{ etitle: 'title', edates: 'dates', esub: 'sub' }[f]] = t.value;
      else if (f === 'btext') {
        const { s, e } = ent(t), row = t.closest('[data-bid]'), b = e.bullets.find(x => x.id === row.dataset.bid);
        b.text = t.value.replace(/\s*\n+\s*/g, ' '); grow(t); row.querySelector('[data-hint]').textContent = hintFor(s, b.text);
      }
      changed(false);
      // Entry titles feed the "Move to…" lists, so keep those in step once the student stops typing.
      if (f === 'etitle') { clearTimeout(bindEdit.t); bindEdit.t = setTimeout(refreshOptions, 600); }
    });
    body.addEventListener('change', e => {
      const t = e.target; if (t.dataset.act === 'move' && t.value) { moveBullet(t); return; }
      if (t.dataset.act === 'add-section' && t.value) addSectionOf(t.value);
    });
    body.addEventListener('click', e => { const b = e.target.closest('button[data-act]'); if (b && body.contains(b)) act(b); });
    $('#rbBack').onclick = () => {
      if (!confirm('Start again? Your edits to this résumé will be lost. The text you pasted is kept.')) return;
      if (remember) { forget(); remember = false; }
      model = null; plan = null; stage = 'input'; render();
    };
    $('#rbJump').onclick = () => { const s = $('#rbSide'); s.scrollIntoView({ behavior: 'smooth', block: 'start' }); s.focus({ preventScroll: true }); };
    $('#rbRemember').onchange = e => {
      remember = e.target.checked;
      if (remember) { persist(); toast('Your résumé will be kept in this browser until you untick this box.'); } else { forget(); toast('Saving is off. Saved résumé deleted from this browser.'); }
    };
    document.querySelectorAll('[data-template]').forEach(b => b.onclick = () => {
      template = b.dataset.template; document.querySelectorAll('[data-template]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); persist(); fitNow();
    });
    document.querySelectorAll('[data-pages]').forEach(b => b.onclick = () => {
      pages = Number(b.dataset.pages); document.querySelectorAll('[data-pages]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); persist(); fitNow();
    });
    $('#rbPdf').onclick = printPdf; $('#rbCopy').onclick = copyText; $('#rbTxt').onclick = downloadText; $('#rbAi').onclick = tighten;
  }
  function refreshOptions() {
    if (view !== 'resume-build' || !$('#rbSections')) return;
    const options = entryOptions();
    $('#rbSections').querySelectorAll('select[data-act=move]').forEach(s => { s.innerHTML = `<option value="">Move to…</option>${options}`; });
  }

  function moveBullet(select) {
    const row = select.closest('[data-bid]'), { e: from } = ent(select), i = from.bullets.findIndex(b => b.id === row.dataset.bid);
    const to = model.sections.flatMap(s => s.entries).find(x => x.id === select.value);
    if (!to || to === from || i < 0) { select.value = ''; return; }
    const [b] = from.bullets.splice(i, 1); to.bullets.push(b);
    structural(sel('data-bid', b.id, '[data-f=btext]'));
    toast('Moved the bullet.');
  }
  function addSectionOf(type) {
    const s = RB.addSection(model, type), e = RB.addEntry(model, s);
    if (RB.isLines(s)) { const b = RB.addBullet(model, e, ''); structural(sel('data-bid', b.id, '[data-f=btext]')); } else structural(sel('data-eid', e.id, '[data-f=etitle]'));
  }

  function act(btn) {
    const a = btn.dataset.act, s = btn.closest('[data-sid]') && sec(btn);
    if (a.startsWith('s-')) {
      const i = model.sections.indexOf(s);
      if (a === 's-del') {
        if (!confirm(`Remove the “${s.title || 'untitled'}” section and everything in it?`)) return;
        model.sections.splice(i, 1); structural('#rbAddSection'); return;
      }
      if (swap(model.sections, i, a === 's-up' ? -1 : 1)) structural(arrowFocus('data-sid', s.id, 's'));
      return;
    }
    if (a === 'add-entry') { const e = RB.addEntry(model, s); structural(sel('data-eid', e.id, '[data-f=etitle]')); return; }
    const { e } = ent(btn);
    if (a.startsWith('e-')) {
      const i = s.entries.indexOf(e);
      if (a === 'e-del') {
        if (e.bullets.some(b => b.text.trim()) && !confirm(`Remove “${e.title || 'this entry'}” and its bullets?`)) return;
        s.entries.splice(i, 1); structural(sel('data-sid', s.id, '[data-act=add-entry]')); return;
      }
      if (swap(s.entries, i, a === 'e-up' ? -1 : 1)) structural(arrowFocus('data-eid', e.id, 'e'));
      return;
    }
    if (a === 'add-bullet') { const b = RB.addBullet(model, e, ''); structural(sel('data-bid', b.id, '[data-f=btext]')); return; }
    const row = btn.closest('[data-bid]'), i = e.bullets.findIndex(b => b.id === row.dataset.bid), b = e.bullets[i];
    if (a === 'pin') { b.pin = !b.pin; structural(sel('data-bid', b.id, '[data-act=pin]')); }
    else if (a === 'hide') { b.hide = !b.hide; structural(sel('data-bid', b.id, '[data-act=hide]')); }
    else if (a === 'b-del') { e.bullets.splice(i, 1); structural(sel('data-eid', e.id, '[data-act=add-bullet]')); }
    else if (a === 'b-up' || a === 'b-down') { if (swap(e.bullets, i, a === 'b-up' ? -1 : 1)) structural(arrowFocus('data-bid', b.id, 'b')); }
  }

  /* ---------- Fitting and the preview ---------- */
  /** Height of the résumé in pages, measured by laying it out offscreen. Falls back to an estimate where there is no layout (tests). */
  function measure(p) {
    const box = document.createElement('div');
    box.setAttribute('aria-hidden', 'true'); box.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden';
    box.innerHTML = RB.sheetHtml(model, { template, plan: p }); document.body.appendChild(box);
    const sheet = box.querySelector('.rb-sheet'); let r;
    if (sheet) sheet.style.minHeight = '0'; // the sheet is at least one A4 page tall on screen; measure only its content
    if (!sheet || !sheet.scrollHeight) r = RB.estimate(model, p);
    else { const cs = getComputedStyle(sheet); r = (sheet.scrollHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / CONTENT_H * 1.01; }
    box.remove(); return r;
  }

  function fitNow() {
    clearTimeout(fitTimer); fitTimer = null;
    if (!model || stage !== 'edit' || view !== 'resume-build' || !$('#rbPreview')) return;
    plan = RB.fit(model, { pages, measure });
    $('#rbFitStatus').textContent = statusText();
    renderPreview(); markLeftOut();
  }
  function statusText() {
    const n = plan.dropped.length, word = pages === 1 ? 'one page' : 'two pages', tight = plan.density > 0 ? ' Spacing tightened.' : '';
    if (!plan.fits) return `Does not fit on ${word} even after leaving out ${plural(n, 'bullet')} and tightening the spacing. Hide some bullets or entries${pages === 1 ? ', or choose Two pages' : ''}.`;
    if (pages === 2 && plan.pages <= 1) return 'Everything fits on one page, so it prints as one page.';
    if (n) return `Fits on ${word}. ${plural(n, 'lower-ranked bullet')} ${n === 1 ? 'is' : 'are'} left out (marked in the editor). Pin one to keep it.${tight}`;
    return `Fits on ${word}.${tight}`;
  }
  function markLeftOut() {
    document.querySelectorAll('#rbSections [data-bid]').forEach(row => {
      const out = !!plan && plan.omit.has(row.dataset.bid) && !row.querySelector('[data-act=hide][aria-pressed=true]');
      row.classList.toggle('rb-left-out', out); row.querySelector('[data-chip]').hidden = !out;
    });
  }
  function renderPreview() {
    const wrap = $('#rbPreview'); if (!wrap || !plan) return;
    wrap.innerHTML = `<div class="rb-page" id="rbPage">${RB.sheetHtml(model, { template, plan })}</div>`;
    const page = $('#rbPage'), sheet = page.querySelector('.rb-sheet');
    const colW = wrap.clientWidth, scale = colW > 0 ? Math.min(1, colW / PAGE_W) : 1;
    const h = Math.max(sheet.offsetHeight || 0, PAGE_H);
    page.style.setProperty('--rb-scale', String(scale));
    page.style.transform = `scale(${scale})`; page.style.transformOrigin = 'top left';
    for (let n = 1; n < Math.ceil(plan.pages - 0.005); n++) { // a guide only where the content really runs onto another page
      const g = document.createElement('div'); g.className = 'rb-guide'; g.style.top = (TOP + n * 273) + 'mm';
      g.innerHTML = `<span>Page ${n + 1}</span>`; page.appendChild(g);
    }
    wrap.style.height = Math.ceil(h * scale) + 'px';
  }
  let resizeTimer = null;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (view === 'resume-build' && stage === 'edit') renderPreview(); }, 100); });

  /* ---------- Download, copy, print ---------- */
  const fileStem = () => (model.name || 'resume').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'resume';
  function printPdf() {
    if (fitTimer) fitNow();
    const old = document.getElementById('rbPrintRoot'); if (old) old.remove();
    const root = document.createElement('div'); root.id = 'rbPrintRoot'; root.innerHTML = RB.sheetHtml(model, { template, plan });
    document.body.appendChild(root); document.body.classList.add('rb-printing');
    const title = document.title; document.title = `${model.name || 'My'} – Résumé`;
    let done = false;
    const clean = () => { if (done) return; done = true; document.title = title; document.body.classList.remove('rb-printing'); root.remove(); window.removeEventListener('afterprint', clean); };
    // Clean up on afterprint, not after print() returns: in some browsers print() does not wait for the dialog,
    // and removing the copy early would print the whole app page instead of the résumé.
    window.addEventListener('afterprint', clean);
    window.print();
  }
  function copyText() {
    if (fitTimer) fitNow();
    const text = RB.toText(model, plan);
    const fallback = () => { modal(`<h2>Copy your résumé as text</h2><p class="note">Select all the text below and copy it.</p><textarea id="rbCopyText" rows="14" readonly>${esc(text)}</textarea>`); const t = $('#rbCopyText'); t.focus(); t.select(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('Copied your résumé as text.'), fallback);
    else fallback();
  }
  function downloadText() { if (fitTimer) fitNow(); download(RB.toText(model, plan), `${fileStem()}-resume.txt`); }

  /* ---------- Tighten with AI (optional) ---------- */
  function onPage() {
    const out = [];
    for (const s of model.sections) if (RB.DROPPABLE.has(s.type)) for (const e of s.entries) for (const b of e.bullets) if (!b.hide && !(plan && plan.omit.has(b.id)) && b.text.trim()) out.push({ id: b.id, text: b.text.trim() });
    return out.slice(0, 40);
  }
  async function tighten() {
    const ai = window.AIClient;
    if (!ai || !ai.enabled()) { if (ai) ai.openSettings(); return; }
    if (aiBusy) return;
    if (fitTimer) fitNow();
    const bullets = onPage(), status = $('#rbAiStatus'), button = $('#rbAi');
    if (!bullets.length) { status.textContent = 'There are no bullets on the page to tighten.'; return; }
    aiBusy = true; button.disabled = true; $('#rbReview').innerHTML = '';
    status.textContent = `Asking the AI provider to tighten ${plural(bullets.length, 'bullet')}…`;
    try {
      const res = await ai.request('resume-tighten', null, { bullets, goal: pages === 1 ? 'one-page' : 'two-page' });
      if (view !== 'resume-build' || stage !== 'edit' || !$('#rbReview')) return;
      const list = ((res && res.result && res.result.bullets) || []).filter(x => x && x.changed && typeof x.text === 'string' && x.text.trim() && RB.locate(model, x.id));
      if (!list.length) { status.textContent = 'The AI had no changes to suggest.'; return; }
      status.textContent = `${plural(list.length, 'suggestion')} to review.`;
      showReview(list);
    } catch (e) {
      if ($('#rbAiStatus')) $('#rbAiStatus').textContent = (e && e.message) || 'The AI request failed.';
    } finally { aiBusy = false; if ($('#rbAi')) $('#rbAi').disabled = false; }
  }
  function showReview(list) {
    const box = $('#rbReview');
    box.innerHTML = `<section class="rb-review" aria-label="AI suggestions"><h3>Suggested rewrites</h3><p class="note"><b>AI suggestions can be wrong.</b> Keep only what is true and what you can explain in an interview.</p>
      ${list.map(x => { const nums = Array.isArray(x.newNumbers) ? x.newNumbers : [], id = val(x.id); return `<div class="rb-sug" data-sug="${id}">
        <p class="rb-orig"><span>Original</span> ${esc(x.original || RB.locate(model, x.id).bullet.text)}</p>
        <textarea rows="3" data-sugtext aria-label="Suggested text">${esc(x.text)}</textarea>
        ${nums.length ? `<p class="rb-warn" role="note">Adds a number that is not in your original (${esc(nums.join(', '))}). Use it only if it is true.</p>` : ''}
        <label class="selfcheck"><input type="checkbox" data-use ${nums.length ? '' : 'checked'}> <span>Use this</span></label></div>`; }).join('')}
      <div class="actions"><button type="button" class="primary" id="rbApply">Apply selected</button><button type="button" id="rbDiscard">Discard</button></div></section>`;
    box.querySelectorAll('textarea').forEach(grow);
    $('#rbDiscard').onclick = () => { box.innerHTML = ''; $('#rbAiStatus').textContent = ''; };
    $('#rbApply').onclick = () => {
      let n = 0;
      box.querySelectorAll('[data-sug]').forEach(d => {
        if (!d.querySelector('[data-use]').checked) return;
        const hit = RB.locate(model, d.dataset.sug), text = d.querySelector('[data-sugtext]').value.replace(/\s+/g, ' ').trim();
        if (hit && text) { hit.bullet.text = text; n++; }
      });
      box.innerHTML = ''; $('#rbAiStatus').textContent = '';
      if (n) structural(null); else fitNow();
      toast(n ? `Applied ${plural(n, 'suggestion')}.` : 'No suggestions were selected.');
    };
  }

  /* ---------- Integration with the rest of Case Room ---------- */
  const priorHome = home;
  home = function () { priorHome(); if (location.hash === '#resume-build') setHash(false); };

  window.ResumeBuilder = { open, state: () => ({ stage, model, template, pages, plan }) };
})();
