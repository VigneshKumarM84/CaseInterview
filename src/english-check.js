/* Case Room spoken English practice: scoring, with no DOM access so Node tests load it directly.
   What is scored is the transcript the browser's speech recognition produced. That depends on the microphone, the
   accent model and background noise, so results describe what the browser heard, not pronunciation as a person
   would judge it. Content comes from content/english.js; the one-minute talk reuses BehaviouralContent's checks. */
(function (root) {
  'use strict';
  const bank = () => (root && root.ENGLISH_PRACTICE) || (typeof require === 'function' ? require('../content/english.js') : { READ: [], REPEAT: [], QUICK: [], JAM: [] });
  const talk = () => (root && root.BehaviouralContent) || require('./behavioural-content.js');

  const TYPES = [
    { id: 'read', title: 'Read aloud', short: 'Read a sentence on screen clearly and at a steady pace.', count: 5, needsMic: true },
    { id: 'repeat', title: 'Repeat the sentence', short: 'Hear a sentence once or twice, then say it back exactly.', count: 5, needsMic: false },
    { id: 'quick', title: 'Quick answers', short: 'Answer a short spoken question in a word or two.', count: 6, needsMic: false },
    { id: 'jam', title: 'Just a minute', short: 'Fifteen seconds to think, then speak on a topic for one minute.', count: 1, needsMic: false }
  ];
  const FULL = [['read', 3], ['repeat', 3], ['quick', 4], ['jam', 1]];
  const typeOf = id => TYPES.find(t => t.id === id);
  const itemsOf = type => ({ read: bank().READ, repeat: bank().REPEAT, quick: bank().QUICK, jam: bank().JAM })[type] || [];
  const findItem = (type, id) => itemsOf(type).find(x => x.id === id) || null;

  /* ---------- Normalising words so the same sentence matches however the browser wrote it ---------- */
  const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  const TENS = { 2: 'twenty', 3: 'thirty', 4: 'forty', 5: 'fifty', 6: 'sixty', 7: 'seventy', 8: 'eighty', 9: 'ninety' };
  const numberWords = n => n <= 20 ? [NUMBERS[n]] : n < 100 ? [TENS[Math.floor(n / 10)], ...(n % 10 ? [NUMBERS[n % 10]] : [])] : [String(n)];
  const WHOLE = { "can't": 'can not', cannot: 'can not', "won't": 'will not', "shan't": 'shall not', "let's": 'let us', "it's": 'it is', "that's": 'that is', "there's": 'there is', "what's": 'what is', "he's": 'he is', "she's": 'she is', "here's": 'here is', "who's": 'who is' };
  const SPELL = { practise: 'practice', practised: 'practiced', programme: 'program', programmes: 'programs', aeroplane: 'airplane', aeroplanes: 'airplanes', okay: 'ok', percent: 'per cent', towards: 'toward' };
  /* British and American spellings share one key: -our → -or, -tre → -ter, -ise → -ize, -lled → -led. Applied to both sides, so merging is harmless. */
  function key(w) {
    if (SPELL[w]) return SPELL[w];
    if (w.length > 4) w = w.replace(/our(s?)$/, 'or$1');
    w = w.replace(/([^aeiou])tre(s?)$/, '$1ter$2').replace(/is(e|ed|es|ing|ation|ations)$/, 'iz$1');
    if (w.length > 5) w = w.replace(/lled$/, 'led').replace(/lling$/, 'ling');
    return w;
  }
  function norm(text) {
    const out = [];
    for (let raw of String(text || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/(\d)[:.](\d)/g, '$1 $2').replace(/[-–—/]/g, ' ').split(/\s+/)) {
      raw = raw.replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
      if (!raw) continue;
      if (/^\d+$/.test(raw)) { out.push(...numberWords(Number(raw))); continue; }
      const whole = WHOLE[raw];
      const expanded = whole || raw.replace(/n't$/, ' not').replace(/'re$/, ' are').replace(/'ve$/, ' have').replace(/'ll$/, ' will').replace(/'m$/, ' am').replace(/'d$/, ' would').replace(/'s$/, 's').replace(/'/g, '');
      for (const w of expanded.split(' ')) if (w) out.push(key(w));
    }
    return out;
  }

  /* ---------- Word alignment (longest common subsequence) ---------- */
  function align(target, heard) {
    const display = String(target || '').split(/\s+/).filter(Boolean), owner = [], T = [];
    display.forEach((d, i) => { for (const t of norm(d)) { T.push(t); owner.push(i); } });
    const H = norm(heard), n = T.length, m = H.length, L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = T[i] === H[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const hitT = new Array(n).fill(false), hitH = new Array(m).fill(false);
    for (let i = 0, j = 0; i < n && j < m;) { if (T[i] === H[j]) { hitT[i] = hitH[j] = true; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
    const okDisplay = display.map((_, i) => owner.every((o, k) => o !== i || hitT[k]));
    const matched = hitT.filter(Boolean).length;
    return { words: n, heardWords: m, matched, accuracy: n ? Math.round(matched / n * 100) : 0,
      marks: display.map((word, i) => ({ word, ok: okDisplay[i] })), missed: display.filter((_, i) => !okDisplay[i]).map(w => w.replace(/[^\p{L}\p{N}'-]/gu, '')),
      extra: H.filter((_, j) => !hitH[j]) };
  }
  const accuracyLevel = a => a >= 90 ? 'ok' : a >= 70 ? 'warn' : 'miss';

  /* Pace from the first to the last thing the browser heard. Too short a stretch gives no pace. */
  function pace(words, firstAt, lastAt) {
    const ms = Number.isFinite(firstAt) && Number.isFinite(lastAt) ? lastAt - firstAt : 0;
    return ms >= 2000 && words >= 4 ? Math.round(words / (ms / 60000)) : null;
  }

  /* Read aloud and repeat: accuracy, which words were missed, and (when timed) words a minute. */
  function scoreSentence(type, target, heard, timing = {}) {
    const a = align(target, heard), wpm = pace(a.heardWords, timing.firstAt, timing.lastAt), checks = [];
    if (!a.heardWords) checks.push({ level: 'miss', text: 'Nothing was heard. Check the microphone and try again, close to it and without background noise.' });
    else {
      checks.push({ level: accuracyLevel(a.accuracy), text: `The browser heard ${a.matched} of ${a.words} words as written.${a.missed.length ? ` Missed: ${a.missed.map(w => `“${w}”`).join(', ')}.` : ''}` });
      if (a.extra.length >= 3) checks.push({ level: 'warn', text: `It also heard ${a.extra.length} words that are not in the sentence (${a.extra.slice(0, 5).map(w => `“${w}”`).join(', ')}). Added or repeated words count against you in a real test.` });
      if (type === 'read' && wpm != null) checks.push(wpm < 100 ? { level: 'warn', text: `${wpm} words a minute is slow for reading aloud. Read in phrases rather than word by word.` }
        : wpm > 180 ? { level: 'warn', text: `${wpm} words a minute is fast. Slow down so every word is clear.` } : { level: 'ok', text: `${wpm} words a minute is a clear reading pace.` });
      if (type === 'repeat' && a.accuracy < 70) checks.push({ level: 'warn', text: 'Hold the sentence as a few chunks of meaning (who, did what, when) rather than word by word.' });
    }
    return { ...a, wpm, level: a.heardWords ? accuracyLevel(a.accuracy) : 'miss', checks };
  }

  /* Quick answers: right if any accepted answer appears as whole words in what was heard. */
  function scoreQuick(item, heard) {
    const H = ' ' + norm(heard).join(' ') + ' ', correct = (item.answers || []).some(ans => { const A = norm(ans).join(' '); return A && H.includes(' ' + A + ' '); });
    return { correct, heard: String(heard || '').trim(), expected: item.answers[0], level: correct ? 'ok' : 'miss' };
  }

  /* Just a minute: the delivery checks from the HR practice, plus length, pace and repeated words. */
  const STOP = new Set('the a an and or but so to of in on at for with is are was were be been it this that i we you he she they my our your their me us them as by from if then than not no do does did have has had will would can could should there here what which who when where why how about just very really also because'.split(' '));
  function scoreJam(text, opts = {}) {
    const B = talk(), words = B.wordCount(text), seconds = Number.isFinite(opts.seconds) ? Math.round(opts.seconds) : null;
    const wpm = seconds && seconds >= 15 && words ? Math.round(words / (seconds / 60)) : null, f = B.fillers(text), d = B.delivery(text, { pauses: opts.pauses || null }), checks = [];
    const counts = {}; for (const w of B.tokens(text)) if (!STOP.has(w) && w.length > 2) counts[w] = (counts[w] || 0) + 1;
    const repeated = Object.entries(counts).filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([word, n]) => ({ word, n }));
    if (!words) checks.push({ level: 'miss', text: 'Nothing was heard. Start speaking as soon as the minute begins.' });
    else {
      if (seconds != null) checks.push(seconds < 45 ? { level: 'warn', text: `You stopped after ${seconds} seconds. Use the whole minute: add a second reason or an example.` } : { level: 'ok', text: `You kept going for ${seconds} seconds.` });
      checks.push(words < 90 ? { level: 'warn', text: `${words} words is thin for a minute. Most people say 110–150.` } : { level: 'ok', text: `${words} words in the minute.` });
      if (wpm != null) checks.push(wpm < 100 ? { level: 'warn', text: `${wpm} words a minute is slow. Plan the next point while you finish the current one.` } : wpm > 170 ? { level: 'warn', text: `${wpm} words a minute is fast. Pause between points.` } : { level: 'ok', text: `${wpm} words a minute is a comfortable pace.` });
      checks.push(f.total ? { level: f.per100 > 3 ? 'warn' : 'ok', text: `Filler words: ${Object.entries(f.counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `“${k}” ×${n}`).join(', ')} (${f.per100} per 100 words).` } : { level: 'ok', text: 'No filler words in the transcript. Dictation sometimes drops them, so listen to yourself as well.' });
      if (repeated.length) checks.push({ level: 'warn', text: `Repeated words: ${repeated.map(r => `“${r.word}” ×${r.n}`).join(', ')}. Vary your words or name the specific thing.` });
      checks.push(...d.checks);
    }
    return { words, seconds, wpm, fillers: f, delivery: d, repeated, checks, level: checks.some(c => c.level !== 'ok') ? 'warn' : 'ok' };
  }

  /* ---------- Building a practice run ---------- */
  function pickItems(type, n, rand = Math.random, recent = []) {
    const all = itemsOf(type), fresh = all.filter(x => !recent.includes(x.id)), pool = (fresh.length >= n ? fresh : all).slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const chosen = pool.slice(0, n);
    return type === 'read' || type === 'repeat' ? chosen.sort((a, b) => a.level - b.level) : chosen;
  }
  function buildRun(kind, rand = Math.random, recent = []) {
    const plan = kind === 'full' ? FULL : typeOf(kind) ? [[kind, typeOf(kind).count]] : null;
    if (!plan) throw new Error('Unknown practice: ' + kind);
    return plan.flatMap(([type, n]) => pickItems(type, n, rand, recent).map(x => ({ type, id: x.id })));
  }

  /* ---------- Progress from saved results ---------- */
  function summarise(history, window = 20) {
    const by = type => (history || []).filter(h => h.type === type).slice(0, window), avg = xs => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
    const mean1 = xs => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 10) / 10 : null;
    return TYPES.map(t => {
      const list = by(t.id);
      return { type: t.id, title: t.title, attempts: list.length,
        accuracy: t.id === 'read' || t.id === 'repeat' ? avg(list.filter(h => Number.isFinite(h.accuracy)).map(h => h.accuracy)) : null,
        correct: t.id === 'quick' ? avg(list.map(h => h.correct ? 100 : 0)) : null,
        wpm: avg(list.filter(h => Number.isFinite(h.wpm)).map(h => h.wpm)), fillers: t.id === 'jam' ? mean1(list.filter(h => Number.isFinite(h.fillers)).map(h => h.fillers)) : null };
    });
  }
  /* Words the browser missed at least twice in recent read-aloud and repeat attempts. */
  function trickyWords(history, window = 40, min = 2) {
    const counts = {};
    for (const h of (history || []).filter(x => x.type === 'read' || x.type === 'repeat').slice(0, window)) for (const w of new Set((h.missed || []).map(x => x.toLowerCase()))) counts[w] = (counts[w] || 0) + 1;
    return Object.entries(counts).filter(([w, n]) => n >= min && w.length > 2).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, n]) => ({ word, n }));
  }

  const api = { TYPES, FULL, typeOf, itemsOf, findItem, norm, align, accuracyLevel, pace, scoreSentence, scoreQuick, scoreJam, pickItems, buildRun, summarise, trickyWords };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.EnglishCheck = api;
})(this);
