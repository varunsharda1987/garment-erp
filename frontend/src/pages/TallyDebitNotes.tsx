import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2,
  Search,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Link2Off,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { getTallyDebitNotes, pushDebitNoteToTally } from '@/services/tally.service';
import type { DebitNoteTallyStatus } from '@/types/tally.types';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency } from '@/lib/currency';

export default function TallyDebitNotesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [pushStatus, setPushStatus] = useState<'all' | 'pushed' | 'not_pushed' | 'error'>('all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPushing, setBulkPushing] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['tally-debit-notes', { search: debouncedSearch, pushStatus, page }],
    queryFn: () =>
      getTallyDebitNotes({
        search: debouncedSearch || undefined,
        pushStatus: pushStatus === 'all' ? undefined : pushStatus,
        page,
        limit: 20,
      }),
  });

  const pushMutation = useMutation({
    mutationFn: pushDebitNoteToTally,
    onSuccess: (result) => {
      if (result.success) {
        handleApiSuccess('Pushed', `Debit note pushed to Tally (Voucher: ${result.voucherNumber})`);
      } else {
        handleApiError(new Error(result.error || 'Push failed'), 'Push failed');
      }
      queryClient.invalidateQueries({ queryKey: ['tally-debit-notes'] });
    },
    onError: (error) => handleApiError(error, 'Failed to push debit note'),
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked && data?.data) {
      const pushableIds = data.data.filter((dn) => dn.supplierLinked && !dn.tallyPushedAt).map((dn) => dn.id);
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
        const result = await pushDebitNoteToTally(id);
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
    queryClient.invalidateQueries({ queryKey: ['tally-debit-notes'] });

    if (successCount > 0 && failCount === 0) {
      handleApiSuccess('Bulk push complete', `Successfully pushed ${successCount} debit note(s) to Tally`);
    } else if (successCount > 0 && failCount > 0) {
      handleApiSuccess(
        'Bulk push partial',
        `Pushed ${successCount} debit note(s), ${failCount} failed. Check error status.`
      );
    } else {
      handleApiError(new Error(`All ${failCount} debit note(s) failed`), 'Bulk push failed');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (debitNote: DebitNoteTallyStatus) => {
    if (debitNote.tallyPushedAt) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (debitNote.tallyLastError) {
      return <XCircle className="h-4 w-4 text-red-600" />;
    }
    if (!debitNote.supplierLinked) {
      return <Link2Off className="h-4 w-4 text-orange-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = (debitNote: DebitNoteTallyStatus) => {
    if (debitNote.tallyPushedAt) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          Pushed
        </Badge>
      );
    }
    if (debitNote.tallyLastError) {
      return (
        <Badge variant="destructive" className="bg-red-100 text-red-800">
          Error
        </Badge>
      );
    }
    if (!debitNote.supplierLinked) {
      return (
        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
          Supplier Not Linked
        </Badge>
      );
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const stats = {
    total: pagination.total,
    pushable: data?.data.filter((dn) => dn.supplierLinked && !dn.tallyPushedAt).length || 0,
    selected: selectedIds.size,
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-medium text-foreground">Debit Note Push to Tally</h1>
        <p className="text-muted-foreground mt-1">Manage and push debit notes (supplier returns) to Tally ERP</p>
      </div>

      {/* Quick Links */}
      <div className="flex gap-2 mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings/tally">Tally Settings</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings/tally/suppliers">Supplier Matching</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Debit Notes
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
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search debit notes, POs, suppliers..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={pushStatus}
              onValueChange={(v) => {
                setPushStatus(v as typeof pushStatus);
                setPage(1);
                setSelectedIds(new Set());
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Debit Notes</SelectItem>
                <SelectItem value="not_pushed">Not Pushed</SelectItem>
                <SelectItem value="pushed">Pushed</SelectItem>
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
                            data?.data &&
                            data.data.filter((dn) => dn.supplierLinked && !dn.tallyPushedAt).length > 0 &&
                            data.data
                              .filter((dn) => dn.supplierLinked && !dn.tallyPushedAt)
                              .every((dn) => selectedIds.has(dn.id))
                          }
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Debit Note</TableHead>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Supplier</TableHead>
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
                          No debit notes found
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.data.map((debitNote) => {
                        const canPush = debitNote.supplierLinked && !debitNote.tallyPushedAt;
                        const canSelect = debitNote.supplierLinked && !debitNote.tallyPushedAt;

                        return (
                          <TableRow key={debitNote.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(debitNote.id)}
                                onCheckedChange={(checked) => handleSelectOne(debitNote.id, !!checked)}
                                disabled={!canSelect}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(debitNote)}
                                <div>
                                  <div className="font-medium">{debitNote.debitNoteNumber}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {formatDate(debitNote.debitNoteDate)}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {debitNote.poNumber ? (
                                <span className="text-sm font-mono">{debitNote.poNumber}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {debitNote.supplierName}
                                {!debitNote.supplierLinked && (
                                  <span title="Supplier not linked to Tally">
                                    <AlertCircle className="h-3 w-3 text-orange-500" />
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(debitNote.totalAmount)}
                            </TableCell>
                            <TableCell>{getStatusBadge(debitNote)}</TableCell>
                            <TableCell>
                              {debitNote.tallyPushedAt ? (
                                <span className="text-sm text-muted-foreground">
                                  {formatDateTime(debitNote.tallyPushedAt)}
                                </span>
                              ) : debitNote.tallyLastError ? (
                                <span
                                  className="text-sm text-red-600 truncate max-w-[150px] block"
                                  title={debitNote.tallyLastError}
                                >
                                  {debitNote.tallyLastError.slice(0, 30)}...
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
                                    onClick={() => pushMutation.mutate(debitNote.id)}
                                    disabled={pushMutation.isPending}
                                  >
                                    <Upload className="h-4 w-4" />
                                  </Button>
                                )}
                                {debitNote.tallyPushedAt && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => pushMutation.mutate(debitNote.id)}
                                    disabled={pushMutation.isPending}
                                    title="Re-push to Tally"
                                  >
                                    <Upload className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" asChild>
                                  <Link to={`/financial/debit-notes/${debitNote.id}`}>
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
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} debit notes)
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
    </div>
  );
}
