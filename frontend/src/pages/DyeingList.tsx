import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { DyeLabDip, DyeingSummary, ProcessPO, ProcessPOStatus } from '@/types/dyeing.types';
import {
  LabDipStatusLabels,
  LabDipStatusColors,
  ProcessPOStatusLabels,
  ProcessPOStatusColors,
  ColorMatchRatingLabels,
  ColorMatchRatingColors,
  FabricTypeLabels,
} from '@/types/dyeing.types';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import {
  Droplets,
  Plus,
  Eye,
  Pencil,
  Trash2,
  RefreshCcw,
  Filter,
  Beaker,
  Send,
  Package,
  CheckCircle,
  Clock,
  Factory,
  Palette,
  PackageCheck,
  ArrowDownToLine,
  FileText,
  Undo,
  IndianRupee,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Local type definition for DataTable
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function DyeingList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'lab-dips' | 'process-pos'>(
    (searchParams.get('tab') as 'lab-dips' | 'process-pos') || 'lab-dips'
  );
  const [labDips, setLabDips] = useState<DyeLabDip[]>([]);
  const [processPOs, setProcessPOs] = useState<ProcessPO[]>([]);
  const [summary, setSummary] = useState<DyeingSummary | null>(null);
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

  // Receive dialog state
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [selectedPOForReceive, setSelectedPOForReceive] = useState<ProcessPO | null>(null);
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

  // Update stock dialog state
  const [updateStockDialogOpen, setUpdateStockDialogOpen] = useState(false);
  const [selectedPOForStock, setSelectedPOForStock] = useState<ProcessPO | null>(null);
  const [stockLoading, setStockLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'lab-dips') {
      fetchLabDips();
    } else {
      fetchProcessPOs();
    }
    fetchSummary();
  }, [activeTab, currentPage, pageSize, searchQuery, statusFilter]);

  const fetchLabDips = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await dyeingService.labDips.getAllLabDips({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? (statusFilter as any) : undefined,
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
      const response = await dyeingService.processPOs.getAll({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? (statusFilter as ProcessPOStatus) : undefined,
      });
      setProcessPOs(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load process POs', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const summaryData = await dyeingService.summary.getSummary();
      setSummary(summaryData);
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

  const handleDeleteClick = (id: string, number: string, type: 'labDip' | 'processPO') => {
    setItemToDelete({ id, number, type });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.type === 'labDip') {
        await dyeingService.labDips.deleteLabDip(itemToDelete.id);
        handleApiSuccess('Lab Dip deleted', `${itemToDelete.number} has been successfully deleted.`);
        fetchLabDips();
      } else {
        await dyeingService.processPOs.delete(itemToDelete.id);
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

  // ---- Receive from Mill ----
  const openReceiveDialog = (po: ProcessPO) => {
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
      const data: Record<string, any> = {
        receivedWidthInches: parseFloat(receiveForm.receivedWidthInches),
        receivedDate: receiveForm.receivedDate,
      };
      if (receiveForm.thanCount) data.thanCount = parseInt(receiveForm.thanCount);
      if (receiveForm.foldLengthCm) data.foldLengthCm = parseFloat(receiveForm.foldLengthCm);
      if (receiveForm.qtyReceivedMeters) data.qtyReceivedMeters = parseFloat(receiveForm.qtyReceivedMeters);
      if (receiveForm.receivedChallan) data.receivedChallan = receiveForm.receivedChallan;
      if (receiveForm.invoiceNumber) data.invoiceNumber = receiveForm.invoiceNumber;

      await dyeingService.processPOs.receiveFromMill(selectedPOForReceive.id, data);
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

  // ---- Update Stock ----
  const openUpdateStockDialog = (po: ProcessPO) => {
    setSelectedPOForStock(po);
    setUpdateStockDialogOpen(true);
  };

  const handleUpdateStock = async () => {
    if (!selectedPOForStock) return;
    setStockLoading(true);
    try {
      await dyeingService.processPOs.updateStock(selectedPOForStock.id);
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

  // Lab Dip columns
  const labDipColumns: Column<DyeLabDip>[] = [
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
      render: (item) => <div className="text-sm text-gray-700">{item.fabric?.fabricCode || '-'}</div>,
    },
    {
      key: 'targetColor',
      header: 'Target Color',
      render: (item) => (
        <div className="text-sm">
          {item.targetColor ? (
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-gray-400" />
              <span>{item.targetColor.colorName}</span>
            </div>
          ) : item.colorReference ? (
            <div className="text-xs text-gray-500">{item.colorReference}</div>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'mill',
      header: 'Mill',
      render: (item) => <div className="text-sm text-gray-700">{item.mill?.name || '-'}</div>,
    },
    {
      key: 'submissionDate',
      header: 'Submitted',
      render: (item) => <div className="text-sm text-gray-700">{formatDate(item.submissionDate)}</div>,
    },
    {
      key: 'colorMatchRating',
      header: 'Match Rating',
      render: (item) =>
        item.colorMatchRating ? (
          <Badge className={ColorMatchRatingColors[item.colorMatchRating] || ''}>
            {ColorMatchRatingLabels[item.colorMatchRating] || item.colorMatchRating}
          </Badge>
        ) : (
          <span className="text-gray-400">-</span>
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
              navigate(`/manufacturing/dyeing/lab-dip/${item.id}`);
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
                  navigate(`/manufacturing/dyeing/lab-dip/${item.id}/edit`);
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

  // ---- Send to Mill ----
  const handleSendToMill = async (po: ProcessPO) => {
    try {
      await dyeingService.processPOs.sendToMill(po.id, {
        sentDate: new Date().toISOString().split('T')[0],
      });
      handleApiSuccess('Sent to Mill', `${po.poNumber} has been sent to mill.`);
      fetchProcessPOs();
      fetchSummary();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to send to mill');
    }
  };

  // Process PO columns
  const processPOColumns: Column<ProcessPO>[] = [
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
        const style = item.jobWorkOrder?.style;
        return (
          <div>
            {style ? (
              <>
                <div className="text-sm font-medium text-gray-900">{style.styleCode}</div>
                <div className="text-xs text-gray-500 line-clamp-1">{style.styleName}</div>
              </>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'supplier',
      header: 'Mill / Supplier',
      render: (item) => <div className="text-sm text-gray-700">{item.supplier?.name || '-'}</div>,
    },
    {
      key: 'fabric',
      header: 'Fabric',
      render: (item) => {
        const jwo = item.jobWorkOrder;
        return (
          <div className="text-sm">
            {jwo?.fabricType && (
              <Badge variant="secondary" className="text-xs mr-1">
                {FabricTypeLabels[jwo.fabricType] || jwo.fabricType}
              </Badge>
            )}
            {jwo?.finishedFabric ? (
              <span className="text-gray-700">{jwo.finishedFabric.fabricName}</span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
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
            <div className="text-gray-700">Sent: {jwo?.qtySentMeters?.toFixed(2) || '-'}</div>
            {(jwo?.qtyReceivedMeters || jwo?.calculatedActualMeters) && (
              <div className="text-xs text-gray-500">
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
        <div className="text-sm font-medium text-gray-900">
          {item.totalAmount != null ? (
            <span className="flex items-center gap-0.5">
              <IndianRupee className="h-3 w-3" />
              {Number(item.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'poDate',
      header: 'PO Date',
      render: (item) => <div className="text-sm text-gray-700">{formatDate(item.poDate)}</div>,
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
            {/* View */}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/manufacturing/dyeing/process-po/${item.id}`);
              }}
              title="View details"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {/* Send to Mill — available when DRAFT */}
            {status === 'DRAFT' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSendToMill(item);
                }}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                title="Send to Mill"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
            {/* Receive from Mill — available when AT_MILL */}
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
            {/* Quality Check — available when RECEIVED */}
            {status === 'RECEIVED' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/manufacturing/dyeing/process-po/${item.id}/qc`);
                }}
                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                title="Quality Check"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {/* Update Stock — available when QUALITY_CHECKED */}
            {status === 'QUALITY_CHECKED' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  openUpdateStockDialog(item);
                }}
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                title="Update Stock"
              >
                <PackageCheck className="h-4 w-4" />
              </Button>
            )}
            {/* Return Unprocessed — available when AT_MILL or RECEIVED */}
            {(status === 'AT_MILL' || status === 'RECEIVED') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/manufacturing/dyeing/process-po/${item.id}/return`);
                }}
                className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                title="Return Unprocessed"
              >
                <Undo className="h-4 w-4" />
              </Button>
            )}
            {/* Delete — only when DRAFT */}
            {status === 'DRAFT' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(item.id, item.poNumber, 'processPO');
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
          <Droplets className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dyeing</h1>
            <p className="text-gray-500">Manage lab dips and process POs</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/manufacturing/dyeing/lab-dip/new')}>
            <Beaker className="h-4 w-4 mr-2" />
            New Lab Dip
          </Button>
          <Button onClick={() => navigate('/manufacturing/dyeing/process-po/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Process PO
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Droplets className="h-5 w-5 text-blue-600" />
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
            <Beaker className="h-4 w-4" />
            Lab Dips
          </TabsTrigger>
          <TabsTrigger value="process-pos" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Process POs
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
                  <p className="text-red-600">{error}</p>
                  <Button variant="outline" onClick={fetchLabDips} className="mt-4">
                    Try Again
                  </Button>
                </div>
              ) : (
                <DataTable<DyeLabDip>
                  columns={labDipColumns}
                  data={labDips}
                  keyExtractor={(item) => item.id}
                  loading={isLoading}
                  onRowClick={(item) => navigate(`/manufacturing/dyeing/lab-dip/${item.id}`)}
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
                  <SearchInput placeholder="Search process POs..." value={searchQuery} onChange={setSearchQuery} />
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

          {/* Process POs Table */}
          <Card>
            <CardContent className="p-0">
              {error ? (
                <div className="p-8 text-center">
                  <p className="text-red-600">{error}</p>
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
                  onRowClick={(item) => navigate(`/manufacturing/dyeing/process-po/${item.id}`)}
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
              {selectedPOForReceive?.poNumber} — {selectedPOForReceive?.supplier?.name || 'Mill'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Sent info summary */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Sent Qty:</span>
                <span className="font-medium">
                  {selectedPOForReceive?.jobWorkOrder?.qtySentMeters?.toFixed(2)} mtrs
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sent Width:</span>
                <span className="font-medium">{selectedPOForReceive?.jobWorkOrder?.sentWidthInches}"</span>
              </div>
              {selectedPOForReceive?.jobWorkOrder?.finishedFabric && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Finished Fabric:</span>
                  <span className="font-medium">{selectedPOForReceive.jobWorkOrder.finishedFabric.fabricCode}</span>
                </div>
              )}
            </div>

            {/* Than / Fold "L" measurement */}
            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-sm font-medium text-gray-700">Than / Fold Measurement</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="thanCount">No. of Thans</Label>
                  <Input
                    id="thanCount"
                    type="number"
                    min="1"
                    placeholder="e.g. 50"
                    value={receiveForm.thanCount}
                    onChange={(e) => setReceiveForm((f) => ({ ...f, thanCount: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="foldLengthCm">Fold Length "L" (cm)</Label>
                  <Input
                    id="foldLengthCm"
                    type="number"
                    step="0.1"
                    min="1"
                    placeholder="e.g. 97.5"
                    value={receiveForm.foldLengthCm}
                    onChange={(e) => setReceiveForm((f) => ({ ...f, foldLengthCm: e.target.value }))}
                  />
                </div>
              </div>
              {calculatedActualMeters && (
                <div className="bg-blue-50 rounded p-2 text-sm flex justify-between items-center">
                  <span className="text-blue-700">Calculated Actual Meters:</span>
                  <span className="font-bold text-blue-900">{calculatedActualMeters} m</span>
                </div>
              )}
            </div>

            {/* Override / manual qty */}
            <div>
              <Label htmlFor="qtyReceivedMeters">Qty Received (mtrs) — override</Label>
              <Input
                id="qtyReceivedMeters"
                type="number"
                step="0.01"
                placeholder={calculatedActualMeters ? `Auto: ${calculatedActualMeters}` : 'Enter manually'}
                value={receiveForm.qtyReceivedMeters}
                onChange={(e) => setReceiveForm((f) => ({ ...f, qtyReceivedMeters: e.target.value }))}
              />
              <p className="text-xs text-gray-400 mt-1">Leave blank to use calculated value from thans x L</p>
            </div>

            {/* Width received */}
            <div>
              <Label htmlFor="receivedWidthInches">Received Width (inches)</Label>
              <Input
                id="receivedWidthInches"
                type="number"
                step="0.1"
                value={receiveForm.receivedWidthInches}
                onChange={(e) => setReceiveForm((f) => ({ ...f, receivedWidthInches: e.target.value }))}
              />
              {receiveForm.receivedWidthInches &&
                selectedPOForReceive?.jobWorkOrder?.sentWidthInches &&
                (() => {
                  const diff =
                    parseFloat(receiveForm.receivedWidthInches) - selectedPOForReceive.jobWorkOrder.sentWidthInches;
                  if (diff === 0 || isNaN(diff)) return null;
                  return (
                    <p className={`text-xs mt-1 ${diff < 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {diff > 0 ? '+' : ''}
                      {diff.toFixed(1)}" vs sent width
                    </p>
                  );
                })()}
            </div>

            {/* Date and challan */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="receivedDate">Received Date</Label>
                <Input
                  id="receivedDate"
                  type="date"
                  value={receiveForm.receivedDate}
                  onChange={(e) => setReceiveForm((f) => ({ ...f, receivedDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="receivedChallan">Challan No.</Label>
                <Input
                  id="receivedChallan"
                  placeholder="Challan number"
                  value={receiveForm.receivedChallan}
                  onChange={(e) => setReceiveForm((f) => ({ ...f, receivedChallan: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="invoiceNumber">Invoice No.</Label>
              <Input
                id="invoiceNumber"
                placeholder="Invoice number (optional)"
                value={receiveForm.invoiceNumber}
                onChange={(e) => setReceiveForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReceiveSubmit}
              disabled={receiveLoading || !receiveForm.receivedWidthInches || !receiveForm.receivedDate}
            >
              {receiveLoading ? 'Saving...' : 'Receive Fabric'}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Stock</DialogTitle>
            <DialogDescription>Create inventory stock from received fabric</DialogDescription>
          </DialogHeader>
          {selectedPOForStock &&
            (() => {
              const jwo = selectedPOForStock.jobWorkOrder;
              return (
                <div className="space-y-3 py-2">
                  <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">PO:</span>
                      <span className="font-medium">{selectedPOForStock.poNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Finished Fabric:</span>
                      <span className="font-medium">{jwo?.finishedFabric?.fabricCode || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Qty Received:</span>
                      <span className="font-medium">
                        {(jwo?.qtyReceivedMeters || Number(jwo?.calculatedActualMeters) || 0).toFixed(2)} mtrs
                      </span>
                    </div>
                    {jwo?.defectMeters != null && jwo.defectMeters > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Defect Meters:</span>
                          <span className="font-medium text-red-600">{jwo.defectMeters} mtrs</span>
                        </div>
                        <div className="flex justify-between border-t pt-1">
                          <span className="text-gray-500">Good Qty:</span>
                          <span className="font-bold text-green-700">
                            {(
                              (jwo.qtyReceivedMeters || Number(jwo.calculatedActualMeters) || 0) -
                              (jwo.defectMeters || 0)
                            ).toFixed(2)}{' '}
                            mtrs
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Quality Grade:</span>
                      <Badge variant="outline">{jwo?.qualityGrade || '-'}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Width:</span>
                      <span className="font-medium">{jwo?.receivedWidthInches}"</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    This will create a fabric stock entry for{' '}
                    <strong>{jwo?.finishedFabric?.fabricName || 'the finished fabric'}</strong> with the above
                    quantities.
                  </p>
                </div>
              );
            })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateStockDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStock} disabled={stockLoading} className="bg-green-600 hover:bg-green-700">
              {stockLoading ? 'Creating Stock...' : 'Confirm & Create Stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
