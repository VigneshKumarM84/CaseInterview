/* Guided warm-up: a 7–10 minute campus case for first-time visitors, in four small steps. After each answer the
   student sees an example and why it helps. Nothing is scored except the arithmetic. Offline, no AI.
   Uses core.js helpers, stopMedia()/view/home/start from cases.js and Warmup (content/warmup.js). */
(() => {
  const { WARMUP: W, judge } = Warmup, STEPS = W.steps;
  const RUN_KEY = 'cr-warmup-run', SEEN_KEY = 'cr-warmup-seen', MAX_TEXT = 4000;

  /* ---------- State: the run in progress, and whether this visitor has finished or skipped the warm-up ---------- */
  const blank = () => ({ step: 0, answers: {}, revealed: {}, stuck: {}, attempts: 0, calc: null, checks: [] });
  function validRun(r) {
    return !!(r && typeof r === 'object' && Number.isInteger(r.step) && r.step >= 0 && r.step <= STEPS.length &&
      r.answers && typeof r.answers === 'object' && r.revealed && typeof r.revealed === 'object');
  }
  function clean(r) {
    const out = blank(); out.step = r.step;
    for (const s of STEPS) {
      if (typeof r.answers[s.id] === 'string') out.answers[s.id] = r.answers[s.id].slice(0, MAX_TEXT);
      if (r.revealed[s.id] === true) out.revealed[s.id] = true;
      if (r.stuck && r.stuck[s.id] === true) out.stuck[s.id] = true;
    }
    out.attempts = Number.isInteger(r.attempts) && r.attempts >= 0 ? r.attempts : 0;
    out.checks = Array.isArray(r.checks) ? r.checks.map(Boolean).slice(0, 4) : [];
    if (out.answers.calc != null) out.calc = judge(STEPS[2], out.answers.calc);
    return out;
  }
  let run = read(RUN_KEY, null); run = validRun(run) ? clean(run) : null;
  let seen = read(SEEN_KEY, null); if (seen !== 'done' && seen !== 'skipped') seen = null;
  let screen = 'intro', timer = null, timerEnds = 0;

  const persist = () => save(RUN_KEY, run);
  function markSeen(v) { if (seen === 'done' && v === 'skipped') return; seen = v; save(SEEN_KEY, v); }
  function setHash(on) { try { window.history.replaceState(null, '', location.pathname + location.search + (on ? '#warmup' : '')); } catch { /* file:// or sandboxed frames */ } }
  function stopTimer() { clearInterval(timer); timer = null; }
  function scrollToLibrary() { const lib = $('#library'); if (lib && lib.scrollIntoView) lib.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function enter() { stopMedia(); stopTimer(); view = 'warmup'; setHash(true); window.scrollTo(0, 0); }

  function open() { enter(); renderIntro(); }

  /* ---------- Intro ---------- */
  function renderIntro() {
    enter(); screen = 'intro';
    const midway = run && run.step < STEPS.length && (run.step > 0 || Object.values(run.answers).some(a => a.trim()) || Object.keys(run.revealed).length > 0);
    $('#app').innerHTML = `<section class="wu-head"><div class="eyebrow">WARM-UP · ${W.minutes} MIN · NO PREPARATION NEEDED</div>
      <h1 class="drill-title">Your first case, <em>in four small steps.</em></h1>
      <p class="lead">A short campus problem to learn the moves interviewers look for. After each answer you see an example and why it works. Nothing is scored except the arithmetic.</p></section>
      <section class="panel wu-panel"><div class="eyebrow">${esc(W.setting)}</div><h2 class="section-title">${esc(W.title)}</h2><p class="brief">${esc(W.brief)}</p>
      <ol class="wu-plan">${STEPS.map(s => `<li><b>${esc(s.label)}</b></li>`).join('')}</ol>
      <div class="actions">${midway ? `<button class="primary" id="wuContinue">Continue from step ${run.step + 1} →</button><button id="wuStart">Start again</button>` : `<button class="primary" id="wuStart">Start the warm-up →</button>`}
      <button class="wu-link" id="wuSkip">Skip the walkthrough</button></div>
      <p class="note">Already done a case interview? Skip straight to the full cases. You can come back to it from the Case interview page.</p></section>`;
    $('#wuStart').onclick = () => { run = blank(); persist(); renderStep(); };
    if ($('#wuContinue')) $('#wuContinue').onclick = renderStep;
    $('#wuSkip').onclick = skip;
  }

  /** Leaves for the case library and stops putting the warm-up first there. */
  function skip() {
    stopTimer(); markSeen('skipped'); casesPage(); scrollToLibrary();
  }

  /* ---------- A step ---------- */
  const factsSoFar = () => STEPS.slice(0, run.step).filter(s => s.reply && run.revealed[s.id]).map(s => `<li>${esc(s.fact || s.reply)}</li>`).join('');
  function feedbackHtml(s) {
    const a = (run.answers[s.id] || '').trim(), c = s.kind === 'number' && a ? run.calc : null;
    const calcLine = !c ? '' : c.status === 'correct' ? `<p class="wu-result ok" id="wuResult" role="status"><b>✓ Correct: ₹${s.answer} per ticket.</b></p>`
      : c.status === 'wrong' ? `<p class="wu-result miss" id="wuResult">Your last answer was ₹${esc(String(c.value))}. ${esc(c.message)}</p>` : '';
    return `<section class="wu-feedback" id="wuFeedback" aria-live="polite">
      ${calcLine}
      ${c && c.status === 'correct' ? '' : a ? `<h3>Your answer</h3><p class="wu-yours">${esc(a)}</p>` : `<p class="note">You asked to see ${s.working ? 'the working' : 'an example'} first. Try putting it in your own words before moving on.</p>`}
      ${s.working ? `<h3>The working</h3><ol class="drill-steps">${s.working.map(w => `<li>${esc(w)}</li>`).join('')}</ol>` : ''}
      <h3>An example${a.trim() ? ' to compare with' : ''}</h3><blockquote class="wu-example">${esc(s.example)}</blockquote>
      <h3>Why it helps</h3><p>${esc(s.why)}</p>
      ${s.alsoGood ? `<details class="wu-also"><summary>Other answers that also work</summary><ul>${s.alsoGood.map(t => `<li>${esc(t)}</li>`).join('')}</ul></details>` : ''}
      ${s.selfCheck ? `<fieldset class="wu-selfcheck"><legend>Check your own recommendation</legend>${s.selfCheck.map((t, i) => `<label class="selfcheck"><input type="checkbox" data-check="${i}" ${run.checks[i] ? 'checked' : ''}> ${esc(t)}</label>`).join('')}<p class="note">This is your own judgement, not a score. Anything unticked is the thing to practise in your first full case.</p></fieldset>` : ''}
      ${s.reply ? `<div class="interviewer wu-reply"><div class="eyebrow">THE COMMITTEE HEAD REPLIES</div><p>${esc(s.reply)}</p></div>` : ''}
</section>`;
  }
  function renderStep() {
    if (!run) run = blank();
    if (run.step >= STEPS.length) return renderDone();
    enter(); screen = 'step';
    const s = STEPS[run.step], done = !!run.revealed[s.id], a = run.answers[s.id] || '', facts = factsSoFar();
    const input = s.kind === 'number'
      ? `<label class="wu-label" for="wuAnswer">Your answer <span class="note">(${esc(s.unit)})</span></label><div class="wu-number"><span aria-hidden="true">₹</span><input id="wuAnswer" type="text" inputmode="decimal" autocomplete="off" placeholder="${esc(s.placeholder)}" value="${esc(a)}"></div>`
      : `<label class="wu-label" for="wuAnswer">Your answer</label><textarea id="wuAnswer" rows="${s.seconds ? 5 : 3}" placeholder="${esc(s.placeholder)}">${esc(a)}</textarea>`;
    const wrong = s.kind === 'number' && !done && run.calc && run.calc.status === 'wrong';
    $('#app').innerHTML = `<div class="row wu-top"><div><div class="eyebrow">WARM-UP · STEP ${run.step + 1} OF ${STEPS.length}</div><h2 class="section-title">${esc(s.label)}</h2></div><button class="wu-link" id="wuExit">Skip to the cases</button></div>
      <ol class="wu-progress" aria-label="Progress">${STEPS.map((x, i) => `<li class="${i < run.step ? 'past' : i === run.step ? 'now' : ''}"${i === run.step ? ' aria-current="step"' : ''}>${esc(x.label)}</li>`).join('')}</ol>
      <details class="wu-brief" ${run.step === 0 ? 'open' : ''}><summary>The situation</summary><p class="brief">${esc(W.brief)}</p></details>
      ${facts ? `<section class="wu-facts"><h3>What you know so far</h3><ul>${facts}</ul></section>` : ''}
      <div class="interviewer"><div class="eyebrow">THE COMMITTEE HEAD ASKS</div><p>${esc(s.prompt)}</p></div>
      <section class="panel wu-panel">${done ? '' : `<details class="wu-hint"><summary>Need a nudge?</summary><p>${esc(s.hint)}</p></details>`}
      ${s.seconds && !done ? `<div class="wu-timer"><button id="wuTimer">Start ${s.seconds}-second timer</button><span id="wuClock" class="wu-clock" role="timer" aria-live="off">0:${String(s.seconds).padStart(2, '0')}</span></div>` : ''}
      ${done ? '' : input}
      ${wrong ? `<p class="wu-result miss" id="wuResult" role="alert">${esc(run.calc.message)}</p>` : ''}
      ${done ? '' : `<span class="sr-only" id="wuStatus" role="status"></span>`}
      ${done ? feedbackHtml(s) : ''}
      ${done ? flowBar({ primary: `<button class="primary next" id="wuNext">${run.step === STEPS.length - 1 ? 'Finish the warm-up →' : 'Next step →'}</button>` })
        : flowBar({ back: `<button class="wu-link" id="wuStuck">${s.kind === 'number' ? (wrong ? 'Show the working' : 'I’m stuck: show the working') : 'I’m stuck: show me an example'}</button>`,
          primary: `<button class="primary next" id="wuCheck">${s.kind === 'number' ? (wrong ? 'Check again →' : 'Check my answer →') : 'Compare with an example →'}</button>` })}</section>`;
    bindStep(s, done);
  }
  function bindStep(s, done) {
    $('#wuExit').onclick = skip;
    if (!done) {
      const box = $('#wuAnswer');
      box.oninput = () => { run.answers[s.id] = box.value.slice(0, MAX_TEXT); persist(); };
      if (s.kind === 'number') box.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#wuCheck').click(); } };
      $('#wuCheck').onclick = () => submit(s);
      $('#wuStuck').onclick = () => { run.stuck[s.id] = true; reveal(s); };
      if ($('#wuTimer')) $('#wuTimer').onclick = () => startTimer(s.seconds);
      return;
    }
    document.querySelectorAll('[data-check]').forEach(c => c.onchange = () => { run.checks[Number(c.dataset.check)] = c.checked; persist(); });
    $('#wuNext').onclick = () => { run.step++; persist(); if (run.step >= STEPS.length) { markSeen('done'); renderDone(); } else renderStep(); };
  }
  function submit(s) {
    const a = ($('#wuAnswer').value || '').trim(); run.answers[s.id] = a.slice(0, MAX_TEXT);
    if (!a) { const m = s.kind === 'number' ? 'Type a number first, or ask to see the working.' : 'Write your answer first, or ask to see an example.'; $('#wuStatus').textContent = m; nudge(m, '#wuAnswer'); return; }
    if (s.kind === 'number') {
      run.calc = judge(s, a); run.attempts++;
      if (run.calc.status === 'empty') { run.calc = null; persist(); $('#wuStatus').textContent = 'Type the amount as a number, for example 275.'; nudge('Type the amount as a number, for example 275.', '#wuAnswer'); return; }
      if (run.calc.status !== 'correct') { persist(); renderStep(); $('#wuAnswer').focus(); return; }
    }
    reveal(s);
  }
  function reveal(s) {
    stopTimer(); run.revealed[s.id] = true; persist(); renderStep();
    const f = $('#wuFeedback'); if (f && f.scrollIntoView) f.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function startTimer(total) {
    stopTimer(); timerEnds = Date.now() + total * 1000;
    const btn = $('#wuTimer'); if (btn) btn.textContent = 'Restart timer';
    const tick = () => {
      const el = $('#wuClock'); if (!el || view !== 'warmup') return stopTimer();
      const left = Math.max(0, Math.ceil((timerEnds - Date.now()) / 1000));
      el.textContent = clock(left); el.classList.toggle('over', left === 0);
      if (!left) { stopTimer(); el.textContent = 'Time'; $('#wuStatus').textContent = 'Thirty seconds is up. Finish your sentence, then compare.'; nudge('Thirty seconds is up. Finish your sentence, then compare.'); }
    };
    tick(); timer = setInterval(tick, 250);
  }

  /* ---------- Finished ---------- */
  function renderDone() {
    enter(); screen = 'done';
    const full = CASES.find(c => c.id === W.fullCase.id), r = run || blank(), ticked = r.checks.filter(Boolean).length;
    $('#app').innerHTML = `<section class="wu-head"><div class="eyebrow">WARM-UP COMPLETE</div><h1 class="drill-title">That is a case interview, <em>in miniature.</em></h1>
      <p class="lead">You clarified the problem, asked for one number, did one calculation and gave a recommendation. ${ticked ? `Your recommendation met ${ticked} of 4 points on your own check.` : ''}</p></section>
      <section class="panel wu-panel"><h2 class="section-title">What each step becomes in a full case</h2>
      <ol class="wu-map">${STEPS.map(s => `<li><b>${esc(s.label)}</b> → <span>${esc(s.maps)}</span>${r.answers[s.id] ? `<details><summary>Your answer</summary><p class="wu-yours">${esc(r.answers[s.id])}</p></details>` : ''}</li>`).join('')}</ol>
      <p class="note">${esc(W.fullCase.adds)}</p>
      <div class="actions">${full ? `<button class="primary" id="wuFull">Try a full case: ${esc(full.title)} · ${full.minutes} min →</button>` : ''}<button id="wuLibrary">Browse all cases</button><button class="wu-link" id="wuAgain">Do the warm-up again</button></div></section>`;
    if ($('#wuFull')) $('#wuFull').onclick = () => { setHash(false); start(W.fullCase.id, false); }; // the warm-up names this case, so it is never a blind attempt
    $('#wuLibrary').onclick = () => { casesPage(); scrollToLibrary(); };
    $('#wuAgain').onclick = () => { run = blank(); persist(); renderStep(); };
  }

  /* ---------- Integration with the rest of Case Room ---------- */
  const priorHome = home;
  home = function () { stopTimer(); priorHome(); if (location.hash === '#warmup') setHash(false); };

  /** Continues a warm-up in progress (from the home page's "Continue" list). */
  function resume() { if (!run) return open(); renderStep(); }

  window.WarmupTool = { open, resume, skip, state: () => ({ run, seen, screen }) };
})();
