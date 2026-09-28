/**
 * A CAD row's marker image for tests that save or approve Raw Mat / Production CAD values
 * (services/helpers/cad-marker.helper.ts). The record carries a READ reading that says exactly what the test
 * is about to save, so the rule passes without running the reader; no file is written to disk.
 *
 * Styles delete their images (ON DELETE CASCADE), so a test that removes its style needs no extra teardown.
 */
import type { CadPurpose, PrismaClient } from '@prisma/client';

export async function giveMarkerImage(
  db: PrismaClient,
  args: {
    cadId: string | null;
    styleId: string;
    purpose?: CadPurpose;
    lengthM: number;
    widthIn: number;
    sizes: Array<{ sizeName: string; quantity: number }>;
  }
) {
  return db.cad_purpose_files.create({
    data: {
      styleId: args.styleId,
      purpose: args.purpose ?? 'RAW_MATERIAL_CALCULATION',
      fileUrl: `/uploads/cad-files/test-marker-${Date.now()}-${Math.round(Math.random() * 1e6)}.png`,
      fileName: 'test marker.png',
      cadId: args.cadId,
      readStatus: 'READ',
      readLengthM: args.lengthM,
      readWidthIn: args.widthIn,
      readEfficiencyPct: 85,
      readPlaced: 10,
      readTotal: 10,
      readSizes: args.sizes,
      readAt: new Date(),
      readerVersion: 'test-fixture',
    },
  });
}
