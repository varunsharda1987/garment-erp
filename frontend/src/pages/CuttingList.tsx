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
  Pause,
  Package,
  RefreshCw,
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
import { cuttingBatchService, cuttingSummaryService } from '@/services/cutting.service';
import type {
  CuttingBatch,
  CuttingBatchStatus,
  CuttingSummary,
} from '@/types/cutting.types';
import {
  CuttingBatchStatusLabels,
  CuttingBatchStatusColors,
} from '@/types/cutting.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { format } from 'date-fns';

export default function CuttingList() {
  const [batches, setBatches] = useState<CuttingBatch[]>([]);
  const [summary, setSummary] = useState<CuttingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [batchesRes, summaryRes] = await Promise.all([
        cuttingBatchService.getAll({
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter as CuttingBatchStatus || undefined,
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
  }, [page, statusFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

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
    <Badge className={CuttingBatchStatusColors[status]}>
      {CuttingBatchStatusLabels[status]}
    </Badge>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Scissors className="h-8 w-8 text-orange-600" />
          <div>
            <h1 className="text-2xl font-bold">Cutting</h1>
            <p className="text-muted-foreground">
              Manage cutting batches and track fabric consumption
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
            <Link to="/manufacturing/cutting/new">
              <Plus className="h-4 w-4 mr-2" />
              New Batch
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Batches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{summary.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{summary.inProgress}</div>
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
                Fabric Used (m)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {summary.totalFabricConsumed.toFixed(1)}
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
            <div className="text-center py-8 text-muted-foreground">
              No cutting batches found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Work Order</TableHead>
                  <TableHead>Style</TableHead>
                  <TableHead>Component</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Layers</TableHead>
                  <TableHead className="text-right">Fabric (m)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                    <TableCell>
                      {batch.workOrder?.workOrderNumber || '-'}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {batch.workOrder?.style?.styleCode || '-'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {batch.workOrder?.style?.styleName || ''}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {batch.component?.componentName || 'Main'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(batch.cuttingDate), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      {batch.layersPerLay} × {batch.numberOfLays}
                    </TableCell>
                    <TableCell className="text-right">
                      {batch.fabricConsumed?.toFixed(2) || '0.00'}
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
                            <Play className="h-4 w-4 text-blue-600" />
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
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          </>
                        )}
                        {batch.status === 'COMPLETED' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Generate Transfer Slip"
                          >
                            <Package className="h-4 w-4 text-purple-600" />
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
    </div>
  );
}
