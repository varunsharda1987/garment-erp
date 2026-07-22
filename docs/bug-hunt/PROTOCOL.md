# Bug Hunt Protocol — FROZEN (written 2026-07-11, never modify)

Autonomous 5-day read-only bug hunt over this repo. **The ONLY writable location in the repo is `docs/bug-hunt/`.** Never run git-mutating commands, never start servers, never write to the database (SELECT-only queries allowed for S1 corroboration). User decisions: DOCUMENT ONLY (no fixes applied); read-only DB checks allowed.

## Iteration recipe (execute exactly ONE per wakeup)

1. Read `docs/bug-hunt/state.json`.
2. If `budget.backoff_until` > now, OR `budget.iterations_by_date[today]` >= `budget.daily_cap` (30): append a `no-op` line to `iterations.log`, ScheduleWakeup(3600, same prompt), END TURN.
3. Git guard: `git status --porcelain | Measure-Object -Line`. If count differs from `git_baseline_dirty_count` (43) beyond growth caused by `docs/bug-hunt/**`: append `ALERT` line to `iterations.log` and to the Run Health section of the report. Continue anyway. NEVER touch git state.
4. If the local date rolled over since the last iteration and yesterday is missing from `digest_done_for`: this iteration is a DIGEST — rewrite the Executive Summary and append a Daily Digest section to `BUG_HUNT_REPORT.md` from `findings.jsonl` + `iterations.log`, add the date to `digest_done_for`, go to step 9.
5. Pick the first queue item with `status=="pending"`, else the first `in_progress` with `attempts < 3`. If none and P6 generators not yet run, run them. If truly none: final digest if missing, then ScheduleWakeup(3600) idle. Mark the chosen batch `in_progress`, `attempts++`, `iteration++`, bump `iterations_by_date[today]`, **write state.json BEFORE doing the work** (tmp file then rename; copy to `state.json.bak` every 10th iteration).
6. REVIEW: spawn 2–4 subagents (`subagent_type: general-purpose`, **model: sonnet**) in ONE parallel block, splitting `batch.targets` among them. Use the Reviewer Prompt Template below with only the batch's `bug_classes` expanded. They must return ONLY a JSON array of candidates.
7. VERIFY: parse candidates (one retry on garbage: "return ONLY JSON"; second failure → batch `failed`, log, move on). Dedupe against `findings.jsonl` (key = file + line±5 + class). If any remain: spawn 1 skeptic subagent (sonnet, max 5 candidates each; 2 skeptics if 6–10) with the Skeptic Prompt Template. Verdicts: CONFIRMED / PLAUSIBLE / REJECTED.
8. PERSIST: append CONFIRMED+PLAUSIBLE findings to `findings.jsonl` (schema below, ids BH-0001…, take `next_finding_seq`); append formatted entries to the matching severity section of `BUG_HUNT_REPORT.md`; set batch `status="done"` with `finding_ids`; write state.json (tmp+rename); append one line to `iterations.log`: `ISO-ts | iter=N | batch=ID | action=review | subagents=K | findings=+M | note`.
9. ScheduleWakeup: 1200s while iteration <= 6, else 2400–3600s. Wakeup prompt, verbatim every time:
   > Read c:\Users\NEW\garment-erp\docs\bug-hunt\PROTOCOL.md and c:\Users\NEW\garment-erp\docs\bug-hunt\state.json, execute exactly ONE bug-hunt iteration per the protocol, then schedule the next wakeup. Never modify any file outside docs\bug-hunt\.

**Cost discipline:** the main loop never opens source files >200 lines — reviewers read them. ≤5 subagents per iteration, all sonnet. Main-loop turn = read state → spawn → parse → append → schedule.

**Limit handling:** any subagent/API failure matching `rate|limit|overloaded|429|exceeded` → set `budget.last_limit_error_at`, `consecutive_limit_errors++`, `backoff_until = now + 1h × min(consecutive,5)` (enforced across repeated 3600s no-op wakeups). Batch stays `in_progress` (idempotent rerun). A fully successful iteration resets the counter to 0. Two consecutive limit-hit iterations → skip one extra work turn.

## Severity + verification bar

- **S1** data/money corruption · **S2** wrong results or unvalidated writes · **S3** user-visible errors/staleness · **S4** latent (type errors, dead code).
- **CONFIRMED** = skeptic re-traced the full path (route→controller→service→Prisma, or component→hook→API), quoted the defect line, searched for and failed to find compensation (caller `$transaction`, middleware validation, schema constraint, serializer mapping, react-query defaults), and stated concrete trigger + damage.
- **PLAUSIBLE** = trace sound but one hop statically unresolvable. REJECTED never enters the report.
- S1-only optional corroboration: `node mcp-servers/database-server/index.js counts` / `validate` (read-only, from repo root, needs live DB) — ONE attempt, failure non-fatal, never retried. Set `db_checked: true`.

## findings.jsonl schema (one JSON object per line, append-only)

```json
{"id":"BH-0001","severity":"S1","status":"CONFIRMED","class":"atomicity",
 "file":"backend/src/services/fabric-stock.service.ts","line":110,
 "title":"...","scenario":"concrete trigger -> concrete damage",
 "trace":["hop1","hop2"],"evidence":["quoted line"],
 "skeptic_verdict":"...","discovered_iter":4,"verified_iter":4,
 "duplicate_of":null,"db_checked":false}
```

## Reviewer Prompt Template

```
You are a READ-ONLY code reviewer hunting PRE-EXISTING bugs in a garment ERP
(Express+Prisma+Zod backend, React+Vite frontend). Do NOT edit any file.
Read these targets fully: <absolute paths / line ranges>
Optional context: c:\Users\NEW\garment-erp\docs\bug-hunt\checker-output\<relevant .txt>
Check ONLY these bug classes: <expand only the batch's classes from the list below>
Output: ONLY a JSON array (no prose). Each element:
{"class":"...","file":"repo-relative","line":N,"severity":"S1|S2|S3|S4",
 "title":"...","scenario":"concrete trigger + concrete damage",
 "trace":["hop1","hop2"],"evidence":["quoted line(s)"],"confidence":"high|medium"}
Rules: every finding needs a quoted evidence line; no speculation, no style
nits, no missing-feature complaints; empty array if nothing found.
Severity: S1 data/money corruption, S2 wrong results or unvalidated writes,
S3 user-visible errors/staleness, S4 latent.
```

### Bug classes (expand per batch)

1. **atomicity** — multi-table writes with no `prisma.$transaction`; a `tx` param accepted but passed `undefined`/dropped mid-chain; partial failure leaves `stock_levels` ≠ specialized table/movement ledger.
2. **material-sync** — every quantity mutation must call `syncStockLevelQuantity` in the same tx with correct UOM (METER/KG/PCS) and delta sign; `ensureMaterialRecord` before create.
3. **zod-drift** — controller reads `req.body` fields absent/optional in the zod schema; schema fields silently stripped; route missing `validateBody` (cross-check `checker-output/route-validation.txt`).
4. **serializer** — response keys/relations missing from RELATION_MAPPINGS in `backend/src/utils/serializer.ts`; custom response keys that bypass mappings; frontend consuming a key the serializer renames.
5. **route-order** — literal routes (`/search`, `/export`, `/bulk`, `/stats`) registered AFTER `/:id` in the same router.
6. **money-math** — `parseFloat`/`Number()`/float arithmetic on Prisma.Decimal amounts; float accumulation; `toFixed`-as-rounding; GST percent rounding order.
7. **race** — check-then-write without tx or unique constraint (availability check then decrement; findFirst-then-create; `max+1` document numbering for invoice/GRN/PO codes).
8. **error-swallow** — empty catch; catch that logs then returns success on a WRITE path; missing `await` (esp. in loops/map); floating promises.
9. **dead-stub** — handlers that pretend success but do nothing; unreachable branches; TODO returns.
10. **fe-camelCase** — (frontend) property access on snake_case API keys (real relation names like `.brand_categories`, not library calls like `XLSX.utils.book_new`).
11. **rq-invalidate** — (frontend) `useMutation` onSuccess missing `invalidateQueries` for every list/detail key the mutation affects; wrong key shape.
12. **form-state** — derived totals not recomputed in edit mode; fetched data clobbered by defaultValues; controlled/uncontrolled flips; `Number('')`→0 silently; unit-conversion drift vs backend.

## Skeptic Prompt Template

```
You are a skeptic. For each candidate bug below, try to KILL it: find the
compensating mechanism — a $transaction wrapper in a caller, middleware
validation on the route, a serializer RELATION_MAPPINGS entry, a DB unique
constraint in backend/prisma/schema.prisma, react-query defaults, an
upstream guard. READ the actual files; do not trust the candidate's trace.
Verdict per candidate:
CONFIRMED  = trace holds end-to-end, no compensation found (say what you searched).
PLAUSIBLE  = holds but one hop depends on runtime config/dynamic dispatch.
REJECTED   = compensation found — name file:line.
Return ONLY a JSON array: [{"idx":0,"verdict":"CONFIRMED","reason":"..."}]
Candidates: <JSON array>
```

## P6 generators (run when P0–P5 queue exhausted)

- **P6-GEN-SVC:** Glob `backend/src/services/**/*.service.ts`, subtract files already covered by P1/P3 batches and `finding` targets; group remaining (~85) into domain clusters of 4–5 (costing, GST/tax, processing, lace, masters, orders, AI, infra); append batches `P6-S1..` to queue with classes [atomicity, zod-drift, money-math, race, error-swallow, dead-stub]. Include `backend/src/jobs/handlers.ts` (stub no-ops at :84 :117 :349) and stray `backend/src/services/style.service.ts.tmp`.
- **P6-GEN-PAGES:** Glob `frontend/src/pages/**/*.tsx`, subtract P4 targets; order mutation-heavy first (Form/StockEntry/Receive/Detail-with-actions, then Lists); batches of 6–8 as `P6-P1..` with classes [fe-camelCase, rq-invalidate, form-state, serializer]. Reviewers get `checker-output/frontend-tsc.txt` + `cheap-greps.txt` paths for their files.

## Report format

`BUG_HUNT_REPORT.md` sections: Executive Summary (severity × confirmed/plausible table + top-5 list; REWRITTEN each digest) · S1..S4 sections (append per finding: file:line, class, scenario, trace, evidence, skeptic notes, **Fix direction (NOT applied)**) · Coverage table (from queue) · Daily Digests (append) · Run Health (backoffs, failed batches, ALERTs).

## Failure modes

- Session killed → state written before work; rerun `in_progress` batch (idempotent, deduped).
- Garbage subagent output → one retry, then batch `failed`, move on.
- state.json corrupt → restore `.bak`, else rebuild queue from this file + scan findings.jsonl/iterations.log.
- Report mangled → regenerate from findings.jsonl.
- DB unreachable → skip corroboration, findings stay code-trace-verified.
