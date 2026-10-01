import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Link2Off,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { getTallyCreditNotes, pushCreditNoteToTally } from '@/services/tally.service';
import type { CreditNoteTallyStatus } from '@/types/tally.types';
import Pagination from '@/components/Pagination';
import SearchInput from '@/components/SearchInput';
import { FilterBar } from '@/components/filters';
import { formatCurrency } from '@/lib/currency';
import { formatDate, formatDateTime } from '@/lib/date';

export default function TallyCreditNotesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [pushStatus, setPushStatus] = useState<'all' | 'pushed' | 'not_pushed' | 'error'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPushing, setBulkPushing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['tally-credit-notes', { search, pushStatus, page, pageSize }],
    queryFn: () =>
      getTallyCreditNotes({
        search: search || undefined,
        pushStatus: pushStatus === 'all' ? undefined : pushStatus,
        page,
        limit: pageSize,
      }),
  });

  const activeFilterCount = [search, pushStatus !== 'all'].filter(Boolean).length;

  // Clears every filter and goes back to page 1; the rows-per-page choice is not a filter, so it stays
  const clearFilters = () => {
    setSearch('');
    setPushStatus('all');
    setPage(1);
    setSelectedIds(new Set());
  };

  const pushMutation = useMutation({
    mutationFn: pushCreditNoteToTally,
    onSuccess: (result) => {
      if (result.success) {
        handleApiSuccess('Pushed', `Credit note pushed to Tally (Voucher: ${result.voucherNumber})`);
      } else {
        handleApiError(new Error(result.error || 'Push failed'), 'Push failed');
      }
      queryClient.invalidateQueries({ queryKey: ['tally-credit-notes'] });
    },
    onError: (error) => handleApiError(error, 'Failed to push credit note'),
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked && data?.data) {
      const pushableIds = data.data.filter((cn) => cn.customerLinked && !cn.tallyPushedAt).map((cn) => cn.id);
      setSelectedIds(new Set(pushableIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkPush = async () => {
    if (selectedIds.size === 0) return;

    setBulkPushing(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      try {
        const result = await pushCreditNoteToTally(id);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setBulkPushing(false);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['tally-credit-notes'] });

    if (successCount > 0 && failCount === 0) {
      handleApiSuccess('Bulk push complete', `Successfully pushed ${successCount} credit note(s) to Tally`);
    } else if (successCount > 0 && failCount > 0) {
      handleApiSuccess(
        'Bulk push partial',
        `Pushed ${successCount} credit note(s), ${failCount} failed. Check error status.`
      );
    } else {
      handleApiError(new Error(`All ${failCount} credit note(s) failed`), 'Bulk push failed');
    }
  };

  const getStatusIcon = (creditNote: CreditNoteTallyStatus) => {
    if (creditNote.tallyPushedAt) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (creditNote.tallyLastError) {
      return <XCircle className="h-4 w-4 text-red-600" />;
    }
    if (!creditNote.customerLinked) {
      return <Link2Off className="h-4 w-4 text-orange-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = (creditNote: CreditNoteTallyStatus) => {
    if (creditNote.tallyPushedAt) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          Pushed
        </Badge>
      );
    }
    if (creditNote.tallyLastError) {
      return (
        <Badge variant="destructive" className="bg-red-100 text-red-800">
          Error
        </Badge>
      );
    }
    if (!creditNote.customerLinked) {
      return (
        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
          Customer Not Linked
        </Badge>
      );
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const stats = {
    total: pagination.total,
    pushable: data?.data.filter((cn) => cn.customerLinked && !cn.tallyPushedAt).length || 0,
    selected: selectedIds.size,
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-display font-medium text-foreground">Credit Note Push to Tally</h1>
        <p className="text-muted-foreground mt-1">Manage and push credit notes (sales returns) to Tally ERP</p>
      </div>

      {/* Quick Links */}
      <div className="flex gap-2 mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings/tally">Tally Settings</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings/tally/customers">Customer Matching</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings/tally/invoices">Invoice Push</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Credit Notes
              </CardTitle>
              <CardDescription>
                {stats.total} total • {stats.pushable} ready to push
                {stats.selected > 0 && ` • ${stats.selected} selected`}
              </CardDescription>
            </div>
            {selectedIds.size > 0 && (
              <Button onClick={handleBulkPush} disabled={bulkPushing} className="gap-2">
                {bulkPushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Push {selectedIds.size} Selected
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <FilterBar
            className="mb-4"
            onClear={clearFilters}
            hasActiveFilters={activeFilterCount > 0}
            clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
          >
            <SearchInput
              className="min-w-[220px] flex-1"
              placeholder="Search credit note, invoice number, customer…"
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
            />
            <Select
              value={pushStatus}
              onValueChange={(v) => {
                setPushStatus(v as typeof pushStatus);
                setPage(1);
                setSelectedIds(new Set());
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="not_pushed">Not pushed</SelectItem>
                <SelectItem value="pushed">Pushed</SelectItem>
                <SelectItem value="error">With errors</SelectItem>
              </SelectContent>
            </Select>
          </FilterBar>

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
                            data?.data &&
                            data.data.filter((cn) => cn.customerLinked && !cn.tallyPushedAt).length > 0 &&
                            data.data
                              .filter((cn) => cn.customerLinked && !cn.tallyPushedAt)
                              .every((cn) => selectedIds.has(cn.id))
                          }
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Credit Note</TableHead>
                      <TableHead>Against Invoice</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pushed</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          {activeFilterCount > 0 ? (
                            <div className="flex flex-col items-center gap-3">
                              <span>No credit notes match these filters.</span>
                              <Button variant="outline" size="sm" onClick={clearFilters}>
                                Clear filters
                              </Button>
                            </div>
                          ) : (
                            'No credit notes found'
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.data.map((creditNote) => {
                        const canPush = creditNote.customerLinked && !creditNote.tallyPushedAt;
                        const canSelect = creditNote.customerLinked && !creditNote.tallyPushedAt;

                        return (
                          <TableRow key={creditNote.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(creditNote.id)}
                                onCheckedChange={(checked) => handleSelectOne(creditNote.id, !!checked)}
                                disabled={!canSelect}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(creditNote)}
                                <div>
                                  <Link
                                    to={`/financial/credit-notes/${creditNote.id}`}
                                    className="font-medium hover:underline"
                                  >
                                    {creditNote.creditNoteNumber}
                                  </Link>
                                  <div className="text-sm text-muted-foreground">
                                    {formatDate(creditNote.creditNoteDate)}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-mono">{creditNote.invoiceNumber}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {creditNote.customerName}
                                {!creditNote.customerLinked && (
                                  <span title="Customer not linked to Tally">
                                    <AlertCircle className="h-3 w-3 text-orange-500" />
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium text-red-600">
                              -{formatCurrency(creditNote.totalAmount)}
                            </TableCell>
                            <TableCell>{getStatusBadge(creditNote)}</TableCell>
                            <TableCell>
                              {creditNote.tallyPushedAt ? (
                                <span className="text-sm text-muted-foreground">
                                  {formatDateTime(creditNote.tallyPushedAt)}
                                </span>
                              ) : creditNote.tallyLastError ? (
                                <span
                                  className="text-sm text-red-600 truncate max-w-[150px] block"
                                  title={creditNote.tallyLastError}
                                >
                                  {creditNote.tallyLastError.slice(0, 30)}...
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {canPush && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => pushMutation.mutate(creditNote.id)}
                                    disabled={pushMutation.isPending}
                                  >
                                    <Upload className="h-4 w-4" />
                                  </Button>
                                )}
                                {creditNote.tallyPushedAt && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => pushMutation.mutate(creditNote.id)}
                                    disabled={pushMutation.isPending}
                                    title="Re-push to Tally"
                                  >
                                    <Upload className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" asChild>
                                  <Link to={`/financial/credit-notes/${creditNote.id}`}>
                                    <ExternalLink className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
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
                itemLabel="credit notes"
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
