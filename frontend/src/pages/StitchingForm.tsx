// Stitching Issue Form - Create new stitching issue from transfer slip(s)
import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Shirt, Package, FileText, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SupplierCombobox } from '@/components/SupplierCombobox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { stitchingIssueService, stitchingSummaryService } from '@/services/stitching.service';
import { handleApiSuccess } from '@/lib/api-error-handler';
import type {
  CreateStitchingIssueRequest,
  IncomingTransferSlip,
  StitchingLabelAvailability,
  StitchingLabelCover,
  StitchingRateGuide,
} from '@/types/stitching.types';
import { StitchingRateCard } from '@/components/production/StitchingRateCard';
import { formatDate, toDateInputValue } from '@/lib/date';
import { styleCodeLabel } from '@/lib/style-code';

interface SKUEntry {
  colorId: string | null;
  colorName: string;
  sizeId: string;
  sizeName: string;
  sortOrder: number;
  /** Left on the selected slips (what cutting sent, less what earlier issues took) */
  availableQty: number;
  /** What cutting sent on the selected slips */
  sentQty: number;
  issuedQty: number;
}

// Merge what is left on several transfer slips, in size order. A slip's `quantity` is what is LEFT
// on it: pieces an earlier issue did not take stay on the slip for a later issue.
function mergeSkuBreakdowns(slips: IncomingTransferSlip[]): SKUEntry[] {
  const map = new Map<string, SKUEntry>();
  for (const slip of slips) {
    for (const sku of slip.skuBreakdown) {
      const key = `${sku.colorId || 'null'}-${sku.sizeId}`;
      const existing = map.get(key);
      if (existing) {
        existing.availableQty += sku.quantity;
        existing.sentQty += sku.sentQty;
        existing.issuedQty += sku.quantity;
      } else {
        map.set(key, {
          colorId: sku.colorId,
          colorName: sku.colorName,
          sizeId: sku.sizeId,
          sizeName: sku.sizeName,
          sortOrder: sku.sortOrder,
          availableQty: sku.quantity,
          sentQty: sku.sentQty,
          issuedQty: sku.quantity,
        });
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => a.sortOrder - b.sortOrder || (a.colorName || '').localeCompare(b.colorName || '')
  );
}

/** The label cover of one size (matched by name, as the server does), or undefined when nothing is enforced */
function coverOf(cover: StitchingLabelAvailability | null, sizeName: string): StitchingLabelCover | undefined {
  if (!cover?.sizes) return undefined;
  const want = sizeName.trim().toLowerCase();
  return (
    cover.sizes.find((c) => c.sizeName.trim().toLowerCase() === want) ?? {
      sizeName,
      piecesCovered: 0,
      piecesIssued: 0,
      canIssue: 0,
      labels: [],
    }
  );
}

/** Lower each size's issue quantities to what its labels cover (a size label is sewn at stitching) */
function capByLabels(rows: SKUEntry[], cover: StitchingLabelAvailability | null): SKUEntry[] {
  if (!cover?.sizes) return rows;
  const left = new Map<string, number>();
  return rows.map((row) => {
    const key = row.sizeName.trim().toLowerCase();
    const room = left.get(key) ?? coverOf(cover, row.sizeName)?.canIssue ?? 0;
    const issuedQty = Math.min(row.issuedQty, room);
    left.set(key, room - issuedQty);
    return { ...row, issuedQty };
  });
}

/** How many more pieces of a size its labels cover, or which label is missing */
function LabelCoverCell({ cover }: { cover: StitchingLabelCover | undefined }) {
  if (!cover) return null;
  if (cover.canIssue > 0) return <span className="text-sm">{cover.canIssue} pcs</span>;
  const missing = cover.labels.filter((l) => !l.inThisSize).map((l) => l.materialCode);
  return (
    <span className="text-sm font-medium text-destructive">
      {missing.length > 0 ? `No ${missing.join(', ')} in this size` : 'No labels in store'}
    </span>
  );
}

export default function StitchingForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const transferSlipIdParam = searchParams.get('transferSlipId');
  const workOrderIdParam = searchParams.get('workOrderId');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [selectedSlipIds, setSelectedSlipIds] = useState<string[]>([]);
  const [workOrderId, setWorkOrderId] = useState<string>('');
  const [issueDate, setIssueDate] = useState(toDateInputValue(new Date()));
  const [contractorId, setContractorId] = useState<string>('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState<string>('');
  const [remarks, setRemarks] = useState('');
  const [skuBreakdown, setSkuBreakdown] = useState<SKUEntry[]>([]);
  // Per size, how many more pieces the run's size labels cover — a size without labels cannot be issued
  const [labelCover, setLabelCover] = useState<StitchingLabelAvailability | null>(null);
  // The rate given to the operators (typed), beside the last rate given and the costing rate
  const [operatorRate, setOperatorRate] = useState('');
  const [rateGuide, setRateGuide] = useState<StitchingRateGuide | null>(null);
  const [rateGuideLoading, setRateGuideLoading] = useState(false);

  // Reference data
  const [pendingTransferSlips, setPendingTransferSlips] = useState<IncomingTransferSlip[]>([]);

  // When arriving from a work-order drill-down link, restrict the selectable slips to that WO
  const visibleTransferSlips = useMemo(
    () =>
      workOrderIdParam ? pendingTransferSlips.filter((s) => s.workOrderId === workOrderIdParam) : pendingTransferSlips,
    [pendingTransferSlips, workOrderIdParam]
  );

  // Group slips by work order for display
  const slipsByWorkOrder = useMemo(() => {
    const groups = new Map<string, { workOrderNumber: string; slips: IncomingTransferSlip[] }>();
    for (const slip of visibleTransferSlips) {
      const key = slip.workOrderId;
      if (!groups.has(key)) {
        groups.set(key, { workOrderNumber: slip.workOrderNumber, slips: [] });
      }
      groups.get(key)!.slips.push(slip);
    }
    return groups;
  }, [visibleTransferSlips]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!workOrderId) {
      setLabelCover(null);
      return;
    }
    let cancelled = false;
    stitchingSummaryService
      .getLabelAvailability(workOrderId)
      .then((cover) => {
        if (cancelled) return;
        setLabelCover(cover);
        setSkuBreakdown((prev) => capByLabels(prev, cover));
      })
      .catch(() => {
        // The server enforces the same rule on save; without the preview the save explains a refusal
        if (!cancelled) setLabelCover(null);
      });
    return () => {
      cancelled = true;
    };
  }, [workOrderId]);

  useEffect(() => {
    if (!workOrderId) {
      setRateGuide(null);
      return;
    }
    let cancelled = false;
    setRateGuideLoading(true);
    stitchingSummaryService
      .getRateGuide(workOrderId)
      .then((guide) => {
        if (!cancelled) setRateGuide(guide);
      })
      .catch(() => {
        // Only the reference rates are missing; the rate given is still typed and saved
        if (!cancelled) setRateGuide(null);
      })
      .finally(() => {
        if (!cancelled) setRateGuideLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workOrderId]);

  const rateValue = Number(operatorRate);
  const rateEntered = operatorRate.trim() !== '' && Number.isFinite(rateValue) && rateValue > 0;

  useEffect(() => {
    if (transferSlipIdParam && pendingTransferSlips.length > 0) {
      handleSlipToggle(transferSlipIdParam, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferSlipIdParam, pendingTransferSlips]);

  // The link's slip has been fully issued since (or was never a pending cutting slip)
  const staleSlipLink =
    !loading && !!transferSlipIdParam && !pendingTransferSlips.some((s) => s.id === transferSlipIdParam);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      setPendingTransferSlips(await stitchingSummaryService.getPendingTransferSlips());
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSlipToggle = (slipId: string, checked: boolean) => {
    const slip = pendingTransferSlips.find((s) => s.id === slipId);
    if (!slip) return;

    let newIds: string[];
    if (checked) {
      // If selecting a slip from a different work order, clear previous selection
      const currentWoId = workOrderId;
      if (currentWoId && currentWoId !== slip.workOrderId) {
        newIds = [slipId];
      } else {
        newIds = [...selectedSlipIds, slipId];
      }
    } else {
      newIds = selectedSlipIds.filter((id) => id !== slipId);
    }

    setSelectedSlipIds(newIds);

    // Get selected slips and merge SKUs
    const selectedSlips = pendingTransferSlips.filter((s) => newIds.includes(s.id));
    if (selectedSlips.length > 0) {
      setWorkOrderId(selectedSlips[0].workOrderId);
      setSkuBreakdown(capByLabels(mergeSkuBreakdowns(selectedSlips), labelCover));

      // Set default expected completion if not already set
      if (!expectedCompletionDate) {
        const expected = new Date();
        expected.setDate(expected.getDate() + 7);
        setExpectedCompletionDate(toDateInputValue(expected));
      }
    } else {
      setWorkOrderId('');
      setSkuBreakdown([]);
    }
  };

  const handleSelectAllForWO = (woId: string, checked: boolean) => {
    const woSlips = slipsByWorkOrder.get(woId);
    if (!woSlips) return;

    if (checked) {
      // Select all slips for this WO (clear any other WO selections)
      const woSlipIds = woSlips.slips.map((s) => s.id);
      setSelectedSlipIds(woSlipIds);
      setWorkOrderId(woId);
      setSkuBreakdown(capByLabels(mergeSkuBreakdowns(woSlips.slips), labelCover));

      if (!expectedCompletionDate) {
        const expected = new Date();
        expected.setDate(expected.getDate() + 7);
        setExpectedCompletionDate(toDateInputValue(expected));
      }
    } else {
      setSelectedSlipIds([]);
      setWorkOrderId('');
      setSkuBreakdown([]);
    }
  };

  const updateSKUQuantity = (index: number, value: number) => {
    setSkuBreakdown((prev) => {
      const updated = [...prev];
      // Never more than the slips have left, nor more than this size's labels cover (other colours included)
      const row = updated[index];
      const cover = coverOf(labelCover, row.sizeName);
      const otherSameSize = updated
        .filter((r, i) => i !== index && r.sizeName.trim().toLowerCase() === row.sizeName.trim().toLowerCase())
        .reduce((sum, r) => sum + r.issuedQty, 0);
      const labelRoom = cover ? Math.max(0, cover.canIssue - otherSameSize) : Infinity;
      updated[index] = {
        ...row,
        issuedQty: Math.min(Math.max(0, value), row.availableQty, labelRoom),
      };
      return updated;
    });
  };

  const getTotalIssued = () => {
    return skuBreakdown.reduce((sum, sku) => sum + sku.issuedQty, 0);
  };

  const getTotalAvailable = () => {
    return skuBreakdown.reduce((sum, sku) => sum + sku.availableQty, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedSlipIds.length === 0) {
      setError('Please select at least one transfer slip');
      return;
    }

    if (!contractorId) {
      setError('Please select a stitching contractor');
      return;
    }

    if (!rateEntered) {
      setError('Enter the stitching rate given to the operators per piece');
      return;
    }

    if (skuBreakdown.length === 0) {
      setError('No SKU breakdown available');
      return;
    }

    const totalIssued = getTotalIssued();
    if (totalIssued <= 0) {
      setError('Please enter at least one SKU quantity to issue');
      return;
    }

    try {
      setSaving(true);

      const payload: CreateStitchingIssueRequest = {
        workOrderId,
        issueDate,
        contractorId,
        operatorRatePerPiece: rateValue,
        expectedCompletionDate: expectedCompletionDate || undefined,
        remarks: remarks || undefined,
        transferSlipIds: selectedSlipIds,
        skuBreakdown: skuBreakdown
          .filter((sku) => sku.issuedQty > 0)
          .map((sku) => ({
            colorId: sku.colorId,
            sizeId: sku.sizeId,
            availableQty: sku.availableQty,
            issuedQty: sku.issuedQty,
          })),
      };

      const result = await stitchingIssueService.create(payload);

      handleApiSuccess('Success', `Stitching issue ${result.issueNumber} created successfully`);
      navigate(`/manufacturing/stitching/${result.id}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to create stitching issue');
      // A refusal for missing size labels: show the latest cover so the rows say what can go
      if (workOrderId) {
        stitchingSummaryService
          .getLabelAvailability(workOrderId)
          .then(setLabelCover)
          .catch(() => undefined);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const totalSelectedPieces = pendingTransferSlips
    .filter((s) => selectedSlipIds.includes(s.id))
    .reduce((sum, s) => sum + s.totalGoodPieces, 0);

  return (
    <>
      <PageHeader title="New Stitching Issue">
        <Button variant="outline" onClick={() => navigate('/manufacturing/stitching')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to List
        </Button>
      </PageHeader>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {staleSlipLink && (
        <Alert className="mb-4">
          <AlertDescription>That transfer slip has nothing left to issue. Pick another slip below.</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Transfer Slip Selection — Multi-select with checkboxes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Source Selection
              </CardTitle>
              <CardDescription>
                Select one or more transfer slips from cutting to create a stitching issue
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {visibleTransferSlips.length === 0 ? (
                <p className="text-sm text-warning">
                  {workOrderIdParam
                    ? 'No pending transfer slips from cutting for this work order.'
                    : 'No pending transfer slips from cutting. Complete cutting batches first.'}
                </p>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                  {Array.from(slipsByWorkOrder.entries()).map(([woId, group]) => {
                    const allSelected = group.slips.every((s) => selectedSlipIds.includes(s.id));
                    const someSelected = group.slips.some((s) => selectedSlipIds.includes(s.id));
                    const isActiveWO = !workOrderId || workOrderId === woId;

                    return (
                      <div key={woId} className="space-y-2">
                        <div className="flex items-center gap-2 px-1">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={(checked) => handleSelectAllForWO(woId, !!checked)}
                            disabled={!isActiveWO && selectedSlipIds.length > 0}
                          />
                          <span className="text-sm font-semibold">{group.workOrderNumber}</span>
                          <Badge variant="outline" className="text-xs">
                            {group.slips.length} slip{group.slips.length > 1 ? 's' : ''}
                          </Badge>
                          {someSelected && !allSelected && (
                            <span className="text-xs text-muted-foreground">(partial)</span>
                          )}
                        </div>

                        <div className="space-y-1 ml-6">
                          {group.slips.map((slip) => {
                            const isSelected = selectedSlipIds.includes(slip.id);
                            return (
                              <label
                                key={slip.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'border-info/30 bg-info-muted'
                                    : isActiveWO || selectedSlipIds.length === 0
                                      ? 'border-border hover:bg-muted'
                                      : 'border-gray-100 bg-muted opacity-50 cursor-not-allowed'
                                }`}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => handleSlipToggle(slip.id, !!checked)}
                                  disabled={!isActiveWO && selectedSlipIds.length > 0 && !isSelected}
                                />
                                <div className="flex-1 flex items-center gap-4 text-sm">
                                  <span className="font-medium">{slip.slipNumber}</span>
                                  <span className="text-muted-foreground">{styleCodeLabel(slip)}</span>
                                  <span className="text-muted-foreground">{slip.styleName}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {slip.totalGoodPieces < slip.sentPieces
                                      ? `${slip.totalGoodPieces} of ${slip.sentPieces} pcs left`
                                      : `${slip.totalGoodPieces} pcs`}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDate(new Date(slip.transferDate))}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Selection summary */}
              {selectedSlipIds.length > 0 && (
                <div className="bg-info-muted p-3 rounded-lg flex items-center gap-4 text-sm">
                  <CheckSquare className="h-4 w-4 text-info" />
                  <span>
                    <strong>{selectedSlipIds.length}</strong> slip{selectedSlipIds.length > 1 ? 's' : ''} selected
                  </span>
                  <span className="text-muted-foreground">|</span>
                  <span>
                    Total: <strong className="text-success">{totalSelectedPieces}</strong> pcs
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Issue Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Issue Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="issueDate">Issue Date *</Label>
                  <Input
                    id="issueDate"
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="contractor">Stitching Contractor *</Label>
                  <SupplierCombobox
                    value={contractorId}
                    onValueChange={setContractorId}
                    categoryFilter="STITCHING_CONTRACTOR"
                    placeholder="Select contractor..."
                  />
                </div>

                <div>
                  <Label htmlFor="expectedCompletion">Expected Completion</Label>
                  <Input
                    id="expectedCompletion"
                    type="date"
                    value={expectedCompletionDate}
                    onChange={(e) => setExpectedCompletionDate(e.target.value)}
                    min={issueDate}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  placeholder="Any special instructions for stitching..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Stitching Rate — last given, as per costing, given now */}
          {workOrderId && (
            <StitchingRateCard
              guide={rateGuide}
              loading={rateGuideLoading}
              value={operatorRate}
              onChange={setOperatorRate}
              pieces={getTotalIssued()}
            />
          )}

          {/* SKU Breakdown */}
          {skuBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shirt className="h-5 w-5" />
                  SKU Breakdown
                </CardTitle>
                <CardDescription>
                  Specify quantities to issue for stitching (max: available from cutting)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Color</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right">Left to Issue</TableHead>
                        {labelCover?.sizes && <TableHead className="text-right">Size labels for</TableHead>}
                        <TableHead className="text-right w-[150px]">Issue Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {skuBreakdown.map((sku, index) => (
                        <TableRow key={`${sku.colorId || 'null'}-${sku.sizeId}`}>
                          <TableCell className="font-medium">{sku.colorName || '—'}</TableCell>
                          <TableCell>{sku.sizeName}</TableCell>
                          <TableCell className="text-right text-success font-medium">
                            {sku.availableQty}
                            {sku.sentQty - sku.availableQty > 0 && (
                              <span className="ml-1 text-xs font-normal text-muted-foreground">
                                of {sku.sentQty} sent
                              </span>
                            )}
                          </TableCell>
                          {labelCover?.sizes && (
                            <TableCell className="text-right">
                              <LabelCoverCell cover={coverOf(labelCover, sku.sizeName)} />
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={0}
                              max={sku.availableQty}
                              value={sku.issuedQty}
                              onChange={(e) => updateSKUQuantity(index, parseInt(e.target.value) || 0)}
                              className="w-24 text-right ml-auto"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <tfoot className="bg-muted">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-sm font-semibold">
                          Total
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-success">{getTotalAvailable()}</td>
                        {labelCover?.sizes && <td />}
                        <td className="px-4 py-3 text-sm text-right font-bold text-info">{getTotalIssued()}</td>
                      </tr>
                    </tfoot>
                  </Table>
                </div>

                {labelCover?.sizes &&
                  skuBreakdown.some((sku) => (coverOf(labelCover, sku.sizeName)?.canIssue ?? 0) < sku.availableQty) && (
                    <Alert className="mt-3">
                      <AlertDescription>
                        A size label is sewn at stitching, so a size can be issued only as far as its labels in store
                        (or already issued to this run) cover it. Receive or allocate the missing labels and issue them
                        from the run&apos;s Trim Issuance, then issue the rest of these pieces.
                      </AlertDescription>
                    </Alert>
                  )}

                {getTotalIssued() < getTotalAvailable() && (
                  <p className="text-sm text-warning mt-2">
                    Note: You are issuing {getTotalIssued()} of {getTotalAvailable()} pieces left. The other{' '}
                    {getTotalAvailable() - getTotalIssued()} stay on the slip under Incoming from Cutting, to issue
                    later.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Summary & Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Total pieces to be issued</div>
                  <div className="text-3xl font-bold text-info">{getTotalIssued()}</div>
                </div>

                <div className="flex gap-4">
                  <Button type="button" variant="outline" onClick={() => navigate('/manufacturing/stitching')}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      saving || selectedSlipIds.length === 0 || !contractorId || !rateEntered || getTotalIssued() <= 0
                    }
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Creating...' : 'Create Stitching Issue'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </>
  );
}
