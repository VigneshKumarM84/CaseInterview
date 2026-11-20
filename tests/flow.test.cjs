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
    assert.match(f.$('flowHint').textContent, /Press the microphone to answer, or type/);
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

test('aptitude practice and the maths drill: the next step lives in the bar, with a reason when it cannot go on', () => {
  const f = fixture(); try {
    f.run('Aptitude.quickPractice({ count: 3 })');
    assert.equal(primaries(f), 1); assert(f.$('aptExit') && f.$('aptReveal') && f.$('aptEnd'));
    assert.equal(doc(f).querySelectorAll('.flow-bar .wu-link').length, 2, 'show solution and end are links');
    f.$('aptNext').click(); assert.equal(f.run('Aptitude.state().run.index'), 0); assert.match(f.$('flowHint').textContent, /Choose an answer first/);
    doc(f).querySelector('.apt-option').click(); assert.equal(f.$('aptReveal'), null); assert.equal(doc(f).activeElement, f.$('aptNext'));
    f.$('aptNext').click(); assert.equal(f.run('Aptitude.state().run.index'), 1);
    f.$('aptExit').click(); assert.equal(f.run('Aptitude.state().screen'), 'home');

    f.run("CaseDrill.quick({ skills: ['percent'], count: 3 })");
    const type = f.run('CaseDrill.state().run.questions[0].type');
    if (type !== 'choice') {
      assert.equal(f.$('drillCheck').getAttribute('form'), 'drillForm', 'Check in the bar submits the answer');
      f.$('drillInput').value = 'abc'; f.$('drillCheck').click(); assert.match(f.$('flowHint').textContent, /Enter a number/); assert.equal(doc(f).activeElement, f.$('drillInput'));
      f.$('drillInput').value = '1'; f.$('drillForm').dispatchEvent(new f.w.Event('submit', { cancelable: true }));
    } else doc(f).querySelector('[data-choice]').click();
    assert.equal(primaries(f), 1); assert.equal(f.$('drillReveal'), null); assert.match(f.$('drillNext').textContent, /Next question/);
    f.$('drillNext').click(); assert.equal(f.run('CaseDrill.state().run.index'), 1);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('peer interview: Previous and Next in the bar, the next stage named, and a reminder to rate', () => {
  const f = fixture(); try {
    f.run("PeerMock.start('market')");
    assert.equal(f.$('peerPrev'), null); assert.equal(f.$('peerNext').textContent, 'Next: Investigate →'); assert.match(f.$('flowHint').textContent, /Rate this stage/);
    const good = doc(f).querySelector('input[name=peerRating]'); good.checked = true; good.dispatchEvent(new f.w.Event('change')); assert.equal(f.$('flowHint').textContent, '');
    f.$('peerNext').click(); assert.equal(f.run('PeerMock.state().run.step'), 1); assert.equal(f.$('peerPrev').textContent, '← Previous stage');
    f.run('PeerMock.state().run.step = 7'); doc(f).querySelector('[data-peer-stage="7"]').click(); assert.equal(f.$('peerNext').textContent, 'Wrap up and give feedback →');
    assert.equal(primaries(f), 1); assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('warm-up steps use the same bar: one next step, help as a link, the reason next to the button', () => {
  const f = fixture(); try {
    f.run('WarmupTool.open()'); f.$('wuStart').click();
    assert.equal(primaries(f), 1); assert.equal(f.$('wuCheck').textContent, 'Compare with an example →'); assert(f.$('wuStuck').classList.contains('wu-link'));
    f.$('wuCheck').click(); assert.match(f.$('flowHint').textContent, /Write your answer first/);
    input(f, 'wuAnswer', 'Revenue or surplus?'); f.$('wuCheck').click(); assert.equal(primaries(f), 1); assert.equal(f.$('wuNext').textContent, 'Next step →');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

/* ---------- Speak first, and watch your words appear ---------- */
function fakeMic(f) {
  const made = []; f.w.SpeechRecognition = function () { made.push(this); this.start = () => this.onstart?.(); this.abort = () => { this.aborted = true; this.onend?.(); }; this.stop = this.abort; };
  const result = (t, isFinal) => Object.assign([{ transcript: t }], { isFinal });
  return { made, hear(finished, inProgress = '') { made.at(-1).onresult({ results: [...finished.map(t => result(t, true)), ...(inProgress ? [result(inProgress, false)] : [])] }); } };
}

test('the microphone leads every answer screen and the screen is built to fit the window', () => {
  const f = fixture(); try {
    f.$('behaviouralNav').click(); f.$('bhStart').click();
    const mic = f.$('bhMic'), box = f.$('bhAnswer');
    assert(mic.classList.contains('mic-hero'), 'the mic is the highlighted control');
    assert(mic.compareDocumentPosition(box) & f.w.Node.DOCUMENT_POSITION_FOLLOWING, 'the mic comes before the answer box');
    assert(doc(f).querySelector('.flow-screen.fit'), 'the screen opts into the no-scroll layout');
    assert(box.parentElement.classList.contains('dictation-box'), 'the box sits in the scrolling area');
    assert.match(box.placeholder, /appear here as you speak/);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('while the mic is on, the words heard appear at once: finished words and words still being recognised are shown apart', () => {
  const f = fixture(); try {
    const mic = fakeMic(f); f.$('behaviouralNav').click(); f.$('bhStart').click();
    const live = () => doc(f).querySelector('.live-caption');
    assert.match(f.$('bhVoiceStatus').textContent, /Press the microphone/);
    assert(live().hidden, 'nothing is laid over the box before the mic is on');
    f.$('bhMic').click();
    assert.equal(live().hidden, false); assert.match(live().textContent, /Listening… start speaking/);
    assert.match(f.$('bhVoiceStatus').textContent, /^Listening/);
    mic.hear(['I led the finance club'], 'and we doubled');
    assert.equal(live().querySelector('.interim').textContent.trim(), 'and we doubled', 'words still being recognised are marked');
    assert.equal(live().textContent, 'I led the finance club and we doubled');
    assert.equal(f.$('bhAnswer').value, 'I led the finance club and we doubled', 'the box already holds everything heard');
    assert.equal(f.run('Behavioural.state().draft.text'), 'I led the finance club and we doubled', 'and it is saved as it comes');
    mic.hear(['I led the finance club', 'and we doubled the sponsors']);
    assert.equal(live().querySelector('.interim').textContent, '', 'recognised words stop being marked');
    assert.equal(f.$('bhAnswer').value, 'I led the finance club and we doubled the sponsors');
    f.$('bhMic').click();
    assert(live().hidden, 'stopping hands the text back to the box to edit'); assert.equal(f.$('bhAnswer').readOnly, false);
    assert.equal(f.$('bhAnswer').value, 'I led the finance club and we doubled the sponsors');
    f.$('bhMic').click(); mic.hear(['then I presented it']);
    assert.equal(f.$('bhAnswer').value, 'I led the finance club and we doubled the sponsors then I presented it', 'starting again adds to what was there');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('the case interview puts the mic first too, beside the reference rather than under it', () => {
  const f = fixture(); try {
    fakeMic(f); f.run("start('cement')");
    const ref = doc(f).querySelector('.case-desk .case-ref'), ans = doc(f).querySelector('.case-desk .case-answer');
    assert(ref && ans, 'two panes: reference and answer');
    assert(ans.contains(f.$('mic')) && ans.contains(f.$('answer')) && !ref.contains(f.$('mic')));
    assert(f.$('mic').classList.contains('mic-hero'));
    f.run("session.step=2;persist();renderSession()");
    assert(doc(f).querySelector('.case-answer #number'), 'the number goes with the answer, not the reading');
    f.$('mic').click(); assert.equal(doc(f).querySelector('.live-caption').hidden, false);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});
