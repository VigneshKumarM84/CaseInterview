// Blind cases (no title, summary, icon or stage names until the debrief) and typed data requests at the evidence stage.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { fixture } = require('./dom.cjs');
const CaseRequests = require('../src/case-requests.js');
const MODULE = fs.readFileSync(path.join(__dirname, '..', 'src', 'case-requests.js'), 'utf8');
const CASES = new Function(fs.readFileSync(path.join(__dirname, '..', 'content', 'cases.js'), 'utf8') + ';return CASES')();
const byId = id => CASES.find(c => c.id === id);
const DIRTY = /undefined|\bnull\b|NaN|\[object/;

/* The page as index.html builds it, with the request module added when index.html does not load it yet. */
function page(options) { const f = fixture(options); if (!f.w.CaseRequests) f.run(MODULE); return f; }
const doc = f => f.w.document, text = f => f.$('app').textContent;
const type = (f, id, v) => { const e = f.$(id); assert(e, id + ' exists'); e.value = v; e.dispatchEvent(new f.w.Event('input', { bubbles: true })); };
const setBlind = (f, on) => { const t = f.$('blindToggle'); t.checked = on; t.dispatchEvent(new f.w.Event('change', { bubbles: true })); };
const clean = (f, label) => { const t = text(f); assert(!DIRTY.test(t), label + ' has a gap: ' + (t.match(/.{30}(undefined|\bnull\b|NaN|\[object).{20}/) || [])[0]); };
const precise = c => 'I would like the ' + c.exhibits[0].title + ' broken down by period, to see what changed and what it would tell me';
const done = id => ({ id, version: 3, step: 7, started: 1, finished: 2, uid: 'u-' + id, opened: [], answers: {}, probes: [] });
const stored = f => ({ 'cr-session': f.w.localStorage.getItem('cr-session'), 'cr-history': f.w.localStorage.getItem('cr-history'), 'cr-case-blind': f.w.localStorage.getItem('cr-case-blind') });

/* Types a precise request, then opens the first exhibit; the other stages get a plain answer. */
function stage(f, c, branch) {
  const step = f.run('session.step');
  type(f, 'answer', 'Test reasoning');
  if (step === 1) { if (f.$('dataRequest')) { type(f, 'dataRequest', precise(c)); f.$('dataAsk').click(); } doc(f).querySelector('[data-open]').click(); }
  if (step === 3) doc(f).querySelector(`[data-path="${branch}"]`).click();
  if ([2, 4, 5].includes(step)) type(f, 'number', String(f.run('richCalc().openEstimate?1500000:richCalc().answer')));
}
const next = f => f.$('next').click();

test('CaseRequests: a precise request matches the exhibits that share its words, closest first', () => {
  const cement = byId('cement').exhibits;
  let a = CaseRequests.assess('Break fuel and power costs by year, to see which cost line moved', cement);
  assert.equal(a.broad, false); assert.deepEqual(a.matches, ['economics']); assert(a.words >= 6);
  a = CaseRequests.assess('Show me the shipping costs per region over the last year, and what changed', byId('distribution').exhibits);
  assert.equal(a.broad, false); assert.deepEqual(a.matches, ['freight', 'volume']);
  a = CaseRequests.assess('Funnel conversion for the latest week against the previous week, by platform', byId('metricdrop').exhibits);
  assert.equal(a.broad, false); assert.deepEqual(a.matches, ['funnel', 'platform', 'orders'].filter(id => a.matches.includes(id)));
  assert(a.matches.includes('funnel') && a.matches.includes('platform'));
  a = CaseRequests.assess('Which customer segments take the discount, and who is price sensitive here', byId('pricing').exhibits);
  assert.equal(a.broad, false); assert(a.matches.includes('segments'));
  a = CaseRequests.assess('How many customers do we keep each month, and what does retention tell us', byId('market').exhibits);
  assert.deepEqual(a.matches.slice(0, 2).sort(), ['acquisition', 'demand'].sort()); assert(a.matches.includes('segments'));
});

test('CaseRequests: ordered by shared words, then catalogue order', () => {
  const ex = [{ id: 'a', title: 'Cost summary', category: 'Finance' }, { id: 'b', title: 'Market cost drivers', category: 'Market' }, { id: 'c', title: 'Cost and market sizing', category: 'Market' }];
  const r = CaseRequests.assess('What are the market cost drivers in the latest year please', ex);
  assert.deepEqual(r.matches, ['b', 'c', 'a'], 'b shares market, cost and drivers; c shares market and cost; a shares cost');
});

test('CaseRequests: plurals, endings and common synonyms match; filler and generic words do not', () => {
  const ex = [{ id: 'p', title: 'Pricing history', category: 'Commercial' }, { id: 'r', title: 'Revenue by product', category: 'Financials' }, { id: 'k', title: 'Retention curve', category: 'Users' }];
  assert.deepEqual(CaseRequests.assess('I need prices over the last few years for our products', ex).matches.slice(0, 2).sort(), ['p', 'r'].sort());
  assert.deepEqual(CaseRequests.assess('Show me the sales numbers for each product line this year', ex).matches, ['r']);
  assert.deepEqual(CaseRequests.assess('How many users churn after the first month of using it', ex).matches, ['k']);
  assert.deepEqual(CaseRequests.assess('I would like all the data and information and numbers and details please', ex).matches, [], 'generic words match nothing');
  assert.deepEqual(CaseRequests.assess('what the that with from have would could about into there their', ex).matches, [], 'stop words match nothing');
});

test('CaseRequests: broad requests say why, in words a student can act on', () => {
  const cement = byId('cement').exhibits;
  let a = CaseRequests.assess('any data on costs?', cement);
  assert.equal(a.broad, true); assert(a.words < 6); assert.match(a.reason, /six words/i);
  a = CaseRequests.assess('Could you give me all the data you have about the company please', cement);
  assert.equal(a.broad, true); assert.deepEqual(a.matches, []); assert.match(a.reason, /catch-all/i);
  for (const t of ['everything you have on this client, as much as possible, thank you', 'I would like more details about what is happening here', 'What data do you have for me to look at today, please', 'Whatever you have is fine, I will work with it as it comes'])
    assert.equal(CaseRequests.assess(t, cement).broad, true, t);
  a = CaseRequests.assess('I would like the weather forecast for monsoon months in the region', cement);
  assert.equal(a.broad, false); assert.deepEqual(a.matches, []); assert.match(a.reason, /no word/i, 'off-target is not broad, it just matches nothing');
  assert.deepEqual(CaseRequests.assess('', cement), { words: 0, broad: true, reason: 'No request was typed.', matches: [] });
  assert.deepEqual(CaseRequests.assess('   ', cement), { words: 0, broad: true, reason: 'No request was typed.', matches: [] });
  assert.deepEqual(CaseRequests.assess(null, cement).matches, []);
  assert.deepEqual(CaseRequests.assess('fuel costs by year and what they show', undefined).matches, []);
});

test('CaseRequests: every case has a precise request that matches and a catch-all that does not', () => {
  for (const c of CASES) {
    const a = CaseRequests.assess(precise(c), c.exhibits);
    assert.equal(a.broad, false, c.id); assert.equal(a.matches[0], c.exhibits[0].id, c.id + ' matches its first exhibit first');
    assert.equal(CaseRequests.assess('all the data you have on the company, please, and everything else', c.exhibits).matches.length, 0, c.id);
  }
});

test('blind library: no title, company, summary or icon while on; restored exactly when off; remembered', () => {
  const f = page(); try {
    f.run('casesPage()');
    const cards = () => doc(f).querySelector('#library .cards').innerHTML, guided = cards();
    assert(guided.includes(CASES[0].title), 'guided cards name the case');
    assert.equal(f.$('blindToggle').checked, false);
    setBlind(f, true);
    assert.equal(f.w.localStorage.getItem('cr-case-blind'), 'true');
    const lib = f.$('library').textContent;
    for (const c of CASES) for (const bit of [c.title, c.company, c.summary]) assert(!lib.includes(bit), 'blind library shows: ' + bit);
    assert.equal(doc(f).querySelectorAll('#library .case-icon').length, 0, 'no icons');
    CASES.forEach((c, i) => assert(lib.includes('Case ' + String(i + 1).padStart(2, '0')), 'catalogue number ' + (i + 1)));
    assert(lib.includes('Consulting') && lib.includes('Product & analytics')); assert(lib.includes('Foundation') || lib.includes(CASES[0].level)); assert(lib.includes(CASES[0].minutes + ' MIN'));
    assert(![...doc(f).querySelectorAll('#library .card-top')].some(e => /background/.test(e.getAttribute('style') || '')), 'neutral card colour');
    assert(![...doc(f).querySelectorAll('#library [data-blind-start],#library .card')].some(e => /cement|pricing/.test(e.outerHTML.replace(/product|consulting/g, ''))), 'no case id in the blind cards');
    clean(f, 'blind library');
    // The track filter still works.
    doc(f).querySelector('[data-track-filter="product"]').click();
    const shown = [...doc(f).querySelectorAll('#library .card')].filter(c => !c.hidden);
    assert.equal(shown.length, CASES.filter(c => c.track === 'product').length); assert(shown.every(c => /Product & analytics/i.test(c.textContent)));
    doc(f).querySelector('[data-track-filter="all"]').click();
    setBlind(f, false);
    assert.equal(cards(), guided, 'the guided cards come back exactly'); assert.equal(f.w.localStorage.getItem('cr-case-blind'), 'false');
    setBlind(f, true);
    // Remembered after a reload.
    const g = page({ storage: { 'cr-case-blind': 'true' } }); try {
      g.run('casesPage()'); assert.equal(g.$('blindToggle').checked, true); assert(!g.$('library').textContent.includes(CASES[0].title));
      assert.deepEqual(g.errors, []);
    } finally { g.dom.window.close(); }
    // A damaged value counts as off.
    const h = page({ storage: { 'cr-case-blind': '"yes"' } }); try { h.run('casesPage()'); assert.equal(h.$('blindToggle').checked, false); } finally { h.dom.window.close(); }
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('blind cards start the case blind', () => {
  const f = page({ storage: { 'cr-case-blind': 'true' } }); try {
    f.run('casesPage()'); doc(f).querySelector('[data-blind-start="3"]').click();
    assert.equal(f.run('session.id'), CASES[3].id); assert.equal(f.run('session.blind'), true); assert.equal(f.run('view'), 'session');
    // With the switch off a card starts a guided session, which carries no blind flag.
    f.run('session=null;persist();casesPage()'); setBlind(f, false); doc(f).querySelector(`[data-start="${CASES[3].id}"]`).click();
    assert.equal(f.run('session.blind'), undefined); assert(text(f).includes(CASES[3].title));
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('#blindRandom starts a blind case that is not in the history; any case when all are done', () => {
  const ids = CASES.map(c => c.id), left = ids[5];
  const f = page({ storage: { 'cr-history': JSON.stringify(ids.filter(i => i !== left).map(done)) } }); try {
    f.run('casesPage()'); assert(f.$('blindRandom').textContent.includes('Give me a case I have not done'));
    f.$('blindRandom').click(); assert.equal(f.run('session.id'), left); assert.equal(f.run('session.blind'), true); assert.equal(f.run('session.version'), 3);
    assert(!text(f).includes(byId(left).title)); assert.equal(f.w.document.querySelector('h2.section-title').textContent, 'Blind case');
    // The track filter limits the pool: two product cases done, one left.
    f.run('session=null;persist();history=' + JSON.stringify(CASES.filter(c => c.track === 'product').slice(0, 2).map(c => done(c.id))) + ';casesPage()');
    doc(f).querySelector('[data-track-filter="product"]').click(); f.$('blindRandom').click();
    assert.equal(f.run('session.id'), CASES.filter(c => c.track === 'product')[2].id);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
  const g = page({ storage: { 'cr-history': JSON.stringify(ids.map(done)) } }); try {
    g.run('casesPage()'); g.$('blindRandom').click(); assert(ids.includes(g.run('session.id'))); assert.equal(g.run('session.blind'), true);
  } finally { g.dom.window.close(); }
});

test('a blind session never shows the title, company, summary, icon or stage names, in any case, until the report', () => {
  const f = page(); try {
    for (const c of CASES) {
      const r = JSON.parse(f.run(`JSON.stringify(RICH['${c.id}'])`)), names = r.stageNames || f.run('richStages'), branch = r.branches[0].id;
      f.run('session=null'); f.run(`start('${c.id}',true)`);
      for (let i = 0; i < 8; i++) {
        const t = text(f), where = `${c.id} stage ${i + 1}`;
        for (const [what, bit] of [['title', c.title], ['summary', c.summary], ['company', c.company]]) assert(!t.includes(bit), `${where} shows the ${what}`);
        assert(!f.w.document.title.includes(c.title), 'browser title');
        assert.equal(doc(f).querySelector('h2.section-title').textContent, 'Blind case', where);
        assert(doc(f).querySelector('.badge').textContent.includes(`Stage ${i + 1} of 8`), where);
        const side = [...doc(f).querySelectorAll('.sidebar .step')].map(e => e.textContent).join('|'), head = doc(f).querySelector('.flow-head-side .badge').textContent + doc(f).querySelector('h2.section-title').textContent;
        names.forEach((n, k) => { assert(!side.includes(n) && !head.includes(n), `${where} shows stage name "${n}"`); assert(side.includes('Stage ' + (k + 1))); });
        // The "what you know so far" window gives the brief and what was asked, nothing that names the case.
        f.$('review').click(); const m = f.$('modalContent').textContent;
        for (const bit of [c.title, c.summary, c.company, ...names.filter(n => n.length > 6 && !c.brief.includes(n) && !r.branches.some(b => b.title.includes(n)))]) assert(!m.includes(bit), `${where} modal shows "${bit}"`);
        assert(m.includes('What you know so far') && m.includes(c.brief)); f.$('closeModal').click();
        clean(f, where);
        stage(f, c, branch); next(f);
      }
      assert.equal(f.run('view'), 'report'); assert.equal(f.run('report.blind'), true);
      const t = text(f);
      assert(t.includes(`This was a blind attempt. The case was: ${c.title}.`), c.id + ' reveals the case'); assert(t.includes(c.title));
      names.forEach(n => assert(t.includes(n), c.id + ' report names stage ' + n));
      assert(doc(f).querySelector('#app .subtle .attempt-label').textContent === 'Blind');
      assert(f.run('reportText(report)').includes(`This was a blind attempt. The case was: ${c.title}.`));
      clean(f, c.id + ' report');
    }
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('blind and guided attempts are labelled in the report, the history and the text download', () => {
  const f = page(); try {
    const c = byId('cement'), run = blind => { f.run('session=null'); f.run(`start('cement',${blind})`); for (let i = 0; i < 8; i++) { stage(f, c, 'fuel'); next(f); } };
    run(false);
    assert.equal(doc(f).querySelector('#app .subtle .attempt-label').textContent, 'Guided'); assert(!doc(f).querySelector('#blindReveal'));
    assert.match(f.run('reportText(report)'), /^CASE ROOM — The disappearing margin \(Guided\)\n/); assert(!/blind attempt/.test(f.run('reportText(report)')));
    run(true);
    assert.equal(doc(f).querySelector('#app .subtle .attempt-label').textContent, 'Blind'); assert(doc(f).querySelector('#blindReveal'));
    const dl = f.run('reportText(report)'); assert.match(dl, /^CASE ROOM — The disappearing margin \(Blind\)\n/); assert(dl.includes('This was a blind attempt. The case was: The disappearing margin.'));
    assert(f.run('aiPacket(report)').includes('ATTEMPT: Blind')); assert(f.run('aiPacket(history[1])').includes('ATTEMPT: Guided'));
    f.$('historyNav').click(); const labels = [...doc(f).querySelectorAll('.history-row .attempt-label')].map(e => e.textContent);
    assert.deepEqual(labels, ['Blind', 'Guided']); clean(f, 'history');
    // An attempt saved before any of this existed reads as guided.
    f.run("history.push({id:'cement',version:2,step:3,started:1000,finished:2000,opened:[],answers:{number:30},probes:[],uid:'old'});showHistory()");
    assert.equal([...doc(f).querySelectorAll('.history-row .attempt-label')].pop().textContent, 'Guided');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('caseLabel names a session without giving a blind one away', () => {
  const f = page(); try {
    assert.equal(f.run("caseLabel({id:'cement'})"), 'The disappearing margin');
    assert.equal(f.run("caseLabel({id:'cement',blind:true})"), 'Blind case');
    assert.equal(f.run("caseLabel({id:'cement',blind:true,finished:5})"), 'The disappearing margin');
    assert.equal(f.run("caseLabel({id:'cement',blind:false})"), 'The disappearing margin');
  } finally { f.dom.window.close(); }
});

test('a blind session resumes blind after a reload; a stored session without the flag is guided; legacy sessions cannot be blind', () => {
  const f = page(); try {
    f.run("start('pricing',true)"); type(f, 'answer', 'My structure'); next(f); assert.equal(f.run('session.step'), 1);
    const keep = stored(f), g = page({ storage: keep }); try {
      assert.equal(g.run('session.blind'), true); assert.equal(g.run('session.step'), 1);
      g.run('casesPage()'); g.$('resume').click();
      assert.equal(doc(g).querySelector('h2.section-title').textContent, 'Blind case'); assert(!text(g).includes(byId('pricing').title));
      assert.equal(g.$('answer').value, '', 'stage 2 starts empty'); assert.deepEqual(g.errors, []);
    } finally { g.dom.window.close(); }
    const old = JSON.parse(keep['cr-session']); delete old.blind;
    const h = page({ storage: { 'cr-session': JSON.stringify(old) } }); try {
      h.run('renderSession()'); assert.equal(doc(h).querySelector('h2.section-title').textContent, byId('pricing').title); assert.equal(h.run('session.blind'), undefined);
    } finally { h.dom.window.close(); }
    for (const bad of [{ version: 2, blind: true }, { version: 3, blind: 'yes' }, { version: 3, blind: 1 }]) {
      const s = { ...old, ...bad, step: 0, answers: {} }, k = page({ storage: { 'cr-session': JSON.stringify(s) } }); try {
        assert.equal(k.run('session.blind'), undefined, JSON.stringify(bad)); k.run('renderSession()'); assert(text(k).includes(bad.version === 2 ? 'four-stage' : byId('pricing').title));
      } finally { k.dom.window.close(); }
    }
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('the request box comes before the menu; a precise request lists the closest exhibits first, tagged, and opens nothing', () => {
  const f = page(); try {
    const c = byId('cement'); f.run("start('cement')"); type(f, 'answer', 'Structure'); next(f);
    assert.equal(f.run('session.step'), 1);
    assert.match(doc(f).querySelector('label[for="dataRequest"]').textContent, /^Before you see what is available: what data do you want, and what would it tell you\?$/);
    assert.equal(f.$('dataRequest').tagName, 'TEXTAREA'); assert.equal(f.$('dataAsk').textContent, 'Ask for it →'); assert(f.$('dataAsk').classList.contains('primary'));
    assert.equal(f.$('dataSkip').textContent, 'I am not sure. Show me what is available'); assert.equal(f.$('dataReply').getAttribute('role'), 'status');
    assert(text(f).includes('The app matches words in your request to the titles of what is available. It does not understand the request.'));
    assert.equal(doc(f).querySelectorAll('[data-open]').length, 0, 'no menu yet');
    for (const e of c.exhibits) assert(!text(f).includes(e.title), 'the box does not list ' + e.title);
    // Next without a request says what to do.
    type(f, 'answer', 'Structure'); next(f); assert.match(f.$('flowHint').textContent, /Ask for the data you want first/); assert.equal(f.run('session.step'), 1);
    clean(f, 'request box');
    type(f, 'dataRequest', 'Please break fuel and power costs down by year, to see which cost line moved');
    f.$('dataAsk').click();
    assert.equal(f.$('dataRequest'), null); const titles = [...doc(f).querySelectorAll('.exhibit h3')].map(e => e.textContent);
    assert.equal(titles[0], 'Revenue & cost bridge'); assert.equal(titles.length, c.exhibits.length);
    assert.deepEqual([...doc(f).querySelectorAll('.match-tag')].map(e => e.textContent), ['Closest to what you asked for']);
    assert.equal(doc(f).querySelector('.exhibit.matched h3').textContent, 'Revenue & cost bridge');
    assert.equal(f.run('session.opened.length'), 0, 'nothing is opened for the student');
    assert.equal(f.$('dataNone'), null);
    assert.deepEqual(JSON.parse(f.run('JSON.stringify(session.dataRequest)')), { attempts: [{ text: 'Please break fuel and power costs down by year, to see which cost line moved', broad: false, matched: ['economics'] }], skipped: false, revealed: true, draft: '' });
    // Requesting still works as it did, and the modal menu keeps the order.
    doc(f).querySelector('[data-open]').click(); assert.equal(f.run('session.opened.length'), 1); assert(text(f).includes('Request #1'));
    f.$('review'); type(f, 'answer', 'Fuel'); next(f); f.$('moreEvidence').click(); assert.equal(doc(f).querySelector('#modal .exhibit h3').textContent, 'Revenue & cost bridge'); f.$('closeModal').click();
    clean(f, 'menu'); assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('a broad request gets one interviewer reply and one more try; the second attempt always moves on', () => {
  const f = page(); try {
    f.run("start('cement')"); type(f, 'answer', 'Structure'); next(f);
    type(f, 'dataRequest', 'any data on costs?'); f.$('dataAsk').click();
    assert(f.$('dataRequest'), 'the box stays'); assert(f.$('dataReply').textContent.includes('That is broad. Which data, cut how (by product, region, period or cost line), and what would it tell you?'));
    assert.equal(doc(f).querySelectorAll('[data-open]').length, 0); assert.equal(f.$('dataRequest').value, 'any data on costs?', 'the words stay to be improved');
    assert.equal(f.run('session.dataRequest.attempts.length'), 1); assert.equal(f.run('session.dataRequest.attempts[0].broad'), true); assert.equal(f.run('session.dataRequest.revealed'), false);
    // The reply survives a reload.
    const g = page({ storage: stored(f) }); try { g.run('renderSession()'); assert(g.$('dataReply').textContent.includes('That is broad.')); assert.equal(g.$('dataRequest').value, 'any data on costs?'); } finally { g.dom.window.close(); }
    type(f, 'dataRequest', 'all the data'); f.$('dataAsk').click();
    assert.equal(f.$('dataRequest'), null, 'the second attempt always moves on'); assert(doc(f).querySelectorAll('[data-open]').length > 0);
    assert.equal(f.run('session.dataRequest.attempts.length'), 2); assert.equal(f.run('session.dataRequest.attempts[1].broad'), true);
    assert.equal(f.run('session.dataRequest.attempts[0].matched.length>0'), true, 'the first try matched cost');
    assert(f.$('dataNone') === null, 'costs from the first attempt still count as matches');
    assert.equal(doc(f).querySelector('.exhibit h3').textContent, 'Revenue & cost bridge');
    // An empty box asks for words instead of moving on.
    f.run("session=null;start('cement')"); type(f, 'answer', 'Structure'); next(f); f.$('dataAsk').click();
    assert(f.$('dataRequest')); assert.equal(f.run('session.dataRequest'), undefined); assert.match(f.$('flowHint').textContent, /Type what data you want/);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('skipping shows the menu with no tags and records the skip; nothing matched says so plainly', () => {
  const f = page(); try {
    f.run("start('cement')"); type(f, 'answer', 'Structure'); next(f);
    f.$('dataSkip').click(); assert.equal(f.$('dataRequest'), null); assert(doc(f).querySelectorAll('[data-open]').length > 0);
    assert.equal(doc(f).querySelectorAll('.match-tag').length, 0); assert.equal(f.$('dataNone'), null);
    assert.equal(f.run('session.dataRequest.skipped'), true); assert.equal(f.run('session.dataRequest.attempts.length'), 0);
    f.run("session=null;start('cement')"); type(f, 'answer', 'Structure'); next(f);
    type(f, 'dataRequest', 'I would like the weather forecast for the monsoon months in this region'); f.$('dataAsk').click();
    assert.equal(f.$('dataNone').textContent, 'Nothing here matches those words. This is what the client can share.');
    assert.equal(doc(f).querySelectorAll('.match-tag').length, 0); assert.deepEqual([...doc(f).querySelectorAll('.exhibit h3')].map(e => e.textContent), byId('cement').exhibits.map(e => e.title), 'catalogue order');
    assert.equal(f.run('session.dataRequest.attempts[0].broad'), false); assert.deepEqual([...f.run('session.dataRequest.attempts[0].matched')], []);
    clean(f, 'nothing matched'); assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('once the menu has been shown it stays: reload, going forward and going back a stage', () => {
  const f = page(); try {
    f.run("start('cement')"); type(f, 'answer', 'Structure'); next(f);
    type(f, 'dataRequest', 'Please break fuel and power costs down by year, to see which cost line moved'); type(f, 'dataRequest', f.$('dataRequest').value); f.$('dataAsk').click();
    doc(f).querySelector('[data-open]').click(); type(f, 'answer', 'Fuel went up'); next(f); assert.equal(f.run('session.step'), 2);
    f.$('back').click(); assert.equal(f.run('session.step'), 1); assert.equal(f.$('dataRequest'), null); assert(doc(f).querySelectorAll('.exhibit').length > 0);
    assert.equal(doc(f).querySelector('.exhibit h3').textContent, 'Revenue & cost bridge'); assert(doc(f).querySelector('.match-tag'));
    const g = page({ storage: stored(f) }); try {
      g.run('renderSession()'); assert.equal(g.$('dataRequest'), null); assert(g.run('session.dataRequest.revealed')); assert(doc(g).querySelector('.match-tag'));
      assert(text(g).includes('Please break fuel and power costs down by year')); assert.deepEqual(g.errors, []);
    } finally { g.dom.window.close(); }
    // A reload after a skip with nothing opened also keeps the menu.
    f.run("session=null;start('cement')"); type(f, 'answer', 'Structure'); next(f); f.$('dataSkip').click();
    const h = page({ storage: stored(f) }); try { h.run('renderSession()'); assert.equal(h.$('dataRequest'), null); assert(doc(h).querySelectorAll('[data-open]').length > 0); } finally { h.dom.window.close(); }
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('the request and its outcome appear in the report, the download and the AI package', () => {
  const f = page(); try {
    const c = byId('cement'); f.run("start('cement')");
    for (let i = 0; i < 8; i++) { if (i === 1) { type(f, 'answer', 'Reasoning'); type(f, 'dataRequest', 'any data on costs?'); f.$('dataAsk').click(); type(f, 'dataRequest', 'Please break fuel and power costs down by year, to see which cost line moved'); f.$('dataAsk').click(); doc(f).querySelector('[data-open="operations"]').click(); } stage(f, c, 'fuel'); next(f); }
    assert.equal(f.run('view'), 'report'); const sec = f.$('dataRequestReport'); assert(sec, 'report section');
    assert(sec.textContent.includes('Your data request') || sec.textContent.includes('YOUR DATA REQUEST'));
    assert(sec.textContent.includes('any data on costs?') && sec.textContent.includes('Please break fuel and power costs'));
    assert(sec.textContent.includes('the interviewer called it broad')); assert(sec.textContent.includes('Matched: Revenue & cost bridge'));
    assert(sec.textContent.includes('Actually opened, in order: Plant performance'), 'what was opened is shown against what matched');
    assert(sec.textContent.includes('Did your request name the cut you wanted and what it would tell you?'));
    assert(sec.textContent.includes('does not understand the request'));
    const dl = f.run('reportText(report)'); for (const bit of ['YOUR DATA REQUEST', 'Request 1 (the interviewer called it broad): any data on costs?', 'Matched: Revenue & cost bridge', 'Actually opened, in order: Plant performance', 'Self-check question: Did your request name the cut you wanted and what it would tell you?']) assert(dl.includes(bit), 'download: ' + bit);
    const pk = f.run('aiPacket(report)'); for (const bit of ['CANDIDATE DATA REQUEST', 'any data on costs?', 'Matched: Revenue & cost bridge', 'Actually opened, in order: Plant performance', 'did not understand the request']) assert(pk.includes(bit), 'package: ' + bit);
    f.run('showReport(history[0])'); clean(f, 'report');
    // A skipped request is reported as a skip; a session without any request has no section.
    f.run("session=null;start('cement')"); for (let i = 0; i < 8; i++) { if (i === 1) { type(f, 'answer', 'R'); f.$('dataSkip').click(); } stage(f, c, 'fuel'); next(f); if (i === 1 && f.run('session.step') !== 2) doc(f).querySelector('[data-open]'); }
    assert.equal(f.run('view'), 'report'); assert(f.$('dataRequestReport').textContent.includes('without a further request')); assert(f.run('reportText(report)').includes('chose to see what was available'));
    f.run("history[0].dataRequest=undefined;showReport(history[0])"); assert.equal(f.$('dataRequestReport'), null); assert(!f.run('reportText(history[0])').includes('YOUR DATA REQUEST'));
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('legacy and older sessions that already opened an exhibit go straight to the menu', () => {
  const f = page(); try {
    f.run("session={id:'cement',version:2,step:1,started:Date.now(),opened:[],answers:{},probes:[]};renderSession()");
    assert.equal(f.$('dataRequest'), null); assert(doc(f).querySelectorAll('[data-open]').length > 0); assert.doesNotMatch(text(f), /Closest to what you asked/);
    f.run("session={id:'cement',version:3,step:1,started:Date.now(),opened:['economics'],answers:{},probes:[],hints:[],clarified:[],events:[]};renderSession()");
    assert.equal(f.$('dataRequest'), null); assert(doc(f).querySelectorAll('[data-open]').length > 0); assert(text(f).includes('Request #1')); assert.equal(doc(f).querySelectorAll('.match-tag').length, 0);
    // A stored version-3 session on that stage with nothing opened and no request sees the box.
    f.run("session={id:'cement',version:3,step:1,started:Date.now(),opened:[],answers:{},probes:[],hints:[],clarified:[],events:[]};renderSession()"); assert(f.$('dataRequest'));
    // Damaged stored requests are cleaned on load.
    const bad = { id: 'cement', version: 3, step: 1, started: 1, opened: [], answers: {}, probes: [], dataRequest: { attempts: [{ text: 'fuel costs by year please now', broad: 'maybe', matched: ['economics', 'nope', 7] }, { text: '' }, 5, null, { text: 'a' }, { text: 'b' }], skipped: 'yes', revealed: 'x', draft: 9 } };
    const g = page({ storage: { 'cr-session': JSON.stringify(bad) } }); try {
      assert.deepEqual(JSON.parse(g.run('JSON.stringify(session.dataRequest)')), { attempts: [{ text: 'fuel costs by year please now', broad: false, matched: ['economics'] }, { text: 'a', broad: false, matched: [] }], skipped: false, revealed: true, draft: '' });
      g.run('renderSession()'); assert.equal(g.$('dataRequest'), null); assert.deepEqual(g.errors, []);
    } finally { g.dom.window.close(); }
    const v2 = page({ storage: { 'cr-session': JSON.stringify({ ...bad, version: 2 }) } }); try { assert.equal(v2.run('session.dataRequest'), undefined); } finally { v2.dom.window.close(); }
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('without the request module loaded the menu is shown straight away', () => {
  const f = fixture(); try {
    f.run('delete window.CaseRequests'); f.run("start('cement')"); type(f, 'answer', 'Structure'); next(f);
    assert.equal(f.$('dataRequest'), null); assert(doc(f).querySelectorAll('[data-open]').length > 0); assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('the optional AI panels sit beside the request box, and the box does not call the server', async () => {
  const f = page(); try {
    let calls = 0; f.w.fetch = () => { calls++; throw Error('Unexpected request'); };
    f.$('aiSettings').click(); f.$('aiModel').value = 'test-model'; f.$('aiKey').value = 'test-key-not-a-real-key'; f.$('aiConsent').checked = true; f.$('aiSave').click();
    f.run("start('cement')"); type(f, 'answer', 'Structure'); next(f);
    assert(f.$('dataRequest') && f.$('naturalQuestion') && f.$('askInformation'), 'both are on the screen');
    type(f, 'answer', 'Fuel'); type(f, 'dataRequest', 'any data on costs?'); f.$('dataAsk').click(); type(f, 'dataRequest', 'all the data'); f.$('dataAsk').click();
    assert.equal(calls, 0); assert(f.$('naturalQuestion')); assert.equal(f.$('answer').value, 'Fuel'); assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('the peer guide and the printable sheet tell the interviewer to ask what data the candidate wants', () => {
  const f = page(); try {
    const want = 'Ask what data they want before you offer anything. A broad request (“any data on costs?”) earns the names of what exists. A precise one (the cut they want and what it would tell them) earns the exhibit.';
    f.run("PeerMock.start('cement')"); doc(f).querySelector('[data-peer-stage="1"]').click();
    assert(f.$('app').textContent.includes(want), 'guide, stage 2'); clean(f, 'peer guide');
    doc(f).querySelector('[data-peer-stage="0"]').click(); assert(!f.$('app').textContent.includes('Ask what data they want'), 'only at the exhibit stage');
    for (const c of CASES) { f.run(`PeerMock.sheet('${c.id}')`); const t = f.$('app').textContent; assert(t.includes(want), c.id + ' sheet'); assert(!doc(f).querySelector('.peer-handout').textContent.includes('Ask what data'), 'not on the candidate handout'); clean(f, c.id + ' sheet'); }
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('outside the case screen: the home page does not name an unfinished blind case, and a case named by the plan or the warm-up is never blind', () => {
  const f = page(); try {
    const c = byId('cement');
    f.w.confirm = () => true; f.run("start('cement', true)"); assert.equal(f.run('session.blind'), true);
    f.$('homeNav').click(); const row = [...doc(f).querySelectorAll('#app button, #app li, #app a')].find(x => /Stage 1 of 8/.test(x.textContent));
    assert(row, 'the unfinished case is listed under Continue'); assert.match(row.textContent, /Blind case/); assert(!text(f).includes(c.title), 'the home page does not give the title away');
    // With blind mode switched on, a case the plan names by its title still starts guided.
    f.w.localStorage.setItem('cr-case-blind', 'true');
    const g = page({ storage: { 'cr-case-blind': 'true' } }); try {
      g.w.confirm = () => true; assert.equal(g.run('blindPref'), true);
      const item = Object.entries(g.run('NextRound.ITEMS')).find(([, v]) => v.open && v.open.tool === 'case'); assert(item, 'the planner has a full-case item');
      g.run(`NextRoundTool.open('case')`); g.run(`(() => { const N = NextRound, o = N.ITEMS[${JSON.stringify(item[0])}].open; start(o.caseId, false); })()`);
      assert.equal(g.run('session.blind'), undefined, 'guided when asked for by name');
      assert.match(fs.readFileSync(path.join(__dirname, '..', 'src', 'next-round.js'), 'utf8'), /start\(o\.caseId, false\)/); assert.match(fs.readFileSync(path.join(__dirname, '..', 'src', 'warmup.js'), 'utf8'), /start\(W\.fullCase\.id, false\)/);
      g.run("start('market')"); assert.equal(g.run('session.blind'), true, 'the library default still follows the switch');
      assert.deepEqual(g.errors, []);
    } finally { g.dom.window.close(); }
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});
