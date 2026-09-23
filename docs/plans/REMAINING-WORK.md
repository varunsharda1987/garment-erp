# What's left — five steps, in order

> **STATUS: PARKED — not started.** Nothing here has been executed. Pick it up by naming a step
> ("do Step 0"); each is independently shippable and none is time-critical.
>
> Evidence for every claim is in [DEPENDENCY-AUDIT-2026-09-22.md](DEPENDENCY-AUDIT-2026-09-22.md)
> §11–§14. Reviewed 2026-09-22 by a second model — **three original premises were wrong and are
> marked ⚠**; read those before re-deriving anything, they cost a session to find.

## Context

One day of dependency work took advisories from **55 → 25** (frontend 12 → **0**, backend 43 → 23)
across ~25 commits. Everything cheap is done. What remains is three projects, one maintenance
window, and one cheap-but-valuable repair. Evidence behind every claim below is in
`docs/plans/DEPENDENCY-AUDIT-2026-09-22.md` §11–§14.

**This plan was reviewed independently and rewritten.** Three of its original premises were wrong;
they are marked ⚠ where they appear, because a future session will otherwise re-derive them.

**Decided by the owner (2026-09-22):** the Anthropic and Google AI SDKs **stay**. The original
"delete them as dead code" task is cancelled — both are selectable providers in AI Settings, and
deleting the SDKs removes the ability to switch the assistant to Claude or Gemini. Replacement
task: keep them current (Step 0).

**Coordination:** another session is mid-flight on date formatting (`frontend/src/lib/date.ts`,
`backend/src/utils/date.ts`, `CatalogueGenerator.tsx`, `date-range-picker.tsx`). **Step 4 must not
start until that is committed.** Steps 0–3 do not collide.

---

## The order

| # | Step | Why here | Size | Window? |
|---|---|---|---|---|
| 0 | Repair the safety net | Later steps are verified by gates that currently lie | S | no |
| 1 | Infrastructure: Redis + PostgreSQL | One window, both touch ucip. Do before Prisma so that work runs on the final DB | M | ~1 hr |
| 2 | Prisma 6 → 7 | Biggest code change; wants a clean DB and working gates under it | L | no |
| 3 | `req.query` + `@types/express` | Moved AFTER Prisma — see §3 | M | no |
| 4 | Tailwind 3 → 4 | Highest visual risk; blocked on the other session | L | no |

---

## Step 0 — Repair the safety net

1. **CI's frontend TypeScript step checks zero files.** `.github/workflows/test.yml:74` runs
   `npx tsc --noEmit`; `frontend/tsconfig.json:2` is `"files": []`, so it always passes. Change it
   to `npm run type-check` (`frontend/package.json:27`). Real coverage today comes only from
   `smart-check.js --all`.
2. **Seven stale suites run `continue-on-error`, so they protect nothing.** Fix or delete each —
   deleting is more honest than suppressing — then **remove `continue-on-error`** from both jobs.
   - backend: `transaction`, `pagination` (`hasMore` gone; `parseSortParams` now takes a `Request`),
     `jwo-rate-provenance`, `job-work-issuance`. ⚠ The last is **a fixture mismatch, not a domain
     question** — `job-work-issuance.service.ts:334` and `:342` both return codes; the test at
     `:146` sets up the wrong one.
   - frontend: `hooks.test.tsx` (uses the `jest` global Vitest lacks), `Pagination.test.tsx`
     (expects "Previous"/"Next" against an icon-only component), `SearchInput.test.tsx` (debounce
     fake timers).
3. **Keep the AI SDKs current.** `@anthropic-ai/sdk` is 0.69 with ~58 minors published. Bump it and
   `@google/generative-ai`, then switch provider in AI Settings and exercise each once via
   `POST /api/ai/chat`.

**Verify:** both suites green with `continue-on-error` removed; CI typecheck demonstrably fails on
an injected type error.

---

## Step 1 — Infrastructure window (Redis + PostgreSQL together)

Both touch ucip, so they share one announced window rather than two.

### 1a — Redis: mostly not our problem

⚠ **Correction to the original plan: this is not a garment-erp step.** All keys in the instance
(`bull:grn:meta`, `bull:easyecom:meta`, `bull:grn:stalled-check`) belong to ucip, and every client
connection is ucip's — `garment-erp-api` holds none. `redis-kasya.conf` sets `appendonly no` with
no `save`, and no rdb/aof file exists, so **a restart already loses everything today**. ucip's
`grn` poll jobs are re-added by its own worker.

**garment-erp's own action is cleanup, not migration:**
- The **job queue is genuinely dead** — `initializeJobQueue` appears only as its own definition and
  two re-exports (`jobs/index.ts:8`, `queue.ts:338`); the repo says so itself at
  `jobs/handlers.ts:143`. `addJob` already falls back to synchronous execution. Remove it, or wire
  it up; do not leave it half-built.
- ⚠ **Do NOT delete `lib/cache.ts`.** The independent review called it dead; it is not.
  `server.ts:61` calls `initializeCache()`, and `supplier.controller.ts`,
  `cad-planning.controller.ts`, `permission.service.ts` and `services/helpers/cad-status.helper.ts`
  all use it. It is **disabled by configuration** (no `REDIS_*` in `.env`), not dead code.
  Decide deliberately: enable it, or leave it dormant — but it stays.

**The replacement itself is ucip's owner's call.** If it proceeds: Memurai **Developer is not
licensed for production**, and WSL2 services do not auto-start with the PM2 fleet — both rule out
the obvious choices without thought. Install alongside on a different port, point ucip at it,
confirm its `grn` queue drains, then retire `C:\Users\NEW\redis` and remove only that entry from
its own `ecosystem.config.js`. **Never `pm2 delete` anything else** — 13 processes, four businesses.

Only after Redis ≥ 6.2 do `bullmq 6` / `ioredis 6` become available (BullMQ's stated minimum).

### 1b — PostgreSQL 16.2 → 16.15

Same-major, in-place: no dump/restore, no schema change, no Prisma change. Service
`postgresql-x64-16`, PGDATA `C:\Program Files\PostgreSQL\16\data` (5.69 GB), running as
`NT AUTHORITY\NetworkService`.

⚠ **The backup gap is real but narrower than first written.** `pg_dumpall` appears nowhere, so
**cluster globals — roles, passwords, grants — are backed up by nothing**. But per-database daily
tasks already exist for garment-erp, kasya-b2b, harleen, thar-coal, ucip and inward; only
`sales_analysis` (1.4 GB) and `postgres` lack one. So:

1. Run a one-off `pg_dumpall --globals-only` **plus** a `pg_dump -F c` of `sales_analysis` at the
   window. Write to **F: (541 GB) or Z: (3 TB)**, not C: (35.6 GB free).
2. Find who owns `sales_analysis` before assuming it is disposable.
3. Prove the restore on a scratch database before touching the service.
4. Read the 16.3 → 16.15 release notes for any post-update `REINDEX` requirement, and confirm
   `pg_hba.conf` survives the installer (a `.bak-2026-07-27` suggests it has been hand-edited).
5. Stop dependent apps, back up, run the installer, start, `SELECT version()`, then verify **each
   business's app**, not just this one.

**Also fix:** `scripts/backup-to-nas.bat:138` ends in `pause`, so the scheduled task never exits
(last result 267009). Backups are landing, but it is one policy toggle away from silently stopping.

---

## Step 2 — Prisma 6.19.1 → 7.10.0

⚠ **The spike is mostly already answered.** Prisma's v7 guide marks `prisma-client-js` deprecated
but **still supported**, and the earlier probe failed on `url`, not the generator. So the
323-importer fork is closed: keep `prisma-client-js` and the import path is unchanged. Budget an
hour to confirm, with an explicit exit criterion — *`prisma generate` succeeds with `url` removed
and `prisma-client-js` retained* — not an open-ended investigation.

**The work, in `backend/src/config/database.ts:25-37`:**
- `datasources: { db: { url } }` is removed in v7 → `new PrismaClient({ adapter: new PrismaPg(pool) })`.
  `PrismaPg` accepts `pg.Pool | pg.PoolConfig | string` in 7.10.0.
- The URL carries `connection_limit=20&pool_timeout=30&connect_timeout=10` (:25-27). **These are
  Prisma-engine-only; the adapter ignores them.** Pooling must move to
  `new Pool({ max: 20, connectionTimeoutMillis: 10000 })`. Silently losing the pool cap is the
  likeliest way to hurt production here.
- Add `@prisma/adapter-pg@7.10.0` and `@types/pg` (`pg@8.23.0` is already a dependency).
- Re-verify the test-only Proxy in `utils/prisma-test-guard.ts` still intercepts
  `delete/deleteMany/update/updateMany/upsert` against v7's client.

**Two things the original plan missed:**
- ⚠ **The v7 CLI no longer auto-loads `.env`.** Without `import 'dotenv/config'` at the top of
  `prisma.config.ts`, `scripts/deploy.js:125` (`migrate deploy` — the production path) and
  `scripts/hooks/pre-migration.js:184` (`migrate status`) run with no `DATABASE_URL`.
- ⚠ The tally is **~120 files** with `new PrismaClient(`, not 99 — 19 root-level `backend/*.js`
  and `seed-admin.ts` were missed. Export a shared factory from `database.ts` rather than repeating
  Pool wiring; `workOrder.controller.ts:19` is only a comment.

**Genuinely easy:** `$use(` and `$extends(` are both **0 occurrences**, so v7's middleware removal
is a non-issue. Tests share the app singleton (`__tests__/helpers/test-utils.ts:18-20`), so wiring
`database.ts` covers them. The frontend imports `@prisma/client` **nowhere**.

**Also update:** `postinstall`, `scripts/deploy.js:125-126`, `pre-migration.js:184`, the codegen
agents under `scripts/{agents,skills}`, and `deployment/synology/backend/Dockerfile:22`.

**Verify:** `npx prisma migrate status` clean against 72 migrations; `tsc --noEmit` 0;
`persistence-smoke.test.ts` green — **note it runs against the live DB, so take the Step 1 dump
first**; exercise `$transaction` (201 uses) and `dispatch.controller.ts:155`, which uses the **call
form** `$executeRaw(...)` rather than the tagged template.
⚠ **Drop `embedding.service.ts:284` as a target — pgvector is not installed** and that path is
gated behind `embeddingService.isInitialized()`.
⚠ **Add a date round-trip.** This box is IST, the adapter swaps in `pg`'s own type parsers, the
schema uses `@db.Date`, and `afb2deb9` recently fixed a "defaults to yesterday before 05:30" bug.
Off-by-one-day is the likeliest silent regression. Save a date, read it back, render it in a PDF.

**Rollback:** reinstall 6.19.1 and re-run `prisma generate` — both need the API stopped (EPERM on
the query-engine DLL). **Do not** jump to 8.x; `latest` is `8.0.0-rc.15`, `prev` is 7.10.0.

---

## Step 3 — `req.query` and `@types/express`

⚠ **Moved after Prisma, and deliberately narrowed.** The original plan put this first to "unblock"
`@types/express`. It doesn't: with `prisma-client-js` retained, Prisma touches `database.ts` and
scripts — not controllers — so there is no overlap to protect, and `@types/express` staleness is
types-only with no runtime or security effect.

`@types/express-serve-static-core` 5.1.3 retypes `req.query` values as `string | string[]`,
producing **1,655 errors across ~100 controllers**. It is a transitive, so it cannot be pinned back
without npm `overrides` (forbidden by CLAUDE.md).

**Do not run a blanket codemod.** A helper returning `string | undefined` creates *new* type errors
wherever the callee wants a non-optional `string`, so each site is a judgement call. Instead:

1. Add `qp(v: unknown): string | undefined` / `qpNum(...)` near
   `backend/src/middleware/pagination.middleware.ts`. ⚠ There is **no existing convention to
   reuse** — that file uses bare `as string` casts at `:89, :95, :189`.
2. **Drive the rewrite from the `tsc` error list**, controller by controller, in reviewable
   batches. The error list is the work queue; anything it doesn't flag, don't touch.
3. Grep first for controllers that *deliberately* want the array form (`?status=A&status=B`).
   Assume at least one exists.
4. Only when the count reaches 0: `npm install -D @types/express@latest`.

**Verify:** `tsc --noEmit` 0; `route-write-guard` and `persistence-smoke` green; spot-check list
endpoints with repeated params to confirm the first value is taken, not `"A,B"`.

---

## Step 4 — Tailwind 3.4 → 4.3

**Blocked until the other session's date work is committed.**

⚠ **The original premise was wrong.** `bg-info/15` (844 sites) does **not** break: `--info` is a
bare HSL triplet, and `hsl(var(--info))` resolves to a real colour, so v4's `color-mix()` works
fine. Converting the triplets is shadcn tidy-up, **not** a prerequisite.

**The actual hazard is radius and shadow.** `index.css:25-35` declares `--radius-sm: 0.25rem`,
`--radius-md: 0.5rem`, `--radius-lg: 0.75rem`, `--radius-xl: 1rem` and `--shadow-*` on `:root`.
In v4 those names **are** theme namespaces. Today `tailwind.config.cjs:150-156` derives
`borderRadius` from `var(--radius)` (0.5rem) with `calc(± Npx)`, so `rounded-lg` = 0.5rem. The
moment `@config` is dropped, `rounded-lg` silently becomes 0.75rem, `rounded-md` 0.5rem,
`rounded-xl` 1rem — **app-wide, with a green build**. `@theme` must re-pin them to the calc maths.
The `fontSize` block overriding the stock scale (`base` = 0.875rem) is the same class of trap.

**Staged — but the staging only works if the watcher is handled.** ⚠ `garment-erp-watcher`
rebuilds `frontend/dist` on any `frontend/src` change, so a half-ported `index.css` is **served
live on :3000 while you edit**. Do 4b/4c in a git worktree outside the watched path, or stop the
watcher for the duration. Otherwise "independently shippable stages" is theatre.

- **4a — prep on v3 (safe, anytime).** Delete the zero-use config: brand tokens
  (`kasya`/`nihsamah`/`external`), `chart-1..5`, the `spacing` extensions, and the
  `fade-in`/`slide-in-right` animations. Delete `src/App.css` (Vite scaffold, imported nowhere).
  Fix `components.json:7`, which points at `tailwind.config.js` while the file is `.cjs`.
- **4b — install v4, keep the old config** via `@config "../tailwind.config.cjs";`. Swap
  `postcss.config.cjs` to `@tailwindcss/postcss` (autoprefixer becomes redundant; Vite has no
  `css.postcss` block, so PostCSS config is the only lever). ⚠ **`safelist` is ignored by v4** —
  `tailwind.config.cjs:210-223` must become `@source inline(...)` **here, not later**, because
  `Dashboard.tsx:42` builds class names dynamically.
- **4c — port tokens to `@theme`**, re-pinning radius/shadow/fontSize explicitly, then drop
  `@config`. Walk the app.
- **4d — leftovers.** The `@layer utilities` block at `index.css:346-389` is plain CSS, not
  Tailwind utilities. ⚠ Don't delete it wholesale: `.scrollbar-thin` (:379-388) has no Tailwind
  equivalent — keep it as `@utility`; `.font-display`/`.font-sans` (:370-371) collide with v4's
  generated utilities and need `--font-display` in `@theme`. Swap `tailwindcss-animate` →
  `tw-animate-css` (maintained v4 port, same class names) — it is load-bearing for
  `animate-in`/`animate-out` (**23 uses**), not the two accordion classes. Fix `.focus-ring`
  (:340-343): in v4 `outline-none` means `outline-style: none`; the intent is `outline-hidden`.

**Walk for v4's default changes, not just our tokens:** focus rings go 3px → 1px, `hover:` becomes
gated behind `@media (hover:hover)` (affects tablet users), and buttons lose `cursor: pointer`.
Compare against screenshots taken **before 4b** on dense screens (Sale Orders, CAD Planning, Cost
Sheet). Confirm the hand edits survive: `popover.tsx` `z-[200]` over a sheet, and `tabs.tsx` active
tab painting `bg-card` (`rgb(253,253,251)`) — both have caught regressions before.

Dark mode has 36 `dark:` uses and **no toggle** — unreachable. Don't spend time on it.

---

## Standing rules every step must respect

- **Never blanket `npm update` in `backend/`** — it pulls `@types/express-serve-static-core` 5.1.3
  and a 2,227-error break. Named packages only until Step 3 is done.
- **Backend dependency work needs the API stopped**: `pm2 stop garment-erp-api` → install →
  `npx prisma generate` → `node C:/Users/NEW/ops/pm2-safe-restart.js garment-erp-api:5000`. The
  `@msgpackr-extract` binding (EBUSY) and the Prisma engine DLL (EPERM) only release when it's down.
- **`garment-erp-watcher` races manual builds.** Confirm `ls frontend/dist/assets/index-*.js`
  matches the hash your build printed before walking `:3000`.
- **Playwright specs log in ONCE per file** — `authLimiter` allows 5 auth requests / 15 min and
  refunds only successes. Pattern: `tests/radix-focus-trap.spec.ts`.
- **Never `pm2 restart all`** — one daemon, 13 processes, four businesses.
- Frontend typecheck is `tsc -b`, never `tsc --noEmit -p tsconfig.json`.
