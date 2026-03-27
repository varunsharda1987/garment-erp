import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { debitNoteService } from '@/services/debitNote.service';
import type { DebitNoteQueryParams, DocumentStatus, DebitNoteReason } from '@/types/debitNote.types';
import { DebitNoteReasonLabels } from '@/types/debitNote.types';
import { DocumentStatusLabels, DocumentStatusColors } from '@/types/creditNote.types';
import ConfirmDialog from '@/components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import api from '@/lib/api';
import { FileText, Plus, Search, CheckCircle2, XCircle, Trash2 } from 'lucide-react';

// ---- Supplier / PO search types ----
interface SupplierOption {
  id: string;
  code: string;
  name: string;
}

interface POOption {
  id: string;
  poNumber: string;
  totalAmount: number;
}

// ---- Line item shape for the create form ----
interface LineItem {
  key: number;
  description: string;
  hsnCode: string;
  quantity: number;
  unitPrice: number;
}

const emptyLineItem = (key: number): LineItem => ({
  key,
  description: '',
  hsnCode: '',
  quantity: 1,
  unitPrice: 0,
});

// ---- Helpers ----
const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const REASONS: DebitNoteReason[] = [
  'PURCHASE_RETURN',
  'RATE_DIFFERENCE',
  'QUALITY_ISSUE',
  'QUANTITY_SHORT',
  'DAMAGED_GOODS',
  'OTHER',
];

const STATUSES: DocumentStatus[] = ['DRAFT', 'APPROVED', 'CANCELLED'];

// ============================================================
// Component
// ============================================================

export default function DebitNoteList() {
  const queryClient = useQueryClient();

  // ---- List state ----
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  // ---- List query ----
  const queryParams: DebitNoteQueryParams = {
    page,
    limit,
    search: search || undefined,
    status: statusFilter !== 'all' ? (statusFilter as DocumentStatus) : undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['debit-notes', queryParams],
    queryFn: () => debitNoteService.getAll(queryParams),
  });

  const debitNotes = data?.data ?? [];
  const pagination = data?.pagination ?? { page: 1, limit, total: 0, totalPages: 1 };

  // ---- Mutations ----
  const approveMutation = useMutation({
    mutationFn: (id: string) => debitNoteService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debit-notes'] });
      handleApiSuccess('Debit note approved', 'The debit note has been approved successfully.');
    },
    onError: (err) => handleApiError(err, 'Failed to approve debit note'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => debitNoteService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debit-notes'] });
      handleApiSuccess('Debit note cancelled', 'The debit note has been cancelled.');
    },
    onError: (err) => handleApiError(err, 'Failed to cancel debit note'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => debitNoteService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debit-notes'] });
      handleApiSuccess('Debit note deleted', 'The debit note has been deleted.');
    },
    onError: (err) => handleApiError(err, 'Failed to delete debit note'),
  });

  // ---- Confirm dialogs ----
  const [approveTarget, setApproveTarget] = useState<{ id: string; number: string } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; number: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; number: string } | null>(null);

  // ---- Create dialog state ----
  const [createOpen, setCreateOpen] = useState(false);

  // Supplier search
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierOption | null>(null);
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);

  // PO options
  const [poOptions, setPOOptions] = useState<POOption[]>([]);
  const [selectedPOId, setSelectedPOId] = useState<string>('');
  const [loadingPOs, setLoadingPOs] = useState(false);

  // Form fields
  const [reason, setReason] = useState<DebitNoteReason>('PURCHASE_RETURN');
  const [remarks, setRemarks] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLineItem(1)]);
  const [nextKey, setNextKey] = useState(2);
  const [creating, setCreating] = useState(false);

  // ---- Supplier search effect ----
  useEffect(() => {
    if (!supplierSearch || supplierSearch.length < 2) {
      setSupplierOptions([]);
      return;
    }
    const controller = new AbortController();
    const fetchSuppliers = async () => {
      try {
        const { data: res } = await api.get('/suppliers/search', {
          params: { q: supplierSearch, limit: 20 },
          signal: controller.signal,
        });
        setSupplierOptions(res.data ?? res ?? []);
      } catch {
        // ignore abort errors
      }
    };
    const timeout = setTimeout(fetchSuppliers, 300);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [supplierSearch]);

  // ---- Load POs when supplier selected ----
  useEffect(() => {
    if (!selectedSupplier) {
      setPOOptions([]);
      setSelectedPOId('');
      return;
    }
    const loadPOs = async () => {
      setLoadingPOs(true);
      try {
        const { data: res } = await api.get('/purchase-orders', {
          params: { supplierId: selectedSupplier.id, limit: 50 },
        });
        const list = res.data ?? res ?? [];
        setPOOptions(
          list.map((po: { id: string; poNumber: string; totalAmount: number }) => ({
            id: po.id,
            poNumber: po.poNumber,
            totalAmount: po.totalAmount,
          }))
        );
      } catch {
        setPOOptions([]);
      } finally {
        setLoadingPOs(false);
      }
    };
    loadPOs();
  }, [selectedSupplier]);

  // ---- Line item helpers ----
  const addLineItem = useCallback(() => {
    setLineItems((prev) => [...prev, emptyLineItem(nextKey)]);
    setNextKey((k) => k + 1);
  }, [nextKey]);

  const removeLineItem = useCallback((key: number) => {
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((li) => li.key !== key)));
  }, []);

  const updateLineItem = useCallback((key: number, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) => prev.map((li) => (li.key === key ? { ...li, [field]: value } : li)));
  }, []);

  const lineTotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);

  // ---- Reset create form ----
  const resetCreateForm = useCallback(() => {
    setSupplierSearch('');
    setSupplierOptions([]);
    setSelectedSupplier(null);
    setSupplierDropdownOpen(false);
    setPOOptions([]);
    setSelectedPOId('');
    setReason('PURCHASE_RETURN');
    setRemarks('');
    setLineItems([emptyLineItem(1)]);
    setNextKey(2);
  }, []);

  // ---- Submit create ----
  const handleCreate = async () => {
    if (!selectedSupplier) return;
    const validItems = lineItems.filter((li) => li.description.trim() && li.quantity > 0 && li.unitPrice > 0);
    if (validItems.length === 0) return;

    setCreating(true);
    try {
      await debitNoteService.create({
        supplierId: selectedSupplier.id,
        poId: selectedPOId || undefined,
        reason,
        remarks: remarks || undefined,
        items: validItems.map((li) => ({
          description: li.description,
          hsnCode: li.hsnCode || undefined,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
        })),
      });
      queryClient.invalidateQueries({ queryKey: ['debit-notes'] });
      handleApiSuccess('Debit note created', 'A new debit note has been created successfully.');
      setCreateOpen(false);
      resetCreateForm();
    } catch (err) {
      handleApiError(err, 'Failed to create debit note');
    } finally {
      setCreating(false);
    }
  };

  // ---- Pagination helpers ----
  const canPrev = page > 1;
  const canNext = page < pagination.totalPages;

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <FileText className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Debit Notes</h1>
            <p className="text-sm text-gray-500">Manage supplier debit notes</p>
          </div>
        </div>
        <Button
          onClick={() => {
            resetCreateForm();
            setCreateOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Debit Note
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by debit note # or supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {DocumentStatusLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {pagination.total} Debit Note{pagination.total !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Debit Note #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>PO #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-gray-500">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : debitNotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-gray-500">
                    No debit notes found.
                  </TableCell>
                </TableRow>
              ) : (
                debitNotes.map((dn) => (
                  <TableRow key={dn.id}>
                    <TableCell className="font-medium">{dn.debitNoteNumber}</TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm font-medium">{dn.supplier?.name ?? '-'}</div>
                        {dn.supplier?.code && <div className="text-xs text-gray-500">{dn.supplier.code}</div>}
                      </div>
                    </TableCell>
                    <TableCell>{dn.purchaseOrder?.poNumber ?? '-'}</TableCell>
                    <TableCell>{formatDate(dn.debitNoteDate)}</TableCell>
                    <TableCell>{DebitNoteReasonLabels[dn.reason] ?? dn.reason}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(dn.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge className={DocumentStatusColors[dn.status] ?? ''} variant="outline">
                        {DocumentStatusLabels[dn.status] ?? dn.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {dn.status === 'DRAFT' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 gap-1"
                              onClick={() => setApproveTarget({ id: dn.id, number: dn.debitNoteNumber })}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 gap-1"
                              onClick={() => setCancelTarget({ id: dn.id, number: dn.debitNoteNumber })}
                            >
                              <XCircle className="h-4 w-4" />
                              Cancel
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                              onClick={() => setDeleteTarget({ id: dn.id, number: dn.debitNoteNumber })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * limit + 1}
                {' - '}
                {Math.min(page * limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!canPrev} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={!canNext} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Confirm Dialogs                                              */}
      {/* ============================================================ */}

      <ConfirmDialog
        open={!!approveTarget}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        title="Approve Debit Note"
        description={`Are you sure you want to approve debit note ${approveTarget?.number}? This action cannot be undone.`}
        confirmText="Approve"
        onConfirm={() => {
          if (approveTarget) approveMutation.mutate(approveTarget.id);
          setApproveTarget(null);
        }}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel Debit Note"
        description={`Are you sure you want to cancel debit note ${cancelTarget?.number}? This action cannot be undone.`}
        confirmText="Cancel Debit Note"
        variant="destructive"
        onConfirm={() => {
          if (cancelTarget) cancelMutation.mutate(cancelTarget.id);
          setCancelTarget(null);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Debit Note"
        description={`Are you sure you want to delete debit note ${deleteTarget?.number}? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />

      {/* ============================================================ */}
      {/* Create Debit Note Dialog                                     */}
      {/* ============================================================ */}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) resetCreateForm();
          setCreateOpen(open);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Debit Note</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Supplier search */}
            <div className="space-y-1.5">
              <Label>Supplier *</Label>
              {selectedSupplier ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-sm py-1 px-3">
                    {selectedSupplier.code} - {selectedSupplier.name}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedSupplier(null);
                      setSupplierSearch('');
                      setSelectedPOId('');
                      setPOOptions([]);
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search supplier by name or code..."
                    value={supplierSearch}
                    onChange={(e) => {
                      setSupplierSearch(e.target.value);
                      setSupplierDropdownOpen(true);
                    }}
                    onFocus={() => setSupplierDropdownOpen(true)}
                    className="pl-9"
                  />
                  {supplierDropdownOpen && supplierOptions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {supplierOptions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex justify-between"
                          onClick={() => {
                            setSelectedSupplier(s);
                            setSupplierSearch('');
                            setSupplierDropdownOpen(false);
                          }}
                        >
                          <span className="font-medium">{s.name}</span>
                          <span className="text-gray-500">{s.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* PO select (optional) */}
            {selectedSupplier && (
              <div className="space-y-1.5">
                <Label>Link to Purchase Order (optional)</Label>
                <Select value={selectedPOId || 'none'} onValueChange={(v) => setSelectedPOId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingPOs ? 'Loading POs...' : 'Select PO'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- No PO --</SelectItem>
                    {poOptions.map((po) => (
                      <SelectItem key={po.id} value={po.id}>
                        {po.poNumber} ({formatCurrency(po.totalAmount)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Reason */}
            <div className="space-y-1.5">
              <Label>Reason *</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as DebitNoteReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {DebitNoteReasonLabels[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line Items *</Label>
                <Button variant="outline" size="sm" className="gap-1" onClick={addLineItem}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Row
                </Button>
              </div>

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Description</TableHead>
                      <TableHead>HSN</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((li) => (
                      <TableRow key={li.key}>
                        <TableCell className="p-1.5">
                          <Input
                            value={li.description}
                            onChange={(e) => updateLineItem(li.key, 'description', e.target.value)}
                            placeholder="Item description"
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <Input
                            value={li.hsnCode}
                            onChange={(e) => updateLineItem(li.key, 'hsnCode', e.target.value)}
                            placeholder="HSN"
                            className="h-8 text-sm w-24"
                          />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <Input
                            type="number"
                            min={0}
                            value={li.quantity}
                            onChange={(e) => updateLineItem(li.key, 'quantity', parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm text-right w-20"
                          />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={li.unitPrice}
                            onChange={(e) => updateLineItem(li.key, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm text-right w-28"
                          />
                        </TableCell>
                        <TableCell className="p-1.5 text-right text-sm font-medium whitespace-nowrap">
                          {formatCurrency(li.quantity * li.unitPrice)}
                        </TableCell>
                        <TableCell className="p-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeLineItem(li.key)}
                            disabled={lineItems.length <= 1}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Line total */}
              <div className="flex justify-end">
                <div className="text-sm font-medium text-gray-700">Subtotal: {formatCurrency(lineTotal)}</div>
              </div>
            </div>

            {/* Remarks */}
            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional remarks..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                creating ||
                !selectedSupplier ||
                lineItems.every((li) => !li.description.trim() || li.quantity <= 0 || li.unitPrice <= 0)
              }
            >
              {creating ? 'Creating...' : 'Create Debit Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
