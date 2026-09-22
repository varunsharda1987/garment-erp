/**
 * The customer's purchase orders, read-only.
 *
 * Shown on the delivery note and the invoice so dispatch and accounts can open the buyer's own PO
 * paperwork without going and asking sales for a forward. Uploading and editing live on the sale
 * order page — this is the viewing half only.
 */

import { FileText, MapPin, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { openUploadedFile } from '@/lib/document-utils';
import { getErrorMessage } from '@/lib/api-error-handler';
import { formatDate } from '@/lib/date';

export interface BuyerPoSummary {
  id: string;
  buyerPoNumber: string;
  isPrimary?: boolean;
  poDate?: string | null;
  documentUrl?: string | null;
  documentName?: string | null;
  deliveryAddress?: { id: string; label: string; city?: { cityName: string } | null } | null;
}

interface BuyerPoCardProps {
  buyerPos?: BuyerPoSummary[] | null;
  /** Shown as the card's subtitle so it is obvious which order these POs belong to. */
  saleOrderNumber?: string | null;
}

export function BuyerPoCard({ buyerPos, saleOrderNumber }: BuyerPoCardProps) {
  // Nothing to show is the normal case for a note or invoice raised from a production order —
  // those carry no sale-order link at all — so render nothing rather than an empty card.
  if (!buyerPos || buyerPos.length === 0) return null;

  const openDocument = (po: BuyerPoSummary) => {
    // The tab has to be opened synchronously, inside the click, or the popup blocker eats it:
    // the PO file is fetched with auth and only becomes a blob URL after the await.
    const tab = window.open('', '_blank');
    openUploadedFile(po.documentUrl!, po.documentName || 'purchase-order', tab).catch((err) =>
      toast.error(getErrorMessage(err))
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Buyer PO{buyerPos.length > 1 ? 's' : ''}
          {saleOrderNumber && <span className="font-normal text-muted-foreground">· {saleOrderNumber}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {buyerPos.map((po) => (
            <div key={po.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-muted text-sm">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {po.isPrimary && <Star className="h-3 w-3 text-info fill-info" />}
                  <span className="font-mono font-medium">{po.buyerPoNumber}</span>
                  {po.isPrimary && (
                    <Badge variant="outline" className="text-xs">
                      Primary
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {po.deliveryAddress
                      ? `${po.deliveryAddress.label}${po.deliveryAddress.city?.cityName ? `, ${po.deliveryAddress.city.cityName}` : ''}`
                      : 'No location set'}
                  </span>
                  {po.poDate && <span>PO dated {formatDate(new Date(po.poDate))}</span>}
                </div>
              </div>
              {po.documentUrl ? (
                <button
                  type="button"
                  className="flex items-center gap-1 text-info hover:underline shrink-0 text-xs"
                  onClick={() => openDocument(po)}
                >
                  <FileText className="h-3 w-3" />
                  View PO
                </button>
              ) : (
                <span className="text-xs text-muted-foreground italic shrink-0">No document</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
