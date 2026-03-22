import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAllMachineParts, deleteMachinePart } from '@/services/machinePart.service';
import type { MachinePart } from '@/types/machinePart.types';
import ExportButton from '@/components/ExportButton';
import ImportButton from '@/components/ImportButton';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { Settings } from 'lucide-react';
import { ViewStockButton } from '@/components/ViewStockButton';
import stockLevelService from '@/services/stockLevel.service';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function MachinePartList() {
  const navigate = useNavigate();
  const [machinePartItems, setMachinePartItems] = useState<MachinePart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');

  // Stock count state
  const [stockCount, setStockCount] = useState<number | undefined>(undefined);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [partToDelete, setPartToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchMachinePartItems();
    fetchStockCount();
  }, [currentPage, pageSize, searchQuery]);

  const fetchStockCount = async () => {
    try {
      const stockLevels = await stockLevelService.getByMaterialType('MACHINE_PART');
      setStockCount(stockLevels.length);
    } catch (err) {
      // Silently fail - stock count is not critical
      setStockCount(undefined);
    }
  };

  const fetchMachinePartItems = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getAllMachineParts({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
      });
      setMachinePartItems(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load machine part items', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setPartToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!partToDelete) return;

    try {
      await deleteMachinePart(partToDelete.id);
      handleApiSuccess('Machine Part deleted', `${partToDelete.name} has been successfully deleted.`);
      fetchMachinePartItems();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete machine part');
    } finally {
      setPartToDelete(null);
    }
  };

  // Define columns for DataTable
  const columns: Column<MachinePart>[] = [
    {
      key: 'partCode',
      header: 'Code',
      render: (part) => (
        <Badge variant="outline" className="font-mono text-xs">
          {part.partCode}
        </Badge>
      ),
    },
    {
      key: 'partName',
      header: 'Part Name',
      render: (part) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{part.partName}</div>
          {part.description && <div className="text-xs text-gray-500 line-clamp-1">{part.description}</div>}
        </div>
      ),
    },
    {
      key: 'partNumber',
      header: 'Part Number',
      render: (part) => <div className="text-sm text-gray-700 font-mono">{part.partNumber || '-'}</div>,
    },
    {
      key: 'category',
      header: 'Category',
      render: (part) => <div className="text-sm text-gray-700">{part.category || '-'}</div>,
    },
    {
      key: 'machine',
      header: 'Machine / Brand',
      render: (part) => (
        <div className="text-sm text-gray-700">
          {part.machine && <div className="font-medium">{part.machine}</div>}
          {part.brand && <div className="text-xs text-gray-500">{part.brand}</div>}
          {!part.machine && !part.brand && '-'}
        </div>
      ),
    },
    {
      key: 'suppliers',
      header: 'Suppliers',
      render: (part) => (
        <div className="flex flex-wrap gap-1">
          {part.machinePartSuppliers && part.machinePartSuppliers.length > 0 ? (
            part.machinePartSuppliers.slice(0, 2).map((s) => (
              <Badge
                key={s.id}
                variant={s.isPreferred ? 'default' : 'secondary'}
                className="text-xs"
                title={`${s.supplier.name}${s.pricePerUnit ? ` - ₹${s.pricePerUnit}/unit` : ''}`}
              >
                {s.supplier.code}
                {s.pricePerUnit ? ` ₹${s.pricePerUnit}` : ''}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
          {part.machinePartSuppliers && part.machinePartSuppliers.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{part.machinePartSuppliers.length - 2}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'pricePerUnit',
      header: 'Price/Unit',
      render: (part) => (
        <div className="text-sm font-medium text-gray-900">
          {part.pricePerUnit ? formatCurrency(part.pricePerUnit) : '-'}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (part) => (
        <StatusBadge status={part.isActive ? 'active' : 'inactive'} variant={part.isActive ? 'success' : 'secondary'} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (part) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/materials/machine-part/${part.id}/edit`);
            }}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(part.id, part.partName);
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Machine Parts Management</CardTitle>
            <div className="flex gap-2">
              <ViewStockButton materialType="MACHINE_PART" stockCount={stockCount} />
              <ExportButton module="machine-part" filters={{}} />
              <ImportButton module="machine-part" onSuccess={fetchMachinePartItems} />
              <Button onClick={() => navigate('/materials/machine-part/new')}>+ Add New Machine Part</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Filter */}
          <div className="mb-6">
            <div className="flex-1 max-w-md">
              <SearchInput
                placeholder="Search by code, name, part number, or category..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>
          </div>

          {/* DataTable Component */}
          <DataTable
            data={machinePartItems}
            columns={columns}
            keyExtractor={(part) => part.id}
            loading={isLoading}
            error={error}
            onRowClick={(part) => navigate(`/materials/machine-part/${part.id}`)}
            emptyState={{
              icon: <Settings className="h-16 w-16" />,
              title: 'No machine parts found',
              description: searchQuery
                ? 'Try adjusting your search criteria'
                : 'Get started by creating your first machine part',
              actionLabel: 'Create First Machine Part',
              onAction: () => navigate('/materials/machine-part/new'),
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Machine Part"
        description={`Are you sure you want to delete ${partToDelete?.name}? This action cannot be undone and will also remove the associated material entry.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </>
  );
}
