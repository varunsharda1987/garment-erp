import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { getAllCostSheets, approveCostSheet, deleteCostSheet } from '../services/costSheet.service';
import type { CostSheet } from '../types/costSheet.types';
import { toast } from 'react-hot-toast';
import ExportButton from '../components/ExportButton';
import { CheckCircle, XCircle, Edit, Eye, Trash2, RefreshCw } from 'lucide-react';

const CostSheetList = () => {
  const navigate = useNavigate();
  const [costSheets, setCostSheets] = useState<CostSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [approvedFilter, setApprovedFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchCostSheets = async () => {
    try {
      setLoading(true);
      const response = await getAllCostSheets({
        page,
        limit: 10,
        search,
        approved: approvedFilter,
      });
      setCostSheets(response.data);
      setTotalPages(response.pagination.pages);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch cost sheets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCostSheets();
  }, [page, search, approvedFilter]);

  const handleApprove = async (id: string, approved: boolean) => {
    try {
      await approveCostSheet(id, approved);
      toast.success(approved ? 'Cost sheet approved' : 'Approval revoked');
      fetchCostSheets();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update approval status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this cost sheet?')) return;

    try {
      await deleteCostSheet(id);
      toast.success('Cost sheet deleted');
      fetchCostSheets();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete cost sheet');
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Cost Sheets</h1>
        <div className="flex gap-2">
          <ExportButton
            module="style_costing"
            filters={{ approved: approvedFilter }}
          />
          <Button onClick={() => navigate('/cost-sheets/new')}>
            + New Cost Sheet
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Search by Style</label>
            <Input
              placeholder="Style code or name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Approval Status</label>
            <Select value={approvedFilter} onValueChange={(value: string) => {
              setApprovedFilter(value);
              setPage(1);
            }}>
              <SelectTrigger>
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
      </div>

      {/* Cost Sheets List */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : costSheets.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-gray-500">No cost sheets found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {costSheets.map((sheet) => (
            <div key={sheet.id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">
                      {sheet.style?.styleCode || 'N/A'}
                    </h3>
                    {sheet.isApproved ? (
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                        Approved
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                        Pending
                      </span>
                    )}
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
                        onClick={() => handleApprove(sheet.id, true)}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 flex items-center gap-2"
                        onClick={() => handleDelete(sheet.id)}
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
                      onClick={() => handleApprove(sheet.id, false)}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="px-4 py-2">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default CostSheetList;
