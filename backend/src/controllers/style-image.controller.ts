/**
 * Style Image Controller
 * Handles HTTP requests for style gallery/images
 */
import { Request, Response } from 'express';
import { styleImageService } from '../services/style-image.service';
import { NotFoundError, ValidationError } from '../errors';
import { logError } from '../utils/logger';

/**
 * Request with multer file upload
 */
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

/**
 * Upload a new image for a style
 * POST /api/styles/:styleId/images
 */
export const uploadImage = async (req: MulterRequest, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;
    const { imageType, caption } = req.body;

    if (!req.file) {
      throw new ValidationError('Image file is required');
    }

    const imageUrl = `/uploads/styles/${req.file.filename}`;

    const image = await styleImageService.create(styleId, {
      imageUrl,
      imageType,
      caption,
    });

    res.status(201).json({
      data: image,
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to upload image');
  }
};

/**
 * Get all images for a style
 * GET /api/styles/:styleId/images
 */
export const getImages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;
    const images = await styleImageService.getByStyleId(styleId);

    res.status(200).json({
      data: images,
    });
  } catch (error) {
    handleError(res, error, 'Failed to get images');
  }
};

/**
 * Update an image
 * PATCH /api/styles/:styleId/images/:imageId
 */
export const updateImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId, imageId } = req.params;
    const { imageType, caption } = req.body;

    const image = await styleImageService.update(styleId, imageId, {
      imageType,
      caption,
    });

    res.status(200).json({
      data: image,
      message: 'Image updated successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to update image');
  }
};

/**
 * Delete an image
 * DELETE /api/styles/:styleId/images/:imageId
 */
export const deleteImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId, imageId } = req.params;
    await styleImageService.delete(styleId, imageId);

    res.status(200).json({
      message: 'Image deleted successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to delete image');
  }
};

/**
 * Reorder images
 * POST /api/styles/:styleId/images/reorder
 */
export const reorderImages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;
    const { imageIds } = req.body;

    if (!Array.isArray(imageIds)) {
      throw new ValidationError('imageIds must be an array');
    }

    const images = await styleImageService.reorder(styleId, imageIds);

    res.status(200).json({
      data: images,
      message: 'Images reordered successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to reorder images');
  }
};

/**
 * Get image type options
 * GET /api/styles/images/types
 */
export const getImageTypes = async (_req: Request, res: Response): Promise<void> => {
  try {
    const types = styleImageService.getImageTypes();
    res.status(200).json({
      data: types,
    });
  } catch (error) {
    handleError(res, error, 'Failed to get image types');
  }
};

/**
 * Error handler helper
 */
function handleError(res: Response, error: unknown, defaultMessage: string): void {
  if (error instanceof NotFoundError) {
    res.status(404).json({ error: error.message });
  } else if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
  } else {
    logError(defaultMessage, error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: defaultMessage });
  }
}
