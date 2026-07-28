// Job Work Dashboard - Overview of all job work processing
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import processingBatchService from '../services/processingBatch.service';
import type { JobWorkSummary, ProcessingBatch } from '../types/processing.types';
import { handleApiError } from '@/lib/api-error-handler';

export default function JobWorkDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<JobWorkSummary | null>(null);
  const [activeBatches, setActiveBatches] = useState<ProcessingBatch[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        // getJobWorkSummary() = live totals across ACTIVE batches; getAll({ ACTIVE }) = the list.
        const [summaryData, batches] = await Promise.all([
          processingBatchService.getJobWorkSummary(),
          processingBatchService.getAll({ overallStatus: 'ACTIVE' }),
        ]);
        setSummary(summaryData);
        setActiveBatches(batches);
      } catch (err) {
        setError(handleApiError(err, 'Failed to load job work summary', false));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getMaterialName = (batch: ProcessingBatch): string => {
    if (batch.materialType === 'LACE' && batch.laceMaster) return batch.laceMaster.laceName;
    if (batch.materialType === 'GREIGE' && batch.greigeMaster) return batch.greigeMaster.greigeName;
    if (batch.materialType === 'FABRIC' && batch.fabricMaster) return batch.fabricMaster.fabricName;
    return 'Unknown Material';
  };

  const formatQty = (value: number) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const formatCost = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h2 className="text-3xl font-display font-medium text-foreground mb-2">Job Work Dashboard</h2>
        <p className="text-muted-foreground">Overview of materials at processors</p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-lg shadow p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Active Batches</div>
          <div className="text-2xl font-bold">{summary?.totalBatches ?? 0}</div>
          <p className="text-xs text-muted-foreground mt-1">Currently being processed</p>
        </div>

        <div className="bg-card rounded-lg shadow p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Quantity In Process</div>
          <div className="text-2xl font-bold">{formatQty(summary?.totalQuantityInProcess ?? 0)}m</div>
          <p className="text-xs text-muted-foreground mt-1">At processors</p>
        </div>

        <div className="bg-card rounded-lg shadow p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Quantity In Transit</div>
          <div className="text-2xl font-bold">{formatQty(summary?.totalQuantityInTransit ?? 0)}m</div>
          <p className="text-xs text-muted-foreground mt-1">Being transported</p>
        </div>

        <div className="bg-card rounded-lg shadow p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Total Cost</div>
          <div className="text-2xl font-bold">{formatCost(summary?.totalCost ?? 0)}</div>
          <p className="text-xs text-muted-foreground mt-1">Incurred so far</p>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Active Processing Batches</h3>
            <button
              onClick={() => navigate('/processing/batches')}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary"
            >
              View All Batches
            </button>
          </div>
        </div>
        <div className="p-6">
          {activeBatches.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No active processing batches</div>
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
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      In Process
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      In Transit
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {activeBatches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-muted">
                      <td className="px-4 py-4 font-mono font-medium">{batch.batchNumber}</td>
                      <td className="px-4 py-4">{getMaterialName(batch)}</td>
                      <td className="px-4 py-4 text-right">{formatQty(batch.quantityInProcess)}m</td>
                      <td className="px-4 py-4 text-right">{formatQty(batch.quantityInTransit)}m</td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => navigate(`/processing/batches/${batch.id}`)}
                          className="text-primary hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
