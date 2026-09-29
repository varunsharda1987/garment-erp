import { Request, Response } from 'express';
import {
  createChallan,
  issueChallan,
  getChallanById,
  getChallans,
  receiveChallan,
  cancelChallan,
  getChallanStats,
  quickIssueChallan,
  getTodaySummary,
} from '../services/challan.service';
import { resolveRate } from '../services/po-rate-resolver.service';
import { buildChallanPackingList } from '../services/document-data/challan.doc-data';
import { transitStateOf } from '../services/helpers/transit-challan-state';
import { NotFoundError, ValidationError } from '../errors';
import type { CreateTransitChallanBody, IssueChallanBody, QuickIssueChallanInput } from '../schemas/challan.schema';
import { cancelTransitChallan, getTransitChallans, issueTransitChallan } from '../services/transit-challan.service';

/**
 * POST /api/challans
 */
export async function createChallanController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const challan = await createChallan({
    ...req.body,
    issuedById: userId,
  });

  return res.status(201).json({
    success: true,
    data: challan,
    message: 'Challan created successfully',
  });
}

/**
 * PUT /api/challans/:id/issue
 */
export async function issueChallanController(req: Request, res: Response) {
  const userId = req.user?.userId;
  // takeHeld: the user confirmed taking goods held for other orders (409 STOCK_HELD_FOR_ORDER otherwise)
  const { takeHeld } = req.body as IssueChallanBody;
  const challan = await issueChallan(req.params.id, userId, { takeHeld });
  return res.json({ success: true, data: challan });
}

/**
 * GET /api/challans/:id
 */
export async function getChallanByIdController(req: Request, res: Response) {
  const challan = await getChallanById(req.params.id);
  if (!challan) {
    throw new NotFoundError('Challan', req.params.id);
  }
  // The thans / bales / rolls it moved — the printed challan's packing list, from the same code
  const packingList = await buildChallanPackingList(challan.id);
  // Goods-in-transit challan: OPEN (on the way) / CLAIMED (receipt waiting for QC) / ADOPTED / CANCELLED, or null
  const transitState = transitStateOf(challan);
  return res.json({ success: true, data: { ...challan, packingList, transitState } });
}

/**
 * GET /api/challans
 */
export async function getChallansController(req: Request, res: Response) {
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
    itemType,
    processorId,
    todayOnly,
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
    itemType: itemType as string,
    processorId: processorId as string,
    todayOnly: todayOnly === 'true',
  });

  return res.json({
    success: true,
    data: result.challans,
    pagination: {
      total: result.total,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0, // legacy: frontend uses offset-based pagination
    },
  });
}

/**
 * GET /api/challans/today-summary
 * Returns today's outward challan summary grouped by processor (greige dept register)
 */
export async function getTodaySummaryController(_req: Request, res: Response) {
  const summary = await getTodaySummary();
  return res.json({ success: true, data: summary });
}

/**
 * PUT /api/challans/:id/receive
 */
export async function receiveChallanController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const challan = await receiveChallan(req.params.id, {
    ...req.body,
    receivedById: userId,
  });

  return res.json({ success: true, data: challan });
}

/**
 * PUT /api/challans/:id/cancel
 */
export async function cancelChallanController(req: Request, res: Response) {
  const challan = await cancelChallan(req.params.id);
  return res.json({ success: true, data: challan });
}

/**
 * POST /api/challans/goods-in-transit — our Rule 45 challan for goods a supplier despatched straight to a
 * processor, issued before they arrive (2026-09-29)
 */
export async function issueTransitChallanController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ValidationError('User not authenticated');
  const body = req.body as CreateTransitChallanBody;
  const challan = await issueTransitChallan({
    poId: body.poId,
    poDeliveryPointId: body.poDeliveryPointId ?? null,
    challanDate: body.challanDate ?? null,
    dispatchedOn: body.dispatchedOn,
    invoiceNumber: body.invoiceNumber ?? null,
    invoiceDate: body.invoiceDate ?? null,
    vehicleNumber: body.vehicleNumber ?? null,
    lrNumber: body.lrNumber ?? null,
    ewayBillNumber: body.ewayBillNumber ?? null,
    ewayBillDate: body.ewayBillDate ?? null,
    remarks: body.remarks ?? null,
    lines: body.lines.map((l) => ({
      poItemId: l.poItemId,
      quantity: l.quantity,
      foldLengthCm: l.foldLengthCm ?? null,
      entryMode: l.entryMode ?? null,
      pieces: (l.pieces ?? []).map((p) => ({
        detailType: p.detailType,
        baleNumber: p.baleNumber ?? null,
        sequenceNo: p.sequenceNo,
        meters: p.meters,
        baleNo: p.baleNo ?? null,
        thanNo: p.thanNo ?? null,
      })),
    })),
    userId,
  });
  return res.status(201).json({ success: true, data: challan, message: `Challan ${challan.challanNumber} issued` });
}

/** GET /api/challans/goods-in-transit?poId= */
export async function getTransitChallansController(req: Request, res: Response) {
  const data = await getTransitChallans(String(req.query.poId));
  return res.json({ success: true, data });
}

/** PATCH /api/challans/:id/cancel-transit — the truck never came, or the goods went elsewhere */
export async function cancelTransitChallanController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ValidationError('User not authenticated');
  const { reason } = req.body as { reason: string };
  const result = await cancelTransitChallan(req.params.id, userId, reason);
  return res.json({ success: true, data: result, message: `${result.challanNumber} cancelled` });
}

/**
 * GET /api/challans/stats
 */
export async function getChallanStatsController(req: Request, res: Response) {
  const { orderId, productionRunId } = req.query;
  const stats = await getChallanStats({
    orderId: orderId as string,
    productionRunId: productionRunId as string,
  });
  return res.json({ success: true, data: stats });
}

/**
 * POST /api/challans/quick-issue
 * Creates a challan and immediately issues it (stock deduction in one step)
 */
export async function quickIssueChallanController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const { takeHeld, ...body } = req.body as QuickIssueChallanInput;
  const challan = await quickIssueChallan({ ...body, issuedById: userId }, { takeHeld });

  return res.status(201).json({ success: true, data: challan, message: 'Challan issued successfully' });
}

/**
 * GET /api/po-rates/resolve
 */
export async function resolveRateController(req: Request, res: Response) {
  const {
    poCategory,
    styleId,
    supplierId,
    materialId,
    fabricId,
    greigeId,
    laceId,
    serviceType,
    costSheetId,
    quantityMeters,
  } = req.query;

  if (!poCategory) {
    throw new ValidationError('poCategory is required');
  }

  const parsedQuantity = quantityMeters != null ? Number(quantityMeters) : undefined;

  const result = await resolveRate({
    poCategory: poCategory as any,
    styleId: styleId as string,
    supplierId: supplierId as string,
    materialId: materialId as string,
    fabricId: fabricId as string,
    greigeId: greigeId as string,
    laceId: laceId as string,
    serviceType: serviceType as string,
    costSheetId: costSheetId as string,
    // PROCESSING needs greige + meters for a slab-aware rate; without them the resolver
    // reports 'Manual entry required' instead of quoting an arbitrary card.
    quantityMeters: parsedQuantity != null && Number.isFinite(parsedQuantity) ? parsedQuantity : undefined,
  });

  return res.json({ success: true, data: result });
}

/**
 * POST /api/production-runs/:id/split
 */
export async function splitProductionRunController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const { splitProductionRun } = await import('../services/production-run-split.service');
  const result = await splitProductionRun(req.params.id, req.body.splits, userId);

  return res.json({ success: true, data: result });
}
