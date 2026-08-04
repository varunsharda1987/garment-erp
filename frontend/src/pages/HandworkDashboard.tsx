/**
 * Handwork Dashboard
 * WIP dashboard + transaction list for handwork external process
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
import { toast } from 'sonner';
import { externalProcessService } from '../services/external-process.service';
import { Plus, PackageCheck, Clock, AlertTriangle, CheckCircle2, Search, XCircle } from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import type { ExternalProcessSendOut, ExternalProcessStatus } from '../types/external-process.types';

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

export default function HandworkDashboard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const { data: dashboard } = useQuery({
    queryKey: ['handwork-dashboard'],
    queryFn: () => externalProcessService.getDashboard('HANDWORK'),
  });

  const { data: sendOutsData, isLoading } = useQuery({
    queryKey: ['handwork-sendouts', { search, status: statusFilter, page }],
    queryFn: () =>
      externalProcessService.getSendOuts({
        processType: 'HANDWORK',
        status: statusFilter !== 'all' ? (statusFilter as ExternalProcessStatus) : undefined,
        search: search || undefined,
        page,
        limit: 20,
      }),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => externalProcessService.cancelSendOut(id, reason),
    onSuccess: () => {
      toast.success('Send-out cancelled successfully');
      queryClient.invalidateQueries({ queryKey: ['handwork-sendouts'] });
      queryClient.invalidateQueries({ queryKey: ['handwork-dashboard'] });
      setCancelId(null);
      setCancelReason('');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to cancel send-out');
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
          <h1 className="text-2xl font-display font-medium">Handwork</h1>
          <p className="text-muted-foreground">Track handwork send-outs and WIP (post-stitching)</p>
        </div>
        <Link to="/manufacturing/handwork/send-out">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Send-Out
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
              <p className="text-xs text-muted-foreground">{summary.totalQtyPending} pcs pending</p>
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
              <p className="text-xs text-muted-foreground">{summary.totalQtyReceived} pcs received</p>
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

      {dashboard?.byVendor && dashboard.byVendor.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">By Vendor</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-center">Sent</TableHead>
                  <TableHead className="text-center">Pending</TableHead>
                  <TableHead className="text-center">Received</TableHead>
                  <TableHead className="text-center">Overdue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.byVendor.map((v) => (
                  <TableRow key={v.supplierId}>
                    <TableCell className="font-medium">{v.supplierName}</TableCell>
                    <TableCell className="text-center">{v.sent}</TableCell>
                    <TableCell className="text-center">{v.pending}</TableCell>
                    <TableCell className="text-center">{v.received}</TableCell>
                    <TableCell className="text-center">
                      {v.overdue > 0 ? <span className="text-destructive font-medium">{v.overdue}</span> : '0'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by batch number, vendor, work order..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
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
            <SelectItem value="SENT">Sent</SelectItem>
            <SelectItem value="PARTIALLY_RECEIVED">Partially Received</SelectItem>
            <SelectItem value="RECEIVED">Received</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch #</TableHead>
                <TableHead>Work Order</TableHead>
                <TableHead>Style</TableHead>
                <TableHead>Buyer Ref</TableHead>
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
                  <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : sendOuts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                    No handwork send-outs found
                  </TableCell>
                </TableRow>
              ) : (
                sendOuts.map((s) => (
                  <TableRow key={s.id} className={isOverdue(s) ? 'bg-destructive/10' : ''}>
                    <TableCell className="font-mono text-sm">{s.batchNumber}</TableCell>
                    <TableCell>{s.workOrder?.workOrderNumber || '—'}</TableCell>
                    <TableCell>{s.style?.styleCode || '—'}</TableCell>
                    <TableCell>{s.style?.buyerStyleRef || '—'}</TableCell>
                    <TableCell>{s.supplier?.name || '—'}</TableCell>
                    <TableCell className="text-right">{s.quantitySent} PCS</TableCell>
                    <TableCell className="text-right">
                      {s.quantityReceived != null ? `${s.quantityReceived} PCS` : '—'}
                    </TableCell>
                    <TableCell>{format(new Date(s.sendDate), 'dd MMM yyyy')}</TableCell>
                    <TableCell>
                      {s.actualReturnDate ? (
                        format(new Date(s.actualReturnDate), 'dd MMM yyyy')
                      ) : s.expectedReturnDate ? (
                        <span className={isOverdue(s) ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                          {format(new Date(s.expectedReturnDate), 'dd MMM yyyy')}
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
                          <Link to={`/manufacturing/handwork/receive/${s.id}`}>
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

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
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
              This will reverse stock deductions and mark the send-out as cancelled. Please provide a reason.
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
