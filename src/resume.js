/* Résumé and job-description checker: upload or paste, bullet checklist with in-place editing, keyword match,
   copy and download. Runs entirely in the browser with no AI and no server. Uses core.js helpers,
   stopMedia()/view/home from cases.js, ResumeCheck (analysis) and ResumeFiles (reading files on the device). */
(() => {
  const RC = ResumeCheck, RF = ResumeFiles, WORDS = ResumeWords;
  const SAVE_KEY = 'cr-resume-save', TEXT_KEY = 'cr-resume-text', JD_KEY = 'cr-resume-jd', MAX_TEXT = 200000;
  const ACCEPT = '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

  /* ---------- Optional saving: text only, off by default ---------- */
  const okText = v => typeof v === 'string' && v.length <= MAX_TEXT;
  let saving = read(SAVE_KEY, false) === true;
  let draft = { resume: '', jd: '' };
  if (saving) { const t = read(TEXT_KEY, ''), j = read(JD_KEY, ''); draft = { resume: okText(t) ? t : '', jd: okText(j) ? j : '' }; }
  function persist() { if (!saving) return; save(SAVE_KEY, true); save(TEXT_KEY, draft.resume.slice(0, MAX_TEXT)); save(JD_KEY, draft.jd.slice(0, MAX_TEXT)); }
  function forget() { for (const k of [SAVE_KEY, TEXT_KEY, JD_KEY]) try { localStorage.removeItem(k); } catch { /* storage blocked */ } }

  let analysis = null, fileInfo = null, readToken = 0, showAllKeywords = false;
  function setHash(on) { try { window.history.replaceState(null, '', location.pathname + location.search + (on ? '#resume' : '')); } catch { /* file:// or sandboxed frames */ } }
  function open() { stopMedia(); view = 'resume'; setHash(true); render(); }
  const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
  const msgHtml = m => esc(m).replace(/`([^`]+)`/g, '<code>$1</code>');

  function render() {
    stopMedia(); view = 'resume'; window.scrollTo(0, 0);
    $('#app').innerHTML = `<div class="rc-head"><div class="eyebrow">RÉSUMÉ CHECKER · FREE · NO AI</div><h1 class="drill-title">Sharpen your résumé <em>bullets</em></h1>
      <p class="lead">Checks your whole résumé and every bullet point, with or without a job description. Add one to see which of its keywords you are missing. Every check is a rule of thumb you can argue with, not a score.</p></div>
      <p class="rc-privacy" id="rcPrivacy"><b>Your file is read in your browser. Nothing is uploaded.</b> There is no AI and no server: the checks run on this device, and nothing is stored unless you tick “Remember my text”.</p>
      <section class="panel rc-input">
        <h2>1. Your résumé</h2>
        <div class="rc-drop" id="rcDrop">
          <label class="rc-pick" for="rcFile">Choose a file</label><input type="file" id="rcFile" class="rc-file" accept="${ACCEPT}">
          <span class="note">or drag it here. PDF, Word (.docx) or .txt, up to 5 MB.</span>
          <button type="button" id="rcSample">Load a sample</button>
        </div>
        <div id="rcFileInfo" class="rc-file-info" aria-live="polite">${fileInfoHtml()}</div>
        <label for="rcResume">Résumé text</label>
        <textarea id="rcResume" class="rc-resume" spellcheck="true" placeholder="Paste your résumé text here, or choose a file above.">${esc(draft.resume)}</textarea>
        <p class="note">One bullet per line, starting with • or -. Headings such as EXPERIENCE, PROJECTS and SKILLS help the checker find your bullets. Text in text boxes or tables may be missed when reading a .docx, and two-column PDFs can come out in the wrong order, so check this box before you run the checks.</p>
        <h2>2. Job description <span class="note">(optional)</span></h2>
        <label for="rcJd" class="sr-only">Job description text</label>
        <textarea id="rcJd" class="rc-jd" placeholder="Paste the job description to see which of its keywords your résumé already shows.">${esc(draft.jd)}</textarea>
        <div class="drill-inline"><button type="button" id="rcSampleJd">Load a sample job description</button></div>
        <div class="rc-save">
          <label class="selfcheck"><input type="checkbox" id="rcSave" ${saving ? 'checked' : ''}> <span>Remember my text on this device<small class="note">Off by default. Saves only the text in these two boxes, in this browser's local storage. Files are never stored.</small></span></label>
          <button type="button" id="rcForget">Delete saved text</button>
        </div>
        <div class="actions"><button class="primary" id="rcCheck">Check résumé</button><button type="button" id="rcClear">Clear both boxes</button></div>
      </section>
      <div id="rcResults" aria-live="polite"></div>`;
    bind();
    if (analysis) renderResults();
  }

  function fileInfoHtml() {
    if (!fileInfo) return '';
    if (fileInfo.state === 'busy') return `<p class="rc-msg busy">Reading ${esc(fileInfo.name)} on this device…</p>`;
    if (fileInfo.state === 'error') return `<p class="rc-msg error" role="alert">${fileInfo.name ? `<b>${esc(fileInfo.name)}:</b> ` : ''}${msgHtml(fileInfo.message)}</p>`;
    const r = fileInfo;
    return `<div class="rc-msg ok"><p><b>Loaded ${esc(r.name)}</b> · ${esc(r.label)} · ${Math.max(1, Math.round(r.size / 1024))} KB · ${plural(r.stats.lines, 'line')} · ${plural(r.stats.bullets, 'bullet')} found</p>
      <p><b>Check the extracted text and fix anything that came through wrong before checking.</b> The checks always run on the text in the box below, not on the file.</p>
      ${r.notes.length ? `<ul>${r.notes.map(n => `<li>${msgHtml(n)}</li>`).join('')}</ul>` : ''}</div>`;
  }
  const showFileInfo = () => { if ($('#rcFileInfo')) $('#rcFileInfo').innerHTML = fileInfoHtml(); };

  async function takeFile(file) {
    const token = ++readToken;
    const c = RF.check(file);
    if (!c.ok) { fileInfo = { state: 'error', name: file ? file.name : '', message: c.message }; showFileInfo(); return; }
    fileInfo = { state: 'busy', name: file.name }; showFileInfo();
    try {
      const res = await RF.readFile(file);
      if (token !== readToken) return;
      fileInfo = { state: 'ok', name: res.name, label: res.label, size: res.size, stats: res.stats, notes: res.notes };
      draft.resume = res.text; analysis = null; persist();
      if ($('#rcResume')) { $('#rcResume').value = res.text; $('#rcResults').innerHTML = ''; }
    } catch (e) {
      if (token !== readToken) return;
      fileInfo = { state: 'error', name: file.name, message: e instanceof RF.ResumeFileError ? e.message : 'This file could not be read. Upload a .docx or paste the text instead.' };
    }
    showFileInfo();
  }

  function bind() {
    const input = $('#rcFile'), drop = $('#rcDrop');
    input.onchange = () => { const f = input.files && input.files[0]; input.value = ''; if (f) takeFile(f); };
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) takeFile(f); });
    $('#rcResume').oninput = e => { draft.resume = e.target.value; persist(); refresh(); };
    $('#rcJd').oninput = e => { draft.jd = e.target.value; persist(); refresh(); };
    $('#rcSample').onclick = () => { draft.resume = WORDS.SAMPLE_RESUME; $('#rcResume').value = draft.resume; fileInfo = null; showFileInfo(); persist(); toast('Loaded a fictional sample résumé. Replace it with yours when you are ready.'); };
    $('#rcSampleJd').onclick = () => { draft.jd = WORDS.SAMPLE_JD; $('#rcJd').value = draft.jd; persist(); };
    $('#rcSave').onchange = e => {
      saving = e.target.checked;
      if (saving) { persist(); toast('Your résumé and job description text will be kept in this browser until you delete them.'); } else { forget(); toast('Saving is off. Saved text deleted from this browser.'); }
    };
    $('#rcForget').onclick = () => { forget(); saving = false; $('#rcSave').checked = false; toast('Saved text deleted from this browser. The boxes keep your text until you leave or reload the page.'); };
    $('#rcClear').onclick = () => { draft = { resume: '', jd: '' }; $('#rcResume').value = ''; $('#rcJd').value = ''; analysis = null; fileInfo = null; showFileInfo(); $('#rcResults').innerHTML = ''; persist(); };
    $('#rcCheck').onclick = check;
  }

  // Once results are showing, keep them in step with both boxes (debounced), so a bullet edit never uses stale line numbers.
  let refreshTimer = null;
  function refresh() {
    clearTimeout(refreshTimer); if (!analysis) return;
    refreshTimer = setTimeout(() => { if (!analysis || view !== 'resume' || !draft.resume.trim()) return; analysis = RC.analyse(draft.resume, draft.jd); analysis.source = draft.resume; renderResults(); }, 400);
  }
  function check() {
    draft.resume = $('#rcResume').value; draft.jd = $('#rcJd').value; persist();
    if (!draft.resume.trim()) { analysis = null; $('#rcResults').innerHTML = `<p class="rc-msg error" role="alert">Paste your résumé text or choose a file first.</p>`; return; }
    clearTimeout(refreshTimer); showAllKeywords = false; analysis = RC.analyse(draft.resume, draft.jd); analysis.source = draft.resume;
    renderResults();
    const r = $('#rcResults'); if (r && r.scrollIntoView) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- Results ---------- */
  const mark = status => status === 'pass' ? '<span class="rc-mark ok" aria-label="Pass">✓</span>' : status === 'info' ? '<span class="rc-mark info" aria-label="Suggestion">i</span>' : '<span class="rc-mark warn" aria-label="Look at this">!</span>';
  function checksHtml(b) {
    return b.checks.map(c => `<li class="${c.status}">${mark(c.status)}<div><b>${esc(c.label)}</b> ${esc(c.reason)}${c.status === 'warn' && c.fix ? `<span class="rc-fix">Try: ${esc(c.fix)}</span>` : ''}</div></li>`).join('');
  }
  const countLabel = b => b.issues ? plural(b.issues, 'thing') + ' to look at' : 'No warnings';
  function summaryHtml() {
    const s = analysis.summary;
    return `<ul class="rc-summary">${RC.CHECK_IDS.map(id => `<li class="${s.counts[id] ? 'warn' : 'pass'}">${mark(s.counts[id] ? 'warn' : 'pass')}<span><b>${esc(s.labels[id])}</b> ${s.counts[id] ? `${s.counts[id]} of ${s.total} bullets to look at` : 'nothing flagged'}</span></li>`).join('')}</ul>
      <p class="rc-share"><b>${s.withNumber} of ${s.total}</b> bullets include a number or measurable result (${Math.round(s.numberShare * 100)}%). <b>${s.clean}</b> ${s.clean === 1 ? 'has' : 'have'} no warnings.</p>`;
  }
  /** The whole-résumé checklist: it needs no job description. */
  function generalHtml() {
    const g = analysis.general, warn = g.filter(c => c.status === 'warn').length;
    return `<section class="panel rc-general" id="rcGeneral"><h2>Whole résumé</h2>
      <p class="note">General checks that run with or without a job description: contact details, sections, length, personal details, the summary, roles, dates, formatting, spelling and whether your listed skills show up in your bullets. ${warn ? `<b>${plural(warn, 'thing')} to look at.</b>` : '<b>Nothing flagged.</b>'}</p>
      <ul class="rc-checks rc-general-list">${g.map(c => `<li class="${c.status}" data-check="${c.id}">${mark(c.status)}<div><b>${esc(c.label)}</b> ${esc(c.reason)}${c.status !== 'pass' && c.fix ? `<span class="rc-fix">${c.status === 'info' ? 'Optional' : 'Try'}: ${esc(c.fix)}</span>` : ''}</div></li>`).join('')}</ul></section>`;
  }
  function bulletsHtml() {
    const out = []; let lastRole = null, lastSection = null;
    analysis.bullets.forEach((b, i) => {
      const role = analysis.roles[b.role];
      if (b.section !== lastSection) { out.push(`<h3 class="rc-section">${esc(b.section || 'Bullets')}</h3>`); lastSection = b.section; lastRole = null; }
      if (role.id !== lastRole) { if (role.title) out.push(`<p class="rc-role">${esc(role.title)}</p>`); lastRole = role.id; }
      out.push(`<details class="rc-bullet ${b.issues ? 'warn' : 'pass'}" id="rcB${i}"><summary>${mark(b.issues ? 'warn' : 'pass')}<span class="rc-btext" id="rcText${i}">${esc(b.text)}</span><span class="rc-count" id="rcCount${i}">${countLabel(b)}</span></summary>
        <label class="rc-edit-label" for="rcEdit${i}">Edit this bullet (the checks update as you type, and the résumé box above changes too)</label>
        <textarea class="rc-edit" id="rcEdit${i}" data-i="${i}" rows="3">${esc(b.text)}</textarea>
        <ul class="rc-checks" id="rcChecks${i}">${checksHtml(b)}</ul></details>`);
    });
    return out.join('');
  }
  function chips(list, cls) {
    const attrs = k => { const c = [k.skill && 'skill', !k.inTop && 'extra'].filter(Boolean); return (c.length ? ` class="${c.join(' ')}"` : '') + (k.inTop ? '' : ' title="Lower-ranked keyword: not in the headline count"'); };
    return list.length ? `<ul class="rc-chips ${cls}">${list.map(k => `<li${attrs(k)}>${esc(k.display)}</li>`).join('')}</ul>` : '<p class="note">None.</p>';
  }
  /** Replaces the match section in place, keeping focus on the toggle when it was used. */
  function renderMatch(focusToggle) {
    const m = $('#rcMatch'); if (!m) return;
    const wrap = document.createElement('div'); wrap.innerHTML = matchHtml(); m.replaceWith(wrap.firstElementChild); bindMatch();
    if (focusToggle && $('#rcMoreKeywords')) $('#rcMoreKeywords').focus();
  }
  function bindMatch() { const b = $('#rcMoreKeywords'); if (b) b.onclick = () => { showAllKeywords = !showAllKeywords; renderMatch(true); }; }
  function matchHtml() {
    const m = analysis.match;
    if (!m) return `<section class="panel rc-match" id="rcMatch"><h2>Job description match <span class="note">(optional)</span></h2><p class="note">The checks above work without a job description. To also see which of an advert's keywords your résumé shows, paste it in box 2.</p></section>`;
    if (!m.keywords.length) return `<section class="panel rc-match" id="rcMatch"><h2>Job description match</h2><p class="note">No keywords found in that job description. Paste the full advert, including the requirements.</p></section>`;
    // By default the lists show only the keywords the headline counts, so the numbers add up on screen.
    const more = m.keywords.length > m.top, all = more && showAllKeywords;
    const shown = list => all ? list : list.filter(k => k.inTop);
    const matched = shown(m.matched), skillsOnly = shown(m.skillsOnly), missing = shown(m.missing);
    const toggle = more ? `<button type="button" class="rc-more" id="rcMoreKeywords" aria-expanded="${all}">${all ? `Show only the top ${m.top}` : `See all ${m.keywords.length} keywords`}</button>` : '';
    return `<section class="panel rc-match" id="rcMatch"><h2>Job description match</h2>
      <p class="rc-headline" id="rcPercent"><b>${m.found} of the top ${m.top}</b> job-description keywords appear in your résumé (${m.percent}%)${m.foundInSkillsOnly ? `, ${m.foundInSkillsOnly} of them only in your Skills section` : ''}.</p>
      <p class="note">This is word overlap, nothing more. It is not how a recruiter reads a résumé, and real applicant tracking systems work differently from each other and from this. Keywords are ranked by how often they appear, whether they sit under the requirements, and a list of common skills and tools.</p>
      <p class="note rc-scope" id="rcScope">${all ? `Showing all ${m.keywords.length} keywords. The headline counts only the top ${m.top}; the ${m.keywords.length - m.top} lower-ranked ones have a dashed outline.` : `Showing the top ${m.top} keywords, the ones the headline counts${more ? ` (${m.keywords.length - m.top} lower-ranked keywords hidden)` : ''}.`} ${toggle}</p>
      <div class="rc-groups">
        <div><h3>Matched <span class="note">(${matched.length})</span></h3><p class="note">In a bullet or other text.</p>${chips(matched, 'matched')}</div>
        <div><h3>Only in Skills <span class="note">(${skillsOnly.length})</span></h3><p class="note">Listed, but no bullet shows you using it. Weaker evidence: if you have used it, say where in a bullet.</p>${chips(skillsOnly, 'skills')}</div>
        <div><h3>Missing <span class="note">(${missing.length})</span></h3><p class="note">Not found anywhere in your résumé.</p>${chips(missing, 'missing')}</div>
      </div>
      <p class="rc-warning"><b>Do not stuff keywords.</b> Add a missing keyword only where you genuinely have that experience, and show it in a bullet you can talk about in an interview. A list of words you cannot back up hurts you with any human reader.</p></section>`;
  }
  function renderResults() {
    const el = $('#rcResults'); if (!el || !analysis) return;
    const s = analysis.summary;
    const none = !s.total;
    el.innerHTML = `${generalHtml()}<section class="panel rc-results"><h2>Bullet checklist</h2>
      <p class="note">Heuristics computed in your browser: an action-verb list, a number check, a passive-voice word pattern, length limits (${RC.LIMITS.minWords}–${RC.LIMITS.maxWords} words, about two lines), a filler-word list, repeated opening verbs and tense within each role. Not a score: use them as prompts and keep what is true.</p>
      ${none ? `<p class="rc-msg error" role="alert">No bullets found to check. Start each bullet with • or - on its own line, under a heading such as EXPERIENCE, PROJECTS or POSITIONS OF RESPONSIBILITY.</p>` : summaryHtml()}
      ${none ? '' : `<h2 class="rc-bullets-head">Bullets <span class="note">(${s.total} checked; open one to see why and to edit it)</span></h2><div id="rcBullets">${bulletsHtml()}</div>`}
      <div class="actions">${none ? '' : '<button class="primary" id="rcCopy">Copy improved bullets</button>'}<button id="rcDownload">Download report (.txt)</button></div></section>${matchHtml()}`;
    el.querySelectorAll('.rc-edit').forEach(t => { t.oninput = () => edit(Number(t.dataset.i), t.value); });
    if ($('#rcCopy')) $('#rcCopy').onclick = copyBullets;
    bindMatch();
    $('#rcDownload').onclick = () => download(RC.reportText(analysis), `case-room-resume-check-${new Date().toISOString().slice(0, 10)}.txt`);
  }

  /** Edits one bullet: rewrites its line(s) in the résumé text, re-checks everything and updates the page in place. */
  function edit(i, value) {
    if (analysis && analysis.source !== draft.resume) { clearTimeout(refreshTimer); analysis = RC.analyse(draft.resume, draft.jd); analysis.source = draft.resume; renderResults(); return; }
    const b = analysis && analysis.bullets[i]; if (!b) return;
    const text = value.replace(/\s*\n+\s*/g, ' ').trim();
    if (!text) return; // keep the old text until something is typed, so the bullet does not vanish mid-edit
    const lines = draft.resume.replace(/\r\n?/g, '\n').split('\n');
    const lead = (lines[b.start].match(/^\s*/) || [''])[0];
    lines.splice(b.start, b.end - b.start + 1, lead + (b.prefix ? b.prefix + ' ' : '') + text);
    draft.resume = lines.join('\n'); persist();
    if ($('#rcResume')) $('#rcResume').value = draft.resume;
    const next = RC.analyse(draft.resume, draft.jd); next.source = draft.resume;
    if (next.bullets.length !== analysis.bullets.length) { analysis = next; renderResults(); return; }
    analysis = next;
    next.bullets.forEach((nb, k) => {
      const d = $('#rcB' + k); if (!d) return;
      d.className = 'rc-bullet ' + (nb.issues ? 'warn' : 'pass');
      d.querySelector('summary .rc-mark').outerHTML = mark(nb.issues ? 'warn' : 'pass');
      $('#rcCount' + k).textContent = countLabel(nb); $('#rcChecks' + k).innerHTML = checksHtml(nb); $('#rcText' + k).textContent = nb.text;
    });
    const sum = $('#rcResults .rc-summary'); if (sum) { const wrap = document.createElement('div'); wrap.innerHTML = summaryHtml(); sum.nextElementSibling.remove(); sum.replaceWith(...wrap.children); }
    const gen = $('#rcGeneral'); if (gen) { const wrap = document.createElement('div'); wrap.innerHTML = generalHtml(); gen.replaceWith(wrap.firstElementChild); }
    renderMatch(false);
  }

  function copyBullets() {
    const text = RC.improvedBullets(analysis);
    const fallback = () => { modal(`<h2>Copy your bullets</h2><p class="note">Select all the text below and copy it.</p><textarea id="rcCopyText" rows="14" readonly>${esc(text)}</textarea>`); const t = $('#rcCopyText'); t.focus(); t.select(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast(`Copied ${plural(analysis.bullets.length, 'bullet')}.`), fallback);
    else fallback();
  }

  /* ---------- Integration with the rest of Case Room ---------- */
  $('#resumeNav').onclick = open;
  const priorHome = home;
  home = function () {
    priorHome(); if (location.hash === '#resume') setHash(false);
  };


  window.ResumeTool = { open, check, takeFile, state: () => ({ draft, analysis, saving, fileInfo }) };
})();
