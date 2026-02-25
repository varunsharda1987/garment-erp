import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Edit, Eye, Trash2, RefreshCw, FileText, GitBranch, Lock, Copy, AlertTriangle, Package, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { PageHeader } from '../components/PageHeader';
import SearchInput from '../components/SearchInput';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import ExportButton from '../components/ExportButton';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import { handleApiError, handleApiSuccess } from '../lib/api-error-handler';
import { getAllCostSheets, approveCostSheet, rejectCostSheet, deleteCostSheet, createCostSheetVersion } from '../services/costSheet.service';
import type { CostSheet } from '../types/costSheet.types';

const CostSheetList = () => {
  const navigate = useNavigate();
  const [costSheets, setCostSheets] = useState<CostSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [approvedFilter, setApprovedFilter] = useState('all');
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Use the pagination hook
  const { currentPage, pageSize, paginationProps, resetPage, apiParams } = usePagination();

  // Delete/Approve dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [createVersionDialogOpen, setCreateVersionDialogOpen] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [costSheetToModify, setCostSheetToModify] = useState<{
    id: string;
    styleCode: string;
    action: 'delete' | 'approve' | 'revoke' | 'reject' | 'create-version';
    version?: number;
  } | null>(null);

  const fetchCostSheets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getAllCostSheets({
        ...apiParams,
        search,
        approved: approvedFilter,
      });
      setCostSheets(response.data);
      setTotalPages(response.pagination.pages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to fetch cost sheets', false);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCostSheets();
  }, [currentPage, pageSize, search, approvedFilter]);

  const handleDeleteClick = (id: string, styleCode: string) => {
    setCostSheetToModify({ id, styleCode, action: 'delete' });
    setDeleteDialogOpen(true);
  };

  const handleApproveClick = (id: string, styleCode: string) => {
    setCostSheetToModify({ id, styleCode, action: 'approve' });
    setApproveDialogOpen(true);
  };

  const handleRevokeClick = (id: string, styleCode: string) => {
    setCostSheetToModify({ id, styleCode, action: 'revoke' });
    setRevokeDialogOpen(true);
  };

  const handleRejectClick = (id: string, styleCode: string) => {
    setCostSheetToModify({ id, styleCode, action: 'reject' });
    setRejectionNotes('');
    setRejectDialogOpen(true);
  };

  const handleCreateVersionClick = (id: string, styleCode: string, currentVersion: number) => {
    setCostSheetToModify({ id, styleCode, action: 'create-version', version: currentVersion });
    setCreateVersionDialogOpen(true);
  };

  const confirmCreateVersion = async () => {
    if (!costSheetToModify) return;

    try {
      setCreatingVersion(true);
      const newVersion = await createCostSheetVersion(costSheetToModify.id, {
        versionReason: `Created from Version ${costSheetToModify.version}`,
      });
      handleApiSuccess('New version created', `Version ${newVersion.version} created for ${costSheetToModify.styleCode}. You can now edit it.`);
      setCreateVersionDialogOpen(false);
      // Navigate to edit the new version
      navigate(`/cost-sheets/${newVersion.id}/edit`);
    } catch (err: unknown) {
      handleApiError(err, 'Failed to create new version');
    } finally {
      setCreatingVersion(false);
      setCostSheetToModify(null);
    }
  };

  const confirmDelete = async () => {
    if (!costSheetToModify) return;

    try {
      await deleteCostSheet(costSheetToModify.id);
      handleApiSuccess('Cost sheet deleted', `Cost sheet for ${costSheetToModify.styleCode} has been deleted.`);
      fetchCostSheets();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete cost sheet');
    } finally {
      setCostSheetToModify(null);
    }
  };

  const confirmApprove = async () => {
    if (!costSheetToModify) return;

    try {
      await approveCostSheet(costSheetToModify.id, true);
      handleApiSuccess('Cost sheet approved', `Cost sheet for ${costSheetToModify.styleCode} has been approved.`);
      fetchCostSheets();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to approve cost sheet');
    } finally {
      setCostSheetToModify(null);
    }
  };

  const confirmRevoke = async () => {
    if (!costSheetToModify) return;

    try {
      await approveCostSheet(costSheetToModify.id, false);
      handleApiSuccess('Approval revoked', `Approval for ${costSheetToModify.styleCode} has been revoked.`);
      fetchCostSheets();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to revoke approval');
    } finally {
      setCostSheetToModify(null);
    }
  };

  const confirmReject = async () => {
    if (!costSheetToModify) return;

    if (!rejectionNotes.trim()) {
      handleApiError(new Error('Rejection notes are required'), 'Please provide rejection notes');
      return;
    }

    try {
      setRejecting(true);
      await rejectCostSheet(costSheetToModify.id, rejectionNotes.trim());
      handleApiSuccess('Cost sheet rejected', `Cost sheet for ${costSheetToModify.styleCode} has been rejected.`);
      setRejectDialogOpen(false);
      fetchCostSheets();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to reject cost sheet');
    } finally {
      setRejecting(false);
      setCostSheetToModify(null);
      setRejectionNotes('');
    }
  };

  return (
    <>
      <PageHeader title="Cost Sheets">
        <div className="flex gap-2">
          <ExportButton
            module="style_costing"
            filters={{ approved: approvedFilter }}
          />
          <Button onClick={() => navigate('/cost-sheets/new')}>
            + New Cost Sheet
          </Button>
        </div>
      </PageHeader>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="search">Search by Style</Label>
              <SearchInput
                placeholder="Style code or name..."
                value={search}
                onChange={(value) => {
                  setSearch(value);
                  resetPage();
                }}
              />
            </div>

            <div>
              <Label htmlFor="approvalFilter">Approval Status</Label>
              <Select value={approvedFilter} onValueChange={(value: string) => {
                setApprovedFilter(value);
                resetPage();
              }}>
                <SelectTrigger id="approvalFilter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost Sheets List */}
      {loading ? (
        <Card>
          <CardContent className="py-12">
            <LoadingSpinner />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<FileText className="h-16 w-16" />}
              title="Error loading cost sheets"
              description={error}
              actionLabel="Retry"
              onAction={fetchCostSheets}
            />
          </CardContent>
        </Card>
      ) : costSheets.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<FileText className="h-16 w-16" />}
              title="No cost sheets found"
              description={search || approvedFilter !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'Create your first cost sheet to get started'}
              actionLabel={!search && approvedFilter === 'all' ? 'Create First Cost Sheet' : undefined}
              onAction={!search && approvedFilter === 'all' ? () => navigate('/cost-sheets/new') : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {costSheets.map((sheet) => (
              <Card key={sheet.id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">
                          {sheet.style?.styleCode || 'N/A'}
                        </h3>
                        <Badge variant="outline" className="text-xs font-medium">
                          <GitBranch className="w-3 h-3 mr-1" />
                          v{sheet.version || 1}
                        </Badge>
                        <StatusBadge
                          status={sheet.approvalStatus === 'APPROVED' ? 'Approved' :
                                  sheet.approvalStatus === 'REJECTED' ? 'Rejected' : 'Pending'}
                          variant={sheet.approvalStatus === 'APPROVED' ? 'success' :
                                  sheet.approvalStatus === 'REJECTED' ? 'destructive' : 'warning'}
                        />
                        {/* Mode/Purpose Badge */}
                        {sheet.purpose && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              sheet.purpose === 'COSTING' ? 'border-blue-500 text-blue-600' :
                              sheet.purpose === 'RAW_MATERIAL_CALCULATION' ? 'border-orange-500 text-orange-600' :
                              sheet.purpose === 'PRODUCTION' ? 'border-purple-500 text-purple-600' :
                              'border-gray-500 text-gray-600'
                            }`}
                          >
                            {sheet.purpose === 'COSTING' ? 'Costing' :
                             sheet.purpose === 'RAW_MATERIAL_CALCULATION' ? 'Raw Material' :
                             sheet.purpose === 'PRODUCTION' ? 'Production' :
                             sheet.purpose}
                          </Badge>
                        )}
                        {sheet.lockedForOrders && (
                          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                            <Lock className="w-3 h-3 mr-1" />
                            Locked
                          </Badge>
                        )}
                        {sheet.costVariancePercent !== undefined && sheet.costVariancePercent !== null && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              Number(sheet.costVariancePercent) > 0
                                ? 'text-red-600 border-red-200'
                                : 'text-green-600 border-green-200'
                            }`}
                          >
                            {Number(sheet.costVariancePercent) > 0 ? '+' : ''}
                            {Number(sheet.costVariancePercent).toFixed(1)}% vs prev
                          </Badge>
                        )}
                      </div>

                      <p className="text-gray-600 mb-2">{sheet.style?.styleName}</p>
                      {sheet.widthCombinationDescription && (
                        <p className="text-xs text-blue-600 mb-3">
                          Width: {sheet.widthCombinationDescription}
                        </p>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Material Cost:</span>
                          <p className="font-semibold">₹{sheet.totalMaterialCost.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Processing Cost:</span>
                          <p className="font-semibold">₹{sheet.totalProcessingCost.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Total Cost/Piece:</span>
                          <p className="font-semibold">₹{sheet.totalCostPerPiece.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Selling Price:</span>
                          <p className="font-semibold text-green-600">
                            ₹{sheet.sellingPricePerPiece.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {sheet.notes && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm text-gray-600">{sheet.notes}</p>
                        </div>
                      )}

                      {sheet.approvalStatus === 'REJECTED' && sheet.rejectionNotes && (
                        <div className="mt-3 pt-3 border-t bg-red-50 -mx-6 px-6 py-3 rounded-b-lg">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-red-700">Rejection Reason:</p>
                              <p className="text-sm text-red-600">{sheet.rejectionNotes}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 text-xs text-gray-500">
                        Created by: {sheet.createdBy?.firstName} {sheet.createdBy?.lastName}
                        {sheet.isApproved && sheet.approvedBy && (
                          <> • Approved by: {sheet.approvedBy.firstName} {sheet.approvedBy.lastName}</>
                        )}
                      </div>

                      {/* Date Created */}
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Created: {new Date(sheet.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      {/* Linked Orders */}
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <Package className="h-3 w-3 text-blue-500" />
                        {sheet.order ? (
                          <Link
                            to={`/orders/${sheet.order.id}`}
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            Order #{sheet.order.orderNumber}
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {sheet.order.status}
                            </Badge>
                          </Link>
                        ) : sheet.orderItem?.orders ? (
                          <Link
                            to={`/orders/${sheet.orderItem.orderId}`}
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            Order #{sheet.orderItem.orders.orderNumber}
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {sheet.orderItem.totalQuantity?.toLocaleString()} pcs
                            </Badge>
                          </Link>
                        ) : (
                          <span className="text-gray-400">No linked order</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/cost-sheets/${sheet.id}`)}
                        className="flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>

                      {/* Pending/Rejected - Can Edit */}
                      {(sheet.approvalStatus === 'PENDING' || sheet.approvalStatus === 'REJECTED') && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/cost-sheets/${sheet.id}/edit`)}
                            className="flex items-center gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-green-50 hover:bg-green-100 text-green-700 flex items-center gap-2"
                            onClick={() => handleApproveClick(sheet.id, sheet.style?.styleCode || 'this cost sheet')}
                          >
                            <CheckCircle className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-orange-600 hover:bg-orange-50 flex items-center gap-2"
                            onClick={() => handleRejectClick(sheet.id, sheet.style?.styleCode || 'this cost sheet')}
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 flex items-center gap-2"
                            onClick={() => handleDeleteClick(sheet.id, sheet.style?.styleCode || 'this cost sheet')}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </>
                      )}

                      {(sheet.isApproved || sheet.approvalStatus === 'APPROVED') && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                            onClick={() => handleCreateVersionClick(
                              sheet.id,
                              sheet.style?.styleCode || 'this cost sheet',
                              sheet.version || 1
                            )}
                          >
                            <Copy className="h-4 w-4" />
                            New Version
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-orange-600 hover:bg-orange-50 flex items-center gap-2"
                            onClick={() => handleRevokeClick(sheet.id, sheet.style?.styleCode || 'this cost sheet')}
                          >
                            <RefreshCw className="h-4 w-4" />
                            Revoke
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            {...paginationProps}
            totalPages={totalPages}
            totalItems={totalItems}
          />
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Cost Sheet"
        description={`Are you sure you want to delete the cost sheet for "${costSheetToModify?.styleCode}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />

      {/* Approve Confirmation Dialog */}
      <ConfirmDialog
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        title="Approve Cost Sheet"
        description={`Are you sure you want to approve the cost sheet for "${costSheetToModify?.styleCode}"? Once approved, it cannot be edited.`}
        confirmText="Approve"
        cancelText="Cancel"
        onConfirm={confirmApprove}
        variant="default"
      />

      {/* Revoke Approval Dialog */}
      <ConfirmDialog
        open={revokeDialogOpen}
        onOpenChange={setRevokeDialogOpen}
        title="Revoke Approval"
        description={`Are you sure you want to revoke approval for "${costSheetToModify?.styleCode}"? This will allow the cost sheet to be edited again.`}
        confirmText="Revoke"
        cancelText="Cancel"
        onConfirm={confirmRevoke}
        variant="destructive"
      />

      {/* Create New Version Dialog */}
      <ConfirmDialog
        open={createVersionDialogOpen}
        onOpenChange={setCreateVersionDialogOpen}
        title="Create New Version"
        description={`Create a new version of the cost sheet for "${costSheetToModify?.styleCode}"? This will copy Version ${costSheetToModify?.version || 1} to a new editable draft.`}
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
              Reject the cost sheet for &quot;{costSheetToModify?.styleCode}&quot;?
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
                setCostSheetToModify(null);
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

export default CostSheetList;
