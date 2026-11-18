/* Case maths drill: setup, timed questions, worked answers, round results and per-skill progress.
   Works fully offline. Uses core.js helpers, speak()/stopMedia() from cases.js and DrillQuestions. */
(() => {
  const D = DrillQuestions;
  const RUN_KEY = 'cr-drill-run', HISTORY_KEY = 'cr-drill-history', PREFS_KEY = 'cr-drill-prefs', MAX_RUNS = 200;
  const COUNTS = [5, 10, 20], TARGETS = [[0, 'No target'], [60, '60 seconds'], [30, '30 seconds']];
  const skillOf = id => D.SKILLS.find(s => s.id === id);
  const levelOf = id => D.LEVELS.find(l => l.id === id) || D.LEVELS[1];

  function cleanPrefs(p) {
    p = p && typeof p === 'object' ? p : {};
    const skills = Array.isArray(p.skills) ? p.skills.filter(s => D.SKILL_IDS.includes(s)) : [];
    return { skills: skills.length ? skills : D.SKILL_IDS.slice(), level: levelOf(p.level).id, count: COUNTS.includes(Number(p.count)) ? Number(p.count) : 10,
      target: TARGETS.some(t => t[0] === Number(p.target)) ? Number(p.target) : 0, aloud: !!p.aloud, listen: !!p.listen };
  }
  const validQuestion = q => q && typeof q.prompt === 'string' && Number.isFinite(q.answer) && Number.isFinite(q.tolerance) && skillOf(q.skill) && Array.isArray(q.steps);
  function validRun(r) {
    return !!(r && Array.isArray(r.questions) && r.questions.length && r.questions.every(validQuestion) && Array.isArray(r.results) &&
      Number.isInteger(r.index) && r.index >= 0 && r.index < r.questions.length && r.results.length <= r.questions.length);
  }

  let prefs = cleanPrefs(read(PREFS_KEY, {}));
  let runs = read(HISTORY_KEY, []); if (!Array.isArray(runs)) runs = []; runs = runs.filter(r => r && Array.isArray(r.results));
  let run = read(RUN_KEY, null); if (!validRun(run)) run = null;
  let screen = 'home', lastResult = null;

  const persistRun = () => save(RUN_KEY, run);
  function setHash(on) { try { window.history.replaceState(null, '', location.pathname + location.search + (on ? '#drill' : '')); } catch { /* file:// or sandboxed frames */ } }
  const seconds = n => n == null ? '—' : n < 60 ? `${Math.round(n)}s` : clock(Math.round(n));
  const percent = n => n == null ? '—' : Math.round(n * 100) + '%';

  function open() { stopMedia(); view = 'drill'; setHash(true); renderHome(); }

  /* ---------- Home: setup and progress ---------- */
  function renderHome() {
    stopMedia(); view = 'drill'; screen = 'home'; window.scrollTo(0, 0);
    const stats = D.summarise(runs), weak = D.weakest(stats), practised = stats.some(s => s.attempts);
    const resume = run ? `<section class="panel drill-resume"><div><b>Unfinished round</b><p class="note">${levelOf(run.level).title} · question ${run.index + 1} of ${run.questions.length} · ${run.results.filter(r => r.ok).length} correct so far</p></div><div class="actions"><button class="primary" id="drillResume">Resume round →</button><button id="drillDiscard">Discard</button></div></section>` : '';
    $('#app').innerHTML = `<section class="drill-head"><div class="eyebrow">CASE MATHS DRILL</div><h1 class="drill-title">Get the numbers right, <em>quickly.</em></h1><p class="lead">Short rounds of the calculations that come up in case interviews: percentages, margins, break-evens, CAGR, NPV, unit conversions and chart reading. Questions are generated in your browser and checked instantly. No AI, no account, no cost.</p></section>${resume}
    <div class="drill-grid"><section class="panel drill-setup"><h2>Set up a round</h2>
      <fieldset><legend>Skills</legend><div class="drill-chips">${D.SKILLS.map(s => `<label class="drill-chip"><input type="checkbox" name="drillSkill" value="${s.id}" ${prefs.skills.includes(s.id) ? 'checked' : ''}><span><b>${esc(s.title)}</b><small>${esc(s.short)}</small></span></label>`).join('')}</div>
      <div class="drill-inline"><button type="button" id="drillAll">Select all</button><button type="button" id="drillNone">Clear</button></div></fieldset>
      <fieldset><legend>Difficulty</legend><div class="drill-levels">${D.LEVELS.map(l => `<label class="drill-level"><input type="radio" name="drillLevel" value="${l.id}" ${prefs.level === l.id ? 'checked' : ''}><span><b>${l.title}</b><small>${l.note}</small></span></label>`).join('')}</div></fieldset>
      <div class="drill-options"><label for="drillCount">Questions<select id="drillCount">${COUNTS.map(n => `<option value="${n}" ${prefs.count === n ? 'selected' : ''}>${n} questions</option>`).join('')}</select></label>
      <label for="drillTarget">Time target<select id="drillTarget">${TARGETS.map(([n, t]) => `<option value="${n}" ${prefs.target === n ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
      <label class="selfcheck"><input type="checkbox" id="drillAloud" ${prefs.aloud ? 'checked' : ''}> Read each question aloud, like an interviewer would</label>
      <label class="selfcheck"><input type="checkbox" id="drillListen" ${prefs.listen ? 'checked' : ''}> Listening practice: hide the written question (exhibits stay visible)</label>
      <div class="actions"><button class="primary" id="drillStart">Start round →</button><span id="drillSetupStatus" class="note" role="status"></span></div></section>
    <section class="panel drill-stats"><h2>Your progress</h2>${practised ? `<p class="note">Accuracy and median time to a correct answer, from your last 30 attempts of each skill.</p>
      <table class="drill-table"><thead><tr><th scope="col">Skill</th><th scope="col">Accuracy</th><th scope="col">Median time</th></tr></thead><tbody>${stats.map(s => `<tr><th scope="row">${esc(s.title)}<small>${s.attempts} attempt${s.attempts === 1 ? '' : 's'}</small></th><td>${s.attempts ? `<div class="drill-meter" aria-hidden="true"><span style="width:${Math.round(s.accuracy * 100)}%"></span></div>${percent(s.accuracy)}` : '<span class="subtle">Not practised</span>'}</td><td>${seconds(s.medianSeconds)}</td></tr>`).join('')}</tbody></table>
      ${weak ? `<div class="drill-suggest"><p><b>Practise next: ${esc(weak.title)}</b><br><span class="note">${percent(weak.accuracy)} accuracy over ${weak.attempts} attempts. ${esc(skillOf(weak.skill).tip)}</span></p><button id="drillWeak" data-skill="${weak.skill}">5 ${esc(weak.title.toLowerCase())} questions →</button></div>` : ''}
      <h3>Recent rounds</h3><ul class="drill-recent">${runs.slice(-5).reverse().map(r => `<li><span>${esc(new Date(r.at).toLocaleDateString())} · ${esc(levelOf(r.level).title)}</span><b>${r.correct}/${r.results.length}</b></li>`).join('')}</ul>
      <button id="drillClear" class="drill-link">Delete drill history</button>` : `<p class="note">Complete a round to see accuracy and speed for each skill, and which one to practise next. Progress stays in this browser.</p>`}
      <h3>How answers are checked</h3><p class="note">Exact calculations accept small rounding differences. Estimates and compounding questions show their accepted range before you answer. Every answer comes with the working and a mental-maths shortcut.</p></section></div>`;
    const checked = () => [...document.querySelectorAll('[name=drillSkill]:checked')].map(x => x.value);
    const remember = () => { prefs = cleanPrefs({ skills: checked(), level: document.querySelector('[name=drillLevel]:checked')?.value, count: $('#drillCount').value, target: $('#drillTarget').value, aloud: $('#drillAloud').checked || $('#drillListen').checked, listen: $('#drillListen').checked }); save(PREFS_KEY, prefs); };
    $('#drillAll').onclick = () => { document.querySelectorAll('[name=drillSkill]').forEach(x => x.checked = true); remember(); };
    $('#drillNone').onclick = () => document.querySelectorAll('[name=drillSkill]').forEach(x => x.checked = false);
    $('#drillListen').onchange = e => { if (e.target.checked) $('#drillAloud').checked = true; remember(); };
    $('#drillAloud').onchange = e => { if (!e.target.checked) $('#drillListen').checked = false; remember(); };
    document.querySelectorAll('.drill-setup select, [name=drillLevel], [name=drillSkill]').forEach(x => x.addEventListener('change', () => { if (checked().length) remember(); }));
    $('#drillStart').onclick = () => {
      if (!checked().length) { $('#drillSetupStatus').textContent = 'Choose at least one skill.'; return; }
      remember(); begin(D.buildRound({ skills: prefs.skills, level: prefs.level, count: prefs.count, seed: Date.now() }), 'new');
    };
    if ($('#drillResume')) $('#drillResume').onclick = () => { if (!run.results[run.index]) run.qStarted = Date.now(); persistRun(); renderQuestion(); };
    if ($('#drillDiscard')) $('#drillDiscard').onclick = () => { if (!confirm('Discard this unfinished round? Answers in it will not count towards your progress.')) return; run = null; persistRun(); renderHome(); };
    if ($('#drillWeak')) $('#drillWeak').onclick = e => begin(D.buildRound({ skills: [e.currentTarget.dataset.skill], level: prefs.level, count: 5, seed: Date.now() }), 'weakest');
    if ($('#drillClear')) $('#drillClear').onclick = () => { if (!confirm('Delete all drill rounds and progress from this browser? This cannot be undone.')) return; runs = []; save(HISTORY_KEY, runs); renderHome(); };
  }

  /** Entry point for the next-round planner: a round of the given skills, without changing saved preferences. */
  function quick({ skills = prefs.skills, count = 10 } = {}) {
    const chosen = skills.filter(s => D.SKILL_IDS.includes(s));
    setHash(true); begin(D.buildRound({ skills: chosen.length ? chosen : prefs.skills, level: prefs.level, count, seed: Date.now() }), 'plan');
  }
  function begin(questions, origin, level = prefs.level) {
    if (run && !confirm('Replace your unfinished round? Its answers will not count towards your progress.')) return;
    run = { id: 'd' + Date.now().toString(36), origin, level, target: prefs.target, aloud: prefs.aloud, listen: prefs.listen, questions, results: [], index: 0, started: Date.now(), qStarted: Date.now() };
    persistRun(); renderQuestion();
  }

  /* ---------- Question ---------- */
  function chartMarkup(chart) {
    const W = 560, H = 270, top = 46, bottom = 40, plot = H - top - bottom, n = chart.series.length, groupW = (W - 20) / n, barW = Math.min(46, groupW * 0.32), gap = 6;
    const max = Math.max(...chart.series.flatMap(s => s.values));
    const bars = chart.series.map((s, i) => s.values.map((v, j) => {
      const h = Math.max(2, v / max * (plot - 20)), x = 10 + i * groupW + groupW / 2 - barW - gap / 2 + j * (barW + gap), y = top + plot - h;
      return `<rect class="bar y${j}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3"/><text class="val" x="${(x + barW / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}">${esc(D.fmt(v))}</text>`;
    }).join('') + `<text class="cat" x="${(10 + i * groupW + groupW / 2).toFixed(1)}" y="${H - 14}">${esc(s.label)}</text>`).join('');
    const legend = chart.years.map((y, j) => `<rect class="bar y${j}" x="${10 + j * 90}" y="8" width="14" height="14" rx="3"/><text class="leg" x="${30 + j * 90}" y="20">${y}</text>`).join('');
    const summary = chart.series.map(s => `${s.label}: ${chart.years.map((y, j) => `${y} ${s.values[j]}`).join(', ')}`).join('; ');
    return `<figure class="drill-chart"><figcaption>${esc(chart.title)}</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(chart.title + '. ' + summary)}">${legend}<line class="axis" x1="10" x2="${W - 10}" y1="${top + plot}" y2="${top + plot}"/>${bars}</svg>
      <table class="sr-only"><caption>${esc(chart.title)}</caption><tr><th scope="col">Segment</th>${chart.years.map(y => `<th scope="col">${y}</th>`).join('')}</tr>${chart.series.map(s => `<tr><th scope="row">${esc(s.label)}</th>${s.values.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</table></figure>`;
  }

  function feedbackMarkup(q, r, last) {
    const given = r.skipped ? '' : `You answered <b>${esc(q.type === 'choice' ? q.choices[r.value] : r.answer)}</b>. `;
    const slow = run.target && !r.skipped && r.seconds > run.target;
    return `<div class="drill-feedback ${r.ok ? 'ok' : 'miss'}" id="drillFeedback" role="status"><h3>${r.ok ? '✓ Correct' : r.skipped ? 'Worked answer' : '✗ Not quite'}</h3>
      <p>${given}The answer is <b>${esc(q.display)}</b>.${r.skipped ? '' : ` Time: ${seconds(r.seconds)}${slow ? ` · over your ${run.target}s target` : ''}.`}</p>
      <ol class="drill-steps">${q.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol><p class="note"><b>Shortcut:</b> ${esc(q.tip)}</p></div>`;
  }

  function renderQuestion() {
    if (!run) return renderHome();
    stopMedia(); view = 'drill'; screen = 'question'; if (!run.results[run.index]) window.scrollTo(0, 0);
    const q = run.questions[run.index], r = run.results[run.index], last = run.index === run.questions.length - 1, skill = skillOf(q.skill);
    const hidePrompt = run.listen && !r && !run.showPrompt;
    const answerArea = r ? feedbackMarkup(q, r, last) : q.type === 'choice'
      ? `<div class="drill-choices" role="group" aria-label="Choose one">${q.choices.map((c, i) => `<button type="button" data-choice="${i}">${esc(c)}</button>`).join('')}</div>`
      : `<form id="drillForm" class="drill-answer" autocomplete="off" novalidate><label for="drillInput">Your answer${q.unit ? ` (${esc(q.unit)})` : ''}</label><div class="drill-input-row"><input id="drillInput" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="Type a number, then press Enter"></div><p class="note" id="drillHint" role="status">${esc(q.toleranceLabel)}. Commas, ₹ and % are fine.</p></form>`;
    $('#app').innerHTML = `<div class="row"><div><div class="eyebrow">CASE MATHS DRILL · ${esc(levelOf(run.level).title.toUpperCase())}</div><h2 class="section-title">Question ${run.index + 1} of ${run.questions.length}</h2></div><div class="flow-head-side"><span class="badge" id="drillTimer" aria-live="off">${r ? seconds(r.seconds) : '0s'}</span><button class="wu-link" id="drillExit">Exit · progress is saved</button></div></div>
      <div class="drill-bar" aria-hidden="true"><span style="width:${Math.round(run.results.length / run.questions.length * 100)}%"></span></div>
      <section class="panel drill-card"><div class="eyebrow">${esc(skill.title)}</div>
      ${hidePrompt ? `<p class="drill-prompt drill-hidden" id="drillPrompt">Listen to the question.</p><div class="drill-inline"><button id="drillShowPrompt">Show written question</button></div>` : `<p class="drill-prompt" id="drillPrompt">${esc(q.prompt)}</p>`}
      ${q.chart ? chartMarkup(q.chart) : ''}
      <div class="speech-controls"><button id="drillSpeak" class="listen">🔊 Listen</button><span id="speechStatus" class="sr-only" role="status"></span></div>
      ${answerArea}
      ${flowBar({ back: `${r ? '' : '<button class="wu-link" id="drillReveal">Show the working</button>'}<button class="wu-link" id="drillEnd">End round now</button>`,
        primary: r ? `<button class="primary next" id="drillNext">${last ? 'See results →' : 'Next question →'}</button>`
          : q.type === 'choice' ? '' : '<button class="primary next" type="submit" form="drillForm" id="drillCheck">Check →</button>',
        hint: r ? '' : q.type === 'choice' ? 'Choose an answer to check it.' : '' })}</section>`;
    $('#drillSpeak').onclick = () => speak(q.spoken || q.prompt);
    if ($('#drillShowPrompt')) $('#drillShowPrompt').onclick = () => { run.showPrompt = true; persistRun(); renderQuestion(); };
    $('#drillExit').onclick = renderHome;
    $('#drillEnd').onclick = () => { if (!run.results.length) { if (confirm('End this round? No questions have been answered, so nothing will be saved.')) { run = null; persistRun(); renderHome(); } return; } if (confirm('End the round now? Answered questions will count towards your progress.')) finish(); };
    if ($('#drillReveal')) $('#drillReveal').onclick = () => record({ answer: '', value: null, ok: false, skipped: true });
    if ($('#drillForm')) {
      $('#drillForm').onsubmit = e => {
        e.preventDefault(); const raw = $('#drillInput').value, c = D.check(q, raw);
        if (!c.valid) { const m = 'Enter a number, for example 12.5, 1,200 or -4.'; $('#drillHint').textContent = m; nudge(m, '#drillInput'); return; }
        record({ answer: raw.trim(), value: c.value, ok: c.ok, skipped: false });
      };
      $('#drillInput').focus({ preventScroll: true });
    }
    document.querySelectorAll('[data-choice]').forEach(b => b.onclick = () => { const c = D.check(q, b.dataset.choice); record({ answer: q.choices[c.value], value: c.value, ok: c.ok, skipped: false }); });
    if ($('#drillNext')) { $('#drillNext').onclick = next; $('#drillNext').focus({ preventScroll: true }); }
    if (!r && (run.aloud || run.listen) && !run.spokenFor?.includes(run.index)) { run.spokenFor = [...(run.spokenFor || []), run.index]; persistRun(); speak(q.spoken || q.prompt); }
  }

  function record(result) {
    result.seconds = Math.round((Date.now() - (run.qStarted || Date.now())) / 100) / 10;
    run.results[run.index] = result; persistRun(); renderQuestion();
  }
  function next() {
    if (run.index >= run.questions.length - 1) return finish();
    run.index++; run.qStarted = Date.now(); run.showPrompt = false; persistRun(); renderQuestion();
  }

  /* ---------- Results ---------- */
  function finish() {
    const answered = run.questions.slice(0, run.results.length).map((q, i) => ({ q, r: run.results[i] })).filter(x => x.r);
    const entry = { id: run.id, at: Date.now(), origin: run.origin, level: run.level, target: run.target, correct: answered.filter(x => x.r.ok).length,
      results: answered.map(({ q, r }) => ({ skill: q.skill, kind: q.kind, ok: !!r.ok, skipped: !!r.skipped, seconds: r.seconds })) };
    runs.push(entry); runs = runs.slice(-MAX_RUNS); save(HISTORY_KEY, runs);
    lastResult = { ...run, answered, record: entry }; run = null; persistRun(); renderResults(lastResult);
  }

  function summaryText(res) {
    return `CASE ROOM — MATHS DRILL\n${new Date(res.record.at).toLocaleString()} · ${levelOf(res.level).title}\nScore: ${res.record.correct}/${res.answered.length}\n\n` +
      res.answered.map(({ q, r }, i) => `${i + 1}. [${skillOf(q.skill).title}] ${q.prompt}\n   ${r.skipped ? 'Skipped' : (r.ok ? 'Correct' : 'Incorrect') + ' — you answered ' + (q.type === 'choice' ? q.choices[r.value] : r.answer) + ` (${seconds(r.seconds)})`}\n   Answer: ${q.display}\n   Working: ${q.steps.join(' → ')}`).join('\n\n') + '\n';
  }

  function renderResults(res) {
    stopMedia(); view = 'drill'; screen = 'results'; window.scrollTo(0, 0);
    const { answered, record: rec } = res, missed = answered.filter(x => !x.r.ok), times = answered.filter(x => x.r.ok).map(x => x.r.seconds);
    const onTarget = res.target ? answered.filter(x => x.r.ok && x.r.seconds <= res.target).length : null;
    const bySkill = D.SKILLS.map(s => ({ s, list: answered.filter(x => x.q.skill === s.id) })).filter(x => x.list.length);
    $('#app').innerHTML = `<div class="eyebrow">ROUND COMPLETE · ${esc(levelOf(res.level).title.toUpperCase())}</div><h1 class="drill-title">${rec.correct} of ${answered.length} correct</h1>
      <div class="score-grid"><div><div class="metric">${percent(rec.correct / answered.length)}</div><span class="note">Accuracy</span></div><div><div class="metric">${seconds(D.median(times))}</div><span class="note">Median time when correct</span></div><div><div class="metric">${answered.filter(x => x.r.skipped).length}</div><span class="note">Working revealed</span></div><div><div class="metric">${onTarget == null ? '—' : onTarget}</div><span class="note">${onTarget == null ? 'No time target set' : `Correct within ${res.target}s`}</span></div></div>
      <section class="panel drill-results"><h2>By skill</h2><table class="drill-table"><tbody>${bySkill.map(({ s, list }) => `<tr><th scope="row">${esc(s.title)}</th><td>${list.filter(x => x.r.ok).length}/${list.length}</td><td class="note">${esc(s.tip)}</td></tr>`).join('')}</tbody></table>
      <h2>Every question</h2>${answered.map(({ q, r }, i) => `<details class="drill-review ${r.ok ? 'ok' : 'miss'}" ${r.ok ? '' : 'open'}><summary><span>${r.ok ? '✓' : r.skipped ? '–' : '✗'}</span> ${i + 1}. ${esc(q.prompt)}</summary>${q.chart ? chartMarkup(q.chart) : ''}<p>${r.skipped ? 'Working revealed.' : `You answered <b>${esc(q.type === 'choice' ? q.choices[r.value] : r.answer)}</b> in ${seconds(r.seconds)}.`} Answer: <b>${esc(q.display)}</b></p><ol class="drill-steps">${q.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></details>`).join('')}
      <div class="actions">${missed.length ? `<button class="primary" id="drillRetry">Retry the ${missed.length} I missed</button>` : ''}<button ${missed.length ? '' : 'class="primary"'} id="drillAgain">New round, same settings</button><button id="drillBack">Drill home</button><button id="drillDownload">Download summary</button></div></section>`;
    if ($('#drillRetry')) $('#drillRetry').onclick = () => begin(missed.map(x => JSON.parse(JSON.stringify(x.q))), 'retry', res.level);
    $('#drillAgain').onclick = () => begin(D.buildRound({ skills: prefs.skills, level: prefs.level, count: prefs.count, seed: Date.now() }), 'new');
    $('#drillBack').onclick = renderHome;
    $('#drillDownload').onclick = () => download(summaryText(res), `case-room-maths-drill-${new Date(rec.at).toISOString().slice(0, 10)}.txt`);
  }

  setInterval(() => {
    if (view !== 'drill' || screen !== 'question' || !run || run.results[run.index] || !$('#drillTimer')) return;
    const s = Math.floor((Date.now() - run.qStarted) / 1000);
    $('#drillTimer').textContent = seconds(s); $('#drillTimer').classList.toggle('over', !!run.target && s > run.target);
  }, 500);

  /* ---------- Integration with the rest of Case Room ---------- */
  const priorHome = home;
  home = function () {
    priorHome(); if (location.hash === '#drill') setHash(false);
  };


  window.CaseDrill = { open, quick, state: () => ({ run, runs, prefs, screen, lastResult }) };
})();
