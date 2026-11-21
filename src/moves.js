/* Moves: five-minute trainings for one interview behaviour at a time. Three are sets (answer first, so what, does that number make
   sense) and one is a round (attempt, leave or guess: sort eight aptitude questions, then sit them against a clock that is
   too short). A set is Spot items (pick the right one; checked in code, with the reason for your pick) then Do items
   (produce it against a clock; the checks look at the shape of the answer, then you compare with three examples).
   Each completed item is saved to the history at once, and a finished round saves its calls when the debrief first shows. Offline, no AI,
   no network. Also adds a short "moves you have trained" section to the case, HR, defence and group discussion debriefs and a self-check to a timed aptitude test's results. Uses core.js helpers, view/home/showReport/stopMedia/micRow/attachDictation
   from cases.js, and MovesContent / MovesLogic. Must load before ai-client.js so its showReport wrap sits outside this one. */
(() => {
  const { MOVES, OPENINGS, STATEMENTS, SLIPS, GRADES, GROUPS, FLAWS, QUESTIONS, PUSHBACKS, REWRITES, NEXT_LINES, TRIAGE: T } = MovesContent, L = MovesLogic, IDS = L.SET_MOVE_IDS, ALL = L.MOVE_IDS, N = T.questions;
  const RUN_KEY = 'cr-moves-run', HISTORY_KEY = 'cr-moves-history', SEEN_KEY = 'cr-moves-seen', TRANSFER_KEY = 'cr-moves-transfer';
  const MAX_TEXT = 2000, MAX_TRANSFER = 120, MAX_KEY = 80, GRADE_IDS = Object.keys(GRADES);
  /* The five authored moves share one screen shape; each names its options with its own table of kinds. */
  const AUTHORED = ['split-it', 'one-question', 'hold-or-change', 'put-a-number', 'next-line'];
  const KINDS = { 'answer-first': OPENINGS, 'so-what': STATEMENTS, 'split-it': FLAWS, 'one-question': QUESTIONS, 'hold-or-change': PUSHBACKS, 'put-a-number': REWRITES, 'next-line': NEXT_LINES };
  /* The self-check question for each trained move, by the debrief it appears in, in the order shown. */
  const TRANSFER_Q = {
    case: {
      'split-it': 'Did your structure split the problem into branches that did not overlap?',
      'one-question': 'Before each request for data, could you say what its answer would change?',
      'so-what': 'When you opened an exhibit, did you say what it meant before reading the numbers out?',
      'number-sense': 'Did you sanity-check each figure before you said it?',
      'hold-or-change': 'When the interviewer pushed back, did you change your answer only for a new fact?',
      'answer-first': 'Did your recommendation open with the answer?'
    },
    hr: {
      'answer-first': 'Did each answer open with your answer, before the story?',
      'hold-or-change': 'When a follow-up challenged you, did you hold or change for a reason, not for the pressure?',
      'put-a-number': 'Did each story have a number, and say what you did with “I”?'
    },
    defence: {
      'answer-first': 'Did you answer each question in your first sentence?',
      'hold-or-change': 'When the interviewer doubted a claim, did you hold or change for a reason, not for the pressure?',
      'put-a-number': 'Did you give each result as a number, and say which part was yours?'
    },
    gd: { 'next-line': 'Before you spoke, did you ask what the group needed: a build, a name, a steer or a summary?' }
  };
  /* What the Do checks cannot tell you, said after each text move's checks. */
  const SHAPE = {
    'answer-first': 'These checks look at the shape of your answer: the order, the support and the length. They cannot tell you whether it is right.',
    'so-what': 'These checks look at the shape of your answer: the order, the support and the length. They cannot tell you whether it is right.',
    'split-it': 'These checks look at the shape of your split: how many branches, and whether one repeats, contains or hides another. They cannot tell you whether the split is right.',
    'one-question': 'These checks look at the shape of your question: one question, specific, with a reason. They cannot tell you whether it is the right question.',
    'hold-or-change': 'These checks look at the shape of your reply: a clear call, a reason, a number, the tone and the length. They cannot tell you whether holding or changing was right.',
    'put-a-number': 'These checks look at the shape of your line: a number with its base, a result, “I”, and no vague words. They cannot tell you whether the figures are right.',
    'next-line': 'These checks look at the shape of your line: whether it connects to the group, moves it on and stays short. They cannot tell you whether it was what the group needed.'
  };
  const move = id => L.moveOf(id), title = id => move(id).title, moveOf = move;

  /* ---------- Saved state, read defensively: anything malformed is dropped ---------- */
  const isStr = v => typeof v === 'string', isNum = v => typeof v === 'number' && Number.isFinite(v);
  const strs = a => Array.isArray(a) && a.every(isStr), own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  /* What each authored move's item must carry. Spot items also hold four options with exactly one right; Do items hold the three examples. */
  const SITUATION = {
    'split-it': it => isStr(it.round) && isStr(it.question) && (it.rung === 'do' || (isStr(it.root) && strs(it.branches) && it.branches.length > 0 && isStr(it.flaw) && own(FLAWS, it.flaw))),
    'one-question': it => isStr(it.round) && isStr(it.brief) && strs(it.known),
    'hold-or-change': it => isStr(it.round) && isStr(it.said) && isStr(it.push) && (it.call === 'hold' || it.call === 'revise'),
    'put-a-number': it => isStr(it.round) && isStr(it.line) && strs(it.facts),
    'next-line': it => isStr(it.topic) && isStr(it.situation) && strs(it.names) && Array.isArray(it.lines) && it.lines.every(l => l && isStr(l.who) && isStr(l.text)) && isStr(it.need) && own(NEXT_LINES, it.need) && (it.rung === 'spot' || strs(it.keywords))
  };
  function validAuthored(it) {
    if (!SITUATION[it.move](it)) return false;
    if (it.rung === 'do') return isStr(it.weak) && isStr(it.adequate) && isStr(it.strong);
    return Array.isArray(it.options) && it.options.length === 4 && it.options.every(o => o && typeof o === 'object' && isStr(o.text) && isStr(o.why) && isStr(o.kind) && own(KINDS[it.move], o.kind) && typeof o.right === 'boolean') && it.options.filter(o => o.right).length === 1;
  }
  function validItem(it) {
    if (!it || typeof it !== 'object') return false;
    if (AUTHORED.includes(it.move)) return validAuthored(it);
    if (it.move === 'answer-first') return isStr(it.question) && isStr(it.round)
      && (it.rung === 'spot' ? Array.isArray(it.options) && it.options.length === 4 && it.options.every(o => o && isStr(o.text) && OPENINGS[o.kind])
        : Array.isArray(it.facts) && it.facts.every(isStr) && isStr(it.weak) && isStr(it.adequate) && isStr(it.strong));
    if (it.move === 'so-what') return isStr(it.title) && it.table && Array.isArray(it.table.columns) && Array.isArray(it.table.rows) && it.table.rows.every(r => Array.isArray(r) && r.length === it.table.columns.length)
      && Array.isArray(it.statements) && it.statements.length === 4 && it.statements.every(s => s && isStr(s.text) && STATEMENTS[s.kind] && isStr(s.why))
      && (it.rung === 'spot' || (isStr(it.weak) && isStr(it.adequate) && isStr(it.strong)));
    if (it.move === 'number-sense') return isStr(it.setup) && isStr(it.claim) && isStr(it.ask) && isStr(it.unit) && isStr(it.why) && isNum(it.correct) && typeof it.ok === 'boolean' && Array.isArray(it.working) && it.working.every(isStr)
      && Array.isArray(it.options) && it.options.length === 4 && it.options.every(o => SLIPS.some(s => s.id === o)) && (it.slip === null || SLIPS.some(s => s.id === it.slip));
    return false;
  }
  function cleanResult(r) {
    if (!r || typeof r !== 'object' || typeof r.ok !== 'boolean') return null;
    return { ok: r.ok, idx: Number.isInteger(r.idx) && r.idx >= 0 && r.idx < 4 ? r.idx : null, verdict: r.verdict === 'right' || r.verdict === 'off' ? r.verdict : null,
      slip: SLIPS.some(s => s.id === r.slip) ? r.slip : null, text: isStr(r.text) ? r.text.slice(0, MAX_TEXT) : '', grade: GRADE_IDS.includes(r.grade) ? r.grade : null,
      seconds: isNum(r.seconds) && r.seconds >= 0 ? r.seconds : null, at: isNum(r.at) ? r.at : 0 };
  }
  /* A saved round keeps only its known fields, so nothing else rides along. */
  function cleanRound(r) {
    if (!L.validTriageRun(r)) return null;
    return { move: 'triage', seed: r.seed, questions: r.questions, phase: r.phase, at: r.at, calls: r.calls, late: r.late, order: r.order, index: r.index,
      answers: r.answers.map(a => a && { state: a.state, pick: a.pick, guess: a.guess, seconds: a.seconds }), used: r.used };
  }
  function cleanRun(r) {
    if (r && r.move === 'triage') return cleanRound(r);
    if (!L.validRun(r) || r.index >= r.items.length || !r.items.every(validItem)) return null;
    const results = r.results.map(cleanResult);
    if (results.some(x => !x) || results.length < r.index || results.length > r.index + 1) return null;
    return { move: r.move, seed: r.seed, items: r.items, index: r.index, results, draft: isStr(r.draft) ? r.draft.slice(0, MAX_TEXT) : '', verdict: r.verdict === 'off' ? 'off' : null };
  }
  function cleanTransfer(t) {
    const out = {};
    if (!t || typeof t !== 'object' || Array.isArray(t)) return out;
    for (const [k, v] of Object.entries(t).slice(-MAX_TRANSFER)) if (k.length <= MAX_KEY && Array.isArray(v)) out[k] = [...new Set(v.filter(id => IDS.includes(id)))];
    return out;
  }
  function forget(key) { try { localStorage.removeItem(key); } catch { /* storage blocked */ } }
  let run = cleanRun(read(RUN_KEY, null)); if (!run) forget(RUN_KEY);
  let history = L.cleanHistory(read(HISTORY_KEY, []));
  let seen = read(SEEN_KEY, []); seen = Array.isArray(seen) ? [...new Set(seen.filter(id => ALL.includes(id)))] : [];
  let transfer = cleanTransfer(read(TRANSFER_KEY, {}));
  let screen = 'hub', timer = null, started = 0, lastSet = null, lastRound = null, learning = null, briefSeed = null, picked = null, clockAt = 0, lastSaved = 0;

  const persistRun = () => run ? save(RUN_KEY, run) : forget(RUN_KEY);
  const persistHistory = () => save(HISTORY_KEY, history);
  function setHash(h) { try { window.history.replaceState(null, '', location.pathname + location.search + (h || '')); } catch { /* file:// or sandboxed frames */ } }
  function stopTimer() { clearInterval(timer); timer = null; }
  function enter(hash) { stopMedia(); stopTimer(); view = 'moves'; setHash(hash); window.scrollTo(0, 0); }
  const mmss = n => clock(Math.max(0, Math.round(n)));
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  /* ---------- Status wording ---------- */
  /* What a move calls its two rungs in status wording. */
  const groupOf = id => (GROUPS.find(g => g.moves.includes(id)) || {}).id;
  const labelsOf = id => move(id).labels || { spot: 'Spot', do: 'Do' };
  function statusLine(id) {
    const s = L.status(history, id), lb = labelsOf(id);
    if (s.state === 'new') return 'Not started';
    if (s.state === 'ready') return move(id).kind === 'round' ? 'Ready. Now use it in a full timed test.' : groupOf(id) === 'gd' ? 'Ready. Now use it in a group discussion.' : 'Ready. Now use it in a full case or interview.';
    return `${lb.spot}: ${s.spot.of ? `${s.spot.correct} of your last ${s.spot.of} ${move(id).kind === 'round' ? 'good' : 'right'}` : 'not tried yet'} · ${lb.do}: ${s.do.of ? `${s.do.passed} of your last ${s.do.of} passed` : 'not tried yet'}`;
  }
  /** What is still missing for "ready", in plain words. */
  function needs(s) {
    const out = [], round = move(s.move).kind === 'round', calls = (n, one, many) => n === 1 ? one : many;
    if (s.spot.of < 10) out.push(round ? `${10 - s.spot.of} more sorting ${calls(10 - s.spot.of, 'call', 'calls')} (you have ${s.spot.correct} of ${s.spot.of} good so far)` : `${plural(10 - s.spot.of, 'more Spot pick', 'more Spot picks')} (you have ${s.spot.correct} of ${s.spot.of} right so far)`);
    else if (s.spot.correct < 8) out.push(round ? `at least 8 of your last 10 sorting calls good (now ${s.spot.correct})` : `at least 8 of your last 10 Spot picks right (now ${s.spot.correct})`);
    if (s.do.of < 3 || s.do.passed < 3) out.push(round ? `your last 3 rounds all passing (now ${s.do.passed} of ${s.do.of})` : `your last 3 Do reps all passing every check (now ${s.do.passed} of ${s.do.of})`);
    return out;
  }

  /* ---------- Hub ---------- */
  function open() { enter('#moves'); renderHub(); }
  function renderHub() {
    screen = 'hub';
    $('#app').innerHTML = `<section class="mv-head"><div class="eyebrow">TRAIN ONE MOVE · 5 MIN</div>
      <h1 class="drill-title">One skill at a time, <em>until it is a habit.</em></h1>
      <p class="lead">Each set takes about five minutes and is checked as you go. It builds towards a full case or interview.</p></section>
      ${GROUPS.map(g => `<h2 class="mv-group-title">${esc(g.title)}</h2><ul class="mv-cards">${g.moves.map(moveOf).map(m => {
        const s = L.status(history, m.id), going = run && run.move === m.id;
        return `<li class="mv-card ${s.state}"><div class="eyebrow">${m.minutes} MIN</div><h2>${esc(m.title)}</h2><p class="mv-tag">${esc(m.tagline)}</p>
          <p class="note">Pays off in: ${esc(m.where)}</p><p class="mv-status ${s.state}"><span aria-hidden="true">${s.state === 'ready' ? '✓ ' : ''}</span>${esc(statusLine(m.id))}</p>
          <button class="${s.state === 'ready' ? '' : 'primary'}" id="move-${m.id}">${going ? 'Continue →' : s.attempts ? (m.kind === 'round' ? 'Another round →' : 'Another set →') : 'Start →'}</button></li>`;
      }).join('')}</ul>`).join('')}
      <p class="note mv-note">A set move is ready when 8 of your last 10 Spot picks are right and your last 3 Do reps pass every check. The Do checks look at the shape of your answer, not whether it is right.</p>
      ${MOVES.filter(m => m.kind === 'round').map(m => `<p class="note mv-note">${esc(m.title)} is ready when 8 of your last 10 sorting calls were good and your last 3 rounds passed.</p>`).join('')}`;
    MOVES.forEach(m => { $('#move-' + m.id).onclick = () => run && run.move === m.id ? resume() : openMove(m.id); });
  }

  /* ---------- Learn ---------- */
  /** Opens a move: the rule the first time, a new set after that. `seed` makes the set repeatable (tests). */
  function openMove(id, opts = {}) {
    if (!move(id)) return open();
    if (run && run.move === id && !isNum(opts.seed)) return resume();
    if (!seen.includes(id)) return renderLearn(id, opts.seed);
    startMove(id, opts.seed);
  }
  const startMove = (id, seed) => move(id).kind === 'round' ? startRound(id, seed) : startSet(id, seed);
  function tableHtml(t, caption, wide) {
    return `<div class="mv-table-box${wide ? ' wide' : ''}" role="region" aria-label="${esc(caption)}" tabindex="0"><table class="mv-table"><caption>${esc(caption)}</caption>
      <thead><tr>${t.columns.map((c, i) => `<th scope="col"${i ? ' class="num"' : ''}>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${t.rows.map(r => `<tr>${r.map((c, i) => i ? `<td class="num">${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  /* The worked example's situation, by move. */
  function exampleHtml(id, e) {
    const box = (label, text) => `<div class="interviewer"><div class="eyebrow">${label}</div><p>${esc(text)}</p></div>`;
    switch (id) {
      case 'answer-first': return box('THE INTERVIEWER ASKS', e.question);
      case 'so-what': return tableHtml(e.table, e.question);
      case 'split-it': return box('THE PROBLEM', e.question);
      case 'one-question': return box('THE BRIEF', e.question);
      case 'hold-or-change': return box('THE INTERVIEWER PUSHES BACK', e.question);
      case 'next-line': return `${box('GROUP DISCUSSION · THE SITUATION', e.question)}${talkHtml(e.lines)}`;
      default: return `<blockquote class="mv-claim"><p>${esc(e.question)}</p></blockquote>`;
    }
  }
  /* A split is written one branch per line, so it is shown that way. */
  const answerHtml = (id, text) => id === 'split-it' ? `<ul class="mv-branches">${L.branchesOf(text).map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : esc(text);
  const talkHtml = lines => `<ol class="mv-talk">${lines.map(l => `<li><b>${esc(l.who)}</b> ${esc(l.text)}</li>`).join('')}</ol>`;
  function renderLearn(id, seed) {
    enter('#moves/' + id); screen = 'learn'; learning = { id, seed };
    const m = move(id), e = m.example, back = run && run.move === id;
    const ask = exampleHtml(id, e);
    $('#app').innerHTML = `<section class="mv-head"><div class="eyebrow">THE RULE · ${m.minutes} MIN ${m.kind === 'round' ? 'ROUND' : 'SET'}</div><h1 class="drill-title">${esc(m.title)}</h1><p class="lead">${esc(m.tagline)}</p></section>
      <section class="panel mv-panel"><h2 class="section-title">The rule</h2><ol class="mv-rule">${m.rule.map(r => `<li>${esc(r)}</li>`).join('')}</ol>
      <h3>Why it matters</h3><p>${esc(m.why)}</p><p class="note">Pays off in: ${esc(m.where)}</p>
      <h3>An example</h3>${ask}
      <div class="mv-compare"><div class="mv-ex weak"><div class="eyebrow">A weaker answer</div><blockquote>${answerHtml(id, e.weak)}</blockquote></div><div class="mv-ex strong"><div class="eyebrow">A stronger answer</div><blockquote>${answerHtml(id, e.strong)}</blockquote></div></div>
      <p class="note">${esc(e.note)}</p>
      <div class="actions"><button class="primary" id="mvStart">${back ? (m.kind === 'round' ? 'Back to your round →' : 'Back to your set →') : (m.kind === 'round' ? 'Start the round →' : 'Start the set →')}</button><button class="wu-link" id="mvHub">All moves</button></div></section>`;
    $('#mvStart').onclick = () => back ? resume() : startMove(id, seed);
    $('#mvHub').onclick = open;
  }

  /* ---------- A set ---------- */
  function startSet(id, seed) {
    if (!seen.includes(id)) { seen.push(id); save(SEEN_KEY, seen); }
    const s = L.buildSet(id, { seed: isNum(seed) ? seed : Date.now(), recent: L.recentIds(history, id) });
    run = { move: id, seed: s.seed, items: s.items, index: 0, results: [], draft: '', verdict: null }; persistRun(); renderItem(true);
  }
  const cur = () => run.items[run.index], done = () => run.results[run.index];
  const spotCount = () => run.items.filter(i => i.rung === 'spot').length;
  function position(item) { const same = run.items.filter(i => i.rung === item.rung); return `${same.indexOf(item) + 1} OF ${same.length}`; }
  function topRow(item) {
    return `<div class="row mv-top"><div class="eyebrow">${esc(title(run.move).toUpperCase())} · ${item.rung === 'spot' ? 'SPOT' : 'DO'} · ${position(item)}</div>
      <span class="mv-links"><button class="wu-link" id="mvRule">See the rule again</button><button class="wu-link" id="mvExit">Leave the set</button></span></div>
      <ol class="flow-progress" aria-hidden="true">${run.items.map((_, i) => `<li class="${i < run.index || (i === run.index && done()) ? 'done' : i === run.index ? 'now' : ''}"></li>`).join('')}</ol>`;
  }
  function bindTop() { $('#mvRule').onclick = () => renderLearn(run.move); $('#mvExit').onclick = open; }
  function nextLabel() { const last = run.index >= run.items.length - 1; return last ? 'See your results →' : run.items[run.index + 1].rung !== cur().rung ? 'On to the Do items →' : 'Next →'; }
  const interviewer = it => `<div class="interviewer"><div class="eyebrow">${esc(it.round.toUpperCase())} · ${it.round === 'Group discussion' ? 'THE SITUATION' : 'THE INTERVIEWER ASKS'}</div><p>${esc(it.question)}</p></div>`;
  const claimHtml = it => `<blockquote class="mv-claim"><p>${esc(it.setup)}</p><p><b>${esc(it.claim)}</b></p></blockquote>`;
  const kindLabel = (it, o) => KINDS[it.move][o.kind].label;
  /* The situation an authored move shows above its prompt, on both rungs. Nothing here may give away the right option. */
  function situationHtml(it) {
    const r = it.round ? esc(it.round.toUpperCase()) : '', spot = it.rung === 'spot';
    const box = (label, body) => `<div class="interviewer"><div class="eyebrow">${label}</div>${body}</div>`;
    const facts = (head, list) => `<section class="mv-facts"><h3>${head}</h3><ul>${list.map(f => `<li>${esc(f)}</li>`).join('')}</ul></section>`;
    switch (it.move) {
      case 'split-it': return box(`${r} · THE PROBLEM`, `<p>${esc(it.question)}</p>`)
        + (spot ? `<div class="mv-tree"><p class="mv-root">${esc(it.root)}</p><ul>${it.branches.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>` : '');
      case 'one-question': return box(`${r} · THE BRIEF`, `<p>${esc(it.brief)}</p>`) + facts('What you already know', it.known);
      case 'hold-or-change': return `<div class="mv-said"><div class="eyebrow">YOU SAID</div><p>${esc(it.said)}</p></div>${box(`${r} · THE INTERVIEWER PUSHES BACK`, `<p>“${esc(it.push)}”</p>`)}`;
      case 'put-a-number': return `<blockquote class="mv-claim"><div class="eyebrow">${r} · THE LINE</div><p>${esc(it.line)}</p></blockquote>${facts('Facts you can use', it.facts)}`;
      default: return `${box('GROUP DISCUSSION · THE TOPIC', `<p>${esc(it.topic)}</p><p class="note">${esc(it.situation)}</p>`)}${talkHtml(it.lines)}`;
    }
  }

  function renderItem(fresh) {
    if (!run) return open();
    enter('#moves/' + run.move); screen = 'item';
    const it = cur(); started = Date.now();
    $('#app').innerHTML = `<section class="mv-screen">${topRow(it)}${it.rung === 'spot' ? spotHtml(it) : doHtml(it)}</section>`;
    bindTop();
    if (it.rung === 'spot') bindSpot(it); else bindDo(it);
    const f = $('#mvFeedback'); if (f && done()) f.scrollIntoView({ block: 'start' });
    else if (fresh) { const h = $('#mvHead'); if (h) h.focus(); }
  }
  /* A soft clock: it shows the time and the target, marks it over, and never blocks. */
  function softClock(target) {
    return `<p class="mv-timer"><span id="mvClock" class="wu-clock" role="timer" aria-live="off">0:00</span> <span class="note">target ${mmss(target)}</span> <span id="mvOver" class="mv-over" hidden>over your target</span></p>`;
  }
  function startSoftClock(target) {
    const tick = () => {
      const el = $('#mvClock'); if (!el || view !== 'moves' || screen !== 'item') return stopTimer();
      const s = Math.floor((Date.now() - started) / 1000); el.textContent = mmss(s); el.classList.toggle('over', s > target); $('#mvOver').hidden = s <= target;
    };
    stopTimer(); tick(); timer = setInterval(tick, 500);
  }
  const seconds = () => Math.round((Date.now() - started) / 100) / 10;
  function tookHtml(r, target) {
    if (!isNum(r.seconds)) return '';
    return `<p class="note mv-took">You took ${Math.round(r.seconds)} seconds${target ? (r.seconds > target ? `, over your target of ${target}.` : `, inside your target of ${target}.`) : '.'}</p>`;
  }

  /* Records one finished item: the screen state and the history entry are saved together. */
  function complete(res, rec) {
    const it = cur(); res.seconds = seconds(); res.at = Date.now(); res.grade = null;
    run.results[run.index] = res; run.verdict = null; stopTimer();
    history.push(L.record(it, { ...rec, seconds: res.seconds, at: res.at })); history = L.cleanHistory(history);
    persistRun(); persistHistory(); renderItem();
    const f = $('#mvFeedback'); if (f) f.focus();
  }
  function next() {
    stopMedia(); stopTimer();
    if (run.index >= run.items.length - 1) return finishSet();
    run.index++; run.draft = ''; run.verdict = null; persistRun(); renderItem(true);
  }
  function setGrade(g) {
    const r = done(), it = cur(); r.grade = g; persistRun();
    const e = [...history].reverse().find(x => x.id === it.id && x.at === r.at); if (e) { e.grade = g; persistHistory(); }
  }

  /* ---------- Spot ---------- */
  const markHtml = (cls, text) => `<span class="mv-mark" aria-hidden="true">${cls === 'right' || cls === 'correct' ? '✓' : cls === 'wrong' ? '✗' : ''}</span>${text ? `<span class="mv-state">${text}</span>` : ''}`;
  function optionHtml(id, text, kind, st) {
    const cls = st.chosen ? (st.ok ? 'right' : 'wrong') : st.correct ? 'correct' : '', tag = st.chosen ? (st.ok ? 'Your pick · right' : 'Your pick · not this one') : st.correct ? 'The right one' : '';
    return `<li><button class="mv-opt ${st.locked ? 'locked ' : ''}${cls}" id="${id}" ${st.locked ? 'disabled' : ''}>${markHtml(cls, tag)}<span class="mv-text">${esc(text)}</span>${kind ? `<span class="mv-kind">${esc(kind)}</span>` : ''}${st.why ? `<span class="mv-why">${esc(st.why)}</span>` : ''}</button></li>`;
  }
  const optionsOf = it => it.move === 'so-what' ? it.statements : it.options;
  function spotHtml(it) {
    const r = done(), m = move(it.move), tgt = m.spot.seconds;
    const clock = tgt && !r ? softClock(tgt) : '';
    if (it.move === 'number-sense') return numberSpotHtml(it, r, m, clock);
    const list = optionsOf(it), j = r ? L.judgeSpot(it, r.idx) : null, auth = AUTHORED.includes(it.move);
    const lead = auth ? situationHtml(it) : it.move === 'answer-first' ? interviewer(it) : tableHtml(it.table, it.title);
    const opts = list.map((o, i) => optionHtml('mvOpt-' + i, o.text, r ? kindLabel(it, o) : '', { locked: !!r, chosen: r && r.idx === i, ok: r && r.ok, correct: r && j.answer === i && r.idx !== i, why: r && it.move !== 'answer-first' ? o.why : '' })).join('');
    let fb = '';
    if (r) {
      const why = it.move === 'answer-first' ? OPENINGS.answer.why : list[j.answer].why;
      fb = `<div id="mvFeedback" aria-live="polite" tabindex="-1"><div class="drill-feedback ${r.ok ? 'ok' : 'miss'}"><h3>${r.ok ? '✓ Right' : '✗ Not quite'}</h3><p>${esc(j.why)}</p>
        ${r.ok ? '' : `<p><b>Why the right one works:</b> ${esc(why)}</p>`}</div></div>${flowBar({ primary: `<button class="primary next" id="mvNext">${nextLabel()}</button>` })}`;
    }
    return `${lead}<h2 class="mv-prompt" id="mvHead" tabindex="-1">${esc(m.spot.prompt)}</h2>${clock}<ol class="mv-options">${opts}</ol>${fb}`;
  }
  function numberSpotHtml(it, r, m, clock) {
    const stage2 = !r && run.verdict === 'off', verdict = r ? r.verdict : run.verdict;
    const vbtn = (id, text, v) => `<button class="mv-opt ${r || stage2 ? 'locked ' : ''}${verdict === v && (r || stage2) ? 'chosen-plain' : ''}" id="${id}" ${r || stage2 ? 'disabled' : ''}>${verdict === v && (r || stage2) ? '<span class="mv-mark" aria-hidden="true">●</span><span class="mv-state">Your pick</span>' : ''}<span class="mv-text">${text}</span></button>`;
    let more = '';
    if (stage2 || r && r.verdict === 'off') {
      more = `<h3 class="mv-what" id="mvWhat" tabindex="-1">What went wrong?</h3><ol class="mv-options">${it.options.map(s => {
        const sl = SLIPS.find(x => x.id === s);
        return optionHtml('mvSlip-' + s, sl.label, '', { locked: !!r, chosen: r && r.slip === s, ok: r && r.ok, correct: r && it.slip === s && r.slip !== s });
      }).join('')}</ol>`;
    }
    let fb = '';
    if (r) {
      const sl = SLIPS.find(x => x.id === it.slip), j = L.judgeSpot(it, { verdict: r.verdict, slip: r.slip });
      const line = r.ok ? (it.ok ? 'That figure was right.' : `That figure was off, and you named the slip: ${sl.label}.`)
        : j.caught ? `You caught that it was off, but the slip was: ${sl.label}.` : it.ok ? 'That figure was right, so there was nothing to catch.' : `That figure was off. The slip was: ${sl.label}.`;
      fb = `<div id="mvFeedback" aria-live="polite" tabindex="-1"><div class="drill-feedback ${r.ok ? 'ok' : 'miss'}"><h3>${r.ok ? '✓ Right' : '✗ Not quite'}</h3><p>${esc(line)}</p>
        <ol class="drill-steps">${it.working.map(w => `<li>${esc(w)}</li>`).join('')}</ol><p>${esc(it.why)}</p>${sl ? `<p><b>Habit:</b> ${esc(sl.habit)}</p>` : ''}${tookHtml(r, m.spot.seconds)}</div></div>`
        + flowBar({ primary: `<button class="primary next" id="mvNext">${nextLabel()}</button>` });
    }
    return `${claimHtml(it)}<h2 class="mv-prompt" id="mvHead" tabindex="-1">${esc(m.spot.prompt)}</h2>${clock}
      <div class="mv-verdict">${vbtn('mvRight', 'Looks right', 'right')}${vbtn('mvOff', 'Something is off', 'off')}</div>${more}${fb}`;
  }
  function bindSpot(it) {
    const r = done(), tgt = move(it.move).spot.seconds;
    if (tgt && !r) startSoftClock(tgt);
    if (r) { $('#mvNext').onclick = next; return; }
    if (it.move === 'number-sense') {
      $('#mvRight').onclick = () => complete({ ok: L.judgeSpot(it, { verdict: 'right' }).ok, verdict: 'right' }, { ok: L.judgeSpot(it, { verdict: 'right' }).ok, pick: 'right' });
      $('#mvOff').onclick = () => { const t0 = started; run.verdict = 'off'; persistRun(); renderItem(); started = t0; startSoftClock(tgt || 15); const w = $('#mvWhat'); if (w) w.focus(); };
      if (run.verdict === 'off') it.options.forEach(s => { $('#mvSlip-' + s).onclick = () => { const ok = L.judgeSpot(it, { verdict: 'off', slip: s }).ok; complete({ ok, verdict: 'off', slip: s }, { ok, pick: 'off:' + s }); }; });
      return;
    }
    optionsOf(it).forEach((_, i) => { $('#mvOpt-' + i).onclick = () => { const j = L.judgeSpot(it, i); complete({ ok: j.ok, idx: i }, { ok: j.ok, pick: j.picked }); }; });
  }

  /* ---------- Do ---------- */
  const markOf = l => l === 'ok' ? '✓' : '↗';
  function checksHtml(res) {
    return `<ul class="bh-checks">${res.checks.map(c => `<li class="${c.level}"><span aria-hidden="true">${markOf(c.level)}</span><span class="sr-only">${c.level === 'ok' ? 'Passed:' : 'To fix:'}</span> ${esc(c.text)}</li>`).join('')}</ul>`;
  }
  const textChecks = (it, text) => L.checkDo(it, text);
  /* "6 ₹ crore" reads badly: put the symbol where people say it. */
  function figure(n, unit) {
    const v = DrillQuestions.fmt(n, 4);
    return unit === '%' ? v + '%' : unit.startsWith('₹') ? '₹' + v + unit.slice(1) : v + ' ' + unit;
  }
  function doHtml(it) {
    const r = done(), m = move(it.move), tgt = m.do.seconds;
    if (it.move === 'number-sense') return numberDoHtml(it, r, m, tgt);
    const auth = AUTHORED.includes(it.move);
    const lead = auth ? situationHtml(it) : it.move === 'answer-first' ? `${interviewer(it)}<section class="mv-facts"><h3>Facts you can use</h3><ul>${it.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul></section>` : tableHtml(it.table, it.title);
    const head = `<h2 class="mv-prompt" id="mvHead" tabindex="-1">${esc(m.do.prompt)}</h2>`;
    if (!r) {
      return `${lead}${head}<div class="wu-timer"><button id="mvTimer">Start ${tgt}-second timer</button><span id="mvClock" class="wu-clock" role="timer" aria-live="off">${mmss(tgt)}</span></div>
        ${micRow('mvMic', 'mvVoiceStatus')}<label for="mvAnswer" class="flow-label">${it.move === 'split-it' ? 'Your branches · one per line, or say them' : 'Your answer · appears here as you speak, or type'}</label>
        <div class="dictation-box"><textarea id="mvAnswer" rows="5" maxlength="${MAX_TEXT}" placeholder="${esc(m.do.placeholder || '')}">${esc(run.draft)}</textarea></div>
        ${flowBar({ primary: '<button class="primary next" id="mvCheck">Check my answer →</button>' })}`;
    }
    const res = textChecks(it, r.text), tip = G => `<div class="mv-grade ${G}"><div class="eyebrow">${esc(GRADES[G].label)}</div><p class="note">${esc((m.do.grades && m.do.grades[G]) || GRADES[G].note)}</p><blockquote>${answerHtml(it.move, it[G])}</blockquote></div>`;
    const yours = it.move === 'split-it' ? `<div class="wu-yours">${answerHtml('split-it', r.text)}</div>` : `<p class="wu-yours">${esc(r.text)}</p>`;
    const extra = it.move === 'hold-or-change' ? `<p class="mv-extra">${it.call === 'hold' ? 'The strong answer holds: nothing the interviewer said touches the reason.' : 'The strong answer changes: the interviewer gave a fact that touches the reason.'}</p>`
      : it.move === 'next-line' ? `<p class="mv-extra">What the group needed here: ${esc(NEXT_LINES[it.need].label)}.</p>` : '';
    return `${lead}${head}<div id="mvFeedback" aria-live="polite" tabindex="-1" class="mv-feedback"><h3>Your answer</h3>${yours}
      <h3>${res.pass ? '✓ Every check passed' : 'What to fix'}</h3>${checksHtml(res)}
      <p class="note">${esc(SHAPE[it.move])}</p>${extra}
      <h3>Three answers to compare with</h3><div class="mv-grades">${['weak', 'adequate', 'strong'].map(tip).join('')}</div>
      <fieldset class="mv-pick"><legend>Which is yours closest to?</legend>${GRADE_IDS.map(g => `<label class="mv-radio"><input type="radio" name="mvGrade" id="mvGrade-${g}" value="${g}" ${r.grade === g ? 'checked' : ''}> ${esc(GRADES[g].label)}</label>`).join('')}</fieldset></div>
      ${flowBar({ primary: `<button class="primary next" id="mvNext">${nextLabel()}</button>` })}`;
  }
  function numberDoHtml(it, r, m, tgt) {
    const head = `<h2 class="mv-prompt" id="mvHead" tabindex="-1">${esc(m.do.prompt)}</h2>`;
    if (!r) {
      return `${claimHtml(it)}${head}${softClock(tgt)}<label for="mvAnswer" class="flow-label">${esc(it.ask)}</label>
        <div class="mv-figure"><input id="mvAnswer" type="text" inputmode="decimal" autocomplete="off" value="${esc(run.draft)}" placeholder="For example 12.5"></div>
        ${flowBar({ primary: '<button class="primary next" id="mvCheck">Check my figure →</button>' })}`;
    }
    return `${claimHtml(it)}${head}<div id="mvFeedback" aria-live="polite" tabindex="-1"><div class="drill-feedback ${r.ok ? 'ok' : 'miss'}"><h3>${r.ok ? '✓ Right' : '✗ Not quite'}</h3>
      <p>You typed <b>${esc(r.text)}</b>. The correct figure is <b>${esc(figure(it.correct, it.unit))}</b>. ${it.ok ? 'The figure in the claim was already right.' : 'The figure in the claim was off.'}</p>
      <ol class="drill-steps">${it.working.map(w => `<li>${esc(w)}</li>`).join('')}</ol><p>${esc(it.why)}</p>${tookHtml(r, tgt)}</div></div>
      ${flowBar({ primary: `<button class="primary next" id="mvNext">${nextLabel()}</button>` })}`;
  }
  function bindDo(it) {
    const r = done(), m = move(it.move);
    if (r) {
      $('#mvNext').onclick = () => { if (it.move !== 'number-sense' && !r.grade) return nudge('Choose which answer yours is closest to first.', '#mvGrade-weak'); next(); };
      document.querySelectorAll('[name=mvGrade]').forEach(x => x.onchange = () => { setGrade(x.value); $('#flowHint').textContent = ''; });
      return;
    }
    const box = $('#mvAnswer'), owner = run, text = it.move !== 'number-sense';
    box.oninput = () => { owner.draft = box.value.slice(0, MAX_TEXT); persistRun(); };
    if (text) {
      $('#mvTimer').onclick = () => startCountdown(m.do.seconds);
      attachDictation({ button: $('#mvMic'), target: box, status: $('#mvVoiceStatus'), language: dictationLang, isCurrent: () => run === owner && screen === 'item',
        onText: v => { owner.draft = v.slice(0, MAX_TEXT); persistRun(); } });
    } else {
      startSoftClock(m.do.seconds);
      box.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#mvCheck').click(); } };
    }
    $('#mvCheck').onclick = () => check(it, box.value);
  }
  function check(it, raw) {
    const t = raw.trim().slice(0, MAX_TEXT);
    if (!t) return nudge(it.move === 'number-sense' ? 'Type a figure first.' : 'Write your answer first, even a rough one.', '#mvAnswer');
    run.draft = t;
    if (it.move === 'number-sense') {
      const c = L.checkFigure(it, t);
      if (!c.valid) return nudge('Type the figure as a number, for example 12.5.', '#mvAnswer');
      return complete({ ok: c.ok, text: t }, { ok: c.ok });
    }
    const res = textChecks(it, t);
    complete({ ok: res.pass, text: t }, { ok: res.pass });
  }
  function startCountdown(total) {
    stopTimer(); const ends = Date.now() + total * 1000, btn = $('#mvTimer'); if (btn) btn.textContent = 'Restart timer';
    const tick = () => {
      const el = $('#mvClock'); if (!el || view !== 'moves') return stopTimer();
      const left = Math.max(0, Math.ceil((ends - Date.now()) / 1000)); el.textContent = clock(left); el.classList.toggle('over', left === 0);
      if (!left) { stopTimer(); el.textContent = 'Time'; nudge(`${total} seconds is up. Finish your sentence, then check.`); }
    };
    tick(); timer = setInterval(tick, 250);
  }

  /* ---------- Results ---------- */
  function finishSet() {
    lastSet = { move: run.move, items: run.items, results: run.results };
    run = null; persistRun(); renderResults(lastSet);
  }
  function reviewReason(it, r) {
    if (it.rung === 'spot') {
      if (it.move === 'number-sense') return it.why + (it.slip ? ' Slip: ' + SLIPS.find(s => s.id === it.slip).label + '.' : '');
      const j = L.judgeSpot(it, r.idx), list = optionsOf(it);
      return j.why + (r.ok ? '' : ' Right answer: ' + list[j.answer].text);
    }
    if (it.move === 'number-sense') return `You typed ${r.text}. The correct figure is ${figure(it.correct, it.unit)}. ${it.why}`;
    const res = textChecks(it, r.text), open = res.checks.filter(c => c.level !== 'ok').map(c => c.text);
    return (open.length ? 'To fix: ' + open.join(' ') : 'Every check passed.') + (r.grade ? ` You said yours was closest to the ${GRADES[r.grade].label.toLowerCase()} answer.` : '');
  }
  const itemName = it => ({ 'answer-first': it.question, 'so-what': it.title, 'split-it': it.question, 'one-question': it.brief, 'hold-or-change': it.push, 'put-a-number': it.line, 'next-line': it.topic })[it.move] || it.claim;
  /* Where a ready move should be used next, by the round it belongs to. */
  const USE = { case: ['mvCases', 'Use it in a full case →', () => casesPage()], interview: ['mvHr', 'Use it in an HR interview →', () => Behavioural.open()], gd: ['mvGd', 'Run a group discussion →', () => GDTool.open()] };
  function renderResults(set) {
    enter('#moves/' + set.move); screen = 'results';
    const spot = set.items.map((it, i) => ({ it, r: set.results[i] })).filter(x => x.it.rung === 'spot' && x.r), dos = set.items.map((it, i) => ({ it, r: set.results[i] })).filter(x => x.it.rung === 'do' && x.r);
    const s = L.status(history, set.move), need = needs(s), use = USE[groupOf(set.move)];
    $('#app').innerHTML = `<section class="mv-head"><div class="eyebrow">${esc(title(set.move).toUpperCase())} · SET COMPLETE</div><h1 class="drill-title">Spot: ${spot.filter(x => x.r.ok).length} of ${spot.length} right. <em>Do: ${dos.filter(x => x.r.ok).length} of ${dos.length} passed.</em></h1></section>
      <section class="panel mv-panel"><p class="mv-status ${s.state}" id="mvStatus"><span aria-hidden="true">${s.state === 'ready' ? '✓ ' : ''}</span>${esc(statusLine(set.move))}</p>
      ${s.state === 'ready' ? '<p>You have met the bar for this move. The test now is a full case or interview.</p>' : `<p>To be ready you still need ${need.join(' and ')}.</p>`}
      <h2 class="section-title">Every item</h2>${[...spot, ...dos].map(({ it, r }) => `<details class="drill-review ${r.ok ? 'ok' : 'miss'}"><summary><span>${r.ok ? '✓' : '✗'}</span> ${it.rung === 'spot' ? 'Spot' : 'Do'} · ${esc(itemName(it))}</summary><p>${esc(reviewReason(it, r))}</p></details>`).join('')}
      <div class="actions"><button class="primary" id="mvAgain">Another set →</button><button id="mvHub">All moves</button>${s.state === 'ready' && use ? `<button id="${use[0]}">${use[1]}</button>` : ''}<button class="wu-link" id="mvRule">See the rule again</button></div></section>`;
    $('#mvAgain').onclick = () => startSet(set.move);
    $('#mvHub').onclick = open;
    $('#mvRule').onclick = () => renderLearn(set.move);
    if (use && $('#' + use[0])) $('#' + use[0]).onclick = use[2];
  }

  /* ---------- A round: Attempt, leave or guess ---------- */
  const callOf = id => T.calls.find(c => c.id === id), levelName = id => id.charAt(0).toUpperCase() + id.slice(1);
  const topicName = q => AptitudeQuestions.topicOf(q.topic).title;
  const marksText = n => (n < 0 ? '−' : '') + Math.abs(n);
  const quarter = { 0.25: 'a quarter', 0.5: 'half', 1: 'a whole' };
  const roundTop = (label, extra) => `<div class="row mv-top"><div class="eyebrow">${esc(title('triage').toUpperCase())} · ${label}</div>
    <span class="mv-links"><button class="wu-link" id="mvExit">Leave the round</button></span></div>${extra || ''}`;
  const bindExit = () => { $('#mvExit').onclick = open; };
  /* The round's clock is run.used plus the time since the screen was drawn, so it only runs while a round screen is showing. */
  const usedNow = () => run.used + (Date.now() - clockAt) / 1000;
  const syncClock = () => { run.used = usedNow(); clockAt = Date.now(); };
  const limit = () => screen === 'sort' ? T.sortSeconds : T.sitSeconds;
  const startClock = () => { clockAt = Date.now(); lastSaved = Date.now(); stopTimer(); timer = setInterval(tick, 250); };
  function startRound(id, seed) {
    if (!seen.includes(id)) { seen.push(id); save(SEEN_KEY, seen); }
    renderBrief(isNum(seed) ? seed : null);
  }
  function renderBrief(seed) {
    enter('#moves/triage'); screen = 'brief'; briefSeed = seed;
    $('#app').innerHTML = `<section class="mv-head"><div class="eyebrow">BEFORE YOU START · ${move('triage').minutes} MIN</div><h1 class="drill-title">${esc(title('triage'))}</h1><p class="lead">${esc(move('triage').tagline)}</p></section>
      <section class="panel mv-panel" id="tgBrief"><h2 class="section-title">What will happen</h2><ol class="mv-rule">
        <li>You get ${T.sortSeconds} seconds to sort each of ${N} aptitude questions. You do not answer them yet.</li>
        <li>Then you get ${mmss(T.sitSeconds)} for all ${N}. That is not enough, so the order you choose matters.</li>
        <li>You get ${marksText(T.right)} mark for a right answer and lose ${quarter[Math.abs(T.wrong)] || Math.abs(T.wrong)} mark for a wrong one.</li></ol>
      <h3>The three calls</h3><ul class="tg-calls-list">${T.calls.map(c => `<li><b>${esc(c.label)}</b> ${esc(c.note)}</li>`).join('')}</ul>
      <div class="actions"><button class="primary" id="tgStart">Start sorting →</button><button id="mvHub">All moves</button><button class="wu-link" id="mvRule">See the rule again</button></div></section>`;
    $('#tgStart').onclick = beginRound; $('#mvHub').onclick = open; $('#mvRule').onclick = () => renderLearn('triage', briefSeed);
  }
  function beginRound() {
    const t = L.buildTriage({ seed: isNum(briefSeed) ? briefSeed : Date.now() });
    run = { move: 'triage', seed: t.seed, questions: t.questions, phase: 'sort', at: 0, calls: [], late: [], order: [], index: 0, answers: Array(N).fill(null), used: 0 };
    persistRun(); renderRound();
  }
  function renderRound() {
    if (!run) return open();
    enter('#moves/triage');
    if (run.phase === 'sit') renderSit(); else if (run.at >= N) renderSorted(); else renderSort();
    const h = $('#mvHead'); if (h) h.focus();
  }
  const progressBar = done => `<ol class="flow-progress" aria-hidden="true">${Array.from({ length: N }, (_, i) => `<li class="${i < done ? 'done' : i === done ? 'now' : ''}"></li>`).join('')}</ol>`;
  const promptHtml = q => `<div class="tg-q"><p class="tg-prompt">${esc(q.prompt)}</p></div>`;
  function renderSort() {
    screen = 'sort'; const q = run.questions[run.at];
    $('#app').innerHTML = `<section class="mv-screen tg-screen">${roundTop('SORT', progressBar(run.at))}<p class="tg-count">Question ${run.at + 1} of ${N}</p>
      <p class="mv-timer"><span id="tgClock" class="wu-clock" role="timer" aria-live="off">${mmss(Math.ceil(T.sortSeconds - run.used))}</span> <span class="note">to decide</span></p>
      ${promptHtml(q)}<ol class="tg-options" aria-label="Options, not clickable while you sort">${q.options.map((o, i) => `<li><span class="tg-letter" aria-hidden="true">${'ABCD'[i]}</span><span class="tg-text">${esc(o)}</span></li>`).join('')}</ol>
      <div class="tg-callbar"><h2 class="mv-prompt" id="mvHead" tabindex="-1">When would you do this one?</h2>
      <div class="tg-calls">${T.calls.map(c => `<button class="tg-call" id="tgCall-${c.id}"><b>${esc(c.label)}</b><span class="note">${esc(c.note)}</span></button>`).join('')}</div></div></section>`;
    bindExit(); T.calls.forEach(c => { $('#tgCall-' + c.id).onclick = () => fileCall(c.id, false); }); startClock();
  }
  /* A call moves straight on. When the time runs out the question is filed as Later and marked late. */
  function fileCall(call, late) {
    run.calls.push(call); run.late.push(late); run.at++; run.used = 0; persistRun(); renderRound();
  }
  function renderSorted() {
    screen = 'sorted'; stopTimer(); const n = id => run.calls.filter(c => c === id).length, late = run.late.filter(Boolean).length;
    $('#app').innerHTML = `<section class="mv-screen tg-screen">${roundTop('SORTED', progressBar(N))}<h2 class="mv-prompt" id="mvHead" tabindex="-1">All ${N} sorted.</h2>
      <p id="tgPiles">${T.calls.map(c => `${esc(c.label)}: <b>${n(c.id)}</b>`).join(' · ')}</p>
      ${late ? `<p class="note">${plural(late, 'question', 'questions')} went to Later because ${T.sortSeconds} seconds ran out.</p>` : ''}
      <p>You have ${mmss(T.sitSeconds)} for all ${N}, with the Do now questions first.</p>
      <div class="actions"><button class="primary" id="tgSit">Start the clock →</button></div></section>`;
    bindExit(); $('#tgSit').onclick = () => { run.phase = 'sit'; run.order = L.triageOrder(run.calls); run.index = 0; run.used = 0; persistRun(); renderRound(); };
  }
  const spent = () => run.answers.reduce((t, a) => t + (a ? a.seconds : 0), 0);
  function renderSit() {
    screen = 'sit'; picked = null; const qi = run.order[run.index], q = run.questions[qi], c = callOf(run.calls[qi]);
    $('#app').innerHTML = `<section class="mv-screen tg-screen">${roundTop('SIT', progressBar(run.index))}<p class="tg-count">Question ${run.index + 1} of ${N}</p>
      <p class="mv-timer"><span id="tgClock" class="wu-clock" role="timer" aria-live="off">${mmss(Math.ceil(T.sitSeconds - run.used))}</span> <span class="note">left for all ${N}</span></p>
      <p class="tg-call-label">Your call: <b>${esc(c.label)}</b></p>${promptHtml(q)}
      <h2 class="mv-prompt" id="mvHead" tabindex="-1">Choose an answer, or skip</h2>
      <div class="tg-options" role="radiogroup" aria-label="Options">${q.options.map((o, i) => `<button class="tg-opt" id="tgOpt-${i}" role="radio" aria-checked="false"><span class="tg-letter" aria-hidden="true">${'ABCD'[i]}</span><span class="tg-text">${esc(o)}</span></button>`).join('')}</div>
      <label class="selfcheck tg-guess"><input type="checkbox" id="tgGuess"> This is a guess</label><p class="note" id="tgHint" aria-live="polite"></p>
      <div class="actions"><button class="primary" id="tgAnswer">Answer →</button><button id="tgSkip">Skip</button></div></section>`;
    bindExit();
    q.options.forEach((_, i) => { $('#tgOpt-' + i).onclick = () => {
      picked = i; $('#tgHint').textContent = '';
      q.options.forEach((__, j) => { const b = $('#tgOpt-' + j); b.setAttribute('aria-checked', String(j === i)); b.classList.toggle('chosen-plain', j === i); });
    }; });
    $('#tgAnswer').onclick = () => sitAnswer(false); $('#tgSkip').onclick = () => sitAnswer(true); startClock();
  }
  function sitAnswer(skip) {
    if (usedNow() >= T.sitSeconds) return endSitting();
    if (!skip && picked === null) { $('#tgHint').textContent = 'Choose an option first, or skip this question.'; return; }
    syncClock();
    const qi = run.order[run.index], seconds = Math.max(0, Math.round((run.used - spent()) * 10) / 10);
    run.answers[qi] = skip ? { state: 'skipped', pick: null, guess: false, seconds } : { state: picked === run.questions[qi].answer ? 'right' : 'wrong', pick: picked, guess: $('#tgGuess').checked, seconds };
    run.index++;
    if (run.index >= N) return endSitting();
    persistRun(); renderRound();
  }
  const endSitting = () => finishRound();
  function tick() {
    if (!run || run.move !== 'triage' || view !== 'moves' || (screen !== 'sort' && screen !== 'sit')) return stopTimer();
    const used = usedNow(), left = limit() - used;
    if (left <= 0) return screen === 'sort' ? fileCall('later', true) : endSitting();
    const el = $('#tgClock'); if (el) { el.textContent = mmss(Math.ceil(left)); el.classList.toggle('over', screen === 'sit' && left <= 30); }
    if (Date.now() - lastSaved >= 1000) { syncClock(); lastSaved = Date.now(); persistRun(); }
  }
  /* The round is over: its calls go to the history once, and the saved round is cleared. */
  function finishRound() {
    stopTimer(); const done = run, d = L.triageDebrief(done);
    run = null; persistRun();
    history.push(...d.entries); history = L.cleanHistory(history); persistHistory();
    lastRound = { run: done, debrief: d }; renderDebrief(lastRound);
  }
  function renderDebrief({ run: r, debrief: d }) {
    enter('#moves/triage'); screen = 'debrief';
    const s = L.status(history, 'triage'), need = needs(s), pen = d.wrong * -T.wrong;
    const head = `${d.right} right, ${d.wrong} wrong: ${d.right} − ${pen} = ${marksText(d.marks)} ${d.marks === 1 ? 'mark' : 'marks'} of ${N * T.right}`;
    const row = x => {
      const q = r.questions[x.index], c = callOf(x.call), mark = x.verdict === 'good' ? '✓' : x.verdict === 'miss' ? '✗' : '–', word = x.verdict === 'good' ? 'Good call' : x.verdict === 'miss' ? 'Not a good call' : 'Not tested', a = r.answers[x.index];
      return `<li class="tg-row ${x.verdict || 'none'}"><div class="tg-rowhead"><span class="mv-mark" aria-hidden="true">${mark}</span><b>${word}</b><span class="note">Question ${x.index + 1} · ${esc(topicName(q))} · ${esc(levelName(q.level))}</span></div>
        <p class="tg-called">Called ${esc(c.label)}${x.late ? ` (no call in ${T.sortSeconds} seconds, so it was filed as Later)` : ''}${x.guess ? ' · marked as a guess' : ''}</p><p>${esc(x.line)}</p>
        <details><summary>Question, solution and shortcut</summary><p class="tg-prompt">${esc(q.prompt)}</p>
        <ol class="tg-review" type="A">${q.options.map((o, i) => `<li${i === q.answer ? ' class="tg-right"' : ''}>${esc(o)}${i === q.answer ? ' (right answer)' : ''}${a && a.pick === i ? ' (your pick)' : ''}</li>`).join('')}</ol>
        <ol class="drill-steps">${q.solution.map(t => `<li>${esc(t)}</li>`).join('')}</ol><p><b>Shortcut:</b> ${esc(q.shortcut)}</p></details></li>`;
    };
    const piles = { columns: ['Pile', 'Questions', 'Answered', 'Marks', 'Time spent'], rows: T.calls.map(c => [c.label, String(d.piles[c.id].count), String(d.piles[c.id].answered), marksText(d.piles[c.id].marks), mmss(d.piles[c.id].seconds)]) };
    $('#app').innerHTML = `<section class="mv-head"><div class="eyebrow">${esc(title('triage').toUpperCase())} · ROUND COMPLETE</div><h1 class="drill-title" id="tgHead">${esc(head)}</h1>
      <p class="note">${d.skipped ? plural(d.skipped, 'question', 'questions') + ' skipped. ' : ''}${d.unreached ? `The clock ran out with ${plural(d.unreached, 'question', 'questions')} not reached.` : ''}</p></section>
      <section class="panel mv-panel" id="tgDebrief"><h2 class="section-title">Your sorting</h2><ol class="tg-rows">${d.rows.map(row).join('')}</ol>
      <h2 class="section-title">Where your marks came from</h2>${tableHtml(piles, 'Marks by pile')}
      ${d.guesses.count ? `<section id="tgGuesses"><h2 class="section-title">Your guesses</h2><p>You marked ${plural(d.guesses.count, 'answer', 'answers')} as ${d.guesses.count === 1 ? 'a guess' : 'guesses'}: ${d.guesses.right} right, ${marksText(d.guesses.marks)} ${Math.abs(d.guesses.marks) === 1 ? 'mark' : 'marks'} in all.</p><p class="note">${esc(T.guess)}</p></section>` : ''}
      <p class="tg-takeaway" id="tgTakeaway"><b>${esc(d.takeaway)}</b></p>
      <p class="tg-pass ${d.pass ? 'ok' : 'miss'}" id="tgPass"><span aria-hidden="true">${d.pass ? '✓' : '✗'}</span> <b>${d.pass ? 'This round passed.' : 'This round did not pass.'}</b> ${esc(T.pass)}</p>
      <p class="mv-status ${s.state}" id="mvStatus"><span aria-hidden="true">${s.state === 'ready' ? '✓ ' : ''}</span>${esc(statusLine('triage'))}</p>
      ${s.state === 'ready' ? '<p>You have met the bar for this move. The test now is a full timed test.</p>' : `<p>To be ready you still need ${need.join(' and ')}.</p>`}
      <div class="actions"><button class="primary" id="mvAgain">Another round →</button><button id="mvHub">All moves</button>${s.state === 'ready' ? '<button id="tgTest">Use it in a timed test →</button>' : ''}<button class="wu-link" id="mvRule">See the rule again</button></div></section>`;
    $('#mvAgain').onclick = () => startRound('triage'); $('#mvHub').onclick = open; $('#mvRule').onclick = () => renderLearn('triage');
    if ($('#tgTest')) $('#tgTest').onclick = () => Aptitude.open();
    const h = $('#tgHead'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
  }

  /* ---------- The debriefs: did the trained moves show up? ---------- */
  const readyIn = place => Object.keys(TRANSFER_Q[place]).filter(id => L.status(history, id).state === 'ready');
  /* Ticks are kept under one key per debrief. Each checkbox saves as it changes. */
  function bindTicks(root, key) {
    root.querySelectorAll('[data-transfer]').forEach(c => c.onchange = () => {
      const set = new Set(transfer[key] || []); if (c.checked) set.add(c.dataset.transfer); else set.delete(c.dataset.transfer);
      transfer[key] = [...set]; transfer = cleanTransfer(transfer); save(TRANSFER_KEY, transfer);
    });
  }
  const ticksHtml = (place, ready, key) => ready.map(id => `<label class="selfcheck"><input type="checkbox" data-transfer="${id}" ${(transfer[key] || []).includes(id) ? 'checked' : ''}> ${esc(TRANSFER_Q[place][id])}</label>`).join('');
  function addTransfer(s) {
    const old = $('#movesTransfer'); if (old) old.remove();
    const ready = readyIn('case'), key = String(s.finished);
    const sec = document.createElement('section'); sec.id = 'movesTransfer'; sec.className = 'mv-transfer';
    if (ready.length) sec.innerHTML = `<h3>Moves you have trained</h3>${ticksHtml('case', ready, key)}<p class="note">This is your own judgement, not a score.</p>`;
    else sec.innerHTML = `<h3>Moves</h3><p>Train one move in five minutes before your next case.</p><button id="movesFromReport">Choose a move →</button>`;
    const last = [...document.querySelectorAll('[data-self]')].pop(), anchor = last && last.closest('label'), panel = $('#app .panel');
    if (anchor) anchor.after(sec); else if (panel) panel.append(sec); else return;
    bindTicks(sec, key);
    if ($('#movesFromReport')) $('#movesFromReport').onclick = open;
  }
  /* The HR, defence and group discussion debriefs call this once their screen is drawn. `key` names the session, so ticks come back with it. */
  function afterDebrief(place, key) {
    const old = $('#movesDebrief'); if (old) old.remove();
    if (!TRANSFER_Q[place] || place === 'case') return;
    const ready = readyIn(place); if (!ready.length) return;
    const k = `${place}:${key}`.slice(0, MAX_KEY);
    const sec = document.createElement('section'); sec.id = 'movesDebrief'; sec.className = 'mv-transfer';
    sec.innerHTML = `<h3>Moves you have trained</h3>${ticksHtml(place, ready, k)}<p class="note">This is your own judgement, not a score.</p>`;
    const bars = document.querySelectorAll('#app .flow-bar'), bar = bars[bars.length - 1], first = $('#app section');
    if (bar) bar.before(sec); else if (first) first.append(sec); else return;
    bindTicks(sec, k);
  }

  /* ---------- Integration with the rest of Case Room ---------- */
  const priorReport = showReport;
  showReport = function (s) { priorReport(s); addTransfer(s); };
  const priorHome = home;
  home = function () { stopTimer(); priorHome(); if (location.hash.startsWith('#moves')) setHash(''); };

  /** Continues a set or round in progress (from the home page's "Continue" list); with none, opens the hub. */
  function resume() { if (!run) return open(); if (run.move === 'triage') renderRound(); else renderItem(); }
  /** What is in progress, for the home page's "Continue" list: { title, detail }, or null. */
  function progress() {
    if (!run) return null;
    if (run.move === 'triage') return { title: title('triage'), detail: run.phase === 'sit' ? `Question ${run.index + 1} of ${N} in the sitting` : run.at >= N ? 'Sorted, ready to start the clock' : `Sorting question ${run.at + 1} of ${N}` };
    return { title: title(run.move), detail: `Item ${run.index + 1} of ${run.items.length}` };
  }

  /* ---------- A timed aptitude test: one self-check line when Attempt, leave or guess is ready ---------- */
  function afterAptitudeResults(res) {
    if (!res || res.mode !== 'test' || L.status(history, 'triage').state !== 'ready' || $('#movesAptitude')) return;
    const sec = document.createElement('section'); sec.id = 'movesAptitude'; sec.className = 'mv-transfer';
    sec.innerHTML = `<label class="selfcheck"><input type="checkbox" id="movesAptitudeCheck"> You trained ${esc(title('triage'))}. Did you take the quick questions first?</label><p class="note">This is your own judgement, not a score.</p>`;
    const again = $('#aptAgain'), actions = again && again.closest('.actions');
    if (actions) actions.before(sec); else $('#app').append(sec);
  }

  window.MovesTool = { open, openMove, resume, progress, tick, afterAptitudeResults, afterDebrief, statusLine, state: () => ({ run, history, seen, transfer, screen, lastSet, lastRound }) };
})();
