# AnchorMind

AnchorMind is a supportive reflection tool for pausing anxiety spirals, panic, and OCD rumination. You enter (or
dictate) a looping thought, and AnchorMind returns a short, CBT/ACT-informed reflection that separates observable
facts from anxious assumptions, offers one balanced reframe, and suggests one optional 60-second grounding action.
When the estimated distress is high, it offers a short breathing exercise first. When crisis intent is detected, it
shows crisis support immediately instead.

> AnchorMind is **not** clinically validated, does not diagnose, does not guarantee relief, and is not a substitute
> for professional care or emergency services.

## Stack

- Next.js 16 (App Router) · React 19 · strict TypeScript 5.9
- Tailwind CSS 4 (via `@tailwindcss/postcss`; no `tailwind.config` file is needed in v4)
- `@google/genai` (official Google Gen AI SDK) — server-side only
- Zod 4 for runtime validation
- Vitest 5 + React Testing Library
- ESLint 9 (flat config, `eslint-config-next`)

## Requirements

- **Node.js 22.12 or newer** (required by `@google/genai` and Vitest 5; declared in `package.json` `engines`)
- npm 10+

## Setup

```bash
npm install
cp .env.example .env.local   # then edit .env.local
npm run dev                  # http://localhost:3000
```

Production:

```bash
npm run build
npm run start
```

The production build succeeds without any API key.

## Environment variables

All variables are read **only on the server**. Never prefix them with `NEXT_PUBLIC_`.

| Variable         | Default             | Purpose                                                             |
| ---------------- | ------------------- | ------------------------------------------------------------------- |
| `GEMINI_API_KEY` | _(empty)_           | Gemini API key. Required for live analysis.                         |
| `GEMINI_MODEL`   | `gemini-4-hydrogen` | Model ID. If the model is unavailable, the API returns an error — it never silently switches models. |
| `DEMO_MODE`      | `false`             | `true` disables live analysis entirely; only the example presets work. |

## Demo vs. live behavior

| Configuration                 | Preset buttons             | Custom text                                    |
| ----------------------------- | -------------------------- | ---------------------------------------------- |
| `DEMO_MODE=true`              | Deterministic fixtures     | Explains that live analysis is disabled (403)  |
| `DEMO_MODE=false` + key       | Sent to Gemini             | Sent to Gemini                                 |
| `DEMO_MODE=false`, no key     | Deterministic fixtures     | Helpful configuration error (503)              |

Results are labeled **“Demo example”** (fixtures) or **“AI-generated reflection”** (Gemini). A failed live request is
always reported as an error; it is never replaced by a demo result.

The three presets are:

- **Exam & Presentation Spiral** — fixture score 9 (demonstrates the breathing gate)
- **OCD Checking Loop** — fixture score 7 (does not confirm safety or encourage checking)
- **Social Message Overthink** — fixture score 5

## Checks

```bash
npm run lint       # ESLint CLI (next build does not lint)
npm run typecheck  # tsc --noEmit
npm run test       # vitest run (exits after one run; Gemini is mocked, no credentials needed)
npm run build
```

## How it works

- `src/app/api/analyze/route.ts` — validates the request, chooses demo vs. live, calls Gemini with a system
  instruction, JSON response schema (`Type` enum), a ~25 s deadline (`abortSignal` + `httpOptions.timeout`), and a single
  attempt (no automatic retries).
- `src/lib/server/analyze.ts` — request parsing (content type, body-size cap, 1–4,000 trimmed characters, preset text
  matching), provider-output handling, and safe error mapping (429 quota, 504 timeout, 502/503 model or provider
  problems, 422 safety blocks).
- `src/lib/schemas.ts` — strict Zod schema for the nine-field `AnalysisResult`. After validation the server **derives**
  `trigger_breathing_first = panic_intensity_score >= 8` rather than trusting the model.
- **Crisis priority:** if the model's parsed JSON is an object with `is_crisis === true`, a crisis envelope is returned
  immediately, even if other fields are malformed; those fields are never rendered. Breathing never delays crisis support.
- `src/app/page.tsx` — typed UI state machine (idle → loading → crisis | breathing | results | error), request
  identity + `AbortController` to ignore stale responses, focus management, and polite status announcements.

## Deployment

Any Node.js host that supports Next.js works (e.g. Vercel, Render, Fly.io, a container running `npm run start`).

1. Set Node.js 22.12+ on the host.
2. Configure `GEMINI_API_KEY`, `GEMINI_MODEL`, and `DEMO_MODE` as **server-side** environment variables.
3. Build with `npm run build` and start with `npm run start`.

The API route runs on the Node.js runtime and sends `Cache-Control: no-store`.

### Before a public release

The MVP has **no built-in rate limiting or abuse protection**. Before exposing it publicly, add at the hosting or edge
layer:

- Per-IP / per-session rate limiting on `POST /api/analyze` (e.g. Vercel Firewall rules, Cloudflare rate limiting,
  or an API gateway).
- Bot protection and request-size limits at the edge.
- Spending caps and quota alerts on the Google AI / Google Cloud project.
- Monitoring that records only error codes — never submitted thoughts or generated reflections.

## Privacy and data flow

- AnchorMind has no database, accounts, analytics, or chat history, and does not store thoughts in `localStorage`.
- The server does not log submitted thoughts or generated reflections; it logs only error categories.
- **Live analysis sends the entered text to Google's Gemini API.** Google's terms govern how that data is processed
  and retained; AnchorMind does not claim zero retention.
- **Voice dictation** uses the browser's built-in speech recognition, which may send audio to an external provider
  (for example, the browser vendor). Typing always works as an alternative.
- The Gemini API key stays on the server and is never sent to the browser or included in error messages.

## Limitations of automated crisis detection

- Crisis detection is performed by a language model and is **supplementary only**. It can miss genuine risk and can
  flag non-crisis text.
- A reflection without a crisis message does **not** mean the person is safe.
- The **“Get urgent support”** button is always available, works without Gemini or an API key, and links to an
  international crisis-line directory ([findahelpline.com](https://findahelpline.com)). AnchorMind does not guess the
  user's country or list phone numbers.
- If the provider blocks the content for safety reasons, the user sees a message that points them to urgent support.

## License

See [LICENSE](LICENSE).
