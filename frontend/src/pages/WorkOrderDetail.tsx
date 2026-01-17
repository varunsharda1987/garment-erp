// Work Order Detail Page - View production run details
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Factory, Calendar, MapPin, User, Clock, Scissors, Shirt, CheckSquare, ExternalLink, Plus, Package, AlertCircle } from 'lucide-react';
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
import type { WorkOrder, OrderStatus, Priority } from '@/types/production.types';

interface ManufacturingProgress {
  cutting: { batches: number; totalCut: number; pending: boolean };
  stitching: { issues: number; totalStitched: number; pending: boolean };
  finishing: { issues: number; totalFinished: number; pending: boolean };
}

interface MaterialReadiness {
  isReady: boolean;
  totalMaterials: number;
  availableMaterials: number;
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

  useEffect(() => {
    if (id) {
      loadWorkOrder();
      loadManufacturingProgress();
      loadMaterialReadiness();
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

  // Handle push to cutting click - opens confirmation dialog
  const handlePushToCuttingClick = () => {
    if (!id) return;
    setPushToCuttingDialogOpen(true);
  };

  // Confirm push to cutting - executes after user confirms
  const confirmPushToCutting = async () => {
    if (!id) return;

    try {
      setIsPushingToCutting(true);
      await workOrderService.pushToCutting(id);
      // Reload work order to get updated status
      await loadWorkOrder();
      await loadMaterialReadiness();
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Failed to push to cutting';
      const blockers = err?.response?.data?.blockers;

      if (blockers && blockers.length > 0) {
        const blockerMessages = blockers.map((b: any) => `• ${b.message}`).join('\n');
        alert(`Cannot push to cutting:\n\n${blockerMessages}`);
      } else {
        alert(errorMsg);
      }
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
              disabled={isPushingToCutting || (materialReadiness && !materialReadiness.isReady)}
              className={materialReadiness?.isReady ? "bg-green-600 hover:bg-green-700" : ""}
              variant={materialReadiness?.isReady ? "default" : "outline"}
            >
              <Scissors className="mr-2 h-4 w-4" />
              {isPushingToCutting ? 'Pushing...' : 'Push to Cutting'}
            </Button>
          )}
          {workOrder.status === 'PENDING' && (
            <Button variant="outline" onClick={() => navigate(`/production/work-orders/${id}/edit`)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-6">
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

                  {/* No Materials State */}
                  {materialReadiness.totalMaterials === 0 && (
                    <Alert className="bg-blue-50 border-blue-300">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-900">
                        No fabric BOM entries found for this style. Please add fabric requirements in the Style Master or you can proceed to cutting without material validation.
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
                <span className="font-medium">{workOrder.styles?.styleCode || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Style Name</span>
                <span className="font-medium">{workOrder.styles?.styleName || '-'}</span>
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
              {workOrder.locations ? (
                <div className="space-y-2">
                  <div className="font-medium text-lg">{workOrder.locations.locationName}</div>
                  <div className="text-gray-500">{workOrder.locations.locationCode}</div>
                  {workOrder.locations.address && (
                    <div className="text-sm text-gray-600">{workOrder.locations.address}</div>
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
    </>
  );
}
