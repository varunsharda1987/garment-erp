import { useState, useEffect } from 'react';
import { Package, History, AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cadPlanningService } from '@/services/cad-planning.service';

interface CADOrderHistoryItem {
  source: string;
  orderId: string;
  orderNumber: string;
  orderDate: string;
  customerName: string;
  cadId: string | null;
  cutableWidth: number | null;
  cadMeters: number | null;
  stockLot: string | null;
  qualityGrade: string | null;
  planningCadWidth: number | null;
  widthVariance: number | null;
  variancePercent: number | null;
  quantityCut?: number;
  quantityAllocated?: number;
  quantityConsumed?: number;
  allocationStatus?: string;
}

interface CADSummaryItem {
  id: string;
  cutableWidth: number;
  cadMeters: number | null;
  approvalStatus: string | null;
  isLocked: boolean;
  fabricName: string;
  componentName: string | null;
  stockLot: string | null;
  stockAvailable: number | null;
  orderCount: number;
  createdAt: string;
}

interface Props {
  styleId: string;
}

export function CADOrderHistoryTable({ styleId }: Props) {
  const [history, setHistory] = useState<CADOrderHistoryItem[]>([]);
  const [cadSummary, setCadSummary] = useState<CADSummaryItem[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalCADs, setTotalCADs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [styleId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await cadPlanningService.getCADOrderHistory(styleId);
      if (response.success) {
        setHistory(response.data.history);
        setCadSummary(response.data.cadSummary);
        setTotalOrders(response.data.totalOrders);
        setTotalCADs(response.data.totalCADs);
      }
    } catch (err) {
      setError('Failed to load CAD order history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getVarianceDisplay = (variance: number | null, percent: number | null) => {
    if (variance === null) return null;
    const isPositive = variance > 0;
    const isZero = variance === 0;

    return (
      <div className={`flex items-center gap-1 ${isZero ? 'text-gray-500' : isPositive ? 'text-amber-600' : 'text-red-600'}`}>
        {!isZero && (isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
        <span>
          {isPositive ? '+' : ''}{variance.toFixed(1)}"
          {percent !== null && <span className="text-xs ml-1">({percent.toFixed(1)}%)</span>}
        </span>
      </div>
    );
  };

  const getApprovalStatusBadge = (status: string | null) => {
    if (!status) return null;
    switch (status) {
      case 'APPROVED':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'PENDING':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading order history...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-red-600">
          {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground">Orders Using CAD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{totalCADs}</div>
            <p className="text-xs text-muted-foreground">PRODUCTION CADs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {cadSummary.filter(c => c.approvalStatus === 'APPROVED').length}
            </div>
            <p className="text-xs text-muted-foreground">Approved CADs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {cadSummary.filter(c => c.stockAvailable && c.stockAvailable > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">With Stock Available</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history" className="w-full">
        <TabsList>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            Order History ({history.length})
          </TabsTrigger>
          <TabsTrigger value="cads">
            <Package className="h-4 w-4 mr-2" />
            PRODUCTION CADs ({cadSummary.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Which Orders Used Which Widths
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No order history yet. Orders will appear here once PRODUCTION CAD is linked to orders.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Width Used</TableHead>
                      <TableHead className="text-right">CAD Meters</TableHead>
                      <TableHead>Stock Lot</TableHead>
                      <TableHead>Variance</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item, idx) => (
                      <TableRow key={`${item.orderId}-${item.cadId}-${idx}`}>
                        <TableCell className="font-medium">{item.orderNumber}</TableCell>
                        <TableCell>{formatDate(item.orderDate)}</TableCell>
                        <TableCell>{item.customerName}</TableCell>
                        <TableCell className="text-right font-mono">
                          {item.cutableWidth ? `${item.cutableWidth}"` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.cadMeters ? item.cadMeters.toFixed(2) : '-'}
                        </TableCell>
                        <TableCell>
                          {item.stockLot ? (
                            <Badge variant="outline" className="text-xs">
                              {item.stockLot}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {getVarianceDisplay(item.widthVariance, item.variancePercent)}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantityCut || item.quantityAllocated || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cads">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                All PRODUCTION CAD Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cadSummary.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No PRODUCTION CAD entries yet. Create one by clicking "Create CAD" on a stock lot.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fabric</TableHead>
                      <TableHead>Component</TableHead>
                      <TableHead className="text-right">Width</TableHead>
                      <TableHead className="text-right">CAD Meters</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Stock Lot</TableHead>
                      <TableHead className="text-right">Stock Avail.</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cadSummary.map((cad) => (
                      <TableRow key={cad.id}>
                        <TableCell className="font-medium">{cad.fabricName}</TableCell>
                        <TableCell>{cad.componentName || '-'}</TableCell>
                        <TableCell className="text-right font-mono">{cad.cutableWidth}"</TableCell>
                        <TableCell className="text-right font-mono">
                          {cad.cadMeters ? cad.cadMeters.toFixed(2) : '-'}
                        </TableCell>
                        <TableCell>
                          {getApprovalStatusBadge(cad.approvalStatus)}
                          {cad.isLocked && (
                            <Badge variant="outline" className="ml-1 text-xs">
                              Locked
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {cad.stockLot ? (
                            <Badge variant="outline" className="text-xs">
                              {cad.stockLot}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {cad.stockAvailable !== null ? `${cad.stockAvailable} m` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {cad.orderCount > 0 ? (
                            <Badge variant="secondary">{cad.orderCount}</Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(cad.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CADOrderHistoryTable;
