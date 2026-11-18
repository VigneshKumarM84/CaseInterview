// The guided flow on multi-step screens: one next step at a time, a bar at the bottom that says what to do,
// and secondary actions kept out of the way. Covers the HR practice interview and the case stages.
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture } = require('./dom.cjs');
const doc = f => f.w.document, text = f => f.$('app').textContent;
const input = (f, id, v) => { const el = f.$(id); el.value = v; el.dispatchEvent(new f.w.Event('input', { bubbles: true })); };
const primaries = f => doc(f).querySelectorAll('.flow-bar .primary').length;
const ANSWER = 'I am a final-year commerce student. I ran the college fest budget and cut costs by 12%. I want this role because I like working with numbers and people.';

test('a practice interview runs question → quick feedback → next question → summary, with one next step each time', () => {
  const f = fixture(); try {
    f.$('behaviouralNav').click();
    assert.match(f.$('bhSetupSummary').textContent, /5 questions · A typical HR round · about 10 minutes/);
    assert(!doc(f).querySelector('.bh-options').open, 'focus and length are tucked away');
    f.$('bhStart').click();
    const st = () => f.run('Behavioural.state()'), set = () => st().set;
    assert.equal(set().qids.length, 5); assert.equal(new Set(set().qids).size, 5);
    assert.equal(st().draft.competency, 'intro', 'a typical round opens with "tell me about yourself"');
    assert.match(text(f), /QUESTION 1 OF 5/); assert.equal(primaries(f), 1); assert.equal(f.$('bhFinish').textContent, 'Done · see feedback →');
    assert.match(f.$('flowHint').textContent, /Speak or type your answer/);
    assert.equal(doc(f).querySelector('.flow-help').open, false, 'help is there but closed');
    assert.equal(doc(f).querySelectorAll('#app select').length, 0, 'no voice or language pickers on the question screen');

    // An empty answer is explained next to the button, and focus goes to the answer box.
    f.$('bhFinish').click(); assert.equal(st().screen, 'question'); assert.match(f.$('flowHint').textContent, /Speak or type your answer first/);
    assert.equal(doc(f).activeElement, f.$('bhAnswer'));
    input(f, 'bhAnswer', ANSWER); assert.equal(f.$('flowHint').textContent, '', 'the hint clears once there is an answer');
    f.$('bhFinish').click(); assert.equal(st().screen, 'review'); assert.equal(primaries(f), 1); assert.equal(doc(f).activeElement, f.$('bhNext'), 'focus moves to the next step');
    assert.equal(st().draft, null); assert.equal(set().answers[0], st().attempts[0].id);

    f.$('bhNext').click(); assert.match(text(f), /QUESTION 2 OF 5/); assert.equal(st().draft.competency, 'motivation');
    f.$('bhSkip').click(); assert.match(text(f), /QUESTION 3 OF 5/, 'skipping moves on');
    input(f, 'bhAnswer', 'We did it together and we won.'); f.$('bhFinish').click();
    f.$('bhAgain').click(); assert.equal(st().screen, 'question'); assert.match(text(f), /QUESTION 3 OF 5/, 'trying again stays on the same question');
    input(f, 'bhAnswer', 'I organised it and I won the vote.'); f.$('bhFinish').click(); f.$('bhNext').click();
    f.$('bhSkip').click(); assert.match(text(f), /QUESTION 5 OF 5/);
    input(f, 'bhAnswer', ANSWER); f.$('bhFinish').click(); assert.equal(f.$('bhNext').textContent, 'See your summary →');
    f.$('bhNext').click(); assert.equal(st().screen, 'summary'); assert.match(text(f), /You answered 3 of 5 questions/);
    assert.equal(doc(f).querySelectorAll('.bh-summary-list li').length, 5); assert.equal((text(f).match(/Skipped/g) || []).length, 2);
    assert.equal(set(), null, 'the finished interview is cleared'); assert.equal(st().attempts.length, 4, 'the retried question keeps both answers in history');
    doc(f).querySelector('[data-bh-view]').click(); assert.equal(st().screen, 'feedback'); assert(f.$('bhAgain'));
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('an interview in progress survives reload and is one click from the home page', () => {
  const f = fixture(); let g; try {
    f.run("Behavioural.startSet('mixed', 3)"); input(f, 'bhAnswer', ANSWER); f.$('bhFinish').click(); f.$('bhNext').click(); input(f, 'bhAnswer', 'Half an answer');
    const storage = {}; for (const k of Object.keys(f.w.localStorage)) storage[k] = f.w.localStorage.getItem(k);
    g = fixture({ storage });
    const cont = doc(g).querySelector('[data-continue="behavioural"]'); assert.match(cont.textContent, /Practice interview.*Question 2 of 3/s);
    cont.click(); assert.equal(g.run('Behavioural.state().screen'), 'question'); assert.equal(g.$('bhAnswer').value, 'Half an answer'); assert.match(text(g), /QUESTION 2 OF 3/);
    g.$('bhExit').click(); assert.match(doc(g).querySelector('.bh-resume').textContent, /question 2 of 3/); g.$('bhDiscard').click(); assert.equal(g.run('Behavioural.state().set'), null);
    assert.deepEqual(f.errors, []); assert.deepEqual(g.errors, []);
  } finally { f.dom.window.close(); g?.dom.window.close(); }
});

test('a single question asked from a plan keeps offering another, and can be finished', () => {
  const f = fixture(); try {
    f.run("NextRoundTool.go('bh-intro')"); assert.match(text(f), /HR INTERVIEW · QUESTION 1(?! OF)/); assert.equal(f.$('bhSkip').textContent, 'Ask me a different question');
    input(f, 'bhAnswer', ANSWER); f.$('bhFinish').click(); assert.equal(f.$('bhNext').textContent, 'Next question →'); assert(f.$('bhDone'));
    f.$('bhNext').click(); assert.match(text(f), /HR INTERVIEW · QUESTION 2(?! OF)/); assert.equal(f.run('Behavioural.state().draft.competency'), 'intro');
    input(f, 'bhAnswer', ANSWER); f.$('bhFinish').click(); f.$('bhDone').click(); assert.match(text(f), /You answered 2 of 2 questions/);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('voice options live in one window: English voices first, Indian English on top', () => {
  const f = fixture(); try {
    f.w.speechSynthesis.getVoices = () => [{ voiceURI: 'it', name: 'Alice', lang: 'it-IT', localService: true }, { voiceURI: 'gb', name: 'Daniel', lang: 'en-GB', localService: true }, { voiceURI: 'in', name: 'Rishi', lang: 'en-IN', localService: true }];
    f.run("Behavioural.ask('teamwork')"); assert.equal(f.$('voice'), null);
    f.$('voiceSettings').click();
    assert.deepEqual([...f.$('voice').options].map(o => o.textContent.split(' ·')[0]), ['Device default voice', 'Rishi', 'Daniel']);
    f.$('speed').value = '1.15'; f.$('speed').dispatchEvent(new f.w.Event('change')); assert.equal(f.run('settings.speed'), '1.15');
    assert.match(f.$('modalContent').textContent, /No recording is kept/);
    f.$('speak').click(); assert(f.$('speak').hidden && !f.$('stopSpeech').hidden, 'Listen turns into Stop while reading'); f.$('stopSpeech').click(); assert(!f.$('speak').hidden);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('case stages: one next step, the reason shown next to it, and the previous stage as a link', () => {
  const f = fixture(); try {
    f.run("start('cement')");
    assert.equal(primaries(f), 1); assert.equal(f.$('back'), null, 'no going back from the first stage'); assert(f.$('saveExit'));
    assert.equal(doc(f).querySelectorAll('#app select').length, 0); assert.equal((text(f).match(/Save & exit/g) || []).length, 0);
    f.$('next').click(); assert.equal(f.run('session.step'), 0); assert.match(f.$('flowHint').textContent, /Explain your reasoning before continuing/);
    input(f, 'answer', 'Is the problem margin or volume?'); f.$('next').click(); assert.equal(f.run('session.step'), 1);
    assert.equal(f.$('back').textContent, '← Previous stage'); f.$('back').click(); assert.equal(f.run('session.step'), 0);
    f.$('saveExit').click(); assert.equal(f.run('view'), 'home'); assert(doc(f).querySelector('[data-continue="case"]'));
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});
