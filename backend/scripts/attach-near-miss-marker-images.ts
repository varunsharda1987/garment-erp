/**
 * One-off (owner decision 29-Sep-2026): attach 17 CAD images uploaded before 28-Sep to the rows they belong to,
 * although they DIFFER from those rows.
 *
 * match-existing-marker-images.ts linked only exact matches. These 17 nearly match an approved row (a rounded
 * length, other pieces, another width). The owner chose to attach them anyway so every row carries its marker:
 * no CAD value changes, the rows stay approved, and each shows a red "Differs" chip listing what differs — the
 * team's to-do list (fix with Correct…, whose picker now offers the row's own image, or leave it). The on-screen
 * rule is unchanged: an approved row still takes only an exactly matching image from the page.
 *
 * Ten of them are on a best-guess row where the width differs (the five ROXIE EMB images are 48" markers on
 * 50" rows, STYLE 009, STYLE 063, both ESSKA241CK images, the IT00254 EMB image).
 *
 *   npx ts-node --files scripts/attach-near-miss-marker-images.ts            (dry run — writes nothing)
 *   npx ts-node --files scripts/attach-near-miss-marker-images.ts --apply    (attaches; undo record saved beside it)
 */

import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';
import { currentMarkerFile, recordMarkerImage } from '../src/services/helpers/cad-marker.helper';

const APPLY = process.argv.includes('--apply');
const UNDO = path.join(__dirname, 'attach-near-miss-marker-images-undo.json');

type Purpose = 'COSTING' | 'RAW_MATERIAL_CALCULATION';
interface Target {
  style: string;
  image: string;
  purpose: Purpose;
  width: number;
  length: number;
  guess?: true;
}

const RM: Purpose = 'RAW_MATERIAL_CALCULATION';
const CO: Purpose = 'COSTING';
const TARGETS: Target[] = [
  // same width as the image — no doubt which row
  { style: 'IT00254', image: 'IT0054 TOP AVG  STO XXL.png', purpose: RM, width: 52, length: 3.85 },
  { style: 'IP00138', image: 'IT00138 PANT AVG 5PC NEW.png', purpose: RM, width: 52, length: 8.3 },
  { style: 'STYLE 035', image: 'BENNIT (Sleeve emb).jpeg', purpose: CO, width: 52, length: 3.39 },
  { style: 'ESSKY084LS', image: 'TISHA AVG SOLED BACK.png', purpose: RM, width: 52, length: 1.95 },
  { style: 'ESSKY084LS', image: 'TISHA AVG EMB .png', purpose: RM, width: 48, length: 4.83 },
  { style: 'STYLE 023', image: 'LEVIS.jpeg', purpose: CO, width: 52, length: 2.2 },
  { style: 'STYLE 064', image: 'STYLE 063, 064 (EMB) (OASIS).jpeg', purpose: CO, width: 54, length: 0.75 },
  // the width differs — the row is the best guess
  { style: 'IT00254', image: 'IT0054 EMB AVG 5PC.png', purpose: RM, width: 50, length: 1.7, guess: true },
  { style: 'ESSKA241CK', image: 'WhatsApp Image 2026-08-18 at 5.18.49 PM (1).jpeg', purpose: RM, width: 50, length: 2.7, guess: true },
  { style: 'ESSKA241CK', image: 'WhatsApp Image 2026-08-18 at 5.18.49 PM.jpeg', purpose: RM, width: 52, length: 14.36, guess: true },
  { style: 'STYLE 009', image: 'BENNIT (PRINTED).jpeg', purpose: CO, width: 52, length: 3.28, guess: true },
  { style: 'STYLE 063', image: 'STYLE 063, 064 (EMB) (OASIS).jpeg', purpose: CO, width: 50, length: 0.75, guess: true },
  { style: 'STYLE 094', image: 'ROXIE (EMB).jpeg', purpose: CO, width: 50, length: 2.98, guess: true },
  { style: 'STYLE 095', image: 'ROXIE (EMB).jpeg', purpose: CO, width: 50, length: 2.93, guess: true },
  { style: 'STYLE 096', image: 'ROXIE (EMB).jpeg', purpose: CO, width: 50, length: 2.98, guess: true },
  { style: 'STYLE 098', image: 'ROXIE (EMB).jpeg', purpose: CO, width: 50, length: 2.98, guess: true },
  { style: 'STYLE 099', image: 'ROXIE (EMB).jpeg', purpose: CO, width: 50, length: 2.98, guess: true },
];

async function main() {
  const done: Array<{ fileId: string; cadId: string; style: string; image: string }> = [];
  const problems: string[] = [];
  for (const t of TARGETS) {
    const label = `${t.style} · ${t.image} → ${t.purpose === RM ? 'Raw Mat' : 'Costing'} ${t.width}" ${t.length} m`;
    const style = await prisma.styles.findFirst({
      where: { OR: [{ buyerStyleRef: t.style }, { styleCode: t.style }] },
      select: { id: true },
    });
    if (!style) {
      problems.push(`${label}: style not found`);
      continue;
    }
    const files = await prisma.cad_purpose_files.findMany({
      where: { styleId: style.id, fileName: t.image, cadId: null },
    });
    // Width and length compared within 0.005 in code — an exact decimal filter missed IP00138's 8.3
    const rows = (
      await prisma.fabric_width_cad.findMany({
        where: {
          OR: [{ costingStyleId: style.id }, { styleFabric: { style_components: { styleId: style.id } } }],
          purposeEnum: t.purpose,
        },
        select: { id: true, cutableWidth: true, cadMeters: true },
      })
    ).filter(
      (r) =>
        Math.abs(Number(r.cutableWidth) - t.width) < 0.005 &&
        r.cadMeters !== null &&
        Math.abs(Number(r.cadMeters) - t.length) < 0.005
    );
    if (files.length !== 1 || rows.length !== 1) {
      problems.push(`${label}: ${files.length} unattached image(s), ${rows.length} matching row(s) — skipped`);
      continue;
    }
    if (await currentMarkerFile(prisma, rows[0].id)) {
      problems.push(`${label}: the row already has an image — skipped`);
      continue;
    }
    console.log(`${APPLY ? 'ATTACH' : 'would attach'}  ${label}${t.guess ? '   (best guess: width differs)' : ''}`);
    if (APPLY) {
      const linked = await prisma.cad_purpose_files.update({
        where: { id: files[0].id },
        data: { cadId: rows[0].id, replacedAt: null },
      });
      await recordMarkerImage(rows[0].id, null, linked);
      done.push({ fileId: linked.id, cadId: rows[0].id, style: t.style, image: t.image });
    }
  }
  problems.forEach((p) => console.log('!! ' + p));
  if (APPLY) {
    // Undo: set cadId back to null on these file ids
    fs.writeFileSync(UNDO, JSON.stringify({ at: new Date().toISOString(), attached: done }, null, 2));
    console.log(`\n${done.length} attached. Undo record: ${UNDO}`);
  } else {
    console.log(`\nDry run: ${TARGETS.length - problems.length} would be attached, ${problems.length} skipped.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
