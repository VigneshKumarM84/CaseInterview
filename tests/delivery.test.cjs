const test = require('node:test'), assert = require('node:assert/strict');
const B = require('../src/behavioural-content.js'); const { fixture } = require('./dom.cjs');

const q = (f, s) => f.w.document.querySelector(s);
const text = f => q(f, '#app').textContent;
function fakeRecognition(f) {
  const made = []; f.w.SpeechRecognition = function () { made.push(this); this.start = () => this.onstart?.(); this.abort = () => { this.aborted = true; this.onend?.(); }; this.stop = this.abort; };
  return { made, say(t) { made.at(-1).onresult({ results: [[{ transcript: t }]] }); } };
}
const at = (f, ms) => f.run(`Date.now = () => ${ms}`);

/* ---------- Delivery checks ---------- */
test('hedges and softeners are counted as phrases, longest first, and clean answers get no warnings', () => {
  const d = B.delivery('I think maybe we could probably fix it. I guess it was a little bit late, and really very slow. Just saying.');
  assert.deepEqual(d.hedges.counts, { 'i think': 1, maybe: 1, probably: 1, 'i guess': 1 });
  assert.deepEqual(d.softeners.counts, { 'a little bit': 1, really: 1, very: 1, just: 1 }, '“a little bit” is one softener, not also “a bit”');
  assert(d.checks.some(c => c.level === 'warn' && /Hedging/.test(c.text)) && d.checks.some(c => c.level === 'warn' && /Softeners/.test(c.text)));
  const clean = B.delivery('I led the audit. I fixed the stock count. Errors fell by half within a month.');
  assert.equal(clean.hedges.total, 0); assert(clean.checks.every(c => c.level === 'ok'), JSON.stringify(clean.checks));
  assert.deepEqual(B.delivery('').checks, []);
});

test('repeated sentence openings, “and then” chains and long sentences are flagged only past their thresholds', () => {
  const chain = B.delivery('And then I called them. And then I wrote the plan. And then I met the dean. And then we won.');
  assert(chain.checks.some(c => /4 of your 4 sentences start with “and then”/.test(c.text)), JSON.stringify(chain.checks));
  assert(chain.checks.some(c => /“And then” appears 4 times/.test(c.text)));
  assert(!B.delivery('So I called them. Then I wrote the plan. Next I met the dean. We won.').checks.some(c => /start with/.test(c.text)), 'varied openings pass');
  const long = B.delivery(`${'word '.repeat(45).trim()}. Short one here.`);
  assert(long.checks.some(c => c.level === 'warn' && /longest has 45/.test(c.text)));
  assert.equal(B.delivery('no full stops at all in a dictated answer that runs on').sentences, null, 'sentence length needs punctuation');
});

test('pauses: gaps of three seconds or more between results count, and time spent stopped does not', () => {
  let p = B.notePause(null, 0, true);
  for (const t of [100, 1500, 5000, 5200, 12000]) p = B.notePause(p, t);
  assert.deepEqual([p.count, p.longest], [2, 6.8]);
  p = B.notePause(p, 60000, true); p = B.notePause(p, 61000); assert.equal(p.count, 2, 'restarting dictation is not a pause');
  const d = B.delivery('A plain answer.', { pauses: { count: 3, longest: 4 } });
  assert(d.checks.some(c => c.level === 'warn' && /3 long pauses/.test(c.text)));
  assert(B.delivery('A plain answer.', { pauses: { count: 1, longest: 3.2 } }).checks.some(c => c.level === 'ok' && /1 long pause/.test(c.text)));
  assert.equal(B.analyse('Typed answer.', { pauses: { count: 9, longest: 9 } }).delivery.pauses, null, 'pauses only count for dictated answers');
});

/* ---------- Goals ---------- */
test('goals are cleaned, checked against an answer and tracked over recent answers', () => {
  assert.deepEqual(B.cleanGoals(null), { fillers: 3, hedges: 2, pauses: 2, pace: true, time: true });
  assert.deepEqual(B.cleanGoals({ fillers: 7, hedges: null, pauses: 0, pace: false, time: 'x' }), { fillers: 3, hedges: null, pauses: 0, pace: null, time: true });
  const r = B.analyse('Um I think I led it, um, and we won.', { competency: 'leadership', seconds: 30, voice: true, pauses: { count: 0, longest: 0 } });
  const g = Object.fromEntries(B.goalChecks(r, { fillers: 1, pauses: 0 }).map(x => [x.id, x]));
  assert.equal(g.fillers.met, false); assert.match(g.fillers.text, /per 100 words \(goal: 1 or fewer per 100 words\)/);
  assert.equal(g.pauses.met, true); assert.equal(g.pace.met, false); assert.equal(g.hedges.id, 'hedges');
  assert.equal(B.goalChecks(B.analyse('Typed.', {}), {}).find(x => x.id === 'pace').met, null, 'pace is not measured for typed answers');
  assert.equal(B.goalChecks(r, { hedges: null }).some(x => x.id === 'hedges'), false, 'switched-off goals are left out');
  const fake = v => ({ fillers: { per100: v }, delivery: { hedges: { per100: 0 }, pauses: null }, pace: null, time: { level: 'ok' } });
  const t = Object.fromEntries(B.goalTrends([6, 5, 6, 2, 1, 1].map(fake), { fillers: 3 }).map(x => [x.id, x]));
  assert.deepEqual([t.fillers.met, t.fillers.measured, t.fillers.direction], [3, 6, 'better']);
  assert.equal(t.pace.measured, 0); assert.equal(t.time.met, 6); assert.equal(t.time.direction, null);
  assert.equal(B.goalTrends([1, 1, 6, 6].map(fake), {}).find(x => x.id === 'fillers').direction, 'worse');
  assert.equal(B.goalTrends(Array(15).fill(fake(1)), {}).find(x => x.id === 'fillers').values.length, 10, 'only the last ten answers');
});

/* ---------- HR practice screens ---------- */
test('a dictated answer records its pauses and shows delivery checks and goals; goals can be changed and trend on the HR page', () => {
  const f = fixture(); try {
    const sr = fakeRecognition(f); at(f, 1000);
    f.run("Behavioural.ask('teamwork')"); f.$('bhMic').click();
    at(f, 2000); sr.say('I think we split the work.');
    at(f, 7500); sr.say('I think we split the work. And then I took the testing and we shipped on time.');
    at(f, 9000); sr.say('I think we split the work. And then I took the testing and we shipped on time. Maybe it was luck.');
    f.$('bhMic').click(); at(f, 40000); f.$('bhFinish').click();
    const a = JSON.parse(f.run('JSON.stringify(Behavioural.state().attempts[0])')); assert.deepEqual(a.pauses, { count: 1, longest: 5.5 });
    assert.match(text(f), /Your goals/); assert.match(text(f), /Hedging: “i think” ×1, “maybe” ×1/); assert.match(text(f), /1 long pause while dictating/);
    q(f, '[data-bh-goals]').click(); assert.equal(f.run('Behavioural.state().screen'), 'home'); assert(f.$('bhGoalSettings').open, 'goal settings open');
    const sel = q(f, '[data-goal="hedges"]'); sel.value = '0.5'; sel.dispatchEvent(new f.w.Event('change', { bubbles: true }));
    assert.equal(JSON.parse(f.w.localStorage.getItem('cr-behavioural-prefs')).goals.hedges, 0.5);
    const off = q(f, '[data-goal="pace"]'); off.value = 'off'; off.dispatchEvent(new f.w.Event('change', { bubbles: true }));
    assert.equal(f.run('Behavioural.state().prefs.goals.pace'), null); assert(!/Speaking pace/.test(q(f, '.bh-trends').textContent), 'a switched-off goal leaves the trend list');
    assert.equal(f.w.document.querySelectorAll('.bh-strip i').length, 4, 'one square per goal for the single answer');
    assert(q(f, '[data-goal="hedges"]').closest('details').open, 'settings stay open after a change');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('stored pauses and goals are validated on load, and the text download includes delivery and goals', () => {
  const attempt = { id: 'b1', at: 5, competency: 'teamwork', mode: 'teamwork', qid: '', question: 'Q', text: 'I think we did it. Maybe.', seconds: 30, voice: true, tags: {}, heard: [], notes: '' };
  const f = fixture({ url: 'https://case.example/#behavioural', storage: { 'cr-behavioural-attempts': JSON.stringify([{ ...attempt, pauses: { count: 2, longest: 4 } }, { ...attempt, id: 'b2', pauses: { count: -1, longest: 'x' } }]), 'cr-behavioural-prefs': '{"goals":{"fillers":99,"hedges":"x","pace":false}}' } });
  try {
    const s = JSON.parse(f.run('JSON.stringify(Behavioural.state())'));
    assert.deepEqual(s.attempts.map(a => a.pauses), [{ count: 2, longest: 4 }, null]);
    assert.deepEqual(s.prefs.goals, { fillers: 3, hedges: 2, pauses: 2, pace: null, time: true });
    assert.match(f.$('bhGoals').textContent, /Met in/); assert.deepEqual(f.errors, []);
    let saved = ''; f.w.Blob = function (parts) { saved = parts.join(''); };
    f.run("Behavioural.feedback('b1')"); f.$('bhDownload').click();
    assert.match(saved, /Hedging: “i think” ×1, “maybe” ×1/); assert.match(saved, /Goal: Filler words/);
  } finally { f.dom.window.close(); }
});
