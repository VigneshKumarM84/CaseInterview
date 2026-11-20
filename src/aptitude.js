/* Campus placement aptitude practice: topic practice with instant worked solutions, placement-style timed tests
   with a question palette, mark for review, negative marking and auto-submit, results and per-topic progress.
   Exam conditions (a clock that does not pause, counted exits, forward-only navigation, a guess before the score), placement-notice tests
   and shared papers are built on AptitudeExam. Works fully offline. Uses core.js helpers, stopMedia()/view/home from cases.js and AptitudeQuestions. */
(() => {
  const A = AptitudeQuestions, E = AptitudeExam;
  const RUN_KEY = 'cr-aptitude-run', HISTORY_KEY = 'cr-aptitude-history', PREFS_KEY = 'cr-aptitude-prefs', NOTICES_KEY = 'cr-aptitude-notices', MAX_HISTORY = 100;
  const COUNTS = [5, 10, 20], PER_SECTION = [5, 10, 20, 30];
  const TARGETS = [[0, 'No target'], [30, '30 seconds'], [45, '45 seconds'], [60, '1 minute'], [90, '90 seconds'], [120, '2 minutes']];
  const PACES = [[36, '36 seconds per question (fast)'], [60, '1 minute per question'], [90, '90 seconds per question'], [120, '2 minutes per question (Advanced and Expert)']];
  const MIX_TITLES = { mixed: 'Mixed difficulty', 'mixed-high': 'Mixed: Hard to Expert' };
  const NEGATIVES = [[0, 'No negative marking'], [0.25, '−0.25 per wrong answer'], [1 / 3, '−1/3 per wrong answer'], [0.5, '−0.5 per wrong answer']];
  const LETTERS = ['A', 'B', 'C', 'D'];
  const LEVEL_OPTIONS = [...A.LEVELS.map(l => [l.id, l.title]), ['mixed', 'Mixed (like real tests)'], ['mixed-high', 'Mixed: Hard to Expert']], NOTICE_LEVELS = LEVEL_OPTIONS.map(x => x[0]), SHORT = { quant: 'Quant', logical: 'Logical', verbal: 'Verbal' };
  const PRESET_DATA = (typeof window !== 'undefined' && window.APTITUDE_PRESETS) || { PRESETS: [], NOTE: '' };
  const PRESETS = Array.isArray(PRESET_DATA.PRESETS) ? PRESET_DATA.PRESETS : [], PRESET_NOTE = PRESET_DATA.NOTE || '';
  const topicOf = A.topicOf, sectionOf = id => A.SECTIONS.find(s => s.id === id);
  const topicsIn = s => A.TOPICS.filter(t => t.section === s).map(t => t.id);
  const levelTitle = id => MIX_TITLES[id] || (A.LEVELS.find(l => l.id === id) || A.LEVELS[1]).title;
  const negLabel = n => n ? '−' + (Math.abs(n - 1 / 3) < 1e-9 ? '1/3' : String(n)) : 'none';

  /* ---------- Reading stored data defensively ---------- */
  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const str = x => typeof x === 'string';
  const fin = x => typeof x === 'number' && Number.isFinite(x);
  function cleanPrefs(p) {
    p = isObj(p) ? p : {};
    const topics = {}; for (const s of A.SECTIONS) { const list = isObj(p.topics) && Array.isArray(p.topics[s.id]) ? p.topics[s.id].filter(t => topicsIn(s.id).includes(t)) : []; topics[s.id] = list.length ? list : topicsIn(s.id); }
    const sections = Array.isArray(p.sections) ? A.SECTIONS.map(s => s.id).filter(s => p.sections.includes(s)) : [];
    return {
      section: sectionOf(p.section) ? p.section : 'quant', topics, level: A.LEVEL_IDS.includes(p.level) ? p.level : 'medium', count: COUNTS.includes(p.count) ? p.count : 10,
      target: TARGETS.some(t => t[0] === p.target) ? p.target : 0, sections: sections.length ? sections : A.SECTIONS.map(s => s.id), perSection: PER_SECTION.includes(p.perSection) ? p.perSection : 10,
      testLevel: A.LEVEL_IDS.includes(p.testLevel) || A.MIXES[p.testLevel] ? p.testLevel : 'mixed', pace: PACES.some(x => x[0] === p.pace) ? p.pace : 60,
      timing: p.timing === 'sectional' ? 'sectional' : 'total', negative: NEGATIVES.some(x => x[0] === p.negative) ? p.negative : 0,
      strict: p.strict === true, nav: p.nav === 'forward' ? 'forward' : 'free'
    };
  }
  function validQuestion(q) {
    if (!isObj(q) || !str(q.prompt) || !topicOf(q.topic) || q.section !== topicOf(q.topic).section || !Array.isArray(q.options) || q.options.length !== 4 || !q.options.every(str) || new Set(q.options).size !== 4) return false;
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3 || !Array.isArray(q.solution) || !q.solution.every(str) || (q.shortcut != null && !str(q.shortcut))) return false;
    if (q.chart != null && !(isObj(q.chart) && str(q.chart.title) && Array.isArray(q.chart.years) && q.chart.years.length === 2 && Array.isArray(q.chart.series) && q.chart.series.length && q.chart.series.every(s => isObj(s) && str(s.label) && Array.isArray(s.values) && s.values.length === 2 && s.values.every(fin)))) return false;
    if (q.table != null && !(isObj(q.table) && str(q.table.title) && Array.isArray(q.table.columns) && q.table.columns.every(str) && Array.isArray(q.table.rows) && q.table.rows.every(r => Array.isArray(r) && r.length === q.table.columns.length && r.every(fin)))) return false;
    if (q.passage != null && !(isObj(q.passage) && str(q.passage.title) && str(q.passage.text))) return false;
    return true;
  }
  const arr = (x, n, ok) => Array.isArray(x) && x.length === n && x.every(ok);
  function validRun(r) {
    if (!isObj(r) || !str(r.id) || !Array.isArray(r.questions) || !r.questions.length || r.questions.length > 120 || !r.questions.every(validQuestion)) return false;
    const n = r.questions.length;
    if (!Number.isInteger(r.index) || r.index < 0 || r.index >= n) return false;
    if (r.mode === 'practice') return arr(r.results, n, x => x === null || (isObj(x) && (x.choice === null || (Number.isInteger(x.choice) && x.choice >= 0 && x.choice < 4)) && typeof x.ok === 'boolean' && fin(x.seconds) && x.seconds >= 0)) && TARGETS.some(t => t[0] === r.target) && fin(r.qStarted);
    if (r.mode !== 'test') return false;
    if (!PACES.some(x => x[0] === r.pace) || !['total', 'sectional'].includes(r.timing) || !NEGATIVES.some(x => x[0] === r.negative) || !fin(r.elapsed) || r.elapsed < 0) return false;
    if (!Array.isArray(r.sections) || !r.sections.length || !r.sections.every(s => sectionOf(s)) || r.questions.some(q => !r.sections.includes(q.section))) return false;
    if (!Number.isInteger(r.sectionIndex) || r.sectionIndex < 0 || r.sectionIndex >= r.sections.length || !arr(r.sectionElapsed, r.sections.length, x => fin(x) && x >= 0)) return false;
    if (r.timing === 'sectional' && r.questions[r.index].section !== r.sections[r.sectionIndex]) return false;
    if (!arr(r.answers, n, x => x === null || (Number.isInteger(x) && x >= 0 && x < 4)) || !arr(r.marked, n, x => typeof x === 'boolean') || !arr(r.visited, n, x => typeof x === 'boolean') || !arr(r.seconds, n, x => fin(x) && x >= 0)) return false;
    return validExam(r);
  }
  /* The fields added for exam conditions, notices and shared papers. All are optional: a run without them behaves as before. */
  function validExam(r) {
    const opt = (x, ok) => x == null || ok(x), count = x => Number.isInteger(x) && x >= 0;
    if (!opt(r.strict, x => typeof x === 'boolean') || !opt(r.nav, x => ['free', 'forward'].includes(x)) || !opt(r.switchLimit, x => E.LIMITS.switchLimits.includes(x))) return false;
    if (!opt(r.sectionMs, x => arr(x, r.sections.length, y => fin(y) && y > 0 && y <= 7200000)) || !opt(r.totalMs, x => fin(x) && x > 0 && x <= 21600000)) return false;
    if (!opt(r.clockAt, fin) || (r.strict === true && !fin(r.clockAt))) return false;
    if (!opt(r.left, count) || !opt(r.awayMs, x => fin(x) && x >= 0) || !opt(r.away, x => typeof x === 'boolean') || !opt(r.awaySec, x => Number.isInteger(x) && x >= 0 && x < r.sections.length)) return false;
    if (!opt(r.name, x => str(x) && x.length <= E.LIMITS.name) || !opt(r.ended, x => ['time', 'switches'].includes(x)) || !opt(r.done, x => typeof x === 'boolean')) return false;
    return opt(r.paper, x => isObj(x) && str(x.code) && x.code.length <= 1200 && /^[0-9a-z]{6}$/.test(x.check) && typeof x.match === 'boolean' && opt(x.player, y => str(y) && y.length <= 80));
  }
  const validEntry = e => isObj(e) && str(e.id) && fin(e.at) && ['practice', 'test'].includes(e.mode) && Array.isArray(e.results) && e.results.every(x => isObj(x) && topicOf(x.topic) && typeof x.ok === 'boolean' && typeof x.answered === 'boolean' && (x.seconds == null || fin(x.seconds)));

  let prefs = cleanPrefs(read(PREFS_KEY, {}));
  let history = read(HISTORY_KEY, []); history = Array.isArray(history) ? history.filter(validEntry) : [];
  let run = read(RUN_KEY, null); if (!validRun(run)) run = null;
  let notices = loadNotices();
  let screen = 'home', lastResult = null, lastTick = null, ticks = 0;
  /* wasOnTest: this page has shown the strict test and the student has not left it since. held: a strict run that was submitted but not yet
     revealed, kept in storage so a reload lands on the results. pending: the result waiting for the guess (ask) or to be shown. */
  let wasOnTest = false, held = null, pending = null, brief = null;
  if (run && run.done) {
    const e = history.find(h => h.id === run.id); held = run; run = null;
    if (e) { const r = makeResult(held, !!e.auto, held.ended || null).res; r.entry = e; pending = { res: r, ask: false }; } else { held = null; save(RUN_KEY, null); }
  }

  const persist = () => save(RUN_KEY, run || held || null);
  function setHash(on) { try { window.history.replaceState(null, '', location.pathname + location.search + (on ? '#aptitude' : '')); } catch { /* file:// or sandboxed frames */ } }
  const seconds = n => n == null ? '—' : n < 60 ? `${Math.round(n)}s` : clock(Math.round(n));
  const percent = n => n == null ? '—' : Math.round(n * 100) + '%';
  const marks = n => String(Math.round(n * 100) / 100);
  function enter(name) { pause(); stopMedia(); view = 'aptitude'; screen = name; setHash(true); window.scrollTo(0, 0); }
  function open() { enter('home'); renderHome(); }
  function showPending() {
    const p = pending;
    if (p.ask) return renderPredict(p.res);
    held = null; pending = null; persist(); renderResults(p.res);
  }

  /* ---------- Shared question pieces ---------- */
  function chartMarkup(chart) {
    const W = 560, H = 270, top = 46, bottom = 40, plot = H - top - bottom, n = chart.series.length, groupW = (W - 20) / n, barW = Math.min(46, groupW * 0.32), gap = 6;
    const max = Math.max(...chart.series.flatMap(s => s.values));
    const bars = chart.series.map((s, i) => s.values.map((v, j) => {
      const h = Math.max(2, v / max * (plot - 20)), x = 10 + i * groupW + groupW / 2 - barW - gap / 2 + j * (barW + gap), y = top + plot - h;
      return `<rect class="bar y${j}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3"/><text class="val" x="${(x + barW / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}">${esc(A.fmt(v))}</text>`;
    }).join('') + `<text class="cat" x="${(10 + i * groupW + groupW / 2).toFixed(1)}" y="${H - 14}">${esc(s.label.split(' ')[0])}</text>`).join('');
    const legend = chart.years.map((y, j) => `<rect class="bar y${j}" x="${10 + j * 90}" y="8" width="14" height="14" rx="3"/><text class="leg" x="${30 + j * 90}" y="20">${esc(y)}</text>`).join('');
    const summary = chart.series.map(s => `${s.label}: ${chart.years.map((y, j) => `${y} ${s.values[j]}`).join(', ')}`).join('; ');
    return `<figure class="drill-chart apt-chart"><figcaption>${esc(chart.title)}</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(chart.title + '. ' + summary)}">${legend}<line class="axis" x1="10" x2="${W - 10}" y1="${top + plot}" y2="${top + plot}"/>${bars}</svg>
      <p class="note apt-chart-key">${chart.series.map(s => esc(s.label)).join(' · ')}</p>
      <table class="sr-only"><caption>${esc(chart.title)}</caption><tr><th scope="col">Company</th>${chart.years.map(y => `<th scope="col">${esc(y)}</th>`).join('')}</tr>${chart.series.map(s => `<tr><th scope="row">${esc(s.label)}</th>${s.values.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table></figure>`;
  }
  function tableMarkup(t) {
    return `<div class="apt-table-wrap"><table class="apt-data"><caption>${esc(t.title)}</caption><thead><tr>${t.columns.map(c => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map((v, i) => i ? `<td>${esc(A.fmt(v))}</td>` : `<th scope="row">${esc(v)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function passageMarkup(p, open = true) {
    return `<details class="apt-passage" ${open ? 'open' : ''}><summary>${open ? 'Passage' : 'Show the passage'}: ${esc(p.title)}</summary>${p.text.split(/\n\s*\n/).map(x => `<p>${esc(x)}</p>`).join('')}</details>`;
  }
  const stem = q => `${q.passage ? passageMarkup(q.passage) : ''}${q.table ? tableMarkup(q.table) : ''}${q.chart ? chartMarkup(q.chart) : ''}<p class="apt-prompt" id="aptPrompt">${esc(q.prompt)}</p>`;
  function optionsMarkup(q, chosen, reveal) {
    return `<div class="apt-options" role="group" aria-label="Answer options">${q.options.map((o, i) => {
      const cls = reveal ? (i === q.answer ? ' right' : i === chosen ? ' wrong' : '') : (i === chosen ? ' chosen' : '');
      return `<button type="button" class="apt-option${cls}" data-opt="${i}" aria-pressed="${i === chosen}" ${reveal ? 'disabled' : ''}><span class="apt-letter" aria-hidden="true">${LETTERS[i]}</span><span>${esc(o)}</span>${reveal && i === q.answer ? '<span class="sr-only"> (correct answer)</span>' : ''}</button>`;
    }).join('')}</div>`;
  }
  const solutionMarkup = q => `<ol class="drill-steps">${q.solution.map(s => `<li>${esc(s)}</li>`).join('')}</ol>${q.shortcut ? `<p class="note"><b>Shortcut:</b> ${esc(q.shortcut)}</p>` : ''}`;

  /* ---------- Home: practice setup, test setup, progress ---------- */
  function renderHome() {
    pause(); stopMedia(); view = 'aptitude'; screen = 'home'; window.scrollTo(0, 0);
    if (pending) return showPending();
    if (exam() && syncAway()) return;
    const stats = A.summarise(history), weak = A.weakest(stats), practised = stats.filter(s => s.attempts);
    const resume = run ? `<section class="panel drill-resume"><div><b>Unfinished ${run.mode === 'test' ? 'timed test' : 'practice set'}</b><p class="note">${run.mode === 'test'
      ? (run.strict ? `Exam in progress · <span id="aptExamLeft">${clock(Math.ceil(remainingMs() / 1000))} left</span> · the clock is running`
        : `${run.sections.map(s => sectionOf(s).title).join(', ')} · ${run.answers.filter(a => a != null).length} of ${run.questions.length} answered · ${clock(Math.ceil(remainingMs() / 1000))} left (the clock is paused)`)
      : `${levelTitle(run.level)} · question ${run.index + 1} of ${run.questions.length} · ${run.results.filter(x => x && x.ok).length} correct so far`}</p></div><div class="actions"><button class="primary" id="aptResume">Resume →</button><button id="aptDiscard">Discard</button></div></section>` : '';
    $('#app').innerHTML = `<section class="drill-head"><div class="eyebrow">PLACEMENT APTITUDE</div><h1 class="drill-title">Clear the online <em>aptitude round.</em></h1><p class="lead">Quantitative, logical and verbal questions like the online tests campus placements use before any interview. Practise by topic with worked solutions, or take a timed mock with a question palette and negative marking. Free, no AI, no account; progress stays in this browser.</p></section>${resume}
      <div class="apt-grid">
      <section class="panel drill-setup apt-setup"><h2>Topic practice</h2><p class="note">Instant feedback, a worked solution and a shortcut after every question.</p>
        <fieldset><legend>Section</legend><div class="apt-tabs" role="radiogroup">${A.SECTIONS.map(s => `<label class="drill-level"><input type="radio" name="aptSection" value="${s.id}" ${prefs.section === s.id ? 'checked' : ''}><span><b>${esc(s.title)}</b><small>${esc(s.short)}</small></span></label>`).join('')}</div></fieldset>
        <fieldset><legend>Topics</legend><div class="drill-chips apt-chips" id="aptTopics"></div><div class="drill-inline"><button type="button" id="aptAll">Select all</button><button type="button" id="aptNone">Clear</button></div></fieldset>
        <fieldset><legend>Difficulty</legend><div class="drill-levels apt-levels">${A.LEVELS.map(l => `<label class="drill-level"><input type="radio" name="aptLevel" value="${l.id}" ${prefs.level === l.id ? 'checked' : ''}><span><b>${l.title}</b><small>${l.note}</small></span></label>`).join('')}</div></fieldset>
        <div class="drill-options"><label for="aptCount">Questions<select id="aptCount">${COUNTS.map(n => `<option value="${n}" ${prefs.count === n ? 'selected' : ''}>${n} questions</option>`).join('')}</select></label>
        <label for="aptTarget">Target per question<select id="aptTarget">${TARGETS.map(([n, t]) => `<option value="${n}" ${prefs.target === n ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
        <div class="actions"><button class="primary" id="aptPractice">Start practice →</button><span id="aptPracticeStatus" class="note" role="status"></span></div></section>
      <section class="panel drill-setup apt-setup"><h2>Timed test</h2><p class="note">A placement-style mock: no feedback until you submit, and it submits itself when time runs out.</p>
        ${PRESETS.length ? `<fieldset class="apt-presets"><legend>Start from a typical pattern</legend><div class="apt-preset-list">${PRESETS.map(p => `<button type="button" class="apt-preset" data-preset="${esc(p.id)}" aria-describedby="aptPresetNote"><b>${esc(p.title)}</b><small>${esc(p.shape)}</small><small class="apt-preset-eg">e.g. ${esc(p.examples)}</small></button>`).join('')}</div>
        <p class="note" id="aptPresetNote" role="status">${esc(PRESET_NOTE)} Picking one fills in the settings below; you can still change them.</p></fieldset>` : ''}
        <fieldset><legend>Sections</legend><div class="apt-tabs">${A.SECTIONS.map(s => `<label class="drill-chip"><input type="checkbox" name="aptTestSection" value="${s.id}" ${prefs.sections.includes(s.id) ? 'checked' : ''}><span><b>${esc(s.title)}</b><small>${topicsIn(s.id).length} topics</small></span></label>`).join('')}</div></fieldset>
        <div class="drill-options apt-test-options"><label for="aptPer">Questions per section<select id="aptPer">${PER_SECTION.map(n => `<option value="${n}" ${prefs.perSection === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label for="aptTestLevel">Difficulty<select id="aptTestLevel">${LEVEL_OPTIONS.map(([id, t]) => `<option value="${id}" ${prefs.testLevel === id ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label for="aptPace">Time<select id="aptPace">${PACES.map(([n, t]) => `<option value="${n}" ${prefs.pace === n ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label for="aptNegative">Marking<select id="aptNegative">${NEGATIVES.map(([n, t], i) => `<option value="${i}" ${prefs.negative === n ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
        <fieldset><legend>Timer</legend><label class="selfcheck"><input type="radio" name="aptTiming" value="total" ${prefs.timing === 'total' ? 'checked' : ''}> One timer for the whole test; move freely between sections</label>
        <label class="selfcheck"><input type="radio" name="aptTiming" value="sectional" ${prefs.timing === 'sectional' ? 'checked' : ''}> A separate timer for each section; sections are locked once finished</label></fieldset>
        <div class="drill-options apt-test-options"><label for="aptNav">Moving between questions<select id="aptNav"><option value="free" ${prefs.nav === 'free' ? 'selected' : ''}>Move freely between questions</option><option value="forward" ${prefs.nav === 'forward' ? 'selected' : ''}>No going back to earlier questions</option></select></label></div>
        <label class="selfcheck apt-strict"><input type="checkbox" id="aptStrict" ${prefs.strict ? 'checked' : ''}><span><b>Exam conditions:</b> the clock does not pause, leaving the test is counted, and you guess your score before you see it</span></label>
        <p class="note" id="aptTestSummary"></p>
        <div class="actions"><button class="primary" id="aptTest">Start timed test →</button><span id="aptTestStatus" class="note" role="status"></span></div></section>
      <section class="panel drill-setup apt-setup apt-notices" id="aptNotices"><h2>My placement notice</h2><p class="note">Copy the sections, question counts, minutes and marking from your drive notice, and practise on exactly that pattern.</p>
        ${notices.length ? `<ul class="apt-notice-list">${notices.map(n => `<li><div class="apt-notice-info"><b>${esc(n.name)}</b><small>${esc(shapeOf(n))}</small>${n.source ? `<small class="apt-notice-source">Source: ${esc(n.source)}</small>` : ''}</div><div class="apt-notice-actions"><button class="primary" data-notice-start="${esc(n.id)}">Start</button><button data-notice-share="${esc(n.id)}">Share</button><button data-notice-edit="${esc(n.id)}">Edit</button><button data-notice-delete="${esc(n.id)}">Delete</button></div></li>`).join('')}</ul>` : '<p class="note">No notices saved yet.</p>'}
        <p class="note">You entered these settings yourself. Case Room has not checked them against any employer.</p>
        <div class="actions"><button id="aptNoticeNew">Set up a test from my notice</button></div></section>
      <section class="panel drill-setup apt-setup apt-papers" id="aptPapers"><h2>Shared papers</h2><p class="note">A teacher, friend or placement cell can share a paper, so everyone in a group gets the same questions and the same clock rules.</p>
        <label for="aptPaperCode">Have a paper code or link? Paste it here<input id="aptPaperCode" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="CR1.…"></label>
        <div class="actions"><button id="aptPaperOpen">Open the paper</button><button id="aptCollect">Collect results from a shared paper</button></div></section>
      <section class="panel en-callout"><div><div class="eyebrow">ALSO IN SOME ONLINE TESTS</div><h2>Spoken English</h2><p class="note">Read aloud, repeat sentences, quick answers and a one-minute talk, checked against what your browser hears.</p></div><button id="aptEnglish">Practise spoken English →</button></section>
      <section class="panel drill-stats apt-progress"><h2>Your progress</h2>${practised.length ? `<p class="note">Accuracy and median time per question, from your last 30 answered questions in each topic (practice and tests).</p>
        <table class="drill-table"><thead><tr><th scope="col">Topic</th><th scope="col">Accuracy</th><th scope="col">Median time</th></tr></thead><tbody>${practised.map(s => `<tr><th scope="row">${esc(s.title)}<small>${esc(sectionOf(s.section).title)} · ${s.attempts} answered</small></th><td><div class="drill-meter" aria-hidden="true"><span style="width:${Math.round(s.accuracy * 100)}%"></span></div>${percent(s.accuracy)}</td><td>${seconds(s.medianSeconds)}</td></tr>`).join('')}</tbody></table>
        ${weakMarkup(weak)}
        <h3>Recent attempts</h3><ul class="drill-recent">${history.slice(-6).reverse().map(h => `<li><span>${esc(new Date(h.at).toLocaleDateString())} · ${h.mode === 'test' ? 'Timed test' : 'Practice'}${h.mode === 'test' && str(h.name) && h.name ? ' · ' + esc(h.name) : ''}${h.strict === true ? ' · exam conditions' : ''}</span><b>${h.mode === 'test' ? `${marks(h.score)}/${h.total}` : `${h.correct}/${h.results.length}`}</b></li>`).join('')}</ul>
        <button id="aptClear" class="drill-link">Delete aptitude history</button>` : '<p class="note">Answer a few questions to see accuracy and speed for each topic, and which topic to practise next. Nothing leaves this browser.</p>'}
        <h3>About the questions</h3><p class="note">Quantitative and logical questions are generated in your browser, so there is always a fresh set; puzzle answers are checked by a solver. Verbal questions come from an original written bank. Wrong options are built from common mistakes, so read every option before you pick.</p></section></div>`;
    renderTopicChips();
    const checkedTopics = () => [...document.querySelectorAll('[name=aptTopic]:checked')].map(x => x.value);
    const testSections = () => [...document.querySelectorAll('[name=aptTestSection]:checked')].map(x => x.value);
    const remember = () => {
      const section = document.querySelector('[name=aptSection]:checked')?.value || prefs.section, topics = { ...prefs.topics };
      if (checkedTopics().length) topics[section] = checkedTopics();
      prefs = cleanPrefs({ ...prefs, section, topics, level: document.querySelector('[name=aptLevel]:checked')?.value, count: Number($('#aptCount').value), target: Number($('#aptTarget').value),
        sections: testSections().length ? testSections() : prefs.sections, perSection: Number($('#aptPer').value), testLevel: $('#aptTestLevel').value, pace: Number($('#aptPace').value),
        timing: document.querySelector('[name=aptTiming]:checked')?.value, negative: NEGATIVES[Number($('#aptNegative').value)]?.[0], strict: $('#aptStrict').checked, nav: $('#aptNav').value });
      save(PREFS_KEY, prefs); summary();
    };
    const summary = () => { const n = testSections().length * prefs.perSection; $('#aptTestSummary').textContent = n ? `${n} questions · ${Math.round(n * prefs.pace / 60)} minutes in all${prefs.timing === 'sectional' ? ` (${Math.round(prefs.perSection * prefs.pace / 60)} per section)` : ''} · negative marking ${negLabel(prefs.negative)}.${prefs.strict ? ' Exam conditions on.' : ''}` : 'Choose at least one section.'; };
    summary();
    document.querySelectorAll('[name=aptSection]').forEach(x => x.onchange = () => { prefs.section = x.value; save(PREFS_KEY, prefs); renderTopicChips(); });
    $('#aptAll').onclick = () => { document.querySelectorAll('[name=aptTopic]').forEach(x => x.checked = true); remember(); };
    $('#aptNone').onclick = () => document.querySelectorAll('[name=aptTopic]').forEach(x => x.checked = false);
    $('#aptTopics').addEventListener('change', () => { if (checkedTopics().length) remember(); });
    document.querySelectorAll('.apt-setup select, [name=aptLevel], [name=aptTiming], [name=aptTestSection], #aptStrict').forEach(x => x.addEventListener('change', remember));
    $('#aptPractice').onclick = () => {
      if (!checkedTopics().length) { $('#aptPracticeStatus').textContent = 'Choose at least one topic.'; return; }
      remember(); beginPractice(A.buildSet({ topics: prefs.topics[prefs.section], level: prefs.level, count: prefs.count, seed: Date.now() }), 'new', prefs.level);
    };
    document.querySelectorAll('.apt-preset').forEach(b => b.onclick = () => {
      const p = PRESETS.find(x => x.id === b.dataset.preset); if (!p) return;
      prefs = cleanPrefs({ ...prefs, ...p.settings }); save(PREFS_KEY, prefs); renderHome();
      $('#aptPresetNote').textContent = `Settings filled in for “${p.title}”. ${PRESET_NOTE}`;
      document.querySelector(`.apt-preset[data-preset="${p.id}"]`)?.classList.add('chosen'); $('#aptTest').focus();
    });
    $('#aptTest').onclick = () => {
      if (!testSections().length) { $('#aptTestStatus').textContent = 'Choose at least one section.'; return; }
      remember(); beginTest();
    };
    if ($('#aptResume')) $('#aptResume').onclick = () => { if (run.mode === 'test') renderTest(); else { if (!run.results[run.index]) run.qStarted = Date.now(); persist(); renderPractice(); } };
    if ($('#aptDiscard')) $('#aptDiscard').onclick = () => { if (!confirm('Discard this unfinished attempt? Its answers will not count towards your progress.')) return; run = null; persist(); renderHome(); };
    bindWeak(); bindNotices();
    $('#aptEnglish').onclick = () => EnglishTool.open();
    if ($('#aptClear')) $('#aptClear').onclick = () => { if (!confirm('Delete all aptitude practice and test history from this browser? This cannot be undone.')) return; history = []; save(HISTORY_KEY, history); renderHome(); };
  }
  function renderTopicChips() {
    $('#aptTopics').innerHTML = topicsIn(prefs.section).map(id => `<label class="drill-chip"><input type="checkbox" name="aptTopic" value="${id}" ${prefs.topics[prefs.section].includes(id) ? 'checked' : ''}><span><b>${esc(topicOf(id).title)}</b></span></label>`).join('');
  }
  const weakMarkup = weak => weak ? `<div class="drill-suggest"><p><b>Practise next: ${esc(weak.title)}</b><br><span class="note">${percent(weak.accuracy)} accuracy over your last ${weak.attempts} answers. ${esc(topicOf(weak.topic).tip)}</span></p><button id="aptWeak" data-topic="${weak.topic}">10 ${esc(weak.title.toLowerCase())} questions →</button></div>` : '';
  function bindWeak() { if ($('#aptWeak')) $('#aptWeak').onclick = e => beginPractice(A.buildSet({ topics: [e.currentTarget.dataset.topic], level: prefs.level, count: 10, seed: Date.now() }), 'weakest', prefs.level); }

  function replaceRun() { return !run || confirm('Replace your unfinished attempt? Its answers will not count towards your progress.'); }
  function beginPractice(questions, origin, level) {
    if (!replaceRun()) return;
    held = null; pending = null;
    run = { mode: 'practice', id: 'p' + Date.now().toString(36), origin, level, target: prefs.target, questions, results: questions.map(() => null), index: 0, started: Date.now(), qStarted: Date.now() };
    persist(); renderPractice();
  }
  function beginTest({ sections = prefs.sections, perSection = prefs.perSection } = {}) {
    if (prefs.strict) { // exam conditions: the brief comes first and nothing starts until the student presses Start
      return renderBrief({ kind: 'plain', name: '', questions: A.buildTest({ sections, perSection, level: prefs.testLevel, seed: Date.now() }), sections: sections.slice(), perSection, pace: prefs.pace, timing: prefs.timing, negative: prefs.negative, level: prefs.testLevel, nav: prefs.nav, strict: true, switchLimit: 0 });
    }
    if (!replaceRun()) return;
    startRun({ kind: 'plain', name: '', questions: A.buildTest({ sections, perSection, level: prefs.testLevel, seed: Date.now() }), sections: sections.slice(), perSection, pace: prefs.pace, timing: prefs.timing, negative: prefs.negative, level: prefs.testLevel, nav: prefs.nav, strict: false, switchLimit: 0 });
  }
  /* Starts the run for a test whose questions are already built. Budgets are explicit for notice and shared tests; otherwise perSection × pace. */
  function startRun(c) {
    const n = c.questions.length, now = Date.now();
    held = null; pending = null;
    run = { mode: 'test', id: 't' + now.toString(36), level: c.level, sections: c.sections.slice(), perSection: c.perSection, pace: c.pace, timing: c.timing, negative: c.negative,
      questions: c.questions, answers: Array(n).fill(null), marked: Array(n).fill(false), visited: Array(n).fill(false), seconds: Array(n).fill(0), index: 0, elapsed: 0, sectionIndex: 0, sectionElapsed: c.sections.map(() => 0), started: now };
    if (c.nav === 'forward' || c.strict || c.name) run.nav = c.nav === 'forward' ? 'forward' : 'free';
    if (c.sectionMs) { run.sectionMs = c.sectionMs.slice(); run.totalMs = c.totalMs; }
    if (c.name) run.name = c.name;
    if (c.paper) run.paper = { ...c.paper };
    if (c.strict) Object.assign(run, { strict: true, switchLimit: c.switchLimit || 0, clockAt: now, left: 0, awayMs: 0, away: false, ended: null });
    wasOnTest = !!c.strict; persist();
    if (c.strict) enterFullscreen();
    renderTest();
  }
  /* A fresh test from saved settings (notice, shared paper, or "same settings" after a result). */
  function testFrom(c, extra = {}) {
    const questions = A.buildTest({ sections: c.sections, counts: c.counts, perSection: c.perSection || 10, level: c.level, seed: extra.seed == null ? Date.now() : extra.seed });
    return { kind: 'notice', name: c.name, questions, sections: c.sections.slice(), perSection: c.perSection || Math.max(...Object.values(c.counts)), pace: c.pace || 60, timing: c.timing, negative: c.negative, level: c.level, nav: c.nav, strict: !!c.strict, switchLimit: c.switchLimit || 0,
      sectionMs: c.sectionMs, totalMs: c.totalMs, ...extra.more };
  }
  const needsBrief = c => c.strict || c.kind === 'notice' || c.kind === 'paper';
  function beginFrom(c) { const t = testFrom(c); if (needsBrief(t)) renderBrief(t); else if (replaceRun()) startRun(t); }
  /* Entry points for the next-round planner. They start straight away and leave saved preferences unchanged. */
  const ALL_SECTIONS = A.SECTIONS.map(s => s.id);
  /** A short practice set across the given sections, or on the weakest topic when there is enough history. */
  function quickPractice({ sections = ALL_SECTIONS, count = 10, weakest = false } = {}) {
    const weak = weakest ? A.weakest(A.summarise(history)) : null;
    const topics = weak ? [weak.topic] : A.TOPICS.filter(t => sections.includes(t.section)).map(t => t.id);
    setHash(true); beginPractice(A.buildSet({ topics, level: prefs.level, count, seed: Date.now() }), weak ? 'weakest' : 'plan', prefs.level);
  }
  /** A timed mock with the given sections and questions per section, at the student's saved pace and marking. */
  function quickTest({ sections = ALL_SECTIONS, perSection = 10 } = {}) {
    setHash(true); beginTest({ sections: ALL_SECTIONS.filter(s => sections.includes(s)), perSection: PER_SECTION.includes(perSection) ? perSection : 10 });
  }

  /* ---------- Topic practice ---------- */
  function renderPractice() {
    if (!run || run.mode !== 'practice') return renderHome();
    stopMedia(); view = 'aptitude'; screen = 'practice';
    const q = run.questions[run.index], r = run.results[run.index], last = run.index === run.questions.length - 1, done = run.results.filter(Boolean).length;
    if (!r) window.scrollTo(0, 0);
    $('#app').innerHTML = `<div class="row"><div><div class="eyebrow">TOPIC PRACTICE · ${esc(levelTitle(run.level).toUpperCase())}</div><h2 class="section-title">Question ${run.index + 1} of ${run.questions.length}</h2></div><div class="flow-head-side"><span class="badge" id="aptTimer" aria-live="off">${r ? seconds(r.seconds) : '0s'}</span><button class="wu-link" id="aptExit">Exit · progress is saved</button></div></div>
      <div class="drill-bar" aria-hidden="true"><span style="width:${Math.round(done / run.questions.length * 100)}%"></span></div>
      <section class="panel apt-card"><div class="eyebrow">${esc(sectionOf(q.section).title)} · ${esc(topicOf(q.topic).title)}</div>${stem(q)}
      ${optionsMarkup(q, r ? r.choice : null, !!r)}
      ${r ? `<div class="drill-feedback ${r.ok ? 'ok' : 'miss'}" id="aptFeedback" role="status"><h3>${r.ok ? '✓ Correct' : r.choice == null ? 'Worked solution' : '✗ Not quite'}</h3>
        <p>${r.choice == null ? '' : `You chose <b>${LETTERS[r.choice]}. ${esc(q.options[r.choice])}</b>. `}The answer is <b>${LETTERS[q.answer]}. ${esc(q.display)}</b>.${r.choice == null ? '' : ` Time: ${seconds(r.seconds)}${run.target && r.seconds > run.target ? ` · over your ${run.target}s target` : ''}.`}</p>
        ${solutionMarkup(q)}</div>` : ''}
      ${flowBar({ back: `${r ? '' : '<button class="wu-link" id="aptReveal">Show the solution</button>'}<button class="wu-link" id="aptEnd">End practice now</button>`,
        primary: `<button class="primary next" id="aptNext">${last ? 'See results →' : 'Next question →'}</button>`, hint: r ? '' : 'Choose an answer to check it.' })}</section>`;
    document.querySelectorAll('.apt-option:not([disabled])').forEach(b => b.onclick = () => recordPractice(Number(b.dataset.opt)));
    if ($('#aptReveal')) $('#aptReveal').onclick = () => recordPractice(null);
    $('#aptNext').onclick = () => r ? nextPractice() : nudge('Choose an answer first, or show the solution.', '.apt-option');
    if (r) $('#aptNext').focus({ preventScroll: true });
    $('#aptExit').onclick = renderHome;
    $('#aptEnd').onclick = () => {
      if (!run.results.some(Boolean)) { if (confirm('End this practice? Nothing has been answered, so nothing will be saved.')) { run = null; persist(); renderHome(); } return; }
      if (confirm('End practice now? Answered questions will count towards your progress.')) finishPractice();
    };
  }
  function recordPractice(choice) {
    const q = run.questions[run.index];
    run.results[run.index] = { choice, ok: choice === q.answer, seconds: Math.round((Date.now() - (run.qStarted || Date.now())) / 100) / 10 };
    persist(); renderPractice();
  }
  function nextPractice() {
    if (run.index >= run.questions.length - 1) return finishPractice();
    run.index++; run.qStarted = Date.now(); persist(); renderPractice();
  }
  function finishPractice() {
    const results = run.questions.map((q, i) => ({ q, r: run.results[i] })).filter(x => x.r);
    const entry = { id: run.id, at: Date.now(), mode: 'practice', origin: run.origin, level: run.level, correct: results.filter(x => x.r.ok).length, total: results.length,
      results: results.map(({ q, r }) => ({ topic: q.topic, ok: r.ok, answered: true, seconds: r.choice == null ? null : r.seconds })) };
    record(entry, { mode: 'practice', level: run.level, target: run.target, items: results.map(({ q, r }) => ({ q, choice: r.choice, seconds: r.seconds })) });
  }

  /* ---------- Timed test ---------- */
  const secMsOf = r => Array.isArray(r.sectionMs) ? r.sectionMs : r.sections.map(() => r.perSection * r.pace * 1000);
  const totMsOf = r => fin(r.totalMs) ? r.totalMs : r.questions.length * r.pace * 1000;
  const budgetMs = () => run.timing === 'sectional' ? secMsOf(run)[run.sectionIndex] : totMsOf(run);
  const remainingMs = () => Math.max(0, budgetMs() - (run.timing === 'sectional' ? run.sectionElapsed[run.sectionIndex] : run.elapsed));
  const sectionRange = s => { const idx = run.questions.map((q, i) => q.section === s ? i : -1).filter(i => i >= 0); return [idx[0], idx[idx.length - 1]]; };
  const visible = () => run.timing === 'sectional' ? (([a, b]) => run.questions.map((_, i) => i).filter(i => i >= a && i <= b))(sectionRange(run.sections[run.sectionIndex])) : run.questions.map((_, i) => i);
  function paletteState(i) { const a = run.answers[i] != null; return run.marked[i] ? (a ? 'marked answered' : 'marked') : a ? 'answered' : run.visited[i] ? 'skipped' : 'fresh'; }
  function counts(list) {
    const c = { answered: 0, skipped: 0, marked: 0, fresh: 0 };
    for (const i of list) { if (run.marked[i]) c.marked++; if (run.answers[i] != null) c.answered++; else if (run.visited[i]) c.skipped++; else c.fresh++; }
    return c;
  }
  function renderTest() {
    if (!run || run.mode !== 'test') return renderHome();
    if (exam()) { // coming back to a test whose clock kept running: bring it up to date first, which can end a section or the whole test
      const away = !onScreen(), from = away && fin(run.awaySec) ? run.awaySec : run.sectionIndex;
      if (afterAccount(account(Date.now()), away, from)) return;
      run.away = false; delete run.awaySec; wasOnTest = true;
    }
    stopMedia(); view = 'aptitude'; screen = 'test'; if (lastTick == null) lastTick = Date.now();
    const fwd = run.nav === 'forward', ex = exam();
    const i = run.index, q = run.questions[i], list = visible(), pos = list.indexOf(i), sec = run.sections[run.sectionIndex], lastSection = run.sectionIndex === run.sections.length - 1;
    run.visited[i] = true; persist();
    const c = counts(list), groups = run.timing === 'sectional' ? [[sec, list]] : run.sections.map(s => [s, list.filter(j => run.questions[j].section === s)]);
    const atEnd = pos === list.length - 1;
    $('#app').innerHTML = `<div class="apt-testbar"><div><div class="eyebrow">${run.name ? esc(run.name.toUpperCase()) : 'TIMED TEST'} · ${esc(sectionOf(q.section).title.toUpperCase())}${run.timing === 'sectional' ? ` · SECTION ${run.sectionIndex + 1} OF ${run.sections.length}` : ''}</div><h2 class="section-title">Question ${i + 1} of ${run.questions.length}</h2></div>
        <span class="badge apt-clock" id="aptClock" role="timer" aria-live="off">${clock(Math.ceil(remainingMs() / 1000))} left</span></div>
      ${ex && run.left > 0 ? `<p class="apt-left-note" id="aptLeftNote" role="status">${leftNote()}</p>` : ''}
      <div class="apt-test">
      <section class="panel apt-card">${stem(q)}${optionsMarkup(q, run.answers[i], false)}
        <div class="apt-test-actions">${fwd ? '' : `<button id="aptPrev" ${pos === 0 ? 'disabled' : ''}>← Previous</button><button id="aptMark" aria-pressed="${run.marked[i]}">${run.marked[i] ? '★ Marked for review' : '☆ Mark for review'}</button>`}<button id="aptClearAns" ${run.answers[i] == null ? 'disabled' : ''}>Clear response</button><button class="primary" id="aptNextQ" ${atEnd ? 'disabled' : ''}>${fwd ? 'Save & next → (no going back)' : 'Save & next →'}</button></div></section>
      <aside class="panel apt-palette" aria-label="Question palette"><h3>Question palette</h3>
        <ul class="apt-legend"><li><span class="apt-dot answered"></span>Answered ${c.answered}</li><li><span class="apt-dot skipped"></span>Not answered ${c.skipped}</li><li><span class="apt-dot fresh"></span>Not visited ${c.fresh}</li><li><span class="apt-dot marked"></span>Marked ${c.marked}</li></ul>
        ${groups.map(([s, idx]) => `<div class="apt-palette-group"><b>${esc(sectionOf(s).title)}</b><div class="apt-pal">${idx.map(j => `<button class="apt-pal-btn ${paletteState(j)}${j === i ? ' current' : ''}" data-go="${j}" ${fwd && j < i ? 'disabled' : ''} aria-label="Question ${j + 1}: ${paletteState(j).replace('fresh', 'not visited').replace('skipped', 'not answered').replace('marked answered', 'answered and marked for review').replace(/^marked$/, 'marked for review')}"${j === i ? ' aria-current="true"' : ''}>${j + 1}</button>`).join('')}</div></div>`).join('')}
        <p class="note">${fwd ? 'You cannot go back to earlier questions.' : 'Answers marked for review still count if they are answered.'} Negative marking: ${negLabel(run.negative)}.</p>
        <div class="apt-submit">${run.timing === 'sectional' && !lastSection ? `<button class="primary" id="aptFinishSection">Finish ${esc(sectionOf(sec).title)} section →</button>` : '<button class="primary" id="aptSubmit">Submit test</button>'}${ex ? '<p class="note" id="aptExamNote">Exam conditions: the clock does not pause.</p>' : '<button id="aptPause">Save & exit (pauses the clock)</button>'}</div></aside></div>`;
    document.querySelectorAll('.apt-option').forEach(b => b.onclick = () => { run.answers[i] = Number(b.dataset.opt); persist(); renderTest(); });
    if ($('#aptPrev')) $('#aptPrev').onclick = () => go(list[pos - 1]);
    $('#aptNextQ').onclick = () => go(list[pos + 1]);
    if ($('#aptMark')) $('#aptMark').onclick = () => { run.marked[i] = !run.marked[i]; persist(); renderTest(); };
    $('#aptClearAns').onclick = () => { run.answers[i] = null; persist(); renderTest(); };
    document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(Number(b.dataset.go)));
    if ($('#aptSubmit')) $('#aptSubmit').onclick = () => { const all = counts(run.questions.map((_, j) => j)); if (confirm(`Submit the test? ${run.questions.length - all.answered} unanswered${all.marked ? `, ${all.marked} marked for review` : ''}. You cannot change answers afterwards.`)) submitTest(false); };
    if ($('#aptFinishSection')) $('#aptFinishSection').onclick = () => { const u = list.filter(j => run.answers[j] == null).length; if (confirm(`Finish the ${sectionOf(sec).title} section? ${u} unanswered. You cannot return to it.`)) nextSection(); };
    if ($('#aptPause')) $('#aptPause').onclick = () => { tick(); renderHome(); };
  }
  function go(j) {
    if (!Number.isInteger(j) || !visible().includes(j) || (run.nav === 'forward' && j < run.index)) return;
    tick(); if (!run || run.mode !== 'test') return;
    run.index = j; persist(); renderTest(); window.scrollTo(0, 0);
  }
  function nextSection() {
    if (exam() && syncExam()) return;
    run.sectionIndex++; run.index = sectionRange(run.sections[run.sectionIndex])[0]; persist(); renderTest(); window.scrollTo(0, 0);
  }
  /* The history entry and the result for a finished test run. Pure apart from the time stamp; also used to rebuild the result after a reload. */
  function makeResult(r, auto, ended) {
    const s = A.score(r.questions, r.answers, r.negative);
    const entry = { id: r.id, at: Date.now(), mode: 'test', level: r.level, sections: r.sections, perSection: r.perSection, pace: r.pace, timing: r.timing, negative: r.negative, auto: !!auto,
      score: s.score, correct: s.correct, wrong: s.wrong, unanswered: s.unanswered, total: s.total, elapsed: Math.round(r.elapsed / 1000),
      results: r.questions.map((q, i) => ({ topic: q.topic, ok: r.answers[i] === q.answer, answered: r.answers[i] != null, visited: !!r.visited[i], seconds: Math.round(r.seconds[i] * 10) / 10 })) };
    const res = { mode: 'test', auto: !!auto, level: r.level, sections: r.sections, perSection: r.perSection, negative: r.negative, timing: r.timing, pace: r.pace, elapsed: r.elapsed, score: s,
      items: r.questions.map((q, i) => ({ q, choice: r.answers[i], seconds: r.seconds[i], marked: r.marked[i], visited: !!r.visited[i] })) };
    if (r.name) { entry.name = r.name; res.name = r.name; }
    if (r.paper) res.paper = { ...r.paper };
    if (r.strict) {
      entry.strict = true; entry.left = r.left || 0; if (ended) entry.ended = ended;
      Object.assign(res, { strict: true, left: r.left || 0, awayMs: r.awayMs || 0, ended: ended || null, switchLimit: r.switchLimit || 0 });
    }
    if (r.strict || r.name || r.sectionMs || r.nav === 'forward') {
      const counts = {}; for (const id of r.sections) counts[id] = r.questions.filter(q => q.section === id).length;
      res.cfg = { name: r.name || '', sections: r.sections.slice(), counts, perSection: r.perSection, pace: r.pace, timing: r.timing, negative: r.negative, level: r.level, nav: r.nav || 'free', strict: !!r.strict, switchLimit: r.switchLimit || 0, sectionMs: r.sectionMs, totalMs: r.totalMs };
    }
    return { entry, res };
  }
  function submitTest(auto, ended = null) {
    lastTick = null;
    if (exam() && !auto) account(Date.now());
    const r = run, { entry, res } = makeResult(r, auto, ended);
    if (!r.strict) return record(entry, res);
    res.entry = entry;
    /* Exam conditions: the result is saved first, so a reload cannot lose it. The run stays in storage, marked done, until the student has seen the result. */
    history.push(entry); history = history.slice(-MAX_HISTORY); save(HISTORY_KEY, history);
    held = { ...r, done: true, away: false, ended }; delete held.awaySec; run = null; wasOnTest = false; save(RUN_KEY, held);
    exitFullscreen(); lastResult = res; pending = { res, ask: true };
    if (view === 'aptitude') renderPredict(res);
  }
  function timeUp() {
    if (run.timing === 'sectional' && run.sectionIndex < run.sections.length - 1) {
      const done = sectionOf(run.sections[run.sectionIndex]).title; nextSection(); toast(`Time is up for ${done}. On to ${sectionOf(run.sections[run.sectionIndex]).title}.`);
    } else { toast('Time is up. Your test has been submitted.'); submitTest(true); }
  }
  function pause() {
    if (exam()) { if (wasOnTest && onTest()) leave('navigate'); return; }
    if (run && run.mode === 'test' && lastTick != null) { tick(); persist(); } lastTick = null;
  }
  /* Runs every half second. Without exam conditions the clock only counts while the test is on screen; leaving the test or the page pauses it. */
  function tick() {
    if (exam()) return tickExam();
    const now = Date.now();
    if (!run || run.mode !== 'test' || view !== 'aptitude' || screen !== 'test') { if (lastTick != null && run && run.mode === 'test') persist(); lastTick = null; return; }
    if (lastTick == null) { lastTick = now; return; }
    const d = Math.max(0, now - lastTick); lastTick = now;
    run.elapsed += d; run.seconds[run.index] += d / 1000; run.sectionElapsed[run.sectionIndex] += d;
    if (remainingMs() <= 0) { timeUp(); return; }
    const left = Math.ceil(remainingMs() / 1000), el = $('#aptClock');
    if (el) { el.textContent = `${clock(left)} left`; el.classList.toggle('low', left <= 60); }
    if (++ticks % 10 === 0) persist();
  }

  /* ---------- Exam conditions: a clock that does not pause ---------- */
  /* Time is real time from the moment the test starts. Every tick, and every time the test is resumed or the tool is opened, the time since run.clockAt
     is added through AptitudeExam.advance. Time spent on the test screen goes to the current question; time away goes to run.awayMs. */
  const exam = () => !!run && run.mode === 'test' && run.strict === true;
  const onTest = () => view === 'aptitude' && screen === 'test';
  const onScreen = () => exam() && wasOnTest && !run.away && onTest();
  function account(now) {
    const before = run.sectionIndex, gap = now - run.clockAt;
    const r = E.advance({ timing: run.timing, sectionMs: secMsOf(run), totalMs: totMsOf(run), sectionIndex: run.sectionIndex, sectionElapsed: run.sectionElapsed, elapsed: run.elapsed }, gap > 0 ? gap : 0);
    const used = r.elapsed - run.elapsed;
    if (onScreen()) run.seconds[run.index] += used / 1000; else run.awayMs = (run.awayMs || 0) + used;
    run.elapsed = r.elapsed; run.sectionElapsed = r.sectionElapsed; if (gap > 0) run.clockAt = now; // if the device clock went backwards, time waits until it catches up; it is never given back
    if (r.sectionIndex !== before) { run.sectionIndex = r.sectionIndex; run.index = sectionRange(run.sections[r.sectionIndex])[0]; }
    return { over: r.over, before };
  }
  const titles = (a, b) => run.sections.slice(a, b).map(s => sectionOf(s).title).join(' and ');
  /* After the clock moved: submit if the time is over, or say which section ended. Returns true when the test was submitted. */
  function afterAccount(r, wasAway, from) {
    if (r.over) { toast(wasAway ? 'Time ran out while you were away. Your test was submitted.' : 'Time is up. Your test has been submitted.'); submitTest(true, 'time'); return true; }
    if (run.timing === 'sectional' && run.sectionIndex > from) {
      const done = titles(from, run.sectionIndex), now = sectionOf(run.sections[run.sectionIndex]).title;
      toast(wasAway ? `Time ran out for ${done} while you were away. You are now in ${now}.` : `Time is up for ${done}. On to ${now}.`);
      if (wasAway) run.awaySec = run.sectionIndex;
    }
    return false;
  }
  const syncExam = () => { const from = run.sectionIndex; return afterAccount(account(Date.now()), false, from); };
  const syncAway = () => { const from = fin(run.awaySec) ? run.awaySec : run.sectionIndex; return afterAccount(account(Date.now()), true, from); };
  const times = n => `${n} ${n === 1 ? 'time' : 'times'}`;
  function leftNote() {
    const more = run.switchLimit ? ` You can leave ${Math.max(0, run.switchLimit - run.left)} more ${run.switchLimit - run.left === 1 ? 'time' : 'times'} before the test is submitted.` : '';
    return `You left the test ${times(run.left)}, ${clock(Math.round(run.awayMs / 1000))} away in total. The clock kept running.${more}`;
  }
  /* One absence is counted once: the first of hidden tab, page hide, another screen or leaving full screen. Coming back (renderTest) ends it. */
  function leave(reason) {
    if (!exam() || run.away || !wasOnTest) return;
    if (reason === 'fullscreen' && (!onTest() || document.visibilityState === 'hidden')) return;
    const from = run.sectionIndex;
    if (afterAccount(account(Date.now()), false, from)) return;
    run.left = (run.left || 0) + 1;
    if (reason !== 'fullscreen') { run.away = true; run.awaySec = run.sectionIndex; wasOnTest = false; }
    persist();
    if (run.switchLimit && run.left >= run.switchLimit) { toast(`You left the test ${times(run.left)}. Your test was submitted.`); submitTest(true, 'switches'); }
  }
  function tickExam() {
    if (wasOnTest && !run.away && !onTest()) { leave('navigate'); if (!exam()) return; }
    const was = onScreen(), from = run.sectionIndex, r = account(Date.now());
    if (was && (r.over || run.sectionIndex > from)) { if (!afterAccount(r, false, from)) renderTest(); return; }
    if (r.over && screen === 'home' && view === 'aptitude' && document.visibilityState !== 'hidden') { syncAway(); return; } // time ran out while the student was on the aptitude home
    const left = Math.ceil(remainingMs() / 1000), el = was ? $('#aptClock') : $('#aptExamLeft');
    if (el) { el.textContent = `${clock(left)} left`; if (was) el.classList.toggle('low', left <= 60); }
    if (++ticks % 10 === 0) persist();
  }
  function enterFullscreen() { // not every browser or phone allows it, and the test never depends on it
    try { const el = document.documentElement, p = el.requestFullscreen && el.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ }
  }
  function exitFullscreen() {
    try { const p = document.fullscreenElement && document.exitFullscreen && document.exitFullscreen(); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ }
  }

  /* ---------- Results ---------- */
  function record(entry, res) {
    history.push(entry); history = history.slice(-MAX_HISTORY); save(HISTORY_KEY, history);
    run = null; persist(); lastResult = { ...res, entry }; renderResults(lastResult);
  }
  function tally(res) {
    const t = { right: 0, wrong: 0, skipped: 0, unreached: 0 };
    for (const x of res.items) t[A.outcome(x, res.mode)]++;
    return t;
  }
  const unansweredLabel = o => o === 'unreached' ? 'Not reached' : o === 'skipped' ? 'Skipped' : 'Not answered';
  function summaryText(res) {
    const e = res.entry, tl = tally(res), head = res.mode === 'test'
      ? `${res.name ? esc0(res.name) + ' · ' : ''}Timed test · ${levelTitle(res.level)} · ${res.timing === 'sectional' ? 'sectional timer' : 'one timer'} · negative marking ${negLabel(res.negative)}${res.auto ? (res.ended === 'switches' ? ' · auto-submitted after leaving the test too often' : ' · auto-submitted when time ran out') : ''}\nScore: ${marks(e.score)} / ${e.total} (${tl.right} correct, ${tl.wrong} wrong, ${tl.skipped} skipped, ${tl.unreached} not reached)\nTime used: ${clock(Math.round(res.elapsed / 1000))}${examLines(res).length ? '\n' + examLines(res).join('\n') : ''}`
      : `Topic practice · ${levelTitle(res.level)}\nScore: ${e.correct} / ${e.total}`;
    return `CASE ROOM — PLACEMENT APTITUDE\n${new Date(e.at).toLocaleString()}\n${head}\n\n` + res.items.map(({ q, choice, seconds: t, visited }, i) =>
      `${i + 1}. [${sectionOf(q.section).title} · ${topicOf(q.topic).title}]${q.passage ? ` (passage: ${q.passage.title})` : ''}\n${q.prompt}\n${q.options.map((o, j) => `   ${LETTERS[j]}. ${o}`).join('\n')}\n   ${choice == null ? unansweredLabel(res.mode === 'test' ? A.outcome({ q, choice, seconds: t, visited }, 'test') : 'wrong') : `You chose ${LETTERS[choice]} — ${choice === q.answer ? 'correct' : 'incorrect'}`} · time ${seconds(t)}\n   Answer: ${LETTERS[q.answer]}. ${q.display}\n   Solution: ${q.solution.join(' → ')}`).join('\n\n') + '\n';
  }
  const esc0 = x => String(x).replace(/[\r\n]+/g, ' ');
  /* The exam-conditions lines shown on the results screen and in the text download. */
  function examLines(res) {
    if (!res.strict) return [];
    const out = [], n = res.left || 0;
    out.push('Exam conditions: the clock did not pause.');
    if (typeof res.guess === 'number') out.push(`You guessed ${res.guess} right. You got ${res.entry.correct}.`); else if (res.guess === null) out.push('You skipped the guess.');
    out.push(n ? `You left the test ${times(n)}, ${clock(Math.round((res.awayMs || 0) / 1000))} away in total.` : 'You did not leave the test.');
    out.push(res.ended === 'time' ? 'The test was submitted because time ran out.' : res.ended === 'switches' ? `The test ended after you left it ${times(res.switchLimit || n)}.` : 'You submitted the test yourself.');
    return out;
  }
  function renderResults(res) {
    pause(); stopMedia(); view = 'aptitude'; screen = 'results'; window.scrollTo(0, 0);
    const e = res.entry, items = res.items, answered = items.filter(x => x.choice != null), tl = tally(res), isTest = res.mode === 'test',
      wrongOnes = items.filter(x => A.outcome(x, res.mode) === 'wrong'), leftOnes = items.filter(x => ['skipped', 'unreached'].includes(A.outcome(x, res.mode))), toReview = wrongOnes.length + leftOnes.length;
    const times = answered.map(x => x.seconds).filter(fin), avg = times.length ? times.reduce((s, x) => s + x, 0) / times.length : null;
    const byTopic = A.TOPICS.map(t => ({ t, list: items.filter(x => x.q.topic === t.id) })).filter(x => x.list.length);
    const weak = A.weakest(A.summarise(history));
    const headline = res.mode === 'test' ? `Score ${marks(e.score)} / ${e.total}` : `${e.correct} of ${e.total} correct`;
    $('#app').innerHTML = `<div class="eyebrow">${res.mode === 'test' ? `TEST SUBMITTED${res.auto ? (res.ended === 'switches' ? ' · ENDED AFTER LEAVING THE TEST' : ' · TIME RAN OUT') : ''}` : 'PRACTICE COMPLETE'} · ${esc(levelTitle(res.level).toUpperCase())}</div><h1 class="drill-title" id="aptHeadline">${headline}</h1>
      ${res.mode === 'test' ? `<p class="note">${e.correct} correct × 1${res.negative ? ` − ${e.wrong} wrong × ${negLabel(res.negative).slice(1)}` : ''} = ${marks(e.score)}. Unanswered questions score 0.</p>` : ''}
      <div class="score-grid"><div><div class="metric">${percent(answered.length ? answered.filter(x => x.choice === x.q.answer).length / answered.length : null)}</div><span class="note">Accuracy (of attempted)</span></div><div><div class="metric">${answered.length}/${items.length}</div><span class="note">Attempted</span></div><div><div class="metric">${seconds(avg)}</div><span class="note">Average time per attempted question</span></div><div><div class="metric">${isTest ? clock(Math.round(res.elapsed / 1000)) : toReview}</div><span class="note">${isTest ? 'Time used' : 'To review'}</span></div></div>
      ${isTest ? `<div class="score-grid" id="aptCounts"><div><div class="metric" id="aptCntRight">${tl.right}</div><span class="note">Correct</span></div><div><div class="metric" id="aptCntWrong">${tl.wrong}</div><span class="note">Wrong</span></div><div><div class="metric" id="aptCntSkipped">${tl.skipped}</div><span class="note">Skipped (seen, not answered)</span></div><div><div class="metric" id="aptCntUnreached">${tl.unreached}</div><span class="note">Not reached</span></div></div>` : ''}
      ${res.strict ? `<section class="panel apt-exam" id="aptExam"><h2>Exam conditions</h2>${examLines(res).slice(1).map(l => `<p>${esc(l)}</p>`).join('')}</section>` : ''}
      ${res.paper ? sendMarkup(res) : ''}
      <section class="panel drill-results apt-results"><h2>By topic</h2><div class="apt-table-wrap"><table class="drill-table"><thead><tr><th scope="col">Topic</th><th scope="col">Accuracy (of attempted)</th><th scope="col">Attempted</th><th scope="col">Avg time per attempted</th></tr></thead><tbody>${byTopic.map(({ t, list }) => { const att = list.filter(x => x.choice != null), right = att.filter(x => x.choice === x.q.answer).length, ts = att.map(x => x.seconds).filter(fin); return `<tr><th scope="row">${esc(t.title)}<small>${esc(sectionOf(t.section).title)}</small></th><td>${att.length ? `${right}/${att.length} (${percent(right / att.length)})` : '—'}</td><td>${att.length} of ${list.length}</td><td>${seconds(ts.length ? ts.reduce((s, x) => s + x, 0) / ts.length : null)}</td></tr>`; }).join('')}</tbody></table></div>
      ${weakMarkup(weak)}
      <h2>Every question</h2>${items.map(({ q, choice, seconds: t, marked, visited }, i) => { const ok = choice === q.answer; return `<details class="drill-review ${ok ? 'ok' : 'miss'}" ${ok ? '' : 'open'}><summary><span>${ok ? '✓' : choice == null ? '–' : '✗'}</span> ${i + 1}. ${esc(topicOf(q.topic).title)}${marked ? ' ★' : ''} <small class="note">${seconds(t)}</small></summary>
        ${q.passage ? passageMarkup(q.passage, false) : ''}${q.table ? tableMarkup(q.table) : ''}${q.chart ? chartMarkup(q.chart) : ''}<p class="apt-prompt">${esc(q.prompt)}</p>${optionsMarkup(q, choice, true)}
        <p>${choice == null ? unansweredLabel(isTest ? A.outcome({ q, choice, seconds: t, visited }, 'test') : 'wrong') + '.' : `You chose <b>${LETTERS[choice]}</b>.`} Answer: <b>${LETTERS[q.answer]}. ${esc(q.display)}</b></p>${solutionMarkup(q)}</details>`; }).join('')}
      <div class="actions">${wrongOnes.length ? `<button class="primary" id="aptRetry">Retry the ${wrongOnes.length} I got wrong</button>` : ''}${leftOnes.length ? `<button ${wrongOnes.length ? '' : 'class="primary"'} id="aptLeft">Attempt the ${leftOnes.length} I left unanswered</button>` : ''}<button ${wrongOnes.length || leftOnes.length ? '' : 'class="primary"'} id="aptAgain">${res.mode === 'test' ? 'New test, same settings' : 'New practice, same settings'}</button><button id="aptBack">Aptitude home</button><button id="aptDownload">Download summary</button></div></section>`;
    const retrySet = list => beginPractice(list.map(x => JSON.parse(JSON.stringify(x.q))), 'retry', A.MIXES[res.level] ? A.MIXES[res.level][1] : res.level);
    if ($('#aptRetry')) $('#aptRetry').onclick = () => retrySet(wrongOnes);
    if ($('#aptLeft')) $('#aptLeft').onclick = () => retrySet(leftOnes);
    $('#aptAgain').onclick = () => res.mode === 'test' ? (res.cfg ? beginFrom(res.cfg) : beginTest(res.sections ? { sections: res.sections, perSection: res.perSection } : {})) : beginPractice(A.buildSet({ topics: prefs.topics[prefs.section], level: prefs.level, count: prefs.count, seed: Date.now() }), 'new', prefs.level);
    $('#aptBack').onclick = renderHome;
    $('#aptDownload').onclick = () => download(summaryText(res), `case-room-aptitude-${new Date(e.at).toISOString().slice(0, 10)}.txt`);
    bindWeak(); if (res.paper) bindSend(res);
  }

  /* ---------- Brief, guess, notices, shared papers and collecting results ---------- */
  const mins = ms => Math.round(ms / 6000) / 10;
  const markingText = n => n ? `+1 for each correct answer, −${negLabel(n).slice(1)} for each wrong one` : 'No negative marking: +1 for each correct answer';
  function renderBrief(c) {
    enter('brief'); brief = c;
    const shared = c.kind === 'paper', ms = c.sectionMs || c.sections.map(() => c.perSection * c.pace * 1000), total = c.totalMs != null ? c.totalMs : c.timing === 'sectional' ? ms.reduce((a, b) => a + b, 0) : c.questions.length * c.pace * 1000;
    const rules = c.strict ? [
      'The clock does not pause. It keeps running if you switch tab, leave the test or close the page.',
      c.switchLimit ? `Leaving the test is counted, and the test is submitted if you leave it ${c.switchLimit} times.` : 'Leaving the test is counted and shown to you afterwards.',
      'There is no feedback until you submit. The test submits itself when time runs out.',
      'If your browser allows it, the test asks for full screen. Leaving full screen counts as leaving the test, but the test does not need it.',
      'You will be asked to guess your score before you see it.'
    ] : ['You can save and exit; the clock pauses while you are away.', 'There is no feedback until you submit. The test submits itself when time runs out.'];
    $('#app').innerHTML = `<div class="eyebrow">${shared ? 'SHARED PAPER' : 'BEFORE YOU START'}</div><h1 class="drill-title">${shared ? 'Shared paper' : esc(c.name || 'Timed test')}</h1>${shared ? `<p class="lead apt-brief-name">${esc(c.name)}</p>` : ''}
      ${shared && !c.paper.match ? `<p class="apt-warn" id="aptMismatch" role="alert"><b>Different questions.</b> This copy of the site generates different questions from the organiser's, so results will not be comparable with theirs. You can still take the test. Your result line carries its own check value, so it will be listed apart from theirs.</p>` : ''}
      <section class="panel apt-brief" id="aptBrief"><div class="apt-table-wrap"><table class="apt-data"><caption>${c.strict ? 'Exam conditions' : 'Test'}: what to expect</caption><thead><tr><th scope="col">Section</th><th scope="col">Questions</th><th scope="col">Minutes</th></tr></thead><tbody>${c.sections.map((id, i) => `<tr><th scope="row">${esc(sectionOf(id).title)}</th><td>${c.questions.filter(q => q.section === id).length}</td><td>${c.timing === 'sectional' ? mins(ms[i]) : '—'}</td></tr>`).join('')}<tr><th scope="row">${c.timing === 'sectional' ? 'Whole test' : 'One clock for the whole test'}</th><td>${c.questions.length}</td><td>${mins(total)}</td></tr></tbody></table></div>
        <dl class="apt-facts"><dt>Marking</dt><dd>${esc(markingText(c.negative))}</dd><dt>Timer</dt><dd>${c.timing === 'sectional' ? 'A separate clock for each section; a finished section is locked' : 'One clock for the whole test; move between sections as you like'}</dd><dt>Questions</dt><dd>${c.nav === 'forward' ? 'No going back to earlier questions' : 'Move freely between questions'}</dd><dt>Difficulty</dt><dd>${esc(levelTitle(c.level))}</dd></dl>
        <h2>Rules</h2><ul class="apt-rules">${rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        ${shared ? '<label for="aptName">Your name, for the result line<input id="aptName" type="text" maxlength="40" autocomplete="off"></label>' : ''}
        <div class="actions"><button class="primary" id="aptBegin">Start the test →</button><button id="aptBriefBack">Back</button></div><p class="note">The clock ${c.strict ? 'starts' : 'starts when you'} ${c.strict ? 'when you press Start.' : 'press Start.'}</p></section>`;
    $('#aptBegin').onclick = () => {
      if (!replaceRun()) return;
      const start = { ...c }; if (shared) { const name = $('#aptName').value.trim().slice(0, 40); start.paper = { ...c.paper }; if (name) start.paper.player = name; }
      brief = null; startRun(start);
    };
    $('#aptBriefBack').onclick = () => { brief = null; renderHome(); };
  }
  function renderPredict(res) {
    pending = { res, ask: true }; view = 'aptitude'; screen = 'predict'; stopMedia(); window.scrollTo(0, 0);
    const n = res.entry.total;
    $('#app').innerHTML = `<div class="eyebrow">TEST SUBMITTED${res.auto ? (res.ended === 'switches' ? ' · ENDED AFTER LEAVING THE TEST' : ' · TIME RAN OUT') : ''}</div><h1 class="drill-title">Before you see your score</h1>
      <section class="panel apt-predict"><p class="apt-prompt">Before you see your score: how many of the ${n} questions do you think you got right?</p>
        <label for="aptGuess">Your guess (0 to ${n})<input id="aptGuess" type="number" min="0" max="${n}" step="1" inputmode="numeric"></label><p class="apt-error" id="aptGuessErr" role="alert"></p>
        <div class="actions"><button class="primary" id="aptReveal">See my results →</button><button id="aptSkipGuess">Skip</button></div><p class="note">Your result is already saved. Your guess is shown next to your score and is not stored.</p></section>`;
    const show = guess => { res.guess = guess; held = null; pending = null; persist(); renderResults(res); };
    $('#aptReveal').onclick = () => {
      const v = $('#aptGuess').value.trim(), g = Number(v);
      if (!/^\d+$/.test(v) || g > n) { $('#aptGuessErr').textContent = `Enter a whole number from 0 to ${n}, or press Skip.`; $('#aptGuess').setAttribute('aria-invalid', 'true'); $('#aptGuess').focus(); return; }
      show(g);
    };
    $('#aptSkipGuess').onclick = () => show(null);
    $('#aptGuess').onkeydown = e => { if (e.key === 'Enter') $('#aptReveal').click(); };
  }

  /* ---- My placement notice ---- */
  function loadNotices() {
    const raw = read(NOTICES_KEY, []), seen = new Set(), out = [];
    if (!Array.isArray(raw)) return out;
    for (const x of raw) {
      let n = E.cleanNotice(x, NOTICE_LEVELS); if (!n) continue;
      if (seen.has(n.id)) n = E.cleanNotice({ ...n, id: '' }, NOTICE_LEVELS);
      seen.add(n.id); out.push(n); if (out.length >= E.LIMITS.notices) break;
    }
    return out;
  }
  function shapeOf(n) {
    const total = n.sections.reduce((a, s) => a + s.minutes, 0), parts = n.timing === 'sectional' ? n.sections.map(s => `${SHORT[s.id]} ${s.count} in ${s.minutes} min`) : [...n.sections.map(s => `${SHORT[s.id]} ${s.count}`), `${total} min in all`];
    parts.push(n.negative ? negLabel(n.negative) : 'no negative marking');
    if (n.nav === 'forward') parts.push('no going back');
    if (n.strict) parts.push(n.switchLimit ? `exam conditions, ends after ${n.switchLimit} exits` : 'exam conditions');
    return parts.join(' · ');
  }
  function beginNotice(n) { const t = testFrom(E.noticeConfig(n)); renderBrief(t); }
  function bindNotices() {
    const find = id => notices.find(n => n.id === id);
    document.querySelectorAll('[data-notice-start]').forEach(b => b.onclick = () => { const n = find(b.dataset.noticeStart); if (n) beginNotice(n); });
    document.querySelectorAll('[data-notice-share]').forEach(b => b.onclick = () => { const n = find(b.dataset.noticeShare); if (n) shareNotice(n); });
    document.querySelectorAll('[data-notice-edit]').forEach(b => b.onclick = () => { const n = find(b.dataset.noticeEdit); if (n) renderNoticeForm(n.id); });
    document.querySelectorAll('[data-notice-delete]').forEach(b => b.onclick = () => {
      const n = find(b.dataset.noticeDelete); if (!n || !confirm(`Delete the notice “${n.name}”? Tests you already took stay in your history.`)) return;
      notices = notices.filter(x => x.id !== n.id); save(NOTICES_KEY, notices); renderHome();
    });
    $('#aptNoticeNew').onclick = () => renderNoticeForm(null);
    const openCode = () => openPaper($('#aptPaperCode').value);
    $('#aptPaperOpen').onclick = openCode; $('#aptPaperCode').onkeydown = e => { if (e.key === 'Enter') openCode(); };
    $('#aptCollect').onclick = renderCollect;
  }
  const ROW_DEFAULT = { quant: [20, 25], logical: [15, 20], verbal: [20, 15] };
  function renderNoticeForm(id) {
    const old = notices.find(n => n.id === id) || null, ids = E.SECTION_IDS;
    const n = old || { name: '', source: '', sections: [{ id: 'quant', count: 20, minutes: 25 }], timing: 'sectional', negative: 0, level: 'mixed', nav: 'free', strict: true, switchLimit: 0 };
    enter('notice');
    $('#app').innerHTML = `<div class="eyebrow">MY PLACEMENT NOTICE</div><h1 class="drill-title">${old ? 'Edit your notice' : 'Set up a test from your notice'}</h1><p class="lead">Copy the numbers from your drive notice. You enter these settings yourself; Case Room has not checked them against any employer.</p>
      <section class="panel drill-setup apt-setup apt-noticeform"><label for="anName">Name of the test<input id="anName" type="text" maxlength="60" autocomplete="off" value="${esc(n.name)}" aria-describedby="anNameErr"></label><p class="apt-error" id="anNameErr" role="alert"></p>
        <label for="anSource">Where it comes from (optional: a link or a note; it is shown as plain text)<input id="anSource" type="text" maxlength="200" autocomplete="off" value="${esc(n.source)}" aria-describedby="anSourceErr"></label><p class="apt-error" id="anSourceErr" role="alert"></p>
        <fieldset><legend>Sections in your test</legend>${ids.map(sid => { const s = n.sections.find(x => x.id === sid), d = ROW_DEFAULT[sid];
          return `<div class="apt-an-row"><label class="selfcheck"><input type="checkbox" id="anOn-${sid}" ${s ? 'checked' : ''}><span><b>${esc(sectionOf(sid).title)}</b></span></label><label for="anCount-${sid}">Questions<input type="number" id="anCount-${sid}" min="1" max="${E.LIMITS.counts[sid]}" step="1" inputmode="numeric" value="${s ? s.count : d[0]}"></label><label for="anMin-${sid}">Minutes<input type="number" id="anMin-${sid}" min="1" max="120" step="1" inputmode="numeric" value="${s ? s.minutes : d[1]}"></label><p class="apt-error" id="anErr-${sid}" role="alert"></p></div>`; }).join('')}<p class="apt-error" id="anSectionsErr" role="alert"></p></fieldset>
        <fieldset><legend>Timer</legend><label class="selfcheck"><input type="radio" name="anTiming" value="sectional" ${n.timing === 'sectional' ? 'checked' : ''}> A separate clock for each section; finished sections are locked</label>
        <label class="selfcheck"><input type="radio" name="anTiming" value="total" ${n.timing === 'total' ? 'checked' : ''}> One clock for the total of the minutes</label></fieldset>
        <div class="drill-options apt-test-options"><label for="anNegative">Marking<select id="anNegative">${NEGATIVES.map(([v, t]) => `<option value="${v}" ${n.negative === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label for="anLevel">Difficulty<select id="anLevel">${LEVEL_OPTIONS.map(([v, t]) => `<option value="${v}" ${n.level === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label for="anNav">Moving between questions<select id="anNav"><option value="free" ${n.nav === 'free' ? 'selected' : ''}>Move freely between questions</option><option value="forward" ${n.nav === 'forward' ? 'selected' : ''}>No going back to earlier questions</option></select></label></div>
        <label class="selfcheck apt-strict"><input type="checkbox" id="anStrict" ${n.strict ? 'checked' : ''}><span><b>Exam conditions:</b> the clock does not pause, leaving the test is counted, and you guess your score before you see it</span></label>
        <label for="anSwitch">If the student leaves the test<select id="anSwitch" ${n.strict ? '' : 'disabled'}><option value="0" ${n.switchLimit === 0 ? 'selected' : ''}>Count it only</option><option value="3" ${n.switchLimit === 3 ? 'selected' : ''}>End the test after 3 times</option><option value="5" ${n.switchLimit === 5 ? 'selected' : ''}>End the test after 5 times</option></select></label>
        <p class="apt-error" id="anSaveErr" role="alert"></p>
        <div class="actions"><button class="primary" id="anSave">Save</button><button id="anCancel">Cancel</button></div></section>`;
    $('#anStrict').onchange = () => { $('#anSwitch').disabled = !$('#anStrict').checked; };
    $('#anCancel').onclick = renderHome;
    $('#anSave').onclick = () => {
      const errors = {}, sections = [], name = $('#anName').value.trim(), source = $('#anSource').value.trim();
      if (!name) errors.anName = 'Enter a name for this test.'; else if (Array.from(name).length > E.LIMITS.name) errors.anName = `Keep the name to ${E.LIMITS.name} characters or fewer.`;
      if (Array.from(source).length > E.LIMITS.source) errors.anSource = `Keep this to ${E.LIMITS.source} characters or fewer.`;
      for (const sid of ids) {
        if (!$('#anOn-' + sid).checked) continue;
        const c = $('#anCount-' + sid).value.trim(), m = $('#anMin-' + sid).value.trim(), max = E.LIMITS.counts[sid], msg = [];
        if (!/^\d{1,3}$/.test(c) || Number(c) < 1 || Number(c) > max) msg.push(`Questions: enter a whole number from 1 to ${max}.`);
        if (!/^\d{1,3}$/.test(m) || Number(m) < E.LIMITS.minutes[0] || Number(m) > E.LIMITS.minutes[1]) msg.push(`Minutes: enter a whole number from ${E.LIMITS.minutes[0]} to ${E.LIMITS.minutes[1]}.`);
        if (msg.length) errors['anErr-' + sid] = msg.join(' '); else sections.push({ id: sid, count: Number(c), minutes: Number(m) });
      }
      if (!ids.some(sid => $('#anOn-' + sid).checked)) errors.anSections = 'Choose at least one section.';
      const notice = Object.keys(errors).length ? null : E.cleanNotice({ id: old ? old.id : undefined, name, source, sections, timing: document.querySelector('[name=anTiming]:checked')?.value, negative: Number($('#anNegative').value), level: $('#anLevel').value,
        nav: $('#anNav').value, strict: $('#anStrict').checked, switchLimit: $('#anStrict').checked ? Number($('#anSwitch').value) : 0 }, NOTICE_LEVELS);
      if (!notice && !Object.keys(errors).length) errors.anSave = 'These settings could not be saved. Check each field.';
      if (notice && !old && notices.length >= E.LIMITS.notices) errors.anSave = `You can keep up to ${E.LIMITS.notices} notices. Delete one first.`;
      for (const k of ['anName', 'anSource', 'anSections', 'anSave', ...ids.map(sid => 'anErr-' + sid)]) { const el = $('#' + (k === 'anName' || k === 'anSource' ? k + 'Err' : k === 'anSections' ? 'anSectionsErr' : k === 'anSave' ? 'anSaveErr' : k)); if (el) el.textContent = errors[k] || ''; }
      for (const k of ['anName', 'anSource']) { if (errors[k]) $('#' + k).setAttribute('aria-invalid', 'true'); else $('#' + k).removeAttribute('aria-invalid'); }
      if (Object.keys(errors).length) { const first = document.querySelector('.apt-error:not(:empty)'); if (first) first.scrollIntoView({ block: 'center' }); return; }
      notices = old ? notices.map(x => x.id === old.id ? notice : x) : [...notices, notice]; save(NOTICES_KEY, notices); renderHome();
    };
    // A message goes away as soon as its field is edited; Save checks everything again.
    $('#app').querySelectorAll('input, select').forEach(el => el.addEventListener('input', () => {
      const sid = (el.id.match(/^an(?:On|Count|Min)-(\w+)$/) || [])[1], box = $('#' + (sid ? 'anErr-' + sid : el.id + 'Err'));
      if (box) box.textContent = ''; el.removeAttribute('aria-invalid');
      if (sid) $('#anSectionsErr').textContent = ''; $('#anSaveErr').textContent = '';
    }));
    $('#anName').focus({ preventScroll: true });
  }

  /* ---- Shared papers ---- */
  function copyText(text, field, status) {
    const manual = () => { field.focus(); field.select(); status.textContent = 'Select the text and copy it.'; };
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(() => { status.textContent = 'Copied.'; }, manual); return; } } catch { /* fall through */ }
    manual();
  }
  function shareNotice(n) {
    const c = E.noticeConfig(n), seed = (Math.floor(Math.random() * 4294967296) ^ Date.now()) >>> 0;
    const code = E.encodePaper({ seed, config: c, check: E.paperCheck(A.buildTest({ sections: c.sections, counts: c.counts, perSection: 10, level: c.level, seed })) });
    const origin = location.origin && location.origin !== 'null' ? location.origin : 'file://', link = origin + location.pathname + '#aptitude/paper/' + code;
    modal(`<h2>Share this paper</h2><p class="note"><b>${esc(n.name)}</b> · ${esc(shapeOf(n))}</p>
      <label for="aptShareLink">Link<input id="aptShareLink" type="text" readonly value="${esc(link)}"></label><div class="actions"><button id="aptCopyLink">Copy the link</button></div>
      <label for="aptShareCode">The code on its own<input id="aptShareCode" type="text" readonly value="${esc(code)}"></label><div class="actions"><button id="aptCopyCode">Copy the code</button></div><p class="note" id="aptShareStatus" role="status"></p>
      <p class="note">Everyone who opens this link gets the same questions and the same clock rules, as long as they use this same site and version. Nothing is sent anywhere: the link itself carries the settings.</p>`);
    $('#aptCopyLink').onclick = () => copyText(link, $('#aptShareLink'), $('#aptShareStatus'));
    $('#aptCopyCode').onclick = () => copyText(code, $('#aptShareCode'), $('#aptShareStatus'));
  }
  /** Opens a paper from a bare code or a whole link. Returns true when the brief is showing. */
  function openPaper(input) {
    const m = /CR1\.[A-Za-z0-9_-]+/.exec(String(input == null ? '' : input)), d = m && E.decodePaper(m[0], NOTICE_LEVELS);
    if (!d) { if (!(view === 'aptitude' && screen === 'home')) open(); toast('That is not a Case Room paper code.'); return false; }
    const t = testFrom(d.config, { seed: d.seed }), check = E.paperCheck(t.questions);
    renderBrief({ ...t, kind: 'paper', paper: { code: m[0], check, match: check === d.check } });
    return true;
  }
  const lineOf = res => { const tl = tally(res); return E.resultLine({ check: res.paper.check, name: res.paper.player, score: res.entry.score, correct: tl.right, wrong: tl.wrong, skipped: tl.skipped, unreached: tl.unreached, seconds: Math.round(res.elapsed / 1000), left: res.left || 0 }); };
  function sendMarkup(res) {
    return `<section class="panel apt-send" id="aptSend"><h2>Send your result to the organiser</h2>${res.paper.match ? '' : '<p class="note">This copy of the site built different questions from the organiser\'s, so your line carries its own check value and will be listed apart from theirs.</p>'}
      <label for="aptName">Your name, for the result line<input id="aptName" type="text" maxlength="40" autocomplete="off" value="${esc(res.paper.player || '')}"></label>
      <label for="aptLine">Result line<textarea id="aptLine" readonly rows="3" spellcheck="false">${esc(lineOf(res))}</textarea></label>
      <div class="actions"><button id="aptCopyLine">Copy the line</button><span class="note" id="aptCopyStatus" role="status"></span></div><p class="note">This line is for convenience. It is not tamper-proof.</p></section>`;
  }
  function bindSend(res) {
    $('#aptName').oninput = () => { res.paper.player = $('#aptName').value.trim().slice(0, 40); $('#aptLine').value = lineOf(res); };
    $('#aptCopyLine').onclick = () => copyText($('#aptLine').value, $('#aptLine'), $('#aptCopyStatus'));
  }
  function renderCollect() {
    enter('collect');
    $('#app').innerHTML = `<div class="eyebrow">SHARED PAPER</div><h1 class="drill-title">Collect results</h1><p class="lead">Paste the result lines your group sent you, one per line. Nothing on this screen is stored or sent anywhere.</p>
      <section class="panel apt-collect"><label for="acLines">Result lines<textarea id="acLines" rows="8" spellcheck="false" placeholder="CR1|…"></textarea></label><div class="actions"><button class="primary" id="acRank">Rank them</button><button id="acBack">Aptitude home</button></div>
        <p class="note">The check characters at the end of each line catch copying mistakes only. Anyone can write a line, so use this for practice groups, not for decisions that matter.</p></section><div id="acOut" aria-live="polite"></div>`;
    $('#acBack').onclick = renderHome;
    $('#acRank').onclick = () => {
      const c = E.collectLines($('#acLines').value), ranked = E.rank(c.rows), list = (xs, f) => xs.map(f).join('');
      $('#acOut').innerHTML = `<section class="panel apt-ranking">${ranked.length ? `<h2>Ranking</h2><p class="note">Paper check ${esc(c.check)} · ${ranked.length} ${ranked.length === 1 ? 'result' : 'results'}. Best score first; equal scores are ordered by time.</p>
        <div class="apt-table-wrap"><table class="drill-table apt-rank"><thead><tr><th scope="col">Rank</th><th scope="col">Name</th><th scope="col">Score</th><th scope="col">Correct</th><th scope="col">Wrong</th><th scope="col">Skipped</th><th scope="col">Not reached</th><th scope="col">Time</th><th scope="col">Times left</th></tr></thead><tbody>${list(ranked, r => `<tr><td>${r.rank}</td><th scope="row">${esc(r.name)}</th><td>${marks(r.score)}</td><td>${r.correct}</td><td>${r.wrong}</td><td>${r.skipped}</td><td>${r.unreached}</td><td>${clock(r.seconds)}</td><td>${r.left}</td></tr>`)}</tbody></table></div>
        <div class="actions"><button id="acCsv">Download CSV</button></div>` : '<h2>Ranking</h2><p class="note">No readable result lines yet.</p>'}
        ${c.duplicates.length ? `<h3>Repeated names</h3><ul class="apt-notes">${list(c.duplicates, d => `<li>The name “${esc(d.name)}” appears on lines ${d.lines.join(' and ')}. Both are kept: check that they are two different people.</li>`)}</ul>` : ''}
        ${c.other.length ? `<h3>Lines from a different paper</h3><ul class="apt-notes">${list(c.other, o => `<li>Line${o.lines.length === 1 ? '' : 's'} ${o.lines.join(', ')} ${o.lines.length === 1 ? 'belongs' : 'belong'} to a different paper (check ${esc(o.check)}), so ${o.lines.length === 1 ? 'it is' : 'they are'} not ranked.</li>`)}</ul>` : ''}
        ${c.bad.length ? `<h3>Lines that could not be read</h3><ul class="apt-notes">${list(c.bad, b => `<li>Line ${b.line}: ${esc(b.reason)}.</li>`)}</ul>` : ''}</section>`;
      if ($('#acCsv')) $('#acCsv').onclick = () => download(E.toCsv(ranked), `case-room-paper-${c.check}.csv`);
    };
  }

  setInterval(() => {
    tick();
    if (view === 'aptitude' && screen === 'practice' && run && run.mode === 'practice' && !run.results[run.index] && $('#aptTimer')) {
      const s = Math.floor((Date.now() - run.qStarted) / 1000); $('#aptTimer').textContent = seconds(s); $('#aptTimer').classList.toggle('over', !!run.target && s > run.target);
    }
  }, 500);
  const flush = () => { if (run && run.mode === 'test' && screen === 'test' && view === 'aptitude') { tick(); persist(); } };
  window.addEventListener('pagehide', () => exam() ? leave('pagehide') : flush());
  window.addEventListener('pageshow', e => { if (e.persisted && exam() && run.away && onTest()) renderTest(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { if (exam()) leave('hidden'); else flush(); } else if (exam() && run.away && onTest()) renderTest();
  });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && exam()) leave('fullscreen'); });

  /* ---------- Integration with the rest of Case Room ---------- */
  $('#aptitudeNav').onclick = open;
  const priorHome = home;
  home = function () {
    pause(); priorHome(); if (location.hash.startsWith('#aptitude')) setHash(false);
  };


  window.Aptitude = { open, tick, quickPractice, quickTest, openPaper, collect: renderCollect, noticeForm: renderNoticeForm, state: () => ({ run, history, prefs, screen, lastResult, notices, pending: !!pending }) };
})();
