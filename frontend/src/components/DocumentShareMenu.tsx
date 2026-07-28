/**
 * Document Share Menu Component
 *
 * Provides download (PDF/Excel) and WhatsApp send for documents.
 * WhatsApp now sends the real PDF straight into the chat through the logged-in user's OWN
 * linked WhatsApp number (whatsapp-web.js), replacing the old wa.me click-to-share links.
 * Supports: Tax Invoice, Proforma Invoice, Order Form, Purchase Order
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Download, FileSpreadsheet, FileText, MessageCircle, Loader2 } from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { openPDF, downloadFile } from '@/lib/document-utils';
import { whatsappService } from '@/services/whatsapp.service';
import { useWhatsappStatus } from '@/hooks/useWhatsapp';

export type DocumentType = 'invoice' | 'quotation' | 'order' | 'purchaseOrder';

interface DocumentShareMenuProps {
  documentType: DocumentType;
  documentId: string;
  documentNumber?: string;
  customerPhone?: string;
  className?: string;
}

const LABELS: Record<DocumentType, string> = {
  invoice: 'Tax Invoice',
  quotation: 'Proforma Invoice',
  order: 'Order Form',
  purchaseOrder: 'Purchase Order',
};

export function DocumentShareMenu({
  documentType,
  documentId,
  documentNumber,
  customerPhone,
  className = '',
}: DocumentShareMenuProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [phone, setPhone] = useState(customerPhone || '');
  const [caption, setCaption] = useState('');

  const { data: waStatus } = useWhatsappStatus();
  const waLinked = waStatus?.state === 'ready';

  const label = LABELS[documentType];

  // PDF/Excel endpoints for download (relative paths for api client).
  const getDownloadEndpoints = () => {
    switch (documentType) {
      case 'invoice':
        return { pdf: `/documents/invoices/${documentId}/pdf`, excel: `/documents/invoices/${documentId}/excel` };
      case 'quotation':
        return { pdf: `/documents/quotations/${documentId}/proforma`, excel: null };
      case 'order':
        return { pdf: `/documents/orders/${documentId}/order-form`, excel: null };
      case 'purchaseOrder':
        return { pdf: `/documents/purchase-orders/${documentId}/pdf`, excel: null };
      default:
        return { pdf: '', excel: null };
    }
  };

  const endpoints = getDownloadEndpoints();

  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true);
      await openPDF(endpoints.pdf);
      handleApiSuccess('Download Started', `${label} PDF opened in new tab.`);
    } catch (error) {
      handleApiError(error, `Failed to download ${label} PDF`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!endpoints.excel) return;
    try {
      setIsDownloading(true);
      await downloadFile(endpoints.excel, `${label}.xlsx`);
      handleApiSuccess('Download Started', `${label} Excel download has started.`);
    } catch (error) {
      handleApiError(error, `Failed to download ${label} Excel`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendWhatsApp = async () => {
    const cleanPhone = phone.replace(/[\s\-()]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      handleApiError(new Error('Please enter a valid phone number'), 'Invalid Phone');
      return;
    }
    try {
      setIsSending(true);
      await whatsappService.sendDocument({
        type: documentType,
        id: documentId,
        to: cleanPhone,
        caption: caption.trim() || undefined,
      });
      setWhatsappDialogOpen(false);
      handleApiSuccess('Sent on WhatsApp', `${label} delivered to the chat from your number.`);
    } catch (error) {
      handleApiError(error, 'Failed to send on WhatsApp');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={`gap-2 ${className}`} disabled={isDownloading}>
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={handleDownloadPDF} className="cursor-pointer">
            <FileText className="mr-2 h-4 w-4" />
            Download PDF
          </DropdownMenuItem>

          {endpoints.excel && (
            <DropdownMenuItem onClick={handleDownloadExcel} className="cursor-pointer">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Download Excel
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setWhatsappDialogOpen(true)} className="cursor-pointer">
            <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
            Send via WhatsApp
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* WhatsApp Send Dialog — sends the real PDF through the user's own linked number */}
      <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Send via WhatsApp
            </DialogTitle>
            <DialogDescription>
              Sends {label} {documentNumber ? `(${documentNumber})` : ''} as a PDF straight into the chat, from your own
              WhatsApp number.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="wa-phone">Recipient Phone Number</Label>
              <Input
                id="wa-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g., 919876543210"
              />
              <p className="text-xs text-muted-foreground">Include country code without + (e.g., 91… for India).</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-caption">Message (optional)</Label>
              <Textarea
                id="wa-caption"
                rows={3}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={`Sent with the ${label}.`}
              />
            </div>
            {!waLinked && (
              <p className="text-sm text-amber-700">
                Your WhatsApp isn’t linked yet.{' '}
                <Link to="/whatsapp" className="font-medium underline">
                  Link it in My WhatsApp
                </Link>{' '}
                to send.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWhatsappDialogOpen(false)} disabled={isSending}>
              Cancel
            </Button>
            <Button
              onClick={handleSendWhatsApp}
              disabled={isSending || !waLinked || !phone.trim()}
              className="bg-[#25D366] text-white hover:bg-[#1ebe5b]"
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Send on WhatsApp
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default DocumentShareMenu;
