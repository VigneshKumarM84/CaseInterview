const test = require('node:test'), assert = require('node:assert/strict');
const C = require('../content/moves.js'), L = require('../src/moves-logic.js');
const { fixture } = require('./dom.cjs');
const doc = f => f.w.document, text = f => f.$('app').textContent;
const type = (f, id, v) => { const el = f.$(id); assert(el, id + ' exists'); el.value = v; el.dispatchEvent(new f.w.Event('input', { bubbles: true })); };
const view = f => f.run('view'), tool = f => JSON.parse(f.run('JSON.stringify(MovesTool.state())')); // plain data, so deepEqual is not caught out by jsdom's own Array
const kept = f => Object.fromEntries(['cr-moves-run', 'cr-moves-history', 'cr-moves-seen', 'cr-moves-transfer'].map(k => [k, f.w.localStorage.getItem(k)]).filter(([, v]) => v !== null));
/* A page whose fetch counts any request, so every test can show the tool stayed offline. */
function page(options) { const f = fixture(options); f.requests = 0; f.w.fetch = () => { f.requests++; throw Error('Unexpected request'); }; return f; }
const end = (f, ...more) => { assert.equal(f.requests, 0, 'no network request'); assert.deepEqual(f.errors, []); for (const g of [f, ...more]) g && g.dom.window.close(); };
const open = (f, id, seed) => { f.run(`MovesTool.openMove(${JSON.stringify(id)}, { seed: ${seed} })`); if (f.$('mvStart')) f.$('mvStart').click(); };
const setOf = (id, seed) => L.buildSet(id, { seed, recent: [] });
/* Plays the current item as a learner who gets it right; Do text answers use the item's strong example. */
function playRight(f, it) {
  if (it.rung === 'spot') {
    if (it.move === 'number-sense') { if (it.ok) f.$('mvRight').click(); else { f.$('mvOff').click(); f.$('mvSlip-' + it.slip).click(); } }
    else f.$('mvOpt-' + L.judgeSpot(it, it.move === 'answer-first' ? it.options.findIndex(o => o.kind === 'answer') : it.statements.findIndex(s => s.kind === 'insight')).answer).click();
  } else if (it.move === 'number-sense') { type(f, 'mvAnswer', String(it.correct)); f.$('mvCheck').click(); }
  else { type(f, 'mvAnswer', it.strong); f.$('mvCheck').click(); f.$('mvGrade-strong').click(); }
}
const readyHistory = (move, at = 1000) => [...Array.from({ length: 10 }, (_, i) => L.record({ move, rung: 'spot', id: 's' + i }, { ok: true, seconds: 5, at: at + i })),
  ...Array.from({ length: 3 }, (_, i) => L.record({ move, rung: 'do', id: 'd' + i }, { ok: true, seconds: 20, at: at + 20 + i, grade: 'strong' }))];
/* A finished session in the older, shorter format: enough for the report to draw. */
const session = (finished = 777) => ({ id: 'cement', version: 2, step: 3, started: 1000, finished, opened: [], answers: { structure: 's', number: 30, working: 'w', recommendation: 'r' }, probes: [], uid: 'u-' + finished });
const showReport = (f, finished) => f.run(`showReport(${JSON.stringify(session(finished))})`);

test('the hub opens from the home page and the Case interview page, and the deep links work', () => {
  const f = page(), g = page({ url: 'https://case.example/#moves/so-what' }), h = page({ url: 'https://case.example/#moves' }), k = page({ url: 'https://case.example/#moves/nonsense' });
  try {
    f.$('homeMovesHub').click(); assert.equal(view(f), 'moves'); assert.equal(f.w.location.hash, '#moves');
    assert.match(text(f), /One skill at a time, until it is a habit\./); for (const m of C.MOVES) assert(f.$('move-' + m.id), m.id);
    assert.equal(f.$('move-answer-first').textContent, 'Start →'); assert.match(text(f), /Pays off in: HR, case, group discussion, defence/); assert.match(text(f), /Not started/);
    f.$('homeNav').click(); assert.equal(f.w.location.hash, ''); assert.equal(view(f), 'home');
    f.$('round-case').click(); assert(f.$('caseTool-warmup').closest('.case-tool').classList.contains('first'), 'the warm-up stays first for a new visitor');
    const t = f.$('caseTool-moves'); assert.equal(t.textContent, 'Choose a move →'); assert.match(t.closest('.case-tool').textContent, /ONE SKILL · 5 MIN.*Train one move/s);
    t.click(); assert.equal(view(f), 'moves');
    assert.equal(view(g), 'moves'); assert.equal(g.w.location.hash, '#moves/so-what'); assert.equal(g.$('app').querySelector('h1').textContent, 'So what?'); assert(g.$('mvStart'));
    assert.equal(view(h), 'moves'); assert(h.$('move-so-what')); assert.equal(view(k), 'moves'); assert(k.$('move-number-sense'), 'an unknown move opens the hub');
  } finally { end(f, g, h, k); }
});

test('the home page lists the nine moves with their status', () => {
  const f = page({ storage: { 'cr-moves-history': JSON.stringify(readyHistory('so-what')) } });
  try {
    for (const m of C.MOVES) assert(f.$('homeMove-' + m.id), m.id);
    assert.match(f.$('homeMove-so-what').textContent, /So what\?.*Ready/s); assert.match(f.$('homeMove-answer-first').textContent, /Not started/);
    f.$('homeMove-number-sense').click(); assert.equal(view(f), 'moves'); assert.equal(tool(f).screen, 'learn');
  } finally { end(f); }
});

test('the rule shows the first time for a move and not the second', () => {
  const f = page();
  try {
    f.run("MovesTool.openMove('so-what', { seed: 4 })"); assert.equal(tool(f).screen, 'learn');
    const t = text(f); assert.match(t, /The rule/); assert.match(t, new RegExp(C.MOVES[1].rule[0].slice(0, 20))); assert.match(t, /Why it matters/); assert(f.$('app').querySelector('.mv-table'), 'the example table');
    assert.equal(f.$('app').querySelectorAll('.mv-rule li').length, 3); assert.match(t, /A weaker answer/); assert.match(t, /A stronger answer/); assert.deepEqual(tool(f).seen, []);
    f.$('mvStart').click(); assert.equal(tool(f).screen, 'item'); assert.deepEqual(tool(f).seen, ['so-what']); assert.equal(f.w.localStorage.getItem('cr-moves-seen'), '["so-what"]');
    f.run("MovesTool.openMove('so-what', { seed: 5 })"); assert.equal(tool(f).screen, 'item'); assert.equal(f.$('mvStart'), null, 'no rule the second time');
    f.$('mvRule').click(); assert.equal(tool(f).screen, 'learn'); assert.equal(f.$('mvStart').textContent, 'Back to your set →'); f.$('mvStart').click(); assert.equal(tool(f).screen, 'item');
    f.run("MovesTool.openMove('answer-first', { seed: 5 })"); assert.equal(tool(f).screen, 'learn', 'each move has its own first time');
  } finally { end(f); }
});

test('a full Answer first set: a wrong Spot pick, a failing Do answer, grades, results and history', () => {
  const f = page(), set = setOf('answer-first', 7);
  try {
    open(f, 'answer-first', 7); assert.equal(tool(f).run.items.length, 6);
    assert.match(text(f), /ANSWER FIRST · SPOT · 1 OF 4/); assert.match(text(f), new RegExp(set.items[0].question.slice(0, 25))); assert.equal(f.$('app').querySelectorAll('.mv-options button').length, 4); assert.equal(f.$('mvNext'), null);
    // Spot 1: pick a wrong option.
    const it = set.items[0], right = it.options.findIndex(o => o.kind === 'answer'), wrong = it.options.findIndex(o => o.kind === 'hedge' || o.kind === 'windup');
    f.$('mvOpt-' + wrong).click();
    assert(f.$('mvOpt-' + wrong).classList.contains('wrong')); assert(f.$('mvOpt-' + right).classList.contains('correct')); assert(f.$('mvOpt-' + wrong).disabled, 'options are locked');
    assert.match(f.$('mvOpt-' + wrong).textContent, /✗.*Your pick/s); assert.match(f.$('mvOpt-' + right).textContent, /✓.*The right one/s);
    const fb = f.$('mvFeedback'); assert.equal(fb.getAttribute('aria-live'), 'polite'); assert.equal(doc(f).activeElement, fb, 'focus moves to the feedback');
    assert(fb.textContent.includes(C.OPENINGS[it.options[wrong].kind].why)); assert(fb.textContent.includes('Why the right one works')); assert(fb.textContent.includes(C.OPENINGS.answer.why));
    for (const o of it.options) assert(f.$('app').textContent.includes(C.OPENINGS[o.kind].label), 'every option is labelled');
    f.$('mvNext').click();
    for (let i = 1; i < 4; i++) { const x = set.items[i]; f.$('mvOpt-' + x.options.findIndex(o => o.kind === 'answer')).click(); assert(f.$('mvFeedback').textContent.includes('✓ Right')); assert.equal(f.$('app').querySelectorAll('.mv-opt.wrong').length, 0); f.$('mvNext').click(); }
    // Do 1: a failing answer.
    assert.match(text(f), /ANSWER FIRST · DO · 1 OF 2/); assert.equal(f.$('mvNext'), null); assert.equal(f.$('mvCheck').textContent, 'Check my answer →'); assert(f.$('mvMic'), 'dictation row');
    f.$('mvCheck').click(); assert.equal(tool(f).run.results.length, 4, 'an empty answer does not submit'); assert.match(f.$('flowHint').textContent, /Write your answer/);
    type(f, 'mvAnswer', 'Hello'); f.$('mvCheck').click();
    assert(doc(f).querySelector('.bh-checks li.warn'), 'a warn check'); assert.equal(doc(f).querySelectorAll('.mv-grade').length, 3); assert.match(text(f), /look at the shape of your answer/); assert.match(text(f), /Which is yours closest to\?/);
    assert.equal(f.$('app').querySelector('.wu-yours').textContent, 'Hello');
    f.$('mvNext').click(); assert.equal(tool(f).run.index, 4, 'cannot continue without a grade'); assert.match(f.$('flowHint').textContent, /Choose which answer/);
    f.$('mvGrade-weak').click(); assert.equal(tool(f).history.at(-1).grade, 'weak'); f.$('mvNext').click();
    // Do 2: the strong example passes every check.
    assert.match(text(f), /DO · 2 OF 2/); type(f, 'mvAnswer', set.items[5].strong); f.$('mvCheck').click(); assert.equal(doc(f).querySelectorAll('.bh-checks li.warn').length, 0); f.$('mvGrade-strong').click();
    assert.equal(f.$('mvNext').textContent, 'See your results →'); f.$('mvNext').click();
    assert.equal(tool(f).screen, 'results'); assert.equal(tool(f).run, null); assert.equal(f.w.localStorage.getItem('cr-moves-run'), null);
    assert.match(text(f), /Spot: 3 of 4 right\./); assert.match(text(f), /Do: 1 of 2 passed\./); assert.match(f.$('mvStatus').textContent, /Spot: 3 of your last 4 right · Do: 1 of your last 2 passed/);
    assert.match(text(f), /still need 6 more Spot picks.*your last 3 Do reps all passing every check \(now 1 of 2\)/s); assert.equal(f.$('mvCases'), null);
    assert(f.$('mvAgain') && f.$('mvHub')); assert.equal(doc(f).querySelectorAll('.drill-review').length, 6);
    const h = JSON.parse(f.w.localStorage.getItem('cr-moves-history')); assert.equal(h.length, 6);
    assert.deepEqual(h.map(e => e.rung), ['spot', 'spot', 'spot', 'spot', 'do', 'do']); assert.deepEqual(h.map(e => e.ok), [false, true, true, true, false, true]);
    assert.equal(h[0].pick, it.options[wrong].kind); assert.equal(h[1].pick, 'answer'); assert(h.every(e => Number.isFinite(e.seconds) && e.seconds >= 0)); assert.equal(h[4].grade, 'weak'); assert.equal(h[5].grade, 'strong');
    f.$('mvHub').click(); assert.equal(f.$('move-answer-first').textContent, 'Another set →'); assert.match(text(f), /Spot: 3 of your last 4 right/);
    f.$('move-answer-first').click(); assert.equal(tool(f).screen, 'item'); assert.equal(tool(f).run.move, 'answer-first');
  } finally { end(f); }
});

test('Does that number make sense?: correct, caught with the right slip, caught with the wrong slip', () => {
  const f = page(), set = setOf('number-sense', 11), spots = set.items.filter(i => i.rung === 'spot');
  try {
    open(f, 'number-sense', 11); let sawOk = false, sawRight = false, sawWrong = false, wrongDone = false;
    for (const it of spots) {
      assert(f.$('app').textContent.includes(it.claim)); assert.equal(f.$('mvRight').textContent.trim(), 'Looks right'); assert.match(f.$('mvOff').textContent, /Something is off/); assert(f.$('mvClock'), 'soft clock'); assert.match(text(f), /target 0:15/);
      if (it.ok && !sawOk) {
        sawOk = true; f.$('mvRight').click(); assert(f.$('mvFeedback').textContent.includes('✓ Right')); assert(f.$('mvFeedback').textContent.includes('That figure was right.')); assert(f.$('mvFeedback').textContent.includes(it.why));
      } else if (!it.ok && !sawRight) {
        sawRight = true; f.$('mvOff').click(); assert(f.$('mvWhat'), 'the second step'); assert.equal(f.$('mvNext'), null); assert.equal(f.$('app').querySelectorAll('[id^=mvSlip-]').length, 4);
        for (const s of it.options) assert(f.$('mvSlip-' + s).textContent.includes(C.SLIPS.find(x => x.id === s).label));
        f.$('mvSlip-' + it.slip).click(); const t = f.$('mvFeedback').textContent; assert(t.includes('✓ Right')); assert(t.includes('named the slip')); assert(t.includes(C.SLIPS.find(x => x.id === it.slip).habit)); assert(t.includes(it.why));
        assert(f.$('mvSlip-' + it.slip).classList.contains('right'), 'the chosen slip is marked'); assert.equal(f.$('app').querySelectorAll('.drill-steps li').length, it.working.length);
      } else if (!it.ok && !wrongDone) {
        wrongDone = sawWrong = true; f.$('mvOff').click(); const bad = it.options.find(s => s !== it.slip); f.$('mvSlip-' + bad).click();
        assert(f.$('mvFeedback').textContent.includes('✗ Not quite')); assert(f.$('mvFeedback').textContent.includes('You caught that it was off, but the slip was: ' + C.SLIPS.find(x => x.id === it.slip).label));
        assert(f.$('mvSlip-' + bad).classList.contains('wrong')); assert(f.$('mvSlip-' + it.slip).classList.contains('correct'));
      } else playRight(f, it);
      f.$('mvNext').click();
    }
    assert(sawOk && sawRight && sawWrong);
    // Do rung: a numeric answer, Enter submits, unparseable input nudges.
    const d = set.items[spots.length]; assert.match(text(f), /NUMBER SENSE · DO · 1 OF 2|DOES THAT NUMBER MAKE SENSE\? · DO · 1 OF 2/); assert(f.$('app').textContent.includes(d.ask)); assert.equal(f.$('mvGrade-weak'), null);
    type(f, 'mvAnswer', 'no idea'); f.$('mvAnswer').dispatchEvent(new f.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); assert.equal(tool(f).run.results.length, spots.length); assert.match(f.$('flowHint').textContent, /as a number/);
    type(f, 'mvAnswer', String(d.correct * 3 + 1)); f.$('mvAnswer').dispatchEvent(new f.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert(f.$('mvFeedback').textContent.includes('✗ Not quite')); assert(f.$('mvFeedback').textContent.includes('The correct figure is')); assert(f.$('mvFeedback').textContent.includes(d.why)); f.$('mvNext').click();
    playRight(f, set.items[spots.length + 1]); assert(f.$('mvFeedback').textContent.includes('✓ Right')); f.$('mvNext').click();
    assert.equal(tool(f).screen, 'results'); const h = tool(f).history; assert.equal(h.length, 8);
    assert(h.filter(e => e.rung === 'spot').every(e => typeof e.pick === 'string')); assert(h.some(e => /^off:/.test(e.pick)));
  } finally { end(f); }
});

test('a So what? Spot item shows a real table, and the strong example passes every Do check', () => {
  const f = page(), set = setOf('so-what', 3);
  try {
    open(f, 'so-what', 3); const it = set.items[0], tb = f.$('app').querySelector('table.mv-table');
    assert(tb); assert.equal(tb.querySelector('caption').textContent, it.title); assert.equal(tb.querySelectorAll('thead th[scope=col]').length, it.table.columns.length); assert.equal(tb.querySelectorAll('tbody tr').length, it.table.rows.length);
    assert.equal(tb.querySelectorAll('tbody th[scope=row]').length, it.table.rows.length); assert.equal(tb.querySelectorAll('tbody td').length, it.table.rows.length * (it.table.columns.length - 1)); assert(tb.closest('.mv-table-box'), 'scrolls inside its own box');
    assert.equal(f.$('app').querySelectorAll('.mv-options button').length, 4); assert(f.$('app').textContent.includes(C.MOVES[1].spot.prompt));
    const wrong = it.statements.findIndex(s => s.kind === 'misread'); f.$('mvOpt-' + wrong).click();
    for (const s of it.statements) { assert(f.$('app').textContent.includes(C.STATEMENTS[s.kind].label)); assert(f.$('app').textContent.includes(s.why)); }
    assert(f.$('mvOpt-' + it.statements.findIndex(s => s.kind === 'insight')).classList.contains('correct')); f.$('mvNext').click();
    for (let i = 1; i < 5; i++) { playRight(f, set.items[i]); f.$('mvNext').click(); }
    for (let i = 5; i < 7; i++) {
      assert(f.$('app').querySelector('table.mv-table')); type(f, 'mvAnswer', set.items[i].strong); f.$('mvCheck').click();
      assert.equal(doc(f).querySelectorAll('.bh-checks li.warn').length, 0, 'strong passes every check'); assert(doc(f).querySelector('.bh-checks li.ok')); assert(f.$('mvFeedback').textContent.includes('✓ Every check passed')); f.$('mvGrade-strong').click(); f.$('mvNext').click();
    }
    assert.equal(tool(f).history.filter(e => e.rung === 'do' && e.ok).length, 2); assert.match(text(f), /Spot: 4 of 5 right\./);
  } finally { end(f); }
});

test('reloading mid-set resumes at the same item with the typed text, and Home lists it', () => {
  const f = page(), set = setOf('answer-first', 9); let g, h, k;
  try {
    open(f, 'answer-first', 9); for (let i = 0; i < 4; i++) { playRight(f, set.items[i]); f.$('mvNext').click(); }
    type(f, 'mvAnswer', 'A half-written reply');
    g = page({ storage: kept(f) }); assert.equal(view(g), 'home');
    const item = doc(g).querySelector('[data-continue=moves]'); assert(item); assert.match(item.textContent, /Move.*Answer first.*Item 5 of 6/s);
    item.click(); assert.equal(view(g), 'moves'); assert.equal(g.$('mvAnswer').value, 'A half-written reply'); assert.match(text(g), /DO · 1 OF 2/); assert.equal(tool(g).run.index, 4);
    h = page({ storage: kept(f), url: 'https://case.example/#moves/answer-first' }); assert.equal(h.$('mvAnswer').value, 'A half-written reply'); assert.equal(h.$('mvStart'), null);
    k = page({ storage: kept(f), url: 'https://case.example/#moves' }); assert.equal(k.$('move-answer-first').textContent, 'Continue →'); k.$('move-answer-first').click(); assert.equal(k.$('mvAnswer').value, 'A half-written reply');
    // Reload after checking: the feedback and the chosen grade come back.
    f.$('mvCheck').click(); f.$('mvGrade-adequate').click();
    const m = page({ storage: kept(f), url: 'https://case.example/#moves/answer-first' }); try { assert(m.$('mvFeedback')); assert(m.$('mvGrade-adequate').checked); assert(m.$('mvNext')); assert.equal(tool(m).history.length, 5); end(m); } catch (e) { m.dom.window.close(); throw e; }
    g.$('homeNav').click(); assert.equal(g.w.location.hash, ''); assert(doc(g).querySelector('[data-continue=moves]'), 'still listed until the set is finished');
  } finally { end(f, g, h, k); }
});

test('malformed saved data is dropped without an error, key by key', () => {
  const goodSet = JSON.parse(JSON.stringify({ ...setOf('answer-first', 2), index: 0, results: [], draft: '', verdict: null }));
  const bad = ['not json', '{"a":1}', '[1,2,3]', '42', 'null', '"text"'];
  for (const key of ['cr-moves-run', 'cr-moves-history', 'cr-moves-seen', 'cr-moves-transfer']) for (const v of bad) {
    const f = page({ storage: { [key]: v } });
    try { const s = tool(f); assert.equal(s.run, null, key + v); assert.deepEqual(s.history, []); assert.deepEqual(s.seen, []); assert.deepEqual(s.transfer, {}); f.$('homeMovesHub').click(); assert(f.$('move-so-what'), key); } finally { end(f); }
  }
  const variants = [{ ...goodSet, index: 9 }, { ...goodSet, items: [{ id: 'x', move: 'answer-first', rung: 'spot' }] }, { ...goodSet, results: [{ ok: 'yes' }] }, { ...goodSet, results: [{ ok: true }, { ok: true }, { ok: true }] }, { ...goodSet, move: 'nope' }, { ...goodSet, seed: 'abc' }];
  for (const v of variants) { const f = page({ storage: { 'cr-moves-run': JSON.stringify(v) } }); try { assert.equal(tool(f).run, null); assert.equal(f.w.localStorage.getItem('cr-moves-run'), null, 'the bad run is removed'); assert.equal(doc(f).querySelector('[data-continue=moves]'), null); } finally { end(f); } }
  const f = page({ storage: { 'cr-moves-run': JSON.stringify(goodSet), 'cr-moves-history': JSON.stringify([{ move: 'x' }, null, readyHistory('so-what')[0], { move: 'so-what', rung: 'do', id: 'a', ok: 'maybe', at: 1 }]), 'cr-moves-seen': '["so-what","zzz",5]', 'cr-moves-transfer': '{"1":["answer-first","bogus"],"2":"no"}' } });
  try { assert(tool(f).run); assert.equal(tool(f).history.length, 1); assert.deepEqual(tool(f).seen, ['so-what']); assert.deepEqual(tool(f).transfer, { 1: ['answer-first'] }); } finally { end(f); }
});

test('a move with enough good history is ready: the hub, the results and the case debrief say so', () => {
  const f = page({ storage: { 'cr-moves-history': JSON.stringify(readyHistory('answer-first')), 'cr-moves-seen': '["answer-first"]' } });
  try {
    f.$('homeMovesHub').click(); assert.match(f.$('move-answer-first').closest('.mv-card').textContent, /Ready\. Now use it in a full case or interview\./); assert.match(text(f), /8 of your last 10 Spot picks are right and your last 3 Do reps pass every check/);
    assert.match(f.$('move-so-what').closest('.mv-card').textContent, /Not started/);
    // Finishing a perfect set keeps it ready and offers the full case.
    const set = setOf('answer-first', 21); f.run("MovesTool.openMove('answer-first', { seed: 21 })"); for (const it of set.items) { playRight(f, it); f.$('mvNext').click(); }
    assert.equal(tool(f).screen, 'results'); assert.match(text(f), /You have met the bar/); assert.equal(f.$('mvCases'), null, 'answer first belongs to the interview group'); assert.equal(f.$('mvHr').textContent, 'Use it in an HR interview →'); f.$('mvHr').click(); assert.equal(view(f), 'behavioural');
    // The debrief.
    f.$('aiSettings').click(); f.$('aiModel').value = 'test-model'; f.$('aiKey').value = 'test-key-not-a-real-key'; f.$('aiConsent').checked = true; f.$('aiSave').click();
    showReport(f, 777); const sec = f.$('movesTransfer'); assert(sec); assert.match(sec.textContent, /Moves you have trained/); assert.match(sec.textContent, /Did your recommendation open with the answer\?/); assert.doesNotMatch(sec.textContent, /sanity-check/);
    assert.match(sec.textContent, /your own judgement/); assert.equal(f.$('movesFromReport'), null);
    assert(sec.closest('.panel'), 'inside the report'); assert(f.$('generateReview'), 'the AI section is still there'); assert(f.$('externalAIReview'));
    const box = sec.querySelector('[data-transfer=answer-first]'); assert(!box.checked); box.checked = true; box.dispatchEvent(new f.w.Event('change', { bubbles: true }));
    assert.deepEqual(JSON.parse(f.w.localStorage.getItem('cr-moves-transfer')), { 777: ['answer-first'] });
    showReport(f, 777); assert(f.$('movesTransfer').querySelector('[data-transfer=answer-first]').checked, 'the tick survives re-opening the report'); assert.equal(doc(f).querySelectorAll('#movesTransfer').length, 1);
    showReport(f, 888); assert(!f.$('movesTransfer').querySelector('[data-transfer=answer-first]').checked, 'another session has its own ticks'); assert(f.$('generateReview'));
    const g = page({ storage: kept(f) }); try { showReport(g, 777); assert(g.$('movesTransfer').querySelector('[data-transfer=answer-first]').checked, 'and after a reload'); end(g); } catch (e) { g.dom.window.close(); throw e; }
    for (const id of ['so-what', 'number-sense']) { f.run(`MovesTool.state().history.push(...${JSON.stringify(readyHistory(id))})`); }
    showReport(f, 777); assert.equal(f.$('movesTransfer').querySelectorAll('[data-transfer]').length, 3); assert.match(f.$('movesTransfer').textContent, /When you opened an exhibit, did you say what it meant before reading the numbers out\?/);
  } finally { end(f); }
});

test('with no ready move the debrief points to the hub', () => {
  const f = page();
  try {
    showReport(f, 5); const sec = f.$('movesTransfer'); assert.match(sec.textContent, /Train one move in five minutes before your next case/); assert.equal(sec.querySelector('[data-transfer]'), null);
    assert(f.$('externalAIReview'), 'the existing report is intact'); f.$('movesFromReport').click(); assert.equal(view(f), 'moves'); assert.equal(tool(f).screen, 'hub');
  } finally { end(f); }
});

test('plan items open the move, and the plan offers them for the right rounds', () => {
  const N = require('../content/next-round.js'), ids = list => list.map(e => e.id);
  assert.deepEqual(ids(N.plan({ round: 'hr', minutes: 20 })).slice(0, 2), ['bh-intro', 'move-answer-first']); assert.equal(ids(N.plan({ round: 'gd', minutes: 45 }))[2], 'move-next-line'); assert.equal(ids(N.plan({ round: 'gd', minutes: 45 }))[3], 'move-answer-first');
  assert(ids(N.plan({ round: 'case', role: 'operations', minutes: 90 })).includes('move-so-what')); assert(ids(N.plan({ round: 'aptitude', minutes: 90 })).includes('move-number-sense')); assert(!ids(N.plan({ round: 'aptitude', minutes: 20 })).includes('move-number-sense'));
  const f = page();
  try {
    for (const m of C.MOVES) { const it = N.ITEMS['move-' + m.id]; assert.deepEqual(it.open, { tool: 'moves', move: m.id }); assert.equal(it.title, 'Train one move: ' + m.title); assert.equal(it.minutes, m.minutes); }
    f.run("NextRoundTool.go('move-so-what')"); assert.equal(view(f), 'moves'); assert.equal(tool(f).screen, 'learn'); assert.equal(f.w.location.hash, '#moves/so-what'); f.$('mvStart').click(); assert.equal(tool(f).run.move, 'so-what');
    f.run("NextRoundTool.go('move-so-what')"); assert.equal(tool(f).screen, 'item', 'continues the set in progress');
    f.run("NextRoundTool.open()"); const r = doc(f).querySelector('[name=nrRound][value=hr]'); r.checked = true; r.dispatchEvent(new f.w.Event('change', { bubbles: true }));
    const btn = doc(f).querySelector('[data-go=move-answer-first]'); assert(btn); assert.match(btn.closest('li').textContent, /MOVES · 5 MIN/i); btn.click(); assert.equal(view(f), 'moves'); assert.equal(tool(f).run.move, 'so-what', 'unseen move shows its rule first'); assert.equal(tool(f).screen, 'learn');
  } finally { end(f); }
});

test('leaving the tool stops its timers and clears the hash', () => {
  const f = page();
  try {
    open(f, 'answer-first', 1); for (const it of setOf('answer-first', 1).items.slice(0, 4)) { playRight(f, it); f.$('mvNext').click(); }
    const live = new Set(), w = f.w, si = w.setInterval.bind(w), ci = w.clearInterval.bind(w); w.setInterval = (...a) => { const id = si(...a); live.add(id); return id; }; w.clearInterval = id => { live.delete(id); ci(id); };
    f.$('mvTimer').click(); assert.equal(live.size, 1, 'the countdown is running'); f.$('homeNav').click(); assert.equal(live.size, 0, 'and stops when you leave'); assert.equal(view(f), 'home'); assert.equal(f.w.location.hash, '');
  } finally { end(f); }
});

/* ---------- Attempt, leave or guess ---------- */
const TR = C.TRIAGE, tqs = seed => L.buildTriage({ seed }).questions;
const freeze = f => f.run('window.__t = 1700000000000; Date.now = () => window.__t');
const wait = (f, s) => { f.run(`window.__t += ${s * 1000}`); f.run('MovesTool.tick()'); };
const clockText = f => f.$('tgClock').textContent;
const begin = (f, seed) => { f.run(`MovesTool.openMove('triage', { seed: ${seed} })`); if (f.$('mvStart')) f.$('mvStart').click(); f.$('tgStart').click(); };
const sortAll = (f, calls) => { for (const c of calls) f.$('tgCall-' + c).click(); };
const pickOpt = (f, i) => f.$('tgOpt-' + i).click();
const right = q => q.answer, wrong = q => (q.answer + 1) % 4;
const kinds = ['now', 'later', 'leave', 'later', 'now', 'now', 'later', 'leave'];

test('Attempt, leave or guess: the rule once, a brief, sorting, the sitting, the clock running out and the debrief', () => {
  const f = page(), q = tqs(3); freeze(f);
  try {
    f.run("MovesTool.openMove('triage', { seed: 3 })"); assert.equal(tool(f).screen, 'learn'); assert.equal(f.$('tgStart'), null);
    assert.match(text(f), /Give each question ten seconds/); assert.match(text(f), /Why it matters/); assert.match(text(f), /A test has 20 questions in 20 minutes/); assert.equal(f.$('mvStart').textContent, 'Start the round →');
    assert.deepEqual(tool(f).seen, []); f.$('mvStart').click();
    // The brief: three lines and the three calls, and nothing runs or is saved yet.
    assert.equal(tool(f).screen, 'brief'); assert.deepEqual(tool(f).seen, ['triage']); assert.equal(tool(f).run, null); assert.equal(f.w.location.hash, '#moves/triage');
    assert.equal(f.$('app').querySelectorAll('.mv-rule li').length, 3); assert.match(text(f), /10 seconds to sort each of 8 aptitude questions/); assert.match(text(f), /3:30 for all 8\. That is not enough/); assert.match(text(f), /lose a quarter mark for a wrong one/);
    for (const c of TR.calls) { assert(text(f).includes(c.label)); assert(text(f).includes(c.note)); }
    assert.equal(f.$('tgStart').textContent, 'Start sorting →'); assert(f.$('tgStart').classList.contains('primary')); assert(f.$('mvHub')); assert(f.$('mvRule'));
    f.$('tgStart').click();
    // Sort: one question at a time, options not clickable, a ten-second clock.
    assert.equal(tool(f).screen, 'sort'); assert.equal(tool(f).run.phase, 'sort'); assert(f.w.localStorage.getItem('cr-moves-run'));
    assert.match(text(f), /Question 1 of 8/); assert(text(f).includes(q[0].prompt.split('\n')[0])); assert.equal(f.$('app').querySelectorAll('.tg-options li').length, 4); assert.equal(f.$('app').querySelectorAll('.tg-options button, .tg-options input').length, 0, 'options are not clickable');
    assert.equal(clockText(f), '0:10'); for (const c of TR.calls) assert(f.$('tgCall-' + c.id)); assert.equal(f.$('tgSit'), null);
    wait(f, 3); assert.equal(clockText(f), '0:07'); assert.equal(tool(f).run.used, 3, 'saved as it runs');
    f.$('tgCall-now').click(); assert.match(text(f), /Question 2 of 8/); assert.equal(clockText(f), '0:10'); assert.deepEqual(tool(f).run.calls, ['now']);
    f.$('tgCall-later').click(); f.$('tgCall-leave').click(); assert.match(text(f), /Question 4 of 8/);
    // A timeout files the question as Later, marked late, and the next one appears.
    wait(f, 9); assert.equal(clockText(f), '0:01'); assert.match(text(f), /Question 4 of 8/);
    wait(f, 1); assert.match(text(f), /Question 5 of 8/); assert.deepEqual(tool(f).run.calls, ['now', 'later', 'leave', 'later']); assert.deepEqual(tool(f).run.late, [false, false, false, true]);
    sortAll(f, ['now', 'now', 'later', 'leave']);
    assert.equal(tool(f).screen, 'sorted'); assert.match(f.$('tgPiles').textContent, /Do now: 3 · Later: 3 · Leave: 2/); assert.match(text(f), /1 question went to Later because 10 seconds ran out/); assert.equal(f.$('tgCall-now'), null);
    f.$('tgSit').click();
    // Sit: Do now first, then Later, then Leave. The clock runs across questions.
    const order = L.triageOrder(kinds); assert.deepEqual(order, [0, 4, 5, 1, 3, 6, 2, 7]); assert.deepEqual(tool(f).run.order, order); assert.equal(tool(f).screen, 'sit');
    assert.equal(clockText(f), '3:30'); assert.match(text(f), /Question 1 of 8/); assert.match(text(f), /Your call: Do now/); assert(text(f).includes(q[0].prompt.split('\n')[0]));
    assert.equal(f.$('app').querySelectorAll('[role=radio]').length, 4); assert.equal(f.$('tgAnswer').textContent, 'Answer →'); assert.equal(f.$('tgSkip').textContent, 'Skip'); assert.equal(f.$('tgGuess').type, 'checkbox'); assert.match(f.$('app').textContent, /This is a guess/);
    f.$('tgAnswer').click(); assert.equal(tool(f).run.index, 0); assert.match(f.$('tgHint').textContent, /Choose an option first/);
    pickOpt(f, 1); assert.equal(f.$('tgOpt-1').getAttribute('aria-checked'), 'true'); pickOpt(f, right(q[0])); assert.equal(f.$('tgOpt-1').getAttribute('aria-checked'), right(q[0]) === 1 ? 'true' : 'false');
    wait(f, 30); f.$('tgAnswer').click(); assert.deepEqual(tool(f).run.answers[0], { state: 'right', pick: right(q[0]), guess: false, seconds: 30 });
    assert.match(text(f), /Question 2 of 8/); assert.equal(clockText(f), '3:00'); assert(text(f).includes(q[4].prompt.split('\n')[0]), 'the next Do now question, not the next one sorted');
    pickOpt(f, wrong(q[4])); f.$('tgGuess').checked = true; wait(f, 50); f.$('tgAnswer').click(); assert.deepEqual(tool(f).run.answers[4], { state: 'wrong', pick: wrong(q[4]), guess: true, seconds: 50 });
    pickOpt(f, right(q[5])); wait(f, 20); f.$('tgAnswer').click();
    // Reload mid-sit: the time left comes back, and the guess box is clear.
    assert.equal(tool(f).run.used, 100); const g = page({ storage: kept(f) });
    try { assert.equal(view(g), 'home'); const item = doc(g).querySelector('[data-continue=moves]'); assert.match(item.textContent, /Move.*Attempt, leave or guess.*Question 4 of 8 in the sitting/s); item.click();
      assert.equal(tool(g).screen, 'sit'); assert.equal(g.$('tgClock').textContent, '1:50'); assert.match(g.$('app').textContent, /Question 4 of 8/); assert.match(g.$('app').textContent, /Your call: Later/); assert.equal(g.$('tgGuess').checked, false); end(g); } catch (e) { g.dom.window.close(); throw e; }
    f.$('tgSkip').click(); assert.deepEqual(tool(f).run.answers[1], { state: 'skipped', pick: null, guess: false, seconds: 0 }); wait(f, 25); pickOpt(f, right(q[3])); f.$('tgAnswer').click(); wait(f, 40); pickOpt(f, wrong(q[6])); f.$('tgAnswer').click();
    assert.equal(tool(f).run.index, 6); assert.equal(clockText(f), '0:45', '165 seconds used'); assert.match(text(f), /Your call: Leave/);
    wait(f, 44); assert.equal(tool(f).screen, 'sit', 'one second left'); assert.equal(clockText(f), '0:01'); wait(f, 1);
    // The clock ran out: what was on screen counts as not reached, and the debrief shows.
    assert.equal(tool(f).screen, 'debrief'); assert.equal(tool(f).run, null); assert.equal(f.w.localStorage.getItem('cr-moves-run'), null);
    assert.equal(f.$('tgHead').textContent, '3 right, 2 wrong: 3 − 0.5 = 2.5 marks of 8'); assert.match(text(f), /1 question skipped\. The clock ran out with 2 questions not reached\./);
    const rows = [...doc(f).querySelectorAll('.tg-row')]; assert.equal(rows.length, 8);
    assert.deepEqual(rows.map(r => r.querySelector('.note').textContent.match(/Question (\d)/)[1]), ['1', '5', '6', '2', '4', '7', '3', '8'], 'sitting order');
    const line = (i, t) => assert(rows[i].textContent.includes(t), rows[i].textContent);
    line(0, 'Right in 30 seconds. A good call.'); assert.match(rows[0].textContent, /✓.*Good call/s); line(1, 'Wrong after 50 seconds. Not a quick mark for you yet.'); assert.match(rows[1].textContent, /✗.*Not a good call/s); line(1, 'marked as a guess');
    line(2, 'Right in 20 seconds. A good call.'); line(3, 'Skipped.'); assert.match(rows[3].textContent, /–.*Not tested/s); line(4, 'Right in 25 seconds. A quick mark you put off.'); line(4, 'no call in 10 seconds, so it was filed as Later');
    line(5, 'Wrong after 40 seconds. You were right to put it off.'); assert.match(rows[5].textContent, /✓.*Good call/s); line(6, 'Not reached.'); line(7, 'Not reached.'); line(0, 'Called Do now'); line(3, 'Called Later');
    assert.equal(doc(f).querySelectorAll('.tg-row details').length, 8); assert(rows[0].querySelector('details').textContent.includes(q[0].solution[0])); assert(rows[0].querySelector('details').textContent.includes(q[0].shortcut)); assert(rows[0].querySelector('details').textContent.includes(q[0].prompt.split('\n')[0]));
    const table = f.$('app').querySelector('table.mv-table'); assert.match(table.textContent, /Do now\s*3\s*3\s*1\.75\s*1:40/); assert.match(table.textContent, /Later\s*3\s*2\s*0\.75\s*1:05/); assert.match(table.textContent, /Leave\s*2\s*0\s*0\s*0:00/);
    assert.match(f.$('tgGuesses').textContent, /1 answer as a guess: 0 right, −0\.25 marks in all/); assert(f.$('tgGuesses').textContent.includes(TR.guess));
    assert.equal(f.$('tgTakeaway').textContent, 'You put off 1 question that you then answered within 40 seconds. If you recognise the type, take it in the first pass.');
    assert.match(f.$('tgPass').textContent, /✗.*This round did not pass\./s); assert(f.$('tgPass').textContent.includes(TR.pass)); assert.match(f.$('mvStatus').textContent, /Sort calls: 3 of your last 5 good · Rounds: 0 of your last 1 passed/);
    assert.match(text(f), /To be ready you still need 5 more sorting calls \(you have 3 of 5 good so far\) and your last 3 rounds all passing \(now 0 of 1\)/);
    assert.equal(f.$('mvAgain').textContent, 'Another round →'); assert.equal(f.$('mvHub').textContent, 'All moves'); assert.equal(f.$('mvRule').textContent, 'See the rule again'); assert.equal(f.$('tgTest'), null);
    // History: saved once, one spot entry per judged question and one round entry.
    const h = JSON.parse(f.w.localStorage.getItem('cr-moves-history')); assert.equal(h.length, 6);
    assert.deepEqual(h.map(e => e.rung), ['spot', 'spot', 'spot', 'spot', 'spot', 'do']); assert.deepEqual(h.map(e => e.ok), [true, false, true, false, true, false]); assert.deepEqual(h.slice(0, 5).map(e => e.pick), ['now', 'now', 'now', 'later', 'later']);
    assert.deepEqual(h.slice(0, 5).map(e => e.id), [0, 4, 5, 3, 6].map(i => q[i].id)); assert.equal(h[5].id, 'round-3'); assert.deepEqual(h.slice(0, 3).map(e => e.seconds), [30, 50, 20]);
    f.$('mvRule').click(); assert.equal(tool(f).screen, 'learn'); assert.equal(f.$('mvStart').textContent, 'Start the round →'); f.$('mvHub').click(); assert.equal(tool(f).history.length, 6, 'nothing saved twice');
    assert.match(f.$('move-triage').closest('.mv-card').textContent, /Sort calls: 3 of your last 5 good · Rounds: 0 of your last 1 passed/); assert.equal(f.$('move-triage').textContent, 'Another round →');
    assert.match(text(f), /Attempt, leave or guess is ready when 8 of your last 10 sorting calls were good and your last 3 rounds passed/); assert.match(text(f), /A set move is ready when 8 of your last 10 Spot picks are right and your last 3 Do reps pass every check/);
    assert.match(f.$('move-answer-first').closest('.mv-card').textContent, /Not started/, 'the other moves keep their wording');
    f.$('move-triage').click(); assert.equal(tool(f).screen, 'brief', 'the rule shows only the first time'); assert.equal(tool(f).history.length, 6);
  } finally { end(f); }
});

test('Attempt, leave or guess: a passing round, then ready, then the timed-test self-check and the way on to the aptitude tool', () => {
  const f = page({ storage: { 'cr-moves-history': JSON.stringify([...readyHistory('triage').slice(2, 10)]), 'cr-moves-seen': '["triage"]' } }), q = tqs(5); freeze(f);
  try {
    begin(f, 5); sortAll(f, ['now', 'now', 'now', 'now', 'later', 'later', 'leave', 'leave']); f.$('tgSit').click();
    for (const i of [0, 1, 2, 3]) { pickOpt(f, right(q[i])); wait(f, 20); f.$('tgAnswer').click(); }
    pickOpt(f, wrong(q[4])); wait(f, 40); f.$('tgAnswer').click(); pickOpt(f, right(q[5])); wait(f, 45); f.$('tgAnswer').click(); f.$('tgSkip').click(); wait(f, 5); f.$('tgSkip').click();
    assert.equal(tool(f).screen, 'debrief'); assert.equal(f.$('tgHead').textContent, '5 right, 1 wrong: 5 − 0.25 = 4.75 marks of 8'); assert.equal(f.$('tgTakeaway').textContent, 'Your sorting matched what happened. Keep the same rhythm in a full timed test.');
    assert.match(f.$('tgPass').textContent, /✓.*This round passed\./s); assert.equal(f.$('tgGuesses'), null, 'no guesses section when none were flagged');
    assert.match(text(f), /Right, and it took 45 seconds\. Worth putting off\./); assert.match(text(f), /Right in 20 seconds\. A good call\./);
    assert.equal(tool(f).history.length, 8 + 7); assert.equal(f.$('tgTest'), null, 'the history is not ready yet: only one passing round');
  } finally { end(f); }
  // Ready: ten good calls and three passing rounds.
  const history = readyHistory('triage'), g = page({ storage: { 'cr-moves-history': JSON.stringify(history), 'cr-moves-seen': '["triage"]' } }); freeze(g);
  try {
    assert.match(g.$('homeMove-triage').textContent, /Attempt, leave or guess.*Ready\. Now use it in a full timed test\./s);
    begin(g, 6); sortAll(g, ['leave', 'leave', 'leave', 'leave', 'leave', 'leave', 'leave', 'leave']); g.$('tgSit').click(); wait(g, 210);
    assert.equal(tool(g).screen, 'debrief'); assert.equal(g.$('tgHead').textContent, '0 right, 0 wrong: 0 − 0 = 0 marks of 8'); assert.equal(g.$('tgTakeaway').textContent, 'None of your Do now calls was tested. Call more questions Do now, and answer those first.');
    assert.match(g.$('tgPass').textContent, /did not pass/); assert.equal(tool(g).history.length, 14, 'a round with nothing judged adds only its round entry'); assert.equal(g.$('tgTest'), null, 'a failed round is the latest of three Do reps');
  } finally { end(g); }
  const h = page({ storage: { 'cr-moves-history': JSON.stringify(history), 'cr-moves-seen': '["triage"]' } }); freeze(h);
  try {
    begin(h, 8); const q8 = tqs(8); sortAll(h, ['now', 'now', 'later', 'later', 'later', 'later', 'later', 'later']); h.$('tgSit').click();
    pickOpt(h, right(q8[0])); wait(h, 20); h.$('tgAnswer').click(); pickOpt(h, right(q8[1])); wait(h, 20); h.$('tgAnswer').click(); wait(h, 170);
    assert.equal(tool(h).screen, 'debrief'); assert.match(h.$('tgPass').textContent, /This round passed\./); assert.match(h.$('mvStatus').textContent, /^✓ Ready\. Now use it in a full timed test\./); assert.match(text(h), /You have met the bar for this move/);
    assert(h.$('tgTest')); assert.equal(h.$('tgTest').textContent, 'Use it in a timed test →'); h.$('tgTest').click(); assert.equal(view(h), 'aptitude');
    // The timed-test results show the self-check once; practice results do not.
    h.$('aptitudeNav').click(); h.$('aptTest').click(); doc(h).querySelector('.apt-option[data-opt="0"]').click(); h.$('aptSubmit').click();
    const line = h.$('movesAptitudeCheck'); assert(line, 'the self-check is on the results'); assert.equal(line.type, 'checkbox'); assert.equal(line.checked, false);
    assert.equal(line.closest('label').textContent.trim(), 'You trained Attempt, leave or guess. Did you take the quick questions first?'); assert.match(h.$('movesAptitude').textContent, /your own judgement/); assert.equal(doc(h).querySelectorAll('#movesAptitude').length, 1);
    line.checked = true; assert.equal(h.w.localStorage.getItem('cr-moves-transfer'), null, 'not saved');
    h.$('aptAgain').click(); h.$('aptPause') && h.$('aptPause').click(); h.$('aptitudeNav').click(); h.$('aptPractice').click(); doc(h).querySelector('.apt-option[data-opt="0"]').click(); h.$('aptEnd').click();
    assert(h.$('aptHeadline'), 'practice results'); assert.equal(h.$('movesAptitudeCheck'), null, 'not shown after practice');
  } finally { end(h); }
  // Not ready: the timed-test results have no extra line.
  const k = page(); try { k.$('aptitudeNav').click(); k.$('aptTest').click(); doc(k).querySelector('.apt-option[data-opt="0"]').click(); k.$('aptSubmit').click(); assert(k.$('aptHeadline')); assert.equal(k.$('movesAptitudeCheck'), null); } finally { end(k); }
});

test('Attempt, leave or guess: a reload mid-sort resumes at the same question with the time left, and Home lists it', () => {
  const f = page(), q = tqs(4); freeze(f); let g, h, k;
  try {
    begin(f, 4); sortAll(f, ['now', 'later']); wait(f, 4); assert.equal(tool(f).run.used, 4);
    g = page({ storage: kept(f) }); assert.equal(view(g), 'home'); const item = doc(g).querySelector('[data-continue=moves]'); assert.match(item.textContent, /Move.*Attempt, leave or guess.*Sorting question 3 of 8/s);
    item.click(); assert.equal(tool(g).screen, 'sort'); assert.match(text(g), /Question 3 of 8/); assert.equal(g.$('tgClock').textContent, '0:06'); assert(text(g).includes(q[2].prompt.split('\n')[0])); assert.deepEqual(tool(g).run.calls, ['now', 'later']);
    h = page({ storage: kept(f), url: 'https://case.example/#moves/triage' }); assert.equal(h.$('tgClock').textContent, '0:06'); assert.equal(h.$('mvStart'), null);
    k = page({ storage: kept(f), url: 'https://case.example/#moves' }); assert.equal(k.$('move-triage').textContent, 'Continue →'); k.$('move-triage').click(); assert.equal(k.$('tgClock').textContent, '0:06');
    // Sorted but the clock not started: that comes back too.
    sortAll(f, ['now', 'now', 'now', 'now', 'now', 'now']); assert.equal(tool(f).screen, 'sorted'); const m = page({ storage: kept(f) });
    try { assert.match(doc(m).querySelector('[data-continue=moves]').textContent, /Sorted, ready to start the clock/); doc(m).querySelector('[data-continue=moves]').click(); assert(m.$('tgSit')); end(m); } catch (e) { m.dom.window.close(); throw e; }
    g.$('homeNav').click(); assert(doc(g).querySelector('[data-continue=moves]'), 'still listed until the round is finished'); assert.equal(g.w.location.hash, '');
    f.$('mvExit').click(); assert.equal(tool(f).screen, 'hub'); assert(tool(f).run, 'leaving keeps the round'); assert.equal(f.$('move-triage').textContent, 'Continue →');
  } finally { end(f, g, h, k); }
});

test('Attempt, leave or guess: malformed saved rounds are dropped', () => {
  const good = (over = {}) => JSON.parse(JSON.stringify({ move: 'triage', seed: 2, questions: tqs(2), phase: 'sort', at: 1, calls: ['now'], late: [false], order: [], index: 0, answers: Array(8).fill(null), used: 3, ...over }));
  const sitting = (over = {}) => { const calls = ['now', 'later', 'now', 'leave', 'later', 'now', 'leave', 'later'], order = L.triageOrder(calls), answers = Array(8).fill(null); answers[order[0]] = { state: 'right', pick: 1, guess: false, seconds: 9 }; return good({ phase: 'sit', at: 8, calls, late: calls.map(() => false), order, index: 1, answers, used: 50, ...over }); };
  const f0 = page({ storage: { 'cr-moves-run': JSON.stringify(good()) } }); try { assert.equal(tool(f0).run.phase, 'sort'); assert.equal(tool(f0).run.used, 3); } finally { end(f0); }
  const f1 = page({ storage: { 'cr-moves-run': JSON.stringify(sitting()) } }); try { assert.equal(tool(f1).run.phase, 'sit'); assert.equal(tool(f1).run.index, 1); f1.$('homeMovesHub').click(); f1.$('move-triage').click(); assert.equal(tool(f1).screen, 'sit'); assert.equal(f1.$('tgClock').textContent, '2:40'); } finally { end(f1); }
  const q = tqs(2), sq = (i, o) => q.map((x, j) => j === i ? { ...x, ...o } : x);
  const bad = [good({ phase: 'later' }), good({ questions: q.slice(1) }), good({ questions: sq(0, { topic: 'di' }) }), good({ questions: sq(3, { options: ['a', 'b'] }) }), good({ questions: sq(1, { answer: 9 }) }), good({ calls: ['soon'] }), good({ at: 4 }), good({ used: 30 }), good({ used: 'x' }),
    good({ late: [] }), good({ answers: [] }), good({ order: [0] }), sitting({ index: 8 }), sitting({ used: 400 }), sitting({ order: [0, 1, 2, 3, 4, 5, 6, 7] }), sitting({ answers: Array(8).fill(null) }), good({ items: [{ rung: 'spot' }] }).phase === 'sort' ? { ...good(), move: 'so-what' } : 0, { move: 'triage' }, [good()], 'not json', 7];
  for (const b of bad) { const f = page({ storage: { 'cr-moves-run': typeof b === 'string' ? b : JSON.stringify(b) } }); try { assert.equal(tool(f).run, null, JSON.stringify(b).slice(0, 80)); assert.equal(f.w.localStorage.getItem('cr-moves-run'), null, 'the bad round is removed'); assert.equal(doc(f).querySelector('[data-continue=moves]'), null); } finally { end(f); } }
  // Extra fields do not ride along.
  const f2 = page({ storage: { 'cr-moves-run': JSON.stringify({ ...good(), junk: 'x', answers: Array(8).fill(null) }) } }); try { assert.equal(tool(f2).run.junk, undefined); assert.deepEqual(Object.keys(tool(f2).run).sort(), ['answers', 'at', 'calls', 'index', 'late', 'move', 'order', 'phase', 'questions', 'seed', 'used']); } finally { end(f2); }
});

test('Attempt, leave or guess: the plan opens it, and it stays out of the case debrief', () => {
  const N = require('../content/next-round.js'), ids = list => list.map(e => e.id);
  assert.deepEqual(N.ITEMS['move-triage'], { tool: 'Moves', title: 'Train one move: Attempt, leave or guess', minutes: 5, open: { tool: 'moves', move: 'triage' }, why: N.ITEMS['move-triage'].why }); assert.match(N.ITEMS['move-triage'].why, /\.$/);
  assert.deepEqual(ids(N.plan({ round: 'aptitude', minutes: 10 })), ['apt-mixed']); assert.deepEqual(ids(N.plan({ round: 'aptitude', minutes: 20 })), ['apt-mock-short']);
  for (const m of [45, 60, 90]) { const p = ids(N.plan({ round: 'aptitude', minutes: m })); assert.equal(p.indexOf('move-triage'), p.indexOf('apt-weak') + 1, m + ' minutes: directly after apt-weak'); }
  const cid = list => list.map(e => e.id || e); assert.deepEqual(cid(N.candidates('aptitude', 'other', { minutes: 90 })).slice(0, 4), ['apt-mock', 'apt-weak', 'move-triage', 'apt-mixed']);
  for (const r of ['hr', 'case', 'gd', 'resume', 'technical', 'unknown']) assert(!cid(N.candidates(r, 'other', { minutes: 90 })).includes('move-triage'), r);
  const f = page();
  try {
    f.run("NextRoundTool.go('move-triage')"); assert.equal(view(f), 'moves'); assert.equal(tool(f).screen, 'learn'); assert.equal(f.w.location.hash, '#moves/triage'); f.$('mvStart').click(); assert.equal(tool(f).screen, 'brief'); f.$('tgStart').click(); assert.equal(tool(f).run.move, 'triage');
    f.run("NextRoundTool.go('move-triage')"); assert.equal(tool(f).screen, 'sort', 'continues the round in progress');
    f.run("NextRoundTool.open()"); const r = doc(f).querySelector('[name=nrRound][value=aptitude]'); r.checked = true; r.dispatchEvent(new f.w.Event('change', { bubbles: true }));
    const t = doc(f).querySelector('[name=nrTime][value="45"]'); t.checked = true; t.dispatchEvent(new f.w.Event('change', { bubbles: true })); const btn = doc(f).querySelector('[data-go=move-triage]'); assert(btn); assert.match(btn.closest('li').textContent, /MOVES · 5 MIN/i);
  } finally { end(f); }
  const g = page({ storage: { 'cr-moves-history': JSON.stringify(readyHistory('triage')), 'cr-moves-seen': '["triage"]' } });
  try { showReport(g, 5); const sec = g.$('movesTransfer'); assert.equal(sec.querySelector('[data-transfer]'), null, 'no triage tick in the case debrief'); assert.doesNotMatch(sec.textContent, /Attempt|quick questions/); assert.match(sec.textContent, /Train one move in five minutes before your next case/);
    g.run(`MovesTool.state().history.push(...${JSON.stringify(readyHistory('answer-first'))})`); showReport(g, 5); assert.equal(g.$('movesTransfer').querySelectorAll('[data-transfer]').length, 1); assert.doesNotMatch(g.$('movesTransfer').textContent, /Attempt/);
  } finally { end(g); }
});

test('Attempt, leave or guess: the home page row and the hub lay out nine moves', () => {
  const f = page();
  try {
    assert.equal(doc(f).querySelectorAll('.home-move-list li').length, 9); assert.match(f.$('homeMove-triage').textContent, /Attempt, leave or guess.*Not started/s);
    f.$('homeMove-triage').click(); assert.equal(tool(f).screen, 'learn'); assert.equal(doc(f).querySelectorAll('.mv-rule li').length, 3);
    f.$('mvHub').click(); assert.equal(doc(f).querySelectorAll('.mv-card').length, 9); assert.match(f.$('move-triage').closest('.mv-card').textContent, /Attempt, leave or guess.*Pick up the quick marks first.*Pays off in: Online aptitude test.*Not started/s);
    const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'assets', 'moves.css'), 'utf8'); assert.match(css, /\.mv-cards\{[^}]*auto-fit/); assert.match(css, /\.home-move-list\{[^}]*auto-fit/);
    f.$('homeNav').click(); f.$('round-case').click(); assert.match(f.$('caseTool-moves').closest('.case-tool').textContent, /Split a problem, ask the one question, read a table, catch a wrong number\. Five minutes each, with the reason after every pick\./);
  } finally { end(f); }
});

/* ---------- The five authored moves: split it, ask the one question, hold or change, put a number on it, your next line ---------- */
const AUTH = ['split-it', 'one-question', 'hold-or-change', 'put-a-number', 'next-line'];
const SEED = { 'split-it': 5, 'one-question': 6, 'hold-or-change': 7, 'put-a-number': 8, 'next-line': 9 };
const KIND_TABLE = { 'split-it': C.FLAWS, 'one-question': C.QUESTIONS, 'hold-or-change': C.PUSHBACKS, 'put-a-number': C.REWRITES, 'next-line': C.NEXT_LINES };
const SHAPE_NOTE = {
  'split-it': 'These checks look at the shape of your split: how many branches, and whether one repeats, contains or hides another. They cannot tell you whether the split is right.',
  'one-question': 'These checks look at the shape of your question: one question, specific, with a reason. They cannot tell you whether it is the right question.',
  'hold-or-change': 'These checks look at the shape of your reply: a clear call, a reason, a number, the tone and the length. They cannot tell you whether holding or changing was right.',
  'put-a-number': 'These checks look at the shape of your line: a number with its base, a result, “I”, and no vague words. They cannot tell you whether the figures are right.',
  'next-line': 'These checks look at the shape of your line: whether it connects to the group, moves it on and stays short. They cannot tell you whether it was what the group needed.'
};
const R = it => (it.round || '').toUpperCase();
/* What the situation block must show, by move. The breakdown tree is Spot only. */
const SITUATION = {
  'split-it': it => [R(it) + ' · THE PROBLEM', it.question],
  'one-question': it => [R(it) + ' · THE BRIEF', it.brief, 'What you already know', ...it.known],
  'hold-or-change': it => ['YOU SAID', it.said, R(it) + ' · THE INTERVIEWER PUSHES BACK', '“' + it.push + '”'],
  'put-a-number': it => [R(it) + ' · THE LINE', it.line, 'Facts you can use', ...it.facts],
  'next-line': it => ['GROUP DISCUSSION · THE TOPIC', it.topic, it.situation, ...it.lines.flatMap(l => [l.who, l.text])]
};
const sig = el => JSON.stringify([el.tagName, el.className, [...el.attributes].filter(a => a.name !== 'id').map(a => [a.name, a.value]).sort(), [...el.children].map(c => c.tagName + '.' + c.className)]);
const noMarks = f => assert.equal(f.$('app').querySelectorAll('.right, .correct, .wrong, .locked, [disabled]').length, 0, 'nothing marks the right option before a pick');
const strongPlay = (f, it) => {
  if (it.rung === 'spot') f.$('mvOpt-' + it.options.findIndex(o => o.right)).click();
  else { type(f, 'mvAnswer', it.strong); f.$('mvCheck').click(); f.$('mvGrade-strong').click(); }
};

for (const id of AUTH) test(`${C.MOVES.find(m => m.id === id).title}: the rule, four Spot items, two Do items, results and history`, () => {
  const f = page(), set = setOf(id, SEED[id]), m = C.MOVES.find(x => x.id === id), table = KIND_TABLE[id];
  try {
    // The rule shows the first time, with an example that fits the move.
    f.run(`MovesTool.openMove('${id}', { seed: ${SEED[id]} })`); assert.equal(tool(f).screen, 'learn'); assert.equal(f.$('app').querySelector('h1').textContent, m.title);
    assert.equal(f.$('app').querySelectorAll('.mv-rule li').length, 3); assert(text(f).includes(m.rule[0])); assert(text(f).includes('Why it matters'));
    if (id === 'split-it') { assert.equal(f.$('app').querySelectorAll('.mv-ex.weak .mv-branches li').length, 4); assert.equal(f.$('app').querySelectorAll('.mv-ex.strong .mv-branches li').length, 4, 'one branch per line'); }
    if (id === 'next-line') assert.equal(f.$('app').querySelectorAll('.mv-talk li').length, 3, 'the example transcript');
    if (id === 'put-a-number') assert(f.$('app').querySelector('.mv-claim'));
    f.$('mvStart').click(); assert.equal(tool(f).run.items.length, 6); assert.deepEqual(tool(f).run.items.map(i => i.rung), ['spot', 'spot', 'spot', 'spot', 'do', 'do']);
    // Spot 1: the situation, four options, and nothing that shows which one is right.
    const it = set.items[0], wrong = it.options.findIndex(o => !o.right), right = it.options.findIndex(o => o.right);
    assert.match(text(f), new RegExp(m.title.toUpperCase().replace(/[?]/g, '\\?') + ' · SPOT · 1 OF 4')); for (const t of SITUATION[id](it)) assert(text(f).includes(t), t);
    assert(text(f).includes(m.spot.prompt)); assert.equal(f.$('app').querySelectorAll('.mv-options button').length, 4); assert.equal(f.$('mvNext'), null);
    if (id === 'split-it') { assert.equal(f.$('app').querySelector('.mv-tree .mv-root').textContent, it.root); assert.equal(f.$('app').querySelectorAll('.mv-tree li').length, it.branches.length); }
    else assert.equal(f.$('app').querySelector('.mv-tree'), null);
    noMarks(f); assert.doesNotMatch(f.$('app').querySelector('.mv-options').innerHTML, /data-|right|correct/i, 'no attribute or class names the right option');
    for (let i = 0; i < 4; i++) if (i !== right) assert.equal(sig(f.$('mvOpt-' + i)), sig(f.$('mvOpt-' + right)), 'option ' + i + ' looks the same as the right one');
    // A wrong pick.
    f.$('mvOpt-' + wrong).click();
    assert(f.$('mvOpt-' + wrong).classList.contains('wrong')); assert(f.$('mvOpt-' + right).classList.contains('correct')); assert.equal(f.$('app').querySelectorAll('.mv-options button:not([disabled])').length, 0, 'options are locked');
    assert.match(f.$('mvOpt-' + wrong).textContent, /✗.*Your pick/s); assert.match(f.$('mvOpt-' + right).textContent, /✓.*The right one/s);
    for (const [i, o] of it.options.entries()) { const t = f.$('mvOpt-' + i).textContent; assert(t.includes(table[o.kind].label), 'labelled ' + o.kind); assert(t.includes(o.why), 'its own reason'); }
    const fb = f.$('mvFeedback'); assert.equal(fb.getAttribute('aria-live'), 'polite'); assert.equal(doc(f).activeElement, fb, 'focus moves to the feedback');
    assert(fb.textContent.includes('✗ Not quite')); assert(fb.textContent.includes(it.options[wrong].why)); assert(fb.textContent.includes('Why the right one works: ' + it.options[right].why));
    f.$('mvNext').click();
    // The other three Spot items, picked right.
    for (let i = 1; i < 4; i++) {
      const x = set.items[i]; for (const t of SITUATION[id](x)) assert(text(f).includes(t), t); noMarks(f);
      f.$('mvOpt-' + x.options.findIndex(o => o.right)).click(); assert(f.$('mvFeedback').textContent.includes('✓ Right')); assert(!f.$('mvFeedback').textContent.includes('Why the right one works')); assert.equal(f.$('app').querySelectorAll('.mv-opt.wrong').length, 0);
      assert(f.$('mvOpt-' + x.options.findIndex(o => o.right)).classList.contains('right')); f.$('mvNext').click();
    }
    // Do 1: the weak example fails a check.
    const d1 = set.items[4]; assert.match(text(f), /DO · 1 OF 2/); for (const t of SITUATION[id](d1)) assert(text(f).includes(t), t); assert.equal(f.$('app').querySelector('.mv-tree'), null, 'no breakdown on Do');
    assert.equal(f.$('mvNext'), null); assert.equal(f.$('mvTimer').textContent, `Start ${m.do.seconds}-second timer`); assert(f.$('mvMic'), 'dictation row'); assert.equal(f.$('mvAnswer').placeholder, m.do.placeholder); assert.equal(f.$('mvAnswer').getAttribute('rows'), '5');
    if (id === 'split-it') assert.match(text(f), /Your branches · one per line, or say them/);
    f.$('mvCheck').click(); assert.equal(tool(f).run.results.length, 4, 'an empty answer does not submit');
    type(f, 'mvAnswer', d1.weak); f.$('mvCheck').click();
    assert(doc(f).querySelector('.bh-checks li.warn'), 'a warn check'); assert(f.$('mvFeedback').textContent.includes('What to fix')); assert(text(f).includes(SHAPE_NOTE[id])); assert.equal(doc(f).querySelectorAll('.mv-grade').length, 3);
    for (const g of ['weak', 'adequate', 'strong']) assert(text(f).includes(m.do.grades[g]), 'the ' + g + ' note');
    assert.match(text(f), /Which is yours closest to\?/); assert(text(f).includes('Three answers to compare with'));
    if (id === 'split-it') { assert.equal(doc(f).querySelectorAll('.wu-yours li').length, L.branchesOf(d1.weak).length); assert.equal(doc(f).querySelectorAll('.mv-grade.weak li').length, L.branchesOf(d1.weak).length, 'examples one branch per line'); }
    else assert.equal(f.$('app').querySelector('.wu-yours').textContent, d1.weak);
    if (id === 'hold-or-change') assert(text(f).includes(d1.call === 'hold' ? 'The strong answer holds: nothing the interviewer said touches the reason.' : 'The strong answer changes: the interviewer gave a fact that touches the reason.'));
    else assert.doesNotMatch(text(f), /The strong answer (holds|changes)/);
    if (id === 'next-line') assert(text(f).includes('What the group needed here: ' + C.NEXT_LINES[d1.need].label + '.')); else assert.doesNotMatch(text(f), /What the group needed here/);
    f.$('mvNext').click(); assert.equal(tool(f).run.index, 4, 'cannot continue without a grade'); assert.match(f.$('flowHint').textContent, /Choose which answer/);
    f.$('mvGrade-weak').click(); assert.equal(tool(f).history.at(-1).grade, 'weak'); f.$('mvNext').click();
    // Do 2: the strong example passes every check.
    const d2 = set.items[5]; assert.match(text(f), /DO · 2 OF 2/); type(f, 'mvAnswer', d2.strong); f.$('mvCheck').click();
    assert.equal(doc(f).querySelectorAll('.bh-checks li.warn').length, 0, 'strong passes every check'); assert(f.$('mvFeedback').textContent.includes('✓ Every check passed')); f.$('mvGrade-strong').click();
    assert.equal(f.$('mvNext').textContent, 'See your results →'); f.$('mvNext').click();
    // Results and history.
    assert.equal(tool(f).screen, 'results'); assert.equal(tool(f).run, null); assert.match(text(f), /Spot: 3 of 4 right\./); assert.match(text(f), /Do: 1 of 2 passed\./); assert.equal(doc(f).querySelectorAll('.drill-review').length, 6);
    const name = { 'split-it': 'question', 'one-question': 'brief', 'hold-or-change': 'push', 'put-a-number': 'line', 'next-line': 'topic' }[id], rows = [...doc(f).querySelectorAll('.drill-review')];
    set.items.forEach((x, i) => assert(rows[i].querySelector('summary').textContent.includes(x[name]), 'the item is named by its ' + name));
    assert(rows[0].textContent.includes('Right answer: ' + it.options[right].text), 'a wrong Spot says what was right'); assert(rows[0].textContent.includes(it.options[wrong].why));
    assert(rows[4].textContent.includes('To fix:') && rows[4].textContent.includes(C.GRADES.weak.label.toLowerCase())); assert(rows[5].textContent.includes('Every check passed'));
    const h = JSON.parse(f.w.localStorage.getItem('cr-moves-history')); assert.equal(h.length, 6); assert.deepEqual(h.map(e => e.rung), ['spot', 'spot', 'spot', 'spot', 'do', 'do']); assert.deepEqual(h.map(e => e.ok), [false, true, true, true, false, true]);
    assert.equal(h[0].pick, it.options[wrong].kind); for (let i = 1; i < 4; i++) assert.equal(h[i].pick, set.items[i].options.find(o => o.right).kind);
    assert.equal(h[4].grade, 'weak'); assert.equal(h[5].grade, 'strong'); assert(h.every(e => e.move === id && Number.isFinite(e.seconds)));
    assert.equal(f.w.localStorage.getItem('cr-moves-run'), null); assert.equal(f.$('mvCases') || f.$('mvHr') || f.$('mvGd'), null, 'not ready yet, so no way on');
  } finally { end(f); }
});

test('a reload mid-set resumes Split it at the same item with the typed branches, and Home lists it', () => {
  const f = page(), set = setOf('split-it', 11); let g, h;
  try {
    open(f, 'split-it', 11); for (let i = 0; i < 4; i++) { strongPlay(f, set.items[i]); f.$('mvNext').click(); }
    type(f, 'mvAnswer', 'Fewer students\nHigher costs');
    g = page({ storage: kept(f) }); assert.equal(view(g), 'home');
    const item = doc(g).querySelector('[data-continue=moves]'); assert(item); assert.match(item.textContent, /Move.*Split it.*Item 5 of 6/s);
    item.click(); assert.equal(view(g), 'moves'); assert.equal(g.$('mvAnswer').value, 'Fewer students\nHigher costs'); assert.match(text(g), /SPLIT IT · DO · 1 OF 2/); assert.equal(tool(g).run.index, 4);
    for (const t of SITUATION['split-it'](set.items[4])) assert(text(g).includes(t));
    h = page({ storage: kept(f), url: 'https://case.example/#moves' }); assert.equal(h.$('move-split-it').textContent, 'Continue →');
    // After checking, the feedback comes back too.
    f.$('mvCheck').click(); f.$('mvGrade-adequate').click(); const m = page({ storage: kept(f), url: 'https://case.example/#moves/split-it' });
    try { assert(m.$('mvFeedback')); assert(m.$('mvGrade-adequate').checked); assert.equal(doc(m).querySelectorAll('.wu-yours li').length, 2); assert.equal(tool(m).history.length, 5); end(m); } catch (e) { m.dom.window.close(); throw e; }
  } finally { end(f, g, h); }
});

test('malformed saved items for each new move are dropped without an error', () => {
  const clone = x => JSON.parse(JSON.stringify(x));
  for (const id of AUTH) {
    const good = { ...clone(setOf(id, 3)), index: 0, results: [], draft: '', verdict: null };
    const withItem = (i, change) => { const r = clone(good); change(r.items[i]); return r; };
    const noField = { 'split-it': 'question', 'one-question': 'known', 'hold-or-change': 'push', 'put-a-number': 'facts', 'next-line': 'lines' }[id];
    const variants = [
      withItem(0, x => x.options.pop()), withItem(0, x => { x.options.forEach(o => { o.right = true; }); }), withItem(0, x => { x.options.forEach(o => { o.right = false; }); }),
      withItem(0, x => { x.options[0].kind = 'nonsense'; }), withItem(0, x => { x.options[1].kind = 'constructor'; }), withItem(0, x => { x.options[0].right = 'yes'; }),
      withItem(0, x => { x.options[2].why = 5; }), withItem(0, x => { delete x.options; }),
      withItem(0, x => { delete x[noField]; }), withItem(4, x => { delete x[noField]; }), withItem(4, x => { x.weak = 5; }), withItem(5, x => { x.adequate = null; }),
      ...({ 'split-it': [withItem(0, x => { x.branches = 'a'; }), withItem(0, x => { x.flaw = 'zzz'; }), withItem(0, x => { delete x.root; })],
        'one-question': [withItem(0, x => { x.known = [1]; }), withItem(4, x => { x.brief = 3; })],
        'hold-or-change': [withItem(0, x => { x.call = 'maybe'; }), withItem(0, x => { delete x.said; })],
        'put-a-number': [withItem(0, x => { x.facts = 'x'; }), withItem(4, x => { x.line = {}; })],
        'next-line': [withItem(0, x => { x.names = 'Ria'; }), withItem(0, x => { x.lines = [{ who: 'A' }]; }), withItem(0, x => { x.need = 'nope'; }), withItem(4, x => { delete x.keywords; }), withItem(4, x => { x.keywords = [1]; })] })[id]
    ];
    const ok = page({ storage: { 'cr-moves-run': JSON.stringify(good) } }); try { assert(tool(ok).run, id + ': an intact saved set loads'); assert.equal(tool(ok).run.move, id); } finally { end(ok); }
    variants.forEach((v, n) => { const f = page({ storage: { 'cr-moves-run': JSON.stringify(v) } }); try { assert.equal(tool(f).run, null, id + ' variant ' + n); assert.equal(f.w.localStorage.getItem('cr-moves-run'), null, 'the bad run is removed'); assert.equal(doc(f).querySelector('[data-continue=moves]'), null); } finally { end(f); } });
  }
});

test('the hub groups the moves by round, and the home page splits assess yourself from train one skill', () => {
  const f = page();
  try {
    // Home: the page splits into Assess yourself (the five rounds) and Train one skill (the moves, under the same five round names).
    const halves = [...doc(f).querySelectorAll('.home-split > .home-half')]; assert.equal(halves.length, 2);
    assert.match(halves[0].textContent, /ASSESS YOURSELF/); assert.equal(halves[0].querySelectorAll('.round-tile').length, 5); assert.equal(halves[0].querySelectorAll('.home-move').length, 0);
    assert.match(halves[1].textContent, /TRAIN ONE SKILL/); assert.equal(halves[1].querySelectorAll('.round-tile').length, 0); assert(halves[1].contains(f.$('homeMovesHub')));
    const rounds = [...halves[0].querySelectorAll('.round-tile b')].map(b => b.textContent), homeTitles = [...halves[1].querySelectorAll('.home-move-group-title')];
    assert.deepEqual(homeTitles.map(h => h.textContent), rounds, 'the moves sit under the same round names, in the same order');
    const byRound = homeTitles.map(h => { assert.equal(h.tagName, 'H3'); const ul = h.nextElementSibling; assert(ul.classList.contains('home-move-list')); return [...ul.querySelectorAll('button')].map(b => b.id.replace('homeMove-', '')); });
    assert.deepEqual(byRound, [['put-a-number'], ['triage'], ['next-line'], ['split-it', 'one-question', 'so-what', 'number-sense'], ['answer-first', 'hold-or-change']]);
    assert.deepEqual(byRound.flat().sort(), C.MOVES.map(m => m.id).sort(), 'every move appears exactly once'); assert.equal(doc(f).querySelectorAll('.home-move').length, 9);
    // The phone-only jump buttons move focus to each half.
    f.$('homeJumpTrain').click(); assert.equal(doc(f).activeElement, f.$('homeMovesTitle')); f.$('homeJumpAssess').click(); assert.equal(doc(f).activeElement, f.$('homeRoundsTitle'));
    const homeCss = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'assets', 'home.css'), 'utf8'); assert.match(homeCss, /\.home-jump\{display:none\}/); assert.match(homeCss, /max-width:800px\)\{[^@]*\.home-jump\{display:grid/);
    f.$('homeMovesHub').click(); const titles = [...doc(f).querySelectorAll('.mv-group-title')]; assert.deepEqual(titles.map(t => t.textContent), C.GROUPS.map(g => g.title)); assert(titles.every(t => t.tagName === 'H2'));
    titles.forEach((h, i) => { const ul = h.nextElementSibling; assert(ul.classList.contains('mv-cards')); assert.deepEqual([...ul.querySelectorAll('button')].map(b => b.id), C.GROUPS[i].moves.map(id => 'move-' + id)); assert.deepEqual([...ul.querySelectorAll('li')].length, C.GROUPS[i].moves.length); });
    assert.equal(doc(f).querySelectorAll('.mv-card').length, 9); assert.deepEqual(titles.map(t => t.nextElementSibling.children.length), [4, 3, 1, 1]); assert.equal(doc(f).querySelectorAll('.mv-note').length, 2, 'both notes are kept');
    assert.equal(f.$('move-next-line').closest('.mv-card').querySelector('h2').textContent, 'Your next line');
    f.$('homeNav').click(); f.$('homeMove-hold-or-change').click(); assert.equal(tool(f).screen, 'learn'); assert.equal(f.w.location.hash, '#moves/hold-or-change');
    const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'assets', 'moves.css'), 'utf8'); for (const sel of ['mv-group-title', 'home-move-group-title', 'mv-tree', 'mv-talk', 'mv-said', 'mv-branches']) assert(css.includes('.' + sel), sel);
  } finally { end(f); }
});

test('a ready move says where to use it next: a case, an HR interview or a group discussion', () => {
  const f = page({ storage: { 'cr-moves-history': JSON.stringify([...readyHistory('split-it'), ...readyHistory('put-a-number', 5000), ...readyHistory('next-line', 9000)]), 'cr-moves-seen': '["split-it","put-a-number","next-line"]' } });
  try {
    assert.equal(f.$('homeMove-next-line').textContent.includes('Ready. Now use it in a group discussion.'), true); assert(f.$('homeMove-split-it').textContent.includes('Ready. Now use it in a full case or interview.'));
    f.$('homeMovesHub').click(); assert(f.$('move-next-line').closest('.mv-card').textContent.includes('Ready. Now use it in a group discussion.')); assert(f.$('move-put-a-number').closest('.mv-card').textContent.includes('Ready. Now use it in a full case or interview.'));
    const want = { 'split-it': ['mvCases', 'Use it in a full case →', 'cases'], 'put-a-number': ['mvHr', 'Use it in an HR interview →', 'behavioural'], 'next-line': ['mvGd', 'Run a group discussion →', 'gd'] };
    for (const [id, [btn, label, where]] of Object.entries(want)) {
      f.run(`MovesTool.openMove('${id}', { seed: 4 })`); for (const it of setOf(id, 4).items) { strongPlay(f, it); f.$('mvNext').click(); }
      assert.equal(tool(f).screen, 'results'); assert.match(text(f), /You have met the bar/); assert.equal(f.$(btn).textContent, label); assert.equal(doc(f).querySelectorAll('#mvCases, #mvHr, #mvGd').length, 1);
      f.$(btn).click(); assert.equal(view(f), where, id);
    }
  } finally { end(f); }
});

/* ---------- Self-checks in the matching debriefs ---------- */
const allReady = ids => JSON.stringify(ids.flatMap((id, i) => readyHistory(id, 1000 + i * 100)));
const store = f => Object.fromEntries(Object.keys(f.w.localStorage).map(k => [k, f.w.localStorage.getItem(k)]));
const Q = {
  case: { 'split-it': 'Did your structure split the problem into branches that did not overlap?', 'one-question': 'Before each request for data, could you say what its answer would change?', 'so-what': 'When you opened an exhibit, did you say what it meant before reading the numbers out?', 'number-sense': 'Did you sanity-check each figure before you said it?',
    'hold-or-change': 'When the interviewer pushed back, did you change your answer only for a new fact?', 'answer-first': 'Did your recommendation open with the answer?' },
  hr: { 'answer-first': 'Did each answer open with your answer, before the story?', 'hold-or-change': 'When a follow-up challenged you, did you hold or change for a reason, not for the pressure?', 'put-a-number': 'Did each story have a number, and say what you did with “I”?' },
  defence: { 'answer-first': 'Did you answer each question in your first sentence?', 'hold-or-change': 'When the interviewer doubted a claim, did you hold or change for a reason, not for the pressure?', 'put-a-number': 'Did you give each result as a number, and say which part was yours?' },
  gd: { 'next-line': 'Before you spoke, did you ask what the group needed: a build, a name, a steer or a summary?' }
};
const tickBoxes = f => [...doc(f).querySelectorAll('#movesDebrief [data-transfer]')];
const tick = (f, box) => { box.checked = true; box.dispatchEvent(new f.w.Event('change', { bubbles: true })); };

test('the case debrief shows the self-check for Split it, Ask the one question and Hold or change, never Put a number on it or Your next line', () => {
  const f = page({ storage: { 'cr-moves-history': allReady(['put-a-number', 'next-line']) } });
  try {
    showReport(f, 5); assert.equal(f.$('movesTransfer').querySelector('[data-transfer]'), null, 'put a number and your next line do not belong in a case'); assert.match(f.$('movesTransfer').textContent, /Train one move in five minutes before your next case/);
    f.run(`MovesTool.state().history.push(...${JSON.stringify(readyHistory('hold-or-change', 3000))}, ...${JSON.stringify(readyHistory('split-it', 4000))}, ...${JSON.stringify(readyHistory('one-question', 5000))})`);
    showReport(f, 5); const boxes = [...doc(f).querySelectorAll('#movesTransfer [data-transfer]')]; assert.deepEqual(boxes.map(b => b.dataset.transfer), ['split-it', 'one-question', 'hold-or-change']);
    for (const b of boxes) assert(b.closest('label').textContent.includes(Q.case[b.dataset.transfer]), b.dataset.transfer); assert.doesNotMatch(f.$('movesTransfer').textContent, /number, and say what you did|what the group needed/);
    f.run(`MovesTool.state().history.push(...${JSON.stringify([].concat(...['so-what', 'number-sense', 'answer-first'].map((id, i) => readyHistory(id, 9000 + i * 50))))})`);
    showReport(f, 5); assert.deepEqual([...doc(f).querySelectorAll('#movesTransfer [data-transfer]')].map(b => b.dataset.transfer), ['split-it', 'one-question', 'so-what', 'number-sense', 'hold-or-change', 'answer-first'], 'only these six, in this order');
    assert.equal(doc(f).querySelectorAll('#movesTransfer label').length, 6); assert(doc(f).querySelector('#movesTransfer [data-transfer=hold-or-change]').closest('label').textContent.includes(Q.case['hold-or-change']));
  } finally { end(f); }
});

/* A finished HR practice, one answer long: the practice summary is what the student sees, the strict debrief after their own call. */
const QID = require('../src/behavioural-content.js').pickQuestion('mixed', []).id;
const hrStorage = (strict, extra = {}) => ({
  'cr-behavioural-attempts': JSON.stringify([{ id: 'hr-a1', at: 1000, competency: 'leadership', qid: QID, text: 'I organised the fest and sales rose by 20%.', ...(strict ? { strict: true, followUps: [] } : {}) }]),
  'cr-behavioural-set': JSON.stringify({ mode: 'mixed', qids: [QID], index: 0, answers: ['hr-a1'], fixed: true, ...(strict ? { strict: true, plan: [], over: true, guessed: false, guess: null, left: 0 } : { review: true }) }), ...extra
});

test('the HR practice summary and the strict HR debrief show the self-check for ready moves, once, and keep the ticks', () => {
  const ready = { 'cr-moves-history': allReady(['answer-first', 'hold-or-change', 'put-a-number', 'split-it', 'next-line']) };
  const f = page({ storage: hrStorage(false, ready) }); let g, h, k, n;
  try {
    f.run('Behavioural.resume()'); assert.equal(f.$('movesDebrief'), null, 'not on the review screen'); f.$('bhNext').click(); assert(text(f).includes('PRACTICE DONE'));
    let sec = f.$('movesDebrief'); assert(sec); assert.equal(sec.id, 'movesDebrief'); assert(sec.classList.contains('mv-transfer')); assert.equal(sec.querySelector('h3').textContent, 'Moves you have trained'); assert.match(sec.textContent, /This is your own judgement, not a score\./);
    assert.deepEqual(tickBoxes(f).map(b => b.dataset.transfer), ['answer-first', 'hold-or-change', 'put-a-number'], 'only the moves that belong to an HR interview');
    for (const b of tickBoxes(f)) assert(b.closest('label').classList.contains('selfcheck') && b.closest('label').textContent.includes(Q.hr[b.dataset.transfer]));
    const bar = doc(f).querySelectorAll('#app .flow-bar'); assert.equal(sec.nextElementSibling, bar[bar.length - 1], 'just before the last flow bar'); assert.equal(doc(f).querySelectorAll('#movesDebrief').length, 1);
    tick(f, tickBoxes(f)[2]); assert.deepEqual(JSON.parse(f.w.localStorage.getItem('cr-moves-transfer')), { 'hr:hr-a1': ['put-a-number'] });
    // Strict: nothing on the guess screen, the questions on the feedback screen, ticks after a reload.
    g = page({ storage: hrStorage(true, ready) }); g.run('Behavioural.resume()'); assert(g.$('bhReveal')); assert.equal(g.$('movesDebrief'), null, 'not on the which-was-weakest screen');
    g.$('bhReveal').click(); assert(text(g).includes('INTERVIEW OVER')); assert.deepEqual([...doc(g).querySelectorAll('#movesDebrief [data-transfer]')].map(b => b.dataset.transfer), ['answer-first', 'hold-or-change', 'put-a-number']);
    for (const b of doc(g).querySelectorAll('#movesDebrief [data-transfer]')) assert(b.closest('label').textContent.includes(Q.hr[b.dataset.transfer]));
    tick(g, doc(g).querySelector('#movesDebrief [data-transfer=hold-or-change]')); assert.deepEqual(JSON.parse(g.w.localStorage.getItem('cr-moves-transfer')), { 'hr:hr-a1': ['hold-or-change'] });
    h = page({ storage: store(g) }); h.run('Behavioural.resume()'); assert.equal(h.$('bhReveal'), null, 'the guess was already made'); assert.deepEqual([...doc(h).querySelectorAll('#movesDebrief [data-transfer]')].filter(b => b.checked).map(b => b.dataset.transfer), ['hold-or-change'], 'the tick survives a reload');
    assert.equal(doc(h).querySelectorAll('#movesDebrief').length, 1, 'never duplicated');
    // None ready: nothing is drawn.
    k = page({ storage: hrStorage(true, { 'cr-moves-history': allReady(['split-it', 'next-line']) }) }); k.run('Behavioural.resume()'); k.$('bhReveal').click(); assert.equal(k.$('movesDebrief'), null, 'split it and your next line are not HR self-checks');
    n = page({ storage: hrStorage(false) }); n.run('Behavioural.resume()'); n.$('bhNext').click(); assert(text(n).includes('PRACTICE DONE')); assert.equal(n.$('movesDebrief'), null);
  } finally { end(f, g, h, k, n); }
});

test('the defence debrief shows the self-check for ready moves, keeps the ticks and shows nothing when none is ready', () => {
  const q1 = { id: 'choice', text: 'Why did you build it that way?', why: 'Because.', listenFor: ['a', 'b', 'c'] };
  const past = JSON.stringify([{ id: 'ok1', kind: 'project', title: 'Robot', projectKind: 'other', questions: [q1], answers: [{ id: 'choice', text: 'An answer', seconds: 20, voice: false, follow: null, reply: '' }], heard: {}, rewrite: '', finished: 1700000000000 }]);
  const f = page({ storage: { 'cr-defence-past': past, 'cr-moves-history': allReady(['answer-first', 'hold-or-change', 'put-a-number', 'so-what', 'next-line']) } }); let g, h;
  try {
    f.run('DefenceTool.open()'); assert.equal(f.$('movesDebrief'), null); doc(f).querySelector('[data-df-view=ok1]').click(); assert(text(f).includes('DEFENCE OVER'));
    assert.deepEqual(tickBoxes(f).map(b => b.dataset.transfer), ['answer-first', 'hold-or-change', 'put-a-number']);
    for (const b of tickBoxes(f)) assert(b.closest('label').textContent.includes(Q.defence[b.dataset.transfer]));
    const bar = doc(f).querySelectorAll('#app .flow-bar'); assert.equal(f.$('movesDebrief').nextElementSibling, bar[bar.length - 1]); assert.match(f.$('movesDebrief').textContent, /your own judgement, not a score/);
    tick(f, tickBoxes(f)[1]); assert.deepEqual(JSON.parse(f.w.localStorage.getItem('cr-moves-transfer')), { 'defence:ok1': ['hold-or-change'] });
    f.$('dfBack').click(); doc(f).querySelector('[data-df-view=ok1]').click(); assert.equal(doc(f).querySelectorAll('#movesDebrief').length, 1); assert.deepEqual(tickBoxes(f).filter(b => b.checked).map(b => b.dataset.transfer), ['hold-or-change']);
    g = page({ storage: store(f) }); g.run('DefenceTool.open()'); doc(g).querySelector('[data-df-view=ok1]').click(); assert.deepEqual([...doc(g).querySelectorAll('#movesDebrief [data-transfer]')].filter(b => b.checked).map(b => b.dataset.transfer), ['hold-or-change'], 'after a reload');
    h = page({ storage: { 'cr-defence-past': past, 'cr-moves-history': allReady(['next-line', 'split-it']) } }); h.run('DefenceTool.open()'); doc(h).querySelector('[data-df-view=ok1]').click(); assert(text(h).includes('DEFENCE OVER')); assert.equal(h.$('movesDebrief'), null);
  } finally { end(f, g, h); }
});

test('the group discussion debrief shows the Your next line self-check when it is ready, keeps the tick and shows nothing otherwise', () => {
  const GL = require('../src/gd-logic.js');
  const session = { ...GL.newSession({ briefId: 'library', names: ['Asha', 'Ben', 'Chitra'], observer: true, observerName: 'Dev', discussSeconds: 480, now: Date.now() - 600000 }), phase: 'debrief', phaseStarted: null, finished: Date.now() };
  const run = JSON.stringify([session]), id = session.id, viewBtn = g => doc(g).querySelector(`[data-gd-view="${id}"]`);
  const f = page({ storage: { 'cr-gd-past': run, 'cr-moves-history': allReady(['next-line', 'answer-first', 'put-a-number']) } }); let g, h;
  try {
    f.run('GDTool.open()'); assert.equal(f.$('movesDebrief'), null); viewBtn(f).click(); assert(text(f).includes('GROUP DISCUSSION · DEBRIEF')); assert.deepEqual(tickBoxes(f).map(b => b.dataset.transfer), ['next-line']); assert(tickBoxes(f)[0].closest('label').textContent.includes(Q.gd['next-line']));
    const bar = doc(f).querySelectorAll('#app .flow-bar'); assert.equal(f.$('movesDebrief').nextElementSibling, bar[bar.length - 1]); assert.equal(doc(f).querySelectorAll('#movesDebrief').length, 1);
    tick(f, tickBoxes(f)[0]); assert.deepEqual(JSON.parse(f.w.localStorage.getItem('cr-moves-transfer')), { ['gd:' + id]: ['next-line'] });
    g = page({ storage: store(f) }); g.run('GDTool.open()'); viewBtn(g).click(); assert.equal(tickBoxes(g)[0].checked, true, 'the tick comes back'); assert.equal(doc(g).querySelectorAll('#movesDebrief').length, 1);
    h = page({ storage: { 'cr-gd-past': run, 'cr-moves-history': allReady(['answer-first', 'hold-or-change', 'put-a-number', 'split-it']) } }); h.run('GDTool.open()'); viewBtn(h).click(); assert(text(h).includes('GROUP DISCUSSION · DEBRIEF')); assert.equal(h.$('movesDebrief'), null);
  } finally { end(f, g, h); }
});

test('plan items open each new move, and the plan offers them for the right rounds', () => {
  const N = require('../content/next-round.js'), ids = list => list.map(e => e.id), f = page();
  const where = { 'move-split-it': ['case', 'resume'], 'move-one-question': ['case'], 'move-hold-or-change': ['hr', 'technical'], 'move-put-a-number': ['hr', 'resume'], 'move-next-line': ['gd'] };
  const whys = { 'move-split-it': 'Your structure decides what you look at next. Practise splitting a problem into branches that do not overlap and leave nothing out.', 'move-one-question': 'One sharp question beats a request for all the data. Practise asking the question whose answer changes your next step.',
    'move-hold-or-change': 'Interviewers push back to test you. Practise holding for a reason, and changing only for a new fact.', 'move-put-a-number': 'Interviewers write down numbers, not adjectives. Practise saying what you did and how much changed.', 'move-next-line': 'Observers note what each line did for the group. Practise reading what the discussion needs before you speak.' };
  for (const [key, why] of Object.entries(whys)) assert.equal(N.ITEMS[key].why, why);
  assert.deepEqual(ids(N.plan({ round: 'hr', minutes: 90 })).filter(x => x.startsWith('move-')), ['move-answer-first', 'move-put-a-number', 'move-hold-or-change']);
  assert.deepEqual(ids(N.plan({ round: 'gd', minutes: 45 })).slice(0, 4), ['gd-kit', 'gd-moves', 'move-next-line', 'move-answer-first']); assert.equal(ids(N.plan({ round: 'resume', minutes: 45 }))[2], 'move-put-a-number');
  assert(ids(N.plan({ round: 'case', role: 'operations', minutes: 90 })).includes('move-one-question')); assert(ids(N.plan({ round: 'technical', minutes: 45 })).includes('move-hold-or-change'));
  for (const r of ['aptitude', 'unknown']) for (const m of [10, 20, 45, 90]) assert(!ids(N.plan({ round: r, minutes: m })).some(x => Object.keys(where).includes(x)), r + ' plans are unchanged');
  try {
    for (const id of AUTH) {
      const it = N.ITEMS['move-' + id], m = C.MOVES.find(x => x.id === id); assert.deepEqual(it.open, { tool: 'moves', move: id }); assert.equal(it.title, 'Train one move: ' + m.title); assert.equal(it.minutes, 5); assert.equal(it.tool, 'Moves');
      f.run(`NextRoundTool.go('move-${id}')`); assert.equal(view(f), 'moves'); assert.equal(tool(f).screen, 'learn'); assert.equal(f.w.location.hash, '#moves/' + id); f.$('mvStart').click(); assert.equal(tool(f).run.move, id); f.$('mvExit').click();
      f.run("MovesTool.state().run = null"); f.run("(()=>{localStorage.removeItem('cr-moves-run')})()");
    }
  } finally { end(f); }
});
