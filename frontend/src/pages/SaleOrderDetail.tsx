import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle,
  Factory,
  Link2,
  Package,
  ShoppingBag,
  Pencil,
  Plus,
  Trash2,
  Star,
  Loader2,
  ChevronDown,
  XCircle,
  MoreHorizontal,
  MapPin,
  FileText,
  FileX,
  Upload,
  ListOrdered,
} from 'lucide-react';
import { queryKeys } from '@/lib/query-client'; // BUG-ORD14 fix: standardized query key
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SmartConfirmDialog } from '@/components/SmartConfirmDialog';
import { SaleOrderForm, CancelOrderDialog } from '@/components/sale-order';
import { sortSaleOrderLines, styleSeasonLabel } from '@/components/sale-order/sale-order-lines';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { usePermissions } from '@/hooks/usePermissions';
import { distributeByShares, percentageSum, type ShareMode } from '@/lib/distribute';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getSaleOrderById,
  confirmSaleOrder,
  allocateStock,
  deallocateStock,
  getAvailableStock,
  startProduction,
  getLinkableProductionOrders,
  linkProductionOrder,
  amendSaleOrderQuantities,
  updateSaleOrder,
  cancelSaleOrder,
  addBuyerPo,
  removeBuyerPo,
  setPrimaryBuyerPo,
  uploadBuyerPoDocument,
  removeBuyerPoDocument,
} from '@/services/saleOrder.service';
import { getStyleById } from '@/services/style.service';
import { getErrorMessage } from '@/lib/api-error-handler';
import { openUploadedFile } from '@/lib/document-utils';
import { customerAddressService } from '@/services/customerAddress.service';
import type {
  SaleOrderStatus,
  SaleOrderItem,
  AvailableFGStock,
  UpdateSORequest,
  CreateSORequest,
} from '@/types/saleOrder.types';
import type { Style } from '@/types/style.types';
import { formatDate, formatDateTime, toDateInputValue } from '@/lib/date';

/** A style's colourway row (`color_options`), as `GET /styles/:id` serialises it. */
interface StyleColourway {
  id: string;
  colorName: string;
  isActive?: boolean;
  /** The catalogue colour this colourway mirrors — matches the style's own `colorId`. */
  colorMasterId?: string | null;
}

const STATUS_COLORS: Record<SaleOrderStatus, string> = {
  DRAFT: 'bg-muted text-foreground',
  CONFIRMED: 'bg-info-muted text-info',
  PARTIALLY_ALLOCATED: 'bg-warning/10 text-warning',
  FULLY_ALLOCATED: 'bg-success-muted text-success',
  PARTIALLY_DISPATCHED: 'bg-accent/10 text-accent',
  DISPATCHED: 'bg-teal-100 text-teal-800',
  DELIVERED: 'bg-success-muted text-success',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

export default function SaleOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [startProdDialogOpen, setStartProdDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkOrderId, setLinkOrderId] = useState('');
  // Admin correction of a confirmed order's size split
  const { isAdmin } = usePermissions();
  const [amendDialogOpen, setAmendDialogOpen] = useState(false);
  const [amendQty, setAmendQty] = useState<Record<string, string>>({});
  const [amendReason, setAmendReason] = useState('');
  // Absolute = type pieces per line; Percentage / Ratio = type shares and a total, pieces are worked out
  const [amendMode, setAmendMode] = useState<'absolute' | ShareMode>('absolute');
  const [amendShares, setAmendShares] = useState<Record<string, string>>({});
  const [amendTotal, setAmendTotal] = useState('');
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [prodDeliveryDate, setProdDeliveryDate] = useState('');
  const [prodPriority, setProdPriority] = useState('MEDIUM');
  const [prodRemarks, setProdRemarks] = useState('');
  // Default: make only what finished-goods stock does not already cover (order-system T1-A, 2026-09-17).
  const [prodQuantityMode, setProdQuantityMode] = useState<'SHORTFALL' | 'FULL'>('SHORTFALL');
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SaleOrderItem | null>(null);
  const [allocateQty, setAllocateQty] = useState('');
  const [selectedFgStockId, setSelectedFgStockId] = useState('');
  const [addPoDialogOpen, setAddPoDialogOpen] = useState(false);
  const [newPoNumber, setNewPoNumber] = useState('');
  const [newPoRemarks, setNewPoRemarks] = useState('');
  const [releasingAllocationId, setReleasingAllocationId] = useState<string | null>(null);
  // Buyer PO document upload. One hidden input serves every PO row; `uploadTargetPoId` says which
  // row asked for it.
  const poFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetPoId, setUploadTargetPoId] = useState<string | null>(null);
  const [uploadingPoId, setUploadingPoId] = useState<string | null>(null);
  // Add-PO dialog fields
  const [newPoAddressId, setNewPoAddressId] = useState('');
  const [newPoDate, setNewPoDate] = useState('');
  const [newPoFile, setNewPoFile] = useState<File | null>(null);
  const newPoFileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Refresh this page AND the list. `saleOrders.all` is the prefix of both query keys, so one
   * invalidation covers them; invalidating only the detail key (what most mutations here used to
   * do) left the list showing a stale status for its full 5-minute staleTime — a just-confirmed
   * order still appeared as DRAFT, delete button and all.
   */
  const invalidateSaleOrder = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.saleOrders.all });
  };

  // BUG-ORD14 fix: standardized query key
  const { data: so, isLoading } = useQuery({
    queryKey: queryKeys.saleOrders.detail(id || ''),
    queryFn: () => getSaleOrderById(id!),
    enabled: !!id,
    // Every table and dialog on this page reads the lines in one order: style, colour, then XS → XXXL.
    select: (order) => ({ ...order, items: order.items && sortSaleOrderLines(order.items) }),
  });

  // Production orders already planning these styles but linked to no sale order (raised early so
  // fabric could be bought and dyed). When any exist the page offers Link instead of Start
  // Production — the server refuses a second production order beside them.
  const awaitingProductionLink =
    !!so &&
    ['CONFIRMED', 'PARTIALLY_ALLOCATED'].includes(so.status) &&
    !(so.productionOrders || []).some((po) => po.status !== 'CANCELLED');
  const { data: linkableOrders = [] } = useQuery({
    queryKey: ['sale-order-linkable-production', id],
    queryFn: () => getLinkableProductionOrders(id!),
    enabled: !!id && awaitingProductionLink,
  });

  const linkMutation = useMutation({
    mutationFn: () => linkProductionOrder(id!, linkOrderId),
    onSuccess: (result) => {
      invalidateSaleOrder();
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['sale-order-linkable-production', id] });
      if (result.data.sized.some((s) => s.error)) toast.warning(result.message);
      else toast.success(result.message);
      setLinkDialogOpen(false);
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to link the production order');
    },
  });

  const amendMutation = useMutation({
    mutationFn: () =>
      amendSaleOrderQuantities(id!, {
        lines: (so?.items ?? [])
          .filter((i) => amendQty[i.id] !== undefined && Number(amendQty[i.id]) !== i.quantity)
          .map((i) => ({ itemId: i.id, quantity: Number(amendQty[i.id]) })),
        reason: amendReason.trim(),
      }),
    onSuccess: (result) => {
      invalidateSaleOrder();
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      if (result.data.notFollowed.length > 0 || result.data.sized.some((s) => s.error)) toast.warning(result.message);
      else toast.success(result.message);
      setAmendDialogOpen(false);
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to amend the quantities');
    },
  });

  // The customer's own saved locations — a PO ships to one of them. Only fetched while the
  // Add-PO dialog is open, since it is the only place that needs the list.
  const { data: customerAddresses } = useQuery({
    queryKey: ['customer-addresses', so?.customerId],
    queryFn: () => customerAddressService.getByCustomerId(so!.customerId, { isActive: true }),
    enabled: !!so?.customerId && addPoDialogOpen,
  });

  const { data: availableStock } = useQuery({
    queryKey: ['available-stock', selectedItem?.styleId, selectedItem?.colorId, selectedItem?.sizeId],
    queryFn: () =>
      getAvailableStock({
        styleId: selectedItem!.styleId,
        colorId: selectedItem!.colorId || undefined,
        sizeId: selectedItem!.sizeId || undefined,
      }),
    enabled: !!selectedItem && !!selectedItem.sizeId && allocateDialogOpen,
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmSaleOrder(id!),
    onSuccess: () => {
      invalidateSaleOrder();
      toast.success('Sale Order confirmed');
      setConfirmDialogOpen(false);
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to confirm');
    },
  });

  const startProductionMutation = useMutation({
    mutationFn: () =>
      startProduction(id!, {
        expectedDeliveryDate: prodDeliveryDate || undefined,
        priority: prodPriority || undefined,
        remarks: prodRemarks.trim() || undefined,
        quantityMode: prodQuantityMode,
      }),
    onSuccess: (result) => {
      invalidateSaleOrder();
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (result.data.workOrderFailures?.length) {
        toast.warning(
          `Production order ${result.data.orderNumber} created, but some work orders failed — create them manually from the order page`
        );
      } else {
        toast.success(`Production order ${result.data.orderNumber} created`);
      }
      setStartProdDialogOpen(false);
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to start production');
    },
  });

  const allocateMutation = useMutation({
    mutationFn: (data: { saleOrderItemId: string; fgStockId: string; quantity: number }) => allocateStock(data),
    onSuccess: () => {
      invalidateSaleOrder();
      queryClient.invalidateQueries({ queryKey: ['available-stock'] });
      toast.success('Stock allocated successfully');
      setAllocateDialogOpen(false);
      setSelectedItem(null);
      setAllocateQty('');
      setSelectedFgStockId('');
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to allocate stock');
    },
  });

  const deallocateMutation = useMutation({
    mutationFn: (allocationId: string) => deallocateStock(allocationId),
    onMutate: (allocationId: string) => setReleasingAllocationId(allocationId),
    onSettled: () => setReleasingAllocationId(null),
    onSuccess: () => {
      invalidateSaleOrder();
      queryClient.invalidateQueries({ queryKey: ['available-stock'] });
      toast.success('Allocation released — the stock is available again');
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to release allocation');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateSORequest) => updateSaleOrder(id!, data),
    onSuccess: () => {
      invalidateSaleOrder();
      toast.success('Sale Order updated');
      setEditSheetOpen(false);
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to update sale order');
    },
  });

  const handleEditSubmit = async (data: CreateSORequest | UpdateSORequest) => {
    updateMutation.mutate(data as UpdateSORequest);
  };

  /**
   * Fill in the colour on lines that were taken before their style had one.
   *
   * Setting a style's Primary Color (from the Add Item dialog, or the style itself) mirrors it into
   * `color_options` but does NOT reach back into sale-order lines already saved with
   * `colorId: null` — so an existing order's Color column keeps reading "N/A". This walks the
   * colourless lines, resolves each style's colourway, and re-saves the order through the ordinary
   * update path. Explicit, never automatic: nothing is assigned to an order behind the user's back.
   */
  const applyStyleColourMutation = useMutation({
    mutationFn: async () => {
      const items = so?.items ?? [];
      const styleIds = [...new Set(items.filter((i) => !i.colorId).map((i) => i.styleId))];
      const styles = await Promise.all(styleIds.map((sid) => getStyleById(sid)));

      // styleId -> the colourway to use. Mirrors the Add Item dialog's preselect: the colourway
      // matching the style's Primary Color, else the sole colourway (rows written before
      // style-colour.helper.ts carry a NULL colorMasterId and can't be matched by it).
      const colourwayByStyle = new Map<string, string>();
      styleIds.forEach((sid, idx) => {
        const style = styles[idx] as (Style & { colorOptions?: StyleColourway[] }) | undefined;
        const colourways = (style?.colorOptions ?? []).filter((c) => c.isActive !== false);
        const chosen =
          (style?.colorId ? colourways.find((c) => c.colorMasterId === style.colorId) : undefined) ??
          (colourways.length === 1 ? colourways[0] : undefined);
        if (chosen) colourwayByStyle.set(sid, chosen.id);
      });

      const filled = items.filter((i) => !i.colorId && colourwayByStyle.has(i.styleId)).length;
      if (filled === 0) {
        throw new Error('None of these styles has a colour yet. Set one from Edit → Add Item, then apply it here.');
      }

      // Re-send every line, not just the changed ones — PUT replaces the item set. `buyerStyleRef`
      // must be carried back explicitly or the backend re-captures today's style code and silently
      // rewrites what the buyer ordered under.
      return updateSaleOrder(id!, {
        items: items.map((item) => ({
          styleId: item.styleId,
          colorId: item.colorId || colourwayByStyle.get(item.styleId) || null,
          sizeId: item.sizeId || null,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          ...(item.buyerStyleRef != null ? { buyerStyleRef: item.buyerStyleRef } : {}),
        })),
      });
    },
    onSuccess: () => {
      invalidateSaleOrder();
      toast.success('Colour applied to the order lines');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });

  const addBuyerPoMutation = useMutation({
    // Two calls on purpose: the PO row is created as JSON, then the file is posted separately.
    // Keeps POST /:id/buyer-pos a plain JSON endpoint rather than converting a live one to
    // multipart. If the upload leg fails the PO still exists, showing "attach" — recoverable.
    mutationFn: async ({ buyerPoNumber, remarks }: { buyerPoNumber: string; remarks?: string }) => {
      const po = await addBuyerPo(id!, buyerPoNumber, remarks, {
        deliveryAddressId: newPoAddressId || null,
        poDate: newPoDate || null,
      });
      if (newPoFile) {
        await uploadBuyerPoDocument(po.id, newPoFile);
      }
      return po;
    },
    onSuccess: () => {
      invalidateSaleOrder();
      toast.success('Buyer PO added');
      setAddPoDialogOpen(false);
      setNewPoNumber('');
      setNewPoRemarks('');
      setNewPoAddressId('');
      setNewPoDate('');
      setNewPoFile(null);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });

  const removePoDocumentMutation = useMutation({
    mutationFn: (poId: string) => removeBuyerPoDocument(poId),
    onSuccess: () => {
      invalidateSaleOrder();
      toast.success('PO document removed');
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  });

  /** Mirrors the server's own filter so a bad pick is refused before the round trip. */
  const rejectBadPoFile = (file: File): string | null => {
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
      return 'Only JPG, PNG and PDF files are allowed';
    }
    if (file.size > 10 * 1024 * 1024) return 'File is too large. Maximum size is 10MB.';
    return null;
  };

  const handlePoFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset immediately so picking the SAME file again still fires a change event.
    event.target.value = '';
    if (!file || !uploadTargetPoId) return;

    const problem = rejectBadPoFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }

    setUploadingPoId(uploadTargetPoId);
    try {
      await uploadBuyerPoDocument(uploadTargetPoId, file);
      invalidateSaleOrder();
      toast.success('PO document uploaded');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploadingPoId(null);
      setUploadTargetPoId(null);
    }
  };

  const removeBuyerPoMutation = useMutation({
    mutationFn: (poId: string) => removeBuyerPo(poId),
    onSuccess: () => {
      invalidateSaleOrder();
      toast.success('Buyer PO removed');
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to remove buyer PO');
    },
  });

  const setPrimaryBuyerPoMutation = useMutation({
    mutationFn: (poId: string) => setPrimaryBuyerPo(poId),
    onSuccess: () => {
      invalidateSaleOrder();
      toast.success('Primary buyer PO updated');
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to set primary buyer PO');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelSaleOrder(id!),
    onSuccess: () => {
      invalidateSaleOrder();
      toast.success('Sale Order cancelled');
      setCancelDialogOpen(false);
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to cancel sale order');
    },
  });

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  }

  if (!so) {
    return <div className="p-6 text-center text-muted-foreground">Sale Order not found</div>;
  }

  const isDraft = so.status === 'DRAFT';
  const colourlessItemCount = so.items?.filter((i) => !i.colorId).length ?? 0;
  const canAllocate = ['CONFIRMED', 'PARTIALLY_ALLOCATED'].includes(so.status);
  const activeProductionOrders = (so.productionOrders || []).filter((po) => po.status !== 'CANCELLED');
  const canLinkProduction = canAllocate && activeProductionOrders.length === 0 && linkableOrders.length > 0;
  const canStartProduction =
    canAllocate && activeProductionOrders.length === 0 && (so.items?.length || 0) > 0 && !canLinkProduction;
  const isTerminal = ['CANCELLED', 'DELIVERED'].includes(so.status);
  const canShowCancelButton = !isTerminal;
  /** Confirm is offered only on a draft that actually has lines — an empty order is a dead end. */
  const canConfirm = isDraft && (so.items?.length || 0) > 0;
  // A confirmed order is otherwise frozen; an admin can correct a wrongly entered size split
  const canAmendQuantities =
    isAdmin && ['CONFIRMED', 'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED', 'PARTIALLY_DISPATCHED'].includes(so.status);
  const amendChangedCount = (so.items ?? []).filter(
    (i) => amendQty[i.id] !== undefined && amendQty[i.id] !== '' && Number(amendQty[i.id]) !== i.quantity
  ).length;
  const amendBelowCommitted = (so.items ?? []).some(
    (i) => amendQty[i.id] !== undefined && Number(amendQty[i.id]) < i.allocatedQty + i.dispatchedQty
  );
  const amendHasBlank = (so.items ?? []).some(
    (i) => amendQty[i.id] === '' || !Number.isInteger(Number(amendQty[i.id]))
  );
  const amendNewTotal = (so.items ?? []).reduce((sum, i) => sum + (Number(amendQty[i.id] ?? i.quantity) || 0), 0);
  const amendShareValues = (so.items ?? []).map((i) => Number(amendShares[i.id]) || 0);
  const amendShareSum =
    amendMode === 'percentage' ? percentageSum(amendShareValues) : amendShareValues.reduce((sum, v) => sum + v, 0);
  const amendShareInvalid =
    amendMode !== 'absolute' &&
    (!(parseInt(amendTotal, 10) > 0) || (amendMode === 'percentage' ? amendShareSum !== 100 : amendShareSum <= 0));

  /** Work the pieces out from the shares — only once the shares are complete (percentages = 100). */
  const applyAmendShares = (shares: Record<string, string>, total: number, mode: ShareMode) => {
    const items = so.items ?? [];
    const values = items.map((i) => Number(shares[i.id]) || 0);
    if (mode === 'percentage' && percentageSum(values) !== 100) return;
    const result = distributeByShares(
      total,
      items.map((i, idx) => ({ key: i.id, share: values[idx] })),
      mode
    );
    if (!result) return;
    setAmendQty(Object.fromEntries(items.map((i) => [i.id, String(result.get(i.id) ?? 0)])));
  };

  const changeAmendMode = (mode: 'absolute' | ShareMode) => {
    const items = so.items ?? [];
    if (mode !== 'absolute') {
      // Start from the split on screen, so switching modes changes nothing until a share is edited
      const qty = items.map((i) => Number(amendQty[i.id] ?? i.quantity) || 0);
      const total = qty.reduce((sum, q) => sum + q, 0);
      let shares: string[];
      if (mode === 'percentage') {
        const pct = qty.map((q) => (total > 0 ? Math.round((q / total) * 10000) / 100 : 0));
        // Put the rounding difference on the largest line so the percentages read exactly 100
        const diff = Math.round((100 - pct.reduce((sum, p) => sum + p, 0)) * 100) / 100;
        const largest = pct.indexOf(Math.max(...pct));
        if (total > 0 && largest >= 0) pct[largest] = Math.round((pct[largest] + diff) * 100) / 100;
        shares = pct.map(String);
      } else {
        const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
        const g = qty.reduce((acc, q) => gcd(acc, q), 0) || 1;
        shares = qty.map((q) => String(q / g));
      }
      setAmendShares(Object.fromEntries(items.map((i, idx) => [i.id, shares[idx]])));
      setAmendTotal(String(total));
    }
    setAmendMode(mode);
  };
  const hasHeaderActions =
    isDraft || canConfirm || canStartProduction || canLinkProduction || canAmendQuantities || canShowCancelButton;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/sale-orders')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-medium flex items-center gap-2">
              <ShoppingBag className="h-6 w-6" />
              {so.saleOrderNumber}
            </h1>
            <p className="text-muted-foreground">
              Sale Order
              {so.buyerPoNumber && <span className="ml-2 font-mono">· Buyer PO {so.buyerPoNumber}</span>}
            </p>
          </div>
          <Badge className={STATUS_COLORS[so.status]} variant="secondary">
            {so.status.replace(/_/g, ' ')}
          </Badge>
        </div>
        {/*
          One Actions menu rather than a row of bare buttons. Which entries appear is still driven
          entirely by status, so a menu with nothing in it is not rendered at all — on a Cancelled or
          Delivered order there is genuinely nothing to do here.
        */}
        {hasHeaderActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Actions
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {isDraft && (
                <DropdownMenuItem onSelect={() => setEditSheetOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {canConfirm && (
                <DropdownMenuItem onSelect={() => setConfirmDialogOpen(true)}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm
                </DropdownMenuItem>
              )}
              {canStartProduction && (
                <DropdownMenuItem
                  onSelect={() => {
                    setProdDeliveryDate(toDateInputValue(so.expectedShipDate ?? so.buyerDeadline ?? so.deliveryDate));
                    setProdPriority('MEDIUM');
                    setProdRemarks('');
                    setStartProdDialogOpen(true);
                  }}
                >
                  <Factory className="h-4 w-4 mr-2" />
                  Start Production
                </DropdownMenuItem>
              )}
              {canLinkProduction && (
                <DropdownMenuItem
                  onSelect={() => {
                    setLinkOrderId(linkableOrders.find((o) => o.sameCustomer)?.id ?? '');
                    setLinkDialogOpen(true);
                  }}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Link to Production Order
                </DropdownMenuItem>
              )}
              {canAmendQuantities && (
                <DropdownMenuItem
                  onSelect={() => {
                    setAmendQty(Object.fromEntries((so.items ?? []).map((i) => [i.id, String(i.quantity)])));
                    setAmendReason('');
                    setAmendMode('absolute');
                    setAmendShares({});
                    setAmendTotal('');
                    setAmendDialogOpen(true);
                  }}
                >
                  <ListOrdered className="h-4 w-4 mr-2" />
                  Amend Quantities
                </DropdownMenuItem>
              )}
              {canShowCancelButton && (
                <>
                  {(isDraft || canConfirm || canStartProduction) && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onSelect={() => setCancelDialogOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Order
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Linked Production Orders (make-to-order) */}
      {activeProductionOrders.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Factory className="h-4 w-4" />
              Production
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeProductionOrders.map((po) => (
                <div key={po.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <Link to={`/orders/${po.id}`} className="font-mono font-medium text-info hover:underline">
                      {po.orderNumber}
                    </Link>
                    <Badge variant="secondary">{po.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <div className="text-muted-foreground">
                    {po.totalQuantity} pcs
                    {po.expectedDeliveryDate && ` · due ${formatDate(new Date(po.expectedDeliveryDate))}`}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold">{so.customer?.name}</div>
            <div className="text-sm text-muted-foreground font-mono">{so.customer?.code}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Style</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono font-bold">
              {so.style?.styleCode || '-'}
              {so.style?.buyerStyleRef && (
                <span className="text-muted-foreground font-normal ml-1">({so.style.buyerStyleRef})</span>
              )}
            </div>
            <div className="text-sm text-muted-foreground truncate">{so.style?.styleName || 'No primary style'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(Number(so.totalAmount))}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sale Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-medium">{formatDate(new Date(so.saleDate))}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Buyer Deadline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-medium">{so.buyerDeadline ? formatDate(new Date(so.buyerDeadline)) : 'Not set'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Expected Ship Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-medium">
              {so.expectedShipDate ? formatDate(new Date(so.expectedShipDate)) : 'Not set'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Buyer POs Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Buyer PO Numbers</CardTitle>
            {/* The PO set is closed once the order is finished — the backend refuses the change
                too, and the buyer app matches its own records against these numbers. */}
            {!isTerminal && (
              <Button variant="ghost" size="sm" onClick={() => setAddPoDialogOpen(true)}>
                <Plus className="h-3 w-3 mr-1" />
                Add PO
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {(!so.buyerPos || so.buyerPos.length === 0) && !so.buyerPoNumber ? (
            <p className="text-sm text-muted-foreground">No buyer PO numbers</p>
          ) : (
            <div className="space-y-2">
              {so.buyerPos?.map((po) => (
                <div
                  key={po.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-md text-sm ${
                    po.isPrimary ? 'bg-info-muted border border-info/20' : 'bg-muted'
                  }`}
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {po.isPrimary && <Star className="h-3 w-3 text-info fill-info" />}
                      <span className="font-mono font-medium">{po.buyerPoNumber}</span>
                      {po.remarks && <span className="text-muted-foreground">- {po.remarks}</span>}
                      {po.isPrimary && (
                        <Badge variant="outline" className="text-xs">
                          Primary
                        </Badge>
                      )}
                    </div>
                    {/* The customer raises one PO per delivery location, so the location is what
                        tells two POs on this order apart. */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {po.deliveryAddress
                          ? `${po.deliveryAddress.label}${po.deliveryAddress.city?.cityName ? `, ${po.deliveryAddress.city.cityName}` : ''}`
                          : 'No location set'}
                      </span>
                      {po.poDate && <span>PO dated {formatDate(new Date(po.poDate))}</span>}
                      {po.documentUrl ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-info hover:underline"
                          onClick={(e) => {
                            // The tab must be opened inside the click handler — see openUploadedFile.
                            const tab = window.open('', '_blank');
                            openUploadedFile(po.documentUrl!, po.documentName || 'purchase-order', tab).catch((err) =>
                              toast.error(getErrorMessage(err))
                            );
                            e.stopPropagation();
                          }}
                        >
                          <FileText className="h-3 w-3" />
                          {po.documentName || 'View PO'}
                          {po.documentSize ? ` (${Math.round(po.documentSize / 1024)} KB)` : ''}
                        </button>
                      ) : (
                        <span className="italic">No PO document</span>
                      )}
                    </div>
                  </div>
                  {!isTerminal && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title={po.documentUrl ? 'Replace PO document' : 'Attach PO document'}
                        onClick={() => {
                          setUploadTargetPoId(po.id);
                          poFileInputRef.current?.click();
                        }}
                        disabled={uploadingPoId !== null}
                      >
                        {uploadingPoId === po.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Upload className="h-3 w-3" />
                        )}
                      </Button>
                      {po.documentUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title="Remove PO document"
                          onClick={() => removePoDocumentMutation.mutate(po.id)}
                          disabled={removePoDocumentMutation.isPending}
                        >
                          <FileX className="h-3 w-3" />
                        </Button>
                      )}
                      {!po.isPrimary && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title="Set as primary"
                          onClick={() => setPrimaryBuyerPoMutation.mutate(po.id)}
                          disabled={setPrimaryBuyerPoMutation.isPending}
                        >
                          <Star className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        title="Remove"
                        onClick={() => removeBuyerPoMutation.mutate(po.id)}
                        disabled={removeBuyerPoMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {so.buyerPos?.length === 0 && so.buyerPoNumber && (
                <div className="text-sm text-muted-foreground italic">
                  {so.buyerPoNumber} — kept as the primary PO if you add another
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Items</CardTitle>
              <CardDescription>
                {so.items?.length || 0} items — {so.items?.reduce((sum, i) => sum + i.quantity, 0) || 0} total pcs
              </CardDescription>
            </div>
            {/*
              Lines taken before the style had a colour keep `colorId: null` — setting the style's
              colour afterwards does not reach back into them, so the Color column would still read
              "N/A" on exactly the orders that prompted the complaint. Lines are editable only while
              the order is DRAFT, so this has to be done before Confirm.
            */}
            {isDraft && colourlessItemCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyStyleColourMutation.mutate()}
                disabled={applyStyleColourMutation.isPending}
              >
                {applyStyleColourMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apply style colour to {colourlessItemCount} {colourlessItemCount === 1 ? 'line' : 'lines'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Style</TableHead>
                <TableHead>Season</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Allocated</TableHead>
                <TableHead className="text-right">Dispatched</TableHead>
                {canAllocate && <TableHead className="w-24">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {!so.items?.length ? (
                <TableRow>
                  <TableCell colSpan={canAllocate ? 10 : 9} className="text-center py-8 text-muted-foreground">
                    No items yet
                  </TableCell>
                </TableRow>
              ) : (
                so.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-mono text-sm">
                        {item.style?.styleCode}
                        {/* The code CAPTURED on this line wins over the style master's current one,
                            so an order keeps showing what the buyer ordered under. */}
                        {(item.buyerStyleRef ?? item.style?.buyerStyleRef) && (
                          <span className="text-muted-foreground ml-1">
                            ({item.buyerStyleRef ?? item.style?.buyerStyleRef})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{item.style?.styleName}</div>
                    </TableCell>
                    <TableCell>{styleSeasonLabel(item.style) ?? '—'}</TableCell>
                    <TableCell>{item.color?.colorName || 'N/A'}</TableCell>
                    <TableCell>{item.size?.sizeName || '-'}</TableCell>
                    <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(item.unitPrice))}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(item.totalPrice))}</TableCell>
                    <TableCell className="text-right">
                      <span className={item.allocatedQty >= item.quantity ? 'text-success font-medium' : ''}>
                        {item.allocatedQty} / {item.quantity}
                      </span>
                      {/* Each live reservation, with a way to give it back. Without this the only
                          way to undo a mis-allocation was to cancel the whole order — and once
                          production has started even that is blocked. */}
                      {(item.allocations || [])
                        .filter((a) => a.status === 'ALLOCATED')
                        .map((a) => (
                          <div
                            key={a.id}
                            className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground"
                          >
                            <span>
                              {a.allocatedQty} pcs
                              {a.fgStock?.locations?.locationName ? ` · ${a.fgStock.locations.locationName}` : ''}
                            </span>
                            {!isTerminal && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1 text-xs"
                                title="Release this allocation back to stock"
                                disabled={deallocateMutation.isPending}
                                onClick={() => deallocateMutation.mutate(a.id)}
                              >
                                {releasingAllocationId === a.id ? 'Releasing...' : 'Release'}
                              </Button>
                            )}
                          </div>
                        ))}
                    </TableCell>
                    <TableCell className="text-right">{item.dispatchedQty}</TableCell>
                    {canAllocate && (
                      <TableCell className="text-right">
                        {/* Allocation matches a specific style/colour/size lot, so a line with no
                            size has nothing to match against — the stock lookup is skipped for it
                            and the dialog would just report "no stock available". */}
                        {item.allocatedQty < item.quantity &&
                          (item.sizeId ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setSelectedItem(item);
                                    setAllocateQty(String(item.quantity - item.allocatedQty));
                                    setAllocateDialogOpen(true);
                                  }}
                                >
                                  <Package className="h-4 w-4 mr-2" />
                                  Allocate
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-xs text-muted-foreground">Set a size to allocate</span>
                          ))}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Created by</span>
              <div>{so.createdBy ? `${so.createdBy.firstName} ${so.createdBy.lastName}` : '-'}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Created at</span>
              <div>{formatDateTime(new Date(so.createdAt))}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Approved by</span>
              <div>{so.approvedBy ? `${so.approvedBy.firstName} ${so.approvedBy.lastName}` : '-'}</div>
            </div>
            {so.remarks && (
              <div>
                <span className="text-muted-foreground">Remarks</span>
                <div>{so.remarks}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Smart Confirm Dialog - shows stock availability + style readiness */}
      <SmartConfirmDialog
        saleOrderId={so.id}
        saleOrderNumber={so.saleOrderNumber}
        totalAmount={Number(so.totalAmount)}
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={() => confirmMutation.mutate()}
        isConfirming={confirmMutation.isPending}
      />

      {/* Start Production Dialog (make-to-order: the shortfall by default, or the full SO quantity) */}
      <Dialog open={startProdDialogOpen} onOpenChange={setStartProdDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start Production</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Creates one linked production order with work orders per style.
            </p>
            {(() => {
              const items = so.items ?? [];
              const total = items.reduce((sum, i) => sum + i.quantity, 0);
              const shortfall = items.reduce(
                (sum, i) => sum + Math.max(0, i.quantity - (i.allocatedQty ?? 0) - (i.dispatchedQty ?? 0)),
                0
              );
              return (
                <div className="space-y-2">
                  <Label>What to produce</Label>
                  <RadioGroup
                    value={prodQuantityMode}
                    onValueChange={(v) => setProdQuantityMode(v as 'SHORTFALL' | 'FULL')}
                  >
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value="SHORTFALL" id="prod-qty-shortfall" className="mt-0.5" />
                      <Label htmlFor="prod-qty-shortfall" className="font-normal">
                        Only what stock does not cover — <b>{shortfall} pcs</b>
                        <span className="block text-xs text-muted-foreground">
                          Pieces already allocated or dispatched from finished-goods stock are left out.
                        </span>
                      </Label>
                    </div>
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value="FULL" id="prod-qty-full" className="mt-0.5" />
                      <Label htmlFor="prod-qty-full" className="font-normal">
                        Full sale-order quantity — <b>{total} pcs</b>
                      </Label>
                    </div>
                  </RadioGroup>
                  {shortfall === 0 && prodQuantityMode === 'SHORTFALL' && (
                    <p className="text-xs text-warning">
                      Stock already covers every line — choose the full quantity to produce it anyway.
                    </p>
                  )}
                </div>
              );
            })()}
            <div className="space-y-2">
              <Label>Expected Delivery Date</Label>
              <Input type="date" value={prodDeliveryDate} onChange={(e) => setProdDeliveryDate(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Production must finish by the buyer PO&apos;s Expected Ship Date.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={prodPriority} onValueChange={setProdPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Remarks (optional)</Label>
              <Input
                value={prodRemarks}
                onChange={(e) => setProdRemarks(e.target.value)}
                placeholder={`Production for ${so.saleOrderNumber}`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartProdDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!prodDeliveryDate) {
                  toast.error('Expected delivery date is required');
                  return;
                }
                startProductionMutation.mutate();
              }}
              disabled={startProductionMutation.isPending}
            >
              {startProductionMutation.isPending ? 'Creating...' : 'Create Production Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Amend Quantities — admin correction of a confirmed order's size split */}
      <Dialog open={amendDialogOpen} onOpenChange={setAmendDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Amend Quantities</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Correct the quantity ordered per line. A line cannot go below what is already allocated or dispatched. If
              a production order is linked and its sizes match this sale order, it is updated to the new sizes too,
              along with its pending production run and size-wise labels.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
                {(
                  [
                    ['absolute', 'Absolute'],
                    ['percentage', 'Percentage'],
                    ['ratio', 'Ratio'],
                  ] as const
                ).map(([mode, label]) => (
                  // Same toggle as the order form's size grid
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={amendMode === mode}
                    onClick={() => changeAmendMode(mode)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      amendMode === mode ? 'bg-info text-white' : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {amendMode !== 'absolute' && (
                <div className="space-y-1">
                  <Label htmlFor="amend-total" className="text-xs">
                    Total pcs *
                  </Label>
                  <Input
                    id="amend-total"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    className="h-8 w-32 text-right"
                    value={amendTotal}
                    onChange={(e) => {
                      setAmendTotal(e.target.value);
                      applyAmendShares(amendShares, parseInt(e.target.value, 10), amendMode);
                    }}
                  />
                </div>
              )}
              {amendMode !== 'absolute' && (
                <div className={`pb-1.5 text-sm ${amendShareInvalid ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {amendMode === 'percentage' ? `Percentages: ${amendShareSum} / 100` : `Ratio total: ${amendShareSum}`}
                </div>
              )}
            </div>
            <div className="max-h-[50vh] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Style</TableHead>
                    <TableHead>Colour</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Allocated / Dispatched</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    {amendMode !== 'absolute' && (
                      <TableHead className="w-24 text-right">{amendMode === 'percentage' ? '%' : 'Ratio'}</TableHead>
                    )}
                    <TableHead className="w-28 text-right">New Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(so.items ?? []).map((i) => {
                    const committed = i.allocatedQty + i.dispatchedQty;
                    const value = amendQty[i.id] ?? String(i.quantity);
                    const tooLow = value !== '' && Number(value) < committed;
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.style?.styleCode ?? '—'}</TableCell>
                        <TableCell>{i.color?.colorName ?? '—'}</TableCell>
                        <TableCell>{i.size?.sizeName ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          {i.allocatedQty} / {i.dispatchedQty}
                        </TableCell>
                        <TableCell className="text-right">{i.quantity}</TableCell>
                        {amendMode !== 'absolute' && (
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              inputMode="decimal"
                              aria-label={`${amendMode === 'percentage' ? 'Percentage' : 'Ratio'} for ${i.size?.sizeName ?? 'line'}`}
                              className="h-8 text-right"
                              value={amendShares[i.id] ?? ''}
                              onChange={(e) => {
                                const next = { ...amendShares, [i.id]: e.target.value };
                                setAmendShares(next);
                                applyAmendShares(next, parseInt(amendTotal, 10), amendMode);
                              }}
                            />
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          {amendMode !== 'absolute' ? (
                            <span className={`font-medium ${tooLow ? 'text-destructive' : ''}`}>{value}</span>
                          ) : (
                            <Input
                              type="number"
                              min={committed}
                              step={1}
                              inputMode="numeric"
                              aria-label={`New quantity for ${i.size?.sizeName ?? 'line'}`}
                              className={`h-8 text-right ${tooLow ? 'border-destructive' : ''}`}
                              value={value}
                              onChange={(e) => setAmendQty((prev) => ({ ...prev, [i.id]: e.target.value }))}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="text-sm">
              New total: <span className="font-semibold">{amendNewTotal} pcs</span>
              {amendBelowCommitted && (
                <span className="ml-2 text-destructive">A line is below what is already allocated or dispatched.</span>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="amend-reason">Reason *</Label>
              <Textarea
                id="amend-reason"
                rows={2}
                placeholder="e.g. size split corrected to the buyer's PO"
                value={amendReason}
                onChange={(e) => setAmendReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAmendDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => amendMutation.mutate()}
              disabled={
                amendMutation.isPending ||
                amendChangedCount === 0 ||
                amendBelowCommitted ||
                amendHasBlank ||
                amendShareInvalid ||
                amendNewTotal === 0 ||
                amendReason.trim().length < 3
              }
            >
              {amendMutation.isPending ? 'Saving...' : 'Save Quantities'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link to Production Order — a production order already plans this style (raised early,
          sizeless, to buy and dye fabric). Linking copies this sale order's sizes onto it. */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link to Production Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Production is already planned for this style. Link that production order to this sale order instead of
              starting a second one. If it has no sizes yet, this sale order&apos;s sizes and colour are copied onto it
              and its production run is created.
            </p>
            <RadioGroup value={linkOrderId} onValueChange={setLinkOrderId} className="space-y-2">
              {linkableOrders.map((o) => (
                <Label
                  key={o.id}
                  htmlFor={`link-${o.id}`}
                  className={`flex items-start gap-3 rounded-md border p-3 ${o.sameCustomer ? 'cursor-pointer' : 'opacity-60'}`}
                >
                  <RadioGroupItem id={`link-${o.id}`} value={o.id} disabled={!o.sameCustomer} className="mt-1" />
                  <div className="space-y-0.5 text-sm">
                    <div className="font-medium">
                      {o.orderNumber} · {o.styles.join(', ')}
                    </div>
                    <div className="text-muted-foreground">
                      {o.totalQuantity} pcs · {o.status} · due {formatDate(o.expectedDeliveryDate)}
                      {o.hasSizes ? ' · sizes entered' : ' · no sizes yet'}
                    </div>
                    {!o.sameCustomer && (
                      <div className="text-destructive">For a different customer ({o.customerName}) — cannot link</div>
                    )}
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)} disabled={linkMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => linkMutation.mutate()} disabled={!linkOrderId || linkMutation.isPending}>
              {linkMutation.isPending ? 'Linking...' : 'Link Production Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Allocate Stock Dialog */}
      <Dialog
        open={allocateDialogOpen}
        onOpenChange={(open) => {
          setAllocateDialogOpen(open);
          if (!open) {
            setSelectedItem(null);
            setAllocateQty('');
            setSelectedFgStockId('');
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Allocate Finished Goods Stock</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md text-sm">
                <div>
                  <strong>Style:</strong> {selectedItem.style?.styleCode}
                  {selectedItem.style?.buyerStyleRef ? ` (${selectedItem.style.buyerStyleRef})` : ''} -{' '}
                  {selectedItem.style?.styleName}
                </div>
                <div>
                  <strong>Color:</strong> {selectedItem.color?.colorName || 'N/A'}
                </div>
                <div>
                  <strong>Size:</strong> {selectedItem.size?.sizeName || '-'}
                </div>
                <div>
                  <strong>Remaining to allocate:</strong> {selectedItem.quantity - selectedItem.allocatedQty} pcs
                </div>
              </div>

              <div className="space-y-2">
                <Label>Available Stock</Label>
                {!availableStock?.length ? (
                  <p className="text-sm text-muted-foreground p-3 border rounded-md">
                    No finished goods stock available for this style/color/size.
                  </p>
                ) : (
                  <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                    {availableStock.map((stock: AvailableFGStock) => (
                      <div
                        key={stock.id}
                        className={`px-3 py-2 cursor-pointer text-sm ${
                          selectedFgStockId === stock.id ? 'bg-info-muted border-info/20' : 'hover:bg-muted'
                        }`}
                        onClick={() => setSelectedFgStockId(stock.id)}
                      >
                        <div className="flex justify-between">
                          <span>
                            {stock.colorOptions?.colorName || '-'} / {stock.sizeOptions?.sizeName || '-'}
                          </span>
                          <span className="font-medium text-success">{stock.availableQty} available</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Location: {stock.locations?.locationName || '-'} | Total: {stock.quantity} | Allocated:{' '}
                          {stock.allocatedQty}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Quantity to Allocate</Label>
                <Input
                  type="number"
                  value={allocateQty}
                  onChange={(e) => setAllocateQty(e.target.value)}
                  max={selectedItem.quantity - selectedItem.allocatedQty}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedFgStockId) {
                  toast.error('Please select a stock entry');
                  return;
                }
                if (!allocateQty || parseInt(allocateQty) <= 0) {
                  toast.error('Please enter a valid quantity');
                  return;
                }
                allocateMutation.mutate({
                  saleOrderItemId: selectedItem!.id,
                  fgStockId: selectedFgStockId,
                  quantity: parseInt(allocateQty),
                });
              }}
              disabled={allocateMutation.isPending || !selectedFgStockId}
            >
              {allocateMutation.isPending ? 'Allocating...' : 'Allocate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Sale Order Sheet */}
      <SaleOrderForm
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        onSubmit={handleEditSubmit}
        saleOrder={so}
        mode="edit"
        isSubmitting={updateMutation.isPending}
      />

      {/* One hidden input serves the Replace/Attach button on every PO row. */}
      <input
        ref={poFileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        className="hidden"
        onChange={handlePoFilePicked}
      />

      {/* Add Buyer PO Dialog */}
      <Dialog
        open={addPoDialogOpen}
        onOpenChange={(open) => {
          setAddPoDialogOpen(open);
          if (!open) {
            setNewPoNumber('');
            setNewPoRemarks('');
            setNewPoAddressId('');
            setNewPoDate('');
            setNewPoFile(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Buyer PO</DialogTitle>
            <DialogDescription>
              The customer raises one PO per delivery location. Attach their PO here so production, dispatch and
              accounts all work from the same paper.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>PO Number *</Label>
              <Input
                value={newPoNumber}
                onChange={(e) => setNewPoNumber(e.target.value)}
                placeholder="e.g., HOK-2024-0456"
              />
            </div>
            <div className="space-y-2">
              <Label>Delivery Location</Label>
              {customerAddresses && customerAddresses.length > 0 ? (
                <Select
                  value={newPoAddressId || 'none'}
                  onValueChange={(v) => setNewPoAddressId(v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Where this PO ships to" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="none">Not set</SelectItem>
                    {customerAddresses.map((address) => (
                      <SelectItem key={address.id} value={address.id}>
                        {address.label}
                        {address.city?.cityName ? ` — ${address.city.cityName}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                /* Only one customer address exists system-wide today, so without saying this the
                   empty dropdown reads as broken rather than as missing data. */
                <p className="text-xs text-muted-foreground">
                  No saved locations for this customer — add them on the{' '}
                  <Link to={`/customers/${so.customerId}`} className="text-info hover:underline">
                    customer page
                  </Link>
                  , then pick one here.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>PO Date</Label>
              <Input type="date" value={newPoDate} onChange={(e) => setNewPoDate(e.target.value)} />
              <p className="text-xs text-muted-foreground">The date printed on the buyer's PO.</p>
            </div>
            <div className="space-y-2">
              <Label>PO Document</Label>
              <input
                ref={newPoFileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  const problem = rejectBadPoFile(file);
                  if (problem) {
                    toast.error(problem);
                    return;
                  }
                  setNewPoFile(file);
                }}
              />
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => newPoFileInputRef.current?.click()}>
                  <Upload className="h-3 w-3 mr-2" />
                  {newPoFile ? 'Change file' : 'Choose file'}
                </Button>
                <span className="text-xs text-muted-foreground truncate">
                  {newPoFile
                    ? `${newPoFile.name} (${Math.round(newPoFile.size / 1024)} KB)`
                    : 'PDF, JPG or PNG, up to 10MB'}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPoDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newPoNumber.trim()) {
                  toast.error('PO number is required');
                  return;
                }
                addBuyerPoMutation.mutate({
                  buyerPoNumber: newPoNumber.trim(),
                  remarks: newPoRemarks.trim() || undefined,
                });
              }}
              disabled={addBuyerPoMutation.isPending}
            >
              {addBuyerPoMutation.isPending ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <CancelOrderDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onConfirm={() => cancelMutation.mutate()}
        saleOrder={so}
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
}
