/**
 * Lace Defect List Page
 * Display and manage lace defects and claims
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { laceDefectService } from '../services/laceDefect.service';
import type {
  LaceDefect,
  DefectType,
  ClaimStatus,
  DiscoveredAt,
  DefectFilters,
} from '../types/laceDefect.types';
import {
  DEFECT_TYPE_LABELS,
  DEFECT_TYPE_COLORS,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_COLORS,
  DISCOVERED_AT_LABELS,
  CLAIM_STATUS_TRANSITIONS,
} from '../types/laceDefect.types';
import { notify } from '../lib/notify';
import {
  Plus,
  Search,
  RefreshCw,
  Eye,
  AlertTriangle,
  DollarSign,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

export default function LaceDefectList() {
  const navigate = useNavigate();
  const [defects, setDefects] = useState<LaceDefect[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [defectTypeFilter, setDefectTypeFilter] = useState<DefectType | ''>('');
  const [claimStatusFilter, setClaimStatusFilter] = useState<ClaimStatus | ''>('');
  const [discoveredAtFilter, setDiscoveredAtFilter] = useState<DiscoveredAt | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Summary
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    submitted: 0,
    resolved: 0,
  });

  // Claim modal
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<LaceDefect | null>(null);
  const [claimForm, setClaimForm] = useState({
    claimReference: '',
    claimAmount: 0,
    notes: '',
  });
  const [processing, setProcessing] = useState(false);

  const fetchDefects = async () => {
    setLoading(true);
    try {
      const filters: DefectFilters = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (defectTypeFilter) filters.defectType = defectTypeFilter;
      if (claimStatusFilter) filters.claimStatus = claimStatusFilter;
      if (discoveredAtFilter) filters.discoveredAt = discoveredAtFilter;
      if (searchTerm) filters.search = searchTerm;

      const response = await laceDefectService.getAllDefects(filters);
      setDefects(response.data);
      setPagination({
        page: response.pagination.page,
        limit: response.pagination.limit,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
      });

      // Calculate summary from current page
      let pending = 0;
      let submitted = 0;
      let resolved = 0;

      response.data.forEach((d) => {
        if (d.claimStatus === 'PENDING') pending++;
        if (d.claimStatus === 'SUBMITTED') submitted++;
        if (d.claimStatus === 'RESOLVED') resolved++;
      });

      setSummary({
        total: response.pagination.total,
        pending,
        submitted,
        resolved,
      });
    } catch (error) {
      console.error('Failed to fetch defects:', error);
      notify.error('Failed to load defects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDefects();
  }, [pagination.page, defectTypeFilter, claimStatusFilter, discoveredAtFilter]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchDefects();
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const openClaimModal = (defect: LaceDefect) => {
    setSelectedDefect(defect);
    setClaimForm({ claimReference: '', claimAmount: 0, notes: '' });
    setShowClaimModal(true);
  };

  const handleSubmitClaim = async () => {
    if (!selectedDefect) return;

    if (!claimForm.claimReference) {
      notify.error('Please enter a claim reference');
      return;
    }
    if (claimForm.claimAmount <= 0) {
      notify.error('Please enter a valid claim amount');
      return;
    }

    setProcessing(true);
    try {
      await laceDefectService.submitClaim(selectedDefect.id, claimForm);
      notify.success('Claim submitted successfully');
      setShowClaimModal(false);
      fetchDefects();
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Failed to submit claim');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateStatus = async (defect: LaceDefect, newStatus: ClaimStatus) => {
    try {
      await laceDefectService.updateClaimStatus(defect.id, {
        status: newStatus,
        resolution: newStatus === 'RESOLVED' ? 'Claim resolved' : undefined,
      });
      notify.success(`Status updated to ${CLAIM_STATUS_LABELS[newStatus]}`);
      fetchDefects();
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Failed to update status');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Lace Defects</h1>
          <p className="text-gray-500 mt-1">
            Track defects, manage claims, and record replacements
          </p>
        </div>
        <Button onClick={() => navigate('/lace-defects/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Log Defect
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{summary.total}</div>
                <div className="text-sm text-gray-500">Total Defects</div>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-200" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            claimStatusFilter === 'PENDING' ? 'ring-2 ring-gray-500' : ''
          }`}
          onClick={() =>
            setClaimStatusFilter(claimStatusFilter === 'PENDING' ? '' : 'PENDING')
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-600">{summary.pending}</div>
                <div className="text-sm text-gray-500">Pending Claims</div>
              </div>
              <Clock className="h-8 w-8 text-gray-200" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            claimStatusFilter === 'SUBMITTED' ? 'ring-2 ring-blue-500' : ''
          }`}
          onClick={() =>
            setClaimStatusFilter(claimStatusFilter === 'SUBMITTED' ? '' : 'SUBMITTED')
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-600">{summary.submitted}</div>
                <div className="text-sm text-gray-500">Claims Submitted</div>
              </div>
              <FileText className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            claimStatusFilter === 'RESOLVED' ? 'ring-2 ring-green-500' : ''
          }`}
          onClick={() =>
            setClaimStatusFilter(claimStatusFilter === 'RESOLVED' ? '' : 'RESOLVED')
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-600">{summary.resolved}</div>
                <div className="text-sm text-gray-500">Resolved</div>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by description, claim reference..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>

        <Select
          value={defectTypeFilter || '__all__'}
          onValueChange={(value) => setDefectTypeFilter(value === '__all__' ? '' : value as DefectType)}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="All Defect Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Defect Types</SelectItem>
            {Object.entries(DEFECT_TYPE_LABELS).map(([type, label]) => (
              <SelectItem key={type} value={type}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={claimStatusFilter || '__all__'}
          onValueChange={(value) => setClaimStatusFilter(value === '__all__' ? '' : value as ClaimStatus)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Statuses</SelectItem>
            {Object.entries(CLAIM_STATUS_LABELS).map(([status, label]) => (
              <SelectItem key={status} value={status}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={discoveredAtFilter || '__all__'}
          onValueChange={(value) => setDiscoveredAtFilter(value === '__all__' ? '' : value as DiscoveredAt)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Stages</SelectItem>
            {Object.entries(DISCOVERED_AT_LABELS).map(([stage, label]) => (
              <SelectItem key={stage} value={stage}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={fetchDefects} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : defects.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No defects found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Defect Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Discovered At
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Claim Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Claim Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {defects.map((defect) => {
                    const nextStatuses = CLAIM_STATUS_TRANSITIONS[defect.claimStatus] || [];
                    return (
                      <tr key={defect.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <Badge
                            className={`${DEFECT_TYPE_COLORS[defect.defectType]} border`}
                          >
                            {DEFECT_TYPE_LABELS[defect.defectType]}
                          </Badge>
                          {defect.defectDescription && (
                            <div className="text-xs text-gray-500 mt-1 max-w-[200px] truncate">
                              {defect.defectDescription}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm">
                            {DISCOVERED_AT_LABELS[defect.discoveredAt]}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="font-medium text-red-600">
                            {defect.defectQuantity.toLocaleString()}m
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge
                            className={`${CLAIM_STATUS_COLORS[defect.claimStatus]} border`}
                          >
                            {CLAIM_STATUS_LABELS[defect.claimStatus]}
                          </Badge>
                          {defect.claimReference && (
                            <div className="text-xs text-gray-500 mt-1 font-mono">
                              {defect.claimReference}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {formatCurrency(defect.claimAmount)}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          {formatDate(defect.discoveredDate)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/lace-defects/${defect.id}`)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {defect.claimStatus === 'PENDING' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openClaimModal(defect)}
                                title="Submit Claim"
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                            )}
                            {nextStatuses.includes('APPROVED') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUpdateStatus(defect, 'APPROVED')}
                                className="text-green-600"
                                title="Approve"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            )}
                            {nextStatuses.includes('REJECTED') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUpdateStatus(defect, 'REJECTED')}
                                className="text-red-600"
                                title="Reject"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === 1}
            onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
          >
            Previous
          </Button>
          <span className="px-4 py-2 text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === pagination.totalPages}
            onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
          >
            Next
          </Button>
        </div>
      )}

      {/* Claim Modal */}
      <Dialog open={showClaimModal} onOpenChange={setShowClaimModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Claim</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedDefect && (
              <div className="text-sm text-gray-500">
                <p>
                  <strong>Defect:</strong>{' '}
                  {DEFECT_TYPE_LABELS[selectedDefect.defectType]}
                </p>
                <p>
                  <strong>Quantity:</strong> {selectedDefect.defectQuantity}m
                </p>
              </div>
            )}
            <div>
              <Label>Claim Reference</Label>
              <Input
                value={claimForm.claimReference}
                onChange={(e) =>
                  setClaimForm({ ...claimForm, claimReference: e.target.value })
                }
                placeholder="e.g., CLM-2024-001"
              />
            </div>
            <div>
              <Label>Claim Amount (INR)</Label>
              <Input
                type="number"
                value={claimForm.claimAmount || ''}
                onChange={(e) =>
                  setClaimForm({
                    ...claimForm,
                    claimAmount: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="Enter amount"
              />
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={claimForm.notes}
                onChange={(e) =>
                  setClaimForm({ ...claimForm, notes: e.target.value })
                }
                placeholder="Additional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClaimModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitClaim} disabled={processing}>
              {processing ? 'Submitting...' : 'Submit Claim'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
