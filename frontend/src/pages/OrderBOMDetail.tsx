import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Lock, Calculator, FileText, Package, ArrowLeftRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { PageHeader } from '../components/PageHeader';
import { LoadingSpinner } from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import MRPCalculationPrompt from '../components/MRPCalculationPrompt';
import { handleApiError, handleApiSuccess } from '../lib/api-error-handler';
import { formatCurrency } from '../lib/currency';
import {
  getById,
  approveOrderBOM,
  lockOrderBOM,
  changeWidth,
  getFabricCadOptions,
  getBOMItemDisplayName,
  getBOMItemCode,
  getStatusBadgeColor,
  calculateMRPStandalone,
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
  const [mrpPromptOpen, setMrpPromptOpen] = useState(false);

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
      await approveOrderBOM(bom.orderId, bom.style?.id);
      handleApiSuccess('Order BOM Approved', 'The Order BOM has been approved.');
      setApproveDialogOpen(false);
      await fetchBOM();
      // Show MRP calculation prompt after successful approval
      setMrpPromptOpen(true);
    } catch (err: unknown) {
      handleApiError(err, 'Failed to approve Order BOM');
    }
  };

  const handleCalculateMRP = async () => {
    if (!bom) return;
    try {
      const result = await calculateMRPStandalone(bom.orderId, {
        styleId: bom.style?.id || '',
      });
      handleApiSuccess(
        'MRP Calculated',
        `${result.created + result.updated} material requirements calculated (${result.created} created, ${result.updated} updated)`
      );
    } catch (err: unknown) {
      handleApiError(err, 'Failed to calculate MRP');
    }
  };

  const handleSkipMRP = () => {
    // User chose to skip MRP calculation
    // Do nothing - they can trigger it manually later
  };

  const confirmLock = async () => {
    if (!bom) return;
    try {
      await lockOrderBOM(bom.orderId, bom.style?.id);
      handleApiSuccess('Order BOM Locked', 'The Order BOM has been locked for production.');
      setLockDialogOpen(false);
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
            <p className="text-red-500 mb-4">{error || 'Order BOM not found'}</p>
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
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => setApproveDialogOpen(true)}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
          )}

          {isApproved && (
            <>
              <Button
                variant="outline"
                className="border-purple-500 text-purple-600 hover:bg-purple-50"
                onClick={() => navigate(`/mrp/requirements?orderId=${bom.orderId}`)}
              >
                <FileText className="h-4 w-4 mr-2" />
                View MRP Requirements
              </Button>
              <Button
                variant="outline"
                className="border-blue-500 text-blue-600 hover:bg-blue-50"
                onClick={handleCalculateMRP}
              >
                <Calculator className="h-4 w-4 mr-2" />
                Calculate MRP
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setLockDialogOpen(true)}
              >
                <Lock className="h-4 w-4 mr-2" />
                Lock for Production
              </Button>
            </>
          )}

          {isLocked && (
            <Button
              variant="outline"
              className="border-purple-500 text-purple-600 hover:bg-purple-50"
              onClick={() => navigate(`/mrp/requirements?orderId=${bom.orderId}`)}
            >
              <FileText className="h-4 w-4 mr-2" />
              View MRP Requirements
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Header Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">
                  {bom.order?.orderNumber || 'Order BOM'}
                </h2>
                <Badge variant="outline" className="text-sm">
                  v{bom.version}
                </Badge>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(bom.status)}`}>
                  {bom.status}
                </span>
              </div>
              <p className="text-gray-600 text-lg">
                {bom.style?.styleCode} - {bom.style?.styleName}
              </p>
              <div className="mt-3 text-sm text-gray-500 space-y-1">
                <div>Created by: {bom.createdBy ? `${bom.createdBy.firstName} ${bom.createdBy.lastName}` : 'N/A'} on {new Date(bom.createdAt).toLocaleDateString()}</div>
                {bom.approvedBy && (
                  <div>Approved by: {`${bom.approvedBy.firstName} ${bom.approvedBy.lastName}`} on {bom.approvedAt ? new Date(bom.approvedAt).toLocaleDateString() : 'N/A'}</div>
                )}
                {bom.sourceCostSheetId && (
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    <span>Generated from Cost Sheet</span>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-blue-600"
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
              <div className="text-sm text-gray-500">Total Material Cost</div>
              <div className="text-2xl font-bold text-green-600">
                {bom.totalMaterialCost ? formatCurrency(bom.totalMaterialCost) : '-'}
              </div>
              <div className="text-sm text-gray-500 mt-2">
                {bom.items?.length || 0} items
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty/Garment</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Order Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Wastage%</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Unit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                    {!isLocked && <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bom.items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{index + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {getBOMItemDisplayName(item)}
                        {item.materialType === 'FABRIC' && item.fabricWidthInches && (
                          <div className="text-xs text-gray-500">{Number(item.fabricWidthInches).toFixed(1)}" width</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{getBOMItemCode(item)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className="text-xs">
                          {item.materialType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">
                        {item.usageCategory?.replace(/_/g, ' ') || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{Number(item.quantityPerGarment).toFixed(4)}</td>
                      <td className="px-4 py-3 text-sm text-right">{item.orderQuantity}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{Number(item.totalQuantity).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        {item.wastagePercent != null ? `${Number(item.wastagePercent).toFixed(1)}%` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">{item.unit}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">{formatCurrency(item.totalCost)}</td>
                      {!isLocked && (
                        <td className="px-4 py-3 text-center">
                          {item.materialType === 'FABRIC' && item.fabricId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openWidthModal(item)}
                            >
                              <ArrowLeftRight className="h-3 w-3 mr-1" />
                              Change Width
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={!isLocked ? 12 : 11} className="px-4 py-3 text-sm font-semibold text-right">Total:</td>
                    <td className="px-4 py-3 text-sm font-bold text-right">
                      {bom.totalMaterialCost ? formatCurrency(bom.totalMaterialCost) : '-'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No items in this BOM</p>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {bom.items?.some(i => i.notes) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Item Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bom.items.filter(i => i.notes).map((item, idx) => (
                <div key={idx} className="text-sm">
                  <span className="font-medium">{getBOMItemDisplayName(item)}:</span>{' '}
                  <span className="text-gray-600">{item.notes}</span>
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
        description={`Approve the Order BOM for ${bom.order?.orderNumber || 'this order'}? This confirms the material quantities and pricing.`}
        confirmText="Approve"
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

      {/* MRP Calculation Prompt */}
      <MRPCalculationPrompt
        open={mrpPromptOpen}
        onOpenChange={setMrpPromptOpen}
        onCalculate={handleCalculateMRP}
        onSkip={handleSkipMRP}
        bomVersion={bom.version}
        orderNumber={bom.order?.orderNumber}
      />

      {/* Change Width Modal */}
      <Dialog open={widthModalOpen} onOpenChange={setWidthModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Change Fabric Width</DialogTitle>
          </DialogHeader>
          {widthModalItem && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{getBOMItemDisplayName(widthModalItem)}</span>
                {widthModalItem.fabricWidthInches && (
                  <span className="ml-2 text-gray-500">
                    (Current: {Number(widthModalItem.fabricWidthInches).toFixed(1)}" width,
                    {' '}{Number(widthModalItem.cadAverageSnapshot || widthModalItem.quantityPerGarment).toFixed(4)} avg/pc)
                  </span>
                )}
              </div>

              {cadLoading ? (
                <div className="flex justify-center py-6">
                  <LoadingSpinner />
                </div>
              ) : cadOptions.length === 0 ? (
                <p className="text-gray-500 text-sm py-4">No CAD width options found for this fabric.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {cadOptions
                    .filter(opt => opt.cadAverage != null)
                    .map((opt) => {
                      const isCurrentWidth = widthModalItem.selectedCadId === opt.id;
                      return (
                        <label
                          key={opt.id}
                          className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedCadId === opt.id
                              ? 'border-blue-500 bg-blue-50'
                              : isCurrentWidth
                              ? 'border-green-300 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
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
                                {isCurrentWidth && <Badge variant="outline" className="ml-2 text-xs">Current</Badge>}
                              </div>
                              <div className="text-xs text-gray-500">
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
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                  <strong>Note:</strong> This will create a new BOM version with updated consumption and cost for the selected width.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWidthModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmChangeWidth}
              disabled={!selectedCadId || widthChanging}
            >
              {widthChanging ? 'Creating new version...' : 'Change Width'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OrderBOMDetail;
