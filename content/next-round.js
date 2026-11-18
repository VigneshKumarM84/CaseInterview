/* "Prepare for my next round": the rounds, roles and time options a student chooses from, the practice items a
   plan can contain, and the rules that build a plan. Every item opens a tool that already exists in Case Room.
   Data and pure functions only, so Node tests load this file directly. */
(function (root) {
  const ROUNDS = [
    { id: 'aptitude', title: 'Online aptitude test', note: 'Most campus aptitude tests mix quantitative, logical and verbal questions at about a minute each. Practise under time, then work on your weakest topic.' },
    { id: 'case', title: 'Case or guesstimate interview', note: 'A case interview tests how you structure a problem, ask for evidence, use numbers and commit to a recommendation.' },
    { id: 'hr', title: 'HR or behavioural interview', note: 'HR rounds come back to a few questions: who you are, why this role, and stories about teamwork, conflict and mistakes.' },
    { id: 'gd', title: 'Group discussion', note: 'Case Room has no group-discussion practice yet. This plan builds the skills a GD rewards: a clear opening, evidence, disagreeing well and a short summary. Practising with two or three friends is still the best preparation.' },
    { id: 'resume', title: 'Résumé shortlisting', note: 'Shortlists are often made from your résumé alone, and interviewers later ask about every line on it.' },
    { id: 'technical', title: 'Technical or coding round', note: 'Case Room does not cover coding or core technical questions. Prepare those with your department’s past papers and a coding practice platform. Campus processes often put an aptitude test and an HR interview around the technical round, and you can practise those here.', outside: true },
    { id: 'unknown', title: 'I don’t know the round yet', note: 'Rounds vary by company and campus. A common sequence is résumé shortlisting, an online aptitude test, sometimes a group discussion, then technical or case interviews and an HR interview. Check your placement notice or ask your placement cell, then choose the round here. Until then, this plan covers what most processes share.' }
  ];
  const ROLES = [
    { id: 'other', title: 'Another role, or not sure' },
    { id: 'consulting', title: 'Consulting' },
    { id: 'analyst', title: 'Business or data analyst' },
    { id: 'operations', title: 'Operations or management trainee' }
  ];
  const TIMES = [{ minutes: 10, title: '10 min' }, { minutes: 20, title: '20 min' }, { minutes: 45, title: '45 min' }, { minutes: 90, title: 'An hour or more' }];
  const DEFAULT_MINUTES = 20;

  /* Each item opens an existing tool. `open` says how (src/next-round.js carries it out). */
  const ITEMS = {
    'apt-mixed': { tool: 'Aptitude', title: '10 mixed aptitude questions', minutes: 10, open: { tool: 'aptitude', practice: { count: 10 } },
      why: 'Quant, logical and verbal in one short set, with a worked solution after each answer.' },
    'apt-mock-short': { tool: 'Aptitude', title: 'Timed mock test: 15 questions', minutes: 15, open: { tool: 'aptitude', test: { perSection: 5 } },
      why: 'Five each of quant, logical and verbal, timed like the real test. It shows which section slows you down.' },
    'apt-mock': { tool: 'Aptitude', title: 'Timed mock test: 30 questions', minutes: 30, open: { tool: 'aptitude', test: { perSection: 10 } },
      why: 'Ten per section at about a minute each, the pace of most campus tests.' },
    'apt-weak': { tool: 'Aptitude', title: '10 questions on your weakest topic', minutes: 10, open: { tool: 'aptitude', practice: { count: 10, weakest: true } },
      why: 'Picks the topic you get wrong most often from your aptitude history. With no history yet, you get a mixed set.' },
    'drill-maths': { tool: 'Maths drill', title: 'Case maths: 10 quick questions', minutes: 10, open: { tool: 'drill', skills: ['percent', 'change', 'margin', 'breakeven', 'estimate'] },
      why: 'Percentages, margins, break-evens and estimates: the arithmetic every case asks for, with a shortcut after each answer.' },
    'warmup': { tool: 'Cases', title: 'Guided warm-up: More tickets, less money', minutes: 10, open: { tool: 'warmup' },
      why: 'A first case in four small steps, with an example after each. Start here if you have never done a case interview.' },
    'case-consulting': { tool: 'Cases', title: 'Full case: The disappearing margin', minutes: 40, open: { tool: 'case', caseId: 'cement' },
      why: 'A profitability case: structure the problem, ask for evidence, calculate and recommend.' },
    'case-guesstimate': { tool: 'Cases', title: 'Full case: How many cups?', minutes: 40, open: { tool: 'case', caseId: 'guesstimate' },
      why: 'A guesstimate: build an estimate from assumptions you can defend out loud.' },
    'case-analyst': { tool: 'Cases', title: 'Full case: Where did the orders go?', minutes: 35, open: { tool: 'case', caseId: 'metricdrop' },
      why: 'A metric-drop case: define the metric, split the drop and find the cause before proposing a fix.' },
    'case-experiment': { tool: 'Cases', title: 'Full case: Did the streak work?', minutes: 35, open: { tool: 'case', caseId: 'experiment' },
      why: 'An experiment case: read a test result, check whether it is real, and decide what to ship.' },
    'case-operations': { tool: 'Cases', title: 'Full case: The capacity illusion', minutes: 40, open: { tool: 'case', caseId: 'operations' },
      why: 'An operations case: find the real bottleneck before anyone buys equipment.' },
    'peer': { tool: 'Peer interview', title: 'Mock case interview with a friend', minutes: 45, open: { tool: 'peer' },
      why: 'One of you interviews from a guide while the other answers. The closest thing to the real interview.' },
    'bh-intro': { tool: 'Behavioural', title: 'Answer “Tell me about yourself”', minutes: 5, open: { tool: 'behavioural', mode: 'intro' },
      why: 'Almost every interview opens with it. Aim for one to two minutes.' },
    'bh-motivation': { tool: 'Behavioural', title: 'Answer “Why this company or role?”', minutes: 5, open: { tool: 'behavioural', mode: 'motivation' },
      why: 'Interviewers check that you know what the job involves. Have one specific reason ready.' },
    'bh-mixed': { tool: 'Behavioural', title: 'Answer a random HR question', minutes: 5, open: { tool: 'behavioural', mode: 'mixed' },
      why: 'Practise thinking on your feet with a question you have not prepared.' },
    'bh-conflict': { tool: 'Behavioural', title: 'Answer a question about disagreeing', minutes: 5, open: { tool: 'behavioural', mode: 'conflict' },
      why: 'Group discussions and interviews both test whether you can disagree without derailing the group.' },
    'bh-teamwork': { tool: 'Behavioural', title: 'Answer a teamwork question', minutes: 5, open: { tool: 'behavioural', mode: 'teamwork' },
      why: 'A story about working with others, told with what you did and what changed.' },
    'bh-stories': { tool: 'Behavioural', title: 'Write three stories for your story bank', minutes: 15, open: { tool: 'stories' },
      why: 'Three prepared stories (a challenge, a team success and a mistake) cover most behavioural questions.' },
    'resume': { tool: 'Résumé check', title: 'Check your résumé against the job', minutes: 10, open: { tool: 'resume' },
      why: 'Interviewers ask about anything on your résumé. Check every bullet, and paste the job description if you have it.' },
    'gd-moves': { tool: 'Read here', title: 'Five moves that count in a group discussion', minutes: 3, open: { tool: 'read' },
      why: 'What observers usually note down, so you can do it on purpose.',
      tips: [
        'Open with a frame, not an opinion: “Shall we agree what matters most here: cost, fairness or speed?”',
        'Bring one fact or number, and say where it comes from.',
        'Build on someone by name: “Adding to what Meera said…” shows you are listening.',
        'Bring a quieter member in: “We haven’t heard from you yet. What do you think?”',
        'Close with a 30-second summary of where the group agrees and where it still disagrees.'
      ] }
  };

  const CASE_FOR = { consulting: 'case-consulting', analyst: 'case-analyst', operations: 'case-operations', other: 'case-consulting' };
  const SECOND_CASE = { consulting: 'case-guesstimate', analyst: 'case-experiment', operations: 'drill-maths', other: 'case-guesstimate' };

  /** The ordered candidates for a round. A plan takes them in order while they fit the time. */
  function candidates(round, role, { warmupDone = false, minutes = DEFAULT_MINUTES } = {}) {
    const short = minutes < 45;
    switch (round) {
      case 'aptitude': return minutes <= 10 ? ['apt-mixed'] : minutes <= 20 ? ['apt-mock-short', 'apt-weak'] : ['apt-mock', 'apt-weak', 'apt-mixed', 'drill-maths'];
      case 'case': return short ? (warmupDone ? ['drill-maths', 'bh-motivation'] : ['warmup', 'drill-maths'])
        : [CASE_FOR[role] || CASE_FOR.other, SECOND_CASE[role] || SECOND_CASE.other, 'drill-maths', 'bh-motivation'];
      case 'hr': return ['bh-intro', 'bh-motivation', 'bh-mixed', 'resume', 'bh-stories'];
      case 'gd': return [{ id: 'gd-moves' }, 'bh-conflict', { id: 'warmup', why: 'Its last step is a 30-second recommendation: the same skill as summarising a group discussion.' }, 'bh-teamwork', 'bh-mixed'];
      case 'resume': return ['resume', 'bh-intro', 'bh-stories', 'bh-motivation', 'apt-mixed'];
      case 'technical': return ['apt-mixed', 'bh-intro', 'resume', 'bh-motivation', 'apt-mock'];
      case 'unknown': return ['apt-mixed', 'bh-intro', 'resume', 'bh-motivation', 'apt-mock-short', warmupDone ? 'drill-maths' : 'warmup'];
      default: return [];
    }
  }

  /** Builds a plan: the first candidate always, then each later one that still fits in the time. */
  function plan({ round, role = 'other', minutes = DEFAULT_MINUTES, warmupDone = false } = {}) {
    if (!ROUNDS.some(r => r.id === round)) return [];
    const out = []; let used = 0;
    for (const c of candidates(round, role, { warmupDone, minutes })) {
      const entry = typeof c === 'string' ? { id: c } : c, item = ITEMS[entry.id];
      if (!item || out.some(e => e.id === entry.id)) continue;
      if (out.length && used + item.minutes > minutes) continue;
      out.push(entry); used += item.minutes;
    }
    return out;
  }
  const total = entries => entries.reduce((n, e) => n + (ITEMS[e.id] ? ITEMS[e.id].minutes : 0), 0);

  const api = { ROUNDS, ROLES, TIMES, DEFAULT_MINUTES, ITEMS, candidates, plan, total };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NextRound = api;
})(this);
