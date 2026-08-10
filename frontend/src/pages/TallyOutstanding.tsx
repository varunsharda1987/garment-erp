import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { getTallyOutstanding } from '@/services/tally.service';

import { formatCurrency } from '@/lib/currency';

export default function TallyOutstandingPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'matched' | 'unmatched' | 'variance'>('all');

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['tally-outstanding'],
    queryFn: getTallyOutstanding,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter and search data
  const filteredData =
    data?.data.filter((entry) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          entry.tallyLedgerName.toLowerCase().includes(searchLower) ||
          entry.customerName?.toLowerCase().includes(searchLower) ||
          entry.customerCode?.toLowerCase().includes(searchLower) ||
          entry.tallyGstin?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filter === 'matched') return entry.matched;
      if (filter === 'unmatched') return !entry.matched;
      if (filter === 'variance') return entry.matched && entry.difference !== null && Math.abs(entry.difference) >= 1;

      return true;
    }) || [];

  const getDifferenceIcon = (diff: number | null) => {
    if (diff === null) return null;
    if (Math.abs(diff) < 1) return <Minus className="h-4 w-4 text-green-600" />;
    if (diff > 0) return <TrendingUp className="h-4 w-4 text-orange-500" />;
    return <TrendingDown className="h-4 w-4 text-blue-500" />;
  };

  const getDifferenceBadge = (diff: number | null) => {
    if (diff === null) return null;
    if (Math.abs(diff) < 1) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          Match
        </Badge>
      );
    }
    if (diff > 0) {
      return (
        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
          Tally Higher
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
        ERP Higher
      </Badge>
    );
  };

  const summary = data?.summary;

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-medium text-foreground">Outstanding Balances</h1>
        <p className="text-muted-foreground mt-1">Reconcile customer receivables between Tally and ERP</p>
      </div>

      {/* Quick Links */}
      <div className="flex gap-2 mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings/tally">Tally Settings</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings/tally/customers">Customer Matching</Link>
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Tally Balance</div>
            <div className="text-xl font-semibold">{formatCurrency(summary.totalTallyBalance)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">ERP Balance</div>
            <div className="text-xl font-semibold">{formatCurrency(summary.totalErpBalance)}</div>
          </Card>
          <Card className={`p-4 ${Math.abs(summary.totalDifference) >= 1 ? 'bg-orange-50' : 'bg-green-50'}`}>
            <div className="text-sm text-muted-foreground">Difference</div>
            <div
              className={`text-xl font-semibold ${Math.abs(summary.totalDifference) >= 1 ? 'text-orange-600' : 'text-green-600'}`}
            >
              {formatCurrency(summary.totalDifference)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Matched</div>
            <div className="text-xl font-semibold text-green-600">{summary.matchedCount}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Unmatched</div>
            <div className="text-xl font-semibold text-orange-600">{summary.unmatchedCount}</div>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Party Ledgers</CardTitle>
              <CardDescription>{data?.fetchedAt && `Last fetched: ${formatDate(data.fetchedAt)}`}</CardDescription>
            </div>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh from Tally
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ledger, customer, GSTIN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ledgers</SelectItem>
                <SelectItem value="matched">Matched to ERP</SelectItem>
                <SelectItem value="unmatched">Not Matched</SelectItem>
                <SelectItem value="variance">With Variance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tally Ledger</TableHead>
                    <TableHead>ERP Customer</TableHead>
                    <TableHead className="text-right">Tally Balance</TableHead>
                    <TableHead className="text-right">ERP Balance</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {data?.data.length === 0
                          ? 'No outstanding balances found in Tally'
                          : 'No ledgers match your filters'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((entry, idx) => (
                      <TableRow key={`${entry.tallyLedgerName}-${idx}`}>
                        <TableCell>
                          <div className="font-medium">{entry.tallyLedgerName}</div>
                          <div className="text-sm text-muted-foreground">{entry.tallyGstin || entry.tallyParent}</div>
                        </TableCell>
                        <TableCell>
                          {entry.matched ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <div>
                                <div className="font-medium">{entry.customerName}</div>
                                <div className="text-sm text-muted-foreground">{entry.customerCode}</div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <XCircle className="h-4 w-4 text-orange-500" />
                              <span>Not linked</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(entry.tallyBalance)}</TableCell>
                        <TableCell className="text-right">
                          {entry.erpBalance !== null ? (
                            <span className="font-medium">{formatCurrency(entry.erpBalance)}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.difference !== null ? (
                            <div className="flex items-center justify-end gap-2">
                              {getDifferenceIcon(entry.difference)}
                              <span className={Math.abs(entry.difference) >= 1 ? 'font-medium' : ''}>
                                {formatCurrency(entry.difference)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.matched ? (
                            getDifferenceBadge(entry.difference)
                          ) : (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Unlinked
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
