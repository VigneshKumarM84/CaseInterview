/* Case maths drill: deterministic question generators. No DOM access, so Node tests load this file directly.
   Every question carries its inputs, exact answer, accepted tolerance, worked steps and a mental-maths tip. */
(function (root) {
  const SKILLS = [
    { id: 'percent', title: 'Percentages', short: '% of, share of total', tip: 'Split awkward percentages into easy ones: 35% = 25% + 10%; 17.5% = 10% + 5% + 2.5%.' },
    { id: 'change', title: 'Growth & decline', short: '% change, reverse %, points vs %', tip: 'Percentage change is always measured against the starting value. A 20% fall needs a 25% rise to recover.' },
    { id: 'margin', title: 'Profit & margin', short: 'Margins, contribution, markup', tip: 'Margin divides by price; markup divides by cost. Write the denominator down before you calculate.' },
    { id: 'breakeven', title: 'Break-even & payback', short: 'Units, price, payback years', tip: 'Break-even volume = fixed costs ÷ contribution per unit. Find the contribution first.' },
    { id: 'units', title: 'Units & scaling', short: 'Lakh, crore, million, per-unit', tip: '1 lakh = 100 thousand; 1 crore = 10 million; 100 crore = 1 billion. Convert once, then calculate.' },
    { id: 'growth', title: 'Compounding & CAGR', short: 'Compound growth, doubling, CAGR', tip: 'Rule of 72: doubling time ≈ 72 ÷ growth rate. For two years, (1 + g)² ≈ 1 + 2g + g².' },
    { id: 'npv', title: 'Present value & NPV', short: 'Discounting, perpetuities, NPV', tip: 'Value of a perpetuity = annual cash flow ÷ discount rate. NPV subtracts the upfront investment.' },
    { id: 'estimate', title: 'Quick estimates', short: 'Round, multiply, divide', tip: 'Round to two significant figures, move one number up and the other down, and track zeros separately.' },
    { id: 'exhibit', title: 'Chart reading', short: 'Shares and growth from an exhibit', tip: 'Read the title, units and years before the bars. Compare growth in %, not in absolute change.' }
  ];
  const LEVELS = [
    { id: 'foundation', title: 'Foundation', note: 'Round numbers, one step' },
    { id: 'interview', title: 'Interview', note: 'Realistic case numbers' },
    { id: 'stretch', title: 'Stretch', note: 'Awkward numbers, more steps' }
  ];
  const SKILL_IDS = SKILLS.map(s => s.id);

  function rng(seed) {
    let a = (Number(seed) >>> 0) || 1;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (r, list) => list[Math.floor(r() * list.length)];
  const byLevel = (level, options) => options[Math.max(0, LEVELS.findIndex(l => l.id === level))];
  const round = (x, dp = 6) => Math.round(x * 10 ** dp) / 10 ** dp;
  function fmt(n, dp = 2) {
    if (!Number.isFinite(n)) return String(n);
    return Number(n.toFixed(dp)).toLocaleString('en-IN', { maximumFractionDigits: dp });
  }
  /* Rounds a to two significant figures, then rounds b up or down, whichever keeps op(a, b) closest to exact. */
  function roundPair(a, b, op) {
    const ra = sig(a), p = 10 ** (Math.floor(Math.log10(b)) - 1), lo = Math.floor(b / p) * p, hi = Math.ceil(b / p) * p;
    const rb = Math.abs(op(ra, lo) - op(a, b)) <= Math.abs(op(ra, hi) - op(a, b)) ? lo : hi;
    return [ra, round(rb, 6)];
  }
  const sig = (x, n = 2) => { if (!x) return 0; const p = Math.floor(Math.log10(Math.abs(x))) - n + 1; return round(Math.round(x / 10 ** p) * 10 ** p, 6); };

  /* Formats a value in its unit: ₹70, ₹3.5 crore, 12.5%, 4 years. */
  function show(value, unit, dp = 2) {
    const n = fmt(value, dp);
    if (unit === '₹') return '₹' + n;
    if (unit.startsWith('₹ ')) return '₹' + n + unit.slice(1);
    if (unit === '%') return n + '%';
    return unit ? n + ' ' + unit : n;
  }
  function num(skill, kind, prompt, answer, o) {
    const rel = o.rel ?? 0.005, abs = o.abs ?? 0, tolerance = Math.max(rel * Math.abs(answer), abs);
    const label = o.label || (rel >= 0.02 ? `Within ±${rel * 100}% — round freely`
      : o.unit === '%' ? `Within ±${fmt(tolerance, 2)} percentage points`
      : tolerance > rel * Math.abs(answer) ? ((o.dp ?? 2) === 0 ? 'To the nearest whole number' : `Within ±${show(abs, o.unit || '')}`)
      : `Within ±${round(rel * 100, 2)}% of the exact answer`);
    return {
      skill, kind, type: 'number', prompt, inputs: o.inputs, answer: round(answer),
      display: o.display || show(answer, o.unit || '', o.dp ?? 2),
      unit: o.unit || '', tolerance, toleranceLabel: label,
      steps: o.steps, tip: o.tip, chart: o.chart || null, spoken: o.spoken || prompt
    };
  }

  const G = {
    percent(r, level) {
      if (r() < 0.55) {
        const p = pick(r, byLevel(level, [[5, 10, 20, 25, 50], [8, 12, 15, 35, 45, 65], [4.5, 12.5, 17.5, 22, 37.5, 83]]));
        const base = byLevel(level, [100 * int(r, 2, 60), 40 * int(r, 6, 240), 8 * int(r, 30, 1200)]);
        const ans = p * base / 100;
        return num('percent', 'percent-of', `What is ${fmt(p)}% of ${fmt(base)}?`, ans, { inputs: { p, base }, dp: 2,
          steps: [`${fmt(p)}% = ${fmt(p / 100, 4)}`, `${fmt(p / 100, 4)} × ${fmt(base)} = ${fmt(ans)}`],
          tip: 'Build it from 10%, 5% and 1%: 10% of ' + fmt(base) + ' is ' + fmt(base / 10) + '.' });
      }
      const total = byLevel(level, [pick(r, [200, 400, 500, 800, 1000]), 20 * int(r, 15, 120), int(r, 180, 2400)]);
      let part = byLevel(level, [total * 5 * int(r, 1, 14) / 100, Math.round(total * int(r, 3, 60) / 100), Math.round(total * (int(r, 30, 650) / 10) / 100)]);
      part = Math.max(1, part);
      const ans = part / total * 100;
      return num('percent', 'share', `A product line earns ₹${fmt(part)} crore of a company’s ₹${fmt(total)} crore revenue. What share of revenue is that?`, ans, { inputs: { part, total }, unit: '%', dp: 1, abs: 0.1,
        steps: [`Share = part ÷ total = ${fmt(part)} ÷ ${fmt(total)}`, `= ${fmt(ans / 100, 4)} = ${fmt(ans, 1)}%`],
        tip: 'Find a friendly benchmark first: 10% of ' + fmt(total) + ' is ' + fmt(total / 10, 1) + '.' });
    },
    change(r, level) {
      const v = r();
      if (v < 0.4) {
        let old, now;
        if (level === 'foundation') { old = pick(r, [200, 400, 500, 800, 1000]); now = old * (1 + pick(r, [-50, -40, -25, -20, -10, 10, 15, 20, 25, 40, 50]) / 100); }
        else if (level === 'interview') { old = 20 * int(r, 6, 100); now = Math.round(old * (1 + pick(r, [-1, 1]) * int(r, 4, 45) / 100)); }
        else { old = int(r, 110, 990); now = Math.round(old * (1 + (int(r, -45, 65) || 7) / 100)); }
        const ans = (now - old) / old * 100;
        return num('change', 'pct-change', `Revenue moved from ₹${fmt(old)} crore to ₹${fmt(now)} crore. What is the percentage change? (Use a minus sign for a decline.)`, ans, { inputs: { old, now }, unit: '%', dp: 1, abs: 0.1,
          steps: [`Change = ${fmt(now)} − ${fmt(old)} = ${fmt(now - old)}`, `% change = ${fmt(now - old)} ÷ ${fmt(old)} = ${fmt(ans, 1)}%`],
          tip: 'Divide the change by the starting value, not the ending value.' });
      }
      if (v < 0.75) {
        const p = pick(r, byLevel(level, [[10, 20, 25, 50], [15, 20, 30, 40, 12], [12.5, 35, 37.5, 8, 44]]));
        const up = level === 'stretch' && r() < 0.4;
        const before = byLevel(level, [100 * int(r, 4, 60), 200 * int(r, 3, 60), 400 * int(r, 3, 50)]);
        const after = round(before * (up ? 1 + p / 100 : 1 - p / 100));
        return num('change', 'reverse', `After a ${fmt(p)}% ${up ? 'increase' : 'decline'}, monthly orders are ${fmt(after)}. How many orders were there before the ${up ? 'increase' : 'decline'}?`, before, { inputs: { p, after, up }, dp: 0, rel: 0.002, abs: 0.5,
          steps: [`After = before × (1 ${up ? '+' : '−'} ${fmt(p / 100, 3)})`, `Before = ${fmt(after)} ÷ ${fmt(up ? 1 + p / 100 : 1 - p / 100, 3)} = ${fmt(before)}`],
          tip: `Do not simply ${up ? 'subtract' : 'add'} ${fmt(p)}% back: the percentage applied to a different base.` });
      }
      const a = pick(r, byLevel(level, [[10, 20, 25, 40, 50], [8, 12, 15, 16, 20, 24], [6, 9, 14, 18, 22, 35]]));
      const b = a + pick(r, byLevel(level, [[5, 10], [2, 3, 4, 6], [1.5, 2.5, 3.5, 4, 7]]));
      const ans = (b - a) / a * 100;
      return num('change', 'pp-vs-pct', `Operating margin rose from ${fmt(a)}% to ${fmt(b)}%. By what percentage did the margin itself increase?`, ans, { inputs: { a, b }, unit: '%', dp: 1, abs: 0.1,
        steps: [`The change is ${fmt(b - a)} percentage points`, `Relative increase = ${fmt(b - a)} ÷ ${fmt(a)} = ${fmt(ans, 1)}%`],
        tip: 'Percentage points measure the gap between two rates; percent measures that gap relative to the starting rate.' });
    },
    margin(r, level) {
      const v = r();
      if (v < 0.3) {
        const R = byLevel(level, [pick(r, [100, 200, 400, 500, 800]), 10 * int(r, 12, 150), int(r, 120, 1800)]);
        const C = byLevel(level, [R * int(r, 6, 19) * 5 / 100, Math.round(R * int(r, 55, 95) / 100), Math.round(R * int(r, 600, 970) / 1000)]);
        const ans = (R - C) / R * 100;
        return num('margin', 'margin-pct', `Revenue is ₹${fmt(R)} crore and total costs are ₹${fmt(C)} crore. What is the operating margin?`, ans, { inputs: { R, C }, unit: '%', dp: 1, abs: 0.1,
          steps: [`Profit = ${fmt(R)} − ${fmt(C)} = ${fmt(R - C)}`, `Margin = ${fmt(R - C)} ÷ ${fmt(R)} = ${fmt(ans, 1)}%`],
          tip: 'Margin is profit as a share of revenue.' });
      }
      if (v < 0.55) {
        const R = byLevel(level, [100 * int(r, 1, 20), 20 * int(r, 6, 100), int(r, 130, 2600)]);
        const m = pick(r, byLevel(level, [[10, 20, 25, 50], [8, 12, 15, 18, 22], [6.5, 11, 13.5, 17, 23]]));
        const ans = R * m / 100;
        return num('margin', 'profit-from-margin', `Revenue is ₹${fmt(R)} crore at an operating margin of ${fmt(m)}%. What is operating profit in ₹ crore?`, ans, { inputs: { R, m }, unit: '₹ crore', dp: 2,
          steps: [`Profit = revenue × margin`, `${fmt(R)} × ${fmt(m / 100, 3)} = ${fmt(ans)}`],
          tip: 'Multiply by the margin as a decimal, or take 10% and scale.' });
      }
      if (v < 0.8) {
        const P = byLevel(level, [pick(r, [100, 200, 250, 500]), 10 * int(r, 12, 80), int(r, 140, 960)]);
        const V = byLevel(level, [P * pick(r, [0.4, 0.5, 0.6]), 10 * Math.round(P * int(r, 40, 75) / 1000), Math.round(P * int(r, 35, 80) / 100)]);
        const N = byLevel(level, [1000 * pick(r, [5, 10, 20]), 1000 * int(r, 6, 40), 100 * int(r, 45, 380)]);
        const F = byLevel(level, [100000 * pick(r, [1, 2, 5]), 100000 * int(r, 2, 20), 1000 * int(r, 150, 4000)]);
        const ans = (P - V) * N - F;
        return num('margin', 'contribution', `A product sells for ₹${fmt(P)} with a variable cost of ₹${fmt(V)} per unit. Monthly volume is ${fmt(N)} units and monthly fixed costs are ₹${fmt(F)}. What is monthly profit in ₹? (Use a minus sign for a loss.)`, ans, { inputs: { P, V, N, F }, unit: '₹', dp: 0, rel: 0.002, abs: 1,
          steps: [`Contribution per unit = ${fmt(P)} − ${fmt(V)} = ₹${fmt(P - V)}`, `Total contribution = ${fmt(P - V)} × ${fmt(N)} = ₹${fmt((P - V) * N)}`, `Profit = ${fmt((P - V) * N)} − ${fmt(F)} = ₹${fmt(ans)}`],
          tip: 'Work per unit first, then scale by volume, then subtract fixed costs.' });
      }
      const M = pick(r, byLevel(level, [[25, 50, 100], [20, 25, 40, 60, 100], [15, 30, 35, 45, 80]]));
      const ans = M / (100 + M) * 100;
      return num('margin', 'markup', `A retailer prices goods at a ${fmt(M)}% markup on cost. What is the gross margin as a percentage of the selling price?`, ans, { inputs: { M }, unit: '%', dp: 1, abs: 0.1,
        steps: [`Take cost = 100. Price = 100 + ${fmt(M)} = ${fmt(100 + M)}`, `Margin = ${fmt(M)} ÷ ${fmt(100 + M)} = ${fmt(ans, 1)}%`],
        tip: 'Assume a cost of 100 to turn a relative question into concrete numbers.' });
    },
    breakeven(r, level) {
      const v = r();
      if (v < 0.4) {
        const c = byLevel(level, [pick(r, [50, 100, 200, 250]), 10 * int(r, 4, 45), int(r, 35, 480)]);
        const units = byLevel(level, [1000 * pick(r, [2, 4, 5, 10]), 500 * int(r, 4, 60), 50 * int(r, 40, 900)]);
        const P = c + byLevel(level, [pick(r, [50, 100, 150]), 10 * int(r, 3, 40), int(r, 20, 420)]), V = P - c, F = c * units;
        return num('breakeven', 'be-units', `Fixed costs are ₹${fmt(F)} a year. Each unit sells for ₹${fmt(P)} and costs ₹${fmt(V)} to make. How many units must be sold to break even?`, units, { inputs: { F, P, V }, unit: 'units', dp: 0, rel: 0.002, abs: 0.5,
          steps: [`Contribution per unit = ${fmt(P)} − ${fmt(V)} = ₹${fmt(c)}`, `Break-even = ${fmt(F)} ÷ ${fmt(c)} = ${fmt(units)} units`],
          tip: 'Each unit contributes price minus variable cost towards fixed costs.' });
      }
      if (v < 0.7) {
        const S = byLevel(level, [pick(r, [2, 4, 5, 10]), int(r, 3, 24), int(r, 7, 46) / 2]);
        const I = byLevel(level, [S * pick(r, [2, 3, 4, 5]), S * int(r, 2, 9) + pick(r, [0, Math.round(S / 2)]), round(S * int(r, 15, 85) / 10, 1)]);
        const ans = I / S;
        return num('breakeven', 'payback', `A project costs ₹${fmt(I)} crore upfront and saves ₹${fmt(S)} crore a year. What is the simple payback period in years?`, ans, { inputs: { I, S }, unit: 'years', dp: 1, abs: 0.05,
          steps: [`Payback = investment ÷ annual saving`, `${fmt(I)} ÷ ${fmt(S)} = ${fmt(ans, 1)} years`],
          tip: 'Simple payback ignores the time value of money; mention that limitation in an interview.' });
      }
      const N = pick(r, byLevel(level, [[10000, 20000, 50000], [8000, 20000, 25000, 40000], [12000, 16000, 24000, 30000, 45000]]));
      const f = pick(r, byLevel(level, [[10, 20, 50], [15, 25, 40, 60], [12.5, 35, 45, 75]]));
      const Vc = byLevel(level, [pick(r, [50, 100, 150]), 5 * int(r, 10, 60), int(r, 45, 380)]);
      const F = f * N, ans = Vc + f;
      return num('breakeven', 'be-price', `Fixed costs are ₹${fmt(F / 100000, 2)} lakh a year and the variable cost is ₹${fmt(Vc)} per unit. At an expected volume of ${fmt(N)} units, what price per unit breaks even?`, ans, { inputs: { F, Vc, N }, unit: '₹', dp: 2, abs: 0.05,
        steps: [`Fixed cost = ₹${fmt(F / 100000, 2)} lakh = ₹${fmt(F)}`, `Fixed cost per unit = ${fmt(F)} ÷ ${fmt(N)} = ₹${fmt(f)}`, `Break-even price = ${fmt(Vc)} + ${fmt(f)} = ₹${fmt(ans)}`],
        tip: 'Spread fixed costs across expected volume, then add the variable cost.' });
    },
    units(r, level) {
      const v = r();
      if (v < 0.4) {
        const conv = pick(r, [
          ['million', 'lakh', 10], ['crore', 'million', 10], ['billion', 'crore', 100], ['lakh', 'million', 0.1], ['crore', 'billion', 0.01], ['crore', 'lakh', 100]
        ]);
        const x = byLevel(level, [pick(r, [2, 5, 10, 20, 50]), int(r, 12, 480) / (r() < 0.5 ? 1 : 10), int(r, 1200, 98000) / 100]);
        const ans = x * conv[2];
        return num('units', 'convert', `Convert ₹${fmt(x)} ${conv[0]} into ₹ ${conv[1]}.`, ans, { inputs: { x, from: conv[0], to: conv[1] }, unit: conv[1], dp: 4, rel: 0.001,
          steps: [`1 ${conv[0]} = ${fmt(conv[2], 2)} ${conv[1]}`, `${fmt(x)} × ${fmt(conv[2], 2)} = ${fmt(ans, 4)} ${conv[1]}`],
          tip: '1 lakh = 0.1 million; 1 crore = 10 million; 1 billion = 100 crore.' });
      }
      if (v < 0.75) {
        const N = pick(r, byLevel(level, [[5, 10, 20, 50], [12, 18, 25, 35, 48], [7.5, 13, 22, 37, 64]]));
        const S = pick(r, byLevel(level, [[100, 200, 500], [150, 250, 350, 400, 600], [120, 180, 275, 340, 725]]));
        const ans = N * 100000 * S * 12 / 10000000;
        return num('units', 'scale', `${fmt(N)} lakh households each spend ₹${fmt(S)} a month on a service. What is annual spending in ₹ crore?`, ans, { inputs: { N, S }, unit: '₹ crore', dp: 2,
          steps: [`Monthly = ${fmt(N)} lakh × ₹${fmt(S)} = ₹${fmt(N * S)} lakh`, `Annual = ${fmt(N * S)} × 12 = ₹${fmt(N * S * 12)} lakh`, `÷ 100 lakh per crore = ₹${fmt(ans)} crore`],
          tip: 'Keep the answer in lakh until the end, then divide by 100 for crore.' });
      }
      const Nm = pick(r, byLevel(level, [[2, 4, 5, 10], [1.5, 2.5, 4, 8, 12], [1.2, 3.5, 6.4, 7.5, 16]]));
      const per = byLevel(level, [pick(r, [100, 250, 500, 1000]), 10 * int(r, 12, 240), int(r, 140, 3400)]);
      const R = round(Nm * per / 10, 4);
      return num('units', 'per-unit', `A platform earns ₹${fmt(R, 4)} crore a year from ${fmt(Nm)} million customers. What is annual revenue per customer in ₹?`, per, { inputs: { R, Nm }, unit: '₹', dp: 0, rel: 0.003, abs: 0.5,
        steps: [`₹${fmt(R, 4)} crore = ₹${fmt(R * 10, 4)} million`, `₹${fmt(R * 10, 4)} million ÷ ${fmt(Nm)} million customers = ₹${fmt(per)}`],
        tip: 'Put the numerator and denominator in the same unit (millions) so the units cancel.' });
    },
    growth(r, level) {
      const v = r();
      if (v < 0.4) {
        const B = byLevel(level, [100 * pick(r, [1, 2, 5]), 10 * int(r, 8, 60), int(r, 110, 940)]);
        const g = pick(r, byLevel(level, [[10, 20], [5, 8, 10, 12, 15], [6, 7, 9, 14, 18]]));
        const Y = byLevel(level, [2, int(r, 2, 3), int(r, 3, 5)]);
        const ans = B * (1 + g / 100) ** Y;
        return num('growth', 'compound', `₹${fmt(B)} crore grows at ${fmt(g)}% a year for ${Y} years. What is it worth at the end, in ₹ crore?`, ans, { inputs: { B, g, Y }, unit: '₹ crore', dp: 1, rel: 0.01,
          steps: [`Value = ${fmt(B)} × ${fmt(1 + g / 100, 2)}^${Y}`, `${fmt(1 + g / 100, 2)}^${Y} = ${fmt((1 + g / 100) ** Y, 4)}`, `${fmt(B)} × ${fmt((1 + g / 100) ** Y, 4)} = ${fmt(ans, 1)}`],
          tip: 'Compound year by year or use 1 + n·g + n(n−1)/2·g² for small rates.' });
      }
      if (v < 0.65) {
        const g = pick(r, byLevel(level, [[6, 8, 12, 24], [6, 8, 9, 12, 18], [4, 7, 9, 14, 16]]));
        const exact = Math.log(2) / Math.log(1 + g / 100), rule = 72 / g;
        return { ...num('growth', 'double', `At ${fmt(g)}% annual growth, roughly how many years does it take for a value to double?`, exact, { inputs: { g }, unit: 'years', dp: 1,
          steps: [`Rule of 72: 72 ÷ ${fmt(g)} ≈ ${fmt(rule, 1)} years`, `Exact: ln 2 ÷ ln ${fmt(1 + g / 100, 2)} = ${fmt(exact, 2)} years`],
          tip: 'The rule of 72 is reliable between roughly 4% and 20%.' }),
          tolerance: Math.max(0.3, Math.abs(rule - exact) + 0.15), toleranceLabel: 'Within ±0.3 years — the rule of 72 is fine' };
      }
      const pairs = byLevel(level, [[[100, 121, 2], [100, 144, 2], [100, 169, 2], [400, 625, 2], [100, 225, 2]], [[200, 400, 5], [100, 133.1, 3], [250, 360, 2], [80, 160, 6], [150, 300, 4]], [[120, 300, 5], [90, 270, 6], [400, 520, 3], [64, 100, 4], [350, 910, 7]]]);
      const [A, Bv, N] = pick(r, pairs), ans = ((Bv / A) ** (1 / N) - 1) * 100;
      return num('growth', 'cagr', `Sales grew from ₹${fmt(A)} crore to ₹${fmt(Bv)} crore over ${N} years. What is the compound annual growth rate (CAGR)?`, ans, { inputs: { A, B: Bv, N }, unit: '%', dp: 1, rel: 0, abs: level === 'foundation' ? 0.2 : 0.6,
        label: level === 'foundation' ? 'Within ±0.2 percentage points' : 'Within ±0.6 percentage points',
        steps: [`Growth multiple = ${fmt(Bv)} ÷ ${fmt(A)} = ${fmt(Bv / A, 3)}`, `CAGR = ${fmt(Bv / A, 3)}^(1/${N}) − 1 = ${fmt(ans, 1)}%`],
        tip: 'Use the rule of 72 in reverse: a value that doubles in 5 years grows about 72 ÷ 5 ≈ 14% a year.' });
    },
    npv(r, level) {
      const v = r();
      if (v < 0.35) {
        const rate = pick(r, byLevel(level, [[10], [8, 10, 12], [9, 11, 15]]));
        const N = byLevel(level, [1, int(r, 1, 2), int(r, 2, 3)]);
        const X = byLevel(level, [110 * pick(r, [1, 2, 5, 10]), 10 * int(r, 5, 80), int(r, 40, 900)]);
        const ans = X / (1 + rate / 100) ** N;
        return num('npv', 'pv', `What is the present value of ₹${fmt(X)} crore received in ${N} year${N > 1 ? 's' : ''}, using a discount rate of ${fmt(rate)}%?`, ans, { inputs: { X, rate, N }, unit: '₹ crore', dp: 1, rel: 0.01,
          steps: [`PV = ${fmt(X)} ÷ ${fmt(1 + rate / 100, 2)}^${N}`, `${fmt(1 + rate / 100, 2)}^${N} = ${fmt((1 + rate / 100) ** N, 4)}`, `PV = ${fmt(ans, 1)}`],
          tip: 'Dividing by 1.1 is the same as multiplying by about 0.91.' });
      }
      if (v < 0.6) {
        const rate = pick(r, byLevel(level, [[5, 10, 20], [8, 10, 12, 15], [7, 9, 11, 14]]));
        const C = byLevel(level, [pick(r, [5, 10, 20, 50]), int(r, 3, 60), int(r, 20, 450) / 10]);
        const g = level === 'stretch' ? pick(r, [2, 3, 4]) : 0;
        const ans = C / ((rate - g) / 100);
        return num('npv', 'perpetuity', `A contract pays ₹${fmt(C)} crore a year${g ? `, growing ${g}% a year,` : ''} forever. Using a discount rate of ${fmt(rate)}%, what is it worth today in ₹ crore?`, ans, { inputs: { C, rate, g }, unit: '₹ crore', dp: 1, rel: 0.005,
          steps: g ? [`Growing perpetuity = cash flow ÷ (rate − growth)`, `${fmt(C)} ÷ (${fmt(rate)}% − ${g}%) = ${fmt(C)} ÷ ${fmt((rate - g) / 100, 3)} = ${fmt(ans, 1)}`] : [`Perpetuity = cash flow ÷ rate`, `${fmt(C)} ÷ ${fmt(rate / 100, 2)} = ${fmt(ans, 1)}`],
          tip: 'Dividing by 10% multiplies by 10; dividing by 8% multiplies by 12.5.' });
      }
      const [rate, factor] = pick(r, [[8, 3.993], [10, 3.791], [12, 3.605], [15, 3.352]]);
      const C = byLevel(level, [pick(r, [10, 20, 50]), int(r, 6, 80), int(r, 30, 650) / 10]);
      const I = byLevel(level, [Math.round(C * pick(r, [3, 4, 5])), Math.round(C * int(r, 25, 45) / 10), round(C * int(r, 280, 460) / 100, 1)]);
      const ans = C * factor - I;
      return num('npv', 'npv-annuity', `An investment of ₹${fmt(I)} crore returns ₹${fmt(C)} crore a year for 5 years. The 5-year annuity factor at ${rate}% is ${factor}. What is the NPV in ₹ crore? (Use a minus sign if negative.)`, ans, { inputs: { I, C, factor, rate }, unit: '₹ crore', dp: 1, rel: 0.01, abs: 0.5,
        steps: [`PV of cash flows = ${fmt(C)} × ${factor} = ${fmt(C * factor, 2)}`, `NPV = ${fmt(C * factor, 2)} − ${fmt(I)} = ${fmt(ans, 1)}`],
        tip: 'A positive NPV is necessary, not sufficient: state the risks that could erase it.' });
    },
    estimate(r, level) {
      const divide = level !== 'foundation' && r() < 0.4;
      const a = byLevel(level, [int(r, 12, 98) * 10 + int(r, 1, 9), int(r, 120, 980), int(r, 1100, 9800)]);
      const b = byLevel(level, [int(r, 12, 98), int(r, 1100, 9800), int(r, 210, 980) * 10 + int(r, 1, 9)]);
      if (divide) {
        const total = a * b + int(r, 0, b - 1), ans = total / b, [ra, rb] = roundPair(total, b, (x, y) => x / y);
        return num('estimate', 'est-divide', `Estimate quickly: ${fmt(total, 0)} ÷ ${fmt(b, 0)}`, ans, { inputs: { total, b }, dp: 1, rel: 0.08,
          steps: [`Round: ${fmt(total, 0)} ≈ ${fmt(ra, 0)} and ${fmt(b, 0)} ≈ ${fmt(rb, 0)}`, `${fmt(ra, 0)} ÷ ${fmt(rb, 0)} ≈ ${fmt(ra / rb, 1)}`, `Exact: ${fmt(ans, 2)}`],
          tip: 'Cancel zeros first, then divide the leading digits.' });
      }
      const ans = a * b, [ra, rb] = roundPair(a, b, (x, y) => x * y);
      return num('estimate', 'est-multiply', `Estimate quickly: ${fmt(a, 0)} × ${fmt(b, 0)}`, ans, { inputs: { a, b }, dp: 0, rel: 0.08,
        steps: [`Round: ${fmt(a, 0)} ≈ ${fmt(ra, 0)} and ${fmt(b, 0)} ≈ ${fmt(rb, 0)}`, `${fmt(ra, 0)} × ${fmt(rb, 0)} = ${fmt(ra * rb, 0)}`, `Exact: ${fmt(ans, 0)}`],
        tip: 'If you round one number up, round the other down to keep the error small.' });
    },
    exhibit(r, level) {
      const sets = [['North', 'South', 'East', 'West'], ['Retail', 'Online', 'Wholesale', 'Export'], ['Cement', 'Steel', 'Glass', 'Tiles'], ['Metro', 'Tier 1', 'Tier 2', 'Rural']];
      const labels = pick(r, sets), stepSize = level === 'foundation' ? 10 : level === 'interview' ? 5 : 1;
      let series;
      for (let tries = 0; tries < 50; tries++) {
        series = labels.map(label => { const a = stepSize * int(r, 40 / stepSize, 400 / stepSize); const b = Math.max(stepSize, stepSize * Math.round(a * (1 + int(r, -25, 60) / 100) / stepSize)); return { label, values: [a, b] }; });
        const growth = series.map(s => s.values[1] / s.values[0] - 1).sort((x, y) => y - x);
        if (growth[0] - growth[1] >= 0.03 && series.every(s => s.values[0] !== s.values[1])) break;
      }
      const chart = { title: `${labels === sets[1] ? 'Revenue by channel' : labels === sets[2] ? 'Revenue by product' : labels === sets[3] ? 'Revenue by market' : 'Revenue by region'}, ₹ crore`, years: [2024, 2025], series };
      const total = i => series.reduce((sum, s) => sum + s.values[i], 0);
      const kind = pick(r, ['chart-share', 'chart-growth', 'chart-fastest', level === 'foundation' ? 'chart-share' : 'chart-total-growth']);
      const s = pick(r, series), growthOf = x => (x.values[1] - x.values[0]) / x.values[0] * 100;
      if (kind === 'chart-fastest') {
        const growth = series.map(growthOf), best = growth.indexOf(Math.max(...growth));
        return { skill: 'exhibit', kind, type: 'choice', prompt: 'Using the exhibit, which segment grew fastest in percentage terms from 2024 to 2025?', spoken: 'Look at the exhibit. Which segment grew fastest in percentage terms from 2024 to 2025?', inputs: { series }, chart, choices: labels.slice(), answer: best, display: labels[best], tolerance: 0, toleranceLabel: 'Choose one segment',
          steps: series.map((x, i) => `${x.label}: ${fmt(x.values[0])} → ${fmt(x.values[1])} = ${growth[i] >= 0 ? '+' : ''}${fmt(growth[i], 1)}%`), tip: 'The tallest bar or the largest absolute gain is not necessarily the fastest growth.' };
      }
      if (kind === 'chart-share') {
        const ans = s.values[1] / total(1) * 100;
        return num('exhibit', kind, `Using the exhibit, what share of 2025 revenue came from ${s.label}?`, ans, { inputs: { series, label: s.label }, chart, unit: '%', dp: 1, abs: 0.2, rel: 0,
          label: 'Within ±0.2 percentage points', steps: [`2025 total = ${series.map(x => fmt(x.values[1])).join(' + ')} = ${fmt(total(1))}`, `${s.label} share = ${fmt(s.values[1])} ÷ ${fmt(total(1))} = ${fmt(ans, 1)}%`],
          tip: 'Add the total once and write it down; you will usually need it again.' });
      }
      if (kind === 'chart-growth') {
        const ans = growthOf(s);
        return num('exhibit', kind, `Using the exhibit, by what percentage did ${s.label} revenue change from 2024 to 2025? (Use a minus sign for a decline.)`, ans, { inputs: { series, label: s.label }, chart, unit: '%', dp: 1, abs: 0.2, rel: 0,
          label: 'Within ±0.2 percentage points', steps: [`${s.label}: ${fmt(s.values[0])} → ${fmt(s.values[1])}`, `Change = ${fmt(s.values[1] - s.values[0])} ÷ ${fmt(s.values[0])} = ${fmt(ans, 1)}%`],
          tip: 'Read both bars for the same segment and check the axis units before calculating.' });
      }
      const ans = (total(1) - total(0)) / total(0) * 100;
      return num('exhibit', 'chart-total-growth', 'Using the exhibit, by what percentage did total revenue change from 2024 to 2025? (Use a minus sign for a decline.)', ans, { inputs: { series }, chart, unit: '%', dp: 1, abs: 0.2, rel: 0,
        label: 'Within ±0.2 percentage points', steps: [`2024 total = ${fmt(total(0))}; 2025 total = ${fmt(total(1))}`, `Change = ${fmt(total(1) - total(0))} ÷ ${fmt(total(0))} = ${fmt(ans, 1)}%`],
        tip: 'Total growth is a weighted average of segment growth, weighted by each segment’s starting size.' });
    }
  };

  function generate(skill, level, rand) {
    if (!G[skill]) throw new Error('Unknown skill: ' + skill);
    return G[skill](rand, LEVELS.some(l => l.id === level) ? level : 'interview');
  }

  function buildRound({ skills = SKILL_IDS, level = 'interview', count = 10, seed = Date.now() } = {}) {
    const chosen = skills.filter(s => G[s]);
    if (!chosen.length) throw new Error('Choose at least one skill.');
    const rand = rng(seed), order = chosen.slice().sort(() => rand() - 0.5), seen = new Set(), questions = [];
    for (let i = 0; i < count; i++) {
      let q;
      for (let tries = 0; tries < 8; tries++) { q = generate(order[i % order.length], level, rand); if (!seen.has(q.prompt + JSON.stringify(q.chart))) break; }
      seen.add(q.prompt + JSON.stringify(q.chart)); questions.push(q);
    }
    return questions;
  }

  function parseAnswer(raw) {
    const text = String(raw ?? '').trim().replace(/[−–]/g, '-').replace(/[₹,\s%]/g, '').replace(/(crore|cr|lakh|million|billion|years?|yrs?|units?)$/i, '');
    return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(text) ? Number(text) : NaN;
  }

  function check(q, raw) {
    if (q.type === 'choice') { const value = Number(raw); return { value, valid: Number.isInteger(value) && value >= 0 && value < q.choices.length, ok: value === q.answer }; }
    const value = parseAnswer(raw);
    return { value, valid: Number.isFinite(value), ok: Number.isFinite(value) && Math.abs(value - q.answer) <= q.tolerance + 1e-9 };
  }

  const median = list => { if (!list.length) return null; const s = list.slice().sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  /* Per-skill accuracy and speed over the most recent `window` attempts of each skill. */
  function summarise(runs, window = 30) {
    const attempts = Object.fromEntries(SKILL_IDS.map(id => [id, []]));
    for (const run of (runs || []).slice().sort((a, b) => (a.at || 0) - (b.at || 0))) for (const r of run.results || []) if (attempts[r.skill]) attempts[r.skill].push(r);
    return SKILLS.map(skill => {
      const recent = attempts[skill.id].slice(-window), correct = recent.filter(r => r.ok).length;
      return { skill: skill.id, title: skill.title, attempts: recent.length, correct, accuracy: recent.length ? correct / recent.length : null, medianSeconds: median(recent.filter(r => r.ok && Number.isFinite(r.seconds)).map(r => r.seconds)) };
    });
  }

  /* The skill to practise next: lowest accuracy among skills with enough attempts, slower first on ties. */
  function weakest(stats, minAttempts = 4) {
    const ranked = stats.filter(s => s.attempts >= minAttempts).sort((a, b) => a.accuracy - b.accuracy || (b.medianSeconds ?? 0) - (a.medianSeconds ?? 0));
    return ranked.length && ranked[0].accuracy < 1 ? ranked[0] : null;
  }

  const api = { show, SKILLS, LEVELS, SKILL_IDS, rng, generate, buildRound, parseAnswer, check, summarise, weakest, median, fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DrillQuestions = api;
})(this);
