import { Router } from 'express';
import { companyProfileController } from '../controllers/companyProfile.controller';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import {
  createCompanyProfileSchema,
  updateCompanyProfileSchema,
  setDefaultCompanyProfileSchema,
} from '../schemas/companyProfile.schema';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { flexIdParamSchema } from '../schemas/common.schema';
import { uploadCompanyLogo, uploadCompanySignature } from '../middleware/upload.middleware';

const router = Router();

router.use(authenticateToken);

// Reads are open to any signed-in user, writes are the HARDCODED admin floor.
//
// Two deliberate halves, and both matter:
//
// 1. Reads must NOT be admin-gated. This is the letterhead every Purchase Order screen renders,
//    so gating reads would 403 every non-admin into a permanent fallback — which is why this
//    router does not simply `router.use(requireAdmin())` the way Tally/e-Invoice do.
//
// 2. Writes use requireAdmin(), NOT requirePermissionForWrites('admin'). The latter consults
//    role_permissions, where this deployment currently grants the 'admin' key to EVERY role —
//    so it let a MERCHANDISER change the company GSTIN (caught by company-perms.test.ts before
//    release). requireAdmin() is the floor the Permissions page cannot lower, and its own
//    contract names integrations settings; a statutory identity printed on every invoice
//    belongs in exactly that category.
const adminOnly = requireAdmin();

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
  adminOnly,
  validateBody(createCompanyProfileSchema),
  asyncHandler(companyProfileController.create.bind(companyProfileController))
);

// PUT /api/company-profiles/:id
router.put(
  '/:id',
  adminOnly,
  validateParams(flexIdParamSchema),
  validateBody(updateCompanyProfileSchema),
  asyncHandler(companyProfileController.update.bind(companyProfileController))
);

// POST /api/company-profiles/:id/set-default — switches the entity every future document uses
router.post(
  '/:id/set-default',
  adminOnly,
  validateParams(flexIdParamSchema),
  validateBody(setDefaultCompanyProfileSchema),
  asyncHandler(companyProfileController.setDefault.bind(companyProfileController))
);

// POST /api/company-profiles/:id/logo — no-body (multipart/form-data; the payload is the
// file, validated by multer's type/size filter, not a JSON body a Zod schema could parse).
// multer MUST run before any body validation or the multipart body is never parsed.
router.post(
  '/:id/logo',
  adminOnly,
  validateParams(flexIdParamSchema),
  uploadCompanyLogo,
  asyncHandler(companyProfileController.uploadLogo.bind(companyProfileController))
);

// POST /api/company-profiles/:id/signature — no-body (multipart/form-data, as above)
router.post(
  '/:id/signature',
  adminOnly,
  validateParams(flexIdParamSchema),
  uploadCompanySignature,
  asyncHandler(companyProfileController.uploadSignature.bind(companyProfileController))
);

export default router;
