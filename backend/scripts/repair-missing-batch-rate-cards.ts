/**
 * Give batch-priced costing rows the rate card their rate came from (2026-10-02).
 *
 * The Fabric Costing page priced a processing batch with ONE lookup and copied the rate onto every
 * other row of the batch — but not the card id (fixed in 6c596e87). Those rows were saved with the
 * right rate and NO card, so nothing downstream could tell their process, print type or committed
 * shrinkage (STYLE 036 / 063 / 064 / 094 / 095 / 099, ESSKY083LS: dyeing at ₹10, card on the other
 * row of the batch).
 *
 * A row gets its batch-mate's card only when that is beyond doubt: the row is a costing (price
 * set, BUILD_UP), has a processor and batch colour and no card; its batch-mates (same costing style,
 * purpose, greige, processor, batch colour) that DO have a card all hold the SAME card; that card's
 * rate equals the row's rate; and both were priced on the same batch metres — or, when the mate was
 * re-priced on other metres since, the same process's card at THIS row's metres has the row's rate.
 * Cost-sheet and Order
 * BOM lines copied from the row with no card (same processor, same processing rate) get it too. No
 * rate, total or approval changes.
 *
 *   npx ts-node --files scripts/repair-missing-batch-rate-cards.ts           (dry run)
 *   npx ts-node --files scripts/repair-missing-batch-rate-cards.ts --apply
 */

import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';
import { lookupRate } from '../src/services/processor-rate-v2.service';
import type { PrintingTypeV2, ProcessingTypeV2 } from '../src/types/processor-rate-v2.types';

const APPLY = process.argv.includes('--apply');
const SNAPSHOT = path.join(__dirname, `repair-missing-batch-rate-cards-snapshot-${Date.now()}.json`);
const near = (a: unknown, b: unknown, tol = 0.005) =>
  a != null && b != null && Math.abs(Number(a) - Number(b)) < tol;

async function main() {
  const rows = await prisma.fabric_width_cad.findMany({
    where: {
      costingStyleId: { not: null },
      totalCostPerMeter: { not: null },
      processorId: { not: null },
      processingBatchGroupColorId: { not: null },
    },
    select: {
      id: true,
      costingStyleId: true,
      purposeEnum: true,
      greigeId: true,
      processorId: true,
      processingBatchGroupColorId: true,
      rateCardId: true,
      processingPricePerMeter: true,
      costedAtQuantityMeters: true,
      costInputMode: true,
      componentName: true,
      cutableWidth: true,
      costingApprovalStatus: true,
      costingStyle: { select: { styleCode: true, buyerStyleRef: true } },
      rateCard: { select: { id: true, ratePerMeter: true, processingType: true, printingType: true } },
    },
  });

  const batchOf = (r: (typeof rows)[number]) =>
    [r.costingStyleId, r.purposeEnum, r.greigeId, r.processorId, r.processingBatchGroupColorId].join('|');

  type Fix = {
    cadId: string;
    style: string;
    row: string;
    rate: number;
    cardId: string;
    card: string;
    costSheetLines: string[];
    orderBomLines: string[];
  };
  const fixes: Fix[] = [];
  const skipped: string[] = [];

  for (const r of rows) {
    if (r.rateCardId || r.costInputMode !== 'BUILD_UP' || r.processingPricePerMeter == null) continue;
    const style = r.costingStyle?.buyerStyleRef || r.costingStyle?.styleCode || '?';
    const label = `${style} ${r.componentName ?? 'Row'} ${Number(r.cutableWidth)}" (${r.id})`;
    const mates = rows.filter((m) => m.id !== r.id && m.rateCard && batchOf(m) === batchOf(r));
    const cardIds = [...new Set(mates.map((m) => m.rateCard!.id))];
    if (cardIds.length !== 1) {
      skipped.push(`${label}: ${cardIds.length === 0 ? 'no batch-mate has a card' : `batch-mates hold ${cardIds.length} cards`}`);
      continue;
    }
    const mate = mates.find((m) => m.rateCard!.id === cardIds[0])!;
    let card = mate.rateCard!;
    if (!near(mate.costedAtQuantityMeters, r.costedAtQuantityMeters, 0.05)) {
      // The mate was re-priced on other metres since (STYLE 063: 385 m alone vs this row's 1,265 m
      // batch). Same process, but the card for THIS row's metres — accepted only at the same rate.
      const fresh =
        r.costedAtQuantityMeters != null
          ? await lookupRate({
              processorId: r.processorId!,
              processingType: card.processingType as ProcessingTypeV2,
              printingType: (card.printingType ?? undefined) as PrintingTypeV2 | undefined,
              greigeId: r.greigeId!,
              quantityMeters: Number(r.costedAtQuantityMeters),
            }).catch(() => null)
          : null;
      if (!fresh) {
        skipped.push(`${label}: priced at ${Number(r.costedAtQuantityMeters)} m, no card found at those metres`);
        continue;
      }
      card = {
        id: fresh.id,
        ratePerMeter: fresh.ratePerMeter as unknown as typeof card.ratePerMeter,
        processingType: card.processingType,
        printingType: card.printingType,
      };
    }
    if (!near(card.ratePerMeter, r.processingPricePerMeter)) {
      skipped.push(`${label}: rate ₹${Number(r.processingPricePerMeter)} ≠ card ₹${Number(card.ratePerMeter)}`);
      continue;
    }

    const [costSheetLines, orderBomLines] = await Promise.all([
      prisma.style_costing_fabric_items.findMany({
        where: { fabricCADId: r.id, rateCardId: null, processorId: r.processorId },
        select: { id: true, processingCost: true },
      }),
      prisma.order_bom_items.findMany({
        where: { selectedCadId: r.id, rateCardId: null, processorId: r.processorId },
        select: { id: true, processingCost: true },
      }),
    ]);
    fixes.push({
      cadId: r.id,
      style,
      row: label,
      rate: Number(r.processingPricePerMeter),
      cardId: card.id,
      card: `${card.processingType}${card.printingType ? `/${card.printingType}` : ''} ₹${Number(card.ratePerMeter)}`,
      costSheetLines: costSheetLines.filter((l) => near(l.processingCost, card.ratePerMeter)).map((l) => l.id),
      orderBomLines: orderBomLines.filter((l) => near(l.processingCost, card.ratePerMeter)).map((l) => l.id),
    });
  }

  console.log(`${fixes.length} costing row(s) to link to their batch's card:`);
  for (const f of fixes) {
    console.log(
      `  ${f.row} ₹${f.rate} → card ${f.card} (${f.cardId}); cost-sheet lines ${f.costSheetLines.length}, ` +
        `Order BOM lines ${f.orderBomLines.length}`
    );
  }
  if (skipped.length) {
    console.log(`\n${skipped.length} card-less batch row(s) left alone:`);
    for (const s of skipped) console.log(`  ${s}`);
  }

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply.');
    return;
  }
  if (fixes.length === 0) return;

  fs.writeFileSync(SNAPSHOT, JSON.stringify({ at: new Date().toISOString(), fixes }, null, 2));
  await prisma.$transaction(async (tx) => {
    for (const f of fixes) {
      await tx.fabric_width_cad.update({ where: { id: f.cadId }, data: { rateCardId: f.cardId } });
      if (f.costSheetLines.length) {
        await tx.style_costing_fabric_items.updateMany({
          where: { id: { in: f.costSheetLines }, rateCardId: null },
          data: { rateCardId: f.cardId },
        });
      }
      if (f.orderBomLines.length) {
        await tx.order_bom_items.updateMany({
          where: { id: { in: f.orderBomLines }, rateCardId: null },
          data: { rateCardId: f.cardId },
        });
      }
    }
  });
  console.log(`\nApplied. Snapshot (undo = set rateCardId back to null on these ids): ${SNAPSHOT}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
