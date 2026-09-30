// Complete a stitching issue — shows what was issued against what was recorded, and asks why when
// pieces were never recorded. Completing used to be one click: the slip to finishing carries only the
// recorded good pieces, so unrecorded ones vanished without a trace. The server refuses a short
// completion without a reason (completeStitchingIssue) and keeps the reason on the issue's remarks.
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { stitchingIssueService } from '@/services/stitching.service';
import type { StitchingIssue } from '@/types/stitching.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { stitchingOutputTotals } from '@/lib/stitching';

interface Props {
  issue: StitchingIssue | null;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}

export function CompleteStitchingDialog({ issue, onOpenChange, onCompleted }: Props) {
  // The body mounts on each open, so the reason starts empty every time
  if (!issue) return null;
  return <CompleteStitchingBody issue={issue} onOpenChange={onOpenChange} onCompleted={onCompleted} />;
}

function CompleteStitchingBody({ issue, onOpenChange, onCompleted }: Props & { issue: StitchingIssue }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const { issued, good, defect, unrecorded } = stitchingOutputTotals(issue);
  const short = unrecorded > 0;

  const complete = async () => {
    try {
      setSaving(true);
      await stitchingIssueService.complete(issue.id, short ? { shortReason: reason.trim() } : {});
      handleApiSuccess('Success', `Stitching issue ${issue.issueNumber} completed`);
      onOpenChange(false);
      onCompleted();
    } catch (error) {
      handleApiError(error, 'Failed to complete stitching');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete {issue.issueNumber}?</DialogTitle>
          <DialogDescription>
            The slip to finishing will carry the good pieces recorded. Record any missing output first if you can.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">Issued</div>
            <div className="text-lg font-semibold">{issued}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">Good</div>
            <div className="text-lg font-semibold text-success">{good}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">Defect</div>
            <div className="text-lg font-semibold text-destructive">{defect}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">Not recorded</div>
            <div className={`text-lg font-semibold ${short ? 'text-warning' : ''}`}>{unrecorded}</div>
          </div>
        </div>

        {short && (
          <div className="space-y-2">
            <Alert>
              <AlertDescription>
                {unrecorded} of {issued} pieces have no output recorded. They will not go to finishing.
              </AlertDescription>
            </Alert>
            <Label htmlFor="shortReason">Reason for completing short *</Label>
            <Textarea
              id="shortReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="e.g. pieces lost, returned to cutting…"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={complete} disabled={saving || (short && !reason.trim())}>
            {saving ? 'Completing…' : short ? 'Complete Short' : 'Complete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
