import { Router } from 'express';
import { companyProfileController } from '../controllers/companyProfile.controller';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import {
  createCompanyProfileSchema,
  updateCompanyProfileSchema,
  setDefaultCompanyProfileSchema,
} from '../schemas/companyProfile.schema';
import { authenticateToken, requirePermissionForWrites } from '../middleware/auth.middleware';
import { flexIdParamSchema } from '../schemas/common.schema';
import { uploadCompanyLogo, uploadCompanySignature } from '../middleware/upload.middleware';

const router = Router();

router.use(authenticateToken);
// Reads stay open, writes are admin-only. Deliberately NOT the router-wide requireAdmin() that
// Tally/e-Invoice use: those hold secrets, whereas this is the letterhead every Purchase Order
// screen renders — gating reads to admins would 403 every non-admin's letterhead into a
// permanent fallback. Reuses the existing 'admin' key, so no permission-catalogue churn.
router.use(requirePermissionForWrites('admin'));

// GET /api/company-profiles/default — the entity every document uses (before /:id)
router.get('/default', asyncHandler(companyProfileController.getDefault.bind(companyProfileController)));

// GET /api/company-profiles — all entities
router.get('/', asyncHandler(companyProfileController.getAll.bind(companyProfileController)));

// GET /api/company-profiles/:id
router.get(
  '/:id',
  validateParams(flexIdParamSchema),
  asyncHandler(companyProfileController.getById.bind(companyProfileController))
);

// POST /api/company-profiles
router.post(
  '/',
  validateBody(createCompanyProfileSchema),
  asyncHandler(companyProfileController.create.bind(companyProfileController))
);

// PUT /api/company-profiles/:id
router.put(
  '/:id',
  validateParams(flexIdParamSchema),
  validateBody(updateCompanyProfileSchema),
  asyncHandler(companyProfileController.update.bind(companyProfileController))
);

// POST /api/company-profiles/:id/set-default — switches the entity every future document uses
router.post(
  '/:id/set-default',
  validateParams(flexIdParamSchema),
  validateBody(setDefaultCompanyProfileSchema),
  asyncHandler(companyProfileController.setDefault.bind(companyProfileController))
);

// POST /api/company-profiles/:id/logo — no-body (multipart/form-data; the payload is the
// file, validated by multer's type/size filter, not a JSON body a Zod schema could parse).
// multer MUST run before any body validation or the multipart body is never parsed.
router.post(
  '/:id/logo',
  validateParams(flexIdParamSchema),
  uploadCompanyLogo,
  asyncHandler(companyProfileController.uploadLogo.bind(companyProfileController))
);

// POST /api/company-profiles/:id/signature — no-body (multipart/form-data, as above)
router.post(
  '/:id/signature',
  validateParams(flexIdParamSchema),
  uploadCompanySignature,
  asyncHandler(companyProfileController.uploadSignature.bind(companyProfileController))
);

export default router;
