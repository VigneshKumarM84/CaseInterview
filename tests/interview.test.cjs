/* HR practice under interview conditions: the follow-up rules, and the flow with nothing to lean on. */
const test = require('node:test'), assert = require('node:assert/strict');
const B = require('../src/behavioural-content.js'); const { fixture } = require('./dom.cjs');

const q = (f, s) => f.w.document.querySelector(s);
const text = f => q(f, '#app').textContent;
const input = (f, el, v) => { el.value = v; el.dispatchEvent(new f.w.Event('input', { bubbles: true })); };
const state = f => JSON.parse(f.run('JSON.stringify(Behavioural.state())'));
const storageOf = f => { const s = {}; for (const k of Object.keys(f.w.localStorage)) s[k] = f.w.localStorage.getItem(k); return s; };
const at = (f, ms) => f.run(`Date.now = () => ${ms}`);
const GAP = /undefined|\bnull\b|NaN|\[object/;
function fakeRecognition(f) {
  const made = []; f.w.SpeechRecognition = function () { made.push(this); this.start = () => this.onstart?.(); this.abort = () => { this.aborted = true; this.onend?.(); }; this.stop = this.abort; };
  return { made, say(t) { made.at(-1).onresult({ results: [[{ transcript: t }]] }); } };
}
function startInterview(f, mode = 'failure') {
  f.$('behaviouralNav').click();
  for (const [name, value] of [['bhMode', mode], ['bhCount', '3'], ['bhStyle', 'interview']]) { const el = q(f, `input[name=${name}][value="${value}"]`); el.click(); el.dispatchEvent(new f.w.Event('change')); }
  f.$('bhStart').click();
}
/* Filler text with no number, result or lesson words in it. */
const words = n => Array.from({ length: n }, () => 'spoke').join(' ');
/* About 150 words with "I", a number, a result and a lesson: trips no rule for a story question. */
const CLEAN = 'I ran the sponsorship desk for our college fest. ' + 'I called twelve local shops and I wrote each owner a short proposal. '.repeat(9) + 'I raised ₹2 lakh and the fest finished on time. Since then I always plan a backup sponsor.';
const first = { rand: () => 0 };

/* ---------- The rules ---------- */
test('follow-ups: a clean answer gets one prepared probe, and each rule fires on what it counts', () => {
  assert(B.wordCount(CLEAN) > 110 && B.wordCount(CLEAN) < 340, 'the fixture is a normal-length answer');
  assert.deepEqual(B.followUps(CLEAN, { competency: 'failure', ...first }).map(x => x.id), ['prepared']);
  assert.equal(B.followUps(CLEAN, { competency: 'failure', ...first })[0].text, B.competency('failure').probes[0]);
  assert.equal(B.followUps(CLEAN, { competency: 'failure', rand: () => 0.99 })[0].text, B.competency('failure').probes[1]);
  // Story competencies without a lesson check can also be asked what they would do differently.
  assert.equal(B.followUps(CLEAN, { competency: 'leadership', rand: () => 0.99 })[0].text, B.GENERAL_PROBES[2]);
  const rule = (t, o) => B.followUps(t, { competency: 'leadership', ...first, ...o });
  const short = rule('I led the team and we raised ₹2 lakh.'); assert.deepEqual(short.map(x => x.id), ['short', 'prepared']); assert.match(short[0].text, /^That was brief\./); assert.match(short[0].why, /would take about \d+s to say/);
  const long = rule('I finished 3 tasks. ' + words(420)); assert.equal(long[0].id, 'long'); assert.match(long[0].text, /^That was a long answer\. In one or two sentences, what was the result\?/);
  const we = rule(CLEAN.replace(/\bI\b/g, 'we')); assert.equal(we[0].id, 'we'); assert.equal(we[0].text, B.GENERAL_PROBES[0]); assert.match(we[0].why, /“we” \d+ times and “I” 0 times/);
  const none = rule('I ' + words(150)); assert.equal(none[0].id, 'outcome'); assert.equal(none[0].text, B.GENERAL_PROBES[1]);
  const vague = rule('I ' + words(150) + ' and the fest finished well.'); assert.equal(vague[0].id, 'number'); assert.match(vague[0].text, /put a number on that/);
  const lesson = B.followUps(CLEAN.replace('Since then I always plan a backup sponsor.', 'It was fine.'), { competency: 'failure', ...first }); assert.equal(lesson[0].id, 'lesson');
  for (const f of [short, long, we, none, vague, lesson]) { assert.equal(f.length, 2, 'the rule, then one prepared probe'); assert(f.every(x => x.text && x.why)); }
});

test('follow-ups: an interruption, timed speech, other answer shapes, hypothetical questions and the limit', () => {
  const cut = B.followUps(CLEAN, { competency: 'failure', seconds: 151, voice: true, cut: true, ...first });
  assert.match(cut[0].text, /^Let me stop you there\./); assert.match(cut[0].why, /still speaking after 151s.*90–120s.*cut in/);
  // Dictated answers use the clock; typed answers use the word count.
  assert.equal(B.followUps(CLEAN, { competency: 'failure', seconds: 30, voice: true, ...first })[0].id, 'short');
  assert.equal(B.followUps(CLEAN, { competency: 'failure', seconds: 30, voice: false, ...first })[0].id, 'prepared');
  const intro = B.followUps('I am a final-year student and ' + words(200), { competency: 'intro', ...first });
  assert.equal(intro[0].id, 'number'); assert.match(intro[0].text, /Pick one of those highlights/);
  assert.match(B.followUps('I like it.', { competency: 'intro', ...first })[0].text, /Pick one thing you have done/);
  const fit = B.followUps('I want to join because ' + words(120), { competency: 'motivation', ...first });
  assert.deepEqual(fit.map(x => x.id), ['prepared'], 'no number is expected in a "why this company" answer');
  assert.match(B.followUps('Because.', { competency: 'motivation', ...first })[0].text, /What specifically about this role/);
  assert.match(B.followUps(words(600), { competency: 'motivation', ...first })[0].text, /main reason for wanting this role/);
  // "What would you do if…" has no result, number or lesson to ask for.
  const hyp = B.followUps('We would ' + words(150), { competency: 'ethics', hypothetical: true, ...first }); assert.deepEqual(hyp.map(x => x.id), ['prepared']);
  assert.match(B.followUps('I would refuse.', { competency: 'ethics', hypothetical: true, ...first })[0].text, /what you would do, step by step/);
  assert.equal(B.followUps('I led.', { competency: 'leadership', max: 1 }).length, 1); assert.equal(B.followUps('I led.', { competency: 'leadership', max: 0 }).length, 0);
  for (const c of B.COMPETENCIES) for (const t of ['', 'ok', CLEAN, words(500)]) for (const f of B.followUps(t, { competency: c.id })) assert(f.text && f.why && !GAP.test(f.text + f.why), c.id);
});

/* ---------- The flow ---------- */
test('interview conditions: no skip, retry or help; follow-ups are asked; feedback waits until the end', () => {
  const f = fixture(); try {
    f.$('behaviouralNav').click(); assert.equal(f.$('bhStart').textContent, 'Start practice interview →');
    startInterview(f); let s = state(f);
    assert.equal(s.prefs.style, 'interview'); assert.equal(s.set.strict, true); assert.equal(s.set.qids.length, 3); assert.equal(s.screen, 'question');
    const q1 = B.findQuestion(s.draft.qid).text;
    assert.match(text(f), /INTERVIEW CONDITIONS/); assert.match(text(f), /Question 1 of 3/); assert(!text(f).includes('Failure or mistake'), 'the competency is not named');
    for (const id of ['bhSkip', 'bhTimerBtn', 'bhStory', 'bhMeter']) assert.equal(f.$(id), null, id + ' is not offered');
    assert.equal(q(f, '.flow-help'), null, 'no help'); assert.equal(f.$('bhExit').textContent, 'End the interview');
    assert.deepEqual(f.w.__spoken, [q1], 'the interviewer asks out loud without being told to');
    f.$('bhFinish').click(); assert.equal(state(f).attempts.length, 0, 'an empty answer does not move on'); assert.match(f.$('flowHint').textContent, /Say or type something/);
    // A short answer with no lesson: the interviewer asks for more, then a prepared probe.
    input(f, f.$('bhAnswer'), 'I missed a deadline once and we lost marks.'); f.$('bhFinish').click(); s = state(f);
    assert.equal(s.screen, 'question', 'no feedback between questions'); assert.equal(s.attempts.length, 1); assert.equal(s.draft.follow, 1); assert.equal(s.set.plan.length, 2); assert.equal(s.set.plan[0].id, 'short');
    assert.match(text(f), /THE INTERVIEWER FOLLOWS UP/); assert.match(text(f), /Question 1 of 3 · follow-up/); assert.equal(f.$('bhPrompt').textContent, s.set.plan[0].text); assert.equal(f.w.__spoken.at(-1), s.set.plan[0].text);
    assert.equal(f.$('bhAnswer').value, '', 'a fresh answer box');
    input(f, f.$('bhAnswer'), 'I planned the work late.'); f.$('bhFinish').click(); s = state(f);
    assert.equal(s.draft.follow, 2); assert.equal(f.$('bhPrompt').textContent, s.set.plan[1].text); assert(B.competency('failure').probes.includes(s.set.plan[1].text));
    input(f, f.$('bhAnswer'), 'They were annoyed.'); f.$('bhFinish').click(); s = state(f);
    assert.equal(s.set.index, 1); assert.equal(s.draft.follow, 0); assert.deepEqual(s.set.plan, []); assert.match(text(f), /Question 2 of 3/);
    assert.equal(s.attempts[0].followUps.length, 2); assert.deepEqual(s.attempts[0].followUps.map(x => x.text), ['I planned the work late.', 'They were annoyed.']);
    // A full answer trips no rule, so only one prepared probe follows.
    input(f, f.$('bhAnswer'), CLEAN); f.$('bhFinish').click(); s = state(f); assert.deepEqual(s.set.plan.map(x => x.id), ['prepared']);
    input(f, f.$('bhAnswer'), 'They understood.'); f.$('bhFinish').click(); assert.match(text(f), /Question 3 of 3/);
    input(f, f.$('bhAnswer'), CLEAN); f.$('bhFinish').click(); input(f, f.$('bhAnswer'), 'Last month.'); f.$('bhFinish').click(); s = state(f);
    // The end: the student's own call first, then everything at once.
    assert.equal(s.screen, 'summary'); assert.equal(s.draft, null); assert.equal(s.set.over, true); assert.equal(s.set.guessed, false);
    assert.match(text(f), /Before you see the feedback/); assert(!/flagged|Why it was asked/.test(text(f)), 'nothing is revealed yet'); assert.equal(f.w.__spoken.at(-1), 'Thank you. That is the end of the interview.');
    assert.equal(f.w.document.querySelectorAll('[name=bhGuess]').length, 4, 'three answers and "not sure"');
    q(f, '[name=bhGuess][value="0"]').click(); f.$('bhReveal').click(); s = state(f); assert.equal(s.set.guess, 0); assert.equal(s.set.guessed, true);
    let t = text(f); assert(!GAP.test(t), t.match(/.{30}(undefined|\bnull\b|NaN|\[object).{20}/)?.[0]);
    assert.match(t, /You answered 3 of 3 questions and 4 follow-ups\./); assert.match(t, /Your call: question 1\. The checks flagged 1 habit there and 2 habits on question 2\./); assert.match(t, /Why it was asked: Your answer would take about \d+s to say/);
    assert.match(t, /None of them is a judgement of your answer/); assert(!/You left the interview/.test(t)); assert.equal(f.w.document.querySelectorAll('.bh-debrief > li').length, 3); assert.equal(f.w.document.querySelectorAll('.bh-asked').length, 4);
    // Full feedback on one answer shows its follow-ups and leads back.
    const firstId = s.attempts.at(-1).id; q(f, `[data-bh-view="${firstId}"]`).click(); t = text(f);
    assert.match(t, /Follow-ups you were asked/); assert(t.includes('I planned the work late.')); assert.equal(f.$('bhBackToSet').textContent, 'Back to the interview feedback →');
    let saved = ''; f.w.Blob = function (parts) { saved = parts.join(''); }; f.$('bhDownload').click();
    assert.match(saved, /ASKED UNDER INTERVIEW CONDITIONS\nFollow-up 1: That was brief\./); assert.match(saved, /Your reply \(5 words[^)]*\): I planned the work late\./);
    f.$('bhBackToSet').click(); assert.match(text(f), /You answered 3 of 3/);
    f.$('bhBack').click(); s = state(f); assert.equal(s.set, null); assert.equal(s.screen, 'home'); assert.equal(f.$('bhResume'), null);
    assert.match(text(f), /interview conditions · 2 follow-ups/, 'history marks interview answers'); assert.equal(f.$('bhStart').textContent, 'Start the interview →', 'the choice is remembered');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('interview conditions while dictating: the interviewer moves on after a silence and cuts in on a long answer', () => {
  const f = fixture(); try {
    const sr = fakeRecognition(f); at(f, 1000); startInterview(f, 'leadership');
    f.$('bhMic').click(); at(f, 2000); sr.say('I led a team of five and we finished two days early.');
    at(f, 5000); f.run('Behavioural.beat()'); assert(!/Finished\?/.test(f.$('bhVoiceStatus').textContent), 'a three-second pause is left alone');
    at(f, 6500); f.run('Behavioural.beat()'); assert.match(f.$('bhVoiceStatus').textContent, /Finished\? The interviewer moves on in 3s/);
    at(f, 7000); sr.say('I led a team of five and we finished two days early. I also wrote the plan.'); at(f, 7500); f.run('Behavioural.beat()');
    assert.equal(f.$('bhVoiceStatus').textContent, 'Listening… Stop to edit.', 'speaking again cancels the warning'); assert.equal(state(f).attempts.length, 0);
    at(f, 14100); f.run('Behavioural.beat()'); let s = state(f);
    assert.equal(s.attempts.length, 1, 'seven seconds of silence ends the answer'); assert.equal(s.attempts[0].voice, true); assert.equal(s.attempts[0].cut, false); assert.equal(s.draft.follow, 1); assert(sr.made[0].aborted, 'the microphone is released');
    // A follow-up reply is cut off after 90 seconds of speaking.
    at(f, 20000); f.$('bhMic').click(); at(f, 21000); sr.say('Well'); at(f, 111500); sr.say('Well I kept going'); f.run('Behavioural.beat()'); s = state(f);
    assert.equal(s.attempts[0].followUps.length, 1); assert.equal(s.attempts[0].followUps[0].cut, true);
    while (state(f).set.index === 0) { input(f, f.$('bhAnswer'), 'Fine.'); f.$('bhFinish').click(); }
    // A main answer still going at 125% of its upper target is interrupted, and the follow-up says so.
    at(f, 200000); f.$('bhMic').click(); at(f, 201000); sr.say('I started'); at(f, 351500); sr.say('I started and never stopped'); f.run('Behavioural.beat()'); s = state(f);
    assert.equal(s.attempts[0].cut, true); assert.equal(s.set.plan[0].id, 'long'); assert.match(f.$('bhPrompt').textContent, /^Let me stop you there\./); assert.match(s.set.plan[0].why, /cut in/);
    // Typed answers are never ended for the student.
    input(f, f.$('bhAnswer'), 'The result was good.'); at(f, 900000); f.run('Behavioural.beat()'); assert.equal(state(f).draft.text, 'The result was good.');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('interview conditions: leaving is counted, a reload resumes, ending early keeps the answers, and bad storage is ignored', () => {
  const f = fixture(); let g, h; try {
    startInterview(f); input(f, f.$('bhAnswer'), 'I missed a deadline.'); f.$('bhFinish').click(); input(f, f.$('bhAnswer'), 'Half a reply');
    f.run('Behavioural.beat()'); assert.equal(state(f).set.left, 0, 'staying on the question is not leaving');
    f.$('homeNav').click(); f.run('Behavioural.beat()'); f.run('Behavioural.beat()'); assert.equal(state(f).set.left, 1, 'counted once per absence');
    f.$('behaviouralNav').click(); assert.match(q(f, '.bh-resume').textContent, /Unfinished interview · interview conditions/); assert.match(q(f, '.bh-resume').textContent, /Question 1 of 3 · follow-up/);
    f.$('bhResume').click(); assert.equal(f.$('bhAnswer').value, 'Half a reply'); assert.match(text(f), /THE INTERVIEWER FOLLOWS UP/); f.run('Behavioural.beat()'); assert.equal(state(f).set.left, 1);
    // Reloading the page mid-interview is leaving too, and the follow-up carries on.
    g = fixture({ url: 'https://case.example/#behavioural', storage: storageOf(f) }); let s = state(g);
    assert.equal(s.set.left, 2); assert.equal(s.draft.follow, 1); g.run('Behavioural.beat()'); assert.equal(state(g).set.left, 2, 'not counted twice');
    g.$('bhResume').click(); assert.equal(g.$('bhPrompt').textContent, s.set.plan[0].text); assert.equal(g.$('bhAnswer').value, 'Half a reply');
    g.$('bhExit').click(); s = state(g); assert.equal(s.set.over, true); assert.equal(s.draft, null); assert.equal(s.attempts[0].followUps.length, 0, 'the unfinished reply is not saved');
    g.$('bhReveal').click(); assert.match(text(g), /You answered 1 of 3 questions and 0 follow-ups/); assert.match(text(g), /You left the interview 2 times/); assert.match(text(g), /Not answered\./);
    assert(!/Your call/.test(text(g)), '"not sure" makes no comparison'); assert(!GAP.test(text(g)));
    g.$('bhStart').click(); assert.equal(state(g).set.strict, true); assert.equal(state(g).set.left, 0); g.$('bhExit').click(); assert.equal(state(g).set, null, 'ending with nothing answered drops the interview');
    // A stored interview that cannot carry on ends with what was answered; one with nothing answered is dropped.
    const stored = storageOf(f), set = JSON.parse(stored['cr-behavioural-set']);
    h = fixture({ url: 'https://case.example/#behavioural', storage: { ...stored, 'cr-behavioural-set': JSON.stringify({ ...set, plan: 'x', guess: 99, left: -4 }) } }); s = state(h);
    assert.equal(s.draft, null); assert.equal(s.set.over, true); assert.equal(s.set.guess, null); assert.equal(s.set.left, 0); assert.match(q(h, '.bh-resume').textContent, /Interview finished/);
    h.$('bhResume').click(); assert.match(text(h), /Before you see the feedback/);
    const k = fixture({ url: 'https://case.example/#behavioural', storage: { 'cr-behavioural-set': JSON.stringify(set), 'cr-behavioural-attempts': JSON.stringify([{ id: 'b1', at: 5, competency: 'failure', text: 'x', strict: true, followUps: [{ question: 'Q?', text: 7, seconds: -1 }, 'bad', { text: 'no question' }] }]) } });
    try { s = state(k); assert.equal(s.set, null, 'no draft and no answers'); assert.deepEqual(s.attempts[0].followUps, [{ rule: '', question: 'Q?', why: '', text: '', seconds: null, voice: false, cut: false }]); assert.deepEqual(k.errors, []); } finally { k.dom.window.close(); }
    assert.deepEqual([...f.errors, ...g.errors, ...h.errors], []);
  } finally { f.dom.window.close(); g?.dom.window.close(); h?.dom.window.close(); }
});

test('practice mode is unchanged: help, skip, timer button and feedback after each answer', () => {
  const f = fixture(); try {
    f.$('behaviouralNav').click(); assert(q(f, '[name=bhStyle][value=practice]').checked, 'practice is the default'); f.$('bhStart').click();
    for (const id of ['bhSkip', 'bhTimerBtn', 'bhMeter']) assert(f.$(id), id); assert(q(f, '.flow-help')); assert.equal(f.$('bhExit').textContent, 'Exit · progress is saved');
    input(f, f.$('bhAnswer'), 'I did it.'); f.$('bhFinish').click(); const s = state(f);
    assert.equal(s.screen, 'review'); assert.equal(s.set.strict, undefined); assert.equal('followUps' in s.attempts[0], false); assert.equal(s.draft, null);
    f.run('Behavioural.beat()'); assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});
