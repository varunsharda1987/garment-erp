/**
 * One-time conversion (owner, 2026-09-29): a receipt filed AHEAD of arrival only to get the Rule 45 challan out
 * becomes what it should have been — a goods-in-transit challan, with no receipt yet.
 *
 * GRN2609-1581 (PO2609-0004, Hardik → Shree Bhavya, 3,583 m, 10 thans) was dated 03-Oct on 29-Sep so that
 * CH2609-2129 could go to the dyer. Owner: remove the early receipt, keep the challan number, re-date the
 * challan to the day it was issued (29-Sep), despatched by Hardik on 27-Sep; the receipt is filed against it on
 * arrival.
 *
 * Steps, in ONE transaction (a dry run does them all and rolls back):
 *   1. refuse unless the receipt, its lot and its challan are untouched (no job drew, nothing reserved)
 *   2. make the challan the transit challan it would have been, adopted by this receipt: supplierDispatchedAt,
 *      the supplier's invoice, the PO + delivery point, each line's PO line / entry mode, the lot's thans copied
 *      into challan_item_pieces, the challan re-dated
 *   3. reverse the receipt through grnService.reverseGRN — the reversal RELEASES a transit challan (back to "on
 *      the way"), zeroes the lot and takes the PO's received figure back
 *
 * Usage: cd backend && npx ts-node --files scripts/convert-to-transit-challan.ts \
 *          --grn GRN2609-1581 --dispatched 2026-09-27 --challan-date 2026-09-29 [--user admin@kasya.in] [--apply]
 * Safe to run again: a challan already converted is reported and left alone.
 */
import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';
import { grnService } from '../src/services/grn.service';
import { purchaseOrderService } from '../src/services/purchaseOrder.service';
import { createAuditLog } from '../src/services/audit.service';
import { transitStateOf } from '../src/services/helpers/transit-challan-state';
import { formatDate } from '../src/utils/date';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const APPLY = process.argv.includes('--apply');
const GRN_NUMBER = arg('grn');
const DISPATCHED = arg('dispatched');
const CHALLAN_DATE = arg('challan-date');
const USER_EMAIL = arg('user') ?? 'admin@kasya.in';

class DryRun extends Error {}
const day = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

async function main() {
  if (!GRN_NUMBER || !DISPATCHED || !CHALLAN_DATE) {
    throw new Error('Usage: --grn GRN… --dispatched YYYY-MM-DD --challan-date YYYY-MM-DD [--user email] [--apply]');
  }
  const grn = await prisma.goods_receiving_notes.findFirst({
    where: { grnNumber: GRN_NUMBER },
    include: { grn_items: true, directSupplyChallans: { include: { items: true } } },
  });
  if (!grn) throw new Error(`${GRN_NUMBER} not found`);
  const user =
    (await prisma.users.findFirst({ where: { email: USER_EMAIL }, select: { id: true } })) ??
    (grn.approvedById ? { id: grn.approvedById } : null);
  if (!user) throw new Error(`No user ${USER_EMAIL}`);

  // Already converted?
  const converted = await prisma.challans.findFirst({
    where: { supplierDispatchedAt: { not: null }, remarks: { contains: GRN_NUMBER } },
    select: { challanNumber: true, status: true, directSupplyGrnId: true, supplierDispatchedAt: true },
  });
  if (grn.status === 'REVERSED' && converted) {
    console.log(`Already converted: ${converted.challanNumber} is ${transitStateOf(converted)} — nothing to do.`);
    return;
  }

  // 1. Refuse unless untouched
  if (grn.status !== 'ACCEPTED') throw new Error(`${GRN_NUMBER} is ${grn.status}, expected ACCEPTED`);
  if (grn.directSupplyChallans.length !== 1) {
    throw new Error(`${GRN_NUMBER} has ${grn.directSupplyChallans.length} direct-supply challans, expected 1`);
  }
  const challan = grn.directSupplyChallans[0];
  if (challan.status !== 'ISSUED' || challan.supplierDispatchedAt) {
    throw new Error(
      `${challan.challanNumber} is ${challan.status}${challan.supplierDispatchedAt ? ' (already transit)' : ''}`
    );
  }
  if (!grn.poId) throw new Error(`${GRN_NUMBER} has no purchase order`);
  const lots = await prisma.greige_stock.findMany({
    where: { grnItem: { grnId: grn.id } },
    include: { stockDetails: { orderBy: [{ baleNumber: 'asc' }, { sequenceNo: 'asc' }] } },
  });
  for (const lot of lots) {
    const drawn = await prisma.greige_issue_details.count({ where: { greigeStockDetail: { greigeStockId: lot.id } } });
    if (Number(lot.quantityConsumed) !== 0 || Number(lot.quantityReserved) !== 0 || drawn > 0) {
      throw new Error(`Lot ${lot.id} has been used or reserved — the receipt cannot be taken back`);
    }
    if (lot.sourceChallanId !== challan.id) throw new Error(`Lot ${lot.id} is not under ${challan.challanNumber}`);
  }
  const jobs = await prisma.job_work_orders.count({ where: { greigeStockLotId: { in: lots.map((l) => l.id) } } });
  if (jobs > 0) throw new Error('A job work order names the lot — stopping');

  const snapshot = { at: new Date().toISOString(), grn, challan, lots };
  const snapFile = path.join(__dirname, `convert-to-transit-challan-snapshot-${GRN_NUMBER}.json`);
  fs.writeFileSync(snapFile, JSON.stringify(snapshot, null, 2));
  console.log(`Snapshot: ${snapFile}`);

  const po = await prisma.purchase_orders.findUniqueOrThrow({
    where: { id: grn.poId },
    select: { id: true, poNumber: true },
  });
  const supplier = grn.supplierId
    ? await prisma.suppliers.findUnique({ where: { id: grn.supplierId }, select: { name: true } })
    : null;
  const invoiceText = grn.invoiceNumber
    ? ` vide invoice ${grn.invoiceNumber}${grn.invoiceDate ? ` dated ${formatDate(grn.invoiceDate)}` : ''}`
    : '';

  try {
    await prisma.$transaction(
      async (tx) => {
        // 2. The transit challan it would have been, adopted by this receipt
        for (const item of challan.items) {
          const lot = lots.find((l) => l.id === item.greigeStockId);
          const grnItem = grn.grn_items.find((g) => g.id === lot?.grnItemId);
          if (!lot || !grnItem) throw new Error(`Challan line ${item.id} names no lot of ${GRN_NUMBER}`);
          await tx.challan_items.update({
            where: { id: item.id },
            data: {
              poItemId: grnItem.poItemId,
              entryMode: grnItem.entryMode ?? 'TOTAL_METERS',
              arrivedQty: item.quantity,
            },
          });
          if (lot.stockDetails.length > 0) {
            await tx.challan_item_pieces.createMany({
              data: lot.stockDetails.map((d) => ({
                challanItemId: item.id,
                detailType: d.detailType,
                baleNumber: d.baleNumber,
                baleNo: d.baleNo,
                thanNo: d.thanNo,
                sequenceNo: d.sequenceNo,
                meters: d.meters,
              })),
            });
          }
        }
        await tx.challans.update({
          where: { id: challan.id },
          data: {
            challanDate: day(CHALLAN_DATE),
            issuedDate: day(CHALLAN_DATE),
            supplierDispatchedAt: day(DISPATCHED),
            supplierInvoiceNumber: grn.invoiceNumber,
            supplierInvoiceDate: grn.invoiceDate,
            purchaseOrderId: po.id,
            poDeliveryPointId: grn.poDeliveryPointId,
            remarks:
              `Supplied directly by ${supplier?.name ?? 'the supplier'}${invoiceText}; despatched by the supplier on ` +
              `${formatDate(day(DISPATCHED))} straight to the job worker. First issued with ${GRN_NUMBER}, a receipt ` +
              `filed ahead of arrival; converted to a goods-in-transit challan on ${formatDate(new Date())} (receipt reversed).`,
          },
        });

        // 3. Reverse the receipt: the transit challan is released back to "on the way"
        await grnService.reverseGRN(
          grn.id,
          user.id,
          `Filed ahead of arrival only to issue ${challan.challanNumber}; the challan is now a goods-in-transit challan and the receipt will be filed on arrival`,
          tx
        );

        const after = await tx.challans.findUniqueOrThrow({
          where: { id: challan.id },
          include: { items: { include: { pieces: true } } },
        });
        const poLine = await tx.purchase_order_items.findMany({
          where: { poId: po.id },
          select: { receivedQuantity: true },
        });
        const lotAfter = await tx.greige_stock.findMany({ where: { id: { in: lots.map((l) => l.id) } } });
        console.log(
          `${after.challanNumber}: ${transitStateOf(after)} · status ${after.status} · dated ${formatDate(after.challanDate)} · ` +
            `despatched ${formatDate(after.supplierDispatchedAt)} · receipt ${after.directSupplyGrnId ?? 'none'} · ` +
            `${after.items.map((i) => `${Number(i.quantity)} ${i.unit}, ${i.pieces.length} pieces, lot ${i.greigeStockId ?? 'none'}`).join('; ')}`
        );
        console.log(
          `${GRN_NUMBER}: REVERSED · lot(s) ${lotAfter.map((l) => `${Number(l.quantityAvailable)} ${l.status}`).join(', ')}`
        );
        console.log(`${po.poNumber}: received per line ${poLine.map((l) => Number(l.receivedQuantity)).join(', ')}`);
        if (transitStateOf(after) !== 'OPEN')
          throw new Error(`Expected the challan OPEN, got ${transitStateOf(after)}`);
        if (!APPLY) throw new DryRun();
      },
      { timeout: 60000, maxWait: 10000 }
    );
  } catch (err) {
    if (err instanceof DryRun) {
      console.log('\nDRY RUN — everything above was rolled back. Re-run with --apply to write it.');
      return;
    }
    throw err;
  }

  await purchaseOrderService.updateReceivingStatus(po.id);
  await createAuditLog({
    userId: user.id,
    action: 'UPDATE',
    entityType: 'challans',
    entityId: challan.id,
    oldValues: { challanDate: challan.challanDate, status: challan.status, directSupplyGrnId: grn.id },
    newValues: {
      event: 'CONVERTED_TO_TRANSIT_CHALLAN',
      challanDate: CHALLAN_DATE,
      supplierDispatchedAt: DISPATCHED,
      reversedGrn: GRN_NUMBER,
    },
  });
  console.log(
    `\nAPPLIED. ${challan.challanNumber} is on the way to the processor; file the receipt against it on arrival.`
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
