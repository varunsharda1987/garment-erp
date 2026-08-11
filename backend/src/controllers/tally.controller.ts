import { Request, Response } from 'express';
import { tallySettingsService } from '../services/tally-settings.service';
import { tallyService } from '../services/tally.service';
import { logError } from '../utils/logger';

class TallyController {
  async getSettings(_req: Request, res: Response) {
    try {
      const settings = await tallySettingsService.get();
      res.json({ data: settings });
    } catch (error) {
      logError('Failed to get Tally settings', error);
      res.status(500).json({ message: 'Failed to get Tally settings' });
    }
  }

  async updateSettings(req: Request, res: Response) {
    try {
      const settings = await tallySettingsService.update(req.body);
      res.json({ data: settings, message: 'Settings updated successfully' });
    } catch (error) {
      logError('Failed to update Tally settings', error);
      res.status(500).json({ message: 'Failed to update Tally settings' });
    }
  }

  async testConnection(_req: Request, res: Response) {
    try {
      const result = await tallyService.testConnection();
      res.json({ data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection test failed';
      logError('Tally connection test failed', error);
      res.status(400).json({ message });
    }
  }

  async getLedgers(_req: Request, res: Response) {
    try {
      const settings = await tallySettingsService.get();
      const ledgers = await tallyService.fetchLedgers(settings);
      res.json({ data: ledgers });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch ledgers';
      logError('Failed to fetch Tally ledgers', error);
      res.status(400).json({ message });
    }
  }

  async getVoucherTypes(_req: Request, res: Response) {
    try {
      const settings = await tallySettingsService.get();
      const types = await tallyService.fetchVoucherTypes(settings);
      res.json({ data: types });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch voucher types';
      logError('Failed to fetch Tally voucher types', error);
      res.status(400).json({ message });
    }
  }

  async getGroups(_req: Request, res: Response) {
    try {
      const settings = await tallySettingsService.get();
      const groups = await tallyService.fetchGroups(settings);
      res.json({ data: groups });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch groups';
      logError('Failed to fetch Tally groups', error);
      res.status(400).json({ message });
    }
  }

  async createMissingLedgers(_req: Request, res: Response) {
    try {
      const result = await tallyService.createMissingLedgers();
      res.json({ data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create ledgers';
      logError('Failed to create missing Tally ledgers', error);
      res.status(400).json({ message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Customer-Ledger Matching
  // ═══════════════════════════════════════════════════════════════════════════

  async getCustomers(req: Request, res: Response) {
    try {
      const { page, limit, search, matchStatus, suggestions } = req.query;
      const result = await tallyService.getCustomersWithTallyStatus(
        {
          page: page ? Number(page) : undefined,
          limit: limit ? Number(limit) : undefined,
          search: search as string | undefined,
          matchStatus: matchStatus as 'all' | 'matched' | 'unmatched' | undefined,
        },
        suggestions === 'true'
      );
      res.json({ data: result.data, pagination: result.pagination, stats: result.stats });
    } catch (error) {
      logError('Failed to get customers for Tally matching', error);
      res.status(500).json({ message: 'Failed to get customers' });
    }
  }

  async linkCustomer(req: Request, res: Response) {
    try {
      const { customerId } = req.params;
      const { tallyLedgerName } = req.body;
      if (!tallyLedgerName) {
        return res.status(400).json({ message: 'tallyLedgerName is required' });
      }
      await tallyService.linkCustomerToTallyLedger(customerId, tallyLedgerName);
      res.json({ message: 'Customer linked to Tally ledger successfully' });
    } catch (error) {
      logError('Failed to link customer to Tally ledger', error);
      res.status(500).json({ message: 'Failed to link customer' });
    }
  }

  async unlinkCustomer(req: Request, res: Response) {
    try {
      const { customerId } = req.params;
      await tallyService.unlinkCustomerFromTallyLedger(customerId);
      res.json({ message: 'Customer unlinked from Tally ledger successfully' });
    } catch (error) {
      logError('Failed to unlink customer from Tally ledger', error);
      res.status(500).json({ message: 'Failed to unlink customer' });
    }
  }

  async autoMatchCustomers(_req: Request, res: Response) {
    try {
      const result = await tallyService.autoMatchCustomers();
      res.json({
        data: result,
        message: `Auto-matched ${result.matched} of ${result.total} unmatched customers`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Auto-match failed';
      logError('Failed to auto-match customers', error);
      res.status(400).json({ message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Invoice Push
  // ═══════════════════════════════════════════════════════════════════════════

  async getInvoices(req: Request, res: Response) {
    try {
      const { page, limit, search, pushStatus } = req.query;
      const result = await tallyService.getInvoicesWithTallyStatus({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search as string | undefined,
        pushStatus: pushStatus as 'all' | 'pushed' | 'not_pushed' | 'error' | undefined,
      });
      res.json({ data: result.data, pagination: result.pagination });
    } catch (error) {
      logError('Failed to get invoices for Tally push', error);
      res.status(500).json({ message: 'Failed to get invoices' });
    }
  }

  async pushInvoice(req: Request, res: Response) {
    try {
      const { invoiceId } = req.params;
      const result = await tallyService.pushInvoiceToTally(invoiceId);
      if (result.success) {
        res.json({
          data: result,
          message: `Invoice pushed to Tally successfully (Voucher: ${result.voucherNumber})`,
        });
      } else {
        res.status(400).json({ message: result.error });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to push invoice';
      logError('Failed to push invoice to Tally', error);
      res.status(400).json({ message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Credit Note Push
  // ═══════════════════════════════════════════════════════════════════════════

  async getCreditNotes(req: Request, res: Response) {
    try {
      const { page, limit, search, pushStatus } = req.query;
      const result = await tallyService.getCreditNotesWithTallyStatus({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search as string | undefined,
        pushStatus: pushStatus as 'all' | 'pushed' | 'not_pushed' | 'error' | undefined,
      });
      res.json({ data: result.data, pagination: result.pagination });
    } catch (error) {
      logError('Failed to get credit notes for Tally push', error);
      res.status(500).json({ message: 'Failed to get credit notes' });
    }
  }

  async pushCreditNote(req: Request, res: Response) {
    try {
      const { creditNoteId } = req.params;
      const result = await tallyService.pushCreditNoteToTally(creditNoteId);
      if (result.success) {
        res.json({
          data: result,
          message: `Credit note pushed to Tally successfully (Voucher: ${result.voucherNumber})`,
        });
      } else {
        res.status(400).json({ message: result.error });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to push credit note';
      logError('Failed to push credit note to Tally', error);
      res.status(400).json({ message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Supplier-Ledger Matching
  // ═══════════════════════════════════════════════════════════════════════════

  async getSuppliers(req: Request, res: Response) {
    try {
      const { page, limit, search, matchStatus, suggestions } = req.query;
      const result = await tallyService.getSuppliersWithTallyStatus(
        {
          page: page ? Number(page) : undefined,
          limit: limit ? Number(limit) : undefined,
          search: search as string | undefined,
          matchStatus: matchStatus as 'all' | 'matched' | 'unmatched' | undefined,
        },
        suggestions === 'true'
      );
      res.json({ data: result.data, pagination: result.pagination, stats: result.stats });
    } catch (error) {
      logError('Failed to get suppliers for Tally matching', error);
      res.status(500).json({ message: 'Failed to get suppliers' });
    }
  }

  async linkSupplier(req: Request, res: Response) {
    try {
      const { supplierId } = req.params;
      const { tallyLedgerName } = req.body;
      if (!tallyLedgerName) {
        return res.status(400).json({ message: 'tallyLedgerName is required' });
      }
      await tallyService.linkSupplierToTallyLedger(supplierId, tallyLedgerName);
      res.json({ message: 'Supplier linked to Tally ledger successfully' });
    } catch (error) {
      logError('Failed to link supplier to Tally ledger', error);
      res.status(500).json({ message: 'Failed to link supplier' });
    }
  }

  async unlinkSupplier(req: Request, res: Response) {
    try {
      const { supplierId } = req.params;
      await tallyService.unlinkSupplierFromTallyLedger(supplierId);
      res.json({ message: 'Supplier unlinked from Tally ledger successfully' });
    } catch (error) {
      logError('Failed to unlink supplier from Tally ledger', error);
      res.status(500).json({ message: 'Failed to unlink supplier' });
    }
  }

  async autoMatchSuppliers(_req: Request, res: Response) {
    try {
      const result = await tallyService.autoMatchSuppliers();
      res.json({
        data: result,
        message: `Auto-matched ${result.matched} of ${result.total} unmatched suppliers`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Auto-match failed';
      logError('Failed to auto-match suppliers', error);
      res.status(400).json({ message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Debit Note Push
  // ═══════════════════════════════════════════════════════════════════════════

  async getDebitNotes(req: Request, res: Response) {
    try {
      const { page, limit, search, pushStatus } = req.query;
      const result = await tallyService.getDebitNotesWithTallyStatus({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search as string | undefined,
        pushStatus: pushStatus as 'all' | 'pushed' | 'not_pushed' | 'error' | undefined,
      });
      res.json({ data: result.data, pagination: result.pagination });
    } catch (error) {
      logError('Failed to get debit notes for Tally push', error);
      res.status(500).json({ message: 'Failed to get debit notes' });
    }
  }

  async pushDebitNote(req: Request, res: Response) {
    try {
      const { debitNoteId } = req.params;
      const result = await tallyService.pushDebitNoteToTally(debitNoteId);
      if (result.success) {
        res.json({
          data: result,
          message: `Debit note pushed to Tally successfully (Voucher: ${result.voucherNumber})`,
        });
      } else {
        res.status(400).json({ message: result.error });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to push debit note';
      logError('Failed to push debit note to Tally', error);
      res.status(400).json({ message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Payment (Receipt) Push
  // ═══════════════════════════════════════════════════════════════════════════

  async getPayments(req: Request, res: Response) {
    try {
      const { page, limit, search, pushStatus } = req.query;
      const result = await tallyService.getPaymentsWithTallyStatus({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search as string | undefined,
        pushStatus: pushStatus as 'all' | 'pushed' | 'not_pushed' | 'error' | undefined,
      });
      res.json({ data: result.data, pagination: result.pagination });
    } catch (error) {
      logError('Failed to get payments for Tally push', error);
      res.status(500).json({ message: 'Failed to get payments' });
    }
  }

  async pushPayment(req: Request, res: Response) {
    try {
      const { paymentId } = req.params;
      const result = await tallyService.pushPaymentToTally(paymentId);
      if (result.success) {
        res.json({
          data: result,
          message: `Payment pushed to Tally successfully (Voucher: ${result.voucherNumber})`,
        });
      } else {
        res.status(400).json({ message: result.error });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to push payment';
      logError('Failed to push payment to Tally', error);
      res.status(400).json({ message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Outstanding / Receivables
  // ═══════════════════════════════════════════════════════════════════════════

  async getOutstanding(_req: Request, res: Response) {
    try {
      const result = await tallyService.getOutstandingBalances();
      res.json({ data: result.data, summary: result.summary, fetchedAt: result.fetchedAt });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch outstanding';
      logError('Failed to fetch outstanding from Tally', error);
      res.status(400).json({ message });
    }
  }
}

export const tallyController = new TallyController();
