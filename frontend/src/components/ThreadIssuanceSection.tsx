import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Scissors, Loader2, ExternalLink } from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import workOrderService from '@/services/workOrder.service';
import type { ThreadIssuanceData, ThreadIssuanceItem, IssuedChallan } from '@/types/production.types';
import { THREAD_PLY_LABELS, THREAD_PACKAGING_LABELS } from '@/types/thread.types';
import { useNavigate } from 'react-router-dom';

interface ThreadIssuanceSectionProps {
  workOrderId: string;
}

export default function ThreadIssuanceSection({ workOrderId }: ThreadIssuanceSectionProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<ThreadIssuanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isIssuing, setIsIssuing] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const loadData = async () => {
    try {
      setIsLoading(true);
      const result = await workOrderService.getThreadIssuanceData(workOrderId);
      setData(result);
      // Pre-fill quantities with full available and pre-select all lots
      const initQty: Record<string, string> = {};
      const initSel: Record<string, boolean> = {};
      for (const item of result.items) {
        initQty[item.threadStockId] = item.quantityAvailable.toString();
        initSel[item.threadStockId] = true;
      }
      setQuantities(initQty);
      setSelected(initSel);
    } catch (err) {
      console.error('Failed to load thread issuance data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId]);

  const selectedItems = useMemo(() => {
    if (!data) return [];
    return data.items.filter((item) => selected[item.threadStockId]);
  }, [data, selected]);

  const handleIssue = async () => {
    if (selectedItems.length === 0) {
      handleApiError(null, 'Please select at least one thread lot to issue');
      return;
    }

    const items = selectedItems
      .map((item) => ({
        threadStockId: item.threadStockId,
        quantity: parseFloat(quantities[item.threadStockId] || '0'),
        unit: item.unit,
        description: `${item.threadCode} - ${item.threadName} (${item.colorName})`,
      }))
      .filter((i) => i.quantity > 0);

    if (items.length === 0) {
      handleApiError(null, 'All selected items have zero quantity');
      return;
    }

    try {
      setIsIssuing(true);
      await workOrderService.issueThread(workOrderId, { items });
      handleApiSuccess('Thread Issued', 'Thread has been issued to stitching department via challan.');
      loadData();
    } catch (err) {
      handleApiError(err, 'Failed to issue thread');
    } finally {
      setIsIssuing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-500">Loading thread stock data...</span>
        </CardContent>
      </Card>
    );
  }

  if (!data || (data.items.length === 0 && data.issuedChallans.length === 0)) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-lg">Thread Issuance — Stitching</CardTitle>
            </div>
            {data.items.length > 0 && (
              <Button onClick={handleIssue} disabled={isIssuing || selectedItems.length === 0} size="sm">
                {isIssuing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Issuing...
                  </>
                ) : (
                  <>Issue to Stitching ({selectedItems.length})</>
                )}
              </Button>
            )}
          </div>
          <p className="text-sm text-gray-500">Issue thread cones/spools from store to stitching department.</p>
        </CardHeader>

        {data.items.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Thread</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Ply</TableHead>
                  <TableHead>Packaging</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Meters</TableHead>
                  <TableHead className="text-right">Cost/Unit</TableHead>
                  <TableHead className="text-right w-28">To Issue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item: ThreadIssuanceItem) => {
                  const isSelected = !!selected[item.threadStockId];
                  return (
                    <TableRow
                      key={item.threadStockId}
                      className={isSelected ? 'bg-purple-50' : 'cursor-pointer hover:bg-gray-50'}
                      onClick={() =>
                        setSelected((prev) => ({ ...prev, [item.threadStockId]: !prev[item.threadStockId] }))
                      }
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() =>
                            setSelected((prev) => ({ ...prev, [item.threadStockId]: !prev[item.threadStockId] }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{item.threadCode}</div>
                        <div className="text-xs text-muted-foreground">{item.threadName}</div>
                      </TableCell>
                      <TableCell className="text-sm">{item.colorName || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.ply ? (THREAD_PLY_LABELS as any)[item.ply] || item.ply : '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.packagingType
                          ? (THREAD_PACKAGING_LABELS as any)[item.packagingType] || item.packagingType
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.quantityAvailable} {item.unit.toLowerCase()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {item.metersAvailable ? item.metersAvailable.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {item.purchaseCost > 0 ? `₹${item.purchaseCost.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          max={item.quantityAvailable}
                          className="w-24 h-7 text-right text-sm"
                          value={quantities[item.threadStockId] || ''}
                          onChange={(e) => setQuantities((prev) => ({ ...prev, [item.threadStockId]: e.target.value }))}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      {/* Already-issued challans */}
      {data.issuedChallans.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Issued Thread Challans ({data.issuedChallans.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.issuedChallans.map((challan: IssuedChallan) => (
                <div key={challan.id} className="flex items-center justify-between text-sm border rounded px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                      {challan.challanNumber}
                    </Badge>
                    <span className="text-gray-500">
                      {new Date(challan.challanDate).toLocaleDateString()} — {challan.items.length} item(s)
                    </span>
                    <Badge variant={challan.status === 'ISSUED' ? 'default' : 'outline'} className="text-xs">
                      {challan.status}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => navigate(`/manufacturing/challans/${challan.id}`)}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
