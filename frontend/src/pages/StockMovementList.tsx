// Stock Movement List - View all stock transactions
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Filter, ArrowDown, ArrowUp, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import stockMovementService from '../services/stockMovement.service';
import type { StockMovement, MovementType } from '../types/inventory.types';

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
      const data = await stockMovementService.getAll({
        movementType: typeFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      setMovements(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load movements');
    } finally {
      setLoading(false);
    }
  };

  const getMovementIcon = (type: MovementType) => {
    if (type.includes('IN')) return <ArrowDown className="h-3 w-3" />;
    if (type.includes('OUT')) return <ArrowUp className="h-3 w-3" />;
    return <ArrowLeftRight className="h-3 w-3" />;
  };

  const getMovementColor = (type: MovementType) => {
    if (type.includes('IN')) return 'bg-green-100 text-green-800';
    if (type.includes('OUT')) return 'bg-red-100 text-red-800';
    if (type.includes('ADJUSTMENT')) return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  return (
    <div className="container mx-auto py-6">
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

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
                  <SelectItem value="">All</SelectItem>
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
            <div className="flex items-end">
              <Button onClick={loadMovements} variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Performed By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <LoadingSpinner size="sm" />
                </TableCell>
              </TableRow>
            ) : movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No movements found
                </TableCell>
              </TableRow>
            ) : (
              movements.map((mov) => (
                <TableRow key={mov.id} className="hover:bg-muted/50">
                  <TableCell>
                    {new Date(mov.performedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getMovementColor(mov.movementType)}>
                      {getMovementIcon(mov.movementType)}
                      <span className="ml-1">{mov.movementType.replace(/_/g, ' ')}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {mov.materials?.materialCode} - {mov.materials?.materialName}
                  </TableCell>
                  <TableCell>
                    {mov.warehouses?.warehouseName || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(mov.quantity).toFixed(2)} {mov.unit}
                  </TableCell>
                  <TableCell>
                    {mov.referenceNumber || '-'}
                  </TableCell>
                  <TableCell>
                    {mov.users?.firstName} {mov.users?.lastName}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
