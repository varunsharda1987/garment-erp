/**
 * Style Image Service
 * Manages multiple images per style (gallery feature)
 */
import prisma from '../config/database';
import { NotFoundError } from '../errors';
import { logError, logInfo, logDebug } from '../utils/logger';
import { Prisma, StyleImageType } from '@prisma/client';
import fs from 'fs';
import path from 'path';

export interface CreateStyleImageDTO {
  imageUrl: string;
  imageType?: StyleImageType;
  caption?: string;
}

export interface UpdateStyleImageDTO {
  imageType?: StyleImageType;
  caption?: string;
}

/**
 * `styles.imageUrl` is THE garment photo every screen, list and printout shows. A gallery image
 * marked MAIN becomes it, and a style keeps one MAIN: the previous MAIN is demoted to OTHER.
 * (Until 2026-10-01 the two were never linked, so the gallery's Main and the photo on screen
 * could be different pictures.)
 */
async function makeMainPhoto(tx: Prisma.TransactionClient, styleId: string, imageId: string, imageUrl: string) {
  await tx.style_images.updateMany({
    where: { styleId, imageType: StyleImageType.MAIN, id: { not: imageId } },
    data: { imageType: StyleImageType.OTHER },
  });
  await tx.styles.update({ where: { id: styleId }, data: { imageUrl } });
}

class StyleImageService {
  /**
   * Create a new style image
   */
  async create(styleId: string, data: CreateStyleImageDTO): Promise<object> {
    try {
      logDebug('Creating style image', { styleId, data });

      // Verify style exists
      const style = await prisma.styles.findUnique({ where: { id: styleId } });
      if (!style) {
        throw new NotFoundError('Style', styleId);
      }

      // Get max sortOrder for this style
      const maxSort = await prisma.style_images.aggregate({
        where: { styleId },
        _max: { sortOrder: true },
      });
      const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

      const image = await prisma.$transaction(async (tx) => {
        const created = await tx.style_images.create({
          data: {
            styleId,
            imageUrl: data.imageUrl,
            imageType: data.imageType || StyleImageType.OTHER,
            caption: data.caption,
            sortOrder,
          },
        });
        if (created.imageType === StyleImageType.MAIN) {
          await makeMainPhoto(tx, styleId, created.id, created.imageUrl);
        }
        return created;
      });

      logInfo('Style image created successfully', { id: image.id, styleId });
      return image;
    } catch (error) {
      logError('Failed to create style image', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get all images for a style
   */
  async getByStyleId(styleId: string): Promise<object[]> {
    try {
      // Verify style exists
      const style = await prisma.styles.findUnique({ where: { id: styleId } });
      if (!style) {
        throw new NotFoundError('Style', styleId);
      }

      const images = await prisma.style_images.findMany({
        where: { styleId },
        orderBy: { sortOrder: 'asc' },
      });

      return images;
    } catch (error) {
      logError('Failed to get style images', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update a style image
   */
  async update(styleId: string, imageId: string, data: UpdateStyleImageDTO): Promise<object> {
    try {
      logDebug('Updating style image', { styleId, imageId, data });

      // Verify image exists and belongs to style
      const existing = await prisma.style_images.findFirst({
        where: { id: imageId, styleId },
      });
      if (!existing) {
        throw new NotFoundError('Style Image', imageId);
      }

      const image = await prisma.$transaction(async (tx) => {
        const updated = await tx.style_images.update({
          where: { id: imageId },
          data: {
            imageType: data.imageType,
            caption: data.caption,
          },
        });
        // Only a change TO Main moves the style's photo; un-marking Main leaves the photo as it is.
        if (updated.imageType === StyleImageType.MAIN && existing.imageType !== StyleImageType.MAIN) {
          await makeMainPhoto(tx, styleId, updated.id, updated.imageUrl);
        }
        return updated;
      });

      logInfo('Style image updated successfully', { id: image.id });
      return image;
    } catch (error) {
      logError('Failed to update style image', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Delete a style image
   */
  async delete(styleId: string, imageId: string): Promise<void> {
    try {
      logDebug('Deleting style image', { styleId, imageId });

      // Verify image exists and belongs to style
      const existing = await prisma.style_images.findFirst({
        where: { id: imageId, styleId },
      });
      if (!existing) {
        throw new NotFoundError('Style Image', imageId);
      }

      // Delete the file from disk
      if (existing.imageUrl) {
        const filePath = path.join(__dirname, '../../uploads/styles', path.basename(existing.imageUrl));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.style_images.delete({ where: { id: imageId } });
        // The file is gone: a style whose photo it was shows "no photo" rather than a broken image.
        await tx.styles.updateMany({
          where: { id: styleId, imageUrl: existing.imageUrl },
          data: { imageUrl: null },
        });
      });

      logInfo('Style image deleted successfully', { id: imageId });
    } catch (error) {
      logError('Failed to delete style image', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Reorder style images
   */
  async reorder(styleId: string, imageIds: string[]): Promise<object[]> {
    try {
      logDebug('Reordering style images', { styleId, imageIds });

      // Verify style exists
      const style = await prisma.styles.findUnique({ where: { id: styleId } });
      if (!style) {
        throw new NotFoundError('Style', styleId);
      }

      // Update sortOrder for each image
      await prisma.$transaction(
        imageIds.map((id, index) =>
          prisma.style_images.update({
            where: { id },
            data: { sortOrder: index },
          })
        )
      );

      // Return updated list
      const images = await this.getByStyleId(styleId);
      logInfo('Style images reordered successfully', { styleId });
      return images;
    } catch (error) {
      logError('Failed to reorder style images', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get image types enum values
   */
  getImageTypes(): string[] {
    return Object.values(StyleImageType);
  }
}

export const styleImageService = new StyleImageService();
