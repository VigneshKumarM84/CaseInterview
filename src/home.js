/* The home page and the Case interview page.
   The home page is short and starts from what the student wants to do: plan for the next round, continue
   something unfinished, or open one round. Each round tile leads straight to that round's page.
   The case library (12 full cases) now lives on its own Case interview page, with the warm-up, maths drill
   and peer interview in front of it.
   Loaded after every tool and before ai-client.js, which wraps home() and casesPage() to cancel AI requests.

   How it hooks in: each tool wraps home() to tidy up when the student leaves it (pause timers, clear its #hash).
   That chain ends in cases.js, which draws the case library. leaveTool() below runs that whole chain, so the
   tidy-up always happens, and then home() or casesPage() draws its own page. */
(() => {
  const leaveTool = home;
  function setHash(h) { try { window.history.replaceState(null, '', location.pathname + location.search + (h || '')); } catch { /* file:// or sandboxed frames */ } }

  /* ---------- The rounds, in the order a campus process usually runs ---------- */
  const ROUNDS = [
    { id: 'resume', n: 1, title: 'Résumé shortlisting', text: 'Check every bullet and see which job-description keywords you are missing.', open: () => ResumeTool.open() },
    { id: 'aptitude', n: 2, title: 'Online aptitude test', text: 'Quant, logical and verbal practice with worked solutions, and timed mock tests.', open: () => Aptitude.open() },
    { id: 'gd', n: 3, title: 'Group discussion', text: 'The moves observers note, and practice that builds them. Full GD practice is not here yet.', tag: 'Tips only', open: () => NextRoundTool.open('gd') },
    { id: 'case', n: 4, title: 'Case or guesstimate interview', text: 'A 10-minute warm-up, 12 full cases, case maths and a mock interview with a friend.', open: () => casesPage() },
    { id: 'hr', n: 5, title: 'HR interview', text: 'Timed answers to the common questions, and a bank of stories to draw on.', open: () => Behavioural.open() }
  ];

  /* ---------- Unfinished work, from each tool's saved state ---------- */
  function unfinished() {
    const out = [];
    if (session) { const c = CASES.find(x => x.id === session.id); if (c) out.push({ id: 'case', label: 'Case', title: c.title, detail: `Stage ${session.step + 1} of ${session.version === 3 ? 8 : 4}`, go: () => renderSession() }); }
    const w = WarmupTool.state().run;
    if (w && w.step < 4 && (w.step > 0 || Object.keys(w.revealed).length || Object.values(w.answers).some(a => a.trim()))) out.push({ id: 'warmup', label: 'Warm-up', title: 'More tickets, less money', detail: `Step ${w.step + 1} of 4`, go: () => WarmupTool.resume() });
    const a = Aptitude.state().run;
    if (a) out.push({ id: 'aptitude', label: 'Aptitude', title: a.mode === 'test' ? 'Timed mock test' : 'Practice set', detail: `Question ${a.index + 1} of ${a.questions.length}`, go: () => Aptitude.open() });
    const d = CaseDrill.state().run;
    if (d) out.push({ id: 'drill', label: 'Maths drill', title: 'Case maths round', detail: `Question ${d.index + 1} of ${d.questions.length}`, go: () => CaseDrill.open() });
    const b = Behavioural.state().draft;
    if (b && b.text && b.text.trim()) out.push({ id: 'behavioural', label: 'HR interview', title: 'An answer you started', detail: 'Not submitted yet', go: () => Behavioural.open() });
    const p = PeerMock.state().run;
    if (p) out.push({ id: 'peer', label: 'Peer interview', title: 'Mock interview with a friend', detail: 'In progress', go: () => PeerMock.open() });
    const plan = NextRoundTool.state();
    if (plan.round && plan.items.length) {
      const r = NextRound.ROUNDS.find(x => x.id === plan.round);
      out.push({ id: 'plan', label: 'Your plan', title: r.id === 'unknown' ? 'Next round not known yet' : r.title, detail: `${plan.done.length} of ${plan.items.length} done`, go: () => NextRoundTool.open() });
    }
    return out;
  }

  /* ---------- Home ---------- */
  home = function () {
    leaveTool(); view = 'home'; setHash(''); window.scrollTo(0, 0);
    const todo = unfinished();
    $('#app').innerHTML = `<section class="home-hero">
        <div><div class="eyebrow">CAMPUS PLACEMENT PRACTICE</div>
          <h1>Get ready for your <em>next round.</em></h1>
          <p class="lead">Practise each round of a campus placement, from résumé shortlisting to the HR interview. Free, works offline, nothing to sign up for.</p>
          <div class="actions"><button class="primary" id="homePlan">Plan my prep →</button></div>
          <p class="note">Tell us your next round and how long you have. You get a short plan to start right away.</p></div>
        ${todo.length ? `<section class="home-continue" aria-labelledby="homeContinueTitle"><h2 id="homeContinueTitle">Continue where you left off</h2><ul>${todo.map(t => `<li><button class="home-continue-item" data-continue="${t.id}"><span class="eyebrow">${esc(t.label)}</span><b>${esc(t.title)}</b><span class="note">${esc(t.detail)}</span><span class="home-go" aria-hidden="true">→</span></button></li>`).join('')}</ul></section>`
          : `<section class="home-how" aria-label="How it works"><ol><li><b>Tell us your next round</b><span>From your placement notice, or “I don’t know yet”.</span></li><li><b>Practise what is here</b><span>Short sets, timed tests, cases and HR questions.</span></li><li><b>See what to fix</b><span>Worked answers and examples after every attempt.</span></li></ol></section>`}
      </section>
      <section class="home-rounds" aria-labelledby="homeRoundsTitle">
        <div class="row"><div><div class="eyebrow">OR GO STRAIGHT TO A ROUND</div><h2 class="section-title" id="homeRoundsTitle">The rounds, in the order they usually come</h2></div></div>
        <ol class="round-tiles">${ROUNDS.map(r => `<li><button class="round-tile" data-round="${r.id}" id="round-${r.id}"><span class="round-n" aria-hidden="true">${r.n}</span><b>${esc(r.title)}</b>${r.tag ? `<span class="round-tag">${esc(r.tag)}</span>` : ''}<span class="note">${esc(r.text)}</span><span class="home-go" aria-hidden="true">→</span></button></li>`).join('')}</ol>
        <p class="note home-technical">Technical or coding round? Case Room does not cover it. <button class="wu-link" id="homeTechnical">See what you can still practise here</button></p>
      </section>
      <p class="home-foot note">Free · works offline · your answers stay in this browser · optional AI feedback with your own key</p>`;
    $('#homePlan').onclick = () => NextRoundTool.open();
    $('#homeTechnical').onclick = () => NextRoundTool.open('technical');
    document.querySelectorAll('[data-round]').forEach(b => b.onclick = () => ROUNDS.find(r => r.id === b.dataset.round).open());
    document.querySelectorAll('[data-continue]').forEach(b => b.onclick = () => todo.find(t => t.id === b.dataset.continue).go());
  };

  /* ---------- Case interview page: the library, with the shorter practice in front ---------- */
  window.casesPage = function () {
    leaveTool(); view = 'cases'; setHash('#cases'); window.scrollTo(0, 0);
    const box = $('#caseTools'); if (!box) return;
    // The warm-up goes first only for someone who has neither finished nor skipped it.
    const seen = WarmupTool.state().seen, fresh = !seen;
    const tools = [
      { id: 'warmup', eyebrow: fresh ? 'NEW TO CASES? START HERE · 10 MIN' : 'WARM-UP · 10 MIN', title: 'Guided warm-up', text: 'One question, one number, one calculation and a 30-second recommendation, with an example after each.', label: seen === 'done' ? 'Redo the warm-up' : 'Start the warm-up →', go: () => WarmupTool.open() },
      { id: 'drill', eyebrow: 'CASE MATHS · 5–10 MIN', title: 'Maths drill', text: 'Percentages, margins, break-evens, growth and estimates, with the working after every answer.', label: 'Start a maths drill →', go: () => CaseDrill.open() },
      { id: 'peer', eyebrow: 'WITH A FRIEND · 45 MIN', title: 'Peer interview', text: 'One of you interviews from a guide with answers and scoring cues; the other answers out loud.', label: 'Set up a peer interview →', go: () => PeerMock.open() }
    ];
    box.innerHTML = tools.map((t, i) => `<div class="case-tool${i === 0 && fresh ? ' first' : ''}"><div class="eyebrow">${t.eyebrow}</div><h3>${t.title}</h3><p class="note">${t.text}</p><button class="${i === 0 && fresh ? 'primary' : ''}" id="caseTool-${t.id}">${t.label}</button></div>`).join('');
    tools.forEach(t => { $('#caseTool-' + t.id).onclick = t.go; });
  };

  /* ---------- Navigation: in round order, with the current page marked ---------- */
  const NAV = { homeNav: ['home'], planNav: ['next-round'], resumeNav: ['resume'], aptitudeNav: ['aptitude'], casesNav: ['cases', 'session', 'report', 'warmup', 'drill', 'peer'], behaviouralNav: ['behavioural'], historyNav: ['history'] };
  function markNav() { for (const [id, views] of Object.entries(NAV)) { const b = document.getElementById(id); if (b) { if (views.includes(view)) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); } } }
  $('#planNav').onclick = () => NextRoundTool.open();
  $('#casesNav').onclick = () => casesPage();
  new MutationObserver(markNav).observe($('#app'), { childList: true });

  window.HomePage = { rounds: ROUNDS, unfinished };
})();
