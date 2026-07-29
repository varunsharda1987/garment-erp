import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { creditNoteService } from '@/services/creditNote.service';
import api from '@/lib/api';
import type {
  CreditNote,
  CreditNoteQueryParams,
  DocumentStatus,
  CreditNoteReason,
  CreateCreditNoteRequest,
} from '@/types/creditNote.types';
import { CreditNoteReasonLabels, DocumentStatusLabels, DocumentStatusColors } from '@/types/creditNote.types';
import ConfirmDialog from '@/components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { FileText, Plus, Search, CheckCircle2, XCircle, Trash2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getStatusBadgeClasses(status: DocumentStatus): string {
  return DocumentStatusColors[status] ?? 'bg-muted text-foreground';
}

// ---------------------------------------------------------------------------
// Types for the create dialog
// ---------------------------------------------------------------------------

interface InvoiceSearchResult {
  id: string;
  invoiceNumber: string;
  customerId: string;
  // NOTE: backend serializer maps the Prisma `customers` relation to `customer` (singular)
  customer?: {
    id: string;
    code: string;
    name: string;
    billingName?: string;
  };
  invoiceItems?: Array<{
    id: string;
    description: string;
    hsnCode?: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

interface CreditNoteLineItem {
  invoiceItemId?: string;
  description: string;
  hsnCode: string;
  quantity: number;
  unitPrice: number;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CreditNoteList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = usePermissions();

  // List state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Confirm dialogs
  const [approveTarget, setApproveTarget] = useState<CreditNote | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CreditNote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CreditNote | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);

  // Build query params
  const queryParams: CreditNoteQueryParams = {
    page,
    limit,
    search: search || undefined,
    status: statusFilter !== 'all' ? (statusFilter as DocumentStatus) : undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };

  // -----------------------------------------------------------------------
  // Queries & Mutations
  // -----------------------------------------------------------------------

  const { data, isLoading } = useQuery({
    queryKey: ['credit-notes', queryParams],
    queryFn: () => creditNoteService.getAll(queryParams),
  });

  const creditNotes = data?.data ?? [];
  const pagination = data?.pagination;

  const approveMutation = useMutation({
    mutationFn: (id: string) => creditNoteService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      handleApiSuccess('Credit note approved');
      setApproveTarget(null);
    },
    onError: (err) => {
      handleApiError(err, 'Failed to approve credit note');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => creditNoteService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      handleApiSuccess('Credit note cancelled');
      setCancelTarget(null);
    },
    onError: (err) => {
      handleApiError(err, 'Failed to cancel credit note');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => creditNoteService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      handleApiSuccess('Credit note deleted');
      setDeleteTarget(null);
    },
    onError: (err) => {
      handleApiError(err, 'Failed to delete credit note');
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateCreditNoteRequest) => creditNoteService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      handleApiSuccess('Credit note created');
      setCreateOpen(false);
    },
    onError: (err) => {
      handleApiError(err, 'Failed to create credit note');
    },
  });

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-info-muted rounded-lg">
            <FileText className="h-6 w-6 text-info" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-medium text-foreground">Credit Notes</h1>
            <p className="text-sm text-muted-foreground">Manage credit notes issued against customer invoices</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Credit Note
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by credit note number or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center text-sm text-muted-foreground">
              {pagination ? `${pagination.total} credit note${pagination.total !== 1 ? 's' : ''} found` : ''}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : creditNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No credit notes found</p>
              <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first credit note
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Credit Note #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditNotes.map((cn) => (
                    <TableRow
                      key={cn.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/credit-notes/${cn.id}`)}
                    >
                      <TableCell className="font-mono text-sm font-medium">{cn.creditNoteNumber}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {cn.customer?.billingName || cn.customer?.name || '-'}
                        </div>
                        {cn.customer?.code && <div className="text-xs text-muted-foreground">{cn.customer.code}</div>}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-info">{cn.invoice?.invoiceNumber || '-'}</span>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(cn.creditNoteDate)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {CreditNoteReasonLabels[cn.reason] || cn.reason}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">{formatCurrency(cn.totalAmount)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeClasses(cn.status)}>{DocumentStatusLabels[cn.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {cn.status === 'DRAFT' && (
                            <>
                              {/* Approve is ADMIN-only on the backend (maker-checker: the ACCOUNTS user
                                  who raises a note must not approve it). Hide rather than show a button
                                  that 403s. */}
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Approve"
                                  onClick={() => setApproveTarget(cn)}
                                >
                                  <CheckCircle2 className="h-4 w-4 text-success" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" title="Cancel" onClick={() => setCancelTarget(cn)}>
                                <XCircle className="h-4 w-4 text-orange-500" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Delete" onClick={() => setDeleteTarget(cn)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pagination.page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Confirm Dialogs                                                    */}
      {/* ----------------------------------------------------------------- */}

      <ConfirmDialog
        open={!!approveTarget}
        onOpenChange={(open) => {
          if (!open) setApproveTarget(null);
        }}
        title="Approve Credit Note"
        description={`Are you sure you want to approve credit note ${approveTarget?.creditNoteNumber}? This will finalise the document.`}
        confirmText={approveMutation.isPending ? 'Approving...' : 'Approve'}
        onConfirm={() => {
          if (approveTarget) approveMutation.mutate(approveTarget.id);
        }}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        title="Cancel Credit Note"
        description={`Are you sure you want to cancel credit note ${cancelTarget?.creditNoteNumber}? This action cannot be undone.`}
        confirmText={cancelMutation.isPending ? 'Cancelling...' : 'Cancel Credit Note'}
        onConfirm={() => {
          if (cancelTarget) cancelMutation.mutate(cancelTarget.id);
        }}
        variant="destructive"
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Credit Note"
        description={`Are you sure you want to delete credit note ${deleteTarget?.creditNoteNumber}? This action cannot be undone.`}
        confirmText={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        variant="destructive"
      />

      {/* ----------------------------------------------------------------- */}
      {/* Create Credit Note Dialog                                          */}
      {/* ----------------------------------------------------------------- */}

      <CreateCreditNoteDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(payload) => createMutation.mutate(payload)}
        isSubmitting={createMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Credit Note Dialog
// ---------------------------------------------------------------------------

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateCreditNoteRequest) => void;
  isSubmitting: boolean;
}

function CreateCreditNoteDialog({ open, onOpenChange, onSubmit, isSubmitting }: CreateDialogProps) {
  // Invoice search
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceResults, setInvoiceResults] = useState<InvoiceSearchResult[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceSearchResult | null>(null);

  // Form fields
  const [reason, setReason] = useState<CreditNoteReason>('SALES_RETURN');
  const [remarks, setRemarks] = useState('');
  const [lineItems, setLineItems] = useState<CreditNoteLineItem[]>([]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setInvoiceSearch('');
      setInvoiceResults([]);
      setSelectedInvoice(null);
      setReason('SALES_RETURN');
      setRemarks('');
      setLineItems([]);
    }
  }, [open]);

  // Debounced invoice search
  const searchInvoices = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setInvoiceResults([]);
      return;
    }
    try {
      setInvoiceLoading(true);
      const { data } = await api.get('/invoices', { params: { search: q, limit: 20 } });
      setInvoiceResults(data.data ?? []);
    } catch (err) {
      console.error('[CreditNoteList] Invoice search failed:', err);
      toast.error('Failed to search invoices');
      setInvoiceResults([]);
    } finally {
      setInvoiceLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchInvoices(invoiceSearch), 300);
    return () => clearTimeout(timer);
  }, [invoiceSearch, searchInvoices]);

  // When an invoice is selected, populate line items
  const handleSelectInvoice = (inv: InvoiceSearchResult) => {
    setSelectedInvoice(inv);
    setInvoiceSearch('');
    setInvoiceResults([]);

    const items: CreditNoteLineItem[] = (inv.invoiceItems ?? []).map((ii) => ({
      invoiceItemId: ii.id,
      description: ii.description,
      hsnCode: ii.hsnCode ?? '',
      quantity: ii.quantity,
      unitPrice: ii.unitPrice,
    }));
    setLineItems(items);
  };

  const updateLineItem = (index: number, field: keyof CreditNoteLineItem, value: string | number) => {
    setLineItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const computeTotal = () => {
    return lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  const handleSubmit = () => {
    if (!selectedInvoice) return;
    if (lineItems.length === 0) return;

    const payload: CreateCreditNoteRequest = {
      invoiceId: selectedInvoice.id,
      customerId: selectedInvoice.customerId || selectedInvoice.customer?.id || '',
      reason,
      remarks: remarks || undefined,
      items: lineItems.map((li) => ({
        invoiceItemId: li.invoiceItemId,
        description: li.description,
        hsnCode: li.hsnCode || undefined,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
      })),
    };

    onSubmit(payload);
  };

  const canSubmit = !!selectedInvoice && lineItems.length > 0 && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Credit Note</DialogTitle>
          <DialogDescription>Issue a credit note against an existing customer invoice.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invoice selection */}
          <div className="space-y-2">
            <Label>Invoice *</Label>
            {selectedInvoice ? (
              <div className="flex items-center justify-between rounded-md border p-3 bg-muted/30">
                <div>
                  <span className="font-mono font-medium text-sm">{selectedInvoice.invoiceNumber}</span>
                  <span className="mx-2 text-muted-foreground">-</span>
                  <span className="text-sm">
                    {selectedInvoice.customer?.billingName || selectedInvoice.customer?.name || 'N/A'}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedInvoice(null);
                    setLineItems([]);
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice number..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  className="pl-8"
                />
                {invoiceLoading && (
                  <div className="absolute right-3 top-2.5">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                  </div>
                )}
                {invoiceResults.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-y-auto">
                    {invoiceResults.map((inv) => (
                      <button
                        key={inv.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => handleSelectInvoice(inv)}
                      >
                        <span className="font-mono">{inv.invoiceNumber}</span>
                        <span className="text-muted-foreground">
                          {inv.customer?.billingName || inv.customer?.name || ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as CreditNoteReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CreditNoteReasonLabels) as CreditNoteReason[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {CreditNoteReasonLabels[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                placeholder="Optional remarks..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* Line items */}
          {selectedInvoice && (
            <div className="space-y-2">
              <Label>Line Items</Label>
              {lineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No line items. The selected invoice has no items.
                </p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Description</TableHead>
                        <TableHead className="w-[100px]">HSN</TableHead>
                        <TableHead className="w-[100px] text-right">Qty</TableHead>
                        <TableHead className="w-[120px] text-right">Unit Price</TableHead>
                        <TableHead className="w-[120px] text-right">Total</TableHead>
                        <TableHead className="w-[60px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Input
                              value={item.description}
                              onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.hsnCode}
                              onChange={(e) => updateLineItem(idx, 'hsnCode', e.target.value)}
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              className="h-8 text-sm text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              value={item.unitPrice}
                              onChange={(e) => updateLineItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="h-8 text-sm text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {formatCurrency(item.quantity * item.unitPrice)}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLineItem(idx)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Total row */}
                  <div className="flex justify-end border-t px-4 py-2">
                    <span className="text-sm font-medium mr-4">Total:</span>
                    <span className="text-sm font-bold">{formatCurrency(computeTotal())}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? 'Creating...' : 'Create Credit Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
