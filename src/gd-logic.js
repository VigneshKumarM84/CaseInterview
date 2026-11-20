/* Group discussion kit: the rules, with no DOM, so Node tests load this file directly.
   A session is one run of a brief: who took part, the log of what an observer tapped, the phase and its clock.
   Everything here is counted from what the observer tapped. Nothing hears the discussion.
   cleanSession() is the only way stored data becomes a session: it checks every field and returns null for anything
   that is not one. Depends on content/gd.js (MOVES, TIMINGS, GROUP, BRIEFS). */
(function (root) {
  'use strict';
  const C = typeof module !== 'undefined' && module.exports ? require('../content/gd.js') : root.GD_CONTENT;
  const { MOVES, TIMINGS, GROUP, BRIEFS } = C;
  const LIMITS = { name: 30, note: 200, text: 500, log: 400, maxT: 6 * 3600 };
  const PHASES = ['prepare', 'discuss', 'summary', 'debrief'];
  const GOOD = MOVES.filter(m => m.kind === 'good'), WATCH = MOVES.filter(m => m.kind === 'watch');
  const moveOf = id => MOVES.find(m => m.id === id) || null;
  const briefOf = id => BRIEFS.find(b => b.id === id) || null;

  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const clock = n => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  const lower = s => s.toLowerCase();
  const newId = () => 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------- Set-up ---------- */
  /* Checks what was typed on the set-up screen. `names` is everyone present (blank rows are ignored); with an
     observer, `observerAt` is the index in `names` of the one observing, and the rest become the speakers.
     Returns { ok, error, names (the speakers), observerName }. */
  function checkSetup(names, { observer = false, observerAt = null } = {}) {
    const fail = error => ({ ok: false, error, names: [], observerName: '' });
    const rows = (Array.isArray(names) ? names : []).map((n, i) => ({ i, name: typeof n === 'string' ? n.replace(/\s+/g, ' ').trim() : '' })).filter(r => r.name);
    if (rows.length > GROUP.max) return fail(`Six names at most. Remove ${rows.length - GROUP.max}.`);
    if (rows.some(r => r.name.length > LIMITS.name)) return fail(`Keep each name to ${LIMITS.name} characters.`);
    const seen = new Set();
    for (const r of rows) { if (seen.has(lower(r.name))) return fail(`Two names are the same: ${r.name}. Add an initial so you can tell them apart.`); seen.add(lower(r.name)); }
    if (!observer) {
      if (rows.length < GROUP.min) return fail(`Add at least ${GROUP.min} names. A discussion needs ${GROUP.min} to ${GROUP.max} people.`);
      return { ok: true, error: '', names: rows.map(r => r.name), observerName: '' };
    }
    const who = rows.find(r => r.i === observerAt);
    if (!who) return fail('Choose who is observing, and give them a name.');
    const speakers = rows.filter(r => r !== who).map(r => r.name);
    if (speakers.length < GROUP.min) return fail(`With an observer you need at least ${GROUP.min + 1} names: ${GROUP.min} to speak and one to observe.`);
    return { ok: true, error: '', names: speakers, observerName: who.name };
  }

  /* ---------- Reading a stored session ---------- */
  const text = (v, max) => typeof v === 'string' ? v.replace(/\s+$/, '').slice(0, max) : '';
  function cleanNames(v) {
    if (!Array.isArray(v) || v.length < GROUP.min || v.length > GROUP.max) return null;
    const out = [];
    for (const n of v) {
      if (typeof n !== 'string') return null;
      const t = n.trim();
      if (!t || t.length > LIMITS.name || out.some(x => lower(x) === lower(t))) return null;
      out.push(t);
    }
    return out;
  }
  function cleanLog(v, n, observer) {
    if (!observer || !Array.isArray(v)) return [];
    const out = [];
    for (const e of v) {
      if (out.length >= LIMITS.log) break;
      if (!isObj(e) || !Number.isFinite(e.t) || e.t < 0 || e.t > LIMITS.maxT || !Number.isInteger(e.who) || e.who < 0 || e.who >= n || !moveOf(e.move)) continue;
      out.push({ t: Math.round(e.t), who: e.who, move: e.move, note: text(e.note, LIMITS.note).trim() });
    }
    return out;
  }
  function cleanWords(v, n) {
    const out = {};
    if (!isObj(v)) return out;
    for (const [k, t] of Object.entries(v)) {
      const i = Number(k), s = text(t, LIMITS.text);
      if (/^\d{1,2}$/.test(k) && i < n && s.trim()) out[i] = s;
    }
    return out;
  }
  /* A session read back from storage, or null. `now` fills a missing start time; it is passed so tests need no clock. */
  function cleanSession(v, now = Date.now()) {
    if (!isObj(v) || !briefOf(v.briefId) || !PHASES.includes(v.phase) || !TIMINGS.discuss.includes(v.discussSeconds) || typeof v.observer !== 'boolean') return null;
    const names = cleanNames(v.names); if (!names) return null;
    const timed = v.phase !== 'debrief';
    const phaseStarted = Number.isFinite(v.phaseStarted) && v.phaseStarted >= 0 ? v.phaseStarted : null;
    if (timed && phaseStarted == null) return null;
    const ended = Number.isFinite(v.discussEnded) && v.discussEnded >= 0 ? Math.min(Math.round(v.discussEnded), v.discussSeconds) : null;
    return {
      id: typeof v.id === 'string' && /^[\w-]{1,30}$/.test(v.id) ? v.id : newId(), briefId: v.briefId, names, observer: v.observer,
      observerName: v.observer ? text(v.observerName, LIMITS.name).trim() : '', discussSeconds: v.discussSeconds, phase: v.phase, phaseStarted: timed ? phaseStarted : null,
      discussEnded: v.phase === 'prepare' || v.phase === 'discuss' ? null : (ended == null ? v.discussSeconds : ended),
      log: cleanLog(v.log, names.length, v.observer), summariser: Number.isInteger(v.summariser) && v.summariser >= 0 && v.summariser < names.length ? v.summariser : null,
      keep: cleanWords(v.keep, names.length), change: cleanWords(v.change, names.length),
      started: Number.isFinite(v.started) ? v.started : now, finished: Number.isFinite(v.finished) ? v.finished : null
    };
  }
  function newSession({ briefId, names, observer = false, observerName = '', discussSeconds = TIMINGS.defaultDiscuss, now = Date.now(), id } = {}) {
    return cleanSession({ id: id || newId(), briefId, names, observer: !!observer, observerName, discussSeconds, phase: 'prepare', phaseStarted: now, discussEnded: null, log: [], summariser: null, keep: {}, change: {}, started: now, finished: null }, now);
  }

  /* ---------- The clock ---------- */
  const phaseLength = s => s.phase === 'prepare' ? TIMINGS.prepare : s.phase === 'discuss' ? s.discussSeconds : s.phase === 'summary' ? TIMINGS.summary : 0;
  const elapsed = (s, now) => s.phaseStarted == null ? 0 : Math.max(0, (now - s.phaseStarted) / 1000);
  /* Seconds left in the current timed phase: never negative, and counted up to the next whole second. */
  function remaining(s, now) { return s.phase === 'debrief' || !s.phase ? 0 : Math.max(0, Math.ceil(phaseLength(s) - elapsed(s, now))); }
  /* Which signals have passed. Before the discussion none have; after it all have. */
  function signals(s, now) {
    if (s.phase === 'prepare') return { halfway: false, oneMinute: false, timeUp: false };
    if (s.phase !== 'discuss') return { halfway: true, oneMinute: true, timeUp: true };
    const e = elapsed(s, now), left = s.discussSeconds - e;
    return { halfway: e >= s.discussSeconds / 2, oneMinute: left <= 60, timeUp: left <= 0 };
  }
  /* Moves a session on when a timed phase has run out, using the time the phase should have ended, so a page that was
     closed for ten minutes comes back with the clock still honest. Returns { session, lapsed }, where lapsed means the
     discussion ran out and the session is now at the summary. The summary does not end by itself. */
  function advance(s, now) {
    let cur = s, lapsed = false;
    if (cur.phase === 'prepare' && now - cur.phaseStarted >= TIMINGS.prepare * 1000) cur = { ...cur, phase: 'discuss', phaseStarted: cur.phaseStarted + TIMINGS.prepare * 1000 };
    if (cur.phase === 'discuss' && now - cur.phaseStarted >= cur.discussSeconds * 1000) { cur = { ...cur, phase: 'summary', phaseStarted: cur.phaseStarted + cur.discussSeconds * 1000, discussEnded: cur.discussSeconds }; lapsed = true; }
    return { session: cur, lapsed };
  }
  /* Seconds into the discussion for a tap made now. A tap in the summary counts on from where the discussion stopped. */
  function timeOf(s, now) {
    if (s.phase === 'discuss') return Math.min(s.discussSeconds, Math.round(elapsed(s, now)));
    if (s.phase === 'summary') return (s.discussEnded == null ? s.discussSeconds : s.discussEnded) + Math.round(elapsed(s, now));
    return 0;
  }

  /* ---------- The log ---------- */
  /* Adds a tap to the session's log and returns the entry, or null when it cannot be logged. */
  function logMove(s, who, move, t) {
    if (!s.observer || s.log.length >= LIMITS.log || !Number.isInteger(who) || who < 0 || who >= s.names.length || !moveOf(move) || !Number.isFinite(t) || t < 0) return null;
    const e = { t: Math.round(t), who, move, note: '' }; s.log.push(e); return e;
  }
  /* Removes the last tap and returns it, or null. */
  const undoMove = s => s.log.length ? s.log.pop() : null;
  /* Attaches a short note to the last tap; a blank note clears it. Returns false when there is no tap to attach it to. */
  function noteLast(s, note) { const e = s.log[s.log.length - 1]; if (!e) return false; e.note = text(note, LIMITS.note).trim(); return true; }

  /* ---------- Counting ---------- */
  /* One row per participant: the count of each move, the totals of good and watch moves, and the first and last time logged. */
  function tally(s) {
    return s.names.map((name, who) => {
      const counts = Object.fromEntries(MOVES.map(m => [m.id, 0]));
      let first = null, last = null;
      for (const e of s.log) {
        if (e.who !== who) continue;
        counts[e.move]++; first = first == null ? e.t : Math.min(first, e.t); last = last == null ? e.t : Math.max(last, e.t);
      }
      return { name, who, counts, good: GOOD.reduce((n, m) => n + counts[m.id], 0), watch: WATCH.reduce((n, m) => n + counts[m.id], 0), first, last };
    });
  }
  /* Who has said least: the fewest good moves; then the one logged longest ago, or never; then name order. */
  function quietest(s) {
    const rows = tally(s);
    const order = (a, b) => a.good - b.good || (a.last == null ? -1 : a.last) - (b.last == null ? -1 : b.last) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.who - b.who;
    return rows.slice().sort(order)[0].who;
  }

  /* ---------- Feedback, built only from what was logged ---------- */
  function feedbackFor(s, who) {
    if (!Number.isInteger(who) || who < 0 || who >= s.names.length) return [];
    const mine = s.log.filter(e => e.who === who), t = tally(s)[who], lines = [];
    if (!mine.length) lines.push('Nothing was noted for you. That can mean you did not speak, or that the observer missed it.');
    else {
      for (const m of MOVES) if (t.counts[m.id]) lines.push(`${m.label}: ${t.counts[m.id]}`);
      for (const e of mine.filter(e => e.note).sort((a, b) => a.t - b.t).slice(0, 3)) lines.push(`${clock(e.t)} ${moveOf(e.move).label}: “${e.note}”`);
      const unseen = GOOD.filter(m => !t.counts[m.id] && !(m.id === 'summarise' && s.summariser === who));
      if (unseen.length) lines.push(`Not seen: ${unseen.map(m => m.label).join(', ')}. This means the observer did not note them, not that you did not do them.`);
    }
    if (s.keep[who]) lines.push(`One thing to keep: ${s.keep[who]}`);
    if (s.change[who]) lines.push(`One thing to change: ${s.change[who]}`);
    if (s.summariser === who) lines.push('You gave the one-minute summary.');
    return lines;
  }

  /* Observations about the whole group, each with the count it rests on. Empty when the log is too thin to say anything. */
  const MIN_LOG = 5;
  function groupNotes(s) {
    const n = s.log.length; if (n < MIN_LOG) return [];
    const count = id => s.log.filter(e => e.move === id).length, out = [], of = `of ${n} logged moves`;
    if (!count('summarise')) out.push(`Nobody was noted summarising (0 ${of}).`);
    const rows = tally(s).map(r => ({ name: r.name, n: r.good + r.watch })).sort((a, b) => b.n - a.n);
    if (rows[0].n * 2 > n) out.push(`${rows[0].name} has ${rows[0].n} ${of}, more than half.`);
    if (!count('invite')) out.push(`Nobody was noted bringing someone else in (0 ${of}).`);
    if (!count('evidence')) out.push(`Nobody was noted using evidence from the brief (0 ${of}).`);
    if (count('interrupt') >= 3) out.push(`Cutting someone off was noted ${count('interrupt')} times (${count('interrupt')} ${of}).`);
    return out;
  }

  /* ---------- Plain-text downloads ---------- */
  const rule = '='.repeat(60);
  const MOVE_NOTE = 'These are counts of what the observer tapped. They are not a judgement. The observer can miss things, and the app does not hear the discussion.';
  function speakerText(s, who) {
    const b = briefOf(s.briefId); if (!b || !Number.isInteger(who) || who < 0 || who >= s.names.length) return '';
    return `CASE ROOM: GROUP DISCUSSION, FEEDBACK FOR ${s.names[who].toUpperCase()}\n${b.title}\n${MOVE_NOTE}\n\n${feedbackFor(s, who).join('\n')}\n`;
  }
  function reportText(s) {
    const b = briefOf(s.briefId); if (!b) return '';
    const rows = tally(s), head = s.observer ? `Observer: ${s.observerName || 'not named'}` : 'No observer: nothing was noted.';
    const table = s.observer ? rows.map(r => `${r.name}: ${MOVES.filter(m => r.counts[m.id]).map(m => `${m.label} ${r.counts[m.id]}`).join(', ') || 'nothing noted'}`).join('\n') : '';
    const notes = groupNotes(s);
    return [`CASE ROOM: GROUP DISCUSSION\n${b.title} (${b.setting})\n${new Date(s.finished == null ? s.started : s.finished).toLocaleString()} · ${Math.round(s.discussSeconds / 60)} minutes · ${s.names.join(', ')}\n${head}\n${MOVE_NOTE}`,
      s.observer ? `GROUP NOTES\n${notes.length ? notes.map(x => `- ${x}`).join('\n') : 'Too little was logged to say anything about the group.'}` : '',
      s.observer ? `COUNTS BY SPEAKER\n${table}` : '',
      ...(s.observer ? s.names.map((n, i) => `FEEDBACK FOR ${n.toUpperCase()}\n${feedbackFor(s, i).join('\n')}`) : []),
      `WHAT A BALANCED CONCLUSION WEIGHS\n${b.balanced.map(x => `- ${x}`).join('\n')}`, `WHERE THE EVIDENCE PULLS APART\n${b.tensions.map(x => `- ${x}`).join('\n')}`, `COMMON TRAPS\n${b.traps.map(x => `- ${x}`).join('\n')}`
    ].filter(Boolean).join(`\n\n${rule}\n\n`) + '\n';
  }

  const api = { MOVES, TIMINGS, GROUP, LIMITS, PHASES, MIN_LOG, moveOf, briefOf, checkSetup, cleanSession, newSession, phaseLength, remaining, signals, advance, timeOf, logMove, undoMove, noteLast, tally, quietest, feedbackFor, groupNotes, speakerText, reportText, clock };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GDLogic = api;
})(this);
