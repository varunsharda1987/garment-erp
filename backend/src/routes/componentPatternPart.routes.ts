import express from 'express';
import { patternPartController } from '../controllers/patternPart.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router({ mergeParams: true }); // mergeParams to access :componentId from parent router

// All routes require authentication
router.use(authenticateToken);

// Get pattern parts for a component
router.get('/', patternPartController.getPatternPartsByComponent.bind(patternPartController));

// Add pattern part to component
router.post('/', patternPartController.addPatternPartToComponent.bind(patternPartController));

// Update component-pattern part association
router.put('/:patternPartId', patternPartController.updateComponentPatternPart.bind(patternPartController));

// Remove pattern part from component
router.delete('/:patternPartId', patternPartController.removePatternPartFromComponent.bind(patternPartController));

export default router;
