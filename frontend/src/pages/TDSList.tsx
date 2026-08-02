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
import { getTDSEntries, createTDS, updateTDSStatus, deleteTDS } from '@/services/tds.service';
import type { TDSEntry, CreateTDSRequest, TDSStatus } from '@/types/tds.types';
import { TDS_STATUS_LABELS, TDS_STATUS_COLORS, TDS_SECTIONS } from '@/types/tds.types';

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
    maximumFractionDigits: 2,
  });
}

function getFinancialYear(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  // FY starts April (month 3)
  if (month >= 3) {
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return `${year - 1}-${String(year).slice(2)}`;
}

function getQuarter(dateStr: string): number {
  const month = new Date(dateStr).getMonth(); // 0-indexed
  // Q1: Apr-Jun(3-5), Q2: Jul-Sep(6-8), Q3: Oct-Dec(9-11), Q4: Jan-Mar(0-2)
  if (month >= 3 && month <= 5) return 1;
  if (month >= 6 && month <= 8) return 2;
  if (month >= 9 && month <= 11) return 3;
  return 4;
}

const EMPTY_FORM: CreateTDSRequest = {
  deductorName: '',
  deducteeName: '',
  tdsSection: '',
  tdsRate: 0,
  grossAmount: 0,
  tdsAmount: 0,
  netAmount: 0,
  certificateNo: '',
  deductionDate: new Date().toISOString().split('T')[0],
  financialYear: getFinancialYear(new Date().toISOString()),
  quarter: getQuarter(new Date().toISOString()),
  remarks: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TDSList() {
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
  const [entryToDelete, setEntryToDelete] = useState<TDSEntry | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateTDSRequest>({ ...EMPTY_FORM });

  // ---------- Queries ----------

  const { data, isLoading } = useQuery({
    queryKey: ['tds-entries', { page, search, financialYear, quarter: quarterFilter, status: statusFilter }],
    queryFn: () =>
      getTDSEntries({
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
    mutationFn: createTDS,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tds-entries'] });
      toast.success('TDS entry recorded successfully');
      closeDialog();
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Failed to create TDS entry');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, certificateNo }: { id: string; status: string; certificateNo?: string }) =>
      updateTDSStatus(id, status, certificateNo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tds-entries'] });
      toast.success('TDS status updated');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Failed to update status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTDS,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tds-entries'] });
      toast.success('TDS entry deleted');
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Failed to delete TDS entry');
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
    const section = TDS_SECTIONS.find((s) => s.code === sectionCode);
    if (!section) {
      toast.error(`Invalid TDS section code: ${sectionCode}`);
      return;
    }
    const tdsAmount = (formData.grossAmount * section.rate) / 100;
    setFormData((prev) => ({
      ...prev,
      tdsSection: sectionCode,
      tdsRate: section.rate,
      tdsAmount: Math.round(tdsAmount * 100) / 100,
      netAmount: Math.round((prev.grossAmount - tdsAmount) * 100) / 100,
    }));
  }

  function handleGrossAmountChange(value: number) {
    const tdsAmount = (value * formData.tdsRate) / 100;
    setFormData((prev) => ({
      ...prev,
      grossAmount: value,
      tdsAmount: Math.round(tdsAmount * 100) / 100,
      netAmount: Math.round((value - tdsAmount) * 100) / 100,
    }));
  }

  function handleDateChange(dateStr: string) {
    setFormData((prev) => ({
      ...prev,
      deductionDate: dateStr,
      financialYear: dateStr ? getFinancialYear(dateStr) : prev.financialYear,
      quarter: dateStr ? getQuarter(dateStr) : prev.quarter,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.deductorName || !formData.deducteeName || !formData.tdsSection) {
      toast.error('Deductor name, deductee name, and TDS section are required');
      return;
    }
    if (formData.grossAmount <= 0) {
      toast.error('Gross amount must be greater than zero');
      return;
    }

    const submitData: CreateTDSRequest = {
      ...formData,
      certificateNo: formData.certificateNo || undefined,
      remarks: formData.remarks || undefined,
      invoiceId: formData.invoiceId || undefined,
      paymentId: formData.paymentId || undefined,
    };

    createMutation.mutate(submitData);
  }

  function handleStatusChange(entry: TDSEntry, newStatus: TDSStatus) {
    if (newStatus === 'CERTIFICATE_RECEIVED') {
      const certNo = window.prompt('Enter Certificate Number:');
      if (certNo === null) return; // cancelled
      statusMutation.mutate({ id: entry.id, status: newStatus, certificateNo: certNo || undefined });
    } else {
      statusMutation.mutate({ id: entry.id, status: newStatus });
    }
  }

  // ---------- Computed ----------

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entries = data?.data || [];
  const pagination = data?.pagination;

  const summary = useMemo(() => {
    const totalEntries = pagination?.total ?? entries.length;
    const totalGross = entries.reduce((sum, e) => sum + Number(e.grossAmount), 0);
    const totalTDS = entries.reduce((sum, e) => sum + Number(e.tdsAmount), 0);
    const totalNet = entries.reduce((sum, e) => sum + Number(e.netAmount), 0);
    return { totalEntries, totalGross, totalTDS, totalNet };
  }, [entries, pagination]);

  const isSubmitting = createMutation.isPending;

  // ---------- Render ----------

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-medium tracking-tight">TDS Tracking</h1>
          <p className="text-muted-foreground text-sm">
            Tax Deducted at Source - Track deductions, certificates, and quarterly returns
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Record TDS
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Gross</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAmount(summary.totalGross)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total TDS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatAmount(summary.totalTDS)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Net</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatAmount(summary.totalNet)}</div>
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
                placeholder="Search deductor/deductee..."
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
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="CERTIFICATE_RECEIVED">Certificate Received</SelectItem>
                <SelectItem value="VERIFIED">Verified</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Deductor</TableHead>
                <TableHead>Section</TableHead>
                <TableHead className="text-right">Rate %</TableHead>
                <TableHead className="text-right">Gross Amount</TableHead>
                <TableHead className="text-right">TDS Amount</TableHead>
                <TableHead className="text-right">Net Amount</TableHead>
                <TableHead>Certificate No</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2" />
                      Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    <FileText className="mx-auto h-10 w-10 mb-3 opacity-50" />
                    <p>No TDS entries found</p>
                    <Button variant="outline" className="mt-3" onClick={openCreateDialog}>
                      <Plus className="mr-2 h-4 w-4" />
                      Record your first TDS entry
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(entry.deductionDate)}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{entry.deductorName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.tdsSection}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{Number(entry.tdsRate)}%</TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(entry.grossAmount).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-right font-mono text-destructive">
                      {Number(entry.tdsAmount).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(entry.netAmount).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{entry.certificateNo || '-'}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer ${
                              TDS_STATUS_COLORS[entry.status]
                            }`}
                          >
                            {TDS_STATUS_LABELS[entry.status]}
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {entry.status !== 'PENDING' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(entry, 'PENDING')}>
                              Pending
                            </DropdownMenuItem>
                          )}
                          {entry.status !== 'CERTIFICATE_RECEIVED' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(entry, 'CERTIFICATE_RECEIVED')}>
                              Certificate Received
                            </DropdownMenuItem>
                          )}
                          {entry.status !== 'VERIFIED' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(entry, 'VERIFIED')}>
                              Verified
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

      {/* Create TDS Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record TDS Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deductorName">Deductor Name *</Label>
                <Input
                  id="deductorName"
                  placeholder="Party who deducted tax"
                  value={formData.deductorName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, deductorName: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deducteeName">Deductee Name *</Label>
                <Input
                  id="deducteeName"
                  placeholder="Your company name"
                  value={formData.deducteeName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, deducteeName: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tdsSection">TDS Section *</Label>
                <Select value={formData.tdsSection} onValueChange={handleSectionChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {TDS_SECTIONS.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.code} - {s.description} ({s.rate}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tdsRate">TDS Rate %</Label>
                <Input
                  id="tdsRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.tdsRate}
                  onChange={(e) => {
                    const rate = parseFloat(e.target.value) || 0;
                    const tdsAmount = (formData.grossAmount * rate) / 100;
                    setFormData((prev) => ({
                      ...prev,
                      tdsRate: rate,
                      tdsAmount: Math.round(tdsAmount * 100) / 100,
                      netAmount: Math.round((prev.grossAmount - tdsAmount) * 100) / 100,
                    }));
                  }}
                  readOnly
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="grossAmount">Gross Amount *</Label>
                <Input
                  id="grossAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.grossAmount || ''}
                  onChange={(e) => handleGrossAmountChange(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tdsAmount">TDS Amount</Label>
                <Input
                  id="tdsAmount"
                  type="number"
                  step="0.01"
                  value={formData.tdsAmount}
                  readOnly
                  className="bg-muted font-medium text-destructive"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="netAmount">Net Amount</Label>
                <Input
                  id="netAmount"
                  type="number"
                  step="0.01"
                  value={formData.netAmount}
                  readOnly
                  className="bg-muted font-medium text-success"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deductionDate">Deduction Date *</Label>
                <Input
                  id="deductionDate"
                  type="date"
                  value={formData.deductionDate}
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
              <Label htmlFor="certificateNo">Certificate No (optional)</Label>
              <Input
                id="certificateNo"
                placeholder="TDS certificate number"
                value={formData.certificateNo || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, certificateNo: e.target.value }))}
              />
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
                {isSubmitting ? 'Saving...' : 'Record TDS'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete TDS Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the TDS entry for <strong>{entryToDelete?.deductorName}</strong> (Section{' '}
              {entryToDelete?.tdsSection}, {formatAmount(Number(entryToDelete?.tdsAmount ?? 0))})? This action cannot be
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
