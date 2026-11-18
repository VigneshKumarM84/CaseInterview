/* Campus placement aptitude practice: topic practice with instant worked solutions, placement-style timed tests
   with a question palette, mark for review, negative marking and auto-submit, results and per-topic progress.
   Works fully offline. Uses core.js helpers, stopMedia()/view/home from cases.js and AptitudeQuestions. */
(() => {
  const A = AptitudeQuestions;
  const RUN_KEY = 'cr-aptitude-run', HISTORY_KEY = 'cr-aptitude-history', PREFS_KEY = 'cr-aptitude-prefs', MAX_HISTORY = 100;
  const COUNTS = [5, 10, 20], PER_SECTION = [5, 10, 20, 30];
  const TARGETS = [[0, 'No target'], [30, '30 seconds'], [45, '45 seconds'], [60, '1 minute'], [90, '90 seconds']];
  const PACES = [[36, '36 seconds per question (fast)'], [60, '1 minute per question'], [90, '90 seconds per question']];
  const NEGATIVES = [[0, 'No negative marking'], [0.25, '−0.25 per wrong answer'], [1 / 3, '−1/3 per wrong answer'], [0.5, '−0.5 per wrong answer']];
  const LETTERS = ['A', 'B', 'C', 'D'];
  const topicOf = A.topicOf, sectionOf = id => A.SECTIONS.find(s => s.id === id);
  const topicsIn = s => A.TOPICS.filter(t => t.section === s).map(t => t.id);
  const levelTitle = id => id === 'mixed' ? 'Mixed difficulty' : (A.LEVELS.find(l => l.id === id) || A.LEVELS[1]).title;
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
      testLevel: [...A.LEVEL_IDS, 'mixed'].includes(p.testLevel) ? p.testLevel : 'mixed', pace: PACES.some(x => x[0] === p.pace) ? p.pace : 60,
      timing: p.timing === 'sectional' ? 'sectional' : 'total', negative: NEGATIVES.some(x => x[0] === p.negative) ? p.negative : 0
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
    return arr(r.answers, n, x => x === null || (Number.isInteger(x) && x >= 0 && x < 4)) && arr(r.marked, n, x => typeof x === 'boolean') && arr(r.visited, n, x => typeof x === 'boolean') && arr(r.seconds, n, x => fin(x) && x >= 0);
  }
  const validEntry = e => isObj(e) && str(e.id) && fin(e.at) && ['practice', 'test'].includes(e.mode) && Array.isArray(e.results) && e.results.every(x => isObj(x) && topicOf(x.topic) && typeof x.ok === 'boolean' && typeof x.answered === 'boolean' && (x.seconds == null || fin(x.seconds)));

  let prefs = cleanPrefs(read(PREFS_KEY, {}));
  let history = read(HISTORY_KEY, []); history = Array.isArray(history) ? history.filter(validEntry) : [];
  let run = read(RUN_KEY, null); if (!validRun(run)) run = null;
  let screen = 'home', lastResult = null, lastTick = null, ticks = 0;

  const persist = () => save(RUN_KEY, run);
  function setHash(on) { try { window.history.replaceState(null, '', location.pathname + location.search + (on ? '#aptitude' : '')); } catch { /* file:// or sandboxed frames */ } }
  const seconds = n => n == null ? '—' : n < 60 ? `${Math.round(n)}s` : clock(Math.round(n));
  const percent = n => n == null ? '—' : Math.round(n * 100) + '%';
  const marks = n => String(Math.round(n * 100) / 100);
  function enter(name) { pause(); stopMedia(); view = 'aptitude'; screen = name; setHash(true); window.scrollTo(0, 0); }
  function open() { enter('home'); renderHome(); }

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
    return `<details class="apt-passage" ${open ? 'open' : ''}><summary>Passage: ${esc(p.title)}</summary>${p.text.split(/\n\s*\n/).map(x => `<p>${esc(x)}</p>`).join('')}</details>`;
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
    const stats = A.summarise(history), weak = A.weakest(stats), practised = stats.filter(s => s.attempts);
    const resume = run ? `<section class="panel drill-resume"><div><b>Unfinished ${run.mode === 'test' ? 'timed test' : 'practice set'}</b><p class="note">${run.mode === 'test'
      ? `${run.sections.map(s => sectionOf(s).title).join(', ')} · ${run.answers.filter(a => a != null).length} of ${run.questions.length} answered · ${clock(Math.ceil(remainingMs() / 1000))} left (the clock is paused)`
      : `${levelTitle(run.level)} · question ${run.index + 1} of ${run.questions.length} · ${run.results.filter(x => x && x.ok).length} correct so far`}</p></div><div class="actions"><button class="primary" id="aptResume">Resume →</button><button id="aptDiscard">Discard</button></div></section>` : '';
    $('#app').innerHTML = `<section class="drill-head"><div class="eyebrow">PLACEMENT APTITUDE</div><h1 class="drill-title">Clear the online <em>aptitude round.</em></h1><p class="lead">Quantitative, logical and verbal questions like the online tests campus placements use before any interview. Practise by topic with worked solutions, or take a timed mock with a question palette and negative marking. Free, no AI, no account; progress stays in this browser.</p></section>${resume}
      <div class="apt-grid">
      <section class="panel drill-setup apt-setup"><h2>Topic practice</h2><p class="note">Instant feedback, a worked solution and a shortcut after every question.</p>
        <fieldset><legend>Section</legend><div class="apt-tabs" role="radiogroup">${A.SECTIONS.map(s => `<label class="drill-level"><input type="radio" name="aptSection" value="${s.id}" ${prefs.section === s.id ? 'checked' : ''}><span><b>${esc(s.title)}</b><small>${esc(s.short)}</small></span></label>`).join('')}</div></fieldset>
        <fieldset><legend>Topics</legend><div class="drill-chips apt-chips" id="aptTopics"></div><div class="drill-inline"><button type="button" id="aptAll">Select all</button><button type="button" id="aptNone">Clear</button></div></fieldset>
        <fieldset><legend>Difficulty</legend><div class="drill-levels">${A.LEVELS.map(l => `<label class="drill-level"><input type="radio" name="aptLevel" value="${l.id}" ${prefs.level === l.id ? 'checked' : ''}><span><b>${l.title}</b><small>${l.note}</small></span></label>`).join('')}</div></fieldset>
        <div class="drill-options"><label for="aptCount">Questions<select id="aptCount">${COUNTS.map(n => `<option value="${n}" ${prefs.count === n ? 'selected' : ''}>${n} questions</option>`).join('')}</select></label>
        <label for="aptTarget">Target per question<select id="aptTarget">${TARGETS.map(([n, t]) => `<option value="${n}" ${prefs.target === n ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
        <div class="actions"><button class="primary" id="aptPractice">Start practice →</button><span id="aptPracticeStatus" class="note" role="status"></span></div></section>
      <section class="panel drill-setup apt-setup"><h2>Timed test</h2><p class="note">A placement-style mock: no feedback until you submit, and it submits itself when time runs out.</p>
        <fieldset><legend>Sections</legend><div class="apt-tabs">${A.SECTIONS.map(s => `<label class="drill-chip"><input type="checkbox" name="aptTestSection" value="${s.id}" ${prefs.sections.includes(s.id) ? 'checked' : ''}><span><b>${esc(s.title)}</b><small>${topicsIn(s.id).length} topics</small></span></label>`).join('')}</div></fieldset>
        <div class="drill-options apt-test-options"><label for="aptPer">Questions per section<select id="aptPer">${PER_SECTION.map(n => `<option value="${n}" ${prefs.perSection === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label for="aptTestLevel">Difficulty<select id="aptTestLevel">${[...A.LEVELS.map(l => [l.id, l.title]), ['mixed', 'Mixed (like real tests)']].map(([id, t]) => `<option value="${id}" ${prefs.testLevel === id ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label for="aptPace">Time<select id="aptPace">${PACES.map(([n, t]) => `<option value="${n}" ${prefs.pace === n ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label for="aptNegative">Marking<select id="aptNegative">${NEGATIVES.map(([n, t], i) => `<option value="${i}" ${prefs.negative === n ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
        <fieldset><legend>Timer</legend><label class="selfcheck"><input type="radio" name="aptTiming" value="total" ${prefs.timing === 'total' ? 'checked' : ''}> One timer for the whole test; move freely between sections</label>
        <label class="selfcheck"><input type="radio" name="aptTiming" value="sectional" ${prefs.timing === 'sectional' ? 'checked' : ''}> A separate timer for each section; sections are locked once finished</label></fieldset>
        <p class="note" id="aptTestSummary"></p>
        <div class="actions"><button class="primary" id="aptTest">Start timed test →</button><span id="aptTestStatus" class="note" role="status"></span></div></section>
      <section class="panel drill-stats apt-progress"><h2>Your progress</h2>${practised.length ? `<p class="note">Accuracy and median time per question, from your last 30 answered questions in each topic (practice and tests).</p>
        <table class="drill-table"><thead><tr><th scope="col">Topic</th><th scope="col">Accuracy</th><th scope="col">Median time</th></tr></thead><tbody>${practised.map(s => `<tr><th scope="row">${esc(s.title)}<small>${esc(sectionOf(s.section).title)} · ${s.attempts} answered</small></th><td><div class="drill-meter" aria-hidden="true"><span style="width:${Math.round(s.accuracy * 100)}%"></span></div>${percent(s.accuracy)}</td><td>${seconds(s.medianSeconds)}</td></tr>`).join('')}</tbody></table>
        ${weakMarkup(weak)}
        <h3>Recent attempts</h3><ul class="drill-recent">${history.slice(-6).reverse().map(h => `<li><span>${esc(new Date(h.at).toLocaleDateString())} · ${h.mode === 'test' ? 'Timed test' : 'Practice'}</span><b>${h.mode === 'test' ? `${marks(h.score)}/${h.total}` : `${h.correct}/${h.results.length}`}</b></li>`).join('')}</ul>
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
        timing: document.querySelector('[name=aptTiming]:checked')?.value, negative: NEGATIVES[Number($('#aptNegative').value)]?.[0] });
      save(PREFS_KEY, prefs); summary();
    };
    const summary = () => { const n = testSections().length * prefs.perSection; $('#aptTestSummary').textContent = n ? `${n} questions · ${Math.round(n * prefs.pace / 60)} minutes in all${prefs.timing === 'sectional' ? ` (${Math.round(prefs.perSection * prefs.pace / 60)} per section)` : ''} · negative marking ${negLabel(prefs.negative)}.` : 'Choose at least one section.'; };
    summary();
    document.querySelectorAll('[name=aptSection]').forEach(x => x.onchange = () => { prefs.section = x.value; save(PREFS_KEY, prefs); renderTopicChips(); });
    $('#aptAll').onclick = () => { document.querySelectorAll('[name=aptTopic]').forEach(x => x.checked = true); remember(); };
    $('#aptNone').onclick = () => document.querySelectorAll('[name=aptTopic]').forEach(x => x.checked = false);
    $('#aptTopics').addEventListener('change', () => { if (checkedTopics().length) remember(); });
    document.querySelectorAll('.apt-setup select, [name=aptLevel], [name=aptTiming], [name=aptTestSection]').forEach(x => x.addEventListener('change', remember));
    $('#aptPractice').onclick = () => {
      if (!checkedTopics().length) { $('#aptPracticeStatus').textContent = 'Choose at least one topic.'; return; }
      remember(); beginPractice(A.buildSet({ topics: prefs.topics[prefs.section], level: prefs.level, count: prefs.count, seed: Date.now() }), 'new', prefs.level);
    };
    $('#aptTest').onclick = () => {
      if (!testSections().length) { $('#aptTestStatus').textContent = 'Choose at least one section.'; return; }
      remember(); beginTest();
    };
    if ($('#aptResume')) $('#aptResume').onclick = () => { if (run.mode === 'test') renderTest(); else { if (!run.results[run.index]) run.qStarted = Date.now(); persist(); renderPractice(); } };
    if ($('#aptDiscard')) $('#aptDiscard').onclick = () => { if (!confirm('Discard this unfinished attempt? Its answers will not count towards your progress.')) return; run = null; persist(); renderHome(); };
    bindWeak();
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
    run = { mode: 'practice', id: 'p' + Date.now().toString(36), origin, level, target: prefs.target, questions, results: questions.map(() => null), index: 0, started: Date.now(), qStarted: Date.now() };
    persist(); renderPractice();
  }
  function beginTest({ sections = prefs.sections, perSection = prefs.perSection } = {}) {
    if (!replaceRun()) return;
    const questions = A.buildTest({ sections, perSection, level: prefs.testLevel, seed: Date.now() }), n = questions.length;
    run = { mode: 'test', id: 't' + Date.now().toString(36), level: prefs.testLevel, sections: sections.slice(), perSection, pace: prefs.pace, timing: prefs.timing, negative: prefs.negative,
      questions, answers: Array(n).fill(null), marked: Array(n).fill(false), visited: Array(n).fill(false), seconds: Array(n).fill(0), index: 0, elapsed: 0, sectionIndex: 0, sectionElapsed: sections.map(() => 0), started: Date.now() };
    persist(); renderTest();
  }
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
    $('#app').innerHTML = `<div class="row"><div><div class="eyebrow">TOPIC PRACTICE · ${esc(levelTitle(run.level).toUpperCase())}</div><h2 class="section-title">Question ${run.index + 1} of ${run.questions.length}</h2></div><span class="badge" id="aptTimer" aria-live="off">${r ? seconds(r.seconds) : '0s'}</span></div>
      <div class="drill-bar" aria-hidden="true"><span style="width:${Math.round(done / run.questions.length * 100)}%"></span></div>
      <section class="panel apt-card"><div class="eyebrow">${esc(sectionOf(q.section).title)} · ${esc(topicOf(q.topic).title)}</div>${stem(q)}
      ${optionsMarkup(q, r ? r.choice : null, !!r)}
      ${r ? `<div class="drill-feedback ${r.ok ? 'ok' : 'miss'}" id="aptFeedback" role="status"><h3>${r.ok ? '✓ Correct' : r.choice == null ? 'Worked solution' : '✗ Not quite'}</h3>
        <p>${r.choice == null ? '' : `You chose <b>${LETTERS[r.choice]}. ${esc(q.options[r.choice])}</b>. `}The answer is <b>${LETTERS[q.answer]}. ${esc(q.display)}</b>.${r.choice == null ? '' : ` Time: ${seconds(r.seconds)}${run.target && r.seconds > run.target ? ` · over your ${run.target}s target` : ''}.`}</p>
        ${solutionMarkup(q)}<button class="primary" id="aptNext">${last ? 'See results →' : 'Next question →'}</button></div>` : '<div class="drill-inline"><button type="button" id="aptReveal">Show solution</button></div>'}</section>
      <div class="actions"><button id="aptExit">Save & exit</button><button id="aptEnd">End practice now</button></div>`;
    document.querySelectorAll('.apt-option:not([disabled])').forEach(b => b.onclick = () => recordPractice(Number(b.dataset.opt)));
    if ($('#aptReveal')) $('#aptReveal').onclick = () => recordPractice(null);
    if ($('#aptNext')) { $('#aptNext').onclick = nextPractice; $('#aptNext').focus({ preventScroll: true }); }
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
  const budgetMs = () => (run.timing === 'sectional' ? run.perSection : run.questions.length) * run.pace * 1000;
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
    stopMedia(); view = 'aptitude'; screen = 'test'; if (lastTick == null) lastTick = Date.now();
    const i = run.index, q = run.questions[i], list = visible(), pos = list.indexOf(i), sec = run.sections[run.sectionIndex], lastSection = run.sectionIndex === run.sections.length - 1;
    run.visited[i] = true; persist();
    const c = counts(list), groups = run.timing === 'sectional' ? [[sec, list]] : run.sections.map(s => [s, list.filter(j => run.questions[j].section === s)]);
    const atEnd = pos === list.length - 1;
    $('#app').innerHTML = `<div class="apt-testbar"><div><div class="eyebrow">TIMED TEST · ${esc(sectionOf(q.section).title.toUpperCase())}${run.timing === 'sectional' ? ` · SECTION ${run.sectionIndex + 1} OF ${run.sections.length}` : ''}</div><h2 class="section-title">Question ${i + 1} of ${run.questions.length}</h2></div>
        <span class="badge apt-clock" id="aptClock" role="timer" aria-live="off">${clock(Math.ceil(remainingMs() / 1000))} left</span></div>
      <div class="apt-test">
      <section class="panel apt-card">${stem(q)}${optionsMarkup(q, run.answers[i], false)}
        <div class="apt-test-actions"><button id="aptPrev" ${pos === 0 ? 'disabled' : ''}>← Previous</button><button id="aptMark" aria-pressed="${run.marked[i]}">${run.marked[i] ? '★ Marked for review' : '☆ Mark for review'}</button><button id="aptClearAns" ${run.answers[i] == null ? 'disabled' : ''}>Clear response</button><button class="primary" id="aptNextQ" ${atEnd ? 'disabled' : ''}>Save & next →</button></div></section>
      <aside class="panel apt-palette" aria-label="Question palette"><h3>Question palette</h3>
        <ul class="apt-legend"><li><span class="apt-dot answered"></span>Answered ${c.answered}</li><li><span class="apt-dot skipped"></span>Not answered ${c.skipped}</li><li><span class="apt-dot fresh"></span>Not visited ${c.fresh}</li><li><span class="apt-dot marked"></span>Marked ${c.marked}</li></ul>
        ${groups.map(([s, idx]) => `<div class="apt-palette-group"><b>${esc(sectionOf(s).title)}</b><div class="apt-pal">${idx.map(j => `<button class="apt-pal-btn ${paletteState(j)}${j === i ? ' current' : ''}" data-go="${j}" aria-label="Question ${j + 1}: ${paletteState(j).replace('fresh', 'not visited').replace('skipped', 'not answered').replace('marked answered', 'answered and marked for review').replace(/^marked$/, 'marked for review')}"${j === i ? ' aria-current="true"' : ''}>${j + 1}</button>`).join('')}</div></div>`).join('')}
        <p class="note">Answers marked for review still count if they are answered. Negative marking: ${negLabel(run.negative)}.</p>
        <div class="apt-submit">${run.timing === 'sectional' && !lastSection ? `<button class="primary" id="aptFinishSection">Finish ${esc(sectionOf(sec).title)} section →</button>` : '<button class="primary" id="aptSubmit">Submit test</button>'}<button id="aptPause">Save & exit (pauses the clock)</button></div></aside></div>`;
    document.querySelectorAll('.apt-option').forEach(b => b.onclick = () => { run.answers[i] = Number(b.dataset.opt); persist(); renderTest(); });
    $('#aptPrev').onclick = () => go(list[pos - 1]);
    $('#aptNextQ').onclick = () => go(list[pos + 1]);
    $('#aptMark').onclick = () => { run.marked[i] = !run.marked[i]; persist(); renderTest(); };
    $('#aptClearAns').onclick = () => { run.answers[i] = null; persist(); renderTest(); };
    document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(Number(b.dataset.go)));
    if ($('#aptSubmit')) $('#aptSubmit').onclick = () => { const all = counts(run.questions.map((_, j) => j)); if (confirm(`Submit the test? ${run.questions.length - all.answered} unanswered${all.marked ? `, ${all.marked} marked for review` : ''}. You cannot change answers afterwards.`)) submitTest(false); };
    if ($('#aptFinishSection')) $('#aptFinishSection').onclick = () => { const u = list.filter(j => run.answers[j] == null).length; if (confirm(`Finish the ${sectionOf(sec).title} section? ${u} unanswered. You cannot return to it.`)) nextSection(); };
    $('#aptPause').onclick = () => { tick(); renderHome(); };
  }
  function go(j) { if (!Number.isInteger(j) || !visible().includes(j)) return; tick(); run.index = j; persist(); renderTest(); window.scrollTo(0, 0); }
  function nextSection() {
    run.sectionIndex++; run.index = sectionRange(run.sections[run.sectionIndex])[0]; persist(); renderTest(); window.scrollTo(0, 0);
  }
  function submitTest(auto) {
    lastTick = null;
    const s = A.score(run.questions, run.answers, run.negative);
    const entry = { id: run.id, at: Date.now(), mode: 'test', level: run.level, sections: run.sections, perSection: run.perSection, pace: run.pace, timing: run.timing, negative: run.negative, auto: !!auto,
      score: s.score, correct: s.correct, wrong: s.wrong, unanswered: s.unanswered, total: s.total, elapsed: Math.round(run.elapsed / 1000),
      results: run.questions.map((q, i) => ({ topic: q.topic, ok: run.answers[i] === q.answer, answered: run.answers[i] != null, seconds: Math.round(run.seconds[i] * 10) / 10 })) };
    record(entry, { mode: 'test', auto: !!auto, level: run.level, sections: run.sections, perSection: run.perSection, negative: run.negative, timing: run.timing, pace: run.pace, elapsed: run.elapsed, score: s, items: run.questions.map((q, i) => ({ q, choice: run.answers[i], seconds: run.seconds[i], marked: run.marked[i] })) });
  }
  function timeUp() {
    if (run.timing === 'sectional' && run.sectionIndex < run.sections.length - 1) {
      const done = sectionOf(run.sections[run.sectionIndex]).title; nextSection(); toast(`Time is up for ${done}. On to ${sectionOf(run.sections[run.sectionIndex]).title}.`);
    } else { toast('Time is up. Your test has been submitted.'); submitTest(true); }
  }
  function pause() { if (run && run.mode === 'test' && lastTick != null) { tick(); persist(); } lastTick = null; }
  /* Runs every half second. The clock only counts while the test is on screen; leaving the test or the page pauses it. */
  function tick() {
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

  /* ---------- Results ---------- */
  function record(entry, res) {
    history.push(entry); history = history.slice(-MAX_HISTORY); save(HISTORY_KEY, history);
    run = null; persist(); lastResult = { ...res, entry }; renderResults(lastResult);
  }
  function summaryText(res) {
    const e = res.entry, head = res.mode === 'test'
      ? `Timed test · ${levelTitle(res.level)} · ${res.timing === 'sectional' ? 'sectional timer' : 'one timer'} · negative marking ${negLabel(res.negative)}${res.auto ? ' · auto-submitted when time ran out' : ''}\nScore: ${marks(e.score)} / ${e.total} (${e.correct} correct, ${e.wrong} wrong, ${e.unanswered} unanswered)\nTime used: ${clock(Math.round(res.elapsed / 1000))}`
      : `Topic practice · ${levelTitle(res.level)}\nScore: ${e.correct} / ${e.total}`;
    return `CASE ROOM — PLACEMENT APTITUDE\n${new Date(e.at).toLocaleString()}\n${head}\n\n` + res.items.map(({ q, choice, seconds: t }, i) =>
      `${i + 1}. [${sectionOf(q.section).title} · ${topicOf(q.topic).title}]${q.passage ? ` (passage: ${q.passage.title})` : ''}\n${q.prompt}\n${q.options.map((o, j) => `   ${LETTERS[j]}. ${o}`).join('\n')}\n   ${choice == null ? 'Not answered' : `You chose ${LETTERS[choice]} — ${choice === q.answer ? 'correct' : 'incorrect'}`} · time ${seconds(t)}\n   Answer: ${LETTERS[q.answer]}. ${q.display}\n   Solution: ${q.solution.join(' → ')}`).join('\n\n') + '\n';
  }
  function renderResults(res) {
    pause(); stopMedia(); view = 'aptitude'; screen = 'results'; window.scrollTo(0, 0);
    const e = res.entry, items = res.items, answered = items.filter(x => x.choice != null), missed = items.filter(x => x.choice !== x.q.answer);
    const times = items.map(x => x.seconds).filter(fin), avg = times.length ? times.reduce((s, x) => s + x, 0) / times.length : null;
    const byTopic = A.TOPICS.map(t => ({ t, list: items.filter(x => x.q.topic === t.id) })).filter(x => x.list.length);
    const weak = A.weakest(A.summarise(history));
    const headline = res.mode === 'test' ? `Score ${marks(e.score)} / ${e.total}` : `${e.correct} of ${e.total} correct`;
    $('#app').innerHTML = `<div class="eyebrow">${res.mode === 'test' ? `TEST SUBMITTED${res.auto ? ' · TIME RAN OUT' : ''}` : 'PRACTICE COMPLETE'} · ${esc(levelTitle(res.level).toUpperCase())}</div><h1 class="drill-title" id="aptHeadline">${headline}</h1>
      ${res.mode === 'test' ? `<p class="note">${e.correct} correct × 1${res.negative ? ` − ${e.wrong} wrong × ${negLabel(res.negative).slice(1)}` : ''} = ${marks(e.score)}. Unanswered questions score 0.</p>` : ''}
      <div class="score-grid"><div><div class="metric">${percent(answered.length ? answered.filter(x => x.choice === x.q.answer).length / answered.length : null)}</div><span class="note">Accuracy (of attempted)</span></div><div><div class="metric">${answered.length}/${items.length}</div><span class="note">Attempted</span></div><div><div class="metric">${seconds(avg)}</div><span class="note">Average time per question</span></div><div><div class="metric">${res.mode === 'test' ? clock(Math.round(res.elapsed / 1000)) : missed.length}</div><span class="note">${res.mode === 'test' ? 'Time used' : 'To review'}</span></div></div>
      <section class="panel drill-results apt-results"><h2>By topic</h2><div class="apt-table-wrap"><table class="drill-table"><thead><tr><th scope="col">Topic</th><th scope="col">Correct</th><th scope="col">Avg time</th></tr></thead><tbody>${byTopic.map(({ t, list }) => { const ts = list.map(x => x.seconds).filter(fin); return `<tr><th scope="row">${esc(t.title)}<small>${esc(sectionOf(t.section).title)}</small></th><td>${list.filter(x => x.choice === x.q.answer).length}/${list.length}</td><td>${seconds(ts.length ? ts.reduce((s, x) => s + x, 0) / ts.length : null)}</td></tr>`; }).join('')}</tbody></table></div>
      ${weakMarkup(weak)}
      <h2>Every question</h2>${items.map(({ q, choice, seconds: t, marked }, i) => { const ok = choice === q.answer; return `<details class="drill-review ${ok ? 'ok' : 'miss'}" ${ok ? '' : 'open'}><summary><span>${ok ? '✓' : choice == null ? '–' : '✗'}</span> ${i + 1}. ${esc(topicOf(q.topic).title)}${marked ? ' ★' : ''} <small class="note">${seconds(t)}</small></summary>
        ${q.passage ? passageMarkup(q.passage, false) : ''}${q.table ? tableMarkup(q.table) : ''}${q.chart ? chartMarkup(q.chart) : ''}<p class="apt-prompt">${esc(q.prompt)}</p>${optionsMarkup(q, choice, true)}
        <p>${choice == null ? 'Not answered.' : `You chose <b>${LETTERS[choice]}</b>.`} Answer: <b>${LETTERS[q.answer]}. ${esc(q.display)}</b></p>${solutionMarkup(q)}</details>`; }).join('')}
      <div class="actions">${missed.length ? `<button class="primary" id="aptRetry">Retry the ${missed.length} I missed</button>` : ''}<button ${missed.length ? '' : 'class="primary"'} id="aptAgain">${res.mode === 'test' ? 'New test, same settings' : 'New practice, same settings'}</button><button id="aptBack">Aptitude home</button><button id="aptDownload">Download summary</button></div></section>`;
    if ($('#aptRetry')) $('#aptRetry').onclick = () => beginPractice(missed.map(x => JSON.parse(JSON.stringify(x.q))), 'retry', res.level === 'mixed' ? 'medium' : res.level);
    $('#aptAgain').onclick = () => res.mode === 'test' ? beginTest(res.sections ? { sections: res.sections, perSection: res.perSection } : {}) : beginPractice(A.buildSet({ topics: prefs.topics[prefs.section], level: prefs.level, count: prefs.count, seed: Date.now() }), 'new', prefs.level);
    $('#aptBack').onclick = renderHome;
    $('#aptDownload').onclick = () => download(summaryText(res), `case-room-aptitude-${new Date(e.at).toISOString().slice(0, 10)}.txt`);
    bindWeak();
  }

  setInterval(() => {
    tick();
    if (view === 'aptitude' && screen === 'practice' && run && run.mode === 'practice' && !run.results[run.index] && $('#aptTimer')) {
      const s = Math.floor((Date.now() - run.qStarted) / 1000); $('#aptTimer').textContent = seconds(s); $('#aptTimer').classList.toggle('over', !!run.target && s > run.target);
    }
  }, 500);
  const flush = () => { if (run && run.mode === 'test' && screen === 'test' && view === 'aptitude') { tick(); persist(); } };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

  /* ---------- Integration with the rest of Case Room ---------- */
  $('#aptitudeNav').onclick = open;
  const priorHome = home;
  home = function () {
    pause(); priorHome(); if (location.hash === '#aptitude') setHash(false);
  };


  window.Aptitude = { open, tick, quickPractice, quickTest, state: () => ({ run, history, prefs, screen, lastResult }) };
})();
