/**
 * Style Image Routes
 * API routes for style gallery functionality
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
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
router.get('/images/types', authenticateToken, getImageTypes);

// Style-specific image routes
router.get('/:styleId/images', authenticateToken, getImages);
router.post('/:styleId/images', authenticateToken, uploadStyleImage, uploadImage);
router.post('/:styleId/images/reorder', authenticateToken, reorderImages);
router.patch('/:styleId/images/:imageId', authenticateToken, updateImage);
router.delete('/:styleId/images/:imageId', authenticateToken, deleteImage);

export default router;
