const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const D=require('../src/drill-questions.js');const {fixture}=require('./dom.cjs');

const UNIT={lakh:1e5,million:1e6,crore:1e7,billion:1e9};
const sum=(series,i)=>series.reduce((t,s)=>t+s.values[i],0);
const growth=s=>(s.values[1]-s.values[0])/s.values[0]*100;
// Independent formulas, written separately from the generators, keyed by question kind.
const FORMULA={
  'percent-of':i=>i.p*i.base/100,'share':i=>i.part/i.total*100,'pct-change':i=>(i.now-i.old)/i.old*100,
  'reverse':i=>i.after/(i.up?1+i.p/100:1-i.p/100),'pp-vs-pct':i=>(i.b-i.a)/i.a*100,'margin-pct':i=>(i.R-i.C)/i.R*100,
  'profit-from-margin':i=>i.R*i.m/100,'contribution':i=>(i.P-i.V)*i.N-i.F,'markup':i=>i.M/(100+i.M)*100,
  'be-units':i=>i.F/(i.P-i.V),'payback':i=>i.I/i.S,'be-price':i=>i.Vc+i.F/i.N,
  'convert':i=>i.x*UNIT[i.from]/UNIT[i.to],'scale':i=>i.N*1e5*i.S*12/1e7,'per-unit':i=>i.R*1e7/(i.Nm*1e6),
  'compound':i=>i.B*(1+i.g/100)**i.Y,'double':i=>Math.log(2)/Math.log(1+i.g/100),'cagr':i=>((i.B/i.A)**(1/i.N)-1)*100,
  'pv':i=>i.X/(1+i.rate/100)**i.N,'perpetuity':i=>i.C/((i.rate-i.g)/100),'npv-annuity':i=>i.C*i.factor-i.I,
  'est-multiply':i=>i.a*i.b,'est-divide':i=>i.total/i.b,
  'chart-share':i=>i.series.find(s=>s.label===i.label).values[1]/sum(i.series,1)*100,
  'chart-growth':i=>growth(i.series.find(s=>s.label===i.label)),'chart-total-growth':i=>(sum(i.series,1)-sum(i.series,0))/sum(i.series,0)*100,
  'chart-fastest':i=>{const g=i.series.map(growth);return g.indexOf(Math.max(...g))}
};
const close=(a,b)=>Math.abs(a-b)<=1e-6*Math.max(1,Math.abs(b));
const sample=(fn)=>{for(const skill of D.SKILL_IDS)for(const level of D.LEVELS.map(l=>l.id))for(let seed=1;seed<=150;seed++)fn(D.generate(skill,level,D.rng(seed*7919+skill.length)),skill,level)};

test('every generated question matches an independent calculation and is well formed',()=>{
  const kinds=new Set();
  sample((q,skill,level)=>{
    kinds.add(q.kind);const where=`${skill}/${level}/${q.kind}: ${q.prompt}`;
    assert.equal(q.skill,skill,where);assert(FORMULA[q.kind],'no independent formula for '+q.kind);
    assert(close(q.answer,FORMULA[q.kind](q.inputs)),`${where} → ${q.answer} vs ${FORMULA[q.kind](q.inputs)}`);
    assert(!/NaN|undefined|Infinity|null|\[object/.test(q.prompt+q.steps.join(' ')+q.display+q.toleranceLabel),where);
    assert(q.steps.length>=1&&q.tip&&q.toleranceLabel,where);
    if(q.type==='choice'){assert.equal(q.choices[q.answer],q.display,where);assert(D.check(q,String(q.answer)).ok);assert(!D.check(q,String((q.answer+1)%q.choices.length)).ok);return}
    assert(q.tolerance>0,where);
    // The answer as displayed (with ₹, commas and units) is accepted; one clearly outside the range is not.
    assert(D.check(q,q.display).ok,`${where} rejects its own display ${q.display}`);
    assert(!D.check(q,String(q.answer+Math.max(q.tolerance*2,Math.abs(q.answer)*0.2,1))).ok,where);
  });
  assert.deepEqual([...kinds].sort(),Object.keys(FORMULA).sort(),'every question kind is exercised');
});

test('generated case numbers stay realistic: positive inputs, sensible ranges, distinct fastest segment',()=>{
  sample(q=>{
    const i=q.inputs;
    if(q.kind==='npv-annuity')assert(Math.abs(i.factor-(1-(1+i.rate/100)**-5)/(i.rate/100))<0.001,'annuity factor is accurate');
    if(['be-units','payback','be-price','per-unit','compound','pv','perpetuity','reverse'].includes(q.kind))assert(q.answer>0,q.prompt);
    if(q.kind==='be-units')assert(Number.isInteger(q.answer),q.prompt);
    if(q.kind==='pct-change')assert.notEqual(i.old,i.now);
    if(q.kind.startsWith('chart-')){for(const s of i.series)assert(s.values.every(v=>v>0&&Number.isFinite(v)));assert.equal(q.chart.series.length,4)}
    if(q.kind==='chart-fastest'){const g=i.series.map(growth).sort((a,b)=>b-a);assert(g[0]-g[1]>=3-1e-9,'fastest segment is unambiguous')}
    if(q.kind==='double')assert(D.check(q,String(72/i.g)).ok,'rule of 72 answer is accepted');
    if(q.kind.startsWith('est-')){const shown=q.steps[1].split(/[=≈]/).pop().trim().replace(/,/g,'');assert(D.check(q,shown).ok,`worked rounding ${shown} sits inside the accepted range for ${q.prompt}`)}
  });
});

test('rounds are reproducible from a seed, balanced across skills and free of duplicates',()=>{
  const a=D.buildRound({skills:['percent','npv','exhibit'],level:'stretch',count:12,seed:99}),b=D.buildRound({skills:['percent','npv','exhibit'],level:'stretch',count:12,seed:99});
  assert.deepEqual(a,b);assert.equal(a.length,12);
  for(const s of ['percent','npv','exhibit'])assert.equal(a.filter(q=>q.skill===s).length,4);
  assert.equal(new Set(a.map(q=>q.prompt+JSON.stringify(q.chart))).size,12);
  assert.notDeepEqual(D.buildRound({seed:1}),D.buildRound({seed:2}));
  assert.throws(()=>D.buildRound({skills:[]}),/at least one/);assert.throws(()=>D.generate('nope','interview',D.rng(1)),/Unknown/);
});

test('answer parsing accepts the ways people write numbers and rejects everything else',()=>{
  for(const [raw,v] of [['1,20,000',120000],['₹3.5 crore',3.5],['−4',-4],['-4.25',-4.25],['12.5%',12.5],[' 7 years ',7],['1e3',1000],['.5',0.5],['19,000 units',19000],['1,850 lakh',1850]])assert.equal(D.parseAnswer(raw),v,raw);
  for(const raw of ['','abc','1.2.3','5 apples','--3','12%%x'])assert(Number.isNaN(D.parseAnswer(raw)),raw);
  const q={type:'number',answer:10,tolerance:0.5};assert(D.check(q,'10.5').ok);assert(!D.check(q,'10.6').ok);assert(!D.check(q,'ten').valid);
});

test('progress summary uses recent attempts and picks the weakest practised skill',()=>{
  const at=n=>({skill:'npv',ok:n%4===0,seconds:20+n});
  const runs=[{at:1,results:Array.from({length:40},(_,n)=>at(n))},{at:2,results:[{skill:'percent',ok:true,seconds:10},{skill:'percent',ok:true,seconds:14},{skill:'percent',ok:false,seconds:30},{skill:'percent',ok:true,seconds:12}]},{at:3,results:[{skill:'margin',ok:false,seconds:5}]}];
  const stats=D.summarise(runs),npv=stats.find(s=>s.skill==='npv'),pct=stats.find(s=>s.skill==='percent');
  assert.equal(npv.attempts,30);assert.equal(npv.correct,7);assert.equal(pct.accuracy,0.75);assert.equal(pct.medianSeconds,12);
  assert.equal(stats.find(s=>s.skill==='units').accuracy,null);
  assert.equal(D.weakest(stats).skill,'npv','margin has too few attempts to judge');
  assert.equal(D.weakest(D.summarise([{at:1,results:Array(5).fill({skill:'units',ok:true,seconds:3})}])),null,'a perfect record needs no suggestion');
});

function answer(f,correct){const s=f.run('CaseDrill.state()'),q=s.run.questions[s.run.index];
  if(q.type==='choice')f.w.document.querySelector(`[data-choice="${correct?q.answer:(q.answer+1)%q.choices.length}"]`).click();
  else{f.$('drillInput').value=correct?q.display:String(q.answer*3+97);f.$('drillForm').dispatchEvent(new f.w.Event('submit',{cancelable:true}))}
  return q}

test('a full drill round records results, shows working and feeds progress',()=>{const f=fixture();try{
  assert(f.$('drillCallout'),'library promotes the drill');f.$('drillNav').click();assert.equal(f.run('view'),'drill');assert.equal(f.w.location.hash,'#drill');
  f.w.document.querySelectorAll('[name=drillSkill]').forEach(x=>x.checked=['percent','exhibit'].includes(x.value));f.$('drillCount').value='5';f.$('drillCount').dispatchEvent(new f.w.Event('change'));
  f.$('drillStart').click();assert.equal(f.run('CaseDrill.state().run.questions.length'),5);
  for(let i=0;i<5;i++){
    const q=answer(f,i!==2);const fb=f.$('drillFeedback');assert(fb.textContent.includes(i===2?'Not quite':'Correct'));assert(fb.textContent.includes(q.display));assert.equal(fb.querySelectorAll('.drill-steps li').length,q.steps.length);
    if(q.chart)assert(f.w.document.querySelector('.drill-chart svg rect.bar'));f.$('drillNext').click();
  }
  assert.equal(f.w.document.querySelector('.drill-title').textContent,'4 of 5 correct');assert(f.$('drillRetry').textContent.includes('1'));
  const runs=JSON.parse(f.w.localStorage.getItem('cr-drill-history'));assert.equal(runs.length,1);assert.equal(runs[0].correct,4);assert.equal(f.w.localStorage.getItem('cr-drill-run'),'null');
  assert.deepEqual(JSON.parse(f.w.localStorage.getItem('cr-drill-prefs')).skills,['percent','exhibit']);
  f.$('drillRetry').click();assert.equal(f.run('CaseDrill.state().run.questions.length'),1);assert.equal(f.run('CaseDrill.state().run.origin'),'retry');
  f.$('drillExit').click();assert(f.$('drillResume'));assert(f.w.document.querySelector('.drill-stats').textContent.includes('Percentages'));
  f.$('homeNav').click();assert.equal(f.run('view'),'home');assert.equal(f.w.location.hash,'');assert.deepEqual(f.errors,[]);
}finally{f.dom.window.close()}});

test('invalid input is not recorded, revealing working counts as a miss, ending early keeps answered questions',()=>{const f=fixture();try{
  f.run('CaseDrill.open()');f.$('drillStart').click();const first=f.run('CaseDrill.state().run.questions[0]');
  if(first.type==='number'){f.$('drillInput').value='about ten';f.$('drillForm').dispatchEvent(new f.w.Event('submit',{cancelable:true}));assert.equal(f.run('CaseDrill.state().run.results.length'),0);assert(f.$('drillHint').textContent.includes('Enter a number'))}
  f.$('drillReveal').click();assert(f.$('drillFeedback').textContent.includes('Worked answer'));assert.equal(f.run('CaseDrill.state().run.results[0].skipped'),true);
  f.$('drillNext').click();answer(f,true);f.$('drillEnd').click();
  const runs=JSON.parse(f.w.localStorage.getItem('cr-drill-history'));assert.equal(runs[0].results.length,2);assert.equal(runs[0].correct,1);assert.equal(runs[0].results[0].skipped,true);assert.deepEqual(f.errors,[]);
}finally{f.dom.window.close()}});

test('an unfinished round survives reload; #drill links open the drill; corrupt storage is ignored',()=>{const f=fixture();let g,h;try{
  f.run('CaseDrill.open()');f.$('drillStart').click();answer(f,true);f.$('drillNext').click();
  const storage={};for(const k of Object.keys(f.w.localStorage))storage[k]=f.w.localStorage.getItem(k);
  g=fixture({url:'https://case.example/#drill',storage});assert.equal(g.run('view'),'drill');assert(g.$('drillResume'));g.$('drillResume').click();
  assert.equal(g.w.document.querySelector('.section-title').textContent,'Question 2 of 10');assert.equal(g.run('CaseDrill.state().run.questions[1].prompt'),f.run('CaseDrill.state().run.questions[1].prompt'));
  h=fixture({url:'https://case.example/#drill',storage:{'cr-drill-run':'{"questions":[{"prompt":1}],"index":4}','cr-drill-history':'"oops"','cr-drill-prefs':'{"skills":["bogus"],"count":7}'}});
  assert.equal(h.$('drillResume'),null);assert.equal(h.w.document.querySelectorAll('[name=drillSkill]:checked').length,D.SKILL_IDS.length);assert.equal(h.$('drillCount').value,'10');assert.deepEqual([...f.errors,...g.errors,...h.errors],[]);
}finally{f.dom.window.close();g?.dom.window.close();h?.dom.window.close()}});

test('listening practice hides the written question and reads it aloud once',()=>{const f=fixture();try{
  f.run('CaseDrill.open()');f.$('drillListen').checked=true;f.$('drillListen').dispatchEvent(new f.w.Event('change'));assert(f.$('drillAloud').checked);
  f.$('drillStart').click();const q=f.run('CaseDrill.state().run.questions[0]');
  assert(!f.$('drillPrompt').textContent.includes(q.prompt));assert.deepEqual(f.w.__spoken,[q.spoken]);
  f.$('drillShowPrompt').click();assert(f.$('drillPrompt').textContent.includes(q.prompt));assert.equal(f.w.__spoken.length,1,'revealing does not repeat the question');
}finally{f.dom.window.close()}});

test('drill and case sessions do not interfere with each other',()=>{const f=fixture();try{
  f.run("start('cement')");f.$('answer').value='Keep my case answer';f.$('answer').dispatchEvent(new f.w.Event('input'));
  f.$('drillNav').click();f.$('drillStart').click();answer(f,true);f.$('homeNav').click();
  assert(f.$('resume'),'the case session can still be resumed');f.$('resume').click();assert.equal(f.$('answer').value,'Keep my case answer');
  assert.equal(f.run('history.length'),0,'drill rounds are not case sessions');assert(f.run('CaseDrill.state().run'),'the drill round is kept');assert.deepEqual(f.errors,[]);
}finally{f.dom.window.close()}});

test('every local file referenced by index.html exists and is shipped by the build',()=>{
  const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),{STATIC}=require('../scripts/build.cjs');
  const refs=[...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map(m=>m[1]);assert(refs.length>=8);
  for(const ref of refs){assert(fs.existsSync(path.join(root,ref)),ref+' exists');assert(STATIC.includes(ref.split('/')[0]),ref+' is copied to public/')}
});
