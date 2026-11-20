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

  const api = { MOVES, OPENINGS, STATEMENTS, SLIPS, GRADES, TRIAGE, ANSWER_FIRST };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MovesContent = api;
})(this);
