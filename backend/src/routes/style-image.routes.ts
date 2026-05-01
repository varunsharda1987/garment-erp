/**
 * Style Image Routes
 * API routes for style gallery functionality
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import { uploadStyleImage } from '../middleware/upload.middleware';
import { styleIdParamSchema, styleIdAndImageIdParamSchema } from '../schemas/common.schema';
import {
  uploadImage,
  getImages,
  updateImage,
  deleteImage,
  reorderImages,
  getImageTypes,
} from '../controllers/style-image.controller';
import { updateImageSchema, reorderImagesSchema } from '../schemas/styleImage.schema';

const router = Router();

// Get image type options (static route must come before parameterized routes)
router.get('/images/types', authenticateToken, asyncHandler(getImageTypes));

// Style-specific image routes
router.get('/:styleId/images', authenticateToken, validateParams(styleIdParamSchema), asyncHandler(getImages));
router.post(
  '/:styleId/images',
  authenticateToken,
  validateParams(styleIdParamSchema),
  uploadStyleImage,
  asyncHandler(uploadImage)
);
router.post(
  '/:styleId/images/reorder',
  authenticateToken,
  validateParams(styleIdParamSchema),
  validateBody(reorderImagesSchema),
  asyncHandler(reorderImages)
);
router.patch(
  '/:styleId/images/:imageId',
  authenticateToken,
  validateParams(styleIdAndImageIdParamSchema),
  validateBody(updateImageSchema),
  asyncHandler(updateImage)
);
router.delete(
  '/:styleId/images/:imageId',
  authenticateToken,
  validateParams(styleIdAndImageIdParamSchema),
  asyncHandler(deleteImage)
);

export default router;
