import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody } from '../middleware/validation.middleware';
import {
  statusHandler,
  connectHandler,
  disconnectHandler,
  sendTextHandler,
  staffDirectoryHandler,
  messageStaffHandler,
  sendDocumentHandler,
  groupsHandler,
} from '../controllers/whatsapp.controller';
import { sendTextSchema, messageStaffSchema, sendDocumentSchema } from '../schemas/whatsapp.schema';

const router = Router();

// Every WhatsApp action is scoped to the logged-in user's own session.
router.use(authenticateToken);

// Link status + QR (while linking) for the current user.
router.get('/status', asyncHandler(statusHandler));

// Start a session / (re-)show the QR. no-body
router.post('/connect', asyncHandler(connectHandler));

// Unlink the current user's WhatsApp (wipes their saved session). no-body
router.post('/disconnect', asyncHandler(disconnectHandler));

// Send a plain text message through the current user's linked WhatsApp.
router.post('/send-text', validateBody(sendTextSchema), asyncHandler(sendTextHandler));

// Internal staff messaging: directory of messageable staff + batch send to users/department.
router.get('/staff-directory', asyncHandler(staffDirectoryHandler));
router.post('/message-staff', validateBody(messageStaffSchema), asyncHandler(messageStaffHandler));

// The current user's WhatsApp groups (id + name) — recipient picker for document sharing.
router.get('/groups', asyncHandler(groupsHandler));

// Send a generated document PDF (invoice/quotation/order/PO/JWO) into one or more chats
// via the sender's number.
router.post('/send-document', validateBody(sendDocumentSchema), asyncHandler(sendDocumentHandler));

export default router;
