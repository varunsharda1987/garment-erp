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
import {
  issueJobWorkOrder,
  issueJobWorkOrderWithDetails,
  validateIssue,
  unissueForCancel,
  dispatchJobWorkOrders,
} from '../services/job-work-issuance.service';
import greigeStockService from '../services/greige-stock.service';
import { Prisma } from '@prisma/client';
import {
  ensureMaterialRecord,
  syncMasterToMaterials,
  syncStockLevelQuantity,
} from '../services/helpers/material-sync.helper';
import {
  setJwoStatus,
  JWO_ACTIVE_FILTER,
  JWO_PRE_ISSUE_STATUSES,
  JWO_AT_PROCESSOR_STATUSES,
  JWO_RECEIVED_STATUSES,
} from '../services/helpers/jwo-status.helper';
import { applyShrinkageLoss, multiplyCurrency, roundToCent } from '../utils/currency';
import type {
  CreateJobWorkOrderInput,
  AddJwoComponentInput,
  CloseJwoInput,
  DispatchJwoInput,
} from '../schemas/jobWorkOrder.schema';

// Standard includes for JWO queries
const jwoInclude = {
  processor: {
    // phone/contactPerson: prefill for the "Send via WhatsApp" recipient picker
    select: { id: true, name: true, code: true, phone: true, contactPerson: true },
  },
  style: {
    select: { id: true, styleCode: true, buyerStyleRef: true },
  },
  // Shade asked on a stock (style-less) job — an order-linked job reads its colour off the
  // requirement chain below instead, so this is normally null.
  colorMaster: {
    select: { id: true, colorCode: true, colorName: true, hexCode: true },
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

      // Validate processor + optional style/colour, and resolve the process type master
      const [processor, style, processTypeMaster, colorMaster] = await Promise.all([
        prisma.suppliers.findUnique({ where: { id: body.processorId }, select: { id: true, name: true } }),
        body.styleId
          ? prisma.styles.findUnique({ where: { id: body.styleId }, select: { id: true, styleCode: true } })
          : Promise.resolve(null),
        prisma.process_type_master.findUnique({ where: { code: body.processType } }),
        body.colorMasterId
          ? prisma.color_master.findUnique({
              where: { id: body.colorMasterId },
              select: { id: true, colorName: true },
            })
          : Promise.resolve(null),
      ]);

      if (!processor) {
        return res.status(404).json({ success: false, message: 'Processor (supplier) not found' });
      }
      if (body.styleId && !style) {
        return res.status(404).json({ success: false, message: 'Style not found' });
      }
      if (body.colorMasterId && !colorMaster) {
        return res.status(404).json({ success: false, message: 'Colour not found in colour master' });
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
        ? (body.buttonholeRatePerUnit ??
          (await systemSettingsService.getNumberDefault('KAAJ_BUTTONHOLE_RATE_PER_UNIT')))
        : null;
      const buttonRate = isKaaj
        ? (body.buttonRatePerUnit ?? (await systemSettingsService.getNumberDefault('KAAJ_BUTTON_RATE_PER_UNIT')))
        : null;
      const kaajSubtotal = isKaaj
        ? (body.buttonholeCount ?? 0) * (buttonholeRate ?? 0) + (body.buttonCount ?? 0) * (buttonRate ?? 0)
        : null;

      // Expected fabric back. On an order-linked job this comes off the requirement chain; a
      // stock job has no chain, so the operator supplies the rate-card shrinkage and the
      // contracted output is derived from it here — ONCE, at creation, so the loss split at
      // receipt measures against a number that was agreed before the goods left.
      // Piece and service jobs have no shrinkage: qtyBillable stays null and billing falls
      // back to qtySentMeters, exactly as before.
      const isFabricProcess = processTypeMaster.processCategory === 'FABRIC';
      const expectedShrinkage = isFabricProcess ? (body.expectedShrinkage ?? null) : null;
      const qtyBillable =
        expectedShrinkage === null
          ? null
          : roundToCent(applyShrinkageLoss(body.quantity, expectedShrinkage)).toNumber();

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
          colorMasterId: colorMaster?.id ?? null,
          colorName: body.colorName?.trim() || colorMaster?.colorName || null,
          // A fabric lot's own finished width wins: it is a measurement of the very roll going
          // out, and a process like embroidery does not change it. The typed value only fills
          // the case where no lot exists (a greige job, where the width is a target, not a fact).
          sentWidthInches: fabricLot ? Number(fabricLot.finishedWidth) : (body.sentWidthInches ?? null),
          expectedShrinkage,
          qtyBillable,
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
      const preIssue = !jwo.sentDate && (JWO_PRE_ISSUE_STATUSES as readonly (string | null)[]).includes(jwo.jwoStatus);
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
      const preIssue = !jwo.sentDate && (JWO_PRE_ISSUE_STATUSES as readonly (string | null)[]).includes(jwo.jwoStatus);
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
      const isReceived = JWO_RECEIVED_STATUSES.includes(jwo.jwoStatus!);
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

      // allow-direct-jwo-status: CLOSED deliberately leaves the legacy mirror untouched
      // (the legacy chain is already terminal by close time — see jwo-status.helper mapping)
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
          jwoStatus: { in: JWO_AT_PROCESSOR_STATUSES },
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
      const {
        sentDate,
        greigeStockLotId,
        lots,
        fabricStockLotId,
        challanNumber,
        vehicleNumber,
        acknowledgeWidthMismatch,
      } = req.body;
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      // Consolidated issuance service: ONE atomic tx (mutex → challan → guarded consume →
      // components → reservation release → challan ISSUED → statutory date → totals → stamp)
      const result = await issueJobWorkOrder(id, {
        userId,
        sentDate: sentDate ? new Date(sentDate) : undefined,
        lots,
        greigeStockLotId,
        fabricStockLotId,
        challanNumber,
        vehicleNumber,
        acknowledgeWidthMismatch,
      });

      const updated = await prisma.job_work_orders.findUnique({ where: { id }, include: jwoInclude });
      res.json({
        success: true,
        data: updated,
        challanNumber: result.challanNumber,
        warning: result.warnings.join(' ') || undefined,
        message: `Job work order issued — challan ${result.challanNumber} created`,
      });
    } catch (error) {
      if (error instanceof JobWorkOrderError) {
        if (error.code === 'NOT_FOUND') {
          return res.status(404).json({ success: false, message: error.message });
        }
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
   * GET /api/job-work-orders/:id/issue-preview — READ-ONLY dry run of the issuance
   * validation: blockers, the greige the order's requirement chain calls for, and the
   * lots that could serve it. Powers the issue dialogs and live-case verification.
   */
  async issuePreview(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const v = await validateIssue(id, {});
      // A style-less stock order has no resolvable greige identity — anchoring the list to
      // expectedGreigeId there hands the UI an empty dropdown, so offer every issuable lot and
      // let the operator anchor the order by what they pick (LOT_GREIGE_MIXED holds the line).
      const greigeFilter: Prisma.greige_stockWhereInput | null = v.expectedGreigeId
        ? { greigeId: v.expectedGreigeId }
        : v.jwo.fabricType === 'GREIGE'
          ? {}
          : null;
      const availableLots = greigeFilter
        ? await prisma.greige_stock.findMany({
            where: {
              ...greigeFilter,
              status: 'AVAILABLE',
              processorId: null,
              quantityAvailable: { gt: 0 },
              // Explicit OR: `not` on a nullable column would silently exclude NULL rows
              OR: [{ sourceType: null }, { sourceType: { not: 'TRANSFER' } }],
            },
            select: {
              id: true,
              greigeId: true,
              greigeWidth: true,
              quantityAvailable: true,
              greige: { select: { greigeCode: true, greigeName: true } },
            },
            orderBy: { quantityAvailable: 'desc' },
          })
        : [];
      return res.json({
        success: true,
        data: {
          canIssue: v.blockers.length === 0,
          blockers: v.blockers,
          expectedGreige: v.expectedGreige,
          // false ⇒ the list below spans many greiges; the UI must hold the same-greige rule itself
          greigeAnchored: v.expectedGreigeId != null,
          requiredQty: Number(v.jwo.qtySentMeters),
          uom: v.jwo.uom,
          fabricType: v.jwo.fabricType,
          availableLots: availableLots.map((l) => ({
            id: l.id,
            greigeId: l.greigeId,
            greigeCode: l.greige?.greigeCode ?? null,
            greigeName: l.greige?.greigeName ?? null,
            greigeWidth: l.greigeWidth != null ? Number(l.greigeWidth) : null,
            quantityAvailable: Number(l.quantityAvailable),
          })),
        },
      });
    } catch (error) {
      if (error instanceof JobWorkOrderError && error.code === 'NOT_FOUND') {
        return res.status(404).json({ success: false, message: error.message });
      }
      logger.error('Error building issue preview:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to build issue preview',
      });
    }
  }

  /**
   * GET /api/job-work-orders/dispatchable?processorId=
   * The orders that could go on one truck to this processor: approved, not yet sent, not
   * cancelled — each with the cloth it needs and the lots that could serve it, so the
   * dispatch screen can be filled in without a round trip per order.
   *
   * Filters on jwoStatus, NOT the legacy status: a cancelled order keeps status
   * READY_TO_SEND, so filtering on that would offer cancelled orders for dispatch.
   */
  async dispatchable(req: Request, res: Response) {
    try {
      const processorId = typeof req.query.processorId === 'string' ? req.query.processorId : null;
      if (!processorId) {
        return res.status(400).json({ success: false, message: 'processorId is required' });
      }

      const orders = await prisma.job_work_orders.findMany({
        where: {
          processorId,
          sentDate: null,
          isActive: true,
          jwoStatus: 'APPROVED',
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });

      // validateIssue per order gives the cloth, the blockers and the same rules the issue
      // itself will apply — no second, drifting definition of "ready to send".
      const validations = await Promise.all(orders.map((o) => validateIssue(o.id, {})));

      // One lot query for the whole screen rather than one per order.
      const anchoredGreigeIds = [
        ...new Set(validations.map((v) => v.expectedGreigeId).filter((g): g is string => !!g)),
      ];
      const hasUnanchoredGreigeOrder = validations.some((v) => !v.expectedGreigeId && v.jwo.fabricType === 'GREIGE');
      const needLots = hasUnanchoredGreigeOrder || anchoredGreigeIds.length > 0;
      const lotRows = needLots
        ? await prisma.greige_stock.findMany({
            where: {
              ...(hasUnanchoredGreigeOrder ? {} : { greigeId: { in: anchoredGreigeIds } }),
              status: 'AVAILABLE',
              processorId: null,
              quantityAvailable: { gt: 0 },
              // Explicit OR: `not` on a nullable column would silently exclude NULL rows
              OR: [{ sourceType: null }, { sourceType: { not: 'TRANSFER' } }],
            },
            select: {
              id: true,
              greigeId: true,
              greigeWidth: true,
              quantityAvailable: true,
              greige: { select: { greigeCode: true, greigeName: true } },
            },
            orderBy: { quantityAvailable: 'desc' },
          })
        : [];

      const toLot = (l: (typeof lotRows)[number]) => ({
        id: l.id,
        greigeId: l.greigeId,
        greigeCode: l.greige?.greigeCode ?? null,
        greigeName: l.greige?.greigeName ?? null,
        greigeWidth: l.greigeWidth != null ? Number(l.greigeWidth) : null,
        quantityAvailable: Number(l.quantityAvailable),
      });

      return res.json({
        success: true,
        data: validations.map((v) => ({
          id: v.jwo.id,
          jobWorkNumber: v.jwo.jobWorkNumber,
          processType: v.jwo.processType,
          styleCode: v.jwo.style?.styleCode ?? null,
          requiredQty: Number(v.jwo.qtySentMeters),
          uom: v.jwo.uom,
          fabricType: v.jwo.fabricType,
          expectedGreige: v.expectedGreige,
          greigeAnchored: v.expectedGreigeId != null,
          // NO_GREIGE_LOT is precisely what picking lots on this screen resolves, so it is not
          // a reason to hide or veto the order — showing it would be noise.
          blockers: v.blockers.filter((b) => b.code !== 'NO_GREIGE_LOT'),
          availableLots:
            v.jwo.fabricType === 'GREIGE'
              ? lotRows.filter((l) => !v.expectedGreigeId || l.greigeId === v.expectedGreigeId).map(toLot)
              : [],
        })),
      });
    } catch (error) {
      logger.error('Error listing dispatchable job work orders:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to list dispatchable job work orders',
      });
    }
  }

  /**
   * POST /api/job-work-orders/dispatch
   * ONE outward challan carrying SEVERAL job work orders to one processor — the truck, rather
   * than the order, as the unit of dispatch. Each order keeps its own rate, shrinkage, receipt
   * and loss reconciliation; only the movement document is shared. All-or-nothing.
   */
  async dispatch(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      const body = req.body as DispatchJwoInput;

      const result = await dispatchJobWorkOrders({
        userId,
        processorId: body.processorId,
        sentDate: body.sentDate,
        vehicleNumber: body.vehicleNumber,
        challanNumber: body.challanNumber,
        acknowledgeWidthMismatch: body.acknowledgeWidthMismatch,
        orders: body.orders,
      });

      return res.json({
        success: true,
        data: result,
        warning: result.warnings.join(' ') || undefined,
        message: `Dispatched ${result.orders.length} job work order(s) on challan ${result.challanNumber}`,
      });
    } catch (error) {
      if (error instanceof JobWorkOrderError) {
        if (error.code === 'NOT_FOUND') {
          return res.status(404).json({ success: false, message: error.message });
        }
        return res.status(422).json({ success: false, code: error.code, message: error.message });
      }
      logger.error('Error dispatching job work orders:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to dispatch job work orders',
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
      if (jwo.receivedDate || JWO_RECEIVED_STATUSES.includes(jwo.jwoStatus!)) {
        return res.status(422).json({
          success: false,
          code: 'ALREADY_RECEIVED',
          message: `${jwo.jobWorkNumber} has received material — use the receive/close flows instead of cancelling`,
        });
      }

      const updated = await prisma.$transaction(async (txClient) => {
        // Reverse the issued material (only if the JWO was actually issued).
        // unissueForCancel: guarded per-lot restore (multi-lot via components), RETURN
        // ledger rows, stock_levels sync (the piece the old inline block missed for
        // greige), and cancels the outward challan so ITC-04 stops declaring it.
        if (jwo.sentDate) {
          await unissueForCancel(txClient, jwo, userId);
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

        // Both status columns via the helper — the old jwoStatus-only write left the legacy
        // column claiming READY_TO_SEND, keeping cancelled orders on the receivable lists
        // (landmine №1: returned rolls then double-counted stock via GRN).
        await setJwoStatus(txClient, id, 'CANCELLED', {
          remarks: `${jwo.remarks || ''}\n[CANCELLED] ${reason || 'No reason given'}`.trim(),
        });
        return txClient.job_work_orders.findUnique({ where: { id }, include: jwoInclude });
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

        await setJwoStatus(txClient, id, 'RECEIVED', {
          receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
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

      // Update status (both columns via the helper)
      await setJwoStatus(prisma, id, 'APPROVED');

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
        by: ['jwoStatus'],
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
          byStatus: Object.fromEntries(statusCounts.map((s) => [s.jwoStatus, s._count.id])),
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

  /**
   * GET /api/greige-stock/:stockId/available-details
   * Get available bale/than details for a greige stock lot.
   * Used by the UI to show which individual thans can be selected for issuance.
   */
  async getLotAvailableDetails(req: Request, res: Response) {
    try {
      const { stockId } = req.params;
      const details = await greigeStockService.getAvailableDetails(stockId);
      res.json({ success: true, data: details });
    } catch (error) {
      logger.error('Error fetching lot details:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch lot details',
      });
    }
  }

  /**
   * POST /api/job-work-orders/:id/issue-with-details
   * Issue a JWO with explicit bale/than detail selection.
   * User selects which specific thans to send to the processor.
   */
  async issueWithDetails(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { lotsWithDetails, sentDate, challanNumber, vehicleNumber, acknowledgeWidthMismatch } = req.body;
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      if (!lotsWithDetails || !Array.isArray(lotsWithDetails) || lotsWithDetails.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'lotsWithDetails is required and must be a non-empty array',
        });
      }

      const result = await issueJobWorkOrderWithDetails(id, {
        userId,
        sentDate: sentDate ? new Date(sentDate) : undefined,
        lotsWithDetails,
        challanNumber,
        vehicleNumber,
        acknowledgeWidthMismatch,
      });

      const updated = await prisma.job_work_orders.findUnique({ where: { id }, include: jwoInclude });
      res.json({
        success: true,
        data: updated,
        challanNumber: result.challanNumber,
        warning: result.warnings.join(' ') || undefined,
        message: `Job work order issued with detail tracking — challan ${result.challanNumber} created`,
      });
    } catch (error) {
      if (error instanceof JobWorkOrderError) {
        if (error.code === 'NOT_FOUND') {
          return res.status(404).json({ success: false, message: error.message });
        }
        return res.status(422).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      logger.error('Error issuing JWO with details:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to issue job work order',
      });
    }
  }
}

export const jobWorkOrderController = new JobWorkOrderController();
export default jobWorkOrderController;
