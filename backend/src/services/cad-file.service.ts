/**
 * CAD File Service (Mini Markers)
 * Manages mini marker file attachments per style + purpose
 */
import prisma from '../config/database';
import { NotFoundError } from '../errors';
import { logError, logInfo, logDebug } from '../utils/logger';
import { CadPurpose } from '@prisma/client';
import { deleteCadFile } from '../middleware/upload.middleware';

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

      return { files, total: files.length };
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

      // Delete the physical file from disk
      if (existing.fileUrl) {
        deleteCadFile(existing.fileUrl);
      }

      await prisma.cad_purpose_files.delete({
        where: { id: fileId },
      });

      logInfo('Mini marker deleted successfully', { id: fileId });
    } catch (error) {
      logError('Failed to delete mini marker', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
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
