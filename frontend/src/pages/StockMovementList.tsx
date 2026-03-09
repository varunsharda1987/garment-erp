// Stock Movement List - View all stock transactions
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowDown, ArrowUp, ArrowLeftRight, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError } from '@/lib/api-error-handler';
import stockMovementService from '../services/stockMovement.service';
import type { StockMovement, MovementType } from '../types/inventory.types';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function StockMovementList() {
  const navigate = useNavigate();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<MovementType | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadMovements();
  }, [typeFilter, startDate, endDate]);

  const loadMovements = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await stockMovementService.getAll({
        movementType: typeFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      setMovements(data);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load stock movements', false);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getMovementIcon = (type: MovementType) => {
    if (type.includes('IN')) return <ArrowDown className="h-3 w-3" />;
    if (type.includes('OUT')) return <ArrowUp className="h-3 w-3" />;
    return <ArrowLeftRight className="h-3 w-3" />;
  };

  const getMovementVariant = (type: MovementType) => {
    if (type.includes('IN')) return 'success' as const;
    if (type.includes('OUT')) return 'destructive' as const;
    if (type.includes('ADJUSTMENT')) return 'warning' as const;
    return 'info' as const;
  };

  // Define columns for DataTable
  const columns: Column<StockMovement>[] = [
    {
      key: 'performedAt',
      header: 'Date',
      render: (mov) => (
        <div className="text-sm text-gray-900">
          {new Date(mov.movementDate || mov.createdAt).toLocaleDateString()}
        </div>
      ),
    },
    {
      key: 'movementType',
      header: 'Type',
      render: (mov) => (
        <div className="flex items-center gap-1">
          {getMovementIcon(mov.movementType)}
          <StatusBadge
            status={mov.movementType.replace(/_/g, ' ')}
            variant={getMovementVariant(mov.movementType)}
          />
        </div>
      ),
    },
    {
      key: 'material',
      header: 'Material',
      render: (mov) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{mov.materials?.code}</div>
          <div className="text-xs text-gray-500">{mov.materials?.name}</div>
        </div>
      ),
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (mov) => (
        <div className="text-sm text-gray-900">
          {mov.warehouses?.warehouseName || '-'}
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (mov) => {
        const isInbound = mov.movementType.includes('IN');
        return (
          <div className={`font-medium ${isInbound ? 'text-green-600' : 'text-red-600'}`}>
            {isInbound ? '+' : '-'}{Number(mov.quantity).toFixed(2)} {mov.unit}
          </div>
        );
      },
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (mov) => (
        <div className="text-sm text-gray-900">
          {mov.referenceNumber || '-'}
        </div>
      ),
    },
    {
      key: 'performedBy',
      header: 'Performed By',
      render: (mov) => (
        <div className="text-sm text-gray-900">
          {mov.performedBy?.firstName || mov.performedById || '-'} {mov.performedBy?.lastName || ''}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Stock Movements">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Movement
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate('/inventory/movements/stock-in')}>
              Stock IN (Receipt)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/inventory/movements/stock-out')}>
              Stock OUT (Issue)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/inventory/movements/transfer')}>
              Transfer
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/inventory/movements/adjustment')}>
              Adjustment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Label htmlFor="typeFilter">Movement Type</Label>
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as MovementType | '')}>
                <SelectTrigger id="typeFilter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="STOCK_IN">Stock IN</SelectItem>
                  <SelectItem value="STOCK_OUT">Stock OUT</SelectItem>
                  <SelectItem value="TRANSFER_IN">Transfer IN</SelectItem>
                  <SelectItem value="TRANSFER_OUT">Transfer OUT</SelectItem>
                  <SelectItem value="ADJUSTMENT_IN">Adjustment IN</SelectItem>
                  <SelectItem value="ADJUSTMENT_OUT">Adjustment OUT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DataTable */}
      <Card>
        <DataTable
          data={movements}
          columns={columns}
          keyExtractor={(mov) => mov.id}
          loading={loading}
          error={error}
          emptyState={{
            icon: <Package className="h-16 w-16" />,
            title: 'No stock movements found',
            description: typeFilter || startDate || endDate
              ? 'Try adjusting your filter criteria'
              : 'Stock movements will appear here once materials are moved',
          }}
        />
      </Card>

      {/* Summary */}
      {!loading && movements.length > 0 && (
        <div className="mt-4 text-sm text-muted-foreground">
          Showing {movements.length} stock movement{movements.length !== 1 ? 's' : ''}
        </div>
      )}
    </>
  );
}
