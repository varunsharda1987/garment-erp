/**
 * CAD File Service (Mini Markers)
 * Manages mini marker file attachments per style + purpose
 */
import prisma from '../config/database';
import { BusinessError, ConflictError, NotFoundError } from '../errors';
import { logError, logInfo, logDebug } from '../utils/logger';
import { CadPurpose, Prisma, cad_purpose_files } from '@prisma/client';
import { deleteCadFile } from '../middleware/upload.middleware';
import { markerFilePath, normalizeReading, readMarkerFile, type MarkerReading } from './marker-reader.service';
import {
  currentMarkerFile,
  markerRequired,
  markerSummaryForRow,
  readingColumns,
  reasonCovers,
  recordMarkerImage,
  rowDifferencesFromImage,
  storedReading,
  type MarkerSummary,
} from './helpers/cad-marker.helper';

/** A reading in the shape of a stored record's reading columns — to compare a new reading before keeping it */
function readingAsColumns(
  reading: MarkerReading
): Pick<
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
> {
  const dec = (n: number | null) => (n === null ? null : new Prisma.Decimal(n));
  return {
    readStatus: reading.status,
    readLengthM: dec(reading.lengthM),
    readWidthIn: dec(reading.widthIn),
    readEfficiencyPct: dec(reading.efficiencyPct),
    readPlaced: reading.placed,
    readTotal: reading.total,
    readSizes:
      reading.sizes.length > 0
        ? ((reading.sizesFrom === 'pieces'
            ? reading.sizes.map((s) => ({ ...s, from: 'pieces' }))
            : reading.sizes) as unknown as Prisma.JsonValue)
        : null,
    readTitle: reading.title,
    readError: reading.error ?? null,
    readAt: new Date(),
  };
}

const PURPOSE_LABEL: Record<string, string> = {
  COSTING: 'Costing',
  RAW_MATERIAL_CALCULATION: 'Raw Mat',
  PRODUCTION: 'Production',
};

export interface MarkerImageResult {
  file: cad_purpose_files;
  /** The row's marker state after the image — values read, differences, MATCHES / DIFFERS … */
  summary: MarkerSummary | null;
}

export interface CreateCadFileDTO {
  fileUrl: string;
  fileName?: string | null;
  fileSize?: number | null;
}

/**
 * Flat array shape, NOT keyed by purpose.
 * The global response serializer camelizes every object key, which would turn
 * `RAW_MATERIAL_CALCULATION` into `rAWMATERIALCALCULATION`. Enum values inside
 * records are left alone, so `purpose` is carried per-record and grouped client-side.
 */
export interface MiniMarkersResponse {
  files: object[];
  total: number;
}

class CadFileService {
  /**
   * Create a new mini marker file
   */
  async create(styleId: string, purpose: CadPurpose, data: CreateCadFileDTO, uploadedById?: string): Promise<object> {
    try {
      logDebug('Creating mini marker', { styleId, purpose, data });

      // Verify style exists
      const style = await prisma.styles.findUnique({ where: { id: styleId } });
      if (!style) {
        throw new NotFoundError('Style', styleId);
      }

      // Get max sortOrder for this style+purpose
      const maxSort = await prisma.cad_purpose_files.aggregate({
        where: { styleId, purpose },
        _max: { sortOrder: true },
      });
      const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

      const file = await prisma.cad_purpose_files.create({
        data: {
          styleId,
          purpose,
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileSize: data.fileSize,
          sortOrder,
          uploadedById,
        },
      });

      logInfo('Mini marker created successfully', { id: file.id, styleId, purpose });
      return file;
    } catch (error) {
      logError('Failed to create mini marker', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get all mini markers for a style as a flat list (grouping happens client-side)
   */
  async getAllByStyle(styleId: string): Promise<MiniMarkersResponse> {
    try {
      // Verify style exists
      const style = await prisma.styles.findUnique({ where: { id: styleId } });
      if (!style) {
        throw new NotFoundError('Style', styleId);
      }

      const files = await prisma.cad_purpose_files.findMany({
        where: { styleId },
        orderBy: [{ purpose: 'asc' }, { sortOrder: 'asc' }],
      });

      // Which CAD row each image is the marker of ("Raw Mat · Front · 52″"), for the gallery
      const cadIds = [...new Set(files.map((f) => f.cadId).filter((id): id is string => !!id))];
      const rows = cadIds.length
        ? await prisma.fabric_width_cad.findMany({
            where: { id: { in: cadIds } },
            select: {
              id: true,
              purpose: true,
              purposeEnum: true,
              cutableWidth: true,
              componentName: true,
              patternPart: { select: { name: true } },
              styleFabric: { select: { style_components: { select: { componentName: true } } } },
            },
          })
        : [];
      const rowLabel = new Map(
        rows.map((r) => {
          const purpose = r.purposeEnum ?? r.purpose ?? '';
          const width = Number(r.cutableWidth);
          const parts = [
            PURPOSE_LABEL[purpose] ?? purpose,
            r.styleFabric?.style_components?.componentName ?? r.componentName,
            r.patternPart?.name,
            width > 0 ? `${width}″` : null,
          ].filter(Boolean);
          return [r.id, parts.join(' · ')];
        })
      );
      const withRows = files.map((f) => ({
        ...f,
        cadRow: f.cadId
          ? { id: f.cadId, label: rowLabel.get(f.cadId) ?? 'CAD row', current: f.replacedAt === null }
          : null,
      }));

      return { files: withRows, total: files.length };
    } catch (error) {
      logError('Failed to get mini markers', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get mini markers for a specific purpose
   */
  async getByPurpose(styleId: string, purpose: CadPurpose): Promise<object[]> {
    try {
      // Verify style exists
      const style = await prisma.styles.findUnique({ where: { id: styleId } });
      if (!style) {
        throw new NotFoundError('Style', styleId);
      }

      const files = await prisma.cad_purpose_files.findMany({
        where: { styleId, purpose },
        orderBy: { sortOrder: 'asc' },
      });

      return files;
    } catch (error) {
      logError('Failed to get mini markers by purpose', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get count of mini markers for a style
   */
  async getCount(styleId: string): Promise<number> {
    try {
      const count = await prisma.cad_purpose_files.count({
        where: { styleId },
      });
      return count;
    } catch (error) {
      logError('Failed to get mini marker count', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Delete a mini marker file
   */
  async delete(styleId: string, fileId: string): Promise<void> {
    try {
      logDebug('Deleting mini marker', { styleId, fileId });

      // Verify file exists and belongs to style
      const existing = await prisma.cad_purpose_files.findFirst({
        where: { id: fileId, styleId },
      });
      if (!existing) {
        throw new NotFoundError('Mini Marker', fileId);
      }

      // The marker of an approved row, or of a Raw Mat / Production row with values, is replaced from the
      // row — deleting it would leave the row's values with nothing to check them against
      if (existing.cadId && existing.replacedAt === null) {
        const row = await prisma.fabric_width_cad.findUnique({
          where: { id: existing.cadId },
          select: {
            purpose: true,
            purposeEnum: true,
            cadMeters: true,
            approvalStatus: true, // allow-cad-approval: an approved row's marker is part of what was approved
            _count: { select: { sizeBreakdowns: true } },
          },
        });
        const purpose = row?.purposeEnum ?? row?.purpose ?? null;
        const hasValues = !!row && (row.cadMeters !== null || row._count.sizeBreakdowns > 0);
        if (row && (row.approvalStatus === 'APPROVED' || (markerRequired(purpose) && hasValues))) {
          throw new BusinessError(
            `This image is the marker of a ${PURPOSE_LABEL[purpose ?? ''] ?? ''} CAD row` +
              `${row.approvalStatus === 'APPROVED' ? ' that is approved' : ' with values'}. ` +
              "Replace it from the row's CAD image instead of deleting it."
          );
        }
      }

      // A correction waiting for approval applies this image when it is approved — deleting it would approve the
      // corrected values with no image and a reason given for it
      const waitingCorrections = await prisma.cad_corrections.count({
        where: { markerFileId: fileId, status: 'PENDING_APPROVAL' },
      });
      if (waitingCorrections > 0) {
        throw new BusinessError(
          'This image is the corrected marker of a CAD correction waiting for approval. Approve or reject the ' +
            'correction first.'
        );
      }

      await prisma.cad_purpose_files.delete({
        where: { id: fileId },
      });

      // Copied rows share the file on disk: remove it only when no record uses it any more
      const stillUsed = await prisma.cad_purpose_files.count({ where: { fileUrl: existing.fileUrl } });
      if (existing.fileUrl && stillUsed === 0) {
        deleteCadFile(existing.fileUrl);
      }

      logInfo('Mini marker deleted successfully', { id: fileId });
    } catch (error) {
      logError('Failed to delete mini marker', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // A CAD row's marker image (cad-marker.helper.ts is the rule)
  // -------------------------------------------------------------------------

  /** The CAD row, checked to belong to the style */
  private async rowOfStyle(styleId: string, cadId: string) {
    const row = await prisma.fabric_width_cad.findUnique({
      where: { id: cadId },
      select: {
        id: true,
        purpose: true,
        purposeEnum: true,
        costingStyleId: true,
        styleFabric: { select: { style_components: { select: { styleId: true } } } },
      },
    });
    if (!row) throw new NotFoundError('CAD row', cadId);
    if ((row.styleFabric?.style_components?.styleId ?? row.costingStyleId) !== styleId) {
      throw new BusinessError('This CAD row does not belong to this style');
    }
    return { ...row, purpose: (row.purposeEnum ?? row.purpose ?? 'COSTING') as CadPurpose };
  }

  private async nextSortOrder(tx: Prisma.TransactionClient, styleId: string, purpose: CadPurpose) {
    const maxSort = await tx.cad_purpose_files.aggregate({ where: { styleId, purpose }, _max: { sortOrder: true } });
    return (maxSort._max.sortOrder ?? -1) + 1;
  }

  /** Read an image (nothing stored) */
  private async readImage(file: cad_purpose_files): Promise<MarkerReading> {
    const fullPath = markerFilePath(file.fileUrl);
    return fullPath
      ? readMarkerFile(fullPath)
      : normalizeReading({ status: 'UNREADABLE', error: 'The image file is not in the uploads folder' });
  }

  /** Read an image and keep what was read on its record */
  private async readFile(file: cad_purpose_files): Promise<cad_purpose_files> {
    const reading = await this.readImage(file);
    return prisma.cad_purpose_files.update({ where: { id: file.id }, data: readingColumns(reading) });
  }

  /**
   * The efficiency the row's marker image shows becomes the row's (it was set only by a CAD-value save, so an
   * image that already matched the row — nothing to save — never brought its efficiency)
   */
  private async takeEfficiency(cadId: string, file: Pick<cad_purpose_files, 'readEfficiencyPct'>): Promise<void> {
    if (file.readEfficiencyPct === null) return;
    // an approved (or price-approved) row keeps every CAD value, its efficiency included
    if (await this.isLocked(cadId)) return;
    await prisma.fabric_width_cad.update({ where: { id: cadId }, data: { markerEfficiency: file.readEfficiencyPct } });
  }

  /** A row whose CAD values are approved — or whose price is — keeps its values (validateCADModification's lock) */
  private async isLocked(cadId: string): Promise<boolean> {
    const row = await prisma.fabric_width_cad.findUnique({
      where: { id: cadId },
      // allow-cad-approval: the CAD-side lock, together with the price lock
      select: { approvalStatus: true, costingApprovalStatus: true },
    });
    return (
      row?.approvalStatus === 'APPROVED' ||
      row?.costingApprovalStatus === 'APPROVED' ||
      row?.costingApprovalStatus === 'ALTERNATE_APPROVED'
    );
  }

  /**
   * An approved row takes an image only when the image says exactly what the row holds — its values never move
   * here (owner, 28-Sep: approved rows stay as they are). Anything else is refused, and the image stays in the
   * style's images for Correct… to use.
   */
  private async assertApprovedRowMatches(cadId: string, file: cad_purpose_files): Promise<void> {
    const differences = await rowDifferencesFromImage(prisma, cadId, file);
    if (differences.length > 0) {
      throw new ConflictError(
        `This row is approved, so it keeps its values — and this image differs from them: ${differences
          .map((d) => d.label)
          .join('; ')}. The image is kept in the style's images: to change the row, use Correct… and pick it there.`,
        { code: 'CAD_MARKER_APPROVED_DIFFERS', cadId, fileId: file.id, differences }
      );
    }
  }

  /**
   * Make an image the row's current marker; the previous one stays on the row as history (replacedAt set).
   * A gallery image (no row) — or an earlier image of this row — is linked; one that is another row's marker
   * gets a record of its own pointing at the same file.
   */
  private async makeCurrent(
    styleId: string,
    cadId: string,
    purpose: CadPurpose,
    source: cad_purpose_files,
    userId: string | undefined
  ): Promise<cad_purpose_files> {
    return prisma.$transaction(async (tx) => {
      await tx.cad_purpose_files.updateMany({
        where: { cadId, replacedAt: null, NOT: { id: source.id } },
        data: { replacedAt: new Date() },
      });
      if (source.cadId === null || source.cadId === cadId) {
        return tx.cad_purpose_files.update({ where: { id: source.id }, data: { cadId, purpose, replacedAt: null } });
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, createdAt, readSizes, replacedAt, sortOrder, ...rest } = source;
      return tx.cad_purpose_files.create({
        data: {
          ...rest,
          purpose,
          readSizes: readSizes === null ? Prisma.DbNull : (readSizes as Prisma.InputJsonValue),
          sortOrder: await this.nextSortOrder(tx, styleId, purpose),
          uploadedById: userId ?? rest.uploadedById,
          cadId,
        },
      });
    });
  }

  /** A new upload, kept in the style's images (no row yet) */
  private async storeUpload(styleId: string, purpose: CadPurpose, upload: CreateCadFileDTO, userId?: string) {
    return prisma.$transaction(async (tx) =>
      tx.cad_purpose_files.create({
        data: {
          styleId,
          purpose,
          fileUrl: upload.fileUrl,
          fileName: upload.fileName,
          fileSize: upload.fileSize,
          sortOrder: await this.nextSortOrder(tx, styleId, purpose),
          uploadedById: userId,
        },
      })
    );
  }

  /**
   * Upload an image as the row's marker. It is stored and read first, then made the row's marker — on an
   * approved row only when it matches the row exactly (otherwise it stays in the style's images).
   */
  async attachToRow(
    styleId: string,
    cadId: string,
    upload: CreateCadFileDTO,
    userId?: string
  ): Promise<MarkerImageResult> {
    const row = await this.rowOfStyle(styleId, cadId);
    const read = await this.readFile(await this.storeUpload(styleId, row.purpose, upload, userId));
    if (await this.isLocked(cadId)) await this.assertApprovedRowMatches(cadId, read);
    const file = await this.makeCurrent(styleId, cadId, row.purpose, read, userId);
    await this.takeEfficiency(cadId, file);
    await recordMarkerImage(cadId, userId, file);
    logInfo('Marker image attached to CAD row', { cadId, fileId: file.id });
    return { file, summary: await markerSummaryForRow(prisma, cadId) };
  }

  /**
   * Use an image already uploaded for the style as the row's marker (read first if it never was). On an
   * approved row only when it matches the row exactly.
   */
  async linkToRow(styleId: string, cadId: string, fileId: string, userId?: string): Promise<MarkerImageResult> {
    const row = await this.rowOfStyle(styleId, cadId);
    let source = await prisma.cad_purpose_files.findFirst({ where: { id: fileId, styleId } });
    if (!source) throw new NotFoundError('CAD image', fileId);
    if (!source.readStatus) source = await this.readFile(source);

    const current = await currentMarkerFile(prisma, cadId);
    if (current && current.id === source.id) {
      return { file: source, summary: await markerSummaryForRow(prisma, cadId) };
    }
    if (await this.isLocked(cadId)) await this.assertApprovedRowMatches(cadId, source);
    const file = await this.makeCurrent(styleId, cadId, row.purpose, source, userId);
    await this.takeEfficiency(cadId, file);
    await recordMarkerImage(cadId, userId, file);
    logInfo('Existing CAD image linked to CAD row', { cadId, fileId: file.id, from: source.id });
    return { file, summary: await markerSummaryForRow(prisma, cadId) };
  }

  /**
   * The corrected marker's image for Correct CAD: stored and read, but NOT the row's marker yet — it becomes
   * the row's current image when the correction applies (cad-correction.service), possibly after an admin
   * approves. Until then it sits in the style's images with no row.
   */
  async uploadForCorrection(
    styleId: string,
    cadId: string,
    upload: CreateCadFileDTO,
    userId?: string
  ): Promise<{ file: cad_purpose_files; reading: ReturnType<typeof storedReading> }> {
    const row = await this.rowOfStyle(styleId, cadId);
    const file = await this.readFile(await this.storeUpload(styleId, row.purpose, upload, userId));
    return { file, reading: storedReading(file) };
  }

  /**
   * Correct CAD with an image already uploaded for the style. The correction takes an image with no row, or
   * this row's own; another row's image gets a record of its own (no row) pointing at the same file.
   */
  async linkForCorrection(
    styleId: string,
    cadId: string,
    fileId: string,
    userId?: string
  ): Promise<{ file: cad_purpose_files; reading: ReturnType<typeof storedReading> }> {
    await this.rowOfStyle(styleId, cadId);
    let source = await prisma.cad_purpose_files.findFirst({ where: { id: fileId, styleId } });
    if (!source) throw new NotFoundError('CAD image', fileId);
    if (source.cadId !== null && source.cadId !== cadId) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, createdAt, readSizes, replacedAt, cadId: otherRow, ...rest } = source;
      source = await prisma.cad_purpose_files.create({
        data: {
          ...rest,
          readSizes: readSizes === null ? Prisma.DbNull : (readSizes as Prisma.InputJsonValue),
          uploadedById: userId ?? rest.uploadedById,
        },
      });
    }
    if (!source.readStatus) source = await this.readFile(source);
    return { file: source, reading: storedReading(source) };
  }

  /**
   * Read the row's current marker image again (after the reader was installed or updated). The new reading is
   * kept only when it is safe to:
   *  - a reader that could not run (busy, timed out, not installed) never replaces a reading that worked;
   *  - an approved row keeps its values, so its image is re-read only when the new reading finds no difference
   *    the old one did not — otherwise a re-read alone would turn it "Differs";
   *  - an image replaced on the row while it was being read is not written over.
   * A re-read is not a new image: no history line.
   */
  async rereadForRow(styleId: string, cadId: string, _userId?: string): Promise<MarkerImageResult> {
    await this.rowOfStyle(styleId, cadId);
    const current = await currentMarkerFile(prisma, cadId);
    if (!current) throw new BusinessError('This CAD row has no marker image to read');
    const reading = await this.readImage(current);

    // A read that did not happen — the reader busy, timed out, switched off, or installed but broken (it then
    // answers UNREADABLE with the error) — never replaces a read that did (READ, PARTIAL, or a clean UNREADABLE):
    // the row's reason was given for that one
    // (nor an earlier failed one: a reason given for "the reader could not run" stays with that reading)
    const readFailed = reading.status === 'READER_UNAVAILABLE' || (reading.status === 'UNREADABLE' && !!reading.error);
    if (readFailed && current.readStatus !== null) {
      throw new BusinessError(
        `The marker reader could not read the image just now (${reading.error ?? 'it did not answer'}) — the ` +
          'earlier reading is kept. Try again in a minute.'
      );
    }
    const stillCurrent = await currentMarkerFile(prisma, cadId);
    if (stillCurrent?.id !== current.id) {
      throw new BusinessError("The row's CAD image was changed while it was being read — open it again.");
    }
    if (await this.isLocked(cadId)) {
      // An approved row keeps its state: the new reading is kept only when the row then matches its image, or the
      // reason the row holds still covers exactly what differs (a reading that drops one of two explained
      // differences would leave the reason covering neither — "Differs" on a row nobody can edit)
      const after = await rowDifferencesFromImage(prisma, cadId, {
        ...current,
        ...readingAsColumns(reading),
      });
      const row = await prisma.fabric_width_cad.findUnique({
        where: { id: cadId },
        select: { markerOverrideDifferences: true },
      });
      if (after.length > 0 && !reasonCovers(row?.markerOverrideDifferences, after)) {
        throw new ConflictError(
          `This row is approved and keeps its values — read again, its image would differ from them: ${after
            .map((d) => d.label)
            .join('; ')}. The earlier reading is kept.`,
          { code: 'CAD_MARKER_APPROVED_DIFFERS', cadId, fileId: current.id, differences: after }
        );
      }
    }

    const file = await prisma.cad_purpose_files.update({ where: { id: current.id }, data: readingColumns(reading) });
    await this.takeEfficiency(cadId, file);
    return { file, summary: await markerSummaryForRow(prisma, cadId) };
  }

  /**
   * Reorder mini markers within a purpose
   */
  async reorder(styleId: string, purpose: CadPurpose, fileIds: string[]): Promise<object[]> {
    try {
      logDebug('Reordering mini markers', { styleId, purpose, fileIds });

      // Verify style exists
      const style = await prisma.styles.findUnique({ where: { id: styleId } });
      if (!style) {
        throw new NotFoundError('Style', styleId);
      }

      // Update sortOrder for each file
      await prisma.$transaction(
        fileIds.map((id, index) =>
          prisma.cad_purpose_files.update({
            where: { id },
            data: { sortOrder: index },
          })
        )
      );

      // Return updated list
      const files = await this.getByPurpose(styleId, purpose);
      logInfo('Mini markers reordered successfully', { styleId, purpose });
      return files;
    } catch (error) {
      logError('Failed to reorder mini markers', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

export const cadFileService = new CadFileService();
