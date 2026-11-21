/* "Prepare for my next round": three quick choices (round, time, optional role) and a short plan built from the
   practice already in Case Room. The student can remove, add and tick off items; the plan stays in this browser.
   Uses core.js helpers, view/home/start from cases.js, NextRound (content/next-round.js) and each tool's entry points. */
(() => {
  const N = NextRound, PLAN_KEY = 'cr-next-round';
  const roundOf = id => N.ROUNDS.find(r => r.id === id), validRole = id => N.ROLES.some(r => r.id === id), validTime = m => N.TIMES.some(t => t.minutes === m);

  /* ---------- Saved plan ---------- */
  function cleanEntries(list) {
    const out = [];
    for (const e of Array.isArray(list) ? list : []) {
      if (!e || !N.ITEMS[e.id] || out.some(x => x.id === e.id)) continue;
      out.push(typeof e.why === 'string' && e.why.length < 400 ? { id: e.id, why: e.why } : { id: e.id });
    }
    return out;
  }
  function clean(p) {
    if (!p || typeof p !== 'object') return null;
    const s = { round: roundOf(p.round) ? p.round : null, role: validRole(p.role) ? p.role : 'other', minutes: validTime(p.minutes) ? p.minutes : N.DEFAULT_MINUTES };
    s.items = s.round ? cleanEntries(p.items) : [];
    s.done = Array.isArray(p.done) ? p.done.filter(id => s.items.some(e => e.id === id)) : [];
    s.edited = !!p.edited;
    return s;
  }
  let state = clean(read(PLAN_KEY, null)) || { round: null, role: 'other', minutes: N.DEFAULT_MINUTES, items: [], done: [], edited: false };
  const persist = () => save(PLAN_KEY, state);
  const warmupDone = () => !!(window.WarmupTool && WarmupTool.state().seen === 'done');
  function suggest() { state.items = state.round ? N.plan({ round: state.round, role: state.role, minutes: state.minutes, warmupDone: warmupDone() }) : []; state.done = []; state.edited = false; }

  function setHash(on) { try { window.history.replaceState(null, '', location.pathname + location.search + (on ? '#next-round' : '')); } catch { /* file:// or sandboxed frames */ } }
  /** Opens the picker. Passing a round (from the home page's round tiles) chooses it, keeping the time and role. */
  function open(round) {
    stopMedia(); view = 'next-round'; setHash(true); window.scrollTo(0, 0);
    if (typeof round === 'string' && roundOf(round) && state.round !== round) { state.round = round; suggest(); persist(); }
    render();
  }

  /* ---------- Page ---------- */
  const chip = (name, value, title, checked) => `<label class="drill-chip nr-chip"><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''}><span><b>${esc(title)}</b></span></label>`;
  function render() {
    view = 'next-round';
    $('#app').innerHTML = `<section class="nr-head"><div class="eyebrow">PREPARE FOR MY NEXT ROUND</div><h1 class="drill-title">What is your next round, <em>and how long do you have?</em></h1>
      <p class="lead">Choose the round from your placement notice. You get a short plan made from the practice in Case Room, and you can change any of it.</p></section>
      <div class="nr-grid"><section class="panel nr-choices">
        <fieldset><legend>Your next round</legend><div class="nr-chips">${N.ROUNDS.map(r => chip('nrRound', r.id, r.title, state.round === r.id)).join('')}</div></fieldset>
        <fieldset><legend>Time you have now</legend><div class="nr-chips">${N.TIMES.map(t => chip('nrTime', t.minutes, t.title, state.minutes === t.minutes)).join('')}</div></fieldset>
        <fieldset><legend>Role you are applying for <span class="note">(optional)</span></legend><div class="nr-chips">${N.ROLES.map(r => chip('nrRole', r.id, r.title, state.role === r.id)).join('')}</div></fieldset>
        <p class="note">Want a full case straight away? <button class="wu-link" id="nrCases">Go to the case interview page</button></p>
      </section><section class="panel nr-plan" id="nrPlan" aria-live="polite">${planHtml()}</section></div>`;
    document.querySelectorAll('[name=nrRound],[name=nrTime],[name=nrRole]').forEach(r => r.onchange = choose);
    $('#nrCases').onclick = () => casesPage();
    bindPlan();
  }
  function choose() {
    const pick = name => document.querySelector(`[name=${name}]:checked`);
    state.round = pick('nrRound') ? pick('nrRound').value : null; state.minutes = Number(pick('nrTime').value); state.role = pick('nrRole').value;
    suggest(); persist(); renderPlan();
  }

  function itemHtml(e, i) {
    const it = N.ITEMS[e.id], done = state.done.includes(e.id);
    const action = it.tips
      ? `<details class="nr-tips"><summary>Read the five moves</summary><ol>${it.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ol></details>`
      : `<button class="${i === 0 && !done ? 'primary' : ''}" data-go="${e.id}">Start →</button>`;
    return `<li class="nr-item${done ? ' done' : ''}" data-item="${e.id}"><div class="nr-item-main"><div class="eyebrow">${esc(it.tool)} · ${it.minutes} MIN</div>
      <h3>${esc(it.title)}</h3><p class="note">${esc(e.why || it.why)}</p>${action}</div>
      <div class="nr-item-side"><label class="nr-done"><input type="checkbox" data-done="${e.id}" ${done ? 'checked' : ''}> Done</label><button class="nr-remove" data-remove="${e.id}" aria-label="Remove “${esc(it.title)}” from the plan" title="Remove from the plan">×</button></div></li>`;
  }
  function planHtml() {
    if (!state.round) return `<h2 class="section-title">Your plan</h2><p class="note" id="nrEmpty">Choose your next round to see a plan. If your placement notice does not say, choose “I don’t know the round yet”.</p>`;
    const r = roundOf(state.round), mins = N.total(state.items), left = Object.keys(N.ITEMS).filter(id => !state.items.some(e => e.id === id));
    const firstCase = state.round === 'case' && state.minutes >= 45 && !warmupDone() && !state.items.some(e => e.id === 'warmup');
    return `<h2 class="section-title">Your plan for: ${esc(r.title.replace('I don’t know the round yet', 'a round you don’t know yet'))}</h2>
      <p class="nr-note${r.outside ? ' outside' : ''}" id="nrNote">${esc(r.note)}</p>
      ${firstCase ? `<p class="note nr-first">Never done a case interview? <button class="wu-link" id="nrAddWarmup">Add the 10-minute warm-up first</button></p>` : ''}
      ${state.items.length ? `<ol class="nr-items" id="nrItems">${state.items.map(itemHtml).join('')}</ol>` : '<p class="note" id="nrNone">Your plan is empty. Add something below or reset to the suggested plan.</p>'}
      <p class="nr-total" id="nrTotal">About ${mins} minutes${mins > state.minutes ? `, more than the ${state.minutes} you have: drop something or do the rest later` : ''}. ${state.done.length ? `${state.done.length} of ${state.items.length} done.` : ''}</p>
      <div class="nr-edit">${left.length ? `<label for="nrAdd">Add to this plan</label><div class="nr-add"><select id="nrAdd">${left.map(id => `<option value="${id}">${esc(N.ITEMS[id].tool)}: ${esc(N.ITEMS[id].title)} (${N.ITEMS[id].minutes} min)</option>`).join('')}</select><button id="nrAddBtn">Add</button></div>` : ''}
      ${state.edited ? '<button class="wu-link" id="nrReset">Reset to the suggested plan</button>' : ''}</div>`;
  }
  function renderPlan() { const el = $('#nrPlan'); if (!el) return; el.innerHTML = planHtml(); bindPlan(); }
  function bindPlan() {
    document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
    document.querySelectorAll('[data-done]').forEach(c => c.onchange = () => {
      state.done = state.done.filter(id => id !== c.dataset.done); if (c.checked) state.done.push(c.dataset.done); persist(); renderPlan();
    });
    document.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => {
      const i = state.items.findIndex(e => e.id === b.dataset.remove); if (i < 0) return;
      state.items.splice(i, 1); state.done = state.done.filter(id => id !== b.dataset.remove); state.edited = true; persist(); renderPlan();
      const next = document.querySelectorAll('[data-remove]')[Math.min(i, state.items.length - 1)]; (next || $('#nrAdd') || $('#nrReset'))?.focus();
    });
    if ($('#nrAddBtn')) $('#nrAddBtn').onclick = () => { const id = $('#nrAdd').value; if (!N.ITEMS[id]) return; state.items.push({ id }); state.edited = true; persist(); renderPlan(); $('#nrAdd')?.focus(); };
    if ($('#nrAddWarmup')) $('#nrAddWarmup').onclick = () => { state.items.unshift({ id: 'warmup' }); state.edited = true; persist(); renderPlan(); };
    if ($('#nrReset')) $('#nrReset').onclick = () => { suggest(); persist(); renderPlan(); };
  }

  /** Opens the tool behind a plan item, set up for that item. */
  function go(id) {
    const o = N.ITEMS[id] && N.ITEMS[id].open; if (!o) return;
    setHash(false);
    if (o.tool === 'aptitude') return o.test ? Aptitude.quickTest(o.test) : Aptitude.quickPractice(o.practice);
    if (o.tool === 'drill') return CaseDrill.quick({ skills: o.skills, count: 10 });
    if (o.tool === 'warmup') return WarmupTool.open();
    if (o.tool === 'case') return start(o.caseId, false); // the plan names the case, so it is never a blind attempt
    if (o.tool === 'peer') return PeerMock.open();
    if (o.tool === 'behavioural') return Behavioural.ask(o.mode);
    if (o.tool === 'stories') return Behavioural.stories();
    if (o.tool === 'resume') return ResumeTool.open();
    if (o.tool === 'defence') return DefenceTool.open(o.mode);
    if (o.tool === 'gd') return GDTool.open();
    if (o.tool === 'moves') return MovesTool.openMove(o.move);
  }

  /* ---------- Integration with the rest of Case Room ---------- */
  const priorHome = home;
  home = function () { priorHome(); if (location.hash === '#next-round') setHash(false); };

  window.NextRoundTool = { open, go, state: () => state };
})();
