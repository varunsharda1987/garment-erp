/**
 * Job Work Order Controller
 * Unified controller for all job work order operations
 *
 * This consolidates the previously separate dyeing/printing/embroidery flows
 * into a single API surface. The legacy controllers remain for backward
 * compatibility during the migration.
 */

import { Request, Response } from 'express';
import prisma from '../config/database';
import { jobWorkOrderService, JobWorkOrderError, JWO_ERROR_CODES } from '../services/job-work-order.service';
import { updateWosrReceivedQuantity } from '../services/work-order-service-requirement.service';
import logger from '../utils/logger';
import { generateJobWorkNumber } from '../utils/jobWorkNumber';
import { systemSettingsService } from '../services/system-settings.service';
import { createChallan } from '../services/challan.service';
import greigeStockService from '../services/greige-stock.service';
import { Unit, Prisma } from '@prisma/client';
import {
  ensureMaterialRecord,
  syncMasterToMaterials,
  syncStockLevelQuantity,
} from '../services/helpers/material-sync.helper';
import { multiplyCurrency, roundToCent } from '../utils/currency';
import type { CreateJobWorkOrderInput, AddJwoComponentInput, CloseJwoInput } from '../schemas/jobWorkOrder.schema';

// jwoStatus values from which material has NOT yet been issued (components may change)
const PRE_ISSUE_JWO_STATUSES = [null, 'DRAFT', 'PENDING_APPROVAL', 'APPROVED'] as const;
// Legacy statuses that mean the order is already received back (close allowed)
const RECEIVED_LEGACY_STATUSES = ['RECEIVED', 'QUALITY_CHECKED', 'STOCK_UPDATED'] as const;

// Standard includes for JWO queries
const jwoInclude = {
  processor: {
    // phone/contactPerson: prefill for the "Send via WhatsApp" recipient picker
    select: { id: true, name: true, code: true, phone: true, contactPerson: true },
  },
  style: {
    select: { id: true, styleCode: true, buyerStyleRef: true },
  },
  fabric: {
    select: { id: true, fabricCode: true, fabricName: true },
  },
  processTypeMaster: {
    select: { id: true, code: true, name: true, sacCode: true, gstRate: true, tolerancePercent: true },
  },
  components: {
    include: {
      greige: { select: { id: true, greigeCode: true, greigeName: true } },
      fabric: { select: { id: true, fabricCode: true, fabricName: true } },
      lace: { select: { id: true, laceCode: true, laceName: true } },
    },
    orderBy: { sortOrder: 'asc' as const },
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  approvedBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  // Greige identity for greige-processing jobs: the issued lot's master post-issue,
  // and the requirement→BOM chain before a lot exists (MRP drafts have fabricId null).
  greigeStockLot: {
    select: { id: true, greige: { select: { id: true, greigeCode: true, greigeName: true } } },
  },
  requirementLinks: {
    take: 1,
    select: {
      material_requirements: {
        select: {
          colorName: true,
          materials: { select: { name: true, code: true } },
          orderBomItem: { select: { greige: { select: { id: true, greigeCode: true, greigeName: true } } } },
        },
      },
    },
  },
};

class JobWorkOrderController {
  /**
   * POST /api/job-work-orders
   * Create a DRAFT job work order (Consolidation Phase 3 — the generic create surface).
   *
   * DYEING/PRINTING can also be created here, but the greige-stock-backed flow with a
   * paired PO lives in the dyeing/printing process-PO pages; this endpoint targets the
   * service process types (EMBROIDERY, WASHING, KAAJ_BUTTON, ...) that previously had
   * NO creation path at all (BH-0221).
   */
  async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const body = req.body as CreateJobWorkOrderInput;

      // Validate processor + optional style, and resolve the process type master
      const [processor, style, processTypeMaster] = await Promise.all([
        prisma.suppliers.findUnique({ where: { id: body.processorId }, select: { id: true, name: true } }),
        body.styleId
          ? prisma.styles.findUnique({ where: { id: body.styleId }, select: { id: true, styleCode: true } })
          : Promise.resolve(null),
        prisma.process_type_master.findUnique({ where: { code: body.processType } }),
      ]);

      if (!processor) {
        return res.status(404).json({ success: false, message: 'Processor (supplier) not found' });
      }
      if (body.styleId && !style) {
        return res.status(404).json({ success: false, message: 'Style not found' });
      }
      if (!processTypeMaster || !processTypeMaster.isActive) {
        return res.status(422).json({
          success: false,
          message: `Process type ${body.processType} is not configured in process_type_master. Seed it before creating JWOs.`,
        });
      }

      // Phase 5b: fabric-roll source lot (EMBROIDERY) — validate lot + derive fabric/width
      let fabricLot: { id: string; fabricId: string; finishedWidth: unknown; quantityAvailable: unknown } | null = null;
      if (body.fabricStockLotId) {
        fabricLot = await prisma.fabric_stock.findUnique({
          where: { id: body.fabricStockLotId },
          select: { id: true, fabricId: true, finishedWidth: true, quantityAvailable: true },
        });
        if (!fabricLot) {
          return res.status(404).json({ success: false, message: 'Fabric stock lot not found' });
        }
        if (Number(fabricLot.quantityAvailable) < body.quantity) {
          return res.status(422).json({
            success: false,
            message: `Insufficient fabric stock. Available: ${Number(fabricLot.quantityAvailable)}, Requested: ${body.quantity}`,
          });
        }
      }
      if (body.embroideryId) {
        const emb = await prisma.embroidery_master.findUnique({
          where: { id: body.embroideryId },
          select: { id: true },
        });
        if (!emb) {
          return res.status(404).json({ success: false, message: 'Embroidery design not found' });
        }
      }

      // KAAJ_BUTTON: resolve rates (explicit > system settings defaults)
      const isKaaj = body.processType === 'KAAJ_BUTTON';
      const buttonholeRate = isKaaj
        ? (body.buttonholeRatePerUnit ?? (await systemSettingsService.getNumber('KAAJ_BUTTONHOLE_RATE_PER_UNIT', 0.3)))
        : null;
      const buttonRate = isKaaj
        ? (body.buttonRatePerUnit ?? (await systemSettingsService.getNumber('KAAJ_BUTTON_RATE_PER_UNIT', 0.3)))
        : null;
      const kaajSubtotal = isKaaj
        ? (body.buttonholeCount ?? 0) * (buttonholeRate ?? 0) + (body.buttonCount ?? 0) * (buttonRate ?? 0)
        : null;

      const jobWorkNumber = await generateJobWorkNumber(body.processType, style?.styleCode || 'STK');

      const jwo = await prisma.job_work_orders.create({
        data: {
          jobWorkNumber,
          processType: body.processType,
          processTypeId: processTypeMaster.id,
          processorId: body.processorId,
          styleId: body.styleId ?? null,
          fabricId: body.fabricId ?? fabricLot?.fabricId ?? null,
          fabricType: body.fabricStockLotId
            ? 'FINISHED'
            : processTypeMaster.processCategory === 'FABRIC'
              ? 'GREIGE'
              : null,
          fabricStockLotId: body.fabricStockLotId ?? null,
          embroideryId: body.embroideryId ?? null,
          sentWidthInches: fabricLot ? Number(fabricLot.finishedWidth) : null,
          qtySentMeters: body.quantity,
          // Fabric-lot JWOs are meters (consume a roll, receive via the MTR-only GRN path)
          // even when the process master's default unit is PCS (e.g. EMBROIDERY pieces)
          uom: body.uom || (body.fabricStockLotId ? 'MTR' : processTypeMaster.unitOfMeasure),
          agreedRatePerMeter: isKaaj ? 0 : body.agreedRate,
          isRateTbd: isKaaj ? false : body.isRateTbd,
          expectedReturnDate: body.expectedReturnDate ?? null,
          remarks: body.remarks ?? null,
          status: 'READY_TO_SEND', // legacy status keeps existing send/receive flows working
          jwoStatus: 'DRAFT', // universal status per service-rules
          buttonholeCount: isKaaj ? (body.buttonholeCount ?? 0) : null,
          buttonCount: isKaaj ? (body.buttonCount ?? 0) : null,
          buttonholeRatePerUnit: buttonholeRate,
          buttonRatePerUnit: buttonRate,
          createdById: userId,
        },
      });

      // Commercial totals. KAAJ subtotal comes from the two-operation formula (qty × rate
      // does not apply); everything else uses the shared computeCommercialTotals.
      // R1: an unresolved GST rate leaves totals null with a warning — creation itself is
      // allowed (DRAFT), document generation is what R1 blocks.
      let warning: string | undefined;
      try {
        if (isKaaj && kaajSubtotal != null) {
          const gstRate = processTypeMaster.gstRate ? Number(processTypeMaster.gstRate) : null;
          if (gstRate === null) {
            throw new JobWorkOrderError(
              JWO_ERROR_CODES.GST_RATE_UNRESOLVED,
              `GST rate unresolved for ${body.processType}`
            );
          }
          const gst = await jobWorkOrderService.calculateGST(body.processorId, kaajSubtotal, gstRate);
          await prisma.job_work_orders.update({
            where: { id: jwo.id },
            data: {
              subtotal: gst.subtotal.toNumber(),
              gstRate: gst.gstRate.toNumber(),
              cgstAmount: gst.cgstAmount.toNumber(),
              sgstAmount: gst.sgstAmount.toNumber(),
              igstAmount: gst.igstAmount.toNumber(),
              totalTaxAmount: gst.totalTaxAmount.toNumber(),
              totalAmount: gst.totalAmount.toNumber(),
              isInterstate: gst.isInterstate,
            },
          });
        } else {
          await jobWorkOrderService.computeCommercialTotals(jwo.id);
        }
      } catch (error) {
        if (error instanceof JobWorkOrderError && error.code === JWO_ERROR_CODES.GST_RATE_UNRESOLVED) {
          warning = `Created as DRAFT, but GST rate for ${body.processType} is unresolved — commercial totals are pending until the rate is confirmed in Process Type Master.`;
          logger.warn(`[JWO] ${warning} (${jobWorkNumber})`);
        } else {
          throw error;
        }
      }

      const full = await prisma.job_work_orders.findUnique({ where: { id: jwo.id }, include: jwoInclude });

      logger.info(`[JWO] Created ${jobWorkNumber} (${body.processType}) for processor ${processor.name}`);
      return res.status(201).json({ success: true, data: full, warning });
    } catch (error) {
      logger.error('Error creating job work order:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create job work order',
      });
    }
  }

  /**
   * POST /api/job-work-orders/:id/components
   * Add an issued-material line (pre-issue only). Enforces R6: stock originally
   * purchased FROM the same processor cannot be issued back as a component.
   */
  async addComponent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const body = req.body as AddJwoComponentInput;

      const jwo = await prisma.job_work_orders.findUnique({
        where: { id },
        select: { id: true, jobWorkNumber: true, processorId: true, jwoStatus: true, sentDate: true, status: true },
      });
      if (!jwo) {
        return res.status(404).json({ success: false, message: 'Job work order not found' });
      }
      const preIssue = !jwo.sentDate && (PRE_ISSUE_JWO_STATUSES as readonly (string | null)[]).includes(jwo.jwoStatus);
      if (!preIssue) {
        return res.status(422).json({
          success: false,
          code: 'COMPONENTS_LOCKED_AFTER_ISSUE',
          message: `Cannot modify components of ${jwo.jobWorkNumber} after material has been issued.`,
        });
      }

      // R6: purchased goods cannot enter a job work order. Greige stock carries its
      // original selling supplier — if that supplier IS this JWO's processor, the
      // "material" is something the processor sold us, which belongs on a separate PO.
      if (body.greigeStockId) {
        const lot = await prisma.greige_stock.findUnique({
          where: { id: body.greigeStockId },
          select: { id: true, supplierId: true },
        });
        if (!lot) {
          return res.status(404).json({ success: false, message: 'Greige stock lot not found' });
        }
        if (lot.supplierId && lot.supplierId === jwo.processorId) {
          return res.status(422).json({
            success: false,
            code: 'PURCHASED_ITEM_AS_COMPONENT',
            message:
              'This greige lot was purchased from the same processor. Goods a job worker sells you belong on a separate purchase order, not as issued material (R6).',
          });
        }
      }

      const sortOrder = await prisma.job_work_order_components.count({ where: { jobWorkOrderId: id } });
      const component = await prisma.job_work_order_components.create({
        data: {
          jobWorkOrderId: id,
          materialType: body.materialType,
          greigeId: body.greigeId ?? null,
          fabricId: body.fabricId ?? null,
          laceId: body.laceId ?? null,
          greigeStockId: body.greigeStockId ?? null,
          fabricStockId: body.fabricStockId ?? null,
          laceStockId: body.laceStockId ?? null,
          qtySent: body.qtySent,
          unit: body.unit,
          rate: body.rate ?? null,
          isChargeable: body.isChargeable,
          isReturnable: body.isReturnable,
          componentName: body.componentName ?? null,
          colorName: body.colorName ?? null,
          description: body.description ?? null,
          sortOrder,
        },
        include: {
          greige: { select: { id: true, greigeCode: true, greigeName: true } },
          fabric: { select: { id: true, fabricCode: true, fabricName: true } },
          lace: { select: { id: true, laceCode: true, laceName: true } },
        },
      });

      logger.info(`[JWO] Component added to ${jwo.jobWorkNumber}: ${body.materialType} ${body.qtySent}${body.unit}`);
      return res.status(201).json({ success: true, data: component });
    } catch (error) {
      logger.error('Error adding JWO component:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add component',
      });
    }
  }

  /**
   * DELETE /api/job-work-orders/:id/components/:componentId
   * Remove a component (pre-issue only; blocked once challan lines reference it).
   */
  async removeComponent(req: Request, res: Response) {
    try {
      const { id, componentId } = req.params;

      const jwo = await prisma.job_work_orders.findUnique({
        where: { id },
        select: { id: true, jobWorkNumber: true, jwoStatus: true, sentDate: true },
      });
      if (!jwo) {
        return res.status(404).json({ success: false, message: 'Job work order not found' });
      }
      const preIssue = !jwo.sentDate && (PRE_ISSUE_JWO_STATUSES as readonly (string | null)[]).includes(jwo.jwoStatus);
      if (!preIssue) {
        return res.status(422).json({
          success: false,
          code: 'COMPONENTS_LOCKED_AFTER_ISSUE',
          message: `Cannot modify components of ${jwo.jobWorkNumber} after material has been issued.`,
        });
      }

      const component = await prisma.job_work_order_components.findFirst({
        where: { id: componentId, jobWorkOrderId: id },
        include: { _count: { select: { challanItems: true } } },
      });
      if (!component) {
        return res.status(404).json({ success: false, message: 'Component not found on this job work order' });
      }
      if (component._count.challanItems > 0) {
        return res.status(422).json({
          success: false,
          code: 'COMPONENT_HAS_CHALLAN_LINES',
          message: 'Component already appears on challan lines — reverse those first.',
        });
      }

      await prisma.job_work_order_components.delete({ where: { id: componentId } });
      return res.json({ success: true });
    } catch (error) {
      logger.error('Error removing JWO component:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to remove component',
      });
    }
  }

  /**
   * GET /api/job-work-orders/:id/reconciliation
   * Computed reconciliation per D5 — balances are derived from challan lines,
   * never stored. Falls back to the order-level quantity snapshot for legacy
   * JWOs with no components/challan attribution.
   */
  async getReconciliation(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const jwo = await prisma.job_work_orders.findUnique({
        where: { id },
        include: {
          processTypeMaster: { select: { code: true, tolerancePercent: true } },
          components: {
            include: {
              greige: { select: { greigeCode: true, greigeName: true } },
              fabric: { select: { fabricCode: true, fabricName: true } },
              lace: { select: { laceCode: true, laceName: true } },
              challanItems: {
                select: {
                  quantity: true,
                  challan: { select: { challanType: true, status: true, challanNumber: true } },
                },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
      if (!jwo) {
        return res.status(404).json({ success: false, message: 'Job work order not found' });
      }

      const sumLines = (
        items: Array<{ quantity: unknown; challan: { challanType: string; status: string } }>,
        type: 'OUTWARD' | 'INWARD'
      ) =>
        items
          .filter((i) => i.challan.challanType === type && i.challan.status !== 'CANCELLED')
          .reduce((s, i) => s + Number(i.quantity), 0);

      let components: Array<Record<string, unknown>> = [];
      let source: 'COMPONENTS' | 'ORDER_CHALLANS' | 'ORDER_SNAPSHOT' = 'COMPONENTS';

      if (jwo.components.length > 0) {
        components = jwo.components.map((c) => {
          const outward = sumLines(c.challanItems, 'OUTWARD');
          const inward = sumLines(c.challanItems, 'INWARD');
          return {
            id: c.id,
            materialType: c.materialType,
            name:
              c.componentName ||
              c.greige?.greigeName ||
              c.fabric?.fabricName ||
              c.lace?.laceName ||
              c.description ||
              c.materialType,
            unit: c.unit,
            qtySent: Number(c.qtySent),
            outward,
            inward,
            balanceWithVendor: outward - inward, // D5: computed, never stored
            qtyReceived: c.qtyReceived != null ? Number(c.qtyReceived) : null,
            qtyNormalLoss: c.qtyNormalLoss != null ? Number(c.qtyNormalLoss) : null,
            qtyAbnormalLoss: c.qtyAbnormalLoss != null ? Number(c.qtyAbnormalLoss) : null,
            isChargeable: c.isChargeable,
            isReturnable: c.isReturnable,
          };
        });
      } else {
        // Legacy: line-level order attribution on challan items, else the order snapshot
        const orderLines = await prisma.challan_items.findMany({
          where: { jobWorkOrderId: id },
          select: { quantity: true, challan: { select: { challanType: true, status: true, challanNumber: true } } },
        });
        if (orderLines.length > 0) {
          source = 'ORDER_CHALLANS';
          const outward = sumLines(orderLines, 'OUTWARD');
          const inward = sumLines(orderLines, 'INWARD');
          components = [
            {
              id: null,
              materialType: jwo.fabricType || 'FABRIC',
              name: 'Order total (challan lines)',
              unit: jwo.uom,
              qtySent: Number(jwo.qtySentMeters),
              outward,
              inward,
              balanceWithVendor: outward - inward,
              qtyReceived: jwo.qtyReceivedMeters != null ? Number(jwo.qtyReceivedMeters) : null,
              qtyNormalLoss: jwo.qtyNormalLoss != null ? Number(jwo.qtyNormalLoss) : null,
              qtyAbnormalLoss: jwo.qtyAbnormalLoss != null ? Number(jwo.qtyAbnormalLoss) : null,
              isChargeable: true,
              isReturnable: true,
            },
          ];
        } else {
          source = 'ORDER_SNAPSHOT';
          const sent = Number(jwo.qtySentMeters);
          const received = jwo.qtyReceivedMeters != null ? Number(jwo.qtyReceivedMeters) : 0;
          components = [
            {
              id: null,
              materialType: jwo.fabricType || 'FABRIC',
              name: 'Order total (snapshot)',
              unit: jwo.uom,
              qtySent: sent,
              outward: jwo.sentDate ? sent : 0,
              inward: received,
              balanceWithVendor: (jwo.sentDate ? sent : 0) - received,
              qtyReceived: jwo.qtyReceivedMeters != null ? received : null,
              qtyNormalLoss: jwo.qtyNormalLoss != null ? Number(jwo.qtyNormalLoss) : null,
              qtyAbnormalLoss: jwo.qtyAbnormalLoss != null ? Number(jwo.qtyAbnormalLoss) : null,
              isChargeable: true,
              isReturnable: true,
            },
          ];
        }
      }

      const totals = components.reduce<{ outward: number; inward: number; balanceWithVendor: number }>(
        (t, c) => ({
          outward: t.outward + Number(c.outward),
          inward: t.inward + Number(c.inward),
          balanceWithVendor: t.balanceWithVendor + Number(c.balanceWithVendor),
        }),
        { outward: 0, inward: 0, balanceWithVendor: 0 }
      );

      return res.json({
        success: true,
        data: {
          jobWorkNumber: jwo.jobWorkNumber,
          status: jwo.status,
          jwoStatus: jwo.jwoStatus,
          tolerancePercent: jwo.processTypeMaster?.tolerancePercent
            ? Number(jwo.processTypeMaster.tolerancePercent)
            : null,
          source,
          components,
          totals,
        },
      });
    } catch (error) {
      logger.error('Error computing JWO reconciliation:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to compute reconciliation',
      });
    }
  }

  /**
   * POST /api/job-work-orders/:id/close
   * RECEIVED → CLOSED. Requires an invoice reference; abnormal loss requires a
   * debit note against the linked PO before closing.
   */
  async close(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const body = req.body as CloseJwoInput;

      const jwo = await prisma.job_work_orders.findUnique({ where: { id } });
      if (!jwo) {
        return res.status(404).json({ success: false, message: 'Job work order not found' });
      }
      if (jwo.jwoStatus === 'CLOSED') {
        return res.status(422).json({
          success: false,
          code: 'ALREADY_CLOSED',
          message: `${jwo.jobWorkNumber} is already closed.`,
        });
      }
      if (jwo.jwoStatus === 'CANCELLED') {
        return res.status(422).json({
          success: false,
          code: 'ORDER_CANCELLED',
          message: `${jwo.jobWorkNumber} is cancelled and cannot be closed.`,
        });
      }
      const isReceived =
        jwo.jwoStatus === 'RECEIVED' || (RECEIVED_LEGACY_STATUSES as readonly string[]).includes(jwo.status as string);
      if (!isReceived) {
        return res.status(422).json({
          success: false,
          code: 'NOT_RECEIVED',
          message: `${jwo.jobWorkNumber} has not been fully received back — receive the material before closing.`,
        });
      }

      const invoiceNumber = body.invoiceNumber || jwo.invoiceNumber;
      if (!invoiceNumber) {
        return res.status(422).json({
          success: false,
          code: 'INVOICE_REQUIRED',
          message: 'Closing requires the processor invoice number (invoice match).',
        });
      }

      // Abnormal loss must have its debit note before the order closes.
      // Phase 4a: a debit note linked to the JWO directly (jobWorkOrderId) satisfies the
      // gate too — so PO-less JWOs get real enforcement instead of a soft warning.
      const abnormalLoss = jwo.qtyAbnormalLoss != null ? Number(jwo.qtyAbnormalLoss) : 0;
      let warning: string | undefined;
      if (abnormalLoss > 0) {
        const debitNote = await prisma.debit_notes.findFirst({
          where: {
            status: { not: 'CANCELLED' },
            OR: [{ jobWorkOrderId: jwo.id }, ...(jwo.purchaseOrderId ? [{ poId: jwo.purchaseOrderId }] : [])],
          },
          select: { id: true, debitNoteNumber: true },
        });
        if (!debitNote) {
          if (jwo.purchaseOrderId) {
            return res.status(422).json({
              success: false,
              code: 'DEBIT_NOTE_REQUIRED',
              message: `${jwo.jobWorkNumber} has ${abnormalLoss} abnormal loss — raise a debit note against the linked PO or this JWO before closing.`,
            });
          }
          warning = `Closed with ${abnormalLoss} abnormal loss and no debit note — raise one against this JWO or recover through the processor's invoice.`;
        }
      }

      // Settlement on actuals (2026-08-17): the processor's final bill is for the fabric
      // meters actually delivered — re-anchor the billable qty to the received qty and
      // recompute the commercial totals before freezing the order. MTR fabric jobs only;
      // piece-based jobs settle at the agreed count.
      if (jwo.uom === 'MTR' && jwo.qtyReceivedMeters != null && Number(jwo.qtyReceivedMeters) > 0) {
        const receivedQty = Number(jwo.qtyReceivedMeters);
        const priorBillable = jwo.qtyBillable != null ? Number(jwo.qtyBillable) : null;
        if (priorBillable !== receivedQty) {
          await prisma.job_work_orders.update({ where: { id }, data: { qtyBillable: receivedQty } });
          try {
            await jobWorkOrderService.computeCommercialTotals(id);
          } catch (error) {
            if (error instanceof JobWorkOrderError && error.code === JWO_ERROR_CODES.GST_RATE_UNRESOLVED) {
              await prisma.job_work_orders.update({
                where: { id },
                data: { subtotal: roundToCent(multiplyCurrency(receivedQty, jwo.agreedRatePerMeter)).toNumber() },
              });
            } else {
              throw error;
            }
          }
          logger.info(
            `[JWO] ${jwo.jobWorkNumber} settled on actual received ${receivedQty} MTR` +
              (priorBillable != null ? ` (estimate was ${priorBillable})` : '')
          );
        }
      }

      const updated = await prisma.job_work_orders.update({
        where: { id },
        data: {
          jwoStatus: 'CLOSED',
          invoiceNumber,
          remarks: body.remarks ? `${jwo.remarks || ''}\n[Close] ${body.remarks}`.trim() : jwo.remarks,
        },
        include: jwoInclude,
      });

      logger.info(`[JWO] Closed ${jwo.jobWorkNumber} (invoice ${invoiceNumber})`);
      return res.json({ success: true, data: updated, warning });
    } catch (error) {
      logger.error('Error closing JWO:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to close job work order',
      });
    }
  }

  /**
   * GET /api/job-work-orders/receivable
   * Phase 4b: PO-less JWOs that can be received via GRN (material out, nothing back yet).
   * PO-backed JWOs are excluded — those are received through the PO GRN flow.
   */
  async getReceivable(_req: Request, res: Response) {
    try {
      const jwos = await prisma.job_work_orders.findMany({
        where: {
          isActive: true,
          purchaseOrderId: null,
          receivedDate: null,
          status: { in: ['AT_MILL', 'SENT_TO_MILL'] },
          // Phase 5a (D6): GRN receiving is fabric/meters-only; PCS job work is
          // received on the JWO itself (POST /:id/receive)
          uom: 'MTR',
        },
        select: {
          id: true,
          jobWorkNumber: true,
          processType: true,
          qtySentMeters: true,
          // Expected fabric due back (billable basis) — what the GRN measures against
          qtyBillable: true,
          expectedShrinkage: true,
          uom: true,
          sentDate: true,
          expectedReturnDate: true,
          processor: { select: { id: true, name: true } },
          style: { select: { id: true, styleCode: true } },
          fabric: { select: { id: true, fabricCode: true, fabricName: true } },
        },
        orderBy: { sentDate: 'desc' },
      });
      return res.json({ success: true, data: jwos });
    } catch (error) {
      logger.error('Error fetching receivable JWOs:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch receivable job work orders',
      });
    }
  }

  /**
   * GET /api/job-work-orders
   * List all job work orders with filtering
   */
  async getAll(req: Request, res: Response) {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        status,
        jwoStatus,
        processType,
        processorId,
        workOrderId,
        fromDate,
        toDate,
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const where: any = { isActive: true };

      if (search) {
        where.OR = [
          { jobWorkNumber: { contains: search as string, mode: 'insensitive' } },
          { processor: { name: { contains: search as string, mode: 'insensitive' } } },
          { style: { styleCode: { contains: search as string, mode: 'insensitive' } } },
        ];
      }

      if (status) where.status = status;
      if (jwoStatus) where.jwoStatus = jwoStatus;
      if (processType) where.processType = processType;
      if (processorId) where.processorId = processorId;
      if (workOrderId) where.workOrderId = workOrderId; // Phase 5b: send-out pages scope by WO

      if (fromDate || toDate) {
        where.createdAt = {};
        if (fromDate) where.createdAt.gte = new Date(fromDate as string);
        if (toDate) where.createdAt.lte = new Date(toDate as string);
      }

      const [data, total] = await Promise.all([
        prisma.job_work_orders.findMany({
          where,
          include: jwoInclude,
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.job_work_orders.count({ where }),
      ]);

      res.json({
        success: true,
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      logger.error('Error fetching job work orders:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch job work orders',
      });
    }
  }

  /**
   * GET /api/job-work-orders/:id
   * Get single job work order by ID
   */
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const jwo = await prisma.job_work_orders.findUnique({
        where: { id },
        include: {
          ...jwoInclude,
          outwardChallan: {
            include: { items: true },
          },
          inwardChallan: {
            include: { items: true },
          },
          challanItems: true,
        },
      });

      if (!jwo) {
        return res.status(404).json({
          success: false,
          message: `Job work order ${id} not found`,
        });
      }

      res.json({ success: true, data: jwo });
    } catch (error) {
      logger.error('Error fetching job work order:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch job work order',
      });
    }
  }

  /**
   * POST /api/job-work-orders/:id/compute-totals
   * Compute commercial totals (GST, subtotal, total)
   *
   * @throws 422 if GST rate is unresolved (R1)
   */
  async computeTotals(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const updated = await jobWorkOrderService.computeCommercialTotals(id);

      res.json({
        success: true,
        data: updated,
        message: 'Commercial totals computed successfully',
      });
    } catch (error) {
      if (error instanceof JobWorkOrderError) {
        return res.status(422).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      logger.error('Error computing JWO totals:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to compute totals',
      });
    }
  }

  /**
   * POST /api/job-work-orders/:id/issue
   * Phase 4c: OPERATIONAL issue — consume the greige lot (when given), create the
   * OUTWARD challan, set legacy + universal statuses, lock the statutory due date
   * (R2) and compute totals. Per R1, an unresolved GST rate does NOT block issue
   * (documents are what R1 blocks) — totals stay pending with a warning.
   */
  async issue(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { sentDate, greigeStockLotId, fabricStockLotId, challanNumber, vehicleNumber } = req.body;
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const jwo = await prisma.job_work_orders.findUnique({
        where: { id },
        include: {
          processor: { select: { id: true, name: true } },
          style: { select: { styleCode: true, buyerStyleRef: true } },
        },
      });
      if (!jwo) {
        return res.status(404).json({ success: false, message: 'Job work order not found' });
      }
      if (jwo.sentDate) {
        return res.status(422).json({
          success: false,
          code: 'ALREADY_ISSUED',
          message: `${jwo.jobWorkNumber} was already issued on ${jwo.sentDate.toISOString().slice(0, 10)}.`,
        });
      }

      const issueDate = sentDate ? new Date(sentDate) : new Date();
      const lotId: string | null = greigeStockLotId || jwo.greigeStockLotId || null;
      // Phase 5b: fabric-roll source (EMBROIDERY) — consumed only when no greige lot is in play
      const fabricLotId: string | null = !lotId ? fabricStockLotId || jwo.fabricStockLotId || null : null;

      // Greige consumption — validate availability before touching anything
      let issuedGreigeWidth: number | null = null;
      if (lotId) {
        const lot = await prisma.greige_stock.findUnique({ where: { id: lotId } });
        if (!lot) {
          return res.status(404).json({ success: false, message: 'Greige stock lot not found' });
        }
        if (Number(lot.quantityAvailable) < Number(jwo.qtySentMeters)) {
          return res.status(422).json({
            success: false,
            code: 'INSUFFICIENT_GREIGE',
            message: `Insufficient greige stock: ${Number(lot.quantityAvailable)}m available, ${Number(jwo.qtySentMeters)}m needed.`,
          });
        }
        // The lot's loom width — stamped onto the JWO below when creation didn't set it
        issuedGreigeWidth = lot.greigeWidth != null ? Number(lot.greigeWidth) : null;
        await greigeStockService.consumeGreigeStock(lotId, Number(jwo.qtySentMeters), userId);
      } else if (fabricLotId) {
        // Phase 5b fabric-lot issue (mirrors the retired embroidery-stock send-out, but the
        // decrement + ledger + challan now share one atomic path)
        const qty = Number(jwo.qtySentMeters);
        await prisma.$transaction(async (txClient) => {
          const deducted = await txClient.fabric_stock.updateMany({
            where: { id: fabricLotId, quantityAvailable: { gte: qty } },
            data: { quantityAvailable: { decrement: qty }, needsEmbroidery: false },
          });
          if (deducted.count === 0) {
            throw new JobWorkOrderError(
              'INSUFFICIENT_FABRIC_STOCK',
              `Insufficient fabric stock in the selected lot for ${qty}m`
            );
          }
          const lotRow = await txClient.fabric_stock.findUnique({
            where: { id: fabricLotId },
            select: { fabricId: true, warehouseId: true, weightedAvgCost: true, quantityAvailable: true },
          });
          const wac = Number(lotRow?.weightedAvgCost ?? 0);
          const balanceAfter = Number(lotRow?.quantityAvailable ?? 0);
          await txClient.fabric_stock_transaction.create({
            data: {
              stockId: fabricLotId,
              transactionType: 'EMBROIDERY_SEND_OUT',
              quantity: new Prisma.Decimal(qty),
              referenceType: 'JOB_WORK_ORDER',
              referenceId: jwo.id,
              costPerUnit: new Prisma.Decimal(wac),
              weightedAvgCost: new Prisma.Decimal(wac),
              totalValue: new Prisma.Decimal(qty * wac),
              balanceAfter: new Prisma.Decimal(balanceAfter),
              valueAfter: new Prisma.Decimal(balanceAfter * wac),
              notes: `Issued for ${jwo.processType} — ${jwo.jobWorkNumber}`,
              createdById: userId,
            },
          });
          if (lotRow?.fabricId) {
            const materialId = await ensureMaterialRecord(lotRow.fabricId, 'FABRIC');
            await syncStockLevelQuantity(materialId, -qty, lotRow.warehouseId ?? undefined, 'METER', txClient);
          }
        });
      }

      // R2: statutory due date (immutable once set)
      await jobWorkOrderService.setStatutoryDueDate(id, issueDate);

      // Commercial totals — R1 blocks documents, not issue
      let warning: string | undefined;
      try {
        await jobWorkOrderService.computeCommercialTotals(id);
      } catch (error) {
        if (error instanceof JobWorkOrderError && error.code === JWO_ERROR_CODES.GST_RATE_UNRESOLVED) {
          warning = `Issued, but the GST rate for ${jwo.processType} is unresolved — commercial totals pending.`;
          logger.warn(`[JWO] ${warning} (${jwo.jobWorkNumber})`);
        } else {
          throw error;
        }
      }

      // OUTWARD challan (Rule 55 movement document)
      const isMeters = jwo.uom === 'MTR';
      const challan = await createChallan({
        challanType: 'OUTWARD',
        challanDate: issueDate,
        fromType: 'WAREHOUSE',
        fromName: 'Main Warehouse',
        toType: 'VENDOR',
        toId: jwo.processorId,
        toName: jwo.processor?.name || 'Processor',
        purchaseOrderId: jwo.purchaseOrderId || undefined,
        jobWorkOrderId: jwo.id,
        vehicleNumber: vehicleNumber || undefined,
        issuedById: userId,
        unit: isMeters ? Unit.METER : Unit.PIECE,
        remarks: challanNumber ? `Manual challan ref: ${challanNumber}` : undefined,
        items: [
          {
            itemType: lotId ? 'GREIGE' : 'FABRIC',
            fabricId: jwo.fabricId || undefined,
            greigeStockId: lotId || undefined,
            fabricStockId: fabricLotId || undefined,
            description: `${jwo.processType} job work — ${jwo.jobWorkNumber}${jwo.style?.styleCode ? ` (${jwo.style.styleCode})` : ''}`,
            quantity: Number(jwo.qtySentMeters),
            unit: isMeters ? Unit.METER : Unit.PIECE,
            jobWorkOrderId: jwo.id,
          },
        ],
      });

      const updated = await prisma.job_work_orders.update({
        where: { id },
        data: {
          status: 'SENT_TO_MILL', // legacy status — receiving paths key on this
          jwoStatus: 'ISSUED',
          sentDate: issueDate,
          challanNumber: challanNumber || challan.challanNumber,
          vehicleNumber: vehicleNumber || null,
          greigeStockLotId: lotId,
          fabricStockLotId: fabricLotId ?? jwo.fabricStockLotId,
          outwardChallanId: challan.id,
          // Actual lot width wins silence: fill only when creation didn't already set it
          ...(jwo.greigeWidthInches == null && issuedGreigeWidth != null
            ? { greigeWidthInches: issuedGreigeWidth }
            : {}),
        },
        include: jwoInclude,
      });

      logger.info(
        `[JWO] Issued ${jwo.jobWorkNumber} — challan ${challan.challanNumber}${lotId ? `, greige lot consumed (${Number(jwo.qtySentMeters)}m)` : ''}`
      );
      res.json({
        success: true,
        data: updated,
        warning,
        message: 'Job work order issued — outward challan created',
      });
    } catch (error) {
      if (error instanceof JobWorkOrderError) {
        return res.status(422).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      logger.error('Error issuing JWO:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to issue job work order',
      });
    }
  }

  /**
   * POST /api/job-work-orders/:id/cancel
   * Phase 5b: pre-receive cancellation. Reverses the issue (credits the source lot back,
   * restores needsEmbroidery for embroidery fabric lots), reverts linked requirements,
   * and sets jwoStatus CANCELLED (exits the MRP dedup guard).
   */
  async cancel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body as { reason?: string };
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const jwo = await prisma.job_work_orders.findUnique({ where: { id } });
      if (!jwo) {
        return res.status(404).json({ success: false, message: 'Job work order not found' });
      }
      if (jwo.jwoStatus === 'CANCELLED') {
        return res
          .status(422)
          .json({ success: false, code: 'ALREADY_CANCELLED', message: `${jwo.jobWorkNumber} is already cancelled` });
      }
      if (jwo.receivedDate || (RECEIVED_LEGACY_STATUSES as readonly string[]).includes(jwo.status)) {
        return res.status(422).json({
          success: false,
          code: 'ALREADY_RECEIVED',
          message: `${jwo.jobWorkNumber} has received material — use the receive/close flows instead of cancelling`,
        });
      }

      const updated = await prisma.$transaction(async (txClient) => {
        const qty = Number(jwo.qtySentMeters);

        // Reverse the issued material (only if the JWO was actually issued)
        if (jwo.sentDate) {
          if (jwo.greigeStockLotId) {
            await txClient.greige_stock.update({
              where: { id: jwo.greigeStockLotId },
              data: {
                quantityAvailable: { increment: qty },
                quantityConsumed: { decrement: qty },
                status: 'AVAILABLE',
              },
            });
          } else if (jwo.fabricStockLotId) {
            await txClient.fabric_stock.update({
              where: { id: jwo.fabricStockLotId },
              data: {
                quantityAvailable: { increment: qty },
                ...(jwo.processType === 'EMBROIDERY' ? { needsEmbroidery: true } : {}),
              },
            });
            const lotRow = await txClient.fabric_stock.findUnique({
              where: { id: jwo.fabricStockLotId },
              select: { fabricId: true, warehouseId: true, weightedAvgCost: true, quantityAvailable: true },
            });
            const wac = Number(lotRow?.weightedAvgCost ?? 0);
            const balanceAfter = Number(lotRow?.quantityAvailable ?? 0);
            await txClient.fabric_stock_transaction.create({
              data: {
                stockId: jwo.fabricStockLotId,
                transactionType: 'EMBROIDERY_CANCELLED',
                quantity: new Prisma.Decimal(qty),
                referenceType: 'JOB_WORK_ORDER',
                referenceId: jwo.id,
                costPerUnit: new Prisma.Decimal(wac),
                weightedAvgCost: new Prisma.Decimal(wac),
                totalValue: new Prisma.Decimal(qty * wac),
                balanceAfter: new Prisma.Decimal(balanceAfter),
                valueAfter: new Prisma.Decimal(balanceAfter * wac),
                notes: `Job work cancelled — ${jwo.jobWorkNumber}`,
                createdById: userId,
              },
            });
            if (lotRow?.fabricId) {
              const materialId = await ensureMaterialRecord(lotRow.fabricId, 'FABRIC');
              await syncStockLevelQuantity(materialId, qty, lotRow.warehouseId ?? undefined, 'METER', txClient);
            }
          }
        }

        // Revert linked requirements (only rows with nothing received yet)
        const wosrLinks = await txClient.service_requirement_jwo_links.findMany({
          where: { jobWorkOrderId: jwo.id },
          select: { serviceRequirementId: true, receivedQuantity: true },
        });
        const revertableWosr = wosrLinks
          .filter((l) => Number(l.receivedQuantity) === 0)
          .map((l) => l.serviceRequirementId);
        if (revertableWosr.length > 0) {
          await txClient.work_order_service_requirements.updateMany({
            where: { id: { in: revertableWosr }, status: { in: ['PO_GENERATED', 'IN_PROGRESS'] } },
            data: { status: 'PENDING', jobWorkOrderId: null },
          });
          await txClient.service_requirement_jwo_links.deleteMany({
            where: { jobWorkOrderId: jwo.id, serviceRequirementId: { in: revertableWosr } },
          });
        }
        const mrpLinks = await txClient.requirement_jwo_links.findMany({
          where: { jobWorkOrderId: jwo.id },
          select: { requirementId: true, receivedQuantity: true },
        });
        const revertableMrp = mrpLinks.filter((l) => Number(l.receivedQuantity) === 0).map((l) => l.requirementId);
        if (revertableMrp.length > 0) {
          await txClient.material_requirements.updateMany({
            where: { id: { in: revertableMrp }, status: 'PO_GENERATED' },
            data: { status: 'PO_REQUIRED' },
          });
          await txClient.requirement_jwo_links.deleteMany({
            where: { jobWorkOrderId: jwo.id, requirementId: { in: revertableMrp } },
          });
        }

        // Fabric-naming hygiene: a master minted for THIS job with no stock and no other
        // JWO referencing it is an orphan catalog row — deactivate it (dedup self-heals:
        // a future JWO for the same identity mints/reuses cleanly).
        if (jwo.finishedFabricId) {
          const orphan = await txClient.fabric_master.findFirst({
            where: {
              id: jwo.finishedFabricId,
              source: { startsWith: 'AUTO' },
              isActive: true,
              fabricStock: { none: {} },
              finishedFromJobWork: { none: { id: { not: jwo.id } } },
            },
            select: { id: true },
          });
          if (orphan) {
            await txClient.fabric_master.update({ where: { id: orphan.id }, data: { isActive: false } });
            await txClient.style_fabrics.updateMany({
              where: { fabricId: orphan.id },
              data: { fabricId: null },
            });
            await syncMasterToMaterials(orphan.id, 'FABRIC', { isActive: false }, txClient);
            logger.info(`[JWO] Deactivated orphan auto-created fabric master ${orphan.id} on cancel`);
          }
        }

        return txClient.job_work_orders.update({
          where: { id },
          data: {
            jwoStatus: 'CANCELLED',
            remarks: `${jwo.remarks || ''}\n[CANCELLED] ${reason || 'No reason given'}`.trim(),
          },
          include: jwoInclude,
        });
      });

      logger.info(`[JWO] Cancelled ${jwo.jobWorkNumber}${jwo.sentDate ? ' (issued material credited back)' : ''}`);
      return res.json({ success: true, data: updated, message: `${jwo.jobWorkNumber} cancelled` });
    } catch (error) {
      logger.error('Error cancelling JWO:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to cancel job work order',
      });
    }
  }

  /**
   * POST /api/job-work-orders/:id/receive
   * Receive material back from processor with loss split
   */
  async receive(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { qtyReceived, receivedDate } = req.body;

      if (!qtyReceived || qtyReceived <= 0) {
        return res.status(400).json({
          success: false,
          message: 'qtyReceived must be a positive number',
        });
      }

      // Phase 5a (D6): fabric/meters job work must be received through GRN /jwo so the
      // fabric_stock lot gets created — this endpoint is the terminal for PCS services only.
      const existing = await prisma.job_work_orders.findUnique({
        where: { id },
        select: {
          uom: true,
          greigeStockLotId: true,
          _count: { select: { requirementLinks: true } },
        },
      });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Job work order not found' });
      }
      if (existing.uom === 'MTR' && (existing.greigeStockLotId || existing._count.requirementLinks > 0)) {
        return res.status(422).json({
          success: false,
          code: 'RECEIVE_VIA_GRN',
          message: 'Fabric job work is received through a GRN (Receive against Job Work Order) so stock gets created.',
        });
      }

      // One tx: loss split + status + service-requirement advance (Phase 5a single track)
      const updated = await prisma.$transaction(async (txClient) => {
        const lossSplit = await jobWorkOrderService.applyLossSplit(id, qtyReceived, txClient);

        await txClient.job_work_orders.update({
          where: { id },
          data: {
            receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
            jwoStatus: 'RECEIVED',
          },
        });

        await updateWosrReceivedQuantity(id, Number(qtyReceived), txClient);

        return lossSplit;
      });

      const jwo = await prisma.job_work_orders.findUnique({
        where: { id },
        include: jwoInclude,
      });

      res.json({
        success: true,
        data: jwo,
        lossSplit: {
          qtyNormalLoss: updated.qtyNormalLoss,
          qtyAbnormalLoss: updated.qtyAbnormalLoss,
          tolerancePercent: updated.tolerancePercent,
          actualShrinkage: updated.actualShrinkage,
        },
        message: 'Material received and loss split calculated',
      });
    } catch (error) {
      if (error instanceof JobWorkOrderError) {
        return res.status(422).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      logger.error('Error receiving JWO:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to receive material',
      });
    }
  }

  /**
   * POST /api/job-work-orders/:id/approve
   * Approve a job work order
   */
  async approve(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId || req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      const updated = await jobWorkOrderService.approve(id, userId);

      // Update status
      await prisma.job_work_orders.update({
        where: { id },
        data: { jwoStatus: 'APPROVED' },
      });

      const jwo = await prisma.job_work_orders.findUnique({
        where: { id },
        include: jwoInclude,
      });

      res.json({
        success: true,
        data: jwo,
        message: 'Job work order approved',
      });
    } catch (error) {
      logger.error('Error approving JWO:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to approve job work order',
      });
    }
  }

  /**
   * GET /api/job-work-orders/over-tolerance
   * Get all JWOs with abnormal loss (for debit note processing)
   */
  async getOverTolerance(req: Request, res: Response) {
    try {
      const orders = await jobWorkOrderService.getOverToleranceOrders();

      res.json({
        success: true,
        data: orders,
        count: orders.length,
      });
    } catch (error) {
      logger.error('Error fetching over-tolerance JWOs:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch over-tolerance orders',
      });
    }
  }

  /**
   * GET /api/job-work-orders/dashboard
   * Dashboard summary for job work orders
   */
  async getDashboard(req: Request, res: Response) {
    try {
      const today = new Date();

      // Count by status
      const statusCounts = await prisma.job_work_orders.groupBy({
        by: ['status'],
        where: { isActive: true },
        _count: { id: true },
      });

      // Count by process type
      const processTypeCounts = await prisma.job_work_orders.groupBy({
        by: ['processType'],
        where: { isActive: true },
        _count: { id: true },
      });

      // Outstanding at processors (not yet received)
      const outstanding = await prisma.job_work_orders.count({
        where: {
          isActive: true,
          sentDate: { not: null },
          receivedDate: null,
        },
      });

      // Section 143 warnings (approaching 1 year)
      const warningThreshold = new Date(today);
      warningThreshold.setDate(warningThreshold.getDate() - 270); // 270+ days out
      const warnings = await prisma.job_work_orders.count({
        where: {
          isActive: true,
          sentDate: { lte: warningThreshold },
          receivedDate: null,
        },
      });

      // Over tolerance (abnormal loss)
      const overTolerance = await prisma.job_work_orders.count({
        where: {
          isActive: true,
          qtyAbnormalLoss: { gt: 0 },
        },
      });

      res.json({
        success: true,
        data: {
          byStatus: Object.fromEntries(statusCounts.map((s) => [s.status, s._count.id])),
          byProcessType: Object.fromEntries(processTypeCounts.map((p) => [p.processType, p._count.id])),
          outstanding,
          section143Warnings: warnings,
          overTolerance,
        },
      });
    } catch (error) {
      logger.error('Error fetching JWO dashboard:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch dashboard',
      });
    }
  }
}

export const jobWorkOrderController = new JobWorkOrderController();
export default jobWorkOrderController;
