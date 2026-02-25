import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { sampleService } from '@/services/sample.service';
import type { Sample, SampleType, SampleStatus, SampleSummary } from '@/types/sample.types';
import { SampleTypeLabels, SampleStatusLabels, SampleStatusColors } from '@/types/sample.types';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import {
  TestTube,
  Plus,
  Eye,
  Pencil,
  Trash2,
  RefreshCcw,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle,
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

export default function SampleList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [samples, setSamples] = useState<Sample[]>([]);
  const [summary, setSummary] = useState<SampleSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.get('type') || 'all');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sampleToDelete, setSampleToDelete] = useState<{ id: string; number: string } | null>(null);

  useEffect(() => {
    fetchSamples();
    fetchSummary();
  }, [currentPage, pageSize, searchQuery, typeFilter, statusFilter]);

  const fetchSamples = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await sampleService.getAllSamples({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        sampleType: typeFilter !== 'all' ? (typeFilter as SampleType) : undefined,
        status: statusFilter !== 'all' ? (statusFilter as SampleStatus) : undefined,
      });
      setSamples(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load samples', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const summaryData = await sampleService.getSummary();
      setSummary(summaryData);
    } catch (err) {
      // Non-critical, don't show error
      console.error('Failed to load summary:', err);
    }
  };

  const handleDeleteClick = (id: string, sampleNumber: string) => {
    setSampleToDelete({ id, number: sampleNumber });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!sampleToDelete) return;

    try {
      await sampleService.deleteSample(sampleToDelete.id);
      handleApiSuccess('Sample deleted', `${sampleToDelete.number} has been successfully deleted.`);
      fetchSamples();
      fetchSummary();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete sample');
    } finally {
      setSampleToDelete(null);
    }
  };

  const handleTypeFilterChange = (value: string) => {
    setTypeFilter(value);
    setCurrentPage(1);
    if (value !== 'all') {
      searchParams.set('type', value);
    } else {
      searchParams.delete('type');
    }
    setSearchParams(searchParams);
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

  const isOverdue = (sample: Sample) => {
    if (['APPROVED', 'APPROVED_WITH_COMMENTS', 'REJECTED'].includes(sample.status)) {
      return false;
    }
    return new Date(sample.requiredDate) < new Date();
  };

  // Define columns for DataTable
  const columns: Column<Sample>[] = [
    {
      key: 'sampleNumber',
      header: 'Sample #',
      render: (item) => (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {item.sampleNumber}
          </Badge>
          {isOverdue(item) && (
            <span title="Overdue">
              <AlertCircle className="h-4 w-4 text-red-500" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'sampleType',
      header: 'Type',
      render: (item) => (
        <Badge variant="secondary" className="text-xs">
          {SampleTypeLabels[item.sampleType] || item.sampleType}
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
            <span className="text-gray-400">No style</span>
          )}
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (item) => (
        <div className="text-sm text-gray-700">{item.customer?.name || '-'}</div>
      ),
    },
    {
      key: 'requiredDate',
      header: 'Required By',
      render: (item) => (
        <div className={`text-sm ${isOverdue(item) ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
          {formatDate(item.requiredDate)}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <Badge className={SampleStatusColors[item.status] || ''}>
          {SampleStatusLabels[item.status] || item.status}
        </Badge>
      ),
    },
    {
      key: 'version',
      header: 'Ver.',
      render: (item) => (
        <div className="text-sm text-gray-700">
          {item.sampleType === 'FIT_SAMPLE' ? `v${item.version}` : '-'}
        </div>
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
              navigate(`/samples/${item.id}`);
            }}
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/samples/${item.id}/edit`);
            }}
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {!['APPROVED', 'APPROVED_WITH_COMMENTS'].includes(item.status) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(item.id, item.sampleNumber);
              }}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
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
          <TestTube className="h-8 w-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sample Tracking</h1>
            <p className="text-gray-500">Manage FIT, PP, Size Set, and Shipment samples</p>
          </div>
        </div>
        <Button onClick={() => navigate('/samples/new')} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Sample
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TestTube className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Samples</p>
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
                  <p className="text-sm text-gray-500">Pending Approval</p>
                  <p className="text-2xl font-bold">{summary.pendingApproval}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Overdue</p>
                  <p className="text-2xl font-bold text-red-600">{summary.overdue}</p>
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
                  <p className="text-sm text-gray-500">Approved</p>
                  <p className="text-2xl font-bold text-green-600">
                    {summary.byStatus.find((s) => s.status === 'APPROVED')?.count || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
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
                placeholder="Search samples..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>
            <div className="w-48">
              <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sample Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="FIT_SAMPLE">FIT Sample</SelectItem>
                  <SelectItem value="PP_SAMPLE">PP Sample</SelectItem>
                  <SelectItem value="SIZE_SET_SAMPLE">Size Set Sample</SelectItem>
                  <SelectItem value="SHIPMENT_SAMPLE">Shipment Sample</SelectItem>
                  <SelectItem value="PHOTO_SAMPLE">Photoshoot Sample</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="REQUESTED">Requested</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="FEEDBACK_PENDING">Feedback Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="REVISION_NEEDED">Revision Needed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
                setStatusFilter('all');
                setSearchParams(new URLSearchParams());
              }}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600">{error}</p>
              <Button variant="outline" onClick={fetchSamples} className="mt-4">
                Try Again
              </Button>
            </div>
          ) : (
            <DataTable<Sample>
              columns={columns}
              data={samples}
              keyExtractor={(sample) => sample.id}
              loading={isLoading}
              onRowClick={(sample) => navigate(`/samples/${sample.id}`)}
              emptyState={{
                title: 'No samples found',
                description: 'Get started by creating a new sample',
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setSampleToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Sample"
        description={`Are you sure you want to delete sample "${sampleToDelete?.number}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
