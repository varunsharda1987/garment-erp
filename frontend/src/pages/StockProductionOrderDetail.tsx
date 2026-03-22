import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle,
  Factory,
  Plus,
  Trash2,
  Warehouse,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getSPOById,
  updateSPO,
  approveSPO,
  generateWorkOrders,
} from '@/services/stockProductionOrder.service';
import { styleService } from '@/services/style.service';
import type { StockProductionOrderStatus } from '@/types/stockProductionOrder.types';

const STATUS_COLORS: Record<StockProductionOrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  IN_PRODUCTION: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function StockProductionOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);

  // Add item form state
  const [newItemColorId, setNewItemColorId] = useState('');
  const [newItemSizeId, setNewItemSizeId] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');

  const { data: spo, isLoading } = useQuery({
    queryKey: ['stock-production-order', id],
    queryFn: () => getSPOById(id!),
    enabled: !!id,
  });

  // Fetch style's colors and sizes for the item dialog
  const { data: styleDetail } = useQuery({
    queryKey: ['style-detail', spo?.styleId],
    queryFn: () => styleService.getStyleById(spo!.styleId),
    enabled: !!spo?.styleId,
  });

  const approveMutation = useMutation({
    mutationFn: () => approveSPO(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-production-order', id] });
      toast.success('SPO approved');
      setApproveDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to approve');
    },
  });

  const generateWOMutation = useMutation({
    mutationFn: () => generateWorkOrders(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-production-order', id] });
      toast.success('Work orders generated');
      setGenerateDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to generate work orders');
    },
  });

  const addItemMutation = useMutation({
    mutationFn: () => {
      const existingItems = (spo?.items || []).map((item) => ({
        colorId: item.colorId || null,
        sizeId: item.size?.id || item.sizeId,
        quantity: item.quantity,
      }));
      const newItem = {
        colorId: newItemColorId || null,
        sizeId: newItemSizeId,
        quantity: parseInt(newItemQuantity),
      };
      const newTotalQty = existingItems.reduce((sum, i) => sum + i.quantity, 0) + newItem.quantity;
      return updateSPO(id!, {
        items: [...existingItems, newItem],
        totalQuantity: newTotalQty,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-production-order', id] });
      toast.success('Item added');
      setAddItemDialogOpen(false);
      setNewItemColorId('');
      setNewItemSizeId('');
      setNewItemQuantity('');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to add item');
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemIndex: number) => {
      const remainingItems = (spo?.items || [])
        .filter((_, idx) => idx !== itemIndex)
        .map((item) => ({
          colorId: item.colorId || null,
          sizeId: item.size?.id || item.sizeId,
          quantity: item.quantity,
        }));
      const newTotalQty = remainingItems.reduce((sum, i) => sum + i.quantity, 0);
      return updateSPO(id!, {
        items: remainingItems,
        totalQuantity: newTotalQty,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-production-order', id] });
      toast.success('Item removed');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to remove item');
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 text-center text-muted-foreground">Loading...</div>
    );
  }

  if (!spo) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Stock Production Order not found
      </div>
    );
  }

  const isDraft = spo.status === 'DRAFT';
  const isApproved = spo.status === 'APPROVED';
  const colors = (styleDetail as any)?.colorOptions || [];
  const sizes = (styleDetail as any)?.sizeOptions || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/stock-production-orders')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Warehouse className="h-6 w-6" />
              {spo.spoNumber}
            </h1>
            <p className="text-muted-foreground">
              Stock Production Order
            </p>
          </div>
          <Badge className={STATUS_COLORS[spo.status]} variant="secondary">
            {spo.status.replace('_', ' ')}
          </Badge>
        </div>
        <div className="flex gap-2">
          {isDraft && spo.items && spo.items.length > 0 && (
            <Button onClick={() => setApproveDialogOpen(true)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
          )}
          {isApproved && (
            <Button onClick={() => setGenerateDialogOpen(true)}>
              <Factory className="h-4 w-4 mr-2" />
              Generate Work Orders
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Style</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono font-bold">{spo.style?.styleCode}</div>
            <div className="text-sm text-muted-foreground">{spo.style?.styleName}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Quantity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{spo.totalQuantity.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Target Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-medium">
              {spo.targetDate ? new Date(spo.targetDate).toLocaleDateString() : 'Not set'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">{spo.priority}</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Size/Color Breakup */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Size / Color Breakup</CardTitle>
              <CardDescription>
                {spo.items?.length || 0} items — {spo.items?.reduce((sum, i) => sum + i.quantity, 0) || 0} total pcs
              </CardDescription>
            </div>
            {isDraft && (
              <Button size="sm" onClick={() => setAddItemDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Color</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Progress</TableHead>
                {isDraft && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {!spo.items?.length ? (
                <TableRow>
                  <TableCell colSpan={isDraft ? 6 : 5} className="text-center py-8 text-muted-foreground">
                    No items yet. Add size/color breakup to proceed.
                  </TableCell>
                </TableRow>
              ) : (
                spo.items.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.color?.colorName || 'N/A'}</TableCell>
                    <TableCell>{item.size?.sizeName || item.sizeId}</TableCell>
                    <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                    <TableCell className="text-right">{item.completedQuantity}</TableCell>
                    <TableCell className="text-right">
                      {item.quantity > 0
                        ? `${Math.round((item.completedQuantity / item.quantity) * 100)}%`
                        : '0%'}
                    </TableCell>
                    {isDraft && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItemMutation.mutate(idx)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Linked Work Orders */}
      {spo.workOrders && spo.workOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Work Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>WO Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Qty</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spo.workOrders.map((wo) => (
                  <TableRow
                    key={wo.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/production/work-orders/${wo.id}`)}
                  >
                    <TableCell className="font-mono font-medium">{wo.workOrderNumber}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{wo.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{wo.totalQuantity}</TableCell>
                    <TableCell className="text-right">{wo.completedQuantity}</TableCell>
                    <TableCell className="text-right">
                      {wo.totalQuantity > 0
                        ? `${Math.round((wo.completedQuantity / wo.totalQuantity) * 100)}%`
                        : '0%'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Created by</span>
              <div>{spo.createdBy ? `${spo.createdBy.firstName} ${spo.createdBy.lastName}` : '-'}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Created at</span>
              <div>{new Date(spo.createdAt).toLocaleString()}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Approved by</span>
              <div>
                {spo.approvedBy ? `${spo.approvedBy.firstName} ${spo.approvedBy.lastName}` : '-'}
              </div>
            </div>
            {spo.remarks && (
              <div>
                <span className="text-muted-foreground">Remarks</span>
                <div>{spo.remarks}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Size/Color Breakup</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Color</Label>
              <Select value={newItemColorId} onValueChange={setNewItemColorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select color (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific color</SelectItem>
                  {colors.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.colorName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Size *</Label>
              <Select value={newItemSizeId} onValueChange={setNewItemSizeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {sizes.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.sizeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input
                type="number"
                placeholder="Enter quantity"
                value={newItemQuantity}
                onChange={(e) => setNewItemQuantity(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newItemSizeId) {
                  toast.error('Please select a size');
                  return;
                }
                if (!newItemQuantity || parseInt(newItemQuantity) <= 0) {
                  toast.error('Please enter a valid quantity');
                  return;
                }
                addItemMutation.mutate();
              }}
              disabled={addItemMutation.isPending}
            >
              {addItemMutation.isPending ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Stock Production Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will approve {spo.spoNumber} for {spo.totalQuantity.toLocaleString()} pcs.
              After approval, you can generate work orders to start production.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => approveMutation.mutate()}>
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Generate Work Orders Confirmation */}
      <AlertDialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Work Orders?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create production work orders for {spo.spoNumber} and change the status to IN_PRODUCTION.
              The work orders will follow the normal production pipeline (Cutting, Stitching, Finishing).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => generateWOMutation.mutate()}>
              Generate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
