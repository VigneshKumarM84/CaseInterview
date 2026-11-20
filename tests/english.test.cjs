const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../src/english-check.js'), C = require('../content/english.js'); const { fixture, settle } = require('./dom.cjs');

const q = (f, s) => f.w.document.querySelector(s);
const text = f => q(f, '#app').textContent;
const input = (f, el, v) => { el.value = v; el.dispatchEvent(new f.w.Event('input', { bubbles: true })); };
function fakeRecognition(f) {
  const made = []; f.w.SpeechRecognition = function () { made.push(this); this.start = () => this.onstart?.(); this.abort = () => { this.aborted = true; this.onend?.(); }; this.stop = this.abort; };
  return { made, say(t) { made.at(-1).onresult({ results: [[{ transcript: t }]] }); } };
}
const at = (f, ms) => f.run(`Date.now = () => ${ms}`);
const plain = (f, expr) => JSON.parse(f.run(`JSON.stringify(${expr})`));
const storageOf = f => { const s = {}; for (const k of Object.keys(f.w.localStorage)) s[k] = f.w.localStorage.getItem(k); return s; };

/* ---------- Content ---------- */
test('the practice bank: unique ids, no digits in sentences, levels 1–3, and accepted answers for every question', () => {
  const ids = new Set();
  for (const [list, kind] of [[C.READ, 'read'], [C.REPEAT, 'repeat'], [C.QUICK, 'quick'], [C.JAM, 'jam']]) {
    assert(list.length >= 16, kind);
    for (const x of list) { assert(!ids.has(x.id), 'unique ' + x.id); ids.add(x.id); assert.equal(E.findItem(kind, x.id), x); }
  }
  for (const x of [...C.READ, ...C.REPEAT]) { assert(!/\d/.test(x.text), 'no digits: ' + x.id); assert([1, 2, 3].includes(x.level)); assert.equal(E.align(x.text, x.text).accuracy, 100, 'a sentence matches itself: ' + x.id); }
  for (const x of C.QUICK) { assert(x.prompt.endsWith('?')); assert(x.answers.length); for (const a of x.answers) assert(E.scoreQuick(x, `I would say ${a}`).correct, `${x.id} accepts “${a}”`); }
  for (const x of C.JAM) assert(x.topic.length > 8);
});

/* ---------- Scoring ---------- */
test('normalising: contractions, digits, hyphens, punctuation and British/American spellings compare equal', () => {
  const same = (a, b) => assert.deepEqual(E.norm(a), E.norm(b), `${a} ≈ ${b}`);
  same("It's first-year colour, can't stop.", 'it is first year color can not stop');
  same('We open at 9 and close at 21', 'we open at nine and close at twenty one');
  same('The organised centre travelled', 'the organized center traveled');
  same("They'll say we're done; don't wait", 'they will say we are done do not wait');
  same('half past 7:30', 'half past seven thirty');
  assert.notDeepEqual(E.norm('four'), E.norm('for'), 'short words keep their spelling');
});

test('alignment marks missed words in the sentence, extra words heard, and an accuracy for the sentence', () => {
  const r = E.align('The library stays open until nine on weekdays.', 'the library is open till 9 on weekdays weekdays');
  assert.deepEqual(r.marks.map(m => m.ok), [true, true, false, true, false, true, true, true]);
  assert.deepEqual(r.missed, ['stays', 'until']); assert.deepEqual(r.extra, ['is', 'till', 'weekdays']); assert.equal(r.accuracy, 75);
  assert.equal(E.align("Please don't wait.", 'please do not wait').accuracy, 100, 'a contraction in the sentence matches its expansion');
  assert.equal(E.align('A first-year student.', 'a first year student').marks[1].ok, true, 'a hyphenated word counts once');
  assert.equal(E.align('One two three.', '').accuracy, 0);
});

test('sentence scores add pace and advice; quick answers need whole words; one-minute talks reuse the delivery checks', () => {
  const r = E.scoreSentence('read', 'He kept a notebook of every new word he learned.', 'he kept a notebook of every new word he learned', { firstAt: 0, lastAt: 4000 });
  assert.deepEqual([r.accuracy, r.wpm, r.level], [100, 150, 'ok']);
  assert.equal(E.scoreSentence('read', 'Short one here.', 'short one here', { firstAt: 0, lastAt: 500 }).wpm, null, 'too short to time');
  assert.match(E.scoreSentence('read', 'Read this sentence slowly now.', 'read this sentence slowly now', { firstAt: 0, lastAt: 8000 }).checks.at(-1).text, /slow/);
  const rep = E.scoreSentence('repeat', 'The meeting has moved to the second floor.', 'the meeting moved');
  assert.equal(rep.level, 'miss'); assert(rep.checks.some(c => /chunks of meaning/.test(c.text)));
  assert.equal(E.scoreSentence('repeat', 'Anything.', '').checks[0].level, 'miss');
  const ice = E.findItem('quick', 'q-09');
  assert(E.scoreQuick(ice, 'Ice.').correct); assert(!E.scoreQuick(ice, 'nice cold water').correct, '“nice” is not “ice”');
  assert(E.scoreQuick(E.findItem('quick', 'q-07'), 'there are 24 hours').correct);
  const talk = 'I think online classes work for revision. Students students students students can pause. Um, classrooms are better for doubts.';
  const j = E.scoreJam(talk, { seconds: 30, pauses: { count: 3, longest: 7 } });
  assert.equal(j.words, 19); assert.equal(j.wpm, 38);
  for (const re of [/stopped after 30 seconds/, /19 words is thin/, /“students” ×4/, /Hedging/, /3 long pauses/, /Filler words: “um” ×1/]) assert(j.checks.some(c => re.test(c.text)), re);
  assert.equal(E.scoreJam('', {}).checks[0].level, 'miss');
});

test('practice runs: the full run is 3 read, 3 repeat, 4 quick, 1 talk in order; recent items are avoided while possible', () => {
  const full = E.buildRun('full', Math.random);
  assert.deepEqual(full.map(x => x.type), ['read', 'read', 'read', 'repeat', 'repeat', 'repeat', 'quick', 'quick', 'quick', 'quick', 'jam']);
  const levels = full.filter(x => x.type === 'read').map(x => E.findItem('read', x.id).level); assert.deepEqual(levels, levels.slice().sort(), 'easier sentences first');
  const recent = C.QUICK.slice(0, 10).map(x => x.id);
  for (let i = 0; i < 20; i++) assert(E.buildRun('quick', Math.random, recent).every(x => !recent.includes(x.id)));
  assert.equal(E.buildRun('jam').length, 1); assert.throws(() => E.buildRun('nope'), /Unknown practice/);
  const hist = [{ type: 'read', accuracy: 80, wpm: 120, missed: ['Weekdays', 'until'] }, { type: 'read', accuracy: 100, wpm: 140, missed: ['weekdays'] }, { type: 'repeat', accuracy: 60, missed: ['until', 'on'] }, { type: 'quick', correct: true }, { type: 'quick', correct: false }, { type: 'jam', wpm: 130, fillers: 2.5 }];
  const s = Object.fromEntries(E.summarise(hist).map(x => [x.type, x]));
  assert.deepEqual([s.read.accuracy, s.read.wpm, s.repeat.accuracy, s.quick.correct, s.jam.fillers, s.jam.wpm], [90, 130, 60, 50, 2.5, 130]);
  assert.deepEqual(E.trickyWords(hist), [{ word: 'weekdays', n: 2 }, { word: 'until', n: 2 }], 'two-letter words are ignored');
});

/* ---------- Screens ---------- */
test('a full practice: read aloud, repeat with two plays, a typed quick answer and a timed one-minute talk, then a summary', async () => {
  const f = fixture({ url: 'https://case.example/#english' }); try {
    const sr = fakeRecognition(f); f.run('EnglishTool.open()'); await settle();
    assert.equal(f.run('view'), 'english'); assert.equal(f.$('aptitudeNav').getAttribute('aria-current'), 'page', 'the Aptitude tab stays marked');
    f.$('enFull').click(); assert.equal(plain(f, 'EnglishTool.state().run.items').length, 11);
    const item = () => { const r = plain(f, 'EnglishTool.state().run'), ref = r.items[r.index]; return { ref, item: f.run(`EnglishCheck.findItem('${ref.type}','${ref.id}')`) }; };
    // Read aloud: one sentence said right, one with a word missed.
    for (let i = 0; i < 3; i++) {
      const { item: it } = item(); assert(text(f).includes(it.text));
      at(f, 1000); f.$('enMic').click(); at(f, 2000); sr.say(it.text); at(f, 5000); sr.say(i === 1 ? it.text.split(' ').slice(1).join(' ') : it.text); f.$('enMic').click();
      f.$('enCheck').click(); assert.match(text(f), i === 1 ? /Missed/ : /100%/); if (i === 1) assert(q(f, '.en-marked mark'), 'the missed word is highlighted');
      assert(text(f).includes('words a minute') || text(f).includes('Words a minute')); f.$('enNext').click();
    }
    // Repeat: the sentence is hidden and plays at most twice.
    const { item: rep } = item(); assert(!text(f).includes(rep.text) || q(f, '#enShown').hidden, 'the sentence is hidden');
    f.$('enPlay').click(); f.$('enPlay').click(); assert(f.$('enPlay').disabled); assert.equal(f.w.__spoken.filter(t => t === rep.text).length, 2);
    input(f, f.$('enHeard'), rep.text); f.$('enCheck').click(); assert.match(text(f), /100%/); f.$('enNext').click();
    for (let i = 0; i < 2; i++) { input(f, f.$('enHeard'), item().item.text); f.$('enCheck').click(); f.$('enNext').click(); }
    // Quick answers: typed, right then wrong; empty answers are not accepted.
    f.$('enCheck').click(); assert.match(f.$('flowHint').textContent, /Speak or type/);
    input(f, f.$('enHeard'), item().item.answers[0]); f.$('enCheck').click(); assert.match(text(f), /✓ Right/); f.$('enNext').click();
    input(f, f.$('enHeard'), 'zebra crossing'); f.$('enCheck').click(); assert.match(text(f), /Expected/); f.$('enNext').click();
    for (let i = 0; i < 2; i++) { input(f, f.$('enHeard'), item().item.answers[0]); f.$('enCheck').click(); f.$('enNext').click(); }
    // One-minute talk: think time, then speaking stops itself at the minute.
    assert.match(f.$('enClock').textContent, /Think time: 15s/);
    at(f, 100000); f.$('enMic').click(); at(f, 101000); sr.say('Cash is simple but digital payments are faster.');
    at(f, 106000); sr.say('Cash is simple but digital payments are faster. I think digital wins because it keeps a record of every payment.');
    at(f, 130000); f.run('EnglishTool.tick()'); assert.match(f.$('enClock').textContent, /Speaking: 30s left/);
    at(f, 161000); f.run('EnglishTool.tick()'); assert.equal(f.run('EnglishTool.state().screen'), 'result', 'the talk stops and is checked at the minute');
    assert.match(text(f), /Time spent speaking/); assert.match(text(f), /1 long pause/); assert.match(text(f), /Hedging: “i think” ×1/);
    f.$('enNext').click(); assert.match(text(f), /You did 11 of 11 tasks/); assert.match(text(f), /Words to say again/);
    const hist = plain(f, 'EnglishTool.state().history'); assert.equal(hist.length, 11);
    assert.equal(hist[0].type, 'jam'); assert.deepEqual(hist[0].pauses, { count: 1, longest: 5 }); assert(hist[0].seconds >= 59 && hist[0].seconds <= 60, String(hist[0].seconds));
    assert.equal(hist.filter(h => h.type === 'quick' && h.correct).length, 3);
    assert.equal(f.w.localStorage.getItem('cr-english-run'), 'null', 'a finished run is cleared');
    f.$('enBack').click(); assert.match(text(f), /Words to practise|Not tried yet|heard as written/);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('an unfinished practice resumes after reload and shows on the home page; corrupt storage is ignored; no recogniser means no reading', () => {
  const f = fixture(); let g, h; try {
    f.run("EnglishTool.start('quick')"); input(f, f.$('enHeard'), 'something'); f.$('enCheck').click(); f.$('enNext').click();
    g = fixture({ storage: storageOf(f) });
    assert(g.$('app').textContent.includes('Spoken English'), 'continue where you left off'); g.w.document.querySelector('[data-continue="english"]').click();
    assert.equal(plain(g, 'EnglishTool.state().run.index'), 1); assert.equal(g.run('EnglishTool.state().screen'), 'item');
    h = fixture({ url: 'https://case.example/#english', storage: { 'cr-english-run': '{"items":[{"type":"read","id":"nope"}]}', 'cr-english-history': JSON.stringify([{ type: 'read', at: 1, itemId: 'read-01', accuracy: 400 }, { type: 'jam', at: 2, itemId: 'jam-01', words: 50, pauses: { count: 'x' } }, null, { type: 'x' }]) } });
    assert.equal(h.run('EnglishTool.state().run'), null);
    assert.deepEqual(plain(h, 'EnglishTool.state().history').map(x => [x.type, x.accuracy, x.pauses]), [['read', null, null], ['jam', null, null]]);
    assert(h.$('enStart-read').disabled, 'reading aloud needs dictation'); assert.match(h.$('app').textContent, /Dictation is not available/);
    h.$('enClear').click(); assert.equal(h.w.localStorage.getItem('cr-english-history'), '[]');
    assert.deepEqual([...f.errors, ...g.errors, ...h.errors], []);
  } finally { f.dom.window.close(); g?.dom.window.close(); h?.dom.window.close(); }
});

test('spoken English is reachable from the Aptitude and HR pages and does not touch other tools’ data', () => {
  const f = fixture(); try {
    f.$('aptitudeNav').click(); f.$('aptEnglish').click(); assert.equal(f.run('view'), 'english'); assert.equal(f.w.location.hash, '#english');
    f.$('behaviouralNav').click(); f.$('bhEnglish').click(); assert.equal(f.run('view'), 'english');
    f.run("EnglishTool.start('jam')"); input(f, f.$('enHeard'), 'A short typed talk about cash and digital payments.'); f.$('enCheck').click();
    assert.deepEqual(Object.keys(f.w.localStorage).filter(k => k.startsWith('cr-')).sort(), ['cr-english-history', 'cr-english-run']);
    f.$('homeNav').click(); assert.equal(f.w.location.hash, ''); assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});
