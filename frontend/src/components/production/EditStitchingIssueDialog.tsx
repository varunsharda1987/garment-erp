// Edit an open stitching issue — its dates, contractor, stitching rate and remarks. The page had no way to change any
// of them, so an issue given to the wrong contractor stayed wrong. A Completed issue cannot be edited
// (the server refuses it).
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SupplierCombobox } from '@/components/SupplierCombobox';
import { stitchingIssueService } from '@/services/stitching.service';
import type { StitchingIssue } from '@/types/stitching.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { toDateInputValue } from '@/lib/date';

interface Props {
  issue: StitchingIssue | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditStitchingIssueDialog({ issue, onOpenChange, onSaved }: Props) {
  // The body mounts on each open, so the fields start from the issue as it is now
  if (!issue) return null;
  return <EditStitchingIssueBody issue={issue} onOpenChange={onOpenChange} onSaved={onSaved} />;
}

function EditStitchingIssueBody({ issue, onOpenChange, onSaved }: Props & { issue: StitchingIssue }) {
  const [issueDate, setIssueDate] = useState(toDateInputValue(issue.issueDate));
  const [contractorId, setContractorId] = useState(issue.contractor?.id ?? '');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState(
    issue.expectedCompletionDate ? toDateInputValue(issue.expectedCompletionDate) : ''
  );
  const [remarks, setRemarks] = useState(issue.remarks ?? '');
  // The rate given to the operators per piece; the commission % stays the one of the issue's day
  const [operatorRate, setOperatorRate] = useState(
    issue.operatorRatePerPiece != null ? String(issue.operatorRatePerPiece) : ''
  );
  const [saving, setSaving] = useState(false);
  const rate = Number(operatorRate);
  const rateValid = operatorRate.trim() === '' || (Number.isFinite(rate) && rate > 0);

  const save = async () => {
    try {
      setSaving(true);
      await stitchingIssueService.update(issue.id, {
        issueDate,
        contractorId: contractorId || null,
        ...(operatorRate.trim() !== '' ? { operatorRatePerPiece: rate } : {}),
        expectedCompletionDate: expectedCompletionDate || null,
        remarks,
      });
      handleApiSuccess('Saved', `Stitching issue ${issue.issueNumber} updated`);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      handleApiError(error, 'Failed to update the stitching issue');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {issue.issueNumber}</DialogTitle>
          <DialogDescription>
            Change the dates, the stitching contractor, the stitching rate or the remarks.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="editIssueDate">Issue Date *</Label>
              <Input
                id="editIssueDate"
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="editExpectedCompletion">Expected Completion</Label>
              <Input
                id="editExpectedCompletion"
                type="date"
                value={expectedCompletionDate}
                min={issueDate}
                onChange={(e) => setExpectedCompletionDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Stitching Contractor *</Label>
            <SupplierCombobox
              value={contractorId}
              onValueChange={setContractorId}
              categoryFilter="STITCHING_CONTRACTOR"
              selectedSupplier={issue.contractor ?? null}
              placeholder="Select contractor..."
            />
          </div>
          <div>
            <Label htmlFor="editOperatorRate">Stitching rate to operators (₹ / pc)</Label>
            <Input
              id="editOperatorRate"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={operatorRate}
              onChange={(e) => setOperatorRate(e.target.value)}
              className="w-40"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {issue.commissionPercent != null
                ? `The contractor's ${issue.commissionPercent}% commission of this issue is added on top.`
                : "The contractor's commission (Settings) is added on top."}
            </p>
          </div>
          <div>
            <Label htmlFor="editRemarks">Remarks</Label>
            <Textarea
              id="editRemarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              maxLength={1000}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !issueDate || !contractorId || !rateValid}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
