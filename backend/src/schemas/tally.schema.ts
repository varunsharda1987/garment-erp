import { z } from 'zod';

export const tallySettingsUpdateSchema = z.object({
  tallyEnabled: z.boolean().optional(),
  tallyHost: z.string().min(1).optional(),
  tallyPort: z.number().int().min(1).max(65535).optional(),
  tallyCompanyName: z.string().nullable().optional(),
  tallyPartyGroup: z.string().optional(),
  tallyVoucherType: z.string().optional(),
  tallySalesLedgerIntra: z.string().optional(),
  tallySalesLedgerInter: z.string().optional(),
  tallyCgstLedger: z.string().optional(),
  tallySgstLedger: z.string().optional(),
  tallyIgstLedger: z.string().optional(),
  tallyCgstLedger18: z.string().optional(),
  tallySgstLedger18: z.string().optional(),
  tallyIgstLedger18: z.string().optional(),
  tallyRoundOffLedger: z.string().optional(),
  tallyFreightLedger: z.string().optional(),
  tallyGodownName: z.string().optional(),
  tallyStockUnit: z.string().optional(),
});

export type TallySettingsUpdateInput = z.infer<typeof tallySettingsUpdateSchema>;

export const tallyLinkCustomerSchema = z.object({
  tallyLedgerName: z.string().min(1, 'Tally ledger name is required'),
});

export type TallyLinkCustomerInput = z.infer<typeof tallyLinkCustomerSchema>;

export const tallyLinkSupplierSchema = z.object({
  tallyLedgerName: z.string().min(1, 'Tally ledger name is required'),
});

export type TallyLinkSupplierInput = z.infer<typeof tallyLinkSupplierSchema>;
