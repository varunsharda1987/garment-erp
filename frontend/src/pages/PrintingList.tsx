import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { printingService } from '@/services/printing.service';
import type { LabDip, LabDipStatus, PrintingSummary, ProcessPO, ProcessPOStatus } from '@/types/printing.types';
import {
  LabDipStatusLabels,
  LabDipStatusColors,
  ProcessPOStatusLabels,
  ProcessPOStatusColors,
  PrintMethodLabels,
  PrintChemistryLabels,
  ColorMatchRatingLabels,
  ColorMatchRatingColors,
} from '@/types/printing.types';
import SearchInput from '@/components/SearchInput';
import { FilterBar } from '@/components/filters';
import { ProcessorCombobox } from '@/components/ProcessorCombobox';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { ReturnUnprocessedDialog } from '@/components/processing';
import SendToMillDialog from '@/components/processing/SendToMillDialog';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import {
  Printer,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Filter,
  Droplets,
  Send,
  Package,
  CheckCircle,
  Clock,
  Factory,
  PackageCheck,
  Undo,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { differenceInCalendarDays } from 'date-fns';
import { formatDate } from '@/lib/date';
import { StyleIdentity } from '@/components/StyleIdentity';
import { JobLinesCell } from '@/components/job-work/JobLinesCell';
import { BUYER_STYLE_CODE_LABEL, STYLE_CODE_LABEL, ourStyleCode } from '@/lib/style-code';

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

  const [activeTab, setActiveTab] = useState<'lab-dips' | 'process-pos'>(
    (searchParams.get('tab') as 'lab-dips' | 'process-pos') || 'lab-dips'
  );
  const [labDips, setLabDips] = useState<LabDip[]>([]);
  const [processPOs, setProcessPOs] = useState<ProcessPO[]>([]);
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
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  // Lab Dips only — the job work order list takes no mill filter
  const [processorFilter, setProcessorFilter] = useState('');

  const activeFilterCount = [searchQuery, statusFilter !== 'all', activeTab === 'lab-dips' && processorFilter].filter(
    Boolean
  ).length;
  const clearText = `Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`;

  // Clears every filter and goes back to page 1; the tab and page size stay
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setProcessorFilter('');
    setCurrentPage(1);
    searchParams.delete('status');
    setSearchParams(searchParams);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; number: string; type: 'labDip' | 'processPO' } | null>(
    null
  );

  // Return Unprocessed dialog state
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [sendDialogPO, setSendDialogPO] = useState<ProcessPO | null>(null);
  const [selectedPOForReturn, setSelectedPOForReturn] = useState<ProcessPO | null>(null);

  // Job Work Order status filter
  const [processPOsStatusFilter, setProcessPOsStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (activeTab === 'lab-dips') {
      fetchLabDips();
    } else {
      fetchProcessPOs();
    }
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentPage, pageSize, searchQuery, statusFilter, processPOsStatusFilter, processorFilter]);

  const fetchLabDips = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await printingService.labDips.getAllLabDips({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? (statusFilter as LabDipStatus) : undefined,
        processorId: processorFilter || undefined,
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

  const fetchProcessPOs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const effectiveStatus =
        activeTab === 'process-pos' && statusFilter !== 'all'
          ? (statusFilter as ProcessPOStatus)
          : processPOsStatusFilter !== 'all'
            ? (processPOsStatusFilter as ProcessPOStatus)
            : undefined;
      const response = await printingService.processPOs.getAll({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        status: effectiveStatus,
      });
      setProcessPOs(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load job work orders', false);
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
    setActiveTab(value as 'lab-dips' | 'process-pos');
    setCurrentPage(1);
    setStatusFilter('all');
    setProcessPOsStatusFilter('all');
    setProcessorFilter('');
    searchParams.set('tab', value);
    searchParams.delete('status');
    setSearchParams(searchParams);
  };

  const handleDeleteClick = (id: string, number: string, type: 'labDip' | 'processPO') => {
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
        await printingService.processPOs.delete(itemToDelete.id);
        handleApiSuccess('Job work order deleted', `${itemToDelete.number} has been successfully deleted.`);
        fetchProcessPOs();
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

  // ---- Return Unprocessed ----
  const openReturnDialog = (po: ProcessPO) => {
    setSelectedPOForReturn(po);
    setReturnDialogOpen(true);
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
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'styleCode',
      header: STYLE_CODE_LABEL,
      render: (item) => <span className="text-sm">{ourStyleCode(item.style)}</span>,
    },
    {
      key: 'fabric',
      header: 'Fabric',
      render: (item) => {
        const fabric = item.fabric;
        if (!fabric) return <div className="text-sm text-foreground">-</div>;
        const designColor = fabric.printDesign || fabric.colorName;
        return (
          <div className="text-sm text-foreground">
            <div>{fabric.fabricCode}</div>
            {fabric.finishType && (
              <div className="text-xs text-muted-foreground">
                {fabric.finishType}
                {designColor && ` ${designColor}`}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'printDetails',
      header: 'Print Details',
      render: (item) => (
        <div className="text-sm">
          {item.printMethod && <div className="text-foreground">{PrintMethodLabels[item.printMethod]}</div>}
          {item.printChemistry && (
            <div className="text-xs text-muted-foreground">{PrintChemistryLabels[item.printChemistry]}</div>
          )}
        </div>
      ),
    },
    {
      key: 'mill',
      header: 'Mill',
      render: (item) => <div className="text-sm text-foreground">{item.processor?.name || '-'}</div>,
    },
    {
      key: 'submissionDate',
      header: 'Submitted',
      render: (item) => <div className="text-sm text-foreground">{formatDate(item.submissionDate)}</div>,
    },
    // BUG-DYE4 fix: Added colorMatchRating column for consistency with DyeingList
    {
      key: 'colorMatchRating',
      header: 'Match Rating',
      render: (item) =>
        item.colorMatchRating ? (
          <Badge className={ColorMatchRatingColors[item.colorMatchRating] || ''}>
            {ColorMatchRatingLabels[item.colorMatchRating] || item.colorMatchRating}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
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
              navigate(`/manufacturing/printing/lab-dips/${item.id}`);
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
                  navigate(`/manufacturing/printing/lab-dips/${item.id}`);
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
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
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

  // Job Work Order columns
  const processPOColumns: Column<ProcessPO>[] = [
    {
      key: 'poNumber',
      header: 'Order #',
      render: (item) => (
        <Badge variant="outline" className="font-mono text-xs">
          {item.poNumber}
        </Badge>
      ),
    },
    {
      key: 'style',
      header: BUYER_STYLE_CODE_LABEL,
      render: (item) => {
        const style = item.jobWorkOrder?.style;
        return (
          <JobLinesCell
            lines={item.jobWorkOrder?.lines}
            show="style"
            fallback={
              style ? (
                <StyleIdentity
                  style={style}
                  name={style.styleName}
                  layout="stacked"
                  showStyleCode={false}
                  codeClassName="text-sm text-foreground"
                />
              ) : (
                <span className="text-muted-foreground">-</span>
              )
            }
          />
        );
      },
    },
    {
      key: 'styleCode',
      header: STYLE_CODE_LABEL,
      render: (item) => (
        <span className="text-sm">
          {(item.jobWorkOrder?.lines?.length ?? 0) > 1 ? 'Several' : ourStyleCode(item.jobWorkOrder?.style)}
        </span>
      ),
    },
    {
      key: 'supplier',
      header: 'Mill / Supplier',
      render: (item) => <div className="text-sm text-foreground">{item.supplier?.name || '-'}</div>,
    },
    {
      key: 'fabric',
      header: 'Fabric',
      render: (item) => {
        const fabricType = item.jobWorkOrder?.fabricType;
        const finishedFabric = item.jobWorkOrder?.finishedFabric;
        return (
          <div className="text-sm">
            {fabricType && (
              <Badge variant="secondary" className="text-xs">
                {fabricType}
              </Badge>
            )}
            <JobLinesCell
              lines={item.jobWorkOrder?.lines}
              show="fabric"
              fallback={
                finishedFabric && <div className="text-xs text-muted-foreground mt-1">{finishedFabric.fabricCode}</div>
              }
            />
          </div>
        );
      },
    },
    {
      key: 'qty',
      header: 'Qty (mtrs)',
      render: (item) => {
        const jwo = item.jobWorkOrder;
        return (
          <div className="text-sm">
            <div className="text-foreground">{jwo?.qtySentMeters?.toFixed(2) || '-'}</div>
            {(jwo?.qtyReceivedMeters || jwo?.calculatedActualMeters) && (
              <div className="text-xs text-muted-foreground">
                Rcvd: {(jwo?.qtyReceivedMeters || Number(jwo?.calculatedActualMeters))?.toFixed(2)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (item) => (
        <div className="text-sm font-medium text-foreground">
          {item.totalAmount != null
            ? `\u20B9${Number(item.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '-'}
        </div>
      ),
    },
    {
      key: 'sentDate',
      header: 'Sent Date',
      render: (item) => (
        <div className="text-sm text-foreground">
          {item.jobWorkOrder?.sentDate ? formatDate(item.jobWorkOrder.sentDate) : '—'}
        </div>
      ),
    },
    {
      key: 'returnDate',
      header: 'Return Date',
      render: (item) => {
        const jwo = item.jobWorkOrder;
        if (jwo?.receivedDate) return <div className="text-sm text-foreground">{formatDate(jwo.receivedDate)}</div>;
        if (jwo?.expectedReturnDate) {
          const overdue = new Date(jwo.expectedReturnDate) < new Date();
          return (
            <div className={`text-sm ${overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
              {formatDate(jwo.expectedReturnDate)}
              {overdue ? ' (Overdue)' : ''}
            </div>
          );
        }
        return <div className="text-sm text-muted-foreground">—</div>;
      },
    },
    {
      key: 'days',
      header: 'Days',
      render: (item) => {
        const jwo = item.jobWorkOrder;
        if (!jwo?.sentDate) return <div className="text-sm text-center text-muted-foreground">—</div>;
        const endDate = jwo.receivedDate ? new Date(jwo.receivedDate) : new Date();
        const days = Math.max(1, differenceInCalendarDays(endDate, new Date(jwo.sentDate)));
        return (
          <div className="text-sm text-center font-medium">
            {days}
            {!jwo.receivedDate ? '...' : ''}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <Badge className={ProcessPOStatusColors[item.processPOStatus] || ''}>
          {ProcessPOStatusLabels[item.processPOStatus] || item.processPOStatus}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <div className="flex items-center gap-1">
          {/* View — always available */}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/manufacturing/printing/job-work/${item.id}`);
            }}
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {/* Send to Mill — available when DRAFT (dialog: picks the greige lot when
              the order doesn't already carry one) */}
          {item.processPOStatus === 'DRAFT' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSendDialogPO(item);
              }}
              className="text-info hover:text-info hover:bg-info-muted"
              title="Send to Mill"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
          {/* Receive from processor — one action books the returned fabric into stock; a job
              received in parts keeps the action until its final delivery */}
          {(item.processPOStatus === 'AT_MILL' || item.processPOStatus === 'PARTIALLY_RECEIVED') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/job-work-orders/${item.id}/receive`);
              }}
              className="text-success hover:text-success hover:bg-success-muted"
              title="Receive from processor"
            >
              <PackageCheck className="h-4 w-4" />
            </Button>
          )}
          {/* Return Unprocessed — available when AT_MILL or RECEIVED */}
          {(item.processPOStatus === 'AT_MILL' ||
            item.processPOStatus === 'PARTIALLY_RECEIVED' ||
            item.processPOStatus === 'RECEIVED') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                openReturnDialog(item);
              }}
              className="text-warning hover:text-yellow-700 hover:bg-warning-muted"
              title="Return Unprocessed"
            >
              <Undo className="h-4 w-4" />
            </Button>
          )}
          {/* Delete — available when DRAFT */}
          {item.processPOStatus === 'DRAFT' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(item.id, item.poNumber, 'processPO');
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
          <Printer className="h-8 w-8 text-accent" />
          <div>
            <h1 className="text-2xl font-display font-medium text-foreground">Printing</h1>
            <p className="text-muted-foreground">Manage lab dips and job work orders</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/manufacturing/printing/lab-dips/new')}>
            <Droplets className="h-4 w-4 mr-2" />
            New Lab Dip
          </Button>
          <Button onClick={() => navigate('/manufacturing/printing/job-work/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Job Work Order
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Printer className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Job Work Orders</p>
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
                  <p className="text-sm text-muted-foreground">Lab Dips Pending</p>
                  <p className="text-2xl font-bold">{summary.labDipsPending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Factory className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">At Mill</p>
                  <p className="text-2xl font-bold text-primary">{summary.atMill}</p>
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
                  <p className="text-sm text-muted-foreground">Received</p>
                  <p className="text-2xl font-bold text-teal-600">{summary.received}</p>
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
                  <p className="text-sm text-muted-foreground">QC Checked</p>
                  <p className="text-2xl font-bold text-success">{summary.qualityChecked}</p>
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
          <TabsTrigger value="process-pos" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Job Work Orders
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
              <FilterBar onClear={clearFilters} hasActiveFilters={activeFilterCount > 0} clearText={clearText}>
                <SearchInput
                  className="w-80"
                  placeholder="Search lab dip, buyer style code, style code, fabric, design, mill…"
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
                <ProcessorCombobox
                  value={processorFilter}
                  onValueChange={(v) => {
                    setProcessorFilter(v || '');
                    setCurrentPage(1);
                  }}
                  allowAll
                  allLabel="All mills"
                  placeholder="All mills"
                  className="w-[220px]"
                />
                <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {Object.entries(LabDipStatusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterBar>
            </CardContent>
          </Card>

          {/* Lab Dips Table */}
          <Card>
            <CardContent className="p-0">
              {error ? (
                <div className="p-8 text-center">
                  <p className="text-destructive">{error}</p>
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
                  onRowClick={(labDip) => navigate(`/manufacturing/printing/lab-dips/${labDip.id}`)}
                  emptyState={
                    activeFilterCount > 0
                      ? {
                          title: 'No lab dips match these filters.',
                          actionLabel: 'Clear filters',
                          onAction: clearFilters,
                        }
                      : { title: 'No lab dips found', description: 'Get started by creating a new lab dip' }
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="process-pos" className="mt-4">
          {/* Filters */}
          <Card className="mb-4">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FilterBar onClear={clearFilters} hasActiveFilters={activeFilterCount > 0} clearText={clearText}>
                <SearchInput
                  className="w-80"
                  placeholder="Search order number, buyer style code, style code, mill, fabric…"
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
                <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {Object.entries(ProcessPOStatusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterBar>
            </CardContent>
          </Card>

          {/* Job Work Orders Table */}
          <Card>
            <CardContent className="p-0">
              {error ? (
                <div className="p-8 text-center">
                  <p className="text-destructive">{error}</p>
                  <Button variant="outline" onClick={fetchProcessPOs} className="mt-4">
                    Try Again
                  </Button>
                </div>
              ) : (
                <DataTable<ProcessPO>
                  columns={processPOColumns}
                  data={processPOs}
                  keyExtractor={(item) => item.id}
                  loading={isLoading}
                  onRowClick={(item) => navigate(`/manufacturing/printing/job-work/${item.id}`)}
                  emptyState={
                    activeFilterCount > 0
                      ? {
                          title: 'No job work orders match these filters.',
                          actionLabel: 'Clear filters',
                          onAction: clearFilters,
                        }
                      : {
                          title: 'No job work orders found',
                          description: 'Get started by creating a new job work order',
                        }
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
        title={`Delete ${itemToDelete?.type === 'labDip' ? 'Lab Dip' : 'Job Work Order'}`}
        description={`Are you sure you want to delete "${itemToDelete?.number}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
      />

      {/* Return Unprocessed Dialog */}
      <ReturnUnprocessedDialog
        open={returnDialogOpen}
        onOpenChange={setReturnDialogOpen}
        processPO={selectedPOForReturn}
        processType="PRINTING"
        onSuccess={() => {
          fetchProcessPOs();
          fetchSummary();
        }}
      />

      {/* Send to Mill Dialog (consolidated issuance) */}
      <SendToMillDialog
        open={!!sendDialogPO}
        onOpenChange={(o) => {
          if (!o) setSendDialogPO(null);
        }}
        po={sendDialogPO}
        processType="PRINTING"
        onSent={() => {
          fetchProcessPOs();
          fetchSummary();
        }}
      />
    </div>
  );
}
