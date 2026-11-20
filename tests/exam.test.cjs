const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../src/aptitude-exam.js'), A = require('../src/aptitude-questions.js');

const good = () => ({ id: 'abc-1', name: 'Infosys drive – 28 Nov', source: 'Mail from the placement cell', sections: [{ id: 'quant', count: 20, minutes: 25 }, { id: 'logical', count: 15, minutes: 20 }],
  timing: 'sectional', negative: 0.25, level: 'hard', nav: 'forward', strict: true, switchLimit: 3 });

test('cleanNotice keeps a good notice and fixes or rejects bad fields', () => {
  assert.deepEqual(E.cleanNotice(good()), good());
  assert.equal(E.cleanNotice(null), null); assert.equal(E.cleanNotice('x'), null); assert.equal(E.cleanNotice([]), null);
  assert.equal(E.cleanNotice({ ...good(), name: '   ' }), null, 'a name is required'); assert.equal(E.cleanNotice({ ...good(), name: 5 }), null);
  assert.equal(E.cleanNotice({ ...good(), sections: [] }), null); assert.equal(E.cleanNotice({ ...good(), sections: 'x' }), null);
  assert.equal(E.cleanNotice({ ...good(), name: 'x'.repeat(80) }).name.length, 60);
  assert.equal(E.cleanNotice({ ...good(), source: 's'.repeat(300) }).source.length, 200); assert.equal(E.cleanNotice({ ...good(), source: 4 }).source, '');
  const n = E.cleanNotice({ name: 'N', sections: [{ id: 'verbal', count: 30, minutes: 120 }] });
  assert.deepEqual([n.timing, n.negative, n.level, n.nav, n.strict, n.switchLimit], ['total', 0, 'mixed', 'free', true, 0], 'defaults');
  assert.match(n.id, /^[\w-]{1,30}$/);
  assert.equal(E.cleanNotice({ ...good(), id: 'bad id!' }).id.includes(' '), false); assert.notEqual(E.cleanNotice({ ...good(), id: 'a'.repeat(31) }).id, 'a'.repeat(31));
});

test('cleanNotice: sections are limited, ordered and unique; other fields fall back', () => {
  const s = E.cleanNotice({ ...good(), sections: [{ id: 'verbal', count: 30, minutes: 1 }, { id: 'quant', count: 40, minutes: 120 }, { id: 'quant', count: 5, minutes: 5 }, { id: 'logical', count: 41, minutes: 5 },
    { id: 'verbal', count: 31, minutes: 5 }, { id: 'x', count: 5, minutes: 5 }, { id: 'logical', count: 1.5, minutes: 5 }, { id: 'logical', count: 5, minutes: 0 }, { id: 'logical', count: 5, minutes: 121 }, null, { id: 'logical', count: '5', minutes: 5 }] }).sections;
  assert.deepEqual(s, [{ id: 'quant', count: 40, minutes: 120 }, { id: 'verbal', count: 30, minutes: 1 }], 'quant first, each id once, out-of-range sections dropped');
  assert.equal(E.cleanNotice({ ...good(), sections: [{ id: 'logical', count: 0, minutes: 5 }] }), null);
  for (const neg of [0, 0.25, 1 / 3, 0.5]) assert.equal(E.cleanNotice({ ...good(), negative: neg }).negative, neg);
  assert.equal(E.cleanNotice({ ...good(), negative: 0.9 }).negative, 0); assert.equal(E.cleanNotice({ ...good(), negative: '0.25' }).negative, 0);
  assert.equal(E.cleanNotice({ ...good(), timing: 'weird' }).timing, 'total'); assert.equal(E.cleanNotice({ ...good(), nav: 'back' }).nav, 'free');
  assert.equal(E.cleanNotice({ ...good(), strict: 'yes' }).strict, true); assert.equal(E.cleanNotice({ ...good(), strict: false }).strict, false);
  for (const sw of [0, 3, 5]) assert.equal(E.cleanNotice({ ...good(), switchLimit: sw }).switchLimit, sw); assert.equal(E.cleanNotice({ ...good(), switchLimit: 4 }).switchLimit, 0);
  assert.equal(E.cleanNotice({ ...good(), level: 'mixed-high' }).level, 'mixed-high'); assert.equal(E.cleanNotice({ ...good(), level: 'nope' }).level, 'mixed');
  assert.equal(E.cleanNotice({ ...good(), level: 'custom' }, ['custom', 'mixed']).level, 'custom', 'the caller supplies the accepted levels'); assert.equal(E.cleanNotice({ ...good(), level: 'hard' }, ['custom']).level, 'mixed');
  assert.deepEqual(E.LIMITS, { name: 60, source: 200, counts: { quant: 40, logical: 40, verbal: 30 }, minutes: [1, 120], notices: 10, switchLimits: [0, 3, 5] });
  const lone = E.cleanNotice({ ...good(), name: 'A\uD800B\nC' }).name; assert.equal(lone, 'AB C', 'a half surrogate pair and line breaks are removed');
});

test('noticeConfig lists sections in order with counts and budgets', () => {
  const c = E.noticeConfig(E.cleanNotice(good()));
  assert.deepEqual(c, { name: 'Infosys drive – 28 Nov', sections: ['quant', 'logical'], counts: { quant: 20, logical: 15 }, sectionMs: [1500000, 1200000], totalMs: 2700000, timing: 'sectional', negative: 0.25, level: 'hard', nav: 'forward', strict: true, switchLimit: 3 });
});

const clk = (o = {}) => ({ timing: 'total', sectionMs: [600000], totalMs: 600000, sectionIndex: 0, sectionElapsed: [0], elapsed: 0, ...o });
test('advance: one clock for the whole test', () => {
  const c = clk({ elapsed: 100000 }), snapshot = JSON.stringify(c);
  const r = E.advance(c, 50000); assert.deepEqual([r.elapsed, r.over, r.sectionsEnded, r.sectionIndex], [150000, false, 0, 0]); assert.equal(JSON.stringify(c), snapshot, 'the input is not changed');
  assert.deepEqual([E.advance(c, 500000).elapsed, E.advance(c, 500000).over], [600000, true], 'exact boundary');
  const big = E.advance(c, 9e9); assert.deepEqual([big.elapsed, big.over], [600000, true], 'capped at the budget');
  for (const g of [0, -5, NaN, undefined]) { const z = E.advance(c, g); assert.deepEqual([z.elapsed, z.over, z.sectionsEnded], [100000, false, 0], 'no change for ' + g); }
  assert.equal(E.advance(clk({ elapsed: 600000 }), 1000).over, true); assert.equal(E.advance(clk({ elapsed: 600000 }), 1000).elapsed, 600000);
});

test('advance: a sectional clock hands leftover time to the next section', () => {
  const c = { timing: 'sectional', sectionMs: [600000, 300000, 300000], totalMs: 1200000, sectionIndex: 0, sectionElapsed: [500000, 0, 0], elapsed: 500000 };
  let r = E.advance(c, 50000); assert.deepEqual([r.sectionIndex, r.sectionElapsed, r.elapsed, r.sectionsEnded, r.over], [0, [550000, 0, 0], 550000, 0, false]);
  r = E.advance(c, 100000); assert.deepEqual([r.sectionIndex, r.sectionElapsed, r.elapsed, r.sectionsEnded, r.over], [1, [600000, 0, 0], 600000, 1, false], 'exactly the rest of section 1 ends it; section 2 starts fresh');
  r = E.advance(c, 100000 + 120000); assert.deepEqual([r.sectionIndex, r.sectionElapsed, r.elapsed, r.sectionsEnded, r.over], [1, [600000, 120000, 0], 720000, 1, false], 'the leftover moves on');
  r = E.advance(c, 100000 + 300000 + 50000); assert.deepEqual([r.sectionIndex, r.sectionElapsed, r.sectionsEnded, r.over], [2, [600000, 300000, 50000], 2, false], 'a cascade across two sections');
  r = E.advance(c, 100000 + 300000 + 300000); assert.deepEqual([r.sectionsEnded, r.over, r.sectionIndex, r.elapsed], [3, true, 2, 1200000], 'the exact end of the last section');
  r = E.advance(c, 1e9); assert.deepEqual([r.sectionsEnded, r.over, r.sectionIndex, r.elapsed], [3, true, 2, 1200000], 'a huge gap ends everything and counts only what was left');
  const done = { ...c, ...r }; assert.equal(E.advance(done, 5000).sectionsEnded, 0, 'an ended test does not end sections again'); assert.equal(E.advance(done, 5000).over, true);
  const z = E.advance(c, 0); assert.deepEqual([z.sectionIndex, z.sectionElapsed, z.elapsed, z.over], [0, [500000, 0, 0], 500000, false]);
  const one = { timing: 'sectional', sectionMs: [60000], totalMs: 60000, sectionIndex: 0, sectionElapsed: [0], elapsed: 0 };
  assert.equal(E.advance(one, 60000).over, true); assert.equal(E.advance(one, 59999).over, false);
  assert.equal(c.sectionElapsed[0], 500000, 'the input is not changed');
});

test('paperCheck depends on every id in order', () => {
  const qs = ['a', 'b', 'c'].map(id => ({ id })), c = E.paperCheck(qs);
  assert.match(c, /^[0-9a-z]{6}$/); assert.equal(E.paperCheck(qs), c);
  assert.notEqual(E.paperCheck([qs[1], qs[0], qs[2]]), c, 'order matters'); assert.notEqual(E.paperCheck(qs.slice(0, 2)), c); assert.notEqual(E.paperCheck([{ id: 'a' }, { id: 'b' }, { id: 'd' }]), c);
  assert.notEqual(E.paperCheck([{ id: 'ab' }, { id: 'c' }]), E.paperCheck([{ id: 'a' }, { id: 'bc' }]), 'ids are separated');
  assert.match(E.paperCheck([]), /^[0-9a-z]{6}$/);
  const real = A.buildTest({ sections: ['quant', 'logical', 'verbal'], perSection: 5, seed: 7 }); assert.equal(E.paperCheck(real), E.paperCheck(A.buildTest({ sections: ['quant', 'logical', 'verbal'], perSection: 5, seed: 7 })));
});

const config = () => E.noticeConfig(E.cleanNotice(good()));
test('encodePaper and decodePaper round-trip, including non-ASCII names', () => {
  for (const name of ['Infosys drive – 28 Nov', 'रिया', 'Zoë 😀 test', 'A "quoted" name']) {
    const c = { ...config(), name }, code = E.encodePaper({ seed: 4294967295, config: c, check: 'k3j9x0' });
    assert(code.startsWith('CR1.')); assert.match(code.slice(4), /^[A-Za-z0-9_-]+$/); assert(code.length < 1200);
    assert.deepEqual(E.decodePaper(code), { seed: 4294967295, config: c, check: 'k3j9x0' });
  }
  assert.equal(E.decodePaper(E.encodePaper({ seed: 0, config: config(), check: 'aaaaaa' })).seed, 0);
  assert.equal(E.decodePaper(E.encodePaper({ seed: -1, config: config(), check: 'aaaaaa' })).seed, 4294967295, 'the seed is an unsigned 32-bit integer');
  const third = { ...config(), negative: 1 / 3 }; assert.equal(E.decodePaper(E.encodePaper({ seed: 5, config: third, check: 'aaaaaa' })).config.negative, 1 / 3);
  const longest = { ...config(), name: '😀'.repeat(60) }; assert(E.encodePaper({ seed: 1, config: longest, check: 'aaaaaa' }).length <= 1200, 'the longest name still fits');
  const b64 = s => 'CR1.' + Buffer.from(JSON.stringify(s)).toString('base64url');
  const ok = { s: 5, n: 'N', q: [['quant', 5, 5]], t: 'total', g: 0, l: 'mixed', v: 'free', x: 1, w: 0, k: 'abcdef' };
  assert(E.decodePaper(b64(ok)), 'a hand-made code in the same shape is accepted');
  for (const bad of [{ s: -1 }, { s: 1.5 }, { s: 2 ** 32 }, { n: '' }, { n: 5 }, { q: [] }, { q: [['quant', 41, 5]] }, { q: [['quant', 5, 0]] }, { q: [['quant', 5, 5], ['quant', 5, 5]] }, { q: [['x', 5, 5]] }, { q: [['quant', 5, 5], ['logical', 99, 5]] }, { q: 'quant' }, { t: 'x' }, { g: 0.9 }, { l: 'nope' }, { v: 'x' }, { x: 2 }, { w: 4 }, { k: 'ABCDEF' }, { k: 'abc' }, { k: 5 }])
    assert.equal(E.decodePaper(b64({ ...ok, ...bad })), null, JSON.stringify(bad));
  assert.equal(E.decodePaper(b64([1, 2])), null); assert.equal(E.decodePaper(b64(null)), null);
});

test('decodePaper rejects malformed, oversized and tampered codes', () => {
  const code = E.encodePaper({ seed: 99, config: config(), check: 'abcdef' });
  for (const bad of [undefined, null, 5, {}, '', 'CR1.', 'CR2.' + code.slice(4), code.slice(4), 'cr1.' + code.slice(4), code + '!', code.slice(0, -3), code.slice(0, 10) + '*' + code.slice(11), 'CR1.' + 'A'.repeat(2000), 'CR1.e30', 'CR1.bm90IGpzb24', ' ' + code])
    assert.equal(E.decodePaper(bad), null, String(bad).slice(0, 30));
  assert.equal(E.decodePaper('CR1.' + 'A'.repeat(1196)), null); assert.equal(E.decodePaper('CR1.' + 'A'.repeat(1197)), null, 'over 1200 chars');
  const flipped = code.slice(0, 20) + (code[20] === 'A' ? 'B' : 'A') + code.slice(21), d = E.decodePaper(flipped);
  assert(d === null || d.seed !== 99 || JSON.stringify(d.config) !== JSON.stringify(config()) || d.check !== 'abcdef', 'a changed character never decodes to the original');
});

test('resultLine and parseResultLine round-trip and detect copying mistakes', () => {
  const r = { check: 'abc123', name: 'Riya Sharma', score: 12.5, correct: 14, wrong: 3, skipped: 2, unreached: 1, seconds: 1750, left: 2 };
  const line = E.resultLine(r); assert.match(line, /^CR1\|abc123\|Riya Sharma\|12\.5\|14\|3\|2\|1\|1750\|2\|[0-9a-z]{4}$/);
  assert.deepEqual(E.parseResultLine(line), { check: 'abc123', name: 'Riya Sharma', score: 12.5, correct: 14, wrong: 3, skipped: 2, unreached: 1, seconds: 1750, left: 2 });
  assert.deepEqual(E.parseResultLine('  ' + line + '  \n').name, 'Riya Sharma');
  assert.equal(E.resultLine({ ...r, score: 1 / 3 }).split('|')[3], '0.33'); assert.equal(E.resultLine({ ...r, score: 2.5 }).split('|')[3], '2.5'); assert.equal(E.resultLine({ ...r, score: 3 }).split('|')[3], '3');
  assert.equal(E.parseResultLine(E.resultLine({ ...r, score: -2.25 })).score, -2.25, 'negative scores are possible');
  assert.equal(E.resultLine({ ...r, name: 'A|B\r\nC' }).split('|')[2], 'A B C'); assert.equal(E.resultLine({ ...r, name: '' }).split('|')[2], 'Anonymous'); assert.equal(E.resultLine({ ...r, name: undefined }).split('|')[2], 'Anonymous');
  assert.equal(E.resultLine({ ...r, name: '|||' }).split('|')[2], 'Anonymous'); assert.equal(E.resultLine({ ...r, name: 'x'.repeat(60) }).split('|')[2].length, 40);
  assert.equal(Array.from(E.resultLine({ ...r, name: 'रिया'.repeat(20) }).split('|')[2]).length, 40);
  assert.equal(E.parseResultLine(E.resultLine({ ...r, name: 'रिया 😀' })).name, 'रिया 😀');
  assert.equal(E.lineSum('x').length, 4);
  const fields = line.split('|');
  const reSum = f => { const head = f.slice(0, 10).join('|'); return head + '|' + E.lineSum(head); };
  const errs = {
    prefix: 'XX1' + line.slice(3), short: fields.slice(0, 10).join('|'), long: line + '|1', sum: line.slice(0, -1) + (line.endsWith('a') ? 'b' : 'a'),
    changedScore: line.replace('|12.5|', '|99|'), badNumber: reSum([...fields.slice(0, 4), 'x', ...fields.slice(5)]), decimalCount: reSum([...fields.slice(0, 4), '1.5', ...fields.slice(5)]), negativeCount: reSum([...fields.slice(0, 5), '-1', ...fields.slice(6)]),
    badScore: reSum([...fields.slice(0, 3), 'abc', ...fields.slice(4)]), emptyName: reSum([fields[0], fields[1], ' ', ...fields.slice(3)]), badCheck: reSum([fields[0], 'ABC', ...fields.slice(2)]), empty: '', blank: '   '
  };
  for (const [k, v] of Object.entries(errs)) { const p = E.parseResultLine(v); assert(p.error && typeof p.error === 'string' && !('score' in p), k + ' -> ' + JSON.stringify(p)); }
  assert.deepEqual(E.parseResultLine(reSum(fields)).name, 'Riya Sharma'); assert.equal(E.parseResultLine(5).error, 'Not text');
  /* The sum only catches copying mistakes: anyone can recompute it, so a line edited by hand and re-summed passes. */
  assert.equal(E.parseResultLine(reSum([...fields.slice(0, 3), '40', ...fields.slice(4)])).score, 40);
});

test('rank orders by score, then time, then name, with shared ranks for ties', () => {
  const rows = [{ name: 'Dev', score: 10, seconds: 900 }, { name: 'Asha', score: 12, seconds: 1000 }, { name: 'Chitra', score: 10, seconds: 900 }, { name: 'Bala', score: 12, seconds: 800 }, { name: 'Eli', score: 5, seconds: 100 }, { name: 'Fay', score: 10, seconds: 950 }];
  const input = JSON.stringify(rows), r = E.rank(rows);
  assert.deepEqual(r.map(x => [x.name, x.rank]), [['Bala', 1], ['Asha', 2], ['Chitra', 3], ['Dev', 3], ['Fay', 5], ['Eli', 6]]); assert.equal(JSON.stringify(rows), input, 'the input is not changed');
  assert.deepEqual(E.rank([{ name: 'A', score: 3, seconds: 5 }, { name: 'B', score: 3, seconds: 5 }, { name: 'C', score: 1, seconds: 5 }]).map(x => x.rank), [1, 1, 3]);
  assert.deepEqual(E.rank([{ name: 'A', score: -1, seconds: 5 }, { name: 'B', score: 0, seconds: 5 }]).map(x => x.name), ['B', 'A']); assert.deepEqual(E.rank([]), []);
  assert.deepEqual(E.rank([{ name: 'A', score: 1, seconds: 1 }, { name: 'B', score: 2, seconds: 1 }, { name: 'C', score: 2, seconds: 1 }, { name: 'D', score: 2, seconds: 1 }, { name: 'E', score: 0, seconds: 1 }]).map(x => x.rank), [1, 1, 1, 4, 5]);
});

test('toCsv has a header and quotes names with commas, quotes and line breaks', () => {
  const csv = E.toCsv(E.rank([{ name: 'Rao, Anil', score: 9.5, correct: 10, wrong: 2, skipped: 1, unreached: 0, seconds: 600, left: 1 }, { name: 'The "Boss"', score: 7, correct: 8, wrong: 4, skipped: 0, unreached: 0, seconds: 700, left: 0 }, { name: '=SUM(A1)', score: 1, correct: 1, wrong: 0, skipped: 0, unreached: 0, seconds: 50, left: 0 }]));
  const lines = csv.trim().split('\n'); assert.equal(lines[0], 'Rank,Name,Score,Correct,Wrong,Skipped,Not reached,Time (seconds),Times left the test');
  assert.equal(lines[1], '1,"Rao, Anil",9.5,10,2,1,0,600,1'); assert.equal(lines[2], '2,"The ""Boss""",7,8,4,0,0,700,0'); assert.equal(lines[3], "3,'=SUM(A1),1,1,0,0,0,50,0", 'formula-like names are defused');
  assert.equal(E.toCsv([]).trim(), lines[0]);
});

test('buildTest accepts per-section counts and stays reproducible', () => {
  const args = { sections: ['quant', 'logical', 'verbal'], perSection: 10, level: 'mixed', seed: 123, counts: { quant: 20, verbal: 25 } };
  const a = A.buildTest(args), b = A.buildTest(args), by = s => a.filter(q => q.section === s).length;
  assert.deepEqual([by('quant'), by('logical'), by('verbal')], [20, 10, 25]); assert.deepEqual(a.map(q => q.id), b.map(q => q.id), 'same seed and arguments give the same questions');
  assert.notDeepEqual(A.buildTest({ ...args, seed: 124 }).map(q => q.id), a.map(q => q.id));
  assert.deepEqual(A.buildTest({ ...args, counts: undefined }).map(q => q.id), A.buildTest({ ...args, counts: {} }).map(q => q.id), 'counts are optional');
  assert.deepEqual(A.buildTest({ sections: ['quant'], perSection: 5, seed: 9 }).map(q => q.id), A.buildTest({ sections: ['quant'], perSection: 5, seed: 9, counts: { quant: 5 } }).map(q => q.id));
  assert.equal(A.buildTest({ sections: ['logical'], perSection: 7, seed: 1, counts: { logical: 'x', verbal: 3 } }).length, 7, 'a bad count falls back to perSection');
  assert.deepEqual([...a.map(q => q.section)].filter((s, i, l) => i === 0 || l[i - 1] !== s), ['quant', 'logical', 'verbal'], 'sections stay in order');
});

test('the verbal bank can supply the largest verbal section at every level', () => {
  const max = E.LIMITS.counts.verbal;
  for (const level of [...A.LEVEL_IDS, 'mixed', 'mixed-high']) for (const seed of [1, 2, 3, 99, 2024]) {
    const qs = A.buildTest({ sections: ['verbal'], level, seed, counts: { verbal: max } });
    assert.equal(qs.length, max, level); assert.equal(new Set(qs.map(q => q.id)).size, max, `${level} seed ${seed}: ${max} distinct verbal questions`);
    assert.equal(new Set(qs.map(q => q.prompt)).size, max);
  }
});

test('collectLines groups by paper, reports unreadable lines and flags repeated names', () => {
  const mk = (check, name, score) => E.resultLine({ check, name, score, correct: 5, wrong: 1, skipped: 0, unreached: 0, seconds: 600, left: 0 });
  const text = [mk('aaaaaa', 'Asha', 10), '', mk('bbbbbb', 'Other', 9), 'garbage', mk('aaaaaa', 'Bala', 8), mk('aaaaaa', 'asha ', 7), '   '].join('\r\n');
  const c = E.collectLines(text);
  assert.equal(c.check, 'aaaaaa'); assert.deepEqual(c.rows.map(r => [r.line, r.name]), [[1, 'Asha'], [5, 'Bala'], [6, 'asha']], 'line numbers count blank lines');
  assert.deepEqual(c.bad, [{ line: 4, reason: 'Does not start with CR1' }]); assert.deepEqual(c.other, [{ check: 'bbbbbb', lines: [3] }]);
  assert.deepEqual(c.duplicates, [{ name: 'Asha', lines: [1, 6] }], 'names are compared ignoring case, and both lines are kept');
  const tie = E.collectLines([mk('bbbbbb', 'X', 1), mk('aaaaaa', 'Y', 1)].join('\n')); assert.equal(tie.check, 'bbbbbb', 'a tie goes to the paper that appears first');
  assert.deepEqual(E.collectLines(''), { check: null, rows: [], bad: [], other: [], duplicates: [] }); assert.equal(E.collectLines(null).rows.length, 0);
  assert.equal(E.collectLines('CR1|x').bad.length, 1);
});
