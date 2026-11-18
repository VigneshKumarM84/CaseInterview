const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib'), { pathToFileURL } = require('node:url');
const { JSDOM } = require('jsdom');
const RC = require('../src/resume-check.js'), RF = require('../src/resume-files.js'), W = require('../content/resume-words.js');
const { fixture, settle } = require('./dom.cjs');
const root = path.resolve(__dirname, '..');
const DOMParser = new JSDOM('').window.DOMParser;
const warns = (text) => RC.lintBullet(text).checks.filter(c => c.status === 'warn').map(c => c.id);
const checkOf = (text, id) => RC.lintBullet(text).checks.find(c => c.id === id);
const XSS = '<script>window.__x=1</script> and <img src=x onerror="window.__x=2">';

/* ---------- A tiny zip writer, independent of the reader under test ---------- */
function makeZip(entries) {
  const locals = [], centrals = []; let offset = 0;
  for (const e of entries) {
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8'), comp = e.method === 8 ? zlib.deflateRawSync(data) : data;
    const name = Buffer.from(e.name), crc = zlib.crc32(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(e.method, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(e.method, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, name, comp); centrals.push(ch, name); offset += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(centrals), eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}
const xmlEsc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const li = (text, id = 1) => `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${id}"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`;
const para = text => `<w:p><w:r><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`;
function documentXml(extra = '') {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:v="urn:schemas-microsoft-com:vml"><w:body>
<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Kabir Shah</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Experience</w:t></w:r></w:p>
<w:p><w:r><w:t>Data Analyst Intern, Acme Foods</w:t></w:r><w:r><w:tab/><w:t>Jun 2025 – Aug 2025</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr><w:r><w:t xml:space="preserve">Built a </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>Power BI</w:t></w:r><w:r><w:t xml:space="preserve"> dashboard for 40 stores, cutting reporting time by 6 hours a week</w:t></w:r></w:p>
${li('Responsible for weekly reports')}
${li(XSS)}
<w:p><w:r><w:t>Line one</w:t><w:br/><w:t>Line two</w:t></w:r></w:p>
<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wps:txbx><w:txbxContent><w:p><w:r><w:t>TEXT BOX CONTENT</w:t></w:r></w:p></w:txbxContent></wps:txbx></w:drawing></mc:Choice><mc:Fallback><w:pict><v:textbox><w:txbxContent><w:p><w:r><w:t>TEXT BOX FALLBACK</w:t></w:r></w:p></w:txbxContent></v:textbox></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>
<w:p/>
${para('PROJECTS')}
${li('Analysed 3,000 survey responses in Python to find the three biggest reasons for churn', 2)}
${extra}<w:sectPr/></w:body></w:document>`;
}
const docx = (method = 8, xml = documentXml()) => makeZip([{ name: '[Content_Types].xml', data: '<Types/>', method }, { name: 'word/document.xml', data: xml, method }, { name: 'word/header1.xml', data: '<w:hdr>HEADER TEXT</w:hdr>', method }]);
const EXPECTED_DOCX = ['Kabir Shah', '', 'Experience', 'Data Analyst Intern, Acme Foods Jun 2025 – Aug 2025', '• Built a Power BI dashboard for 40 stores, cutting reporting time by 6 hours a week',
  '• Responsible for weekly reports', '• ' + XSS, 'Line one', 'Line two', '', 'PROJECTS', '• Analysed 3,000 survey responses in Python to find the three biggest reasons for churn'];
const docxOpts = { DOMParser, DecompressionStream: globalThis.DecompressionStream };

/* ---------- Structure ---------- */
test('finds sections, roles and bullets in the sample and in other layouts', () => {
  const p = RC.parse(W.SAMPLE_RESUME);
  assert.deepEqual(p.sections.map(s => s.type), ['summary', 'education', 'experience', 'projects', 'responsibility', 'skills']);
  assert.deepEqual(p.roles.map(r => [r.title.slice(0, 22), r.current, r.bullets.length]), [['Business Analyst Inter', false, 5], ['Operations Volunteer, ', true, 3], ['Pricing study for a ca', false, 3], ['', false, 2]]);
  assert.equal(p.bullets.filter(b => b.lint).length, 13);

  // Dashes, numbering, "Heading:" with a colon, mixed-case headings, a capitalised company line, Skills bullets left alone.
  const b = RC.parse(['Work Experience:', 'NORTHWIND RETAIL', 'Sales Intern | Jan 2024 - Mar 2024', '- Led a team of 4 interns', '1. Increased repeat orders by 12%', '2) Built a pricing tracker',
    '', 'Skills:', '- Excel, SQL', 'Interests', '* Chess'].join('\n'));
  assert.deepEqual(b.sections.map(s => [s.title, s.type]), [['Work Experience:', 'experience'], ['Skills:', 'skills'], ['Interests', 'other']]);
  assert.deepEqual(b.roles.filter(r => r.bullets.length).map(r => r.title), ['Sales Intern | Jan 2024 - Mar 2024', '', '']);
  assert.equal(b.lines[1].kind, 'role', 'a company name in capitals under Experience is a role, not a new section');
  assert.deepEqual(b.bullets.filter(x => x.lint).map(x => [x.prefix, x.text]), [['-', 'Led a team of 4 interns'], ['1.', 'Increased repeat orders by 12%'], ['2)', 'Built a pricing tracker']]);
  assert.deepEqual(b.bullets.filter(x => !x.lint).map(x => x.text), ['Excel, SQL', 'Chess']);

  // Paragraph-style Projects with no bullet characters, and a bullet that wraps onto a lower-case line.
  const c = RC.parse(['PROJECTS', 'Campus Café Pricing', 'Surveyed 180 students and estimated willingness to pay, which raised combo prices by ₹20.', 'Designed a feedback form used by 300 diners.',
    '', 'EXPERIENCE', 'Intern, Example Bank (2025)', '• Reconciled 1,200 daily transactions and flagged mismatches to', 'the operations lead within a day'].join('\n'));
  assert.equal(c.roles[0].title, 'Campus Café Pricing');
  assert.deepEqual(c.bullets.map(x => x.text.slice(0, 22)), ['Surveyed 180 students ', 'Designed a feedback fo', 'Reconciled 1,200 daily']);
  assert.equal(c.bullets[2].text, 'Reconciled 1,200 daily transactions and flagged mismatches to the operations lead within a day');
  assert.deepEqual([c.bullets[2].start, c.bullets[2].end], [7, 8]);

  // Short capitalised skills ("SQL", "AWS") are not headings, inside or outside Skills.
  const e = RC.parse('SKILLS\nSQL\nAWS\nExcel and pivot tables\nEXPERIENCE\n• Built a model\nPOWER BI\n• Led a club');
  assert.deepEqual(e.sections.map(s => s.type), ['skills', 'experience']); assert.deepEqual(e.bullets.map(b => b.text), ['Built a model', 'Led a club']);
  assert.deepEqual(RC.matchKeywords(RC.extractKeywords('Requirements: SQL, AWS, pivot tables'), e).skillsOnly.map(k => k.display).sort(), ['aws', 'pivot tables', 'sql']);
  // No headings at all: every bullet line is checked.
  const d = RC.parse('Asha\n• Built a model\n• Led a club\nPlain line');
  assert.equal(d.headingsFound, 0); assert.deepEqual(d.bullets.filter(x => x.lint).map(x => x.text), ['Built a model', 'Led a club']);
  assert.deepEqual(RC.stats(W.SAMPLE_RESUME), { lines: 28, bullets: 13, checked: 13, sections: 6 });
});

/* ---------- Lint rules ---------- */
test('action-verb check: strong verbs pass, weak and first-person openers warn', () => {
  for (const ok of ['Increased revenue by 10%', 'Led a team of five', 'Analysed churn', 'Analyzed churn', 'Spearheaded a club relaunch', 'Revitalised the alumni newsletter', 'Set up a tracker', 'Coordinate weekend drives'])
    assert.equal(checkOf(ok, 'verb').status, 'pass', ok);
  assert.match(checkOf('Coordinate weekend drives', 'verb').reason, /present-tense/);
  for (const [bad, re] of [['Responsible for preparing reports', /Responsible for/], ['Worked on a dashboard', /Worked on/], ['Helped the team', /Helped/], ['Assisted the manager', /Assisted/],
    ['Involved in the audit', /Involved in/], ['Duties included filing', /Duties included/], ['I built a model', /"I"/], ['My role was to plan', /"My"/], ['Data was cleaned by me', /"Data"/], ['Used data to plan routes', /Used/]])
    { const c = checkOf(bad, 'verb'); assert.equal(c.status, 'warn', bad); assert.match(c.reason, re); assert(c.fix.length > 10); }
  const s = RC.lintBullet('Successfully led the launch of 3 products');
  assert.equal(s.checks.find(c => c.id === 'verb').status, 'pass'); assert.match(s.checks.find(c => c.id === 'verb').reason, /after "successfully"/);
  assert.equal(s.checks.find(c => c.id === 'filler').status, 'warn');
});

test('number check finds digits, %, ₹, lakh/crore, multipliers and number words, but not years or B2B', () => {
  for (const ok of ['Grew sales 3x in a term', 'Raised ₹2 lakh for the fest', 'Cut costs by 40%', 'Saved $5k a year', 'Reviewed 2,400 app reviews', 'Raised Rs. 500 per stall', 'Doubled sign-ups', 'Trained twelve volunteers', 'Managed a 1.5 crore budget'])
    assert.equal(checkOf(ok, 'number').status, 'pass', ok);
  for (const bad of ['Increased engagement among users', 'Won the 2024 inter-college quiz', 'Built B2B onboarding flows', 'Led the club from Jan 2023 – Present', 'Organised one of the fests'])
    assert.equal(checkOf(bad, 'number').status, 'warn', bad);
  assert.match(checkOf('Cut costs by 40%', 'number').reason, /40/);
});

test('passive-voice heuristic flags "be" plus a participle and nothing else', () => {
  for (const bad of ['Data was cleaned by me', 'Reports were handled by the team', 'The app was quickly adopted by 200 users', 'A new process was built', 'Interns are trained every month'])
    assert.equal(checkOf(bad, 'passive').status, 'warn', bad);
  assert.match(checkOf('Data was cleaned by me', 'passive').reason, /"was cleaned".*heuristic/);
  for (const ok of ['Increased', 'Led a team of 5', 'Used data to plan routes', 'Cleaned the data before reviews', 'Team is based in Pune', 'I was interested in finance', 'Was then promoted? no: Got promoted'])
    assert.equal(checkOf(ok, 'passive').status, 'pass', ok);
});

test('length, filler, repeated opening verbs and tense', () => {
  assert.match(checkOf('Managed the survey', 'length').reason, /Short: 3 words/);
  assert.equal(checkOf('Built a dashboard used by twelve store managers', 'length').status, 'pass');
  assert.match(checkOf(Array(31).fill('word').join(' '), 'length').reason, /Long: 31 words/);
  assert.match(checkOf('Built ' + Array(20).fill('internationalisation').join(' '), 'length').reason, /two lines/);
  const f = checkOf('Successfully handled various tasks etc. as a hard-working team player creating synergy', 'filler');
  for (const t of ['successfully', 'various', 'etc', 'hard-working', 'team player', 'synergy']) assert(f.reason.includes(`"${t}"`), t);
  assert.equal(checkOf('Managed every weekly review for the club', 'filler').status, 'pass', '"every" is not "very" and "Managed" is not "many"');

  const a = RC.analyse(['EXPERIENCE', 'Intern, A (2024)', '• Developed a tracker for 3 teams', '• Developed a pricing model for 20 SKUs', 'Analyst, B (2025 – Present)', '• Developed a report used by 9 managers',
    '• Lead weekly reviews with 6 store managers', '• Built a forecast for 40 stores', 'Volunteer, C (Jan 2023 – Mar 2023)', '• Teach maths to 30 children each week', '• Cut waste by 10% at the kitchen'].join('\n'));
  const rep = a.bullets.map(b => b.checks.find(c => c.id === 'repeat'));
  assert.deepEqual(rep.map(r => r.status), ['pass', 'warn', 'warn', 'pass', 'pass', 'pass', 'pass']);
  assert.match(rep[1].reason, /"Developed" starts 3 bullets/);
  const alts = rep[1].fix.match(/"([A-Z][a-z]+)"/g).map(s => s.slice(1, -1).toLowerCase());
  assert(alts.length === 3 && alts.every(v => v !== 'developed' && v !== 'built' && W.VERB_GROUPS.build.includes(v)), 'alternatives are similar verbs not already used');
  const tense = a.bullets.map(b => b.checks.find(c => c.id === 'tense').status);
  assert.deepEqual(tense, ['pass', 'pass', 'pass', 'warn', 'pass', 'warn', 'pass'], 'present tense in a mixed current role, and in a finished role, is flagged; "Cut" is ignored');
  assert.match(a.bullets[3].checks.find(c => c.id === 'tense').reason, /mixes present \("Lead"\)/);
  assert.match(a.bullets[5].checks.find(c => c.id === 'tense').fix, /"Taught"/);
  const twoInRole = RC.analyse('EXPERIENCE\nIntern, A (2024)\n• Managed a 5-person team\n• Managed 3 vendor contracts\nIntern, B (2023)\n• Built a model');
  assert.deepEqual(twoInRole.bullets.map(b => b.checks.find(c => c.id === 'repeat').status), ['pass', 'warn', 'pass']);
  const s = RC.analyse(W.SAMPLE_RESUME).summary;
  assert.deepEqual(s.counts, { verb: 6, number: 6, passive: 1, length: 4, filler: 2, repeat: 2, tense: 1 });
  assert.equal(s.withNumber, 7); assert.equal(s.total, 13);
});

/* ---------- Whole-résumé checks (no job description needed) ---------- */
const WEAK_RESUME = ['Rahul K', 'rahul@example.com | 98765 43210', 'CAREER OBJECTIVE', 'To secure a challenging position in a reputed organisation and utilise my skills for the growth of the organisation.',
  'EDUCATION', 'B.E. Mechanical, 2026 · CGPA 8.4/10', 'EXPERIENCE', 'Intern, Tata Motors', '• Organised a kaizen drive that cut changeover time by 12%.', '• Analyzed 3 months of downtime data',
  '- Prepared shift reports for the plant head', 'Project Trainee, Bosch (06/2024 – 07/2024)', 'SKILLS', 'AutoCAD, SolidWorks, MS Excel (advanced), English, Hindi',
  'PERSONAL DETAILS', 'Date of Birth: 12/03/2004', 'Marital Status: Unmarried', 'DECLARATION', 'I hereby declare that the above information is true.'].join('\n');
const general = text => Object.fromEntries(RC.analyse(text).general.map(g => [g.id, g]));
test('whole-résumé checks run without a job description and flag common problems', () => {
  const s = general(W.SAMPLE_RESUME);
  assert.deepEqual(Object.keys(s), RC.GENERAL_IDS);
  assert.deepEqual(Object.fromEntries(Object.entries(s).map(([k, g]) => [k, g.status])),
    { contact: 'info', sections: 'pass', length: 'pass', personal: 'pass', summary: 'pass', roles: 'pass', dates: 'pass', formatting: 'pass', spelling: 'pass', skills: 'warn' });
  assert.deepEqual(s.skills.items, ['pivot tables', 'VLOOKUP', 'SQL', 'PowerPoint', 'Python', 'Google Sheets'], 'Excel and Tableau are shown in bullets; "(basic)" is dropped');

  const w = general(WEAK_RESUME);
  for (const id of ['length', 'personal', 'summary', 'roles', 'dates', 'formatting', 'spelling', 'skills']) assert.equal(w[id].status, 'warn', id);
  assert.deepEqual(w.personal.items, ['date of birth', 'marital status', 'declaration']);
  assert.deepEqual(w.summary.items, ['challenging position', 'reputed organisation', 'utilise my skills', 'growth of the organisation']);
  assert.match(w.roles.reason, /"Project Trainee, Bosch \(06\/2024 – 07\/2024\)" has no bullets/);
  assert.match(w.dates.reason, /No dates on: "Intern, Tata Motors"/);
  assert.match(w.formatting.reason, /different markers \(• -\)/);
  assert.match(w.spelling.reason, /organis.*analyzed/);
  assert.deepEqual(w.skills.items, ['AutoCAD', 'SolidWorks', 'MS Excel'], 'spoken languages and "(advanced)" are not counted');
  assert(w.personal.fix && w.summary.fix && w.skills.fix);

  // Guards against false positives.
  const clean = general(['Asha Verma', 'asha@example.com · +91 98765 43210 · linkedin.com/in/asha', 'EDUCATION', 'B.Com, 2026 · CGPA 8.4/10', 'EXPERIENCE', 'Analyst Intern, Northwind · May 2025 – Jul 2025',
    '• Analysed 2,400 reviews in Excel and presented 5 fixes', '• Built a SQL query library used by 6 analysts', 'Volunteer, Food Bank · Jun 2024 – Present', '• Organised 12 drives',
    'SKILLS', 'Tools: Excel, SQL', 'Languages: English, Hindi, Tamil'].join('\n'));
  for (const id of ['contact', 'sections', 'personal', 'roles', 'dates', 'formatting', 'spelling', 'skills']) assert.equal(clean[id].status, 'pass', id + ': ' + clean[id].reason);
  assert.equal(clean.summary.status, 'info'); assert.equal(clean.length.status, 'warn', 'under 150 words is very short');
  const bare = general('Just some text\n• Built a thing');
  assert.equal(bare.sections.status, 'warn'); assert.match(bare.sections.reason, /No section headings/); assert.equal(bare.contact.status, 'warn'); assert.equal(bare.contact.reason, 'No email address or phone number found.');
  assert.equal(general(['EDUCATION', 'X', 'SKILLS', 'Excel'].join('\n')).sections.items[0], 'Experience or Projects');
  const long = general('a@b.co 98765 43210\nEDUCATION\nX\nEXPERIENCE\nIntern, A (2024)\n' + Array(100).fill('• Built a dashboard used by twelve store managers to track sales daily').join('\n') + '\nSKILLS\nExcel');
  assert.match(long.length.reason, /more than two pages/); assert.match(long.roles.reason, /has 100 bullets/);
  assert(RC.reportText(RC.analyse(WEAK_RESUME)).includes('WHOLE RÉSUMÉ\n'));
});

/* ---------- Keywords ---------- */
test('keyword extraction drops generic words, keeps skills and phrases, and ranks requirements higher', () => {
  const k = RC.extractKeywords(W.SAMPLE_JD), keys = k.map(x => x.display);
  for (const want of ['sql', 'excel', 'pivot tables', 'power bi', 'tableau', 'a/b testing', 'data analysis', 'data visualization', 'stakeholder management', 'financial modelling', 'supply chain', 'python'])
    assert(keys.includes(want), want);
  for (const no of ['candidate', 'requirements', 'years', 'experience', 'fernway', 'fernway retail', 'bengaluru', 'power', 'bi', 'strong', 'skills', 'data']) assert(!keys.includes(no), no);
  const jd = 'About us\nWe love spreadsheets and dashboards.\nRequirements\n- SQL and dashboards\n- 2+ years of experience\n- The ideal candidate has stakeholder management skills';
  const r = RC.extractKeywords(jd);
  assert.equal(r[0].display, 'dashboards', 'repeated and in requirements'); assert(r.find(x => x.display === 'sql').score > r.find(x => x.display === 'excel').score, 'requirements outweigh about-us');
  assert(!r.some(x => /years|candidate|experience|ideal/.test(x.display)));
});

test('normalisation matches plurals, spellings and common variants', () => {
  for (const group of [['analyse', 'analyze', 'analysis', 'analysing', 'analytics'], ['modelling', 'modeling', 'models', 'model'], ['optimisation', 'optimization', 'optimise', 'optimizing'],
    ['dashboards', 'dashboard'], ['managing', 'managed', 'management', 'manager'], ['visualisation', 'visualization', 'visualize'], ['processes', 'processing', 'process']])
    assert.equal(new Set(group.map(RC.stem)).size, 1, group.join(','));
  const keys = s => RC.tokenize(s).map(t => t.key).join(' ');
  assert.equal(keys('MS Excel'), keys('excel')); assert.equal(keys('Microsoft Excel'), 'excel');
  assert.equal(keys('ML'), keys('machine learning')); assert.equal(keys('JS'), keys('javascript')); assert.equal(keys('PowerBI'), keys('power bi'));
  assert.equal(keys('AB testing'), keys('A/B tests')); assert.equal(keys('Tableau/Power BI'), keys('tableau power bi'));
  const m = RC.matchKeywords(RC.extractKeywords('Requirements: MS Excel, ML, JavaScript, analytics, dashboards'), 'EXPERIENCE\n• Analysed sales with machine learning in JS and excel to build a dashboard\nSKILLS\nExcel');
  assert.deepEqual(m.missing.map(k => k.display), [], 'every variant is recognised');
  assert.deepEqual(m.matched.map(k => k.display).sort(), ['analytics', 'dashboards', 'excel', 'javascript', 'machine learning']);
});

test('match groups: matched, only in Skills, missing, and the top-N percentage', () => {
  const m = RC.analyse(W.SAMPLE_RESUME, W.SAMPLE_JD).match;
  const g = name => m[name].map(k => k.display);
  for (const k of ['excel', 'tableau', 'forecasting', 'sales', 'dashboards']) assert(g('matched').includes(k), 'matched ' + k);
  assert.deepEqual(g('skillsOnly').sort(), ['pivot tables', 'python', 'sql']);
  for (const k of ['power bi', 'a/b testing', 'stakeholder management', 'data visualization', 'financial modelling', 'communication']) assert(g('missing').includes(k), 'missing ' + k);
  assert.equal(m.top, 20); assert.equal(m.found, m.keywords.slice(0, 20).filter(k => k.group !== 'missing').length); assert.equal(m.percent, Math.round(m.found / 20 * 100));
  assert.equal(RC.analyse(W.SAMPLE_RESUME, '').match, null);
});

test('the top-N rows alone reproduce the headline count, in the analysis and the report', () => {
  const a = RC.analyse(W.SAMPLE_RESUME, W.SAMPLE_JD), m = a.match, top = list => list.filter(k => k.inTop);
  assert.equal(m.keywords.length, 30); assert.deepEqual(m.keywords.map(k => k.rank), m.keywords.map((_, i) => i + 1));
  assert.equal(top(m.keywords).length, m.top);
  // The sample the review used: 10 of the top 20, 3 of them only in Skills.
  assert.equal(m.found, 10); assert.equal(m.foundInSkillsOnly, 3);
  assert.equal(top(m.matched).length + top(m.skillsOnly).length, m.found);
  assert.equal(top(m.skillsOnly).length, m.foundInSkillsOnly);
  assert.equal(top(m.missing).length, m.top - m.found);
  const r = RC.reportText(a);
  assert.match(r, /10 of the top 20 keywords appear/); assert.match(r, /Top 20 keywords \(the ones counted above\):/); assert.match(r, /Lower-ranked keywords 21–30 \(not counted above\):/);
  const topBlock = r.slice(r.indexOf('Top 20 keywords'), r.indexOf('Lower-ranked'));
  assert(topBlock.includes('power bi') && !topBlock.includes('merchandising'), 'rank 30 is listed only under lower-ranked keywords');
  // With 20 or fewer keywords there is no lower-ranked block.
  assert(!RC.reportText(RC.analyse(W.SAMPLE_RESUME, 'Requirements: SQL, Excel, Tableau')).includes('Lower-ranked'));
});

/* ---------- .docx ---------- */
test('a .docx is unzipped, inflated and converted: headings, numbered bullets, tabs and breaks; text boxes and headers ignored', async () => {
  for (const method of [8, 0]) {
    const res = await RF.readDocx(docx(method), docxOpts);
    assert.deepEqual(res.text.split('\n'), EXPECTED_DOCX, 'method ' + method);
    assert.equal(res.headings, 2); assert.equal(res.bullets, 4);
    assert(!res.text.includes('TEXT BOX') && !res.text.includes('HEADER TEXT'));
  }
  assert.deepEqual(RF.zipEntries(docx()).map(e => [e.name, e.method]), [['[Content_Types].xml', 8], ['word/document.xml', 8], ['word/header1.xml', 8]]);
  const s = RC.stats((await RF.readDocx(docx(), docxOpts)).text); assert.deepEqual([s.bullets, s.sections], [4, 2]);
});

test('a corrupt or incomplete .docx gives a clear error', async () => {
  const bad = async (bytes, code, opts = docxOpts) => { await assert.rejects(RF.readDocx(bytes, opts), e => e instanceof RF.ResumeFileError && e.code === code && e.message.length > 40); };
  await bad(Buffer.from('this is not a zip file at all, just some text that is long enough'), 'zip');
  const good = docx(); await bad(good.subarray(0, good.length - 30), 'zip');
  const broken = Buffer.from(good); broken.writeUInt32LE(0x12345678, broken.indexOf(Buffer.from('word/document.xml')) - 30); await bad(broken, 'zip');
  await bad(makeZip([{ name: 'hello.txt', data: 'hi', method: 0 }]), 'noDocument');
  const garbled = makeZip([{ name: 'word/document.xml', data: 'x', method: 0 }]); garbled.writeUInt16LE(8, 8); garbled.writeUInt16LE(8, garbled.indexOf(Buffer.from([0x50, 0x4b, 1, 2])) + 10); await bad(garbled, 'zip');
  await bad(makeZip([{ name: 'word/document.xml', data: '<w:document><unclosed>', method: 8 }]), 'xml');
  await bad(docx(), 'noInflate', { DOMParser, DecompressionStream: null });
  assert.match(RF.MSG.zip, /paste the text/);
});

/* ---------- PDF ---------- */
const item = (str, x, y, o = {}) => ({ str, x, y, w: o.w ?? str.length * 5, h: o.h ?? 10, page: o.page ?? 1 });
test('PDF line rebuilding: lines, spaces from gaps, bullets, hyphens, wrapped bullets, paragraph and page breaks', () => {
  const two = RC.pdfItemsToLines([item('world', 103, 700), item('Hello', 72, 700), item('Second', 72, 686), item('line', 105, 686.6), item('Pow', 72, 672), item('er BI', 87, 672)]);
  assert.deepEqual(two.lines, ['Hello world', 'Second line', 'Power BI']);
  const bullets = RC.pdfItemsToLines([item('●', 72, 700, { w: 4 }), item('Built a model', 82, 700), item(' Led a club of 40', 72, 686), item('– Ran a fest', 72, 672), item('-5% churn is not a bullet', 72, 658)]);
  assert.deepEqual(bullets.lines, ['• Built a model', '• Led a club of 40', '• Ran a fest', '-5% churn is not a bullet']);
  const hyph = RC.pdfItemsToLines([item('Responsible for prepar-', 72, 700), item('ing weekly reports', 72, 686)]);
  assert.deepEqual(hyph.lines, ['Responsible for preparing weekly reports']);
  const wrap = RC.pdfItemsToLines([item('•', 72, 700, { w: 4 }), item('Built a dashboard used by', 82, 700), item('twelve store managers', 82, 686), item('•', 72, 672, { w: 4 }), item('Led a team', 82, 672),
    item('EDUCATION', 82, 658), item('Not indented, so not joined', 72, 644)]);
  assert.deepEqual(wrap.lines, ['• Built a dashboard used by twelve store managers', '• Led a team', 'EDUCATION', 'Not indented, so not joined']);
  // Bullets drawn as shapes: a line that reaches the right margin continues on the next line; a new capitalised sentence does not.
  const shapes = RC.pdfItemsToLines([item('Intern, Example Bank', 60, 700, { w: 100 }), item('Built a SQL dashboard in Power BI that tracks daily order funnel drop-offs for 3 cities, used by', 80, 686, { w: 450 }),
    item('14 managers', 80, 672, { w: 55 }), item('Reduced reconciliation time across all branches in the region by a full working day each week.', 80, 658, { w: 448 }), item('Led a team of 4', 80, 644, { w: 70 })]);
  assert.deepEqual(shapes.lines, ['Intern, Example Bank', 'Built a SQL dashboard in Power BI that tracks daily order funnel drop-offs for 3 cities, used by 14 managers',
    'Reduced reconciliation time across all branches in the region by a full working day each week.', 'Led a team of 4']);
  const breaks = RC.pdfItemsToLines([item('One', 72, 700), item('Two', 72, 686), item('Three', 72, 672), item('After a gap', 72, 630), item('Page two', 72, 760, { page: 2 })]);
  assert.deepEqual(breaks.lines, ['One', 'Two', 'Three', '', 'After a gap', '', 'Page two']);
  assert.equal(breaks.chars, 'OneTwoThreeAfteragapPagetwo'.length);
});

test('PDF two-column layouts are read column by column; right-aligned dates are not mistaken for a column', () => {
  const items = [item('ASHA VERMA', 40, 780, { w: 200 })];
  for (let i = 0; i < 10; i++) { items.push(item('Left ' + i, 40, 740 - i * 14, { w: 150 })); items.push(item('Right ' + i, 320, 742 - i * 14, { w: 240 })); }
  const r = RC.pdfItemsToLines(items);
  assert.equal(r.columns, 1); assert.deepEqual(r.lines.filter(Boolean), ['ASHA VERMA', ...Array.from({ length: 10 }, (_, i) => 'Left ' + i), ...Array.from({ length: 10 }, (_, i) => 'Right ' + i)]);
  const single = [];
  for (let i = 0; i < 4; i++) { single.push(item('Intern, Company ' + i, 72, 740 - i * 60, { w: 150 }), item('Jan 2024', 490, 740 - i * 60, { w: 50 })); for (let j = 1; j <= 3; j++) single.push(item('• Built something useful that spans the whole width of the page ' + j, 72, 740 - i * 60 - j * 14, { w: 468 })); }
  const s = RC.pdfItemsToLines(single);
  assert.equal(s.columns, 0); assert.equal(s.lines[0], 'Intern, Company 0 Jan 2024');
});

const pdfjsOk = (() => { const [a, b] = process.versions.node.split('.').map(Number); return a > 22 || (a === 22 && b >= 13); })();
async function loadPdfjs() {
  const quiet = console.log, warn = console.warn; console.log = console.warn = (...a) => { if (!/^Warning:/.test(String(a[0]))) quiet(...a); };
  try { const lib = await import(pathToFileURL(path.join(root, 'vendor/pdfjs/pdf.min.mjs')).href); lib.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(root, 'vendor/pdfjs/pdf.worker.min.mjs')).href; return lib; }
  finally { console.log = quiet; console.warn = warn; }
}
test('the stored pdf.js reads a text-based PDF and reports a scanned one', { skip: !pdfjsOk && 'pdf.js 6 needs Node 22.13 or newer' }, async () => {
  const lib = await loadPdfjs();
  assert.equal(lib.version, '6.5.438');
  const res = await RF.readPdf(fs.readFileSync(path.join(__dirname, 'fixtures/resume-text.pdf')), { pdfjs: lib });
  assert.deepEqual(res.text.split('\n'), ['Asha Verma', 'Pune · asha.verma@example.com', '', 'EXPERIENCE', 'Analytics Intern, Northwind Retail (May 2025 - Jul 2025)',
    '• Built a weekly sales dashboard in Power BI used by 12 store managers', '• Responsible for cleaning data for the merchandising team and preparing reports every Friday',
    '• Reduced stock-outs by 18% by forecasting demand with Python', '', 'EDUCATION', 'B.Com, Example College, 2026', '', 'SKILLS', 'SQL, Excel, Python, Power BI, Tableau']);
  assert.equal(res.pages, 2); assert(res.notes.some(n => /two-column/i.test(n)));
  await assert.rejects(RF.readPdf(fs.readFileSync(path.join(__dirname, 'fixtures/resume-scanned.pdf')), { pdfjs: lib }), e => e.code === 'scanned' && /scanned or image-only/.test(e.message));
  await assert.rejects(RF.readPdf(Buffer.from('%PDF-1.4 not really a pdf'), { pdfjs: lib }), e => e.code === 'pdfBroken');
});

test('password-protected and unloadable PDFs give clear messages', async () => {
  const locked = { getDocument: () => ({ promise: Promise.reject(Object.assign(new Error('No password given'), { name: 'PasswordException' })) }) };
  await assert.rejects(RF.readPdf(new ArrayBuffer(8), { pdfjs: locked }), e => e.code === 'password' && /password-protected/.test(e.message));
  RF.setPdfLoader(() => Promise.reject(new Error('Failed to fetch dynamically imported module')));
  await assert.rejects(RF.loadPdfjs(), e => e.code === 'pdfLoad' && e.message === 'PDF reading needs the hosted site or `npm start`. Upload a .docx or paste the text instead.');
  RF.setPdfLoader(null);
});

/* ---------- Files ---------- */
test('oversized, empty and unsupported files are rejected with clear messages', () => {
  const f = (name, size = 1000, type = '') => RF.check({ name, size, type });
  for (const [name, type] of [['cv.pdf', ''], ['CV.PDF', ''], ['cv.docx', ''], ['cv.txt', 'text/plain'], ['scan', 'application/pdf']]) assert.equal(f(name, 1000, type).ok, true, name);
  assert.match(f('cv.pdf', 6 * 1024 * 1024).message, /6\.0 MB\. The limit is 5 MB/); assert.equal(f('cv.pdf', 5 * 1024 * 1024).ok, true);
  assert.equal(f('cv.docx', 0).code, 'empty');
  for (const [name, type, re] of [['photo.jpg', 'image/jpeg', /image.*no OCR/], ['scan.png', '', /image/], ['cv.doc', 'application/msword', /\.doc.*Save As.*\.docx/], ['cv.pages', '', /Pages/], ['cv.odt', '', /OpenDocument/], ['cv.rtf', '', /not supported/]]) {
    const r = f(name, 1000, type); assert.equal(r.ok, false, name); assert.match(r.message, re); assert.match(r.message, /paste the text/i);
  }
});

/* ---------- UI ---------- */
const doc = f => f.w.document;
const fileOf = (f, bytes, name, type = '') => new f.w.File([new f.w.Uint8Array(bytes)], name, { type });
const type = (f, id, value) => { const el = f.$(id); el.value = value; el.dispatchEvent(new f.w.Event('input', { bubbles: true })); };
function guardNetwork(f) {
  const calls = [];
  f.w.fetch = (...a) => { calls.push(['fetch', String(a[0])]); return Promise.reject(new Error('blocked')); };
  f.w.XMLHttpRequest = function () { calls.push(['xhr']); this.open = this.send = () => {}; };
  f.w.navigator.sendBeacon = (...a) => { calls.push(['beacon', String(a[0])]); return true; };
  return calls;
}
function fakePdfjs(pages) {
  return {
    getDocument: () => ({ promise: Promise.resolve({ numPages: pages.length, destroy() {},
      getPage: async n => ({ getTextContent: async () => ({ items: pages[n - 1].map(i => ({ str: i.str, transform: [i.h || 10, 0, 0, i.h || 10, i.x, i.y], width: i.w ?? i.str.length * 5, height: i.h || 10 })) }) }) }) })
  };
}

test('upload a .docx, then edit the text, check, edit a bullet in place and see it re-checked', async () => {
  const f = fixture({ url: 'https://case.example/#resume' }); try {
    const calls = guardNetwork(f); f.w.DecompressionStream = globalThis.DecompressionStream;
    assert.equal(f.run('view'), 'resume'); assert(f.$('rcPrivacy').textContent.includes('Your file is read in your browser. Nothing is uploaded.'));
    assert.equal(f.$('rcFile').type, 'file'); assert.match(f.$('rcFile').accept, /\.pdf.*\.docx.*\.txt/);
    await f.run('ResumeTool.takeFile')(fileOf(f, docx(), 'Kabir CV.docx'));
    assert.deepEqual(f.$('rcResume').value.split('\n'), EXPECTED_DOCX);
    const info = f.$('rcFileInfo').textContent;
    for (const s of ['Loaded Kabir CV.docx', 'Word (.docx)', '10 lines', '4 bullets found', 'Check the extracted text and fix anything that came through wrong before checking.', 'text boxes, tables']) assert(info.includes(s), s);
    assert.equal(f.$('rcFile').value, '', 'the file input is cleared; the file is not kept');
    // The student fixes a line in the box, then checks. The analysis uses the box, not the file.
    type(f, 'rcResume', f.$('rcResume').value.replace('Line one\nLine two', '• Presented findings to 3 directors, who approved a ₹4 lakh pilot'));
    f.$('rcCheck').click();
    const texts = [...doc(f).querySelectorAll('.rc-btext')].map(e => e.textContent);
    assert.deepEqual(texts, ['Built a Power BI dashboard for 40 stores, cutting reporting time by 6 hours a week', 'Responsible for weekly reports', XSS, 'Presented findings to 3 directors, who approved a ₹4 lakh pilot', 'Analysed 3,000 survey responses in Python to find the three biggest reasons for churn']);
    assert.equal(doc(f).querySelectorAll('#rcResults img, #rcResults script').length, 0); assert.equal(f.w.__x, undefined);
    assert.equal(f.$('rcCount1').textContent, '3 things to look at');
    assert(f.$('rcResults').textContent.includes('Strong action verb'));
    // Edit bullet 2 in place: checks, summary, count and the résumé box all update; the editor keeps focus.
    const ed = f.$('rcEdit1'); ed.focus(); type(f, 'rcEdit1', 'Compiled weekly sales reports for 6 category managers, cutting prep time by half');
    assert.equal(f.$('rcCount1').textContent, 'No warnings'); assert(f.$('rcB1').classList.contains('pass'));
    assert.equal(doc(f).activeElement, ed, 'editing does not re-render the editor');
    assert(f.$('rcResume').value.includes('• Compiled weekly sales reports for 6 category managers, cutting prep time by half') && !f.$('rcResume').value.includes('Responsible for weekly'));
    assert.equal(f.run('ResumeTool.state().analysis.summary.counts.verb'), 0);
    f.$('rcCheck').click(); assert.equal(f.$('rcCount1').textContent, 'No warnings', 'checking again gives the same result');
    // Typing in the résumé box after checking, then editing a bullet, never rewrites the wrong line.
    type(f, 'rcResume', 'EXTRA LINE AT THE TOP\n' + f.$('rcResume').value);
    type(f, 'rcEdit0', 'Built a Power BI dashboard for 40 stores');
    assert(f.$('rcResume').value.startsWith('EXTRA LINE AT THE TOP\nKabir Shah\n'), 'stale line numbers are not used');
    await new Promise(r => setTimeout(r, 450)); assert.equal(f.$('rcText0').textContent, 'Built a Power BI dashboard for 40 stores, cutting reporting time by 6 hours a week');
    type(f, 'rcEdit0', 'Built a Power BI dashboard for 40 stores'); assert(f.$('rcResume').value.includes('\n• Built a Power BI dashboard for 40 stores\n'));
    // Copy improved bullets falls back to a selectable box when the clipboard API is missing; the report downloads as text.
    f.$('rcCopy').click(); assert(f.$('modal').open); assert(f.$('rcCopyText').value.includes('• Compiled weekly sales reports')); assert(f.$('rcCopyText').value.includes('Data Analyst Intern, Acme Foods'));
    f.$('closeModal').click();
    f.run('download = (text, name) => { window.__dl = { text, name }; }'); f.$('rcDownload').click();
    assert.match(f.run('window.__dl.name'), /^case-room-resume-check-\d{4}-\d{2}-\d{2}\.txt$/); assert(f.run('window.__dl.text').includes('Not a score'));
    assert.deepEqual(calls, []); assert.deepEqual(f.errors, []);
    assert.deepEqual(Object.keys(f.w.localStorage).filter(k => k.startsWith('cr-resume')), [], 'nothing stored by default');
  } finally { f.dom.window.close(); }
});

test('PDF and rejected uploads in the page: messages for scanned, unloadable, oversized and unsupported files', async () => {
  const f = fixture({ url: 'https://case.example/#resume' }); try {
    const calls = guardNetwork(f); const take = file => f.run('ResumeTool.takeFile')(file);
    const lines = [item('ASHA VERMA', 72, 760, { w: 70 }), item('EXPERIENCE', 72, 730, { w: 60 }), item('•', 72, 716, { w: 4 }), item('Built a dashboard for the merchandising team that tracks', 82, 716), item('stock-outs across 40 stores and saves 5 hours a week', 82, 702),
      item('•', 72, 688, { w: 4 }), item('Led the analytics club of 60 members and ran 8 workshops on SQL and Excel for first-year students', 82, 688),
      item('SKILLS', 72, 650, { w: 40 }), item('SQL, Excel, Python, Tableau, Power BI', 72, 636)];
    f.run('ResumeFiles').setPdfLoader(async () => fakePdfjs([lines]));
    await take(fileOf(f, Buffer.from('%PDF-1.4'), 'asha.pdf', 'application/pdf'));
    assert.equal(f.$('rcResume').value, 'ASHA VERMA\n\nEXPERIENCE\n• Built a dashboard for the merchandising team that tracks stock-outs across 40 stores and saves 5 hours a week\n• Led the analytics club of 60 members and ran 8 workshops on SQL and Excel for first-year students\n\nSKILLS\nSQL, Excel, Python, Tableau, Power BI');
    assert(f.$('rcFileInfo').textContent.includes('PDF · 1 KB · 6 lines · 2 bullets found')); assert(f.$('rcFileInfo').textContent.includes('Two-column layouts can come out in the wrong order'));
    f.run('ResumeFiles').setPdfLoader(async () => fakePdfjs([[item('Scan', 72, 700)]]));
    await take(fileOf(f, Buffer.from('%PDF-1.4'), 'scan.pdf', 'application/pdf'));
    assert.match(f.$('rcFileInfo').textContent, /scanned or image-only PDF/); assert(f.$('rcResume').value.startsWith('ASHA VERMA'), 'a failed upload leaves the text alone');
    f.run('ResumeFiles').setPdfLoader(() => Promise.reject(new Error('import failed')));
    await take(fileOf(f, Buffer.from('%PDF-1.4'), 'cv.pdf', 'application/pdf'));
    assert(f.$('rcFileInfo').textContent.includes('PDF reading needs the hosted site or npm start. Upload a .docx or paste the text instead.')); assert(f.$('rcFileInfo').querySelector('code'));
    await take(fileOf(f, Buffer.alloc(5 * 1024 * 1024 + 1), 'big.docx')); assert.match(f.$('rcFileInfo').textContent, /big\.docx:.*limit is 5 MB/);
    await take(fileOf(f, Buffer.from('x'), 'photo.png', 'image/png')); assert.match(f.$('rcFileInfo').textContent, /image/);
    await take(fileOf(f, Buffer.from('x'), 'cv.doc')); assert.match(f.$('rcFileInfo').textContent, /\.docx/);
    await take(fileOf(f, Buffer.from('﻿• Built a <b>bold</b> tracker for 9 teams\n'), '<img src=x onerror=window.__x=3>.txt'));
    assert.equal(f.$('rcResume').value, '• Built a <b>bold</b> tracker for 9 teams'); assert.equal(f.$('rcFileInfo').querySelectorAll('img,b:not(:first-child)').length, 0); assert.equal(f.w.__x, undefined);
    // Drag and drop uses the same path.
    const drop = new f.w.Event('drop', { bubbles: true, cancelable: true }); drop.dataTransfer = { files: [fileOf(f, Buffer.from('• Led a team of 3'), 'notes.txt')] };
    f.$('rcDrop').dispatchEvent(drop); await settle(); assert.equal(f.$('rcResume').value, '• Led a team of 3');
    assert.deepEqual(calls, []); assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('without a job description the page still checks the whole résumé, and edits update it live', () => {
  const f = fixture({ url: 'https://case.example/#resume' }); try {
    type(f, 'rcResume', WEAK_RESUME); f.$('rcCheck').click();
    const items = [...doc(f).querySelectorAll('#rcGeneral li')];
    assert.equal(items.length, RC.GENERAL_IDS.length);
    const status = id => doc(f).querySelector(`#rcGeneral li[data-check="${id}"]`).className;
    assert.equal(status('personal'), 'warn'); assert.equal(status('contact'), 'info');
    assert.match(f.$('rcGeneral').textContent, /with or without a job description/); assert.match(f.$('rcGeneral').textContent, /Date of Birth|date of birth/);
    assert.match(f.$('rcMatch').textContent, /work without a job description/); assert.equal(f.$('rcPercent'), null);
    // Showing a listed skill in a bullet updates the skills check as you type.
    assert.match(doc(f).querySelector('#rcGeneral li[data-check="skills"]').textContent, /3 of 3 listed skills/);
    const i = f.run('ResumeTool.state().analysis.bullets.findIndex(b => b.text.startsWith("Analyzed"))');
    type(f, 'rcEdit' + i, 'Analysed 3 months of downtime data in MS Excel and AutoCAD logs');
    assert.match(doc(f).querySelector('#rcGeneral li[data-check="skills"]').textContent, /1 of 3 listed skills appear in no bullet: SolidWorks/);
    assert.equal(status('spelling'), 'pass', 'the -ize spelling is gone');
    // Hostile text in the résumé is escaped in the whole-résumé panel too.
    type(f, 'rcResume', `EXPERIENCE\nIntern, <img src=x onerror="window.__x=9">\nSKILLS\n<script>window.__x=8</script>`); f.$('rcCheck').click();
    assert.equal(doc(f).querySelectorAll('#rcGeneral img, #rcGeneral script').length, 0); assert.equal(f.w.__x, undefined);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('job-description match view, HTML escaping of pasted text, and no network calls during analysis', () => {
  const f = fixture(); try {
    const calls = guardNetwork(f);
    f.$('resumeNav').click(); assert.equal(f.w.location.hash, '#resume');
    f.$('rcCheck').click(); assert.match(f.$('rcResults').textContent, /Paste your résumé text or choose a file first/);
    f.$('rcSample').click(); f.$('rcSampleJd').click(); f.$('rcCheck').click();
    assert.match(f.$('rcPercent').textContent, /^\d+ of the top 20 job-description keywords appear in your résumé \(\d+%\), 3 of them only in your Skills section\.$/);
    const chips = cls => [...doc(f).querySelectorAll(`.rc-chips.${cls} li`)].map(e => e.textContent);
    assert(chips('matched').includes('excel')); assert.deepEqual(chips('skills').sort(), ['pivot tables', 'python', 'sql']); assert(chips('missing').includes('power bi'));
    assert.match(f.$('rcMatch').textContent, /word overlap.*not how a recruiter/s); assert.match(f.$('rcMatch').textContent, /Do not stuff keywords/);
    // Editing a bullet to mention Power BI moves it out of Missing.
    const i = f.run('ResumeTool.state().analysis.bullets.findIndex(b => b.text.startsWith("Worked on"))');
    type(f, 'rcEdit' + i, 'Built a Tableau and Power BI dashboard the café owner uses to track daily sales');
    assert(chips('matched').includes('power bi') && !chips('missing').includes('power bi'));
    // Hostile text in either box is shown as text.
    type(f, 'rcResume', `EXPERIENCE\n• ${XSS}\n• Built <b onmouseover=alert(1)>x</b> for 4 teams`); type(f, 'rcJd', `Requirements: ${XSS} SQL, <img src=y onerror="window.__x=5">`);
    f.$('rcCheck').click();
    assert.equal(doc(f).querySelectorAll('#rcResults img, #rcResults script, #rcResults b[onmouseover]').length, 0); assert.equal(f.w.__x, undefined);
    assert(f.$('rcResults').textContent.includes('<script>window.__x=1</script>'));
    assert.deepEqual(calls, []); assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
  // The analysis code itself never touches the network.
  const saved = { fetch: globalThis.fetch, XMLHttpRequest: globalThis.XMLHttpRequest, navigator: globalThis.navigator }; const hits = [];
  try {
    globalThis.fetch = () => { hits.push('fetch'); throw new Error('no'); }; globalThis.XMLHttpRequest = function () { hits.push('xhr'); };
    Object.defineProperty(globalThis, 'navigator', { value: { sendBeacon: () => hits.push('beacon') }, configurable: true, writable: true });
    const a = RC.analyse(W.SAMPLE_RESUME, W.SAMPLE_JD); RC.reportText(a); RC.improvedBullets(a); RC.pdfItemsToLines([item('x', 1, 1)]); RC.docxXmlToLines(documentXml(), DOMParser);
  } finally { globalThis.fetch = saved.fetch; globalThis.XMLHttpRequest = saved.XMLHttpRequest; Object.defineProperty(globalThis, 'navigator', { value: saved.navigator, configurable: true, writable: true }); }
  assert.deepEqual(hits, []);
  for (const file of ['src/resume-check.js', 'src/resume-files.js', 'src/resume.js', 'content/resume-words.js'])
    assert(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/.test(fs.readFileSync(path.join(root, file), 'utf8')), file + ' has no network calls');
});

test('the keyword lists show the top 20 by default, so the headline can be counted from the chips; "See all" reveals the rest', () => {
  const f = fixture(); try {
    f.$('resumeNav').click(); f.$('rcSample').click(); f.$('rcSampleJd').click(); f.$('rcCheck').click();
    const chips = cls => [...doc(f).querySelectorAll(`#rcMatch .rc-chips${cls ? '.' + cls : ''} li`)];
    const headline = f.$('rcPercent').textContent, [, found, top] = headline.match(/^(\d+) of the top (\d+)/).map(Number);
    assert.equal(chips().length, top); assert.equal(chips('matched').length + chips('skills').length, found);
    assert.equal(chips('skills').length, 3); assert.equal(chips('missing').length, top - found);
    assert.match(f.$('rcScope').textContent, /Showing the top 20 keywords, the ones the headline counts \(10 lower-ranked keywords hidden\)/);
    const more = f.$('rcMoreKeywords'); assert.equal(more.textContent, 'See all 30 keywords'); assert.equal(more.getAttribute('aria-expanded'), 'false');
    more.click();
    assert.equal(chips().length, 30); assert.equal(doc(f).querySelectorAll('#rcMatch .rc-chips li.extra').length, 10);
    assert.equal(f.$('rcMoreKeywords').getAttribute('aria-expanded'), 'true'); assert.equal(doc(f).activeElement, f.$('rcMoreKeywords'));
    assert.match(f.$('rcScope').textContent, /Showing all 30 keywords\. The headline counts only the top 20/);
    assert.equal(f.$('rcPercent').textContent, headline, 'expanding the lists never changes the headline');
    // Editing a bullet keeps the expanded view; a fresh check goes back to the top 20.
    const i = f.run('ResumeTool.state().analysis.bullets.findIndex(b => b.text.startsWith("Worked on"))');
    type(f, 'rcEdit' + i, 'Built a Tableau and Power BI dashboard the café owner uses to track daily sales');
    assert.equal(chips().length, 30); f.$('rcMoreKeywords').click(); assert.equal(chips().length, 20);
    f.$('rcMoreKeywords').click(); f.$('rcCheck').click(); assert.equal(chips().length, 20);
    // A short advert has no hidden keywords and no toggle.
    type(f, 'rcJd', 'Requirements: SQL, Excel, Tableau'); f.$('rcCheck').click();
    assert.equal(f.$('rcMoreKeywords'), null); assert.doesNotMatch(f.$('rcScope').textContent, /hidden/);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('saving is off by default, works when switched on, and the delete button clears it; corrupt storage is ignored', () => {
  const f = fixture({ url: 'https://case.example/#resume' }); let g, h; try {
    const keys = w => Object.keys(w.localStorage).filter(k => k.startsWith('cr-resume')).sort();
    assert.equal(f.$('rcSave').checked, false);
    type(f, 'rcResume', '• Built a model for 3 teams'); type(f, 'rcJd', 'SQL'); f.$('rcCheck').click();
    assert.deepEqual(keys(f.w), []);
    f.$('rcSave').checked = true; f.$('rcSave').dispatchEvent(new f.w.Event('change'));
    assert.deepEqual(keys(f.w), ['cr-resume-jd', 'cr-resume-save', 'cr-resume-text']);
    type(f, 'rcResume', '• Built a model for 4 teams'); assert.equal(JSON.parse(f.w.localStorage.getItem('cr-resume-text')), '• Built a model for 4 teams');
    g = fixture({ url: 'https://case.example/#resume', storage: Object.fromEntries(keys(f.w).map(k => [k, f.w.localStorage.getItem(k)])) });
    assert.equal(g.$('rcSave').checked, true); assert.equal(g.$('rcResume').value, '• Built a model for 4 teams'); assert.equal(g.$('rcJd').value, 'SQL');
    g.$('rcForget').click(); assert.deepEqual(keys(g.w), []); assert.equal(g.$('rcSave').checked, false); assert.equal(g.$('rcResume').value, '• Built a model for 4 teams', 'the boxes keep the text');
    type(g, 'rcResume', 'more text'); assert.deepEqual(keys(g.w), [], 'nothing is saved after deleting');
    // Turning the box off also deletes.
    f.$('rcSave').checked = false; f.$('rcSave').dispatchEvent(new f.w.Event('change')); assert.deepEqual(keys(f.w), []);
    for (const storage of [{ 'cr-resume-save': 'true', 'cr-resume-text': '{not json', 'cr-resume-jd': '42' }, { 'cr-resume-save': '"yes"', 'cr-resume-text': '"hidden"' }, { 'cr-resume-save': '[', 'cr-resume-text': '"x"' }]) {
      h = fixture({ url: 'https://case.example/#resume', storage });
      assert.equal(h.$('rcResume').value, ''); assert.equal(h.$('rcJd').value, ''); assert.deepEqual(h.errors, []); h.dom.window.close(); h = null;
    }
    assert.deepEqual([...f.errors, ...g.errors], []);
  } finally { f.dom.window.close(); g?.dom.window.close(); h?.dom.window.close(); }
});

test('the résumé checker does not interfere with case sessions or the other tools', () => {
  const f = fixture(); try {
    f.run("start('cement')"); f.$('answer').value = 'Case answer'; f.$('answer').dispatchEvent(new f.w.Event('input'));
    f.run('CaseDrill.open()'); f.$('drillStart').click(); f.run("PeerMock.start('market')"); f.run('Behavioural.open()'); f.$('bhStart').click();
    const snap = () => ({ session: f.run('JSON.stringify(session)'), drill: f.run('JSON.stringify(CaseDrill.state().run)'), peer: f.run('JSON.stringify(PeerMock.state().run)'), bh: f.run('JSON.stringify(Behavioural.state().draft)'), apt: f.run('JSON.stringify(Aptitude.state().run)') });
    const before = snap(), storageBefore = Object.keys(f.w.localStorage).sort();
    f.$('resumeNav').click(); assert.equal(f.run('view'), 'resume'); f.$('rcSample').click(); f.$('rcCheck').click(); type(f, 'rcEdit0', 'Prepared 12 weekly sales reports for the category team');
    assert.deepEqual(snap(), before); assert.deepEqual(Object.keys(f.w.localStorage).sort(), storageBefore);
    assert.equal(f.run('history.length'), 0, 'résumé checks are not case sessions');
    f.$('homeNav').click(); assert.equal(f.w.location.hash, ''); assert.equal(doc(f).querySelectorAll('.round-tile').length, 5);
    f.$('round-resume').click(); assert.equal(f.run('view'), 'resume'); assert.equal(f.w.location.hash, '#resume');
    assert(f.$('rcResults').textContent.includes('Prepared 12 weekly sales reports'), 'the last check is still shown when you come back');
    f.$('casesNav').click(); f.$('caseTool-drill').click(); assert.equal(f.w.location.hash, '#drill'); assert(f.$('drillResume'));
    f.$('resumeNav').click(); assert.equal(f.$('rcResume').value.includes('Prepared 12 weekly'), true);
    f.$('privacy').click(); assert(f.$('modalContent').textContent.includes('The résumé checker reads your PDF, Word or text file in your browser: nothing is uploaded'));
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('build and dev server ship the stored pdf.js', () => {
  assert(require('../scripts/build.cjs').STATIC.includes('vendor'));
  assert.match(fs.readFileSync(path.join(root, 'scripts/dev.cjs'), 'utf8'), /'\.mjs':'text\/javascript/);
  for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs', 'LICENSE', 'README.md']) assert(fs.existsSync(path.join(root, 'vendor/pdfjs', f)), f);
  assert.match(fs.readFileSync(path.join(root, 'vendor/pdfjs/README.md'), 'utf8'), /6\.5\.438[\s\S]*Apache License 2\.0/);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert(!html.includes('pdf.min.mjs'), 'pdf.js is not loaded by the page shell');
  assert(html.indexOf('src/resume.js') < html.indexOf('src/ai-client.js'));
});
