// Warehouse List Page
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Eye, Warehouse as WarehouseIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/PageHeader';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import warehouseService from '../services/warehouse.service';
import type { Warehouse, WarehouseType } from '../types/inventory.types';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function WarehouseList() {
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<WarehouseType | ''>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [warehouseToDelete, setWarehouseToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    loadWarehouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, activeFilter, searchTerm]);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await warehouseService.getAll({
        warehouseType: typeFilter || undefined,
        isActive: activeFilter !== 'all' ? activeFilter === 'true' : undefined,
        search: searchTerm || undefined,
      });
      setWarehouses(data);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load warehouses', false);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setWarehouseToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!warehouseToDelete) return;

    try {
      await warehouseService.delete(warehouseToDelete.id);
      handleApiSuccess('Warehouse deleted', `${warehouseToDelete.name} has been successfully deleted.`);
      loadWarehouses();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete warehouse');
    } finally {
      setWarehouseToDelete(null);
    }
  };

  const getTypeVariant = (type: WarehouseType) => {
    switch (type) {
      case 'RAW_MATERIAL':
        return 'warning' as const;
      case 'FINISHED_GOODS':
        return 'success' as const;
      case 'WORK_IN_PROGRESS':
        return 'info' as const;
      case 'TRANSIT':
        return 'secondary' as const;
      default:
        return 'secondary' as const;
    }
  };

  // Define columns for DataTable
  const columns: Column<Warehouse>[] = [
    {
      key: 'warehouseCode',
      header: 'Code',
      render: (wh) => <div className="font-medium text-gray-900">{wh.warehouseCode}</div>,
    },
    {
      key: 'warehouseName',
      header: 'Name',
      render: (wh) => <div className="text-sm text-gray-900">{wh.warehouseName}</div>,
    },
    {
      key: 'warehouseType',
      header: 'Type',
      render: (wh) => (
        <StatusBadge status={wh.warehouseType.replace(/_/g, ' ')} variant={getTypeVariant(wh.warehouseType)} />
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (wh) => (
        <div>
          <div className="text-sm text-gray-900">{wh.city || '-'}</div>
          {wh.state && <div className="text-xs text-gray-500">{wh.state}</div>}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (wh) => (
        <div>
          {wh.contactPerson && <div className="text-sm text-gray-900">{wh.contactPerson}</div>}
          {wh.contactPhone && <div className="text-xs text-gray-500">{wh.contactPhone}</div>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (wh) => (
        <StatusBadge status={wh.isActive ? 'Active' : 'Inactive'} variant={wh.isActive ? 'success' : 'secondary'} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (wh) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/inventory/warehouses/${wh.id}`);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/inventory/warehouses/${wh.id}/edit`);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(wh.id, wh.warehouseName);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Warehouses">
        <Button onClick={() => navigate('/inventory/warehouses/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Warehouse
        </Button>
      </PageHeader>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Search</Label>
              <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search warehouses..." />
            </div>
            <div className="w-40">
              <Label htmlFor="typeFilter">Type</Label>
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as WarehouseType | '')}>
                <SelectTrigger id="typeFilter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="RAW_MATERIAL">Raw Material</SelectItem>
                  <SelectItem value="FINISHED_GOODS">Finished Goods</SelectItem>
                  <SelectItem value="WORK_IN_PROGRESS">WIP</SelectItem>
                  <SelectItem value="GENERAL">General</SelectItem>
                  <SelectItem value="TRANSIT">Transit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Label htmlFor="statusFilter">Status</Label>
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger id="statusFilter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DataTable */}
      <Card>
        <DataTable
          data={warehouses}
          columns={columns}
          keyExtractor={(wh) => wh.id}
          loading={loading}
          error={error}
          emptyState={{
            icon: <WarehouseIcon className="h-16 w-16" />,
            title: 'No warehouses found',
            description:
              searchTerm || typeFilter || activeFilter
                ? 'Try adjusting your search or filter criteria'
                : 'Create your first warehouse to get started',
            actionLabel: !searchTerm && !typeFilter && !activeFilter ? 'Create First Warehouse' : undefined,
            onAction:
              !searchTerm && !typeFilter && !activeFilter ? () => navigate('/inventory/warehouses/new') : undefined,
          }}
          onRowClick={(wh) => navigate(`/inventory/warehouses/${wh.id}`)}
        />
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Warehouse"
        description={`Are you sure you want to delete ${warehouseToDelete?.name}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </>
  );
}
