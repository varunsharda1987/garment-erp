/**
 * One-off relink: ESSKY082LS greige GRG-0053 → GRG-0039 (2026-09-26).
 *
 * MR2609-0255 (ORD2026090132, Top – Viscose Staple, 1,797.32 m) showed no stock because the style's
 * CAD row had picked GRG-0053 — Viscose Staple 30×30 / 68×60 / 63" — which has never had a lot. The
 * style (like its sisters ESSKY074/075/076/087/093/094LS) is GRG-0039 — 30×30 / 68×64 / 63", the
 * greige actually in the store (GRN2608-0004 / PO2608-0003 @ ₹47). Owner confirmed 26-Sep-2026.
 *
 * Why a script: the CAD row is CAD- AND price-approved, so CAD Planning refuses the edit
 * (validateCADModification) and the costing unapprove guard 409s under the approved cost sheet that
 * feeds the order's approved BOM. Only the greige IDENTITY moves — every price stays (greige ₹47 =
 * GRG-0039's own live rate, Pigment ₹20, shrinkage 10%, ₹74.22/m) and no quantity changes, so each
 * row is corrected in place rather than re-versioned. The guards below refuse to run if any price
 * differs from that.
 *
 * Changes, in ONE transaction, one audit_logs row each:
 *   - processor_rate_card  NEW: Shree Bhavya · PRINTING/PIGMENT · GRG-0039 · ₹20 · 10% (copy of the
 *                          GRG-0053 card — a rate card prices ONE greige, check D20)
 *   - fabric_width_cad     greigeId + rateCardId + greige-rate label (greigeRateProvenance)
 *   - style_costing_fabric_items ×2 (COSTING + RAW_MATERIAL_CALCULATION sheets)  greigeId + rateCardId
 *   - order_bom_items      greigeId + rateCardId
 *   - material_requirements MR2609-0255 (MATERIAL) + MR2609-0256 (its PROCESSING partner)  materialId
 *
 * Stock is NOT reserved here (owner's call): the team reserves it with Use Stock on the requirement.
 *
 *   npx ts-node scripts/relink-essky082ls-greige.ts            (dry run)
 *   npx ts-node scripts/relink-essky082ls-greige.ts --apply
 */

import { randomUUID } from 'crypto';
import prisma from '../src/config/database';
import { greigeRateProvenance, resolveLiveGreigeRates } from '../src/services/helpers/greige-live-rate.helper';

const APPLY = process.argv.includes('--apply');

const OLD_GREIGE = '8c66b6b2-e278-4b7b-aad9-36ab26d88d42'; // GRG-0053 (materials.id === greige id)
const NEW_GREIGE = 'eb566935-7f38-4a85-bea4-233558448e5c'; // GRG-0039
const CAD_ID = '158e2307-38ad-4f5a-8772-bfe63f14192f'; // ESSKY082LS Top 52" RAW_MATERIAL_CALCULATION
const COST_ITEM_IDS = [
  'ce89aca1-a14f-4619-b709-a6a8136c3a58', // CS-1787742189497-6j5k5x6 (COSTING)
  '2158764c-defd-46fc-bdfe-7c2ccf062dfb', // CS-1790331136078-f38748i (RAW_MATERIAL_CALCULATION, BOM source)
];
const BOM_ITEM_ID = '39741460-7516-41f8-bd78-d5311595875e'; // ORD2026090132 BOM v1
const MR_IDS = [
  'c8509714-339e-4653-a7ae-9fb4e58a471a', // MR2609-0255 MATERIAL
  '712dd6bd-a6be-41eb-994c-ea8d679894d2', // MR2609-0256 PROCESSING (linked to 0255)
];
const SOURCE_CARD_ID = '8bcdf169-8cb9-4118-acb1-56362efa16d7'; // Shree Bhavya · Pigment ₹20 · GRG-0053
const ACTING_USER_EMAIL = 'admin@kasya.in';

const EXPECTED = { greige: 47, processing: 20, total: 74.22 };
const REASON =
  'ESSKY082LS greige GRG-0053 (68×60) → GRG-0039 (68×64), owner 26-Sep-2026: the CAD row had picked the ' +
  'wrong master; the style and the stock are GRG-0039. Prices unchanged.';

const num = (v: unknown) => (v == null ? null : Number(v));
const same = (a: unknown, b: number) => a != null && Math.abs(Number(a) - b) < 0.005;

function refuse(msg: string): never {
  console.error(`\nREFUSED — nothing written.\n  ${msg}`);
  process.exit(1);
}

async function main() {
  const [cad, costItems, bomItem, mrs, sourceCard, user] = await Promise.all([
    prisma.fabric_width_cad.findUnique({ where: { id: CAD_ID } }),
    prisma.style_costing_fabric_items.findMany({ where: { id: { in: COST_ITEM_IDS } } }),
    prisma.order_bom_items.findUnique({ where: { id: BOM_ITEM_ID } }),
    prisma.material_requirements.findMany({ where: { id: { in: MR_IDS } } }),
    prisma.processor_rate_card.findUnique({ where: { id: SOURCE_CARD_ID } }),
    prisma.users.findFirst({ where: { email: ACTING_USER_EMAIL, isActive: true }, select: { id: true } }),
  ]);

  if (!cad || !bomItem || !sourceCard || !user) refuse('CAD row, BOM line, source rate card or acting user not found');
  if (costItems.length !== COST_ITEM_IDS.length) refuse(`expected ${COST_ITEM_IDS.length} cost-sheet lines, found ${costItems.length}`);
  if (mrs.length !== MR_IDS.length) refuse(`expected ${MR_IDS.length} requirements, found ${mrs.length}`);

  // --- Already done? -------------------------------------------------------------------------------
  const onOld = [
    cad.greigeId === OLD_GREIGE,
    ...costItems.map((i) => i.greigeId === OLD_GREIGE),
    bomItem.greigeId === OLD_GREIGE,
    ...mrs.map((r) => r.materialId === OLD_GREIGE),
  ];
  if (onOld.every((x) => !x)) {
    const stillNew = cad.greigeId === NEW_GREIGE && bomItem.greigeId === NEW_GREIGE;
    console.log(stillNew ? 'Nothing to change — every row is already on GRG-0039.' : 'Rows are on neither greige — inspect by hand.');
    return;
  }
  if (!onOld.every(Boolean)) refuse('some rows are on GRG-0053 and some are not — a partial state; inspect by hand');

  // --- Guards: identity only, never money ----------------------------------------------------------
  if (!same(cad.greigeCostPerMeter, EXPECTED.greige) || !same(cad.processingPricePerMeter, EXPECTED.processing) || !same(cad.totalCostPerMeter, EXPECTED.total)) {
    refuse(`CAD prices moved: greige ${num(cad.greigeCostPerMeter)}, processing ${num(cad.processingPricePerMeter)}, total ${num(cad.totalCostPerMeter)}`);
  }
  for (const i of costItems) {
    if (!same(i.greigeCost, EXPECTED.greige) || !same(i.processingCost, EXPECTED.processing) || !same(i.costPerMeter, EXPECTED.total)) {
      refuse(`cost-sheet line ${i.id} prices moved: greige ${num(i.greigeCost)}, processing ${num(i.processingCost)}, ₹/m ${num(i.costPerMeter)}`);
    }
    if (i.fabricCADId !== CAD_ID) refuse(`cost-sheet line ${i.id} is not built from CAD ${CAD_ID}`);
  }
  if (!same(bomItem.greigeCost, EXPECTED.greige) || !same(bomItem.processingCost, EXPECTED.processing) || !same(bomItem.unitPrice, EXPECTED.total)) {
    refuse(`BOM line prices moved: greige ${num(bomItem.greigeCost)}, processing ${num(bomItem.processingCost)}, ₹/m ${num(bomItem.unitPrice)}`);
  }
  if (cad.rateCardId !== SOURCE_CARD_ID || bomItem.rateCardId !== SOURCE_CARD_ID || costItems.some((i) => i.rateCardId !== SOURCE_CARD_ID)) {
    refuse('a row is priced from a card other than the GRG-0053 Pigment ₹20 card');
  }
  for (const r of mrs) {
    if (r.status !== 'PO_REQUIRED' || !same(r.allocatedFromStock, 0)) {
      refuse(`${r.requirementNumber} has moved on (status ${r.status}, allocated ${num(r.allocatedFromStock)})`);
    }
  }
  // Nothing may hang off the requirements (PO links, reservations, JWOs…) except 0256 → 0255 itself
  const refCols = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
    SELECT c.table_name, c.column_name
      FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
     WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE' AND c.column_name ILIKE '%requirement%id%'`;
  for (const { table_name, column_name } of refCols) {
    const rows = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM "${table_name}" WHERE "${column_name}"::text = ANY($1)`,
      MR_IDS
    );
    const expected = table_name === 'material_requirements' && column_name === 'linkedRequirementId' ? 1 : 0;
    if (rows[0].n !== expected) refuse(`${table_name}.${column_name} references the requirements (${rows[0].n} rows)`);
  }

  // --- Rate card on GRG-0039 (reuse if someone already added it) -----------------------------------
  const existingCard = await prisma.processor_rate_card.findFirst({
    where: {
      processorId: sourceCard.processorId,
      processingType: sourceCard.processingType,
      printingType: sourceCard.printingType,
      greigeId: NEW_GREIGE,
      slabId: sourceCard.slabId,
      effectiveTo: null,
      isActive: true,
    },
  });
  if (existingCard && !same(existingCard.ratePerMeter, EXPECTED.processing)) {
    refuse(`a GRG-0039 ${sourceCard.printingType} card already exists at ₹${num(existingCard.ratePerMeter)}, not ₹${EXPECTED.processing}`);
  }

  // --- Greige-rate label: ₹47 against GRG-0039's live rate -----------------------------------------
  const live = (await resolveLiveGreigeRates([NEW_GREIGE])).get(NEW_GREIGE);
  const provenance = greigeRateProvenance({
    rate: num(cad.greigeCostPerMeter),
    live,
    reason: REASON, // used only if ₹47 is NOT the live rate
    userId: user.id,
    rowLabel: 'ESSKY082LS Top 52"',
  });

  // --- Report --------------------------------------------------------------------------------------
  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN'} — ESSKY082LS GRG-0053 → GRG-0039\n`);
  console.log(`Rate card        ${existingCard ? `reuse ${existingCard.id}` : `NEW  Shree Bhavya · ${sourceCard.processingType}/${sourceCard.printingType} · GRG-0039 · ₹${num(sourceCard.ratePerMeter)} · ${num(sourceCard.shrinkagePercent)}% · slab ${sourceCard.slabId}`}`);
  console.log(`CAD ${CAD_ID}  greige GRG-0053 → GRG-0039; card → GRG-0039 card`);
  console.log(`                 rate label ${cad.greigeRateSource ?? '—'} → ${provenance.greigeRateSource} ${provenance.greigeRateSourceRef ?? ''} (live ₹${live?.rate ?? '—'})`);
  for (const i of costItems) console.log(`Cost line ${i.id}  sheet ${i.costingId}  greige + card → GRG-0039`);
  console.log(`BOM line ${BOM_ITEM_ID}  greige + card → GRG-0039`);
  for (const r of mrs) console.log(`${r.requirementNumber} (${r.requirementType})  material GRG-0053 → GRG-0039`);

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to write all of the above in one transaction.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    const audit = (entityType: string, entityId: string, oldValues: object, newValues: object) =>
      tx.audit_logs.create({
        data: { id: randomUUID(), userId: user.id, action: 'RELINK_GREIGE', entityType, entityId, oldValues, newValues: { ...newValues, reason: REASON } },
      });

    const card =
      existingCard ??
      (await tx.processor_rate_card.create({
        data: {
          processorId: sourceCard.processorId,
          processingType: sourceCard.processingType,
          printingType: sourceCard.printingType,
          greigeId: NEW_GREIGE,
          slabId: sourceCard.slabId,
          ratePerMeter: sourceCard.ratePerMeter,
          shrinkagePercent: sourceCard.shrinkagePercent,
          screenCostPerScreen: sourceCard.screenCostPerScreen,
          screenType: sourceCard.screenType,
          createdById: user.id,
          changeReasonCode: 'CORRECTION',
          changeNotes: `Copied from the GRG-0053 card ${SOURCE_CARD_ID}: ${REASON}`,
        },
      }));
    if (!existingCard) await audit('processor_rate_card', card.id, {}, { copiedFrom: SOURCE_CARD_ID, greigeId: NEW_GREIGE });

    await tx.fabric_width_cad.update({
      where: { id: CAD_ID },
      data: { greigeId: NEW_GREIGE, rateCardId: card.id, ...provenance },
    });
    await audit(
      'fabric_width_cad',
      CAD_ID,
      { greigeId: OLD_GREIGE, rateCardId: SOURCE_CARD_ID, greigeRateSource: cad.greigeRateSource, greigeRateOverrideReason: cad.greigeRateOverrideReason },
      { greigeId: NEW_GREIGE, rateCardId: card.id, greigeRateSource: provenance.greigeRateSource, greigeRateSourceRef: provenance.greigeRateSourceRef }
    );

    for (const i of costItems) {
      await tx.style_costing_fabric_items.update({ where: { id: i.id }, data: { greigeId: NEW_GREIGE, rateCardId: card.id } });
      await audit('style_costing_fabric_items', i.id, { greigeId: OLD_GREIGE, rateCardId: SOURCE_CARD_ID }, { greigeId: NEW_GREIGE, rateCardId: card.id });
    }

    await tx.order_bom_items.update({ where: { id: BOM_ITEM_ID }, data: { greigeId: NEW_GREIGE, rateCardId: card.id } });
    await audit('order_bom_items', BOM_ITEM_ID, { greigeId: OLD_GREIGE, rateCardId: SOURCE_CARD_ID }, { greigeId: NEW_GREIGE, rateCardId: card.id });

    for (const r of mrs) {
      await tx.material_requirements.update({ where: { id: r.id }, data: { materialId: NEW_GREIGE } });
      await audit('material_requirements', r.id, { materialId: OLD_GREIGE }, { materialId: NEW_GREIGE });
    }
  });

  console.log('\nApplied. Re-run without --apply: it should say nothing is left to change.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
