/**
 * Order-system invariant sweep (Sale Order -> Production Order -> Work Order).
 *
 *   npx ts-node scripts/check-order-system-integrity.ts            (report)
 *   npx ts-node scripts/check-order-system-integrity.ts --json     (machine-readable)
 *
 * READ-ONLY BY DESIGN. There is no --fix. Several planned migrations add CHECK / partial-unique
 * constraints that will FAIL to apply if live data already violates them, so this runs first and
 * says exactly what is already corrupt. Checks marked [GATES] block a specific constraint.
 *
 * D1  allocated + in-production exceeds what was ordered   (start-production ignores allocatedQty)
 * D2  negative allocatedQty / dispatchedQty                [GATES CHECK allocatedQty>=0]
 * D3  allocatedQty exceeds ordered quantity                (allocation race: line never locked)
 * D4  dispatchedQty exceeds ordered + buyer's allowance     (dispatch validated on stale snapshot)
 * D5  negative finished_goods_stock.quantity               [GATES CHECK quantity>=0]
 * D6  negative / zero-but-ALLOCATED fg_stock_allocations   (double-drawn reservation)
 * D7  FG rows reserved beyond what they hold               (order-path DN ate reserved stock)
 * D8  work orders with neither parent FK                   [GATES CHECK at-least-one-parent]
 * D9  work_orders.completedQuantity > totalQuantity        [GATES CHECK completed<=total]
 * D10 SPLIT parents still carrying quantity                (double-counted in every rollup)
 * D11 more than one active production order per sale order [GATES partial unique on saleOrderId]
 * D12 work-order breakup sum != header totalQuantity       (raw totalQuantity write, no resync)
 * D13 one order item whose PENDING runs over-plan it       (size-breakup resync re-inflates splits)
 * D14 stock production order totals / rollup inconsistent  (MTS rollup is never written)
 * D15 order items that never got a work order              (existence check keyed on styleId)
 * D16 job work orders sent out with no outward challan    (29-Aug to 25-Sep: fabric-roll / garment issues)
 * D17 Production CADs with no received lot                 (Copy / Promote / purpose edit, before 25-Sep)
 * D18 Production CADs carrying a price or the promote lock (the undeletable "costed PRODUCTION CAD")
 */

import { PrismaClient } from '@prisma/client';
import { productionBlockingValidationService } from '../src/services/productionBlockingValidation.service';

const prisma = new PrismaClient();
const JSON_OUT = process.argv.includes('--json');

type Check = {
  id: string;
  title: string;
  gates?: string;
  rows: Record<string, unknown>[];
};

const checks: Check[] = [];

async function run(id: string, title: string, sql: Promise<unknown>, gates?: string) {
  const rows = (await sql) as Record<string, unknown>[];
  checks.push({ id, title, gates, rows });
}

async function main() {
  // ---- Sale order layer -----------------------------------------------------------------

  await run(
    'D1',
    'Sale orders where allocated + in-production exceeds the ordered quantity',
    prisma.$queryRaw`
      SELECT so."saleOrderNumber",
             SUM(soi.quantity)::int      AS ordered,
             SUM(soi."allocatedQty")::int AS allocated,
             COALESCE(p.produced, 0)::int AS in_production,
             (SUM(soi."allocatedQty") + COALESCE(p.produced, 0) - SUM(soi.quantity))::int AS over_committed
        FROM sale_orders so
        JOIN sale_order_items soi ON soi."saleOrderId" = so.id
        LEFT JOIN (
          SELECT o."saleOrderId", SUM(o."totalQuantity") AS produced
            FROM orders o
           WHERE o."saleOrderId" IS NOT NULL AND o.status <> 'CANCELLED' AND o."isActive" = true
           GROUP BY o."saleOrderId"
        ) p ON p."saleOrderId" = so.id
       WHERE so.status <> 'CANCELLED'
       GROUP BY so.id, so."saleOrderNumber", p.produced
      HAVING SUM(soi."allocatedQty") + COALESCE(p.produced, 0) > SUM(soi.quantity)
       ORDER BY over_committed DESC`
  );

  await run(
    'D2',
    'Negative allocatedQty / dispatchedQty on a sale-order line',
    prisma.$queryRaw`
      SELECT so."saleOrderNumber", soi.id, soi.quantity, soi."allocatedQty", soi."dispatchedQty"
        FROM sale_order_items soi
        JOIN sale_orders so ON so.id = soi."saleOrderId"
       WHERE soi."allocatedQty" < 0 OR soi."dispatchedQty" < 0`,
    'CHECK (allocatedQty >= 0 AND dispatchedQty >= 0) on sale_order_items'
  );

  await run(
    'D3',
    'allocatedQty exceeds the ordered quantity on the line',
    prisma.$queryRaw`
      SELECT so."saleOrderNumber", soi.id, soi.quantity, soi."allocatedQty"
        FROM sale_order_items soi
        JOIN sale_orders so ON so.id = soi."saleOrderId"
       WHERE soi."allocatedQty" > soi.quantity`
  );

  await run(
    'D4',
    // Up to ordered + the buyer's over-shipment allowance is legitimate (customers
    // .overShipAllowancePercent, the same floor() cap sale-order-dispatch.helper.ts shipCap applies)
    "dispatchedQty exceeds the ordered quantity + the buyer's over-shipment allowance",
    prisma.$queryRaw`
      SELECT so."saleOrderNumber", soi.id, soi.quantity, c."overShipAllowancePercent", soi."dispatchedQty"
        FROM sale_order_items soi
        JOIN sale_orders so ON so.id = soi."saleOrderId"
        JOIN customers c ON c.id = so."customerId"
       WHERE soi."dispatchedQty" > FLOOR(soi.quantity * (100 + c."overShipAllowancePercent") / 100)`
  );

  // ---- Finished goods -------------------------------------------------------------------

  await run(
    'D5',
    'Negative finished-goods stock',
    prisma.$queryRaw`
      SELECT f.id, s."styleCode", f.quantity, l."locationName"
        FROM finished_goods_stock f
        JOIN styles s ON s.id = f."styleId"
        JOIN locations l ON l.id = f."locationId"
       WHERE f.quantity < 0
       ORDER BY f.quantity ASC`,
    'CHECK (quantity >= 0) on finished_goods_stock'
  );

  await run(
    'D6',
    'FG allocations that are negative, or ALLOCATED with nothing left on them',
    prisma.$queryRaw`
      SELECT a.id, a.status, a."allocatedQty", so."saleOrderNumber"
        FROM fg_stock_allocations a
        JOIN sale_order_items soi ON soi.id = a."saleOrderItemId"
        JOIN sale_orders so ON so.id = soi."saleOrderId"
       WHERE a."allocatedQty" < 0
          OR (a.status = 'ALLOCATED' AND a."allocatedQty" <= 0)`,
    'CHECK (allocatedQty >= 0) on fg_stock_allocations'
  );

  await run(
    'D7',
    'FG rows reserved beyond what they physically hold',
    prisma.$queryRaw`
      SELECT f.id, s."styleCode", f.quantity, SUM(a."allocatedQty")::int AS reserved,
             (SUM(a."allocatedQty") - f.quantity)::int AS over_reserved
        FROM finished_goods_stock f
        JOIN fg_stock_allocations a ON a."fgStockId" = f.id AND a.status = 'ALLOCATED'
        JOIN styles s ON s.id = f."styleId"
       GROUP BY f.id, s."styleCode", f.quantity
      HAVING SUM(a."allocatedQty") > f.quantity
       ORDER BY over_reserved DESC`
  );

  // ---- Production order / work order ----------------------------------------------------

  await run(
    'D8',
    'Work orders with neither a production order nor a stock production order',
    prisma.$queryRaw`
      SELECT w.id, w."workOrderNumber", w.status, w."totalQuantity", w."parentRunId"
        FROM work_orders w
       WHERE w."orderId" IS NULL AND w."stockProductionOrderId" IS NULL`,
    'CHECK (orderId IS NOT NULL OR stockProductionOrderId IS NOT NULL) on work_orders'
  );

  await run(
    'D9',
    'Work orders completed beyond their planned quantity',
    prisma.$queryRaw`
      SELECT w."workOrderNumber", w.status, w."totalQuantity", w."completedQuantity"
        FROM work_orders w
       WHERE w."completedQuantity" > w."totalQuantity"`,
    'CHECK (completedQuantity <= totalQuantity) on work_orders'
  );

  await run(
    'D10',
    'SPLIT parent runs still carrying quantity (double-counted in every rollup)',
    prisma.$queryRaw`
      SELECT w."workOrderNumber", w."totalQuantity", w."completedQuantity",
             COUNT(c.id)::int AS children,
             SUM(c."totalQuantity")::int AS child_total
        FROM work_orders w
        JOIN work_orders c ON c."parentRunId" = w.id
       WHERE w.status = 'SPLIT' AND w."totalQuantity" > 0
       GROUP BY w.id, w."workOrderNumber", w."totalQuantity", w."completedQuantity"`
  );

  await run(
    'D11',
    'Sale orders carrying more than one active production order',
    prisma.$queryRaw`
      SELECT so."saleOrderNumber", COUNT(o.id)::int AS active_orders,
             STRING_AGG(o."orderNumber", ', ' ORDER BY o."createdAt") AS order_numbers
        FROM sale_orders so
        JOIN orders o ON o."saleOrderId" = so.id
       WHERE o.status <> 'CANCELLED' AND o."isActive" = true
       GROUP BY so.id, so."saleOrderNumber"
      HAVING COUNT(o.id) > 1`,
    'partial UNIQUE on orders.saleOrderId WHERE status <> CANCELLED AND isActive'
  );

  await run(
    'D12',
    'Work orders whose size breakup does not sum to the header quantity',
    prisma.$queryRaw`
      SELECT w."workOrderNumber", w.status, w."totalQuantity",
             COALESCE(SUM(b."plannedQuantity"), 0)::int AS breakup_total
        FROM work_orders w
        LEFT JOIN work_order_breakup b ON b."workOrderId" = w.id
       GROUP BY w.id, w."workOrderNumber", w.status, w."totalQuantity"
      HAVING COALESCE(SUM(b."plannedQuantity"), 0) <> w."totalQuantity"
       ORDER BY ABS(COALESCE(SUM(b."plannedQuantity"), 0) - w."totalQuantity") DESC`
  );

  await run(
    'D13',
    'Order items whose live work orders plan more than the item ordered',
    prisma.$queryRaw`
      SELECT o."orderNumber", s."styleCode", oi."totalQuantity" AS ordered,
             SUM(w."totalQuantity")::int AS planned,
             COUNT(w.id)::int AS runs
        FROM order_items oi
        JOIN orders o ON o.id = oi."orderId"
        JOIN styles s ON s.id = oi."styleId"
        JOIN work_orders w ON w."orderItemId" = oi.id AND w.status <> 'SPLIT'
       WHERE o.status <> 'CANCELLED'
       GROUP BY oi.id, o."orderNumber", s."styleCode", oi."totalQuantity"
      HAVING SUM(w."totalQuantity") > oi."totalQuantity"
       ORDER BY (SUM(w."totalQuantity") - oi."totalQuantity") DESC`
  );

  await run(
    'D15',
    'Order items on live orders that never got a work order',
    prisma.$queryRaw`
      SELECT o."orderNumber", s."styleCode", oi."totalQuantity", oi.status
        FROM order_items oi
        JOIN orders o ON o.id = oi."orderId"
        JOIN styles s ON s.id = oi."styleId"
       WHERE o.status NOT IN ('CANCELLED', 'PENDING')
         AND o."isActive" = true
         AND NOT EXISTS (SELECT 1 FROM work_orders w WHERE w."orderItemId" = oi.id)`
  );

  // ---- Make to stock --------------------------------------------------------------------

  await run(
    'D14',
    'Stock production orders whose header, items and work orders disagree',
    prisma.$queryRaw`
      SELECT spo."spoNumber", spo.status, spo."totalQuantity",
             COALESCE(i.item_total, 0)::int AS item_total,
             COALESCE(i.completed, 0)::int  AS items_completed,
             COALESCE(w.wo_total, 0)::int   AS work_order_total,
             COALESCE(w.wo_completed, 0)::int AS work_orders_completed
        FROM stock_production_orders spo
        LEFT JOIN (
          SELECT "stockProductionOrderId",
                 SUM(quantity) AS item_total,
                 SUM("completedQuantity") AS completed
            FROM stock_production_order_items GROUP BY "stockProductionOrderId"
        ) i ON i."stockProductionOrderId" = spo.id
        LEFT JOIN (
          SELECT "stockProductionOrderId",
                 SUM("totalQuantity") AS wo_total,
                 SUM("completedQuantity") AS wo_completed
            FROM work_orders
           WHERE "stockProductionOrderId" IS NOT NULL AND status <> 'SPLIT'
           GROUP BY "stockProductionOrderId"
        ) w ON w."stockProductionOrderId" = spo.id
       WHERE spo."totalQuantity" <> COALESCE(i.item_total, 0)
          OR COALESCE(w.wo_total, 0) > spo."totalQuantity"
          OR (COALESCE(w.wo_completed, 0) > 0 AND COALESCE(i.completed, 0) = 0)`
  );

  // ---- Job work paperwork ---------------------------------------------------------------

  // Goods that left for a job worker with no outward challan (Rule 45 / Rule 55). From 29-Aug
  // (4805cf8b) to 25-Sep-2026 an issue raised a challan only for store greige or lace, so a
  // fabric-roll or garment job could go out with none. A job allocated where the cloth already lay
  // (VIRTUAL-ALLOCATION) rightly has none.
  await run(
    'D16',
    'Job work orders sent out with no outward challan',
    prisma.$queryRaw`
      SELECT j."jobWorkNumber", j."processType", j."jwoStatus" AS status, j."sentDate"::date AS sent,
             j."qtySentMeters"::float AS qty, j.uom
        FROM job_work_orders j
       WHERE j."sentDate" IS NOT NULL
         AND j."outwardChallanId" IS NULL
         AND COALESCE(j."challanNumber", '') <> 'VIRTUAL-ALLOCATION'
         AND NOT EXISTS (
           SELECT 1 FROM challan_items ci
             JOIN challans c ON c.id = ci."challanId"
            WHERE ci."jobWorkOrderId" = j.id AND c."challanType" = 'OUTWARD' AND c.status <> 'CANCELLED')
       ORDER BY j."sentDate"`
  );

  // ---- CAD Planning: Production CADs ------------------------------------------------------

  // A Production CAD is the marker for one received lot, made by Create CAD on that lot. Until
  // 2026-09-25 Copy to Production, Fabric Costing → Promote, a purpose edit and Create Version made
  // them with no lot (IP00138, LNG279, LNG236, EMFK00262). Such a row can no longer be approved and
  // is deletable from the row menu while nothing uses it.
  const productionCadRows = (where: string) =>
    prisma.$queryRawUnsafe(`
      SELECT s."styleCode", s.buyer_style_ref AS buyer_ref, c.id, c.approval_status::text AS status,
             c."cutableWidth"::float AS width, c."totalCostPerMeter"::float AS price, c.is_locked AS locked,
             c."createdAt"::date AS created
        FROM fabric_width_cad c
        LEFT JOIN style_fabrics sf ON sf.id = c.style_fabric_id
        LEFT JOIN style_components sc ON sc.id = sf."componentId"
        LEFT JOIN styles s ON s.id = COALESCE(sc."styleId", c."costingStyleId")
       WHERE COALESCE(c.purpose_enum::text, c.purpose) = 'PRODUCTION' AND (${where})
       ORDER BY c."createdAt"`);

  await run('D17', 'Production CADs with no received lot', productionCadRows('c.fabric_stock_id IS NULL'));

  // Production CADs are never costed; the price and is_locked only came from the retired promote
  // flow, and a priced row was the "costed PRODUCTION CAD" nobody could edit or delete.
  await run(
    'D18',
    'Production CADs carrying a price or the old promote lock',
    productionCadRows('c."totalCostPerMeter" IS NOT NULL OR c.is_locked')
  );

  // ---- Output ---------------------------------------------------------------------------

  if (JSON_OUT) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), checks }, null, 2));
    return;
  }

  const dirty = checks.filter((c) => c.rows.length > 0);
  const blocked = dirty.filter((c) => c.gates);

  console.log('\n=== Order-system integrity sweep (READ-ONLY) ===\n');

  // Pipeline depth: where does real data stop? A clean bill past that point proves nothing,
  // and it is also the exact boundary of "code that has never run in production".
  const stages: [string, number][] = [
    ['1. styles', await prisma.styles.count()],
    ['     …variants (colour/size)', await prisma.style_variants.count()],
    ['2. fabric_width_cad', await prisma.fabric_width_cad.count()],
    [
      '     …PRODUCTION APPROVED with cadAverage (cutting needs this)',
      await prisma.fabric_width_cad.count({
        // allow-cad-approval — cutting needs the approved GEOMETRY (2026-09-23)
        where: { purposeEnum: 'PRODUCTION', approvalStatus: 'APPROVED', cadAverage: { not: null } },
      }),
    ],
    ['3. style_costing (cost sheets)', await prisma.style_costing.count()],
    [
      '     …APPROVED (start-production needs this)',
      await prisma.style_costing.count({ where: { OR: [{ approvalStatus: 'APPROVED' }, { isApproved: true }] } }),
    ],
    ['4. sale_orders', await prisma.sale_orders.count()],
    ['     …sale_order_items', await prisma.sale_order_items.count()],
    ['     …lines with an allocation', await prisma.sale_order_items.count({ where: { allocatedQty: { gt: 0 } } })],
    ['     …lines with a dispatch', await prisma.sale_order_items.count({ where: { dispatchedQty: { gt: 0 } } })],
    ['5. orders (production)', await prisma.orders.count()],
    ['     …linked to a sale order', await prisma.orders.count({ where: { saleOrderId: { not: null } } })],
    ['     …order_items', await prisma.order_items.count()],
    ['6. order_bom', await prisma.order_bom.count()],
    [
      '     …APPROVED/LOCKED (cutting needs this)',
      await prisma.order_bom.count({ where: { status: { in: ['APPROVED', 'LOCKED'] } } }),
    ],
    ['7. work_orders', await prisma.work_orders.count()],
    ['     …SPLIT parents', await prisma.work_orders.count({ where: { status: 'SPLIT' } })],
    ['8. cutting_batches', await prisma.cutting_batches.count()],
    ['9. stitching_issues', await prisma.stitching_issues.count()],
    ['10. finishing_issues', await prisma.finishing_issues.count()],
    ['11. finished_goods_stock', await prisma.finished_goods_stock.count()],
    ['     …fg_stock_allocations', await prisma.fg_stock_allocations.count()],
    ['12. delivery_notes', await prisma.delivery_notes.count()],
    ['13. invoices', await prisma.invoices.count()],
    ['MTS. stock_production_orders', await prisma.stock_production_orders.count()],
  ];
  console.log('Pipeline depth — where real data stops (and where untested code begins):');
  for (const [name, n] of stages) {
    const bar = n === 0 ? '  <-- EMPTY' : '';
    console.log(`  ${String(n).padStart(7)}  ${name}${bar}`);
  }
  console.log('');

  // Readiness: can any existing production order actually reach the cutting floor today?
  // Prerequisites per docs/ai-guides/cutting-entry.md + productionBlockingValidation.service.ts.
  const liveItems = await prisma.order_items.findMany({
    where: { orders: { isActive: true, status: { not: 'CANCELLED' } } },
    select: {
      id: true,
      styleId: true,
      totalQuantity: true,
      orders: { select: { orderNumber: true } },
      styles: { select: { styleCode: true } },
    },
    orderBy: { orders: { orderNumber: 'asc' } },
  });

  // Why is PRODUCTION CAD missing? Distinguishes "users never do this step" from "step is broken".
  const cadByPurpose = await prisma.fabric_width_cad.groupBy({
    by: ['purposeEnum'],
    _count: { _all: true },
  });
  const cadWithAvg = await prisma.fabric_width_cad.groupBy({
    by: ['purposeEnum'],
    where: { cadAverage: { not: null } },
    _count: { _all: true },
  });
  const avgMap = new Map(cadWithAvg.map((r) => [r.purposeEnum ?? 'null', r._count._all]));
  console.log('CAD rows by purpose (and how many carry a cadAverage):');
  for (const r of cadByPurpose) {
    const key = r.purposeEnum ?? 'null';
    console.log(`  ${String(r._count._all).padStart(7)}  ${String(key).padEnd(28)} withCadAverage=${avgMap.get(key) ?? 0}`);
  }
  console.log('');

  console.log('Cutting readiness of existing production orders:');
  const yn = (v: boolean) => (v ? 'yes' : 'NO ');
  for (const oi of liveItems) {
    const costSheet = await prisma.style_costing.count({
      where: {
        styleId: oi.styleId,
        purpose: { in: ['RAW_MATERIAL_CALCULATION', 'PRODUCTION'] },
        OR: [{ approvalStatus: 'APPROVED' }, { isApproved: true }],
      },
    });
    const bom = await prisma.order_bom.count({
      where: { orderItemId: oi.id, status: { in: ['APPROVED', 'LOCKED'] }, isActive: true },
    });
    // Same 3-path query as validateProductionCADForStage / buildCuttingChartData. Only an APPROVED
    // row with an average counts (2026-09-23 — a rejected one made ESSKY085LS read READY here).
    const productionCads = await prisma.fabric_width_cad.findMany({
      where: {
        purposeEnum: 'PRODUCTION',
        OR: [
          { costingStyleId: oi.styleId },
          { styleFabric: { style_components: { styleId: oi.styleId } } },
          { styleCosting: { styleId: oi.styleId } },
        ],
      },
      select: { approvalStatus: true, cadAverage: true }, // allow-cad-approval
    });
    const cad = productionCads.filter((c) => c.approvalStatus === 'APPROVED' && c.cadAverage !== null).length; // allow-cad-approval
    const rejectedCads = productionCads.filter((c) => c.approvalStatus === 'REJECTED').length; // allow-cad-approval
    const pendingCads = productionCads.length - cad - rejectedCads;
    // The real gate, not a re-derivation of it: samples, fabric tests, material and CAD in one list
    const gate = oi.styleId
      ? await productionBlockingValidationService.validateOrderItemForStage(oi.id, 'IN_CUTTING')
      : { isBlocked: false, blockers: [] };
    const ready = costSheet > 0 && bom > 0 && !gate.isBlocked;
    console.log(
      `  ${ready ? 'READY  ' : 'BLOCKED'} ${oi.orders.orderNumber.padEnd(14)} ${(oi.styles.styleCode ?? '-').padEnd(14)} ` +
        `qty=${String(oi.totalQuantity).padEnd(6)} costSheet=${yn(costSheet > 0)} bom=${yn(bom > 0)} ` +
        `productionCAD=${cad} (pending ${pendingCads}, rejected ${rejectedCads})` +
        (gate.blockers.length > 0 ? ` blockers=${[...new Set(gate.blockers.map((b) => b.type))].join(',')}` : '')
    );
  }
  if (liveItems.length === 0) console.log('  (no live production orders)');
  console.log('');

  for (const c of checks) {
    const n = c.rows.length;
    const mark = n === 0 ? 'OK  ' : 'FAIL';
    console.log(`${mark} ${c.id}  ${c.title}${n ? `  — ${n} row(s)` : ''}`);
    if (n === 0) continue;
    if (c.gates) console.log(`      BLOCKS: ${c.gates}`);
    for (const r of c.rows.slice(0, 15)) {
      console.log(
        '      ' +
          Object.entries(r)
            .map(([k, v]) => `${k}=${v === null ? '-' : v}`)
            .join('  ')
      );
    }
    if (n > 15) console.log(`      … and ${n - 15} more`);
    console.log('');
  }

  console.log('--------------------------------------------------');
  console.log(`${checks.length - dirty.length}/${checks.length} checks clean.`);
  if (blocked.length === 0) {
    console.log('No planned constraint is blocked by existing data — migrations can be written.');
  } else {
    console.log(`\n${blocked.length} planned constraint(s) BLOCKED by existing data:`);
    for (const c of blocked) console.log(`  ${c.id}: ${c.gates}  (${c.rows.length} row(s))`);
    console.log('\nAgree a repair for these with the owner before writing the migration.');
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
