import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Edit, Eye, Trash2, RefreshCw, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
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
import { getAllCostSheets, approveCostSheet, deleteCostSheet } from '../services/costSheet.service';
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
  const [costSheetToModify, setCostSheetToModify] = useState<{
    id: string;
    styleCode: string;
    action: 'delete' | 'approve' | 'revoke'
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
                id="search"
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
                  <SelectItem value="true">Approved</SelectItem>
                  <SelectItem value="false">Pending</SelectItem>
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
                        <StatusBadge
                          status={sheet.isApproved ? 'Approved' : 'Pending'}
                          variant={sheet.isApproved ? 'success' : 'warning'}
                        />
                      </div>

                      <p className="text-gray-600 mb-4">{sheet.style?.styleName}</p>

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

                      <div className="mt-3 text-xs text-gray-500">
                        Created by: {sheet.createdBy?.firstName} {sheet.createdBy?.lastName}
                        {sheet.isApproved && sheet.approvedBy && (
                          <> • Approved by: {sheet.approvedBy.firstName} {sheet.approvedBy.lastName}</>
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

                      {!sheet.isApproved && (
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
                            className="text-red-600 hover:bg-red-50 flex items-center gap-2"
                            onClick={() => handleDeleteClick(sheet.id, sheet.style?.styleCode || 'this cost sheet')}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </>
                      )}

                      {sheet.isApproved && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-orange-600 hover:bg-orange-50 flex items-center gap-2"
                          onClick={() => handleRevokeClick(sheet.id, sheet.style?.styleCode || 'this cost sheet')}
                        >
                          <RefreshCw className="h-4 w-4" />
                          Revoke
                        </Button>
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
    </>
  );
};

export default CostSheetList;
