const test = require('node:test'), assert = require('node:assert/strict');
const { fixture } = require('./dom.cjs');
const doc = f => f.w.document;
const current = f => [...doc(f).querySelectorAll('nav [aria-current=page]')].map(b => b.id);

test('the home page is short: a plan button and five rounds in order, with no case list', () => {
  const f = fixture(); try {
    assert.equal(f.run('view'), 'home');
    assert.equal(doc(f).querySelectorAll('#app [data-start]').length, 0, 'cases are not listed on the home page');
    assert.equal(f.$('library'), null);
    assert.equal(doc(f).querySelectorAll('#app button').length, 12, 'plan, five rounds, the technical-round link, four moves and the link to all moves');
    assert.equal(f.$('homePlan').textContent, 'Plan my prep →'); assert(f.$('homePlan').classList.contains('primary'));
    assert.deepEqual([...doc(f).querySelectorAll('.round-tile b')].map(b => b.textContent),
      ['Résumé shortlisting', 'Online aptitude test', 'Group discussion', 'Case or guesstimate interview', 'HR interview']);
    assert(doc(f).querySelector('.home-how'), 'a new visitor sees how it works instead of an empty Continue list');
    assert.equal(doc(f).querySelector('.home-continue'), null);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('each round tile opens that round in one click', () => {
  const f = fixture(); try {
    const expect = { resume: ['resume', '#resume'], aptitude: ['aptitude', '#aptitude'], gd: ['gd', '#gd'], case: ['cases', '#cases'], hr: ['behavioural', '#behavioural'] };
    for (const [id, [view, hash]] of Object.entries(expect)) {
      f.$('homeNav').click(); f.$('round-' + id).click();
      assert.equal(f.run('view'), view, id); assert.equal(f.w.location.hash, hash, id);
    }
    f.$('homeNav').click(); f.$('round-gd').click(); assert.equal(f.run('view'), 'gd'); assert(f.$('gdAlone'), 'the GD tile opens the kit');
    f.$('gdAlone').click(); assert(doc(f).querySelector('[name=nrRound][value=gd]').checked, 'practising alone goes to the GD round of the planner');
    f.$('homeNav').click(); const tile = f.$('round-gd');
    assert.match(tile.textContent, /A timed discussion for three to six of you, with briefs, an observer’s tally and a printable kit\./); assert.equal(tile.querySelector('.round-tag'), null, 'the Tips only tag is gone'); assert.doesNotMatch(tile.textContent, /Tips only|not here yet/);
    f.$('homeNav').click(); f.$('homeTechnical').click(); assert(doc(f).querySelector('[name=nrRound][value=technical]').checked); assert.match(f.$('nrNote').textContent, /does not cover coding/);
    f.$('homeNav').click(); f.$('round-case').click();
    assert.equal(doc(f).querySelectorAll('#library .card').length, 12, 'the case page holds the library'); assert(f.$('caseTool-warmup') && f.$('caseTool-drill') && f.$('caseTool-peer'));
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('"Continue where you left off" lists unfinished work and goes straight back to it', () => {
  const f = fixture(); try {
    f.run("start('cement')"); f.$('answer').value = 'Half-written answer'; f.$('answer').dispatchEvent(new f.w.Event('input'));
    f.run("NextRoundTool.go('apt-mock-short')");
    f.run('NextRoundTool.open()'); const r = doc(f).querySelector('[name=nrRound][value=hr]'); r.checked = true; r.dispatchEvent(new f.w.Event('change', { bubbles: true }));
    f.$('homeNav').click();
    const items = [...doc(f).querySelectorAll('[data-continue]')].map(b => b.dataset.continue);
    assert.deepEqual(items, ['case', 'aptitude', 'plan']); assert.equal(doc(f).querySelector('.home-how'), null);
    assert.match(doc(f).querySelector('[data-continue=case]').textContent, /The disappearing margin.*Stage 1 of 8/s);
    assert.match(doc(f).querySelector('[data-continue=aptitude]').textContent, /Timed mock test.*Question 1 of 15/s);
    doc(f).querySelector('[data-continue=case]').click(); assert.equal(f.run('view'), 'session'); assert.equal(f.$('answer').value, 'Half-written answer');
    f.$('homeNav').click(); doc(f).querySelector('[data-continue=plan]').click(); assert.equal(f.run('view'), 'next-round');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('an unfinished group discussion is listed under Continue and goes straight back to it', () => {
  const f = fixture(); try {
    f.run('GDTool.open()'); f.run("document.querySelector('[data-gd-pick=library]').click()");
    ['Asha', 'Ben', 'Chitra'].forEach((n, i) => { const el = f.$('gdName' + i); el.value = n; el.dispatchEvent(new f.w.Event('input')); });
    f.$('gdStart').click(); assert.equal(f.run('GDTool.state().run.phase'), 'prepare');
    f.$('homeNav').click();
    const item = doc(f).querySelector('[data-continue=gd]'); assert(item, 'listed'); assert.match(item.textContent, /Group discussion.*A library open till midnight.*Reading the brief/s);
    f.run("GDTool.state().run.phase = 'discuss'"); f.$('homeNav').click(); assert.match(doc(f).querySelector('[data-continue=gd]').textContent, /Discussing now/);
    doc(f).querySelector('[data-continue=gd]').click(); assert.equal(f.run('view'), 'gd'); assert.equal(f.run('GDTool.state().screen'), 'discuss');
    f.$('gdQuit').click(); f.$('homeNav').click(); assert.equal(doc(f).querySelector('[data-continue=gd]'), null, 'gone once it is quit');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('the navigation follows the rounds and marks where you are', () => {
  const f = fixture(); let g; try {
    assert.deepEqual([...doc(f).querySelectorAll('nav button')].map(b => b.id).slice(0, 7), ['homeNav', 'planNav', 'resumeNav', 'aptitudeNav', 'casesNav', 'behaviouralNav', 'historyNav']);
    const settle = () => new Promise(r => setTimeout(r, 0));
    return (async () => {
      await settle(); assert.deepEqual(current(f), ['homeNav']);
      f.$('planNav').click(); await settle(); assert.deepEqual(current(f), ['planNav']);
      f.$('casesNav').click(); await settle(); assert.deepEqual(current(f), ['casesNav']);
      f.$('caseTool-drill').click(); await settle(); assert.deepEqual(current(f), ['casesNav'], 'the drill belongs to the case round');
      f.$('behaviouralNav').click(); await settle(); assert.deepEqual(current(f), ['behaviouralNav']);
      f.$('historyNav').click(); await settle(); assert.deepEqual(current(f), ['historyNav']);
      f.run('GDTool.open()'); await settle(); assert.deepEqual(current(f), ['homeNav'], 'the group discussion has no nav button of its own, so Home stays marked');
      doc(f).querySelector('.brand').click(); await settle(); assert.deepEqual(current(f), ['homeNav']); assert.equal(f.run('view'), 'home');
      g = fixture({ url: 'https://case.example/#cases' }); assert.equal(g.run('view'), 'cases'); assert(g.$('library'));
      assert.deepEqual(f.errors, []); assert.deepEqual(g.errors, []);
    })().finally(() => { f.dom.window.close(); g?.dom.window.close(); });
  } catch (e) { f.dom.window.close(); throw e; }
});
