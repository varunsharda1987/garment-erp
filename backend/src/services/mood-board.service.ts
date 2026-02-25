/**
 * Mood Board Service
 * Manages mood boards for design inspiration
 */
import prisma from '../config/database';
import { NotFoundError, ValidationError } from '../errors';
import { logError, logInfo, logDebug } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export interface CreateMoodBoardDTO {
  name: string;
  description?: string;
  seasonId?: string;
  status?: string;
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface UpdateMoodBoardDTO {
  name?: string;
  description?: string;
  seasonId?: string;
  status?: string;
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface CreateMoodBoardItemDTO {
  itemType: string; // IMAGE, COLOR, TEXT, FABRIC_REF, STYLE_REF
  imageUrl?: string;
  colorHex?: string;
  fabricId?: string;
  styleId?: string;
  title?: string;
  caption?: string;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  rotation?: number;
  zIndex?: number;
}

export interface UpdateMoodBoardItemDTO {
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  rotation?: number;
  zIndex?: number;
  title?: string;
  caption?: string;
  colorHex?: string;
}

class MoodBoardService {
  /**
   * Create a new mood board
   */
  async create(userId: string, data: CreateMoodBoardDTO): Promise<object> {
    try {
      logDebug('Creating mood board', { userId, data });

      const moodBoard = await prisma.mood_boards.create({
        data: {
          name: data.name,
          description: data.description,
          seasonId: data.seasonId,
          status: data.status || 'DRAFT',
          canvasWidth: data.canvasWidth || 1920,
          canvasHeight: data.canvasHeight || 1080,
          createdById: userId,
        },
        include: {
          season: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
      });

      logInfo('Mood board created successfully', { id: moodBoard.id });
      return moodBoard;
    } catch (error) {
      logError('Failed to create mood board', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get all mood boards with filters
   */
  async getAll(params?: {
    seasonId?: string;
    status?: string;
    createdById?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: object[]; pagination: object }> {
    try {
      logDebug('Getting all mood boards', params);

      const where: Record<string, unknown> = {};
      if (params?.seasonId) where.seasonId = params.seasonId;
      if (params?.status) where.status = params.status;
      if (params?.createdById) where.createdById = params.createdById;

      const page = params?.page || 1;
      const limit = params?.limit || 20;
      const skip = (page - 1) * limit;

      const total = await prisma.mood_boards.count({ where });

      const moodBoards = await prisma.mood_boards.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          season: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          items: {
            take: 1, // Get first item for thumbnail
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              imageUrl: true,
              colorHex: true,
              itemType: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
      });

      return {
        data: moodBoards,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logError('Failed to get mood boards', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get a mood board by ID with all items
   */
  async getById(id: string): Promise<object> {
    try {
      logDebug('Getting mood board by ID', { id });

      const moodBoard = await prisma.mood_boards.findUnique({
        where: { id },
        include: {
          season: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          items: {
            orderBy: { zIndex: 'asc' },
          },
        },
      });

      if (!moodBoard) {
        throw new NotFoundError('Mood Board', id);
      }

      return moodBoard;
    } catch (error) {
      logError('Failed to get mood board', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update a mood board
   */
  async update(id: string, data: UpdateMoodBoardDTO): Promise<object> {
    try {
      logDebug('Updating mood board', { id, data });

      // Verify exists
      const existing = await prisma.mood_boards.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundError('Mood Board', id);
      }

      const moodBoard = await prisma.mood_boards.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          seasonId: data.seasonId,
          status: data.status,
          canvasWidth: data.canvasWidth,
          canvasHeight: data.canvasHeight,
        },
        include: {
          season: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
      });

      logInfo('Mood board updated successfully', { id });
      return moodBoard;
    } catch (error) {
      logError('Failed to update mood board', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Delete a mood board and all its items
   */
  async delete(id: string): Promise<void> {
    try {
      logDebug('Deleting mood board', { id });

      // Verify exists
      const existing = await prisma.mood_boards.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!existing) {
        throw new NotFoundError('Mood Board', id);
      }

      // Delete image files for items
      for (const item of existing.items) {
        if (item.imageUrl) {
          const filePath = path.join(__dirname, '../../uploads/styles', path.basename(item.imageUrl));
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }

      // Delete mood board (cascade deletes items via schema)
      await prisma.mood_boards.delete({ where: { id } });

      logInfo('Mood board deleted successfully', { id });
    } catch (error) {
      logError('Failed to delete mood board', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Add an item to a mood board
   */
  async addItem(boardId: string, data: CreateMoodBoardItemDTO): Promise<object> {
    try {
      logDebug('Adding item to mood board', { boardId, data });

      // Verify mood board exists
      const moodBoard = await prisma.mood_boards.findUnique({ where: { id: boardId } });
      if (!moodBoard) {
        throw new NotFoundError('Mood Board', boardId);
      }

      // Get max zIndex for this board
      const maxZ = await prisma.mood_board_items.aggregate({
        where: { moodBoardId: boardId },
        _max: { zIndex: true },
      });
      const zIndex = data.zIndex ?? (maxZ._max.zIndex ?? -1) + 1;

      const item = await prisma.mood_board_items.create({
        data: {
          moodBoardId: boardId,
          itemType: data.itemType,
          imageUrl: data.imageUrl,
          colorHex: data.colorHex,
          fabricId: data.fabricId,
          styleId: data.styleId,
          title: data.title,
          caption: data.caption,
          positionX: data.positionX ?? 0,
          positionY: data.positionY ?? 0,
          width: data.width ?? 200,
          height: data.height ?? 200,
          rotation: data.rotation ?? 0,
          zIndex,
        },
      });

      logInfo('Item added to mood board', { itemId: item.id, boardId });
      return item;
    } catch (error) {
      logError('Failed to add item to mood board', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update an item's position/size/properties
   */
  async updateItem(boardId: string, itemId: string, data: UpdateMoodBoardItemDTO): Promise<object> {
    try {
      logDebug('Updating mood board item', { boardId, itemId, data });

      // Verify item exists and belongs to board
      const existing = await prisma.mood_board_items.findFirst({
        where: { id: itemId, moodBoardId: boardId },
      });
      if (!existing) {
        throw new NotFoundError('Mood Board Item', itemId);
      }

      const item = await prisma.mood_board_items.update({
        where: { id: itemId },
        data: {
          positionX: data.positionX,
          positionY: data.positionY,
          width: data.width,
          height: data.height,
          rotation: data.rotation,
          zIndex: data.zIndex,
          title: data.title,
          caption: data.caption,
          colorHex: data.colorHex,
        },
      });

      logInfo('Mood board item updated', { itemId });
      return item;
    } catch (error) {
      logError('Failed to update mood board item', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Delete an item from a mood board
   */
  async deleteItem(boardId: string, itemId: string): Promise<void> {
    try {
      logDebug('Deleting mood board item', { boardId, itemId });

      // Verify item exists and belongs to board
      const existing = await prisma.mood_board_items.findFirst({
        where: { id: itemId, moodBoardId: boardId },
      });
      if (!existing) {
        throw new NotFoundError('Mood Board Item', itemId);
      }

      // Delete image file if exists
      if (existing.imageUrl) {
        const filePath = path.join(__dirname, '../../uploads/styles', path.basename(existing.imageUrl));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      await prisma.mood_board_items.delete({ where: { id: itemId } });

      logInfo('Mood board item deleted', { itemId });
    } catch (error) {
      logError('Failed to delete mood board item', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Bulk update item positions (for saving canvas state)
   */
  async bulkUpdateItemPositions(
    boardId: string,
    items: Array<{ id: string; positionX: number; positionY: number; width?: number; height?: number; zIndex?: number }>
  ): Promise<object[]> {
    try {
      logDebug('Bulk updating item positions', { boardId, itemCount: items.length });

      // Verify mood board exists
      const moodBoard = await prisma.mood_boards.findUnique({ where: { id: boardId } });
      if (!moodBoard) {
        throw new NotFoundError('Mood Board', boardId);
      }

      // Update all items in a transaction
      const updated = await prisma.$transaction(
        items.map((item) =>
          prisma.mood_board_items.update({
            where: { id: item.id },
            data: {
              positionX: item.positionX,
              positionY: item.positionY,
              width: item.width,
              height: item.height,
              zIndex: item.zIndex,
            },
          })
        )
      );

      logInfo('Bulk item positions updated', { boardId, count: updated.length });
      return updated;
    } catch (error) {
      logError('Failed to bulk update item positions', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

export const moodBoardService = new MoodBoardService();
