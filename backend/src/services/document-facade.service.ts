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
import logger from '../utils/logger';

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
};

export { RendererUnavailableError };
