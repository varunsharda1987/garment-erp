import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Package, Loader2, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import workOrderService from '@/services/workOrder.service';
import type {
  FabricIssuanceData,
  FabricIssuanceFabric,
  FabricIssuanceAnalysis,
  IssuedChallan,
} from '@/types/production.types';
import { useNavigate } from 'react-router-dom';

interface FabricIssuanceSectionProps {
  workOrderId: string;
  workOrderNumber?: string;
}

export default function FabricIssuanceSection({ workOrderId, workOrderNumber }: FabricIssuanceSectionProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<FabricIssuanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isIssuing, setIsIssuing] = useState(false);
  const [selectedLots, setSelectedLots] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    try {
      setIsLoading(true);
      const result = await workOrderService.getFabricIssuanceData(workOrderId);
      setData(result);
    } catch (err) {
      console.error('Failed to load fabric issuance data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId]);

  // Collect all available lots across all fabrics
  const allLots = useMemo(() => {
    if (!data) return [];
    return data.fabrics.flatMap((fabric) =>
      fabric.lots.map((lot) => ({
        ...lot,
        fabricId: fabric.fabricId,
        fabricName: fabric.fabricName,
        fabricCode: fabric.fabricCode,
        part: fabric.part,
      }))
    );
  }, [data]);

  const selectedCount = Object.values(selectedLots).filter(Boolean).length;

  // Check which component parts are missing from selection
  const missingParts = useMemo(() => {
    if (selectedCount === 0) return [];
    const allParts = [...new Set(allLots.map((l) => l.part))];
    const selectedParts = new Set(allLots.filter((l) => selectedLots[l.lotId]).map((l) => l.part));
    return allParts.filter((p) => !selectedParts.has(p));
  }, [allLots, selectedLots, selectedCount]);

  const toggleLot = (lotId: string) => {
    setSelectedLots((prev) => ({ ...prev, [lotId]: !prev[lotId] }));
  };

  const handleIssueFabric = async () => {
    if (selectedCount === 0) {
      handleApiError(null, 'Please select at least one fabric lot to issue');
      return;
    }

    const lotsToIssue = allLots
      .filter((lot) => selectedLots[lot.lotId])
      .map((lot) => ({
        fabricStockId: lot.lotId,
        fabricId: lot.fabricId || '',
        quantity: lot.quantityAvailable,
        description: `${lot.fabricCode || ''} ${lot.fabricName} - Lot ${lot.lotNumber}`.trim(),
      }));

    try {
      setIsIssuing(true);
      await workOrderService.issueFabric(workOrderId, { lots: lotsToIssue });
      handleApiSuccess('Fabric Issued', 'Fabric has been issued to cutting department via challan.');
      setSelectedLots({});
      loadData(); // Refresh to show updated challans
    } catch (err) {
      handleApiError(err, 'Failed to issue fabric');
    } finally {
      setIsIssuing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-orange-600 mr-2" />
          <span className="text-gray-500">Loading fabric data...</span>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const hasIssuedChallans = data.issuedChallans.length > 0;
  const hasAvailableLots = allLots.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-lg">Fabric Issuance</CardTitle>
            </div>
            {hasAvailableLots && (
              <Button onClick={handleIssueFabric} disabled={isIssuing || selectedCount === 0} size="sm">
                {isIssuing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Issuing...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Issue to Cutting ({selectedCount})
                  </>
                )}
              </Button>
            )}
          </div>
          <p className="text-sm text-gray-500">
            Select fabric lots from stock to issue to the cutting department. Full lot quantity will be issued via
            internal challan.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Fabric Analysis Summary */}
          {data.fabricAnalysis.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Fabric Requirements</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part</TableHead>
                    <TableHead>Fabric</TableHead>
                    <TableHead className="text-right">CAD Avg (m/pc)</TableHead>
                    <TableHead className="text-right">Available (m)</TableHead>
                    <TableHead className="text-right">Required (m)</TableHead>
                    <TableHead className="text-right">Max Pcs</TableHead>
                    <TableHead className="text-right">Shortfall (m)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.fabricAnalysis.map((fa: FabricIssuanceAnalysis, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{fa.part}</TableCell>
                      <TableCell className="max-w-[160px] truncate" title={fa.fabricName}>
                        {fa.fabricName}
                      </TableCell>
                      <TableCell className="text-right">{fa.cadSet ? fa.cadAverage.toFixed(2) : '-'}</TableCell>
                      <TableCell className="text-right">{fa.availableStock.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{fa.cadSet ? fa.requiredForOrder.toFixed(1) : '-'}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {fa.maxPcsFromStock !== null ? fa.maxPcsFromStock.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell
                        className={`text-right ${fa.shortfallMeters > 0 ? 'text-red-600 font-medium' : 'text-green-600'}`}
                      >
                        {fa.shortfallMeters > 0 ? fa.shortfallMeters.toFixed(1) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.bottleneckFabric && (
                <p className="text-xs text-amber-600 mt-1">
                  Bottleneck: {data.bottleneckFabric} — Max cuttable: {data.maxCuttablePcs.toLocaleString()} pcs
                </p>
              )}
            </div>
          )}

          <Separator />

          {/* Available Lots */}
          {hasAvailableLots ? (
            <div>
              <h4 className="text-sm font-medium mb-2">Available Lots (select to issue)</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Fabric</TableHead>
                    <TableHead>Part</TableHead>
                    <TableHead>Lot #</TableHead>
                    <TableHead>Roll Numbers</TableHead>
                    <TableHead className="text-right">Width</TableHead>
                    <TableHead className="text-right">Available (m)</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allLots.map((lot) => (
                    <TableRow
                      key={lot.lotId}
                      className={selectedLots[lot.lotId] ? 'bg-orange-50' : 'cursor-pointer hover:bg-gray-50'}
                      onClick={() => toggleLot(lot.lotId)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={!!selectedLots[lot.lotId]} onCheckedChange={() => toggleLot(lot.lotId)} />
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate font-medium" title={lot.fabricName}>
                        {lot.fabricCode ? `${lot.fabricCode} - ` : ''}
                        {lot.fabricName}
                      </TableCell>
                      <TableCell>{lot.part}</TableCell>
                      <TableCell>Lot {lot.lotNumber}</TableCell>
                      <TableCell>{lot.rollNumbers || '-'}</TableCell>
                      <TableCell className="text-right">{lot.actualWidth}"</TableCell>
                      <TableCell className="text-right font-semibold">{lot.quantityAvailable.toFixed(1)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {lot.qualityGrade || 'A'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Warning when not all component parts have lots selected */}
              {missingParts.length > 0 && (
                <Alert className="bg-amber-50 border-amber-200 mt-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <strong>Missing fabrics for:</strong> {missingParts.join(', ')}. Cutting cannot produce complete
                    garments without all component fabrics.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : hasIssuedChallans ? (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                All fabric has been issued to the cutting department via challans below.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                No fabric stock available for this style. Ensure fabric is received via GRN first.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Issued Challans */}
      {hasIssuedChallans && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg">Issued Fabric Challans</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Challan #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fabrics</TableHead>
                  <TableHead className="text-right">Total Qty (m)</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.issuedChallans.map((challan: IssuedChallan) => {
                  const totalQty = challan.items.reduce((sum, item) => sum + Number(item.quantity), 0);
                  return (
                    <TableRow key={challan.id}>
                      <TableCell className="font-medium">{challan.challanNumber}</TableCell>
                      <TableCell>{new Date(challan.challanDate).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            challan.status === 'ISSUED'
                              ? 'bg-blue-100 text-blue-700'
                              : challan.status === 'RECEIVED'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                          }
                        >
                          {challan.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {challan.items.map((item) => item.description).join(', ')}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{totalQty.toFixed(1)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/manufacturing/challans/${challan.id}`)}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
