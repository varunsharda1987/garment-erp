import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical,
  Building2,
  FileText,
  Shirt,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  fabricPhysicalTestsService,
  garmentPhysicalTestsService,
  testingLabsService,
  testTemplatesService,
} from '@/services/testing.service';

interface DashboardStats {
  fpt: {
    total: number;
    pending: number;
    passed: number;
    failed: number;
  };
  gpt: {
    total: number;
    pending: number;
    passed: number;
    failed: number;
    pendingBuyerApproval: number;
  };
  labs: {
    total: number;
    active: number;
  };
  templates: {
    total: number;
    fpt: number;
    gpt: number;
  };
}

export default function TestingDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Fetch all data in parallel
      const [fptData, gptData, labsData, templatesData] = await Promise.all([
        fabricPhysicalTestsService.getAll({ limit: 1 }),
        garmentPhysicalTestsService.getAll({ limit: 1 }),
        testingLabsService.getAll({ limit: 1 }),
        testTemplatesService.getAll({ limit: 1 }),
      ]);

      // Get count for each status (simplified - in production, backend should provide summary)
      const [fptPending, fptPassed, fptFailed] = await Promise.all([
        fabricPhysicalTestsService.getAll({ limit: 1, overallTestResult: 'PENDING' }),
        fabricPhysicalTestsService.getAll({ limit: 1, overallTestResult: 'PASS' }),
        fabricPhysicalTestsService.getAll({ limit: 1, overallTestResult: 'FAIL' }),
      ]);

      const [gptPending, gptPassed, gptFailed, gptBuyerApproval] = await Promise.all([
        garmentPhysicalTestsService.getAll({ limit: 1, overallTestResult: 'PENDING' }),
        garmentPhysicalTestsService.getAll({ limit: 1, overallTestResult: 'PASS' }),
        garmentPhysicalTestsService.getAll({ limit: 1, overallTestResult: 'FAIL' }),
        garmentPhysicalTestsService.getAll({ limit: 1, pendingBuyerApproval: true }),
      ]);

      setStats({
        fpt: {
          total: fptData.pagination.total,
          pending: fptPending.pagination.total,
          passed: fptPassed.pagination.total,
          failed: fptFailed.pagination.total,
        },
        gpt: {
          total: gptData.pagination.total,
          pending: gptPending.pagination.total,
          passed: gptPassed.pagination.total,
          failed: gptFailed.pagination.total,
          pendingBuyerApproval: gptBuyerApproval.pagination.total,
        },
        labs: {
          total: labsData.pagination.total,
          active: labsData.pagination.total, // Simplified
        },
        templates: {
          total: templatesData.pagination.total,
          fpt: templatesData.data.filter((t) => t.templateType === 'FPT').length,
          gpt: templatesData.data.filter((t) => t.templateType === 'GPT').length,
        },
      });
    } catch (error) {
      console.error('Failed to fetch testing stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <FlaskConical className="h-8 w-8 text-blue-600" />
          Testing Module Dashboard
        </h1>
        <p className="text-gray-500 mt-1">
          Manage fabric and garment physical testing, labs, and test templates
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* FPT Card */}
        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-blue-500"
          onClick={() => navigate('/fabric-physical-tests')}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-500 font-medium">Fabric Tests (FPT)</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.fpt.total || 0}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Pending</span>
              <Badge variant="outline" className="bg-amber-50">
                {stats?.fpt.pending || 0}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Passed</span>
              <Badge variant="outline" className="bg-green-50">
                {stats?.fpt.passed || 0}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Failed</span>
              <Badge variant="outline" className="bg-red-50">
                {stats?.fpt.failed || 0}
              </Badge>
            </div>
          </div>
        </Card>

        {/* GPT Card */}
        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-purple-500"
          onClick={() => navigate('/garment-physical-tests')}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-500 font-medium">Garment Tests (GPT)</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.gpt.total || 0}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Shirt className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Pending</span>
              <Badge variant="outline" className="bg-amber-50">
                {stats?.gpt.pending || 0}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Buyer Approval</span>
              <Badge variant="outline" className="bg-orange-50">
                {stats?.gpt.pendingBuyerApproval || 0}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Failed</span>
              <Badge variant="outline" className="bg-red-50">
                {stats?.gpt.failed || 0}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Testing Labs Card */}
        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-green-500"
          onClick={() => navigate('/testing-labs')}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-500 font-medium">Testing Labs</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.labs.total || 0}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Building2 className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Active Labs</span>
              <Badge variant="outline" className="bg-green-50">
                {stats?.labs.active || 0}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Test Templates Card */}
        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-orange-500"
          onClick={() => navigate('/test-templates')}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-500 font-medium">Test Templates</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.templates.total || 0}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <FileText className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">FPT Templates</span>
              <Badge variant="outline" className="bg-blue-50">
                {stats?.templates.fpt || 0}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">GPT Templates</span>
              <Badge variant="outline" className="bg-purple-50">
                {stats?.templates.gpt || 0}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Action Needed Section */}
      {((stats?.fpt.failed || 0) > 0 || (stats?.gpt.failed || 0) > 0 || (stats?.gpt.pendingBuyerApproval || 0) > 0) && (
        <Card className="p-6 border-l-4 border-red-500">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Action Required</h2>
              <div className="space-y-2">
                {(stats?.fpt.failed || 0) > 0 && (
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="text-sm font-medium text-gray-900">
                        {stats?.fpt.failed} Fabric Test{stats?.fpt.failed !== 1 ? 's' : ''} Failed
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/fabric-physical-tests?status=FAIL')}
                    >
                      Review
                    </Button>
                  </div>
                )}
                {(stats?.gpt.failed || 0) > 0 && (
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="text-sm font-medium text-gray-900">
                        {stats?.gpt.failed} Garment Test{stats?.gpt.failed !== 1 ? 's' : ''} Failed
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/garment-physical-tests?status=FAIL')}
                    >
                      Review
                    </Button>
                  </div>
                )}
                {(stats?.gpt.pendingBuyerApproval || 0) > 0 && (
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-orange-600" />
                      <span className="text-sm font-medium text-gray-900">
                        {stats?.gpt.pendingBuyerApproval} Garment Test{stats?.gpt.pendingBuyerApproval !== 1 ? 's' : ''} Pending Buyer Approval
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/garment-physical-tests?pendingBuyerApproval=true')}
                    >
                      Review
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Fabric Testing</h2>
          <div className="space-y-3">
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => navigate('/fabric-physical-tests/new')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Create New FPT
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => navigate('/fabric-physical-tests?status=PENDING')}
            >
              <Clock className="h-4 w-4 mr-2" />
              View Pending Tests
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Garment Testing</h2>
          <div className="space-y-3">
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => navigate('/garment-physical-tests/new')}
            >
              <Shirt className="h-4 w-4 mr-2" />
              Create New GPT
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => navigate('/garment-physical-tests?status=PENDING')}
            >
              <Clock className="h-4 w-4 mr-2" />
              View Pending Tests
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
