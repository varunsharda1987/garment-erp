import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import * as greigeController from '../controllers/greige.controller';
import * as fabricController from '../controllers/fabric.controller';
import * as cadController from '../controllers/fabric-cad.controller';

const router = Router();

// ============================================
// GREIGE MASTER ROUTES
// ============================================

// Get all greige masters with filters
router.get('/greige', authenticateToken, asyncHandler(greigeController.getAllGreigeMasters));

// Get greige statistics
router.get('/greige/statistics', authenticateToken, asyncHandler(greigeController.getGreigeStatistics));

// Export greige masters (must come before :id route)
router.get('/greige/export', authenticateToken, asyncHandler(greigeController.exportGreigeMasters));

// Get unique generic greige names for dropdown (must come before :id route)
router.get('/greige/generic-names', authenticateToken, asyncHandler(greigeController.getGenericGreigeNames));

// Get next auto-generated greige code (must come before :id route)
router.get('/greige/next-code', authenticateToken, asyncHandler(greigeController.getNextGreigeCode));

// Bulk import greige masters (must come before :id route)
router.post('/greige/bulk-import', authenticateToken, asyncHandler(greigeController.bulkImportGreigeMasters));

// Get pricing history for a greige
router.get('/greige/:id/pricing-history', authenticateToken, asyncHandler(greigeController.getGreigePricingHistory));

// Get single greige master
router.get('/greige/:id', authenticateToken, asyncHandler(greigeController.getGreigeMasterById));

// Create new greige master
router.post('/greige', authenticateToken, asyncHandler(greigeController.createGreigeMaster));

// Update greige master
router.put('/greige/:id', authenticateToken, asyncHandler(greigeController.updateGreigeMaster));

// Delete greige master
router.delete('/greige/:id', authenticateToken, asyncHandler(greigeController.deleteGreigeMaster));

// ============================================
// FABRIC MASTER ROUTES
// ============================================

// Get all fabric masters with filters
router.get('/fabric', authenticateToken, asyncHandler(fabricController.getAllFabricMasters));

// Get fabric statistics
router.get('/fabric/statistics', authenticateToken, asyncHandler(fabricController.getFabricStatistics));

// Get unique generic fabric names for dropdown
router.get('/fabric/generic-names', authenticateToken, asyncHandler(fabricController.getGenericFabricNames));

// Get next auto-generated fabric code
router.get('/fabric/next-code', authenticateToken, asyncHandler(fabricController.getNextFabricCode));

// Export fabric masters (must come before :id route)
router.get('/fabric/export', authenticateToken, asyncHandler(fabricController.exportFabricMasters));

// Get pricing history for a fabric
router.get('/fabric/:id/pricing-history', authenticateToken, asyncHandler(fabricController.getFabricPricingHistory));

// Get fabrics by greige ID
router.get('/fabric/by-greige/:greigeId', authenticateToken, asyncHandler(fabricController.getFabricsByGreigeId));

// Get single fabric master
router.get('/fabric/:id', authenticateToken, asyncHandler(fabricController.getFabricMasterById));

// Create new fabric master
router.post('/fabric', authenticateToken, asyncHandler(fabricController.createFabricMaster));

// Update fabric master
router.put('/fabric/:id', authenticateToken, asyncHandler(fabricController.updateFabricMaster));

// Delete fabric master
router.delete('/fabric/:id', authenticateToken, asyncHandler(fabricController.deleteFabricMaster));

// Bulk import fabric masters
router.post('/fabric/bulk-import', authenticateToken, asyncHandler(fabricController.bulkImportFabricMasters));

// ============================================
// FABRIC STYLE ALLOCATION ROUTES
// ============================================

// Get all styles/components/pattern parts using this fabric
router.get('/fabric/:id/style-allocations', authenticateToken, asyncHandler(fabricController.getStyleAllocations));

// Allocate fabric to a style component
router.post('/fabric/:id/allocate-to-style', authenticateToken, asyncHandler(fabricController.allocateToStyle));

// Remove style allocation
router.delete(
  '/fabric/:id/style-allocations/:styleFabricId',
  authenticateToken,
  asyncHandler(fabricController.removeStyleAllocation)
);

// Update pattern parts for an existing allocation (edit mode)
router.put(
  '/fabric/:id/allocations/:allocationId/pattern-parts',
  authenticateToken,
  asyncHandler(fabricController.updateAllocationPatternParts)
);

// ============================================
// FABRIC WIDTH CAD ROUTES
// ============================================

// Get CAD statistics
router.get('/cad/statistics', authenticateToken, asyncHandler(cadController.getCADStatistics));

// Get cost comparison for a fabric
router.get('/cad/comparison/:fabricId', authenticateToken, asyncHandler(cadController.getCostComparison));

// Get all CADs for a fabric
router.get('/cad/fabric/:fabricId', authenticateToken, asyncHandler(cadController.getCADsByFabricId));

// Get single CAD entry
router.get('/cad/:id', authenticateToken, asyncHandler(cadController.getCADById));

// Create new CAD entry
router.post('/cad', authenticateToken, asyncHandler(cadController.createCAD));

// Update CAD entry
router.put('/cad/:id', authenticateToken, asyncHandler(cadController.updateCAD));

// Set as preferred width
router.patch('/cad/:id/set-preferred', authenticateToken, asyncHandler(cadController.setPreferredWidth));

// Delete CAD entry
router.delete('/cad/:id', authenticateToken, asyncHandler(cadController.deleteCAD));

export default router;
