import { useEffect, useState, useMemo, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { sampleService } from '@/services/sample.service';
import type { Sample, SampleType, SampleStatus, SampleSummary } from '@/types/sample.types';
import { SampleTypeLabels, SampleStatusLabels, SampleStatusColors, isVersionedSampleType } from '@/types/sample.types';
import SearchInput from '@/components/SearchInput';
import { FilterBar } from '@/components/filters';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { TestTube, Plus, Eye, Pencil, Trash2, Filter, Clock, AlertCircle, CheckCircle, Layers, X } from 'lucide-react';
import { SampleVersionBadge } from '@/components/SampleVersionBadge';
import { SampleSLABadge } from '@/components/SampleSLABadge';
import { CustomerCombobox } from '@/components/CustomerCombobox';
import { StyleCombobox } from '@/components/StyleCombobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SampleActionMenu } from '@/components/samples/SampleActionMenu';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { formatDate } from '@/lib/date';
import { StyleIdentity } from '@/components/StyleIdentity';
import { BUYER_STYLE_CODE_LABEL, STYLE_CODE_LABEL, ourStyleCode } from '@/lib/style-code';

type GroupByMode = 'none' | 'type' | 'customer' | 'overdue';

// The types GET /api/samples accepts (sampleQuerySchema's SampleTypeEnum). Original and Look samples
// are refused there (400), so the Type filter must not offer them.
const FILTERABLE_SAMPLE_TYPES: SampleType[] = [
  'FIT_SAMPLE',
  'PP_SAMPLE',
  'SIZE_SET_SAMPLE',
  'PHOTO_SAMPLE',
  'PRODUCTION_SAMPLE',
  'SHIPMENT_SAMPLE',
];

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

  // Filter state. A type/status in the URL is used only when it is a real value: the Dashboard links
  // here with ?status=pending / ?status=overdue, which the API refuses (400) — the list then never loaded.
  const urlType = searchParams.get('type');
  const urlStatus = searchParams.get('status');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>(
    urlType && (FILTERABLE_SAMPLE_TYPES as string[]).includes(urlType) ? urlType : 'all'
  );
  const [statusFilter, setStatusFilter] = useState<string>(
    urlStatus && Object.keys(SampleStatusLabels).includes(urlStatus) ? urlStatus : 'all'
  );
  const [customerFilter, setCustomerFilter] = useState<string>(searchParams.get('customerId') || '');
  const [styleFilter, setStyleFilter] = useState('');

  // Grouping and view state (not a filter — Clear filters keeps it). The Dashboard's Overdue card opens overdue-first.
  const [groupBy, setGroupBy] = useState<GroupByMode>(urlStatus === 'overdue' ? 'overdue' : 'none');

  const activeFilterCount = [
    searchQuery,
    typeFilter !== 'all',
    statusFilter !== 'all',
    customerFilter,
    styleFilter,
  ].filter(Boolean).length;

  // Every filter change goes back to page 1
  const changeFilter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setCurrentPage(1);
    };

  // Clears every filter; grouping and page size stay as chosen
  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
    setCustomerFilter('');
    setStyleFilter('');
    setCurrentPage(1);
    searchParams.delete('type');
    searchParams.delete('status');
    searchParams.delete('customerId');
    setSearchParams(searchParams);
  };

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
          order = [
            'ORIGINAL_SAMPLE',
            'LOOK_SAMPLE',
            'FIT_SAMPLE',
            'PP_SAMPLE',
            'SIZE_SET_SAMPLE',
            'PHOTO_SAMPLE',
            'PRODUCTION_SAMPLE',
            'SHIPMENT_SAMPLE',
          ].indexOf(sample.sampleType);
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
  }, [currentPage, pageSize, searchQuery, typeFilter, statusFilter, customerFilter, styleFilter]);

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
        styleId: styleFilter || undefined,
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

  const isOverdue = (sample: Sample) => {
    if (['APPROVED', 'APPROVED_WITH_COMMENTS', 'REJECTED'].includes(sample.status)) {
      return false;
    }
    return new Date(sample.requiredDate) < new Date();
  };

  // Define columns for DataTable
  const columns: Column<Sample>[] = [
    {
      key: 'buyerStyleCode',
      header: BUYER_STYLE_CODE_LABEL,
      render: (item) =>
        item.style ? (
          <StyleIdentity
            style={item.style}
            name={item.style.styleName}
            layout="stacked"
            showStyleCode={false}
            codeClassName="text-sm text-foreground"
          />
        ) : (
          <span className="text-muted-foreground">No style</span>
        ),
    },
    {
      key: 'styleCode',
      header: STYLE_CODE_LABEL,
      render: (item) => <span className="text-sm">{ourStyleCode(item.style)}</span>,
    },
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
        if (!isVersionedSampleType(item.sampleType)) {
          return <div className="text-sm text-muted-foreground">-</div>;
        }
        const version = item.version || 1;
        return (
          <div className={`text-sm ${version > 1 ? 'text-blue-600 font-medium' : 'text-foreground'}`}>v{version}</div>
        );
      },
    },
    {
      key: 'sla',
      header: 'SLA',
      render: (item) => <SampleSLABadge slaStatus={item.slaStatus} daysUntilDue={item.daysUntilDue} />,
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (item) => (
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <SampleActionMenu
            sample={item}
            onActionComplete={fetchSamples}
            extraItems={
              <>
                <DropdownMenuItem onSelect={() => navigate(`/samples/${item.id}`)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate(`/samples/${item.id}/edit`)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                {!['APPROVED', 'APPROVED_WITH_COMMENTS'].includes(item.status) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => handleDeleteClick(item.id, item.sampleNumber)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </>
            }
          />
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
          <FilterBar
            onClear={clearFilters}
            hasActiveFilters={activeFilterCount > 0}
            clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
          >
            <SearchInput
              className="flex-1 min-w-[240px]"
              placeholder="Search sample number, buyer style code, style, style name, customer…"
              value={searchQuery}
              onChange={changeFilter(setSearchQuery)}
              // The API refuses a longer search (sampleQuerySchema: max 100)
              maxLength={100}
              aria-label="Search samples"
            />
            <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
              <SelectTrigger className="w-[200px]" aria-label="Sample type">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {FILTERABLE_SAMPLE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {SampleTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-[200px]" aria-label="Status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(Object.keys(SampleStatusLabels) as SampleStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {SampleStatusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CustomerCombobox
              value={customerFilter}
              onValueChange={changeFilter(setCustomerFilter)}
              placeholder="All customers"
              allowAll
              allLabel="All customers"
              className="w-[220px]"
            />
            {/* Any status: a sample can belong to a draft or archived style */}
            <StyleCombobox
              value={styleFilter}
              onValueChange={changeFilter(setStyleFilter)}
              status={null}
              allowAll
              allLabel="All styles"
              placeholder="All styles"
              className="w-[220px]"
            />
            {/* A view choice, not a filter: Clear filters keeps it */}
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByMode)}>
              <SelectTrigger className="w-[180px]" aria-label="Group by">
                <Layers className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Group by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No grouping</SelectItem>
                <SelectItem value="type">By sample type</SelectItem>
                <SelectItem value="customer">By customer</SelectItem>
                <SelectItem value="overdue">Overdue first</SelectItem>
              </SelectContent>
            </Select>
          </FilterBar>
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
          {groupedSamples.length === 0 && !isLoading && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {activeFilterCount > 0 ? (
                  <div className="flex flex-col items-center gap-3">
                    <p>No samples match these filters.</p>
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  'No samples found'
                )}
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
              emptyState={
                activeFilterCount > 0
                  ? { title: 'No samples match these filters.', actionLabel: 'Clear filters', onAction: clearFilters }
                  : { title: 'No samples found', description: 'Get started by creating a new sample' }
              }
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
