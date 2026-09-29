import { unitShort } from '@/lib/units';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  getPurchaseOrderById,
  sendPurchaseOrder,
  acknowledgePurchaseOrder,
  deletePurchaseOrder,
  shortClosePurchaseOrder,
} from '@/services/purchaseOrder.service';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import { getPoAllocation } from '@/services/poAllocation.service';
import { AllocateToOrdersDialog } from '@/components/purchase-orders/AllocateToOrdersDialog';
import { PoAllocationCard } from '@/components/purchase-orders/PoAllocationCard';
import { hasAllocationContent, hasFreeCandidates, unlinkedOrdersText } from '@/lib/po-allocation-view';
import { usePermissions } from '@/hooks/usePermissions';
import { PRE_SEND_STATUSES } from '@/lib/delivery-plan';
import { CancelPoDialog } from '@/components/purchase-orders/CancelPoDialog';
import type { POForBuyer, PurchaseOrder, PurchaseOrderStatus } from '@/types/purchaseOrder.types';
import {
  PurchaseOrderStatusLabels,
  PO_CATEGORY_LABELS,
  PO_CATEGORY_COLORS,
  POSourceLabels,
} from '@/types/purchaseOrder.types';
import { Badge } from '@/components/ui/badge';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { getErrorMessage, handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
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
  FileMinus,
  ChevronDown,
  ChevronRight,
  Trash2,
  ShieldAlert,
  Link2,
} from 'lucide-react';
import { groupLabelLines, sumRows, type LabelGroup } from '@/lib/label-lines';
import { poItemLabelKey } from '@/lib/label-line-keys';
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
import { DeliveryPlanCard } from '@/components/purchase-orders/DeliveryPlanCard';
import { DocumentShareMenu } from '@/components/DocumentShareMenu';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import { formatStyleCodeWithRef } from '@/utils/style-ref-format';
import { formatDate } from '@/lib/date';
import { isQtyZero, qtyAtLeast } from '@/lib/quantity';
import { materialDetailLine } from '@/lib/material-detail';

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

/**
 * "Easybuy · Order SO2609-0012" or "Easybuy · Style EBWW-024 (SP27DR46)"
 * — the buyer, and the order or style that names them when that is the source.
 * Shows the buyer's own reference in parentheses when it DIFFERS from our style code.
 * Skipped when they match (e.g. ESSKY086LS → ESSKY086LS).
 */
function forBuyerText(forBuyer: POForBuyer): string {
  let via: string | null = null;
  if (forBuyer.source === 'ORDER' && forBuyer.orderNumber) {
    via = `Order ${forBuyer.orderNumber}`;
  } else if (forBuyer.source === 'STYLE' && forBuyer.styleCode) {
    // Only show buyer ref if it differs from our style code
    const refDiffers = forBuyer.buyerStyleRef && forBuyer.buyerStyleRef !== forBuyer.styleCode;
    const ref = refDiffers ? ` (${forBuyer.buyerStyleRef})` : '';
    via = `Style ${forBuyer.styleCode}${ref}`;
  }
  return [forBuyer.name, via].filter(Boolean).join(' · ');
}

type POItem = NonNullable<PurchaseOrder['items']>[number];

/** One PO line; a label's size row shows its size instead of the material (the label is the heading above). */
function PoItemRow({ item, size }: { item: POItem; size?: string | null }) {
  // Within rounding dust of the ordered quantity IS fully received (see @/lib/quantity)
  const isFullyReceived = qtyAtLeast(item.receivedQuantity, item.orderedQuantity);
  const isPartiallyReceived = !isQtyZero(item.receivedQuantity) && !isFullyReceived;
  const taxAmt = Number(item.taxAmount || 0);
  const lineWithTax = Number(item.totalPrice) + taxAmt;
  // Who it is for · what tells it apart — a size row leaves it to its label's heading
  const detail = materialDetailLine(item.materials);

  return (
    <TableRow className={size !== undefined ? 'bg-muted/10' : undefined}>
      <TableCell>
        <div>
          {size !== undefined && item.materials ? (
            <div className="pl-6">
              <div className="font-medium">{size ? `Size ${size}` : 'All sizes'}</div>
              <div className="text-xs text-muted-foreground">{item.materials.code}</div>
            </div>
          ) : item.materials ? (
            <>
              <div className="font-medium">{item.materials.code}</div>
              <div className="text-sm text-muted-foreground">{item.materials.name}</div>
              {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
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
          {item.printingType && <div className="text-xs text-accent mt-0.5">{item.printingType.replace('_', ' ')}</div>}
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{item.hsnCode || '-'}</TableCell>
      <TableCell className="text-sm">{(item as unknown as ExtendedPOItem).componentName || '-'}</TableCell>
      <TableCell className="text-sm">{(item as unknown as ExtendedPOItem).colorName || '-'}</TableCell>
      <TableCell className="text-sm whitespace-nowrap">
        {orderedWidthLabel(item as unknown as ExtendedPOItem)}
      </TableCell>
      <TableCell className="text-right font-medium">{Number(item.orderedQuantity).toLocaleString()}</TableCell>
      <TableCell className="text-right">{Number(item.receivedQuantity).toLocaleString()}</TableCell>
      <TableCell>{unitShort(item.unit)}</TableCell>
      <TableCell className="text-right">{formatCurrency(Number(item.unitPrice))}</TableCell>
      <TableCell className="text-right">{formatCurrency(Number(item.totalPrice))}</TableCell>
      <TableCell className="text-right text-xs">{item.gstRate ? `${Number(item.gstRate)}%` : '-'}</TableCell>
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
}

/**
 * A label bought in sizes: one heading row with the sizes' totals (unit, rate and GST when every size shares
 * them) and a combined status; click to show the size rows. Collapsed by default.
 */
function PoLabelGroupRows({ group }: { group: LabelGroup<POItem> }) {
  const [open, setOpen] = useState(false);
  const lines = group.rows.map((r) => r.line);
  const same = <T,>(pick: (l: POItem) => T): T | null =>
    lines.every((l) => pick(l) === pick(lines[0])) ? pick(lines[0]) : null;
  const ordered = sumRows(group.rows, (l) => Number(l.orderedQuantity));
  const received = sumRows(group.rows, (l) => Number(l.receivedQuantity));
  const amount = sumRows(group.rows, (l) => Number(l.totalPrice));
  const tax = sumRows(group.rows, (l) => Number(l.taxAmount || 0));
  const unit = same((l) => l.unit);
  const rate = same((l) => Number(l.unitPrice));
  const gst = same((l) => (l.gstRate ? Number(l.gstRate) : null));
  const allReceived = lines.every((l) => qtyAtLeast(l.receivedQuantity, l.orderedQuantity));
  const noneReceived = lines.every((l) => isQtyZero(l.receivedQuantity));
  // Every size row reads the same label master, so the first one speaks for the label
  const detail = materialDetailLine(lines[0]?.materials);

  return (
    <>
      <TableRow className="bg-muted/40 cursor-pointer hover:bg-muted/60" onClick={() => setOpen((o) => !o)}>
        <TableCell colSpan={5}>
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            <div>
              <div className="font-medium">{group.code}</div>
              <div className="text-sm text-muted-foreground">
                {group.name} · {group.rows.length} {group.rows.length === 1 ? 'size' : 'sizes'}
              </div>
              {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right font-medium">{ordered.toLocaleString()}</TableCell>
        <TableCell className="text-right">{received.toLocaleString()}</TableCell>
        <TableCell>{unit ? unitShort(unit) : '—'}</TableCell>
        <TableCell className="text-right">{rate != null ? formatCurrency(rate) : '—'}</TableCell>
        <TableCell className="text-right">{formatCurrency(amount)}</TableCell>
        <TableCell className="text-right text-xs">{gst != null ? `${gst}%` : '—'}</TableCell>
        <TableCell className="text-right text-xs">{tax > 0 ? formatCurrency(tax) : '-'}</TableCell>
        <TableCell className="text-right font-medium">{formatCurrency(amount + tax)}</TableCell>
        <TableCell>
          {allReceived ? (
            <span className="text-success text-sm">Received</span>
          ) : noneReceived ? (
            <span className="text-muted-foreground text-sm">Pending</span>
          ) : (
            <span className="text-warning text-sm">Partial</span>
          )}
        </TableCell>
      </TableRow>
      {open && group.rows.map((r) => <PoItemRow key={r.line.id} item={r.line} size={r.size} />)}
    </>
  );
}

export default function PurchaseOrderDetail() {
  const { company, companyFullAddress } = useCompanyProfile();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, canAny } = usePermissions();
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [acknowledgeDialogOpen, setAcknowledgeDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  // The admin force-cancel after goods arrived, not the normal cancel of a SENT / ACKNOWLEDGED order. Not reset
  // on close, so the dialog keeps its wording while it animates out.
  const [cancelForce, setCancelForce] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shortCloseDialogOpen, setShortCloseDialogOpen] = useState(false);
  const [shortCloseReason, setShortCloseReason] = useState('');
  const [shortCloseReorder, setShortCloseReorder] = useState(false);
  const [isShortClosing, setIsShortClosing] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);

  // Which running orders this PO's lines are allocated to. Nothing to show before it is sent.
  const allocationQuery = useQuery({
    queryKey: queryKeys.poAllocation.detail(id ?? ''),
    queryFn: () => getPoAllocation(id!),
    enabled: !!id && !!purchaseOrder && !PRE_SEND_STATUSES.includes(purchaseOrder.status),
  });

  useEffect(() => {
    if (id) {
      fetchPurchaseOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // The list page's "Close Short" menu item arrives with ?action=short-close. Open the dialog for
  // it — otherwise that menu item is indistinguishable from "View Details". Only once the order is
  // loaded, and only when the action is actually available on it.
  useEffect(() => {
    if (searchParams.get('action') !== 'short-close' || !purchaseOrder) return;
    if (purchaseOrder.status === 'PARTIALLY_RECEIVED') {
      setShortCloseDialogOpen(true);
    } else {
      // The list row was stale — the order moved on since. Say so rather than open the page silently.
      const label = PurchaseOrderStatusLabels[purchaseOrder.status] ?? purchaseOrder.status;
      notify.info(`${purchaseOrder.poNumber} is ${label.toLowerCase()} — there is nothing left to close short`);
    }
    searchParams.delete('action');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseOrder]);

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

  // Reload after a change made on this page without blanking it to "Loading…" (the allocation card stays open)
  const reloadPurchaseOrder = async () => {
    try {
      setPurchaseOrder(await getPurchaseOrderById(id!));
    } catch (err) {
      handleApiError(err, 'Failed to refresh purchase order');
    }
  };

  // The PO list and its count cards cache for up to a minute — every change made here must reach them
  const refreshLists = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all });
  };

  // Back returns to the list as it was left (its filters, tab and page live in the URL); opened directly
  // (a link, a new tab) there is nothing to go back to, so it opens the list
  const goBack = () => {
    const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (historyIndex > 0) navigate(-1);
    else navigate('/procurement/purchase-orders');
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
      refreshLists();
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
      refreshLists();
    }
  };

  // A draft was never sent to anyone — it is deleted, not cancelled (owner 2026-09-27)
  const handleDelete = async () => {
    try {
      await deletePurchaseOrder(id!);
      handleApiSuccess('Draft deleted', `${purchaseOrder?.poNumber ?? 'The purchase order'} has been deleted.`);
      navigate('/procurement/purchase-orders', { replace: true });
    } catch (err) {
      handleApiError(err, 'Failed to delete purchase order');
      fetchPurchaseOrder();
    } finally {
      refreshLists();
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
      refreshLists();
    }
  };

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

  const calculateReceivingProgress = () => {
    if (!purchaseOrder?.items?.length) return 0;
    const totalOrdered = purchaseOrder.items.reduce((sum, item) => sum + Number(item.orderedQuantity), 0);
    const totalReceived = purchaseOrder.items.reduce((sum, item) => sum + Number(item.receivedQuantity), 0);
    if (totalOrdered <= 0) return 0;
    const percent = Math.round((totalReceived / totalOrdered) * 100);
    // 100% only when every line is complete: rounding must not show 100 while a line still waits
    const allComplete = purchaseOrder.items.every((item) => qtyAtLeast(item.receivedQuantity, item.orderedQuantity));
    return allComplete ? percent : Math.min(percent, 99);
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
              <Button onClick={goBack}>Back to Purchase Orders</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const receivingProgress = calculateReceivingProgress();

  // The same "not sent yet" rule the form and the delivery-plan editor use
  const canEdit = PRE_SEND_STATUSES.includes(purchaseOrder.status);
  const canSend = purchaseOrder.status === 'DRAFT' || purchaseOrder.status === 'READY_FOR_PROCESSING';
  const canAcknowledge = purchaseOrder.status === 'SENT';
  const canReceive = ['SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'].includes(purchaseOrder.status);
  // A draft never reached the supplier — its exit is Delete, the same as on the list (owner 2026-09-27)
  const canDelete = purchaseOrder.status === 'DRAFT';
  // Cancel starts once the PO is sent and stops once anything arrives: after a delivery, cancel
  // misrepresents history (supplier ledger, payments and GST all saw a real receipt). The honest
  // exit for a part-delivered order is Close Short.
  const canCancel = ['SENT', 'ACKNOWLEDGED'].includes(purchaseOrder.status);
  // ...except an ADMIN may force it, with a typed reason, which the server logs (owner 2026-09-27). The server
  // also refuses it while a receipt waits for QC.
  const canForceCancel = isAdmin && ['PARTIALLY_RECEIVED', 'RECEIVED'].includes(purchaseOrder.status);
  // Only a part-delivered order can be closed short — there is nothing to close short about an
  // order the supplier never delivered against (that one is cancelled) or delivered in full.
  const canShortClose = purchaseOrder.status === 'PARTIALLY_RECEIVED';
  // Allocating a sent PO to running orders is open to whoever works MRP or purchase orders (owner decision D4)
  const allocation = allocationQuery.data;
  const canAllocate = canReceive && canAny('mrp', 'purchaseOrders') && hasFreeCandidates(allocation);
  const refreshAfterAllocation = () => {
    void reloadPurchaseOrder();
    refreshLists();
  };
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
          <Button variant="ghost" size="sm" onClick={goBack}>
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
        <div className="flex flex-wrap justify-end gap-2">
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
          {canAllocate && (
            <Button variant="outline" onClick={() => setAllocateOpen(true)}>
              <Link2 className="h-4 w-4 mr-2" />
              Allocate to orders
            </Button>
          )}
          {canShortClose && (
            <Button variant="outline" onClick={() => setShortCloseDialogOpen(true)}>
              <FileMinus className="h-4 w-4 mr-2" />
              Close Short
            </Button>
          )}
          {canCancel && (
            <Button
              variant="destructive"
              onClick={() => {
                setCancelForce(false);
                setCancelDialogOpen(true);
              }}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
          {canForceCancel && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                setCancelForce(true);
                setCancelDialogOpen(true);
              }}
            >
              <ShieldAlert className="h-4 w-4 mr-2" />
              Force cancel (admin)
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
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

      {/* Running orders that need what this PO brings and are not linked to it */}
      {canReceive && allocation && allocation.unlinkedOrderCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning bg-warning/10 p-3 text-sm">
          <div className="flex items-start gap-2">
            <Link2 className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <span>
              {unlinkedOrdersText(allocation.unlinkedOrderCount)}
              {!hasFreeCandidates(allocation) && ' — nothing on this PO is left free to link'}.
            </span>
          </div>
          {canAllocate && (
            <Button size="sm" variant="outline" onClick={() => setAllocateOpen(true)}>
              Allocate to orders
            </Button>
          )}
        </div>
      )}

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
      {(purchaseOrder.poCategory || purchaseOrder.poSource || purchaseOrder.forBuyer || linkedStyles.length > 0) && (
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
              {/* Who it is for — nothing when the lines name no one buyer (the server never guesses) */}
              {purchaseOrder.forBuyer && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">For</div>
                  <div className="text-sm font-medium">{forBuyerText(purchaseOrder.forBuyer)}</div>
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
                  <div className="flex flex-wrap gap-1">
                    {linkedStyles.map((s) => (
                      <Badge key={s.code} variant="outline" className="text-xs">
                        {formatStyleCodeWithRef(s.code, s.ref)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {/* A ternary, not `length && …`: an empty list rendered a stray "0" */}
              {(purchaseOrder as ExtendedPurchaseOrder).poSourceLinks?.length ? (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Linked To</div>
                  <div className="flex flex-wrap gap-1">
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
              ) : null}
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
            <div className="font-semibold text-lg">{company.name}</div>
            <div className="text-sm text-muted-foreground">{companyFullAddress}</div>
            <div className="text-sm">
              <span className="font-medium">GSTIN:</span> {company.gstin}
            </div>
            <div className="text-sm">
              <span className="font-medium">Phone:</span> {company.phone}
            </div>
            <div className="text-sm">
              <span className="font-medium">Email:</span> {company.email}
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

      {/* Where it delivers — one place, a split across places, or "to be advised" (2026-09-26) */}
      <DeliveryPlanCard
        purchaseOrder={purchaseOrder}
        companyFullAddress={companyFullAddress}
        onChanged={(po) => {
          setPurchaseOrder(po);
          refreshLists();
        }}
      />

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
              {/* A label bought in sizes: one heading (its totals, collapsed) and its sizes beneath, in size order */}
              {groupLabelLines(purchaseOrder.items ?? [], poItemLabelKey).map((g) =>
                g.kind === 'single' ? (
                  <PoItemRow key={g.line.id} item={g.line} />
                ) : (
                  <PoLabelGroupRows key={g.key} group={g} />
                )
              )}
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

      {/* Which running orders the lines are allocated to, and how far each got */}
      {allocationQuery.isError ? (
        <Card>
          <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-destructive">
              Could not load which orders this PO is allocated to: {getErrorMessage(allocationQuery.error)}
            </span>
            <Button size="sm" variant="outline" onClick={() => void allocationQuery.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        allocation &&
        hasAllocationContent(allocation) && (
          <PoAllocationCard
            allocation={allocation}
            canUndo={canAny('mrp', 'purchaseOrders')}
            onChanged={refreshAfterAllocation}
          />
        )
      )}

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
                      <TableCell>{grn.warehouse?.warehouseName ?? '—'}</TableCell>
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
        description={`Send ${purchaseOrder.poNumber} to the supplier? This will change the status to "Sent".`}
        confirmText="Send"
        cancelText="Cancel"
        onConfirm={handleSend}
      />

      <ConfirmDialog
        open={acknowledgeDialogOpen}
        onOpenChange={setAcknowledgeDialogOpen}
        title="Acknowledge Purchase Order"
        description={`Mark ${purchaseOrder.poNumber} as acknowledged by the supplier?`}
        confirmText="Acknowledge"
        cancelText="Cancel"
        onConfirm={handleAcknowledge}
      />

      {/* One cancel dialog for the list and this page: a typed reason, and it stays open until the server answers */}
      <CancelPoDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        po={purchaseOrder}
        force={cancelForce}
        onCancelled={fetchPurchaseOrder}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete draft purchase order"
        description={`Delete ${purchaseOrder.poNumber}? It was never sent to the supplier; anything it was ordered for goes back to be ordered again. This cannot be undone.`}
        confirmText="Delete"
        cancelText="Keep Draft"
        onConfirm={handleDelete}
        variant="destructive"
      />

      <AllocateToOrdersDialog
        poId={purchaseOrder.id}
        open={allocateOpen}
        onOpenChange={setAllocateOpen}
        onDone={refreshAfterAllocation}
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
                        {line.ordered.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {unitShort(line.unit)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {line.received.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {unitShort(line.unit)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {line.balance.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {unitShort(line.unit)}
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
    </div>
  );
}
