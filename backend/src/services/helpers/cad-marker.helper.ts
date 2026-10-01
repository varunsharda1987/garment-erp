/**
 * A CAD row's MARKER IMAGE — the one rule (owner decisions 28-Sep-2026,
 * .claude/plans/it00254-top-and-style-logical-minsky.md).
 *
 * A CAD average is (layer length + margin) ÷ pieces, and until now the length and sizes were typed by hand
 * from a Nest EXPERT screenshot. They drifted from their own marker: IT00254 Top 52" was saved at 3.85 m
 * while its image says 3.82 m; IP00138 and IT00254 were saved XS–XL while their markers are S–XXL. So:
 *
 *  - Raw Mat and Production rows need their marker image (cad_purpose_files.cadId, current = replacedAt
 *    null) before their CAD values are saved or approved. Costing rows may have one; when they do it is
 *    checked the same way. A row with no layer length and no sizes is not a marker yet (`describesMarker`):
 *    with an image it is UNUSED ("Not used yet") — nothing to compare, nothing to save a reason for — and it
 *    cannot be approved until its values are filled from the image (LNG129, 29-Sep: a new row showed a red
 *    "Differs" with "row blank" lines the moment its image was attached).
 *  - The image is read (services/marker-reader.service.ts) and a save whose values differ from it — length,
 *    width, sizes, or a marker with pieces left unplaced — is refused unless a reason is given. An image that
 *    could not be read counts as a difference ("not checked"). The reason and the differences it covers are
 *    kept on the row and in its History; a later save that matches clears them.
 *  - No image at all (a marker not made in Nest EXPERT, or none to give): the person's own values are saved with
 *    a reason, the same way (`NO_IMAGE_DIFFERENCE`, 2026-10-01). Until then the row could not be saved at all.
 *  - Size names are compared by `sameSizeKey` (utils/sku-generator): a marker's 3XL is the style's XXXL.
 *  - Approve refuses a row that needs an image or whose differences are not explained.
 *  - A row made from another (Copy to Raw Mat, Create CAD on a lot, Fabric Costing clone / promote) gets the
 *    source's image with it — `copyMarkerImage`.
 *
 * Only "CAD values" trigger the check: layer length, width, size breakdown, pieces. Greige, part, print
 * direction and notes never need the image.
 */

import { Prisma, PrismaClient, cad_purpose_files } from '@prisma/client';
import { BusinessError, ConflictError } from '../../errors';
import { cadAverageFromMarker } from '../../controllers/cad-planning.utils';
import { isQtyZero } from '../../utils/quantity';
import { sameSizeKey } from '../../utils/sku-generator';
import type { MarkerReadStatus, MarkerReading, MarkerSize } from '../marker-reader.service';
import { recordCadEvent } from './cad-history.helper';

type Db = Prisma.TransactionClient | PrismaClient;

export const MARKER_REQUIRED_PURPOSES = ['RAW_MATERIAL_CALCULATION', 'PRODUCTION'] as const;

export function markerRequired(purpose: string | null | undefined): boolean {
  return (MARKER_REQUIRED_PURPOSES as readonly string[]).includes(purpose ?? '');
}

const PURPOSE_LABEL: Record<string, string> = {
  COSTING: 'Costing',
  RAW_MATERIAL_CALCULATION: 'Raw Mat',
  PRODUCTION: 'Production',
};

// ---------------------------------------------------------------------------
// Readings
// ---------------------------------------------------------------------------

/** What was read from an image, as stored on its cad_purpose_files record */
export interface StoredReading {
  /** null = the image has never been read */
  status: MarkerReadStatus | null;
  lengthM: number | null;
  widthIn: number | null;
  efficiencyPct: number | null;
  placed: number | null;
  total: number | null;
  sizes: MarkerSize[];
  /** 'title', or 'pieces' when the screenshot began below the title bar and the piece table gave them */
  sizesFrom: 'title' | 'pieces' | null;
  pieces: number | null;
  title: string | null;
  error: string | null;
  readAt: Date | null;
}

type ReadingColumns = Pick<
  cad_purpose_files,
  | 'readStatus'
  | 'readLengthM'
  | 'readWidthIn'
  | 'readEfficiencyPct'
  | 'readPlaced'
  | 'readTotal'
  | 'readSizes'
  | 'readTitle'
  | 'readError'
  | 'readAt'
>;

const dec = (v: Prisma.Decimal | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

function sizesOf(json: Prisma.JsonValue | null | undefined): MarkerSize[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter(
      (s): s is { sizeName: string; quantity: number } =>
        !!s &&
        typeof s === 'object' &&
        typeof (s as Record<string, unknown>).sizeName === 'string' &&
        Number.isInteger((s as Record<string, unknown>).quantity)
    )
    .map((s) => ({ sizeName: s.sizeName.toUpperCase(), quantity: s.quantity }));
}

/** Sizes read from the piece table are stored with `from: 'pieces'` on each entry (no column of their own) */
function sizesFromOf(json: Prisma.JsonValue | null | undefined, sizes: MarkerSize[]): StoredReading['sizesFrom'] {
  if (sizes.length === 0) return null;
  const fromPieces =
    Array.isArray(json) &&
    json.some((s) => !!s && typeof s === 'object' && (s as Record<string, unknown>).from === 'pieces');
  return fromPieces ? 'pieces' : 'title';
}

export function storedReading(file: ReadingColumns): StoredReading {
  const sizes = sizesOf(file.readSizes);
  return {
    status: (file.readStatus as MarkerReadStatus | null) ?? null,
    lengthM: dec(file.readLengthM),
    widthIn: dec(file.readWidthIn),
    efficiencyPct: dec(file.readEfficiencyPct),
    placed: file.readPlaced ?? null,
    total: file.readTotal ?? null,
    sizes,
    sizesFrom: sizesFromOf(file.readSizes, sizes),
    pieces: sizes.length > 0 ? sizes.reduce((sum, s) => sum + s.quantity, 0) : null,
    title: file.readTitle ?? null,
    error: file.readError ?? null,
    readAt: file.readAt ?? null,
  };
}

/** The cad_purpose_files columns a fresh reading is stored in */
export function readingColumns(reading: MarkerReading): Prisma.cad_purpose_filesUpdateInput {
  return {
    readStatus: reading.status,
    readLengthM: reading.lengthM,
    readWidthIn: reading.widthIn,
    readEfficiencyPct: reading.efficiencyPct,
    readPlaced: reading.placed,
    readTotal: reading.total,
    readSizes:
      reading.sizes.length > 0
        ? ((reading.sizesFrom === 'pieces'
            ? reading.sizes.map((s) => ({ ...s, from: 'pieces' }))
            : reading.sizes) as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
    readTitle: reading.title,
    readText: reading.text,
    readError: reading.error ?? null,
    readAt: new Date(),
    readerVersion: reading.readerVersion,
  };
}

// ---------------------------------------------------------------------------
// Differences
// ---------------------------------------------------------------------------

/** A CAD row's marker values — what gets compared with its image */
export interface MarkerValues {
  layerLengthM: number | null;
  widthIn: number | null;
  sizes: MarkerSize[];
}

export type MarkerDifferenceField = 'image' | 'length' | 'width' | 'sizes' | 'placed';

export interface MarkerDifference {
  field: MarkerDifferenceField;
  /** One line a person reads: "Layer length: image 3.82 m, row 3.85 m" */
  label: string;
  image: string | null;
  row: string | null;
}

const fmt = (n: number | null, unit: string): string | null =>
  n === null ? null : `${Number(n.toFixed(3))}${unit ? ` ${unit}` : ''}`;

/** "S, M, L ×2, XL" in the marker's own order */
function sizesText(sizes: MarkerSize[]): string | null {
  if (sizes.length === 0) return null;
  return sizes.map((s) => (s.quantity > 1 ? `${s.sizeName} ×${s.quantity}` : s.sizeName)).join(', ');
}

/** Garments per size, keyed by `sameSizeKey` — the marker's 3XL is the style's XXXL, its 2XL the style's XXL */
function sizeCounts(sizes: MarkerSize[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of sizes) {
    const name = sameSizeKey(s.sizeName);
    if (s.quantity > 0) counts.set(name, (counts.get(name) ?? 0) + s.quantity);
  }
  return counts;
}

/**
 * How a row's values differ from what its image says. Empty = they match. `styleSizes` (the style's size
 * names) adds a note when the marker has a size the style does not offer — the pre-fill never adds one.
 */
export function markerDifferences(
  values: MarkerValues,
  reading: StoredReading,
  styleSizes?: string[]
): MarkerDifference[] {
  if (reading.status === null || reading.status === 'UNREADABLE' || reading.status === 'READER_UNAVAILABLE') {
    const why =
      reading.status === null
        ? 'The image has not been read yet'
        : reading.status === 'READER_UNAVAILABLE'
          ? 'The marker reader could not run'
          : 'The image could not be read — it does not look like a Nest EXPERT marker';
    return [{ field: 'image', label: `${why}, so the values are not checked`, image: null, row: null }];
  }

  const out: MarkerDifference[] = [];

  if (reading.lengthM !== null) {
    const row = values.layerLengthM;
    if (row === null || !isQtyZero(row - reading.lengthM)) {
      out.push({
        field: 'length',
        label: `Layer length: image ${fmt(reading.lengthM, 'm')}, row ${fmt(row, 'm') ?? 'blank'}`,
        image: fmt(reading.lengthM, 'm'),
        row: fmt(row, 'm'),
      });
    }
  }

  if (reading.widthIn === null) {
    out.push({
      field: 'width',
      label: 'The width could not be read from the image — not checked',
      image: null,
      row: null,
    });
  } else {
    const row = values.widthIn;
    if (row === null || !isQtyZero(row - reading.widthIn)) {
      out.push({
        field: 'width',
        label: `Width: image ${fmt(reading.widthIn, 'in')}, row ${fmt(row, 'in') ?? 'blank'}`,
        image: fmt(reading.widthIn, 'in'),
        row: fmt(row, 'in'),
      });
    }
  }

  if (reading.sizes.length === 0) {
    out.push({
      field: 'sizes',
      label: 'The sizes could not be read from the image — not checked',
      image: null,
      row: null,
    });
  } else {
    const image = sizeCounts(reading.sizes);
    const row = sizeCounts(values.sizes);
    const names = new Set([...image.keys(), ...row.keys()]);
    const same = [...names].every((n) => (image.get(n) ?? 0) === (row.get(n) ?? 0));
    if (!same) {
      const offered = styleSizes ? new Set(styleSizes.map(sameSizeKey)) : null;
      const missing = offered
        ? reading.sizes.filter((s) => !offered.has(sameSizeKey(s.sizeName))).map((s) => s.sizeName)
        : [];
      const note =
        missing.length > 0
          ? ` (the marker has ${missing.join(', ')} — this style has no ${missing.length > 1 ? 'such sizes' : `${missing[0]} size`})`
          : '';
      out.push({
        field: 'sizes',
        label: `Sizes: image ${sizesText(reading.sizes)}, row ${sizesText(values.sizes) ?? 'none'}${note}`,
        image: sizesText(reading.sizes),
        row: sizesText(values.sizes),
      });
    }
  }

  if (reading.placed !== null && reading.total !== null && reading.placed < reading.total) {
    out.push({
      field: 'placed',
      label: `Only ${reading.placed} of the marker's ${reading.total} pieces are placed`,
      image: `${reading.placed}/${reading.total}`,
      row: null,
    });
  }

  return out;
}

/**
 * The one "difference" of a Raw Mat / Production row saved with NO marker image: some markers are not made in
 * Nest EXPERT (a hand lay, a marker from another CAD, a sample cut) and there is no screenshot to give. The row
 * may then be saved — and approved — on the person's own values with a reason, kept on the row and in its
 * History like any other override (owner, 2026-10-01). Attaching an image later checks the values against it.
 */
export const NO_IMAGE_DIFFERENCE: MarkerDifference = {
  field: 'image',
  label: 'No marker image — the values are not checked against one',
  image: null,
  row: null,
};

/**
 * Is the row a marker yet? It is once it has a layer length or any size — a width alone is not (a new row gets a
 * default width). Before that there is nothing to compare with an image, nothing to save a reason for, and
 * nothing to approve.
 */
export function describesMarker(values: Pick<MarkerValues, 'layerLengthM' | 'sizes'>): boolean {
  return (values.layerLengthM !== null && values.layerLengthM > 0) || values.sizes.some((s) => s.quantity > 0);
}

const differenceKey = (d: Pick<MarkerDifference, 'field' | 'image' | 'row'>) => `${d.field}|${d.image}|${d.row}`;

/** Does a stored reason still cover exactly these differences? (A new image or new values need a new one.) */
function reasonCovers(storedText: string | null | undefined, differences: MarkerDifference[]): boolean {
  if (!storedText || differences.length === 0) return false;
  let stored: unknown;
  try {
    stored = JSON.parse(storedText);
  } catch {
    return false;
  }
  if (!Array.isArray(stored)) return false;
  const storedKeys = new Set(
    stored
      .filter((d) => !!d && typeof d === 'object' && !Array.isArray(d))
      .map((d) => {
        const rec = d as Record<string, unknown>;
        return differenceKey({
          field: rec.field as MarkerDifferenceField,
          image: (rec.image as string | null) ?? null,
          row: (rec.row as string | null) ?? null,
        });
      })
  );
  return storedKeys.size === differences.length && differences.every((d) => storedKeys.has(differenceKey(d)));
}

// ---------------------------------------------------------------------------
// A row's marker state (table chip, approve gate)
// ---------------------------------------------------------------------------

/**
 * NONE        no image, and none needed (Costing, or a row that is not a marker yet)
 * NEEDS_IMAGE a Raw Mat / Production row with CAD values, no image and no reason (saved by hand with a reason
 *             it is EXPLAINED)
 * UNUSED      an image, but the row is not a marker yet (no length, no sizes): "Use these values" fills it;
 *             approve is refused until it is filled and saved
 * MATCHES     the values are what the image says
 * EXPLAINED   they differ (or the image could not be read) and a reason covers exactly that
 * DIFFERS     they differ and nothing explains it — approve is refused
 */
export type MarkerState = 'NONE' | 'NEEDS_IMAGE' | 'UNUSED' | 'MATCHES' | 'EXPLAINED' | 'DIFFERS';

export interface MarkerSummary {
  state: MarkerState;
  required: boolean;
  file: { id: string; fileUrl: string; fileName: string | null; uploadedAt: Date } | null;
  reading: StoredReading | null;
  differences: MarkerDifference[];
  overrideReason: string | null;
  /** What the image implies, by the same formula as the row: the margin the length rule adds, and
   *  (image length + that margin) ÷ image pieces — so a person compares "image 0.774 m/pc, row 0.780" */
  imageMarginM: number | null;
  imageAverage: number | null;
}

/** The margin and average an image's length and sizes give (cadAverageFromMarker — the row's own formula) */
function imageAverageOf(reading: StoredReading | null): { imageMarginM: number | null; imageAverage: number | null } {
  if (!reading || reading.lengthM === null || reading.sizes.length === 0)
    return { imageMarginM: null, imageAverage: null };
  const { layerMarginMeters, cadAverage } = cadAverageFromMarker(reading.lengthM, reading.sizes);
  return {
    imageMarginM: layerMarginMeters,
    imageAverage: cadAverage === null ? null : Math.round(cadAverage * 10000) / 10000,
  };
}

export interface MarkerRowInput {
  purpose: string | null;
  values: MarkerValues;
  markerOverrideReason: string | null;
  /** JSON text of the MarkerDifference[] the reason was given for */
  markerOverrideDifferences: string | null;
}

export function summarizeMarker(
  row: MarkerRowInput,
  file: cad_purpose_files | null,
  styleSizes?: string[]
): MarkerSummary {
  const required = markerRequired(row.purpose);
  const isMarker = describesMarker(row.values);
  if (!file) {
    const needsImage = required && isMarker;
    // Saved by hand with a reason: explained, approvable; otherwise it still needs its image (or a reason)
    const explained =
      needsImage && !!row.markerOverrideReason && reasonCovers(row.markerOverrideDifferences, [NO_IMAGE_DIFFERENCE]);
    return {
      state: explained ? 'EXPLAINED' : needsImage ? 'NEEDS_IMAGE' : 'NONE',
      required,
      file: null,
      reading: null,
      differences: needsImage ? [NO_IMAGE_DIFFERENCE] : [],
      overrideReason: explained ? row.markerOverrideReason : null,
      imageMarginM: null,
      imageAverage: null,
    };
  }
  const reading = storedReading(file);
  const fileSummary = { id: file.id, fileUrl: file.fileUrl, fileName: file.fileName, uploadedAt: file.createdAt };
  if (!isMarker) {
    // Nothing on the row yet to compare: its image waits to be used
    return {
      state: 'UNUSED',
      required,
      file: fileSummary,
      reading,
      differences: [],
      overrideReason: null,
      ...imageAverageOf(reading),
    };
  }
  const differences = markerDifferences(row.values, reading, styleSizes);
  const explained = !!row.markerOverrideReason && reasonCovers(row.markerOverrideDifferences, differences);
  return {
    state: differences.length === 0 ? 'MATCHES' : explained ? 'EXPLAINED' : 'DIFFERS',
    required,
    file: fileSummary,
    reading,
    differences,
    overrideReason: explained ? row.markerOverrideReason : null,
    ...imageAverageOf(reading),
  };
}

/**
 * How one image differs from one row's stored values — what decides whether an APPROVED row may take it
 * (it keeps its values, so only an image that says exactly what it holds is linked; cad-file.service)
 */
export async function rowDifferencesFromImage(
  db: Db,
  cadId: string,
  file: ReadingColumns
): Promise<MarkerDifference[]> {
  const row = await loadRow(db, cadId);
  if (!row) return [];
  return markerDifferences(rowMarkerValues(row), storedReading(file), await styleSizeNames(db, rowStyleId(row)));
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export function currentMarkerFile(db: Db, cadId: string): Promise<cad_purpose_files | null> {
  return db.cad_purpose_files.findFirst({ where: { cadId, replacedAt: null } });
}

/** Current marker images of many rows, one query */
export async function currentMarkerFiles(db: Db, cadIds: string[]): Promise<Map<string, cad_purpose_files>> {
  if (cadIds.length === 0) return new Map();
  const files = await db.cad_purpose_files.findMany({ where: { cadId: { in: cadIds }, replacedAt: null } });
  return new Map(files.filter((f) => f.cadId).map((f) => [f.cadId as string, f]));
}

/** The size names a style offers (active size options), upper-case; undefined when it has none set up */
export async function styleSizeNames(db: Db, styleId: string | null | undefined): Promise<string[] | undefined> {
  if (!styleId) return undefined;
  const sizes = await db.size_options.findMany({ where: { styleId, isActive: true }, select: { sizeName: true } });
  return sizes.length > 0 ? sizes.map((s) => s.sizeName.trim().toUpperCase()) : undefined;
}

const ROW_SELECT = {
  id: true,
  purpose: true,
  purposeEnum: true,
  cadMeters: true,
  cutableWidth: true,
  costingStyleId: true,
  markerOverrideReason: true,
  markerOverrideDifferences: true,
  sizeBreakdowns: { select: { sizeName: true, quantity: true } },
  styleFabric: { select: { style_components: { select: { styleId: true } } } },
} satisfies Prisma.fabric_width_cadSelect;

type LoadedRow = Prisma.fabric_width_cadGetPayload<{ select: typeof ROW_SELECT }>;

async function loadRow(db: Db, cadId: string): Promise<LoadedRow | null> {
  return db.fabric_width_cad.findUnique({ where: { id: cadId }, select: ROW_SELECT });
}

const rowPurpose = (row: Pick<LoadedRow, 'purpose' | 'purposeEnum'>) => row.purposeEnum ?? row.purpose ?? null;
const rowStyleId = (row: LoadedRow) => row.styleFabric?.style_components?.styleId ?? row.costingStyleId ?? null;

/** A row's stored CAD values as the rule compares them (a width of 0 is "not set yet") */
export function rowMarkerValues(row: {
  cadMeters: Prisma.Decimal | number | null;
  cutableWidth: Prisma.Decimal | number | null;
  sizeBreakdowns: Array<{ sizeName: string; quantity: number }>;
}): MarkerValues {
  const width = dec(row.cutableWidth);
  return {
    layerLengthM: dec(row.cadMeters),
    widthIn: width && width > 0 ? width : null,
    sizes: row.sizeBreakdowns.map((s) => ({ sizeName: s.sizeName, quantity: s.quantity })),
  };
}

export async function markerSummaryForRow(db: Db, cadId: string): Promise<MarkerSummary | null> {
  const row = await loadRow(db, cadId);
  if (!row) return null;
  const [file, styleSizes] = await Promise.all([currentMarkerFile(db, cadId), styleSizeNames(db, rowStyleId(row))]);
  return summarizeMarker(
    {
      purpose: rowPurpose(row),
      values: rowMarkerValues(row),
      markerOverrideReason: row.markerOverrideReason,
      markerOverrideDifferences: row.markerOverrideDifferences,
    },
    file,
    styleSizes
  );
}

/**
 * Every CAD row of a style with its marker state, for the CAD table's CAD image column. Rows reach a style
 * by their slot (styleFabric → component) or, for costing rows, costingStyleId.
 */
export async function markerSummariesForStyle(
  db: Db,
  styleId: string
): Promise<Array<MarkerSummary & { cadId: string }>> {
  const rows = await db.fabric_width_cad.findMany({
    where: { OR: [{ costingStyleId: styleId }, { styleFabric: { style_components: { styleId } } }] },
    select: ROW_SELECT,
  });
  const [files, styleSizes] = await Promise.all([
    currentMarkerFiles(
      db,
      rows.map((r) => r.id)
    ),
    styleSizeNames(db, styleId),
  ]);
  return rows.map((row) => ({
    cadId: row.id,
    ...summarizeMarker(
      {
        purpose: rowPurpose(row),
        values: rowMarkerValues(row),
        markerOverrideReason: row.markerOverrideReason,
        markerOverrideDifferences: row.markerOverrideDifferences,
      },
      files.get(row.id) ?? null,
      styleSizes
    ),
  }));
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

export interface MarkerSaveResult {
  /** Merge into the row's update: efficiency from the image + the override columns */
  patch: Prisma.fabric_width_cadUpdateInput;
  /** Set when the save went ahead on a reason — record it with `recordMarkerOverride` after the write */
  override: { reason: string; differences: MarkerDifference[] } | null;
}

/**
 * The check a CAD-value save runs BEFORE writing. `after` holds the values the save sends (the rest are
 * read from the row); `triggered` is false when the save touches no CAD value (then nothing is checked).
 * Throws 422 CAD_MARKER_IMAGE_REQUIRED or 409 CAD_MARKER_MISMATCH (details.differences).
 */
export async function checkMarkerOnSave(
  db: Db,
  args: {
    cadId: string;
    after: Partial<MarkerValues>;
    /** the purpose the row will have after the save, when the save changes it */
    purpose?: string | null;
    triggered: boolean;
    overrideReason?: string | null;
    userId?: string | null;
  }
): Promise<MarkerSaveResult> {
  const none: MarkerSaveResult = { patch: {}, override: null };
  if (!args.triggered) return none;
  const row = await loadRow(db, args.cadId);
  if (!row) return none;

  const stored = rowMarkerValues(row);
  const values: MarkerValues = {
    layerLengthM: args.after.layerLengthM !== undefined ? args.after.layerLengthM : stored.layerLengthM,
    widthIn:
      args.after.widthIn !== undefined
        ? args.after.widthIn && args.after.widthIn > 0
          ? args.after.widthIn
          : null
        : stored.widthIn,
    sizes: args.after.sizes !== undefined ? args.after.sizes : stored.sizes,
  };
  const purpose = args.purpose !== undefined ? args.purpose : rowPurpose(row);
  const isMarker = describesMarker(values);
  const [file, styleSizes] = await Promise.all([currentMarkerFile(db, row.id), styleSizeNames(db, rowStyleId(row))]);

  const reason = args.overrideReason?.trim() ?? '';
  if (!file) {
    if (markerRequired(purpose) && isMarker) {
      // No image to give (or none yet): the person's own values are saved only with a reason
      if (reason.length < 3) {
        throw new BusinessError(
          `This ${PURPOSE_LABEL[purpose ?? ''] ?? ''} CAD has no marker image. Attach the Nest EXPERT screenshot ` +
            "(or PDF) in the row's CAD image and its values fill in — or, if there is no marker image to give, say " +
            'where these values come from and save them by hand.',
          { code: 'CAD_MARKER_IMAGE_REQUIRED', cadId: row.id, differences: [NO_IMAGE_DIFFERENCE] }
        );
      }
      return {
        patch: {
          markerOverrideReason: reason,
          markerOverrideById: args.userId ?? null,
          markerOverrideAt: new Date(),
          markerOverrideDifferences: JSON.stringify([NO_IMAGE_DIFFERENCE]),
        },
        override: { reason, differences: [NO_IMAGE_DIFFERENCE] },
      };
    }
    // Not required (Costing) or not a marker yet: nothing to check, and no reason left over
    return {
      patch: {
        markerOverrideReason: null,
        markerOverrideById: null,
        markerOverrideAt: null,
        markerOverrideDifferences: null,
      },
      override: null,
    };
  }

  // Still not a marker after this save (e.g. a new row's greige, notes or default width): its image has nothing
  // to check yet, so no reason is asked for, and a reason left from earlier values no longer applies
  if (!isMarker) {
    return {
      patch: {
        markerOverrideReason: null,
        markerOverrideById: null,
        markerOverrideAt: null,
        markerOverrideDifferences: null,
      },
      override: null,
    };
  }

  const reading = storedReading(file);
  const differences = markerDifferences(values, reading, styleSizes);
  if (differences.length > 0 && reason.length < 3) {
    throw new ConflictError(
      `These values differ from the row's CAD image: ${differences.map((d) => d.label).join('; ')}. ` +
        'Correct them, or give a reason to save them anyway.',
      { code: 'CAD_MARKER_MISMATCH', cadId: row.id, differences }
    );
  }

  const patch: Prisma.fabric_width_cadUpdateInput =
    differences.length > 0
      ? {
          markerOverrideReason: reason,
          markerOverrideById: args.userId ?? null,
          markerOverrideAt: new Date(),
          markerOverrideDifferences: JSON.stringify(differences),
        }
      : {
          markerOverrideReason: null,
          markerOverrideById: null,
          markerOverrideAt: null,
          markerOverrideDifferences: null,
        };
  if (reading.efficiencyPct !== null) patch.markerEfficiency = reading.efficiencyPct;
  return { patch, override: differences.length > 0 ? { reason, differences } : null };
}

/** History line for a save that went ahead on a reason */
export async function recordMarkerOverride(
  cadId: string,
  userId: string | null | undefined,
  override: MarkerSaveResult['override']
): Promise<void> {
  if (!override) return;
  await recordCadEvent({
    cadId,
    userId,
    action: 'MARKER_OVERRIDE',
    newValues: { markerDifferences: override.differences.map((d) => d.label).join('; ') },
    reason: override.reason,
  });
}

/** "Length 8.29 m · Width 52 in · S, M, L, XL, XXL · Eff 89.05 %" — or why nothing was read */
export function readingText(reading: StoredReading): string {
  if (reading.status === null) return 'not read yet';
  if (reading.status === 'READER_UNAVAILABLE') return `not read — ${reading.error ?? 'the reader could not run'}`;
  if (reading.status === 'UNREADABLE') return 'no marker found in the image';
  return [
    reading.lengthM !== null ? `Length ${fmt(reading.lengthM, 'm')}` : null,
    reading.widthIn !== null ? `Width ${fmt(reading.widthIn, 'in')}` : null,
    sizesText(reading.sizes),
    reading.efficiencyPct !== null ? `Eff ${reading.efficiencyPct} %` : null,
    reading.placed !== null && reading.total !== null ? `Placed ${reading.placed}/${reading.total}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** History line for an image becoming the row's marker */
export async function recordMarkerImage(
  cadId: string,
  userId: string | null | undefined,
  file: Pick<cad_purpose_files, 'fileName'> & ReadingColumns
): Promise<void> {
  await recordCadEvent({
    cadId,
    userId,
    action: 'MARKER_IMAGE',
    newValues: { markerImage: file.fileName ?? 'image', markerRead: readingText(storedReading(file)) },
  });
}

// ---------------------------------------------------------------------------
// Approve
// ---------------------------------------------------------------------------

/**
 * Every approver calls this first: a row that needs an image, or whose values differ from it with no reason,
 * cannot be approved. Several rows (Approve CAD plan) are refused together, each named.
 */
export async function checkMarkerOnApprove(db: Db, cadIds: string[]): Promise<void> {
  const refusals: Array<{ cadId: string; summary: MarkerSummary; label: string }> = [];
  for (const cadId of [...new Set(cadIds)]) {
    const row = await loadRow(db, cadId);
    if (!row) continue;
    const summary = await markerSummaryForRow(db, cadId);
    if (!summary || (summary.state !== 'NEEDS_IMAGE' && summary.state !== 'DIFFERS' && summary.state !== 'UNUSED'))
      continue;
    const width = dec(row.cutableWidth);
    refusals.push({
      cadId,
      summary,
      label: `${PURPOSE_LABEL[rowPurpose(row) ?? ''] ?? 'CAD'}${width ? ` ${width}"` : ''}`,
    });
  }
  if (refusals.length === 0) return;

  if (refusals.length === 1) {
    const { cadId, summary, label } = refusals[0];
    if (summary.state === 'NEEDS_IMAGE') {
      throw new BusinessError(
        `This ${label} CAD has no marker image. Attach it (CAD image column) — its values are checked against it — ` +
          'or, if there is none to give, edit the row and save its values with a reason. Then approve.',
        { code: 'CAD_MARKER_IMAGE_REQUIRED', cadId }
      );
    }
    if (summary.state === 'UNUSED') {
      throw new BusinessError(
        `This ${label} CAD has its marker image but no values yet. Open its CAD image, click Use these values, ` +
          'save the row, then approve.',
        { code: 'CAD_MARKER_NOT_USED', cadId }
      );
    }
    throw new ConflictError(
      `This ${label} CAD's values differ from its marker image: ${summary.differences.map((d) => d.label).join('; ')}. ` +
        'Correct them, or save them with a reason, then approve.',
      { code: 'CAD_MARKER_MISMATCH', cadId, differences: summary.differences }
    );
  }

  const lines = refusals.map(
    (r) =>
      `${r.label} — ${
        r.summary.state === 'NEEDS_IMAGE'
          ? 'no marker image'
          : r.summary.state === 'UNUSED'
            ? 'its marker image is not used yet (no values)'
            : 'differs from its marker image'
      }`
  );
  throw new BusinessError(
    `${refusals.length} CAD rows cannot be approved yet: ${lines.join('; ')}. Attach each row's marker image, and ` +
      'correct its values or save them with a reason.',
    { code: 'CAD_MARKER_IMAGE_REQUIRED', cadIds: refusals.map((r) => r.cadId) }
  );
}

// ---------------------------------------------------------------------------
// Copies
// ---------------------------------------------------------------------------

/**
 * A row made from another carries the source's marker image: a record of its own (so each row has exactly
 * one current image) pointing at the SAME file, with the same reading. The file on disk is removed only when
 * no record uses it any more (cad-file.service delete).
 *
 * `targetStyleId` is for a row copied into ANOTHER style (Create Colourway): the record then sits in that
 * style's CAD files, not the source's. Omitted, it stays with the source's style (a copy within one style).
 */
export async function copyMarkerImage(
  tx: Db,
  sourceCadId: string,
  targetCadId: string,
  targetPurpose?: string | null,
  targetStyleId?: string
): Promise<void> {
  const file = await currentMarkerFile(tx, sourceCadId);
  if (!file) return;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, cadId, replacedAt, createdAt, readSizes, ...rest } = file;
  await tx.cad_purpose_files.create({
    data: {
      ...rest,
      ...(targetStyleId ? { styleId: targetStyleId } : {}),
      purpose: (targetPurpose ?? file.purpose) as cad_purpose_files['purpose'],
      readSizes: readSizes === null ? Prisma.DbNull : (readSizes as Prisma.InputJsonValue),
      cadId: targetCadId,
    },
  });
}
