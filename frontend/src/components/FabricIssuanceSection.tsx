import { useState, useEffect, useMemo } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Loader2, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import workOrderService from '@/services/workOrder.service';
import { fabricStockService } from '@/services/fabricStockService';
import type { FabricIssuanceData, FabricIssuanceAnalysis, IssuedChallan } from '@/types/production.types';
import type { LotPieces } from '@/services/jobWorkOrder.service';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '@/lib/date';
import { formatQuantity } from '@/lib/formatters';
import { qtyExceeds } from '@/lib/quantity';
import { usePermissions } from '@/hooks/usePermissions';
import { ThanPicker } from '@/components/job-work/ThanPicker';
import { RecordLotPiecesDialog } from '@/components/job-work/RecordLotPiecesDialog';
import {
  allPiecesPicked,
  fabricPicksPayload,
  pieceWord,
  piecesSummary,
  thanPickActual,
  thanPickErrors,
  type SelectedDetail,
} from '@/components/job-work/lot-rows';

interface FabricIssuanceSectionProps {
  workOrderId: string;
  workOrderNumber?: string;
}

/** The map without one key */
function without<T>(map: Record<string, T>, key: string): Record<string, T> {
  const next = { ...map };
  delete next[key];
  return next;
}

export default function FabricIssuanceSection({ workOrderId }: FabricIssuanceSectionProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [data, setData] = useState<FabricIssuanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isIssuing, setIsIssuing] = useState(false);
  const [selectedLots, setSelectedLots] = useState<Record<string, boolean>>({});
  // The rolls / thans ticked on each chosen lot (every one, to start with — owner 2026-09-28)
  const [picks, setPicks] = useState<Record<string, SelectedDetail[]>>({});
  // A listed lot sent whole by quantity instead (its list is out of step, or the store chooses to)
  const [byQuantity, setByQuantity] = useState<Record<string, boolean>>({});
  // "Record / Check rolls & thans" on a lot
  const [recordLotId, setRecordLotId] = useState<string | null>(null);
  // Fabric goes out FOR a cutting batch; deleting that batch sends it back to the store
  const [batchId, setBatchId] = useState('');

  const loadData = async () => {
    try {
      setIsLoading(true);
      const result = await workOrderService.getFabricIssuanceData(workOrderId);
      setData(result);
      const open = result.openBatches ?? [];
      setBatchId((prev) => (open.some((b) => b.id === prev) ? prev : open.length === 1 ? open[0].id : ''));
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
        label: lot.lotLabel ?? `${fabric.fabricCode || fabric.fabricName} · Lot ${lot.lotNumber}`,
      }))
    );
  }, [data]);

  // The rolls / thans of every chosen lot that lists some, one query per lot. The key is shared with the
  // Fabric Stock page's Record / Check dialog, so a count refreshes every open screen.
  const listedIds = allLots.filter((l) => selectedLots[l.lotId] && (l.pieces?.left ?? 0) > 0).map((l) => l.lotId);
  const pieceQueries = useQueries({
    queries: listedIds.map((lotId) => ({
      queryKey: ['fabric-lot-pieces', lotId],
      queryFn: () => fabricStockService.getPieces(lotId),
      staleTime: 0,
      retry: false,
    })),
  });
  const piecesByLot: Record<string, LotPieces> = {};
  listedIds.forEach((lotId, i) => {
    const q = pieceQueries[i];
    if (q?.data) piecesByLot[lotId] = q.data;
  });
  const loadingPieces = listedIds.some((_, i) => pieceQueries[i]?.isLoading);

  /**
   * The pieces ticked on a chosen lot: every piece until the store changes a tick (owner 2026-09-28), and never
   * a piece that has gone since the list was loaded.
   */
  const picksOf = (lotId: string): SelectedDetail[] => {
    const loaded = piecesByLot[lotId];
    if (!loaded) return [];
    const chosen = picks[lotId];
    if (!chosen) return allPiecesPicked(loaded);
    const live = new Set(loaded.details.map((d) => d.id));
    return chosen.filter((p) => live.has(p.detailId));
  };

  const selectedCount = Object.values(selectedLots).filter(Boolean).length;

  // Check which component parts are missing from selection — of the fabrics the chosen batch cuts
  const missingParts = useMemo(() => {
    if (selectedCount === 0) return [];
    const cuts = data?.openBatches?.find((b) => b.id === batchId)?.fabricIds;
    const lotsHere = cuts ? allLots.filter((l) => !l.fabricId || cuts.includes(l.fabricId)) : allLots;
    const allParts = [...new Set(lotsHere.map((l) => l.part))];
    const selectedParts = new Set(allLots.filter((l) => selectedLots[l.lotId]).map((l) => l.part));
    return allParts.filter((p) => !selectedParts.has(p));
  }, [allLots, selectedLots, selectedCount, data, batchId]);

  const toggleLot = (lotId: string) => {
    const on = !selectedLots[lotId];
    setSelectedLots((prev) => ({ ...prev, [lotId]: on }));
    // Unticked: its picks go, so ticking it again starts from every piece
    if (!on) {
      setPicks((prev) => without(prev, lotId));
      setByQuantity((prev) => without(prev, lotId));
    }
  };

  const openBatches = data?.openBatches ?? [];
  const plannedFor = (lotId: string) => openBatches.find((b) => b.id === batchId)?.plannedByLot?.[lotId] ?? 0;
  // A lot of a fabric the chosen batch does not cut cannot be issued for it (the server refuses it)
  const chosenBatch = openBatches.find((b) => b.id === batchId);
  const notCutHere = (lot: { fabricId?: string | null }) =>
    !!chosenBatch?.fabricIds && !!lot.fabricId && !chosenBatch.fabricIds.includes(lot.fabricId);

  /** How a chosen lot goes: its picked rolls / thans, or whole by quantity */
  const lotPlan = (lot: (typeof allLots)[number]) => {
    const lotPieces = piecesByLot[lot.lotId];
    const byPieces = !!lotPieces && lotPieces.details.length > 0 && !byQuantity[lot.lotId];
    const lotPicks = picksOf(lot.lotId);
    return {
      lotPieces,
      byPieces,
      lotPicks,
      quantity: byPieces ? thanPickActual(lotPicks, lotPieces) : lot.quantityAvailable,
    };
  };

  // Anything that would stop the issue, in words
  const blockers = allLots
    .filter((lot) => selectedLots[lot.lotId])
    .flatMap((lot) => {
      if (notCutHere(lot)) {
        return [
          `${chosenBatch?.batchNumber} does not cut ${lot.fabricCode || lot.fabricName} — untick ${lot.label}, or issue it for a batch that cuts it.`,
        ];
      }
      const plan = lotPlan(lot);
      if (!plan.byPieces) return [];
      if (plan.lotPicks.length === 0) return [`Tick at least one roll or than of ${lot.label}, or untick the lot.`];
      if (thanPickErrors(plan.lotPicks, plan.lotPieces)) {
        return [`A ticked piece of ${lot.label} is blank or asks for more metres than it has left.`];
      }
      if (qtyExceeds(plan.quantity, lot.quantityAvailable)) {
        return [
          `The ticked pieces of ${lot.label} come to ${formatQuantity(plan.quantity, 'METER')} — more than the ` +
            `${formatQuantity(lot.quantityAvailable, 'METER')} the lot holds. Untick some, or send the lot whole by quantity.`,
        ];
      }
      return [];
    });

  const handleIssueFabric = async () => {
    if (selectedCount === 0) {
      handleApiError(null, 'Please select at least one fabric lot to issue');
      return;
    }

    const chosen = allLots.filter((lot) => selectedLots[lot.lotId]);
    const lotsToIssue = chosen.map((lot) => {
      const plan = lotPlan(lot);
      return {
        fabricStockId: lot.lotId,
        fabricId: lot.fabricId || '',
        // ACTUAL metres; with rolls / thans picked the server takes the quantity from them itself
        quantity: plan.quantity,
        description: `${lot.label} — ${lot.fabricName}`.trim(),
        ...(plan.byPieces ? { details: fabricPicksPayload(plan.lotPicks) } : {}),
      };
    });

    try {
      setIsIssuing(true);
      await workOrderService.issueFabric(workOrderId, { lots: lotsToIssue, cuttingBatchId: batchId || undefined });
      handleApiSuccess('Fabric Issued', 'Fabric has been issued to cutting department via challan.');
      for (const lot of chosen) queryClient.invalidateQueries({ queryKey: ['fabric-lot-pieces', lot.lotId] });
      setSelectedLots({});
      setPicks({});
      setByQuantity({});
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
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
          <span className="text-muted-foreground">Loading fabric data...</span>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const hasIssuedChallans = data.issuedChallans.length > 0;
  const hasAvailableLots = allLots.length > 0;
  const needsBatch = openBatches.length === 0 || !batchId;
  const canRecord = can('greigeFabricStock');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Fabric Issuance</CardTitle>
            </div>
            {hasAvailableLots && (
              <div className="flex items-center gap-2">
                {openBatches.length > 1 && (
                  <Select value={batchId} onValueChange={setBatchId}>
                    <SelectTrigger className="h-8 w-[200px]" aria-label="Cutting batch">
                      <SelectValue placeholder="For cutting batch…" />
                    </SelectTrigger>
                    <SelectContent>
                      {openBatches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.batchNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  onClick={handleIssueFabric}
                  disabled={isIssuing || selectedCount === 0 || needsBatch || blockers.length > 0 || loadingPieces}
                  size="sm"
                >
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
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Select fabric lots from stock to issue to the cutting department, for a cutting batch — deleting that batch
            returns the fabric to the store. Tick the rolls going to cutting — every roll is ticked. A lot with no roll
            or than list goes whole.
          </p>
          {hasAvailableLots && openBatches.length === 0 && (
            <p className="text-sm text-warning">
              Create the cutting batch first — fabric is issued for a cutting batch.
            </p>
          )}
          {openBatches.length === 1 && (
            <p className="text-xs text-muted-foreground">For cutting batch {openBatches[0].batchNumber}</p>
          )}
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
                    <TableHead className="text-right">Issued (m)</TableHead>
                    <TableHead className="text-right">Returned (m)</TableHead>
                    <TableHead className="text-right">At Cutting (m)</TableHead>
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
                      <TableCell className="text-right">
                        {!fa.cadSet
                          ? '-'
                          : (fa.lotAverages?.length ?? 0) > 1
                            ? fa.lotAverages!.map((a) => a.toFixed(3)).join(' / ')
                            : fa.cadAverage.toFixed(3)}
                        {(fa.lotsWithoutCad ?? 0) > 0 && (
                          <span className="block text-xs text-warning">
                            {fa.lotsWithoutCad} lot{fa.lotsWithoutCad === 1 ? '' : 's'} without a Production CAD
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{fa.availableStock.toFixed(1)}</TableCell>
                      <TableCell className="text-right text-success font-medium">
                        {(fa.issuedStock ?? 0) > 0 ? fa.issuedStock.toFixed(1) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {(fa.returnedStock ?? 0) > 0 ? (fa.returnedStock ?? 0).toFixed(1) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {(fa.atCuttingStock ?? 0) > 0 ? (fa.atCuttingStock ?? 0).toFixed(1) : '-'}
                      </TableCell>
                      <TableCell className="text-right">{fa.cadSet ? fa.requiredForOrder.toFixed(1) : '-'}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {fa.maxPcsFromStock !== null ? fa.maxPcsFromStock.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell
                        className={`text-right ${qtyExceeds(fa.shortfallMeters, 0) ? 'text-destructive font-medium' : 'text-success'}`}
                      >
                        {qtyExceeds(fa.shortfallMeters, 0) ? fa.shortfallMeters.toFixed(1) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.bottleneckFabric && (
                <p className="text-xs text-warning mt-1">
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
                    <TableHead>Lot</TableHead>
                    <TableHead>Rolls / thans</TableHead>
                    <TableHead className="text-right">Width</TableHead>
                    <TableHead className="text-right">CAD Avg (m/pc)</TableHead>
                    <TableHead className="text-right">Available (m)</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allLots.map((lot) => (
                    <TableRow
                      key={lot.lotId}
                      className={
                        selectedLots[lot.lotId]
                          ? 'bg-primary/10'
                          : notCutHere(lot)
                            ? 'opacity-60'
                            : 'cursor-pointer hover:bg-muted'
                      }
                      onClick={() => (selectedLots[lot.lotId] || !notCutHere(lot)) && toggleLot(lot.lotId)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={!!selectedLots[lot.lotId]}
                          disabled={!selectedLots[lot.lotId] && notCutHere(lot)}
                          onCheckedChange={() => toggleLot(lot.lotId)}
                        />
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate font-medium" title={lot.fabricName}>
                        {lot.fabricCode ? `${lot.fabricCode} - ` : ''}
                        {lot.fabricName}
                      </TableCell>
                      <TableCell>{lot.part}</TableCell>
                      <TableCell className="text-xs">
                        {lot.label}
                        {notCutHere(lot) && (
                          <span className="block text-muted-foreground">Not cut in {chosenBatch?.batchNumber}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className={lot.listState === 'OUT_OF_STEP' ? 'text-warning' : ''}>
                          {piecesSummary(lot.pieces ? { ...lot.pieces, bales: 0 } : undefined)}
                        </span>
                        {lot.rollNumbers ? (
                          <span className="ml-1 text-muted-foreground">({lot.rollNumbers})</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">{lot.actualWidth}"</TableCell>
                      <TableCell className="text-right">
                        {lot.productionAverage != null ? (
                          lot.productionAverage.toFixed(3)
                        ) : (
                          <span className="text-xs text-warning">No Production CAD</span>
                        )}
                      </TableCell>
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

              {/* The rolls / thans of each chosen lot */}
              {allLots
                .filter((lot) => selectedLots[lot.lotId])
                .map((lot) => {
                  const plan = lotPlan(lot);
                  const listed = (lot.pieces?.left ?? 0) > 0;
                  const outOfStep = lot.listState === 'OUT_OF_STEP';
                  const pieces = pieceWord(lot.pieces?.kind ?? null, 2);
                  return (
                    <div key={lot.lotId} className="mt-3 rounded-md border bg-muted/30 p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-medium">{lot.label}</span>
                        <span className="text-muted-foreground">
                          Issuing {formatQuantity(plan.quantity, 'METER')} of{' '}
                          {formatQuantity(lot.quantityAvailable, 'METER')}
                        </span>
                      </div>

                      {!listed && (
                        <p className="text-xs text-muted-foreground">
                          {lot.label} has no roll or than list — the whole lot goes.
                          {canRecord && (
                            <>
                              {' '}
                              <button
                                type="button"
                                className="underline underline-offset-2 hover:text-foreground"
                                onClick={() => setRecordLotId(lot.lotId)}
                              >
                                Record rolls &amp; thans
                              </button>
                            </>
                          )}
                        </p>
                      )}

                      {listed && outOfStep && (
                        <p className="text-xs text-warning">
                          The list is out of step — {formatQuantity(lot.listActual ?? 0, 'METER')} listed,{' '}
                          {formatQuantity(lot.quantityAvailable, 'METER')} on hand. Issuing the whole lot by quantity is
                          still allowed.
                          {canRecord && (
                            <>
                              {' '}
                              <button
                                type="button"
                                className="underline underline-offset-2 hover:text-foreground"
                                onClick={() => setRecordLotId(lot.lotId)}
                              >
                                Check rolls &amp; thans
                              </button>
                            </>
                          )}
                        </p>
                      )}

                      {listed && !plan.lotPieces && (
                        <p className="text-xs text-muted-foreground">Loading the {pieces}…</p>
                      )}

                      {listed && plan.lotPieces && byQuantity[lot.lotId] && (
                        <p className="text-xs text-muted-foreground">
                          Going whole, by quantity — {pieces} not picked.{' '}
                          <button
                            type="button"
                            className="underline underline-offset-2 hover:text-foreground"
                            onClick={() => setByQuantity((prev) => without(prev, lot.lotId))}
                          >
                            Pick the {pieces}
                          </button>
                        </p>
                      )}

                      {plan.byPieces && plan.lotPieces && (
                        <>
                          <ThanPicker
                            lotThans={plan.lotPieces}
                            selected={plan.lotPicks}
                            onChange={(selected) => setPicks((prev) => ({ ...prev, [lot.lotId]: selected }))}
                            targetActual={plannedFor(lot.lotId)}
                            uom="METER"
                            disabled={isIssuing}
                            purpose="CUTTING"
                          />
                          <button
                            type="button"
                            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                            onClick={() => setByQuantity((prev) => ({ ...prev, [lot.lotId]: true }))}
                          >
                            Send the whole lot by quantity instead
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}

              {blockers.length > 0 && (
                <div className="mt-2 space-y-1">
                  {blockers.map((b) => (
                    <p key={b} className="text-xs text-destructive">
                      {b}
                    </p>
                  ))}
                </div>
              )}

              {/* Warning when not all component parts have lots selected */}
              {missingParts.length > 0 && (
                <Alert className="bg-warning-muted border-warning/20 mt-3">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <AlertDescription className="text-warning">
                    <strong>Missing fabrics for:</strong> {missingParts.join(', ')}. Cutting cannot produce complete
                    garments without all component fabrics.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : hasIssuedChallans ? (
            <Alert className="bg-success-muted border-success/20">
              <CheckCircle className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                All fabric has been issued to the cutting department via challans below.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-warning-muted border-warning/20">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-warning">
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
              <CheckCircle className="h-5 w-5 text-success" />
              <CardTitle className="text-lg">Fabric Challans (issued &amp; returned)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Challan #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Batch</TableHead>
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
                      <TableCell>
                        {challan.direction === 'RETURN' ? 'Returned to store' : 'Issued to Cutting'}
                      </TableCell>
                      <TableCell>{challan.batchNumber ?? '—'}</TableCell>
                      <TableCell>{formatDate(new Date(challan.challanDate))}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            challan.status === 'ISSUED'
                              ? 'bg-info-muted text-info'
                              : challan.status === 'RECEIVED'
                                ? 'bg-success-muted text-success'
                                : 'bg-muted text-foreground'
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

      {recordLotId && (
        <RecordLotPiecesDialog
          open={!!recordLotId}
          onOpenChange={(open) => !open && setRecordLotId(null)}
          stockId={recordLotId}
          stock="FABRIC"
          onRecorded={() => {
            setPicks((prev) => without(prev, recordLotId));
            loadData();
          }}
        />
      )}
    </div>
  );
}
