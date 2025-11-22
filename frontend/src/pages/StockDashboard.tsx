// Stock Dashboard - Overview of inventory status
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Warehouse, Package, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import warehouseService from '../services/warehouse.service';
import stockLevelService from '../services/stockLevel.service';
import type { Warehouse as WarehouseType, StockLevel } from '../types/inventory.types';
import { logError } from '../lib/logger';

export default function StockDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dashboard data
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [lowStockItems, setLowStockItems] = useState<StockLevel[]>([]);
  const [totalValue, setTotalValue] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load data in parallel
      const [warehousesData, stockData, lowStockData, valuationData] = await Promise.all([
        warehouseService.getAll({ isActive: true }),
        stockLevelService.getAll(),
        stockLevelService.getBelowReorderLevel(),
        stockLevelService.getValuationReport()
      ]);

      setWarehouses(warehousesData);
      setStockLevels(stockData);
      setLowStockItems(lowStockData);
      setTotalValue(valuationData.totalValue);
    } catch (err: any) {
      logError('Dashboard error:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate metrics
  const totalMaterials = stockLevels.length;
  const totalQuantity = stockLevels.reduce((sum, item) => sum + Number(item.quantity), 0);
  const avgValuationRate = totalQuantity > 0 ? totalValue / totalQuantity : 0;

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      {/* Header */}
      <PageHeader title="Stock Dashboard">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/inventory/reports')}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Reports
          </Button>
          <Button onClick={() => navigate('/inventory/movements/new')}>
            <Package className="mr-2 h-4 w-4" />
            New Movement
          </Button>
        </div>
      </PageHeader>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Total Warehouses */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Active Warehouses</p>
                <p className="text-3xl font-bold">{warehouses.length}</p>
              </div>
              <Warehouse className="h-10 w-10 text-primary opacity-70" />
            </div>
            <Button
              variant="link"
              size="sm"
              className="mt-3 p-0 h-auto"
              onClick={() => navigate('/inventory/warehouses')}
            >
              View All
            </Button>
          </CardContent>
        </Card>

        {/* Total Materials */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Materials</p>
                <p className="text-3xl font-bold">{totalMaterials}</p>
              </div>
              <Package className="h-10 w-10 text-green-600 opacity-70" />
            </div>
            <Button
              variant="link"
              size="sm"
              className="mt-3 p-0 h-auto"
              onClick={() => navigate('/inventory/stock-levels')}
            >
              View Levels
            </Button>
          </CardContent>
        </Card>

        {/* Total Stock Value */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Stock Value</p>
                <p className="text-3xl font-bold">
                  ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <TrendingUp className="h-10 w-10 text-blue-600 opacity-70" />
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Avg Rate: ₹{avgValuationRate.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Low Stock Alerts</p>
                <p className={`text-3xl font-bold ${lowStockItems.length > 0 ? 'text-destructive' : ''}`}>
                  {lowStockItems.length}
                </p>
              </div>
              <AlertTriangle className="h-10 w-10 text-yellow-600 opacity-70" />
            </div>
            <Button
              variant="link"
              size="sm"
              className="mt-3 p-0 h-auto text-yellow-600"
              disabled={lowStockItems.length === 0}
            >
              View Items
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Low Stock Items */}
      {lowStockItems.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Materials Below Reorder Level</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Material Name</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Current Stock</TableHead>
                  <TableHead className="text-right">Reorder Level</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockItems.slice(0, 5).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.materials?.materialCode}</TableCell>
                    <TableCell>{item.materials?.materialName}</TableCell>
                    <TableCell>{item.warehouses?.warehouseName}</TableCell>
                    <TableCell className="text-right">
                      {Number(item.quantity).toFixed(2)} {item.unit}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.reorderLevel ? Number(item.reorderLevel).toFixed(2) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                        Low Stock
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {lowStockItems.length > 5 && (
              <div className="mt-4 text-center">
                <Button variant="outline" size="sm">
                  View All {lowStockItems.length} Items
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              variant="outline"
              className="h-auto py-4"
              onClick={() => navigate('/inventory/movements/stock-in')}
            >
              Stock IN
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4"
              onClick={() => navigate('/inventory/movements/stock-out')}
            >
              Stock OUT
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4"
              onClick={() => navigate('/inventory/movements/transfer')}
            >
              Transfer
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4"
              onClick={() => navigate('/inventory/stock-counts/new')}
            >
              Stock Count
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
