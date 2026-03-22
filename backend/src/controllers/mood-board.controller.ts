/**
 * Mood Board Controller
 * Handles HTTP requests for mood board functionality
 */
import { Request, Response } from 'express';
import { moodBoardService } from '../services/mood-board.service';
import { ValidationError } from '../errors';

/**
 * Request with multer file upload
 */
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

/**
 * Create a new mood board
 * POST /api/mood-boards
 */
export const create = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new ValidationError('User authentication required');
  }

  const { name, description, seasonId, status, canvasWidth, canvasHeight } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('Name is required');
  }

  const moodBoard = await moodBoardService.create(userId, {
    name: name.trim(),
    description,
    seasonId,
    status,
    canvasWidth,
    canvasHeight,
  });

  res.status(201).json({
    data: moodBoard,
    message: 'Mood board created successfully',
  });
};

/**
 * Get all mood boards
 * GET /api/mood-boards
 */
export const getAll = async (req: Request, res: Response): Promise<void> => {
  const seasonId = req.query.seasonId as string;
  const status = req.query.status as string;
  const createdById = req.query.createdById as string;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const result = await moodBoardService.getAll({
    seasonId,
    status,
    createdById,
    page,
    limit,
  });

  res.status(200).json({
    data: result.data,
    pagination: result.pagination,
  });
};

/**
 * Get a mood board by ID
 * GET /api/mood-boards/:id
 */
export const getById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const moodBoard = await moodBoardService.getById(id);

  res.status(200).json({
    data: moodBoard,
  });
};

/**
 * Update a mood board
 * PATCH /api/mood-boards/:id
 */
export const update = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, description, seasonId, status, canvasWidth, canvasHeight } = req.body;

  const moodBoard = await moodBoardService.update(id, {
    name,
    description,
    seasonId,
    status,
    canvasWidth,
    canvasHeight,
  });

  res.status(200).json({
    data: moodBoard,
    message: 'Mood board updated successfully',
  });
};

/**
 * Delete a mood board
 * DELETE /api/mood-boards/:id
 */
export const deleteMoodBoard = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await moodBoardService.delete(id);

  res.status(200).json({
    message: 'Mood board deleted successfully',
  });
};

/**
 * Add an item to a mood board
 * POST /api/mood-boards/:id/items
 */
export const addItem = async (req: MulterRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { itemType, colorHex, fabricId, styleId, title, caption, positionX, positionY, width, height, rotation, zIndex } = req.body;

  if (!itemType) {
    throw new ValidationError('Item type is required');
  }

  let imageUrl: string | undefined;
  if (req.file) {
    imageUrl = `/uploads/styles/${req.file.filename}`;
  }

  // Validate based on item type
  if (itemType === 'IMAGE' && !imageUrl) {
    throw new ValidationError('Image file is required for IMAGE type');
  }
  if (itemType === 'COLOR' && !colorHex) {
    throw new ValidationError('Color hex is required for COLOR type');
  }

  const item = await moodBoardService.addItem(id, {
    itemType,
    imageUrl,
    colorHex,
    fabricId,
    styleId,
    title,
    caption,
    positionX: positionX ? parseInt(positionX) : undefined,
    positionY: positionY ? parseInt(positionY) : undefined,
    width: width ? parseInt(width) : undefined,
    height: height ? parseInt(height) : undefined,
    rotation: rotation ? parseInt(rotation) : undefined,
    zIndex: zIndex ? parseInt(zIndex) : undefined,
  });

  res.status(201).json({
    data: item,
    message: 'Item added successfully',
  });
};

/**
 * Update an item
 * PATCH /api/mood-boards/:id/items/:itemId
 */
export const updateItem = async (req: Request, res: Response): Promise<void> => {
  const { id, itemId } = req.params;
  const { positionX, positionY, width, height, rotation, zIndex, title, caption, colorHex } = req.body;

  const item = await moodBoardService.updateItem(id, itemId, {
    positionX,
    positionY,
    width,
    height,
    rotation,
    zIndex,
    title,
    caption,
    colorHex,
  });

  res.status(200).json({
    data: item,
    message: 'Item updated successfully',
  });
};

/**
 * Delete an item
 * DELETE /api/mood-boards/:id/items/:itemId
 */
export const deleteItem = async (req: Request, res: Response): Promise<void> => {
  const { id, itemId } = req.params;
  await moodBoardService.deleteItem(id, itemId);

  res.status(200).json({
    message: 'Item deleted successfully',
  });
};

/**
 * Bulk update item positions (save canvas state)
 * POST /api/mood-boards/:id/items/bulk-update
 */
export const bulkUpdateItems = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { items } = req.body;

  if (!Array.isArray(items)) {
    throw new ValidationError('Items must be an array');
  }

  const updated = await moodBoardService.bulkUpdateItemPositions(id, items);

  res.status(200).json({
    data: updated,
    message: 'Items updated successfully',
  });
};
