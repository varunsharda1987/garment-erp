import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { dyeingService } from '@/services/dyeing.service';
import { printingService } from '@/services/printing.service';
import type { DyeLabDip, ReceiveFromMillRequest } from '@/types/dyeing.types';
import type { ProcessPOStatus } from '@/types/printing.types';
import {
  LabDipStatusLabels,
  LabDipStatusColors,
  ProcessPOStatusLabels,
  ProcessPOStatusColors,
} from '@/types/printing.types';
import type {
  UnifiedLabDip,
  UnifiedProcessPO,
  UnifiedProcessingSummary,
  UnifiedProcessType,
} from '@/types/processing.types';
import {
  UnifiedProcessTypeLabels,
  UnifiedProcessTypeColors,
  mergeProcessingSummaries,
  isDyeLabDip,
} from '@/types/processing.types';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { QualityCheckDialog, ReturnUnprocessedDialog } from '@/components/processing';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import {
  Droplets,
  Plus,
  Eye,
  Trash2,
  RefreshCcw,
  Beaker,
  Send,
  Package,
  CheckCircle,
  Clock,
  Factory,
  PackageCheck,
  ArrowDownToLine,
  FileText,
  Undo,
  IndianRupee,
  Printer,
  Palette,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { differenceInCalendarDays } from 'date-fns';

type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

type ProcessTypeFilter = 'ALL' | 'DYEING' | 'PRINTING';

export default function ProcessingList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'lab-dips' | 'process-pos'>(
    (searchParams.get('tab') as 'lab-dips' | 'process-pos') || 'lab-dips'
  );
  const [labDips, setLabDips] = useState<UnifiedLabDip[]>([]);
  const [processPOs, setProcessPOs] = useState<UnifiedProcessPO[]>([]);
  const [summary, setSummary] = useState<UnifiedProcessingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [processTypeFilter, setProcessTypeFilter] = useState<ProcessTypeFilter>(
    (searchParams.get('processType') as ProcessTypeFilter) || 'ALL'
  );

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    number: string;
    type: 'labDip' | 'processPO';
    processType: UnifiedProcessType;
  } | null>(null);

  // Receive dialog
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [selectedPOForReceive, setSelectedPOForReceive] = useState<UnifiedProcessPO | null>(null);
  const [receiveForm, setReceiveForm] = useState({
    thanCount: '',
    foldLengthCm: '',
    qtyReceivedMeters: '',
    receivedWidthInches: '',
    receivedDate: new Date().toISOString().split('T')[0],
    receivedChallan: '',
    invoiceNumber: '',
  });
  const [receiveLoading, setReceiveLoading] = useState(false);

  // Update stock dialog
  const [updateStockDialogOpen, setUpdateStockDialogOpen] = useState(false);
  const [selectedPOForStock, setSelectedPOForStock] = useState<UnifiedProcessPO | null>(null);
  const [stockLoading, setStockLoading] = useState(false);

  // QC dialog
  const [qcDialogOpen, setQcDialogOpen] = useState(false);
  const [selectedPOForQC, setSelectedPOForQC] = useState<UnifiedProcessPO | null>(null);

  // Return dialog
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedPOForReturn, setSelectedPOForReturn] = useState<UnifiedProcessPO | null>(null);

  useEffect(() => {
    if (activeTab === 'lab-dips') {
      fetchLabDips();
    } else {
      fetchProcessPOs();
    }
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentPage, pageSize, searchQuery, statusFilter, processTypeFilter]);

  const fetchLabDips = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = {
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? (statusFilter as DyeLabDip['status']) : undefined,
      };

      // Fetch from both services based on filter
      const fetchDyeing = processTypeFilter === 'ALL' || processTypeFilter === 'DYEING';
      const fetchPrinting = processTypeFilter === 'ALL' || processTypeFilter === 'PRINTING';

      const [dyeResponse, printResponse] = await Promise.all([
        fetchDyeing
          ? dyeingService.labDips.getAllLabDips(params)
          : Promise.resolve({ data: [], pagination: { total: 0, totalPages: 0 } }),
        fetchPrinting
          ? printingService.labDips.getAllLabDips(params)
          : Promise.resolve({ data: [], pagination: { total: 0, totalPages: 0 } }),
      ]);

      // Combine and add process type discriminator
      const combined: UnifiedLabDip[] = [
        ...dyeResponse.data.map((ld) => ({ ...ld, _processType: 'DYEING' as const })),
        ...printResponse.data.map((ld) => ({ ...ld, _processType: 'PRINTING' as const })),
      ];

      // Sort by createdAt descending
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setLabDips(combined);
      setTotalItems(dyeResponse.pagination.total + printResponse.pagination.total);
      setTotalPages(Math.max(dyeResponse.pagination.totalPages, printResponse.pagination.totalPages));
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

      const params = {
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? (statusFilter as ProcessPOStatus) : undefined,
      };

      const fetchDyeing = processTypeFilter === 'ALL' || processTypeFilter === 'DYEING';
      const fetchPrinting = processTypeFilter === 'ALL' || processTypeFilter === 'PRINTING';

      const [dyeResponse, printResponse] = await Promise.all([
        fetchDyeing
          ? dyeingService.processPOs.getAll(params)
          : Promise.resolve({ data: [], pagination: { total: 0, totalPages: 0 } }),
        fetchPrinting
          ? printingService.processPOs.getAll(params)
          : Promise.resolve({ data: [], pagination: { total: 0, totalPages: 0 } }),
      ]);

      const combined: UnifiedProcessPO[] = [
        ...dyeResponse.data.map((po) => ({ ...po, _processType: 'DYEING' as const })),
        ...printResponse.data.map((po) => ({ ...po, _processType: 'PRINTING' as const })),
      ];

      combined.sort((a, b) => new Date(b.poDate).getTime() - new Date(a.poDate).getTime());

      setProcessPOs(combined);
      setTotalItems(dyeResponse.pagination.total + printResponse.pagination.total);
      setTotalPages(Math.max(dyeResponse.pagination.totalPages, printResponse.pagination.totalPages));
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load process POs', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const [dyeSummary, printSummary] = await Promise.all([
        dyeingService.summary.getSummary(),
        printingService.summary.getSummary(),
      ]);
      setSummary(mergeProcessingSummaries(dyeSummary, printSummary));
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'lab-dips' | 'process-pos');
    setCurrentPage(1);
    setStatusFilter('all');
    searchParams.set('tab', value);
    searchParams.delete('status');
    setSearchParams(searchParams);
  };

  const handleProcessTypeFilterChange = (value: ProcessTypeFilter) => {
    setProcessTypeFilter(value);
    setCurrentPage(1);
    if (value !== 'ALL') {
      searchParams.set('processType', value);
    } else {
      searchParams.delete('processType');
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

  const handleDeleteClick = (
    id: string,
    number: string,
    type: 'labDip' | 'processPO',
    processType: UnifiedProcessType
  ) => {
    setItemToDelete({ id, number, type, processType });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      const service = itemToDelete.processType === 'DYEING' ? dyeingService : printingService;
      if (itemToDelete.type === 'labDip') {
        await service.labDips.deleteLabDip(itemToDelete.id);
        handleApiSuccess('Lab Dip deleted', `${itemToDelete.number} has been successfully deleted.`);
        fetchLabDips();
      } else {
        await service.processPOs.delete(itemToDelete.id);
        handleApiSuccess('Process PO deleted', `${itemToDelete.number} has been successfully deleted.`);
        fetchProcessPOs();
      }
      fetchSummary();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete item');
    } finally {
      setItemToDelete(null);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Receive handlers
  const openReceiveDialog = (po: UnifiedProcessPO) => {
    setSelectedPOForReceive(po);
    const jwo = po.jobWorkOrder;
    setReceiveForm({
      thanCount: '',
      foldLengthCm: '',
      qtyReceivedMeters: '',
      receivedWidthInches: jwo?.sentWidthInches?.toString() || '',
      receivedDate: new Date().toISOString().split('T')[0],
      receivedChallan: '',
      invoiceNumber: '',
    });
    setReceiveDialogOpen(true);
  };

  const calculatedActualMeters = (() => {
    const thans = parseFloat(receiveForm.thanCount);
    const foldL = parseFloat(receiveForm.foldLengthCm);
    if (thans > 0 && foldL > 0) {
      return ((thans * foldL) / 100).toFixed(2);
    }
    return '';
  })();

  const handleReceiveSubmit = async () => {
    if (!selectedPOForReceive) return;
    setReceiveLoading(true);
    try {
      const data: ReceiveFromMillRequest = {
        receivedWidthInches: parseFloat(receiveForm.receivedWidthInches),
        receivedDate: receiveForm.receivedDate,
      };
      if (receiveForm.thanCount) data.thanCount = parseInt(receiveForm.thanCount);
      if (receiveForm.foldLengthCm) data.foldLengthCm = parseFloat(receiveForm.foldLengthCm);
      if (receiveForm.qtyReceivedMeters) data.qtyReceivedMeters = parseFloat(receiveForm.qtyReceivedMeters);
      if (receiveForm.receivedChallan) data.receivedChallan = receiveForm.receivedChallan;
      if (receiveForm.invoiceNumber) data.invoiceNumber = receiveForm.invoiceNumber;

      const service = selectedPOForReceive._processType === 'DYEING' ? dyeingService : printingService;
      await service.processPOs.receiveFromMill(selectedPOForReceive.id, data);
      const displayQty = receiveForm.qtyReceivedMeters || calculatedActualMeters || '-';
      handleApiSuccess('Fabric Received', `${selectedPOForReceive.poNumber}: ${displayQty}m received from mill.`);
      setReceiveDialogOpen(false);
      setSelectedPOForReceive(null);
      fetchProcessPOs();
      fetchSummary();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to receive from mill');
    } finally {
      setReceiveLoading(false);
    }
  };

  // Update stock handlers
  const openUpdateStockDialog = (po: UnifiedProcessPO) => {
    setSelectedPOForStock(po);
    setUpdateStockDialogOpen(true);
  };

  const handleUpdateStock = async () => {
    if (!selectedPOForStock) return;
    setStockLoading(true);
    try {
      const service = selectedPOForStock._processType === 'DYEING' ? dyeingService : printingService;
      await service.processPOs.updateStock(selectedPOForStock.id);
      const jwo = selectedPOForStock.jobWorkOrder;
      const fabricName = jwo?.finishedFabric?.fabricName || 'fabric';
      const qty = jwo?.qtyReceivedMeters || jwo?.calculatedActualMeters || 0;
      handleApiSuccess('Stock Updated', `${Number(qty).toFixed(2)}m of ${fabricName} added to inventory.`);
      setUpdateStockDialogOpen(false);
      setSelectedPOForStock(null);
      fetchProcessPOs();
      fetchSummary();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to update stock');
    } finally {
      setStockLoading(false);
    }
  };

  // QC handlers
  const openQCDialog = (po: UnifiedProcessPO) => {
    setSelectedPOForQC(po);
    setQcDialogOpen(true);
  };

  // Return handlers
  const openReturnDialog = (po: UnifiedProcessPO) => {
    setSelectedPOForReturn(po);
    setReturnDialogOpen(true);
  };

  // Send to mill
  const handleSendToMill = async (item: UnifiedProcessPO) => {
    try {
      const service = item._processType === 'DYEING' ? dyeingService : printingService;
      await service.processPOs.sendToMill(item.id, {
        sentDate: new Date().toISOString().split('T')[0],
        challanNumber: `CH-${Date.now()}`,
      });
      handleApiSuccess('Sent to Mill', `${item.poNumber} has been sent to mill.`);
      fetchProcessPOs();
      fetchSummary();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to send to mill');
    }
  };

  // Lab Dip columns
  const labDipColumns: Column<UnifiedLabDip>[] = [
    {
      key: 'processType',
      header: 'Type',
      render: (item) => (
        <Badge className={UnifiedProcessTypeColors[item._processType]}>
          {item._processType === 'DYEING' ? (
            <Droplets className="h-3 w-3 mr-1" />
          ) : (
            <Printer className="h-3 w-3 mr-1" />
          )}
          {UnifiedProcessTypeLabels[item._processType]}
        </Badge>
      ),
    },
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
          <div className="font-medium text-foreground">{item.style?.styleCode || '-'}</div>
          <div className="text-xs text-muted-foreground">{item.style?.styleName}</div>
        </div>
      ),
    },
    {
      key: 'fabric',
      header: 'Fabric',
      render: (item) => (
        <div>
          <div className="font-medium text-foreground">{item.fabric?.fabricCode || '-'}</div>
          <div className="text-xs text-muted-foreground">{item.fabric?.fabricName}</div>
        </div>
      ),
    },
    {
      key: 'colorOrDesign',
      header: 'Color/Design',
      render: (item) => {
        if (isDyeLabDip(item)) {
          return (
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <span>{item.targetColor?.colorName || item.colorReference || '-'}</span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-muted-foreground" />
            <span>{item.designArtwork || '-'}</span>
          </div>
        );
      },
    },
    {
      key: 'processor',
      header: 'Processor',
      render: (item) => <span className="text-sm">{item.processor?.name || '-'}</span>,
    },
    {
      key: 'submissionDate',
      header: 'Submitted',
      render: (item) => <span className="text-sm">{formatDate(item.submissionDate)}</span>,
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
              const route =
                item._processType === 'DYEING'
                  ? `/manufacturing/dyeing/lab-dips/${item.id}`
                  : `/manufacturing/printing/lab-dips/${item.id}`;
              navigate(route);
            }}
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {item.status === 'PENDING' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(item.id, item.labDipNumber, 'labDip', item._processType);
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

  // Process PO columns
  const processPOColumns: Column<UnifiedProcessPO>[] = [
    {
      key: 'processType',
      header: 'Type',
      render: (item) => (
        <Badge className={UnifiedProcessTypeColors[item._processType]}>
          {item._processType === 'DYEING' ? (
            <Droplets className="h-3 w-3 mr-1" />
          ) : (
            <Printer className="h-3 w-3 mr-1" />
          )}
          {UnifiedProcessTypeLabels[item._processType]}
        </Badge>
      ),
    },
    {
      key: 'poNumber',
      header: 'PO #',
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
        const jwo = item.jobWorkOrder;
        return (
          <div>
            <div className="font-medium text-foreground">{jwo?.style?.styleCode || '-'}</div>
            <div className="text-xs text-muted-foreground">{jwo?.style?.styleName}</div>
          </div>
        );
      },
    },
    {
      key: 'processor',
      header: 'Processor',
      render: (item) => <span className="text-sm">{item.supplier?.name || '-'}</span>,
    },
    {
      key: 'fabric',
      header: 'Fabric',
      render: (item) => {
        const jwo = item.jobWorkOrder;
        return (
          <div>
            <div className="text-sm">{jwo?.fabric?.fabricCode || '-'}</div>
            <div className="text-xs text-muted-foreground">{jwo?.fabric?.fabricName}</div>
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
            <div className="text-foreground">Sent: {jwo?.qtySentMeters?.toFixed(2) || '-'}</div>
            {(jwo?.qtyReceivedMeters || jwo?.calculatedActualMeters) && (
              <div className="text-xs text-muted-foreground">
                Rcvd: {(jwo.qtyReceivedMeters || Number(jwo.calculatedActualMeters))?.toFixed(2)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      render: (item) => (
        <div className="text-sm font-medium text-foreground">
          {item.totalAmount != null ? (
            <span className="flex items-center gap-0.5">
              <IndianRupee className="h-3 w-3" />
              {Number(item.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
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
        return <div className="text-sm text-muted-foreground">-</div>;
      },
    },
    {
      key: 'days',
      header: 'Days',
      render: (item) => {
        const jwo = item.jobWorkOrder;
        if (!jwo?.sentDate) return <div className="text-sm text-center text-muted-foreground">-</div>;
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
      render: (item) => {
        const status = item.processPOStatus;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                const route =
                  item._processType === 'DYEING'
                    ? `/manufacturing/dyeing/process-pos/${item.id}`
                    : `/manufacturing/printing/process-pos/${item.id}`;
                navigate(route);
              }}
              title="View details"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {status === 'DRAFT' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSendToMill(item);
                }}
                className="text-info hover:text-info hover:bg-info-muted"
                title="Send to Mill"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
            {status === 'AT_MILL' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  openReceiveDialog(item);
                }}
                className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                title="Receive from Mill"
              >
                <ArrowDownToLine className="h-4 w-4" />
              </Button>
            )}
            {status === 'RECEIVED' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  openQCDialog(item);
                }}
                className="text-primary hover:text-primary hover:bg-primary/10"
                title="Quality Check"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {status === 'QUALITY_CHECKED' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  openUpdateStockDialog(item);
                }}
                className="text-success hover:text-success hover:bg-success-muted"
                title="Update Stock"
              >
                <PackageCheck className="h-4 w-4" />
              </Button>
            )}
            {(status === 'AT_MILL' || status === 'RECEIVED') && (
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
            {status === 'DRAFT' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(item.id, item.poNumber, 'processPO', item._processType);
                }}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg">
            <Beaker className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-medium text-foreground">Dyeing & Printing</h1>
            <p className="text-muted-foreground">Unified processing management</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/manufacturing/processing/lab-dips/new')}>
            <Beaker className="h-4 w-4 mr-2" />
            New Lab Dip
          </Button>
          <Button onClick={() => navigate('/manufacturing/processing/process-pos/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Process PO
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Droplets className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dyeing</p>
                  <p className="text-2xl font-bold text-blue-600">{summary.dyeingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Printer className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Printing</p>
                  <p className="text-2xl font-bold text-purple-600">{summary.printingCount}</p>
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
            <Beaker className="h-4 w-4" />
            Lab Dips
          </TabsTrigger>
          <TabsTrigger value="process-pos" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Process POs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lab-dips" className="mt-4">
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="w-64">
                  <SearchInput placeholder="Search lab dips..." value={searchQuery} onChange={setSearchQuery} />
                </div>
                <div className="w-40">
                  <Select
                    value={processTypeFilter}
                    onValueChange={(v) => handleProcessTypeFilterChange(v as ProcessTypeFilter)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Process Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      <SelectItem value="DYEING">Dyeing</SelectItem>
                      <SelectItem value="PRINTING">Printing</SelectItem>
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
                    setProcessTypeFilter('ALL');
                    searchParams.delete('status');
                    searchParams.delete('processType');
                    setSearchParams(searchParams);
                  }}
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

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
                <DataTable
                  columns={labDipColumns as Column<unknown>[]}
                  data={labDips as unknown[]}
                  keyExtractor={(item) => (item as UnifiedLabDip).id}
                  loading={isLoading}
                  onRowClick={(item) => {
                    const labDip = item as UnifiedLabDip;
                    const route =
                      labDip._processType === 'DYEING'
                        ? `/manufacturing/dyeing/lab-dips/${labDip.id}`
                        : `/manufacturing/printing/lab-dips/${labDip.id}`;
                    navigate(route);
                  }}
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
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="w-64">
                  <SearchInput placeholder="Search process POs..." value={searchQuery} onChange={setSearchQuery} />
                </div>
                <div className="w-40">
                  <Select
                    value={processTypeFilter}
                    onValueChange={(v) => handleProcessTypeFilterChange(v as ProcessTypeFilter)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Process Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      <SelectItem value="DYEING">Dyeing</SelectItem>
                      <SelectItem value="PRINTING">Printing</SelectItem>
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
                    setProcessTypeFilter('ALL');
                    searchParams.delete('status');
                    searchParams.delete('processType');
                    setSearchParams(searchParams);
                  }}
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

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
                <DataTable
                  columns={processPOColumns as Column<unknown>[]}
                  data={processPOs as unknown[]}
                  keyExtractor={(item) => (item as UnifiedProcessPO).id}
                  loading={isLoading}
                  onRowClick={(item) => {
                    const po = item as UnifiedProcessPO;
                    const route =
                      po._processType === 'DYEING'
                        ? `/manufacturing/dyeing/process-pos/${po.id}`
                        : `/manufacturing/printing/process-pos/${po.id}`;
                    navigate(route);
                  }}
                  emptyState={{
                    title: 'No process POs found',
                    description: 'Get started by creating a new process PO',
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
        title={`Delete ${itemToDelete?.type === 'labDip' ? 'Lab Dip' : 'Process PO'}`}
        description={`Are you sure you want to delete "${itemToDelete?.number}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
      />

      {/* Receive from Mill Dialog */}
      <Dialog
        open={receiveDialogOpen}
        onOpenChange={(open) => {
          setReceiveDialogOpen(open);
          if (!open) setSelectedPOForReceive(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Receive from Mill</DialogTitle>
            <DialogDescription>
              Record receipt of processed fabric from {selectedPOForReceive?.supplier?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Than Count</Label>
                <Input
                  type="number"
                  value={receiveForm.thanCount}
                  onChange={(e) => setReceiveForm({ ...receiveForm, thanCount: e.target.value })}
                  placeholder="Number of thans"
                />
              </div>
              <div>
                <Label>Fold Length (cm)</Label>
                <Input
                  type="number"
                  value={receiveForm.foldLengthCm}
                  onChange={(e) => setReceiveForm({ ...receiveForm, foldLengthCm: e.target.value })}
                  placeholder="Fold length in cm"
                />
              </div>
            </div>
            {calculatedActualMeters && (
              <div className="text-sm text-muted-foreground">
                Calculated meters: <strong>{calculatedActualMeters}m</strong>
              </div>
            )}
            <div>
              <Label>OR Enter Quantity Directly (mtrs)</Label>
              <Input
                type="number"
                value={receiveForm.qtyReceivedMeters}
                onChange={(e) => setReceiveForm({ ...receiveForm, qtyReceivedMeters: e.target.value })}
                placeholder="Quantity in meters"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Received Width (inches) *</Label>
                <Input
                  type="number"
                  value={receiveForm.receivedWidthInches}
                  onChange={(e) => setReceiveForm({ ...receiveForm, receivedWidthInches: e.target.value })}
                />
              </div>
              <div>
                <Label>Received Date *</Label>
                <Input
                  type="date"
                  value={receiveForm.receivedDate}
                  onChange={(e) => setReceiveForm({ ...receiveForm, receivedDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Received Challan #</Label>
                <Input
                  value={receiveForm.receivedChallan}
                  onChange={(e) => setReceiveForm({ ...receiveForm, receivedChallan: e.target.value })}
                  placeholder="Challan number"
                />
              </div>
              <div>
                <Label>Invoice #</Label>
                <Input
                  value={receiveForm.invoiceNumber}
                  onChange={(e) => setReceiveForm({ ...receiveForm, invoiceNumber: e.target.value })}
                  placeholder="Invoice number"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReceiveSubmit} disabled={receiveLoading}>
              {receiveLoading ? 'Recording...' : 'Record Receipt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Stock Confirmation Dialog */}
      <Dialog
        open={updateStockDialogOpen}
        onOpenChange={(open) => {
          setUpdateStockDialogOpen(open);
          if (!open) setSelectedPOForStock(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Stock</DialogTitle>
            <DialogDescription>
              This will add the received fabric to inventory. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedPOForStock && (
            <div className="py-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PO Number:</span>
                  <span className="font-medium">{selectedPOForStock.poNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fabric:</span>
                  <span className="font-medium">
                    {selectedPOForStock.jobWorkOrder?.finishedFabric?.fabricName || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quantity:</span>
                  <span className="font-medium">
                    {(
                      selectedPOForStock.jobWorkOrder?.qtyReceivedMeters ||
                      selectedPOForStock.jobWorkOrder?.calculatedActualMeters ||
                      0
                    ).toFixed(2)}
                    m
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateStockDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStock} disabled={stockLoading}>
              {stockLoading ? 'Updating...' : 'Confirm & Update Stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QC Dialog */}
      {selectedPOForQC && (
        <QualityCheckDialog
          open={qcDialogOpen}
          onOpenChange={(open) => {
            setQcDialogOpen(open);
            if (!open) setSelectedPOForQC(null);
          }}
          processPO={selectedPOForQC}
          processType={selectedPOForQC._processType}
          onSuccess={() => {
            fetchProcessPOs();
            fetchSummary();
          }}
        />
      )}

      {/* Return Dialog */}
      {selectedPOForReturn && (
        <ReturnUnprocessedDialog
          open={returnDialogOpen}
          onOpenChange={(open) => {
            setReturnDialogOpen(open);
            if (!open) setSelectedPOForReturn(null);
          }}
          processPO={selectedPOForReturn}
          processType={selectedPOForReturn._processType}
          onSuccess={() => {
            fetchProcessPOs();
            fetchSummary();
          }}
        />
      )}
    </div>
  );
}
