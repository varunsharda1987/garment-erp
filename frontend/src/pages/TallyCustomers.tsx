import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Search, Link as LinkIcon, Unlink, Wand2, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import {
  getTallyCustomers,
  getTallyLedgers,
  linkCustomerToTally,
  unlinkCustomerFromTally,
  autoMatchTallyCustomers,
} from '@/services/tally.service';
import type { CustomerTallyMatch, TallyLedger } from '@/types/tally.types';
import { useDebounce } from '@/hooks/useDebounce';

export default function TallyCustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [matchStatus, setMatchStatus] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [page, setPage] = useState(1);
  const [linkDialog, setLinkDialog] = useState<CustomerTallyMatch | null>(null);
  const [selectedLedger, setSelectedLedger] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['tally-customers', { search: debouncedSearch, matchStatus, page }],
    queryFn: () =>
      getTallyCustomers({
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
    enabled: !!linkDialog,
    staleTime: 5 * 60 * 1000,
  });

  const linkMutation = useMutation({
    mutationFn: ({ customerId, ledgerName }: { customerId: string; ledgerName: string }) =>
      linkCustomerToTally(customerId, ledgerName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tally-customers'] });
      handleApiSuccess('Linked', 'Customer linked to Tally ledger successfully');
      setLinkDialog(null);
      setSelectedLedger('');
    },
    onError: (error) => handleApiError(error, 'Failed to link customer'),
  });

  const unlinkMutation = useMutation({
    mutationFn: unlinkCustomerFromTally,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tally-customers'] });
      handleApiSuccess('Unlinked', 'Customer unlinked from Tally ledger');
    },
    onError: (error) => handleApiError(error, 'Failed to unlink customer'),
  });

  const autoMatchMutation = useMutation({
    mutationFn: autoMatchTallyCustomers,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tally-customers'] });
      handleApiSuccess('Auto-match complete', `Matched ${result.matched} of ${result.total} unmatched customers`);
    },
    onError: (error) => handleApiError(error, 'Auto-match failed'),
  });

  const handleLink = (customer: CustomerTallyMatch) => {
    setLinkDialog(customer);
    setSelectedLedger(customer.suggestion || '');
    setLedgerSearch('');
  };

  const handleConfirmLink = () => {
    if (linkDialog && selectedLedger) {
      linkMutation.mutate({ customerId: linkDialog.id, ledgerName: selectedLedger });
    }
  };

  const filteredLedgers =
    ledgersQuery.data?.filter(
      (l: TallyLedger) => !ledgerSearch || l.name.toLowerCase().includes(ledgerSearch.toLowerCase())
    ) || [];

  const stats = data?.stats || { total: 0, matched: 0, unmatched: 0 };
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-medium text-foreground">Customer-Ledger Matching</h1>
        <p className="text-muted-foreground mt-1">Link ERP customers to their corresponding Tally party ledgers</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Customers</div>
          <div className="text-2xl font-semibold">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Matched</div>
          <div className="text-2xl font-semibold text-green-600">{stats.matched}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Unmatched</div>
          <div className="text-2xl font-semibold text-orange-600">{stats.unmatched}</div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customers</CardTitle>
              <CardDescription>Match customers to Tally ledgers for invoice push</CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => autoMatchMutation.mutate()}
              disabled={autoMatchMutation.isPending || stats.unmatched === 0}
            >
              {autoMatchMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              Auto-Match by Name
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
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
                setMatchStatus(v as 'all' | 'matched' | 'unmatched');
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="matched">Matched</SelectItem>
                <SelectItem value="unmatched">Unmatched</SelectItem>
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
                      <TableHead>Customer</TableHead>
                      <TableHead>GST Number</TableHead>
                      <TableHead>Tally Ledger</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No customers found
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.data.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <div className="font-medium">{customer.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {customer.code}
                              {customer.billingName && customer.billingName !== customer.name && (
                                <> • {customer.billingName}</>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{customer.gstNumber || '-'}</TableCell>
                          <TableCell>
                            {customer.tallyLedgerName ? (
                              <span className="font-medium">{customer.tallyLedgerName}</span>
                            ) : customer.suggestion ? (
                              <span className="text-muted-foreground italic">Suggestion: {customer.suggestion}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {customer.tallyMatched ? (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                <Check className="h-3 w-3 mr-1" />
                                Matched
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                                <X className="h-3 w-3 mr-1" />
                                Unmatched
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {customer.tallyMatched ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => unlinkMutation.mutate(customer.id)}
                                disabled={unlinkMutation.isPending}
                              >
                                <Unlink className="h-4 w-4 mr-1" />
                                Unlink
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => handleLink(customer)}>
                                <LinkIcon className="h-4 w-4 mr-1" />
                                Link
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
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} customers)
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
      <Dialog open={!!linkDialog} onOpenChange={(open) => !open && setLinkDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link Customer to Tally Ledger</DialogTitle>
            <DialogDescription>
              Select the Tally party ledger that corresponds to <strong>{linkDialog?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Input
                placeholder="Search ledgers..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto border rounded-lg">
              {ledgersQuery.isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredLedgers.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No ledgers found</div>
              ) : (
                <div className="divide-y">
                  {filteredLedgers.map((ledger: TallyLedger) => (
                    <button
                      key={ledger.name}
                      className={`w-full px-4 py-2 text-left hover:bg-muted transition-colors ${
                        selectedLedger === ledger.name ? 'bg-muted' : ''
                      }`}
                      onClick={() => setSelectedLedger(ledger.name)}
                    >
                      <div className="font-medium">{ledger.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {ledger.parent}
                        {ledger.gstin && <> • {ledger.gstin}</>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedLedger && (
              <div className="text-sm">
                Selected: <strong>{selectedLedger}</strong>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmLink} disabled={!selectedLedger || linkMutation.isPending}>
              {linkMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LinkIcon className="h-4 w-4 mr-2" />
              )}
              Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
