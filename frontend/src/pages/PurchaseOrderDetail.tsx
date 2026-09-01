import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  getPurchaseOrderById,
  sendPurchaseOrder,
  acknowledgePurchaseOrder,
  cancelPurchaseOrder,
  shortClosePurchaseOrder,
  amendDeliveryLocation,
} from '@/services/purchaseOrder.service';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/purchaseOrder.types';
import {
  PurchaseOrderStatusLabels,
  PO_CATEGORY_LABELS,
  PO_CATEGORY_COLORS,
  POSourceLabels,
} from '@/types/purchaseOrder.types';
import { Badge } from '@/components/ui/badge';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { notify } from '@/lib/notify';
import { formatCurrency } from '@/lib/currency';
import {
  ArrowLeft,
  Edit,
  Send,
  CheckCircle,
  XCircle,
  PackageOpen,
  Building2,
  MapPin,
  PenLine,
  FileMinus,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { WarehouseCombobox } from '@/components/WarehouseCombobox';
import { DocumentShareMenu } from '@/components/DocumentShareMenu';
import { COMPANY_CONFIG, getCompanyFullAddress } from '@/config/company.config';
import { formatStyleCodeWithRef } from '@/utils/style-ref-format';

// Extended types for PO relations not yet in the base PurchaseOrder type
// NOTE: the backend serializer maps the Prisma `styles` relation key to `style`
// in API responses (see backend/src/utils/serializer.ts RELATION_MAPPINGS).
interface POSourceLink {
  id: string;
  sourceType: string;
  materialRequirement?: {
    requirementNumber?: string;
    orderItems?: {
      style?: { id: string; styleCode: string; buyerStyleRef?: string | null };
    };
  };
  serviceRequirement?: {
    serviceType?: string;
    workOrder?: {
      style?: { id: string; styleCode: string; buyerStyleRef?: string | null };
    };
  };
  productionRun?: {
    workOrderNumber?: string;
    style?: { id: string; styleCode: string; buyerStyleRef?: string | null };
  };
}

interface RequirementPOLink {
  materialRequirements?: {
    orderItems?: {
      style?: { id: string; styleCode: string; buyerStyleRef?: string | null };
    };
  };
}

interface ExtendedPurchaseOrder extends PurchaseOrder {
  requirementPoLinks?: RequirementPOLink[];
  poSourceLinks?: POSourceLink[];
}

interface ExtendedPOItem {
  componentName?: string;
  colorName?: string;
  /** CAD cutable width snapshot — planning-internal, never displayed bare */
  fabricWidth?: number;
  materials?: {
    /** Greige loom width — the width actually being ORDERED on a greige PO */
    greigeMaster?: { greigeWidth?: number | string | null } | null;
    /** Actual width of a ready fabric being bought */
    fabricMaster?: { actualWidth?: number | string | null } | null;
  };
}

/** Width of what is being ordered: greige loom width, else ready-fabric actual width. */
function orderedWidthLabel(item: ExtendedPOItem): string {
  const greigeWidth = item.materials?.greigeMaster?.greigeWidth;
  if (greigeWidth != null) return `${Number(greigeWidth)}" greige`;
  const fabricWidth = item.materials?.fabricMaster?.actualWidth;
  if (fabricWidth != null) return `${Number(fabricWidth)}" fabric`;
  return '-';
}

interface GRNItem {
  receivedQuantity: number;
}

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [acknowledgeDialogOpen, setAcknowledgeDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [shortCloseDialogOpen, setShortCloseDialogOpen] = useState(false);
  const [shortCloseReason, setShortCloseReason] = useState('');
  const [shortCloseReorder, setShortCloseReorder] = useState(false);
  const [isShortClosing, setIsShortClosing] = useState(false);
  const [amendLocationDialogOpen, setAmendLocationDialogOpen] = useState(false);
  const [amendLocationId, setAmendLocationId] = useState<string>('');
  const [isAmending, setIsAmending] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPurchaseOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchPurchaseOrder = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const po = await getPurchaseOrderById(id!);
      setPurchaseOrder(po);
    } catch (err) {
      setError(handleApiError(err, 'Failed to fetch purchase order', false));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    try {
      await sendPurchaseOrder(id!);
      handleApiSuccess('Purchase order sent', 'The purchase order has been sent to the supplier.');
      fetchPurchaseOrder();
    } catch (err) {
      handleApiError(err, 'Failed to send purchase order');
    } finally {
      setSendDialogOpen(false);
    }
  };

  const handleAcknowledge = async () => {
    try {
      await acknowledgePurchaseOrder(id!);
      handleApiSuccess('Purchase order acknowledged', 'The purchase order has been acknowledged.');
      fetchPurchaseOrder();
    } catch (err) {
      handleApiError(err, 'Failed to acknowledge purchase order');
    } finally {
      setAcknowledgeDialogOpen(false);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelPurchaseOrder(id!, { reason: 'Cancelled by user' });
      handleApiSuccess('Purchase order cancelled', 'The purchase order has been cancelled.');
      fetchPurchaseOrder();
    } catch (err) {
      handleApiError(err, 'Failed to cancel purchase order');
    } finally {
      setCancelDialogOpen(false);
    }
  };

  const handleShortClose = async () => {
    if (!shortCloseReason.trim()) {
      handleApiError(new Error('Please say why this order is being closed short'), 'Reason required');
      return;
    }
    try {
      setIsShortClosing(true);
      const { warnings } = await shortClosePurchaseOrder(id!, {
        reason: shortCloseReason.trim(),
        reorderBalance: shortCloseReorder,
      });
      handleApiSuccess(
        'Purchase order closed short',
        shortCloseReorder
          ? 'The order is closed at the delivered quantity and the balance was carried forward for re-ordering.'
          : 'The order is closed at the delivered quantity. The balance will not be re-ordered.'
      );
      // Never silent: the order is closed either way, but a failed downstream reconciliation needs
      // a human to look at the linked processing PO.
      for (const w of warnings) notify.warning(w);
      setShortCloseDialogOpen(false);
      setShortCloseReason('');
      setShortCloseReorder(false);
      fetchPurchaseOrder();
    } catch (err) {
      handleApiError(err, 'Failed to close purchase order short');
    } finally {
      setIsShortClosing(false);
    }
  };

  const handleAmendLocation = async () => {
    if (!amendLocationId) {
      handleApiError(new Error('Please select a delivery location'), 'Validation Error');
      return;
    }
    try {
      setIsAmending(true);
      await amendDeliveryLocation(id!, {
        deliveryLocationId: amendLocationId,
      });
      handleApiSuccess('Delivery location amended', 'The delivery location has been updated.');
      fetchPurchaseOrder();
    } catch (err) {
      handleApiError(err, 'Failed to amend delivery location');
    } finally {
      setIsAmending(false);
      setAmendLocationDialogOpen(false);
    }
  };

  // Check if location is amended
  const isDeliveryLocationAmended =
    purchaseOrder?.originalDeliveryLocationId &&
    purchaseOrder?.deliveryLocationId &&
    purchaseOrder.originalDeliveryLocationId !== purchaseOrder.deliveryLocationId;

  // Check if PO can have its delivery location amended (not received/cancelled)
  const canAmendLocation = !['RECEIVED', 'SHORT_CLOSED', 'CANCELLED'].includes(purchaseOrder?.status ?? '');

  const getStatusVariant = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'DRAFT':
        return 'secondary';
      case 'SENT':
        return 'info';
      case 'ACKNOWLEDGED':
        return 'info';
      case 'PARTIALLY_RECEIVED':
        return 'warning';
      case 'RECEIVED':
        return 'success';
      case 'SHORT_CLOSED':
        return 'warning';
      case 'CANCELLED':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const calculateReceivingProgress = () => {
    if (!purchaseOrder?.items?.length) return 0;
    const totalOrdered = purchaseOrder.items.reduce((sum, item) => sum + Number(item.orderedQuantity), 0);
    const totalReceived = purchaseOrder.items.reduce((sum, item) => sum + Number(item.receivedQuantity), 0);
    return totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
  };

  // Extract linked style numbers from requirement_po_links or po_source_links
  const linkedStyles = useMemo(() => {
    if (!purchaseOrder) return [];
    const styles = new Map<string, { code: string; ref?: string | null }>();
    const po = purchaseOrder as ExtendedPurchaseOrder;
    // MRP path: requirement_po_links → material_requirements → order_items → styles
    const reqLinks = po.requirementPoLinks || [];
    for (const link of reqLinks) {
      const style = link.materialRequirements?.orderItems?.style;
      if (style?.styleCode) styles.set(style.id, { code: style.styleCode, ref: style.buyerStyleRef });
    }
    // Unified path: po_source_links → materialRequirement → order_items → style
    const srcLinks = po.poSourceLinks || [];
    for (const link of srcLinks) {
      const style = link.materialRequirement?.orderItems?.style;
      if (style?.styleCode) styles.set(style.id, { code: style.styleCode, ref: style.buyerStyleRef });
      const pStyle = link.productionRun?.style;
      if (pStyle?.styleCode) styles.set(pStyle.id, { code: pStyle.styleCode, ref: pStyle.buyerStyleRef });
      // Service requirement path: serviceRequirement → workOrder → style
      const svcStyle = link.serviceRequirement?.workOrder?.style;
      if (svcStyle?.styleCode) styles.set(svcStyle.id, { code: svcStyle.styleCode, ref: svcStyle.buyerStyleRef });
    }
    return [...styles.values()];
  }, [purchaseOrder]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-8">Loading purchase order details...</div>
      </div>
    );
  }

  if (error || !purchaseOrder) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">{error || 'Purchase order not found'}</div>
            <div className="text-center mt-4">
              <Button onClick={() => navigate('/procurement/purchase-orders')}>Back to Purchase Orders</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const receivingProgress = calculateReceivingProgress();

  const canEdit = ['DRAFT', 'PENDING_GREIGE', 'READY_FOR_PROCESSING'].includes(purchaseOrder.status);
  const canSend = purchaseOrder.status === 'DRAFT' || purchaseOrder.status === 'READY_FOR_PROCESSING';
  const canAcknowledge = purchaseOrder.status === 'SENT';
  const canReceive = ['SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'].includes(purchaseOrder.status);
  // PARTIALLY_RECEIVED is deliberately excluded: once goods have been delivered, cancel
  // misrepresents history (supplier ledger, payments and GST all saw a real receipt). The honest
  // exit for a part-delivered order is Close Short.
  const canCancel = !['PARTIALLY_RECEIVED', 'RECEIVED', 'SHORT_CLOSED', 'CANCELLED'].includes(purchaseOrder.status);
  // Only a part-delivered order can be closed short — there is nothing to close short about an
  // order the supplier never delivered against (that one is cancelled) or delivered in full.
  const canShortClose = purchaseOrder.status === 'PARTIALLY_RECEIVED';
  // Per line, with its unit. A single summed number is meaningless the moment a PO mixes units
  // (60 metres of fabric + 200 pieces of buttons is not "260"), and this decision is irreversible.
  const shortCloseLines = (purchaseOrder.items ?? []).map((item) => ({
    id: item.id,
    label: item.materials ? `${item.materials.code} — ${item.materials.name}` : item.serviceDescription || 'Item',
    ordered: Number(item.orderedQuantity),
    received: Number(item.receivedQuantity),
    balance: Math.max(0, Number(item.orderedQuantity) - Number(item.receivedQuantity)),
    unit: item.unit,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/procurement/purchase-orders')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-display font-medium">{purchaseOrder.poNumber}</h1>
            <p className="text-sm text-muted-foreground">Created on {formatDate(purchaseOrder.createdAt)}</p>
          </div>
          <StatusBadge
            status={PurchaseOrderStatusLabels[purchaseOrder.status]}
            variant={getStatusVariant(purchaseOrder.status)}
          />
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="outline" onClick={() => navigate(`/procurement/purchase-orders/${id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {canSend && (
            <Button onClick={() => setSendDialogOpen(true)}>
              <Send className="h-4 w-4 mr-2" />
              Send to Supplier
            </Button>
          )}
          {canAcknowledge && (
            <Button variant="outline" onClick={() => setAcknowledgeDialogOpen(true)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Acknowledge
            </Button>
          )}
          {canReceive && (
            <Button onClick={() => navigate(`/procurement/grn/new?poId=${id}`)}>
              <PackageOpen className="h-4 w-4 mr-2" />
              Receive Goods
            </Button>
          )}
          {canShortClose && (
            <Button variant="outline" onClick={() => setShortCloseDialogOpen(true)}>
              <FileMinus className="h-4 w-4 mr-2" />
              Close Short
            </Button>
          )}
          {canCancel && (
            <Button variant="destructive" onClick={() => setCancelDialogOpen(true)}>
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
          <DocumentShareMenu
            documentType="purchaseOrder"
            documentId={id!}
            documentNumber={purchaseOrder.poNumber}
            customerPhone={purchaseOrder.supplier?.phone || ''}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Amount</div>
            <div className="text-2xl font-bold">{formatCurrency(purchaseOrder.totalAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Items</div>
            <div className="text-2xl font-bold">{purchaseOrder.items?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Expected Delivery</div>
            <div className="text-2xl font-bold">{formatDate(purchaseOrder.expectedDeliveryDate)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Receiving Progress</div>
            <div className="flex items-center gap-2">
              <Progress value={receivingProgress} className="h-2 flex-1" />
              <span className="text-sm font-medium">{receivingProgress}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PO Source & Category */}
      {(purchaseOrder.poCategory || purchaseOrder.poSource || linkedStyles.length > 0) && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 flex-wrap">
              {purchaseOrder.poCategory && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Category</div>
                  <Badge className={PO_CATEGORY_COLORS[purchaseOrder.poCategory] || 'bg-muted text-foreground'}>
                    {PO_CATEGORY_LABELS[purchaseOrder.poCategory] || purchaseOrder.poCategory}
                  </Badge>
                </div>
              )}
              {purchaseOrder.poSource && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Source</div>
                  <Badge variant="outline">{POSourceLabels[purchaseOrder.poSource] || purchaseOrder.poSource}</Badge>
                </div>
              )}
              {linkedStyles.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Style(s)</div>
                  <div className="flex gap-1">
                    {linkedStyles.map((s) => (
                      <Badge key={s.code} variant="outline" className="text-xs">
                        {formatStyleCodeWithRef(s.code, s.ref)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {(purchaseOrder as ExtendedPurchaseOrder).poSourceLinks?.length &&
                (purchaseOrder as ExtendedPurchaseOrder).poSourceLinks!.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Linked To</div>
                    <div className="flex gap-1">
                      {(purchaseOrder as ExtendedPurchaseOrder).poSourceLinks!.map((link) => (
                        <Badge key={link.id} variant="secondary" className="text-xs">
                          {link.materialRequirement?.requirementNumber ||
                            link.serviceRequirement?.serviceType ||
                            link.productionRun?.workOrderNumber ||
                            link.sourceType}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Company & Supplier Info - Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Company (Buyer) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              From (Buyer)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="font-semibold text-lg">{COMPANY_CONFIG.name}</div>
            <div className="text-sm text-muted-foreground">{getCompanyFullAddress()}</div>
            <div className="text-sm">
              <span className="font-medium">GSTIN:</span> {COMPANY_CONFIG.gstin}
            </div>
            <div className="text-sm">
              <span className="font-medium">Phone:</span> {COMPANY_CONFIG.phone}
            </div>
            <div className="text-sm">
              <span className="font-medium">Email:</span> {COMPANY_CONFIG.email}
            </div>
          </CardContent>
        </Card>

        {/* Supplier (To) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              To (Supplier)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="font-semibold text-lg">{purchaseOrder.supplier?.name || '-'}</div>
            <div className="text-sm text-muted-foreground">{purchaseOrder.supplier?.code}</div>
            <div className="text-sm text-muted-foreground">
              {[
                purchaseOrder.supplier?.address,
                purchaseOrder.supplier?.billingCity?.cityName,
                purchaseOrder.supplier?.billingState?.stateName,
                purchaseOrder.supplier?.billingPincode,
              ]
                .filter(Boolean)
                .join(', ') || 'Address not available'}
            </div>
            <div className="text-sm">
              <span className="font-medium">GSTIN:</span>{' '}
              {purchaseOrder.supplier?.gstNumbers?.find((g) => g.isPrimary)?.gstNumber ||
                purchaseOrder.supplier?.gstNumbers?.[0]?.gstNumber ||
                'Not available'}
            </div>
            <div className="text-sm">
              <span className="font-medium">Phone:</span> {purchaseOrder.supplier?.phone || '-'}
            </div>
            <div className="text-sm">
              <span className="font-medium">Email:</span> {purchaseOrder.supplier?.email || '-'}
            </div>
            {purchaseOrder.supplier?.contactPerson && (
              <div className="text-sm">
                <span className="font-medium">Contact:</span> {purchaseOrder.supplier.contactPerson}
              </div>
            )}
            {purchaseOrder.paymentTerms && (
              <div className="text-sm pt-2 border-t mt-2">
                <span className="font-medium">Payment Terms:</span> {purchaseOrder.paymentTerms}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delivery Location */}
      {purchaseOrder.deliveryWarehouse && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Deliver To
              </CardTitle>
              <div className="flex items-center gap-2">
                {isDeliveryLocationAmended && (
                  <Badge variant="outline" className="text-xs border-amber-300 bg-amber-100 text-amber-800">
                    Amended
                  </Badge>
                )}
                {canAmendLocation && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAmendLocationId(purchaseOrder.deliveryLocationId || '');
                      setAmendLocationDialogOpen(true);
                    }}
                  >
                    <PenLine className="h-3.5 w-3.5 mr-1" />
                    Change
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="font-semibold text-lg">{purchaseOrder.deliveryWarehouse.warehouseName}</div>
            <div className="text-sm text-muted-foreground">{purchaseOrder.deliveryWarehouse.warehouseCode}</div>
            <div className="text-sm text-muted-foreground">
              {[
                purchaseOrder.deliveryWarehouse.address,
                purchaseOrder.deliveryWarehouse.city,
                purchaseOrder.deliveryWarehouse.state,
                purchaseOrder.deliveryWarehouse.pincode,
              ]
                .filter(Boolean)
                .join(', ') || 'Address not available'}
            </div>
            {purchaseOrder.deliveryWarehouse.contactPerson && (
              <div className="text-sm">
                <span className="font-medium">Contact:</span> {purchaseOrder.deliveryWarehouse.contactPerson}
                {purchaseOrder.deliveryWarehouse.contactPhone && ` (${purchaseOrder.deliveryWarehouse.contactPhone})`}
              </div>
            )}
            {isDeliveryLocationAmended && purchaseOrder.deliveryLocationAmendedAt && (
              <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                Amended on {new Date(purchaseOrder.deliveryLocationAmendedAt).toLocaleDateString()}{' '}
                {purchaseOrder.deliveryLocationAmendedBy && (
                  <>
                    by {purchaseOrder.deliveryLocationAmendedBy.firstName}{' '}
                    {purchaseOrder.deliveryLocationAmendedBy.lastName}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material / Service</TableHead>
                <TableHead>HSN/SAC</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Ordered Width</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">GST %</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrder.items?.map((item) => {
                const pending = Number(item.orderedQuantity) - Number(item.receivedQuantity);
                const isFullyReceived = pending <= 0;
                const isPartiallyReceived = Number(item.receivedQuantity) > 0 && pending > 0;
                const taxAmt = Number(item.taxAmount || 0);
                const lineWithTax = Number(item.totalPrice) + taxAmt;

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        {item.materials ? (
                          <>
                            <div className="font-medium">{item.materials.code}</div>
                            <div className="text-sm text-muted-foreground">{item.materials.name}</div>
                          </>
                        ) : item.serviceDescription ? (
                          <>
                            <div className="font-medium">{item.serviceDescription}</div>
                            {item.serviceType && (
                              <span className="text-xs text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">
                                {item.serviceType.replace(/_/g, ' ')}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                        {item.printingType && (
                          <div className="text-xs text-accent mt-0.5">{item.printingType.replace('_', ' ')}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.hsnCode || '-'}</TableCell>
                    <TableCell className="text-sm">
                      {(item as unknown as ExtendedPOItem).componentName || '-'}
                    </TableCell>
                    <TableCell className="text-sm">{(item as unknown as ExtendedPOItem).colorName || '-'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {orderedWidthLabel(item as unknown as ExtendedPOItem)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(item.orderedQuantity).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">{Number(item.receivedQuantity).toLocaleString()}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(item.unitPrice))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(item.totalPrice))}</TableCell>
                    <TableCell className="text-right text-xs">
                      {item.gstRate ? `${Number(item.gstRate)}%` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-xs">{taxAmt > 0 ? formatCurrency(taxAmt) : '-'}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(lineWithTax)}</TableCell>
                    <TableCell>
                      {isFullyReceived ? (
                        <span className="text-success text-sm">Received</span>
                      ) : isPartiallyReceived ? (
                        <span className="text-warning text-sm">Partial</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Pending</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Tax Breakdown + Grand Total */}
          <div className="flex justify-end mt-4 pt-4 border-t">
            <div className="w-64 space-y-1">
              {purchaseOrder.subtotal != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(purchaseOrder.subtotal)}</span>
                </div>
              )}
              {purchaseOrder.isInterstate ? (
                purchaseOrder.totalIgst != null &&
                Number(purchaseOrder.totalIgst) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IGST</span>
                    <span>{formatCurrency(purchaseOrder.totalIgst)}</span>
                  </div>
                )
              ) : (
                <>
                  {purchaseOrder.totalCgst != null && Number(purchaseOrder.totalCgst) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">CGST</span>
                      <span>{formatCurrency(purchaseOrder.totalCgst)}</span>
                    </div>
                  )}
                  {purchaseOrder.totalSgst != null && Number(purchaseOrder.totalSgst) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">SGST</span>
                      <span>{formatCurrency(purchaseOrder.totalSgst)}</span>
                    </div>
                  )}
                </>
              )}
              {purchaseOrder.totalTax != null && Number(purchaseOrder.totalTax) > 0 && (
                <div className="flex justify-between text-sm border-t pt-1">
                  <span className="text-muted-foreground">Total Tax</span>
                  <span>{formatCurrency(purchaseOrder.totalTax)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">Grand Total</span>
                <span className="text-xl font-bold">{formatCurrency(purchaseOrder.totalAmount)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receiving History */}
      {purchaseOrder.goodsReceivingNotes && purchaseOrder.goodsReceivingNotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Receiving History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GRN Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Qty Received</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrder.goodsReceivingNotes.map((grn) => {
                  const grnItems = (grn as { items?: GRNItem[] }).items;
                  const totalReceived =
                    grnItems?.reduce((sum: number, grnItem: GRNItem) => sum + Number(grnItem.receivedQuantity), 0) || 0;

                  return (
                    <TableRow key={grn.id}>
                      <TableCell className="font-medium">{grn.grnNumber}</TableCell>
                      <TableCell>{formatDate(grn.receivingDate)}</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-right">{totalReceived.toLocaleString()}</TableCell>
                      <TableCell>
                        <StatusBadge status={grn.status} variant={grn.status === 'ACCEPTED' ? 'success' : 'warning'} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/procurement/grn/${grn.id}`)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {purchaseOrder.remarks && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground whitespace-pre-wrap">{purchaseOrder.remarks}</p>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        title="Send Purchase Order"
        description={`Are you sure you want to send PO ${purchaseOrder.poNumber} to the supplier? This will change the status to "Sent".`}
        confirmText="Send"
        cancelText="Cancel"
        onConfirm={handleSend}
      />

      <ConfirmDialog
        open={acknowledgeDialogOpen}
        onOpenChange={setAcknowledgeDialogOpen}
        title="Acknowledge Purchase Order"
        description={`Mark PO ${purchaseOrder.poNumber} as acknowledged by the supplier?`}
        confirmText="Acknowledge"
        cancelText="Cancel"
        onConfirm={handleAcknowledge}
      />

      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel Purchase Order"
        description={`Are you sure you want to cancel PO ${purchaseOrder.poNumber}? This action cannot be undone.`}
        confirmText="Cancel Order"
        cancelText="Keep Order"
        onConfirm={handleCancel}
        variant="destructive"
      />

      {/* Close Short Dialog */}
      <Dialog
        open={shortCloseDialogOpen}
        onOpenChange={(open) => {
          setShortCloseDialogOpen(open);
          if (!open) {
            setShortCloseReason('');
            setShortCloseReorder(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Close {purchaseOrder.poNumber} Short</DialogTitle>
            <DialogDescription>
              Close this order at the quantity actually delivered. What was received stays booked, and no stock is
              moved. Lines the supplier delivered <strong>nothing</strong> against go back to the material plan on their
              own. For lines that were <strong>part-delivered</strong>, the balance is dropped unless you tick the box
              below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="max-h-52 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Then</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shortCloseLines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="text-sm">{line.label}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {line.ordered.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {line.unit}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {line.received.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {line.unit}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {line.balance.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {line.unit}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {line.received <= 0
                          ? 'Returns to plan'
                          : shortCloseReorder
                            ? 'Balance carried forward'
                            : 'Balance dropped'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-2">
              <Label htmlFor="short-close-reason">Reason</Label>
              <Textarea
                id="short-close-reason"
                value={shortCloseReason}
                onChange={(e) => setShortCloseReason(e.target.value)}
                placeholder="e.g. Supplier could not supply the balance; season closed"
                maxLength={500}
                rows={3}
              />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="short-close-reorder"
                checked={shortCloseReorder}
                onCheckedChange={(checked) => setShortCloseReorder(checked === true)}
              />
              <Label htmlFor="short-close-reorder" className="font-normal leading-snug">
                Still need the balance on the part-delivered lines — carry it forward as a new requirement so it can be
                ordered again
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShortCloseDialogOpen(false)} disabled={isShortClosing}>
              Keep Order Open
            </Button>
            <Button onClick={handleShortClose} disabled={isShortClosing || !shortCloseReason.trim()}>
              {isShortClosing ? 'Closing...' : 'Close Short'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Amend Delivery Location Dialog */}
      <Dialog open={amendLocationDialogOpen} onOpenChange={setAmendLocationDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Change Delivery Location</DialogTitle>
            <DialogDescription>
              Update where this order should be delivered. The original location will be recorded for tracking.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Delivery Location</Label>
              <WarehouseCombobox
                value={amendLocationId}
                onValueChange={setAmendLocationId}
                placeholder="Select delivery location..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAmendLocationDialogOpen(false)} disabled={isAmending}>
              Cancel
            </Button>
            <Button onClick={handleAmendLocation} disabled={isAmending || !amendLocationId}>
              {isAmending ? 'Updating...' : 'Update Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
