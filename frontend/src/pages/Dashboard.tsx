import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Top Navigation Bar */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">🏭</div>
              <h1 className="text-xl font-bold text-gray-800">Kashaya Fabs ERP</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{user?.name}</span>
                <span className="mx-2">•</span>
                <span className="text-gray-500">{user?.role}</span>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            <Card className="border-l-4 border-orange-500">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Orders Received</CardDescription>
                <CardTitle className="text-2xl">0</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">No action taken yet</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-orange-500">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Pending Costing</CardDescription>
                <CardTitle className="text-2xl">0</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">In product master</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-orange-500">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Pending Greige Order</CardDescription>
                <CardTitle className="text-2xl">0</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">Fabric not ordered</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-orange-500">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Trims Not Ordered</CardDescription>
                <CardTitle className="text-2xl">0</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">Missing accessories</p>
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
            <Card className="border-l-4 border-purple-500">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">In Printing</CardDescription>
                <CardTitle className="text-2xl">0</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">Styles being printed</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-purple-500">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">In Dying</CardDescription>
                <CardTitle className="text-2xl">0</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">Styles being dyed</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-purple-500">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">In Embroidery</CardDescription>
                <CardTitle className="text-2xl">0</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">Styles in embroidery</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-purple-500">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">In Handwork</CardDescription>
                <CardTitle className="text-2xl">0</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">Styles in handwork</p>
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
            <Card className="border-l-4 border-blue-500">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">In Cutting</CardDescription>
                <CardTitle className="text-2xl">0</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">Fabric cutting stage</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-blue-500">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">In Stitching</CardDescription>
                <CardTitle className="text-2xl">0</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">Sewing stage</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-blue-500">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">In Finishing</CardDescription>
                <CardTitle className="text-2xl">0</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">Final touches</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-green-500">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Ready to Ship</CardDescription>
                <CardTitle className="text-2xl">0</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">Completed & packed</p>
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

              <Button variant="outline" className="h-auto py-4" disabled>
                <div className="text-center">
                  <div className="text-2xl mb-1">👔</div>
                  <div className="font-semibold text-sm">Styles</div>
                  <div className="text-xs text-gray-500">Coming soon</div>
                </div>
              </Button>

              <Button variant="outline" className="h-auto py-4" disabled>
                <div className="text-center">
                  <div className="text-2xl mb-1">📋</div>
                  <div className="font-semibold text-sm">Orders</div>
                  <div className="text-xs text-gray-500">Coming soon</div>
                </div>
              </Button>

              <Button variant="outline" className="h-auto py-4" disabled>
                <div className="text-center">
                  <div className="text-2xl mb-1">🏭</div>
                  <div className="font-semibold text-sm">Production</div>
                  <div className="text-xs text-gray-500">Coming soon</div>
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

        {/* System Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>Development Progress</CardTitle>
            <CardDescription>Phase 2 - Master Data Module</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  <span className="text-gray-600">Authentication System</span>
                </div>
                <span className="text-xs text-green-600 font-medium">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  <span className="text-gray-600">User Management</span>
                </div>
                <span className="text-xs text-green-600 font-medium">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                  <span className="text-gray-600">Customer Management</span>
                </div>
                <span className="text-xs text-yellow-600 font-medium">Next</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                  <span className="text-gray-600">Style Master</span>
                </div>
                <span className="text-xs text-gray-500 font-medium">Upcoming</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                  <span className="text-gray-600">Production Tracking</span>
                </div>
                <span className="text-xs text-gray-500 font-medium">Phase 5</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
