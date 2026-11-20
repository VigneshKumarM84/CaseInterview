/* Exam conditions, placement-notice tests and shared papers for the timed aptitude test. No DOM: this file is loaded
   by index.html and required directly by the Node tests (tests/exam.test.cjs). It holds the rules for cleaning a
   student's notice settings, the real-time clock that does not pause, the paper code that lets a group sit the same
   questions, and the result lines and ranking an organiser can collect. Nothing here stores or sends anything. */
(function (root) {
  'use strict';
  const LIMITS = { name: 60, source: 200, counts: { quant: 40, logical: 40, verbal: 30 }, minutes: [1, 120], notices: 10, switchLimits: [0, 3, 5] };
  const SECTION_IDS = ['quant', 'logical', 'verbal'];
  // The same values as the marking select in aptitude.js (NEGATIVES) and the difficulty select in the timed-test form.
  const NEGATIVES = [0, 0.25, 1 / 3, 0.5];
  const DEFAULT_LEVELS = ['easy', 'medium', 'hard', 'advanced', 'expert', 'mixed', 'mixed-high'];
  const MAX_CODE = 1200, PREFIX = 'CR1.';

  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const intIn = (x, lo, hi) => typeof x === 'number' && Number.isInteger(x) && x >= lo && x <= hi;
  // Drops half of a surrogate pair (which cannot be encoded as UTF-8). No lookbehind, so older phones can still parse this file.
  const wholeChars = s => { let out = ''; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c >= 0xD800 && c <= 0xDBFF && s.charCodeAt(i + 1) >= 0xDC00 && s.charCodeAt(i + 1) <= 0xDFFF) { out += s[i] + s[i + 1]; i++; } else if (c < 0xD800 || c > 0xDFFF) out += s[i]; } return out; };
  const tidy = (s, max) => Array.from(wholeChars(String(s)).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()).slice(0, max).join('').trim();
  let idCounter = 0;
  const newId = () => ('n' + Date.now().toString(36) + (idCounter++).toString(36) + Math.floor(Math.random() * 1296).toString(36)).slice(0, 30);

  /* ---------- Notices ---------- */
  /** A clean notice, or null when there is no usable name or no usable section. Bad sections are dropped; other bad fields fall back to defaults. */
  function cleanNotice(v, levelIds) {
    if (!isObj(v) || typeof v.name !== 'string') return null;
    const name = tidy(v.name, LIMITS.name); if (!name) return null;
    const levels = Array.isArray(levelIds) && levelIds.length ? levelIds : DEFAULT_LEVELS;
    const given = Array.isArray(v.sections) ? v.sections : [], seen = new Set(), sections = [];
    for (const s of given) if (isObj(s) && SECTION_IDS.includes(s.id) && !seen.has(s.id) && intIn(s.count, 1, LIMITS.counts[s.id]) && intIn(s.minutes, LIMITS.minutes[0], LIMITS.minutes[1])) { seen.add(s.id); sections.push({ id: s.id, count: s.count, minutes: s.minutes }); }
    if (!sections.length) return null;
    sections.sort((a, b) => SECTION_IDS.indexOf(a.id) - SECTION_IDS.indexOf(b.id));
    const neg = NEGATIVES.find(n => typeof v.negative === 'number' && Math.abs(n - v.negative) < 1e-9);
    return {
      id: typeof v.id === 'string' && /^[\w-]{1,30}$/.test(v.id) ? v.id : newId(), name, source: typeof v.source === 'string' ? tidy(v.source, LIMITS.source) : '', sections,
      timing: v.timing === 'sectional' ? 'sectional' : 'total', negative: neg === undefined ? 0 : neg, level: typeof v.level === 'string' && levels.includes(v.level) ? v.level : 'mixed',
      nav: v.nav === 'forward' ? 'forward' : 'free', strict: typeof v.strict === 'boolean' ? v.strict : true, switchLimit: LIMITS.switchLimits.includes(v.switchLimit) ? v.switchLimit : 0
    };
  }
  /** What the test needs from a notice: section order, counts and time budgets in milliseconds. */
  function noticeConfig(n) {
    const sectionMs = n.sections.map(s => s.minutes * 60000);
    return { name: n.name, sections: n.sections.map(s => s.id), counts: Object.fromEntries(n.sections.map(s => [s.id, s.count])), sectionMs, totalMs: sectionMs.reduce((a, b) => a + b, 0),
      timing: n.timing, negative: n.negative, level: n.level, nav: n.nav, strict: n.strict, switchLimit: n.switchLimit };
  }

  /* ---------- A clock that does not pause ---------- */
  /** Accounts for `gapMs` of real time. Returns a new state and never changes `c`. In sectional timing a section that runs out hands the rest of the gap to the next one. */
  function advance(c, gapMs) {
    const out = { sectionIndex: c.sectionIndex, sectionElapsed: c.sectionElapsed.slice(), elapsed: c.elapsed, over: false, sectionsEnded: 0 };
    const gap = Number.isFinite(gapMs) ? gapMs : 0, last = c.sectionMs.length - 1;
    if (c.timing !== 'sectional') {
      const take = Math.max(0, Math.min(gap, c.totalMs - c.elapsed)); out.elapsed = c.elapsed + take; out.over = out.elapsed >= c.totalMs; return out;
    }
    if (out.sectionIndex >= last && c.sectionMs[last] - out.sectionElapsed[last] <= 0) { out.over = true; return out; }
    let left = gap;
    while (left > 0) {
      const i = out.sectionIndex, take = Math.min(left, Math.max(0, c.sectionMs[i] - out.sectionElapsed[i]));
      out.sectionElapsed[i] += take; out.elapsed += take; left -= take;
      if (out.sectionElapsed[i] < c.sectionMs[i]) break;
      out.sectionsEnded++;
      if (i === last) { out.over = true; break; }
      out.sectionIndex = i + 1;
    }
    return out;
  }

  /* ---------- Hashes and encodings ---------- */
  function fnv(text) { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
  const base36 = (n, len) => (n % Math.pow(36, len)).toString(36).padStart(len, '0');
  /** Six characters that depend on every question id in order: two copies of the site that build the same paper agree on it. */
  const paperCheck = questions => base36(fnv(questions.map(q => String(q && q.id)).join('\n')), 6);
  function toBase64Url(text) {
    const bin = encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'latin1').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromBase64Url(code) {
    if (!/^[A-Za-z0-9_-]*$/.test(code) || code.length % 4 === 1) throw new Error('bad base64');
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((code.length + 3) % 4);
    const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('latin1');
    return decodeURIComponent(Array.from(bin, c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
  }

  /* ---------- Shared papers ---------- */
  /** 'CR1.' plus the seed, the test settings and the paper check, packed as base64url JSON. Carries no source note and no personal data. */
  function encodePaper({ seed, config, check }) {
    const body = { s: seed >>> 0, n: config.name, q: config.sections.map((id, i) => [id, config.counts[id], Math.round(config.sectionMs[i] / 60000)]), t: config.timing === 'sectional' ? 'sectional' : 'total',
      g: config.negative, l: config.level, v: config.nav, x: config.strict ? 1 : 0, w: config.switchLimit, k: check };
    return PREFIX + toBase64Url(JSON.stringify(body));
  }
  /** { seed, config, check }, or null for anything that is not a well-formed paper code. */
  function decodePaper(code, levelIds) {
    if (typeof code !== 'string' || code.length > MAX_CODE || !code.startsWith(PREFIX)) return null;
    try {
      const b = JSON.parse(fromBase64Url(code.slice(PREFIX.length)));
      if (!isObj(b) || !intIn(b.s, 0, 4294967295) || typeof b.k !== 'string' || !/^[0-9a-z]{6}$/.test(b.k) || !Array.isArray(b.q) || !b.q.length || b.q.length > SECTION_IDS.length) return null;
      if (!b.q.every(r => Array.isArray(r) && r.length === 3) || typeof b.x !== 'number' || ![0, 1].includes(b.x)) return null;
      const levels = Array.isArray(levelIds) && levelIds.length ? levelIds : DEFAULT_LEVELS;
      if (typeof b.l !== 'string' || !levels.includes(b.l) || !['sectional', 'total'].includes(b.t) || !['free', 'forward'].includes(b.v) || !LIMITS.switchLimits.includes(b.w) || !NEGATIVES.some(n => typeof b.g === 'number' && Math.abs(n - b.g) < 1e-9)) return null;
      const n = cleanNotice({ id: 'paper', name: b.n, source: '', sections: b.q.map(([id, count, minutes]) => ({ id, count, minutes })), timing: b.t, negative: b.g, level: b.l, nav: b.v, strict: b.x === 1, switchLimit: b.w }, levelIds);
      if (!n || n.sections.length !== b.q.length) return null;
      return { seed: b.s, config: noticeConfig(n), check: b.k };
    } catch { return null; }
  }

  /* ---------- Result lines ---------- */
  const cut = (s, max) => Array.from(String(s)).slice(0, max).join('');
  const whole = x => Math.max(0, Math.round(Number(x) || 0));
  const cleanName = s => cut(String(s == null ? '' : s).replace(/[|\r\n\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim(), 40).trim() || 'Anonymous';
  /** The 4-character sum is a hash of the text before it. It catches copying mistakes only; anyone can compute it, so it is not tamper-proof. */
  const lineSum = text => base36(fnv(text), 4);
  function resultLine(r) {
    const score = Math.round((Number(r.score) || 0) * 100) / 100, check = String(r.check).replace(/[^0-9a-z]/g, '').slice(0, 6);
    const head = ['CR1', check, cleanName(r.name), String(score), whole(r.correct), whole(r.wrong), whole(r.skipped), whole(r.unreached), whole(r.seconds), whole(r.left)].join('|');
    return head + '|' + lineSum(head);
  }
  function parseResultLine(line) {
    if (typeof line !== 'string') return { error: 'Not text' };
    const f = line.trim().split('|');
    if (f[0] !== 'CR1') return { error: 'Does not start with CR1' };
    if (f.length !== 11) return { error: 'Expected 11 parts, found ' + f.length };
    if (!/^[0-9a-z]{6}$/.test(f[1])) return { error: 'The paper check is not 6 letters or digits' };
    if (!f[2].trim()) return { error: 'The name is empty' };
    if (!/^-?\d{1,6}(\.\d{1,2})?$/.test(f[3])) return { error: 'The score is not a number' };
    for (let i = 4; i <= 9; i++) if (!/^\d{1,7}$/.test(f[i])) return { error: 'A count or time is not a whole number' };
    if (lineSum(f.slice(0, 10).join('|')) !== f[10]) return { error: 'The check characters do not match, so the line was changed or copied wrongly' };
    const n = f.map(Number);
    return { check: f[1], name: f[2], score: n[3], correct: n[4], wrong: n[5], skipped: n[6], unreached: n[7], seconds: n[8], left: n[9] };
  }

  /* ---------- Ranking ---------- */
  /** Best score first, then least time, then name. Equal score and time share a rank (1, 2, 2, 4). */
  function rank(results) {
    const rows = results.map(r => ({ ...r })).sort((a, b) => b.score - a.score || a.seconds - b.seconds || String(a.name).localeCompare(String(b.name)));
    rows.forEach((r, i) => { const p = rows[i - 1]; r.rank = p && p.score === r.score && p.seconds === r.seconds ? p.rank : i + 1; });
    return rows;
  }
  const csvCell = v => { let s = String(v == null ? '' : v); if (/^[=+\-@\t]/.test(s) && typeof v === 'string') s = "'" + s; return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  /** CSV with a header row. Names that start with = + - or @ get a leading apostrophe so a spreadsheet does not treat them as formulas. */
  function toCsv(ranked) {
    const head = ['Rank', 'Name', 'Score', 'Correct', 'Wrong', 'Skipped', 'Not reached', 'Time (seconds)', 'Times left the test'];
    return [head, ...ranked.map(r => [r.rank, r.name, r.score, r.correct, r.wrong, r.skipped, r.unreached, r.seconds, r.left])].map(row => row.map(csvCell).join(',')).join('\n') + '\n';
  }

  /** Reads pasted result lines (blank lines ignored). The largest group sharing a paper check is the one to rank; ties go to the group that appears first. Same name twice is kept and flagged. */
  function collectLines(text) {
    const rows = [], bad = [];
    String(text == null ? '' : text).split(/\r\n|\r|\n/).forEach((raw, i) => {
      if (!raw.trim()) return;
      const p = parseResultLine(raw);
      if (p.error) bad.push({ line: i + 1, reason: p.error }); else rows.push({ ...p, line: i + 1 });
    });
    const groups = [];
    for (const r of rows) { let g = groups.find(x => x.check === r.check); if (!g) groups.push(g = { check: r.check, rows: [] }); g.rows.push(r); }
    const main = groups.reduce((best, g) => !best || g.rows.length > best.rows.length ? g : best, null);
    const other = groups.filter(g => g !== main).map(g => ({ check: g.check, lines: g.rows.map(r => r.line) }));
    const names = new Map();
    for (const r of main ? main.rows : []) { const k = r.name.trim().toLowerCase(); if (!names.has(k)) names.set(k, []); names.get(k).push(r); }
    const duplicates = [...names.values()].filter(l => l.length > 1).map(l => ({ name: l[0].name, lines: l.map(r => r.line) }));
    return { check: main ? main.check : null, rows: main ? main.rows : [], bad, other, duplicates };
  }

  const api = { LIMITS, SECTION_IDS, NEGATIVES, DEFAULT_LEVELS, cleanNotice, noticeConfig, advance, paperCheck, encodePaper, decodePaper, resultLine, parseResultLine, lineSum, collectLines, rank, toCsv };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AptitudeExam = api;
})(this);
