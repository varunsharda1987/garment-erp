/**
 * Style Controller - Thin HTTP layer
 * Delegates all business logic to styleService
 */
import { Request, Response } from 'express';
import { styleService } from '../services/style.service';
import { logInfo } from '../utils/logger';
import { ValidationError } from '../errors';

/**
 * Create new style with components and processes
 * POST /api/styles
 */
export const createStyle = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId || 'system';
  const style = await styleService.createWithRelations(req.body, userId);

  res.status(201).json({
    data: style,
    message: 'Style created successfully',
  });
};

/**
 * Get all styles with pagination and search
 * GET /api/styles
 */
export const getAllStyles = async (req: Request, res: Response): Promise<void> => {
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

  // Compute effectiveCadStatus: if APPROVED but no style_fabric has a linked CAD, revert to PENDING
  const stylesWithEffectiveStatus = result.data.map((style: any) => {
    const hasCadLinked = style.style_components?.some((c: any) =>
      c.style_fabrics?.some((sf: any) => sf.fabricCADId != null)
    );
    const effectiveCadStatus = style.cadStatus === 'APPROVED' && !hasCadLinked ? 'PENDING' : style.cadStatus;
    return { ...style, effectiveCadStatus };
  });

  res.status(200).json({
    data: stylesWithEffectiveStatus,
    pagination: result.pagination,
  });
};

/**
 * Get style by ID with all related data
 * GET /api/styles/:id
 */
export const getStyleById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const style = await styleService.getFullDetails(id);

  // Fetch approved fabric costing options for this style
  // This gives us the approved totalCostPerMeter (fabric rate) from fabric costing workflow
  const approvedCostingOptions = await styleService.getApprovedFabricCostingRates(id);

  // Create a map of styleFabricId -> approved costing data for quick lookup
  const approvedCostingMap = new Map<
    string,
    {
      totalCostPerMeter: number;
      cadMeters: number;
      cutableWidth: number;
    }
  >();

  for (const option of approvedCostingOptions) {
    if (option.styleFabricId && option.totalCostPerMeter) {
      // If multiple approved options exist for same styleFabricId, use the first one
      if (!approvedCostingMap.has(option.styleFabricId)) {
        approvedCostingMap.set(option.styleFabricId, {
          totalCostPerMeter: Number(option.totalCostPerMeter),
          cadMeters: option.cadMeters ? Number(option.cadMeters) : 0,
          cutableWidth: option.cutableWidth ? Number(option.cutableWidth) : 0,
        });
      }
    }
  }

  // Transform response to include flattened fabrics for frontend compatibility
  // Frontend expects styleFabricsFlat array with componentName
  interface StyleFabric {
    id: string;
    componentId: string;
    fabricId?: string | null;
    fabricName?: string | null;
    fabricType?: string | null;
    genericGreigeName?: string | null;
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
    fabric?: {
      id: string;
      fabricCode: string;
      fabricName: string;
      colorName?: string | null;
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

  const styleFabricsFlat =
    styleWithComponents.style_components?.flatMap((comp: StyleComponent) =>
      comp.style_fabrics.map((fab: StyleFabric) => ({
        id: fab.id,
        componentId: fab.componentId,
        componentName: comp.componentName,
        fabricId: fab.fabricId || null,
        fabric: fab.fabric || null,
        genericGreigeName: fab.genericGreigeName || (fab.fabricId ? null : fab.fabricName),
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
  // Now includes approved fabric costing rates if available
  const components =
    styleWithComponents.style_components?.map((comp: StyleComponent) => ({
      id: comp.id,
      componentName: comp.componentName,
      componentType: comp.componentType,
      sortOrder: comp.sortOrder,
      fabrics: comp.style_fabrics.map((fab: StyleFabric) => {
        // Look up approved costing data for this fabric
        const approvedCosting = approvedCostingMap.get(fab.id);

        return {
          id: fab.id,
          fabricName: fab.genericGreigeName || fab.fabricName || fab.fabric?.fabricName,
          fabricType: fab.fabricFinishType,
          genericGreigeName: fab.genericGreigeName,
          fabricFinishType: fab.fabricFinishType,
          hasEmbroidery: fab.hasEmbroidery || false,
          embroideryId: fab.embroideryId,
          embroidery: fab.embroidery,
          fabricWidth: approvedCosting?.cutableWidth || fab.usableWidth,
          cadAverageMeters: approvedCosting?.cadMeters || fab.quantityNeeded,
          // Use approved fabric costing rate if available
          unitPrice: approvedCosting?.totalCostPerMeter || null,
        };
      }),
    })) || [];

  res.status(200).json({
    data: {
      ...style,
      styleFabricsFlat,
      components,
    },
  });
};

/**
 * Update style
 * PUT /api/styles/:id
 */
export const updateStyle = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  logInfo('Updating style', { id, bodyKeys: Object.keys(req.body) });

  const style = await styleService.updateWithRelations(id, req.body);

  res.status(200).json({
    data: style,
    message: 'Style updated successfully',
  });
};

/**
 * Delete style (soft delete)
 * DELETE /api/styles/:id
 */
export const deleteStyle = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await styleService.softDelete(id);

  res.status(200).json({
    message: 'Style deleted successfully',
  });
};

/**
 * Permanently delete style (hard delete)
 * DELETE /api/styles/:id/permanent
 */
export const permanentDeleteStyle = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await styleService.hardDelete(id);

  res.status(200).json({
    message: 'Style permanently deleted',
  });
};

/**
 * Restore a soft-deleted style
 * POST /api/styles/:id/restore
 */
export const restoreStyle = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const style = await styleService.restore(id);

  res.status(200).json({
    data: style,
    message: 'Style restored successfully',
  });
};

/**
 * Get all deleted (archived) styles
 * GET /api/styles/deleted
 */
export const getDeletedStyles = async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string;

  const result = await styleService.findAllDeleted({ page, limit, search });

  res.status(200).json({
    data: result.data,
    pagination: result.pagination,
  });
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
  const { id } = req.params;

  if (!req.file) {
    throw new ValidationError('No image file provided');
  }

  const imageUrl = `/uploads/styles/${req.file.filename}`;
  const style = await styleService.updateImage(id, imageUrl);

  res.status(200).json({
    data: style,
    message: 'Image uploaded successfully',
  });
};

/**
 * Create or update style variants
 * POST /api/styles/:id/variants
 */
export const createStyleVariants = async (req: Request, res: Response): Promise<void> => {
  const { id: styleId } = req.params;
  const { variants } = req.body;

  const createdVariants = await styleService.upsertVariants(styleId, variants);

  res.status(201).json({
    data: createdVariants,
    message: `Successfully created/updated ${createdVariants.length} variant(s)`,
  });
};

/**
 * Get all draft styles
 * GET /api/styles/drafts
 */
export const getAllDrafts = async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  const result = await styleService.findAllDrafts({ page, limit });

  res.status(200).json({
    data: result.data,
    pagination: result.pagination,
  });
};

/**
 * Get a single draft by ID
 * GET /api/styles/drafts/:id
 */
export const getDraftById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const draft = await styleService.findDraftById(id);

  res.status(200).json({ data: draft });
};

/**
 * Delete a draft
 * DELETE /api/styles/drafts/:id
 */
export const deleteDraft = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  // Verify it's a draft before deleting
  await styleService.findDraftById(id);
  await styleService.softDelete(id);

  res.status(200).json({
    message: 'Draft deleted successfully',
  });
};

/**
 * Publish a draft (convert to ACTIVE status)
 * POST /api/styles/:id/publish
 */
export const publishDraft = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const publishedStyle = await styleService.publishDraft(id);

  res.status(200).json({
    data: publishedStyle,
    message: 'Style published successfully',
  });
};

/**
 * Get CAD planning data for a style
 * GET /api/styles/:id/cad-planning
 */
export const getStyleCADPlanning = async (req: Request, res: Response): Promise<void> => {
  const { id: styleId } = req.params;
  const cadPlanningData = await styleService.getCADPlanning(styleId);

  res.status(200).json({
    data: cadPlanningData,
    message: 'CAD planning data retrieved successfully',
  });
};

/**
 * Update CAD grouping for style fabrics
 * POST /api/styles/:id/cad-groups
 */
export const updateCADGrouping = async (req: Request, res: Response): Promise<void> => {
  const { id: styleId } = req.params;
  const { fabricGroups } = req.body;

  await styleService.updateCADGrouping(styleId, fabricGroups);

  res.status(200).json({ message: 'CAD grouping updated successfully' });
};

/**
 * Approve CAD plan and link fabrics to selected CAD entries
 * PUT /api/styles/:id/approve-cad
 */
export const approveCADPlan = async (req: Request, res: Response): Promise<void> => {
  // Support both :id (old style routes) and :styleId (new cad-planning routes)
  const styleId = req.params.styleId || req.params.id;
  const { fabricCADMappings } = req.body;

  if (!styleId) {
    throw new ValidationError('Style ID is required');
  }

  const updatedStyle = await styleService.approveCADPlan(styleId, fabricCADMappings);

  res.status(200).json({
    success: true,
    data: updatedStyle,
    message: 'CAD plan approved successfully',
    updated: fabricCADMappings?.length || 0,
  });
};

/**
 * Reject/Unapprove CAD plan - revert to PENDING status
 * PUT /api/cad-planning/:styleId/reject-cad
 */
export const rejectCADPlan = async (req: Request, res: Response): Promise<void> => {
  const styleId = req.params.styleId || req.params.id;

  if (!styleId) {
    throw new ValidationError('Style ID is required');
  }

  const updatedStyle = await styleService.rejectCADPlan(styleId);

  res.status(200).json({
    success: true,
    data: updatedStyle,
    message: 'CAD plan rejected. All rows reset to PENDING.',
  });
};

/**
 * Check if style can be deactivated
 * GET /api/styles/:id/can-deactivate
 */
export const canDeactivateStyle = async (req: Request, res: Response): Promise<void> => {
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
};
