# Case Room

Six original fictional cases, eight stages, two paths per case, spoken prompts and optional bring-your-own-key AI coaching.

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

Open http://127.0.0.1:3000. The local server uses the same API handler as Vercel. Opening `index.html` directly also supports authored practice, but in-app AI needs the server.

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

**If the project was previously deployed as a static-only site, remove or update old Vercel dashboard overrides (blank build command and output `.`).** The build copies `index.html` and `ai-client.js` into `public`, and extracts the canonical server-side case catalog from the authored HTML. Do not edit `data/cases.json` independently.

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

Automated API and jsdom interaction tests cover all 12 paths, provider request formats, canonical fact filtering, future-evidence gating, transcript and feedback persistence, quote checking, credential non-persistence, error responses, branch resets, cancellation and legacy/offline behaviour. Provider responses are mocked: real keys, live provider quality, Vercel deployment and microphone/speaker behaviour require a live smoke test.

Research references are in the app's Research & case design section. Provider implementation references:

- https://console.groq.com/docs/openai
- https://developers.openai.com/api/reference/resources/chat
- https://ai.google.dev/gemini-api/docs/openai
- https://platform.claude.com/docs/en/api/overview
- https://api-docs.deepseek.com/
- https://openrouter.ai/docs/api/reference/overview
