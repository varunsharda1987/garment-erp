import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { printingService } from '@/services/printing.service';
import type {
  LabDip,
  JobWorkOrder,
  LabDipStatus,
  JobWorkStatus,
  PrintingSummary,
} from '@/types/printing.types';
import {
  LabDipStatusLabels,
  LabDipStatusColors,
  JobWorkStatusLabels,
  JobWorkStatusColors,
  PrintMethodLabels,
  PrintChemistryLabels,
} from '@/types/printing.types';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import {
  Printer,
  Plus,
  Eye,
  Pencil,
  Trash2,
  RefreshCcw,
  Filter,
  Droplets,
  Send,
  Package,
  CheckCircle,
  Clock,
  Factory,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Local type definition for DataTable
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function PrintingList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'lab-dips' | 'jobs'>(
    (searchParams.get('tab') as 'lab-dips' | 'jobs') || 'lab-dips'
  );
  const [labDips, setLabDips] = useState<LabDip[]>([]);
  const [jobs, setJobs] = useState<JobWorkOrder[]>([]);
  const [summary, setSummary] = useState<PrintingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get('status') || 'all'
  );

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; number: string; type: 'labDip' | 'job' } | null>(null);

  useEffect(() => {
    if (activeTab === 'lab-dips') {
      fetchLabDips();
    } else {
      fetchJobs();
    }
    fetchSummary();
  }, [activeTab, currentPage, pageSize, searchQuery, statusFilter]);

  const fetchLabDips = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await printingService.labDips.getAllLabDips({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? (statusFilter as LabDipStatus) : undefined,
      });
      setLabDips(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load lab dips', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await printingService.jobs.getAllPrintJobs({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? (statusFilter as JobWorkStatus) : undefined,
      });
      setJobs(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load print jobs', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const summaryData = await printingService.summary.getSummary();
      setSummary(summaryData);
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'lab-dips' | 'jobs');
    setCurrentPage(1);
    setStatusFilter('all');
    searchParams.set('tab', value);
    searchParams.delete('status');
    setSearchParams(searchParams);
  };

  const handleDeleteClick = (id: string, number: string, type: 'labDip' | 'job') => {
    setItemToDelete({ id, number, type });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.type === 'labDip') {
        await printingService.labDips.deleteLabDip(itemToDelete.id);
        handleApiSuccess('Lab Dip deleted', `${itemToDelete.number} has been successfully deleted.`);
        fetchLabDips();
      } else {
        await printingService.jobs.deletePrintJob(itemToDelete.id);
        handleApiSuccess('Print Job deleted', `${itemToDelete.number} has been successfully deleted.`);
        fetchJobs();
      }
      fetchSummary();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete item');
    } finally {
      setItemToDelete(null);
    }
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
    if (value !== 'all') {
      searchParams.set('status', value);
    } else {
      searchParams.delete('status');
    }
    setSearchParams(searchParams);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Lab Dip columns
  const labDipColumns: Column<LabDip>[] = [
    {
      key: 'labDipNumber',
      header: 'Lab Dip #',
      render: (item) => (
        <Badge variant="outline" className="font-mono text-xs">
          {item.labDipNumber}
        </Badge>
      ),
    },
    {
      key: 'style',
      header: 'Style',
      render: (item) => (
        <div>
          {item.style ? (
            <>
              <div className="text-sm font-medium text-gray-900">{item.style.styleCode}</div>
              <div className="text-xs text-gray-500 line-clamp-1">{item.style.styleName}</div>
            </>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'fabric',
      header: 'Fabric',
      render: (item) => (
        <div className="text-sm text-gray-700">
          {item.fabric?.fabricCode || '-'}
        </div>
      ),
    },
    {
      key: 'printDetails',
      header: 'Print Details',
      render: (item) => (
        <div className="text-sm">
          {item.printMethod && (
            <div className="text-gray-700">{PrintMethodLabels[item.printMethod]}</div>
          )}
          {item.printChemistry && (
            <div className="text-xs text-gray-500">{PrintChemistryLabels[item.printChemistry]}</div>
          )}
        </div>
      ),
    },
    {
      key: 'mill',
      header: 'Mill',
      render: (item) => (
        <div className="text-sm text-gray-700">{item.mill?.name || '-'}</div>
      ),
    },
    {
      key: 'submissionDate',
      header: 'Submitted',
      render: (item) => (
        <div className="text-sm text-gray-700">{formatDate(item.submissionDate)}</div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <Badge className={LabDipStatusColors[item.status] || ''}>
          {LabDipStatusLabels[item.status] || item.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/manufacturing/printing/lab-dip/${item.id}`);
            }}
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {item.status !== 'APPROVED' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/manufacturing/printing/lab-dip/${item.id}/edit`);
                }}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(item.id, item.labDipNumber, 'labDip');
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  // Job columns
  const jobColumns: Column<JobWorkOrder>[] = [
    {
      key: 'jobWorkNumber',
      header: 'Job #',
      render: (item) => (
        <Badge variant="outline" className="font-mono text-xs">
          {item.jobWorkNumber}
        </Badge>
      ),
    },
    {
      key: 'style',
      header: 'Style',
      render: (item) => (
        <div>
          {item.style ? (
            <>
              <div className="text-sm font-medium text-gray-900">{item.style.styleCode}</div>
              <div className="text-xs text-gray-500 line-clamp-1">{item.style.styleName}</div>
            </>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'fabricType',
      header: 'Fabric Type',
      render: (item) => (
        <Badge variant="secondary" className="text-xs">
          {item.fabricType}
        </Badge>
      ),
    },
    {
      key: 'mill',
      header: 'Mill',
      render: (item) => (
        <div className="text-sm text-gray-700">{item.mill?.name || '-'}</div>
      ),
    },
    {
      key: 'qty',
      header: 'Qty (mtrs)',
      render: (item) => (
        <div className="text-sm">
          <div className="text-gray-700">{item.qtySentMeters?.toFixed(2) || '-'}</div>
          {item.qtyReceivedMeters && (
            <div className="text-xs text-gray-500">
              Received: {item.qtyReceivedMeters?.toFixed(2)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'sentDate',
      header: 'Sent',
      render: (item) => (
        <div className="text-sm text-gray-700">{formatDate(item.sentDate)}</div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <Badge className={JobWorkStatusColors[item.status] || ''}>
          {JobWorkStatusLabels[item.status] || item.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/manufacturing/printing/job/${item.id}`);
            }}
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {!item.sentDate && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/manufacturing/printing/job/${item.id}/edit`);
                }}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(item.id, item.jobWorkNumber, 'job');
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Printer className="h-8 w-8 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Printing</h1>
            <p className="text-gray-500">Manage lab dips and print jobs</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('/manufacturing/printing/lab-dip/new')}
          >
            <Droplets className="h-4 w-4 mr-2" />
            New Lab Dip
          </Button>
          <Button onClick={() => navigate('/manufacturing/printing/job/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Print Job
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Printer className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Jobs</p>
                  <p className="text-2xl font-bold">{summary.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Lab Dips Pending</p>
                  <p className="text-2xl font-bold">{summary.labDipsPending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Factory className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">At Mill</p>
                  <p className="text-2xl font-bold text-indigo-600">{summary.atMill}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-100 rounded-lg">
                  <Package className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Received</p>
                  <p className="text-2xl font-bold text-teal-600">{summary.received}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">QC Checked</p>
                  <p className="text-2xl font-bold text-green-600">{summary.qualityChecked}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="lab-dips" className="flex items-center gap-2">
            <Droplets className="h-4 w-4" />
            Lab Dips
          </TabsTrigger>
          <TabsTrigger value="jobs" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Print Jobs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lab-dips" className="mt-4">
          {/* Filters */}
          <Card className="mb-4">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="w-64">
                  <SearchInput
                    placeholder="Search lab dips..."
                    value={searchQuery}
                    onChange={setSearchQuery}
                  />
                </div>
                <div className="w-48">
                  <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="SUBMITTED">Submitted</SelectItem>
                      <SelectItem value="APPROVED">Approved</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                      <SelectItem value="RESUBMIT">Resubmit Needed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    searchParams.delete('status');
                    setSearchParams(searchParams);
                  }}
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lab Dips Table */}
          <Card>
            <CardContent className="p-0">
              {error ? (
                <div className="p-8 text-center">
                  <p className="text-red-600">{error}</p>
                  <Button variant="outline" onClick={fetchLabDips} className="mt-4">
                    Try Again
                  </Button>
                </div>
              ) : (
                <DataTable<LabDip>
                  columns={labDipColumns}
                  data={labDips}
                  keyExtractor={(item) => item.id}
                  loading={isLoading}
                  onRowClick={(item) => navigate(`/manufacturing/printing/lab-dip/${item.id}`)}
                  emptyState={{
                    title: 'No lab dips found',
                    description: 'Get started by creating a new lab dip',
                  }}
                  pagination={{
                    currentPage,
                    totalPages,
                    pageSize,
                    totalItems,
                    onPageChange: setCurrentPage,
                    onPageSizeChange: setPageSize,
                  }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="mt-4">
          {/* Filters */}
          <Card className="mb-4">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="w-64">
                  <SearchInput
                    placeholder="Search jobs..."
                    value={searchQuery}
                    onChange={setSearchQuery}
                  />
                </div>
                <div className="w-48">
                  <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="READY_TO_SEND">Ready to Send</SelectItem>
                      <SelectItem value="SENT_TO_MILL">Sent to Mill</SelectItem>
                      <SelectItem value="AT_MILL">At Mill</SelectItem>
                      <SelectItem value="RECEIVED">Received</SelectItem>
                      <SelectItem value="QUALITY_CHECKED">Quality Checked</SelectItem>
                      <SelectItem value="STOCK_UPDATED">Stock Updated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    searchParams.delete('status');
                    setSearchParams(searchParams);
                  }}
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Jobs Table */}
          <Card>
            <CardContent className="p-0">
              {error ? (
                <div className="p-8 text-center">
                  <p className="text-red-600">{error}</p>
                  <Button variant="outline" onClick={fetchJobs} className="mt-4">
                    Try Again
                  </Button>
                </div>
              ) : (
                <DataTable<JobWorkOrder>
                  columns={jobColumns}
                  data={jobs}
                  keyExtractor={(item) => item.id}
                  loading={isLoading}
                  onRowClick={(item) => navigate(`/manufacturing/printing/job/${item.id}`)}
                  emptyState={{
                    title: 'No print jobs found',
                    description: 'Get started by creating a new print job',
                  }}
                  pagination={{
                    currentPage,
                    totalPages,
                    pageSize,
                    totalItems,
                    onPageChange: setCurrentPage,
                    onPageSizeChange: setPageSize,
                  }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setItemToDelete(null);
        }}
        onConfirm={confirmDelete}
        title={`Delete ${itemToDelete?.type === 'labDip' ? 'Lab Dip' : 'Print Job'}`}
        description={`Are you sure you want to delete "${itemToDelete?.number}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
