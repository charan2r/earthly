# Earthly 🌿

**Less screen. More green.** A full-stack outdoor adventure app: make a short quest, follow one moment at a time, save a tiny wonder, and see how much of the session happened away from the app.

## Quick start

Requires Node.js 22+ and npm 10+. Run these commands from the project root:

```powershell
npm install
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
npm run dev
```

Open **http://localhost:3000**. The API runs at **http://127.0.0.1:4000/api/v1**. Demo mode works immediately without credentials or MongoDB: it uses clearly labeled sample quests, sample discovery suggestions, and in-memory backend storage. Data on the server resets when the API restarts; the browser journal remains, but its expired demo session must be reset in Settings before making more requests. Export the journal first if needed.

## Live services

Edit `backend/.env`. Keys stay in the backend and never use `NEXT_PUBLIC_` variables.

1. Set `DEMO_MODE=false`.
2. Create a MongoDB Atlas cluster and a database user restricted to the Earthly database. Allow the backend's IP in Atlas Network Access. Set `MONGODB_URI` with the connection string and an encoded password; the database name is `grassquest`.
3. Set `GEMMA_API_KEY`. The default Google adapter calls hosted `gemma-4-26b-a4b-it` with text and inline images using the Gemini API. Set `GEMMA_MODEL` to a model available to your account. See [Google's hosted Gemma documentation](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api).
4. For another host, set `GEMMA_PROVIDER=openai-compatible`, `GEMMA_BASE_URL=https://your-provider.example/v1`, `GEMMA_MODEL`, and `GEMMA_API_KEY`. The adapter calls `/chat/completions` and uses image URL content parts. Your selected host and model must support that format and vision if you want photo analysis. A local vLLM-compatible server can use this interface too; running that server is separate from this app.
5. Optional: set `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, and `ELEVENLABS_MODEL`. Enable voice in Settings, then tap “Listen to this step” in field mode. See [ElevenLabs speech API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert).
6. Optional: set `SERPAPI_API_KEY`. Nearby discovery uses Google Maps results for the typed area. Without a key, enter a familiar public place and continue without discovery. See [SerpAPI Maps documentation](https://serpapi.com/google-maps-api).

All provider base URLs are configurable. Live generation errors are surfaced to the user; a failed hosted request is never silently replaced with a demo response. Requests have deadlines and model JSON receives one validation retry. There are no secrets in this repository. Live paid requests were not executed during development verification.

## Experience

- Home and guest planning; no login, signup, or name entry is required. A private device session is created automatically when generating a quest or discovering places. Explorer names can be personalized later in Settings.
- Time, mood, company, mobility and area preferences; optional nearby public-place discovery.
- Generated quest preview, exact time budget, safety notes, and field mode with one instruction at a time.
- Optional voice instructions, phone-away reminder, cautious text/photo observations, and nine-square nature bingo.
- Completion recap, adventure journal, data export, reduced motion, voice settings, and device reset.
- Responsive layouts with desktop sidebar and mobile navigation, custom forest illustrations, accessible labels, keyboard focus and reduced-motion support.

## Architecture

```text
frontend/          Next.js App Router + TypeScript + Tailwind CSS 4
  app/             page, layout, global design system
  components/      interactive flows and original SVG landscape artwork
  lib/             API client, browser persistence and photo resizing
  public/          manifest, icons and production service worker
backend/          NestJS + TypeScript
  src/providers.ts NatureAI / PlaceDiscovery / VoiceInstructions interfaces
  src/domain.ts    quest lifecycle, progress merges and observation handling
  src/store.ts     storage interface, Mongoose store, explicit memory demo store
  src/schemas.ts   User / Quest / Progress / Observation MongoDB schemas
  src/dto.ts       request validation and nested place validation
  src/http.ts      device-session guard, sanitized errors and request logging
packages/shared/   Zod JSON schemas, API types and labeled demo data
tests/             browser journey and responsive layout verification
```

The frontend proxies `/api/*` to the Nest server using the server-only `API_URL`. New sessions receive a random 256-bit device bearer token; only its SHA-256 hash is stored in MongoDB. Authenticated routes enforce ownership. Tokens live in the browser's local storage and do not expire automatically in this MVP. This is a device identity, without passwords, cross-device login or recovery. For a public consumer launch, add your chosen account/session system and retention/deletion policies. Export excludes the bearer token.

Quest plans and progress are separate MongoDB collections. Progress writes compare revisions and retry conflicts, merge completed steps/bingo monotonically, reject out-of-order steps, and prevent completion until all moments are done. Observation UUIDs make replayed uploads idempotent. User and quest ownership are indexed; observations are indexed by quest and creation time. The Mongo store writes progress before quest creation, removes progress on a quest-create error, and does not require Atlas transactions.

The API applies whitelist DTO validation, authentication, per-IP throttling (including stricter generation/upload/voice limits), Helmet headers, restricted CORS, request IDs and metadata-only logs. Body fields, provider keys, notes, images and upstream response bodies are not logged. Errors return `{ statusCode, message, requestId }`. `/health` reports liveness and configured capabilities; it is not an active provider/database probe. Place results are discovery suggestions, not route, accessibility or opening-hour guarantees.

## API reference

Prefix: `/api/v1`. All routes except health and session require `Authorization: Bearer <device-token>`.

| Method | Route | Input / purpose |
|---|---|---|
| GET | `/health` | Liveness, demo/live mode, configured voice/discovery |
| POST | `/users/session` | `{name}` → `{user,token}` |
| GET | `/users/me` | Public device-user profile |
| PATCH | `/users/me` | Optional `{name,voice,reducedMotion}` |
| POST | `/places/discover` | `{location,latitude?,longitude?}` → places |
| POST | `/quests` | `{minutes,mood,location,mobility,company,place?}` → validated quest |
| GET | `/quests` | Up to 100 most recent quests for this device |
| GET | `/quests/:id` | Owned quest with progress |
| PATCH | `/quests/:id/progress` | `{status,completedSteps,bingo,screenSeconds,elapsedSeconds}` |
| GET | `/quests/:id/observations` | Owned observation history |
| POST | `/quests/:id/observations` | Multipart `id` (UUID v4), `note`, optional `photo` |
| POST | `/quests/:id/voice` | `{step}` (zero-based) → `audio/mpeg` |

Quest input: `minutes` 15–120; `mood` peaceful/curious/energized; `mobility` standard/step-free; `company` solo/together. The UI offers 15/30/45/60 minutes. Quests contain 3–8 bounded instructions and exactly nine unique bingo items. Model output must pass Zod shape validation, match the exact requested duration, and pass a conservative risk-action filter. The observation schema bounds response lengths and confidence. This safety layer is a basic heuristic, not a guarantee; people must judge actual weather, daylight and surroundings.

## PWA, offline behavior and privacy

`npm run build` then `npm start` enables the production service worker. Visit once while online before going offline. The manifest provides standalone install behavior and regular/maskable PNG icons. The worker caches the visited app shell and static assets; API responses and photos are never stored in its cache. Install on localhost or HTTPS using a supporting browser's install/menu action; iOS uses Add to Home Screen.

Start a quest while connected so the backend records its start time. Quest instructions, progress, bingo and observation drafts persist in local storage. During an active quest, visible app time increments once per second; elapsed time comes from the recorded start. When hidden/locked, elapsed time continues. **Estimated away-from-screen time = elapsed session time − visible app time.** It is not GPS-verified outside time or total device screen time, and backgrounding the app while indoors will also increase the estimate. Sessions and timers are bounded to 24 hours.

Pending progress/settings and observations replay on reconnect and at 15-second intervals. Progress replay is monotonic; observed bingo items stay marked. New quests, nearby results, hosted observation analysis and hosted voice need internet. The app does not provide offline inference, navigation, maps, background geolocation or emergency services. Keep the active quest in one browser tab; timers do not coordinate across tabs.

The photo flow asks permission before sending a resized image to hosted Gemma. Only JPEG/PNG/WebP files up to 5 MB are accepted; the API checks file signatures as well as MIME types. The client redraws images to at most 800 pixels, strips metadata, and stores the resulting thumbnail on the device for the journal/replay. The backend forwards the image in memory and persists the note/insight, not image bytes. Provider data retention remains governed by the provider's terms. Local storage is not encrypted and has finite capacity; export and reset it in Settings. Device reset does not delete existing server records or recover a lost device token.

## Commands and verification

```powershell
npm run dev         # build shared types and run both apps with reload
npm run typecheck   # all TypeScript workspaces
npm test            # build shared/API; domain, HTTP and provider adapter tests
npm run build       # production builds of shared, API and Next.js
npm start           # start the two production builds
npm run test:e2e    # browser journey, offline reload, reconnect sync, responsive layout
```

Browser tests use an installed Microsoft Edge by default. For CI, install Chromium with `npx playwright install chromium`, remove `channel: 'msedge'` from `playwright.config.ts`, and run after `npm run build`. Tests use demo mode and mock provider HTTP calls; they do not need paid keys. The domain/HTTP tests cover malformed model JSON, exact budgets, safety rejection, session ownership, ordered/idempotent progress, settings, invalid image signatures, oversized uploads and observation replay. Atlas/live-provider end-to-end checks require your own credentials and are separate from the included tests.

## Deployment

Deploy the Next.js frontend and long-running Nest backend separately, with Atlas as the database. Set `API_URL` **when building** the frontend to the backend's reachable URL (Next rewrites resolve at build time). Set `WEB_ORIGIN` to the public frontend HTTPS origin, `NODE_ENV=production`, `DEMO_MODE=false`, and all required live variables on the API. Set `HOST=0.0.0.0` for container hosting. Run workspace builds from the monorepo root and ship the shared package's `dist/` alongside backend dependencies. Place TLS at the hosting edge; only the frontend should be public when using its same-origin proxy. The included throttler is per-process; add shared rate limiting before scaling to multiple API instances. Do not use demo memory storage in production (startup rejects it).

## Why open innovation matters

Gemma is the core planner and multimodal observation engine. Its open weights allow a deployment you control, model changes and later fine-tuning. The adapter interface keeps that choice separate from quest rules and UI behavior. A closed-only implementation would tie those pieces to a single hosted model. This version uses hosted inference for convenient setup, so it does not claim offline AI or server-free privacy; the saved field experience works without a connection. ElevenLabs and SerpAPI are optional helpers, not the source of the quest logic.

MIT license for this project's code and original SVG illustrations. Gemma model weights and provider services have their own terms.

