import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, FileText, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { fabricPhysicalTestsService } from '@/services/testing.service';
import type { FabricPhysicalTest, TestResult } from '@/types/testing.types';
import { handleApiError } from '@/lib/api-error-handler';

export default function FabricPhysicalTests() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<FabricPhysicalTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchTests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, filterStatus]);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const params: Record<string, unknown> = { page, limit: 20 };
      if (search) params.search = search;
      if (filterStatus !== 'all') params.overallTestResult = filterStatus;

      const result = await fabricPhysicalTestsService.getAll(params);
      setTests(result.data);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      handleApiError(error, 'Failed to fetch fabric tests');
    } finally {
      setLoading(false);
    }
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
            <AlertCircle className="h-3 w-3 mr-1" />
            RETEST
          </Badge>
        );
      default:
        return <Badge variant="outline">{result}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fabric Physical Tests</h1>
          <p className="text-gray-500 mt-1">Manage fabric testing records and results</p>
        </div>
        <Button onClick={() => navigate('/fabric-physical-tests/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          New Test
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by test number, batch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tests</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="PASS">Passed</SelectItem>
              <SelectItem value="FAIL">Failed</SelectItem>
              <SelectItem value="RETEST_REQUIRED">Retest Required</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Tests List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading tests...</p>
        </div>
      ) : tests.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No tests found</h3>
          <p className="text-gray-500 mb-6">Get started by creating a new fabric physical test</p>
          <Button onClick={() => navigate('/fabric-physical-tests/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Test
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {tests.map((test) => (
            <Card
              key={test.id}
              className="p-5 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/fabric-physical-tests/${test.id}`)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{test.testNumber}</h3>
                    {getStatusBadge(test.overallTestResult)}
                    {test.isRetest && (
                      <Badge variant="outline" className="text-xs">
                        Retest #{test.retestCount}
                      </Badge>
                    )}
                    {test.adminOverride && (
                      <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-xs">Admin Override</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Batch:</span>
                      <p className="font-medium text-gray-900">{test.batchNumber || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Sent to Lab:</span>
                      <p className="font-medium text-gray-900">{formatDate(test.sentToLabDate)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Result Received:</span>
                      <p className="font-medium text-gray-900">{formatDate(test.testResultReceivedDate)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Sample Qty:</span>
                      <p className="font-medium text-gray-900">
                        {test.sampleQuantity ? `${test.sampleQuantity} m` : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Test Results Summary */}
                  {test.overallTestResult !== 'PENDING' && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">GSM:</span>
                          <span className="font-semibold">
                            {test.testedGSM || 'N/A'}
                            {test.expectedGSM && <span className="text-gray-500 ml-1">(exp: {test.expectedGSM})</span>}
                          </span>
                          {test.gsmTestResult && (
                            <span className="ml-1">{test.gsmTestResult === 'PASS' ? '✓' : '✗'}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Construction:</span>
                          <span className="font-semibold">
                            {test.testedConstruction || test.expectedConstruction || 'N/A'}
                          </span>
                          {test.constructionTestResult && (
                            <span className="ml-1">{test.constructionTestResult === 'PASS' ? '✓' : '✗'}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Count:</span>
                          <span className="font-semibold">{test.testedCount || test.expectedCount || 'N/A'}</span>
                          {test.countTestResult && (
                            <span className="ml-1">{test.countTestResult === 'PASS' ? '✓' : '✗'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {test.failureReason && (
                    <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-700">
                      <strong>Failure Reason:</strong> {test.failureReason}
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
        <div className="flex justify-center gap-2 mt-6">
          <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </Button>
          <span className="py-2 px-4 text-sm text-gray-700">
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
