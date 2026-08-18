/**
 * WhatsApp Messaging Validation Schemas
 *
 * SINGLE SOURCE OF TRUTH for the WhatsApp send endpoints. Each field here must match what the
 * corresponding controller reads from req.body (schema↔controller alignment guardrail).
 */

import { z } from 'zod';

/**
 * Send a plain text message through the logged-in user's own linked WhatsApp.
 * POST /api/whatsapp/send-text
 */
export const sendTextSchema = z.object({
  to: z.string().min(1, 'Recipient is required').max(64),
  text: z.string().min(1, 'Message is required').max(4096),
});

/**
 * Message internal staff (a set of users and/or a whole department) — Phase 2.
 * POST /api/whatsapp/message-staff
 */
export const messageStaffSchema = z
  .object({
    userIds: z.array(z.string().uuid()).max(500).optional(),
    department: z.string().max(100).optional(),
    text: z.string().min(1, 'Message is required').max(4096),
  })
  .refine((d) => (d.userIds && d.userIds.length > 0) || !!d.department, {
    message: 'Pick at least one staff member or a department',
    path: ['userIds'],
  });

/**
 * Notify the buyer that a sample was couriered — Phase 3.
 * POST /api/samples/:id/notify-buyer
 */
export const notifyBuyerSchema = z.object({
  to: z.string().min(1).max(64).optional(),
  text: z.string().max(4096).optional(),
});

/**
 * Send a generated document PDF through the sender's WhatsApp — Phase 4.
 * POST /api/whatsapp/send-document
 *
 * Recipients: either the single `to` (back-compat with DocumentShareMenu) or a
 * `recipients` list (job work orders fan out to processor + groups + numbers in one
 * call — the PDF is generated once server-side).
 */
export const sendDocumentSchema = z
  .object({
    type: z.enum(['invoice', 'quotation', 'order', 'purchaseOrder', 'jobWorkOrder']),
    id: z.string().uuid(),
    to: z.string().min(1, 'Recipient is required').max(64).optional(),
    caption: z.string().max(4096).optional(),
    recipients: z
      .array(
        z.object({
          to: z.string().min(1, 'Recipient is required').max(64),
          label: z.string().max(120).optional(),
        })
      )
      .min(1)
      .max(10)
      .optional(),
  })
  .refine((d) => !!d.to || (d.recipients && d.recipients.length > 0), {
    message: 'Provide a recipient (to) or a recipients list',
    path: ['to'],
  });

export type SendTextInput = z.infer<typeof sendTextSchema>;
export type MessageStaffInput = z.infer<typeof messageStaffSchema>;
export type NotifyBuyerInput = z.infer<typeof notifyBuyerSchema>;
export type SendDocumentInput = z.infer<typeof sendDocumentSchema>;
