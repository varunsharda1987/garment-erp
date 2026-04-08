import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Search, Warehouse, Eye } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getAllSPOs, createSPO, deleteSPO } from '@/services/stockProductionOrder.service';
import { styleService } from '@/services/style.service';
import type {
  StockProductionOrder,
  StockProductionOrderStatus,
  CreateSPORequest,
  Priority,
} from '@/types/stockProductionOrder.types';

interface ApiError {
  response?: { data?: { message?: string } };
}

interface StyleSearchResult {
  id: string;
  styleCode: string;
  styleName: string;
}

const STATUS_COLORS: Record<StockProductionOrderStatus, string> = {
  DRAFT: 'bg-muted text-foreground',
  APPROVED: 'bg-info-muted text-info',
  IN_PRODUCTION: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-success-muted text-success',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

export default function StockProductionOrderList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [spoToDelete, setSpoToDelete] = useState<StockProductionOrder | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Create form state
  const [styleSearch, setStyleSearch] = useState('');
  const [selectedStyleId, setSelectedStyleId] = useState('');
  const [selectedStyleLabel, setSelectedStyleLabel] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [remarks, setRemarks] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['stock-production-orders', { page, search, status: statusFilter }],
    queryFn: () =>
      getAllSPOs({
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter !== 'all' ? (statusFilter as StockProductionOrderStatus) : undefined,
      }),
  });

  const { data: styleResults } = useQuery({
    queryKey: ['styles-search', styleSearch],
    queryFn: async () => {
      const response = await styleService.getAllStyles(1, 20, styleSearch);
      return response.data;
    },
    enabled: styleSearch.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: createSPO,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['stock-production-orders'] });
      toast.success('Stock Production Order created');
      setCreateDialogOpen(false);
      resetForm();
      navigate(`/stock-production-orders/${created.id}`);
    },
    onError: (error: unknown) => {
      toast.error((error as ApiError)?.response?.data?.message || 'Failed to create SPO');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSPO,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-production-orders'] });
      toast.success('SPO deleted');
      setDeleteDialogOpen(false);
      setSpoToDelete(null);
    },
    onError: (error: unknown) => {
      toast.error((error as ApiError)?.response?.data?.message || 'Failed to delete SPO');
    },
  });

  const resetForm = () => {
    setStyleSearch('');
    setSelectedStyleId('');
    setSelectedStyleLabel('');
    setTotalQuantity('');
    setTargetDate('');
    setPriority('MEDIUM');
    setRemarks('');
  };

  const handleCreate = () => {
    if (!selectedStyleId) {
      toast.error('Please select a style');
      return;
    }
    if (!totalQuantity || parseInt(totalQuantity) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    const request: CreateSPORequest = {
      styleId: selectedStyleId,
      totalQuantity: parseInt(totalQuantity),
      targetDate: targetDate || undefined,
      priority: priority as Priority,
      remarks: remarks || undefined,
      items: [], // Items will be added in detail page
    };

    createMutation.mutate(request);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-medium flex items-center gap-2">
            <Warehouse className="h-6 w-6" />
            Stock Production Orders
          </h1>
          <p className="text-muted-foreground">Produce garments for stock without a specific customer order</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setCreateDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Stock Production
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by SPO number or style..."
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
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="IN_PRODUCTION">In Production</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SPO Number</TableHead>
                <TableHead>Style</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Target Date</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Work Orders</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : !data?.data?.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No stock production orders found
                  </TableCell>
                </TableRow>
              ) : (
                data.data.map((spo) => (
                  <TableRow
                    key={spo.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/stock-production-orders/${spo.id}`)}
                  >
                    <TableCell className="font-mono font-medium">{spo.spoNumber}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{spo.style?.styleCode}</div>
                        <div className="text-sm text-muted-foreground">{spo.style?.styleName}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{spo.totalQuantity.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[spo.status]} variant="secondary">
                        {spo.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{spo.targetDate ? new Date(spo.targetDate).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{spo.priority}</Badge>
                    </TableCell>
                    <TableCell>{spo._count?.workOrders || 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/stock-production-orders/${spo.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {spo.status === 'DRAFT' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSpoToDelete(spo);
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

          {/* Pagination */}
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
            <DialogTitle>New Stock Production Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Style *</Label>
              <Input
                placeholder="Search styles..."
                value={selectedStyleLabel || styleSearch}
                onChange={(e) => {
                  setStyleSearch(e.target.value);
                  setSelectedStyleId('');
                  setSelectedStyleLabel('');
                }}
              />
              {styleSearch.length >= 2 && !selectedStyleId && styleResults && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {(styleResults as StyleSearchResult[]).map((style) => (
                    <div
                      key={style.id}
                      className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                      onClick={() => {
                        setSelectedStyleId(style.id);
                        setSelectedStyleLabel(`${style.styleCode} - ${style.styleName}`);
                        setStyleSearch('');
                      }}
                    >
                      <span className="font-mono">{style.styleCode}</span> — {style.styleName}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Quantity *</Label>
                <Input
                  type="number"
                  placeholder="e.g. 2000"
                  value={totalQuantity}
                  onChange={(e) => setTotalQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Target Date</Label>
                <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
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
              <Label>Remarks</Label>
              <Textarea placeholder="Optional notes..." value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create SPO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stock Production Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {spoToDelete?.spoNumber}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive"
              onClick={() => spoToDelete && deleteMutation.mutate(spoToDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
