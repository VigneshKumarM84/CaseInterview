/* Résumé and project defence: the question rules, then the screens. */
const test = require('node:test'), assert = require('node:assert/strict');
const D = require('../src/defence-content.js'), W = require('../content/resume-words.js'), R = require('../src/resume-check.js');

const GAP = /undefined|\bnull\b|NaN|\[object/;
const ids = line => D.lineQuestions(line).map(q => q.id);
const ask = (line, id) => D.lineQuestions(line).find(q => q.id === id);
const STOCK = 'Built an Excel model to forecast demand for 120 SKUs, cutting stock-outs by 18% over six weeks';

/* ---------- Reading a line ---------- */
test('reading a line: a claimed change in each of its three shapes, with the thing that changed', () => {
  const c = D.readClaim(STOCK);
  assert.deepEqual({ ...c.change }, { verb: 'cutting', metric: 'stock-outs', figure: '18%', shape: 'by', said: 'stock-outs changed by 18%' });
  assert.equal(c.count, '120 SKUs'); assert.equal(c.period, 'six weeks'); assert.equal(c.tool, 'Excel'); assert.equal(c.method, 'model'); assert.equal(c.measure, null, 'a claimed change is the measure');
  assert.equal(D.readClaim('Increased Instagram followers from 400 to 2,100 in three months').change.said, 'Instagram followers went from 400 to 2,100');
  assert.equal(D.readClaim('Raised class attendance to 85%.').change.said, 'class attendance reached 85%');
  const loose = D.readClaim('Improved page load time, saving 30% on hosting').change; assert.equal(loose.figure, '30%'); assert.equal(loose.said, null, 'a unit figure beside a verb of change, with no recognised shape');
  assert.equal(D.readClaim('Reduced waste in the canteen').change, null, 'a verb of change with no figure is not a claimed change');
  assert.equal(D.readClaim('Surveyed 180 students in 2024').change, null);
});

test('reading a line: counts, years and ordinals, vague openers, being in charge, tools and methods', () => {
  assert.equal(D.readClaim('Analysed customer feedback from 2,400 app reviews and presented the top five complaints').count, '2,400 app reviews');
  assert.deepEqual(D.readClaim('Won 2nd prize in the 2024 hackathon').figures, [], 'years and ordinals are not figures');
  assert.equal(D.readClaim('Won 2nd prize in the 2024 hackathon').recognition, true);
  assert.equal(D.readClaim('Treasurer: managed a ₹2 lakh annual budget for 8 events').measure, '8 events');
  assert.equal(D.readClaim('• Helped the marketing team with various campaigns etc.').weak, 'helped', 'bullet marks are stripped');
  assert.equal(D.readClaim('I was responsible for preparing weekly reports').weak, 'responsible for'); assert.equal(D.readClaim('Responsible for preparing weekly reports').weak, 'responsible for');
  assert.equal(D.readClaim('Built a tool that helped the team track attendance').weak, null, 'only the opening words count');
  const led = D.readClaim('Led a team of 6 to build a line-following robot using Arduino and C'); assert.equal(led.lead, 'led'); assert.equal(led.team, 'team of 6'); assert.equal(led.tool, 'Arduino');
  assert.equal(D.readClaim('Surveyed 180 students, which led the café to raise combo prices by ₹20').lead, null, '"led" in the middle of a line is not being in charge');
  assert.equal(D.readClaim('Analysed 2,400 app reviews').method, null, '"app" is not a method'); assert.equal(D.readClaim('Wrote the parser in C for the compiler course').tool, 'C'); assert.equal(D.readClaim('Cleaned the data').tool, null);
  assert.equal(D.readClaim('x'.repeat(900)).text.length, D.LIMITS.line); assert.equal(D.readClaim(null).text, '');
});

/* ---------- Questions ---------- */
test('line questions: open on the story, close on what went wrong, and probe a claimed change first', () => {
  assert.deepEqual(ids(STOCK), ['walk', 'evidence', 'rival', 'contribution', 'limit'], 'five at most: the tool question gives way to the claim');
  assert.match(ask(STOCK, 'walk').text, /“Built an Excel model.*six weeks”/);
  assert.equal(ask(STOCK, 'evidence').text, 'You say stock-outs changed by 18%. How was that measured, what was it before, and what was it after?');
  assert.match(ask(STOCK, 'rival').text, /What else changed in that period that could explain the 18%\?/); assert.match(ask(STOCK, 'rival').why, /season, a promotion/);
  assert.match(ask('Increased Instagram followers from 400 to 2,100 in three months', 'evidence').text, /went from 400 to 2,100\. How was that measured, and who else saw those numbers\?/);
  assert.match(ask('Raised class attendance to 85%', 'evidence').text, /reached 85%\. How was that measured, and what was it before\?/);
  assert.match(ask('Improved page load time, saving 30% on hosting', 'evidence').text, /^You wrote 30%\. What is that a change in/);
  assert.equal(D.lineQuestions(STOCK, { max: 3 }).length, 3); assert.deepEqual(D.lineQuestions(STOCK, { max: 6 }).map(q => q.id), ['walk', 'evidence', 'rival', 'contribution', 'method', 'limit']);
  assert.match(D.lineQuestions(STOCK, { max: 6 })[4].text, /You used Excel here/);
});

test('line questions: counts, no number, prizes, vague openers, teams, tools and methods', () => {
  assert.match(ask('Analysed customer feedback from 2,400 app reviews', 'evidence').text, /^You mention 2,400 app reviews\. What came out of the work/);
  assert.match(ask('Led a team of 6 to build a robot', 'evidence').text, /^This line gives no result\./);
  assert.match(ask('Data was cleaned by me before every review meeting', 'evidence').text, /^There is no number in this line/);
  assert.match(ask('Won 2nd prize in the 2024 hackathon', 'evidence').text, /How many others were in the running/);
  assert.match(ask('Helped the marketing team with various campaigns etc.', 'contribution').text, /The line says “helped”\. What exactly did you do yourself/);
  assert.match(ask('Managed a team of 15 volunteers', 'contribution').text, /^You managed a team of 15 volunteers\. Tell me about one problem inside that team/);
  assert.match(ask('Coordinated 12 volunteers for a blood donation camp', 'contribution').text, /^You coordinated 12 volunteers\./);
  assert.match(ask('Built a tool that helped the team track attendance', 'contribution').text, /^Who else worked on this/);
  assert.match(ask('Managed the donation tracking sheet', 'contribution').text, /hardest decision you made yourself/);
  assert.match(ask('Worked on a dashboard in Tableau for the café owner', 'method').text, /You used Tableau here/);
  assert.match(ask('Managed the survey', 'method').text, /Explain the survey to me/); assert.equal(ask('Managed the donation sheet', 'method'), undefined);
});

test('every bullet of the sample résumé gets a complete, gap-free set of questions and hints', () => {
  const bullets = R.parse(W.SAMPLE_RESUME).bullets.map(b => b.text); assert(bullets.length >= 10);
  for (const b of bullets.concat(['', 'ok', '₹', '100%', 'from 5 to 6'])) {
    const qs = D.lineQuestions(b); assert(qs.length >= 3 && qs.length <= 5, b); assert.equal(qs[0].id, 'walk'); assert.equal(qs.at(-1).id, 'limit');
    assert.equal(new Set(qs.map(q => q.id)).size, qs.length, 'no question twice: ' + b);
    for (const q of qs) { assert(q.text && q.why && q.listenFor.length === 3, b); assert(!GAP.test(q.text + q.why + q.listenFor.join(' ')), q.text); }
    const hints = D.rewriteHints(b); assert(hints.length >= 1 && !GAP.test(hints.join(' ')), b); assert.equal(hints.at(-1), 'Keep only what you could defend if asked again.');
  }
});

test('project questions: five, in order, worded for the kind of project', () => {
  const qs = D.projectQuestions({ title: 'Line-following robot', kind: 'project' });
  assert.deepEqual(qs.map(q => q.id), ['choice', 'contribution', 'failed', 'evidence', 'limit']); assert.match(qs[0].text, /^Tell me about Line-following robot\./);
  assert.match(qs[1].text, /Which part did you do yourself/);
  assert.match(D.projectQuestions({ title: 'Sales report', kind: 'internship' })[1].text, /What were you given to do/);
  assert.match(D.projectQuestions({ title: 'Shop register', kind: 'family' })[1].text, /as opposed to how things already ran/);
  assert.match(D.projectQuestions({ kind: 'nope' })[0].text, /^Tell me about your project\./); assert.equal(D.kindOf('nope').id, 'project');
  assert.equal(D.KINDS.length, 6); for (const k of D.KINDS) assert(k.label && k.example);
  for (const k of D.KINDS) for (const q of D.projectQuestions({ title: 'T', kind: k.id })) { assert.equal(q.listenFor.length, 3); assert(!GAP.test(q.text + q.why)); }
});

test('follow-ups: at most one, for a brief answer, "we" on the contribution question, or no number on the evidence question', () => {
  const long = 'I ' + 'worked through the plan carefully with the group '.repeat(6);
  assert.deepEqual(D.followUp({ id: 'walk' }, 'It was fine.'), { id: 'brief', text: 'That was brief. Give me the specifics: what happened, step by step?', why: 'Your answer was 3 words.' });
  assert.equal(D.followUp({ id: 'walk' }, long), null);
  const we = D.followUp({ id: 'contribution' }, 'We ' + 'planned it and we built it and we tested it together as a group '.repeat(3)); assert.equal(we.id, 'we'); assert.match(we.why, /“we” \d+ times and “I” 0 times/);
  assert.equal(D.followUp({ id: 'walk' }, 'We ' + 'planned it and we built it and we tested it together as a group '.repeat(3)), null, 'only on the contribution question');
  assert.equal(D.followUp({ id: 'evidence' }, long).id, 'number'); assert.equal(D.followUp({ id: 'evidence' }, long + ' It went from 11% to 9%.'), null);
  assert.equal(D.followUp({ id: 'limit' }, long), null); assert.equal(D.followUp(null, '').id, 'brief');
});

test('rewrite hints follow what the line lacks, and answers map onto a story', () => {
  assert.deepEqual(D.rewriteHints('Helped the marketing team with various campaigns etc.').slice(0, 2), ['Replace “helped” with the verb for what you did yourself.', 'Add the number you gave in your answers, if you can stand behind it.']);
  assert.deepEqual(D.rewriteHints(STOCK), ['Give the starting point as well as the change, if there is room.', 'Keep only what you could defend if asked again.']);
  assert(D.rewriteHints('Raised class attendance to 85%').includes('Say over what period the change was measured.'));
  assert(D.rewriteHints('Managed a team of 15 volunteers').includes('After “15 volunteers”, say what the work led to.')); assert(D.rewriteHints('Managed a team of 15 volunteers').includes('Make your own part clear, separate from the team’s.'));
  assert.equal(D.rewriteHints('Won 2nd prize in the hackathon')[0], 'Say how many others were in the running.');
  const s = D.toStory({ kind: 'line', line: STOCK, answers: [{ id: 'walk', text: 'At Kiranakart.' }, { id: 'evidence', text: 'From 11% to 9%.', reply: 'Measured weekly.' }, { id: 'rival', text: 'A festival week.' }, { id: 'contribution', text: 'I built the model.' }, { id: 'limit', text: 'Test longer.' }] });
  assert.equal(s.title, STOCK); assert.equal(s.s, 'At Kiranakart.'); assert.equal(s.a, 'I built the model.'); assert.equal(s.t, ''); assert.deepEqual(s.tags, []);
  assert.equal(s.r, 'From 11% to 9%. Measured weekly.\n\nOther explanations considered: A festival week.\n\nWhat I would change: Test longer.');
  const p = D.toStory({ kind: 'project', title: 'Robot', answers: [{ id: 'choice', text: 'A maze problem.' }, { id: 'failed', text: 'The first sensor.' }] });
  assert.equal(p.title, 'Robot'); assert.equal(p.s, 'A maze problem.'); assert.equal(p.a, 'What did not work: The first sensor.'); assert.deepEqual(D.toStory(), { title: '', s: '', t: '', a: '', r: '', tags: [] });
});

/* ---------- The screens ---------- */
const { fixture } = require('./dom.cjs');
const q = (f, s) => f.w.document.querySelector(s);
const qa = (f, s) => [...f.w.document.querySelectorAll(s)];
const text = f => q(f, '#app').textContent;
const input = (f, el, v) => { el.value = v; el.dispatchEvent(new f.w.Event('input', { bubbles: true })); };
const change = (f, el) => el.dispatchEvent(new f.w.Event('change', { bubbles: true }));
const state = f => JSON.parse(f.run('JSON.stringify(DefenceTool.state())'));
const storageOf = f => { const s = {}; for (const k of Object.keys(f.w.localStorage)) s[k] = f.w.localStorage.getItem(k); return s; };
const at = (f, ms) => f.run(`Date.now = () => ${ms}`);
const noGaps = (f, where) => assert(!GAP.test(text(f)), `${where}: ${text(f).match(GAP)}`);
function fakeRecognition(f) {
  const made = []; f.w.SpeechRecognition = function () { made.push(this); this.start = () => this.onstart?.(); this.abort = () => { this.aborted = true; this.onend?.(); }; this.stop = this.abort; };
  return { made, say(t) { made.at(-1).onresult({ results: [[{ transcript: t }]] }); } };
}
/* Over 25 words, with "I", a figure and no "we": it draws no follow-up on any question. */
const FULL = 'I built the forecast in Excel and checked it every week against what actually sold. Stock-outs went from 11% to 9% across the six weeks, and I fixed the formulas whenever a product was wrong.';
const BRIEF = 'It was at Kiranakart.';
const type = (f, v) => input(f, f.$('dfAnswer'), v);
function startLine(f, line = STOCK) { f.run('DefenceTool.open()'); input(f, f.$('dfLine'), line); f.$('dfStartLine').click(); }
function startProject(f, title, kind = 'project') { f.run('DefenceTool.open()'); f.$('dfKind').value = kind; change(f, f.$('dfKind')); input(f, f.$('dfTitle'), title); f.$('dfStartProject').click(); }
/* Answers every remaining question (and follow-up) with the same text until the debrief shows. */
function finishAll(f, say = FULL) { let guard = 0; while (state(f).run && guard++ < 30) { type(f, say); f.$('dfFinish').click(); } assert.equal(state(f).screen, 'debrief'); }
const STOCK_QS = D.lineQuestions(STOCK);

test('a full line defence: only the question is shown, a brief answer draws one follow-up, then a debrief with reasons, ticks, a rewrite and a download', () => {
  const f = fixture(); let g; try {
    f.run('DefenceTool.open()'); noGaps(f, 'home');
    assert.match(text(f), /RÉSUMÉ AND PROJECT DEFENCE/); assert.match(text(f), /Defend what you wrote\./); assert.equal(f.$('dfResume'), null, 'nothing to resume yet'); assert.equal(f.$('dfPick'), null, 'no checked résumé, no picker');
    assert.equal(q(f, '.df-past'), null); assert(f.$('dfLine').placeholder.includes('stock-outs by 18%'));
    f.$('dfStartLine').click(); assert.match(f.$('flowHint').textContent, /at least 4 words/); assert.equal(state(f).run, null);
    input(f, f.$('dfLine'), 'Built a model'); f.$('dfStartLine').click(); assert.equal(state(f).run, null, 'three words is too short');
    input(f, f.$('dfLine'), '  • ' + STOCK + '  '); f.$('dfStartLine').click();
    let s = state(f); assert.equal(s.screen, 'question'); assert.equal(s.run.kind, 'line'); assert.equal(s.run.line, STOCK, 'the bullet marker is dropped'); assert.equal(s.run.fromResume, false);
    assert.deepEqual(s.run.questions.map(x => x.id), STOCK_QS.map(x => x.id)); assert.equal(f.w.location.hash, '#defence');
    // Nothing but the question: no reasons, no listen-for text, no skip, retry or help.
    const shown = () => text(f);
    assert.match(shown(), /RÉSUMÉ DEFENCE · INTERVIEW CONDITIONS/); assert.match(shown(), /Question 1 of 5/); assert.match(shown(), /THE INTERVIEWER ASKS/); assert.equal(f.$('dfPrompt').textContent, STOCK_QS[0].text);
    assert.equal(qa(f, '.flow-progress li').length, 5); assert.equal(qa(f, '.flow-bar .primary').length, 1); assert.equal(f.$('dfFinish').textContent, 'I have finished answering →'); assert.equal(f.$('dfExit').textContent, 'End the defence');
    assert.deepEqual(qa(f, '#app button').map(b => b.id).filter(Boolean).filter(id => !['homeNav', 'planNav', 'resumeNav', 'aptitudeNav', 'casesNav', 'behaviouralNav', 'historyNav', 'privacy', 'closeModal'].includes(id)).sort(), ['dfExit', 'dfFinish', 'dfMic', 'speak', 'stopSpeech', 'voiceSettings']);
    assert.equal(q(f, '.flow-help'), null); assert(!/Why it was asked|listen for|Did your answer cover/i.test(shown()));
    for (const x of STOCK_QS[0].listenFor.concat(STOCK_QS[0].why)) assert(!shown().includes(x), x);
    assert.deepEqual(f.w.__spoken, [STOCK_QS[0].text], 'asked aloud once, without being told to');
    f.$('dfFinish').click(); assert.match(f.$('flowHint').textContent, /Say or type something first/); assert.equal(state(f).run.answers.length, 0);
    // A brief answer draws the “brief” follow-up, and its reply is saved with the answer.
    type(f, BRIEF); f.$('dfFinish').click(); s = state(f);
    assert.equal(s.run.answers.length, 1); assert.equal(s.run.follow.id, 'brief'); assert.match(shown(), /Question 1 of 5 · follow-up/); assert.match(shown(), /THE INTERVIEWER FOLLOWS UP/);
    assert.equal(f.$('dfPrompt').textContent, s.run.follow.text); assert.equal(f.w.__spoken.at(-1), s.run.follow.text); assert(!shown().includes(s.run.follow.why), 'the reason is not shown during the defence'); assert.equal(f.$('dfAnswer').value, '');
    type(f, FULL); f.$('dfFinish').click(); s = state(f);
    assert.equal(s.run.answers[0].follow.id, 'brief'); assert.equal(s.run.answers[0].reply, FULL); assert.equal(s.run.follow, null, 'a follow-up never gets a follow-up'); assert.equal(s.run.index, 1); assert.match(shown(), /Question 2 of 5/);
    assert.equal(f.w.__spoken.length, 3);
    for (let i = 1; i < 5; i++) { assert.equal(f.$('dfPrompt').textContent, STOCK_QS[i].text); type(f, FULL); f.$('dfFinish').click(); }
    // Debrief.
    s = state(f); assert.equal(s.screen, 'debrief'); assert.equal(s.run, null); assert.equal(s.past.length, 1); assert.equal(f.w.localStorage.getItem('cr-defence-run'), 'null');
    assert.equal(s.past[0].answers.filter(a => a.follow).length, 1, 'only the brief answer drew a follow-up');
    noGaps(f, 'debrief'); assert.match(text(f), /RÉSUMÉ DEFENCE · DEFENCE OVER/); assert.match(text(f), /You answered 5 of 5 questions\./); assert(text(f).includes('“' + STOCK + '”'));
    assert.match(q(f, '.bh-honest-box').textContent, /check whether a claim is true/);
    const items = qa(f, 'ol.bh-debrief > li'); assert.equal(items.length, 5);
    items.forEach((li, i) => {
      assert(li.textContent.includes(STOCK_QS[i].text)); assert(li.textContent.includes('Why it was asked: ' + STOCK_QS[i].why)); assert.equal(li.querySelectorAll('details.df-answer').length, i === 0 ? 2 : 1);
      assert.equal(li.querySelector('details').open, false, 'answers start collapsed'); assert.match(li.querySelector('details summary').textContent, /Your answer · \d+ words/);
      assert.equal(li.querySelectorAll('input[data-df-heard]').length, 3); assert.deepEqual(qa(f, 'ol.bh-debrief > li')[i].querySelectorAll('.selfcheck').length, 3);
      for (const x of STOCK_QS[i].listenFor) assert(li.textContent.includes(x));
    });
    assert.match(items[0].querySelector('legend').textContent, /Did your answer cover these\? Tick only what you clearly said\./);
    const asked = items[0].querySelector('.bh-asked'); assert(asked.textContent.includes(s.past[0].answers[0].follow.text)); assert(asked.textContent.includes('Why it was asked: Your answer was 4 words.')); assert(asked.textContent.includes(FULL));
    // Ticks persist.
    const box = (i, k) => q(f, `[data-df-heard="${i}-${k}"]`); box(0, 1).checked = true; change(f, box(0, 1)); box(3, 0).checked = true; change(f, box(3, 0)); box(3, 2).checked = true; change(f, box(3, 2)); box(3, 2).checked = false; change(f, box(3, 2));
    assert.deepEqual(state(f).past[0].heard, { 0: [1], 3: [0] });
    // The rewrite box checks the line live with the résumé checker's rules.
    assert.equal(f.$('dfRewrite').value, STOCK); assert.deepEqual(qa(f, '#dfHints li').map(x => x.textContent), D.rewriteHints(STOCK));
    const labels = () => qa(f, '#dfChecks li b').map(x => x.textContent), expect = t => R.lintBullet(t).checks.map(c => c.label);
    assert.deepEqual(labels(), expect(STOCK)); assert(qa(f, '#dfChecks .rc-mark').length > 0); assert.match(text(f), /résumé checker’s heuristics/);
    const weak = 'Helped with various reports etc.'; input(f, f.$('dfRewrite'), weak); assert.deepEqual(labels(), expect(weak)); assert(qa(f, '#dfChecks li.warn').length > 0, 'a weak line shows warnings');
    assert.equal(qa(f, '#dfChecks li.warn').length, R.lintBullet(weak).checks.filter(c => c.status === 'warn').length);
    const better = 'Built an Excel forecast for 120 SKUs, cutting stock-outs from 11% to 9% in six weeks'; input(f, f.$('dfRewrite'), better); assert.equal(state(f).past[0].rewrite, better);
    assert.equal(f.$('dfPutBack'), null, 'no résumé loaded in the checker, so no put-back'); assert.equal(f.$('dfStory').textContent, 'Save as a story'); assert.equal(f.$('dfOpenStories'), null);
    // Download.
    f.run('download = (text, name) => { window.__dl = { text, name }; }'); f.$('dfDownload').click();
    const dl = f.run('window.__dl.text'); assert.match(f.run('window.__dl.name'), /^case-room-defence-\d{4}-\d{2}-\d{2}\.txt$/);
    for (const x of [STOCK, better, FULL, BRIEF, s.past[0].answers[0].follow.text, 'Why it was asked: Your answer was 4 words.', ...STOCK_QS.flatMap(x => [x.text, 'Why it was asked: ' + x.why])]) assert(dl.includes(x), x.slice(0, 40));
    assert(dl.includes('[x] ' + STOCK_QS[0].listenFor[1]) && dl.includes('[ ] ' + STOCK_QS[0].listenFor[0])); assert(!GAP.test(dl), dl.match(GAP));
    // Back to the home page: it is in the past list, and the ticks and rewrite survive a reload.
    f.$('dfBack').click(); assert.match(q(f, '.df-past').textContent, /Past defences/); assert.match(q(f, '.df-past').textContent, /5 of 5 questions answered/); noGaps(f, 'home with past');
    g = fixture({ url: 'https://case.example/#defence', storage: storageOf(f) }); assert.equal(g.run('view'), 'defence'); assert.equal(state(g).past.length, 1);
    q(g, '[data-df-view]').click(); assert(g.$('dfRewrite').value === better); assert(q(g, '[data-df-heard="0-1"]').checked); assert(!q(g, '[data-df-heard="0-0"]').checked); assert(q(g, '[data-df-heard="3-0"]').checked); assert(!q(g, '[data-df-heard="3-2"]').checked);
    g.$('dfAgain').click(); assert.equal(g.w.document.activeElement.id, 'dfLine', '“Defend another” opens the line box');
    // Delete one, then all.
    q(g, '[data-df-delete]').click(); assert.equal(state(g).past.length, 0); assert.equal(q(g, '.df-past'), null);
    assert.deepEqual([...f.errors, ...g.errors], []);
  } finally { f.dom.window.close(); g?.dom.window.close(); }
});

test('a project defence asks five questions in order; an empty title is refused; typed text is escaped', () => {
  const f = fixture(); try {
    f.run('DefenceTool.open()'); assert.equal(f.$('dfKind').options.length, D.KINDS.length); assert.match(text(f), /No internship is needed/);
    assert.equal(f.$('dfTitle').placeholder, D.KINDS[0].example); f.$('dfKind').value = 'internship'; change(f, f.$('dfKind')); assert.equal(f.$('dfTitle').placeholder, D.kindOf('internship').example);
    f.$('dfStartProject').click(); assert.equal(state(f).run, null); assert.match(f.$('flowHint').textContent, /name or a short description/); assert.equal(f.w.document.activeElement.id, 'dfTitle');
    input(f, f.$('dfTitle'), '   '); f.$('dfStartProject').click(); assert.equal(state(f).run, null, 'spaces are not a title');
    const title = 'Weekly sales report <img src=x onerror="window.__x=1">';
    input(f, f.$('dfTitle'), title); f.$('dfStartProject').click();
    const want = D.projectQuestions({ title: title, kind: 'internship' }), s = state(f);
    assert.equal(s.run.kind, 'project'); assert.equal(s.run.projectKind, 'internship'); assert.deepEqual(s.run.questions.map(x => x.id), ['choice', 'contribution', 'failed', 'evidence', 'limit']); assert.match(text(f), /PROJECT DEFENCE · INTERVIEW CONDITIONS/);
    for (let i = 0; i < 5; i++) { assert.match(text(f), new RegExp(`Question ${i + 1} of 5`)); assert.equal(f.$('dfPrompt').textContent, want[i].text); noGaps(f, 'question ' + i); type(f, FULL); f.$('dfFinish').click(); }
    assert.equal(f.$('dfPrompt'), null); assert.match(text(f), /PROJECT DEFENCE · DEFENCE OVER/); assert(text(f).includes(title), 'the title is shown as text'); assert.equal(f.w.__x, undefined); assert.equal(q(f, '#app img'), null);
    assert.equal(f.$('dfRewrite'), null, 'no line to rewrite for a project'); assert(f.$('dfStory')); noGaps(f, 'project debrief');
    f.run('download = (text, name) => { window.__dl = { text, name }; }'); f.$('dfDownload').click(); assert(f.run('window.__dl.text').includes('PROJECT (Internship task)')); assert(!/REWRITTEN LINE/.test(f.run('window.__dl.text')));
    // A line is escaped too.
    f.$('dfAgain').click(); assert.equal(f.w.document.activeElement.id, 'dfKind', '“Defend another” after a project opens the project panel');
    startLine(f, '<img src=x onerror="window.__x=2"> Built a model for 120 SKUs and cut waste'); assert.equal(f.w.__x, undefined); assert(f.$('dfPrompt').textContent.includes('<img src=x')); assert.equal(q(f, '#app img'), null);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('the résumé checker links in: defend a bullet, rewrite it and put it back, with nothing stored unless the student opted in', () => {
  const f = fixture(); try {
    f.$('resumeNav').click(); assert.equal(ResumeToolHas(f, STOCK), false, 'nothing is checked yet'); f.$('rcSample').click(); f.$('rcCheck').click();
    const idx = qa(f, '.rc-btext').findIndex(x => x.textContent === STOCK); assert(idx >= 0, 'the stock-outs bullet is in the sample');
    const btn = q(f, `[data-defend="${idx}"]`); assert.equal(btn.textContent, 'Defend this line in an interview →'); assert(btn.closest('details.rc-bullet'), 'inside the bullet'); assert.equal(qa(f, '[data-defend]').length, f.run('ResumeTool.state().analysis.bullets.length'));
    // An edit made in the checker is what gets defended.
    const edited = STOCK + ' for the category team'; input(f, f.$('rcEdit' + idx), edited);
    btn.click(); let s = state(f); assert.equal(f.run('view'), 'defence'); assert.equal(s.screen, 'question'); assert.equal(s.run.line, edited); assert.equal(s.run.fromResume, true);
    // Back to the original wording, then defend again: the unfinished defence is replaced after a confirm.
    f.$('resumeNav').click(); input(f, f.$('rcEdit' + idx), STOCK); let asked = 0; f.w.confirm = () => { asked++; return false; };
    q(f, `[data-defend="${idx}"]`).click(); assert.equal(asked, 1); assert.equal(state(f).run.line, edited, 'declining keeps the unfinished defence'); assert.equal(f.run('view'), 'resume');
    f.w.confirm = () => true; q(f, `[data-defend="${idx}"]`).click(); assert.equal(state(f).run.line, STOCK); assert.equal(f.w.__spoken.at(-1), D.lineQuestions(STOCK)[0].text);
    finishAll(f); assert.equal(f.run('view'), 'defence');
    assert(f.$('dfPutBack'), 'the line is in the résumé loaded in the checker'); assert.equal(f.$('dfPutBack').textContent, 'Put it back in my résumé');
    const better = 'Built an Excel forecast for 120 SKUs, cutting stock-outs from 11% to 9% in six weeks';
    input(f, f.$('dfRewrite'), better); f.$('dfPutBack').click();
    assert.match(f.$('toast').textContent, /Put the new line back/); assert.equal(state(f).past[0].line, better, 'the session now holds the new line, so it can be found again'); assert.equal(f.$('dfOrig').textContent, better);
    let saved = ''; f.w.Blob = function (parts) { saved = parts.join(''); }; f.$('dfDownload').click();
    assert.match(saved, /REWRITTEN LINE\nThe line above is your rewritten line\. You put it back into your résumé\./, 'the download does not say "not rewritten" after a put-back'); assert.equal(state(f).past[0].putBack, true);
    const draft = f.run('ResumeTool.state().draft.resume'); assert(draft.includes(better)); assert(!draft.includes(STOCK)); assert(draft.includes('Helped the marketing team'), 'the rest of the résumé is untouched');
    assert(f.run(`ResumeTool.state().analysis.bullets.some(b => b.text === ${JSON.stringify(better)})`)); assert(!f.run(`ResumeTool.state().analysis.bullets.some(b => b.text === ${JSON.stringify(STOCK)})`));
    assert.equal(f.w.localStorage.getItem('cr-resume-text'), null, 'the résumé is not stored without “Remember my text”');
    f.$('resumeNav').click(); assert(f.$('rcResume').value.includes(better)); assert(!f.$('rcResume').value.includes(STOCK)); assert(qa(f, '.rc-btext').some(x => x.textContent === better)); assert(!qa(f, '.rc-btext').some(x => x.textContent === STOCK));
    // A line that is not in the résumé is refused, and the put-back button is not offered for it.
    assert.equal(f.run(`ResumeTool.replaceBullet('A line that is not there at all', 'x y z')`), false); assert.equal(f.run(`ResumeTool.hasBullet(${JSON.stringify(better.replace(/ /g, '  '))})`), true, 'spacing is ignored');
    // The picker lists the checked résumé's bullets; choosing one fills the line box and marks the defence as from the résumé.
    f.run('DefenceTool.open()'); const opts = qa(f, '#dfPick option'); assert.equal(opts.length, 1 + f.run('ResumeTool.state().analysis.bullets.length'));
    f.$('dfPick').value = String(idx); change(f, f.$('dfPick')); assert.equal(f.$('dfLine').value, better); f.w.confirm = () => true; f.$('dfStartLine').click(); assert.equal(state(f).run.fromResume, true);
    // The put-back works with the résumé screen showing too: the box and the checks update in place.
    f.$('resumeNav').click(); const again = 'Built an Excel forecast for 120 SKUs, cutting stock-outs from 11% to 9% over six weeks'; assert.equal(f.run(`ResumeTool.replaceBullet(${JSON.stringify(better)}, ${JSON.stringify(again)})`), true);
    assert(f.$('rcResume').value.includes(again)); assert.equal(f.$('rcText' + idx).textContent, again);
    // A line too short to question goes to the line box instead of starting.
    f.run("DefenceTool.openLine('Managed the survey', { fromResume: true })"); f.w.confirm = () => true; assert.equal(f.w.document.activeElement.id, 'dfLine'); assert.equal(f.$('dfLine').value, 'Managed the survey'); assert.match(f.$('flowHint').textContent, /fewer than 4 words/);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
  function ResumeToolHas(f, t) { return f.run(`ResumeTool.hasBullet(${JSON.stringify(t)})`); }
});

test('“Save as a story” copies the answers into the story bank once, and saving again updates the same story', () => {
  const f = fixture(); try {
    startLine(f); const answers = ['At Kiranakart.', 'Measured weekly.', 'A festival week.', 'I built the model.', 'Test for longer.'];
    for (const a of answers) { type(f, a.repeat(3)); f.$('dfFinish').click(); if (state(f).run?.follow) { type(f, 'Step by step, I did it myself.'); f.$('dfFinish').click(); } }
    const s = state(f).past[0]; assert.equal(f.run('Behavioural.state().stories.length'), 0);
    f.$('dfStory').click(); let st = JSON.parse(f.run('JSON.stringify(Behavioural.state().stories)'));
    assert.equal(st.length, 1); assert.equal(st[0].id, 'df' + s.id); assert.match(st[0].id, /^[\w-]{1,40}$/); const want = D.toStory({ kind: 'line', line: STOCK, answers: s.answers });
    assert.deepEqual({ title: st[0].title, s: st[0].s, t: st[0].t, a: st[0].a, r: st[0].r, tags: st[0].tags }, want); assert(st[0].s.includes('At Kiranakart.'));
    assert.equal(f.$('dfStory').textContent, 'Saved · update it'); assert(f.$('dfOpenStories')); assert.equal(f.$('toast').textContent, 'Saved to your story bank. Tag the competencies it covers there.'); assert.equal(state(f).past[0].storySaved, true);
    f.$('dfStory').click(); assert.equal(f.run('Behavioural.state().stories.length'), 1, 'saved twice, still one story'); assert.equal(f.w.document.querySelectorAll('#dfStory').length, 1);
    f.$('dfOpenStories').click(); assert.equal(f.run('view'), 'behavioural'); assert.equal(f.run('Behavioural.state().screen'), 'stories'); assert(text(f).includes(STOCK));
    // A full story bank is reported, not hidden.
    const f2 = fixture({ storage: { 'cr-behavioural-stories': JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ id: 's' + i, title: 'Story ' + i, s: 'x' }))) } }); try {
      startLine(f2); finishAll(f2); f2.$('dfStory').click(); assert.match(f2.$('toast').textContent, /story bank is full/); assert.equal(f2.$('dfStory').textContent, 'Save as a story'); assert.equal(f2.run('Behavioural.state().stories.length'), 30); assert.deepEqual(f2.errors, []);
    } finally { f2.dom.window.close(); }
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('a reload mid follow-up resumes at the same follow-up with the typed text; unfinished defences are listed on the home page', () => {
  const f = fixture(); let g; try {
    startLine(f); type(f, BRIEF); f.$('dfFinish').click(); const fu = state(f).run.follow; type(f, 'Typed so far but not'); at(f, 5000);
    g = fixture({ url: 'https://case.example/#defence', storage: storageOf(f) });
    assert.equal(g.run('view'), 'defence'); assert.equal(state(g).screen, 'home'); assert(g.$('dfResume')); assert.match(q(g, '.bh-resume').textContent, /Question 1 of 5 · follow-up/); assert(q(g, '.bh-resume').textContent.includes('Excel model')); noGaps(g, 'resume panel');
    g.$('dfResume').click(); assert.match(text(g), /Question 1 of 5 · follow-up/); assert.equal(g.$('dfPrompt').textContent, fu.text); assert.equal(g.$('dfAnswer').value, 'Typed so far but not'); assert.equal(g.$('dfTimerText').textContent, '0:00');
    assert.equal(g.w.__spoken, undefined, 'not read out a second time'); assert.equal(state(g).run.answers[0].text, BRIEF);
    type(g, FULL); g.$('dfFinish').click(); assert.match(text(g), /Question 2 of 5/); assert.equal(state(g).run.answers[0].reply, FULL);
    // The home page lists it under “Continue where you left off”, and carries on from there.
    g.run('home()'); const cont = q(g, '[data-continue="defence"]'); assert(cont); assert.match(cont.textContent, /Defence/); assert(cont.textContent.includes('Built an Excel model')); assert.match(cont.textContent, /Question 2 of 5/);
    cont.click(); assert.equal(g.run('view'), 'defence'); assert.match(text(g), /Question 2 of 5/);
    // Discard asks first when something was answered.
    g.run('DefenceTool.open()'); let asked = 0; g.w.confirm = () => { asked++; return false; }; g.$('dfDiscard').click(); assert.equal(asked, 1); assert(state(g).run); g.w.confirm = () => true; g.$('dfDiscard').click(); assert.equal(state(g).run, null); assert.equal(g.w.localStorage.getItem('cr-defence-run'), 'null'); assert.equal(g.$('dfResume'), null);
    assert.deepEqual([...f.errors, ...g.errors], []);
  } finally { f.dom.window.close(); g?.dom.window.close(); }
});

test('“End the defence”: nothing answered discards it, something answered goes to the debrief, and cancelling keeps going', () => {
  const f = fixture(); try {
    startLine(f); type(f, 'Half a thought'); let msg = ''; f.w.confirm = m => { msg = m; return false; }; f.$('dfExit').click();
    assert.equal(state(f).screen, 'question'); assert.match(msg, /Nothing has been answered/); assert.equal(f.$('dfAnswer').value, 'Half a thought');
    f.w.confirm = () => true; f.$('dfExit').click(); assert.equal(state(f).run, null); assert.equal(state(f).past.length, 0); assert.equal(state(f).screen, 'home'); assert(f.$('dfStartLine')); assert.equal(f.$('dfResume'), null);
    startLine(f); type(f, FULL); f.$('dfFinish').click(); type(f, 'Not saved'); f.w.confirm = m => { msg = m; return true; }; f.$('dfExit').click();
    assert.match(msg, /not saved/); const s = state(f); assert.equal(s.screen, 'debrief'); assert.equal(s.run, null); assert.equal(s.past.length, 1); assert.equal(s.past[0].answers.length, 1);
    assert.match(text(f), /You answered 1 of 5 questions\./); assert.equal(qa(f, 'ol.bh-debrief > li .note').filter(n => n.textContent === 'Not asked.').length, 4);
    assert.equal(qa(f, '[data-df-heard]').length, 3, 'only the answered question has ticks'); assert(!text(f).includes('Not saved')); noGaps(f, 'early debrief');
    // Ended during a follow-up: the main answer is kept, and the follow-up is shown as not answered.
    startLine(f); type(f, BRIEF); f.$('dfFinish').click(); f.$('dfExit').click(); assert.equal(state(f).past[0].answers.length, 1); assert.equal(state(f).past[0].answers[0].follow, null); assert.match(text(f), /You answered 1 of 5/);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('corrupt or half-edited stored sessions are ignored or repaired without errors', () => {
  const q1 = { id: 'walk', text: 'Take me through it.', why: 'Because.', listenFor: ['a', 'b', 'c'] }, q2 = { id: 'limit', text: 'What went wrong?', why: 'Why.', listenFor: ['d', 'e', 'f'] };
  const goodPast = { id: 'ok1', kind: 'project', title: 'Robot', projectKind: 'zzz', questions: [{ ...q1, id: 'choice' }], answers: [{ id: 'choice', text: 'An answer', seconds: -5, voice: 'yes', follow: { text: 'More?', why: 'w' }, reply: '' }], heard: { 0: [1, 1, 9, 'x'], 7: [0], abc: [1] }, rewrite: 5, finished: 1700000000000 };
  const storage = { 'cr-defence-run': '{bad json', 'cr-defence-past': JSON.stringify([{ kind: 'line' }, 'x', null, { kind: 'line', line: 'A line of four words', questions: [q1], answers: [{ id: 'zzz', text: 'x' }], finished: 1 }, { ...goodPast, id: 'bad id!' }, goodPast, { ...goodPast, questions: 'no' }]) };
  const f = fixture({ storage }); let g, h, k; try {
    const s = state(f); assert.equal(s.run, null); assert.equal(s.past.length, 2, 'only the two usable records are kept'); const p = s.past.find(x => x.id === 'ok1');
    assert.equal(p.projectKind, 'project'); assert.equal(p.answers[0].seconds, null); assert.equal(p.answers[0].voice, true); assert.equal(p.answers[0].follow, null, 'a follow-up with no reply is dropped'); assert.deepEqual(p.heard, { 0: [1] }); assert.equal(p.rewrite, null);
    assert.match(s.past.find(x => x.id !== 'ok1').id, /^[\w-]{1,30}$/); f.run('DefenceTool.open()'); noGaps(f, 'home with repaired past'); qa(f, '[data-df-view]').forEach(b => { b.click(); noGaps(f, 'view'); f.run('DefenceTool.open()'); });
    // A run whose index points past its answers is repaired to the first unanswered question; the typed text is kept.
    const a1 = { id: 'walk', text: 'Answer one', follow: { text: 'Q?', why: 'w' }, reply: 'Reply one' };
    g = fixture({ storage: { 'cr-defence-run': JSON.stringify({ kind: 'line', line: 'Built a thing with care', questions: [q1, q2], answers: [a1], index: 7, follow: { text: 'Why?' }, draft: 'hello', elapsedMs: 90000 }) } });
    let r = state(g).run; assert.equal(r.index, 1); assert.equal(r.follow, null, 'a follow-up stored after one was already answered is dropped'); assert.equal(r.draft, 'hello'); g.run('DefenceTool.resume()'); assert.match(text(g), /Question 2 of 2/); assert.equal(g.$('dfAnswer').value, 'hello'); assert.equal(g.$('dfTimerText').textContent, '1:30');
    // An answer with a follow-up still pending is a valid place to resume.
    const g2 = fixture({ storage: { 'cr-defence-run': JSON.stringify({ kind: 'line', line: 'Built a thing with care', questions: [q1, q2], answers: [{ id: 'walk', text: 'Answer one' }], index: 3, follow: { id: 'brief', text: 'Why?', why: 'Short.' }, draft: 'part' }) } }); try {
      assert.equal(state(g2).run.index, 0); assert.equal(state(g2).run.follow.text, 'Why?'); g2.run('DefenceTool.resume()'); assert.match(text(g2), /Question 1 of 2 · follow-up/); assert.equal(g2.$('dfAnswer').value, 'part'); assert.deepEqual(g2.errors, []);
    } finally { g2.dom.window.close(); }
    // A run with every question answered and no debrief is finished on load.
    h = fixture({ storage: { 'cr-defence-run': JSON.stringify({ kind: 'line', line: 'Built a thing with care', questions: [q1, q2], answers: [a1, { id: 'limit', text: 'Answer two' }], index: 1 }) } });
    assert.equal(state(h).run, null); assert.equal(state(h).past.length, 1); assert.equal(h.w.localStorage.getItem('cr-defence-run'), 'null');
    // Wrong shapes everywhere.
    k = fixture({ storage: { 'cr-defence-run': '[1,2]', 'cr-defence-past': '{"not":"a list"}' } }); assert.equal(state(k).run, null); assert.deepEqual(state(k).past, []); k.run('DefenceTool.open()'); noGaps(k, 'empty'); assert.equal(q(k, '.df-past'), null);
    for (const x of [f, g, h, k]) assert.deepEqual(x.errors, []);
  } finally { f.dom.window.close(); g?.dom.window.close(); h?.dom.window.close(); k?.dom.window.close(); }
});

test('dictation fills the answer and marks it as spoken; the clock starts with the first words', async () => {
  const f = fixture(); try {
    const rec = fakeRecognition(f); startLine(f); at(f, 1000000); assert.equal(f.$('dfTimerText').textContent, '0:00', 'the clock waits for the first words');
    f.$('dfMic').click(); assert.equal(rec.made.length, 1); assert.equal(rec.made[0].lang, 'en-IN'); assert.equal(state(f).run.voice, true); assert.equal(f.$('dfMic').textContent, '■ Stop dictation');
    rec.say('I built the model myself'); assert.equal(f.$('dfAnswer').value, 'I built the model myself'); assert.equal(state(f).run.draft, 'I built the model myself'); assert.equal(f.$('dfAnswer').readOnly, true);
    at(f, 1042000); await new Promise(r => setTimeout(r, 700)); assert.equal(f.$('dfTimerText').textContent, '0:42', 'the clock updates every half second');
    f.$('dfFinish').click(); const s = state(f); assert.equal(s.run.answers[0].voice, true); assert.equal(s.run.answers[0].seconds, 42); assert.equal(rec.made[0].aborted, true, 'dictation stops when the answer is handed in');
    assert.equal(s.run.voice, false, 'the next answer starts as typed'); assert.equal(s.run.follow.id, 'brief'); assert.equal(f.$('dfTimerText').textContent, '0:00');
    // Typing starts the clock; leaving the screen pauses it, and the time is kept.
    at(f, 2000000); type(f, 'Typed answer'); at(f, 2010000); f.run('DefenceTool.open()'); at(f, 2900000); assert.equal(state(f).run.elapsedMs, 10000); f.$('dfResume').click(); assert.equal(f.$('dfTimerText').textContent, '0:10');
    // A browser without dictation says so and still lets the student type.
    const g = fixture(); try { startLine(g); assert.equal(g.$('dfMic').disabled, true); assert.match(g.$('dfVoiceStatus').textContent, /Dictation unavailable/); type(g, FULL); g.$('dfFinish').click(); assert.equal(state(g).run.answers[0].voice, false); assert.deepEqual(g.errors, []); } finally { g.dom.window.close(); }
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('without speech synthesis the questions are not read aloud and nothing is announced', () => {
  const f = fixture(); try {
    f.w.speechSynthesis = undefined; startLine(f); assert.equal(f.$('toast').textContent, ''); assert.equal(f.$('speak').disabled, true); assert.equal(f.$('dfPrompt').textContent, STOCK_QS[0].text); assert.equal(state(f).run.spoken, true);
    type(f, FULL); f.$('dfFinish').click(); assert.match(text(f), /Question 2 of 5/); assert.equal(f.$('toast').textContent, ''); assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('planner: the technical plan starts with the project defence and opens the project panel; the HR plan offers a line defence', () => {
  const f = fixture(); try {
    f.$('homePlan').click(); const pick = (name, value) => { const r = q(f, `[name=${name}][value="${value}"]`); r.checked = true; change(f, r); };
    pick('nrRound', 'technical'); const items = () => qa(f, '#nrItems [data-item]').map(li => li.dataset.item);
    assert.equal(items()[0], 'defence-project'); assert.match(q(f, '[data-item="defence-project"]').textContent, /Defend a project: five questions/); assert.match(q(f, '[data-item="defence-project"]').textContent, /Technical and HR interviews? both start|Technical and HR interviewers both start/);
    q(f, '[data-go="defence-project"]').click(); assert.equal(f.run('view'), 'defence'); assert.equal(state(f).screen, 'home'); assert.equal(f.w.document.activeElement.id, 'dfKind'); assert.equal(f.w.location.hash, '#defence'); assert.equal(state(f).run, null, 'it opens the panel; it does not start a defence');
    f.run('NextRoundTool.open()'); pick('nrRound', 'hr'); assert(items().includes('defence-line')); q(f, '[data-go="defence-line"]').click(); assert.equal(f.w.document.activeElement.id, 'dfLine');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('the HR page and the home page link to the defence, and its route is #defence', () => {
  const f = fixture(); let g; try {
    assert.match(q(f, '#round-hr').textContent, /a bank of stories, and a résumé or project defence\./);
    f.$('round-hr').click(); assert(f.$('bhDefence')); assert.equal(f.$('bhDefence').textContent, 'Open résumé and project defence →'); assert.match(f.$('bhDefence').closest('.panel').textContent, /Defend your résumé or a project/); assert(f.$('bhDefence').closest('.bh-side'));
    f.$('bhDefence').click(); assert.equal(f.run('view'), 'defence'); assert.equal(f.w.location.hash, '#defence');
    f.$('homeNav').click(); assert.equal(f.w.location.hash, '', 'leaving clears the route');
    g = fixture({ url: 'https://case.example/#defence' }); assert.equal(g.run('view'), 'defence'); assert(g.$('dfStartLine'));
    const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
    for (const [a, b] of [['src/resume.js', 'src/defence-content.js'], ['src/defence-content.js', 'src/defence.js'], ['src/defence.js', 'src/home.js']]) assert(html.indexOf(a) < html.indexOf(b), `${a} before ${b}`);
    assert(html.includes('assets/defence.css')); assert(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'src', 'boot.js'), 'utf8').includes('#defence (résumé and project defence)'));
    assert.deepEqual([...f.errors, ...g.errors], []);
  } finally { f.dom.window.close(); g?.dom.window.close(); }
});

test('the defence does not disturb other tools, and keeps to its own two storage keys', () => {
  const f = fixture(); try {
    f.run("start('cement')"); input(f, f.$('answer'), 'Case answer'); f.run('CaseDrill.open()'); f.$('drillStart').click(); f.run("PeerMock.start('market')");
    f.$('behaviouralNav').click(); f.$('bhStart').click(); input(f, f.$('bhAnswer'), 'I did it and we won by 10%.'); f.$('bhFinish').click(); f.run('Behavioural.stories()'); f.$('bhNewStory').click(); input(f, f.$('bhTitle'), 'Story');
    const before = { session: f.run('JSON.stringify(session)'), drill: f.run('JSON.stringify(CaseDrill.state().run)'), peer: f.run('JSON.stringify(PeerMock.state().run)'), bh: f.run('JSON.stringify(Behavioural.state())') }, keys = storageOf(f);
    startLine(f); finishAll(f); input(f, f.$('dfRewrite'), 'A new line of at least four words'); startProject(f, 'Robot'); type(f, 'Half an answer');
    assert.equal(f.run('JSON.stringify(session)'), before.session); assert.equal(f.run('JSON.stringify(CaseDrill.state().run)'), before.drill); assert.equal(f.run('JSON.stringify(PeerMock.state().run)'), before.peer);
    const after = storageOf(f); for (const k of Object.keys(keys)) if (!k.startsWith('cr-defence-')) assert.equal(after[k], keys[k], k + ' is untouched');
    assert.deepEqual(Object.keys(after).filter(k => !(k in keys)).sort(), ['cr-defence-past', 'cr-defence-run']); assert.equal(f.run('history.length'), 0); assert.equal(f.run('PeerMock.state().past.length'), 0);
    f.run('Behavioural.open()'); assert.equal(f.run('JSON.stringify(Behavioural.state().attempts)'), JSON.stringify(JSON.parse(before.bh).attempts), 'the HR answers are not changed');
    // The résumé text is never stored by the defence, and only the one line is.
    assert(!Object.values(after).some(v => v.includes('Riya Menon'))); assert.equal(JSON.parse(after['cr-defence-past'])[0].line, STOCK);
    f.$('homeNav').click(); assert.equal(f.w.location.hash, ''); assert.equal(f.w.document.querySelectorAll('.round-tile').length, 5); f.$('privacy').click(); assert.equal(f.$('modal').open, true);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});
