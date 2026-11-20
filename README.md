# Case Room

Twelve original fictional cases (nine consulting, three product and analytics), eight stages, two paths per case, spoken prompts, an optional blind mode that hides the title and stage names, a typed data request before the exhibit menu, and optional bring-your-own-key AI coaching. A case maths drill, a peer interview mode, behavioural (HR) interview practice with a story bank, a résumé and project defence, a group discussion kit with an observer’s tally, campus placement aptitude practice and a résumé checker sit alongside the cases.

## Product and analytics cases

Three cases for product manager, product analyst and business analyst interviews. Filter the library by **Product & analytics** to find them.

- **Where did the orders go?** (metric drop): a quick-commerce app loses 13% of orders in a week. Locate the drop in the funnel, segment it, size it, then act and measure.
- **Did the streak work?** (metrics and experiments): read an A/B test of a learning-app streak. Choose a primary metric and guardrails, separate relative from absolute lift, and check whether the effect lasts and whether the experiment is sound.
- **Which feature first?** (product sense and prioritisation): choose one of three features for kirana shopkeepers using research, RICE scoring and revenue sizing, then plan a test.

They use the same eight-stage flow, with their own stage names, prompts, closing notes and review criteria (`archetype` `analytics`, `metrics` and `product` in `content/cases.js`), and work in peer interview mode and with optional AI coaching. Cases with `track: 'product'` appear under the Product & analytics filter.

## Case maths drill

Open **Maths drill** in the header, or link straight to `/#drill`. Short rounds of generated questions across nine skills: percentages, growth and decline, profit and margin, break-even and payback, lakh/crore/million conversions and scaling, compounding and CAGR, present value and NPV, quick estimates, and reading a bar-chart exhibit.

- Choose skills, difficulty (Foundation, Interview, Stretch), 5/10/20 questions and an optional 30s or 60s time target.
- Every answer is checked instantly against a stated tolerance (exact calculations allow small rounding; estimates allow ±8%). Each question then shows its worked steps and a mental-maths shortcut.
- Optional read-aloud and listening practice, which hides the written question the way an interviewer would say the numbers.
- Results show accuracy and time per question, let you retry only the ones you missed, and export a text summary. Per-skill accuracy and median time from your last 30 attempts suggest which skill to practise next.
- No AI and no server: questions are generated in the browser (`src/drill-questions.js`) and progress stays in this browser's localStorage (`cr-drill-*` keys). An unfinished round resumes after a reload.

## Peer interview

Open **Peer interview** in the header, or link straight to `/#peer`. Two people practise together: one runs the case from an interviewer guide, the other answers out loud. Any of the twelve cases works.

- The guide walks through all eight stages. For each one it shows what to ask, what to share when the candidate asks (clarifications, exhibits, path data, new evidence), what a strong answer sounds like, a follow-up question, and an answer key with the hint to offer if they are stuck.
- The interviewer types the candidate's number and the guide says whether it is within the case's tolerance.
- The candidate sees only the brief and what the interviewer shares. Either open the candidate screen (`/#peer-screen`) in a second window and share it on a video call (it updates live from the guide on the same device), or turn the screen when you share something.
- The interviewer rates each stage (strong, solid, needs work), takes notes, ticks the case's strengths and common traps, and writes one thing to keep and one to change. That becomes feedback to download or print. It is a peer's judgement, not a score.
- **Printable sheet** (`/#peer-sheet/<case id>`): a one-page candidate handout followed by the full interviewer sheet with both paths, answers and scoring boxes, for practising on paper.
- No AI and no server. Interviews in progress and finished feedback stay in this browser (`cr-peer-*` keys).

## Behavioural interview practice

Open **Behavioural** in the header, or link straight to `/#behavioural`. Practice for the HR round, with no AI.

- An original bank of 66 questions across nine competencies: tell me about yourself, why this company or role, leadership, teamwork, conflict, failure or mistake, handling pressure, initiative, and ethics. Each competency has "listen for" cues, follow-up questions and a target length (60–120 s for the opening pitch, 45–90 s for motivation, 90–120 s for stories).
- Pick a competency or mixed questions. The question can be read aloud. Answer by dictation or typing; a visible timer starts when you start answering.
- Feedback is computed in the browser and labelled as heuristics, not a score: word count and estimated speaking time, pace (dictated answers only), filler words ("um", "uh", "like", "basically", "actually", "you know", "kind of" and a few more, with common legitimate uses such as "I like" excluded), and "I" versus "we".
- Delivery checks (also heuristics): hedging phrases ("I think", "maybe", "probably"…), softeners and intensifiers ("just", "really", "very"), sentences that keep starting the same way and "and then" chains, sentence length (when the answer has full stops), and long pauses of 3 seconds or more while dictating (measured from gaps between the browser's speech results, so approximate).
- **Delivery goals:** set your own targets for filler words, hedging, long pauses, speaking pace (120–160 words a minute) and answer length, or switch any off. Every answer shows which goals it met, and the HR page shows a strip of your last ten answers per goal (met, missed or not measured) with whether you are improving.
- **Interview conditions:** choose it under "How it runs" on the HR page to run the same questions the way the round runs.
  - No skipping, no second attempt, no pause button, no help, no target meter, and the competency is not named. Each question is read aloud where the browser can speak.
  - After each answer the interviewer asks one or two follow-ups. The first comes from a rule when one fires: a very short answer, a very long one, "we" outnumbering "I", no number or result word, or no lesson on a failure question. Then comes one prepared follow-up for that competency. An answer that trips no rule gets the prepared one only. Hypothetical questions skip the result, number and lesson rules.
  - While dictating, the interviewer moves on after 7 seconds of silence (with a warning from 4 seconds) and cuts in when an answer passes 125% of its upper target, or 90 seconds on a follow-up. Typed answers end only with the button.
  - Nothing is shown between questions. At the end the student first says which answer they think was weakest, then sees every answer's flagged habits, each follow-up with the reason it was asked, and how many times they left the interview. "End the interview" keeps what was answered.
  - The rules are in `followUps()` in `src/behavioural-content.js` and count words; they do not understand the answer, and the page says so. Tests are in `tests/interview.test.cjs`.
- STAR check: tag each sentence of your transcript as Situation, Task, Action or Result (or Present/Past/Future for "tell me about yourself" and Them/Role/You for "why us"). The page shows each part's share and flags missing parts, a long set-up, an Action that is not the largest part, a Result without an outcome or number, and, for failure questions, a missing lesson. Dictation without full stops is split into chunks you can re-split by editing the transcript.
- Answers are saved with your tags, self-review ticks and notes. The behavioural home shows history per competency, with view, delete and text download.
- **Story bank** (`/#behavioural-stories`): write 6–8 STAR stories, tag the competencies each one covers, and see which competencies have no story yet. Link a practice answer to a story. Export and import the bank as JSON.
- **Practise with a friend** (`/#behavioural-sheet/<competency>` or `/#behavioural-sheet/all`): a printable interviewer sheet with the questions, follow-ups, "listen for" ticks and a 1–5 scoring line, in the same style as the peer interview sheet.
- No AI and no server. Everything stays in this browser (`cr-behavioural-*` keys). Questions and checks live in `src/behavioural-content.js` (no DOM, unit-tested in Node).

## Résumé and project defence

Link straight to `/#defence`, or open it from the HR interview page, from a bullet in the résumé checker, or from a plan. An interviewer picks one line of your résumé, or one project, and keeps asking until they know what you did. It runs under interview conditions like the HR interview: no help, no skipping, no second attempt, and feedback only at the end. No AI and no server.

- **Two ways in:** paste one résumé line (or pick one from the résumé you checked), or name a project and say what kind of work it was (course project, lab or thesis, internship task, fest or club, volunteering, family business or own venture). No internship is needed.
- **The questions come from simple rules** in `lineQuestions()` and `projectQuestions()` in `src/defence-content.js`. A line gets up to five: it always opens on the story and closes on what went wrong, and the middle ones depend on what the words in the line show.
  - A claimed change (a verb such as "reduced" or "grew" with a figure) draws a question on how it was measured, and one on what else could explain it.
  - A prize, rank or selection draws "how many others were in the running". A line with a figure but no change, or no figure at all, draws a question on what came of the work.
  - A vague opener ("helped", "responsible for", "worked on") draws "what exactly did you do yourself". Being in charge of a team draws a question on one problem inside it, and other team words draw "which part was yours alone".
  - A named tool (Excel, SQL, Python…) draws "what exactly did you do in it", and a named method (a model, a survey, a dashboard…) draws "explain it to someone who has never seen one".
  - A project gets five fixed questions: why you went about it this way, what you did yourself, what failed, how you checked it worked, and what you would change.
- **One follow-up at most per answer**, chosen by counting: an answer under 25 words ("that was brief"), "we" outnumbering "I" on the contribution question, or no number in an answer about evidence. A follow-up never gets a follow-up. Each question and follow-up carries the reason it was asked, which is shown only in the debrief.
- **The debrief** shows every question with why it was asked, your answer (collapsed, with word count and time), the follow-up and your reply, and three "did your answer cover these?" ticks that you fill in yourself. Nothing is scored. It says plainly that the rules cannot check whether a claim is true or an answer is good. "End the defence" keeps what was answered and goes straight to the debrief.
- **Rewrite the line** (line defences): hints from the rules, a box prefilled with your line, and live checks from the résumé checker's bullet rules (heuristics, not a score). Copy the new line, or, if the original line is in the résumé currently loaded in the checker, put it back there in one click. The checker updates; the résumé is saved only if "Remember my text" is ticked there, as before.
- **Keep it as a story:** copies your answers into the HR story bank (as one story, `df` plus the session id, so saving again updates it instead of adding another). You tag its competencies in the story bank. Download the whole defence as a text file.
- **Stored in this browser:** `cr-defence-run` (the defence in progress, so a reload resumes at the same question or follow-up with your typed text) and `cr-defence-past` (up to 20 finished defences, newest first). Only the one line or project title and your answers are kept, never the résumé. Everything read back is validated field by field and anything corrupt is ignored.
- **Links:** a "Defend this line in an interview" button inside every bullet of the résumé checker; a panel on the HR interview page; the HR round tile and "Continue where you left off" on the home page; and two plan items ("Defend one line of your résumé" in the HR and résumé plans, "Defend a project" first in the technical plan).
- The rules and wording are in `src/defence-content.js` (no DOM, unit-tested in Node); the screens are in `src/defence.js` and `assets/defence.css`; tests are in `tests/defence.test.cjs`.

## Group discussion kit

Link straight to `/#gd`, or open it from the group discussion round tile on the home page, from a plan, or from the printable kit at `/#gd-sheet/<brief>`. Three to six people discuss a brief with one phone or laptop as the clock, in about 12 minutes. One of them can sit out as the observer and tap what each speaker does. There is no AI and no server: **the app keeps time and counts what the observer taps. It does not hear the discussion**, and the debrief says so.

- **How a session runs.** Choose a brief and type the names (three to six; with an observer you need at least four names, because the observer does not speak). Then: a 90-second silent read of the brief, the task and the evidence cards (the discussion starts by itself at zero, or earlier with a button); the discussion (6, 8, 10 or 12 minutes) with a large countdown, the task and collapsible evidence always at hand, and status messages at halfway, at one minute left and at time up; a 60-second summary, where the app suggests the person with the fewest noted good moves to sum up (it only suggests when an observer has tapped something); then the debrief. Ending early is always possible.
- **What the observer notes.** One row per speaker and a button per move, good moves first and the two habits to watch for kept apart: opened or framed, used evidence, built on a point, brought someone in, disagreed with a reason, kept the group on task, summarised fairly; cut someone off, repeated a point. Each tap is logged at the time it was made and can be undone. A few words can be attached to the last tap, and the debrief quotes up to three of them for that person. The moves are counted and quoted back, never added up into a score.
- **The debrief.** Observations about the group, each with the count it rests on (nobody summarised, one person has more than half of the logged moves, nobody was brought in, no evidence was quoted, three or more interruptions); nothing is said when fewer than five moves were logged. A table of speakers by moves that scrolls sideways on a phone; a card per speaker with what was noted, moves that were "not seen" (the observer may have missed them), and two boxes, "One thing to keep" and "One thing to change", saved as typed. Only now are the three hidden lists shown: what a balanced conclusion weighs, where the evidence pulls apart, and common traps. Download everything, or one speaker's feedback, as a text file.
- **The briefs.** Original and fictional, with figures that agree across the brief, cards and answers, and evidence that pulls in different directions so there is no single right answer. `mess`: cut hostel food waste by a third with ₹60,000 (an audit against a survey; a popular poster campaign with no measured effect). `fest`: close a ₹1,80,000 fest funding gap by price, cuts or a sponsor with conditions. `library`: a midnight library against a noisy-hostel survey, a low-use trial, security and staffing. `layoff`: cut ₹6,00,000 a month at a 40-person start-up by layoffs, a pay cut, or dropping a product line. `attendance` (opinion): should 75% attendance be compulsory, with a correlation that does not show cause. `wfh` (opinion): should freshers work from home in their first year.
- **The printable kit** (`#gd-sheet/<brief>`, "Print / save PDF", with a brief switcher): page 1 for everyone (brief, task, evidence, timings; no answers); page 2 for the observer (a grid of blank names by moves, what each move means, the signals to call out for each length, keep and change lines); page 3 for after the discussion (balanced, tensions, traps).
- **A reload at any phase resumes in that phase.** Countdowns are worked out from the time each phase started, not from a running counter, so the clock stays honest while the page is closed. If the discussion time ran out while the page was closed, you come back at the summary with a note. The summary never ends by itself.
- **Stored in this browser:** `cr-gd-run` (the discussion in progress, kept until you leave its debrief) and `cr-gd-past` (the last 10 finished discussions, newest first). Both are checked field by field on every load, and anything corrupt is ignored without errors. Names, taps, notes and keep and change text stay on the device.
- The briefs and moves are in `content/gd.js`; the rules (set-up checks, clock, tally, who sums up, feedback, group notes, text downloads) are in `src/gd-logic.js` (no DOM, unit-tested in Node); the screens are in `src/gd.js` and `assets/gd.css`; tests are in `tests/gd.test.cjs`. To add a brief, add an object to `BRIEFS` in `content/gd.js`: the test checks its schema, and that no balanced, tensions or traps text appears in what participants see.

## Placement aptitude practice

Open **Aptitude** in the header, or link straight to `/#aptitude`. Practice for the online aptitude tests (quantitative, logical and verbal) that Indian campus placements use before any interview. Free, no AI and no server.

- **Topic practice:** choose a section and one or more topics, a difficulty (Easy, Medium, Hard, Advanced, Expert), 5/10/20 questions and an optional per-question target (up to 2 minutes). Every answer gets instant feedback, a worked solution and a shortcut. "Show solution" counts as a miss.
- **Timed test:** choose sections, 5/10/20/30 questions per section, difficulty (a single level, Mixed for the usual Easy–Hard spread, or Mixed: Hard to Expert), time (36 s, 1 minute, 90 s or 2 minutes per question) and negative marking (none, −0.25, −1/3 or −0.5).
  - **Start from a typical pattern:** four generic presets (standard placement test, short screening round, higher-package track, competitive-exam style) fill in the settings above; nothing starts until you press Start. Company names appear only as “e.g.” examples drawn from public prep-site write-ups, and the page labels every preset approximate and tells students to follow their drive notice. Edit them in `content/aptitude-presets.js`.
  - Pick one timer for the whole test, or a separate timer for each section (finished sections are locked).
  - A question palette shows answered, not answered, not visited and marked-for-review questions and lets you jump around. Clear a response, or mark it for review (answered marked questions still count).
  - There is no feedback until you submit. The test submits itself when time runs out.
  - Without exam conditions the clock runs only while the test is on screen. "Save & exit", leaving the page or reloading pauses it, and the test resumes with the remaining time it had.
  - **Moving between questions:** "Move freely" (the default) or "No going back to earlier questions". In the forward-only mode there is no Previous button and no marking for review, and earlier questions on the palette are disabled.
  - **Exam conditions** (a checkbox in the timed-test setup, off by default): a brief screen (sections, questions, minutes, marking, navigation, rules) comes first and the clock starts when you press Start. After that the clock **does not pause**: it keeps counting in real time if you switch tab, open another screen, close the page or reload, and a long absence can end a section (with a separate clock per section) or the whole test, which is then submitted when you come back. Leaving the test is counted once per absence (tab hidden, page closed or reloaded, another screen, or leaving full screen) and shown in a banner with the time away; a notice can end the test after 3 or 5 exits. There is no Save & exit. Full screen is requested when the test starts if the browser allows it, but the test never depends on it. When the test is submitted, the result is saved first and you are asked to guess how many you got right before the score appears; the results then show the guess, the score, the exits and time away, and how the test ended. The text download carries the same lines. This is practice for the pressure of a real online test: it does not watch you, and a determined student can get round any browser-only rule (for example by changing the device clock).
- **My placement notice:** copy the sections, question counts, minutes and marking from your drive notice into "Set up a test from my notice" and keep up to 10 of them. Each section has its own number of questions (up to 40 for quantitative and logical, 30 for verbal) and minutes (1 to 120); choose a separate clock per section or one clock for the total, a difficulty, navigation, exam conditions and what happens when you leave the test. The notice name is used in headings and in your history. The source note is shown as plain text and never as a link. You entered these settings yourself and Case Room has not checked them against any employer.
- **Shared papers** (no server): "Share" on a notice gives a link (`/#aptitude/paper/<code>`) and a code. Everyone who opens it gets the same questions and the same clock rules, as long as they use the same site and version: the code holds a random seed, the settings and a six-character check of the question ids, and the questions are generated again from the seed. If the check differs, the brief warns that this copy builds different questions and the result line is marked with its own check. Paste a code or a whole link on the aptitude home to open one. After a shared paper the results offer a **result line** (`CR1|check|name|score|correct|wrong|skipped|not reached|seconds|times left|sum`) to send to the organiser. The organiser opens "Collect results from a shared paper" (`/#aptitude/collect`), pastes the lines, and gets a ranking (best score, then least time; equal scores share a rank), notes about unreadable lines, lines from a different paper and repeated names, and a CSV download. Nothing on the collect screen is stored. The last characters of a line catch copying mistakes only: anyone can write a line, so use this for practice groups, not for decisions that matter.
- **Results:** score with the negative-marking working, accuracy of attempted questions, average time per attempted question, a per-topic breakdown (accuracy over attempted questions, with how many you attempted), and a review of every question with your answer, the correct one and the worked solution. A timed test counts wrong, skipped (seen but not answered) and not reached (never opened) separately. Two practice sets are offered: "Retry the ones I got wrong" (in topic practice this includes solutions you revealed) and "Attempt the ones I left unanswered" (timed tests). There is also a text download. Your last 30 answered questions per topic give accuracy and median time, and the weakest topic is suggested with a one-click practice set.
- **Sections and topics:**
  - **Quantitative** (all generated): percentages, profit & loss, simple & compound interest, ratio & proportion, averages & mixtures, time & work, pipes & cisterns, time-speed-distance (trains, boats), number system (divisibility, HCF/LCM, remainders, unit digits), permutations & combinations, probability, and data interpretation from a generated table or bar chart.
  - **Logical** (generated): number and letter series, coding–decoding, blood relations (built from a generated family tree), direction sense, seating (clues are added to a generated arrangement until a brute-force search leaves exactly one solution), syllogisms (validity is checked against every Venn diagram), and odd one out.
  - **Verbal** (original authored bank in `content/aptitude-verbal.js`): synonyms and antonyms, fill in the blank, error spotting, sentence ordering (para-jumbles), and five reading-comprehension passages with 3–4 questions each.
- **Advanced and Expert levels** (for higher-package campus tracks and MBA-entrance-style tests) add question types that combine two or more ideas, rather than bigger versions of Hard. An older type reused at these levels runs with its Hard settings.
  - **Quantitative:** consumption change after a price change, pass marks, election margins, "buy x get y free" markups, two items sold at the same price, false weights on both sides, compound amounts in consecutive years, equal instalments, three-year CI − SI, coins in a ratio, partnerships with joining and withdrawal, miscopied averages, repeated replacement, mixing two vessels, workers × hours × days, alternate-day work, men-and-women crews, closing a pipe in time, a leak against an inlet, late/early arrival, boat and stream from distances, circular tracks, trailing zeros and Legendre's rule, counting (even/odd) factors, common remainders, no-two-together arrangements, forming numbers from digits, identical items among people, two bags, Bayes, independent solvers, two cards together, the region with the highest growth, change in share (percentage points) and the growth needed for a target average.
  - **Logical:** new series rules and "find the wrong number", swapped arithmetic symbols, code-language sentences (unique code checked by brute force), coded blood relations, shadows and the sun, relative positions of points, circular seating facing the centre (6 or 8 people), a five-floor puzzle with a second attribute, syllogisms with "is a possibility" conclusions and odd-pair relations.
  - **Verbal:** new Advanced and Expert items in every verbal topic and one new reading passage at each level. With only three passages at Hard or above, a long verbal section at these levels can fall back to easier passages.
- **Questions:** every question is multiple choice with four distinct options and exactly one correct answer. Wrong options come from common mistakes, such as adding percentages instead of compounding, dividing by the wrong base, swapping left and right, or stopping a series one step early. Indian context and units (₹, lakh, crore, km/h) are used where natural.
- Generated questions are reproducible from a seed (`src/aptitude-questions.js`, no DOM, unit-tested in Node). Progress stays in this browser (`cr-aptitude-*` keys: run, history, prefs and `cr-aptitude-notices` for your saved notices). Nothing is sent anywhere, there is no camera or microphone, and no account. Stored data is validated when read, and anything corrupt is ignored. Delete history from the aptitude page.

## Spoken English practice

Open it from the Aptitude or HR interview page, or link straight to `/#english`. Practice for the spoken-English sections some employers add to campus online tests. Free, no AI, nothing recorded.

- **Read aloud** (needs dictation): read a sentence on screen. The result highlights the words the browser did not hear as written, lists extra words, and gives a reading pace.
- **Repeat the sentence:** hear a sentence (at most twice) without seeing it, then say it back. It can be typed where dictation is unavailable; without read-aloud it shows for five seconds instead.
- **Quick answers:** hear a short question and answer in a word or two. Accepted answers allow common variants.
- **Just a minute:** 15 seconds to think, then one minute on a topic. Dictation stops itself at the minute. The report covers time spoken, words, pace, filler words, repeated words and the delivery checks from the HR practice, plus a self-check of structure.
- **Full practice** (about 8 minutes): 3 read, 3 repeat, 4 quick answers and 1 talk, easier sentences first, avoiding recently used items. An unfinished practice resumes after a reload and appears under "Continue where you left off".
- **Words to practise:** words the browser missed at least twice in recent reading and repeating.
- Scoring compares the browser's transcript with the expected text after normalising case, punctuation, contractions, numbers (9 = nine), hyphens and British/American spellings. It describes what the browser heard; microphone, noise and accent all affect it, and a real test may score pronunciation in ways this cannot. The page says so.
- Original content in `content/english.js` (18 sentences to read, 18 to repeat, 18 questions, 20 topics). Scoring is in `src/english-check.js` (no DOM, unit-tested in Node) and the UI in `src/english.js`. Results stay in this browser (`cr-english-*` keys) and can be deleted from the page.

## Résumé and job-description checker

Open **Résumé check** in the header, or link straight to `/#resume`. It checks the whole résumé and every bullet point, with or without a job description, and, if one is pasted, shows which of its keywords are missing. Free, with no AI and no server: **your file is read in your browser and nothing is uploaded.**

- **Getting the résumé in:** choose or drag a PDF, Word (.docx) or .txt file (up to 5 MB), paste the text, or load a fictional sample. Images, `.doc`, `.pages` and `.odt` are rejected with a message suggesting PDF, Word or pasting. The extracted text goes into the résumé box with a note to check it; **the checks always run on that box, never on the file**, so extraction mistakes can be fixed first. The page shows the file name, type, and how many lines and bullets were found. The file itself is never stored.
  - **.txt** is read as UTF-8.
  - **.docx** is unzipped in the browser (stored and deflated entries, via `DecompressionStream('deflate-raw')`) and `word/document.xml` is parsed with `DOMParser`. Word list paragraphs become "•" bullets, heading styles and short all-caps lines become section headings, tabs become spaces and line breaks start new lines. Headers, footers and text boxes are ignored, and text in tables or text boxes may be missed.
  - **.pdf** uses Mozilla's pdf.js, stored in `vendor/pdfjs/` and loaded only when a PDF is chosen. Lines are rebuilt from the text positions: spaces from gaps, paragraph and page breaks, bullet glyphs turned into "•", words hyphenated across lines rejoined, and wrapped bullets joined (by indent, or because the line reaches the right margin and carries on). Simple two-column layouts are detected and read left column first; the page still warns that columns can come out in the wrong order. A PDF with under about 200 characters of text is reported as scanned or image-only (there is no OCR). Password-protected PDFs get their own message. PDF reading needs the hosted site or `npm start`; from a file opened directly from disk, upload a .docx or paste instead.
- **Whole-résumé checks** (always run; no job description needed): contact details (email and phone; a LinkedIn, GitHub or portfolio link is suggested, not required); core sections (Education, Experience or Projects, Skills); overall length estimated from the word count (under 150 words, over two pages, or over about a page with no Experience section); personal details recruiters do not need (date of birth, age, gender, marital status, religion or caste, nationality, parents' names, passport number, a declaration, "references available on request"); stock phrases in a summary or objective ("challenging position", "reputed organisation", "utilise my skills"…) or a summary over 60 words; roles with no bullets or more than six; undated Experience entries and dates written two ways (May 2025 and 05/2025); mixed bullet markers or full stops; mixed British and American spellings (organise/organize); and skills listed under Skills that appear in no bullet or other section (spoken languages and levels such as "basic" are ignored). Each shows a reason and a suggested fix, and updates as bullets are edited.
- **Bullet checks** (a checklist, not a score): a strong past-tense action verb from a list of about 200 (weak openers such as "responsible for", "worked on", "helped" and first-person "I"/"my" are flagged); a number or measurable result (digits, %, ₹/$, lakh/crore, "3x", number words; years do not count; a warning, not a fail); passive voice (a "be" + participle pattern, labelled a heuristic); length (under 8 or over 30 words, or past about two lines); filler and vague words ("various", "etc.", "successfully", "team player"…); the same opening verb on three or more bullets, or twice in one role, with similar verbs to try; and, per role, present tense in a finished role or a mix of tenses. Bullets are found from •, -, *, –, ▪ and numbering, plus plain lines under Experience, Projects and Positions of Responsibility. Each bullet expands to show why, and can be edited in place: the checks, the summary, the match and the résumé box update as you type.
- **Job-description match** (optional): keywords and two- and three-word phrases are extracted from the advert, generic hiring words ("candidate", "requirements", "years", "experience" on its own) and names are dropped, and terms are ranked by frequency, by section (requirements weigh more) and by a list of common skills and tools. Matching handles case, plurals, simple stemming, British and American spellings and variants (analyse/analyze/analysis, MS Excel/Excel, ML/machine learning, JS/JavaScript). Results are grouped as **Matched**, **Only in Skills, not in any bullet** (weaker evidence) and **Missing**, with the share of the top 20 found. The page says plainly that this is word overlap, not how a recruiter or an applicant tracking system will judge the résumé, and that a missing keyword should be added only where the student genuinely has that experience.
- **Output:** copy the improved bullets, or download a text report.
- **Saving is optional and off by default.** Tick "Remember my text on this device" to keep the résumé and job-description text (never the file) in this browser (`cr-resume-*` keys). Unticking it, or "Delete saved text", removes it.
- The analysis (`src/resume-check.js`) has no DOM access and is unit-tested in Node, including the PDF line rebuilding and the .docx XML conversion. Word lists and the samples are in `content/resume-words.js`. File reading is in `src/resume-files.js`. Apart from loading pdf.js from this site, the tool makes no network requests; a test fails if `fetch`, `XMLHttpRequest` or `navigator.sendBeacon` is called during analysis.

## Included AI features

- **Feedback:** assesses the candidate's actual responses across six reasoning dimensions, with exact-excerpt verification, improvement priorities and a practice exercise. No hiring-readiness score.
- **Adaptive interviewer:** asks an answer-specific follow-up, accepts a typed or dictated reply and uses that discussion for subsequent questions. Up to four follow-ups per stage. The authored eight-stage case remains the structure; this is not an unrestricted autonomous interviewer.
- **Natural information requests:** maps questions to authored exhibits and clarifications. The app returns canonical facts, not model-invented figures. Later branch evidence is gated by stage.
- **Fallback:** all authored cases and deterministic arithmetic checks work without AI; external copy-and-paste review remains available.

## Seamless practice flow

Without a configured key, there are no AI interview panels, connection reminders or AI-generation controls in the case or debrief. Settings is the only entry point. After connecting, information requests sit above the existing answer box and follow-up discussion sits below it; the normal Continue button remains unchanged. Clearing the key removes these controls immediately without discarding answers. Previously generated feedback remains accessible as a collapsed saved record.

### Blind cases and data requests

Neither feature uses AI. Both apply to the eight-stage (version 3) sessions only.

- **Blind mode.** In the case library, the switch **Blind mode: hide titles and summaries** shows each card as only its catalogue number ("Case 01"), the track, the level and the minutes: no title, company, summary or icon, and a neutral colour. **Give me a case I have not done** starts a random case blind, preferring cases not in your history (any case when all are done, and within the track filter if one is chosen). A blind session shows "Blind case" in the header and "Stage 1" to "Stage 8" with no stage names. The interviewer's questions, exhibits, calculations and hints are unchanged. The debrief reveals the case and its stages, and the report, history and text download label each attempt Blind or Guided. Case-specific notes that would name the kind of case at the last two stages are left out of a blind session. Sessions saved without the flag, and four-stage sessions, are guided.
- **Typed data requests.** At the evidence stage you first type what data you want and what it would tell you, instead of picking from the menu. A request that is short, or a catch-all such as "all the data", gets one reply in the interviewer's voice and one more try; the second attempt always moves on, and "I am not sure. Show me what is available" skips. The menu then appears as before, with the exhibits whose title or category share words with your request listed first and tagged. Nothing is opened for you. The request, whether it was broad, what it matched and what you then opened appear in the report, the text download and the package for external AI review, with a self-check question. A session that had already opened an exhibit, and a four-stage session, go straight to the menu.
- **Limit.** The check matches words (lower-case, simple plural and ending removal, a short list of synonyms such as cost and expense, and ignored filler words) against exhibit titles and categories. It does not understand the request, and the page says so. A good request can match nothing, and a poor one can match something.
- **Stored in this browser:** the switch as `cr-case-blind` (`true` or `false`); on a session, `blind` (`true` only) and `dataRequest` (`attempts` with `text`, `broad` and `matched` ids, `skipped`, `revealed` and an unsent `draft`). Both are checked when read and dropped if they are not in that shape.
- **Peer interview.** The interviewer guide and printable sheet tell the interviewer to ask what data the candidate wants before offering anything.

## AI setup for a user

1. Open the deployed site and click **Settings**.
2. Choose Groq, OpenAI, Google Gemini, Anthropic Claude, DeepSeek, OpenRouter or the site's configured compatible endpoint.
3. Enter a valid API key and the exact model ID available in that provider account. For Anthropic, enter a workspace ID only if your key requires one.
4. Confirm the data-sharing notice and use **Save & test connection**. This makes one small provider request.
5. Start a case. Use **Ask interviewer** for information and **Respond to my answer** for a tailored follow-up. Complete the case and click **Generate AI feedback**.

Keys are provider-specific. Chat subscriptions do not automatically supply API credits. Use a model that follows JSON instructions; unsupported model IDs, insufficient quota and incompatible API features produce a recoverable error. Model availability and prices change; consult your provider account.

## Run locally

Node.js 22 or newer is recommended.

```bash
npm install
npm start
```

Open http://127.0.0.1:3000. The local server uses the same API handler as Vercel. Opening `index.html` directly also supports authored practice, the maths drill, peer interviews, behavioural practice, aptitude practice and the résumé checker (pasted text, .txt and .docx), but in-app AI and PDF reading need the server.

### Project layout

- `index.html`: page shell. It loads the files below in order.
- `assets/`: stylesheets (`app.css` shared, `drill.css`, `peer.css`, `behavioural.css`, `aptitude.css`, `resume.css`, `defence.css` and `gd.css` for those tools).
- `content/cases.js`: the authored case catalogue. Edit cases here.
- `content/aptitude-verbal.js`: the original verbal aptitude bank (items and reading passages). Edit verbal questions here.
- `content/resume-words.js`: the résumé checker's word lists (action verbs, weak openers, filler words, section names, stop words, skills and variants) and the fictional sample résumé and job description.
- `src/core.js`: shared helpers (storage, toast, modal, download).
- `src/cases.js`: case library, sessions, reports and history, plus the shared read-aloud and dictation helpers (`speak()`, `attachDictation()`). It also holds blind mode and `caseLabel(s)`, which other files call to name a session without giving a blind one away.
- `src/case-requests.js` (tested in `tests/cases-blind.test.cjs`): the DOM-free word matching for typed data requests. Load it before `src/cases.js`; if it is missing, the exhibit menu is shown straight away.
- `src/drill-questions.js` and `src/drill.js`: drill question generators (no DOM, unit-tested in Node) and the drill UI.
- `src/peer.js`: peer interview guide, candidate screen, feedback and printable sheet. It reads the case catalogue and reuses the case flow helpers in `src/cases.js`.
- `src/behavioural-content.js` and `src/behavioural.js`: behavioural question bank and answer heuristics (no DOM, unit-tested in Node), and the practice, story bank and printable sheet UI.
- `src/defence-content.js` and `src/defence.js`: the résumé and project defence's question rules, follow-ups, rewrite hints and story mapping (no DOM, unit-tested in Node), and its screens (home, interview conditions, debrief). It is linked from the résumé checker, the HR page, the home page and the plan, and loads after `src/resume.js`.
- `content/gd.js`, `src/gd-logic.js` and `src/gd.js`: the group discussion kit's briefs and moves, its rules (set-up checks, clock, tally, feedback, group notes; no DOM, unit-tested in Node) and its screens (set-up, read, discuss with the observer's taps, summary, debrief, printable kit). It loads after `src/defence.js` and is linked from the group discussion tile, the plan and the "Continue" list on the home page.
- `content/english.js`, `src/english-check.js` and `src/english.js`: spoken English practice content, scoring (no DOM, unit-tested in Node) and UI.
- `src/aptitude-questions.js` and `src/aptitude.js`: aptitude question generators, scoring and progress statistics (no DOM, unit-tested in Node), and the practice, timed test and results UI.
- `src/aptitude-exam.js` (tested in `tests/exam.test.cjs`): the DOM-free rules for placement notices, the clock that does not pause, shared paper codes, result lines, ranking and CSV.
- `src/resume-check.js`, `src/resume-files.js` and `src/resume.js`: résumé analysis (structure, bullet checks, keyword matching, PDF line rebuilding, .docx XML conversion; no DOM, unit-tested in Node), reading files on the device (zip, inflate, pdf.js loading), and the checker UI.
- `vendor/pdfjs/`: Mozilla's pdf.js 6.5.438 (Apache-2.0), stored in the repository and loaded only when a PDF is chosen. See `vendor/pdfjs/README.md`.
- `content/warmup.js` and `src/warmup.js`: the 10-minute guided warm-up case. `content/next-round.js` and `src/next-round.js`: “Prepare for my next round”, which builds a short plan from the other tools.
- `src/home.js`: the short home page (plan, continue, the five rounds in order) and the Case interview page that holds the case library.
- `src/ai-client.js`: optional BYOK AI. `src/boot.js` starts the app.
- `lib/`, `api/`: the AI proxy used by Vercel and `npm start`.

To add another tool, give it its own `src/<tool>.js` (and stylesheet if needed) and load it before `src/home.js` in `index.html`. Wrap `home()` only to tidy up when the student leaves the tool, as `src/drill.js` does. Link to it from the round it belongs to in `src/home.js` (a home-page tile or a Case interview page tool), not from the top navigation, which follows the rounds.

```bash
npm test
npm run build
```

There are no production npm dependencies. jsdom is a development-only test dependency. pdf.js is stored as two files in `vendor/pdfjs/` rather than installed from npm. Its integration tests need Node 22.13 or newer and are skipped on older Node. `tests/fixtures/make-pdfs.cjs` regenerates the small PDF fixtures.

## Vercel deployment

Import this repository. `vercel.json` configures:

- Framework: Other
- Build command: `npm run build`
- Output directory: `public`
- Serverless function: `api/ai.js`

**If the project was previously deployed as a static-only site, remove or update old Vercel dashboard overrides (blank build command and output `.`).** The build copies `index.html`, `assets/`, `content/`, `src/` and `vendor/` into `public`, and generates the canonical server-side case catalog from `content/cases.js`. Do not edit `data/cases.json` independently.

No provider secret is required in Vercel for the default bring-your-own-key mode. Never add a key to this repository. The function forwards the key provided by the user only to the selected provider.

### Another compatible service

The site owner can configure `CUSTOM_AI_BASE_URL`, such as `https://your-provider.example/v1`, in Vercel and redeploy. Users then select **Other OpenAI-compatible service**, supply that service's key, and enter its model ID. The endpoint must be a trusted public HTTPS Chat Completions API. Arbitrary visitor-supplied endpoints and redirects are deliberately not accepted. Azure-specific authentication, OAuth services and non-compatible APIs need separate adapters.

## Privacy and limits

- Keys remain in JavaScript memory for the tab; they are not saved in localStorage, session history, exports or the repository. Reload, close or **Clear key & disconnect** removes them from app memory.
- User-triggered AI requests send the key through this site's API server and send the selected case context and answers to the chosen provider. The app does not intentionally log or persist keys or request bodies. Hosting/provider infrastructure is still part of the data path; only enter keys into a deployment you trust.
- Answers, AI discussions and generated reviews remain in this browser's localStorage, including after clearing the key. Use Delete session history or browser controls to remove saved sessions. Export to retain a copy.
- Moving between local files and a hosted URL does not migrate browser sessions.
- Provider rate limits and charges apply. Each request has a bounded output, a timeout, no automatic retry, and a 100 KB input limit. Answers are capped at 5,000 characters for AI review. An in-memory per-key rate guard is best-effort per server instance, not a distributed quota or spend cap. Use provider account spend controls and Vercel firewall/rate limits for wider public access.
- Cancellation prevents stale results from changing the interface; a provider may still finish and bill an already-started request.
- Only exact quote existence is verified, not the correctness of an AI interpretation. Numerical checks remain deterministic. AI follow-ups can still be imperfect.
- The résumé and project defence stores only the one line or project title and your answers in this browser (`cr-defence-*` keys), never the résumé, and sends nothing anywhere.
- The group discussion kit stores the names, the observer's taps and notes, and the keep and change text in this browser (`cr-gd-*` keys). It does not listen to the discussion, record audio, or send anything anywhere.
- The résumé checker reads files in the browser and uploads nothing. It stores résumé and job-description text only if you tick "Remember my text", and never stores the file.
- Browser speech services may process audio/text online. This integration does not send recordings to the AI provider and does not retain audio recordings.

## Validation

Automated API and jsdom interaction tests cover all 24 paths, provider request formats, canonical fact filtering, future-evidence gating, transcript and feedback persistence, quote checking, credential non-persistence, error responses, branch resets, cancellation and legacy/offline behaviour. Peer interview tests render every stage of every case and path for gaps, run a full interview through to feedback, and check the candidate screen never shows answers. Drill tests check every question type against independently written formulas across all levels and many seeds, plus answer parsing, tolerance, progress statistics, resume after reload, listening mode and isolation from case sessions. Aptitude tests check every generated question kind at every level against independently written solvers: formulas, brute-force counting for permutations and probability, a brute-force seating solver, Venn-diagram model checking for syllogisms and a family-tree walk for blood relations. They also check that the four options are distinct, that exactly one is correct and that answers carry no float noise. The verbal bank is checked for one correct option per item and for passages that have questions. jsdom tests run a full timed test with auto-submit, negative marking, mark-for-review, sectional timers, resume after reload, corrupt storage and isolation from the other tools. Résumé checker tests cover section and bullet detection on several layouts, the whole-résumé checks on a strong, a weak and a minimal résumé (with guards such as "CGPA 8.4/10" not being a date), each check with positive and negative examples, keyword extraction and variants, the match groups, .docx files built in the test (deflated, stored and corrupt), PDF line rebuilding from synthetic text items, the stored pdf.js on a text PDF and an image-only PDF, rejected files, upload-edit-recheck in the page, saving and deleting, corrupt storage, HTML escaping, no network calls and isolation from the other tools. `tests/cases-blind.test.cjs` covers the request matching on the real exhibits (precise, broad and off-target requests), the blind library and its switch, a blind session of every case checked screen by screen for the title, summary, company and stage names, the Blind and Guided labels, resume after reload, the request box (precise, broad then second try, skip, nothing matched, reload, back and forward), older sessions and the peer guidance. Provider responses are mocked: real keys, live provider quality, Vercel deployment and microphone/speaker behaviour require a live smoke test.

Research references are in the app's Research & case design section. Provider implementation references:

- https://console.groq.com/docs/openai
- https://developers.openai.com/api/reference/resources/chat
- https://ai.google.dev/gemini-api/docs/openai
- https://platform.claude.com/docs/en/api/overview
- https://api-docs.deepseek.com/
- https://openrouter.ai/docs/api/reference/overview

## Additional archetypes

- **How many cups? — Guesstimate:** scope, own assumptions, first estimate, demand/supply cross-checks, sensitivity and validation. The first estimate has no fixed answer and is excluded from automatic scoring; two later calculations use explicitly hypothetical inputs. Chennai anchors are not real market statistics.
- **What actually went wrong? — Diagnosis only:** distinguish a reported decline from measurement errors and real payment-stage losses. Ends with a quantified problem statement and falsifiable verification plan, not a solution. Cohort and independent-reconciliation paths reveal different evidence.
- **Build it or partner? — Strategic investment:** compare five-year NPV, construction overruns and partner service failure. Positive NPV alone is insufficient.

Each has eight stages and two paths. Stage labels, review criteria and optional AI coaching adapt to the archetype. These are original fictional teaching cases, not actual McKinsey interview questions. McKinsey’s public Talbot Trucks sample informs the general investment-attractiveness archetype: https://www.mckinsey.com/careers/interviewing/talbot-trucks
