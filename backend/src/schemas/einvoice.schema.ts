import { z } from 'zod';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

export const einvoiceSettingsUpdateSchema = z.object({
  einvEnabled: z.boolean().optional(),
  einvMode: z.enum(['SANDBOX', 'PRODUCTION']).optional(),
  einvProvider: z.enum(['NIC']).optional(),
  einvBaseUrl: z.string().url().nullable().or(z.literal('')).optional(),
  einvClientId: z.string().optional(),
  einvClientSecret: z.string().optional(),
  einvApiUsername: z.string().optional(),
  einvApiPassword: z.string().optional(),
  einvGstin: z.string().regex(GSTIN_REGEX, 'Invalid GSTIN format').or(z.literal('')).optional(),
  einvPublicKeyPem: z.string().nullable().optional(),
  einvAutoGenerateOnCreate: z.boolean().optional(),
});

export type EInvoiceSettingsUpdateBody = z.infer<typeof einvoiceSettingsUpdateSchema>;

// IRP cancel reason codes: 1=Duplicate, 2=Data entry mistake, 3=Order cancelled, 4=Others
export const einvoiceCancelSchema = z.object({
  reason: z.enum(['1', '2', '3', '4']),
  remarks: z.string().min(3, 'Remarks must be at least 3 characters').max(100),
});

export type EInvoiceCancelInput = z.infer<typeof einvoiceCancelSchema>;
