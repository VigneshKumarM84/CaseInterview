const test=require('node:test'),assert=require('node:assert/strict');
const B=require('../src/behavioural-content.js');const {fixture}=require('./dom.cjs');

const text=f=>f.w.document.querySelector('#app').textContent;
const q=(f,s)=>f.w.document.querySelector(s);
const input=(f,el,v)=>{el.value=v;el.dispatchEvent(new f.w.Event('input',{bubbles:true}))};
const storageOf=f=>{const s={};for(const k of Object.keys(f.w.localStorage))s[k]=f.w.localStorage.getItem(k);return s};
const GAP=/undefined|\bnull\b|NaN|\[object/;
/* A fake browser speech recogniser: tests drive it with say() and end(). */
function fakeRecognition(f){const made=[];f.w.SpeechRecognition=function(){made.push(this);this.start=()=>this.onstart?.();this.abort=()=>{this.aborted=true;this.onend?.()};this.stop=this.abort};
  return {made,say(t){const r=made.at(-1);r.onresult({results:[[{transcript:t}]]})},end(){made.at(-1).onend()}}}

const STORY_ANSWER='I was the coordinator of our college fest. Two weeks before, the main sponsor pulled out. My job was to close a ₹2 lakh gap. I listed forty local businesses and split them with two juniors. I pitched to twelve of them myself and offered stall space instead of logos. I also cut the stage budget by renegotiating the sound vendor. We raised ₹2.4 lakh and the fest went ahead on time. I learned to line up a backup sponsor early.';

/* ---------- Pure analysis ---------- */
test('question bank: every competency has 6–10 original questions, cues, probes and a valid frame',()=>{
  assert.equal(B.COMPETENCIES.length,9);const ids=new Set();
  for(const c of B.COMPETENCIES){assert(c.questions.length>=6&&c.questions.length<=10,c.id);assert(c.listenFor.length>=4,c.id);assert(c.probes.length>=2,c.id);assert(B.FRAMES[c.frame],c.id);
    assert(c.target[0]<c.target[1]);for(const x of c.questions){assert(!ids.has(x.id),'unique id '+x.id);ids.add(x.id);assert.deepEqual(B.findQuestion(x.id).text,x.text)}}
  assert.deepEqual(B.STORY_IDS,['leadership','teamwork','conflict','failure','pressure','initiative','ethics']);
  for(let i=0;i<50;i++)assert.equal(B.pickQuestion('conflict').competency,'conflict');
  const all=B.competency('initiative').questions.map(x=>x.id);assert.equal(B.pickQuestion('initiative',all.slice(1)).id,all[0],'avoids recent questions while any are left');
  assert.equal(B.pickQuestion('initiative',all,()=>0).id,all[0],'falls back to the full pool');
  const seen=new Set();for(let i=0;i<300;i++)seen.add(B.pickQuestion('mixed').competency);assert.equal(seen.size,9,'mixed covers every competency');
});

test('word count, speaking time and filler words',()=>{
  assert.equal(B.wordCount("I didn't  know — it's ₹40 crore."),6);assert.equal(B.wordCount(''),0);assert.equal(B.estSeconds(140),60);
  const f=B.fillers('Um, so I was like, basically the lead. You know, I kind of took charge. Uh, I mean it was actually fine. Umm.');
  assert.deepEqual(f.counts,{um:2,like:1,basically:1,'you know':1,'kind of':1,uh:1,'i mean':1,actually:1});assert.equal(f.total,9);assert.equal(f.per100,Math.round(9/B.wordCount('Um, so I was like, basically the lead. You know, I kind of took charge. Uh, I mean it was actually fine. Umm.')*1000)/10);
  // Legitimate uses are not fillers.
  assert.equal(B.fillers('I like cricket and would like to play. It felt like a test. What kind of role is this sort of job? Do you know him? You know how it works. What I mean to say').total,0);
  assert.equal(B.fillers('').per100,0);
});

test('I versus we, numbers, outcomes and lessons',()=>{
  assert.deepEqual(B.pronouns('I led. We won. Our team, my idea, I’m happy, us.'),{i:3,we:3,iShare:50});
  assert.equal(B.pronouns('The fest happened.').iShare,null);
  assert(B.hasNumber('raised ₹2 lakh')&&B.hasNumber('cut it by half')&&B.hasNumber('three weeks early')&&!B.hasNumber('it went well'));
  assert(B.hasOutcome('the fest went ahead on time')&&!B.hasOutcome('the weather was nice'));
  assert(B.hasLesson('Since then I always plan a backup')&&!B.hasLesson('It was fine'));
  const a=B.analyse('We did it. We met. We planned. I helped.',{competency:'leadership'});assert.equal(a.pronouns.level,'warn');
  const t=B.analyse('I '.repeat(10)+'did the work.',{competency:'teamwork'});assert.match(t.pronouns.text,/worked with others/);
});

test('segments split on sentences, and long unpunctuated dictation is chunked at linking words',()=>{
  assert.deepEqual(B.segments('First one. Second one!\nThird one? '),['First one.','Second one!','Third one?']);
  const dictated='I was the coordinator of the fest and we had about two weeks left and the sponsor pulled out and nobody knew what to do so I called a meeting with the core team and we split the list of local businesses between us and I personally pitched to twelve of them and finally three agreed and we raised two lakh rupees';
  const segs=B.segments(dictated);assert(segs.length>=3);assert.equal(segs.join(' '),dictated,'no words lost');assert(segs.every(s=>B.wordCount(s)<=35));assert(segs[1].startsWith('so '),'breaks before a linking word');
});

test('STAR shares and checks: missing parts, long set-up, Action largest, Result with a number, lesson for failure',()=>{
  const empty=B.structure({},'star');assert.equal(empty.tagged,false);assert.equal(empty.checks.length,0);
  const good=B.structure({s:'At my internship the weekly report took two days.',t:'I was asked to speed it up.',a:'I mapped every step, wrote a script to merge the sheets, tested it with my manager for two weeks and trained the team to use it and handle errors.',r:'Report time fell from two days to three hours.'},'star');
  assert.equal(good.parts.reduce((t,p)=>t+p.share,0)>=99,true);assert(good.checks.some(c=>c.level==='ok'&&/Action is the largest/.test(c.text)));assert(good.checks.some(c=>/includes a number/.test(c.text)));assert(!good.checks.some(c=>c.level==='missing'));
  const bad=B.structure({s:'Long background. '.repeat(20),a:'I fixed it.',r:'It went well.'},'star');
  assert(bad.checks.some(c=>c.level==='missing'&&/No Task/.test(c.text)));assert(bad.checks.some(c=>/Situation and Task take/.test(c.text)));assert(bad.checks.some(c=>/not the largest/.test(c.text)));assert(bad.checks.some(c=>/does not state a clear outcome|put a number/.test(c.text)));
  const fail=B.structure({s:'s',t:'t',a:'I did a lot of things to fix the mistake quickly.',r:'It was fixed in two days.'},'star',{competency:'failure'});assert(fail.checks.some(c=>/what you learned/.test(c.text)));
  const learned=B.structure({s:'s',t:'t',a:'I did a lot of things to fix it quickly.',r:'Fixed in two days. I learned to check early.'},'star',{competency:'failure'});assert(learned.checks.some(c=>c.level==='ok'&&/learned/.test(c.text)));
  // Tagging by segment text, untagged share and the Present–Past–Future ending check.
  const text='I study economics at Loyola. I ran the finance club. I interned at a bank. Now I want to work in strategy.';const segs=B.segments(text);
  const ppf=B.tagged(text,{[segs[0]]:'present',[segs[1]]:'past',[segs[3]]:'future',ignored:'nope'},'ppf','intro');
  assert.equal(ppf.untagged,B.wordCount(segs[2]));assert(ppf.checks.some(c=>/finish on where you are heading/.test(c.text)));
  assert(B.tagged(text,{[segs[0]]:'future',[segs[1]]:'past'},'ppf','intro').checks.some(c=>/End with the Future/.test(c.text)));
  assert.equal(B.tagged(text,{[segs[0]]:'s'},'ppf','intro').tagged,false,'tags from another frame are ignored');
});

test('analyse: time against target, pace only when dictated, and story coverage gaps',()=>{
  const words='word '.repeat(280);const a=B.analyse(words,{competency:'leadership',seconds:120,voice:true});
  assert.equal(a.words,280);assert.equal(a.estSeconds,120);assert.equal(a.pace.wpm,140);assert.equal(a.pace.level,'ok');assert.equal(a.time.level,'ok');
  assert.equal(B.analyse(words,{competency:'leadership',seconds:120,voice:false}).pace,null,'typed answers have no pace');
  assert.equal(B.analyse('word '.repeat(40),{competency:'leadership'}).time.level,'warn');assert.match(B.analyse('word '.repeat(600),{competency:'motivation'}).time.text,/long/);
  const cov=B.coverage([{tags:['failure','conflict']},{tags:['failure']},{tags:'bad'}]);
  assert.equal(cov.find(c=>c.id==='failure').count,2);assert.equal(cov.find(c=>c.id==='conflict').count,1);assert.deepEqual(cov.filter(c=>!c.count).map(c=>c.id),['leadership','teamwork','pressure','initiative','ethics']);
  assert.equal(B.storyStructure({s:'a',t:'b',a:'c d e',r:'won 2'}).tagged,true);
});

/* ---------- In the page ---------- */
test('a full attempt: pick a competency, hear the question, answer, tag STAR, self-review, download and delete',()=>{const f=fixture();try{
  f.$('behaviouralNav').click();assert.equal(f.w.location.hash,'#behavioural');assert.equal(f.run('view'),'behavioural');assert(text(f).includes('heuristics, not a score'));
  q(f,'input[name=bhMode][value=failure]').click();q(f,'input[name=bhMode][value=failure]').dispatchEvent(new f.w.Event('change'));f.$('bhAloud').click();f.$('bhAloud').dispatchEvent(new f.w.Event('change'));
  f.$('bhStart').click();const d=f.run('Behavioural.state().draft');assert.equal(d.competency,'failure');assert.equal(d.mode,'failure');
  assert.equal(f.$('bhPrompt').textContent,B.findQuestion(d.qid).text);assert.deepEqual(f.w.__spoken,[B.findQuestion(d.qid).text],'read aloud automatically');
  f.$('speak').click();assert.equal(f.w.__spoken.length,2,'read-aloud button reuses speak()');
  assert.equal(f.$('bhTimerBtn').textContent,'Start timer');assert(f.$('bhMic').disabled,'no recogniser in this browser');assert.match(f.$('bhVoiceStatus').textContent,/unavailable/);
  f.$('bhFinish').click();assert.equal(f.run('Behavioural.state().screen'),'question','empty answers are not saved');
  input(f,f.$('bhAnswer'),STORY_ANSWER);assert(f.run('Behavioural.state().draft.runningSince'),'typing starts the timer');assert.equal(f.$('bhTimerBtn').textContent,'Pause timer');
  f.$('bhFinish').click();const st=f.run('Behavioural.state()');assert.equal(st.screen,'feedback');assert.equal(st.draft,null);assert.equal(st.attempts.length,1);
  const t=text(f);assert(!GAP.test(t),t.match(/.{30}(undefined|\bnull\b|NaN|\[object).{20}/)?.[0]);assert(t.includes('Heuristics, not a score'));assert(t.includes(String(B.wordCount(STORY_ANSWER))));assert(t.includes('Tag at least one sentence'));
  // Tag sentences as S, T, A, A, A, R, R.
  const plan=['s','s','t','a','a','a','r','r'];assert.equal(f.w.document.querySelectorAll('.bh-segs li').length,plan.length);
  plan.forEach((p,i)=>q(f,`[data-seg="${i}"][data-part="${p}"]`).click());
  assert.equal(q(f,'[data-seg="3"][data-part="a"]').getAttribute('aria-pressed'),'true');
  const s=f.$('bhStructure').textContent;assert(s.includes('Action is the largest part'),s);assert(s.includes('includes a number'));assert(s.includes('You say what you learned'));
  q(f,'[data-seg="7"][data-part="r"]').click();assert(f.$('bhStructure').textContent.includes('say what you learned and what you do differently'),'untagging updates the checks');q(f,'[data-seg="7"][data-part="r"]').click();
  const a=f.run('Behavioural.state().attempts[0]');assert.equal(Object.keys(a.tags).length,8);
  q(f,'[data-bh-heard="1"]').click();input(f,f.$('bhNotes'),'Shorter set-up.');
  // Editing the transcript keeps tags on unchanged sentences.
  input(f,f.$('bhEdit'),STORY_ANSWER.replace('Two weeks before, the main sponsor pulled out.','The sponsor left.'));assert.equal(Object.keys(f.run('Behavioural.state().attempts[0].tags')).length,7);
  const saved=JSON.parse(f.w.localStorage.getItem('cr-behavioural-attempts'))[0];assert.deepEqual(saved.heard,[1]);assert.equal(saved.notes,'Shorter set-up.');assert(saved.seconds===null||saved.seconds>=0);
  let file;f.w.HTMLAnchorElement.prototype.click=function(){file=this.download};f.$('bhDownload').click();assert.match(file,/^case-room-behavioural-failure-\d{4}-\d\d-\d\d\.txt$/);
  const exported=f.run('Behavioural.state().attempts[0]');
  // History on the behavioural home, grouped by competency.
  f.$('bhBack').click();assert.equal(f.w.location.hash,'#behavioural');const row=[...f.w.document.querySelectorAll('.bh-table tbody tr')].find(r=>r.textContent.startsWith('Failure'));assert.equal(row.children[1].textContent,'1');assert.equal(row.children[4].textContent,'1/1','STAR complete');
  assert(q(f,'[data-bh-comp="failure"]'));q(f,'[data-bh-download="failure"]').click();assert.equal(file,'case-room-behavioural-failure.txt');f.$('bhDownloadAll').click();assert.equal(file,'case-room-behavioural-answers.txt');
  q(f,`[data-bh-view="${exported.id}"]`).click();assert.equal(f.run('Behavioural.state().screen'),'feedback');f.$('bhNext').click();assert.equal(f.run('Behavioural.state().draft.competency'),'failure','next question keeps the competency');
  f.$('bhExit').click();q(f,`[data-bh-delete="${exported.id}"]`).click();assert.equal(f.run('Behavioural.state().attempts.length'),0);assert.equal(JSON.parse(f.w.localStorage.getItem('cr-behavioural-attempts')).length,0);
  assert.deepEqual(f.errors,[]);
}finally{f.dom.window.close()}});

test('dictation fills the answer through the shared helper, and case dictation still works',()=>{const f=fixture();try{
  const sr=fakeRecognition(f);f.run("Behavioural.ask('teamwork')");f.$('bhLanguage').value='en-GB';f.$('bhMic').click();
  assert.equal(sr.made[0].lang,'en-GB');assert.equal(f.$('bhMic').textContent,'■ Stop dictation');assert(f.$('bhAnswer').readOnly);assert(f.run('Behavioural.state().draft.runningSince'),'dictating starts the timer');
  sr.say('I organised the team');assert.equal(f.$('bhAnswer').value,'I organised the team');const d=f.run('Behavioural.state().draft');assert.equal(d.text,'I organised the team');assert.equal(d.voice,true);
  f.$('bhMic').click();assert(sr.made[0].aborted);assert.equal(f.$('bhMic').textContent,'◉ Dictate answer');assert.equal(f.$('bhAnswer').readOnly,false);assert.match(f.$('bhVoiceStatus').textContent,/Stopped/);
  f.$('bhFinish').click();assert.equal(f.run('Behavioural.state().attempts[0].voice'),true);
  // The case session uses the same helper.
  f.run("start('cement')");f.$('mic').click();sr.say('Profit fell');assert.equal(f.run('session.answers.structure'),'Profit fell');f.$('speak').click();assert.equal(f.$('mic').textContent,'◉ Dictate answer','reading aloud stops dictation');
  assert.deepEqual(f.errors,[]);
}finally{f.dom.window.close()}});

test('story bank: write stories, coverage gaps, link practice answers, export and import',()=>{const f=fixture();try{
  f.run('Behavioural.open()');assert(text(f).includes('You have not written any yet'));assert.equal(f.w.document.querySelectorAll('.bh-gaps span').length,7);
  f.$('bhStories').click();assert.equal(f.w.location.hash,'#behavioural-stories');assert.equal(f.w.document.querySelectorAll('.bh-coverage .gap').length,7);assert(text(f).includes('No failure story yet'));
  f.$('bhNewStory').click();assert.equal(f.run('Behavioural.state().screen'),'story');
  input(f,f.$('bhTitle'),'Fest sponsor pulled out');input(f,f.$('bhStory-s'),'College fest, two weeks out, sponsor left.');input(f,f.$('bhStory-t'),'Close a ₹2 lakh gap.');
  input(f,f.$('bhStory-a'),'I listed forty businesses, split them with two juniors, pitched twelve myself and renegotiated the sound vendor.');input(f,f.$('bhStory-r'),'Raised ₹2.4 lakh; fest ran on time.');
  for(const t of ['leadership','pressure']){const el=q(f,`[data-story-tag="${t}"]`);el.checked=true;el.dispatchEvent(new f.w.Event('change'))}
  assert(f.$('bhStoryCheck').textContent.includes('Action is the largest'));f.$('bhStoryDone').click();
  assert.equal(f.w.document.querySelectorAll('.bh-coverage .gap').length,5);assert(text(f).includes('No failure story yet')&&!text(f).includes('No leadership story yet'));
  // An abandoned empty story is dropped.
  f.$('bhNewStory').click();f.$('bhStoryDone').click();assert.equal(f.run('Behavioural.state().stories.length'),1);
  // Practise with the story: the answer is linked to it.
  q(f,'[data-story-practise]').click();const d={...f.run('Behavioural.state().draft')};assert(['leadership','pressure'].includes(d.competency));assert.equal(f.$('bhStory').value,d.storyId);assert(q(f,'.bh-linked'));
  f.$('bhStory').value='';f.$('bhStory').dispatchEvent(new f.w.Event('change'));assert.equal(q(f,'.bh-linked'),null);f.$('bhStory').value=d.storyId;f.$('bhStory').dispatchEvent(new f.w.Event('change'));
  input(f,f.$('bhAnswer'),'I listed forty businesses and we raised the money.');f.$('bhFinish').click();assert(text(f).includes('Compare with your story notes'));
  f.run('Behavioural.stories()');assert(text(f).includes('Practised 1×'));
  // Export, then import into a fresh browser.
  let out;f.w.HTMLAnchorElement.prototype.click=function(){out=this.download};f.$('bhExport').click();assert.equal(out,'case-room-story-bank.json');
  const exported=f.run('JSON.stringify({kind:"case-room-behavioural-stories",version:1,stories:Behavioural.state().stories})');
  const g=fixture({url:'https://case.example/#behavioural-stories'});try{
    assert.throws(()=>g.run('Behavioural.importStories("not json")'),/not valid JSON/);assert.throws(()=>g.run('Behavioural.importStories(\'{"a":1}\')'),/not a Case Room story bank/);
    assert.deepEqual(JSON.parse(JSON.stringify(g.run(`Behavioural.importStories(${JSON.stringify(exported)})`))),{added:1,updated:0,skipped:0});
    assert.deepEqual(JSON.parse(JSON.stringify(g.run(`Behavioural.importStories(${JSON.stringify(exported)})`))),{added:0,updated:1,skipped:0},'same id replaces');
    g.run(`Behavioural.importStories(${JSON.stringify(JSON.stringify([{id:'x<script>',title:'<b>Bad</b>',a:'did it',tags:['failure','nope'],s:5}]))})`);const st=g.run('Behavioural.state().stories');
    assert.equal(st.length,2);assert.deepEqual([...st[1].tags],['failure']);assert.equal(st[1].s,'');assert.notEqual(st[1].id,'x<script>');
    g.run('Behavioural.stories()');assert(!g.w.document.querySelector('#app b')?.textContent.includes('<'));assert(g.w.document.querySelector('.bh-story h3').textContent.length);assert(g.w.document.querySelector('#app').textContent.includes('<b>Bad</b>'),'titles are escaped');
    assert.deepEqual(g.errors,[]);
  }finally{g.dom.window.close()}
  q(f,'[data-story-delete]').click();assert.equal(f.run('Behavioural.state().stories.length'),0);assert.equal(f.run('Behavioural.state().attempts.length'),1,'linked answers are kept');
  assert.deepEqual(f.errors,[]);
}finally{f.dom.window.close()}});

test('printable sheets for practising with a friend',()=>{const f=fixture();try{
  f.run('Behavioural.open()');f.$('bhSheetPick').value='conflict';f.$('bhSheetOpen').click();assert.equal(f.w.location.hash,'#behavioural-sheet/conflict');
  const c=B.competency('conflict'),t=text(f);assert(!GAP.test(t));for(const x of c.questions)assert(t.includes(x.text));for(const x of c.listenFor)assert(t.includes(x));assert(t.includes('Structure ☐1'));assert.equal(f.w.document.querySelectorAll('.peer-sheet-stage').length,2);
  f.$('bhSheetSwitch').value='all';f.$('bhSheetSwitch').dispatchEvent(new f.w.Event('change'));assert.equal(f.w.location.hash,'#behavioural-sheet/all');assert.equal(f.w.document.querySelectorAll('.peer-sheet-stage').length,10);
  const g=fixture({url:'https://case.example/#behavioural-sheet/nope'});try{assert.equal(g.w.location.hash,'#behavioural-sheet/all');assert.equal(g.w.document.querySelectorAll('.peer-sheet-stage').length,10);assert.deepEqual(g.errors,[])}finally{g.dom.window.close()}
  assert.deepEqual(f.errors,[]);
}finally{f.dom.window.close()}});

test('an unfinished answer resumes after reload with its time; corrupt storage is ignored',()=>{const f=fixture();let g,h;try{
  f.run("Behavioural.ask('ethics')");input(f,f.$('bhAnswer'),'I told my professor.');const qid=f.run('Behavioural.state().draft.qid');
  // Pretend the timer has been running for 40 seconds and the page then closed.
  f.run('(()=>{const d=Behavioural.state().draft;d.runningSince=Date.now()-40000;d.at=Date.now();localStorage.setItem("cr-behavioural-draft",JSON.stringify(d))})()');
  g=fixture({url:'https://case.example/#behavioural',storage:storageOf(f)});assert(g.$('bhResume'));assert(g.w.document.querySelector('.bh-resume').textContent.includes('0:40'));
  g.$('bhResume').click();assert.equal(g.$('bhAnswer').value,'I told my professor.');assert.equal(g.run('Behavioural.state().draft.qid'),qid);assert.equal(g.run('Behavioural.state().draft.runningSince'),null,'paused until they carry on');assert.match(g.$('bhTimerText').textContent,/^0:40/);
  g.$('bhExit').click();g.$('bhDiscard').click();assert.equal(g.run('Behavioural.state().draft'),null);assert.equal(g.w.localStorage.getItem('cr-behavioural-draft'),'null');
  h=fixture({url:'https://case.example/#behavioural',storage:{'cr-behavioural-attempts':'[{"competency":"nope","text":"x","at":1},{"competency":"conflict","text":5,"at":2},"bad",{"competency":"conflict","text":"ok","at":3,"tags":{"ok":"zz"},"heard":[99,1]}]','cr-behavioural-stories':'{"not":"a list"}','cr-behavioural-draft':'{"qid":"conflict-99"}','cr-behavioural-prefs':'"oops"'}});
  const st=h.run('Behavioural.state()');assert.equal(st.attempts.length,1);assert.deepEqual({...st.attempts[0].tags},{});assert.deepEqual([...st.attempts[0].heard],[1]);assert.equal(st.stories.length,0);assert.equal(st.draft,null);assert.equal(st.prefs.mode,'mixed');
  assert.equal(h.$('bhResume'),null);assert(!GAP.test(h.w.document.querySelector('#app').textContent));
  const k=fixture({storage:{'cr-behavioural-attempts':'{bad json','cr-behavioural-draft':'[]'}});try{assert.equal(k.run('Behavioural.state().attempts.length'),0);k.run('Behavioural.open()');assert.deepEqual(k.errors,[])}finally{k.dom.window.close()}
  assert.deepEqual([...f.errors,...g.errors,...h.errors],[]);
}finally{f.dom.window.close();g?.dom.window.close();h?.dom.window.close()}});

test('does not interfere with case sessions, the maths drill or peer interviews',()=>{const f=fixture();try{
  f.run("start('cement')");input(f,f.$('answer'),'Case answer');f.run("CaseDrill.open()");f.$('drillStart').click();f.run("PeerMock.start('market')");
  const before={session:f.run('JSON.stringify(session)'),drill:f.run('JSON.stringify(CaseDrill.state().run)'),peer:f.run('JSON.stringify(PeerMock.state().run)')};
  f.$('behaviouralNav').click();f.$('bhStart').click();input(f,f.$('bhAnswer'),'I did it and we won by 10%.');f.$('bhFinish').click();
  f.run('Behavioural.stories()');f.$('bhNewStory').click();input(f,f.$('bhTitle'),'Story');f.run("Behavioural.sheet('all')");
  assert.equal(f.run('JSON.stringify(session)'),before.session);assert.equal(f.run('JSON.stringify(CaseDrill.state().run)'),before.drill);assert.equal(f.run('JSON.stringify(PeerMock.state().run)'),before.peer);
  assert.equal(f.run('history.length'),0,'behavioural answers are not case sessions');assert.equal(f.run('CaseDrill.state().runs.length'),0);assert.equal(f.run('PeerMock.state().past.length'),0);
  const mine=Object.keys(f.w.localStorage).filter(k=>k.startsWith('cr-behavioural-')).sort();assert.deepEqual(mine,['cr-behavioural-attempts','cr-behavioural-draft','cr-behavioural-prefs','cr-behavioural-stories']);
  // Home shows every tool, and leaving the behavioural route clears its hash.
  f.$('homeNav').click();assert.equal(f.w.location.hash,'');assert(f.$('drillCallout')&&f.$('peerCallout')&&f.$('behaviouralCallout'));assert.equal(f.w.document.querySelectorAll('.tool-callouts .tool-callout').length,5);
  f.$('behaviouralCallout').click();assert.equal(f.run('view'),'behavioural');f.$('drillNav').click();assert.equal(f.w.location.hash,'#drill');f.$('peerNav').click();assert.equal(f.w.location.hash,'#peer');
  f.$('privacy').click();assert(f.$('modalContent').textContent.includes('Behavioural practice'));
  assert.deepEqual(f.errors,[]);
}finally{f.dom.window.close()}});
