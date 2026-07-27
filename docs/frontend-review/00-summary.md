# Frontend Integration Review — Summary

**What this is:** the first page-level integration audit of the ERP frontend. Every one of the **205 pages**
was reviewed against a purpose-built call-graph (all **2,222 API calls** joined to the **1,193 backend
endpoints**, plus every navigation edge), against the module-relationship documentation (what each page
*should* connect to), and **151 pages were additionally walked live in a real browser**. All P0/P1 and
every below-high-confidence finding was then **independently re-verified by adversarial reviewers**
(50 of 51 challenged findings confirmed; 1 refuted; 4 severities adjusted).

## Bottom line

**168 verified findings** — the backend written-record is largely sound (the earlier bug-hunt fixed that
layer), but the frontend has a thick layer of *wiring rot*: pages that call endpoints that don't exist,
read fields the API doesn't return (rendering permanent zeros/blanks), silently drop what you type
(schemas strip it), or link to nowhere.

| Severity | Count | Meaning |
|---|---|---|
| **P0** | 3 | breaks a daily production flow (stitching receive, finishing receive, handwork/smocking send-out) |
| **P1** | 38 | silent wrong data shown or saved |
| **P2** | 74 | dead links/endpoints off the daily path |
| **P3** | 53 | cosmetic, stubs, orphan pages |
| **P4** | 1 | unbuilt feature (recorded, not "broken") |

## The headline discoveries

1. **Environment: the backend runs in production mode with a 100-requests-per-15-minutes rate limit.**
   Pages fire 12–92 API calls per load (mood-boards = 92), so a few page loads exhaust the budget and the
   whole app silently returns "too many requests" → empty tables everywhere. This alone can make the app
   feel broken in normal use. (Also: pm2's env overrides `backend/.env`; an expired login renders every
   page empty instead of redirecting to login; the backend restarted twice during the sweep.)
2. **Production floor receive/send flows are hard-broken (the 3 P0s):** stitching receive, finishing
   receive, and handwork/smocking send-out each fail validation on every single submit (wrong/missing
   payload fields vs the Zod schemas).
3. **The external-process module family (handwork / smocking / piece-embroidery) is dead** from enum
   drift: the schema says `PIECE_EMBROIDERY`, the database says `EMBROIDERY_PIECE`; the status enum list
   is from a different model entirely. Dashboards render live-looking but permanently empty tables.
4. **Role dashboards show all zeros:** the stats endpoints return flat partial payloads while the
   Production/Sales/Accounts dashboards expect an envelope — every KPI reads 0, every table empty,
   indistinguishable from an idle business. Users with INVENTORY/PURCHASE/QUALITY roles are redirected
   to unregistered routes and land in a **404 loop straight after login**.
5. **A systemic serializer bug erases `_count`:** the camelizer strips the underscore (`_count` → `count`)
   so every list page reading `_count` (agencies, agents, customers, suppliers, component groups, order
   BOMs…) shows 0 in its count columns regardless of data. One serializer-level fix + reader sweep clears
   a dozen findings at once.
6. **Forms that silently discard what you type:** material supplier prices, user profile edits (including
   password changes!), sample-edit colorways, SPO items, lace supplier links (wiped on every edit save),
   system settings (vanish after first save). All the same disease: the controller/UI evolved, the Zod
   schema didn't, and `validateBody` strips the unknown fields.
7. **Sale Order creation is blocked** (`/customers/search` doesn't exist — the customer dropdown never
   populates) — relevant to the House of Kasya B2B flow's in-ERP counterpart.
8. **GST report screens are wrong:** GSTR-1 crashes on Generate (reads `.summary`, backend sends
   `.totals`); GSTR-3B renders ₹0.00 for outward supplies/ITC while net-payable shows real numbers — an
   internally inconsistent statutory view.
9. **One page crashes outright:** `/materials/new` (empty-string Radix Select value).
10. **Fabric Physical Tests is a fully-built frontend with no backend** — every call 404s; the testing
    dashboard masks it with zeros.

## Coverage & artifacts

- 205/205 pages: per-page verdicts in `data/final-findings.json` (`pageStatus`).
- 160/161 literal routes walked live (`data/route-sweep.json`; 1 crash, 14 routes with genuine failed
  XHRs, 5 with console errors); 79 param routes covered statically (near-empty transactional DB makes
  deep live walks unrepresentative — noted per finding). Live flow proof: color-master create worked
  end-to-end (created + soft-deleted a ZZ-REVIEW row).
- Call-graph: `data/join.json` (rebuild anytime: `node scripts/review/build-call-graph.js`).
- Full findings: [01-findings.md](01-findings.md). Fix plan: [02-roadmap.md](02-roadmap.md).
