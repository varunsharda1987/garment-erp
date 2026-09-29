import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/lib/notify';
import { getErrorMessage } from '@/lib/api-error-handler';
import { useDefaultSettings } from '@/hooks/useDefaultSettings';
import { fabricStockService } from '@/services/fabricStockService';

export interface LotForWidthCorrection {
  id: string;
  /** "FAB-X-001 · GRN2609-0502" — how the lot is named in the title */
  label: string;
  finishedWidth: number | null;
  cutableWidth: number | null;
}

interface Props {
  lot: LotForWidthCorrection | null;
  onOpenChange: (open: boolean) => void;
  /** after a correction is saved (the caller refreshes what it shows) */
  onCorrected?: () => void;
}

/**
 * Correct a received lot's width (backend lot-width.helper): the measured width is what the fabric really is;
 * the cutable width — what a marker may use — is measured − the selvedge setting unless typed. Refused by the
 * server once the lot has gone to cutting.
 */
export function CorrectLotWidthDialog({ lot, onOpenChange, onCorrected }: Props) {
  return (
    <Dialog open={!!lot} onOpenChange={onOpenChange}>
      {/* keyed by lot: each lot opens with its own recorded widths */}
      {lot && <CorrectLotWidthForm key={lot.id} lot={lot} onOpenChange={onOpenChange} onCorrected={onCorrected} />}
    </Dialog>
  );
}

function CorrectLotWidthForm({ lot, onOpenChange, onCorrected }: Omit<Props, 'lot'> & { lot: LotForWidthCorrection }) {
  const { cutableWidthDeduction } = useDefaultSettings();
  const [measured, setMeasured] = useState(lot.finishedWidth != null ? String(lot.finishedWidth) : '');
  const [cutable, setCutable] = useState(lot.cutableWidth != null ? String(lot.cutableWidth) : '');
  const [cutableTyped, setCutableTyped] = useState(false);
  const [reason, setReason] = useState('');

  const measuredNum = Number(measured);
  const cutableNum = Number(cutable);
  // Until the cutable width is typed, it follows the measured width less the selvedge
  const derivedCutable =
    measuredNum > 0 && cutableWidthDeduction != null
      ? measuredNum > cutableWidthDeduction
        ? Math.round((measuredNum - cutableWidthDeduction) * 100) / 100
        : measuredNum
      : null;
  const shownCutable = cutableTyped ? cutable : derivedCutable != null ? String(derivedCutable) : cutable;
  const shownCutableNum = Number(shownCutable);
  const cutableTooWide = measuredNum > 0 && shownCutableNum > measuredNum;

  const mutation = useMutation({
    mutationFn: () =>
      fabricStockService.correctWidth(lot.id, {
        measuredWidthInches: measuredNum,
        cutableWidthInches: cutableTyped && cutableNum > 0 ? cutableNum : null,
        reason: reason.trim(),
      }),
    onSuccess: (result) => {
      notify.success(result.message ?? 'Width corrected');
      onCorrected?.();
      onOpenChange(false);
    },
    onError: (error) => notify.error(getErrorMessage(error), { duration: 7000 }),
  });

  const canSave =
    measuredNum > 0 && shownCutableNum > 0 && !cutableTooWide && reason.trim().length >= 3 && !mutation.isPending;

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Correct width — {lot.label}</DialogTitle>
        <DialogDescription>
          Recorded now: {lot.finishedWidth ?? '—'}" measured, {lot.cutableWidth ?? '—'}" cutable. The CAD for this lot
          is made on its cutable width.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="clw-measured">Measured width (inches)</Label>
          <Input
            id="clw-measured"
            type="number"
            min={0.01}
            step="any"
            value={measured}
            onChange={(e) => setMeasured(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="clw-cutable">Cutable width (inches)</Label>
          <Input
            id="clw-cutable"
            type="number"
            min={0.01}
            step="any"
            value={shownCutable}
            onChange={(e) => {
              setCutableTyped(true);
              setCutable(e.target.value);
            }}
          />
        </div>
      </div>
      <p className={`text-xs ${cutableTooWide ? 'text-destructive' : 'text-muted-foreground'}`}>
        {cutableTooWide
          ? 'The cutable width cannot be more than the measured width.'
          : cutableTyped
            ? 'Cutable width typed by hand.'
            : cutableWidthDeduction != null
              ? `Cutable = measured − ${cutableWidthDeduction}" selvedge. Type it to use another figure.`
              : 'Cutable = measured − the selvedge setting.'}
      </p>

      <div className="space-y-2">
        <Label htmlFor="clw-reason">Reason</Label>
        <Textarea
          id="clw-reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder='e.g. receipt recorded 57"; the fabric measures 55"'
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button onClick={() => mutation.mutate()} disabled={!canSave}>
          {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save width
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
