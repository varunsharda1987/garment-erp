/**
 * One-off: put the CAD images uploaded before 28-Sep-2026 on the CAD rows they are the markers of.
 *
 * Until then an image ("mini marker") belonged to a style + purpose only, never to a CAD row. The marker rule
 * (services/helpers/cad-marker.helper.ts) now keeps each row's image on the row. This reads every image not yet
 * on a row (backend/ocr) and looks for the row it belongs to: same style, same purpose, and NOTHING differing —
 * layer length and width within 0.005, same sizes, every piece placed. Only such an exact match is linked; an
 * image that matches no row, or a row only nearly (a length typed 3.85 against a marker of 3.82), is listed for
 * someone to link on screen (CAD Image → use an uploaded image) and for the owner to look at.
 *
 * It never changes a CAD value, and never links an image to a row that already has one.
 *
 *   npx ts-node scripts/match-existing-marker-images.ts            (dry run: reads the images, writes nothing)
 *   npx ts-node scripts/match-existing-marker-images.ts --apply    (stores the readings, links the exact matches)
 *
 * Reading takes ~6 s an image, one at a time.
 */

import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';
import { markerFilePath, readMarkerFile } from '../src/services/marker-reader.service';
import {
  currentMarkerFiles,
  markerDifferences,
  readingColumns,
  recordMarkerImage,
  rowMarkerValues,
  storedReading,
  styleSizeNames,
  type MarkerDifference,
  type StoredReading,
} from '../src/services/helpers/cad-marker.helper';

const APPLY = process.argv.includes('--apply');
const REPORT = path.join(__dirname, `match-existing-marker-images-${APPLY ? 'applied' : 'dry-run'}.json`);

interface Line {
  image: string;
  style: string;
  purpose: string;
  read: string;
  outcome: 'LINK' | 'LINKED' | 'NEAR' | 'NONE' | 'UNREADABLE' | 'ROW_HAS_IMAGE';
  row?: string;
  differences?: string[];
}

async function main() {
  const files = await prisma.cad_purpose_files.findMany({
    where: { cadId: null },
    include: { style: { select: { styleCode: true, buyerStyleRef: true } } },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`${files.length} CAD images are on no row — reading them${APPLY ? ' and linking exact matches' : ' (dry run)'}`);

  const lines: Line[] = [];
  for (const file of files) {
    const style = file.style.buyerStyleRef || file.style.styleCode;
    // Read the image (the dry run writes nothing; --apply keeps the reading on the image)
    let reading: StoredReading = storedReading(file);
    if (!file.readStatus) {
      const full = markerFilePath(file.fileUrl);
      const fresh = full && fs.existsSync(full) ? await readMarkerFile(full) : null;
      if (fresh) {
        reading = { ...fresh, error: fresh.error ?? null, readAt: new Date() };
        if (APPLY) await prisma.cad_purpose_files.update({ where: { id: file.id }, data: readingColumns(fresh) });
      }
    }
    const readText =
      reading.lengthM === null
        ? `${reading.status ?? 'not read'}`
        : `${reading.lengthM} m · ${reading.widthIn ?? '?'} in · ${reading.sizes.map((s) => `${s.sizeName}${s.quantity > 1 ? `×${s.quantity}` : ''}`).join('-') || 'sizes?'}`;
    const base = { image: file.fileName ?? file.id, style, purpose: file.purpose, read: readText };
    if (reading.lengthM === null) {
      lines.push({ ...base, outcome: 'UNREADABLE' });
      continue;
    }

    const rows = await prisma.fabric_width_cad.findMany({
      where: {
        OR: [{ costingStyleId: file.styleId }, { styleFabric: { style_components: { styleId: file.styleId } } }],
        purposeEnum: file.purpose,
      },
      select: {
        id: true,
        cadMeters: true,
        cutableWidth: true,
        approvalStatus: true, // allow-cad-approval: shown in the report only
        sizeBreakdowns: { select: { sizeName: true, quantity: true } },
      },
    });
    const sizes = await styleSizeNames(prisma, file.styleId);
    const withImage = await currentMarkerFiles(
      prisma,
      rows.map((r) => r.id)
    );
    const scored = rows.map((r) => ({
      row: r,
      differences: markerDifferences(rowMarkerValues(r), reading, sizes) as MarkerDifference[],
    }));
    const exact = scored.filter((s) => s.differences.length === 0);
    const near = scored
      .filter((s) => s.differences.length > 0 && s.differences.every((d) => d.field !== 'width'))
      .sort((a, b) => a.differences.length - b.differences.length);
    const label = (r: (typeof rows)[number]) => `${Number(r.cutableWidth)}" ${Number(r.cadMeters ?? 0)} m (${r.approvalStatus})`;

    if (exact.length === 1) {
      const target = exact[0].row;
      if (withImage.has(target.id)) {
        lines.push({ ...base, outcome: 'ROW_HAS_IMAGE', row: label(target) });
        continue;
      }
      if (APPLY) {
        const linked = await prisma.cad_purpose_files.update({ where: { id: file.id }, data: { cadId: target.id, replacedAt: null } });
        await recordMarkerImage(target.id, null, linked);
      }
      lines.push({ ...base, outcome: APPLY ? 'LINKED' : 'LINK', row: label(target) });
    } else if (near.length > 0) {
      lines.push({
        ...base,
        outcome: 'NEAR',
        row: label(near[0].row),
        differences: near[0].differences.map((d) => d.label),
      });
    } else {
      lines.push({ ...base, outcome: 'NONE' });
    }
  }

  const counts = lines.reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.outcome]: (acc[l.outcome] ?? 0) + 1 }), {});
  console.table(lines.map((l) => ({ ...l, differences: l.differences?.join('; ') ?? '' })));
  console.log(counts);
  fs.writeFileSync(REPORT, JSON.stringify({ at: new Date().toISOString(), apply: APPLY, counts, lines }, null, 2));
  console.log(`Report: ${REPORT}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
