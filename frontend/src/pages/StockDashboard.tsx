// Stock Dashboard - Unified Inventory Overview (All Materials)
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Warehouse, Package, TrendingUp, AlertTriangle, BarChart3, Layers, Box, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import warehouseService from '../services/warehouse.service';
import stockLevelService from '../services/stockLevel.service';
import fabricStockService from '../services/fabricStock.service';
import greigeStockService from '../services/greigeStock.service';
import type { Warehouse as WarehouseType, StockLevel } from '../types/inventory-exports';
import type { FabricStockSummary } from '../types/fabricStock.types';
import type { GreigeStockSummary } from '../types/greigeStock.types';
import type { MaterialTypeSummary } from '../types/dashboard.types';
import { logError } from '../lib/logger';
import { formatCurrencyWhole } from '@/lib/currency';
import { formatMaterialType } from '@/lib/formatters';

export default function StockDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dashboard data
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [lowStockItems, setLowStockItems] = useState<StockLevel[]>([]);
  const [trimValue, setTrimValue] = useState(0);

  // Fabric & Greige summaries
  const [fabricSummary, setFabricSummary] = useState<FabricStockSummary | null>(null);
  const [greigeSummary, setGreigeSummary] = useState<GreigeStockSummary | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load data in parallel
      const [
        warehousesData,
        stockData,
        lowStockData,
        valuationData,
        fabricData,
        greigeData
      ] = await Promise.all([
        warehouseService.getAll({ isActive: true }),
        stockLevelService.getAll(),
        stockLevelService.getBelowReorderLevel(),
        stockLevelService.getValuationReport(),
        fabricStockService.getSummary().catch(() => null),
        greigeStockService.getSummary().catch(() => null)
      ]);

      setWarehouses(warehousesData);
      setStockLevels(stockData);
      setLowStockItems(lowStockData);
      setTrimValue(valuationData.totalValue);
      setFabricSummary(fabricData);
      setGreigeSummary(greigeData);
    } catch (err: any) {
      logError('Dashboard error:', err);
      setError(err?.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate trim metrics by material type
  const trimsByType: MaterialTypeSummary[] = stockLevels.reduce((acc, item) => {
    const materialType = item.materials?.materialType || 'OTHER';
    const existing = acc.find(t => t.materialType === materialType);
    const itemValue = Number(item.quantity) * Number(item.valuationRate || 0);

    if (existing) {
      existing.count += 1;
      existing.value += itemValue;
    } else {
      acc.push({
        materialType,
        count: 1,
        value: itemValue
      });
    }
    return acc;
  }, [] as MaterialTypeSummary[]);

  // Calculate combined metrics
  const totalInventoryValue = trimValue + (fabricSummary?.totalValue || 0) + (greigeSummary?.totalValue || 0);
  const totalMaterials = stockLevels.length + (fabricSummary?.totalItems || 0) + (greigeSummary?.totalItems || 0);
  const totalAlerts = lowStockItems.length + (fabricSummary?.agingStockCount || 0) + (greigeSummary?.agingStockCount || 0);

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
      <PageHeader title="Unified Inventory Dashboard">
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

      {/* Combined Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Total Inventory Value"
          value={formatCurrencyWhole(totalInventoryValue)}
          description="Fabric + Greige + Trims"
          icon={TrendingUp}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
        />

        <StatCard
          title="Total Materials"
          value={totalMaterials.toString()}
          description={`${fabricSummary?.totalItems || 0} Fabric + ${greigeSummary?.totalItems || 0} Greige + ${stockLevels.length} Trims`}
          icon={Package}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
        />

        <StatCard
          title="Low Stock / Aging Alerts"
          value={totalAlerts.toString()}
          description={`${lowStockItems.length} Low + ${(fabricSummary?.agingStockCount || 0) + (greigeSummary?.agingStockCount || 0)} Aging`}
          icon={AlertTriangle}
          iconColor={totalAlerts > 0 ? "text-yellow-600" : "text-gray-400"}
          iconBgColor={totalAlerts > 0 ? "bg-yellow-100" : "bg-gray-100"}
        />

        <StatCard
          title="Active Warehouses"
          value={warehouses.length.toString()}
          description="Across all locations"
          icon={Warehouse}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100"
          onClick={() => navigate('/inventory/warehouses')}
        />
      </div>

      {/* Fabric Stock Section */}
      {fabricSummary && (
        <Card className="mb-6 border-l-4 border-l-blue-500">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-blue-600" />
                <CardTitle>Finished Fabric Stock</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/fabric-stock')}>
                View Details →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Total Meters</p>
                <p className="text-2xl font-bold text-blue-900">{fabricSummary.totalMeters.toLocaleString()} m</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Total Value</p>
                <p className="text-2xl font-bold text-blue-900">{formatCurrencyWhole(fabricSummary.totalValue)}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Aging Stock ({'>'}180 days)</p>
                <p className="text-2xl font-bold text-yellow-700">{fabricSummary.agingStockCount} items</p>
              </div>
            </div>
            {fabricSummary.byQualityGrade && (
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-green-50">Grade A: {(fabricSummary.byQualityGrade.A || 0).toFixed(2)} m</Badge>
                <Badge variant="outline" className="bg-yellow-50">Grade B: {(fabricSummary.byQualityGrade.B || 0).toFixed(2)} m</Badge>
                <Badge variant="outline" className="bg-red-50">Defect: {(fabricSummary.byQualityGrade.DEFECT || 0).toFixed(2)} m</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Greige Stock Section */}
      {greigeSummary && (
        <Card className="mb-6 border-l-4 border-l-green-500">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Box className="h-5 w-5 text-green-600" />
                <CardTitle>Generic Greige Stock</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/greige-stock')}>
                View Details →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Total Meters</p>
                <p className="text-2xl font-bold text-green-900">{greigeSummary.totalMeters.toLocaleString()} m</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Total Value</p>
                <p className="text-2xl font-bold text-green-900">{formatCurrencyWhole(greigeSummary.totalValue)}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Aging Stock ({'>'}180 days)</p>
                <p className="text-2xl font-bold text-yellow-700">{greigeSummary.agingStockCount} items</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trim & Accessories Section */}
      <Card className="mb-6 border-l-4 border-l-orange-500">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-600" />
              <CardTitle>Trim & Accessories Stock</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/inventory/stock-levels')}>
              View All Stock Levels →
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Total Materials</p>
              <p className="text-2xl font-bold text-orange-900">{stockLevels.length}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Total Value</p>
              <p className="text-2xl font-bold text-orange-900">{formatCurrencyWhole(trimValue)}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Low Stock Items</p>
              <p className="text-2xl font-bold text-yellow-700">{lowStockItems.length}</p>
            </div>
          </div>
          {trimsByType.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground mb-2">By Material Type:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {trimsByType.map((item) => (
                  <div key={item.materialType} className="flex justify-between items-center bg-gray-50 rounded p-2 text-sm">
                    <span className="font-medium">{formatMaterialType(item.materialType)}</span>
                    <Badge variant="secondary">{item.count} items</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Combined Low Stock & Aging Alerts */}
      {totalAlerts > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <CardTitle>Stock Alerts - Action Required</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Alert Reason</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Low Stock Trims */}
                {lowStockItems.slice(0, 3).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell><Badge variant="outline">Trim</Badge></TableCell>
                    <TableCell className="font-medium">{item.materials?.code}</TableCell>
                    <TableCell>{item.materials?.name}</TableCell>
                    <TableCell className="text-right">
                      {Number(item.quantity).toFixed(2)} {item.unit}
                    </TableCell>
                    <TableCell>Below reorder level ({item.reorderLevel ? Number(item.reorderLevel).toFixed(2) : 'N/A'})</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Low Stock</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Fabric Aging */}
                {fabricSummary && fabricSummary.agingStockCount > 0 && (
                  <TableRow>
                    <TableCell><Badge variant="outline" className="bg-blue-50">Fabric</Badge></TableCell>
                    <TableCell className="font-medium">Multiple</TableCell>
                    <TableCell>Finished Fabric Items</TableCell>
                    <TableCell className="text-right">{fabricSummary.agingStockCount} items</TableCell>
                    <TableCell>Stock aging {'>'}180 days</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-orange-100 text-orange-800">Aging</Badge>
                    </TableCell>
                  </TableRow>
                )}
                {/* Greige Aging */}
                {greigeSummary && greigeSummary.agingStockCount > 0 && (
                  <TableRow>
                    <TableCell><Badge variant="outline" className="bg-green-50">Greige</Badge></TableCell>
                    <TableCell className="font-medium">Multiple</TableCell>
                    <TableCell>Greige Fabric Items</TableCell>
                    <TableCell className="text-right">{greigeSummary.agingStockCount} items</TableCell>
                    <TableCell>Stock aging {'>'}180 days</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-orange-100 text-orange-800">Aging</Badge>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {(lowStockItems.length > 3 || (fabricSummary?.agingStockCount || 0) > 0 || (greigeSummary?.agingStockCount || 0) > 0) && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/inventory/stock-levels')}
                >
                  View All Alerts
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
