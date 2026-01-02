import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import * as greigeController from '../controllers/greige.controller';
import * as fabricController from '../controllers/fabric.controller';
import * as cadController from '../controllers/fabric-cad.controller';

const router = Router();

// ============================================
// GREIGE MASTER ROUTES
// ============================================

// Get all greige masters with filters
router.get('/greige', authenticateToken, greigeController.getAllGreigeMasters);

// Get greige statistics
router.get('/greige/statistics', authenticateToken, greigeController.getGreigeStatistics);

// Export greige masters (must come before :id route)
router.get('/greige/export', authenticateToken, greigeController.exportGreigeMasters);

// Bulk import greige masters (must come before :id route)
router.post('/greige/bulk-import', authenticateToken, greigeController.bulkImportGreigeMasters);

// Get pricing history for a greige
router.get('/greige/:id/pricing-history', authenticateToken, greigeController.getGreigePricingHistory);

// Get single greige master
router.get('/greige/:id', authenticateToken, greigeController.getGreigeMasterById);

// Create new greige master
router.post('/greige', authenticateToken, greigeController.createGreigeMaster);

// Update greige master
router.put('/greige/:id', authenticateToken, greigeController.updateGreigeMaster);

// Delete greige master
router.delete('/greige/:id', authenticateToken, greigeController.deleteGreigeMaster);

// ============================================
// FABRIC MASTER ROUTES
// ============================================

// Get all fabric masters with filters
router.get('/fabric', authenticateToken, fabricController.getAllFabricMasters);

// Get fabric statistics
router.get('/fabric/statistics', authenticateToken, fabricController.getFabricStatistics);

// Get unique generic fabric names for dropdown
router.get('/fabric/generic-names', authenticateToken, fabricController.getGenericFabricNames);

// Get next auto-generated fabric code
router.get('/fabric/next-code', authenticateToken, fabricController.getNextFabricCode);

// Export fabric masters (must come before :id route)
router.get('/fabric/export', authenticateToken, fabricController.exportFabricMasters);

// Get pricing history for a fabric
router.get('/fabric/:id/pricing-history', authenticateToken, fabricController.getFabricPricingHistory);

// Get fabrics by greige ID
router.get('/fabric/by-greige/:greigeId', authenticateToken, fabricController.getFabricsByGreigeId);

// Get single fabric master
router.get('/fabric/:id', authenticateToken, fabricController.getFabricMasterById);

// Create new fabric master
router.post('/fabric', authenticateToken, fabricController.createFabricMaster);

// Update fabric master
router.put('/fabric/:id', authenticateToken, fabricController.updateFabricMaster);

// Delete fabric master
router.delete('/fabric/:id', authenticateToken, fabricController.deleteFabricMaster);

// Bulk import fabric masters
router.post('/fabric/bulk-import', authenticateToken, fabricController.bulkImportFabricMasters);

// ============================================
// FABRIC STYLE ALLOCATION ROUTES
// ============================================

// Get all styles/components/pattern parts using this fabric
router.get('/fabric/:id/style-allocations', authenticateToken, fabricController.getStyleAllocations);

// Allocate fabric to a style component
router.post('/fabric/:id/allocate-to-style', authenticateToken, fabricController.allocateToStyle);

// Remove style allocation
router.delete('/fabric/:id/style-allocations/:styleFabricId', authenticateToken, fabricController.removeStyleAllocation);

// ============================================
// FABRIC WIDTH CAD ROUTES
// ============================================

// Get CAD statistics
router.get('/cad/statistics', authenticateToken, cadController.getCADStatistics);

// Get cost comparison for a fabric
router.get('/cad/comparison/:fabricId', authenticateToken, cadController.getCostComparison);

// Get all CADs for a fabric
router.get('/cad/fabric/:fabricId', authenticateToken, cadController.getCADsByFabricId);

// Get single CAD entry
router.get('/cad/:id', authenticateToken, cadController.getCADById);

// Create new CAD entry
router.post('/cad', authenticateToken, cadController.createCAD);

// Update CAD entry
router.put('/cad/:id', authenticateToken, cadController.updateCAD);

// Set as preferred width
router.patch('/cad/:id/set-preferred', authenticateToken, cadController.setPreferredWidth);

// Delete CAD entry
router.delete('/cad/:id', authenticateToken, cadController.deleteCAD);

export default router;
