const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const L=require('../src/moves-logic.js'),C=require('../content/moves.js'),D=require('../src/drill-questions.js');
const {MOVES,OPENINGS,STATEMENTS,SLIPS,ANSWER_FIRST}=C;
const SLIP_IDS=SLIPS.map(s=>s.id),SEEDS=Array.from({length:200},(_,i)=>i+1);
const nums=t=>(String(t).match(/\d[\d,]*(?:\.\d+)?/g)||[]).map(x=>Number(x.replace(/,/g,'')));
const cell=s=>Number(String(s).replace(/[₹,%\s]/g,''));
const stmt=(item,kind)=>item.statements.find(s=>s.kind===kind);
const close=(a,b,tol=1e-6)=>Math.abs(a-b)<=tol;
const sample=(pattern,seed)=>L.generateSoWhat(D.rng(seed),pattern);

test('content: every move has the fields the logic and UI use',()=>{
  assert.deepEqual(MOVES.map(m=>m.id),L.MOVE_IDS);assert.deepEqual(L.SET_MOVE_IDS,['answer-first','so-what','number-sense']);assert.deepEqual(L.MOVE_IDS,[...L.SET_MOVE_IDS,'triage']);
  for(const m of MOVES.filter(x=>L.SET_MOVE_IDS.includes(x.id))){
    assert.equal(m.kind,undefined,m.id+' is a set');
    for(const k of ['id','title','tagline','where','why'])assert.equal(typeof m[k],'string',m.id+' '+k);
    assert.ok(m.rule.length>=1&&m.rule.every(x=>typeof x==='string'));
    for(const k of ['weak','strong','note'])assert.equal(typeof m.example[k],'string',m.id+' example.'+k);
    assert.equal(typeof m.spot.prompt,'string');assert.equal(typeof m.do.prompt,'string');assert.ok(m.do.seconds>0);
    assert.equal(L.moveOf(m.id),m);
  }
  assert.equal(L.moveOf('nope'),null);
  assert.deepEqual(Object.keys(OPENINGS).sort(),['answer','context','hedge','windup']);
  assert.deepEqual(Object.keys(STATEMENTS).sort(),['description','insight','misread','overreach']);
  assert.equal(SLIPS.length,7);
});
test('content: the triage move and its round settings',()=>{
  const m=L.moveOf('triage'),T=C.TRIAGE;
  assert.equal(m.kind,'round');assert.equal(m.title,'Attempt, leave or guess');assert.equal(m.minutes,5);assert.deepEqual(m.labels,{spot:'Sort calls',do:'Rounds'});
  for(const k of ['tagline','where','why'])assert.equal(typeof m[k],'string',k);assert.equal(m.rule.length,3);assert.equal(m.spot,undefined);assert.equal(m.do,undefined);
  for(const k of ['weak','strong','note','question'])assert.equal(typeof m.example[k],'string',k);
  assert.deepEqual([T.questions,T.sortSeconds,T.sitSeconds,T.right,T.wrong,T.quick,T.fast],[8,10,210,1,-0.25,60,40]);
  assert.deepEqual(T.calls.map(c=>c.id),['now','later','leave']);assert.ok(T.calls.every(c=>c.label&&c.note));assert.ok(T.fast<T.quick);
  // the two figures in the guess copy follow from four options, +1 and −0.25: blind is 1/4 − 3/4×0.25 = 0.0625; two ruled out is 1/2 − 1/2×0.25 = 0.375
  const worth=k=>(1/k)*T.right+(1-1/k)*T.wrong;
  assert.ok(close(worth(4),0.0625));assert.ok(close(worth(2),0.375));
  assert.match(T.guess,/about 0\.06 of a mark/);assert.match(T.guess,/about 0\.38/);assert.equal(Math.round(worth(4)*100)/100,0.06);assert.equal(Math.round(worth(2)*100)/100,0.38);
  assert.equal(typeof T.pass,'string');assert.ok(!/!/.test(JSON.stringify(T)+JSON.stringify(m)));
  // exactly one move is a round
  assert.equal(L.MOVE_IDS.filter(id=>L.moveOf(id).kind==='round').length,1);
});
test('content: every Answer first item is complete and its sums agree',()=>{
  assert.equal(ANSWER_FIRST.length,12);assert.equal(new Set(ANSWER_FIRST.map(x=>x.id)).size,12);
  for(const x of ANSWER_FIRST){
    assert.deepEqual(x.openings.map(o=>o.kind).sort(),['answer','context','hedge','windup'],x.id);
    for(const k of ['weak','adequate','strong','question','round'])assert.ok(x[k]&&typeof x[k]==='string',x.id+' '+k);
    assert.ok(x.facts.length>=3);
    for(const [label,computed,stated] of x.sums||[])assert.ok(close(computed,stated,0.001),`${x.id}: ${label} ${computed} vs ${stated}`);
  }
});
test('the module has no DOM access',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../src/moves-logic.js'),'utf8');
  assert.ok(!/\b(?:document|window|localStorage)\b/.test(src.replace(/\/\*[\s\S]*?\*\//g,'')));
});

/* ---------- Answer first ---------- */
test('answer first: every strong answer passes every check',()=>{
  for(const x of ANSWER_FIRST){const r=L.checkAnswerFirst(x.strong);assert.ok(r.pass,x.id+' '+JSON.stringify(r.checks.filter(c=>c.level!=='ok')));}
});
test('answer first: every weak answer fails at least one check',()=>{
  for(const x of ANSWER_FIRST)assert.ok(!L.checkAnswerFirst(x.weak).pass,x.id);
});
test('answer first: wind-up and hedge openings trip their checks, answer openings pass the opening checks',()=>{
  const level=(text,id)=>L.checkAnswerFirst(text).checks.find(c=>c.id===id).level;
  for(const x of ANSWER_FIRST)for(const o of x.openings){
    if(o.kind==='windup')assert.equal(level(o.text,'windup'),'warn',x.id+' '+o.text);
    if(o.kind==='hedge')assert.equal(level(o.text,'hedge'),'warn',x.id+' '+o.text);
    if(o.kind==='answer')for(const id of ['opening','windup','hedge'])assert.equal(level(o.text,id),'ok',x.id+' '+id);
  }
});
test('answer first: check shape, order and messages',()=>{
  const e=L.checkAnswerFirst('   ');assert.deepEqual(e,{empty:true,words:0,checks:[],pass:false});
  assert.deepEqual(L.checkAnswerFirst(null).checks,[]);
  const r=L.checkAnswerFirst('Yes, charge ₹200. It closes the gap with 80 members and leaves some spare for events.');
  assert.deepEqual(r.checks.map(c=>c.id),['opening','windup','hedge','last','support','number','length']);
  assert.equal(r.empty,false);assert.ok(r.pass);assert.equal(r.checks[0].text,'Your first sentence is 3 words.');
  const w=L.checkAnswerFirst('So, basically we had a long discussion. It depends on the budget, perhaps. In the end I would charge ₹200 because costs are rising. So I would charge it.');
  assert.match(w.checks[1].text,/^You open with “So”\./);assert.equal(w.checks[1].level,'warn');
  const h=L.checkAnswerFirst('It depends on the numbers. We have 80 members and costs of ₹40,000 a year. So charging looks sensible.');
  assert.match(h.checks[2].text,/hedges \(“depends on”\)|hedges \(“it depends”\)/);
  assert.match(h.checks[3].text,/\(“So charging looks…”\)/);
  assert.equal(L.checkAnswerFirst('Yes. Short.').checks.find(c=>c.id==='support').level,'warn');
  assert.equal(L.checkAnswerFirst('Yes, charge it. '+'word '.repeat(80)).checks.find(c=>c.id==='length').level,'warn');
  assert.equal(L.checkAnswerFirst('Charge it. It costs money and the college grant is small and there is no number here at all, really.').checks.find(c=>c.id==='number').level,'warn');
  assert.equal(L.checkAnswerFirst('Yes, '+'word '.repeat(30)+'. Then a second sentence with seven words in it, 3 of them.').checks[0].level,'warn');
  assert.equal(L.checkAnswerFirst('2 sentences only. The last one starts with so and counts only from three sentences, 5 facts.').checks[3].level,'ok');
});

/* ---------- Sets ---------- */
test('sets: unknown move throws, every set is reproducible, serialisable and seed-dependent',()=>{
  assert.throws(()=>L.buildSet('nope'),{message:'Unknown move: nope'});
  for(const m of L.SET_MOVE_IDS){
    const a=L.buildSet(m,{seed:42,recent:['x']}),b=L.buildSet(m,{seed:42,recent:['x']});
    assert.deepEqual(a,b);assert.deepEqual(JSON.parse(JSON.stringify(a)),a);assert.equal(a.move,m);assert.equal(a.seed,42);
    assert.notDeepEqual(a,L.buildSet(m,{seed:43,recent:['x']}));
    assert.ok(a.items.every(i=>i.move===m&&typeof i.id==='string'));
    assert.equal(L.buildSet(m).items.length,a.items.length);
    assert.ok(L.validRun({move:m,seed:42,items:a.items,index:0,results:[]}));
  }
});
test('sets: answer first has 4 Spot and 2 Do on six different items, unseen first',()=>{
  for(const seed of SEEDS.slice(0,40)){
    const s=L.buildSet('answer-first',{seed});
    assert.deepEqual(s.items.map(i=>i.rung),['spot','spot','spot','spot','do','do']);
    assert.equal(new Set(s.items.map(i=>i.id)).size,6);
    for(const i of s.items.slice(0,4)){assert.deepEqual(i.options.map(o=>o.kind).sort(),['answer','context','hedge','windup']);assert.ok(i.question&&i.round);}
    for(const i of s.items.slice(4)){const src=ANSWER_FIRST.find(x=>x.id===i.id);assert.deepEqual([i.weak,i.adequate,i.strong,i.facts],[src.weak,src.adequate,src.strong,src.facts]);}
    const recent=ANSWER_FIRST.slice(0,6).map(x=>x.id),r=L.buildSet('answer-first',{seed,recent});
    assert.ok(r.items.every(i=>!recent.includes(i.id)));
    const most=ANSWER_FIRST.slice(0,10).map(x=>x.id).reverse(),r2=L.buildSet('answer-first',{seed,recent:most});
    assert.equal(new Set(r2.items.map(i=>i.id)).size,6);assert.ok(r2.items.slice(0,2).every(i=>!most.includes(i.id)));
  }
  const orders=new Set(SEEDS.slice(0,40).map(seed=>L.buildSet('answer-first',{seed}).items[0].options.map(o=>o.kind)[0]));assert.ok(orders.size>1);
});
test('sets: so what has 5 Spot then 2 Do, never repeating a pattern within Spot',()=>{
  for(const seed of SEEDS){
    const s=L.buildSet('so-what',{seed});
    assert.deepEqual(s.items.map(i=>i.rung),['spot','spot','spot','spot','spot','do','do']);
    const ps=s.items.map(i=>i.pattern);assert.equal(new Set(ps.slice(0,5)).size,5);assert.equal(new Set(ps.slice(0,6)).size,6);assert.equal(ps[6],ps[0]);
    assert.equal(new Set(s.items.map(i=>i.id)).size,7);
  }
});
test('sets: so what avoids recent ids when it can',()=>{
  const first=L.buildSet('so-what',{seed:9}),ids=first.items.map(i=>i.id),again=L.buildSet('so-what',{seed:9,recent:ids});
  assert.ok(again.items.every(i=>!ids.includes(i.id)));
});
test('sets: number sense has 6 Spot (3 right, 3 slipped with three slips) and 2 Do',()=>{
  for(const seed of SEEDS){
    const s=L.buildSet('number-sense',{seed}),spot=s.items.slice(0,6),dos=s.items.slice(6);
    assert.deepEqual(s.items.map(i=>i.rung),[...Array(6).fill('spot'),'do','do']);
    assert.equal(spot.filter(i=>i.ok).length,3);const slips=spot.filter(i=>!i.ok).map(i=>i.slip);assert.equal(new Set(slips).size,3);assert.ok(slips.every(x=>SLIP_IDS.includes(x)));
    assert.notEqual(dos[0].scenario,dos[1].scenario);assert.ok(dos.some(i=>!i.ok));
    assert.equal(new Set(s.items.map(i=>i.id)).size,8);
  }
  const firsts=new Set(SEEDS.slice(0,30).map(seed=>L.buildSet('number-sense',{seed}).items[0].ok));assert.equal(firsts.size,2);
});

/* ---------- So what? ---------- */
const CAUSE=/competitor|advertising|price|discount|poster|counsellor|batch timings|contractor|warden|rival|rider|motivated|budget|overtake|future|shifting|courier|trainer|manager|partner|care less/i;
function common(item,pattern){
  assert.equal(item.move,'so-what');assert.equal(item.pattern,pattern);assert.match(item.id,new RegExp('^'+pattern+'-\\d+$'));
  assert.deepEqual(item.statements.map(s=>s.kind).sort(),['description','insight','misread','overreach']);
  for(const s of item.statements){
    assert.ok(s.text&&s.why);assert.ok(s.text.split(/(?<=[.!?])\s+/).length<=2,s.text);
    if(s.kind!=='misread')assert.equal(s.why,STATEMENTS[s.kind].why);else assert.match(s.why,/\d/);
  }
  assert.equal(item.weak,stmt(item,'description').text);assert.equal(item.strong,stmt(item,'insight').text);assert.ok(item.adequate&&item.adequate!==item.strong);
  assert.ok(item.strong.startsWith(item.adequate.slice(0,20)));
  assert.ok(item.figures.every(f=>/^\d+(\.\d+)?$/.test(f)));assert.equal(new Set(item.figures).size,item.figures.length);
  assert.ok(item.focus.length>=1&&item.focus.every(f=>f===f.toLowerCase()));
  const cells=item.table.rows.flatMap(r=>r.slice(1)).map(cell);assert.ok(cells.every(c=>item.figures.includes(String(c))),item.id);
  assert.ok(item.table.rows.every(r=>r.length===item.table.columns.length&&r.every(c=>typeof c==='string')));
  const tableText=(item.title+' '+item.table.columns.join(' ')+' '+item.table.rows.flat().join(' ')).toLowerCase(),over=stmt(item,'overreach').text,hits=over.match(new RegExp(CAUSE.source,'gi'));
  assert.ok(hits&&/\b(?:should|need|must|will)\b/i.test(over),'overreach names a cause and an action: '+over);
  for(const h of hits)assert.ok(!tableText.includes(h.toLowerCase()),`${h} appears in the table of ${item.id}`);
  assert.ok(!stmt(item,'insight').text.startsWith('Because'));
}
const dir=(a,b)=>Math.sign(b-a);
const CHECK={
  'one-segment'(item){
    const rows=item.table.rows.slice(0,-1).map(r=>[r[0],cell(r[1]),cell(r[2])]),tot=item.table.rows.at(-1);assert.equal(tot[0],'Total');
    const [o,n]=[1,2].map(i=>rows.reduce((a,r)=>a+r[i],0));assert.deepEqual([cell(tot[1]),cell(tot[2])],[o,n]);
    const ds=rows.map(r=>r[2]-r[1]),big=ds.reduce((m,d,i)=>Math.abs(d)>Math.abs(ds[m])?i:m,0),d=Math.sign(n-o);
    assert.ok(rows.length>=3&&rows.length<=4);
    rows.forEach((r,i)=>{if(i!==big)assert.ok(Math.abs(ds[i])/r[1]<=0.03+1e-9,'minor segments move at most 3%');});
    assert.ok(Math.abs(ds[big])>=0.85*Math.abs(n-o)&&Math.abs(ds[big])<=Math.abs(n-o),'one segment drives the change');
    const ins=stmt(item,'insight').text;assert.ok(ins.includes(rows[big][0])&&nums(ins).includes(Math.abs(n-o)));
    assert.deepEqual(item.focus,[rows[big][0].toLowerCase()]);
    const desc=nums(stmt(item,'description').text);const top=rows.reduce((m,r)=>r[2]>m[2]?r:m);assert.deepEqual(desc,[o,n,Math.round(Math.abs(n-o)/o*100),top[2],n]);assert.ok(stmt(item,'description').text.includes('largest')&&stmt(item,'description').text.includes(top[0]));
    assert.equal(/rose/.test(stmt(item,'description').text),d>0);
    const mis=stmt(item,'misread').text,claimed=/rose/.test(mis)?1:-1;assert.ok(/every/.test(mis));assert.ok(rows.some(r=>dir(r[1],r[2])!==claimed),'misread is false');
    assert.ok(rows.some(r=>dir(r[1],r[2])!==d));
  },
  'rate-vs-volume'(item){
    const [v,c,o]=item.table.rows.map(r=>[cell(r[1]),cell(r[2])]);
    for(const i of [0,1])assert.ok(close(v[i]*c[i]/100,o[i])&&Number.isInteger(o[i]));
    const down=v[1]<v[0];assert.equal(dir(c[0],c[1]),down?1:-1);assert.equal(dir(o[0],o[1]),dir(v[0],v[1]));
    assert.deepEqual(nums(stmt(item,'description').text),[c[0],c[1],o[0],o[1],v[0],v[1]]);
    const ins=stmt(item,'insight').text;assert.ok(nums(ins).includes(Math.round(Math.abs(v[1]-v[0])/v[0]*100)));assert.equal(/fell because/.test(ins),down);
    const mis=stmt(item,'misread').text,saysBetter=/improved|better/.test(mis);assert.equal(saysBetter,down);
    assert.ok(saysBetter?o[1]<o[0]:o[1]>o[0],'misread is false: the outcome moved against the rate');
  },
  'percent-vs-absolute'(item){
    const rows=item.table.rows.map(r=>[r[0],cell(r[1]),cell(r[2]),cell(r[3])]);assert.equal(rows.length,3);
    for(const r of rows)assert.ok(close((r[2]-r[1])/r[1]*100,r[3]),'growth % exact and whole');
    const fast=rows.reduce((m,r)=>r[3]>m[3]?r:m),big=rows.reduce((m,r)=>r[2]-r[1]>m[2]-m[1]?r:m);
    assert.notEqual(fast,big);assert.ok(big[2]-big[1]>=0.6*rows.reduce((a,r)=>a+r[2]-r[1],0));assert.ok(rows.filter(r=>r[3]===fast[3]).length===1);
    const d=stmt(item,'description').text;assert.ok(d.startsWith(fast[0]));assert.ok(nums(d).every(x=>rows.some(r=>r[3]===x)||x===big[2])&&d.includes(`${big[0]} is the largest line this year, at ₹${D.fmt(big[2])} lakh`)&&rows.every(r=>r[2]<=big[2]));
    for(const r of rows)if(d.includes(r[0]))assert.ok(nums(d).includes(r[3]));
    const ins=stmt(item,'insight').text;assert.ok(ins.startsWith(fast[0]+' grew fastest at '+fast[3]+'%'));assert.ok(ins.includes('₹'+D.fmt(big[2]-big[1])+' lakh')&&ins.includes('so '+big[0]+' is still the line to protect'));
    const mis=stmt(item,'misread').text;assert.ok(mis.startsWith(fast[0])&&fast[2]-fast[1]<big[2]-big[1]);
  },
  'hidden-groups'(item){
    const rows=item.table.rows.map(r=>[r[0],cell(r[1]),cell(r[2])]),all=rows.at(-1),gs=rows.slice(0,2);assert.equal(all[0],'Overall');
    assert.equal(all[1],gs[0][1]+gs[1][1]);const w=(gs[0][1]*gs[0][2]+gs[1][1]*gs[1][2])/all[1];assert.ok(close(w,all[2],1e-9)&&close(w*10,Math.round(w*10),1e-9),'overall is the weighted average');
    const t=nums(item.title)[0],lower=!/%/.test(item.title);const meets=x=>lower?x<=t:x>=t;
    assert.ok(meets(all[2])&&!meets(gs[0][2])!==!meets(gs[1][2]),'average meets the target while exactly one group misses it');
    const bad=gs.find(g=>!meets(g[2])),good=gs.find(g=>meets(g[2]));
    assert.deepEqual(item.focus,[bad[0].toLowerCase()]);
    assert.deepEqual(nums(stmt(item,'description').text),[all[2],t,Math.round(Math.abs(t-all[2])*10)/10,Math.round(good[1]/all[1]*100),all[1]]);assert.ok(stmt(item,'description').text.includes(good[0]));
    const ins=stmt(item,'insight').text,sh=Object.entries({'one in five':.2,'one in four':.25,'three in ten':.3,'two in five':.4}).find(([w])=>ins.includes(w));
    assert.ok(sh&&close(bad[1]/all[1],sh[1]),'share of the missing group is stated correctly');assert.ok(nums(ins).includes(bad[2])&&ins.includes(bad[0]));
    assert.ok(good[2]!==bad[2]);
    assert.ok(/both|Both/.test(stmt(item,'misread').text));
  },
  'turning-point'(item){
    const v=item.table.rows.map(r=>cell(r[1])),p=v.indexOf(Math.max(...v));assert.equal(v.length,6);assert.ok(p===2||p===3);
    for(let i=0;i<p;i++)assert.ok(v[i]<v[i+1]);for(let i=p;i<5;i++)assert.ok(v[i]>v[i+1]);assert.ok(v[5]<=v[0]*1.03);
    const months=item.table.rows.map(r=>r[0]),full=['January','February','March','April','May','June','July','August','September','October','November','December'];
    for(let i=1;i<6;i++)assert.equal(full[(full.findIndex(m=>m.startsWith(months[0]))+i)%12].slice(0,3),months[i]);
    const name=full.find(m=>m.startsWith(months[p])),ins=stmt(item,'insight').text;assert.ok(ins.includes(name)&&nums(ins).includes(v[p]));
    assert.ok(item.focus.includes(name.toLowerCase()));
    assert.deepEqual(nums(stmt(item,'description').text),[v[0],v[5],Math.min(...v),v[p],v[p]-Math.min(...v)]);assert.ok(stmt(item,'description').text.includes(full.find(m=>m.startsWith(months[0])))&&stmt(item,'description').text.includes(full.find(m=>m.startsWith(months[5]))));
    assert.ok(/falling steadily/.test(stmt(item,'misread').text)&&v[1]>v[0],'misread is false: it rose first');
  },
  'small-sample'(item){
    const rows=item.table.rows.map(r=>[r[0],cell(r[1]),cell(r[2]),cell(r[3])]);
    for(const r of rows)assert.ok(close(r[2]/r[1]*100,r[3],1e-9)&&Number.isInteger(r[3]),'percentage exact from the counts');
    const small=rows.find(r=>r[1]<=20),big=rows.find(r=>r[1]>=400);assert.ok(small&&big&&small[1]>=8&&small[3]>big[3]);
    assert.deepEqual(nums(stmt(item,'description').text),[small[3],big[3],small[3]-big[3],small[2]+big[2],small[1]+big[1]]);
    const ins=stmt(item,'insight').text;assert.ok(ins.startsWith(small[0])&&ins.includes(`${small[3]}% rests on ${small[1]} responses`)&&ins.includes(`${big[3]}% from ${D.fmt(big[1])} responses`));
    assert.deepEqual(item.focus.slice().sort(),[small[0].toLowerCase(),big[0].toLowerCase()].sort());
    const mis=stmt(item,'misread').text;assert.ok(mis.includes(small[0]+' than at '+big[0])||mis.includes(small[0]+' than '+big[0])||mis.includes('at '+small[0]+' than')||mis.includes(small[0]+' than'));assert.ok(small[2]<big[2],'misread is false: fewer people');
  }
};
test('so what: patterns are the six and unknown ones throw',()=>{
  assert.deepEqual(L.SO_WHAT_PATTERNS,['one-segment','rate-vs-volume','percent-vs-absolute','hidden-groups','turning-point','small-sample']);
  assert.throws(()=>L.generateSoWhat(D.rng(1),'nope'),/Unknown pattern/);
});
for(const pattern of L.SO_WHAT_PATTERNS)test('so what: '+pattern+' obeys its truth conditions over 200 seeds',()=>{
  const titles=new Set(),overs=new Set(),dirs=new Set();
  for(const seed of SEEDS){
    const item=sample(pattern,seed);common(item,pattern);CHECK[pattern](item);titles.add(item.title);overs.add(stmt(item,'overreach').text.split(' ')[0]);dirs.add(item.table.rows.flat().join()[0]);
    assert.deepEqual(sample(pattern,seed),item);
  }
  assert.ok(titles.size>=3,'at least three contexts');
});
test('so what: statements are shuffled and nothing gives the kind away by its first word',()=>{
  const positions={insight:new Set(),misread:new Set()},first={overreach:new Set(),misread:new Set(),insight:new Set(),description:new Set()};
  for(const pattern of L.SO_WHAT_PATTERNS)for(const seed of SEEDS.slice(0,50)){
    const it=sample(pattern,seed);positions.insight.add(it.statements.findIndex(s=>s.kind==='insight'));positions.misread.add(it.statements.findIndex(s=>s.kind==='misread'));
    for(const s of it.statements)first[s.kind].add(s.text.split(' ')[0]);
  }
  assert.equal(positions.insight.size,4);assert.equal(positions.misread.size,4);
  assert.ok(!first.overreach.has('Because')&&first.overreach.size>=3);
  for(const w of first.overreach)assert.ok(!first.insight.has(w)||w.length>0);
  assert.ok(Object.values(first).every(s=>[...s].every(w=>!/^(?:Because|Wrong|True|Actually)$/.test(w))));
});
test('so what: Spot judging',()=>{
  const it=sample('one-segment',3),ans=it.statements.findIndex(s=>s.kind==='insight');
  assert.deepEqual(L.judgeSpot({...it,rung:'spot'},ans),{ok:true,picked:'insight',answer:ans,why:STATEMENTS.insight.why});
  for(let i=0;i<4;i++){const j=L.judgeSpot(it,i);assert.equal(j.ok,i===ans);assert.equal(j.picked,it.statements[i].kind);assert.equal(j.answer,ans);assert.equal(j.why,it.statements[i].why);}
  for(const bad of [-1,4,1.5,'1',null,undefined])assert.deepEqual(L.judgeSpot(it,bad),{ok:false,picked:null,answer:ans,why:''});
});
test('so what: the strong answer passes every check and the weak one fails at least one',()=>{
  let n=0;
  for(const pattern of L.SO_WHAT_PATTERNS)for(const seed of SEEDS){
    const it=sample(pattern,seed),s=L.checkSoWhat(it.strong,it),w=L.checkSoWhat(it.weak,it);n++;
    assert.ok(s.pass,`${it.id}: ${it.strong} ${JSON.stringify(s.checks.filter(c=>c.level!=='ok'))}`);assert.ok(!w.pass,it.id+' '+it.weak);
  }
  assert.ok(n>=60);
});
test('so what: check shape, order and each rule',()=>{
  const it={figures:['40','12.5','1200'],focus:['south','block c']};
  assert.deepEqual(L.checkSoWhat('',it),{empty:true,words:0,checks:[],pass:false});
  const ok=L.checkSoWhat('South fell by 40, so ask what changed.',it);assert.deepEqual(ok.checks.map(c=>c.id),['figure','where','follows','length']);assert.ok(ok.pass);
  const lv=(t,id)=>L.checkSoWhat(t,it).checks.find(c=>c.id===id).level;
  assert.equal(lv('The south fell by 400, so ask.','figure'),'warn');assert.equal(lv('Down ₹40 lakh, 12.5% and 1,200 units','figure'),'ok');assert.equal(lv('It fell by 40%.','figure'),'ok');
  assert.equal(lv('South fell by 41.','figure'),'warn');assert.equal(lv('1,200 in Block C.','where'),'ok');assert.equal(lv('Southern region fell by 40','where'),'warn');
  assert.equal(lv('It fell 40 in the south','follows'),'warn');assert.equal(lv('It fell 40 in the south, which means a problem','follows'),'ok');assert.equal(lv('The south fell 40, the question is why','follows'),'ok');
  assert.equal(lv('The south fell 40, so you should check','follows'),'ok');assert.equal(lv('Absolutely 40 in the south','follows'),'warn');
  assert.equal(lv('word '.repeat(46)+'south 40 so','length'),'warn');assert.equal(L.checkSoWhat('x south 40 so '.repeat(1),{}).checks[0].level,'warn');
});

/* ---------- Number sense ---------- */
const WRONG={ // the specific wrong calculation and the right one, recomputed from the numbers in the setup text
  zeros:(n,it)=>[n[0]*n[1]/(it.shown>it.correct?1e6:1e8),n[0]*n[1]/1e7],
  period:n=>[n[0]*n[1]/1e5,n[0]*n[1]*12/1e5],
  points:n=>[n[1]-n[0],(n[1]-n[0])/n[0]*100],
  base:n=>[Math.abs(n[1]-n[0])/n[1]*100,Math.abs(n[1]-n[0])/n[0]*100],
  average:n=>[(n[1]+n[3])/2,(n[0]*n[1]+n[2]*n[3])/(n[0]+n[2])],
  profit:(n,it)=>{const k=it.unit==='₹ lakh'?1e5:1;return [n[0]*n[1]/k,n[0]*(n[1]-n[2])/k];},
  compound:n=>[n[0],n[0]*(1-n[1]*n[1]/10000)]
};
const items=(slip,scenario)=>SEEDS.slice(0,100).map(s=>L.generateNumberSense(D.rng(s),{slip,scenario}));
for(const slip of SLIP_IDS)test('number sense: '+slip+' slipped items equal the specific wrong calculation over 100 seeds',()=>{
  const ctxs=new Set();
  for(const [i,it] of items(slip).entries()){
    const [wrong,right]=WRONG[slip](nums(it.setup),it);
    assert.equal(it.move,'number-sense');assert.equal(it.scenario,slip);assert.equal(it.slip,slip);assert.equal(it.ok,false);assert.match(it.id,new RegExp('^'+slip+'-\\d+$'));
    assert.ok(close(it.shown,wrong,1e-6),`${it.setup} shown ${it.shown} wanted ${wrong}`);assert.ok(close(it.correct,right,1e-6));
    assert.ok(Math.abs(it.shown-it.correct)>0.01*Math.abs(it.correct),'differs from correct by more than 1%');
    assert.ok(it.claim.includes(D.fmt(it.shown,4)),it.claim);assert.ok(it.claim.startsWith('So '));assert.ok(!it.claim.includes(D.fmt(it.correct,4))||D.fmt(it.shown,4).includes(D.fmt(it.correct,4)));
    assert.ok(it.ask.includes(',')&&it.unit&&it.working.length>=2&&it.why.includes(D.fmt(it.correct,4)),it.why);
    assert.equal(it.options.length,4);assert.equal(new Set(it.options).size,4);assert.equal(it.options.filter(o=>o===slip).length,1);assert.ok(it.options.every(o=>SLIP_IDS.includes(o)));
    assert.ok(twoDpOk(it.correct));ctxs.add(it.setup.split(/\d/)[0]);
  }
  assert.ok(ctxs.size>=2,'at least two contexts');
});
function twoDpOk(x){return close(x*100,Math.round(x*100),1e-6)||close(x*10000,Math.round(x*10000),1e-6);}
for(const slip of SLIP_IDS)test('number sense: '+slip+' correct items have shown equal to correct',()=>{
  for(const it of items(null,slip)){
    const [,right]=WRONG[slip](nums(it.setup),it);
    assert.equal(it.ok,true);assert.equal(it.slip,null);assert.equal(it.scenario,slip);assert.equal(it.shown,it.correct);assert.ok(close(it.correct,right,1e-6));
    assert.ok(it.claim.includes(D.fmt(it.shown,4)));assert.ok(it.why.length>10&&it.working.length>=2);
    assert.equal(it.options.length,4);assert.equal(new Set(it.options).size,4);
  }
});
test('number sense: a correct and a slipped item from one seed differ only in the figure',()=>{
  for(const slip of SLIP_IDS)for(const seed of SEEDS.slice(0,100)){
    const a=L.generateNumberSense(D.rng(seed),{slip}),b=L.generateNumberSense(D.rng(seed),{slip:null,scenario:slip});
    for(const k of ['setup','ask','unit','working','correct','scenario'])assert.deepEqual(a[k],b[k],slip+' '+k);
    assert.equal(a.claim.replace(D.fmt(a.shown,4),'#'),b.claim.replace(D.fmt(b.shown,4),'#'));
    assert.notEqual(a.shown,b.shown);assert.notEqual(a.id,b.id);
  }
});
test('number sense: specific ranges and shapes per slip',()=>{
  for(const it of items('zeros'))assert.ok(it.correct>=1&&it.correct<=20&&(close(it.shown,it.correct*10)||close(it.shown,it.correct/10)));
  const dirs=new Set(items('zeros').map(i=>i.shown>i.correct));assert.equal(dirs.size,2);
  for(const it of items('base')){const [a,b]=nums(it.setup);assert.ok([20,25,50,100].includes(it.correct)&&Number.isInteger(it.correct)&&Number.isInteger(it.shown)||it.correct===50);assert.ok(it.claim.includes(b>a?'rose':'fell'));}
  assert.ok(items('base').some(i=>i.correct===25&&i.shown===20)&&items('base').some(i=>i.correct===20&&i.shown===25));
  for(const it of items('points'))assert.ok(Number.isInteger(it.correct));
  for(const it of items('average')){const n=nums(it.setup);assert.ok(n[0]===3*n[2]||n[2]===3*n[0]);assert.ok(Number.isInteger(it.correct));}
  assert.ok(items('profit').some(i=>i.unit==='₹')&&items('profit').some(i=>i.unit==='₹ lakh'));
  assert.ok(items('compound').every(it=>[20,25,50].includes(nums(it.setup)[1])));
  for(const it of items('compound'))assert.ok(close(it.correct*100,Math.round(it.correct*100),1e-6)&&it.shown>it.correct);
  assert.throws(()=>L.generateNumberSense(D.rng(1),{slip:'nope'}),/Unknown slip/);assert.throws(()=>L.generateNumberSense(D.rng(1),{slip:'zeros',scenario:'base'}),/Unknown scenario/);
  assert.ok(L.generateNumberSense(D.rng(1)).scenario);
});
test('number sense: Spot judging',()=>{
  const slipped=L.generateNumberSense(D.rng(4),{slip:'base'}),right=L.generateNumberSense(D.rng(4),{slip:null,scenario:'base'});
  assert.deepEqual(L.judgeSpot(slipped,{verdict:'off',slip:'base'}),{ok:true,caught:true,why:slipped.why,slip:'base'});
  const mis=L.judgeSpot(slipped,{verdict:'off',slip:'zeros'});assert.deepEqual([mis.ok,mis.caught,mis.slip],[false,true,'base']);assert.ok(mis.why.includes(slipped.why));
  const missed=L.judgeSpot(slipped,{verdict:'right'});assert.deepEqual([missed.ok,missed.caught],[false,false]);assert.ok(missed.why.includes(slipped.why));
  assert.deepEqual(L.judgeSpot(right,{verdict:'right'}),{ok:true,caught:false,why:right.why,slip:null});
  const false_alarm=L.judgeSpot(right,{verdict:'off',slip:'base'});assert.deepEqual([false_alarm.ok,false_alarm.caught,false_alarm.slip],[false,false,null]);assert.ok(false_alarm.why.includes(right.why));
  for(const bad of [null,undefined,{},{verdict:'maybe'},'off'])assert.equal(L.judgeSpot(slipped,bad).ok,false);assert.equal(L.judgeSpot(right,{}).ok,false);
});
test('number sense: checkFigure',()=>{
  const it={correct:30};
  for(const raw of ['30','30.0','₹30','30 crore','₹30 lakh',' 30 ','30.2','29.8',30])assert.deepEqual([L.checkFigure(it,raw).valid,L.checkFigure(it,raw).ok],[true,true],String(raw));
  for(const raw of ['31','300','3','-30','29.6'])assert.deepEqual([L.checkFigure(it,raw).valid,L.checkFigure(it,raw).ok],[true,false],raw);
  for(const raw of ['','abc',null,undefined,'3x0','1..2','NaN'])assert.deepEqual([L.checkFigure(it,raw).valid,L.checkFigure(it,raw).ok],[false,false],String(raw));
  assert.equal(L.checkFigure({correct:1200},'1,200').ok,true);assert.equal(L.checkFigure({correct:0.5},'0.51').ok,true);assert.equal(L.checkFigure({correct:0.5},'0.52').ok,false);
  assert.equal(L.checkFigure({correct:-20},'-20').ok,true);assert.equal(L.checkFigure({correct:20},'−20').ok,false);
  assert.ok(Number.isNaN(L.checkFigure(it,'abc').value));
});

/* ---------- History and readiness ---------- */
const E=(move,rung,ok,i=0,extra={})=>({move,rung,id:'id'+i,ok,seconds:5,at:1000+i,...extra});
test('record builds a history entry',()=>{
  const item={move:'so-what',rung:'spot',id:'one-segment-1234'};
  assert.deepEqual(L.record(item,{ok:true,seconds:12.5,at:99,pick:'insight'}),{move:'so-what',rung:'spot',id:'one-segment-1234',ok:true,seconds:12.5,at:99,pick:'insight'});
  assert.deepEqual(L.record({...item,rung:'do'},{ok:false,at:5,grade:'adequate'}),{move:'so-what',rung:'do',id:'one-segment-1234',ok:false,seconds:null,at:5,grade:'adequate'});
  const d=L.record(item,{ok:1,seconds:NaN,pick:7,grade:'great'});assert.deepEqual([d.ok,d.seconds,'pick' in d,'grade' in d,Number.isFinite(d.at)],[true,null,false,false,true]);
  assert.ok(L.cleanHistory([L.record(item,{ok:true,seconds:3,pick:'x'})]).length===1);
  assert.deepEqual(JSON.parse(JSON.stringify(d)),d);
});
test('cleanHistory drops malformed entries and caps at the most recent 600',()=>{
  const good=E('answer-first','spot',true,1,{pick:'answer'}),good2=E('number-sense','do',false,2,{grade:'weak',seconds:null});
  const bad=[null,undefined,5,'x',[],{},{...good,move:'other'},{...good,rung:'learn'},{...good,id:''},{...good,id:7},{...good,id:'x'.repeat(81)},{...good,ok:'yes'},{...good,ok:1},{...good,at:'1'},{...good,at:NaN},{...good,at:Infinity},{...good,seconds:'5'},{...good,seconds:-1},{...good,seconds:NaN},{...good,pick:5},{...good,pick:'p'.repeat(41)},{...good,grade:'great'}];
  assert.deepEqual(L.cleanHistory([...bad,good,good2]),[good,good2]);
  assert.deepEqual(L.cleanHistory([{...good,seconds:undefined,extra:'drop me'}]),[{...good,seconds:null}]);
  for(const x of [null,undefined,'x',{},5])assert.deepEqual(L.cleanHistory(x),[]);
  const many=Array.from({length:650},(_,i)=>E('so-what','spot',i%2===0,i)),c=L.cleanHistory(many);
  assert.equal(c.length,600);assert.equal(c[0].id,'id50');assert.equal(c.at(-1).id,'id649');assert.notEqual(c[0],many[50]);
});
test('validRun accepts a real run and rejects bad ones',()=>{
  const run=()=>({move:'answer-first',seed:5,items:L.buildSet('answer-first',{seed:5}).items,index:2,results:[{ok:true},{ok:false}]});
  assert.equal(L.validRun(run()),true);
  assert.equal(L.validRun({...run(),index:0,results:[]}),true);assert.equal(L.validRun({...run(),index:6,results:Array(6).fill({})}),true);
  const bad=[null,undefined,'x',5,[],{},{...run(),move:'nope'},{...run(),move:'so-what'},{...run(),seed:NaN},{...run(),seed:'5'},{...run(),seed:Infinity},{...run(),items:[]},{...run(),items:'x'},
    {...run(),items:[{rung:'learn',id:'a',move:'answer-first'}]},{...run(),items:[{rung:'spot',id:5,move:'answer-first'}]},{...run(),items:[{rung:'spot',id:'a',move:'so-what'}]},{...run(),items:[null]},
    {...run(),index:-1},{...run(),index:7},{...run(),index:1.5},{...run(),index:'1'},{...run(),index:undefined},{...run(),results:'x'},{...run(),results:Array(7).fill({})},{...run(),results:undefined}];
  for(const b of bad)assert.equal(L.validRun(b),false,JSON.stringify(b)?.slice(0,80));
});
test('recentIds lists distinct ids for a move, newest first, up to n',()=>{
  const h=[E('so-what','spot',true,1),E('answer-first','spot',true,2),E('so-what','do',true,3),E('so-what','spot',false,1),E('so-what','spot',true,4)];
  assert.deepEqual(L.recentIds(h,'so-what'),['id4','id1','id3']);assert.deepEqual(L.recentIds(h,'so-what',2),['id4','id1']);assert.deepEqual(L.recentIds(h,'answer-first'),['id2']);
  assert.deepEqual(L.recentIds([],'so-what'),[]);assert.deepEqual(L.recentIds(null,'so-what'),[]);assert.deepEqual(L.recentIds(h,'nope'),[]);
  const many=Array.from({length:30},(_,i)=>E('so-what','spot',true,i));assert.equal(L.recentIds(many,'so-what').length,12);assert.equal(L.recentIds(many,'so-what')[0],'id29');
});
test('status: new, training and ready at each threshold',()=>{
  const spots=(ok,n,base=0)=>Array.from({length:n},(_,i)=>E('so-what','spot',i<ok,base+i)),dos=(ok,n,base=100)=>Array.from({length:n},(_,i)=>E('so-what','do',i<ok,base+i));
  const st=h=>L.status(h,'so-what');
  assert.deepEqual(st([]),{move:'so-what',attempts:0,spot:{of:0,correct:0},do:{of:0,passed:0},ready:false,state:'new'});
  assert.equal(st(spots(3,3)).state,'training');
  assert.deepEqual([st([...spots(8,10),...dos(3,3)]).ready,st([...spots(8,10),...dos(3,3)]).state],[true,'ready']);
  assert.equal(st([...spots(10,10),...dos(3,3)]).ready,true);
  assert.equal(st([...spots(7,10),...dos(3,3)]).ready,false);assert.equal(st([...spots(9,9),...dos(3,3)]).ready,false);
  assert.equal(st([...spots(8,10),...dos(2,3)]).ready,false);assert.equal(st([...spots(8,10),...dos(3,2)]).ready,false);
  const h=[...spots(8,10),...dos(3,3)];assert.deepEqual(st(h),{move:'so-what',attempts:13,spot:{of:10,correct:8},do:{of:3,passed:3},ready:true,state:'ready'});
  // only the most recent 10 Spot and 3 Do count
  const old=[...Array.from({length:6},(_,i)=>E('so-what','spot',false,i)),...Array.from({length:10},(_,i)=>E('so-what','spot',true,10+i)),E('so-what','do',false,50),...dos(3,3,60)];
  const r=st(old);assert.deepEqual([r.spot,r.do,r.ready,r.attempts],[{of:10,correct:10},{of:3,passed:3},true,20]);
  const slump=[...old,...Array.from({length:3},(_,i)=>E('so-what','spot',false,200+i))];assert.equal(st(slump).spot.correct,7);assert.equal(st(slump).ready,false);
  assert.equal(st([...h,E('so-what','do',false,500)]).ready,false);
  assert.deepEqual(L.status([E('answer-first','spot',true,1)],'so-what').state,'new');assert.equal(L.status(null,'so-what').state,'new');assert.equal(L.status('x','so-what').attempts,0);
});
test('summarise gives one status per move in order',()=>{
  const s=L.summarise([E('number-sense','spot',true,1)]);
  assert.deepEqual(s.map(x=>x.move),['answer-first','so-what','number-sense','triage']);assert.deepEqual(s.map(x=>x.state),['new','new','training','new']);assert.equal(L.summarise(undefined).length,4);
});
test('recorded history feeds status end to end',()=>{
  let history=[];const set=L.buildSet('number-sense',{seed:11});
  for(const [i,it] of set.items.entries()){
    const ok=it.rung==='spot'?L.judgeSpot(it,{verdict:it.ok?'right':'off',slip:it.slip}).ok:L.checkFigure(it,String(it.correct)).ok;
    history.push(L.record(it,{ok,seconds:4,at:i,pick:it.rung==='spot'?(it.ok?'right':it.slip):undefined,grade:it.rung==='do'?'strong':undefined}));
  }
  history=L.cleanHistory(JSON.parse(JSON.stringify(history)));assert.equal(history.length,8);assert.ok(history.every(h=>h.ok));
  assert.deepEqual(L.status(history,'number-sense').spot,{of:6,correct:6});assert.deepEqual(L.recentIds(history,'number-sense').length,8);
  assert.ok(L.buildSet('number-sense',{seed:11,recent:L.recentIds(history,'number-sense')}).items.every(i=>!history.some(h=>h.id===i.id)));
});

test('number sense: the dearer item is always the one labelled dearer',()=>{
  const dear=[[/thalis at ₹(\d+).* snack boxes at ₹(\d+)/,1],[/notebooks at ₹(\d+).* planners at ₹(\d+)/,-1],[/standard tickets at ₹(\d+).* premium tickets at ₹(\d+)/,-1]];let seen=0;
  for(const it of [...items('average'),...items(null,'average')]){
    const [re,sign]=dear.find(([r])=>r.test(it.setup)),m=it.setup.match(re);seen++;assert.ok(sign*(Number(m[1])-Number(m[2]))>0,it.setup);
  }
  assert.ok(seen>=200);assert.equal(new Set([...items('average')].map(i=>dear.findIndex(([r])=>r.test(i.setup)))).size,3);
});
test('number sense: a slipped figure always fails checkFigure and sits at least 3% from the right one',()=>{
  for(const slip of SLIP_IDS)for(const it of items(slip)){
    assert.equal(L.checkFigure(it,String(it.shown)).ok,false,it.setup);assert.ok(Math.abs(it.shown-it.correct)>=0.03*Math.abs(it.correct),it.setup+' '+it.shown);
  }
});
test('so what: the insight cannot be picked by length',()=>{
  const longest={},total={};let all=0,hits=0;
  for(const pattern of L.SO_WHAT_PATTERNS)for(const seed of SEEDS.concat(SEEDS,SEEDS).map((x,i)=>x+i*1000)){
    const it=sample(pattern,seed),w=it.statements.map(s=>({k:s.kind,n:require('../src/behavioural-content.js').wordCount(s.text)})),max=Math.max(...w.map(x=>x.n));
    const top=w.filter(x=>x.n===max);all++;total[pattern]=(total[pattern]||0)+1;
    if(top.length===1&&top[0].k==='insight'){hits++;longest[pattern]=(longest[pattern]||0)+1;}
  }
  assert.ok(all>=600);assert.ok(hits/all<=0.4,'insight longest in '+Math.round(hits/all*100)+'%');
  for(const p of L.SO_WHAT_PATTERNS)assert.ok((longest[p]||0)/total[p]<=0.6,p+' '+Math.round((longest[p]||0)/total[p]*100)+'%');
  console.log('longest-statement share',Math.round(hits/all*100)+'%',Object.fromEntries(L.SO_WHAT_PATTERNS.map(p=>[p,Math.round((longest[p]||0)/total[p]*100)+'%'])));
});

/* ---------- Attempt, leave or guess ---------- */
const AQ=require('../src/aptitude-questions.js'),T=C.TRIAGE;
const FIELDS=['answer','id','level','options','prompt','shortcut','solution','topic'];
const SORTED=['answer','id','level','options','prompt','shortcut','solution','topic'];
test('triage: buildTriage makes eight questions on eight topics, 3 easy, 3 medium, 2 hard, with no data questions',()=>{
  const orders=new Set(),sections=new Set();
  for(const seed of SEEDS.slice(0,100)){
    const t=L.buildTriage({seed});
    assert.deepEqual(Object.keys(t),['move','seed','questions']);assert.equal(t.move,'triage');assert.equal(t.seed,seed);assert.equal(t.questions.length,8);
    const lv=l=>t.questions.filter(q=>q.level===l).length;assert.deepEqual([lv('easy'),lv('medium'),lv('hard')],[3,3,2],'seed '+seed);
    assert.equal(new Set(t.questions.map(q=>q.topic)).size,8,'eight different topics, seed '+seed);assert.equal(new Set(t.questions.map(q=>q.id)).size,8);
    for(const q of t.questions){
      assert.deepEqual(Object.keys(q).sort(),SORTED);const tp=AQ.topicOf(q.topic);assert.ok(tp&&['quant','logical'].includes(tp.section),q.topic);assert.notEqual(q.topic,'di');sections.add(tp.section);
      assert.equal(typeof q.prompt,'string');assert.ok(q.prompt);assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.options.every(o=>typeof o==='string'&&o));
      assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<4);assert.ok(Array.isArray(q.solution)&&q.solution.length&&q.solution.every(x=>typeof x==='string'));assert.ok(q.shortcut&&typeof q.shortcut==='string');
      for(const k of ['chart','table','passage'])assert.equal(q[k],undefined,k+' is not kept');
    }
    orders.add(t.questions.map(q=>q.level).join());
    assert.deepEqual(L.buildTriage({seed}),t,'deterministic');assert.deepEqual(JSON.parse(JSON.stringify(t)),t,'serialisable');
  }
  assert.ok(orders.size>=8,'the levels come in shuffled order: '+orders.size);assert.deepEqual([...sections].sort(),['logical','quant']);
  assert.notDeepEqual(L.buildTriage({seed:1}),L.buildTriage({seed:2}));assert.equal(L.buildTriage().questions.length,8);
  // each stored answer index is the question's own right answer
  const g=AQ.generate('percent','easy',D.rng(5));assert.equal(g.options[g.answer],g.display);
});
test('triage: buildSet refuses the round, and the other moves are untouched',()=>{
  assert.throws(()=>L.buildSet('triage'),{message:'triage is a round: use buildTriage'});assert.throws(()=>L.buildSet('triage',{seed:1}),/is a round: use buildTriage/);
  assert.equal(L.buildSet('so-what',{seed:1}).items.length,7);
  assert.equal(L.validRun({move:'triage',seed:1,items:[{rung:'spot',id:'a',move:'triage'}],index:0,results:[]}),false,'a round is not a set run');
});
test('triage: triageOrder puts Do now first, then Later, then Leave, each in the order sorted',()=>{
  assert.deepEqual(L.triageOrder(['later','now','leave','now','later','leave','leave','now']),[1,3,7,0,4,2,5,6]);
  assert.deepEqual(L.triageOrder(['leave','leave','later']),[2,0,1]);assert.deepEqual(L.triageOrder(['now','now']),[0,1]);assert.deepEqual(L.triageOrder([]),[]);assert.deepEqual(L.triageOrder(undefined),[]);
  const calls=['later','now','leave','later','now','now','leave','later'];assert.deepEqual([...L.triageOrder(calls)].sort((a,b)=>a-b),[0,1,2,3,4,5,6,7]);
});
test('triage: triageVerdict covers every branch and the boundary seconds',()=>{
  const v=(call,state,seconds)=>L.triageVerdict(call,{state,seconds});
  // Do now
  assert.deepEqual(v('now','right',34),{verdict:'good',line:'Right in 34 seconds. A good call.'});
  assert.deepEqual(v('now','right',60),{verdict:'good',line:'Right in 1:00. A good call.'},'60 is inside the minute');
  assert.deepEqual(v('now','right',61),{verdict:'miss',line:'Right, but it took 1:01. That was a Later.'});
  assert.deepEqual(v('now','right',85),{verdict:'miss',line:'Right, but it took 1:25. That was a Later.'});
  assert.deepEqual(v('now','right',59),{verdict:'good',line:'Right in 59 seconds. A good call.'});
  assert.equal(v('now','right',60.4).verdict,'good');assert.equal(v('now','right',60.6).verdict,'miss');
  assert.deepEqual(v('now','wrong',50),{verdict:'miss',line:'Wrong after 50 seconds. Not a quick mark for you yet.'});
  assert.deepEqual(v('now','wrong',125),{verdict:'miss',line:'Wrong after 2:05. Not a quick mark for you yet.'});
  assert.deepEqual(v('now','skipped',9),{verdict:'miss',line:'You called it Do now, then skipped it.'});
  assert.deepEqual(v('now','unreached',0),{verdict:null,line:'Not reached.'});
  // Later and Leave behave the same
  for(const call of ['later','leave']){
    assert.deepEqual(v(call,'right',22),{verdict:'miss',line:'Right in 22 seconds. A quick mark you put off.'});
    assert.deepEqual(v(call,'right',40),{verdict:'miss',line:'Right in 40 seconds. A quick mark you put off.'},'40 is still quick');
    assert.deepEqual(v(call,'right',41),{verdict:'good',line:'Right, and it took 41 seconds. Worth putting off.'});
    assert.deepEqual(v(call,'right',70),{verdict:'good',line:'Right, and it took 1:10. Worth putting off.'});
    assert.deepEqual(v(call,'wrong',55),{verdict:'good',line:'Wrong after 55 seconds. You were right to put it off.'});
    assert.deepEqual(v(call,'wrong',5),{verdict:'good',line:'Wrong after 5 seconds. You were right to put it off.'});
    assert.deepEqual(v(call,'skipped',3),{verdict:null,line:'Skipped.'});assert.deepEqual(v(call,'unreached',0),{verdict:null,line:'Not reached.'});
  }
  assert.equal(v('now','right',1).line,'Right in 1 second. A good call.');assert.ok(!/!/.test(v('later','right',22).line));
  assert.equal(T.quick,60);assert.equal(T.fast,40);
});

const a=(state,seconds,guess=false)=>({state,pick:state==='skipped'?null:0,guess,seconds});
/* A hand-built finished round on seed 7's questions; `topics` overrides a question's topic so two can share one. */
function round(calls,answers,{late,seed=7,topics={}}={}){
  const questions=JSON.parse(JSON.stringify(L.buildTriage({seed}).questions));for(const [i,t] of Object.entries(topics))questions[i].topic=t;
  return {move:'triage',seed,questions,calls,late:late||calls.map(()=>false),order:L.triageOrder(calls),answers:Array.from({length:8},(_,i)=>answers[i]||null)};
}
const PASSING=()=>round(['now','now','now','now','later','later','leave','leave'],[a('right',30),a('right',45),a('right',60),a('right',20),a('wrong',50),a('right',70),a('skipped',5),null],{seed:11});
test('triage: a passing round, line by line',()=>{
  const d=L.triageDebrief(PASSING(),5000);
  assert.deepEqual([d.right,d.wrong,d.skipped,d.unreached,d.late],[5,1,1,1,0]);assert.equal(d.marks,4.75);
  assert.deepEqual(d.rows.map(r=>r.index),[0,1,2,3,4,5,6,7]);assert.deepEqual(d.rows.map(r=>r.call),['now','now','now','now','later','later','leave','leave']);
  assert.deepEqual(d.rows.map(r=>r.verdict),['good','good','good','good','good','good',null,null]);
  assert.deepEqual(d.rows[4],{index:4,call:'later',late:false,state:'wrong',seconds:50,guess:false,verdict:'good',line:'Wrong after 50 seconds. You were right to put it off.'});
  assert.deepEqual(d.piles,{now:{count:4,answered:4,marks:4,seconds:155},later:{count:2,answered:2,marks:0.75,seconds:120},leave:{count:2,answered:0,marks:0,seconds:5}});
  assert.deepEqual(d.guesses,{count:0,right:0,marks:0});assert.equal(d.pass,true);assert.equal(d.takeaway,'Your sorting matched what happened. Keep the same rhythm in a full timed test.');
  assert.equal(d.entries.length,7);assert.deepEqual(d.entries.map(e=>e.rung),['spot','spot','spot','spot','spot','spot','do']);assert.ok(d.entries.every(e=>e.move==='triage'&&e.at===5000&&e.ok));
  assert.deepEqual(d.entries.slice(0,6).map(e=>e.pick),['now','now','now','now','later','later']);assert.equal(d.entries[6].id,'round-11');assert.deepEqual(d.entries.slice(0,6).map(e=>e.id),PASSING().questions.slice(0,6).map(q=>q.id));
  assert.deepEqual(JSON.parse(JSON.stringify(d)),d);assert.equal(L.cleanHistory(d.entries).length,7,'every entry survives cleanHistory');
  console.log('PASSING DEBRIEF',JSON.stringify({...d,entries:undefined}));
});
test('triage: a failing round, line by line',()=>{
  const r=round(['now','now','later','later','later','leave','now','leave'],[a('wrong',50,true),a('right',85),a('right',22),a('right',30,true),a('wrong',40),null,a('skipped',8),a('wrong',30)],{late:[false,false,true,false,false,false,false,true],seed:12});
  const d=L.triageDebrief(r,1);
  assert.deepEqual([d.right,d.wrong,d.skipped,d.unreached,d.late],[3,3,1,1,2]);assert.equal(d.marks,2.25);
  assert.deepEqual(d.rows.map(x=>x.index),[0,1,6,2,3,4,5,7],'sitting order');assert.deepEqual(d.rows.map(x=>x.verdict),['miss','miss','miss','miss','miss','good',null,'good']);
  assert.deepEqual(d.rows.filter(x=>x.late).map(x=>x.index),[2,7]);assert.deepEqual(d.rows.filter(x=>x.guess).map(x=>x.index),[0,3]);
  assert.deepEqual(d.guesses,{count:2,right:1,marks:0.75});assert.equal(d.pass,false);
  assert.deepEqual(d.piles.now,{count:3,answered:2,marks:0.75,seconds:143});
  assert.equal(d.takeaway,'You put off 2 questions that you then answered within 40 seconds. If you recognise the type, take it in the first pass.');
  assert.equal(d.entries.length,8,'seven judged questions and the round');assert.equal(d.entries.at(-1).ok,false);assert.equal(d.entries.filter(e=>e.rung==='spot'&&e.ok).length,2);
  console.log('FAILING DEBRIEF',JSON.stringify({...d,entries:undefined}));
});
test('triage: the takeaway rules apply in order, with the right counts and wording',()=>{
  const t=r=>L.triageDebrief(r).takeaway;
  // 1: Do now misses on one topic
  const two=round(['now','now','now','later','later','later','leave','leave'],[a('wrong',50),a('wrong',40),a('right',30),a('right',22),a('right',30),null],{topics:{0:'percent',1:'percent'}});
  assert.equal(t(two),'Two of your Do now calls that went wrong were Percentages. Call that type Later until it is quicker.','beats the quick marks put off');
  const three=round(['now','now','now','later','later','later','leave','leave'],[a('wrong',50),a('right',90),a('skipped',4)],{topics:{0:'profit',1:'profit',2:'profit'}});
  assert.equal(t(three),'Three of your Do now calls that went wrong were Profit & loss. Call that type Later until it is quicker.');
  const apart=round(['now','now','later','later','later','later','leave','leave'],[a('wrong',50),a('wrong',40)]);assert.notEqual(t(apart).slice(0,3),'Two','different topics do not count');
  assert.equal(t(apart),'Wrong answers cost you 0.5 marks. If you cannot rule an option out, move on.');
  const tie=round(['now','now','now','now','later','later','leave','leave'],[a('wrong',50),a('wrong',40),a('wrong',30),a('wrong',30)],{topics:{0:'ratio',1:'work',2:'work',3:'ratio'}});assert.match(t(tie),/^Two .* were Ratio & proportion\./,'a tie goes to the topic met first in the sitting');
  assert.equal(t(round(['later','later','later','later','later','later','later','later'],[a('right',60),a('right',60)])),'None of your Do now calls was tested. Call more questions Do now, and answer those first.');
  // a slow right answer on a Do now is a miss too
  const slow=round(['now','now','later','later','later','later','leave','leave'],[a('right',90),a('right',70)],{topics:{0:'speed',1:'speed'}});assert.match(t(slow),/^Two .* were Time, speed & distance\./);
  // 2: quick marks put off
  assert.equal(t(round(['now','now','later','later','later','later','leave','leave'],[a('right',30),a('right',30),a('right',22),a('wrong',50),a('wrong',50)])),'You put off 1 question that you then answered within 40 seconds. If you recognise the type, take it in the first pass.','beats the wrong answers');
  assert.match(t(round(['now','later','leave','later','later','later','leave','leave'],[a('right',30),a('right',40),a('right',10),a('right',12)])),/^You put off 3 questions that/);
  // 3: wrong answers
  const wrong4=round(['later','later','later','later','later','later','later','later'],[a('wrong',50),a('wrong',50),a('wrong',50),a('wrong',50)]);assert.equal(t(wrong4),'Wrong answers cost you 1 mark. If you cannot rule an option out, move on.');
  assert.match(t(round(['now','now','now','now','later','later','leave','leave'],[a('right',30),a('right',30),a('right',30),a('right',30),a('wrong',60),a('wrong',60),a('wrong',60)])),/^Wrong answers cost you 0\.75 marks\./);
  // 4: no Do now tested (a Do now call that was never reached is not tested)
  assert.equal(t(round(['now','now','later','later','later','later','leave','leave'],[null,null,a('right',50),a('wrong',50)])),'None of your Do now calls was tested. Call more questions Do now, and answer those first.');
  // 5: otherwise
  assert.equal(t(round(['now','now','now','later','later','later','leave','leave'],[a('right',30),a('right',30),a('right',30),a('right',50),a('wrong',60),a('right',90)])),'Your sorting matched what happened. Keep the same rhythm in a full timed test.');
  // one wrong answer alone is not a takeaway
  assert.match(t(round(['now','now','now','later','later','later','leave','leave'],[a('right',30),a('right',30),a('wrong',30),a('right',50),a('right',60),a('right',90)])),/^Your sorting matched/);
});
test('triage: pass needs two judged Do now calls, three in four good and at most one wrong answer',()=>{
  const p=(calls,answers)=>L.triageDebrief(round(calls,answers)).pass;const L8=['now','now','now','now','later','later','leave','leave'];
  assert.equal(p(['now','later','later','later','later','later','later','later'],[a('right',20)]),false,'one judged Do now call is not enough');
  assert.equal(p(['now','now','later','later','later','later','later','later'],[a('right',20),a('right',60)]),true,'two good ones');
  assert.equal(p(['now','now','later','later','later','later','later','later'],[a('right',20),a('right',61)]),false,'one in two');
  assert.equal(p(['now','now','now','now','later','later','later','later'],[a('right',20),a('right',20),a('right',20),a('wrong',20)]),true,'exactly three in four, one wrong');
  assert.equal(p(['now','now','now','later','later','later','later','later'],[a('right',20),a('right',20),a('wrong',20)]),false,'two in three is under 75%');
  assert.equal(p(['now','now','now','now','now','later','later','later'],[a('right',20),a('right',20),a('right',20),a('right',20),a('right',61)]),true,'four in five');
  assert.equal(p(['now','now','now','now','now','now','now','later'],[a('right',20),a('right',20),a('right',20),a('right',20),a('right',20),a('skipped',3),a('skipped',3)]),false,'five in seven is under 75%');
  assert.equal(p(['now','now','now','now','later','later','later','later'],[a('right',20),a('right',20),a('right',20),a('right',20),a('wrong',50),a('wrong',50)]),false,'all good Do now calls but two wrong answers');
  assert.equal(p(['now','now','now','now','later','later','later','later'],[a('right',20),a('right',20),a('right',20),a('right',20),a('wrong',50)]),true,'one wrong answer is allowed');
  assert.equal(p(['now','now','later','later','later','later','later','later'],[a('right',20),a('right',20),null]),true,'unreached questions are not held against you');
  assert.equal(p(['now','now','later','later','later','later','later','later'],[a('right',20),null]),false,'an unreached Do now call is not judged');
  assert.equal(p(['later','later','later','later','later','later','later','later'],[a('right',50),a('right',50)]),false,'no Do now calls');
});
test('triage: marks, counts, piles and guesses add up',()=>{
  const d=L.triageDebrief(round(['now','now','later','later','leave','leave','leave','now'],[a('right',30,true),a('wrong',30,true),a('right',50,false),a('wrong',100,false),a('skipped',20,true),a('wrong',10,true),null,a('right',45,true)],{seed:3}));
  assert.deepEqual([d.right,d.wrong,d.skipped,d.unreached],[3,3,1,1]);assert.equal(d.marks,3*1+3*-0.25);assert.equal(d.right+d.wrong+d.skipped+d.unreached,8);
  assert.deepEqual(d.guesses,{count:4,right:2,marks:2*1+2*-0.25},'a skipped question is not counted as a guess');assert.equal(d.rows.find(x=>x.state==='skipped').guess,false);
  assert.equal(Object.values(d.piles).reduce((t,x)=>t+x.marks,0),d.marks);assert.equal(Object.values(d.piles).reduce((t,x)=>t+x.count,0),8);assert.equal(Object.values(d.piles).reduce((t,x)=>t+x.answered,0),d.right+d.wrong);
  assert.equal(d.piles.leave.seconds,30,'time on skipped and answered questions, not unreached ones');assert.equal(d.piles.now.seconds,105);
  const none=L.triageDebrief(round(['now','now','now','now','later','later','leave','leave'],[]));assert.deepEqual([none.marks,none.right,none.unreached,none.pass,none.entries.length],[0,0,8,false,1]);assert.equal(none.rows.every(x=>x.verdict===null&&x.state==='unreached'),true);
  const neg=L.triageDebrief(round(['now','now','now','now','later','later','leave','leave'],[a('wrong',5),a('wrong',5),a('wrong',5)]));assert.equal(neg.marks,-0.75);
  // late counts come from the late flags
  assert.equal(L.triageDebrief(round(['now','now','now','now','later','later','leave','leave'],[],{late:[true,false,false,false,true,true,false,false]})).late,3);
  assert.equal(L.triageDebrief({...round(['now','now','later','later','leave','leave','now','now'],[a('right',20)]),order:undefined}).rows[0].index,0,'a missing order is rebuilt from the calls');
});
test('triage: the entries feed status, summarise and cleanHistory like the other moves',()=>{
  let h=[];
  for(let k=0;k<3;k++){const d=L.triageDebrief(round(['now','now','now','now','later','later','leave','leave'],[a('right',30),a('right',30),a('right',30),a('right',30),a('wrong',50),a('right',70)],{seed:20+k}),1000+k);h.push(...d.entries);assert.equal(d.pass,true);}
  h=L.cleanHistory(JSON.parse(JSON.stringify(h)));const s=L.status(h,'triage');
  assert.deepEqual([s.spot,s.do,s.ready,s.state,s.attempts],[{of:10,correct:10},{of:3,passed:3},true,'ready',21]);
  assert.equal(L.summarise(h).find(x=>x.move==='triage').state,'ready');assert.equal(L.summarise(h).find(x=>x.move==='so-what').state,'new');
  // two rounds are not enough rungs yet; a failed round drops the Do count
  const two=h.slice(0,14);assert.deepEqual([L.status(two,'triage').do,L.status(two,'triage').ready],[{of:2,passed:2},false]);
  const failed=L.triageDebrief(round(['now','now','later','later','later','later','leave','leave'],[a('wrong',50),a('wrong',40)],{seed:30}),9);assert.equal(failed.entries.at(-1).ok,false);
  assert.equal(L.status([...h,...failed.entries],'triage').ready,false);
  assert.deepEqual(L.recentIds(h,'triage',3).length,3);
  const r=L.record({move:'triage',rung:'spot',id:'x'},{ok:true,pick:'later',seconds:12.5,at:5});assert.deepEqual(L.cleanHistory([r]),[r]);
});
test('triage: validTriageRun accepts good saved rounds and rejects the rest',()=>{
  const q=L.buildTriage({seed:9}).questions,blank=()=>Array(8).fill(null);
  const sort=(over={})=>({move:'triage',seed:9,questions:JSON.parse(JSON.stringify(q)),phase:'sort',at:0,calls:[],late:[],order:[],index:0,answers:blank(),used:0,...over});
  const calls=['later','now','leave','now','later','later','now','leave'],order=L.triageOrder(calls);
  const sit=(over={})=>{const answers=blank();for(const i of order.slice(0,3))answers[i]=a('right',12);return {...sort(),phase:'sit',at:8,calls:calls.slice(),late:calls.map(()=>false),order:order.slice(),index:3,answers,used:80,...over};};
  for(const ok of [sort(),sort({at:3,calls:['now','later','leave'],late:[false,true,false],used:4.5}),sort({at:8,calls:calls.slice(),late:calls.map(()=>false)}),sit(),sit({index:0,answers:blank(),used:0}),sit({index:7,answers:(()=>{const x=blank();for(const i of order.slice(0,7))x[i]=a('skipped',3);return x;})(),used:209.9})])assert.equal(L.validTriageRun(JSON.parse(JSON.stringify(ok))),true);
  const bad=[null,undefined,'x',42,[],{},{...sort(),move:'so-what'},{...sort(),seed:'9'},{...sort(),seed:NaN},sort({questions:q.slice(0,7)}),sort({questions:'no'}),
    sort({questions:q.map((x,i)=>i?x:{...x,options:x.options.slice(0,3)})}),sort({questions:q.map((x,i)=>i?x:{...x,topic:'di'})}),sort({questions:q.map((x,i)=>i?x:{...x,topic:'nope'})}),sort({questions:q.map((x,i)=>i?x:{...x,topic:'vocab'})}),
    sort({questions:q.map((x,i)=>i?x:{...x,level:'expert'})}),sort({questions:q.map((x,i)=>i?x:{...x,answer:4})}),sort({questions:q.map((x,i)=>i?x:{...x,answer:'1'})}),sort({questions:q.map((x,i)=>i?x:{...x,prompt:7})}),sort({questions:q.map((x,i)=>i?x:{...x,solution:'steps'})}),sort({questions:q.map((x,i)=>i?x:null)}),sort({questions:q.map((x,i)=>i?x:{...x,shortcut:undefined})}),
    sort({phase:'wait'}),sort({calls:['now'],late:[false]}),sort({at:1,calls:['soon'],late:[false]}),sort({at:2,calls:['now'],late:[false]}),sort({at:1,calls:['now'],late:[]}),sort({at:1,calls:['now'],late:['no']}),sort({at:9}),sort({at:-1}),sort({at:0.5}),
    sort({order:[0]}),sort({index:1}),sort({used:-1}),sort({used:10}),sort({used:NaN}),sort({used:'3'}),sort({answers:blank().slice(0,7)}),sort({answers:'x'}),sort({answers:blank().map((_,i)=>i?null:a('right',5))}),
    sit({calls:calls.slice(0,7),late:calls.slice(0,7).map(()=>false)}),sit({order:order.slice().reverse()}),sit({order:order.slice(0,7)}),sit({index:8}),sit({index:-1}),sit({index:2.5}),sit({used:210}),sit({used:-3}),sit({at:7}),
    sit({answers:(()=>{const x=blank();for(const i of order.slice(0,2))x[i]=a('right',12);return x;})()}),sit({answers:(()=>{const x=blank();for(const i of order.slice(0,4))x[i]=a('right',12);return x;})()}),
    sit({answers:sit().answers.map((x,i)=>i===order[0]?{...x,state:'maybe'}:x)}),sit({answers:sit().answers.map((x,i)=>i===order[0]?{...x,pick:4}:x)}),sit({answers:sit().answers.map((x,i)=>i===order[0]?{...x,guess:'yes'}:x)}),sit({answers:sit().answers.map((x,i)=>i===order[0]?{...x,seconds:-1}:x)}),sit({answers:sit().answers.map((x,i)=>i===order[0]?{...x,seconds:'4'}:x)}),sit({answers:sit().answers.map((x,i)=>i===order[0]?5:x)})];
  bad.forEach((b,i)=>assert.equal(L.validTriageRun(b),false,'bad case '+i));
});
