// Stitching Issue Form - Create new stitching issue from transfer slip(s)
import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Shirt, Package, FileText, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { stitchingIssueService, stitchingSummaryService } from '@/services/stitching.service';
import { handleApiSuccess } from '@/lib/api-error-handler';
import type { CreateStitchingIssueRequest, IncomingTransferSlip } from '@/types/stitching.types';

interface SKUEntry {
  colorId: string | null;
  colorName: string;
  sizeId: string;
  sizeName: string;
  availableQty: number;
  issuedQty: number;
}

interface Contractor {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
}

// Merge SKU breakdowns from multiple transfer slips
function mergeSkuBreakdowns(slips: IncomingTransferSlip[]): SKUEntry[] {
  const map = new Map<string, SKUEntry>();
  for (const slip of slips) {
    for (const sku of slip.skuBreakdown) {
      const key = `${sku.colorId || 'null'}-${sku.sizeId}`;
      const existing = map.get(key);
      if (existing) {
        existing.availableQty += sku.quantity;
        existing.issuedQty += sku.quantity;
      } else {
        map.set(key, {
          colorId: sku.colorId,
          colorName: sku.colorName,
          sizeId: sku.sizeId,
          sizeName: sku.sizeName,
          availableQty: sku.quantity,
          issuedQty: sku.quantity,
        });
      }
    }
  }
  return Array.from(map.values());
}

export default function StitchingForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const transferSlipIdParam = searchParams.get('transferSlipId');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [selectedSlipIds, setSelectedSlipIds] = useState<string[]>([]);
  const [workOrderId, setWorkOrderId] = useState<string>('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [contractorId, setContractorId] = useState<string>('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState<string>('');
  const [remarks, setRemarks] = useState('');
  const [skuBreakdown, setSkuBreakdown] = useState<SKUEntry[]>([]);

  // Reference data
  const [pendingTransferSlips, setPendingTransferSlips] = useState<IncomingTransferSlip[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);

  // Group slips by work order for display
  const slipsByWorkOrder = useMemo(() => {
    const groups = new Map<string, { workOrderNumber: string; slips: IncomingTransferSlip[] }>();
    for (const slip of pendingTransferSlips) {
      const key = slip.workOrderId;
      if (!groups.has(key)) {
        groups.set(key, { workOrderNumber: slip.workOrderNumber, slips: [] });
      }
      groups.get(key)!.slips.push(slip);
    }
    return groups;
  }, [pendingTransferSlips]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (transferSlipIdParam && pendingTransferSlips.length > 0) {
      handleSlipToggle(transferSlipIdParam, true);
    }
  }, [transferSlipIdParam, pendingTransferSlips]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [slipsData, contractorsData] = await Promise.all([
        stitchingSummaryService.getPendingTransferSlips(),
        stitchingSummaryService.getAvailableManagers(),
      ]);

      setPendingTransferSlips(slipsData);
      setContractors(contractorsData);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSlipToggle = (slipId: string, checked: boolean) => {
    const slip = pendingTransferSlips.find(s => s.id === slipId);
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
      newIds = selectedSlipIds.filter(id => id !== slipId);
    }

    setSelectedSlipIds(newIds);

    // Get selected slips and merge SKUs
    const selectedSlips = pendingTransferSlips.filter(s => newIds.includes(s.id));
    if (selectedSlips.length > 0) {
      setWorkOrderId(selectedSlips[0].workOrderId);
      setSkuBreakdown(mergeSkuBreakdowns(selectedSlips));

      // Set default expected completion if not already set
      if (!expectedCompletionDate) {
        const expected = new Date();
        expected.setDate(expected.getDate() + 7);
        setExpectedCompletionDate(expected.toISOString().split('T')[0]);
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
      const woSlipIds = woSlips.slips.map(s => s.id);
      setSelectedSlipIds(woSlipIds);
      setWorkOrderId(woId);
      setSkuBreakdown(mergeSkuBreakdowns(woSlips.slips));

      if (!expectedCompletionDate) {
        const expected = new Date();
        expected.setDate(expected.getDate() + 7);
        setExpectedCompletionDate(expected.toISOString().split('T')[0]);
      }
    } else {
      setSelectedSlipIds([]);
      setWorkOrderId('');
      setSkuBreakdown([]);
    }
  };

  const updateSKUQuantity = (index: number, value: number) => {
    setSkuBreakdown(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        issuedQty: Math.min(Math.max(0, value), updated[index].availableQty),
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
        expectedCompletionDate: expectedCompletionDate || undefined,
        remarks: remarks || undefined,
        transferSlipIds: selectedSlipIds,
        skuBreakdown: skuBreakdown
          .filter(sku => sku.issuedQty > 0)
          .map(sku => ({
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
    .filter(s => selectedSlipIds.includes(s.id))
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
              {pendingTransferSlips.length === 0 ? (
                <p className="text-sm text-amber-600">
                  No pending transfer slips from cutting. Complete cutting batches first.
                </p>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                  {Array.from(slipsByWorkOrder.entries()).map(([woId, group]) => {
                    const allSelected = group.slips.every(s => selectedSlipIds.includes(s.id));
                    const someSelected = group.slips.some(s => selectedSlipIds.includes(s.id));
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
                                    ? 'border-blue-300 bg-blue-50'
                                    : isActiveWO || selectedSlipIds.length === 0
                                      ? 'border-gray-200 hover:bg-gray-50'
                                      : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                                }`}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => handleSlipToggle(slip.id, !!checked)}
                                  disabled={!isActiveWO && selectedSlipIds.length > 0 && !isSelected}
                                />
                                <div className="flex-1 flex items-center gap-4 text-sm">
                                  <span className="font-medium">{slip.slipNumber}</span>
                                  <span className="text-muted-foreground">{slip.styleCode}</span>
                                  <span className="text-muted-foreground">{slip.styleName}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {slip.totalGoodPieces} pcs
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(slip.transferDate).toLocaleDateString()}
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
                <div className="bg-blue-50 p-3 rounded-lg flex items-center gap-4 text-sm">
                  <CheckSquare className="h-4 w-4 text-blue-600" />
                  <span>
                    <strong>{selectedSlipIds.length}</strong> slip{selectedSlipIds.length > 1 ? 's' : ''} selected
                  </span>
                  <span className="text-muted-foreground">|</span>
                  <span>
                    Total: <strong className="text-green-600">{totalSelectedPieces}</strong> pcs
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
                  <Select
                    value={contractorId || 'NONE'}
                    onValueChange={(v) => setContractorId(v === 'NONE' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select contractor..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE" disabled>Select contractor...</SelectItem>
                      {contractors.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                        <TableHead className="text-right">Available</TableHead>
                        <TableHead className="text-right w-[150px]">Issue Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {skuBreakdown.map((sku, index) => (
                        <TableRow key={`${sku.colorId || 'null'}-${sku.sizeId}`}>
                          <TableCell className="font-medium">
                            {sku.colorName || '—'}
                          </TableCell>
                          <TableCell>{sku.sizeName}</TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            {sku.availableQty}
                          </TableCell>
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
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-sm font-semibold">
                          Total
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                          {getTotalAvailable()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-blue-600">
                          {getTotalIssued()}
                        </td>
                      </tr>
                    </tfoot>
                  </Table>
                </div>

                {getTotalIssued() < getTotalAvailable() && (
                  <p className="text-sm text-amber-600 mt-2">
                    Note: You are issuing {getTotalIssued()} of {getTotalAvailable()} available pieces.
                    Remaining pieces can be issued later.
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
                  <div className="text-sm text-gray-500">Total pieces to be issued</div>
                  <div className="text-3xl font-bold text-blue-600">{getTotalIssued()}</div>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/manufacturing/stitching')}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving || selectedSlipIds.length === 0 || !contractorId || getTotalIssued() <= 0}
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
