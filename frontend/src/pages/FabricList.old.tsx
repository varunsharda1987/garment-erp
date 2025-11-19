import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { fabricService } from '../services/fabricGreigeService';
import type { FabricMaster, PaginatedResponse } from '../types/fabric-greige.types';

export default function FabricList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [fabrics, setFabrics] = useState<FabricMaster[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<string>('true');

  useEffect(() => {
    fetchFabrics();
  }, [pagination.page, filterActive]);

  const fetchFabrics = async () => {
    try {
      setLoading(true);
      const response: PaginatedResponse<FabricMaster> = await fabricService.getAll({
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        isActive: filterActive,
      });
      setFabrics(response.data);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Error fetching fabrics:', error);
      alert('Failed to load fabric masters');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchFabrics();
  };

  const handleDelete = async (id: string, fabricName: string) => {
    if (!confirm(`Are you sure you want to delete "${fabricName}"? This will also delete all CAD width entries for this fabric.`)) {
      return;
    }

    try {
      const result = await fabricService.delete(id);
      alert(`Fabric deleted successfully. ${result.deletedCADs} CAD entries were also removed.`);
      fetchFabrics();
    } catch (error: any) {
      console.error('Error deleting fabric:', error);
      alert(error.response?.data?.error || 'Failed to delete fabric master');
    }
  };

  return (
    <>
      <PageHeader title="Fabric Master" />

      {/* Search and Filter Bar */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <form onSubmit={handleSearch} className="flex gap-4 flex-wrap items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <Input
              type="text"
              placeholder="Search by code, name, or color..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          </div>

          <Button type="submit">Search</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearchTerm('');
              setFilterActive('true');
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
          >
            Clear
          </Button>
          <Link to="/fabric/new">
            <Button>+ New Fabric</Button>
          </Link>
        </form>
      </div>

      {/* Results Summary */}
      <div className="mb-4 text-sm text-gray-600">
        Showing {fabrics.length} of {pagination.total} fabric masters
      </div>

      {/* Fabrics Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Color
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Greige Base
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Width (")
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost/m
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CAD Widths
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : fabrics.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                    No fabric masters found
                  </td>
                </tr>
              ) : (
                fabrics.map((fabric) => (
                  <tr key={fabric.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/fabric/${fabric.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {fabric.fabricCode}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {fabric.fabricName}
                      </div>
                      {fabric.finishType && (
                        <div className="text-sm text-gray-500">{fabric.finishType}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {fabric.colorName && (
                        <div className="text-sm text-gray-900">{fabric.colorName}</div>
                      )}
                      {fabric.colorCode && (
                        <div className="text-xs text-gray-500">{fabric.colorCode}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {fabric.greige && (
                        <div className="text-sm text-gray-900">
                          {fabric.greige.greigeCode}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {Number(fabric.actualWidth)}"
                      {fabric.actualShrinkagePercent && (
                        <div className="text-xs text-gray-500">
                          -{Number(fabric.actualShrinkagePercent)}%
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${Number(fabric.costPerMeter).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={fabric._count?.widthCADs ? 'default' : 'secondary'}>
                        {fabric._count?.widthCADs || 0} widths
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {fabric.isActive ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        to={`/fabric/${fabric.id}`}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        View
                      </Link>
                      <Link
                        to={`/fabric/${fabric.id}/edit`}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(fabric.id, fabric.fabricName)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <Button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                variant="outline"
              >
                Previous
              </Button>
              <Button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                variant="outline"
              >
                Next
              </Button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing page <span className="font-medium">{pagination.page}</span> of{' '}
                  <span className="font-medium">{pagination.totalPages}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <Button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    variant="outline"
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md"
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    variant="outline"
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md"
                  >
                    Next
                  </Button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
