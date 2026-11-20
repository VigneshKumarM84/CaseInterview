/* Group discussion kit: the briefs, the rules (Node, no DOM), then the screens (jsdom, with time faked). */
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture } = require('./dom.cjs');
const C = require('../content/gd.js'), L = require('../src/gd-logic.js');

const GAP = /undefined|\bnull\b|NaN|\[object/;
const { MOVES, TIMINGS, BRIEFS } = C;
const brief = id => BRIEFS.find(b => b.id === id);
const seen = b => [b.brief, b.task, b.closing, ...b.evidence.flatMap(e => [e.title, e.text])].join('\n');
const hidden = b => [...b.balanced, ...b.tensions, ...b.traps];

/* ---------- The briefs ---------- */
test('every brief has the full schema: counts, unique ids, real text, no gaps', () => {
  assert.deepEqual(BRIEFS.map(b => b.id), ['mess', 'fest', 'library', 'layoff', 'attendance', 'wfh']);
  assert.equal(new Set(BRIEFS.map(b => b.id)).size, BRIEFS.length, 'brief ids are unique');
  assert.deepEqual(Object.fromEntries(BRIEFS.map(b => [b.id, b.type])), { mess: 'decision', fest: 'decision', library: 'decision', layoff: 'decision', attendance: 'opinion', wfh: 'opinion' });
  const filled = s => typeof s === 'string' && s.trim().length > 2 && !GAP.test(s), long = s => filled(s) && s.trim().length > 30;
  for (const b of BRIEFS) {
    assert(/^[a-z]+$/.test(b.id), b.id);
    assert(['decision', 'opinion'].includes(b.type), b.id);
    for (const k of ['title', 'setting']) assert(filled(b[k]), `${b.id}.${k}`); for (const k of ['brief', 'task', 'closing']) assert(long(b[k]), `${b.id}.${k}`);
    assert(b.evidence.length >= 5 && b.evidence.length <= 6, `${b.id} evidence count ${b.evidence.length}`);
    assert(b.tensions.length >= 3 && b.tensions.length <= 4, `${b.id} tensions`);
    assert(b.balanced.length >= 5 && b.balanced.length <= 6, `${b.id} balanced`);
    assert(b.traps.length >= 4 && b.traps.length <= 5, `${b.id} traps`);
    assert.equal(new Set(b.evidence.map(e => e.id)).size, b.evidence.length, `${b.id} evidence ids are unique`);
    for (const e of b.evidence) { assert(/^[\w-]+$/.test(e.id), e.id); assert(filled(e.title) && long(e.text), `${b.id}/${e.id}`); assert.deepEqual(Object.keys(e).sort(), ['id', 'text', 'title']); }
    for (const list of [b.tensions, b.balanced, b.traps]) { assert.equal(new Set(list).size, list.length, `${b.id} repeats a line`); list.forEach(x => assert(long(x), `${b.id}: ${x}`)); }
    assert.deepEqual(Object.keys(b).sort(), ['balanced', 'brief', 'closing', 'evidence', 'id', 'setting', 'task', 'tensions', 'title', 'traps', 'type'], b.id);
    assert(!/\b(Infosys|TCS|Wipro|Google|Amazon|Flipkart|Zomato|Swiggy|IIT|IIM)\b/.test(JSON.stringify(b)), `${b.id} names no real organisation`);
    assert(b.id === 'attendance' || /₹/.test(JSON.stringify(b)), `${b.id} uses rupees`);
  }
  assert(MOVES.length >= 8 && MOVES.every(m => m.id && m.label && m.hint && ['good', 'watch'].includes(m.kind)));
  assert.deepEqual(TIMINGS.discuss, [360, 480, 600, 720]);
  assert.equal(brief('fest').evidence.length, 6); assert.equal(brief('library').evidence.length, 5);
});

test('nothing shown to participants contains the balanced, tensions or traps text', () => {
  for (const b of BRIEFS) {
    const shown = seen(b);
    for (const h of hidden(b)) { assert(!shown.includes(h), `${b.id}: hidden text appears in the shown text`); assert(!shown.includes(h.slice(0, 50)), `${b.id}: its first words appear in the shown text`); }
    for (const e of b.evidence) for (const h of hidden(b)) assert(!e.text.includes(h) && !h.includes(e.text), `${b.id}/${e.id}`);
  }
});

test('the arithmetic in each new brief holds (figures stated in the text are the figures that follow)', () => {
  const t = id => JSON.stringify(brief(id));
  // fest
  assert.equal(190 + 150 + 110 + 100 + 60 + 40, 650); assert.equal(300 + 90 + 80, 470); assert.equal(650 - 470, 180); assert.equal(200000 - 6 * 5000, 170000);
  assert(t('fest').includes('₹6,50,000') && t('fest').includes('₹4,70,000') && t('fest').includes('₹1,80,000') && t('fest').includes('₹1,70,000') && t('fest').includes('₹1,65,000'));
  assert.equal(1e5 + 2e4 + 45e3, 165000); assert.equal(0.8 * 2000 * 200, 320000); assert.equal(1400 * 200, 280000); assert.equal((300000 + 180000) / 200, 2400); assert.equal(700 * 150, 105000);
  // library
  assert.equal(2400 + 600 + 1500, 4500); assert.equal(14 * 4500, 63000); assert.equal(40 + 25 + 10, 75); assert.equal(55 + 12 + 8, 75); assert.equal(100 * 4500 + 30000, 480000); assert.equal(28 * 4500 + 30000, 156000); assert.equal(300000 - 156000, 144000); assert.equal(4500 / 75, 60);
  // layoff
  assert.equal(4 * 150000 + 8 * 100000 + 16 * 70000 + 12 * 40000, 3000000); assert.equal(3000000 + 300000 + 200000 + 300000, 3800000); assert.equal(3800000 - 2200000, 1600000); assert.equal(12000000 / 1600000, 7.5); assert.equal(12000000 / 1000000, 12);
  assert.equal(12 * 40000 + 2 * 70000, 620000); assert.equal(2 * 620000, 1240000); assert.equal((12000000 - 1240000) / (1600000 - 620000) > 10.97 && (12000000 - 1240000) / (1600000 - 620000) < 10.99, true);
  assert.equal(4 * 30000 + 8 * 20000 + 16 * 14000 + 12 * 8000, 600000); assert.equal(150000 + 2 * 100000 + 3 * 70000, 560000); assert.equal(560000 + 60000 - 400000, 220000); assert.equal(600000 - 220000, 380000);
  // attendance
  assert.equal(400 + 80, 480); assert.equal(54 + 36 + 30, 120); assert.equal(348 + 252, 600); assert.equal(21 / 60, 0.35); assert.equal(12 / 240, 0.05); assert.equal(50 / 400, 0.125); assert.equal(85 - 51, 34);
  // wfh
  assert.equal(14000 + 8000 + 2000, 24000); assert.equal(24000 / 32000, 0.75); assert.equal((24000 - 6000) * 12, 216000); assert.equal(32000 * 12, 384000); assert.equal(78 / 120, 0.65); assert.equal(Math.round(41 * 0.89 * 10) / 10, 36.5); assert.equal(Math.round(38 * 0.94 * 10) / 10, 35.7);
});

/* ---------- Rules: setting up ---------- */
const names4 = ['Asha', 'Ben', 'Chitra', 'Dev'];
test('set-up: three to six names, no duplicates, and an observer takes one of them out of the speakers', () => {
  const ok = L.checkSetup(['Asha', 'Ben', 'Chitra']); assert.deepEqual({ ok: ok.ok, names: ok.names, observerName: ok.observerName }, { ok: true, names: ['Asha', 'Ben', 'Chitra'], observerName: '' });
  assert.match(L.checkSetup(['Asha', 'Ben']).error, /at least 3/); assert.match(L.checkSetup(['Asha', '', '  ']).error, /at least 3/, 'blank rows are ignored');
  assert.match(L.checkSetup(['Asha', 'ASHA', 'Ben']).error, /same: ASHA/); assert.match(L.checkSetup(['Asha', ' asha ', 'Ben', 'Dev']).error, /same/, 'ignoring case and spaces');
  assert.match(L.checkSetup(['a', 'b', 'c', 'd', 'e', 'f', 'g']).error, /Six names at most/); assert.equal(L.checkSetup(['a', 'b', 'c', 'd', 'e', 'f']).ok, true);
  assert.match(L.checkSetup(['x'.repeat(31), 'b', 'c']).error, /30 characters/); assert.equal(L.checkSetup(['x'.repeat(30), 'b', 'c']).ok, true);
  assert.deepEqual(L.checkSetup(null).ok, false);
  const obs = L.checkSetup(names4, { observer: true, observerAt: 3 }); assert.deepEqual({ ok: obs.ok, names: obs.names, observerName: obs.observerName }, { ok: true, names: ['Asha', 'Ben', 'Chitra'], observerName: 'Dev' });
  assert.deepEqual(L.checkSetup(['Asha', 'Ben', 'Chitra', 'Dev'], { observer: true, observerAt: 0 }).names, ['Ben', 'Chitra', 'Dev']);
  assert.match(L.checkSetup(['Asha', 'Ben', 'Chitra'], { observer: true, observerAt: 0 }).error, /at least 4 names/);
  assert.match(L.checkSetup(names4, { observer: true, observerAt: 9 }).error, /Choose who is observing/); assert.match(L.checkSetup(['Asha', '', 'Ben', 'Chitra', 'Dev'], { observer: true, observerAt: 1 }).error, /Choose who is observing/, 'a blank row cannot observe');
});

/* ---------- Rules: reading a stored session ---------- */
const NOW = 1_700_000_000_000;
const base = (over = {}) => ({ id: 'g1', briefId: 'fest', names: ['Asha', 'Ben', 'Chitra'], observer: true, observerName: 'Dev', discussSeconds: 480, phase: 'discuss', phaseStarted: NOW, discussEnded: null, log: [], summariser: null, keep: {}, change: {}, started: NOW - 1000, finished: null, ...over });
const clean = v => L.cleanSession(v, NOW);
const entry = (who, move, t, note = '') => ({ t, who, move, note });

test('cleanSession: a valid session comes back as it went in; anything else is null', () => {
  const s = base({ log: [entry(0, 'open', 60, 'framed it'), entry(1, 'build', 190)], summariser: 2, keep: { 0: 'Keep quoting numbers' }, change: { 1: 'Let others finish' } });
  assert.deepEqual(clean(s), s);
  for (const bad of [null, undefined, 5, 'x', [], {}, { ...base(), briefId: 'nope' }, base({ phase: 'later' }), base({ discussSeconds: 500 }), base({ discussSeconds: '480' }), base({ observer: 'yes' }), base({ names: ['Asha', 'Ben'] }), base({ names: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }),
    base({ names: ['Asha', 'asha', 'Ben'] }), base({ names: ['Asha', '', 'Ben'] }), base({ names: ['Asha', 'Ben', 5] }), base({ names: ['Asha', 'Ben', 'x'.repeat(31)] }), base({ names: 'Asha,Ben,Chitra' }), base({ phaseStarted: null }), base({ phaseStarted: 'now' }), base({ phaseStarted: NaN }), base({ phase: 'prepare', phaseStarted: -5 })])
    assert.equal(clean(bad), null, JSON.stringify(bad));
  assert.equal(clean(base({ phase: 'debrief', phaseStarted: null, finished: NOW })).phaseStarted, null, 'a debrief needs no clock');
  assert.equal(clean(base({ phase: 'debrief', phaseStarted: 12345 })).phaseStarted, null);
});

test('cleanSession: bad log entries, summariser, notes and words are dropped one by one', () => {
  const log = [entry(0, 'open', 5), { t: -1, who: 0, move: 'open', note: '' }, { t: 5, who: 3, move: 'open', note: '' }, { t: 5, who: 0, move: 'dance', note: '' }, { t: 'x', who: 0, move: 'open' }, { t: 5, who: 1.5, move: 'open' }, null, 7, { t: 9, who: 2, move: 'repeat', note: 'x'.repeat(300) + '   ' }, { t: 12.6, who: 1, move: 'steer' }];
  const s = clean(base({ log, summariser: 5, keep: { 0: 'ok', 1: '   ', 7: 'out of range', x: 'bad key', 2: 'y'.repeat(900) }, change: 'nope' }));
  assert.deepEqual(s.log.map(e => [e.t, e.who, e.move]), [[5, 0, 'open'], [9, 2, 'repeat'], [13, 1, 'steer']]);
  assert.equal(s.log[1].note.length, 200); assert.equal(s.log[2].note, ''); assert.equal(s.summariser, null);
  assert.deepEqual(Object.keys(s.keep), ['0', '2']); assert.equal(s.keep[2].length, 500); assert.deepEqual(s.change, {});
  assert.equal(clean(base({ summariser: 1 })).summariser, 1);
  assert.equal(clean(base({ log: Array.from({ length: 500 }, (_, i) => entry(i % 3, 'open', i)) })).log.length, 400, 'at most 400 entries');
  assert.deepEqual(clean(base({ observer: false, observerName: 'Dev', log: [entry(0, 'open', 5)] })).log, [], 'no observer, no log'); assert.equal(clean(base({ observer: false, observerName: 'Dev' })).observerName, '');
  assert.equal(clean(base({ id: 'bad id!' })).id.length > 3, true, 'a bad id is replaced'); assert.equal(clean(base({ started: 'x' })).started, NOW);
  assert.equal(clean(base({ phase: 'summary', discussEnded: 9999 })).discussEnded, 480, 'cannot end after the time set'); assert.equal(clean(base({ phase: 'summary' })).discussEnded, 480); assert.equal(clean(base({ phase: 'discuss', discussEnded: 100 })).discussEnded, null);
});

/* ---------- Rules: counting ---------- */
const withLog = (log, over = {}) => clean(base({ log, ...over }));
test('tally: counts, good and watch totals, first and last time', () => {
  const s = withLog([entry(0, 'open', 20), entry(0, 'evidence', 90), entry(0, 'evidence', 150), entry(0, 'interrupt', 200), entry(1, 'repeat', 40)]);
  const t = L.tally(s);
  assert.deepEqual(t.map(r => r.name), ['Asha', 'Ben', 'Chitra']);
  assert.deepEqual({ open: t[0].counts.open, evidence: t[0].counts.evidence, interrupt: t[0].counts.interrupt, good: t[0].good, watch: t[0].watch, first: t[0].first, last: t[0].last }, { open: 1, evidence: 2, interrupt: 1, good: 3, watch: 1, first: 20, last: 200 });
  assert.deepEqual({ good: t[1].good, watch: t[1].watch, first: t[1].first, last: t[1].last }, { good: 0, watch: 1, first: 40, last: 40 });
  assert.deepEqual({ good: t[2].good, watch: t[2].watch, first: t[2].first, last: t[2].last }, { good: 0, watch: 0, first: null, last: null }, 'nothing logged: no times');
  assert(MOVES.every(m => m.id in t[2].counts));
  assert.deepEqual(L.tally(withLog([])).map(r => r.good + r.watch), [0, 0, 0]);
});

test('quietest: fewest good moves; ties go to the one logged longest ago or never, then name order', () => {
  assert.equal(L.quietest(withLog([entry(0, 'open', 10), entry(0, 'evidence', 20), entry(1, 'build', 30), entry(2, 'steer', 40), entry(2, 'build', 50)])), 1, 'fewest good moves');
  assert.equal(L.quietest(withLog([entry(1, 'interrupt', 10), entry(1, 'repeat', 20), entry(0, 'open', 30), entry(2, 'open', 40)])), 1, 'watch moves are not good moves');
  assert.equal(L.quietest(withLog([entry(0, 'open', 100), entry(1, 'open', 50), entry(2, 'open', 200)])), 1, 'tied: logged longest ago');
  assert.equal(L.quietest(withLog([entry(0, 'open', 100), entry(1, 'open', 50), entry(2, 'repeat', 10)])), 2, 'tied at 0 and 1... fewest good first, then never or longest ago');
  assert.equal(L.quietest(withLog([entry(1, 'repeat', 10)])), 0, 'tied at no good moves: never logged beats logged, and Asha comes before Chitra by name');
  assert.equal(L.quietest(withLog([])), 0, 'an empty log falls back to name order');
  assert.equal(L.quietest(clean(base({ names: ['Chitra', 'Asha', 'Ben'], log: [] }))), 1, 'name order, not list order');
  assert.equal(L.quietest(clean(base({ names: ['ben', 'Asha', 'Chitra'], log: [] }))), 1, 'ignoring case');
});

test('clock: seconds left are never negative; signals fire at halfway, one minute and time up; phases move on by the clock', () => {
  const s = (phase, ago, over = {}) => clean(base({ phase, phaseStarted: NOW - ago * 1000, discussEnded: phase === 'summary' ? 480 : null, ...over }));
  assert.equal(L.remaining(s('prepare', 0), NOW), 90); assert.equal(L.remaining(s('prepare', 30.4), NOW), 60); assert.equal(L.remaining(s('prepare', 500), NOW), 0);
  assert.equal(L.remaining(s('discuss', 100), NOW), 380); assert.equal(L.remaining(s('discuss', 9999), NOW), 0); assert.equal(L.remaining(s('summary', 15), NOW), 45);
  assert.equal(L.remaining(clean(base({ phase: 'debrief', phaseStarted: null })), NOW), 0); assert.equal(L.remaining(s('discuss', -50), NOW), 480, 'a clock set back does not add time');
  const sg = ago => L.signals(s('discuss', ago), NOW);
  assert.deepEqual(sg(0), { halfway: false, oneMinute: false, timeUp: false }); assert.deepEqual(sg(239.9), { halfway: false, oneMinute: false, timeUp: false });
  assert.deepEqual(sg(240), { halfway: true, oneMinute: false, timeUp: false }); assert.deepEqual(sg(419.9), { halfway: true, oneMinute: false, timeUp: false });
  assert.deepEqual(sg(420), { halfway: true, oneMinute: true, timeUp: false }); assert.deepEqual(sg(480), { halfway: true, oneMinute: true, timeUp: true });
  assert.deepEqual(L.signals(clean(base({ phase: 'discuss', discussSeconds: 360, phaseStarted: NOW - 180000 })), NOW), { halfway: true, oneMinute: false, timeUp: false });
  assert.deepEqual(L.signals(s('prepare', 10), NOW), { halfway: false, oneMinute: false, timeUp: false }); assert.deepEqual(L.signals(s('summary', 5), NOW), { halfway: true, oneMinute: true, timeUp: true });
  // advance: the next phase starts when the last one ended, not when the page noticed
  let r = L.advance(s('prepare', 60), NOW); assert.equal(r.session.phase, 'prepare'); assert.equal(r.lapsed, false);
  r = L.advance(s('prepare', 100), NOW); assert.equal(r.session.phase, 'discuss'); assert.equal(r.session.phaseStarted, NOW - 10000); assert.equal(r.lapsed, false);
  r = L.advance(s('discuss', 481), NOW); assert.equal(r.session.phase, 'summary'); assert.equal(r.session.phaseStarted, NOW - 1000); assert.equal(r.lapsed, true); assert.equal(r.session.discussEnded, 480);
  r = L.advance(s('prepare', 90 + 480 + 20), NOW); assert.equal(r.session.phase, 'summary'); assert.equal(r.session.phaseStarted, NOW - 20000); assert.equal(r.lapsed, true);
  r = L.advance(s('summary', 5000), NOW); assert.equal(r.session.phase, 'summary', 'the summary never ends by itself'); assert.equal(r.lapsed, false);
  { const live = s('discuss', 10); assert.equal(L.advance(live, NOW).session, live, 'nothing to do: the same session comes back'); }
  // taps are timed from the discussion; a tap in the summary carries on from where the discussion stopped
  assert.equal(L.timeOf(s('discuss', 190.4), NOW), 190); assert.equal(L.timeOf(s('discuss', 5000), NOW), 480); assert.equal(L.timeOf(s('summary', 30, { discussEnded: 300 }), NOW), 330);
});

test('logging: taps, undo and a note on the last tap', () => {
  const s = clean(base());
  assert.equal(L.noteLast(s, 'x'), false, 'nothing to attach a note to');
  assert.deepEqual(L.logMove(s, 0, 'open', 12.4), { t: 12, who: 0, move: 'open', note: '' });
  assert.equal(L.logMove(s, 9, 'open', 5), null); assert.equal(L.logMove(s, 0, 'dance', 5), null); assert.equal(L.logMove(s, 0, 'open', -1), null); assert.equal(L.logMove(s, 0, 'open', NaN), null); assert.equal(s.log.length, 1);
  assert.equal(L.noteLast(s, '  took the 50 kg figure  '), true); assert.equal(s.log[0].note, 'took the 50 kg figure'); L.noteLast(s, 'z'.repeat(250)); assert.equal(s.log[0].note.length, 200); L.noteLast(s, ''); assert.equal(s.log[0].note, '');
  L.logMove(s, 1, 'build', 20); assert.deepEqual(L.undoMove(s), { t: 20, who: 1, move: 'build', note: '' }); assert.equal(s.log.length, 1); L.undoMove(s); assert.equal(L.undoMove(s), null);
  for (let i = 0; i < 400; i++) assert(L.logMove(s, 0, 'open', i)); assert.equal(L.logMove(s, 0, 'open', 1), null, 'the log is capped at 400');
  assert.equal(L.logMove(clean(base({ observer: false })), 0, 'open', 1), null, 'no observer, no taps');
});

/* ---------- Rules: feedback and group notes ---------- */
test('feedbackFor: counts, up to three quoted notes with times, moves not seen, keep and change, and the summary', () => {
  const s = withLog([entry(0, 'open', 20), entry(1, 'build', 190, 'took Asha’s 50 kg figure further'), entry(1, 'evidence', 100, 'quoted the audit'), entry(1, 'evidence', 130, 'second note'), entry(1, 'evidence', 160, 'third note'), entry(1, 'evidence', 170, 'fourth note'), entry(1, 'interrupt', 200)],
    { keep: { 1: 'Quote the numbers' }, change: { 1: 'Let Asha finish' }, summariser: 1 });
  const f = L.feedbackFor(s, 1);
  assert(f.includes('Used evidence: 4') && f.includes('Built on a point: 1') && f.includes('Cut someone off: 1'), f.join('|'));
  assert.deepEqual(f.filter(x => /^\d+:\d\d /.test(x)), ['1:40 Used evidence: “quoted the audit”', '2:10 Used evidence: “second note”', '2:40 Used evidence: “third note”'], 'three notes, in the order logged');
  assert(!f.some(x => /Opened or framed:/.test(x)), 'no count for a move not made');
  const unseen = f.find(x => x.startsWith('Not seen:')); assert(unseen.includes('Opened or framed') && unseen.includes('Brought someone in') && !unseen.includes('Used evidence') && !unseen.includes('Summarised fairly') && !unseen.includes('Cut someone off'), unseen);
  assert.match(unseen, /did not note them, not that you did not do them/);
  assert(f.includes('One thing to keep: Quote the numbers') && f.includes('One thing to change: Let Asha finish') && f.includes('You gave the one-minute summary.'));
  assert.equal(L.feedbackFor(withLog([entry(1, 'build', 190, 'took Asha’s 50 kg figure further')]), 1).includes('3:10 Built on a point: “took Asha’s 50 kg figure further”'), true, 'the example from the brief');
  assert.deepEqual(L.feedbackFor(s, 2), ['Nothing was noted for you. That can mean you did not speak, or that the observer missed it.']);
  assert.deepEqual(L.feedbackFor(withLog([]), 0), ['Nothing was noted for you. That can mean you did not speak, or that the observer missed it.']);
  assert.deepEqual(L.feedbackFor(withLog([], { keep: { 2: 'Keep going' } }), 2), ['Nothing was noted for you. That can mean you did not speak, or that the observer missed it.', 'One thing to keep: Keep going']);
  assert.deepEqual(L.feedbackFor(s, 7), []); assert.deepEqual(L.feedbackFor(s, -1), []); assert.deepEqual(L.feedbackFor(s, 'a'), []);
  assert(!L.feedbackFor(withLog([entry(0, 'steer', 3)], { summariser: 1 }), 0).some(x => /summary/i.test(x) && !x.startsWith('Not seen')), 'the summary line is only for the one who gave it');
  assert(L.feedbackFor(withLog([entry(0, 'steer', 3)], { summariser: 0 }), 0).find(x => x.startsWith('Not seen:')) && !L.feedbackFor(withLog([entry(0, 'steer', 3)], { summariser: 0 }), 0).find(x => x.startsWith('Not seen:')).includes('Summarised'));
  for (const i of [0, 1, 2]) L.feedbackFor(s, i).forEach(x => assert(!GAP.test(x), x));
});

test('groupNotes: each observation states its count, and a thin log says nothing', () => {
  const thin = withLog([entry(0, 'open', 1), entry(0, 'open', 2), entry(0, 'open', 3), entry(0, 'open', 4)]); assert.deepEqual(L.groupNotes(thin), [], 'fewer than 5 entries');
  assert.deepEqual(L.groupNotes(withLog([])), []);
  const talk = withLog([entry(0, 'open', 1), entry(0, 'steer', 2), entry(0, 'repeat', 3), entry(1, 'evidence', 4), entry(2, 'build', 5)]);
  const notes = L.groupNotes(talk);
  assert.deepEqual(notes, ['Nobody was noted summarising (0 of 5 logged moves).', 'Asha has 3 of 5 logged moves, more than half.', 'Nobody was noted bringing someone else in (0 of 5 logged moves).']);
  assert.deepEqual(L.groupNotes(withLog([entry(0, 'open', 1), entry(0, 'steer', 2), entry(1, 'evidence', 4), entry(1, 'build', 5), entry(2, 'invite', 6), entry(2, 'summarise', 7)])), [], 'half is not more than half, and every other thing was noted');
  assert.deepEqual(L.groupNotes(withLog([entry(0, 'interrupt', 1), entry(1, 'interrupt', 2), entry(2, 'invite', 3), entry(2, 'summarise', 4), entry(1, 'open', 5), entry(0, 'steer', 6)])), ['Nobody was noted using evidence from the brief (0 of 6 logged moves).']);
  assert.deepEqual(L.groupNotes(withLog([entry(0, 'interrupt', 1), entry(1, 'interrupt', 2), entry(2, 'interrupt', 3), entry(2, 'invite', 4), entry(2, 'summarise', 5), entry(1, 'evidence', 6)])), ['Cutting someone off was noted 3 times (3 of 6 logged moves).'], 'three or more');
  assert.deepEqual(L.groupNotes(withLog([entry(0, 'interrupt', 1), entry(1, 'interrupt', 2), entry(2, 'invite', 3), entry(2, 'summarise', 4), entry(1, 'evidence', 6), entry(0, 'steer', 7)])), [], 'two interruptions are not several');
});

test('downloads are built from the log and say what they are', () => {
  const s = withLog([entry(0, 'open', 20, 'framed it'), entry(1, 'build', 190, 'took Asha’s figure further'), entry(1, 'evidence', 200), entry(2, 'repeat', 210), entry(2, 'invite', 230)], { finished: NOW });
  const all = L.reportText(s); assert(all.includes('CASE ROOM: GROUP DISCUSSION') && all.includes('Closing the fest funding gap') && all.includes('Observer: Dev') && all.includes('GROUP NOTES') && all.includes('COUNTS BY SPEAKER') && all.includes('FEEDBACK FOR BEN'));
  assert(all.includes(brief('fest').balanced[0]) && all.includes(brief('fest').tensions[0]) && all.includes(brief('fest').traps[0])); assert.match(all, /not a judgement/); assert(!GAP.test(all));
  const one = L.speakerText(s, 1); assert(one.includes('FEEDBACK FOR BEN') && one.includes('3:10 Built on a point: “took Asha’s figure further”') && !one.includes('Asha: ')); assert.equal(L.speakerText(s, 9), '');
  const none = L.reportText(clean(base({ observer: false, observerName: '', finished: NOW }))); assert(none.includes('No observer: nothing was noted.') && !none.includes('COUNTS BY SPEAKER') && none.includes('COMMON TRAPS'));
});

/* ---------- Screens ---------- */
const T0 = 1_700_000_000_000;
const doc = f => f.w.document, q = (f, s) => doc(f).querySelector(s), qa = (f, s) => [...doc(f).querySelectorAll(s)];
const at = (f, ms) => f.run(`Date.now = () => ${ms}`);
const text = f => q(f, '#app').textContent;
const state = f => JSON.parse(f.run('JSON.stringify(GDTool.state())'));
const ev = (f, t) => new f.w.Event(t, { bubbles: true });
const input = (f, el, v) => { el.value = v; el.dispatchEvent(ev(f, 'input')); };
const choose = (f, el, v) => { el.value = String(v); el.dispatchEvent(ev(f, 'change')); };
const tick = f => f.run('GDTool.tick()');
const storageOf = f => { const s = {}; for (const k of Object.keys(f.w.localStorage)) s[k] = f.w.localStorage.getItem(k); return s; };
const noGaps = (f, label) => { assert.doesNotMatch(text(f), GAP, `${label}: text`); assert.deepEqual(f.errors, [], `${label}: no script errors`); };
const noLeak = (f, b, label) => { const t = text(f); for (const h of hidden(b)) assert(!t.includes(h) && !t.includes(h.slice(0, 50)), `${label}: shows hidden text “${h.slice(0, 40)}”`); };
const onePrimary = (f, label) => qa(f, '.flow-bar').forEach(bar => assert.equal(bar.querySelectorAll('.primary').length, 1, `${label}: one primary button in the flow bar`));
function startRun(f, { id = 'fest', names = names4, observer = true, observerAt = names.length - 1, length = null } = {}) {
  f.run('GDTool.open()'); q(f, `[data-gd-pick="${id}"]`).click();
  while (qa(f, '[data-gd-name]').length < names.length) f.$('gdAddName').click();
  while (qa(f, '[data-gd-name]').length > names.length) q(f, `[data-gd-remove="${qa(f, '[data-gd-name]').length - 1}"]`).click();
  names.forEach((n, i) => input(f, f.$('gdName' + i), n));
  if (f.$('gdObs').checked !== observer) f.$('gdObs').click();
  if (observer) choose(f, f.$('gdObsWho'), observerAt);
  if (length) choose(f, f.$('gdLen'), length);
  f.$('gdStart').click();
}
const tap = (f, who, move) => q(f, `#gdGrid [data-who="${who}"][data-move="${move}"]`).click();

test('home: the briefs, set-up rows, and set-up checks with hints instead of silent failures', () => {
  const f = fixture(); try {
    at(f, T0); f.run('GDTool.open()');
    assert.equal(f.run('view'), 'gd'); assert.equal(f.w.location.hash, '#gd'); assert.equal(q(f, '.eyebrow').textContent, 'GROUP DISCUSSION'); assert.equal(q(f, 'h1').textContent, 'Run a group discussion');
    assert.match(q(f, '.lead').textContent, /Three to six of you, one phone or laptop as the clock, about 12 minutes\..*observer.*no AI.*It does not listen/s);
    assert.equal(qa(f, '.gd-briefs li').length, 6); assert.deepEqual(qa(f, '.gd-briefs li b').map(b => b.textContent), BRIEFS.map(b => b.title));
    assert.match(q(f, '.gd-briefs li:nth-child(5)').textContent, /Opinion/); assert.match(q(f, '.gd-briefs li:nth-child(1)').textContent, /Decision/);
    assert.equal(qa(f, '[data-gd-pick]').length, 6); assert.equal(qa(f, '[data-gd-sheet]').length, 6); assert(qa(f, '[data-gd-pick]').every(b => b.textContent === 'Run this')); assert(qa(f, '[data-gd-sheet]').every(b => b.textContent === 'Print the kit'));
    assert.equal(f.$('gdSetup').innerHTML, '', 'no set-up until a brief is chosen'); assert.equal(f.$('gdAlone').textContent, 'See the moves observers note'); assert.equal(q(f, '.gd-past'), null);
    q(f, '[data-gd-pick="library"]').click();
    assert.match(q(f, '.gd-setup h2').textContent, /Set up: A library open till midnight/); assert.equal(qa(f, '[data-gd-name]').length, 3); assert.equal(qa(f, '[data-gd-remove]').length, 0, 'three is the least');
    assert.equal(f.$('gdObsPick').hidden, true); assert.equal(f.$('gdObs').type, 'checkbox'); assert.match(q(f, 'label.gd-check').textContent, /One of us is observing/);
    assert.deepEqual([...f.$('gdLen').options].map(o => o.textContent), ['6 minutes', '8 minutes', '10 minutes', '12 minutes']); assert.equal(f.$('gdLen').value, '480');
    assert.equal(f.$('gdStart').textContent, 'Start: show the brief →'); assert(f.$('gdStart').classList.contains('primary')); onePrimary(f, 'home');
    // fewer than three names
    input(f, f.$('gdName0'), 'Asha'); input(f, f.$('gdName1'), 'Ben'); f.$('gdStart').click();
    assert.match(f.$('flowHint').textContent, /at least 3/); assert.equal(state(f).run, null); assert.equal(f.w.localStorage.getItem('cr-gd-run'), null);
    // duplicates, ignoring case
    input(f, f.$('gdName2'), 'ASHA'); f.$('gdStart').click(); assert.match(f.$('flowHint').textContent, /same: ASHA/); assert.equal(state(f).run, null);
    // an observer needs a fourth person
    input(f, f.$('gdName2'), 'Chitra'); f.$('gdObs').click(); assert.equal(f.$('gdObsPick').hidden, false); assert.deepEqual([...f.$('gdObsWho').options].map(o => o.textContent), ['Asha', 'Ben', 'Chitra']);
    choose(f, f.$('gdObsWho'), 2); f.$('gdStart').click(); assert.match(f.$('flowHint').textContent, /at least 4 names/); assert.equal(state(f).run, null);
    // rows: add up to six, remove down to three
    for (let i = 0; i < 3; i++) f.$('gdAddName').click(); assert.equal(qa(f, '[data-gd-name]').length, 6); assert.equal(f.$('gdAddName'), null, 'six is the most'); assert.equal(f.$('gdName0').value, 'Asha');
    q(f, '[data-gd-remove="0"]').click(); assert.equal(qa(f, '[data-gd-name]').length, 5); assert.equal(f.$('gdName0').value, 'Ben'); assert.equal(f.$('gdObsWho').value, '1', 'the observer stays the same person when a name above is removed');
    q(f, '[data-gd-remove="4"]').click(); q(f, '[data-gd-remove="3"]').click(); assert.equal(qa(f, '[data-gd-name]').length, 3); assert.equal(qa(f, '[data-gd-remove]').length, 0);
    noGaps(f, 'home');
  } finally { f.dom.window.close(); }
});

test('a full run with an observer: read, discuss with taps and signals, sum up, debrief, downloads', () => {
  const f = fixture(); try {
    const b = brief('fest'); at(f, T0); startRun(f);
    const run = () => state(f).run;
    // Prepare
    assert.equal(run().phase, 'prepare'); assert.deepEqual(run().names, ['Asha', 'Ben', 'Chitra']); assert.equal(run().observerName, 'Dev'); assert.equal(run().observer, true); assert.equal(run().discussSeconds, 480);
    assert.equal(state(f).screen, 'prepare'); assert.equal(f.w.location.hash, '#gd'); assert(f.w.localStorage.getItem('cr-gd-run'));
    assert(text(f).includes(b.brief) && text(f).includes(b.task)); assert.equal(qa(f, '.gd-cards .gd-card').length, 6); b.evidence.forEach(e => assert(text(f).includes(e.text)));
    assert.equal(f.$('gdTime').textContent, '1:30'); assert.match(text(f), /Dev is observing/); assert.match(text(f), /does not hear the discussion/); assert.equal(f.$('gdBegin').textContent, 'Start the discussion →');
    noLeak(f, b, 'prepare'); onePrimary(f, 'prepare'); noGaps(f, 'prepare');
    at(f, T0 + 30_000); tick(f); assert.equal(f.$('gdTime').textContent, '1:00'); assert.equal(run().phase, 'prepare');
    // The clock starts the discussion at zero, and the discussion's own clock starts then
    at(f, T0 + 90_000); tick(f);
    const T1 = T0 + 90_000;
    assert.equal(run().phase, 'discuss'); assert.equal(run().phaseStarted, T1); assert.equal(state(f).screen, 'discuss'); assert.equal(f.$('gdTime').textContent, '8:00');
    assert.match(text(f), new RegExp(b.task.slice(0, 40))); assert.equal(qa(f, '.gd-evidence details.gd-card').length, 6, 'collapsible evidence cards'); assert(qa(f, '.gd-evidence details').every(d => !d.open));
    assert.equal(qa(f, '.gd-speaker').length, 3, 'one row per speaker, the observer is not one'); assert(!qa(f, '.gd-speaker h4').some(h => h.textContent === 'Dev'));
    const row = q(f, '.gd-speaker'); assert.deepEqual([...row.querySelectorAll('.gd-moves:not(.gd-watch) .gd-move')].map(x => x.dataset.move), ['open', 'evidence', 'build', 'invite', 'disagree', 'steer', 'summarise']); assert.deepEqual([...row.querySelectorAll('.gd-watch .gd-move')].map(x => x.dataset.move), ['interrupt', 'repeat']);
    assert.equal(f.$('gdSignal').getAttribute('role'), 'status'); assert.match(f.$('gdSignal').textContent, /You will be told at halfway/); assert.equal(f.$('gdUndo').disabled, true); assert.equal(f.$('gdNote').disabled, true); assert.match(f.$('gdLast').textContent, /No taps yet/);
    assert.equal(f.$('gdEnd').textContent, 'End discussion, go to the summary →'); onePrimary(f, 'discuss'); noLeak(f, b, 'discuss'); noGaps(f, 'discuss');
    // Taps are logged at the time they are made
    at(f, T1 + 60_000); tap(f, 0, 'open');
    at(f, T1 + 120_000); tap(f, 0, 'evidence'); input(f, f.$('gdNote'), 'quoted the ₹4,500 a night');
    at(f, T1 + 190_000); tap(f, 1, 'build'); assert.equal(f.$('gdNote').value, '', 'a new tap starts with an empty note'); input(f, f.$('gdNote'), 'took Asha’s 50 kg figure further');
    assert.match(f.$('gdLast').textContent, /Ben · Built on a point at 3:10/);
    at(f, T1 + 200_000); tap(f, 2, 'interrupt'); assert.equal(run().log.length, 4); f.$('gdUndo').click();
    assert.deepEqual(run().log.map(e => [e.t, e.who, e.move, e.note]), [[60, 0, 'open', ''], [120, 0, 'evidence', 'quoted the ₹4,500 a night'], [190, 1, 'build', 'took Asha’s 50 kg figure further']], 'undo removes only the last tap');
    assert.equal(f.$('gdNote').value, 'took Asha’s 50 kg figure further', 'the note shown is the new last tap’s'); assert.match(f.$('gdLast').textContent, /Ben · Built on a point/);
    at(f, T1 + 205_000); tap(f, 0, 'repeat'); at(f, T1 + 230_000); tap(f, 1, 'disagree');
    assert.equal(q(f, '[data-who="0"][data-move="open"] .gd-n').textContent, '1'); assert.equal(document_activeId(f), 'disagree', 'focus stays on the button just tapped');
    assert.deepEqual(JSON.parse(f.w.localStorage.getItem('cr-gd-run')).log.map(e => e.move), ['open', 'evidence', 'build', 'repeat', 'disagree'], 'saved on every tap');
    // Signals
    at(f, T1 + 239_000); tick(f); assert.match(f.$('gdSignal').textContent, /You will be told/); at(f, T1 + 240_000); tick(f); assert.equal(f.$('gdSignal').textContent, 'Halfway.'); assert.equal(f.$('gdTime').textContent, '4:00');
    at(f, T1 + 420_000); tick(f); assert.equal(f.$('gdSignal').textContent, 'One minute left. Someone should start pulling it together.'); assert.equal(f.$('gdTime').textContent, '1:00'); noLeak(f, b, 'discuss late');
    // Time up moves on to the summary by itself
    at(f, T1 + 480_000); tick(f);
    assert.equal(run().phase, 'summary'); assert.equal(state(f).screen, 'summary'); assert.equal(run().discussEnded, 480); assert.equal(run().phaseStarted, T1 + 480_000); assert.match(f.$('gdLapsed').textContent, /Time is up/); assert.equal(f.$('gdTime').textContent, '1:00');
    assert.equal(f.$('gdSuggest').textContent, 'Chitra has said least so far: ask them to sum up.'); assert.equal(f.$('gdSummariser').value, '2'); assert.equal(run().summariser, 2);
    assert(text(f).includes(b.closing)); assert.equal(f.$('gdFinish').textContent, 'Finish: see the debrief →'); onePrimary(f, 'summary'); noLeak(f, b, 'summary'); noGaps(f, 'summary');
    at(f, T1 + 510_000); tick(f); assert.equal(f.$('gdTime').textContent, '0:30');
    at(f, T1 + 520_000); assert.equal(f.$('gdSummarised').textContent, 'They summarised fairly'); f.$('gdSummarised').click();
    assert.deepEqual(run().log[5], { t: 520, who: 2, move: 'summarise', note: '' }, 'timed on from where the discussion stopped'); assert.equal(f.$('gdSummarised').disabled, true);
    // Debrief
    at(f, T1 + 530_000); f.$('gdFinish').click();
    assert.equal(state(f).screen, 'debrief'); assert.equal(run().phase, 'debrief'); assert.equal(run().finished, T1 + 530_000); assert.equal(state(f).past.length, 1); assert.equal(state(f).past[0].id, run().id);
    assert.equal(q(f, 'h1').textContent, 'Closing the fest funding gap'); assert.match(f.$('gdHonest').textContent, /counts of what the observer tapped, not a judgement.*can miss things.*does not hear the discussion/);
    assert.deepEqual(qa(f, '#gdGroup li').map(li => li.textContent), ['Nobody was noted bringing someone else in (0 of 6 logged moves).']);
    const wrap = q(f, '.gd-table-wrap'); assert(wrap && wrap.querySelector('table.gd-table')); assert.equal(qa(f, '.gd-table tbody tr').length, 3); assert.deepEqual(qa(f, '.gd-table thead th').map(th => th.textContent), ['Speaker', ...MOVES.map(m => m.label), 'Good', 'Watch']);
    const cells = name => [...qa(f, '.gd-table tbody tr').find(tr => tr.querySelector('th').textContent === name).querySelectorAll('td')].map(td => td.textContent).join(',');
    assert.equal(cells('Asha'), '1,1,0,0,0,0,0,0,1,2,1'); assert.equal(cells('Ben'), '0,0,1,0,1,0,0,0,0,2,0'); assert.equal(cells('Chitra'), '0,0,0,0,0,0,1,0,0,1,0');
    const ben = qa(f, '.gd-person').find(c => c.querySelector('h3').textContent === 'Ben').textContent;
    assert(ben.includes('3:10 Built on a point: “took Asha’s 50 kg figure further”') && ben.includes('Built on a point: 1') && ben.includes('Disagreed with a reason: 1') && ben.includes('Not seen:'));
    const chitra = qa(f, '.gd-person').find(c => c.querySelector('h3').textContent === 'Chitra').textContent; assert(chitra.includes('You gave the one-minute summary.') && chitra.includes('Summarised fairly: 1'));
    assert.equal(qa(f, '[data-gd-keep]').length, 3); assert.equal(qa(f, '[data-gd-change]').length, 3); assert.equal(q(f, 'label[for=gdKeep0]').textContent, 'One thing to keep'); assert.equal(q(f, 'label[for=gdChange0]').textContent, 'One thing to change');
    // Keep and change are saved as typed, in the run and in the past list
    input(f, f.$('gdKeep0'), 'Quote the n'); assert.equal(JSON.parse(f.w.localStorage.getItem('cr-gd-past'))[0].keep[0], 'Quote the n', 'saved as typed'); input(f, f.$('gdKeep0'), 'Quote the numbers'); input(f, f.$('gdChange1'), 'Let Asha finish');
    assert.equal(run().keep[0], 'Quote the numbers'); assert.equal(state(f).past[0].change[1], 'Let Asha finish'); input(f, f.$('gdKeep0'), '  '); assert.deepEqual(run().keep, {}, 'blank text is removed'); input(f, f.$('gdKeep0'), 'Quote the numbers');
    // What was hidden is now shown
    for (const [id, list] of [['gdBalanced', b.balanced], ['gdTensions', b.tensions], ['gdTraps', b.traps]]) { assert.equal(qa(f, `#${id} li`).length, list.length); list.forEach(x => assert(f.$(id).textContent.includes(x))); }
    assert.deepEqual(qa(f, '.gd-reveal h2').map(h => h.textContent), ['What a balanced conclusion weighs', 'Where the evidence pulls apart', 'Common traps']);
    onePrimary(f, 'debrief'); noGaps(f, 'debrief');
    // Downloads
    f.run('download = (text, name) => { (window.__dl = window.__dl || []).push({ text, name }); }');
    f.$('gdDownload').click(); const all = f.run('window.__dl[0]'); assert.match(all.name, /^case-room-gd-fest-\d{4}-\d\d-\d\d\.txt$/); assert(all.text.includes('GROUP NOTES') && all.text.includes('COUNTS BY SPEAKER') && all.text.includes('FEEDBACK FOR BEN') && all.text.includes('One thing to keep: Quote the numbers') && all.text.includes(b.balanced[0]));
    q(f, '[data-gd-person="1"]').click(); const one = f.run('window.__dl[1]'); assert.equal(one.name, 'case-room-gd-Ben-feedback.txt'); assert(one.text.includes('FEEDBACK FOR BEN') && one.text.includes('One thing to change: Let Asha finish') && !one.text.includes('FEEDBACK FOR ASHA'));
    assert.equal(qa(f, '[data-gd-person]').length, 3);
    // Run another: back to set-up with the same people, the discussion kept in the past list
    f.$('gdAgain').click(); assert.equal(state(f).screen, 'home'); assert.equal(state(f).run, null); assert.equal(f.w.localStorage.getItem('cr-gd-run'), 'null'); assert.equal(state(f).past.length, 1);
    assert.deepEqual(qa(f, '[data-gd-name]').map(i => i.value), ['Asha', 'Ben', 'Chitra', 'Dev']); assert.equal(f.$('gdObs').checked, true); assert.equal(f.$('gdObsWho').value, '3'); assert.match(q(f, '.gd-setup h2').textContent, /Closing the fest funding gap/); assert.match(q(f, '.gd-past').textContent, /Closing the fest funding gap.*Asha, Ben, Chitra/s);
    noGaps(f, 'home again');
  } finally { f.dom.window.close(); }
});
const document_activeId = f => (f.w.document.activeElement && f.w.document.activeElement.dataset.move) || '';

test('a run without an observer: timer and brief only, a select for the summary, and an honest debrief', () => {
  const f = fixture(); try {
    const b = brief('wfh'); at(f, T0); startRun(f, { id: 'wfh', names: ['Asha', 'Ben', 'Chitra'], observer: false, length: 360 });
    assert.equal(state(f).run.observer, false); assert.equal(state(f).run.observerName, ''); assert.equal(state(f).run.discussSeconds, 360); assert.match(text(f), /No one is observing, so nothing will be noted/);
    f.$('gdBegin').click(); const T1 = T0;
    assert.equal(state(f).screen, 'discuss'); assert.equal(f.$('gdTime').textContent, '6:00'); assert.equal(f.$('gdGrid'), null); assert.equal(q(f, '.gd-tap'), null); assert.match(q(f, '.gd-silent').textContent, /Nothing is being noted/);
    assert(text(f).includes(b.task)); assert.equal(qa(f, '.gd-evidence details').length, 6); onePrimary(f, 'discuss, no observer'); noGaps(f, 'discuss, no observer'); noLeak(f, b, 'discuss, no observer');
    at(f, T1 + 180_000); tick(f); assert.equal(f.$('gdSignal').textContent, 'Halfway.'); at(f, T1 + 300_000); tick(f); assert.match(f.$('gdSignal').textContent, /One minute left/);
    // Ending early goes to the summary at once
    at(f, T1 + 100_000 + 0); f.run('Date.now = () => ' + (T1 + 200_000)); f.$('gdEnd').click();
    assert.equal(state(f).screen, 'summary'); assert.equal(state(f).run.discussEnded, 200); assert.equal(f.$('gdSuggest'), null, 'no taps, so no suggestion'); assert.equal(f.$('gdSummarised'), null); assert.equal(f.$('gdSummariser').value, ''); assert.equal(state(f).run.summariser, null);
    assert.equal(f.$('gdTime').textContent, '1:00'); assert.equal(f.$('gdLapsed').textContent, ''); choose(f, f.$('gdSummariser'), 1); assert.equal(state(f).run.summariser, 1); assert.equal(f.$('gdSummarised'), null, 'nothing is logged without an observer');
    onePrimary(f, 'summary, no observer'); noGaps(f, 'summary, no observer');
    f.$('gdFinish').click();
    assert.equal(state(f).screen, 'debrief'); assert.match(f.$('gdHonest').textContent, /No one was observing, so nothing was counted/); assert.equal(q(f, '.gd-table'), null); assert.equal(f.$('gdGroup'), null); assert.equal(qa(f, '.gd-person').length, 3); assert.match(qa(f, '.gd-person')[0].textContent, /No one was observing/);
    assert.equal(qa(f, '[data-gd-person]').length, 0); assert.equal(f.$('gdBalanced') !== null, true); assert(f.$('gdTraps').textContent.includes(b.traps[0]));
    input(f, f.$('gdChange2'), 'Wait for others'); assert.equal(state(f).past[0].change[2], 'Wait for others'); noGaps(f, 'debrief, no observer');
    f.run('download = (text, name) => { window.__dl = { text, name }; }'); f.$('gdDownload').click(); assert(f.run('window.__dl.text').includes('No observer: nothing was noted.')); assert(!f.run('window.__dl.text').includes('COUNTS BY SPEAKER'));
  } finally { f.dom.window.close(); }
});

test('an observer who tapped nothing gets an honest empty debrief and a quiet summary', () => {
  const f = fixture(); try {
    at(f, T0); startRun(f, { id: 'attendance', names: ['Asha', 'Ben', 'Chitra', 'Dev', 'Esha'], observerAt: 4 }); at(f, T0 + 90_000); tick(f); at(f, T0 + 90_000 + 480_000); tick(f);
    assert.equal(state(f).screen, 'summary'); assert.equal(f.$('gdSuggest'), null, 'nothing logged, nothing suggested'); assert(f.$('gdSummariser')); assert.equal(f.$('gdSummarised'), null, 'no one chosen yet');
    choose(f, f.$('gdSummariser'), 0); assert(f.$('gdSummarised')); f.$('gdFinish').click();
    assert.match(f.$('gdGroup').textContent, /too few to say anything about the group/); assert.match(qa(f, '.gd-person')[1].textContent, /Nothing was noted for you\. That can mean you did not speak, or that the observer missed it\./);
    assert.equal(qa(f, '.gd-table tbody tr').length, 4); noGaps(f, 'empty debrief');
  } finally { f.dom.window.close(); }
});

/* ---------- Reload ---------- */
const real = Date.now();
const stored = (over = {}) => JSON.stringify({ ...L.newSession({ briefId: 'library', names: ['Asha', 'Ben', 'Chitra'], observer: true, observerName: 'Dev', discussSeconds: 480, now: Date.now() - 1000 }), ...over });
const secs = t => { const [m, s] = t.split(':').map(Number); return m * 60 + s; };

test('a reload resumes in the same phase with the clock still honest', () => {
  const log = [{ t: 20, who: 0, move: 'open', note: 'framed it' }, { t: 60, who: 1, move: 'build', note: '' }];
  const at = (phase, agoS, over = {}) => ({ phase, phaseStarted: Date.now() - agoS * 1000, ...over });
  const open = (run, hash = '#gd') => fixture({ url: 'https://case.example/' + hash, storage: { 'cr-gd-run': stored(run) } });
  // prepare
  let f = open(at('prepare', 30)); try { assert.equal(f.run('view'), 'gd'); assert.equal(state(f).screen, 'prepare'); const s = secs(f.$('gdTime').textContent); assert(s >= 50 && s <= 60, f.$('gdTime').textContent); assert.deepEqual(f.errors, []); } finally { f.dom.window.close(); }
  // discuss, with taps already made and a note shown
  f = open(at('discuss', 100, { log })); try {
    assert.equal(state(f).screen, 'discuss'); const s = secs(f.$('gdTime').textContent); assert(s >= 370 && s <= 380, f.$('gdTime').textContent); assert.equal(q(f, '[data-who="0"][data-move="open"] .gd-n').textContent, '1'); assert.match(f.$('gdLast').textContent, /Ben · Built on a point at 1:00/); assert.equal(f.$('gdUndo').disabled, false);
    assert.equal(state(f).run.log.length, 2); noGaps(f, 'resumed discussion'); onePrimary(f, 'resumed discussion');
  } finally { f.dom.window.close(); }
  // discuss, past the halfway and one-minute marks: the status line already says so
  f = open(at('discuss', 430)); try { assert.match(f.$('gdSignal').textContent, /One minute left/); } finally { f.dom.window.close(); }
  f = open(at('discuss', 250)); try { assert.equal(f.$('gdSignal').textContent, 'Halfway.'); } finally { f.dom.window.close(); }
  // discussion time ran out while the page was closed
  f = open(at('discuss', 480 + 20, { log })); try {
    assert.equal(state(f).screen, 'summary'); assert.equal(state(f).run.phase, 'summary'); assert.match(f.$('gdLapsed').textContent, /ran out while this page was closed/); const s = secs(f.$('gdTime').textContent); assert(s >= 30 && s <= 40, f.$('gdTime').textContent);
    assert.equal(f.$('gdSuggest').textContent, 'Chitra has said least so far: ask them to sum up.'); noGaps(f, 'lapsed');
  } finally { f.dom.window.close(); }
  // the whole read and the whole discussion were missed
  f = open(at('prepare', 90 + 480 + 10)); try { assert.equal(state(f).screen, 'summary'); assert.match(f.$('gdLapsed').textContent, /ran out while this page was closed/); const s = secs(f.$('gdTime').textContent); assert(s >= 40 && s <= 50); } finally { f.dom.window.close(); }
  // the prepare time ran out but not the discussion: it simply starts, on time
  f = open(at('prepare', 100)); try { assert.equal(state(f).screen, 'discuss'); const s = secs(f.$('gdTime').textContent); assert(s >= 460 && s <= 470, f.$('gdTime').textContent); assert.equal(f.$('gdLapsed'), null); } finally { f.dom.window.close(); }
  // summary
  f = open(at('summary', 20, { discussEnded: 300, log, summariser: 2 })); try {
    assert.equal(state(f).screen, 'summary'); const s = secs(f.$('gdTime').textContent); assert(s >= 30 && s <= 40); assert.equal(f.$('gdSummariser').value, '2'); assert.equal(f.$('gdLapsed').textContent, '', 'no note when nothing ran out'); noGaps(f, 'resumed summary');
    f.$('gdSummarised').click(); assert.equal(state(f).run.log[2].move, 'summarise'); assert(state(f).run.log[2].t >= 319 && state(f).run.log[2].t <= 332, 'carries on from where the discussion stopped');
  } finally { f.dom.window.close(); }
  f = open(at('summary', 5000, { discussEnded: 300 })); try { assert.equal(state(f).screen, 'summary'); assert.equal(f.$('gdTime').textContent, '0:00'); assert.equal(state(f).run.phase, 'summary', 'the summary waits'); } finally { f.dom.window.close(); }
  // debrief
  f = open({ phase: 'debrief', phaseStarted: null, finished: Date.now(), log, keep: { 0: 'Keep it up' } }); try { assert.equal(state(f).screen, 'debrief'); assert.equal(f.$('gdKeep0').value, 'Keep it up'); assert(f.$('gdBalanced')); assert.equal(f.w.location.hash, '#gd'); noGaps(f, 'resumed debrief'); } finally { f.dom.window.close(); }
  // without the hash, the home page offers it
  f = fixture({ storage: { 'cr-gd-run': stored(at('discuss', 100, { log })) } }); try {
    assert.equal(f.run('view'), 'home'); f.run('GDTool.open()'); assert.match(q(f, '.gd-resume').textContent, /Unfinished discussion: A library open till midnight.*Discussing.*Asha, Ben, Chitra.*with an observer/s);
    f.$('gdResume').click(); assert.equal(state(f).screen, 'discuss'); f.$('gdQuit').click(); assert.equal(state(f).run, null); assert.equal(f.w.localStorage.getItem('cr-gd-run'), 'null'); assert.equal(state(f).screen, 'home');
  } finally { f.dom.window.close(); }
  f = fixture({ storage: { 'cr-gd-run': stored(at('summary', 10, { discussEnded: 480 })) } }); try { f.run('GDTool.open()'); f.$('gdDiscard').click(); assert.equal(state(f).run, null); assert.equal(q(f, '.gd-resume'), null); } finally { f.dom.window.close(); }
  // starting a new run over an unfinished one asks first
  f = fixture({ storage: { 'cr-gd-run': stored(at('discuss', 100, { log })) } }); try {
    f.run('GDTool.open()'); q(f, '[data-gd-pick="mess"]').click(); ['Asha', 'Ben', 'Chitra'].forEach((n, i) => input(f, f.$('gdName' + i), n)); f.w.confirm = () => false; f.$('gdStart').click();
    assert.equal(state(f).run.briefId, 'library', 'kept when you say no'); f.w.confirm = () => true; f.$('gdStart').click(); assert.equal(state(f).run.briefId, 'mess'); assert.equal(state(f).run.observer, false);
  } finally { f.dom.window.close(); }
});

test('the page leaves the clock alone when you leave: time still counts from phaseStarted', () => {
  const f = fixture(); try {
    at(f, T0); startRun(f); at(f, T0 + 90_000); tick(f); const started = state(f).run.phaseStarted;
    f.$('homeNav').click(); assert.equal(f.run('view'), 'home'); assert.equal(f.w.location.hash, ''); assert.equal(state(f).run.phaseStarted, started);
    at(f, started + 600_000); assert.equal(state(f).run.phase, 'summary', 'state() catches the clock up'); f.$('homeNav').click();
    assert.match(q(f, '[data-continue=gd]').textContent, /At the summary/); q(f, '[data-continue=gd]').click(); assert.equal(state(f).screen, 'summary'); assert.match(f.$('gdLapsed').textContent, /ran out while this page was closed/);
    noGaps(f, 'returned');
  } finally { f.dom.window.close(); }
});

/* ---------- Printable kit ---------- */
test('the printable kit: page 1 for everyone has no answers, page 2 is the observer’s grid, page 3 is for afterwards', () => {
  const f = fixture(); try {
    for (const b of BRIEFS) {
      f.run(`GDTool.sheet(${JSON.stringify(b.id)})`);
      assert.equal(f.run('view'), 'gd'); assert.equal(f.w.location.hash, '#gd-sheet/' + b.id); assert.equal(f.$('gdSheetBrief').value, b.id);
      const p1 = f.$('gdPage1').textContent, p2 = f.$('gdPage2').textContent, p3 = f.$('gdPage3').textContent;
      assert(p1.includes(b.brief) && p1.includes(b.task) && b.evidence.every(e => p1.includes(e.title) && p1.includes(e.text)), `${b.id} page 1 has the brief, task and evidence`);
      for (const h of hidden(b)) { assert(!p1.includes(h) && !p1.includes(h.slice(0, 50)), `${b.id}: page 1 shows “${h.slice(0, 40)}”`); assert(!p2.includes(h), `${b.id}: page 2`); assert(p3.includes(h), `${b.id}: page 3 has it`); }
      assert(p1.includes('90 seconds') && p1.includes('6, 8, 10, 12 minutes') && p1.includes('60 seconds'), 'timings on page 1');
      assert.equal(qa(f, '.gd-page').length, 3); noGaps(f, 'sheet ' + b.id);
    }
    f.run("GDTool.sheet('fest')"); const t = q(f, '#gdPage2 table.gd-sheet-table');
    assert.equal(t.querySelectorAll('thead th').length, 1 + MOVES.length, 'a name column and a column per move'); assert.deepEqual([...t.querySelectorAll('thead th')].slice(1).map(th => th.textContent), MOVES.map(m => m.label)); assert.equal(t.querySelectorAll('tbody tr').length, 6, 'blank name lines for six');
    assert(t.querySelector('tbody tr').querySelectorAll('td').length === MOVES.length && [...t.querySelectorAll('td')].every(td => td.textContent === ''), 'empty tick space');
    const p2 = f.$('gdPage2').textContent; for (const m of MOVES) assert(p2.includes(m.hint), m.id);
    assert(/6 minutes: say “Halfway\.” at 3:00.*at 5:00.*call time at 6:00/.test(p2) && /8 minutes: say “Halfway\.” at 4:00.*at 7:00.*call time at 8:00/.test(p2) && /12 minutes.*at 6:00.*at 11:00.*12:00/.test(p2), 'signals to call out'); assert.equal(qa(f, '#gdPage2 .peer-lines').length, 6 + 12, 'name lines and keep/change lines per speaker');
    assert.equal(qa(f, '.gd-sheet-actions .primary').length, 1); assert.equal(f.$('gdSheetPrint').textContent, 'Print / save PDF');
    let printed = 0; f.w.print = () => { printed++; }; f.$('gdSheetPrint').click(); assert.equal(printed, 1);
    choose(f, f.$('gdSheetBrief'), 'wfh'); assert.equal(f.w.location.hash, '#gd-sheet/wfh'); assert(f.$('gdPage1').textContent.includes(brief('wfh').brief));
    f.$('gdSheetBack').click(); assert.equal(state(f).screen, 'home'); assert.equal(f.w.location.hash, '#gd');
    f.run("GDTool.sheet('nope')"); assert.equal(state(f).screen, 'home', 'an unknown brief opens the home page');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('printing leaves the kit and the page order alone: print rules and page breaks are in the stylesheet', () => {
  const fs = require('node:fs'), path = require('node:path'), css = fs.readFileSync(path.join(__dirname, '../assets/gd.css'), 'utf8');
  assert.match(css, /@media print\{[^}]*\.gd-sheet-actions\{display:none\}/); assert.match(css, /\.gd-page\{break-after:page/);
  assert.match(css, /min-height:4[48]px/, 'buttons are at least 44px tall'); assert.match(css, /\.gd-table-wrap\{overflow-x:auto/, 'the table scrolls sideways inside its own wrapper');
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8'); const order = ['src/defence.js', 'content/gd.js', 'src/gd-logic.js', 'src/gd.js', 'content/warmup.js', 'src/home.js', 'src/boot.js'].map(s => html.indexOf(`<script src="${s}"></script>`));
  assert(order.every(i => i > 0) && order.every((x, i) => !i || x > order[i - 1]), 'scripts load in order, after defence.js'); assert(html.includes('<link rel="stylesheet" href="assets/gd.css">'));
});

/* ---------- Routes, links ---------- */
test('routes, the home tile and the planner open the tool', () => {
  let f = fixture({ url: 'https://case.example/#gd' }); try { assert.equal(f.run('view'), 'gd'); assert.equal(state(f).screen, 'home'); assert(f.$('gdAlone')); assert.deepEqual(f.errors, []); } finally { f.dom.window.close(); }
  f = fixture({ url: 'https://case.example/#gd-sheet/layoff' }); try { assert.equal(state(f).screen, 'sheet'); assert.equal(f.$('gdSheetBrief').value, 'layoff'); assert.equal(f.w.location.hash, '#gd-sheet/layoff'); } finally { f.dom.window.close(); }
  f = fixture({ url: 'https://case.example/#gd-sheet/%E0%A4%A' }); try { assert.equal(state(f).screen, 'home'); assert.deepEqual(f.errors, []); } finally { f.dom.window.close(); }
  f = fixture({ url: 'https://case.example/#gd-sheet/nope' }); try { assert.equal(state(f).screen, 'home'); } finally { f.dom.window.close(); }
  f = fixture(); try {
    f.$('round-gd').click(); assert.equal(f.run('view'), 'gd'); assert.equal(f.w.location.hash, '#gd'); assert(q(f, '.gd-briefs'));
    f.$('homeNav').click(); assert.equal(f.w.location.hash, ''); assert.equal(f.run('view'), 'home');
    f.run("NextRoundTool.go('gd-kit')"); assert.equal(f.run('view'), 'gd');
    f.$('gdAlone').click(); assert.equal(f.run('view'), 'next-round'); assert(q(f, '[name=nrRound][value=gd]').checked);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

/* ---------- Past discussions ---------- */
const pastEntry = (id, over = {}) => ({ ...L.newSession({ briefId: 'library', names: ['Asha', 'Ben', 'Chitra'], observer: true, observerName: 'Dev', now: real - 5000, id }), phase: 'debrief', phaseStarted: null, discussEnded: 480, finished: real - 1000 * (Number(id.replace(/\D/g, '')) || 1), log: [{ t: 30, who: 0, move: 'open', note: 'framed' }], ...over });

test('past discussions: viewed, edited, deleted, capped at ten, and saved after a run', () => {
  const f = fixture({ storage: { 'cr-gd-past': JSON.stringify([pastEntry('p1'), pastEntry('p2', { briefId: 'wfh', observer: false, log: [] }), pastEntry('p3', { briefId: 'layoff' })]) } }); try {
    f.run('GDTool.open()'); assert.equal(qa(f, '.gd-past-list li').length, 3); assert.match(qa(f, '.gd-past-list li')[1].textContent, /Should freshers work from home.*no observer/s);
    q(f, '[data-gd-view="p1"]').click(); assert.equal(state(f).screen, 'debrief'); assert.equal(state(f).viewing, 'p1'); assert(f.$('gdBalanced')); assert.equal(f.w.location.hash, '#gd');
    input(f, f.$('gdKeep0'), 'Keep framing'); assert.equal(JSON.parse(f.w.localStorage.getItem('cr-gd-past')).find(s => s.id === 'p1').keep[0], 'Keep framing'); assert.equal(state(f).run, null, 'viewing a past one starts nothing');
    noGaps(f, 'past debrief'); f.$('gdBack').click(); assert.equal(state(f).screen, 'home');
    f.w.confirm = () => false; q(f, '[data-gd-delete="p1"]').click(); assert.equal(qa(f, '.gd-past-list li').length, 3, 'kept when you say no');
    f.w.confirm = () => true; q(f, '[data-gd-delete="p1"]').click(); assert.equal(qa(f, '.gd-past-list li').length, 2); assert.deepEqual(state(f).past.map(s => s.id), ['p2', 'p3']); assert.deepEqual(JSON.parse(f.w.localStorage.getItem('cr-gd-past')).map(s => s.id), ['p2', 'p3']);
    q(f, '[data-gd-view="p3"]').click(); assert.equal(state(f).screen, 'debrief'); assert.deepEqual(state(f).run, null);
    noGaps(f, 'past');
  } finally { f.dom.window.close(); }
  const many = Array.from({ length: 12 }, (_, i) => pastEntry('q' + (i + 1)));
  const g = fixture({ storage: { 'cr-gd-past': JSON.stringify(many) } }); try {
    assert.equal(state(g).past.length, 10, 'only the last ten are kept'); at(g, T0); startRun(g, { id: 'library' }); g.$('gdBegin').click(); g.$('gdEnd').click(); g.$('gdFinish').click();
    assert.equal(state(g).past.length, 10); assert.equal(state(g).past[0].id, state(g).run.id, 'the newest first'); assert.equal(JSON.parse(g.w.localStorage.getItem('cr-gd-past')).length, 10);
    g.$('gdBack').click(); assert.equal(state(g).past[0].briefId, 'library'); assert.equal(qa(g, '.gd-past-list li').length, 10); assert.deepEqual(g.errors, []);
  } finally { g.dom.window.close(); }
});

/* ---------- Corrupt storage and isolation ---------- */
test('corrupt cr-gd-run and cr-gd-past are ignored without errors', () => {
  const good = pastEntry('ok1');
  const cases = [
    ['not json at all', 'also not json'], ['[1,2]', '{"not":"a list"}'], ['{"phase":"discuss"}', '[null, 5, "x", [], {}]'], ['null', 'null'],
    [JSON.stringify({ ...JSON.parse(stored({ phase: 'discuss', phaseStarted: real })), names: ['Asha', 'asha', 'Ben'] }), JSON.stringify([{ ...good, briefId: 'gone' }, { ...good, phase: 'discuss', id: 'x2' }, { ...good, names: ['a'], id: 'x3' }])],
    [JSON.stringify({ ...JSON.parse(stored()), phaseStarted: 'yesterday' }), JSON.stringify([{ ...good, discussSeconds: 77, id: 'x4' }])],
    [JSON.stringify({ ...JSON.parse(stored()), log: 'lots', keep: [1], change: 5, summariser: 'me' }), JSON.stringify([good, good, { ...good, id: 'ok2', log: [{ t: 1, who: 99, move: 'open' }, { t: 5, who: 0, move: 'open', note: 5 }] }])]
  ];
  for (const [i, [run, past]] of cases.entries()) {
    const f = fixture({ storage: { 'cr-gd-run': run, 'cr-gd-past': past } }); try {
      f.run('GDTool.open()'); const s = state(f); noGaps(f, 'corrupt ' + i);
      if (i < 6) assert.equal(s.run, null, `case ${i}: run ignored`); else assert.equal(s.run !== null, true);
      if (i === 6) { assert.equal(s.run.log.length, 0); assert.equal(s.run.summariser, null); assert.deepEqual(s.run.keep, {}); }
      assert.deepEqual(s.past.map(p => p.id), i === 6 ? ['ok1', 'ok2'] : [], `case ${i}: past`); if (i === 6) assert.deepEqual(s.past[1].log.map(e => [e.t, e.note]), [[5, '']]);
      assert.equal(qa(f, '.gd-past-list li').length, s.past.length);
      f.$('homeNav').click(); noGaps(f, 'home after corrupt ' + i);
    } finally { f.dom.window.close(); }
  }
});

test('the tool keeps to its own storage keys and leaves other tools’ data alone', () => {
  const others = { 'cr-defence-run': '{"junk":true}', 'cr-defence-past': '[1]', 'cr-peer-run': 'bad', 'cr-next-round': '{"round":"gd","minutes":20,"items":[{"id":"gd-kit"}],"done":[]}', 'cr-aptitude-history': '[]', 'cr-behavioural-stories': '[]' };
  const f = fixture({ storage: others }); try {
    at(f, T0); startRun(f); at(f, T0 + 90_000); tick(f); tap(f, 0, 'open'); at(f, T0 + 90_000 + 480_000); tick(f); f.$('gdFinish').click(); input(f, f.$('gdKeep0'), 'x'); f.$('gdAgain').click();
    const after = storageOf(f); for (const [k, v] of Object.entries(others)) assert.equal(after[k], v, k);
    assert.deepEqual(Object.keys(after).filter(k => !(k in others)).sort(), ['cr-gd-past', 'cr-gd-run'], 'only its own keys are added');
    assert.equal(f.run('DefenceTool.state().run'), null); assert.equal(f.run('PeerMock.state().run'), null); assert.equal(f.run('NextRoundTool.state().items[0].id'), 'gd-kit');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
  const g = fixture(); try {
    at(g, T0); g.run('NextRoundTool.open("hr")'); const before = storageOf(g); startRun(g, { id: 'mess', names: ['A', 'B', 'C'], observer: false }); g.$('gdQuit').click();
    const after = storageOf(g); for (const k of Object.keys(before)) assert.equal(after[k], before[k], k); assert.deepEqual(Object.keys(after).filter(k => !(k in before)).sort(), ['cr-gd-run']); assert.deepEqual(g.errors, []);
  } finally { g.dom.window.close(); }
});

test('every brief runs end to end with no gaps and nothing hidden before the debrief', () => {
  const f = fixture(); try {
    let n = 0;
    for (const b of BRIEFS) {
      at(f, T0 + n * 5_000_000); n++; const t0 = T0 + (n - 1) * 5_000_000;
      startRun(f, { id: b.id, names: ['Asha', 'Ben', 'Chitra', 'Dev', 'Esha', 'Farah'], observerAt: 5 });
      noLeak(f, b, b.id + ' prepare'); noGaps(f, b.id + ' prepare'); at(f, t0 + 90_000); tick(f);
      at(f, t0 + 100_000); tap(f, 0, 'open'); at(f, t0 + 150_000); tap(f, 3, 'evidence');
      noLeak(f, b, b.id + ' discuss'); noGaps(f, b.id + ' discuss'); onePrimary(f, b.id);
      f.$('gdEnd').click(); noLeak(f, b, b.id + ' summary'); noGaps(f, b.id + ' summary'); f.$('gdFinish').click();
      assert(b.balanced.every(x => text(f).includes(x)), b.id + ' debrief shows balanced'); assert(b.tensions.every(x => text(f).includes(x))); assert(b.traps.every(x => text(f).includes(x))); noGaps(f, b.id + ' debrief');
      assert.equal(qa(f, '.gd-table tbody tr').length, 5); f.$('gdBack').click();
    }
    assert.equal(state(f).past.length, 6);
  } finally { f.dom.window.close(); }
});
