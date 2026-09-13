# Generative Marketing Studio

AI-powered social marketing studio for small and local brands — brief → visual → caption →
scheduled post → analytics, in one workspace.

**React + Vite** frontend · **Node + Express + Prisma (MongoDB)** backend · multi-tenant, role-based.

> **Runs with zero API keys.** Every integration degrades to a keyless or mock mode, so the whole
> pipeline — image generation, publishing, analytics — is demoable with nothing but a database.
> Add keys when you want the real thing. `GET /api/health` reports what's live.

```bash
npm run install:all && npm run db:setup && npm run dev
# → http://localhost:5173 · sign in as owner@demo.com / password123
```

---

## Contents

[Features](#features) · [Quick start](#quick-start) · [Configuration](#configuration) ·
[Architecture](#architecture) · [Scripts](#scripts) · [Deployment](#deployment) ·
[Troubleshooting](#troubleshooting) · [Contributing](#contributing)

---

## Features

| Area | What you get |
| --- | --- |
| **Workspace** | Multi-tenant workspaces, Owner/Creator roles, team management, profile & password self-service |
| **Brands** | Multiple brand profiles per workspace, product catalog, brand switcher |
| **Brand Kit** | Colour palette extracted from your logo, fonts, lockable |
| **Copy Studio** | Streaming AI captions & ad copy, 5-variation generator, hashtags, history |
| **Image Studio** | Text-to-image with a prompt cache that dedupes repeat calls and ranks winners |
| **Creative Briefs** | Product + style + mood → composed prompt → versioned assets, bulk tagging |
| **Asset Library** | Versions, tags, favourites, prompt search, paged gallery, one-click platform resizing |
| **Compositing** | Product cutouts over backgrounds with branded text overlays |
| **Video Studio** | FFmpeg promo reels from images, captions and a soundtrack, with per-scene regeneration |
| **Campaigns** | Suggestions tuned to upcoming Bangladeshi retail moments (Eid, Boishakh, 11.11 …) |
| **Calendar** | Month/week views, drag-to-reschedule, unscheduled backlog |
| **Approvals** | Draft → review → approve/reject → schedule → publish, with a full audit trail |
| **Publishing** | Facebook & Instagram via Meta Graph, scheduled jobs, exponential-backoff retries |
| **Analytics** | Engagement over time, per-platform split, best day/hour to post, top posts, campaign ROI |
| **Link-in-Bio** | Public mini landing page with click tracking |
| **QR Codes** | Branded codes with scan tracking and redirect |

**Stack** — Node 18+, Express 4, Prisma 6 (MongoDB), Zod, JWT, Agenda, fluent-ffmpeg, Cloudinary ·
React 18, Vite 6, Tailwind CSS, TanStack Query, Zustand, Recharts, dnd-kit

---

## Quick start

### Prerequisites

- **Node.js 18+**
- **MongoDB as a replica set** — Prisma's MongoDB connector needs one for transactions. Use a free
  [Atlas](https://www.mongodb.com/atlas) cluster (replica set by default), or `docker compose up -d`
  for a local single-node one.
- **FFmpeg** *(optional)* — only for the Video Studio. `brew install ffmpeg`, or set `FFMPEG_PATH`.

### 1 · Install

```bash
git clone https://github.com/AbirHasanPiash/gen-marketing-studio.git
cd gen-marketing-studio
npm run install:all
```

### 2 · Configure

Create `backend/.env` (copy `backend/.env.example`). Only `DATABASE_URL` is required:

```bash
DATABASE_URL="mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/mkt_studio?retryWrites=true&w=majority"
```

Everything else has a working default — see [Configuration](#configuration). The frontend needs no
env file in dev: Vite proxies `/api` and `/media` to `http://localhost:4000`.

### 3 · Set up the database

```bash
npm run db:setup   # prisma generate → db push → seed demo data
```

### 4 · Run

```bash
npm run dev        # API on :4000, web on :5173
```

Sign in with a seeded account (all `password123`):

| Email | Role |
| --- | --- |
| `owner@demo.com` | Owner — approves, schedules and publishes |
| `creator@demo.com` | Creator — drafts and submits |
| `designer@demo.com` | Creator — drafts and submits |

The seed builds a complete workspace: two brands with locked brand kits, 10 products, 4 campaigns,
31 posts covering every lifecycle state, 23 publications with engagement history, a versioned asset
library, prompt-cache and AI-copy history, a live link-in-bio page, tracked QR codes and three reel
projects. It is hand-authored and deterministic — the same numbers every run — so the charts tell a
consistent story instead of showing noise.

---

## Configuration

All backend config is read through `backend/src/config/env.js`; nothing reads `process.env`
directly. Every integration exposes an `enabled` flag — check what's live via `GET /api/health`.

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | — | **Required.** MongoDB replica-set connection string |
| `PORT` | `4000` | |
| `API_BASE_URL` | `http://localhost:4000` | Used in OAuth, QR and locally-served media URLs |
| `WEB_BASE_URL` | `http://localhost:5173` | Frontend origin — CORS allow-list + OAuth redirect target |
| `CORS_EXTRA_ORIGINS` | — | Comma-separated extra origins (staging, a second frontend) |
| `VERCEL_PROJECT_NAME` | derived | Vercel project whose previews may call the API. Only needed when `WEB_BASE_URL` is a custom domain |
| `VERCEL_PREVIEWS` | `true` | `false` restricts CORS to exact origins only |
| `JWT_SECRET` | dev fallback | **Required in production** — the server refuses to boot with the default |
| `JWT_EXPIRES_IN` | `7d` | |
| `TOKEN_ENCRYPTION_KEY` | dev fallback | **Required in production.** 32-byte hex, encrypts Meta tokens at rest. `openssl rand -hex 32` |
| `CLOUDINARY_*` | — | Unset → uploads are written to `backend/tmp/uploads` and served by the API |
| `OPENROUTER_API_KEY` | — | Unset → the built-in mock copywriter |
| `OPENROUTER_MODEL` | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | |
| `IMAGE_PROVIDER` | `pollinations` | Keyless. Or `gemini` / `stability` / `openai` / `replicate` |
| `GEMINI_API_KEY`, `STABILITY_API_KEY`, … | — | Key for the chosen image provider; a missing key falls back to `pollinations` |
| `META_APP_ID` / `META_APP_SECRET` | — | Unset → "Connect Meta" attaches demo accounts |
| `META_GRAPH_VERSION` | `v21.0` | |
| `META_WEBHOOK_VERIFY_TOKEN` | `mkt_studio_verify` | |
| `FFMPEG_PATH` | auto-detect | Absolute path to the ffmpeg binary |
| `VERBOSE` | `false` | Logs every Prisma query |

Frontend: set `VITE_API_URL` to your deployed API origin, **no trailing slash** (`lib/api.js`
appends `/api`). `VITE_*` values are inlined at build time, so changing one needs a redeploy.

> **Never commit `.env`.** It is gitignored — keep it that way.

---

## Architecture

```
gen-marketing-studio/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # single source of truth for all models
│   │   └── seed.js            # deterministic demo workspace
│   └── src/
│       ├── app.js             # Express app: middleware + route mounting
│       ├── index.js           # entry: DB connect → scheduler → listen → graceful shutdown
│       ├── config/            # env (validated on boot in prod), cors
│       ├── jobs/agenda.js     # publish queue, retries, analytics cron
│       ├── lib/               # prisma, meta, cloudinary, imagegen, llm, crypto, uploads
│       ├── middleware/        # auth, validate, rateLimit, error
│       ├── modules/<name>/    # <name>.routes.js (+ .service.js)
│       └── utils/             # ApiError, http helpers, validators, tenant scope guards
├── frontend/src/
│   ├── pages/                 # one lazy-loaded file per screen
│   ├── components/{ui,layout,shared}/
│   ├── hooks/ · store/        # TanStack Query hooks, Zustand stores
│   └── lib/                   # axios client, SSE helper, formatters
└── tests/                     # vitest — pure logic, no DB or network
```

### Request flow

`route → rateLimit → authenticate → validate(zod) → tenant scope guard → prisma → { success, data }`

### Conventions

- **ES Modules only.** Include the `.js` extension in relative imports.
- **One Prisma client:** `import { prisma } from '../lib/prisma.js'` — never `new PrismaClient()`.
- **Read config from `env`,** not `process.env`.
- **Throw, don't hand-roll responses:** `throw ApiError.notFound('Campaign not found')`. Wrap async
  handlers in `asyncHandler` so rejections reach the central error handler.
- **Validate every input with Zod** via `validate({ body, query, params })`. Parsed values replace
  the raw ones. Use the shared helpers in `utils/validators.js` (`objectId`, `queryObjectId`,
  `pageQuery`, `httpUrl`) — an unvalidated id reaches Prisma as an opaque 400.
- **Scope every query to the tenant** — `ensureBrand` / `ensureOwned` from `utils/scope.js`.
- **Response envelope:** `{ success: true, data, meta? }` / `{ success: false, error: { message, details? } }`.
- **Mount routers above `notFound`** in `app.js`, or they're silently unreachable.

### Security notes

- Sessions are JWT bearer tokens in `localStorage`; the Meta OAuth `state` is a separate,
  purpose-tagged, 15-minute token that `authenticate` refuses — it travels through third-party
  redirects and must never work as a credential.
- Meta access tokens are AES-256-GCM encrypted at rest.
- Rate limits: tight on auth, per-workspace on generation endpoints (they cost money), looser
  everywhere else.
- The Meta webhook requires a valid `x-hub-signature-256`; with no Meta app configured it refuses
  outright rather than trusting any caller.
- Production boot fails fast if `JWT_SECRET` or `TOKEN_ENCRYPTION_KEY` are still the dev defaults.

---

## Scripts

From the repo root:

| Command | What it does |
| --- | --- |
| `npm run install:all` | Install root + backend + frontend dependencies |
| `npm run dev` | Start API and web together |
| `npm run db:setup` | `prisma generate` → `db push` → seed |
| `npm run seed` | Re-seed demo data (resets the demo tenant only) |
| `npm run lint` | ESLint across both apps (`lint:fix` to autofix) |
| `npm test` | Vitest unit suite (`test:watch` to iterate) |
| `npm run build` | Production build of the frontend |
| `npm run verify` | lint + test + build — what CI runs |

Backend-only (`cd backend`): `npm run dev` · `npm start` · `npm run worker` ·
`npm run prisma:generate` · `npm run prisma:push` · `npm run prisma:studio`

> After pulling any change to `schema.prisma`, run `npm --prefix backend run prisma:generate`.

---

## Deployment

**Frontend → Vercel, backend → Render.** The API can't run on Vercel: the Agenda scheduler, the
FFmpeg render jobs and the `tmp/` static mounts all need a long-lived process with a writable disk.

### 1 · Backend on Render

**New → Blueprint** → point at this repo; it reads `render.yaml`. Fill the `sync: false` vars:

- `DATABASE_URL` — your Atlas string. Allow-list `0.0.0.0/0` in Atlas; Render has no static IP on
  the free plans.
- `TOKEN_ENCRYPTION_KEY` — `openssl rand -hex 32`. **Set once and never rotate** — it decrypts
  stored Meta tokens.
- `API_BASE_URL` — the Render URL, e.g. `https://mkt-studio-api.onrender.com`.
- `WEB_BASE_URL` — your Vercel URL (fill after step 2).
- Cloudinary keys — strongly recommended: without them uploads and renders land on Render's
  ephemeral disk and vanish on the next deploy.

Verify with `curl https://<render-url>/api/health` — it returns `503` if the database is unreachable,
so it works as a real health check.

### 2 · Frontend on Vercel

Import the repo at [vercel.com/new](https://vercel.com/new), then:

- **Root Directory: `frontend`** — the monorepo step people miss. `frontend/vercel.json` supplies
  the Vite preset, `dist` output and SPA rewrites.
- Environment variable `VITE_API_URL` = your Render origin, no trailing slash.

### 3 · Connect them

Set `WEB_BASE_URL` on Render to the Vercel URL and redeploy. Preview deployments of that same Vercel
project are allowed automatically — see [Configuration](#configuration) if production sits on a
custom domain. For Meta publishing, add `https://<render-url>/api/social/meta/callback` to Valid
OAuth Redirect URIs in the Meta app dashboard.

> **Free-tier caveat:** Render spins the service down after ~15 minutes idle, and Agenda only runs
> while the process is awake — a post scheduled for 3am fires whenever the service next wakes. Use a
> paid instance (or an external cron pinging `/api/health`) for dependable scheduling.

The scheduler runs in-process with the API, so one web service is enough. To scale it out, run
`npm run worker` as a separate background service.

---

## Troubleshooting

**`Could not connect to MongoDB`** — your IP isn't whitelisted in Atlas, `DATABASE_URL` is missing
or malformed, or a password special character needs URL-encoding. Locally, check the replica set is
up: `docker compose ps`.

**`@prisma/client did not initialize yet`** — run `npm --prefix backend run prisma:generate`. Needed
after every `schema.prisma` change.

**`Refusing to start in production`** — `JWT_SECRET` and `TOKEN_ENCRYPTION_KEY` are still the dev
defaults. Generate real ones; see [Configuration](#configuration).

**CORS error in the browser** — allowed origins are `WEB_BASE_URL`, `localhost:5173`,
`localhost:3000`, anything in `CORS_EXTRA_ORIGINS`, and preview deploys of your Vercel project. The
server logs each blocked origin once, naming it.

**Video renders are disabled** — the Video Studio checks the server on load and says so when FFmpeg
is missing. Install it or set `FFMPEG_PATH`. Captions need a build with the `drawtext` filter
(libfreetype); without it the reel still renders, and the page says captions will be skipped unless
Cloudinary is configured to burn them in instead.

**`429 Too many requests`** — you hit a rate limit. Limits are 20× looser outside production; see
`backend/src/middleware/rateLimit.js`.

**Port already in use** — change `PORT` in `backend/.env`, or `lsof -ti:4000 | xargs kill -9`.

---

## Contributing

Nobody commits directly to `main`.

```bash
git checkout main && git pull origin main
git checkout -b feature/<module>-<task>
# …work, commit in small steps…
git pull origin main          # resolve conflicts locally, before the PR
git push -u origin feature/<module>-<task>
```

Then open a PR and request one review. Before you do:

- [ ] `npm run verify` passes (lint, tests, build)
- [ ] No `.env`, secrets or stray `console.log` (use `logger`)
- [ ] Routes mounted above `notFound`; inputs validated; queries scoped to the tenant
- [ ] Schema changes called out in the PR description

`schema.prisma` and `app.js` are the two files everyone touches — expect conflicts there and keep
edits scoped to your own models.

### Module owners

| Owner | Area |
| --- | --- |
| **S M ZUNAID ALAM** | Multi-tenant RBAC · Brand profiles · Media pipeline · Link-in-Bio |
| **KHAN FARHAN MAHDI** | Post editor · Content calendar · AI copy · Multi-platform adaptation |
| **MD. ABIR HASAN PIASH** | Creative briefs · Asset gallery · AI image generation · Compositing · Video pipeline |
| **SHAHRIAR MOHAMMAD** | Approval workflows · Meta publishing · Performance analytics |
