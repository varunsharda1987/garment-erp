import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shirt,
  Plus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { garmentPhysicalTestsService } from '@/services/testing.service';
import type { GarmentPhysicalTest, TestResult } from '@/types/testing.types';
import { handleApiError } from '@/lib/api-error-handler';

export default function GarmentPhysicalTests() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<GarmentPhysicalTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TestResult | 'all'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    fetchTests();
  }, [page, search, statusFilter]);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const result = await garmentPhysicalTestsService.getAll({
        page,
        limit: pageSize,
        search: search || undefined,
        overallTestResult: statusFilter === 'all' ? undefined : statusFilter,
      });
      setTests(result.data);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      handleApiError(error, 'Failed to load garment physical tests');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const getStatusBadge = (result: TestResult) => {
    switch (result) {
      case 'PASS':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            PASS
          </Badge>
        );
      case 'FAIL':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300">
            <XCircle className="h-3 w-3 mr-1" />
            FAIL
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300">
            <Clock className="h-3 w-3 mr-1" />
            PENDING
          </Badge>
        );
      case 'RETEST_REQUIRED':
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-300">
            <RefreshCw className="h-3 w-3 mr-1" />
            RETEST
          </Badge>
        );
      case 'CONDITIONAL_PASS':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
            <AlertTriangle className="h-3 w-3 mr-1" />
            CONDITIONAL
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading garment tests...</p>
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
            <Shirt className="h-8 w-8 text-purple-600" />
            Garment Physical Tests (GPT)
          </h1>
          <p className="text-gray-500 mt-1">
            Track shrinkage, seam strength, and color fastness tests for finished garments
          </p>
        </div>
        <Button onClick={() => navigate('/garment-physical-tests/new')} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create GPT
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by test number, batch, work order..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as TestResult | 'all');
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Test Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="PASS">Pass</SelectItem>
              <SelectItem value="FAIL">Fail</SelectItem>
              <SelectItem value="RETEST_REQUIRED">Retest Required</SelectItem>
              <SelectItem value="CONDITIONAL_PASS">Conditional Pass</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Tests List */}
      {tests.length === 0 ? (
        <Card className="p-12 text-center">
          <Shirt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Garment Tests Found</h3>
          <p className="text-gray-500 mb-4">Create your first garment physical test</p>
          <Button onClick={() => navigate('/garment-physical-tests/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Create GPT
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {tests.map((test) => (
            <Card
              key={test.id}
              className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/garment-physical-tests/${test.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{test.testNumber}</h3>
                    {getStatusBadge(test.overallTestResult)}
                    {test.isRetest && (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700">
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Retest #{test.retestCount}
                      </Badge>
                    )}
                    {test.adminOverride && (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700">
                        Admin Override
                      </Badge>
                    )}
                    {test.buyerApprovalRequired && !test.buyerApprovedDate && (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                        <Clock className="h-3 w-3 mr-1" />
                        Buyer Approval Pending
                      </Badge>
                    )}
                    {test.buyerApprovedDate && (
                      <Badge className="bg-green-100 text-green-800 border-green-300">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Buyer Approved
                      </Badge>
                    )}
                  </div>

                  {/* Basic Info */}
                  <div className="grid grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-500">Work Order:</span>
                      <p className="font-medium text-gray-900">{test.workOrderId}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Style:</span>
                      <p className="font-medium text-gray-900">{test.styleId}</p>
                    </div>
                    {test.batchNumber && (
                      <div>
                        <span className="text-gray-500">Batch:</span>
                        <p className="font-medium text-gray-900">{test.batchNumber}</p>
                      </div>
                    )}
                    {test.sampleQuantity && (
                      <div>
                        <span className="text-gray-500">Sample Qty:</span>
                        <p className="font-medium text-gray-900">{test.sampleQuantity} pcs</p>
                      </div>
                    )}
                  </div>

                  {/* Test Results Summary */}
                  {test.overallTestResult !== 'PENDING' && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        {/* Shrinkage */}
                        {test.shrinkageTestResult && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Shrinkage:</span>
                            <span
                              className={`font-semibold ${
                                test.shrinkageTestResult === 'PASS' ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {test.shrinkageTestResult === 'PASS' ? '✓' : '✗'}
                            </span>
                            {test.lengthShrinkage !== null && (
                              <span className="text-gray-600">
                                L: {test.lengthShrinkage.toFixed(1)}%
                              </span>
                            )}
                            {test.widthShrinkage !== null && (
                              <span className="text-gray-600">
                                W: {test.widthShrinkage.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        )}

                        {/* Seam Strength */}
                        {test.seamTestResult && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Seam:</span>
                            <span
                              className={`font-semibold ${
                                test.seamTestResult === 'PASS' ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {test.seamTestResult === 'PASS' ? '✓' : '✗'}
                            </span>
                            {test.seamStrength && (
                              <span className="text-gray-600">{test.seamStrength} kg</span>
                            )}
                          </div>
                        )}

                        {/* Color Fastness */}
                        {test.colorTestResult && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Color:</span>
                            <span
                              className={`font-semibold ${
                                test.colorTestResult === 'PASS' ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {test.colorTestResult === 'PASS' ? '✓' : '✗'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Failure Reason */}
                  {test.failureReason && (
                    <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-700">
                      <span className="font-semibold">Failure Reason:</span> {test.failureReason}
                    </div>
                  )}

                  {/* Buyer Remarks */}
                  {test.buyerRemarks && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-700">
                      <span className="font-semibold">Buyer Remarks:</span> {test.buyerRemarks}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
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
