import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Shirt,
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Play,
  CheckCircle,
  RefreshCw,
  ClipboardCheck,
  ArrowDownToLine,
  Truck,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { stitchingIssueService, stitchingSummaryService } from '@/services/stitching.service';
import type {
  StitchingIssue,
  StitchingIssueStatus,
  StitchingSummary,
  IncomingTransferSlip,
  StyleSizeSummaryItem,
} from '@/types/stitching.types';
import { StitchingIssueStatusLabels, StitchingIssueStatusColors } from '@/types/stitching.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { format, differenceInCalendarDays } from 'date-fns';

export default function StitchingList() {
  const navigate = useNavigate();

  // Issues tab state
  const [issues, setIssues] = useState<StitchingIssue[]>([]);
  const [summary, setSummary] = useState<StitchingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Incoming tab state
  const [incomingSlips, setIncomingSlips] = useState<IncomingTransferSlip[]>([]);
  const [incomingLoading, setIncomingLoading] = useState(false);

  // Size-wise status tab state
  const [sizeSummary, setSizeSummary] = useState<StyleSizeSummaryItem[]>([]);
  const [sizeLoading, setSizeLoading] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState('issues');

  // ─── Issues Tab Data ───────────────────────────
  const fetchIssuesData = async () => {
    try {
      setLoading(true);
      const [issuesRes, summaryRes] = await Promise.all([
        stitchingIssueService.getAll({
          page,
          limit: 20,
          search: search || undefined,
          status: (statusFilter as StitchingIssueStatus) || undefined,
        }),
        stitchingSummaryService.getSummary(),
      ]);
      setIssues(issuesRes.data);
      setTotalPages(issuesRes.pagination.totalPages);
      setSummary(summaryRes);
    } catch (error) {
      console.error('Error fetching stitching data:', error);
      handleApiError(error, 'Failed to load stitching issues');
    } finally {
      setLoading(false);
    }
  };

  // ─── Incoming Tab Data ─────────────────────────
  const fetchIncomingData = async () => {
    try {
      setIncomingLoading(true);
      const data = await stitchingSummaryService.getPendingTransferSlips();
      setIncomingSlips(data);
    } catch (error) {
      console.error('Error fetching incoming slips:', error);
      handleApiError(error, 'Failed to load incoming transfer slips');
    } finally {
      setIncomingLoading(false);
    }
  };

  // ─── Size Summary Tab Data ─────────────────────
  const fetchSizeSummary = async () => {
    try {
      setSizeLoading(true);
      const data = await stitchingSummaryService.getStyleSizeSummary();
      setSizeSummary(data);
    } catch (error) {
      console.error('Error fetching size summary:', error);
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
    fetchIssuesData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  // Fetch tab data when tab changes
  useEffect(() => {
    if (activeTab === 'incoming') {
      fetchIncomingData();
    } else if (activeTab === 'sizewise') {
      fetchSizeSummary();
    }
  }, [activeTab]);

  const handleSearch = () => {
    setPage(1);
    fetchIssuesData();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (activeTab === 'issues') await fetchIssuesData();
    else if (activeTab === 'incoming') await fetchIncomingData();
    else if (activeTab === 'sizewise') await fetchSizeSummary();
    setIsRefreshing(false);
  };

  // ─── Workflow Actions ──────────────────────────
  const handleReceive = async (id: string) => {
    try {
      // Quick-receive from the list: no slip/breakdown captured here — send an empty payload so the
      // backend simply flips PENDING_RECEIPT → RECEIVED (transferSlipId/skuReceived guards no-op).
      await stitchingIssueService.receiveFromCutting(id, {});
      handleApiSuccess('Success', 'Items received successfully');
      fetchIssuesData();
    } catch (error) {
      handleApiError(error, 'Failed to receive items');
    }
  };

  const handleStart = async (id: string) => {
    try {
      await stitchingIssueService.start(id);
      handleApiSuccess('Success', 'Stitching started successfully');
      fetchIssuesData();
    } catch (error) {
      handleApiError(error, 'Failed to start stitching');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await stitchingIssueService.complete(id);
      handleApiSuccess('Success', 'Stitching completed successfully');
      fetchIssuesData();
    } catch (error) {
      handleApiError(error, 'Failed to complete stitching');
    }
  };

  const handleGenerateTransferSlip = async (id: string) => {
    try {
      const result = await stitchingIssueService.generateTransferSlip(id);
      handleApiSuccess('Transfer Slip Generated', `Slip ${result.slipNumber} created for finishing`);
      fetchIssuesData();
    } catch (error) {
      handleApiError(error, 'Failed to generate transfer slip');
    }
  };

  const getStatusBadge = (status: StitchingIssueStatus) => (
    <Badge className={StitchingIssueStatusColors[status]}>{StitchingIssueStatusLabels[status]}</Badge>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shirt className="h-8 w-8 text-info" />
          <div>
            <h1 className="text-2xl font-display font-medium">Stitching Department</h1>
            <p className="text-muted-foreground">Track stitching issues, incoming from cutting, and size-wise status</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button asChild>
            <Link to="/manufacturing/stitching/new">
              <Plus className="h-4 w-4 mr-2" />
              New Issue
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Receipt</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{summary.pendingReceipt}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Received</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{summary.received}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-info">{summary.inProgress}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{summary.completed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Completed Pcs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{summary.totalCompleted.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="issues">Stitching Issues</TabsTrigger>
          <TabsTrigger value="incoming">
            Incoming from Cutting
            {incomingSlips.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {incomingSlips.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sizewise">Size-wise Status</TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════
            TAB 1: Stitching Issues
        ═══════════════════════════════════════════ */}
        <TabsContent value="issues" className="space-y-4">
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
                <div className="text-center py-8 text-muted-foreground">No stitching issues found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue #</TableHead>
                      <TableHead>Work Order</TableHead>
                      <TableHead>Style</TableHead>
                      <TableHead>Contractor</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead className="text-center">Days</TableHead>
                      <TableHead className="text-right">Issued Qty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issues.map((issue) => (
                      <TableRow key={issue.id}>
                        <TableCell className="font-medium">{issue.issueNumber}</TableCell>
                        <TableCell>{issue.workOrder?.workOrderNumber || '-'}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{issue.workOrder?.style?.styleCode || '-'}</div>
                            <div className="text-sm text-muted-foreground">
                              {issue.workOrder?.style?.styleName || ''}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{issue.contractor?.name || issue.manager?.name || '-'}</TableCell>
                        <TableCell>
                          {issue.startDate ? format(new Date(issue.startDate), 'dd MMM yyyy') : '—'}
                        </TableCell>
                        <TableCell>{issue.endDate ? format(new Date(issue.endDate), 'dd MMM yyyy') : '—'}</TableCell>
                        <TableCell className="text-center">
                          {issue.startDate && issue.endDate
                            ? Math.max(1, differenceInCalendarDays(new Date(issue.endDate), new Date(issue.startDate)))
                            : issue.startDate
                              ? `${Math.max(1, differenceInCalendarDays(new Date(), new Date(issue.startDate)))}...`
                              : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {issue.skuBreakdown?.reduce((sum, sku) => sum + sku.issuedQty, 0) || 0}
                        </TableCell>
                        <TableCell>{getStatusBadge(issue.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" asChild>
                              <Link to={`/manufacturing/stitching/${issue.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            {issue.status === 'PENDING_RECEIPT' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleReceive(issue.id)}
                                title="Receive from Cutting"
                              >
                                <ClipboardCheck className="h-4 w-4 text-warning" />
                              </Button>
                            )}
                            {issue.status === 'RECEIVED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStart(issue.id)}
                                title="Start Stitching"
                              >
                                <Play className="h-4 w-4 text-info" />
                              </Button>
                            )}
                            {issue.status === 'IN_PROGRESS' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleComplete(issue.id)}
                                title="Complete Stitching"
                              >
                                <CheckCircle className="h-4 w-4 text-success" />
                              </Button>
                            )}
                            {issue.status === 'COMPLETED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleGenerateTransferSlip(issue.id)}
                                title="Issue to Finishing"
                              >
                                <Truck className="h-4 w-4 text-accent" />
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
                    <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
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

        {/* ═══════════════════════════════════════════
            TAB 2: Incoming from Cutting
        ═══════════════════════════════════════════ */}
        <TabsContent value="incoming" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5" />
                Pending Transfer Slips from Cutting
              </CardTitle>
            </CardHeader>
            <CardContent>
              {incomingLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : incomingSlips.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending transfer slips from cutting department
                </div>
              ) : (
                <div className="space-y-4">
                  {incomingSlips.map((slip) => (
                    <Card key={slip.id} className="border">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-base">{slip.slipNumber}</span>
                              <Badge variant="outline">{slip.totalGoodPieces} pcs</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              <span className="font-medium">{slip.workOrderNumber}</span>
                              {' — '}
                              <span>{slip.styleCode}</span>
                              {slip.styleName && ` (${slip.styleName})`}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Transferred: {format(new Date(slip.transferDate), 'dd MMM yyyy')}
                              {slip.issuedTo && ` • Contractor: ${slip.issuedTo}`}
                            </div>
                          </div>
                          <Button size="sm" onClick={() => navigate(`/manufacturing/stitching/new?slipId=${slip.id}`)}>
                            <Plus className="h-4 w-4 mr-1" />
                            Receive & Create Issue
                          </Button>
                        </div>

                        {/* Size-wise breakdown */}
                        {slip.skuBreakdown.length > 0 && (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {slip.skuBreakdown.some((s) => s.colorId) && <TableHead>Color</TableHead>}
                                <TableHead>Size</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {slip.skuBreakdown
                                .sort((a, b) => a.sortOrder - b.sortOrder)
                                .map((sku, idx) => (
                                  <TableRow key={idx}>
                                    {slip.skuBreakdown.some((s) => s.colorId) && <TableCell>{sku.colorName}</TableCell>}
                                    <TableCell>{sku.sizeName}</TableCell>
                                    <TableCell className="text-right font-medium">{sku.quantity}</TableCell>
                                  </TableRow>
                                ))}
                              <TableRow className="font-bold border-t-2">
                                {slip.skuBreakdown.some((s) => s.colorId) && <TableCell />}
                                <TableCell>Total</TableCell>
                                <TableCell className="text-right">
                                  {slip.skuBreakdown.reduce((sum, s) => sum + s.quantity, 0)}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════
            TAB 3: Size-wise Status
        ═══════════════════════════════════════════ */}
        <TabsContent value="sizewise" className="space-y-4">
          {sizeLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sizeSummary.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No active stitching issues to display</div>
          ) : (
            sizeSummary.map((item) => (
              <Card key={item.workOrderId}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold">{item.styleCode}</span>
                        {item.styleName && <span className="text-sm text-muted-foreground">{item.styleName}</span>}
                        <span className="text-sm text-muted-foreground">({item.workOrderNumber})</span>
                        {item.customerName && (
                          <Badge variant="secondary" className="text-xs font-normal">
                            {item.customerName}
                          </Badge>
                        )}
                      </div>
                      {item.orderNumber && (
                        <div className="text-xs text-muted-foreground mt-1">Order: {item.orderNumber}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {item.daysInCutting > 0 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Clock className="h-3 w-3" />
                          Cutting: {item.daysInCutting}d
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs gap-1">
                        <Clock className="h-3 w-3" />
                        Stitching: {item.daysInStitching}d
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
                    <span className="text-muted-foreground">
                      Pending: <strong>{item.totalPending}</strong>
                    </span>
                    <span className="text-info">
                      Running: <strong>{item.totalInProgress}</strong>
                    </span>
                    <span className="text-success">
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
                          <TableCell className="text-right text-muted-foreground">{size.pending || '-'}</TableCell>
                          <TableCell className="text-right text-info font-medium">{size.inProgress || '-'}</TableCell>
                          <TableCell className="text-right text-success font-medium">{size.completed || '-'}</TableCell>
                          <TableCell className="text-right font-bold">{size.total}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold border-t-2">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right text-muted-foreground">{item.totalPending}</TableCell>
                        <TableCell className="text-right text-info">{item.totalInProgress}</TableCell>
                        <TableCell className="text-right text-success">{item.totalCompleted}</TableCell>
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
