import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Search, ShoppingBag, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  getAllSaleOrders,
  createSaleOrder,
  deleteSaleOrder,
} from '@/services/saleOrder.service';
import type { SaleOrder, SaleOrderStatus, CreateSORequest } from '@/types/saleOrder.types';

const STATUS_COLORS: Record<SaleOrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PARTIALLY_ALLOCATED: 'bg-amber-100 text-amber-800',
  FULLY_ALLOCATED: 'bg-green-100 text-green-800',
  PARTIALLY_DISPATCHED: 'bg-purple-100 text-purple-800',
  DISPATCHED: 'bg-teal-100 text-teal-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function SaleOrderList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [soToDelete, setSoToDelete] = useState<SaleOrder | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Create form state
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomerLabel, setSelectedCustomerLabel] = useState('');
  const [expectedShipDate, setExpectedShipDate] = useState('');
  const [remarks, setRemarks] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sale-orders', { page, search, status: statusFilter }],
    queryFn: () =>
      getAllSaleOrders({
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter !== 'all' ? (statusFilter as SaleOrderStatus) : undefined,
      }),
  });

  // Search customers using existing customer API
  const { data: customerResults } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: async () => {
      const { default: api } = await import('../lib/api');
      const response = await api.get('/customers/search', { params: { search: customerSearch, limit: 20 } });
      return response.data;
    },
    enabled: customerSearch.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: createSaleOrder,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['sale-orders'] });
      toast.success('Sale Order created');
      setCreateDialogOpen(false);
      resetForm();
      navigate(`/sale-orders/${created.id}`);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to create sale order');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSaleOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale-orders'] });
      toast.success('Sale Order deleted');
      setDeleteDialogOpen(false);
      setSoToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to delete sale order');
    },
  });

  const resetForm = () => {
    setCustomerSearch('');
    setSelectedCustomerId('');
    setSelectedCustomerLabel('');
    setExpectedShipDate('');
    setRemarks('');
  };

  const handleCreate = () => {
    if (!selectedCustomerId) {
      toast.error('Please select a customer');
      return;
    }

    const request: CreateSORequest = {
      customerId: selectedCustomerId,
      expectedShipDate: expectedShipDate || undefined,
      remarks: remarks || undefined,
      items: [], // Items will be added in detail page
    };

    createMutation.mutate(request);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-6 w-6" />
            Sale Orders
          </h1>
          <p className="text-muted-foreground">
            Sell from existing finished goods stock
          </p>
        </div>
        <Button onClick={() => { resetForm(); setCreateDialogOpen(true); }}>
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
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
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
                    <TableCell className="font-mono font-medium">{so.saleOrderNumber}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{so.customer?.name}</div>
                        <div className="text-xs text-muted-foreground">{so.customer?.code}</div>
                      </div>
                    </TableCell>
                    <TableCell>{new Date(so.saleDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(so.totalAmount))}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[so.status]} variant="secondary">
                        {so.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{so._count?.items || 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/sale-orders/${so.id}`)}
                        >
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
                            <Trash2 className="h-4 w-4 text-red-500" />
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

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Sale Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Customer *</Label>
              <Input
                placeholder="Search customers..."
                value={selectedCustomerLabel || customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setSelectedCustomerId('');
                  setSelectedCustomerLabel('');
                }}
              />
              {customerSearch.length >= 2 && !selectedCustomerId && customerResults && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {(customerResults as any[]).map((c: any) => (
                    <div
                      key={c.id}
                      className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                      onClick={() => {
                        setSelectedCustomerId(c.id);
                        setSelectedCustomerLabel(`${c.code} - ${c.name}`);
                        setCustomerSearch('');
                      }}
                    >
                      <span className="font-mono">{c.code}</span> — {c.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Expected Ship Date</Label>
              <Input
                type="date"
                value={expectedShipDate}
                onChange={(e) => setExpectedShipDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                placeholder="Optional notes..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Sale Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              className="bg-red-600 hover:bg-red-700"
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
