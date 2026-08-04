/**
 * Lace Stock Aging Report Page
 * FIFO aging breakdown of available lace stock, grouped by aging bucket.
 * Route: /lace-stock/aging  (consumes GET /api/lace-stock/reports/aging)
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { laceStockService } from '../services/laceStock.service';
import type { LaceStockAgingItem } from '../types/laceStock.types';
import { AGING_BUCKET_COLORS } from '../types/laceStock.types';
import { notify } from '../lib/notify';
import { formatCurrency } from '@/lib/currency';
import { ArrowLeft, Clock, RefreshCw } from 'lucide-react';

const BUCKET_ORDER: LaceStockAgingItem['agingBucket'][] = ['0-30', '31-60', '61-90', '90+'];

export default function LaceStockAging() {
  const navigate = useNavigate();
  const [items, setItems] = useState<LaceStockAgingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAging = async () => {
    setLoading(true);
    try {
      const data = await laceStockService.getAgingReport();
      setItems(data);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      notify.error(error.response?.data?.error || 'Failed to load aging report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAging();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bucketTotals = BUCKET_ORDER.map((bucket) => {
    const bucketItems = items.filter((i) => i.agingBucket === bucket);
    return {
      bucket,
      count: bucketItems.length,
      quantity: bucketItems.reduce((sum, i) => sum + (i.quantityAvailable || 0), 0),
      value: bucketItems.reduce((sum, i) => sum + (i.totalValue || 0), 0),
    };
  });

  const sortedItems = [...items].sort((a, b) => b.agingDays - a.agingDays);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate('/lace-stock')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Lace Stock
          </Button>
          <h1 className="text-3xl font-display font-medium flex items-center gap-2">
            <Clock className="h-7 w-7" />
            Lace Stock Aging
          </h1>
          <p className="text-muted-foreground mt-1">FIFO aging breakdown of available lace stock</p>
        </div>
        <Button variant="outline" onClick={fetchAging} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Bucket summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {bucketTotals.map(({ bucket, count, quantity, value }) => (
          <Card key={bucket}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Badge className={AGING_BUCKET_COLORS[bucket]}>{bucket} days</Badge>
                <span className="text-sm text-muted-foreground">
                  {count} lot{count !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="text-2xl font-bold">{quantity.toLocaleString()}m</div>
              <div className="text-sm text-muted-foreground">{formatCurrency(value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading aging report...</div>
          ) : sortedItems.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No available lace stock to age</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Lace</th>
                    <th className="px-4 py-3 text-left font-medium">Lot</th>
                    <th className="px-4 py-3 text-left font-medium">Origin Style</th>
                    <th className="px-4 py-3 text-right font-medium">Available</th>
                    <th className="px-4 py-3 text-right font-medium">Avg Cost</th>
                    <th className="px-4 py-3 text-right font-medium">Total Value</th>
                    <th className="px-4 py-3 text-left font-medium">Received</th>
                    <th className="px-4 py-3 text-right font-medium">Age (days)</th>
                    <th className="px-4 py-3 text-center font-medium">Bucket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <button
                          className="text-info hover:underline font-medium"
                          onClick={() => navigate(`/lace-stock/${item.id}`)}
                        >
                          {item.laceCode}
                        </button>
                        <div className="text-xs text-muted-foreground">{item.laceName}</div>
                      </td>
                      <td className="px-4 py-3">{item.lotNumber || '-'}</td>
                      <td className="px-4 py-3">
                        {item.originStyleCode || '-'}
                        {item.originBuyerStyleRef && (
                          <span className="ml-1 text-xs text-muted-foreground">({item.originBuyerStyleRef})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{item.quantityAvailable.toLocaleString()}m</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.weightedAvgCost)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.totalValue)}</td>
                      <td className="px-4 py-3">{new Date(item.receivedDate).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-3 text-right font-medium">{item.agingDays}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={AGING_BUCKET_COLORS[item.agingBucket]}>{item.agingBucket}</Badge>
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
