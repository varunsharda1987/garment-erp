/**
 * Style Controller - Thin HTTP layer
 * Delegates all business logic to styleService
 */
import { Request, Response } from 'express';
import { styleService } from '../services/style.service';
import { logError, logInfo } from '../utils/logger';
import { ValidationError, ConflictError, NotFoundError } from '../errors';

/**
 * Create new style with components and processes
 * POST /api/styles
 */
export const createStyle = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || 'system';
    const style = await styleService.createWithRelations(req.body, userId);

    res.status(201).json({
      data: style,
      message: 'Style created successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to create style');
  }
};

/**
 * Get all styles with pagination and search
 * GET /api/styles
 */
export const getAllStyles = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const stage = req.query.stage as string;
    const customerName = req.query.customerName as string;
    const brandName = req.query.brandName as string;
    const season = req.query.season as string;
    const status = req.query.status as string;
    const cadStatus = req.query.cadStatus as string;

    const result = await styleService.findAllWithFilters({
      page,
      limit,
      search,
      stage,
      customerName,
      brandName,
      season,
      status,
      cadStatus,
    });

    res.status(200).json({
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch styles');
  }
};

/**
 * Get style by ID with all related data
 * GET /api/styles/:id
 */
export const getStyleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const style = await styleService.getFullDetails(id);

    // DEBUG: Log what we get from database
    console.log('=== STYLE FROM DB ===');
    console.log('brandName:', style.brandName);
    console.log('customerName:', style.customerName);
    console.log('brandCategoryId:', style.brandCategoryId);
    console.log('Keys:', Object.keys(style).slice(0, 30));

    // Transform response to include flattened fabrics for frontend compatibility
    // Frontend expects styleFabricsFlat array with componentName
    interface StyleFabric {
      id: string;
      componentId: string;
      fabricName?: string | null;
      fabricType?: string | null;
      genericFabricName?: string | null;
      fabricFinishType?: string | null;
      quantityNeeded?: number | null;
      notes?: string | null;
      hasEmbroidery?: boolean;
      embroideryId?: string | null;
      embroidery?: {
        id: string;
        embroideryCode: string;
        designName: string;
        designImage?: string | null;
        stitchCount?: number | null;
        threadColors?: number | null;
        usableWidthAfter?: number | null;
        costPerMeter?: number | null;
      } | null;
      usableWidth?: number | null;
      allowCombinedCutting?: boolean;
    }

    interface StyleComponent {
      id: string;
      componentName: string;
      componentType?: string | null;
      sortOrder?: number;
      style_fabrics: StyleFabric[];
    }

    const styleWithComponents = style as unknown as {
      style_components?: StyleComponent[];
    };

    const styleFabricsFlat = styleWithComponents.style_components?.flatMap(
      (comp: StyleComponent) =>
        comp.style_fabrics.map((fab: StyleFabric) => ({
          id: fab.id,
          componentId: fab.componentId,
          componentName: comp.componentName,
          genericFabricName: fab.genericFabricName || fab.fabricName,
          fabricFinishType: fab.fabricFinishType,
          estimatedConsumption: fab.quantityNeeded,
          unit: 'METER', // Default unit
          notes: fab.notes,
          hasEmbroidery: fab.hasEmbroidery || false,
          embroideryId: fab.embroideryId,
          embroidery: fab.embroidery,
          usableWidth: fab.usableWidth,
          allowCombinedCutting: fab.allowCombinedCutting !== false,
        }))
    ) || [];

    // Also flatten components for frontend compatibility - include fabrics for StyleDetail view
    const components = styleWithComponents.style_components?.map((comp: StyleComponent) => ({
      id: comp.id,
      componentName: comp.componentName,
      componentType: comp.componentType,
      sortOrder: comp.sortOrder,
      fabrics: comp.style_fabrics.map((fab: StyleFabric) => ({
        id: fab.id,
        fabricName: fab.genericFabricName || fab.fabricName,
        fabricType: fab.fabricFinishType,
        genericFabricName: fab.genericFabricName,
        fabricFinishType: fab.fabricFinishType,
        hasEmbroidery: fab.hasEmbroidery || false,
        embroideryId: fab.embroideryId,
        embroidery: fab.embroidery,
        fabricWidth: fab.usableWidth,
        cadAverageMeters: fab.quantityNeeded,
        unitPrice: null, // Not stored at fabric level
      })),
    })) || [];

    res.status(200).json({
      data: {
        ...style,
        styleFabricsFlat,
        components,
      },
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch style');
  }
};

/**
 * Update style
 * PUT /api/styles/:id
 */
export const updateStyle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    logInfo('Updating style', { id, bodyKeys: Object.keys(req.body) });

    // DEBUG: Log brand-related fields
    console.log('=== UPDATE STYLE REQUEST ===');
    console.log('brandName:', req.body.brandName);
    console.log('brandCategoryId:', req.body.brandCategoryId);
    console.log('category:', req.body.category);
    console.log('numberOfComponents:', req.body.numberOfComponents);

    const style = await styleService.updateWithRelations(id, req.body);

    res.status(200).json({
      data: style,
      message: 'Style updated successfully',
    });
  } catch (error) {
    logError('Style update failed', { id: req.params.id, error: (error as Error).message, stack: (error as Error).stack });
    handleError(res, error, 'Failed to update style');
  }
};

/**
 * Delete style (soft delete)
 * DELETE /api/styles/:id
 */
export const deleteStyle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await styleService.softDelete(id);

    res.status(200).json({
      message: 'Style deleted successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to delete style');
  }
};

/**
 * Permanently delete style (hard delete)
 * DELETE /api/styles/:id/permanent
 */
export const permanentDeleteStyle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await styleService.hardDelete(id);

    res.status(200).json({
      message: 'Style permanently deleted',
    });
  } catch (error) {
    handleError(res, error, 'Failed to permanently delete style');
  }
};

/**
 * Restore a soft-deleted style
 * POST /api/styles/:id/restore
 */
export const restoreStyle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const style = await styleService.restore(id);

    res.status(200).json({
      data: style,
      message: 'Style restored successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to restore style');
  }
};

/**
 * Get all deleted (archived) styles
 * GET /api/styles/deleted
 */
export const getDeletedStyles = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;

    const result = await styleService.findAllDeleted({ page, limit, search });

    res.status(200).json({
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch deleted styles');
  }
};

/**
 * Request with multer file upload
 */
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

/**
 * Upload style image
 * POST /api/styles/:id/image
 */
export const uploadStyleImage = async (req: MulterRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!req.file) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'No image file provided',
      });
      return;
    }

    const imageUrl = `/uploads/styles/${req.file.filename}`;
    const style = await styleService.updateImage(id, imageUrl);

    res.status(200).json({
      data: style,
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to upload image');
  }
};

/**
 * Create or update style variants
 * POST /api/styles/:id/variants
 */
export const createStyleVariants = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: styleId } = req.params;
    const { variants } = req.body;

    const createdVariants = await styleService.upsertVariants(styleId, variants);

    res.status(201).json({
      data: createdVariants,
      message: `Successfully created/updated ${createdVariants.length} variant(s)`,
    });
  } catch (error) {
    handleError(res, error, 'Failed to create variants');
  }
};

/**
 * Get all draft styles
 * GET /api/styles/drafts
 */
export const getAllDrafts = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await styleService.findAllDrafts({ page, limit });

    res.status(200).json({
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch drafts');
  }
};

/**
 * Get a single draft by ID
 * GET /api/styles/drafts/:id
 */
export const getDraftById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const draft = await styleService.findDraftById(id);

    res.status(200).json({ data: draft });
  } catch (error) {
    handleError(res, error, 'Failed to fetch draft');
  }
};

/**
 * Delete a draft
 * DELETE /api/styles/drafts/:id
 */
export const deleteDraft = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Verify it's a draft before deleting
    await styleService.findDraftById(id);
    await styleService.softDelete(id);

    res.status(200).json({
      message: 'Draft deleted successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to delete draft');
  }
};

/**
 * Publish a draft (convert to ACTIVE status)
 * POST /api/styles/:id/publish
 */
export const publishDraft = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const publishedStyle = await styleService.publishDraft(id);

    res.status(200).json({
      data: publishedStyle,
      message: 'Style published successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to publish draft');
  }
};

/**
 * Get CAD planning data for a style
 * GET /api/styles/:id/cad-planning
 */
export const getStyleCADPlanning = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: styleId } = req.params;
    const cadPlanningData = await styleService.getCADPlanning(styleId);

    res.status(200).json({
      data: cadPlanningData,
      message: 'CAD planning data retrieved successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve CAD planning data');
  }
};

/**
 * Update CAD grouping for style fabrics
 * POST /api/styles/:id/cad-groups
 */
export const updateCADGrouping = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: styleId } = req.params;
    const { fabricGroups } = req.body;

    await styleService.updateCADGrouping(styleId, fabricGroups);

    res.status(200).json({ message: 'CAD grouping updated successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to update CAD grouping');
  }
};

/**
 * Approve CAD plan and link fabrics to selected CAD entries
 * PUT /api/styles/:id/approve-cad
 */
export const approveCADPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: styleId } = req.params;
    const { fabricCADMappings } = req.body;

    const updatedStyle = await styleService.approveCADPlan(styleId, fabricCADMappings);

    res.status(200).json({
      data: updatedStyle,
      message: 'CAD plan approved successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to approve CAD plan');
  }
};

/**
 * Check if style can be deactivated
 * GET /api/styles/:id/can-deactivate
 */
export const canDeactivateStyle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const validation = await styleService.validateDeactivation(id);

    const message = validation.canDeactivate
      ? 'Style can be deactivated'
      : `Cannot deactivate. Please resolve: ${validation.blockers.map((b) => `${b.count} ${b.type}`).join(', ')}`;

    res.status(200).json({
      canDeactivate: validation.canDeactivate,
      blockers: validation.blockers,
      message,
    });
  } catch (error) {
    handleError(res, error, 'Failed to check deactivation status');
  }
};

/**
 * Centralized error handler for controller
 */
function handleError(res: Response, error: unknown, defaultMessage: string): void {
  if (error instanceof ValidationError) {
    res.status(400).json({
      error: 'Validation Error',
      message: error.message,
    });
    return;
  }

  if (error instanceof ConflictError) {
    res.status(409).json({
      error: 'Conflict',
      message: error.message,
    });
    return;
  }

  if (error instanceof NotFoundError) {
    res.status(404).json({
      error: 'Not Found',
      message: error.message,
    });
    return;
  }

  logError(defaultMessage, error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: defaultMessage,
    details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
  });
}
