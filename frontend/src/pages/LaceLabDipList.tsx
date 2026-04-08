/**
 * Lace Lab Dip List Page
 * Display and manage lab dip requests for greige lace processing
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { laceLabDipService } from '../services/laceLabDip.service';
import type { LaceLabDip, LabDipStatus, LabDipListFilters } from '../types/laceLabDip.types';
import { LAB_DIP_STATUS_COLORS, LAB_DIP_STATUS_LABELS } from '../types/laceLabDip.types';
import { notify } from '../lib/notify';
import { Plus, Search, Eye, Trash2, RefreshCw, ArrowRight } from 'lucide-react';

export default function LaceLabDipList() {
  const navigate = useNavigate();
  const [labDips, setLabDips] = useState<LaceLabDip[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<LabDipStatus | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Summary counts
  const [statusCounts, setStatusCounts] = useState<Record<LabDipStatus, number>>({
    PENDING: 0,
    SENT_TO_PROCESSOR: 0,
    SAMPLE_RECEIVED: 0,
    AWAITING_BUYER_APPROVAL: 0,
    APPROVED: 0,
    REJECTED: 0,
  });

  const fetchLabDips = async () => {
    setLoading(true);
    try {
      const filters: LabDipListFilters = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (statusFilter) {
        filters.status = statusFilter;
      }

      const response = await laceLabDipService.getAllLabDips(filters);
      setLabDips(response.data);
      setPagination(response.pagination);

      // Calculate status counts
      const counts: Record<LabDipStatus, number> = {
        PENDING: 0,
        SENT_TO_PROCESSOR: 0,
        SAMPLE_RECEIVED: 0,
        AWAITING_BUYER_APPROVAL: 0,
        APPROVED: 0,
        REJECTED: 0,
      };
      response.data.forEach((ld) => {
        counts[ld.status]++;
      });
      setStatusCounts(counts);
    } catch (error) {
      console.error('Failed to fetch lab dips:', error);
      notify.error('Failed to load lab dips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLabDips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, statusFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lab dip request?')) {
      return;
    }

    try {
      await laceLabDipService.deleteLabDip(id);
      notify.success('Lab dip deleted successfully');
      fetchLabDips();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      notify.error(err.response?.data?.error || 'Failed to delete lab dip');
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Filter lab dips by search term
  const filteredLabDips = labDips.filter((ld) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      ld.labDipNumber.toLowerCase().includes(search) ||
      ld.targetColor.toLowerCase().includes(search) ||
      ld.greigeLace?.laceName?.toLowerCase().includes(search) ||
      ld.processor?.name?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-display font-medium">Lace Lab Dips</h1>
          <p className="text-muted-foreground mt-1">Manage lab dip approval workflow for greige lace processing</p>
        </div>
        <Button onClick={() => navigate('/lace-lab-dips/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Lab Dip
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {Object.entries(LAB_DIP_STATUS_LABELS).map(([status, label]) => (
          <Card
            key={status}
            className={`cursor-pointer transition-all ${statusFilter === status ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => setStatusFilter(statusFilter === status ? '' : (status as LabDipStatus))}
          >
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{statusCounts[status as LabDipStatus]}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by number, color, lace, processor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter || '__all__'}
          onValueChange={(value) => setStatusFilter(value === '__all__' ? '' : (value as LabDipStatus))}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Statuses</SelectItem>
            {Object.entries(LAB_DIP_STATUS_LABELS).map(([status, label]) => (
              <SelectItem key={status} value={status}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchLabDips} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : filteredLabDips.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No lab dip requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Lab Dip #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Greige Lace
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Target Color
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Processor
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Request Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredLabDips.map((labDip) => (
                    <tr key={labDip.id} className="hover:bg-muted">
                      <td className="px-4 py-4">
                        <span className="font-mono font-medium">{labDip.labDipNumber}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium">{labDip.greigeLace?.laceName || '-'}</div>
                        <div className="text-xs text-muted-foreground">{labDip.greigeLace?.laceCode || ''}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-medium">{labDip.targetColor}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium">{labDip.processor?.name || '-'}</div>
                        <div className="text-xs text-muted-foreground">{labDip.processor?.code || ''}</div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge className={`${LAB_DIP_STATUS_COLORS[labDip.status]} border`}>
                          {LAB_DIP_STATUS_LABELS[labDip.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">{formatDate(labDip.requestDate)}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/lace-lab-dips/${labDip.id}`)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/lace-lab-dips/${labDip.id}/workflow`)}
                            title="Update Status"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                          {labDip.status === 'PENDING' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(labDip.id)}
                              className="text-destructive hover:text-destructive"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === 1}
            onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
          >
            Previous
          </Button>
          <span className="px-4 py-2 text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === pagination.pages}
            onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
