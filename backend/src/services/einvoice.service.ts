/**
 * e-Invoice orchestration: list invoices with IRN status, generate IRN,
 * cancel IRN (24h window), test IRP connection.
 *
 * Coexists with the Tally push — generate the IRN first, then push to Tally;
 * the Tally sales voucher embeds the IRN so Tally does not re-generate it.
 */

import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { einvoiceSettingsService } from './einvoice-settings.service';
import { getIrpProvider } from './einvoice/irp-provider';
import { NicIrpError } from './einvoice/nic-irp-provider';
import { preflightInvoice, PreflightResult } from './einvoice/einvoice-preflight';
import { logError, logInfo } from '../utils/logger';

const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

const CANCEL_REASON_LABELS: Record<string, string> = {
  '1': 'Duplicate',
  '2': 'Data entry mistake',
  '3': 'Order cancelled',
  '4': 'Others',
};

export interface EInvoiceListParams {
  page?: number;
  limit?: number;
  search?: string;
  irnStatus?: 'all' | 'not_generated' | 'generated' | 'cancelled' | 'error';
}

export interface GenerateIrnResult {
  success: boolean;
  irn?: string;
  ackNo?: string;
  ackDt?: string;
  error?: string;
  problems?: string[];
  warnings?: string[];
}

export interface CancelIrnResult {
  success: boolean;
  cancelDate?: string;
  error?: string;
}

/** Parse the IRP "yyyy-MM-dd HH:mm:ss" timestamp (server runs in IST like the IRP). */
function parseAckDate(ackDt: string): Date {
  const parsed = new Date(ackDt.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

class EInvoiceService {
  async listInvoices(params: EInvoiceListParams) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));

    const where: Prisma.invoicesWhereInput = {};
    if (params.search?.trim()) {
      const search = params.search.trim();
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customers: { name: { contains: search, mode: 'insensitive' } } },
        { eInvoiceIrn: { contains: search, mode: 'insensitive' } },
      ];
    }
    switch (params.irnStatus) {
      case 'generated':
        where.eInvoiceStatus = 'GENERATED';
        break;
      case 'cancelled':
        where.eInvoiceStatus = 'CANCELLED';
        break;
      case 'error':
        where.eInvoiceLastError = { not: null };
        where.eInvoiceIrn = null;
        break;
      case 'not_generated':
        where.eInvoiceIrn = null;
        where.eInvoiceLastError = null;
        break;
    }

    const [rows, total] = await Promise.all([
      prisma.invoices.findMany({
        where,
        orderBy: { invoiceDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          totalAmount: true,
          isInterstate: true,
          eInvoiceIrn: true,
          eInvoiceStatus: true,
          eInvoiceAckNo: true,
          eInvoiceAckDate: true,
          eInvoiceLastError: true,
          eInvoiceCancelledAt: true,
          customers: {
            select: {
              name: true,
              gstNumber: true,
              customer_gst_numbers: { select: { gstNumber: true, isPrimary: true } },
            },
          },
        },
      }),
      prisma.invoices.count({ where }),
    ]);

    const data = rows.map((row) => {
      const gstRow =
        row.customers.customer_gst_numbers.find((g) => g.isPrimary) ?? row.customers.customer_gst_numbers[0];
      const buyerGstin = (gstRow?.gstNumber ?? row.customers.gstNumber ?? '').trim();
      return {
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        invoiceDate: row.invoiceDate,
        customerName: row.customers.name,
        buyerGstin: buyerGstin || null,
        b2c: !buyerGstin,
        totalAmount: Number(row.totalAmount),
        isInterstate: row.isInterstate,
        eInvoiceIrn: row.eInvoiceIrn,
        eInvoiceStatus: row.eInvoiceStatus,
        eInvoiceAckNo: row.eInvoiceAckNo,
        eInvoiceAckDate: row.eInvoiceAckDate,
        eInvoiceLastError: row.eInvoiceLastError,
        eInvoiceCancelledAt: row.eInvoiceCancelledAt,
      };
    });

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async preflight(invoiceId: string): Promise<PreflightResult> {
    return preflightInvoice(invoiceId);
  }

  async generateIrn(invoiceId: string): Promise<GenerateIrnResult> {
    const preflight = await preflightInvoice(invoiceId);
    if (!preflight.eligible || !preflight.payload) {
      return { success: false, problems: preflight.problems, warnings: preflight.warnings, error: 'Preflight failed' };
    }

    const settings = await einvoiceSettingsService.ensureConfigured();
    const provider = getIrpProvider(settings);

    try {
      const result = await provider.generateIrn(preflight.payload);
      await prisma.invoices.update({
        where: { id: invoiceId },
        data: {
          eInvoiceIrn: result.irn,
          eInvoiceAckNo: result.ackNo,
          eInvoiceAckDate: parseAckDate(result.ackDt),
          eInvoiceQrCode: result.signedQrCode || null,
          eInvoiceStatus: 'GENERATED',
          eInvoiceLastError: null,
        },
      });
      logInfo(`IRN generated for invoice ${invoiceId}: ${result.irn}`);
      return { success: true, irn: result.irn, ackNo: result.ackNo, ackDt: result.ackDt, warnings: preflight.warnings };
    } catch (error) {
      // 2150 = document already registered — recover the existing IRN and treat as success
      if (error instanceof NicIrpError && error.hasCode('2150')) {
        const recovered = await this.recoverDuplicateIrn(invoiceId, provider, error);
        if (recovered) return recovered;
      }

      const message = error instanceof Error ? error.message : String(error);
      logError(`IRN generation failed for invoice ${invoiceId}`, error instanceof Error ? error : new Error(message));
      await prisma.invoices.update({
        where: { id: invoiceId },
        data: { eInvoiceLastError: message },
      });
      return { success: false, error: message };
    }
  }

  /** Pull the already-registered IRN out of a 2150 error's InfoDtls and persist it. */
  private async recoverDuplicateIrn(
    invoiceId: string,
    provider: ReturnType<typeof getIrpProvider>,
    error: NicIrpError
  ): Promise<GenerateIrnResult | null> {
    let existingIrn: string | undefined;
    const info = error.infoDtls;
    const candidates = Array.isArray(info) ? info : info ? [info] : [];
    for (const entry of candidates) {
      const desc = (entry as Record<string, unknown>)?.Desc;
      const irn = (desc as Record<string, unknown>)?.Irn ?? (entry as Record<string, unknown>)?.Irn;
      if (typeof irn === 'string' && irn.length > 0) {
        existingIrn = irn;
        break;
      }
    }
    if (!existingIrn) return null;

    const details = await provider.getIrnDetails(existingIrn);
    await prisma.invoices.update({
      where: { id: invoiceId },
      data: {
        eInvoiceIrn: existingIrn,
        eInvoiceAckNo: details?.ackNo || null,
        eInvoiceAckDate: details?.ackDt ? parseAckDate(details.ackDt) : null,
        eInvoiceQrCode: details?.signedQrCode || null,
        eInvoiceStatus: 'GENERATED',
        eInvoiceLastError: details
          ? null
          : 'IRN was already registered on the IRP; QR code could not be retrieved — try Generate again to refresh.',
      },
    });
    logInfo(`Recovered existing IRN for invoice ${invoiceId}: ${existingIrn}`);
    return { success: true, irn: existingIrn, ackNo: details?.ackNo, ackDt: details?.ackDt };
  }

  async cancelIrn(invoiceId: string, reason: string, remarks: string): Promise<CancelIrnResult> {
    const invoice = await prisma.invoices.findUnique({
      where: { id: invoiceId },
      select: { eInvoiceIrn: true, eInvoiceStatus: true, eInvoiceAckDate: true },
    });
    if (!invoice?.eInvoiceIrn) {
      return { success: false, error: 'No IRN has been generated for this invoice.' };
    }
    if (invoice.eInvoiceStatus === 'CANCELLED') {
      return { success: false, error: 'The IRN for this invoice is already cancelled.' };
    }
    if (invoice.eInvoiceAckDate) {
      const deadline = invoice.eInvoiceAckDate.getTime() + CANCEL_WINDOW_MS;
      if (Date.now() > deadline) {
        return {
          success: false,
          error: `The 24-hour cancel window expired on ${new Date(deadline).toLocaleString('en-IN')}. Issue a credit note instead.`,
        };
      }
    }

    const settings = await einvoiceSettingsService.ensureConfigured();
    const provider = getIrpProvider(settings);

    try {
      const result = await provider.cancelIrn(invoice.eInvoiceIrn, reason, remarks);
      await prisma.invoices.update({
        where: { id: invoiceId },
        data: {
          eInvoiceStatus: 'CANCELLED',
          eInvoiceCancelledAt: result.cancelDate ? parseAckDate(result.cancelDate) : new Date(),
          eInvoiceCancelReason: `${CANCEL_REASON_LABELS[reason] ?? reason}: ${remarks}`,
          eInvoiceLastError: null,
        },
      });
      logInfo(`IRN cancelled for invoice ${invoiceId}`);
      return { success: true, cancelDate: result.cancelDate };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`IRN cancel failed for invoice ${invoiceId}`, error instanceof Error ? error : new Error(message));
      await prisma.invoices.update({
        where: { id: invoiceId },
        data: { eInvoiceLastError: message },
      });
      return { success: false, error: message };
    }
  }

  async testConnection() {
    const settings = await einvoiceSettingsService.ensureConfigured();
    return getIrpProvider(settings).testAuth();
  }
}

export const einvoiceService = new EInvoiceService();
