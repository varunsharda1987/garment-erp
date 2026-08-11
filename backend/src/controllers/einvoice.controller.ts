import { Request, Response } from 'express';
import { einvoiceSettingsService, EInvoiceSettings } from '../services/einvoice-settings.service';
import { einvoiceService } from '../services/einvoice.service';
import { logError } from '../utils/logger';

/**
 * Secrets never leave the API: GET returns this mask for any set secret, and
 * PUT drops incoming fields whose value is exactly the mask so the settings
 * form can round-trip without wiping saved credentials. Submitting an empty
 * string explicitly clears a secret.
 */
const SECRET_MASK = '••••••••';
const SECRET_FIELDS = ['einvClientId', 'einvClientSecret', 'einvApiPassword'] as const;

function maskSettings(settings: EInvoiceSettings): Record<string, unknown> {
  const masked: Record<string, unknown> = { ...settings };
  for (const field of SECRET_FIELDS) {
    masked[field] = settings[field] ? SECRET_MASK : '';
  }
  return masked;
}

class EInvoiceController {
  async getSettings(_req: Request, res: Response) {
    try {
      const settings = await einvoiceSettingsService.get();
      res.json({ data: maskSettings(settings) });
    } catch (error) {
      logError('Failed to get e-Invoice settings', error);
      res.status(500).json({ message: 'Failed to get e-Invoice settings' });
    }
  }

  async updateSettings(req: Request, res: Response) {
    try {
      const input = { ...req.body };
      for (const field of SECRET_FIELDS) {
        if (input[field] === SECRET_MASK) delete input[field];
      }
      const settings = await einvoiceSettingsService.update(input);
      res.json({ data: maskSettings(settings), message: 'Settings updated successfully' });
    } catch (error) {
      logError('Failed to update e-Invoice settings', error);
      res.status(500).json({ message: 'Failed to update e-Invoice settings' });
    }
  }

  async testConnection(_req: Request, res: Response) {
    try {
      const result = await einvoiceService.testConnection();
      res.json({ data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection test failed';
      logError('e-Invoice connection test failed', error);
      res.status(400).json({ message });
    }
  }

  async getInvoices(req: Request, res: Response) {
    try {
      const { page, limit, search, irnStatus } = req.query;
      const result = await einvoiceService.listInvoices({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search as string | undefined,
        irnStatus: irnStatus as 'all' | 'not_generated' | 'generated' | 'cancelled' | 'error' | undefined,
      });
      res.json({ data: result.data, pagination: result.pagination });
    } catch (error) {
      logError('Failed to list invoices for e-Invoice', error);
      res.status(500).json({ message: 'Failed to list invoices' });
    }
  }

  async preflight(req: Request, res: Response) {
    try {
      const result = await einvoiceService.preflight(req.params.invoiceId);
      res.json({ data: result });
    } catch (error) {
      logError('e-Invoice preflight failed', error);
      res.status(500).json({ message: 'Preflight check failed' });
    }
  }

  async generateIrn(req: Request, res: Response) {
    try {
      const result = await einvoiceService.generateIrn(req.params.invoiceId);
      if (!result.success && result.problems?.length) {
        res.status(400).json({ data: result, message: result.problems.join(' ') });
        return;
      }
      res.json({ data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'IRN generation failed';
      logError('IRN generation failed', error);
      res.status(400).json({ message });
    }
  }

  async cancelIrn(req: Request, res: Response) {
    try {
      const { reason, remarks } = req.body;
      const result = await einvoiceService.cancelIrn(req.params.invoiceId, reason, remarks);
      if (!result.success) {
        res.status(400).json({ data: result, message: result.error });
        return;
      }
      res.json({ data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'IRN cancellation failed';
      logError('IRN cancellation failed', error);
      res.status(400).json({ message });
    }
  }
}

export const einvoiceController = new EInvoiceController();
