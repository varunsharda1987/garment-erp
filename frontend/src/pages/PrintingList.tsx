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
  RefreshCcw,
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
  }, [activeTab, currentPage, pageSize, searchQuery, statusFilter, processPOsStatusFilter]);

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

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
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
      header: 'Style',
      render: (item) => (
        <div>
          {item.style ? (
            <>
              <div className="text-sm font-medium text-foreground">{item.style.styleCode}</div>
              <div className="text-xs text-muted-foreground line-clamp-1">{item.style.styleName}</div>
            </>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'buyerStyleRef',
      header: 'Buyer Ref',
      render: (item) => <span className="text-sm">{item.style?.buyerStyleRef || '—'}</span>,
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
      header: 'Style',
      render: (item) => {
        const style = item.jobWorkOrder?.style;
        return (
          <div>
            {style ? (
              <>
                <div className="text-sm font-medium text-foreground">{style.styleCode}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">{style.styleName}</div>
              </>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'buyerStyleRef',
      header: 'Buyer Ref',
      render: (item) => <span className="text-sm">{item.jobWorkOrder?.style?.buyerStyleRef || '—'}</span>,
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
            {finishedFabric && <div className="text-xs text-muted-foreground mt-1">{finishedFabric.fabricCode}</div>}
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
          {/* Receive via GRN — the one door for booking processed fabric into stock (2026-09-15) */}
          {item.processPOStatus === 'AT_MILL' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/procurement/grn/new?jobWorkOrderId=${item.id}`);
              }}
              className="text-success hover:text-success hover:bg-success-muted"
              title="Receive via GRN"
            >
              <PackageCheck className="h-4 w-4" />
            </Button>
          )}
          {/* Return Unprocessed — available when AT_MILL or RECEIVED */}
          {(item.processPOStatus === 'AT_MILL' || item.processPOStatus === 'RECEIVED') && (
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
              <div className="flex flex-wrap gap-4">
                <div className="w-64">
                  <SearchInput placeholder="Search lab dips..." value={searchQuery} onChange={setSearchQuery} />
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
              <div className="flex flex-wrap gap-4">
                <div className="w-64">
                  <SearchInput placeholder="Search job work orders..." value={searchQuery} onChange={setSearchQuery} />
                </div>
                <div className="w-48">
                  <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="AT_MILL">At Mill</SelectItem>
                      <SelectItem value="RECEIVED">Received</SelectItem>
                      <SelectItem value="QUALITY_CHECKED">QC Done</SelectItem>
                      <SelectItem value="STOCK_UPDATED">Stock Updated</SelectItem>
                      <SelectItem value="RETURNED">Returned</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
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
                  emptyState={{
                    title: 'No job work orders found',
                    description: 'Get started by creating a new job work order',
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
