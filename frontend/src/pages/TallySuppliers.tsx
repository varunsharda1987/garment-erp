import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  Search,
  Link2,
  Link2Off,
  CheckCircle,
  XCircle,
  Wand2,
  ChevronLeft,
  ChevronRight,
  Download,
  ArrowRight,
} from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import {
  getTallySuppliers,
  getTallyLedgers,
  linkSupplierToTally,
  unlinkSupplierFromTally,
  autoMatchTallySuppliers,
  previewSupplierSyncFromTally,
  syncSupplierDetailsFromTally,
  type SupplierSyncPreviewResult,
} from '@/services/tally.service';
import type { SupplierTallyMatch } from '@/types/tally.types';
import { useDebounce } from '@/hooks/useDebounce';

export default function TallySuppliersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [matchStatus, setMatchStatus] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [page, setPage] = useState(1);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierTallyMatch | null>(null);
  const [selectedLedger, setSelectedLedger] = useState('');

  // Sync dialog state
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncPreview, setSyncPreview] = useState<SupplierSyncPreviewResult | null>(null);
  const [syncOnlyBlanks, setSyncOnlyBlanks] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['tally-suppliers', { search: debouncedSearch, matchStatus, page }],
    queryFn: () =>
      getTallySuppliers({
        search: debouncedSearch || undefined,
        matchStatus: matchStatus === 'all' ? undefined : matchStatus,
        page,
        limit: 20,
        suggestions: true,
      }),
  });

  const ledgersQuery = useQuery({
    queryKey: ['tally-ledgers'],
    queryFn: getTallyLedgers,
    enabled: linkDialogOpen,
  });

  // Show all ledgers - let user pick the right one
  const creditorLedgers = ledgersQuery.data || [];

  const linkMutation = useMutation({
    mutationFn: ({ supplierId, ledgerName }: { supplierId: string; ledgerName: string }) =>
      linkSupplierToTally(supplierId, ledgerName),
    onSuccess: () => {
      handleApiSuccess('Linked', 'Supplier linked to Tally ledger');
      queryClient.invalidateQueries({ queryKey: ['tally-suppliers'] });
      setLinkDialogOpen(false);
      setSelectedSupplier(null);
      setSelectedLedger('');
    },
    onError: (error) => handleApiError(error, 'Failed to link supplier'),
  });

  const unlinkMutation = useMutation({
    mutationFn: unlinkSupplierFromTally,
    onSuccess: () => {
      handleApiSuccess('Unlinked', 'Supplier unlinked from Tally ledger');
      queryClient.invalidateQueries({ queryKey: ['tally-suppliers'] });
    },
    onError: (error) => handleApiError(error, 'Failed to unlink supplier'),
  });

  const autoMatchMutation = useMutation({
    mutationFn: autoMatchTallySuppliers,
    onSuccess: (result) => {
      handleApiSuccess('Auto-match complete', `Matched ${result.matched} of ${result.total} suppliers`);
      queryClient.invalidateQueries({ queryKey: ['tally-suppliers'] });
    },
    onError: (error) => handleApiError(error, 'Auto-match failed'),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncSupplierDetailsFromTally(syncOnlyBlanks),
    onSuccess: (result) => {
      handleApiSuccess('Sync complete', `Updated ${result.updated} suppliers from Tally`);
      setSyncDialogOpen(false);
      setSyncPreview(null);
      queryClient.invalidateQueries({ queryKey: ['tally-suppliers'] });
    },
    onError: (error) => handleApiError(error, 'Sync failed'),
  });

  const openSyncDialog = async () => {
    setSyncDialogOpen(true);
    setLoadingPreview(true);
    try {
      const preview = await previewSupplierSyncFromTally(syncOnlyBlanks);
      setSyncPreview(preview);
    } catch (error) {
      handleApiError(error, 'Failed to load preview');
      setSyncDialogOpen(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const refreshPreview = async () => {
    setLoadingPreview(true);
    try {
      const preview = await previewSupplierSyncFromTally(syncOnlyBlanks);
      setSyncPreview(preview);
    } catch (error) {
      handleApiError(error, 'Failed to load preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const openLinkDialog = (supplier: SupplierTallyMatch) => {
    setSelectedSupplier(supplier);
    setSelectedLedger(supplier.suggestion || '');
    setLinkDialogOpen(true);
  };

  const handleLink = () => {
    if (selectedSupplier && selectedLedger) {
      linkMutation.mutate({ supplierId: selectedSupplier.id, ledgerName: selectedLedger });
    }
  };

  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };
  const stats = data?.stats || { total: 0, matched: 0, unmatched: 0 };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-medium text-foreground">Supplier-Ledger Matching</h1>
        <p className="text-muted-foreground mt-1">Link ERP suppliers to Tally creditor ledgers for debit note sync</p>
      </div>

      {/* Quick Links */}
      <div className="flex gap-2 mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings/tally">Tally Settings</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings/tally/debit-notes">Debit Note Push</Link>
        </Button>
        <Button variant="default" size="sm" onClick={openSyncDialog} className="gap-2 ml-auto">
          <Download className="h-4 w-4" />
          Sync Details from Tally
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Suppliers</div>
          <div className="text-2xl font-semibold">{stats.total}</div>
        </Card>
        <Card className="p-4 bg-green-50">
          <div className="text-sm text-green-700">Linked</div>
          <div className="text-2xl font-semibold text-green-700">{stats.matched}</div>
        </Card>
        <Card className="p-4 bg-orange-50">
          <div className="text-sm text-orange-700">Not Linked</div>
          <div className="text-2xl font-semibold text-orange-700">{stats.unmatched}</div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Suppliers</CardTitle>
              <CardDescription>Match suppliers to Tally creditor ledgers</CardDescription>
            </div>
            <Button onClick={() => autoMatchMutation.mutate()} disabled={autoMatchMutation.isPending} className="gap-2">
              {autoMatchMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Auto-Match
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search suppliers..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={matchStatus}
              onValueChange={(v) => {
                setMatchStatus(v as typeof matchStatus);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                <SelectItem value="matched">Linked</SelectItem>
                <SelectItem value="unmatched">Not Linked</SelectItem>
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
                      <TableHead>Supplier</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Tally Ledger</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No suppliers found
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.data.map((supplier) => (
                        <TableRow key={supplier.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{supplier.name}</div>
                              <div className="text-sm text-muted-foreground">{supplier.code}</div>
                            </div>
                          </TableCell>
                          <TableCell>{supplier.phone || '-'}</TableCell>
                          <TableCell>
                            {supplier.tallyLedgerName ? (
                              <span className="font-mono text-sm">{supplier.tallyLedgerName}</span>
                            ) : supplier.suggestion ? (
                              <span className="text-sm text-muted-foreground italic">
                                Suggestion: {supplier.suggestion}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {supplier.tallyMatched ? (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Linked
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                                <XCircle className="h-3 w-3 mr-1" />
                                Not Linked
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {supplier.tallyMatched ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => unlinkMutation.mutate(supplier.id)}
                                disabled={unlinkMutation.isPending}
                              >
                                <Link2Off className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => openLinkDialog(supplier)}>
                                <Link2 className="h-4 w-4" />
                              </Button>
                            )}
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
                    Page {pagination.page} of {pagination.totalPages}
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

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Supplier to Tally Ledger</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Supplier</label>
              <p className="text-muted-foreground">{selectedSupplier?.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Tally Ledger</label>
              {ledgersQuery.isLoading ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading ledgers from Tally...</span>
                </div>
              ) : ledgersQuery.isError ? (
                <div className="flex items-center gap-2 py-2 text-red-600">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm">Failed to connect to Tally. Make sure Tally is running.</span>
                </div>
              ) : creditorLedgers.length === 0 ? (
                <div className="flex items-center gap-2 py-2 text-orange-600">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm">
                    No supplier ledgers found. Total ledgers: {ledgersQuery.data?.length || 0}
                  </span>
                </div>
              ) : (
                <Select value={selectedLedger} onValueChange={setSelectedLedger}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a creditor ledger" />
                  </SelectTrigger>
                  <SelectContent>
                    {creditorLedgers.map((ledger) => (
                      <SelectItem key={ledger.name} value={ledger.name}>
                        {ledger.name} <span className="text-muted-foreground text-xs ml-2">({ledger.parent})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLink} disabled={!selectedLedger || linkMutation.isPending}>
              {linkMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync from Tally Dialog */}
      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Sync Supplier Details from Tally</DialogTitle>
            <DialogDescription>
              Pull GST, bank details, address, and other information from Tally into the ERP supplier master.
            </DialogDescription>
          </DialogHeader>

          {loadingPreview ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">Fetching data from Tally...</p>
            </div>
          ) : syncPreview ? (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-semibold">{syncPreview.stats.totalLinked}</div>
                  <div className="text-sm text-muted-foreground">Linked Suppliers</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-semibold">{syncPreview.stats.foundInTally}</div>
                  <div className="text-sm text-muted-foreground">Found in Tally</div>
                </div>
                <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 text-center">
                  <div className="text-2xl font-semibold text-green-700 dark:text-green-400">
                    {syncPreview.stats.withChanges}
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-500">Will Update</div>
                </div>
              </div>

              {/* Option */}
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                <Checkbox
                  id="onlyBlanks"
                  checked={syncOnlyBlanks}
                  onCheckedChange={(checked) => {
                    setSyncOnlyBlanks(!!checked);
                    refreshPreview();
                  }}
                />
                <label htmlFor="onlyBlanks" className="text-sm cursor-pointer">
                  Only fill blank fields (don't overwrite existing values)
                </label>
              </div>

              {/* Preview Table */}
              {syncPreview.suppliers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No suppliers have data available in Tally to sync.
                </div>
              ) : (
                <ScrollArea className="h-[400px] border rounded-lg">
                  <div className="p-4 space-y-4">
                    {syncPreview.suppliers
                      .filter((s) => s.changes.some((c) => c.willUpdate))
                      .map((supplier) => (
                        <div key={supplier.supplierId} className="border rounded-lg p-4">
                          <div className="font-medium mb-3">
                            {supplier.supplierName}
                            <span className="text-muted-foreground font-normal ml-2">({supplier.supplierCode})</span>
                            <span className="text-xs text-muted-foreground ml-2">→ {supplier.tallyLedgerName}</span>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[140px]">Field</TableHead>
                                <TableHead>Current Value</TableHead>
                                <TableHead className="w-[40px]"></TableHead>
                                <TableHead>From Tally</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {supplier.changes
                                .filter((c) => c.willUpdate)
                                .map((change) => (
                                  <TableRow key={change.field}>
                                    <TableCell className="font-medium">{change.label}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {change.currentValue || (
                                        <span className="italic text-muted-foreground/50">(empty)</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <ArrowRight className="h-4 w-4 text-green-600" />
                                    </TableCell>
                                    <TableCell className="text-green-700 dark:text-green-400 font-medium">
                                      {change.tallyValue}
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || !syncPreview || syncPreview.stats.withChanges === 0}
            >
              {syncMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apply Changes ({syncPreview?.stats.withChanges || 0})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
