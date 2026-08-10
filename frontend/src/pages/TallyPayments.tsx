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
  Receipt,
  CreditCard,
  Banknote,
  Building2,
  Smartphone,
} from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { getTallyPayments, pushPaymentToTally } from '@/services/tally.service';
import type { PaymentTallyStatus } from '@/types/tally.types';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency } from '@/lib/currency';

const PaymentMethodIcon: Record<string, React.ReactNode> = {
  CASH: <Banknote className="h-4 w-4" />,
  BANK_TRANSFER: <Building2 className="h-4 w-4" />,
  NEFT: <Building2 className="h-4 w-4" />,
  RTGS: <Building2 className="h-4 w-4" />,
  IMPS: <Building2 className="h-4 w-4" />,
  CHEQUE: <CreditCard className="h-4 w-4" />,
  UPI: <Smartphone className="h-4 w-4" />,
};

export default function TallyPaymentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [pushStatus, setPushStatus] = useState<'all' | 'pushed' | 'not_pushed' | 'error'>('all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPushing, setBulkPushing] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['tally-payments', { search: debouncedSearch, pushStatus, page }],
    queryFn: () =>
      getTallyPayments({
        search: debouncedSearch || undefined,
        pushStatus: pushStatus === 'all' ? undefined : pushStatus,
        page,
        limit: 20,
      }),
  });

  const pushMutation = useMutation({
    mutationFn: pushPaymentToTally,
    onSuccess: (result) => {
      if (result.success) {
        handleApiSuccess('Pushed', `Receipt pushed to Tally (Voucher: ${result.voucherNumber})`);
      } else {
        handleApiError(new Error(result.error || 'Push failed'), 'Push failed');
      }
      queryClient.invalidateQueries({ queryKey: ['tally-payments'] });
    },
    onError: (error) => handleApiError(error, 'Failed to push receipt'),
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked && data?.data) {
      const pushableIds = data.data.filter((p) => p.customerLinked && !p.tallyPushedAt).map((p) => p.id);
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
        const result = await pushPaymentToTally(id);
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
    queryClient.invalidateQueries({ queryKey: ['tally-payments'] });

    if (successCount > 0 && failCount === 0) {
      handleApiSuccess('Bulk push complete', `Successfully pushed ${successCount} receipt(s) to Tally`);
    } else if (successCount > 0 && failCount > 0) {
      handleApiSuccess(
        'Bulk push partial',
        `Pushed ${successCount} receipt(s), ${failCount} failed. Check error status.`
      );
    } else {
      handleApiError(new Error(`All ${failCount} receipt(s) failed`), 'Bulk push failed');
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

  const getStatusIcon = (payment: PaymentTallyStatus) => {
    if (payment.tallyPushedAt) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (payment.tallyLastError) {
      return <XCircle className="h-4 w-4 text-red-600" />;
    }
    if (!payment.customerLinked) {
      return <Link2Off className="h-4 w-4 text-orange-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = (payment: PaymentTallyStatus) => {
    if (payment.tallyPushedAt) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          Pushed
        </Badge>
      );
    }
    if (payment.tallyLastError) {
      return (
        <Badge variant="destructive" className="bg-red-100 text-red-800">
          Error
        </Badge>
      );
    }
    if (!payment.customerLinked) {
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
    pushable: data?.data.filter((p) => p.customerLinked && !p.tallyPushedAt).length || 0,
    selected: selectedIds.size,
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-medium text-foreground">Receipt Push to Tally</h1>
        <p className="text-muted-foreground mt-1">Manage and push customer payment receipts to Tally ERP</p>
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
                <Receipt className="h-5 w-5" />
                Payment Receipts
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
                placeholder="Search invoices, customers, references..."
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
                <SelectItem value="all">All Receipts</SelectItem>
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
                            data.data.filter((p) => p.customerLinked && !p.tallyPushedAt).length > 0 &&
                            data.data
                              .filter((p) => p.customerLinked && !p.tallyPushedAt)
                              .every((p) => selectedIds.has(p.id))
                          }
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pushed</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          No receipts found
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.data.map((payment) => {
                        const canPush = payment.customerLinked && !payment.tallyPushedAt;
                        const canSelect = payment.customerLinked && !payment.tallyPushedAt;

                        return (
                          <TableRow key={payment.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(payment.id)}
                                onCheckedChange={(checked) => handleSelectOne(payment.id, !!checked)}
                                disabled={!canSelect}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(payment)}
                                <span className="font-mono">{payment.invoiceNumber}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {payment.customerName}
                                {!payment.customerLinked && (
                                  <span title="Customer not linked to Tally">
                                    <AlertCircle className="h-3 w-3 text-orange-500" />
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{formatDate(payment.paymentDate)}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {PaymentMethodIcon[payment.paymentMethod] || <CreditCard className="h-4 w-4" />}
                                <span className="text-sm">{payment.paymentMethod.replace(/_/g, ' ')}</span>
                              </div>
                              {payment.referenceNumber && (
                                <div className="text-xs text-muted-foreground font-mono">{payment.referenceNumber}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-600">
                              +{formatCurrency(payment.amount)}
                            </TableCell>
                            <TableCell>{getStatusBadge(payment)}</TableCell>
                            <TableCell>
                              {payment.tallyPushedAt ? (
                                <span className="text-sm text-muted-foreground">
                                  {formatDateTime(payment.tallyPushedAt)}
                                </span>
                              ) : payment.tallyLastError ? (
                                <span
                                  className="text-sm text-red-600 truncate max-w-[150px] block"
                                  title={payment.tallyLastError}
                                >
                                  {payment.tallyLastError.slice(0, 30)}...
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
                                    onClick={() => pushMutation.mutate(payment.id)}
                                    disabled={pushMutation.isPending}
                                  >
                                    <Upload className="h-4 w-4" />
                                  </Button>
                                )}
                                {payment.tallyPushedAt && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => pushMutation.mutate(payment.id)}
                                    disabled={pushMutation.isPending}
                                    title="Re-push to Tally"
                                  >
                                    <Upload className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" asChild>
                                  <Link to={`/financial/invoices/${payment.invoiceNumber}`}>
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
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} receipts)
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
