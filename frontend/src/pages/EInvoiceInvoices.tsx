import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Search,
  QrCode,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  Ban,
  ClipboardCheck,
} from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { getEInvoiceInvoices, generateIrn, cancelIrn, preflightEInvoice } from '@/services/einvoice.service';
import type { EInvoiceInvoiceRow, EInvoicePreflightResult } from '@/types/einvoice.types';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency } from '@/lib/currency';

const CANCEL_REASONS = [
  { value: '1', label: 'Duplicate' },
  { value: '2', label: 'Data entry mistake' },
  { value: '3', label: 'Order cancelled' },
  { value: '4', label: 'Others' },
];

export default function EInvoiceInvoicesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [irnStatus, setIrnStatus] = useState<'all' | 'not_generated' | 'generated' | 'cancelled' | 'error'>('all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkGenerating, setBulkGenerating] = useState(false);

  const [preflightDialog, setPreflightDialog] = useState<{
    invoiceNumber: string;
    result: EInvoicePreflightResult;
  } | null>(null);
  const [preflightLoading, setPreflightLoading] = useState<string | null>(null);

  const [cancelTarget, setCancelTarget] = useState<EInvoiceInvoiceRow | null>(null);
  const [cancelReason, setCancelReason] = useState<'1' | '2' | '3' | '4'>('2');
  const [cancelRemarks, setCancelRemarks] = useState('');

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['einvoice-invoices', { search: debouncedSearch, irnStatus, page }],
    queryFn: () =>
      getEInvoiceInvoices({
        search: debouncedSearch || undefined,
        irnStatus: irnStatus === 'all' ? undefined : irnStatus,
        page,
        limit: 20,
      }),
  });

  const generateMutation = useMutation({
    mutationFn: generateIrn,
    onSuccess: (result) => {
      if (result.success) {
        handleApiSuccess('IRN generated', `IRN: ${result.irn?.slice(0, 20)}…`);
      } else {
        handleApiError(
          new Error(result.problems?.join(' ') || result.error || 'Generation failed'),
          'IRN generation failed'
        );
      }
      queryClient.invalidateQueries({ queryKey: ['einvoice-invoices'] });
    },
    onError: (error) => handleApiError(error, 'IRN generation failed'),
  });

  const cancelMutation = useMutation({
    mutationFn: ({
      invoiceId,
      reason,
      remarks,
    }: {
      invoiceId: string;
      reason: '1' | '2' | '3' | '4';
      remarks: string;
    }) => cancelIrn(invoiceId, { reason, remarks }),
    onSuccess: (result) => {
      if (result.success) {
        handleApiSuccess('IRN cancelled', 'The IRN has been cancelled on the portal.');
      } else {
        handleApiError(new Error(result.error || 'Cancel failed'), 'IRN cancel failed');
      }
      setCancelTarget(null);
      setCancelRemarks('');
      queryClient.invalidateQueries({ queryKey: ['einvoice-invoices'] });
    },
    onError: (error) => handleApiError(error, 'IRN cancel failed'),
  });

  const runPreflight = async (row: EInvoiceInvoiceRow) => {
    setPreflightLoading(row.id);
    try {
      const result = await preflightEInvoice(row.id);
      setPreflightDialog({ invoiceNumber: row.invoiceNumber, result });
    } catch (error) {
      handleApiError(error, 'Preflight check failed');
    } finally {
      setPreflightLoading(null);
    }
  };

  const canGenerate = (row: EInvoiceInvoiceRow) => !row.b2c && !row.eInvoiceIrn;

  const withinCancelWindow = (row: EInvoiceInvoiceRow) => {
    if (!row.eInvoiceAckDate) return true;
    return Date.now() - new Date(row.eInvoiceAckDate).getTime() < 24 * 60 * 60 * 1000;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && data?.data) {
      setSelectedIds(new Set(data.data.filter(canGenerate).map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedIds(newSet);
  };

  const handleBulkGenerate = async () => {
    if (selectedIds.size === 0) return;
    setBulkGenerating(true);
    let successCount = 0;
    let failCount = 0;
    for (const id of selectedIds) {
      try {
        const result = await generateIrn(id);
        if (result.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    setBulkGenerating(false);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['einvoice-invoices'] });
    if (failCount === 0) {
      handleApiSuccess('Bulk generation complete', `Generated IRNs for ${successCount} invoice(s)`);
    } else if (successCount > 0) {
      handleApiSuccess(
        'Bulk generation partial',
        `${successCount} generated, ${failCount} failed — check error status.`
      );
    } else {
      handleApiError(new Error(`All ${failCount} invoice(s) failed`), 'Bulk generation failed');
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const getStatusBadge = (row: EInvoiceInvoiceRow) => {
    if (row.eInvoiceStatus === 'GENERATED') {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Generated
        </Badge>
      );
    }
    if (row.eInvoiceStatus === 'CANCELLED') {
      return (
        <Badge variant="secondary" className="bg-gray-200 text-gray-700">
          <Ban className="h-3 w-3 mr-1" />
          Cancelled
        </Badge>
      );
    }
    if (row.eInvoiceLastError) {
      return (
        <Badge variant="destructive" className="bg-red-100 text-red-800">
          <XCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      );
    }
    if (row.b2c) {
      return (
        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
          B2C — not eligible
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };
  const pushableCount = data?.data.filter(canGenerate).length || 0;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-medium text-foreground">IRN Generation</h1>
        <p className="text-muted-foreground mt-1">
          Generate government e-Invoice IRNs for B2B invoices via the Invoice Registration Portal
        </p>
      </div>

      {/* Quick Links */}
      <div className="flex gap-2 mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings/einvoice">e-Invoice Settings</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings/tally/invoices">Tally Invoice Push</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Invoices
              </CardTitle>
              <CardDescription>
                {pagination.total} total • {pushableCount} on this page ready to generate
                {selectedIds.size > 0 && ` • ${selectedIds.size} selected`}
              </CardDescription>
            </div>
            {selectedIds.size > 0 && (
              <Button onClick={handleBulkGenerate} disabled={bulkGenerating} className="gap-2">
                {bulkGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                Generate {selectedIds.size} Selected
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoice number, customer, IRN..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={irnStatus}
              onValueChange={(v) => {
                setIrnStatus(v as typeof irnStatus);
                setPage(1);
                setSelectedIds(new Set());
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Invoices</SelectItem>
                <SelectItem value="not_generated">Not Generated</SelectItem>
                <SelectItem value="generated">Generated</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="error">With Errors</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={
                            pushableCount > 0 && data?.data.filter(canGenerate).every((r) => selectedIds.has(r.id))
                          }
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>IRN / Error</TableHead>
                      <TableHead className="w-[140px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No invoices found
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.data.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(row.id)}
                              onCheckedChange={(checked) => handleSelectOne(row.id, !!checked)}
                              disabled={!canGenerate(row)}
                            />
                          </TableCell>
                          <TableCell>
                            <span className="font-mono">{row.invoiceNumber}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {row.customerName}
                              {row.b2c && (
                                <span title="No GSTIN on customer — B2C invoice">
                                  <AlertCircle className="h-3 w-3 text-orange-500" />
                                </span>
                              )}
                            </div>
                            {row.buyerGstin && (
                              <div className="text-xs text-muted-foreground font-mono">{row.buyerGstin}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{formatDate(row.invoiceDate)}</span>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(row.totalAmount)}</TableCell>
                          <TableCell>{getStatusBadge(row)}</TableCell>
                          <TableCell>
                            {row.eInvoiceIrn ? (
                              <span
                                className="text-xs font-mono text-muted-foreground truncate max-w-[160px] block"
                                title={row.eInvoiceIrn}
                              >
                                {row.eInvoiceIrn.slice(0, 20)}…
                              </span>
                            ) : row.eInvoiceLastError ? (
                              <span
                                className="text-sm text-red-600 truncate max-w-[160px] block"
                                title={row.eInvoiceLastError}
                              >
                                {row.eInvoiceLastError.slice(0, 40)}…
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {canGenerate(row) && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => runPreflight(row)}
                                    disabled={preflightLoading === row.id}
                                    title="Check invoice data before generating"
                                  >
                                    {preflightLoading === row.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <ClipboardCheck className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => generateMutation.mutate(row.id)}
                                    disabled={generateMutation.isPending}
                                    title="Generate IRN"
                                  >
                                    <QrCode className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {row.eInvoiceStatus === 'GENERATED' && withinCancelWindow(row) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setCancelTarget(row)}
                                  title="Cancel IRN (within 24h)"
                                >
                                  <Ban className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" asChild>
                                <Link to={`/invoices/${row.id}`}>
                                  <ExternalLink className="h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} invoices)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pagination.page === 1 || isFetching}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={pagination.page === pagination.totalPages || isFetching}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Preflight Dialog */}
      <Dialog open={!!preflightDialog} onOpenChange={(open) => !open && setPreflightDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Preflight — {preflightDialog?.invoiceNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            {preflightDialog?.result.eligible ? (
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-4 w-4" />
                Invoice data is complete — ready to generate the IRN.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-700 font-medium">
                  <XCircle className="h-4 w-4" />
                  Fix these before generating:
                </div>
                <ul className="list-disc ml-6 space-y-1 text-red-700">
                  {preflightDialog?.result.problems.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {(preflightDialog?.result.warnings.length ?? 0) > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-amber-700 font-medium">
                  <AlertCircle className="h-4 w-4" />
                  Warnings:
                </div>
                <ul className="list-disc ml-6 space-y-1 text-amber-700">
                  {preflightDialog?.result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreflightDialog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel IRN — {cancelTarget?.invoiceNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Cancelling removes the IRN on the government portal. This is only possible within 24 hours of generation
              and cannot be undone — the same invoice number can never be registered again.
            </p>
            <div>
              <Label>Reason</Label>
              <Select value={cancelReason} onValueChange={(v) => setCancelReason(v as typeof cancelReason)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANCEL_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea
                value={cancelRemarks}
                onChange={(e) => setCancelRemarks(e.target.value)}
                placeholder="Short explanation (min 3 characters)"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Keep IRN
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                cancelTarget &&
                cancelMutation.mutate({ invoiceId: cancelTarget.id, reason: cancelReason, remarks: cancelRemarks })
              }
              disabled={cancelRemarks.trim().length < 3 || cancelMutation.isPending}
            >
              {cancelMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cancel IRN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
