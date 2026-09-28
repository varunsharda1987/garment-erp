/**
 * Embroidery Piece-Level Dashboard
 * Tracks cut pieces sent for embroidery (not fabric meters — that's the existing embroidery stock pages)
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Textarea } from '../components/ui/textarea';
import Pagination from '@/components/Pagination';
import SearchInput from '@/components/SearchInput';
import { FilterBar } from '@/components/filters';
import { SupplierCombobox } from '@/components/SupplierCombobox';
import { toast } from 'sonner';
import { externalProcessService } from '../services/external-process.service';
import { Plus, PackageCheck, Clock, AlertTriangle, CheckCircle2, X, XCircle } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import type { ExternalProcessSendOut, ExternalProcessStatus } from '../types/external-process.types';
import { formatDate } from '@/lib/date';

const STATUS_BADGES: Record<
  ExternalProcessStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  DRAFT: { label: 'Draft', variant: 'outline' },
  SENT: { label: 'Sent', variant: 'default' },
  PARTIALLY_RECEIVED: { label: 'Partial', variant: 'secondary' },
  RECEIVED: { label: 'Received', variant: 'outline' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
};

// A send-out is created SENT, so Draft is never a status to filter on
const STATUS_FILTER_OPTIONS: ExternalProcessStatus[] = ['SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'];

export default function EmbroideryPieceDashboard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierId, setSupplierId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const activeFilterCount = [search, statusFilter !== 'all', supplierId].filter(Boolean).length;

  // Clears every filter and goes back to page 1; the page size stays
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setSupplierId('');
    setPage(1);
  };

  const { data: dashboard } = useQuery({
    queryKey: ['embroidery-piece-dashboard'],
    queryFn: () => externalProcessService.getDashboard('EMBROIDERY_PIECE'),
  });

  const { data: sendOutsData, isLoading } = useQuery({
    queryKey: ['embroidery-piece-sendouts', { search, status: statusFilter, supplierId, page, pageSize }],
    queryFn: () =>
      externalProcessService.getSendOuts({
        processType: 'EMBROIDERY_PIECE',
        status: statusFilter !== 'all' ? (statusFilter as ExternalProcessStatus) : undefined,
        search: search || undefined,
        supplierId: supplierId || undefined,
        page,
        limit: pageSize,
      }),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => externalProcessService.cancelSendOut(id, reason),
    onSuccess: () => {
      toast.success('Send-out cancelled');
      queryClient.invalidateQueries({ queryKey: ['embroidery-piece-sendouts'] });
      queryClient.invalidateQueries({ queryKey: ['embroidery-piece-dashboard'] });
      setCancelId(null);
      setCancelReason('');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to cancel');
    },
  });

  const summary = dashboard?.summary;
  const sendOuts = sendOutsData?.data || [];
  const pagination = sendOutsData?.pagination;

  const isOverdue = (s: ExternalProcessSendOut) =>
    (s.status === 'SENT' || s.status === 'PARTIALLY_RECEIVED') &&
    s.expectedReturnDate &&
    new Date(s.expectedReturnDate) < new Date();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-medium">Embroidery — Piece Tracking</h1>
          <p className="text-muted-foreground">Track cut pieces sent for embroidery (post-cutting)</p>
        </div>
        <Link to="/embroidery-stock/piece-send-out">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Piece Send-Out
          </Button>
        </Link>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <PackageCheck className="h-4 w-4 text-info" />
                <span className="text-sm text-muted-foreground">Total Sent</span>
              </div>
              <p className="mt-1 text-2xl font-bold">{summary.totalSent}</p>
              <p className="text-xs text-muted-foreground">{summary.totalQtySent} pcs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">Pending</span>
              </div>
              <p className="mt-1 text-2xl font-bold">{summary.pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <PackageCheck className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">Partial</span>
              </div>
              <p className="mt-1 text-2xl font-bold">{summary.partiallyReceived}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm text-muted-foreground">Received</span>
              </div>
              <p className="mt-1 text-2xl font-bold">{summary.received}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-muted-foreground">Overdue</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-destructive">{summary.overdue}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <FilterBar
        onClear={clearFilters}
        hasActiveFilters={activeFilterCount > 0}
        clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
      >
        <SearchInput
          className="flex-1 min-w-[240px]"
          placeholder="Search batch number, vendor, work order…"
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
        />
        <SupplierCombobox
          value={supplierId}
          onValueChange={(v) => {
            setSupplierId(v || '');
            setPage(1);
          }}
          allowAll
          allLabel="All vendors"
          placeholder="All vendors"
          className="w-[220px]"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_FILTER_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_BADGES[status].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch #</TableHead>
                <TableHead>Work Order</TableHead>
                <TableHead>Embroidery</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead>Send Date</TableHead>
                <TableHead>Return Date</TableHead>
                <TableHead className="text-center">Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : sendOuts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    {activeFilterCount > 0 ? (
                      <>
                        <p>No embroidery piece send-outs match these filters.</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                          <X className="h-4 w-4 mr-1" />
                          Clear filters
                        </Button>
                      </>
                    ) : (
                      'No embroidery piece send-outs found'
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                sendOuts.map((s) => (
                  <TableRow key={s.id} className={isOverdue(s) ? 'bg-destructive/10' : ''}>
                    <TableCell className="font-mono text-sm">{s.batchNumber}</TableCell>
                    <TableCell>{s.workOrder?.workOrderNumber || '—'}</TableCell>
                    <TableCell>{s.embroidery?.designName || '—'}</TableCell>
                    <TableCell>{s.supplier?.name || '—'}</TableCell>
                    <TableCell className="text-right">{s.quantitySent} PCS</TableCell>
                    <TableCell className="text-right">
                      {s.quantityReceived != null ? `${s.quantityReceived} PCS` : '—'}
                    </TableCell>
                    <TableCell>{formatDate(new Date(s.sendDate))}</TableCell>
                    <TableCell>
                      {s.actualReturnDate ? (
                        formatDate(new Date(s.actualReturnDate))
                      ) : s.expectedReturnDate ? (
                        <span className={isOverdue(s) ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                          {formatDate(new Date(s.expectedReturnDate))}
                          {isOverdue(s) && ' (Overdue)'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {s.actualReturnDate
                        ? Math.max(1, differenceInCalendarDays(new Date(s.actualReturnDate), new Date(s.sendDate)))
                        : `${Math.max(1, differenceInCalendarDays(new Date(), new Date(s.sendDate)))}...`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGES[s.status]?.variant || 'outline'}>
                        {STATUS_BADGES[s.status]?.label || s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(s.status === 'SENT' || s.status === 'PARTIALLY_RECEIVED') && (
                          <Link to={`/embroidery-stock/piece-receive/${s.id}`}>
                            <Button variant="outline" size="sm">
                              Receive
                            </Button>
                          </Link>
                        )}
                        {s.status === 'SENT' && (
                          <Button variant="ghost" size="sm" onClick={() => setCancelId(s.id)}>
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pagination && (
        <Pagination
          currentPage={page}
          totalPages={pagination.totalPages}
          pageSize={pageSize}
          totalItems={pagination.total}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          pageSizeOptions={[20, 50, 100]}
          itemLabel="send-outs"
        />
      )}

      <AlertDialog
        open={!!cancelId}
        onOpenChange={() => {
          setCancelId(null);
          setCancelReason('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Send-Out</AlertDialogTitle>
            <AlertDialogDescription>
              This will reverse stock changes and mark the send-out as cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Cancellation reason..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              disabled={!cancelReason.trim() || cancelMutation.isPending}
              onClick={() => cancelId && cancelMutation.mutate({ id: cancelId, reason: cancelReason })}
              className="bg-destructive hover:bg-destructive"
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Send-Out'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
