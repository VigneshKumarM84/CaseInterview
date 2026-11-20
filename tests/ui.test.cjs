const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {handle,DIMENSIONS}=require('../lib/ai.cjs');const {fixture,settle}=require('./dom.cjs');
function configure(f){f.$('aiSettings').click();f.$('aiModel').value='test-model';f.$('aiKey').value='test-key-not-a-real-key';f.$('aiConsent').checked=true;f.$('aiSave').click()}
function type(f,id,text){const e=f.$(id);assert(e,id+' exists');e.value=text;e.dispatchEvent(new f.w.Event('input',{bubbles:true}))}
function mockServer(f){f.w.fetch=async(url,options)=>{assert.equal(url,'/api/ai');const body=JSON.parse(options.body);const result=body.action==='information'?{factIds:['exhibit:economics']}:body.action==='followup'?{question:'What evidence would change your conclusion?'}:body.action==='feedback'?{summary:'Review <script>not executed</script>',dimensions:DIMENSIONS.map(name=>({name,assessment:'Review your evidence.',quote:'Test reasoning',nextStep:'Quantify the gap.'})),priorities:['Check assumptions'],practice:'Recalculate a downside.',followups:['What changes?']}:{ok:true};const data=await handle(body,options.headers['X-AI-Key'],{skipRateLimit:true,fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(result)}}],usage:{prompt_tokens:10,completion_tokens:5}})})});return {ok:true,headers:{get:()=> 'application/json'},json:async()=>data}}}
test('all 24 paths complete in a real DOM, reports and exports include path-specific content',()=>{const f=fixture();try{const cases=JSON.parse(f.run('JSON.stringify(CASES)'));for(const c of cases)for(const branch of JSON.parse(f.run(`JSON.stringify(RICH['${c.id}'].branches)`))){f.run('session=null');f.run(`start('${c.id}')`);for(let i=0;i<8;i++){assert.equal(f.run('session.step'),i);type(f,'answer','Test reasoning');if(i===1)f.w.document.querySelector('[data-open]').click();if(i===3)f.w.document.querySelector(`[data-path="${branch.id}"]`).click();if([2,4,5].includes(i))type(f,'number',String(f.run('richCalc().openEstimate?1500000:richCalc().answer')));f.$('next').click()}assert.equal(f.run('view'),'report');assert.equal(f.$('generatedFeedback'),null);assert.equal(f.$('externalAIReview').hidden,true);assert(f.run('reportText(report)').includes(branch.shock))}assert.equal(f.run('history.length'),24);assert.deepEqual(f.errors,[])}finally{f.dom.window.close()}});
test('BYOK natural requests, adaptive discussion, feedback, exports and storage work end-to-end',async()=>{const f=fixture();try{mockServer(f);configure(f);f.run("start('cement')");type(f,'naturalQuestion','What happened to fuel costs?');f.$('askInformation').click();await settle();assert(f.run("session.opened.includes('economics')"));assert(f.$('informationHistory').textContent.includes('Fuel'));type(f,'answer','Test reasoning');f.$('askFollowup').click();await settle();assert.equal(f.run('session.aiTurns.length'),1);const reply=f.w.document.querySelector('[data-reply]');type(f,reply.id,'I would compare the input price with consumption intensity.');f.$('nextFollowup').click();await settle();assert.equal(f.run('session.aiTurns.length'),2);assert(f.run('transcript(session)').includes('consumption intensity'));f.run("session.step=7;session.branch='fuel';session.answers.implementation='Test reasoning';session.answers.recommendation='Test reasoning';session.answers.number='30';session.answers.deepNumber='23';session.answers.stressNumber='15';advance()");f.$('generateReview').click();await settle();assert(f.run('!!report.aiFeedback'));assert(f.$('generatedFeedback').textContent.includes('<script>not executed</script>'));assert.equal(f.$('generatedFeedback').querySelectorAll('script').length,0);assert(f.run('reportText(report)').includes('AI REVIEW'));const stored=Object.keys(f.w.localStorage).map(k=>f.w.localStorage.getItem(k)).join('');assert(!stored.includes('test-key-not-a-real-key'));assert(stored.includes('consumption intensity'));f.$('aiSettings').click();f.$('aiClear').click();assert.equal(f.$('aiKey').value,'');assert.equal(f.$('aiSettings').textContent,'Settings');assert.deepEqual(f.errors,[])}finally{f.dom.window.close()}});
test('navigation cancels outstanding AI and never applies a stale response',async()=>{const f=fixture();try{configure(f);f.run("start('cement')");type(f,'answer','Test reasoning');f.w.fetch=(_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{const e=new Error('aborted');e.name='AbortError';reject(e)}));f.$('askFollowup').click();f.$('next').click();await settle();assert.equal(f.run('session.step'),1);assert.equal(f.run('(session.aiTurns||[]).length'),0);assert.deepEqual(f.errors,[])}finally{f.dom.window.close()}});
test('switching providers clears the form key and offline mode stays usable',()=>{const f=fixture();try{configure(f);f.$('aiSettings').click();f.$('aiProvider').value='anthropic';f.$('aiProvider').dispatchEvent(new f.w.Event('change'));assert.equal(f.$('aiKey').value,'');assert.equal(f.$('aiConsent').checked,false);f.$('closeModal').click();f.run("start('cement')");assert(f.$('answer'));assert(f.$('next'));assert.deepEqual(f.errors,[])}finally{f.dom.window.close()}});
test('changing a branch discards path-specific AI discussion and later answers',()=>{const f=fixture();try{f.run("start('cement');session.step=3;session.branch='fuel';session.answers.deepReason='Old path';session.aiTurns=[{stage:1,question:'Early',answer:'Keep'},{stage:4,question:'Fuel only',answer:'Discard'}];session.infoRequests=[{stage:5,question:'Fuel update',facts:[]}];renderSession()");f.w.document.querySelector('[data-path="pricing"]').click();assert.equal(f.run('session.branch'),'pricing');assert.equal(f.run('session.answers.deepReason'),undefined);assert.equal(f.run('session.aiTurns.length'),1);assert.equal(f.run('session.infoRequests.length'),0)}finally{f.dom.window.close()}});
test('saved sessions survive reload but a connected key does not',()=>{const f=fixture();let g;try{configure(f);f.run("start('cement')");type(f,'answer','Retain this answer');const saved={};for(const k of Object.keys(f.w.localStorage))saved[k]=f.w.localStorage.getItem(k);g=fixture();for(const [k,v] of Object.entries(saved))g.w.localStorage.setItem(k,v);g.run("session=read('cr-session',null);renderSession()");assert.equal(g.$('answer').value,'Retain this answer');assert.equal(g.$('aiSettings').textContent,'Settings');assert(!JSON.stringify(saved).includes('test-key-not-a-real-key'))}finally{f.dom.window.close();g?.dom.window.close()}});
test('provider errors leave answers intact and allow a retry',async()=>{const f=fixture();try{configure(f);f.run("start('cement')");type(f,'answer','Retain after quota error');f.w.fetch=async()=>({ok:false,headers:{get:()=> 'application/json'},json:async()=>({error:'Provider usage or rate limit reached.'})});f.$('askFollowup').click();await settle();assert(f.$('coachStatus').textContent.includes('rate limit'));assert.equal(f.run('session.answers.structure'),'Retain after quota error');assert.equal(f.$('askFollowup').disabled,false);assert.equal(f.run('(session.aiTurns||[]).length'),0)}finally{f.dom.window.close()}});
test('the four-stage notice appears only when a legacy session is opened, not in the library',()=>{const f=fixture();try{
 f.run('casesPage()');assert.doesNotMatch(f.$('app').textContent,/four-stage/);
 f.run("session={id:'cement',version:2,step:0,started:Date.now(),opened:[],answers:{},probes:[]};casesPage()");assert.doesNotMatch(f.$('app').textContent,/four-stage/,'not even with a legacy session waiting to resume');
 f.$('resume').click();assert.equal(f.run('view'),'session');assert.match(f.$('legacyNote').textContent,/earlier four-stage format/);assert.equal(f.w.document.querySelectorAll('#legacyNote').length,1);
 f.run("session=null");f.run("start('cement')");assert.equal(f.$('legacyNote'),null);assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close()}});
test('legacy four-stage sessions can finish and receive an AI review section',()=>{const f=fixture();try{f.run("session={id:'cement',version:2,step:3,started:Date.now(),opened:['economics'],answers:{structure:'Old approach',number:30,working:'Old calculation',recommendation:'Old recommendation'},probes:[]};renderSession()");f.$('next').click();assert.equal(f.run('view'),'report');assert.equal(f.$('generateReview'),null);configure(f);assert(f.$('generateReview'));assert(f.run('transcript(report)').includes('Old recommendation'))}finally{f.dom.window.close()}});
test('normal practice has no AI flow; enabling and disconnecting preserve the current answer',()=>{const f=fixture();try{let calls=0;f.w.fetch=()=>{calls++;throw Error('Unexpected request')};f.run("start('cement')");assert.equal(f.$('liveCoach'),null);assert.equal(f.$('naturalQuestion'),null);assert.equal(f.$('askFollowup'),null);assert(!f.$('app').textContent.includes('Connect your own'));type(f,'answer','My draft must stay');configure(f);assert.equal(f.$('answer').value,'My draft must stay');assert(f.$('naturalRequest'));assert.equal(f.$('naturalRequest').open,false);assert.equal(f.$('cancelCoach').hidden,true);assert(f.$('naturalRequest').compareDocumentPosition(f.$('answer')) & f.w.Node.DOCUMENT_POSITION_FOLLOWING);f.$('aiSettings').click();f.$('aiClear').click();assert.equal(f.$('liveCoach'),null);assert.equal(f.$('naturalRequest'),null);assert.equal(f.$('answer').value,'My draft must stay');assert.equal(f.run('session.step'),0);assert.equal(calls,0)}finally{f.dom.window.close()}});
test('guesstimate accepts own assumptions without exhibits and does not grade the initial total',()=>{const f=fixture();try{
 f.run("start('guesstimate')");type(f,'answer','Define the market');f.$('next').click();type(f,'answer','My population and frequency assumptions');f.$('next').click();assert.equal(f.run('session.step'),2);
 for(const number of ['1500000','300000']){type(f,'answer','My assumptions produce a range');type(f,'number',number);assert.equal(f.run('calculation(session)'),null);assert.equal(f.run('matches(session.answers.number,richCalc())'),null)}
 f.$('next').click();for(let i=3;i<8;i++){type(f,'answer','Explain assumptions and validate');if(i===3)f.w.document.querySelector('[data-path="demand"]').click();if(i===4||i===5)type(f,'number',String(f.run('richCalc().answer')));f.$('next').click()}
 assert.equal(f.run('view'),'report');assert.equal(f.w.document.querySelector('.metric').textContent,'2/2');assert(f.$('app').textContent.includes('not automatically graded'));assert(f.run('reportText(report)').includes('Assumption-led estimate; not automatically graded'));assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close()}});
test('diagnosis ending and review stay focused on defining and verifying the problem',()=>{const f=fixture();try{
 f.run("start('diagnosis');session.branch='reconcile';session.step=6;renderSession()");assert(f.w.document.querySelector('.interviewer').textContent.includes('Do not recommend a fix'));assert(f.w.document.querySelector('.sidebar').textContent.includes('Define the problem'));assert(!f.w.document.querySelector('.sidebar').textContent.includes('Implement'));
 type(f,'answer','Verified decline and reporting gap');f.$('next').click();assert(f.w.document.querySelector('.interviewer').textContent.includes('diagnostic tests'));type(f,'answer','Reconcile transactions by cohort');f.$('next').click();assert(f.run('transcript(report)').includes('VERIFY CAUSES'));assert(f.run('aiPacket(report)').includes('DIAGNOSIS-ONLY'));assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close()}});

test('the library filters consulting and product cases; product cases use their own stages and closing notes',()=>{const f=fixture();try{
 f.$('casesNav').click();const visible=()=>[...f.w.document.querySelectorAll('#library .card')].filter(c=>!c.hidden).length;
 assert.equal(visible(),12);f.w.document.querySelector('[data-track-filter="product"]').click();assert.equal(visible(),3);
 assert([...f.w.document.querySelectorAll('#library .card')].filter(c=>!c.hidden).every(c=>c.textContent.includes('PRODUCT')));
 f.w.document.querySelector('[data-track-filter="consulting"]').click();assert.equal(visible(),9);
 assert(f.$('app').textContent.includes('CASE 12 ·'),'two-digit case numbers');assert(!f.$('app').textContent.includes('CASE 010'));
 f.$('caseTool-drill').click();f.$('casesNav').click();assert.equal(visible(),9,'the filter is kept when returning to the case page');
 f.run("start('experiment');session.branch='validity';session.step=6;renderSession()");
 assert(f.w.document.querySelector('.sidebar').textContent.includes('Plan the launch'));assert(f.$('app').textContent.includes(f.run('RICH.experiment.closingNote')));
 assert(!f.$('app').textContent.includes('hypothetical cross-check'),'no guesstimate note on product cases');
 type(f,'answer','Hold the launch and test a revised streak');f.$('next').click();type(f,'answer','Staged rollout with guardrails');f.$('next').click();
 assert.equal(f.run('view'),'report');assert(f.run('aiPacket(report)').includes('Product metrics and experimentation case'));assert.deepEqual(f.errors,[]);
}finally{f.dom.window.close()}});

/* ---------- Active practice time on solo cases ---------- */
const clockAt=(f,ms)=>f.run(`Date.now = () => ${ms}`);
const spent=f=>f.run('elapsed(session)');
test('case time accrues only while the session screen is showing',()=>{const f=fixture();try{
 const T=Date.UTC(2026,0,1);clockAt(f,T);f.run("start('cement')");assert.equal(f.run('view'),'session');
 clockAt(f,T+60000);assert.equal(spent(f),60);
 f.run('home()');clockAt(f,T+60000+2*24*3600*1000);assert.equal(f.run('view'),'home');assert.equal(spent(f),60,'two days on the home page add nothing');
 f.run('casesPage()');f.$('resume').click();assert.equal(f.run('view'),'session');assert.equal(spent(f),60);
 clockAt(f,T+60000+2*24*3600*1000+30000);assert.equal(spent(f),90);
 f.run('syncClock()');f.w.dispatchEvent(new f.w.Event('pagehide'));clockAt(f,T+10*24*3600*1000);assert.equal(spent(f),90,'a hidden page adds nothing');
 f.run('Aptitude.open()');clockAt(f,T+11*24*3600*1000);assert.equal(spent(f),90,'another tool adds nothing');
 assert.deepEqual(f.errors,[]);
}finally{f.dom.window.close()}});
test('a reload after a gap does not count the time away, and the debrief says active practice',()=>{const f=fixture();let g;try{
 const T=Date.UTC(2026,0,1);clockAt(f,T);f.run("start('cement')");clockAt(f,T+45000);
 const saved={};for(const k of Object.keys(f.w.localStorage))saved[k]=f.w.localStorage.getItem(k);
 assert(JSON.parse(saved['cr-session']).runningSince,'the tab was closed mid-case with the clock running');
 g=fixture({storage:saved});assert.equal(g.run('session.runningSince'),null,'a stored running stretch is dropped at load');
 clockAt(g,T+3*24*3600*1000);g.run('casesPage()');g.$('resume').click();assert.equal(spent(g),0);
 clockAt(g,T+3*24*3600*1000+20000);assert.equal(spent(g),20);
 g.run("session.version=2;session.step=3;session.opened=['economics'];session.answers={structure:'a',number:30,working:'w',recommendation:'r'};renderSession()");g.$('next').click();
 assert.equal(g.run('view'),'report');assert.match(g.$('app').textContent,/Minutes of active practice/);assert.equal(g.run('history[0].runningSince'),null);assert.equal(g.run('elapsed(history[0])'),20);
 assert.deepEqual([...f.errors,...g.errors],[]);
}finally{f.dom.window.close();g?.dom.window.close()}});
test('a finished session from before active-time tracking keeps its old duration and label',()=>{const old={id:'cement',version:2,step:3,started:1000,finished:1000+7*60000,opened:[],answers:{structure:'s',number:30,working:'w',recommendation:'r'},probes:[],uid:'old'};
 const f=fixture({storage:{'cr-history':JSON.stringify([old])}});try{
 assert.equal(f.run('history.length'),1);assert.equal(f.run('elapsed(history[0])'),7*60);
 clockAt(f,Date.now()+5*24*3600*1000);f.run('showReport(history[0])');assert.match(f.$('app').textContent,/Minutes, including pauses/);assert.equal(f.run('elapsed(history[0])'),7*60);
 // An unfinished legacy session starts counting from zero when it is first resumed.
 f.run("session={id:'cement',version:2,step:0,started:1000,opened:[],answers:{},probes:[]};renderSession()");assert.equal(f.run('session.activeMs'),0);assert.equal(spent(f),0);
 assert.deepEqual(f.errors,[]);
}finally{f.dom.window.close()}});

/* ---------- Copy that must stay accurate ---------- */
test('the About text counts the cases from the catalogue, the home page makes no offline promise and the nav counts completed cases',()=>{const f=fixture();try{
 f.$('privacy').click();const about=f.$('modalContent').textContent;const n=f.run('CASES.length');
 assert(about.includes(`${n} fictional cases`),'count comes from CASES.length');assert.doesNotMatch(about,/Six fictional|Expanded edition/);
 assert.equal((about.match(new RegExp(`${n} (original|fictional) cases`,'g'))||[]).length,1,'the count is stated once');
 assert.doesNotMatch(f.$('app').textContent,/offline/i);assert.match(f.$('app').textContent,/your answers stay in this browser/);
 assert.equal(f.$('historyNav').textContent.replace(/\s+/g,' ').trim(),'Completed cases 0');assert(f.$('count'));
 assert.deepEqual(f.errors,[]);
}finally{f.dom.window.close()}});
test('case content: the experiment, prioritise, market and operations corrections are in the catalogue',()=>{
 const data=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../data/cases.json'),'utf8'));const all=JSON.stringify(data);
 assert.doesNotMatch(all,/halved since week 4|priced to match|The experiment holds up once unexposed/);
 const ex=data.rich.experiment,dur=ex.branches.find(b=>b.id==='durability'),val=ex.branches.find(b=>b.id==='validity');
 assert.match(dur.stressCalc.working,/has not fallen steadily \(week 4 was above week 3\)/);assert.equal(dur.stressCalc.answer,5);
 assert.equal(val.calc.answer,20);assert.match(val.calc.working,/assumes the 4,000 unexposed learners retained at the control rate/);
 assert.match(val.model,/^The randomised result is 19\.8% against 18\.0%/);assert.match(val.model,/within what chance alone could produce/);
 assert.match(data.rich.prioritise.branches.find(b=>/priced|0\.1%/.test(b.model||'')).model,/narrows the gap with the rival’s free offer without matching it/);
 const mk=data.rich.market.branches.map(b=>b.shock||'').join(' ');assert.match(mk,/planned rollout is entirely in dispersed areas/);
 const op=data.rich.operations.branches.map(b=>(b.stressCalc||{}).working||'').join(' ');assert.match(op,/45,440\/day/);assert.match(op,/2,560\/day goes unmet/);
 // Retention lifts quoted in the experiment case: 20%, 15%, 8%, 10% (weeks 1 to 4), so the lift is not falling steadily.
 const rel=[[30,36],[24,27.6],[20,21.6],[18,19.8]].map(([c,s])=>Math.round((s-c)/c*100));assert.deepEqual(rel,[20,15,8,10]);
});
