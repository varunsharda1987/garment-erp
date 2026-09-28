/**
 * Lace Lab Dip List Page
 * Display and manage lab dip requests for greige lace processing
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import Pagination from '../components/Pagination';
import SearchInput from '../components/SearchInput';
import { FilterBar } from '../components/filters';
import { ProcessorCombobox } from '../components/ProcessorCombobox';
import { laceLabDipService } from '../services/laceLabDip.service';
import type { LaceLabDip, LabDipStatus, LabDipListFilters } from '../types/laceLabDip.types';
import { LAB_DIP_STATUS_COLORS, LAB_DIP_STATUS_LABELS } from '../types/laceLabDip.types';
import { notify } from '../lib/notify';
import { Plus, Eye, Trash2, RefreshCw, ArrowRight } from 'lucide-react';
import { formatDate } from '@/lib/date';

export default function LaceLabDipList() {
  const navigate = useNavigate();
  const [labDips, setLabDips] = useState<LaceLabDip[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0, // backend key is totalPages (bug-hunt orders-13)
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<LabDipStatus | ''>('');
  const [processorFilter, setProcessorFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Every filter change goes back to page 1 (set together, so the old page is never fetched with the new filter)
  const changeFilter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPagination((prev) => ({ ...prev, page: 1 }));
    };

  const activeFilterCount = [searchTerm, statusFilter, processorFilter].filter(Boolean).length;
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setProcessorFilter('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

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
      // The API searches the lab dip number, target color, greige lace and processor
      const filters: LabDipListFilters & { search?: string } = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (statusFilter) {
        filters.status = statusFilter;
      }
      if (processorFilter) filters.processorId = processorFilter;
      if (searchTerm) filters.search = searchTerm;

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
  }, [pagination.page, pagination.limit, statusFilter, processorFilter, searchTerm]);

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
            onClick={() => changeFilter(setStatusFilter)(statusFilter === status ? '' : (status as LabDipStatus))}
          >
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{statusCounts[status as LabDipStatus]}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <FilterBar
        className="mb-6"
        onClear={clearFilters}
        hasActiveFilters={activeFilterCount > 0}
        clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
      >
        <SearchInput
          className="flex-1 min-w-[200px] max-w-md"
          placeholder="Search lab dip number, target color, lace or processor..."
          value={searchTerm}
          onChange={changeFilter(setSearchTerm)}
        />
        <Select
          value={statusFilter || '__all__'}
          onValueChange={(value) => changeFilter(setStatusFilter)(value === '__all__' ? '' : (value as LabDipStatus))}
        >
          <SelectTrigger className="w-[200px]" aria-label="Status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {Object.entries(LAB_DIP_STATUS_LABELS).map(([status, label]) => (
              <SelectItem key={status} value={status}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ProcessorCombobox
          value={processorFilter}
          onValueChange={changeFilter(setProcessorFilter)}
          allowAll
          placeholder="All processors"
          className="w-[220px]"
        />
        <Button variant="outline" onClick={fetchLabDips} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </FilterBar>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : labDips.length === 0 && activeFilterCount > 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-4">No lab dips match these filters.</p>
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : labDips.length === 0 ? (
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
                  {labDips.map((labDip) => (
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
      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        pageSize={pagination.limit}
        totalItems={pagination.total}
        onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
        onPageSizeChange={(limit) => setPagination((prev) => ({ ...prev, page: 1, limit }))}
        pageSizeOptions={[20, 50, 100]}
        itemLabel="lab dips"
      />
    </div>
  );
}
