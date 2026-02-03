import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, CheckCircle, XCircle, GitBranch, Lock, Copy, AlertTriangle, RefreshCw, ShoppingCart } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '../lib/api-error-handler';
import { formatCurrency } from '../lib/currency';
import { getCostSheetById, approveCostSheet, rejectCostSheet, createCostSheetVersion } from '../services/costSheet.service';
import type { CostSheet } from '../types/costSheet.types';

const CostSheetDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [costSheet, setCostSheet] = useState<CostSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [createVersionDialogOpen, setCreateVersionDialogOpen] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);

  useEffect(() => {
    if (!id) {
      navigate('/cost-sheets');
      return;
    }

    const fetchCostSheet = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getCostSheetById(id);
        setCostSheet(data);
      } catch (err: unknown) {
        const errorMessage = handleApiError(err, 'Failed to fetch cost sheet', false);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchCostSheet();
  }, [id, navigate]);

  const confirmApprove = async () => {
    if (!costSheet) return;

    try {
      await approveCostSheet(costSheet.id, true);
      handleApiSuccess('Cost sheet approved', `Cost sheet for ${costSheet.style?.styleCode || 'this style'} has been approved.`);
      setApproveDialogOpen(false);
      // Refresh data
      const updated = await getCostSheetById(costSheet.id);
      setCostSheet(updated);
    } catch (err: unknown) {
      handleApiError(err, 'Failed to approve cost sheet');
    }
  };

  const confirmRevoke = async () => {
    if (!costSheet) return;

    try {
      await approveCostSheet(costSheet.id, false);
      handleApiSuccess('Approval revoked', `Approval for ${costSheet.style?.styleCode || 'this style'} has been revoked.`);
      setRevokeDialogOpen(false);
      // Refresh data
      const updated = await getCostSheetById(costSheet.id);
      setCostSheet(updated);
    } catch (err: unknown) {
      handleApiError(err, 'Failed to revoke approval');
    }
  };

  const confirmReject = async () => {
    if (!costSheet) return;

    if (!rejectionNotes.trim()) {
      handleApiError(new Error('Rejection notes are required'), 'Please provide rejection notes');
      return;
    }

    try {
      setRejecting(true);
      await rejectCostSheet(costSheet.id, rejectionNotes.trim());
      handleApiSuccess('Cost sheet rejected', `Cost sheet for ${costSheet.style?.styleCode || 'this style'} has been rejected.`);
      setRejectDialogOpen(false);
      setRejectionNotes('');
      // Refresh data
      const updated = await getCostSheetById(costSheet.id);
      setCostSheet(updated);
    } catch (err: unknown) {
      handleApiError(err, 'Failed to reject cost sheet');
    } finally {
      setRejecting(false);
    }
  };

  const confirmCreateVersion = async () => {
    if (!costSheet) return;

    try {
      setCreatingVersion(true);
      const newVersion = await createCostSheetVersion(costSheet.id, {
        versionReason: `Created from Version ${costSheet.version}`,
      });
      handleApiSuccess('New version created', `Version ${newVersion.version} created. You can now edit it.`);
      setCreateVersionDialogOpen(false);
      // Navigate to edit the new version
      navigate(`/cost-sheets/${newVersion.id}/edit`);
    } catch (err: unknown) {
      handleApiError(err, 'Failed to create new version');
    } finally {
      setCreatingVersion(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !costSheet) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-500 mb-4">{error || 'Cost sheet not found'}</p>
            <Button onClick={() => navigate('/cost-sheets')}>
              Back to Cost Sheets
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isApproved = costSheet.approvalStatus === 'APPROVED' || costSheet.isApproved;
  const isRejected = costSheet.approvalStatus === 'REJECTED';
  const isPending = costSheet.approvalStatus === 'PENDING';

  return (
    <>
      <PageHeader title="Cost Sheet Details">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/cost-sheets')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>

          {/* Edit button - only for pending/rejected */}
          {(isPending || isRejected) && (
            <Button onClick={() => navigate(`/cost-sheets/${costSheet.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}

          {/* Create new version - only for approved */}
          {isApproved && (
            <>
              <Button
                variant="outline"
                className="text-blue-600 hover:bg-blue-50"
                onClick={() => setCreateVersionDialogOpen(true)}
              >
                <Copy className="h-4 w-4 mr-2" />
                New Version
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => navigate(`/order-bom?costSheetId=${costSheet.id}&styleId=${costSheet.styleId}`)}
              >
                <Package className="h-4 w-4 mr-2" />
                Generate Order BOM
              </Button>
            </>
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
                  {costSheet.style?.styleCode || 'N/A'}
                </h2>
                <Badge variant="outline" className="text-sm">
                  <GitBranch className="w-3 h-3 mr-1" />
                  v{costSheet.version || 1}
                </Badge>
                <StatusBadge
                  status={isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Pending'}
                  variant={isApproved ? 'success' : isRejected ? 'destructive' : 'warning'}
                />
                {costSheet.lockedForOrders && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                    <Lock className="w-3 h-3 mr-1" />
                    Locked
                  </Badge>
                )}
              </div>
              <p className="text-gray-600 text-lg">{costSheet.style?.styleName}</p>
              {costSheet.widthCombinationDescription && (
                <p className="text-sm text-blue-600 mt-1">
                  Width: {costSheet.widthCombinationDescription}
                </p>
              )}
              <div className="mt-3 text-sm text-gray-500">
                Created by: {costSheet.createdBy?.firstName} {costSheet.createdBy?.lastName}
                {isApproved && costSheet.approvedBy && (
                  <> | Approved by: {costSheet.approvedBy.firstName} {costSheet.approvedBy.lastName}</>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              {/* Pending/Rejected - Can Approve/Reject */}
              {(isPending || isRejected) && (
                <>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => setApproveDialogOpen(true)}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  {isPending && (
                    <Button
                      variant="outline"
                      className="text-orange-600 hover:bg-orange-50"
                      onClick={() => setRejectDialogOpen(true)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  )}
                </>
              )}

              {/* Approved - Can Revoke */}
              {isApproved && (
                <>
                  <Button
                    variant="outline"
                    className="text-orange-600 hover:bg-orange-50"
                    onClick={() => setRevokeDialogOpen(true)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Revoke Approval
                  </Button>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                      const params = new URLSearchParams({
                        costSheetId: costSheet.id,
                        styleId: costSheet.styleId,
                        fromCostSheet: 'true',
                      });
                      navigate(`/orders/new?${params.toString()}`);
                    }}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Create Order
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Rejection Notes */}
          {isRejected && costSheet.rejectionNotes && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-700">Rejection Reason:</p>
                  <p className="text-red-600">{costSheet.rejectionNotes}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Material Cost</p>
            <p className="text-2xl font-bold">{formatCurrency(costSheet.totalMaterialCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Processing Cost</p>
            <p className="text-2xl font-bold">{formatCurrency(costSheet.totalProcessingCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Total Cost/Piece</p>
            <p className="text-2xl font-bold">{formatCurrency(costSheet.totalCostPerPiece)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Selling Price</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(costSheet.sellingPricePerPiece)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Fabric Details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Fabric Details</CardTitle>
        </CardHeader>
        <CardContent>
          {costSheet.fabricDetails && costSheet.fabricDetails.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fabric Name</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Width</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Average (m)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {costSheet.fabricDetails.map((fabric, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm">{index + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium">{fabric.fabricName}</td>
                      <td className="px-4 py-3 text-sm text-center">{fabric.fabricWidth}"</td>
                      <td className="px-4 py-3 text-sm text-center">{fabric.fabricAverage.toFixed(3)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(fabric.fabricRate)}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">{formatCurrency(fabric.fabricTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-right">Fabric Total:</td>
                    <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(costSheet.fabricTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No fabric details available</p>
          )}
        </CardContent>
      </Card>

      {/* Trims Details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Trims Details</CardTitle>
        </CardHeader>
        <CardContent>
          {costSheet.trimsDetails && costSheet.trimsDetails.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trim Name</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {costSheet.trimsDetails.map((trim, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm">{index + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium">{trim.trimName}</td>
                      <td className="px-4 py-3 text-sm text-center">{trim.trimQuantity}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(trim.trimRate)}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">{formatCurrency(trim.trimTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-right">Trims Total:</td>
                    <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(costSheet.trimsTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No trims details available</p>
          )}
        </CardContent>
      </Card>

      {/* CMT Costs */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>CMT (Cut, Make, Trim) Costs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Cutting</p>
              <p className="text-lg font-semibold">{formatCurrency(costSheet.cuttingCost)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Stitching</p>
              <p className="text-lg font-semibold">{formatCurrency(costSheet.stitchingCost)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Finishing</p>
              <p className="text-lg font-semibold">{formatCurrency(costSheet.finishingCost)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Button Attachment</p>
              <p className="text-lg font-semibold">{formatCurrency(costSheet.buttonAttachmentCost)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Handwork</p>
              <p className="text-lg font-semibold">{formatCurrency(costSheet.handworkCmtCost)}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t text-right">
            <span className="text-gray-600 mr-4">CMT Total:</span>
            <span className="text-xl font-bold">{formatCurrency(costSheet.cmtTotal)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Embroidery Details */}
      {costSheet.embroideryDetails && costSheet.embroideryDetails.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Embroidery Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Average</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {costSheet.embroideryDetails.map((embr, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm">{index + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium">{embr.embroideryName}</td>
                      <td className="px-4 py-3 text-sm text-center">{embr.embroideryAverage}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(embr.embroideryRate)}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">{formatCurrency(embr.embroideryTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-right">Embroidery Total:</td>
                    <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(costSheet.embroideryTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accessories Details */}
      {costSheet.accessoriesDetails && costSheet.accessoriesDetails.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Accessories Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {costSheet.accessoriesDetails.map((acc, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm">{index + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium">{acc.accessoryName}</td>
                      <td className="px-4 py-3 text-sm text-center">{acc.accessoryQuantity}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(acc.accessoryRate)}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">{formatCurrency(acc.accessoryTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-right">Accessories Total:</td>
                    <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(costSheet.accessoriesTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Value Loss & Markup Summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Cost Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-w-lg mx-auto">
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Fabric Total:</span>
              <span className="font-semibold">{formatCurrency(costSheet.fabricTotal)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Trims Total:</span>
              <span className="font-semibold">{formatCurrency(costSheet.trimsTotal)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">CMT Total:</span>
              <span className="font-semibold">{formatCurrency(costSheet.cmtTotal)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Embroidery Total:</span>
              <span className="font-semibold">{formatCurrency(costSheet.embroideryTotal)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Accessories Total:</span>
              <span className="font-semibold">{formatCurrency(costSheet.accessoriesTotal)}</span>
            </div>
            <div className="flex justify-between py-2 border-t pt-3">
              <span className="font-semibold">Subtotal:</span>
              <span className="font-semibold text-lg">{formatCurrency(costSheet.subtotal)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Value Loss ({costSheet.valueLossPercent}%):</span>
              <span className="font-semibold text-orange-600">+ {formatCurrency(costSheet.valueLossAmount)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Markup ({costSheet.markupPercent}%):</span>
              <span className="font-semibold text-green-600">+ {formatCurrency(costSheet.markupAmount)}</span>
            </div>
            <div className="flex justify-between py-3 border-t-2 border-gray-300">
              <span className="font-bold text-lg">Total Product Cost:</span>
              <span className="font-bold text-2xl text-green-600">{formatCurrency(costSheet.totalProductCost)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Closed Cost - Final Agreed Price (only shown if set) */}
      {costSheet.closedCost && (
        <Card className="mb-6 border-2 border-blue-500 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-blue-700 flex items-center gap-2">
              <span>💰</span>
              Final Agreed Price (Closed Cost)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-blue-700">
                    {formatCurrency(costSheet.closedCost)}
                  </span>
                  <span className="text-sm text-gray-500">per piece (excl. tax)</span>
                </div>
                {costSheet.closedCostNotes && (
                  <p className="text-sm text-gray-600 mt-2 italic">"{costSheet.closedCostNotes}"</p>
                )}
              </div>
              {costSheet.totalProductCost && costSheet.closedCost !== costSheet.totalProductCost && (
                <div className={`px-4 py-2 rounded-lg ${costSheet.closedCost > costSheet.totalProductCost ? 'bg-green-100' : 'bg-amber-100'}`}>
                  <p className="text-xs text-gray-500">Variance from Calculated</p>
                  <p className={`text-lg font-semibold ${costSheet.closedCost > costSheet.totalProductCost ? 'text-green-700' : 'text-amber-700'}`}>
                    {costSheet.closedCost > costSheet.totalProductCost ? '+' : ''}
                    {(((costSheet.closedCost - costSheet.totalProductCost) / costSheet.totalProductCost) * 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-blue-200 flex justify-between text-sm">
              <span className="text-gray-600">Calculated Cost: {formatCurrency(costSheet.totalProductCost)}</span>
              <span className="text-gray-600">
                Difference: {costSheet.closedCost >= costSheet.totalProductCost ? '+' : ''}
                {formatCurrency(costSheet.closedCost - costSheet.totalProductCost)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {costSheet.notes && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap">{costSheet.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        title="Approve Cost Sheet"
        description={`Are you sure you want to approve this cost sheet for "${costSheet.style?.styleCode}"? Once approved, it cannot be edited.`}
        confirmText="Approve"
        cancelText="Cancel"
        onConfirm={confirmApprove}
        variant="default"
      />

      <ConfirmDialog
        open={revokeDialogOpen}
        onOpenChange={setRevokeDialogOpen}
        title="Revoke Approval"
        description={`Are you sure you want to revoke approval for "${costSheet.style?.styleCode}"? This will allow the cost sheet to be edited again.`}
        confirmText="Revoke"
        cancelText="Cancel"
        onConfirm={confirmRevoke}
        variant="destructive"
      />

      <ConfirmDialog
        open={createVersionDialogOpen}
        onOpenChange={setCreateVersionDialogOpen}
        title="Create New Version"
        description={`Create a new version of the cost sheet for "${costSheet.style?.styleCode}"? This will copy Version ${costSheet.version || 1} to a new editable draft.`}
        confirmText={creatingVersion ? 'Creating...' : 'Create Version'}
        cancelText="Cancel"
        onConfirm={confirmCreateVersion}
        variant="default"
      />

      {/* Reject Dialog with Notes */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-orange-500" />
              Reject Cost Sheet
            </DialogTitle>
            <DialogDescription>
              Reject the cost sheet for &quot;{costSheet.style?.styleCode}&quot;?
              Please provide a reason for rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rejectionNotes" className="text-sm font-medium">
              Rejection Notes <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="rejectionNotes"
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              placeholder="Enter reason for rejection..."
              className="mt-2"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectionNotes('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={rejecting || !rejectionNotes.trim()}
            >
              {rejecting ? 'Rejecting...' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CostSheetDetail;
