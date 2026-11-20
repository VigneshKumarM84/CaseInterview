/* Spoken English practice: read aloud, repeat a sentence, quick answers and a one-minute talk, in the style of the
   spoken-English sections some employers use in campus hiring. No AI and no recording: the browser's own speech
   recognition turns speech into text, and EnglishCheck compares that text with what was expected. Uses core.js
   helpers and speak()/stopMedia()/stopVoice()/attachDictation()/dictationLang()/flowBar()/nudge() from cases.js.
   Transcripts and results stay in this browser under cr-english-* keys. */
(() => {
  const E = EnglishCheck;
  const RUN_KEY = 'cr-english-run', HISTORY_KEY = 'cr-english-history', MAX_HISTORY = 300, THINK = 15, TALK = 60, MAX_PLAYS = 2;
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const str = (v, max = 4000) => typeof v === 'string' ? v.slice(0, max) : '';
  const fin = x => typeof x === 'number' && Number.isFinite(x);
  const hasMic = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const hasVoice = () => voiceOn();
  const newId = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const day = t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  /* ---------- Storage, validated on every load ---------- */
  function cleanEntry(h) {
    if (!isObj(h) || !E.typeOf(h.type) || !fin(h.at) || !E.findItem(h.type, h.itemId)) return null;
    return { id: str(h.id, 40) || 'e' + h.at, at: h.at, type: h.type, itemId: h.itemId, heard: str(h.heard, 2000),
      accuracy: fin(h.accuracy) && h.accuracy >= 0 && h.accuracy <= 100 ? h.accuracy : null, correct: typeof h.correct === 'boolean' ? h.correct : null,
      wpm: fin(h.wpm) && h.wpm > 0 && h.wpm < 1000 ? h.wpm : null, words: fin(h.words) && h.words >= 0 ? h.words : 0, seconds: fin(h.seconds) && h.seconds >= 0 ? h.seconds : null,
      fillers: fin(h.fillers) && h.fillers >= 0 ? h.fillers : null, voiced: !!h.voiced,
      pauses: isObj(h.pauses) && Number.isInteger(h.pauses.count) && h.pauses.count >= 0 && fin(h.pauses.longest) ? { count: h.pauses.count, longest: h.pauses.longest } : null, missed: Array.isArray(h.missed) ? h.missed.filter(w => typeof w === 'string').map(w => w.slice(0, 40)).slice(0, 40) : [] };
  }
  function cleanRun(v) {
    if (!isObj(v) || !Array.isArray(v.items) || !v.items.length || v.items.length > 20) return null;
    if (!v.items.every(x => isObj(x) && E.findItem(x.type, x.id))) return null;
    const items = v.items.map(x => ({ type: x.type, id: x.id })), index = Number.isInteger(v.index) && v.index >= 0 && v.index < items.length ? v.index : 0;
    const results = items.map((_, i) => Array.isArray(v.results) && typeof v.results[i] === 'string' ? v.results[i].slice(0, 40) : null);
    return { id: str(v.id, 40) || newId(), kind: v.kind === 'full' || E.typeOf(v.kind) ? v.kind : 'full', items, index, results, started: fin(v.started) ? v.started : Date.now() };
  }
  let history = (() => { const v = read(HISTORY_KEY, []); return Array.isArray(v) ? v.map(cleanEntry).filter(Boolean).slice(0, MAX_HISTORY) : []; })();
  let run = cleanRun(read(RUN_KEY, null));
  let screen = 'home', live = null, ticker = null;
  const saveHistory = () => save(HISTORY_KEY, history);
  const saveRun = () => save(RUN_KEY, run);
  const entryOf = id => history.find(h => h.id === id);

  function setHash(h) { try { window.history.replaceState(null, '', location.pathname + location.search + h); } catch { /* file:// or sandboxed frames */ } }
  function stopTicker() { if (ticker) { clearInterval(ticker); ticker = null; } }
  function enter(name) { stopTicker(); stopMedia(); live = null; view = 'english'; screen = name; setHash('#english'); window.scrollTo(0, 0); }

  /* ---------- Home ---------- */
  function open() { enter('home'); renderHome(); }
  function renderHome() {
    enter('home');
    const stats = E.summarise(history), tricky = E.trickyWords(history), statOf = id => stats.find(s => s.type === id);
    const statLine = s => !s.attempts ? 'Not tried yet' : s.type === 'quick' ? `${s.correct}% right over your last ${s.attempts}` : s.type === 'jam' ? `${s.attempts} talk${s.attempts === 1 ? '' : 's'} · ${s.wpm ?? '—'} words a minute on average` : `${s.accuracy ?? '—'}% of words heard as written, last ${s.attempts}`;
    const resume = run ? `<section class="panel bh-resume en-resume"><div><b>Unfinished practice</b><p class="note">Task ${run.index + 1} of ${run.items.length} · ${esc(E.typeOf(run.items[run.index].type).title)}</p></div><div class="actions"><button class="primary" id="enResume">Carry on →</button><button class="wu-link" id="enDiscard">Discard</button></div></section>` : '';
    $('#app').innerHTML = `<section class="bh-head"><div class="eyebrow">SPOKEN ENGLISH</div><h1 class="bh-title">Speak clearly, <em>on the first try.</em></h1>
      <p class="lead">Some employers add a spoken-English section to the online test: reading aloud, repeating sentences, short answers and a one-minute talk. Practise each one here and see what your browser heard.</p></section>${resume}
      ${hasMic() ? '' : '<p class="bh-honest-box"><b>Dictation is not available in this browser.</b> Reading aloud needs it, so use Chrome or Edge on a computer or Android phone. You can still type your answers to the repeat and quick-answer tasks, and write a one-minute talk.</p>'}
      <div class="en-grid"><section class="panel en-full"><div class="eyebrow">ABOUT 8 MINUTES</div><h2>Full practice</h2><p class="note">Three sentences to read, three to repeat, four quick answers and a one-minute talk, in that order, like a short test section. You see how you did after each task.</p>
        <div class="actions"><button class="primary" id="enFull">Start full practice →</button></div></section>
      ${E.TYPES.map(t => `<section class="panel en-type"><h3>${esc(t.title)}</h3><p class="note">${esc(t.short)}</p><p class="en-stat">${esc(statLine(statOf(t.id)))}</p><button id="enStart-${t.id}" ${t.needsMic && !hasMic() ? 'disabled title="Needs dictation"' : ''}>Practise ${t.count > 1 ? `${t.count} ` : ''}${esc(t.title.toLowerCase())} →</button></section>`).join('')}</div>
      ${tricky.length ? `<section class="panel"><h2>Words to practise</h2><p class="note">The browser missed these more than once in your recent reading and repeating. Say each one slowly, then in a sentence. A word can also be missed because of the microphone or noise, so treat this as a list to check, not a verdict.</p><p class="en-words">${tricky.map(t => `<span>${esc(t.word)} <small>×${t.n}</small></span>`).join('')}</p></section>` : ''}
      <section class="panel"><h2>How this is checked</h2><p class="note">Your browser’s speech recognition turns what you say into text, and Case Room compares that text with the sentence or answer expected. Nothing is recorded or sent to Case Room. The browser’s speech service may process the audio online. Recognition depends on your microphone, noise and accent, so a missed word is a prompt to check, not proof of a mistake. A real test may also score pronunciation and fluency in ways this cannot.</p>
        ${history.length ? `<div class="actions"><button id="enClear">Delete my spoken English results</button></div>` : ''}</section>`;
    $('#enFull').onclick = () => start('full');
    E.TYPES.forEach(t => { $('#enStart-' + t.id).onclick = () => start(t.id); });
    if ($('#enResume')) $('#enResume').onclick = renderItem;
    if ($('#enDiscard')) $('#enDiscard').onclick = () => { run = null; saveRun(); renderHome(); };
    if ($('#enClear')) $('#enClear').onclick = () => { if (!confirm('Delete every saved spoken English result from this browser? This cannot be undone.')) return; history = []; saveHistory(); renderHome(); };
  }

  function start(kind) {
    if (run && run.results.some(Boolean) && !confirm('Start a new practice? Your unfinished one will be discarded.')) return;
    const recent = history.slice(0, 30).map(h => h.itemId);
    run = { id: newId(), kind, items: E.buildRun(kind, Math.random, recent), index: 0, results: [], started: Date.now() };
    run.results = run.items.map(() => null); saveRun(); renderItem();
  }

  /* ---------- One task at a time ---------- */
  const INSTRUCTIONS = {
    read: 'Press the microphone, read the sentence aloud at a natural pace, then press stop.',
    repeat: 'Play the sentence and listen. Then press the microphone and say it back exactly as you heard it.',
    quick: 'Listen to the question and answer in a word or a short phrase.',
    jam: `You have ${THINK} seconds to think. Then press the microphone and speak for one minute. It stops by itself at the minute.`
  };
  function head(item) {
    const n = run.items.length, i = run.index, type = E.typeOf(item.type);
    return `<div class="flow-head"><div><div class="eyebrow">SPOKEN ENGLISH · TASK ${i + 1} OF ${n}</div><h2 class="section-title">${esc(type.title)}</h2></div><button class="wu-link" id="enExit">Exit · progress is saved</button></div>
      ${n > 1 ? `<ol class="flow-progress" aria-hidden="true">${run.items.map((_, k) => `<li class="${k < i || (k === i && run.results[i]) ? 'done' : k === i ? 'now' : ''}"></li>`).join('')}</ol>` : ''}`;
  }
  function renderItem() {
    if (!run) return renderHome();
    if (run.results[run.index]) return renderResult();
    enter('item');
    const ref = run.items[run.index], item = E.findItem(ref.type, ref.id), owner = run;
    live = { firstAt: null, lastAt: null, startAt: null, pauses: null, plays: 0, typedAt: null, owner };
    const answerBox = ref.type === 'quick' ? '<input id="enHeard" class="en-input" autocomplete="off" placeholder="Speak or type your answer…">' : `<textarea id="enHeard" class="en-heard" placeholder="${ref.type === 'read' ? 'Your words appear here as you read…' : 'Your words appear here as you speak. You can also type.'}"></textarea>`;
    const prompt = {
      read: `<p class="en-sentence">${esc(item.text)}</p>`,
      repeat: `<div class="en-listen"><button id="enPlay" class="listen">🔊 Play the sentence</button><span class="note" id="enPlays">You can play it ${MAX_PLAYS} times.</span></div><p class="en-sentence en-hidden" id="enShown" hidden>${esc(item.text)}</p>`,
      quick: `<div class="en-listen"><button id="enPlay" class="listen">🔊 Play the question</button><button class="wu-link" id="enShowQ">Show the question</button></div><p class="en-question" id="enShown" ${hasVoice() ? 'hidden' : ''}>${esc(item.prompt)}</p>`,
      jam: `<div class="interviewer flow-question"><div class="eyebrow">YOUR TOPIC</div><p>${esc(item.topic)}</p></div><p class="en-clock" id="enClock" aria-live="off">Think time: ${THINK}s</p>
        <details class="flow-help"><summary>A simple shape for one minute</summary><div class="help-body"><p>Say your view in one sentence. Give two reasons, each with an example from your own life. Finish by repeating your view in different words. Silence is worse than a simple point.</p></div></details>`
    }[ref.type];
    $('#app').innerHTML = `<section class="flow-screen fit en-item">${head(ref)}<p class="note fit-note">${esc(INSTRUCTIONS[ref.type])}</p>${prompt}
      ${micRow('enMic', 'enVoiceStatus')}
      <label for="enHeard" class="flow-label">${ref.type === 'read' ? 'What the browser heard, as you speak' : 'Your answer · appears here as you speak, or type'}</label>${ref.type === 'quick' ? answerBox : `<div class="dictation-box">${answerBox}</div>`}
      ${flowBar({ back: '<button class="wu-link" id="enSkip">Skip this task</button>', primary: `<button class="primary next" id="enCheck">${ref.type === 'jam' ? 'Finish · see feedback →' : 'Check →'}</button>`, hint: '' })}</section>`;
    const box = $('#enHeard'), mine = () => live && live.owner === owner && screen === 'item';
    const heard = () => { const now = Date.now(); if (live.firstAt == null) live.firstAt = now; live.lastAt = now; live.pauses = BehaviouralContent.notePause(live.pauses, now); };
    attachDictation({ button: $('#enMic'), target: box, status: $('#enVoiceStatus'), language: dictationLang, isCurrent: mine,
      onStart: () => { if (!mine()) return; live.pauses = BehaviouralContent.notePause(live.pauses, Date.now(), true); if (ref.type === 'jam' && live.startAt == null) beginTalk(); },
      onText: () => { if (mine()) heard(); } });
    if (ref.type === 'read' && !hasMic()) { box.readOnly = true; $('#flowHint').textContent = 'Reading aloud needs dictation. Use Chrome or Edge, or skip this task.'; }
    box.oninput = () => { if (ref.type === 'jam' && live.startAt == null && box.value.trim()) beginTalk(); };
    if ($('#enPlay')) $('#enPlay').onclick = () => play(ref, item);
    if ($('#enShowQ')) $('#enShowQ').onclick = () => { $('#enShown').hidden = false; $('#enShowQ').remove(); };
    if (ref.type === 'repeat' && !hasVoice()) { $('#enPlay').textContent = 'Show the sentence for 5 seconds'; }
    if (ref.type === 'jam') thinkTime();
    if (ref.type === 'quick' && hasVoice()) setTimeout(() => { if (mine() && live.plays === 0) play(ref, item); }, 300);
    $('#enExit').onclick = () => { stopTicker(); renderHome(); };
    $('#enSkip').onclick = () => next(true);
    $('#enCheck').onclick = () => check();
  }
  /* Repeat: at most two plays, then the sentence is not available again until the result. */
  function play(ref, item) {
    if (ref.type === 'quick') { if (hasVoice()) speak(item.prompt); else $('#enShown').hidden = false; live.plays++; return; }
    if (live.plays >= MAX_PLAYS) return;
    live.plays++;
    if (hasVoice()) speak(item.text);
    else { const s = $('#enShown'); s.hidden = false; setTimeout(() => { if (s.isConnected) s.hidden = true; }, 5000); }
    const left = MAX_PLAYS - live.plays;
    $('#enPlays').textContent = left ? `You can play it ${left} more time.` : 'No plays left. Say it back now.';
    if (!left) $('#enPlay').disabled = true;
  }
  /* One step of the clock: think time first, then the speaking minute, which stops dictation and checks the talk. */
  function tick() {
    if (!live || screen !== 'item' || !$('#enClock')) return stopTicker();
    if (live.startAt != null) return paintTalk();
    const s = Math.max(0, Math.ceil((live.thinkUntil - Date.now()) / 1000));
    $('#enClock').textContent = s ? `Think time: ${s}s` : 'Think time is up. Press the microphone and start speaking.';
    $('#enClock').classList.toggle('over', !s);
  }
  function thinkTime() { live.thinkUntil = Date.now() + THINK * 1000; stopTicker(); ticker = setInterval(tick, 250); }
  function beginTalk() { live.startAt = Date.now(); paintTalk(); if (!ticker) ticker = setInterval(tick, 250); }
  function paintTalk() {
    const s = Math.floor((Date.now() - live.startAt) / 1000), left = Math.max(0, TALK - s);
    $('#enClock').textContent = left ? `Speaking: ${left}s left` : 'Time is up.';
    $('#enClock').classList.toggle('over', left <= 10);
    if (!left) { stopTicker(); stopVoice(); check(true); }
  }

  /* ---------- Checking an answer and saving the result ---------- */
  function check(auto = false) {
    if (!run || !live) return;
    const ref = run.items[run.index], item = E.findItem(ref.type, ref.id), text = $('#enHeard').value.trim();
    if (!text && !auto) return nudge(ref.type === 'read' ? 'Press the microphone and read the sentence first.' : 'Speak or type your answer first.', '#enMic');
    stopTicker(); stopMedia();
    const voiced = live.firstAt != null, entry = { id: newId(), at: Date.now(), type: ref.type, itemId: ref.id, heard: text.slice(0, 2000), accuracy: null, correct: null, wpm: null, words: 0, seconds: null, fillers: null, missed: [] };
    if (ref.type === 'read' || ref.type === 'repeat') {
      const r = E.scoreSentence(ref.type, item.text, text, voiced ? live : {});
      Object.assign(entry, { accuracy: r.accuracy, wpm: r.wpm, words: r.heardWords, missed: r.missed });
    } else if (ref.type === 'quick') entry.correct = E.scoreQuick(item, text).correct;
    else {
      const seconds = live.startAt != null ? Math.min(TALK, Math.round((Math.max(live.lastAt || 0, auto ? live.startAt + TALK * 1000 : Date.now()) - live.startAt) / 1000)) : null;
      const r = E.scoreJam(text, { seconds, pauses: voiced ? live.pauses : null });
      Object.assign(entry, { words: r.words, seconds, wpm: r.wpm, fillers: r.fillers.per100, pauses: voiced && live.pauses ? { count: live.pauses.count, longest: live.pauses.longest } : null });
    }
    entry.voiced = voiced;
    history.unshift(entry); history = history.slice(0, MAX_HISTORY); saveHistory();
    run.results[run.index] = entry.id; saveRun(); renderResult();
  }

  function renderResult() {
    const ref = run.items[run.index], item = E.findItem(ref.type, ref.id), h = entryOf(run.results[run.index]);
    if (!h) { run.results[run.index] = null; saveRun(); return renderItem(); }
    enter('result');
    const last = run.index === run.items.length - 1, checks = list => `<ul class="bh-checks">${list.map(c => `<li class="${c.level === 'ok' ? 'ok' : c.level === 'miss' ? 'missing' : 'warn'}"><span aria-hidden="true">${c.level === 'ok' ? '✓' : c.level === 'miss' ? '○' : '↗'}</span> ${esc(c.text)}</li>`).join('')}</ul>`;
    let body = '';
    if (ref.type === 'read' || ref.type === 'repeat') {
      const r = E.scoreSentence(ref.type, item.text, h.heard, {}); r.wpm = h.wpm;
      if (ref.type === 'read' && h.wpm != null) r.checks.push(h.wpm < 100 ? { level: 'warn', text: `${h.wpm} words a minute is slow for reading aloud. Read in phrases rather than word by word.` } : h.wpm > 180 ? { level: 'warn', text: `${h.wpm} words a minute is fast. Slow down so every word is clear.` } : { level: 'ok', text: `${h.wpm} words a minute is a clear reading pace.` });
      body = `<div class="score-grid en-scores"><div><div class="metric">${r.accuracy}%</div><span class="note">Words heard as written</span></div><div><div class="metric">${h.wpm ?? '—'}</div><span class="note">${h.wpm != null ? 'Words a minute' : 'Pace needs dictation'}</span></div></div>
        <p class="flow-label">The sentence</p><p class="en-sentence en-marked">${r.marks.map(m => m.ok ? esc(m.word) : `<mark title="Not heard as written">${esc(m.word)}</mark>`).join(' ')}</p>
        <p class="note">Highlighted words were not heard as written. Say them again slowly, then in the sentence.</p>
        <p class="flow-label">What the browser heard</p><p class="transcript en-said">${esc(h.heard) || '<span class="subtle">Nothing</span>'}</p>${checks(r.checks)}`;
    } else if (ref.type === 'quick') {
      body = `<p class="en-question">${esc(item.prompt)}</p><div class="en-verdict ${h.correct ? 'ok' : 'miss'}"><b>${h.correct ? '✓ Right' : '✗ Not the expected answer'}</b><span>You said: “${esc(h.heard) || '…'}”. ${h.correct ? '' : `Expected: “${esc(item.answers[0])}”.`}</span></div>
        <p class="note">In a real test, answer with just the word or phrase, straight away. If the browser misheard a right answer, that can happen in a real test too: speak clearly and close to the microphone.</p>`;
    } else {
      const r = E.scoreJam(h.heard, { seconds: h.seconds, pauses: h.voiced ? h.pauses || null : null });
      body = `<div class="interviewer flow-question"><div class="eyebrow">YOUR TOPIC</div><p>${esc(item.topic)}</p></div>
        <div class="score-grid en-scores"><div><div class="metric">${h.seconds != null ? h.seconds + 's' : '—'}</div><span class="note">Time spent speaking</span></div><div><div class="metric">${r.words}</div><span class="note">Words</span></div><div><div class="metric">${r.wpm ?? '—'}</div><span class="note">Words a minute</span></div><div><div class="metric">${r.fillers.total}</div><span class="note">Filler words</span></div></div>
        ${checks(r.checks)}<fieldset class="bh-heard"><legend>Check yourself: did your talk have these?</legend>${['A clear view in the first sentence', 'Two reasons, each with an example', 'A closing line that came back to your view', 'No long silence while you searched for a word'].map((x, i) => `<label class="selfcheck"><input type="checkbox" data-en-self="${i}"> ${esc(x)}</label>`).join('')}</fieldset>
        <details><summary>What the browser heard</summary><p class="transcript">${esc(h.heard) || 'Nothing'}</p></details>`;
    }
    $('#app').innerHTML = `<section class="flow-screen en-result">${head(ref)}${body}
      ${flowBar({ back: '<button class="wu-link" id="enAgain">Try this one again</button>', primary: `<button class="primary next" id="enNext">${last ? 'See your summary →' : 'Next task →'}</button>` })}</section>`;
    $('#enExit').onclick = renderHome;
    $('#enAgain').onclick = () => { run.results[run.index] = null; saveRun(); renderItem(); };
    $('#enNext').onclick = () => next();
    $('#enNext').focus({ preventScroll: true });
  }

  function next(skip = false) {
    stopTicker(); stopMedia();
    if (skip && $('#enHeard') && $('#enHeard').value.trim() && !confirm('Skip this task? Your answer will not be checked.')) return;
    if (run.index >= run.items.length - 1) return renderSummary();
    run.index++; saveRun(); renderItem();
  }

  /* ---------- Summary ---------- */
  function renderSummary() {
    const r = run; if (!r) return renderHome();
    enter('summary');
    const rows = r.items.map((ref, i) => ({ ref, item: E.findItem(ref.type, ref.id), h: entryOf(r.results[i]) })), done = rows.filter(x => x.h);
    const avg = xs => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
    const sentences = done.filter(x => x.h.accuracy != null), quick = done.filter(x => x.ref.type === 'quick');
    const missed = [...new Set(sentences.flatMap(x => x.h.missed.map(w => w.toLowerCase())))].slice(0, 12);
    $('#app').innerHTML = `<section class="flow-screen en-summary"><div class="eyebrow">SPOKEN ENGLISH · PRACTICE DONE</div><h1 class="bh-title">You did ${done.length} of ${rows.length} task${rows.length === 1 ? '' : 's'}.</h1>
      <div class="score-grid en-scores">${sentences.length ? `<div><div class="metric">${avg(sentences.map(x => x.h.accuracy))}%</div><span class="note">Words heard as written (reading and repeating)</span></div>` : ''}${quick.length ? `<div><div class="metric">${quick.filter(x => x.h.correct).length}/${quick.length}</div><span class="note">Quick answers right</span></div>` : ''}</div>
      ${missed.length ? `<section class="panel"><h2>Words to say again</h2><p class="en-words">${missed.map(w => `<span>${esc(w)}</span>`).join('')}</p></section>` : ''}
      <ol class="bh-summary-list">${rows.map(({ ref, item, h }) => `<li><div><b>${esc(E.typeOf(ref.type).title)}</b><span class="note">${esc(item.text || item.prompt || item.topic)}</span></div><span class="note">${!h ? 'Skipped' : h.accuracy != null ? `${h.accuracy}% heard` : h.correct != null ? (h.correct ? 'Right' : 'Not right') : `${h.words} words · ${h.seconds ?? '—'}s`}</span></li>`).join('')}</ol>
      ${flowBar({ back: '<button class="wu-link" id="enBack">Back to spoken English</button>', primary: '<button class="primary" id="enAgainAll">Practise again →</button>' })}</section>`;
    const kind = r.kind; run = null; saveRun();
    $('#enBack').onclick = renderHome;
    $('#enAgainAll').onclick = () => start(kind);
  }

  /* ---------- Integration with the rest of Case Room ---------- */
  const priorHome = home;
  home = function () { stopTicker(); live = null; priorHome(); if (location.hash === '#english') setHash(''); };

  window.EnglishTool = { open, start, resume: renderItem, tick, state: () => ({ history, run, screen, live }) };
})();
