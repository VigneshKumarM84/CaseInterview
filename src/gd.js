/* Group discussion kit: three to six people discuss a brief with evidence that pulls both ways. One device keeps time.
   One person can sit out as the observer and tap what each speaker does; the debrief counts those taps and quotes the
   observer's notes. The app does not listen and does not judge: it counts what was tapped and says so.
   The rules are in src/gd-logic.js (GDLogic) and the briefs in content/gd.js (GD_CONTENT). This file is the screens.
   Uses core.js helpers and flowBar()/nudge()/stopMedia() and the globals view/home from cases.js.
   Stores two things in this browser: cr-gd-run (the discussion in progress, including its debrief until you leave it)
   and cr-gd-past (the last 10 finished discussions). Nothing leaves the browser. */
(() => {
  const L = GDLogic, { MOVES, TIMINGS, GROUP, BRIEFS } = GD_CONTENT;
  const RUN_KEY = 'cr-gd-run', PAST_KEY = 'cr-gd-past', MAX_PAST = 10;
  const GOOD = MOVES.filter(m => m.kind === 'good'), WATCH = MOVES.filter(m => m.kind === 'watch');
  const SIGNALS = { halfway: 'Halfway.', oneMinute: 'One minute left. Someone should start pulling it together.', timeUp: 'Time is up.' };
  const PHASE_WORDS = { prepare: 'Reading the brief', discuss: 'Discussing', summary: 'Summing up', debrief: 'Debrief' };
  const briefOf = L.briefOf, typeWord = b => b.type === 'decision' ? 'Decision' : 'Opinion';
  const mins = s => `${s / 60} minutes`;
  const day = t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const copy = o => JSON.parse(JSON.stringify(o));

  /* ---------- Storage: every field is checked on every load ---------- */
  const cleanPast = v => { const s = L.cleanSession(v); return s && s.phase === 'debrief' ? { ...s, finished: s.finished == null ? s.started : s.finished } : null; };
  let past = (() => { const v = read(PAST_KEY, []); return (Array.isArray(v) ? v : []).map(cleanPast).filter((s, i, all) => s && all.findIndex(x => x && x.id === s.id) === i).slice(0, MAX_PAST); })();
  let run = L.cleanSession(read(RUN_KEY, null));
  let screen = 'home', viewing = null, missed = false;
  let setup = { briefId: null, names: ['', '', ''], observer: false, observerAt: 0, discuss: TIMINGS.defaultDiscuss };

  const savePast = () => save(PAST_KEY, past);
  function upsertPast(s) { past = [copy(s), ...past.filter(x => x.id !== s.id)].slice(0, MAX_PAST); savePast(); }
  /* The session in progress, saved on every change. Once it reaches the debrief a copy also goes to the past list. */
  function persist() { save(RUN_KEY, run); if (run && run.phase === 'debrief') upsertPast(run); }
  function clearRun() { run = null; save(RUN_KEY, null); }
  /* Moves the run on to where the clock says it should be. True when the discussion ran out in the meantime. */
  function sync() {
    if (!run || run.phase === 'debrief') return false;
    const r = L.advance(run, Date.now());
    if (r.session !== run) { run = r.session; persist(); }
    if (r.lapsed && !(view === 'gd' && screen === 'discuss')) missed = true;
    return r.lapsed;
  }

  function setHash(h) { try { window.history.replaceState(null, '', location.pathname + location.search + h); } catch { /* file:// or sandboxed frames */ } }
  function enter(name, hash = '#gd') { stopMedia(); view = 'gd'; screen = name; setHash(hash); window.scrollTo(0, 0); }

  /* ---------- Clock ---------- */
  const signalText = sg => sg.timeUp ? SIGNALS.timeUp : sg.oneMinute ? SIGNALS.oneMinute : sg.halfway ? SIGNALS.halfway : '';
  function paintClock() {
    if (!run || !$('#gdTime')) return;
    const now = Date.now();
    $('#gdTime').textContent = L.clock(L.remaining(run, now));
    if (run.phase === 'discuss' && $('#gdSignal')) { const t = signalText(L.signals(run, now)) || IDLE; if ($('#gdSignal').textContent !== t) $('#gdSignal').textContent = t; }
  }
  const IDLE = 'The clock runs by itself. You will be told at halfway, at one minute left and at time up.';
  /* Four times a second. Moves to the next phase when a timed one runs out; leaving the tool never stops the real clock. */
  function tick() {
    if (view !== 'gd' || !run || !['prepare', 'discuss', 'summary'].includes(screen)) return;
    const was = run.phase, lapsed = sync();
    if (run.phase !== was) { missed = false; return lapsed ? renderSummary('Time is up.') : renderPhase(); }
    paintClock();
  }
  setInterval(tick, 250);

  /* ---------- Home ---------- */
  function open() { enter('home'); renderHome(); }
  function resume() {
    if (!run) return open();
    const lapsed = sync(), note = lapsed || missed ? 'The discussion time ran out while this page was closed, so you are at the summary.' : '';
    missed = false; renderPhase(note);
  }
  function renderPhase(note = '') {
    if (!run) return open();
    if (run.phase === 'prepare') return renderPrepare();
    if (run.phase === 'discuss') return renderDiscuss();
    if (run.phase === 'summary') return renderSummary(note);
    renderDebrief(run);
  }
  function renderHome() {
    if (run && run.phase === 'debrief') clearRun();
    viewing = null;
    const resumePanel = run ? `<section class="panel bh-resume gd-resume"><div><b>Unfinished discussion: ${esc(briefOf(run.briefId).title)}</b><p class="note">${esc(PHASE_WORDS[run.phase])} · ${esc(run.names.join(', '))}${run.observer ? ' · with an observer' : ''}</p></div>
      <div class="actions"><button class="primary" id="gdResume">Go back to it →</button><button id="gdDiscard">Discard it</button></div></section>` : '';
    $('#app').innerHTML = `<section class="gd-head"><div class="eyebrow">GROUP DISCUSSION</div><h1 class="gd-title">Run a group discussion</h1>
      <p class="lead">Three to six of you, one phone or laptop as the clock, about 12 minutes. One of you can sit out as the observer and note who does what. There is no AI: the app keeps time and counts what the observer taps. It does not listen to the discussion.</p></section>${resumePanel}
      <section class="panel gd-briefs-panel"><h2>Choose a brief</h2><p class="note">Each brief has evidence that pulls in different directions, so there is no single right answer. What a fair conclusion weighs stays hidden until the debrief.</p>
        <ul class="gd-briefs">${BRIEFS.map(b => `<li><div><b>${esc(b.title)}</b><span class="note">${esc(b.setting)} · ${typeWord(b)}</span></div><div class="gd-brief-actions"><button data-gd-pick="${esc(b.id)}" class="${setup.briefId === b.id ? 'chosen' : ''}">Run this</button><button class="wu-link" data-gd-sheet="${esc(b.id)}">Print the kit</button></div></li>`).join('')}</ul></section>
      <div id="gdSetup">${setupHtml()}</div>
      ${past.length ? `<section class="panel gd-past"><h2>Past discussions</h2><ul class="gd-past-list">${past.map(s => `<li><div><b>${esc(briefOf(s.briefId).title)}</b><span class="note">${esc(day(s.finished))} · ${mins(s.discussSeconds)} · ${esc(s.names.join(', '))}${s.observer ? '' : ' · no observer'}</span></div><div class="gd-row-actions"><button data-gd-view="${esc(s.id)}">View</button><button data-gd-delete="${esc(s.id)}">Delete</button></div></li>`).join('')}</ul></section>` : ''}
      <p class="note gd-alone">Practising alone? <button class="wu-link" id="gdAlone">See the moves observers note</button></p>`;
    document.querySelectorAll('[data-gd-pick]').forEach(b => b.onclick = () => choose(b.dataset.gdPick));
    document.querySelectorAll('[data-gd-sheet]').forEach(b => b.onclick = () => sheet(b.dataset.gdSheet));
    document.querySelectorAll('[data-gd-view]').forEach(b => b.onclick = () => { const s = past.find(x => x.id === b.dataset.gdView); if (s) renderDebrief(s); });
    document.querySelectorAll('[data-gd-delete]').forEach(b => b.onclick = () => { if (!confirm('Delete this discussion from your history?')) return; past = past.filter(x => x.id !== b.dataset.gdDelete); savePast(); renderHome(); });
    if ($('#gdResume')) $('#gdResume').onclick = resume;
    if ($('#gdDiscard')) $('#gdDiscard').onclick = () => { if (!confirm('Discard this discussion? What the observer noted will not be saved.')) return; clearRun(); renderHome(); };
    $('#gdAlone').onclick = () => NextRoundTool.open('gd');
    bindSetup();
  }

  /* ---------- Set-up ---------- */
  function choose(id) {
    setup.briefId = id; $('#gdSetup').innerHTML = setupHtml(); bindSetup();
    document.querySelectorAll('[data-gd-pick]').forEach(b => b.classList.toggle('chosen', b.dataset.gdPick === id));
    $('#gdSetup').scrollIntoView({ block: 'start' }); const first = $('#gdName0'); if (first) first.focus({ preventScroll: true });
  }
  const obsOptions = () => setup.names.map((n, i) => `<option value="${i}" ${setup.observerAt === i ? 'selected' : ''}>${esc(n.trim() || `Name ${i + 1}`)}</option>`).join('');
  function setupHtml() {
    const b = briefOf(setup.briefId); if (!b) return '';
    return `<section class="panel gd-setup" aria-labelledby="gdSetupTitle"><h2 id="gdSetupTitle">Set up: ${esc(b.title)}</h2>
      <fieldset class="gd-names"><legend>Who is here? ${GROUP.min} to ${GROUP.max} names</legend>
        ${setup.names.map((n, i) => `<div class="gd-name-row"><input id="gdName${i}" data-gd-name="${i}" aria-label="Name ${i + 1}" maxlength="${L.LIMITS.name}" autocomplete="off" placeholder="Name ${i + 1}" value="${esc(n)}">${setup.names.length > GROUP.min ? `<button type="button" class="gd-remove" data-gd-remove="${i}" aria-label="Remove name ${i + 1}">×</button>` : ''}</div>`).join('')}
        ${setup.names.length < GROUP.max ? '<button type="button" id="gdAddName">Add a name</button>' : ''}</fieldset>
      <label class="gd-check"><input type="checkbox" id="gdObs" ${setup.observer ? 'checked' : ''}> One of us is observing</label>
      <div id="gdObsPick" ${setup.observer ? '' : 'hidden'}><label for="gdObsWho">Who is observing?</label><select id="gdObsWho">${obsOptions()}</select>
        <p class="note">The observer does not speak and is not counted. They tap what each speaker does, so with an observer you need at least ${GROUP.min + 1} names.</p></div>
      <label for="gdLen">Discussion length</label><select id="gdLen">${TIMINGS.discuss.map(s => `<option value="${s}" ${setup.discuss === s ? 'selected' : ''}>${mins(s)}</option>`).join('')}</select>
      <p class="note">First a 90-second silent read, then the discussion, then one minute for someone to sum up.</p>
      ${flowBar({ primary: '<button class="primary" id="gdStart">Start: show the brief →</button>' })}</section>`;
  }
  function bindSetup() {
    if (!$('#gdStart')) return;
    document.querySelectorAll('[data-gd-name]').forEach(el => el.oninput = () => { setup.names[Number(el.dataset.gdName)] = el.value; if ($('#gdObsWho')) $('#gdObsWho').innerHTML = obsOptions(); });
    document.querySelectorAll('[data-gd-remove]').forEach(b => b.onclick = () => {
      const i = Number(b.dataset.gdRemove); setup.names.splice(i, 1);
      setup.observerAt = setup.observerAt === i ? 0 : setup.observerAt > i ? setup.observerAt - 1 : setup.observerAt;
      $('#gdSetup').innerHTML = setupHtml(); bindSetup(); const f = $('#gdName' + Math.min(i, setup.names.length - 1)); if (f) f.focus();
    });
    if ($('#gdAddName')) $('#gdAddName').onclick = () => { setup.names.push(''); $('#gdSetup').innerHTML = setupHtml(); bindSetup(); $('#gdName' + (setup.names.length - 1)).focus(); };
    $('#gdObs').onchange = e => { setup.observer = e.target.checked; $('#gdObsPick').hidden = !setup.observer; };
    $('#gdObsWho').onchange = e => { setup.observerAt = Number(e.target.value); };
    $('#gdLen').onchange = e => { setup.discuss = Number(e.target.value); };
    $('#gdStart').onclick = startRun;
  }
  function startRun() {
    const chk = L.checkSetup(setup.names, { observer: setup.observer, observerAt: setup.observerAt });
    if (!chk.ok) return nudge(chk.error, '#gdName0');
    if (run && run.phase !== 'debrief' && !confirm('Replace your unfinished discussion? What the observer noted will not be saved.')) return;
    run = L.newSession({ briefId: setup.briefId, names: chk.names, observer: setup.observer, observerName: chk.observerName, discussSeconds: setup.discuss });
    if (!run) return nudge('Those names could not be used. Check them and try again.', '#gdName0');
    missed = false; persist(); renderPrepare();
  }

  /* ---------- Shared pieces ---------- */
  const evidenceCards = (b, open) => b.evidence.map(e => open ? `<li class="gd-card"><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></li>` : `<details class="gd-card"><summary>${esc(e.title)}</summary><p>${esc(e.text)}</p></details>`).join('');
  const quit = `<button class="wu-link" id="gdQuit">Quit this discussion</button>`;
  function bindQuit() { $('#gdQuit').onclick = () => { if (!confirm('Quit this discussion? What the observer noted will not be saved.')) return; clearRun(); open(); }; }

  /* ---------- 1. Prepare: everyone reads the brief in silence ---------- */
  function renderPrepare() {
    enter('prepare'); const b = briefOf(run.briefId);
    $('#app').innerHTML = `<section class="flow-screen gd-screen"><div class="flow-head"><div><div class="eyebrow">GROUP DISCUSSION · READ IN SILENCE</div><h2 class="section-title">${esc(b.title)}</h2><span class="subtle">${esc(b.setting)} · ${typeWord(b)}</span></div>${quit}</div>
      <div class="gd-clockbar"><div class="gd-clock" id="gdTime" aria-hidden="true">${L.clock(L.remaining(run, Date.now()))}</div><p class="note">to read before the discussion starts by itself. Nobody speaks yet.</p></div>
      <p class="brief gd-brief">${esc(b.brief)}</p>
      <div class="panel gd-task"><div class="eyebrow">YOUR TASK</div><p>${esc(b.task)}</p></div>
      <h3 class="gd-h">The evidence</h3><ul class="gd-cards">${evidenceCards(b, true)}</ul>
      <p class="note">${run.observer ? `${esc(run.observerName || 'The observer')} is observing and will tap what each speaker does. This app counts those taps; it does not hear the discussion.` : 'No one is observing, so nothing will be noted. The app only keeps time.'}</p>
      ${flowBar({ primary: '<button class="primary" id="gdBegin">Start the discussion →</button>' })}</section>`;
    bindQuit();
    $('#gdBegin').onclick = () => { run.phase = 'discuss'; run.phaseStarted = Date.now(); persist(); renderDiscuss(); };
  }

  /* ---------- 2. Discuss: the clock, the task, and the observer's taps ---------- */
  function renderDiscuss() {
    enter('discuss'); const b = briefOf(run.briefId), now = Date.now();
    $('#app').innerHTML = `<section class="flow-screen gd-screen"><div class="flow-head"><div><div class="eyebrow">GROUP DISCUSSION · DISCUSSING</div><h2 class="section-title">${esc(b.title)}</h2></div>${quit}</div>
      <div class="gd-clockbar"><div class="gd-clock" id="gdTime" aria-hidden="true">${L.clock(L.remaining(run, now))}</div><p class="gd-signal" id="gdSignal" role="status">${esc(signalText(L.signals(run, now)) || IDLE)}</p></div>
      <div class="panel gd-task"><div class="eyebrow">THE TASK</div><p>${esc(b.task)}</p></div>
      <section class="gd-evidence" aria-label="Evidence"><h3 class="gd-h">The evidence <span class="note">(open a card to read it again)</span></h3>${evidenceCards(b, false)}</section>
      ${run.observer ? tapHtml() : '<p class="note gd-silent">Nothing is being noted. There is no observer, so the app only keeps time.</p>'}
      ${flowBar({ primary: '<button class="primary" id="gdEnd">End discussion, go to the summary →</button>' })}</section>`;
    bindQuit();
    $('#gdEnd').onclick = endDiscussion;
    if (run.observer) bindTaps();
  }
  function endDiscussion() { run.discussEnded = L.timeOf(run, Date.now()); run.phase = 'summary'; run.phaseStarted = Date.now(); persist(); renderSummary(); }

  /* The observer's grid: one row per speaker, a button per move, good moves first and watch moves apart. */
  function lastLine() {
    const e = run.log[run.log.length - 1];
    return e ? `Last tap: ${run.names[e.who]} · ${L.moveOf(e.move).label} at ${L.clock(e.t)}` : 'No taps yet.';
  }
  function tapHtml() {
    return `<section class="panel gd-tap" aria-labelledby="gdTapTitle"><h3 id="gdTapTitle">What ${esc(run.observerName || 'the observer')} is noting</h3>
      <p class="note">Tap a move when you see it. Each tap is counted at the time you tap it. Tap what you saw, not what you think of the person.</p>
      <div class="gd-last"><span id="gdLast">${esc(lastLine())}</span><button type="button" class="wu-link" id="gdUndo" ${run.log.length ? '' : 'disabled'}>Undo</button></div>
      <label for="gdNote" class="gd-notelabel">A few words on the last tap (optional)</label>
      <input id="gdNote" maxlength="${L.LIMITS.note}" autocomplete="off" placeholder="What did they say? A few words" ${run.log.length ? '' : 'disabled'} value="${esc(run.log.length ? run.log[run.log.length - 1].note : '')}">
      <div id="gdGrid">${gridHtml()}</div>
      <details class="gd-means"><summary>What each move means</summary><ul>${MOVES.map(m => `<li><b>${esc(m.label)}</b>: ${esc(m.hint)}</li>`).join('')}</ul></details></section>`;
  }
  function gridHtml() {
    const rows = L.tally(run), btn = (r, m) => `<button type="button" class="gd-move ${m.kind}" data-who="${r.who}" data-move="${m.id}" title="${esc(m.hint)}" aria-label="${esc(`${r.name}: ${m.label}. Noted ${r.counts[m.id]} times.`)}"><span>${esc(m.label)}</span><b class="gd-n">${r.counts[m.id]}</b></button>`;
    return rows.map(r => `<div class="gd-speaker" role="group" aria-label="${esc(r.name)}"><h4>${esc(r.name)}</h4><div class="gd-moves">${GOOD.map(m => btn(r, m)).join('')}</div><div class="gd-moves gd-watch"><span class="gd-watch-label">Watch for</span>${WATCH.map(m => btn(r, m)).join('')}</div></div>`).join('');
  }
  function paintTaps(focus) {
    $('#gdGrid').innerHTML = gridHtml(); bindGrid();
    $('#gdLast').textContent = lastLine(); $('#gdUndo').disabled = !run.log.length;
    const n = $('#gdNote'); n.disabled = !run.log.length; n.value = run.log.length ? run.log[run.log.length - 1].note : '';
    if (focus) { const b = document.querySelector(`#gdGrid [data-who="${focus.who}"][data-move="${focus.move}"]`); if (b) b.focus({ preventScroll: true }); }
  }
  function bindGrid() {
    document.querySelectorAll('#gdGrid .gd-move').forEach(b => b.onclick = () => {
      const who = Number(b.dataset.who), move = b.dataset.move;
      if (!L.logMove(run, who, move, L.timeOf(run, Date.now()))) return toast(`The log is full (${L.LIMITS.log} taps). Undo a tap or end the discussion.`);
      persist(); paintTaps({ who, move });
    });
  }
  function bindTaps() {
    bindGrid();
    $('#gdUndo').onclick = () => { L.undoMove(run); persist(); paintTaps(); };
    $('#gdNote').oninput = e => { if (L.noteLast(run, e.target.value)) persist(); };
  }

  /* ---------- 3. Summary: one person sums up in a minute ---------- */
  function summaryTap() {
    if (!run.observer || run.summariser == null) return '';
    const done = run.log.some(e => e.who === run.summariser && e.move === 'summarise' && e.t >= (run.discussEnded || 0));
    return `<div class="actions"><button type="button" id="gdSummarised" ${done ? 'disabled' : ''}>${done ? `Noted for ${esc(run.names[run.summariser])}` : 'They summarised fairly'}</button></div>`;
  }
  function renderSummary(note = '') {
    enter('summary'); const b = briefOf(run.briefId), suggest = run.observer && run.log.length ? L.quietest(run) : null;
    if (run.summariser == null && suggest != null) { run.summariser = suggest; persist(); }
    $('#app').innerHTML = `<section class="flow-screen gd-screen"><div class="flow-head"><div><div class="eyebrow">GROUP DISCUSSION · SUMMARY</div><h2 class="section-title">One minute to sum up</h2></div>${quit}</div>
      <p class="gd-signal" id="gdLapsed" role="status">${esc(note)}</p>
      <div class="gd-clockbar"><div class="gd-clock" id="gdTime" aria-hidden="true">${L.clock(L.remaining(run, Date.now()))}</div><p class="note">for one person to sum up. The clock does not move you on: finish when you are ready.</p></div>
      <div class="panel gd-who"><h3>Who sums up?</h3>${suggest != null ? `<p id="gdSuggest"><b>${esc(run.names[suggest])} has said least so far: ask them to sum up.</b></p>` : '<p class="note">Choose someone who has not summed up before.</p>'}
        <label for="gdSummariser">The one summing up</label><select id="gdSummariser"><option value="">Not chosen</option>${run.names.map((n, i) => `<option value="${i}" ${run.summariser === i ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><div id="gdSummaryTap">${summaryTap()}</div></div>
      <div class="interviewer gd-closing"><div class="eyebrow">THE SUMMARY</div><p>${esc(b.closing)}</p></div>
      ${flowBar({ primary: '<button class="primary" id="gdFinish">Finish: see the debrief →</button>' })}</section>`;
    bindQuit();
    $('#gdSummariser').onchange = e => { run.summariser = e.target.value === '' ? null : Number(e.target.value); persist(); $('#gdSummaryTap').innerHTML = summaryTap(); bindSummaryTap(); };
    bindSummaryTap();
    $('#gdFinish').onclick = () => { run.phase = 'debrief'; run.phaseStarted = null; run.finished = Date.now(); persist(); renderDebrief(run); };
  }
  function bindSummaryTap() {
    const b = $('#gdSummarised'); if (!b) return;
    b.onclick = () => { if (!L.logMove(run, run.summariser, 'summarise', L.timeOf(run, Date.now()))) return toast('That could not be noted.'); persist(); $('#gdSummaryTap').innerHTML = summaryTap(); };
  }

  /* ---------- 4. Debrief ---------- */
  function renderDebrief(s) {
    enter('debrief'); viewing = s.id; const b = briefOf(s.briefId), live = s === run, rows = L.tally(s), notes = L.groupNotes(s);
    const commit = () => { if (live) persist(); else savePast(); };
    const table = `<div class="gd-table-wrap" tabindex="0" role="region" aria-label="Moves by speaker, scrolls sideways"><table class="gd-table"><thead><tr><th scope="col">Speaker</th>${MOVES.map(m => `<th scope="col" class="${m.kind}">${esc(m.label)}</th>`).join('')}<th scope="col">Good</th><th scope="col">Watch</th></tr></thead><tbody>${rows.map(r => `<tr><th scope="row">${esc(r.name)}</th>${MOVES.map(m => `<td>${r.counts[m.id]}</td>`).join('')}<td>${r.good}</td><td>${r.watch}</td></tr>`).join('')}</tbody></table></div>`;
    const card = (r, i) => `<article class="panel gd-person"><h3>${esc(r.name)}</h3>${s.observer ? `<ul class="gd-feedback">${L.feedbackFor(s, i).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="note">No one was observing, so nothing was noted for this speaker.</p>'}
      <label for="gdKeep${i}">One thing to keep</label><textarea id="gdKeep${i}" data-gd-keep="${i}" rows="2" maxlength="${L.LIMITS.text}">${esc(s.keep[i] || '')}</textarea>
      <label for="gdChange${i}">One thing to change</label><textarea id="gdChange${i}" data-gd-change="${i}" rows="2" maxlength="${L.LIMITS.text}">${esc(s.change[i] || '')}</textarea>
      ${s.observer ? `<div class="actions"><button type="button" data-gd-person="${i}">Download ${esc(r.name)}’s feedback (.txt)</button></div>` : ''}</article>`;
    const list = (title, items, id) => `<section class="panel gd-reveal" id="${id}"><h2>${title}</h2><ul>${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
    $('#app').innerHTML = `<section class="flow-screen gd-debrief"><div class="eyebrow">GROUP DISCUSSION · DEBRIEF</div><h1 class="gd-title">${esc(b.title)}</h1>
      <p class="subtle">${esc(b.setting)} · ${esc(day(s.finished == null ? s.started : s.finished))} · ${mins(s.discussSeconds)} · ${esc(s.names.join(', '))}${s.observer ? ` · observer: ${esc(s.observerName || 'not named')}` : ' · no observer'}</p>
      <p class="bh-honest-box gd-honest" id="gdHonest">${s.observer ? 'These are counts of what the observer tapped, not a judgement of anyone. An observer can miss things, and this app does not hear the discussion.' : 'No one was observing, so nothing was counted. The app only kept time. Use the boxes below to talk through what went well and what to change.'}</p>
      ${s.observer ? `<section class="panel gd-group" id="gdGroup"><h2>The group</h2>${notes.length ? `<ul>${notes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="note">${s.log.length} moves were logged. That is too few to say anything about the group.</p>`}</section>
        <section class="gd-counts"><h2 class="gd-h">Moves by speaker</h2>${table}</section>` : ''}
      <h2 class="gd-h">Each speaker</h2><div class="gd-people">${rows.map(card).join('')}</div>
      ${list('What a balanced conclusion weighs', b.balanced, 'gdBalanced')}${list('Where the evidence pulls apart', b.tensions, 'gdTensions')}${list('Common traps', b.traps, 'gdTraps')}
      ${flowBar({ back: '<button class="wu-link" id="gdBack">Back to group discussion</button><button class="wu-link" id="gdDownload">Download everything (.txt)</button>', primary: '<button class="primary" id="gdAgain">Run another →</button>' })}</section>`;
    document.querySelectorAll('[data-gd-keep]').forEach(el => el.oninput = () => { const i = Number(el.dataset.gdKeep); if (el.value.trim()) s.keep[i] = el.value.slice(0, L.LIMITS.text); else delete s.keep[i]; commit(); });
    document.querySelectorAll('[data-gd-change]').forEach(el => el.oninput = () => { const i = Number(el.dataset.gdChange); if (el.value.trim()) s.change[i] = el.value.slice(0, L.LIMITS.text); else delete s.change[i]; commit(); });
    document.querySelectorAll('[data-gd-person]').forEach(el => el.onclick = () => { const i = Number(el.dataset.gdPerson); download(L.speakerText(s, i), `case-room-gd-${s.names[i].replace(/[^\w-]+/g, '-')}-feedback.txt`); });
    $('#gdDownload').onclick = () => download(L.reportText(s), `case-room-gd-${b.id}-${new Date(s.finished == null ? s.started : s.finished).toISOString().slice(0, 10)}.txt`);
    const leave = again => {
      if (live) clearRun();
      if (again) { setup = { briefId: s.briefId, names: s.names.concat(s.observer ? [s.observerName || 'Observer'] : []), observer: s.observer, observerAt: s.observer ? s.names.length : 0, discuss: s.discussSeconds }; }
      open();
    };
    $('#gdBack').onclick = () => leave(false);
    $('#gdAgain').onclick = () => leave(true);
  }

  /* ---------- 5. The printable kit ---------- */
  function sheet(briefId) {
    const b = briefOf(briefId); if (!b) return open();
    enter('sheet', '#gd-sheet/' + encodeURIComponent(b.id));
    const T = TIMINGS, ticks = Array.from({ length: GROUP.max }, () => `<tr><th scope="row"><div class="peer-lines gd-name-line"></div></th>${MOVES.map(() => '<td></td>').join('')}</tr>`).join('');
    const timeLine = s => `<li><b>${mins(s)}:</b> say “Halfway.” at ${L.clock(s / 2)}, “One minute left. Someone should start pulling it together.” at ${L.clock(s - 60)}, and call time at ${L.clock(s)}.</li>`;
    $('#app').innerHTML = `<div class="actions peer-sheet-actions gd-sheet-actions"><button class="primary" id="gdSheetPrint">Print / save PDF</button><button id="gdSheetBack">← Back</button>
      <label for="gdSheetBrief" class="gd-inline">Brief</label><select id="gdSheetBrief">${BRIEFS.map(x => `<option value="${esc(x.id)}" ${x.id === b.id ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select>
      <span class="note">Page 1 is for everyone. Page 2 is for the observer. Page 3 is for after the discussion: do not read it before.</span></div>
    <article class="peer-sheet gd-sheet">
      <section class="gd-page" id="gdPage1"><div class="eyebrow">CASE ROOM · GROUP DISCUSSION · FOR EVERYONE</div><h1 class="peer-title">${esc(b.title)}</h1><p class="subtle">${esc(b.setting)} · ${typeWord(b)}</p>
        <p class="brief">${esc(b.brief)}</p><p><b>Your task:</b> ${esc(b.task)}</p>
        <h3>The evidence</h3>${b.evidence.map(e => `<section class="peer-sheet-stage"><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></section>`).join('')}
        <h3>Timings</h3><ul><li>Read in silence: ${T.prepare} seconds. Nobody speaks.</li><li>Discuss: ${T.discuss.map(s => s / 60).join(', ')} minutes, agreed before you start (${T.defaultDiscuss / 60} is usual).</li><li>Sum up: ${T.summary} seconds, by one person. ${esc(b.closing)}</li></ul>
        <p class="note">Nobody in the group should read page 3 until the discussion is over.</p></section>
      <section class="gd-page" id="gdPage2"><div class="eyebrow">CASE ROOM · GROUP DISCUSSION · FOR THE OBSERVER</div><h1 class="peer-title">${esc(b.title)}</h1>
        <p class="note">Write each speaker’s name in a row. Make a tick each time you see a move. Tick what you saw, not what you think of the person. You will miss some, and that is fine.</p>
        <table class="gd-sheet-table"><thead><tr><th scope="col">Name</th>${MOVES.map(m => `<th scope="col" class="${m.kind}">${esc(m.label)}</th>`).join('')}</tr></thead><tbody>${ticks}</tbody></table>
        <section class="peer-sheet-stage"><h3>What each move means</h3><ul class="peer-tick">${MOVES.map(m => `<li>☐ <b>${esc(m.label)}</b> (${m.kind === 'good' ? 'good move' : 'watch for'}): ${esc(m.hint)}</li>`).join('')}</ul></section>
        <section class="peer-sheet-stage"><h3>Timings and signals to call out</h3><ul><li>Silent read: ${T.prepare} seconds, then the discussion starts.</li>${T.discuss.map(timeLine).join('')}<li>Then one person sums up for ${T.summary} seconds.</li></ul></section>
        <section class="peer-sheet-stage"><h3>After the discussion</h3><p class="note">Write one thing each person should keep and one thing to change.</p>${Array.from({ length: GROUP.max }, (_, i) => `<p><b>Speaker ${i + 1}:</b> keep</p><div class="peer-lines gd-short"></div><p>change</p><div class="peer-lines gd-short"></div>`).join('')}</section></section>
      <section class="gd-page gd-last-page" id="gdPage3"><div class="eyebrow">CASE ROOM · GROUP DISCUSSION · AFTER THE DISCUSSION</div><h1 class="peer-title">${esc(b.title)}</h1>
        <section class="peer-sheet-stage"><h3>What a balanced conclusion weighs</h3><ul>${b.balanced.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>
        <section class="peer-sheet-stage"><h3>Where the evidence pulls apart</h3><ul>${b.tensions.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>
        <section class="peer-sheet-stage"><h3>Common traps</h3><ul>${b.traps.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section></section></article>`;
    $('#gdSheetPrint').onclick = () => window.print();
    $('#gdSheetBack').onclick = open;
    $('#gdSheetBrief').onchange = e => sheet(e.target.value);
  }

  /* ---------- Integration with the rest of Case Room ---------- */
  const priorHome = home;
  home = function () { priorHome(); if (run && run.phase === 'debrief') clearRun(); if (location.hash.startsWith('#gd')) setHash(''); };

  window.GDTool = { open, resume, sheet, tick, state: () => { sync(); return { run, past, screen, viewing, setup }; } };
})();
