/**
 * Document facade — single switch point between the kf HTML renderer (new
 * design) and the legacy pdfkit generators.
 *
 * Cut-over docs (invoice / purchase order / challan): HTML first; `legacy`
 * option OR any renderer failure falls back to pdfkit with a logged warning —
 * a statutory document must never 503 because Chrome hiccupped.
 * Net-new docs (job work order / GRN): HTML only; a missing Chrome surfaces
 * as RendererUnavailableError for the controller to turn into a clear 503.
 */
import documentGeneratorService from './document-generator.service';
import { renderDocument } from './html-document.service';
import { RendererUnavailableError } from './html-renderer.service';
import { buildChallanDocData, CHALLAN_COPY_MARKS } from './document-data/challan.doc-data';
import { buildTaxInvoiceDocData } from './document-data/tax-invoice.doc-data';
import { buildPurchaseOrderDocData } from './document-data/purchase-order.doc-data';
import { buildJobWorkOrderDocData } from './document-data/job-work-order.doc-data';
import { buildGrnDocData } from './document-data/grn.doc-data';
import {
  buildAgeingReportData,
  buildItc04ReportData,
  buildVendorPerformanceReportData,
} from './document-data/reports.doc-data';
// Phase B — kf-style templates authored in-house for the documents the design
// package never covered. Each replaces a pdfkit generator, same fallback rules.
import { buildProformaInvoiceDocData } from './document-data/proforma-invoice.doc-data';
import { buildOrderFormDocData } from './document-data/order-form.doc-data';
import { buildTechPackDocData } from './document-data/tech-pack.doc-data';
import { buildTransferSlipDocData } from './document-data/transfer-slip.doc-data';
import { buildCuttingChartDocData } from './document-data/cutting-chart.doc-data';
import { buildLineSheetDocData } from './document-data/line-sheet.doc-data';
import { buildCatalogueDocData } from './document-data/catalogue.doc-data';
import logger from '../utils/logger';
import { AppError } from '../errors';

export interface FacadeOptions {
  /** Force the legacy pdfkit renderer (?legacy=1 escape hatch during burn-in) */
  legacy?: boolean;
}

async function withPdfkitFallback(
  docLabel: string,
  htmlRender: () => Promise<Buffer>,
  pdfkitRender: () => Promise<Buffer>,
  opts?: FacadeOptions
): Promise<Buffer> {
  if (opts?.legacy) {
    logger.info(`[DocFacade] ${docLabel}: legacy renderer requested (?legacy=1)`);
    return pdfkitRender();
  }
  try {
    return await htmlRender();
  } catch (err) {
    // Domain errors are the ANSWER, not a renderer failure: a missing record is a
    // 404 and a business guard (e.g. "this PROCESSING PO must print as a JWO") is a
    // 422. Retrying those on pdfkit either fails again as an opaque 500 or, worse,
    // prints the document the guard exists to refuse. Only infrastructure failures
    // (Chrome missing/crashed, template bug) fall back.
    if (err instanceof AppError) {
      throw err;
    }
    logger.warn(`[DocFacade] ${docLabel}: HTML renderer failed — falling back to pdfkit`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return pdfkitRender();
  }
}

export const documentFacadeService = {
  async generateInvoicePDF(invoiceId: string, opts?: FacadeOptions & { includeImages?: boolean }): Promise<Buffer> {
    return withPdfkitFallback(
      'tax-invoice',
      async () => {
        const data = await buildTaxInvoiceDocData(invoiceId);
        return renderDocument('tax-invoice', data as unknown as Record<string, unknown>);
      },
      () => documentGeneratorService.generateInvoicePDF(invoiceId, { includeImages: opts?.includeImages }),
      opts
    );
  },

  async generatePurchaseOrderPDF(poId: string, opts?: FacadeOptions): Promise<Buffer> {
    return withPdfkitFallback(
      'purchase-order',
      async () => {
        const data = await buildPurchaseOrderDocData(poId);
        return renderDocument('purchase-order', data as unknown as Record<string, unknown>);
      },
      () => documentGeneratorService.generatePurchaseOrderPDF(poId),
      opts
    );
  },

  async generateChallanPDF(challanId: string, opts?: FacadeOptions): Promise<Buffer> {
    return withPdfkitFallback(
      'challan',
      async () => {
        const data = await buildChallanDocData(challanId);
        return renderDocument('challan', data as unknown as Record<string, unknown>, {
          copies: CHALLAN_COPY_MARKS,
        });
      },
      () => documentGeneratorService.generateChallanPDF(challanId),
      opts
    );
  },

  /** Net-new — no legacy generator exists. RendererUnavailableError bubbles up. */
  async generateJobWorkOrderPDF(jwoId: string): Promise<Buffer> {
    const data = await buildJobWorkOrderDocData(jwoId);
    return renderDocument('job-work-order', data as unknown as Record<string, unknown>);
  },

  /** Net-new — no legacy generator exists. */
  async generateGRNPDF(grnId: string): Promise<Buffer> {
    const data = await buildGrnDocData(grnId);
    return renderDocument('grn', data as unknown as Record<string, unknown>);
  },

  async generateAgeingReportPDF(): Promise<Buffer> {
    const data = await buildAgeingReportData();
    return renderDocument('report-job-work-ageing', data as unknown as Record<string, unknown>);
  },

  async generateItc04ReportPDF(period?: { start: Date; end: Date }): Promise<Buffer> {
    const data = await buildItc04ReportData(period);
    return renderDocument('report-itc-04', data as unknown as Record<string, unknown>);
  },

  async generateVendorPerformanceReportPDF(period?: { start: Date; end: Date }): Promise<Buffer> {
    const data = await buildVendorPerformanceReportData(period);
    return renderDocument('report-vendor-performance', data as unknown as Record<string, unknown>);
  },

  // ── Phase B cut-overs (pdfkit fallback retained, same as Phase A) ──────────

  async generateProformaPDF(quotationId: string, opts?: FacadeOptions): Promise<Buffer> {
    return withPdfkitFallback(
      'proforma-invoice',
      async () => {
        const data = await buildProformaInvoiceDocData(quotationId);
        return renderDocument('proforma-invoice', data as unknown as Record<string, unknown>);
      },
      () => documentGeneratorService.generateProformaPDF(quotationId),
      opts
    );
  },

  async generateOrderFormPDF(orderId: string, opts?: FacadeOptions): Promise<Buffer> {
    return withPdfkitFallback(
      'order-form',
      async () => {
        const data = await buildOrderFormDocData(orderId);
        return renderDocument('order-form', data as unknown as Record<string, unknown>);
      },
      () => documentGeneratorService.generateOrderFormPDF(orderId),
      opts
    );
  },

  async generateTechPackPDF(styleId: string, opts?: FacadeOptions): Promise<Buffer> {
    return withPdfkitFallback(
      'tech-pack',
      async () => {
        const data = await buildTechPackDocData(styleId);
        return renderDocument('tech-pack', data as unknown as Record<string, unknown>);
      },
      () => documentGeneratorService.generateTechPackPDF(styleId),
      opts
    );
  },

  async generateTransferSlipPDF(slipId: string, opts?: FacadeOptions): Promise<Buffer> {
    return withPdfkitFallback(
      'transfer-slip',
      async () => {
        const data = await buildTransferSlipDocData(slipId);
        return renderDocument('transfer-slip', data as unknown as Record<string, unknown>);
      },
      () => documentGeneratorService.generateTransferSlipPDF(slipId),
      opts
    );
  },

  /** Cutting chart: the kf sheet covers every colour of the work order. */
  async generateCuttingChartPDF(
    workOrderId: string,
    opts?: FacadeOptions & { colorId?: string; extraPercent?: number }
  ): Promise<Buffer> {
    return withPdfkitFallback(
      'cutting-chart',
      async () => {
        const data = await buildCuttingChartDocData(workOrderId);
        return renderDocument('cutting-chart', data as unknown as Record<string, unknown>);
      },
      () =>
        documentGeneratorService.generateCuttingChartPDF(
          workOrderId,
          opts?.colorId,
          opts?.extraPercent != null ? { extraPercent: opts.extraPercent } : undefined
        ),
      opts
    );
  },

  /**
   * Line sheet / catalogue take a selection argument, not one record id:
   * comma-separated style ids or codes, plus `key=value` filters and flags
   * (see the adapters' parseSelection).
   */
  async generateLineSheetPDF(selection: string, opts?: FacadeOptions): Promise<Buffer> {
    return withPdfkitFallback(
      'line-sheet',
      async () => {
        const data = await buildLineSheetDocData(selection);
        return renderDocument('line-sheet', data as unknown as Record<string, unknown>);
      },
      () =>
        documentGeneratorService.generateLineSheetPDF(
          selection
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        ),
      opts
    );
  },

  async generateCataloguePDF(selection: string, opts?: FacadeOptions): Promise<Buffer> {
    return withPdfkitFallback(
      'catalogue',
      async () => {
        const data = await buildCatalogueDocData(selection);
        return renderDocument('catalogue', data as unknown as Record<string, unknown>);
      },
      () => documentGeneratorService.generateCataloguePDF({}, { priceDisplay: 'none', includeIndex: true }),
      opts
    );
  },
};

export { RendererUnavailableError };
