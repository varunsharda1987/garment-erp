/**
 * Style Image Routes
 * API routes for style gallery functionality
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { uploadStyleImage } from '../middleware/upload.middleware';
import {
  uploadImage,
  getImages,
  updateImage,
  deleteImage,
  reorderImages,
  getImageTypes,
} from '../controllers/style-image.controller';

const router = Router();

// Get image type options (static route must come before parameterized routes)
router.get('/images/types', authenticateToken, asyncHandler(getImageTypes));

// Style-specific image routes
router.get('/:styleId/images', authenticateToken, asyncHandler(getImages));
router.post('/:styleId/images', authenticateToken, uploadStyleImage, asyncHandler(uploadImage));
router.post('/:styleId/images/reorder', authenticateToken, asyncHandler(reorderImages));
router.patch('/:styleId/images/:imageId', authenticateToken, asyncHandler(updateImage));
router.delete('/:styleId/images/:imageId', authenticateToken, asyncHandler(deleteImage));

export default router;
