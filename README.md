# Generative Marketing Studio for Small Businesses

An AI-powered social marketing studio for local brands. This monorepo contains both the React/Vite frontend and the Node.js/Express backend.

---

## 📌 Project Status

**This project is in early scaffolding.** Read this before you start — it tells you what already exists and what you are expected to build.

| Area | Status |
| --- | --- |
| Backend config, logger, Prisma client, error handling | ✅ Done |
| Backend `GET /api/health` | ✅ Done |
| Prisma schema (Tenant, User, Campaign, Post, Asset, BrandKit, …) | ✅ Done |
| Backend routes / controllers / services / auth middleware | ❌ Not started — **no `src/routes/` directory exists yet** |
| `prisma/seed.js`, `src/worker.js` | ❌ Referenced in `package.json` but not written |
| Frontend source (`index.html`, `vite.config.js`, `src/`) | ❌ Not started — only `package.json` exists |

**What this means for you:**

- Hitting `http://localhost:4000/` returns `{"success":false,"error":{"message":"Route not found: GET /"}}`. This is correct — there is no `/` route. Use **`http://localhost:4000/api/health`** to confirm the API is alive.
- `npm run dev` starts both processes, but the frontend has nothing to serve until someone scaffolds Vite.
- `npm run seed` and `npm run db:setup` will fail at the seed step until `backend/prisma/seed.js` exists. Use `npx prisma db push` instead (see [Setup](#3-initialize-the-database-prisma)).

---

## 🧱 Tech Stack

**Backend** — Node.js 18+, Express 4, Prisma 6 (MongoDB), Zod, JWT, bcryptjs, Cloudinary, Groq, Agenda, fluent-ffmpeg
**Frontend** — React 18, Vite 6, TailwindCSS, React Router, TanStack Query, Zustand, Axios, Recharts, dnd-kit

---

## 🚀 Getting Started

### Prerequisites

- **Node.js v18 or higher** (`node -v` to check)
- **Git**
- **Access to the team's MongoDB Atlas cluster** — your IP must be whitelisted. Ask the team lead.
  > Prisma's MongoDB connector **requires a replica set**. Atlas provides this automatically. A plain local `mongod` will not work.

### 1. Clone & Install

Run the install script from the **root** directory. It installs dependencies for both apps and automatically runs `prisma generate` via the backend's `postinstall` hook.

```bash
git clone https://github.com/AbirHasanPiash/gen-marketing-studio.git
cd gen-marketing-studio
npm run install:all
```

### 2. Environment Variables

Only the **backend** needs environment variables right now. Create `backend/.env` and paste the template below. Ask the team lead for the `DATABASE_URL` and any integration keys.

> ⚠️ **Never commit `.env`.** It is already gitignored — keep it that way.

```bash
# backend/.env

# ---- Core (required) ----
DATABASE_URL="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<db>?retryWrites=true&w=majority"

# ---- Server (optional — defaults shown) ----
NODE_ENV=development
PORT=4000
API_BASE_URL=http://localhost:4000
WEB_BASE_URL=http://localhost:5173
VERBOSE=false

# ---- Auth (optional in dev, MUST be set in production) ----
JWT_SECRET=dev-insecure-secret-change-me
JWT_EXPIRES_IN=7d
TOKEN_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

# ---- Integrations (optional — each degrades to mock/disabled when unset) ----
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

OPENROUTER_API_KEY=
OPENROUTER_API_URL=https://openrouter.ai/api/v1/chat/completions
OPENROUTER_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free

IMAGE_PROVIDER=pollinations
STABILITY_API_KEY=
REPLICATE_API_TOKEN=
OPENAI_API_KEY=

META_APP_ID=
META_APP_SECRET=
META_GRAPH_VERSION=v21.0
META_WEBHOOK_VERIFY_TOKEN=mkt_studio_verify

FFMPEG_PATH=
```

**`DATABASE_URL` is the only required variable.** Everything else has a working default — see `backend/src/config/env.js`. Each integration exposes an `enabled` flag, so services can fall back to mock mode when keys are absent. Check what's live at any time via `GET /api/health`.

### 3. Initialize the Database (Prisma)

`npm run install:all` already ran `prisma generate` for you. You need these commands when you **change `schema.prisma`** or set up a fresh database:

```bash
cd backend
npx prisma generate     # regenerate the typed client after any schema edit
npx prisma db push      # sync the schema to MongoDB
cd ..
```

Useful extras:

```bash
npx prisma studio       # visual DB browser at http://localhost:5555
```

### 4. Run the Application

From the **root** directory, start both apps concurrently:

```bash
npm run dev
```

| Service | URL |
| --- | --- |
| Frontend (Vite) | http://localhost:5173 |
| Backend API | http://localhost:4000 |
| Health check | http://localhost:4000/api/health |

To run just one side:

```bash
npm --prefix backend run dev     # API only, with nodemon hot reload
npm --prefix frontend run dev    # web only
```

---

## 📂 Project Structure

```
gen-marketing-studio/
├── package.json              # root scripts (dev, install:all, build)
├── backend/
│   ├── .env                  # your local secrets — NEVER commit
│   ├── prisma/
│   │   └── schema.prisma     # single source of truth for all models
│   └── src/
│       ├── index.js          # entry point: DB connect + app.listen
│       ├── app.js            # Express app: middleware + route mounting
│       ├── config/env.js     # centralised env config
│       ├── lib/
│       │   ├── prisma.js     # shared PrismaClient singleton
│       │   └── logger.js
│       ├── middleware/
│       │   └── error.js      # notFound + central errorHandler
│       └── utils/
│           └── ApiError.js   # operational error carrying an HTTP status
└── frontend/
    └── package.json
```

---

## 🛠️ Contributing Code

### Where to mount your routes

Add your routers inside `createApp()` in `backend/src/app.js`.

> ### ⚠️ Read this or you will lose an hour
> `app.use(notFound)` and `app.use(errorHandler)` are the **last two lines** of `createApp()`. Express matches middleware in registration order, so **every router must be mounted above them.** A router added below `notFound` is silently unreachable and every request to it returns `Route not found` — while your code looks perfectly correct.

```js
// backend/src/app.js — inside createApp()

app.use('/api/auth', authLimiter, authRoutes);   // ✅ your routes go here
app.use('/api/brands', requireAuth, brandRoutes);

app.use(notFound);      // ⬅️ keep these last, always
app.use(errorHandler);
```

### Conventions

- **ES Modules only.** The backend is `"type": "module"` — use `import`/`export`, and always include the `.js` extension in relative imports (`./lib/prisma.js`, not `./lib/prisma`).
- **Import Prisma from the shared singleton:** `import { prisma } from '../lib/prisma.js'` — never call `new PrismaClient()` yourself.
- **Read config from `env`,** not `process.env` directly: `import { env } from '../config/env.js'`.
- **Throw, don't hand-roll responses.** Use `ApiError` and let the central handler format it:
  ```js
  throw ApiError.notFound('Campaign not found');
  throw ApiError.badRequest('Invalid payload', details);
  ```
  Wrap async handlers so rejections reach `errorHandler` — `next(err)` in a `catch`, or an `asyncHandler` wrapper.
- **Validate every input with Zod.** `ZodError` is already mapped to a clean 400 in `middleware/error.js` — just let it throw.
- **Success responses** follow the shape already used by `/api/health`: `{ success: true, ... }`. Errors are `{ success: false, error: { message, details? } }`.
- **Schema changes are shared.** `schema.prisma` is one file for everyone — announce your change in the team chat and keep edits scoped to your own models to avoid painful conflicts. Run `npx prisma generate` after pulling someone else's schema change.

---

## 🌿 Git Workflow

To keep the codebase stable, **nobody commits directly to `main`.** We use a feature branch workflow.

### Step 1 — Sync your local main

Always start from an up-to-date `main`.

```bash
git checkout main
git pull origin main
```

### Step 2 — Create a feature branch

Use a descriptive name: `feature/<module>-<task>` or `bugfix/<issue>`.

```bash
git checkout -b feature/module-1-auth-routes
```

### Step 3 — Develop and commit

Write your code, test it locally, and commit with clear messages. Prefer several small commits over one giant one.

```bash
git add .
git commit -m "Add Zod validation and user registration endpoint"
```

### Step 4 — Sync with remote main (crucial)

While you were working, teammates may have merged their code. Pull their changes into your feature branch and resolve conflicts **locally**, before opening a PR.

```bash
git pull origin main
```

If there are conflicts, VS Code will highlight them. Accept the correct changes, save, then:

```bash
git add .
git commit -m "Merge main into feature/module-1-auth-routes"
```

> Conflicts in `backend/prisma/schema.prisma` or `backend/src/app.js` are the most likely — these are the two files everyone touches. Keep **both** sides unless you are certain, and ask the other author if unsure.

### Step 5 — Push your branch

```bash
git push -u origin feature/module-1-auth-routes
```

### Step 6 — Open a Pull Request

1. Go to the repository on GitHub.
2. Click the green **"Compare & pull request"** button for your branch.
3. Add a brief description of what you built and how to test it.
4. Request a review from **at least one teammate**.
5. Once approved, click **"Merge pull request"**.

**Before you request review, check:**

- [ ] `npm run dev` starts without errors
- [ ] You manually tested your endpoints (Postman / Thunder Client / `curl`)
- [ ] No `.env`, secrets, or API keys in the diff
- [ ] No stray `console.log` — use `logger` from `src/lib/logger.js`
- [ ] Routes are mounted **above** `notFound` in `app.js`
- [ ] If you changed `schema.prisma`, you mentioned it in the PR description

### Step 7 — Clean up

After merging, delete the remote branch on GitHub, then:

```bash
git checkout main
git pull origin main
git branch -d feature/module-1-auth-routes
```

### Rules

- ❌ **Never `git push --force` to `main`** — or to any branch a teammate is reviewing.
- ❌ Never commit `.env`, `node_modules/`, or generated Prisma output.
- ✅ Keep PRs small and focused on one module or feature. Large PRs sit unreviewed.

---

## 👥 Module Assignments

| Owner | Responsibilities |
| --- | --- |
| **S M ZUNAID ALAM** | Multi-Tenant RBAC · Brand Profile CRUD · Media Pipeline · Link-in-Bio |
| **KHAN FARHAN MAHDI** | Post Editor · Content Calendar · AI Copy Suggester · Multi-Platform Adaptation |
| **MD. ABIR HASAN PIASH** | Creative Briefs · Asset Gallery · AI Image Generation · Automated Video Pipelines |
| **SHAHRIAR MOHAMMAD** | Approval Workflows · Meta Publishing Engine · Performance Analytics |

---

## 📜 Available Scripts

Run from the **root** directory:

| Command | What it does |
| --- | --- |
| `npm run install:all` | Install dependencies for backend + frontend |
| `npm run dev` | Start API and web concurrently |
| `npm run build` | Production build of the frontend |
| `npm run db:setup` | `prisma generate` → `db push` → seed ⚠️ *fails until `prisma/seed.js` exists* |
| `npm run seed` | Seed the database ⚠️ *not implemented yet* |

Backend-only (`cd backend`):

| Command | What it does |
| --- | --- |
| `npm run dev` | Start API with nodemon hot reload |
| `npm start` | Start API without hot reload |
| `npm run prisma:generate` | Regenerate the Prisma client |
| `npm run prisma:push` | Push schema changes to MongoDB |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run worker` | Background job worker ⚠️ *`src/worker.js` not implemented yet* |

---

## 🩺 Troubleshooting

**`{"success":false,"error":{"message":"Route not found: GET /"}}`**
Expected — there is no `/` route. Try `GET /api/health`. If you get this on a route you just wrote, you almost certainly mounted it **below** `app.use(notFound)` in `app.js`.

**`Could not connect to MongoDB. Is the replica set running (docker compose up -d)?`**
The `docker compose` hint in that message is stale — we use MongoDB Atlas, not Docker. Real causes: your IP isn't whitelisted in Atlas, `DATABASE_URL` is missing or malformed in `backend/.env`, or your password contains special characters that need URL-encoding.

**`@prisma/client did not initialize yet` / types out of date**
Run `cd backend && npx prisma generate`. You need this every time you pull a change to `schema.prisma`.

**CORS error in the browser**
Allowed origins are `env.webBaseUrl`, `http://localhost:5173`, and `http://localhost:3000` (see `app.js`). If your frontend runs on a different port, set `WEB_BASE_URL` in `backend/.env`.

**Port 4000 or 5173 already in use**
Change `PORT` in `backend/.env`, or free the port: `lsof -ti:4000 | xargs kill -9`.
