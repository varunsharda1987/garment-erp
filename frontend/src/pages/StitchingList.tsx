import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Shirt,
  Plus,
  X,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Pagination from '@/components/Pagination';
import SearchInput from '@/components/SearchInput';
import { FilterBar } from '@/components/filters';
import { WorkOrderCombobox } from '@/components/WorkOrderCombobox';
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
import { differenceInCalendarDays } from 'date-fns';
import { formatDate } from '@/lib/date';
import { StyleIdentity } from '@/components/StyleIdentity';
import { CompleteStitchingDialog } from '@/components/production/CompleteStitchingDialog';
import { stitchingOutputTotals } from '@/lib/stitching';
import {
  BUYER_STYLE_CODE_LABEL,
  STYLE_CODE_LABEL,
  buyerStyleCode,
  ourStyleCode,
  styleCodeIfDifferent,
} from '@/lib/style-code';

export default function StitchingList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Scope the list to a work order when arriving from a work-order drill-down link
  const workOrderId = searchParams.get('workOrderId') || '';

  // Issues tab state
  const [issues, setIssues] = useState<StitchingIssue[]>([]);
  const [summary, setSummary] = useState<StitchingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
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

  // The issue whose Complete dialog is open
  const [completing, setCompleting] = useState<StitchingIssue | null>(null);

  // ─── Issues Tab Data ───────────────────────────
  const fetchIssuesData = async () => {
    try {
      setLoading(true);
      const [issuesRes, summaryRes] = await Promise.all([
        stitchingIssueService.getAll({
          page,
          limit: pageSize,
          search: search || undefined,
          status: (statusFilter as StitchingIssueStatus) || undefined,
          workOrderId: workOrderId || undefined,
        }),
        // The cards follow the run filter (?workOrderId=) like the table does
        workOrderId ? stitchingSummaryService.getSummaryByWorkOrder(workOrderId) : stitchingSummaryService.getSummary(),
      ]);
      setIssues(issuesRes.data);
      setTotalPages(issuesRes.pagination.totalPages);
      setTotal(issuesRes.pagination.total);
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

  useEffect(() => {
    fetchIssuesData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search, statusFilter, workOrderId]);

  // Fetch tab data when tab changes. The pending slips load with the Issues tab too, so the
  // Incoming tab's count shows before that tab is opened.
  useEffect(() => {
    if (activeTab === 'sizewise') {
      fetchSizeSummary();
    } else {
      fetchIncomingData();
    }
  }, [activeTab]);

  // Filters: search, status, and the run a work-order drill-down link scoped the list to (?workOrderId=)
  const activeFilterCount = [search, statusFilter, workOrderId].filter(Boolean).length;

  // The run filter lives in the URL (?workOrderId=), so the work-order page's links keep landing here scoped
  const setWorkOrderFilter = (id: string) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('workOrderId', id);
    else next.delete('workOrderId');
    setSearchParams(next, { replace: true });
    setPage(1);
  };

  // Clears every filter; the tab and page size stay as chosen
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    if (workOrderId) setWorkOrderFilter('');
    setPage(1);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (activeTab === 'issues') await Promise.all([fetchIssuesData(), fetchIncomingData()]);
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
    <div className="space-y-6">
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Pieces Stitched</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{summary.totalCompleted.toLocaleString('en-IN')}</div>
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
              <FilterBar
                onClear={clearFilters}
                hasActiveFilters={activeFilterCount > 0}
                clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
              >
                <SearchInput
                  className="min-w-[220px] max-w-md flex-1"
                  placeholder="Search issue number, run number, buyer style code, style…"
                  value={search}
                  onChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  // The API refuses a longer search (max 100)
                  maxLength={100}
                  aria-label="Search stitching issues"
                />
                <Select
                  value={statusFilter || 'all'}
                  onValueChange={(v) => {
                    setStatusFilter(v === 'all' ? '' : v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]" aria-label="Status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="PENDING_RECEIPT">{StitchingIssueStatusLabels.PENDING_RECEIPT}</SelectItem>
                    <SelectItem value="RECEIVED">{StitchingIssueStatusLabels.RECEIVED}</SelectItem>
                    <SelectItem value="IN_PROGRESS">{StitchingIssueStatusLabels.IN_PROGRESS}</SelectItem>
                    <SelectItem value="COMPLETED">{StitchingIssueStatusLabels.COMPLETED}</SelectItem>
                  </SelectContent>
                </Select>
                <WorkOrderCombobox
                  value={workOrderId}
                  onValueChange={setWorkOrderFilter}
                  allowAll
                  placeholder="All production runs"
                  className="w-[260px]"
                />
              </FilterBar>
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
                activeFilterCount > 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                    <p>No stitching issues match these filters.</p>
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No stitching issues found</div>
                )
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue #</TableHead>
                      <TableHead>Work Order</TableHead>
                      <TableHead>{BUYER_STYLE_CODE_LABEL}</TableHead>
                      <TableHead>{STYLE_CODE_LABEL}</TableHead>
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
                          <StyleIdentity
                            style={issue.workOrder?.style}
                            name={issue.workOrder?.style?.styleName}
                            layout="stacked"
                            showStyleCode={false}
                            fallback="-"
                          />
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{ourStyleCode(issue.workOrder?.style)}</span>
                        </TableCell>
                        <TableCell>{issue.contractor?.name || issue.manager?.name || '-'}</TableCell>
                        <TableCell>{issue.startDate ? formatDate(new Date(issue.startDate)) : '—'}</TableCell>
                        <TableCell>{issue.endDate ? formatDate(new Date(issue.endDate)) : '—'}</TableCell>
                        <TableCell className="text-center">
                          {issue.startDate && issue.endDate ? (
                            Math.max(1, differenceInCalendarDays(new Date(issue.endDate), new Date(issue.startDate)))
                          ) : issue.startDate ? (
                            <span>
                              {Math.max(1, differenceInCalendarDays(new Date(), new Date(issue.startDate)))}
                              <span className="ml-1 text-xs text-muted-foreground">running</span>
                            </span>
                          ) : (
                            '—'
                          )}
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
                            {/* Complete needs recorded output (the server's rule) — open the issue to record it */}
                            {issue.status === 'IN_PROGRESS' &&
                              stitchingOutputTotals(issue).good + stitchingOutputTotals(issue).defect > 0 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setCompleting(issue)}
                                  title="Complete Stitching"
                                >
                                  <CheckCircle className="h-4 w-4 text-success" />
                                </Button>
                              )}
                            {/* An issue whose pieces all came out defective has nothing to send */}
                            {issue.status === 'COMPLETED' &&
                              !issue.transferSlip &&
                              stitchingOutputTotals(issue).good > 0 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleGenerateTransferSlip(issue.id)}
                                  title="Issue to Finishing"
                                >
                                  <Truck className="h-4 w-4 text-accent" />
                                </Button>
                              )}
                            {issue.transferSlip && (
                              <Badge variant="outline" className="text-xs" title="Sent to finishing on this slip">
                                {issue.transferSlip.slipNumber}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Pagination */}
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={total}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                pageSizeOptions={[20, 50, 100]}
                itemLabel="issues"
              />
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
                              <Badge variant="outline">
                                {slip.totalGoodPieces < slip.sentPieces
                                  ? `${slip.totalGoodPieces} of ${slip.sentPieces} pcs left`
                                  : `${slip.totalGoodPieces} pcs`}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              <span className="font-medium">{slip.workOrderNumber}</span>
                              {' — '}
                              <StyleIdentity style={slip} name={slip.styleName} codeClassName="text-foreground" />
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Transferred: {formatDate(new Date(slip.transferDate))}
                              {slip.issuedTo && ` • Contractor: ${slip.issuedTo}`}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => navigate(`/manufacturing/stitching/new?transferSlipId=${slip.id}`)}
                          >
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
                                <TableHead className="text-right">Left to Issue</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {/* The server returns the sizes in size order */}
                              {slip.skuBreakdown.map((sku) => (
                                <TableRow key={`${sku.colorId ?? ''}|${sku.sizeId}`}>
                                  {slip.skuBreakdown.some((s) => s.colorId) && <TableCell>{sku.colorName}</TableCell>}
                                  <TableCell>{sku.sizeName}</TableCell>
                                  <TableCell className="text-right font-medium">
                                    {sku.quantity}
                                    {sku.quantity < sku.sentQty && (
                                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                                        of {sku.sentQty}
                                      </span>
                                    )}
                                  </TableCell>
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
            <div className="text-center py-8 text-muted-foreground">Nothing in stitching or waiting from cutting</div>
          ) : (
            sizeSummary.map((item) => (
              <Card key={item.workOrderId}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold">{buyerStyleCode(item)}</span>
                        {styleCodeIfDifferent(item) && (
                          <span className="text-sm text-muted-foreground">
                            {STYLE_CODE_LABEL}:{' '}
                            <span className="font-medium text-foreground">{ourStyleCode(item)}</span>
                          </span>
                        )}
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
                      {item.daysInStitching > 0 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Clock className="h-3 w-3" />
                          Stitching: {item.daysInStitching}d
                        </Badge>
                      )}
                      {item.daysPendingPush !== null && item.daysPendingPush > 0 && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Idle: {item.daysPendingPush}d
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm mt-2">
                    <span className="text-muted-foreground">
                      Waiting: <strong>{item.totalWaiting}</strong>
                    </span>
                    <span className="text-info">
                      With contractor: <strong>{item.totalWithContractor}</strong>
                    </span>
                    <span className="text-success">
                      Stitched: <strong>{item.totalStitched}</strong>
                    </span>
                    {item.totalDefects > 0 && (
                      <span className="text-destructive">
                        Defects: <strong>{item.totalDefects}</strong>
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right" title="Cut and on slips from cutting, not yet issued">
                          Waiting
                        </TableHead>
                        <TableHead className="text-right">Issued</TableHead>
                        <TableHead className="text-right" title="Issued and not yet recorded">
                          With Contractor
                        </TableHead>
                        <TableHead className="text-right">Stitched</TableHead>
                        <TableHead className="text-right">Defects</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {item.sizes.map((size) => (
                        <TableRow key={size.sizeId}>
                          <TableCell className="font-medium">{size.sizeName}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{size.waiting || '-'}</TableCell>
                          <TableCell className="text-right">{size.issued || '-'}</TableCell>
                          <TableCell className="text-right text-info font-medium">
                            {size.withContractor || '-'}
                          </TableCell>
                          <TableCell className="text-right text-success font-medium">{size.stitched || '-'}</TableCell>
                          <TableCell className="text-right text-destructive">{size.defects || '-'}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold border-t-2">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right text-muted-foreground">{item.totalWaiting}</TableCell>
                        <TableCell className="text-right">{item.totalIssued}</TableCell>
                        <TableCell className="text-right text-info">{item.totalWithContractor}</TableCell>
                        <TableCell className="text-right text-success">{item.totalStitched}</TableCell>
                        <TableCell className="text-right text-destructive">{item.totalDefects}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <CompleteStitchingDialog
        issue={completing}
        onOpenChange={(open) => !open && setCompleting(null)}
        onCompleted={fetchIssuesData}
      />
    </div>
  );
}
