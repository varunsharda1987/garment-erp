import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
import { finishingIssueService, finishingSummaryService } from '@/services/finishing.service';
import type {
  FinishingIssue,
  FinishingStatus,
  FinishingSummary,
} from '@/types/finishing.types';
import {
  FinishingStatusLabels,
  FinishingStatusColors,
} from '@/types/finishing.types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function FinishingList() {
  const { toast } = useToast();
  const [issues, setIssues] = useState<FinishingIssue[]>([]);
  const [summary, setSummary] = useState<FinishingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

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
      toast({
        title: 'Error',
        description: 'Failed to load finishing issues',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

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

  const handleReceive = async (id: string) => {
    try {
      await finishingIssueService.receive(id, { transferSlipId: '', skuReceived: [] });
      toast({ title: 'Success', description: 'Items received successfully' });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to receive items', variant: 'destructive' });
    }
  };

  const handleStart = async (id: string) => {
    try {
      await finishingIssueService.start(id);
      toast({ title: 'Success', description: 'Finishing started successfully' });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to start finishing', variant: 'destructive' });
    }
  };

  const handleMoveToPacking = async (id: string) => {
    try {
      await finishingIssueService.moveToPacking(id);
      toast({ title: 'Success', description: 'Moved to packing successfully' });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to move to packing', variant: 'destructive' });
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await finishingIssueService.complete(id);
      toast({ title: 'Success', description: 'Finishing completed successfully' });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to complete finishing', variant: 'destructive' });
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
                  <TableHead>Manager</TableHead>
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
                      {issue.manager?.name || '-'}
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
    </div>
  );
}
