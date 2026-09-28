/**
 * CAD File Service (Mini Markers)
 * Manages mini marker file attachments per style + purpose
 */
import prisma from '../config/database';
import { BusinessError, NotFoundError } from '../errors';
import { logError, logInfo, logDebug } from '../utils/logger';
import { CadPurpose, Prisma, cad_purpose_files } from '@prisma/client';
import { deleteCadFile } from '../middleware/upload.middleware';
import { validateCADModification } from '../controllers/cad-planning.utils';
import { markerFilePath, normalizeReading, readMarkerFile } from './marker-reader.service';
import {
  currentMarkerFile,
  markerRequired,
  markerSummaryForRow,
  readingColumns,
  recordMarkerImage,
  storedReading,
  type MarkerSummary,
} from './helpers/cad-marker.helper';

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

  /** Read the image, store what was read, record it on the row's History, and return the row's state */
  private async readAndRecord(
    file: cad_purpose_files,
    cadId: string,
    userId: string | undefined
  ): Promise<MarkerImageResult> {
    const fullPath = markerFilePath(file.fileUrl);
    const reading = fullPath
      ? await readMarkerFile(fullPath)
      : normalizeReading({ status: 'UNREADABLE', error: 'The image file is not in the uploads folder' });
    const updated = await prisma.cad_purpose_files.update({ where: { id: file.id }, data: readingColumns(reading) });
    await recordMarkerImage(cadId, userId, updated);
    return { file: updated, summary: await markerSummaryForRow(prisma, cadId) };
  }

  /**
   * Upload an image as the row's marker. The previous one stays on the row as history (replacedAt set).
   * An approved row is changed through Correct CAD, never here.
   */
  async attachToRow(
    styleId: string,
    cadId: string,
    upload: CreateCadFileDTO,
    userId?: string
  ): Promise<MarkerImageResult> {
    await validateCADModification(cadId, 'update');
    const row = await this.rowOfStyle(styleId, cadId);
    const file = await prisma.$transaction(async (tx) => {
      await tx.cad_purpose_files.updateMany({ where: { cadId, replacedAt: null }, data: { replacedAt: new Date() } });
      return tx.cad_purpose_files.create({
        data: {
          styleId,
          purpose: row.purpose,
          fileUrl: upload.fileUrl,
          fileName: upload.fileName,
          fileSize: upload.fileSize,
          sortOrder: await this.nextSortOrder(tx, styleId, row.purpose),
          uploadedById: userId,
          cadId,
        },
      });
    });
    logInfo('Marker image attached to CAD row', { cadId, fileId: file.id });
    return this.readAndRecord(file, cadId, userId);
  }

  /**
   * Use an image already uploaded for the style as the row's marker. A gallery image (no row) is linked;
   * one that is already another row's marker gets a record of its own pointing at the same file.
   */
  async linkToRow(styleId: string, cadId: string, fileId: string, userId?: string): Promise<MarkerImageResult> {
    await validateCADModification(cadId, 'update');
    const row = await this.rowOfStyle(styleId, cadId);
    const source = await prisma.cad_purpose_files.findFirst({ where: { id: fileId, styleId } });
    if (!source) throw new NotFoundError('CAD image', fileId);

    const current = await currentMarkerFile(prisma, cadId);
    if (current && current.id === source.id) {
      return current.readStatus
        ? { file: current, summary: await markerSummaryForRow(prisma, cadId) }
        : this.readAndRecord(current, cadId, userId);
    }

    const file = await prisma.$transaction(async (tx) => {
      await tx.cad_purpose_files.updateMany({ where: { cadId, replacedAt: null }, data: { replacedAt: new Date() } });
      if (source.cadId === null) {
        return tx.cad_purpose_files.update({ where: { id: source.id }, data: { cadId, purpose: row.purpose } });
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, createdAt, readSizes, replacedAt, sortOrder, ...rest } = source;
      return tx.cad_purpose_files.create({
        data: {
          ...rest,
          purpose: row.purpose,
          readSizes: readSizes === null ? Prisma.DbNull : (readSizes as Prisma.InputJsonValue),
          sortOrder: await this.nextSortOrder(tx, styleId, row.purpose),
          uploadedById: userId ?? rest.uploadedById,
          cadId,
        },
      });
    });
    logInfo('Existing CAD image linked to CAD row', { cadId, fileId: file.id, from: source.id });
    return file.readStatus
      ? (await recordMarkerImage(cadId, userId, file), { file, summary: await markerSummaryForRow(prisma, cadId) })
      : this.readAndRecord(file, cadId, userId);
  }

  /**
   * The corrected marker's image for Correct CAD: stored and read, but NOT the row's marker yet — it becomes
   * the row's current image when the correction applies (cad-correction.service), possibly after an admin
   * approves. Until then it sits in the style's gallery with no row.
   */
  async uploadForCorrection(
    styleId: string,
    cadId: string,
    upload: CreateCadFileDTO,
    userId?: string
  ): Promise<{ file: cad_purpose_files; reading: ReturnType<typeof storedReading> }> {
    const row = await this.rowOfStyle(styleId, cadId);
    const created = await prisma.$transaction(async (tx) =>
      tx.cad_purpose_files.create({
        data: {
          styleId,
          purpose: row.purpose,
          fileUrl: upload.fileUrl,
          fileName: upload.fileName,
          fileSize: upload.fileSize,
          sortOrder: await this.nextSortOrder(tx, styleId, row.purpose),
          uploadedById: userId,
        },
      })
    );
    const fullPath = markerFilePath(created.fileUrl);
    const reading = fullPath
      ? await readMarkerFile(fullPath)
      : normalizeReading({ status: 'UNREADABLE', error: 'The image file is not in the uploads folder' });
    const file = await prisma.cad_purpose_files.update({ where: { id: created.id }, data: readingColumns(reading) });
    return { file, reading: storedReading(file) };
  }

  /** Read the row's current marker image again (after the reader was installed or updated) */
  async rereadForRow(styleId: string, cadId: string, userId?: string): Promise<MarkerImageResult> {
    await this.rowOfStyle(styleId, cadId);
    const file = await currentMarkerFile(prisma, cadId);
    if (!file) throw new BusinessError('This CAD row has no marker image to read');
    return this.readAndRecord(file, cadId, userId);
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
