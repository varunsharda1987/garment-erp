/**
 * Processing Batch List
 * View and manage job work processing batches for fabric and lace
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import SearchInput from '@/components/SearchInput';
import { FilterBar } from '@/components/filters';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import processingBatchService from '../services/processingBatch.service';
import type { ProcessingBatch, MaterialType, BatchStatus, ProcessingBatchFilters } from '../types/processing.types';
import { notify } from '../lib/notify';
import { RefreshCw, Eye, Factory, Package, Clock, CheckCircle2, Layers, Plus, X } from 'lucide-react';
import { formatDate } from '@/lib/date';

// Status colors
const STATUS_COLORS: Record<BatchStatus, string> = {
  ACTIVE: 'bg-info-muted text-info border-info/20',
  COMPLETED: 'bg-success-muted text-success border-success/20',
  CANCELLED: 'bg-destructive/10 text-destructive border-destructive/20',
};

// Material type labels
const MATERIAL_LABELS: Record<MaterialType, string> = {
  GREIGE: 'Greige Fabric',
  FABRIC: 'Fabric',
  LACE: 'Lace',
};

export default function ProcessingBatchList() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<ProcessingBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<BatchStatus | ''>('');
  const [materialTypeFilter, setMaterialTypeFilter] = useState<MaterialType | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  const activeFilterCount = [statusFilter, materialTypeFilter, searchTerm].filter(Boolean).length;
  const clearFilters = () => {
    setStatusFilter('');
    setMaterialTypeFilter('');
    setSearchTerm('');
  };

  // Summary
  const [summary, setSummary] = useState({
    active: 0,
    completed: 0,
    inProcess: 0,
    inTransit: 0,
  });

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const filters: ProcessingBatchFilters = {};
      if (statusFilter) filters.overallStatus = statusFilter;
      if (materialTypeFilter) filters.materialType = materialTypeFilter;
      if (searchTerm) filters.search = searchTerm;

      const data = await processingBatchService.getAll(filters);
      setBatches(data);

      // Calculate summary
      let active = 0;
      let completed = 0;
      let inProcess = 0;
      let inTransit = 0;

      data.forEach((batch) => {
        if (batch.overallStatus === 'ACTIVE') active++;
        if (batch.overallStatus === 'COMPLETED') completed++;
        inProcess += batch.quantityInProcess;
        inTransit += batch.quantityInTransit;
      });

      setSummary({ active, completed, inProcess, inTransit });
    } catch (error) {
      console.error('Failed to fetch batches:', error);
      notify.error('Failed to load processing batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, materialTypeFilter, searchTerm]);

  const getMaterialName = (batch: ProcessingBatch): string => {
    if (batch.materialType === 'LACE' && batch.laceMaster) {
      return batch.laceMaster.laceName;
    }
    if (batch.materialType === 'GREIGE' && batch.greigeMaster) {
      return batch.greigeMaster.greigeName;
    }
    if (batch.materialType === 'FABRIC' && batch.fabricMaster) {
      return batch.fabricMaster.fabricName;
    }
    return 'Unknown Material';
  };

  const getMaterialCode = (batch: ProcessingBatch): string => {
    if (batch.materialType === 'LACE' && batch.laceMaster) {
      return batch.laceMaster.laceCode;
    }
    if (batch.materialType === 'GREIGE' && batch.greigeMaster) {
      return batch.greigeMaster.greigeCode;
    }
    if (batch.materialType === 'FABRIC' && batch.fabricMaster) {
      return batch.fabricMaster.fabricCode;
    }
    return '-';
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-display font-medium">Processing Batches</h1>
          <p className="text-muted-foreground mt-1">Manage job work processing for fabric and lace dyeing/printing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/processing/job-work')}>
            <Factory className="h-4 w-4 mr-2" />
            Job Work Dashboard
          </Button>
          <Button onClick={() => navigate('/processing/batches/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Batch
          </Button>
        </div>
      </div>

      {/* Phase 5b: batches are an orchestration shell — commercial + stock reality lives on JWOs */}
      <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Multi-stage batches are an orchestration shell only — stock movements, challans and costs live on{' '}
        <button className="underline font-medium" onClick={() => navigate('/job-work-orders')}>
          Job Work Orders
        </button>
        . Batch-stage wiring will be enabled when multi-stage processing is used.
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card
          className={`cursor-pointer transition-all ${statusFilter === 'ACTIVE' ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'ACTIVE' ? '' : 'ACTIVE')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-info">{summary.active}</div>
                <div className="text-sm text-muted-foreground">Active Batches</div>
              </div>
              <Clock className="h-8 w-8 text-info" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${statusFilter === 'COMPLETED' ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'COMPLETED' ? '' : 'COMPLETED')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-success">{summary.completed}</div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-accent">{summary.inProcess.toLocaleString()}m</div>
                <div className="text-sm text-muted-foreground">In Process</div>
              </div>
              <Layers className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-primary">{summary.inTransit.toLocaleString()}m</div>
                <div className="text-sm text-muted-foreground">In Transit</div>
              </div>
              <Package className="h-8 w-8 text-orange-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <FilterBar
        className="mb-6"
        onClear={clearFilters}
        hasActiveFilters={activeFilterCount > 0}
        clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
      >
        <SearchInput
          className="flex-1 min-w-[220px] max-w-md"
          placeholder="Search batch number, material, target colour…"
          value={searchTerm}
          onChange={setSearchTerm}
        />

        <Select
          value={statusFilter || '__all__'}
          onValueChange={(value) => setStatusFilter(value === '__all__' ? '' : (value as BatchStatus))}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={materialTypeFilter || '__all__'}
          onValueChange={(value) => setMaterialTypeFilter(value === '__all__' ? '' : (value as MaterialType))}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All materials" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All materials</SelectItem>
            {Object.entries(MATERIAL_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={fetchBatches} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </FilterBar>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : batches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {activeFilterCount > 0 ? (
                <>
                  <p>No processing batches match these filters.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear filters
                  </Button>
                </>
              ) : (
                'No processing batches found'
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Batch #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Material
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Sent
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      In Process
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Received
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-muted">
                      <td className="px-4 py-4">
                        <span className="font-mono font-medium">{batch.batchNumber}</span>
                        {batch.materialType === 'LACE' && batch.colorToApply && (
                          <div className="text-xs text-accent">Target: {batch.colorToApply}</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium">{getMaterialName(batch)}</div>
                        <div className="text-xs text-muted-foreground font-mono">{getMaterialCode(batch)}</div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge
                          className={`${
                            batch.materialType === 'LACE'
                              ? 'bg-pink-100 text-pink-800 border-pink-200'
                              : batch.materialType === 'GREIGE'
                                ? 'bg-warning/10 text-warning border-warning/20'
                                : 'bg-muted text-foreground border-border'
                          } border`}
                        >
                          {MATERIAL_LABELS[batch.materialType]}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-right">{batch.totalQuantitySent.toLocaleString()}m</td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-accent">{batch.quantityInProcess.toLocaleString()}m</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-success">{batch.totalQuantityReceived.toLocaleString()}m</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge className={`${STATUS_COLORS[batch.overallStatus]} border`}>{batch.overallStatus}</Badge>
                      </td>
                      <td className="px-4 py-4 text-sm">{formatDate(batch.createdAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/processing/batches/${batch.id}`)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
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
    </div>
  );
}
