// ASN Create Form - Create new Advance Shipping Notice for an order
// BUG-DASH10 fix: corrected route path - /manufacturing/dispatch/asn/new
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, FileText, Search, Package, Calendar, Loader2, Plus, Minus, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { asnService } from '@/services/dispatch.service';
import { getAllOrders, getOrderById } from '@/services/order.service';
import type { Order, OrderItem, OrderItemBreakup } from '@/types/order.types';
import type { CreateASNRequest } from '@/types/dispatch.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatStyleCodeWithRef } from '@/utils/style-ref-format';
import { queryKeys } from '@/lib/query-client';

interface SKULine {
  styleId: string;
  styleName: string;
  styleCode: string;
  buyerStyleRef?: string | null;
  colorId: string;
  colorName: string;
  colorCode?: string;
  sizeId: string;
  sizeName: string;
  orderQty: number;
  plannedQty: number;
}

export default function ASNCreateForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedOrderId = searchParams.get('orderId');

  // Order selection state
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(preselectedOrderId);

  // Form state
  const [requestedShipDate, setRequestedShipDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [cartonsPlanned, setCartonsPlanned] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [skuLines, setSkuLines] = useState<SKULine[]>([]);

  // Fetch orders for search
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: queryKeys.orders.search(orderSearch),
    queryFn: () => getAllOrders({ search: orderSearch, limit: 20, status: 'CONFIRMED' }),
    enabled: orderSearchOpen || !!orderSearch,
  });

  // Fetch selected order details
  const { data: selectedOrder, isLoading: orderLoading } = useQuery({
    queryKey: queryKeys.orders.detail(selectedOrderId || ''),
    queryFn: () => getOrderById(selectedOrderId!),
    enabled: !!selectedOrderId,
  });

  // Build SKU lines from order items when order is loaded
  useEffect(() => {
    if (selectedOrder?.orderItems) {
      const lines: SKULine[] = [];

      selectedOrder.orderItems.forEach((item: OrderItem) => {
        if (item.breakup && item.breakup.length > 0) {
          item.breakup.forEach((b: OrderItemBreakup) => {
            lines.push({
              styleId: item.styleId,
              styleName: item.style?.styleName || 'Unknown',
              styleCode: item.style?.styleCode || '',
              buyerStyleRef: item.style?.buyerStyleRef ?? null,
              colorId: b.colorOptions?.id || '',
              colorName: b.colorOptions?.colorName || 'N/A',
              colorCode: b.colorOptions?.colorCode,
              sizeId: b.sizeOptions?.id || '',
              sizeName: b.sizeOptions?.sizeName || 'N/A',
              orderQty: b.quantity,
              plannedQty: b.quantity, // Default to full order qty
            });
          });
        } else {
          // No breakup - single line item
          lines.push({
            styleId: item.styleId,
            styleName: item.style?.styleName || 'Unknown',
            styleCode: item.style?.styleCode || '',
            buyerStyleRef: item.style?.buyerStyleRef ?? null,
            colorId: '',
            colorName: 'N/A',
            sizeId: '',
            sizeName: 'N/A',
            orderQty: item.totalQuantity,
            plannedQty: item.totalQuantity,
          });
        }
      });

      setSkuLines(lines);
    }
  }, [selectedOrder]);

  // Calculate totals
  const totalPlannedQty = useMemo(() => {
    return skuLines.reduce((sum, line) => sum + line.plannedQty, 0);
  }, [skuLines]);

  const totalOrderQty = useMemo(() => {
    return skuLines.reduce((sum, line) => sum + line.orderQty, 0);
  }, [skuLines]);

  // Update planned quantity for a SKU line
  const updatePlannedQty = (index: number, qty: number) => {
    setSkuLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], plannedQty: Math.max(0, qty) };
      return updated;
    });
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateASNRequest) => asnService.create(data),
    onSuccess: (asn) => {
      handleApiSuccess('ASN created successfully');
      navigate(`/manufacturing/dispatch/asn/${asn.id}`);
    },
    onError: (err) => handleApiError(err, 'Failed to create ASN'),
  });

  // Handle form submission
  const handleSubmit = () => {
    if (!selectedOrderId) {
      handleApiError(new Error('No order selected'), 'Please select an order');
      return;
    }

    if (totalPlannedQty === 0) {
      handleApiError(new Error('No quantity planned'), 'Please enter planned quantities');
      return;
    }

    const skus = skuLines
      .filter((line) => line.plannedQty > 0 && line.colorId && line.sizeId)
      .map((line) => ({
        colorId: line.colorId,
        sizeId: line.sizeId,
        plannedQty: line.plannedQty,
      }));

    const request: CreateASNRequest = {
      orderId: selectedOrderId,
      plannedDispatchQty: totalPlannedQty,
      cartonsPlanned: cartonsPlanned || 0,
      requestedShipDate,
      remarks: remarks || undefined,
      skus,
    };

    createMutation.mutate(request);
  };

  const orders = ordersData?.data || [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/manufacturing/dispatch')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-display font-medium">Create ASN</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Create an Advance Shipping Notice for dispatch</p>
        </div>
      </div>

      {/* Order Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Select Order
          </CardTitle>
          <CardDescription>Choose a confirmed order to create an ASN for</CardDescription>
        </CardHeader>
        <CardContent>
          <Popover open={orderSearchOpen} onOpenChange={setOrderSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={orderSearchOpen}
                className="w-full justify-between"
              >
                {selectedOrder ? (
                  <span>
                    {selectedOrder.orderNumber} — {selectedOrder.customer?.name || 'Unknown Customer'}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Search for an order...</span>
                )}
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[500px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search by order number or customer..."
                  value={orderSearch}
                  onValueChange={setOrderSearch}
                />
                <CommandList>
                  <CommandEmpty>{ordersLoading ? 'Searching...' : 'No orders found.'}</CommandEmpty>
                  <CommandGroup>
                    {orders.map((order: Order) => (
                      <CommandItem
                        key={order.id}
                        value={order.id}
                        onSelect={() => {
                          setSelectedOrderId(order.id);
                          setOrderSearchOpen(false);
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{order.orderNumber}</span>
                          <span className="text-sm text-muted-foreground">
                            {order.customer?.name} • {order.totalQuantity} pcs •{' '}
                            {format(new Date(order.expectedDeliveryDate), 'dd MMM yyyy')}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Selected Order Summary */}
          {selectedOrder && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Order Number</p>
                  <p className="font-medium">{selectedOrder.orderNumber}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedOrder.customer?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Quantity</p>
                  <p className="font-medium">{selectedOrder.totalQuantity.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Expected Delivery</p>
                  <p className="font-medium">{format(new Date(selectedOrder.expectedDeliveryDate), 'dd MMM yyyy')}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SKU Breakdown */}
      {selectedOrderId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              SKU Breakdown
            </CardTitle>
            <CardDescription>Enter the planned quantity for each SKU to dispatch</CardDescription>
          </CardHeader>
          <CardContent>
            {orderLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : skuLines.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No items found in this order</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Style</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="text-right">Order Qty</TableHead>
                      <TableHead className="text-right">Planned Qty</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {skuLines.map((line, index) => (
                      <TableRow key={`${line.styleId}-${line.colorId}-${line.sizeId}-${index}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{line.styleName}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {formatStyleCodeWithRef(line.styleCode, line.buyerStyleRef)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {line.colorCode && (
                              <div className="w-4 h-4 rounded border" style={{ backgroundColor: line.colorCode }} />
                            )}
                            <span>{line.colorName}</span>
                          </div>
                        </TableCell>
                        <TableCell>{line.sizeName}</TableCell>
                        <TableCell className="text-right font-mono">{line.orderQty}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            max={line.orderQty}
                            value={line.plannedQty}
                            onChange={(e) => updatePlannedQty(index, parseInt(e.target.value) || 0)}
                            className="w-24 text-right font-mono"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updatePlannedQty(index, line.plannedQty - 1)}
                              disabled={line.plannedQty <= 0}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updatePlannedQty(index, line.plannedQty + 1)}
                              disabled={line.plannedQty >= line.orderQty} // allow-decimal-compare: both are plain JS numbers
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Planned Quantity</span>
                    <span className="text-xl font-bold">
                      {totalPlannedQty.toLocaleString()} / {totalOrderQty.toLocaleString()}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Shipping Details */}
      {selectedOrderId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Shipping Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="requestedShipDate">Requested Ship Date</Label>
                <Input
                  id="requestedShipDate"
                  type="date"
                  value={requestedShipDate}
                  onChange={(e) => setRequestedShipDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cartonsPlanned">Cartons Planned</Label>
                <Input
                  id="cartonsPlanned"
                  type="number"
                  min={0}
                  value={cartonsPlanned}
                  onChange={(e) => setCartonsPlanned(parseInt(e.target.value) || 0)}
                  placeholder="Number of cartons"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional notes..."
                  rows={1}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {selectedOrderId && (
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate('/manufacturing/dispatch')}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending || totalPlannedQty === 0}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create ASN
          </Button>
        </div>
      )}
    </div>
  );
}
