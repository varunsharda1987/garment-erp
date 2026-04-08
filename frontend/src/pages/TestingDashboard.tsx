import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Building2, FileText, Shirt, XCircle, Clock, AlertTriangle } from 'lucide-react';
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

      // Fetch all data in parallel with error handling for incomplete features
      const results = await Promise.allSettled([
        fabricPhysicalTestsService.getAll({ limit: 1 }).catch(() => ({ pagination: { total: 0 }, data: [] })),
        garmentPhysicalTestsService.getAll({ limit: 1 }).catch(() => ({ pagination: { total: 0 }, data: [] })),
        testingLabsService.getAll({ limit: 1 }),
        testTemplatesService.getAll({ limit: 1 }),
      ]);

      const [fptResult, gptResult, labsResult, templatesResult] = results;
      const fptData = fptResult.status === 'fulfilled' ? fptResult.value : { pagination: { total: 0 }, data: [] };
      const gptData = gptResult.status === 'fulfilled' ? gptResult.value : { pagination: { total: 0 }, data: [] };
      const labsData = labsResult.status === 'fulfilled' ? labsResult.value : { pagination: { total: 0 }, data: [] };
      const templatesData =
        templatesResult.status === 'fulfilled' ? templatesResult.value : { pagination: { total: 0 }, data: [] };

      // Get count for each status with error handling
      const fptStatusResults = await Promise.allSettled([
        fabricPhysicalTestsService
          .getAll({ limit: 1, overallTestResult: 'PENDING' })
          .catch(() => ({ pagination: { total: 0 } })),
        fabricPhysicalTestsService
          .getAll({ limit: 1, overallTestResult: 'PASS' })
          .catch(() => ({ pagination: { total: 0 } })),
        fabricPhysicalTestsService
          .getAll({ limit: 1, overallTestResult: 'FAIL' })
          .catch(() => ({ pagination: { total: 0 } })),
      ]);

      const [fptPending, fptPassed, fptFailed] = fptStatusResults.map((r) =>
        r.status === 'fulfilled' ? r.value : { pagination: { total: 0 } }
      );

      const gptStatusResults = await Promise.allSettled([
        garmentPhysicalTestsService
          .getAll({ limit: 1, overallTestResult: 'PENDING' })
          .catch(() => ({ pagination: { total: 0 } })),
        garmentPhysicalTestsService
          .getAll({ limit: 1, overallTestResult: 'PASS' })
          .catch(() => ({ pagination: { total: 0 } })),
        garmentPhysicalTestsService
          .getAll({ limit: 1, overallTestResult: 'FAIL' })
          .catch(() => ({ pagination: { total: 0 } })),
        garmentPhysicalTestsService
          .getAll({ limit: 1, pendingBuyerApproval: true })
          .catch(() => ({ pagination: { total: 0 } })),
      ]);

      const [gptPending, gptPassed, gptFailed, gptBuyerApproval] = gptStatusResults.map((r) =>
        r.status === 'fulfilled' ? r.value : { pagination: { total: 0 } }
      );

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-info mx-auto"></div>
          <p className="text-muted-foreground mt-4">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-medium text-foreground flex items-center gap-3">
          <FlaskConical className="h-8 w-8 text-info" />
          Testing Module Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage fabric and garment physical testing, labs, and test templates
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* FPT Card */}
        <Card
          className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-info"
          onClick={() => navigate('/fabric-physical-tests')}
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Fabric Tests (FPT)</p>
              <p className="text-3xl font-bold text-foreground mt-1">{stats?.fpt.total || 0}</p>
            </div>
            <div className="p-3 bg-info-muted rounded-lg">
              <FileText className="h-6 w-6 text-info" />
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pending</span>
              <Badge variant="outline" className="bg-warning-muted">
                {stats?.fpt.pending || 0}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Passed</span>
              <Badge variant="outline" className="bg-success-muted">
                {stats?.fpt.passed || 0}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Failed</span>
              <Badge variant="outline" className="bg-destructive/10">
                {stats?.fpt.failed || 0}
              </Badge>
            </div>
          </div>
        </Card>

        {/* GPT Card */}
        <Card
          className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-accent"
          onClick={() => navigate('/garment-physical-tests')}
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Garment Tests (GPT)</p>
              <p className="text-3xl font-bold text-foreground mt-1">{stats?.gpt.total || 0}</p>
            </div>
            <div className="p-3 bg-accent/10 rounded-lg">
              <Shirt className="h-6 w-6 text-accent" />
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pending</span>
              <Badge variant="outline" className="bg-warning-muted">
                {stats?.gpt.pending || 0}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Buyer Approval</span>
              <Badge variant="outline" className="bg-primary/10">
                {stats?.gpt.pendingBuyerApproval || 0}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Failed</span>
              <Badge variant="outline" className="bg-destructive/10">
                {stats?.gpt.failed || 0}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Testing Labs Card */}
        <Card
          className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-success"
          onClick={() => navigate('/testing-labs')}
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Testing Labs</p>
              <p className="text-3xl font-bold text-foreground mt-1">{stats?.labs.total || 0}</p>
            </div>
            <div className="p-3 bg-success-muted rounded-lg">
              <Building2 className="h-6 w-6 text-success" />
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active Labs</span>
              <Badge variant="outline" className="bg-success-muted">
                {stats?.labs.active || 0}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Test Templates Card */}
        <Card
          className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-primary"
          onClick={() => navigate('/test-templates')}
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Test Templates</p>
              <p className="text-3xl font-bold text-foreground mt-1">{stats?.templates.total || 0}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <FileText className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">FPT Templates</span>
              <Badge variant="outline" className="bg-info-muted">
                {stats?.templates.fpt || 0}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GPT Templates</span>
              <Badge variant="outline" className="bg-accent/10">
                {stats?.templates.gpt || 0}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Action Needed Section */}
      {((stats?.fpt.failed || 0) > 0 || (stats?.gpt.failed || 0) > 0 || (stats?.gpt.pendingBuyerApproval || 0) > 0) && (
        <Card className="p-6 border-l-4 border-l-destructive">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-display font-semibold text-foreground mb-2">Action Required</h2>
              <div className="space-y-2">
                {(stats?.fpt.failed || 0) > 0 && (
                  <div className="flex items-center justify-between p-3 bg-destructive/10 rounded">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-destructive" />
                      <span className="text-sm font-medium text-foreground">
                        {stats?.fpt.failed} Fabric Test{stats?.fpt.failed !== 1 ? 's' : ''} Failed
                      </span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate('/fabric-physical-tests?status=FAIL')}>
                      Review
                    </Button>
                  </div>
                )}
                {(stats?.gpt.failed || 0) > 0 && (
                  <div className="flex items-center justify-between p-3 bg-destructive/10 rounded">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-destructive" />
                      <span className="text-sm font-medium text-foreground">
                        {stats?.gpt.failed} Garment Test{stats?.gpt.failed !== 1 ? 's' : ''} Failed
                      </span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate('/garment-physical-tests?status=FAIL')}>
                      Review
                    </Button>
                  </div>
                )}
                {(stats?.gpt.pendingBuyerApproval || 0) > 0 && (
                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium text-foreground">
                        {stats?.gpt.pendingBuyerApproval} Garment Test{stats?.gpt.pendingBuyerApproval !== 1 ? 's' : ''}{' '}
                        Pending Buyer Approval
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
          <h2 className="text-lg font-display font-semibold text-foreground mb-4">Fabric Testing</h2>
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
          <h2 className="text-lg font-display font-semibold text-foreground mb-4">Garment Testing</h2>
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
