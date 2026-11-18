const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./dom.cjs');

const text=f=>f.w.document.querySelector('#app').textContent;
const input=(f,el,v)=>{el.value=v;el.dispatchEvent(new f.w.Event('input'))};
const storageOf=f=>{const s={};for(const k of Object.keys(f.w.localStorage))s[k]=f.w.localStorage.getItem(k);return s};

test('every case and path renders a complete interviewer guide and printable sheet',()=>{const f=fixture();try{
  for(const c of f.run('CASES')){const branches=f.run(`RICH['${c.id}'].branches.map(b=>b.id)`);
    for(const b of branches){f.run(`PeerMock.start('${c.id}')`);
      for(let step=0;step<8;step++){f.run(`PeerMock.state().run.step=${step};PeerMock.state().run.branch=${step>=4?`'${b}'`:'null'}`);f.$('peerNext');f.w.document.querySelector(`[data-peer-stage="${step}"]`).click();
        const t=text(f);assert(!/undefined|\bnull\b|NaN|\[object/.test(t),`${c.id}/${b} stage ${step+1} has a gap: ${t.match(/.{40}(undefined|\bnull\b|NaN|\[object).{20}/)?.[0]}`);
        assert(f.w.document.querySelectorAll('.peer-cues li').length>=2,'listening cues shown');
        if([2,4,5].includes(step))assert(f.$('peerNumber'),`${c.id} stage ${step+1} has an answer key`)}}
    f.run(`PeerMock.sheet('${c.id}')`);const t=text(f);assert(!/undefined|\bnull\b|NaN|\[object/.test(t),c.id+' sheet');
    assert(f.w.document.querySelector('.peer-handout').textContent.includes(c.brief),'handout has the brief');
    assert(!f.w.document.querySelector('.peer-handout').textContent.includes(c.calc.working),'handout has no answers');
    for(const b of f.run(`RICH['${c.id}'].branches`))assert(t.includes(b.stressCalc.working),'sheet covers both paths');assert.equal(f.w.location.hash,'#peer-sheet/'+c.id)}
  f.run('localStorage.clear()');assert.deepEqual(f.errors,[]);
}finally{f.dom.window.close()}});

test('a full peer interview: share, check numbers, score, wrap up and get feedback',()=>{const f=fixture();try{
  f.$('casesNav').click();f.$('caseTool-peer').click();assert.equal(f.w.location.hash,'#peer');f.w.document.querySelector('[data-peer-start="cement"]').click();
  assert(text(f).includes('Keep this screen away from the candidate'));
  // Sharing without a candidate window shows the item on this screen and records it for the candidate screen.
  f.w.document.querySelector('[data-share="clar:0"]').click();assert(f.$('modal').open);assert(f.$('modalContent').textContent.includes('Recover the ₹40 crore'));f.$('closeModal').click();
  assert.deepEqual([...f.run('PeerMock.state().run.clarified')],[0]);assert(f.w.document.querySelector('[data-share="clar:0"]').textContent.includes('Shared'));
  f.w.document.querySelector('input[name=peerRating][value=strong]').click();input(f,f.$('peerNote'),'Asked what success means first.');
  assert(f.w.document.querySelector('[data-peer-stage="0"] .dot').classList.contains('strong'));
  f.$('peerNext').click();f.w.document.querySelector('[data-share="ex:economics"]').click();f.$('closeModal').click();assert.deepEqual([...f.run('PeerMock.state().run.opened')],['economics']);
  f.$('peerNext').click();input(f,f.$('peerNumber'),'30');assert(f.$('peerVerdict').textContent.includes('Within'));input(f,f.$('peerNumber'),'3');assert(f.$('peerVerdict').textContent.includes('Outside'));input(f,f.$('peerNumber'),'30');
  f.$('peerNext').click();f.w.document.querySelector('[data-peer-stage="4"]').click();assert(text(f).includes('Record which path'),'deep dive waits for the path');
  f.w.document.querySelector('[data-peer-stage="3"]').click();f.w.document.querySelector('[data-peer-path="fuel"]').click();assert.equal(f.run('PeerMock.state().run.branch'),'fuel');
  f.$('peerNext').click();assert(text(f).includes('₹200 per tonne'));input(f,f.$('peerNumber'),'23');f.$('peerAsked').click();
  f.$('peerNext').click();input(f,f.$('peerNumber'),'99');f.w.document.querySelector('input[name=peerRating][value=work]').click();
  f.$('peerNext').click();f.$('peerNext').click();f.$('peerNext').click();
  assert(f.$('peerFinish'),'wrap-up after the last stage');f.w.document.querySelector('[data-peer-strong="0"]').click();f.w.document.querySelector('[data-peer-trap="1"]').click();
  input(f,f.$('peerKeep'),'Clear structure.');input(f,f.$('peerChange'),'Recheck the arithmetic.');f.$('peerFinish').click();
  const t=text(f);assert(t.includes('Clear structure.')&&t.includes('Recheck the arithmetic.')&&t.includes('Asked what success means first.'));assert(t.includes('2/3'),'two of three numbers within range');
  assert.equal(f.run('PeerMock.state().run'),null);const saved=JSON.parse(f.w.localStorage.getItem('cr-peer-history'));assert.equal(saved.length,1);assert.equal(saved[0].numbers[5],'99');
  assert.equal(JSON.parse(f.w.localStorage.getItem('cr-peer-screen')).finished,true);
  let file;f.w.HTMLAnchorElement.prototype.click=function(){file=this.download};f.$('peerDownload').click();assert.equal(file,'case-room-peer-cement-feedback.txt');
  f.$('peerHome').click();assert(f.w.document.querySelector('[data-peer-report]'));assert.equal(f.run('history.length'),0,'peer interviews are not case sessions');
  f.$('homeNav').click();assert.equal(f.w.location.hash,'');f.$('round-case').click();assert(f.$('caseTool-drill')&&f.$('caseTool-peer'),'the case interview page links to both tools');assert.deepEqual(f.errors,[]);
}finally{f.dom.window.close()}});

test('the candidate screen shows only the brief and shared items, and updates live',()=>{const f=fixture();let g;try{
  f.run("PeerMock.start('investment')");f.w.document.querySelector('[data-peer-stage="2"]').click();f.w.document.querySelector('[data-share="calc:2"]').click();
  g=fixture({url:'https://case.example/#peer-screen',storage:storageOf(f)});
  assert(g.w.document.body.classList.contains('peer-candidate'));const c=f.run("CASES.find(c=>c.id==='investment')");const t=g.w.document.querySelector('#app').textContent;
  assert(t.includes(c.brief)&&t.includes(c.calc.question));assert(!t.includes(c.calc.working),'no answers on the candidate screen');
  f.w.document.querySelector('[data-peer-stage="1"]').click();const ex=c.exhibits[0];f.w.document.querySelector(`[data-share="ex:${ex.id}"]`).click();
  g.w.localStorage.setItem('cr-peer-screen',f.w.localStorage.getItem('cr-peer-screen'));g.w.dispatchEvent(new g.w.StorageEvent('storage',{key:'cr-peer-screen'}));
  assert.equal(g.w.document.querySelector('.peer-cand-item.latest h3').textContent,ex.title);assert(g.w.document.querySelector('#app').textContent.includes('Stage 2 of 8'));
  assert.deepEqual([...f.errors,...g.errors],[]);
}finally{f.dom.window.close();g?.dom.window.close()}});

test('changing the path clears path-specific scores; interviews resume after reload; bad storage is ignored',()=>{const f=fixture();let g,h,k;try{
  f.run("PeerMock.start('market')");f.w.document.querySelector('[data-peer-stage="3"]').click();const [a,b]=f.run("RICH.market.branches.map(b=>b.id)");
  f.w.document.querySelector(`[data-peer-path="${a}"]`).click();f.$('peerNext').click();input(f,f.$('peerNumber'),'5');input(f,f.$('peerNote'),'Deep-dive note');
  f.w.document.querySelector('[data-peer-stage="3"]').click();f.w.document.querySelector(`[data-peer-path="${b}"]`).click();
  const run=f.run('PeerMock.state().run');assert.equal(run.branch,b);assert.equal(run.numbers[4],undefined);assert.equal(run.notes[4],undefined);
  g=fixture({url:'https://case.example/#peer',storage:storageOf(f)});assert(g.$('peerResume'));g.$('peerResume').click();assert.equal(g.run('PeerMock.state().run.step'),3);assert(g.w.document.querySelector(`[data-peer-path="${b}"]`).textContent.includes('Their choice'));
  h=fixture({url:'https://case.example/#peer',storage:{'cr-peer-run':'{"caseId":"nope","step":2}','cr-peer-history':'"oops"','cr-peer-screen':'[1]'}});assert.equal(h.$('peerResume'),null);assert.equal(h.run('PeerMock.state().past.length'),0);
  k=fixture({url:'https://case.example/#peer-sheet/unknown'});assert(k.w.document.querySelector('[data-peer-start]'),'unknown sheet falls back to the peer home');
  assert.deepEqual([...f.errors,...g.errors,...h.errors,...k.errors],[]);
}finally{f.dom.window.close();g?.dom.window.close();h?.dom.window.close();k?.dom.window.close()}});
