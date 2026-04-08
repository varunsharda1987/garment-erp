import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Lock,
  Calculator,
  FileText,
  Package,
  ArrowLeftRight,
  Wrench,
  AlertTriangle,
  RefreshCw,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { PageHeader } from '../components/PageHeader';
import { LoadingSpinner } from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '../lib/api-error-handler';
import { formatCurrency } from '../lib/currency';
import {
  getById,
  updateOrderBOM,
  approveAndCalculateMRP,
  lockOrderBOM,
  changeWidth,
  getFabricCadOptions,
  getBOMItemDisplayName,
  getBOMItemCode,
  getStatusBadgeColor,
  calculateMRPStandalone,
  deactivateOrderBOM,
  createFromCostSheet,
} from '../services/orderBom.service';
import type { OrderBOM, OrderBOMItem, FabricCadOption } from '../types/orderBom.types';

const OrderBOMDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [bom, setBom] = useState<OrderBOM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Next-step banners (shown after approve/lock actions)
  const [justApprovedMsg, setJustApprovedMsg] = useState<string | null>(null);
  const [justLocked, setJustLocked] = useState(false);

  // Change Width modal state
  const [widthModalOpen, setWidthModalOpen] = useState(false);
  const [widthModalItem, setWidthModalItem] = useState<OrderBOMItem | null>(null);
  const [cadOptions, setCadOptions] = useState<FabricCadOption[]>([]);
  const [selectedCadId, setSelectedCadId] = useState<string | null>(null);
  const [cadLoading, setCadLoading] = useState(false);
  const [widthChanging, setWidthChanging] = useState(false);

  useEffect(() => {
    if (!id) {
      navigate('/order-bom');
      return;
    }
    fetchBOM();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate]);

  const fetchBOM = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getById(id!);
      setBom(data);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to fetch Order BOM', false);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const confirmApprove = async () => {
    if (!bom) return;
    try {
      const result = await approveAndCalculateMRP(bom.orderId, {
        styleId: bom.style?.id || '',
        calculateMRP: true,
        calculateServices: true,
      });

      // Build success message
      const details: string[] = [];
      if (result.mrpCalculated && result.mrp) {
        details.push(`${result.mrp.created + result.mrp.updated} material requirements calculated`);
      }
      if (result.servicesCalculated && result.services) {
        details.push(
          `${result.services.totalServicesCreated} service requirements for ${result.services.workOrdersProcessed} work order(s)`
        );
      }

      handleApiSuccess(
        'BOM Approved & Calculated',
        details.length > 0 ? details.join(', ') : 'Order BOM approved successfully'
      );
      setApproveDialogOpen(false);
      setJustApprovedMsg(details.length > 0 ? details.join('. ') : 'BOM approved successfully');
      await fetchBOM();

      // Show warnings for skipped items (most common issue)
      const skipped = result.mrp?.skipped || [];
      if (skipped.length > 0) {
        const skippedNames = skipped
          .map(
            (s: { componentName: string; materialType: string; reason: string }) =>
              `${s.componentName} (${s.materialType})`
          )
          .join(', ');
        handleApiError(
          new Error(
            `${skipped.length} BOM item(s) skipped during MRP: ${skippedNames}. These items need material master linkages (fabricId, laceId, etc.) to generate requirements.`
          ),
          'MRP Skipped Items'
        );
      }
      if (result.mrpWarning) {
        handleApiError(new Error(result.mrpWarning), 'MRP Warning');
      }

      // Show warnings if any sub-step failed
      if (result.mrpError) {
        handleApiError(new Error(result.mrpError), 'MRP calculation had issues');
      }
      if (result.serviceError) {
        handleApiError(new Error(result.serviceError), 'Service calculation had issues');
      }
    } catch (err: unknown) {
      handleApiError(err, 'Failed to approve Order BOM');
    }
  };

  const handleRegenerate = async () => {
    if (!bom || !bom.sourceCostSheetId) return;
    setRegenerating(true);
    try {
      await deactivateOrderBOM(bom.orderId, bom.styleId);
      const newBom = await createFromCostSheet(bom.orderId, {
        styleId: bom.styleId,
        costSheetId: bom.sourceCostSheetId,
        orderItemId: bom.orderItemId ?? undefined,
      });
      handleApiSuccess('BOM regenerated successfully');
      setRegenerateDialogOpen(false);
      navigate(`/order-bom/${newBom.id}`, { replace: true });
    } catch (err) {
      handleApiError(err, 'Failed to regenerate BOM');
    } finally {
      setRegenerating(false);
    }
  };

  const handleCalculateMRP = async () => {
    if (!bom) return;
    try {
      const result = await calculateMRPStandalone(bom.orderId, {
        styleId: bom.style?.id || '',
      });
      const totalCalc = result.created + result.updated;
      handleApiSuccess(
        'MRP Recalculated',
        `${totalCalc} material requirements calculated (${result.created} created, ${result.updated} updated)`
      );

      // Show skipped items warning
      const skipped = result.skipped || [];
      if (skipped.length > 0) {
        const skippedNames = skipped
          .map((s: { componentName: string; materialType: string }) => `${s.componentName} (${s.materialType})`)
          .join(', ');
        handleApiError(
          new Error(`${skipped.length} BOM item(s) skipped: ${skippedNames}. Link material masters to fix.`),
          'MRP Skipped Items'
        );
      }
    } catch (err: unknown) {
      handleApiError(err, 'Failed to calculate MRP');
    }
  };

  const confirmLock = async () => {
    if (!bom) return;
    try {
      await lockOrderBOM(bom.orderId, bom.style?.id);
      handleApiSuccess('Order BOM Locked', 'The Order BOM has been locked for production.');
      setLockDialogOpen(false);
      setJustLocked(true);
      fetchBOM();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to lock Order BOM');
    }
  };

  const openWidthModal = async (item: OrderBOMItem) => {
    if (!item.fabricId) return;
    setWidthModalItem(item);
    setSelectedCadId(null);
    setWidthModalOpen(true);
    setCadLoading(true);
    try {
      const options = await getFabricCadOptions(item.fabricId);
      setCadOptions(options);
    } catch (err: unknown) {
      handleApiError(err, 'Failed to fetch CAD width options');
      setCadOptions([]);
    } finally {
      setCadLoading(false);
    }
  };

  const confirmChangeWidth = async () => {
    if (!bom || !widthModalItem || !selectedCadId) return;
    setWidthChanging(true);
    try {
      await changeWidth(bom.id, {
        fabricItemChanges: [{ bomItemId: widthModalItem.id, newCadId: selectedCadId }],
      });
      handleApiSuccess('Width Changed', 'A new BOM version has been created with the updated fabric width.');
      setWidthModalOpen(false);
      fetchBOM();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to change fabric width');
    } finally {
      setWidthChanging(false);
    }
  };

  const handleWastageChange = useCallback(
    async (itemId: string, newWastage: number) => {
      if (!bom) return;
      const clamped = Math.min(100, Math.max(0, newWastage));
      const items = (bom.items || []).map((item) => ({
        materialType: item.materialType,
        materialId: item.materialId || undefined,
        buttonId: item.buttonId || undefined,
        threadId: item.threadId || undefined,
        zipperId: item.zipperId || undefined,
        laceId: item.laceId || undefined,
        elasticId: item.elasticId || undefined,
        labelId: item.labelId || undefined,
        packagingId: item.packagingId || undefined,
        fabricId: item.fabricId || undefined,
        greigeId: item.greigeId || undefined,
        sourcingStrategy: item.sourcingStrategy || undefined,
        processorId: item.processorId || undefined,
        greigeCost: item.greigeCost ? Number(item.greigeCost) : undefined,
        processingCost: item.processingCost ? Number(item.processingCost) : undefined,
        rateCardId: item.rateCardId || undefined,
        colorName: item.colorName || undefined,
        quantityPerGarment: Number(item.quantityPerGarment),
        orderQuantity: Number(item.orderQuantity),
        wastagePercent: item.id === itemId ? clamped : Number(item.wastagePercent ?? 0),
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        componentName: item.componentName || undefined,
        usageCategory: item.usageCategory || undefined,
        notes: item.notes || undefined,
        sortOrder: item.sortOrder,
      }));
      try {
        await updateOrderBOM(bom.orderId, { items }, bom.style?.id);
        await fetchBOM();
      } catch (err: unknown) {
        handleApiError(err, 'Failed to update wastage');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bom]
  );

  if (loading) {
    return (
      <div className="p-6">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !bom) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive mb-4">{error || 'Order BOM not found'}</p>
            <Button onClick={() => navigate('/order-bom')}>Back to List</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isDraft = bom.status === 'DRAFT';
  const isApproved = bom.status === 'APPROVED';
  const isLocked = bom.status === 'LOCKED';

  return (
    <>
      <PageHeader title="Order BOM Details">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/order-bom')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>

          {isDraft && (
            <>
              {bom.sourceCostSheetId && (
                <Button
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/10"
                  onClick={() => setRegenerateDialogOpen(true)}
                  disabled={regenerating}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate from Cost Sheet
                </Button>
              )}
              <Button className="bg-success hover:bg-success" onClick={() => setApproveDialogOpen(true)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </>
          )}

          {isApproved && (
            <>
              <Button
                variant="outline"
                className="border-accent text-accent hover:bg-accent/10"
                onClick={() => navigate(`/procurement/requirements?tab=material&orderId=${bom.orderId}`)}
              >
                <FileText className="h-4 w-4 mr-2" />
                View MRP Requirements
              </Button>
              <Button
                variant="outline"
                className="border-primary text-primary hover:bg-primary/10"
                onClick={() => navigate(`/procurement/requirements?tab=outsourced&orderId=${bom.orderId}`)}
              >
                <Wrench className="h-4 w-4 mr-2" />
                View Outsourced Work
              </Button>
              <Button
                variant="outline"
                className="border-info text-info hover:bg-info-muted"
                onClick={handleCalculateMRP}
              >
                <Calculator className="h-4 w-4 mr-2" />
                Calculate MRP
              </Button>
              <Button className="bg-info hover:bg-info" onClick={() => setLockDialogOpen(true)}>
                <Lock className="h-4 w-4 mr-2" />
                Lock for Production
              </Button>
            </>
          )}

          {isLocked && (
            <>
              <Button
                variant="outline"
                className="border-accent text-accent hover:bg-accent/10"
                onClick={() => navigate(`/procurement/requirements?tab=material&orderId=${bom.orderId}`)}
              >
                <FileText className="h-4 w-4 mr-2" />
                View MRP Requirements
              </Button>
              <Button
                variant="outline"
                className="border-primary text-primary hover:bg-primary/10"
                onClick={() => navigate(`/procurement/requirements?tab=outsourced&orderId=${bom.orderId}`)}
              >
                <Wrench className="h-4 w-4 mr-2" />
                View Outsourced Work
              </Button>
            </>
          )}
        </div>
      </PageHeader>

      {/* Next-step banner after BOM approval */}
      {justApprovedMsg && isApproved && (
        <Alert className="mb-6 bg-success-muted border-success/20">
          <CheckCircle className="h-4 w-4 text-success" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-success">
              <strong>BOM Approved & MRP Calculated</strong> — {justApprovedMsg}
            </span>
            <div className="flex gap-2 ml-4 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="border-accent/50 text-accent hover:bg-accent/10"
                onClick={() => navigate(`/procurement/requirements?tab=material&orderId=${bom.orderId}`)}
              >
                View Requirements <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
              <Button size="sm" className="bg-info hover:bg-info" onClick={() => setLockDialogOpen(true)}>
                Lock for Production <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setJustApprovedMsg(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Next-step banner after BOM lock */}
      {justLocked && isLocked && (
        <Alert className="mb-6 bg-info-muted border-info/20">
          <Lock className="h-4 w-4 text-info" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-info">
              <strong>BOM Locked for Production</strong> — Ready for procurement and cutting.
            </span>
            <div className="flex gap-2 ml-4 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="border-accent/50 text-accent hover:bg-accent/10"
                onClick={() => navigate(`/procurement/requirements?tab=material&orderId=${bom.orderId}`)}
              >
                View Requirements <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/production/work-orders?orderId=${bom.orderId}`)}
              >
                View Work Orders <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setJustLocked(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Header Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-display font-medium">{bom.order?.orderNumber || 'Order BOM'}</h2>
                <Badge variant="outline" className="text-sm">
                  v{bom.version}
                </Badge>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(bom.status)}`}>
                  {bom.status}
                </span>
              </div>
              <p className="text-muted-foreground text-lg">
                {bom.style?.styleCode} - {bom.style?.styleName}
              </p>
              <div className="mt-3 text-sm text-muted-foreground space-y-1">
                <div>
                  Created by: {bom.createdBy ? `${bom.createdBy.firstName} ${bom.createdBy.lastName}` : 'N/A'} on{' '}
                  {new Date(bom.createdAt).toLocaleDateString()}
                </div>
                {bom.approvedBy && (
                  <div>
                    Approved by: {`${bom.approvedBy.firstName} ${bom.approvedBy.lastName}`} on{' '}
                    {bom.approvedAt ? new Date(bom.approvedAt).toLocaleDateString() : 'N/A'}
                  </div>
                )}
                {bom.sourceCostSheetId && (
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    <span>Generated from Cost Sheet</span>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-info"
                      onClick={() => navigate(`/cost-sheets/${bom.sourceCostSheetId}`)}
                    >
                      View Source
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Total Material Cost</div>
              <div className="text-2xl font-bold text-success">
                {bom.totalMaterialCost ? formatCurrency(bom.totalMaterialCost) : '-'}
              </div>
              <div className="text-sm text-muted-foreground mt-2">{bom.items?.length || 0} items</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unlinked BOM Items Warning */}
      {bom.items &&
        (() => {
          const unlinked = bom.items.filter((item: OrderBOMItem) => {
            const hasMaterial = !!item.materialId;
            const hasFabric = item.materialType === 'FABRIC' && !!item.fabricId;
            const hasLace = item.materialType === 'LACE' && !!item.laceId;
            const hasGreige = !!item.greigeId; // greigeId = linked regardless of strategy (covers landed price)
            const hasTrimMaster = !!(
              item.buttonId ||
              item.threadId ||
              item.zipperId ||
              item.elasticId ||
              item.labelId ||
              item.packagingId ||
              item.hookEyeId ||
              item.snapButtonId ||
              item.buckleId ||
              item.beltId ||
              item.velcroId ||
              item.drawstringId ||
              item.ribbonId ||
              item.sequinId ||
              item.beadId ||
              item.motifId ||
              item.interliningId ||
              item.paddingId ||
              item.otherFastenerId ||
              item.otherTapeId ||
              item.otherDecorativeId ||
              item.otherFunctionalId
            );
            return !hasMaterial && !hasFabric && !hasLace && !hasGreige && !hasTrimMaster;
          });
          if (unlinked.length === 0) return null;
          return (
            <div className="mb-4 border border-orange-200 bg-primary/10 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-orange-800">
                    {unlinked.length} BOM item{unlinked.length > 1 ? 's' : ''} not linked to master records — MRP will
                    skip these
                  </p>
                  <ul className="mt-2 text-sm text-primary space-y-1">
                    {unlinked.map((item: OrderBOMItem, i: number) => (
                      <li key={i}>
                        <span className="font-medium">{item.componentName || 'Unknown'}</span>
                        <span className="text-orange-500 ml-1">({item.materialType})</span>
                        {' — '}
                        {item.materialType === 'GREIGE' || item.materialType === 'FABRIC'
                          ? `Select a ${item.materialType === 'GREIGE' ? 'Greige' : 'Fabric'} Master in CAD Planning for this fabric`
                          : item.materialType === 'LABEL' || item.materialType === 'PACKAGING'
                            ? `Create a ${item.materialType === 'LABEL' ? 'Label' : 'Packaging'} Master and add to customer accessory preset`
                            : `Select a ${item.materialType} Master in the cost sheet trims section`}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })()}

      {/* BOM Items Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            BOM Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bom.items && bom.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Material
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Code</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Type</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                      Category
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                      Qty/Garment
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                      Order Qty
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                      Total Qty
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                      Wastage%
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Unit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                      Unit Price
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                      Total Cost
                    </th>
                    {!isLocked && (
                      <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-gray-200">
                  {bom.items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-muted">
                      <td className="px-4 py-3 text-sm">{index + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {getBOMItemDisplayName(item)}
                        {(item.materialType === 'FABRIC' || item.materialType === 'GREIGE') &&
                          item.fabricWidthInches && (
                            <div className="text-xs text-muted-foreground">
                              {Number(item.fabricWidthInches).toFixed(1)}" width
                            </div>
                          )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{getBOMItemCode(item)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className="text-xs">
                          {item.materialType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                        {item.usageCategory?.replace(/_/g, ' ') || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{Number(item.quantityPerGarment).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right">{item.orderQuantity}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {Number(item.totalWithWastage ?? item.totalQuantity).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {isDraft ? (
                          <Input
                            type="number"
                            className="w-20 text-right text-sm h-7 ml-auto"
                            min={0}
                            max={100}
                            step={0.1}
                            defaultValue={Number(item.wastagePercent ?? 0)}
                            onBlur={(e) => handleWastageChange(item.id, Number(e.target.value))}
                            key={`${item.id}-${item.wastagePercent}`}
                          />
                        ) : item.wastagePercent != null ? (
                          `${Number(item.wastagePercent).toFixed(1)}%`
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">{item.unit}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">{formatCurrency(item.totalCost)}</td>
                      {!isLocked && (
                        <td className="px-4 py-3 text-center">
                          {(item.materialType === 'FABRIC' || item.materialType === 'GREIGE') && item.fabricId && (
                            <Button variant="outline" size="sm" onClick={() => openWidthModal(item)}>
                              <ArrowLeftRight className="h-3 w-3 mr-1" />
                              Change Width
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted">
                  <tr>
                    <td colSpan={!isLocked ? 12 : 11} className="px-4 py-3 text-sm font-semibold text-right">
                      Total:
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-right">
                      {bom.totalMaterialCost ? formatCurrency(bom.totalMaterialCost) : '-'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No items in this BOM</p>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {bom.items?.some((i) => i.notes) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Item Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bom.items
                .filter((i) => i.notes)
                .map((item, idx) => (
                  <div key={idx} className="text-sm">
                    <span className="font-medium">{getBOMItemDisplayName(item)}:</span>{' '}
                    <span className="text-muted-foreground">{item.notes}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        title="Approve Order BOM"
        description={`Approve the Order BOM for ${bom.order?.orderNumber || 'this order'}? This will approve the BOM, calculate Material Requirements (MRP), and calculate Service Requirements for all Work Orders.`}
        confirmText="Approve & Calculate All"
        cancelText="Cancel"
        onConfirm={confirmApprove}
        variant="default"
      />

      <ConfirmDialog
        open={lockDialogOpen}
        onOpenChange={setLockDialogOpen}
        title="Lock for Production"
        description={`Lock the Order BOM for ${bom.order?.orderNumber || 'this order'}? Once locked, the BOM cannot be modified and will be used for MRP and production planning.`}
        confirmText="Lock"
        cancelText="Cancel"
        onConfirm={confirmLock}
        variant="default"
      />

      <ConfirmDialog
        open={regenerateDialogOpen}
        onOpenChange={setRegenerateDialogOpen}
        title="Regenerate BOM?"
        description="This will delete the current Draft BOM and recreate it from the original cost sheet. Any manual edits to BOM items will be lost. Continue?"
        confirmText={regenerating ? 'Regenerating...' : 'Regenerate'}
        cancelText="Cancel"
        onConfirm={handleRegenerate}
        variant="destructive"
      />

      {/* Change Width Modal */}
      <Dialog open={widthModalOpen} onOpenChange={setWidthModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Change Fabric Width</DialogTitle>
          </DialogHeader>
          {widthModalItem && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{getBOMItemDisplayName(widthModalItem)}</span>
                {widthModalItem.fabricWidthInches && (
                  <span className="ml-2 text-muted-foreground">
                    (Current: {Number(widthModalItem.fabricWidthInches).toFixed(1)}" width,{' '}
                    {Number(widthModalItem.cadAverageSnapshot || widthModalItem.quantityPerGarment).toFixed(2)} avg/pc)
                  </span>
                )}
              </div>

              {cadLoading ? (
                <div className="flex justify-center py-6">
                  <LoadingSpinner />
                </div>
              ) : cadOptions.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4">No CAD width options found for this fabric.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {cadOptions
                    .filter((opt) => opt.cadAverage != null)
                    .map((opt) => {
                      const isCurrentWidth = widthModalItem.selectedCadId === opt.id;
                      return (
                        <label
                          key={opt.id}
                          className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedCadId === opt.id
                              ? 'border-info bg-info-muted'
                              : isCurrentWidth
                                ? 'border-success/25 bg-success-muted'
                                : 'border-border hover:border-border'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="cadOption"
                              value={opt.id}
                              checked={selectedCadId === opt.id}
                              onChange={() => setSelectedCadId(opt.id)}
                              disabled={isCurrentWidth}
                              className="h-4 w-4"
                            />
                            <div>
                              <div className="font-medium text-sm">
                                {Number(opt.cutableWidth).toFixed(1)}" width
                                {isCurrentWidth && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    Current
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                CAD avg: {Number(opt.cadAverage).toFixed(4)} per piece
                                {opt.markerEfficiency && ` | Efficiency: ${Number(opt.markerEfficiency).toFixed(1)}%`}
                              </div>
                            </div>
                          </div>
                          {opt.totalCostPerMeter && (
                            <div className="text-sm font-medium text-right">
                              {formatCurrency(Number(opt.totalCostPerMeter))}/m
                            </div>
                          )}
                        </label>
                      );
                    })}
                </div>
              )}

              {selectedCadId && widthModalItem && (
                <div className="bg-warning-muted border border-yellow-200 rounded p-3 text-sm">
                  <strong>Note:</strong> This will create a new BOM version with updated consumption and cost for the
                  selected width.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWidthModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmChangeWidth} disabled={!selectedCadId || widthChanging}>
              {widthChanging ? 'Creating new version...' : 'Change Width'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OrderBOMDetail;
