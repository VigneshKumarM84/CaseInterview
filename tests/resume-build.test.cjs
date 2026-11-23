const test = require('node:test'), assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const RB = require('../src/resume-build.js'), W = require('../content/resume-words.js');
const { fixture, settle } = require('./dom.cjs');
const XSS = '<script>window.__x=1</script> and <img src=x onerror="window.__x=2">';
const wait = ms => new Promise(r => setTimeout(r, ms));
const none = () => ({ omit: new Set(), density: 0 });

/* ---------- Logic ---------- */
test('builds a model from the sample résumé: name, contact, sections in order, entries with dates', () => {
  const m = RB.build(W.SAMPLE_RESUME);
  assert.equal(m.name, 'Riya Menon');
  assert.deepEqual(m.contact, { email: 'riya.menon@example.com', phone: '+91 90000 00000', location: 'Bengaluru', links: [] });
  assert.match(m.summary, /^Final-year BBA student/);
  assert.deepEqual(m.sections.map(s => s.type), ['education', 'experience', 'projects', 'responsibility', 'skills']);
  const exp = m.sections.find(s => s.type === 'experience');
  assert.equal(exp.entries[0].title, 'Business Analyst Intern, Kiranakart (quick-commerce start-up)');
  assert.equal(exp.entries[0].dates, 'May 2025 – Jul 2025');
  assert.equal(exp.entries[0].bullets.length, 5);
  assert.equal(exp.entries[1].dates, 'Jun 2024 – Present');
  assert.equal(m.sections[0].entries[0].dates, '2023 – 2026');
  assert.equal(m.sections.find(s => s.type === 'skills').entries[0].bullets[0].text.startsWith('Excel (pivot tables'), true);
  assert(m.sections.every(s => s.entries.every(e => e.bullets.every(b => b.id && b.pin === false && b.hide === false))));
  const ids = m.sections.flatMap(s => [s.id, ...s.entries.flatMap(e => [e.id, ...e.bullets.map(b => b.id)])]);
  assert.equal(new Set(ids).size, ids.length, 'every id is unique');
});

test('points with no headings land in sensible sections', () => {
  const m = RB.build('', ['B.Tech Computer Science, ABC Institute · 2022–2026 · CGPA 8.1', 'Won 2nd place among 40 teams at the college case competition', 'Python, SQL, Excel, Power BI',
    'Data Analyst Intern, Acme Foods · Jun–Aug 2025', '- Built a Power BI dashboard for 40 stores, cutting reporting time by 6 hours a week', '- Cleaned 3,000 rows every week before the review'].join('\n'));
  const of = t => m.sections.find(s => s.type === t);
  assert.deepEqual(m.sections.map(s => s.type), ['education', 'experience', 'achievements', 'skills']);
  assert.equal(of('education').entries[0].title, 'B.Tech Computer Science, ABC Institute');
  assert.equal(of('education').entries[0].dates, '2022 – 2026');
  assert.equal(of('achievements').entries[0].bullets[0].text, 'Won 2nd place among 40 teams at the college case competition');
  assert.equal(of('skills').entries[0].bullets[0].text, 'Python, SQL, Excel, Power BI');
  const job = of('experience').entries[0];
  assert.equal(job.title, 'Data Analyst Intern, Acme Foods'); assert.equal(job.dates, 'Jun – Aug 2025');
  assert.deepEqual(job.bullets.map(b => b.text.split(' ')[0]), ['Built', 'Cleaned']);
});

test('splitLine separates dates from titles in the usual layouts', () => {
  assert.deepEqual(RB.splitLine('A · May 2025 – Jul 2025'), { title: 'A', sub: '', dates: 'May 2025 – Jul 2025' });
  assert.deepEqual(RB.splitLine('Volunteer, Food Bank (2023)'), { title: 'Volunteer, Food Bank', sub: '', dates: '2023' });
  assert.deepEqual(RB.splitLine('B.Tech, X Institute, 2022-2026, CGPA 8.1'), { title: 'B.Tech, X Institute', sub: 'CGPA 8.1', dates: '2022 – 2026' });
  assert.deepEqual(RB.splitLine('Analyst Intern, Kiranakart · May 2025 – Jul 2025 · Remote'), { title: 'Analyst Intern, Kiranakart', sub: 'Remote', dates: 'May 2025 – Jul 2025' });
  assert.deepEqual(RB.splitLine('No dates here'), { title: 'No dates here', sub: '', dates: '' });
});

/** An overlong résumé: three roles of ten bullets, the first three of each strong (a number and a strong verb), the rest weak. */
function longModel(strong = 3, per = 10) {
  const m = RB.empty(); m.name = 'Test Person';
  const s = RB.addSection(m, 'experience');
  for (let i = 0; i < 3; i++) {
    const e = RB.addEntry(m, s, { title: 'Role ' + i, dates: '2025' });
    for (let k = 0; k < per; k++) RB.addBullet(m, e, k < strong ? `Built a dashboard that cut reporting time by ${k + 10}% across ${k + 3} regional teams and was used every week by the finance and operations leads`
      : 'Responsible for various routine reporting tasks and helping the team with different things each week during the year');
  }
  return m;
}
const bulletsOf = m => m.sections.flatMap(s => s.entries.flatMap(e => e.bullets.map(b => ({ b, e, s }))));

test('fit leaves out the weakest bullets first, keeps pinned ones, and never empties an entry', () => {
  const m = longModel(), all = bulletsOf(m);
  all.filter(x => x.e.title === 'Role 1' && x.s).slice(5, 7).forEach(x => { x.b.pin = true; });
  const pinned = new Set(all.filter(x => x.b.pin).map(x => x.b.id));
  all.find(x => x.e.title === 'Role 2').b.hide = true;
  const hidden = all.find(x => x.b.hide).b.id;
  const plan = RB.fit(m, { pages: 1, measure: p => RB.estimate(m, p) });
  assert(plan.fits, 'it fits one page'); assert(plan.dropped.length > 0);
  assert(plan.omit.has(hidden), 'a hidden bullet is always omitted'); assert(!plan.dropped.includes(hidden), 'hidden is not counted as dropped');
  for (const id of pinned) assert(!plan.omit.has(id), 'pinned bullets stay');
  const scoreOf = id => { const x = all.find(y => y.b.id === id); return RB.score(x.b.text, { type: x.s.type, entryIndex: m.sections[0].entries.indexOf(x.e), bulletIndex: x.e.bullets.indexOf(x.b) }); };
  const lowest = RB.ranked(m)[0];
  assert.equal(plan.dropped[0], lowest.id, 'the lowest-ranked bullet goes first');
  for (const id of plan.dropped) assert(scoreOf(id) < RB.WEAK + 3, 'only the weak end is dropped here');
  for (const e of m.sections[0].entries) assert(e.bullets.some(b => !plan.omit.has(b.id)), 'every entry keeps a bullet: ' + e.title);
  assert.equal(plan.density, 1, 'snug spacing is tried before any bullet goes, and tight spacing was not needed');
  for (const id of plan.dropped) { const omit = new Set(plan.omit); omit.delete(id); assert(RB.estimate(m, { omit, density: plan.density }) > 1, 'no dropped bullet could have been put back'); }
});

test('fit tries snug spacing before leaving anything out, and tight spacing only after the weak bullets are gone', () => {
  // All strong and just over a page: no bullet is weak, so the spacing is tightened instead of leaving anything out.
  const strong = longModel(10, 7), p = RB.fit(strong, { pages: 1, measure: q => RB.estimate(strong, q) });
  assert(p.fits); assert.equal(p.dropped.length, 0); assert(p.density > 0);
  // Whatever the mix, a tighter density means every weak bullet that could go has gone.
  for (const [s, per] of [[2, 10], [0, 10], [1, 12], [5, 9]]) {
    const m = longModel(s, per), plan = RB.fit(m, { pages: 1, measure: q => RB.estimate(m, q) });
    if (plan.dropped.length) assert(plan.density >= 1, 'snug spacing comes before dropping bullets');
    if (plan.density < 2) continue;
    for (const e of m.sections[0].entries) {
      const weak = e.bullets.filter(b => !plan.omit.has(b.id) && RB.score(b.text, { type: 'experience' }) < RB.WEAK);
      const visible = e.bullets.filter(b => !plan.omit.has(b.id));
      assert(!weak.length || visible.length === 1, 'a weak bullet survived while spacing was tightened');
    }
  }
  const small = RB.build(W.SAMPLE_RESUME), ok = RB.fit(small, { pages: 1, measure: q => RB.estimate(small, q) });
  assert(ok.fits && ok.dropped.length === 0 && ok.density === 0, 'a résumé that fits is left alone');
  const two = longModel(), p2 = RB.fit(two, { pages: 2, measure: q => RB.estimate(two, q) });
  assert(p2.fits && p2.needed === 2);
});

test('fit reports when it cannot fit, and only hidden bullets are omitted when it already fits', () => {
  const m = RB.empty(), sec = RB.addSection(m, 'experience');
  for (let i = 0; i < 40; i++) RB.addBullet(m, RB.addEntry(m, sec, { title: 'Role ' + i, sub: 'Second line', dates: '2025' }), 'Built a dashboard that cut reporting time by 12% across 5 regional teams');
  const plan = RB.fit(m, { pages: 1, measure: q => RB.estimate(m, q) });
  assert.equal(plan.fits, false); assert.equal(plan.density, 2); assert.equal(plan.dropped.length, 0, 'the only bullet of an entry is never left out');
  const s = RB.build(W.SAMPLE_RESUME); bulletsOf(s)[3].b.hide = true;
  const p = RB.fit(s, { pages: 1, measure: q => RB.estimate(s, q) });
  assert.deepEqual([...p.omit], [bulletsOf(s)[3].b.id]); assert.deepEqual(p.dropped, []);
});

test('restore rejects junk, skips unknown section types and caps lengths', () => {
  for (const bad of [null, undefined, 'x', 5, [], {}, { v: 2, sections: [] }, { v: 1 }, { v: 1, sections: 'no' }]) assert.equal(RB.restore(bad), null);
  const long = 'x'.repeat(5000);
  const m = RB.restore({ v: 1, seq: 'no', name: long, headline: long, summary: long, contact: { email: long, links: [long, '', 5] },
    sections: [{ id: 's1', type: 'hacking', entries: [] }, null, { id: 's2', type: 'experience', title: long, entries: [null, { id: 'e1', title: long,
      bullets: [{ id: 'b1', text: long, pin: 'yes', hide: true }, { id: 'b2', text: 5 }, null].concat(Array.from({ length: 200 }, (_, i) => ({ id: 'z' + i, text: 'ok' }))) }] }] });
  assert.equal(m.name.length, 200); assert.equal(m.headline.length, 300); assert.equal(m.summary.length, 3000); assert.equal(m.contact.email.length, 200);
  assert.deepEqual(m.contact.links, ['x'.repeat(300)]);
  assert.equal(m.sections.length, 1); assert.equal(m.sections[0].type, 'experience'); assert.equal(m.sections[0].title.length, 120);
  const e = m.sections[0].entries[0];
  assert.equal(e.title.length, 300); assert.equal(e.bullets.length, 78, 'capped at 80 items, then the ones without text are dropped'); assert.equal(e.bullets[0].text.length, 600);
  assert.equal(e.bullets[0].pin, false); assert.equal(e.bullets[0].hide, true);
  assert.equal(m.seq, 0);
  const again = RB.restore(JSON.parse(JSON.stringify(RB.build(W.SAMPLE_RESUME))));
  assert.equal(again.name, 'Riya Menon'); assert.equal(again.sections.length, 5);
});

test('the sheet and the text output carry every field, escaped as HTML', () => {
  const m = RB.empty();
  m.name = XSS; m.headline = XSS; m.summary = XSS; m.contact = { email: XSS, phone: XSS, location: XSS, links: [XSS] };
  for (const type of ['education', 'experience', 'skills']) {
    const s = RB.addSection(m, type, XSS), e = RB.addEntry(m, s, { title: XSS, sub: XSS, dates: XSS }); RB.addBullet(m, e, XSS);
  }
  for (const template of ['classic', 'modern', 'compact']) {
    const html = RB.sheetHtml(m, { template });
    assert(!html.includes('<script') && !html.includes('<img'), template + ' has no raw tags');
    assert(html.includes('&lt;script&gt;'));
    const doc = new JSDOM(html).window.document;
    assert.equal(doc.querySelectorAll('script,img').length, 0); assert(doc.querySelectorAll('.rb-sheet').length === 1);
  }
  assert.equal(RB.sheetHtml(m, { template: '"><script>' }).includes('<script>'), false, 'the template id is escaped too');
  const text = RB.toText(m); assert(text.includes(XSS), 'plain text keeps the literal text and is never parsed as HTML');
  assert.equal(RB.sheetHtml(RB.empty()).includes('Your Name'), true);
});

/* ---------- The screen ---------- */
const doc = f => f.w.document;
const preview = f => doc(f).querySelector('.rb-preview');
const sheet = f => doc(f).querySelector('.rb-preview .rb-sheet');
const fire = (f, el, type = 'input') => el.dispatchEvent(new f.w.Event(type, { bubbles: true }));
const bulletRow = (f, startsWith) => [...doc(f).querySelectorAll('#rbSections [data-bid]')].find(r => r.querySelector('textarea').value.startsWith(startsWith));
async function built(f, { resume = W.SAMPLE_RESUME, points = '' } = {}) {
  f.$('resumeNav').click(); f.$('rbTabBuild').click();
  f.$('rbResume').value = resume; f.$('rbPoints').value = points; fire(f, f.$('rbResume')); fire(f, f.$('rbPoints'));
  f.$('rbBuild').click(); await settle();
}

test('the checker has two tabs; the builder opens from them and the nav marks Résumé as current', async () => {
  const f = fixture(); try {
    f.$('resumeNav').click();
    assert.equal(f.run('view'), 'resume'); assert.equal(f.$('rbTabCheck').getAttribute('aria-current'), 'page'); assert.equal(f.$('rbTabBuild').getAttribute('aria-current'), null);
    assert.equal(f.$('rbTabBuild').textContent, 'Build a new résumé');
    f.$('rbTabBuild').click();
    assert.equal(f.run('view'), 'resume-build'); assert.equal(f.w.location.hash, '#resume-build');
    assert.equal(f.$('rbTabBuild').getAttribute('aria-current'), 'page');
    assert(doc(f).querySelector('h1.drill-title em'), 'the headline');
    assert.match(doc(f).querySelector('.eyebrow').textContent, /RÉSUMÉ BUILDER/);
    assert.equal(f.$('rbFromChecker'), null, 'no checker text yet');
    await settle(); assert.deepEqual([...doc(f).querySelectorAll('nav [aria-current=page]')].map(b => b.id), ['resumeNav']);
    f.$('rbTabCheck').click(); assert.equal(f.run('view'), 'resume'); assert.equal(f.w.location.hash, '#resume');
    f.$('homeNav').click(); assert.equal(f.w.location.hash, '');
    f.$('resumeNav').click(); f.$('rbTabBuild').click(); f.$('homeNav').click(); assert.equal(f.w.location.hash, '', 'leaving clears #resume-build');
    assert.deepEqual(f.errors, []);
  } finally { f.w.close(); }
});

test('#resume-build opens the builder; the checker text can be reused', async () => {
  const f = fixture({ url: 'https://case.example/#resume-build' }); try {
    assert.equal(f.run('view'), 'resume-build'); assert(f.$('rbBuild'));
    f.$('rbTabCheck').click(); f.$('rcResume').value = W.SAMPLE_RESUME; fire(f, f.$('rcResume')); f.$('rbTabBuild').click();
    assert(f.$('rbFromChecker')); f.$('rbFromChecker').click(); assert.equal(f.$('rbResume').value, W.SAMPLE_RESUME);
    assert.deepEqual(f.errors, []);
  } finally { f.w.close(); }
});

test('nothing to build from shows an alert; the sample builds an editable résumé with a preview', async () => {
  const f = fixture(); try {
    f.$('resumeNav').click(); f.$('rbTabBuild').click(); f.$('rbBuild').click();
    assert(doc(f).querySelector('#rbError [role=alert]')); assert.equal(f.run('ResumeBuilder.state().stage'), 'input');
    f.$('rbSample').click(); assert.equal(f.$('rbResume').value, W.SAMPLE_RESUME);
    f.$('rbBuild').click(); await settle();
    const s = f.run('ResumeBuilder.state()'); assert.equal(s.stage, 'edit'); assert.equal(s.model.name, 'Riya Menon');
    assert(sheet(f).textContent.includes('Riya Menon')); assert.equal(f.$('rbName').value, 'Riya Menon'); assert.equal(f.$('rbEmail').value, 'riya.menon@example.com');
    assert.match(f.$('rbFitStatus').textContent, /^Fits on one page\./);
    assert.equal(doc(f).querySelectorAll('#rbSections .rb-section').length, 5);
    assert.equal(doc(f).querySelector('.rb-guide'), null, 'no page-break guide when everything fits on one page');
    f.run("ResumeBuilder.state().model.sections.find(s => s.type === 'experience').entries[0].bullets.push(...Array.from({ length: 40 }, (_, i) => ({ id: 'x' + i, text: 'Built a forecasting model for ' + (i + 10) + ' stores, cutting stock-outs by ' + (i + 5) + '% over six weeks', pin: true, hide: false })))");
    doc(f).querySelector('[data-pages="2"]').click();
    assert.match(doc(f).querySelector('.rb-guide').textContent, /Page 2/, 'a guide where the content runs onto page 2');
    doc(f).querySelector('[data-pages="1"]').click();
    assert.equal(doc(f).querySelectorAll('#rbSections .rb-lines [data-bid]').length, 1, 'skills are a plain list of lines');
    assert(doc(f).querySelector('[data-bid] select[data-act=move]').options.length > 5);
    assert.deepEqual(f.errors, []);
  } finally { f.w.close(); }
});

test('template and length choices, and editing the details, update the preview', async () => {
  const f = fixture(); try {
    await built(f);
    assert(sheet(f).classList.contains('rb-t-classic'));
    doc(f).querySelector('[data-template=modern]').click();
    assert(sheet(f).classList.contains('rb-t-modern')); assert.equal(doc(f).querySelector('[data-template=modern]').getAttribute('aria-pressed'), 'true'); assert.equal(doc(f).querySelector('[data-template=classic]').getAttribute('aria-pressed'), 'false');
    doc(f).querySelector('[data-pages="2"]').click();
    assert.equal(doc(f).querySelector('[data-pages="2"]').getAttribute('aria-pressed'), 'true'); assert.equal(f.$('rbFitStatus').textContent, 'Everything fits on one page, so it prints as one page.');
    f.$('rbName').value = 'Riya M. Menon'; fire(f, f.$('rbName'));
    f.$('rbLinks').value = 'linkedin.com/in/riya\ngithub.com/riya'; fire(f, f.$('rbLinks'));
    await wait(400);
    assert(sheet(f).textContent.includes('Riya M. Menon')); assert(sheet(f).textContent.includes('github.com/riya'));
    assert.deepEqual([...f.run('ResumeBuilder.state().model.contact.links')], ['linkedin.com/in/riya', 'github.com/riya']);
    assert.deepEqual(f.errors, []);
  } finally { f.w.close(); }
});

test('Hide removes a bullet from the preview, Pin toggles, and editing a bullet updates the preview after the debounce', async () => {
  const f = fixture(); try {
    await built(f);
    const text = 'Built an Excel model to forecast demand';
    assert(sheet(f).textContent.includes(text));
    const bid = bulletRow(f, text).dataset.bid;
    bulletRow(f, text).querySelector('[data-act=hide]').click();
    let row = doc(f).querySelector(`[data-bid="${bid}"]`);
    assert.equal(row.querySelector('[data-act=hide]').getAttribute('aria-pressed'), 'true'); assert.equal(row.querySelector('[data-act=hide]').textContent, 'Hidden');
    assert(!sheet(f).textContent.includes(text), 'a hidden bullet is not in the preview');
    assert.equal(row.classList.contains('rb-left-out'), false, 'hidden is not "left out to fit"');
    row.querySelector('[data-act=hide]').click();
    assert(sheet(f).textContent.includes(text));
    row = doc(f).querySelector(`[data-bid="${bid}"]`);
    const pin = row.querySelector('[data-act=pin]');
    assert.equal(pin.getAttribute('aria-pressed'), 'false'); assert.equal(pin.title, 'Always keep this on the page'); pin.click();
    assert.equal(doc(f).querySelector(`[data-bid="${bid}"] [data-act=pin]`).getAttribute('aria-pressed'), 'true'); assert.equal(doc(f).querySelector(`[data-bid="${bid}"] [data-act=pin]`).textContent, 'Pinned');
    assert.equal(f.run('ResumeBuilder.state().model.sections[1].entries[0].bullets[1].pin'), true);
    const ta = doc(f).querySelector(`[data-bid="${bid}"] textarea`);
    ta.value = 'Built a forecasting model for 120 SKUs, cutting stock-outs by 18%'; fire(f, ta);
    assert(!sheet(f).textContent.includes('forecasting model for 120'), 'not yet: the preview waits for a pause in typing');
    assert.match(doc(f).querySelector(`[data-bid="${bid}"] [data-hint]`).textContent, /^$|Strong action verb|Number|Passive|Length|Filler/);
    await wait(400);
    assert(sheet(f).textContent.includes('forecasting model for 120 SKUs'));
    assert.deepEqual(f.errors, []);
  } finally { f.w.close(); }
});

test('a bullet shows the checker warnings in its hint, and the editor can add, move and remove things', async () => {
  const f = fixture(); try {
    await built(f);
    const weak = bulletRow(f, 'Responsible for preparing weekly');
    assert.match(weak.querySelector('[data-hint]').textContent, /Number or measurable result/);
    assert.match(weak.querySelector('[data-hint]').textContent, / · /);
    assert.equal(bulletRow(f, 'Excel (pivot tables').querySelector('[data-hint]').textContent, '', 'no hints in Skills');
    // Add a bullet, a section and an entry.
    const m = () => f.run('ResumeBuilder.state().model');
    const before = m().sections[1].entries[0].bullets.length;
    doc(f).querySelectorAll('[data-sid]')[1].querySelector('[data-act=add-bullet]').click();
    assert.equal(m().sections[1].entries[0].bullets.length, before + 1);
    assert.equal(doc(f).activeElement.getAttribute('data-f'), 'btext', 'focus moves to the new bullet');
    f.$('rbAddSection').value = 'achievements'; fire(f, f.$('rbAddSection'), 'change');
    assert.equal(m().sections.at(-1).type, 'achievements'); assert.equal(m().sections.at(-1).title, 'Achievements');
    assert.equal(doc(f).activeElement.getAttribute('data-f'), 'etitle');
    // Move a bullet to another entry.
    const row = bulletRow(f, 'Managed the donation tracking sheet'), sel = row.querySelector('select[data-act=move]');
    const target = m().sections[1].entries[0]; const n = target.bullets.length;
    sel.value = target.id; fire(f, sel, 'change');
    assert.equal(m().sections[1].entries[0].bullets.length, n + 1); assert(m().sections[1].entries[0].bullets.some(b => b.text === 'Managed the donation tracking sheet'));
    assert(![...f.run('ResumeBuilder.state().model.sections[1].entries[1].bullets')].some(b => b.text === 'Managed the donation tracking sheet'));
    // Reorder and remove.
    const names = () => m().sections.map(s => s.type);
    doc(f).querySelectorAll('[data-sid]')[1].querySelector('[data-act=s-up]').click();
    assert.equal(names().indexOf('experience'), 0, 'Experience moved above Education');
    doc(f).querySelectorAll('[data-sid]')[0].querySelector('[data-act=s-down]').click(); assert.equal(names().indexOf('experience'), 1);
    const count = m().sections.length;
    const last = doc(f).querySelectorAll('.rb-section'); last[last.length - 1].querySelector('[data-act=s-del]').click();
    assert.equal(m().sections.length, count - 1);
    assert.deepEqual(f.errors, []);
  } finally { f.w.close(); }
});

test('a résumé that is too long shows the left-out chip and the status', async () => {
  const f = fixture(); try {
    const lines = ['Pat Long', 'pat@example.com', '', 'EXPERIENCE'];
    for (let i = 0; i < 4; i++) { lines.push(`Role ${i}, Company ${i} · Jan 2024 – Dec 2024`); for (let k = 0; k < 14; k++) lines.push(k < 2 ? `- Built a dashboard that cut reporting time by ${k + 10}% across ${k + 3} regional teams and was used every week` : '- Responsible for various routine reporting tasks and helping the team with different things each week'); }
    await built(f, { resume: lines.join('\n') });
    assert.match(f.$('rbFitStatus').textContent, /^Fits on one page\. \d+ lower-ranked bullets are left out \(marked in the editor\)\. Pin one to keep it\./);
    const out = doc(f).querySelectorAll('.rb-left-out'); assert(out.length > 0);
    assert(![...out].some(r => r.querySelector('[data-chip]').hidden), 'each has a visible chip'); assert.equal(out[0].querySelector('[data-chip]').textContent, 'Left out to fit');
    doc(f).querySelector('[data-pages="2"]').click(); assert.match(f.$('rbFitStatus').textContent, /^Fits on two pages\./);
    assert.deepEqual(f.errors, []);
  } finally { f.w.close(); }
});

test('Download PDF prints a copy of the sheet and cleans up afterwards', async () => {
  const f = fixture(); try {
    await built(f);
    let seen = null; const title = doc(f).title;
    f.w.print = () => { seen = { cls: doc(f).body.classList.contains('rb-printing'), root: !!f.$('rbPrintRoot'), name: f.$('rbPrintRoot') && f.$('rbPrintRoot').querySelector('.rb-name').textContent, title: doc(f).title }; };
    f.$('rbPdf').click();
    assert.deepEqual(seen, { cls: true, root: true, name: 'Riya Menon', title: 'Riya Menon – Résumé' });
    assert(f.$('rbPrintRoot'), 'the copy stays until the print dialog closes'); f.w.dispatchEvent(new f.w.Event('afterprint'));
    assert.equal(doc(f).body.classList.contains('rb-printing'), false); assert.equal(f.$('rbPrintRoot'), null); assert.equal(doc(f).title, title);
    assert.match(doc(f).querySelector('.rb-actions .note').textContent, /Save as PDF, paper size A4/);
    f.$('rbPdf').click(); f.w.dispatchEvent(new f.w.Event('afterprint')); assert.equal(doc(f).querySelectorAll('#rbPrintRoot').length, 0);
    assert.deepEqual(f.errors, []);
  } finally { f.w.close(); }
});

test('Copy as text uses the clipboard, with a modal fallback; Download .txt saves a file', async () => {
  const f = fixture(); try {
    await built(f);
    let copied = null; Object.defineProperty(f.w.navigator, 'clipboard', { configurable: true, value: { writeText: async t => { copied = t; } } });
    f.$('rbCopy').click(); await settle();
    assert(copied.startsWith('Riya Menon\n')); assert(copied.includes('EXPERIENCE')); assert.match(f.$('toast').textContent, /Copied/);
    Object.defineProperty(f.w.navigator, 'clipboard', { configurable: true, value: undefined });
    f.$('rbCopy').click(); assert(f.$('rbCopyText')); assert.equal(f.$('rbCopyText').readOnly, true); assert(f.$('rbCopyText').value.includes('Riya Menon'));
    let name = null; f.w.HTMLAnchorElement.prototype.click = function () { name = this.download; };
    f.$('rbTxt').click(); assert.equal(name, 'riya-menon-resume.txt');
    assert.deepEqual(f.errors, []);
  } finally { f.w.close(); }
});

test('Remember is off by default, saves and removes the résumé, and a saved résumé reopens in the editor', async () => {
  const f = fixture(); try {
    await built(f);
    assert.equal(f.$('rbRemember').checked, false); assert.equal(f.w.localStorage.getItem('cr-resume-build'), null);
    f.$('rbName').value = 'Riya Saved'; fire(f, f.$('rbName'));
    f.$('rbRemember').checked = true; fire(f, f.$('rbRemember'), 'change');
    let stored = JSON.parse(f.w.localStorage.getItem('cr-resume-build'));
    assert.equal(stored.model.name, 'Riya Saved'); assert.equal(stored.template, 'classic'); assert.equal(stored.pages, 1);
    doc(f).querySelector('[data-template=compact]').click(); assert.equal(JSON.parse(f.w.localStorage.getItem('cr-resume-build')).template, 'compact');
    f.$('rbRemember').checked = false; fire(f, f.$('rbRemember'), 'change'); assert.equal(f.w.localStorage.getItem('cr-resume-build'), null);
    f.$('rbRemember').checked = true; fire(f, f.$('rbRemember'), 'change');
    f.$('rbBack').click(); assert.equal(f.w.localStorage.getItem('cr-resume-build'), null, 'starting again forgets it');
    assert.equal(f.run('ResumeBuilder.state().stage'), 'input'); assert.equal(f.$('rbResume').value, W.SAMPLE_RESUME, 'the pasted text is kept');
    stored = { model: RB.build(W.SAMPLE_RESUME), template: 'modern', pages: 2 };
    const g = fixture({ storage: { 'cr-resume-build': JSON.stringify(stored) } }); try {
      g.$('resumeNav').click(); g.$('rbTabBuild').click();
      const s = g.run('ResumeBuilder.state()'); assert.equal(s.stage, 'edit'); assert.equal(s.template, 'modern'); assert.equal(s.pages, 2);
      assert(sheet(g).classList.contains('rb-t-modern')); assert.equal(g.$('rbRemember').checked, true);
      assert.deepEqual(g.errors, []);
    } finally { g.w.close(); }
    const bad = fixture({ storage: { 'cr-resume-build': JSON.stringify({ model: { v: 9 } }) } }); try {
      bad.$('resumeNav').click(); bad.$('rbTabBuild').click(); assert.equal(bad.run('ResumeBuilder.state().stage'), 'input'); assert.deepEqual(bad.errors, []);
    } finally { bad.w.close(); }
    assert.deepEqual(f.errors, []);
  } finally { f.w.close(); }
});

test('Tighten with AI opens Settings when there is no key', async () => {
  const f = fixture(); try {
    await built(f);
    // The real client (loaded after this file): with no key it opens its settings dialog.
    assert(f.w.AIClient, 'ai-client.js defines AIClient');
    f.$('rbAi').click(); await settle();
    assert(f.$('aiProvider'), 'the settings dialog is open');
    let opened = 0; f.w.AIClient = { enabled: () => false, request: async () => assert.fail('no request without a key'), openSettings() { opened++; }, cancel() {} };
    f.$('rbAi').click(); await settle(); assert.equal(opened, 1);
    assert.deepEqual(f.errors, []);
  } finally { f.w.close(); }
});

test('Tighten with AI sends bullet text only, shows changed suggestions and applies only the ticked ones', async () => {
  const f = fixture(); try {
    await built(f);
    const calls = [];
    const ids = () => f.run('ResumeBuilder.state().model').sections[1].entries[0].bullets.map(b => b.id);
    const [a, b, c] = ids();
    f.w.AIClient = { enabled: () => true, openSettings() { assert.fail('settings'); }, cancel() {}, request: async (action, session, extra) => { calls.push({ action, session, extra });
      return { result: { bullets: [
        { id: a, text: 'Prepared weekly sales reports for the category team', original: 'x', changed: true, newNumbers: [] },
        { id: b, text: 'Built an Excel model for 120 SKUs, cutting stock-outs by 25%', original: 'y', changed: true, newNumbers: ['25%'] },
        { id: c, text: 'same', original: 'same', changed: false, newNumbers: [] }] }, provider: 'x', model: 'y' }; } };
    const original = f.run('ResumeBuilder.state().model').sections[1].entries[0].bullets.map(x => x.text);
    f.$('rbAi').click(); await settle();
    assert.equal(calls.length, 1); assert.equal(calls[0].action, 'resume-tighten'); assert.equal(calls[0].session, null); assert.equal(calls[0].extra.goal, 'one-page');
    assert(calls[0].extra.bullets.length > 0 && calls[0].extra.bullets.length <= 40); assert(calls[0].extra.bullets.every(x => Object.keys(x).sort().join() === 'id,text'));
    const sent = JSON.stringify(calls[0]); assert(!sent.includes('Riya') && !sent.includes('example.com') && !sent.includes('90000'), 'no name or contact details are sent');
    const sugs = [...doc(f).querySelectorAll('.rb-sug')]; assert.equal(sugs.length, 2, 'only changed suggestions are listed');
    assert.match(f.$('rbReview').textContent, /AI suggestions can be wrong\. Keep only what is true and what you can explain in an interview\./);
    assert.equal(sugs[0].querySelector('[data-use]').checked, true);
    assert.equal(sugs[1].querySelector('[data-use]').checked, false); assert.match(sugs[1].querySelector('.rb-warn').textContent, /Adds a number that is not in your original \(25%\)\. Use it only if it is true\./);
    sugs[0].querySelector('textarea').value = 'Prepared weekly sales reports for the category team'; // editable
    f.$('rbApply').click(); await settle();
    const after = f.run('ResumeBuilder.state().model').sections[1].entries[0].bullets.map(x => x.text);
    assert.equal(after[0], 'Prepared weekly sales reports for the category team'); assert.equal(after[1], original[1]); assert.equal(after[2], original[2]);
    assert.equal(f.$('rbReview').innerHTML, ''); assert(sheet(f).textContent.includes('Prepared weekly sales reports'));
    assert.equal(doc(f).querySelector(`[data-bid="${a}"] textarea`).value, after[0]);
    // Discard, and an error message.
    f.$('rbAi').click(); await settle(); assert(f.$('rbDiscard')); f.$('rbDiscard').click(); assert.equal(f.$('rbReview').innerHTML, '');
    f.w.AIClient.request = async () => { throw new Error('The provider said no.'); };
    f.$('rbAi').click(); await settle(); assert.equal(f.$('rbAiStatus').textContent, 'The provider said no.'); assert.equal(f.$('rbAi').disabled, false);
    assert.deepEqual(f.errors, []);
  } finally { f.w.close(); }
});
