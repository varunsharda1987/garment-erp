import { Request, Response } from 'express';
import {
  createChallan,
  issueChallan,
  getChallanById,
  getChallans,
  receiveChallan,
  cancelChallan,
  getChallanStats,
  createGreigeOutwardChallan,
} from '../services/challan.service';
import { resolveRate } from '../services/po-rate-resolver.service';

/**
 * POST /api/challans
 */
export async function createChallanController(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const challan = await createChallan({
      ...req.body,
      issuedById: userId,
    });

    return res.status(201).json({
      success: true,
      data: challan,
    });
  } catch (error: any) {
    console.error('Error creating challan:', error);
    return res.status(500).json({ error: error.message || 'Failed to create challan' });
  }
}

/**
 * PUT /api/challans/:id/issue
 */
export async function issueChallanController(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    const challan = await issueChallan(req.params.id, userId);
    return res.json({ success: true, data: challan });
  } catch (error: any) {
    console.error('Error issuing challan:', error);
    return res.status(500).json({ error: error.message || 'Failed to issue challan' });
  }
}

/**
 * GET /api/challans/:id
 */
export async function getChallanByIdController(req: Request, res: Response) {
  try {
    const challan = await getChallanById(req.params.id);
    if (!challan) {
      return res.status(404).json({ error: 'Challan not found' });
    }
    return res.json({ success: true, data: challan });
  } catch (error: any) {
    console.error('Error fetching challan:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch challan' });
  }
}

/**
 * GET /api/challans
 */
export async function getChallansController(req: Request, res: Response) {
  try {
    const {
      challanType,
      status,
      orderId,
      productionRunId,
      purchaseOrderId,
      fromDate,
      toDate,
      search,
      limit,
      offset,
    } = req.query;

    const result = await getChallans({
      challanType: challanType as any,
      status: status as any,
      orderId: orderId as string,
      productionRunId: productionRunId as string,
      purchaseOrderId: purchaseOrderId as string,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
      search: search as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    return res.json({
      success: true,
      data: result.challans,
      pagination: {
        total: result.total,
        limit: limit ? parseInt(limit as string, 10) : 50,
        offset: offset ? parseInt(offset as string, 10) : 0,
      },
    });
  } catch (error: any) {
    console.error('Error fetching challans:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch challans' });
  }
}

/**
 * PUT /api/challans/:id/receive
 */
export async function receiveChallanController(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const challan = await receiveChallan(req.params.id, {
      ...req.body,
      receivedById: userId,
    });

    return res.json({ success: true, data: challan });
  } catch (error: any) {
    console.error('Error receiving challan:', error);
    return res.status(500).json({ error: error.message || 'Failed to receive challan' });
  }
}

/**
 * PUT /api/challans/:id/cancel
 */
export async function cancelChallanController(req: Request, res: Response) {
  try {
    const challan = await cancelChallan(req.params.id);
    return res.json({ success: true, data: challan });
  } catch (error: any) {
    console.error('Error cancelling challan:', error);
    return res.status(500).json({ error: error.message || 'Failed to cancel challan' });
  }
}

/**
 * GET /api/challans/stats
 */
export async function getChallanStatsController(req: Request, res: Response) {
  try {
    const { orderId, productionRunId } = req.query;
    const stats = await getChallanStats({
      orderId: orderId as string,
      productionRunId: productionRunId as string,
    });
    return res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('Error fetching challan stats:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch challan stats' });
  }
}

/**
 * GET /api/po-rates/resolve
 */
export async function resolveRateController(req: Request, res: Response) {
  try {
    const {
      poCategory,
      styleId,
      supplierId,
      materialId,
      fabricId,
      laceId,
      serviceType,
      costSheetId,
    } = req.query;

    if (!poCategory) {
      return res.status(400).json({ error: 'poCategory is required' });
    }

    const result = await resolveRate({
      poCategory: poCategory as any,
      styleId: styleId as string,
      supplierId: supplierId as string,
      materialId: materialId as string,
      fabricId: fabricId as string,
      laceId: laceId as string,
      serviceType: serviceType as string,
      costSheetId: costSheetId as string,
    });

    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error resolving rate:', error);
    return res.status(500).json({ error: error.message || 'Failed to resolve rate' });
  }
}

/**
 * POST /api/challans/greige-outward
 */
export async function createGreigeOutwardChallanController(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { materialRequirementId, fabricProcessingId, orderId } = req.body;
    if (!materialRequirementId || !fabricProcessingId) {
      return res.status(400).json({
        error: 'materialRequirementId and fabricProcessingId are required',
      });
    }

    const challan = await createGreigeOutwardChallan({
      materialRequirementId,
      fabricProcessingId,
      orderId,
      userId,
    });

    return res.status(201).json({ success: true, data: challan });
  } catch (error: any) {
    console.error('Error creating greige outward challan:', error);
    return res.status(500).json({ error: error.message || 'Failed to create greige outward challan' });
  }
}

/**
 * POST /api/production-runs/:id/split
 */
export async function splitProductionRunController(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { splitProductionRun } = await import('../services/production-run-split.service');
    const result = await splitProductionRun(req.params.id, req.body.splits, userId);

    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error splitting production run:', error);
    return res.status(500).json({ error: error.message || 'Failed to split production run' });
  }
}
