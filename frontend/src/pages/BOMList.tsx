import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { getAllBOMs, deleteBOM, approveBOM } from '../services/bom.service';
import type { BillOfMaterial, BOMListFilters } from '../types/bom.types';
import ExportButton from '../components/ExportButton';
import ImportButton from '../components/ImportButton';

export default function BOMList() {
  const navigate = useNavigate();
  const [boms, setBOMs] = useState<BillOfMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('all');
  const [approvedFilter, setApprovedFilter] = useState<string>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const loadBOMs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const filters: BOMListFilters = {
        page: currentPage,
        limit,
        search: search || undefined,
        isActive: isActiveFilter === 'all' ? undefined : isActiveFilter === 'true',
        approved: approvedFilter === 'all' ? undefined : approvedFilter === 'true',
      };

      const response = await getAllBOMs(filters);
      setBOMs(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotal(response.pagination.total);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load BOMs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBOMs();
  }, [currentPage, search, isActiveFilter, approvedFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this BOM?')) {
      return;
    }

    try {
      await deleteBOM(id);
      loadBOMs();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete BOM');
    }
  };

  const handleApprove = async (id: string, approved: boolean) => {
    try {
      await approveBOM(id, approved);
      loadBOMs();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update approval status');
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleFilterChange = (filter: 'isActive' | 'approved', value: string) => {
    if (filter === 'isActive') {
      setIsActiveFilter(value);
    } else {
      setApprovedFilter(value);
    }
    setCurrentPage(1);
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Bill of Materials</CardTitle>
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
              <Input
                placeholder="Search by style code or name..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
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

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8">Loading BOMs...</div>
          ) : boms.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No BOMs found. Create your first BOM to get started.
            </div>
          ) : (
            <>
              {/* BOM List */}
              <div className="space-y-4">
                {boms.map((bom) => (
                  <Card key={bom.id} className="hover:shadow-md transition-shadow">
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
                          <span
                            className={`inline-block px-2 py-1 text-xs rounded ${
                              bom.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {bom.isActive ? 'Active' : 'Inactive'}
                          </span>
                          {bom.approvedById ? (
                            <span className="inline-block px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                              Approved
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">
                              Pending
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="md:col-span-3 flex gap-2 justify-end items-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/bom/${bom.id}`)}
                          >
                            View
                          </Button>
                          {!bom.approvedById && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/bom/${bom.id}/edit`)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApprove(bom.id, true)}
                                className="bg-green-50 hover:bg-green-100"
                              >
                                Approve
                              </Button>
                            </>
                          )}
                          {bom.isActive && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(bom.id)}
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
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {(currentPage - 1) * limit + 1} to {Math.min(currentPage * limit, total)} of {total} BOMs
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={page === currentPage ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
