/**
 * Processing Batch List
 * View and manage job work processing batches for fabric and lace
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import processingBatchService from '../services/processingBatch.service';
import type {
  ProcessingBatch,
  MaterialType,
  BatchStatus,
  ProcessingBatchFilters,
} from '../types/processing.types';
import { notify } from '../lib/notify';
import {
  Plus,
  Search,
  RefreshCw,
  Eye,
  Factory,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Layers,
} from 'lucide-react';

// Status colors
const STATUS_COLORS: Record<BatchStatus, string> = {
  ACTIVE: 'bg-blue-100 text-blue-800 border-blue-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
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
  }, [statusFilter, materialTypeFilter]);

  const handleSearch = () => {
    fetchBatches();
  };

  const formatDate = (dateString: string | Date | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

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
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Processing Batches</h1>
          <p className="text-gray-500 mt-1">
            Manage job work processing for fabric and lace dyeing/printing
          </p>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card
          className={`cursor-pointer transition-all ${
            statusFilter === 'ACTIVE' ? 'ring-2 ring-blue-500' : ''
          }`}
          onClick={() => setStatusFilter(statusFilter === 'ACTIVE' ? '' : 'ACTIVE')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-600">{summary.active}</div>
                <div className="text-sm text-gray-500">Active Batches</div>
              </div>
              <Clock className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            statusFilter === 'COMPLETED' ? 'ring-2 ring-green-500' : ''
          }`}
          onClick={() => setStatusFilter(statusFilter === 'COMPLETED' ? '' : 'COMPLETED')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-600">{summary.completed}</div>
                <div className="text-sm text-gray-500">Completed</div>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {summary.inProcess.toLocaleString()}m
                </div>
                <div className="text-sm text-gray-500">In Process</div>
              </div>
              <Layers className="h-8 w-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {summary.inTransit.toLocaleString()}m
                </div>
                <div className="text-sm text-gray-500">In Transit</div>
              </div>
              <Package className="h-8 w-8 text-orange-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by batch number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>

        <Select
          value={statusFilter || '__all__'}
          onValueChange={(value) => setStatusFilter(value === '__all__' ? '' : value as BatchStatus)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={materialTypeFilter || '__all__'}
          onValueChange={(value) => setMaterialTypeFilter(value === '__all__' ? '' : value as MaterialType)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Materials" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Materials</SelectItem>
            <SelectItem value="GREIGE">Greige Fabric</SelectItem>
            <SelectItem value="FABRIC">Fabric</SelectItem>
            <SelectItem value="LACE">Lace</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={fetchBatches} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : batches.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No processing batches found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Batch #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Material
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sent
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      In Process
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Received
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <span className="font-mono font-medium">{batch.batchNumber}</span>
                        {batch.materialType === 'LACE' && batch.colorToApply && (
                          <div className="text-xs text-purple-600">
                            Target: {batch.colorToApply}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium">{getMaterialName(batch)}</div>
                        <div className="text-xs text-gray-500 font-mono">
                          {getMaterialCode(batch)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge
                          className={`${
                            batch.materialType === 'LACE'
                              ? 'bg-pink-100 text-pink-800 border-pink-200'
                              : batch.materialType === 'GREIGE'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-gray-100 text-gray-800 border-gray-200'
                          } border`}
                        >
                          {MATERIAL_LABELS[batch.materialType]}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {batch.totalQuantitySent.toLocaleString()}m
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-purple-600">
                          {batch.quantityInProcess.toLocaleString()}m
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-green-600">
                          {batch.totalQuantityReceived.toLocaleString()}m
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge className={`${STATUS_COLORS[batch.overallStatus]} border`}>
                          {batch.overallStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {formatDate(batch.createdAt)}
                      </td>
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
