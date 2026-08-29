import { useEffect, useState, useMemo, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { sampleService } from '@/services/sample.service';
import type { Sample, SampleType, SampleStatus, SampleSummary } from '@/types/sample.types';
import { SampleTypeLabels, SampleStatusLabels, SampleStatusColors } from '@/types/sample.types';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { TestTube, Plus, Eye, Pencil, Trash2, RefreshCcw, Filter, Clock, AlertCircle, CheckCircle, Layers } from 'lucide-react';
import { SampleVersionBadge } from '@/components/SampleVersionBadge';
import { SampleSLABadge } from '@/components/SampleSLABadge';
import { CustomerCombobox } from '@/components/CustomerCombobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SampleQuickActionBar } from '@/components/samples/SampleQuickActionBar';
import { SamplePipelineIndicator } from '@/components/samples/SamplePipelineIndicator';

type GroupByMode = 'none' | 'type' | 'customer' | 'overdue';

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
  const [customerFilter, setCustomerFilter] = useState<string>(searchParams.get('customerId') || '');

  // Grouping and view state
  const [groupBy, setGroupBy] = useState<GroupByMode>('none');
  const [runningStylesOnly, setRunningStylesOnly] = useState(false);

  // Group samples based on groupBy mode
  const groupedSamples = useMemo(() => {
    if (groupBy === 'none') return null;

    const groups: Record<string, { label: string; samples: Sample[]; order: number }> = {};

    samples.forEach((sample) => {
      let groupKey: string;
      let groupLabel: string;
      let order: number;

      switch (groupBy) {
        case 'type':
          groupKey = sample.sampleType;
          groupLabel = SampleTypeLabels[sample.sampleType] || sample.sampleType;
          order = ['FIT_SAMPLE', 'PP_SAMPLE', 'SIZE_SET_SAMPLE', 'PHOTO_SAMPLE', 'PRODUCTION_SAMPLE', 'SHIPMENT_SAMPLE'].indexOf(sample.sampleType);
          break;
        case 'customer':
          groupKey = sample.customer?.id || 'no-customer';
          groupLabel = sample.customer?.name || 'No Customer';
          order = 0;
          break;
        case 'overdue':
          if (sample.slaStatus === 'DELAYED') {
            groupKey = 'overdue';
            groupLabel = 'Overdue';
            order = 0;
          } else if (sample.slaStatus === 'APPROACHING') {
            groupKey = 'approaching';
            groupLabel = 'Approaching Deadline';
            order = 1;
          } else if (sample.slaStatus === 'COMPLETED') {
            groupKey = 'completed';
            groupLabel = 'Completed';
            order = 3;
          } else {
            groupKey = 'on-time';
            groupLabel = 'On Time';
            order = 2;
          }
          break;
        default:
          return;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = { label: groupLabel, samples: [], order };
      }
      groups[groupKey].samples.push(sample);
    });

    return Object.entries(groups)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([key, group]) => ({ key, ...group }));
  }, [samples, groupBy]);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sampleToDelete, setSampleToDelete] = useState<{ id: string; number: string } | null>(null);

  useEffect(() => {
    fetchSamples();
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, searchQuery, typeFilter, statusFilter, customerFilter]);

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
        customerId: customerFilter || undefined,
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
          <SampleVersionBadge version={item.version} sampleType={item.sampleType} />
          {isOverdue(item) && (
            <span title="Overdue">
              <AlertCircle className="h-4 w-4 text-destructive" />
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
              <div className="text-sm font-medium text-foreground">{item.style.styleCode}</div>
              {item.style.buyerStyleRef && (
                <div className="text-xs text-muted-foreground line-clamp-1">({item.style.buyerStyleRef})</div>
              )}
              <div className="text-xs text-muted-foreground line-clamp-1">{item.style.styleName}</div>
            </>
          ) : (
            <span className="text-muted-foreground">No style</span>
          )}
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (item) => <div className="text-sm text-foreground">{item.customer?.name || '-'}</div>,
    },
    {
      key: 'requiredDate',
      header: 'Required By',
      render: (item) => (
        <div className={`text-sm ${isOverdue(item) ? 'text-destructive font-medium' : 'text-foreground'}`}>
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
      render: (item) => {
        const VERSIONED_TYPES = ['FIT_SAMPLE', 'PP_SAMPLE', 'SIZE_SET_SAMPLE'];
        if (!VERSIONED_TYPES.includes(item.sampleType)) {
          return <div className="text-sm text-muted-foreground">-</div>;
        }
        const version = item.version || 1;
        return (
          <div className={`text-sm ${version > 1 ? 'text-blue-600 font-medium' : 'text-foreground'}`}>
            v{version}
          </div>
        );
      },
    },
    {
      key: 'sla',
      header: 'SLA',
      render: (item) => <SampleSLABadge slaStatus={item.slaStatus} daysUntilDue={item.daysUntilDue} />,
    },
    {
      key: 'quickAction',
      header: 'Quick Action',
      render: (item) => (
        <div onClick={(e) => e.stopPropagation()}>
          <SampleQuickActionBar sample={item} onActionComplete={fetchSamples} compact />
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
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
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
          <TestTube className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-display font-medium text-foreground">Sample Tracking</h1>
            <p className="text-muted-foreground">Manage FIT, PP, Size Set, and Shipment samples</p>
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
                <div className="p-2 bg-info-muted rounded-lg">
                  <TestTube className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Samples</p>
                  <p className="text-2xl font-bold">{summary.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Approval</p>
                  <p className="text-2xl font-bold">{summary.pendingApproval}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold text-destructive">{summary.overdue}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success-muted rounded-lg">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-2xl font-bold text-success">
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
              <SearchInput placeholder="Search samples..." value={searchQuery} onChange={setSearchQuery} />
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
            <div className="w-56">
              <CustomerCombobox
                value={customerFilter}
                onValueChange={setCustomerFilter}
                placeholder="All Customers"
              />
            </div>
            <div className="w-48">
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByMode)}>
                <SelectTrigger>
                  <Layers className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Group By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Grouping</SelectItem>
                  <SelectItem value="type">By Sample Type</SelectItem>
                  <SelectItem value="customer">By Customer</SelectItem>
                  <SelectItem value="overdue">Overdue First</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 px-2">
              <Checkbox
                id="runningStyles"
                checked={runningStylesOnly}
                onCheckedChange={(checked) => setRunningStylesOnly(checked === true)}
              />
              <Label htmlFor="runningStyles" className="text-sm cursor-pointer">
                Running Styles Only
              </Label>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
                setStatusFilter('all');
                setCustomerFilter('');
                setGroupBy('none');
                setRunningStylesOnly(false);
                setSearchParams(new URLSearchParams());
              }}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Display - Grouped or Table */}
      {error ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={fetchSamples} className="mt-4">
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : groupBy !== 'none' && groupedSamples ? (
        <div className="space-y-4">
          {groupedSamples.map((group) => (
            <Card key={group.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{group.label}</span>
                  <Badge variant="secondary">{group.samples.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <DataTable<Sample>
                  columns={columns}
                  data={group.samples}
                  keyExtractor={(sample) => sample.id}
                  loading={isLoading}
                  onRowClick={(sample) => navigate(`/samples/${sample.id}`)}
                  emptyState={{
                    title: 'No samples in this group',
                    description: '',
                  }}
                />
              </CardContent>
            </Card>
          ))}
          {groupedSamples.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No samples found
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
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
          </CardContent>
        </Card>
      )}

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
