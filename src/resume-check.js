/* Résumé checker: the analysis. No DOM access, so Node tests load this file directly.
   - parse(): finds sections, roles and bullets in plain résumé text.
   - lintBullet() / analyse(): per-bullet checks (action verb, number, passive voice, length, filler) and
     cross-bullet checks (repeated opening verbs, mixed tense within a role).
   - extractKeywords() / matchKeywords(): job-description keywords and where they appear in the résumé.
   - pdfItemsToLines(): rebuilds lines from pdf.js text items. docxXmlToLines(): turns word/document.xml into lines.
   Every check is a heuristic. The UI says so, and nothing here pretends to be a recruiter or an applicant tracking system. */
(function (root) {
  const W = typeof module !== 'undefined' && module.exports ? require('../content/resume-words.js') : root.ResumeWords;

  /* ---------- Small helpers ---------- */
  const lower = s => String(s ?? '').toLowerCase();
  const words = s => String(s).trim().split(/\s+/).filter(Boolean);
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const uniq = list => [...new Set(list)];
  function cleanText(s) {
    return String(s ?? '').replace(/\r\n?/g, '\n').replace(/[   ]/g, ' ').replace(/\t/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/­/g, '');
  }

  /* ---------- Verbs ---------- */
  const PAST = new Set(Object.values(W.VERB_GROUPS).flat());
  const SAME = new Set(W.SAME_TENSE);
  const PRESENT = new Map(); // present-tense or -ing form -> past form
  function presentForms(past) {
    if (W.IRREGULAR_PRESENT[past]) { const b = W.IRREGULAR_PRESENT[past]; return [b, b.replace(/^(\w+)/, '$1s'), b.replace(/^(\w+?)e?(\b)/, '$1ing$2')]; }
    if (past.includes(' ')) return [];
    const bases = [];
    if (/ied$/.test(past)) bases.push(past.slice(0, -3) + 'y');
    else if (/ed$/.test(past)) { bases.push(past.slice(0, -2), past.slice(0, -1)); if (/([bdglmnprt])\1ed$/.test(past)) bases.push(past.slice(0, -3)); }
    else bases.push(past);
    const out = [];
    for (const b of bases) {
      out.push(b, /(s|sh|ch|x|z)$/.test(b) ? b + 'es' : /[^aeiou]y$/.test(b) ? b.slice(0, -1) + 'ies' : b + 's', /e$/.test(b) && !/ee$/.test(b) ? b.slice(0, -1) + 'ing' : b + 'ing');
      if (/([bdglmnprt])\1ed$/.test(past)) out.push(b + b.slice(-1) + 'ing');
    }
    return out;
  }
  for (const v of PAST) for (const f of presentForms(v)) if (f.length > 2 && !PAST.has(f) && !PRESENT.has(f)) PRESENT.set(f, v);
  for (const s of SAME) PRESENT.delete(s);
  const WEAK = W.WEAK_OPENERS.slice().sort((a, b) => b[0].length - a[0].length);
  const NOT_VERBS = new Set(['based', 'interested', 'skilled', 'experienced', 'talented', 'motivated', 'dedicated', 'focused', 'seasoned', 'detailed', 'red', 'need', 'speed', 'seed', 'bed', 'shed', 'feed', 'united', 'limited', 'advanced', 'renowned', 'reputed', 'esteemed']);

  /** The opening verb of a bullet: { word, phrase, kind: 'strong'|'weak'|'first-person'|'other', tense, fix }. */
  function opener(text) {
    let t = lower(cleanText(text)).replace(/^[^a-z]+/, '');
    const first0 = (t.match(/^[a-z'-]+/) || [''])[0];
    if (W.FIRST_PERSON.includes(first0)) return { word: first0, kind: 'first-person', tense: null };
    for (const [phrase, fix] of WEAK) if (t === phrase || t.startsWith(phrase + ' ') || t.startsWith(phrase + ',')) return { word: phrase, kind: 'weak', tense: /ing$/.test(phrase) ? 'present' : null, fix };
    let skipped = '';
    if (/^[a-z]+ly\s/.test(t) && !/^(apply|supply|rely|reply|fly)\s/.test(t)) { skipped = t.match(/^[a-z]+ly/)[0]; t = t.slice(skipped.length).trim(); }
    const two = (t.match(/^[a-z'-]+\s+[a-z'-]+/) || [''])[0], one = (t.match(/^[a-z'-]+/) || [''])[0];
    if (PAST.has(two)) return { word: two, kind: 'strong', tense: SAME.has(two) ? null : 'past', skipped };
    if (PAST.has(one)) return { word: one, kind: 'strong', tense: SAME.has(one) ? null : 'past', skipped };
    if (PRESENT.has(one)) return { word: one, kind: 'strong', tense: 'present', past: PRESENT.get(one), skipped };
    if (/^[a-z]{4,}ed$/.test(one) && !NOT_VERBS.has(one)) return { word: one, kind: 'strong', tense: 'past', listed: false, skipped };
    return { word: one, kind: 'other', tense: null, skipped };
  }

  /* ---------- Per-bullet checks ---------- */
  const LABELS = { verb: 'Strong action verb', number: 'Number or measurable result', passive: 'Active voice (heuristic)', length: 'Length', filler: 'No filler or vague words', repeat: 'Varied opening verbs', tense: 'Consistent tense' };
  const CHECK_IDS = Object.keys(LABELS);
  const LIMITS = { minWords: 8, maxWords: 30, maxChars: 200 }; // 200 characters is about two lines of a typical one-column résumé
  const NUMBER_RE = new RegExp(`(^|[^a-z0-9])\\d|[%₹$€£]|\\brs\\.?\\s?\\d|\\binr\\b|\\b(${W.NUMBER_WORDS.join('|')})\\b`, 'i');
  const NUMBER_SHOW = new RegExp(`(?:[₹$€£]\\s?|\\brs\\.?\\s?)?(?<![a-z0-9])\\d[\\d,.]*(?:\\s?(?:%|x\\b|k\\b|lakhs?\\b|crores?\\b|million\\b|billion\\b|percent\\b))?|\\b(?:${W.NUMBER_WORDS.join('|')})\\b|[%₹$€£]`, 'i');
  const YEAR_RE = /\b(?:19|20)\d{2}\b(?:\s*[–—-]\s*(?:(?:19|20)?\d{2}\b|present|now))?|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+'?\d{2}\b/gi;
  const BE = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);
  const IRREGULAR_PARTICIPLES = new Set(('built made done run won taught written given taken shown known held kept sold sent brought bought found paid told seen begun chosen drawn driven grown ' +
    'spoken broken led met spent lost left understood overseen undertaken set put cut hit thrown laid sought thought caught fought rewritten rebuilt hidden forgotten proven shut split').split(' '));
  const ADJ_ED = new Set(['based', 'located', 'interested', 'excited', 'skilled', 'experienced', 'qualified', 'dedicated', 'motivated', 'involved', 'required', 'needed', 'supposed',
    'concerned', 'pleased', 'tired', 'married', 'aged', 'talented', 'detailed', 'focused', 'committed', 'engaged', 'limited', 'advanced', 'varied', 'satisfied', 'determined', 'used', 'named', 'listed']);
  const FILLER = W.FILLER.map(([term, fix]) => ({ term, fix, re: new RegExp(`(^|[^a-z])${escRe(term)}(?=[^a-z]|$)`, 'i') }));

  function passiveOf(text) {
    const t = lower(text).replace(/[^a-z'\s-]/g, ' ').split(/\s+/).filter(Boolean);
    for (let i = 0; i < t.length - 1; i++) {
      if (!BE.has(t[i])) continue;
      let j = i + 1; if (/ly$/.test(t[j]) && j + 1 < t.length) j++;
      const w = t[j];
      if (IRREGULAR_PARTICIPLES.has(w) || (/^[a-z]{3,}ed$/.test(w) && !ADJ_ED.has(w))) return t.slice(i, j + 1).join(' ');
    }
    return '';
  }
  const result = (id, status, reason, fix = '') => ({ id, label: LABELS[id], status, reason, fix });

  /** Checks that need only the bullet itself. Returns { checks: [...], opener }. */
  function lintBullet(text) {
    text = cleanText(text).replace(/\s+/g, ' ').trim();
    const op = opener(text), checks = [];
    if (op.kind === 'first-person') checks.push(result('verb', 'warn', `Starts with "${cap(op.word)}". Résumés leave out the first person.`, 'Drop the pronoun and start with the verb: "Organised…", not "I organised…".'));
    else if (op.kind === 'weak') checks.push(result('verb', 'warn', `"${cap(op.word)}" describes a duty or a supporting part, not what you achieved.`, op.fix));
    else if (op.kind === 'strong') checks.push(result('verb', 'pass', `Starts with ${op.tense === 'present' ? 'a present-tense' : 'an'} action verb ("${cap(op.word)}")${op.skipped ? `, after "${op.skipped}"` : ''}.`));
    else checks.push(result('verb', 'warn', op.word ? `Starts with "${cap(op.word)}", which is not in the action-verb list.` : 'No opening word found.', `Lead with what you did: "[Verb] [what] [result]", e.g. ${W.SUGGEST.slice(0, 4).map(v => `"${v}…"`).join(', ')}.`));

    const numberText = text.replace(YEAR_RE, ' ');
    const num = NUMBER_RE.test(numberText) && (numberText.match(NUMBER_SHOW) || [''])[0].trim();
    checks.push(num ? result('number', 'pass', `Includes a number or measurable result ("${num}").`)
      : result('number', 'warn', 'No number or measurable result. Not every bullet can have one.', 'If you can, add scale or outcome: how many, how much, how often, how fast, or by what %. Use only figures you can explain in an interview.'));

    const pv = passiveOf(text);
    checks.push(pv ? result('passive', 'warn', `"${pv}" reads as passive voice (a word-pattern heuristic; it can be wrong).`, 'Put yourself as the subject: "Cleaned the sales data…" rather than "The data was cleaned…".')
      : result('passive', 'pass', 'No passive pattern found.'));

    const n = words(text).length, chars = text.length;
    if (n < LIMITS.minWords) checks.push(result('length', 'warn', `Short: ${n} word${n === 1 ? '' : 's'}.`, 'Add what it achieved or its scale: "[Verb] [what] for [whom], [result]".'));
    else if (n > LIMITS.maxWords) checks.push(result('length', 'warn', `Long: ${n} words.`, 'Cut to the action and the result, or split it into two bullets.'));
    else if (chars > LIMITS.maxChars) checks.push(result('length', 'warn', `Runs past about two lines (${chars} characters).`, 'Trim words that do not add a fact, such as "in order to" or "various".'));
    else checks.push(result('length', 'pass', `${n} words.`));

    const found = FILLER.filter(f => f.re.test(text));
    const shown = found.filter(f => !found.some(g => g !== f && g.term.length > f.term.length && g.term.includes(f.term)));
    checks.push(shown.length ? result('filler', 'warn', `Vague or filler words: ${shown.map(f => `"${f.term}"`).join(', ')}.`, uniq(shown.map(f => `${cap(f.term)}: ${f.fix}`)).join(' '))
      : result('filler', 'pass', 'No filler words from the list.'));
    return { checks, opener: op };
  }

  /* ---------- Structure ---------- */
  const BULLET_RE = /^\s*(?:[•●▪◦‣∙○■□►▸▹➢➤✓✔❖◆◇·*]|[-–—](?=\s)|\(?\d{1,2}[.)](?=\s))\s*/;
  const LINT_TYPES = ['experience', 'projects', 'responsibility', 'achievements'];
  const PARAGRAPH_TYPES = ['experience', 'projects', 'responsibility'];
  const HEADINGS = new Map(); for (const [type, names] of Object.entries(W.SECTIONS)) for (const n of names) HEADINGS.set(n, type);
  const DATE_RE = /\b(?:19|20)\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*'?\d{2,4}\b|\b(?:present|current|till date|to date|ongoing)\b/i;
  const CURRENT_RE = /\b(?:present|current|currently|now|till date|to date|ongoing)\b/i;

  function headingType(line) {
    const key = lower(line).replace(/&/g, ' and ').replace(/\(.*?\)/g, ' ').replace(/[^a-z\s'-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!key || words(key).length > 6) return null;
    return HEADINGS.get(key) || null;
  }
  function isCapsHeading(line) {
    const t = line.trim(), letters = t.replace(/[^A-Za-z]/g, '');
    return letters.length >= 3 && t.length <= 40 && words(t).length <= 5 && t === t.toUpperCase() && !/[.!?,;]$/.test(t) && !BULLET_RE.test(t) && !/\d{3,}/.test(t) && !/@/.test(t);
  }

  /** Splits plain résumé text into sections, roles and bullets. Line numbers refer to text.split('\n'). */
  function parse(text) {
    const raw = cleanText(text).split('\n');
    const lines = raw.map((r, i) => ({ i, raw: r, text: r.trim(), kind: r.trim() ? 'text' : 'blank' }));
    let known = 0;
    for (const l of lines) if (l.kind === 'text' && (headingType(l.text) || isCapsHeading(l.text))) { l.kind = 'heading'; l.type = headingType(l.text); if (l.type) known++; }
    const sections = [], roles = [], bullets = [];
    let section = { title: '', type: known ? 'top' : 'experience', line: -1 }, role = null;
    const lintable = () => LINT_TYPES.includes(section.type);
    const nextText = i => { for (let j = i + 1; j < lines.length; j++) if (lines[j].kind !== 'blank') return lines[j]; return null; };
    const newRole = (title, line) => { role = { id: roles.length, title, line, sectionType: section.type, section: section.title, current: CURRENT_RE.test(title), dated: DATE_RE.test(title), bullets: [] }; roles.push(role); return role; };
    const addBullet = (l, prefix, body) => {
      if (!role || role.sectionType !== section.type || role.section !== section.title) newRole('', -1);
      const b = { id: bullets.length, text: body, prefix, start: l.i, end: l.i, section: section.title, sectionType: section.type, role: role.id, lint: lintable() };
      bullets.push(b); role.bullets.push(b.id); l.kind = 'bullet'; l.bullet = b.id; return b;
    };
    for (let k = 0; k < lines.length; k++) {
      const l = lines[k];
      if (l.kind === 'blank') continue;
      if (l.kind === 'heading' && !l.type && (section.type === 'skills' || SKILL_KEYS.has(tokenize(l.text).map(t => t.key).join(' ')))) { l.kind = 'text'; delete l.type; } // "SQL" or "AWS" on its own line is a skill, not a heading
      if (l.kind === 'heading') {
        if (!l.type && lintable() && sections.length) { l.kind = 'role'; newRole(l.text, l.i); continue; } // e.g. a company name in capitals under Experience
        section = { title: l.text, type: l.type || 'other', line: l.i }; sections.push(section); role = null; continue;
      }
      const m = l.text.match(BULLET_RE);
      if (m && l.text.slice(m[0].length).trim()) { addBullet(l, m[0].trim(), l.text.slice(m[0].length).trim()); continue; }
      // A lower-case line straight after a bullet is the bullet wrapping onto the next line.
      const prev = lines[k - 1];
      if (prev && prev.kind === 'bullet' && /^[a-z(]/.test(l.text)) { const b = bullets[prev.bullet]; b.text += ' ' + l.text; b.end = l.i; l.kind = 'bullet'; l.bullet = b.id; l.continuation = true; continue; }
      if (lintable()) {
        const op = opener(l.text), n = words(l.text).length, next = nextText(k);
        const verbish = op.kind !== 'other';
        // A dated line is a role unless it opens with a past-tense or weak verb ("Volunteer, Food Bank (2023)" is a role; "Organised the 2024 fest" is not).
        const dated = DATE_RE.test(l.text) && n <= 16 && op.tense !== 'past' && op.kind !== 'weak' && op.kind !== 'first-person';
        const isRole = dated || (!verbish && ((n <= 10 && next && next.kind !== 'heading' && BULLET_RE.test(next.text)) || (n <= 6 && !/[.!?]$/.test(l.text))));
        if (isRole) { l.kind = 'role'; newRole(l.text, l.i); continue; }
        if (PARAGRAPH_TYPES.includes(section.type)) { addBullet(l, '', l.text); continue; }
      }
    }
    return { lines, sections, roles, bullets, headingsFound: known };
  }

  /** Counts for the upload note: non-blank lines and bullets. */
  function stats(text) { const p = parse(text); return { lines: p.lines.filter(l => l.kind !== 'blank').length, bullets: p.bullets.length, checked: p.bullets.filter(b => b.lint).length, sections: p.sections.length }; }

  /* ---------- Whole-résumé analysis ---------- */
  function alternativesFor(verb, used) {
    const pool = uniq(Object.values(W.VERB_GROUPS).filter(g => g.includes(verb)).flat());
    // Suggest one spelling of each verb (the British one) and nothing already used as an opener.
    return pool.filter(v => v !== verb && !used.has(v) && !v.includes(' ') && !(/iz/.test(v) && pool.includes(v.replace(/iz/, 'is')))).slice(0, 3);
  }

  /* ---------- Whole-résumé checks: these need no job description ---------- */
  const GENERAL_LABELS = { contact: 'Contact details', sections: 'Core sections', length: 'Overall length', personal: 'No unneeded personal details', summary: 'Summary or objective',
    roles: 'Bullets under every role', dates: 'Dates', formatting: 'Consistent formatting', spelling: 'Consistent spelling', skills: 'Skills shown in bullets' };
  const GENERAL_IDS = Object.keys(GENERAL_LABELS);
  const gres = (id, status, reason, fix = '', items = []) => ({ id, label: GENERAL_LABELS[id], status, reason, fix, items });
  const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, PHONE_RE = /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,5}\b/;
  const LINK_RE = /\b(linkedin\.com\/in\/|github\.com\/|behance\.net\/|kaggle\.com\/|portfolio|https?:\/\/)/i;
  const MONTH_DATE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*'?\d{2,4}\b/i, NUMERIC_DATE = /\b(?:0?[1-9]|1[0-2])[\/-](?:19|20)\d{2}\b/; // "05/2025", not "8.4/10"
  const WORDS_PER_PAGE = 500; // a dense one-column A4 page holds roughly 450–550 words

  /** Searchable token strings for each zone of the résumé: bullet text, Skills, and everything else. */
  function zonesOf(parsed) {
    const zones = { bullet: [], skills: [], other: [] };
    let type = parsed.headingsFound ? 'top' : 'experience';
    for (const l of parsed.lines) {
      if (l.kind === 'heading') { type = l.type || 'other'; continue; }
      if (l.kind === 'blank' || l.continuation) continue;
      const text = l.kind === 'bullet' ? parsed.bullets[l.bullet].text : l.text;
      const zone = l.kind === 'bullet' && type !== 'skills' ? 'bullet' : type === 'skills' ? 'skills' : 'other';
      for (const seg of text.split(SEGMENT_RE)) if (seg && seg.trim()) zones[zone].push(' ' + tokenize(seg).map(t => t.key).join(' ') + ' ');
    }
    zones.has = (zone, key) => zones[zone].some(s => s.includes(' ' + key + ' '));
    return zones;
  }
  /** Items listed under Skills: split on commas, pipes, slashes, brackets, "and"; labels before a colon and levels such as "basic" dropped. */
  function skillItems(parsed) {
    const out = []; let type = parsed.headingsFound ? 'top' : 'experience';
    for (const l of parsed.lines) {
      if (l.kind === 'heading') { type = l.type || 'other'; continue; }
      if (type !== 'skills' || l.kind === 'blank') continue;
      const text = (l.kind === 'bullet' ? parsed.bullets[l.bullet].text : l.text).replace(/^[^:]{1,30}:\s*/, '');
      for (let item of text.split(/[,;|•·/()[\]]|\s[-–—]\s|\band\b|&/i)) {
        item = item.trim().replace(new RegExp(`\\b(${W.SKILL_QUALIFIERS.join('|')})\\b`, 'gi'), '').replace(/\s+/g, ' ').replace(/^[\s.:-]+|[\s.:-]+$/g, '');
        if (!item || words(item).length > 4 || !/[a-z]/i.test(item) || W.SPOKEN_LANGUAGES.includes(lower(item))) continue;
        const key = tokenize(item).map(t => t.key).join(' ');
        if (key && !out.some(o => o.key === key)) out.push({ display: item, key });
      }
    }
    return out;
  }

  /** Checks that look at the résumé as a whole. Each is { id, label, status: 'pass'|'warn'|'info', reason, fix, items }. */
  function generalChecks(parsed, list = parsed.bullets.filter(b => b.lint)) {
    const text = parsed.lines.map(l => l.raw).join('\n'), checks = [];
    const types = new Set(parsed.sections.map(s => s.type));
    // Contact details, usually in the first few lines.
    const email = text.match(EMAIL_RE), phone = text.replace(EMAIL_RE, ' ').replace(/\b(?:19|20)\d{2}\s*[–—-]\s*(?:(?:19|20)\d{2}|\d{2})\b/g, ' ').match(PHONE_RE), link = LINK_RE.test(text);
    const missing = [!email && 'email address', !phone && 'phone number'].filter(Boolean);
    if (missing.length) checks.push(gres('contact', 'warn', `No ${missing.join(' or ')} found.`, 'Put your email and phone number at the top, under your name.'));
    else checks.push(gres('contact', link ? 'pass' : 'info', link ? 'Email, phone number and a profile link found.' : 'Email and phone number found. No LinkedIn, GitHub or portfolio link.', link ? '' : 'Add a LinkedIn profile, or a GitHub or portfolio link if it shows relevant work.'));
    // Sections a campus résumé is expected to have.
    const need = [['education', 'Education'], [types.has('experience') || types.has('projects') ? 'experience' : null, 'Experience or Projects'], ['skills', 'Skills']]
      .filter(([t]) => !t || !types.has(t)).map(([, name]) => name);
    if (!parsed.headingsFound) checks.push(gres('sections', 'warn', 'No section headings found.', 'Add headings on their own lines, such as EDUCATION, EXPERIENCE, PROJECTS and SKILLS, so readers (and this checker) can find each part.'));
    else if (need.length) checks.push(gres('sections', 'warn', `Missing: ${need.join(', ')}.`, need.includes('Experience or Projects') ? 'With no internship yet, a Projects section (course, personal or competition work) shows what you can do.' : 'Add the missing section, even if it is short.', need));
    else checks.push(gres('sections', 'pass', `Found ${parsed.sections.filter(s => s.type !== 'other').map(s => s.title.replace(/:$/, '')).join(', ')}.`));
    // Length, estimated from words (the checker cannot see the page layout).
    const n = words(text).length, pages = n / WORDS_PER_PAGE, fresher = !types.has('experience');
    if (n < 150) checks.push(gres('length', 'warn', `About ${n} words: very short.`, 'Add projects, coursework, positions of responsibility or achievements, each with what you did and what came of it.'));
    else if (pages > 2) checks.push(gres('length', 'warn', `About ${n} words, likely more than two pages.`, 'Cut to one page for campus roles, two at most: keep the 3–5 strongest bullets per role.'));
    else if (fresher && pages > 1.2) checks.push(gres('length', 'warn', `About ${n} words, likely more than one page.`, 'For a fresher, one page is the norm. Drop school-level details and the weakest bullets.'));
    else checks.push(gres('length', 'pass', `About ${n} words (an estimate; roughly ${pages <= 1.1 ? 'one page' : 'one to two pages'}).`));
    // Personal details.
    const personal = W.PERSONAL.filter(([, re]) => re.test(text)).map(([label]) => label);
    checks.push(personal.length ? gres('personal', 'warn', `Found: ${personal.join(', ')}.`, 'Recruiters do not need these and they take space that your work could use. Remove them unless an employer specifically asks.', personal)
      : gres('personal', 'pass', 'No date of birth, marital status, declaration or similar.'));
    // Summary or objective.
    const summaryLines = []; let st = null;
    for (const l of parsed.lines) { if (l.kind === 'heading') { st = l.type; continue; } if (st === 'summary' && l.kind !== 'blank') summaryLines.push(l.text); }
    const summaryText = lower(summaryLines.join(' ')), cliches = W.OBJECTIVE_CLICHES.filter(c => summaryText.includes(c));
    if (!types.has('summary')) checks.push(gres('summary', 'info', 'No summary or objective. That is fine on a one-page campus résumé.', 'One or two lines on who you are and your strongest evidence, aimed at the role.'));
    else if (cliches.length) checks.push(gres('summary', 'warn', `Stock phrases: ${cliches.map(c => `"${c}"`).join(', ')}.`, 'Say who you are, your strongest proof and the role you want, e.g. "Final-year BBA student who built a demand model that cut stock-outs by 18%; looking for business analyst roles."', cliches));
    else if (words(summaryText).length > 60) checks.push(gres('summary', 'warn', `The summary is ${words(summaryText).length} words.`, 'Keep it to two or three lines; the bullets carry the detail.'));
    else checks.push(gres('summary', 'pass', 'Summary present, with no stock phrases from the list.'));
    // Roles with no bullets, or with too many.
    const roleIssues = [];
    for (const r of parsed.roles) {
      if (!r.title || !['experience', 'responsibility', 'projects'].includes(r.sectionType)) continue;
      const count = r.bullets.filter(id => parsed.bullets[id].lint).length;
      if (!count) roleIssues.push(`"${r.title}" has no bullets`); else if (count > 6) roleIssues.push(`"${r.title}" has ${count} bullets`);
    }
    checks.push(roleIssues.length ? gres('roles', 'warn', roleIssues.join('; ') + '.', 'Give each role 2–5 bullets on what you did and what came of it; cut the weakest beyond five or six.', roleIssues)
      : gres('roles', 'pass', 'Every role has between one and six bullets.'));
    // Dates on experience entries, written one way.
    const undated = parsed.roles.filter(r => r.title && r.sectionType === 'experience' && !r.dated).map(r => r.title);
    const dateLines = parsed.lines.filter(l => l.kind === 'role' || (l.kind === 'text' && DATE_RE.test(l.text))).map(l => l.text);
    const styles = [dateLines.some(t => MONTH_DATE.test(t)) && 'month names (May 2025)', dateLines.some(t => NUMERIC_DATE.test(t)) && 'numbers (05/2025)'].filter(Boolean);
    if (undated.length) checks.push(gres('dates', 'warn', `No dates on: ${undated.map(t => `"${t}"`).join(', ')}.`, 'Add month and year for the start and end, e.g. "May 2025 – Jul 2025".', undated));
    else if (styles.length > 1) checks.push(gres('dates', 'warn', `Dates are written two ways: ${styles.join(' and ')}.`, 'Pick one format, e.g. "May 2025 – Jul 2025", and use it everywhere.'));
    else checks.push(gres('dates', 'pass', types.has('experience') ? 'Experience entries are dated, in one format.' : 'No mixed date formats found.'));
    // Bullet markers and full stops.
    const marked = list.filter(b => b.prefix), kinds = uniq(marked.map(b => /^\(?\d/.test(b.prefix) ? '1.' : b.prefix));
    const stops = list.filter(b => /[.]$/.test(b.text)).length, noStops = list.length - stops, fmt = [];
    if (kinds.length > 1) fmt.push(`bullets start with different markers (${kinds.join(' ')})`);
    if (stops >= 2 && noStops >= 2) fmt.push(`${stops} bullets end with a full stop and ${noStops} do not`);
    checks.push(fmt.length ? gres('formatting', 'warn', cap(fmt.join('; ')) + '.', 'Use one bullet marker, and either end every bullet with a full stop or none.', fmt)
      : gres('formatting', 'pass', 'Bullet markers and full stops are consistent.'));
    // British and American spellings mixed.
    const brit = new Set(), amer = new Set();
    for (const stem of W.SPELLING_STEMS) for (const m of text.matchAll(new RegExp(`\\b${stem}([sz])(e|ed|es|er|ers|ing|ation|ations)\\b`, 'gi'))) (m[1].toLowerCase() === 's' ? brit : amer).add(lower(m[0]));
    checks.push(brit.size && amer.size ? gres('spelling', 'warn', `Both spellings: ${[...brit].slice(0, 3).join(', ')} and ${[...amer].slice(0, 3).join(', ')}.`, 'Pick British (-ise, as most Indian employers use) or American (-ize) spelling and use it throughout.', [...brit, ...amer])
      : gres('spelling', 'pass', 'No mix of -ise and -ize spellings found.'));
    // Skills listed but never shown in use.
    const items = skillItems(parsed), zones = zonesOf(parsed);
    if (!types.has('skills') || !items.length) checks.push(gres('skills', 'info', 'No Skills section to compare with your bullets.', 'List the tools and skills you have used, then make sure a bullet shows each one in use.'));
    else {
      const unshown = items.filter(i => !zones.has('bullet', i.key) && !zones.has('other', i.key)).map(i => i.display);
      checks.push(unshown.length ? gres('skills', 'warn', `${unshown.length} of ${items.length} listed skills appear in no bullet: ${unshown.join(', ')}.`, 'A skill is more believable when a bullet shows it in use: "Built a demand model in Excel…". Add one where it is true; otherwise consider dropping the skill.', unshown)
        : gres('skills', 'pass', `All ${items.length} listed skills appear in your bullets or other sections.`));
    }
    return checks;
  }

  function analyse(resumeText, jdText = '', opts = {}) {
    const parsed = parse(resumeText);
    const list = parsed.bullets.filter(b => b.lint);
    for (const b of list) { const r = lintBullet(b.text); b.checks = r.checks; b.opener = r.opener; }
    // Repeated opening verbs: three or more anywhere, or two within one role.
    const openers = list.filter(b => b.opener.kind === 'strong').map(b => b.opener.past || b.opener.word);
    const used = new Set(openers), count = {}, seen = {}, roleSeen = {};
    for (const v of openers) count[v] = (count[v] || 0) + 1;
    for (const b of list) {
      const v = b.opener.kind === 'strong' ? (b.opener.past || b.opener.word) : null;
      if (!v) { b.checks.push(result('repeat', 'pass', 'Opening verb not repeated.')); continue; }
      const key = b.role + '|' + v; seen[v] = (seen[v] || 0) + 1; roleSeen[key] = (roleSeen[key] || 0) + 1;
      const inRole = parsed.roles[b.role].bullets.filter(id => { const o = parsed.bullets[id].opener; return o && o.kind === 'strong' && (o.past || o.word) === v; }).length;
      if ((count[v] >= 3 && seen[v] > 1) || (inRole >= 2 && roleSeen[key] > 1)) {
        const alt = alternativesFor(v, used);
        b.checks.push(result('repeat', 'warn', count[v] >= 3 ? `"${cap(v)}" starts ${count[v]} bullets.` : `"${cap(v)}" starts ${inRole} bullets in this role.`, alt.length ? `Where it fits, try ${alt.map(a => `"${cap(a)}"`).join(', ')}.` : 'Vary the verb where another one is more precise.'));
      } else b.checks.push(result('repeat', 'pass', 'Opening verb not overused.'));
    }
    // Tense, per role: a finished role should be in the past tense; flag a role that mixes the two.
    for (const role of parsed.roles) {
      const rb = role.bullets.map(id => parsed.bullets[id]).filter(b => b.lint);
      const past = rb.filter(b => b.opener.tense === 'past'), present = rb.filter(b => b.opener.tense === 'present');
      const finished = role.dated && !role.current;
      const mixed = past.length && present.length;
      const flag = new Set(finished || (mixed && present.length <= past.length) ? present : mixed ? past : []);
      role.tense = { past: past.length, present: present.length, mixed: !!mixed };
      for (const b of rb) {
        if (!flag.has(b)) { b.checks.push(result('tense', 'pass', mixed ? 'Matches most bullets in this role.' : 'Consistent with the rest of this role.')); continue; }
        const fixVerb = b.opener.past ? `"${cap(b.opener.past)}"` : 'the past tense';
        if (finished) b.checks.push(result('tense', 'warn', `"${cap(b.opener.word)}" is present tense, but this role has ended.`, `Use ${fixVerb}.`));
        else if (b.opener.tense === 'present') b.checks.push(result('tense', 'warn', `This role mixes present ("${cap(b.opener.word)}") and past tense.`, `Pick one: past tense (${fixVerb}) for finished work; present tense only for ongoing work in a current role.`));
        else b.checks.push(result('tense', 'warn', `This role mixes past ("${cap(b.opener.word)}") and present tense.`, 'Pick one: present tense for ongoing work in a current role, past tense for results already achieved.'));
      }
    }
    for (const b of list) { b.checks.sort((x, y) => CHECK_IDS.indexOf(x.id) - CHECK_IDS.indexOf(y.id)); b.issues = b.checks.filter(c => c.status === 'warn').length; }
    const summary = summarise(list), general = generalChecks(parsed, list);
    const match = String(jdText || '').trim() ? matchKeywords(extractKeywords(jdText, opts), parsed) : null;
    return { parsed, bullets: list, roles: parsed.roles, summary, general, match };
  }

  function summarise(list) {
    const counts = {}; for (const id of CHECK_IDS) counts[id] = list.filter(b => b.checks.some(c => c.id === id && c.status === 'warn')).length;
    const withNumber = list.length - counts.number;
    return { total: list.length, counts, labels: LABELS, withNumber, numberShare: list.length ? withNumber / list.length : 0, clean: list.filter(b => !b.issues).length };
  }

  /* ---------- Keywords ---------- */
  const STOP = new Set(W.STOP), GENERIC = new Set([...W.GENERIC, ...('find turn run build drive driving own deliver identify maintain prepare perform conduct handle achieve grow growing contribute ' +
    'assist collaborate partner partnering think thinking clear fast-paced fast paced senior junior first top right wide great best large small high low across along various able ' +
    // Words too broad to be useful on their own; they still count inside phrases such as "data analysis".
    'data business manager managers store stores performance impact decision decisions finding findings result results insight insights recommendation recommendations ' +
    'information issue issues need goal goals task tasks project projects problem problems solution solutions value level levels area areas part way ways scale end').split(' ')]);
  const TOKEN_RE = /[a-z0-9][a-z0-9+#&./'-]*[a-z0-9+#]|[a-z0-9]/gi;
  function stem(w) {
    if (w.length <= 3 || /[^a-z-]/.test(w)) return w;
    if (/^analy[sz]|^analytic/.test(w)) return 'analy';
    let s = w.replace(/isation(s?)$/, 'ization$1').replace(/is(e|es|ed|er|ers|ing)$/, 'iz$1').replace(/ys(e|es|ed|ing)$/, 'yz$1').replace(/elling$/, 'eling').replace(/elled$/, 'eled');
    if (s.length > 5) s = s.replace(/our$/, 'or').replace(/ours$/, 'ors');
    if (/sses$/.test(s)) s = s.slice(0, -2); else if (/ies$/.test(s) && s.length > 4) s = s.slice(0, -3) + 'y'; else if (/[^su]s$/.test(s) && !/(is|us|ss)$/.test(s)) s = s.slice(0, -1);
    for (const [suf, rep] of [['ational', 'ate'], ['ization', 'ize'], ['ation', 'ate'], ['ments', ''], ['ment', ''], ['ness', ''], ['ings', ''], ['ing', ''], ['ers', ''], ['er', ''], ['ed', '']]) {
      if (s.endsWith(suf) && s.length - suf.length + rep.length >= 3 && /[aeiouy]/.test(s.slice(0, s.length - suf.length))) { s = s.slice(0, s.length - suf.length) + rep; break; }
    }
    s = s.replace(/e$/, ''); if (/([^aeiouls])\1$/.test(s)) s = s.slice(0, -1);
    return s.length >= 3 ? s : w;
  }
  const VARIANTS = W.VARIANTS.map(([from, to]) => [from.match(TOKEN_RE).map(lower), to.match(TOKEN_RE).map(lower)]).sort((a, b) => b[0].length - a[0].length);
  /** Tokens of one segment as [{ low, orig, key }], with variants mapped and stems computed. */
  function tokenize(segment) {
    let toks = (String(segment).match(TOKEN_RE) || []).flatMap(t => {
      t = t.replace(/'s$/i, '');
      if (t.includes('/') && !/^(a\/b|ai\/ml|ui\/ux)$/i.test(t)) return t.split('/').filter(Boolean);
      return [t];
    }).map(t => ({ low: lower(t), orig: t }));
    const out = [];
    for (let i = 0; i < toks.length;) {
      const v = VARIANTS.find(([from]) => from.every((f, k) => toks[i + k] && toks[i + k].low === f));
      if (v) { for (const t of v[1]) out.push({ low: t, orig: t, variant: true }); i += v[0].length; } else out.push(toks[i++]);
    }
    for (const t of out) t.key = stem(t.low);
    return out;
  }
  const SKILL_KEYS = new Set(W.SKILLS.map(s => tokenize(s).map(t => t.key).join(' ')));
  const SEGMENT_RE = /[,;:()[\]!?|]|\.(?=\s|$)|\s[-–—]\s|^\s*[-–•*·]\s*/;
  function sectionWeight(line) {
    const t = line.trim(); if (!t || words(t).length > 7) return null;
    const rule = W.JD_SECTIONS.find(([re]) => re.test(t)); return rule ? rule[1] : null;
  }

  /** Ranked keywords and phrases from a job description: [{ key, display, score, count, skill, n }]. */
  function extractKeywords(jd, { limit = 30 } = {}) {
    const cands = new Map(); let weight = 1, order = 0;
    const lines = cleanText(jd).split('\n');
    for (const rawLine of lines) {
      let line = rawLine;
      // "Requirements" on its own line starts a section; "Requirements: SQL, Excel" starts one and lists keywords.
      const head = line.match(/^\s*([^:]{2,60}):\s*(\S.*)$/);
      if (head && sectionWeight(head[1]) != null) { weight = sectionWeight(head[1]); line = head[2]; }
      else { const w = sectionWeight(line.replace(/:\s*$/, '')); if (w != null) { weight = w; continue; } }
      for (const seg of line.split(SEGMENT_RE)) {
        if (!seg || !seg.trim()) continue;
        const toks = tokenize(seg);
        for (let n = 1; n <= 3; n++) for (let i = 0; i + n <= toks.length; i++) {
          const gram = toks.slice(i, i + n);
          const key = gram.map(t => t.key).join(' '), skill = SKILL_KEYS.has(key);
          if (!skill) {
            if (gram.some(t => STOP.has(t.low))) continue;
            if (GENERIC.has(gram[0].low) || GENERIC.has(gram[n - 1].low)) continue;
            if (gram.some(t => /^\d+[+%]?$|^\d/.test(t.low))) continue;
            if (n === 1 && gram[0].low.length < 3) continue;
          }
          let c = cands.get(key);
          if (!c) { c = { key, display: gram.map(t => t.orig).join(' '), n, skill, score: 0, count: 0, first: order++, capsOnly: true }; cands.set(key, c); }
          c.count++; c.score += weight;
          // A word or phrase that is only ever capitalised (and is not a known skill) is usually a name: a company, city or product.
          if (!gram.every(t => !t.variant && t.orig !== t.low && t.orig !== t.orig.toUpperCase() && /^[A-Z]/.test(t.orig))) c.capsOnly = false;
        }
      }
    }
    const all = [...cands.values()];
    const phrases = all.filter(c => c.n > 1 && (c.skill || c.count >= 2));
    const kept = new Set(phrases.map(p => p.key));
    // Drop shorter terms that only ever appear inside a kept phrase ("power" and "bi" inside "power bi").
    const covered = {};
    for (const p of phrases) {
      const parts = p.key.split(' ');
      for (let n = 1; n < parts.length; n++) for (let i = 0; i + n <= parts.length; i++) { const k = parts.slice(i, i + n).join(' '); covered[k] = (covered[k] || 0) + p.count; }
    }
    const out = all.filter(c => {
      if (c.n > 1 && !kept.has(c.key)) return false;
      if (covered[c.key] && c.count - covered[c.key] <= 0) return false;
      if (!c.skill && c.capsOnly) return false;
      return true;
    }).map(c => ({ ...c, score: c.score * (c.skill ? 2.5 : c.n > 1 ? 1.3 : 0.7) }));
    out.sort((a, b) => b.score - a.score || a.first - b.first);
    return out.slice(0, limit).map(({ key, display, score, count, skill, n }) => ({ key, display: lower(display), score: Math.round(score * 100) / 100, count, skill, n }));
  }

  /** Where each keyword appears in the résumé: in a bullet or other text (matched), only under Skills, or nowhere.
      The headline counts only the `top` highest-ranked keywords; each row says whether it is one of them (inTop),
      so a view of the top rows alone adds up to the headline. */
  function matchKeywords(keywords, parsedOrText, { top = 20 } = {}) {
    const parsed = typeof parsedOrText === 'string' ? parse(parsedOrText) : parsedOrText;
    const has = zonesOf(parsed).has;
    const rows = keywords.map((k, i) => {
      const where = has('bullet', k.key) ? 'bullet' : has('other', k.key) ? 'other' : has('skills', k.key) ? 'skills' : null;
      return { ...k, rank: i + 1, inTop: i < top, where, group: where === 'skills' ? 'skillsOnly' : where ? 'matched' : 'missing' };
    });
    const topRows = rows.slice(0, top), found = topRows.filter(r => r.group !== 'missing').length;
    return {
      keywords: rows, matched: rows.filter(r => r.group === 'matched'), missing: rows.filter(r => r.group === 'missing'), skillsOnly: rows.filter(r => r.group === 'skillsOnly'),
      top: topRows.length, found, foundInSkillsOnly: topRows.filter(r => r.group === 'skillsOnly').length, percent: topRows.length ? Math.round(found / topRows.length * 100) : 0
    };
  }

  /* ---------- PDF: rebuild lines from pdf.js text items ---------- */
  const PDF_BULLET_RE = /^(?:[•●▪◦‣∙○■□►▸➢➤✓✔❖◆·]\s*|[-–—*]\s+)/;
  const median = list => { const s = list.slice().sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0; };
  function splitColumns(items) {
    if (items.length < 12) return [items];
    const minX = Math.min(...items.map(i => i.x)), maxX = Math.max(...items.map(i => i.x + i.w)), width = maxX - minX;
    if (width < 200) return [items];
    const bin = 2, cover = new Array(Math.ceil(width / bin) + 1).fill(0);
    for (const it of items) for (let b = Math.floor((it.x - minX) / bin); b < Math.ceil((it.x + it.w - minX) / bin); b++) cover[b]++;
    const limit = Math.max(1, Math.floor(items.length * 0.04)), lo = Math.floor(cover.length * 0.2), hi = Math.ceil(cover.length * 0.8);
    let best = null, start = -1;
    for (let b = lo; b <= hi; b++) {
      if (b < hi && cover[b] <= limit) { if (start < 0) start = b; continue; }
      if (start >= 0 && (!best || b - start > best[1] - best[0])) best = [start, b];
      start = -1;
    }
    if (!best || best[1] - best[0] < 6) return [items];
    const split = minX + (best[0] + best[1]) / 2 * bin;
    const left = items.filter(i => i.x < split), right = items.filter(i => i.x >= split);
    const ys = list => new Set(list.map(i => Math.round(i.y))).size;
    if (left.length < items.length * 0.2 || right.length < items.length * 0.2 || ys(left) < 4 || ys(right) < 4) return [items];
    const range = list => [Math.min(...list.map(i => i.y)), Math.max(...list.map(i => i.y))];
    const [l0, l1] = range(left), [r0, r1] = range(right), overlap = Math.min(l1, r1) - Math.max(l0, r0);
    if (overlap < 0.5 * Math.min(l1 - l0, r1 - r0)) return [items];
    return [left, right];
  }
  function buildLines(items) {
    const sorted = items.slice().sort((a, b) => b.y - a.y || a.x - b.x), lines = [];
    for (const it of sorted) {
      const line = lines[lines.length - 1], tol = Math.max(2, 0.4 * Math.min(it.h || 10, line ? line.h : 99));
      if (line && Math.abs(line.y - it.y) <= tol) { line.items.push(it); line.h = Math.max(line.h, it.h || 0); } else lines.push({ y: it.y, h: it.h || 10, items: [it] });
    }
    return lines.map(line => {
      const its = line.items.sort((a, b) => a.x - b.x); let text = '', end = null;
      for (const it of its) {
        const size = Math.max(it.h || 0, line.h || 0, 1);
        if (end != null && it.x - end > 0.12 * size && !/\s$/.test(text) && !/^\s/.test(it.str)) text += ' ';
        text += it.str; end = it.x + (it.w || it.str.length * size * 0.5);
      }
      return { text: text.replace(/\s+/g, ' ').trim(), x: its[0].x, right: end, y: line.y, size: median(its.map(i => i.h || line.h)) || line.h };
    }).filter(l => l.text);
  }
  const looksLikeHeading = t => !!headingType(t) || isCapsHeading(t);
  /** pdf.js text items ({ str, x, y, w, h, page }) to plain text lines. y grows upwards, as in PDF user space. */
  function pdfItemsToLines(items) {
    const clean = items.filter(i => i && typeof i.str === 'string' && i.str.trim() && Number.isFinite(i.x) && Number.isFinite(i.y))
      .map(i => ({ str: i.str.replace(/\s+/g, ' '), x: i.x, y: i.y, w: Number.isFinite(i.w) && i.w > 0 ? i.w : 0, h: Number.isFinite(i.h) && i.h > 0 ? i.h : 10, page: i.page || 1 }));
    const pages = uniq(clean.map(i => i.page)).sort((a, b) => a - b), raw = [];
    let columns = 0;
    for (const p of pages) {
      const cols = splitColumns(clean.filter(i => i.page === p)); if (cols.length > 1) columns++;
      cols.forEach((col, ci) => {
        const lines = buildLines(col), gaps = lines.slice(1).map((l, k) => lines[k].y - l.y).filter(g => g > 0), typical = median(gaps);
        const colLeft = Math.min(...lines.map(l => l.x)), colRight = Math.max(...lines.map(l => l.right));
        lines.forEach((l, k) => {
          const gap = k ? lines[k - 1].y - l.y : 0;
          const brk = k === 0 ? (raw.length ? true : false) : (gap > Math.max(1.8 * l.size, typical ? 1.45 * typical : 0));
          raw.push({ ...l, brk, page: p, col: ci, colRight, colWidth: colRight - colLeft });
        });
      });
    }
    const out = [];
    for (const l of raw) {
      let text = l.text; const bullet = PDF_BULLET_RE.test(text);
      if (bullet) text = '• ' + text.replace(PDF_BULLET_RE, '').trim();
      const prev = out[out.length - 1];
      if (prev && !l.brk) {
        if (/[A-Za-z]-$/.test(prev.text) && /^[a-z]/.test(text) && !bullet) { prev.text = prev.text.slice(0, -1) + text; continue; }
        if (prev.bullet && !bullet && !looksLikeHeading(text) && l.x > prev.x + 0.5 * prev.size) { prev.text += ' ' + text; prev.right = l.right; continue; }
        // A line that runs to the right margin and is continued below (lower case, a digit, or after "and", "of", a comma…) is one
        // wrapped line. This catches bullets drawn as shapes rather than text, as browsers and some editors do.
        const full = prev.right != null && l.colRight - prev.right <= Math.max(4 * prev.size, 0.1 * l.colWidth);
        if (full && !bullet && !prev.heading && !looksLikeHeading(text) && l.x >= prev.x - 2 && (/^[a-z0-9(₹$%&]/.test(text) || /(,|\b(and|or|of|the|a|an|to|in|for|with|by|on|at|from|across|into|per))$/i.test(prev.text))) { prev.text += ' ' + text; prev.right = l.right; continue; }
      }
      if (l.brk && out.length) out.push({ text: '', blank: true });
      out.push({ text, x: l.x, right: l.right, size: l.size, bullet, heading: looksLikeHeading(text) });
    }
    const lines = out.map(o => o.text);
    return { lines, text: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(), columns, chars: clean.reduce((n, i) => n + i.str.replace(/\s/g, '').length, 0) };
  }

  /* ---------- .docx: word/document.xml to lines ---------- */
  const WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const SKIP = new Set(['pPr', 'rPr', 'txbxContent', 'Fallback', 'del', 'delText', 'instrText', 'sectPr', 'footnoteReference', 'endnoteReference', 'commentReference']);
  const CONTAINERS = new Set(['body', 'tbl', 'tr', 'tc', 'sdt', 'sdtContent', 'customXml', 'smartTag', 'ins', 'moveTo']);
  const kids = el => Array.from(el.childNodes || []).filter(n => n.nodeType === 1);
  const child = (el, name) => el && kids(el).find(k => k.localName === name);
  const val = el => el ? (el.getAttributeNS(WNS, 'val') ?? el.getAttribute('w:val') ?? '') : '';
  /** Converts word/document.xml to { lines: [{ text, kind: 'heading'|'bullet'|'text'|'blank' }], text }. */
  function docxXmlToLines(xml, Parser = root && root.DOMParser) {
    if (!Parser) throw new Error('No XML parser available.');
    const doc = new Parser().parseFromString(String(xml), 'application/xml');
    if (!doc || !doc.documentElement || doc.getElementsByTagName('parsererror').length) throw new Error('The document XML could not be read.');
    const body = doc.getElementsByTagNameNS(WNS, 'body')[0] || doc.getElementsByTagName('w:body')[0];
    if (!body) throw new Error('The document has no body.');
    const lines = [];
    function collect(el) {
      let s = '';
      for (const k of kids(el)) {
        const n = k.localName;
        if (SKIP.has(n)) continue;
        if (n === 't') s += k.textContent;
        else if (n === 'tab' || n === 'ptab') s += ' ';
        else if (n === 'br' || n === 'cr') s += '\n';
        else if (n === 'noBreakHyphen') s += '-';
        else if (n === 'AlternateContent') { const c = child(k, 'Choice'); if (c) s += collect(c); }
        else s += collect(k);
      }
      return s;
    }
    function para(p) {
      const pPr = child(p, 'pPr'), style = val(child(pPr, 'pStyle')), numPr = child(pPr, 'numPr');
      const numbered = !!numPr && val(child(numPr, 'numId')) !== '0';
      const bullet = numbered || /^List(Bullet|Number)/i.test(style);
      const parts = collect(p).split('\n').map(s => s.replace(/[ \t ]+/g, ' ').trim());
      if (parts.every(s => !s)) { lines.push({ text: '', kind: 'blank' }); return; }
      parts.forEach((text, i) => {
        if (!text) return;
        const heading = /heading/i.test(style) || (!bullet && isCapsHeading(text));
        lines.push({ text, kind: heading ? 'heading' : bullet && i === 0 ? 'bullet' : 'text' });
      });
    }
    (function walk(el) { for (const k of kids(el)) { if (k.localName === 'p') para(k); else if (CONTAINERS.has(k.localName)) walk(k); } })(body);
    const out = [];
    for (const l of lines) {
      if (l.kind === 'blank') { if (out.length && out[out.length - 1] !== '') out.push(''); continue; }
      if (l.kind === 'heading' && out.length && out[out.length - 1] !== '') out.push('');
      out.push(l.kind === 'bullet' ? '• ' + l.text.replace(/^[•●▪◦\-–*·]\s*/, '') : l.text);
    }
    while (out.length && out[out.length - 1] === '') out.pop();
    return { lines: lines.filter(l => l.kind !== 'blank'), text: out.join('\n'), headings: lines.filter(l => l.kind === 'heading').length, bullets: lines.filter(l => l.kind === 'bullet').length };
  }

  /* ---------- Output ---------- */
  function improvedBullets(analysis) {
    const out = []; let lastRole = null, lastSection = null;
    for (const b of analysis.bullets) {
      const role = analysis.roles[b.role];
      if (b.section !== lastSection) { if (out.length) out.push(''); if (b.section) out.push(b.section); lastSection = b.section; lastRole = null; }
      if (role.id !== lastRole) { if (role.title) out.push(role.title); lastRole = role.id; }
      out.push('• ' + b.text);
    }
    return out.join('\n');
  }
  function reportText(analysis, { date = new Date() } = {}) {
    const s = analysis.summary, L = [];
    L.push('CASE ROOM — RÉSUMÉ CHECK', date.toLocaleString(), 'Heuristic checks, computed in your browser. Not a score, and not how a recruiter or an applicant tracking system will judge your résumé.', '');
    L.push('WHOLE RÉSUMÉ');
    for (const g of analysis.general || []) L.push(`${g.status === 'pass' ? '✓' : g.status === 'info' ? 'i' : '!'} ${g.label}: ${g.reason}${g.status !== 'pass' && g.fix ? ' Fix: ' + g.fix : ''}`);
    L.push('', 'BULLET CHECKS');
    L.push(`Bullets checked: ${s.total}`, `Bullets with a number: ${s.withNumber} of ${s.total} (${Math.round(s.numberShare * 100)}%)`, `Bullets with no warnings: ${s.clean}`);
    for (const id of CHECK_IDS) L.push(`- ${LABELS[id]}: ${s.counts[id]} to look at`);
    L.push('', 'BULLETS');
    analysis.bullets.forEach((b, i) => {
      L.push(`${i + 1}. ${b.text}`);
      for (const c of b.checks.filter(c => c.status === 'warn')) L.push(`   ! ${c.label}: ${c.reason}${c.fix ? ' Fix: ' + c.fix : ''}`);
      if (!b.issues) L.push('   ✓ No warnings');
    });
    const m = analysis.match;
    if (m) {
      L.push('', 'JOB DESCRIPTION MATCH', `${m.found} of the top ${m.top} keywords appear in your résumé (${m.percent}%), ${m.foundInSkillsOnly} of them only in Skills. This is word overlap only.`);
      const names = (list, inTop) => list.filter(k => k.inTop === inTop).map(k => k.display).join(', ') || '—';
      const groups = inTop => [`Matched: ${names(m.matched, inTop)}`, `Only in Skills, not in any bullet: ${names(m.skillsOnly, inTop)}`, `Missing: ${names(m.missing, inTop)}`];
      L.push(`Top ${m.top} keywords (the ones counted above):`, ...groups(true).map(s => '  ' + s));
      if (m.keywords.length > m.top) L.push(`Lower-ranked keywords ${m.top + 1}–${m.keywords.length} (not counted above):`, ...groups(false).map(s => '  ' + s));
      L.push('Add a missing keyword only where you genuinely have that experience, and show it in a bullet.');
    }
    L.push('', 'IMPROVED BULLETS', improvedBullets(analysis));
    return L.join('\n') + '\n';
  }

  const api = { GENERAL_LABELS, GENERAL_IDS, generalChecks, skillItems, LABELS, CHECK_IDS, LIMITS, cleanText, opener, lintBullet, parse, stats, analyse, summarise, stem, tokenize, extractKeywords, matchKeywords, pdfItemsToLines, docxXmlToLines, improvedBullets, reportText, isCapsHeading, headingType, PRESENT, PAST };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ResumeCheck = api;
})(this);
