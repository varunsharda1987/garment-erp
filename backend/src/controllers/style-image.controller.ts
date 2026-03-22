/**
 * Style Image Controller
 * Handles HTTP requests for style gallery/images
 */
import { Request, Response } from 'express';
import { styleImageService } from '../services/style-image.service';
import { ValidationError } from '../errors';

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
};

/**
 * Get all images for a style
 * GET /api/styles/:styleId/images
 */
export const getImages = async (req: Request, res: Response): Promise<void> => {
  const { styleId } = req.params;
  const images = await styleImageService.getByStyleId(styleId);

  res.status(200).json({
    data: images,
  });
};

/**
 * Update an image
 * PATCH /api/styles/:styleId/images/:imageId
 */
export const updateImage = async (req: Request, res: Response): Promise<void> => {
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
};

/**
 * Delete an image
 * DELETE /api/styles/:styleId/images/:imageId
 */
export const deleteImage = async (req: Request, res: Response): Promise<void> => {
  const { styleId, imageId } = req.params;
  await styleImageService.delete(styleId, imageId);

  res.status(200).json({
    message: 'Image deleted successfully',
  });
};

/**
 * Reorder images
 * POST /api/styles/:styleId/images/reorder
 */
export const reorderImages = async (req: Request, res: Response): Promise<void> => {
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
};

/**
 * Get image type options
 * GET /api/styles/images/types
 */
export const getImageTypes = async (_req: Request, res: Response): Promise<void> => {
  const types = styleImageService.getImageTypes();
  res.status(200).json({
    data: types,
  });
};
