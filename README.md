# Case Room

Nine original fictional cases, eight stages, two paths per case, spoken prompts and optional bring-your-own-key AI coaching. A case maths drill and a peer interview mode sit alongside the cases.

## Case maths drill

Open **Maths drill** in the header, or link straight to `/#drill`. Short rounds of generated questions across nine skills: percentages, growth and decline, profit and margin, break-even and payback, lakh/crore/million conversions and scaling, compounding and CAGR, present value and NPV, quick estimates, and reading a bar-chart exhibit.

- Choose skills, difficulty (Foundation, Interview, Stretch), 5/10/20 questions and an optional 30s or 60s time target.
- Every answer is checked instantly against a stated tolerance (exact calculations allow small rounding; estimates allow ±8%). Each question then shows its worked steps and a mental-maths shortcut.
- Optional read-aloud and listening practice, which hides the written question the way an interviewer would say the numbers.
- Results show accuracy and time per question, let you retry only the ones you missed, and export a text summary. Per-skill accuracy and median time from your last 30 attempts suggest which skill to practise next.
- No AI and no server: questions are generated in the browser (`src/drill-questions.js`) and progress stays in this browser's localStorage (`cr-drill-*` keys). An unfinished round resumes after a reload.

## Peer interview

Open **Peer interview** in the header, or link straight to `/#peer`. Two people practise together: one runs the case from an interviewer guide, the other answers out loud. Any of the nine cases works.

- The guide walks through all eight stages. For each one it shows what to ask, what to share when the candidate asks (clarifications, exhibits, path data, new evidence), what a strong answer sounds like, a follow-up question, and an answer key with the hint to offer if they are stuck.
- The interviewer types the candidate's number and the guide says whether it is within the case's tolerance.
- The candidate sees only the brief and what the interviewer shares. Either open the candidate screen (`/#peer-screen`) in a second window and share it on a video call (it updates live from the guide on the same device), or turn the screen when you share something.
- The interviewer rates each stage (strong, solid, needs work), takes notes, ticks the case's strengths and common traps, and writes one thing to keep and one to change. That becomes feedback to download or print. It is a peer's judgement, not a score.
- **Printable sheet** (`/#peer-sheet/<case id>`): a one-page candidate handout followed by the full interviewer sheet with both paths, answers and scoring boxes, for practising on paper.
- No AI and no server. Interviews in progress and finished feedback stay in this browser (`cr-peer-*` keys).

## Included AI features

- **Feedback:** assesses the candidate's actual responses across six reasoning dimensions, with exact-excerpt verification, improvement priorities and a practice exercise. No hiring-readiness score.
- **Adaptive interviewer:** asks an answer-specific follow-up, accepts a typed or dictated reply and uses that discussion for subsequent questions. Up to four follow-ups per stage. The authored eight-stage case remains the structure; this is not an unrestricted autonomous interviewer.
- **Natural information requests:** maps questions to authored exhibits and clarifications. The app returns canonical facts, not model-invented figures. Later branch evidence is gated by stage.
- **Fallback:** all authored cases and deterministic arithmetic checks work without AI; external copy-and-paste review remains available.

## Seamless practice flow

Without a configured key, there are no AI interview panels, connection reminders or AI-generation controls in the case or debrief. Settings is the only entry point. After connecting, information requests sit above the existing answer box and follow-up discussion sits below it; the normal Continue button remains unchanged. Clearing the key removes these controls immediately without discarding answers. Previously generated feedback remains accessible as a collapsed saved record.

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

Open http://127.0.0.1:3000. The local server uses the same API handler as Vercel. Opening `index.html` directly also supports authored practice and the maths drill, but in-app AI needs the server.

### Project layout

- `index.html`: page shell. It loads the files below in order.
- `assets/`: stylesheets (`app.css` shared, `drill.css` and `peer.css` for those tools).
- `content/cases.js`: the authored case catalogue. Edit cases here.
- `src/core.js`: shared helpers (storage, toast, modal, download).
- `src/cases.js`: case library, sessions, reports and history.
- `src/drill-questions.js` and `src/drill.js`: drill question generators (no DOM, unit-tested in Node) and the drill UI.
- `src/peer.js`: peer interview guide, candidate screen, feedback and printable sheet. It reads the case catalogue and reuses the case flow helpers in `src/cases.js`.
- `src/ai-client.js`: optional BYOK AI. `src/boot.js` starts the app.
- `lib/`, `api/`: the AI proxy used by Vercel and `npm start`.

To add another tool, give it its own `src/<tool>.js` (and stylesheet if needed), load it before `src/ai-client.js` in `index.html`, and register a nav button and view as `src/drill.js` does.

```bash
npm test
npm run build
```

There are no production npm dependencies. jsdom is a development-only test dependency.

## Vercel deployment

Import this repository. `vercel.json` configures:

- Framework: Other
- Build command: `npm run build`
- Output directory: `public`
- Serverless function: `api/ai.js`

**If the project was previously deployed as a static-only site, remove or update old Vercel dashboard overrides (blank build command and output `.`).** The build copies `index.html`, `assets/`, `content/` and `src/` into `public`, and generates the canonical server-side case catalog from `content/cases.js`. Do not edit `data/cases.json` independently.

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
- Browser speech services may process audio/text online. This integration does not send recordings to the AI provider and does not retain audio recordings.

## Validation

Automated API and jsdom interaction tests cover all 18 paths, provider request formats, canonical fact filtering, future-evidence gating, transcript and feedback persistence, quote checking, credential non-persistence, error responses, branch resets, cancellation and legacy/offline behaviour. Peer interview tests render every stage of every case and path for gaps, run a full interview through to feedback, and check the candidate screen never shows answers. Drill tests check every question type against independently written formulas across all levels and many seeds, plus answer parsing, tolerance, progress statistics, resume after reload, listening mode and isolation from case sessions. Provider responses are mocked: real keys, live provider quality, Vercel deployment and microphone/speaker behaviour require a live smoke test.

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
