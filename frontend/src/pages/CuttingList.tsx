import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Scissors,
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
import { cuttingBatchService, cuttingSummaryService } from '@/services/cutting.service';
import type {
  CuttingBatch,
  CuttingBatchStatus,
  CuttingSummary,
  CuttingStyleSizeSummaryItem,
} from '@/types/cutting.types';
import { CuttingBatchStatusLabels, CuttingBatchStatusColors } from '@/types/cutting.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { format, differenceInCalendarDays } from 'date-fns';

export default function CuttingList() {
  const [batches, setBatches] = useState<CuttingBatch[]>([]);
  const [summary, setSummary] = useState<CuttingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
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
          limit: 20,
          search: search || undefined,
          status: (statusFilter as CuttingBatchStatus) || undefined,
        }),
        cuttingSummaryService.getSummary(),
      ]);
      setBatches(batchesRes.data);
      setTotalPages(batchesRes.pagination.totalPages);
      setSummary(summaryRes);
    } catch (error) {
      console.error('Error fetching cutting data:', error);
      handleApiError(error, 'Failed to load cutting batches');
    } finally {
      setLoading(false);
    }
  };

  // Reset to page 1 when status filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchData();
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
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by batch number, work order, or style..."
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
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="ON_HOLD">On Hold</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleSearch}>Search</Button>
              </div>
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
                <div className="text-center py-8 text-muted-foreground">No cutting batches found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch #</TableHead>
                      <TableHead>Work Order</TableHead>
                      <TableHead>Style</TableHead>
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
                          <div>
                            <div className="font-medium">{batch.workOrder?.style?.styleCode || '-'}</div>
                            <div className="text-sm text-muted-foreground">
                              {batch.workOrder?.style?.styleName || ''}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{batch.component?.componentName || '—'}</TableCell>
                        <TableCell>
                          {batch.startedAt ? format(new Date(batch.startedAt), 'dd MMM yyyy') : '—'}
                        </TableCell>
                        <TableCell>
                          {batch.completedAt ? format(new Date(batch.completedAt), 'dd MMM yyyy') : '—'}
                        </TableCell>
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
