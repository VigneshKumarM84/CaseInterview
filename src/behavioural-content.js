/* Behavioural (HR) interview practice: original question bank and the answer heuristics.
   No DOM access, so Node tests load this file directly. Nothing here is AI: every check is a
   word count, a word list or a share of tagged words, and the UI says so. */
(function (root) {
  /* Answer structures. STAR for stories; two simpler shapes for the questions that are not stories. */
  const FRAMES = {
    star: { id: 'star', title: 'STAR', parts: [
      { id: 's', short: 'S', label: 'Situation', hint: 'Where and when. Two or three sentences of context.' },
      { id: 't', short: 'T', label: 'Task', hint: 'What you were responsible for, or the goal.' },
      { id: 'a', short: 'A', label: 'Action', hint: 'What you did, step by step. Usually the biggest part.' },
      { id: 'r', short: 'R', label: 'Result', hint: 'What changed because of it. A number if you have one, and what you learned.' }] },
    ppf: { id: 'ppf', title: 'Present · Past · Future', parts: [
      { id: 'present', short: 'Now', label: 'Present', hint: 'Who you are now: degree, focus, what you are working on.' },
      { id: 'past', short: 'Past', label: 'Past', hint: 'Two or three highlights that led here, each with a concrete detail.' },
      { id: 'future', short: 'Next', label: 'Future', hint: 'Where you are heading and why this role is the next step.' }] },
    fit: { id: 'fit', title: 'Them · Role · You', parts: [
      { id: 'them', short: 'Them', label: 'Why this company', hint: 'Something specific about the company, not general praise.' },
      { id: 'role', short: 'Role', label: 'Why this role', hint: 'The day-to-day work and why it suits you.' },
      { id: 'you', short: 'You', label: 'Why you fit', hint: 'Evidence from what you have done that you will do the job well.' }] }
  };

  const GENERAL_PROBES = ['What exactly did you do, as opposed to the rest of the team?', 'How did you know it worked? What changed as a result?', 'Looking back, what would you do differently?'];

  /* Original questions written for Case Room, aimed at campus placements and early-career roles. */
  const COMPETENCIES = [
    { id: 'intro', title: 'Tell me about yourself', short: 'Your opening pitch', frame: 'ppf', target: [60, 120],
      tip: 'Open with who you are now, pick two or three highlights that matter for this role, and finish with why you are here today.',
      questions: ['Tell me about yourself.', 'Walk me through your CV in two minutes.', 'Introduce yourself the way you would to a new manager on your first day.', 'What should we know about you that is not on your CV?', 'Describe yourself in three words, and give an example for one of them.', 'Tell me about your journey so far and what brings you to this interview.', 'How would your closest friend or teammate describe you, and would they be right?'],
      listenFor: ['Opens with who they are now in one or two sentences', 'Picks two or three highlights relevant to the role instead of reading the whole CV', 'Each highlight has a concrete detail or result', 'Ends with why this role, and why now', 'Sounds conversational, not memorised, and stays under two minutes'],
      probes: ['Which of those experiences taught you the most, and why?', 'What is something you are working on getting better at right now?'] },
    { id: 'motivation', title: 'Why this company or role', short: 'Motivation and fit', frame: 'fit', target: [45, 90],
      tip: 'Name something specific about the company, connect the day-to-day work to something you have done, and say why you will be good at it.',
      questions: ['Why do you want to work here?', 'Why this role rather than another one in the same company?', 'What do you know about what we do, and which part interests you most?', 'Where do you see yourself in five years, and how does this role fit into that?', 'Why should we hire you over other candidates from your campus?', 'If you had an offer from a bigger brand as well as from us, why might you choose us?', 'What would make you leave a job in your first year?', 'What are you looking for in your first job?'],
      listenFor: ['Names something specific about the company (a product, a client, a way of working), not website praise', 'Links the day-to-day work of the role to something they have actually done or enjoyed', 'Gives reasons about the work, not only salary, brand or location', 'Describes a believable next step in their career', 'Honest and direct, without flattery'],
      probes: ['What would you want to have learned after your first year here?', 'What do you think will be hardest about this role for you?'] },
    { id: 'leadership', title: 'Leadership', short: 'Setting direction, bringing people along', frame: 'star', target: [90, 120],
      tip: 'Leadership answers need a goal, the people you had to bring along, and what you personally did to move them.',
      questions: ['Tell me about a time you led a group without having any formal authority.', 'Describe a time you had to motivate people who had lost interest in a project.', 'Tell me about a time you took charge when something was going wrong.', 'Give an example of a decision you made that not everyone on your team agreed with.', 'Tell me about a time you had to delegate work. How did you decide who did what?', 'Describe a time you organised an event, club activity or project from scratch.', 'Tell me about a time you helped someone on your team improve.', 'Tell me about a time you had to lead people who were more experienced than you.'],
      listenFor: ['A clear goal and why it mattered', 'Specific things they did to set direction, divide work or unblock people', 'How they brought others along by listening or persuading, not just giving orders', 'A visible or measurable outcome', 'What they would do differently as a leader'],
      probes: ['Who disagreed with you, and how did you handle them?', 'What would the team say you could have done better?'] },
    { id: 'teamwork', title: 'Teamwork', short: 'Working with and through others', frame: 'star', target: [90, 120],
      tip: 'Make your own contribution clear with "I", while showing how you worked with the others and giving them credit.',
      questions: ['Tell me about a successful team project and your specific contribution to it.', 'Describe a time a teammate was not pulling their weight. What did you do?', 'Tell me about a time you had to work closely with someone very different from you.', "Give an example of a time you put the team's goal ahead of your own preference.", 'Tell me about a time you joined a team midway through a project.', 'Describe a group assignment that went badly. What was your part in it?', 'Tell me about a time you helped a teammate who was struggling.'],
      listenFor: ['Separates their own contribution from the team\'s', 'Shows how they communicated and coordinated, such as regular check-ins or dividing tasks', 'Credits others fairly', 'Deals with a difficult teammate with empathy before escalating', 'An outcome for the team, and a lesson about working with others'],
      probes: ['How did you decide who did what?', 'What did you learn about yourself as a teammate?'] },
    { id: 'conflict', title: 'Conflict', short: 'Disagreeing well', frame: 'star', target: [90, 120],
      tip: 'Describe the other side fairly, keep the focus on the issue, and show how the relationship ended up.',
      questions: ['Tell me about a time you disagreed with a teammate. How did you resolve it?', 'Describe a time you disagreed with a professor, manager or senior. What did you do?', 'Tell me about a time you received criticism you thought was unfair.', 'Give an example of a time you had to say no to someone.', 'Tell me about a time two people on your team were in conflict and you stepped in.', 'Describe a time you had to deliver bad news to someone.', 'Tell me about a time you changed your mind after an argument.'],
      listenFor: ['Describes the disagreement fairly, including the other person\'s view', 'Focuses on the issue, not the person', 'Specific steps to resolve it: a conversation, data, a compromise', 'The working relationship afterwards', 'Self-awareness about their own part in the conflict'],
      probes: ['What was the other person\'s strongest point?', 'If it happened again tomorrow, what would you do first?'] },
    { id: 'failure', title: 'Failure or mistake', short: 'Ownership and learning', frame: 'star', target: [90, 120], lesson: true,
      tip: 'Pick a real failure, own it without blaming others, and spend real time on what you learned and do differently now.',
      questions: ['Tell me about a time you failed.', 'Describe a mistake you made and how you fixed it.', 'Tell me about a goal you set for yourself that you did not achieve.', 'Tell me about a time you missed a deadline.', 'What is a piece of feedback that changed how you work?', 'Describe a project you would do very differently if you started it again.', 'Tell me about a time you underestimated how hard something would be.', 'What is your biggest weakness, and what are you doing about it?'],
      listenFor: ['A real failure with real stakes, not a disguised strength', 'Takes ownership without blaming others or circumstances', 'What they did straight away to limit the damage', 'A specific lesson, not "I learned to work harder"', 'Evidence the lesson stuck: something they now do differently, with an example'],
      probes: ['How did the people affected react?', 'When did you last use what you learned?'] },
    { id: 'pressure', title: 'Handling pressure', short: 'Deadlines, stress and setbacks', frame: 'star', target: [90, 120],
      tip: 'Show how you prioritised and who you kept informed. Calm comes across through concrete steps, not adjectives.',
      questions: ['Tell me about a time you had several deadlines at once. How did you prioritise?', 'Describe the most stressful situation you have faced in college or an internship.', 'Tell me about a time a plan fell apart at the last minute.', 'Give an example of working with very little time and incomplete information.', 'Tell me about a time you had to learn something new very quickly.', 'Describe a time you stayed calm when the people around you did not.', 'Tell me about a time you had to balance your studies with another big commitment.'],
      listenFor: ['How they prioritised, with a reason (deadline, impact or effort)', 'Concrete steps: breaking the work down, asking for help, speaking up early', 'Keeps others informed instead of going silent', 'The result, including any trade-off they accepted', 'What they would start earlier next time'],
      probes: ['What did you decide not to do?', 'How do you know when you are taking on too much?'] },
    { id: 'initiative', title: 'Initiative', short: 'Spotting and starting things', frame: 'star', target: [90, 120],
      tip: 'Make it clear nobody asked you to do it, explain why it mattered, and finish with what changed.',
      questions: ['Tell me about a time you went beyond what was asked of you.', 'Describe something you started on your own, outside your coursework.', 'Tell me about a time you spotted a problem nobody had asked you to fix.', 'Give an example of a process you made faster or simpler.', 'Tell me about a time you taught yourself a skill to get something done.', 'Describe a time you suggested an idea that was adopted.', 'Tell me about a time you asked for more responsibility.'],
      listenFor: ['They noticed the opportunity themselves, without being told', 'Why it mattered: the problem it solved or the gain', 'Persuaded others or got permission where needed', 'Followed through to a finished result', 'Impact quantified where possible: time saved, people reached, money raised'],
      probes: ['Who did you need to convince, and how?', 'Is it still being used now that you have moved on?'] },
    { id: 'ethics', title: 'Ethics and integrity', short: 'Doing the right thing', frame: 'star', target: [90, 120],
      tip: 'Name the issue plainly, show what you did about it and what it cost you, and say whether you would do the same again.',
      questions: ['Tell me about a time you saw someone do something you thought was wrong.', 'Describe a time you were tempted to cut a corner. What did you do?', 'Tell me about a time you admitted a mistake that nobody else had noticed.', 'The night before a submission, you find a teammate has copied part of your group report from the internet. What do you do?', 'Tell me about a time you were asked to do something you were not comfortable with.', 'Describe a time when being honest cost you something.', 'A client asks you to show a number in a way that makes it look better than it is. How do you respond?'],
      hypothetical: [3, 6],
      listenFor: ['Recognises the ethical issue clearly and quickly', 'Acts on it in proportion: speaks up, refuses or escalates', 'Treats people with respect while doing so, for example a private conversation first', 'Accepts a personal cost where needed', 'Would make the same call again, and explains why'],
      probes: ['What if your manager had told you to go ahead anyway?', 'How did the other person react?'] }
  ];
  COMPETENCIES.forEach(c => { c.questions = c.questions.map((text, i) => ({ id: `${c.id}-${i + 1}`, text, hypothetical: (c.hypothetical || []).includes(i) })); });
  const IDS = COMPETENCIES.map(c => c.id), STORY_IDS = COMPETENCIES.filter(c => c.frame === 'star').map(c => c.id);
  const competency = id => COMPETENCIES.find(c => c.id === id);
  const findQuestion = id => { for (const c of COMPETENCIES) { const q = c.questions.find(q => q.id === id); if (q) return { competency: c.id, ...q }; } return null; };

  /* Pick a question for a competency (or "mixed"), avoiding recently practised ones while any are left. */
  function pickQuestion(mode, recent = [], rand = Math.random) {
    const pool = (mode === 'mixed' ? COMPETENCIES : [competency(mode) || COMPETENCIES[0]]).flatMap(c => c.questions.map(q => ({ competency: c.id, ...q })));
    const fresh = pool.filter(q => !recent.includes(q.id)), from = fresh.length ? fresh : pool;
    return from[Math.min(from.length - 1, Math.floor(rand() * from.length))];
  }

  /* ---------- Text heuristics ---------- */
  const SPEAKING_WPM = 140;
  const tokens = text => String(text || '').toLowerCase().replace(/[’‘]/g, "'").match(/[a-z0-9]+(?:'[a-z]+)?/g) || [];
  const wordCount = text => tokens(text).length;
  const estSeconds = words => Math.round(words / SPEAKING_WPM * 60);

  const FILLER_LABELS = ['um', 'uh', 'like', 'basically', 'actually', 'you know', 'kind of', 'sort of', 'literally', 'i mean'];
  const SINGLE = { um: 'um', umm: 'um', ummm: 'um', erm: 'um', uh: 'uh', uhh: 'uh', uhm: 'uh', er: 'uh', basically: 'basically', actually: 'actually', literally: 'literally' };
  /* "like" after these words is usually a verb or a comparison ("I like", "felt like"), so it is not counted. */
  const LIKE_OK = new Set(['i', 'we', 'you', 'they', 'he', 'she', 'people', 'would', "i'd", "we'd", "you'd", "they'd", "don't", "didn't", "doesn't", 'do', 'does', 'did', 'really', 'also', 'feel', 'felt', 'feels', 'look', 'looks', 'looked', 'seem', 'seems', 'seemed', 'sound', 'sounds', 'sounded', 'something', 'anything', 'nothing', 'more', 'most', 'much', 'just', 'not']);
  /* "what kind of", "this sort of": a real noun phrase, not a hedge. */
  const KIND_OK = new Set(['what', 'this', 'that', 'the', 'a', 'any', 'some', 'every', 'which', 'same', 'one', 'these', 'those', 'different', 'right', 'other', 'many', 'all']);
  function fillers(text) {
    const w = tokens(text), counts = {};
    const add = k => { counts[k] = (counts[k] || 0) + 1; };
    for (let i = 0; i < w.length; i++) {
      const prev = w[i - 1], next = w[i + 1];
      if (SINGLE[w[i]]) add(SINGLE[w[i]]);
      else if (w[i] === 'like' && !LIKE_OK.has(prev) && next !== 'to') add('like');
      else if (w[i] === 'you' && next === 'know' && !['do', 'did', 'if', 'as', "don't", 'would'].includes(prev) && !['how', 'what', 'that', 'why', 'where', 'when', 'who', 'about', 'the', 'it', 'him', 'her', 'them'].includes(w[i + 2])) { add('you know'); i++; }
      else if ((w[i] === 'kind' || w[i] === 'sort') && next === 'of' && !KIND_OK.has(prev)) { add(w[i] + ' of'); i++; }
      else if (w[i] === 'i' && next === 'mean' && !['what', 'do'].includes(prev) && w[i + 2] !== 'to') { add('i mean'); i++; }
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0), words = w.length;
    return { total, counts, per100: words ? Math.round(total / words * 1000) / 10 : 0 };
  }

  const I_WORDS = new Set(['i', 'me', 'my', 'mine', 'myself', "i'm", "i've", "i'd", "i'll"]);
  const WE_WORDS = new Set(['we', 'us', 'our', 'ours', 'ourselves', "we're", "we've", "we'd", "we'll"]);
  function pronouns(text) {
    let i = 0, we = 0; for (const t of tokens(text)) { if (I_WORDS.has(t)) i++; else if (WE_WORDS.has(t)) we++; }
    return { i, we, iShare: i + we ? Math.round(i / (i + we) * 100) : null };
  }

  const NUMBER = /\d|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|hundreds|thousand|thousands|lakh|lakhs|crore|crores|million|percent|per cent|half|double|doubled|twice|triple|tripled|halved)\b/i;
  const OUTCOME = /\b(?:won|win|increas|reduc|sav|grew|grow|improv|rais|cut|finish|deliver|launch|complet|achiev|select|placed|rank|adopt|approv|recover|resolv|publish|hired|promot|passed|clear|scor|award|exceed|beat|got|receiv|succeed|success|went live|on time|signed|agreed)/i;
  const LESSON = /\b(?:learn|learnt|learned|lesson|realis|realiz|now i|since then|next time|differently|taught me|changed how|these days|ever since|i now|always now)/i;
  const hasNumber = text => NUMBER.test(String(text || ''));
  const hasOutcome = text => OUTCOME.test(String(text || ''));
  const hasLesson = text => LESSON.test(String(text || ''));

  /* Split an answer into taggable pieces. Dictation often has no full stops, so long stretches are
     cut into chunks of roughly 12–28 words, preferring to break before a linking word. */
  const LINKS = new Set(['so', 'then', 'but', 'because', 'after', 'when', 'which', 'finally', 'eventually', 'while', 'since', 'until', 'once', 'however', 'afterwards', 'later']);
  function segments(text) {
    const parts = String(text || '').replace(/([.!?])\s+/g, '$1\n').split(/\n+/).map(s => s.trim()).filter(s => tokens(s).length);
    const out = [];
    for (const p of parts) {
      const w = p.split(/\s+/); let start = 0;
      while (w.length - start > 35) {
        const clean = i => w[i].toLowerCase().replace(/[^a-z']/g, '');
        let cut = -1;
        for (const set of [LINKS, new Set(['and'])]) { for (let i = start + 12; i <= Math.min(start + 28, w.length - 8); i++) if (set.has(clean(i))) { cut = i; break; } if (cut > 0) break; }
        if (cut < 0) cut = start + 20;
        out.push(w.slice(start, cut).join(' ')); start = cut;
      }
      out.push(w.slice(start).join(' '));
    }
    return out;
  }

  const pct = (n, d) => d ? Math.round(n / d * 100) : 0;
  /* Shares and rule-of-thumb checks for one answer. texts maps part id → the words tagged with it. */
  function structure(texts, frameId = 'star', opts = {}) {
    const frame = FRAMES[frameId] || FRAMES.star, comp = competency(opts.competency);
    const parts = frame.parts.map(p => ({ ...p, text: String(texts?.[p.id] || '').trim(), words: wordCount(texts?.[p.id]) }));
    const total = parts.reduce((a, p) => a + p.words, 0), untagged = Math.max(0, opts.untagged || 0);
    parts.forEach(p => { p.share = pct(p.words, total); });
    const checks = [], by = id => parts.find(p => p.id === id), add = (level, text) => checks.push({ level, text });
    if (!total) return { frame: frame.id, parts, total, untagged, untaggedShare: untagged ? 100 : 0, tagged: false, checks };
    const untaggedShare = pct(untagged, total + untagged);
    for (const p of parts) if (!p.words) add('missing', `No ${p.label} yet. ${p.hint}`);
    if (untaggedShare > 25) add('warn', `${untaggedShare}% of your words are not tagged, so these shares may not reflect the whole answer.`);
    if (frame.id === 'star') {
      const s = by('s'), t = by('t'), a = by('a'), r = by('r'), setup = s.share + t.share;
      if (setup > 35) add('warn', `Situation and Task take ${setup}% of the answer. Interviewers usually want the context in two or three sentences; aim for about a third or less.`);
      else if (s.words || t.words) add('ok', `Set-up (Situation + Task) is ${setup}%, short enough to leave room for what you did.`);
      if (a.words) {
        const biggest = Math.max(...parts.map(p => p.words));
        if (a.words < biggest) add('warn', `Action is ${a.share}% but is not the largest part. It is the part that shows what you did, so it usually should be.`);
        else if (a.share < 35) add('warn', `Action is the largest part but only ${a.share}%. Add the specific steps you took.`);
        else add('ok', `Action is the largest part (${a.share}%).`);
        const ap = pronouns(a.text);
        if (ap.we > ap.i) add('warn', `Your Action part says "we" ${ap.we} times and "I" ${ap.i} times. Interviewers may not be able to tell what you did yourself.`);
      }
      if (r.words) {
        if (r.share < 10) add('warn', `Result is only ${r.share}% of the answer. Give it at least a couple of sentences.`);
        if (hasNumber(r.text)) add('ok', 'Your Result includes a number or a measure.');
        else if (hasOutcome(r.text)) add('warn', 'Your Result describes an outcome. Can you put a number on it (time saved, people reached, marks, money)?');
        else add('warn', 'Your Result does not state a clear outcome yet. Say what changed.');
      }
      if (comp?.lesson) { if (hasLesson(r.text || '')) add('ok', 'You say what you learned.'); else add('warn', 'For this question, say what you learned and what you do differently now. Interviewers listen for that more than the failure itself.'); }
    } else if (frame.id === 'ppf') {
      const present = by('present');
      if (present.share > 50) add('warn', `Present takes ${present.share}%. Keep it to a sentence or two and spend the time on your highlights.`);
      const order = (opts.order || []).filter(Boolean);
      if (order.length) { if (order[order.length - 1] === 'future') add('ok', 'You finish on where you are heading, which leads naturally into the interview.'); else add('warn', 'End with the Future part: where you are heading and why this role is the next step.'); }
    } else if (frame.id === 'fit') {
      const them = by('them');
      if (them.words && them.words < 15) add('warn', 'Your "why this company" part is short. Name something specific: a product, a client, a way of working.');
      if (by('you').words) add('ok', 'You give evidence for why you fit, not only why you want the job.');
    }
    return { frame: frame.id, parts, total, untagged, untaggedShare, tagged: true, checks };
  }

  /* Tags map a segment's exact text to a part id, so editing the transcript keeps the tags of unchanged segments. */
  function tagged(text, tags, frameId, competencyId) {
    const segs = segments(text), frame = FRAMES[frameId] || FRAMES.star, texts = {}, order = [];
    let untagged = 0;
    for (const s of segs) { const part = tags && frame.parts.some(p => p.id === tags[s]) ? tags[s] : null; if (part) { texts[part] = (texts[part] ? texts[part] + ' ' : '') + s; if (order[order.length - 1] !== part) order.push(part); } else untagged += wordCount(s); }
    return { segments: segs, ...structure(texts, frame.id, { untagged, order, competency: competencyId }) };
  }

  function timeCheck(seconds, target) {
    const [lo, hi] = target;
    if (seconds < lo * 0.75) return { level: 'warn', text: `About ${seconds}s is short for this question (aim for ${lo}–${hi}s). You may be leaving out the detail that makes it believable.` };
    if (seconds > hi * 1.15) return { level: 'warn', text: `About ${seconds}s is long for this question (aim for ${lo}–${hi}s). Trim the set-up first.` };
    return { level: 'ok', text: `About ${seconds}s is within a sensible range for this question (${lo}–${hi}s).` };
  }

  /* ---------- Delivery: hedging, softeners, repeated openings, sentence length and pauses ---------- */
  const HEDGES = ['i think', 'i guess', 'i suppose', 'i feel like', 'maybe', 'perhaps', 'probably', 'not sure', 'more or less', 'somewhat', 'i would say', "i'd say", 'to some extent', 'hopefully'].map(p => p.split(' '));
  const SOFTENERS = ['just', 'really', 'very', 'quite', 'totally', 'a bit', 'a little bit'].map(p => p.split(' '));
  /* Longest phrase first, so "a little bit" is not also counted as something shorter. */
  function phrases(text, list) {
    const w = tokens(text), counts = {}, sorted = list.slice().sort((a, b) => b.length - a.length);
    for (let i = 0; i < w.length; i++) {
      const hit = sorted.find(p => p.every((x, k) => w[i + k] === x));
      if (hit) { const k = hit.join(' '); counts[k] = (counts[k] || 0) + 1; i += hit.length - 1; }
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { total, counts, per100: w.length ? Math.round(total / w.length * 1000) / 10 : 0 };
  }
  const listCounts = counts => Object.entries(counts).sort((x, y) => y[1] - x[1]).map(([k, n]) => `“${k}” ×${n}`).join(', ');
  const PAUSE_MS = 3000;
  /* Called each time dictation hears something. Gaps of PAUSE_MS or more between results count as long pauses.
     Call with start: true when dictation (re)starts, so time spent stopped is not counted. */
  function notePause(p, now, start = false) {
    const out = { count: p?.count || 0, longest: p?.longest || 0, last: start ? null : p?.last ?? null };
    if (!start && out.last != null && now - out.last >= PAUSE_MS) { out.count++; out.longest = Math.max(out.longest, Math.round((now - out.last) / 100) / 10); }
    if (!start) out.last = now;
    return out;
  }
  function delivery(text, opts = {}) {
    const words = wordCount(text), checks = [], hedges = phrases(text, HEDGES), softeners = phrases(text, SOFTENERS);
    if (!words) return { hedges, softeners, openers: null, sentences: null, pauses: null, chains: 0, checks };
    checks.push(hedges.total ? { level: hedges.per100 > 2 ? 'warn' : 'ok', text: `Hedging: ${listCounts(hedges.counts)}.${hedges.per100 > 2 ? ' This much hedging can sound unsure. State the point, then add a reason.' : ''}` }
      : { level: 'ok', text: 'No hedging phrases such as “I think” or “maybe”.' });
    if (softeners.per100 > 3) checks.push({ level: 'warn', text: `Softeners and intensifiers: ${listCounts(softeners.counts)}. Cut most of them; a specific detail is stronger than “really” or “very”.` });
    const segs = segments(text), starts = {};
    for (const s of segs) { const t = tokens(s); if (!t.length) continue; const k = ['and', 'so', 'then', 'but'].includes(t[0]) && t[1] && ['then', 'so', 'i', 'we'].includes(t[1]) ? t[0] + ' ' + t[1] : t[0]; starts[k] = (starts[k] || 0) + 1; }
    const top = Object.entries(starts).sort((a, b) => b[1] - a[1])[0], openers = top ? { word: top[0], count: top[1], of: segs.length } : null;
    if (openers && segs.length >= 4 && openers.count >= 3 && openers.count / segs.length >= 0.4) checks.push({ level: 'warn', text: `${openers.count} of your ${segs.length} sentences start with “${openers.word}”. Vary how you begin, or drop the linking word.` });
    const w = tokens(text); let chains = 0; for (let i = 0; i < w.length - 1; i++) if (w[i] === 'and' && w[i + 1] === 'then') chains++;
    if (chains >= 3) checks.push({ level: 'warn', text: `“And then” appears ${chains} times. A list of events hides what mattered; say why each step happened.` });
    const marks = (String(text).match(/[.!?](\s|$)/g) || []).length;
    let sentences = null;
    if (marks >= 2) {
      const lens = String(text).split(/[.!?]+(?:\s+|$)/).map(wordCount).filter(Boolean);
      sentences = { count: lens.length, average: Math.round(lens.reduce((a, b) => a + b, 0) / lens.length), longest: Math.max(...lens) };
      checks.push(sentences.average > 25 || sentences.longest > 40 ? { level: 'warn', text: `Sentences average ${sentences.average} words and the longest has ${sentences.longest}. Long sentences are hard to follow out loud; split them.` }
        : { level: 'ok', text: `Sentences average ${sentences.average} words, easy to follow.` });
    }
    const pauses = opts.pauses && Number.isFinite(opts.pauses.count) ? { count: opts.pauses.count, longest: opts.pauses.longest || 0 } : null;
    if (pauses) checks.push(pauses.count >= 3 || pauses.longest >= 6 ? { level: 'warn', text: `${pauses.count} long pause${pauses.count === 1 ? '' : 's'} (3 seconds or more) while dictating${pauses.longest ? `; the longest was about ${pauses.longest}s` : ''}. A short pause is fine; long ones suggest you had not planned the next part.` }
      : { level: 'ok', text: pauses.count ? `${pauses.count} long pause${pauses.count === 1 ? '' : 's'} while dictating, which is fine.` : 'No long pauses while dictating.' });
    return { hedges, softeners, openers, sentences, pauses, chains, checks };
  }

  /* ---------- Delivery goals and trends ---------- */
  const GOALS = [
    { id: 'fillers', label: 'Filler words', unit: 'per 100 words', options: [1, 2, 3, 5], dflt: 3, value: r => r.fillers.per100 },
    { id: 'hedges', label: 'Hedging phrases', unit: 'per 100 words', options: [0.5, 1, 2, 3], dflt: 2, value: r => r.delivery.hedges.per100 },
    { id: 'pauses', label: 'Long pauses', unit: 'pauses of 3 s or more', options: [0, 1, 2, 3], dflt: 2, value: r => r.delivery.pauses ? r.delivery.pauses.count : null },
    { id: 'pace', label: 'Speaking pace', unit: 'words a minute, 120–160', range: [120, 160], value: r => r.pace ? r.pace.wpm : null },
    { id: 'time', label: 'Answer length', unit: 'within the target time', value: r => r.time.level === 'ok' ? 1 : 0 }
  ];
  const goalOf = id => GOALS.find(g => g.id === id);
  /* goals maps a goal id to its limit (a number), true for pace and time, or null when switched off. */
  function cleanGoals(v) {
    const out = {}, src = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    for (const g of GOALS) {
      if (g.options) out[g.id] = src[g.id] === null ? null : g.options.includes(src[g.id]) ? src[g.id] : g.dflt;
      else out[g.id] = src[g.id] === false || src[g.id] === null ? null : true;
    }
    return out;
  }
  const goalMet = (g, limit, value) => value == null || limit == null ? null : g.range ? value >= g.range[0] && value <= g.range[1] : g.id === 'time' ? value === 1 : value <= limit;
  function goalChecks(r, goals) {
    const gs = cleanGoals(goals);
    return GOALS.filter(g => gs[g.id] != null).map(g => {
      const value = g.value(r), met = goalMet(g, gs[g.id], value);
      const target = g.range ? `${g.range[0]}–${g.range[1]} words a minute` : g.id === 'time' ? 'within the target time' : `${gs[g.id]} or fewer ${g.unit}`;
      const shown = { fillers: v => `${v} per 100 words`, hedges: v => `${v} per 100 words`, pauses: v => `${v} long pause${v === 1 ? '' : 's'}`, pace: v => `${v} words a minute`, time: () => `${met ? 'within' : 'outside'} the target time` }[g.id](value);
      return { id: g.id, label: g.label, target, value, met, text: met == null ? `${g.label}: not measured here${g.id === 'pace' || g.id === 'pauses' ? ' (dictate your answer to measure it)' : ''}.` : `${g.label}: ${shown}${met ? ' — goal met' : ` (goal: ${target})`}.` };
    });
  }
  /* Per goal, the values over the last n analysed answers (oldest first), how many met the goal, and the direction:
     the mean of the latest three measured answers against the three before, where lower is better except for pace and time. */
  function goalTrends(analyses, goals, n = 10) {
    const gs = cleanGoals(goals), recent = analyses.slice(-n);
    return GOALS.filter(g => gs[g.id] != null).map(g => {
      const values = recent.map(r => g.value(r)), measured = values.filter(v => v != null), met = values.filter(v => goalMet(g, gs[g.id], v)).length;
      let direction = null;
      if (measured.length >= 4 && g.id !== 'time') {
        const k = Math.min(3, Math.floor(measured.length / 2)), mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length, now = mean(measured.slice(-k)), before = mean(measured.slice(-2 * k, -k));
        const better = g.range ? Math.abs(now - (g.range[0] + g.range[1]) / 2) < Math.abs(before - (g.range[0] + g.range[1]) / 2) : now < before;
        direction = Math.abs(now - before) < (g.range ? 5 : 0.3) ? 'steady' : better ? 'better' : 'worse';
      }
      return { id: g.id, label: g.label, limit: gs[g.id], range: g.range || null, values, measured: measured.length, met, direction };
    });
  }

  /* Everything shown after an answer. seconds is the timed duration; voice says whether dictation was used. */
  function analyse(text, opts = {}) {
    const comp = competency(opts.competency) || COMPETENCIES[0], words = wordCount(text), est = estSeconds(words);
    const timed = Number.isFinite(opts.seconds) && opts.seconds > 0 ? Math.round(opts.seconds) : null;
    const wpm = opts.voice && timed && timed >= 15 && words ? Math.round(words / (timed / 60)) : null;
    const pace = wpm == null ? null : { wpm, level: wpm < 105 ? 'warn' : wpm > 175 ? 'warn' : 'ok', text: wpm < 105 ? `${wpm} words a minute is slow. Long pauses or dictation gaps can cause this.` : wpm > 175 ? `${wpm} words a minute is fast. Slow down and pause between the parts of your answer.` : `${wpm} words a minute is a comfortable conversational pace.` };
    const f = fillers(text), p = pronouns(text), notes = [];
    const fillerLevel = f.per100 > 3 ? 'warn' : 'ok';
    const iWe = p.iShare == null ? { level: 'warn', text: 'No "I" or "we" found. Make it clear who did what.' }
      : comp.id === 'teamwork' && p.iShare > 90 && p.i >= 5 ? { level: 'warn', text: `"I" is ${p.iShare}% of I/we. In a teamwork answer, also show how you worked with others.` }
      : p.we > p.i && comp.frame === 'star' ? { level: 'warn', text: `"We" (${p.we}) outnumbers "I" (${p.i}). Interviewers want to hear what you did.` }
      : { level: 'ok', text: `"I" ${p.i} times, "we" ${p.we} times.` };
    if (!words) notes.push('No answer yet.');
    return { words, estSeconds: est, target: comp.target, time: timeCheck(timed && opts.voice ? timed : est, comp.target), timed, pace,
      fillers: { ...f, level: fillerLevel }, pronouns: { ...p, ...iWe }, delivery: delivery(text, { pauses: opts.voice ? opts.pauses : null }), structure: tagged(text, opts.tags, comp.frame, comp.id), notes };
  }

  /* ---------- Interview conditions: which follow-ups the interviewer asks after an answer ---------- */
  /* A spoken answer is interrupted once it passes this multiple of the upper target; a typed one is told it ran long. */
  const CUT_AFTER = 1.25, FOLLOW_UP_MAX_S = 90;
  const PREPARED_WHY = 'A prepared follow-up for this kind of question. It does not depend on what you said.';
  /* Returns at most `max` follow-ups, each { id, text, why }. Rules look only at length, "I" versus "we" and whether
     a number, a result word or a lesson word was found, so `why` says what was counted, never what it "means".
     The first rule that fires is asked, then one prepared probe; an answer that trips no rule gets one prepared probe.
     opts: competency, seconds and voice (as for analyse), cut (the interviewer interrupted), hypothetical, max, rand. */
  function followUps(text, opts = {}) {
    const comp = competency(opts.competency) || COMPETENCIES[0], frame = comp.frame, star = frame === 'star' && !opts.hypothetical;
    const r = analyse(text, { competency: comp.id, seconds: opts.seconds, voice: opts.voice }), [lo, hi] = comp.target, p = r.pronouns;
    const secs = r.timed && opts.voice ? r.timed : r.estSeconds, about = `${opts.voice && r.timed ? 'took' : 'would take'} about ${secs}s to say`;
    const fired = [], add = (id, text, why) => fired.push({ id, text, why });
    const point = opts.hypothetical ? 'what would you do?' : { star: 'what was the result?', ppf: 'what is the one thing you want me to remember about you?', fit: 'what is your main reason for wanting this role?' }[frame];
    const more = opts.hypothetical ? 'Walk me through what you would do, step by step.' : { star: 'Walk me through what you actually did, step by step.', ppf: 'Pick one thing you have done and tell me more about it.', fit: 'What specifically about this role appeals to you?' }[frame];
    if (opts.cut) add('long', `Let me stop you there. In one or two sentences, ${point}`, `You were still speaking after ${secs}s. This question needs ${lo}–${hi}s, so the interviewer cut in.`);
    else if (secs > hi * CUT_AFTER) add('long', `That was a long answer. In one or two sentences, ${point}`, `Your answer ${about}. This question needs ${lo}–${hi}s.`);
    else if (secs < lo * 0.5) add('short', `That was brief. ${more}`, `Your answer ${about}. This question usually needs ${lo}–${hi}s.`);
    if (star && p.we > p.i) add('we', GENERAL_PROBES[0], `You said “we” ${p.we} time${p.we === 1 ? '' : 's'} and “I” ${p.i} time${p.i === 1 ? '' : 's'}, so it was not clear what you did yourself.`);
    if (star && !hasNumber(text) && !hasOutcome(text)) add('outcome', GENERAL_PROBES[1], 'No number and no result word (such as “finished”, “increased” or “won”) was found in your answer.');
    else if (!hasNumber(text) && (star || frame === 'ppf')) add('number', star ? 'Can you put a number on that? How much, how many or how long?' : 'Pick one of those highlights. What was the concrete result?', 'No number or measure was found in your answer.');
    if (star && comp.lesson && !hasLesson(text)) add('lesson', 'What did you learn from that, and what do you do differently now?', 'No words about what you learned (such as “learned”, “since then” or “next time”) were found.');
    const rand = opts.rand || Math.random, max = Number.isInteger(opts.max) ? Math.max(0, opts.max) : 2;
    const prepared = comp.probes.concat(star && !comp.lesson ? [GENERAL_PROBES[2]] : []);
    const probe = { id: 'prepared', text: prepared[Math.min(prepared.length - 1, Math.floor(rand() * prepared.length))], why: PREPARED_WHY };
    return fired.slice(0, 1).concat(probe).slice(0, max);
  }

  /* STAR check for a story in the bank, using its four fields directly. */
  const storyStructure = story => structure({ s: story?.s, t: story?.t, a: story?.a, r: story?.r }, 'star', {});

  /* Which story competencies have no story yet. */
  function coverage(stories) {
    return STORY_IDS.map(id => ({ id, title: competency(id).title, stories: (stories || []).filter(s => Array.isArray(s.tags) && s.tags.includes(id)) }))
      .map(c => ({ ...c, count: c.stories.length }));
  }

  const api = { FRAMES, COMPETENCIES, IDS, STORY_IDS, GENERAL_PROBES, SPEAKING_WPM, competency, findQuestion, pickQuestion, tokens, wordCount, estSeconds,
    FILLER_LABELS, fillers, pronouns, hasNumber, hasOutcome, hasLesson, segments, structure, tagged, timeCheck, analyse, storyStructure, coverage,
    PAUSE_MS, phrases, notePause, delivery, GOALS, goalOf, cleanGoals, goalChecks, goalTrends, CUT_AFTER, FOLLOW_UP_MAX_S, followUps };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BehaviouralContent = api;
})(this);
