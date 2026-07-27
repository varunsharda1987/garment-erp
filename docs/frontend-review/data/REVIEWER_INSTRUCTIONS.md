# Stage-1 Reviewer Instructions (Frontend Integration Review)

You review a batch of frontend pages in c:/Users/NEW/garment-erp. READ-ONLY: never edit app code.
Your batch file (docs/frontend-review/data/batches/<batch>.json) contains, per page: its routes, sidebar
flag, inbound edges, outbound navigation (with matchedRoute), and every attributed API call with
`matchedRoute` (null = the call resolves to no backend route) + `hop` (0 = in-page, 1 = its service,
2+ = shared component — shared-component issues will be deduped centrally, still report once).

## Reference truth
- Expected module connections: docs/MODULE_RELATIONSHIPS_GUIDE.md — §8 "Integration Points by Module"
  (your module's card) and §9 "Critical Workflow Integrations"; the 15-stage pipeline: Style → Sample →
  BOM → Costing → Quotation → Order → MRP → PO/GRN → WO → Cutting → Stitching → Finishing → QC →
  Packing → Dispatch/Invoice.
- Serializer: backend/src/utils/serializer.ts (snake_case→camelCase; RELATION_MAPPINGS for custom keys).
  Frontend must read camelCase.
- Live GET probes (optional, GET ONLY, never POST/PUT/PATCH/DELETE):
  `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $(cat docs/frontend-review/data/probe-token.txt)" http://localhost:5000/api/...`
  Interpretation: 401=token problem; 404 on a literal path=route missing; for :id routes use a fake id —
  route-level 404 vs entity-404 differ in body (entity 404 returns JSON with "not found" message).

## EXCLUSIONS — already fixed, never report:
order editing, invoice create/edit UI, cost-sheet create/edit/version/variance, POD recording, sample
creation, embroidery send-out/receive, TDS entry, chart-of-accounts update, delivery-note create page +
ASN prefill, catalogue size filter, stock-levels/stock pages derived repoints (incl. composite-id detail,
policy writes, greige/fabric type filter), the 4 stock transaction forms' array unwrap, document numbering
formats. KNOWN-UNBUILT (report as category=unbuilt, severity=P4, do not call broken): ledger/journal
posting, exchange-rate consumption, e-invoice/e-way-bill, generic-material-type UI.

## Per-page dossier (EVERY page gets a verdict, even "OK")
1. ENDPOINT EXISTENCE — for each call with matchedRoute=null: read the target route file/controller to
   confirm truly absent (vs join-parser miss — if parser miss, say so, category none). Optionally GET-probe.
2. RESPONSE-FIELD REALITY — for the page's PRIMARY list/detail query only: fields the JSX/columns read vs
   what the controller select/include + serializer actually return. Flag always-undefined fields /
   always-empty relations. Hunt `catch { setX([]) }` patterns masking failed calls as empty lists.
3. OUTBOUND NAV — outboundNav entries with matchedRoute=false → dead link. For query-param handoffs,
   check the TARGET page actually reads that param (searchParams.get).
4. INBOUND REACHABILITY — no sidebar + no inbound edges + not a detail/form page reached via its list →
   orphan-page finding (the 6 known-dead pages: TemplateManager, CostSheetPOGenerationPage, MRPDashboard,
   MaterialRequirementsList, ServiceRequirementsDashboard, ServiceRequirementsList — report each ONCE as
   orphan-page with a keep-or-delete recommendation, severity P3).
5. INTEGRATION GAPS — what the module card/pipeline says this page's module must connect to, but the page
   doesn't surface (no link/panel/param). MUST cite the guide section (e.g. "§8.4 Order card: triggers
   MRP"); a gap claim without a citation must be confidence=low.
6. DEAD UI — buttons/handlers wired to nothing or to absent endpoints; TODO/disabled stubs; panels fed by
   state that nothing populates.
7. unresolvedCalls listed in your batch file: resolve them by reading the code (the parser refused to
   guess); if the built URL targets a missing route, that's a finding.

## Finding schema (return via StructuredOutput)
{ id: "<batch>-NN", page, route, category: dead-endpoint|wrong-path|field-mismatch|dead-nav|orphan-page|
  integration-gap|dead-ui|param-handoff|unbuilt, severity: P0|P1|P2|P3|P4,
  evidence: { frontend: "file:line + 1-line snippet", backend: "file:line or no-route", probe: "404|200|n/a" },
  expected, actual, fix (one line), confidence: high|medium|low, liveCheck: suggested|not-needed }
Severity: P0 = breaks a canonical daily flow (order→dispatch pipeline); P1 = silent wrong data shown/saved;
P2 = dead link/endpoint off the daily path; P3 = cosmetic/orphan; P4 = unbuilt.
RULE: P0/P1 with confidence=low is forbidden — downgrade or mark liveCheck=suggested.
Also return pageStatus: one line per page ("OK" or "N findings") — coverage proof.
