/**
 * Stage-0b: slice join.json into per-batch inputs for the Stage-1 reviewer agents.
 * Assigns every page to exactly one batch by filename rules; fails loudly on gaps/dupes.
 * Output: docs/frontend-review/data/batches/<batch>.json
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const DATA = path.join(REPO, 'docs', 'frontend-review', 'data');
const join = JSON.parse(fs.readFileSync(path.join(DATA, 'join.json'), 'utf8'));

const BATCHES = [
  ['B01-fabric-greige', /^(Fabric(?!Costing|PhysicalTests|UsageReport)|Greige|CADPlanning|StyleFabricReport|StyleStockEntry)/],
  ['B02-trims', /^(Lace(?!Stock)|Button|Thread|Zipper|Elastic|Label|Packaging|MachinePart|OtherMaterial|GenericTrim|TrimMasters)/],
  ['B03-config-masters', /^(Color|Season|SizeCategory|Component|ProductCategory|MasterData|TemplateManager|Lookup|PatternPartMaster)/],
  ['B04-parties', /^(Customer|Supplier|Agent|Agency|Warehouse)/],
  ['B05-styles-materials', /^(Style(?!Fabric|Stock)|Material(?!Requirement)|Embroidery(?!Stock|Piece)|Motif)/],
  ['B06-production', /^(WorkOrder|Cutting|Stitching|Finishing|ProductionStatus|Printing|Dyeing)/],
  ['B07-stock', /^(Stock(?!ProductionOrder)|LaceStock|FabricUsageReport)/],
  ['B08-procurement', /^(PurchaseOrder|GRN|UnifiedRequirements|MRP|MaterialRequirement|ServiceRequirement|JobWork|ProcessingBatch)/],
  ['B09-orders', /^(Order|SaleOrder|StockProductionOrder|Quotation)/],
  ['B10-dispatch-misc', /^(Dispatch|Challan|AIAssistant|SelectTest|NotFound|ProcessGuide)/],
  ['B11-samples-external', /^(Sample|EmbroideryStock|EmbroideryPiece|Smocking|Handwork)/],
  ['B12-financial', /^(Invoice|CreditNote|DebitNote|GSTReports|TDS|TCS|ChartOfAccounts|HSN|HsnSac|TaxMaster)/],
  ['B13-admin-testing', /^(User|Permission|Override|admin\/|PendingUsers|Profile|Settings|Login|Register|Testing|FabricPhysicalTests|GarmentPhysicalTests|TestTemplates)/],
  ['B14-costing-design', /^(CostSheet|FabricCosting|StyleFabricCosting|ProcessorRateCard|Design|MoodBoard|Catalogue)/],
  ['B15-dashboards', /^(Dashboard|dashboards)/],
];

const assignments = new Map();
const unassigned = [];
for (const pageFile of Object.keys(join.pages)) {
  const base = pageFile.replace(/^frontend\/src\/pages\//, '');
  let hit = null;
  for (const [batch, re] of BATCHES) {
    if (re.test(base)) {
      hit = batch;
      break; // first match wins — order above is the priority
    }
  }
  if (!hit) unassigned.push(base);
  else assignments.set(pageFile, hit);
}

if (unassigned.length) {
  console.log('UNASSIGNED (' + unassigned.length + '):');
  unassigned.forEach((u) => console.log('  ' + u));
  process.exit(1);
}

const byBatch = new Map();
for (const [page, batch] of assignments) {
  if (!byBatch.has(batch)) byBatch.set(batch, {});
  byBatch.get(batch)[page] = join.pages[page];
}

const outDir = path.join(DATA, 'batches');
fs.mkdirSync(outDir, { recursive: true });
for (const [batch, pages] of byBatch) {
  const slice = {
    batch,
    pages,
    unresolvedCalls: join.unresolvedCalls.filter((u) => Object.keys(pages).some((p) => u.file === p)),
  };
  fs.writeFileSync(path.join(outDir, batch + '.json'), JSON.stringify(slice, null, 1));
  console.log(batch, Object.keys(pages).length, 'pages');
}
console.log('total assigned:', assignments.size);
