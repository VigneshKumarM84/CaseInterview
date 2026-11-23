/* Résumé builder: the logic. No DOM access, so Node tests load this file directly.
   - build(resumeText, pointsText): turns an old résumé and/or a list of points into a structured résumé (the model).
     Sections, roles and bullets come from ResumeCheck.parse(); this file adds the name and contact details, splits
     dates off entry lines, merges two-line headings ("Company" then "Role · dates") and sorts headingless points into
     sections with keyword rules. Everything is a heuristic: the UI shows the result as an editable form.
   - score(): ranks bullets for the space they take (a number, a strong opening verb, recency, the author's order).
   - fit(): chooses which bullets to leave out and how tight to set the page so the résumé fits one or two pages.
     It takes a measure() function, so the browser measures real layout and the tests pass a fake one.
   - sheetHtml() / toText(): the résumé as HTML for the three templates, and as plain text.
   No AI here: the optional "Tighten with AI" step lives in the UI and the server. */
(function (root) {
  const node = typeof module !== 'undefined' && module.exports;
  const RC = node ? require('./resume-check.js') : root.ResumeCheck;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const words = s => String(s).trim().split(/\s+/).filter(Boolean);
  const squash = s => String(s ?? '').replace(/\s+/g, ' ').trim();

  /* ---------- The model ---------- */
  /* { v: 1, seq, name, headline, contact: { email, phone, location, links: [] }, summary,
       sections: [{ id, type, title, entries: [{ id, title, sub, dates, bullets: [{ id, text, pin, hide }] }] }] }
     type is one of ResumeWords.SECTIONS' keys. Skills render as plain lines; every other section as entries with bullets.
     pin: always keep this bullet when fitting. hide: never show it. */
  const TYPES = ['summary', 'education', 'experience', 'projects', 'responsibility', 'achievements', 'skills', 'other'];
  const ORDER = ['education', 'experience', 'projects', 'responsibility', 'achievements', 'skills', 'other'];
  const DEFAULT_TITLES = { education: 'Education', experience: 'Experience', projects: 'Projects', responsibility: 'Positions of Responsibility', achievements: 'Achievements', skills: 'Skills', other: 'Other' };
  /** Sections whose bullets fit() may leave out. Education and Skills lines stay: they are short and recruiters look for them. */
  const DROPPABLE = new Set(['experience', 'projects', 'responsibility', 'achievements', 'other']);
  const isLines = section => section.type === 'skills';

  function empty() { return { v: 1, seq: 0, name: '', headline: '', contact: { email: '', phone: '', location: '', links: [] }, summary: '', sections: [] }; }
  const nextId = (model, p) => p + (model.seq = (model.seq || 0) + 1);
  function addSection(model, type, title) { const s = { id: nextId(model, 's'), type, title: title || DEFAULT_TITLES[type] || 'Other', entries: [] }; model.sections.push(s); return s; }
  function addEntry(model, section, { title = '', sub = '', dates = '' } = {}) { const e = { id: nextId(model, 'e'), title, sub, dates, bullets: [] }; section.entries.push(e); return e; }
  function addBullet(model, entry, text) { const b = { id: nextId(model, 'b'), text: squash(text), pin: false, hide: false }; entry.bullets.push(b); return b; }

  /** "POSITIONS OF RESPONSIBILITY" -> "Positions of Responsibility"; mixed-case titles are kept as typed. */
  function titleCase(t) {
    t = squash(t).replace(/[:\s]+$/, '');
    if (t !== t.toUpperCase()) return t;
    const small = new Set(['of', 'and', 'in', 'for', 'the', 'a', 'an', 'to', 'at', 'on', '&']);
    return t.toLowerCase().split(' ').map((w, i) => i && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  /* ---------- Dates ---------- */
  const MON = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
  const ONE_DATE = `(?:${MON}\\s*'?\\d{2,4}|(?:0?[1-9]|1[0-2])[/-](?:19|20)\\d{2}|(?:19|20)\\d{2}|present|current|now|till date|to date|ongoing)`;
  // "Jun–Aug 2025": a bare month may open a range whose end carries the year.
  const RANGE = `(?:${MON}\\s*(?:-|–|—|to)\\s*(?=${MON}\\s*'?\\d))?${ONE_DATE}(?:\\s*(?:-|–|—|to)\\s*${ONE_DATE})?`;
  const WHOLE_DATE = new RegExp(`^\\(?\\s*${RANGE}\\s*\\)?$`, 'i');
  const TRAILING_DATE = new RegExp(`[\\s,;(–—-]*\\(?\\s*(${RANGE})\\s*\\)?\\s*$`, 'i');
  const tidyDates = d => squash(d).replace(/^\(|\)$/g, '').replace(/\s*(?:-|–|—|\bto\b)\s*/i, ' – ').replace(/\b(present|current|now|ongoing|till date|to date)\b/i, m => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());
  const PIECES = /\s+[·•|]\s+|\t+|\s{3,}/;

  /** "Analyst Intern, Kiranakart · May 2025 – Jul 2025 · Remote" -> { title, sub: 'Remote', dates: 'May 2025 – Jul 2025' } */
  function splitLine(line) {
    const pieces = String(line).split(PIECES).map(squash).filter(Boolean);
    const at = pieces.findIndex((p, i) => i > 0 && WHOLE_DATE.test(p));
    if (at > 0) { const dates = tidyDates(pieces[at]); pieces.splice(at, 1); return { title: pieces[0], sub: pieces.slice(1).join(' · '), dates }; }
    const title = pieces.shift() || '', rest = pieces.join(' · ');
    const m = title.match(TRAILING_DATE);
    if (m && m.index > 0) return { title: title.slice(0, m.index).replace(/[\s,;·|–—-]+$/, ''), sub: rest, dates: tidyDates(m[1]) };
    // "B.Tech, ABC Institute, 2022-2026, CGPA 8.1": the dates sit between commas.
    const commas = title.split(/\s*,\s*/), c = commas.findIndex((x, i) => i > 0 && WHOLE_DATE.test(x));
    if (c > 0) return { title: commas.slice(0, c).join(', '), sub: [commas.slice(c + 1).join(', '), rest].filter(Boolean).join(' · '), dates: tidyDates(commas[c]) };
    return { title, sub: rest, dates: '' };
  }

  /* ---------- Name and contact details ---------- */
  const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
  const PHONE_RE = /^(?:phone|mobile|mob|ph|tel)?[\s.:]*\+?[\d\s().-]{8,}$/i;
  const LINK_RE = /(?:https?:\/\/|www\.|linkedin\.com|github\.com|behance\.net|kaggle\.com|medium\.com|[a-z0-9-]+\.(?:com|in|io|dev|me|org|net)\/)/i;
  const CONTACT_SPLIT = /\s*[·•|,;]\s*|\s{2,}|\t/;

  /** Reads the lines above the first heading: the name, a headline, contact details and any summary text. */
  function readTop(model, lines) {
    const extra = [];
    for (const raw of lines) {
      const line = squash(raw.replace(/^[•\-*]\s*/, ''));
      if (!line) continue;
      const parts = line.split(CONTACT_SPLIT).map(squash).filter(Boolean);
      const contactish = parts.filter(p => EMAIL_RE.test(p) || PHONE_RE.test(p) || LINK_RE.test(p));
      if (!model.name && !contactish.length && words(line).length <= 5 && !/\d/.test(line)) { model.name = titleCase(line); continue; }
      if (contactish.length) {
        for (const p of parts) {
          const clean = p.replace(/^(?:e-?mail|email id|phone|mobile|mob|ph|tel|linkedin|github|portfolio)\s*[:-]\s*/i, '');
          if (EMAIL_RE.test(clean)) model.contact.email ||= clean.match(EMAIL_RE)[0];
          else if (PHONE_RE.test(clean)) model.contact.phone ||= squash(clean.replace(/^(?:phone|mobile|mob|ph|tel)[\s.:]*/i, ''));
          else if (LINK_RE.test(clean)) { if (!model.contact.links.includes(clean)) model.contact.links.push(clean); }
          else if (!model.contact.location && words(clean).length <= 4 && !/\d{3,}/.test(clean)) model.contact.location = clean;
        }
        continue;
      }
      if (!model.headline && words(line).length <= 12 && !/[.!?]$/.test(line)) { model.headline = line; continue; }
      extra.push(line);
    }
    if (extra.length) model.summary = squash([model.summary, ...extra].join(' '));
  }

  /* ---------- Sorting headingless points into sections ---------- */
  const RULES = [
    ['education', /\b(?:b\.?\s?tech|b\.?\s?e\b|bba|bcom|b\.?com|bsc|b\.?sc|ba\b|mba|m\.?\s?tech|msc|pgdm|ph\.?d|diploma|class (?:x|xii|10|12)|cbse|icse|hsc|ssc|cgpa|gpa)\b/i],
    ['achievements', /\b(?:won|winner|winners|1st|2nd|3rd|first place|second place|runner[- ]?up|finalist|ranked|rank \d|top \d+%?|award|awarded|scholarship|medal|merit|topper|selected among|air \d)/i],
    ['responsibility', /\b(?:treasurer|president|vice[- ]president|secretary|captain|coordinator|co-ordinator|head of|core member|club|society|committee|council|cell|chapter|organising team|organizing team|class representative)\b/i],
    ['projects', /\b(?:project|built a|developed a|created a|designed a|app|website|dashboard|model|prototype|hackathon|capstone|thesis|dissertation)\b/i],
    ['experience', /\b(?:intern|internship|analyst|associate|engineer|developer|consultant|trainee|assistant|executive|manager|volunteer\w*|freelance\w*|taught|teaching|part[- ]time|full[- ]time)\b/i]
  ];
  function looksLikeSkills(text) {
    const items = text.replace(/^[^:]{1,30}:\s*/, '').split(/\s*[,|;/]\s*/).filter(Boolean);
    return items.length >= 3 && items.every(i => words(i).length <= 4) && !/\b(?:ed|ing)\b/.test(text.split(/[,|;]/)[0]);
  }
  function classify(text) {
    if (/^(?:skills?|tools|languages|technical skills|software)\s*:/i.test(text)) return 'skills';
    if (RULES[0][1].test(text)) return 'education';
    // A place of study alone ("Won 2nd place at the college case competition") is weaker evidence than an award or a post.
    const place = /\b(?:university|college|school|institute of)\b/i;
    if (place.test(text) && !RULES[1][1].test(text) && !RULES[2][1].test(text)) return 'education';
    if (looksLikeSkills(text)) return 'skills';
    for (const [type, re] of RULES.slice(1)) if (re.test(text)) return type;
    return 'other';
  }

  /* ---------- Building the model from text ---------- */
  const CERT = /\b(?:certificat\w*|certified|course|coursera|udemy|nptel|edx|linkedin learning)\b/i;
  const certifications = model => model.sections.find(s => s.type === 'other' && /certif/i.test(s.title)) || addSection(model, 'other', 'Certifications');
  function sectionOf(model, type, title) {
    const found = model.sections.find(s => s.type === type && (type !== 'other' || !/certif/i.test(s.title)));
    return found || addSection(model, type, title ? titleCase(title) : DEFAULT_TITLES[type]);
  }

  /** Adds the sections, entries and bullets of one text (a résumé or a list of points) to the model. */
  function absorb(model, text) {
    const p = RC.parse(text);
    const lines = p.lines;
    if (!p.headingsFound) return absorbPoints(model, p);
    // The top ends at the first known heading. A capitals line before it ("ARJUN RAO") is the name, not a section,
    // unless it comes after the contact details.
    let firstHeading = lines.length, contactSeen = false, textSeen = false;
    for (const l of lines) {
      if (l.kind === 'heading' && (l.type || (contactSeen && textSeen))) { firstHeading = l.i; break; }
      if (l.kind !== 'blank') { textSeen = true; if (EMAIL_RE.test(l.text) || /\+?\d[\d\s-]{8,}/.test(l.text)) contactSeen = true; }
    }
    readTop(model, lines.slice(0, firstHeading).map(l => l.raw));
    let section = null, type = null, entry = null, lastLine = -2;
    const take = (l, fields) => {
      // Two lines in a row with no bullets between them ("Kiranakart" then "Analyst Intern · May 2025") are one entry.
      if (entry && !entry.bullets.length && !entry.sub && lastLine === l.i - 1 && !(fields.dates && entry.dates)) {
        entry.sub = [fields.title, fields.sub].filter(Boolean).join(' · '); entry.dates ||= fields.dates;
      } else entry = addEntry(model, section, fields);
      lastLine = l.i;
    };
    for (let k = firstHeading; k < lines.length; k++) {
      const l = lines[k];
      if (l.kind === 'blank' || l.continuation) continue;
      if (l.kind === 'heading') {
        type = l.type || 'other'; entry = null; lastLine = -2;
        if (type === 'summary') { section = null; continue; }
        // A heading the parser could not place ("CERTIFICATIONS") keeps its own section; known types merge.
        section = l.type && l.type !== 'other' ? sectionOf(model, type, l.text)
          : model.sections.find(s => s.type === 'other' && s.title === titleCase(l.text)) || addSection(model, 'other', titleCase(l.text));
        continue;
      }
      const text = l.kind === 'bullet' ? p.bullets[l.bullet].text : l.text;
      if (type === 'summary') { model.summary = squash([model.summary, text].join(' ')); continue; }
      if (!section) continue;
      if (isLines(section)) { entry = section.entries[0] || addEntry(model, section); addBullet(model, entry, text); continue; }
      if (l.kind === 'role') { take(l, splitLine(l.text)); continue; }
      if (l.kind === 'bullet') { if (!entry) entry = addEntry(model, section); addBullet(model, entry, text); lastLine = -2; continue; }
      // A plain line: an entry in Education and similar sections, a bullet where entries hold bullets.
      if (type === 'education' || !entry || (type === 'other' && !entry.bullets.length && entry.title)) take(l, splitLine(text));
      else { addBullet(model, entry, text); lastLine = -2; }
    }
  }

  /** Points with no headings. A line with bullet points under it is an entry heading and keeps them; every other
      line is sorted on its own by keyword rules, since a list of achievements rarely belongs to the line above it. */
  function absorbPoints(model, p) {
    const lines = p.lines.filter(l => l.kind !== 'blank' && !l.continuation);
    const prefixed = l => l.kind === 'bullet' && !!p.bullets[l.bullet].prefix;
    let entry = null;
    lines.forEach((l, k) => {
      const text = l.kind === 'bullet' ? p.bullets[l.bullet].text : l.text;
      if (prefixed(l) && entry) { addBullet(model, entry, text); return; }
      entry = null;
      const t = classify(text), next = lines[k + 1];
      if (!prefixed(l) && next && prefixed(next)) {
        // A heading for the bullets below it: a role, a project or a position.
        const below = lines.slice(k + 1).filter((x, j, all) => all.slice(0, j + 1).every(prefixed)).map(x => p.bullets[x.bullet].text).join(' ');
        let type = t === 'other' || t === 'skills' ? classify(text + ' ' + below) : t;
        if (type === 'other' || type === 'skills') type = 'experience';
        entry = addEntry(model, sectionOf(model, type), splitLine(text)); return;
      }
      // Certificates and courses get their own section rather than "Other".
      const section = t === 'other' && CERT.test(text) ? certifications(model) : sectionOf(model, t);
      if (t === 'education' || (t === 'experience' && DATED.test(text) && words(text).length <= 14)) { addEntry(model, section, splitLine(text)); return; }
      addBullet(model, section.entries.find(e => !e.title) || addEntry(model, section), text);
    });
  }
  const DATED = new RegExp(RANGE, 'i');

  /** Builds a résumé model from an old résumé and/or a list of points. Either may be empty. */
  function build(resumeText = '', pointsText = '') {
    const model = empty();
    if (squash(resumeText)) absorb(model, resumeText);
    if (squash(pointsText)) absorb(model, pointsText);
    model.sections.sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
    model.sections = model.sections.filter(s => s.entries.some(e => e.title || e.bullets.length));
    for (const s of model.sections) for (const e of s.entries) if (!e.title && e.sub) { e.title = e.sub; e.sub = ''; }
    return model;
  }

  /* ---------- Ranking ---------- */
  const SECTION_WEIGHT = { experience: 2, projects: 1.5, achievements: 1.5, responsibility: 1, other: 0.5 };
  /** A bullet's value for the space it takes. Higher stays longer. Pinned bullets are never dropped, so their score does not matter. */
  function score(text, { type = 'experience', entryIndex = 0, bulletIndex = 0 } = {}) {
    const lint = RC.lintBullet(text), warn = new Set(lint.checks.filter(c => c.status === 'warn').map(c => c.id));
    let s = SECTION_WEIGHT[type] ?? 0.5;
    if (!warn.has('number')) s += 3;
    const kind = lint.opener && lint.opener.kind;
    if (kind === 'strong') s += 2; else if (kind === 'weak') s -= 2; else if (kind === 'first-person') s -= 1;
    for (const id of ['passive', 'length', 'filler']) if (warn.has(id)) s -= 1;
    return s - 0.4 * entryIndex - 0.15 * bulletIndex;
  }
  /** Every bullet fit() may leave out, lowest score first. */
  function ranked(model) {
    const out = [];
    for (const s of model.sections) {
      if (!DROPPABLE.has(s.type)) continue;
      s.entries.forEach((e, ei) => e.bullets.forEach((b, bi) => { if (!b.hide && !b.pin) out.push({ id: b.id, entry: e.id, score: score(b.text, { type: s.type, entryIndex: ei, bulletIndex: bi }) }); }));
    }
    return out.sort((a, b) => a.score - b.score);
  }

  /* ---------- Fitting to one or two pages ---------- */
  const WEAK = 1.5;      // a bullet below this has neither a number nor a strong opening verb
  const DENSITIES = 3;   // 0 comfortable, 1 snug, 2 tight

  /**
   * Chooses which bullets to leave out and how tight to set the page.
   * measure(plan) returns the height in pages for plan = { omit: Set<bulletId>, density }.
   * Order, cheapest loss first: as is; snug spacing; leave out weak bullets one at a time; tight spacing; leave out
   * the lowest-ranked bullets, always keeping at least one bullet under every entry. Then put back any dropped
   * bullet, best first, that still fits. Pinned bullets are never left out; hidden ones always are.
   * Returns { omit, density, pages, fits, dropped: [bulletId], needed }.
   */
  function fit(model, { pages = 1, measure }) {
    const hidden = new Set(); for (const s of model.sections) for (const e of s.entries) for (const b of e.bullets) if (b.hide) hidden.add(b.id);
    const plan = { omit: new Set(hidden), density: 0 }, dropped = [];
    let used = measure(plan);
    const fits = () => used <= pages + 1e-6;
    const done = () => ({ omit: plan.omit, density: plan.density, pages: used, fits: fits(), dropped: dropped.slice(), needed: pages });
    if (fits()) return done();
    const list = ranked(model);
    const left = new Map(); for (const s of model.sections) for (const e of s.entries) left.set(e.id, e.bullets.filter(b => !b.hide).length);
    const drop = r => { plan.omit.add(r.id); dropped.push(r.id); left.set(r.entry, left.get(r.entry) - 1); used = measure(plan); };
    const dropWhile = test => { for (const r of list) { if (fits()) return; if (!plan.omit.has(r.id) && left.get(r.entry) > 1 && test(r)) drop(r); } };
    plan.density = 1; used = measure(plan);
    if (!fits()) dropWhile(r => r.score < WEAK);
    if (!fits()) { plan.density = DENSITIES - 1; used = measure(plan); }
    if (!fits()) dropWhile(() => true);
    if (fits()) for (let i = dropped.length - 1; i >= 0; i--) { // refill: the last dropped is the best of them
      const id = dropped[i]; plan.omit.delete(id); const was = used; used = measure(plan);
      if (fits()) dropped.splice(i, 1); else { plan.omit.add(id); used = was; }
    }
    return done();
  }

  /** A rough height estimate in pages, for tests and as a fallback where layout cannot be measured. */
  function estimate(model, plan = { omit: new Set(), density: 0 }) {
    const perLine = [1 / 52, 1 / 56, 1 / 61][plan.density] || 1 / 52, chars = [98, 104, 112][plan.density] || 98;
    let lines = 4 + (model.summary ? Math.ceil(model.summary.length / chars) + 2 : 0);
    for (const s of model.sections) {
      lines += 2;
      for (const e of s.entries) {
        lines += (e.title || e.dates ? 1 : 0) + (e.sub ? 1 : 0) + 0.4;
        for (const b of e.bullets) if (!plan.omit.has(b.id) && !b.hide) lines += Math.ceil((b.text.length + 4) / chars);
      }
    }
    return lines * perLine;
  }

  /* ---------- Output ---------- */
  const TEMPLATES = [
    { id: 'classic', name: 'Classic', note: 'Serif, centred name, ruled headings. Safe for any company.' },
    { id: 'modern', name: 'Modern', note: 'Clean sans-serif with one accent colour.' },
    { id: 'compact', name: 'Compact', note: 'Headings in a side column. Fits the most on a page.' }
  ];
  const visible = (b, plan) => !b.hide && !(plan && plan.omit && plan.omit.has(b.id)) && b.text;
  function contactParts(model) {
    const c = model.contact || {};
    return [c.location, c.email, c.phone, ...(c.links || [])].map(squash).filter(Boolean);
  }
  function lineHtml(text) {
    const m = text.match(/^([^:]{1,30}):\s*(.+)$/);
    return m ? `<b>${esc(m[1])}:</b> ${esc(m[2])}` : esc(text);
  }

  /** The résumé as HTML. template: 'classic' | 'modern' | 'compact'. plan: from fit(), or omitted to show everything not hidden. */
  function sheetHtml(model, { template = 'classic', plan = null } = {}) {
    const density = plan ? plan.density : 0, out = [];
    out.push(`<article class="rb-sheet rb-t-${esc(template)} rb-d-${density}" lang="en">`);
    out.push(`<header class="rb-head"><h1 class="rb-name">${esc(model.name || 'Your Name')}</h1>`);
    if (model.headline) out.push(`<p class="rb-headline">${esc(model.headline)}</p>`);
    const contact = contactParts(model);
    if (contact.length) out.push(`<p class="rb-contact">${contact.map(c => `<span>${esc(c)}</span>`).join('')}</p>`);
    out.push('</header>');
    if (squash(model.summary)) out.push(`<section class="rb-sec rb-sec-summary"><h2>Summary</h2><div class="rb-body"><p class="rb-summary">${esc(model.summary)}</p></div></section>`);
    for (const s of model.sections) {
      const entries = s.entries.map(e => ({ e, bullets: e.bullets.filter(b => visible(b, plan)) })).filter(x => x.e.title || x.e.sub || x.e.dates || x.bullets.length);
      if (!entries.length) continue;
      out.push(`<section class="rb-sec rb-sec-${esc(s.type)}"><h2>${esc(s.title || DEFAULT_TITLES[s.type])}</h2><div class="rb-body">`);
      if (isLines(s)) out.push(entries.map(x => x.bullets.map(b => `<p class="rb-line">${lineHtml(b.text)}</p>`).join('')).join(''));
      else for (const { e, bullets } of entries) {
        out.push('<div class="rb-entry">');
        if (e.title || e.dates) out.push(`<div class="rb-entry-head"><span class="rb-entry-title">${esc(e.title)}</span>${e.dates ? `<span class="rb-dates">${esc(e.dates)}</span>` : ''}</div>`);
        if (e.sub) out.push(`<div class="rb-entry-sub">${esc(e.sub)}</div>`);
        if (bullets.length) out.push(`<ul class="rb-bullets">${bullets.map(b => `<li>${esc(b.text)}</li>`).join('')}</ul>`);
        out.push('</div>');
      }
      out.push('</div></section>');
    }
    out.push('</article>');
    return out.join('');
  }

  /** The résumé as plain text, for job portals that want pasted text. */
  function toText(model, plan = null) {
    const L = [model.name || 'Your Name'];
    if (model.headline) L.push(model.headline);
    const contact = contactParts(model); if (contact.length) L.push(contact.join(' · '));
    if (squash(model.summary)) L.push('', 'SUMMARY', squash(model.summary));
    for (const s of model.sections) {
      const body = [];
      for (const e of s.entries) {
        const bullets = e.bullets.filter(b => visible(b, plan));
        if (!e.title && !e.sub && !e.dates && !bullets.length) continue;
        if (e.title || e.dates) body.push([e.title, e.dates].filter(Boolean).join(' · '));
        if (e.sub) body.push(e.sub);
        for (const b of bullets) body.push(isLines(s) ? b.text : '• ' + b.text);
      }
      if (body.length) L.push('', (s.title || DEFAULT_TITLES[s.type]).toUpperCase(), ...body);
    }
    return L.join('\n') + '\n';
  }

  /** Checks a model read back from storage. Returns a clean copy, or null if it is not a résumé model. */
  function restore(data) {
    if (!data || typeof data !== 'object' || data.v !== 1 || !Array.isArray(data.sections)) return null;
    const str = (v, n = 2000) => typeof v === 'string' ? v.slice(0, n) : '';
    const m = empty(); m.seq = Number.isInteger(data.seq) ? data.seq : 0;
    m.name = str(data.name, 200); m.headline = str(data.headline, 300); m.summary = str(data.summary, 3000);
    const c = data.contact || {}; m.contact = { email: str(c.email, 200), phone: str(c.phone, 60), location: str(c.location, 120), links: Array.isArray(c.links) ? c.links.map(l => str(l, 300)).filter(Boolean).slice(0, 6) : [] };
    for (const s of data.sections.slice(0, 30)) {
      if (!s || !TYPES.includes(s.type) || !Array.isArray(s.entries)) continue;
      const ns = { id: str(s.id, 20) || nextId(m, 's'), type: s.type, title: str(s.title, 120), entries: [] };
      for (const e of s.entries.slice(0, 60)) {
        if (!e || !Array.isArray(e.bullets)) continue;
        ns.entries.push({ id: str(e.id, 20) || nextId(m, 'e'), title: str(e.title, 300), sub: str(e.sub, 300), dates: str(e.dates, 80),
          bullets: e.bullets.slice(0, 80).filter(b => b && typeof b.text === 'string').map(b => ({ id: str(b.id, 20) || nextId(m, 'b'), text: str(b.text, 600), pin: b.pin === true, hide: b.hide === true })) });
      }
      m.sections.push(ns);
    }
    return m;
  }

  /** Finds a bullet, its entry and its section by bullet id. */
  function locate(model, bulletId) {
    for (const s of model.sections) for (const e of s.entries) { const i = e.bullets.findIndex(b => b.id === bulletId); if (i >= 0) return { section: s, entry: e, bullet: e.bullets[i], index: i }; }
    return null;
  }

  const api = { TYPES, ORDER, DEFAULT_TITLES, DROPPABLE, TEMPLATES, DENSITIES, WEAK, empty, nextId, addSection, addEntry, addBullet, titleCase, splitLine, classify, build, score, ranked, fit, estimate, sheetHtml, toText, restore, locate, isLines };
  if (node) module.exports = api; else root.ResumeBuild = api;
})(this);
