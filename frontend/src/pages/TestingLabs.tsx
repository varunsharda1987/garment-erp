import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Search, Edit, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { testingLabsService } from '@/services/testing.service';
import type { TestingLab } from '@/types/testing.types';
import { handleApiError } from '@/lib/api-error-handler';

export default function TestingLabs() {
  const navigate = useNavigate();
  const [labs, setLabs] = useState<TestingLab[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    fetchLabs();
  }, [page, search]);

  const fetchLabs = async () => {
    try {
      setLoading(true);
      const result = await testingLabsService.getAll({
        page,
        limit: pageSize,
        search: search || undefined,
      });
      setLabs(result.data);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      handleApiError(error, 'Failed to load testing labs');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading testing labs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-green-600" />
            Testing Labs
          </h1>
          <p className="text-gray-500 mt-1">Manage external testing laboratory information</p>
        </div>
        <Button onClick={() => navigate('/testing-labs/new')} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Testing Lab
        </Button>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by lab code, name, city..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Card>

      {/* Labs List */}
      {labs.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Testing Labs Found</h3>
          <p className="text-gray-500 mb-4">Get started by adding your first testing lab</p>
          <Button onClick={() => navigate('/testing-labs/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Testing Lab
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {labs.map((lab) => (
            <Card key={lab.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-gray-900">{lab.labName}</h3>
                    {lab.isActive ? (
                      <Badge className="bg-green-100 text-green-800 border-green-300">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-100 text-gray-600">
                        <XCircle className="h-3 w-3 mr-1" />
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 font-mono">{lab.labCode}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm mb-4">
                {lab.contactPerson && (
                  <div className="flex items-start">
                    <span className="text-gray-500 w-24">Contact:</span>
                    <span className="text-gray-900 font-medium">{lab.contactPerson}</span>
                  </div>
                )}
                {lab.contactPhone && (
                  <div className="flex items-start">
                    <span className="text-gray-500 w-24">Phone:</span>
                    <span className="text-gray-900">{lab.contactPhone}</span>
                  </div>
                )}
                {lab.contactEmail && (
                  <div className="flex items-start">
                    <span className="text-gray-500 w-24">Email:</span>
                    <span className="text-gray-900 text-xs">{lab.contactEmail}</span>
                  </div>
                )}
                {lab.city && (
                  <div className="flex items-start">
                    <span className="text-gray-500 w-24">Location:</span>
                    <span className="text-gray-900">
                      {lab.city}
                      {lab.state && `, ${lab.state}`}
                    </span>
                  </div>
                )}
                <div className="flex items-start">
                  <span className="text-gray-500 w-24">Turnaround:</span>
                  <span className="text-gray-900 font-medium">{lab.averageTurnaroundDays} days</span>
                </div>
              </div>

              {/* Accreditations */}
              {lab.accreditations && lab.accreditations.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2">Accreditations:</p>
                  <div className="flex flex-wrap gap-1">
                    {lab.accreditations.map((acc, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs bg-blue-50">
                        {acc}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => navigate(`/testing-labs/${lab.id}/edit`)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(`/testing-labs/${lab.id}`)}>
                  View
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </Button>
          <span className="px-4 py-2 text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
