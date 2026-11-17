/* Case Room aptitude practice: question generators for campus placement aptitude tests. No DOM access, so
   Node tests load this file directly. Every question is multiple choice with four distinct options, exactly one
   correct; wrong options come from common mistakes. Each carries its inputs, a worked solution and a shortcut.
   Quantitative and logical questions are generated from a seed; verbal questions come from the authored bank in
   content/aptitude-verbal.js (window.APTITUDE_VERBAL in the browser). */
(function (root) {
  'use strict';
  const LEVELS = [
    { id: 'easy', title: 'Easy', note: 'One step, friendly numbers' },
    { id: 'medium', title: 'Medium', note: 'Typical placement test' },
    { id: 'hard', title: 'Hard', note: 'More steps, more traps' }
  ];
  const LEVEL_IDS = LEVELS.map(l => l.id);
  const SECTIONS = [
    { id: 'quant', title: 'Quantitative', short: 'Arithmetic, number system, data' },
    { id: 'logical', title: 'Logical', short: 'Series, puzzles, deductions' },
    { id: 'verbal', title: 'Verbal', short: 'Vocabulary, grammar, reading' }
  ];
  const TOPICS = [
    { id: 'percent', section: 'quant', title: 'Percentages', tip: 'Turn every percentage change into a multiplier: +20% is ×1.2, −20% is ×0.8. Successive changes multiply; they never simply add.' },
    { id: 'profit', section: 'quant', title: 'Profit & loss', tip: 'Profit and loss percentages are always on cost price; discounts are always on marked price.' },
    { id: 'interest', section: 'quant', title: 'Simple & compound interest', tip: 'Simple interest grows by the same amount each year; compound interest grows by the same multiplier.' },
    { id: 'ratio', section: 'quant', title: 'Ratio & proportion', tip: 'Write each ratio as parts, find the value of one part, then scale.' },
    { id: 'average', section: 'quant', title: 'Averages & mixtures', tip: 'Work with totals: total = average × count. For mixtures, use the alligation cross.' },
    { id: 'work', section: 'quant', title: 'Time & work', tip: 'Convert days into work per day (1/a), add rates, then invert.' },
    { id: 'pipes', section: 'quant', title: 'Pipes & cisterns', tip: 'Filling pipes add rate, outlets and leaks subtract it. Take the LCM of the times as the tank size.' },
    { id: 'speed', section: 'quant', title: 'Time, speed & distance', tip: 'km/h × 5/18 = m/s. Opposite directions add speeds; same direction subtracts them.' },
    { id: 'number', section: 'quant', title: 'Number system', tip: 'Learn the divisibility rules and the last-digit cycles of 2, 3, 7 and 8 (length 4).' },
    { id: 'pnc', section: 'quant', title: 'Permutations & combinations', tip: 'Order matters → arrange (n!). Order does not matter → choose (nCr). “And” multiplies, “or” adds.' },
    { id: 'probability', section: 'quant', title: 'Probability', tip: 'Count equally likely outcomes. For “or”, subtract the overlap; for “without replacement”, reduce the total.' },
    { id: 'di', section: 'quant', title: 'Data interpretation', tip: 'Read the title, units and years first. Percentage change divides by the earlier value.' },
    { id: 'series', section: 'logical', title: 'Number & letter series', tip: 'Write the differences under the terms. If they do not settle, try ratios, squares or two interleaved series.' },
    { id: 'coding', section: 'logical', title: 'Coding–decoding', tip: 'Write letter positions (A = 1 … Z = 26) above the word and its code; the rule usually appears as a constant gap.' },
    { id: 'blood', section: 'logical', title: 'Blood relations', tip: 'Draw a family tree: generations in rows, + for male, − for female, = for married couples.' },
    { id: 'direction', section: 'logical', title: 'Direction sense', tip: 'Draw each leg on rough paper with north up. Right turns go clockwise; distance is the straight line back to the start.' },
    { id: 'seating', section: 'logical', title: 'Seating & ordering', tip: 'Place the fixed clues first (ends, exact positions), then pairs that sit together, then the “not” clues.' },
    { id: 'syllogism', section: 'logical', title: 'Syllogisms', tip: 'A conclusion follows only if it is true in every possible Venn diagram, not just the obvious one.' },
    { id: 'odd', section: 'logical', title: 'Odd one out', tip: 'Test one property at a time: prime, square, multiple, or the gaps between letters.' },
    { id: 'vocab', section: 'verbal', title: 'Synonyms & antonyms', tip: 'Predict the meaning before reading the options, then rule out the opposite and the look-alike word.' },
    { id: 'fill-blank', section: 'verbal', title: 'Fill in the blank', tip: 'Find the subject of the verb and the time signal in the sentence before you choose.' },
    { id: 'error', section: 'verbal', title: 'Error spotting', tip: 'Check agreement, tense, prepositions and redundant words (“return back”, “discuss about”) in that order.' },
    { id: 'para-jumble', section: 'verbal', title: 'Sentence ordering', tip: 'Find the opening sentence (no pronoun or connector pointing back), then link pairs by pronouns and time words.' },
    { id: 'reading', section: 'verbal', title: 'Reading comprehension', tip: 'Read the questions first, then the passage. Choose what the passage says, not what is true in general.' }
  ];
  const TOPIC_IDS = TOPICS.map(t => t.id);
  const topicOf = id => TOPICS.find(t => t.id === id);
  const VERBAL = TOPICS.filter(t => t.section === 'verbal').map(t => t.id);

  /* ---------- Helpers ---------- */
  function rng(seed) {
    let a = (Number(seed) >>> 0) || 1;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (r, list) => list[Math.floor(r() * list.length)];
  function shuffle(r, list) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const round = (x, dp = 2) => { const f = 10 ** dp, v = Math.round((x + Math.sign(x) * 1e-9) * f) / f; return Object.is(v, -0) ? 0 : v; };
  const NF = {};
  function fmt(n, dp = 2) { return Number.isFinite(n) ? (NF[dp] || (NF[dp] = new Intl.NumberFormat('en-IN', { maximumFractionDigits: dp }))).format(round(n, dp)) : String(n); }
  const rupees = n => '₹' + fmt(n);
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
  const lcm = (a, b) => a / gcd(a, b) * b;
  const fact = n => n <= 1 ? 1 : n * fact(n - 1);
  const nCr = (n, k) => k < 0 || k > n ? 0 : Math.round(fact(n) / (fact(k) * fact(n - k)));
  function modpow(b, e, m) { let x = 1; b %= m; while (e > 0) { if (e & 1) x = x * b % m; b = b * b % m; e >>= 1; } return x; }
  const ratio = (a, b) => { const g = gcd(a, b) || 1; return `${a / g} : ${b / g}`; };
  function frac(n, d) { const g = gcd(n, d) || 1; n /= g; d /= g; return d === 1 ? String(n) : `${n}/${d}`; }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const L = i => String.fromCharCode(65 + ((i % 26) + 26) % 26);
  const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
  const plural = (n, one, many) => n === 1 ? one : many;
  const units = (v, one) => `${fmt(v)} ${round(v) === 1 ? one : one + 's'}`;
  const prob = (n, d) => n > 0 && n < d ? frac(n, d) : null;
  function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); }

  const MEN = ['Aarav', 'Rohit', 'Kabir', 'Vikram', 'Arjun', 'Imran', 'Rahul', 'Sanjay', 'Naveen', 'Farhan', 'Gautam', 'Harish', 'Manoj', 'Pranav', 'Suresh', 'Tarun'];
  const WOMEN = ['Ananya', 'Priya', 'Meera', 'Kavya', 'Deepa', 'Fatima', 'Lakshmi', 'Nisha', 'Pooja', 'Ritu', 'Sneha', 'Tanvi', 'Divya', 'Geeta', 'Isha', 'Shalini'];

  /* Assembles four options: the right one first, then mistakes, then fillers, skipping duplicates. */
  function options(r, right, wrong, filler, fixed) {
    const list = [right], seen = new Set([right]);
    const add = s => { if (list.length < 4 && typeof s === 'string' && s && !/NaN|undefined|Infinity|null/.test(s) && !seen.has(s)) { seen.add(s); list.push(s); } };
    wrong.forEach(add);
    for (let k = 1; list.length < 4 && k <= 120; k++) add(filler(k));
    if (list.length < 4) throw new Error('Could not build four distinct options for ' + right);
    const shown = fixed ? fixed : shuffle(r, list);
    return { options: shown, answer: shown.indexOf(right), display: right };
  }
  function make(meta, prompt, built, o) {
    return {
      id: meta.kind + '-' + hash(prompt + '|' + built.options.join('|')), section: topicOf(meta.topic).section, topic: meta.topic, kind: meta.kind, level: meta.level,
      prompt, options: built.options, answer: built.answer, display: built.display, value: o.value ?? null, inputs: o.inputs || {},
      solution: o.steps, shortcut: o.tip, chart: o.chart || null, table: o.table || null, passage: o.passage || null
    };
  }
  /* A question whose answer is a number. `wrong` holds the values a typical mistake produces. */
  function numeric(r, meta, prompt, value, o) {
    const show = o.show || (v => fmt(v)), ok = o.ok || (v => Number.isFinite(v) && (value <= 0 || v > 0));
    const step = o.step || (Math.abs(value) >= 1 ? Math.max(1, Math.round(Math.abs(value) * 0.1)) : 0.05);
    const fill = k => { const v = value + step * Math.ceil(k / 2) * (k % 2 ? 1 : -1); return ok(v) ? show(v) : null; };
    const built = options(r, show(value), (o.wrong || []).filter(v => v != null && ok(v)).map(show), o.fill || fill);
    return make(meta, prompt, built, { ...o, value });
  }
  /* A question whose answer is a word, ratio, fraction or code. */
  function textual(r, meta, prompt, right, wrong, filler, o) { return make(meta, prompt, options(r, right, wrong, filler, o.fixed), o); }

  /* ---------- Quantitative ---------- */
  const B = {};

  B['pct-of'] = (r, m) => {
    const p = pick(r, { easy: [5, 10, 20, 25, 50], medium: [8, 12, 15, 35, 45, 16], hard: [12.5, 37.5, 62.5, 17.5, 6.25] }[m.level]);
    const base = m.level === 'hard' ? 80 * int(r, 5, 60) : 20 * int(r, 5, m.level === 'easy' ? 50 : 150), ans = p * base / 100;
    return numeric(r, m, `What is ${fmt(p)}% of ${fmt(base)}?`, ans, { inputs: { p, base }, wrong: [p * base / 10, (100 - p) * base / 100, p * base / 1000, ans + base / 100],
      steps: [`${fmt(p)}% of ${fmt(base)} = ${fmt(p)} ÷ 100 × ${fmt(base)}`, `= ${fmt(ans)}`],
      tip: p === 12.5 || p === 37.5 || p === 62.5 ? `${fmt(p)}% = ${p / 12.5}/8, so take ${fmt(base)} ÷ 8 = ${fmt(base / 8)} and multiply by ${p / 12.5}.` : `Build it from 10% (${fmt(base / 10)}) and 1% (${fmt(base / 100)}).` });
  };
  B['pct-successive'] = (r, m) => {
    const what = pick(r, ['the price of a scooter', 'the rent of a flat', 'the price of onions', 'a mobile data plan']);
    const a = 5 * int(r, 2, m.level === 'easy' ? 6 : 10), b = m.level === 'easy' ? a : 5 * int(r, 2, 10), sa = m.level === 'hard' && r() < 0.5 ? -1 : 1, sb = -sa;
    const A = sa * a, Bv = sb * b, net = ((1 + A / 100) * (1 + Bv / 100) - 1) * 100;
    const show = v => v > 0 ? `${fmt(v)}% increase` : v < 0 ? `${fmt(-v)}% decrease` : 'No change';
    return numeric(r, m, `${cap(what)} is ${A > 0 ? 'raised' : 'cut'} by ${a}% and then ${Bv > 0 ? 'raised' : 'cut'} by ${b}%. What is the overall change?`, net, {
      inputs: { a: A, b: Bv }, show, ok: Number.isFinite, step: 0.5, wrong: [A + Bv, -net, A + Bv + A * Bv / 100 * -1 + (A + Bv === 0 ? 1 : 0)],
      steps: [`Multipliers: ${fmt(1 + A / 100)} × ${fmt(1 + Bv / 100)} = ${fmt(1 + net / 100, 4)}`, `${fmt(1 + net / 100, 4)} is ${net < 0 ? 'below' : 'above'} 1 by ${fmt(Math.abs(net) / 100, 4)} → ${show(net)}`],
      tip: `Net % change = a + b + ab/100 = ${A} + (${Bv}) + (${A} × ${Bv})/100 = ${fmt(net)}%. Equal rises and cuts always leave a loss.` });
  };
  B['pct-reverse'] = (r, m) => {
    const p = pick(r, m.level === 'easy' ? [10, 20, 25] : [8, 12.5, 15, 20, 25, 12]), up = m.level === 'easy' || r() < 0.5;
    const before = 1000 * int(r, 12, 90), after = before * (up ? 1 + p / 100 : 1 - p / 100), show = v => rupees(Math.round(v));
    const prompt = up ? `After a ${fmt(p)}% raise, Kavya’s monthly salary is ₹${fmt(after)}. What was it before the raise?` : `After a ${fmt(p)}% discount, a phone costs ₹${fmt(after)}. What was the price before the discount?`;
    return numeric(r, m, prompt, before, { inputs: { p, after, up }, show, step: 500, wrong: [after * (up ? 1 - p / 100 : 1 + p / 100), after / (up ? 1 - p / 100 : 1 + p / 100), up ? after - p * 100 : after + p * 100],
      steps: [`New = original × ${fmt(up ? 1 + p / 100 : 1 - p / 100, 3)}`, `Original = ₹${fmt(after)} ÷ ${fmt(up ? 1 + p / 100 : 1 - p / 100, 3)} = ₹${fmt(before)}`],
      tip: `Do not ${up ? 'subtract' : 'add'} ${fmt(p)}% of the new figure: the ${fmt(p)}% was taken on the old one. Divide by the multiplier instead.` });
  };
  B['pct-compound'] = (r, m) => {
    const n = m.level === 'hard' ? pick(r, [2, 3]) : 2, p = n === 3 ? pick(r, [10, 20]) : pick(r, [5, 8, 10, 12, 15, 20]);
    const P = n === 3 ? 1000 * int(r, 20, 400) : 10000 * int(r, 2, 60), ans = P * (1 + p / 100) ** n, show = v => fmt(Math.round(v));
    return numeric(r, m, `A town has ${fmt(P)} people. Its population grows by ${p}% every year. What will it be after ${n} years?`, ans, {
      inputs: { P, p, n }, show, wrong: [P * (1 + n * p / 100), P * (1 + p / 100) ** (n - 1), P * (1 + p / 100) ** n - P],
      steps: [`Population = ${fmt(P)} × (1 + ${p}/100)^${n}`, `= ${fmt(P)} × ${fmt((1 + p / 100) ** n, 4)} = ${fmt(Math.round(ans))}`],
      tip: `Growth compounds: ${p}% for ${n} years is ×${fmt((1 + p / 100) ** n, 4)}, more than the ${n * p}% you get by adding.` });
  };

  B['pl-percent'] = (r, m) => {
    const CP = 100 * int(r, 2, 80), g = (m.level === 'easy' ? 1 : pick(r, [1, -1])) * pick(r, [5, 8, 10, 12, 15, 20, 25, 30, 40]), SP = CP * (1 + g / 100);
    const item = pick(r, ['a bicycle', 'a mixer-grinder', 'a school bag', 'a ceiling fan', 'a pair of shoes']), show = v => v >= 0 ? `${fmt(v)}% profit` : `${fmt(-v)}% loss`;
    return numeric(r, m, `A trader buys ${item} for ₹${fmt(CP)} and sells it for ₹${fmt(SP)}. What is the profit or loss percentage?`, g, {
      inputs: { CP, SP }, show, ok: Number.isFinite, wrong: [(SP - CP) / SP * 100, -g, (SP - CP) / 100],
      steps: [`${g > 0 ? 'Profit' : 'Loss'} = ₹${fmt(Math.abs(SP - CP))}`, `${g > 0 ? 'Profit' : 'Loss'} % = ${fmt(Math.abs(SP - CP))} ÷ ${fmt(CP)} × 100 = ${fmt(Math.abs(g))}%`],
      tip: 'Profit and loss percentages are measured on the cost price, never on the selling price.' });
  };
  B['pl-markup'] = (r, m) => {
    const mk = pick(r, [20, 25, 30, 40, 50, 60]), d = pick(r, [10, 15, 20, 25, 30]), net = (1 + mk / 100) * (1 - d / 100) * 100 - 100;
    const show = v => v > 0 ? `${fmt(v)}% profit` : v < 0 ? `${fmt(-v)}% loss` : 'No profit, no loss';
    return numeric(r, m, `A shopkeeper marks a television ${mk}% above its cost price and then gives a ${d}% discount on the marked price. What is the profit or loss percentage?`, net, {
      inputs: { m: mk, d }, show, ok: Number.isFinite, step: 1, wrong: [mk - d, mk - d + mk * d / 100, -net],
      steps: [`Take cost = 100. Marked price = ${100 + mk}`, `Selling price = ${100 + mk} × ${fmt(1 - d / 100)} = ${fmt(100 + net)}`, `So ${show(net).toLowerCase()} on cost.`],
      tip: `Markup m then discount d gives m − d − md/100 = ${mk} − ${d} − ${fmt(mk * d / 100)} = ${fmt(net)}%. The discount is on the bigger marked price.` });
  };
  B['pl-cp'] = (r, m) => {
    const CP = 100 * int(r, 5, 100), p = pick(r, [5, 10, 12, 15, 20, 25]), loss = r() < 0.6, SP = CP * (loss ? 1 - p / 100 : 1 + p / 100);
    return numeric(r, m, `Selling a sofa for ₹${fmt(SP)} gives a ${loss ? 'loss' : 'profit'} of ${p}%. What was its cost price?`, CP, {
      inputs: { SP, p, loss }, show: v => rupees(Math.round(v)), step: 100, wrong: [SP * (loss ? 1 + p / 100 : 1 - p / 100), loss ? SP + p * 10 : SP - p * 10, SP],
      steps: [`SP = CP × ${fmt(loss ? 1 - p / 100 : 1 + p / 100)}`, `CP = ${fmt(SP)} ÷ ${fmt(loss ? 1 - p / 100 : 1 + p / 100)} = ₹${fmt(CP)}`],
      tip: `The ${p}% is a share of the cost price, so divide by ${fmt(loss ? 1 - p / 100 : 1 + p / 100)}; adding ${p}% of the selling price undershoots.` });
  };
  B['pl-target'] = (r, m) => {
    const CP = 100 * int(r, 5, 100), p1 = pick(r, [5, 10, 15, 20]), p2 = pick(r, [10, 15, 20, 25]), SP = CP * (1 - p1 / 100), ans = CP * (1 + p2 / 100);
    return numeric(r, m, `A laptop sold for ₹${fmt(SP)} makes a loss of ${p1}%. At what price should it be sold to make a profit of ${p2}%?`, ans, {
      inputs: { SP, p1, p2 }, show: v => rupees(Math.round(v)), step: 100, wrong: [SP * (1 + (p1 + p2) / 100), SP * (1 + p2 / 100), CP],
      steps: [`Cost price = ${fmt(SP)} ÷ ${fmt(1 - p1 / 100)} = ₹${fmt(CP)}`, `New price = ${fmt(CP)} × ${fmt(1 + p2 / 100)} = ₹${fmt(ans)}`],
      tip: `Skip the cost price: new price = old price × (100 + ${p2}) ÷ (100 − ${p1}).` });
  };
  B['pl-weight'] = (r, m) => {
    const w = pick(r, [800, 900, 950, 960, 750, 875, 920]), ans = (1000 - w) / w * 100;
    return numeric(r, m, `A grocer claims to sell rice at cost price but uses a ${w} g weight in place of 1 kg. What is his gain percentage?`, ans, {
      inputs: { w }, show: v => fmt(v) + '%', step: 1, wrong: [(1000 - w) / 10, 1000 / w * 100, (1000 - w) / (1000 + w) * 100],
      steps: [`He gains ${1000 - w} g on every ${w} g he actually gives`, `Gain % = ${1000 - w} ÷ ${w} × 100 = ${fmt(ans)}%`],
      tip: 'Gain % = error ÷ (true value − error) × 100. The base is what the customer actually receives.' });
  };

  B['si'] = (r, m) => {
    const P = 1000 * int(r, 2, 50), R = pick(r, [4, 5, 6, 8, 10, 12]), T = int(r, 2, 5), ask = m.level === 'easy' ? 'si' : pick(r, ['si', 'amount']);
    const si = P * R * T / 100, ans = ask === 'si' ? si : P + si, ci = P * ((1 + R / 100) ** T - 1);
    return numeric(r, m, `Ravi deposits ₹${fmt(P)} at ${R}% simple interest per annum. What ${ask === 'si' ? 'interest does he earn' : 'amount does he get back'} after ${T} years?`, ans, {
      inputs: { P, R, T, ask }, show: rupees, step: 100, wrong: [ask === 'si' ? P + si : si, ask === 'si' ? ci : P + ci, ask === 'si' ? P * R / 100 : P + P * R / 100],
      steps: [`SI = P × R × T ÷ 100 = ${fmt(P)} × ${R} × ${T} ÷ 100 = ₹${fmt(si)}`, ...(ask === 'amount' ? [`Amount = ${fmt(P)} + ${fmt(si)} = ₹${fmt(P + si)}`] : [])],
      tip: `One year's interest is ${R}% of ${fmt(P)} = ₹${fmt(P * R / 100)}; simple interest repeats it every year.` });
  };
  B['si-rate'] = (r, m) => {
    const P = 1000 * int(r, 2, 40), R = pick(r, [4, 5, 6, 7.5, 8, 10, 12.5]), T = pick(r, [2, 3, 4, 5, 8]), A = P + P * R * T / 100;
    return numeric(r, m, `A sum of ₹${fmt(P)} becomes ₹${fmt(A)} in ${T} years at simple interest. What is the rate of interest per annum?`, R, {
      inputs: { P, T, A }, show: v => fmt(v) + '%', step: 1, wrong: [(A - P) * 100 / P, A * 100 / (P * T), (A - P) * 100 / (A * T)],
      steps: [`Interest = ${fmt(A)} − ${fmt(P)} = ₹${fmt(A - P)}`, `R = 100 × ${fmt(A - P)} ÷ (${fmt(P)} × ${T}) = ${fmt(R)}%`],
      tip: 'Total interest as a % of the principal, divided by the number of years, gives the yearly rate.' });
  };
  B['ci'] = (r, m) => {
    const half = m.level === 'hard' && r() < 0.5, R = half ? pick(r, [10, 20]) : pick(r, [5, 10, 20]), T = half ? pick(r, [1, 1.5]) : pick(r, [2, 3]), k = half ? 2 : 1;
    const P = (R / k === 5 ? 8000 * int(r, 1, 10) : 1000 * int(r, 5, 60)), ans = P * ((1 + R / (100 * k)) ** (T * k) - 1);
    return numeric(r, m, `Find the compound interest on ₹${fmt(P)} at ${R}% per annum for ${fmt(T)} year${T === 1 ? '' : 's'}, compounded ${half ? 'half-yearly' : 'annually'}.`, ans, {
      inputs: { P, R, T, k }, show: rupees, step: 50, wrong: [P * R * T / 100, P * (1 + R / (100 * k)) ** (T * k), half ? P * ((1 + R / 100) ** T - 1) : P * ((1 + R / 100) ** (T - 1) - 1)],
      steps: [half ? `Half-yearly: rate ${R / 2}% per period, ${T * 2} periods` : `${T} years at ${R}%`, `Amount = ${fmt(P)} × ${fmt(1 + R / (100 * k))}^${T * k} = ₹${fmt(P + ans)}`, `CI = ${fmt(P + ans)} − ${fmt(P)} = ₹${fmt(ans)}`],
      tip: half ? 'Half-yearly compounding: halve the rate and double the number of periods.' : 'Compound interest = amount − principal. Simple interest underestimates it because it ignores interest on interest.' });
  };
  B['ci-si-diff'] = (r, m) => {
    const P = 2500 * int(r, 2, 40), R = pick(r, [4, 5, 6, 8, 10, 12, 15, 20]), ans = P * (R / 100) ** 2;
    return numeric(r, m, `What is the difference between compound interest and simple interest on ₹${fmt(P)} for 2 years at ${R}% per annum?`, ans, {
      inputs: { P, R }, show: rupees, step: 5, wrong: [P * R / 100, 2 * ans, P * R * R / 100],
      steps: [`For 2 years, CI − SI = interest on the first year's interest`, `= P × (R/100)² = ${fmt(P)} × ${fmt(R / 100)}² = ₹${fmt(ans)}`],
      tip: 'Two-year CI − SI = P(R/100)². For three years it is P(R/100)²(3 + R/100).' });
  };

  B['ratio-share'] = (r, m) => {
    const names = shuffle(r, ['Asha', 'Bilal', 'Chetan', 'Divya']).slice(0, 3);
    let parts; do parts = [int(r, 1, 7), int(r, 1, 7), int(r, 1, 7)]; while (parts[0] === parts[1] && parts[1] === parts[2]);
    const sum = parts[0] + parts[1] + parts[2], N = sum * 100 * int(r, 1, 20), who = int(r, 0, 2), ans = N * parts[who] / sum;
    return numeric(r, m, `₹${fmt(N)} is divided among ${names.join(', ').replace(/, ([^,]*)$/, ' and $1')} in the ratio ${parts.join(' : ')}. How much does ${names[who]} get?`, ans, {
      inputs: { N, parts, who }, show: rupees, step: 100, wrong: [N / 3, N * parts[who] / (sum - parts[who]), N * parts[(who + 1) % 3] / sum, N * parts[(who + 2) % 3] / sum],
      steps: [`Total parts = ${parts.join(' + ')} = ${sum}`, `One part = ${fmt(N)} ÷ ${sum} = ₹${fmt(N / sum)}`, `${names[who]} gets ${parts[who]} parts = ₹${fmt(ans)}`],
      tip: 'Find the value of one part first; every share is then a multiple of it.' });
  };
  B['ratio-chain'] = (r, m) => {
    let p, q, s, t; do { p = int(r, 1, 9); q = int(r, 1, 9); s = int(r, 1, 9); t = int(r, 1, 9); } while (gcd(p, q) > 1 || gcd(s, t) > 1 || p === q || s === t || q === s);
    return textual(r, m, `If A : B = ${p} : ${q} and B : C = ${s} : ${t}, what is A : C?`, ratio(p * s, q * t), [ratio(p, t), ratio(p * t, q * s), ratio(p + s, q + t)],
      k => ratio(p * s + k, q * t), { inputs: { p, q, s, t },
        steps: [`Make B the same in both: A : B = ${p * s} : ${q * s} and B : C = ${q * s} : ${q * t}`, `So A : C = ${p * s} : ${q * t} = ${ratio(p * s, q * t)}`],
        tip: 'A : C = (A/B) × (B/C): multiply the first terms and the last terms.' });
  };
  B['ratio-age'] = (r, m) => {
    for (;;) {
      const [a, b] = pick(r, [[1, 3], [2, 5], [1, 4], [3, 8], [2, 7], [3, 10], [1, 2], [2, 9]]), k = int(r, 3, 12), n = pick(r, [3, 4, 5, 6, 8, 10, 12]);
      const x = a * k + n, y = b * k + n, g = gcd(x, y), c = x / g, d = y / g;
      if (c > 20 || d > 30 || c * b === d * a || b * k > 75) continue;
      return numeric(r, m, `The ages of Meera and her mother are in the ratio ${a} : ${b}. After ${n} years the ratio will be ${c} : ${d}. How old is Meera now?`, a * k, {
        inputs: { a, b, c, d, n }, show: v => units(v, 'year'), step: 2, wrong: [b * k, a * k + n, a * k - n],
        steps: [`Let the ages be ${a}x and ${b}x. Then (${a}x + ${n}) : (${b}x + ${n}) = ${c} : ${d}`, `${d}(${a}x + ${n}) = ${c}(${b}x + ${n}) → ${d * a - c * b}x = ${n * (c - d)} → x = ${k}`, `Meera is ${a} × ${k} = ${a * k} years old`],
        tip: 'Test the options: the right one makes both ratios work. That is often faster than algebra.' });
    }
  };
  B['prop-direct'] = (r, m) => {
    const u = 5 * int(r, 1, 30), n1 = int(r, 3, 12); let n2; do n2 = int(r, 2, 20); while (n2 === n1);
    const cost = u * n1;
    return numeric(r, m, `If ${n1} notebooks cost ₹${fmt(cost)}, how much do ${n2} notebooks cost?`, u * n2, { inputs: { n1, cost, n2 }, show: rupees, step: u,
      wrong: [cost + (n2 - n1), cost * n1 / n2, u * (n2 + 1)],
      steps: [`One notebook costs ₹${fmt(cost)} ÷ ${n1} = ₹${fmt(u)}`, `${n2} notebooks cost ${n2} × ${fmt(u)} = ₹${fmt(u * n2)}`], tip: 'Unitary method: find the cost of one, then multiply.' });
  };
  B['prop-inverse'] = (r, m) => {
    for (;;) {
      const d2 = int(r, 4, 20), w2 = int(r, 4, 30), total = w2 * d2, divs = []; for (let w = 3; w <= 40; w++) if (w !== w2 && total % w === 0 && total / w <= 60 && total / w >= 2 && total / w !== d2) divs.push(w);
      if (!divs.length) continue;
      const w1 = pick(r, divs), d1 = total / w1;
      return numeric(r, m, `${w1} workers can build a wall in ${d1} days. How many days will ${w2} workers take, working at the same rate?`, d2, { inputs: { w1, d1, w2 }, show: v => units(v, 'day'), step: 1,
        wrong: [d1 * w2 / w1, d1 - (w2 - w1), d1 + (w2 - w1)],
        steps: [`Total work = ${w1} × ${d1} = ${total} worker-days`, `Days = ${total} ÷ ${w2} = ${d2}`], tip: 'More workers, fewer days: workers × days stays constant.' });
    }
  };

  B['avg-add'] = (r, m) => {
    const n = int(r, 5, 12), A = int(r, 40, 80), dlt = pick(r, [1, 2, 3, -1, -2]), Bv = A + dlt, x = (n + 1) * Bv - n * A;
    return numeric(r, m, `The average mark of ${n} students in a test is ${A}. When one more student joins, the average becomes ${Bv}. What did the new student score?`, x, {
      inputs: { n, A, B: Bv }, step: 2, wrong: [Bv, Bv + dlt, (n + 1) * Bv - n * Bv + n * dlt + dlt * 2],
      steps: [`Old total = ${n} × ${A} = ${n * A}`, `New total = ${n + 1} × ${Bv} = ${(n + 1) * Bv}`, `New score = ${(n + 1) * Bv} − ${n * A} = ${x}`],
      tip: `New score = new average + (number before × change) = ${Bv} + ${n} × (${dlt}) = ${x}.` });
  };
  B['avg-replace'] = (r, m) => {
    const n = int(r, 4, 12), d = pick(r, [0.5, 1, 1.5, 2, 2.5, 3]), w = int(r, 45, 70), ans = w + n * d;
    return numeric(r, m, `The average weight of ${n} people increases by ${fmt(d)} kg when one of them, weighing ${w} kg, is replaced by a new person. What does the new person weigh?`, ans, {
      inputs: { n, d, w }, show: v => `${fmt(v)} kg`, step: 1, wrong: [w + d, w - n * d, w + (n - 1) * d],
      steps: [`The total rises by ${n} × ${fmt(d)} = ${fmt(n * d)} kg`, `New person = ${w} + ${fmt(n * d)} = ${fmt(ans)} kg`], tip: 'Replacing one member shifts the total by (count × change in average).' });
  };
  function allig(r) {
    for (;;) { const a = int(r, 20, 60), b = a + int(r, 8, 40), mid = int(r, a + 2, b - 2); if (mid - a !== b - mid) return { a, b, mid }; }
  }
  B['alligation'] = (r, m) => {
    const { a, b, mid } = allig(r);
    return textual(r, m, `In what ratio must rice at ₹${a}/kg be mixed with rice at ₹${b}/kg so that the mixture costs ₹${mid}/kg?`, ratio(b - mid, mid - a),
      [ratio(mid - a, b - mid), ratio(a, b), ratio(b - a, mid - a)], k => ratio(b - mid + k, mid - a), { inputs: { a, b, m: mid },
        steps: [`Cheaper : dearer = (dearer − mean) : (mean − cheaper)`, `= (${b} − ${mid}) : (${mid} − ${a}) = ${ratio(b - mid, mid - a)}`],
        tip: 'Alligation cross: each ingredient’s share is the distance of the OTHER price from the mean. Swapping them is the usual slip.' });
  };
  B['alligation-qty'] = (r, m) => {
    let a, b, mid, Q, ans; do { ({ a, b, mid } = allig(r)); const unit = (mid - a) / gcd(mid - a, b - mid); Q = unit * int(r, 1, Math.max(1, Math.floor(60 / unit))); ans = Q * (b - mid) / (mid - a); } while (ans > 120 || ans < 2 || Q < 4);
    return numeric(r, m, `How many kg of tea at ₹${a}/kg must be mixed with ${Q} kg of tea at ₹${b}/kg to get a blend worth ₹${mid}/kg?`, ans, {
      inputs: { a, b, m: mid, Q }, show: v => `${fmt(v)} kg`, step: Math.max(1, Math.round(ans / 5)), wrong: [Q * (mid - a) / (b - mid), Q, Q * (b - a) / (mid - a)],
      steps: [`Ratio cheaper : dearer = (${b} − ${mid}) : (${mid} − ${a}) = ${ratio(b - mid, mid - a)}`, `Cheaper = ${Q} × ${b - mid} ÷ ${mid - a} = ${fmt(ans)} kg`],
      tip: 'Get the alligation ratio first, then scale it to the quantity you know.' });
  };

  const together = (...d) => 1 / d.reduce((s, x) => s + 1 / x, 0);
  function cleanPairs(lo, hi, test) { const out = []; for (let a = lo; a <= hi; a++) for (let b = a + 1; b <= hi; b++) if (test(a, b)) out.push([a, b]); return out; }
  const isClean = x => Math.abs(x * 2 - Math.round(x * 2)) < 1e-9;
  const PAIRS = { easy: cleanPairs(3, 40, (a, b) => Number.isInteger(a * b / (a + b))), medium: cleanPairs(4, 60, (a, b) => isClean(a * b / (a + b))) };
  const TRIPLES = (() => { const out = []; for (let a = 4; a <= 40; a++) for (let b = a + 1; b <= 50; b++) for (let c = b + 1; c <= 60; c++) { const t = together(a, b, c); if (Math.abs(t - Math.round(t)) < 1e-9) out.push([a, b, c]); } return out; })();
  B['work-together'] = (r, m) => {
    const [a, b] = shuffle(r, pick(r, PAIRS[m.level === 'easy' ? 'easy' : 'medium'])), ans = together(a, b);
    return numeric(r, m, `Anil can finish a project in ${a} days and Bala can finish it in ${b} days. How long will they take working together?`, ans, {
      inputs: { days: [a, b] }, show: v => units(v, 'day'), step: 1, wrong: [(a + b) / 2, a + b, Math.abs(a - b)],
      steps: [`Per day: 1/${a} + 1/${b} = ${a + b}/${a * b}`, `Time = ${a * b}/${a + b} = ${fmt(ans)} days`], tip: 'For two workers, time together = ab ÷ (a + b). It is always less than the faster one alone.' });
  };
  B['work-three'] = (r, m) => {
    const d = shuffle(r, pick(r, TRIPLES)), ans = together(...d), L3 = d.reduce(lcm);
    return numeric(r, m, `A, B and C can do a job alone in ${d[0]}, ${d[1]} and ${d[2]} days respectively. How many days will they take working together?`, ans, {
      inputs: { days: d }, show: v => units(v, 'day'), step: 1, wrong: [(d[0] + d[1] + d[2]) / 3, together(d[0], d[1]), Math.min(...d) / 3],
      steps: [`Take the job as ${L3} units (LCM). Rates: ${d.map(x => L3 / x).join(' + ')} = ${d.reduce((s, x) => s + L3 / x, 0)} units a day`, `Time = ${L3} ÷ ${d.reduce((s, x) => s + L3 / x, 0)} = ${fmt(ans)} days`],
      tip: 'Choose the LCM of the days as the total work so every rate is a whole number.' });
  };
  B['work-leave'] = (r, m) => {
    for (;;) {
      const a = int(r, 6, 30), b = int(r, 8, 40), k = int(r, 1, 8), rest = 1 - k / a - k / b;
      if (a === b || rest <= 0.15 || !isClean(rest * b) || !isClean(k + rest * b)) continue;
      const ans = k + rest * b;
      return numeric(r, m, `A can finish a job in ${a} days and B in ${b} days. They work together for ${k} day${k > 1 ? 's' : ''}, then A leaves. In how many days in all is the job finished?`, ans, {
        inputs: { a, b, k }, show: v => units(v, 'day'), step: 1, wrong: [rest * b, together(a, b), b],
        steps: [`Together they do ${k} × (1/${a} + 1/${b}) = ${fmt(1 - rest, 4)} of the job`, `B does the remaining ${fmt(rest, 4)} in ${fmt(rest)} × ${b} = ${fmt(rest * b)} days`, `Total = ${k} + ${fmt(rest * b)} = ${fmt(ans)} days`],
        tip: 'Count the days already worked: the question asks for the total, not just B’s share.' });
    }
  };
  B['work-wages'] = (r, m) => {
    const [a, b] = shuffle(r, pick(r, PAIRS.easy)), W = (a + b) / gcd(a, b) * 50 * int(r, 1, 12), ans = W * b / (a + b);
    return numeric(r, m, `Ajay can do a job in ${a} days and Bina in ${b} days. Together they finish it and are paid ₹${fmt(W)}. What is Ajay’s fair share?`, ans, {
      inputs: { a, b, W }, show: rupees, step: 50, wrong: [W * a / (a + b), W / 2, W * a / b],
      steps: [`Wages follow work done per day: 1/${a} : 1/${b} = ${b} : ${a}`, `Ajay gets ${fmt(W)} × ${b}/${a + b} = ₹${fmt(ans)}`], tip: 'Pay is in the ratio of efficiency, which is the inverse of the days taken.' });
  };
  B['work-efficiency'] = (r, m) => {
    const p = pick(r, [2, 3, 1.5]), d = (p === 2 ? 2 : 3) * int(r, 2, 10), ans = d * (p + 1) / p;
    return numeric(r, m, `A is ${p === 1.5 ? '1.5' : p} times as efficient as B. Together they finish a job in ${d} days. How long would A take alone?`, ans, {
      inputs: { p, d }, show: v => units(v, 'day'), step: 1, wrong: [d * (p + 1), d * p, 2 * d],
      steps: [`If B does 1 unit a day, A does ${p}; together ${p + 1} units a day`, `Job = ${fmt(p + 1)} × ${d} = ${fmt((p + 1) * d)} units`, `A alone = ${fmt((p + 1) * d)} ÷ ${p} = ${fmt(ans)} days`],
      tip: 'Turn efficiency into units of work per day; the total job size is then easy to find.' });
  };

  const NET = cleanPairs(2, 40, (a, b) => Number.isInteger(a * b / (b - a)) && a * b / (b - a) <= 120);
  const LEAKS = (() => { const out = []; for (let a = 2; a <= 20; a++) for (let x = 1; x <= 10; x++) if (Number.isInteger(a * (a + x) / x) && a * (a + x) / x <= 150) out.push([a, x]); return out; })();
  const THREE = (() => { const out = []; for (let a = 2; a <= 30; a++) for (let b = a + 1; b <= 30; b++) for (let c = 2; c <= 40; c++) { const t = 1 / (1 / a + 1 / b - 1 / c); if (c !== a && c !== b && t > 0 && t <= 60 && Math.abs(t - Math.round(t)) < 1e-9) out.push([a, b, c]); } return out; })();
  B['pipes-net'] = (r, m) => {
    const [a, b] = pick(r, NET), ans = a * b / (b - a);
    return numeric(r, m, `Pipe A can fill a tank in ${a} hours and pipe B can empty the full tank in ${b} hours. If both are opened together on an empty tank, how long will it take to fill?`, ans, {
      inputs: { fill: [a], empty: [b] }, show: v => units(v, 'hour'), step: 2, wrong: [a * b / (a + b), b - a, (a + b) / 2],
      steps: [`Net rate = 1/${a} − 1/${b} = ${b - a}/${a * b} of the tank per hour`, `Time = ${a * b}/${b - a} = ${fmt(ans)} hours`], tip: 'An outlet subtracts its rate. Adding it as if it were a second inlet is the classic mistake.' });
  };
  B['pipes-three'] = (r, m) => {
    const [a, b, c] = pick(r, THREE), ans = 1 / (1 / a + 1 / b - 1 / c), L3 = [a, b, c].reduce(lcm);
    return numeric(r, m, `Pipes A and B fill a tank in ${a} and ${b} hours respectively, while pipe C empties it in ${c} hours. If all three are opened on an empty tank, how long will it take to fill?`, ans, {
      inputs: { fill: [a, b], empty: [c] }, show: v => units(v, 'hour'), step: 1, wrong: [1 / (1 / a + 1 / b + 1 / c), a * b / (a + b), (a + b + c) / 3],
      steps: [`Tank = ${L3} units. A fills ${L3 / a}, B fills ${L3 / b}, C empties ${L3 / c} units an hour`, `Net = ${L3 / a + L3 / b - L3 / c} units an hour → ${L3} ÷ ${L3 / a + L3 / b - L3 / c} = ${fmt(ans)} hours`],
      tip: 'Use the LCM of the times as the tank size; subtract the outlet’s units.' });
  };
  B['pipes-leak'] = (r, m) => {
    const [a, x] = pick(r, LEAKS), ans = a * (a + x) / x;
    return numeric(r, m, `A pipe can fill a tank in ${a} hours. Because of a leak at the bottom, it takes ${a + x} hours. How long would the leak take to empty the full tank?`, ans, {
      inputs: { a, x }, show: v => units(v, 'hour'), step: 2, wrong: [x, a + x, a * x],
      steps: [`Leak rate = 1/${a} − 1/${a + x} = ${x}/${a * (a + x)} per hour`, `Leak alone = ${a * (a + x)}/${x} = ${fmt(ans)} hours`], tip: 'Leak time = (a × b) ÷ (b − a), where a and b are the filling times without and with the leak.' });
  };

  B['train-pole'] = (r, m) => {
    const S = 18 * int(r, 2, 6), v = S * 5 / 18, t = int(r, 6, 20), Lm = v * t;
    return numeric(r, m, `A train ${fmt(Lm)} m long runs at ${S} km/h. How long does it take to cross a signal pole?`, t, {
      inputs: { L: Lm, S }, show: v2 => units(v2, 'second'), step: 2, wrong: [Lm / S, Lm / (S * 18 / 5), Lm / v / 2],
      steps: [`${S} km/h = ${S} × 5/18 = ${fmt(v)} m/s`, `Time = ${fmt(Lm)} ÷ ${fmt(v)} = ${t} seconds`], tip: 'To cross a pole the train covers only its own length. Convert km/h to m/s with × 5/18.' });
  };
  B['train-platform'] = (r, m) => {
    const S = 18 * int(r, 2, 6), v = S * 5 / 18, t = int(r, 12, 40), Lm = 10 * int(r, 10, Math.floor(v * t / 10) - 5), P = v * t - Lm;
    return numeric(r, m, `A ${fmt(Lm)} m long train travelling at ${S} km/h crosses a platform ${fmt(P)} m long. How long does it take?`, t, {
      inputs: { L: Lm, P, S }, show: v2 => units(v2, 'second'), step: 3, wrong: [Lm / v, P / v, (Lm + P) / S],
      steps: [`Distance = train + platform = ${fmt(Lm)} + ${fmt(P)} = ${fmt(Lm + P)} m`, `Speed = ${fmt(v)} m/s, so time = ${fmt(Lm + P)} ÷ ${fmt(v)} = ${t} s`], tip: 'Crossing a platform or bridge means covering both lengths.' });
  };
  B['train-cross'] = (r, m) => {
    const same = m.level === 'hard' && r() < 0.6, rel = 18 * int(r, 1, same ? 3 : 7);
    let S1, S2; if (same) { S2 = 6 * int(r, 5, 12); S1 = S2 + rel; } else { S1 = int(r, Math.ceil(rel * 0.35), Math.floor(rel * 0.65)); S2 = rel - S1; }
    const v = rel * 5 / 18, t = int(r, 6, 30), total = v * t, L1 = 10 * int(r, 5, Math.max(6, Math.floor(total / 10) - 5)), L2 = total - L1;
    if (L2 < 40) return B['train-cross'](r, m);
    const other = (same ? S1 + S2 : Math.abs(S1 - S2)) * 5 / 18;
    return numeric(r, m, `Two trains, ${fmt(L1)} m and ${fmt(L2)} m long, run on parallel tracks at ${S1} km/h and ${S2} km/h in ${same ? 'the same direction' : 'opposite directions'}. How long do they take to cross each other completely?`, t, {
      inputs: { L1, L2, S1, S2, same }, show: v2 => units(v2, 'second'), step: 2, wrong: [other > 0 ? total / other : null, L1 / v, (L1 + L2) / rel],
      steps: [`Relative speed = ${S1} ${same ? '−' : '+'} ${S2} = ${rel} km/h = ${fmt(v)} m/s`, `Distance = ${fmt(L1)} + ${fmt(L2)} = ${fmt(total)} m`, `Time = ${fmt(total)} ÷ ${fmt(v)} = ${t} s`],
      tip: 'Opposite directions: add the speeds. Same direction: subtract them. The distance is the sum of both lengths.' });
  };
  B['boat'] = (r, m) => {
    for (;;) {
      const b = int(r, 6, 20), s = int(r, 1, b - 2), up = b - s, down = b + s, base = lcm(up, down);
      if (base > 120) continue;
      const D = base * int(r, 1, Math.max(1, Math.floor(120 / base))), ans = D / down + D / up;
      return numeric(r, m, `A boat goes at ${b} km/h in still water and the river flows at ${s} km/h. How long will it take to go ${D} km upstream and come back?`, ans, {
        inputs: { b, s, D }, show: v => units(v, 'hour'), step: 1, wrong: [2 * D / b, D / up, 2 * D / down],
        steps: [`Downstream speed = ${b} + ${s} = ${down} km/h; upstream = ${b} − ${s} = ${up} km/h`, `Time = ${D}/${down} + ${D}/${up} = ${fmt(D / down)} + ${fmt(D / up)} = ${fmt(ans)} hours`],
        tip: 'Never use the still-water speed for a river trip: the current helps one way and slows you the other.' });
    }
  };
  const AVG = cleanPairs(4, 18, (a, b) => Number.isInteger(2 * 5 * a * 5 * b / (5 * a + 5 * b)) && 2 * a * b % (a + b) === 0 && a !== b).map(([a, b]) => [5 * a, 5 * b]);
  B['avg-speed'] = (r, m) => {
    const [x, y] = shuffle(r, pick(r, AVG)), ans = 2 * x * y / (x + y);
    return numeric(r, m, `Sana drives from Pune to Nashik at ${x} km/h and returns by the same road at ${y} km/h. What is her average speed for the round trip?`, ans, {
      inputs: { x, y }, show: v => `${fmt(v)} km/h`, step: 2, wrong: [(x + y) / 2, Math.abs(x - y), x * y / (x + y)],
      steps: [`Average speed = total distance ÷ total time = 2xy ÷ (x + y)`, `= 2 × ${x} × ${y} ÷ ${x + y} = ${fmt(ans)} km/h`], tip: 'Equal distances at two speeds: use the harmonic mean 2xy/(x + y), which is below the simple average.' });
  };

  B['lcm-bells'] = (r, m) => {
    let list, L; do { list = shuffle(r, [4, 6, 8, 9, 10, 12, 15, 16, 18, 20, 24, 30]).slice(0, 3).sort((a, b) => a - b); L = list.reduce(lcm); } while (L > 720 || L === list[0] * list[1] * list[2]);
    return numeric(r, m, `Three bells ring at intervals of ${list[0]}, ${list[1]} and ${list[2]} seconds. They ring together at 9:00 am. After how many seconds will they next ring together?`, L, {
      inputs: { list }, show: v => units(v, 'second'), step: list[0], wrong: [list[0] * list[1] * list[2], list.reduce(gcd), L / 2, list[0] + list[1] + list[2]],
      steps: [`LCM(${list.join(', ')})`, `= ${L}`], tip: '“Together again” is an LCM question; “largest equal pieces” is an HCF question.' });
  };
  B['hcf-lcm'] = (r, m) => {
    let h, x, y; do { h = int(r, 2, 15); x = int(r, 2, 12); y = int(r, 2, 12); } while (gcd(x, y) !== 1 || x === y);
    const a = h * x, b = h * y, Lv = h * x * y;
    return numeric(r, m, `The HCF of two numbers is ${h} and their LCM is ${Lv}. If one number is ${a}, what is the other?`, b, {
      inputs: { h, L: Lv, a }, step: h, wrong: [Lv / a, Lv / h, a * h / Lv * 10, Lv - a],
      steps: [`HCF × LCM = product of the two numbers`, `Other = ${h} × ${Lv} ÷ ${a} = ${b}`], tip: 'For two numbers, HCF × LCM = their product (not true for three numbers).' });
  };
  const NEAR = { 3: [1, 2], 4: [2, 6], 5: [1, 2], 6: [2, 3, 4], 8: [4, 2, 12], 9: [3, 6], 11: [1, 10, 2], 12: [6, 4, 8, 3], 7: [1, 2, 3], 13: [1, 2, 3] };
  B['divisible'] = (r, m) => {
    const d = pick(r, { easy: [3, 4, 9, 5], medium: [8, 11, 12, 6], hard: [7, 11, 12, 13, 8] }[m.level]), c = d * int(r, Math.ceil(1000 / d), Math.floor((m.level === 'easy' ? 9999 : 99999) / d));
    const wrong = []; for (const j of [...NEAR[d], ...Array.from({ length: 2 * d }, (_, i) => i + 1)]) for (const s of [1, -1]) { const v = c + s * j; if (v % d !== 0 && v > 0) wrong.push(String(v)); }
    return textual(r, m, `Which of these numbers is divisible by ${d}?`, String(c), shuffle(r, wrong.slice(0, 6)), k => String(c + d * 3 + k * (k % d ? 1 : 0) || c + 1), {
      inputs: { d }, steps: [`${c} = ${d} × ${c / d}`, `The other options leave a remainder when divided by ${d}.`],
      tip: { 3: 'Divisible by 3 if the digit sum is.', 9: 'Divisible by 9 if the digit sum is.', 4: 'Check only the last two digits.', 8: 'Check only the last three digits.', 5: 'Last digit 0 or 5.', 6: 'Even and divisible by 3.', 11: 'Alternate digit sum difference must be 0 or a multiple of 11.', 12: 'Must pass both the 3 and 4 tests.', 7: 'Double the last digit and subtract it from the rest; repeat.', 13: 'Add 4 × the last digit to the rest; repeat.' }[d] });
  };
  B['remainder-power'] = (r, m) => {
    let b, d; do { b = int(r, 2, 9); d = pick(r, [5, 7, 9, 11, 13]); } while (gcd(b, d) !== 1);
    const n = int(r, 20, 99), ans = modpow(b, n, d);
    let cycle = 1; while (modpow(b, cycle, d) !== 1) cycle++;
    return textual(r, m, `What is the remainder when ${b}^${n} is divided by ${d}?`, String(ans), [String(modpow(b, n % d, d)), String(b % d), String(n % d), String(d - ans)], k => String((ans + k) % d), {
      inputs: { b, n, d }, value: ans,
      steps: [`Powers of ${b} mod ${d} repeat every ${cycle}: ${Array.from({ length: cycle }, (_, i) => modpow(b, i + 1, d)).join(', ')}`, `${n} = ${cycle} × ${Math.floor(n / cycle)} + ${n % cycle}, so the remainder = ${b}^${n % cycle || cycle} mod ${d} = ${ans}`],
      tip: 'Find the cycle of remainders, then use the exponent modulo the cycle length (not modulo the divisor).' });
  };
  B['unit-digit'] = (r, m) => {
    const a = pick(r, [2, 3, 7, 8, 12, 13, 17, 18, 22, 23, 27, 4, 9, 14, 19]), n = int(r, 21, 299), ans = modpow(a, n, 10);
    return textual(r, m, `What is the unit digit of ${a}^${n}?`, String(ans), [String(modpow(a, n % 10, 10)), String((a * n) % 10), String(a % 10)], k => String((ans + k) % 10), {
      inputs: { a, n }, value: ans, steps: [`Only the last digit ${a % 10} matters; its powers end in ${[1, 2, 3, 4].map(i => modpow(a % 10, i, 10)).join(', ')} (cycle of 4)`, `${n} mod 4 = ${n % 4}, so the unit digit is ${ans}`],
      tip: 'Unit digits repeat every 4 powers. Use the exponent mod 4 (a remainder of 0 means the 4th term).' });
  };
  B['remainder-divisor'] = (r, m) => {
    const d2 = pick(r, [5, 6, 7, 8, 9, 12]), d1 = d2 * int(r, 3, 9), rem = int(r, d2 + 1, d1 - 1), ans = rem % d2;
    return textual(r, m, `A number leaves a remainder of ${rem} when divided by ${d1}. What remainder does it leave when divided by ${d2}?`, String(ans), [String(rem), String(d2 - ans), String((ans + 1) % d2)], k => String((ans + k) % d2), {
      inputs: { d1, rem, d2 }, value: ans, steps: [`The number is ${d1}k + ${rem}, and ${d1} is a multiple of ${d2}`, `So the remainder is ${rem} mod ${d2} = ${ans}`], tip: 'If the first divisor is a multiple of the second, just divide the first remainder by the second divisor.' });
  };

  const WORDS = { easy: ['DELHI', 'PUNE', 'AGRA', 'INDIA', 'GOA', 'MANGO', 'ASSAM'], medium: ['KERALA', 'MUMBAI', 'BANANA', 'SIKKIM', 'NAGPUR', 'PATNA', 'RANCHI'], hard: ['KOLKATA', 'GUJARAT', 'BENGALI', 'MANIPUR', 'TRIPURA', 'MADURAI'] };
  const multiset = w => { const c = {}; for (const ch of w) c[ch] = (c[ch] || 0) + 1; return Object.values(c); };
  B['pnc-word'] = (r, m) => {
    const word = pick(r, WORDS[m.level]), n = word.length, reps = multiset(word).filter(x => x > 1), ans = fact(n) / reps.reduce((p, x) => p * fact(x), 1);
    return numeric(r, m, `In how many different ways can the letters of the word ${word} be arranged?`, ans, {
      inputs: { word }, step: Math.max(1, Math.round(ans / 4)), wrong: [fact(n), reps.length ? fact(n) / 2 : fact(n) / 2, fact(n - 1), reps.length ? ans / 2 : n * n],
      steps: [`${n} letters${reps.length ? ' with repeats: ' + Object.entries(word.split('').reduce((c, ch) => (c[ch] = (c[ch] || 0) + 1, c), {})).filter(e => e[1] > 1).map(([ch, k]) => `${ch} × ${k}`).join(', ') : ', all different'}`, `${n}!${reps.length ? ' ÷ ' + reps.map(x => x + '!').join(' × ') : ''} = ${fmt(ans)}`],
      tip: 'Divide n! by k! for every letter that repeats k times, because swapping identical letters gives the same word.' });
  };
  const VOWELS = ['MANGO', 'NAGPUR', 'RANCHI', 'DELHI', 'BHOPAL', 'SURAT', 'JAIPUR', 'INDORE', 'MYSORE', 'SHIMLA'];
  B['pnc-vowels'] = (r, m) => {
    const word = pick(r, VOWELS), v = [...word].filter(c => 'AEIOU'.includes(c)).length, c = word.length - v, ans = fact(c + 1) * fact(v);
    return numeric(r, m, `In how many ways can the letters of ${word} be arranged so that the vowels always stay together?`, ans, {
      inputs: { word }, step: Math.max(1, Math.round(ans / 4)), wrong: [fact(c + 1), fact(word.length), fact(c) * fact(v)],
      steps: [`Tie the ${v} vowels into one block: ${c} consonants + 1 block = ${c + 1} units → ${c + 1}! = ${fact(c + 1)}`, `The vowels can be ordered inside the block in ${v}! = ${fact(v)} ways`, `Total = ${fact(c + 1)} × ${fact(v)} = ${fmt(ans)}`],
      tip: 'Treat the group as one unit, then multiply by the arrangements inside the group.' });
  };
  B['pnc-committee'] = (r, m) => {
    const M = int(r, 4, 8), W = int(r, 3, 7), a = int(r, 1, Math.min(3, M - 1)), b = int(r, 1, Math.min(3, W - 1)), ans = nCr(M, a) * nCr(W, b);
    return numeric(r, m, `A committee of ${a} ${plural(a, 'man', 'men')} and ${b} ${plural(b, 'woman', 'women')} is to be chosen from ${M} men and ${W} women. In how many ways can this be done?`, ans, {
      inputs: { M, W, a, b }, step: Math.max(1, Math.round(ans / 5)), wrong: [nCr(M, a) + nCr(W, b), nCr(M + W, a + b), fact(a) * fact(b) * ans],
      steps: [`Men: ${M}C${a} = ${nCr(M, a)}; women: ${W}C${b} = ${nCr(W, b)}`, `Both choices happen together, so multiply: ${nCr(M, a)} × ${nCr(W, b)} = ${fmt(ans)}`], tip: '“And” multiplies; “or” adds. A committee has no order, so use combinations.' });
  };
  B['pnc-atleast'] = (r, m) => {
    const M = int(r, 4, 7), W = int(r, 2, 5), k = int(r, 3, 4), ans = nCr(M + W, k) - nCr(M, k);
    return numeric(r, m, `A team of ${k} is to be picked from ${M} men and ${W} women. In how many ways can it be picked so that it has at least one woman?`, ans, {
      inputs: { M, W, k }, step: Math.max(1, Math.round(ans / 5)), wrong: [W * nCr(M + W - 1, k - 1), nCr(M + W, k), nCr(M, k)],
      steps: [`All teams: ${M + W}C${k} = ${nCr(M + W, k)}`, `Teams with no woman: ${M}C${k} = ${nCr(M, k)}`, `At least one woman = ${nCr(M + W, k)} − ${nCr(M, k)} = ${ans}`],
      tip: '“At least one” = total − none. Picking one woman first and then “any others” counts some teams twice.' });
  };
  B['pnc-handshake'] = (r, m) => {
    const n = int(r, 5, 30), ctx = r() < 0.5, ans = n * (n - 1) / 2;
    return numeric(r, m, ctx ? `At a placement orientation, each of ${n} students shakes hands once with every other student. How many handshakes take place?` : `In a college league, each of ${n} teams plays every other team once. How many matches are played?`, ans, {
      inputs: { n }, step: Math.max(1, n - 1), wrong: [n * (n - 1), n * n / 2, n - 1],
      steps: [`Each pair meets once: ${n}C2`, `= ${n} × ${n - 1} ÷ 2 = ${ans}`], tip: 'n(n − 1) counts every pair twice (A–B and B–A); halve it.' });
  };
  B['pnc-circle'] = (r, m) => {
    const n = int(r, 4, 8), ans = fact(n - 1);
    return numeric(r, m, `In how many ways can ${n} friends sit around a round table?`, ans, {
      inputs: { n }, step: Math.max(1, Math.round(ans / 5)), wrong: [fact(n), fact(n - 1) / 2, n],
      steps: [`Fix one person to remove identical rotations`, `Arrange the other ${n - 1}: ${n - 1}! = ${fmt(ans)}`], tip: 'Circular arrangements: (n − 1)!. Halve it only when clockwise and anticlockwise are the same (garlands, necklaces).' });
  };
  B['pnc-together'] = (r, m) => {
    const n = int(r, 4, 7), ans = 2 * fact(n - 1);
    return numeric(r, m, `In how many ways can ${n} people stand in a queue if two particular friends must always stand next to each other?`, ans, {
      inputs: { n }, step: Math.max(1, Math.round(ans / 5)), wrong: [fact(n - 1), fact(n) - 2 * fact(n - 1), fact(n)],
      steps: [`Treat the two friends as one unit: ${n - 1} units → ${n - 1}! = ${fact(n - 1)}`, `The friends can swap places: × 2 = ${fmt(ans)}`], tip: 'Do not forget the arrangements inside the tied group.' });
  };

  const PRIMES = new Set([2, 3, 5, 7, 11]);
  function diceCount(ev, s) { let c = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) { const t = a + b; if (ev === 'sum' ? t === s : ev === 'atleast' ? t >= s : ev === 'double' ? a === b : PRIMES.has(t)) c++; } return c; }
  B['prob-dice'] = (r, m) => {
    const ev = pick(r, m.level === 'easy' ? ['sum', 'double'] : ['sum', 'atleast', 'prime']), s = ev === 'sum' ? int(r, 3, 11) : ev === 'atleast' ? int(r, 8, 11) : 0, c = diceCount(ev, s);
    const text = { sum: `the total is ${s}`, atleast: `the total is at least ${s}`, double: 'both dice show the same number', prime: 'the total is a prime number' }[ev];
    return textual(r, m, `Two fair dice are rolled. What is the probability that ${text}?`, frac(c, 36), [ev === 'sum' ? frac(1, 11) : prob(c + 1, 36), prob(36 - c, 36), prob(c, 12), frac(1, 6)], k => prob(c + k, 36 + k), {
      inputs: { ev, s }, steps: [`There are 6 × 6 = 36 equally likely outcomes`, `${c} of them have ${text}`, `Probability = ${c}/36 = ${frac(c, 36)}`],
      tip: 'Totals are not equally likely: 7 can happen 6 ways, 2 only 1 way. Count outcomes out of 36.' });
  };
  const CARD = { face: c => c.r >= 11, 'king-or-heart': c => c.r === 13 || c.s === 'H', 'black-or-ace': c => c.s === 'S' || c.s === 'C' || c.r === 1, 'heart-or-face': c => c.s === 'H' || c.r >= 11, 'red-king': c => c.r === 13 && (c.s === 'H' || c.s === 'D'), 'not-club': c => c.s !== 'C', 'queen-or-king': c => c.r === 12 || c.r === 13 };
  const CARD_TEXT = { face: 'a face card (jack, queen or king)', 'king-or-heart': 'a king or a heart', 'black-or-ace': 'a black card or an ace', 'heart-or-face': 'a heart or a face card', 'red-king': 'a red king', 'not-club': 'not a club', 'queen-or-king': 'a queen or a king' };
  const NAIVE = { 'king-or-heart': 17, 'black-or-ace': 30, 'heart-or-face': 25 };
  B['prob-cards'] = (r, m) => {
    const ev = pick(r, Object.keys(CARD)), deck = []; for (const s of 'SHDC') for (let k = 1; k <= 13; k++) deck.push({ s, r: k });
    const c = deck.filter(CARD[ev]).length;
    return textual(r, m, `A card is drawn at random from a well-shuffled pack of 52. What is the probability that it is ${CARD_TEXT[ev]}?`, frac(c, 52), [NAIVE[ev] ? frac(NAIVE[ev], 52) : prob(c, 13), prob(52 - c, 52), prob(c, 26), prob(c + 4, 52)], k => prob(c + k, 52 + k), {
      inputs: { ev }, steps: [`Favourable cards: ${c}${NAIVE[ev] ? ` (${NAIVE[ev]} if you count the overlap twice, minus ${NAIVE[ev] - c} counted twice)` : ''}`, `Probability = ${c}/52 = ${frac(c, 52)}`],
      tip: 'P(A or B) = P(A) + P(B) − P(both). The cards in both groups must be counted once.' });
  };
  B['prob-balls'] = (r, m) => {
    const red = int(r, 2, 7), green = int(r, 1, 6), blue = int(r, 2, 6), n = red + green + blue, pairs = n * (n - 1) / 2;
    if (m.level === 'easy') return textual(r, m, `A bag has ${red} red, ${green} green and ${blue} blue balls. One ball is drawn at random. What is the probability that it is red or blue?`, frac(red + blue, n), [frac(red, n), frac(green, n), frac(red * blue, n * n)], k => prob(red + blue + k, n + k + 1), {
      inputs: { red, green, blue, draw: 'red-or-blue' }, steps: [`Red or blue = ${red} + ${blue} = ${red + blue} balls out of ${n}`, `Probability = ${frac(red + blue, n)}`], tip: '“Or” for one draw: add the favourable balls. Or subtract the rest: 1 − P(green).' });
    if (m.level === 'medium') return textual(r, m, `A bag has ${red} red, ${green} green and ${blue} blue balls. Two balls are drawn together. What is the probability that both are red?`, frac(red * (red - 1) / 2, pairs), [frac(red * red, n * n), frac(red, n), prob(red * (red - 1), pairs)], k => prob(red * (red - 1) / 2 + k, pairs), {
      inputs: { red, green, blue, draw: 'both-red' }, steps: [`Ways to pick 2 red: ${red}C2 = ${red * (red - 1) / 2}; any 2 balls: ${n}C2 = ${pairs}`, `Probability = ${red * (red - 1) / 2}/${pairs} = ${frac(red * (red - 1) / 2, pairs)}`], tip: 'Drawn together = without replacement: the second draw has one ball fewer.' });
    return textual(r, m, `A bag has ${red} red, ${green} green and ${blue} blue balls. Two balls are drawn together. What is the probability that one is red and the other blue?`, frac(red * blue, pairs), [frac(red * blue, n * (n - 1)), prob(2 * red * blue, n * n), frac(red + blue, n)], k => prob(red * blue + k, pairs), {
      inputs: { red, green, blue, draw: 'red-and-blue' }, steps: [`Red-blue pairs: ${red} × ${blue} = ${red * blue}; all pairs: ${n}C2 = ${pairs}`, `Probability = ${red * blue}/${pairs} = ${frac(red * blue, pairs)}`], tip: 'Counting ordered draws (red then blue) needs × 2 for blue then red; counting pairs does not.' });
  };
  B['prob-coins'] = (r, m) => {
    const n = int(r, 2, 4), atLeast = r() < 0.4, k = int(r, 1, n - 1), c = atLeast ? 2 ** n - 1 : nCr(n, k);
    return textual(r, m, `${n === 2 ? 'Two' : n === 3 ? 'Three' : 'Four'} fair coins are tossed. What is the probability of getting ${atLeast ? 'at least one head' : `exactly ${k} head${k > 1 ? 's' : ''}`}?`, frac(c, 2 ** n), [atLeast ? frac(n, 2 ** n) : frac(k, n), atLeast ? frac(n, n + 1) : frac(1, n + 1), frac(1, 2 ** n), '1/2'], j => frac(j, 2 ** (n + 1)), {
      inputs: { n, k, atLeast }, steps: [`${2 ** n} equally likely outcomes`, atLeast ? `Only one (all tails) has no head, so ${2 ** n - 1} have at least one` : `${n}C${k} = ${c} outcomes have exactly ${k} head${k > 1 ? 's' : ''}`, `Probability = ${frac(c, 2 ** n)}`],
      tip: atLeast ? 'At least one = 1 − P(none).' : 'Exactly k heads in n tosses = nCk ÷ 2ⁿ.' });
  };

  const REGIONS = ['North', 'South', 'East', 'West'], YEARS = [2021, 2022, 2023, 2024];
  function salesTable(r) {
    const cols = shuffle(r, REGIONS).slice(0, 3);
    return { title: 'Annapurna Foods — sales by region (₹ crore)', columns: ['Year', ...cols], rows: YEARS.map(y => [y, ...cols.map(() => 5 * int(r, 12, 80))]) };
  }
  B['di-growth'] = (r, m) => {
    const table = salesTable(r), col = int(r, 1, 3), y1 = m.level === 'hard' ? int(r, 0, 1) : int(r, 0, 2), y2 = m.level === 'hard' ? y1 + 2 : y1 + 1;
    let g; do g = 5 * int(r, -4, 12); while (!g);
    const v1 = 20 * int(r, 4, 15), v2 = v1 * (1 + g / 100); table.rows[y1][col] = v1; table.rows[y2][col] = v2;
    const other = col === 1 ? 2 : 1, o1 = table.rows[y1][other], o2 = table.rows[y2][other], show = v => v > 0 ? `${fmt(v)}% increase` : v < 0 ? `${fmt(-v)}% decrease` : 'No change', name = table.columns[col];
    return numeric(r, m, `Using the table, by what percentage did ${name} region sales change from ${YEARS[y1]} to ${YEARS[y2]}?`, g, {
      inputs: { table, col, y1, y2 }, table, show, ok: Number.isFinite, step: 2.5, wrong: [(v2 - v1) / v2 * 100, v2 - v1, (o2 - o1) / o1 * 100],
      steps: [`${name}: ₹${fmt(v1)} crore → ₹${fmt(v2)} crore, a change of ${fmt(v2 - v1)}`, `${fmt(v2 - v1)} ÷ ${fmt(v1)} × 100 = ${fmt(g)}%`],
      tip: 'Percentage change divides by the earlier year. Read the right row and column before calculating.' });
  };
  B['di-average'] = (r, m) => {
    const table = salesTable(r), col = int(r, 1, 3), vals = table.rows.map(row => row[col]), sum = vals.reduce((s, x) => s + x, 0), ans = sum / 4, name = table.columns[col];
    const other = table.rows.map(row => row[col === 1 ? 2 : 1]).reduce((s, x) => s + x, 0) / 4;
    return numeric(r, m, `Using the table, what were ${name} region’s average annual sales from ${YEARS[0]} to ${YEARS[3]}?`, ans, {
      inputs: { table, col }, table, show: v => `₹${fmt(v)} crore`, step: 5, wrong: [sum / 3, (vals[0] + vals[3]) / 2, other],
      steps: [`Total = ${vals.join(' + ')} = ${sum}`, `Average = ${sum} ÷ 4 = ${fmt(ans)}`], tip: 'Count the years carefully: 2021 to 2024 inclusive is four years.' });
  };
  function barChart(r) {
    const labels = shuffle(r, ['Asha Motors', 'Bharat Cycles', 'Chola Wheels', 'Deccan Auto']), T = pick(r, [200, 250, 400, 500]);
    let v2; do { v2 = [0, 0, 0].map(() => 5 * int(r, 4, Math.floor(T * 0.4 / 5))); v2.push(T - v2[0] - v2[1] - v2[2]); } while (v2[3] < 20 || v2[3] > T * 0.45);
    const series = labels.map((label, i) => ({ label, values: [Math.max(10, v2[i] + 5 * int(r, -6, 6)), v2[i]] }));
    return { title: 'Two-wheeler sales (thousand units)', years: [2023, 2024], series };
  }
  B['di-share'] = (r, m) => {
    const chart = barChart(r), i = int(r, 0, 3), s = chart.series[i], T = chart.series.reduce((t, x) => t + x.values[1], 0), T1 = chart.series.reduce((t, x) => t + x.values[0], 0), ans = s.values[1] / T * 100;
    return numeric(r, m, `Using the chart, what share of 2024 sales did ${s.label} have?`, ans, {
      inputs: { chart, label: s.label }, chart, show: v => fmt(v) + '%', step: 2.5, wrong: [s.values[1] / (T - s.values[1]) * 100, s.values[0] / T1 * 100, chart.series[(i + 1) % 4].values[1] / T * 100],
      steps: [`2024 total = ${chart.series.map(x => x.values[1]).join(' + ')} = ${T}`, `${s.label}: ${s.values[1]} ÷ ${T} × 100 = ${fmt(ans)}%`], tip: 'Share is part ÷ whole. Dividing by “everyone else” instead of the total is a frequent slip.' });
  };
  B['di-change'] = (r, m) => {
    let chart; do chart = barChart(r); while (!chart.series.some(s => s.values[1] < s.values[0]) || !chart.series.some(s => s.values[1] > s.values[0]));
    const sum = j => chart.series.reduce((t, x) => t + x.values[j], 0), ans = sum(1) - sum(0), ups = chart.series.reduce((t, x) => t + Math.max(0, x.values[1] - x.values[0]), 0);
    const show = v => v > 0 ? `Up ${fmt(v)} thousand` : v < 0 ? `Down ${fmt(-v)} thousand` : 'No change';
    return numeric(r, m, 'Using the chart, by how much did total sales of the four companies change from 2023 to 2024?', ans, {
      inputs: { chart }, chart, show, ok: Number.isFinite, step: 5, wrong: [ups, -ans, chart.series[0].values[1] - chart.series[0].values[0]],
      steps: [`2023 total = ${sum(0)}; 2024 total = ${sum(1)}`, `Change = ${sum(1)} − ${sum(0)} = ${ans} thousand units`], tip: 'Some bars fall while others rise. Add the signed changes, or subtract the totals.' });
  };

  /* ---------- Logical ---------- */
  function seriesTerm(rule, p, i) {
    switch (rule) {
      case 'arith': return p.a + i * p.d;
      case 'geom': return p.a * p.r ** i;
      case 'diff': return p.a + i * p.d + p.c * i * (i - 1) / 2;
      case 'square': return (p.k + i) ** 2 + p.e;
      case 'cube': return (p.k + i) ** 3 + p.e;
      case 'muladd': { let t = p.a; for (let j = 0; j < i; j++) t = t * p.m + p.c; return t; }
      case 'alt': return i % 2 ? p.b + (i - 1) / 2 * p.d2 : p.a + i / 2 * p.d1;
    }
  }
  B['series-number'] = (r, m) => {
    const rule = pick(r, { easy: ['arith', 'geom', 'diff'], medium: ['diff', 'square', 'geom', 'muladd'], hard: ['muladd', 'alt', 'cube', 'square'] }[m.level]);
    const p = { arith: () => ({ a: int(r, 2, 40), d: pick(r, [3, 4, 6, 7, 9, 11, -3, -4]) * (r() < 0.3 ? 1 : 1) }), geom: () => ({ a: int(r, 1, 5), r: pick(r, [2, 3]) }), diff: () => ({ a: int(r, 2, 20), d: int(r, 1, 5), c: int(r, 1, 3) }),
      square: () => ({ k: int(r, 2, 9), e: pick(r, [-1, 1, 2, 3]) }), cube: () => ({ k: int(r, 1, 5), e: pick(r, [-1, 1, 2]) }), muladd: () => ({ a: int(r, 1, 6), m: pick(r, [2, 3]), c: pick(r, [-1, 1, 2, 3]) }),
      alt: () => ({ a: int(r, 1, 20), d1: pick(r, [2, 3, 5]), b: int(r, 30, 60), d2: pick(r, [-2, -3, -4, 4]) }) }[rule]();
    const n = rule === 'alt' ? 6 : 5, shown = Array.from({ length: n }, (_, i) => seriesTerm(rule, p, i)), ans = seriesTerm(rule, p, n);
    const lastDiff = shown[n - 1] - shown[n - 2];
    const wrong = [seriesTerm(rule, p, n + 1), shown[n - 1] + lastDiff, ans + 1, ans - 1, rule === 'square' || rule === 'cube' ? ans - p.e : ans + (rule === 'alt' ? p.d1 : 2)];
    const describe = { arith: `Add ${p.d} each time`, geom: `Multiply by ${p.r} each time`, diff: `The differences grow by ${p.c}: ${shown.slice(1).map((x, i) => x - shown[i]).join(', ')}, then ${ans - shown[n - 1]}`,
      square: `Terms are n² ${p.e < 0 ? '−' : '+'} ${Math.abs(p.e)} for n = ${p.k}, ${p.k + 1}, …`, cube: `Terms are n³ ${p.e < 0 ? '−' : '+'} ${Math.abs(p.e)} for n = ${p.k}, ${p.k + 1}, …`,
      muladd: `Each term = previous × ${p.m} ${p.c < 0 ? '−' : '+'} ${Math.abs(p.c)}`, alt: `Two series alternate: ${p.a}, ${p.a + p.d1}, … (step ${p.d1}) and ${p.b}, ${p.b + p.d2}, … (step ${p.d2})` }[rule];
    return textual(r, m, `What comes next in the series?  ${shown.join(', ')}, ?`, String(ans), wrong.map(String), k => String(ans + k * (k % 2 ? 1 : -1) * 2), {
      inputs: { rule, p, shown }, value: ans, steps: [describe, `So the next term is ${ans}`], tip: 'Write the differences under the series; if they also change, look at their differences or try ratios.' });
  };
  B['series-letter'] = (r, m) => {
    if (m.level === 'easy' || (m.level === 'medium' && r() < 0.5)) {
      const grow = m.level !== 'easy', k = int(r, 1, 3), steps = Array.from({ length: 5 }, (_, i) => grow ? k + i : k + 1), total = steps.reduce((s, x) => s + x, 0), start = int(r, 0, 25 - total);
      const letters = [start]; steps.forEach(s => letters.push(letters[letters.length - 1] + s));
      const shown = letters.slice(0, 5).map(L), ans = L(letters[5]), last = letters[4];
      return textual(r, m, `What comes next?  ${shown.join(', ')}, ?`, ans, [L(last + steps[3]), L(letters[5] + 1), L(letters[5] - 1)], j => L(letters[5] + j + 1), {
        inputs: { rule: 'skip', start, steps }, steps: [`Letter positions: ${letters.slice(0, 5).map(x => x + 1).join(', ')}`, `Gaps: ${steps.slice(0, 4).join(', ')} → next gap ${steps[4]}`, `${last + 1} + ${steps[4]} = ${letters[5] + 1} = ${ans}`],
        tip: 'Convert letters to positions (A = 1 … Z = 26) and look at the gaps. EJOTY marks 5, 10, 15, 20, 25.' });
    }
    const k1 = int(r, 1, 3), k2 = int(r, 1, 3), s1 = int(r, 0, 25 - 5 * k1), s2 = int(r, 5 * k2, 25), n = 4;
    const pair = i => L(s1 + i * k1) + L(s2 - i * k2), shown = Array.from({ length: n }, (_, i) => pair(i)), ans = pair(n);
    return textual(r, m, `What comes next?  ${shown.join(', ')}, ?`, ans, [L(s1 + n * k1) + L(s2 - n * k2 + 1), L(s1 + n * k1 + 1) + L(s2 - n * k2), L(s2 - n * k2) + L(s1 + n * k1), pair(n + 1)], j => L(s1 + n * k1 + j) + L(s2 - n * k2 - j), {
      inputs: { rule: 'pairs', s1, k1, s2, k2, n }, steps: [`First letters move forward ${k1}: ${shown.map(x => x[0]).join(', ')} → ${ans[0]}`, `Second letters move back ${k2}: ${shown.map(x => x[1]).join(', ')} → ${ans[1]}`],
      tip: 'Treat each letter position in the group as its own series.' });
  };
  const CODE_WORDS = ['MANGO', 'TIGER', 'LOTUS', 'RIVER', 'CHALK', 'PLANT', 'BRICK', 'CLOUD', 'DREAM', 'FLAME', 'GRAPE', 'HOUSE', 'LEMON', 'MONEY', 'NORTH', 'OCEAN', 'PEARL', 'TRAIN', 'WATER', 'SOLAR', 'CHAIR', 'BREAD', 'STONE', 'QUEEN'];
  const codeIdx = w => [...w].map(c => c.charCodeAt(0) - 65);
  function encode(word, rule) {
    let x = codeIdx(word); if (rule.rev) x = x.reverse();
    return x.map(c => L(rule.mirror ? 25 - c : c + rule.k)).join('');
  }
  const CODE_RULES = [...Array.from({ length: 25 }, (_, i) => ({ k: i + 1 })), { mirror: true, k: 0 }, ...Array.from({ length: 26 }, (_, i) => ({ k: i, rev: true }))];
  B['code-shift'] = (r, m) => {
    for (;;) {
      const [ex, target] = shuffle(r, CODE_WORDS).slice(0, 2), rule = { easy: () => ({ k: pick(r, [1, 2, 3, -1, -2]) }), medium: () => pick(r, [{ mirror: true, k: 0 }, { k: pick(r, [3, 4, -3, 5]) }]), hard: () => ({ k: pick(r, [1, 2, -1, -2, 3]), rev: true }) }[m.level]();
      const exCode = encode(ex, rule), fits = new Set(CODE_RULES.filter(x => encode(ex, x) === exCode).map(x => encode(target, x)));
      if (fits.size !== 1) continue;
      const ans = encode(target, rule), k = rule.k || 0;
      const wrong = [encode(target, { ...rule, k: -k || 1 }), encode(target, { ...rule, k: k + 1 }), rule.rev ? encode(target, { k }) : ans.split('').reverse().join(''), encode(target, { ...rule, k: k - 1 })].filter(w => w !== target);
      const explain = rule.mirror ? 'Each letter is replaced by its opposite (A↔Z, B↔Y, …): position p becomes 27 − p' : `${rule.rev ? 'The word is reversed, then each' : 'Each'} letter moves ${Math.abs(k)} place${Math.abs(k) === 1 ? '' : 's'} ${k >= 0 ? 'forward' : 'back'}${k === 0 ? '' : ''}`;
      return textual(r, m, `In a certain code, ${ex} is written as ${exCode}. How is ${target} written in that code?`, ans, wrong, j => L(codeIdx(ans)[0] + j) + ans.slice(1), {
        inputs: { ex, exCode, target, rule }, steps: [`${ex} → ${exCode}: ${explain}${rule.rev && k === 0 ? ' (no shift)' : ''}`, `Apply the same rule to ${target}: ${ans}`], tip: 'Compare the first letter of the word with the first and the last letter of the code: that shows whether the word was reversed.' });
    }
  };
  B['code-sum'] = (r, m) => {
    for (;;) {
      const [ex, target] = shuffle(r, ['CAT', 'DOG', 'COW', 'HEN', 'BAT', 'RAT', 'PEN', 'INK', 'SUN', 'MAP', 'TEA', 'BUS', 'CAR', 'JAM', 'LID', 'FAN']).slice(0, 2), rev = m.level !== 'easy' && r() < 0.5;
      const val = (w, rv) => codeIdx(w).reduce((s, c) => s + (rv ? 26 - c : c + 1), 0), exV = val(ex, rev);
      if (exV === val(ex, !rev)) continue;
      const ans = val(target, rev);
      return textual(r, m, `If ${ex} = ${exV}, then ${target} = ?`, String(ans), [String(val(target, !rev)), String(ans + 1), String(ans - target.length)], j => String(ans + j + 1), {
        inputs: { ex, exV, target, rev }, value: ans, steps: [`${ex}: ${codeIdx(ex).map(c => rev ? 26 - c : c + 1).join(' + ')} = ${exV} (${rev ? 'reverse positions, Z = 1 … A = 26' : 'positions A = 1 … Z = 26'})`, `${target}: ${codeIdx(target).map(c => rev ? 26 - c : c + 1).join(' + ')} = ${ans}`],
        tip: 'Try the sum of letter positions first, then reverse positions (27 − p). Check against the example before answering.' });
    }
  };

  /* Blood relations: a three-generation family is built first; the statements walk a path through it. */
  function family(r) {
    const men = shuffle(r, MEN), women = shuffle(r, WOMEN), people = [];
    const add = (g, parents = []) => { const p = { name: (g === 'm' ? men : women).pop(), g, parents, spouse: null }; people.push(p); return p; };
    const gp = add('m'), gm = add('f'); gp.spouse = gm.name; gm.spouse = gp.name;
    for (let i = 0, n = int(r, 2, 3); i < n; i++) {
      const c = add(r() < 0.5 ? 'm' : 'f', [gp.name, gm.name]), s = add(c.g === 'm' ? 'f' : 'm'); c.spouse = s.name; s.spouse = c.name;
      const par = c.g === 'm' ? [c.name, s.name] : [s.name, c.name];
      for (let j = 0, k = int(r, 1, 2); j < k; j++) add(r() < 0.5 ? 'm' : 'f', par);
    }
    return people;
  }
  function relationOf(people, y, x) {
    const P = n => people.find(p => p.name === n), Y = P(y), X = P(x), par = p => p.parents.map(P);
    const sib = (a, b) => a !== b && a.parents.length && a.parents[0] === b.parents[0];
    const spouseOf = p => p.spouse ? P(p.spouse) : null, g = Y.g === 'm';
    if (X.spouse === y) return g ? 'husband' : 'wife';
    if (X.parents.includes(y)) return g ? 'father' : 'mother';
    if (Y.parents.includes(x)) return g ? 'son' : 'daughter';
    if (sib(X, Y)) return g ? 'brother' : 'sister';
    if (par(X).some(p => p.parents.includes(y))) return g ? 'grandfather' : 'grandmother';
    if (par(Y).some(p => p.parents.includes(x))) return g ? 'grandson' : 'granddaughter';
    if (par(X).some(p => sib(p, Y) || (spouseOf(Y) && sib(p, spouseOf(Y))))) return g ? 'uncle' : 'aunt';
    if (par(Y).some(p => sib(p, X) || (spouseOf(X) && sib(p, spouseOf(X))))) return g ? 'nephew' : 'niece';
    if (par(X).some(px => par(Y).some(py => sib(px, py)))) return 'cousin';
    if (spouseOf(X) && spouseOf(X).parents.includes(y)) return g ? 'father-in-law' : 'mother-in-law';
    if (people.some(c => c.parents.includes(x) && c.spouse === y)) return g ? 'son-in-law' : 'daughter-in-law';
    if ((spouseOf(X) && sib(spouseOf(X), Y)) || people.some(s => sib(s, X) && s.spouse === y)) return g ? 'brother-in-law' : 'sister-in-law';
    return null;
  }
  const NEAR_REL = { father: ['grandfather', 'uncle', 'father-in-law', 'brother'], mother: ['grandmother', 'aunt', 'mother-in-law', 'sister'], son: ['nephew', 'grandson', 'brother', 'son-in-law'], daughter: ['niece', 'granddaughter', 'sister', 'daughter-in-law'],
    brother: ['cousin', 'brother-in-law', 'nephew', 'uncle'], sister: ['cousin', 'sister-in-law', 'niece', 'aunt'], husband: ['brother-in-law', 'father-in-law', 'brother', 'son-in-law'], wife: ['sister-in-law', 'mother-in-law', 'sister', 'daughter-in-law'],
    grandfather: ['father', 'uncle', 'father-in-law', 'brother'], grandmother: ['mother', 'aunt', 'mother-in-law', 'sister'], grandson: ['son', 'nephew', 'brother', 'cousin'], granddaughter: ['daughter', 'niece', 'sister', 'cousin'],
    uncle: ['father', 'cousin', 'brother-in-law', 'grandfather'], aunt: ['mother', 'cousin', 'sister-in-law', 'grandmother'], nephew: ['son', 'cousin', 'grandson', 'brother'], niece: ['daughter', 'cousin', 'granddaughter', 'sister'],
    cousin: ['brother', 'nephew', 'uncle', 'brother-in-law'], 'father-in-law': ['father', 'uncle', 'grandfather', 'brother-in-law'], 'mother-in-law': ['mother', 'aunt', 'grandmother', 'sister-in-law'],
    'son-in-law': ['son', 'nephew', 'brother-in-law', 'husband'], 'daughter-in-law': ['daughter', 'niece', 'sister-in-law', 'wife'], 'brother-in-law': ['brother', 'cousin', 'husband', 'uncle'], 'sister-in-law': ['sister', 'cousin', 'wife', 'aunt'] };
  function edges(people, a) {
    const A = people.find(p => p.name === a), out = [];
    for (const b of people) {
      if (b === A) continue;
      if (b.parents.includes(a)) out.push([b.name, A.g === 'm' ? 'father' : 'mother']);
      else if (A.parents.includes(b.name)) out.push([b.name, A.g === 'm' ? 'son' : 'daughter']);
      else if (A.spouse === b.name) out.push([b.name, A.g === 'm' ? 'husband' : 'wife']);
      else if (A.parents.length && A.parents[0] === b.parents[0]) out.push([b.name, A.g === 'm' ? 'brother' : 'sister']);
    }
    return out;
  }
  function path(people, from, to) {
    const prev = { [from]: null }, queue = [from];
    while (queue.length) { const a = queue.shift(); if (a === to) break; for (const [b, rel] of edges(people, a)) if (!(b in prev)) { prev[b] = [a, rel]; queue.push(b); } }
    if (!(to in prev)) return null;
    const steps = []; for (let n = to; prev[n]; n = prev[n][0]) steps.unshift({ a: prev[n][0], rel: prev[n][1], b: n });
    return steps;
  }
  B['blood'] = (r, m) => {
    const want = { easy: 2, medium: 3, hard: 4 }[m.level];
    for (let tries = 0; ; tries++) {
      const people = family(r), y = pick(r, people).name, x = pick(r, people).name;
      if (x === y) continue;
      const steps = path(people, y, x), rel = steps && relationOf(people, y, x);
      if (!steps || !rel || steps.length !== (tries > 400 ? Math.max(2, want - 1) : want)) continue;
      const statements = steps.map(s => `${s.a} is ${s.b}’s ${s.rel}.`);
      return textual(r, m, `${statements.join(' ')} How is ${y} related to ${x}?`, cap(rel), NEAR_REL[rel].map(cap), j => cap(Object.keys(NEAR_REL)[j % 24]), {
        inputs: { people, y, x, steps }, steps: [...steps.map(s => `${s.a} → ${s.rel} of → ${s.b}`), `Put on one family tree, ${y} is ${x}’s ${rel}.`],
        tip: 'Draw each statement as you read it; mark gender as soon as a word like “brother” or “mother” reveals it.' });
    }
  };

  const DIR8 = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
  const TRIPLE = [[3, 4], [4, 3], [6, 8], [8, 6], [5, 12], [12, 5], [9, 12], [12, 9], [8, 15], [15, 8]];
  function compass(dx, dy) { const ns = dy > 0 ? 'North' : dy < 0 ? 'South' : '', ew = dx > 0 ? 'East' : dx < 0 ? 'West' : ''; return ns && ew ? `${ns}-${ew}` : ns || ew; }
  B['dir-distance'] = (r, m) => {
    const [X0, Y0] = pick(r, TRIPLE), sx = pick(r, [1, -1]), sy = pick(r, [1, -1]), X = sx * X0, Y = sy * Y0, name = pick(r, [...MEN, ...WOMEN]), she = WOMEN.includes(name) ? 'she' : 'he';
    const h1 = sy > 0 ? 0 : 2, h2 = sx > 0 ? 1 : 3, e = int(r, 2, 6), f = int(r, 2, 6);
    const legs = m.level === 'easy' ? [[h1, Y0], [h2, X0]] : m.level === 'medium' ? [[h1, Y0 + e], [h2, X0], [(h1 + 2) % 4, e]] : [[h1, Y0 + e], [h2, X0 + f], [(h1 + 2) % 4, e], [(h2 + 2) % 4, f]];
    const NAMES4 = ['north', 'east', 'south', 'west'], words = [`${name} walks ${legs[0][1]} km ${NAMES4[legs[0][0]]}`];
    const turns = [null];
    for (let i = 1; i < legs.length; i++) { const t = (legs[i][0] - legs[i - 1][0] + 4) % 4 === 1 ? 'right' : 'left'; turns.push(t); words.push(`turns ${t} and walks ${legs[i][1]} km`); }
    const d = Math.hypot(X, Y), dir = compass(X, Y), total = legs.reduce((s, l) => s + l[1], 0);
    return textual(r, m, `${words.join(', then ')}. How far and in which direction is ${she} from the starting point?`, `${d} km ${dir}`, [`${total} km ${dir}`, `${d} km ${compass(-X, Y)}`, `${X0 + Y0} km ${dir}`, `${d} km ${compass(X, -Y)}`], j => `${d + j} km ${dir}`, {
      inputs: { start: legs[0][0], first: legs[0][1], legs: legs.slice(1).map((l, i) => ({ turn: turns[i + 1], km: l[1] })) },
      steps: [`Net movement: ${Math.abs(Y)} km ${Y > 0 ? 'north' : 'south'} and ${Math.abs(X)} km ${X > 0 ? 'east' : 'west'}`, `Distance = √(${Math.abs(Y)}² + ${Math.abs(X)}²) = ${d} km, towards the ${dir}`],
      tip: 'Cancel opposite legs first (north against south, east against west), then use Pythagoras on what is left.' });
  };
  B['dir-facing'] = (r, m) => {
    const start = 2 * int(r, 0, 3), opts = { easy: [90, -90], medium: [90, -90, 180], hard: [45, -45, 135, -135, 90, -90] }[m.level], n = m.level === 'easy' ? int(r, 2, 3) : int(r, 3, 4);
    const turns = Array.from({ length: n }, () => pick(r, opts)), end = (start + turns.reduce((s, t) => s + t / 45, 0) % 8 + 16) % 8, mirror = (start - turns.reduce((s, t) => s + t / 45, 0) % 8 + 16) % 8;
    const word = t => t === 90 ? 'turns right' : t === -90 ? 'turns left' : t === 180 ? 'turns around' : `turns ${Math.abs(t)}° ${t > 0 ? 'clockwise' : 'anticlockwise'}`, name = pick(r, WOMEN);
    return textual(r, m, `${name} is facing ${DIR8[start]}. She ${turns.map(word).join(', then ')}. Which direction is she facing now?`, DIR8[end], [DIR8[mirror], DIR8[(end + 4) % 8], DIR8[start], DIR8[(end + 2) % 8]], j => DIR8[(end + j) % 8], {
      inputs: { start, turns }, steps: [`Count clockwise in 45° steps: ${turns.map(t => (t > 0 ? '+' : '') + t + '°').join(' ')} = ${turns.reduce((s, t) => s + t, 0)}°`, `${DIR8[start]} turned ${turns.reduce((s, t) => s + t, 0)}° → ${DIR8[end]}`],
      tip: 'Right = clockwise = +90°, left = −90°. Add all the turns first, then rotate once.' });
  };

  /* Seating: build an arrangement, then add true clues until a brute-force search leaves exactly one. */
  const PERMS = {};
  function perms(n) {
    if (PERMS[n]) return PERMS[n];
    const out = [], a = Array.from({ length: n }, (_, i) => i);
    (function go(k) { if (k === n) { out.push(a.slice()); return; } for (let i = k; i < n; i++) { [a[k], a[i]] = [a[i], a[k]]; go(k + 1); [a[k], a[i]] = [a[i], a[k]]; } })(0);
    return (PERMS[n] = out);
  }
  function holds(c, p, n) {
    switch (c.t) {
      case 'end': return p[c.a] === 0 || p[c.a] === n - 1;
      case 'not-end': return p[c.a] !== 0 && p[c.a] !== n - 1;
      case 'left': return p[c.a] === p[c.b] - 1;
      case 'right': return p[c.a] === p[c.b] + 1;
      case 'second-right': return p[c.a] === p[c.b] + 2;
      case 'gap': return Math.abs(p[c.a] - p[c.b]) === c.k + 1;
      case 'between': return Math.abs(p[c.b] - p[c.c]) === 2 && p[c.a] * 2 === p[c.b] + p[c.c];
      case 'position': return p[c.a] === c.p - 1;
      case 'not-next': return Math.abs(p[c.a] - p[c.b]) !== 1;
    }
  }
  const SEAT_NAMES = ['Aarav', 'Bhavna', 'Chirag', 'Diya', 'Eshan', 'Farah', 'Gaurav', 'Harini', 'Imran', 'Jaya', 'Kunal', 'Lavanya', 'Manav', 'Nisha', 'Omkar', 'Pooja', 'Rohan', 'Sneha', 'Tanvi', 'Varun'];
  function clueText(c, N) {
    const a = N[c.a], b = N[c.b], k = c.k;
    return { end: `${a} sits at one of the ends.`, 'not-end': `${a} does not sit at either end.`, left: `${a} sits immediately to the left of ${b}.`, right: `${a} sits immediately to the right of ${b}.`,
      'second-right': `${a} sits second to the right of ${b}.`, gap: `Exactly ${k} ${k === 1 ? 'person sits' : 'people sit'} between ${a} and ${b}.`, between: `${a} sits between ${b} and ${N[c.c]}, next to both.`,
      position: `${a} sits ${ordinal(c.p)} from the left end.`, 'not-next': `${a} does not sit next to ${b}.` }[c.t];
  }
  B['seating'] = (r, m) => {
    const n = { easy: 5, medium: 6, hard: 7 }[m.level], names = shuffle(r, SEAT_NAMES).slice(0, n).sort(), order = shuffle(r, names.map((_, i) => i)), P = [];
    order.forEach((person, pos) => { P[person] = pos; });
    const pool = [];
    for (let a = 0; a < n; a++) {
      pool.push(P[a] === 0 || P[a] === n - 1 ? { t: 'end', a } : { t: 'not-end', a }, { t: 'position', a, p: P[a] + 1 });
      for (let b = 0; b < n; b++) {
        if (a === b) continue;
        if (P[a] === P[b] - 1) pool.push({ t: 'left', a, b }); if (P[a] === P[b] + 1) pool.push({ t: 'right', a, b }); if (P[a] === P[b] + 2) pool.push({ t: 'second-right', a, b });
        if (a < b && Math.abs(P[a] - P[b]) > 1) pool.push({ t: 'gap', a, b, k: Math.abs(P[a] - P[b]) - 1 }, { t: 'not-next', a, b });
        for (let c = b + 1; c < n; c++) if (c !== a && Math.abs(P[b] - P[c]) === 2 && P[a] * 2 === P[b] + P[c]) pool.push({ t: 'between', a, b, c });
      }
    }
    const late = m.level === 'easy' ? [] : ['position', 'end'], ordered = shuffle(r, pool).sort((x, y) => late.includes(x.t) - late.includes(y.t));
    let cands = perms(n), clues = [];
    for (const c of ordered) { const next = cands.filter(p => holds(c, p, n)); if (next.length < cands.length) { clues.push(c); cands = next; } if (cands.length === 1) break; }
    for (const c of shuffle(r, clues)) { const rest = clues.filter(x => x !== c); if (perms(n).filter(p => rest.every(x => holds(x, p, n))).length === 1) clues = rest; }
    clues = shuffle(r, clues);
    const at = i => order[i], given = (t, a, b) => clues.some(c => c.t === t && c.a === a && c.b === b);
    const asks = shuffle(r, [
      ...(n % 2 ? [{ t: 'middle' }] : []), { t: 'end', side: 'left' }, { t: 'end', side: 'right' },
      ...order.slice(0, n - 1).map((b, i) => ({ t: 'right-of', b, i })), ...order.slice(1).map((b, i) => ({ t: 'left-of', b, i: i + 1 })), { t: 'nth', p: int(r, 2, n - 1) }
    ]).filter(q => !(q.t === 'right-of' && (given('left', q.b, at(q.i + 1)) || given('right', at(q.i + 1), q.b))) && !(q.t === 'left-of' && (given('right', q.b, at(q.i - 1)) || given('left', at(q.i - 1), q.b))));
    const q = asks.find(x => !clues.some(c => c.t === 'position' && ((x.t === 'middle' && c.p === (n + 1) / 2) || (x.t === 'end' && c.p === (x.side === 'left' ? 1 : n)) || (x.t === 'nth' && c.p === n - x.p + 1)))) || asks[0];
    let ans, wrong, question;
    if (q.t === 'middle') { const i = (n - 1) / 2; ans = at(i); wrong = [at(i - 1), at(i + 1)]; question = 'Who sits in the middle of the row?'; }
    else if (q.t === 'end') { const i = q.side === 'left' ? 0 : n - 1; ans = at(i); wrong = [at(n - 1 - i), at(q.side === 'left' ? 1 : n - 2)]; question = `Who sits at the extreme ${q.side} end?`; }
    else if (q.t === 'right-of') { ans = at(q.i + 1); wrong = [q.i > 0 ? at(q.i - 1) : at(q.i + 2), q.i + 2 < n ? at(q.i + 2) : null].filter(x => x != null); question = `Who sits immediately to the right of ${names[q.b]}?`; }
    else if (q.t === 'left-of') { ans = at(q.i - 1); wrong = [q.i < n - 1 ? at(q.i + 1) : at(q.i - 2), q.i >= 2 ? at(q.i - 2) : null].filter(x => x != null); question = `Who sits immediately to the left of ${names[q.b]}?`; }
    else { ans = at(n - q.p); wrong = [at(q.p - 1), at(n - q.p - 1 >= 0 ? n - q.p - 1 : n - q.p + 1)]; question = `Who sits ${ordinal(q.p)} from the right end?`; }
    const words = ['', '', '', '', '', 'Five', 'Six', 'Seven'];
    const prompt = `${words[n]} friends — ${names.join(', ')} — sit in a row facing north.\n${clues.map(c => '• ' + clueText(c, names)).join('\n')}\n${question}`;
    return textual(r, m, prompt, names[ans], wrong.map(i => names[i]), j => names[order[j % n]], {
      inputs: { names, clues, ask: q }, steps: [`Start with the most fixed clues and test the rest. Only one order works (left to right): ${order.map(i => names[i]).join(', ')}.`, `So the answer is ${names[ans]}.`],
      tip: 'Facing north, their right is your right as you look at the row from behind. Place exact positions and ends first.' });
  };

  /* Syllogisms: validity is decided by checking every Venn diagram consistent with the statements. */
  const MODELS = {};
  function models(k) {
    if (MODELS[k]) return MODELS[k];
    const regions = (1 << k) - 1, out = [];
    for (let mask = 1; mask < (1 << regions); mask++) {
      const occ = []; for (let i = 0; i < regions; i++) if (mask & (1 << i)) occ.push(i + 1);
      let all = true; for (let t = 0; t < k && all; t++) all = occ.some(x => x & (1 << t));
      if (all) out.push(occ);
    }
    return (MODELS[k] = out);
  }
  function truth(s, occ) {
    const A = 1 << s.a, Bm = 1 << s.b;
    if (s.t === 'A') return occ.every(x => !(x & A) || (x & Bm));
    if (s.t === 'E') return occ.every(x => !((x & A) && (x & Bm)));
    if (s.t === 'I') return occ.some(x => (x & A) && (x & Bm));
    return occ.some(x => (x & A) && !(x & Bm));
  }
  const SYL_TERMS = [['doctors', 'singers', 'teachers', 'writers'], ['pens', 'pencils', 'erasers', 'markers'], ['mangoes', 'apples', 'bananas', 'grapes'], ['cars', 'buses', 'trucks', 'bikes'], ['books', 'files', 'folders', 'notebooks'], ['rivers', 'lakes', 'ponds', 'wells'], ['chairs', 'tables', 'desks', 'stools']];
  const sentence = (s, T) => ({ A: `All ${T[s.a]} are ${T[s.b]}.`, E: `No ${T[s.a]} are ${T[s.b]}.`, I: `Some ${T[s.a]} are ${T[s.b]}.`, O: `Some ${T[s.a]} are not ${T[s.b]}.` })[s.t];
  const SYL_OPTIONS = ['Only conclusion I follows', 'Only conclusion II follows', 'Both I and II follow', 'Neither I nor II follows'];
  const clash = (x, y) => (x.a === y.a && x.b === y.b && [x.t, y.t].sort().join('') === 'AO') || ([x.t, y.t].sort().join('') === 'EI' && ((x.a === y.a && x.b === y.b) || (x.a === y.b && x.b === y.a)));
  B['syllogism'] = (r, m) => {
    for (;;) {
      const k = m.level === 'hard' ? 4 : 3, T = shuffle(r, pick(r, SYL_TERMS)).slice(0, k), types = m.level === 'easy' ? ['A', 'A', 'I', 'E'] : ['A', 'I', 'E', 'O'];
      const premises = []; for (let i = 0; i < k - 1; i++) { const t = pick(r, types), flip = (t === 'I' || t === 'E') && r() < 0.5; premises.push({ t, a: flip ? i + 1 : i, b: flip ? i : i + 1 }); }
      const live = models(k).filter(o => premises.every(s => truth(s, o)));
      if (!live.length) continue;
      const cands = []; for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) if (a !== b) for (const t of 'AEIO') if (!premises.some(p => p.t === t && p.a === a && p.b === b)) cands.push({ t, a, b, ok: live.every(o => truth({ t, a, b }, o)) });
      const good = shuffle(r, cands.filter(c => c.ok)), bad = shuffle(r, cands.filter(c => !c.ok)), want = pick(r, [0, 1, 2, 3]);
      const pair = [[good, bad], [bad, good], [good, good], [bad, bad]][want], c1 = pair[0][0], c2 = c1 && pair[1].find(c => c !== c1 && !clash(c, c1));
      if (!c1 || !c2) continue;
      const answer = c1.ok && c2.ok ? 2 : c1.ok ? 0 : c2.ok ? 1 : 3, why = c => c.ok ? `“${sentence(c, T).slice(0, -1)}” is true in every diagram that fits the statements, so it follows.`
        : `“${sentence(c, T).slice(0, -1)}” does not follow: a valid diagram exists where ${({ A: `some ${T[c.a]} are not ${T[c.b]}`, E: `some ${T[c.a]} are ${T[c.b]}`, I: `no ${T[c.a]} are ${T[c.b]}`, O: `all ${T[c.a]} are ${T[c.b]}` })[c.t]}.`;
      const prompt = `Statements: ${premises.map(s => sentence(s, T)).join(' ')}\nConclusions:\nI. ${sentence(c1, T)}\nII. ${sentence(c2, T)}\nWhich conclusion(s) follow from the statements?`;
      return make(m, prompt, { options: SYL_OPTIONS.slice(), answer, display: SYL_OPTIONS[answer] }, {
        inputs: { k, terms: T, premises, conclusions: [{ t: c1.t, a: c1.a, b: c1.b }, { t: c2.t, a: c2.a, b: c2.b }] }, steps: [`I: ${why(c1)}`, `II: ${why(c2)}`],
        tip: '“Some” statements can be reversed; “All” statements cannot. Two “some” premises never give a definite conclusion.' });
    }
  };

  const ODD_PRIMES = [23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139];
  const LOOKS_PRIME = [51, 57, 87, 91, 119, 133, 143, 161, 187, 203, 209, 217, 221, 247, 253];
  const isPrime = n => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
  B['odd-number'] = (r, m) => {
    const kind = pick(r, { easy: ['square', 'multiple'], medium: ['prime', 'square', 'multiple'], hard: ['prime', 'cube', 'multiple'] }[m.level]);
    let members, odd, prop, factorText, k = 0;
    if (kind === 'prime') { members = shuffle(r, ODD_PRIMES).slice(0, 3); odd = pick(r, LOOKS_PRIME); prop = 'prime'; const f = [...Array(odd).keys()].find(i => i > 1 && odd % i === 0); factorText = `${odd} = ${f} × ${odd / f}`; }
    else if (kind === 'square') { const roots = shuffle(r, Array.from({ length: 17 }, (_, i) => i + 4)).slice(0, 4); members = roots.slice(0, 3).map(x => x * x); odd = roots[3] ** 2 + pick(r, [1, -1, 2]); prop = 'a perfect square'; factorText = `${odd} lies between ${Math.floor(Math.sqrt(odd))}² and ${Math.ceil(Math.sqrt(odd))}²`; }
    else if (kind === 'cube') { const roots = shuffle(r, [2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4); members = roots.slice(0, 3).map(x => x ** 3); odd = roots[3] ** 3 + pick(r, [1, -1]); prop = 'a perfect cube'; factorText = `${odd} is not a cube (${roots[3]}³ = ${roots[3] ** 3})`; }
    else { k = pick(r, m.level === 'easy' ? [6, 7, 9] : [7, 11, 13, 17]); const mult = shuffle(r, Array.from({ length: 14 }, (_, i) => i + 3)).slice(0, 4); members = mult.slice(0, 3).map(x => x * k); odd = mult[3] * k + pick(r, [1, -1, 2]); prop = `a multiple of ${k}`; factorText = `${odd} ÷ ${k} leaves remainder ${((odd % k) + k) % k}`; }
    const shown = shuffle(r, [...members, odd].map(String));
    return make(m, 'Which number is the odd one out?', { options: shown, answer: shown.indexOf(String(odd)), display: String(odd) }, {
      inputs: { kind, k, nums: shown.map(Number) }, steps: [`${members.join(', ')} are each ${prop}.`, `${factorText}, so ${odd} is the odd one out.`],
      tip: kind === 'prime' ? 'Numbers like 51, 91 and 221 look prime but are 3 × 17, 7 × 13 and 13 × 17. Test divisors up to the square root.' : 'Look for one property that three numbers share; check the fourth against it.' });
  };
  B['odd-letters'] = (r, m) => {
    const [s1, s2] = m.level === 'hard' ? pick(r, [[1, 2], [2, 1], [2, 3], [3, 2], [1, 3]]) : m.level === 'medium' ? (x => [x, x])(pick(r, [2, 3])) : (x => [x, x])(pick(r, [1, 2]));
    const starts = shuffle(r, Array.from({ length: 26 - s1 - s2 }, (_, i) => i)).slice(0, 4), grp = (x, d = 0) => L(x) + L(x + s1) + L(x + s1 + s2 + d);
    const oddAt = int(r, 0, 3), oddStart = starts[oddAt], d = oddStart + s1 + s2 + 1 <= 25 ? 1 : -1;
    const groups = starts.map((x, i) => i === oddAt ? grp(x, d) : grp(x));
    return make(m, 'Which letter group is the odd one out?', { options: groups, answer: oddAt, display: groups[oddAt] }, {
      inputs: { s1, s2, groups }, steps: [`In the others, the gaps are +${s1} and +${s2} (e.g. ${groups[(oddAt + 1) % 4]}).`, `${groups[oddAt]} has gaps +${s1} and +${s2 + d}, so it is the odd one out.`],
      tip: 'Write the alphabet positions and compare the gaps, not the letters.' });
  };

  /* ---------- Verbal (authored bank) ---------- */
  function bank() {
    if (root && root.APTITUDE_VERBAL) return root.APTITUDE_VERBAL;
    if (typeof require === 'function') { try { return require('../content/aptitude-verbal.js'); } catch { /* not available */ } }
    return { ITEMS: [], PASSAGES: [] };
  }
  function fromItem(item, topic, passage) {
    return { id: item.id, section: 'verbal', topic, kind: topic, level: passage ? passage.level : item.level, prompt: item.prompt, options: item.options.slice(), answer: item.answer, display: item.options[item.answer],
      value: null, inputs: {}, solution: [item.explanation], shortcut: item.tip || topicOf(topic).tip, chart: null, table: null, passage: passage ? { id: passage.id, title: passage.title, text: passage.text } : null };
  }
  function verbalPool(topic, level, r) {
    const b = bank();
    if (topic === 'reading') return shuffle(r, b.PASSAGES).sort((x, y) => (y.level === level) - (x.level === level));
    return shuffle(r, b.ITEMS.filter(i => i.topic === topic)).sort((x, y) => (y.level === level) - (x.level === level));
  }

  /* ---------- Topic → question kinds by level ---------- */
  const KINDS = {
    percent: { easy: ['pct-of', 'pct-successive', 'pct-reverse'], medium: ['pct-successive', 'pct-reverse', 'pct-compound', 'pct-of'], hard: ['pct-compound', 'pct-reverse', 'pct-successive', 'pct-of'] },
    profit: { easy: ['pl-percent', 'pl-cp'], medium: ['pl-markup', 'pl-cp', 'pl-percent'], hard: ['pl-target', 'pl-weight', 'pl-markup'] },
    interest: { easy: ['si'], medium: ['si-rate', 'ci', 'si'], hard: ['ci', 'ci-si-diff', 'si-rate'] },
    ratio: { easy: ['ratio-share', 'prop-direct'], medium: ['ratio-chain', 'prop-inverse', 'ratio-share'], hard: ['ratio-age', 'ratio-chain', 'prop-inverse'] },
    average: { easy: ['avg-add'], medium: ['avg-replace', 'alligation', 'avg-add'], hard: ['alligation-qty', 'avg-replace', 'alligation'] },
    work: { easy: ['work-together', 'work-wages'], medium: ['work-together', 'work-leave', 'work-wages'], hard: ['work-three', 'work-leave', 'work-efficiency'] },
    pipes: { easy: ['pipes-net'], medium: ['pipes-net', 'pipes-leak'], hard: ['pipes-three', 'pipes-leak'] },
    speed: { easy: ['train-pole', 'avg-speed'], medium: ['train-platform', 'train-cross', 'avg-speed', 'boat'], hard: ['train-cross', 'boat', 'avg-speed'] },
    number: { easy: ['lcm-bells', 'divisible', 'remainder-divisor'], medium: ['hcf-lcm', 'divisible', 'unit-digit', 'lcm-bells'], hard: ['remainder-power', 'unit-digit', 'divisible', 'hcf-lcm'] },
    pnc: { easy: ['pnc-word', 'pnc-handshake'], medium: ['pnc-committee', 'pnc-circle', 'pnc-word'], hard: ['pnc-atleast', 'pnc-together', 'pnc-vowels', 'pnc-word'] },
    probability: { easy: ['prob-dice', 'prob-coins', 'prob-balls'], medium: ['prob-cards', 'prob-balls', 'prob-dice', 'prob-coins'], hard: ['prob-balls', 'prob-cards', 'prob-dice'] },
    di: { easy: ['di-average', 'di-share'], medium: ['di-growth', 'di-share', 'di-average'], hard: ['di-change', 'di-growth', 'di-share'] },
    series: { easy: ['series-number', 'series-letter'], medium: ['series-number', 'series-letter'], hard: ['series-number', 'series-letter'] },
    coding: { easy: ['code-shift', 'code-sum'], medium: ['code-shift', 'code-sum'], hard: ['code-shift', 'code-sum'] },
    blood: { easy: ['blood'], medium: ['blood'], hard: ['blood'] },
    direction: { easy: ['dir-distance', 'dir-facing'], medium: ['dir-distance', 'dir-facing'], hard: ['dir-distance', 'dir-facing'] },
    seating: { easy: ['seating'], medium: ['seating'], hard: ['seating'] },
    syllogism: { easy: ['syllogism'], medium: ['syllogism'], hard: ['syllogism'] },
    odd: { easy: ['odd-number', 'odd-letters'], medium: ['odd-number', 'odd-letters'], hard: ['odd-number', 'odd-letters'] }
  };
  const levelId = l => LEVEL_IDS.includes(l) ? l : 'medium';

  function generate(topic, level, rand, kind) {
    if (!topicOf(topic)) throw new Error('Unknown topic: ' + topic);
    level = levelId(level);
    if (VERBAL.includes(topic)) {
      const pool = verbalPool(topic, level, rand); if (!pool.length) throw new Error('No verbal questions for ' + topic);
      if (topic === 'reading') { const p = pool[0], q = pick(rand, p.questions); return fromItem(q, topic, p); }
      return fromItem(pool[0], topic);
    }
    kind = kind || pick(rand, KINDS[topic][level]);
    if (!B[kind]) throw new Error('Unknown kind: ' + kind);
    return B[kind](rand, { topic, kind, level });
  }

  /* A set of questions for the chosen topics, balanced across them. Reading passages bring all their questions together. */
  function buildSet({ topics = [], level = 'medium', count = 10, seed = Date.now() } = {}) {
    const chosen = topics.filter(t => topicOf(t));
    if (!chosen.length) throw new Error('Choose at least one topic.');
    const rand = rng(seed), order = shuffle(rand, chosen), seen = new Set(), out = [], pools = {};
    for (let i = 0; out.length < count; i++) {
      const topic = order[i % order.length], lv = level === 'mixed' ? pick(rand, LEVEL_IDS) : levelId(level);
      if (VERBAL.includes(topic)) {
        if (!pools[topic] || !pools[topic].length) pools[topic] = verbalPool(topic, lv, rand);
        if (!pools[topic].length) throw new Error('No verbal questions for ' + topic);
        const item = pools[topic].shift();
        if (topic === 'reading') for (const q of item.questions.slice(0, count - out.length)) out.push(fromItem(q, topic, item));
        else out.push(fromItem(item, topic));
        continue;
      }
      let q;
      for (let tries = 0; tries < 12; tries++) { q = generate(topic, lv, rand); if (!seen.has(q.prompt + JSON.stringify(q.chart || q.table))) break; }
      seen.add(q.prompt + JSON.stringify(q.chart || q.table)); out.push(q);
    }
    return out;
  }
  /* A placement-style test: sections in the usual order, each with `perSection` questions. */
  function buildTest({ sections = ['quant', 'logical', 'verbal'], perSection = 10, level = 'mixed', seed = Date.now() } = {}) {
    const chosen = SECTIONS.map(s => s.id).filter(s => sections.includes(s));
    if (!chosen.length) throw new Error('Choose at least one section.');
    return chosen.flatMap((s, i) => buildSet({ topics: TOPICS.filter(t => t.section === s).map(t => t.id), level, count: perSection, seed: (Number(seed) + i * 7919) >>> 0 }));
  }

  /* Marks: +1 for a correct answer, −negative for a wrong one, 0 when unanswered. */
  function score(questions, answers, negative = 0) {
    let correct = 0, wrong = 0, unanswered = 0;
    questions.forEach((q, i) => { const a = answers[i]; if (a == null) unanswered++; else if (a === q.answer) correct++; else wrong++; });
    return { correct, wrong, unanswered, attempted: correct + wrong, total: questions.length, negative, score: round(correct - wrong * negative, 2), accuracy: correct + wrong ? correct / (correct + wrong) : null };
  }

  const median = list => { if (!list.length) return null; const s = list.slice().sort((a, b) => a - b), h = Math.floor(s.length / 2); return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
  /* Per-topic accuracy over the most recent `window` answered questions of each topic. */
  function summarise(history, window = 30) {
    const by = Object.fromEntries(TOPIC_IDS.map(t => [t, []]));
    for (const h of (history || []).slice().sort((a, b) => (a.at || 0) - (b.at || 0))) for (const x of h.results || []) if (by[x.topic] && x.answered) by[x.topic].push(x);
    return TOPICS.map(t => { const recent = by[t.id].slice(-window), correct = recent.filter(x => x.ok).length;
      return { topic: t.id, section: t.section, title: t.title, attempts: recent.length, correct, accuracy: recent.length ? correct / recent.length : null, medianSeconds: median(recent.filter(x => Number.isFinite(x.seconds)).map(x => x.seconds)) }; });
  }
  function weakest(stats, minAttempts = 4) {
    const ranked = stats.filter(s => s.attempts >= minAttempts).sort((a, b) => a.accuracy - b.accuracy || (b.medianSeconds ?? 0) - (a.medianSeconds ?? 0));
    return ranked.length && ranked[0].accuracy < 1 ? ranked[0] : null;
  }

  const api = { LEVELS, LEVEL_IDS, SECTIONS, TOPICS, TOPIC_IDS, KINDS, topicOf, rng, generate, buildSet, buildTest, score, summarise, weakest, median, fmt, bank, relationOf, holds, perms };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AptitudeQuestions = api;
})(this);
