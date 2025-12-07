import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { styleService } from '@/services/style.service';
import type { DashboardSummary } from '@/types/style.types';
import { ProductionStage } from '@/types/style.types';
import { logError } from '@/lib/logger';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await styleService.getDashboardSummary();
      setSummary(data);
    } catch (err) {
      logError('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (stage: ProductionStage) => {
    navigate(`/styles?stage=${stage}`);
  };

  return (
    <div className="max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            Welcome back, {user?.name}!
          </h2>
          <p className="text-gray-600">
            Here's what's happening with your garment manufacturing operations today.
          </p>
        </div>

        {/* Pre-Production Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <span className="w-3 h-3 bg-orange-500 rounded-full mr-2"></span>
            Pre-Production (Pending Actions)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card
              className="border-l-4 border-orange-500 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick(ProductionStage.ORDER_RECEIVED)}
            >
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Orders Received</CardDescription>
                <CardTitle className="text-2xl">
                  {loading ? '...' : summary?.preProduction.ordersReceived.styles || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">
                  {loading ? 'Loading...' : `${summary?.preProduction.ordersReceived.pieces || 0} pieces`}
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-l-4 border-orange-500 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick(ProductionStage.PENDING_COSTING)}
            >
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Pending Costing</CardDescription>
                <CardTitle className="text-2xl">
                  {loading ? '...' : summary?.preProduction.pendingCosting.styles || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">
                  {loading ? 'Loading...' : `${summary?.preProduction.pendingCosting.pieces || 0} pieces`}
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-l-4 border-orange-500 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick(ProductionStage.PENDING_GREIGE_ORDER)}
            >
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Pending Greige Order</CardDescription>
                <CardTitle className="text-2xl">
                  {loading ? '...' : summary?.preProduction.pendingGreige.styles || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">
                  {loading ? 'Loading...' : `${summary?.preProduction.pendingGreige.pieces || 0} pieces`}
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-l-4 border-orange-500 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick(ProductionStage.TRIMS_NOT_ORDERED)}
            >
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Trims Not Ordered</CardDescription>
                <CardTitle className="text-2xl">
                  {loading ? '...' : summary?.preProduction.trimsNotOrdered.styles || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">
                  {loading ? 'Loading...' : `${summary?.preProduction.trimsNotOrdered.pieces || 0} pieces`}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Processing Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <span className="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
            Processing Stages
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card
              className="border-l-4 border-purple-500 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick(ProductionStage.IN_PRINTING)}
            >
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">In Printing</CardDescription>
                <CardTitle className="text-2xl">
                  {loading ? '...' : summary?.processing.inPrinting.styles || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">
                  {loading ? 'Loading...' : `${summary?.processing.inPrinting.pieces || 0} pieces`}
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-l-4 border-purple-500 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick(ProductionStage.IN_DYING)}
            >
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">In Dying</CardDescription>
                <CardTitle className="text-2xl">
                  {loading ? '...' : summary?.processing.inDying.styles || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">
                  {loading ? 'Loading...' : `${summary?.processing.inDying.pieces || 0} pieces`}
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-l-4 border-purple-500 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick(ProductionStage.IN_EMBROIDERY)}
            >
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">In Embroidery</CardDescription>
                <CardTitle className="text-2xl">
                  {loading ? '...' : summary?.processing.inEmbroidery.styles || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">
                  {loading ? 'Loading...' : `${summary?.processing.inEmbroidery.pieces || 0} pieces`}
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-l-4 border-purple-500 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick(ProductionStage.IN_HANDWORK)}
            >
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">In Handwork</CardDescription>
                <CardTitle className="text-2xl">
                  {loading ? '...' : summary?.processing.inHandwork.styles || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">
                  {loading ? 'Loading...' : `${summary?.processing.inHandwork.pieces || 0} pieces`}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Production Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
            Production Stages
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card
              className="border-l-4 border-blue-500 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick(ProductionStage.IN_CUTTING)}
            >
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">In Cutting</CardDescription>
                <CardTitle className="text-2xl">
                  {loading ? '...' : summary?.production.inCutting.styles || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">
                  {loading ? 'Loading...' : `${summary?.production.inCutting.pieces || 0} pieces`}
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-l-4 border-blue-500 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick(ProductionStage.IN_STITCHING)}
            >
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">In Stitching</CardDescription>
                <CardTitle className="text-2xl">
                  {loading ? '...' : summary?.production.inStitching.styles || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">
                  {loading ? 'Loading...' : `${summary?.production.inStitching.pieces || 0} pieces`}
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-l-4 border-blue-500 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick(ProductionStage.IN_FINISHING)}
            >
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">In Finishing</CardDescription>
                <CardTitle className="text-2xl">
                  {loading ? '...' : summary?.production.inFinishing.styles || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">
                  {loading ? 'Loading...' : `${summary?.production.inFinishing.pieces || 0} pieces`}
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-l-4 border-green-500 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick(ProductionStage.READY_TO_SHIP)}
            >
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Ready to Ship</CardDescription>
                <CardTitle className="text-2xl">
                  {loading ? '...' : summary?.production.readyToShip.styles || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">
                  {loading ? 'Loading...' : `${summary?.production.readyToShip.pieces || 0} pieces`}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Access key modules</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <Button
                variant="outline"
                className="h-auto py-4"
                onClick={() => navigate('/users')}
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">👥</div>
                  <div className="font-semibold text-sm">Users</div>
                  <div className="text-xs text-gray-500">Manage users</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4"
                onClick={() => navigate('/styles')}
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">👔</div>
                  <div className="font-semibold text-sm">Styles</div>
                  <div className="text-xs text-gray-500">Manage styles</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4"
                onClick={() => navigate('/customers')}
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">🤝</div>
                  <div className="font-semibold text-sm">Customers</div>
                  <div className="text-xs text-gray-500">Manage customers</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4"
                onClick={() => navigate('/suppliers')}
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">🏢</div>
                  <div className="font-semibold text-sm">Suppliers</div>
                  <div className="text-xs text-gray-500">Manage suppliers</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4"
                onClick={() => navigate('/materials')}
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">📦</div>
                  <div className="font-semibold text-sm">Materials</div>
                  <div className="text-xs text-gray-500">Raw materials</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4"
                onClick={() => navigate('/orders')}
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">📋</div>
                  <div className="font-semibold text-sm">Orders</div>
                  <div className="text-xs text-gray-500">Manage orders</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4"
                onClick={() => navigate('/bom')}
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">📊</div>
                  <div className="font-semibold text-sm">BOM</div>
                  <div className="text-xs text-gray-500">Bill of Materials</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4"
                onClick={() => navigate('/cost-sheets')}
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">💰</div>
                  <div className="font-semibold text-sm">Cost Sheets</div>
                  <div className="text-xs text-gray-500">Style costing</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4"
                onClick={() => navigate('/chart-of-accounts')}
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">💼</div>
                  <div className="font-semibold text-sm">Finance</div>
                  <div className="text-xs text-gray-500">Chart of Accounts</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4"
                onClick={() => navigate('/inventory/dashboard')}
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">📦</div>
                  <div className="font-semibold text-sm">Inventory</div>
                  <div className="text-xs text-gray-500">Stock & Warehouses</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4"
                onClick={() => navigate('/production/dashboard')}
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">🏭</div>
                  <div className="font-semibold text-sm">Work Orders</div>
                  <div className="text-xs text-gray-500">Production tracking</div>
                </div>
              </Button>

              <Button variant="outline" className="h-auto py-4" disabled>
                <div className="text-center">
                  <div className="text-2xl mb-1">📊</div>
                  <div className="font-semibold text-sm">Reports</div>
                  <div className="text-xs text-gray-500">Coming soon</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

    </div>
  );
}
