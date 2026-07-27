# Frontend Integration Review — Findings (verified)

_205/205 pages reviewed; every P0/P1 and sub-high-confidence finding independently re-verified from source. Evidence cites file:line._

| Severity | Count | Meaning |
|---|---|---|
| P0 | 3 | breaks a daily production flow |
| P1 | 38 | silent wrong data shown or saved |
| P2 | 74 | dead link/endpoint off the daily path |
| P3 | 53 | cosmetic / orphan |
| P4 | 0 | unbuilt feature |

## P0 (3)

### B06-01 — Field mismatch (silent wrong data)
- **Page:** StitchingDetail.tsx (/manufacturing/stitching/:id)
- **Expected:** 'Receive from Cutting' moves a stitching issue PENDING_RECEIPT → RECEIVED so Start Stitching becomes possible
- **Actual:** Every receive click from BOTH StitchingDetail and StitchingList sends an empty-string transferSlipId that fails uuid validation → 400 'Invalid request data'; issues are permanently stuck in PENDING_RECEIPT, blocking the canonical Cutting → Stitching pipeline in the UI
- **Evidence:** frontend StitchingDetail.tsx:119 `transferSlipId: '', // Backend should handle this` (also StitchingList.tsx:150 sends `{ transferSlipId: '', skuReceived: [] }`) | backend schemas/production.schema.ts:258 `transferSlipId: z.string().uuid()` REQUIRED (+ :267 skuReceived .min(1)); routes/stitching.routes.ts:74-79 validateBody hard-400s; controllers/stitching.controller.ts:490 receive gated on PENDING_RECEIPT, :563 start requires RECEIVED, :350 issues created as PENDING_RECEIPT
- **Fix:** Send the real consumed transfer-slip id (issue's slips are in scope) or make transferSlipId optional in receiveFromCuttingSchema to match the controller's `if (transferSlipId)` guard, and drop the empty-array skuReceived from the list-page call
- **Verified:** CONFIRMED

### B06-02 — Field mismatch (silent wrong data)
- **Page:** FinishingDetail.tsx (/manufacturing/finishing/:id)
- **Expected:** 'Receive from Stitching' moves a finishing issue PENDING_RECEIPT → RECEIVED so finishing can start
- **Actual:** Both FinishingDetail and FinishingList receive calls fail Zod validation twice over (missing receivedQty, non-uuid empty transferSlipId) → 400 every time; finishing issues stuck in PENDING_RECEIPT, blocking Stitching → Finishing progression in the UI
- **Evidence:** frontend FinishingDetail.tsx:115-122 sends `{ transferSlipId: '', skuReceived: [...] }` with NO receivedQty (FinishingList.tsx:147 sends `{ transferSlipId: '', skuReceived: [] }`) | backend schemas/production.schema.ts:344-350 receiveFromStitchingSchema REQUIRES `receivedQty: z.number().int().positive()` and transferSlipId must be uuid when present; routes/finishing.routes.ts:75-80 validateBody; finishing.controller.ts:324 issues created PENDING_RECEIPT, :469 receive gated on PENDING_RECEIPT
- **Fix:** Send receivedQty (sum of skuReceived) and omit the empty transferSlipId, or realign receiveFromStitchingSchema with the skuReceived payload shape the pages actually send
- **Verified:** CONFIRMED

### B11-01 — Field mismatch (silent wrong data)
- **Page:** HandworkSendOut.tsx (/manufacturing/handwork/send-out)
- **Expected:** POST /api/external-process/send-out accepts the SKU rows the three send-out forms build ({colorId, sizeId, sentQty})
- **Actual:** Zod requires sizeName+quantity which no form sends, so every send-out with a SKU table (all Handwork, all Smocking cutting-batch, all EmbroideryPiece submissions — totalQty>0 requires SKU rows) returns 400 'Invalid request data'; creation of external-process send-outs is impossible from the UI
- **Evidence:** frontend HandworkSendOut.tsx:175-181 skus map `{colorId, sizeId, sentQty}`; same at EmbroideryPieceSendOut.tsx:180-182 and SmockingSendOut.tsx:206-215 | backend schemas/externalProcess.schema.ts:37-42 sendOutSkuSchema requires `sizeName: z.string()` and `quantity: int` (neither sent); controller/service read sku.sentQty (external-process.service.ts:232-237); validateBody at external-process.routes.ts:42-46
- **Fix:** Rewrite sendOutSkuSchema to { colorId: uuid?, sizeId: uuid, sentQty: int positive } to match controller/service DTO
- **Verified:** CONFIRMED

## P1 (38)

### B02-01 — Field mismatch (silent wrong data)
- **Page:** LaceForm.tsx (/materials/lace/:id/edit)
- **Expected:** Edit form pre-loads the lace's existing supplier links and preserves them on save
- **Actual:** Supplier links never load into the form; saving any edit sends suppliers:[] which delete-and-recreates to nothing — ALL supplier links for that lace are silently wiped on every edit save
- **Evidence:** frontend LaceForm.tsx:111-121 `if (lace.laceSuppliers && ...) setSuppliers(...)` — API key is `suppliers` (serializer RELATION_MAPPINGS serializer.ts:320 maps laceSuppliers→'suppliers'), so existing suppliers never load; onSubmit line 178 always sends `suppliers: validSuppliers` ([] when none loaded) | backend lace.controller.ts:621-637 updateLace: `if (suppliers !== undefined && Array.isArray(suppliers))` → lace_suppliers.deleteMany then createMany only if length>0; updateLaceSchema (trimMasters.schema.ts:400,413) passes `suppliers` through
- **Fix:** Read `lace.suppliers` (serialized key) in LaceForm (and update lace.types.ts:105), or only send `suppliers` when the user touched the supplier section
- **Verified:** CONFIRMED

### B02-02 — Field mismatch (silent wrong data)
- **Page:** LaceDetail.tsx (/materials/lace/:id)
- **Expected:** Detail page shows the lace's linked suppliers
- **Actual:** `lace.laceSuppliers` is always undefined — the Suppliers section always shows (0)/empty even when supplier links exist
- **Evidence:** frontend LaceDetail.tsx:197-221 `Suppliers ({lace.laceSuppliers?.length || 0})` and `lace.laceSuppliers.map(...)` | backend getLaceById includes lace_suppliers (lace.controller.ts:464); serialize(): lace_suppliers→laceSuppliers→RELATION_MAPPINGS 'suppliers' (serializer.ts:320,532-535)
- **Fix:** Read `lace.suppliers` in LaceDetail (align lace.types.ts)
- **Verified:** CONFIRMED

### B01-01 — Wrong API path
- **Page:** FabricForm.tsx (/fabric/new, /fabric/:id/edit)
- **Expected:** Selecting a component in the Allocate-Fabric-to-Style modal lists that component's pattern parts for selection
- **Actual:** Call 404s (wrong prefix /component-masters vs /components); catch masks it so the pattern-part list is always empty; even with the path fixed, reading .patternParts instead of .data yields []
- **Evidence:** frontend frontend/src/services/fabricGreigeService.ts:268 `api.get(`/component-masters/${componentMasterId}/pattern-parts`)` called from components/fabric/AllocateFabricToStyleModal.tsx:127; catch at :129-131 does setPatternParts([]) | backend no-route: only /api/components/:componentId/pattern-parts exists (backend/src/routes/index.ts:235 + componentPatternPart.routes.ts:14); controller returns {success,data} (patternPart.controller.ts:174-177) while frontend reads response.data.patternParts (fabricGreigeService.ts:267-270)
- **Fix:** Change fabricGreigeService.getPatternPartsForComponent to GET /components/${componentMasterId}/pattern-parts and read response.data.data
- **Verified:** CONFIRMED

### B03-01 — Field mismatch (silent wrong data)
- **Page:** ComponentGroupMaster.tsx (/component-groups)
- **Expected:** Components column shows the real number of component masters in each group (e.g. 7 for TOP)
- **Actual:** `group._count` is always undefined after serialization, so the Components column shows 0 for every group
- **Evidence:** frontend frontend/src/pages/ComponentGroupMaster.tsx:269 — `<Badge>{group._count?.components || 0}</Badge>` | backend backend/src/services/componentGroup.service.ts:68-72 includes `_count.select.components`, but backend/src/utils/serializer.ts camelize converts key `_count` → `count` (no RELATION_MAPPINGS entry for _count)
- **Fix:** Read `group.count?.components` in ComponentGroupMaster.tsx (and align ComponentGroup type in frontend/src/types/componentGroup.types.ts)
- **Verified:** CONFIRMED

### B04-01 — Field mismatch (silent wrong data)
- **Page:** AgencyList.tsx (/agencies)
- **Expected:** List pages show real related-record counts (Agents / Customers / Orders / Quotations / Invoices / POs)
- **Actual:** Serializer strips the underscore, so every `_count` read is undefined: AgencyList and AgentList display hard-coded 0, CustomerList and SupplierList Stats columns render blank - regardless of actual data
- **Evidence:** frontend AgencyList.tsx:192 `{agency._count?.agents || 0}`; AgentList.tsx:200 `{agent._count?.customers || 0}`; CustomerList.tsx:232 and SupplierList.tsx:222 `_count && ...` | backend backend/src/utils/serializer.ts:133-141 humps.camelizeKeys renames `_count`->`count` (process option only preserves UUID keys); RELATION_MAPPINGS also remaps inner keys (agents probe shows count:{customer:0} for _count.customers)
- **Fix:** Special-case `_count` in serializer.ts toCamelCase (preserve key verbatim and skip RELATION_MAPPINGS inside it), or repoint all frontend reads to `count` with backend key names
- **Verified:** CONFIRMED

### B05-01 — Field mismatch (silent wrong data)
- **Page:** EmbroideryAvailableStock.tsx (/embroidery-stock)
- **Expected:** Embroidered Stock tab lists AVAILABLE fabric_stock rows with embroideryId set, showing fabric code/name, design, qty, cost, for-style
- **Actual:** Request always fails 400 (invalid stockType enum), catch masks it as empty -> tab permanently shows 'No embroidered fabric stock found'; even if the call passed, the mapped response lacks every field the tab reads (embroideryId filter at line 85 would still yield [])
- **Evidence:** frontend EmbroideryAvailableStock.tsx:79-88 `api.get('/stock?status=AVAILABLE&stockType=EMBROIDERED')` wrapped in `catch { setEmbroideredStock([]) }`; lines 657-681 read stock.fabricMaster/embroidery/forStyle/embroideryId | backend fabric-stock.controller.ts:38 StockListQuerySchema stockType enum ['PLANNED_STOCK','EXCESS_MOQ','CROSS_STYLE_REUSE'] (no EMBROIDERED); listStock response map lines 316-368 exposes `fabric` not `fabricMaster` and no embroideryId/embroidery/forStyle keys
- **Fix:** In listStock accept an embroidered filter (embroideryId != null), include embroidery relation, and expose fabricMaster/embroidery/forStyle/embroideryId in the map (or point the tab at /embroidery-stock/by-style style endpoints)
- **Verified:** CONFIRMED

### B05-02 — Field mismatch (silent wrong data)
- **Page:** StyleFormRedesigned.tsx (/styles/:id/edit)
- **Expected:** Edit mode loads the style's saved SKU variants; saving preserves them
- **Actual:** Variants never load (undefined key), form shows default size rows with blank SKUs; on save the backend deletes the real variants and recreates auto-generated `styleCode+size` ones - custom SKUs/barcodes/sizes are silently destroyed on every edit-save
- **Evidence:** frontend StyleFormRedesigned.tsx:1125 `const skuVariantsData = (styleData.variants || [])` but API key is styleVariants; state defaults to DEFAULT_SIZES (line 392-399); save always sends skuVariants with auto-generated SKUs (lines 2029-2032, 2160) | backend serializer.ts:239 `styleVariants: 'styleVariants'` (never emits 'variants'); style.service.ts:1055-1071 update does style_variants.deleteMany + recreate whenever skuVariants present
- **Fix:** Read styleData.styleVariants (or add serializer mapping styleVariants -> variants) so edit mode round-trips existing variants
- **Verified:** CONFIRMED

### B05-03 — Field mismatch (silent wrong data)
- **Page:** MaterialMasterForm.tsx (/material-master/new)
- **Expected:** The whole Pricing card (5 price fields) and currency persist on create/update
- **Actual:** Zod strips all pricePer* + currencyId before the controller -> materials always saved with NULL prices; MaterialMasterList price column shows '-' for anything created via this form
- **Evidence:** frontend MaterialMasterForm.tsx:26-41,209-287 collects pricePerUnit/pricePerMeter/pricePerPiece/pricePerKg/pricePerGross (+currencyId in DTO) and submits via materialMasterService.create/update | backend schemas/materialMaster.schema.ts:57-95 create/update schemas define only `price` (a field nothing reads) and none of the pricePer* fields or currencyId -> validateBody (validation.middleware.ts:28 req.body = schema.parse) strips them; material-master.service.ts:94-100,136-142 writes data.pricePerMeter etc. (columns exist, schema.prisma:33-39)
- **Fix:** Add pricePerUnit/pricePerMeter/pricePerPiece/pricePerKg/pricePerGross/currencyId to createMaterialSchema and updateMaterialSchema in materialMaster.schema.ts (and drop unused `price`)
- **Verified:** CONFIRMED

### B05-04 — Field mismatch (silent wrong data)
- **Page:** MaterialForm.tsx (/materials/new)
- **Expected:** Supplier price, lead time, MOQ, MOQ unit save with the material-supplier link
- **Actual:** Nested Zod schema silently strips supplierPrice/leadTimeDays/moq/moqUnit/isPrimary on both create and update -> fields always saved NULL and reload empty in edit mode
- **Evidence:** frontend MaterialForm.tsx:499-553 per-supplier inputs Supplier Price / Lead Time / MOQ / MOQ Unit; payload line 266 `suppliers: materialSuppliers` | backend schemas/material.schema.ts:11-16 materialSupplierSchema = {supplierId,isPreferred,isActive,notes} only (default Zod strip on nested objects); material.controller.ts:13-23,74-78 SupplierInput expects and writes supplierPrice/leadTimeDays/moq/moqUnit/isPrimary (columns exist, schema.prisma material_suppliers:2787-2791)
- **Fix:** Extend materialSupplierSchema with supplierPrice/leadTimeDays/moq/moqUnit/isPrimary (nullable optionals)
- **Verified:** CONFIRMED

### B05-05 — Field mismatch (silent wrong data)
- **Page:** EmbroideryList.tsx (/embroidery)
- **Expected:** Usable width after embroidery (the CAD-planning cuttable width) displays in list/detail and pre-fills the edit form
- **Actual:** usableWidthAfter is always undefined: list column always '-', detail's flagship 'Usable Width After Embroidery' renders blank, and edit mode loads the REQUIRED field empty so every edit-save is blocked until the user re-types the width
- **Evidence:** frontend EmbroideryList.tsx:144 `item.usableWidthAfter ? ... : '-'`; EmbroideryDetail.tsx:199 `{embroidery.usableWidthAfter}"`; EmbroideryForm.tsx:106 setValue('usableWidthAfter', embroidery.usableWidthAfter...) then onSubmit line 135 blocks save when empty | backend embroidery.controller.ts:14-22 serializeEmbroidery returns cutableWidth only; schema.prisma embroidery_master:2166 has cutableWidth, no usableWidthAfter column; API never emits usableWidthAfter
- **Fix:** Add `usableWidthAfter: cutableWidth` alias in serializeEmbroidery (or switch the three pages to read cutableWidth)
- **Verified:** CONFIRMED

### B07-01 — Dead endpoint
- **Page:** LaceStockDetail.tsx (/lace-stock/:id)
- **Expected:** Detail page loads stock + allocations + transactions
- **Actual:** getStockAllocations 404s inside Promise.all, the shared catch fires, stock stays null and the page renders 'Stock not found' for EVERY valid stock — the whole detail page is broken
- **Evidence:** frontend frontend/src/pages/LaceStockDetail.tsx:75-88 — Promise.all([getLaceStockById, getStockAllocations, getStockTransactions]) with single catch; service laceStock.service.ts:108 GET `${BASE_URL}/${stockId}/allocations` | backend backend/src/routes/laceStock.routes.ts — no GET /:id/allocations route (only /:id, /:id/transactions, /available/:laceId)
- **Fix:** Read allocations from the getLaceStockById response (backend service already includes allocations, laceStock.service.ts:213-232) or add the GET /:id/allocations route
- **Verified:** CONFIRMED

### B08-01 — Wrong API path
- **Page:** PurchaseOrderForm.tsx (/procurement/purchase-orders/new)
- **Expected:** Selecting a style component in the Allocate-Fabric-to-Style modal loads that component's pattern parts from component_pattern_parts
- **Actual:** GET /api/component-masters/:id/pattern-parts 404s; the catch converts it to an empty list, so pattern parts always appear empty and allocations save without pattern-part links
- **Evidence:** frontend frontend/src/services/fabricGreigeService.ts:268 `api.get(`/component-masters/${componentMasterId}/pattern-parts`)`; consumed by shared frontend/src/components/fabric/AllocateFabricToStyleModal.tsx:127 with catch{ setPatternParts([]) } at :129-131 masking the failure | backend backend/src/routes/componentMasters.routes.ts:27-47 has only /, /categories, /:id — no /:id/pattern-parts; the real route is mounted at /components/:componentId/pattern-parts (backend/src/routes/index.ts:235)
- **Fix:** Change fabricGreigeService.getPatternPartsForComponent to GET /components/${componentMasterId}/pattern-parts (and confirm the response key: it reads response.data.patternParts)
- **Verified:** CONFIRMED

### B08-02 — Field mismatch (silent wrong data)
- **Page:** UnifiedRequirementsPage.tsx (/procurement/requirements)
- **Expected:** Convert-to-Greige-Processing dialog shows greige options like 'Cotton Voile (GRG-0012)'
- **Actual:** Every option in the Greige Fabric dropdown renders 'undefined (undefined)' — the FABRIC→greige+processing conversion flow is unusable by label
- **Evidence:** frontend frontend/src/pages/UnifiedRequirementsPage.tsx:471-477 maps greige list with `name: g.genericName || g.name || g.code, code: g.code`; rendered as `{g.name} ({g.code})` at :954-957 | backend GET /api/fabric-management/greige returns raw greige_master rows (backend/src/controllers/greige.controller.ts:133 serializeGreige spreads fields) whose fields are greigeCode/greigeName/genericGreigeName (backend/prisma/schema.prisma:4025-4026) — no name/code/genericName
- **Fix:** Map g.genericGreigeName || g.greigeName for name and g.greigeCode for code in openConvertGreigeDialog
- **Verified:** CONFIRMED

### B10-01 — Field mismatch (silent wrong data)
- **Page:** DispatchList.tsx (/manufacturing/dispatch)
- **Expected:** Delivery-notes table shows carton count and the customer GRN number/date recorded via POD
- **Actual:** Cartons column is always 0 and Customer GRN column is always '-' for every row: list response has ext:null (no ext include), and even the detail endpoint's ext object omits the cartons relation
- **Evidence:** frontend DispatchList.tsx:328 `{dn.ext?.cartons?.length || 0}` and :331 `dn.ext?.pod?.customerGrnNumber` read from the LIST query | backend dispatch.controller.ts:274 list uses deliveryNoteIncludeOptions (lines 188-199, no delivery_notes_ext) so transformDeliveryNote:60 returns ext:null for every list row; additionally the ext transform (lines 60-66) only exposes {id,pod,transport} — `cartons` is never returned by ANY endpoint
- **Fix:** Use deliveryNoteExtendedIncludeOptions (plus cartons include) in getAllDeliveryNotes and add `cartons` to the ext object in transformDeliveryNote
- **Verified:** CONFIRMED

### B10-07 — Field mismatch (silent wrong data)
- **Page:** ChallanForm.tsx (/manufacturing/challans/new)
- **Expected:** Picking a Challan Date / Expected Date and submitting creates the challan
- **Actual:** PrismaClientValidationError → 500 whenever either date input is filled; creation only works when the fields are left empty (challanDate falls back to new Date())
- **Evidence:** frontend ChallanForm.tsx:135-139 `<Input type="date" value={form.challanDate...}` sends 'YYYY-MM-DD' strings for challanDate/expectedDate | backend schemas/challan.schema.ts:39,54 `challanDate: z.string().optional()` passes the raw string; challan.controller.ts:25-27 spreads req.body; services/challan.service.ts:116,132 hands the date-only string to prisma.challans.create on DateTime columns — Prisma rejects date-only strings (expects ISO-8601 DateTime), so the create 500s whenever a date is picked
- **Fix:** Change challanDate/expectedDate to z.coerce.date() in createChallanSchema (matches the repo's datetime-schema guardrail)
- **Verified:** CONFIRMED

### B09-01 — Field mismatch (silent wrong data)
- **Page:** OrderDetail.tsx (/orders/:id)
- **Expected:** Calculate MRP from Order Detail computes material requirements and navigates to /procurement/requirements
- **Actual:** validateBody rejects the empty body -> every click returns 400 'Invalid request data' (styleId Required); MRP never runs from this page (workaround exists on OrderBOMDetail which passes styleId)
- **Evidence:** frontend OrderDetail.tsx:232 `calculateMRPStandalone(order.id, {})` - empty body from workflow tracker's Calculate MRP button | backend backend/src/schemas/orderBom.schema.ts:134-137 calculateMRPStandaloneSchema requires styleId (z.string().uuid, not optional); backend/src/routes/order-bom.routes.ts:100-104 wires validateBody
- **Fix:** Pass styleId: order.orderItems?.[0]?.styleId in the OrderDetail handleCalculateMRP payload (mirroring OrderBOMDetail.tsx:174-176)
- **Verified:** CONFIRMED

### B09-02 — Field mismatch (silent wrong data)
- **Page:** OrderDetail.tsx (/orders/:id)
- **Expected:** Breakup rows show the actual color and size names
- **Actual:** colors/sizes are always undefined -> every breakup row shows 'N/A' for Color and Size (silent wrong data on the daily order view)
- **Evidence:** frontend OrderDetail.tsx:817-819 reads `breakup.colors?.colorName` and `breakup.sizes?.sizeName` in the Quantity Breakup table; frontend/src/types/order.types.ts:97-104 declares colors?/sizes? | backend backend/src/controllers/order.controller.ts:520-525 includes color_options/size_options which serialize to colorOptions/sizeOptions; backend/src/utils/serializer.ts:236-238 explicitly REMOVED the colorOptions->colors / sizeOptions->sizes mappings
- **Fix:** Change OrderDetail (and order.types.ts OrderItemBreakup) to read breakup.colorOptions/breakup.sizeOptions
- **Verified:** CONFIRMED

### B09-03 — Dead endpoint
- **Page:** SaleOrderList.tsx (/sale-orders)
- **Expected:** Typing 2+ chars lists matching customers so a Sale Order can be created
- **Actual:** Request always 400s ('search' fails uuid validation); useQuery error is not surfaced, the dropdown simply never appears -> a customer can never be selected and in-ERP Sale Order creation is blocked
- **Evidence:** frontend SaleOrderList.tsx:71 `api.get('/customers/search', { params: { search, limit: 20 } })` in the New Sale Order dialog | backend backend/src/routes/customer.routes.ts has no /search route; GET /:id at line 55 catches it with validateParams(customerIdParamSchema) = uuid (customer.schema.ts:293-295)
- **Fix:** Call GET /customers?search=...&limit=20 (customerQuerySchema supports search) and read response.data.data, or add a /customers/search route before /:id
- **Verified:** CONFIRMED

### B09-04 — Field mismatch (silent wrong data)
- **Page:** StockProductionOrderList.tsx (/stock-production-orders)
- **Expected:** New Stock Production Order dialog creates a DRAFT SPO and navigates to its detail page
- **Actual:** Every create attempt fails 400 ('quantity Required'); even if quantity were sent, the schema strips items and the controller then rejects with 'At least one item required' - SPO creation from the UI is impossible
- **Evidence:** frontend StockProductionOrderList.tsx:138-144 create dialog sends { styleId, totalQuantity, targetDate?, remarks?, items: [] } | backend backend/src/schemas/stockProductionOrder.schema.ts:31-40 createSPOSchema requires `quantity` (absent -> Zod 400) and has no items/totalQuantity/targetDate (stripped by validation.middleware.ts:28); controller stockProductionOrder.controller.ts:52-57 additionally throws if items is empty
- **Fix:** Rewrite createSPOSchema to match the controller/frontend contract: { styleId, totalQuantity, targetDate?, priority?, remarks?, items: [{colorId?, sizeId, quantity}] } (allow empty items to match the deferred-items UX, and relax the controller check)
- **Verified:** CONFIRMED

### B09-05 — Field mismatch (silent wrong data)
- **Page:** StockProductionOrderDetail.tsx (/stock-production-orders/:id)
- **Expected:** Add Item appends a size/color breakup row so the SPO can be approved and work orders generated
- **Actual:** Zod silently strips items/totalQuantity -> update is a no-op that still returns 200; toast says 'Item added' but the table stays empty; Approve requires items.length>0 (line 197) so the entire SPO->WO flow is dead. Secondary: the 'No specific color' option sends colorId='none' (line 116 `newItemColorId || null` does not map the sentinel) which will fail uuid validation once the schema is fixed
- **Evidence:** frontend StockProductionOrderDetail.tsx:121-124 and 149-152 updateSPO(id, { items, totalQuantity }) for Add Item / Remove Item | backend backend/src/schemas/stockProductionOrder.schema.ts:46-55 updateSPOSchema has neither items nor totalQuantity (has quantity/sizeBreakdown/colorBreakdown instead); validation.middleware.ts:28 replaces req.body with the stripped parse result; controller update (stockProductionOrder.controller.ts:72-85) then passes items=undefined so service `if (data.items)` skips everything
- **Fix:** Add items[]/totalQuantity/targetDate to updateSPOSchema (matching SPOUpdateInput) and map the 'none' color sentinel to null in the page
- **Verified:** CONFIRMED

### B12-01 — Wrong API path
- **Page:** DebitNoteList.tsx (/debit-notes)
- **Expected:** Typing 2+ chars in the supplier search populates a dropdown of matching suppliers so a debit note can be created
- **Actual:** Every search request returns 400 (invalid UUID param), the catch swallows it, supplierOptions stays [] — the dropdown never shows results, no supplier can be selected, and the Create Debit Note submit stays disabled (line 711 requires selectedSupplier). The entire debit-note creation flow is silently dead.
- **Evidence:** frontend frontend/src/pages/DebitNoteList.tsx:168 `api.get('/suppliers/search', { params: { q: supplierSearch, limit: 20 } })`; line 173 `catch { // ignore abort errors }` swallows ALL errors | backend backend/src/routes/supplier.routes.ts has NO /search route — request falls into line 45 `router.get('/:id', validateParams(supplierIdParamSchema))` where supplier.schema.ts:211-213 requires `id: z.string().uuid()` → 400 for id='search'
- **Fix:** Change DebitNoteList.tsx:168 to `api.get('/suppliers', { params: { search: supplierSearch, limit: 20 } })` (getAllSuppliers at supplier.routes.ts:38 supports search) and unwrap `res.data` accordingly
- **Verified:** CONFIRMED

### B12-02 — Field mismatch (silent wrong data)
- **Page:** GSTReports.tsx (/gst-reports)
- **Expected:** Clicking Generate on GSTR-1 renders summary cards and B2B/B2CS/CDNR/HSN tables with real tax figures
- **Actual:** `gstr1Data.summary` is undefined → TypeError on render, crashing the GSTR-1 tab immediately after generation. Even if the summary key were fixed, every tax column (gstin, cgst, sgst, igst, totalValue, noteNumber, noteDate, value) reads names the backend never sends → formatCurrency(undefined) = '₹0.00' on a statutory report
- **Evidence:** frontend frontend/src/pages/GSTReports.tsx:259 `String(gstr1Data.summary.totalInvoices)` (no optional chaining); rows read `row.gstin`(292), `row.cgst/sgst/igst`(297-299,335-337,414-416), `row.totalValue`(300), `row.noteNumber/noteDate/value`(374-377) | backend backend/src/services/gstReport.service.ts:261-268 returns `{ period, b2b, b2cs, cdnr, hsnSummary, totals }` — key is `totals` not `summary`; entries use `customerGstin`, `cgstAmount/sgstAmount/igstAmount`, `invoiceValue`, `creditNoteNumber`, `creditNoteDate`, `noteValue` (lines 146-199, interfaces 18-56)
- **Fix:** Align GSTReports.tsx GSTR-1 interfaces/reads to the backend shape (summary→totals; gstin→customerGstin; cgst→cgstAmount etc.; totalValue→invoiceValue; noteNumber→creditNoteNumber; noteDate→creditNoteDate; value→noteValue) or add a mapping layer in the fetch handler
- **Verified:** CONFIRMED

### B12-03 — Field mismatch (silent wrong data)
- **Page:** GSTReports.tsx (/gst-reports)
- **Expected:** GSTR-3B tab shows real Outward Supplies taxable value/tax and ITC figures in sections 3.1, 4 and the Output Tax / ITC columns of section 6
- **Actual:** All Outward Supplies and Input Tax Credit cells render '₹0.00' (formatCurrency(undefined), frontend/src/lib/currency.ts:34-36) while Net Payable (netTaxPayable.* which DOES match) shows real numbers — an internally inconsistent statutory summary that looks plausible and is silently wrong
- **Evidence:** frontend frontend/src/pages/GSTReports.tsx:459-468 reads `gstr3bData.outwardSupplies.taxableValue/.cgst/.sgst/.igst`; 496-498, 528, 538, 548, 564-566 read `gstr3bData.inputTaxCredit.cgst/.sgst/.igst` | backend backend/src/services/gstReport.service.ts:335-348 returns `outwardSupplies: { taxable: {taxableValue,cgst,sgst,igst}, exempt, nilRated }` and `inputTaxCredit: { fromPurchases: {cgst,sgst,igst} }` — one nesting level deeper than the page reads
- **Fix:** Read `gstr3bData.outwardSupplies.taxable.*` and `gstr3bData.inputTaxCredit.fromPurchases.*` in GSTReports.tsx (update the local GSTR3BSummary interface to the backend shape)
- **Verified:** CONFIRMED

### B11-02 _(adjusted from P0)_ — Field mismatch (silent wrong data)
- **Page:** HandworkSendOut.tsx (/manufacturing/handwork/send-out)
- **Expected:** Step-1 work-order dropdown lists PENDING + IN_PROGRESS work orders on all three send-out pages
- **Actual:** Request 400s, error swallowed by .catch → dropdown silently empty → Handwork/Smocking/EmbroideryPiece send-out flows cannot even start
- **Evidence:** frontend HandworkSendOut.tsx:84 `api.get('/work-orders?status=PENDING&status=IN_PROGRESS&limit=200')` with `.catch(() => setWorkOrders([]))` (:97); identical at EmbroideryPieceSendOut.tsx:90 and SmockingSendOut.tsx:92 | backend workOrder.controller.ts:46-49 casts `status` to single OrderStatus; workOrder.service.ts:243 `where.status = filters.status` — Express parses the duplicate param as an array, which Prisma rejects
- **Fix:** Support repeated status params (where.status = { in: [...] }) in workOrder controller/service, or have the pages send a comma/single status the backend accepts
- **Verified:** DOWNGRADED

### B11-03 _(adjusted from P0)_ — Field mismatch (silent wrong data)
- **Page:** EmbroideryPieceDashboard.tsx (/embroidery-stock/pieces)
- **Expected:** Embroidery piece-tracking module lists, creates, and receives EMBROIDERY_PIECE send-outs
- **Actual:** 'EMBROIDERY_PIECE' fails the Zod enum: the dashboard table always shows empty (silent 400 behind live-looking summary cards), the receive page's pending dropdown 400s, and POST /send-out 400s — the whole piece-embroidery module is dead
- **Evidence:** frontend EmbroideryPieceDashboard.tsx:56-66 getSendOuts({processType:'EMBROIDERY_PIECE',...}); :83 `sendOuts = sendOutsData?.data || []` renders 'No embroidery piece send-outs found' on error; EmbroideryPieceSendOut.tsx:185 posts processType:'EMBROIDERY_PIECE' | backend schemas/externalProcess.schema.ts:14-21 ExternalProcessTypeEnum has 'PIECE_EMBROIDERY'/'APPLIQUE'/'BEADING'/'OTHER' — Prisma enum (schema.prisma:9579-9583) is EMBROIDERY_PIECE|SMOCKING|HANDWORK; enum enforced by validateQuery (routes:32-36) and validateBody (routes:42-46)
- **Fix:** Align ExternalProcessTypeEnum with the Prisma enum: z.enum(['EMBROIDERY_PIECE','SMOCKING','HANDWORK'])
- **Verified:** DOWNGRADED

### B11-04 — Field mismatch (silent wrong data)
- **Page:** HandworkReceive.tsx (/manufacturing/handwork/receive/:id)
- **Expected:** POST /api/external-process/receive accepts the per-SKU receipt rows the receive pages build
- **Actual:** Any receive of a send-out that has a SKU breakdown (all UI-created ones) returns 400 'Invalid request data' — the receive leg of Handwork/Smocking/EmbroideryPiece is broken (error alert shown, nothing saved)
- **Evidence:** frontend HandworkReceive/EmbroideryPieceReceive.tsx:77-81 skus map `{sendOutSkuId, receivedQty, damagedQty}`; SmockingReceive same pattern | backend schemas/externalProcess.schema.ts:73-78 receiveSkuSchema requires `sizeName` + `quantityReceived` (neither sent) and lacks receivedQty/damagedQty which the controller/service read (external-process.service.ts:361-371); validateBody at external-process.routes.ts:47
- **Fix:** Rewrite receiveSkuSchema to { sendOutSkuId: uuid, receivedQty: int nonneg, damagedQty: int nonneg? }
- **Verified:** CONFIRMED

### B11-05 — Field mismatch (silent wrong data)
- **Page:** HandworkDashboard.tsx (/manufacturing/handwork)
- **Expected:** Status filter values the UI offers (SENT/PARTIALLY_RECEIVED/RECEIVED) are accepted by GET /send-outs
- **Actual:** Selecting any status except CANCELLED 400s → Handwork/Smocking dashboards show a silently empty table; all three receive pages' 'select pending send-out' dropdown (status=SENT) is always empty
- **Evidence:** frontend HandworkDashboard (≈:231 filter Select offers SENT/PARTIALLY_RECEIVED/RECEIVED); receive pages request status:'SENT' for the pending dropdown (EmbroideryPieceReceive.tsx:38) | backend schemas/externalProcess.schema.ts:23 SendOutStatusEnum = PENDING|PARTIAL|COMPLETED|CANCELLED vs Prisma ExternalProcessStatus DRAFT|SENT|PARTIALLY_RECEIVED|RECEIVED|CANCELLED (schema.prisma:9591-9597)
- **Fix:** Align SendOutStatusEnum with Prisma: z.enum(['DRAFT','SENT','PARTIALLY_RECEIVED','RECEIVED','CANCELLED'])
- **Verified:** CONFIRMED

### B11-06 — Ignored link parameter
- **Page:** SmockingSendOut.tsx (/manufacturing/smocking/send-out)
- **Expected:** 'Select Service PO' dropdown shows only service-category POs linked to the chosen work order
- **Actual:** Both query params are silently ignored → dropdown lists the first 100 POs of ANY category/work order; a user can book a send-out against an unrelated PO (backend only validates supplier match), silently corrupting PO traceability
- **Evidence:** frontend SmockingSendOut.tsx:115 `/purchase-orders?poCategory=SMOCKING_SERVICE&serviceWorkOrderId=${id}&limit=100`; HandworkSendOut.tsx:107 (HANDWORK_SERVICE); EmbroideryPieceSendOut.tsx:124 (EMBROIDERY_SERVICE) | backend purchaseOrder.controller.ts:26-32 destructures `poCategories` (plural CSV) — `poCategory` (singular) and `serviceWorkOrderId` are never read; service filter at purchaseOrder.service.ts:247-248 only uses poCategories
- **Fix:** Send poCategories=<CATEGORY> from the three pages and add a serviceWorkOrderId filter to getAllPurchaseOrders/service
- **Verified:** CONFIRMED

### B11-07 — Field mismatch (silent wrong data)
- **Page:** SampleForm.tsx (/samples/:id/edit)
- **Expected:** Editing a sample re-saves its measurement specs via PUT /api/samples/:id/measurements
- **Actual:** The schema validates a payload shape neither the frontend nor the controller uses → editing any sample that has measurements always fails with 'Failed to save sample' (after requiredDate/remarks were already saved — partial write)
- **Evidence:** frontend SampleForm.tsx:306-308 edit path calls updateMeasurements(id, measurements) with items {measurementPoint, specValue, tolerance, sizeId?} | backend schemas/sample.schema.ts:153-161 updateMeasurementsSchema requires `measurementPointId: uuid` (+targetValue) — but sample.controller.ts:712-738 reads m.measurementPoint/m.specValue/m.tolerance, matching the frontend; validateBody 400s every real payload (sample.routes.ts:117-122)
- **Fix:** Rewrite updateMeasurementsSchema to { measurements: [{ sizeId? , measurementPoint: string, specValue: number, actualValue?, tolerance? }] }
- **Verified:** CONFIRMED

### B11-08 — Dead/stub UI
- **Page:** SampleForm.tsx (/samples/:id/edit)
- **Expected:** Editing a PP sample's colorways or a Size-Set sample's entries persists the changes
- **Actual:** User edits colorways/size-sets, clicks Update, gets 'Sample updated' success toast — changes are silently discarded (never sent, and no backend route exists to receive them)
- **Evidence:** frontend SampleForm.tsx:300-309 edit branch only calls updateSample(requiredDate, remarks) + updateMeasurements; colorway/size-set editors stay fully interactive in edit mode (:637-802) and their state is never sent | backend backend/src/routes/sample.routes.ts has no /:id/colorways or /:id/size-sets routes (grep: no matches), so there is nothing to call either
- **Fix:** Persist colorways/sizeSets on edit (accept them in PUT /api/samples/:id like createSample does, and send them from createOrUpdateSample) or disable those editors in edit mode
- **Verified:** CONFIRMED

### B13-01 — Dead endpoint
- **Page:** FabricPhysicalTests.tsx (/fabric-physical-tests)
- **Expected:** GET /api/fabric-physical-tests returns paginated FPT list; §8.12 Quality module card lists fabric_physical_tests with Fabric Master/Procurement/Stock/Testing Lab connections (MODULE_RELATIONSHIPS_GUIDE.md:1584-1592)
- **Actual:** Entire /api/fabric-physical-tests backend is absent: the FPT list always 404s (error toast + permanent 'No tests found'), and TestingDashboard.tsx:54,69-77 swallows the failure with .catch(() => total 0) so FPT stat cards silently show 0
- **Evidence:** frontend frontend/src/services/testing.service.ts:97 `api.get('/fabric-physical-tests', { params })` (plus POST/PUT/retest/approve/DELETE lines 102-137); page consumes at FabricPhysicalTests.tsx:34 | backend no-route: no fabricPhysicalTests route/controller/service file exists; backend/src/routes/index.ts mounts only garment-physical-tests (line 372); only Zod schemas (backend/src/schemas/testing.schemas.ts:165) and types exist
- **Fix:** Build fabricPhysicalTests service/controller/routes (schemas already exist in testing.schemas.ts) and mount at /fabric-physical-tests in routes/index.ts
- **Verified:** CONFIRMED

### B13-02 — Field mismatch (silent wrong data)
- **Page:** UserForm.tsx (/users/edit/:id)
- **Expected:** Editing a user (or own profile) saves firstName, lastName, department and optional new password
- **Actual:** Zod silently strips firstName/lastName/department/password; only email and phone persist while a success toast is shown - silent data loss on UserForm edit and Profile save
- **Evidence:** frontend frontend/src/pages/UserForm.tsx:74-82 sends {firstName,lastName,phone,department,password} via PUT /users/:id; Profile.tsx:47-54 sends the same for self-profile | backend backend/src/schemas/user.schema.ts:48-54 updateUserSchema only allows email/name/phone/avatar/isActive; validation.middleware.ts:28 replaces req.body with parsed value, so user.controller.ts:168 destructures firstName/lastName/department/password that are always undefined
- **Fix:** Replace updateUserSchema fields with firstName/lastName/phone/department/password/isActive to match user.controller.ts:168
- **Verified:** CONFIRMED

### B13-04 — Field mismatch (silent wrong data)
- **Page:** Settings.tsx (/settings)
- **Expected:** Saving a wastage default updates its value and keeps it in the DEFAULTS category so it still appears in /system-settings/defaults
- **Actual:** First save flips the setting's category from DEFAULTS to OTHER; it then vanishes from getDefaults, so the Settings card shows blank inputs on next load and any consumer of /system-settings/defaults silently loses the key (getNumber-by-key consumers unaffected)
- **Evidence:** frontend frontend/src/services/system-settings.service.ts:15 PUT /system-settings/:key sends {value, dataType} with no category (Settings.tsx:291) | backend backend/src/schemas/systemSettings.schema.ts:36 `category: ...optional().default('OTHER')` injects OTHER; system-settings.service.ts:185 update branch `...(input.category && { category })` overwrites the row; getDefaults (lines 154-157) filters category='DEFAULTS'
- **Fix:** Remove the .default('OTHER') from upsertSystemSettingSchema (or don't overwrite category on update when not explicitly sent)
- **Verified:** CONFIRMED

### B15-01 — Field mismatch (silent wrong data)
- **Page:** dashboards/ProductionDashboard.tsx (/dashboard/production)
- **Expected:** Response { stats: { ordersInProduction, todayDispatchTarget, cuttingQueue, stitchingActive, finishingActive, overdueOrders }, activeWorkOrders: [...] }
- **Actual:** Backend returns flat { cuttingQueue, stitchingActive, finishingActive }; frontend reads .stats.* which is undefined — ALL 4 KPI cards and all 4 pipeline-stage counts render 0 (even the 3 values the backend computes), and the Active Work Orders table always shows 'No active work orders'
- **Evidence:** frontend ProductionDashboard.tsx:61-69 — reads dashboardData?.stats?.cuttingQueue etc. and dashboardData?.activeWorkOrders | backend backend/src/controllers/dashboard.controller.ts:477-483 — res.json({ data: { cuttingQueue, stitchingActive, finishingActive } }) — flat, no stats wrapper, no activeWorkOrders
- **Fix:** Wrap getProductionDashboardStats response as { stats: {...} }, add ordersInProduction/todayDispatchTarget/overdueOrders counts and an activeWorkOrders query (or repoint frontend to the flat keys and drop unbacked cards)
- **Verified:** CONFIRMED

### B15-02 — Field mismatch (silent wrong data)
- **Page:** dashboards/AccountsDashboard.tsx (/dashboard/accounts)
- **Expected:** Response { stats: { outstandingInvoices, overdueAmount, monthlyCollections, pendingInvoices, gstPayable, totalReceivables }, recentInvoices: [...], agingData: [...] }
- **Actual:** All 6 KPI values render Rs.0 (monthlyCollections/totalReceivables are computed but invisible behind the missing stats wrapper), Receivables Aging always shows the emptyAging zeros, Recent Invoices table always 'No invoices found'; backend's totalPayables is never read by anyone
- **Evidence:** frontend AccountsDashboard.tsx:71-80 — reads dashboardData?.stats?.outstandingInvoices etc., dashboardData?.recentInvoices, dashboardData?.agingData | backend backend/src/controllers/dashboard.controller.ts:516-522 — res.json({ data: { monthlyCollections, totalReceivables, totalPayables } }) — flat, no stats wrapper, no recentInvoices/agingData
- **Fix:** Return { stats: {...}, recentInvoices, agingData } from getAccountsDashboardStats with the 3 missing stat fields, or repoint frontend to flat keys and remove unbacked widgets
- **Verified:** CONFIRMED

### B15-03 — Field mismatch (silent wrong data)
- **Page:** dashboards/SalesDashboard.tsx (/dashboard/sales)
- **Expected:** Response { stats: { activeOrders, pendingQuotations, activeCustomers, upcomingDeliveries, monthlyRevenue, stylesPendingCosting }, recentOrders: [...], pendingQuotations: [...] }
- **Actual:** All 6 KPIs render 0 (the 3 computed values hidden behind missing stats wrapper; totalCustomers also misnamed vs activeCustomers), Recent Orders and Pending Quotations tables always empty
- **Evidence:** frontend SalesDashboard.tsx:64-74 — reads dashboardData?.stats?.activeOrders etc., dashboardData?.recentOrders, dashboardData?.pendingQuotations | backend backend/src/controllers/dashboard.controller.ts:550-556 — res.json({ data: { stylesPendingCosting, activeOrders, totalCustomers } }) — flat, no stats wrapper, no table arrays; key is totalCustomers but frontend expects activeCustomers
- **Fix:** Return { stats: {...}, recentOrders, pendingQuotations } from getSalesDashboardStats, rename totalCustomers to activeCustomers, and add pendingQuotations/upcomingDeliveries/monthlyRevenue counts
- **Verified:** CONFIRMED

### B15-04 — Field mismatch (silent wrong data)
- **Page:** dashboards/GeneralDashboard.tsx (/dashboard/admin)
- **Expected:** general-stats returns all 8 DashboardStats fields including totalOrders, activeWorkOrders, activeCustomers
- **Actual:** totalOrders, activeWorkOrders and activeCustomers are never returned, so the 'Total Orders', 'Active Work Orders' and 'Active Customers' StatCards on the admin landing dashboard permanently show 0 while the other 5 cards show real data — indistinguishable from a genuinely idle business
- **Evidence:** frontend GeneralDashboard.tsx:45-49 — reads apiStats?.totalOrders, apiStats?.activeWorkOrders, apiStats?.activeCustomers (flat, correct shape) | backend backend/src/controllers/dashboard.controller.ts:441-449 — data contains only lowStockItems, pendingQuotations, outstandingInvoices, monthlyRevenue, overdueOrders
- **Fix:** Add orders.count, work_orders.count(active) and customers.count(isActive) to the getGeneralDashboardStats Promise.all and response
- **Verified:** CONFIRMED

### B15-05 — Dead navigation
- **Page:** dashboards/DashboardRouter.tsx (/dashboard)
- **Expected:** Every role in ROLE_DASHBOARD_MAP redirects to a registered dashboard route
- **Actual:** Users with INVENTORY, PURCHASE or QUALITY roles are redirected to unregistered routes and hit NotFound immediately after login; NotFound's only 'Dashboard' escape (NotFound.tsx:20, Link to /dashboard) loops straight back into the same 404. Ironically the map's own fallback '/dashboard/general' (line 33) would have worked if these roles were simply absent from the map
- **Evidence:** frontend DashboardRouter.tsx:17-19 — [UserRole.INVENTORY]: '/dashboard/inventory', [UserRole.PURCHASE]: '/dashboard/procurement', [UserRole.QUALITY]: '/dashboard/quality' | backend frontend/src/App.tsx:255-261 — only /dashboard, /dashboard/main, /dashboard/admin, /dashboard/general, /dashboard/production, /dashboard/sales, /dashboard/accounts are registered; no inventory/procurement/quality dashboard routes exist anywhere in App.tsx
- **Fix:** Point the 3 roles at existing pages (e.g. INVENTORY -> '/inventory/dashboard', PURCHASE/QUALITY -> '/dashboard/general') or register the three routes
- **Verified:** CONFIRMED

## P2 (74)

### B02-03 — Dead endpoint
- **Page:** TrimMastersDashboard.tsx (/trim-masters)
- **Expected:** All 16 generic trim types listed on the dashboard are browsable/creatable
- **Actual:** 5 of 16 generic trim types (belt, other_fastener, other_tape, other_decorative, other_functional) 400 on every list/create/edit/delete — dashboard cards and Add Trim menu entries for them are dead
- **Evidence:** frontend TrimMastersDashboard.tsx:118-126,136-144,163-171,199-207,226-234 define trim types belt, other_fastener, other_tape, other_decorative, other_functional (cards navigate to /materials/<type>, Add-Trim menu to /materials/<type>/new); genericTrim.types.ts TRIM_TYPE_CONFIGS includes all 16 (lines 326,508-566) so GenericTrimList/Form render and call the API | backend genericTrim.schema.ts:14-26 TrimTypeEnum has only 11 values (no belt/other_*), but generic-trim.controller.ts TRIM_CONFIGS supports all 16 (lines 55,146,156,166,176) — validateParams rejects before the controller runs
- **Fix:** Add the 5 missing values to TrimTypeEnum in backend/src/schemas/genericTrim.schema.ts (controller + Prisma models already support them)
- **Verified:** mechanical

### B02-04 — Field mismatch (silent wrong data)
- **Page:** LaceList.tsx (/materials/lace)
- **Expected:** Supplier column shows linked supplier names
- **Actual:** Supplier column always renders '-' regardless of data (laceSuppliers undefined)
- **Evidence:** frontend LaceList.tsx:242-254 supplier column reads `lace.laceSuppliers` | backend same root cause as B02-01/02: serialized key is `suppliers` (serializer.ts:320)
- **Fix:** Read `lace.suppliers` (same one-line fix family as B02-01/02)
- **Verified:** mechanical

### B02-05 — Dead navigation
- **Page:** MachinePartList.tsx (/materials/machine-part)
- **Expected:** Clicking a machine-part row opens its detail/edit view
- **Actual:** Row click lands on GenericTrimForm's 'Invalid trim type specified.' dead-end page
- **Evidence:** frontend MachinePartList.tsx:257 `onRowClick={(part) => navigate(`/materials/machine-part/${part.id}`)}` | backend App.tsx:414-416 registers only /materials/machine-part, /new, /:id/edit — no /:id detail route; URL falls through to /materials/:trimType/:id (App.tsx:427) → GenericTrimForm, whose TRIM_TYPE_CONFIGS has no 'machine-part' → renders 'Invalid trim type specified.' (GenericTrimForm.tsx:159-172)
- **Fix:** Point onRowClick to `/materials/machine-part/${part.id}/edit` (or add a detail route)
- **Verified:** mechanical

### B02-06 — Dead navigation
- **Page:** OtherMaterialList.tsx (/materials/other)
- **Expected:** Clicking an other-material row opens its detail/edit view
- **Actual:** Row click lands on GenericTrimForm's invalid-trim-type dead-end page
- **Evidence:** frontend OtherMaterialList.tsx:262 `onRowClick={(material) => navigate(`/materials/other/${material.id}`)}` | backend App.tsx:419-421 has no /materials/other/:id route; falls through to /materials/:trimType/:id → GenericTrimForm with trimType='other' (not in TRIM_TYPE_CONFIGS) → 'Invalid trim type specified.'
- **Fix:** Point onRowClick to `/materials/other/${material.id}/edit`
- **Verified:** mechanical

### B02-07 — Field mismatch (silent wrong data)
- **Page:** LaceDefectForm.tsx (/lace-defects/new)
- **Expected:** Log Defect form creates a lace defect record
- **Actual:** Every submit fails Zod validation with 400 (three independent mismatches: defectType enum family, discoveredAt datetime-vs-stage, empty-string uuids) — the form can never succeed
- **Evidence:** frontend LaceDefectForm.tsx:35-45 form state: defectType 'WEAVE_DEFECT' (laceDefect.types.ts:7 family), discoveredAt 'RECEIVING' (stage), orderId:'' styleId:''; handleSubmit line 124 posts `form` as-is | backend laceDefect.schema.ts:34-44 logDefectSchema: defectType z.enum(WEAVING_FAULT|DYEING_FAULT|...) rejects WEAVE_DEFECT; discoveredAt z.string().datetime() rejects 'RECEIVING'; orderId/styleId .uuid().optional() reject ''. Controller (laceDefect.controller.ts:42-56) contradicts its own schema: requires discoveredAt as stage enum and defectType in WEAVE_DEFECT family
- **Fix:** Rewrite logDefectSchema to match controller+frontend: defectType z.enum([WEAVE_DEFECT,COLOR_VARIATION,WIDTH_VARIATION,DAMAGE]), discoveredAt z.enum([RECEIVING,CUTTING,STITCHING,QC]), and strip empty-string orderId/styleId in the form
- **Verified:** mechanical

### B02-11 — Dead navigation
- **Page:** TrimMastersDashboard.tsx (/trim-masters)
- **Expected:** 'Fabric Masters' quick link opens the fabric master list
- **Actual:** Link lands on GenericTrimList's invalid-trim-type dead-end
- **Evidence:** frontend TrimMastersDashboard.tsx:471 `onClick={() => navigate('/materials/fabric')}` labeled 'Fabric Masters' | backend Fabric list lives at /fabric (App.tsx:306); /materials/fabric matches /materials/:trimType → GenericTrimList; 'fabric' not in TRIM_TYPE_CONFIGS → 'Invalid trim type specified.' (and API would 400)
- **Fix:** navigate('/fabric')
- **Verified:** mechanical

### B02-12 — Ignored link parameter
- **Page:** TrimMastersDashboard.tsx (/trim-masters)
- **Expected:** Dashboard global search ('Search trims by name, code, color...') lands on the target list pre-filtered
- **Actual:** The ?search= param is silently dropped by every target list — user always sees the full unfiltered list, search feature is a no-op
- **Evidence:** frontend TrimMastersDashboard.tsx:319,322 handleSearch navigates to `${path}?search=${query}` (e.g. /materials/button?search=...) | backend n/a — target pages: grep for useSearchParams across ButtonList/ZipperList/LaceList/ThreadList/ElasticList/LabelList/GenericTrimList = zero matches; all initialize searchQuery to '' (e.g. ButtonList.tsx:42)
- **Fix:** In the trim list pages, seed searchQuery from useSearchParams().get('search')
- **Verified:** mechanical

### B01-02 — Dead navigation
- **Page:** FabricDetail.tsx (/fabric/:id)
- **Expected:** Add CAD button opens a CAD-creation page for the fabric
- **Actual:** Navigates to unregistered route /fabric/:id/cad/new -> router no-match blank page
- **Evidence:** frontend frontend/src/pages/FabricDetail.tsx:473 `<Link to={`/fabric/${id}/cad/new`}>` (Add CAD button in Width CAD Options card) | backend n/a - no frontend route: 'cad/new' appears nowhere in App.tsx/lazy-routes (only /fabric/:id and /fabric/:id/edit registered, App.tsx:309-310)
- **Fix:** Point the button at the CAD create flow (e.g. open createCAD dialog or /cad-planning) or register the route
- **Verified:** mechanical

### B01-03 — Ignored link parameter
- **Page:** FabricAvailableStock.tsx (/fabric-stock)
- **Expected:** Greige Base link opens GreigeDetail for the stock row's greige
- **Actual:** GET /api/fabric-management/greige/GRG-xxxx fails UUID param validation (400 Invalid greige ID) -> GreigeDetail renders error state
- **Evidence:** frontend frontend/src/pages/FabricAvailableStock.tsx:480 `<Link to={`/greige/${stock.fabric.greige.greigeCode}`}>` - passes greigeCode (e.g. GRG-0017) into the /greige/:id route | backend backend/src/schemas/fabricGreige.schema.ts:345-347 greigeIdParamSchema requires z.string().uuid(); fabric-greige.routes.ts:74-78 validates it; listStock response includes only greige.greigeCode/greigeName/composition, no greige.id (fabric-stock.controller.ts:229-235)
- **Fix:** Have listStock also select greige.id and link to /greige/${stock.fabric.greige.id}
- **Verified:** mechanical

### B01-04 — Field mismatch (silent wrong data)
- **Page:** FabricAvailableStock.tsx (/fabric-stock)
- **Expected:** Stock View shows all fabric stock rows; Total Meters/Total Value/Aged counts reflect full inventory
- **Actual:** Backend silently returns only the first 20 rows (pagination envelope ignored); totals and export will be wrong once >20 stock rows exist
- **Evidence:** frontend frontend/src/pages/FabricAvailableStock.tsx:103-107 GET `/stock?status=...` with no limit; response .data array treated as the FULL inventory (client-side filters, summary cards, CSV export, no pagination UI) | backend backend/src/controllers/fabric-stock.controller.ts:191 `limit: ... : 20` default caps the list at 20 rows; fabricStock.schema.ts:121 max 500
- **Fix:** Request `/stock?limit=500&status=...` (or implement server pagination in the page)
- **Verified:** mechanical

### B01-05 — Field mismatch (silent wrong data)
- **Page:** FabricDetail.tsx (/fabric/:id)
- **Expected:** Width CAD Options table shows each CAD's width (e.g. 58 inches)
- **Actual:** cad.availableWidth is always undefined -> Width column and preferred-width summary render blank
- **Evidence:** frontend frontend/src/pages/FabricDetail.tsx:511 `{cad.availableWidth} {cad.widthUnit}` and :259 `${preferredCAD.availableWidth}" preferred`; type comment admits alias (frontend/src/types/style.types.ts:142-143) | backend backend/src/controllers/fabric-cad.controller.ts:34 res.json(cads) returns raw fabric_width_cad rows whose column is cutableWidth (schema.prisma:4252); no availableWidth anywhere
- **Fix:** Read cad.cutableWidth in FabricDetail (drop the availableWidth alias)
- **Verified:** mechanical

### B01-07 — Dead/stub UI
- **Page:** FabricStockEntry.tsx (/fabric-stock-entry)
- **Expected:** Notes entered on the manual fabric stock entry form are saved with the stock record
- **Actual:** Notes are silently discarded on save (never sent, and schema would strip them)
- **Evidence:** frontend frontend/src/pages/FabricStockEntry.tsx:470-475 Notes textarea bound to formData.notes, but handleSave POST body (lines 124-136) omits notes | backend backend/src/schemas/fabricStock.schema.ts:54-69 createFabricStockSchema has no notes field either (would be stripped even if sent)
- **Fix:** Add notes to the POST body and to createFabricStockSchema (+ persist in createFabricStock), or remove the input
- **Verified:** mechanical

### B03-02 — Dead navigation
- **Page:** ColorMasterList.tsx (/colors)
- **Expected:** Import button opens a color bulk-import page (backend already has POST /api/colors/bulk-import and GET /api/colors/template at color.routes.ts:61/54, and colorService.bulkImport/getImportTemplate exist)
- **Actual:** Clicking Import lands on the 404 NotFound page — the import UI was never routed/built
- **Evidence:** frontend frontend/src/pages/ColorMasterList.tsx:187 — `onClick={() => navigate('/colors/import')}` (Import button) | backend frontend/src/App.tsx:589-591 defines only /colors, /colors/new, /colors/:id/edit; /colors/import falls to catch-all NotFound at App.tsx:652
- **Fix:** Add a /colors/import route with a ColorBulkImport page (copy GreigeBulkImport pattern; service + endpoints already exist) or remove the button
- **Verified:** mechanical

### B04-03 — Dead endpoint
- **Page:** CustomerForm.tsx (/customers/new)
- **Expected:** fabricPhysicalTestsService endpoints resolve to backend routes
- **Actual:** All /api/fabric-physical-tests* calls 404. CustomerForm imports testing.service but only invokes labs/templates, so this page is unaffected; real consumers are FabricPhysicalTests.tsx and TestingDashboard.tsx (other batches) - reported once here because the call is attributed to this batch
- **Evidence:** frontend frontend/src/services/testing.service.ts:97 `api.get('/fabric-physical-tests')` (entire fabricPhysicalTestsService, lines 93-137, incl. POST/PUT/approve/retest) | backend no-route - zero matches for 'fabric-physical' anywhere in backend/src; routes/index.ts:372 mounts only /garment-physical-tests
- **Fix:** Create fabricPhysicalTests routes/controller (mirroring garmentPhysicalTests) or delete the dead service block and its consumers' fabric-test tab
- **Verified:** mechanical

### B04-04 — Dead navigation
- **Page:** WarehouseList.tsx (/inventory/warehouses)
- **Expected:** View button / row click opens a warehouse detail (or at least the edit form)
- **Actual:** Lands on the 404 NotFound page - the batch's matchedRoute:true for this nav is a parser fuzzy-match against /:id/edit
- **Evidence:** frontend WarehouseList.tsx:157 View button and :256 onRowClick navigate to `/inventory/warehouses/${wh.id}` | backend frontend/src/App.tsx:492-494 registers only /inventory/warehouses, /new, /:id/edit - no /:id detail route; path falls to catch-all NotFound at App.tsx:652
- **Fix:** Point View/row-click to `/inventory/warehouses/${wh.id}/edit` or add a /inventory/warehouses/:id detail route
- **Verified:** mechanical

### B04-05 — Dead/stub UI
- **Page:** WarehouseList.tsx (/inventory/warehouses)
- **Expected:** Choosing 'All' in the Type filter clears the type filter and lists every warehouse
- **Actual:** Request 400s and the list shows an error; once selected, the filter cannot be reset without reloading the page
- **Evidence:** frontend WarehouseList.tsx:211 `<SelectItem value="all">All</SelectItem>` -> typeFilter='all' is truthy -> warehouse.service.ts:20 appends warehouseType=all | backend backend/src/schemas/warehouse.schema.ts:76 warehouseType: WarehouseTypeEnum.optional() - 'all' fails enum validation
- **Fix:** In onValueChange map 'all' to '' (like CustomerList does with its ALL sentinel) before setting typeFilter
- **Verified:** mechanical

### B05-06 — Dead/stub UI
- **Page:** StyleDetail.tsx (/styles/:id)
- **Expected:** Selecting a stage updates style_production_tracking
- **Actual:** Every stage change opens the confirm dialog then fails with alert 'Failed to update production stage' - the service is a throwing stub and the endpoint does not exist (batch tagged shadow-risk)
- **Evidence:** frontend StyleDetail.tsx:747-771 Production tab stage <Select> -> confirmStageUpdate -> styleService.updateProductionStage; style.service.ts:213-217 stub immediately throws 'Production stage update not yet implemented' (API call commented out, TODO) | backend no-route - `production-stage` appears nowhere under backend/src (grep), style.routes.ts has no PUT /:id/production-stage
- **Fix:** Render the stage as read-only text (stage moves via Work Order transitions) or implement PUT /api/styles/:id/production-stage
- **Verified:** mechanical

### B05-07 — Dead navigation
- **Page:** StyleDetail.tsx (/styles/:id)
- **Expected:** Button opens the style's costing (MODULE_RELATIONSHIPS_GUIDE §8.1 Style card: 'Costing (via style_costing.styleId) - Price calculation' is a core integration)
- **Actual:** Navigates to an unregistered route -> blank/404 page; the Style->Costing pipeline hop has no working entry from Style Detail
- **Evidence:** frontend StyleDetail.tsx:291 `navigate(`/styles/${style.id}/costing`)` ('View Costing'/'Add Costing' button); batch outboundNav matchedRoute=false | backend App.tsx:281-294 defines /styles, /styles/new, /styles/:id/edit, /styles/:id, /styles/:id/cad-planning, /styles/import, /styles/:styleId/stock-entry - no /styles/:id/costing
- **Fix:** Point the button at the actual costing page (e.g. cost-sheet route with styleId param) or register /styles/:id/costing
- **Verified:** mechanical

### B05-08 — Field mismatch (silent wrong data)
- **Page:** StyleDetail.tsx (/styles/:id)
- **Expected:** Per-component Materials/Accessories (style_accessories, included by getFullDetails style.service.ts:682) render in the BOM tab
- **Actual:** The custom components array overwrites the serialized one and omits accessories -> the 'Materials/Accessories' section can never render for any style
- **Evidence:** frontend StyleDetail.tsx:454-489 BOM tab renders component.accessories list | backend style.controller.ts:185-214 builds custom `components` (id, componentName, componentType, sortOrder, fabrics only) and res.json({...style, styleFabrics, components}) at 216-222; serialized style_components->styleComponents->'components' collides and the later custom key wins, dropping style_accessories (serializer.ts:550 acknowledges collision=silent data loss)
- **Fix:** Add `accessories: comp.style_accessories` to the custom components mapping in getStyleById
- **Verified:** mechanical

### B05-09 — Field mismatch (silent wrong data)
- **Page:** MaterialMasterList.tsx (/material-master)
- **Expected:** 'All Status' shows active + inactive materials
- **Actual:** 'All Status' silently filters to isActive=false only - with current data the list goes empty ('No materials found') while 29 active materials exist
- **Evidence:** frontend MaterialMasterList.tsx:198-210 'All Status' sets activeOnly=false -> service sends active=false (materialMaster.service.ts:30-32 always appends the boolean) | backend material-master.controller.ts:18 `isActive: active === 'true'` and material-master.service.ts:26 `where.isActive = filters.isActive ?? true` -> active=false means isActive=false (inactive-only), never 'all'
- **Fix:** Treat missing/'all' as no isActive filter (make controller pass undefined unless param present, and service drop the ?? true default when explicitly 'all')
- **Verified:** mechanical

### B06-03 — Dead navigation
- **Page:** DyeingList.tsx (/manufacturing/dyeing)
- **Expected:** New Lab Dip / New Process PO buttons, view/edit actions, QC and Return Unprocessed actions open working pages
- **Actual:** All 9 navigations land on the NotFound page; lab dips cannot be created/viewed/edited and process-PO QC & return are unreachable — a RECEIVED process PO can never reach QUALITY_CHECKED from this UI, so Update Stock (gated on QUALITY_CHECKED) is also unreachable
- **Evidence:** frontend DyeingList.tsx:421,434,627,670,700,741,745,897,979 — navigate() to /manufacturing/dyeing/lab-dip/{new,:id,:id/edit} and /manufacturing/dyeing/process-po/{new,:id,:id/qc,:id/return} | backend frontend/src/App.tsx:560 registers only /manufacturing/dyeing; no LabDip*/ProcessPO* page files exist (glob empty); catch-all NotFound App.tsx:652
- **Fix:** Register/build the lab-dip and process-po sub-pages, or convert QC/return/new actions to in-page dialogs like the existing Receive/Update-Stock dialogs
- **Verified:** mechanical

### B06-04 — Dead navigation
- **Page:** PrintingList.tsx (/manufacturing/printing)
- **Expected:** Printing lab-dip and process-PO create/view/QC/return actions open working pages
- **Actual:** All 9 navigations land on NotFound — identical clone of the DyeingList problem; printing QC and stock-update progression blocked from the UI
- **Evidence:** frontend PrintingList.tsx:409,422,591,644,674,714,718,870,952 — navigate() to /manufacturing/printing/lab-dip/* and /manufacturing/printing/process-po/* (incl. ?action=qc / ?action=return variants) | backend frontend/src/App.tsx:557 registers only /manufacturing/printing; no target page files exist
- **Fix:** Same as dyeing: register the sub-pages or move QC/return/new into dialogs
- **Verified:** mechanical

### B06-05 — Dead/stub UI
- **Page:** WorkOrderDetail.tsx (/production/work-orders/:id)
- **Expected:** 'Calculate Services' derives service requirements from the WO's style processes (WO → outsourced-services integration, guide §8.7/§8.11)
- **Actual:** userId is always the empty string → uuid validation fails → the button 400s on every click; service requirements can never be calculated from this page
- **Evidence:** frontend WorkOrderDetail.tsx:208-209 `const userId = localStorage.getItem('userId') || ''; await calculateServices(id, userId)` — no code in frontend/src ever does setItem('userId') (grep: 0 matches); serviceRequirement.service.ts:45 posts { userId } | backend schemas/serviceRequirement.schema.ts:46-48 `userId: z.string().uuid()` required; routes/service-requirement.routes.ts:44-49 validateBody → 400
- **Fix:** Drop userId from the request body and use req.user.userId server-side (auth middleware already provides it)
- **Verified:** mechanical

### B06-06 — Dead/stub UI
- **Page:** CuttingChart.tsx (/manufacturing/cutting/new)
- **Expected:** PDF preview dialog shows the cutting chart PDF
- **Actual:** The iframe request always gets 401 (browser cannot attach the Bearer token) → preview pane shows the JSON error/blank instead of the PDF
- **Evidence:** frontend CuttingChart.tsx:223 builds `/api/documents/cutting-chart/:id/pdf?...`; :836 renders it via `<iframe src={pdfPreviewUrl}>` — a plain browser GET with no Authorization header | backend routes/document.routes.ts:26 `router.use(authenticateToken)` covers the cutting-chart route at :251; middleware/auth.middleware.ts:11-12 reads ONLY the Authorization header (no query-token/cookie fallback)
- **Fix:** Fetch the PDF as a blob via the api client and set the iframe src to a createObjectURL result
- **Verified:** mechanical

### B06-07 — Ignored link parameter
- **Page:** StitchingList.tsx (/manufacturing/stitching)
- **Expected:** 'Receive & Create Issue' opens StitchingForm with that transfer slip preselected
- **Actual:** Param name mismatch (slipId vs transferSlipId) silently drops the preselection — user must manually re-find the slip among all pending slips (wrong-slip risk)
- **Evidence:** frontend StitchingList.tsx:499 `navigate(`/manufacturing/stitching/new?slipId=${slip.id}`)` but StitchingForm.tsx:67 reads only `searchParams.get('transferSlipId')` (prefill effect at :104) | backend n/a (frontend param naming)
- **Fix:** Rename the query param at StitchingList.tsx:499 to transferSlipId
- **Verified:** mechanical

### B06-12 — Missing integration
- **Page:** FinishingDetail.tsx (/manufacturing/finishing/:id)
- **Expected:** §8.10 Finishing Module card: finishing 'Triggers: Polybag entry (polybag_entries.finishingIssueId), Carton packing (carton_packings.finishingIssueId)' — the QC→Packing→Dispatch pipeline stage needs a UI to record packing
- **Actual:** No page or dialog anywhere calls the polybag/carton endpoints, so packing can never be recorded from the UI and dispatch's 'available cartons' picker has no data source
- **Evidence:** frontend grep 'polybag-entry|carton-packing' across frontend/src → 0 matches; FinishingDetail/FinishingList expose only receive/start/record-output/move-to-packing/complete/transfer-slip actions | backend routes/finishing.routes.ts:93-104 POST /issues/:id/polybag-entry and /issues/:id/carton-packing exist with controllers; dispatch.service.ts:181-193 consumes GET /dispatch/available-cartons which depends on carton_packings rows
- **Fix:** Add polybag-entry / carton-packing actions (dialogs) to FinishingDetail for issues in PACKING status
- **Verified:** CONFIRMED

### B07-02 — Field mismatch (silent wrong data)
- **Page:** LaceStockDetail.tsx (/lace-stock/:id)
- **Expected:** Transfer modal moves stock to another style/order
- **Actual:** Body field is `quantity` but Zod requires `quantityToTransfer` → validateBody rejects with 400 every time; Transfer button can never succeed
- **Evidence:** frontend frontend/src/pages/LaceStockDetail.tsx:55-60,144 — transferForm { toStyleId, toOrderId, quantity, transferNotes } posted via transferStock(id, transferForm) | backend backend/src/schemas/laceStock.schema.ts:73 — transferLaceStockSchema requires quantityToTransfer (z.number().positive())
- **Fix:** Send quantityToTransfer (rename field in transferForm/TransferStockInput) to match the Zod schema
- **Verified:** mechanical

### B07-03 — Dead endpoint
- **Page:** LaceStockDetail.tsx (/lace-stock/:id)
- **Expected:** Return button (shown when status=ISSUED) returns stock to available
- **Actual:** POST /api/lace-stock/:id/return has no route → 404 'Failed to return stock' always; payload {quantity, notes} also mismatches quantityToReturn
- **Evidence:** frontend frontend/src/pages/LaceStockDetail.tsx:166 handleReturn → laceStock.service.ts:100 POST `${BASE_URL}/${stockId}/return` | backend backend/src/routes/laceStock.routes.ts:86-91 — return exists only as POST /allocations/:allocationId/return (body quantityToReturn); no /:id/return
- **Fix:** Call POST /allocations/:allocationId/return with quantityToReturn, or add a stock-level return route
- **Verified:** mechanical

### B07-04 — Dead endpoint
- **Page:** LaceStockDetail.tsx (/lace-stock/:id)
- **Expected:** Downgrade button changes quality grade A→B/DEFECT
- **Actual:** Endpoint does not exist → 404 'Failed to downgrade quality' always (same for unused service fns adjust/mark-for-return/confirm-return)
- **Evidence:** frontend frontend/src/pages/LaceStockDetail.tsx:192 handleDowngrade → laceStock.service.ts:173 POST `${BASE_URL}/${stockId}/downgrade` | backend backend/src/routes/laceStock.routes.ts — no /:id/downgrade route (batch matchedRoute=null confirmed by route file read)
- **Fix:** Implement POST /api/lace-stock/:id/downgrade in laceStock.routes/controller or remove the Downgrade button
- **Verified:** mechanical

### B07-05 — Field mismatch (silent wrong data)
- **Page:** LaceStockList.tsx (/lace-stock)
- **Expected:** FIFO aging days per lot with color-coded buckets and >60d alert count
- **Actual:** agingDays is always undefined → badges render 'undefinedd'/'undefined days old', getAgingBucket(undefined) falls into '90+' styling, and the Aging Alert summary card is permanently 0
- **Evidence:** frontend frontend/src/pages/LaceStockList.tsx:82,314,349 reads stock.agingDays (badge `${stock.agingDays}d`, agingAlert count); LaceStockDetail.tsx:221,274 same | backend backend/src/services/laceStock.service.ts:292-331 getStocks and 176-237 getLaceStockById return raw rows — agingDays is only computed in the aging report (line 745)
- **Fix:** Compute agingDays from receivedDate in getStocks/getLaceStockById (or derive client-side from stock.receivedDate)
- **Verified:** mechanical

### B07-09 — Dead navigation
- **Page:** StockDashboard.tsx (/inventory/dashboard)
- **Expected:** Reports button opens an inventory reports page
- **Actual:** NotFound page — no /inventory/reports route exists anywhere
- **Evidence:** frontend frontend/src/pages/StockDashboard.tsx:95 navigate('/inventory/reports') — header 'Reports' button | backend frontend/src/App.tsx — route not registered (grep: only reference is this button); catch-all NotFound at App.tsx:652
- **Fix:** Point at an existing report page (e.g. /reports/fabric-usage) or remove the button until an inventory reports page exists
- **Verified:** mechanical

### B07-10 — Dead navigation
- **Page:** StockDashboard.tsx (/inventory/dashboard)
- **Expected:** New Movement opens a movement creation flow
- **Actual:** NotFound page — /inventory/movements/new is not a registered route
- **Evidence:** frontend frontend/src/pages/StockDashboard.tsx:99 navigate('/inventory/movements/new') — primary 'New Movement' button | backend frontend/src/App.tsx:495-499 — registered movement routes are /inventory/movements/{stock-in,stock-out,transfer,adjustment}; no /new
- **Fix:** Navigate to /inventory/movements/stock-in (or /inventory/movements which has the New Movement dropdown)
- **Verified:** mechanical

### B07-11 — Dead navigation
- **Page:** StockMovementList.tsx (/inventory/movements)
- **Expected:** Source Doc links jump to the originating GRN / Challan / Procurement record
- **Actual:** All three prefixes are wrong or missing → every GRN/CHALLAN/PROCUREMENT source link lands on NotFound (only /greige-stock works)
- **Evidence:** frontend frontend/src/pages/StockMovementList.tsx:113-126 getSourceLink returns /grn/${id}, /challans/${id}, /fabric-procurement/${id} rendered as <Link> at line 230 | backend frontend/src/App.tsx:525 route is /procurement/grn/:id; :581 route is /manufacturing/challans/:id; no /fabric-procurement/:id route at all
- **Fix:** Map GRN→/procurement/grn/:id, CHALLAN→/manufacturing/challans/:id, and drop or reroute PROCUREMENT until a detail route exists
- **Verified:** mechanical

### B07-12 — Dead navigation
- **Page:** StockCountList.tsx (/inventory/stock-counts)
- **Expected:** View opens a count detail page to start counting, enter counted qty, verify and approve (MODULE_RELATIONSHIPS_GUIDE §8.5: 'Stock adjustments (stock_counts → adjust stock_levels)')
- **Actual:** NotFound page — the entire count-execution lifecycle is unreachable from the UI, so every count stays DRAFT and stock_levels can never be adjusted from a physical count
- **Evidence:** frontend frontend/src/pages/StockCountList.tsx:159,236 — View button and onRowClick navigate(`/inventory/stock-counts/${count.id}`) | backend frontend/src/App.tsx:501-502 — only /inventory/stock-counts and /inventory/stock-counts/new registered; backend lifecycle routes exist (stockCount.routes.ts:21-36 start/verify/approve/cancel/items/variance) and stockCount.service.ts wraps them, but NO page consumes them
- **Fix:** Build StockCountDetail page (start/count/verify/approve/variance) and register /inventory/stock-counts/:id (after /new)
- **Verified:** mechanical

### B07-13 — Dead navigation
- **Page:** StockCountForm.tsx (/inventory/stock-counts/new)
- **Expected:** After creating a count the user lands on its detail page
- **Actual:** Count is created (POST /api/stock-counts succeeds), then the success redirect lands on NotFound
- **Evidence:** frontend frontend/src/pages/StockCountForm.tsx:96 — setTimeout(() => navigate(`/inventory/stock-counts/${count.id}`), 2000) after successful create | backend frontend/src/App.tsx:501-502 — /inventory/stock-counts/:id not registered; catch-all NotFound
- **Fix:** Redirect to /inventory/stock-counts until the detail page (B07-12) is built
- **Verified:** mechanical

### B07-15 — Dead endpoint
- **Page:** StockInForm.tsx (/inventory/movements/stock-in)
- **Expected:** Component pattern parts load for allocation selection
- **Actual:** Endpoint absent → always 404, swallowed by catch → pattern-part list silently always empty in AllocateFabricToStyleModal (real user path is FabricForm, attributed to this batch at hop 1 — reported once per dedupe rule)
- **Evidence:** frontend frontend/src/services/fabricGreigeService.ts:266-271 getPatternPartsForComponent → GET /component-masters/${id}/pattern-parts; sole caller frontend/src/components/fabric/AllocateFabricToStyleModal.tsx:127 with catch{ setPatternParts([]) } masking | backend backend/src/routes/componentMasters.routes.ts:27-47 — routes are only /, /categories, /:id (GET/PUT/DELETE); no /:id/pattern-parts
- **Fix:** Add GET /component-masters/:id/pattern-parts (component_pattern_parts lookup) or fall back to getCADPatternPartsForComponent/getAllPatternParts in the modal
- **Verified:** CONFIRMED

### B08-03 — Field mismatch (silent wrong data)
- **Page:** UnifiedRequirementsPage.tsx (/procurement/requirements)
- **Expected:** 'Needs Assignment' includes service requirements without a processor and 'PO Generated' includes service POs
- **Actual:** Both fields are always undefined → 0, so the two header stat tiles silently undercount by the entire service-requirement contribution (only the MRP components show)
- **Evidence:** frontend frontend/src/pages/UnifiedRequirementsPage.tsx:149-150 reads serviceStats?.servicesWithoutProcessor and serviceStats?.poGeneratedServices; type declares these names at frontend/src/types/serviceRequirement.types.ts:323-329 | backend GET /api/service-requirements/dashboard returns needsProcessorCount and poGeneratedCount (backend/src/services/work-order-service-requirement.service.ts:1540-1551); serializer does not rename scalar keys
- **Fix:** Read serviceStats.needsProcessorCount / serviceStats.poGeneratedCount (and align ServiceDashboardStats type with the backend interface)
- **Verified:** mechanical

### B08-04 — Dead navigation
- **Page:** UnifiedRequirementsPage.tsx (/procurement/requirements)
- **Expected:** Clicking a service row's Work Order reference on the Outsourced Work tab opens WorkOrderDetail
- **Actual:** Navigates to unregistered /work-orders/:id — dead link (unmatched route)
- **Evidence:** frontend frontend/src/pages/UnifiedRequirementsPage.tsx:1527 `referenceLink: req.workOrderId ? `/work-orders/${req.workOrderId}` : undefined`, navigated at :1920-1926 | backend frontend/src/App.tsx:510 registers the work-order detail at /production/work-orders/:id — no /work-orders/:id route exists
- **Fix:** Change referenceLink to /production/work-orders/${req.workOrderId}
- **Verified:** mechanical

### B08-05 — Dead/stub UI
- **Page:** JobWorkDashboard.tsx (/processing/job-work)
- **Expected:** Sidebar 'Job Work Dashboard' shows live counts/quantities/cost of batches at processors
- **Actual:** Always renders hardcoded zeros and an empty batch list even when active batches exist (ProcessingBatchList proves data exists) — misleading stub reachable from sidebar
- **Evidence:** frontend frontend/src/pages/JobWorkDashboard.tsx:10-15 fake setTimeout loading; :38-62 hardcoded '0' stat cards and '₹0'; :77 static 'No active processing batches' — zero API calls in the file | backend GET /api/processing-batches/summary/job-work exists (backend/src/routes/processingBatch.routes.ts:17) and frontend/src/services/processingBatch.service.ts:81-87 already wraps it, unused
- **Fix:** Wire the page to processingBatchService.getJobWorkSummary() (endpoint and service wrapper already exist)
- **Verified:** mechanical

### B08-06 — Unbuilt feature
- **Page:** ProcessingBatchDetail.tsx (/processing/batches/:id)
- **Expected:** Clicking the Eye icon on ProcessingBatchList shows batch stages/movements/quantities
- **Actual:** Detail page is a stub stuck on 'Loading batch details...' forever — the list→detail drill-down for processing batches is dead despite a fully-built backend
- **Evidence:** frontend frontend/src/pages/ProcessingBatchDetail.tsx:21-23 renders permanent 'Loading batch details...'; no fetch anywhere in the 27-line file | backend GET /api/processing-batches/:id exists with a full include (backend/src/routes/processingBatch.routes.ts:23; backend/src/services/processingBatch.service.ts:148-236 returns stages, movements, masters)
- **Fix:** Implement the page against processingBatchService.getById(id) (backend response is already rich)
- **Verified:** mechanical

### B08-07 — Dead navigation
- **Page:** ProcessingBatchList.tsx (/processing/batches)
- **Expected:** 'New Batch' opens a processing-batch creation form (POST /api/processing-batches exists at processingBatch.routes.ts:15)
- **Actual:** Lands on the permanent-loading Detail stub with id='new'; no batch-creation UI exists anywhere in the frontend
- **Evidence:** frontend frontend/src/pages/ProcessingBatchList.tsx:140 `navigate('/processing/batches/new')` from the 'New Batch' button | backend frontend/src/App.tsx:547-548 registers only /processing/batches and /processing/batches/:id — 'new' matches :id and renders the ProcessingBatchDetail stub showing 'Batch ID: new'
- **Fix:** Build a batch-create form (or hide the button until it exists); register /processing/batches/new before the :id route
- **Verified:** mechanical

### B10-02 — Dead navigation
- **Page:** DispatchList.tsx (/manufacturing/dispatch)
- **Expected:** View button opens a delivery-note detail view
- **Actual:** Navigates to the catch-all NotFound page — there is no /manufacturing/dispatch/delivery/:id route and no DN detail page exists. NOTE: batch data marked this nav matchedRoute:true (parser matched the literal 'new' segment) — verified false against App.tsx
- **Evidence:** frontend DispatchList.tsx:347 `<Link to={`/manufacturing/dispatch/delivery/${dn.id}`}>` (the Eye/View button on every DN row) | backend frontend/src/App.tsx:584-586 — only /manufacturing/dispatch, /delivery/new and /delivery/:id/pod are registered; no /delivery/:id route, and DispatchDeliveryNoteForm.tsx is create-only (no useParams id)
- **Fix:** Add a /manufacturing/dispatch/delivery/:id route with a DN detail (read-only) page, or remove the View button
- **Verified:** mechanical

### B10-03 — Dead navigation
- **Page:** DispatchList.tsx (/manufacturing/dispatch)
- **Expected:** New ASN button opens an ASN creation form
- **Actual:** Lands on NotFound; ASN applications cannot be created from the UI at all despite a working backend endpoint
- **Evidence:** frontend DispatchList.tsx:185 `<Link to="/manufacturing/dispatch/asn/new">` (New ASN header button) | backend frontend/src/App.tsx:584-586 — no /manufacturing/dispatch/asn/* routes; Glob frontend/src/pages/*ASN*.tsx → no ASN page exists; backend POST /api/dispatch/asn exists (dispatch.routes.ts:93) and asnService.create (dispatch.service.ts:130) is never called by any page
- **Fix:** Build an ASN create form page and register /manufacturing/dispatch/asn/new, or hide the button until it exists
- **Verified:** mechanical

### B10-04 — Dead navigation
- **Page:** DispatchList.tsx (/manufacturing/dispatch)
- **Expected:** View button opens the ASN detail
- **Actual:** Lands on NotFound — ASN detail is unreachable
- **Evidence:** frontend DispatchList.tsx:488 `<Link to={`/manufacturing/dispatch/asn/${asn.id}`}>` (Eye/View on every ASN row) | backend frontend/src/App.tsx:584-586 — no /manufacturing/dispatch/asn/:id route and no ASN detail page in frontend/src/pages
- **Fix:** Add an ASN detail page + route, or remove the View button
- **Verified:** mechanical

### B10-05 — Missing integration
- **Page:** DispatchList.tsx (/manufacturing/dispatch)
- **Expected:** MODULE_RELATIONSHIPS_GUIDE §8.13 Dispatch card: ASN (delivery_notes_ext.asnId) integration and 'Triggered By: ASN submission' — the ASN lifecycle PENDING→APPLIED→APPROVED→DN should be drivable from the UI
- **Actual:** UI can only take an ASN from PENDING to APPLIED (apply button); APPROVED is unreachable, so the 'Create Delivery Note' ASN handoff (and its already-fixed asnId prefill) can never trigger from the UI
- **Evidence:** frontend DispatchList.tsx:502-507 — the ASN 'Create Delivery Note' action only renders when asn.status === 'APPROVED'; grep of frontend/src shows asnService.approve/reject/reschedule (dispatch.service.ts:142-161) are never called from any page | backend dispatch.routes.ts:100-112 — POST /asn/:id/approve, /reject, /reschedule all exist and are UI-less
- **Fix:** Add Approve/Reject/Reschedule actions (buttons or an ASN detail page) wired to the existing endpoints
- **Verified:** mechanical

### B10-06 — Missing integration
- **Page:** DispatchList.tsx (/manufacturing/dispatch)
- **Expected:** MODULE_RELATIONSHIPS_GUIDE §8.13: dispatch_transports is a primary dispatch table (dispatch_transports.deliveryNoteExtId FK) — transport should be assignable before dispatch
- **Actual:** No UI ever assigns transport, so dispatch_transports stays empty and the POD form's transport info block never renders for UI-created delivery notes
- **Evidence:** frontend dispatch.service.ts:86-88 assignTransport is defined but grep shows no page calls it and no page references 'assign-transport'; DispatchDeliveryNoteForm has no transport fields; DispatchPODForm.tsx:200 transport section renders only if deliveryNote.vehicleNumber is set | backend dispatch.routes.ts:67-72 POST /delivery-notes/:id/assign-transport exists (controller upserts dispatch_transports + note fields in one txn) but is unreachable from the UI
- **Fix:** Add an 'Assign Transport' action/dialog on the DN row (PENDING status) calling deliveryNoteService.assignTransport
- **Verified:** CONFIRMED

### B10-08 — Dead/stub UI
- **Page:** ChallanDetail.tsx (/manufacturing/challans/:id)
- **Expected:** An ISSUED (esp. INWARD) challan can be marked received from the UI, populating receivedQty/damagedQty/receivedDate
- **Actual:** No UI anywhere invokes the receive endpoint — ISSUED challans show no action, statuses RECEIVED/PARTIAL_RECEIVED are unreachable from the challan module, and the Received/Damaged columns stay permanently empty for UI-created challans (only backend-internal flows like fabric return set them)
- **Evidence:** frontend ChallanDetail.tsx:262-291 renders 'Received Qty'/'Damaged' columns and :166-171 receivedDate, but the page offers only Issue (DRAFT) and Cancel (DRAFT) actions; grep of frontend/src shows challanService.receiveChallan (challan.service.ts:55) is called from no page | backend challan.routes.ts:37 PUT /api/challans/:id/receive exists with full delta-credit receive logic (challan.service.ts:545+)
- **Fix:** Add a Receive dialog on ChallanDetail for ISSUED challans wired to challanService.receiveChallan
- **Verified:** mechanical

### B10-09 — Field mismatch (silent wrong data)
- **Page:** AIAssistant.tsx (/ai-assistant)
- **Expected:** Thumbs up/down on a just-received AI answer records feedback
- **Actual:** Feedback for freshly streamed answers always fails (FK/not-found on the synthetic 'msg-...' id) and the failure is swallowed by logError — it only works for messages reloaded from history, which have real DB ids
- **Evidence:** frontend AIAssistant.tsx:136 fabricates assistant message id `msg-${Date.now()}` and :321 renders <AIFeedback messageId={message.id}>; AIFeedback.tsx:60 posts it to /ai/feedback | backend ai.routes.ts:346-352 — the /ai/chat/persistent response returns {response, conversationId, provider, model, latencyMs} but NOT the saved assistant message's id; ai.routes.ts:371 addFeedback writes that fake id as the ai_messages FK
- **Fix:** Return the saved assistant message id from POST /ai/chat/persistent and use it when building the assistantMessage
- **Verified:** mechanical

### B09-06 — Wrong API path
- **Page:** OrderBOMDetail.tsx (/order-bom/:id)
- **Expected:** Change Width modal lists the fabric's CAD width options
- **Actual:** Fetch 404s -> error toast + modal permanently shows 'No CAD width options found for this fabric' -> Change Width feature unusable
- **Evidence:** frontend frontend/src/services/orderBom.service.ts:282 `api.get('/fabric-greige/cad/fabric/${fabricId}')` (used by Change Width modal, OrderBOMDetail.tsx:219) | backend backend/src/routes/index.ts:286 mounts fabric-greige.routes at '/fabric-management' only; the CAD route exists at /fabric-management/cad/fabric/:fabricId (fabric-greige.routes.ts:242)
- **Fix:** Change the service URL to /fabric-management/cad/fabric/${fabricId} (FabricDetail.tsx:78 already uses the correct path)
- **Verified:** mechanical

### B09-07 — Dead navigation
- **Page:** QuotationDetail.tsx (/quotations/:id)
- **Expected:** Edit on a DRAFT quotation opens QuotationForm in edit mode
- **Actual:** Navigation hits an unmatched route (blank/catch-all); QuotationForm's entire edit branch is unreachable - DRAFT quotations cannot be edited at all
- **Evidence:** frontend QuotationDetail.tsx:203 Edit button navigates to `/quotations/${id}/edit`; QuotationForm.tsx:25-26,179-180 has full edit mode keyed on useParams id | backend frontend/src/App.tsx:469-471 defines only /quotations, /quotations/new, /quotations/:id - no :id/edit route
- **Fix:** Add <Route path="/quotations/:id/edit" element={<QuotationForm />} /> in App.tsx
- **Verified:** mechanical

### B09-08 — Missing integration
- **Page:** QuotationDetail.tsx (/quotations/:id)
- **Expected:** Accepting a quotation offers/leads to order creation prefilled from the quotation (pipeline stage 5 -> 6)
- **Actual:** Acceptance is a status flip only; the user must re-enter everything via /orders/new with no link or param handoff - the documented quotation->order integration is not surfaced
- **Evidence:** frontend QuotationDetail.tsx:176-201 Accept only PUTs status=ACCEPTED; no convert-to-order action anywhere (grep 'convert' in QuotationDetail/List = 0 hits; OrderForm.tsx has zero quotation references or params) | backend docs/MODULE_RELATIONSHIPS_GUIDE.md:1241-1243 (S8.2 Order card) 'Triggered By: Quotation acceptance (quotations -> orders)'; pipeline line 851: Costing -> Quotation -> Order
- **Fix:** After ACCEPTED, show a 'Convert to Order' button navigating to /orders/new?quotationId=... and teach OrderForm to prefill from it
- **Verified:** mechanical

### B09-09 — Dead/stub UI
- **Page:** SaleOrderDetail.tsx (/sale-orders/:id)
- **Expected:** After creating a DRAFT SO, the detail page lets you add items, then confirm and allocate stock
- **Actual:** No UI exists to add items -> a UI-created DRAFT SO shows 'No items yet' forever, Confirm never appears, and the SO is a dead end (B2B-app-created SOs arrive with items and are unaffected)
- **Evidence:** frontend SaleOrderList.tsx:124 comment 'Items will be added in detail page' (creates SO with items:[]); SaleOrderDetail.tsx:128 Confirm button requires items.length>0; the Items card (lines 176-252) has no Add Item control (contrast StockProductionOrderDetail.tsx:262 which has one) | backend PUT /api/sale-orders/:id supports item replacement (saleOrder.service.ts:141-194) but no frontend code calls updateSaleOrder
- **Fix:** Add an Add/Edit Items dialog on SaleOrderDetail wired to the existing PUT /sale-orders/:id
- **Verified:** mechanical

### B09-10 — Field mismatch (silent wrong data)
- **Page:** OrderDetail.tsx (/orders/:id)
- **Expected:** Costing Details + Production Variance panel renders per order item
- **Actual:** item.orderItemCosting is always undefined so the panel silently never renders for any order (feature invisible, no error)
- **Evidence:** frontend OrderDetail.tsx:865 renderCostingDetails(item.orderItemCosting); renderCostingDetails returns null when costing is falsy (line 318) | backend backend/src/controllers/order.controller.ts:497-537 getOrderById include has order_items -> {styles, order_item_breakup} but NOT order_item_costing (relation exists on order_items, prisma/schema.prisma:1121)
- **Fix:** Add order_item_costing: true to the order_items include in getOrderById
- **Verified:** mechanical

### B09-11 — Ignored link parameter
- **Page:** OrderDetail.tsx (/orders/:id)
- **Expected:** PO list filtered to the order's purchase orders
- **Actual:** orderId is silently ignored - user lands on the full unfiltered PO list believing it is scoped to this order
- **Evidence:** frontend OrderDetail.tsx:547 navigate(`/procurement/purchase-orders?orderId=${order.id}`) ('View POs' workflow action) | backend frontend/src/pages/PurchaseOrderList.tsx:110-129 builds filters from tab/status/source/poCategory/supplierId/search/page only - zero reads of 'orderId' anywhere in the file
- **Fix:** Read searchParams.get('orderId') in PurchaseOrderList and pass it to getAllPurchaseOrders (backend PO query supports orderId filtering)
- **Verified:** mechanical

### B09-12 — Field mismatch (silent wrong data)
- **Page:** OrderBOMList.tsx (/order-bom)
- **Expected:** Items column shows each BOM's item count
- **Actual:** items is never present in the list payload -> Items column shows 0 on every row, making populated BOMs look empty
- **Evidence:** frontend OrderBOMList.tsx:152 renders `{bom.items?.length || 0}` in the Items column | backend backend/src/services/order-bom.service.ts:169-191 getListIncludes returns only order/style/_count.items - items relation not included; additionally the serializer camelizes _count to 'count' so even _count reads would fail
- **Fix:** Render the serialized count field (count.items) or include items in getListIncludes
- **Verified:** mechanical

### B12-04 — Dead navigation
- **Page:** ChartOfAccountsList.tsx (/chart-of-accounts)
- **Expected:** '+ New Account', 'Create First Account' and per-row 'Edit' buttons open a create/edit form
- **Actual:** All three buttons navigate to unregistered routes and land on the 404 NotFound page — accounts cannot be created or edited from the UI at all despite working backend endpoints
- **Evidence:** frontend frontend/src/pages/ChartOfAccountsList.tsx:109 `navigate(`/chart-of-accounts/${account.id}/edit`)`; :137 and :169 `navigate('/chart-of-accounts/new')` | backend frontend/src/App.tsx:457 registers only `/chart-of-accounts`; catch-all NotFound at App.tsx:652; no ChartOfAccountForm page exists (glob frontend/src/pages/*ChartOfAccount* → only the list). Backend create/update endpoints DO exist (backend/src/controllers/chartOfAccounts.controller.ts:11 createAccount, :244 updateAccount)
- **Fix:** Build a ChartOfAccountForm page (or dialog on the list page) and register /chart-of-accounts/new and /chart-of-accounts/:id/edit in App.tsx — or convert the buttons to an in-page dialog like TaxMasterList does
- **Verified:** mechanical

### B12-05 — Dead navigation
- **Page:** CreditNoteList.tsx (/credit-notes)
- **Expected:** Clicking a credit-note row or its View button opens a credit note detail view (backend GET /api/credit-notes/:id exists at creditNote.routes.ts:22 with full includes in creditNote.service.ts getById)
- **Actual:** Both navigations land on the 404 NotFound page; the cursor-pointer row styling and Eye button promise a detail view that does not exist
- **Evidence:** frontend frontend/src/pages/CreditNoteList.tsx:269 row `onClick={() => navigate(`/credit-notes/${cn.id}`)}` and :296 View (Eye) button with the same target | backend frontend/src/App.tsx:474 registers only `/credit-notes`; no /credit-notes/:id route and no CreditNoteDetail page exists (glob frontend/src/pages/*CreditNote* → only the list); catch-all NotFound at App.tsx:652
- **Fix:** Add a CreditNoteDetail page + /credit-notes/:id route (backend endpoint is ready), or remove the row onClick/View button until it exists
- **Verified:** mechanical

### B11-09 — Wrong API path
- **Page:** SmockingSendOut.tsx (/manufacturing/smocking/send-out)
- **Expected:** FABRIC_STOCK source option lists available fabric stock for meter-level smocking send-outs
- **Actual:** Request 404s, swallowed → fabric dropdown always empty → the fabric-source smocking flow is dead (piece-source path unaffected)
- **Evidence:** frontend SmockingSendOut.tsx:163 `api.get('/fabric-stock?limit=100')` with `.catch(() => setFabricStocks([]))` (:176) | backend routes/index.ts:288 mounts fabricStockRoutes at '/stock' — no '/fabric-stock' mount exists
- **Fix:** Change the URL to /stock?limit=100 (matching EmbroideryStockSendOut.tsx:95) and map fabricMaster fields accordingly
- **Verified:** mechanical

### B13-03 _(adjusted from P1)_ — Field mismatch (silent wrong data)
- **Page:** UserForm.tsx (/users/new)
- **Expected:** Admin 'Create User' creates the user with first/last name, department and any Prisma-valid role
- **Actual:** validateBody always returns 400 ('name' missing; SALES/PURCHASE/FACTORY_SUPERVISOR fail the drifted enum; even schema-valid bodies would then fail the controller's firstName/lastName check) - Create User is completely broken, UI shows only 'Failed to save'
- **Evidence:** frontend frontend/src/pages/UserForm.tsx:63-72 posts {email,password,firstName,lastName,phone,role,department}; role options include SALES/PURCHASE/FACTORY_SUPERVISOR (lines 139-147) | backend backend/src/schemas/user.schema.ts:34-42 createUserSchema requires `name` (absent from payload) and UserRoleEnum (lines 14-24) lacks SALES/PURCHASE/FACTORY_SUPERVISOR present in Prisma UserRole (schema.prisma:9078-9088); controller expects firstName/lastName (user.controller.ts:103-107)
- **Fix:** Rewrite createUserSchema to firstName/lastName/phone/role/department and align UserRoleEnum with the Prisma UserRole enum (as auth.schema.ts:38-48 already does)
- **Verified:** DOWNGRADED

### B13-05 — Dead navigation
- **Page:** FabricPhysicalTests.tsx (/fabric-physical-tests)
- **Expected:** 'New Test' opens an FPT create form; clicking a test card opens its detail
- **Actual:** Both navigations land on the NotFound page - no FPT create/detail pages exist (consistent with the missing backend, B13-01)
- **Evidence:** frontend FabricPhysicalTests.tsx:96,142 navigate('/fabric-physical-tests/new'); line 153 navigate(`/fabric-physical-tests/${test.id}`); TestingDashboard.tsx:355 same /new | backend frontend/src/App.tsx:630 defines only /fabric-physical-tests; no /new or /:id route - falls into catch-all NotFound (App.tsx:652)
- **Fix:** Create FabricPhysicalTestForm/Detail pages and register /fabric-physical-tests/new and /:id routes (blocked on B13-01)
- **Verified:** mechanical

### B13-06 — Dead navigation
- **Page:** GarmentPhysicalTests.tsx (/garment-physical-tests)
- **Expected:** 'Create GPT' opens a create form; clicking a test opens detail (backend endpoints fully exist and are validated)
- **Actual:** Both navigations land on NotFound - GPT records can never be created or inspected in detail from the UI despite a complete backend
- **Evidence:** frontend GarmentPhysicalTests.tsx:115,162 navigate('/garment-physical-tests/new'); line 173 navigate(`/garment-physical-tests/${test.id}`); TestingDashboard.tsx:377 same /new | backend frontend/src/App.tsx:631 defines only /garment-physical-tests; no /new or /:id route -> NotFound (App.tsx:652); backend POST/GET-by-id DO exist (garmentPhysicalTests.routes.ts:31-33) but have no UI
- **Fix:** Build GarmentPhysicalTestForm/Detail pages and register /garment-physical-tests/new and /:id routes
- **Verified:** mechanical

### B13-07 — Dead navigation
- **Page:** TestingLabs.tsx (/testing-labs)
- **Expected:** Add/Edit/View lab pages reachable from the list
- **Actual:** All three actions land on NotFound - labs cannot be created or edited via UI even though the backend CRUD is complete
- **Evidence:** frontend TestingLabs.tsx:70,97 navigate('/testing-labs/new'); line 180 `/testing-labs/${lab.id}/edit`; line 185 `/testing-labs/${lab.id}` | backend frontend/src/App.tsx:632 defines only /testing-labs; no /new, /:id, /:id/edit routes -> NotFound; backend CRUD exists (testingLabs.routes.ts)
- **Fix:** Build TestingLabForm/Detail pages and register /testing-labs/new, /:id, /:id/edit routes
- **Verified:** mechanical

### B13-08 — Dead navigation
- **Page:** TestTemplates.tsx (/test-templates)
- **Expected:** Create/Edit/View template pages reachable from the list
- **Actual:** All three actions land on NotFound - test templates cannot be created or edited via UI
- **Evidence:** frontend TestTemplates.tsx:80,124 navigate('/test-templates/new'); line 213 `/test-templates/${template.id}/edit`; line 217 `/test-templates/${template.id}` | backend frontend/src/App.tsx:633 defines only /test-templates; no /new, /:id, /:id/edit routes -> NotFound; backend CRUD exists (testTemplates.routes.ts)
- **Fix:** Build TestTemplateForm/Detail pages and register /test-templates/new, /:id, /:id/edit routes
- **Verified:** mechanical

### B13-09 — Field mismatch (silent wrong data)
- **Page:** PendingUsersPage.tsx (/users/pending)
- **Expected:** Reject deletes the pending registration
- **Actual:** Every Reject click returns 400 ('Rejection reason is required') - rejection flow is unusable; approve works (approveUserSchema all-optional)
- **Evidence:** frontend frontend/src/services/user.service.ts:71-73 `api.post('/users/${id}/reject')` with no body (PendingUsersPage.tsx:71) | backend backend/src/routes/user.routes.ts:68-74 applies validateBody(rejectUserSchema); user.schema.ts:86-88 requires `reason` min 1; controller never reads reason (user.controller.ts:484-510)
- **Fix:** Either make `reason` optional in rejectUserSchema or add a reason field to the reject dialog and send it
- **Verified:** mechanical

### B13-11 — Ignored link parameter
- **Page:** GarmentPhysicalTests.tsx (/garment-physical-tests)
- **Expected:** Dashboard 'Review N failed / N pending buyer approval' buttons open the GPT list pre-filtered
- **Actual:** Params silently ignored - user clicks 'Review 3 Failed' and sees the full unfiltered list, which reads as wrong data
- **Evidence:** frontend TestingDashboard.tsx:318,385 navigate('/garment-physical-tests?status=FAIL|PENDING'); line 335 '?pendingBuyerApproval=true' | backend GarmentPhysicalTests.tsx has no useSearchParams; statusFilter initialized 'all' (line 18) and no pendingBuyerApproval filter exists in the page, though the API supports it (testing.schemas.ts:326)
- **Fix:** Read status and pendingBuyerApproval from searchParams in GarmentPhysicalTests.tsx and pass to getAll
- **Verified:** mechanical

### B13-12 — Field mismatch (silent wrong data)
- **Page:** PermissionManagement.tsx (/admin/permissions)
- **Expected:** Admin can toggle any permission for any of the 9 real roles
- **Actual:** Toggling any switch in the SALES, PURCHASE or FACTORY_SUPERVISOR columns always 400s and rolls back ('Failed to update permission') - permissions for 3 of 9 roles are unmanageable
- **Evidence:** frontend PermissionManagement.tsx:152 togglePermission({role, permissionKey, allowed}) for all 9 roles incl. UserRole.SALES/PURCHASE/FACTORY_SUPERVISOR (ROLE_CONFIG lines 33-43) | backend backend/src/schemas/permission.schema.ts:14-24 UserRoleEnum omits SALES/PURCHASE/FACTORY_SUPERVISOR (has CUTTING/STITCHING/USER instead); Prisma UserRole has them (schema.prisma:9078-9088); route validateBody(togglePermissionSchema) at permission.routes.ts:90
- **Fix:** Align permission.schema.ts UserRoleEnum (and user.schema.ts's identical copy) with the Prisma UserRole enum
- **Verified:** mechanical

### B13-13 — Dead/stub UI
- **Page:** UserForm.tsx (/users/edit/:id)
- **Expected:** Changing the role in the edit form updates the user's role
- **Actual:** Role selection is silently discarded on edit - admin sees success (once B13-02 is fixed) but role never changes
- **Evidence:** frontend UserForm.tsx:134-148 renders a role <select> in both modes, but edit-mode updateData (lines 74-81) omits role and userService.updateUserRole (user.service.ts:38-41, PUT /users/:id/role exists at user.routes.ts:102) is never called | backend backend/src/routes/user.routes.ts:95 PUT /users/:id schema/controller do not accept role either
- **Fix:** On edit, call updateUserRole(id, role) when the role changed (endpoint already exists)
- **Verified:** mechanical

### B14-01 _(adjusted from P1)_ — Dead endpoint
- **Page:** CostSheetDetail.tsx (/cost-sheets/:id)
- **Expected:** Reject button sets approvalStatus=REJECTED with rejection notes
- **Actual:** PATCH /api/style-costing/:id/reject 404s every time; the REJECTED state is unreachable from the UI on both pages, so the rejection-notes banners (CostSheetDetail.tsx:318, CostSheetList.tsx:407) can never be populated
- **Evidence:** frontend frontend/src/services/costSheet.service.ts:115 `api.patch(`${BASE_URL}/${id}/reject`, { rejectionNotes })` - invoked by Reject dialogs at CostSheetDetail.tsx:128 and CostSheetList.tsx:207 | backend backend/src/routes/styleCosting.routes.ts has no /:id/reject route; rejection is only reachable via PATCH /:id/approve (line 160) with body {action:'reject', rejectionNotes} (style-costing-approval.controller.ts:39-47). Legacy approved=false maps to PENDING, not REJECTED (controller line 55)
- **Fix:** In costSheet.service.ts rejectCostSheet, call PATCH `${BASE_URL}/${id}/approve` with body { action: 'reject', rejectionNotes }
- **Verified:** DOWNGRADED

### B14-02 — Dead/stub UI
- **Page:** CostSheetList.tsx (/cost-sheets)
- **Expected:** Export button downloads cost-sheet CSV/Excel/PDF
- **Actual:** Every export attempt errors with unsupported-module 500; button is dead on this page
- **Evidence:** frontend frontend/src/pages/CostSheetList.tsx:224 `<ExportButton module="style_costing" filters={{approved: approvedFilter}} />` -> export.service.ts:13 POST /export/style_costing | backend backend/src/controllers/export.controller.ts:110-183 fetchModuleData switch has no 'style_costing' case - default throws `Module 'style_costing' not supported for export`
- **Fix:** Add a 'style_costing' case (prisma.style_costing.findMany + default columns) to fetchModuleData, or remove the ExportButton from CostSheetList
- **Verified:** mechanical

### B14-03 — Field mismatch (silent wrong data)
- **Page:** CatalogueGenerator.tsx (/catalogue-generator)
- **Expected:** Category filter dropdown shows category names
- **Actual:** cat.categoryName is always undefined - every category option renders with a blank label, making the filter unusable by sight
- **Evidence:** frontend frontend/src/pages/CatalogueGenerator.tsx:77-80 `interface ProductCategory { id; categoryName }` and :725 renders `{cat.categoryName}` in the Category filter dropdown | backend backend/prisma/schema.prisma:1605 product_category_master has `name` (no categoryName); GET /api/product-categories returns raw model rows (productCategory.controller.ts:34-43, productCategory.service.ts:243-266)
- **Fix:** Rename interface field to `name` and render `{cat.name}` (matches style.productCategory?.name used at line 909)
- **Verified:** mechanical

### B14-06 — Field mismatch (silent wrong data)
- **Page:** MoodBoardDetail.tsx (/mood-boards/new)
- **Expected:** items initialized to [] after creating a board so images/text/color items can be added immediately
- **Actual:** items state becomes undefined on a freshly created board (URL is history.replaceState'd, so no refetch); the first addItem spreads undefined -> TypeError, breaking item adds until a full page reload
- **Evidence:** frontend frontend/src/pages/MoodBoardDetail.tsx:124 `setItems(created.items)` after create; first add then runs `setItems((prev) => [...prev, newItem])` (line 185) | backend backend/src/services/mood-board.service.ts:65-94 create() includes only season/createdBy/_count - no items array; controller returns it as-is (mood-board.controller.ts:42-45)
- **Fix:** Frontend: `setItems(created.items ?? [])` at MoodBoardDetail.tsx:124 (or backend: include items: true in create response)
- **Verified:** CONFIRMED

### B15-06 — Ignored link parameter
- **Page:** dashboards/AccountsDashboard.tsx (/dashboard/accounts)
- **Expected:** Clicking 'Outstanding Invoices'/'Overdue Amount' opens InvoiceList pre-filtered to that status
- **Actual:** InvoiceList never reads the status query param, so both cards open the full unfiltered invoice list — the drill-down promise of the KPI card is silently dropped
- **Evidence:** frontend AccountsDashboard.tsx:112,120 — navigate('/invoices?status=PENDING') and navigate('/invoices?status=OVERDUE') | backend frontend/src/pages/InvoiceList.tsx — no useSearchParams/useLocation/window.location anywhere in the file (grep verified)
- **Fix:** Seed InvoiceList's status filter state from useSearchParams().get('status'), or drop the query params from the nav
- **Verified:** mechanical

### B15-07 — Ignored link parameter
- **Page:** dashboards/ProductionDashboard.tsx (/dashboard/production)
- **Expected:** 'Orders in Production' and 'Overdue Orders' cards open WorkOrderList pre-filtered
- **Actual:** WorkOrderList ignores both status and overdue params; users land on the unfiltered list and cannot tell which orders are the overdue ones the card counted
- **Evidence:** frontend ProductionDashboard.tsx:106,131 — navigate('/production/work-orders?status=IN_PRODUCTION') and navigate('/production/work-orders?overdue=true') | backend frontend/src/pages/WorkOrderList.tsx — no useSearchParams/useLocation/window.location anywhere in the file (grep verified)
- **Fix:** Read status/overdue via useSearchParams in WorkOrderList and seed its filters, or remove the params
- **Verified:** mechanical

### B15-08 — Ignored link parameter
- **Page:** dashboards/SalesDashboard.tsx (/dashboard/sales)
- **Expected:** 'Pending Quotations' card opens QuotationList filtered to SENT
- **Actual:** QuotationList never reads the status param; opens unfiltered list
- **Evidence:** frontend SalesDashboard.tsx:128 — navigate('/quotations?status=SENT') | backend frontend/src/pages/QuotationList.tsx — no useSearchParams/useLocation/window.location anywhere in the file (grep verified)
- **Fix:** Seed QuotationList's status filter from useSearchParams().get('status'), or drop the param
- **Verified:** mechanical

## P3 (53)

### B02-08 — Orphan page
- **Page:** LaceDefectList.tsx (/lace-defects)
- **Expected:** Lace defect tracking reachable from the UI (e.g., sidebar or a link from LaceList/lace stock pages)
- **Actual:** LaceDefectList + LaceDefectForm form a closed island only reachable by typing the URL
- **Evidence:** frontend Batch: sidebar=false, inbound only LaceDefectForm; repo-wide grep for 'lace-defects' finds only self-references in the two pages, the service, and App.tsx:367-369 route registration — no sidebar entry, no link from any lace page | backend routes exist and work (laceDefect.routes.ts) — feature is built but unreachable
- **Fix:** Keep: add a sidebar entry (Materials section) or a 'Defects' link on LaceList/lace stock pages — the module is functional except B02-07/09
- **Verified:** mechanical

### B02-09 — Field mismatch (silent wrong data)
- **Page:** LaceDefectList.tsx (/lace-defects)
- **Expected:** Selecting a defect-type filter narrows the list
- **Actual:** Any defect-type filter selection makes GET /api/lace-defects return 400 and the list shows an error
- **Evidence:** frontend LaceDefectList.tsx:82 `if (defectTypeFilter) filters.defectType = defectTypeFilter` with values from DEFECT_TYPE_LABELS (WEAVE_DEFECT family, laceDefect.types.ts:167-172) | backend laceDefect.schema.ts:85 laceDefectQuerySchema.defectType = DefectTypeEnum (WEAVING_FAULT family) → validateQuery 400
- **Fix:** Align DefectTypeEnum in laceDefect.schema.ts with the controller/frontend WEAVE_DEFECT family (same fix as B02-07)
- **Verified:** mechanical

### B02-10 — Orphan page
- **Page:** LaceLabDipList.tsx (/lace-lab-dips)
- **Expected:** Lab dip approval workflow reachable from the greige-lace processing flow
- **Actual:** LaceLabDipList + LaceLabDipForm form a closed island only reachable by typing the URL
- **Evidence:** frontend Batch: sidebar=false, inbound only LaceLabDipForm; repo-wide grep for 'lace-lab-dips' finds only the two pages, the service, and App.tsx:357-360 — no sidebar entry, no link from LaceForm/LaceList/greige workflows | backend laceLabDip.routes.ts fully functional; form payloads verified aligned
- **Fix:** Keep: add sidebar entry or a 'Lab Dips' button on greige LaceDetail/LaceForm (backend + forms already work)
- **Verified:** mechanical

### B01-06 — Field mismatch (silent wrong data)
- **Page:** StyleStockEntry.tsx (/styles/:styleId/stock-entry)
- **Expected:** Fabric header shows CAD consumption with its width, e.g. 'CAD: 1.25 meters @ 58" width'
- **Actual:** Renders 'CAD: 1.25 meters @ " width' - width always missing
- **Evidence:** frontend frontend/src/pages/StyleStockEntry.tsx:330-331 `CAD: {fabric.widthCADs[0].cadMeters?.toFixed(2)} meters @ {fabric.widthCADs[0].availableWidth}" width` | backend backend/src/services/fabric-stock.service.ts:581 `widthCADs: sf.fabric?.widthCADs` passes raw fabric_width_cad rows (column cutableWidth, schema.prisma:4252) - availableWidth never present
- **Fix:** Use fabric.widthCADs[0].cutableWidth
- **Verified:** mechanical

### B01-08 — Ignored link parameter
- **Page:** FabricDetail.tsx (/fabric/:id)
- **Expected:** Add Stock from a generic fabric's detail page preselects that fabric on the stock entry form (GreigeDetail->GreigeStockEntry does exactly this with greigeId)
- **Actual:** fabricId query param is ignored; user must re-find the fabric in the dropdown
- **Evidence:** frontend frontend/src/pages/FabricDetail.tsx:177 navigate(`/fabric-stock-entry?fabricId=${id}`); target frontend/src/pages/FabricStockEntry.tsx has no useSearchParams / never reads fabricId (grep: only local handler vars) | backend n/a
- **Fix:** In FabricStockEntry read searchParams.get('fabricId') and preselect it after loadFabricList (mirror GreigeStockEntry.tsx:33-34,78-84)
- **Verified:** mechanical

### B01-09 — Dead endpoint
- **Page:** GreigeAvailableStock.tsx (/greige-stock)
- **Expected:** greigeStockService.deleteStock targets an existing endpoint (or does not exist)
- **Actual:** Service method targets a nonexistent DELETE route; any future UI wiring of stock-entry deletion will silently 404
- **Evidence:** frontend frontend/src/services/greigeStock.service.ts:90-91 deleteStock -> api.delete(`/greige/stock/${stockId}`); no page currently calls it (grep: definition only) | backend no-route: backend/src/routes/greige-stock.routes.ts defines POST/GET/PATCH and POST /stock/:stockId/adjust but no DELETE (lines 25-129)
- **Fix:** Either add DELETE /stock/:stockId to greige-stock.routes.ts (with material-sync) or delete the unused service method
- **Verified:** mechanical

### B01-10 — Dead/stub UI
- **Page:** FabricAvailableStock.tsx (/fabric-stock)
- **Expected:** Stock rows for fabrics awaiting embroidery show a 'Needs Embroidery' badge
- **Actual:** needsEmbroidery is always undefined so the badge can never render (dead UI)
- **Evidence:** frontend frontend/src/pages/FabricAvailableStock.tsx:459-463 renders 'Needs Embroidery' badge when stock.needsEmbroidery is truthy (interface field at :62) | backend backend/src/controllers/fabric-stock.controller.ts:316-368 listStock response object never includes needsEmbroidery (only patternParts[].goesToEmbroidery)
- **Fix:** Derive needsEmbroidery in listStock (e.g. patternParts.some(goesToEmbroidery) && no embroideryId) or compute it client-side from stock.fabric.patternParts
- **Verified:** mechanical

### B03-03 — Dead navigation
- **Page:** SizeCategoryList.tsx (/masters/size-categories)
- **Expected:** Clicking a row opens the size category's detail or edit view
- **Actual:** Row click changes the URL but re-renders the identical list page — a no-op
- **Evidence:** frontend frontend/src/pages/SizeCategoryList.tsx:195 — `onRowClick={(category) => navigate(`/masters/size-categories/${category.id}`)}` | backend frontend/src/App.tsx:404 — `<Route path="/masters/size-categories/:id" element={<SizeCategoryList />} />` renders the list again (batch metadata claiming targetPage=SizeCategoryForm is wrong)
- **Fix:** Point onRowClick at `/masters/size-categories/${id}/edit` (or map the :id route to the form/detail component)
- **Verified:** mechanical

### B03-04 — Orphan page
- **Page:** TemplateManager.tsx ((none))
- **Expected:** Page reachable via a route + sidebar/settings entry, since the export-template backend is fully functional
- **Actual:** One of the 6 known-dead pages: no route in App.tsx and no inbound navigation — completely unreachable
- **Evidence:** frontend frontend/src/pages/TemplateManager.tsx — full CRUD UI for export templates; batch: routes=[], inbound=[], sidebar=false | backend backend/src/routes/template.routes.ts:21-84 — all 7 endpoints exist and are registered; controller keys (templates/template/modules/columns) match template.service.ts reads
- **Fix:** Keep: register a route (e.g. /settings/export-templates) + sidebar entry, since backend and service layers are complete and healthy; otherwise delete the page and template.service.ts together
- **Verified:** mechanical

### B03-05 — Ignored link parameter
- **Page:** PatternPartMaster.tsx (/pattern-parts)
- **Expected:** The service's activeOnly param filters pattern parts by active status
- **Actual:** activeOnly is silently stripped and the isActive path is double-transformed to a dead comparison — active-status filtering of pattern parts is impossible from the frontend. Currently benign: the only caller passes activeOnly:false wanting all rows, and all rows are returned
- **Evidence:** frontend frontend/src/services/patternPart.service.ts:14-24 — getAllPatternParts sends `activeOnly` (PatternPartMaster.tsx:56 passes activeOnly:false) | backend backend/src/schemas/patternPart.schema.ts:90-99 — query schema only defines `isActive` (activeOnly is stripped by validateQuery); additionally patternPart.controller.ts:46 compares `req.query.isActive === 'true'` after validation.middleware.ts:55-60 has already transformed it to a boolean, so even isActive can never activate the filter
- **Fix:** Rename the frontend param to isActive and have the controller use the validated boolean directly (`query.isActive === true`)
- **Verified:** mechanical

### B03-06 — Dead/stub UI
- **Page:** ColorMasterList.tsx (/colors)
- **Expected:** Status column distinguishes active/inactive colors and deactivated colors remain reachable for re-activation
- **Actual:** List only ever shows active colors: the Status column can only display 'Active', and a color switched off in ColorMasterForm's Active toggle becomes unreachable through the UI
- **Evidence:** frontend frontend/src/pages/ColorMasterList.tsx:59 — fetchColors hardcodes `isActive: true`; Status column at lines 142-147 renders Active/Inactive badges | backend backend/src/routes/color.routes.ts:75 + colorQuerySchema honor the isActive filter, so inactive colors are always excluded
- **Fix:** Add an active-status filter (All/Active/Inactive) next to the family filter and pass it through to getAll
- **Verified:** mechanical

### B03-07 — Dead/stub UI
- **Page:** SeasonMasterList.tsx (/seasons)
- **Expected:** Deactivated seasons visible/reachable so they can be re-activated (SeasonMasterForm has an Active switch)
- **Actual:** Only active seasons ever load; Status badge can only show 'Active' and a deactivated season is permanently invisible in the UI
- **Evidence:** frontend frontend/src/pages/SeasonMasterList.tsx:77 — fetchSeasons hardcodes `isActive: true`; Status column at lines 183-188 renders Active/Inactive badges | backend backend/src/schemas/season.schema.ts:79-82 — seasonQuerySchema honors isActive, so inactive seasons are always excluded
- **Fix:** Add an active-status filter (All/Active/Inactive) and pass it through seasonService.getAll
- **Verified:** mechanical

### B03-08 — Dead/stub UI
- **Page:** ProductCategoryMaster.tsx (/product-categories)
- **Expected:** Tree shows inactive categories greyed-out so the toggle can re-activate them
- **Actual:** The inactive-state UI is dead code: deactivating a category (PATCH :id/toggle-active) removes it and its entire subtree from the tree with no way to re-activate from this page
- **Evidence:** frontend frontend/src/pages/ProductCategoryMaster.tsx:81-83,120-124,153-160 — TreeNode has inactive styling (opacity-50), an 'Inactive' badge and a toggle-active Switch per node | backend backend/src/services/productCategory.service.ts:271-278 — getHierarchy filters `isActive: true` (recursively), so inactive categories and their subtrees are never returned
- **Fix:** Return inactive nodes from getHierarchy (or add a showInactive query param the page passes) so the existing inactive styling/toggle work
- **Verified:** mechanical

### B03-09 — Dead/stub UI
- **Page:** MasterDataDashboard.tsx (/master-data)
- **Expected:** An API failure shows an error state
- **Actual:** On failure the page silently renders 'Total Masters 0' with no category cards and no error message — failed call masked as empty data
- **Evidence:** frontend frontend/src/pages/MasterDataDashboard.tsx:49-59 — loadSummary catch only does console.error; summary stays null, totals stay {0,0,0} | backend backend/src/routes/masterDataDashboard.routes.ts:14 — route exists (probe 200), issue is failure-path only
- **Fix:** Set an error state in the catch and render an alert with a retry button
- **Verified:** mechanical

### B04-06 — Field mismatch (silent wrong data)
- **Page:** CustomerDetail.tsx (/customers/:id)
- **Expected:** Detail header shows the customer's order/quotation/invoice counts
- **Actual:** The counts block never renders (guard is always false) - double-broken with B04-01
- **Evidence:** frontend CustomerDetail.tsx:189-194 renders Orders/Quotations/Invoices from `customer._count && ...` | backend backend/src/services/customer.service.ts:231-241 puts _count only in getListIncludes(); base.service.ts:135-140 findById/findByIdOrThrow use getDefaultIncludes() which has no _count
- **Fix:** Override findById in CustomerService to use getListIncludes() (or add _count to getDefaultIncludes)
- **Verified:** mechanical

### B04-07 — Field mismatch (silent wrong data)
- **Page:** SupplierDetail.tsx (/suppliers/:id)
- **Expected:** Supplier detail shows PO/Materials/GRN counts; list Stats shows POs and Materials
- **Actual:** Detail counts block never renders (no _count in findById includes); list `Materials` would still be undefined even after fixing B04-01 because backend sends materialSuppliers
- **Evidence:** frontend SupplierDetail.tsx:153-158 reads `supplier._count.purchaseOrders/.materials/.goodsReceivingNotes`; SupplierList.tsx:225 reads `_count.materials` | backend backend/src/services/supplier.service.ts:146-158 _count only in getListIncludes() (findById uses getDefaultIncludes without it), and its keys are materialSuppliers/purchase_orders/goods_receiving_notes - there is no `materials` key even on the list
- **Fix:** Add _count to supplier findById includes and read materialSuppliers (or alias it to materials) in SupplierList/SupplierDetail
- **Verified:** mechanical

### B04-08 — Field mismatch (silent wrong data)
- **Page:** SupplierDetail.tsx (/suppliers/:id)
- **Expected:** System Information card shows Created By name
- **Actual:** `supplier.createdBy` is always undefined - the Created By block never renders
- **Evidence:** frontend SupplierDetail.tsx:380-385 `supplier.createdBy && ... {supplier.createdBy.firstName}` | backend backend/src/services/supplier.service.ts:97 includes relation `users` (suppliers.users -> createdById, schema.prisma:2589); serializer.ts:339 RELATION_MAPPINGS maps users->'users', so the response key is `users`, never `createdBy`
- **Fix:** Read `supplier.users` in SupplierDetail (or add a suppliers-scoped users->createdBy serializer mapping)
- **Verified:** mechanical

### B05-10 — Dead/stub UI
- **Page:** MaterialMasterList.tsx (/material-master)
- **Expected:** View button opens a material detail view
- **Actual:** Navigates back to the same list (the :id is ignored) - button does nothing useful
- **Evidence:** frontend MaterialMasterList.tsx:303-310 Eye 'View' button navigates to /material-master/${id} | backend App.tsx:346 `<Route path="/material-master/:id" element={<MaterialMasterList />} />` - renders the list again; MaterialMasterList never reads useParams id (no detail view exists)
- **Fix:** Remove the View button or route /material-master/:id to a read-only MaterialMasterForm/detail view
- **Verified:** mechanical

### B05-11 — Dead/stub UI
- **Page:** EmbroideryForm.tsx (/embroidery/new)
- **Expected:** Either the field persists or it is not offered
- **Actual:** Value the user types is silently dropped (passthrough schema, controller ignores); the Detail block reading minFabricWidth can never render - the backend fix removed the field but the frontend remnants remain
- **Evidence:** frontend EmbroideryForm.tsx:318-329 'Minimum Fabric Width' input, sent in payload line 153; EmbroideryDetail.tsx:189-194 renders embroidery.minFabricWidth block | backend embroidery.schema.ts:29 comment 'minFabricWidth removed: no such column on embroidery_master (bug-hunt samples-embroidery-9)'; createEmbroidery controller (embroidery.controller.ts:39-101) never reads it; schema.prisma embroidery_master has no such column
- **Fix:** Remove the minFabricWidth input from EmbroideryForm and the block from EmbroideryDetail (or add the column end-to-end)
- **Verified:** mechanical

### B05-12 — Field mismatch (silent wrong data)
- **Page:** MaterialDetail.tsx (/materials/raw/:id)
- **Expected:** Stock Levels card shows the warehouse location name/code per row
- **Actual:** stock.location is always undefined -> every row displays 'Unknown Location' with blank code even when a location is linked
- **Evidence:** frontend MaterialDetail.tsx:252-254 `stock.location?.locationName || 'Unknown Location'` / stock.location?.locationCode | backend material.controller.ts:370-374 include `inventory_stock: { include: { locations: true } }`; serializer.ts:356 maps locations->'locations' (stays plural) - response key is stock.locations, never stock.location
- **Fix:** Read stock.locations?.locationName in MaterialDetail (or map the relation to singular in the controller response)
- **Verified:** mechanical

### B06-08 — Ignored link parameter
- **Page:** WorkOrderDetail.tsx (/production/work-orders/:id)
- **Expected:** 'View Batches' / 'View Issues' land on lists filtered to this work order
- **Actual:** All three targets ignore the query string and show the unfiltered global list — the WO scoping promised by the link is silently lost
- **Evidence:** frontend WorkOrderDetail.tsx:812 `/manufacturing/cutting?workOrderId=${id}` ('View Batches'), :852 stitching, :897 finishing — but CuttingList.tsx, StitchingList.tsx, FinishingList.tsx contain no useSearchParams at all (grep: 0 matches) | backend the list APIs DO support the filter: cutting.controller.ts:41-42, stitching.controller.ts:171, finishing.controller.ts:231-232 all honor ?workOrderId
- **Fix:** Initialize the three list pages' filter state from searchParams.get('workOrderId') and pass it to their getAll calls
- **Verified:** mechanical

### B06-09 — Ignored link parameter
- **Page:** WorkOrderDetail.tsx (/production/work-orders/:id)
- **Expected:** Forms open scoped/prefiltered to the work order the user came from
- **Actual:** workOrderId is silently dropped; forms open showing pending slips for ALL work orders
- **Evidence:** frontend WorkOrderDetail.tsx:845 'Start Stitching' → /manufacturing/stitching/new?workOrderId=; :890 'Start Finishing' → /manufacturing/finishing/new?workOrderId=; StitchingForm.tsx:67 and FinishingForm.tsx:40 read ONLY transferSlipId | backend n/a
- **Fix:** Have StitchingForm/FinishingForm read workOrderId and pre-filter/pre-group their pending-slip lists to that WO
- **Verified:** mechanical

### B06-10 — Ignored link parameter
- **Page:** WorkOrderDetail.tsx (/production/work-orders/:id)
- **Expected:** Challan list filtered to this production run; new-challan form prefilled with the production run
- **Actual:** productionRunId dropped by both targets — unfiltered challan list and unprefilled form
- **Evidence:** frontend WorkOrderDetail.tsx:1138 `/manufacturing/challans?productionRunId=${id}`, :1146 `/manufacturing/challans/new?productionRunId=${id}`; ChallanList.tsx:23-24 reads only challanType/status; ChallanForm.tsx has no useSearchParams/location.state and never mentions productionRunId (grep: 0 matches) | backend n/a
- **Fix:** Read productionRunId in ChallanList (as a filter) and ChallanForm (as prefill)
- **Verified:** mechanical

### B06-11 — Ignored link parameter
- **Page:** StitchingDetail.tsx (/manufacturing/stitching/:id)
- **Expected:** 'Go to Finishing' pre-selects the transfer slip that was just generated
- **Actual:** Navigates without the param, so the user must manually locate the slip on FinishingForm
- **Evidence:** frontend StitchingDetail.tsx:491 `navigate('/manufacturing/finishing/new')` inside the 'Transfer Slip Generated' card where `transferSlip.id` is in scope; FinishingForm.tsx:40 supports ?transferSlipId= prefill (FinishingList.tsx:496 already uses it) | backend n/a
- **Fix:** Navigate to `/manufacturing/finishing/new?transferSlipId=${transferSlip.id}`
- **Verified:** mechanical

### B07-06 — Dead navigation
- **Page:** LaceStockList.tsx (/lace-stock)
- **Expected:** Aging Report button opens a lace stock aging report
- **Actual:** Route param capture sends 'aging-report' as a stock id to LaceStockDetail → uuid param validation 400 → 'Stock not found'; getAgingReport()/getUtilizationReport() service fns are never used
- **Evidence:** frontend frontend/src/pages/LaceStockList.tsx:144 navigate('/lace-stock/aging-report') | backend frontend/src/App.tsx:363-364 — only /lace-stock and /lace-stock/:id registered; 'aging-report' is captured as :id; backend GET /api/lace-stock/reports/aging exists but no page consumes it
- **Fix:** Build an aging-report page on GET /lace-stock/reports/aging and register /lace-stock/aging-report BEFORE /lace-stock/:id, or remove the button
- **Verified:** mechanical

### B07-07 — Dead navigation
- **Page:** LaceStockList.tsx (/lace-stock)
- **Expected:** Row Transfer icon opens the transfer flow
- **Actual:** Navigates to an unregistered route → NotFound page
- **Evidence:** frontend frontend/src/pages/LaceStockList.tsx:365 navigate(`/lace-stock/${stock.id}/transfer`) | backend frontend/src/App.tsx — no /lace-stock/:id/transfer route (batch matchedRoute=false); catch-all at App.tsx:652 renders NotFound
- **Fix:** Navigate to /lace-stock/${stock.id} (transfer modal lives on the detail page) instead
- **Verified:** mechanical

### B07-08 — Orphan page
- **Page:** LaceStockList.tsx (/lace-stock)
- **Expected:** Lace stock UI reachable from sidebar or from Lace master/Stock dashboard (StockDashboard links fabric-stock and greige-stock but not lace-stock)
- **Actual:** The /lace-stock + /lace-stock/:id cluster is unreachable except by typing the URL — the whole lace stock UI is orphaned
- **Evidence:** frontend grep '/lace-stock' across frontend/src: only self-references (LaceStockList/LaceStockDetail/laceStock.service) + App.tsx:363-364; no Sidebar entry (batch sidebar:false), no other page navigates in | backend backend/src/routes/laceStock.routes.ts — live module with 11 routes
- **Fix:** KEEP and add a sidebar entry (and/or a StockDashboard 'Lace Stock' card) — backend module is functional; fix B07-01..05 alongside
- **Verified:** mechanical

### B07-14 — Dead/stub UI
- **Page:** StockCountList.tsx (/inventory/stock-counts)
- **Expected:** Choosing 'All' clears the status/type filter
- **Actual:** Literal string 'all' is sent as an enum filter → Prisma enum validation error / empty list; once a user filters they cannot get back to the unfiltered view without reloading
- **Evidence:** frontend frontend/src/pages/StockCountList.tsx:184-196,201-211 — SelectItem value="all" while onValueChange casts value straight into statusFilter/typeFilter; loadCounts (45-48) then sends status='all'/countType='all' | backend backend/src/controllers/stockCount.controller.ts:30-31 — passes status/countType through unvalidated into Prisma where on CountStatus/CountType enums
- **Fix:** Map 'all' to '' in onValueChange (value === 'all' ? '' : value) like LaceStockList does with '__all__'
- **Verified:** mechanical

### B07-16 — Dead/stub UI
- **Page:** FabricUsageReport.tsx (/reports/fabric-usage)
- **Expected:** Per-style Allocated and Consumed meters for the fabric
- **Actual:** Two permanent stub columns that always render '-' — panel promises data nothing populates
- **Evidence:** frontend frontend/src/pages/FabricUsageReport.tsx:239-240 — 'Allocated' and 'Consumed' cells hardcoded to '-' for every style row (columns declared at 220-226) | backend backend/src/controllers/style-stock.controller.ts:132-149 getFabricStyles returns styles without allocation/consumption figures
- **Fix:** Populate from fabric_stock_allocation aggregates in getStylesByFabric, or drop the two columns
- **Verified:** mechanical

### B08-08 — Orphan page
- **Page:** MRPDashboard.tsx ((none))
- **Expected:** Page is reachable or deleted
- **Actual:** Known-dead orphan superseded by UnifiedRequirementsPage; also contains internally dead navs to unregistered /mrp/requirements/:id (lines 240, 299) — moot while orphaned
- **Evidence:** frontend batch dossier: routes [], sidebar false, inbound []; frontend/src/App.tsx:531-534 redirects /mrp and /mrp/requirements to /procurement/requirements?tab=material | backend n/a
- **Fix:** Delete the file (UnifiedRequirementsPage + redirects fully replace it); salvage nothing
- **Verified:** mechanical

### B08-09 — Orphan page
- **Page:** MaterialRequirementsList.tsx ((none))
- **Expected:** Page is reachable or deleted
- **Actual:** Known-dead orphan; its functionality (requirements list, vendor suggestion, generate-po) is duplicated by UnifiedRequirementsPage MaterialRequirementsTab
- **Evidence:** frontend batch dossier: routes [], sidebar false, inbound []; frontend/src/App.tsx:533-534 redirects its old /mrp/requirements URL to /procurement/requirements?tab=material | backend n/a
- **Fix:** Delete the file
- **Verified:** mechanical

### B08-10 — Orphan page
- **Page:** ServiceRequirementsDashboard.tsx ((none))
- **Expected:** Page is reachable or deleted
- **Actual:** Known-dead orphan; also carries dead navs to unregistered /work-orders and /work-orders/:id (lines 206, 263, 317) — moot while orphaned
- **Evidence:** frontend batch dossier: routes [], sidebar false, inbound []; frontend/src/App.tsx:537-538 redirects /service-requirements to /procurement/requirements?tab=outsourced | backend n/a
- **Fix:** Delete the file
- **Verified:** mechanical

### B08-11 — Orphan page
- **Page:** ServiceRequirementsList.tsx ((none))
- **Expected:** Page is reachable or deleted
- **Actual:** Known-dead orphan; superseded by UnifiedRequirementsPage OutsourcedWorkTab (also has the /work-orders/:id dead nav at line 434 — moot)
- **Evidence:** frontend batch dossier: routes [], sidebar false, inbound []; frontend/src/App.tsx:541-542 redirects /service-requirements/list to /procurement/requirements?tab=outsourced | backend n/a
- **Fix:** Delete the file
- **Verified:** mechanical

### B10-10 — Orphan page
- **Page:** SelectTest.tsx (/test/select)
- **Expected:** Only reachable, purposeful pages registered in the router
- **Actual:** A developer diagnostic page shipped in the production route table, reachable only by typing the URL
- **Evidence:** frontend SelectTest.tsx:1-89 — a shadcn Select rendering diagnostic page (hardcoded test data, DevTools instructions); App.tsx:648 registers /test/select; no sidebar entry and no inbound edges | backend n/a (no API calls)
- **Fix:** Delete the page and the /test/select route (it was a one-off debugging aid for Select visibility)
- **Verified:** mechanical

### B09-13 — Ignored link parameter
- **Page:** OrderBOMDetail.tsx (/order-bom/:id)
- **Expected:** Work Order list filtered to the locked BOM's order
- **Actual:** Param ignored - full unfiltered WO list shown
- **Evidence:** frontend OrderBOMDetail.tsx:447 post-lock banner navigates to `/production/work-orders?orderId=${bom.orderId}` | backend frontend/src/pages/WorkOrderList.tsx has no useSearchParams/orderId/URLSearchParams reads at all (grep = 0 hits)
- **Fix:** Read orderId in WorkOrderList and filter, or navigate without implying scoping
- **Verified:** mechanical

### B09-14 — Field mismatch (silent wrong data)
- **Page:** SaleOrderList.tsx (/sale-orders)
- **Expected:** Items column shows the SO's item count
- **Actual:** so._count is always undefined after serialization -> column always 0. NOTE: systemic - every frontend read of `_count` app-wide is affected; dedupe centrally
- **Evidence:** frontend SaleOrderList.tsx:239 renders `{so._count?.items || 0}` in the Items column | backend list include has _count.items (saleOrder.service.ts:120-122) but humps camelizes '_count' to 'count' (verified: node humps.camelizeKeys({_count:{items:3}}) -> {count:{items:3}}); no _count special-case in transform.middleware.ts/serializer.ts
- **Fix:** Read so.count?.items (or add a serializer special-case preserving _count)
- **Verified:** mechanical

### B09-15 — Field mismatch (silent wrong data)
- **Page:** SaleOrderDetail.tsx (/sale-orders/:id)
- **Expected:** Allocation candidates show their warehouse/location name
- **Actual:** Location always renders '-' because the field is locationName
- **Evidence:** frontend SaleOrderDetail.tsx:356 reads `stock.locations?.name` in the Allocate Stock dialog | backend backend/src/services/saleOrder.service.ts:317 getAvailableStock selects locations { id, locationName } - no 'name' field
- **Fix:** Read stock.locations?.locationName
- **Verified:** mechanical

### B09-16 — Missing integration
- **Page:** OrderDetail.tsx (/orders/:id)
- **Expected:** Order detail surfaces downstream billing/dispatch state (invoices, delivery notes) per the Order module card
- **Actual:** The order->invoice and order->delivery-note integrations are not visible from the order page; user must find them from the invoice/dispatch modules
- **Evidence:** frontend OrderDetail.tsx surfaces BOM/MRP/Services/Work Orders but has zero links or panels for invoices or delivery notes (grep invoice/delivery = only date labels) | backend docs/MODULE_RELATIONSHIPS_GUIDE.md:1245-1249 (S8.2 Order card) Triggers: 'Invoice creation (invoices.orderId)' and 'Delivery note creation (delivery_notes.orderId)'
- **Fix:** Add an invoices/delivery-notes summary strip (counts + links filtered by orderId) to OrderDetail
- **Verified:** CONFIRMED

### B12-06 — Field mismatch (silent wrong data)
- **Page:** CreditNoteList.tsx (/credit-notes)
- **Expected:** Customer column shows billing name with the customer code sub-line, matching the invoice pages
- **Actual:** billingName is always undefined (silently falls back to name) and the code sub-line never renders because customer.code is always undefined
- **Evidence:** frontend frontend/src/pages/CreditNoteList.tsx:273-275 reads `cn.customer?.billingName || cn.customer?.name` and `cn.customer?.code` | backend backend/src/services/creditNote.service.ts:276-281 getAll includes `customer: { select: { id: true, name: true } }` — billingName and code are never selected
- **Fix:** Add `code: true, billingName: true` to the customer select in creditNote.service.ts getAll (and getById for consistency)
- **Verified:** mechanical

### B12-07 — Missing integration
- **Page:** InvoiceDetail.tsx (/invoices/:id)
- **Expected:** Per §8.14, the invoice detail should surface its order integration as a navigable link (and ideally the triggering dispatch/delivery note)
- **Actual:** Order number is dead text; the user must manually search the Orders list to follow the invoice's primary upstream relationship
- **Evidence:** frontend frontend/src/pages/InvoiceDetail.tsx:311 renders `invoice.orders?.orderNumber` as plain text; no Link/navigate to the order anywhere on the page | backend docs/MODULE_RELATIONSHIPS_GUIDE.md §8.14 Invoice Module: 'Integrates With: Orders (via invoices.orderId) — Invoice for order' and 'Triggered By: Delivery note dispatch' (lines 1665, 1686) — neither the linked order nor any delivery-note linkage is navigable from the invoice pages
- **Fix:** Wrap orderNumber in a link to `/orders/${invoice.orderId}` on InvoiceDetail (and the Order column in InvoiceList)
- **Verified:** CONFIRMED

### B11-10 — Dead endpoint
- **Page:** SampleDetail.tsx (/samples/:id)
- **Expected:** Per-colorway / per-size-set approval endpoints exist (SampleDetail currently renders their status read-only with no approve/reject action)
- **Actual:** Five sample.service methods target absent or drifted endpoints; they are uncalled today, so any future wiring (e.g. colorway approval buttons on SampleDetail) will 404/400 immediately
- **Evidence:** frontend services/sample.service.ts:128-163 updateColorways/updateColorwayStatus/updateSizeSets/updateSizeSetStatus → PUT/PATCH /samples/:id/colorways|size-sets…; :113-119 recordActualMeasurements sends {id, actualValue} | backend sample.routes.ts defines no colorways/size-sets routes (grep: no matches) → 404; recordActualMeasurementsSchema (sample.schema.ts:167-176) requires measurementPointId the service never sends → 400
- **Fix:** Either implement the colorway/size-set status routes and align recordActualMeasurements payload, or delete the dead service methods
- **Verified:** mechanical

### B11-11 — Missing integration
- **Page:** EmbroideryStockSendOut.tsx (/embroidery-stock/send-out)
- **Expected:** MODULE_RELATIONSHIPS_GUIDE §4.11 documents embroidery_send_out.forStyleId → styles ('For style') and forOrderId → orders ('For order'); the send-out form should let the user earmark embroidered fabric for a style/order
- **Actual:** No UI exists to set them, so UI-created send-outs never carry the style/order link and by-style embroidered-stock views find nothing
- **Evidence:** frontend EmbroideryStockSendOut.tsx:72-73 formData has forStyleId/forOrderId; :203-204 sends them — but no input/select anywhere in the JSX ever sets them (always '' → undefined) | backend sendOutSchema accepts forStyleId/forOrderId (embroideryStock.schema.ts:45-46); GET /embroidery-stock/by-style/:styleId exists (embroidery-stock.routes.ts:51)
- **Fix:** Add optional Style and Order pickers to Step 4 of EmbroideryStockSendOut and pass their ids as forStyleId/forOrderId
- **Verified:** mechanical

### B13-10 — Ignored link parameter
- **Page:** FabricPhysicalTests.tsx (/fabric-physical-tests)
- **Expected:** 'Review' on failed FPTs opens the list pre-filtered to FAIL
- **Actual:** status query param is never read - list opens unfiltered (moot until B13-01 makes the list work at all)
- **Evidence:** frontend TestingDashboard.tsx:305,363 navigate('/fabric-physical-tests?status=FAIL|PENDING') | backend FabricPhysicalTests.tsx has no useSearchParams/location.search; filterStatus initialized to 'all' (line 20)
- **Fix:** Read searchParams.get('status') into filterStatus on mount in FabricPhysicalTests.tsx
- **Verified:** mechanical

### B13-14 — Field mismatch (silent wrong data)
- **Page:** PermissionManagement.tsx (/admin/permissions)
- **Expected:** Audit panel shows 'by First Last' and the change time
- **Actual:** 'by ' renders blank (log.user undefined) and date renders 'Invalid Date' (log.createdAt undefined)
- **Evidence:** frontend PermissionManagement.tsx:457 reads log.user?.firstName and :460 new Date(log.createdAt) | backend permission.service.ts:496-505 includes relation `users` (serializer keeps it as `users`, serializer.ts:339) and audit_logs has `timestamp` not `createdAt` (schema.prisma:19)
- **Fix:** Read log.users and log.timestamp in the frontend (or alias user/createdAt in the service select)
- **Verified:** mechanical

### B13-15 — Field mismatch (silent wrong data)
- **Page:** GarmentPhysicalTests.tsx (/garment-physical-tests)
- **Expected:** List shows human-readable work order number and style code
- **Actual:** Raw UUIDs displayed even though the API response already carries workOrder.workOrderNumber and style.styleCode
- **Evidence:** frontend GarmentPhysicalTests.tsx:209,213 renders raw test.workOrderId and test.styleId UUIDs under 'Work Order:'/'Style:' | backend garmentPhysicalTests.service.ts:198-210 getAll already includes workOrder{workOrderNumber} and style{styleCode,styleName}
- **Fix:** Render test.workOrder?.workOrderNumber and test.style?.styleCode instead of the id fields
- **Verified:** mechanical

### B14-04 — Ignored link parameter
- **Page:** FabricCostingPage.tsx (/fabric-costing)
- **Expected:** CAD Planning list opens focused/prefiltered on the selected style
- **Actual:** Param silently dropped; user lands on the generic CAD list and must re-find the style manually
- **Evidence:** frontend frontend/src/pages/FabricCostingPage.tsx:1561 `navigate(`/cad-planning?style=${selectedStyleId}`)` ('Create CAD Data in CAD Planning' banner button) | backend target page frontend/src/pages/CADPlanningList.tsx never calls useSearchParams/location.search (verified whole file) - the `style` param is ignored
- **Fix:** Read searchParams.get('style') in CADPlanningList to seed the search box, or navigate to /cad-planning/:styleId (CADPlanningPage) instead
- **Verified:** mechanical

### B14-05 — Ignored link parameter
- **Page:** CostSheetDetail.tsx (/cost-sheets/:id)
- **Expected:** Order BOM list filtered to (or generation triggered for) the approved cost sheet's style
- **Actual:** Params silently dropped; button opens the unfiltered Order BOM list, despite its 'Generate' label
- **Evidence:** frontend frontend/src/pages/CostSheetDetail.tsx:219 `navigate(`/order-bom?costSheetId=${costSheet.id}&styleId=${costSheet.styleId}`)` ('Generate Order BOM' button on approved sheets) | backend target page frontend/src/pages/OrderBOMList.tsx has no useSearchParams/costSheetId/location.search usage (verified) - both params ignored
- **Fix:** Consume costSheetId/styleId in OrderBOMList to filter/prefill (BOM is auto-created on approval per App.tsx:441 comment), or relabel the button 'View Order BOMs'
- **Verified:** mechanical

### B14-07 — Orphan page
- **Page:** CostSheetPOGenerationPage.tsx (/cost-sheets/:costSheetId/generate-po)
- **Expected:** Page reachable, or removed along with its dedicated backend routes
- **Actual:** Unroutable dead code; additionally its PO links (CostSheetPOGenerationPage.tsx:1026,1051 -> /purchase-orders/:id) point at a nonexistent frontend route (actual detail route is /procurement/purchase-orders/:id, App.tsx:521)
- **Evidence:** frontend frontend/src/App.tsx:446-448 route is commented out ('DEPRECATED: Cost Sheet PO Generation removed - all POs now through Order -> BOM -> MRP workflow'); lazy-routes.tsx:127 import also commented; batch shows sidebar:false and zero inbound edges | backend backend/src/routes/costSheetPOGeneration.routes.ts still registers 6 live /api/cost-sheet-po endpoints consumed only by this dead page
- **Fix:** DELETE recommendation: remove the page + frontend/src/services/costSheetPOGeneration.service.ts, and consider retiring the /api/cost-sheet-po routes since the workflow moved to Order -> BOM -> MRP
- **Verified:** mechanical

### B14-08 — Missing integration
- **Page:** CostSheetDetail.tsx (/cost-sheets/:id)
- **Expected:** MODULE_RELATIONSHIPS_GUIDE.md SS9 pipeline (lines 851, 878-880): stage 4 'Costing & Pricing' feeds stage 5 'Quotation Approval' (quotations built from approved cost) before stage 6 Order Entry
- **Actual:** Costing UI jumps straight from approved cost sheet to Order creation; the quotation stage is not wired from costing (no Create Quotation action, no cost-sheet pull in QuotationForm)
- **Evidence:** frontend frontend/src/pages/CostSheetDetail.tsx:298-311 - approved cost sheet actions are 'Generate Order BOM' and 'Create Order' (/orders/new) only; zero 'quotation' references in CostSheetDetail/CostSheetList/costSheet.service, and QuotationForm.tsx has no costSheet/style_costing consumption (grep verified) | backend n/a
- **Fix:** Add a 'Create Quotation' action on approved cost sheets passing costSheetId/styleId and read those params in QuotationForm
- **Verified:** CONFIRMED

### B15-09 — Dead/stub UI
- **Page:** dashboards/ProductionDashboard.tsx (/dashboard/production)
- **Expected:** KPI backed by a real metric or clearly marked as placeholder/removed
- **Actual:** A constant '87% / +5% vs last week' renders as a live metric on every load regardless of actual production data
- **Evidence:** frontend ProductionDashboard.tsx:118-123 — StatCard 'Production Efficiency' value="87%" with hardcoded trend {value:5,direction:'up'} | backend no backend metric exists for efficiency in dashboard.controller.ts
- **Fix:** Remove the card or compute efficiency server-side; same treatment for the hardcoded trend arrows
- **Verified:** mechanical

### B15-10 — Dead/stub UI
- **Page:** dashboards/AccountsDashboard.tsx (/dashboard/accounts)
- **Expected:** Financial KPIs backed by real payment data or removed
- **Actual:** Fabricated constants '78% on-time' and '32 days' render as live financial metrics to the accounts team on every load
- **Evidence:** frontend AccountsDashboard.tsx:186-202 — StatCard 'Collection Rate' value="78%" and 'Avg. Payment Days' value="32", both string constants with hardcoded trends | backend no corresponding fields in getAccountsDashboardStats (dashboard.controller.ts:516-522)
- **Fix:** Remove or derive from payments/invoices data server-side
- **Verified:** mechanical

### B15-11 — Dead/stub UI
- **Page:** dashboards/SalesDashboard.tsx (/dashboard/sales)
- **Expected:** Quotation-to-order conversion computed from real data or removed
- **Actual:** Constant '68%' renders as a live sales metric on every load
- **Evidence:** frontend SalesDashboard.tsx:166-174 — StatCard 'Conversion Rate' value="68%" hardcoded with trend {value:5,direction:'up'} | backend no conversion metric in getSalesDashboardStats (dashboard.controller.ts:550-556)
- **Fix:** Remove or compute quotations-accepted/orders ratio server-side
- **Verified:** mechanical

### B15-12 — Dead/stub UI
- **Page:** Dashboard.tsx (/dashboard/main)
- **Expected:** Quick action navigates somewhere or is removed until Reports exists
- **Actual:** Permanently disabled no-op stub occupying a Quick Actions slot; honestly labelled 'Coming soon' so low harm
- **Evidence:** frontend Dashboard.tsx:301 — <QuickAction icon="📊" label="Reports" description="Coming soon" onClick={() => {}} disabled /> | backend n/a
- **Fix:** Remove the tile or point it at an existing report page when one ships
- **Verified:** mechanical
