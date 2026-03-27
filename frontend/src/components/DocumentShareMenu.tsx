/**
 * Document Share Menu Component
 *
 * Provides download (PDF/Excel) and WhatsApp share functionality for documents.
 * Supports: Tax Invoice, Proforma Invoice, Order Form, Purchase Order
 */

import { useState } from 'react';
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
import { Download, FileSpreadsheet, FileText, Share2, MessageCircle, Loader2 } from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

export type DocumentType = 'invoice' | 'quotation' | 'order' | 'purchaseOrder';

interface DocumentShareMenuProps {
  documentType: DocumentType;
  documentId: string;
  documentNumber?: string;
  customerPhone?: string;
  className?: string;
}

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export function DocumentShareMenu({
  documentType,
  documentId,
  documentNumber,
  customerPhone,
  className = '',
}: DocumentShareMenuProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [phone, setPhone] = useState(customerPhone || '');

  // Get the appropriate API endpoint based on document type
  const getEndpoints = () => {
    switch (documentType) {
      case 'invoice':
        return {
          pdf: `${API_BASE}/documents/invoices/${documentId}/pdf`,
          excel: `${API_BASE}/documents/invoices/${documentId}/excel`,
          whatsapp: `${API_BASE}/documents/invoices/${documentId}/whatsapp-link`,
          label: 'Tax Invoice',
        };
      case 'quotation':
        return {
          pdf: `${API_BASE}/documents/quotations/${documentId}/proforma`,
          excel: null, // No Excel for proforma
          whatsapp: `${API_BASE}/documents/quotations/${documentId}/whatsapp-link`,
          label: 'Proforma Invoice',
        };
      case 'order':
        return {
          pdf: `${API_BASE}/documents/orders/${documentId}/order-form`,
          excel: null, // No Excel for order form
          whatsapp: null, // WhatsApp not implemented for order forms yet
          label: 'Order Form',
        };
      case 'purchaseOrder':
        return {
          pdf: `${API_BASE}/documents/purchase-orders/${documentId}/pdf`,
          excel: null, // No Excel for PO
          whatsapp: `${API_BASE}/documents/purchase-orders/${documentId}/whatsapp-link`,
          label: 'Purchase Order',
        };
      default:
        return null;
    }
  };

  const endpoints = getEndpoints();
  if (!endpoints) return null;

  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true);

      // Open in new tab to trigger download
      window.open(endpoints.pdf, '_blank');

      handleApiSuccess('Download Started', `${endpoints.label} PDF download has started.`);
    } catch (error) {
      handleApiError(error, `Failed to download ${endpoints.label} PDF`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!endpoints.excel) return;

    try {
      setIsDownloading(true);

      // Open in new tab to trigger download
      window.open(endpoints.excel, '_blank');

      handleApiSuccess('Download Started', `${endpoints.label} Excel download has started.`);
    } catch (error) {
      handleApiError(error, `Failed to download ${endpoints.label} Excel`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!endpoints.whatsapp) return;

    const cleanPhone = phone.replace(/[\s\-()]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      handleApiError(new Error('Please enter a valid phone number'), 'Invalid Phone');
      return;
    }

    try {
      setIsDownloading(true);

      const response = await fetch(`${endpoints.whatsapp}?phone=${encodeURIComponent(cleanPhone)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate WhatsApp link');
      }

      // Open WhatsApp link
      window.open(data.data.whatsappUrl, '_blank');
      setWhatsappDialogOpen(false);

      handleApiSuccess('WhatsApp Opened', 'WhatsApp has been opened with your message. Click send to share.');
    } catch (error) {
      handleApiError(error, 'Failed to generate WhatsApp link');
    } finally {
      setIsDownloading(false);
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

          {endpoints.whatsapp && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setWhatsappDialogOpen(true)} className="cursor-pointer">
                <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
                Share via WhatsApp
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* WhatsApp Share Dialog */}
      <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Share via WhatsApp
            </DialogTitle>
            <DialogDescription>
              Share {endpoints.label} {documentNumber ? `(${documentNumber})` : ''} via WhatsApp. The recipient will
              receive a message with a download link.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter phone number (e.g., 9876543210)"
              />
              <p className="text-xs text-gray-500">Include country code without + (e.g., 919876543210 for India)</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWhatsappDialogOpen(false)} disabled={isDownloading}>
              Cancel
            </Button>
            <Button
              onClick={handleShareWhatsApp}
              disabled={isDownloading || !phone.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  <Share2 className="mr-2 h-4 w-4" />
                  Open WhatsApp
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
