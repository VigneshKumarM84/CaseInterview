/* Résumé and project defence: the questions an interviewer asks about one line of a résumé, or about one
   project. No DOM access, so Node tests load this file directly. Nothing here is AI. The rules read the line
   for a figure, a verb of change, a count, a vague opener, team words and a named tool or method, and every
   question carries the reason it was asked. They cannot tell whether a claim is true or an answer is good. */
(function (root) {
  const B = (root && root.BehaviouralContent) || (typeof require === 'function' ? require('./behavioural-content.js') : null);
  const LIMITS = { line: 300, title: 120, answer: 6000, minLineWords: 4 };
  const clean = (s, max) => String(s == null ? '' : s).replace(/^[\s•\-*–▪·]+/, '').replace(/\s+/g, ' ').trim().slice(0, max);
  const words = s => (String(s || '').match(/[A-Za-z0-9₹%']+/g) || []).length;

  /* ---------- Reading a résumé line ---------- */
  const UNIT = '(?:%|percent\\b|x\\b|k\\b|lakhs?\\b|crores?\\b|million\\b|billion\\b)';
  const FIGURE = new RegExp(`(?:[₹$€£]\\s?|\\brs\\.?\\s?)?(?<![A-Za-z0-9])\\d[\\d,.]*(?![\\d,.]*(?:st|nd|rd|th)\\b)(?:\\s?${UNIT})?`, 'gi'); // not "2nd"
  const HAS_UNIT = new RegExp(`${UNIT}$|^[₹$€£]|^rs`, 'i');
  const YEAR = /^(?:19|20)\d{2}$/;
  /* Verbs that claim something went up, down or got better. */
  const CHANGE = '(?:reduc|cut|cutting|lower|decreas|shorten|trimm|halv|sav|increas|improv|grew|grow|rais|boost|doubl|tripl|lift|accelerat|sped|speed)[a-z]*';
  const CHANGE_RE = new RegExp(`\\b${CHANGE}\\b`, 'i');
  /* Three shapes of a claimed change, with the thing that changed between the verb and the figure:
     "cutting stock-outs by 18%", "grew followers from 400 to 2,100", "raised attendance to 85%". */
  const NUM = `(?:[₹$€£]\\s?|rs\\.?\\s?)?\\d[\\d,.]*(?:\\s?${UNIT})?`, ABOUT = '(?:about\\s+|around\\s+|nearly\\s+|over\\s+|almost\\s+)?';
  const SHAPE_RE = new RegExp(`\\b(${CHANGE})\\s+(?:the\\s+|our\\s+|their\\s+)?([^,;.]{2,48}?)\\s+(?:by\\s+${ABOUT}(${NUM})|from\\s+${ABOUT}(${NUM})\\s+to\\s+${ABOUT}(${NUM})|to\\s+${ABOUT}(${NUM}))`, 'i');
  const trim = f => f.trim().replace(/[.,]+$/, '');
  /* A prize, rank or selection: its weight depends on the field and the criteria, not on a baseline. */
  const RECOGNITION_RE = /\b(?:won|winner|winning|prize|award(?:ed)?|medal|rank(?:ed)?|placed|runner-up|finalist|shortlisted|selected|topper|\d+(?:st|nd|rd|th))\b/i;
  const PERIOD_RE = /\b(?:in|over|within|across|during|for)\s+((?:\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(?:day|week|month|quarter|semester|term|year)s?)\b/i;
  const WEAK = ['responsible for', 'helped', 'assisted', 'worked on', 'participated in', 'involved in', 'supported', 'contributed to', 'was part of', 'part of', 'exposure to', 'familiar with'];
  /* Being in charge counts only when the line opens with it ("Managed a team of 15"), not "which led the café to…". */
  const LEAD_RE = /^(led|lead|leading|manag[a-z]*|head[a-z]*|coordinat[a-z]*|co-ordinat[a-z]*|supervis[a-z]*|captain[a-z]*|mentor[a-z]*|train[a-z]*|organi[sz][a-z]*)$/i;
  const TEAM_RE = /\b(?:a\s+)?(?:team|group|committee|crew)\s+of\s+\d+(?:\s+(?!to\b|and\b|for\b|in\b|on\b|at\b|who\b|that\b|which\b|with\b|from\b)[a-z-]+)?|\b\d+\s+(?:volunteers|members|interns|juniors|teammates)\b|\b(?:team|teammates|colleagues|juniors|volunteers|committee)\b/i;
  const TOOLS = ['Excel', 'Google Sheets', 'SQL', 'Python', 'R', 'Tableau', 'Power BI', 'PowerPoint', 'Tally', 'SPSS', 'MATLAB', 'AutoCAD', 'SolidWorks', 'ANSYS', 'Arduino', 'Raspberry Pi', 'Java', 'C++', 'C', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Django', 'Flask', 'Flutter', 'Android', 'HTML', 'CSS', 'Git', 'AWS', 'Linux', 'TensorFlow', 'PyTorch', 'Figma', 'Canva', 'Photoshop', 'SAP', 'Salesforce'];
  const toolRe = t => new RegExp(`(?<![A-Za-z0-9+#.])${t.replace(/[.+]/g, '\\$&')}(?![A-Za-z0-9+#])`, t.length <= 2 ? '' : 'i');
  const METHODS = ['forecast model', 'regression', 'survey', 'A/B test', 'experiment', 'simulation', 'dashboard', 'model', 'analysis', 'algorithm', 'classifier', 'prototype', 'pipeline', 'tracker', 'audit', 'case study', 'questionnaire'];
  const methodRe = x => new RegExp(`(?<![A-Za-z])${x.replace('/', '\\/')}(?![A-Za-z])`, 'i');

  /* What the rules can see in one line. Every field is a string from the line itself, or null. */
  function readClaim(line) {
    const text = clean(line, LIMITS.line), lower = text.toLowerCase();
    const figures = (text.match(FIGURE) || []).map(trim).filter(f => f && !YEAR.test(f.replace(/,/g, '')));
    // A change needs a verb of change and a figure. `said` repeats the claim in the line's own shape; without a
    // recognised shape, a figure with a unit ("18%", "₹20") next to a verb of change still counts.
    let change = null; const m = text.match(SHAPE_RE);
    if (m) {
      const metric = m[2].trim().replace(/^(?:the|a|an)\s+/i, ''), verb = m[1].toLowerCase();
      if (m[3]) change = { verb, metric, figure: trim(m[3]), shape: 'by', said: `${metric} changed by ${trim(m[3])}` };
      else if (m[4]) change = { verb, metric, figure: `${trim(m[4])} to ${trim(m[5])}`, shape: 'range', said: `${metric} went from ${trim(m[4])} to ${trim(m[5])}` };
      else change = { verb, metric, figure: trim(m[6]), shape: 'to', said: `${metric} reached ${trim(m[6])}` };
    } else if (figures.length && CHANGE_RE.test(text)) {
      const unit = figures.find(f => HAS_UNIT.test(f));
      if (unit) change = { verb: text.match(CHANGE_RE)[0].toLowerCase(), metric: null, figure: unit, shape: null, said: null };
    }
    const claimed = change ? change.figure.split(' to ') : [];
    // A count is a bare number with the noun after it ("120 SKUs", "2,400 app reviews").
    let count = null;
    for (const f of figures) {
      if (claimed.includes(f)) continue;
      const at = text.indexOf(f), rest = text.slice(at + f.length).match(/^\s+((?:[A-Za-z][A-Za-z-]*\s+)?[A-Za-z][A-Za-z-]*)/);
      if (/^\d/.test(f) && !new RegExp(UNIT + '$', 'i').test(f) && rest && !/^(?:and|or|to|by|in|of|for|with|over|per|a|the)\b/i.test(rest[1])) { count = `${f} ${rest[1].replace(/\s+(?:and|or|to|by|in|of|for|with|over|per|across|from|which|that|who)\b.*$/i, '')}`; break; }
    }
    // Vague openers and being in charge are read from how the line starts, after "I" or "was".
    const start = lower.replace(/^i\s+/, '').replace(/^(?:was|were)\s+/, ''), first = start.split(' ')[0];
    const weak = WEAK.find(w => start.startsWith(w + ' ')) || null;
    const lead = LEAD_RE.test(first) ? first : null, team = text.match(TEAM_RE), period = text.match(PERIOD_RE);
    const tool = TOOLS.find(t => toolRe(t).test(text)) || null;
    const method = METHODS.find(x => methodRe(x).test(text)) || null;
    // What the line offers as a measure when it claims no change: a count with its noun, or a figure with a unit.
    const measure = change ? null : count || figures.find(f => HAS_UNIT.test(f)) || null;
    const recognition = !change && RECOGNITION_RE.test(text);
    return { text, words: words(text), figures, change, count, measure, recognition, weak, lead, team: team ? team[0].replace(/^a\s+/i, '') : null, period: period ? period[1] : null, tool, method };
  }

  /* ---------- Questions about a résumé line ---------- */
  const an = w => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;
  /* Returns up to `max` questions, each { id, text, why, listenFor }. The opening and the closing question are always
     asked; the middle ones depend on what the line claims, with a claimed change probed first. */
  function lineQuestions(line, opts = {}) {
    const c = readClaim(line), max = Number.isInteger(opts.max) ? Math.max(2, opts.max) : 5, mid = [];
    const open = { id: 'walk', text: `Take me through this line on your résumé: “${c.text}”. What was the situation, and what were you asked to do?`,
      why: 'Interviewers usually start on a résumé line by asking for the story behind it.',
      listenFor: ['Where and when this happened, in a sentence or two', 'What you were responsible for', 'Why it mattered to someone'] };
    if (c.change) {
      const ch = c.change, ask = { by: 'How was that measured, what was it before, and what was it after?', range: `How was that measured, and ${c.period ? 'who else saw those numbers' : 'over what period'}?`, to: 'How was that measured, and what was it before?' }[ch.shape];
      mid.push({ id: 'evidence', text: ch.said ? `You say ${ch.said}. ${ask}` : `You wrote ${ch.figure}. What is that a change in, how was it measured, and what was it before and after?`,
        why: `The line claims a change (${ch.figure}). A figure like that depends on how it was defined and what it started from.`,
        listenFor: ['What exactly was counted', 'The value before and the value after', c.period ? `Who measured it over the ${c.period}` : 'The period, and who measured it'] });
      mid.push({ id: 'rival', text: `What else changed in that period that could explain ${ch.shape === 'by' || !ch.shape ? 'the ' + ch.figure : 'that change'}? How would you rule it out?`,
        why: 'A result can have causes other than your work, such as the season, a promotion or someone else’s change.',
        listenFor: ['At least one other possible cause', 'How it could be checked', 'Honesty about what cannot be ruled out'] });
    } else if (c.recognition) {
      mid.push({ id: 'evidence', text: 'How many others were in the running, and what was it judged on?',
        why: 'The line reports a prize, rank or selection. Its weight depends on the size of the field and the criteria.',
        listenFor: ['How many competed or applied', 'What the judges or selectors looked at', 'What your work did better than the rest'] });
    } else if (c.measure || c.figures.length) {
      mid.push({ id: 'evidence', text: `${c.measure ? `You mention ${c.measure}.` : 'This line gives no result.'} What came out of the work, and how do you know?`,
        why: c.measure ? `The line gives a figure (${c.measure}) but not what changed because of it.` : 'The line does not say what the work led to.',
        listenFor: ['What the work led to', 'How you know: a number, a decision someone took, or feedback', 'Why that scope and not more or less'] });
    } else {
      mid.push({ id: 'evidence', text: 'There is no number in this line. How would I know it went well?',
        why: 'No number or measure was found in the line.',
        listenFor: ['Something that changed because of the work', 'A number, even a rough one, and how you know it', 'Who could confirm it'] });
    }
    if (c.weak) mid.push({ id: 'contribution', text: `The line says “${c.weak}”. What exactly did you do yourself, and what did others do?`,
      why: `“${c.weak}” does not say what your part was.`, listenFor: ['Your own tasks, named one by one', 'What others did', 'One thing that would not have happened without you'] });
    else if (c.lead && c.team) mid.push({ id: 'contribution', text: `You ${c.lead} ${!/\d/.test(c.team) ? 'a team' : /^\d/.test(c.team) ? c.team : 'a ' + c.team}. Tell me about one problem inside that team and what you did about it.`,
      why: 'The line says you were in charge of people. Interviewers test that with one specific incident.', listenFor: ['A specific incident, not a general statement', 'What you said or did', 'How it ended'] });
    else if (c.team) mid.push({ id: 'contribution', text: 'Who else worked on this, and which part was yours alone?',
      why: 'The line mentions other people, so it is not clear which part was yours.', listenFor: ['Your own tasks, named one by one', 'What others did', 'One thing that would not have happened without you'] });
    else mid.push({ id: 'contribution', text: 'What was the hardest decision you made yourself in this work, and what did you weigh up?',
      why: 'The line does not show a decision you took.', listenFor: ['A real choice between options', 'The reason for the choice', 'What you gave up'] });
    if (c.tool) mid.push({ id: 'method', text: `You used ${c.tool} here. What exactly did you do in it, step by step?`,
      why: `The line names ${c.tool}. Interviewers check a named tool with a concrete question.`, listenFor: ['Specific steps or functions', `Why ${c.tool} and not something else`, 'A limitation you ran into'] });
    else if (c.method) mid.push({ id: 'method', text: `Explain the ${c.method} to me as you would to someone who has never seen one. Why did you do it that way?`,
      why: `The line mentions ${an(c.method)}. Interviewers check that you can explain your own method simply.`, listenFor: ['A plain explanation without jargon', 'Why this approach', 'What it cannot tell you'] });
    const close = { id: 'limit', text: 'What did not go to plan, and what would you do differently if you did it again?',
      why: 'Interviewers often close on what you learned. A line with nothing that went wrong sounds rehearsed.',
      listenFor: ['Something that actually fell short', 'What you would change, specifically', 'No blaming others'] };
    return [open, ...mid.slice(0, Math.max(0, max - 2)), close];
  }

  /* ---------- Questions about a project ---------- */
  const KINDS = [
    { id: 'project', label: 'College or course project', example: 'Line-following robot for the second-year design course' },
    { id: 'lab', label: 'Lab, thesis or research work', example: 'Soil moisture readings from three farm plots over a semester' },
    { id: 'internship', label: 'Internship task', example: 'Weekly sales report for a distributor’s category team' },
    { id: 'event', label: 'Fest, club or event', example: 'Sponsorship desk for the annual commerce fest' },
    { id: 'volunteer', label: 'Volunteering', example: 'Weekend reading classes for Class 6 students' },
    { id: 'family', label: 'Family business or own venture', example: 'Billing and stock register for a family textile shop' }
  ];
  const kindOf = id => KINDS.find(k => k.id === id) || KINDS[0];
  /* Five questions: what was chosen, what the student did personally, what failed, what was measured, what they would change. */
  function projectQuestions(project = {}) {
    const title = clean(project.title, LIMITS.title) || 'your project', kind = kindOf(project.kind).id;
    const mine = { internship: 'What were you given to do, and what did you decide for yourself?', family: 'What did you change yourself, as opposed to how things already ran?' }[kind] || 'Which part did you do yourself, and what did the others do?';
    return [
      { id: 'choice', text: `Tell me about ${title}. What was the problem, and why did you go about it this way?`, why: 'Every project discussion starts with what it was for and why you approached it as you did.',
        listenFor: ['The problem in one sentence, and who it was for', 'The approach you chose', 'At least one alternative you considered'] },
      { id: 'contribution', text: mine, why: 'Interviewers need to separate your work from the group’s, the guide’s or the organisation’s.',
        listenFor: ['Your own tasks, named one by one', 'What others did', 'One thing that would not have happened without you'] },
      { id: 'failed', text: 'What did you try that did not work? What did you do next?', why: 'A project where nothing went wrong usually means the student did not do the hard part.',
        listenFor: ['A specific thing that failed', 'How you found out', 'What you changed as a result'] },
      { id: 'evidence', text: 'How did you check that it worked? What did you measure or observe?', why: 'Interviewers look for evidence, not only effort.',
        listenFor: ['What was measured or observed', 'A number, even a rough one', 'Who else saw or used the result'] },
      { id: 'limit', text: 'If you had two more weeks, what would you change, and why?', why: 'This shows whether you can judge your own work.',
        listenFor: ['A specific weakness in the work', 'What you would do about it', 'Why that matters more than other fixes'] }
    ];
  }

  /* ---------- One reactive follow-up per answer ---------- */
  /* Returns { id, text, why } or null. It looks only at the length of the answer, "I" against "we", and whether a
     number was heard, so `why` reports what was counted. */
  function followUp(question, answer) {
    const n = words(answer), p = B ? B.pronouns(answer) : { i: 0, we: 0 }, number = B ? B.hasNumber(answer) : /\d/.test(String(answer || ''));
    if (n < 25) return { id: 'brief', text: 'That was brief. Give me the specifics: what happened, step by step?', why: `Your answer was ${n} word${n === 1 ? '' : 's'}.` };
    if (question && question.id === 'contribution' && p.we > p.i) return { id: 'we', text: 'You keep saying “we”. Which part was you?', why: `You said “we” ${p.we} time${p.we === 1 ? '' : 's'} and “I” ${p.i} time${p.i === 1 ? '' : 's'}.` };
    if (question && question.id === 'evidence' && !number) return { id: 'number', text: 'I did not hear a number. Give me one, even roughly, and tell me how you know it.', why: 'No number was found in your answer to a question about evidence.' };
    return null;
  }

  /* ---------- After the defence: prompts for rewriting the line, and a story for the story bank ---------- */
  /* Suggestions tied to what the rules saw in the line. They are prompts: the student adds only what is true. */
  function rewriteHints(line) {
    const c = readClaim(line), out = [];
    if (c.weak) out.push(`Replace “${c.weak}” with the verb for what you did yourself.`);
    if (c.recognition && !c.measure) out.push('Say how many others were in the running.');
    else if (!c.figures.length) out.push('Add the number you gave in your answers, if you can stand behind it.');
    if (c.change && !c.period) out.push('Say over what period the change was measured.');
    if (c.change && c.change.shape !== 'range') out.push(c.change.metric ? 'Give the starting point as well as the change, if there is room.' : `Say what the ${c.change.figure} is a change in.`);
    if (!c.change && c.figures.length) out.push(c.measure ? `After “${c.measure}”, say what the work led to.` : 'Say what the work led to.');
    if ((c.team || c.lead) && !c.weak) out.push('Make your own part clear, separate from the team’s.');
    out.push('Keep only what you could defend if asked again.');
    return out;
  }
  /* Maps the answers onto the four STAR fields of a story-bank story. answers: [{ id, text, reply }] in question order. */
  function toStory(session = {}) {
    const by = id => (session.answers || []).filter(a => a && a.id === id).map(a => [a.text, a.reply].filter(Boolean).join(' ')).join(' ').trim();
    const title = clean(session.kind === 'project' ? session.title : session.line, LIMITS.title);
    const result = [by('evidence'), by('rival') && `Other explanations considered: ${by('rival')}`, by('limit') && `What I would change: ${by('limit')}`].filter(Boolean).join('\n\n');
    return { title, s: by('walk') || by('choice'), t: '', a: [by('contribution'), by('method'), by('failed') && `What did not work: ${by('failed')}`].filter(Boolean).join('\n\n'), r: result, tags: [] };
  }

  const api = { LIMITS, KINDS, TOOLS, kindOf, readClaim, lineQuestions, projectQuestions, followUp, rewriteHints, toStory, words };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DefenceContent = api;
})(this);
