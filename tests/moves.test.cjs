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

test('the home page lists the four moves with their status', () => {
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
    assert.equal(tool(f).screen, 'results'); assert.match(text(f), /You have met the bar/); f.$('mvCases').click(); assert.equal(view(f), 'cases');
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
  assert.deepEqual(ids(N.plan({ round: 'hr', minutes: 20 })).slice(0, 2), ['bh-intro', 'move-answer-first']); assert.equal(ids(N.plan({ round: 'gd', minutes: 45 }))[2], 'move-answer-first');
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

test('Attempt, leave or guess: the home page row and the hub lay out four moves', () => {
  const f = page();
  try {
    assert.equal(doc(f).querySelectorAll('.home-move-list li').length, 4); assert.match(f.$('homeMove-triage').textContent, /Attempt, leave or guess.*Not started/s);
    f.$('homeMove-triage').click(); assert.equal(tool(f).screen, 'learn'); assert.equal(doc(f).querySelectorAll('.mv-rule li').length, 3);
    f.$('mvHub').click(); assert.equal(doc(f).querySelectorAll('.mv-card').length, 4); assert.match(f.$('move-triage').closest('.mv-card').textContent, /Attempt, leave or guess.*Pick up the quick marks first.*Pays off in: Online aptitude test.*Not started/s);
    const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'assets', 'moves.css'), 'utf8'); assert.match(css, /\.mv-cards\{[^}]*auto-fit/); assert.match(css, /\.home-move-list\{[^}]*auto-fit/);
    f.$('homeNav').click(); f.$('round-case').click(); assert.match(f.$('caseTool-moves').closest('.case-tool').textContent, /sort test questions/);
  } finally { end(f); }
});
