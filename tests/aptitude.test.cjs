const test = require('node:test'), assert = require('node:assert/strict');
const A = require('../src/aptitude-questions.js'), V = require('../content/aptitude-verbal.js');
const { fixture } = require('./dom.cjs');

/* ---------- Independent solvers, written separately from the generators ---------- */
const g = (a, b) => b ? g(b, a % b) : Math.abs(a);
const red = (x, y) => `${x / g(x, y)} : ${y / g(x, y)}`;
const fr = (n, d) => { const k = g(n, d); return d / k === 1 ? String(n / k) : `${n / k}/${d / k}`; };
const letter = i => String.fromCharCode(65 + ((i % 26) + 26) % 26), pos = c => c.charCodeAt(0) - 65;
function permutations(list) { if (list.length <= 1) return [list]; return list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map(p => [x, ...p])); }
function subsets(n, k) { const out = []; for (let m = 0; m < 1 << n; m++) { let c = 0; for (let i = 0; i < n; i++) if (m >> i & 1) c++; if (c === k) out.push(m); } return out; }
const bigPow = (b, n, d) => Number((BigInt(b) ** BigInt(n)) % BigInt(d));
const deck = []; for (const s of 'SHDC') for (let r = 1; r <= 13; r++) deck.push({ s, r });
const CARD = { face: c => c.r > 10, 'king-or-heart': c => c.r === 13 || c.s === 'H', 'black-or-ace': c => 'SC'.includes(c.s) || c.r === 1, 'heart-or-face': c => c.s === 'H' || c.r > 10, 'red-king': c => c.r === 13 && 'HD'.includes(c.s), 'not-club': c => c.s !== 'C', 'queen-or-king': c => c.r === 12 || c.r === 13 };
const DIRS = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];

function relation(people, y, x) {
  const P = n => people.find(p => p.name === n), Y = P(y), X = P(x), male = Y.g === 'm', w = (m, f) => male ? m : f;
  const kids = p => people.filter(c => c.parents.includes(p.name)), sibs = p => p.parents.length ? people.filter(o => o !== p && o.parents[0] === p.parents[0]) : [];
  const mates = p => p.spouse ? [P(p.spouse)] : [], up = p => p.parents.map(P), has = (list, p) => list.includes(p);
  if (has(mates(X), Y)) return w('husband', 'wife');
  if (has(up(X), Y)) return w('father', 'mother');
  if (has(kids(X), Y)) return w('son', 'daughter');
  if (has(sibs(X), Y)) return w('brother', 'sister');
  if (has(up(X).flatMap(up), Y)) return w('grandfather', 'grandmother');
  if (has(kids(X).flatMap(kids), Y)) return w('grandson', 'granddaughter');
  if (has(up(X).flatMap(sibs).flatMap(s => [s, ...mates(s)]), Y)) return w('uncle', 'aunt');
  if (has([...sibs(X), ...mates(X).flatMap(sibs)].flatMap(kids), Y)) return w('nephew', 'niece');
  if (has(up(X).flatMap(sibs).flatMap(kids), Y)) return 'cousin';
  if (has(mates(X).flatMap(up), Y)) return w('father-in-law', 'mother-in-law');
  if (has(kids(X).flatMap(mates), Y)) return w('son-in-law', 'daughter-in-law');
  if (has([...mates(X).flatMap(sibs), ...sibs(X).flatMap(mates)], Y)) return w('brother-in-law', 'sister-in-law');
  return null;
}
const STMT = { A: (x, a, b) => x.every(r => !(r >> a & 1) || (r >> b & 1)), E: (x, a, b) => !x.some(r => (r >> a & 1) && (r >> b & 1)), I: (x, a, b) => x.some(r => (r >> a & 1) && (r >> b & 1)), O: (x, a, b) => x.some(r => (r >> a & 1) && !(r >> b & 1)) };
function venns(k) { const out = [], n = (1 << k) - 1; for (let m = 1; m < 1 << n; m++) { const occ = []; for (let i = 0; i < n; i++) if (m >> i & 1) occ.push(i + 1); if ([...Array(k).keys()].every(t => occ.some(r => r >> t & 1))) out.push(occ); } return out; }
const VENN = { 3: venns(3), 4: venns(4) };
function seatOK(c, at) { // at[i] = person at position i; independent clue checker
  const p = x => at.indexOf(x), n = at.length;
  return { end: () => [0, n - 1].includes(p(c.a)), 'not-end': () => ![0, n - 1].includes(p(c.a)), left: () => p(c.b) - p(c.a) === 1, right: () => p(c.a) - p(c.b) === 1, 'second-right': () => p(c.a) - p(c.b) === 2,
    gap: () => Math.abs(p(c.a) - p(c.b)) - 1 === c.k, between: () => Math.abs(p(c.b) - p(c.a)) === 1 && Math.abs(p(c.c) - p(c.a)) === 1, position: () => p(c.a) + 1 === c.p, 'not-next': () => Math.abs(p(c.a) - p(c.b)) > 1 }[c.t]();
}
const sum = (xs) => xs.reduce((s, x) => s + x, 0);
const factorial = n => n <= 1 ? 1 : n * factorial(n - 1);
const PRIMES = [...Array(60).keys()].filter(n => n > 1 && [...Array(n).keys()].slice(2).every(d => n % d));
function seriesTerm(rule, p) {
  return { arith: n => p.a + n * p.d, geom: n => p.a * p.r ** n, square: n => (p.k + n) ** 2 + p.e, cube: n => (p.k + n) ** 3 + p.e,
    diff: n => { let t = p.a; for (let j = 0; j < n; j++) t += p.d + j * p.c; return t; }, muladd: n => { let t = p.a; for (let j = 0; j < n; j++) t = p.m * t + p.c; return t; },
    alt: n => n % 2 === 0 ? p.a + p.d1 * n / 2 : p.b + p.d2 * (n - 1) / 2,
    muladd2: n => { let t = p.a; for (let j = 0; j < n; j++) t = j % 2 === 0 ? t * p.m : t + p.c; return t; },
    primediff: n => p.a + sum(PRIMES.slice(p.s, p.s + n)),
    fib: n => { const f = [p.a, p.b]; while (f.length <= n) f.push(f[f.length - 1] + f[f.length - 2]); return f[n]; },
    geomdiff: n => { let t = p.a, d = p.d; for (let j = 0; j < n; j++) { t += d; d *= p.r; } return t; },
    ncube: n => (p.k + n) ** 3 + p.s * (p.k + n), mulinc: n => { let t = p.a; for (let j = 0; j < n; j++) t *= p.k + j; return t; } }[rule];
}
const Q = { add: ([a, b], [c, d]) => [a * d + c * b, b * d], mul: ([a, b], [c, d]) => [a * c, b * d] };
const isRed = c => 'HD'.includes(c.s);
function circleOK(c, at) { // at[seat] = person, seats clockwise from above; facing the centre, your left neighbour is the next seat clockwise
  const n = at.length, seat = x => at.indexOf(x), leftOf = x => at[(seat(x) + 1) % n], rightOf = x => at[(seat(x) + n - 1) % n];
  return { left: () => c.a === leftOf(c.b), right: () => c.a === rightOf(c.b), 'second-left': () => c.a === leftOf(leftOf(c.b)), 'second-right': () => c.a === rightOf(rightOf(c.b)),
    opposite: () => c.a === at[(seat(c.b) + n / 2) % n], 'not-next': () => c.a !== leftOf(c.b) && c.a !== rightOf(c.b), between: () => [leftOf(c.a), rightOf(c.a)].sort().join() === [c.b, c.c].sort().join() }[c.t]();
}
function floorOK(c, at, subj) { // at[floor − 1] = person; subj[person] = subject
  const fl = e => (e.k === 'p' ? at.indexOf(e.i) : at.indexOf(subj.indexOf(e.i))) + 1;
  return { floor: () => fl(c.a) === c.f, above: () => fl(c.a) - fl(c.b) === c.k, gap: () => Math.abs(fl(c.a) - fl(c.b)) === 2, even: () => fl(c.a) % 2 === 0, odd: () => fl(c.a) % 2 === 1,
    likes: () => subj[c.p] === c.s, 'not-likes': () => subj[c.p] !== c.s }[c.t]();
}
const P5 = permutations([0, 1, 2, 3, 4]);
const PAIRS = { square: n => n ** 2, cube: n => n ** 3, sqplus: n => n ** 2 + 1, twice1: n => 2 * n + 1, nnp1: n => n ** 2 + n, cubeminus: n => n ** 3 - n, sqminus: n => n ** 2 - 1, cubeplus: n => n ** 3 + 1, tri: n => sum([...Array(n + 1).keys()]) };
const SYL = ['Only conclusion I follows', 'Only conclusion II follows', 'Both I and II follow', 'Neither I nor II follows'];

// Each solver returns the expected numeric value, or the exact text of the correct option.
const SOLVE = {
  'pct-of': i => i.p / 100 * i.base, 'pct-successive': i => (100 + i.a) * (100 + i.b) / 100 - 100, 'pct-reverse': i => i.after * 100 / (i.up ? 100 + i.p : 100 - i.p),
  'pct-compound': i => { let x = i.P; for (let y = 0; y < i.n; y++) x += x * i.p / 100; return x; },
  'pl-percent': i => (i.SP - i.CP) * 100 / i.CP, 'pl-markup': i => { const mp = 100 + i.m, sp = mp - mp * i.d / 100; return sp - 100; },
  'pl-cp': i => i.SP * 100 / (i.loss ? 100 - i.p : 100 + i.p), 'pl-target': i => i.SP * 100 / (100 - i.p1) * (100 + i.p2) / 100, 'pl-weight': i => (1000 - i.w) * 100 / i.w,
  si: i => (i.ask === 'amount' ? i.P : 0) + i.P * i.R * i.T / 100, 'si-rate': i => (i.A - i.P) / i.T / i.P * 100,
  ci: i => { let x = i.P; for (let t = 0; t < i.T * i.k; t++) x += x * i.R / i.k / 100; return x - i.P; },
  'ci-si-diff': i => (i.P * (1 + i.R / 100) ** 2 - i.P) - 2 * i.P * i.R / 100,
  'ratio-share': i => i.N / sum(i.parts) * i.parts[i.who], 'ratio-chain': i => red(i.p * i.s, i.q * i.t),
  'ratio-age': i => { for (let x = 1; x < 100; x++) if ((i.a * x + i.n) * i.d === (i.b * x + i.n) * i.c) return i.a * x; },
  'prop-direct': i => i.cost * i.n2 / i.n1, 'prop-inverse': i => i.w1 * i.d1 / i.w2,
  'avg-add': i => i.B * (i.n + 1) - i.A * i.n, 'avg-replace': i => i.w + i.d * i.n,
  alligation: i => { for (let y = 1; y < 200; y++) for (let x = 1; x < 200; x++) if (i.a * x + i.b * y === i.m * (x + y)) return red(x, y); },
  'alligation-qty': i => i.Q * (i.b - i.m) / (i.m - i.a),
  'work-together': i => 1 / sum(i.days.map(d => 1 / d)), 'work-three': i => 1 / sum(i.days.map(d => 1 / d)),
  'work-leave': i => i.k + (1 - i.k / i.a - i.k / i.b) * i.b, 'work-wages': i => i.W * i.b / (i.a + i.b), 'work-efficiency': i => i.d * (i.p + 1) / i.p,
  'pipes-net': i => 1 / (sum(i.fill.map(x => 1 / x)) - sum(i.empty.map(x => 1 / x))), 'pipes-three': i => 1 / (sum(i.fill.map(x => 1 / x)) - sum(i.empty.map(x => 1 / x))),
  'pipes-leak': i => i.a * (i.a + i.x) / i.x,
  'train-pole': i => i.L / (i.S * 1000 / 3600), 'train-platform': i => (i.L + i.P) / (i.S * 1000 / 3600),
  'train-cross': i => (i.L1 + i.L2) / ((i.same ? Math.abs(i.S1 - i.S2) : i.S1 + i.S2) * 1000 / 3600), boat: i => i.D / (i.b + i.s) + i.D / (i.b - i.s),
  'avg-speed': i => 2 / (1 / i.x + 1 / i.y),
  'lcm-bells': i => { for (let t = 1; ; t++) if (i.list.every(x => t % x === 0)) return t; },
  'hcf-lcm': i => { for (let b = 1; b <= i.L; b++) if (g(i.a, b) === i.h && i.a * b / i.h === i.L) return b; },
  'remainder-power': i => String(bigPow(i.b, i.n, i.d)), 'unit-digit': i => String(bigPow(i.a, i.n, 10)), 'remainder-divisor': i => String(i.rem % i.d2),
  'pnc-word': i => new Set(permutations([...i.word]).map(p => p.join(''))).size,
  'pnc-vowels': i => permutations([...i.word]).filter(p => { const v = p.map((c, j) => 'AEIOU'.includes(c) ? j : -1).filter(j => j >= 0); return v[v.length - 1] - v[0] === v.length - 1; }).length,
  'pnc-committee': i => subsets(i.M + i.W, i.a + i.b).filter(m => { let men = 0; for (let j = 0; j < i.M; j++) men += m >> j & 1; return men === i.a; }).length,
  'pnc-atleast': i => subsets(i.M + i.W, i.k).filter(m => m >> i.M).length,
  'pnc-handshake': i => { let c = 0; for (let a = 0; a < i.n; a++) for (let b = a + 1; b < i.n; b++) c++; return c; },
  'pnc-circle': i => new Set(permutations([...Array(i.n).keys()]).map(p => { const s = p.indexOf(0); return [...p.slice(s), ...p.slice(0, s)].join(); })).size,
  'pnc-together': i => permutations([...Array(i.n).keys()]).filter(p => Math.abs(p.indexOf(0) - p.indexOf(1)) === 1).length,
  'prob-dice': i => { let c = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) c += { sum: a + b === i.s, atleast: a + b >= i.s, double: a === b, prime: [2, 3, 5, 7, 11].includes(a + b) }[i.ev] ? 1 : 0; return fr(c, 36); },
  'prob-cards': i => fr(deck.filter(CARD[i.ev]).length, 52),
  'prob-balls': i => {
    const balls = [...Array(i.red).fill('r'), ...Array(i.green).fill('g'), ...Array(i.blue).fill('b')];
    if (i.draw === 'red-or-blue') return fr(balls.filter(b => b !== 'g').length, balls.length);
    let fav = 0, all = 0; for (let x = 0; x < balls.length; x++) for (let y = x + 1; y < balls.length; y++) { all++; const pr = balls[x] + balls[y]; if (i.draw === 'both-red' ? pr === 'rr' : pr === 'rb' || pr === 'br') fav++; }
    return fr(fav, all);
  },
  'prob-coins': i => { let c = 0; for (let m = 0; m < 1 << i.n; m++) { let h = 0; for (let j = 0; j < i.n; j++) h += m >> j & 1; if (i.atLeast ? h > 0 : h === i.k) c++; } return fr(c, 2 ** i.n); },
  'di-growth': i => (i.table.rows[i.y2][i.col] / i.table.rows[i.y1][i.col] - 1) * 100, 'di-average': i => sum(i.table.rows.map(r => r[i.col])) / i.table.rows.length,
  'di-share': i => i.chart.series.find(s => s.label === i.label).values[1] * 100 / sum(i.chart.series.map(s => s.values[1])),
  'di-change': i => sum(i.chart.series.map(s => s.values[1] - s.values[0])),
  'series-number': i => {
    const term = seriesTerm(i.rule, i.p);
    i.shown.forEach((x, n) => assert.equal(x, term(n), 'shown term follows the rule'));
    return String(term(i.shown.length));
  },
  'series-wrong': i => {
    const term = seriesTerm(i.rule, i.p), off = i.shown.map((x, n) => x !== term(n) ? n : -1).filter(n => n >= 0);
    assert.equal(off.length, 1, 'exactly one term breaks the rule'); return String(i.shown[off[0]]);
  },
  'series-letter': i => i.rule === 'skip' ? letter(i.start + sum(i.steps)) : letter(i.s1 + i.n * i.k1) + letter(i.s2 - i.n * i.k2),
  'code-shift': i => {
    const enc = (w, k, mirror, rev) => { const x = [...w]; if (rev) x.reverse(); return x.map(c => letter(mirror ? 25 - pos(c) : pos(c) + k)).join(''); };
    assert.equal(enc(i.ex, i.rule.k || 0, i.rule.mirror, i.rule.rev), i.exCode, 'example is coded by the rule');
    const fits = new Set(); for (const rev of [false, true]) { for (let k = 0; k < 26; k++) if (enc(i.ex, k, false, rev) === i.exCode) fits.add(enc(i.target, k, false, rev)); if (enc(i.ex, 0, true, rev) === i.exCode) fits.add(enc(i.target, 0, true, rev)); }
    assert.equal(fits.size, 1, 'the example pins down a single code for the target');
    return [...fits][0];
  },
  'code-sum': i => { const v = (w, rv) => sum([...w].map(c => rv ? 26 - pos(c) : pos(c) + 1)); assert.equal(v(i.ex, i.rev), i.exV); assert.notEqual(v(i.ex, !i.rev), i.exV, 'the example rules out the other scheme'); return String(v(i.target, i.rev)); },
  blood: i => {
    for (const s of i.steps) { const a = i.people.find(p => p.name === s.a), b = i.people.find(p => p.name === s.b); assert.equal(relation(i.people, a.name, b.name), s.rel, `statement “${s.a} is ${s.b}'s ${s.rel}” is true`); }
    assert.equal(i.steps[0].a, i.y); assert.equal(i.steps[i.steps.length - 1].b, i.x);
    const rel = relation(i.people, i.y, i.x); return rel[0].toUpperCase() + rel.slice(1);
  },
  'dir-distance': i => {
    let h = i.start, x = 0, y = 0; const mv = km => { x += [0, 1, 0, -1][h] * km; y += [1, 0, -1, 0][h] * km; };
    mv(i.first); for (const l of i.legs) { h = (h + (l.turn === 'right' ? 1 : 3)) % 4; mv(l.km); }
    const dir = [y > 0 ? 'North' : y < 0 ? 'South' : '', x > 0 ? 'East' : x < 0 ? 'West' : ''].filter(Boolean).join('-');
    return `${Math.hypot(x, y)} km ${dir}`;
  },
  'dir-facing': i => DIRS[((i.start * 45 + sum(i.turns)) % 360 + 360) % 360 / 45],
  seating: i => {
    const n = i.names.length, sols = permutations([...Array(n).keys()]).filter(at => i.clues.every(c => seatOK(c, at)));
    assert.equal(sols.length, 1, 'the clues allow exactly one arrangement');
    const at = sols[0], q = i.ask, idx = { middle: () => (n - 1) / 2, end: () => q.side === 'left' ? 0 : n - 1, 'right-of': () => at.indexOf(q.b) + 1, 'left-of': () => at.indexOf(q.b) - 1, nth: () => n - q.p }[q.t]();
    return i.names[at[idx]];
  },
  syllogism: i => {
    const live = VENN[i.k].filter(x => i.premises.every(s => STMT[s.t](x, s.a, s.b))); assert(live.length, 'statements are consistent');
    const [f1, f2] = i.conclusions.map(c => live.every(x => STMT[c.t](x, c.a, c.b)));
    return ['Only conclusion I follows', 'Only conclusion II follows', 'Both I and II follow', 'Neither I nor II follows'][f1 && f2 ? 2 : f1 ? 0 : f2 ? 1 : 3];
  },
  'odd-number': i => {
    const isP = n => n > 1 && [...Array(Math.floor(Math.sqrt(n)) + 1).keys()].slice(2).every(d => n % d), root = (n, k) => Math.round(n ** (1 / k)) ** k === n;
    const has = { prime: isP, square: n => root(n, 2), cube: n => root(n, 3), multiple: n => n % i.k === 0 }[i.kind], out = i.nums.filter(n => !has(n));
    assert.equal(out.length, 1, 'exactly one number lacks the property'); return String(out[0]);
  },
  'odd-letters': i => { const out = i.groups.filter(w => pos(w[1]) - pos(w[0]) !== i.s1 || pos(w[2]) - pos(w[1]) !== i.s2); assert.equal(out.length, 1, 'exactly one group breaks the pattern'); return out[0]; },
  divisible: i => null,

  // Advanced and Expert
  'pct-expense': i => i.up ? (1 - 100 / (100 + i.p)) * 100 : (100 / (100 - i.p) - 1) * 100,
  'pct-exam': i => (i.x + i.y) * 100 / (i.b - i.a),
  'pct-voters': i => i.M / ((100 - i.a) / 100 * (100 - i.b) / 100 * (2 * i.w - 100) / 100),
  'pl-free': i => (i.x + i.y) * 100 * (1 + i.p / 100) / i.x - 100,
  'pl-two-items': i => 2 * i.S - i.S * 100 / (100 + i.a) - i.S * 100 / (100 - i.b),
  'pl-dishonest': i => (100 + i.a) / (100 - i.b) * 100 - 100,
  'ci-two-amounts': i => { const f = i.A3 / i.A2; return i.ask === 'P' ? i.A2 / f / f : (f - 1) * 100; },
  'ci-instalment': i => { const f = 1 + i.R / 100; return i.P / (1 / f + 1 / (f * f)); },
  'ci-si-diff3': i => { let x = i.P; for (let t = 0; t < 3; t++) x += x * i.R / 100; return x - i.P - 3 * i.P * i.R / 100; },
  'ratio-coins': i => { for (let k = 1; k < 10000; k++) if (k * (i.parts[0] * 100 + i.parts[1] * 50 + i.parts[2] * 25) === i.T * 100) return i.parts[i.ask] * k; },
  'ratio-partnership': i => { let a = 0, b = 0; for (let mo = 0; mo < 12; mo++) { a += i.wd != null && mo >= i.wd ? i.X / 2 : i.X; b += mo >= i.join ? i.Y : 0; } return i.P * b / (a + b); },
  'avg-wrong': i => (i.A * i.n + sum(i.pairs.map(([x, y]) => x - y))) / i.n,
  'mix-replace': i => { let milk = i.V; for (let t = 0; t < i.k; t++) milk -= milk * i.x / i.V; return milk; },
  'mix-vessels': i => { const V = (i.a + i.b) * (i.c + i.d), milk = i.p * V * i.a / (i.a + i.b) + i.q * V * i.c / (i.c + i.d), water = (i.p + i.q) * V - milk; return red(milk, water); },
  'work-mdh': i => i.W2 / (i.W1 / (i.m1 * i.h1 * i.d1) * i.m2 * i.h2),
  'work-alternate': i => { let done = 0; for (let t = 0; ; t++) { const rate = 1 / i.days[t % i.days.length]; if (done + rate >= 1 - 1e-12) return t + (1 - done) / rate; done += rate; } },
  'work-men-women': i => { const det = i.m1 * i.w2 - i.m2 * i.w1, x = (i.w2 / i.d1 - i.w1 / i.d2) / det, y = (i.m1 / i.d2 - i.m2 / i.d1) / det; return 1 / (i.k * (i.who === 'men' ? x : y)); },
  'pipes-close': i => (1 - i.T / i.a) * i.b,
  'pipes-capacity': i => 60 * i.F / (1 / i.l - 1 / i.e),
  'speed-late': i => (i.t1 + i.t2) / 60 / (1 / i.v1 - 1 / i.v2),
  'boat-find': i => { const dn = i.d1 / i.t1, up = i.d2 / i.t2; return i.ask === 'stream' ? (dn - up) / 2 : (dn + up) / 2; },
  'speed-circle': i => { for (let t = 1; t < 100000; t++) { const a = i.u * t, b = (i.same ? 1 : -1) * i.v * t; if (i.ask === 'start' ? a % i.L === 0 && b % i.L === 0 : (a - b) % i.L === 0) return t; } },
  'number-zeros': i => { let f = 1n; for (let k = 2n; k <= BigInt(i.n); k++) f *= k; let c = 0; while (f % BigInt(i.p) === 0n) { f /= BigInt(i.p); c++; } return c; },
  'number-factors': i => { let c = 0; for (let d = 1; d <= i.N; d++) if (i.N % d === 0 && (i.ask === 'all' || (i.ask === 'even') === (d % 2 === 0))) c++; return c; },
  'number-crt': i => {
    if (i.ask === 'diff') { for (let n = 1; ; n++) if (i.divs.every((d, j) => n % d === i.rems[j])) return n; }
    const ok = n => i.divs.every(d => n % d === i.rem), four = [...Array(9000).keys()].map(k => k + 1000).filter(ok);
    return i.ask === 'small4' ? four[0] : four[four.length - 1];
  },
  'pnc-not-together': i => {
    if (i.mode === 'pair') { let c = 0; for (let a = 0; a < i.n; a++) for (let b = 0; b < i.n; b++) if (Math.abs(a - b) > 1) c++; return c * factorial(i.n - 2); }
    const L = i.b + i.g; let c = 0; for (let m = 0; m < 1 << L; m++) { const seats = [...Array(L).keys()].filter(j => m >> j & 1); if (seats.length === i.g && seats.every((x, j) => !j || x - seats[j - 1] > 1)) c++; }
    return c * factorial(i.b) * factorial(i.g);
  },
  'pnc-digits': i => {
    let c = 0; const go = (used, num) => { if (num.length === i.k) { const l = num[i.k - 1]; if (num[0] !== 0 && { any: true, even: l % 2 === 0, odd: l % 2 === 1, div5: l % 5 === 0 }[i.ask]) c++; return; } i.digits.forEach((d, j) => { if (!used.includes(j)) go([...used, j], [...num, d]); }); };
    go([], []); return c;
  },
  'pnc-distribute': i => { const lo = i.atLeast ? 1 : 0, ways = (n, k) => k === 1 ? (n >= lo ? 1 : 0) : sum([...Array(n + 1).keys()].filter(x => x >= lo).map(x => ways(n - x, k - 1))); return ways(i.n, i.k); },
  'prob-two-bags': i => { let p = [0, 1]; for (const [r, n] of [[i.r1, i.r1 + i.b1], [i.r2, i.r2 + i.b2]]) for (let k = 0; k < r; k++) p = Q.add(p, [1, 2 * n]); return fr(...p); },
  'prob-bayes': i => { let one = [0, 1], all = [0, 1]; for (const [r, n, first] of [[i.r1, i.r1 + i.b1, true], [i.r2, i.r2 + i.b2, false]]) for (let k = 0; k < r; k++) { all = Q.add(all, [1, 2 * n]); if (first) one = Q.add(one, [1, 2 * n]); } return fr(one[0] * all[1], one[1] * all[0]); },
  'prob-solve': i => {
    let tot = [0, 1]; for (let m = 0; m < 1 << i.ps.length; m++) { let pr = [1, 1], solved = 0; i.ps.forEach(([a, d], j) => { if (m >> j & 1) { pr = Q.mul(pr, [a, d]); solved++; } else pr = Q.mul(pr, [d - a, d]); }); if (i.ask === 'solved' ? solved > 0 : solved === 1) tot = Q.add(tot, pr); }
    return fr(...tot);
  },
  'prob-two-cards': i => {
    const test = { kings: (x, y) => x.r === 13 && y.r === 13, 'king-queen': (x, y) => x.r + y.r === 25 && x.r !== y.r && Math.min(x.r, y.r) === 12, 'same-suit': (x, y) => x.s === y.s, red: (x, y) => isRed(x) && isRed(y), face: (x, y) => x.r > 10 && y.r > 10, colours: (x, y) => isRed(x) !== isRed(y) }[i.ask];
    let f = 0, all = 0; for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) { all++; if (test(deck[a], deck[b])) f++; } return fr(f, all);
  },
  'di-max-growth': i => { const regions = i.table.columns.slice(1), g = regions.map((_, j) => i.table.rows[i.y2][j + 1] / i.table.rows[i.y1][j + 1]); return regions[g.indexOf(Math.max(...g))]; },
  'di-share-change': i => { const tot = y => sum(i.chart.series.map(s => s.values[y])), s = i.chart.series.find(x => x.label === i.label); return (s.values[1] / tot(1) - s.values[0] / tot(0)) * 100; },
  'di-required': i => { const v = i.table.rows.map(r => r[i.col]); return ((5 * i.Y - sum(v)) / v[3] - 1) * 100; },
  'code-ops': i => {
    assert(Object.keys(i.map).every(o => i.map[o] !== o), 'every symbol stands for a different operation');
    const js = { '+': '+', '−': '-', '×': '*', '÷': '/' }, v = Function(`return ${i.nums.map((x, j) => j ? `${js[i.map[i.shownOps[j - 1]]]} ${x}` : String(x)).join(' ')}`)();
    assert(Number.isInteger(v), 'the decoded expression is a whole number'); return v;
  },
  'code-words': i => {
    const words = [...new Set(i.sentences.flatMap(s => s.words))], codes = [...new Set(i.sentences.flatMap(s => s.codes))], found = new Set();
    assert.equal(words.length, codes.length);
    for (const p of permutations(codes)) { const map = Object.fromEntries(words.map((w, j) => [w, p[j]])); if (i.sentences.every(s => s.words.map(w => map[w]).sort().join() === s.codes.slice().sort().join())) found.add(map[i.target]); }
    assert.equal(found.size, 1, 'the sentences fix the target’s code'); return [...found][0];
  },
  'blood-coded': i => SOLVE.blood(i),
  'dir-shadow': i => {
    const shadow = i.morning ? [-1, 0] : [1, 0], rotR = ([x, y]) => [y, -x], rotL = ([x, y]) => [-y, x], back = ([x, y]) => [-x, -y];
    let f = [[0, 1], [1, 0], [0, -1], [-1, 0]].find(v => String({ left: rotL(v), right: rotR(v), front: v, behind: back(v) }[i.side]) === String(shadow));
    f = { 0: f, 2: rotR(f), [-2]: rotL(f), 4: back(f) }[i.turn]; return { '0,1': 'North', '1,0': 'East', '0,-1': 'South', '-1,0': 'West' }[String(f)];
  },
  'dir-points': i => {
    const pos = { P: [0, 0] }; for (const f of i.facts) pos[f.p] = [pos[f.q][0] + [0, 1, 0, -1][f.d] * f.km, pos[f.q][1] + [1, 0, -1, 0][f.d] * f.km];
    const dx = pos[i.a][0] - pos[i.b][0], dy = pos[i.a][1] - pos[i.b][1]; return [dy > 0 ? 'North' : dy < 0 ? 'South' : '', dx > 0 ? 'East' : dx < 0 ? 'West' : ''].filter(Boolean).join('-');
  },
  'seating-circle': i => {
    const sols = permutations([...Array(i.n - 1).keys()].map(x => x + 1)).map(p => [0, ...p]).filter(at => i.clues.every(c => circleOK(c, at)));
    assert.equal(sols.length, 1, 'the clues allow exactly one arrangement');
    const at = sols[0], n = i.n, step = (x, k) => at[((at.indexOf(x) + k) % n + n) % n], q = i.ask;
    return i.names[{ 'left-of': () => step(q.x, 1), 'right-of': () => step(q.x, -1), 'second-right-of': () => step(q.x, -2), 'opposite-of': () => step(q.x, n / 2) }[q.t]()];
  },
  floors: i => {
    const sols = []; for (const at of P5) for (const subj of P5) if (i.clues.every(c => floorOK(c, at, subj))) sols.push([at, subj]);
    assert.equal(sols.length, 1, 'the clues allow exactly one arrangement');
    const [at, subj] = sols[0], q = i.ask;
    return { top: () => i.names[at[4]], bottom: () => i.names[at[0]], subject: () => i.subs[subj[q.p]], who: () => i.names[subj.indexOf(q.s)] }[q.t]();
  },
  'syllogism-possible': i => {
    const live = VENN[i.k].filter(x => i.premises.every(s => STMT[s.t](x, s.a, s.b))); assert(live.length, 'statements are consistent');
    const follows = c => { if (c.t[0] !== 'p') return live.every(x => STMT[c.t](x, c.a, c.b)); const t = c.t[1]; assert(!live.every(x => STMT[t](x, c.a, c.b)), 'a possibility conclusion is never already certain'); return live.some(x => STMT[t](x, c.a, c.b)); };
    const [f1, f2] = i.conclusions.map(follows); return SYL[f1 && f2 ? 2 : f1 ? 0 : f2 ? 1 : 3];
  },
  'odd-pairs': i => {
    const out = i.pairs.filter(([a, b]) => PAIRS[i.rule](a) !== b); assert.equal(out.length, 1, 'exactly one pair breaks the rule');
    for (const k of Object.keys(PAIRS)) if (k !== i.rule) assert(i.pairs.filter(([a, b]) => PAIRS[k](a) === b).length < 3, 'no other rule explains three pairs');
    return `${out[0][0]} : ${out[0][1]}`;
  }
};

const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
const numberIn = s => s === 'No change' || s === 'No profit, no loss' ? 0 : Number(s.replace(/[^0-9.]/g, ''));
const NOISE = /NaN|undefined|Infinity|null|\[object|\d\.\d{3,}(?!\d* ×)|e[+-]\d/;
function each(fn, seeds = 30) {
  for (const topic of A.TOPIC_IDS) {
    if (A.topicOf(topic).section === 'verbal') continue;
    for (const level of A.LEVEL_IDS) for (const kind of new Set(A.KINDS[topic][level])) for (let s = 1; s <= seeds; s++) fn(A.generate(topic, level, A.rng(s * 7919 + kind.length * 31 + level.length), kind), topic, level, kind);
  }
}

test('every generated kind and level matches an independent solver, with one correct option among four distinct ones', () => {
  const seen = new Set();
  each((q, topic, level, kind) => {
    const where = `${topic}/${level}/${kind}: ${q.prompt}\n${q.options.join(' | ')}`;
    seen.add(kind); assert.equal(q.kind, kind); assert.equal(q.topic, topic); assert.equal(q.level, level); assert.equal(q.section, A.topicOf(topic).section);
    assert.equal(q.options.length, 4, where); assert.equal(new Set(q.options).size, 4, 'options are distinct: ' + where);
    assert(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, where); assert.equal(q.options[q.answer], q.display, where);
    assert(SOLVE[kind] !== undefined, 'no independent solver for ' + kind);
    assert(!NOISE.test(q.prompt + ' | ' + q.options.join(' | ')), 'no float noise or placeholders: ' + where);
    assert(q.solution.length >= 1 && q.solution.every(s => typeof s === 'string' && s.length && !/NaN|undefined|Infinity|\[object/.test(s)) && q.shortcut, where);
    if (kind === 'divisible') { const d = Number(q.prompt.match(/by (\d+)/)[1]), hits = q.options.filter(o => Number(o) % d === 0); assert.deepEqual(hits, [q.display], 'exactly one option is divisible: ' + where); return; }
    const want = SOLVE[kind](q.inputs);
    if (typeof want === 'number') {
      assert(Number.isFinite(q.value) && close(q.value, want), `${where} → value ${q.value}, solver ${want}`);
      assert(close(numberIn(q.display), Math.round(Math.abs(want) * 100) / 100), `${where}: displayed answer ${q.display} is ${want} rounded to at most 2 dp`);
      const others = q.options.filter((_, j) => j !== q.answer);
      assert(!others.includes(q.display));
    } else assert.equal(q.display, want, where);
  });
  const all = new Set(Object.values(A.KINDS).flatMap(l => Object.values(l).flat()));
  assert.deepEqual([...seen].sort(), [...all].sort(), 'every kind is exercised');
});

test('generated questions are reproducible from a seed and hard levels use harder settings', () => {
  for (const t of A.TOPIC_IDS) assert.deepEqual(A.generate(t, 'medium', A.rng(42)), A.generate(t, 'medium', A.rng(42)), t);
  const sizes = l => new Set(Array.from({ length: 20 }, (_, s) => A.generate('seating', l, A.rng(s + 1)).inputs.names.length));
  assert.deepEqual([...sizes('easy')], [5]); assert.deepEqual([...sizes('hard')], [7]);
  const legs = l => A.generate('direction', l, A.rng(3), 'dir-distance').inputs.legs.length;
  assert(legs('easy') < legs('medium') && legs('medium') < legs('hard'));
  assert.equal(A.generate('syllogism', 'hard', A.rng(9)).inputs.premises.length, 3);
  assert.throws(() => A.generate('nope', 'easy', A.rng(1)), /Unknown topic/);
});

test('sets and tests are balanced, reproducible, keep passages together and use every section in order', () => {
  const a = A.buildSet({ topics: ['percent', 'blood', 'vocab'], level: 'hard', count: 12, seed: 5 });
  assert.deepEqual(a, A.buildSet({ topics: ['percent', 'blood', 'vocab'], level: 'hard', count: 12, seed: 5 }));
  for (const t of ['percent', 'blood', 'vocab']) assert.equal(a.filter(q => q.topic === t).length, 4);
  assert.equal(new Set(a.map(q => q.id)).size, 12, 'no repeats in a set');
  const rc = A.buildSet({ topics: ['reading'], count: 7, seed: 2 });
  assert.equal(rc.length, 7); assert(rc.every(q => q.passage && q.passage.text.length > 400));
  const firstPassage = rc[0].passage.id; assert(rc.slice(0, V.PASSAGES.find(p => p.id === firstPassage).questions.length).every(q => q.passage.id === firstPassage), 'a passage’s questions come together');
  const t = A.buildTest({ sections: ['verbal', 'quant'], perSection: 10, level: 'mixed', seed: 11 });
  assert.equal(t.length, 20); assert(t.slice(0, 10).every(q => q.section === 'quant') && t.slice(10).every(q => q.section === 'verbal'), 'sections follow the usual order');
  assert(new Set(t.slice(0, 10).map(q => q.level)).size > 1, 'mixed difficulty mixes levels');
  assert.equal(new Set(A.buildTest({ perSection: 30, seed: 1 }).filter(q => q.section === 'quant').map(q => q.topic)).size, 12, 'a 30-question quant section covers every topic');
  assert.throws(() => A.buildSet({ topics: [] }), /at least one/); assert.throws(() => A.buildTest({ sections: [] }), /at least one/);
});

test('Advanced and Expert bring their own question kinds, and the two mixed bands keep to their levels', () => {
  assert.deepEqual(A.LEVEL_IDS, ['easy', 'medium', 'hard', 'advanced', 'expert']);
  for (const topic of A.TOPIC_IDS.filter(t => A.topicOf(t).section !== 'verbal')) {
    const core = new Set(['easy', 'medium', 'hard'].flatMap(l => A.KINDS[topic][l]));
    for (const l of ['advanced', 'expert']) assert(A.KINDS[topic][l].some(k => !core.has(k) || k === 'series-number'), `${topic}/${l} has a kind of its own`);
  }
  // An older kind reused at a higher level runs with its Hard settings but keeps the level it was asked for.
  const seat = A.generate('seating', 'advanced', A.rng(4), 'seating'); assert.equal(seat.level, 'advanced'); assert.equal(seat.inputs.names.length, 7);
  assert.equal(A.generate('seating', 'expert', A.rng(4), 'seating-circle').inputs.names.length, 8);
  // Reading passages are excluded: with only three passages at Hard or above, a long verbal section falls back to easier ones by design.
  const levels = band => new Set(A.buildTest({ perSection: 30, level: band, seed: 3 }).filter(q => q.topic !== 'reading').map(q => q.level));
  assert.deepEqual([...levels('mixed')].sort(), ['easy', 'hard', 'medium'], 'Mixed stays at the usual test levels');
  assert.deepEqual([...levels('mixed-high')].sort(), ['advanced', 'expert', 'hard'], 'Mixed: Hard to Expert draws from the top three levels');
  for (const t of ['vocab', 'fill-blank', 'error', 'para-jumble']) for (const l of ['advanced', 'expert']) assert(V.ITEMS.filter(i => i.topic === t && i.level === l).length >= 3, `${t} has ${l} items`);
  for (const l of ['advanced', 'expert']) { assert(V.PASSAGES.some(p => p.level === l), l + ' passage'); assert.equal(A.buildSet({ topics: ['reading'], level: l, count: 4, seed: 1 })[0].passage.id, V.PASSAGES.find(p => p.level === l).id); }
});

test('scoring applies negative marking and ignores unanswered questions', () => {
  const qs = [0, 1, 2, 3, 0, 1].map(answer => ({ answer }));
  const s = A.score(qs, [0, 1, 0, null, 2, null], 0.25);
  assert.deepEqual([s.correct, s.wrong, s.unanswered, s.attempted, s.score], [2, 2, 2, 4, 1.5]); assert.equal(s.accuracy, 0.5);
  assert.equal(A.score(qs, [1, 0, 1, 0, 1, 0], 1 / 3).score, -2); assert.equal(A.score(qs, Array(6).fill(null), 0.5).accuracy, null);
  assert.equal(A.score(qs, [0, 1, 2, 3, 3, 3], 0.5).score, 3);
});

test('progress summary uses recent answered questions and suggests the weakest topic', () => {
  const hist = [{ at: 1, results: Array.from({ length: 40 }, (_, n) => ({ topic: 'blood', answered: true, ok: n % 4 === 0, seconds: 30 })) },
    { at: 2, results: [{ topic: 'percent', answered: true, ok: true, seconds: 20 }, { topic: 'percent', answered: true, ok: false, seconds: 50 }, { topic: 'percent', answered: true, ok: true, seconds: 22 }, { topic: 'percent', answered: true, ok: true, seconds: 25 }, { topic: 'percent', answered: false, ok: false, seconds: 0 }, { topic: 'bogus', answered: true, ok: false }] }];
  const st = A.summarise(hist), blood = st.find(s => s.topic === 'blood'), pct = st.find(s => s.topic === 'percent');
  assert.equal(blood.attempts, 30); assert.equal(blood.correct, 7); assert.equal(pct.attempts, 4, 'unanswered questions are not attempts'); assert.equal(pct.medianSeconds, 23.5);
  assert.equal(A.weakest(st).topic, 'blood'); assert.equal(A.weakest(A.summarise([{ at: 1, results: Array(5).fill({ topic: 'odd', answered: true, ok: true }) }])), null);
});

test('the verbal bank is original-format MCQ: one correct option, distinct options, passages with questions', () => {
  const ids = new Set(), topics = {};
  for (const q of [...V.ITEMS, ...V.PASSAGES.flatMap(p => p.questions)]) {
    assert(!ids.has(q.id), 'unique id ' + q.id); ids.add(q.id);
    assert.equal(q.options.length, 4, q.id); assert.equal(new Set(q.options).size, 4, q.id); assert(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, q.id);
    assert(q.prompt && q.explanation, q.id); assert(!/<|>|<\/script/i.test(q.prompt + q.options.join('') + q.explanation), 'plain text only: ' + q.id);
  }
  for (const i of V.ITEMS) { assert(A.LEVEL_IDS.includes(i.level) && i.tip, i.id); topics[i.topic] = (topics[i.topic] || 0) + 1; }
  assert.deepEqual(Object.keys(topics).sort(), ['error', 'fill-blank', 'para-jumble', 'vocab']); assert(V.ITEMS.length >= 40);
  for (const t of Object.keys(topics)) assert(new Set(V.ITEMS.filter(i => i.topic === t).map(i => i.answer)).size >= 3, t + ' answers are not all in one position');
  for (const i of V.ITEMS.filter(i => i.topic === 'error')) assert.deepEqual(i.options, ['(A)', '(B)', '(C)', 'No error']);
  for (const i of V.ITEMS.filter(i => i.topic === 'para-jumble')) assert(i.options.every(o => [...o].sort().join('') === 'PQRS'), i.id);
  assert(V.PASSAGES.length >= 4); for (const p of V.PASSAGES) { assert(p.questions.length >= 3 && p.questions.length <= 4, p.id); assert(p.text.split(/\s+/).length > 120, p.id); assert(A.LEVEL_IDS.includes(p.level)); }
  for (const t of ['vocab', 'fill-blank', 'error', 'para-jumble', 'reading']) for (const l of A.LEVEL_IDS) { const q = A.generate(t, l, A.rng(3)); assert.equal(q.topic, t); assert.equal(q.options[q.answer], q.display); }
});


/* ---------- UI (jsdom) ---------- */
const state = f => f.run('Aptitude.state()');
const doc = f => f.w.document;
const pick = (f, value) => { const el = f.$(value[0]); el.value = value[1]; el.dispatchEvent(new f.w.Event('change', { bubbles: true })); };
function setupTest(f, { sections = ['quant'], per = '5', pace = '36', negative = '1', timing = 'total' } = {}) {
  f.$('aptitudeNav').click();
  doc(f).querySelectorAll('[name=aptTestSection]').forEach(x => { x.checked = sections.includes(x.value); x.dispatchEvent(new f.w.Event('change', { bubbles: true })); });
  pick(f, ['aptPer', per]); pick(f, ['aptPace', pace]); pick(f, ['aptNegative', negative]);
  const t = doc(f).querySelector(`[name=aptTiming][value=${timing}]`); t.checked = true; t.dispatchEvent(new f.w.Event('change', { bubbles: true }));
  f.$('aptTest').click();
}
const choose = (f, i) => doc(f).querySelector(`.apt-option[data-opt="${i}"]`).click();
const now = f => f.run('Date.now()');
const advance = (f, ms) => { const t = now(f) + ms; f.run(`Date.now = () => ${t}`); f.run('Aptitude.tick()'); };
const storage = f => { const out = {}; for (const k of Object.keys(f.w.localStorage)) out[k] = f.w.localStorage.getItem(k); return out; };

test('a full timed test: palette, mark for review, negative marking and auto-submit when time runs out', () => {
  const f = fixture(); try {
    assert(f.$('round-aptitude'), 'the home page leads to aptitude practice');
    setupTest(f); assert.equal(f.w.location.hash, '#aptitude');
    const run = state(f).run; assert.equal(run.mode, 'test'); assert.equal(run.questions.length, 5); assert.equal(run.negative, 0.25);
    assert(run.questions.every(q => q.section === 'quant')); assert.equal(f.$('aptClock').textContent, '3:00 left');
    assert.equal(doc(f).querySelectorAll('.apt-pal-btn').length, 5); assert(!f.$('aptFeedback'), 'no feedback during a test');
    const qs = run.questions;
    choose(f, qs[0].answer); assert(doc(f).querySelector('.apt-pal-btn.current').classList.contains('answered'));
    f.$('aptNextQ').click(); choose(f, (qs[1].answer + 1) % 4);
    f.$('aptNextQ').click(); choose(f, qs[2].answer); f.$('aptMark').click();
    assert.equal(f.$('aptMark').getAttribute('aria-pressed'), 'true'); assert(doc(f).querySelector('[data-go="2"]').classList.contains('marked'));
    f.$('aptNextQ').click(); choose(f, 0); f.$('aptClearAns').click(); assert.equal(state(f).run.answers[3], null, 'clear response');
    assert(doc(f).querySelector('[data-go="3"]').classList.contains('skipped')); assert(doc(f).querySelector('[data-go="4"]').classList.contains('fresh'));
    doc(f).querySelector('[data-go="0"]').click(); assert.equal(state(f).run.index, 0); assert(doc(f).querySelector('.apt-option.chosen'), 'earlier answer is shown');
    advance(f, 100000); assert.equal(f.$('aptClock').textContent, '1:20 left'); assert.equal(state(f).run.seconds[0] >= 100, true, 'time is charged to the open question');
    advance(f, 81000);
    assert.equal(state(f).run, null); assert.equal(state(f).screen, 'results');
    assert.equal(f.$('aptHeadline').textContent, 'Score 1.75 / 5', '2 correct − 1 wrong × 0.25');
    assert(doc(f).querySelector('.eyebrow').textContent.includes('TIME RAN OUT'));
    const h = JSON.parse(f.w.localStorage.getItem('cr-aptitude-history'));
    assert.equal(h.length, 1); assert.deepEqual([h[0].mode, h[0].auto, h[0].correct, h[0].wrong, h[0].unanswered, h[0].score], ['test', true, 2, 1, 2, 1.75]);
    assert.equal(f.w.localStorage.getItem('cr-aptitude-run'), 'null');
    assert.equal(doc(f).querySelectorAll('.drill-review').length, 5); assert(doc(f).querySelector('.drill-review.miss .drill-steps li'), 'missed questions show the worked solution');
    f.$('aptDownload').click();
    assert.deepEqual([...doc(f).querySelectorAll('.actions .primary')].map(x => x.id), ['aptRetry']);
    f.$('aptRetry').click(); assert.equal(state(f).run.mode, 'practice'); assert.equal(state(f).run.questions.length, 1, 'retry only the wrong answer'); assert.equal(state(f).run.origin, 'retry');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('sectional timers move on when a section runs out and lock earlier sections', () => {
  const f = fixture(); try {
    setupTest(f, { sections: ['quant', 'verbal'], per: '5', pace: '60', negative: '0', timing: 'sectional' });
    assert.equal(doc(f).querySelectorAll('.apt-pal-btn').length, 5, 'only the current section is on the palette'); assert(f.$('aptFinishSection'));
    choose(f, state(f).run.questions[0].answer);
    advance(f, 300000); assert.equal(state(f).run.sectionIndex, 1); assert.equal(state(f).run.index, 5); assert.equal(state(f).run.questions[5].section, 'verbal');
    assert.equal(f.$('aptClock').textContent, '5:00 left', 'the next section gets its own time'); assert(!doc(f).querySelector('[data-go="0"]'), 'earlier section is locked');
    assert(f.$('aptSubmit')); advance(f, 300000);
    assert.equal(state(f).screen, 'results'); assert.equal(f.$('aptHeadline').textContent, 'Score 1 / 10'); assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('an unfinished test resumes after reload with the remaining time intact; corrupt storage is ignored', () => {
  const f = fixture(); let g, h; try {
    setupTest(f, { pace: '60' }); const q0 = state(f).run.questions[0];
    choose(f, q0.answer); f.$('aptNextQ').click(); f.$('aptMark').click();
    advance(f, 100000); f.w.dispatchEvent(new f.w.Event('pagehide'));
    g = fixture({ url: 'https://case.example/#aptitude', storage: storage(f) });
    assert.equal(g.run('view'), 'aptitude'); assert(g.$('aptResume'), 'resume offered'); assert(g.$('app').textContent.includes('3:20 left'));
    g.$('aptResume').click(); assert.equal(g.$('aptClock').textContent, '3:20 left'); assert.equal(state(g).run.index, 1); assert.equal(state(g).run.answers[0], q0.answer); assert.equal(state(g).run.marked[1], true);
    assert.equal(state(g).run.questions[0].prompt, q0.prompt);
    advance(g, 30000); assert.equal(g.$('aptClock').textContent, '2:50 left');
    g.$('aptPause').click(); advance(g, 60 * 60000); const el = state(g).run.elapsed; assert(el >= 130000 && el < 131000, 'the clock is paused away from the test: ' + el);

    const bad = JSON.parse(storage(f)['cr-aptitude-run']); bad.questions[2].options = ['1', '1', '2', '3'];
    for (const run of [bad, { ...JSON.parse(storage(f)['cr-aptitude-run']), answers: [9, null, null, null, null] }, { ...JSON.parse(storage(f)['cr-aptitude-run']), elapsed: 'x' }, { mode: 'test' }, 'oops']) {
      h = fixture({ url: 'https://case.example/#aptitude', storage: { 'cr-aptitude-run': JSON.stringify(run), 'cr-aptitude-history': JSON.stringify([{ id: 1 }, { id: 'ok', at: 5, mode: 'practice', results: [{ topic: 'percent', ok: true, answered: true, seconds: 3 }] }, null]), 'cr-aptitude-prefs': '{"level":"impossible","perSection":7,"sections":["bogus"],"negative":0.9}' } });
      assert.equal(h.$('aptResume'), null); assert.equal(state(h).history.length, 1, 'only the valid history entry is kept');
      assert.equal(h.$('aptPer').value, '10'); assert.equal(h.$('aptNegative').value, '0'); assert.equal(doc(h).querySelectorAll('[name=aptTestSection]:checked').length, 3); assert.deepEqual(h.errors, []);
      h.dom.window.close(); h = null;
    }
    h = fixture({ url: 'https://case.example/#aptitude', storage: { 'cr-aptitude-run': '{not json', 'cr-aptitude-history': '"oops"', 'cr-aptitude-prefs': '[]' } });
    assert.equal(h.$('aptResume'), null); assert.equal(state(h).history.length, 0); assert.deepEqual([...f.errors, ...g.errors, ...h.errors], []);
  } finally { f.dom.window.close(); g?.dom.window.close(); h?.dom.window.close(); }
});

test('topic practice gives instant feedback, solutions and shortcuts, then feeds progress and the weakest-topic suggestion', () => {
  const f = fixture(); try {
    f.run('Aptitude.open()');
    const logical = doc(f).querySelector('[name=aptSection][value=logical]'); logical.checked = true; logical.dispatchEvent(new f.w.Event('change', { bubbles: true }));
    doc(f).querySelectorAll('[name=aptTopic]').forEach(x => { x.checked = ['seating', 'syllogism'].includes(x.value); }); f.$('aptTopics').dispatchEvent(new f.w.Event('change', { bubbles: true }));
    pick(f, ['aptCount', '5']); f.$('aptPractice').click();
    let run = state(f).run; assert.equal(run.mode, 'practice'); assert.equal(run.questions.length, 5); assert(run.questions.every(q => ['seating', 'syllogism'].includes(q.topic)));
    for (let i = 0; i < 5; i++) {
      const q = state(f).run.questions[i];
      if (i === 1) f.$('aptReveal').click(); else choose(f, i === 2 ? (q.answer + 1) % 4 : q.answer);
      const fb = f.$('aptFeedback'); assert(fb.textContent.includes(i === 1 ? 'Worked solution' : i === 2 ? 'Not quite' : 'Correct'));
      assert(fb.textContent.includes(q.display)); assert.equal(fb.querySelectorAll('.drill-steps li').length, q.solution.length); assert(fb.textContent.includes('Shortcut'));
      assert(doc(f).querySelector('.apt-option.right'), 'the right option is highlighted'); f.$('aptNext').click();
    }
    assert.equal(f.$('aptHeadline').textContent, '3 of 5 correct'); assert(f.$('aptRetry').textContent.includes('2'));
    const h = JSON.parse(f.w.localStorage.getItem('cr-aptitude-history')); assert.equal(h[0].mode, 'practice'); assert.equal(h[0].results.length, 5);
    assert.deepEqual(JSON.parse(f.w.localStorage.getItem('cr-aptitude-prefs')).topics.logical, ['seating', 'syllogism']);
    // Enough misses on one topic produce a suggestion that starts a focused set.
    f.run(`(() => { const s = Aptitude.state(); for (let i = 0; i < 6; i++) s.history.push({ id: 'x' + i, at: i, mode: 'practice', results: [{ topic: 'pipes', ok: false, answered: true, seconds: 40 }] }); })()`);
    f.$('aptBack').click(); assert(f.$('aptWeak').textContent.includes('pipes'), 'weakest topic suggested'); f.$('aptWeak').click();
    run = state(f).run; assert(run.questions.every(q => q.topic === 'pipes')); assert.equal(run.origin, 'weakest');
    f.$('aptExit').click(); f.$('aptDiscard').click(); assert.equal(state(f).run, null);
    f.$('aptClear').click(); assert.equal(f.w.localStorage.getItem('cr-aptitude-history'), '[]'); assert(!f.$('aptClear'), 'history deleted');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('the setup offers all five levels, a two-minute pace and the Hard-to-Expert test band', () => {
  const f = fixture(); try {
    f.$('aptitudeNav').click();
    const radios = [...doc(f).querySelectorAll('[name=aptLevel]')].map(x => x.value); assert.deepEqual(radios, ['easy', 'medium', 'hard', 'advanced', 'expert']);
    const expert = doc(f).querySelector('[name=aptLevel][value=expert]'); expert.checked = true; expert.dispatchEvent(new f.w.Event('change', { bubbles: true }));
    pick(f, ['aptCount', '5']); f.$('aptPractice').click();
    let run = state(f).run; assert.equal(run.level, 'expert'); assert(run.questions.every(q => q.level === 'expert'));
    assert(f.$('app').textContent.includes('EXPERT'), 'the level is shown during practice');
    f.$('aptExit').click(); f.$('aptDiscard').click();
    assert([...f.$('aptTestLevel').options].some(o => o.value === 'mixed-high')); assert([...f.$('aptPace').options].some(o => o.value === '120'));
    pick(f, ['aptTestLevel', 'mixed-high']); setupTest(f, { sections: ['logical', 'verbal'], per: '10', pace: '120' });
    run = state(f).run; assert.equal(run.level, 'mixed-high'); assert.equal(run.pace, 120); assert(run.questions.every(q => ['hard', 'advanced', 'expert'].includes(q.level)));
    assert.equal(JSON.parse(f.w.localStorage.getItem('cr-aptitude-prefs')).testLevel, 'mixed-high');
    f.$('aptSubmit').click(); assert(f.$('app').textContent.includes('MIXED: HARD TO EXPERT'));
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('aptitude practice does not interfere with case sessions, the drill, peer interviews or behavioural practice', () => {
  const f = fixture(); try {
    f.run("start('cement')"); f.$('answer').value = 'Case answer'; f.$('answer').dispatchEvent(new f.w.Event('input'));
    f.run('CaseDrill.open()'); f.$('drillStart').click(); f.run("PeerMock.start('market')"); f.run('Behavioural.open()'); f.$('bhStart').click();
    const snap = () => ({ session: f.run('JSON.stringify(session)'), drill: f.run('JSON.stringify(CaseDrill.state().run)'), peer: f.run('JSON.stringify(PeerMock.state().run)'), bh: f.run('JSON.stringify(Behavioural.state().draft)') });
    const before = snap();
    setupTest(f, { sections: ['logical', 'verbal'] }); choose(f, 0); f.$('aptSubmit').click();
    f.$('aptAgain').click(); f.$('aptPause').click(); f.$('aptPractice').click(); choose(f, 0);
    assert.deepEqual(snap(), before);
    assert.equal(f.run('history.length'), 0, 'aptitude attempts are not case sessions'); assert.equal(f.run('CaseDrill.state().runs.length'), 0); assert.equal(f.run('PeerMock.state().past.length'), 0); assert.equal(f.run('Behavioural.state().attempts.length'), 0);
    assert.deepEqual(Object.keys(f.w.localStorage).filter(k => k.startsWith('cr-aptitude-')).sort(), ['cr-aptitude-history', 'cr-aptitude-prefs', 'cr-aptitude-run']);
    f.$('homeNav').click(); assert.equal(f.w.location.hash, ''); assert.equal(doc(f).querySelectorAll('.round-tile').length, 5);
    f.$('round-aptitude').click(); assert.equal(f.run('view'), 'aptitude'); assert(f.$('aptResume'), 'the replaced practice set can be resumed');
    f.$('casesNav').click(); f.$('caseTool-drill').click(); assert.equal(f.w.location.hash, '#drill'); assert(f.$('drillResume'), 'the drill round is still there');
    f.$('aptitudeNav').click(); assert.equal(f.w.location.hash, '#aptitude');
    f.$('privacy').click(); assert(f.$('modalContent').textContent.includes('Placement aptitude practice'));
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('presets use only settings the timed test offers, and picking one fills the form for a matching test', () => {
  const P = require('../content/aptitude-presets.js');
  assert(P.PRESETS.length >= 3 && P.NOTE.includes('Approximate'));
  assert.equal(new Set(P.PRESETS.map(p => p.id)).size, P.PRESETS.length);
  for (const p of P.PRESETS) {
    assert(p.title && p.shape && p.examples, p.id);
    const s = p.settings;
    assert(s.sections.length && s.sections.every(x => A.SECTIONS.some(y => y.id === x)), p.id);
    assert([5, 10, 20, 30].includes(s.perSection) && [36, 60, 90, 120].includes(s.pace) && ['total', 'sectional'].includes(s.timing) && [0, 0.25, 1 / 3, 0.5].includes(s.negative), p.id);
    assert(A.LEVEL_IDS.includes(s.testLevel) || A.MIXES[s.testLevel], p.id);
  }
  const f = fixture(); try {
    f.$('aptitudeNav').click();
    assert.equal(doc(f).querySelectorAll('.apt-preset').length, P.PRESETS.length);
    const adv = P.PRESETS.find(p => p.id === 'advanced');
    doc(f).querySelector('[data-preset="advanced"]').click();
    assert(doc(f).querySelector('[data-preset="advanced"]').classList.contains('chosen'));
    assert(f.$('aptPresetNote').textContent.includes(adv.title));
    assert.equal(f.$('aptPer').value, String(adv.settings.perSection)); assert.equal(f.$('aptPace').value, String(adv.settings.pace)); assert.equal(f.$('aptTestLevel').value, adv.settings.testLevel);
    assert.deepEqual([...doc(f).querySelectorAll('[name=aptTestSection]:checked')].map(x => x.value), adv.settings.sections);
    assert.deepEqual(JSON.parse(f.w.localStorage.getItem('cr-aptitude-prefs')).sections, adv.settings.sections, 'the choice is remembered');
    f.$('aptTest').click();
    const run = state(f).run; assert.equal(run.questions.length, 20); assert.equal(run.pace, 120); assert(run.questions.every(q => ['quant', 'logical'].includes(q.section)));
    assert(run.questions.every(q => ['hard', 'advanced', 'expert'].includes(q.level)));
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('timed-test results separate wrong, skipped and not reached, and average time covers attempted questions only', () => {
  const f = fixture(); try {
    setupTest(f, { per: '30', pace: '36', negative: '0' });
    const qs = state(f).run.questions; assert.equal(qs.length, 30);
    choose(f, qs[0].answer); advance(f, 12000);
    f.$('aptNextQ').click(); advance(f, 5000); // visited, left unanswered
    f.$('aptSubmit').click();
    assert.equal(state(f).screen, 'results');
    const n = id => Number(f.$(id).textContent);
    assert.deepEqual([n('aptCntRight'), n('aptCntWrong'), n('aptCntSkipped'), n('aptCntUnreached')], [1, 0, 1, 28]);
    const grid = doc(f).querySelector('.score-grid'), tiles = [...grid.children].map(d => d.textContent);
    const avg = tiles.find(t => t.includes('Average time'));
    assert(avg.includes('per attempted question') && !avg.startsWith('0s') && !avg.startsWith('—'), avg);
    const buttons = [...doc(f).querySelectorAll('.actions button')].map(b => b.textContent);
    assert(!buttons.some(t => t.includes('I missed')), buttons.join('|'));
    assert(!f.$('aptRetry'), 'nothing was answered wrongly');
    assert(f.$('aptLeft').textContent.includes('29'), f.$('aptLeft').textContent);
    assert.deepEqual([...doc(f).querySelectorAll('.actions .primary')].map(x => x.id), ['aptLeft']);
    const touched = qs[0].topic, rows = [...doc(f).querySelectorAll('.drill-table tbody tr')];
    const untouched = rows.filter(r => !r.querySelector('th').textContent.startsWith(A.topicOf(touched).title));
    assert(untouched.length, 'some topics were never attempted');
    for (const r of untouched) { const cells = [...r.querySelectorAll('td')].map(c => c.textContent); assert.equal(cells[0], '—'); assert.equal(cells[2], '—'); assert(/^0 of \d+$/.test(cells[1]), cells[1]); }
    f.$('aptDownload').click();
    f.$('aptLeft').click(); assert.equal(state(f).run.mode, 'practice'); assert.equal(state(f).run.questions.length, 29); assert.equal(state(f).run.origin, 'retry');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('a timed test with wrong answers offers both retry buttons; the text summary lists the three states', () => {
  const f = fixture(); try {
    setupTest(f, { per: '5', pace: '36', negative: '0' });
    const qs = state(f).run.questions;
    choose(f, (qs[0].answer + 1) % 4); f.$('aptNextQ').click(); advance(f, 3000); f.$('aptNextQ').click();
    f.$('aptSubmit').click();
    assert.deepEqual([...doc(f).querySelectorAll('.actions .primary')].map(x => x.id), ['aptRetry']);
    assert(f.$('aptRetry').textContent.includes('1 I got wrong')); assert(f.$('aptLeft').textContent.includes('4 I left unanswered'));
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('in the results review a reading passage stays collapsed and says how to show it; in the test it is open', () => {
  const f = fixture(); try {
    setupTest(f, { sections: ['verbal'], per: '30', pace: '36', negative: '0' });
    const run = state(f).run, at = run.questions.findIndex(q => q.passage); assert(at >= 0, 'a 30-question verbal test includes reading passages');
    doc(f).querySelector(`[data-go="${at}"]`).click(); assert(doc(f).querySelector('.apt-passage[open] summary').textContent.startsWith('Passage:'));
    f.$('aptSubmit').click();
    const d = doc(f).querySelector('.drill-review .apt-passage'); assert(d && !d.open, 'collapsed in the review');
    assert(d.querySelector('summary').textContent.startsWith('Show the passage: '), d.querySelector('summary').textContent);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('A.outcome: practice counts a shown solution as a miss; older results without visited use time spent', () => {
  const q = { answer: 2 };
  assert.equal(A.outcome({ q, choice: 2 }, 'test'), 'right'); assert.equal(A.outcome({ q, choice: 1 }, 'test'), 'wrong');
  assert.equal(A.outcome({ q, choice: null, seconds: 4 }, 'practice'), 'wrong');
  assert.equal(A.outcome({ q, choice: null, seconds: 0, visited: true }, 'test'), 'skipped'); assert.equal(A.outcome({ q, choice: null, seconds: 9, visited: false }, 'test'), 'unreached');
  assert.equal(A.outcome({ q, choice: null, seconds: 7 }, 'test'), 'skipped', 'legacy: time spent means it was seen');
  assert.equal(A.outcome({ q, choice: null, seconds: 0 }, 'test'), 'unreached', 'legacy: no time means never reached');
});

test('count questions with an integer answer never offer a fractional option', () => {
  let checked = 0; const bad = [];
  each((q, topic, level, kind) => {
    if (!/\bhow many\b/i.test(q.prompt) || !/^[\d,]+$/.test(q.display)) return;
    checked++; for (const o of q.options) if (!/^[\d,]+$/.test(o)) bad.push(`${kind}/${level}: ${o} for "${q.prompt.slice(0, 60)}"`);
  }, 200);
  assert(checked > 500, 'the sweep covers many count questions: ' + checked); assert.deepEqual([...new Set(bad)].slice(0, 5), []);
});

test('seating questions never offer the person they ask about as an option', () => {
  let asked = 0;
  for (const level of A.LEVEL_IDS) for (const kind of new Set(A.KINDS.seating[level])) for (let s = 1; s <= 300; s++) {
    const q = A.generate('seating', level, A.rng(s * 104729 + level.length), kind);
    assert.equal(q.options.length, 4); assert.equal(new Set(q.options).size, 4);
    const who = q.prompt.split('\n').pop().match(/(?:of|opposite) ([A-Z][a-z]+)\?$/);
    if (!who) continue; asked++;
    assert(!q.options.includes(who[1]), `${kind}/${level} seed ${s}: ${who[1]} offered in ${q.options.join(', ')}`);
    assert.equal(q.options[q.answer], q.display);
  }
  assert(asked > 500, 'covers row and circular questions about a person: ' + asked);
});

test('the syllogism tip states which statements reverse', () => {
  const q = A.generate('syllogism', 'medium', A.rng(5));
  assert(q.shortcut.includes('“Some A are B” can be reversed to “Some B are A”') && q.shortcut.includes('neither can “Some A are not B”'), q.shortcut);
});

test('verbal explanations and tips never refer to an option by its position', () => {
  const POSITION = /\b(first|second|third|fourth|last) (option|choice)\b|\boption [A-D]\b/i;
  const LOOSE = /\b(first|second|third|fourth|last)( and (first|second|third|fourth|last))? (options|choices)\b|\bthe (first|second|third|last) (ignores|contradicts|goes|is)\b/i;
  const texts = [];
  for (const it of V.ITEMS) texts.push(it.explanation, it.tip);
  for (const p of V.PASSAGES) for (const q of p.questions) texts.push(q.explanation, q.tip);
  assert(texts.filter(Boolean).length > 100);
  for (const t of texts.filter(Boolean)) { assert(!POSITION.test(t), t); assert(!LOOSE.test(t), t); }
});

/* ---------- Exam conditions, placement notices and shared papers (jsdom, faked time) ---------- */
const E = require('../src/aptitude-exam.js');
const setNow = (f, t) => f.run(`Date.now = () => ${t}`);
const setVis = (f, v) => { Object.defineProperty(f.w.document, 'visibilityState', { value: v, configurable: true }); f.w.document.dispatchEvent(new f.w.Event('visibilitychange')); };
const hide = f => setVis(f, 'hidden'), show = f => setVis(f, 'visible');
const text = f => f.$('app').textContent;
const toastText = f => f.$('toast').textContent;
function prep(f, { sections = ['quant'], per = '5', pace = '36', negative = '1', timing = 'total', strict = true, nav = 'free' } = {}) {
  f.$('aptitudeNav').click();
  doc(f).querySelectorAll('[name=aptTestSection]').forEach(x => { x.checked = sections.includes(x.value); x.dispatchEvent(new f.w.Event('change', { bubbles: true })); });
  pick(f, ['aptPer', per]); pick(f, ['aptPace', pace]); pick(f, ['aptNegative', negative]);
  const t = doc(f).querySelector(`[name=aptTiming][value=${timing}]`); t.checked = true; t.dispatchEvent(new f.w.Event('change', { bubbles: true }));
  f.$('aptStrict').checked = strict; f.$('aptStrict').dispatchEvent(new f.w.Event('change', { bubbles: true })); pick(f, ['aptNav', nav]);
}
function strictTest(f, o = {}) { setNow(f, now(f)); prep(f, o); f.$('aptTest').click(); assert.equal(state(f).screen, 'brief', 'the brief comes first'); assert.equal(state(f).run, null, 'nothing runs before Start'); f.$('aptBegin').click(); return now(f); }
const plain = x => JSON.parse(JSON.stringify(x));
const GAP = /undefined|null|NaN|\[object/;
const noGaps = f => { assert.doesNotMatch(text(f), GAP, text(f).slice(0, 200)); assert.doesNotMatch(f.$('app').innerHTML.replace(/<[^>]*>/g, ' '), GAP); };

test('exam conditions: the brief comes first, the clock starts on Start, and there is no Save & exit', () => {
  const f = fixture(); try {
    let fs = 0; f.w.document.documentElement.requestFullscreen = () => { fs++; return Promise.reject(new Error('not allowed')); };
    prep(f); assert(f.$('aptTestSummary').textContent.includes('Exam conditions'), 'the summary mentions exam conditions');
    assert.equal(JSON.parse(f.w.localStorage.getItem('cr-aptitude-prefs')).strict, true);
    const t0 = now(f); f.$('aptTest').click(); assert.equal(state(f).screen, 'brief'); noGaps(f);
    for (const w of ['Timed test', 'Quantitative', 'Marking', 'Move freely between questions', 'The clock does not pause', 'guess your score']) assert(text(f).includes(w), w);
    assert(doc(f).querySelector('#aptBrief table td').textContent === '5'); assert.equal(fs, 0, 'no full screen before Start');
    setNow(f, t0 + 50000); f.$('aptBegin').click(); const run = state(f).run;
    assert.deepEqual([run.strict, run.nav, run.left, run.away, run.clockAt], [true, 'free', 0, false, t0 + 50000], 'the clock starts at Start');
    assert.equal(f.$('aptClock').textContent, '3:00 left'); assert.equal(f.$('aptPause'), null, 'no Save & exit'); assert(f.$('aptExamNote').textContent.includes('Exam conditions: the clock does not pause.')); assert.equal(f.$('aptLeftNote'), null);
    assert.equal(fs, 1, 'full screen is requested once'); assert.equal(f.w.location.hash, '#aptitude');
    f.$('aptitudeNav').click(); f.$('aptResume').click(); assert.equal(fs, 1, 'resuming does not ask again');
    assert.deepEqual(f.errors, []);
    const g = fixture(); try { prep(g, { strict: false }); g.$('aptTest').click(); assert.equal(state(g).screen, 'test', 'ordinary tests start at once'); assert(g.$('aptPause')); assert.equal(state(g).run.strict, undefined); } finally { g.dom.window.close(); }
    const h = fixture(); try { h.$('aptitudeNav').click(); assert.equal(h.$('aptStrict').checked, false, 'off by default'); assert.equal(h.$('aptNav').value, 'free'); } finally { h.dom.window.close(); }
  } finally { f.dom.window.close(); }
});

test('exam conditions: the clock keeps running on the home page and across a reload', () => {
  const f = fixture(); let g; try {
    const t0 = strictTest(f); choose(f, state(f).run.questions[0].answer);
    setNow(f, t0 + 10000); f.run('Aptitude.tick()'); assert.equal(f.$('aptClock').textContent, '2:50 left');
    f.$('aptitudeNav').click(); assert.equal(state(f).run.left, 1, 'going to another screen is a leave'); assert.equal(state(f).screen, 'home');
    assert(f.$('aptResume').closest('section').textContent.includes('Exam in progress · 2:50 left · the clock is running'));
    setNow(f, t0 + 70000); f.run('Aptitude.tick()'); assert(text(f).includes('Exam in progress · 1:50 left · the clock is running'), 'the figure follows the clock');
    f.$('aptitudeNav').click(); assert(text(f).includes('1:50 left'), 'and is current when the page is drawn');
    f.$('aptResume').click(); assert.equal(f.$('aptClock').textContent, '1:50 left');
    const r = state(f).run; assert.deepEqual([r.left, r.awayMs, r.away, r.elapsed, r.seconds[0]], [1, 60000, false, 70000, 10], 'time away is not charged to the question');
    assert.equal(f.$('aptLeftNote').textContent, 'You left the test 1 time, 1:00 away in total. The clock kept running.');
    f.w.dispatchEvent(new f.w.Event('pagehide')); assert.equal(state(f).run.left, 2); assert.equal(state(f).run.away, true);
    g = fixture({ url: 'https://case.example/#aptitude', storage: storage(f) }); setNow(g, t0 + 100000);
    g.$('aptitudeNav').click(); assert(text(g).includes('Exam in progress · 1:20 left'), text(g).slice(0, 300)); assert.equal(state(g).run.left, 2, 'a reload that fired pagehide is counted once');
    g.$('aptResume').click(); assert.equal(g.$('aptClock').textContent, '1:20 left'); assert.equal(state(g).run.awayMs, 90000); assert.equal(state(g).run.answers[0], state(f).run.answers[0]);
    assert(g.$('aptLeftNote').textContent.includes('You left the test 2 times, 1:30 away in total.'));
    assert.deepEqual([...f.errors, ...g.errors], []);
  } finally { f.dom.window.close(); g?.dom.window.close(); }
});

test('exam conditions: a sectional absence that ends a section lands in the next one', () => {
  const f = fixture(); try {
    const t0 = strictTest(f, { sections: ['quant', 'verbal'], pace: '60', timing: 'sectional' }); assert.equal(f.$('aptClock').textContent, '5:00 left');
    choose(f, state(f).run.questions[0].answer); setNow(f, t0 + 60000); hide(f);
    assert.deepEqual([state(f).run.left, state(f).run.away], [1, true]);
    setNow(f, t0 + 390000); f.run('Aptitude.tick()'); assert.equal(state(f).run.sectionIndex, 1, 'the clock moves on while away, without ending the test');
    show(f); const r = state(f).run;
    assert.deepEqual([r.sectionIndex, r.index, r.questions[r.index].section, r.away], [1, 5, 'verbal', false]); assert.equal(f.$('aptClock').textContent, '3:30 left', 'the next section had 1:30 used');
    assert(toastText(f).includes('Time ran out for Quantitative while you were away') && toastText(f).includes('Verbal'), toastText(f));
    assert.equal(f.$('aptLeftNote').textContent, 'You left the test 1 time, 5:30 away in total. The clock kept running.'); assert(!doc(f).querySelector('[data-go="0"]'), 'the finished section is locked');
    assert.equal(r.answers[0], r.questions[0].answer, 'the answer given before leaving is kept');
    f.$('aptitudeNav').click(); setNow(f, t0 + 390000 + 600000); f.$('aptitudeNav').click(); assert.equal(state(f).screen, 'predict', 'opening the tool after the end submits the test');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('exam conditions: an absence past the end submits on return and the result is saved before the guess', () => {
  const f = fixture(); let g; try {
    const t0 = strictTest(f); const qs = state(f).run.questions; choose(f, qs[0].answer); f.$('aptNextQ').click(); choose(f, qs[1].answer);
    setNow(f, t0 + 20000); hide(f); setNow(f, t0 + 1000000); show(f);
    assert.equal(state(f).run, null); assert.equal(state(f).screen, 'predict'); noGaps(f);
    assert(toastText(f).includes('Time ran out while you were away. Your test was submitted.'));
    const h = JSON.parse(f.w.localStorage.getItem('cr-aptitude-history')); assert.equal(h.length, 1, 'recorded before the predict screen');
    assert.deepEqual([h[0].strict, h[0].left, h[0].auto, h[0].correct, h[0].elapsed], [true, 1, true, 2, 180]);
    assert(text(f).includes('Before you see your score: how many of the 5 questions do you think you got right?'));
    assert.equal(f.$('aptGuess').max, '5'); f.$('aptGuess').value = '7'; f.$('aptReveal').click(); assert.equal(state(f).screen, 'predict', 'a guess out of range is refused'); assert(f.$('aptGuessErr').textContent.includes('0 to 5'));
    g = fixture({ url: 'https://case.example/#aptitude', storage: storage(f) });
    assert.equal(state(g).screen, 'results', 'after a reload the student lands on the results directly'); assert.match(g.$('aptHeadline').textContent, /^Score [\d.]+ \/ 5$/); assert(g.$('aptExam')); assert(!text(g).includes('You guessed'));
    g.$('aptBack').click(); assert.equal(g.$('aptResume'), null, 'nothing is left to resume'); assert.equal(JSON.parse(g.w.localStorage.getItem('cr-aptitude-run')), null, 'shown once, then cleared');
    f.$('aptGuess').value = '4'; f.$('aptReveal').click(); assert.equal(state(f).screen, 'results'); assert.equal(f.w.localStorage.getItem('cr-aptitude-run'), 'null');
    assert(doc(f).querySelector('.eyebrow').textContent.includes('TIME RAN OUT'));
    assert.equal(f.$('aptExam').querySelectorAll('p')[0].textContent, 'You guessed 4 right. You got 2.');
    assert(f.$('aptExam').textContent.includes('You left the test 1 time, 2:40 away in total') && f.$('aptExam').textContent.includes('time ran out'), f.$('aptExam').textContent);
    noGaps(f);
    assert.deepEqual([...f.errors, ...g.errors], []);
  } finally { f.dom.window.close(); g?.dom.window.close(); }
});

test('exam conditions: leaving is counted once per absence, with a banner on return', () => {
  const f = fixture(); try {
    const t0 = strictTest(f); setNow(f, t0 + 5000); hide(f); hide(f); f.w.dispatchEvent(new f.w.Event('pagehide')); assert.equal(state(f).run.left, 1, 'hidden, hidden and pagehide are one absence');
    f.$('aptitudeNav').click(); assert.equal(state(f).run.left, 1, 'nor does going to another screen while already away');
    setNow(f, t0 + 17000); f.$('aptResume').click(); assert.equal(f.$('aptLeftNote').getAttribute('role'), 'status'); assert.equal(f.$('aptLeftNote').textContent, 'You left the test 1 time, 0:12 away in total. The clock kept running.');
    setNow(f, t0 + 20000); hide(f); assert.equal(state(f).run.left, 2); setNow(f, t0 + 30000); show(f);
    assert.equal(f.$('aptLeftNote').textContent, 'You left the test 2 times, 0:22 away in total. The clock kept running.', 'no switch limit, so no count of exits left');
    f.run('document.dispatchEvent(new Event("fullscreenchange"))'); assert.equal(state(f).run.left, 3, 'leaving full screen counts as leaving (jsdom has no full-screen element)');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('exam conditions: a notice with a switch limit of 3 ends the test at the third absence', () => {
  const notice = { id: 'drive1', name: 'Drive 1', source: '', sections: [{ id: 'quant', count: 5, minutes: 10 }], timing: 'total', negative: 0, level: 'easy', nav: 'free', strict: true, switchLimit: 3 };
  const f = fixture({ storage: { 'cr-aptitude-notices': JSON.stringify([notice]) } }); try {
    f.$('aptitudeNav').click(); doc(f).querySelector('[data-notice-start]').click(); f.$('aptBegin').click(); let t = now(f);
    hide(f); t += 5000; setNow(f, t); show(f); assert(f.$('aptLeftNote').textContent.includes('You can leave 2 more times before the test is submitted.'), f.$('aptLeftNote').textContent);
    hide(f); t += 5000; setNow(f, t); show(f); assert(f.$('aptLeftNote').textContent.includes('You can leave 1 more time before the test is submitted.'));
    assert(state(f).run, 'still running after two absences'); hide(f);
    assert.equal(state(f).run, null); assert.equal(state(f).screen, 'predict'); assert(toastText(f).includes('You left the test 3 times. Your test was submitted.'));
    const h = JSON.parse(f.w.localStorage.getItem('cr-aptitude-history')); assert.deepEqual([h.length, h[0].ended, h[0].auto, h[0].left, h[0].name], [1, 'switches', true, 3, 'Drive 1']);
    f.$('aptSkipGuess').click(); assert(doc(f).querySelector('.eyebrow').textContent.includes('LEAVING THE TEST')); assert(f.$('aptExam').textContent.includes('The test ended after you left it 3 times.')); assert(f.$('aptExam').textContent.includes('You skipped the guess.'));
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('forward-only navigation: no Previous or marking, earlier questions disabled, and Aptitude cannot be driven backwards', () => {
  const f = fixture(); try {
    strictTest(f, { nav: 'forward' }); assert.equal(state(f).run.nav, 'forward');
    assert.equal(f.$('aptPrev'), null); assert.equal(f.$('aptMark'), null); assert.equal(f.$('aptNextQ').textContent, 'Save & next → (no going back)');
    f.$('aptNextQ').click(); f.$('aptNextQ').click(); assert.equal(state(f).run.index, 2);
    const btn = j => doc(f).querySelector(`[data-go="${j}"]`);
    assert(btn(0).disabled && btn(1).disabled, 'earlier questions are disabled'); assert(!btn(2).disabled && !btn(3).disabled && !btn(4).disabled, 'current and later questions stay open');
    btn(0).disabled = false; btn(0).click(); assert.equal(state(f).run.index, 2, 'the handler also refuses a backwards move'); btn(4).click(); assert.equal(state(f).run.index, 4, 'skipping forward is allowed');
    assert(f.$('app').textContent.includes('You cannot go back to earlier questions.')); assert.equal(state(f).run.visited[3], false);
    const g = fixture(); try { prep(g, { strict: false, nav: 'forward' }); g.$('aptTest').click(); assert.equal(state(g).screen, 'test', 'forward-only alone starts at once'); assert.equal(g.$('aptPrev'), null); assert(g.$('aptPause')); } finally { g.dom.window.close(); }
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('exam conditions: the results show guess against score, time away and how it ended, in the page and the download', () => {
  const f = fixture(); try {
    const t0 = strictTest(f); const qs = state(f).run.questions; qs.forEach((q, i) => { if (i < 3) { choose(f, q.answer); } f.$('aptNextQ') && !f.$('aptNextQ').disabled && f.$('aptNextQ').click(); });
    setNow(f, t0 + 30000); hide(f); setNow(f, t0 + 75000); show(f); f.$('aptSubmit').click();
    assert.equal(state(f).screen, 'predict'); assert.equal(state(f).run, null); noGaps(f);
    assert.deepEqual(JSON.parse(f.w.localStorage.getItem('cr-aptitude-history')).map(h => [h.strict, h.left]), [[true, 1]]);
    f.$('aptGuess').value = '5'; f.$('aptReveal').click();
    assert.equal(f.$('aptExam').querySelectorAll('p')[0].textContent, 'You guessed 5 right. You got 3.'); assert(f.$('aptExam').textContent.includes('You left the test 1 time, 0:45 away in total.')); assert(f.$('aptExam').textContent.includes('You submitted the test yourself.'));
    assert(!doc(f).querySelector('.eyebrow').textContent.includes('TIME RAN OUT')); noGaps(f);
    let saved = ''; f.w.URL.createObjectURL = b => { saved = b; return 'blob:x'; }; f.$('aptDownload').click();
    return saved.text().then(t => { assert(t.includes('Exam conditions: the clock did not pause.') && t.includes('You guessed 5 right. You got 3.') && t.includes('You left the test 1 time, 0:45 away in total.') && t.includes('You submitted the test yourself.'), t.slice(0, 600)); assert.doesNotMatch(t.split('\n\n')[0], GAP); assert.deepEqual(f.errors, []); }).finally(() => f.dom.window.close());
  } catch (e) { f.dom.window.close(); throw e; }
});

test('recent attempts mark exam-condition tests', () => {
  const f = fixture(); try {
    const t0 = strictTest(f); choose(f, 0); setNow(f, t0 + 5000); f.$('aptSubmit').click(); f.$('aptSkipGuess').click(); f.$('aptBack').click();
    assert(doc(f).querySelector('.drill-recent li span').textContent.endsWith('· exam conditions'), doc(f).querySelector('.drill-recent').textContent);
    const g = fixture({ storage: { 'cr-aptitude-history': JSON.stringify([{ id: 'x', at: 5, mode: 'test', results: [{ topic: 'percent', ok: true, answered: true }], score: 1, total: 1, strict: 'yes', name: 7, left: 'a' }]) } }); try { g.$('aptitudeNav').click(); assert(!g.$('app').textContent.includes('exam conditions'), 'a bad flag is ignored'); assert.deepEqual(g.errors, []); } finally { g.dom.window.close(); }
  } finally { f.dom.window.close(); }
});

const goodNotice = (o = {}) => ({ id: 'n1', name: 'Infosys drive', source: 'https://example.com/notice <b>x</b>', sections: [{ id: 'quant', count: 8, minutes: 12 }, { id: 'logical', count: 6, minutes: 9 }, { id: 'verbal', count: 4, minutes: 7 }], timing: 'sectional', negative: 0.25, level: 'medium', nav: 'free', strict: true, switchLimit: 0, ...o });
const fill = (f, id, v) => { f.$(id).value = v; f.$(id).dispatchEvent(new f.w.Event('input', { bubbles: true })); };
const tick = (f, id, on) => { f.$(id).checked = on; f.$(id).dispatchEvent(new f.w.Event('change', { bubbles: true })); };

test('placement notices: create, validate, edit, delete; shown as plain text and ordered after the timed-test panel', () => {
  const f = fixture(); try {
    f.$('aptitudeNav').click();
    const panels = [...doc(f).querySelectorAll('.apt-grid > section')], ni = panels.findIndex(x => x.id === 'aptNotices');
    assert(ni > 0 && panels[ni - 1].querySelector('#aptTest'), 'directly after the Timed test panel');
    assert(text(f).includes('You entered these settings yourself. Case Room has not checked them against any employer.'));
    f.$('aptNoticeNew').click(); assert.equal(state(f).screen, 'notice'); noGaps(f);
    assert.equal(f.$('anStrict').checked, true, 'exam conditions default on');
    f.$('anSave').click(); assert.equal(state(f).screen, 'notice', 'nothing saved'); assert(f.$('anNameErr').textContent.includes('Enter a name')); assert.equal(f.w.localStorage.getItem('cr-aptitude-notices'), null);
    fill(f, 'anName', 'Acme drive'); fill(f, 'anCount-quant', '41'); fill(f, 'anMin-quant', '0'); f.$('anSave').click();
    assert(f.$('anErr-quant').textContent.includes('1 to 40') && f.$('anErr-quant').textContent.includes('1 to 120'), f.$('anErr-quant').textContent); assert.equal(state(f).notices.length, 0);
    fill(f, 'anCount-quant', '12.5'); f.$('anSave').click(); assert(f.$('anErr-quant').textContent.includes('Questions'));
    fill(f, 'anCount-quant', '12'); fill(f, 'anMin-quant', '15'); tick(f, 'anOn-logical', true); fill(f, 'anCount-logical', '0'); f.$('anSave').click(); assert(f.$('anErr-logical').textContent.includes('1 to 40'));
    tick(f, 'anOn-logical', false); tick(f, 'anOn-quant', false); f.$('anSave').click(); assert(f.$('anSectionsErr').textContent.includes('at least one section'));
    tick(f, 'anOn-quant', true); tick(f, 'anOn-verbal', true); fill(f, 'anCount-verbal', '31'); f.$('anSave').click(); assert(f.$('anErr-verbal').textContent.includes('1 to 30'), 'verbal is limited to 30');
    fill(f, 'anCount-verbal', '10'); fill(f, 'anMin-verbal', '10'); fill(f, 'anSource', 'https://x.example/<script>alert(1)</script>'); pick(f, ['anNegative', String(1 / 3)]); pick(f, ['anNav', 'forward']);
    doc(f).querySelector('[name=anTiming][value=total]').checked = true; pick(f, ['anSwitch', '5']); f.$('anSave').click();
    assert.equal(state(f).screen, 'home'); const saved = JSON.parse(f.w.localStorage.getItem('cr-aptitude-notices')); assert.equal(saved.length, 1);
    assert.deepEqual(saved[0], { ...saved[0], name: 'Acme drive', sections: [{ id: 'quant', count: 12, minutes: 15 }, { id: 'verbal', count: 10, minutes: 10 }], timing: 'total', negative: 1 / 3, nav: 'forward', strict: true, switchLimit: 5, level: 'mixed' });
    const li = doc(f).querySelector('.apt-notice-list li'); assert(li.textContent.includes('Acme drive') && li.textContent.includes('Quant 12 · Verbal 10 · 25 min in all · −1/3 · no going back · exam conditions, ends after 5 exits'), li.textContent);
    assert.equal(li.querySelectorAll('script, a').length, 0, 'the source is plain text'); assert(li.textContent.includes('<script>'));
    for (const a of ['start', 'share', 'edit', 'delete']) assert(li.querySelector(`[data-notice-${a}]`), a);
    doc(f).querySelector('[data-notice-edit]').click(); assert.equal(f.$('anName').value, 'Acme drive'); assert.equal(f.$('anCount-verbal').value, '10'); assert.equal(f.$('anOn-logical').checked, false); assert.equal(f.$('anSwitch').value, '5');
    fill(f, 'anName', 'Acme drive (round 1)'); f.$('anSave').click(); const edited = JSON.parse(f.w.localStorage.getItem('cr-aptitude-notices')); assert.equal(edited.length, 1, 'editing replaces'); assert.equal(edited[0].id, saved[0].id); assert.equal(edited[0].name, 'Acme drive (round 1)');
    f.$('aptNoticeNew').click(); f.$('anCancel').click(); assert.equal(state(f).notices.length, 1);
    let asked = 0; f.w.confirm = () => { asked++; return false; }; doc(f).querySelector('[data-notice-delete]').click(); assert.equal(state(f).notices.length, 1, 'cancelled'); f.w.confirm = () => true;
    doc(f).querySelector('[data-notice-delete]').click(); assert.deepEqual(JSON.parse(f.w.localStorage.getItem('cr-aptitude-notices')), []); assert(text(f).includes('No notices saved yet'));
    for (let i = 0; i < 10; i++) { f.$('aptNoticeNew').click(); fill(f, 'anName', 'N' + i); f.$('anSave').click(); }
    assert.equal(state(f).notices.length, 10); f.$('aptNoticeNew').click(); fill(f, 'anName', 'Eleven'); f.$('anSave').click(); assert(f.$('anSaveErr').textContent.includes('up to 10')); assert.equal(state(f).notices.length, 10); assert.equal(state(f).screen, 'notice');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('placement notices: corrupt stored notices are ignored without errors', () => {
  for (const raw of ['{not json', '"x"', '{}', '[1,null,"a",{"name":"x"},{"name":"ok","sections":[]}]', JSON.stringify(Array.from({ length: 14 }, (_, i) => goodNotice({ id: 'n' + i, name: 'N' + i }))), JSON.stringify([goodNotice(), goodNotice({ name: 'Same id' })]),
    JSON.stringify([goodNotice({ sections: [{ id: 'quant', count: 999, minutes: 5 }, { id: 'verbal', count: 3, minutes: 4 }], negative: 7, level: 'bogus', nav: 'x', switchLimit: 9, timing: 'y', strict: 'maybe', name: 'A'.repeat(100) })])]) {
    const f = fixture({ storage: { 'cr-aptitude-notices': raw } }); try {
      f.$('aptitudeNav').click(); const n = plain(state(f).notices);
      assert(n.length <= 10); assert(n.every(x => x.name && x.name.length <= 60 && x.sections.length && E.cleanNotice(x))); assert.equal(new Set(n.map(x => x.id)).size, n.length, 'ids are unique');
      if (raw.includes('Same id')) assert.equal(n.length, 2); if (raw.includes('999')) { assert.deepEqual(n[0].sections, [{ id: 'verbal', count: 3, minutes: 4 }]); assert.deepEqual([n[0].negative, n[0].level, n[0].nav, n[0].switchLimit, n[0].timing, n[0].strict, n[0].name.length], [0, 'mixed', 'free', 0, 'total', true, 60]); }
      noGaps(f); assert.deepEqual(f.errors, []);
    } finally { f.dom.window.close(); }
  }
});

test('a notice test has exactly its own counts and budgets, shows a brief, and keeps the name in headings', () => {
  const f = fixture({ storage: { 'cr-aptitude-notices': JSON.stringify([goodNotice()]) } }); try {
    f.$('aptitudeNav').click(); doc(f).querySelector('[data-notice-start]').click(); assert.equal(state(f).screen, 'brief'); noGaps(f);
    assert(doc(f).querySelector('.drill-title').textContent === 'Infosys drive');     assert.deepEqual([...doc(f).querySelectorAll('#aptBrief tbody tr')].map(r => [...r.children].map(c => c.textContent)), [['Quantitative', '8', '12'], ['Logical', '6', '9'], ['Verbal', '4', '7'], ['Whole test', '18', '28']], 'one row per section plus the total');
    assert(text(f).includes('+1 for each correct answer, −0.25 for each wrong one')); assert(text(f).includes('Move freely between questions')); assert.equal(state(f).run, null);
    f.$('aptBriefBack').click(); assert.equal(state(f).screen, 'home'); assert.equal(state(f).run, null);
    doc(f).querySelector('[data-notice-start]').click(); f.$('aptBegin').click(); const r = state(f).run;
    assert.deepEqual(['quant', 'logical', 'verbal'].map(s => r.questions.filter(q => q.section === s).length), [8, 6, 4]); assert.deepEqual(plain(r.sectionMs), [720000, 540000, 420000]); assert.equal(r.totalMs, 1680000);
    assert.deepEqual([r.name, r.timing, r.negative, r.strict, r.nav, r.switchLimit], ['Infosys drive', 'sectional', 0.25, true, 'free', 0]);
    assert.equal(f.$('aptClock').textContent, '12:00 left'); assert(doc(f).querySelector('.eyebrow').textContent.startsWith('INFOSYS DRIVE · QUANTITATIVE'));
    const t0 = r.clockAt; choose(f, r.questions[0].answer); setNow(f, t0 + 720000 + 60000); f.run('Aptitude.tick()');
    assert.deepEqual([state(f).run.sectionIndex, state(f).run.index], [1, 8]); assert.equal(f.$('aptClock').textContent, '8:00 left', 'each section has its own minutes'); assert(toastText(f).includes('Time is up for Quantitative. On to Logical.'));
    assert.deepEqual(f.errors, []);
    const g = fixture({ storage: { 'cr-aptitude-notices': JSON.stringify([goodNotice({ timing: 'total', strict: false, id: 'n2' })]) } }); try {
      g.$('aptitudeNav').click(); doc(g).querySelector('[data-notice-start]').click(); assert.equal(state(g).screen, 'brief', 'a notice test shows the brief even without exam conditions'); assert(!text(g).includes('The clock does not pause.')); assert(text(g).includes('save and exit'));
      g.$('aptBegin').click(); assert.equal(state(g).run.strict, undefined); assert.equal(g.$('aptClock').textContent, '28:00 left'); assert(g.$('aptPause'));
      g.$('aptSubmit').click(); assert.equal(state(g).screen, 'results', 'no guess screen without exam conditions'); assert.deepEqual(JSON.parse(g.w.localStorage.getItem('cr-aptitude-history'))[0].name, 'Infosys drive'); assert.deepEqual(g.errors, []);
    } finally { g.dom.window.close(); }
  } finally { f.dom.window.close(); }
});

test('an older stored run without the new fields still resumes with a paused clock and Save & exit', () => {
  const f = fixture(); let g; try {
    setupTest(f, { pace: '60' }); const stored = JSON.parse(storage(f)['cr-aptitude-run']);
    for (const k of ['strict', 'nav', 'switchLimit', 'sectionMs', 'totalMs', 'clockAt', 'left', 'awayMs', 'away', 'awaySec', 'name', 'paper', 'ended', 'done']) assert(!(k in stored), 'a plain run does not carry ' + k);
    advance(f, 40000); f.$('aptPause').click(); setNow(f, now(f) + 3600000);
    g = fixture({ url: 'https://case.example/#aptitude', storage: storage(f) }); assert(g.$('app').textContent.includes('4:20 left (the clock is paused)'), g.$('app').textContent.slice(0, 300));
    g.$('aptResume').click(); assert.equal(g.$('aptClock').textContent, '4:20 left'); assert(g.$('aptPause')); assert.equal(g.$('aptExamNote'), null); assert(g.$('aptPrev') && g.$('aptMark'));
    hide(g); assert.equal(state(g).run.left, undefined, 'leaving is not counted without exam conditions');
    assert.deepEqual([...f.errors, ...g.errors], []);
  } finally { f.dom.window.close(); g?.dom.window.close(); }
});

test('a stored strict run needs a clock stamp, and malformed exam fields are rejected', () => {
  const f = fixture(); try {
    const t0 = strictTest(f); const good = JSON.parse(storage(f)['cr-aptitude-run']); assert.equal(good.strict, true);
    const tries = [{ clockAt: undefined }, { clockAt: 'x' }, { nav: 'sideways' }, { switchLimit: 4 }, { left: -1 }, { left: 1.5 }, { awayMs: -5 }, { away: 'yes' }, { sectionMs: [1, 2] }, { totalMs: -1 }, { name: 5 }, { ended: 'quit' }, { paper: { code: 'x' } }, { awaySec: 3 }];
    for (const bad of tries) { const g = fixture({ url: 'https://case.example/#aptitude', storage: { 'cr-aptitude-run': JSON.stringify({ ...good, ...bad }) } }); try { assert.equal(g.$('aptResume'), null, JSON.stringify(bad)); assert.deepEqual(g.errors, []); } finally { g.dom.window.close(); } }
    const ok = fixture({ url: 'https://case.example/#aptitude', storage: { 'cr-aptitude-run': JSON.stringify({ ...good, left: 2, awayMs: 5000, away: true, name: 'X', nav: 'forward', switchLimit: 3, ended: null }) } }); try { assert(ok.$('aptResume')); } finally { ok.dom.window.close(); }
    assert(t0 > 0);
  } finally { f.dom.window.close(); }
});

test('topic practice is unaffected by exam conditions being on', () => {
  const f = fixture(); try {
    prep(f); f.$('aptPractice').click(); assert.equal(state(f).run.mode, 'practice'); assert.equal(state(f).screen, 'practice'); assert.equal(state(f).run.strict, undefined);
    f.$('aptitudeNav').click(); assert(f.$('aptResume').closest('section').textContent.includes('question 1 of')); assert(!f.$('app').textContent.includes('Exam in progress'));
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('every new screen has no stray undefined, null, NaN or [object]', () => {
  const f = fixture({ storage: { 'cr-aptitude-notices': JSON.stringify([goodNotice({ timing: 'total' }), goodNotice({ id: 'n9', name: 'Second', source: '', timing: 'total', strict: false, nav: 'forward', negative: 0 })]) } }); try {
    f.$('aptitudeNav').click(); noGaps(f); f.$('aptNoticeNew').click(); noGaps(f); f.$('anCancel').click();
    doc(f).querySelector('[data-notice-edit]').click(); noGaps(f); f.$('anSave').click(); noGaps(f);
    f.$('aptCollect').click(); noGaps(f); f.$('acRank').click(); noGaps(f); f.$('acBack').click();
    doc(f).querySelectorAll('[data-notice-start]')[1].click(); noGaps(f); f.$('aptBegin').click(); noGaps(f); f.$('aptitudeNav').click(); noGaps(f); f.$('aptDiscard').click();
    doc(f).querySelector('[data-notice-start]').click(); noGaps(f); f.$('aptBegin').click(); noGaps(f); f.$('aptSubmit').click(); noGaps(f); f.$('aptReveal').click(); assert.equal(state(f).screen, 'predict'); f.$('aptSkipGuess').click(); noGaps(f);
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

/* ---------- Shared papers ---------- */
const { settle } = require('./dom.cjs');
const sharedNotice = (o = {}) => goodNotice({ id: 'sh1', name: 'Campus drive – 28 Nov', sections: [{ id: 'quant', count: 6, minutes: 9 }, { id: 'verbal', count: 4, minutes: 5 }], timing: 'sectional', negative: 0.5, level: 'hard', nav: 'forward', strict: false, switchLimit: 0, ...o });
function shareLink(f, id = 'sh1') { f.$('aptitudeNav').click(); doc(f).querySelector(`[data-notice-share="${id}"]`).click(); return { link: f.$('aptShareLink').value, code: f.$('aptShareCode').value }; }
const sameQuestions = (a, b) => assert.deepEqual(plain(a.questions.map(q => q.id)), plain(b.questions.map(q => q.id)));

test('sharing a notice gives a link and a code that open the same paper in another browser', async () => {
  const f = fixture({ storage: { 'cr-aptitude-notices': JSON.stringify([sharedNotice()]) } }); let g, h, copied = [];
  try {
    const { link, code } = shareLink(f); const modalText = f.$('modalContent').textContent;
    assert.equal(link, 'https://case.example/#aptitude/paper/' + code); assert(code.startsWith('CR1.')); assert(f.$('modal').open);
    assert(modalText.includes('Everyone who opens this link gets the same questions and the same clock rules, as long as they use this same site and version. Nothing is sent anywhere: the link itself carries the settings.'));
    const d = E.decodePaper(code); assert.deepEqual(plain(d.config.counts), { quant: 6, verbal: 4 }); assert.deepEqual(plain(d.config.sectionMs), [540000, 300000]); assert.equal(d.config.name, 'Campus drive – 28 Nov'); assert(Number.isInteger(d.seed) && d.seed >= 0 && d.seed < 2 ** 32);
    assert.equal(d.check, E.paperCheck(A.buildTest({ sections: ['quant', 'verbal'], counts: d.config.counts, level: 'hard', seed: d.seed })));
    Object.defineProperty(f.w.navigator, 'clipboard', { value: { writeText: s => { copied.push(s); return Promise.resolve(); } }, configurable: true });
    f.$('aptCopyLink').click(); f.$('aptCopyCode').click(); await settle(); assert.deepEqual(copied, [link, code]); assert.equal(f.$('aptShareStatus').textContent, 'Copied.');
    Object.defineProperty(f.w.navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) }, configurable: true });
    f.$('aptCopyCode').click(); await settle(); assert(f.$('aptShareStatus').textContent.includes('Select the text and copy it.'), 'falls back to selecting the text');
    const g1 = fixture({ storage: { 'cr-aptitude-notices': JSON.stringify([sharedNotice()]) } }); try { g1.$('aptitudeNav').click(); doc(g1).querySelector('[data-notice-share]').click(); assert.notEqual(g1.$('aptShareCode').value, code, 'every share picks a new seed'); } finally { g1.dom.window.close(); }

    g = fixture({ url: link }); assert.equal(state(g).screen, 'brief', 'the route opens the brief'); assert(doc(g).querySelector('.drill-title').textContent === 'Shared paper'); assert(text(g).includes('Campus drive – 28 Nov')); assert(g.$('aptName')); assert.equal(g.$('aptMismatch'), null); noGaps(g);
    assert.equal(g.w.location.hash, '#aptitude'); assert(text(g).includes('No going back to earlier questions')); assert.equal(state(g).run, null);
    g.$('aptName').value = 'Riya Sharma'; g.$('aptBegin').click(); const gr = state(g).run;
    f.$('aptitudeNav').click(); f.$('aptPaperCode').value = code; f.$('aptPaperOpen').click(); assert.equal(state(f).screen, 'brief', 'the bare code works from the form'); f.$('aptBegin').click(); const fr = state(f).run;
    h = fixture(); h.$('aptitudeNav').click(); h.$('aptPaperCode').value = 'see this: ' + link + ' thanks'; h.$('aptPaperOpen').click(); h.$('aptBegin').click(); const hr = state(h).run;
    sameQuestions(gr, fr); sameQuestions(gr, hr); assert.deepEqual(plain(gr.sectionMs), plain(fr.sectionMs)); assert.deepEqual(plain(hr.sectionMs), [540000, 300000]); assert.equal(gr.totalMs, 840000);
    assert.deepEqual([gr.paper.match, gr.paper.check, gr.paper.player, gr.nav, gr.negative, gr.name], [true, d.check, 'Riya Sharma', 'forward', 0.5, 'Campus drive – 28 Nov']);
    assert.deepEqual(['quant', 'verbal'].map(s => gr.questions.filter(q => q.section === s).length), [6, 4]);
    assert.deepEqual([...f.errors, ...g.errors, ...h.errors], []);
  } finally { f.dom.window.close(); g?.dom.window.close(); h?.dom.window.close(); }
});

test('a paper code that does not match what this site builds warns on the brief and marks the result line', () => {
  const f = fixture({ storage: { 'cr-aptitude-notices': JSON.stringify([sharedNotice({ nav: 'free', timing: 'total' })]) } }); try {
    const { code } = shareLink(f), d = E.decodePaper(code), wrong = E.encodePaper({ seed: d.seed, config: d.config, check: d.check === 'zzzzzz' ? 'yyyyyy' : 'zzzzzz' });
    f.$('modalContent'); f.w.document.getElementById('modal').open = false;
    f.$('aptPaperCode').value = wrong; f.$('aptPaperOpen').click(); assert.equal(state(f).screen, 'brief');
    assert(f.$('aptMismatch').textContent.includes('different questions from the organiser') && f.$('aptMismatch').textContent.includes('not be comparable'), f.$('aptMismatch').textContent); noGaps(f);
    f.$('aptBegin').click(); assert.deepEqual([state(f).run.paper.match, state(f).run.paper.check], [false, d.check], 'the line carries this copy\'s own check');
    f.$('aptSubmit').click(); assert.equal(state(f).screen, 'results'); assert.equal(E.parseResultLine(f.$('aptLine').value).check, d.check); assert(f.$('aptSend').textContent.includes('different questions'));
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('invalid paper codes say so and stay on the aptitude home', () => {
  const f = fixture(); try {
    f.$('aptitudeNav').click(); const good = E.encodePaper({ seed: 1, config: E.noticeConfig(E.cleanNotice(goodNotice())), check: 'abcdef' });
    for (const bad of ['', '   ', 'hello', 'CR1.', 'CR1.@@@@', 'CR2.' + good.slice(4), good.slice(4), good.slice(0, -4), 'CR1.' + 'A'.repeat(1500)]) {
      f.$('toast').textContent = ''; f.$('aptPaperCode').value = bad; f.$('aptPaperOpen').click();
      assert.equal(state(f).screen, 'home', JSON.stringify(bad.slice(0, 20))); assert.equal(f.$('toast').textContent, 'That is not a Case Room paper code.', JSON.stringify(bad.slice(0, 20))); assert(f.$('aptPaperCode'), 'still on the aptitude home');
    }
    assert.equal(f.run('Aptitude.openPaper(null)'), false); assert.deepEqual(f.errors, []);
    for (const hash of ['#aptitude/paper/garbage', '#aptitude/paper/%E0%A4%A', '#aptitude/paper/']) { const g = fixture({ url: 'https://case.example/' + hash }); try { assert.equal(state(g).screen, 'home', hash); assert.equal(g.$('toast').textContent, 'That is not a Case Room paper code.'); assert(g.$('aptPaperCode')); assert.deepEqual(g.errors, [], hash); } finally { g.dom.window.close(); } }
  } finally { f.dom.window.close(); }
});

test('after a shared paper the result line parses back to the on-screen numbers and follows the name', async () => {
  const f = fixture({ storage: { 'cr-aptitude-notices': JSON.stringify([sharedNotice({ nav: 'free', timing: 'total', strict: true }), sharedNotice({ id: 'sh2', name: 'Plain paper', nav: 'free', timing: 'total', strict: false })]) } }); try {
    f.$('aptitudeNav').click(); doc(f).querySelector('[data-notice-share="sh1"]').click(); const code = f.$('aptShareCode').value; f.w.document.getElementById('modal').open = false;
    setNow(f, now(f)); f.$('aptPaperCode').value = code; f.$('aptPaperOpen').click(); f.$('aptName').value = 'Asha | K'; f.$('aptBegin').click(); const t0 = now(f), qs = state(f).run.questions;
    choose(f, qs[0].answer); f.$('aptNextQ').click(); choose(f, qs[1].answer); f.$('aptNextQ').click(); choose(f, (qs[2].answer + 1) % 4); f.$('aptNextQ').click(); f.$('aptNextQ').click();
    setNow(f, t0 + 20000); hide(f); setNow(f, t0 + 50000); show(f); setNow(f, t0 + 65000); f.$('aptSubmit').click();
    assert.equal(state(f).screen, 'predict'); f.$('aptGuess').value = '3'; f.$('aptReveal').click(); assert.equal(state(f).screen, 'results'); noGaps(f);
    assert(f.$('aptSend').textContent.includes('Send your result to the organiser') && f.$('aptSend').textContent.includes('This line is for convenience. It is not tamper-proof.'));
    const line = f.$('aptLine').value, p = E.parseResultLine(line); assert(f.$('aptLine').readOnly); assert(!p.error, line);
    assert.deepEqual([p.name, p.correct, p.wrong, p.skipped, p.unreached, p.left, p.seconds, p.check], ['Asha K', 2, 1, 2, 5, 1, 65, state(f).lastResult.paper.check]);
    assert.equal(p.score, 1.5, '2 correct − 1 wrong × 0.5'); assert.equal(f.$('aptCntRight').textContent, '2'); assert.equal(f.$('aptCntWrong').textContent, '1'); assert.equal(f.$('aptCntSkipped').textContent, '2'); assert.equal(f.$('aptCntUnreached').textContent, '5');
    assert(f.$('aptHeadline').textContent.includes('1.5'));
    fill(f, 'aptName', 'Riya'); assert.equal(E.parseResultLine(f.$('aptLine').value).name, 'Riya'); assert.deepEqual({ ...E.parseResultLine(f.$('aptLine').value), name: 'Asha K' }, p, 'only the name changed');
    fill(f, 'aptName', ''); assert.equal(E.parseResultLine(f.$('aptLine').value).name, 'Anonymous');
    let copied = []; Object.defineProperty(f.w.navigator, 'clipboard', { value: { writeText: s => { copied.push(s); return Promise.resolve(); } }, configurable: true }); f.$('aptCopyLine').click(); await settle(); assert.deepEqual(copied, [f.$('aptLine').value]); assert.equal(f.$('aptCopyStatus').textContent, 'Copied.');
    f.$('aptBack').click(); f.w.document.getElementById('modal').open = false;
    doc(f).querySelector('[data-notice-start="sh2"]').click(); f.$('aptBegin').click(); f.$('aptSubmit').click(); assert.equal(f.$('aptSend'), null, 'a notice test that is not shared has no send panel');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('collecting results ranks the biggest group, with ties, broken lines, other papers, duplicate names and CSV', async () => {
  const f = fixture(); try {
    const mk = (check, name, score, seconds, left = 0) => E.resultLine({ check, name, score, correct: Math.floor(score), wrong: 1, skipped: 2, unreached: 3, seconds, left });
    const lines = [mk('aaaaaa', 'Dev', 10, 900), mk('aaaaaa', 'Asha, K', 12, 1000, 2), 'CR1|aaaaaa|Broken|1|2|3', '', mk('bbbbbb', 'Stranger', 20, 100), mk('aaaaaa', 'Bala', 12, 800), mk('aaaaaa', 'Chitra "C"', 10, 900), mk('aaaaaa', 'dev', 3, 700), mk('aaaaaa', 'Eli', 2, 600).replace('|2|', '|9|')];
    f.$('aptitudeNav').click(); f.$('aptCollect').click(); assert.equal(state(f).screen, 'collect'); noGaps(f); assert.equal(f.$('acCsv'), null); f.$('acRank').click(); assert(text(f).includes('No readable result lines yet.')); assert.equal(f.$('acCsv'), null);
    f.$('acLines').value = lines.join('\n'); f.$('acRank').click(); noGaps(f);
    const rows = [...doc(f).querySelectorAll('.apt-rank tbody tr')].map(r => [...r.children].map(c => c.textContent));
    assert.deepEqual(rows, [['1', 'Bala', '12', '12', '1', '2', '3', '13:20', '0'], ['2', 'Asha, K', '12', '12', '1', '2', '3', '16:40', '2'], ['3', 'Chitra "C"', '10', '10', '1', '2', '3', '15:00', '0'], ['3', 'Dev', '10', '10', '1', '2', '3', '15:00', '0'], ['5', 'dev', '3', '3', '1', '2', '3', '11:40', '0']]);
    assert.deepEqual([...doc(f).querySelectorAll('.apt-rank thead th')].map(x => x.textContent), ['Rank', 'Name', 'Score', 'Correct', 'Wrong', 'Skipped', 'Not reached', 'Time', 'Times left']);
    const out = f.$('acOut').textContent; assert(out.includes('Line 3: Expected 11 parts, found 6.'), out); assert(out.includes('Line 9: The check characters do not match'), out);
    assert(out.includes('Line 5 belongs to a different paper (check bbbbbb), so it is not ranked.'), out); assert(out.includes('The name “Dev” appears on lines 1 and 8. Both are kept'), out); assert(!out.includes('Stranger'), 'other papers are not ranked');
    assert.equal(f.w.localStorage.getItem('cr-aptitude-notices'), null); assert(!Object.keys(storage(f)).some(k => /collect|result/i.test(k)), 'nothing is stored');
    let blob; f.w.URL.createObjectURL = b => { blob = b; return 'blob:x'; }; f.$('acCsv').click(); const csv = await blob.text();
    assert.equal(csv.split('\n')[0], 'Rank,Name,Score,Correct,Wrong,Skipped,Not reached,Time (seconds),Times left the test'); assert(csv.includes('2,"Asha, K",12,12,1,2,3,1000,2')); assert(csv.includes('3,"Chitra ""C""",10')); assert.equal(csv.trim().split('\n').length, 6);
    f.$('acBack').click(); assert.equal(state(f).screen, 'home'); assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('the paper and collect routes open from the address', () => {
  const f = fixture({ url: 'https://case.example/#aptitude/collect' }); try { assert.equal(state(f).screen, 'collect'); assert.equal(f.run('view'), 'aptitude'); assert(f.$('acLines')); assert.deepEqual(f.errors, []); } finally { f.dom.window.close(); }
  const g = fixture(); try { g.$('aptitudeNav').click(); g.$('aptCollect').click(); assert.equal(g.w.location.hash, '#aptitude'); g.run('home()'); assert.equal(g.w.location.hash, ''); } finally { g.dom.window.close(); }
  const p = E.encodePaper({ seed: 77, config: E.noticeConfig(E.cleanNotice(goodNotice({ strict: false }))), check: E.paperCheck(A.buildTest({ sections: ['quant', 'logical', 'verbal'], counts: { quant: 8, logical: 6, verbal: 4 }, level: 'medium', seed: 77 })) });
  const h = fixture({ url: 'https://case.example/#aptitude/paper/' + p }); try { assert.equal(state(h).screen, 'brief'); assert.equal(h.$('aptMismatch'), null); assert.deepEqual(h.errors, []); h.$('aptBriefBack').click(); assert.equal(state(h).screen, 'home'); } finally { h.dom.window.close(); }
});

test('exam conditions: time running out while the student is on the aptitude home submits the test', () => {
  const f = fixture(); try {
    const t0 = strictTest(f); choose(f, state(f).run.questions[0].answer); setNow(f, t0 + 1000); f.$('aptitudeNav').click(); assert(f.$('aptResume'));
    setNow(f, t0 + 179000); f.run('Aptitude.tick()'); assert(text(f).includes('0:01 left')); assert(state(f).run, 'one second to go');
    setNow(f, t0 + 181000); f.run('Aptitude.tick()'); assert.equal(state(f).run, null); assert.equal(state(f).screen, 'predict'); assert(toastText(f).includes('Time ran out while you were away.'));
    f.$('aptitudeNav').click(); assert.equal(state(f).screen, 'predict', 'the guess is still asked for if the student goes elsewhere first');
    assert.deepEqual(f.errors, []);
  } finally { f.dom.window.close(); }
});

test('notice form: a field message clears as soon as that field is edited', () => { const f = fixture(); try {
  f.run('Aptitude.open()'); f.$('aptNoticeNew').click(); f.$('anSave').click();
  assert.equal(f.$('anNameErr').textContent, 'Enter a name for this test.'); assert.equal(f.$('anName').getAttribute('aria-invalid'), 'true');
  f.$('anName').value = 'Campus drive'; f.$('anName').dispatchEvent(new f.w.Event('input', { bubbles: true }));
  assert.equal(f.$('anNameErr').textContent, ''); assert.equal(f.$('anName').getAttribute('aria-invalid'), null);
  f.$('anCount-quant').value = '999'; f.$('anSave').click(); assert.match(f.$('anErr-quant').textContent, /whole number from 1 to 40/);
  f.$('anCount-quant').value = '20'; f.$('anCount-quant').dispatchEvent(new f.w.Event('input', { bubbles: true })); assert.equal(f.$('anErr-quant').textContent, '');
  assert.deepEqual(f.errors, []);
} finally { f.dom.window.close(); } });
