import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Scissors, Plus, X, Eye, Play, CheckCircle, Package, RefreshCw, Clock, AlertTriangle } from 'lucide-react';
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
import { cuttingBatchService, cuttingSummaryService } from '@/services/cutting.service';
import type {
  CuttingBatch,
  CuttingBatchStatus,
  CuttingSummary,
  CuttingStyleSizeSummaryItem,
} from '@/types/cutting.types';
import { CuttingBatchStatusLabels, CuttingBatchStatusColors } from '@/types/cutting.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { differenceInCalendarDays } from 'date-fns';
import { formatDate } from '@/lib/date';
import { StyleIdentity } from '@/components/StyleIdentity';
import {
  BUYER_STYLE_CODE_LABEL,
  STYLE_CODE_LABEL,
  buyerStyleCode,
  ourStyleCode,
  styleCodeIfDifferent,
} from '@/lib/style-code';

export default function CuttingList() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Scope the list to a work order when arriving from a work-order drill-down link
  const workOrderId = searchParams.get('workOrderId') || '';
  const [batches, setBatches] = useState<CuttingBatch[]>([]);
  const [summary, setSummary] = useState<CuttingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('batches');
  const [sizeSummary, setSizeSummary] = useState<CuttingStyleSizeSummaryItem[]>([]);
  const [sizeLoading, setSizeLoading] = useState(false);

  const fetchSizeSummary = async () => {
    try {
      setSizeLoading(true);
      const data = await cuttingSummaryService.getStyleSizeSummary();
      setSizeSummary(data);
    } catch (error) {
      handleApiError(error, 'Failed to load size-wise status');
    } finally {
      setSizeLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [batchesRes, summaryRes] = await Promise.all([
        cuttingBatchService.getAll({
          page,
          limit: pageSize,
          search: search || undefined,
          status: (statusFilter as CuttingBatchStatus) || undefined,
          workOrderId: workOrderId || undefined,
        }),
        cuttingSummaryService.getSummary(),
      ]);
      setBatches(batchesRes.data);
      setTotalPages(batchesRes.pagination.totalPages);
      setTotal(batchesRes.pagination.total);
      setSummary(summaryRes);
    } catch (error) {
      console.error('Error fetching cutting data:', error);
      handleApiError(error, 'Failed to load cutting batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search, statusFilter, workOrderId]);

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
    await fetchData();
    if (activeTab === 'sizewise') await fetchSizeSummary();
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (activeTab === 'sizewise' && sizeSummary.length === 0) {
      fetchSizeSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleStartBatch = async (id: string) => {
    try {
      await cuttingBatchService.start(id);
      handleApiSuccess('Success', 'Batch started successfully');
      fetchData();
    } catch (error) {
      handleApiError(error, 'Failed to start batch');
    }
  };

  const handleCompleteBatch = async (id: string) => {
    try {
      await cuttingBatchService.complete(id);
      handleApiSuccess('Success', 'Batch completed successfully');
      fetchData();
    } catch (error) {
      handleApiError(error, 'Failed to complete batch');
    }
  };

  const getStatusBadge = (status: CuttingBatchStatus) => (
    <Badge className={CuttingBatchStatusColors[status]}>{CuttingBatchStatusLabels[status]}</Badge>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Scissors className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-display font-medium">Cutting</h1>
            <p className="text-muted-foreground">Manage cutting batches and track fabric consumption</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button asChild>
            <Link to="/manufacturing/cutting/new">
              <Plus className="h-4 w-4 mr-2" />
              New Batch
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="batches">Cutting Batches</TabsTrigger>
          <TabsTrigger value="sizewise">Size-wise Status</TabsTrigger>
        </TabsList>

        <TabsContent value="batches" className="space-y-6">
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Batches</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-muted-foreground">{summary.pending}</div>
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
                  <CardTitle className="text-sm font-medium text-muted-foreground">Fabric Used (m)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{summary.totalFabricConsumed.toFixed(1)}</div>
                </CardContent>
              </Card>
            </div>
          )}

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
                  placeholder="Search batch number, run number, buyer style code, style, component…"
                  value={search}
                  onChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  // The API refuses a longer search (max 100)
                  maxLength={100}
                  aria-label="Search cutting batches"
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
                    <SelectItem value="PENDING">{CuttingBatchStatusLabels.PENDING}</SelectItem>
                    <SelectItem value="IN_PROGRESS">{CuttingBatchStatusLabels.IN_PROGRESS}</SelectItem>
                    <SelectItem value="COMPLETED">{CuttingBatchStatusLabels.COMPLETED}</SelectItem>
                    <SelectItem value="ON_HOLD">{CuttingBatchStatusLabels.ON_HOLD}</SelectItem>
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

          {/* Batches Table */}
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : batches.length === 0 ? (
                activeFilterCount > 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                    <p>No cutting batches match these filters.</p>
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No cutting batches found</div>
                )
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch #</TableHead>
                      <TableHead>Work Order</TableHead>
                      <TableHead>{BUYER_STYLE_CODE_LABEL}</TableHead>
                      <TableHead>{STYLE_CODE_LABEL}</TableHead>
                      <TableHead>Component</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead className="text-center">Days</TableHead>
                      <TableHead className="text-right">Layers</TableHead>
                      <TableHead className="text-right">Fabric (m)</TableHead>
                      <TableHead className="text-right">Actual Avg</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                        <TableCell>{batch.workOrder?.workOrderNumber || '-'}</TableCell>
                        <TableCell>
                          <StyleIdentity
                            style={batch.workOrder?.style}
                            name={batch.workOrder?.style?.styleName}
                            layout="stacked"
                            showStyleCode={false}
                            fallback="-"
                          />
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{ourStyleCode(batch.workOrder?.style)}</span>
                        </TableCell>
                        <TableCell>{batch.component?.componentName || '—'}</TableCell>
                        <TableCell>{batch.startedAt ? formatDate(new Date(batch.startedAt)) : '—'}</TableCell>
                        <TableCell>{batch.completedAt ? formatDate(new Date(batch.completedAt)) : '—'}</TableCell>
                        <TableCell className="text-center">
                          {batch.startedAt && batch.completedAt
                            ? Math.max(
                                1,
                                differenceInCalendarDays(new Date(batch.completedAt), new Date(batch.startedAt))
                              )
                            : batch.startedAt
                              ? `${Math.max(1, differenceInCalendarDays(new Date(), new Date(batch.startedAt)))}...`
                              : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {batch.layersPerLay} × {batch.numberOfLays}
                        </TableCell>
                        <TableCell className="text-right">{batch.fabricConsumed?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell className="text-right">
                          {batch.status === 'COMPLETED' && batch.actualAverage ? (
                            <span
                              className={
                                batch.variancePercent != null && batch.variancePercent > 0
                                  ? 'text-destructive font-medium'
                                  : batch.variancePercent != null && batch.variancePercent < 0
                                    ? 'text-success font-medium'
                                    : 'font-medium'
                              }
                            >
                              {batch.actualAverage.toFixed(4)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(batch.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" asChild>
                              <Link to={`/manufacturing/cutting/${batch.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            {batch.status === 'PENDING' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStartBatch(batch.id)}
                                title="Start Cutting"
                              >
                                <Play className="h-4 w-4 text-info" />
                              </Button>
                            )}
                            {batch.status === 'IN_PROGRESS' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCompleteBatch(batch.id)}
                                  title="Complete Batch"
                                >
                                  <CheckCircle className="h-4 w-4 text-success" />
                                </Button>
                              </>
                            )}
                            {batch.status === 'COMPLETED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Generate Transfer Slip"
                                onClick={async () => {
                                  try {
                                    const result = await cuttingBatchService.generateTransferSlip(batch.id);
                                    handleApiSuccess('Transfer Slip Generated', `Slip ${result.slipNumber} created.`);
                                    fetchData();
                                  } catch (error) {
                                    handleApiError(error, 'Failed to generate transfer slip');
                                  }
                                }}
                              >
                                <Package className="h-4 w-4 text-accent" />
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
                itemLabel="batches"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Size-wise Status Tab */}
        <TabsContent value="sizewise" className="space-y-4">
          {sizeLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sizeSummary.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No active cutting batches to display</div>
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
                      <Badge variant="outline" className="text-xs gap-1">
                        <Clock className="h-3 w-3" />
                        Cutting: {item.daysInCutting}d
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
                      Planned: <strong>{item.totalPlanned}</strong>
                    </span>
                    <span className="text-info">
                      Cut: <strong>{item.totalCut}</strong>
                    </span>
                    <span className="text-success">
                      Good: <strong>{item.totalGoodPcs}</strong>
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right">Planned</TableHead>
                        <TableHead className="text-right">Cut</TableHead>
                        <TableHead className="text-right">Good Pcs</TableHead>
                        <TableHead className="text-right">Pending</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {item.sizes.map((size) => (
                        <TableRow key={size.sizeId}>
                          <TableCell className="font-medium">{size.sizeName}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{size.planned || '-'}</TableCell>
                          <TableCell className="text-right text-info font-medium">{size.cut || '-'}</TableCell>
                          <TableCell className="text-right text-success font-medium">{size.goodPcs || '-'}</TableCell>
                          <TableCell className="text-right text-primary font-medium">{size.pending || '-'}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold border-t-2">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right text-muted-foreground">{item.totalPlanned}</TableCell>
                        <TableCell className="text-right text-info">{item.totalCut}</TableCell>
                        <TableCell className="text-right text-success">{item.totalGoodPcs}</TableCell>
                        <TableCell className="text-right text-primary">
                          {item.sizes.reduce((sum, s) => sum + s.pending, 0)}
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
