# Case Room

A standalone case-interview practice tool with six original fictional cases, eight stages per case, two investigative paths per case, spoken prompts, editable dictation and optional external AI review.

## Run locally

Open `index.html` in a browser. Voice availability depends on the browser and device; typing always remains available.

## Host on Vercel

Import the GitHub repository into Vercel as a static site. The repository root contains `index.html`. No dependencies or build step are required.

Use these settings if requested:

- Framework preset: Other
- Root directory: repository root
- Build command: leave empty
- Output directory: `.`

## Data and AI

Sessions are stored in the browser and do not sync between devices. Moving from a local file to a hosted URL does not migrate previous browser sessions. Export feedback before switching if needed.

Speech services may process audio or text online. No audio recording is retained by this app.

AI review currently uses a copy-and-paste package for a separate AI chat. Groq is not integrated. Never put a shared API key in this HTML or commit it to Git; a future shared AI feature needs a server-side integration.

## Validation

The expanded edition passed mocked-DOM logic checks covering all 12 branches, 30 independently recalculated numerical checkpoints, required inputs, branch resets, transcript exports, saved history and legacy sessions. Visual rendering and live audio have not been verified.

Research references are available inside the app under Research & case design.
