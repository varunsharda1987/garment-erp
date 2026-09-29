/**
 * The CAD marker rule's comparisons (services/helpers/cad-marker.helper.ts). The save / approve gates and
 * the endpoints are walked in integration/cad-marker-image.test.ts.
 */
import type { cad_purpose_files } from '@prisma/client';
import {
  describesMarker,
  markerDifferences,
  markerRequired,
  readingColumns,
  storedReading,
  summarizeMarker,
  type MarkerValues,
  type StoredReading,
} from '../../services/helpers/cad-marker.helper';
import type { MarkerReading } from '../../services/marker-reader.service';

const S_TO_XXL = ['S', 'M', 'L', 'XL', 'XXL'].map((sizeName) => ({ sizeName, quantity: 1 }));

/** IP00138's marker as the reader reads it */
const ip00138: StoredReading = {
  status: 'READ',
  lengthM: 8.29,
  widthIn: 52,
  efficiencyPct: 89.05,
  placed: 135,
  total: 135,
  sizes: S_TO_XXL,
  sizesFrom: 'title',
  pieces: 5,
  title: 'Nest EXPERT - IP00138 PANT - S-M-L-XL-XXL*',
  error: null,
  readAt: new Date(),
};

const matching: MarkerValues = { layerLengthM: 8.29, widthIn: 52, sizes: S_TO_XXL };

describe('markerRequired', () => {
  it('is Raw Mat and Production only', () => {
    expect(markerRequired('RAW_MATERIAL_CALCULATION')).toBe(true);
    expect(markerRequired('PRODUCTION')).toBe(true);
    expect(markerRequired('COSTING')).toBe(false);
    expect(markerRequired(null)).toBe(false);
  });
});

describe('markerDifferences', () => {
  it('finds nothing when the row is what the image says', () => {
    expect(markerDifferences(matching, ip00138)).toEqual([]);
  });

  it('reads a length within 0.005 m as the same (storage dust), 0.01 m as different', () => {
    expect(markerDifferences({ ...matching, layerLengthM: 8.2904 }, ip00138)).toEqual([]);
    const [d] = markerDifferences({ ...matching, layerLengthM: 8.3 }, ip00138);
    expect(d).toMatchObject({ field: 'length', image: '8.29 m', row: '8.3 m' });
    expect(d.label).toBe('Layer length: image 8.29 m, row 8.3 m');
  });

  it('compares the width, and a blank one differs', () => {
    expect(markerDifferences({ ...matching, widthIn: 50 }, ip00138)[0]).toMatchObject({ field: 'width', row: '50 in' });
    expect(markerDifferences({ ...matching, widthIn: null }, ip00138)[0].label).toBe('Width: image 52 in, row blank');
  });

  it('compares sizes and quantities, not their order or case', () => {
    const shuffled = [...S_TO_XXL].reverse().map((s) => ({ ...s, sizeName: s.sizeName.toLowerCase() }));
    expect(markerDifferences({ ...matching, sizes: shuffled }, ip00138)).toEqual([]);

    const roxie: StoredReading = { ...ip00138, sizes: [{ sizeName: 'L', quantity: 2 }], pieces: 2 };
    const oneL = markerDifferences({ ...matching, sizes: [{ sizeName: 'L', quantity: 1 }] }, roxie);
    expect(oneL[0]).toMatchObject({ field: 'sizes', image: 'L ×2', row: 'L' });
  });

  it('says when the marker has a size the style does not offer (IP00138: XS–XL style, S–XXL marker)', () => {
    const xsToXl = ['XS', 'S', 'M', 'L', 'XL'].map((sizeName) => ({ sizeName, quantity: 1 }));
    const [d] = markerDifferences({ ...matching, sizes: xsToXl }, ip00138, ['XS', 'S', 'M', 'L', 'XL']);
    expect(d.field).toBe('sizes');
    expect(d.label).toContain('the marker has XXL — this style has no XXL size');
  });

  it('flags a marker with pieces left unplaced', () => {
    const partial: StoredReading = { ...ip00138, placed: 4, total: 60 };
    expect(markerDifferences(matching, partial)).toEqual([
      expect.objectContaining({ field: 'placed', label: "Only 4 of the marker's 60 pieces are placed" }),
    ]);
  });

  it('treats an image it could not read, or never read, as one "not checked" difference', () => {
    for (const status of ['UNREADABLE', 'READER_UNAVAILABLE', null] as const) {
      const diffs = markerDifferences(matching, { ...ip00138, status });
      expect(diffs).toHaveLength(1);
      expect(diffs[0].field).toBe('image');
      expect(diffs[0].label).toMatch(/not checked/);
    }
  });

  it('marks what a partial reading could not check', () => {
    const noSizes: StoredReading = { ...ip00138, status: 'PARTIAL', sizes: [], pieces: null };
    expect(markerDifferences(matching, noSizes)).toEqual([
      expect.objectContaining({ field: 'sizes', label: expect.stringMatching(/could not be read/) }),
    ]);
  });
});

describe('summarizeMarker', () => {
  const file = {
    id: 'f1',
    fileUrl: '/uploads/cad-files/x.png',
    fileName: 'x.png',
    createdAt: new Date(),
    readStatus: 'READ',
    readLengthM: 8.29,
    readWidthIn: 52,
    readEfficiencyPct: 89.05,
    readPlaced: 135,
    readTotal: 135,
    readSizes: S_TO_XXL,
    readTitle: null,
    readError: null,
    readAt: new Date(),
  } as unknown as cad_purpose_files;
  const row = (values: MarkerValues, reason: string | null = null, covered: unknown = null) => ({
    purpose: 'RAW_MATERIAL_CALCULATION',
    values,
    markerOverrideReason: reason,
    markerOverrideDifferences: covered === null ? null : JSON.stringify(covered),
  });

  it('NEEDS_IMAGE for a Raw Mat row with values and no image; NONE before it has any', () => {
    expect(summarizeMarker(row(matching), null).state).toBe('NEEDS_IMAGE');
    expect(summarizeMarker(row({ layerLengthM: null, widthIn: 52, sizes: [] }), null).state).toBe('NONE');
    expect(summarizeMarker({ ...row(matching), purpose: 'COSTING' }, null).state).toBe('NONE');
  });

  it('MATCHES, DIFFERS, and EXPLAINED only while the reason covers exactly these differences', () => {
    expect(summarizeMarker(row(matching), file).state).toBe('MATCHES');

    const typed = { ...matching, layerLengthM: 8.3 };
    const differs = summarizeMarker(row(typed), file);
    expect(differs.state).toBe('DIFFERS');

    expect(summarizeMarker(row(typed, 'rounded by the CAD room', differs.differences), file).state).toBe('EXPLAINED');
    // the same reason no longer covers a different difference
    expect(summarizeMarker(row({ ...matching, layerLengthM: 8.4 }, 'rounded', differs.differences), file).state).toBe(
      'DIFFERS'
    );
  });
});

describe('describesMarker — is the row a marker yet?', () => {
  it("a layer length or any size makes it one; a width alone (a new row's default) does not", () => {
    expect(describesMarker({ layerLengthM: null, sizes: [] })).toBe(false);
    expect(describesMarker({ layerLengthM: 0, sizes: [{ sizeName: 'S', quantity: 0 }] })).toBe(false);
    expect(describesMarker({ layerLengthM: 11.05, sizes: [] })).toBe(true);
    expect(describesMarker({ layerLengthM: null, sizes: [{ sizeName: 'S', quantity: 1 }] })).toBe(true);
  });
});

// LNG129 (29-Sep): a new Raw Mat row showed a red "Differs" ("Layer length: image 11.05 m, row blank") the moment
// its image was attached — nothing on the row differed, it was simply empty
describe('summarizeMarker — a row with its image but no values yet is UNUSED', () => {
  const lng129 = {
    id: 'f2',
    fileUrl: '/uploads/cad-files/lng129.png',
    fileName: 'LNG129.png',
    createdAt: new Date(),
    readStatus: 'READ',
    readLengthM: 11.05,
    readWidthIn: 52,
    readEfficiencyPct: 90.18,
    readPlaced: 60,
    readTotal: 60,
    readSizes: S_TO_XXL.map((s) => ({ ...s, from: 'pieces' })),
    readTitle: null,
    readError: null,
    readAt: new Date(),
  } as unknown as cad_purpose_files;
  const row = (values: MarkerValues, purpose = 'RAW_MATERIAL_CALCULATION', reason: string | null = null) => ({
    purpose,
    values,
    markerOverrideReason: reason,
    markerOverrideDifferences: reason ? JSON.stringify([{ field: 'sizes', image: null, row: null }]) : null,
  });
  const blank: MarkerValues = { layerLengthM: null, widthIn: null, sizes: [] };

  it('a blank row, or one with only a width, is UNUSED with nothing listed — the image average still shows', () => {
    for (const values of [blank, { ...blank, widthIn: 52 }]) {
      const summary = summarizeMarker(row(values), lng129);
      expect(summary).toMatchObject({ state: 'UNUSED', differences: [], overrideReason: null });
      expect(summary.file?.id).toBe('f2');
      expect(summary.imageAverage).toBeCloseTo((11.05 + 0.2) / 5, 4);
    }
  });

  it('a Costing row and an unreadable image are UNUSED too while the row is blank', () => {
    expect(summarizeMarker(row(blank, 'COSTING'), lng129).state).toBe('UNUSED');
    const unreadable = { ...lng129, readStatus: 'UNREADABLE', readLengthM: null } as unknown as cad_purpose_files;
    expect(summarizeMarker(row(blank), unreadable)).toMatchObject({ state: 'UNUSED', differences: [] });
  });

  it('a reason left from earlier values does not carry over to a blank row', () => {
    expect(
      summarizeMarker(row(blank, 'RAW_MATERIAL_CALCULATION', 'counted by hand'), lng129).overrideReason
    ).toBeNull();
  });

  it('sizes alone make it a marker: the image length it lacks is a difference', () => {
    const sizesOnly = summarizeMarker(row({ ...blank, sizes: S_TO_XXL }), lng129);
    expect(sizesOnly.state).toBe('DIFFERS');
    expect(sizesOnly.differences.map((d) => d.field)).toEqual(['length', 'width']);
  });

  it('the image values on the row match', () => {
    expect(summarizeMarker(row({ layerLengthM: 11.05, widthIn: 52, sizes: S_TO_XXL }), lng129).state).toBe('MATCHES');
  });
});

describe('where the sizes came from', () => {
  it("sizes read from the piece table are stored with from: 'pieces' and read back as sizesFrom", () => {
    const reading: MarkerReading = {
      status: 'READ',
      lengthM: 11.05,
      widthIn: 52,
      efficiencyPct: 90.18,
      placed: 60,
      total: 60,
      sizes: S_TO_XXL,
      sizesFrom: 'pieces',
      pieces: 5,
      title: null,
      text: null,
      ms: 1,
      readerVersion: 'test',
    };
    const columns = readingColumns(reading);
    expect(columns.readSizes).toEqual(S_TO_XXL.map((s) => ({ ...s, from: 'pieces' })));
    const back = storedReading({
      readStatus: 'READ',
      readLengthM: null,
      readWidthIn: null,
      readEfficiencyPct: null,
      readPlaced: null,
      readTotal: null,
      readSizes: columns.readSizes as never,
      readTitle: null,
      readError: null,
      readAt: null,
    });
    expect(back.sizesFrom).toBe('pieces');
    expect(back.sizes).toEqual(S_TO_XXL);
    expect(readingColumns({ ...reading, sizesFrom: 'title' }).readSizes).toEqual(S_TO_XXL);
  });
});
