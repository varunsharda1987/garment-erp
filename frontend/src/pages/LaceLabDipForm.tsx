/**
 * Lace Lab Dip Form Page
 * Create, edit, and manage lab dip workflow status
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { laceLabDipService } from '../services/laceLabDip.service';
import { getGreigeLace } from '../services/lace.service';
import { getAllSuppliers } from '../services/supplier.service';
import type { LaceLabDip, LabDipStatus, CreateLabDipInput, UpdateLabDipStatusInput } from '../types/laceLabDip.types';
import { LAB_DIP_STATUS_COLORS, LAB_DIP_STATUS_LABELS, LAB_DIP_STATUS_TRANSITIONS } from '../types/laceLabDip.types';
import type { Lace } from '../types/lace.types';
import type { Supplier } from '../types/supplier.types';
import { notify } from '../lib/notify';
import { ArrowLeft, CheckCircle, XCircle, Clock, Send, Package, UserCheck } from 'lucide-react';

export default function LaceLabDipForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id && id !== 'new';

  const [loading, setLoading] = useState(false);
  const [labDip, setLabDip] = useState<LaceLabDip | null>(null);

  // Form fields
  const [greigeLaceId, setGreigeLaceId] = useState('');
  const [targetColor, setTargetColor] = useState('');
  const [processorId, setProcessorId] = useState('');
  const [sampleQuantity, setSampleQuantity] = useState('1');
  const [colorRecipe, setColorRecipe] = useState('');
  const [labDipCost, setLabDipCost] = useState('');

  // Status update fields
  const [buyerRemarks, setBuyerRemarks] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalReference, setApprovalReference] = useState('');

  // Dropdown data
  const [greigeLaces, setGreigeLaces] = useState<Lace[]>([]);
  const [processors, setProcessors] = useState<Supplier[]>([]);

  // Load dropdown data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [lacesRes, suppliersRes] = await Promise.all([
          getGreigeLace({ limit: 100 }),
          getAllSuppliers({ limit: 100, category: 'DYEING_PRINTING' }),
        ]);
        setGreigeLaces(lacesRes.data);
        setProcessors(suppliersRes.data);
      } catch (error) {
        console.error('Failed to load dropdown data:', error);
        notify.error('Failed to load form data');
      }
    };
    loadData();
  }, []);

  // Load lab dip data in edit mode
  useEffect(() => {
    if (!isEditMode) return;

    const loadLabDip = async () => {
      setLoading(true);
      try {
        const data = await laceLabDipService.getLabDipById(id!);
        setLabDip(data);

        // Populate form fields
        setGreigeLaceId(data.greigeLaceId);
        setTargetColor(data.targetColor);
        setProcessorId(data.processorId);
        setSampleQuantity(data.sampleQuantity?.toString() || '1');
        setColorRecipe(data.colorRecipe || '');
        setLabDipCost(data.labDipCost?.toString() || '');
        setBuyerRemarks(data.buyerRemarks || '');
        setRejectionReason(data.rejectionReason || '');
        setApprovalReference(data.approvalReference || '');
      } catch (error) {
        console.error('Failed to load lab dip:', error);
        notify.error('Failed to load lab dip');
        navigate('/lace-lab-dips');
      } finally {
        setLoading(false);
      }
    };
    loadLabDip();
  }, [id, isEditMode, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!greigeLaceId || !targetColor || !processorId) {
      notify.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const input: CreateLabDipInput = {
        greigeLaceId,
        targetColor,
        processorId,
        sampleQuantity: parseFloat(sampleQuantity) || 1,
        colorRecipe: colorRecipe || undefined,
        labDipCost: labDipCost ? parseFloat(labDipCost) : undefined,
      };

      if (isEditMode && labDip) {
        await laceLabDipService.updateLabDip(id!, {
          targetColor,
          colorRecipe: colorRecipe || undefined,
          sampleQuantity: parseFloat(sampleQuantity) || undefined,
          labDipCost: labDipCost ? parseFloat(labDipCost) : undefined,
        });
        notify.success('Lab dip updated successfully');
      } else {
        await laceLabDipService.createLabDip(input);
        notify.success('Lab dip request created successfully');
      }

      navigate('/lace-lab-dips');
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { error?: string } } };
      notify.error(axiosErr.response?.data?.error || 'Failed to save lab dip');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: LabDipStatus) => {
    if (!labDip) return;

    // Validate required fields for certain transitions
    if (newStatus === 'APPROVED' && !approvalReference) {
      notify.error('Please enter the buyer approval reference');
      return;
    }
    if (newStatus === 'REJECTED' && !rejectionReason) {
      notify.error('Please enter the rejection reason');
      return;
    }

    setLoading(true);
    try {
      const input: UpdateLabDipStatusInput = {
        status: newStatus,
        buyerRemarks: buyerRemarks || undefined,
        rejectionReason: rejectionReason || undefined,
        approvalReference: approvalReference || undefined,
      };

      const updated = await laceLabDipService.updateLabDipStatus(id!, input);
      setLabDip(updated);
      notify.success(`Status updated to ${LAB_DIP_STATUS_LABELS[newStatus]}`);
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { error?: string } } };
      notify.error(axiosErr.response?.data?.error || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: LabDipStatus) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-5 w-5" />;
      case 'SENT_TO_PROCESSOR':
        return <Send className="h-5 w-5" />;
      case 'SAMPLE_RECEIVED':
        return <Package className="h-5 w-5" />;
      case 'AWAITING_BUYER_APPROVAL':
        return <UserCheck className="h-5 w-5" />;
      case 'APPROVED':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'REJECTED':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return null;
    }
  };

  // Get available next statuses
  const availableTransitions = labDip ? LAB_DIP_STATUS_TRANSITIONS[labDip.status] : [];

  if (loading && isEditMode && !labDip) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-info border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/lace-lab-dips')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-display font-medium">
            {isEditMode ? 'Lab Dip Details' : 'New Lab Dip Request'}
          </h1>
          {labDip && <p className="text-muted-foreground">{labDip.labDipNumber}</p>}
        </div>
      </div>

      {/* Status Card (Edit Mode) */}
      {isEditMode && labDip && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(labDip.status)}
              Workflow Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Current Status */}
            <div className="flex items-center gap-4 mb-6">
              <span className="text-muted-foreground">Current Status:</span>
              <Badge className={`${LAB_DIP_STATUS_COLORS[labDip.status]} border text-base px-4 py-1`}>
                {LAB_DIP_STATUS_LABELS[labDip.status]}
              </Badge>
            </div>

            {/* Timeline */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 text-sm">
              <div>
                <span className="text-muted-foreground">Request Date:</span>
                <p className="font-medium">{formatDate(labDip.requestDate)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Sent to Processor:</span>
                <p className="font-medium">{formatDate(labDip.sentToProcessorDate)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Sample Received:</span>
                <p className="font-medium">{formatDate(labDip.sampleReceivedDate)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Sent to Buyer:</span>
                <p className="font-medium">{formatDate(labDip.sentToBuyerDate)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Buyer Decision:</span>
                <p className="font-medium">{formatDate(labDip.buyerDecisionDate)}</p>
              </div>
            </div>

            {/* Status Transition Buttons */}
            {availableTransitions.length > 0 && (
              <div className="border-t pt-6">
                <h4 className="font-medium mb-4">Update Status</h4>

                {/* Buyer approval fields */}
                {labDip.status === 'AWAITING_BUYER_APPROVAL' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label>Buyer Remarks</Label>
                      <Textarea
                        value={buyerRemarks}
                        onChange={(e) => setBuyerRemarks(e.target.value)}
                        placeholder="Optional buyer remarks..."
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label>Approval Reference</Label>
                      <Input
                        value={approvalReference}
                        onChange={(e) => setApprovalReference(e.target.value)}
                        placeholder="e.g., BUYER-APPROVE-001"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Rejection Reason (if rejecting)</Label>
                      <Textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Enter reason if rejecting..."
                        rows={2}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  {availableTransitions.map((status) => (
                    <Button
                      key={status}
                      variant={status === 'REJECTED' ? 'destructive' : 'default'}
                      onClick={() => handleStatusUpdate(status)}
                      disabled={loading}
                    >
                      {status === 'APPROVED' && <CheckCircle className="h-4 w-4 mr-2" />}
                      {status === 'REJECTED' && <XCircle className="h-4 w-4 mr-2" />}
                      {LAB_DIP_STATUS_LABELS[status]}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Approved/Rejected info */}
            {labDip.status === 'APPROVED' && labDip.approvalReference && (
              <div className="bg-success-muted border border-success/20 rounded-lg p-4 mt-4">
                <p className="text-success">
                  <strong>Approval Reference:</strong> {labDip.approvalReference}
                </p>
                {labDip.buyerRemarks && (
                  <p className="text-success mt-2">
                    <strong>Remarks:</strong> {labDip.buyerRemarks}
                  </p>
                )}
              </div>
            )}

            {labDip.status === 'REJECTED' && labDip.rejectionReason && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mt-4">
                <p className="text-destructive">
                  <strong>Rejection Reason:</strong> {labDip.rejectionReason}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Lab Dip Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Greige Lace */}
              <div>
                <Label>
                  Greige Lace <span className="text-destructive">*</span>
                </Label>
                <Select value={greigeLaceId} onValueChange={setGreigeLaceId} disabled={isEditMode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select greige lace..." />
                  </SelectTrigger>
                  <SelectContent>
                    {greigeLaces.map((lace) => (
                      <SelectItem key={lace.id} value={lace.id}>
                        {lace.laceCode} - {lace.laceName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Processor */}
              <div>
                <Label>
                  Processor <span className="text-destructive">*</span>
                </Label>
                <Select value={processorId} onValueChange={setProcessorId} disabled={isEditMode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select processor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {processors.map((proc) => (
                      <SelectItem key={proc.id} value={proc.id}>
                        {proc.code} - {proc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target Color */}
              <div>
                <Label>
                  Target Color <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={targetColor}
                  onChange={(e) => setTargetColor(e.target.value)}
                  placeholder="e.g., Red, Navy Blue, Maroon"
                />
              </div>

              {/* Sample Quantity */}
              <div>
                <Label>Sample Quantity (meters)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={sampleQuantity}
                  onChange={(e) => setSampleQuantity(e.target.value)}
                  placeholder="e.g., 1"
                />
              </div>

              {/* Color Recipe */}
              <div className="md:col-span-2">
                <Label>Color Recipe / Dye Formula</Label>
                <Textarea
                  value={colorRecipe}
                  onChange={(e) => setColorRecipe(e.target.value)}
                  placeholder="Optional: Processor's dye recipe or formula reference..."
                  rows={2}
                />
              </div>

              {/* Lab Dip Cost */}
              <div>
                <Label>Lab Dip Cost (optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={labDipCost}
                  onChange={(e) => setLabDipCost(e.target.value)}
                  placeholder="e.g., 150.00"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button type="button" variant="outline" onClick={() => navigate('/lace-lab-dips')}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : isEditMode ? 'Update Lab Dip' : 'Create Lab Dip'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
