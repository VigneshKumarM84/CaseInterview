/* "Prepare for my next round": the rounds, roles and time options a student chooses from, the practice items a
   plan can contain, and the rules that build a plan. Every item opens a tool that already exists in Case Room.
   Data and pure functions only, so Node tests load this file directly. */
(function (root) {
  const ROUNDS = [
    { id: 'aptitude', title: 'Online aptitude test', note: 'Most campus aptitude tests mix quantitative, logical and verbal questions at about a minute each. Practise under time, then work on your weakest topic.' },
    { id: 'case', title: 'Case or guesstimate interview', note: 'A case interview tests how you structure a problem, ask for evidence, use numbers and commit to a recommendation.' },
    { id: 'hr', title: 'HR or behavioural interview', note: 'HR rounds come back to a few questions: who you are, why this role, and stories about teamwork, conflict and mistakes.' },
    { id: 'gd', title: 'Group discussion', note: 'The group discussion kit needs a group: three to six of you, one clock and an observer. The other items in this plan build the same skills on your own: a clear opening, evidence, disagreeing well and a short summary.' },
    { id: 'resume', title: 'Résumé shortlisting', note: 'Shortlists are often made from your résumé alone, and interviewers later ask about every line on it.' },
    { id: 'technical', title: 'Technical or coding round', note: 'Case Room does not cover coding or core technical questions. Prepare those with your department’s past papers and a coding practice platform. Campus processes often put an aptitude test and an HR interview around the technical round, and you can practise those here. A project defence is the part of a technical interview you can practise here.', outside: true },
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
    'defence-line': { tool: 'Defence', title: 'Defend one line of your résumé', minutes: 8, open: { tool: 'defence', mode: 'line' },
      why: 'An interviewer picks a line and keeps asking: what was measured, what you did yourself, what else could explain it.' },
    'defence-project': { tool: 'Defence', title: 'Defend a project: five questions', minutes: 8, open: { tool: 'defence', mode: 'project' },
      why: 'Technical and HR interviewers both start from your project: why you built it that way, what you did yourself, what failed and how you know it worked.' },
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
    'move-answer-first': { tool: 'Moves', title: 'Train one move: Answer first', minutes: 5, open: { tool: 'moves', move: 'answer-first' },
      why: 'Interviewers decide early whether you understood the question. Practise putting your answer in the first sentence, then the reasons.' },
    'move-so-what': { tool: 'Moves', title: 'Train one move: So what?', minutes: 5, open: { tool: 'moves', move: 'so-what' },
      why: 'In a case, reading a table back earns nothing. Practise saying what it means and what you would do next.' },
    'move-number-sense': { tool: 'Moves', title: 'Train one move: Does that number make sense?', minutes: 5, open: { tool: 'moves', move: 'number-sense' },
      why: 'A confident wrong figure is hard to recover from. Practise catching lakh and crore, period and percentage slips before you say them.' },
    'move-triage': { tool: 'Moves', title: 'Train one move: Attempt, leave or guess', minutes: 5, open: { tool: 'moves', move: 'triage' },
      why: 'A test gives about a minute a question. Practise sorting the questions first, so the quick marks are not left for the last minutes.' },
    'move-split-it': { tool: 'Moves', title: 'Train one move: Split it', minutes: 5, open: { tool: 'moves', move: 'split-it' },
      why: 'Your structure decides what you look at next. Practise splitting a problem into branches that do not overlap and leave nothing out.' },
    'move-one-question': { tool: 'Moves', title: 'Train one move: Ask the one question', minutes: 5, open: { tool: 'moves', move: 'one-question' },
      why: 'One sharp question beats a request for all the data. Practise asking the question whose answer changes your next step.' },
    'move-hold-or-change': { tool: 'Moves', title: 'Train one move: Hold or change', minutes: 5, open: { tool: 'moves', move: 'hold-or-change' },
      why: 'Interviewers push back to test you. Practise holding for a reason, and changing only for a new fact.' },
    'move-put-a-number': { tool: 'Moves', title: 'Train one move: Put a number on it', minutes: 5, open: { tool: 'moves', move: 'put-a-number' },
      why: 'Interviewers write down numbers, not adjectives. Practise saying what you did and how much changed.' },
    'move-next-line': { tool: 'Moves', title: 'Train one move: Your next line', minutes: 5, open: { tool: 'moves', move: 'next-line' },
      why: 'Observers note what each line did for the group. Practise reading what the discussion needs before you speak.' },
    'gd-kit': { tool: 'Group discussion', title: 'Run a group discussion with friends', minutes: 15, open: { tool: 'gd' },
      why: 'Three to six of you, a brief with evidence that pulls both ways, a clock and an observer’s tally.' },
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
      case 'aptitude': return minutes <= 10 ? ['apt-mixed'] : minutes <= 20 ? ['apt-mock-short', 'apt-weak'] : ['apt-mock', 'apt-weak', 'move-triage', 'apt-mixed', 'drill-maths', ...(minutes >= 45 ? ['move-number-sense'] : [])];
      case 'case': return short ? (warmupDone ? ['drill-maths', 'move-split-it', 'move-so-what', 'bh-motivation', 'move-number-sense', 'move-one-question'] : ['warmup', 'drill-maths', 'move-split-it', 'move-so-what', 'move-number-sense', 'move-one-question'])
        : [CASE_FOR[role] || CASE_FOR.other, SECOND_CASE[role] || SECOND_CASE.other, 'drill-maths', 'move-split-it', 'move-so-what', 'bh-motivation', 'move-one-question', 'move-number-sense'];
      case 'hr': return ['bh-intro', 'move-answer-first', 'defence-line', 'bh-motivation', 'bh-mixed', 'resume', 'move-put-a-number', 'bh-stories', 'move-hold-or-change'];
      case 'gd': return ['gd-kit', { id: 'gd-moves' }, 'move-next-line', 'move-answer-first', 'bh-conflict', { id: 'warmup', why: 'Its last step is a 30-second recommendation: the same skill as summarising a group discussion.' }, 'bh-teamwork', 'bh-mixed'];
      case 'resume': return ['resume', 'defence-line', 'move-put-a-number', 'bh-intro', 'bh-stories', 'bh-motivation', 'apt-mixed'];
      case 'technical': return ['defence-project', 'apt-mixed', 'move-hold-or-change', 'bh-intro', 'resume', 'bh-motivation', 'apt-mock'];
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
