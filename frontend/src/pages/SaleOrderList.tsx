import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { queryKeys } from '@/lib/query-client'; // BUG-ORD14 fix: standardized query key
import { Plus, Trash2, Search, ShoppingBag, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SaleOrderForm } from '@/components/sale-order';
import { getAllSaleOrders, createSaleOrder, deleteSaleOrder } from '@/services/saleOrder.service';
import type { SaleOrder, SaleOrderStatus, CreateSORequest, UpdateSORequest } from '@/types/saleOrder.types';

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

export default function SaleOrderList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [soToDelete, setSoToDelete] = useState<SaleOrder | null>(null);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  // BUG-ORD14 fix: standardized query key
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.saleOrders.list({ page, search, status: statusFilter }),
    queryFn: () =>
      getAllSaleOrders({
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter !== 'all' ? (statusFilter as SaleOrderStatus) : undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: createSaleOrder,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.saleOrders.all }); // BUG-ORD14 fix: standardized query key
      toast.success('Sale Order created');
      setCreateSheetOpen(false);
      navigate(`/sale-orders/${created.id}`);
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to create sale order');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSaleOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.saleOrders.all }); // BUG-ORD14 fix: standardized query key
      toast.success('Sale Order deleted');
      setDeleteDialogOpen(false);
      setSoToDelete(null);
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to delete sale order');
    },
  });

  const handleCreateSubmit = async (data: CreateSORequest | UpdateSORequest) => {
    createMutation.mutate(data as CreateSORequest);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-medium flex items-center gap-2">
            <ShoppingBag className="h-6 w-6" />
            Sale Orders
          </h1>
          <p className="text-muted-foreground">Sell from existing finished goods stock</p>
        </div>
        <Button onClick={() => setCreateSheetOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Sale Order
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by SO number or customer..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="PARTIALLY_ALLOCATED">Partially Allocated</SelectItem>
                <SelectItem value="FULLY_ALLOCATED">Fully Allocated</SelectItem>
                <SelectItem value="DISPATCHED">Dispatched</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SO Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Sale Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : !data?.data?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No sale orders found
                  </TableCell>
                </TableRow>
              ) : (
                data.data.map((so) => (
                  <TableRow
                    key={so.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/sale-orders/${so.id}`)}
                  >
                    <TableCell className="font-mono font-medium">
                      {so.saleOrderNumber}
                      {(so.buyerPos?.length ? so.buyerPos.length > 0 : so.buyerPoNumber) && (
                        <div className="text-xs text-muted-foreground font-normal">
                          {so.buyerPos?.length ? (
                            so.buyerPos.length === 1 ? (
                              <>PO {so.buyerPos[0].buyerPoNumber}</>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help">
                                      PO{' '}
                                      {so.buyerPos.find((p) => p.isPrimary)?.buyerPoNumber ||
                                        so.buyerPos[0].buyerPoNumber}
                                      <span className="ml-1 text-info">+{so.buyerPos.length - 1}</span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      {so.buyerPos.map((po) => (
                                        <div key={po.id}>
                                          {po.isPrimary ? '★ ' : ''}
                                          {po.buyerPoNumber}
                                        </div>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )
                          ) : (
                            <>PO {so.buyerPoNumber}</>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{so.customer?.name}</div>
                        <div className="text-xs text-muted-foreground">{so.customer?.code}</div>
                      </div>
                    </TableCell>
                    <TableCell>{new Date(so.saleDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(so.totalAmount))}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[so.status]} variant="secondary">
                        {so.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{so._count?.items || 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/sale-orders/${so.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {so.status === 'DRAFT' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSoToDelete(so);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {data?.pagination && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= data.pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Sale Order Sheet */}
      <SaleOrderForm
        open={createSheetOpen}
        onOpenChange={setCreateSheetOpen}
        onSubmit={handleCreateSubmit}
        mode="create"
        isSubmitting={createMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sale Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {soToDelete?.saleOrderNumber}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive"
              onClick={() => soToDelete && deleteMutation.mutate(soToDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
