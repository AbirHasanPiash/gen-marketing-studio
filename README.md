# Generative Marketing Studio

An AI-powered social marketing studio for small and local brands — brief to visual to caption to
scheduled post to analytics, in one workspace.

Monorepo: **React + Vite** frontend, **Node + Express + Prisma (MongoDB)** backend.

> **Runs with zero API keys.** Every integration degrades to a keyless or mock mode, so you can
> demo the whole pipeline — including image generation, publishing and analytics — with nothing but
> a database. Add keys when you want the real thing.

---

## Features

| Area | What you get |
| --- | --- |
| **Workspace** | Multi-tenant workspaces, Owner/Creator roles, team management |
| **Brands** | Multiple brand profiles per workspace, product catalog, brand switcher |
| **Brand Kit** | Colour palette extracted from your logo, fonts, lockable |
| **Copy Studio** | Streaming AI captions & ad copy, 5-variation generator, hashtags, history |
| **Image Studio** | Text-to-image with a prompt cache that dedupes repeat calls and ranks winners |
| **Creative Briefs** | Product + style + mood → composed prompt → versioned assets |
| **Asset Library** | Versions, tags, favourites, prompt search, one-click resize for every placement |
| **Compositing** | Product cutouts over backgrounds with branded text overlays |
| **Video Studio** | FFmpeg promo reels from images, captions and a soundtrack |
| **Campaigns** | Suggestions tuned to upcoming Bangladeshi retail moments (Eid, Boishakh, 11.11 …) |
| **Calendar** | Month/week views, drag-to-reschedule, unscheduled backlog |
| **Approvals** | Draft → review → approve/reject → schedule → publish, with a full audit trail |
| **Publishing** | Facebook & Instagram via Meta Graph, scheduled jobs, exponential-backoff retries |
| **Analytics** | Engagement over time, per-platform split, best day/hour to post, top posts, campaign ROI |
| **Link-in-Bio** | Public mini landing page with click tracking |
| **QR Codes** | Branded codes with scan tracking and redirect |

**Stack** — Node 18+, Express 4, Prisma 6 (MongoDB), Zod, JWT, Agenda, fluent-ffmpeg, Cloudinary ·
React 18, Vite 6, TailwindCSS, TanStack Query, Zustand, Recharts, dnd-kit

---

## Quick start

### Prerequisites

- **Node.js 18+**
- **MongoDB as a replica set** — Prisma's MongoDB connector needs one for transactions.
  Use a free [Atlas](https://www.mongodb.com/atlas) cluster (replica set by default), or run
  `docker compose up -d` for a local single-node one.
- **FFmpeg** *(optional)* — only for the Video Studio. `brew install ffmpeg`, or set `FFMPEG_PATH`.

### 1. Install

```bash
git clone https://github.com/AbirHasanPiash/gen-marketing-studio.git
cd gen-marketing-studio
npm run install:all
```

### 2. Configure

Create `backend/.env`. Only `DATABASE_URL` is required:

```bash
DATABASE_URL="mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/mkt_studio?retryWrites=true&w=majority"
```

See [Configuration](#configuration) for everything else. The frontend needs no env file in dev —
Vite proxies `/api` to `http://localhost:4000`.

### 3. Set up the database

```bash
npm run db:setup   # prisma generate → db push → seed with demo data
```

### 4. Run

```bash
npm run dev        # API on :4000, web on :5173
```

Open **http://localhost:5173** and sign in with a seeded account:

| Email | Password | Role |
| --- | --- | --- |
| `owner@demo.com` | `password123` | Owner — approves, schedules and publishes |
| `creator@demo.com` | `password123` | Creator — drafts and submits |
| `designer@demo.com` | `password123` | Creator — drafts and submits |

The seed builds a complete workspace: two brands with locked brand kits, 10 products, 4 campaigns,
31 posts covering every lifecycle state, 23 publications with engagement history, a versioned asset
library, prompt-cache and AI-copy history, a live link-in-bio page, tracked QR codes and three reel
projects. Everything is hand-authored and deterministic — the same numbers every run — so the charts
tell a consistent story rather than showing random noise.

---

## Configuration

All backend config lives in `backend/src/config/env.js`. Every integration exposes an `enabled`
flag; check what's live at any time via `GET /api/health`.

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | — | **Required.** MongoDB replica-set connection string |
| `PORT` | `4000` | |
| `API_BASE_URL` | `http://localhost:4000` | Used in OAuth, QR and media URLs |
| `WEB_BASE_URL` | `http://localhost:5173` | Frontend origin — CORS allow-list + OAuth redirect target |
| `CORS_EXTRA_ORIGINS` | — | Comma-separated extra origins (staging, a second frontend) |
| `VERCEL_PROJECT_NAME` | derived | Vercel project whose previews may call the API. Only needed when `WEB_BASE_URL` is a custom domain |
| `VERCEL_PREVIEWS` | `true` | `false` restricts CORS to exact origins only |
| `JWT_SECRET` | dev fallback | **Set a real one in production** |
| `JWT_EXPIRES_IN` | `7d` | |
| `TOKEN_ENCRYPTION_KEY` | dev fallback | 32-byte hex; encrypts Meta tokens at rest. `openssl rand -hex 32` |
| `CLOUDINARY_*` | — | Unset → uploads fall back to data URIs / local disk |
| `OPENROUTER_API_KEY` | — | Unset → mock copy generator |
| `OPENROUTER_MODEL` | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | |
| `IMAGE_PROVIDER` | `pollinations` | Keyless. Or `gemini` / `stability` / `openai` / `replicate` |
| `GEMINI_API_KEY` etc. | — | Key for the chosen image provider |
| `META_APP_ID` / `META_APP_SECRET` | — | Unset → "Connect Meta" attaches demo accounts |
| `META_GRAPH_VERSION` | `v21.0` | |
| `META_WEBHOOK_VERIFY_TOKEN` | `mkt_studio_verify` | |
| `FFMPEG_PATH` | auto-detect | Absolute path to the ffmpeg binary |
| `VERBOSE` | `false` | Logs Prisma queries |

For the frontend in production, set `VITE_API_URL` to your deployed API origin.

> **Never commit `.env`.** It is gitignored — keep it that way.

---

## Project structure

```
gen-marketing-studio/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # single source of truth for all models
│   │   └── seed.js            # demo workspace, brands, posts, analytics
│   └── src/
│       ├── app.js             # Express app: middleware + route mounting
│       ├── index.js           # entry: DB connect → scheduler → listen
│       ├── config/env.js      # centralised config
│       ├── jobs/agenda.js     # publish queue, retries, analytics cron
│       ├── lib/               # prisma, meta, cloudinary, imagegen, groq, crypto…
│       ├── middleware/        # auth, validate, error
│       ├── modules/<name>/    # <name>.routes.js (+ .service.js)
│       └── utils/             # ApiError, http helpers, scope guards
└── frontend/
    └── src/
        ├── pages/             # one file per screen
        ├── components/{ui,layout,shared}/
        ├── hooks/ · store/    # TanStack Query hooks, Zustand stores
        └── lib/               # axios client, SSE helper, formatters
```

### Conventions

- **ES Modules only.** Include the `.js` extension in relative imports.
- **One Prisma client:** `import { prisma } from '../lib/prisma.js'` — never `new PrismaClient()`.
- **Read config from `env`,** not `process.env`.
- **Throw, don't hand-roll responses:** `throw ApiError.notFound('Campaign not found')`.
  Wrap async handlers in `asyncHandler` so rejections reach the central error handler.
- **Validate every input with Zod** via the `validate({ body, query, params })` middleware.
  `ZodError` is already mapped to a clean 400.
- **Scope every query to the tenant** — use `ensureBrand` / `ensureOwned` from `utils/scope.js`.
- **Response envelope:** `{ success: true, data, meta? }` / `{ success: false, error: { message, details? } }`.
- **Mount routers above `notFound`** in `app.js`, or they're silently unreachable.

---

## Scripts

Run from the repo root:

| Command | What it does |
| --- | --- |
| `npm run install:all` | Install root + backend + frontend dependencies |
| `npm run dev` | Start API and web together |
| `npm run db:setup` | `prisma generate` → `db push` → seed |
| `npm run seed` | Re-seed demo data (resets the demo tenant only) |
| `npm run build` | Production build of the frontend |

Backend-only (`cd backend`): `npm run dev` · `npm start` · `npm run worker` ·
`npm run prisma:generate` · `npm run prisma:push` · `npm run prisma:studio`

> After pulling any change to `schema.prisma`, run `npm --prefix backend run prisma:generate`.

---

## Deployment

**Frontend → Vercel, backend → Render.** The API can't run on Vercel: the Agenda scheduler, the
FFmpeg render jobs and the `tmp/` static mounts all need a long-lived process with a writable disk.

### 1. Backend on Render

**New → Blueprint** → point at this repo; it reads `render.yaml`. Fill the `sync: false` vars:

- `DATABASE_URL` — your Atlas string. Allow-list `0.0.0.0/0` in Atlas; Render has no static IP on
  the free plans.
- `TOKEN_ENCRYPTION_KEY` — `openssl rand -hex 32`. **Set once and never rotate** — it decrypts
  stored Meta tokens.
- `API_BASE_URL` — the Render URL, e.g. `https://mkt-studio-api.onrender.com`.
- `WEB_BASE_URL` — your Vercel URL (fill after step 2).
- Cloudinary keys — strongly recommended: without them uploads and renders land on Render's
  ephemeral disk and vanish on the next deploy.

Verify with `curl https://<render-url>/api/health`.

### 2. Frontend on Vercel

Import the repo at [vercel.com/new](https://vercel.com/new), then:

- **Root Directory: `frontend`** — the monorepo step people miss. `frontend/vercel.json` supplies
  the Vite preset, `dist` output and SPA rewrites.
- Environment variable `VITE_API_URL` = your Render origin, **no trailing slash**
  (`lib/api.js` appends `/api`).

`VITE_*` values are inlined at build time, so changing `VITE_API_URL` needs a **redeploy**, not a
restart.

### 3. Connect them

Set `WEB_BASE_URL` on Render to the Vercel URL and redeploy. Preview deployments of that same
Vercel project are allowed automatically — see [Configuration](#configuration) if production sits
on a custom domain. For Meta publishing, add `https://<render-url>/api/social/meta/callback` to
Valid OAuth Redirect URIs in the Meta app dashboard.

> **Free-tier caveat:** Render spins the service down after ~15 minutes idle, and Agenda only runs
> while the process is awake — a post scheduled for 3am fires whenever the service next wakes. Use a
> paid instance (or an external cron pinging `/api/health`) for dependable scheduling.

The scheduler runs in-process with the API, so a single web service is enough. To scale it out,
run `npm run worker` as a separate background service.

---

## Troubleshooting

**`Could not connect to MongoDB`** — your IP isn't whitelisted in Atlas, `DATABASE_URL` is missing
or malformed, or a password special character needs URL-encoding. Locally, check the replica set is
up: `docker compose ps`.

**`@prisma/client did not initialize yet`** — run `npm --prefix backend run prisma:generate`.
Needed after every `schema.prisma` change.

**CORS error in the browser** — allowed origins are `WEB_BASE_URL`, `localhost:5173`,
`localhost:3000`, anything in `CORS_EXTRA_ORIGINS`, and preview deploys of your Vercel project.
The server logs each blocked origin once, naming it.

**Video renders are disabled** — the Video Studio checks the server on load and tells you when
FFmpeg is missing. Install it or set `FFMPEG_PATH`. Captions need a build with the `drawtext` filter
(libfreetype); without it the reel still renders, and the page says captions will be skipped unless
Cloudinary is configured to burn them in instead.

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

Then open a PR and request one review. Before you do, check:

- [ ] `npm run dev` starts clean and you tested your endpoints
- [ ] No `.env`, secrets or stray `console.log` (use `logger`)
- [ ] Routes mounted above `notFound`; queries scoped to the tenant
- [ ] Schema changes called out in the PR description

`schema.prisma` and `app.js` are the two files everyone touches — expect conflicts there and keep
edits scoped to your own models.

### Module owners

| Owner | Area |
| --- | --- |
| **S M ZUNAID ALAM** | Multi-tenant RBAC · Brand profiles · Media pipeline · Link-in-Bio |
| **KHAN FARHAN MAHDI** | Post editor · Content calendar · AI copy · Multi-platform adaptation |
| **MD. ABIR HASAN PIASH** | Creative briefs · Asset gallery · AI image generation · Video pipeline |
| **SHAHRIAR MOHAMMAD** | Approval workflows · Meta publishing · Performance analytics |
