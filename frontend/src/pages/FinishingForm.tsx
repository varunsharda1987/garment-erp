// Finishing Issue Form - Create new finishing issue from transfer slip
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, CheckSquare, Package, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { finishingIssueService, finishingSummaryService } from '@/services/finishing.service';
import { handleApiSuccess } from '@/lib/api-error-handler';
import type { CreateFinishingIssueRequest, FinishingIncomingTransferSlip } from '@/types/finishing.types';

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

export default function FinishingForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const transferSlipIdParam = searchParams.get('transferSlipId');
  const workOrderIdParam = searchParams.get('workOrderId');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [selectedTransferSlipId, setSelectedTransferSlipId] = useState<string>('');
  const [workOrderId, setWorkOrderId] = useState<string>('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [contractorId, setContractorId] = useState<string>('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState<string>('');
  const [remarks, setRemarks] = useState('');
  const [skuBreakdown, setSkuBreakdown] = useState<SKUEntry[]>([]);

  // Reference data
  const [pendingTransferSlips, setPendingTransferSlips] = useState<FinishingIncomingTransferSlip[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [selectedTransferSlip, setSelectedTransferSlip] = useState<FinishingIncomingTransferSlip | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (transferSlipIdParam && pendingTransferSlips.length > 0) {
      setSelectedTransferSlipId(transferSlipIdParam);
      handleTransferSlipSelect(transferSlipIdParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferSlipIdParam, pendingTransferSlips]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [slipsData, contractorsData] = await Promise.all([
        finishingSummaryService.getAvailableTransferSlips(),
        finishingSummaryService.getAvailableManagers(),
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

  const handleTransferSlipSelect = async (slipId: string) => {
    const slip = pendingTransferSlips.find((s) => s.id === slipId);
    if (!slip) return;

    setSelectedTransferSlip(slip);
    setWorkOrderId(slip.workOrderId);

    // Get SKU breakdown from the transfer slip
    if (slip.skuBreakdown && slip.skuBreakdown.length > 0) {
      setSkuBreakdown(
        slip.skuBreakdown.map((sku) => ({
          colorId: sku.colorId,
          colorName: sku.colorName,
          sizeId: sku.sizeId,
          sizeName: sku.sizeName,
          availableQty: sku.quantity,
          issuedQty: sku.quantity, // Default to all available
        }))
      );
    } else {
      // Placeholder if no detailed breakdown available
      setSkuBreakdown([
        {
          colorId: null,
          colorName: 'All Colors',
          sizeId: 'unknown',
          sizeName: 'All Sizes',
          availableQty: slip.totalGoodPieces,
          issuedQty: slip.totalGoodPieces,
        },
      ]);
    }

    // Set default expected completion (5 days from issue for finishing)
    const expected = new Date();
    expected.setDate(expected.getDate() + 5);
    setExpectedCompletionDate(expected.toISOString().split('T')[0]);
  };

  const updateSKUQuantity = (index: number, value: number) => {
    setSkuBreakdown((prev) => {
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

    // Validation
    if (!selectedTransferSlipId && !workOrderId) {
      setError('Please select a transfer slip');
      return;
    }

    if (!contractorId) {
      setError('Please select a finishing contractor');
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

      const payload: CreateFinishingIssueRequest = {
        workOrderId,
        issueDate,
        contractorId,
        expectedCompletionDate: expectedCompletionDate || undefined,
        remarks: remarks || undefined,
        skuBreakdown: skuBreakdown
          .filter((sku) => sku.issuedQty > 0)
          .map((sku) => ({
            colorId: sku.colorId,
            sizeId: sku.sizeId,
            availableQty: sku.availableQty,
            issuedQty: sku.issuedQty,
          })),
      };

      const result = await finishingIssueService.create(payload);

      handleApiSuccess('Success', `Finishing issue ${result.issueNumber} created successfully`);

      navigate(`/manufacturing/finishing/${result.id}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to create finishing issue');
    } finally {
      setSaving(false);
    }
  };

  // When arriving from a work-order drill-down link, restrict the selectable slips to that WO
  const visibleTransferSlips = workOrderIdParam
    ? pendingTransferSlips.filter((s) => s.workOrderId === workOrderIdParam)
    : pendingTransferSlips;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="New Finishing Issue">
        <Button variant="outline" onClick={() => navigate('/manufacturing/finishing')}>
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
          {/* Transfer Slip Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Source Selection
              </CardTitle>
              <CardDescription>Select a transfer slip from stitching to create a finishing issue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="transferSlip">Transfer Slip from Stitching *</Label>
                <Select
                  value={selectedTransferSlipId || 'NONE'}
                  onValueChange={(v) => {
                    if (v !== 'NONE') {
                      setSelectedTransferSlipId(v);
                      handleTransferSlipSelect(v);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a transfer slip..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE" disabled>
                      Select a transfer slip...
                    </SelectItem>
                    {visibleTransferSlips.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        No pending transfer slips
                      </SelectItem>
                    ) : (
                      visibleTransferSlips.map((slip) => (
                        <SelectItem key={slip.id} value={slip.id}>
                          {slip.slipNumber} - {slip.workOrderNumber} ({slip.styleCode || slip.styleName}) -{' '}
                          {slip.totalGoodPieces} pcs
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {visibleTransferSlips.length === 0 && (
                  <p className="text-sm text-warning mt-2">
                    {workOrderIdParam
                      ? 'No pending transfer slips from stitching for this work order.'
                      : 'No pending transfer slips from stitching. Complete stitching issues first.'}
                  </p>
                )}
              </div>

              {selectedTransferSlip && (
                <div className="bg-accent/10 p-4 rounded-lg space-y-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Work Order:</span>
                      <div className="font-medium">{selectedTransferSlip.workOrderNumber}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Style:</span>
                      <div className="font-medium">
                        {selectedTransferSlip.styleCode || selectedTransferSlip.styleName}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Transfer Date:</span>
                      <div className="font-medium">
                        {new Date(selectedTransferSlip.transferDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Pieces:</span>
                      <div className="font-medium text-success">{selectedTransferSlip.totalGoodPieces}</div>
                    </div>
                  </div>
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
                  <Label htmlFor="contractor">Finishing Contractor *</Label>
                  <Select value={contractorId || 'NONE'} onValueChange={(v) => setContractorId(v === 'NONE' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select contractor..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE" disabled>
                        Select contractor...
                      </SelectItem>
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
                  placeholder="Any special instructions for finishing..."
                />
              </div>
            </CardContent>
          </Card>

          {/* SKU Breakdown */}
          {skuBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5" />
                  SKU Breakdown
                </CardTitle>
                <CardDescription>
                  Specify quantities to issue for finishing (max: available from stitching)
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
                          <TableCell className="font-medium">{sku.colorName || '—'}</TableCell>
                          <TableCell>{sku.sizeName}</TableCell>
                          <TableCell className="text-right text-success font-medium">{sku.availableQty}</TableCell>
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
                        <td className="px-4 py-3 text-sm text-right font-bold text-accent">{getTotalIssued()}</td>
                      </tr>
                    </tfoot>
                  </Table>
                </div>

                {getTotalIssued() < getTotalAvailable() && (
                  <p className="text-sm text-warning mt-2">
                    Note: You are issuing {getTotalIssued()} of {getTotalAvailable()} available pieces. Remaining pieces
                    can be issued later.
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
                  <div className="text-sm text-muted-foreground">Total pieces to be issued for finishing</div>
                  <div className="text-3xl font-bold text-accent">{getTotalIssued()}</div>
                </div>

                <div className="flex gap-4">
                  <Button type="button" variant="outline" onClick={() => navigate('/manufacturing/finishing')}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving || !selectedTransferSlipId || !contractorId || getTotalIssued() <= 0}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Creating...' : 'Create Finishing Issue'}
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
