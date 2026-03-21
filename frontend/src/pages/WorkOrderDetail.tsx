// Work Order Detail Page - View production run details
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Factory, Calendar, MapPin, User, Clock, Scissors, Shirt, CheckSquare, ExternalLink, Plus, Package, AlertCircle, Zap, ArrowRight, UserCheck, ShoppingCart, DollarSign, Loader2, GitBranch, FileText } from 'lucide-react';
import { notify } from '../lib/notify';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ConfirmDialog from '@/components/ConfirmDialog';
import workOrderService from '@/services/workOrder.service';
import { cuttingBatchService } from '@/services/cutting.service';
import { stitchingIssueService } from '@/services/stitching.service';
import { finishingIssueService } from '@/services/finishing.service';
import { getServiceRequirementsSummary, calculateServices } from '@/services/serviceRequirement.service';
import type { ServiceRequirementsSummary } from '@/types/serviceRequirement.types';
import { ServiceTypeLabels } from '@/types/serviceRequirement.types';
import type { WorkOrder, OrderStatus, Priority } from '@/types/production.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import SplitProductionModal from '@/components/SplitProductionModal';
import AdminOverrideModal from '@/components/AdminOverrideModal';

interface ManufacturingProgress {
  cutting: { batches: number; totalCut: number; pending: boolean };
  stitching: { issues: number; totalStitched: number; pending: boolean };
  finishing: { issues: number; totalFinished: number; pending: boolean };
}

interface MaterialReadiness {
  isReady: boolean;
  totalMaterials: number;
  availableMaterials: number;
  hasApprovedBom: boolean;
  missingMaterials: Array<{
    materialName: string;
    materialCode: string;
    required: number;
    available: number;
    shortfall: number;
    unit: string;
  }>;
}

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manufacturingProgress, setManufacturingProgress] = useState<ManufacturingProgress>({
    cutting: { batches: 0, totalCut: 0, pending: true },
    stitching: { issues: 0, totalStitched: 0, pending: true },
    finishing: { issues: 0, totalFinished: 0, pending: true },
  });
  const [materialReadiness, setMaterialReadiness] = useState<MaterialReadiness | null>(null);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [isPushingToCutting, setIsPushingToCutting] = useState(false);
  const [pushToCuttingDialogOpen, setPushToCuttingDialogOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [serverBlockers, setServerBlockers] = useState<Array<{ type: string; message: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' }>>([]);

  // Service Requirements State
  const [serviceRequirementsSummary, setServiceRequirementsSummary] = useState<ServiceRequirementsSummary | null>(null);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isCalculatingServices, setIsCalculatingServices] = useState(false);

  useEffect(() => {
    if (id) {
      loadWorkOrder();
      loadManufacturingProgress();
      loadMaterialReadiness();
      loadServiceRequirements();
    }
  }, [id]);

  const loadWorkOrder = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await workOrderService.getById(id!);
      setWorkOrder(data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to load production run');
    } finally {
      setIsLoading(false);
    }
  };

  const loadManufacturingProgress = async () => {
    try {
      // Load cutting batches for this work order
      const [cuttingRes, stitchingRes, finishingRes] = await Promise.all([
        cuttingBatchService.getAll({ workOrderId: id, limit: 100 }).catch(() => ({ data: [], pagination: { total: 0 } })),
        stitchingIssueService.getAll({ workOrderId: id, limit: 100 }).catch(() => ({ data: [], pagination: { total: 0 } })),
        finishingIssueService.getAll({ workOrderId: id, limit: 100 }).catch(() => ({ data: [], pagination: { total: 0 } })),
      ]);

      // Calculate cutting progress
      const cuttingBatches = cuttingRes.data || [];
      const totalCut = cuttingBatches.reduce((sum: number, b: any) => {
        const skuTotal = b.skuBreakdown?.reduce((s: number, sku: any) => s + (sku.cutQty || 0), 0) || 0;
        return sum + skuTotal;
      }, 0);

      // Calculate stitching progress
      const stitchingIssues = stitchingRes.data || [];
      const totalStitched = stitchingIssues.reduce((sum: number, i: any) => {
        const outputs = i.dailyOutputs?.flatMap((o: any) => o.skuOutputs || []) || [];
        return sum + outputs.reduce((s: number, o: any) => s + (o.goodQty || 0), 0);
      }, 0);

      // Calculate finishing progress
      const finishingIssues = finishingRes.data || [];
      const totalFinished = finishingIssues.reduce((sum: number, i: any) => {
        const outputs = i.dailyOutputs?.flatMap((o: any) => o.skuOutputs || []) || [];
        return sum + outputs.reduce((s: number, o: any) => s + (o.finishedQty || 0), 0);
      }, 0);

      setManufacturingProgress({
        cutting: { batches: cuttingBatches.length, totalCut, pending: cuttingBatches.length === 0 },
        stitching: { issues: stitchingIssues.length, totalStitched, pending: stitchingIssues.length === 0 },
        finishing: { issues: finishingIssues.length, totalFinished, pending: finishingIssues.length === 0 },
      });
    } catch (err) {
      console.error('Failed to load manufacturing progress:', err);
    }
  };

  const loadMaterialReadiness = async () => {
    if (!id) return;
    try {
      setIsLoadingMaterials(true);
      const readiness = await workOrderService.checkMaterialReadiness(id);
      setMaterialReadiness(readiness);
    } catch (err) {
      console.error('Failed to load material readiness:', err);
    } finally {
      setIsLoadingMaterials(false);
    }
  };

  const loadServiceRequirements = async () => {
    if (!id) return;
    try {
      setIsLoadingServices(true);
      const summary = await getServiceRequirementsSummary(id);
      setServiceRequirementsSummary(summary);
    } catch (err) {
      console.error('Failed to load service requirements:', err);
      // Silently fail - service requirements are optional
    } finally {
      setIsLoadingServices(false);
    }
  };

  const handleCalculateServices = async () => {
    if (!id) return;
    try {
      setIsCalculatingServices(true);
      // Get user ID from auth store - adjust this based on your auth implementation
      const userId = localStorage.getItem('userId') || '';
      await calculateServices(id, userId);
      await loadServiceRequirements();
      handleApiSuccess('Services Calculated', 'Service requirements have been calculated successfully');
    } catch (err: any) {
      handleApiError(err, 'Failed to calculate services');
    } finally {
      setIsCalculatingServices(false);
    }
  };

  // Handle push to cutting click - opens confirmation dialog or override modal
  const handlePushToCuttingClick = () => {
    if (!id) return;
    if (materialReadiness && !materialReadiness.isReady) {
      setOverrideModalOpen(true);
    } else {
      setPushToCuttingDialogOpen(true);
    }
  };

  // Confirm push to cutting - executes after user confirms (materials ready path)
  const confirmPushToCutting = async () => {
    if (!id) return;

    try {
      setIsPushingToCutting(true);
      await workOrderService.pushToCutting(id);
      navigate(`/manufacturing/cutting/new?workOrderId=${id}`);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Failed to push to cutting';
      const blockers = err?.response?.data?.blockers;

      if (blockers && blockers.length > 0) {
        // Show override modal with server-returned blockers so admin can override
        setServerBlockers(blockers);
        setOverrideModalOpen(true);
      } else {
        notify.error(errorMsg);
      }
    } finally {
      setIsPushingToCutting(false);
    }
  };

  // Confirm push to cutting with admin override (materials missing path)
  const handleOverrideConfirm = async (reason: string) => {
    if (!id) return;
    setOverrideModalOpen(false);
    try {
      setIsPushingToCutting(true);
      await workOrderService.pushToCutting(id, true, reason);
      notify.success('Work order pushed to cutting (override applied)');
      navigate(`/manufacturing/cutting/new?workOrderId=${id}`);
    } catch (err: any) {
      handleApiError(err, 'Failed to push to cutting');
    } finally {
      setIsPushingToCutting(false);
    }
  };

  const getStatusVariant = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return 'warning' as const;
      case 'IN_PRODUCTION':
        return 'info' as const;
      case 'COMPLETED':
        return 'success' as const;
      case 'DISPATCHED':
        return 'success' as const;
      case 'CANCELLED':
        return 'destructive' as const;
      case 'SPLIT':
        return 'secondary' as const;
      default:
        return 'secondary' as const;
    }
  };

  const getPriorityVariant = (priority: Priority) => {
    switch (priority) {
      case 'URGENT':
        return 'destructive' as const;
      case 'HIGH':
        return 'warning' as const;
      case 'MEDIUM':
        return 'info' as const;
      case 'LOW':
        return 'success' as const;
      default:
        return 'secondary' as const;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const calculateProgress = () => {
    if (!workOrder || workOrder.totalQuantity === 0) return 0;
    return Math.round((workOrder.completedQuantity / workOrder.totalQuantity) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/production/work-orders')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Production Runs
        </Button>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="container mx-auto py-6">
        <Alert>
          <AlertDescription>Production run not found</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/production/work-orders')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Production Runs
        </Button>
      </div>
    );
  }

  const progress = calculateProgress();

  return (
    <>
      <PageHeader title={`Production Run: ${workOrder.workOrderNumber}`}>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/production/work-orders')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
          </Button>
          {workOrder.status === 'PENDING' && (
            <Button
              onClick={handlePushToCuttingClick}
              disabled={isPushingToCutting}
              className={materialReadiness?.isReady ? "bg-green-600 hover:bg-green-700" : ""}
              variant={materialReadiness?.isReady ? "default" : "outline"}
            >
              <Scissors className="mr-2 h-4 w-4" />
              {isPushingToCutting ? 'Pushing...' : 'Push to Cutting'}
            </Button>
          )}
          {workOrder.status === 'PENDING' && materialReadiness?.isReady && (
            <Button
              onClick={handleCalculateServices}
              disabled={isCalculatingServices}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isCalculatingServices ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Calculate Services
                </>
              )}
            </Button>
          )}
          {workOrder.status === 'PENDING' && (
            <Button variant="outline" onClick={() => navigate(`/production/work-orders/${id}/edit`)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {['PENDING', 'IN_PRODUCTION'].includes(workOrder.status) && !workOrder.parentRunId && (
            <Button variant="outline" onClick={() => setIsSplitModalOpen(true)}>
              <GitBranch className="mr-2 h-4 w-4" />
              Split Run
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-6">
        {/* Parent Run Banner */}
        {workOrder.parentRun && (
          <Alert className="bg-blue-50 border-blue-200">
            <GitBranch className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              This is a split child run from{' '}
              <span
                className="font-medium text-blue-600 cursor-pointer hover:underline"
                onClick={() => navigate(`/production/work-orders/${workOrder.parentRun!.id}`)}
              >
                {workOrder.parentRun.workOrderNumber}
              </span>
              {workOrder.splitReason && (
                <span className="text-muted-foreground ml-2">— {workOrder.splitReason}</span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Split Status Banner */}
        {workOrder.status === 'SPLIT' && (
          <Alert className="bg-amber-50 border-amber-200">
            <GitBranch className="h-4 w-4 text-amber-600" />
            <AlertDescription>
              This production run has been split into{' '}
              <strong>{workOrder.childRuns?.length || 0}</strong> child runs.
              The parent is now a container — production continues in child runs below.
            </AlertDescription>
          </Alert>
        )}

        {/* Status & Progress Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5" />
              Status Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-gray-500 mb-1">Status</div>
                <StatusBadge
                  status={workOrder.status.replace(/_/g, ' ')}
                  variant={getStatusVariant(workOrder.status)}
                />
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Priority</div>
                <StatusBadge status={workOrder.priority} variant={getPriorityVariant(workOrder.priority)} />
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Quantity</div>
                <div className="font-semibold text-lg">
                  {workOrder.completedQuantity} / {workOrder.totalQuantity}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Progress</div>
                <div className="font-semibold text-lg">{progress}%</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    progress === 100 ? 'bg-green-600' : 'bg-blue-600'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Material Readiness Card */}
        {workOrder.status === 'PENDING' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Material Readiness
              </CardTitle>
              <CardDescription>
                Fabric availability status for cutting stage
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingMaterials ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : materialReadiness ? (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                      materialReadiness.isReady
                        ? 'bg-green-100 text-green-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {materialReadiness.isReady ? (
                        <CheckSquare className="h-5 w-5" />
                      ) : (
                        <AlertCircle className="h-5 w-5" />
                      )}
                      <span className="font-semibold">
                        {materialReadiness.isReady
                          ? 'All Materials Available'
                          : 'Materials Missing'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {materialReadiness.availableMaterials} / {materialReadiness.totalMaterials} materials ready
                    </div>
                  </div>

                  {/* Missing Materials */}
                  {materialReadiness.missingMaterials.length > 0 && (
                    <div className="border border-amber-200 rounded-lg p-4 bg-amber-50">
                      <h4 className="font-medium text-amber-900 mb-3">Missing Materials:</h4>
                      <div className="space-y-2">
                        {materialReadiness.missingMaterials.map((material, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <div>
                              <span className="font-medium text-gray-900">{material.materialName}</span>
                              <span className="text-gray-500 ml-2">({material.materialCode})</span>
                            </div>
                            <div className="text-right">
                              <div className="text-red-600 font-medium">
                                Short: {material.shortfall.toFixed(2)} {material.unit}
                              </div>
                              <div className="text-xs text-gray-500">
                                Need: {material.required.toFixed(2)}, Have: {material.available.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Alert className="mt-4 bg-white border-amber-300">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-900">
                          Cannot push to cutting until all fabrics are received and in stock.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {/* Ready State */}
                  {materialReadiness.isReady && materialReadiness.totalMaterials > 0 && (
                    <Alert className="bg-green-50 border-green-300">
                      <CheckSquare className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-900">
                        All required fabrics are in stock. You can push this production run to cutting.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* No Approved BOM State */}
                  {!materialReadiness.hasApprovedBom && (
                    <Alert className="bg-amber-50 border-amber-300">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-900">
                        No approved Order BOM found. Please approve the Order BOM first, or you can proceed to cutting without material validation.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Has BOM but no fabric items */}
                  {materialReadiness.hasApprovedBom && materialReadiness.totalMaterials === 0 && (
                    <Alert className="bg-blue-50 border-blue-300">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-900">
                        No fabric items found in the Order BOM. You can proceed to cutting without material validation.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="text-gray-500 text-sm">No material information available</div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Service Requirements Summary Card */}
        {workOrder.status !== 'CANCELLED' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5 text-purple-600" />
                    Service Requirements
                  </CardTitle>
                  <CardDescription>
                    Embroidery, printing, dyeing, and other process services
                  </CardDescription>
                </div>
                {serviceRequirementsSummary && serviceRequirementsSummary.totalServices > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/procurement/requirements?tab=outsourced&workOrderId=${id}`)}
                    className="text-purple-600 border-purple-600 hover:bg-purple-50"
                  >
                    View All Services <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingServices ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading service requirements...
                </div>
              ) : serviceRequirementsSummary && serviceRequirementsSummary.totalServices > 0 ? (
                <div className="space-y-4">
                  {/* Statistics Grid - 2x2 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Package className="h-4 w-4 text-blue-600" />
                        <div className="text-2xl font-bold text-blue-700">
                          {serviceRequirementsSummary.totalServices}
                        </div>
                      </div>
                      <div className="text-xs text-blue-600">Total Services</div>
                    </div>

                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-orange-600" />
                        <div className="text-2xl font-bold text-orange-700">
                          {serviceRequirementsSummary.pendingCount}
                        </div>
                      </div>
                      <div className="text-xs text-orange-600">Pending</div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <CheckSquare className="h-4 w-4 text-green-600" />
                        <div className="text-2xl font-bold text-green-700">
                          {serviceRequirementsSummary.poGeneratedCount + serviceRequirementsSummary.completedCount}
                        </div>
                      </div>
                      <div className="text-xs text-green-600">PO Generated</div>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-purple-600" />
                        <div className="text-2xl font-bold text-purple-700">
                          ₹{serviceRequirementsSummary.totalEstimatedCost.toFixed(0)}
                        </div>
                      </div>
                      <div className="text-xs text-purple-600">Est. Total Cost</div>
                    </div>
                  </div>

                  {/* Service Type Breakdown */}
                  {Object.keys(serviceRequirementsSummary.byServiceType).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">By Service Type:</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                        {Object.entries(serviceRequirementsSummary.byServiceType).map(([type, count]) => (
                          <div key={type} className="border rounded-lg p-2 text-center">
                            <div className="font-bold text-lg">{count}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {ServiceTypeLabels[type as keyof typeof ServiceTypeLabels]}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Processor Assignment Status */}
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="flex items-center gap-6">
                      <div>
                        <span className="text-sm text-muted-foreground">Processor Assigned:</span>
                        <div className="font-bold text-green-600">
                          {serviceRequirementsSummary.servicesWithProcessor} / {serviceRequirementsSummary.totalServices}
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Unassigned:</span>
                        <div className="font-bold text-red-600">
                          {serviceRequirementsSummary.servicesWithoutProcessor}
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex gap-2">
                      {serviceRequirementsSummary.servicesWithoutProcessor > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/service-requirements/list?workOrderId=${id}&status=PENDING`)}
                          className="text-purple-600 border-purple-600 hover:bg-purple-50"
                        >
                          <UserCheck className="h-4 w-4 mr-1" />
                          Assign Processors
                        </Button>
                      )}
                      {serviceRequirementsSummary.servicesWithProcessor > 0 &&
                        serviceRequirementsSummary.pendingCount > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/service-requirements/list?workOrderId=${id}&status=PENDING`)}
                          className="text-green-600 border-green-600 hover:bg-green-50"
                        >
                          <ShoppingCart className="h-4 w-4 mr-1" />
                          Generate Service POs
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="mb-4">No service requirements calculated</p>
                  <Button
                    size="sm"
                    onClick={handleCalculateServices}
                    disabled={isCalculatingServices}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isCalculatingServices ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Calculating...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Calculate Services
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Manufacturing Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5" />
              Manufacturing Progress
            </CardTitle>
            <CardDescription>
              Track production through cutting, stitching, and finishing stages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Cutting */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scissors className="h-5 w-5 text-orange-600" />
                    <span className="font-medium">Cutting</span>
                  </div>
                  {manufacturingProgress.cutting.batches > 0 && (
                    <span className="text-sm text-gray-500">
                      {manufacturingProgress.cutting.batches} batch(es)
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold text-orange-600">
                  {manufacturingProgress.cutting.totalCut} pcs
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-orange-500"
                    style={{
                      width: `${workOrder?.totalQuantity ? Math.min(100, (manufacturingProgress.cutting.totalCut / workOrder.totalQuantity) * 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  {manufacturingProgress.cutting.pending && (
                    <Button
                      size="sm"
                      onClick={() => navigate(`/manufacturing/cutting/new?workOrderId=${id}`)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Start Cutting
                    </Button>
                  )}
                  {manufacturingProgress.cutting.batches > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                    >
                      <Link to={`/manufacturing/cutting?workOrderId=${id}`}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View Batches
                      </Link>
                    </Button>
                  )}
                </div>
              </div>

              {/* Stitching */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shirt className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Stitching</span>
                  </div>
                  {manufacturingProgress.stitching.issues > 0 && (
                    <span className="text-sm text-gray-500">
                      {manufacturingProgress.stitching.issues} issue(s)
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {manufacturingProgress.stitching.totalStitched} pcs
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{
                      width: `${workOrder?.totalQuantity ? Math.min(100, (manufacturingProgress.stitching.totalStitched / workOrder.totalQuantity) * 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  {manufacturingProgress.stitching.pending && manufacturingProgress.cutting.totalCut > 0 && (
                    <Button
                      size="sm"
                      onClick={() => navigate(`/manufacturing/stitching/new?workOrderId=${id}`)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Start Stitching
                    </Button>
                  )}
                  {manufacturingProgress.stitching.issues > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                    >
                      <Link to={`/manufacturing/stitching?workOrderId=${id}`}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View Issues
                      </Link>
                    </Button>
                  )}
                  {manufacturingProgress.stitching.pending && manufacturingProgress.cutting.totalCut === 0 && (
                    <span className="text-sm text-gray-500 italic">
                      Complete cutting first
                    </span>
                  )}
                </div>
              </div>

              {/* Finishing */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Finishing</span>
                  </div>
                  {manufacturingProgress.finishing.issues > 0 && (
                    <span className="text-sm text-gray-500">
                      {manufacturingProgress.finishing.issues} issue(s)
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {manufacturingProgress.finishing.totalFinished} pcs
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-green-500"
                    style={{
                      width: `${workOrder?.totalQuantity ? Math.min(100, (manufacturingProgress.finishing.totalFinished / workOrder.totalQuantity) * 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  {manufacturingProgress.finishing.pending && manufacturingProgress.stitching.totalStitched > 0 && (
                    <Button
                      size="sm"
                      onClick={() => navigate(`/manufacturing/finishing/new?workOrderId=${id}`)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Start Finishing
                    </Button>
                  )}
                  {manufacturingProgress.finishing.issues > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                    >
                      <Link to={`/manufacturing/finishing?workOrderId=${id}`}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View Issues
                      </Link>
                    </Button>
                  )}
                  {manufacturingProgress.finishing.pending && manufacturingProgress.stitching.totalStitched === 0 && (
                    <span className="text-sm text-gray-500 italic">
                      Complete stitching first
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order & Style Details */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Order Number</span>
                <span
                  className="font-medium text-blue-600 cursor-pointer hover:underline"
                  onClick={() => navigate(`/orders/${workOrder.orderId}`)}
                >
                  {workOrder.orders?.orderNumber || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Customer</span>
                <span className="font-medium">{workOrder.orders?.customers?.name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Style Code</span>
                <span className="font-medium">{workOrder.style?.styleCode || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Style Name</span>
                <span className="font-medium">{workOrder.style?.styleName || '-'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Planned Start</span>
                <span className="font-medium">{formatDate(workOrder.plannedStartDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Planned End</span>
                <span className="font-medium">{formatDate(workOrder.plannedEndDate)}</span>
              </div>
              {workOrder.actualStartDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Actual Start</span>
                  <span className="font-medium">{formatDate(workOrder.actualStartDate)}</span>
                </div>
              )}
              {workOrder.actualEndDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Actual End</span>
                  <span className="font-medium">{formatDate(workOrder.actualEndDate)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Location & Additional Info */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Production Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              {workOrder.warehouses ? (
                <div className="space-y-2">
                  <div className="font-medium text-lg">{workOrder.warehouses.warehouseName}</div>
                  <div className="text-gray-500">{workOrder.warehouses.warehouseCode}</div>
                  {workOrder.warehouses.address && (
                    <div className="text-sm text-gray-600">{workOrder.warehouses.address}</div>
                  )}
                </div>
              ) : (
                <div className="text-amber-600 font-medium">Not Assigned</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Created By
              </CardTitle>
            </CardHeader>
            <CardContent>
              {workOrder.usersWorkOrdersCreatedByIdTousers ? (
                <div className="space-y-2">
                  <div className="font-medium">
                    {workOrder.usersWorkOrdersCreatedByIdTousers.firstName}{' '}
                    {workOrder.usersWorkOrdersCreatedByIdTousers.lastName}
                  </div>
                  <div className="text-gray-500 text-sm">
                    {workOrder.usersWorkOrdersCreatedByIdTousers.email}
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">-</div>
              )}
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                Created: {formatDate(workOrder.createdAt)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Color/Size Breakup */}
        {workOrder.workOrderBreakup && workOrder.workOrderBreakup.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Color × Size Breakup</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Color
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Size
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Planned
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Completed
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Remaining
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {workOrder.workOrderBreakup.map((breakup) => (
                      <tr key={breakup.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          {breakup.colorOptions?.colorName || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">{breakup.sizeOptions?.sizeName || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          {breakup.plannedQuantity}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                          {breakup.completedQuantity}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-amber-600">
                          {breakup.plannedQuantity - breakup.completedQuantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-sm font-semibold">
                        Total
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold">
                        {workOrder.totalQuantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                        {workOrder.completedQuantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-amber-600">
                        {workOrder.totalQuantity - workOrder.completedQuantity}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Child Runs (if split) */}
        {workOrder.childRuns && workOrder.childRuns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Child Production Runs ({workOrder.childRuns.length})
              </CardTitle>
              <CardDescription>
                This production run was split into the following child runs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {workOrder.childRuns.map((child) => (
                  <div
                    key={child.id}
                    className="flex items-center justify-between border rounded-lg p-3 hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/production/work-orders/${child.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium text-primary">{child.workOrderNumber}</div>
                        {child.splitReason && (
                          <div className="text-xs text-muted-foreground">{child.splitReason}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-medium">{child.totalQuantity} pcs</div>
                        <div className="text-xs text-muted-foreground">
                          {child.completedQuantity} completed
                        </div>
                      </div>
                      <StatusBadge
                        status={child.status.replace(/_/g, ' ')}
                        variant={getStatusVariant(child.status)}
                      />
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Challans Section */}
        {workOrder.status !== 'CANCELLED' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Challans
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/manufacturing/challans?productionRunId=${id}`)}
                >
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
              <CardDescription>
                Material movement documents for this production run
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => navigate(`/manufacturing/challans/new?productionRunId=${id}`)}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Challan
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Remarks */}
        {workOrder.remarks && (
          <Card>
            <CardHeader>
              <CardTitle>Remarks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 whitespace-pre-wrap">{workOrder.remarks}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Push to Cutting Confirmation Dialog */}
      <ConfirmDialog
        open={pushToCuttingDialogOpen}
        onOpenChange={setPushToCuttingDialogOpen}
        title="Push to Cutting"
        description="Are you sure you want to push this production run to cutting? This will validate material availability and start production."
        confirmText="Push to Cutting"
        cancelText="Cancel"
        onConfirm={confirmPushToCutting}
        variant="default"
      />

      {/* Override Modal - for pushing to cutting when materials are short */}
      <AdminOverrideModal
        isOpen={overrideModalOpen}
        onClose={() => { setOverrideModalOpen(false); setServerBlockers([]); }}
        onConfirm={handleOverrideConfirm}
        action="Push to Cutting"
        blockers={
          serverBlockers.length > 0
            ? serverBlockers
            : (materialReadiness?.missingMaterials.map(m => ({
                type: 'MATERIAL_SHORTAGE',
                message: `${m.materialName} (${m.materialCode}): Need ${m.required.toFixed(2)} ${m.unit}, Have ${m.available.toFixed(2)} ${m.unit}, Short ${m.shortfall.toFixed(2)} ${m.unit}`,
                severity: 'CRITICAL' as const,
              })) ?? [])
        }
      />

      {/* Split Production Modal */}
      {workOrder && (
        <SplitProductionModal
          isOpen={isSplitModalOpen}
          onClose={() => setIsSplitModalOpen(false)}
          workOrder={workOrder}
          onSplitComplete={() => {
            setIsSplitModalOpen(false);
            loadWorkOrder();
            handleApiSuccess('Production Run Split', 'Production run has been split successfully');
          }}
        />
      )}
    </>
  );
}
