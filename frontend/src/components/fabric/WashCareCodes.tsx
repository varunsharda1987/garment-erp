/**
 * Wash-care codes for one fabric, a row per buyer.
 *
 * The same fabric carries different care instructions for different customers, so the codes
 * belong to the pair — not to the fabric. Showing them together on the fabric is the point:
 * you can see at a glance that Easybuy call it RN-6 and someone else calls it RN-2.
 *
 * Codes also get learned from Test Requirement Forms as they are raised, so this list fills
 * itself over time; this screen is where you check and correct what it learned.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomerCombobox } from '@/components/CustomerCombobox';
import { washCareService } from '@/services/washCare.service';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

interface Props {
  greigeId: string;
  /** Read-only when the caller has no write permission for fabric masters. */
  readOnly?: boolean;
}

export function WashCareCodes({ greigeId, readOnly = false }: Props) {
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState('');
  const [code, setCode] = useState('');

  const key = ['wash-care-codes', greigeId];

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => washCareService.listForGreige(greigeId),
  });

  const addMutation = useMutation({
    mutationFn: () => washCareService.set({ customerId, greigeId, washCareCode: code.trim() }),
    onSuccess: () => {
      handleApiSuccess('Wash care code saved');
      setCustomerId('');
      setCode('');
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error) => handleApiError(error, 'Could not save the code'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => washCareService.remove(id),
    onSuccess: () => {
      handleApiSuccess('Removed');
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error) => handleApiError(error, 'Could not remove the code'),
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-medium text-foreground">Wash care codes</h3>
        <p className="text-sm text-muted-foreground">
          One per buyer &mdash; the same fabric can carry a different code for each. Prints on that buyer&rsquo;s Test
          Requirement Form.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center py-4 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading&hellip;
        </div>
      ) : rows.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          No codes recorded yet. A buyer&rsquo;s form will print a blank box to fill by hand until one is set here.
        </p>
      ) : (
        <div className="divide-y rounded-md border">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-4 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{row.customer?.name ?? 'Unknown buyer'}</div>
                {row.color?.colorName && (
                  <div className="text-xs text-muted-foreground">{row.color.colorName} only</div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-sm font-medium">{row.washCareCode}</span>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate(row.id)}
                    aria-label={`Remove the code for ${row.customer?.name ?? 'this buyer'}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-end gap-3 pt-1">
          <div className="min-w-[220px] flex-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Buyer</Label>
            <CustomerCombobox value={customerId} onValueChange={setCustomerId} placeholder="Select buyer&hellip;" />
          </div>
          <div className="w-40">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. RN-6" />
          </div>
          <Button onClick={() => addMutation.mutate()} disabled={!customerId || !code.trim() || addMutation.isPending}>
            {addMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
