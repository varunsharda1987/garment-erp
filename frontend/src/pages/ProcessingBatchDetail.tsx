// Processing Batch Detail - View batch stages, movements and deliveries
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import processingBatchService from '../services/processingBatch.service';
import type { ProcessingBatch, BatchStatus } from '../types/processing.types';
import { handleApiError } from '@/lib/api-error-handler';

const STATUS_COLORS: Record<BatchStatus, string> = {
  ACTIVE: 'bg-info-muted text-info border-info/20',
  COMPLETED: 'bg-success-muted text-success border-success/20',
  CANCELLED: 'bg-destructive/10 text-destructive border-destructive/20',
};

const MATERIAL_LABELS: Record<string, string> = {
  GREIGE: 'Greige Fabric',
  FABRIC: 'Fabric',
  LACE: 'Lace',
};

export default function ProcessingBatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<ProcessingBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await processingBatchService.getById(id);
        setBatch(data);
      } catch (err) {
        setError(handleApiError(err, 'Failed to load batch details', false));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const formatDate = (value: string | Date | undefined) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const formatQty = (value: number | undefined) =>
    Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const formatCost = (value: number | undefined) =>
    `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const getMaterialName = (b: ProcessingBatch): string => {
    if (b.materialType === 'LACE' && b.laceMaster) return b.laceMaster.laceName;
    if (b.materialType === 'GREIGE' && b.greigeMaster) return b.greigeMaster.greigeName;
    if (b.materialType === 'FABRIC' && b.fabricMaster) return b.fabricMaster.fabricName;
    return 'Unknown Material';
  };
  const getMaterialCode = (b: ProcessingBatch): string => {
    if (b.materialType === 'LACE' && b.laceMaster) return b.laceMaster.laceCode;
    if (b.materialType === 'GREIGE' && b.greigeMaster) return b.greigeMaster.greigeCode;
    if (b.materialType === 'FABRIC' && b.fabricMaster) return b.fabricMaster.fabricCode;
    return '-';
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <button
          onClick={() => navigate('/processing/batches')}
          className="mb-4 text-primary hover:text-primary flex items-center gap-2"
        >
          ← Back to Batches
        </button>
        <h2 className="text-3xl font-display font-medium text-foreground mb-2">Processing Batch Details</h2>
        {batch ? (
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-medium">{batch.batchNumber}</span>
            <Badge className={`${STATUS_COLORS[batch.overallStatus]} border`}>{batch.overallStatus}</Badge>
          </div>
        ) : (
          <p className="text-muted-foreground">Batch ID: {id}</p>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-card rounded-lg shadow p-6">
          <div className="text-center text-muted-foreground py-8">Loading batch details...</div>
        </div>
      ) : !batch ? (
        !error && (
          <div className="bg-card rounded-lg shadow p-6">
            <div className="text-center text-muted-foreground py-8">Batch not found</div>
          </div>
        )
      ) : (
        <div className="space-y-6">
          {/* Material + summary */}
          <div className="bg-card rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <div className="text-sm text-muted-foreground">Material</div>
                <div className="font-medium">{getMaterialName(batch)}</div>
                <div className="text-xs text-muted-foreground font-mono">{getMaterialCode(batch)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Type</div>
                <div className="font-medium">{MATERIAL_LABELS[batch.materialType] ?? batch.materialType}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Created</div>
                <div className="font-medium">{formatDate(batch.createdAt)}</div>
                {batch.createdBy && (
                  <div className="text-xs text-muted-foreground">
                    {batch.createdBy.firstName} {batch.createdBy.lastName}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 border-t pt-4">
              <div>
                <div className="text-xs text-muted-foreground">Sent</div>
                <div className="text-lg font-semibold">{formatQty(batch.totalQuantitySent)}m</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Received</div>
                <div className="text-lg font-semibold text-success">{formatQty(batch.totalQuantityReceived)}m</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">In Process</div>
                <div className="text-lg font-semibold text-accent">{formatQty(batch.quantityInProcess)}m</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">In Transit</div>
                <div className="text-lg font-semibold text-primary">{formatQty(batch.quantityInTransit)}m</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Rejected</div>
                <div className="text-lg font-semibold text-destructive">{formatQty(batch.quantityRejected)}m</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total Cost</div>
                <div className="text-lg font-semibold">{formatCost(batch.totalCostIncurred)}</div>
              </div>
            </div>

            {/* Lace-specific processing info */}
            {batch.materialType === 'LACE' &&
              (batch.colorToApply ||
                batch.dyeLotNumber ||
                batch.shadeNote ||
                batch.expectedShrinkagePercent != null) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t pt-4 mt-4">
                  {batch.colorToApply && (
                    <div>
                      <div className="text-xs text-muted-foreground">Target Color</div>
                      <div className="font-medium">{batch.colorToApply}</div>
                    </div>
                  )}
                  {batch.dyeLotNumber && (
                    <div>
                      <div className="text-xs text-muted-foreground">Dye Lot</div>
                      <div className="font-medium">{batch.dyeLotNumber}</div>
                    </div>
                  )}
                  {batch.expectedShrinkagePercent != null && (
                    <div>
                      <div className="text-xs text-muted-foreground">Expected Shrinkage</div>
                      <div className="font-medium">{batch.expectedShrinkagePercent}%</div>
                    </div>
                  )}
                  {batch.shadeNote && (
                    <div>
                      <div className="text-xs text-muted-foreground">Shade Note</div>
                      <div className="font-medium">{batch.shadeNote}</div>
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* Stages */}
          <div className="bg-card rounded-lg shadow">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Processing Stages</h3>
            </div>
            <div className="p-6">
              {!batch.stages || batch.stages.length === 0 ? (
                <div className="text-center text-muted-foreground py-6">No stages yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted border-b">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">#</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                          Processor
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                          Type
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">
                          Sent
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">
                          Received
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">
                          Cost
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {batch.stages.map((stage) => (
                        <tr key={stage.id} className="hover:bg-muted">
                          <td className="px-3 py-3">{stage.stageNumber}</td>
                          <td className="px-3 py-3">{stage.processor?.name ?? '-'}</td>
                          <td className="px-3 py-3">{stage.processingType}</td>
                          <td className="px-3 py-3 text-right">{formatQty(stage.quantitySent)}m</td>
                          <td className="px-3 py-3 text-right">{formatQty(stage.quantityReceived)}m</td>
                          <td className="px-3 py-3 text-right">{formatCost(stage.processingCost)}</td>
                          <td className="px-3 py-3 text-center">
                            <Badge className="bg-muted text-foreground border-border border">{stage.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Movements */}
          <div className="bg-card rounded-lg shadow">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Movements</h3>
            </div>
            <div className="p-6">
              {!batch.movements || batch.movements.length === 0 ? (
                <div className="text-center text-muted-foreground py-6">No movements yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted border-b">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                          Type
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                          From → To
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">
                          Qty
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                          Dispatched
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {batch.movements.map((mv) => (
                        <tr key={mv.id} className="hover:bg-muted">
                          <td className="px-3 py-3">{mv.movementType}</td>
                          <td className="px-3 py-3">
                            {mv.fromLocation} → {mv.toLocation}
                          </td>
                          <td className="px-3 py-3 text-right">{formatQty(mv.quantity)}m</td>
                          <td className="px-3 py-3">{formatDate(mv.dispatchDate)}</td>
                          <td className="px-3 py-3 text-center">
                            <Badge className="bg-muted text-foreground border-border border">{mv.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Deliveries */}
          <div className="bg-card rounded-lg shadow">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Deliveries</h3>
            </div>
            <div className="p-6">
              {!batch.deliveries || batch.deliveries.length === 0 ? (
                <div className="text-center text-muted-foreground py-6">No deliveries yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted border-b">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                          Delivery #
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">
                          Delivered
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">
                          Accepted
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">
                          Rejected
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                          Date
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase">
                          QC
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {batch.deliveries.map((d) => (
                        <tr key={d.id} className="hover:bg-muted">
                          <td className="px-3 py-3 font-mono">{d.deliveryNumber}</td>
                          <td className="px-3 py-3 text-right">{formatQty(d.quantityDelivered)}m</td>
                          <td className="px-3 py-3 text-right text-success">{formatQty(d.quantityAccepted)}m</td>
                          <td className="px-3 py-3 text-right text-destructive">{formatQty(d.quantityRejected)}m</td>
                          <td className="px-3 py-3">{formatDate(d.deliveryDate)}</td>
                          <td className="px-3 py-3 text-center">
                            <Badge className="bg-muted text-foreground border-border border">{d.qualityStatus}</Badge>
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
      )}
    </div>
  );
}
