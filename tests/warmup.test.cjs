const test = require('node:test'), assert = require('node:assert/strict');
const { WARMUP: W, parseAmount, judge } = require('../content/warmup.js');
const { fixture } = require('./dom.cjs');
const type = (f, id, value) => { const el = f.$(id); el.value = value; el.dispatchEvent(new f.w.Event('input', { bubbles: true })); };
const step = id => W.steps.find(s => s.id === id);

test('the warm-up figures add up', () => {
  const { lastYear: L, thisYear: T } = W.fest;
  const lastRevenue = L.tickets * L.price, revenue = T.earlyTickets * T.earlyPrice + T.fullTickets * T.fullPrice, tickets = T.earlyTickets + T.fullTickets;
  assert.equal(lastRevenue, 900000); assert.equal(revenue, 840000); assert.equal(tickets, 2400);
  assert.equal(lastRevenue - L.costs, 300000); assert.equal(revenue - T.costs, 240000);
  assert.equal(revenue / tickets, step('calc').answer);
  assert.match(W.brief, /2,400 tickets.*1,800/);
  assert.match(step('clarify').reply, /₹3\.0 lakh.*₹2\.4 lakh.*about ₹6 lakh/);
  assert.match(step('number').reply, /1,800 tickets sold at ₹300 and 600 at the full ₹500/);
  assert.match(step('calc').example, /fell by ₹60,000/); assert.match(step('recommend').example, /₹500 to ₹350/);
  assert.equal(W.steps.length, 4); assert.deepEqual(W.steps.map(s => s.id), ['clarify', 'number', 'calc', 'recommend']);
  for (const s of W.steps) assert(s.prompt && s.example && s.why && s.hint && s.maps, s.id);
});

test('typed amounts are read and the calculation is judged, with specific help for common mistakes', () => {
  for (const [text, n] of [['350', 350], ['₹350', 350], ['Rs. 350/-', 350], ['8,40,000 / 2,400 = 350', 350], ['350.00', 350], ['about 349.5', 349.5], ['', null], ['no idea', null]]) assert.equal(parseAmount(text), n, text);
  const calc = step('calc');
  assert.equal(judge(calc, '₹350').status, 'correct'); assert.equal(judge(calc, '351').status, 'correct');
  assert.match(judge(calc, '400').message, /simple average/);
  assert.match(judge(calc, '8,40,000').message, /total revenue/);
  assert.match(judge(calc, '8.4 lakh').message, /in lakh/);
  assert.match(judge(calc, '300').message, /Not quite/);
  assert.equal(judge(calc, 'not sure').status, 'empty');
});

test('a new visitor sees the warm-up beside "Explore the cases" and above the library', () => {
  const f = fixture(); try {
    assert.equal(f.$('warmupHero').parentElement, f.$('begin').parentElement, 'in the same row as "Explore the cases"');
    assert.equal(f.$('warmupHero').textContent, 'New to cases? 10-minute warm-up');
    assert(f.$('warmupBanner')); assert.equal(f.$('warmupBanner').nextElementSibling, f.w.document.querySelector('#library .cards'));
    f.$('warmupBannerStart').click(); assert.equal(f.run('view'), 'warmup'); assert.equal(f.w.location.hash, '#warmup');
    assert.match(f.$('app').textContent, /Your first case, in four small steps/); assert(f.$('wuSkip'));
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('"Skip the walkthrough" goes to the cases and stops showing the library banner', () => {
  const f = fixture(); let g; try {
    f.$('warmupHero').click(); f.$('wuSkip').click();
    assert.equal(f.run('view'), 'home'); assert.equal(f.w.location.hash, ''); assert(f.$('library'));
    assert.equal(f.$('warmupBanner'), null); assert(f.$('warmupHero'), 'the hero button stays for anyone who changes their mind');
    g = fixture({ storage: { 'cr-warmup-seen': f.w.localStorage.getItem('cr-warmup-seen') } });
    assert.equal(g.$('warmupBanner'), null);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); g?.dom.window.close(); }
});

test('the full walkthrough: an answer, then an example and why it helps, at every step', () => {
  const f = fixture(); try {
    let calls = 0; f.w.fetch = () => { calls++; throw Error('Unexpected request'); };
    f.$('warmupHero').click(); f.$('wuStart').click();
    const text = () => f.$('app').textContent;
    // 1. Clarify: an empty answer is not accepted; a typed one is shown with the example and the reply.
    assert.match(text(), /STEP 1 OF 4/); assert(f.w.document.querySelector('.wu-brief').open);
    f.$('wuCheck').click(); assert.match(f.$('wuStatus').textContent, /Write your answer first/); assert.equal(f.$('wuFeedback'), null);
    type(f, 'wuAnswer', 'Do you mean profit <b>or</b> revenue?'); f.$('wuCheck').click();
    assert.equal(f.$('wuAnswer'), null, 'the answer is shown once, in the feedback'); assert.match(f.$('wuFeedback').textContent, /Your answer.*profit <b>or<\/b> revenue/s);
    assert.match(f.$('wuFeedback').textContent, /An example to compare with.*Why it helps.*THE COMMITTEE HEAD REPLIES.*₹2\.4 lakh/s);
    f.$('wuNext').click();
    // 2. One number: the facts so far carry forward; "I'm stuck" shows the example without an answer.
    assert.match(text(), /STEP 2 OF 4/); assert.match(f.w.document.querySelector('.wu-facts').textContent, /₹2\.4 lakh/);
    f.$('wuStuck').click(); assert.match(f.$('wuFeedback').textContent, /You asked to see an example first/); assert.match(f.$('wuFeedback').textContent, /1,800 tickets sold at ₹300/);
    f.$('wuNext').click();
    // 3. Calculation: a known mistake gets its own explanation and the student can try again.
    assert.match(text(), /STEP 3 OF 4/);
    type(f, 'wuAnswer', '400'); f.$('wuCheck').click();
    assert.match(f.$('wuResult').textContent, /simple average/); assert.equal(f.$('wuFeedback'), null); assert.equal(f.$('wuCheck').textContent, 'Check again');
    type(f, 'wuAnswer', '₹350'); f.$('wuCheck').click();
    assert.match(f.$('wuResult').textContent, /Correct: ₹350 per ticket/); assert.match(f.$('wuFeedback').textContent, /₹8,40,000 ÷ 2,400 tickets = ₹350/);
    assert.equal(f.run('WarmupTool.state().run.attempts'), 2);
    f.$('wuNext').click();
    // 4. Recommendation: a 30-second timer, then a self-check that is the student's own judgement.
    assert.match(text(), /STEP 4 OF 4/); assert.equal(f.$('wuClock').textContent, '0:30'); f.$('wuTimer').click(); assert.equal(f.$('wuTimer').textContent, 'Restart timer');
    type(f, 'wuAnswer', 'Cap the early-bird tickets at 600.'); f.$('wuCheck').click();
    const boxes = f.w.document.querySelectorAll('[data-check]'); assert.equal(boxes.length, 4);
    boxes[1].checked = true; boxes[1].dispatchEvent(new f.w.Event('change')); boxes[2].checked = true; boxes[2].dispatchEvent(new f.w.Event('change'));
    f.$('wuNext').click();
    // Done: the mapping to a full case, and a way into the first full case.
    assert.equal(f.run('WarmupTool.state().screen'), 'done'); assert.match(text(), /met 2 of 4 points/); assert.match(text(), /Clarify → Frame/);
    assert.equal(f.w.localStorage.getItem('cr-warmup-seen'), '"done"');
    f.$('wuFull').click(); assert.equal(f.run('view'), 'session'); assert.equal(f.run('session.id'), 'cement');
    f.run('session=null; home()'); assert.equal(f.$('warmupBanner'), null); assert.equal(f.$('warmupHero').textContent, 'Redo the 10-minute warm-up');
    assert.equal(calls, 0); assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('a warm-up in progress survives reload, #warmup opens it, and corrupt storage is ignored', () => {
  const f = fixture(); let g, h; try {
    f.$('warmupHero').click(); f.$('wuStart').click(); type(f, 'wuAnswer', 'Revenue or surplus?'); f.$('wuCheck').click(); f.$('wuNext').click();
    type(f, 'wuAnswer', 'Average price per ticket');
    const storage = {}; for (const k of Object.keys(f.w.localStorage)) storage[k] = f.w.localStorage.getItem(k);
    g = fixture({ url: 'https://case.example/#warmup', storage });
    assert.equal(g.run('view'), 'warmup'); assert.equal(g.$('wuContinue').textContent, 'Continue from step 2 →');
    g.$('wuContinue').click(); assert.equal(g.$('wuAnswer').value, 'Average price per ticket'); assert.match(g.w.document.querySelector('.wu-facts').textContent, /₹2\.4 lakh/);
    // Leaving during step 1 with an answer typed still offers to continue, rather than only starting again.
    const early = fixture({ url: 'https://case.example/#warmup', storage: { 'cr-warmup-run': JSON.stringify({ step: 0, answers: { clarify: 'Revenue or surplus?' }, revealed: {} }) } });
    try { assert.equal(early.$('wuContinue').textContent, 'Continue from step 1 →'); early.$('wuContinue').click(); assert.equal(early.$('wuAnswer').value, 'Revenue or surplus?'); } finally { early.dom.window.close(); }
    h = fixture({ url: 'https://case.example/#warmup', storage: { 'cr-warmup-run': '{"step":99,"answers":"x"}', 'cr-warmup-seen': '"bogus"' } });
    assert.equal(h.run('view'), 'warmup'); assert(h.$('wuStart')); assert.equal(h.$('wuContinue'), null);
    h.$('homeNav').click(); assert(h.$('warmupBanner'));
    for (const x of [f, g, h]) assert.deepEqual(x.errors, []);
  } finally { f.dom.window.close(); g?.dom.window.close(); h?.dom.window.close(); }
});

test('typed answers are shown as text, never as HTML', () => {
  const f = fixture(); try {
    f.$('warmupHero').click(); f.$('wuStart').click();
    type(f, 'wuAnswer', '<img src=x onerror="window.__x=1"><script>window.__x=2</script>'); f.$('wuCheck').click();
    assert.equal(f.w.document.querySelectorAll('#wuFeedback img, #wuFeedback script').length, 0); assert.equal(f.w.__x, undefined);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});
