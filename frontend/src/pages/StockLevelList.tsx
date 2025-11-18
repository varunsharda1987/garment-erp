// Stock Level List - View all stock levels
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, AlertTriangle, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import stockLevelService from '../services/stockLevel.service';
import warehouseService from '../services/warehouse.service';
import type { StockLevel } from '../types/inventory.types';

export default function StockLevelList() {
  const navigate = useNavigate();
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  useEffect(() => {
    loadWarehouses();
  }, []);

  useEffect(() => {
    loadStockLevels();
  }, [warehouseFilter, showLowStockOnly]);

  const loadWarehouses = async () => {
    try {
      const data = await warehouseService.getAll({ isActive: true });
      setWarehouses(data);
    } catch (err) {
      console.error('Failed to load warehouses:', err);
    }
  };

  const loadStockLevels = async () => {
    try {
      setLoading(true);
      let data;
      if (showLowStockOnly) {
        data = await stockLevelService.getBelowReorderLevel(warehouseFilter || undefined);
      } else {
        data = await stockLevelService.getAll({
          warehouseId: warehouseFilter || undefined,
          search: searchTerm || undefined
        });
      }
      setStockLevels(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load stock levels');
    } finally {
      setLoading(false);
    }
  };

  const isLowStock = (stock: StockLevel): boolean => {
    if (!stock.reorderLevel) return false;
    return Number(stock.quantity) <= Number(stock.reorderLevel);
  };

  const getStockStatus = (stock: StockLevel) => {
    if (!stock.minStockLevel && !stock.reorderLevel) return null;

    const qty = Number(stock.quantity);
    if (stock.minStockLevel && qty < Number(stock.minStockLevel)) {
      return { label: 'Critical', variant: 'destructive' as const };
    }
    if (stock.reorderLevel && qty <= Number(stock.reorderLevel)) {
      return { label: 'Low Stock', variant: 'default' as const, className: 'bg-yellow-100 text-yellow-800' };
    }
    if (stock.maxStockLevel && qty > Number(stock.maxStockLevel)) {
      return { label: 'Overstock', variant: 'default' as const, className: 'bg-blue-100 text-blue-800' };
    }
    return { label: 'Normal', variant: 'default' as const, className: 'bg-green-100 text-green-800' };
  };

  return (
    <div className="container mx-auto py-6">
      <PageHeader title="Stock Levels">
        <Button
          variant={showLowStockOnly ? 'default' : 'outline'}
          onClick={() => setShowLowStockOnly(!showLowStockOnly)}
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          Low Stock Only
        </Button>
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
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Search Material</Label>
              <Input
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search materials..."
              />
            </div>
            <div className="w-64">
              <Label htmlFor="warehouseFilter">Warehouse</Label>
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger id="warehouseFilter">
                  <SelectValue placeholder="All Warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Warehouses</SelectItem>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.warehouseCode} - {wh.warehouseName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={loadStockLevels} variant="outline">
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
              <TableHead>Material Code</TableHead>
              <TableHead>Material Name</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead className="text-right">Current Stock</TableHead>
              <TableHead className="text-right">Valuation Rate</TableHead>
              <TableHead className="text-right">Stock Value</TableHead>
              <TableHead className="text-right">Reorder Level</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <LoadingSpinner size="sm" />
                </TableCell>
              </TableRow>
            ) : stockLevels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No stock levels found
                </TableCell>
              </TableRow>
            ) : (
              stockLevels.map((stock) => {
                const status = getStockStatus(stock);
                return (
                  <TableRow key={stock.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{stock.materials?.materialCode}</TableCell>
                    <TableCell>{stock.materials?.materialName}</TableCell>
                    <TableCell>{stock.warehouses?.warehouseName}</TableCell>
                    <TableCell className="text-right">
                      {Number(stock.quantity).toFixed(2)} {stock.unit}
                    </TableCell>
                    <TableCell className="text-right">
                      ₹{Number(stock.valuationRate).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{Number(stock.stockValue).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-right">
                      {stock.reorderLevel ? Number(stock.reorderLevel).toFixed(2) : '-'}
                    </TableCell>
                    <TableCell>
                      {status && (
                        <Badge variant={status.variant} className={status.className}>
                          {(status.variant === 'destructive' || status.label === 'Low Stock') && (
                            <TrendingDown className="mr-1 h-3 w-3" />
                          )}
                          {status.label}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
