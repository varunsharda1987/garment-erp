/**
 * One-off: split "DORI WITH TASSEL" (DS-0002) into its two items (2026-09-26).
 *
 * The owner: dori and tassel are given separately (sometimes attached) — the dori is bought and used in
 * METRES, the tassel in PIECES. One drawstring master stood for both, counted in metres, so its cost-sheet
 * line "2 × ₹4" could not say how much of it was dori and how much tassel.
 *
 *   - DS-0002 becomes the dori: renamed "DORI", colour "Dark blue" — still a METER drawstring.
 *   - A new Other Decorative item "TASSEL" (type Tassel, colour "Light blue") is created with its
 *     materials record (counted per PIECE). No price — the owner fills it on the master.
 *   - Every style BOM that carries the dori gets a TASSEL line beside it (qty 0, like every trim line).
 *   - Cost sheets are NOT edited — "2 × ₹4" cannot be split by guesswork. They are listed for the owner
 *     to enter dori metres and tassel pieces.
 *
 *   npx ts-node scripts/split-dori-tassel.ts            (dry-run)
 *   npx ts-node scripts/split-dori-tassel.ts --apply
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import prisma from '../src/config/database';
import { generateCode } from '../src/utils/code-generator';
import { ensureMaterialRecord } from '../src/services/helpers/material-sync.helper';
import { lineUnit, loadMaterialUnits } from '../src/services/helpers/material-unit.helper';

const APPLY = process.argv.includes('--apply');
const SNAPSHOT = path.join(__dirname, 'split-dori-tassel-snapshot.json');
const DORI_CODE = 'DS-0002';
const SPLIT_NOTE = `Split from "DORI WITH TASSEL" (${DORI_CODE}) on 2026-09-26`;

async function main() {
  const dori = await prisma.drawstring_master.findUnique({ where: { drawstringCode: DORI_CODE } });
  if (!dori) {
    console.log(`${DORI_CODE} not found — nothing to do.`);
    return;
  }
  const already = await prisma.other_decorative_master.findFirst({ where: { description: SPLIT_NOTE } });
  if (already) {
    console.log(`Already split: tassel ${already.otherDecorativeCode} exists. Nothing to do.`);
    return;
  }

  const bomLines = await prisma.style_material_bom.findMany({
    where: { drawstringId: dori.id },
    include: { styles: { select: { styleCode: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const costLines = await prisma.style_costing_trim_items.findMany({
    where: { OR: [{ drawstringId: dori.id }, { materialId: dori.id }] },
    select: {
      costingId: true,
      trimName: true,
      trimQuantity: true,
      trimRate: true,
      costing: { select: { approvalStatus: true, styles: { select: { styleCode: true } } } },
    },
  });

  console.log(`${DORI_CODE} "${dori.drawstringName}" (${dori.color ?? '—'}) → "DORI", colour "Dark blue" (metres)`);
  console.log(`New Other Decorative "TASSEL", colour "Light blue" (pieces, no price yet)`);
  console.log(`\nStyle BOMs getting a TASSEL line beside the dori (${bomLines.length}):`);
  for (const l of bomLines) console.log(`  ${l.styles.styleCode}`);
  console.log(`\nCost sheets NOT changed — enter dori metres + tassel pieces yourself (${costLines.length}):`);
  for (const c of costLines) {
    console.log(
      `  ${c.costing.styles.styleCode}  ${c.costingId}  (${String(c.costing.approvalStatus)})  ` +
        `"${c.trimName}" ${Number(c.trimQuantity)} × ₹${Number(c.trimRate)}`
    );
  }

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to write.');
    return;
  }

  fs.writeFileSync(
    SNAPSHOT,
    JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        dori: { id: dori.id, drawstringName: dori.drawstringName, color: dori.color, description: dori.description },
        bomLines: bomLines.map((l) => ({ id: l.id, styleCode: l.styles.styleCode, componentName: l.componentName })),
      },
      null,
      2
    )
  );

  const tasselCode = await generateCode('OD', 'other_decorative_master', 'otherDecorativeCode');
  const result = await prisma.$transaction(async (tx) => {
    await tx.drawstring_master.update({
      where: { id: dori.id },
      data: { drawstringName: 'DORI', color: 'Dark blue', description: SPLIT_NOTE },
    });
    await tx.materials.update({ where: { id: dori.id }, data: { name: 'DORI' } });

    const tassel = await tx.other_decorative_master.create({
      data: {
        otherDecorativeCode: tasselCode,
        otherDecorativeName: 'TASSEL',
        type: 'Tassel',
        color: 'Light blue',
        material: dori.material,
        description: SPLIT_NOTE,
        createdById: dori.createdById,
      },
    });
    await ensureMaterialRecord(tassel.id, 'OTHER_DECORATIVE', tx);
    const units = await loadMaterialUnits([tassel.id], tx);

    for (const line of bomLines) {
      if (line.componentName === 'DORI WITH TASSEL') {
        await tx.style_material_bom.update({ where: { id: line.id }, data: { componentName: 'DORI' } });
      }
      await tx.style_material_bom.create({
        data: {
          id: randomUUID(),
          styleId: line.styleId,
          materialType: 'OTHER_DECORATIVE',
          materialId: tassel.id,
          otherDecorativeId: tassel.id,
          usageCategory: line.usageCategory,
          componentName: 'TASSEL',
          quantityPerGarment: 0,
          unit: lineUnit({ materialType: 'OTHER_DECORATIVE', materialId: tassel.id }, units),
          extraPercentage: line.extraPercentage,
          sortOrder: line.sortOrder,
          isActive: line.isActive,
        },
      });
    }
    return tassel;
  });

  console.log(`\nDone. DORI = ${DORI_CODE}; TASSEL = ${result.otherDecorativeCode}. Snapshot: ${SNAPSHOT}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
