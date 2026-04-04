# Momentum

Momentum is an accountability memory for recurring meetings.

It does not just summarize a call. It keeps follow-ups tied to transcript evidence, shows what changed since the last related meeting, and keeps weak or ambiguous work in review instead of pretending certainty.

## What Makes It Different

- `Proof-backed follow-ups`: extracted tasks keep source snippets, confidence, and review reasons.
- `Since last meeting`: related meetings are compared so resurfaced work, owner changes, and deadline shifts become visible.
- `Review queue`: unclear owner, missing deadline, and low-signal work stay in a dedicated lane.
- `Question the record`: meeting Q&A answers are grounded in transcript evidence or explicitly marked unsupported.
- `Next meeting brief`: the dashboard and meeting detail surfaces tell you what should be resolved before the next meeting starts.

## Product Surface

- `/`: landing page focused on accountability memory, not generic meeting automation.
- `/dashboard`: execution workspace for live meetings, follow-ups, drift, and review.
- `/dashboard/meetings/:meetingId`: source audio, transcript evidence, follow-ups, risks, and carry-forward brief.
- `/dashboard/tasks`: board for active work and needs-review follow-ups.
- `/dashboard/upload`: ingest flow for live recordings and saved audio.

## Stack

- React 19 + Vite
- React Router
- Framer Motion
- Supabase for auth, database, and storage
- Vercel-style `/api` routes for processing, Q&A, and workspace snapshot endpoints

## Local Setup

1. Install dependencies.

```bash
npm install
```

2. Copy the environment template and fill in real values.

```bash
copy .env.example .env.local
```

3. Apply the Supabase foundation migration.

- Use `supabase/migrations/20260404_v2_foundation.sql` against your project.

4. Start the frontend.

```bash
npm run dev
```

## Environment Variables

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL`
  Use this in local development if your API is not served from the same origin as the Vite app.

Server / API:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `GEMINI_API_KEY`

## Development Notes

- The frontend no longer falls back to the production API in local development.
- If `/api` routes are not available locally, set `VITE_API_BASE_URL` explicitly.
- Missing Supabase envs should result in an honest empty-state or setup error rather than silent production calls.
- Keep the local `src/components/watermelon/` experiment out of production work. It is not part of the active dashboard.

## Data Expectations

The active workspace expects:

- meetings with transcript text, risks, decisions, scoring, and participant roster data
- tasks with `status`, `owner`, `dueDate`, `needsReview`, `confidence`, and `sourceSnippet`
- storage access for saved meeting audio

The migration in `supabase/migrations/20260404_v2_foundation.sql` is the current baseline for the live workspace model.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
npm run backfill:v2
npm run setup:demo-workspace
```

## Demo Walkthrough

1. Open the dashboard overview and use the next-meeting brief.
2. Open a completed meeting from the vault.
3. Show the `Since last meeting` memory layer and commitment drift.
4. Open a follow-up with evidence and resolve one review item.
5. Ask a question against the transcript and open the supporting evidence.
6. End with a live upload or a saved recording waiting for analysis.
