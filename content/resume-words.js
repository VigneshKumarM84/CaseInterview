/* Word lists and samples for the résumé checker. No DOM access, so Node tests load this file directly.
   Edit the lists here; src/resume-check.js reads them. Verbs are past tense; British and American spellings
   both appear where they differ. The sample résumé and job description are fictional. */
(function (root) {
  // Strong opening verbs, grouped so a repeated verb can be swapped for one with a similar meaning.
  const VERB_GROUPS = {
    lead: ['led', 'headed', 'directed', 'managed', 'ran', 'oversaw', 'supervised', 'chaired', 'captained', 'coordinated', 'orchestrated', 'spearheaded', 'mobilised', 'mobilized', 'steered', 'founded', 'co-founded', 'cofounded', 'established', 'hosted', 'moderated'],
    build: ['built', 'developed', 'created', 'designed', 'engineered', 'architected', 'coded', 'programmed', 'prototyped', 'assembled', 'constructed', 'implemented', 'deployed', 'shipped', 'launched', 'set up', 'automated', 'configured', 'integrated', 'migrated', 'refactored', 'rebuilt', 'redesigned', 'scripted', 'debugged', 'tested', 'produced', 'crafted', 'devised', 'invented', 'pioneered', 'introduced', 'instituted', 'initiated', 'piloted', 'conceived', 'formulated'],
    improve: ['improved', 'enhanced', 'strengthened', 'optimised', 'optimized', 'streamlined', 'simplified', 'standardised', 'standardized', 'upgraded', 'overhauled', 'revamped', 'restructured', 'reorganised', 'reorganized', 'refined', 'modernised', 'modernized', 'transformed', 'resolved', 'fixed', 'solved', 'unified', 'consolidated', 'systematised', 'systematized'],
    grow: ['increased', 'grew', 'raised', 'boosted', 'expanded', 'scaled', 'doubled', 'tripled', 'accelerated', 'generated', 'earned', 'won', 'secured', 'acquired', 'attracted', 'converted', 'closed', 'sold', 'exceeded', 'surpassed', 'outperformed', 'achieved', 'delivered', 'maximised', 'maximized'],
    reduce: ['reduced', 'cut', 'lowered', 'decreased', 'halved', 'saved', 'minimised', 'minimized', 'eliminated', 'trimmed', 'shortened', 'sped up', 'prevented', 'mitigated'],
    analyse: ['analysed', 'analyzed', 'evaluated', 'assessed', 'examined', 'investigated', 'researched', 'audited', 'benchmarked', 'diagnosed', 'forecast', 'forecasted', 'modelled', 'modeled', 'measured', 'quantified', 'calculated', 'estimated', 'mapped', 'surveyed', 'interviewed', 'identified', 'discovered', 'segmented', 'tracked', 'monitored', 'validated', 'verified', 'reconciled', 'synthesised', 'synthesized', 'visualised', 'visualized', 'extracted', 'cleaned', 'compiled', 'scoped', 'reviewed', 'tested'],
    communicate: ['presented', 'pitched', 'wrote', 'authored', 'drafted', 'edited', 'published', 'documented', 'reported', 'briefed', 'persuaded', 'negotiated', 'influenced', 'convinced', 'advocated', 'translated', 'explained', 'proposed', 'recommended', 'articulated'],
    help: ['mentored', 'coached', 'trained', 'taught', 'tutored', 'guided', 'advised', 'onboarded', 'recruited', 'hired', 'supported', 'enabled', 'facilitated', 'partnered', 'collaborated', 'volunteered', 'resolved', 'served'],
    organise: ['organised', 'organized', 'planned', 'scheduled', 'arranged', 'prioritised', 'prioritized', 'budgeted', 'allocated', 'executed', 'administered', 'conducted', 'curated', 'sourced', 'procured', 'negotiated', 'structured', 'defined', 'delegated', 'drove', 'completed']
  };
  // Openers that describe a duty rather than an action, and first-person openers.
  const WEAK_OPENERS = [
    ['responsible for', 'Name what you actually did, e.g. "Ran…" or "Managed…".'],
    ['was responsible for', 'Name what you actually did, e.g. "Ran…" or "Managed…".'],
    ['duties included', 'List the result, not the duty: start with the action.'],
    ['duties include', 'List the result, not the duty: start with the action.'],
    ['tasked with', 'Say what you did with the task: "Built…", "Delivered…".'],
    ['in charge of', 'Use a verb: "Led…", "Ran…" or "Oversaw…".'],
    ['involved in', 'Say what your part was: "Designed…", "Analysed…".'],
    ['was involved in', 'Say what your part was: "Designed…", "Analysed…".'],
    ['worked on', 'Say what you did to it: "Built…", "Tested…", "Redesigned…".'],
    ['worked with', 'Say what you achieved together: "Partnered with… to…".'],
    ['work on', 'Say what you did to it: "Built…", "Tested…", "Redesigned…".'],
    ['helped', 'Say what your share was: "Drafted…", "Analysed…", "Built…".'],
    ['helping', 'Say what your share was: "Drafted…", "Analysed…", "Built…".'],
    ['assisted', 'Say what you did yourself: "Prepared…", "Analysed…".'],
    ['assisting', 'Say what you did yourself: "Prepared…", "Analysed…".'],
    ['participated in', 'Say what you contributed: "Presented…", "Built…".'],
    ['took part in', 'Say what you contributed: "Presented…", "Built…".'],
    ['part of', 'Say what you contributed: "Presented…", "Built…".'],
    ['did', 'Use a specific verb for what you did.'],
    ['made', 'Use a more specific verb: "Built…", "Created…", "Produced…".'],
    ['used', 'Lead with the outcome: "Built X using Y" rather than "Used Y".'],
    ['utilised', 'Lead with the outcome: "Built X using Y".'],
    ['utilized', 'Lead with the outcome: "Built X using Y".'],
    ['got', 'Use a specific verb: "Earned…", "Won…", "Secured…".']
  ];
  const FIRST_PERSON = ['i', 'my', 'me', "i'm", "i've", 'myself'];
  // Present-tense forms that differ from simple rules; everything else is derived from the past form.
  const IRREGULAR_PRESENT = { led: 'lead', ran: 'run', built: 'build', grew: 'grow', drove: 'drive', wrote: 'write', won: 'win', taught: 'teach', oversaw: 'oversee', sold: 'sell', made: 'make', got: 'get', did: 'do', 'sped up': 'speed up' };
  // Words where the past and present forms are the same, so they never count towards a tense mix.
  const SAME_TENSE = ['cut', 'forecast', 'set up', 'read', 'put', 'set'];

  // Vague or empty words, each with the fix to suggest. Matched as whole words or phrases.
  const FILLER = [
    ['various', 'Name them, or say how many.'], ['etc', 'List the items that matter, or drop "etc."'], ['successfully', 'Drop it; the result shows the success.'],
    ['hard-working', 'Show it with an outcome instead.'], ['hardworking', 'Show it with an outcome instead.'], ['team player', 'Show it: who you worked with and what you delivered together.'],
    ['synergy', 'Say what was combined and what it produced.'], ['synergies', 'Say what was combined and what it produced.'], ['go-getter', 'Show it with an outcome instead.'],
    ['self-motivated', 'Show it with something you started yourself.'], ['results-driven', 'Show the result instead.'], ['result-oriented', 'Show the result instead.'],
    ['detail-oriented', 'Show it: what did your care for detail catch or prevent?'], ['passionate', 'Show it with what you built or did.'], ['dynamic', 'Drop it, or say what changed.'],
    ['very', 'Drop it, or use a number.'], ['really', 'Drop it.'], ['a lot of', 'Use a number.'], ['lots of', 'Use a number.'], ['numerous', 'Use a number.'],
    ['several', 'Use a number.'], ['many', 'Use a number if you can.'], ['multiple', 'Use a number if you can.'], ['some', 'Be specific: which, or how many?'],
    ['stuff', 'Name the thing.'], ['things', 'Name the things.'], ['basically', 'Drop it.'], ['in order to', 'Use "to".'],
    ['proven track record', 'Show the record with a result.'], ['think outside the box', 'Show the unusual idea and what it did.'],
    ['out of the box', 'Show the unusual idea and what it did.'], ['best-in-class', 'Show the comparison with a number.'], ['world-class', 'Show the comparison with a number.'],
    ['excellent communication skills', 'Show it: what did you present or write, and to whom?'], ['seamlessly', 'Drop it.'], ['effectively', 'Drop it, or show the effect.'],
    ['efficiently', 'Drop it, or say how much faster or cheaper.'], ['leveraged', 'Use "used", or better, lead with what it achieved.'], ['spearheaded various', 'Name the initiatives.']
  ];
  // Words to suggest instead of a weak opener, for the "verb" fix.
  const SUGGEST = ['Built', 'Led', 'Analysed', 'Reduced', 'Launched', 'Designed', 'Organised', 'Presented'];

  // Section headings: the name a student is likely to use, mapped to the kind of section.
  const SECTIONS = {
    experience: ['experience', 'work experience', 'professional experience', 'relevant experience', 'employment', 'employment history', 'work history', 'career history',
      'internships', 'internship', 'internship experience', 'internships and experience', 'experience and internships', 'industry experience', 'professional background'],
    projects: ['projects', 'academic projects', 'personal projects', 'key projects', 'project work', 'projects and research', 'research', 'research experience', 'research projects',
      'selected projects', 'major projects', 'live projects', 'case competitions'],
    responsibility: ['positions of responsibility', 'position of responsibility', 'por', 'leadership', 'leadership experience', 'leadership and activities', 'extracurricular activities',
      'extra-curricular activities', 'extracurriculars', 'extra curricular activities', 'co-curricular activities', 'cocurricular activities', 'volunteering', 'volunteer experience',
      'social work', 'activities', 'clubs and societies', 'positions held'],
    achievements: ['achievements', 'awards', 'honours', 'honors', 'awards and achievements', 'achievements and awards', 'scholastic achievements', 'accomplishments',
      'awards and honours', 'awards and honors', 'honours and awards', 'honors and awards', 'competitions'],
    education: ['education', 'academic qualifications', 'academics', 'educational qualifications', 'education and qualifications', 'qualifications', 'academic background',
      'academic details', 'scholastic record'],
    skills: ['skills', 'technical skills', 'key skills', 'core skills', 'core competencies', 'competencies', 'skills and tools', 'tools', 'technologies', 'tools and technologies',
      'skills and interests', 'skill set', 'skillset', 'software', 'technical proficiency', 'it skills', 'computer skills', 'languages and tools'],
    summary: ['summary', 'profile', 'professional summary', 'career objective', 'objective', 'about me', 'profile summary', 'career summary', 'personal statement'],
    other: ['certifications', 'certificates', 'courses', 'coursework', 'relevant coursework', 'trainings', 'training', 'certifications and courses', 'interests', 'hobbies',
      'hobbies and interests', 'languages', 'languages known', 'references', 'personal details', 'personal information', 'declaration', 'contact', 'contact details', 'publications']
  };

  // Common English words that never become keywords.
  const STOP = ('a about above across after again against all almost also am among an and any are as at be because been before being below between both but by can could ' +
    'did do does doing down during each either else ever every few for from further had has have having he her here hers him his how however i if in into is it its itself ' +
    'just less let like may me might more most much must my no nor not now of off often on once one only or other others our ours out over own per rather same she should ' +
    'since so some such than that the their theirs them then there these they this those through thus to too under until up upon us very via was we well were what when ' +
    'where whether which while who whom whose why will with within without would yet you your yours etc e.g eg i.e ie').split(' ');
  // Words every job advert uses that say nothing about the skills needed.
  const GENERIC = ('candidate candidates responsibilities responsibility requirements requirement required require requires role roles job jobs position positions ' +
    'company companies organisation organization team teams work working works ability abilities able strong good great excellent solid proven knowledge understanding ' +
    'familiarity familiar skills skill preferred preferably plus bonus ideal ideally opportunity opportunities apply applicants applicant join looking seeking seek qualifications qualification ' +
    'years year experience experienced exposure minimum least equivalent related relevant field fields environment day days people person someone individual ' +
    'description summary overview duties key using use based new well including include includes includ various multiple other others across must-have nice-to-have ' +
    'hiring hire salary benefits location remote hybrid onsite on-site office full-time part-time time immediate immediately joiner joiners ctc lpa stipend month months week weeks ' +
    'graduate graduates fresher freshers degree bachelor bachelors bachelor\'s master masters any related etc highly closely effective effectively strongly ensure ensuring ' +
    'help helping support supporting provide providing make making take taking get getting need needs needed want wants like will would should shall can may might ' +
    'also good-to-have nice have has having plus ability able what who we you our your us they them this that').split(' ');
  // Skills and tools to boost. Multi-word entries are matched as phrases. Keep entries lower case.
  const SKILLS = [
    'sql', 'mysql', 'postgresql', 'excel', 'vba', 'macros', 'pivot tables', 'vlookup', 'xlookup', 'power query', 'python', 'r', 'pandas', 'numpy', 'scikit-learn',
    'tableau', 'power bi', 'looker', 'looker studio', 'google analytics', 'mixpanel', 'amplitude', 'jira', 'confluence', 'figma', 'notion', 'salesforce', 'hubspot', 'sap', 'tally',
    'statistics', 'regression', 'hypothesis testing', 'a/b testing', 'experimentation', 'machine learning', 'deep learning', 'natural language processing', 'data analysis',
    'data analytics', 'data visualisation', 'data visualization', 'data cleaning', 'data modelling', 'data modeling', 'data pipelines', 'etl', 'dashboards', 'dashboard', 'reporting',
    'financial modelling', 'financial modeling', 'financial analysis', 'valuation', 'dcf', 'budgeting', 'forecasting', 'accounting', 'gst', 'auditing', 'equity research',
    'market research', 'market sizing', 'competitive analysis', 'business analysis', 'requirements gathering', 'process improvement', 'root cause analysis', 'six sigma', 'lean six sigma',
    'project management', 'program management', 'product management', 'product roadmap', 'roadmap', 'prioritisation', 'prioritization', 'user research', 'usability testing',
    'wireframes', 'wireframing', 'prototyping', 'agile', 'scrum', 'kanban', 'stakeholder management', 'stakeholder communication', 'communication', 'presentation', 'presentations',
    'storytelling', 'problem solving', 'critical thinking', 'negotiation', 'teamwork', 'collaboration', 'client management', 'account management',
    'sales', 'business development', 'lead generation', 'crm', 'digital marketing', 'seo', 'sem', 'content marketing', 'social media', 'email marketing', 'performance marketing',
    'google ads', 'meta ads', 'customer success', 'customer support', 'operations', 'supply chain', 'logistics', 'procurement', 'inventory management', 'demand planning',
    'javascript', 'typescript', 'java', 'c++', 'c#', 'golang', 'react', 'node.js', 'html', 'css', 'git', 'github', 'docker', 'kubernetes', 'aws', 'azure', 'google cloud', 'linux', 'apis', 'rest api',
    'kpis', 'okrs', 'metrics', 'unit economics', 'p&l', 'pricing', 'go-to-market', 'consulting', 'strategy', 'research', 'cohort analysis', 'funnel analysis', 'segmentation',
    'spss', 'stata', 'matlab', 'bigquery', 'snowflake', 'spark', 'hadoop', 'airflow', 'dbt', 'powerpoint', 'google sheets', 'canva'
  ];
  // Variants mapped to one canonical spelling before matching. Both sides of each pair are lower case and tokenised.
  const VARIANTS = [
    ['ms excel', 'excel'], ['microsoft excel', 'excel'], ['advanced excel', 'excel'], ['excel sheets', 'excel'], ['spreadsheets', 'excel'], ['ms powerpoint', 'powerpoint'], ['microsoft powerpoint', 'powerpoint'], ['ppt', 'powerpoint'],
    ['ms word', 'word'], ['microsoft word', 'word'], ['powerbi', 'power bi'], ['microsoft power bi', 'power bi'], ['ml', 'machine learning'], ['ai/ml', 'machine learning'], ['dl', 'deep learning'],
    ['nlp', 'natural language processing'], ['js', 'javascript'], ['ts', 'typescript'], ['nodejs', 'node.js'], ['node', 'node.js'], ['reactjs', 'react'], ['react.js', 'react'],
    ['ab testing', 'a/b testing'], ['a/b tests', 'a/b testing'], ['a/b test', 'a/b testing'], ['split testing', 'a/b testing'], ['ga4', 'google analytics'], ['postgres', 'postgresql'],
    ['gcp', 'google cloud'], ['amazon web services', 'aws'], ['k8s', 'kubernetes'], ['dataviz', 'data visualization'], ['data viz', 'data visualization'],
    ['p and l', 'p&l'], ['profit and loss', 'p&l'], ['go to market', 'go-to-market'], ['gtm', 'go-to-market'], ['problem-solving', 'problem solving'], ['kpi', 'kpis'], ['okr', 'okrs'],
    ['stakeholders', 'stakeholder'], ['customer relationship management', 'crm'], ['search engine optimisation', 'seo'], ['search engine optimization', 'seo'],
    ['scikit learn', 'scikit-learn'], ['sklearn', 'scikit-learn'], ['google data studio', 'looker studio'], ['data studio', 'looker studio']
  ];
  // Headings inside a job description, and how much their contents weigh when ranking keywords.
  const JD_SECTIONS = [
    [/\b(requirements?|qualifications?|what you('|’)ll need|what we('|’)re looking for|what you bring|must[- ]haves?|you have|you should have|skills required|required skills|eligibility|who you are|key skills|essential)\b/i, 2],
    [/\b(responsibilities|what you('|’)ll do|the role|your role|key responsibilities|job description|duties|you will|day to day|in this role)\b/i, 1.5],
    [/\b(nice[- ]to[- ]haves?|preferred|good[- ]to[- ]haves?|bonus|desirable|plus points?)\b/i, 1.2],
    [/\b(about us|about the company|who we are|our story|benefits|perks|what we offer|compensation|equal opportunity|how to apply)\b/i, 0.4]
  ];
  // Number words that count as a measurable result. "one" is left out: "one of the" is rarely a result.
  const NUMBER_WORDS = ['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'fifteen', 'twenty', 'thirty', 'forty', 'fifty', 'hundred', 'hundreds',
    'thousand', 'thousands', 'million', 'millions', 'billion', 'lakh', 'lakhs', 'lac', 'lacs', 'crore', 'crores', 'dozen', 'dozens', 'double', 'doubled', 'tripled', 'halved', 'twice', 'thrice', 'half', 'quarter'];

  /* ---------- Whole-résumé checks (they run with or without a job description) ---------- */
  // Personal details Indian campus résumés often carry but recruiters do not need. [label, pattern]
  const PERSONAL = [
    ['date of birth', /\b(date of birth|d\.\s?o\.\s?b\.?|dob|birth ?date|born on)\b/i], ['age', /\bage\s*[:\-–]\s*\d{2}\b|\b\d{2}\s*(years|yrs)\s*old\b/i],
    ['gender', /\b(gender|sex)\s*[:\-–]/i], ['marital status', /\bmarital status\b|\b(unmarried)\b/i], ['religion or caste', /\b(religion|caste|community)\s*[:\-–]/i],
    ['nationality', /\bnationality\b/i], ["parents' names", /\b(father|mother)('?s)?\s+(name|occupation)\b/i], ['passport number', /\bpassport\s*(no|number|#)/i],
    ['declaration', /\bi hereby declare\b|^\s*declaration\s*:?\s*$/im], ['"references available on request"', /\breferences\s+(are\s+)?(available\s+)?(up)?on\s+request\b/i]
  ];
  // Stock phrases that make a summary or objective sound like everyone else's.
  const OBJECTIVE_CLICHES = ['challenging position', 'challenging role', 'challenging career', 'challenging environment', 'challenging opportunity', 'reputed organisation', 'reputed organization',
    'reputed company', 'reputed firm', 'utilise my skills', 'utilize my skills', 'utilise my knowledge', 'utilize my knowledge', 'growth of the organisation', 'growth of the organization',
    'growth of the company', 'seeking a position', 'seeking a job', 'seeking a role', 'to secure a position', 'dynamic environment', 'dynamic organisation', 'dynamic organization',
    'hard-working', 'hardworking', 'quick learner', 'fast learner', 'team player', 'self-motivated', 'go-getter', 'results-driven', 'result-oriented', 'passionate about learning',
    'best of my abilities', 'mutual growth', 'enhance my skills', 'professional growth'];
  // Spoken languages and proficiency words: no bullet needs to prove them.
  const SPOKEN_LANGUAGES = ['english', 'hindi', 'tamil', 'telugu', 'kannada', 'malayalam', 'marathi', 'bengali', 'bangla', 'gujarati', 'punjabi', 'urdu', 'odia', 'oriya', 'assamese', 'konkani',
    'sanskrit', 'french', 'german', 'spanish', 'japanese', 'mandarin', 'chinese', 'korean', 'arabic', 'italian', 'russian', 'portuguese'];
  const SKILL_QUALIFIERS = ['basic', 'basics', 'beginner', 'intermediate', 'advanced', 'proficient', 'expert', 'fluent', 'native', 'working knowledge', 'familiar', 'good', 'excellent', 'strong', 'certified'];
  // Word stems spelt -ise in British English and -ize in American English. A résumé should pick one.
  const SPELLING_STEMS = ['organi', 'analy', 'optimi', 'prioriti', 'visuali', 'standardi', 'minimi', 'maximi', 'summari', 'recogni', 'speciali', 'utili', 'customi', 'categori',
    'moderni', 'synthesi', 'characteri', 'capitali', 'emphasi', 'finali', 'personali', 'digiti', 'moneti', 'mobili', 'centrali'];

  const SAMPLE_RESUME = `Riya Menon
Bengaluru · riya.menon@example.com · +91 90000 00000

SUMMARY
Final-year BBA student who enjoys working with data and people.

EDUCATION
BBA (Business Analytics), Lakeview College of Commerce, Bengaluru · 2023–2026 · CGPA 8.4/10
Class XII (Commerce), Hillside Public School · 2023 · 91%

EXPERIENCE
Business Analyst Intern, Kiranakart (quick-commerce start-up) · May 2025 – Jul 2025
• Responsible for preparing weekly sales reports for the category team
• Built an Excel model to forecast demand for 120 SKUs, cutting stock-outs by 18% over six weeks
• Data was cleaned by me before every review meeting
• Helped the marketing team with various campaigns etc.
• Analysed customer feedback from 2,400 app reviews and presented the top five complaints to the product head

Operations Volunteer, Bengaluru Food Bank · Jun 2024 – Present
• Coordinate weekend collection drives across 6 apartment complexes
• Managed a team of 15 volunteers
• Managed the donation tracking sheet

PROJECTS
Pricing study for a campus café
• Surveyed 180 students and estimated willingness to pay with a simple Van Westendorp analysis, which led the café to raise combo prices by ₹20 without a fall in footfall
• Managed the survey
• Worked on a dashboard in Tableau that was successfully used by the café owner to track daily sales and very many other things that the owner wanted to look at every evening after closing time

POSITIONS OF RESPONSIBILITY
• Treasurer, Commerce Society: managed a ₹2 lakh annual budget for 8 events
• I organised the annual case competition with 40 teams from 12 colleges

SKILLS
Excel (pivot tables, VLOOKUP), SQL, Tableau, PowerPoint, Python (basic), Google Sheets`;

  const SAMPLE_JD = `Business Analyst – Graduate Programme (fictional)
Fernway Retail, Bengaluru

About us
Fernway Retail runs 140 grocery stores across South India and is growing its online channel.

What you'll do
- Analyse sales, inventory and customer data to find what is driving performance
- Build dashboards in Power BI or Tableau for store and category managers
- Run A/B testing on promotions and measure the impact on revenue
- Work with stakeholders across merchandising, supply chain and marketing to turn findings into decisions
- Present recommendations to senior leadership

Requirements
- Strong SQL and Excel skills, including pivot tables
- Experience with data analysis and data visualization
- Familiarity with Python for data cleaning
- Clear communication and stakeholder management
- Understanding of demand forecasting and inventory management

Nice to have
- Exposure to financial modelling
- Internship in retail or e-commerce

Benefits
Hybrid working, learning budget and a mentor in your first year.`;

  const api = { PERSONAL, OBJECTIVE_CLICHES, SPOKEN_LANGUAGES, SKILL_QUALIFIERS, SPELLING_STEMS, VERB_GROUPS, WEAK_OPENERS, FIRST_PERSON, IRREGULAR_PRESENT, SAME_TENSE, FILLER, SUGGEST, SECTIONS, STOP, GENERIC, SKILLS, VARIANTS, JD_SECTIONS, NUMBER_WORDS, SAMPLE_RESUME, SAMPLE_JD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ResumeWords = api;
})(this);
