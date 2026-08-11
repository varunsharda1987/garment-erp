import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import * as wa from '../services/whatsapp.service';
import documentGeneratorService from '../services/document-generator.service';
import { documentFacadeService } from '../services/document-facade.service';
import { ValidationError } from '../errors';

// Maps a document type → its label + PDF generator (all return a Buffer, which sendPdf takes).
// Invoice + PO route through the facade (kf design with pdfkit fallback); quotation/order
// stay on pdfkit until their kf templates exist (Phase B).
const DOC_META: Record<string, { label: string; generate: (id: string) => Promise<Buffer> }> = {
  invoice: { label: 'Tax Invoice', generate: (id) => documentFacadeService.generateInvoicePDF(id) },
  quotation: { label: 'Proforma Invoice', generate: (id) => documentGeneratorService.generateProformaPDF(id, {}) },
  order: { label: 'Order Form', generate: (id) => documentGeneratorService.generateOrderFormPDF(id, {}) },
  purchaseOrder: {
    label: 'Purchase Order',
    generate: (id) => documentFacadeService.generatePurchaseOrderPDF(id),
  },
};

/** One recipient's send outcome — a batch never aborts on a single failure. */
interface SendResult {
  label?: string;
  to?: string;
  error?: string;
}

/**
 * WhatsApp controller — every handler acts on the LOGGED-IN user's own session
 * (userId from req.user), so messages route through that user's own linked number.
 */

// GET /api/whatsapp/status — link status + QR (while linking) for the current user.
export const statusHandler = async (req: Request, res: Response) => {
  res.json(wa.getStatusForUser(req.user!.userId));
};

// POST /api/whatsapp/connect — start a session / (re-)show the QR for the current user.
export const connectHandler = async (req: Request, res: Response) => {
  await wa.connectForUser(req.user!.userId);
  res.json(wa.getStatusForUser(req.user!.userId));
};

// POST /api/whatsapp/disconnect — unlink the current user's WhatsApp (forces a re-scan).
export const disconnectHandler = async (req: Request, res: Response) => {
  await wa.disconnectForUser(req.user!.userId);
  res.json(wa.getStatusForUser(req.user!.userId));
};

// POST /api/whatsapp/send-text — send a plain text message through the current user's WhatsApp.
export const sendTextHandler = async (req: Request, res: Response) => {
  const { to, text } = req.body as { to: string; text: string };
  const result = await wa.sendTextForUser(req.user!.userId, to, text);
  res.json({ data: result, message: 'Message sent' });
};

// GET /api/whatsapp/staff-directory — active staff who have a WhatsApp number on file, so the
// composer can list/group them. Used for internal department-to-department messaging.
export const staffDirectoryHandler = async (_req: Request, res: Response) => {
  const users = await prisma.users.findMany({
    where: { isActive: true, whatsappNumber: { not: null } },
    select: { id: true, firstName: true, lastName: true, role: true, department: true, whatsappNumber: true },
    orderBy: [{ department: 'asc' }, { firstName: 'asc' }],
  });
  const data = users.map((u) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`.trim(),
    role: u.role,
    department: u.department,
    whatsappNumber: u.whatsappNumber,
  }));
  res.json({ data });
};

// POST /api/whatsapp/message-staff — message a set of staff and/or a whole department. Every
// message routes through the LOGGED-IN sender's own WhatsApp. One bad recipient never aborts
// the batch; results are returned per-recipient.
export const messageStaffHandler = async (req: Request, res: Response) => {
  const senderId = req.user!.userId;
  const { userIds, department, text } = req.body as { userIds?: string[]; department?: string; text: string };

  // Resolve recipients (active, has a WhatsApp number, and never the sender themselves).
  const orFilters: Prisma.usersWhereInput[] = [];
  if (userIds && userIds.length) orFilters.push({ id: { in: userIds } });
  if (department) orFilters.push({ department });

  const recipients = await prisma.users.findMany({
    where: {
      isActive: true,
      whatsappNumber: { not: null },
      id: { not: senderId },
      ...(orFilters.length ? { OR: orFilters } : {}),
    },
    select: { id: true, firstName: true, lastName: true, whatsappNumber: true },
  });

  if (!recipients.length) {
    res.json({ data: { results: [] as SendResult[] }, message: 'No recipients with a WhatsApp number were found' });
    return;
  }

  const results: SendResult[] = [];
  for (const r of recipients) {
    const label = `${r.firstName} ${r.lastName}`.trim();
    try {
      const { to } = await wa.sendTextForUser(senderId, r.whatsappNumber as string, text);
      results.push({ label, to });
    } catch (e) {
      results.push({ label, error: e instanceof Error ? e.message : String(e) });
    }
  }
  res.json({ data: { results } });
};

// POST /api/whatsapp/send-document — generate a document PDF and send it straight into a chat
// through the LOGGED-IN user's own WhatsApp (replaces the old wa.me click-to-share links).
export const sendDocumentHandler = async (req: Request, res: Response) => {
  const { type, id, to, caption } = req.body as { type: string; id: string; to: string; caption?: string };
  const meta = DOC_META[type];
  if (!meta) {
    throw new ValidationError(`Unsupported document type: ${type}`);
  }
  const buffer = await meta.generate(id);
  const filename = `${meta.label.replace(/\s+/g, '_')}_${id.slice(0, 8)}.pdf`;
  const result = await wa.sendPdfForUser(req.user!.userId, to, caption?.trim() || meta.label, buffer, filename);
  res.json({ data: result, message: `${meta.label} sent on WhatsApp` });
};
