# Dependency & Infrastructure Upgrade Plan — garment-erp

**Audit re-verified:** 2026-09-22, after `garment-erp-c1` finished (HEAD `b74a5999`).
**Working tree:** clean.
**Reviewed:** 2026-09-22 by a second session — every claim below was re-run, not read. Results and
seven corrections in **§11**. Three Phase-3 rows changed materially: **3.6, 3.7, 3.8**.
**Method:** live npm registry, `npm audit --package-lock-only` per workspace, live PostgreSQL /
Redis / `system_settings` queries. Nothing here is from memory or documentation.

**For the reviewing session:** every claim below has a verification command in §10. Please check
rather than trust — in particular the two shared-infrastructure findings (§4), which drive the
sequencing.

---

## Current totals

| Workspace | Outdated | Advisories |
|---|---|---|
| frontend | 30 | 12 — 7 high, 0 critical |
| backend | 41 | **44 — 1 critical, 26 high**, 15 moderate, 2 low *(43, 0 critical after Phase 0)* |

---

## 0. Already done — do not redo

| Item | Commit |
|---|---|
| radix-ui consolidated to single `1.6.7` | `dc5a0567` |
| i18next 26, @types/node 26, globals 17, jest-dom 7 | `abe3c08e` |
| eslint 10, react-hooks 7, typescript-eslint 8.70 *(frontend only)* | `8272aaae` |
| vitest 5 | `dc35ec92` |
| vite 8 + plugin-react 6 | `fc568c2f` |
| react-day-picker 10 | `6bc61034` |
| lucide-react 1.47 | `b74a5999` |

All frontend — until **Phase 0, done 2026-09-22**: handlebars `4.7.9` (pin kept exact);
`AI_MODEL` flipped to `deepseek-flash` through `PUT /api/ai-settings` (provider re-initialised
live — log: `Initialized with model: deepseek-flash`); dropdown + `DeepSeekProvider.ts` updated;
`.env` corrected. Verified: the assistant answered a real question on `deepseek-flash`, challan
CH2609-0145 rendered (127 KB PDF), backend critical advisories **1 → 0** (44 → 43 total).

---

# THE PLAN

Six phases, ordered by blast radius. Each phase is independently shippable and independently
revertible. Do not batch across phases.

> ⚠ **Authorization:** the standing commit authorization covers the *order-system plan only*.
> Every phase here is outside it. Get approval per phase.

---

## Phase 0 — Zero blast radius (do first, today)

Nothing here touches shared infrastructure or another business.

| # | Action | Why now |
|---|---|---|
| 0.1 | **handlebars `4.7.8` → `4.7.9`** — bump the pin, keep it exact (§11.5) | The only **CRITICAL**. Non-breaking patch. `npm update` skips it *because* it is exact-pinned — and the pin is deliberate (`f79b02ba`, KF PDF pipeline) |
| 0.2 | **`AI_MODEL`: `deepseek-v4-flash` → `deepseek-flash`** — one row in `system_settings` (garment_erp only) | The old name is a *retired* alias DeepSeek routes only temporarily. When they drop it the AI assistant dies with no warning. Already serving V4.1-Flash — this just stops relying on the alias |
| 0.3 | Update the `deepseek` options in `backend/src/services/ai/ai-settings.service.ts:46-48`, **and** the `DeepSeekModel` union + header comment in `providers/DeepSeekProvider.ts:4-20,41`, to match 0.2 | Dropdown offers the retired `deepseek-v4-flash`. (`deepseek-v4-pro` is still current — see §11; the original "two retired names" was wrong) |
| 0.4 | Fix stale `backend/.env` (`AI_PROVIDER="ollama"` / `AI_MODEL="llama3"`) | DB overrides it; the file misleads anyone who reads it |

**Verify:** ask the in-app assistant a question; confirm a response and no error in `pm2 logs garment-erp-api`.

---

## Phase 1 — In-range sweep (`npm update`)

No major versions. This alone clears most of the HIGH advisories.

| # | Action | Clears |
|---|---|---|
| 1.1 | ⛔ `cd backend && npm update` — **ATTEMPTED 2026-09-22, REVERTED.** See §12 | *(would have cleared 31 advisories, 43 → 12)* |
| 1.2 | ✅ `cd frontend && npm update` — **DONE `cce7e4f8`**, advisories 12 → 1 | **axios 1.12.2 → 1.20.0** and **react-router-dom 7.9.4 → 7.18.4** — the two worst frontend HIGHs — plus react 19.3.0, react-hook-form 7.88.0, @tanstack/* , @playwright/test 1.63.0 |
| 1.3 | ⏸ **zod `4.1.12` → `4.6.5` in BOTH workspaces, same commit** — held at 4.1.12 on both sides until 1.1 can land | Shared schema contract — a split version is a silent validation drift |

**Verify:** `cd frontend && npx tsc -b` (**not** `tsc --noEmit -p tsconfig.json` — the root tsconfig
doesn't cover `src/`), `cd backend && npm run type-check`, then `node scripts/skills/test-all.js`.

---

## Phase 2 — Backend catches up to frontend

The frontend moved; the backend didn't. Close the gap before the majors.

| # | Package | From | To |
|---|---|---|---|
| 2.1 | eslint | 9.39.1 | 10.11.0 — install `typescript-eslint@8.70.1` *first* or npm refuses (§11.7) |
| 2.2 | @types/node | 24.8.0 | 26.6.2 |
| 2.3 | @types/supertest | 6.0.3 | 7.2.1 |

---

## Phase 3 — Majors, one commit each, verify between

Ordered by ascending risk. **Do not batch.**

| # | Package | From → To | Risk / what to check |
|---|---|---|---|
| 3.1 | jsdom *(frontend only — the backend has none)* | 27.2.0 → 29.1.1 | Test-only. Safest major |
| 3.2 | dotenv | 16.6.1 → 18.0.2 | Boot config — confirm the API starts and reads `.env` |
| 3.3 | **openai** | 6.9.1 → **7.21.0** | **Powers the live AI assistant** via DeepSeek. Only breaking change is Node ≥ 22; running v24.11.1 ✅. **Verify the assistant end-to-end after this one** |
| 3.4 | nodemailer | 8.0.5 → 10.0.10 | Two majors. Send a test email |
| 3.5 | puppeteer-core + whatsapp-web.js | 24.38 → 25.11 | Exact-pinned. Drives PDF/document rendering — regenerate an invoice and a challan |
| 3.6 | **prisma + @prisma/client** | 6.19.1 → **7.10.0** | ⚠ **Re-scoped in §11.2 — a project, not a line item.** v7 rejects `url` in the datasource block, requires `prisma.config.ts` plus a driver adapter (`@prisma/adapter-pg`) at `database.ts:30`, and the `prisma-client` generator changes the import path in 323 files. Its only smoke test runs against the live DB (§8.1). 8.0 is in RC — **do not** jump to it |
| 3.7 | **tailwindcss** | 3.4.18 → **4.3.3** | ⚠ **Sized in §11.3 — a project, not a line item.** CSS-first config rewrite, plus 844 opacity-modifier sites, a global `fontSize` override, hand-duplicated utilities and a removed `safelist`. Highest *visual* regression risk — walk the main pages in a browser |
| 3.8 | ~~**typescript** 5.9.3 → **7.0.2**~~ | — | ⛔ **BLOCKED — see §11.1.** The native compiler cannot run under the `node bin/tsc` build gate (both workspaces), `typescript-eslint` supports `<6.1.0` only (canary included), and `route-write-guard.test.ts` uses the compiler API. Owner decision 2026-09-22: **stay on 5.9.3** |

---

## Phase 4 — Shared infrastructure ⚠ NOT a garment-erp decision

**The database is shared across all four businesses; the cache by two — garment-erp and ucip
(§11.4).** Neither can be upgraded unilaterally. Both need an owner decision, a maintenance window, and a full backup.

### PostgreSQL 16.2 → 16.15 *(13 patch releases, ~2 years of fixes)*

Eight databases on one instance, ~5 GB:

```
garment_erp     53 MB      kasya_b2b      170 MB
harleen_b2b     30 MB      sales_analysis 1376 MB
inward_db     1287 MB      thar_coal       13 MB
ucip_db       2058 MB      postgres      7836 kB
```

Same-major in-place: no dump/restore, no schema change, no Prisma change. But the downtime hits
every business at once. **`pg_dumpall` first.**

### Redis 5.0.14.1 → 6.2+

Abandoned Windows community port, zero patches since. Standalone on Windows.
**Checked (§11.4): the consumers are garment-erp and ucip only** — both default to
`localhost:6379`. kasya-b2b, harleen-b2b and thar-coal have no Redis client dependency at all;
inward-web (Python) was not checked. Options: WSL2, Docker, Memurai, Valkey.

**Only after Redis moves:**

| # | Package | From → To |
|---|---|---|
| 4.1 | bullmq | 5.65.0 → 6.3.8 |
| 4.2 | ioredis | 5.8.2 → 6.0.0 |

BullMQ's recommended minimum is Redis 6.2; on 5.0 it "kind of works". Consumers:
`backend/src/jobs/queue.ts`, `backend/src/lib/cache.ts`.

---

## Phase 5 — Code migration, no version fix exists

| # | Item | Action |
|---|---|---|
| 5.1 | **xlsx 0.18.5** — HIGH (prototype pollution + ReDoS), `fixAvailable: false`, **both workspaces** | SheetJS left npm; the npm package is frozen and will never be patched. Migrate to `exceljs` (backend already depends on it) or pull SheetJS from their own CDN registry |

---

## Phase 6 — Cleanup

| # | Item | Location |
|---|---|---|
| 6.1 | Drop `@anthropic-ai/sdk` (0.69, 58 minors behind) and `@google/generative-ai` — statically imported at boot, never executed | `AIProviderFactory.ts:14-19` |
| 6.2 | Retired model IDs in admin dropdowns: `claude-3-opus-20240229`, `gpt-4-vision-preview`, `gpt-3.5-turbo`, `gemini-1.5-*` | `backend/src/services/ai/ai-settings.service.ts:60-72` |

---

## 7. Do NOT touch

- **`radix-ui` 1.6.7** — current. CLAUDE.md forbids partial bumps: Radix pins internals to exact
  versions and keeps its focus-trap in module scope, so a second copy breaks every dialog. One
  version number owns every primitive; bump `radix-ui` itself or nothing.
- **Exact pins are deliberate** — `handlebars`, `puppeteer-core`. Phase 0.1 and 3.5 unpin them
  consciously; nothing else should.
- **`prisma` 8.0.0-rc.15** — release candidate. Target 7.10.0.

---

## 8. Standing risks that affect every phase

1. **No `TEST_DATABASE_URL`** — integration tests run against the **live `garment_erp` database**.
   Anything that runs the suite writes to production data. Known, previously declined; worth
   re-raising before Phase 3.6 (Prisma).
2. **Both apps run from `dist/`** — build *before* `pm2-safe-restart`, or the web app serves blank.
3. **Never `pm2 restart all`** — one shared daemon, 13 processes, four businesses.
   `node C:\Users\NEW\ops\pm2-safe-restart.js garment-erp-api:5000 garment-erp-web:3000` is the
   only sanctioned path. API needs ~20 s to bind.
4. **Frontend type-check is `tsc -b`** — the plain `-p tsconfig.json` form passes broken code.

---

## 9. Suggested order of execution

```
Phase 0  ──► Phase 1 ──► Phase 2 ──► Phase 3 (3.1→3.8 individually)
                                          │
Phase 4 (owner decision + window) ────────┤──► Phase 5 ──► Phase 6
```

Phases 0–3 are garment-erp-only and can start immediately.
Phase 4 needs a cross-business decision and should be scheduled, not squeezed in.

---

## 10. Verification commands

```bash
cd backend  && npm outdated && npm audit --package-lock-only
cd frontend && npm outdated && npm audit
cd backend  && npx prisma migrate status
cd frontend && npx tsc -b
cd backend  && npm run type-check

# Databases on the shared PG instance
cd backend && node -e "require('dotenv').config();\
const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();\
p.\$queryRawUnsafe(\"SELECT datname,pg_size_pretty(pg_database_size(datname)) sz \
FROM pg_database WHERE datistemplate=false ORDER BY datname\").then(r=>console.table(r))"

# Postgres + Redis versions
cd backend && node -e "require('dotenv').config();\
const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();\
p.\$queryRawUnsafe('SELECT version()').then(r=>console.log(r[0].version))"

node -e "require('dotenv').config();const R=require('ioredis');\
new R(process.env.REDIS_URL||'redis://127.0.0.1:6379').info('server').then(console.log)"

# Live AI settings (DB is authoritative, .env is stale)
cd backend && node -e "require('dotenv').config();\
const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();\
p.system_settings.findMany({where:{key:{startsWith:'AI_'}},select:{key:true,value:true}})\
.then(r=>console.log(r))"
```

---

## 11. Review — verified 2026-09-22 (second session, HEAD `b74a5999`)

Every claim in §§0–8 was re-run against live state, the npm registry, or the package's own code —
none was accepted from the text. Anything not listed under *Corrections* checked out exactly.

**Verified exactly.** Outdated 30 / 41. Advisories 12 (7 high, 0 critical) / 44 (1 critical,
26 high, 15 moderate, 2 low). `handlebars@4.7.8` exact pin is the sole critical; fix `4.7.9`,
`isSemVerMajor:false`; `npm update` skips it. `xlsx` HIGH with `fixAvailable:false` in both
workspaces; npm's latest is still 0.18.5. Every backend version cited in Phases 2–4 matches what is
installed. `zod` 4.1.12 on both sides. `backend/.env` says `ollama` / `llama3`; the DB says
`deepseek` / `deepseek-v4-flash`. PostgreSQL 16.2, eight databases, sizes as listed; 16.15 is the
current minor (EOL 2028-11-09). Redis 5.0.14.1, Windows, standalone. `prisma` dist-tags:
`latest` = 8.0.0-rc.15, `prev` = 7.10.0. `openai@7.21.0` engines `node >=22`, and the v7.0.0
release notes name Node ≥ 22 as the only breaking change. `TEST_DATABASE_URL` is absent.
`bullmq`/`ioredis` consumers are exactly `queue.ts` and `cache.ts`. Phase 1.1's
`npm update --dry-run` (587 changes) moves precisely the packages named — express 5.2.1, multer
2.4.0, express-rate-limit 8.7.0, jsonwebtoken 9.0.3, pg 8.23.0, helmet 8.3.0, winston 3.19.0,
jest 30.5.2, @sentry/node 10.75.1 — and the HIGH transitives. The frontend's two direct, fixable
HIGHs are `axios` and `react-router-dom`; the third direct HIGH is the unfixable `xlsx`.

**Phase 0.2 confirmed from DeepSeek's public docs** (`api-docs.deepseek.com/quick_start/pricing`,
no API key used): current models are `deepseek-flash` and `deepseek-v4-pro`; *"the legacy names
`deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` are still accepted, but the corresponding
models have been retired"* — served meanwhile by V4.1-Flash. So `deepseek-v4-pro` is **not**
retired, and the union at `providers/DeepSeekProvider.ts:41` needs the same edit as the dropdown.

### Corrections

1. **3.8 TypeScript 7 — blocked. Removed from the plan.** `typescript@7.0.2` is the native Go
   compiler (it depends on `@typescript/typescript-win32-x64` and siblings). Three independent
   blockers, each verified: (a) the frontend build gate runs
   `node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc -b` (`vite.config.ts:20`) and
   the backend does the same (`backend/package.json:8,22`) — `node` cannot execute a native
   binary, and `smart-check.js` refuses any commit that removes the gate; (b) `typescript-eslint`
   declares `typescript >=4.8.4 <6.1.0` in **every** published version, canary `8.70.2-alpha.0`
   included — no ecosystem support and no date; (c) `route-write-guard.test.ts:16` uses the
   TypeScript compiler API, which the native port does not expose. Owner decision 2026-09-22: stay
   on 5.9.3. If currency is ever wanted, 6.0.3 is the last JS-based release, ships `bin/tsc` +
   `tsserver`, and fits the linter's window — it buys stricter checking and nothing visible.

2. **3.6 Prisma 7 — under-scoped by an order of magnitude.** Probed in an isolated scratch install
   of `prisma@7.10.0` + `@prisma/client@7.10.0`: `prisma generate` on a schema shaped like ours
   fails outright —
   > *The datasource property `url` is no longer supported in schema files. Move connection URLs
   > for Migrate to `prisma.config.ts` and pass either `adapter` for a direct database connection
   > or `accelerateUrl` for Accelerate to the `PrismaClient` constructor.*

   The real work: add `prisma.config.ts`; add `@prisma/adapter-pg@7.10.0` + `pg` and change
   `new PrismaClient({...})` at `backend/src/config/database.ts:30` to pass the adapter; and if the
   generator is switched to `prisma-client` as written, its mandatory `output` path changes the
   import specifier in **323 files** (219 non-test) that import `@prisma/client`. The only
   round-trip test (`persistence-smoke.test.ts`) runs against the live `garment_erp` database
   (§8.1). Treat this like Tailwind 4: its own plan, its own window.

3. **3.7 Tailwind 4 — a project, not a line item.** Measured 2026-09-22: 844 slash-opacity usages
   (`bg-info/15`) against colours declared `hsl(var(--x))` with no `<alpha-value>`; a `fontSize`
   block that overrides the **stock scale globally** (`base` = 0.875rem); an `@layer utilities`
   block at `index.css:346-389` hand-duplicating config tokens; `safelist` (12 entries — removed
   in v4); `postcss.config.cjs` needing `@tailwindcss/postcss`; `tailwindcss-animate` being
   v3-era. Across 32 shadcn components and 501 files (`text-info` 602 uses, `text-success` 559).
   `components.json` points at `tailwind.config.js`; the real file is `.cjs`. Cheap prep that
   shrinks the job: brand tokens, `chart-1..5`, the spacing tokens and the `fade-in` /
   `slide-in-right` animations have **0 uses**; dark mode has no toggle, so the 36 `dark:` usages
   are unreachable.

4. **Phase 4 Redis — two businesses, not four.** Only garment-erp (`bullmq ^5.65.0`,
   `ioredis ^5.8.2`) and ucip (`bullmq ^5.12.0`, `ioredis ^5.4.0`) depend on a Redis client.
   Both run `NODE_ENV=production` with `REDIS_HOST` unset: garment-erp's `queue.ts:17-25` enables
   Redis whenever `NODE_ENV=production` and defaults to `localhost:6379`; ucip's `.env` sets
   `redis://localhost:6379` explicitly. One listener on 6379. kasya-b2b, harleen-b2b and thar-coal
   have no Redis dependency at all; inward-web (Python) was not checked. A Redis move therefore
   needs garment-erp + ucip (+ an inward-web check), and ucip's bullmq 5.12 must be validated
   against 6.2+ too. PostgreSQL is genuinely all four.

5. **0.1 handlebars — bump the pin, don't drop it.** Both exact pins (`handlebars`,
   `puppeteer-core`) come from one commit, `f79b02ba` — the KF HTML-to-PDF pipeline, where
   puppeteer-core must match the cached `chrome-headless-shell`. Set `"handlebars": "4.7.9"` and
   keep it exact; regenerate one invoice and one challan to prove the templates still render.

6. **Small fixes.** 3.1 `jsdom` is frontend-only (backend has none; frontend 27.2.0 → 29.1.1).
   The AI settings file is `backend/src/services/ai/ai-settings.service.ts` — line numbers as
   stated, directory was missing. Add to §8: `garment-erp-watcher` rebuilds `frontend/dist` on
   any change under `frontend/src` and **races a manual `npm run build`** — it overwrote a Vite 8
   build with a stale Vite 7 one mid-verification today. Before walking :3000, confirm
   `ls frontend/dist/assets/index-*.js` matches the hash your build just printed.

7. **2.1 backend eslint 10 — install order.** On the frontend, a single
   `npm install eslint@10 …` failed `ERESOLVE`: the *installed* `@typescript-eslint/eslint-plugin@8.46`
   peers `eslint ^8.57 || ^9`, and npm resolves against what is on disk. Install
   `typescript-eslint@8.70.1` first (accepts 9 and 10), then eslint 10. Also
   `eslint-plugin-react-hooks@7` moved its flat preset to `configs.flat['recommended-latest']`
   and the top-level key of the same name became the legacy config, which ESLint 10 rejects
   outright — expect the same class of change from the backend's own plugins.

---

## 12. Phase 1 outcome — 2026-09-22

**Frontend: landed (`cce7e4f8`).** Advisories **12 → 1**; only the lockfile moved (every range
already covered its target). The survivor is `xlsx`, `fixAvailable:false` — Phase 5, not a bump.
Two real type errors came with axios 1.20, which tightened header values to
`string | number | boolean | string[] | AxiosHeaders | null`; both sites assumed a string and were
narrowed at the read. `@playwright/test` 1.63 needs browser build 1243 — run
`npx playwright install chromium` after pulling, or the suite cannot launch.

**Backend: attempted and reverted. Phase 1.1 is NOT the low-risk step this plan assumed.**
`npm update` there produces **2227 typecheck errors**, from two causes:

1. **1655 errors — `@types/express-serve-static-core` 5.1.0 → 5.1.3** retypes `req.query` values
   as `string | string[]`. Roughly a hundred controllers pass `req.query.x` straight into
   `string` parameters. It is a **transitive** of `@types/express`, so pinning it back needs npm
   `overrides`, which CLAUDE.md forbids. The real fix is a query-param helper applied across the
   controllers — its own task, not a dependency sweep. Pinning `@types/express` itself back to
   5.0.3 does **not** help: the caret still resolves the child to 5.1.3.
2. **120 errors — the generated Prisma client.** `@prisma/client` 6.19.1 → 6.19.3 invalidates it,
   and `npx prisma generate` fails with `EPERM … query_engine-windows.dll.node` because the running
   API holds the DLL. Prisma is Phase 3.6 anyway and should not have moved inside Phase 1.

**Sequencing consequence:** re-attempting 1.1 needs the API stopped first — `npm install` also hits
`EBUSY` on `@msgpackr-extract`'s native binding while the API runs. Stop the app, install, generate,
start. Treat backend 1.1 as its own change with a maintenance window, and split it: everything
except `@types/express*` and `prisma`/`@prisma/client` is genuinely low-risk and would still clear
most of the 26 HIGHs.

**zod stays at 4.1.12 on both sides** (rule 1.3): the backend cannot move, so the frontend was held
back to keep the contract aligned.

### What this review did not verify
DeepSeek's serving claim ("already serving V4.1-Flash") beyond the docs page quoted above;
inward-web's Redis usage; nodemailer 8→10 and dotenv 16→18 breaking changes (the plan already
marks both as verify-on-upgrade).
