import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Search, FileText, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getTCSEntries, createTCS, updateTCSStatus, deleteTCS } from '@/services/tcs.service';
import type { TCSEntry, CreateTCSRequest, TCSStatus } from '@/types/tcs.types';
import { TCS_STATUS_LABELS, TCS_STATUS_COLORS, TCS_SECTIONS } from '@/types/tcs.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FINANCIAL_YEARS = ['2025-26', '2024-25', '2023-24'];

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  });
}

function getFinancialYear(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  if (month >= 3) {
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return `${year - 1}-${String(year).slice(2)}`;
}

function getQuarter(dateStr: string): number {
  const month = new Date(dateStr).getMonth();
  if (month >= 3 && month <= 5) return 1;
  if (month >= 6 && month <= 8) return 2;
  if (month >= 9 && month <= 11) return 3;
  return 4;
}

const EMPTY_FORM: CreateTCSRequest = {
  customerName: '',
  tcsSection: '',
  tcsRate: 0,
  saleAmount: 0,
  tcsAmount: 0,
  collectionDate: new Date().toISOString().split('T')[0],
  financialYear: getFinancialYear(new Date().toISOString()),
  quarter: getQuarter(new Date().toISOString()),
  remarks: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TCSList() {
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [financialYear, setFinancialYear] = useState(FINANCIAL_YEARS[0]);
  const [quarterFilter, setQuarterFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<TCSEntry | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateTCSRequest>({ ...EMPTY_FORM });

  // ---------- Queries ----------

  const { data, isLoading } = useQuery({
    queryKey: ['tcs-entries', { page, search, financialYear, quarter: quarterFilter, status: statusFilter }],
    queryFn: () =>
      getTCSEntries({
        page,
        limit: 20,
        search: search || undefined,
        financialYear: financialYear || undefined,
        quarter: quarterFilter !== 'all' ? Number(quarterFilter) : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      }),
  });

  // ---------- Mutations ----------

  const createMutation = useMutation({
    mutationFn: createTCS,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tcs-entries'] });
      toast.success('TCS entry recorded successfully');
      closeDialog();
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Failed to create TCS entry');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateTCSStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tcs-entries'] });
      toast.success('TCS status updated');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Failed to update status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTCS,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tcs-entries'] });
      toast.success('TCS entry deleted');
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Failed to delete TCS entry');
    },
  });

  // ---------- Form handlers ----------

  function openCreateDialog() {
    setFormData({ ...EMPTY_FORM });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
  }

  function handleSectionChange(sectionCode: string) {
    const section = TCS_SECTIONS.find((s) => s.code === sectionCode);
    if (!section) {
      toast.error(`Invalid TCS section code: ${sectionCode}`);
      return;
    }
    const tcsAmount = (formData.saleAmount * section.rate) / 100;
    setFormData((prev) => ({
      ...prev,
      tcsSection: sectionCode,
      tcsRate: section.rate,
      tcsAmount: Math.round(tcsAmount * 100) / 100,
    }));
  }

  function handleSaleAmountChange(value: number) {
    const tcsAmount = (value * formData.tcsRate) / 100;
    setFormData((prev) => ({
      ...prev,
      saleAmount: value,
      tcsAmount: Math.round(tcsAmount * 100) / 100,
    }));
  }

  function handleDateChange(dateStr: string) {
    setFormData((prev) => ({
      ...prev,
      collectionDate: dateStr,
      financialYear: dateStr ? getFinancialYear(dateStr) : prev.financialYear,
      quarter: dateStr ? getQuarter(dateStr) : prev.quarter,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.customerName || !formData.tcsSection) {
      toast.error('Customer name and TCS section are required');
      return;
    }
    if (formData.saleAmount <= 0) {
      toast.error('Sale amount must be greater than zero');
      return;
    }

    const submitData: CreateTCSRequest = {
      ...formData,
      remarks: formData.remarks || undefined,
      invoiceId: formData.invoiceId || undefined,
    };

    createMutation.mutate(submitData);
  }

  function handleStatusChange(entry: TCSEntry, newStatus: TCSStatus) {
    statusMutation.mutate({ id: entry.id, status: newStatus });
  }

  // ---------- Computed ----------

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entries = data?.data || [];
  const pagination = data?.pagination;

  const summary = useMemo(() => {
    const totalEntries = pagination?.total ?? entries.length;
    const totalSaleAmount = entries.reduce((sum, e) => sum + Number(e.saleAmount), 0);
    const totalTCS = entries.reduce((sum, e) => sum + Number(e.tcsAmount), 0);
    return { totalEntries, totalSaleAmount, totalTCS };
  }, [entries, pagination]);

  const isSubmitting = createMutation.isPending;

  // ---------- Render ----------

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">TCS Tracking</h1>
          <p className="text-muted-foreground text-sm">
            Tax Collected at Source - Track collections and quarterly deposits
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Record TCS
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalEntries}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sale Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAmount(summary.totalSaleAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total TCS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatAmount(summary.totalTCS)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customer..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={financialYear}
              onValueChange={(val) => {
                setFinancialYear(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="FY" />
              </SelectTrigger>
              <SelectContent>
                {FINANCIAL_YEARS.map((fy) => (
                  <SelectItem key={fy} value={fy}>
                    FY {fy}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={quarterFilter}
              onValueChange={(val) => {
                setQuarterFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Quarter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Quarters</SelectItem>
                <SelectItem value="1">Q1 (Apr-Jun)</SelectItem>
                <SelectItem value="2">Q2 (Jul-Sep)</SelectItem>
                <SelectItem value="3">Q3 (Oct-Dec)</SelectItem>
                <SelectItem value="4">Q4 (Jan-Mar)</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="DEPOSITED">Deposited</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Section</TableHead>
                <TableHead className="text-right">Rate %</TableHead>
                <TableHead className="text-right">Sale Amount</TableHead>
                <TableHead className="text-right">TCS Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2" />
                      Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <FileText className="mx-auto h-10 w-10 mb-3 opacity-50" />
                    <p>No TCS entries found</p>
                    <Button variant="outline" className="mt-3" onClick={openCreateDialog}>
                      <Plus className="mr-2 h-4 w-4" />
                      Record your first TCS entry
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(entry.collectionDate)}</TableCell>
                    <TableCell className="font-medium max-w-[250px] truncate">{entry.customerName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.tcsSection}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{Number(entry.tcsRate)}%</TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(entry.saleAmount).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-right font-mono text-blue-600">
                      {Number(entry.tcsAmount).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer ${
                              TCS_STATUS_COLORS[entry.status]
                            }`}
                          >
                            {TCS_STATUS_LABELS[entry.status]}
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {entry.status !== 'PENDING' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(entry, 'PENDING')}>
                              Pending
                            </DropdownMenuItem>
                          )}
                          {entry.status !== 'DEPOSITED' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(entry, 'DEPOSITED')}>
                              Deposited
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEntryToDelete(entry);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} entries)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
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
        </CardContent>
      </Card>

      {/* Create TCS Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record TCS Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name *</Label>
              <Input
                id="customerName"
                placeholder="Customer name"
                value={formData.customerName}
                onChange={(e) => setFormData((prev) => ({ ...prev, customerName: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tcsSection">TCS Section *</Label>
                <Select value={formData.tcsSection} onValueChange={handleSectionChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {TCS_SECTIONS.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.code} - {s.description} ({s.rate}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tcsRate">TCS Rate %</Label>
                <Input
                  id="tcsRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.tcsRate}
                  readOnly
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="saleAmount">Sale Amount *</Label>
                <Input
                  id="saleAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.saleAmount || ''}
                  onChange={(e) => handleSaleAmountChange(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tcsAmount">TCS Amount</Label>
                <Input
                  id="tcsAmount"
                  type="number"
                  step="0.01"
                  value={formData.tcsAmount}
                  readOnly
                  className="bg-muted font-medium text-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="collectionDate">Collection Date *</Label>
                <Input
                  id="collectionDate"
                  type="date"
                  value={formData.collectionDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="financialYear">Financial Year</Label>
                <Input id="financialYear" value={formData.financialYear} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quarter">Quarter</Label>
                <Input id="quarter" value={`Q${formData.quarter}`} readOnly className="bg-muted" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks (optional)</Label>
              <Textarea
                id="remarks"
                placeholder="Any additional notes..."
                value={formData.remarks || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Record TCS'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete TCS Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the TCS entry for <strong>{entryToDelete?.customerName}</strong> (Section{' '}
              {entryToDelete?.tcsSection}, {formatAmount(Number(entryToDelete?.tcsAmount ?? 0))})? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => entryToDelete && deleteMutation.mutate(entryToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
