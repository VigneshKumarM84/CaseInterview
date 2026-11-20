/* Peer mock interview: a classmate runs the case from an interviewer guide while the candidate sees
   only the brief and what the interviewer chooses to share. Uses the authored case data; no AI.
   Depends on globals from content/cases.js (CASES, RICH) and src/cases.js (richQuestion, stageLabels,
   richCalc, matches, stopMedia, view). */
(function () {
  const RUN_KEY = 'cr-peer-run', HISTORY_KEY = 'cr-peer-history', SCREEN_KEY = 'cr-peer-screen';
  const RATINGS = [['strong', 'Strong'], ['ok', 'Solid'], ['work', 'Needs work']];
  const ratingName = v => (RATINGS.find(r => r[0] === v) || [, 'Not scored'])[1];
  const STAGES = [0, 1, 2, 3, 4, 5, 6, 7], CALC_STAGES = [2, 4, 5];
  const GENERIC_PROBES = ['Which assumption could most change your approach?', 'What would make you abandon your leading hypothesis?', 'What unit or scale error would make this result misleading?', 'Why is this the most useful next question?'];

  /* What a strong answer sounds like at each stage, by case type. */
  const CUES = {
    standard: [
      ['Restates the objective and what success looks like before structuring', 'Asks one or two clarifying questions that would change the approach', 'Lays out a structure specific to this client, not a memorised framework', 'Says where they would start, and why'],
      ['Asks for specific data, not "everything"', 'States a hypothesis and what evidence would disprove it', 'Explains what each piece of data shows before moving on', 'Separates facts in the exhibits from their own assumptions'],
      ['Explains the approach before calculating', 'Keeps units and scale straight (lakh, crore, per unit, per year)', 'Sense-checks the result', 'Says what the number means for the client'],
      ['Chooses a direction and gives a reason linked to the evidence', 'Says what they expect to learn', 'Either path is fine: score the reasoning, not the choice'],
      ['Uses the new data rather than earlier assumptions', 'Gets the arithmetic right, or catches their own error', 'Draws an implication, not just a number'],
      ['Updates the analysis instead of defending the first answer', 'Recalculates only what the new evidence changes', 'Says which earlier conclusions still hold'],
      ['Leads with the answer', 'Quantifies the impact with the latest numbers', 'Names the main risk and an alternative', 'Is honest about any gap that remains'],
      ['Names an owner and the first steps', 'Gives success measures, including early indicators', 'Sets a condition for stopping or changing course']
    ],
    guesstimate: [
      ['Defines exactly what is counted, and what is not', 'Picks a unit and a boundary', 'Breaks the estimate into factors they can approximate'],
      ['States each assumption with a reason', 'Avoids double counting (customers versus cups, channels counted twice)', 'Keeps orders of magnitude sensible'],
      ['Multiplies through clearly and keeps track of units', 'Gives a low–high range, not a single figure', 'There is no fixed right answer here: judge the logic, not the total'],
      ['Chooses a cross-check that is independent of the first method', 'Explains what agreement or disagreement would tell them'],
      ['Calculates correctly with the given hypothetical inputs', 'Compares the result with their own first estimate'],
      ['Recalculates with the revised assumption', 'Says which uncertainty is resolved and which remains'],
      ['Gives a final range and the main assumptions behind it', 'Reconciles the methods without treating either as the truth'],
      ['Names the two data points that would most improve the estimate', 'Explains how to collect them and avoid sampling bias']
    ],
    analytics: [
      ['Asks how the metric is defined and counted', 'Checks whether the drop is unusual (last year, normal week-to-week variation)', 'Asks what changed around the date: releases, pricing, marketing, outside events', 'Breaks the metric into a funnel before guessing causes'],
      ['Asks for funnel or segment data, not a list of guesses', 'States a hypothesis and what data would rule it out', 'Separates internal causes (product, pricing) from external ones (market, season)'],
      ['Works out conversion at each step for both periods', 'Uses percentage points for a change in a rate', 'Says which step the drop sits in'],
      ['Picks a cut and says what each possible result would mean', 'Either cut is fine: score the reasoning, not the choice'],
      ['Finds which users are affected and which are not', 'Sizes the impact in orders, not only percentages', 'Notices that unaffected groups stayed normal'],
      ['Updates the explanation with the new data', 'Weighs the cost of waiting against acting now', 'Keeps cause and coincidence apart'],
      ['Leads with what happened and how sure they are', 'Recommends a proportionate action for this week', 'Says what still needs to be verified'],
      ['Names the metric that shows recovery, and a guardrail', 'Compares against unaffected users, not only before and after', 'Sets a time to check and a trigger to act']
    ],
    metrics: [
      ['Links the feature to the company goal, not just engagement', 'Names what could go wrong as well as right', 'Asks how the experiment was run before looking at results'],
      ['Chooses one primary metric and explains why', 'Adds guardrails for quality, notifications and revenue', 'Notices whether a metric was chosen before or after seeing results'],
      ['Calculates the relative lift correctly', 'Separates percentage points from percentage change', 'Turns the lift into a number of users'],
      ['Picks a check and says what each result would mean', 'Either check is fine: score the reasoning, not the choice'],
      ['Reads past the headline number', 'Spots whether the effect fades, or who was really exposed', 'Calculates correctly'],
      ['Updates their view when guardrails move the wrong way', 'Recalculates the key number', 'Separates engagement from value'],
      ['Makes a clear call: launch, change or keep testing', 'Backs it with the primary metric and the guardrails', 'Says what result would change their mind'],
      ['Proposes a staged rollout or a follow-up test', 'Names stop conditions on the guardrails', 'Sets a review date and a decision metric']
    ],
    product: [
      ['Identifies distinct user segments and what each needs', 'Asks about the company goal and constraints before comparing ideas', 'Does not jump to a favourite feature'],
      ['Grounds the problem in the research, not personal opinion', 'Chooses a segment to focus on, and says why', 'Notices how often, and for whom, each problem comes up'],
      ['Sets up the sizing clearly: users × adoption × value', 'Keeps units straight (₹ per day, per month, lakh, crore)', 'Sense-checks the result'],
      ['Picks a comparison method and names its limits', 'Either method is fine: score the reasoning, not the choice'],
      ['Calculates correctly and compares all three ideas', 'Says which inputs are guesses and how much they matter'],
      ['Re-ranks the ideas with the new numbers', 'Decides whether to switch, and explains why', 'Considers defensive value, not only revenue'],
      ['Leads with the user problem, then the feature', 'Says what they are choosing not to build', 'Names the main risk'],
      ['Describes a small first version and who gets it', 'Gives a success metric, guardrails and a stop condition', 'Sets a timeline for deciding']
    ],
    diagnosis: [
      ['Pins down the symptom: what changed, where and since when', 'Lists competing explanations before picking one', 'Asks whether the measurement itself could be wrong'],
      ['Requests evidence that separates a real change from a measurement change', 'Says what each observation supports or rules out'],
      ['Quantifies the size of the symptom correctly', 'Keeps units and time periods consistent'],
      ['Chooses a test and explains what each result would mean', 'Either test is fine: score the reasoning, not the choice'],
      ['Narrows down where the loss happens', 'Keeps more than one explanation alive until the data rules one out'],
      ['Revises the diagnosis when the evidence changes', 'Separates facts from hypotheses', 'Calculates the requested measure correctly'],
      ['States the problem precisely: what, where, how much and how confident', 'Does not jump to a fix (this case is diagnosis only)'],
      ['Proposes tests that could confirm or rule out each remaining cause', 'Stays on diagnosis rather than designing a solution']
    ]
  };

  const TYPE_LABELS = { diagnosis: 'Diagnosis-only case.', guesstimate: 'Guesstimate.', investment: 'Investment case.', analytics: 'Product analytics case.', metrics: 'Metrics and experiment case.', product: 'Product sense case.' };
  const caseOf = id => CASES.find(c => c.id === id);
  const cuesFor = id => CUES[RICH[id].archetype] || CUES.standard;
  const pathOf = (r, caseId = r.caseId) => RICH[caseId].branches.find(b => b.id === r.branch);
  const pseudo = (r, step) => ({ id: r.caseId, step, branch: r.branch });
  const calcAt = (r, step) => CALC_STAGES.includes(step) ? richCalc(pseudo(r, step), step) : null;
  const probeAt = (r, step) => step >= 4 ? pathOf(r)?.probe : GENERIC_PROBES[step];
  const durationOf = r => Math.max(0, Math.floor(((r.finished || Date.now()) - r.started) / 1000));
  /* "₹30 crore", "12.5%", "49,600 packs/day" rather than "30 ₹ crore". */
  function amount(v, unit) {
    const n = Number(v), num = String(v ?? '').trim() !== '' && Number.isFinite(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : String(v ?? '');
    if (unit.startsWith('₹ ')) return '₹' + num + ' ' + unit.slice(2);
    return unit === '%' ? num + '%' : num + ' ' + unit;
  }
  const isObj = o => o && typeof o === 'object' && !Array.isArray(o);

  function validRun(r) {
    return isObj(r) && !!caseOf(r.caseId) && RICH[r.caseId] && Number.isInteger(r.step) && r.step >= 0 && r.step <= 7 && Number.isFinite(r.started)
      && Array.isArray(r.clarified) && Array.isArray(r.opened) && Array.isArray(r.asked) && ['ratings', 'notes', 'numbers', 'strong', 'traps'].every(k => isObj(r[k]))
      && (r.branch == null || RICH[r.caseId].branches.some(b => b.id === r.branch));
  }

  let run = read(RUN_KEY, null); if (!validRun(run)) run = null;
  let past = read(HISTORY_KEY, []); if (!Array.isArray(past)) past = []; past = past.filter(r => validRun(r) && r.finished);
  let screen = 'home', shown = null, shareables = {}, screenWin = null;

  const persist = () => save(RUN_KEY, run);
  function setHash(h) { try { window.history.replaceState(null, '', location.pathname + location.search + h); } catch { /* file:// or sandboxed frames */ } }
  function enter(name, hash) { stopMedia(); view = 'peer'; screen = name; document.body.classList.remove('peer-candidate'); setHash(hash); window.scrollTo(0, 0); }

  /* ---------- Shared candidate screen (another tab or window on this device) ---------- */
  function screenState() { return read(SCREEN_KEY, null); }
  function pushScreen(extra = {}) {
    if (!run) return;
    const c = caseOf(run.caseId), prev = screenState(), items = prev && prev.uid === run.uid && Array.isArray(prev.items) ? prev.items : [];
    save(SCREEN_KEY, { uid: run.uid, caseId: c.id, title: c.title, company: c.company, brief: c.brief, stage: run.step, stageName: stageLabels(pseudo(run, run.step))[run.step], items, finished: false, ...extra });
  }
  function share(key) {
    const item = shareables[key]; if (!item || !run) return;
    if (key.startsWith('clar:') && !run.clarified.includes(+key.slice(5))) run.clarified.push(+key.slice(5));
    if (key.startsWith('ex:') && !run.opened.includes(key.slice(3))) run.opened.push(key.slice(3));
    persist();
    const prev = screenState(), items = (prev && prev.uid === run.uid ? prev.items : []).filter(i => i.key !== key);
    items.push({ key, title: item.title, text: item.text, at: Date.now() });
    pushScreen({ items });
    if (screenWin && !screenWin.closed) { toast('Shown on the candidate screen.'); renderGuide(); return; }
    renderGuide();
    modal(`<div class="eyebrow">SHOW THIS TO THE CANDIDATE</div><h2>${esc(item.title)}</h2><p class="peer-show">${esc(item.text)}</p><p class="note">Turn the screen to the candidate, then close this card. To share in a separate window instead (useful on a video call), open the candidate screen.</p>`);
  }
  function openScreen() {
    pushScreen();
    screenWin = window.open(location.pathname + location.search + '#peer-screen', 'case-room-candidate', 'width=960,height=760');
    if (!screenWin) toast('Your browser blocked the new window. Allow pop-ups for this site, or open a second tab at this address with #peer-screen on the end.');
  }
  function candidate() {
    stopMedia(); view = 'peer'; screen = 'candidate'; document.body.classList.add('peer-candidate');
    const s = screenState();
    if (!s || !caseOf(s.caseId)) { $('#app').innerHTML = `<section class="peer-cand"><div class="eyebrow">CASE ROOM · CANDIDATE SCREEN</div><h1 class="peer-cand-title">Waiting for your interviewer</h1><p class="lead">This screen shows the case brief and anything your interviewer shares. It updates by itself.</p></section>`; return; }
    const items = (Array.isArray(s.items) ? s.items : []).slice().reverse();
    $('#app').innerHTML = `<section class="peer-cand"><div class="eyebrow">CASE ROOM · CANDIDATE SCREEN</div><h1 class="peer-cand-title">${esc(s.title)}</h1><p class="subtle">${esc(s.company)}${s.finished ? '' : ` · Stage ${s.stage + 1} of 8: ${esc(s.stageName)}`}</p>${s.finished ? '<p class="peer-cand-done">The interview has finished. Talk through the feedback with your interviewer.</p>' : ''}<h2>The brief</h2><p class="brief">${esc(s.brief)}</p><h2>Shared with you</h2>${items.length ? items.map((i, n) => `<article class="peer-cand-item ${n === 0 ? 'latest' : ''}">${n === 0 ? '<span class="badge">Latest</span>' : ''}<h3>${esc(i.title)}</h3><p>${esc(i.text)}</p></article>`).join('') : '<p class="note">Nothing yet. Ask your interviewer for the information you need.</p>'}</section>`;
  }
  window.addEventListener('storage', e => { if (e.key === SCREEN_KEY && view === 'peer' && screen === 'candidate') candidate(); });

  /* ---------- Home: how it works, choose a case, past interviews ---------- */
  function open() { enter('home', '#peer'); renderHome(); }
  function renderHome() {
    const resume = run ? (() => { const c = caseOf(run.caseId); return `<section class="panel peer-resume"><div><b>Interview in progress: ${esc(c.title)}</b><p class="note">Stage ${run.step + 1} of 8 · ${clock(durationOf(run))} elapsed</p></div><div class="actions"><button class="primary" id="peerResume">Resume interview →</button><button id="peerDiscard">Discard</button></div></section>`; })() : '';
    $('#app').innerHTML = `<section class="peer-head"><div class="eyebrow">PEER INTERVIEW</div><h1 class="peer-title">Practise with a friend. <em>Anyone can interview.</em></h1><p class="lead">One of you runs the case from an interviewer guide that shows what to ask, what to share, what a strong answer sounds like and the correct numbers. The other answers out loud, the way a real case interview works. Then swap roles. No AI, no account, no cost.</p></section>${resume}
    <ol class="peer-how"><li><b>The interviewer picks a case</b><p class="note">Open the guide on the interviewer's device, or print the interviewer sheet. It contains the answers, so keep it away from the candidate.</p></li><li><b>The candidate sees only what you share</b><p class="note">Open the candidate screen in a second window and share it on your video call, or turn the screen when you share something. The printed sheet includes a one-page brief to hand over.</p></li><li><b>Score each stage, then talk it through</b><p class="note">Rate each stage and note what you heard. At the end you get written feedback to download or print.</p></li></ol>
    <div class="row"><div><div class="eyebrow">CHOOSE A CASE TO RUN</div><h2 class="section-title">${CASES.length} cases, about 30–45 minutes each</h2></div></div>
    <div class="peer-cases">${CASES.map(c => `<article class="peer-case"><div><span class="peer-icon" style="background:${esc(c.color)}">${esc(c.icon)}</span></div><div><h3>${esc(c.title)}</h3><p class="subtle">${esc(c.company)} · ${esc(c.level)} · ${esc(c.minutes)} min</p><p class="note">${esc(c.summary)}</p><div class="peer-case-actions"><button class="primary" data-peer-start="${esc(c.id)}">Interview with this case</button><button data-peer-sheet="${esc(c.id)}">Printable sheet</button></div></div></article>`).join('')}</div>
    <section class="panel peer-past"><h2>Past peer interviews</h2>${past.length ? `<ul class="peer-past-list">${past.map(r => `<li><div><b>${esc(caseOf(r.caseId).title)}</b><span class="note">${new Date(r.finished).toLocaleString()} · ${Math.max(1, Math.round(durationOf(r) / 60))} min</span></div><button data-peer-report="${esc(r.uid)}">View feedback →</button></li>`).join('')}</ul><button class="drill-link" id="peerClear">Delete peer interview history</button>` : '<p class="note">Finished interviews and their feedback are kept in this browser only.</p>'}</section>`;
    if ($('#peerResume')) $('#peerResume').onclick = () => { enter('guide', '#peer'); renderGuide(); };
    if ($('#peerDiscard')) $('#peerDiscard').onclick = () => { if (confirm('Discard this interview and its notes?')) { run = null; persist(); save(SCREEN_KEY, null); renderHome(); } };
    document.querySelectorAll('[data-peer-start]').forEach(b => b.onclick = () => start(b.dataset.peerStart));
    document.querySelectorAll('[data-peer-sheet]').forEach(b => b.onclick = () => sheet(b.dataset.peerSheet));
    document.querySelectorAll('[data-peer-report]').forEach(b => b.onclick = () => { const r = past.find(x => x.uid === b.dataset.peerReport); if (r) { enter('report', '#peer'); renderReport(r); } });
    if ($('#peerClear')) $('#peerClear').onclick = () => { if (confirm('Delete all finished peer interviews and their feedback in this browser?')) { past = []; save(HISTORY_KEY, past); renderHome(); } };
  }

  function start(caseId) {
    if (!caseOf(caseId)) return;
    if (run && !confirm('Replace the interview in progress? Its notes will be lost.')) return;
    run = { v: 1, uid: String(Date.now()), caseId, started: Date.now(), step: 0, branch: null, clarified: [], opened: [], asked: [], ratings: {}, notes: {}, numbers: {}, strong: {}, traps: {}, keep: '', change: '', finished: null };
    persist(); save(SCREEN_KEY, null); pushScreen();
    enter('guide', '#peer'); renderGuide();
  }

  /* ---------- Interviewer guide ---------- */
  function shareButton(key, label = 'Show to candidate') {
    const done = (key.startsWith('clar:') && run.clarified.includes(+key.slice(5))) || (key.startsWith('ex:') && run.opened.includes(key.slice(3))) || (screenState()?.items || []).some(i => i.key === key);
    return `<button class="peer-share ${done ? 'done' : ''}" data-share="${esc(key)}">${done ? 'Shared ✓ · show again' : label}</button>`;
  }
  function calcBlock(step) {
    const cal = calcAt(run, step); if (!cal) return '';
    shareables['calc:' + step] = { title: 'Calculation', text: cal.question };
    const v = run.numbers[step] ?? '', ok = String(v).trim() === '' ? null : matches(v, cal);
    const verdict = cal.openEstimate ? '<p class="note">Open estimate: there is no fixed answer. Judge the assumptions and the arithmetic, not the total.</p>' : ok === null ? '' : ok ? '<p class="peer-check good">✓ Within the accepted range</p>' : '<p class="peer-check improve">✗ Outside the accepted range. Compare their working with the answer key.</p>';
    return `<div class="peer-key"><div class="eyebrow">ANSWER KEY · INTERVIEWER ONLY</div>${step === 2 ? '' : `<p><b>Question:</b> ${esc(cal.question)}</p>`}${cal.openEstimate ? '' : `<p class="peer-answer">Answer: ${esc(amount(cal.answer, cal.unit))}</p>`}<p>${esc(cal.working)}</p><p class="hint"><b>If they are stuck, offer this hint:</b> ${esc(cal.hint)}</p><div class="actions">${shareButton('calc:' + step, 'Show the question')}</div><label for="peerNumber">Candidate's number (${esc(cal.unit)})</label><input id="peerNumber" type="number" step="any" value="${esc(v)}" placeholder="What did they say?"><div id="peerVerdict">${verdict}</div></div>`;
  }
  const DATA_ASK = 'A broad request (“any data on costs?”) earns the names of what exists. A precise one (the cut they want and what it would tell them) earns the exhibit.';
  function stageContent(step, c, r) {
    const b = pathOf(run);
    if (step === 0) {
      return `<h3>The brief</h3><p class="brief">${esc(c.brief)}</p><p class="note">The brief is always on the candidate screen. Read it aloud, or show it.</p><div class="actions">${shareButton('brief', 'Show the brief')}</div><h3>If the candidate asks…</h3><p class="note">Share an answer only when they ask something close to it. Asking good questions is part of the test.</p>${r.clarifications.map((x, i) => { shareables['clar:' + i] = { title: x[0], text: x[1] }; return `<div class="peer-item"><b>“${esc(x[0])}”</b><p>${esc(x[1])}</p>${shareButton('clar:' + i, 'Share this answer')}</div>`; }).join('')}`;
    }
    if (step === 1) {
      return `<h3>Exhibits to share when asked</h3><p class="peer-data-ask"><b>Ask what data they want before you offer anything.</b> ${DATA_ASK}</p><p class="note">${c.id === 'guesstimate' ? 'Exhibits are optional in a guesstimate. Let the candidate build their own assumptions first.' : 'Share only what the candidate asks for. Key exhibits are the ones the analysis needs; if they never ask for one, note it.'}</p>${c.exhibits.map(e => { shareables['ex:' + e.id] = { title: e.title, text: e.text }; return `<div class="peer-item"><span class="eyebrow">${esc(e.category)}</span>${e.critical ? '<span class="peer-tag">Key exhibit</span>' : ''}<b>${esc(e.title)}</b><p>${esc(e.text)}</p>${shareButton('ex:' + e.id, 'Share this exhibit')}</div>`; }).join('')}`;
    }
    if (step === 2) return calcBlock(2);
    if (step === 3) {
      return `<h3>Which path did the candidate choose?</h3><p class="note">Both paths are valid. Record their choice: it decides the data you share in the next two stages.</p><div class="peer-paths">${r.branches.map(p => `<div class="peer-item ${run.branch === p.id ? 'chosen' : ''}"><b>${esc(p.title)}</b><p>${esc(p.focus)}</p><button data-peer-path="${esc(p.id)}" aria-pressed="${run.branch === p.id}">${run.branch === p.id ? 'Their choice ✓' : 'They chose this'}</button></div>`).join('')}</div>`;
    }
    if (step === 4 || step === 5) {
      if (!b) return `<p class="hint">Record which path the candidate chose before running this stage.</p><div class="actions"><button data-peer-stage="3">Go to stage 4: choose the path</button></div>`;
      const key = step === 4 ? 'path:evidence' : 'path:shock';
      shareables[key] = step === 4 ? { title: b.title, text: b.evidence } : { title: 'New evidence', text: b.shock };
      return `<h3>${step === 4 ? 'Share this data: ' + esc(b.title) : 'Share the new evidence'}</h3><p class="brief">${esc(shareables[key].text)}</p><div class="actions">${shareButton(key, step === 4 ? 'Share the data' : 'Share the new evidence')}</div>${calcBlock(step)}`;
    }
    const ref = b ? `<details class="peer-ref"><summary>Reference answer for after the interview</summary><p>${esc(b.model)}</p><p class="note">One defensible answer. Other well-supported conclusions can be just as good.</p></details>` : '';
    return (step === 6 ? `<p class="note">Let them finish before you probe. A partial fix, a pilot or a "not yet" can all be strong if the evidence supports them.</p>` : '') + ref;
  }
  function renderGuide() {
    if (!run) return open();
    view = 'peer'; screen = 'guide'; shareables = { brief: { title: 'The brief', text: caseOf(run.caseId).brief } };
    const c = caseOf(run.caseId), r = RICH[c.id], step = run.step, labels = stageLabels(pseudo(run, step)), b = pathOf(run);
    let q = richQuestion(pseudo(run, step)); if (step >= 4 && !b) q = 'Record the candidate’s chosen path first.';
    const cal = calcAt(run, step), probe = probeAt(run, step), cues = cuesFor(c.id)[step];
    const body = stageContent(step, c, r);
    pushScreen();
    $('#app').innerHTML = `<div class="row peer-bar"><div><div class="eyebrow">PEER INTERVIEW · INTERVIEWER GUIDE</div><h2 class="section-title">${esc(c.title)}</h2><span class="subtle">${esc(c.company)}${b ? ' · Path: ' + esc(b.title) : ''}</span></div><div class="peer-tools"><span class="badge" id="peerTimer">${clock(durationOf(run))} · aim for ${esc(c.minutes)} min</span><button id="peerScreen">Open candidate screen ↗</button><button class="wu-link" id="peerExit">Exit · progress is saved</button></div></div>
    <p class="peer-warning">Keep this screen away from the candidate: it contains the answers.</p>${r.assessmentInstruction && step === 0 ? `<p class="peer-type"><b>${esc(TYPE_LABELS[r.archetype] || 'Case type note.')}</b> ${esc(r.assessmentInstruction)}</p>` : ''}
    <div class="peer-stages" role="group" aria-label="Interview stages">${STAGES.map(i => `<button data-peer-stage="${i}" class="${i === step ? 'active' : ''}" ${i === step ? 'aria-current="step"' : ''}><span class="dot ${esc(run.ratings[i] || '')}"></span>${i + 1}. ${esc(labels[i])}</button>`).join('')}</div>
    <div class="peer-grid"><section class="panel"><div class="eyebrow">STAGE ${step + 1} OF 8 · ${esc(labels[step])}</div><h3>Ask</h3><div class="interviewer"><p>${esc(q)}</p>${cal && step !== 2 ? `<p class="peer-then">Then: ${esc(cal.question)}</p>` : ''}</div>${body}</section>
    <aside class="panel peer-score"><h3>Listen for</h3><ul class="peer-cues">${cues.map(x => `<li>${esc(x)}</li>`).join('')}</ul>${probe ? `<h3>Follow-up to ask</h3><p class="peer-probe">“${esc(probe)}”</p><label class="selfcheck"><input type="checkbox" id="peerAsked" ${run.asked.includes(step) ? 'checked' : ''}> I asked the follow-up</label>` : ''}
    <fieldset class="peer-rating"><legend>How did this stage go?</legend>${RATINGS.map(([v, l]) => `<label class="drill-level"><input type="radio" name="peerRating" value="${v}" ${run.ratings[step] === v ? 'checked' : ''}><span><b>${l}</b></span></label>`).join('')}</fieldset>
    <label for="peerNote">Notes for the feedback</label><textarea id="peerNote" placeholder="What did they say or do? Quote them where you can.">${esc(run.notes[step] || '')}</textarea></aside></div>
    ${flowBar({ back: step ? '<button class="wu-link" id="peerPrev">← Previous stage</button>' : '', primary: `<button id="peerNext" class="primary next">${step === 7 ? 'Wrap up and give feedback →' : `Next: ${esc(labels[step + 1])} →`}</button>`,
      hint: run.ratings[step] ? '' : 'Rate this stage before you move on.' })}`;
    bindGuide();
  }
  function bindGuide() {
    const step = run.step;
    document.querySelectorAll('[data-peer-stage]').forEach(b => b.onclick = () => go(+b.dataset.peerStage));
    document.querySelectorAll('[data-share]').forEach(b => b.onclick = () => share(b.dataset.share));
    document.querySelectorAll('[data-peer-path]').forEach(b => b.onclick = () => choosePath(b.dataset.peerPath));
    document.querySelectorAll('input[name=peerRating]').forEach(el => el.onchange = () => { run.ratings[step] = el.value; persist(); if ($('#flowHint')) $('#flowHint').textContent = ''; const dot = document.querySelector(`[data-peer-stage="${step}"] .dot`); if (dot) dot.className = 'dot ' + el.value; });
    $('#peerNote').oninput = e => { run.notes[step] = e.target.value; persist(); };
    if ($('#peerAsked')) $('#peerAsked').onchange = e => { run.asked = run.asked.filter(x => x !== step); if (e.target.checked) run.asked.push(step); persist(); };
    if ($('#peerNumber')) $('#peerNumber').oninput = e => { run.numbers[step] = e.target.value; persist(); const cal = calcAt(run, step), v = e.target.value; if (cal.openEstimate) return; const ok = String(v).trim() === '' ? null : matches(v, cal); $('#peerVerdict').innerHTML = ok === null ? '' : ok ? '<p class="peer-check good">✓ Within the accepted range</p>' : '<p class="peer-check improve">✗ Outside the accepted range. Compare their working with the answer key.</p>'; };
    if ($('#peerPrev')) $('#peerPrev').onclick = () => go(step - 1);
    $('#peerNext').onclick = () => step === 7 ? wrap() : go(step + 1);
    $('#peerExit').onclick = home;
    $('#peerScreen').onclick = openScreen;
  }
  function go(step) { if (!run || step < 0 || step > 7) return; run.step = step; persist(); renderGuide(); window.scrollTo(0, 0); }
  function choosePath(id) {
    if (run.branch === id) return;
    const later = [4, 5].some(i => run.ratings[i] || run.notes[i] || String(run.numbers[i] ?? '').trim());
    if (run.branch && later && !confirm('Changing the path clears the scores, notes and numbers for the next two stages, because they depend on the path. Continue?')) return;
    run.branch = id; for (const i of [4, 5]) { delete run.ratings[i]; delete run.notes[i]; delete run.numbers[i]; } run.asked = run.asked.filter(i => i < 4);
    const prev = screenState(); if (prev && prev.uid === run.uid) save(SCREEN_KEY, { ...prev, items: prev.items.filter(i => !i.key.startsWith('path:') && !['calc:4', 'calc:5'].includes(i.key)) });
    persist(); renderGuide();
  }

  /* ---------- Wrap-up: case-wide checklist and the two headline points ---------- */
  function wrap() {
    if (!run) return open();
    enter('wrap', '#peer'); const c = caseOf(run.caseId), r = RICH[c.id];
    $('#app').innerHTML = `<div class="eyebrow">PEER INTERVIEW · WRAP-UP</div><h2 class="section-title">${esc(c.title)}</h2><section class="panel peer-wrap"><h3>What did the candidate do across the whole case?</h3><p class="note">Tick only what you actually heard.</p>${r.strong.map((x, i) => `<label class="selfcheck"><input type="checkbox" data-peer-strong="${i}" ${run.strong[i] ? 'checked' : ''}> ${esc(x)}</label>`).join('')}<h3>Common traps they fell into</h3>${r.pitfalls.map((x, i) => `<label class="selfcheck"><input type="checkbox" data-peer-trap="${i}" ${run.traps[i] ? 'checked' : ''}> ${esc(x)}</label>`).join('')}<label for="peerKeep">One thing to keep doing</label><textarea id="peerKeep" placeholder="The strongest moment, in one or two sentences.">${esc(run.keep)}</textarea><label for="peerChange">One thing to change next time</label><textarea id="peerChange" placeholder="The single change that would most improve the next attempt.">${esc(run.change)}</textarea><div class="actions"><button id="peerBack">← Back to the stages</button><button id="peerFinish" class="primary next">Finish & show feedback</button></div></section>`;
    document.querySelectorAll('[data-peer-strong]').forEach(el => el.onchange = () => { run.strong[el.dataset.peerStrong] = el.checked; persist(); });
    document.querySelectorAll('[data-peer-trap]').forEach(el => el.onchange = () => { run.traps[el.dataset.peerTrap] = el.checked; persist(); });
    $('#peerKeep').oninput = e => { run.keep = e.target.value; persist(); };
    $('#peerChange').oninput = e => { run.change = e.target.value; persist(); };
    $('#peerBack').onclick = () => { enter('guide', '#peer'); renderGuide(); };
    $('#peerFinish').onclick = finish;
  }
  function finish() {
    run.finished = Date.now(); pushScreen({ finished: true });
    const done = JSON.parse(JSON.stringify(run)); past.unshift(done); past = past.slice(0, 50); save(HISTORY_KEY, past);
    run = null; persist(); enter('report', '#peer'); renderReport(done);
  }

  /* ---------- Feedback report ---------- */
  function numberLine(r, i) {
    const cal = calcAt(r, i); if (!cal) return null; const v = r.numbers[i];
    if (String(v ?? '').trim() === '') return { cal, v: '', status: 'Not recorded' };
    return { cal, v, status: cal.openEstimate ? 'Open estimate' : matches(v, cal) ? 'Within range' : 'Outside range' };
  }
  function reportText(r) {
    const c = caseOf(r.caseId), R = RICH[c.id], labels = stageLabels(pseudo(r, 0)), b = pathOf(r);
    const nums = CALC_STAGES.map(i => [i, numberLine(r, i)]).filter(x => x[1]);
    return `CASE ROOM — PEER INTERVIEW FEEDBACK\n${c.title} (${c.company})\n${new Date(r.finished).toLocaleString()} · ${Math.max(1, Math.round(durationOf(r) / 60))} minutes${b ? ' · Path: ' + b.title : ''}\n\nThis is one interviewer's judgement, not a hiring score.\n\nONE THING TO KEEP DOING\n${r.keep || '—'}\n\nONE THING TO CHANGE NEXT TIME\n${r.change || '—'}\n\nSTAGE BY STAGE\n${STAGES.map(i => `${i + 1}. ${labels[i]}: ${ratingName(r.ratings[i])}${r.notes[i] ? '\n   ' + r.notes[i].replace(/\n/g, '\n   ') : ''}`).join('\n')}\n\nNUMBERS\n${nums.map(([i, n]) => `${labels[i]}: ${n.v === '' ? '—' : amount(n.v, n.cal.unit)} (${n.status})\n   ${n.cal.working}`).join('\n') || '—'}\n\nHEARD ACROSS THE CASE\n${R.strong.filter((_, i) => r.strong[i]).join('\n') || '—'}\n\nTRAPS TO WATCH\n${R.pitfalls.filter((_, i) => r.traps[i]).join('\n') || '—'}\n\nREFERENCE ANSWER (one defensible version)\n${b ? b.model : c.model}`;
  }
  function renderReport(r) {
    const c = caseOf(r.caseId), R = RICH[c.id], labels = stageLabels(pseudo(r, 0)), b = pathOf(r);
    const nums = CALC_STAGES.map(i => [i, numberLine(r, i)]).filter(x => x[1]);
    const graded = nums.filter(([, n]) => !n.cal.openEstimate && n.v !== ''), right = graded.filter(([, n]) => n.status === 'Within range').length;
    const counts = RATINGS.map(([v, l]) => [l, STAGES.filter(i => r.ratings[i] === v).length]);
    $('#app').innerHTML = `<div class="eyebrow">PEER INTERVIEW FEEDBACK</div><h1 class="peer-title">${esc(c.title)}</h1><p class="subtle">${esc(c.company)} · ${new Date(r.finished).toLocaleString()} · ${Math.max(1, Math.round(durationOf(r) / 60))} min${b ? ' · Path: ' + esc(b.title) : ''}</p>
    <div class="score-grid">${counts.map(([l, n]) => `<div><div class="metric">${n}</div><span class="note">Stages rated ${esc(l.toLowerCase())}</span></div>`).join('')}<div><div class="metric">${graded.length ? right + '/' + graded.length : '—'}</div><span class="note">Numbers within range</span></div></div>
    <p class="note">One interviewer's judgement, not a hiring score. Talk it through together, then swap roles.</p>
    <section class="panel peer-report"><div class="peer-headline"><div><h3>Keep doing</h3><p>${esc(r.keep || '—')}</p></div><div><h3>Change next time</h3><p>${esc(r.change || '—')}</p></div></div>
    <h2>Stage by stage</h2><table class="drill-table"><thead><tr><th>Stage</th><th>Rating</th><th>Notes</th></tr></thead><tbody>${STAGES.map(i => `<tr><th>${i + 1}. ${esc(labels[i])}</th><td><span class="dot ${esc(r.ratings[i] || '')}"></span>${esc(ratingName(r.ratings[i]))}</td><td class="peer-note">${esc(r.notes[i] || '')}</td></tr>`).join('')}</tbody></table>
    ${nums.length ? `<h2>Numbers</h2>${nums.map(([i, n]) => `<div class="feedback"><strong class="${n.status === 'Within range' ? 'good' : n.status === 'Outside range' ? 'improve' : ''}">${esc(labels[i])}: ${esc(n.status)}</strong><p>${esc(n.cal.question)}</p><p>Candidate: ${esc(n.v === '' ? '—' : amount(n.v, n.cal.unit))}</p><p>Answer: ${esc(n.cal.openEstimate ? 'open estimate' : amount(n.cal.answer, n.cal.unit))}</p><p class="note">${esc(n.cal.working)}</p></div>`).join('')}` : ''}
    <h2>Across the case</h2><h3>Heard</h3><ul>${R.strong.filter((_, i) => r.strong[i]).map(x => `<li>${esc(x)}</li>`).join('') || '<li class="note">Nothing ticked.</li>'}</ul><h3>Traps to watch</h3><ul>${R.pitfalls.filter((_, i) => r.traps[i]).map(x => `<li>${esc(x)}</li>`).join('') || '<li class="note">None ticked.</li>'}</ul>
    <details class="peer-ref"><summary>Reference answer (one defensible version)</summary><p>${esc(b ? b.model : c.model)}</p></details>
    <div class="actions"><button class="primary" id="peerDownload">Download feedback</button><button id="peerPrint">Print / save PDF</button><button id="peerAgain">Run this case again</button><button id="peerHome">All peer interviews</button></div></section>`;
    $('#peerDownload').onclick = () => download(reportText(r), `case-room-peer-${r.caseId}-feedback.txt`);
    $('#peerPrint').onclick = () => window.print();
    $('#peerAgain').onclick = () => start(r.caseId);
    $('#peerHome').onclick = open;
  }

  /* ---------- Printable interviewer sheet with a one-page candidate handout ---------- */
  function sheet(caseId) {
    const c = caseOf(caseId); if (!c) return open();
    enter('sheet', '#peer-sheet/' + encodeURIComponent(caseId));
    const R = RICH[c.id], s0 = { id: c.id, step: 0, branch: null }, labels = stageLabels(s0), cues = cuesFor(c.id);
    const box = '<span class="peer-boxes">☐ Strong &nbsp; ☐ Solid &nbsp; ☐ Needs work</span><div class="peer-lines"></div>';
    const calcPrint = cal => cal ? `<p><b>Calculation:</b> ${esc(cal.question)}</p>${cal.openEstimate ? '' : `<p><b>Answer:</b> ${esc(amount(cal.answer, cal.unit))}</p>`}<p class="note">${esc(cal.working)} Hint if stuck: ${esc(cal.hint)}</p>` : '';
    const stage = (i, inner) => { const q = richQuestion({ ...s0, step: i }); return `<section class="peer-sheet-stage"><h3>${i + 1}. ${esc(labels[i])}</h3>${q ? `<p class="peer-ask"><b>Ask:</b> ${esc(q)}</p>` : ''}${inner}<p class="note"><b>Listen for:</b> ${cues[i].map(esc).join(' · ')}</p>${i < 4 ? `<p class="note"><b>Follow-up:</b> ${esc(GENERIC_PROBES[i])}</p>` : ''}${box}</section>`; };
    const paths = (fn) => R.branches.map((p, n) => `<div class="peer-sheet-path"><b>Path ${'AB'[n]}: ${esc(p.title)}</b>${fn(p)}</div>`).join('');
    $('#app').innerHTML = `<div class="actions peer-sheet-actions"><button class="primary" id="peerSheetPrint">Print / save PDF</button><button id="peerSheetBack">← Back</button><span class="note">Page 1 is the candidate handout. The rest is for the interviewer only.</span></div>
    <article class="peer-sheet"><section class="peer-handout"><div class="eyebrow">CASE ROOM · CANDIDATE HANDOUT</div><h1 class="peer-title">${esc(c.title)}</h1><p class="subtle">${esc(c.company)} · about ${esc(c.minutes)} minutes</p><p class="brief">${esc(c.brief)}</p><p>Your interviewer will share more information when you ask for it. Think out loud, and take notes on paper as you go.</p></section>
    <section><div class="eyebrow">CASE ROOM · INTERVIEWER SHEET · KEEP AWAY FROM THE CANDIDATE</div><h1 class="peer-title">${esc(c.title)}</h1><p class="subtle">${esc(c.company)} · aim for ${esc(c.minutes)} minutes</p>${R.assessmentInstruction ? `<p class="peer-type">${esc(R.assessmentInstruction)}</p>` : ''}
    ${stage(0, `<p><b>If the candidate asks:</b></p><ul>${R.clarifications.map(x => `<li><b>“${esc(x[0])}”</b> ${esc(x[1])}</li>`).join('')}</ul>`)}
    ${stage(1, `<p class="peer-data-ask"><b>Ask what data they want before you offer anything.</b> ${DATA_ASK}</p><p><b>Exhibits to share when asked</b> (★ key exhibit):</p><ul>${c.exhibits.map(e => `<li><b>${e.critical ? '★ ' : ''}${esc(e.title)}:</b> ${esc(e.text)}</li>`).join('')}</ul>`)}
    ${stage(2, calcPrint(c.calc))}
    ${stage(3, `<p>Record which path they choose (both are valid): ${R.branches.map((p, n) => `☐ Path ${'AB'[n]}: ${esc(p.title)}`).join(' &nbsp; ')}</p>`)}
    ${stage(4, paths(p => `<p><b>Ask:</b> ${esc(p.question)}</p><p><b>Share:</b> ${esc(p.evidence)}</p>${calcPrint(p.calc)}<p class="note"><b>Follow-up:</b> ${esc(p.probe)}</p>`))}
    ${stage(5, paths(p => `<p><b>Share:</b> ${esc(p.shock)}</p>${calcPrint(p.stressCalc)}`))}
    ${stage(6, paths(p => `<p class="note"><b>Reference answer:</b> ${esc(p.model)}</p>`))}
    ${stage(7, '')}
    <section class="peer-sheet-stage"><h3>Across the whole case</h3><p><b>Heard:</b></p><ul class="peer-tick">${R.strong.map(x => `<li>☐ ${esc(x)}</li>`).join('')}</ul><p><b>Traps:</b></p><ul class="peer-tick">${R.pitfalls.map(x => `<li>☐ ${esc(x)}</li>`).join('')}</ul><p><b>One thing to keep doing:</b></p><div class="peer-lines"></div><p><b>One thing to change next time:</b></p><div class="peer-lines"></div></section></section></article>`;
    $('#peerSheetPrint').onclick = () => window.print();
    $('#peerSheetBack').onclick = open;
  }

  setInterval(() => { if (view === 'peer' && screen === 'guide' && run && $('#peerTimer')) $('#peerTimer').textContent = `${clock(durationOf(run))} · aim for ${caseOf(run.caseId).minutes} min`; }, 1000);

  /* ---------- Integration with the rest of Case Room ---------- */
  const priorHome = home;
  home = function () {
    document.body.classList.remove('peer-candidate');
    priorHome(); if (location.hash.startsWith('#peer')) setHash('');
  };


  window.PeerMock = { open, candidate, sheet, start, state: () => ({ run, past, screen }) };
})();
