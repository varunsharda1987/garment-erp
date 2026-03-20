import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Play,
  CheckCircle,
  Package,
  RefreshCw,
  ClipboardCheck,
  Box,
  ArrowDownToLine,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { finishingIssueService, finishingSummaryService } from '@/services/finishing.service';
import type {
  FinishingIssue,
  FinishingStatus,
  FinishingSummary,
  FinishingIncomingTransferSlip,
  FinishingStyleSizeSummaryItem,
} from '@/types/finishing.types';
import {
  FinishingStatusLabels,
  FinishingStatusColors,
} from '@/types/finishing.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { format } from 'date-fns';

export default function FinishingList() {
  const navigate = useNavigate();

  // Issues tab state
  const [issues, setIssues] = useState<FinishingIssue[]>([]);
  const [summary, setSummary] = useState<FinishingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState('issues');

  // Incoming tab state
  const [incomingSlips, setIncomingSlips] = useState<FinishingIncomingTransferSlip[]>([]);
  const [incomingLoading, setIncomingLoading] = useState(false);

  // Size-wise status tab state
  const [sizeSummary, setSizeSummary] = useState<FinishingStyleSizeSummaryItem[]>([]);
  const [sizeLoading, setSizeLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [issuesRes, summaryRes] = await Promise.all([
        finishingIssueService.getAll({
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter as FinishingStatus || undefined,
        }),
        finishingSummaryService.getSummary(),
      ]);
      setIssues(issuesRes.data);
      setTotalPages(issuesRes.pagination.totalPages);
      setSummary(summaryRes);
    } catch (error) {
      console.error('Error fetching finishing data:', error);
      handleApiError(error, 'Failed to load finishing issues');
    } finally {
      setLoading(false);
    }
  };

  const fetchIncomingData = async () => {
    try {
      setIncomingLoading(true);
      const data = await finishingSummaryService.getAvailableTransferSlips();
      setIncomingSlips(data);
    } catch (error) {
      handleApiError(error, 'Failed to load incoming transfer slips');
    } finally {
      setIncomingLoading(false);
    }
  };

  const fetchSizeSummary = async () => {
    try {
      setSizeLoading(true);
      const data = await finishingSummaryService.getStyleSizeSummary();
      setSizeSummary(data);
    } catch (error) {
      handleApiError(error, 'Failed to load size-wise status');
    } finally {
      setSizeLoading(false);
    }
  };

  // Reset to page 1 when status filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [page, statusFilter]);

  // Lazy-load tab data
  useEffect(() => {
    if (activeTab === 'incoming' && incomingSlips.length === 0) {
      fetchIncomingData();
    }
    if (activeTab === 'sizewise' && sizeSummary.length === 0) {
      fetchSizeSummary();
    }
  }, [activeTab]);

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    if (activeTab === 'incoming') await fetchIncomingData();
    if (activeTab === 'sizewise') await fetchSizeSummary();
    setIsRefreshing(false);
  };

  const handleReceive = async (id: string) => {
    try {
      await finishingIssueService.receive(id, { transferSlipId: '', skuReceived: [] });
      handleApiSuccess('Success', 'Items received successfully');
      fetchData();
    } catch (error) {
      handleApiError(error, 'Failed to receive items');
    }
  };

  const handleStart = async (id: string) => {
    try {
      await finishingIssueService.start(id);
      handleApiSuccess('Success', 'Finishing started successfully');
      fetchData();
    } catch (error) {
      handleApiError(error, 'Failed to start finishing');
    }
  };

  const handleMoveToPacking = async (id: string) => {
    try {
      await finishingIssueService.moveToPacking(id);
      handleApiSuccess('Success', 'Moved to packing successfully');
      fetchData();
    } catch (error) {
      handleApiError(error, 'Failed to move to packing');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await finishingIssueService.complete(id);
      handleApiSuccess('Success', 'Finishing completed successfully');
      fetchData();
    } catch (error) {
      handleApiError(error, 'Failed to complete finishing');
    }
  };

  const handleGenerateTransferSlip = async (id: string) => {
    try {
      const result = await finishingIssueService.generateTransferSlip(id);
      handleApiSuccess('Transfer Slip Generated', `Slip ${result.slipNumber} created for dispatch.`);
      fetchData();
    } catch (error) {
      handleApiError(error, 'Failed to generate transfer slip');
    }
  };

  const getStatusBadge = (status: FinishingStatus) => (
    <Badge className={FinishingStatusColors[status]}>
      {FinishingStatusLabels[status]}
    </Badge>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckSquare className="h-8 w-8 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold">Finishing</h1>
            <p className="text-muted-foreground">
              Manage finishing issues, QC, and packing operations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button asChild>
            <Link to="/manufacturing/finishing/new">
              <Plus className="h-4 w-4 mr-2" />
              New Issue
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="issues">Finishing Issues</TabsTrigger>
          <TabsTrigger value="incoming">Incoming from Stitching</TabsTrigger>
          <TabsTrigger value="sizewise">Size-wise Status</TabsTrigger>
        </TabsList>

        {/* ============================================ */}
        {/* Tab 1: Finishing Issues */}
        {/* ============================================ */}
        <TabsContent value="issues" className="space-y-6">
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Issues
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pending Receipt
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-600">{summary.pendingReceipt}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    In Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{summary.inProgress}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Packing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{summary.packing}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Completed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{summary.completed}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Finished
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-teal-600">
                    {summary.totalFinished.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by issue number, work order, or style..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="PENDING_RECEIPT">Pending Receipt</SelectItem>
                    <SelectItem value="RECEIVED">Received</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="PACKING">Packing</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleSearch}>Search</Button>
              </div>
            </CardContent>
          </Card>

          {/* Issues Table */}
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : issues.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No finishing issues found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue #</TableHead>
                      <TableHead>Work Order</TableHead>
                      <TableHead>Style</TableHead>
                      <TableHead>Contractor</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead className="text-right">Issued Qty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issues.map((issue) => (
                      <TableRow key={issue.id}>
                        <TableCell className="font-medium">{issue.issueNumber}</TableCell>
                        <TableCell>
                          {issue.workOrder?.workOrderNumber || '-'}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {issue.workOrder?.style?.styleCode || '-'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {issue.workOrder?.style?.styleName || ''}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {issue.contractor?.name || issue.manager?.name || '-'}
                        </TableCell>
                        <TableCell>
                          {format(new Date(issue.issueDate), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          {issue.skuBreakdown?.reduce((sum, sku) => sum + sku.issuedQty, 0) || 0}
                        </TableCell>
                        <TableCell>{getStatusBadge(issue.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" asChild>
                              <Link to={`/manufacturing/finishing/${issue.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            {issue.status === 'PENDING_RECEIPT' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleReceive(issue.id)}
                                title="Receive from Stitching"
                              >
                                <ClipboardCheck className="h-4 w-4 text-yellow-600" />
                              </Button>
                            )}
                            {issue.status === 'RECEIVED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStart(issue.id)}
                                title="Start Finishing"
                              >
                                <Play className="h-4 w-4 text-blue-600" />
                              </Button>
                            )}
                            {issue.status === 'IN_PROGRESS' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleMoveToPacking(issue.id)}
                                title="Move to Packing"
                              >
                                <Box className="h-4 w-4 text-purple-600" />
                              </Button>
                            )}
                            {issue.status === 'PACKING' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleComplete(issue.id)}
                                title="Complete Finishing"
                              >
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            {issue.status === 'COMPLETED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Generate Transfer Slip"
                                onClick={() => handleGenerateTransferSlip(issue.id)}
                              >
                                <Package className="h-4 w-4 text-teal-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================ */}
        {/* Tab 2: Incoming from Stitching */}
        {/* ============================================ */}
        <TabsContent value="incoming" className="space-y-4">
          {incomingLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : incomingSlips.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending transfer slips from stitching
            </div>
          ) : (
            incomingSlips.map((slip) => (
              <Card key={slip.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{slip.slipNumber}</span>
                        <Badge variant="secondary">{slip.styleCode}</Badge>
                        <span className="text-sm text-muted-foreground">{slip.styleName}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {slip.workOrderNumber} | {slip.totalGoodPieces} pcs |{' '}
                        {format(new Date(slip.transferDate), 'dd MMM yyyy')}
                        {slip.issuedTo && ` | From: ${slip.issuedTo}`}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/manufacturing/finishing/new?transferSlipId=${slip.id}`)}
                    >
                      <ArrowDownToLine className="h-4 w-4 mr-2" />
                      Receive & Create Issue
                    </Button>
                  </div>
                </CardHeader>
                {slip.skuBreakdown.length > 0 && (
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Color</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {slip.skuBreakdown.map((sku, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{sku.colorName}</TableCell>
                            <TableCell>{sku.sizeName}</TableCell>
                            <TableCell className="text-right font-medium">{sku.quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        {/* ============================================ */}
        {/* Tab 3: Size-wise Status */}
        {/* ============================================ */}
        <TabsContent value="sizewise" className="space-y-4">
          {sizeLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sizeSummary.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No active finishing issues to display
            </div>
          ) : (
            sizeSummary.map((item) => (
              <Card key={item.workOrderId}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold">{item.styleCode}</span>
                        {item.styleName && (
                          <span className="text-sm text-muted-foreground">{item.styleName}</span>
                        )}
                        <span className="text-sm text-muted-foreground">({item.workOrderNumber})</span>
                        {item.customerName && (
                          <Badge variant="secondary" className="text-xs font-normal">
                            {item.customerName}
                          </Badge>
                        )}
                      </div>
                      {item.orderNumber && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Order: {item.orderNumber}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {item.daysInCutting > 0 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Clock className="h-3 w-3" />
                          Cutting: {item.daysInCutting}d
                        </Badge>
                      )}
                      {item.daysInStitching > 0 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Clock className="h-3 w-3" />
                          Stitching: {item.daysInStitching}d
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs gap-1">
                        <Clock className="h-3 w-3" />
                        Finishing: {item.daysInFinishing}d
                      </Badge>
                      {item.daysPendingPush !== null && item.daysPendingPush > 0 && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Idle: {item.daysPendingPush}d
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm mt-2">
                    <span className="text-gray-500">
                      Pending: <strong>{item.totalPending}</strong>
                    </span>
                    <span className="text-blue-600">
                      Running: <strong>{item.totalInProgress}</strong>
                    </span>
                    <span className="text-green-600">
                      Done: <strong>{item.totalCompleted}</strong>
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right">Pending</TableHead>
                        <TableHead className="text-right">In Progress</TableHead>
                        <TableHead className="text-right">Completed</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {item.sizes.map((size) => (
                        <TableRow key={size.sizeId}>
                          <TableCell className="font-medium">{size.sizeName}</TableCell>
                          <TableCell className="text-right text-gray-600">
                            {size.pending || '-'}
                          </TableCell>
                          <TableCell className="text-right text-blue-600 font-medium">
                            {size.inProgress || '-'}
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            {size.completed || '-'}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {size.total}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold border-t-2">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right text-gray-600">
                          {item.totalPending}
                        </TableCell>
                        <TableCell className="text-right text-blue-600">
                          {item.totalInProgress}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {item.totalCompleted}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.totalPending + item.totalInProgress + item.totalCompleted}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
