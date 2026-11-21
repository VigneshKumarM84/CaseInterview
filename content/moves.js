/* Moves: one interview behaviour trained in a five-minute set. Each move has three rungs:
   Learn (the rule, with a weak and a strong example), Spot (pick the stronger answer or find the flaw, checked in code)
   and Do (produce it against a clock, then compare with weak, adequate and strong examples).
   This file holds the wording: the move definitions, the labels the generators use and the authored Answer first items.
   The generators and checks live in src/moves-logic.js. Data only, so Node tests load it directly.
   Every figure is fictional and internally consistent: tests/moves-logic.test.cjs checks the arithmetic it can. */
(function (root) {
  const MOVES = [
    {
      id: 'answer-first', title: 'Answer first', minutes: 5,
      tagline: 'Say your answer in the first sentence.',
      where: 'HR, case, group discussion, defence',
      rule: [
        'Sentence one is your answer, in words the interviewer could repeat.',
        'Then two reasons, each with a fact or a number.',
        'Then stop. Thirty seconds is about 75 words.'
      ],
      why: 'Interviewers decide early whether you understood the question. If your answer comes last, they spend the whole reply wondering where it is going.',
      example: {
        question: 'Should our club charge a membership fee?',
        weak: 'The club has 80 members and spends about ₹40,000 a year. The college grant covers ₹25,000. Events cost more each year. So I think we should charge a fee.',
        strong: 'Yes, charge ₹200 a year. The college grant covers ₹25,000 of our ₹40,000 costs, and ₹200 from 80 members closes the gap with ₹1,000 to spare.',
        note: 'Same facts. The second one starts where the first one ends, and it commits to an amount.'
      },
      spot: { prompt: 'Which opening answers the question?' },
      do: { seconds: 30, prompt: 'Answer in 30 seconds, using the facts above. Say it out loud if you can.', placeholder: 'Start with your answer…' }
    },
    {
      id: 'so-what', title: 'So what?', minutes: 5,
      tagline: 'Say what the table means, not what it shows.',
      where: 'Case interview, analyst roles, data interpretation',
      rule: [
        'Find the one comparison that matters: what changed, and where.',
        'Say it with its number.',
        'Add what follows: where to look, or what to do next.'
      ],
      why: 'Reading the numbers back is the most common mistake with an exhibit. The interviewer can see the table. They want to know what you make of it.',
      example: {
        question: 'Hostel complaints, last term and this term',
        table: { columns: ['Block', 'Last term', 'This term'], rows: [['A', '40', '41'], ['B', '42', '41'], ['C', '38', '98'], ['Total', '120', '180']] },
        weak: 'Complaints rose from 120 to 180.',
        strong: 'All 60 extra complaints came from Block C, so I would ask what changed there this term.',
        note: 'The first reads the total back. The second says where the change is and what to do about it.'
      },
      spot: { prompt: 'Which statement is the insight?', seconds: 45 },
      do: { seconds: 45, prompt: 'In a sentence or two: what does this table mean, and what follows?', placeholder: 'The table shows that…, so…',
        grades: { weak: 'Reads the table back.', adequate: 'Says what changed and where, but not what follows.', strong: 'Says what changed, where, and what to do about it.' } }
    },
    {
      id: 'number-sense', title: 'Does that number make sense?', minutes: 5,
      tagline: 'Catch a wrong figure before you say it.',
      where: 'Case interview, guesstimates, aptitude test',
      rule: [
        'Redo it roughly in your head with round numbers.',
        'Check the unit and the period: lakh or crore, a month or a year.',
        'For any percentage, ask: percent of what?'
      ],
      why: 'Interviewers forgive slow arithmetic. They notice a figure that could not be true, and a confident wrong number is hard to recover from.',
      example: {
        question: 'A gym has 500 members paying ₹1,200 a month, so it earns ₹6 lakh a year.',
        weak: 'Sounds about right.',
        strong: '500 × ₹1,200 is ₹6 lakh a month, so ₹72 lakh a year. The period was dropped.',
        note: 'The arithmetic was fine. The slip was in the period, which is why it is worth saying the unit with every figure.'
      },
      spot: { prompt: 'Is the final figure right?', seconds: 15 },
      do: { seconds: 20, prompt: 'Type the figure you would say to the interviewer. It may already be right.' }
    },
    {
      id: 'split-it', title: 'Split it', minutes: 5,
      tagline: 'Break a problem into parts that do not overlap and leave nothing out.',
      where: 'Case interview, guesstimates',
      rule: [
        'Split the problem into three or four branches that add up to the whole.',
        'Check each pair: no branch should repeat part of another.',
        'Keep the branches at one level: parts of the whole, not a part of a part.'
      ],
      why: 'Your structure decides what you look at next. Two branches that overlap mean checking the same thing twice, and a missing branch means the answer may sit in the part you never opened.',
      example: {
        question: 'Why has the college canteen’s profit fallen?',
        weak: 'Higher costs\nFewer customers\nVegetable prices\nOther reasons',
        strong: 'Fewer students buying\nLess spent by each student\nHigher food costs\nHigher staff, gas and rent',
        note: 'In the first, vegetable prices sit inside costs, “other reasons” hides what was not thought of, and nothing covers what each student spends. The second splits profit into revenue and costs, then splits each once.'
      },
      spot: { prompt: 'What is wrong with this split?' },
      do: { seconds: 60, prompt: 'Split the problem into three or four branches, one per line.', placeholder: 'One branch per line…',
        grades: { weak: 'Branches overlap, one sits inside another, or one is “Other”.', adequate: 'Separate branches, but one is missing or at the wrong level.', strong: 'Three or four branches at one level that add up to the whole.' } }
    },
    {
      id: 'one-question', title: 'Ask the one question', minutes: 5,
      tagline: 'Ask the question whose answer changes what you do next.',
      where: 'Case interview, project defence',
      rule: [
        'Before you ask, say to yourself what you would do with each possible answer.',
        'Ask one question, about one thing the brief does not already tell you.',
        'Say why you are asking: what the answer will decide.'
      ],
      why: 'Interviewers notice which questions you ask more than how many. A question the brief already answers, or a request for all the data, tells them you have not yet worked out what matters.',
      example: {
        question: 'The canteen served as many meals this term as last, but its profit fell by a third.',
        weak: 'Can I see all the data on the canteen’s sales and costs?',
        strong: 'Has the cost of making a meal gone up? Meals are flat, so profit fell through price or cost, and if cost is flat I would look at price next.',
        note: 'The first asks for everything. The second uses the brief to narrow the cause to two, then asks about one of them.'
      },
      spot: { prompt: 'Which question would you ask first?' },
      do: { seconds: 45, prompt: 'Write the one question you would ask first, then why its answer changes your next step.', placeholder: 'My question… because…',
        grades: { weak: 'Asks for everything, asks several things, or asks what the brief already says.', adequate: 'One clear question, but no reason for asking it.', strong: 'One question the brief does not answer, and what the answer would make you do.' } }
    },
    {
      id: 'hold-or-change', title: 'Hold or change', minutes: 5,
      tagline: 'When the interviewer pushes back, change your answer for a fact, not for pressure.',
      where: 'Case interview, HR interview, project defence',
      rule: [
        'Ask yourself one thing: did they give me a new fact, or only doubt?',
        'Only doubt: hold, and give your reason again in one line, with its number.',
        'A new fact: say what it changes and change only that. If it changes nothing, say why.'
      ],
      why: 'Interviewers push back to see how you think, not always because you are wrong. Dropping a sound answer at the first frown looks as weak as clinging to one after the facts have changed.',
      example: {
        question: 'You recommended a one-month trial of late canteen hours. The interviewer says: “I’m not convinced. Are you sure?”',
        weak: 'You’re right, sorry. Maybe we should not do it.',
        strong: 'I would still run the trial. 120 students say they would buy dinner, which leaves ₹4,800 an evening against ₹3,000 of cost, and the trial is how we find out if they mean it.',
        note: 'The interviewer added doubt, not a fact. The first answer gives up anyway. The second holds and gives the reason again, with its number.'
      },
      spot: { prompt: 'What would you say?' },
      do: { seconds: 30, prompt: 'Hold or change? Write the line you would say. Say it out loud if you can.', placeholder: 'I would still… because… / That changes…',
        grades: { weak: 'Gives way with nothing new, or ignores a new fact.', adequate: 'Makes a clear call, but with no reason or number.', strong: 'Says hold or change first, then the fact behind it, calmly.' } }
    },
    {
      id: 'put-a-number', title: 'Put a number on it', minutes: 5,
      tagline: 'Turn “we improved things” into what you did and how much changed.',
      where: 'HR interview, résumé, project defence',
      rule: [
        'Say what you did yourself, with “I”. Keep “we” for what the team did.',
        'Give the measure: from what to what, or how many.',
        'Swap every “significantly” or “a lot” for the number it stands for.'
      ],
      why: 'A vague line invites the follow-up “how much?” and sounds as if you do not know. A number with its base, said as your own work, is something the interviewer can write down and repeat to the panel.',
      example: {
        question: 'We significantly improved the canteen ordering process.',
        weak: 'We worked very hard and significantly improved the process for everyone.',
        strong: 'I set up pre-ordering on a shared form, and the lunch queue fell from about 25 minutes to 8 in the first month.',
        note: 'The first could describe anything. The second says what you did, what changed and by how much.'
      },
      spot: { prompt: 'Which version would you say?' },
      do: { seconds: 45, prompt: 'Say the line again with a number and what you did yourself. Use the facts above.', placeholder: 'I… and… fell from… to…',
        grades: { weak: 'Still vague: no number, or only “we”.', adequate: 'Has a number, but not your part, or a percentage with no base.', strong: 'What you did, and the measure from and to, in one or two sentences.' } }
    },
    {
      id: 'next-line', title: 'Your next line', minutes: 5,
      tagline: 'Say what the group needs now, not only what you think.',
      where: 'Group discussion',
      rule: [
        'Listen to the last three lines and ask: what is missing right now?',
        'Pick one move: build on a point, bring someone in, steer back to the task, or sum up.',
        'Say it in two sentences, with a name or a point you have just heard.'
      ],
      why: 'Observers note what each contribution did for the group. A good point at the wrong moment, or a fifth opinion when the group needs a summary, counts for less than a plain line that moves the discussion on.',
      example: {
        question: 'The group is deciding whether the hostel should ban phones in the mess.',
        lines: [
          { who: 'Rohan', text: 'Phones make the mess antisocial. Nobody talks at dinner any more.' },
          { who: 'Ananya', text: 'But a ban is too much. People pay at the counter with their phones.' },
          { who: 'Rohan', text: 'Like I said, nobody talks any more.' }
        ],
        weak: 'I also think phones are a problem in the mess, and it is a very important topic.',
        strong: 'Ananya’s payment point suggests a middle path: phones at the counter, but not at the tables. Would that answer Rohan’s worry about nobody talking?',
        note: 'Rohan is repeating himself. The first line adds a third voice to the same point. The second builds on Ananya and gives the group something to decide.'
      },
      spot: { prompt: 'What does the group need next?' },
      do: { seconds: 30, prompt: 'Write your next line, in two sentences at most. Say it out loud if you can.', placeholder: 'Building on… / We have two minutes…',
        grades: { weak: 'Adds an opinion without connecting to anyone, or only agrees.', adequate: 'Connects to the group but does not move it on.', strong: 'Does the one thing the group needs, with a name or a point, in two sentences.' } }
    },
    {
      /* A round, not a set of items: sort eight aptitude questions, then sit them against a clock. See TRIAGE below. */
      id: 'triage', kind: 'round', title: 'Attempt, leave or guess', minutes: 5,
      tagline: 'Pick up the quick marks first.',
      where: 'Online aptitude test',
      labels: { spot: 'Sort calls', do: 'Rounds' },
      rule: [
        'Give each question ten seconds: enough to recognise the type, not to solve it.',
        'Do the ones you can finish inside a minute first. Come back to the long ones. Leave the ones you cannot start.',
        'Guess only after ruling options out. Each option you remove makes the guess worth more.'
      ],
      why: 'Most aptitude tests give you about a minute a question, and every question carries the same mark. People who work through in order run out of time on questions they could have answered.',
      example: {
        question: 'A test has 20 questions in 20 minutes, with a quarter mark off for each wrong answer.',
        weak: 'Start at question 1 and work through in order. Spend four minutes on question 3 because it feels close. Guess the last six in the final minute.',
        strong: 'First pass: answer the nine you can do in under a minute each. Second pass: go back to the five longer ones. Leave the six you cannot start, and guess only where you have ruled out two options.',
        note: 'Both sat the same paper. The second spent the time where the marks were quickest.'
      }
    }
  ];

  /* The round for Attempt, leave or guess. Sort: ten seconds a question. Sit: three and a half minutes for all eight,
     which is not enough, so the order matters. `quick` is the longest a "Do now" question may take and still be a good
     call; `fast` is how quickly a question you put off must fall for it to count as a quick mark you missed. */
  const TRIAGE = {
    questions: 8, sortSeconds: 10, sitSeconds: 210, right: 1, wrong: -0.25, quick: 60, fast: 40,
    calls: [
      { id: 'now', label: 'Do now', note: 'I can finish this inside a minute.' },
      { id: 'later', label: 'Later', note: 'I know how, but it is long.' },
      { id: 'leave', label: 'Leave', note: 'I cannot see how to start.' }
    ],
    guess: 'With four options and a quarter mark off, a blind guess is worth about 0.06 of a mark. Rule out two options first and it is worth about 0.38.',
    pass: 'A round passes when at least three in four of your Do now calls were right inside a minute, with no more than one wrong answer.'
  };

  /* How an opening line fails, for Answer first. The reason is shown when that option is picked. */
  const OPENINGS = {
    answer: { label: 'Answers the question', why: 'It answers the question asked, in one sentence the interviewer could repeat.' },
    windup: { label: 'Warms up', why: 'This warms up without saying anything. The interviewer still does not know your answer.' },
    context: { label: 'Starts with background', why: 'This is background. It may belong in the answer, but after the point it supports.' },
    hedge: { label: 'Avoids choosing', why: 'This avoids choosing. You can name a condition later, but commit to an answer first.' }
  };

  /* What each kind of statement about a table is, for So what?. */
  const STATEMENTS = {
    insight: { label: 'Insight', why: 'It names the number that matters and says what follows from it.' },
    description: { label: 'Describes the table', why: 'True, but it reads the table back. The interviewer can already see it. Say what it means.' },
    overreach: { label: 'Goes beyond the data', why: 'The table shows what happened, not why. This names a cause and an action the data does not support yet.' },
    misread: { label: 'Misreads the table', why: 'Check the figures again. The table does not say this.' }
  };

  /* The slips Does that number make sense? plants, with the habit that catches each one. */
  const SLIPS = [
    { id: 'zeros', label: 'Lakh and crore mixed up', habit: 'Count the zeros. One lakh has five and one crore has seven.' },
    { id: 'period', label: 'Month and year mixed up', habit: 'Say the period out loud with every figure: a month, or a year.' },
    { id: 'points', label: 'Percentage points called per cent', habit: 'A move from 4% to 5% is one percentage point, and 25% more.' },
    { id: 'base', label: 'Percentage taken of the wrong base', habit: 'A change is measured against the value you started from.' },
    { id: 'average', label: 'Simple average where the sizes differ', habit: 'Weight each value by how many it applies to.' },
    { id: 'profit', label: 'Revenue reported as profit', habit: 'Profit is what is left after the costs come out.' },
    { id: 'compound', label: 'Percentages added when they compound', habit: 'A 20% fall followed by a 20% rise leaves you 4% down.' }
  ];

  /* What the three comparison answers are called on the Do rung. */
  const GRADES = {
    weak: { label: 'Weak', note: 'The answer arrives last, or not at all.' },
    adequate: { label: 'Adequate', note: 'The answer comes first, but the support is general.' },
    strong: { label: 'Strong', note: 'The answer, then specific support, then it stops.' }
  };

  /* Authored items for Answer first. Each works on both rungs: `openings` for Spot, `facts` and the three graded answers for Do. */
  const ANSWER_FIRST = [
    {
      id: 'af-strength', round: 'HR', question: 'What is your biggest strength?',
      facts: ['You led 14 people organising your department’s tech fest.', 'You set weekly checkpoints and the fest ran on schedule.', 'Two juniors you trained now run the registration desk on their own.', 'You also enjoy learning new tools.'],
      openings: [
        { kind: 'answer', text: 'My biggest strength is getting a group to finish on time.' },
        { kind: 'windup', text: 'That is an interesting question, and I have thought about it a lot.' },
        { kind: 'context', text: 'In my second year I joined the organising committee of our tech fest.' },
        { kind: 'hedge', text: 'I have several strengths, and which one matters depends on the situation.' }
      ],
      weak: 'In my second year I joined the organising committee of our tech fest. There were 14 of us and a lot to do. I made weekly checkpoints and trained two juniors for the registration desk. The fest ran on schedule. So I would say I am good at organising, and I also like learning new tools.',
      adequate: 'My biggest strength is organising people. I am good at planning and at working with a team, and I have done this many times in college. People usually find me dependable.',
      strong: 'My biggest strength is getting a group to finish on time. When I led 14 people for our tech fest, I set weekly checkpoints and the fest ran on schedule. I also trained two juniors who now run the registration desk on their own.'
    },
    {
      id: 'af-weakness', round: 'HR', question: 'Tell me about a weakness.',
      facts: ['You tend to take over work instead of delegating it.', 'In your final-year project you rewrote a teammate’s module the night before a review.', 'You now name an owner for each part at the start and review only at checkpoints.', 'Your last two submissions went in a day early.'],
      openings: [
        { kind: 'answer', text: 'My weakness is that I take over work instead of delegating it.' },
        { kind: 'windup', text: 'Well, everybody has weaknesses, and I am no different.' },
        { kind: 'context', text: 'During my final-year project we had a review coming up and one module was behind.' },
        { kind: 'hedge', text: 'I am not sure it is a weakness exactly, but sometimes I may work a bit too hard.' }
      ],
      weak: 'During my final-year project one module was behind before a review, so I stayed up and rewrote it myself. My teammate was upset. I realised later that I do this often. Now I assign owners and review at checkpoints. So I suppose delegation is my weakness.',
      adequate: 'My weakness is delegation. I tend to do things myself because I want them done properly. I am working on it and I have improved a lot.',
      strong: 'My weakness is that I take over work instead of delegating it. In my final-year project I rewrote a teammate’s module the night before a review. Since then I name an owner for each part at the start and review only at checkpoints, and our last two submissions went in a day early.'
    },
    {
      id: 'af-why-role', round: 'HR', question: 'Why do you want this analyst role?',
      facts: ['You spent a semester working out why your mess wastage rose, using six months of data.', 'Presenting the findings was the part you enjoyed most.', 'This company’s analysts present to clients from their first year.', 'The company has twelve offices.'],
      openings: [
        { kind: 'answer', text: 'I want this role because I like finding the reason behind a number and explaining it to people.' },
        { kind: 'windup', text: 'First of all, thank you for the opportunity to interview for this role.' },
        { kind: 'context', text: 'Your company was founded in 2009 and has grown to twelve offices.' },
        { kind: 'hedge', text: 'I am open to many roles, and analyst seems like one good option among them.' }
      ],
      weak: 'Your company has grown a lot and has offices in many cities. Analysts here get to present to clients early. In college I analysed six months of mess data to find why wastage rose. I enjoyed that. So this role suits me.',
      adequate: 'I want this role because I like working with data and I think I would be good at it. It matches my skills and my interests, and the company is a great place to learn.',
      strong: 'I want this role because I like finding the reason behind a number and explaining it to people. I spent a semester working out why our mess wastage rose, using six months of data, and presenting it was the part I enjoyed most. Your analysts present to clients from the first year, which is the work I want.'
    },
    {
      id: 'af-conflict', round: 'HR', question: 'Tell me about a time you disagreed with a teammate.',
      facts: ['At a hackathon, a teammate wanted to use a framework none of you knew.', 'You proposed trying both options for two hours.', 'The familiar framework produced a working login screen in the trial. The new one did not.', 'Your team used the familiar one and placed third of 40.'],
      openings: [
        { kind: 'answer', text: 'I disagreed with a teammate over which framework to use at a hackathon, and we settled it with a two-hour trial.' },
        { kind: 'windup', text: 'So basically, conflict is something that happens in every team.' },
        { kind: 'context', text: 'Last year our college hosted a 24-hour hackathon with 40 teams.' },
        { kind: 'hedge', text: 'I do not really have conflicts with people, but there may have been small differences.' }
      ],
      weak: 'Last year there was a 24-hour hackathon with 40 teams. One teammate wanted a framework none of us knew. I was not comfortable. We discussed it for a while. Finally we tried both for two hours and picked the one we knew, and we came third.',
      adequate: 'I disagreed with a teammate about which framework to use at a hackathon. We talked it through calmly and reached a decision that everyone was happy with, and the project went well.',
      strong: 'I disagreed with a teammate over which framework to use at a hackathon, and we settled it with a two-hour trial. He wanted one none of us knew. In the trial, the familiar one produced a working login screen and the new one did not, so we used the familiar one and placed third of 40 teams.'
    },
    {
      id: 'af-canteen', round: 'Case', question: 'Should the college canteen stay open until 9 pm?',
      facts: ['About 300 students leave the labs after 7 pm.', 'In a survey, 40% of them said they would buy dinner.', 'Each dinner leaves ₹40 after ingredients.', 'Extra staff and gas would cost ₹3,000 an evening.', 'The hostel mess already serves dinner until 8:30 pm.'],
      openings: [
        { kind: 'answer', text: 'Yes, keep it open until 9 pm, starting with a one-month trial.' },
        { kind: 'windup', text: 'There are many factors to consider in a decision like this.' },
        { kind: 'context', text: 'The canteen currently closes at 7 pm and has done so for several years.' },
        { kind: 'hedge', text: 'It could work, but it also might not, depending on how many students come.' }
      ],
      weak: 'About 300 students leave labs after 7 pm. A survey says 40% would buy dinner, which is 120 students. Each dinner leaves ₹40 after ingredients, so that is ₹4,800. Staff and gas cost ₹3,000. The mess also serves dinner. So maybe the canteen should stay open.',
      adequate: 'Yes, the canteen should stay open later. There seems to be enough demand from students who finish late, and it should make money, though the mess is a competitor.',
      strong: 'Yes, keep it open until 9 pm, starting with a one-month trial. About 120 of the 300 late students say they would buy dinner, which leaves ₹4,800 an evening against ₹3,000 of extra cost. The risk is that the survey overstates demand because the mess serves until 8:30, which the trial will show.',
      sums: [['dinners', 300 * 0.4, 120], ['left after ingredients', 120 * 40, 4800]]
    },
    {
      id: 'af-bookshop', round: 'Case', question: 'Why did the campus bookshop’s profit fall this year?',
      facts: ['Revenue was the same in both years: ₹24 lakh.', 'Stationery rose from 30% of sales to 50%. Books make up the rest.', 'Stationery earns a 10% margin. Books earn 25%.', 'Rent did not change.'],
      openings: [
        { kind: 'answer', text: 'Profit fell because sales shifted from books to stationery, which earns less than half the margin.' },
        { kind: 'windup', text: 'To begin with, profit is revenue minus cost, so I will look at both.' },
        { kind: 'context', text: 'The bookshop sells books and stationery and pays a fixed rent to the college.' },
        { kind: 'hedge', text: 'It might be costs or it might be revenue. It is difficult to say without more data.' }
      ],
      weak: 'Revenue was the same at ₹24 lakh and rent did not change. Books earn 25% and stationery 10%. Stationery went from 30% of sales to 50%. So gross profit went from ₹4.92 lakh to ₹4.2 lakh. That means the mix is the problem.',
      adequate: 'Profit fell because of the product mix. The shop is selling more low-margin items than before, so even with the same revenue it makes less money.',
      strong: 'Profit fell because sales shifted from books to stationery, which earns less than half the margin. Stationery rose from 30% to 50% of the same ₹24 lakh revenue, at 10% margin against 25% for books. That alone cuts gross profit by about ₹72,000, and rent did not change.',
      sums: [['gross profit last year, ₹ lakh', 24 * 0.7 * 0.25 + 24 * 0.3 * 0.10, 4.92], ['gross profit this year, ₹ lakh', 24 * 0.5 * 0.25 + 24 * 0.5 * 0.10, 4.2], ['fall, ₹', (4.92 - 4.2) * 100000, 72000]]
    },
    {
      id: 'af-tea', round: 'Case', question: 'You have finished your estimate. The interviewer asks: so how many cups of tea does the campus stall sell in a day?',
      facts: ['There are 4,000 students on campus.', 'You assumed one in four buys tea on a given day.', 'Buyers average 1.5 cups.', 'Staff and visitors add about 10%.'],
      openings: [
        { kind: 'answer', text: 'About 1,650 cups a day.' },
        { kind: 'windup', text: 'Okay, so let me first go back over how I approached this estimate.' },
        { kind: 'context', text: 'The campus has about 4,000 students, plus teaching staff and visitors.' },
        { kind: 'hedge', text: 'It is hard to say exactly, because it changes with the weather and the exam schedule.' }
      ],
      weak: 'The campus has 4,000 students. Maybe one in four buys tea on a given day, so 1,000 buyers. They average 1.5 cups, so 1,500. Staff and visitors add 10%. So the total is about 1,650 cups.',
      adequate: 'About 1,650 cups a day. I based it on the number of students and how often they drink tea, with a little added for staff and visitors.',
      strong: 'About 1,650 cups a day. Roughly one in four of the 4,000 students buys tea on a given day at 1.5 cups each, which is 1,500, and staff and visitors add about 10%. The one-in-four share is the assumption I would check first.',
      sums: [['student cups', 4000 * 0.25 * 1.5, 1500], ['all cups', 1500 * 1.1, 1650]]
    },
    {
      id: 'af-delivery', round: 'Case', question: 'A grocery app’s late deliveries doubled last month. What would you look at first?',
      facts: ['Late orders rose from 6% of orders to 12%.', 'The number of orders was flat.', 'Two of the nine dark stores account for 80% of the late orders.', 'Both of those stores lost riders to a rival in the same month.'],
      openings: [
        { kind: 'answer', text: 'I would look first at the two stores that account for 80% of the late orders.' },
        { kind: 'windup', text: 'There are several possible reasons for late deliveries, such as traffic, staffing and demand.' },
        { kind: 'context', text: 'Late deliveries rose from 6% of orders to 12% last month.' },
        { kind: 'hedge', text: 'It could be many things, so I would want to look at everything before deciding.' }
      ],
      weak: 'Late orders went from 6% to 12% while volume stayed flat, so it is not a demand problem. There are nine dark stores. Two of them had 80% of the late orders, and they lost riders to a rival. So I would look at those two stores.',
      adequate: 'I would look at the stores first, because the problem seems to be concentrated in some locations rather than spread evenly, and staffing may be involved.',
      strong: 'I would look first at the two stores that account for 80% of the late orders. Volume was flat, so this is not a demand surge, and both stores lost riders to a rival in the same month. If rider numbers explain it, the fix is local and quick to test.'
    },
    {
      id: 'af-attendance', round: 'Group discussion', question: 'The topic is “Should 75% attendance be compulsory?” You are the first to speak.',
      facts: ['Your view: compulsory for labs, not for lectures.', 'Lab work cannot be made up from notes.', 'Most of your lectures are already recorded.', 'A neighbouring college dropped the lecture rule two years ago and its pass rate held at 91%.'],
      openings: [
        { kind: 'answer', text: 'I think attendance should be compulsory for labs but not for lectures.' },
        { kind: 'windup', text: 'Good morning everyone, today we are here to discuss a very important topic.' },
        { kind: 'context', text: 'Attendance rules have existed in Indian colleges for decades.' },
        { kind: 'hedge', text: 'There are good arguments on both sides, and both views have merit.' }
      ],
      weak: 'Attendance has been compulsory for a long time. Some students say it is unfair and some teachers say it is needed. Lectures are recorded now. Labs are different because you cannot learn them from notes. So perhaps the rule should apply only to labs.',
      adequate: 'I think attendance should be compulsory for labs but not for lectures. Labs are practical and lectures are not, so the rule makes more sense for one than the other.',
      strong: 'I think attendance should be compulsory for labs but not for lectures. Lab work cannot be made up from notes, while most of our lectures are already recorded. The neighbouring college dropped the lecture rule two years ago and its pass rate held at 91%.'
    },
    {
      id: 'af-summary', round: 'Group discussion', question: 'You are asked to summarise your group’s discussion on work from home for freshers.',
      facts: ['Most of the group agreed the first six months should be in the office.', 'The main reason given: freshers learn by watching seniors work.', 'Two members wanted hybrid working after six months.', 'Nobody supported fully remote from day one.'],
      openings: [
        { kind: 'answer', text: 'We agreed that freshers should spend their first six months in the office, then move to hybrid.' },
        { kind: 'windup', text: 'So, we had a very good and fruitful discussion with many valuable points.' },
        { kind: 'context', text: 'Priya started by talking about commute times, and then Arjun raised productivity.' },
        { kind: 'hedge', text: 'We discussed many views and it is difficult to say there was one conclusion.' }
      ],
      weak: 'Priya started with commute times, then Arjun talked about productivity. After that we discussed learning from seniors. Two people preferred hybrid. Nobody wanted fully remote. In the end most of us felt the first six months should be in the office.',
      adequate: 'We agreed that freshers should start in the office. Many points were raised on both sides and overall the group felt this was the best approach.',
      strong: 'We agreed that freshers should spend their first six months in the office, then move to hybrid. The main reason was that freshers learn by watching seniors work. Two of us wanted hybrid from six months on, and nobody supported fully remote from day one.'
    },
    {
      id: 'af-contribution', round: 'Defence', question: 'This was a team project. What was your own contribution?',
      facts: ['Four of you built an attendance app.', 'You wrote the face-matching module and its tests.', 'You cut false matches from 9% to 2% by adding a second check.', 'You did not build the interface.'],
      openings: [
        { kind: 'answer', text: 'I built the face-matching module and cut its false matches from 9% to 2%.' },
        { kind: 'windup', text: 'Basically, it was a team project and all of us worked together on it.' },
        { kind: 'context', text: 'The project was an attendance app that we built in our sixth semester.' },
        { kind: 'hedge', text: 'I was involved in most parts of it, more or less, along with the others.' }
      ],
      weak: 'It was an attendance app built by four of us in the sixth semester. We divided the work. The interface was done by others. The face-matching part had many false matches at first, around 9%. I added a second check and it came down to 2%. So that was my part.',
      adequate: 'I built the face-matching module. It was the most technical part of the project, and I worked hard to improve its accuracy and make it reliable.',
      strong: 'I built the face-matching module and cut its false matches from 9% to 2%. I did that by adding a second check before a match is accepted, and I wrote the tests for it. I did not build the interface. Two teammates did.'
    },
    {
      id: 'af-library', round: 'Defence', question: 'Your résumé says you “improved the library booking process”. What actually changed?',
      facts: ['Students used to queue at the desk for about 20 minutes to book a discussion room.', 'You replaced the queue with a shared sheet of time slots.', 'Booking now takes under two minutes.', 'The sheet handled 600 bookings in its first month.'],
      openings: [
        { kind: 'answer', text: 'Students now book a discussion room in under two minutes instead of queuing for twenty.' },
        { kind: 'windup', text: 'Well, the library booking process had a lot of issues that needed improvement.' },
        { kind: 'context', text: 'Our library has six discussion rooms that students can book for group work.' },
        { kind: 'hedge', text: 'I would say it improved things to some extent, though it is hard to measure.' }
      ],
      weak: 'Our library has six discussion rooms. Earlier, students had to queue at the desk to book one, and it took about 20 minutes. I made a shared sheet with time slots, and it was used for 600 bookings in the first month. So now the wait is under two minutes.',
      adequate: 'The booking process became much faster and easier for students. I moved it online, and it has been used a lot since then.',
      strong: 'Students now book a discussion room in under two minutes instead of queuing for twenty. I replaced the desk queue with a shared sheet of time slots, and it handled 600 bookings in its first month.'
    }
  ];

  /* The hub and the home page group the moves by the round they pay off in most. Every move sits in exactly one group. */
  const GROUPS = [
    { id: 'case', title: 'Case interview', moves: ['split-it', 'one-question', 'so-what', 'number-sense'] },
    { id: 'interview', title: 'HR, résumé and defence', moves: ['answer-first', 'hold-or-change', 'put-a-number'] },
    { id: 'gd', title: 'Group discussion', moves: ['next-line'] },
    { id: 'aptitude', title: 'Aptitude test', moves: ['triage'] }
  ];

  /* The five authored moves below share one shape. Every item works on both rungs: `options` for Spot (exactly one has
     `right: true`, and every option carries the reason shown when it is picked), and the item's situation with `weak`,
     `adequate` and `strong` for Do. `kind` names what an option is; the labels below are shown once a pick is made. */

  /* Split it: what each diagnosis of a breakdown claims. The right one names the real flaw; the others claim a flaw
     that is not there. Do answers are one branch per line. */
  const FLAWS = {
    overlap: { label: 'Says two branches overlap' },
    gap: { label: 'Says something is missing' },
    level: { label: 'Says a branch is at the wrong level' }
  };
  const SPLIT_IT = [
    {
      id: 'sp-bookshop', round: 'Case', question: 'The campus bookshop’s revenue fell 20% this year. Where would you look?',
      root: 'Revenue', branches: ['Fewer students buying from the shop', 'Each buyer spending less', 'Students switching to online sellers'], flaw: 'overlap',
      options: [
        { kind: 'overlap', right: true, text: 'Online switchers are already counted in “fewer students buying”.', why: 'A student who now buys online is also one of the students no longer buying from the shop, so they would be counted twice.' },
        { kind: 'gap', text: 'It misses price: there should be a branch for what the shop charges.', why: 'Price is already inside “each buyer spending less”. What a buyer spends is the number of items times their price.' },
        { kind: 'level', text: '“Each buyer spending less” is too broad to sit beside the other two.', why: 'Buyers times spend per buyer is revenue, so “spending less” is the same size as “fewer buying”. It is at the right level.' },
        { kind: 'gap', text: 'It leaves out the shop’s costs, which could also explain the fall.', why: 'The fall is in revenue. Costs change profit, not revenue, so they do not belong in this split.' }
      ],
      weak: 'Fewer students\nOnline competition\nPrices\nOther reasons',
      adequate: 'Fewer students buying\nEach buyer spending less\nCompetition from online sellers',
      strong: 'Fewer students buying from the shop\nFewer items bought by each buyer\nLower average price per item'
    },
    {
      id: 'sp-fest', round: 'Guesstimate', question: 'How many people come to the college fest over its two days?',
      root: 'People at the fest', branches: ['Students of our college', 'Visitors from outside the college', 'People who come on day two'], flaw: 'overlap',
      options: [
        { kind: 'overlap', right: true, text: '“Day two” cuts by day, so it counts the same people again.', why: 'The first two branches sort people by who they are and the third sorts them by day, so anyone there on day two sits in two branches.' },
        { kind: 'overlap', text: '“Students of our college” and “visitors from outside” overlap, because some visitors are alumni.', why: 'Alumni are no longer students here, so they are visitors. Each person is in one of those two branches, never both.' },
        { kind: 'gap', text: 'It leaves out the families and local people who come for the concert.', why: 'Families and local people are visitors from outside the college, so the second branch already covers them.' },
        { kind: 'level', text: '“Students of our college” is too big a group to stand as one branch.', why: 'Size is not level. Students can be split further underneath; at this level they sit fine beside visitors.' }
      ],
      weak: 'Students\nVisitors\nVisitors on day two\nEveryone else',
      adequate: 'Students of our college\nVisitors from outside\nStaff and volunteers',
      strong: 'Our own students\nStudents from other colleges\nFamilies and local people\nStaff and guests'
    },
    {
      id: 'sp-complaints', round: 'Case', question: 'Complaints at a 400-student hostel doubled this term. Where would you look?',
      root: 'Complaints', branches: ['About the mess', 'About the rooms and facilities', 'From first-year students'], flaw: 'overlap',
      options: [
        { kind: 'overlap', right: true, text: '“From first-years” cuts by who complained, so it counts the same complaints again.', why: 'The first two branches sort complaints by topic and the third sorts them by who made them, so a first-year’s mess complaint sits in two branches.' },
        { kind: 'gap', text: 'It misses complaints about the Wi-Fi, which hostels get a lot of.', why: 'Wi-Fi is one of the hostel’s facilities, so it sits under “rooms and facilities”.' },
        { kind: 'level', text: '“About the mess” is narrower than “rooms and facilities”, so they are at different levels.', why: 'Food and rooms are the two big things a hostel provides. The mess sits well beside rooms and facilities.' },
        { kind: 'gap', text: 'Nothing covers complaints that were resolved, so the count is too high.', why: 'Resolved or not, each complaint was made. Whether it was fixed is a later question, not a missing part of the count.' }
      ],
      weak: 'Mess food\nMess timings\nRooms\nOther',
      adequate: 'The mess\nRooms and facilities\nNew rules this term',
      strong: 'Food and the mess\nRooms, cleaning and repairs\nWi-Fi, water and power\nRules and staff'
    },
    {
      id: 'sp-delivery', round: 'Case', question: 'A food-delivery app that runs from noon to 2 am lost 30% of its orders from one campus. Where would you look?',
      root: 'Orders', branches: ['Lunch orders', 'Dinner orders', 'Late-night orders', 'Weekend orders'], flaw: 'overlap',
      options: [
        { kind: 'overlap', right: true, text: 'A Saturday dinner order would sit in two branches: dinner and weekend.', why: 'The first three branches sort orders by time of day. A Saturday dinner order is both a dinner order and a weekend order.' },
        { kind: 'gap', text: 'It misses breakfast orders, which have no branch of their own.', why: 'The app runs from noon to 2 am, so there are no breakfast orders to count.' },
        { kind: 'level', text: '“Late-night orders” is a small slice and should sit under dinner.', why: 'Late night is its own time of day, after dinner. A small branch is not the same as a branch a level below.' },
        { kind: 'overlap', text: 'Lunch and dinner overlap for the students who order both meals.', why: 'A student who orders both places two orders, one in each branch. The split counts orders, not students, so nothing is counted twice.' }
      ],
      weak: 'Lunch\nDinner\nWeekends\nOther times',
      adequate: 'Fewer students ordering\nFewer orders per student\nA rival app',
      strong: 'Lunch, noon to 3 pm\nEvening, 3 to 8 pm\nDinner, 8 to 11 pm\nLate night, 11 pm to 2 am'
    },
    {
      id: 'sp-library', round: 'Guesstimate', question: 'How many people walk into the central library on a weekday?',
      root: 'People walking in', branches: ['Undergraduates', 'Postgraduates', 'Research scholars'], flaw: 'gap',
      options: [
        { kind: 'gap', right: true, text: 'No branch counts faculty, staff or outside members, who use the library too.', why: 'All three branches are students. Teachers, staff and outside members also walk in, and this split would miss them.' },
        { kind: 'overlap', text: '“Postgraduates” and “research scholars” overlap, since both of them do research.', why: 'Doing research is not the cut. A student is registered either for a master’s or for a PhD, so each person sits in one branch.' },
        { kind: 'level', text: '“Research scholars” is too small a group to have a branch of its own.', why: 'A small branch is still at the same level: a kind of student, like the other two.' },
        { kind: 'gap', text: 'It should count the students who read the library’s e-books from home.', why: 'The question is who walks into the building. Reading e-books from home is a different count.' }
      ],
      weak: 'Students\nFirst-year students\nTeachers\nOthers',
      adequate: 'Undergraduates\nPostgraduates and scholars\nFaculty',
      strong: 'Students of every year\nFaculty\nNon-teaching staff\nOutside members'
    },
    {
      id: 'sp-electricity', round: 'Case', question: 'A hostel’s electricity bill rose 30% this term. Where would you look?',
      root: 'Electricity bill', branches: ['More units used in the rooms', 'More units used in the mess', 'More units used in common areas'], flaw: 'gap',
      options: [
        { kind: 'gap', right: true, text: 'If the tariff went up, no branch would catch it: all three are units.', why: 'All three branches are about units used. If the tariff went up, the bill rises with no extra use, and this split would never find it.' },
        { kind: 'level', text: '“The rooms” means hundreds of rooms, so it should be split before it sits beside the mess.', why: 'It can be split later, by block or floor. At this level the rooms sit beside the mess and common areas as places power is used.' },
        { kind: 'gap', text: 'Nothing covers the students who left their lights on over the holidays.', why: 'Lights left on in rooms are units used in the rooms. The first branch already covers them.' },
        { kind: 'overlap', text: '“The rooms” overlaps “common areas” for students who study in the lounge.', why: 'Power used in the lounge is metered as a common area, wherever the student sleeps. Each unit sits in one branch.' }
      ],
      weak: 'More use in rooms\nNew air coolers\nMess\nOther',
      adequate: 'Units used in rooms\nUnits used in the mess\nUnits used elsewhere',
      strong: 'Units used in rooms\nUnits used in the mess and common areas\nRate charged per unit'
    },
    {
      id: 'sp-coaching', round: 'Case', question: 'A coaching centre’s profit fell from ₹18 lakh to ₹11 lakh. Where would you look?',
      root: 'Profit', branches: ['Fewer students enrolling', 'Lower fee per student'], flaw: 'gap',
      options: [
        { kind: 'gap', right: true, text: 'Both branches are revenue, so nothing covers rent, pay or advertising.', why: 'Rent, teachers’ pay and advertising could explain the fall on their own, and this split would never look at them.' },
        { kind: 'overlap', text: '“Fewer students” and “lower fee” overlap, because discounts bring in more students.', why: 'One can cause the other, but they measure different things: how many students, and what each one pays. Nothing is counted twice.' },
        { kind: 'level', text: '“Lower fee per student” is a detail and belongs under “fewer students”.', why: 'Fee per student is a separate factor of revenue, not a part of the student count. The two sit at the same level.' },
        { kind: 'gap', text: 'It leaves out the students who dropped out halfway through the year.', why: 'Students who drop out pay less or nothing, which already shows up in the fee per student or the number enrolled.' }
      ],
      weak: 'Students\nFees\nFees after discounts',
      adequate: 'Fewer students\nLower fee per student\nHigher costs',
      strong: 'Fewer students enrolling\nLower fee per student\nHigher costs: teachers, rent, advertising'
    },
    {
      id: 'sp-bus', round: 'Case', question: 'The college bus service’s cost per trip rose 25% this year. Where would you look?',
      root: 'Cost per trip', branches: ['Fuel', 'Driver wages', 'Maintenance, insurance and permits'], flaw: 'gap',
      options: [
        { kind: 'gap', right: true, text: 'Fewer trips also raise the cost per trip, and no branch covers trips.', why: 'Cost per trip is total cost divided by trips. If routes were cut while costs stayed the same, every trip costs more and these three branches would not show it.' },
        { kind: 'overlap', text: '“Fuel” and “maintenance” overlap, since a badly kept bus burns more fuel.', why: 'One can affect the other, but the money goes on different things: diesel, and repairs. Each rupee sits in one branch.' },
        { kind: 'level', text: '“Maintenance, insurance and permits” joins three things, so it sits at a lower level.', why: 'Grouping small running costs keeps the split short. They are at the same level as fuel and wages.' },
        { kind: 'gap', text: 'Nothing covers the students who travel on the bus without a pass.', why: 'Students without a pass change the money coming in, not what a trip costs to run.' }
      ],
      weak: 'Fuel\nDiesel prices\nDrivers\nOther costs',
      adequate: 'Fuel\nDriver wages\nRepairs and other running costs',
      strong: 'Total cost: fuel and wages\nTotal cost: repairs, insurance, permits\nNumber of trips run'
    },
    {
      id: 'sp-repair', round: 'Case', question: 'A mobile repair shop near campus made less profit this year. Where would you look?',
      root: 'Profit', branches: ['Revenue', 'Costs', 'Price of replacement screens'], flaw: 'level',
      options: [
        { kind: 'level', right: true, text: '“Price of replacement screens” is a part of costs, not a third branch.', why: 'Screens belong under costs, next to rent and wages. Up here beside revenue and costs, it repeats part of one branch and hides the rest.' },
        { kind: 'overlap', text: '“Revenue” and “costs” overlap, because both depend on the number of repairs.', why: 'Both move with the number of repairs, but they are different money: what comes in and what goes out.' },
        { kind: 'gap', text: 'It misses the shop’s rent, which has no branch of its own.', why: 'Rent is a cost, so it is inside “costs”. It does not need a branch at this level.' },
        { kind: 'level', text: '“Revenue” is too broad and should be split before it sits beside costs.', why: 'It will be split next, into repairs and accessories, say. At this level, revenue and costs are the right pair.' }
      ],
      weak: 'Revenue\nCosts\nCost of screens\nRent',
      adequate: 'Repairs revenue\nAccessories revenue\nCosts',
      strong: 'Revenue from repairs\nRevenue from accessories\nCost of parts\nRent and wages'
    },
    {
      id: 'sp-offers', round: 'Case', question: 'Your college received fewer placement offers this year. Where would you look?',
      root: 'Offers made to our students', branches: ['Fewer companies visiting', 'Fewer offers from each company', 'The largest recruiter cutting its offers'], flaw: 'level',
      options: [
        { kind: 'level', right: true, text: 'The largest recruiter is one company inside “fewer offers from each company”.', why: 'It is one company inside the second branch. Put it under that branch, then check whether other companies cut offers too.' },
        { kind: 'overlap', text: '“Fewer companies” and “fewer offers each” overlap: a company that stops visiting makes no offers.', why: 'A company that stopped visiting is in the first branch. The second covers only companies that still came, so nothing is counted twice.' },
        { kind: 'gap', text: 'It misses the students who turned their offers down.', why: 'The question is offers made. Whether a student accepts comes after the offer has been counted.' },
        { kind: 'level', text: '“Fewer companies visiting” should be split into sectors before it is used.', why: 'It can be split by sector next. At this level it pairs with offers per company, and together they give all offers.' }
      ],
      weak: 'Fewer companies\nFewer IT companies\nFewer offers',
      adequate: 'Fewer companies visiting\nFewer offers per company\nThe economy',
      strong: 'Fewer companies visiting\nFewer offers from each company that came\nFewer of our students clearing the rounds'
    },
    {
      id: 'sp-rice', round: 'Guesstimate', question: 'How much rice does a 600-student hostel mess cook in a month? It serves rice at lunch and dinner only.',
      root: 'Rice a month', branches: ['Rice for lunch', 'Rice for dinner', 'Extra rice for Sunday lunch'], flaw: 'level',
      options: [
        { kind: 'level', right: true, text: 'Sunday lunch is one of the lunches, so it belongs under lunch.', why: 'Sunday lunch is one of the lunches. Keep two branches, lunch and dinner, and allow for Sundays inside the lunch branch.' },
        { kind: 'gap', text: 'It misses breakfast, when rice dishes are also served.', why: 'The question says rice is served at lunch and dinner only, so breakfast adds nothing.' },
        { kind: 'overlap', text: '“Rice for lunch” and “rice for dinner” overlap, since most students eat both.', why: 'A student who eats both meals eats two portions, one in each branch. The split counts portions, not students.' },
        { kind: 'level', text: '“Rice for dinner” is too broad and should be split by day of the week.', why: 'It can be split by day later. At this level it is the natural partner of rice for lunch.' }
      ],
      weak: 'Lunch\nDinner\nSunday lunch',
      adequate: 'Rice for lunch\nRice for dinner\nRice wasted',
      strong: 'Students eating lunch, times rice each\nStudents eating dinner, times rice each\nDays in the month'
    },
    {
      id: 'sp-gym', round: 'Case', question: 'The college gym had 500 members last year and has 380 now. Where would you look?',
      root: 'Members', branches: ['New members joining', 'Members leaving', 'Members leaving because the AC broke'], flaw: 'level',
      options: [
        { kind: 'level', right: true, text: 'The broken AC is a reason for leaving, a level below it.', why: 'It belongs under “members leaving”, beside other reasons such as fees or timings. Up here it looks like a third, separate cause.' },
        { kind: 'gap', text: 'It leaves out the members who renewed, and they should have a branch of their own.', why: 'Members who renewed did not change the count. The change is joiners minus leavers, which the first two branches cover.' },
        { kind: 'overlap', text: '“Joining” and “leaving” overlap for students who joined and then left.', why: 'Someone who joined and left counts once as a joiner and once as a leaver, and the two cancel. That is how the count works, not an overlap.' },
        { kind: 'level', text: '“New members joining” should be split into first-years and seniors first.', why: 'It can be split that way next. At this level it pairs with members leaving, and the two explain the change.' }
      ],
      weak: 'Members leaving\nMembers leaving because of fees\nFewer new members',
      adequate: 'Fewer new members joining\nMore members leaving\nThe AC breaking',
      strong: 'Fewer new members joining\nMore members leaving at renewal\nMore members leaving mid-term'
    }
  ];

  /* Ask the one question: what each question is. The right one is always `key`. */
  const QUESTIONS = {
    key: { label: 'Changes your next step' },
    nice: { label: 'Nice to know' },
    broad: { label: 'Too broad' },
    answered: { label: 'Already in the brief' },
    solution: { label: 'A solution in disguise' }
  };
  const ONE_QUESTION = [
    {
      id: 'oq-pune', round: 'Case', brief: 'A grocery app’s weekly orders in Pune fell 18% in March. Orders in its other four cities were flat.',
      known: ['Pune orders fell 18% in March.', 'Orders in the other four cities were flat.', 'The app raised its delivery fee in all five cities on 1 March.'],
      options: [
        { kind: 'key', right: true, text: 'Did anything change in Pune alone in March, like a new rival?', why: 'The fee rose everywhere but orders fell only in Pune, so the cause is something that happened in Pune alone. The answer tells you where to dig.' },
        { kind: 'answered', text: 'Did the delivery fee go up in Pune as well as the other cities?', why: 'The brief already says the fee rose in all five cities on 1 March.' },
        { kind: 'broad', text: 'Could you share all the order data you have for Pune?', why: 'This asks for everything and leaves the interviewer to decide what matters. Name the one thing you want and why.' },
        { kind: 'solution', text: 'Should we cut the delivery fee in Pune to win the orders back?', why: 'This is a fix, not a question. And the fee rose in every city, so it cannot explain a fall in Pune alone.' }
      ],
      weak: 'Can I see all the data on Pune orders and the delivery fee, and also the other cities?',
      adequate: 'What happened in Pune in March?',
      strong: 'Did anything change in Pune alone in March, like a new rival or fewer riders? The fee rose everywhere but only Pune fell, so if something changed there, that is where I would look first.'
    },
    {
      id: 'oq-passes', round: 'Case', brief: 'A college fest sold 2,400 passes last year and 1,500 this year.',
      known: ['Passes sold fell from 2,400 to 1,500.', 'The price stayed at ₹300.', 'About as many people came through the gate as last year.'],
      options: [
        { kind: 'key', right: true, text: 'How were people getting in this year without buying a pass?', why: 'As many people came but 900 fewer passes were sold, so the gap is people getting in another way: free passes, guests or weak gate checks. The answer points to the fix.' },
        { kind: 'answered', text: 'Was the price of a pass raised this year?', why: 'The brief says the price stayed at ₹300.' },
        { kind: 'nice', text: 'Which events on the schedule drew the biggest crowds this year?', why: 'Useful for next year’s schedule, but the crowd was the same size. It does not explain why fewer of them paid.' },
        { kind: 'solution', text: 'Would a lower price, say ₹200, sell more passes next year?', why: 'This proposes a fix. Nothing suggests price is the problem: the crowd came anyway.' }
      ],
      weak: 'What was the reason? And what was the budget? And how many events were there?',
      adequate: 'Were more free passes given out this year than last year?',
      strong: 'How were people getting in without a pass this year? The same crowd came but 900 fewer passes were sold, so the answer tells me whether to fix the free-pass list or the gate checks.',
      sums: [['passes not sold', 2400 - 1500, 900]]
    },
    {
      id: 'oq-cafe', round: 'Case', brief: 'A café chain’s Bengaluru store has the most customers of its six stores but the lowest profit.',
      known: ['The Bengaluru store has the most customers of the six.', 'It has the lowest profit.', 'All six charge the same prices.', 'All six buy from the same supplier.'],
      options: [
        { kind: 'key', right: true, text: 'Is the Bengaluru store’s rent or staff cost higher than the others’?', why: 'Prices and supplies are the same and it has more customers, so the difference must be in its other costs. Rent and staff are the big ones.' },
        { kind: 'answered', text: 'Do the six stores charge different prices for the same items?', why: 'The brief says all six charge the same prices.' },
        { kind: 'broad', text: 'Can you tell me everything about how the Bengaluru store is run?', why: 'Everything is not a question. Ask about the one cost that could explain the gap.' },
        { kind: 'solution', text: 'Should the Bengaluru store raise its prices above the other five?', why: 'This proposes a fix before the cause is known. If rent is the problem, the fix may be a different site.' }
      ],
      weak: 'Could you give me more information about the Bengaluru store?',
      adequate: 'What are the Bengaluru store’s costs?',
      strong: 'Is the Bengaluru store’s rent or staff cost much higher than the others’? Prices and supplies are the same and it has more customers, so if neither is higher I would look at waste next.'
    },
    {
      id: 'oq-trial', round: 'Case', brief: 'An online course platform’s sign-ups rose 40% after it added a free trial. Paid subscriptions stayed flat.',
      known: ['Sign-ups rose 40% after the free trial was added.', 'Paid subscriptions stayed flat.', 'The trial lasts seven days.'],
      options: [
        { kind: 'key', right: true, text: 'What share of trial users go on to pay?', why: 'Sign-ups rose but paid users did not, so the leak is between the trial and payment. That share tells you whether the trial is the problem.' },
        { kind: 'answered', text: 'How long does the free trial last before it ends?', why: 'The brief says seven days.' },
        { kind: 'broad', text: 'Can I see all the platform’s numbers for the last year?', why: 'A year of numbers is not a question. Ask for the one figure that connects sign-ups to payment.' },
        { kind: 'nice', text: 'Which courses do trial users open first?', why: 'Useful for the product team later, but it does not tell you whether trial users are paying.' }
      ],
      weak: 'Can you give me all the data you have?',
      adequate: 'How many trial users become paying users?',
      strong: 'What share of trial users go on to pay? Sign-ups rose 40% but paid users did not, so if that share fell, the trial is bringing in people who were never going to pay.'
    },
    {
      id: 'oq-tanker', round: 'Case', brief: 'A hostel’s water tanker bills doubled this summer.',
      known: ['Tanker bills doubled this summer.', 'The number of students is the same as last summer.', 'The tanker company’s price per load did not change.'],
      options: [
        { kind: 'key', right: true, text: 'Did the hostel’s own borewell give less water this summer?', why: 'Same students and same price, so the hostel bought more loads. A weaker borewell would explain it; if not, you look for a leak or waste.' },
        { kind: 'answered', text: 'Did the tanker company raise its price per load?', why: 'The brief says the price per load did not change.' },
        { kind: 'solution', text: 'Should the hostel limit shower timings to save water?', why: 'A fix before the cause. If the borewell dried up, shorter showers will not halve the bill.' },
        { kind: 'nice', text: 'What do other hostels in the city pay for a tanker load?', why: 'The price did not change, so comparing prices will not explain why the bill doubled.' }
      ],
      weak: 'Why did the bill go up? Was it the price? How many students are there?',
      adequate: 'Has the borewell been giving less water?',
      strong: 'Has the hostel’s own borewell been giving less water this summer? The students and the price are the same, so if the borewell held up, I would look for a leak next.'
    },
    {
      id: 'oq-scooter', round: 'Case', brief: 'A two-wheeler dealer near campus sells 30% fewer scooters than last year.',
      known: ['Sales fell 30% from last year.', 'Its biggest rival, two kilometres away, sells more than last year.', 'Both sell the same brands.'],
      options: [
        { kind: 'key', right: true, text: 'Does the rival offer students cheaper loans than this dealer?', why: 'Same brands and the rival is growing, so buyers are choosing the rival for something other than the scooter. For students, the loan is often what decides.' },
        { kind: 'answered', text: 'Do the two dealers sell different brands of scooter?', why: 'The brief says both sell the same brands.' },
        { kind: 'broad', text: 'Can you give me more details about the local scooter market?', why: 'More details about the market does not say which detail. Ask about the difference between the two dealers.' },
        { kind: 'nice', text: 'How many students on campus already own a scooter?', why: 'Interesting for sizing the market, but sales fell here while the rival’s rose. The market did not shrink.' }
      ],
      weak: 'Can I get more details about everything both dealers do?',
      adequate: 'What is the rival doing differently?',
      strong: 'Does the rival offer cheaper loans or lower down payments? Both sell the same scooters and its sales rose, so if finance is the same I would compare service and location next.'
    },
    {
      id: 'oq-mess-fee', round: 'Case', brief: 'The mess contractor says food costs rose 25% this term and wants to raise the monthly fee from ₹3,200 to ₹4,000. You are on the student committee.',
      known: ['The contractor says food costs rose 25%.', 'The fee would go from ₹3,200 to ₹4,000 a month.'],
      options: [
        { kind: 'key', right: true, text: 'What share of the ₹3,200 fee is food?', why: 'A 25% rise in food costs justifies a 25% rise in the fee only if the whole fee is food. If food is half of it, ₹3,600 would cover the rise.' },
        { kind: 'answered', text: 'How much does the contractor want to raise the fee by?', why: 'The brief gives it: from ₹3,200 to ₹4,000.' },
        { kind: 'solution', text: 'Should the committee look for a cheaper contractor instead?', why: 'A fix before checking the claim. The first step is whether ₹800 is the right size of rise.' },
        { kind: 'nice', text: 'How many students eat in the mess on a typical day?', why: 'The fee is per student, so the headcount does not change whether ₹800 more each is fair.' }
      ],
      weak: 'Could you share all the contractor’s accounts and every bill?',
      adequate: 'How much of the fee goes on food?',
      strong: 'What share of the ₹3,200 fee goes on food? If food is only half of it, a 25% rise in food costs adds ₹400, not ₹800, so the answer tells me whether to accept the new fee.',
      sums: [['fee after a 25% rise', 3200 * 1.25, 4000], ['rise if half the fee is food', 3200 / 2 * 0.25, 400], ['fee if half is food', 3200 + 400, 3600]]
    },
    {
      id: 'oq-accounts', round: 'Case', brief: 'A bank’s new branch near a college opened 2,000 student accounts in six months.',
      known: ['2,000 student accounts were opened in six months.', 'Only 300 of them have had a transaction since.'],
      options: [
        { kind: 'key', right: true, text: 'Were most accounts opened at a one-day campus camp?', why: 'If students signed up at a camp for a free gift, many never meant to use the account. That makes it a sign-up problem, not a service problem.' },
        { kind: 'answered', text: 'How many of the new accounts are actually being used?', why: 'The brief says 300 of the 2,000 have had a transaction.' },
        { kind: 'broad', text: 'Could you share any data you have on the branch?', why: '“Any data” leaves the interviewer to choose. Ask how the accounts were opened.' },
        { kind: 'solution', text: 'Should the bank offer cashback to get students using their accounts?', why: 'A fix before the cause. If the accounts were opened for a free gift, cashback may buy only one transaction.' }
      ],
      weak: 'What data do you have about these accounts?',
      adequate: 'How were the accounts opened?',
      strong: 'Were most of the 2,000 accounts opened at a campus camp with a free gift? If so, many students never meant to use them, and I would look at how accounts are opened rather than at the branch’s service.'
    },
    {
      id: 'oq-scale', round: 'Defence', brief: 'Your project is a room-booking app for your college library. The interviewer asks: “How would you scale it?”',
      known: ['It handled 600 bookings in its first month.', 'It serves one library at one college.'],
      options: [
        { kind: 'key', right: true, text: 'More students at this library, or more colleges using it?', why: 'Those need different answers: one is about load on one server, the other about separate data and settings for each college. The answer decides what you talk about.' },
        { kind: 'answered', text: 'How many bookings has the app handled so far?', why: 'You know this: 600 in its first month. Asking it back sounds as if you do not know your own project.' },
        { kind: 'broad', text: 'Could you tell me more about what you are looking for?', why: 'This hands the question back without narrowing it. Offer the two meanings you can see and ask which one.' },
        { kind: 'nice', text: 'Which database does your company use for its own apps?', why: 'Worth asking at the end, perhaps, but it does not tell you what the interviewer means by scale.' }
      ],
      weak: 'What do you mean?',
      adequate: 'Do you mean more users or more colleges?',
      strong: 'Do you mean more students at this library, or more colleges using the app? The first is about handling more bookings at once and the second means separate data for each college, so I would answer them differently.'
    },
    {
      id: 'oq-accuracy', round: 'Defence', brief: 'Your final-year project predicts which students may fail a course. The interviewer asks: “Is 82% good?”',
      known: ['The model is 82% accurate on last year’s data.', 'It flags students who may fail, so teachers can help early.'],
      options: [
        { kind: 'key', right: true, text: 'Which costs more: missing a failing student, or flagging a passing one?', why: 'Accuracy hides which errors a model makes. If most students pass, a model that flags nobody can score high, so the answer depends on which mistake matters.' },
        { kind: 'answered', text: 'What accuracy did the model reach on last year’s data?', why: 'You already said it: 82%.' },
        { kind: 'solution', text: 'Would it help if I retrained the model on three more years of data?', why: 'This offers a fix before agreeing what “good” means. More data may not change the errors that matter.' },
        { kind: 'nice', text: 'Which courses do students fail most often?', why: 'Interesting, but it does not tell you how to judge 82%.' }
      ],
      weak: 'Is it good? What is the baseline? What data did you use?',
      adequate: 'Compared with what baseline?',
      strong: 'Which mistake matters more to you: missing a student who will fail, or flagging one who will pass? If most students pass, 82% could be worse than flagging no one, so the answer decides how I judge it.'
    },
    {
      id: 'oq-architecture', round: 'Defence', brief: 'You built a chatbot that answers students’ fee queries. The interviewer says: “Walk me through the architecture in two minutes.”',
      known: ['You have two minutes.', 'The chatbot answers fee queries.'],
      options: [
        { kind: 'key', right: true, text: 'Shall I trace one query, or show how the parts are deployed?', why: 'Both are “architecture”, and two minutes is enough for one. The answer decides whether you follow a query or describe the servers.' },
        { kind: 'answered', text: 'How long do I have for this answer?', why: 'You were told: two minutes.' },
        { kind: 'broad', text: 'What would you like to know about the project?', why: 'Too open: it gives the question back. Name the two ways you could answer and ask which one.' },
        { kind: 'solution', text: 'Shall I explain why I would rebuild it with a different framework?', why: 'This jumps to a change you would make. The interviewer asked how it works now.' }
      ],
      weak: 'What do you want?',
      adequate: 'Do you want the query flow or the deployment?',
      strong: 'Would you like me to trace one fee query through the system, or show how the parts are deployed? Two minutes is enough for one of them, so I would rather spend it on the one you need.'
    },
    {
      id: 'oq-fails', round: 'Defence', brief: 'Your project is an attendance app that uses face matching. The interviewer asks: “What happens when it fails?”',
      known: ['The app marks attendance by matching faces.', 'You wrote the face-matching module.'],
      options: [
        { kind: 'key', right: true, text: 'Do you mean a wrong match, or the app being down?', why: 'A wrong match and an outage need different answers: one is about how a student corrects it, the other about what the teacher does with no app.' },
        { kind: 'answered', text: 'Which method does the app use to mark attendance?', why: 'You built it: it matches faces. Asking this back sounds as if you do not know it.' },
        { kind: 'nice', text: 'How many colleges use face matching for attendance now?', why: 'Interesting, but it does not tell you which failure the interviewer wants to hear about.' },
        { kind: 'solution', text: 'Should the college keep a paper register as a backup?', why: 'This proposes a fix before you know which failure is meant. A paper register helps with an outage, not a wrong match.' }
      ],
      weak: 'Fails how? Do you mean errors? Or crashes?',
      adequate: 'Do you mean a wrong match or the app crashing?',
      strong: 'Do you mean when it matches the wrong face, or when the app is down? A wrong match needs a quick way for the student to correct it and an outage needs a fallback for the teacher, so I would answer each differently.'
    }
  ];

  /* Hold or change: what each reply to pushback does. `call` on an item is the right move: `hold` when the interviewer
     gave doubt (or a fact that does not touch your reason), `revise` when they gave a fact that does. */
  const PUSHBACKS = {
    hold: { label: 'Holds, with the reason' },
    revise: { label: 'Changes for the new fact' },
    cave: { label: 'Gives way to doubt alone' },
    bluster: { label: 'Holds, with no reason' },
    dig: { label: 'Ignores the new fact' },
    abandon: { label: 'Drops more than the fact touches' },
    hedge: { label: 'Avoids choosing' }
  };
  const HOLD_OR_CHANGE = [
    {
      id: 'hc-tea', round: 'Case', call: 'hold',
      said: 'About 1,650 cups a day: one in four of the 4,000 students buys tea at 1.5 cups each, plus 10% for staff and visitors.',
      push: '1,650 sounds high to me.',
      options: [
        { kind: 'hold', right: true, text: 'I would stay at 1,650; the one-in-four share is the figure I would test.', why: 'Doubt alone is not a reason to move. This repeats the working and names the assumption that would change it.' },
        { kind: 'cave', text: 'You may be right, it does sound high when you say it. Let me bring it down to about 1,000.', why: 'Nothing new was said. Dropping to 1,000 with no reason tells the interviewer your first number was a guess.' },
        { kind: 'bluster', text: 'I am confident in my estimate, so 1,650 is my final answer.', why: 'Holding is right here, but confidence is not a reason. Give the working that got you there.' },
        { kind: 'hedge', text: 'It could be anywhere between 1,000 and 2,000, depending on the day and the weather.', why: 'A range this wide avoids the question. Hold your estimate and say which assumption you would check.' }
      ],
      weak: 'You’re right, sorry. Maybe it is more like 1,000 cups.',
      adequate: 'I would stay with 1,650 cups.',
      strong: 'I would stay at 1,650 cups. One in four of the 4,000 students at 1.5 cups gives 1,500 and staff add 10%, so if any figure is high it is the one-in-four share, which I would test.',
      sums: [['student cups', 4000 * 0.25 * 1.5, 1500], ['all cups', 1500 * 1.1, 1650]]
    },
    {
      id: 'hc-strength', round: 'HR', call: 'hold',
      said: 'My biggest strength is getting a group to finish on time. I led 14 people for our tech fest, set weekly checkpoints, and it ran on schedule.',
      push: 'Everyone says that. Why should I believe you?',
      options: [
        { kind: 'hold', right: true, text: 'I would still say it. The fest ran on schedule with 14 people, and I can show you how.', why: 'The doubt is general, so hold and get specific. Offering the week it nearly slipped invites a follow-up you can answer.' },
        { kind: 'cave', text: 'That is true, it is a common answer. Maybe my real strength is that I learn new tools quickly.', why: 'Switching strengths because the interviewer sounded unconvinced suggests the first answer was not true. Nothing new was said.' },
        { kind: 'bluster', text: 'Because it is true. I am very good at getting things done on time, and people who work with me know it.', why: 'Holding is right, but repeating the claim more firmly is not evidence. Give the fact that shows it.' },
        { kind: 'hedge', text: 'Well, everyone has their own strengths, and I think I have several.', why: 'This retreats into nothing. The interviewer asked for proof of one strength.' }
      ],
      weak: 'Sorry, maybe it is not my biggest strength after all.',
      adequate: 'I still think it is my strength, because it worked for the fest.',
      strong: 'I would still say it is my strength. I set weekly checkpoints for 14 people and the fest ran on schedule, and I can walk you through the week it nearly slipped.'
    },
    {
      id: 'hc-module', round: 'Defence', call: 'hold',
      said: 'I wrote the face-matching module and cut false matches from 9% to 2% by adding a second check.',
      push: 'That sounds like a team effort to me.',
      options: [
        { kind: 'hold', right: true, text: 'The team built the app; the face-matching module and its tests were mine.', why: 'The interviewer doubts your part but gives no fact against it. Hold, and separate what you did from what the team did.' },
        { kind: 'cave', text: 'Yes, it was really a team effort. We all worked on everything together, so it is hard to separate.', why: 'This gives up the one claim you can prove. Nothing the interviewer said showed it was not yours.' },
        { kind: 'bluster', text: 'No, it was definitely my work. I did that part myself.', why: 'Right to hold, but saying it more firmly is not a reason. Name what you built and what others built.' },
        { kind: 'hedge', text: 'It was partly mine and partly the team’s, depending on how you look at it.', why: 'This blurs a claim you can make clearly. Say which part was yours.' }
      ],
      weak: 'Yes, you’re right, it was the whole team really.',
      adequate: 'I stand by it. The module was mine.',
      strong: 'I stand by it: the team built the app, but the face-matching module was mine. I added the second check that cut false matches from 9% to 2%, and two teammates built the interface.'
    },
    {
      id: 'hc-mix', round: 'Case', call: 'hold',
      said: 'Profit fell because sales shifted from books to stationery, which earns less than half the margin. That alone cuts gross profit by about ₹72,000.',
      push: 'I don’t think product mix explains it. Try again.',
      options: [
        { kind: 'hold', right: true, text: 'Still the mix, I think: the shift alone costs about ₹72,000. What makes you doubt it?', why: '“Try again” is pressure, not a fact. Hold, give the figure, and ask what they have seen that you have not.' },
        { kind: 'cave', text: 'Okay, then it must be costs. Staff wages probably went up this year, which would explain the fall.', why: 'You were not given any fact about wages. Switching to a guess throws away an answer the numbers support.' },
        { kind: 'bluster', text: 'I am sure it is the product mix. I have already done the analysis.', why: 'Right to hold, but “I have done the analysis” is not the analysis. Give the ₹72,000.' },
        { kind: 'hedge', text: 'It might be the mix, or it might be something else. It is hard to be certain.', why: 'This neither holds nor changes. The figures you have point one way: say so.' }
      ],
      weak: 'Okay, sorry. Maybe it is staff costs then.',
      adequate: 'I would still say it is the mix.',
      strong: 'I would still put it on the mix. Revenue and rent did not change, and moving 20% of the ₹24 lakh of sales from a 25% margin to 10% cuts about ₹72,000. What makes you doubt it?',
      sums: [['profit lost to the shift, ₹', 2400000 * 0.2 * (0.25 - 0.10), 72000]]
    },
    {
      id: 'hc-cleaning', round: 'HR', call: 'hold',
      said: 'I want this analyst role because I like finding the reason behind a number and explaining it, as I did with six months of mess-wastage data.',
      push: 'Our analysts spend most of the day cleaning data, not presenting. Do you still want it?',
      options: [
        { kind: 'hold', right: true, text: 'Yes. My mess project was mostly cleaning the records, and the answer came out of that.', why: 'The fact is real but does not touch your reason: cleaning is how you get to the reason behind a number. Say so, and hold.' },
        { kind: 'cave', text: 'I did not know that. In that case a client-facing role might suit me better than this one.', why: 'Cleaning data is part of the work you described enjoying. Changing roles on the spot suggests your reason was not thought through.' },
        { kind: 'bluster', text: 'Yes, I still want it. I am really passionate about analytics and data.', why: 'Holding is right, but “passionate” is not a reason. Connect the cleaning to work you have already done.' },
        { kind: 'hedge', text: 'I am open to whatever the role involves, and I can adapt.', why: 'This avoids saying whether the cleaning fits what you want. It does: say how.' }
      ],
      weak: 'Oh, sorry, I did not know that. Maybe I would prefer something else.',
      adequate: 'Yes, I still want it. Cleaning is fine with me.',
      strong: 'Yes, I still want it. My mess project was mostly cleaning six months of messy records, and finding the reason for the waste depended on that, so the cleaning is part of the work I enjoy.'
    },
    {
      id: 'hc-stores', round: 'Case', call: 'hold',
      said: 'I would look first at the two dark stores that account for 80% of the late orders.',
      push: 'Isn’t that too narrow? The problem could be everywhere.',
      options: [
        { kind: 'hold', right: true, text: 'I would still start there: two of nine stores have 80% of the late orders.', why: 'The interviewer raises a possibility, not a fact. The 80% figure already says where the problem is concentrated.' },
        { kind: 'cave', text: 'True, it could be everywhere. I will look at all nine stores equally instead, to be safe.', why: 'Spreading the search evenly ignores the 80% figure you already have. Nothing new was offered.' },
        { kind: 'bluster', text: 'No, those two stores are clearly the problem.', why: 'Right to hold, but “clearly” skips the reason. Give the 80%, and what you would do if it turns out wrong.' },
        { kind: 'hedge', text: 'Both approaches have merit, so it depends on how much time we have.', why: 'This avoids the call. You have a reason to start narrow: say it.' }
      ],
      weak: 'You’re right, I should look at everything.',
      adequate: 'I would still start with the two stores.',
      strong: 'I would still start with the two stores. They have 80% of the late orders between them, so if their riders explain it the fix is local, and if not, I widen the search to all nine.'
    },
    {
      id: 'hc-scooters', round: 'Case', call: 'revise',
      said: 'About 2,000 two-wheelers park on campus on a weekday: half of the 4,000 day scholars ride one.',
      push: 'Students under 18 cannot ride on campus, and that is about a quarter of the day scholars.',
      options: [
        { kind: 'revise', right: true, text: 'That lowers it: half of the 3,000 old enough to ride is about 1,500.', why: 'This is a new fact that shrinks the base. Change the input it touches, the 4,000, and keep the rest of the logic.' },
        { kind: 'dig', text: 'I would keep 2,000. Half of 4,000 day scholars is a reasonable share to assume.', why: 'The interviewer has just told you a quarter of them cannot ride. Repeating the old base ignores it.' },
        { kind: 'abandon', text: 'Then my whole approach is off. Let me start again from the number of parking spaces.', why: 'The fact changes one input, not the method. Starting again throws away a structure that still works.' },
        { kind: 'hedge', text: 'That might change things a little, or it might not, depending on who rides.', why: 'The fact clearly lowers the base. Say by how much.' }
      ],
      weak: 'Then I am not sure. It could be anything.',
      adequate: 'That changes my estimate. It will be lower.',
      strong: 'That changes my estimate. Only 3,000 of the 4,000 day scholars can ride, so if half of them do, it is about 1,500 two-wheelers, not 2,000.',
      sums: [['old estimate', 4000 / 2, 2000], ['day scholars who can ride', 4000 * 0.75, 3000], ['new estimate', 3000 / 2, 1500]]
    },
    {
      id: 'hc-mess-hours', round: 'Case', call: 'revise',
      said: 'Keep the canteen open until 9 pm, starting with a one-month trial. 120 of the 300 late students say they would buy dinner, which leaves ₹4,800 an evening against ₹3,000 of cost.',
      push: 'The hostel mess has just started serving dinner until 9:30 pm.',
      options: [
        { kind: 'revise', right: true, text: 'That changes it: the 120 was counted before the mess stayed open, so I would re-check demand.', why: 'The new fact attacks the demand figure, so change what depends on it: re-check demand before committing to the trial.' },
        { kind: 'dig', text: 'I would still open until 9 pm. The survey showed 120 students want dinner, and that is plenty.', why: 'The survey was taken when the mess closed at 8:30. Holding on to it ignores the fact that made it out of date.' },
        { kind: 'abandon', text: 'Then the canteen should not stay open late at all. The idea is dead.', why: 'The fact weakens the demand figure but does not show it is below the 75 dinners needed. Drop the part it touches, not the whole idea.' },
        { kind: 'hedge', text: 'It is hard to say now. It could still work, or it could not.', why: 'You can say exactly what to check: whether 75 students still want dinner. Say it.' }
      ],
      weak: 'Then forget it, the canteen should close at 7 pm as before.',
      adequate: 'That changes things. I would check demand again.',
      strong: 'That changes it. We need 75 dinners an evening to cover ₹3,000 at ₹40 each, and the 120 was counted before the mess stayed open, so I would re-check demand before any trial.',
      sums: [['dinners to break even', 3000 / 40, 75], ['money left from 120 dinners, ₹', 120 * 40, 4800]]
    },
    {
      id: 'hc-reference', round: 'HR', call: 'revise',
      said: 'My weakness is that I take over work instead of delegating it. Since my final-year project, I name an owner for each part at the start.',
      push: 'Your teammate’s reference says you rewrote her section last month too.',
      options: [
        { kind: 'revise', right: true, text: 'Then it is not fixed yet. I did it again under a deadline.', why: 'The fact shows the habit has not gone. Change the claim that it is fixed, keep the weakness, and say what you do now.' },
        { kind: 'dig', text: 'That was a one-off. Since my final-year project I have delegated properly every time.', why: 'You have just been shown it was not a one-off. Repeating that it is fixed makes the reference look right about you in a second way.' },
        { kind: 'abandon', text: 'Then I suppose I am just not good at working in teams.', why: 'The fact is about one habit, taking over work. Turning it into “bad at teams” gives up far more than it shows.' },
        { kind: 'hedge', text: 'Everyone slips sometimes, and it depends on the situation and the deadline.', why: 'This avoids owning it. Say plainly that it happened and what you do now.' }
      ],
      weak: 'That was a one-off, really. I delegate well now.',
      adequate: 'That changes my answer. I am still working on it.',
      strong: 'That changes my answer: I have not fixed it yet. I rewrote her section under a deadline, so now I agree a checkpoint before I touch anyone’s work, and I have kept to that for 3 weeks.'
    },
    {
      id: 'hc-no-shows', round: 'Defence', call: 'revise',
      said: 'Students now book a discussion room in under two minutes instead of queuing for twenty.',
      push: 'The library’s log shows a third of bookings have been no-shows since your sheet started.',
      options: [
        { kind: 'revise', right: true, text: 'The queue is fixed, but no-shows are a new problem; I would release unconfirmed rooms.', why: 'The fact adds a new problem without undoing the old result. Keep the two-minute claim and change what you say the sheet achieved.' },
        { kind: 'dig', text: 'The project was about booking time, and booking takes under two minutes. That is what counts.', why: 'A third of rooms going unused is part of whether the process improved. Waving it away sounds defensive.' },
        { kind: 'abandon', text: 'Then I suppose the project did not really work.', why: 'The queue result still stands. The no-shows are a second problem to fix, not proof the first fix failed.' },
        { kind: 'hedge', text: 'Some no-shows happen with any system, so it is hard to say what it means.', why: 'A third is a clear number. Say what it changes and what you would do.' }
      ],
      weak: 'Well, no-shows happen everywhere. Booking still takes two minutes.',
      adequate: 'That changes things. I would fix the no-shows.',
      strong: 'That changes what I would claim. Booking still takes under two minutes, but if a third are no-shows, I would release any room not confirmed 10 minutes before its slot.'
    },
    {
      id: 'hc-joiners', round: 'Case', call: 'revise',
      said: 'The gym lost members because more of them left at renewal, so I would fix renewals first.',
      push: 'Renewals were the same as last year. New joiners fell from 140 to 40.',
      options: [
        { kind: 'revise', right: true, text: 'Then I had the wrong branch: the problem is joining, not leaving.', why: 'The fact moves the problem from leaving to joining. Change the branch you look at, and keep the method.' },
        { kind: 'dig', text: 'I would still start with renewals. Keeping members is usually cheaper than finding new ones.', why: 'True in general, but the figures you were just given show renewals did not change. A general rule does not beat the fact.' },
        { kind: 'abandon', text: 'Then I am not sure what the problem is. We should survey everyone about everything.', why: 'The fact points straight to joiners. Starting over with a survey of everything throws that away.' },
        { kind: 'hedge', text: 'It could be both renewals and joiners, so we should look at both equally.', why: 'Renewals were flat, so they cannot explain the fall. Saying “both” ignores the figure.' }
      ],
      weak: 'I would still fix renewals first, they matter most.',
      adequate: 'That changes it. I would look at joiners.',
      strong: 'That changes where I would look. Renewals were flat and joiners fell by 100, from 140 to 40, so I would find out why fewer first-years are signing up.',
      sums: [['fall in joiners', 140 - 40, 100]]
    },
    {
      id: 'hc-baseline', round: 'Defence', call: 'revise',
      said: 'My model predicts which students may fail a course, with 82% accuracy.',
      push: 'Only 15% of students fail. A model that says nobody fails would score 85%.',
      options: [
        { kind: 'revise', right: true, text: 'Then 82% is worse than doing nothing, and I need a different measure.', why: 'The fact shows accuracy is the wrong measure here. Change the measure and say which one you would use.' },
        { kind: 'dig', text: '82% is still a high number for a student project, so I would stand by it.', why: 'The interviewer has shown that 82% loses to a model that does nothing. Calling it high ignores that.' },
        { kind: 'abandon', text: 'Then the project was pointless and I should not have built it.', why: 'The fact is about how you measured the model, not whether it is useful. Change the measure, not your view of the whole project.' },
        { kind: 'hedge', text: 'Accuracy has its pros and cons, like any measure.', why: 'You were given a specific reason it misleads here. Say what it changes.' }
      ],
      weak: '82% is still good. I would stand by it.',
      adequate: 'That changes how I judge it.',
      strong: 'That changes how I would judge it. A model that flags nobody scores 85%, so I would report how many of the 15% who failed it caught, which is the number teachers need.',
      sums: [['score of a model that flags nobody, %', 100 - 15, 85]]
    }
  ];

  /* Put a number on it: what each rewrite of a vague line is. The right one is always `strong`. */
  const REWRITES = {
    strong: { label: 'Your part, with a measure' },
    team: { label: 'A number, but “we”' },
    activity: { label: 'Counts effort, not result' },
    vague: { label: 'Sounds big, says nothing' },
    nobase: { label: 'A percentage with no base' }
  };
  const PUT_A_NUMBER = [
    {
      id: 'pn-instagram', round: 'Résumé', line: 'Responsible for social media of the college fest.',
      facts: ['You ran the fest’s Instagram page for three months.', 'Followers went from 1,200 to 5,400.', 'You posted the reels; two teammates made the designs.', 'Online sales were 600 of the 1,800 passes sold.'],
      options: [
        { kind: 'strong', right: true, text: 'I ran the fest’s Instagram and took it from 1,200 followers to 5,400.', why: 'It says what you did and what changed, from and to. An interviewer can repeat it.' },
        { kind: 'team', text: 'We grew the fest’s Instagram from 1,200 to 5,400 followers over three months of posting.', why: 'The numbers are right, but “we” hides your part. Two teammates made the designs; the page was yours, so say so.' },
        { kind: 'activity', text: 'I posted reels on the fest’s Instagram page every day for three months.', why: 'This counts your effort, not what it achieved. Ninety reels matter only because of what they did to followers or sales.' },
        { kind: 'nobase', text: 'I grew the fest’s Instagram following by 350% in three months.', why: 'A percentage with no base leaves the interviewer to guess whether it was 10 followers or 10,000. Give from and to.' }
      ],
      weak: 'We handled social media and it went really well.',
      adequate: 'We grew the page from 1,200 to 5,400 followers.',
      strong: 'I ran the fest’s Instagram for three months and grew it from 1,200 followers to 5,400.',
      sums: [['follower growth, %', (5400 - 1200) / 1200 * 100, 350]]
    },
    {
      id: 'pn-club', round: 'HR', line: 'I helped improve attendance at our coding club.',
      facts: ['Attendance had fallen to about 12 a session.', 'You moved sessions from Saturday morning to Wednesday evening.', 'You started a weekly 30-minute problem everyone solves together.', 'Attendance rose to about 35 a session over the term.'],
      options: [
        { kind: 'strong', right: true, text: 'I moved sessions to Wednesday evenings; attendance went from about 12 to 35.', why: 'Your actions, then the change from and to. Nothing is left for the interviewer to guess.' },
        { kind: 'activity', text: 'I organised 14 sessions this term and set a 30-minute group problem every single week.', why: 'Fourteen sessions is effort. It does not say whether more people came.' },
        { kind: 'vague', text: 'I played a key role in greatly increasing attendance and engagement at our coding club.', why: '“Key role” and “greatly” sound big but give no number and no action. The interviewer will ask for both.' },
        { kind: 'nobase', text: 'I increased attendance at the coding club by nearly 200% in one term.', why: 'Nearly 200% of what? From 12 to 35 is clearer and sounds just as good.' }
      ],
      weak: 'I helped a lot with attendance at the club.',
      adequate: 'Attendance went up by nearly 200% after the change.',
      strong: 'I moved the club to Wednesday evenings and added a weekly group problem, and attendance rose from about 12 to 35 a session.',
      sums: [['attendance growth, %', (35 - 12) / 12 * 100, 191.6667]]
    },
    {
      id: 'pn-waste', round: 'HR', line: 'I was part of a team that reduced waste in the mess.',
      facts: ['You weighed leftover food every day for two weeks.', 'You found 28 kg a day was dinner rice cooked but never served.', 'You proposed cooking dinner rice in two batches.', 'Daily waste fell from 90 kg to 62 kg.'],
      options: [
        { kind: 'strong', right: true, text: 'I found the unserved dinner rice; waste fell from 90 kg a day to 62.', why: 'Your part and the result, from and to.' },
        { kind: 'team', text: 'Our committee cut the mess’s daily food waste from 90 kg to 62 kg this term.', why: 'The result is clear but your part is not. The weighing and the batch idea were yours.' },
        { kind: 'vague', text: 'I worked tirelessly with the team to massively reduce food waste in our hostel mess.', why: '“Tirelessly” and “massively” are adjectives, not facts. Neither says how much waste or what you did.' },
        { kind: 'activity', text: 'I weighed the leftover food in the mess every day for two weeks.', why: 'Two weeks of weighing is the method. Without 90 kg falling to 62 it has no result.' }
      ],
      weak: 'We reduced waste a lot.',
      adequate: 'Food waste fell from 90 kg to 62 kg a day.',
      strong: 'I weighed the waste for two weeks and traced 28 kg a day to unserved dinner rice. After batch cooking, waste fell from 90 kg to 62 kg a day.'
    },
    {
      id: 'pn-library', round: 'Résumé', line: 'Improved the library booking process.',
      facts: ['Students queued about 20 minutes at the desk to book a discussion room.', 'You replaced the queue with a shared sheet of time slots.', 'Booking now takes under two minutes.', 'The sheet handled 600 bookings in its first month.'],
      options: [
        { kind: 'strong', right: true, text: 'I replaced the desk queue with a shared sheet; booking fell from 20 minutes to two.', why: 'What you built and what changed, from and to.' },
        { kind: 'activity', text: 'I designed a shared sheet of time slots for the library’s six discussion rooms.', why: 'This says what you made, not what it changed. The 20 minutes to two is the point.' },
        { kind: 'nobase', text: 'I made booking a library discussion room 90% faster for students.', why: 'Ninety per cent faster than what? From 20 minutes to under two says it plainly.' },
        { kind: 'team', text: 'We cut the wait to book a library room from 20 minutes to under two.', why: 'The figures are good, but “we” hides that the sheet was your idea and your work.' }
      ],
      weak: 'I improved the library booking process significantly.',
      adequate: 'I made booking 90% faster.',
      strong: 'I replaced the desk queue with a shared booking sheet, and booking time fell from about 20 minutes to under two. It handled 600 bookings in its first month.',
      sums: [['time saved, %', (20 - 2) / 20 * 100, 90]]
    },
    {
      id: 'pn-matching', round: 'Defence', line: 'My project made the attendance system more accurate.',
      facts: ['Four of you built the attendance app.', 'You wrote the face-matching module and its tests.', 'You added a second check before a match is accepted.', 'False matches fell from 9% to 2%.'],
      options: [
        { kind: 'strong', right: true, text: 'I added a second check, and false matches fell from 9% to 2%.', why: 'Your change, and the error rate before and after. Both percentages carry their base.' },
        { kind: 'team', text: 'We brought the app’s false matches down from 9% to 2% before the final review.', why: 'Four of you built the app, but the second check was yours. “We” gives the credit away.' },
        { kind: 'vague', text: 'I made the face matching far more accurate and reliable than it was before.', why: '“Far more accurate” is the claim the interviewer will ask you to prove. Lead with the 9% and the 2%.' },
        { kind: 'nobase', text: 'I improved the face-matching accuracy by 78%.', why: 'Seventy-eight per cent of what? It is the fall in false matches, from 9% to 2%, which is clearer said that way.' }
      ],
      weak: 'We made it a lot more accurate.',
      adequate: 'False matches fell from 9% to 2%.',
      strong: 'I added a second check to the face-matching module, and false matches fell from 9% to 2%.',
      sums: [['fall in false matches, %', (9 - 2) / 9 * 100, 77.7778]]
    },
    {
      id: 'pn-sponsors', round: 'HR', line: 'I handled the sponsorship for our department fest.',
      facts: ['You contacted 40 local businesses.', '9 of them sponsored the fest.', 'They gave ₹1,80,000 in all, against a target of ₹1,20,000.', 'Last year’s fest raised ₹70,000 from sponsors.'],
      options: [
        { kind: 'strong', right: true, text: 'I signed 9 of the 40 sponsors I approached: ₹1,80,000 against a ₹1,20,000 target.', why: 'Your work, the hit rate and the result against the target. Every figure has its base.' },
        { kind: 'activity', text: 'I called 40 local businesses, followed up with each by email, and met the interested ones in person.', why: 'Forty calls is effort. The interviewer wants what came of them: 9 sponsors and ₹1,80,000.' },
        { kind: 'team', text: 'We raised ₹1,80,000 from 9 sponsors, well above the target of ₹1,20,000.', why: 'Strong figures, but “we” hides that you did the calling. Say it was you.' },
        { kind: 'vague', text: 'I secured a record amount of sponsorship through various local businesses.', why: '“Record amount” and “various” promise a number and never give it. Say ₹1,80,000 from 9 businesses.' }
      ],
      weak: 'We got many sponsors for the fest.',
      adequate: 'I raised ₹1,80,000 in sponsorship.',
      strong: 'I contacted 40 local businesses and signed 9, raising ₹1,80,000 against a target of ₹1,20,000, more than double last year’s ₹70,000.',
      sums: [['times last year', 180000 / 70000, 2.5714]]
    },
    {
      id: 'pn-complaints', round: 'Résumé', line: 'Worked on reducing customer complaints during my internship.',
      facts: ['You interned for eight weeks at a tiffin delivery start-up.', 'You sorted 300 complaints from four weeks and found 60% were about late deliveries in two areas.', 'You suggested an earlier dispatch slot for those two areas.', 'Complaints fell from about 75 a week to 40 by the end of your internship.'],
      options: [
        { kind: 'strong', right: true, text: 'I traced most complaints to late deliveries; earlier dispatch cut them from 75 a week to 40.', why: 'What you found, what you changed, and the weekly count before and after.' },
        { kind: 'activity', text: 'I read and sorted 300 customer complaints by area and cause during my eight-week internship.', why: 'Sorting 300 complaints is the method. What it led to, 75 a week down to 40, is the result.' },
        { kind: 'nobase', text: 'I reduced customer complaints at the start-up by almost half.', why: '“Almost half” has no base: half of what, over what time? From 75 a week to 40 says it.' },
        { kind: 'vague', text: 'I made a significant impact on customer satisfaction by working closely with the operations team.', why: '“Significant impact” is what everyone writes. It names no number and no action.' }
      ],
      weak: 'Worked on reducing complaints and improved customer satisfaction significantly.',
      adequate: 'Complaints went down by almost half during my internship.',
      strong: 'I traced 60% of 300 complaints to late deliveries in two areas, and after an earlier dispatch there, complaints fell from about 75 a week to 40.',
      sums: [['complaints a week in the sample', 300 / 4, 75]]
    },
    {
      id: 'pn-tutoring', round: 'HR', line: 'I am good at teaching others.',
      facts: ['You ran weekend maths sessions for 25 first-years before their exam.', 'Their average in the internal test rose from 48 to 63 out of 100.', 'Three other seniors joined you as tutors.', 'You wrote all the practice sheets.'],
      options: [
        { kind: 'strong', right: true, text: 'I ran weekend maths sessions for 25 first-years; their average rose from 48 to 63.', why: 'What you did, for how many, and the result before and after.' },
        { kind: 'team', text: 'We tutored 25 first-years, and their test average went from 48 to 63 out of 100.', why: 'Good figures, but three others tutored too. Say what was yours: the sessions and the sheets.' },
        { kind: 'activity', text: 'I wrote all the practice sheets for weekend maths sessions with 25 first-years.', why: 'This says what you did, not what changed. The rise from 48 to 63 is the evidence that you can teach.' },
        { kind: 'vague', text: 'I have always been passionate about teaching and helping juniors with difficult concepts.', why: 'Passion is a claim, not evidence. A number from what happened to your students is.' }
      ],
      weak: 'I am very good at teaching and people like my explanations.',
      adequate: 'Students’ average went up from 48 to 63.',
      strong: 'I ran weekend maths sessions for 25 first-years and wrote all the practice sheets, and their test average rose from 48 to 63 out of 100.'
    },
    {
      id: 'pn-chatbot', round: 'Defence', line: 'My chatbot reduced the load on the fee office.',
      facts: ['The fee office got about 400 queries a week by phone and email.', 'Your chatbot answers the 20 most common questions.', 'In its first month it handled 1,100 queries.', 'Queries to the fee office fell to about 240 a week.'],
      options: [
        { kind: 'strong', right: true, text: 'My chatbot took the fee office from 400 queries a week to 240.', why: 'It says what your chatbot did and how much the office’s load changed, from and to.' },
        { kind: 'nobase', text: 'My chatbot reduced the fee office’s workload by 40%.', why: 'A percentage with no base. From 400 queries a week to 240 tells the interviewer the size of the office and the change.' },
        { kind: 'activity', text: 'I built a chatbot that answers the 20 most common questions about fees.', why: 'This says what it does, not what it changed. The fall in queries is the result.' },
        { kind: 'vague', text: 'My chatbot greatly reduced the burden on the fee office and made life much easier for students.', why: '“Greatly” and “much easier” are what an interviewer will ask you to put a number on. Do it first.' }
      ],
      weak: 'It made things much easier for the office.',
      adequate: 'The chatbot handled 1,100 queries in a month.',
      strong: 'I built the chatbot, and in its first month it answered 1,100 queries. Queries to the fee office fell from about 400 a week to 240.',
      sums: [['fall in queries, %', (400 - 240) / 400 * 100, 40]]
    },
    {
      id: 'pn-hackathon', round: 'HR', line: 'We did well in the hackathon.',
      facts: ['Your team of four placed third of 40 teams.', 'You built the login and the matching logic.', 'You proposed the two-hour trial that settled the framework choice.', 'The team had a working demo in 22 of the 24 hours.'],
      options: [
        { kind: 'strong', right: true, text: 'Our team placed third of 40, and I built the login and the matching logic.', why: 'The result, and then your part in it, said with “I”.' },
        { kind: 'team', text: 'We placed third out of 40 teams and finished our demo with two hours to spare.', why: 'The result is clear, but nothing in it is yours. Say what you built.' },
        { kind: 'vague', text: 'I contributed significantly to our team’s excellent performance at a very competitive hackathon.', why: 'Three adjectives and no facts. Third of 40 says more than “excellent”.' },
        { kind: 'activity', text: 'I coded for most of the 24 hours and went to every team meeting.', why: 'Hours and meetings are effort. What you built, and where the team placed, is what counts.' }
      ],
      weak: 'We did really well and everyone worked hard.',
      adequate: 'We placed third of 40 teams.',
      strong: 'Our team of four placed third of 40, and I built the login and the matching logic in the demo.'
    },
    {
      id: 'pn-budget', round: 'Résumé', line: 'Managed the department’s budget for events.',
      facts: ['The department gave ₹2,50,000 for the year’s events.', 'You tracked every bill in a shared sheet.', 'You ran 6 events and finished ₹30,000 under budget.', 'Last year’s team overspent by ₹45,000.'],
      options: [
        { kind: 'strong', right: true, text: 'I ran 6 events on ₹2,50,000 and finished ₹30,000 under budget.', why: 'What you were responsible for, and the result against the budget.' },
        { kind: 'activity', text: 'I tracked every bill for the department’s events in a shared sheet all year.', why: 'Tracking bills is the method. Finishing ₹30,000 under is the result.' },
        { kind: 'nobase', text: 'I kept the department’s event spending 12% under budget for the year.', why: 'Twelve per cent of what? ₹30,000 under a ₹2,50,000 budget gives the size.' },
        { kind: 'team', text: 'We finished the year ₹30,000 under a ₹2,50,000 budget across six events.', why: 'The figures are there, but “we” hides that the budget was your job.' }
      ],
      weak: 'Managed budgets very carefully.',
      adequate: 'I kept spending 12% under budget.',
      strong: 'I ran the budget for 6 events and finished ₹30,000 under ₹2,50,000, where last year’s team overspent by ₹45,000.',
      sums: [['under budget, %', 30000 / 250000 * 100, 12]]
    },
    {
      id: 'pn-updates', round: 'HR', line: 'I improved my communication skills during my internship.',
      facts: ['You gave a weekly update to your manager’s team of 12.', 'Your first update ran 25 minutes; you cut it to a 5-minute summary with one chart.', 'From week 4 your manager asked you to present to the client.', 'You presented to the client three times.'],
      options: [
        { kind: 'strong', right: true, text: 'I cut my weekly update from 25 minutes to 5, and then presented to the client.', why: 'The change in your updates, and what it led to. Both are things the interviewer can check.' },
        { kind: 'activity', text: 'I gave a weekly update to my manager’s team of 12 throughout my internship.', why: 'Weekly updates are practice, not improvement. The 25 minutes to 5, and the client meetings, show the change.' },
        { kind: 'vague', text: 'My communication improved a lot, and my manager gave me very positive feedback on it.', why: '“A lot” and “very positive” are claims. The change in your updates is the evidence.' },
        { kind: 'nobase', text: 'I made my weekly updates 80% shorter.', why: 'Eighty per cent shorter than what? From 25 minutes to 5 is clearer, and the client meetings show it worked.' }
      ],
      weak: 'My communication improved a lot.',
      adequate: 'I made my updates 80% shorter.',
      strong: 'I cut my weekly update from 25 minutes to a 5-minute summary with one chart, and from week 4 my manager had me present to the client.',
      sums: [['shorter, %', (25 - 5) / 25 * 100, 80]]
    }
  ];

  /* Your next line: the four moves a group needs, in the observer's words from content/gd.js. Every item offers one
     line of each kind; `need` is the one the group needs now. `keywords` are the points a line can connect to. */
  const NEXT_LINES = {
    build: { label: 'Builds on a point' },
    invite: { label: 'Brings someone in' },
    steer: { label: 'Keeps the group on task' },
    summarise: { label: 'Sums up fairly' }
  };
  const NEXT_LINE = [
    {
      id: 'nl-attendance', topic: 'Should the 75% attendance rule apply to labs only?', situation: 'Two minutes into an eight-minute discussion. Everyone has spoken once.',
      names: ['Meera', 'Arjun', 'Kavya'], need: 'build', keywords: ['recorded', 'recording', 'recordings', 'lab', 'labs'],
      lines: [
        { who: 'Meera', text: 'Most of our lectures are recorded now, so missing one costs less than it used to.' },
        { who: 'Arjun', text: 'But people will just stop coming. Attendance matters.' },
        { who: 'Kavya', text: 'Attendance does matter. Students need discipline.' }
      ],
      options: [
        { kind: 'build', right: true, text: 'Meera’s recordings point is the real difference: a missed lab cannot be watched later.', why: 'Meera gave the one fact that separates lectures from labs, and the next two lines ignored it. Taking it further moves the group from opinions to a reason.' },
        { kind: 'invite', text: 'Kavya, we have not heard much from you yet. What do you think about the rule?', why: 'Kavya has just spoken. Inviting someone who is already talking wastes the move.' },
        { kind: 'steer', text: 'We have strayed from the topic. Can we come back to whether the rule should change?', why: 'Nobody has strayed: all three lines are about attendance. Steering here sounds as if you were not listening.' },
        { kind: 'summarise', text: 'So far, some of us think attendance matters and some of us think it does not.', why: 'Two minutes into eight, and it only restates the split. A summary this early ends the discussion before it starts.' }
      ],
      weak: 'I also think attendance is very important for all students.',
      adequate: 'Meera made a good point about the recordings.',
      strong: 'Meera’s point about recordings is the real difference: a missed lecture can be watched later, but a missed lab cannot. Could we test the rule against that?'
    },
    {
      id: 'nl-wfh', topic: 'Should freshers work from home for their first six months?', situation: 'Five minutes into ten. Priya has been talked over.',
      names: ['Rahul', 'Priya', 'Sneha'], need: 'invite', keywords: ['internship', 'interned', 'seniors'],
      lines: [
        { who: 'Rahul', text: 'Commutes here take two hours a day. Freshers could spend that time learning.' },
        { who: 'Priya', text: 'When I interned last summer—' },
        { who: 'Sneha', text: 'But freshers learn by watching seniors, and you cannot do that on a video call.' }
      ],
      options: [
        { kind: 'invite', right: true, text: 'Priya, you started to say something about your internship. What did you see there?', why: 'Priya was cut off mid-sentence, just as she was about to give first-hand evidence. Bringing her back helps the group and shows you noticed.' },
        { kind: 'build', text: 'Building on Sneha’s point, watching seniors work is how most people learn the unwritten rules.', why: 'Sneha’s point is fair, but Priya has just been talked over. Adding to the louder voices leaves her out.' },
        { kind: 'steer', text: 'We should keep to the first six months, not working from home in general.', why: 'The group is on the question. Nobody has drifted; someone has been left out.' },
        { kind: 'summarise', text: 'So the two sides are commute time against learning from the seniors.', why: 'Halfway through, with a member who has not been heard, a summary closes the door on her point.' }
      ],
      weak: 'I think working from home is better because of the traffic.',
      adequate: 'Priya, what do you think?',
      strong: 'Priya, you started to tell us about your internship. What did you see there about learning from seniors?'
    },
    {
      id: 'nl-mess', topic: 'The hostel committee has ₹60,000 and one term to cut mess food waste by a third. Agree a plan.', situation: 'Six minutes into eight. No plan yet.',
      names: ['Vikram', 'Ananya', 'Farhan'], need: 'steer', keywords: ['plan', '₹60,000', '60,000', 'minutes', 'fund', 'waste'],
      lines: [
        { who: 'Vikram', text: 'Honestly the food is bad. The contractor should be changed.' },
        { who: 'Ananya', text: 'Changing contractors takes a year of paperwork. I asked last time.' },
        { who: 'Farhan', text: 'My cousin’s hostel changed theirs and it was even worse.' }
      ],
      options: [
        { kind: 'steer', right: true, text: 'Two minutes left and no plan for the ₹60,000. What do we fund first?', why: 'The talk has drifted to changing the contractor, which the grant cannot do, and time is short. Bringing it back to the decision is what the group needs.' },
        { kind: 'build', text: 'Adding to Ananya’s point, the paperwork alone would take up most of the term we have.', why: 'True, but it keeps the group on a side issue with two minutes left, and the plan has not been started.' },
        { kind: 'invite', text: 'Farhan, you mentioned your cousin’s hostel. What else happened there?', why: 'Farhan has just spoken, and his cousin’s hostel pulls the group further off the task.' },
        { kind: 'summarise', text: 'So we agree the food is bad and the contractor is hard to change.', why: 'This sums up the detour, not the task. There is no plan yet to summarise.' }
      ],
      weak: 'The food really is bad, Vikram is right about that.',
      adequate: 'We are going off topic.',
      strong: 'We have two minutes and still no plan for the ₹60,000. Shall we pick the one step we would fund first, and test it for four weeks?'
    },
    {
      id: 'nl-library', topic: 'Should our college open a 24-hour library during exams?', situation: 'Seven minutes into eight. Each point has now been made at least twice.',
      names: ['Neha', 'Karthik', 'Imran'], need: 'summarise', keywords: ['security', 'quiet', '₹40,000', '40,000', 'cost', 'costs', 'noise', 'noisy'],
      lines: [
        { who: 'Neha', text: 'Security for 24 hours costs about ₹40,000 a month. That is the real problem.' },
        { who: 'Karthik', text: 'But hostel rooms are noisy at night. Students need somewhere quiet.' },
        { who: 'Imran', text: 'And as Neha said, the cost is high.' }
      ],
      options: [
        { kind: 'summarise', right: true, text: 'To pull it together: we need a quiet space, and ₹40,000 is the open question.', why: 'One minute is left and the points are being repeated. Pulling both sides together, with the open question, is what lets the group finish.' },
        { kind: 'build', text: 'Building on Karthik’s point, noise in the hostel at night hurts sleep, not just studying.', why: 'A new point with a minute left opens a thread the group has no time to close.' },
        { kind: 'invite', text: 'Imran, you have been quiet. What do you think about it?', why: 'Imran has just spoken, and with one minute left the group needs an ending, not a new voice.' },
        { kind: 'steer', text: 'Let us get back to whether the library should be open all 24 hours.', why: 'Nobody has left the question. The group is circling it, which is the cue for a summary.' }
      ],
      weak: 'I think the library is a great idea and should be open.',
      adequate: 'So, some want it open and some think it costs too much.',
      strong: 'To sum up, we agree students need a quiet place at night, and the open question is the ₹40,000 a month for security. Shall we propose a one-month trial during exams?'
    },
    {
      id: 'nl-bags', topic: 'Should the weekly market ban plastic bags?', situation: 'Three minutes into eight.',
      names: ['Lakshmi', 'Sameer', 'Divya'], need: 'build', keywords: ['₹4', '50 paise', 'vendors', 'vendor', 'cost'],
      lines: [
        { who: 'Lakshmi', text: 'In last year’s survey, vendors said a cloth bag costs them ₹4, against 50 paise for plastic.' },
        { who: 'Sameer', text: 'Plastic is terrible for the environment. It has to go.' },
        { who: 'Divya', text: 'Yes, the environment is the main thing here.' }
      ],
      options: [
        { kind: 'build', right: true, text: 'Lakshmi’s ₹4 bag is the obstacle. Could the market sell them at cost?', why: 'Lakshmi gave the one number that explains why vendors resist, and the next two lines skipped it. Taking it further turns a shared opinion into a plan.' },
        { kind: 'invite', text: 'Lakshmi, we have not heard much from you. What is your view on the ban?', why: 'Lakshmi spoke first, with the most useful number in the discussion. Asking for her view as if she had not spoken misses her point.' },
        { kind: 'steer', text: 'We are drifting. The question is whether to ban plastic bags at the market.', why: 'Nobody has drifted: all three lines are about the ban.' },
        { kind: 'summarise', text: 'So we all agree plastic is bad for the environment and should be banned.', why: 'Lakshmi’s point says it is not that simple, so “we all agree” is not a fair summary. Three minutes in is also early.' }
      ],
      weak: 'I agree, plastic is very bad for the environment.',
      adequate: 'Lakshmi’s point about the cost is important.',
      strong: 'Lakshmi’s ₹4 against 50 paise is why vendors resist. Could the market sell cloth bags at cost, so the ban does not fall on them?'
    },
    {
      id: 'nl-notices', topic: 'Should the college replace printed notices with a WhatsApp channel?', situation: 'Four minutes into eight. Ravi, the only day scholar in the group, has not spoken.',
      names: ['Pooja', 'Nikhil', 'Ravi'], need: 'invite', keywords: ['day scholar', 'day scholars', 'travel', 'campus'],
      lines: [
        { who: 'Pooja', text: 'In the hostel everyone checks WhatsApp anyway. Notices on boards get missed.' },
        { who: 'Nikhil', text: 'Exactly, and it saves paper.' },
        { who: 'Pooja', text: 'And hostellers only see the board at the mess, so the channel is faster.' }
      ],
      options: [
        { kind: 'invite', right: true, text: 'Ravi, you travel in daily. Would a channel reach day scholars better?', why: 'Everything so far is from hostellers. Ravi has not spoken, and he can say how the change lands for students who are not on campus all day.' },
        { kind: 'build', text: 'Adding to Pooja’s point, a channel could also send reminders before each deadline.', why: 'A fair addition, but it is a third point from the same side. The group has not heard from anyone the change affects differently.' },
        { kind: 'steer', text: 'We should focus on the decision itself: replace the printed notices, or not.', why: 'The group is on the decision. What it lacks is a second view, and Ravi has one.' },
        { kind: 'summarise', text: 'So far we agree the WhatsApp channel is faster and saves paper.', why: '“We agree” covers only the three who have spoken. A summary now leaves Ravi out entirely.' }
      ],
      weak: 'WhatsApp is definitely better, everyone uses it.',
      adequate: 'Ravi, what do you think?',
      strong: 'Ravi, you travel in every day. Would a channel reach day scholars better than the boards do?'
    },
    {
      id: 'nl-offers', topic: 'Should a student with one placement offer be stopped from sitting for other companies?', situation: 'Five minutes into eight.',
      names: ['Aditya', 'Shreya', 'Manoj'], need: 'steer', keywords: ['offer', 'offers', 'companies', '40', 'placement'],
      lines: [
        { who: 'Aditya', text: 'Last year 40 students who already had an offer sat for more companies and took seats from others.' },
        { who: 'Shreya', text: 'That reminds me, the placement website is so slow. It crashed during registration.' },
        { who: 'Manoj', text: 'Yes, it crashed for me too, twice.' }
      ],
      options: [
        { kind: 'steer', right: true, text: 'Back to Aditya’s 40 students: should one offer end a student’s season?', why: 'The talk has moved to the website, which has nothing to do with the decision. Bringing it back through Aditya’s number is what the group needs.' },
        { kind: 'build', text: 'Adding to Manoj’s point, the website should also send a reminder before each deadline.', why: 'This builds on the detour. The group is now two lines away from the question.' },
        { kind: 'invite', text: 'Shreya, you raised the website. What else went wrong with registration?', why: 'Shreya has just spoken, and this invites more of the side topic.' },
        { kind: 'summarise', text: 'So far we have talked about the 40 students and the problems with the website.', why: 'Summing up the detour as if it were part of the topic makes it harder to get back.' }
      ],
      weak: 'Yes, the website is really slow for everyone.',
      adequate: 'Let us get back to the topic.',
      strong: 'The website is a separate problem. Back to Aditya’s 40 students: should a student with one offer still sit for other companies?'
    },
    {
      id: 'nl-passes', topic: 'Should the college fest charge ₹300 a pass or stay free?', situation: 'Nine minutes into ten. The group must agree in the next minute.',
      names: ['Tanvi', 'Harsh', 'Zoya'], need: 'summarise', keywords: ['₹4.5 lakh', 'lakh', 'fair', 'fairness', 'charge', 'charging', 'free', 'waiver', 'waivers'],
      lines: [
        { who: 'Tanvi', text: 'If it is free, we lose ₹4.5 lakh of pass money and the fest shrinks.' },
        { who: 'Harsh', text: 'If we charge, students from poorer families stay away, and that is not fair.' },
        { who: 'Zoya', text: 'Both points are true. I don’t know.' }
      ],
      options: [
        { kind: 'summarise', right: true, text: 'Money against fairness, then. Could we charge, but give free passes on fee waivers?', why: 'The two sides are clear and time is nearly up. Putting them side by side, with a way to meet both, is what lets the group decide.' },
        { kind: 'build', text: 'Building on Harsh, fairness also matters for the college’s reputation with parents and alumni.', why: 'A new angle with one minute left adds weight to one side but brings the group no closer to a decision.' },
        { kind: 'invite', text: 'Zoya, which side are you on? Your vote would settle it either way.', why: 'Zoya has just said she cannot choose. Pressing her for a side does not help the group decide in a minute.' },
        { kind: 'steer', text: 'We need to stay on the question of the fest, not fairness in general.', why: 'Fairness is part of the question here. Nobody has drifted; the group needs the two sides pulled together.' }
      ],
      weak: 'I think it should be free because fests are for students.',
      adequate: 'Both sides have a point, money and fairness.',
      strong: 'To sum up: charging keeps ₹4.5 lakh, and staying free keeps it fair. Could we charge ₹300 with free passes for students on fee waivers?',
      sums: [['pass money, ₹', 1500 * 300, 450000]]
    },
    {
      id: 'nl-counter', topic: 'Should the canteen add a healthy-meal counter?', situation: 'Two minutes into eight.',
      names: ['Isha', 'Gaurav', 'Pranav'], need: 'build', keywords: ['trial', 'week', 'plates', 'count'],
      lines: [
        { who: 'Isha', text: 'We could try it for one week first and count how many plates it sells.' },
        { who: 'Gaurav', text: 'Healthy food is always more expensive. Students won’t buy it.' },
        { who: 'Pranav', text: 'And it never tastes good.' }
      ],
      options: [
        { kind: 'build', right: true, text: 'Isha’s one-week trial would settle both worries: the plate count will show it.', why: 'Isha offered a way to test the claims, and the next two lines argued past it. Building on it turns two opinions into something the group can check.' },
        { kind: 'invite', text: 'Pranav, you have been quiet so far. What do you think of the counter?', why: 'Pranav has just spoken. Nobody needs bringing in yet.' },
        { kind: 'steer', text: 'Let us not get into taste. The question is whether to add the counter.', why: 'Taste is part of whether students will buy, so it is on the question. The group needs Isha’s test, not a narrower topic.' },
        { kind: 'summarise', text: 'So the concerns so far are price and taste.', why: 'Two minutes in, and it leaves out Isha’s trial, the most useful thing said.' }
      ],
      weak: 'I agree, healthy food usually tastes bad.',
      adequate: 'Isha’s trial idea is good.',
      strong: 'Isha’s one-week trial answers both worries: if the food is too pricey or bland, the plate count will show it. Shall we agree what count would make it worth keeping?'
    },
    {
      id: 'nl-exams', topic: 'Should end-semester exams move fully online?', situation: 'Five minutes into eight. Suresh has not said anything yet.',
      names: ['Arnav', 'Riya', 'Suresh'], need: 'invite', keywords: ['laptop', 'laptops', 'home'],
      lines: [
        { who: 'Arnav', text: 'Online exams would save the college ₹3 lakh a term in printing and halls.' },
        { who: 'Riya', text: 'And students could sit them from anywhere.' },
        { who: 'Arnav', text: 'Everyone has a laptop now anyway.' }
      ],
      options: [
        { kind: 'invite', right: true, text: 'Suresh, we haven’t heard from you. Does everyone in your class have a laptop?', why: 'Suresh has not spoken in five minutes, and the group has just assumed everyone has a laptop. Asking him brings in a voice and tests the claim.' },
        { kind: 'build', text: 'Building on Arnav’s point, the ₹3 lakh could pay for better question papers.', why: 'It adds to the side that has done all the talking, while one member still has not spoken.' },
        { kind: 'steer', text: 'We should stay focused on whether exams move fully online, not on the savings.', why: 'They are on the question. What is missing is a fourth voice.' },
        { kind: 'summarise', text: 'So far we agree online exams are cheaper and more convenient for everyone.', why: '“We agree” includes Suresh, who has not said anything. It is also early to sum up.' }
      ],
      weak: 'Online is good because it is cheaper.',
      adequate: 'Suresh, any thoughts?',
      strong: 'Suresh, we have not heard from you yet. Does everyone in your class have a laptop at home?'
    },
    {
      id: 'nl-shuttle', topic: 'Should the campus shuttle run every 15 minutes instead of every 30?', situation: 'Six minutes into eight.',
      names: ['Kabir', 'Anjali', 'Deepak'], need: 'steer', keywords: ['shuttle', '₹9 lakh', '9 lakh', 'buses', 'wait', 'minutes'],
      lines: [
        { who: 'Kabir', text: 'A 15-minute shuttle needs two more buses, about ₹9 lakh a year.' },
        { who: 'Anjali', text: 'The real issue is the metro. It should come to campus.' },
        { who: 'Deepak', text: 'The metro line is planned for 2029, I read it somewhere.' }
      ],
      options: [
        { kind: 'steer', right: true, text: 'Metro plans aside, is ₹9 lakh a year worth halving the shuttle wait?', why: 'The talk has moved to the metro, which the group cannot decide, and time is short. Steering back to Kabir’s cost puts the real choice on the table.' },
        { kind: 'build', text: 'Adding to Deepak’s point, once the metro comes the shuttle could run to the station.', why: 'Interesting for 2029, but it deepens the detour with two minutes left.' },
        { kind: 'invite', text: 'Anjali, why do you think the metro is the real issue here?', why: 'This invites more of the side topic from someone who has just spoken.' },
        { kind: 'summarise', text: 'So we have the shuttle cost on one side and the metro plans on the other.', why: 'Summing up the detour alongside the task treats the metro as part of the decision. It is not.' }
      ],
      weak: 'The metro would really solve everything.',
      adequate: 'Can we get back to the shuttle?',
      strong: 'The metro is years away and not ours to decide. With two minutes left, is ₹9 lakh a year worth halving the wait for the shuttle?'
    },
    {
      id: 'nl-scooters', topic: 'Should first-years be allowed to bring scooters to campus?', situation: 'Seven minutes into eight. The moderator says: “One minute.”',
      names: ['Nandini', 'Varun', 'Hari'], need: 'summarise', keywords: ['18', 'parking', 'permit', 'permits', 'far', 'legally'],
      lines: [
        { who: 'Nandini', text: 'Most first-years are under 18, so they cannot legally ride anyway.' },
        { who: 'Varun', text: 'The ones who are 18 often live far away and need them.' },
        { who: 'Hari', text: 'And parking already fills up by 9 am.' }
      ],
      options: [
        { kind: 'summarise', right: true, text: 'Pulling it together: permits only for those who are 18 and live far?', why: 'One minute is left and three different points are on the table. Pulling them into one rule the group can accept is what ends the discussion well.' },
        { kind: 'build', text: 'Building on Hari’s point, the college could build a second parking lot behind the hostel.', why: 'A new idea with a minute left. It opens a cost question the group cannot settle in time.' },
        { kind: 'invite', text: 'Varun, can you say more about the first-years who live far away?', why: 'Varun has just made his point. With one minute left, more detail on one side delays the ending.' },
        { kind: 'steer', text: 'Let us come back to the question: scooters for first-years, yes or no.', why: 'All three lines are on the question. The group does not need steering; it needs the points pulled together.' }
      ],
      weak: 'I think scooters are dangerous and should not be allowed.',
      adequate: 'So there are points on both sides about scooters.',
      strong: 'To sum up: most first-years cannot ride legally, some who can live far away, and parking is full by 9. Could we allow permits only for those who are 18 and live far?'
    }
  ];

  const api = { MOVES, OPENINGS, STATEMENTS, SLIPS, GRADES, TRIAGE, ANSWER_FIRST, GROUPS, FLAWS, SPLIT_IT, QUESTIONS, ONE_QUESTION, PUSHBACKS, HOLD_OR_CHANGE, REWRITES, PUT_A_NUMBER, NEXT_LINES, NEXT_LINE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MovesContent = api;
})(this);
