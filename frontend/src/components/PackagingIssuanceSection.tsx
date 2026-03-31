import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Loader2, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import workOrderService from '@/services/workOrder.service';
import type { MaterialIssuanceData, MaterialIssuanceItem, IssuedChallan } from '@/types/production.types';
import { useNavigate } from 'react-router-dom';

interface PackagingIssuanceSectionProps {
  workOrderId: string;
}

export default function PackagingIssuanceSection({ workOrderId }: PackagingIssuanceSectionProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<MaterialIssuanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isIssuing, setIsIssuing] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const loadData = async () => {
    try {
      setIsLoading(true);
      const result = await workOrderService.getPackagingIssuanceData(workOrderId);
      setData(result);
      const initQty: Record<string, string> = {};
      const initSel: Record<string, boolean> = {};
      for (const item of result.items) {
        if (item.materialId) {
          const remaining = Math.max(0, item.requiredQty - item.alreadyIssued);
          initQty[item.materialId] = remaining > 0 ? remaining.toFixed(0) : '0';
          initSel[item.materialId] = remaining > 0 && item.availableStock > 0;
        }
      }
      setQuantities(initQty);
      setSelected(initSel);
    } catch (err) {
      console.error('Failed to load packaging issuance data:', err);
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
    return data.items.filter((item) => item.materialId && selected[item.materialId]);
  }, [data, selected]);

  const handleIssue = async () => {
    if (selectedItems.length === 0) {
      handleApiError(null, 'Please select at least one packaging item to issue');
      return;
    }

    const items = selectedItems
      .map((item) => ({
        materialId: item.materialId!,
        quantity: parseFloat(quantities[item.materialId!] || '0'),
        unit: item.unit,
        description: `${item.materialCode} - ${item.materialName}`,
      }))
      .filter((i) => i.quantity > 0);

    if (items.length === 0) {
      handleApiError(null, 'All selected items have zero quantity');
      return;
    }

    try {
      setIsIssuing(true);
      await workOrderService.issuePackaging(workOrderId, { items });
      handleApiSuccess('Packaging Issued', 'Packaging materials issued to finishing department via challan.');
      loadData();
    } catch (err) {
      handleApiError(err, 'Failed to issue packaging');
    } finally {
      setIsIssuing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-purple-600 mr-2" />
          <span className="text-gray-500">Loading packaging data...</span>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.items.length === 0) return null;

  const hasIssuedChallans = data.issuedChallans.length > 0;
  const itemsWithStock = data.items.filter((i) => i.availableStock > 0);
  const hasShortage = data.items.some((i) => i.shortage > 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-lg">Packaging Issuance — Finishing</CardTitle>
            </div>
            {itemsWithStock.length > 0 && (
              <Button onClick={handleIssue} disabled={isIssuing || selectedItems.length === 0} size="sm">
                {isIssuing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Issuing...
                  </>
                ) : (
                  <>Issue to Finishing ({selectedItems.length})</>
                )}
              </Button>
            )}
          </div>
          <p className="text-sm text-gray-500">
            Issue polybags, tags, cartons, and packaging materials to finishing department.
          </p>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qty/pc</TableHead>
                <TableHead className="text-right">Required</TableHead>
                <TableHead className="text-right">Issued</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right w-28">To Issue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item: MaterialIssuanceItem) => {
                const remaining = Math.max(0, item.requiredQty - item.alreadyIssued);
                const isSelected = item.materialId ? !!selected[item.materialId] : false;
                const hasStock = item.availableStock > 0;
                return (
                  <TableRow
                    key={item.bomItemId}
                    className={
                      isSelected ? 'bg-purple-50' : hasStock ? 'cursor-pointer hover:bg-gray-50' : 'opacity-50'
                    }
                    onClick={() => {
                      if (item.materialId && hasStock && remaining > 0) {
                        setSelected((prev) => ({ ...prev, [item.materialId!]: !prev[item.materialId!] }));
                      }
                    }}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        disabled={!hasStock || remaining <= 0}
                        onCheckedChange={() => {
                          if (item.materialId)
                            setSelected((prev) => ({ ...prev, [item.materialId!]: !prev[item.materialId!] }));
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate" title={item.materialName}>
                      {item.materialCode ? `${item.materialCode} - ` : ''}
                      {item.materialName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.materialType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{item.qtyPerPiece}</TableCell>
                    <TableCell className="text-right">{item.requiredQty.toFixed(0)}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {item.alreadyIssued > 0 ? item.alreadyIssued.toFixed(0) : '-'}
                    </TableCell>
                    <TableCell className={`text-right ${item.shortage > 0 ? 'text-red-600 font-medium' : ''}`}>
                      {item.availableStock.toFixed(0)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {item.materialId && hasStock && remaining > 0 ? (
                        <Input
                          type="number"
                          step="1"
                          className="w-24 h-7 text-right text-sm"
                          value={quantities[item.materialId] || ''}
                          onChange={(e) => setQuantities((prev) => ({ ...prev, [item.materialId!]: e.target.value }))}
                        />
                      ) : (
                        <span className="text-gray-400">{remaining <= 0 ? 'Done' : 'No stock'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {hasShortage && (
            <Alert className="bg-amber-50 border-amber-200 mt-3">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Some packaging materials have insufficient stock. Ensure materials are procured before finishing.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {hasIssuedChallans && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg">Issued Packaging Challans</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Challan #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.issuedChallans.map((challan: IssuedChallan) => (
                  <TableRow key={challan.id}>
                    <TableCell className="font-medium">{challan.challanNumber}</TableCell>
                    <TableCell>{new Date(challan.challanDate).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          challan.status === 'ISSUED' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }
                      >
                        {challan.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {challan.items.map((i) => i.description).join(', ')}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/procurement/challans/${challan.id}`)}>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
