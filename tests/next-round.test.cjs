const test = require('node:test'), assert = require('node:assert/strict');
const N = require('../content/next-round.js');
const { fixture } = require('./dom.cjs');
const ids = list => list.map(e => e.id);
const pick = (f, name, value) => { const r = f.w.document.querySelector(`[name=${name}][value="${value}"]`); assert(r, `${name}=${value}`); r.checked = true; r.dispatchEvent(new f.w.Event('change', { bubbles: true })); };
const items = f => [...f.w.document.querySelectorAll('#nrItems [data-item]')].map(li => li.dataset.item);

test('every plan for every round, time and role is non-empty, has no repeats and fits the time', () => {
  for (const r of N.ROUNDS) for (const t of N.TIMES) for (const role of N.ROLES) for (const warmupDone of [false, true]) {
    const p = N.plan({ round: r.id, role: role.id, minutes: t.minutes, warmupDone }), label = `${r.id}/${t.minutes}/${role.id}/${warmupDone}`;
    assert(p.length, label); assert.equal(new Set(ids(p)).size, p.length, label);
    assert(p.length === 1 || N.total(p) <= t.minutes, `${label}: ${N.total(p)} min`);
    for (const e of p) assert(N.ITEMS[e.id], `${label}: ${e.id}`);
  }
  assert.deepEqual(N.plan({ round: 'nonsense' }), []);
});

test('plans follow the round, the time and the role', () => {
  assert.deepEqual(ids(N.plan({ round: 'aptitude', minutes: 20 })), ['apt-mock-short'], '20 minutes before an aptitude test: one timed mock');
  assert.deepEqual(ids(N.plan({ round: 'aptitude', minutes: 10 })), ['apt-mixed']);
  assert.deepEqual(ids(N.plan({ round: 'aptitude', minutes: 45 })), ['apt-mock', 'apt-weak']);
  assert.equal(N.plan({ round: 'case', role: 'consulting', minutes: 45 })[0].id, 'case-consulting', 'a consulting candidate with time gets a full case first');
  assert.equal(N.plan({ round: 'case', role: 'analyst', minutes: 45 })[0].id, 'case-analyst');
  assert.equal(N.plan({ round: 'case', role: 'operations', minutes: 90 })[0].id, 'case-operations');
  assert.deepEqual(ids(N.plan({ round: 'case', role: 'consulting', minutes: 90 })).slice(0, 2), ['case-consulting', 'case-guesstimate']);
  assert.equal(N.plan({ round: 'case', minutes: 20 })[0].id, 'warmup', 'a short session before a first case starts with the warm-up');
  assert.equal(N.plan({ round: 'case', minutes: 20, warmupDone: true })[0].id, 'drill-maths');
  assert.deepEqual(ids(N.plan({ round: 'hr', minutes: 10 })), ['bh-intro', 'bh-motivation']);
  assert.deepEqual(ids(N.plan({ round: 'hr', minutes: 20 })), ['bh-intro', 'bh-motivation', 'defence-line']);
  assert.equal(N.plan({ round: 'technical', minutes: 10 })[0].id, 'defence-project', 'a technical round starts from the project defence');
  assert.deepEqual(ids(N.plan({ round: 'resume', minutes: 20 })), ['resume', 'defence-line']);
  assert.equal(N.plan({ round: 'gd', minutes: 20 })[0].id, 'gd-kit', 'the group discussion kit comes first'); assert.deepEqual(ids(N.plan({ round: 'gd', minutes: 20 })), ['gd-kit', 'gd-moves']);
  assert.deepEqual(N.ITEMS['gd-kit'].open, { tool: 'gd' }); assert.equal(N.ITEMS['gd-kit'].minutes, 15); assert.equal(N.ITEMS['gd-kit'].title, 'Run a group discussion with friends');
  assert.match(N.plan({ round: 'gd', minutes: 45 }).find(e => e.id === 'warmup').why, /summarising a group discussion/);
  assert(N.ROUNDS.find(r => r.id === 'technical').outside); assert.match(N.ROUNDS.find(r => r.id === 'technical').note, /does not cover coding/);
  assert.match(N.ROUNDS.find(r => r.id === 'gd').note, /kit needs a group/); assert.match(N.ROUNDS.find(r => r.id === 'gd').note, /build the same skills on your own/); assert.doesNotMatch(N.ROUNDS.find(r => r.id === 'gd').note, /no group-discussion practice/);
  assert.match(N.ROUNDS.find(r => r.id === 'unknown').note, /placement notice/);
});

test('every plan item points at something that exists in the app', () => {
  const f = fixture(); try {
    const cases = JSON.parse(f.run('JSON.stringify(CASES.map(c => ({ id: c.id, title: c.title, minutes: c.minutes })))'));
    for (const [id, it] of Object.entries(N.ITEMS)) {
      assert(it.title && it.why && it.tool && Number.isFinite(it.minutes), id);
      if (it.open.tool === 'case') { const c = cases.find(c => c.id === it.open.caseId); assert(c, id); assert(it.title.endsWith(c.title), `${id} title matches the case`); assert.equal(it.minutes, c.minutes, `${id} minutes match the case`); }
    }
    const views = { aptitude: 'aptitude', drill: 'drill', warmup: 'warmup', case: 'session', peer: 'peer', behavioural: 'behavioural', stories: 'behavioural', resume: 'resume', defence: 'defence', gd: 'gd' };
    for (const [id, it] of Object.entries(N.ITEMS)) {
      if (it.open.tool === 'read') continue;
      f.run('session = null; home()'); f.run(`NextRoundTool.go(${JSON.stringify(id)})`);
      assert.equal(f.run('view'), views[it.open.tool], id);
    }
    f.run('home()'); f.run("NextRoundTool.go('apt-mock-short')");
    assert.equal(f.run('Aptitude.state().run.mode'), 'test'); assert.equal(f.run('Aptitude.state().run.questions.length'), 15); assert.equal(f.w.location.hash, '#aptitude');
    assert.equal(f.run('Aptitude.state().prefs.perSection'), 10, 'saved aptitude preferences are left alone');
    // "Take another" after a planned test repeats the same size, not the saved preference.
    f.$('aptSubmit').click(); f.$('aptAgain').click(); assert.equal(f.run('Aptitude.state().run.questions.length'), 15);
    f.run("NextRoundTool.go('apt-weak')"); assert.equal(f.run('Aptitude.state().run.origin'), 'plan', 'no history yet: a mixed set');
    f.run("NextRoundTool.go('drill-maths')"); assert(f.run('CaseDrill.state().run.questions.every(q => ["percent","change","margin","breakeven","estimate"].includes(q.skill))'));
    f.run("NextRoundTool.go('bh-intro')"); assert.equal(f.run('Behavioural.state().draft.competency'), 'intro');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('acceptance: 20 minutes and an aptitude test tomorrow reaches a relevant timed test in two choices', () => {
  const f = fixture(); try {
    f.$('homePlan').click(); assert.equal(f.run('view'), 'next-round'); assert.equal(f.w.location.hash, '#next-round');
    assert.match(f.$('nrEmpty').textContent, /Choose your next round/);
    assert(f.w.document.querySelector('[name=nrTime][value="20"]').checked, '20 minutes is the default');
    pick(f, 'nrRound', 'aptitude');                                   // choice 1
    assert.deepEqual(items(f), ['apt-mock-short']); assert.match(f.$('nrTotal').textContent, /About 15 minutes/);
    f.w.document.querySelector('[data-go="apt-mock-short"]').click(); // choice 2
    assert.equal(f.run('view'), 'aptitude'); assert.equal(f.run('Aptitude.state().run.mode'), 'test'); assert.equal(f.run('Aptitude.state().run.questions.length'), 15);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('acceptance: a consulting candidate can still go straight to a full case', () => {
  const f = fixture(); try {
    // Two clicks from home without the picker: the case round, then a case.
    f.$('round-case').click(); f.w.document.querySelector('[data-start="cement"]').click(); assert.equal(f.run('session.id'), 'cement');
    f.run('session = null; home()'); f.$('homePlan').click(); pick(f, 'nrRound', 'case'); pick(f, 'nrTime', '45'); pick(f, 'nrRole', 'consulting');
    assert.equal(items(f)[0], 'case-consulting'); assert(f.$('nrAddWarmup'), 'first-timers are offered the warm-up');
    f.w.document.querySelector('[data-go="case-consulting"]').click(); assert.equal(f.run('view'), 'session'); assert.equal(f.run('session.id'), 'cement');
    f.run('session = null'); f.run('NextRoundTool.open()'); f.$('nrCases').click(); assert.equal(f.run('view'), 'cases'); assert(f.w.document.querySelector('[data-start="cement"]'));
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('rounds Case Room does not cover say so, and GD tips open in place', () => {
  const f = fixture(); try {
    f.$('homePlan').click(); pick(f, 'nrRound', 'technical');
    assert(f.$('nrNote').classList.contains('outside')); assert.match(f.$('nrNote').textContent, /does not cover coding/); assert.equal(items(f)[0], 'defence-project'); assert.match(f.$('nrNote').textContent, /project defence is the part of a technical interview you can practise here/);
    pick(f, 'nrRound', 'gd'); assert.match(f.$('nrNote').textContent, /kit needs a group/);
    assert.equal(items(f)[0], 'gd-kit'); f.w.document.querySelector('[data-go="gd-kit"]').click(); assert.equal(f.run('view'), 'gd'); assert.equal(f.w.location.hash, '#gd'); assert(f.w.document.querySelector('.gd-briefs'), 'the planner item opens the kit');
    f.run('NextRoundTool.open()');
    const gd = f.w.document.querySelector('[data-item="gd-moves"]'); assert.equal(gd.querySelector('[data-go]'), null);
    assert.equal(gd.querySelectorAll('.nr-tips li').length, 5);
    pick(f, 'nrRound', 'unknown'); assert.match(f.$('nrNote').textContent, /placement notice/);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('the plan can be edited, ticked off and reset, and it survives reload', () => {
  const f = fixture(); let g, h; try {
    f.$('homePlan').click(); pick(f, 'nrRound', 'hr'); pick(f, 'nrTime', '20');
    assert.deepEqual(items(f), ['bh-intro', 'bh-motivation', 'defence-line']); assert.equal(f.$('nrReset'), null);
    f.w.document.querySelector('[data-remove="defence-line"]').click(); assert.deepEqual(items(f), ['bh-intro', 'bh-motivation']); assert(f.$('nrReset'));
    f.$('nrAdd').value = 'resume'; f.$('nrAddBtn').click(); assert.deepEqual(items(f), ['bh-intro', 'bh-motivation', 'resume']);
    f.$('nrAdd').value = 'case-consulting'; f.$('nrAddBtn').click(); assert.match(f.$('nrTotal').textContent, /About 60 minutes, more than the 20 you have/);
    const done = f.w.document.querySelector('[data-done="bh-intro"]'); done.checked = true; done.dispatchEvent(new f.w.Event('change'));
    assert(f.w.document.querySelector('[data-item="bh-intro"]').classList.contains('done')); assert.match(f.$('nrTotal').textContent, /1 of 4 done/);
    const storage = {}; for (const k of Object.keys(f.w.localStorage)) storage[k] = f.w.localStorage.getItem(k);
    g = fixture({ storage }); const cont = g.w.document.querySelector('[data-continue="plan"]');
    assert.match(cont.textContent, /HR or behavioural interview.*1 of 4 done/s, 'home lists the plan under Continue'); cont.click(); assert.deepEqual(items(g), ['bh-intro', 'bh-motivation', 'resume', 'case-consulting']);
    assert(g.w.document.querySelector('[data-done="bh-intro"]').checked); assert(g.w.document.querySelector('[name=nrRound][value="hr"]').checked);
    g.$('nrReset').click(); assert.deepEqual(items(g), ['bh-intro', 'bh-motivation', 'defence-line']); assert.equal(g.$('nrReset'), null);
    h = fixture({ url: 'https://case.example/#next-round', storage: { 'cr-next-round': '{"round":"bogus","items":[{"id":"nope"}],"minutes":7,"role":3}' } });
    assert.equal(h.run('view'), 'next-round'); assert(h.$('nrEmpty')); assert(h.w.document.querySelector('[name=nrTime][value="20"]').checked);
    for (const x of [f, g, h]) assert.deepEqual(x.errors, []);
  } finally { f.dom.window.close(); g?.dom.window.close(); h?.dom.window.close(); }
});
