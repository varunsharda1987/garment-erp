/**
 * Job Work Statutory Reports Routes
 * Phase 5 of Job Work Consolidation
 *
 * Routes for GST compliance reports:
 * - Section 143 Ageing
 * - ITC-04 Extract
 * - Vendor Performance
 */

import { Router } from 'express';
import { jobWorkStatutoryController } from '../controllers/job-work-statutory.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/job-work-statutory/summary
// Quick summary of all statutory metrics
router.get('/summary', jobWorkStatutoryController.getSummary.bind(jobWorkStatutoryController));

// GET /api/job-work-statutory/section-143-ageing
// Section 143 Ageing Report
router.get('/section-143-ageing', jobWorkStatutoryController.getSection143Ageing.bind(jobWorkStatutoryController));

// GET /api/job-work-statutory/itc-04
// ITC-04 Extract for GST filing
router.get('/itc-04', jobWorkStatutoryController.getITC04Extract.bind(jobWorkStatutoryController));

// GET /api/job-work-statutory/vendor-performance
// Vendor Performance Report
router.get('/vendor-performance', jobWorkStatutoryController.getVendorPerformance.bind(jobWorkStatutoryController));

export default router;
