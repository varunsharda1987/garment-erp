// Shared Lab Dip Detail Page - works for both Dyeing and Printing
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Beaker,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCcw,
  Calendar,
  User,
  Palette,
  Factory,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { dyeLabDipService } from '@/services/dyeing.service';
import { labDipService as printLabDipService } from '@/services/printing.service';
import type { LabDip } from '@/types/printing.types';
import { LabDipStatusLabels, LabDipStatusColors } from '@/types/printing.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export type ProcessType = 'DYEING' | 'PRINTING';

interface LabDipDetailProps {
  processType: ProcessType;
  backPath: string;
  title: string;
}

const COLOR_MATCH_RATINGS = [
  { value: 'Excellent', label: 'Excellent Match' },
  { value: 'Good', label: 'Good Match' },
  { value: 'Acceptable', label: 'Acceptable' },
  { value: 'Poor', label: 'Poor Match' },
];

export default function LabDipDetail({ processType, backPath, title }: LabDipDetailProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Dialog states
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  // Approve form
  const [approvedSampleNo, setApprovedSampleNo] = useState('');
  const [colorMatchRating, setColorMatchRating] = useState('');
  const [approveRemarks, setApproveRemarks] = useState('');

  // Reject form
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectRemarks, setRejectRemarks] = useState('');

  // Fetch lab dip
  const {
    data: labDip,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['lab-dip', processType, id],
    queryFn: async () => {
      if (!id) throw new Error('No ID provided');
      if (processType === 'DYEING') {
        return dyeLabDipService.getLabDipById(id);
      } else {
        return printLabDipService.getLabDipById(id);
      }
    },
    enabled: !!id,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No ID');
      if (processType === 'DYEING') {
        return dyeLabDipService.approveLabDip(id, {
          approvedSampleNo,
          colorMatchRating: colorMatchRating as 'Excellent' | 'Good' | 'Acceptable' | 'Poor',
          remarks: approveRemarks || undefined,
        });
      } else {
        return printLabDipService.approveLabDip(id, {
          approvedSampleNo,
          colorMatchRating: colorMatchRating || undefined,
          remarks: approveRemarks || undefined,
        });
      }
    },
    onSuccess: () => {
      handleApiSuccess('Lab dip approved successfully');
      queryClient.invalidateQueries({ queryKey: ['lab-dip', processType, id] });
      setApproveDialogOpen(false);
      resetApproveFo();
    },
    onError: (err) => handleApiError(err, 'Failed to approve lab dip'),
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No ID');
      if (processType === 'DYEING') {
        return dyeLabDipService.rejectLabDip(id, {
          rejectionReason,
          remarks: rejectRemarks || undefined,
        });
      } else {
        return printLabDipService.rejectLabDip(id, {
          rejectionReason,
          remarks: rejectRemarks || undefined,
        });
      }
    },
    onSuccess: () => {
      handleApiSuccess('Lab dip rejected');
      queryClient.invalidateQueries({ queryKey: ['lab-dip', processType, id] });
      setRejectDialogOpen(false);
      resetRejectForm();
    },
    onError: (err) => handleApiError(err, 'Failed to reject lab dip'),
  });

  // Resubmit mutation
  const resubmitMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No ID');
      if (processType === 'DYEING') {
        return dyeLabDipService.requestResubmit(id);
      } else {
        return printLabDipService.requestResubmit(id);
      }
    },
    onSuccess: () => {
      handleApiSuccess('Marked for resubmission');
      queryClient.invalidateQueries({ queryKey: ['lab-dip', processType, id] });
    },
    onError: (err) => handleApiError(err, 'Failed to mark for resubmission'),
  });

  const resetApproveFo = () => {
    setApprovedSampleNo('');
    setColorMatchRating('');
    setApproveRemarks('');
  };

  const resetRejectForm = () => {
    setRejectionReason('');
    setRejectRemarks('');
  };

  const handleApprove = () => {
    if (!approvedSampleNo) {
      handleApiError(new Error('Sample # required'), 'Please enter the approved sample number');
      return;
    }
    if (processType === 'DYEING' && !colorMatchRating) {
      handleApiError(new Error('Rating required'), 'Please select a color match rating');
      return;
    }
    approveMutation.mutate();
  };

  const handleReject = () => {
    if (!rejectionReason) {
      handleApiError(new Error('Reason required'), 'Please provide a rejection reason');
      return;
    }
    rejectMutation.mutate();
  };

  const canApprove = labDip?.status === 'PENDING' || labDip?.status === 'SUBMITTED' || labDip?.status === 'RESUBMIT';
  const canReject = labDip?.status === 'PENDING' || labDip?.status === 'SUBMITTED' || labDip?.status === 'RESUBMIT';
  const canRequestResubmit = labDip?.status === 'REJECTED';

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !labDip) {
    return (
      <div className="container mx-auto py-12 text-center">
        <p className="text-destructive">Failed to load lab dip details</p>
        <Button variant="outline" onClick={() => navigate(backPath)} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(backPath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <Beaker className={cn('h-6 w-6', processType === 'DYEING' ? 'text-info' : 'text-accent')} />
              <h1 className="text-2xl font-display font-medium">{labDip.labDipNumber}</h1>
              <Badge className={LabDipStatusColors[labDip.status] || 'bg-muted'}>
                {LabDipStatusLabels[labDip.status] || labDip.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{title}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {canApprove && (
            <Button onClick={() => setApproveDialogOpen(true)} className="bg-success hover:bg-success/90">
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
          )}
          {canReject && (
            <Button variant="destructive" onClick={() => setRejectDialogOpen(true)}>
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          )}
          {canRequestResubmit && (
            <Button variant="outline" onClick={() => resubmitMutation.mutate()} disabled={resubmitMutation.isPending}>
              {resubmitMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <RefreshCcw className="h-4 w-4 mr-2" />
              Request Resubmit
            </Button>
          )}
        </div>
      </div>

      {/* Main Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Style & Fabric */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Style & Fabric
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Style Code</p>
                <p className="font-medium">{labDip.style?.styleCode || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Style Name</p>
                <p className="font-medium">{labDip.style?.styleName || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fabric Code</p>
                <p className="font-medium">{labDip.fabric?.fabricCode || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fabric Name</p>
                <p className="font-medium">{labDip.fabric?.fabricName || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Processor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5" />
              Processor / Mill
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Processor Code</p>
                <p className="font-medium">{labDip.processor?.code || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Processor Name</p>
                <p className="font-medium">{labDip.processor?.name || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Process-Specific Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            {processType === 'DYEING' ? 'Color Details' : 'Print Details'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {processType === 'DYEING' ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Target Color</p>
                <div className="flex items-center gap-2">
                  {labDip.targetColor && (
                    <div
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: (labDip.targetColor as any)?.hexCode || '#ccc' }}
                    />
                  )}
                  <p className="font-medium">{labDip.targetColor?.colorName || '-'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Color Code</p>
                <p className="font-medium">{labDip.targetColor?.colorCode || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pantone Reference</p>
                <p className="font-medium">{labDip.colorReference || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Color Match Rating</p>
                <p className="font-medium">{labDip.colorMatchRating || '-'}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Design/Artwork</p>
                <p className="font-medium">{(labDip as LabDip).designArtwork || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Print Method</p>
                <p className="font-medium">{(labDip as LabDip).printMethod?.replace('_', ' ') || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Print Chemistry</p>
                <p className="font-medium">{(labDip as LabDip).printChemistry || '-'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dates & Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Submission Date</p>
              <p className="font-medium">
                {labDip.submissionDate ? format(new Date(labDip.submissionDate), 'dd MMM yyyy') : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expected Date</p>
              <p className="font-medium">
                {labDip.expectedDate ? format(new Date(labDip.expectedDate), 'dd MMM yyyy') : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Received Date</p>
              <p className="font-medium">
                {labDip.receivedDate ? format(new Date(labDip.receivedDate), 'dd MMM yyyy') : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Approval Date</p>
              <p className="font-medium">
                {labDip.approvalDate ? format(new Date(labDip.approvalDate), 'dd MMM yyyy') : '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Approval Details (if approved) */}
      {labDip.status === 'APPROVED' && (
        <Card className="border-success">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-success">
              <CheckCircle className="h-5 w-5" />
              Approval Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Approved Sample #</p>
                <p className="font-medium">{labDip.approvedSampleNo || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approved By</p>
                <p className="font-medium">{labDip.approvedBy?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Color Match Rating</p>
                <p className="font-medium">{labDip.colorMatchRating || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approval Date</p>
                <p className="font-medium">
                  {labDip.approvalDate ? format(new Date(labDip.approvalDate), 'dd MMM yyyy') : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rejection Details (if rejected) */}
      {labDip.status === 'REJECTED' && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Rejection Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <p className="text-sm text-muted-foreground">Rejection Reason</p>
              <p className="font-medium">{labDip.rejectionReason || '-'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Remarks */}
      {labDip.remarks && (
        <Card>
          <CardHeader>
            <CardTitle>Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{labDip.remarks}</p>
          </CardContent>
        </Card>
      )}

      {/* Created By */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Created By
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">User</p>
              <p className="font-medium">{labDip.createdBy?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created At</p>
              <p className="font-medium">
                {labDip.createdAt ? format(new Date(labDip.createdAt), 'dd MMM yyyy HH:mm') : '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Lab Dip</DialogTitle>
            <DialogDescription>Confirm approval of this lab dip sample</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="approvedSampleNo">Approved Sample # *</Label>
              <Input
                id="approvedSampleNo"
                value={approvedSampleNo}
                onChange={(e) => setApprovedSampleNo(e.target.value)}
                placeholder="e.g., S1, S2, S3"
              />
            </div>
            {processType === 'DYEING' && (
              <div className="space-y-2">
                <Label>Color Match Rating *</Label>
                <Select value={colorMatchRating} onValueChange={setColorMatchRating}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rating" />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_MATCH_RATINGS.map((rating) => (
                      <SelectItem key={rating.value} value={rating.value}>
                        {rating.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="approveRemarks">Remarks</Label>
              <Textarea
                id="approveRemarks"
                value={approveRemarks}
                onChange={(e) => setApproveRemarks(e.target.value)}
                placeholder="Optional remarks..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="bg-success hover:bg-success/90"
            >
              {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Lab Dip</DialogTitle>
            <DialogDescription>Provide a reason for rejection</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Rejection Reason *</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Color shade mismatch, Quality issues..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rejectRemarks">Additional Remarks</Label>
              <Textarea
                id="rejectRemarks"
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                placeholder="Optional additional remarks..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReject} disabled={rejectMutation.isPending} variant="destructive">
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
