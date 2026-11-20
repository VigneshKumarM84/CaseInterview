/* Typed data requests for the case interview. Pure: no DOM, no storage.
   assess(text, exhibits) compares the words of a request with the words in the title and category of each exhibit.
   It matches words. It does not understand the request, and nothing here should be described as if it did. */
(function (root) {
  'use strict';
  // Words that carry no meaning of their own (four letters or more; shorter words are never used).
  const STOP = new Set(('that this with from have what which would could should about into there their they them then than were will your such some more much many most other also only just like want need show give tell know look help please does been being over each very when where whose whom here take make kind sort type form once still them these those because while after before between through during without within might shall must can cannot dont whats thats').split(/\s+/));
  // Words that name any request for data, so they say nothing about which data.
  const GENERIC = new Set(('data information info number numbers figure figures stats statistics detail details exhibit exhibits table tables report reports anything everything something whatever available request requests case client company investigation evidence context').split(/\s+/));
  // Groups of words that mean much the same thing in a case.
  const GROUPS = [
    'cost costs expense expenses spend spending',
    'price prices pricing tariff charge',
    'revenue revenues sales income turnover realisation',
    'customer customers user users consumer consumers buyer buyers shopkeeper shopkeepers',
    'competitor competitors competition competitive rival rivals',
    'capacity output throughput utilisation production',
    'demand demands market markets volume volumes',
    'margin margins profit profits profitability earnings financial financials finance economics economic',
    'churn retention retain attrition loyalty',
    'funnel conversion conversions convert',
    'segment segments split cohort cohorts breakdown',
    'region regions city cities location locations geography area areas',
    'option options alternative alternatives intervention interventions choice choices path paths idea ideas improvement improvements',
    'experiment experiments test tests trial trials pilot pilots',
    'result results outcome outcomes performance',
    'trend trends timeline history period',
    'freight shipping logistics delivery deliveries transport',
    'operation operations operating operational plant process',
    'research survey surveys interview interviews feedback'
  ];
  // Plain stemming: -ies, -ing, -ed, -s, then a trailing e, so price, prices, pricing and priced meet.
  function stem(w) {
    let s = w;
    if (s.length > 4 && s.endsWith('ies')) s = s.slice(0, -3) + 'y';
    else if (s.length > 5 && s.endsWith('ing')) { s = s.slice(0, -3); if (/(.)\1$/.test(s)) s = s.slice(0, -1); }
    else if (s.length > 4 && s.endsWith('ed')) { s = s.slice(0, -2); if (/(.)\1$/.test(s)) s = s.slice(0, -1); }
    else if (s.length > 3 && s.endsWith('s') && !/(ss|us|is)$/.test(s)) s = s.slice(0, -1);
    if (s.length > 3 && s.endsWith('e')) s = s.slice(0, -1);
    return s;
  }
  const GROUP_OF = new Map();
  GROUPS.forEach((g, i) => g.split(' ').forEach(w => { GROUP_OF.set(stem(w), 'g' + i); }));
  const key = w => { const s = stem(w); return GROUP_OF.get(s) || s; };
  const tokens = text => String(text == null ? '' : text).toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  /* The meaningful keys of a piece of text: words of four or more letters, minus stop words and generic words. */
  function keysOf(text) {
    const out = new Set();
    for (const w of tokens(text)) { if (w.length < 4 || STOP.has(w) || GENERIC.has(w)) continue; out.add(key(w)); }
    return out;
  }
  const CATCH_ALL = [
    /\b(all|any|every|whatever)\s+(of\s+)?(the\s+|your\s+)?(data|information|info|numbers|details|exhibits|figures|facts)\b/,
    /\beverything\b/,
    /\bmore\s+(details|data|information|info|numbers)\b/,
    /\bwhat\s+(data|information|info|numbers|exhibits)\s+(do\s+you|have\s+you|is|are)\b/,
    /\b(whatever|anything)\s+you\s+(have|can)\b/,
    /\bany\s+(data|information|info)\b/
  ];
  const catchAll = text => { const t = String(text == null ? '' : text).toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' '); return CATCH_ALL.some(r => r.test(t)); };
  const SHORT = 'Under six words: too short to name the cut you want and what it would tell you.';
  const CATCHY = 'A catch-all request such as “all the data”. Say which data, cut how, and what it would tell you.';

  function assess(text, exhibits) {
    const raw = String(text == null ? '' : text).trim();
    if (!raw) return { words: 0, broad: true, reason: 'No request was typed.', matches: [] };
    const words = raw.split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length;
    const want = keysOf(raw), list = Array.isArray(exhibits) ? exhibits : [];
    const scored = [];
    list.forEach((e, i) => {
      if (!e || e.id == null) return;
      let n = 0; const have = keysOf(String(e.title || '') + ' ' + String(e.category || ''));
      for (const k of want) if (have.has(k)) n++;
      if (n) scored.push({ id: e.id, n, i });
    });
    scored.sort((a, b) => b.n - a.n || a.i - b.i);
    const matches = scored.map(x => x.id), catchy = catchAll(raw);
    const broad = words < 6 || (!matches.length && catchy);
    let reason;
    if (!matches.length && catchy) reason = CATCHY;
    else if (words < 6) reason = SHORT;
    else if (!matches.length) reason = 'No word in your request appears in the titles of what is available.';
    else reason = 'Some words in your request appear in the titles of what is available.';
    return { words, broad, reason, matches };
  }
  const api = { assess };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CaseRequests = api;
})(typeof window !== 'undefined' ? window : null);
