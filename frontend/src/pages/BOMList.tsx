import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllBOMs, deleteBOM, approveBOM } from '@/services/bom.service';
import type { BillOfMaterial, BOMListFilters } from '@/types/bom.types';
import ExportButton from '@/components/ExportButton';
import ImportButton from '@/components/ImportButton';
import SearchInput from '@/components/SearchInput';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import Pagination from '@/components/Pagination';
import { FileText } from 'lucide-react';

export default function BOMList() {
  const navigate = useNavigate();
  const [boms, setBOMs] = useState<BillOfMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBOMs, setTotalBOMs] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('all');
  const [approvedFilter, setApprovedFilter] = useState<string>('all');

  // Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [bomToModify, setBOMToModify] = useState<{ id: string; styleCode: string; action: 'delete' | 'approve' } | null>(null);

  useEffect(() => {
    loadBOMs();
  }, [currentPage, pageSize, searchQuery, isActiveFilter, approvedFilter]);

  const loadBOMs = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const filters: BOMListFilters = {
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        isActive: isActiveFilter === 'all' ? undefined : isActiveFilter === 'true',
        approved: approvedFilter === 'all' ? undefined : approvedFilter === 'true',
      };

      const response = await getAllBOMs(filters);
      setBOMs(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalBOMs(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load BOMs', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id: string, styleCode: string) => {
    setBOMToModify({ id, styleCode, action: 'delete' });
    setDeleteDialogOpen(true);
  };

  const handleApproveClick = (id: string, styleCode: string) => {
    setBOMToModify({ id, styleCode, action: 'approve' });
    setApproveDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!bomToModify) return;

    try {
      await deleteBOM(bomToModify.id);
      handleApiSuccess('BOM deactivated', `BOM for ${bomToModify.styleCode} has been successfully deactivated.`);
      loadBOMs();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to deactivate BOM');
    } finally {
      setBOMToModify(null);
    }
  };

  const confirmApprove = async () => {
    if (!bomToModify) return;

    try {
      await approveBOM(bomToModify.id, true);
      handleApiSuccess('BOM approved', `BOM for ${bomToModify.styleCode} has been successfully approved.`);
      loadBOMs();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to approve BOM');
    } finally {
      setBOMToModify(null);
    }
  };

  const handleFilterChange = (filter: 'isActive' | 'approved', value: string) => {
    if (filter === 'isActive') {
      setIsActiveFilter(value);
    } else {
      setApprovedFilter(value);
    }
    setCurrentPage(1);
  };

  if (isLoading && boms.length === 0) {
    return (
      <div className="p-6">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Bill of Materials ({totalBOMs} total)</CardTitle>
            <div className="flex gap-2">
              <ExportButton
                module="bom"
                filters={{
                  isActive: isActiveFilter === 'all' ? undefined : isActiveFilter === 'true',
                  approved: approvedFilter === 'all' ? undefined : approvedFilter === 'true',
                }}
              />
              <ImportButton
                module="bom"
                onSuccess={loadBOMs}
              />
              <Button onClick={() => navigate('/bom/new')}>+ Create BOM</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <SearchInput
                placeholder="Search by style code or name..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>
            <div>
              <Select value={isActiveFilter} onValueChange={(value: string) => handleFilterChange('isActive', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="true">Active Only</SelectItem>
                  <SelectItem value="false">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={approvedFilter} onValueChange={(value: string) => handleFilterChange('approved', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by approval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Approvals</SelectItem>
                  <SelectItem value="true">Approved Only</SelectItem>
                  <SelectItem value="false">Pending Approval</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && boms.length === 0 && (
            <EmptyState
              icon={<FileText className="h-16 w-16" />}
              title="No BOMs found"
              description={searchQuery || isActiveFilter !== 'all' || approvedFilter !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'Create your first BOM to get started'}
              actionLabel={!searchQuery && isActiveFilter === 'all' && approvedFilter === 'all' ? 'Create First BOM' : undefined}
              onAction={!searchQuery && isActiveFilter === 'all' && approvedFilter === 'all' ? () => navigate('/bom/new') : undefined}
            />
          )}

          {/* BOM List (Card Layout) */}
          {!isLoading && boms.length > 0 && (
            <>
              <div className="space-y-4">
                {boms.map((bom) => (
                  <Card
                    key={bom.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(`/bom/${bom.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* Style Info */}
                        <div className="md:col-span-3">
                          <div className="font-medium">{bom.style?.styleCode}</div>
                          <div className="text-sm text-gray-600">{bom.style?.styleName}</div>
                          <div className="text-xs text-gray-500 mt-1">Version {bom.version}</div>
                        </div>

                        {/* Materials Count */}
                        <div className="md:col-span-2">
                          <div className="text-sm text-gray-600">Materials</div>
                          <div className="font-medium">{bom.items?.length || 0} items</div>
                        </div>

                        {/* Total Cost */}
                        <div className="md:col-span-2">
                          <div className="text-sm text-gray-600">Total Cost</div>
                          <div className="font-medium text-blue-600">
                            ₹{bom.totalCost ? Number(bom.totalCost).toFixed(2) : '0.00'}
                          </div>
                        </div>

                        {/* Status Badges */}
                        <div className="md:col-span-2 flex flex-col gap-1">
                          <StatusBadge
                            status={bom.isActive ? 'Active' : 'Inactive'}
                            variant={bom.isActive ? 'success' : 'secondary'}
                          />
                          <StatusBadge
                            status={bom.approvedById ? 'Approved' : 'Pending'}
                            variant={bom.approvedById ? 'info' : 'warning'}
                          />
                        </div>

                        {/* Actions */}
                        <div className="md:col-span-3 flex gap-2 justify-end items-center" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/bom/${bom.id}`);
                            }}
                          >
                            View
                          </Button>
                          {!bom.approvedById && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/bom/${bom.id}/edit`);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApproveClick(bom.id, bom.style?.styleCode || 'Unknown');
                                }}
                                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
                              >
                                Approve
                              </Button>
                            </>
                          )}
                          {bom.isActive && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(bom.id, bom.style?.styleCode || 'Unknown');
                              }}
                            >
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Material Preview */}
                      {bom.items && bom.items.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-xs text-gray-600 mb-2">Materials:</div>
                          <div className="flex flex-wrap gap-2">
                            {bom.items.slice(0, 5).map((item, idx) => (
                              <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {item.material?.name || 'Unknown Material'}
                              </span>
                            ))}
                            {bom.items.length > 5 && (
                              <span className="text-xs text-gray-500">
                                +{bom.items.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={totalBOMs}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Deactivate BOM"
        description={`Are you sure you want to deactivate BOM for ${bomToModify?.styleCode}? This action cannot be undone.`}
        confirmText="Deactivate"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />

      {/* Approve Confirmation Dialog */}
      <ConfirmDialog
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        title="Approve BOM"
        description={`Are you sure you want to approve BOM for ${bomToModify?.styleCode}? Once approved, it cannot be edited.`}
        confirmText="Approve"
        cancelText="Cancel"
        onConfirm={confirmApprove}
        variant="default"
      />
    </>
  );
}
