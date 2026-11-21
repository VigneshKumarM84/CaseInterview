/* Moves: sets, generators, checks and readiness for the trained interview behaviours, with no DOM access so Node
   tests load this file directly. Eight moves are sets of items; the ninth (Attempt, leave or guess) is a round of eight
   aptitude questions: buildTriage makes it, triageVerdict and triageDebrief judge it. A set is a list of Spot items (machine-checked recognition) followed by Do items
   (produce it, then compare with weak, adequate and strong examples). Everything returned is JSON-serialisable.
   Same seed and same `recent` always give the same set. Depends on content/moves.js (the wording and authored items),
   src/drill-questions.js (rng, fmt, parseAnswer), src/behavioural-content.js (wordCount, hasNumber, hasOutcome, pronouns),
   src/case-requests.js (assess, for the broad-request check) and src/aptitude-questions.js. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const C = node ? require('../content/moves.js') : root.MovesContent;
  const D = node ? require('./drill-questions.js') : root.DrillQuestions;
  const B = node ? require('./behavioural-content.js') : root.BehaviouralContent;
  const A = node ? require('./aptitude-questions.js') : root.AptitudeQuestions;
  const CR = node ? require('./case-requests.js') : root.CaseRequests;
  const { MOVES, OPENINGS, STATEMENTS, SLIPS, ANSWER_FIRST, TRIAGE, SPLIT_IT, ONE_QUESTION, HOLD_OR_CHANGE, PUT_A_NUMBER, NEXT_LINE } = C;
  const { rng, fmt, parseAnswer } = D;
  const { wordCount, hasNumber, hasOutcome, pronouns } = B;

  const SET_MOVE_IDS = ['answer-first', 'so-what', 'number-sense', 'split-it', 'one-question', 'hold-or-change', 'put-a-number', 'next-line'];
  const MOVE_IDS = SET_MOVE_IDS.concat('triage');
  const SO_WHAT_PATTERNS = ['one-segment', 'rate-vs-volume', 'percent-vs-absolute', 'hidden-groups', 'turning-point', 'small-sample'];
  const SLIP_IDS = SLIPS.map(s => s.id);
  const CALL_IDS = TRIAGE.calls.map(c => c.id), LEVEL_MIX = ['easy', 'easy', 'easy', 'medium', 'medium', 'medium', 'hard', 'hard'];
  const TRIAGE_TOPICS = A.TOPICS.filter(t => (t.section === 'quant' || t.section === 'logical') && t.id !== 'di').map(t => t.id);
  const HISTORY_MAX = 600;
  const moveOf = id => MOVES.find(m => m.id === id) || null;

  /* ---------- Small helpers ---------- */
  const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (r, list) => list[Math.floor(r() * list.length)];
  const round = (x, dp = 6) => Math.round(x * 10 ** dp) / 10 ** dp;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const poss = n => n + (n.endsWith('s') ? '’' : '’s');
  const joinList = xs => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  function shuffle(r, list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  /* A short stable number from a set of strings, so a generated item has an id that history can refer to. */
  function short(...parts) {
    let h = 7;
    for (const ch of parts.join('|')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return String(h % 9000 + 1000);
  }
  /* A figure as digits only, with no commas or symbols: 12.5, 60, 1200. */
  const fig = n => String(Math.round(n * 100) / 100);
  const figs = ns => [...new Set(ns.map(fig))];
  /* Splits into sentences on whitespace after a full stop, exclamation mark or question mark. */
  const sentences = text => String(text || '').trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /* True when `term` occurs in `text` as a whole word or phrase, ignoring case. */
  const hasWord = (text, term) => new RegExp('(^|[^a-z0-9])' + escape(term.toLowerCase()) + '($|[^a-z0-9])').test(String(text || '').toLowerCase().replace(/[’‘]/g, "'"));

  /* ---------- Answer first ---------- */
  const WINDUPS = [
    /^so basically/, /^so,/, /^so (?:we had|let me|yeah)\b/, /^well[ ,]/, /^(?:okay|ok)\b/, /^basically\b/, /^first of all/, /^to begin with/, /^before i answer/,
    /^that(?: is|'s) an? (?:good|great|interesting|nice)\b[^.]*?question/, /^good (?:morning|afternoon|evening)/, /^thank you/,
    /^there are (?:many|several|various|a lot of|a number of)\b/, /^let me (?:start|begin|first)\b/, /^as (?:you|we all) know/, /^in today's/
  ];
  const HEDGES = ['it depends', 'depends on', 'might', 'maybe', 'perhaps', 'could be', 'hard to say', 'difficult to say', 'not sure', 'both sides', 'to some extent',
    'more or less', 'many factors', 'several factors', 'one good option', 'may have been', 'not really'];
  const CLOSERS = /^(?:so|therefore|hence|thus|in the end|finally|overall|that is why|that means|in conclusion|to conclude|to sum up)\b/i;

  /* Checks the shape of an Answer first reply: a committed first sentence, support, a number and a length. */
  function checkAnswerFirst(text) {
    const t = String(text || '').trim();
    if (!t) return { empty: true, words: 0, checks: [], pass: false };
    const parts = sentences(t), first = parts[0], words = wordCount(t), firstWords = wordCount(first), checks = [];
    checks.push(firstWords <= 25 ? { id: 'opening', level: 'ok', text: `Your first sentence is ${firstWords} words.` }
      : { id: 'opening', level: 'warn', text: `Your first sentence runs to ${firstWords} words. Make it one clear statement of 25 words or fewer.` });
    const stripped = first.replace(/^[^A-Za-z0-9]+/, ''), low = stripped.toLowerCase().replace(/[’‘]/g, "'");
    let wind = null;
    for (const re of WINDUPS) { const m = low.match(re); if (m) { wind = stripped.slice(0, m[0].length).replace(/[,.;:\s]+$/, ''); break; } }
    checks.push(wind ? { id: 'windup', level: 'warn', text: `You open with “${wind}”. Drop the wind-up and start with the answer.` }
      : { id: 'windup', level: 'ok', text: 'No wind-up before your answer.' });
    const hedge = HEDGES.find(h => hasWord(first, h));
    checks.push(hedge ? { id: 'hedge', level: 'warn', text: `Your first sentence hedges (“${hedge}”). Commit to an answer first and add the condition after it.` }
      : { id: 'hedge', level: 'ok', text: 'Your first sentence commits.' });
    const lastSentence = parts[parts.length - 1], late = parts.length >= 3 && CLOSERS.test(lastSentence.replace(/^[^A-Za-z0-9]+/, ''));
    checks.push(late ? { id: 'last', level: 'warn', text: `Your conclusion seems to come in the last sentence (“${lastSentence.split(/\s+/).slice(0, 3).join(' ')}…”). Move it to the front.` }
      : { id: 'last', level: 'ok', text: 'Your answer does not wait until the end.' });
    const support = parts.length >= 2 && words - firstWords >= 12;
    checks.push(support ? { id: 'support', level: 'ok', text: 'You follow your answer with support.' } : { id: 'support', level: 'warn', text: 'Add one or two reasons after your answer.' });
    checks.push(hasNumber(t) ? { id: 'number', level: 'ok', text: 'You used at least one number.' } : { id: 'number', level: 'warn', text: 'No number found. Use a figure from the facts.' });
    checks.push(words <= 80 ? { id: 'length', level: 'ok', text: `${words} words: inside 30 seconds.` } : { id: 'length', level: 'warn', text: `${words} words runs past 30 seconds at speaking pace. Aim for about 75.` });
    return { empty: false, words, checks, pass: checks.every(c => c.level === 'ok') };
  }

  /* Builds the Answer first set: four Spot items then two Do items, six different authored items, unseen ones first. */
  function answerFirstSet(r, recent) {
    const fresh = shuffle(r, ANSWER_FIRST.filter(x => !recent.includes(x.id)));
    const seen = ANSWER_FIRST.filter(x => recent.includes(x.id)).sort((a, b) => recent.indexOf(b.id) - recent.indexOf(a.id));
    const chosen = fresh.concat(seen).slice(0, 6);
    return chosen.map((x, i) => i < 4
      ? { rung: 'spot', move: 'answer-first', id: x.id, round: x.round, question: x.question, options: shuffle(r, x.openings).map(o => ({ kind: o.kind, text: o.text })) }
      : { rung: 'do', move: 'answer-first', id: x.id, round: x.round, question: x.question, facts: x.facts.slice(), weak: x.weak, adequate: x.adequate, strong: x.strong });
  }

  /* ---------- So what? ---------- */
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const SHARES = { '1/5': 'one in five', '1/4': 'one in four', '3/10': 'three in ten', '2/5': 'two in five' };

  /* Puts the four statements in a random order and wraps the table and examples into a So what? item. */
  function assemble(r, pattern, title, columns, rows, t, figures, focus) {
    const why = { insight: STATEMENTS.insight.why, description: STATEMENTS.description.why, overreach: STATEMENTS.overreach.why, misread: t.misreadWhy };
    const statements = shuffle(r, ['insight', 'description', 'overreach', 'misread']).map(kind => ({ kind, text: t[kind], why: why[kind] }));
    return { move: 'so-what', pattern, id: pattern + '-' + short(title, ...rows.flat()), title, table: { columns, rows }, statements,
      weak: t.description, adequate: t.adequate, strong: t.insight, figures: figs(figures), focus };
  }

  const ONE_SEGMENT = [
    { title: 'Revenue by region, ₹ lakh', head: ['Region', 'Last year', 'This year'], names: ['North', 'South', 'East', 'West', 'Central'], range: [80, 200], drop: [25, 45], rise: [25, 50],
      seg: 'region', noun: 'revenue', amt: v => `₹${fmt(v)} lakh`, delta: (n, up) => `₹${fmt(n)} lakh ${up ? 'rise' : 'fall'}`,
      over: (s, up) => up ? `A new advertising push in ${s} is working, so the company should copy it in every region.` : `A competitor has cut prices in ${s}, so the company should match those prices.`,
      mis: up => up ? 'Revenue rose in every region, so the growth is spread across the whole market rather than coming from one place.' : 'Revenue fell in every region, so the decline is spread across the whole market rather than sitting in one place.' },
    { title: 'Hostel complaints by block, last term and this term', head: ['Block', 'Last term', 'This term'], names: ['Block A', 'Block B', 'Block C', 'Block D'], range: [40, 70], drop: [35, 60], rise: [60, 150],
      seg: 'block', noun: 'complaints', amt: v => fmt(v), delta: (n, up) => `${fmt(n)} ${up ? 'extra' : 'fewer'} complaints`,
      over: (s, up) => up ? `The mess contractor is cutting corners in ${s}, so the contract should be cancelled.` : `The warden’s new rules in ${s} are working, so they should be copied in every block.`,
      mis: up => up ? 'Complaints rose in every block, so the problem is spread across the whole hostel rather than sitting in one block.' : 'Complaints fell in every block, so the improvement is spread across the whole hostel rather than coming from one block.' },
    { title: 'Weekly orders by dark store', head: ['Store', 'Last week', 'This week'], names: ['Koramangala', 'Whitefield', 'Indiranagar', 'HSR'], range: [300, 900], drop: [25, 45], rise: [25, 50],
      seg: 'store', noun: 'orders', amt: v => fmt(v), delta: (n, up) => `${fmt(n)} ${up ? 'extra' : 'fewer'} orders`,
      over: (s, up) => up ? `A rival shut down near ${s}, so the company should raise prices there.` : `Riders have been quitting in ${s}, so the company should raise rider pay there.`,
      mis: up => up ? 'Orders rose at every store, so the extra demand is spread across the city rather than coming from one area.' : 'Orders fell at every store, so the drop is spread across the city rather than sitting in one area.' }
  ];
  /* One segment moves a lot and the rest barely move: the insight is where the change is. */
  function oneSegment(r) {
    const c = pick(r, ONE_SEGMENT), up = r() < 0.5, n = int(r, 3, 4), names = shuffle(r, c.names).slice(0, n);
    for (let tries = 0; tries < 2000; tries++) {
      const d = int(r, 0, n - 1), old = names.map(() => int(r, c.range[0], c.range[1])), [lo, hi] = up ? c.rise : c.drop;
      const dd = Math.round(old[d] * int(r, lo, hi) / 100) * (up ? 1 : -1);
      const dl = old.map((o, i) => { if (i === d) return dd; const m = Math.floor(o * 0.03); return int(r, -m, m); });
      const tot = dl.reduce((a, b) => a + b, 0), opp = dl.findIndex((x, i) => i !== d && x * dd < 0);
      if (opp < 0 || tot * dd <= 0 || Math.abs(dd) / Math.abs(tot) < 0.85 || Math.abs(dd) > Math.abs(tot)) continue;
      const now = old.map((o, i) => o + dl[i]), oldT = old.reduce((a, b) => a + b, 0), nowT = oldT + tot;
      const top = now.indexOf(Math.max(...now)), S = names[d], minors = names.filter((_, i) => i !== d), were = minors.length > 1 ? 'were' : 'was', gap = fmt(Math.abs(tot)), pct = Math.round(Math.abs(tot) / oldT * 100);
      const rows = names.map((nm, i) => [nm, fmt(old[i]), fmt(now[i])]).concat([['Total', fmt(oldT), fmt(nowT)]]);
      const delta = c.delta(Math.abs(tot), up);
      return assemble(r, 'one-segment', c.title, c.head, rows, {
        insight: `Almost all of the ${delta} came from ${S}. ${joinList(minors)} ${were} flat, so the question is what changed in ${S}.`,
        adequate: `Almost all of the ${delta} came from ${S}; ${joinList(minors)} ${were} flat.`,
        description: `Total ${c.noun} ${up ? 'rose' : 'fell'} from ${c.amt(oldT)} to ${c.amt(nowT)}, a ${up ? 'rise' : 'drop'} of about ${pct}%. The largest ${c.seg} is now ${names[top]}, at ${c.amt(now[top])} of the ${c.amt(nowT)}.`,
        overreach: c.over(S, up), misread: c.mis(up),
        misreadWhy: `${names[opp]} actually ${up ? 'fell' : 'rose'}, from ${fmt(old[opp])} to ${fmt(now[opp])}. Only ${S} moved by much.`
      }, [...old, ...now, oldT, nowT, Math.abs(tot), Math.abs(dd), pct], [S.toLowerCase()]);
    }
    throw new Error('one-segment: no table found');
  }

  const RATE_VOLUME = [
    { title: 'Online store, last month and this month', head: ['', 'Last month', 'This month'], per: 'month', subj: 'the store', did: ['sold more', 'sold less'], vol: 'Visitors', rate: 'Conversion', out: 'Orders', volNP: 'visitors', rateNP: 'conversion', outNP: 'orders', look: 'traffic',
      buy: ['the site converts better', 'the site converts worse'], overDown: 'Marketing must have cut the advertising budget, so restoring it will bring orders back.', overUp: 'The new discount code is bringing in buyers, so it should be sent to every customer.' },
    { title: 'College fest, last year and this year', head: ['', 'Last year', 'This year'], per: 'year', subj: 'the fest', did: ['sold more tickets', 'sold fewer tickets'], vol: 'Footfall', rate: 'Ticket rate', out: 'Tickets sold', volNP: 'footfall', rateNP: 'the ticket rate', outNP: 'ticket sales', look: 'footfall',
      buy: ['more people buy tickets', 'fewer people buy tickets'], overDown: 'The ticket price must have gone up, so it should be cut again.', overUp: 'The new poster campaign must have worked, so it should be repeated every week.' },
    { title: 'Coaching centre, last quarter and this quarter', head: ['', 'Last quarter', 'This quarter'], per: 'quarter', subj: 'the centre', did: ['enrolled more students', 'enrolled fewer students'], vol: 'Enquiries', rate: 'Enrolment rate', out: 'Enrolments', volNP: 'enquiries', rateNP: 'the enrolment rate', outNP: 'enrolments', look: 'enquiries',
      buy: ['more enquiries turn into enrolments', 'fewer enquiries turn into enrolments'], overDown: 'The counsellors must be less convincing, so they need retraining.', overUp: 'The new batch timings are drawing students in, so every course should switch to them.' }
  ];
  /* A rate moves one way and the volume feeding it moves the other: the outcome follows the volume. */
  function rateVolume(r) {
    const c = pick(r, RATE_VOLUME), up = r() < 0.5;
    for (let tries = 0; tries < 2000; tries++) {
      const c1 = up ? pick(r, [5, 6, 8, 10]) : pick(r, [2, 3, 4, 5, 6, 8]), c2 = up ? c1 - 1 : c1 + 1, V1 = 10000 * int(r, 2, 8), k = up ? int(r, 30, 60) : int(r, 12, 40);
      const V2 = V1 * (up ? 100 + k : 100 - k) / 100, o1 = V1 * c1 / 100, o2 = V2 * c2 / 100;
      if (!Number.isInteger(o1) || !Number.isInteger(o2) || (up ? o2 < o1 * 1.05 : o2 > o1 * 0.95)) continue;
      const pct = Math.round(Math.abs(o2 - o1) / o1 * 100), rn = cap(c.rateNP);
      const rows = [[c.vol, fmt(V1), fmt(V2)], [c.rate, c1 + '%', c2 + '%'], [c.out, fmt(o1), fmt(o2)]];
      const finding = `${cap(c.outNP)} ${up ? 'rose' : 'fell'} because ${c.volNP} ${up ? 'grew' : 'dropped'} ${k}%, not because ${c.buy[up ? 0 : 1]}.`;
      return assemble(r, 'rate-vs-volume', c.title, c.head, rows, {
        insight: `${finding} ${rn} ${up ? 'fell' : 'rose'}, so ${up ? 'what matters is where the extra ' + c.volNP + ' came from' : 'the place to look is ' + c.look}.`,
        adequate: finding,
        description: `${rn} ${up ? 'fell' : 'rose'} from ${c1}% to ${c2}% while ${c.outNP} ${up ? 'rose' : 'fell'} from ${fmt(o1)} to ${fmt(o2)}. ${cap(c.volNP)} ${up ? 'rose' : 'fell'} from ${fmt(V1)} to ${fmt(V2)}.`,
        overreach: up ? c.overUp : c.overDown,
        misread: up ? `${rn} fell, so ${c.subj} did worse this ${c.per} than last, and ${c.outNP} went down with it.` : `${rn} improved, so ${c.subj} did better this ${c.per} than last, and ${c.outNP} went up with it.`,
        misreadWhy: `${rn} ${up ? 'fell' : 'rose'} from ${c1}% to ${c2}%, but ${c.outNP} ${up ? 'rose' : 'fell'} from ${fmt(o1)} to ${fmt(o2)}. ${cap(c.subj)} ${c.did[up ? 0 : 1]}.`
      }, [V1, V2, c1, c2, o1, o2, k, pct, Math.abs(o2 - o1)], [...new Set([c.look, c.volNP])]);
    }
    throw new Error('rate-vs-volume: no table found');
  }

  const PCT_ABS = [
    { title: 'Campus bookshop revenue by line, ₹ lakh', names: ['Stationery', 'Uniforms', 'Books'], over: (S, B) => `${S} will overtake ${B} within a few years, so most of the budget should move to it.` },
    { title: 'Café chain revenue by product, ₹ lakh', names: ['Cold brew', 'Snacks', 'Chai'], over: (S, B) => `${S} is the future of the café, so the menu should be rebuilt around it.` },
    { title: 'Phone shop revenue by line, ₹ lakh', names: ['Accessories', 'Repairs', 'Handsets'], over: (S, B) => `Customers are shifting from ${B} to ${S}, so the shop should stop stocking ${B}.` }
  ];
  /* The fastest-growing line is tiny, so the big line adds most of the rupees. */
  function percentAbsolute(r) {
    const c = pick(r, PCT_ABS), [S, M, Bg] = c.names;
    for (let tries = 0; tries < 2000; tries++) {
      const s0 = pick(r, [10, 12, 15, 20, 25, 30]), gs = pick(r, [50, 60, 75, 80, 100]), m0 = pick(r, [50, 60, 80, 100, 120, 150]), gm = pick(r, [10, 15, 20, 25]);
      const b0 = pick(r, [300, 400, 500, 600, 800, 1000]), gb = pick(r, [8, 10, 12, 15, 20]);
      const s1 = s0 * (100 + gs) / 100, m1 = m0 * (100 + gm) / 100, b1 = b0 * (100 + gb) / 100;
      if (![s1, m1, b1].every(Number.isInteger) || gs <= gm || gs <= gb) continue;
      const ds = s1 - s0, dm = m1 - m0, db = b1 - b0;
      if (db <= ds || db <= dm || db < 0.6 * (ds + dm + db)) continue;
      const rows = shuffle(r, [[S, s0, s1, gs], [M, m0, m1, gm], [Bg, b0, b1, gb]]).map(([n, a, b, g]) => [n, fmt(a), fmt(b), g + '%']);
      const finding = `${S} grew fastest at ${gs}%, but ${Bg} added ₹${fmt(db)} lakh against ${poss(S)} ₹${fmt(ds)} lakh.`;
      return assemble(r, 'percent-vs-absolute', c.title, ['Line', 'Last year', 'This year', 'Growth'], rows, {
        insight: `${finding.slice(0, -1)}, so ${Bg} is still the line to protect.`,
        adequate: finding,
        description: gm === gb ? `${S} grew ${gs}%, while ${M} and ${Bg} each grew ${gm}%. ${Bg} is the largest line this year, at ₹${fmt(b1)} lakh, well ahead of the other two.` : `${S} grew ${gs}%, while ${M} grew ${gm}% and ${Bg} grew ${gb}%. ${Bg} is the largest line this year, at ₹${fmt(b1)} lakh, well ahead of the other two.`,
        overreach: c.over(S, Bg), misread: `${S} contributed the most to this year’s growth in revenue, adding more rupees than ${M} and ${Bg} put together.`,
        misreadWhy: `${S} added ₹${fmt(ds)} lakh, from ${fmt(s0)} to ${fmt(s1)}. ${Bg} added ₹${fmt(db)} lakh.`
      }, [s0, s1, m0, m1, b0, b1, gs, gm, gb, ds, dm, db], [Bg.toLowerCase(), S.toLowerCase()]);
    }
    throw new Error('percent-vs-absolute: no table found');
  }

  const HIDDEN = [
    { title: t => `Delivery time by area, target ${t} minutes`, head: ['Area', 'Orders', 'Average delivery (min)'], groups: ['Metro', 'Non-metro'], lower: true, good: [18, 30], bad: [45, 65], step: 5, gap: 2, suffix: '',
      avg: ov => `${Math.round(ov)}-minute`, desc: (ov, t, g, gp, T) => `The average delivery time is ${fmt(ov, 1)} minutes against a target of ${t}, which is ${fmt(Math.abs(t - ov), 1)} minutes inside it. ${g} orders make up ${gp}% of the ${fmt(T)} orders in the table.`,
      line: (g, b, mBad, share, ov) => `The ${Math.round(ov)}-minute average meets the target only because ${g.toLowerCase()} orders are fast. ${b} orders take ${mBad} minutes, so ${share} orders miss it and that is where to work.`,
      first: (g, b, mBad, ov) => `The ${Math.round(ov)}-minute average meets the target only because ${g.toLowerCase()} orders are fast. ${b} orders take ${mBad} minutes.`,
      over: b => `${b} riders are less motivated, so they need stricter monitoring.`, mis: t => `Deliveries are within the ${t}-minute target in both areas, so the average is a fair picture of each one.`,
      why: (g, b, mBad, t) => `${b} orders average ${mBad} minutes, above the ${t}-minute target. Only ${g} is within it.` },
    { title: t => `Class attendance by student type, target ${t}%`, head: ['Students', 'Count', 'Attendance'], groups: ['Hostellers', 'Day scholars'], lower: false, good: [82, 95], bad: [52, 70], step: 5, gap: 2, suffix: '%',
      avg: ov => `${Math.round(ov)}%`, desc: (ov, t, g, gp, T) => `Overall attendance is ${fmt(ov, 1)}% against a target of ${t}%, which is ${fmt(Math.abs(t - ov), 1)} points above it. ${g} make up ${gp}% of the ${fmt(T)} students in the table.`,
      line: (g, b, mBad, share, ov) => `The ${Math.round(ov)}% average meets the target only because ${g.toLowerCase()} attend well. ${b} attend ${mBad}%, so ${share} students fall short and that is where to work.`,
      first: (g, b, mBad, ov) => `The ${Math.round(ov)}% average meets the target only because ${g.toLowerCase()} attend well. ${b} attend ${mBad}% of classes.`,
      over: b => `${b} care less about class, so their attendance should be checked every day.`, mis: t => `Both hostellers and day scholars meet the ${t}% attendance target, so the average is a fair picture of each group.`,
      why: (g, b, mBad, t) => `${b} attend ${mBad}%, below the ${t}% target. Only ${g.toLowerCase()} are above it.` },
    { title: t => `Repair time by drop-off method, target ${t} days`, head: ['Method', 'Repairs', 'Average time (days)'], groups: ['Walk-in repairs', 'Mailed-in repairs'], lower: true, good: [2, 4], bad: [8, 12], step: 1, gap: 0.5, suffix: '',
      avg: ov => `${fmt(ov, 1)}-day`, desc: (ov, t, g, gp, T) => `The average repair takes ${fmt(ov, 1)} days against a target of ${t}, which is ${fmt(Math.abs(t - ov), 1)} days inside it. ${g} make up ${gp}% of the ${fmt(T)} repairs in the table.`,
      line: (g, b, mBad, share, ov) => `The ${fmt(ov, 1)}-day average meets the target only because ${g.toLowerCase()} are quick. ${b} take ${mBad} days, so ${share} repairs miss it and that is where to work.`,
      first: (g, b, mBad, ov) => `The ${fmt(ov, 1)}-day average meets the target only because ${g.toLowerCase()} are quick. ${b} take ${mBad} days.`,
      over: b => `The courier is damaging phones in transit, so the company should change courier.`, mis: t => `Both kinds of repair are done within the ${t}-day target, so the average is a fair picture of each one.`,
      why: (g, b, mBad, t) => `${b} take ${mBad} days, above the ${t}-day target. Only ${g.toLowerCase()} are within it.` }
  ];
  /* An average meets its target only because one group is far better than the other. */
  function hiddenGroups(r) {
    const c = pick(r, HIDDEN);
    for (let tries = 0; tries < 3000; tries++) {
      const T = pick(r, [4000, 5000, 8000, 10000, 12000, 20000]), [sn, sd] = pick(r, [[1, 5], [1, 4], [3, 10], [2, 5]]), n2 = T * sn / sd;
      if (!Number.isInteger(n2)) continue;
      const n1 = T - n2, mGood = int(r, c.good[0], c.good[1]), mBad = int(r, c.bad[0], c.bad[1]), sum = n1 * mGood + n2 * mBad;
      if ((sum * 10) % T) continue;
      const ov = Math.round(sum / T * 10) / 10, targets = [];
      for (let t = c.step; t <= 200; t += c.step) if (c.lower ? t >= ov + c.gap && t <= mBad - c.step : t >= mBad + c.step && t <= ov - c.gap) targets.push(t);
      if (!targets.length) continue;
      const t = pick(r, targets), share = SHARES[sn + '/' + sd], [g, b] = c.groups, sf = c.suffix;
      const rows = shuffle(r, [[g, fmt(n1), fmt(mGood, 1) + sf], [b, fmt(n2), fmt(mBad, 1) + sf]]).concat([['Overall', fmt(T), fmt(ov, 1) + sf]]);
      return assemble(r, 'hidden-groups', c.title(t), c.head, rows, {
        insight: c.line(g, b, mBad, share, ov), adequate: c.first(g, b, mBad, ov), description: c.desc(ov, t, g, 100 - sn / sd * 100, T), overreach: c.over(b), misread: c.mis(t), misreadWhy: c.why(g, b, mBad, t)
      }, [n1, n2, T, mGood, mBad, ov, Math.round(ov), t, sn / sd * 100, 100 - sn / sd * 100, Math.round(Math.abs(t - ov) * 10) / 10], [b.toLowerCase()]);
    }
    throw new Error('hidden-groups: no table found');
  }

  const TURNING = [
    { title: 'New sign-ups by month', label: 'Sign-ups', cap: 'Sign-ups', range: [300, 900], over: p => `The price rise in ${p} put new users off, so the price should go back down.` },
    { title: 'Tiffin service orders by month', label: 'Orders', cap: 'Orders', range: [600, 1500], over: p => `The change of delivery partner in ${p} cut orders, so the old partner should be brought back.` },
    { title: 'Gym renewals by month', label: 'Renewals', cap: 'Renewals', range: [100, 400], over: p => `The new trainer who joined in ${p} is unpopular, so he should be replaced.` }
  ];
  /* A series rises to a peak in month three or four, then falls: the insight is that the problem has a date. */
  function turningPoint(r) {
    const c = pick(r, TURNING), start = int(r, 0, 6), p = pick(r, [2, 3]), q = 5 - p, u = Math.max(5, Math.round(int(r, c.range[0], c.range[1]) / 20 / 5) * 5);
    const v0 = u * int(r, 15, 22), vals = [v0];
    for (let i = 0; i < p; i++) vals.push(vals[i] + u * int(r, 1, 3));
    const decs = Array.from({ length: q }, () => u * int(r, 1, 4));
    while (vals[p] - decs.reduce((a, b) => a + b, 0) > v0 * 1.03) decs[int(r, 0, q - 1)] += u;
    for (let i = 0; i < q; i++) vals.push(vals[p + i] - decs[i]);
    const m = i => MONTHS[(start + i) % 12], peak = m(p), next = m(p + 1), finding = `${c.cap} rose every month until ${peak}, when they hit ${fmt(vals[p])}, and have fallen since.`;
    const rows = vals.map((v, i) => [m(i).slice(0, 3), fmt(v)]);
    return assemble(r, 'turning-point', c.title, ['Month', c.label], rows, {
      insight: `${finding} The problem has a date, so ask what changed in ${peak} or ${next}.`, adequate: finding,
      description: `${c.cap} were ${fmt(vals[0])} in ${m(0)} and ${fmt(vals[5])} in ${m(5)}. Across the six months they ranged from a low of ${fmt(Math.min(...vals))} to a high of ${fmt(vals[p])}, a spread of ${fmt(vals[p] - Math.min(...vals))}.`, overreach: c.over(peak), misread: `${c.cap} have been falling steadily since ${m(0)}, so this is a slow decline that has run for all six months.`,
      misreadWhy: `${c.cap} rose from ${fmt(vals[0])} in ${m(0)} to ${fmt(vals[p])} in ${peak} before they started to fall.`
    }, [...vals, vals[p] - vals[5], vals[p] - vals[0]], [peak.toLowerCase(), next.toLowerCase()]);
  }

  const SMALL = [
    { title: 'Customer satisfaction by store', head: ['Store', 'Responses', 'Satisfied', 'Satisfied %'], unit: 'Store', person: 'customer', pos: 'who were satisfied', all: 'were satisfied', desc: 'on satisfaction',
      over: (a, b) => `${a}’s manager is better with customers, so ${b} should copy how ${a} is run.`, mis: (a, b, gap) => `More customers were satisfied at ${a} than at ${b}, and a ${gap}-point lead is too wide to be down to chance.` },
    { title: 'Mess rating by hostel', head: ['Hostel', 'Responses', 'Rated good', 'Rated good %'], unit: 'Hostel', person: 'student', pos: 'who rated the mess good', all: 'rated the mess good', desc: 'on the mess rating',
      over: (a, b) => `${a}’s mess contractor is better, so ${b} should switch to the same contractor.`, mis: (a, b, gap) => `More students rated the mess good at ${a} than at ${b}, and a ${gap}-point lead is too wide to be down to chance.` },
    { title: 'Workshop feedback by session', head: ['Session', 'Responses', 'Would recommend', 'Would recommend %'], unit: 'Workshop', person: 'participant', pos: 'who would recommend it', all: 'would recommend it', desc: 'on recommending the workshop',
      over: (a, b) => `${a}’s trainer is the reason it scores higher, so ${b} should bring in the same trainer.`, mis: (a, b, gap) => `More participants would recommend ${a} than ${b}, and a ${gap}-point lead is too wide to be down to chance.` }
  ];
  /* A striking rate rests on very few cases, while the plainer rate rests on hundreds. */
  function smallSample(r) {
    const c = pick(r, SMALL), letters = shuffle(r, ['A', 'B', 'C', 'D']), A = `${c.unit} ${letters[0]}`, Bn = `${c.unit} ${letters[1]}`;
    const smalls = [];
    for (const n of [8, 10, 12, 15, 16, 20]) for (let p = 70; p <= 95; p++) if (n * p % 100 === 0) smalls.push([n, p]);
    for (let tries = 0; tries < 2000; tries++) {
      const [nA, pA] = pick(r, smalls), pB = int(r, 55, 85), step = 100 / gcd(100, pB), lo = Math.ceil(400 / step), hi = Math.floor(900 / step);
      if (pA < pB + 6 || hi < lo) continue;
      const nB = step * int(r, lo, hi), sA = nA * pA / 100, sB = nB * pB / 100, pts = 100 / nA, ptsTxt = Number.isInteger(pts) ? `${pts} points` : `about ${fmt(pts, 1)} points`;
      const rows = shuffle(r, [[A, fmt(nA), fmt(sA), pA + '%'], [Bn, fmt(nB), fmt(sB), pB + '%']]);
      const finding = `${A}’s ${pA}% rests on ${nA} responses. ${Bn}’s ${pB}% rests on ${fmt(nB)}.`;
      return assemble(r, 'small-sample', c.title, c.head, rows, {
        insight: `${A}’s ${pA}% rests on ${nA} responses, so one unhappy ${c.person} would move it by ${ptsTxt}. ${Bn}’s ${pB}% from ${fmt(nB)} responses is the figure to act on.`,
        adequate: finding, description: `${A} scored ${pA}% and ${Bn} scored ${pB}% ${c.desc}, a gap of ${pA - pB} points. In all, ${fmt(sA + sB)} of the ${fmt(nA + nB)} ${c.person}s who responded ${c.all}.`, overreach: c.over(A, Bn), misread: c.mis(A, Bn, pA - pB),
        misreadWhy: `${A} had ${fmt(sA)} ${c.person}s ${c.pos} and ${Bn} had ${fmt(sB)}. A higher percentage on ${nA} responses is far fewer people.`
      }, [nA, sA, pA, nB, sB, pB, pts, pA - pB], [A.toLowerCase(), Bn.toLowerCase()]);
    }
    throw new Error('small-sample: no table found');
  }

  const SO_WHAT = { 'one-segment': oneSegment, 'rate-vs-volume': rateVolume, 'percent-vs-absolute': percentAbsolute, 'hidden-groups': hiddenGroups, 'turning-point': turningPoint, 'small-sample': smallSample };
  /* Generates one So what? item for a pattern; the caller adds `rung`. */
  function generateSoWhat(rand, patternId) {
    if (!SO_WHAT[patternId]) throw new Error('Unknown pattern: ' + patternId);
    return SO_WHAT[patternId](rand);
  }

  const FOLLOWS = /(?:^|[^a-z0-9])(?:so|which means|therefore|meaning|suggests?|implies|should|needs? to|next|check|ask|because of this|the question is)(?:$|[^a-z0-9])/i;
  /* Checks the shape of a So what? reply: a figure from the table, where to look, what follows, and a length. */
  function checkSoWhat(text, item) {
    const t = String(text || '').trim();
    if (!t) return { empty: true, words: 0, checks: [], pass: false };
    const words = wordCount(t), known = new Set(((item && item.figures) || []).map(f => Number(f)));
    const quoted = (t.match(/\d[\d,]*(?:\.\d+)?/g) || []).some(tok => known.has(Number(tok.replace(/,/g, ''))));
    const where = ((item && item.focus) || []).some(f => hasWord(t, f));
    const checks = [
      quoted ? { id: 'figure', level: 'ok', text: 'You quoted a figure from the table.' } : { id: 'figure', level: 'warn', text: 'Quote the figure that matters.' },
      where ? { id: 'where', level: 'ok', text: 'You said where to look.' } : { id: 'where', level: 'warn', text: 'Say where the change is.' },
      FOLLOWS.test(t.replace(/[’‘]/g, "'")) ? { id: 'follows', level: 'ok', text: 'You said what follows.' } : { id: 'follows', level: 'warn', text: 'Add what follows: where you would look or what you would do next.' },
      words <= 45 ? { id: 'length', level: 'ok', text: `${words} words: short enough to say in one breath.` } : { id: 'length', level: 'warn', text: `${words} words is long for one point. Cut it to a sentence or two.` }
    ];
    return { empty: false, words, checks, pass: checks.every(x => x.level === 'ok') };
  }

  /* ---------- Does that number make sense? ---------- */
  const pairs = (as, bs, keep) => as.flatMap(a => bs.map(b => [a, b])).filter(([a, b]) => keep(a, b));
  const twoDp = x => Math.abs(x * 100 - Math.round(x * 100)) < 1e-6;
  const ZERO_PAIRS = pairs([20000, 25000, 40000, 50000, 60000, 75000, 80000, 100000, 120000, 150000, 200000, 250000, 400000],
    [1200, 1500, 1800, 2000, 2400, 3000, 3600, 4000, 4500, 5000, 6000, 7500, 9000, 12000], (n, p) => { const c = n * p / 1e7; return c >= 1 && c <= 20 && twoDp(c); });
  const POINT_PAIRS = [[4, 5], [8, 10], [5, 6], [10, 12], [20, 25], [4, 6], [10, 15], [2, 3], [5, 8], [25, 30], [8, 12], [40, 50]];
  const BASE_PAIRS = [[80, 100], [60, 75], [40, 50], [200, 250], [100, 125], [400, 500], [800, 1000], [1200, 1500], [100, 200]].flatMap(([a, b]) => [[a, b], [b, a]]);
  const PROFIT_COMBOS = pairs([200, 250, 400, 500, 800, 1000, 1500, 2000, 5000, 10000, 20000], [40, 50, 60, 80, 100, 120, 150, 250, 300, 500], () => true)
    .flatMap(([u, p]) => [0.5, 0.6, 0.7, 0.75, 0.8].map(f => [u, p, p * f])).filter(([u, p, c]) => Number.isInteger(c) && (u * (p - c) < 1e5 || u * (p - c) % 1000 === 0));
  const inr = n => '₹' + fmt(n, 4);

  /* One scenario family per slip. `draw` picks the inputs without looking at whether the item will be slipped, so a correct
     item and a slipped item from the same seed have identical wording. `wrong` is the specific slipped calculation. */
  const FAMILIES = {
    zeros: {
      unit: '₹ crore', draw: r => { const [N, P] = pick(r, ZERO_PAIRS); return { N, P, up: r() < 0.5 }; },
      correct: p => round(p.N * p.P / 1e7), wrong: p => round(p.up ? p.N * p.P / 1e6 : p.N * p.P / 1e8),
      ctxs: [
        p => ({ setup: `A coaching app has ${fmt(p.N)} subscribers, each paying ₹${fmt(p.P)} a year.`, claim: f => `So annual revenue is ₹${f} crore.`, ask: 'Annual revenue, in ₹ crore' }),
        p => ({ setup: `A hostel chain has ${fmt(p.N)} students, each paying ₹${fmt(p.P)} a year in fees.`, claim: f => `So the chain earns ₹${f} crore a year in fees.`, ask: 'Yearly fee income, in ₹ crore' }),
        p => ({ setup: `A tiffin service has ${fmt(p.N)} customers, each spending ₹${fmt(p.P)} a year.`, claim: f => `So yearly sales come to ₹${f} crore.`, ask: 'Yearly sales, in ₹ crore' })
      ],
      working: p => [`${fmt(p.N)} × ₹${fmt(p.P)} = ₹${fmt(p.N * p.P)}.`, 'One crore is ₹1,00,00,000, which has seven zeros.', `₹${fmt(p.N * p.P)} ÷ 1,00,00,000 = ₹${fmt(p.N * p.P / 1e7, 4)} crore.`],
      why: (p, c, w) => `${fmt(p.N)} × ₹${fmt(p.P)} is ₹${fmt(p.N * p.P)}, which is ₹${fmt(c, 4)} crore. The figure given is ${p.up ? 'ten times too large' : 'ten times too small'}: it has a zero ${p.up ? 'too many' : 'too few'}.`,
      okWhy: (p, c) => `Check: ${fmt(p.N)} × ₹${fmt(p.P)} is about ₹${fmt(p.N * p.P)}, and a crore is ₹1,00,00,000, so ₹${fmt(c, 4)} crore.`
    },
    period: {
      unit: '₹ lakh', draw: r => ({ S: pick(r, [8, 10, 12, 15, 20, 25, 40, 50]), R: pick(r, [20000, 25000, 30000, 40000, 50000, 60000, 75000, 80000]) }),
      correct: p => round(p.S * p.R * 12 / 1e5), wrong: p => round(p.S * p.R / 1e5),
      ctxs: [
        p => ({ setup: `A mall has ${p.S} shops, each paying ₹${fmt(p.R)} rent a month.`, claim: f => `So the shops pay ₹${f} lakh in rent for the year.`, ask: 'Rent for the year, in ₹ lakh' }),
        p => ({ setup: `A PG owner has ${p.S} rooms let at ₹${fmt(p.R)} a month each.`, claim: f => `So the rooms bring in ₹${f} lakh over the year.`, ask: 'Rent for the year, in ₹ lakh' }),
        p => ({ setup: `A bank pays ₹${fmt(p.R)} a month for each of its ${p.S} branches.`, claim: f => `So the branches cost ₹${f} lakh in rent for the year.`, ask: 'Rent for the year, in ₹ lakh' })
      ],
      working: p => [`${p.S} × ₹${fmt(p.R)} = ₹${fmt(p.S * p.R)} a month.`, `× 12 months = ₹${fmt(p.S * p.R * 12)} a year.`, `₹${fmt(p.S * p.R * 12)} ÷ 1,00,000 = ₹${fmt(p.S * p.R * 12 / 1e5, 4)} lakh.`],
      why: (p, c, w) => `${p.S} × ₹${fmt(p.R)} is ₹${fmt(w, 4)} lakh a month. The year is twelve of those, ₹${fmt(c, 4)} lakh. The figure given is the monthly total.`,
      okWhy: (p, c) => `Check: ₹${fmt(p.S * p.R)} a month times 12 is ₹${fmt(p.S * p.R * 12)} a year, which is ₹${fmt(c, 4)} lakh.`
    },
    points: {
      unit: '%', draw: r => { const [a, b] = pick(r, POINT_PAIRS); return { a, b }; },
      correct: p => round((p.b - p.a) / p.a * 100), wrong: p => p.b - p.a,
      ctxs: [
        p => ({ setup: `An online store’s conversion rate moves from ${p.a}% to ${p.b}%.`, claim: f => `So conversion has improved by ${f}%.`, ask: 'Improvement, in % of the starting rate' }),
        p => ({ setup: `The share of repeat customers at a café moves from ${p.a}% to ${p.b}%.`, claim: f => `So the share of repeat customers has improved by ${f}%.`, ask: 'Improvement, in % of the starting share' }),
        p => ({ setup: `The share of students using the library app moves from ${p.a}% to ${p.b}%.`, claim: f => `So use of the app has improved by ${f}%.`, ask: 'Improvement, in % of the starting share' })
      ],
      working: p => [`The gap is ${p.b} − ${p.a} = ${p.b - p.a} percentage point${p.b - p.a === 1 ? '' : 's'}.`, `Measured against the starting ${p.a}%: ${p.b - p.a} ÷ ${p.a} = ${fmt((p.b - p.a) / p.a * 100, 4)}%.`],
      why: (p, c, w) => `The rate moved ${w} percentage point${w === 1 ? '' : 's'} (${p.a}% to ${p.b}%), which is ${fmt(c, 4)}% of the starting ${p.a}%. The figure given is the gap in points, not the improvement in per cent.`,
      okWhy: (p, c) => `Check: ${p.b - p.a} points on a starting ${p.a}% is ${p.b - p.a} ÷ ${p.a} = ${fmt(c, 4)}%.`
    },
    base: {
      unit: '%', draw: r => { const [a, b] = pick(r, BASE_PAIRS); return { a, b }; },
      correct: p => round(Math.abs(p.b - p.a) / p.a * 100), wrong: p => round(Math.abs(p.b - p.a) / p.b * 100),
      ctxs: [
        p => ({ setup: `A backpack’s price moves from ₹${fmt(p.a)} to ₹${fmt(p.b)}.`, claim: f => `So the backpack’s price ${p.b > p.a ? 'rose' : 'fell'} by ${f}%.`, ask: `Percentage ${p.b > p.a ? 'rise' : 'fall'} in the price, in %` }),
        p => ({ setup: `A gym plan cost ₹${fmt(p.a)} a month last year and costs ₹${fmt(p.b)} this year.`, claim: f => `So the plan ${p.b > p.a ? 'rose' : 'fell'} in price by ${f}%.`, ask: `Percentage ${p.b > p.a ? 'rise' : 'fall'} in the price, in %` }),
        p => ({ setup: `A mess plate was ₹${fmt(p.a)} and is now ₹${fmt(p.b)}.`, claim: f => `So the plate’s price ${p.b > p.a ? 'rose' : 'fell'} by ${f}%.`, ask: `Percentage ${p.b > p.a ? 'rise' : 'fall'} in the price, in %` })
      ],
      working: p => [`The change is ₹${fmt(Math.abs(p.b - p.a))}.`, `Measured against the starting price: ${fmt(Math.abs(p.b - p.a))} ÷ ${fmt(p.a)} = ${fmt(Math.abs(p.b - p.a) / p.a * 100, 4)}%.`],
      why: (p, c, w) => `The change is ₹${fmt(Math.abs(p.b - p.a))} on a starting price of ₹${fmt(p.a)}, so ${fmt(Math.abs(p.b - p.a))} ÷ ${fmt(p.a)} = ${fmt(c, 4)}%. The figure given divides by the new price (₹${fmt(p.b)}) and gets ${fmt(w, 4)}%.`,
      okWhy: (p, c) => `Check: ₹${fmt(Math.abs(p.b - p.a))} is ${fmt(c, 4)}% of the starting ₹${fmt(p.a)}.`
    },
    average: {
      unit: '₹',
      draw: (r, ci) => {
        for (;;) {
          const k = pick(r, [100, 200, 250, 400, 500]), big = r() < 0.5, n1 = big ? 3 * k : k, n2 = big ? k : 3 * k, p1 = 10 * int(r, 3, 40), p2 = 10 * int(r, 3, 40), w = (n1 * p1 + n2 * p2) / (n1 + n2);
          if ((ci === 0 ? p1 > p2 : p2 > p1) && Number.isInteger(w) && Math.abs((p1 + p2) / 2 - w) > 0.05 * w) return { n1, p1, n2, p2 };
        }
      },
      correct: p => round((p.n1 * p.p1 + p.n2 * p.p2) / (p.n1 + p.n2)), wrong: p => round((p.p1 + p.p2) / 2),
      ctxs: [
        p => ({ setup: `A canteen sold ${fmt(p.n1)} thalis at ₹${p.p1} and ${fmt(p.n2)} snack boxes at ₹${p.p2}.`, claim: f => `So the average price per item sold was ₹${f}.`, ask: 'Average price per item, in ₹' }),
        p => ({ setup: `A bookshop sold ${fmt(p.n1)} notebooks at ₹${p.p1} and ${fmt(p.n2)} planners at ₹${p.p2}.`, claim: f => `So the average price per item was ₹${f}.`, ask: 'Average price per item, in ₹' }),
        p => ({ setup: `A cinema sold ${fmt(p.n1)} standard tickets at ₹${p.p1} and ${fmt(p.n2)} premium tickets at ₹${p.p2}.`, claim: f => `So the average ticket price was ₹${f}.`, ask: 'Average ticket price, in ₹' })
      ],
      working: p => [`Items sold: ${fmt(p.n1)} + ${fmt(p.n2)} = ${fmt(p.n1 + p.n2)}.`, `Takings: ${fmt(p.n1)} × ₹${p.p1} + ${fmt(p.n2)} × ₹${p.p2} = ₹${fmt(p.n1 * p.p1 + p.n2 * p.p2)}.`, `Average = ₹${fmt(p.n1 * p.p1 + p.n2 * p.p2)} ÷ ${fmt(p.n1 + p.n2)} = ₹${fmt((p.n1 * p.p1 + p.n2 * p.p2) / (p.n1 + p.n2))}.`],
      why: (p, c, w) => `Most sales (${fmt(Math.max(p.n1, p.n2))} of ${fmt(p.n1 + p.n2)}) were at ₹${p.n1 > p.n2 ? p.p1 : p.p2}, so the average is pulled that way: ₹${fmt(c)}, not the middle of the two prices (₹${fmt(w)}).`,
      okWhy: (p, c) => `Check: ${fmt(Math.max(p.n1, p.n2))} of the ${fmt(p.n1 + p.n2)} sales were at ₹${p.n1 > p.n2 ? p.p1 : p.p2}, so the average sits nearer that price, at ₹${fmt(c)}.`
    },
    profit: {
      unit: '₹', draw: r => { const [U, P, Cc] = pick(r, PROFIT_COMBOS); return { U, P, C: Cc }; },
      correct: (p, lakh) => round(p.U * (p.P - p.C) / (lakh ? 1e5 : 1)), wrong: (p, lakh) => round(p.U * p.P / (lakh ? 1e5 : 1)),
      ctxs: [
        p => ({ setup: `A stall sells ${fmt(p.U)} sandwiches at ₹${p.P} each. Each one costs ₹${p.C} to make.`, what: 'the profit' }),
        p => ({ setup: `A print shop sells ${fmt(p.U)} T-shirts at ₹${p.P} each. Each one costs ₹${p.C} to print.`, what: 'the profit' }),
        p => ({ setup: `A college fest sells ${fmt(p.U)} passes at ₹${p.P} each. Each pass costs ₹${p.C} to produce.`, what: 'the fest’s profit' })
      ],
      working: (p, lakh) => [`Profit on each: ₹${p.P} − ₹${p.C} = ₹${p.P - p.C}.`, `${fmt(p.U)} × ₹${p.P - p.C} = ₹${fmt(p.U * (p.P - p.C))}${lakh ? `, which is ₹${fmt(p.U * (p.P - p.C) / 1e5, 4)} lakh` : ''}.`],
      why: (p, c, w, lakh) => `${fmt(p.U)} × ₹${p.P} is the revenue, ₹${fmt(p.U * p.P)}. The costs of ₹${p.C} each come out: ${fmt(p.U)} × ₹${p.P - p.C} = ₹${fmt(p.U * (p.P - p.C))}${lakh ? ', or ' + inr(c) + ' lakh' : ''}. The figure given is the revenue.`,
      okWhy: (p, c) => `Check: each one leaves ₹${p.P - p.C}, and ${fmt(p.U)} of them leave ₹${fmt(p.U * (p.P - p.C))}.`
    },
    compound: {
      unit: '₹ lakh', draw: r => { for (;;) { const V = pick(r, [40, 80, 100, 120, 200, 240, 400, 500, 800]), d = pick(r, [20, 25, 50]); if (twoDp(V * (1 - d * d / 10000))) return { V, d }; } },
      correct: p => round(p.V * (1 - p.d / 100) * (1 + p.d / 100)), wrong: p => p.V,
      ctxs: [
        p => ({ setup: `A shop’s sales were ₹${p.V} lakh. They fell ${p.d}% in the rainy months, then rose ${p.d}% in the festive season.`, claim: f => `So sales are now ₹${f} lakh.`, ask: 'Sales now, in ₹ lakh' }),
        p => ({ setup: `A hostel canteen took ₹${p.V} lakh a term. Takings fell ${p.d}% the next term and then rose ${p.d}% the term after.`, claim: f => `So takings are now ₹${f} lakh.`, ask: 'Takings now, in ₹ lakh' }),
        p => ({ setup: `An app’s revenue was ₹${p.V} lakh a quarter. It dropped ${p.d}% and then climbed ${p.d}%.`, claim: f => `So revenue is back at ₹${f} lakh.`, ask: 'Revenue now, in ₹ lakh' })
      ],
      working: p => [`After the fall: ₹${p.V} lakh × ${fmt(1 - p.d / 100, 4)} = ₹${fmt(p.V * (1 - p.d / 100), 4)} lakh.`, `After the rise: ₹${fmt(p.V * (1 - p.d / 100), 4)} lakh × ${fmt(1 + p.d / 100, 4)} = ₹${fmt(p.V * (1 - p.d * p.d / 10000), 4)} lakh.`],
      why: (p, c) => `A ${p.d}% fall leaves ₹${fmt(p.V * (1 - p.d / 100), 4)} lakh, and ${p.d}% of that smaller figure is less than ${p.d}% of ₹${p.V} lakh. Sales end at ₹${fmt(c, 4)} lakh, not back at ₹${p.V} lakh.`,
      okWhy: (p, c) => `Check: ${fmt(1 - p.d / 100, 4)} × ${fmt(1 + p.d / 100, 4)} = ${fmt(1 - p.d * p.d / 10000, 4)}, so ₹${p.V} lakh becomes ₹${fmt(c, 4)} lakh, a little below where it began.`
    }
  };

  /* Generates one number-sense item. `slip` is a SLIPS id for a slipped item or null for a correct one; `scenario` names the
     family for a correct item (a random family when omitted). */
  function generateNumberSense(rand, { slip = null, scenario } = {}) {
    if (slip !== null && !FAMILIES[slip]) throw new Error('Unknown slip: ' + slip);
    const family = slip || scenario || pick(rand, SLIP_IDS), F = FAMILIES[family];
    if (!F || (slip && scenario && scenario !== slip)) throw new Error('Unknown scenario: ' + scenario);
    const ci = int(rand, 0, F.ctxs.length - 1), p = F.draw(rand, ci), lakh = family === 'profit' && p.U * (p.P - p.C) >= 1e5;
    const unit = family === 'profit' ? (lakh ? '₹ lakh' : '₹') : F.unit, correct = F.correct(p, lakh), wrong = slip ? F.wrong(p, lakh) : correct;
    let ctx = F.ctxs[ci](p);
    if (family === 'profit') ctx = { ...ctx, claim: f => `So ${ctx.what} is ₹${f}${lakh ? ' lakh' : ''}.`, ask: `${cap(ctx.what.replace(/^the /, ''))}, in ${unit}` };
    const others = shuffle(rand, SLIP_IDS.filter(s => s !== slip));
    const options = shuffle(rand, slip ? [slip, ...others.slice(0, 3)] : others.slice(0, 4));
    return { move: 'number-sense', scenario: family, id: family + '-' + short(ci, JSON.stringify(p), wrong), setup: ctx.setup, claim: ctx.claim(fmt(wrong, 4)),
      ask: ctx.ask, unit, shown: wrong, correct, ok: !slip, slip: slip || null, working: F.working(p, lakh),
      why: slip ? F.why(p, correct, wrong, lakh) : F.okWhy(p, correct), options };
  }

  /* Judges a Spot pick on a number-sense item: right or off, and which slip. */
  function judgeNumberSense(item, pick) {
    const verdict = pick && pick.verdict, caught = !item.ok && verdict === 'off';
    const ok = item.ok ? verdict === 'right' : caught && pick.slip === item.slip;
    const label = (SLIPS.find(s => s.id === item.slip) || {}).label;
    let why = item.why;
    if (item.ok && verdict === 'off') why = 'That figure is right. ' + item.why;
    else if (!item.ok && verdict === 'right') why = 'This figure is off. ' + item.why;
    else if (caught && !ok) why = `This figure is off, but not for that reason. It is a case of “${label}”. ` + item.why;
    return { ok, caught, why, slip: item.slip };
  }

  /* Checks a typed figure against the correct one, allowing 1% (or 0.01) either way. */
  function checkFigure(item, raw) {
    const value = parseAnswer(raw), valid = Number.isFinite(value);
    return { value, valid, ok: valid && Math.abs(value - item.correct) <= Math.max(0.01 * Math.abs(item.correct), 0.01) + 1e-9 };
  }

  /* ---------- Checks for the five authored moves ---------- */
  const norm_ = t => String(t || '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  /* Like hasWord, but a leading ₹ also counts as part of the word's left edge. */
  const hasTerm = (text, term) => new RegExp('(^|[^a-z0-9₹])' + escape(term.toLowerCase()) + '($|[^a-z0-9])').test(norm_(text).toLowerCase());
  const ok = (id, text) => ({ id, level: 'ok', text }), warn = (id, text) => ({ id, level: 'warn', text });
  const done = (t, checks) => ({ empty: false, words: wordCount(t), checks, pass: checks.every(c => c.level === 'ok') });

  /* ---------- Split it ---------- */
  const STOP = new Set('the and of for from to in on at by with per a an or its it their our your each every than that this these those who which what how much many more less is are be been as into out over under all any'.split(' '));
  function branchesOf(text) {
    let parts = String(text || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
    if (parts.length === 1) parts = parts[0].split(/\s*[;·•]\s*|,\s+(?=[A-Za-z])/).filter(Boolean);
    return parts.map(p => p.replace(/^(?:[-*•·–—]+|\(?\d+[.)]|\(?[a-z][.)])\s*/i, '').replace(/[.;,]+$/, '').trim()).filter(p => /[a-z0-9]/i.test(p));
  }
  const stem = w => w.length > 4 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 3 && w.endsWith('s') && !/ss$/.test(w) ? w.slice(0, -1) : w;
  const keysOf = b => new Set(norm_(b).toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter(w => w.length >= 3 && !STOP.has(w)).map(stem));
  const CATCH = /^(?:other|others|misc|miscellaneous|etc|the rest|rest|everything else|anything else|remaining)\b/i;
  const FIX = /^(?:increase|raise|reduce|cut|add|hire|launch|improve|offer|introduce|stop|start|build|buy|sell|switch to|bring in|set up)\b/i;
  function checkSplit(text) {
    const t = String(text || '').trim(); if (!t) return { empty: true, words: 0, checks: [], pass: false };
    const bs = branchesOf(t), n = bs.length, checks = [];
    checks.push(n >= 3 && n <= 4 ? ok('count', `${n} branches.`) : n < 3 ? warn('count', `Only ${n} ${n === 1 ? 'branch' : 'branches'}. Split it into three or four.`) : warn('count', `${n} branches is a list. Group them into three or four.`));
    const long = bs.find(b => wordCount(b) > 8);
    checks.push(long ? warn('short', `“${long.split(/\s+/).slice(0, 6).join(' ')}…” is a sentence. Name each branch in a few words.`) : ok('short', 'Each branch is a short name.'));
    let nest = null; const ks = bs.map(keysOf);
    for (let i = 0; i < n && !nest; i++) for (let j = 0; j < n && !nest; j++) if (i !== j && ks[i].size && [...ks[i]].every(k => ks[j].has(k)) && (ks[i].size < ks[j].size || i < j)) nest = [bs[i], bs[j]];
    checks.push(nest ? warn('nested', ks[bs.indexOf(nest[0])].size === ks[bs.indexOf(nest[1])].size ? `“${nest[0]}” and “${nest[1]}” say the same thing. Keep one.` : `“${nest[0]}” sits inside “${nest[1]}”. Keep the branches at one level.`) : ok('nested', 'No branch sits inside another.'));
    const other = bs.find(b => CATCH.test(b.trim()) || /\betc\.?$/i.test(b));
    checks.push(other ? warn('other', `“${other}” hides what you have not thought of yet. Name it.`) : ok('other', 'No catch-all branch.'));
    const fix = bs.find(b => FIX.test(b.trim()));
    checks.push(fix ? warn('fix', `“${fix}” is a fix, not a part of the problem. Split the problem first.`) : ok('fix', 'The branches are parts of the problem, not fixes.'));
    return done(t, checks);
  }

  /* ---------- Ask the one question ---------- */
  const QWORD = /^(?:what|which|who|whom|whose|when|where|why|how|is|are|was|were|do|does|did|has|have|had|can|could|will|would|shall|should|may)\b/i;
  const SOLUTION = /^(?:(?:should|shall) (?:we|they|the|it|our)\b|what about\b|how about\b|what if (?:we|they)\b|why (?:don't|not)\b|have (?:you|they) (?:considered|tried|thought)\b|would it (?:help|make sense|be better)\b|(?:can|could) (?:we|they) (?:raise|cut|increase|reduce|lower|launch|add|stop|start|offer|introduce|switch|move|hire|close|open|build|change)\b)/i;
  const REASON = /\b(?:because|since|if|whether|so (?:i|that|we|the|it)|which (?:tells|decides|shows|means)|that (?:tells|decides|shows|means)|tells? me|would (?:tell|decide|change|mean|point|show)|decides?|depends)\b/i;
  function checkQuestion(text) {
    const t = String(text || '').trim(); if (!t) return { empty: true, words: 0, checks: [], pass: false };
    const marks = (t.match(/\?/g) || []).length, parts = sentences(t), checks = [];
    const q = marks ? t.slice(0, t.indexOf('?') + 1).split(/(?<=[.!])\s+/).pop() : parts[0];
    const rest = marks ? t.slice(t.indexOf('?') + 1).trim() : parts.slice(1).join(' ');
    const isQ = marks === 1 || (marks === 0 && QWORD.test(q.trim()));
    checks.push(marks > 1 ? warn('one', `You asked ${marks} questions. Ask the one that matters most.`) : isQ ? ok('one', 'You asked one question.') : warn('one', 'Put it as a question.'));
    const a = CR.assess(q, []);
    checks.push(a.broad ? warn('broad', a.reason) : ok('broad', 'Your question names what you want to know.'));
    checks.push(SOLUTION.test(norm_(q).trim()) ? warn('solution', 'This proposes a fix. Ask for the fact that would decide between fixes.') : ok('solution', 'It asks for a fact, not a fix.'));
    checks.push(wordCount(rest) >= 6 && REASON.test(norm_(rest)) ? ok('reason', 'You said what the answer would decide.') : warn('reason', 'Add why you are asking: what would you do with the answer?'));
    const w = wordCount(t);
    checks.push(w <= 55 ? ok('length', `${w} words: about ${Math.max(5, Math.round(w / 2.5 / 5) * 5)} seconds to say.`) : warn('length', `${w} words. Cut it to a question and one sentence of reason.`));
    return done(t, checks);
  }

  /* ---------- Hold or change ---------- */
  const HOLD = /\b(?:i(?: would|'d| will|'ll)? still|still (?:recommend|think|say|stand|start|go|back|put|want)|stand by|stick (?:with|to)|(?:i would|i'd|i will|i'll) (?:stay|keep|stand)|i hold|nothing (?:here )?changes|my (?:answer|view|estimate|recommendation) (?:stays|holds|is the same))\b/i;
  const CHANGE = /\b(?:(?:that|this|it) changes|changes (?:my|the|it|what|where|how)|(?:i would|i'd|i will|i'll) (?:now|change|revise|switch|lower|raise|cut|drop|re-check|recheck)|in that case|i was wrong|i had the wrong|that (?:lowers|raises|brings)|i have not fixed)\b/i;
  const TONE = [[/\byou(?:'re| are) wrong\b/i, 'you are wrong'], [/\bthat(?:'s| is) (?:not true|wrong|incorrect)\b/i, 'that is not true'], [/\bobviously\b/i, 'obviously'], [/\bsorry\b/i, 'sorry']];
  const SUPPORT = /\b(?:because|since|given|so|which|as|the reason)\b/i;
  function checkHold(text) {
    const t = String(text || '').trim(); if (!t) return { empty: true, words: 0, checks: [], pass: false };
    const parts = sentences(t), first = norm_(parts[0]), checks = [];
    const call = HOLD.test(first) ? 'hold' : CHANGE.test(first) ? 'change' : null;
    checks.push(call ? ok('call', call === 'hold' ? 'Your first sentence says you are holding.' : 'Your first sentence says what changes.') : warn('call', 'Say first whether you are holding or changing your answer.'));
    const words = wordCount(t), firstWords = wordCount(parts[0]);
    checks.push(words - firstWords >= 8 || (SUPPORT.test(norm_(t)) && words >= 15) ? ok('reason', 'You gave the reason behind your call.') : warn('reason', 'Give the reason in one line: the fact your call rests on.'));
    checks.push(hasNumber(t) ? ok('number', 'You used a number.') : warn('number', 'No number found. Use the figure your call rests on.'));
    const hit = TONE.find(([re]) => re.test(norm_(t)));
    checks.push(!hit ? ok('tone', 'Calm: no apology and no “you are wrong”.') : hit[1] === 'sorry' ? warn('tone', '“Sorry” gives ground before you have said why. Change your answer for a fact, without apologising.') : warn('tone', `“${hit[1]}” turns it into a contest. Say your call and the fact behind it.`));
    checks.push(words <= 60 ? ok('length', `${words} words: about ${Math.max(5, Math.round(words / 2.5 / 5) * 5)} seconds.`) : warn('length', `${words} words runs past 25 seconds. Say the call and one reason.`));
    return done(t, checks);
  }

  /* ---------- Put a number on it ---------- */
  const MORE_OUTCOME = /\b(?:rose|risen|fell|fallen|dropped|went (?:up|down|from)|doubled|halved|tripled|came down|signed|presented|from [^.]{1,30}? to)\b/i;
  const VAGUE = ['significantly', 'significant', 'greatly', 'hugely', 'massively', 'drastically', 'considerably', 'substantially', 'tremendously', 'immensely', 'a lot', 'lots of', 'various', 'several', 'many', 'very', 'really', 'huge', 'key role'];
  function checkNumber(text) {
    const t = String(text || '').trim(); if (!t) return { empty: true, words: 0, checks: [], pass: false };
    const checks = [], p = pronouns(t), nums = (t.match(/\d[\d,]*(?:\.\d+)?/g) || []).length;
    checks.push(hasNumber(t) ? ok('number', 'You gave a number.') : warn('number', 'Add the measure: how many, or from what to what.'));
    checks.push(hasOutcome(t) || MORE_OUTCOME.test(norm_(t)) ? ok('outcome', 'You said what changed.') : warn('outcome', 'Say what changed as a result, not only what you did.'));
    checks.push(p.i === 0 ? warn('mine', 'Say what you did yourself, with “I”.') : p.we > p.i ? warn('mine', `More “we” (${p.we}) than “I” (${p.i}). Say which part was yours.`) : ok('mine', 'You said what you did yourself.'));
    const v = VAGUE.find(w => hasTerm(t, w));
    checks.push(v ? warn('vague', `“${v}” stands in for a number. Replace it with the number.`) : ok('vague', 'No vague words in place of numbers.'));
    checks.push(/\d\s?%|per ?cent/i.test(t) && nums < 2 ? warn('base', 'A percentage needs its base: from what, to what, or of how many?') : ok('base', 'Every figure has its base.'));
    const w = wordCount(t);
    checks.push(w <= 45 ? ok('length', `${w} words: one or two sentences.`) : warn('length', `${w} words. Keep it to one or two sentences.`));
    return done(t, checks);
  }

  /* ---------- Your next line ---------- */
  const FORWARD = /\?|\b(?:let's|let us|shall we|can we|could we|should we|i suggest|i propose|how about|what if|to sum up|back to)\b/i;
  const AGREE = /^(?:i (?:also )?agree|i also think|same (?:as|here)|exactly|true|correct|i second|yes)\b/i;
  function checkNextLine(text, item) {
    const t = String(text || '').trim(); if (!t) return { empty: true, words: 0, checks: [], pass: false };
    const checks = [], names = (item && item.names) || [], keys = (item && item.keywords) || [];
    const link = names.find(n => hasTerm(t, n) || hasTerm(t, n + "'s")) || keys.find(k => hasTerm(t, k));
    checks.push(link ? ok('link', 'You connected to what was said.') : warn('link', 'Connect to the group: use a name, or the point you are building on.'));
    checks.push(FORWARD.test(norm_(t)) || hasNumber(t) ? ok('forward', 'You gave the group something to do next.') : warn('forward', 'Move it on: end with a question, a proposal or a figure.'));
    checks.push(AGREE.test(norm_(t).replace(/^[^a-z]+/i, '')) ? warn('agree', 'You open by agreeing. Open with what you add.') : ok('agree', 'You open with your own point.'));
    const s = sentences(t).length, w = wordCount(t);
    checks.push(s <= 2 && w <= 45 ? ok('length', `${s === 1 ? 'One sentence' : 'Two sentences'}, ${w} words.`) : warn('length', s > 2 ? `${s} sentences. Say it in two.` : `${w} words is a speech. Say it in two short sentences.`));
    return done(t, checks);
  }

  /* Checks a text Do answer for any move that has one; number sense is typed as a figure, so it has no text check. */
  function checkDo(item, text) {
    switch (item && item.move) {
      case 'answer-first': return checkAnswerFirst(text);
      case 'so-what': return checkSoWhat(text, item);
      case 'split-it': return checkSplit(text);
      case 'one-question': return checkQuestion(text);
      case 'hold-or-change': return checkHold(text);
      case 'put-a-number': return checkNumber(text);
      case 'next-line': return checkNextLine(text, item);
      default: return null;
    }
  }

  /* ---------- Sets ---------- */
  /* The five authored moves: their banks, and the situation fields each rung shows. Spot items also carry their shuffled options;
     Do items carry weak, adequate and strong (and, for next-line, the keywords its checker needs). */
  const AUTHORED = {
    'split-it': { bank: SPLIT_IT, spot: x => ({ round: x.round, question: x.question, root: x.root, branches: x.branches.slice(), flaw: x.flaw }), do: x => ({ round: x.round, question: x.question }) },
    'one-question': { bank: ONE_QUESTION, spot: x => ({ round: x.round, brief: x.brief, known: x.known.slice() }), do: x => ({ round: x.round, brief: x.brief, known: x.known.slice() }) },
    'hold-or-change': { bank: HOLD_OR_CHANGE, spot: x => ({ round: x.round, said: x.said, push: x.push, call: x.call }), do: x => ({ round: x.round, said: x.said, push: x.push, call: x.call }) },
    'put-a-number': { bank: PUT_A_NUMBER, spot: x => ({ round: x.round, line: x.line, facts: x.facts.slice() }), do: x => ({ round: x.round, line: x.line, facts: x.facts.slice() }) },
    'next-line': { bank: NEXT_LINE, spot: x => ({ topic: x.topic, situation: x.situation, names: x.names.slice(), lines: x.lines.map(l => ({ ...l })), need: x.need }),
      do: x => ({ topic: x.topic, situation: x.situation, names: x.names.slice(), lines: x.lines.map(l => ({ ...l })), need: x.need, keywords: x.keywords.slice() }) }
  };
  /* Builds a set for an authored move: four Spot items then two Do items, six different items, unseen ones first. */
  function authoredSet(moveId, r, recent) {
    const { bank, spot, do: doShape } = AUTHORED[moveId];
    const unseen = shuffle(r, bank.filter(x => !recent.includes(x.id)));
    const seen = bank.filter(x => recent.includes(x.id)).sort((a, b) => recent.indexOf(b.id) - recent.indexOf(a.id));
    return unseen.concat(seen).slice(0, 6).map((x, i) => i < 4
      ? { rung: 'spot', move: moveId, id: x.id, ...spot(x), options: shuffle(r, x.options).map(o => ({ kind: o.kind, text: o.text, why: o.why, right: !!o.right })) }
      : { rung: 'do', move: moveId, id: x.id, ...doShape(x), weak: x.weak, adequate: x.adequate, strong: x.strong });
  }

  /* Calls `make` until it returns an item whose id is not already in the set or in `recent`, then records the id. */
  function fresh(make, used, recent) {
    let item;
    for (let i = 0; i < 25; i++) { item = make(); if (!used.has(item.id) && (!recent.includes(item.id) || i >= 12)) break; }
    used.add(item.id);
    return item;
  }
  function soWhatSet(r, recent) {
    const order = shuffle(r, SO_WHAT_PATTERNS), used = new Set();
    return Array.from({ length: 7 }, (_, i) => ({ rung: i < 5 ? 'spot' : 'do', ...fresh(() => generateSoWhat(r, order[i % 6]), used, recent) }));
  }
  function numberSenseSet(r, recent) {
    const used = new Set(), slipped = shuffle(r, SLIP_IDS).slice(0, 3), correct = shuffle(r, SLIP_IDS).slice(0, 3), doFam = shuffle(r, SLIP_IDS).slice(0, 2);
    const spot = shuffle(r, [...slipped.map(s => ({ slip: s })), ...correct.map(f => ({ slip: null, scenario: f }))])
      .map(o => ({ rung: 'spot', ...fresh(() => generateNumberSense(r, o), used, recent) }));
    const second = r() < 0.5;
    const dos = [{ slip: doFam[0] }, second ? { slip: doFam[1] } : { slip: null, scenario: doFam[1] }].map(o => ({ rung: 'do', ...fresh(() => generateNumberSense(r, o), used, recent) }));
    return spot.concat(dos);
  }

  /* Builds a five-minute set for a move: the Spot items first, then the Do items. */
  function buildSet(moveId, { seed = Date.now(), recent = [] } = {}) {
    const move = moveOf(moveId);
    if (!move) throw new Error('Unknown move: ' + moveId);
    if (move.kind === 'round') throw new Error(moveId + ' is a round: use buildTriage');
    const r = rng(seed), rec = Array.isArray(recent) ? recent : [];
    const items = AUTHORED[moveId] ? authoredSet(moveId, r, rec) : moveId === 'answer-first' ? answerFirstSet(r, rec) : moveId === 'so-what' ? soWhatSet(r, rec) : numberSenseSet(r, rec);
    return { move: moveId, seed, items };
  }

  /* Judges a Spot answer: for the choice moves `pick` is an option index, for number sense it is { verdict, slip }. */
  function judgeSpot(item, pick) {
    if (item.move === 'number-sense') return judgeNumberSense(item, pick);
    if (AUTHORED[item.move]) {
      const answer = item.options.findIndex(o => o.right), o = Number.isInteger(pick) ? item.options[pick] : null;
      return { ok: !!o && !!o.right, picked: o ? o.kind : null, answer, why: o ? o.why : '' };
    }
    if (item.move === 'answer-first') {
      const answer = item.options.findIndex(o => o.kind === 'answer'), o = Number.isInteger(pick) ? item.options[pick] : null;
      return { ok: !!o && o.kind === 'answer', picked: o ? o.kind : null, answer, why: o ? OPENINGS[o.kind].why : '' };
    }
    const answer = item.statements.findIndex(s => s.kind === 'insight'), s = Number.isInteger(pick) ? item.statements[pick] : null;
    return { ok: !!s && s.kind === 'insight', picked: s ? s.kind : null, answer, why: s ? s.why : '' };
  }

  /* ---------- Attempt, leave or guess: a round of eight aptitude questions ---------- */
  const TRIAGE_FIELDS = ['id', 'topic', 'level', 'prompt', 'options', 'answer', 'solution', 'shortcut'];
  /* Eight questions on eight different topics: three easy, three medium, two hard, in shuffled order. A topic that comes back
     with a chart, table or passage, or fails to generate, is passed over for the next one. */
  function buildTriage({ seed = Date.now() } = {}) {
    const r = rng(seed), levels = shuffle(r, LEVEL_MIX), pool = shuffle(r, TRIAGE_TOPICS), used = new Set(), questions = [];
    for (const level of levels) {
      let found = null;
      for (const topic of pool) {
        if (used.has(topic)) continue;
        let q = null;
        try { q = A.generate(topic, level, r); } catch { q = null; }
        if (!q || q.chart || q.table || q.passage || !Array.isArray(q.options) || q.options.length !== 4) continue;
        found = { id: q.id, topic, level, prompt: q.prompt, options: q.options.slice(), answer: q.answer, solution: (q.solution || []).slice(), shortcut: q.shortcut || A.topicOf(topic).tip };
        break;
      }
      if (!found) throw new Error('triage: no question found for ' + level);
      used.add(found.topic); questions.push(found);
    }
    return { move: 'triage', seed, questions };
  }
  /* The order of the sitting: every Do now in the order sorted, then every Later, then every Leave. */
  function triageOrder(calls) {
    const list = Array.isArray(calls) ? calls : [];
    return ['now', 'later', 'leave'].flatMap(c => list.map((x, i) => x === c ? i : -1).filter(i => i >= 0));
  }
  /* Seconds under a minute as "34 seconds", from a minute up as m:ss. */
  function span(n) {
    const s = Math.max(0, Math.round(n));
    return s < 60 ? `${s} ${s === 1 ? 'second' : 'seconds'}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  /* Was one sorting call a good one? Judged only by what the learner then did, never by a difficulty label. */
  function triageVerdict(call, outcome) {
    const o = outcome || {}, t = span(o.seconds || 0), s = Math.round(o.seconds || 0);
    if (o.state === 'unreached') return { verdict: null, line: 'Not reached.' };
    if (call === 'now') {
      if (o.state === 'right') return s <= TRIAGE.quick ? { verdict: 'good', line: `Right in ${t}. A good call.` } : { verdict: 'miss', line: `Right, but it took ${t}. That was a Later.` };
      if (o.state === 'wrong') return { verdict: 'miss', line: `Wrong after ${t}. Not a quick mark for you yet.` };
      return { verdict: 'miss', line: 'You called it Do now, then skipped it.' };
    }
    if (o.state === 'right') return s <= TRIAGE.fast ? { verdict: 'miss', line: `Right in ${t}. A quick mark you put off.` } : { verdict: 'good', line: `Right, and it took ${t}. Worth putting off.` };
    if (o.state === 'wrong') return { verdict: 'good', line: `Wrong after ${t}. You were right to put it off.` };
    return { verdict: null, line: 'Skipped.' };
  }
  const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];
  const marksText = n => (n < 0 ? '−' : '') + String(Math.abs(n));
  /* Everything the debrief shows, from a finished round: marks, rows in sitting order, piles, guesses, pass, takeaway and the history entries. */
  function triageDebrief(run, now = Date.now()) {
    const qs = run.questions, n = qs.length, calls = run.calls, order = Array.isArray(run.order) && run.order.length === n ? run.order : triageOrder(calls);
    const rows = order.map(i => {
      const a = (run.answers || [])[i] || null, state = a ? a.state : 'unreached', seconds = a ? Math.round(a.seconds || 0) : 0, answered = state === 'right' || state === 'wrong';
      const v = triageVerdict(calls[i], { state, seconds });
      return { index: i, call: calls[i], late: !!(run.late || [])[i], state, seconds, guess: answered && !!a.guess, verdict: v.verdict, line: v.line };
    });
    const count = s => rows.filter(x => x.state === s).length, right = count('right'), wrong = count('wrong');
    const marks = right * TRIAGE.right + wrong * TRIAGE.wrong;
    const piles = {};
    for (const c of CALL_IDS) {
      const mine = rows.filter(x => x.call === c), ans = mine.filter(x => x.state === 'right' || x.state === 'wrong');
      piles[c] = { count: mine.length, answered: ans.length, marks: ans.reduce((t, x) => t + (x.state === 'right' ? TRIAGE.right : TRIAGE.wrong), 0), seconds: mine.filter(x => x.state !== 'unreached').reduce((t, x) => t + x.seconds, 0) };
    }
    const g = rows.filter(x => x.guess), guesses = { count: g.length, right: g.filter(x => x.state === 'right').length, marks: g.reduce((t, x) => t + (x.state === 'right' ? TRIAGE.right : TRIAGE.wrong), 0) };
    const judged = rows.filter(x => x.call === 'now' && x.verdict), goodNow = judged.filter(x => x.verdict === 'good').length;
    const pass = judged.length >= 2 && goodNow / judged.length >= 0.75 && wrong <= 1;
    const nowMisses = rows.filter(x => x.call === 'now' && x.verdict === 'miss'), byTopic = {};
    for (const x of nowMisses) byTopic[qs[x.index].topic] = (byTopic[qs[x.index].topic] || 0) + 1;
    const worst = Object.entries(byTopic).sort((a, b) => b[1] - a[1])[0], quickPutOff = rows.filter(x => x.call !== 'now' && x.verdict === 'miss').length;
    let takeaway;
    if (worst && worst[1] >= 2) takeaway = `${WORDS[worst[1]] || worst[1]} of your Do now calls that went wrong were ${A.topicOf(worst[0]).title}. Call that type Later until it is quicker.`;
    else if (quickPutOff >= 1) takeaway = `You put off ${quickPutOff} ${quickPutOff === 1 ? 'question' : 'questions'} that you then answered within ${TRIAGE.fast} seconds. If you recognise the type, take it in the first pass.`;
    else if (wrong >= 2) { const cost = wrong * -TRIAGE.wrong; takeaway = `Wrong answers cost you ${cost} ${cost === 1 ? 'mark' : 'marks'}. If you cannot rule an option out, move on.`; }
    else if (!judged.length) takeaway = 'None of your Do now calls was tested. Call more questions Do now, and answer those first.';
    else takeaway = 'Your sorting matched what happened. Keep the same rhythm in a full timed test.';
    const total = rows.reduce((t, x) => t + x.seconds, 0);
    const entries = rows.filter(x => x.verdict).map(x => record({ move: 'triage', rung: 'spot', id: qs[x.index].id }, { ok: x.verdict === 'good', pick: x.call, seconds: x.seconds, at: now }));
    entries.push(record({ move: 'triage', rung: 'do', id: 'round-' + run.seed }, { ok: pass, seconds: total, at: now }));
    return { marks, right, wrong, skipped: count('skipped'), unreached: count('unreached'), late: (run.late || []).filter(Boolean).length, rows, piles, guesses, pass, takeaway, entries };
  }
  /* True for a saved round that can be resumed: well-formed questions, and a phase, calls, order, answers and clock that agree. */
  function validTriageRun(run) {
    const isStr = v => typeof v === 'string', num = v => typeof v === 'number' && Number.isFinite(v);
    if (!run || typeof run !== 'object' || run.move !== 'triage' || !num(run.seed) || !Array.isArray(run.questions) || run.questions.length !== TRIAGE.questions) return false;
    const n = run.questions.length;
    const okQ = q => !!q && typeof q === 'object' && isStr(q.id) && !!q.id && q.id.length <= 60 && TRIAGE_TOPICS.includes(q.topic) && ['easy', 'medium', 'hard'].includes(q.level) && isStr(q.prompt) && !!q.prompt
      && Array.isArray(q.options) && q.options.length === 4 && q.options.every(isStr) && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4
      && Array.isArray(q.solution) && q.solution.every(isStr) && isStr(q.shortcut);
    if (!run.questions.every(okQ) || !['sort', 'sit'].includes(run.phase)) return false;
    if (!Array.isArray(run.calls) || !run.calls.every(c => CALL_IDS.includes(c)) || !Array.isArray(run.late) || run.late.length !== run.calls.length || !run.late.every(x => typeof x === 'boolean')) return false;
    if (!Array.isArray(run.answers) || run.answers.length !== n || !Array.isArray(run.order) || !Number.isInteger(run.index) || !Number.isInteger(run.at) || !num(run.used) || run.used < 0) return false;
    if (!run.answers.every(a => a === null || (!!a && typeof a === 'object' && ['right', 'wrong', 'skipped'].includes(a.state) && (a.pick === null || (Number.isInteger(a.pick) && a.pick >= 0 && a.pick < 4)) && typeof a.guess === 'boolean' && num(a.seconds) && a.seconds >= 0))) return false;
    if (run.phase === 'sort') return run.at === run.calls.length && run.at <= n && run.order.length === 0 && run.index === 0 && run.answers.every(a => a === null) && run.used < TRIAGE.sortSeconds;
    const order = triageOrder(run.calls);
    return run.calls.length === n && run.at === n && run.order.length === n && run.order.every((x, k) => x === order[k]) && run.index >= 0 && run.index < n && run.used < TRIAGE.sitSeconds
      && run.order.every((qi, k) => (k < run.index) === (run.answers[qi] !== null));
  }

  /* ---------- History and readiness ---------- */
  /* Builds one history entry from a finished item and what happened on it. */
  function record(item, outcome = {}) {
    const e = { move: item.move, rung: item.rung, id: item.id, ok: !!outcome.ok, seconds: Number.isFinite(outcome.seconds) ? outcome.seconds : null, at: Number.isFinite(outcome.at) ? outcome.at : Date.now() };
    if (typeof outcome.pick === 'string') e.pick = outcome.pick;
    if (['weak', 'adequate', 'strong'].includes(outcome.grade)) e.grade = outcome.grade;
    return e;
  }
  /* Keeps only well-formed entries, in order, and at most the most recent 600. */
  function cleanHistory(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const e of list) {
      if (!e || typeof e !== 'object' || !MOVE_IDS.includes(e.move) || !['spot', 'do'].includes(e.rung) || typeof e.id !== 'string' || !e.id || e.id.length > 80 || typeof e.ok !== 'boolean') continue;
      if (!Number.isFinite(e.at) || !(e.seconds == null || (Number.isFinite(e.seconds) && e.seconds >= 0))) continue;
      if (e.pick !== undefined && (typeof e.pick !== 'string' || e.pick.length > 40)) continue;
      if (e.grade !== undefined && !['weak', 'adequate', 'strong'].includes(e.grade)) continue;
      const c = { move: e.move, rung: e.rung, id: e.id, ok: e.ok, seconds: e.seconds == null ? null : e.seconds, at: e.at };
      if (e.pick !== undefined) c.pick = e.pick;
      if (e.grade !== undefined) c.grade = e.grade;
      out.push(c);
    }
    return out.slice(-HISTORY_MAX);
  }
  /* True for a saved set that can be resumed: a set move, a numeric seed, real items and a sane position. */
  function validRun(run) {
    return !!run && typeof run === 'object' && SET_MOVE_IDS.includes(run.move) && Number.isFinite(run.seed) && Array.isArray(run.items) && run.items.length > 0
      && run.items.every(i => !!i && typeof i === 'object' && (i.rung === 'spot' || i.rung === 'do') && typeof i.id === 'string' && i.move === run.move)
      && Number.isInteger(run.index) && run.index >= 0 && run.index <= run.items.length && Array.isArray(run.results) && run.results.length <= run.items.length;
  }
  /* The ids of the most recent distinct items played for a move, newest first. */
  function recentIds(history, moveId, n = 12) {
    const ids = [];
    for (let i = (history || []).length - 1; i >= 0 && ids.length < n; i--) { const e = history[i]; if (e && e.move === moveId && !ids.includes(e.id)) ids.push(e.id); }
    return ids;
  }
  /* Readiness for one move: the last 10 Spot reps and the last 3 Do reps. */
  function status(history, moveId) {
    const mine = (Array.isArray(history) ? history : []).filter(e => e && e.move === moveId);
    const spot = mine.filter(e => e.rung === 'spot').slice(-10), dos = mine.filter(e => e.rung === 'do').slice(-3);
    const s = { of: spot.length, correct: spot.filter(e => e.ok).length }, d = { of: dos.length, passed: dos.filter(e => e.ok).length };
    const ready = s.of === 10 && s.correct >= 8 && d.of === 3 && d.passed === 3;
    return { move: moveId, attempts: mine.length, spot: s, do: d, ready, state: !mine.length ? 'new' : ready ? 'ready' : 'training' };
  }
  /* Status for every move, in MOVE_IDS order. */
  const summarise = history => MOVE_IDS.map(id => status(history, id));

  const api = { MOVE_IDS, SET_MOVE_IDS, SO_WHAT_PATTERNS, moveOf, buildSet, generateSoWhat, generateNumberSense, judgeSpot, checkAnswerFirst, checkSoWhat, checkFigure,
    checkSplit, checkQuestion, checkHold, checkNumber, checkNextLine, branchesOf, checkDo,
    record, cleanHistory, validRun, recentIds, status, summarise, buildTriage, triageOrder, triageVerdict, triageDebrief, validTriageRun };
  if (node) module.exports = api; else root.MovesLogic = api;
})(this);
