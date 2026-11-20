/* Résumé and project defence: an interviewer picks one line of your résumé, or one project, and keeps asking until
   they know what you did. Questions come from DefenceContent (src/defence-content.js): simple rules over the words in
   the line, each with the reason it was asked. Run under interview conditions: no skipping, no second attempt, no help,
   one follow-up at most per answer, and feedback only at the end. No AI and no server.
   Uses core.js helpers and speak()/stopMedia()/attachDictation()/voiceControls()/bindSpeech()/flowBar()/nudge() from
   cases.js, ResumeCheck.lintBullet and ResumeTool (put a rewritten line back), and Behavioural.importStories.
   Stores two things in this browser: cr-defence-run (the session in progress) and cr-defence-past (up to 20 finished
   sessions). Only the one line or project title and the answers are kept, never the résumé. */
(() => {
  const D = DefenceContent, RC = ResumeCheck, L = D.LIMITS;
  const RUN_KEY = 'cr-defence-run', PAST_KEY = 'cr-defence-past', MAX_PAST = 20, MAX_Q = 10, MAX_MS = 36e5;
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const str = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
  const newId = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
  const secs = n => n == null ? 'not timed' : n < 60 ? `${Math.round(n)}s` : clock(Math.round(n));
  const day = t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const short = (s, n) => s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
  const tidy = (s, max) => String(s == null ? '' : s).replace(/^[\s•\-*–▪·]+/, '').replace(/\s+/g, ' ').trim().slice(0, max);
  const STOCK = 'Built an Excel model to forecast demand for 120 SKUs, cutting stock-outs by 18% over six weeks';

  /* ---------- Storage, validated field by field on every load ---------- */
  function cleanQuestion(q) {
    if (!isObj(q) || typeof q.text !== 'string' || !q.text.trim()) return null;
    const listenFor = Array.isArray(q.listenFor) ? q.listenFor.filter(x => typeof x === 'string' && x.trim()).slice(0, 3).map(x => x.slice(0, 200)) : [];
    return { id: str(q.id, 20), text: q.text.slice(0, 700), why: str(q.why, 400), listenFor };
  }
  const cleanFollow = f => isObj(f) && typeof f.text === 'string' && f.text.trim() ? { id: str(f.id, 20), text: f.text.slice(0, 400), why: str(f.why, 300) } : null;
  const seconds = v => Number.isFinite(v) && v > 0 ? Math.min(v, MAX_MS / 1000) : null;
  function cleanAnswer(a, q) {
    if (!isObj(a) || !q || a.id !== q.id || typeof a.text !== 'string' || !a.text.trim()) return null;
    const follow = cleanFollow(a.follow), reply = follow ? str(a.reply, L.answer) : '';
    return { id: q.id, text: a.text.slice(0, L.answer), seconds: seconds(a.seconds), voice: !!a.voice, follow: follow && reply.trim() ? follow : null, reply: follow && reply.trim() ? reply : '', replySeconds: follow && reply.trim() ? seconds(a.replySeconds) : null };
  }
  function cleanHeard(h, questions, answers) {
    const out = {};
    if (!isObj(h)) return out;
    for (const [k, v] of Object.entries(h)) {
      const i = Number(k);
      if (!/^\d{1,2}$/.test(k) || i >= questions.length || !answers[i] || !Array.isArray(v)) continue;
      const ok = [...new Set(v.filter(n => Number.isInteger(n) && n >= 0 && n < questions[i].listenFor.length))].sort((a, b) => a - b);
      if (ok.length) out[i] = ok;
    }
    return out;
  }
  /* A session read back from storage, or null. done is true for a finished one. Answers stop at the first bad one, and
     the question being answered is worked out from them, so a half-edited record can never point past its questions. */
  function cleanSession(v, done) {
    if (!isObj(v) || (v.kind !== 'line' && v.kind !== 'project')) return null;
    const questions = Array.isArray(v.questions) ? v.questions.map(cleanQuestion) : [];
    if (!questions.length || questions.length > MAX_Q || questions.some(q => !q)) return null;
    const kind = v.kind, line = kind === 'line' ? tidy(v.line, L.line) : '', title = kind === 'project' ? tidy(v.title, L.title) : '';
    if (!(kind === 'line' ? line : title)) return null;
    const answers = [];
    for (const a of Array.isArray(v.answers) ? v.answers : []) { const c = cleanAnswer(a, questions[answers.length]); if (!c || answers.length >= questions.length) break; answers.push(c); }
    let follow = done ? null : cleanFollow(v.follow), index = answers.length;
    if (follow && answers.length && !answers[answers.length - 1].follow) index = answers.length - 1; else follow = null;
    if (done && !answers.length) return null;
    const s = { id: typeof v.id === 'string' && /^[\w-]{1,30}$/.test(v.id) ? v.id : newId(), kind, line, title, projectKind: D.kindOf(v.projectKind).id, fromResume: kind === 'line' && !!v.fromResume,
      questions, index, follow, answers, draft: done ? '' : str(v.draft, L.answer), heard: cleanHeard(v.heard, questions, answers),
      rewrite: kind === 'line' && typeof v.rewrite === 'string' && v.rewrite.trim() ? v.rewrite.slice(0, L.line) : null, storySaved: !!v.storySaved, putBack: kind === 'line' && !!v.putBack,
      started: Number.isFinite(v.started) ? v.started : Date.now(), finished: done ? (Number.isFinite(v.finished) ? v.finished : Date.now()) : null,
      elapsedMs: !done && Number.isFinite(v.elapsedMs) && v.elapsedMs > 0 ? Math.min(v.elapsedMs, MAX_MS) : 0, voice: !done && !!v.voice, spoken: !done && !!v.spoken };
    return s;
  }
  const list = (k, done) => { const v = read(k, []); return Array.isArray(v) ? v.map(s => cleanSession(s, done)).filter(Boolean) : []; };

  let past = list(PAST_KEY, true).slice(0, MAX_PAST).filter((s, i, all) => all.findIndex(x => x.id === s.id) === i);
  let run = cleanSession(read(RUN_KEY, null), false);
  let screen = 'home', viewing = null, since = null, picked = null;
  const toPast = s => ({ ...s, index: s.answers.length, follow: null, draft: '', elapsedMs: 0, voice: false, spoken: false, finished: Date.now() });
  // A session whose every question was answered but which never reached the debrief goes to the past list.
  if (run && run.index >= run.questions.length) { past.unshift(toPast(run)); past = past.slice(0, MAX_PAST); run = null; save(PAST_KEY, past); save(RUN_KEY, null); }

  const savePast = () => save(PAST_KEY, past);
  const elapsedMs = () => (run ? run.elapsedMs : 0) + (since != null ? Math.max(0, Date.now() - since) : 0);
  function persist() { if (run) save(RUN_KEY, { ...run, elapsedMs: Math.min(MAX_MS, elapsedMs()) }); else save(RUN_KEY, null); }
  const canSpeak = () => voiceOn();
  const prompt = () => run.follow ? run.follow.text : run.questions[run.index].text;

  function setHash(h) { try { window.history.replaceState(null, '', location.pathname + location.search + h); } catch { /* file:// or sandboxed frames */ } }
  function enter(name) { bank(); stopMedia(); view = 'defence'; screen = name; setHash('#defence'); window.scrollTo(0, 0); }

  /* ---------- Clock: starts with the first typed character or when dictation starts ---------- */
  function bank() { if (since != null && run) { const d = Math.max(0, Date.now() - since); since = null; run.elapsedMs = Math.min(MAX_MS, run.elapsedMs + d); persist(); } since = null; }
  function startClock() { if (run && since == null) { since = Date.now(); persist(); paint(); } }
  function paint() { if (run && screen === 'question' && $('#dfTimerText')) $('#dfTimerText').textContent = clock(Math.floor(elapsedMs() / 1000)); }
  /* Every half second. Leaving the question screen by any route (another tool, the nav) pauses the clock. */
  function beat() { if (since != null && !(view === 'defence' && screen === 'question')) { bank(); return; } paint(); }
  setInterval(beat, 500);
  window.addEventListener('pagehide', () => bank());
  const took = () => { const ms = elapsedMs(); return ms > 0 ? Math.max(1, Math.round(ms / 1000)) : null; };

  /* ---------- Home ---------- */
  function open(mode) {
    enter('home'); renderHome();
    const first = mode === 'project' ? '#dfKind' : mode === 'line' ? '#dfLine' : null, panel = mode === 'project' ? '#dfPanelProject' : '#dfPanelLine';
    if (first && $(first)) { $(panel).scrollIntoView({ block: 'start' }); $(first).focus({ preventScroll: true }); }
  }
  function renderHome() {
    const bullets = ResumeTool.state().analysis?.bullets || [];
    const kind = D.KINDS[0];
    picked = null;
    const resume = run ? `<section class="panel bh-resume"><div><b>Unfinished defence · interview conditions</b><p class="note">Question ${run.index + 1} of ${run.questions.length}${run.follow ? ' · follow-up' : ''} · ${esc(short(run.kind === 'project' ? run.title : run.line, 90))} · your place and typed text are kept</p></div><div class="actions"><button class="primary" id="dfResume">Carry on →</button><button class="wu-link" id="dfDiscard">Discard</button></div></section>` : '';
    $('#app').innerHTML = `<section class="bh-head"><div class="eyebrow">RÉSUMÉ AND PROJECT DEFENCE</div><h1 class="bh-title">Defend what <em>you wrote.</em></h1>
      <p class="lead">An interviewer picks a line from your résumé, or a project, and keeps asking until they know what you did. Practise that here under interview conditions: no help, no second attempt, feedback at the end. No AI.</p></section>${resume}
      <div class="df-grid"><section class="panel df-panel" id="dfPanelLine"><h2>A line from my résumé</h2>
        <label for="dfLine">One line, as it appears on your résumé</label>
        <textarea id="dfLine" rows="3" maxlength="${L.line}" placeholder="${esc(STOCK)}"></textarea>
        ${bullets.length ? `<label for="dfPick">or pick a line from the résumé you checked</label><select id="dfPick"><option value="">Choose a bullet…</option>${bullets.map((b, i) => `<option value="${i}">${esc(short(b.text, 90))}</option>`).join('')}</select>` : ''}
        <div class="actions"><button class="primary" id="dfStartLine">Start the defence →</button></div>
        <p class="flow-hint df-hint" id="flowHint" role="status"></p></section>
      <section class="panel df-panel" id="dfPanelProject"><h2>A project</h2>
        <label for="dfKind">What kind of work was it?</label><select id="dfKind">${D.KINDS.map(k => `<option value="${k.id}">${esc(k.label)}</option>`).join('')}</select>
        <label for="dfTitle">Its name or a short description</label><input id="dfTitle" maxlength="${L.title}" placeholder="${esc(kind.example)}" autocomplete="off">
        <p class="note">No internship is needed. A course project, lab work, a fest you ran, volunteering or a family business all work.</p>
        <div class="actions"><button id="dfStartProject">Start the project defence →</button></div></section></div>
      <p class="note bh-honest-box">Questions are chosen by simple rules from the words in your line: a figure, a verb such as “reduced”, a vague opener such as “helped”, team words, a named tool. They cannot check whether a claim is true or whether an answer is good.</p>
      ${past.length ? `<section class="panel df-past"><h2>Past defences</h2><ul class="df-past-list">${past.map(s => `<li><div><b>${esc(short(s.kind === 'project' ? s.title : s.line, 90))}</b><span class="note">${esc(day(s.finished))} · ${s.kind === 'project' ? 'project' : 'résumé line'} · ${s.answers.length} of ${plural(s.questions.length, 'question')} answered</span></div><div class="bh-row-actions"><button data-df-view="${esc(s.id)}">View</button><button data-df-delete="${esc(s.id)}" aria-label="Delete this defence">Delete</button></div></li>`).join('')}</ul>
        <div class="actions"><button id="dfClearPast">Delete all</button></div></section>` : ''}`;
    $('#dfStartLine').onclick = startLine;
    $('#dfStartProject').onclick = startProject;
    $('#dfKind').onchange = e => { $('#dfTitle').placeholder = D.kindOf(e.target.value).example; };
    if ($('#dfPick')) $('#dfPick').onchange = e => {
      const b = bullets[Number(e.target.value)]; if (!b) { picked = null; return; }
      picked = tidy(b.text, L.line); $('#dfLine').value = picked;
    };
    if ($('#dfResume')) $('#dfResume').onclick = renderQuestion;
    if ($('#dfDiscard')) $('#dfDiscard').onclick = () => { if (run.answers.length && !confirm('Discard this unfinished defence? Your answers will not be saved.')) return; run = null; since = null; persist(); renderHome(); };
    document.querySelectorAll('[data-df-view]').forEach(b => b.onclick = () => renderDebrief(b.dataset.dfView));
    document.querySelectorAll('[data-df-delete]').forEach(b => b.onclick = () => { if (!confirm('Delete this defence from your history?')) return; past = past.filter(s => s.id !== b.dataset.dfDelete); savePast(); renderHome(); });
    if ($('#dfClearPast')) $('#dfClearPast').onclick = () => { if (!confirm('Delete every saved defence from this browser? This cannot be undone.')) return; past = []; savePast(); renderHome(); };
  }
  /* The hint line is one element; it moves to the panel that needs it. */
  function hintIn(panel, msg, focus) { const h = $('#flowHint'), p = $(panel); if (h && p) p.appendChild(h); nudge(msg, focus); }
  function startLine() {
    const line = tidy($('#dfLine').value, L.line);
    if (D.words(line) < L.minLineWords) return hintIn('#dfPanelLine', `Type or paste a whole line from your résumé: at least ${L.minLineWords} words, such as “${short(STOCK, 60)}”.`, '#dfLine');
    begin({ kind: 'line', line, fromResume: picked != null && picked === line });
  }
  function startProject() {
    const title = tidy($('#dfTitle').value, L.title);
    if (!title) return hintIn('#dfPanelProject', 'Give the project a name or a short description first.', '#dfTitle');
    begin({ kind: 'project', title, projectKind: $('#dfKind').value });
  }
  /* A résumé line to defend straight away (from the résumé checker). A line too short to question opens the line box instead. */
  function openLine(text, source = {}) {
    const line = tidy(text, L.line);
    if (D.words(line) < L.minLineWords) { open('line'); $('#dfLine').value = line; return hintIn('#dfPanelLine', `That line has fewer than ${L.minLineWords} words. Add what you did and what came of it, then start.`, '#dfLine'); }
    begin({ kind: 'line', line, fromResume: !!(source && source.fromResume) });
  }
  function begin(o) {
    if (run && !confirm('Replace your unfinished defence? What you have answered so far will not be saved.')) return;
    const questions = o.kind === 'project' ? D.projectQuestions({ title: o.title, kind: o.projectKind }) : D.lineQuestions(o.line);
    since = null;
    run = cleanSession({ id: newId(), kind: o.kind, line: o.line, title: o.title, projectKind: o.projectKind, fromResume: o.fromResume, questions, index: 0, follow: null, answers: [], draft: '', heard: {}, rewrite: null, storySaved: false, started: Date.now() }, false);
    persist(); renderQuestion();
  }

  /* ---------- Interview conditions ---------- */
  function renderQuestion() {
    if (!run) return open();
    enter('question');
    const i = run.index, n = run.questions.length, follow = !!run.follow, p = prompt();
    $('#app').innerHTML = `<section class="flow-screen fit df-question"><div class="flow-head"><div><div class="eyebrow">${run.kind === 'project' ? 'PROJECT' : 'RÉSUMÉ'} DEFENCE · INTERVIEW CONDITIONS</div><h2 class="section-title">Question ${i + 1} of ${n}${follow ? ' · follow-up' : ''}</h2></div><button class="wu-link" id="dfExit">End the defence</button></div>
      <ol class="flow-progress" aria-hidden="true">${run.questions.map((_, k) => `<li class="${k < i ? 'done' : k === i ? 'now' : ''}"></li>`).join('')}</ol>
      <div class="interviewer flow-question"><div class="eyebrow">${follow ? 'THE INTERVIEWER FOLLOWS UP' : 'THE INTERVIEWER ASKS'}</div><p id="dfPrompt">${esc(p)}</p>${voiceControls()}</div>
      ${micRow('dfMic', 'dfVoiceStatus', '<span class="bh-clock"><span id="dfTimerText" class="bh-time" aria-live="off"></span></span>')}
      <label for="dfAnswer" class="flow-label">Your answer · appears here as you speak, or type</label>
      <div class="dictation-box"><textarea id="dfAnswer" maxlength="${L.answer}" placeholder="Your words appear here as you speak. You can also type or edit.">${esc(run.draft)}</textarea></div>
      <p class="note fit-note">Interview conditions: no skipping, retrying or help. Feedback comes at the end.</p>
      ${flowBar({ primary: '<button id="dfFinish" class="primary next">I have finished answering →</button>', hint: run.draft.trim() ? '' : 'Press the microphone to answer, or type. The clock starts when you do.' })}</section>`;
    bindSpeech(p); paint(); bindAnswer();
    $('#dfExit').onclick = endEarly;
    $('#dfFinish').onclick = finish;
    if (!run.spoken) { run.spoken = true; persist(); if (canSpeak()) speak(p); }
  }
  function bindAnswer() {
    const owner = run, area = $('#dfAnswer');
    area.oninput = () => { owner.draft = area.value.slice(0, L.answer); if (area.value.trim()) { startClock(); $('#flowHint').textContent = ''; } persist(); };
    attachDictation({ button: $('#dfMic'), target: area, status: $('#dfVoiceStatus'), language: dictationLang, isCurrent: () => run === owner,
      onStart: () => { owner.voice = true; startClock(); $('#flowHint').textContent = ''; persist(); },
      onText: v => { owner.draft = v.slice(0, L.answer); owner.voice = true; persist(); } });
  }
  /* Saves the answer, then asks the follow-up if the rules give one (never a follow-up to a follow-up), the next question, or ends. */
  function finish() {
    if (!run) return;
    const text = run.draft.trim();
    if (!text) return nudge('Say or type something first. If you cannot remember, say so and explain what you would check.', '#dfAnswer');
    bank(); stopMedia();
    const t = took();
    if (run.follow) { const a = run.answers[run.index]; a.follow = run.follow; a.reply = text; a.replySeconds = t; run.follow = null; }
    else {
      const q = run.questions[run.index];
      run.answers.push({ id: q.id, text, seconds: t, voice: run.voice, follow: null, reply: '', replySeconds: null });
      const f = D.followUp(q, text);
      if (f) { run.follow = { id: f.id, text: f.text, why: f.why }; return nextPrompt(); }
    }
    run.index++;
    if (run.index >= run.questions.length) return endDefence();
    nextPrompt();
  }
  function nextPrompt() { run.draft = ''; run.voice = false; run.spoken = false; run.elapsedMs = 0; since = null; persist(); renderQuestion(); }
  /* Leaving early keeps what was answered and goes to the debrief; the answer in progress is not saved. */
  function endEarly() {
    const any = run.answers.length > 0;
    if (!confirm(any ? 'End the defence now? The answer you are giving is not saved. You go straight to the debrief on what you have answered.' : 'End the defence now? Nothing has been answered, so nothing will be saved.')) return;
    stopMedia();
    if (any) return endDefence();
    run = null; since = null; persist(); open();
  }
  /* Moves the session into the past list; from here edits go to the stored copy. */
  function endDefence() {
    since = null;
    const s = toPast(run); past.unshift(s); past = past.slice(0, MAX_PAST); savePast();
    run = null; persist(); renderDebrief(s.id);
  }

  /* ---------- Debrief ---------- */
  const mark = status => status === 'pass' ? '<span class="rc-mark ok" aria-label="Pass">✓</span>' : status === 'info' ? '<span class="rc-mark info" aria-label="Suggestion">i</span>' : '<span class="rc-mark warn" aria-label="Look at this">!</span>';
  const checksHtml = text => !text.trim() ? '' : RC.lintBullet(text).checks.map(c => `<li class="${c.status}">${mark(c.status)}<div><b>${esc(c.label)}</b> ${esc(c.reason)}${c.status === 'warn' && c.fix ? `<span class="rc-fix">Try: ${esc(c.fix)}</span>` : ''}</div></li>`).join('');
  const noteOf = (words, s) => `${plural(words, 'word')} · ${secs(s)}`;
  const subject = s => s.kind === 'project' ? s.title : s.line;
  function storyButtons(s) {
    return `<button id="dfStory">${s.storySaved ? 'Saved · update it' : 'Save as a story'}</button>${s.storySaved ? '<button class="wu-link" id="dfOpenStories">Open story bank</button>' : ''}`;
  }
  function renderDebrief(id) {
    const s = past.find(x => x.id === id); if (!s) return renderHome();
    enter('debrief'); viewing = s.id;
    const n = s.questions.length, line = s.kind === 'line';
    const item = (q, i) => {
      const a = s.answers[i], ticked = s.heard[i] || [];
      if (!a) return `<li><h3>${esc(q.text)}</h3><p class="note">Not asked.</p></li>`;
      return `<li><h3>${esc(q.text)}</h3><p class="note">Why it was asked: ${esc(q.why)}</p>
        <details class="df-answer"><summary>Your answer · ${noteOf(D.words(a.text), a.seconds)}${a.voice ? ' · dictated' : ''}</summary><p class="transcript">${esc(a.text)}</p></details>
        ${a.follow ? `<div class="bh-asked"><p><b>Follow-up:</b> “${esc(a.follow.text)}”</p><p class="note">Why it was asked: ${esc(a.follow.why)}</p><details class="df-answer"><summary>Your reply · ${noteOf(D.words(a.reply), a.replySeconds)}</summary><p class="transcript">${esc(a.reply)}</p></details></div>` : ''}
        ${q.listenFor.length ? `<fieldset class="bh-heard df-heard"><legend>Did your answer cover these? Tick only what you clearly said.</legend>${q.listenFor.map((x, k) => `<label class="selfcheck"><input type="checkbox" data-df-heard="${i}-${k}" ${ticked.includes(k) ? 'checked' : ''}> ${esc(x)}</label>`).join('')}</fieldset>` : ''}</li>`;
    };
    $('#app').innerHTML = `<section class="flow-screen df-debrief"><div class="eyebrow">${line ? 'RÉSUMÉ' : 'PROJECT'} DEFENCE · DEFENCE OVER</div><h1 class="bh-title">You answered ${s.answers.length} of ${plural(n, 'question')}.</h1>
      <p class="df-quote" id="dfQuote">${line ? `“${esc(s.line)}”` : `<b>Project:</b> ${esc(s.title)} <span class="note">· ${esc(D.kindOf(s.projectKind).label)}</span>`}</p>
      <p class="bh-honest-box">The questions were chosen by simple rules from the words in your ${line ? 'line' : 'project title'}, and each follow-up from the length of your answer, “I” against “we”, and whether a number was heard. They are not a judgement of you, and nothing here can check whether a claim is true or an answer is good. The ticks are your own call.</p>
      <ol class="bh-debrief">${s.questions.map(item).join('')}</ol>
      ${line ? `<section class="panel df-rewrite" id="dfRewritePanel"><h2>Rewrite the line</h2><p class="note">Your line: “<span id="dfOrig">${esc(s.line)}</span>”</p>
        <ul class="df-hints" id="dfHints"></ul>
        <label for="dfRewrite" class="flow-label">Your new line</label><textarea id="dfRewrite" rows="3" maxlength="${L.line}">${esc(s.rewrite || s.line)}</textarea>
        <ul class="rc-checks df-checks" id="dfChecks" aria-live="polite"></ul>
        <p class="note">These checks are the résumé checker’s heuristics: word lists and patterns, not a score. Keep only what is true and what you could defend if asked again.</p>
        <div class="actions"><button id="dfCopy">Copy the new line</button><span id="dfPutBackSlot"></span></div></section>` : ''}
      <section class="panel df-story"><h2>Keep it as a story</h2><p class="note">This copies your answers into your HR story bank in this browser, so you can practise telling it later. Saving again updates the same story.</p><div class="actions" id="dfStoryActions"></div></section>
      ${flowBar({ back: '<button class="wu-link" id="dfBack">Back to defence home</button><button class="wu-link" id="dfDownload">Download (.txt)</button>', primary: '<button class="primary" id="dfAgain">Defend another →</button>' })}</section>`;
    document.querySelectorAll('[data-df-heard]').forEach(el => el.onchange = () => {
      const [i, k] = el.dataset.dfHeard.split('-').map(Number), cur = s.heard[i] || [], next = el.checked ? [...new Set([...cur, k])].sort((a, b) => a - b) : cur.filter(x => x !== k);
      if (next.length) s.heard[i] = next; else delete s.heard[i];
      savePast();
    });
    if (line) bindRewrite(s);
    const paintStory = () => { $('#dfStoryActions').innerHTML = storyButtons(s); bindStory(s, paintStory); };
    paintStory();
    $('#dfBack').onclick = () => open();
    $('#dfDownload').onclick = () => download(defenceText(s), `case-room-defence-${new Date(s.finished).toISOString().slice(0, 10)}.txt`);
    $('#dfAgain').onclick = () => open(s.kind);
  }
  function bindRewrite(s) {
    const area = $('#dfRewrite');
    const paintChecks = () => { $('#dfChecks').innerHTML = checksHtml(area.value); };
    const paintLine = () => { $('#dfOrig').textContent = s.line; $('#dfQuote').innerHTML = `“${esc(s.line)}”`; $('#dfHints').innerHTML = D.rewriteHints(s.line).map(h => `<li>${esc(h)}</li>`).join(''); };
    const paintPutBack = () => {
      $('#dfPutBackSlot').innerHTML = ResumeTool.hasBullet(s.line) ? '<button id="dfPutBack">Put it back in my résumé</button>' : '';
      if ($('#dfPutBack')) $('#dfPutBack').onclick = () => {
        const text = tidy(area.value, L.line);
        if (!text) return toast('Write the new line first.');
        if (!ResumeTool.replaceBullet(s.line, text)) { paintPutBack(); return toast('That line is no longer in the résumé you checked.'); }
        s.line = text; s.rewrite = text; s.putBack = true; savePast(); paintLine(); paintPutBack();
        toast('Put the new line back in your résumé. The résumé checker has re-checked it.');
      };
    };
    paintLine(); paintChecks(); paintPutBack();
    area.oninput = () => { s.rewrite = area.value.trim() ? area.value.slice(0, L.line) : null; savePast(); paintChecks(); };
    $('#dfCopy').onclick = () => {
      const text = tidy(area.value, L.line);
      const fallback = () => { modal(`<h2>Copy your new line</h2><p class="note">Select all the text below and copy it.</p><textarea id="dfCopyText" rows="5" readonly>${esc(text)}</textarea>`); const t = $('#dfCopyText'); t.focus(); t.select(); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('Copied the new line.'), fallback); else fallback();
    };
  }
  function bindStory(s, repaint) {
    $('#dfStory').onclick = () => {
      const story = { id: 'df' + s.id, ...D.toStory({ kind: s.kind, line: s.line, title: s.title, answers: s.answers }) };
      let r; try { r = Behavioural.importStories(JSON.stringify([story])); } catch (e) { return toast(e.message); }
      if (!r.added && !r.updated) return toast('Your story bank is full. Delete a story there to make room, then save again.');
      s.storySaved = true; savePast(); repaint();
      toast('Saved to your story bank. Tag the competencies it covers there.');
      $('#dfStory').focus({ preventScroll: true });
    };
    if ($('#dfOpenStories')) $('#dfOpenStories').onclick = () => Behavioural.stories();
  }
  function defenceText(s) {
    const line = s.kind === 'line', rule = '='.repeat(60);
    const qs = s.questions.map((q, i) => {
      const a = s.answers[i];
      if (!a) return `QUESTION ${i + 1}\n${q.text}\nNot asked.`;
      const ticked = s.heard[i] || [];
      return `QUESTION ${i + 1}\n${q.text}\nWhy it was asked: ${q.why}\n\nYOUR ANSWER (${noteOf(D.words(a.text), a.seconds)})\n${a.text}\n` +
        (a.follow ? `\nFOLLOW-UP\n${a.follow.text}\nWhy it was asked: ${a.follow.why}\n\nYOUR REPLY (${noteOf(D.words(a.reply), a.replySeconds)})\n${a.reply}\n` : '') +
        `\nDID YOUR ANSWER COVER THESE? (your own ticks)\n${q.listenFor.map((x, k) => `[${ticked.includes(k) ? 'x' : ' '}] ${x}`).join('\n')}`;
    }).join(`\n\n${rule}\n\n`);
    return `CASE ROOM — ${line ? 'RÉSUMÉ' : 'PROJECT'} DEFENCE\n${new Date(s.finished).toLocaleString()} · interview conditions\n\n${line ? 'LINE' : `PROJECT (${D.kindOf(s.projectKind).label})`}\n${subject(s)}\n\n` +
      `Questions were chosen by simple rules from the words in the ${line ? 'line' : 'title'}. They cannot check whether a claim is true or an answer is good.\n\n${rule}\n\n${qs}` +
      (line ? `\n\n${rule}\n\nREWRITTEN LINE\n${s.rewrite && s.rewrite !== s.line ? s.rewrite : s.putBack ? 'The line above is your rewritten line. You put it back into your résumé.' : 'Not rewritten yet.'}` : '') + '\n';
  }

  /* ---------- Integration with the rest of Case Room ---------- */
  const priorHome = home;
  home = function () { bank(); priorHome(); if (location.hash === '#defence') setHash(''); };

  window.DefenceTool = { open, openLine, resume: renderQuestion, state: () => ({ run, past, screen, viewing }) };
})();
