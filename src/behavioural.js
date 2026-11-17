/* Behavioural (HR) interview practice: timed questions, heuristic feedback with STAR tagging, a STAR story bank
   and a printable sheet for practising with a friend. No AI: every check is computed in the browser by
   BehaviouralContent. Uses core.js helpers and speak()/stopMedia()/attachDictation()/voiceControls()/bindSpeech()
   from cases.js. Everything is stored in this browser under cr-behavioural-* keys. */
(() => {
  const B = BehaviouralContent;
  const ATTEMPTS_KEY = 'cr-behavioural-attempts', STORIES_KEY = 'cr-behavioural-stories', DRAFT_KEY = 'cr-behavioural-draft', PREFS_KEY = 'cr-behavioural-prefs';
  const MAX_ATTEMPTS = 300, MAX_STORIES = 30, MAX_TEXT = 20000, EXPORT_KIND = 'case-room-behavioural-stories';
  const LANGS = [['en-IN', 'English (India)'], ['en-US', 'English (US)'], ['en-GB', 'English (UK)']];
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const str = (v, max = MAX_TEXT) => typeof v === 'string' ? v.slice(0, max) : '';
  const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const comp = id => B.competency(id);
  const modeTitle = m => m === 'mixed' ? 'Mixed questions' : comp(m).title;
  const secs = n => n == null ? '—' : n < 60 ? `${Math.round(n)}s` : clock(Math.round(n));
  const range = t => `${clock(t[0])}–${clock(t[1])}`;
  const median = xs => { if (!xs.length) return null; const s = xs.slice().sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const day = t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  /* ---------- Storage, validated on every load ---------- */
  function cleanTags(t, frame) {
    if (!isObj(t)) return {};
    const ok = B.FRAMES[frame].parts.map(p => p.id);
    return Object.fromEntries(Object.entries(t).filter(([k, v]) => k.length <= 2000 && ok.includes(v)).slice(0, 400));
  }
  function cleanAttempt(a) {
    if (!isObj(a) || typeof a.text !== 'string' || !Number.isFinite(a.at)) return null;
    const c = comp(a.competency); if (!c) return null;
    const q = B.findQuestion(a.qid);
    return { id: str(a.id, 40) || 'b' + a.at, at: a.at, competency: c.id, mode: a.mode === 'mixed' || B.IDS.includes(a.mode) ? a.mode : c.id, qid: q ? q.id : '',
      question: str(a.question, 600) || (q ? q.text : 'Question'), text: str(a.text), seconds: Number.isFinite(a.seconds) && a.seconds > 0 ? a.seconds : null,
      voice: !!a.voice, storyId: typeof a.storyId === 'string' ? a.storyId.slice(0, 40) : null, tags: cleanTags(a.tags, c.frame),
      heard: Array.isArray(a.heard) ? [...new Set(a.heard.filter(i => Number.isInteger(i) && i >= 0 && i < c.listenFor.length))] : [], notes: str(a.notes, 5000) };
  }
  function cleanStory(s) {
    if (!isObj(s)) return null;
    return { id: typeof s.id === 'string' && /^[\w-]{1,40}$/.test(s.id) ? s.id : newId('s'), title: str(s.title, 120), s: str(s.s, 4000), t: str(s.t, 4000), a: str(s.a, 6000), r: str(s.r, 4000),
      tags: Array.isArray(s.tags) ? [...new Set(s.tags.filter(t => B.STORY_IDS.includes(t)))] : [], updated: Number.isFinite(s.updated) ? s.updated : Date.now() };
  }
  function cleanDraft(d) {
    if (!isObj(d)) return null;
    const q = B.findQuestion(d.qid); if (!q) return null;
    const draft = { mode: d.mode === 'mixed' || B.IDS.includes(d.mode) ? d.mode : q.competency, qid: q.id, competency: q.competency, text: str(d.text),
      elapsedMs: Number.isFinite(d.elapsedMs) && d.elapsedMs > 0 ? Math.min(d.elapsedMs, 36e5) : 0, runningSince: null, voice: !!d.voice,
      storyId: typeof d.storyId === 'string' ? d.storyId.slice(0, 40) : null, spoken: !!d.spoken, at: Number.isFinite(d.at) ? d.at : Date.now() };
    // A timer left running when the page closed counts only up to the last saved change.
    if (Number.isFinite(d.runningSince) && d.runningSince <= draft.at) draft.elapsedMs = Math.min(36e5, draft.elapsedMs + (draft.at - d.runningSince));
    return draft;
  }
  const isEmptyStory = s => !(s.title + s.s + s.t + s.a + s.r).trim();
  const list = (k, clean) => { const v = read(k, []); return Array.isArray(v) ? v.map(clean).filter(Boolean) : []; };

  let attempts = list(ATTEMPTS_KEY, cleanAttempt).slice(0, MAX_ATTEMPTS);
  let stories = list(STORIES_KEY, cleanStory).slice(0, MAX_STORIES).filter((s, i, all) => all.findIndex(x => x.id === s.id) === i);
  let draft = cleanDraft(read(DRAFT_KEY, null));
  let prefs = read(PREFS_KEY, {}); if (!isObj(prefs)) prefs = {};
  prefs = { mode: prefs.mode === 'mixed' || B.IDS.includes(prefs.mode) ? prefs.mode : 'mixed', lang: LANGS.some(l => l[0] === prefs.lang) ? prefs.lang : 'en-IN', aloud: !!prefs.aloud };
  let screen = 'home', current = null, editing = null, lastTick = Date.now();

  const saveAttempts = () => save(ATTEMPTS_KEY, attempts);
  const saveStories = () => save(STORIES_KEY, stories);
  const persist = () => { if (draft) draft.at = Date.now(); save(DRAFT_KEY, draft); };
  const savePrefs = () => save(PREFS_KEY, prefs);
  const storyOf = id => stories.find(s => s.id === id);
  const questionOf = d => B.findQuestion(d.qid);

  function setHash(h) { try { window.history.replaceState(null, '', location.pathname + location.search + h); } catch { /* file:// or sandboxed frames */ } }
  function enter(name, hash) { pauseTimer(); stopMedia(); view = 'behavioural'; screen = name; setHash(hash); window.scrollTo(0, 0); }

  /* ---------- Timer: starts on the first word typed or dictated, or with the button ---------- */
  const elapsed = d => Math.floor(((d?.elapsedMs || 0) + (d?.runningSince ? Date.now() - d.runningSince : 0)) / 1000);
  function startTimer() { if (draft && !draft.runningSince) { draft.runningSince = Date.now(); persist(); paintTimer(); } }
  function pauseTimer(at = Date.now()) { if (draft?.runningSince) { draft.elapsedMs += Math.max(0, at - draft.runningSince); draft.runningSince = null; persist(); } }
  function paintTimer() {
    if (!draft || screen !== 'question' || !$('#bhTimerText')) return;
    const s = elapsed(draft), [lo, hi] = comp(draft.competency).target, span = hi * 1.25, state = s > hi ? 'over' : s >= lo ? 'in' : '';
    $('#bhTimerText').textContent = `${clock(s)} · aim for ${range([lo, hi])}`;
    $('#bhTimerBadge').textContent = clock(s); $('#bhTimerBadge').className = 'badge bh-timer-badge ' + state;
    $('#bhMeterFill').style.width = Math.min(100, s / span * 100) + '%'; $('#bhMeter').className = 'bh-meter ' + state;
    $('#bhTimerBtn').textContent = draft.runningSince ? 'Pause timer' : s ? 'Resume timer' : 'Start timer';
  }
  setInterval(() => {
    const now = Date.now();
    if (draft?.runningSince && !(view === 'behavioural' && screen === 'question')) pauseTimer(lastTick);
    lastTick = now; if (view === 'behavioural' && screen === 'question') paintTimer();
  }, 500);
  window.addEventListener('pagehide', () => pauseTimer());

  /* ---------- Home: choose a competency, story bank and peer sheet links, history ---------- */
  function open() { enter('home', '#behavioural'); renderHome(); }
  function stats(id) {
    const mine = attempts.filter(a => a.competency === id), analysed = mine.map(a => B.analyse(a.text, { competency: id, tags: a.tags }));
    return { mine, analysed, words: median(analysed.map(x => x.words)), fillers: analysed.length ? Math.round(analysed.reduce((t, x) => t + x.fillers.per100, 0) / analysed.length * 10) / 10 : null,
      complete: analysed.filter(x => x.structure.tagged && x.structure.parts.every(p => p.words)).length };
  }
  function renderHome() {
    pauseTimer(); stopMedia(); view = 'behavioural'; screen = 'home';
    if (stories.some(isEmptyStory)) { stories = stories.filter(s => !isEmptyStory(s)); saveStories(); }
    const gaps = B.coverage(stories).filter(c => !c.count), dq = draft && questionOf(draft);
    const resume = dq ? `<section class="panel bh-resume"><div><b>Unfinished answer</b><p class="note">${esc(comp(draft.competency).title)} · “${esc(dq.text)}” · ${B.wordCount(draft.text)} words · ${clock(elapsed(draft))} on the clock</p></div><div class="actions"><button class="primary" id="bhResume">Resume answer →</button><button id="bhDiscard">Discard</button></div></section>` : '';
    const rows = B.COMPETENCIES.map(c => ({ c, s: stats(c.id) })), practised = rows.filter(r => r.s.mine.length);
    $('#app').innerHTML = `<section class="bh-head"><div class="eyebrow">BEHAVIOURAL INTERVIEW PRACTICE</div><h1 class="bh-title">Answer the HR round <em>with a story.</em></h1><p class="lead">Practise “tell me about yourself”, “why us” and the leadership, teamwork, conflict, failure, pressure, initiative and ethics questions. Answer out loud or type against a timer, then check your structure and delivery. No AI, no account, no cost.</p></section>${resume}
    <div class="bh-grid"><section class="panel bh-setup"><h2>Practise a question</h2>
      <fieldset><legend>Choose a competency</legend><div class="bh-comps">${[['mixed', 'Mixed questions', 'A random question from every competency']].concat(B.COMPETENCIES.map(c => [c.id, c.title, c.short])).map(([id, title, short]) => {
        const n = id === 'mixed' ? attempts.length : attempts.filter(a => a.competency === id).length;
        return `<label class="bh-comp"><input type="radio" name="bhMode" value="${id}" ${prefs.mode === id ? 'checked' : ''}><span><b>${esc(title)}</b><small>${esc(short)}${n ? ` · ${n} answer${n === 1 ? '' : 's'}` : ''}</small></span></label>`; }).join('')}</div></fieldset>
      <label class="selfcheck"><input type="checkbox" id="bhAloud" ${prefs.aloud ? 'checked' : ''}> Read each question aloud, like an interviewer would</label>
      <div class="actions"><button class="primary" id="bhStart">Ask me a question →</button></div>
      <p class="note bh-honest">Feedback here is a set of heuristics, not a score: word counts, a filler-word list, “I” versus “we”, and the share of words you tag as Situation, Task, Action and Result. They spot habits. They cannot tell whether your story is convincing; use the “listen for” cues, or a friend, for that.</p></section>
    <div class="bh-side"><section class="panel"><h2>Story bank</h2><p class="note">Six to eight prepared stories cover most HR rounds. ${stories.length ? `You have ${stories.length} stor${stories.length === 1 ? 'y' : 'ies'}.` : 'You have not written any yet.'}</p>
      ${gaps.length ? `<p class="bh-gaps">${gaps.map(g => `<span>No ${esc(g.id)} story yet</span>`).join('')}</p>` : stories.length ? '<p class="bh-full">Every competency has at least one story.</p>' : ''}<button id="bhStories">Open story bank →</button></section>
      <section class="panel"><h2>Practise with a friend</h2><p class="note">Print an interviewer sheet with questions, what to listen for and a scoring line. One of you asks, the other answers, then swap.</p>
      <label for="bhSheetPick">Sheet</label><select id="bhSheetPick"><option value="all">All competencies</option>${B.COMPETENCIES.map(c => `<option value="${c.id}">${esc(c.title)}</option>`).join('')}</select><button id="bhSheetOpen">Open printable sheet</button></section></div></div>
    <section class="panel bh-history"><h2>Your answers by competency</h2>${practised.length ? `<p class="note">Medians and averages over every saved answer. Fillers are per 100 words. “STAR complete” counts answers where you tagged all four parts.</p>
      <div class="bh-table-wrap"><table class="drill-table bh-table"><thead><tr><th scope="col">Competency</th><th scope="col">Answers</th><th scope="col">Median words</th><th scope="col">Fillers /100</th><th scope="col">STAR complete</th></tr></thead><tbody>${rows.map(({ c, s }) => `<tr><th scope="row">${esc(c.title)}${s.mine.length ? `<small>Last: ${esc(day(s.mine[0].at))}</small>` : ''}</th><td>${s.mine.length || '<span class="subtle">—</span>'}</td><td>${s.words ?? '—'}</td><td>${s.fillers ?? '—'}</td><td>${c.frame === 'star' && s.mine.length ? `${s.complete}/${s.mine.length}` : '—'}</td></tr>`).join('')}</tbody></table></div>
      ${practised.map(({ c, s }) => `<details class="bh-past" data-bh-comp="${c.id}"><summary>${esc(c.title)} · ${s.mine.length} answer${s.mine.length === 1 ? '' : 's'}</summary><ul>${s.mine.map((a, i) => `<li><div><b>${esc(a.question)}</b><span class="note">${esc(day(a.at))} · ${s.analysed[i].words} words · ${s.analysed[i].fillers.total} fillers${a.storyId && storyOf(a.storyId) ? ` · story: ${esc(storyOf(a.storyId).title || 'Untitled story')}` : ''}</span></div><div class="bh-row-actions"><button data-bh-view="${esc(a.id)}">View</button><button data-bh-delete="${esc(a.id)}" aria-label="Delete this answer">Delete</button></div></li>`).join('')}</ul><button class="drill-link" data-bh-download="${c.id}">Download ${esc(c.title.toLowerCase())} answers (.txt)</button></details>`).join('')}
      <div class="actions"><button id="bhDownloadAll">Download all answers (.txt)</button><button id="bhClear">Delete all answers</button></div>` : '<p class="note">Your answers will appear here, grouped by competency, so you can compare attempts. They stay in this browser only.</p>'}</section>`;
    const pick = () => document.querySelector('[name=bhMode]:checked')?.value || 'mixed';
    document.querySelectorAll('[name=bhMode]').forEach(x => x.onchange = () => { prefs.mode = pick(); savePrefs(); });
    $('#bhAloud').onchange = e => { prefs.aloud = e.target.checked; savePrefs(); };
    $('#bhStart').onclick = () => { prefs.mode = pick(); savePrefs(); ask(prefs.mode); };
    if ($('#bhResume')) $('#bhResume').onclick = () => renderQuestion();
    if ($('#bhDiscard')) $('#bhDiscard').onclick = () => { if (!confirm('Discard this unfinished answer? It will not be saved.')) return; draft = null; persist(); renderHome(); };
    $('#bhStories').onclick = openStories;
    $('#bhSheetOpen').onclick = () => sheet($('#bhSheetPick').value);
    document.querySelectorAll('[data-bh-view]').forEach(b => b.onclick = () => feedback(b.dataset.bhView));
    document.querySelectorAll('[data-bh-delete]').forEach(b => b.onclick = () => { if (!confirm('Delete this answer from your history?')) return; attempts = attempts.filter(a => a.id !== b.dataset.bhDelete); saveAttempts(); renderHome(); });
    document.querySelectorAll('[data-bh-download]').forEach(b => b.onclick = () => download(attempts.filter(a => a.competency === b.dataset.bhDownload).map(attemptText).join('\n\n' + '='.repeat(60) + '\n\n'), `case-room-behavioural-${b.dataset.bhDownload}.txt`));
    if ($('#bhDownloadAll')) $('#bhDownloadAll').onclick = () => download(attempts.map(attemptText).join('\n\n' + '='.repeat(60) + '\n\n'), 'case-room-behavioural-answers.txt');
    if ($('#bhClear')) $('#bhClear').onclick = () => { if (!confirm('Delete every saved behavioural answer from this browser? Your story bank is kept. This cannot be undone.')) return; attempts = []; saveAttempts(); renderHome(); };
  }

  /* ---------- Asking a question ---------- */
  function ask(mode, opts = {}) {
    if (draft && draft.text.trim() && !confirm('Replace your unfinished answer? It will not be saved.')) return;
    const recent = attempts.slice(0, 12).map(a => a.qid).concat(draft ? [draft.qid] : [], opts.exclude || []);
    const q = opts.qid ? B.findQuestion(opts.qid) : B.pickQuestion(mode, recent);
    draft = { mode, qid: q.id, competency: q.competency, text: '', elapsedMs: 0, runningSince: null, voice: false, storyId: opts.storyId || null, spoken: false, at: Date.now() };
    persist(); renderQuestion();
  }

  function storyOptions(selected, compId) {
    if (!stories.length) return '';
    const tagged = stories.filter(s => s.tags.includes(compId)), other = stories.filter(s => !s.tags.includes(compId));
    const opt = s => `<option value="${esc(s.id)}" ${selected === s.id ? 'selected' : ''}>${esc(s.title || 'Untitled story')}</option>`;
    return `<label for="bhStory">Story you are telling (optional)</label><select id="bhStory"><option value="">No story linked</option>${tagged.length ? `<optgroup label="Tagged ${esc(comp(compId).title)}">${tagged.map(opt).join('')}</optgroup>` : ''}${other.length ? `<optgroup label="${tagged.length ? 'Other stories' : 'Your stories'}">${other.map(opt).join('')}</optgroup>` : ''}</select>`;
  }
  const linkedNotes = s => s ? `<details class="bh-linked"><summary>Your notes for “${esc(s.title || 'Untitled story')}”</summary>${storyNotes(s)}</details>` : '';
  const storyNotes = s => `<dl class="bh-story-notes">${B.FRAMES.star.parts.map(p => `<dt>${p.label}</dt><dd>${esc(s[p.id]) || '<span class="subtle">Empty</span>'}</dd>`).join('')}</dl>`;

  function renderQuestion() {
    if (!draft) return renderHome();
    enter('question', '#behavioural');
    const q = questionOf(draft), c = comp(draft.competency), linked = storyOf(draft.storyId);
    $('#app').innerHTML = `<div class="row"><div><div class="eyebrow">BEHAVIOURAL · ${esc(modeTitle(draft.mode).toUpperCase())}</div><h2 class="section-title">${esc(c.title)}</h2></div><span class="badge bh-timer-badge" id="bhTimerBadge">0:00</span></div>
      <section class="panel bh-question"><div class="interviewer"><p id="bhPrompt">${esc(q.text)}</p></div>
      ${q.hypothetical ? '<p class="note">This one is hypothetical. Say what you would do and why; if you have a real example, use it. The STAR check is less useful here.</p>' : ''}
      ${voiceControls()}
      <div class="bh-timer"><div class="bh-meter" id="bhMeter" aria-hidden="true"><span id="bhMeterFill"></span><i style="left:${80 * c.target[0] / c.target[1]}%"></i><i style="left:80%"></i></div><span id="bhTimerText" class="note" aria-live="off"></span><button id="bhTimerBtn">Start timer</button></div>
      <p class="note">The timer starts when you start typing or dictating. If you answer out loud without dictation, start it yourself. ${c.frame === 'star' ? 'Structure: Situation, Task, Action, Result.' : `Structure: ${esc(B.FRAMES[c.frame].title)}.`} ${esc(c.tip)}</p>
      <label for="bhAnswer">Your answer · speak or type</label><textarea id="bhAnswer" placeholder="Answer as you would out loud…">${esc(draft.text)}</textarea>
      <div class="voice-row"><button id="bhMic" class="mic">◉ Dictate answer</button><select id="bhLanguage" aria-label="Dictation language">${LANGS.map(([v, t]) => `<option value="${v}" ${prefs.lang === v ? 'selected' : ''}>${t}</option>`).join('')}</select><span id="bhVoiceStatus" class="note" role="status"></span></div>
      <p class="note">Stop dictation to edit. Speech services may process audio or text online. No audio recording is kept.</p>
      ${storyOptions(draft.storyId, c.id)}<div id="bhLinked">${linkedNotes(linked)}</div>
      <details id="bhProbe"><summary>Practise a follow-up</summary><ul class="bh-probes">${c.probes.concat(c.frame === 'star' ? B.GENERAL_PROBES : []).map(p => `<li>${esc(p)}</li>`).join('')}</ul><p class="note">Prepared follow-ups an interviewer might ask next. Add your answer to the box above, or practise it out loud.</p></details>
      <details><summary>What the interviewer listens for</summary><ul class="bh-cues">${c.listenFor.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>
      <div class="actions"><button id="bhExit">Save & exit</button><button id="bhSkip">Different question</button><button id="bhFinish" class="primary next">Finish & see feedback</button></div></section>`;
    bindSpeech(q.text); paintTimer();
    const owner = draft, area = $('#bhAnswer');
    area.oninput = () => { owner.text = area.value; if (area.value.trim()) startTimer(); persist(); };
    attachDictation({ button: $('#bhMic'), target: area, status: $('#bhVoiceStatus'), language: () => $('#bhLanguage').value, isCurrent: () => draft === owner,
      onStart: () => { owner.voice = true; startTimer(); persist(); }, onText: v => { owner.text = v; owner.voice = true; persist(); } });
    $('#bhLanguage').onchange = e => { prefs.lang = e.target.value; savePrefs(); };
    $('#bhTimerBtn').onclick = () => { if (draft.runningSince) pauseTimer(); else startTimer(); paintTimer(); };
    if ($('#bhStory')) $('#bhStory').onchange = e => { draft.storyId = e.target.value || null; persist(); $('#bhLinked').innerHTML = linkedNotes(storyOf(draft.storyId)); };
    $('#bhExit').onclick = () => { pauseTimer(); renderHome(); };
    $('#bhSkip').onclick = () => {
      if (draft.text.trim() && !confirm('Skip to a different question? Your answer to this one will not be saved.')) return;
      const was = draft; draft = null; ask(was.mode, { exclude: [was.qid], storyId: was.storyId });
    };
    $('#bhFinish').onclick = finish;
    if (prefs.aloud && !draft.spoken) { draft.spoken = true; persist(); speak(q.text); }
  }

  function finish() {
    if (!draft) return;
    if (!draft.text.trim()) { toast('Answer the question first, by dictating or typing, so there is something to check.'); return; }
    pauseTimer(); stopMedia();
    const q = questionOf(draft), a = { id: newId('b'), at: Date.now(), competency: draft.competency, mode: draft.mode, qid: q.id, question: q.text, text: draft.text.trim(),
      seconds: draft.elapsedMs ? Math.round(draft.elapsedMs / 1000) : null, voice: draft.voice, storyId: draft.storyId, tags: {}, heard: [], notes: '' };
    attempts.unshift(a); attempts = attempts.slice(0, MAX_ATTEMPTS); saveAttempts();
    draft = null; persist(); feedback(a.id);
  }

  /* ---------- Feedback: heuristics, STAR tagging and self-review ---------- */
  const levelMark = l => l === 'ok' ? '✓' : l === 'missing' ? '○' : '↗';
  const checkList = checks => `<ul class="bh-checks">${checks.map(x => `<li class="${x.level}"><span aria-hidden="true">${levelMark(x.level)}</span> ${esc(x.text)}</li>`).join('')}</ul>`;
  function bar(st) {
    const total = st.total + st.untagged; if (!total) return '';
    const cells = st.parts.filter(p => p.words).map(p => `<span class="bh-part-${p.id}" style="width:${p.words / total * 100}%" title="${esc(p.label)} ${p.share}%">${p.words / total > 0.08 ? esc(p.short) : ''}</span>`).join('') + (st.untagged ? `<span class="bh-part-none" style="width:${st.untagged / total * 100}%" title="Untagged"></span>` : '');
    return `<div class="bh-bar" aria-hidden="true">${cells}</div><ul class="bh-legend">${st.parts.map(p => `<li><i class="bh-part-${p.id}"></i>${esc(p.label)} <b>${p.share}%</b> <span class="subtle">${p.words} words</span></li>`).join('')}${st.untagged ? `<li><i class="bh-part-none"></i>Untagged <span class="subtle">${st.untagged} words</span></li>` : ''}</ul>`;
  }
  function metrics(a, r) {
    const fill = Object.entries(r.fillers.counts).sort((x, y) => y[1] - x[1]).map(([k, n]) => `“${k}” ×${n}`).join(', ');
    return `<div class="score-grid bh-metrics"><div><div class="metric">${r.words}</div><span class="note">Words · about ${secs(r.estSeconds)} spoken at ${B.SPEAKING_WPM} wpm</span></div>
      <div><div class="metric">${a.seconds ? secs(a.seconds) : '—'}</div><span class="note">${a.seconds ? (r.pace ? `On the clock · ${r.pace.wpm} words a minute` : 'On the clock · typed, so no pace') : 'Timer not started'}</span></div>
      <div><div class="metric">${r.fillers.total}</div><span class="note">Filler words · ${r.fillers.per100} per 100 words</span></div>
      <div><div class="metric">${r.pronouns.i}<small> / ${r.pronouns.we}</small></div><span class="note">“I” / “we”</span></div></div>
      ${checkList([r.time, ...(r.pace ? [r.pace] : []), { level: r.fillers.level, text: r.fillers.total ? `Fillers: ${fill}.${r.fillers.level === 'warn' ? ' More than about 3 per 100 words starts to be noticeable.' : ''}${a.voice ? '' : ' Typed answers usually look cleaner than you sound, so try dictating.'}` : a.voice ? 'No filler words found in the transcript. Dictation sometimes drops them, so listen to yourself as well.' : 'No filler words found. Typed answers rarely have them; dictate to check how you sound.' }, { level: r.pronouns.level, text: r.pronouns.text }])}`;
  }
  function tagger(a, r) {
    const c = comp(a.competency), frame = B.FRAMES[c.frame], st = r.structure;
    return `<p class="note">Tag each sentence with the part of the ${esc(frame.title)} structure it belongs to. Dictation rarely adds full stops, so long stretches are split into chunks; add full stops in “Edit transcript” to control the split.</p>
      <ol class="bh-segs">${st.segments.map((s, i) => `<li><p>${esc(s)}</p><div class="bh-tags" role="group" aria-label="Tag part ${i + 1}">${frame.parts.map(p => `<button type="button" class="bh-tag bh-part-${p.id}" data-seg="${i}" data-part="${p.id}" aria-pressed="${a.tags[s] === p.id}" title="${esc(p.label)}"><span aria-hidden="true">${esc(p.short)}</span><span class="sr-only">${esc(p.label)}</span></button>`).join('')}</div></li>`).join('')}</ol>
      <div class="bh-structure" id="bhStructure">${st.tagged ? bar(st) + checkList(st.checks) : `<p class="note">Tag at least one sentence to see the shares. ${frame.parts.map(p => `<b>${esc(p.label)}</b>: ${esc(p.hint)}`).join(' ')}</p>`}</div>
      ${Object.keys(a.tags).length ? '<button class="drill-link" id="bhClearTags">Clear all tags</button>' : ''}`;
  }

  function feedback(id) {
    const a = attempts.find(x => x.id === id); if (!a) return renderHome();
    enter('feedback', '#behavioural'); current = a.id;
    const c = comp(a.competency), linked = storyOf(a.storyId);
    $('#app').innerHTML = `<div class="eyebrow">YOUR ANSWER · ${esc(c.title.toUpperCase())} · ${esc(day(a.at))}</div><h1 class="bh-q">${esc(a.question)}</h1>
      <p class="bh-honest-box"><b>Heuristics, not a score.</b> These numbers come from counting words and matching word lists. They can point out habits such as a long set-up, lots of fillers or “we” where the interviewer wants “I”, but they cannot judge whether your answer is good. Judge that against the “listen for” cues below.</p>
      <div id="bhMetrics">${metrics(a, B.analyse(a.text, { competency: a.competency, seconds: a.seconds, voice: a.voice, tags: a.tags }))}</div>
      <section class="panel bh-feedback"><h2>Check your structure</h2><div id="bhTagger"></div>
      <h2>What the interviewer listens for</h2><p class="note">Tick what you think your answer actually showed. Be strict: if you only implied it, leave it unticked.</p>
      ${c.listenFor.map((x, i) => `<label class="selfcheck"><input type="checkbox" data-bh-heard="${i}" ${a.heard.includes(i) ? 'checked' : ''}>${esc(x)}</label>`).join('')}
      <label for="bhNotes">Notes for next time</label><textarea id="bhNotes" placeholder="What would you change if you answered again?">${esc(a.notes)}</textarea>
      <details><summary>Edit transcript</summary><label for="bhEdit" class="sr-only">Transcript</label><textarea id="bhEdit">${esc(a.text)}</textarea><p class="note">Fix dictation mistakes or add full stops. Tags stay on the parts you have not changed.</p></details>
      ${linked ? `<details><summary>Compare with your story notes: “${esc(linked.title || 'Untitled story')}”</summary>${storyNotes(linked)}</details>` : ''}
      <details><summary>Read your answer</summary><p class="transcript" id="bhTranscript">${esc(a.text)}</p></details>
      <div class="actions"><button class="primary" id="bhAgain">Answer this question again</button><button id="bhNext">Next question</button><button id="bhDownload">Download (.txt)</button><button id="bhBack">Behavioural home</button></div></section>`;
    const refresh = (all = true) => {
      const r = B.analyse(a.text, { competency: a.competency, seconds: a.seconds, voice: a.voice, tags: a.tags });
      if (all) $('#bhMetrics').innerHTML = metrics(a, r);
      $('#bhTagger').innerHTML = tagger(a, r);
      document.querySelectorAll('[data-seg]').forEach(b => b.onclick = () => {
        const seg = r.structure.segments[Number(b.dataset.seg)]; if (seg == null) return;
        if (a.tags[seg] === b.dataset.part) delete a.tags[seg]; else a.tags[seg] = b.dataset.part;
        saveAttempts(); refresh(false); document.querySelector(`[data-seg="${b.dataset.seg}"][data-part="${b.dataset.part}"]`)?.focus({ preventScroll: true });
      });
      if ($('#bhClearTags')) $('#bhClearTags').onclick = () => { a.tags = {}; saveAttempts(); refresh(false); };
    };
    refresh();
    document.querySelectorAll('[data-bh-heard]').forEach(el => el.onchange = () => { const i = Number(el.dataset.bhHeard); a.heard = el.checked ? [...new Set([...a.heard, i])] : a.heard.filter(x => x !== i); saveAttempts(); });
    $('#bhNotes').oninput = e => { a.notes = e.target.value.slice(0, 5000); saveAttempts(); };
    $('#bhEdit').oninput = e => { a.text = e.target.value.slice(0, MAX_TEXT); const keep = new Set(B.segments(a.text)); for (const k of Object.keys(a.tags)) if (!keep.has(k)) delete a.tags[k]; saveAttempts(); $('#bhTranscript').textContent = a.text; refresh(); };
    $('#bhAgain').onclick = () => ask(a.mode, { qid: a.qid || undefined, storyId: a.storyId });
    $('#bhNext').onclick = () => ask(a.mode);
    $('#bhDownload').onclick = () => download(attemptText(a), `case-room-behavioural-${a.competency}-${new Date(a.at).toISOString().slice(0, 10)}.txt`);
    $('#bhBack').onclick = renderHome;
  }

  function attemptText(a) {
    const c = comp(a.competency), r = B.analyse(a.text, { competency: a.competency, seconds: a.seconds, voice: a.voice, tags: a.tags }), st = r.structure, s = storyOf(a.storyId);
    return `CASE ROOM — BEHAVIOURAL PRACTICE\n${new Date(a.at).toLocaleString()} · ${c.title}${s ? `\nStory: ${s.title || 'Untitled story'}` : ''}\n\nQUESTION\n${a.question}\n\nYOUR ANSWER\n${a.text}\n\n` +
      `HEURISTIC CHECKS (word counts and word lists, not a score)\nWords: ${r.words} (about ${secs(r.estSeconds)} at ${B.SPEAKING_WPM} words a minute)\nTime on the clock: ${a.seconds ? secs(a.seconds) : 'not timed'}${r.pace ? ` · ${r.pace.wpm} words a minute` : ''}\n` +
      `Filler words: ${r.fillers.total} (${r.fillers.per100} per 100 words)${r.fillers.total ? ' — ' + Object.entries(r.fillers.counts).map(([k, n]) => `${k} ×${n}`).join(', ') : ''}\n"I": ${r.pronouns.i} · "we": ${r.pronouns.we}\n- ${r.time.text}\n` +
      (st.tagged ? `\nSTRUCTURE (${B.FRAMES[st.frame].title}, from your tags)\n${st.parts.map(p => `${p.label}: ${p.share}% (${p.words} words)`).join('\n')}${st.untagged ? `\nUntagged: ${st.untagged} words` : ''}\n${st.checks.map(x => '- ' + x.text).join('\n')}\n` : '\nSTRUCTURE\nNot tagged.\n') +
      `\nLISTEN FOR (self-review)\n${c.listenFor.map((x, i) => `[${a.heard.includes(i) ? 'x' : ' '}] ${x}`).join('\n')}\n\nNOTES\n${a.notes || 'None.'}`;
  }

  /* ---------- Story bank ---------- */
  function openStories() { editing = null; renderStories(); }
  function practisedCount(id) { return attempts.filter(a => a.storyId === id).length; }
  function storyCard(s) {
    const st = B.storyStructure(s), problems = st.checks.filter(x => x.level !== 'ok'), n = practisedCount(s.id);
    return `<article class="bh-story"><div class="row"><h3>${esc(s.title || 'Untitled story')}</h3><span class="note">${n ? `Practised ${n}×` : 'Not practised yet'}</span></div>
      <p class="bh-chips">${s.tags.length ? s.tags.map(t => `<span>${esc(comp(t).title)}</span>`).join('') : '<span class="none">No competencies tagged</span>'}</p>
      ${st.tagged ? bar(st) : '<p class="note">Empty so far.</p>'}${st.tagged ? (problems.length ? `<details><summary>${problems.length} thing${problems.length === 1 ? '' : 's'} to check</summary>${checkList(problems)}</details>` : '<p class="note">✓ All four parts filled; Action is the largest.</p>') : ''}
      <div class="bh-row-actions"><button data-story-edit="${esc(s.id)}">Edit</button><button data-story-practise="${esc(s.id)}" ${s.tags.length ? '' : 'disabled title="Tag a competency first"'}>Practise with it</button><button data-story-delete="${esc(s.id)}">Delete</button></div></article>`;
  }
  function renderStories() {
    enter('stories', '#behavioural-stories');
    stories = stories.filter(s => !isEmptyStory(s)); saveStories();
    const cov = B.coverage(stories);
    $('#app').innerHTML = `<div class="actions bh-back"><button id="bhBackHome">← Behavioural practice</button></div><section class="bh-head"><div class="eyebrow">STORY BANK</div><h1 class="bh-title">Six to eight stories <em>cover most HR rounds.</em></h1><p class="lead">Write each story once in STAR form and tag the competencies it can answer. A good story usually covers two or three. Then practise telling it out loud against different questions.</p></section>
      <section class="panel"><h2>Coverage</h2><div class="bh-coverage">${cov.map(c => `<div class="${c.count ? 'has' : 'gap'}"><b>${esc(comp(c.id).title)}</b>${c.count ? `<span>${c.count} stor${c.count === 1 ? 'y' : 'ies'}</span><small>${c.stories.map(s => esc(s.title || 'Untitled story')).join(' · ')}</small>` : `<span>No ${esc(c.id)} story yet</span>`}</div>`).join('')}</div>
      <p class="note">“Tell me about yourself” and “Why this company” are not single stories, so practise them from the question page. ${stories.length < 6 ? `You have ${stories.length} of the 6–8 stories most people need.` : stories.length > 8 ? 'More than eight is fine; make sure you can tell each one well.' : 'That is a solid bank. Keep practising them out loud.'}</p></section>
      <section class="panel"><div class="row"><h2>Your stories (${stories.length})</h2><button class="primary" id="bhNewStory" ${stories.length >= MAX_STORIES ? 'disabled' : ''}>+ New story</button></div>
      ${stories.length ? `<div class="bh-stories">${stories.map(storyCard).join('')}</div>` : '<p class="note">No stories yet. Think of a group project, an internship, a club or fest you ran, a deadline you nearly missed, a mistake you fixed. Each can become a story.</p>'}
      <div class="actions"><button id="bhExport" ${stories.length ? '' : 'disabled'}>Export stories (.json)</button><label class="bh-import"><input type="file" id="bhImport" accept="application/json,.json"><span>Import stories (.json)</span></label><span class="note">Stories stay in this browser. Export them to keep a copy or move to another device.</span></div></section>`;
    $('#bhBackHome').onclick = open;
    $('#bhNewStory').onclick = () => { const s = cleanStory({ id: newId('s') }); stories.push(s); saveStories(); editStory(s.id); };
    document.querySelectorAll('[data-story-edit]').forEach(b => b.onclick = () => editStory(b.dataset.storyEdit));
    document.querySelectorAll('[data-story-delete]').forEach(b => b.onclick = () => { if (!confirm('Delete this story? Practice answers linked to it are kept.')) return; stories = stories.filter(s => s.id !== b.dataset.storyDelete); saveStories(); renderStories(); });
    document.querySelectorAll('[data-story-practise]').forEach(b => b.onclick = () => { const s = storyOf(b.dataset.storyPractise); if (!s?.tags.length) return; ask(s.tags[Math.floor(Math.random() * s.tags.length)], { storyId: s.id }); });
    $('#bhExport').onclick = () => download(JSON.stringify({ kind: EXPORT_KIND, version: 1, exported: new Date().toISOString(), stories }, null, 2), 'case-room-story-bank.json');
    $('#bhImport').onchange = async e => { const file = e.target.files?.[0]; if (!file) return; try { const r = importStories(await file.text()); toast(`Imported ${r.added} new and updated ${r.updated} existing stor${r.added + r.updated === 1 ? 'y' : 'ies'}.`); } catch (err) { toast(err.message); } e.target.value = ''; renderStories(); };
  }
  /* Accepts an export from this page (or a bare array of stories). Stories with the same id are replaced. */
  function importStories(text) {
    let data; try { data = JSON.parse(text); } catch { throw Error('That file is not valid JSON. Choose a story bank exported from Case Room.'); }
    const incoming = Array.isArray(data) ? data : isObj(data) && data.kind === EXPORT_KIND && Array.isArray(data.stories) ? data.stories : null;
    if (!incoming) throw Error('That file is not a Case Room story bank export.');
    const clean = incoming.map(cleanStory).filter(s => s && !isEmptyStory(s));
    if (!clean.length) throw Error('No stories found in that file.');
    let added = 0, updated = 0;
    for (const s of clean) { const i = stories.findIndex(x => x.id === s.id); if (i >= 0) { stories[i] = s; updated++; } else if (stories.length < MAX_STORIES) { stories.push(s); added++; } }
    saveStories(); return { added, updated, skipped: clean.length - added - updated };
  }
  function editStory(id) {
    const s = storyOf(id); if (!s) return renderStories();
    enter('story', '#behavioural-stories'); editing = id;
    $('#app').innerHTML = `<div class="actions bh-back"><button id="bhStoryDone">← All stories</button></div><div class="eyebrow">STORY BANK · EDIT</div>
      <div class="bh-editor"><section class="panel"><label for="bhTitle">Short title</label><input id="bhTitle" class="bh-input" maxlength="120" placeholder="e.g. Sponsor pulled out of the college fest" value="${esc(s.title)}">
      ${B.FRAMES.star.parts.map(p => `<label for="bhStory-${p.id}">${p.label}</label><p class="note">${esc(p.hint)}</p><textarea id="bhStory-${p.id}" data-story-field="${p.id}" class="${p.id === 'a' ? 'bh-tall' : ''}">${esc(s[p.id])}</textarea>`).join('')}
      <fieldset><legend>Which questions can this story answer?</legend><div class="bh-comps bh-comps-small">${B.STORY_IDS.map(t => `<label class="bh-comp"><input type="checkbox" data-story-tag="${t}" ${s.tags.includes(t) ? 'checked' : ''}><span><b>${esc(comp(t).title)}</b></span></label>`).join('')}</div></fieldset>
      <p class="note">Saved as you type, in this browser only.</p><div class="actions"><button class="primary" id="bhStoryDone2">Done</button><button id="bhStoryDelete">Delete story</button></div></section>
      <aside class="panel bh-story-check"><h3>STAR check</h3><div id="bhStoryCheck"></div><p class="note">Write notes, not a script: you will tell it differently each time. The check uses the same rules of thumb as the answer feedback.</p></aside></div>`;
    const paint = () => { const st = B.storyStructure(s); $('#bhStoryCheck').innerHTML = st.tagged ? bar(st) + checkList(st.checks) : '<p class="note">Start writing to see how the parts balance.</p>'; };
    const touch = () => { s.updated = Date.now(); saveStories(); };
    paint();
    $('#bhTitle').oninput = e => { s.title = e.target.value.slice(0, 120); touch(); };
    document.querySelectorAll('[data-story-field]').forEach(el => el.oninput = () => { s[el.dataset.storyField] = el.value.slice(0, 6000); touch(); paint(); });
    document.querySelectorAll('[data-story-tag]').forEach(el => el.onchange = () => { s.tags = B.STORY_IDS.filter(t => document.querySelector(`[data-story-tag="${t}"]`).checked); touch(); });
    $('#bhStoryDone').onclick = $('#bhStoryDone2').onclick = openStories;
    $('#bhStoryDelete').onclick = () => { if (!isEmptyStory(s) && !confirm('Delete this story?')) return; stories = stories.filter(x => x.id !== s.id); saveStories(); openStories(); };
    $('#bhTitle').focus({ preventScroll: true });
  }

  /* ---------- Printable interviewer sheet for practising with a friend ---------- */
  function sheet(which) {
    const list = which === 'all' || !comp(which) ? B.COMPETENCIES : [comp(which)], key = list.length === 1 ? list[0].id : 'all';
    enter('sheet', '#behavioural-sheet/' + key);
    const scale = ['Structure', 'Specific actions', 'Result and learning'].map(x => `${x} ☐1 ☐2 ☐3 ☐4 ☐5`).join(' &nbsp;·&nbsp; ');
    $('#app').innerHTML = `<div class="actions peer-sheet-actions"><button class="primary" id="bhPrint">Print / save PDF</button><button id="bhSheetBack">← Back</button><label class="sr-only" for="bhSheetSwitch">Competency</label><select id="bhSheetSwitch"><option value="all">All competencies</option>${B.COMPETENCIES.map(c => `<option value="${c.id}" ${key === c.id ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select></div>
      <article class="peer-sheet bh-sheet"><header class="bh-sheet-head"><div class="eyebrow">CASE ROOM · BEHAVIOURAL INTERVIEWER SHEET</div><h1 class="peer-title">${key === 'all' ? 'HR round practice' : esc(list[0].title)}</h1>
      <p class="bh-blanks">${['Candidate', 'Interviewer', 'Date'].map(x => `<span>${x} <i></i></span>`).join('')}</p>
      <p class="note"><b>How to run it:</b> ask one question per section and let the candidate answer for up to two minutes without interrupting. Ask one follow-up. Time the answer and tick what you heard. Score each line from 1 (missing) through 3 (there, but vague) to 5 (clear and specific). Then swap roles. These scores are one friend's judgement, not a hiring verdict.</p></header>
      ${list.map(c => `<section class="peer-sheet-stage"><h3>${esc(c.title)} <span class="note">· aim for ${range(c.target)} · ${esc(B.FRAMES[c.frame].title)}</span></h3>
        <p><b>Ask one:</b></p><ul class="peer-tick">${c.questions.map(q => `<li>☐ ${esc(q.text)}</li>`).join('')}</ul>
        <p><b>Follow-up:</b> ${c.probes.concat(c.frame === 'star' ? B.GENERAL_PROBES.slice(0, 1) : []).map(esc).join(' · ')}</p>
        <p><b>Listen for:</b></p><ul class="peer-tick">${c.listenFor.map(x => `<li>☐ ${esc(x)}</li>`).join('')}</ul>
        <p class="bh-score">${scale}</p><p class="bh-score bh-blanks"><span>Time (s) <i class="short"></i></span><span>Fillers noticed <i class="short"></i></span><span>Mostly “I” ☐ &nbsp;Mostly “we” ☐</span></p><div class="peer-lines"></div></section>`).join('')}
      <section class="peer-sheet-stage"><h3>Across the whole round</h3><p><b>One thing to keep doing:</b></p><div class="peer-lines"></div><p><b>One thing to change next time:</b></p><div class="peer-lines"></div></section></article>`;
    $('#bhPrint').onclick = () => window.print();
    $('#bhSheetBack').onclick = open;
    $('#bhSheetSwitch').onchange = e => sheet(e.target.value);
  }

  /* ---------- Integration with the rest of Case Room ---------- */
  $('#behaviouralNav').onclick = open;
  const priorHome = home;
  home = function () {
    pauseTimer(); priorHome(); if (location.hash.startsWith('#behavioural')) setHash('');
    const tools = $('#app .tool-callouts'); if (!tools) return;
    const tile = document.createElement('div'); tile.className = 'drill-callout tool-callout';
    tile.innerHTML = `<div><div class="eyebrow">NEW · BEHAVIOURAL ROUND</div><h3>Practise the HR questions</h3><p class="note">Timed answers to “tell me about yourself”, leadership, conflict, failure and more, with STAR tagging and a story bank. No AI needed.</p></div><button class="primary" id="behaviouralCallout">Practise HR questions →</button>`;
    tools.append(tile); $('#behaviouralCallout').onclick = open;
  };

  window.Behavioural = { open, stories: openStories, sheet, ask, feedback, importStories, state: () => ({ attempts, stories, draft, prefs, screen, current, editing }) };
})();
