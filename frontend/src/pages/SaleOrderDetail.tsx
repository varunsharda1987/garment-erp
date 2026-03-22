import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle,
  Package,
  ShoppingBag,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getSaleOrderById,
  confirmSaleOrder,
  allocateStock,
  getAvailableStock,
} from '@/services/saleOrder.service';
import type { SaleOrderStatus, SaleOrderItem, AvailableFGStock } from '@/types/saleOrder.types';

const STATUS_COLORS: Record<SaleOrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PARTIALLY_ALLOCATED: 'bg-amber-100 text-amber-800',
  FULLY_ALLOCATED: 'bg-green-100 text-green-800',
  PARTIALLY_DISPATCHED: 'bg-purple-100 text-purple-800',
  DISPATCHED: 'bg-teal-100 text-teal-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function SaleOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SaleOrderItem | null>(null);
  const [allocateQty, setAllocateQty] = useState('');
  const [selectedFgStockId, setSelectedFgStockId] = useState('');

  const { data: so, isLoading } = useQuery({
    queryKey: ['sale-order', id],
    queryFn: () => getSaleOrderById(id!),
    enabled: !!id,
  });

  const { data: availableStock } = useQuery({
    queryKey: ['available-stock', selectedItem?.styleId, selectedItem?.colorId, selectedItem?.sizeId],
    queryFn: () =>
      getAvailableStock({
        styleId: selectedItem!.styleId,
        colorId: selectedItem!.colorId || undefined,
        sizeId: selectedItem!.sizeId,
      }),
    enabled: !!selectedItem && allocateDialogOpen,
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmSaleOrder(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale-order', id] });
      toast.success('Sale Order confirmed');
      setConfirmDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to confirm');
    },
  });

  const allocateMutation = useMutation({
    mutationFn: (data: { saleOrderItemId: string; fgStockId: string; quantity: number }) =>
      allocateStock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale-order', id] });
      queryClient.invalidateQueries({ queryKey: ['available-stock'] });
      toast.success('Stock allocated successfully');
      setAllocateDialogOpen(false);
      setSelectedItem(null);
      setAllocateQty('');
      setSelectedFgStockId('');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to allocate stock');
    },
  });

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  }

  if (!so) {
    return <div className="p-6 text-center text-muted-foreground">Sale Order not found</div>;
  }

  const isDraft = so.status === 'DRAFT';
  const canAllocate = ['CONFIRMED', 'PARTIALLY_ALLOCATED'].includes(so.status);

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
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingBag className="h-6 w-6" />
              {so.saleOrderNumber}
            </h1>
            <p className="text-muted-foreground">Sale Order</p>
          </div>
          <Badge className={STATUS_COLORS[so.status]} variant="secondary">
            {so.status.replace(/_/g, ' ')}
          </Badge>
        </div>
        <div className="flex gap-2">
          {isDraft && so.items && so.items.length > 0 && (
            <Button onClick={() => setConfirmDialogOpen(true)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirm
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <CardTitle className="text-sm text-muted-foreground">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(Number(so.totalAmount))}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sale Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-medium">{new Date(so.saleDate).toLocaleDateString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Expected Ship Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-medium">
              {so.expectedShipDate ? new Date(so.expectedShipDate).toLocaleDateString() : 'Not set'}
            </div>
          </CardContent>
        </Card>
      </div>

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
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Style</TableHead>
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
                  <TableCell colSpan={canAllocate ? 9 : 8} className="text-center py-8 text-muted-foreground">
                    No items yet
                  </TableCell>
                </TableRow>
              ) : (
                so.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-mono text-sm">{item.style?.styleCode}</div>
                      <div className="text-xs text-muted-foreground">{item.style?.styleName}</div>
                    </TableCell>
                    <TableCell>{item.color?.colorName || 'N/A'}</TableCell>
                    <TableCell>{item.size?.sizeName || '-'}</TableCell>
                    <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(item.unitPrice))}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(item.totalPrice))}</TableCell>
                    <TableCell className="text-right">
                      <span className={item.allocatedQty >= item.quantity ? 'text-green-600 font-medium' : ''}>
                        {item.allocatedQty} / {item.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{item.dispatchedQty}</TableCell>
                    {canAllocate && (
                      <TableCell>
                        {item.allocatedQty < item.quantity && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedItem(item);
                              setAllocateQty(String(item.quantity - item.allocatedQty));
                              setAllocateDialogOpen(true);
                            }}
                          >
                            <Package className="h-3 w-3 mr-1" />
                            Allocate
                          </Button>
                        )}
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
              <div>{new Date(so.createdAt).toLocaleString()}</div>
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

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Sale Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will confirm {so.saleOrderNumber} for {formatCurrency(Number(so.totalAmount))}.
              After confirmation, you can allocate finished goods stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmMutation.mutate()}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Allocate Stock Dialog */}
      <Dialog open={allocateDialogOpen} onOpenChange={(open) => {
        setAllocateDialogOpen(open);
        if (!open) {
          setSelectedItem(null);
          setAllocateQty('');
          setSelectedFgStockId('');
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Allocate Finished Goods Stock</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md text-sm">
                <div><strong>Style:</strong> {selectedItem.style?.styleCode} - {selectedItem.style?.styleName}</div>
                <div><strong>Color:</strong> {selectedItem.color?.colorName || 'N/A'}</div>
                <div><strong>Size:</strong> {selectedItem.size?.sizeName || '-'}</div>
                <div><strong>Remaining to allocate:</strong> {selectedItem.quantity - selectedItem.allocatedQty} pcs</div>
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
                          selectedFgStockId === stock.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-muted'
                        }`}
                        onClick={() => setSelectedFgStockId(stock.id)}
                      >
                        <div className="flex justify-between">
                          <span>
                            {stock.colorOptions?.colorName || '-'} / {stock.sizeOptions?.sizeName || '-'}
                          </span>
                          <span className="font-medium text-green-700">{stock.availableQty} available</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Location: {stock.locations?.name || '-'} | Total: {stock.quantity} | Allocated: {stock.allocatedQty}
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
    </div>
  );
}
