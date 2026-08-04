// Create Delivery Note — dispatch finished goods against a customer order.
// Linked from DispatchList ("New Delivery Note" + ASN "Create Delivery Note" actions).
// BUG-DASH10 fix: corrected route path - /manufacturing/dispatch/delivery/new
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import type { ComboboxOption } from '@/components/ui/combobox';
import { deliveryNoteService, asnService } from '@/services/dispatch.service';
import { getAllOrders, getOrderById } from '@/services/order.service';
import { customerService } from '@/services/customer.service';
import { styleService } from '@/services/style.service';
import type { Order } from '@/types/order.types';
import type { CreateDeliveryNoteRequest } from '@/types/dispatch.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatStyleCodeWithRef } from '@/utils/style-ref-format';
import { notify } from '@/lib/notify';
import { logError } from '@/lib/logger';
import { ArrowLeft, Package, Plus, Save, Trash2, Truck } from 'lucide-react';

interface ColorOption {
  id: string;
  colorName: string;
  colorCode?: string;
}

interface SizeOption {
  id: string;
  sizeName: string;
  sizeCode?: string;
}

interface StyleOptions {
  colors: ColorOption[];
  sizes: SizeOption[];
}

// One editable item row (Style / Color / Size / Quantity)
interface ItemRow {
  tempId: string;
  styleId: string;
  colorId: string; // '' until chosen — backend requires a real color ID
  sizeId: string;
  quantity: string; // kept as string for the input; parsed on submit
}

let rowCounter = 0;
const newRow = (partial?: Partial<ItemRow>): ItemRow => ({
  tempId: `row-${Date.now()}-${rowCounter++}`,
  styleId: '',
  colorId: '',
  sizeId: '',
  quantity: '',
  ...partial,
});

export default function DispatchDeliveryNoteForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // The ASN "Create Delivery Note" action passes ?asnId=... — we pre-load the ASN's order,
  // prefill quantities from its SKU plan, and send asnId in the payload.
  const asnId = searchParams.get('asnId');
  const [asnNumber, setAsnNumber] = useState<string | null>(null);
  const asnLoadedRef = useRef(false);

  // Lookups
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [customers, setCustomers] = useState<Array<{ id: string; code?: string; name: string }>>([]);

  // Selected order detail (with items + breakup)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);

  // Per-style color/size options (from style master; used for selects)
  const [styleOptionsMap, setStyleOptionsMap] = useState<Record<string, StyleOptions>>({});

  // Form state
  const [orderId, setOrderId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<ItemRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const orderSearchRef = useRef('');

  // ----- Lookups -----

  const fetchOrders = useCallback(async (search?: string) => {
    try {
      setOrdersLoading(true);
      const res = await getAllOrders({ page: 1, limit: 50, search: search || undefined });
      setOrders(res.data || []);
    } catch (err) {
      logError('Failed to load orders', err);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    // Customer lookup — editable fallback when the order has no customer attached
    customerService
      .getAllCustomers({ page: 1, limit: 100 })
      .then((res) => setCustomers(res.data || []))
      .catch((err) => logError('Failed to load customers', err));
  }, [fetchOrders]);

  const handleOrderSearch = useCallback(
    (search: string) => {
      if (search === orderSearchRef.current) return;
      orderSearchRef.current = search;
      fetchOrders(search);
    },
    [fetchOrders]
  );

  // ----- Order selection: auto-fill customer + prefill items from SKU breakup -----

  const handleOrderSelect = async (id: string) => {
    setOrderId(id);
    if (!id) {
      setSelectedOrder(null);
      setItems([]);
      return;
    }

    try {
      setOrderLoading(true);
      const order = await getOrderById(id);
      setSelectedOrder(order);
      setCustomerId(order.customerId || '');

      // Prefill item rows from the order's SKU breakup (style/color/size/qty).
      const prefilled: ItemRow[] = [];
      for (const oi of order.orderItems || []) {
        for (const b of oi.breakup || []) {
          prefilled.push(
            newRow({
              styleId: oi.styleId,
              colorId: b.colorId || '', // breakup colorId may be null; user must pick one before submit
              sizeId: b.sizeId,
              quantity: String(b.quantity),
            })
          );
        }
      }
      setItems(prefilled.length > 0 ? prefilled : [newRow()]);

      // Load color/size options for each style on the order (for manual rows and
      // rows whose breakup had no color). Serializer: color_options → colorOptions, size_options → sizeOptions.
      const styleIds = Array.from(new Set((order.orderItems || []).map((oi) => oi.styleId)));
      const optionsMap: Record<string, StyleOptions> = {};
      await Promise.all(
        styleIds.map(async (styleId) => {
          try {
            const fullStyle = (await styleService.getStyleById(styleId)) as unknown as {
              colorOptions?: ColorOption[];
              sizeOptions?: SizeOption[];
            };
            optionsMap[styleId] = {
              colors: fullStyle.colorOptions ?? [],
              sizes: fullStyle.sizeOptions ?? [],
            };
          } catch (err) {
            logError(`Failed to load style options for ${styleId}`, err);
            optionsMap[styleId] = { colors: [], sizes: [] };
          }
        })
      );

      // Merge in color/size options seen on the breakup itself (covers styles whose
      // master options are incomplete but the order breakup carries the lookup rows).
      for (const oi of order.orderItems || []) {
        const entry = (optionsMap[oi.styleId] = optionsMap[oi.styleId] || { colors: [], sizes: [] });
        for (const b of oi.breakup || []) {
          if (b.colorOptions && !entry.colors.some((c) => c.id === b.colorOptions!.id)) {
            entry.colors.push({
              id: b.colorOptions.id,
              colorName: b.colorOptions.colorName,
              colorCode: b.colorOptions.colorCode,
            });
          }
          if (b.sizeOptions && !entry.sizes.some((s) => s.id === b.sizeOptions!.id)) {
            entry.sizes.push({
              id: b.sizeOptions.id,
              sizeName: b.sizeOptions.sizeName,
              sizeCode: b.sizeOptions.sizeCode,
            });
          }
        }
      }
      setStyleOptionsMap(optionsMap);
    } catch (err) {
      handleApiError(err, 'Failed to load order details');
      setSelectedOrder(null);
      setItems([]);
    } finally {
      setOrderLoading(false);
    }
  };

  // ----- ASN prefill: ?asnId=... loads the ASN's order and narrows rows to its shipment plan -----

  useEffect(() => {
    if (!asnId || asnLoadedRef.current) return;
    asnLoadedRef.current = true;
    (async () => {
      try {
        const asn = await asnService.getById(asnId);
        setAsnNumber(asn.asnNumber);
        if (asn.orderId) {
          await handleOrderSelect(asn.orderId);
          const skus = asn.skus || [];
          if (skus.length > 0) {
            // The order prefill just queued full-order rows; narrow them to the ASN's plan:
            // match by color+size, take plannedQty. Rows outside the plan are dropped (the
            // user can re-add any row before saving). If nothing matches, keep the order rows.
            setItems((prev) => {
              const used = new Set<number>();
              const mapped: ItemRow[] = [];
              for (const sku of skus) {
                const idx = prev.findIndex(
                  (r, i) => !used.has(i) && r.colorId === sku.colorId && r.sizeId === sku.sizeId
                );
                if (idx >= 0) {
                  used.add(idx);
                  mapped.push({ ...prev[idx], quantity: String(sku.plannedQty) });
                }
              }
              return mapped.length > 0 ? mapped : prev;
            });
          }
          setRemarks((prev) => prev || `Against ASN ${asn.asnNumber}`);
        }
      } catch (err) {
        handleApiError(err, 'Failed to load ASN for prefill');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asnId]);

  // ----- Item row helpers -----

  const updateItem = (tempId: string, patch: Partial<ItemRow>) => {
    setItems((prev) => prev.map((row) => (row.tempId === tempId ? { ...row, ...patch } : row)));
  };

  const addRow = () => setItems((prev) => [...prev, newRow()]);
  const removeRow = (tempId: string) => setItems((prev) => prev.filter((row) => row.tempId !== tempId));

  // Deduped styles on the selected order (an order can have multiple items on the same style)
  const orderStyles = (selectedOrder?.orderItems || [])
    .map((oi) => oi.style)
    .filter((s, idx, arr) => s && arr.findIndex((x) => x?.id === s.id) === idx);
  const totalQuantity = items.reduce((sum, row) => sum + (parseInt(row.quantity) || 0), 0);

  const styleLabel = (styleId: string) => {
    const s = orderStyles.find((st) => st.id === styleId);
    return s ? `${formatStyleCodeWithRef(s.styleCode, s.buyerStyleRef)} — ${s.styleName}` : styleId;
  };

  // ----- Submit -----

  const validate = (): boolean => {
    if (!orderId) {
      notify.error('Please select an order');
      return false;
    }
    if (!customerId) {
      notify.error('Please select a customer');
      return false;
    }
    if (!deliveryDate) {
      notify.error('Please enter a delivery date');
      return false;
    }
    const validRows = items.filter((r) => r.styleId || r.colorId || r.sizeId || r.quantity);
    if (validRows.length === 0) {
      notify.error('Add at least one item');
      return false;
    }
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      if (!row.styleId || !row.colorId || !row.sizeId) {
        notify.error(`Item ${i + 1}: style, color and size are all required`);
        return false;
      }
      const qty = parseInt(row.quantity);
      if (!qty || qty <= 0) {
        notify.error(`Item ${i + 1}: quantity must be a positive number`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: CreateDeliveryNoteRequest = {
      orderId,
      customerId,
      deliveryDate,
      asnId: asnId || undefined,
      remarks: remarks.trim() || undefined,
      items: items
        .filter((r) => r.styleId && r.colorId && r.sizeId && parseInt(r.quantity) > 0)
        .map((r) => ({
          styleId: r.styleId,
          colorId: r.colorId,
          sizeId: r.sizeId,
          quantity: parseInt(r.quantity),
        })),
    };

    try {
      setIsSaving(true);
      const { note, fgShortfalls } = await deliveryNoteService.create(payload);

      if (fgShortfalls && fgShortfalls.length > 0) {
        // FG stock could not fully cover some SKUs — surface every shortfall (never silent)
        const lines = fgShortfalls.map((s) => {
          const opts = styleOptionsMap[s.styleId];
          const colorName = s.colorId ? opts?.colors.find((c) => c.id === s.colorId)?.colorName || s.colorId : 'Any';
          const sizeName = opts?.sizes.find((sz) => sz.id === s.sizeId)?.sizeName || s.sizeId;
          return `${styleLabel(s.styleId)} / ${colorName} / ${sizeName}: requested ${s.requested}, deducted ${s.deducted}`;
        });
        notify.warning(`Delivery note ${note.deliveryNumber} created with finished-goods shortfalls`, {
          description: lines.join('\n'),
          duration: 10000,
        });
      } else {
        handleApiSuccess(`Delivery note ${note.deliveryNumber} created successfully`);
      }
      navigate('/manufacturing/dispatch');
    } catch (err) {
      handleApiError(err, 'Failed to create delivery note');
    } finally {
      setIsSaving(false);
    }
  };

  // ----- Render -----

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/manufacturing/dispatch')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-medium flex items-center gap-3">
            Create Delivery Note
            {asnNumber && <Badge variant="secondary">Against ASN {asnNumber}</Badge>}
          </h1>
          <p className="text-muted-foreground">Dispatch finished goods against a customer order</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order & Customer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Delivery Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Order *</Label>
                <Combobox
                  options={orders.map(
                    (o): ComboboxOption => ({
                      value: o.id,
                      label: `${o.orderNumber} — ${o.customer?.name || 'Unknown customer'}`,
                      searchText: `${o.orderNumber} ${o.customer?.name || ''}`,
                    })
                  )}
                  value={orderId}
                  onValueChange={handleOrderSelect}
                  placeholder="Select order..."
                  searchPlaceholder="Search by order number or customer..."
                  onSearchChange={handleOrderSearch}
                  isLoading={ordersLoading}
                />
              </div>
              <div className="space-y-2">
                <Label>Customer *</Label>
                <Combobox
                  options={customers.map(
                    (c): ComboboxOption => ({
                      value: c.id,
                      label: c.code ? `${c.code} — ${c.name}` : c.name,
                    })
                  )}
                  value={customerId}
                  onValueChange={(v) => setCustomerId(v)}
                  placeholder="Auto-filled from order..."
                  searchPlaceholder="Search customers..."
                />
                <p className="text-xs text-muted-foreground">Auto-filled from the selected order; editable</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryDate">Delivery Date *</Label>
                <Input
                  id="deliveryDate"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Items
              <Badge variant="secondary" className="ml-2">
                {items.length} rows | {totalQuantity} pcs
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedOrder ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Select an order to prefill items from its SKU breakup
              </p>
            ) : orderLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading order items...</p>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[220px]">Style</TableHead>
                        <TableHead className="min-w-[150px]">Color</TableHead>
                        <TableHead className="min-w-[130px]">Size</TableHead>
                        <TableHead className="w-[120px] text-right">Quantity</TableHead>
                        <TableHead className="w-[50px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((row) => {
                        const opts = styleOptionsMap[row.styleId];
                        return (
                          <TableRow key={row.tempId}>
                            <TableCell>
                              <Select
                                value={row.styleId}
                                onValueChange={(v) =>
                                  // Changing style invalidates color/size picks
                                  updateItem(row.tempId, { styleId: v, colorId: '', sizeId: '' })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select style" />
                                </SelectTrigger>
                                <SelectContent>
                                  {orderStyles.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {formatStyleCodeWithRef(s.styleCode, s.buyerStyleRef)} — {s.styleName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={row.colorId}
                                onValueChange={(v) => updateItem(row.tempId, { colorId: v })}
                                disabled={!row.styleId}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select color" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(opts?.colors || []).map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {c.colorName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={row.sizeId}
                                onValueChange={(v) => updateItem(row.tempId, { sizeId: v })}
                                disabled={!row.styleId}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select size" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(opts?.sizes || []).map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.sizeName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                className="text-right"
                                value={row.quantity}
                                onChange={(e) => updateItem(row.tempId, { quantity: e.target.value })}
                                placeholder="Qty"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeRow(row.tempId)}
                                disabled={items.length <= 1}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addRow}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Remarks */}
        <Card>
          <CardHeader>
            <CardTitle>Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any additional notes for this delivery..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/manufacturing/dispatch')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving || !selectedOrder}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Creating...' : 'Create Delivery Note'}
          </Button>
        </div>
      </form>
    </div>
  );
}
