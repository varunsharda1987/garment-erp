// Stitching Issue Form - Create new stitching issue from transfer slip or work order
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Shirt, Package, FileText } from 'lucide-react';
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
import { stitchingIssueService, stitchingSummaryService } from '@/services/stitching.service';
import workOrderService from '@/services/workOrder.service';
import { userService } from '@/services/user.service';
import { handleApiSuccess } from '@/lib/api-error-handler';
import type { CreateStitchingIssueRequest } from '@/types/stitching.types';

interface PendingTransferSlip {
  id: string;
  slipNumber: string;
  workOrderNumber: string;
  workOrderId?: string;
  styleName: string;
  styleCode?: string;
  totalGoodPieces: number;
  transferDate: string;
  skuBreakdown?: Array<{
    colorId: string;
    colorName: string;
    sizeId: string;
    sizeName: string;
    goodPcs: number;
  }>;
}

interface SKUEntry {
  colorId: string | null;
  colorName: string;
  sizeId: string;
  sizeName: string;
  availableQty: number;
  issuedQty: number;
}

interface Manager {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export default function StitchingForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const transferSlipIdParam = searchParams.get('transferSlipId');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [selectedTransferSlipId, setSelectedTransferSlipId] = useState<string>('');
  const [workOrderId, setWorkOrderId] = useState<string>('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [managerId, setManagerId] = useState<string>('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState<string>('');
  const [remarks, setRemarks] = useState('');
  const [skuBreakdown, setSkuBreakdown] = useState<SKUEntry[]>([]);

  // Reference data
  const [pendingTransferSlips, setPendingTransferSlips] = useState<PendingTransferSlip[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [selectedTransferSlip, setSelectedTransferSlip] = useState<PendingTransferSlip | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (transferSlipIdParam && pendingTransferSlips.length > 0) {
      setSelectedTransferSlipId(transferSlipIdParam);
      handleTransferSlipSelect(transferSlipIdParam);
    }
  }, [transferSlipIdParam, pendingTransferSlips]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [slipsData, usersData] = await Promise.all([
        stitchingSummaryService.getPendingTransferSlips(),
        userService.getAllUsers(1, 100),
      ]);

      setPendingTransferSlips(slipsData);
      setManagers(usersData.data || []);

    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleTransferSlipSelect = async (slipId: string) => {
    const slip = pendingTransferSlips.find(s => s.id === slipId);
    if (!slip) return;

    setSelectedTransferSlip(slip);
    setWorkOrderId(slip.workOrderId || '');

    // Try to get SKU breakdown from the transfer slip
    // For now, we'll create a placeholder - in production this would come from the API
    if (slip.skuBreakdown && slip.skuBreakdown.length > 0) {
      setSkuBreakdown(slip.skuBreakdown.map(sku => ({
        colorId: sku.colorId,
        colorName: sku.colorName,
        sizeId: sku.sizeId,
        sizeName: sku.sizeName,
        availableQty: sku.goodPcs,
        issuedQty: sku.goodPcs, // Default to all available
      })));
    } else if (slip.workOrderId) {
      // If no SKU breakdown, we need to fetch work order details
      try {
        const wo = await workOrderService.getById(slip.workOrderId);
        const breakup = wo.workOrderBreakup || [];
        if (breakup.length > 0) {
          setSkuBreakdown(breakup.map(b => ({
            colorId: b.colorId,
            colorName: b.colorOptions?.colorName || 'Unknown',
            sizeId: b.sizeId,
            sizeName: b.sizeOptions?.sizeName || 'Unknown',
            availableQty: slip.totalGoodPieces / breakup.length, // Rough estimate
            issuedQty: slip.totalGoodPieces / breakup.length,
          })));
        }
      } catch (err) {
        console.error('Error fetching work order:', err);
      }
    }

    // Set default expected completion (7 days from issue)
    const expected = new Date();
    expected.setDate(expected.getDate() + 7);
    setExpectedCompletionDate(expected.toISOString().split('T')[0]);
  };

  const updateSKUQuantity = (index: number, field: 'issuedQty', value: number) => {
    setSkuBreakdown(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: Math.min(Math.max(0, value), updated[index].availableQty),
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
      setError('Please select a transfer slip or work order');
      return;
    }

    if (!managerId) {
      setError('Please select a manager');
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
        managerId,
        expectedCompletionDate: expectedCompletionDate || undefined,
        remarks: remarks || undefined,
        skuBreakdown: skuBreakdown
          .filter(sku => sku.issuedQty > 0 && sku.colorId !== null)
          .map(sku => ({
            colorId: sku.colorId as string,
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
          {/* Transfer Slip Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Source Selection
              </CardTitle>
              <CardDescription>
                Select a transfer slip from cutting to create a stitching issue
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="transferSlip">Transfer Slip from Cutting *</Label>
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
                    <SelectItem value="NONE" disabled>Select a transfer slip...</SelectItem>
                    {pendingTransferSlips.length === 0 ? (
                      <SelectItem value="empty" disabled>No pending transfer slips</SelectItem>
                    ) : (
                      pendingTransferSlips.map((slip) => (
                        <SelectItem key={slip.id} value={slip.id}>
                          {slip.slipNumber} - {slip.workOrderNumber} ({slip.styleCode}) - {slip.totalGoodPieces} pcs
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {pendingTransferSlips.length === 0 && (
                  <p className="text-sm text-amber-600 mt-2">
                    No pending transfer slips from cutting. Complete cutting batches first.
                  </p>
                )}
              </div>

              {selectedTransferSlip && (
                <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Work Order:</span>
                      <div className="font-medium">{selectedTransferSlip.workOrderNumber}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Style:</span>
                      <div className="font-medium">{selectedTransferSlip.styleCode} - {selectedTransferSlip.styleName}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Transfer Date:</span>
                      <div className="font-medium">
                        {new Date(selectedTransferSlip.transferDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Pieces:</span>
                      <div className="font-medium text-green-600">{selectedTransferSlip.totalGoodPieces}</div>
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
                  <Label htmlFor="manager">Stitching Manager *</Label>
                  <Select
                    value={managerId || 'NONE'}
                    onValueChange={(v) => setManagerId(v === 'NONE' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE" disabled>Select manager...</SelectItem>
                      {managers.map((mgr) => (
                        <SelectItem key={mgr.id} value={mgr.id}>
                          {mgr.firstName} {mgr.lastName}
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
                        <TableRow key={`${sku.colorId}-${sku.sizeId}`}>
                          <TableCell className="font-medium">{sku.colorName}</TableCell>
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
                              onChange={(e) => updateSKUQuantity(index, 'issuedQty', parseInt(e.target.value) || 0)}
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
                    disabled={saving || !selectedTransferSlipId || !managerId || getTotalIssued() <= 0}
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
