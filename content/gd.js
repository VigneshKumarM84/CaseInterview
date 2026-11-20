/* Group discussion kit: the briefs a group discusses and the moves an observer notes.
   Every brief is original and fictional. A brief gives a decision to reach, and evidence cards that pull in
   different directions, so the group has to weigh them instead of agreeing with the first speaker. The numbers in
   each brief are consistent with each other; `balanced` and `traps` are for the observer and the debrief, never
   shown during the discussion. Data only, so Node tests load this file directly. Edit briefs here. */
(function (root) {
  'use strict';

  /* What an observer can note against a speaker. "good" moves are what GD panels look for; "watch" moves are
     habits to notice. They are counted and quoted back, never added up into a score. */
  const MOVES = [
    { id: 'open', kind: 'good', label: 'Opened or framed', hint: 'Set out the task, or a way to tackle it' },
    { id: 'evidence', kind: 'good', label: 'Used evidence', hint: 'Quoted a number or fact from the brief' },
    { id: 'build', kind: 'good', label: 'Built on a point', hint: 'Took someone else’s point further, naming them' },
    { id: 'invite', kind: 'good', label: 'Brought someone in', hint: 'Asked a quieter member for their view' },
    { id: 'disagree', kind: 'good', label: 'Disagreed with a reason', hint: 'Challenged a point with evidence, not volume' },
    { id: 'steer', kind: 'good', label: 'Kept the group on task', hint: 'Brought the talk back to the decision or the time' },
    { id: 'summarise', kind: 'good', label: 'Summarised fairly', hint: 'Pulled both sides together, including views they did not share' },
    { id: 'interrupt', kind: 'watch', label: 'Cut someone off', hint: 'Spoke over another member' },
    { id: 'repeat', kind: 'watch', label: 'Repeated a point', hint: 'Restated what was already said without adding to it' }
  ];

  /* Timings in seconds. Campus GDs usually give a minute or two to read, 8 to 15 minutes to discuss, and ask one
     member to sum up. */
  const TIMINGS = { prepare: 90, discuss: [360, 480, 600, 720], defaultDiscuss: 480, summary: 60 };
  const GROUP = { min: 3, max: 6 };

  const BRIEFS = [
    {
      id: 'mess', type: 'decision', title: 'Less food in the bin', setting: 'Hostel mess committee',
      brief: 'You are the student mess committee of a 600-student hostel. The mess throws away about 90 kg of food a day. The warden has given the committee ₹60,000, once, and one term (four months) to cut that waste by a third, to 60 kg a day or less, without raising the mess fee.',
      task: 'Agree on the plan you will take to the warden: what to fund within ₹60,000, what you will try first, and how you will know after four weeks whether it is working.',
      evidence: [
        { id: 'audit', title: 'One-week waste audit', text: 'Of the 90 kg a day: 50 kg is cooked food that was never served, 30 kg is left on plates, and 10 kg is kitchen trimmings. Of the 50 kg never served, 28 kg is at dinner.' },
        { id: 'turnout', title: 'How many actually eat', text: 'The mess cooks for 600 at every meal. Average turnout is 420 at breakfast, 510 at lunch and 450 at dinner. On weekends, dinner turnout falls to 330.' },
        { id: 'survey', title: 'Student survey', text: '240 of the 600 students answered. Asked why food is wasted, 62% said “the food is not good”, 21% said “too much is served” and 17% gave other reasons. 58% support a poster campaign.' },
        { id: 'options', title: 'Options and what they cost', text: 'A meal sign-up app: ₹45,000 to set up. The vendor says it cuts food never served by 60% if 80% of students use it; a nearby hostel had 40% using it after a month. Smaller default portions with free second helpings: no cost; a one-counter trial cut plate waste by a quarter. A second cook to improve the menu: ₹18,000 a month. Posters and a “weigh your waste” display: ₹6,000; no measured effect anywhere.' },
        { id: 'contractor', title: 'The mess contractor', text: 'The contractor is paid per student enrolled, not per meal eaten, and is fined ₹2,000 each time food runs out. Food ran out twice last term. The contractor says cooking less is “asking for complaints”.' },
        { id: 'rules', title: 'Hostel rules and a local NGO', text: 'Cooked food cannot be served again the next day. A local NGO will collect untouched cooked food if told by 9 pm, but it cannot take food from plates.' }
      ],
      tensions: [
        'The survey blames taste, but the audit shows most of the waste (50 of 90 kg) is food that never reached a plate.',
        'The app could meet the target alone (60% of 50 kg is 30 kg), but only at 80% use, and a nearby hostel reached 40%.',
        'Posters are the most popular option and the only one with no measured effect.',
        'Cooking to turnout costs nothing, but the contractor is fined when food runs out and loses nothing when it is wasted.'
      ],
      balanced: [
        'Goes where the kilos are: food never served, especially dinner and weekends.',
        'Tries the free steps first (cook to known turnout, smaller default portions) before spending.',
        'Treats the app’s 60% as a claim to test, and says what use rate would justify ₹45,000.',
        'Deals with the contractor’s fine, since it rewards over-cooking.',
        'Notices that a second cook costs ₹72,000 over the term, more than the grant, and recurs.',
        'Names one measure for week four, such as kg a day from the same audit, and who will weigh it.'
      ],
      traps: [
        'Arguing from the survey alone, when only 40% of students answered and it measures opinion, not weight.',
        'Spending most of the grant on the app with no trial and no plan for low use.',
        'Choosing posters because they are popular.',
        'Agreeing a plan with no number to check after four weeks.',
        'Ignoring students who eat late, who lose most if less is cooked.'
      ],
      closing: 'One minute: tell the warden what you will do first, what it costs, and how you will know in four weeks whether it worked.'
    },
    {
      id: 'fest', type: 'decision', title: 'Closing the fest funding gap', setting: 'College fest organising committee',
      brief: 'You are the organising committee of a three-day college fest, six weeks away. The plan costs ₹6,50,000. You can count on ₹4,70,000, which leaves a gap of ₹1,80,000. The treasurer wants a plan within two weeks that closes it by raising the pass price, cutting events, taking a sponsor on conditions, or a mix of these.',
      task: 'Agree how you will close the ₹1,80,000 gap: which levers you will pull, how much each brings, how you will handle the risks, and what you will check before the treasurer’s deadline.',
      evidence: [
        { id: 'budget', title: 'The plan and the money counted on', text: 'Planned spend: stage and sound ₹1,90,000; headline-night artist ₹1,50,000; competitions and prizes ₹1,10,000; stalls area and décor ₹1,00,000; security and permissions ₹60,000; publicity and print ₹40,000. Counted on: 2,000 passes at ₹150 (₹3,00,000), fees from 18 food and drink stalls at ₹5,000 each (₹90,000) and alumni donations (₹80,000). The college gives the venue free but no money.' },
        { id: 'passes', title: 'Last year’s price rise', text: 'Two years ago a pass cost ₹100 and 2,600 were sold (₹2,60,000). Last year it cost ₹150 and 2,000 were sold (₹3,00,000). A ₹50 rise lost 600 buyers and still brought in ₹40,000 more. Other things changed between the two years too.' },
        { id: 'poll', title: 'Student poll', text: 'A poll shared in the fest group chat: 300 of the college’s 4,000 students answered (7.5%). 240 of them (80%) said they would still come at ₹200, and 210 (70%) named the headline night as the main reason they would come.' },
        { id: 'timing', title: 'When passes were bought, and who came', text: 'Last year the artist was announced after 1,300 passes had been sold; 700 more were sold in the week after the announcement. 1,100 of the 2,000 pass holders (55%) were counted at the headline night, and 600 (30%) at the day-one competitions. This year’s artist costs ₹1,50,000.' },
        { id: 'sponsor', title: 'The sponsor’s offer', text: 'A packaged-drinks company offers ₹2,00,000 for its logo on the stage and passes, a stall at the entrance, a 15-minute slot on the headline night and cold-drinks exclusivity: the 6 stalls that sell cold drinks would have to stop. A logo-only deal, with no stage slot and no exclusivity, is ₹1,00,000. Its marketing head says the stage slot is “the main thing” it is paying for, and wants an answer in two weeks.' },
        { id: 'rules', title: 'Rules and people', text: 'Sponsorship needs the dean’s written approval, sent in by the faculty adviser at least 10 days before the fest. The adviser was criticised last year when a banner covered the stage. A pass price above ₹200 needs the principal’s approval. The cultural club president says the headline night “is the fest”. The treasurer will not release money for any event until the gap is covered four weeks before the fest.' }
      ],
      tensions: [
        'The poll says 80% would pay ₹200, but last year a ₹50 rise lost 600 of 2,600 buyers. If 80% of 2,000 stay, 1,600 passes at ₹200 bring ₹3,20,000 (₹20,000 more than now); if sales fall by the same 600, 1,400 passes at ₹200 bring ₹2,80,000 (₹20,000 less). Closing ₹1,80,000 by price alone at ₹200 would need 2,400 passes, more than the 2,000 expected.',
        'The poll says 70% come for the headline night, but 700 of 2,000 passes (35%) were bought after the artist was announced. If exactly those 700 depend on him, dropping him saves ₹1,50,000 and loses ₹1,05,000, a net ₹45,000. The poll suggests more depend on him and the timing suggests fewer: the data cannot settle it.',
        'The full sponsor package is ₹2,00,000, but exclusivity costs 6 stalls × ₹5,000 = ₹30,000 in fees, so it nets ₹1,70,000, ₹10,000 short of the gap. The logo-only deal nets ₹1,00,000 and leaves ₹80,000. The stage slot is what the sponsor pays for, and the adviser who must send in the approval was criticised for a banner on the stage.',
        'Stacking the cautious versions of each lever (logo-only sponsor ₹1,00,000, price at ₹200 on the poll’s reading ₹20,000, artist saving ₹45,000) gives ₹1,65,000, still ₹15,000 short, and the levers are not independent: dropping the artist would also cut the pass sales the price rise relies on.'
      ],
      balanced: [
        'Sees that no single lever closes ₹1,80,000: price alone needs 2,400 passes at ₹200, the full sponsor package nets ₹1,70,000, and dropping the artist nets ₹45,000 if only the 700 later buyers depend on him.',
        'Treats the poll (300 self-selected answers) and last year’s measured fall of 600 buyers as two readings of the same price rise, and proposes a cheap test, such as a small early batch at ₹200, before relying on either.',
        'Nets the sponsor’s offer (₹2,00,000 less ₹30,000 of lost stall fees is ₹1,70,000) and asks whether the dean would approve it and what the sponsor would take in place of the stage slot.',
        'Does not cut or keep the artist on cost or popularity alone: sets the ₹1,50,000 fee beside the 700 passes bought after the announcement and the 1,100 who came to the night.',
        'Names a mix and shows it adds up, with the shortfall in view (the cautious stack is ₹1,65,000, ₹15,000 short) and where the rest would come from, such as publicity and print (₹40,000) or prizes.',
        'Sets dates: the sponsor’s answer, the dean’s approval 10 days before the fest, the treasurer’s deadline in two weeks, and a pass-sales figure to check at week four.'
      ],
      traps: [
        'Raising the price to close the gap on the poll alone, when 7.5% of students answered and it records what they say, not what they buy.',
        'Cutting the artist because he is the biggest single line, or keeping him because the poll calls him the draw, without setting the two numbers side by side.',
        'Counting the sponsor’s ₹2,00,000 as ₹2,00,000, without the lost stall fees or a thought for whether the dean would sign.',
        'Agreeing a plan that adds up only if every optimistic figure comes true at once.',
        'Leaving without a date, when the treasurer’s deadline and the 10-day approval both fall in the next few weeks.'
      ],
      closing: 'One minute: say which levers you will pull, how much each brings towards the ₹1,80,000, and what you will check before the treasurer’s deadline.'
    },
    {
      id: 'library', type: 'decision', title: 'A library open till midnight', setting: 'Student council and library committee',
      brief: 'You are the student council and library committee of a college of 2,400 students, 1,500 of whom live in hostels. The library closes at 9 pm and has 400 seats. A petition with 900 signatures asks for midnight closing from next term. The term has 100 nights, 28 of them in four exam weeks, and the college has set aside ₹3,00,000 for extra opening hours this term.',
      task: 'Agree what you will recommend to the principal: which hours on which nights, what you will do about safety and staffing, and what you will count after a month to know whether it is used.',
      evidence: [
        { id: 'budget', title: 'The petition and the costs', text: 'The petition has 900 signatures. One late night (9 pm to midnight) costs ₹4,500: two librarians’ overtime at ₹1,200 each, a guard at ₹600, and power and cooling ₹1,500. The path from the library to the hostels is a 400 m lane with no lights; the security head wants two lights (₹30,000, once) before any late opening.' },
        { id: 'survey', title: 'The hostel noise survey', text: 'Of the 1,500 hostel students, 600 answered (40%). 420 of them (70%) said evening noise stops them studying, and 360 (60%) said they would use the library after 9 pm if it stayed open.' },
        { id: 'trial', title: 'The two-week trial', text: 'For 14 ordinary nights the library stayed open until midnight. Visits after 9 pm averaged 75 a night: 40 between 9 and 10, 25 between 10 and 11, and 10 between 11 and midnight. 55 were from the boys’ hostels, 12 from the girls’ hostels and 8 from other students. The trial cost ₹63,000. In last term’s exam week, which was not part of the trial, all 400 seats were full by 8:30 pm on 5 of 7 nights.' },
        { id: 'getting-back', title: 'Who can get back, and who can staff it', text: 'The girls’ hostels hold 600 of the 1,500 hostel students (40%) and close their gate at 10:30 pm. Two phones were stolen on the lane last term. The head librarian will staff late nights only if the rota is voluntary, and 4 of the 6 librarians have said yes.' },
        { id: 'quiet', title: 'Quiet hours in Block C', text: 'Block C, a hostel of 200 students, enforced quiet hours from 9 to 11 pm for two months. Noise complaints fell from 40 a month to 22 (45% fewer). The warden says enforcing it caused arguments, and the hostel council voted against extending it to other blocks.' }
      ],
      tensions: [
        'The survey says 360 of 600 (60%) would use the library after 9 pm, but the trial counted 75 visits a night, 67 of them from hostel students (55 + 12): about 4.5% of the 1,500 hostel students on a typical night.',
        'The trial ran in ordinary weeks, while in exam week all 400 seats were full by 8:30 pm on 5 of 7 nights. Midnight on all 100 nights costs 100 × ₹4,500 = ₹4,50,000 (₹4,80,000 with the lights), against ₹3,00,000; the 28 exam nights cost ₹1,26,000 (₹1,56,000 with the lights).',
        'A night cost ₹4,500 for 75 visits, ₹60 a visit. The survey blames noise, and quiet hours in Block C cut complaints from 40 to 22 a month at no cost, but the warden and the hostel council do not want to enforce them.',
        'The girls’ hostels hold 40% of hostel students but made only 12 of the 75 visits (16%): their gate closes at 10:30 pm, so the hours from 10:30 to midnight cannot help them, and the lane is unlit.'
      ],
      balanced: [
        'Separates what students said they would do (360 of 600) from what they did (75 visits a night) without calling either false: the survey asked about intention, and the trial ran in ordinary weeks.',
        'Sees that demand is lumpy, with full seats at 8:30 pm on 5 of 7 exam nights against 10 visits after 11 pm in the trial, and builds the recommendation around it, such as late opening in exam weeks only.',
        'Prices the options against ₹3,00,000: all term is ₹4,50,000 plus ₹30,000 for lights, ₹4,80,000, which is ₹1,80,000 over; exam weeks only is ₹1,26,000 plus ₹30,000, ₹1,56,000, which leaves ₹1,44,000.',
        'Treats noise as a separate problem that opening hours do not fix, and asks what it would take to try quiet hours in more blocks.',
        'Asks who can actually use late hours: lights on the lane, the 10:30 pm gate, a safe way back, and the librarians’ rota (4 volunteers cover 2 librarians a night, 50 late nights each over 100 nights).',
        'Names what it will count after a month, such as visits after 9 pm by hour and nights when seats are full by 8:30 pm, and what number would extend or end the change.'
      ],
      traps: [
        'Treating the survey’s 60% as a forecast of how many will come.',
        'Treating the ordinary-weeks trial as proof that nobody wants late hours, and ignoring the full seats in exam week.',
        'Agreeing to midnight all term without checking ₹4,80,000 against ₹3,00,000, or the unlit lane.',
        'Setting students against librarians instead of asking how the nights would be covered.',
        'Saying “safety” without saying what would change it, or leaving the girls’ hostels out of the discussion.'
      ],
      closing: 'One minute: say which hours you recommend, on which nights, what it costs against the ₹3,00,000, and the one count you will check after a month.'
    },
    {
      id: 'layoff', type: 'decision', title: 'Cutting costs at a start-up', setting: 'Founding team of a 40-person start-up',
      brief: 'You are the leadership team of a 40-person start-up that sells a fee-payment app to schools and a small analytics dashboard. Costs are ₹38,00,000 a month and revenue is ₹22,00,000, so you burn ₹16,00,000 a month with ₹1,20,00,000 in the bank: 7.5 months. Your investor will only talk about a new round if you have 12 months of cash after any one-off costs. That means cutting ₹6,00,000 a month, starting next month.',
      task: 'Agree what you will do to cut ₹6,00,000 a month: which option or mix, who it affects and how you will tell them, and the one number you will check next quarter.',
      evidence: [
        { id: 'costs', title: 'Where the money goes', text: 'Monthly costs: pay ₹30,00,000 for 40 people (4 leaders at ₹1,50,000, 8 seniors at ₹1,00,000, 16 mid-level staff at ₹70,000 and 12 freshers at ₹40,000), cloud and tools ₹3,00,000, office ₹2,00,000 and marketing ₹3,00,000. Revenue: ₹18,00,000 from the fee-payment app and ₹4,00,000 from the dashboard.' },
        { id: 'layoff', title: 'Laying people off', text: 'The company promised two months’ pay as severance to anyone let go, paid once, from cash. Saving ₹6,00,000 a month takes 6 seniors, or the 12 freshers (₹4,80,000) plus 2 mid-level staff (₹1,40,000), which saves ₹6,20,000 and is 14 people, 35% of the team. The 12 freshers joined from campus six to nine months ago and cost least per head.' },
        { id: 'paycut', title: 'An across-the-board pay cut', text: 'A 20% cut for everyone is ₹6,00,000 a month (20% of ₹30,00,000) with no severance. It takes ₹30,000 from each leader, ₹20,000 from each senior, ₹14,000 from each mid-level colleague and ₹8,000 from each fresher, who would be left with ₹32,000. Nobody can be made to stay: last year, when raises were frozen, 6 of the 40 resigned within four months (15%), 4 of them seniors.' },
        { id: 'poll', title: 'Staff poll', text: 'An anonymous poll: 30 of the 40 staff answered. 24 of the 30 (80%) said they would take a pay cut if it avoided layoffs and everyone took the same percentage. The 10 who did not answer are not counted.' },
        { id: 'product', title: 'Dropping the dashboard and freezing hiring', text: 'The dashboard earns ₹4,00,000 a month from 10 schools, uses ₹60,000 of the cloud and tools bill and has a team of 6 costing ₹5,60,000 (1 leader, 2 seniors, 3 mid-level). Dropping it removes ₹6,20,000 of cost and ₹4,00,000 of revenue. Five planned roles at ₹60,000 each have not been hired yet (₹3,00,000 a month once filled). If the dashboard team is kept on other work, dropping it removes only the ₹60,000.' },
        { id: 'investor', title: 'The investor and the schools', text: 'The investor says 12 months of cash, counted after severance, is the condition for talking about a new round. It also asked how many engineers would stay. Two of the 10 dashboard schools also use the fee-payment app.' }
      ],
      tensions: [
        'The 14-person layoff saves ₹6,20,000 a month, but two months’ severance (₹12,40,000) comes out of cash first: ₹1,20,00,000 less ₹12,40,000 is ₹1,07,60,000, and at a burn of ₹9,80,000 that is about 11 months (10.98), short of the investor’s 12. The pay cut reaches exactly 12 months (₹1,20,00,000 ÷ ₹10,00,000) because it has no one-off cost.',
        'In the poll 80% of those who answered would take a cut, but when raises were only frozen, 15% resigned, 4 of the 6 of them seniors. A 20% cut is a bigger shock than a freeze, and the people with the most choices leave first.',
        'Dropping the dashboard looks like ₹6,20,000 saved but gives up ₹4,00,000 of revenue, so the monthly gain is ₹2,20,000, and only if its team of six goes too, with ₹11,20,000 of severance. The hiring freeze takes nothing off today’s costs: the ₹3,00,000 is spending that would have started later. Together they leave ₹3,80,000 a month still to find.',
        'The cheapest layoff per head hits the newest people: the 12 freshers cost ₹4,80,000 between them, while 6 seniors would save ₹6,00,000. Six people or fourteen for the same saving: who bears it is a choice, not arithmetic.'
      ],
      balanced: [
        'Compares the options on two numbers, the monthly saving and the runway after one-off costs: 12.0 months for the 20% pay cut, 10.98 months for the 14-person layoff, against the investor’s 12.',
        'Counts the dashboard at ₹2,20,000 and not ₹6,20,000, and the hiring freeze at nothing against today’s costs, and sees that a mix then needs ₹3,80,000 more from somewhere.',
        'Weighs the poll against the resignations after the raise freeze, and asks how a cut could protect the lowest paid, for example a larger percentage higher up or a floor for freshers, then checks the mix still reaches ₹6,00,000.',
        'Treats the people involved as people: freshers who joined recently, the promised two months’ pay, how and when they are told, and the leaders’ own pay being in the cut.',
        'Takes up the investor’s second question, who stays, and the risk of losing seniors who carry the fee-payment app, which earns ₹18,00,000 of the ₹22,00,000.',
        'Sets a review date and says what would restore pay or roles, such as revenue or a closed round.'
      ],
      traps: [
        'Counting the hiring freeze, or the dashboard’s full ₹6,20,000, as savings.',
        'Letting the freshers go because they are newest and cheapest to release, without looking at severance, the 14 people it takes or what the rest of the team will conclude.',
        'Taking the poll’s 80% as consent, and ignoring the 10 who did not answer and the earlier resignations.',
        'Ignoring the investor’s 12-month test, or counting runway before severance is paid.',
        'Deciding without the leaders taking a visible share of the cost.'
      ],
      closing: 'One minute: say what you would do, who it affects and by how much, and the one number you would show the team to explain it.'
    },
    {
      id: 'attendance', type: 'opinion', title: 'Should 75% attendance be compulsory?', setting: 'College academic council',
      brief: 'In this college, a student with attendance below 75% in a course cannot sit its end-semester exam. The academic council is reviewing the rule and has asked student and faculty members for a view. Last year 85 of the 3,400 students were barred from at least one exam.',
      task: 'Agree the position you will give the council: whether 75% attendance should stay compulsory, be changed or be dropped, the two pieces of evidence it rests on, and what would change your mind.',
      evidence: [
        { id: 'marks', title: 'Marks and attendance', text: 'In one department’s records for 480 students, the 400 (about 83%) with attendance of 75% or more averaged 68% in the end-semester exam; the 80 below 75% averaged 52%. The records do not say why anyone was absent.' },
        { id: 'trial', title: 'A semester without the rule', text: 'For one semester a final-year elective of 90 students ran without the attendance rule. Attendance fell from 82% to 64%. The average exam mark moved from 66% to 65%. The students were in their last year, with placement tests ahead, and it was a single semester.' },
        { id: 'reasons', title: 'Why students miss class', text: 'Of 600 students surveyed, 120 (20%) were below 75% in at least one course. Asked why, 54 said illness or family (45%), 36 said part-time work or tutoring (30%) and 30 said the lectures were not useful (25%). Asked whether attendance should be compulsory, 348 of the 600 (58%) said no and 252 (42%) said yes.' },
        { id: 'labs', title: 'Labs and teachers', text: 'In first-year labs, 60 students missed 2 or more of 10 sessions and 21 of them (35%) failed the lab viva; of the 240 who missed fewer, 12 (5%) failed. 24 of 30 teachers surveyed (80%) said the rule is the reason first-years turn up in the first month, and that lab work cannot be made up from notes.' },
        { id: 'sheets', title: 'Sheets and class time', text: 'In a spot check of 10 classes, the sheets showed 400 students present and a headcount found 350: 50 students marked present were not there (12.5% of the sheet). Paper roll call takes about 6 minutes of a 50-minute lecture (12%).' },
        { id: 'barred', title: 'Who is barred', text: 'Last year 85 of 3,400 students (2.5%) were barred from at least one exam. 51 of the 85 (60%) had a documented illness or family emergency; the other 34 had no reason on record.' }
      ],
      tensions: [
        'Students above 75% averaged 68% against 52% below, a gap of 16 points. But when one elective ran without the rule, attendance fell 18 points (82% to 64%) and marks fell 1 point (66% to 65%). The first is an association across students, the second a small, final-year group for one semester. Neither shows what the rule does to a typical first-year.',
        'Missing class is not one thing: of the 120 students below 75%, 45% (54) were ill or had a family emergency, 30% (36) were working and 25% (30) found lectures not useful. The rule treats them the same, and 51 of the 85 students barred (60%) had a documented reason.',
        'Labs look different from lectures: 35% of first-years who missed 2 or more labs failed the viva, against 5% of the rest, and lab work cannot be made up from notes. Yet 58% of students say the rule should go, and the 35% against 5% is also an association, not a cause.',
        'The sheets overstate attendance by 12.5% (50 of 400) and roll call takes 12% of a lecture, so the 75% figure is less reliable and costlier than it looks. Yet 80% of teachers (24 of 30) say the rule is why first-years turn up.'
      ],
      balanced: [
        'Does not read 68% against 52% as proof of cause, and says what else could explain it, such as illness, work or motivation.',
        'Gives the one-semester result its weight and its limits: 90 final-year students, one semester, placement tests ahead.',
        'Separates kinds of class: labs, where work cannot be made up (35% against 5% failing the viva), and lectures, where 58% of students say the rule should go and the survey cannot say whether learning would change.',
        'Takes the 85 barred students seriously: 51 had documented reasons, and a fair rule has a way to count them.',
        'Notes the weakness of the measure (50 of 400 marked present were not there) and its cost (6 minutes of a 50-minute lecture).',
        'Takes a clear position (keep, change or drop) with the conditions it needs, and says what would change it.'
      ],
      traps: [
        'Quoting 68% against 52% as proof that attendance raises marks.',
        'Quoting 66% against 65% as proof that attendance does not matter.',
        'Treating every absent student as careless, when 45% of the reasons were illness or family and 30% were work.',
        'Settling it by the survey’s 58%: what students prefer is not what helps them learn, and the teachers’ 80% is also an opinion.',
        'Two camps repeating their positions without answering the strongest point on the other side.'
      ],
      closing: 'One minute: state your position on the rule, the two pieces of evidence it rests on, and what would change your mind.'
    },
    {
      id: 'wfh', type: 'opinion', title: 'Should freshers work from home in their first year?', setting: 'Graduate trainee programme at an IT services firm',
      brief: 'An IT services firm in a metro city is deciding whether its freshers may work from their home towns for the whole first year. Last year, 60 of its 120 freshers chose remote work and 60 worked in the office. They chose; they were not assigned. The HR head has asked a group of recent graduates and managers for a view.',
      task: 'Agree the position you will give the HR head: whether freshers should work from home in their first year, under what conditions, the two pieces of evidence it rests on, and what would change your mind.',
      evidence: [
        { id: 'learning', title: 'Learning', text: 'The training team tracked when each fresher first finished a task without help. Office freshers took 9 weeks on average; remote freshers took 13, which is 4 weeks later. The freshers chose where to work, so the two groups were not matched.' },
        { id: 'cost', title: 'Cost', text: 'A fresher earns ₹32,000 a month (₹3,84,000 a year). Living in the metro costs about ₹24,000 a month (shared flat ₹14,000, food ₹8,000, travel ₹2,000), which is 75% of pay. At home, the extra cost of working (internet, a desk, power) is about ₹6,000 a month. The difference is ₹18,000 a month, or ₹2,16,000 a year.' },
        { id: 'output', title: 'Output', text: 'In their first six months, remote freshers closed 41 support tickets a month on average and office freshers closed 38. Customers reopened 11% of the remote freshers’ tickets and 6% of the office freshers’.' },
        { id: 'survey', title: 'What freshers say', text: 'Of the 120 freshers surveyed, 78 (65%) said they would prefer remote or hybrid work next year. 48 of the 60 office freshers (80%) said they felt part of a team; 30 of the 60 remote freshers (50%) did.' },
        { id: 'who', title: 'Who chose, who stayed and who left', text: 'Of the 60 remote freshers, 45 (75%) came from outside the office city; of the 60 office freshers, 18 (30%) did. Within a year, 9 remote freshers left the firm (15%) and 3 office freshers (5%). 6 of the 9 remote leavers were from outside the city. 18 of the remote freshers (30%) said they had no private space or reliable internet at home.' },
        { id: 'managers', title: 'Managers', text: 'Of 24 managers who onboarded freshers, 18 (75%) said a remote fresher takes about 5 hours of their time a week and an office fresher about 3. Managers’ appraisals do not count time spent mentoring.' }
      ],
      tensions: [
        'Remote freshers saved ₹18,000 a month (₹2,16,000 a year, over half of a ₹3,84,000 salary), but took 13 weeks against 9 to finish a first task alone, and 15% left against 5%.',
        'Remote freshers closed more tickets (41 against 38) but more were reopened (11% against 6%): 41 × 0.89 is about 36.5 that stayed closed, against 38 × 0.94, about 35.7. The count alone says remote is ahead; the count after reopening says level.',
        '65% of freshers say they prefer remote or hybrid work, but only 50% of remote freshers feel part of a team against 80% in the office. What people prefer and what works for them are different questions.',
        'The groups differ: 75% of the remote freshers came from outside the city against 30% of the office freshers, so the 4-week gap, the leaving rate and the saving may come from who chose remote work and not from where they worked. 30% of remote freshers also lacked private space, and managers give a remote fresher 5 hours a week against 3 without it counting in their appraisals.'
      ],
      balanced: [
        'Names the selection problem: freshers chose, and the remote group had more people from other towns (75% against 30%), so the 4-week gap and the 15% against 5% cannot be put down to remote work alone.',
        'Separates the count of tickets (41 against 38) from their quality (about 36.5 against 35.7 stayed closed) and treats output as roughly level.',
        'Weighs a saving of ₹2,16,000 a year for the fresher against slower learning and more leaving, and asks who bears each cost.',
        'Offers conditions, not a yes or no: for example office first until the first task is done alone, remote after, and help for the 30% without private space.',
        'Notes the managers’ extra 2 hours a week (5 against 3) and that appraisals ignore it, so a change of policy needs a change in how mentoring is counted.',
        'States a position and what evidence would change it, such as a pilot where freshers are assigned by lot.'
      ],
      traps: [
        'Using the 65% preference as proof that remote work works.',
        'Using ticket counts alone, without the reopened tickets.',
        'Taking the 4-week gap and the leaving rates as caused by remote work, when freshers chose their group.',
        'Arguing from one person’s experience, or a friend’s company, instead of the figures.',
        'Treating it as all or nothing, or forgetting that the fresher bears the rent and the firm bears the mentoring time.'
      ],
      closing: 'One minute: state your position, the two numbers it rests on, and the condition under which you would change it.'
    }
  ];

  const api = { MOVES, TIMINGS, GROUP, BRIEFS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GD_CONTENT = api;
})(this);
